#!/usr/bin/env node
'use strict';
// YouTube Data API v3 動画アップロード(resumable upload) + サムネイル設定。依存ゼロ(Node24ネイティブfetch/http)。
//   node tools/_yt_upload.js --file v.mp4 --title "..." [--desc "..."] [--tags a,b] [--privacy private|unlisted|public] [--thumb t.png] [--dry-run]
//   node tools/_yt_upload.js --auth   (初回1回だけ: refresh token を取得し ~/.pchamdb_sns.json へ保存)
// 認証=OAuth2 refresh token(client_id/secret/refresh_token)。access token 更新は fetch で。
// 未審査アプリは強制 private になる仕様(mdに明記)→「Claudeが非公開アップ→阿部さんが公開」運用。
// セットアップは tools/SNS自動化_セットアップ手順.md のYouTubeセクション。
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = ['https://www.googleapis.com/auth/youtube']; // upload + 自分の動画のサムネイル
const REDIRECT_PORT = 8423; // 任意の空きポート。承認済みリダイレクトに http://localhost:8423 を使う。
const CHUNK = 8 * 1024 * 1024; // resumable チャンク(8MB)

const USAGE = `YouTube 動画アップロード (Data API v3 / resumable)

使い方:
  node tools/_yt_upload.js --file V.mp4 --title "タイトル" [options]
  node tools/_yt_upload.js --auth    (初回1回: refresh token 取得)

オプション:
  --file PATH          動画ファイル(.mp4/.mov)(必須)
  --title "..."        動画タイトル(必須)
  --desc "..."         説明文
  --tags a,b,c         タグ(カンマ区切り)
  --privacy private    private / unlisted / public(既定 private=未審査アプリの強制値)
  --thumb PATH         サムネイル(.png/.jpg・2MB以内)
  --dry-run            送信せず内容を表示
  --help, -h           このヘルプ

認証: ~/.pchamdb_sns.json の "youtube" に client_id / client_secret / refresh_token。
初回は上記2つを入れて --auth を実行(ブラウザが開き refresh_token を保存)。
手順は tools/SNS自動化_セットアップ手順.md
`;

function parseArgs(argv) {
  const out = { file: null, title: null, desc: '', tags: null, privacy: 'private', thumb: null, dryRun: false, auth: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--auth') out.auth = true;
    else if (a === '--file') out.file = argv[++i];
    else if (a.startsWith('--file=')) out.file = a.slice(7);
    else if (a === '--title') out.title = argv[++i];
    else if (a.startsWith('--title=')) out.title = a.slice(8);
    else if (a === '--desc') out.desc = argv[++i];
    else if (a.startsWith('--desc=')) out.desc = a.slice(7);
    else if (a === '--tags') out.tags = argv[++i];
    else if (a.startsWith('--tags=')) out.tags = a.slice(7);
    else if (a === '--privacy') out.privacy = argv[++i];
    else if (a.startsWith('--privacy=')) out.privacy = a.slice(10);
    else if (a === '--thumb') out.thumb = argv[++i];
    else if (a.startsWith('--thumb=')) out.thumb = a.slice(8);
  }
  if (typeof out.tags === 'string') out.tags = out.tags.split(',').map((s) => s.trim()).filter(Boolean);
  if (!['private', 'unlisted', 'public'].includes(out.privacy)) throw new Error('--privacy は private / unlisted / public のいずれか');
  return out;
}

function cfgPath() { return path.join(os.homedir(), '.pchamdb_sns.json'); }
function loadConfig() { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch { return {}; } }
function saveConfig(cfg) { fs.writeFileSync(cfgPath(), JSON.stringify(cfg, null, 2) + '\n'); try { fs.chmodSync(cfgPath(), 0o600); } catch {} }
function getYtCreds() {
  const y = loadConfig().youtube || {};
  for (const k of ['client_id', 'client_secret', 'refresh_token']) {
    if (!y[k] || !String(y[k]).trim())
      throw new Error(`YouTube認証情報が足りません: ~/.pchamdb_sns.json の youtube.${k} を設定してください。初回は node tools/_yt_upload.js --auth を実行(手順: tools/SNS自動化_セットアップ手順.md)`);
  }
  return { clientId: y.client_id, clientSecret: y.client_secret, refreshToken: y.refresh_token };
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getAccessToken(creds) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId, client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken, grant_type: 'refresh_token',
    }).toString(),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`アクセストークン更新失敗(${res.status}): ${JSON.stringify(j).slice(0, 300)}`);
  return j.access_token;
}

// resumable upload: ①空POSTでLocation取得 → ②8MBチャンクPUT(308で継続/2xxで完了・失敗1回リトライ)
async function startResumableSession(token, meta, filePath, contentType) {
  const size = fs.statSync(filePath).size;
  const url = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify(meta),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`アップロードセッション開始失敗(${res.status}): ${t.slice(0, 300)}`); }
  const loc = res.headers.get('Location') || res.headers.get('location');
  if (!loc) throw new Error('Locationヘッダが返りません(resumable session URL)。');
  return { location: loc, size };
}

async function putChunks(location, filePath, size) {
  const fd = fs.openSync(filePath, 'r');
  let start = 0, attempt = 0;
  try {
    while (start < size) {
      const end = Math.min(start + CHUNK, size) - 1;
      const len = end - start + 1;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, start);
      const res = await fetch(location, {
        method: 'PUT',
        headers: { 'Content-Length': String(len), 'Content-Range': `bytes ${start}-${end}/${size}` },
        body: buf,
      });
      if (res.status === 308) {
        const range = res.headers.get('Range') || res.headers.get('range');
        start = range ? (parseInt((/bytes=0-(\d+)/.exec(range) || [])[1], 10) + 1) : (end + 1);
        attempt = 0;
        process.stdout.write(`\rアップロード中 ${Math.round(start / size * 100)}% (${(start / 1048576).toFixed(1)}/${(size / 1048576).toFixed(1)}MB)`);
      } else if (res.status >= 200 && res.status < 300) {
        process.stdout.write(`\rアップロード中 100% (${(size / 1048576).toFixed(1)}MB)     \n`);
        return await res.json();
      } else {
        if (attempt < 1) { attempt++; await sleep(2000); continue; } // 同チャンク1回リトライ
        const t = await res.text();
        throw new Error(`アップロード失敗(HTTP ${res.status}): ${t.slice(0, 300)}`);
      }
    }
    throw new Error('ファイルサイズが0のためアップロードできません');
  } finally { fs.closeSync(fd); }
}

async function setThumbnail(token, videoId, thumbPath) {
  const url = `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`;
  const buf = fs.readFileSync(thumbPath);
  const ct = thumbPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': ct, 'Content-Length': String(buf.length) },
    body: buf,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`サムネイル設定失敗(${res.status}): ${t.slice(0, 300)}`); }
  return res.json();
}

// --auth: ローカルhttpサーバでcodeを受けてtoken交換 → refresh_token を保存(ワンタイム)。
async function doAuth() {
  const y = loadConfig().youtube || {};
  if (!y.client_id || !y.client_secret)
    throw new Error('先に ~/.pchamdb_sns.json の youtube.client_id / youtube.client_secret を入れてから --auth を実行してください(手順md)。');
  const redirect = `http://localhost:${REDIRECT_PORT}`;
  const params = new URLSearchParams({
    client_id: y.client_id, redirect_uri: redirect, response_type: 'code',
    scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', // consent必須=毎回refresh_token発行
  });
  const authUrl = AUTH_URL + '?' + params.toString();

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, redirect);
      if (u.pathname !== '/') { res.writeHead(404); res.end(); return; }
      const c = u.searchParams.get('code');
      const err = u.searchParams.get('error');
      if (err) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('認可エラー: ' + err); server.close(); reject(new Error('認可が拒否されました: ' + err)); return; }
      if (c) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<h1>OK</h1>ブラウザは閉じて構いません。refresh_token を保存しました。'); server.close(); resolve(c); return; }
      res.writeHead(400); res.end('no code');
    });
    server.on('error', (e) => reject(new Error(`ローカルサーバ起動失敗(ポート${REDIRECT_PORT}使用中?): ${e.message}`)));
    server.listen(REDIRECT_PORT);
    console.log('ブラウザでGoogle認可を行います(自動で開きます)...');
    exec(`open "${authUrl}"`, () => {}); // macOS。Windowsは 'start'・Linuxは 'xdg-open' に読替え。
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: y.client_id, client_secret: y.client_secret,
      redirect_uri: redirect, grant_type: 'authorization_code',
    }).toString(),
  });
  const tj = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`トークン交換失敗(${tokenRes.status}): ${JSON.stringify(tj).slice(0, 300)}`);
  if (!tj.refresh_token) throw new Error('refresh_tokenが返りません。Googleアカウント側で既存の許可を取り消して再試行してください(prompt:consent 必須)。');
  const c2 = loadConfig(); c2.youtube = Object.assign({}, c2.youtube || {}, { refresh_token: tj.refresh_token }); saveConfig(c2);
  console.log('refresh_token を ~/.pchamdb_sns.json に保存しました(パーミッション600)。これでアップロードできます。');
}

(async () => {
  const args = parseArgs(process.argv);
  if (args.help) { console.log(USAGE); return; }
  if (args.auth) { await doAuth(); return; }
  if (!args.file || !args.title) { console.error('エラー: --file と --title は必須です\n\n' + USAGE); process.exit(2); }
  if (!fs.existsSync(args.file)) { console.error('動画が見つかりません: ' + args.file); process.exit(2); }

  const contentType = args.file.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  const meta = {
    snippet: { title: args.title, description: args.desc || '', tags: (args.tags && args.tags.length) ? args.tags : undefined },
    status: { privacyStatus: args.privacy, selfDeclaredMadeForKids: false },
  };
  const size = fs.statSync(args.file).size;
  console.log(`対象: ${args.file} (${(size / 1048576).toFixed(1)}MB) privacy=${args.privacy}`);

  if (args.dryRun) {
    console.log('[dry-run] resumable session 開始 → 8MBチャンクPUT → (サムネイル設定: 指定時のみ)');
    console.log('[dry-run] metadata: ' + JSON.stringify(meta));
    if (args.thumb) console.log('[dry-run] thumb: ' + args.thumb);
    return;
  }

  const creds = getYtCreds();
  const token = await getAccessToken(creds);
  const { location } = await startResumableSession(token, meta, args.file, contentType);
  const video = await putChunks(location, args.file, size);
  const vid = video && video.id;
  if (!vid) throw new Error('アップロード完了したが video id が取れない: ' + JSON.stringify(video).slice(0, 300));
  console.log(`アップロード完了: https://www.youtube.com/watch?v=${vid} (privacy=${args.privacy})`);

  if (args.thumb) {
    try {
      if (!fs.existsSync(args.thumb)) throw new Error('ファイル不在');
      await setThumbnail(token, vid, args.thumb);
      console.log('サムネイル設定完了: ' + args.thumb);
    } catch (e) {
      // アップロード本体は成功済。サムネは警告のみ(後でStudioから手動設定可)。
      console.error('⚠ サムネイル設定をスキップ(' + (e.message || e) + ')。YouTube Studioから手動設定してください。');
    }
  }
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
