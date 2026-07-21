#!/usr/bin/env node
'use strict';
// OBS録画の自動制御(obs-websocket v5プロトコル)。依存ゼロ・Node24ネイティブWebSocket/crypto使用。
//   node tools/_obs_record.js start | stop | status [--password=XXX] [--host=127.0.0.1] [--port=4455] [--dry-run]
//   start  = StartRecord / stop = StopRecord(出力パスを stdout) / status = GetRecordStatus
// パスワードは --password → 環境変数 OBS_WS_PASSWORD → ~/.pchamdb_sns.json の obs.password の順で解決。
// セットアップは tools/SNS自動化_セットアップ手順.md のOBSセクション。
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = globalThis.WebSocket;

const USAGE = `OBS録画 自動制御 (obs-websocket v5)

使い方:
  node tools/_obs_record.js start    録画開始 (StartRecord)
  node tools/_obs_record.js stop     録画停止 (StopRecord / 出力先パスを標準出力)
  node tools/_obs_record.js status   録画状態 (GetRecordStatus)

オプション:
  --password=XXX     WebSocketパスワード(未指定時は 環境変数 OBS_WS_PASSWORD → ~/.pchamdb_sns.json の obs.password)
  --host=127.0.0.1   OBS WebSocket ホスト
  --port=4455        OBS WebSocket ポート
  --dry-run          実行せず送信内容だけ表示
  --help, -h         このヘルプ

準備(OBS側・1回だけ):
  OBS → ツール → WebSocketサーバ設定 → 「WebSocketサーバを有効にする」をオン。
  詳細は tools/SNS自動化_セットアップ手順.md
`;

function parseArgs(argv) {
  const out = { cmd: null, password: null, host: '127.0.0.1', port: 4455, dryRun: false, help: false };
  for (const a of argv.slice(2)) {
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--password=')) out.password = a.slice(11);
    else if (a.startsWith('--host=')) out.host = a.slice(7);
    else if (a.startsWith('--port=')) out.port = parseInt(a.slice(7), 10);
    else if (!a.startsWith('-') && !out.cmd) out.cmd = a;
  }
  return out;
}

function loadConfig() {
  const p = path.join(os.homedir(), '.pchamdb_sns.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function resolvePassword(cliPw) {
  if (cliPw) return cliPw;
  if (process.env.OBS_WS_PASSWORD) return process.env.OBS_WS_PASSWORD;
  const cfg = loadConfig();
  const v = cfg && cfg.obs && cfg.obs.password;
  return (typeof v === 'string' && v.length) ? v : null;
}

// obs-websocket v5 認証文字列: base64( sha256( base64(sha256(password+salt)) + challenge ) )
// challenge/salt は Hello(op:0) に乗って来る。sha256二段(+base64)を自前で。
function obsAuthString(password, salt, challenge) {
  const inner = crypto.createHash('sha256').update(password + salt, 'utf8').digest('base64');
  return crypto.createHash('sha256').update(inner + challenge, 'utf8').digest('base64');
}

function friendlyConnError(url, e) {
  return new Error(
    `OBS WebSocketに接続できません(${url})。\n` +
    `→ OBSを起動してください。\n` +
    `→ OBS: ツール → WebSocketサーバ設定 →「WebSocketサーバを有効にする」をオン(既定ポート4455)。\n` +
    (e ? `→ 詳細: ${e.message || e}` : '')
  );
}

// op:6 Request を投げて op:7 RequestResponse をrequestIdで突き合わせるラッパ。
class ObsClient {
  constructor(url) { this.url = url; this.ws = null; this._pending = new Map(); this._seq = 1; }
  connect(password) {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url); }
      catch (e) { reject(friendlyConnError(this.url, e)); return; }
      this.ws = ws;
      const settled = { done: false };
      const failTimer = setTimeout(() => {
        if (settled.done) return; settled.done = true;
        try { ws.close(); } catch {}
        reject(new Error(`OBSへの接続がタイムアウトしました(${this.url})。\n→ OBSは起動していますか? ツール→WebSocketサーバ設定で有効化を確認。`));
      }, 8000);

      ws.addEventListener('error', () => {
        if (settled.done) return; settled.done = true; clearTimeout(failTimer);
        reject(friendlyConnError(this.url));
      });
      ws.addEventListener('close', () => {
        if (settled.done) return; settled.done = true; clearTimeout(failTimer);
        reject(new Error(`OBSが接続を閉じました(${this.url})。パスワード不一致 or OBS未起動の可能性があります。`));
      });
      ws.addEventListener('message', (ev) => {
        let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch { return; }
        if (m.op === 0) { // Hello → 認証要求があれば Identify 送信
          const auth = m.d && m.d.authentication;
          let authStr;
          if (auth && auth.salt && auth.challenge) {
            if (!password) {
              if (!settled.done) { settled.done = true; clearTimeout(failTimer); try { ws.close(); } catch {} }
              reject(new Error(
                'OBSがパスワード認証を要求しています。\n' +
                '→ --password=xxx または環境変数 OBS_WS_PASSWORD を設定してください。\n' +
                '→ 手順: tools/SNS自動化_セットアップ手順.md のOBSセクション'));
              return;
            }
            authStr = obsAuthString(password, auth.salt, auth.challenge);
          }
          ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: authStr, eventSubscriptions: 0 } }));
        } else if (m.op === 2) { // Identified → 接続確立
          if (!settled.done) { settled.done = true; clearTimeout(failTimer); resolve(); }
        } else if (m.op === 7) { // RequestResponse
          const d = m.d || {}; const p = this._pending.get(d.requestId);
          if (p) {
            this._pending.delete(d.requestId);
            const st = d.requestStatus || {};
            if (!st.result) p.reject(new Error(`OBSリクエスト失敗(${d.requestType}): ${st.comment || ('code ' + st.code)}`));
            else p.resolve(d.responseData || {});
          }
        }
      });
    });
  }
  call(requestType, requestData) {
    const requestId = 'req-' + (this._seq++);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this._pending.delete(requestId); reject(new Error(`OBSリクエスト(${requestType})がタイムアウトしました`)); }, 10000);
      this._pending.set(requestId, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestData: requestData || {}, requestId } }));
    });
  }
  close() { try { this.ws && this.ws.close(); } catch {} }
}

(async () => {
  const args = parseArgs(process.argv);
  if (args.help) { console.log(USAGE); return; }
  if (!args.cmd || !['start', 'stop', 'status'].includes(args.cmd)) { console.error(USAGE); process.exit(2); }

  const url = `ws://${args.host}:${args.port}`;
  const password = resolvePassword(args.password);
  const reqType = args.cmd === 'start' ? 'StartRecord' : args.cmd === 'stop' ? 'StopRecord' : 'GetRecordStatus';

  if (args.dryRun) {
    console.log(`[dry-run] ${url} へ接続 → op:6 Request "${reqType}" 送信予定(認証=${password ? 'あり' : 'なし'})`);
    return;
  }

  const client = new ObsClient(url);
  try {
    await client.connect(password);
    if (args.cmd === 'start') {
      // 録画中だと StartRecord がエラーになるので先に状態を見て親切化。
      let already = false;
      try { const s = await client.call('GetRecordStatus'); already = !!(s && s.outputActive); } catch {}
      if (already) console.log('OBSはすでに録画中です(開始をスキップ)。');
      else { await client.call('StartRecord'); console.log('録画を開始しました。'); }
    } else if (args.cmd === 'stop') {
      const resp = await client.call('StopRecord');
      const out = (resp && (resp.outputPath || resp.output_path)) || '';
      console.log(out || '録画を停止しました(出力パス不明)。');
    } else { // status
      const s = await client.call('GetRecordStatus');
      console.log(JSON.stringify({
        active: !!s.outputActive, paused: !!s.outputPaused,
        timecode: s.outputTimecode || null, duration: s.outputDuration || null, bytes: s.outputBytes || null,
      }, null, 2));
    }
  } catch (e) {
    console.error(String(e && e.message || e));
    process.exit(1);
  } finally {
    client.close();
  }
})();
