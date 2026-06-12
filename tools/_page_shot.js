#!/usr/bin/env node
// ページを開いて「N秒後に」スクリーンショットを撮る(CDP直叩き・依存なし)
// 使い方: node tools/_page_shot.js <URL> <待ちミリ秒> <出力PNG> [幅x高さ]
// 背景: chrome --headless --screenshot はロード直後に撮る(--timeoutはロード待ちの上限)ため、
//       ロード後にJSで進む画面(リアルバトルのデモ等)が撮れない → CDPで待ってから撮る。
const { spawn, execSync } = require('child_process');

const [, , url, delayStr, out, sizeStr] = process.argv;
if (!url || !out) { console.error('usage: node tools/_page_shot.js <URL> <delayMs> <out.png> [WxH]'); process.exit(1); }
const delay = +delayStr || 5000;
const [W, H] = (sizeStr || '780x820').split('x').map(Number);
// ポート/プロファイルは毎回ユニークに(固定だと前回の残骸と衝突してWS接続がハングした)
const PORT = 9400 + (process.pid % 100);
const PROFILE = `/tmp/_pageshot_${process.pid}`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  `--window-size=${W},${H}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

// 全体タイムアウト: ハングしても必ず終わる
setTimeout(() => { console.error('timeout'); try { chrome.kill(); } catch (e) {} process.exit(2); }, delay + 40000);

const sleep = ms => new Promise(r => setTimeout(r, ms));

const step = m => process.env.PS_QUIET ? null : console.error('…' + m);
(async () => {
  // デバッガ起動待ち
  let target = null;
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const list = await res.json();
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch (e) {}
  }
  if (!target) throw new Error('Chrome debugger に接続できない');
  step('debugger接続OK port=' + PORT);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let mid = 0;
  const pending = new Map();
  const send = (method, params, timeoutMs) => new Promise((resolve, reject) => {
    const id = ++mid;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    if (timeoutMs) setTimeout(() => {
      if (pending.has(id)){ pending.delete(id); reject(new Error(method + ' タイムアウト')); }
    }, timeoutMs);
  });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    }
    // alert/prompt等のJSダイアログはJS実行をブロックする → 自動で閉じる
    if (m.method === 'Page.javascriptDialogOpening') {
      step('JSダイアログを自動で閉じる: ' + (m.params && m.params.message || '').slice(0, 40));
      send('Page.handleJavaScriptDialog', { accept: true });
    }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('WebSocket接続失敗')); });
  step('ws open');

  await send('Page.enable');
  step('Page.enable OK');
  // 注: Emulation.setDeviceMetricsOverride は環境によって応答が返らずハングするため使わない
  // (ウィンドウサイズは起動引数 --window-size で指定済み)
  await send('Page.navigate', { url });
  step('navigate OK → ' + delay + 'ms 待ち');
  await sleep(delay);   // ロード後の進行をここで待つ(本来の目的)
  // captureScreenshot は稀に応答が返らない(アニメーション中のフレーク)→ 個別タイムアウト+リトライ
  let shot = null;
  for (let t = 1; t <= 3 && !shot; t++){
    try {
      // 画面が静止していると新フレームが来ずcaptureが返らないことがある → 微小な再描画を強制
      await send('Runtime.evaluate', { expression: `document.body.style.opacity = (document.body.style.opacity === '0.999' ? '1' : '0.999')` }, 4000).catch(() => {});
      shot = await send('Page.captureScreenshot', { format: 'png' }, 8000);
    }
    catch (e) { step(`capture失敗(${t}回目): ${e.message} → リトライ`); await sleep(800); }
  }
  if (!shot) throw new Error('captureScreenshot が3回失敗');
  step('captureScreenshot OK');
  require('fs').writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved:', out);
  ws.close();
  chrome.kill();
  process.exit(0);
})().catch(e => { console.error(e.message); chrome.kill(); process.exit(1); });
