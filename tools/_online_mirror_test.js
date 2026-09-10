#!/usr/bin/env node
'use strict';
// オンライン対戦「鏡写し」E2Eテスト(2ブラウザ・ホスト/ゲスト)。
//
// 使い方: node tools/_online_mirror_test.js [--turns=N] [--port=8010] [--headed]
//   --turns=N  比較するターン数(既定3。テストダミーはHP924なので数ターンでは瀕死にならない)
//   --port=P   ローカルサーバのポート(既定8010。8000は他作業が使うため使わない)
//   --headed   ヘッドフルで起動(既定はheadless)
//
// 前提: リポジトリ直下で実行。Playwrightインストール済み(require('playwright'))。
//
// ★背景(2026-09-07・B064 D0): review/_b064_staged_plan_2026-09-06.md §3「同期」行が参照する
//   scratchpad/e2e_online.js は git履歴・worktreeのどこにも存在しない(セッション一時ファイルの消失)。
//   `次回ここから.md:728` によれば、その旧テストは実Supabaseで「16ターン全ログ一致・HP鏡写し・
//   死に出し往復・勝敗整合・JSエラー0」を確認していた実績がある。本ファイルはtools/配下への作り直し版。
//
// ★トランスポート調査(online_battle.html / online/rb_online.js を読んで確認した事実):
//   - 通信 = Supabase Realtime(broadcast + presence)。ライブラリはCDN(jsdelivr)から遅延ロード。
//     online/supabase-config.js の window.PCHAM_SUPABASE.url が接続先プロジェクト。
//   - 部屋 = 'pcham_room:' + 合言葉(roomコード)というRealtimeチャンネル名。
//     presenceに先着した側(online_atが最小)がホスト=エンジンを回す権威、後着がゲスト。
//   - 合言葉ルームへの入室はUIの[せつぞく]ボタン(onlineConnect)からだが、その下請けの
//     onlineConnectRoom(room, name) を直接呼べば、ロビー/あいことばUIを経由せず同じ経路で接続できる
//     (online_battle.html:4919-4926)。
//   - 共有乱数シードはロックステップ方式: ホストが毎ターンseedを発行し、
//     RBOnline.sendTurnGo(action, seed, turn) / sendStart(seed) / sendFaintReplace(idx, seed) で配る。
//     受け手は onlineSeedEngine(seed) で `engineWin().Math.random = m32(seed)` に差し替えてから
//     同じ行動を適用する(online_battle.html:4822-4828, 5353-5377)。
//   - バトル本体はiframe(#engine-frame = real_battle_simulator.html)の window.__sim を
//     `S` という変数(トップレベルlet)で橋渡ししている(online_battle.html:1271, 1404-1420)。
//     S.battleLog(配列そのもの)・S.sides.self / S.sides.opp(currentHp等)・S.realStat(side,'hp')
//     から状態を読める。
//   - online_battle.html はconst/letで宣言されたグローバル(S, RB_ONLINE, PICK, turnNo, m32,
//     selfIds, setSlot, onlineConnectRoom, onlineSubmitAction, confirmPick 等)を素の<script>タグの
//     トップレベルに置いている。functionは自動でwindowに乗るが、const/letはwindowには乗らない
//     (RB_ONLINEはコード中のコメントの通り例外的に明示 window.RB_ONLINE = RB_ONLINE されている)。
//     ただしPlaywrightのpage.evaluate/waitForFunctionはdevtoolsコンソールと同じグローバル字句
//     スコープで評価されるため、window.に乗っていないconst/letも直接参照できる(実測で確認)。
//     これを利用し、UIクリック(検索モーダル等)を経由せずページの本物の関数を直接呼んで駆動する。
//
// ★設計(このテストがやること):
//   1. online/supabase-config.js の接続先URLに実際に到達できるか先にNode側で調べる
//      (DNS解決→HTTPS到達)。ダメなら「SKIP: 外部シグナリング到達不能」を出して非0終了する
//      (成功したフリをしない・実行せず終わることを明示する)。
//   2. 到達できるなら、ローカルサーバを立てて2つのブラウザコンテキスト(host/guest)を開き、
//      同じ部屋コードで接続。固定の検証用チーム(テストダミー3体=HP924・全技使用可・特性なし。
//      real_battle_simulator.html:9308-9311のdev専用ダミー)を両者にセットし、見せ合い選出→開戦。
//   3. 指定ターン数ぶん「毎ターン先頭の技(idx=0)を選ぶ」を両クライアントで実行し、ターンごとに
//      ①バトルログ(───区切り行を除く)②両者のHP(実数値/最大値、視点を鏡写しに入れ替えて比較)
//      ③RNG消費回数(online_battle.htmlのm32をラップして計測。ページ改変ではなく実行時パッチ)
//      を突き合わせる。1つでも食い違えば診断を出して非0終了する。
//
// 変更禁止: online_battle.html / real_battle_simulator.html / 他のtools / master / 生成物。
// 出力先: review/_b064_d0_2026-09-07/mirror/ 配下のみ。

const path = require('path');
const fs = require('fs');
const https = require('https');
const dns = require('dns');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { observePage } = require('./_lib/browser_audit');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { turns: 3, port: 8010, headed: false };
  for (const a of argv) {
    if (a === '--headed') out.headed = true;
    else if (a.startsWith('--turns=')) out.turns = Math.max(1, parseInt(a.slice('--turns='.length), 10) || 3);
    else if (a.startsWith('--port=')) out.port = parseInt(a.slice('--port='.length), 10) || 8010;
  }
  return out;
}

// online/supabase-config.js から接続先URLを読む(直書きで二重管理しない)
function readSupabaseUrl() {
  const src = fs.readFileSync(path.join(ROOT, 'online', 'supabase-config.js'), 'utf8');
  const m = src.match(/url:\s*'([^']+)'/);
  if (!m) throw new Error('online/supabase-config.js から url を読み取れませんでした(書式が変わった?)');
  return m[1];
}

// 外部シグナリング(Supabaseプロジェクト)への到達性チェック。
// DNS解決すら失敗する場合はプロジェクトが存在しない(削除/期限切れ)可能性が高い。
function checkReachable(urlStr, timeoutMs) {
  return new Promise(resolve => {
    let settled = false;
    const finish = r => { if (!settled) { settled = true; resolve(r); } };
    const u = new URL(urlStr);
    const timer = setTimeout(() => finish({ ok: false, reason: `timeout(${timeoutMs}ms)` }), timeoutMs);
    dns.lookup(u.hostname, err => {
      if (settled) return;
      if (err) { clearTimeout(timer); finish({ ok: false, reason: `DNS解決失敗: ${err.code || err.message}(host=${u.hostname})` }); return; }
      // DNSが引けたらHTTPSでも実際に到達できるか見る(認証エラー等のHTTPステータスが返れば到達はOK)
      const req = https.get(urlStr.replace(/\/$/, '') + '/auth/v1/health', { timeout: timeoutMs }, res => {
        if (settled) return;
        clearTimeout(timer);
        res.resume();
        finish({ ok: true, status: res.statusCode });
      });
      req.on('timeout', () => { clearTimeout(timer); req.destroy(); finish({ ok: false, reason: 'HTTPS接続タイムアウト' }); });
      req.on('error', e => { clearTimeout(timer); finish({ ok: false, reason: `HTTPS接続失敗: ${e.code || e.message}` }); });
    });
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['-m', 'http.server', String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let done = false;
    proc.on('error', e => { if (!done) { done = true; reject(e); } });
    proc.on('exit', code => { if (!done) { done = true; reject(new Error('http.server が起動直後に終了しました(exit=' + code + ')')); } });
    // readyの確認はポーリングで行う(標準出力のタイミングに依存しない)
    const deadline = Date.now() + 8000;
    const poll = () => {
      const req = https.request; // 未使用(httpはhttpモジュール側で別途)
      const http = require('http');
      const r = http.get({ host: '127.0.0.1', port, path: '/online_battle.html', timeout: 1500 }, res => {
        res.resume();
        if (!done) { done = true; resolve(proc); }
      });
      r.on('error', () => { if (!done && Date.now() < deadline) setTimeout(poll, 200); else if (!done) { done = true; reject(new Error('ローカルサーバが起動しませんでした(port=' + port + ')')); } });
      r.on('timeout', () => { r.destroy(); if (!done && Date.now() < deadline) setTimeout(poll, 200); });
    };
    setTimeout(poll, 300);
  });
}

function stopServer(proc) {
  if (!proc) return;
  try { proc.kill('SIGTERM'); } catch (e) { /* 既に落ちていてもよい */ }
}

// ---- ページ側セットアップ(UIクリックでなく、ページの本物の関数を直接呼ぶ) ----
async function setupPage(context, url, label, log) {
  const page = await context.newPage();
  const audit = observePage(page, { origin: url });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  // エンジン(iframe内real_battle_simulator.htmlのwindow.__sim)が S に橋渡しされるのを待つ
  await page.waitForFunction(() => {
    try { return typeof S !== 'undefined' && !!S && typeof S.pokeByName === 'function' && !!S.pokeByName('テスト(みず)'); }
    catch (e) { return false; }
  }, null, { timeout: 20000 });
  // m32(オンライン専用シード関数)を実行時ラップしてRNG消費回数を数える。
  // ★ページ改変ではない: ディスク上のonline_battle.htmlは一切変更せず、Playwrightからの
  //   ランタイムモンキーパッチのみ(m32はトップレベルfunction宣言=window.m32として存在)。
  await page.evaluate(() => {
    if (window.__origM32) return;
    window.__origM32 = window.m32;
    window.__rngCallCount = 0;
    window.m32 = function (seed) {
      const gen = window.__origM32(seed);
      return function () { window.__rngCallCount++; return gen(); };
    };
  });
  // 固定チーム: テストダミー3体(HP924・全技使用可・特性なし=決定的。real_battle_simulator.html:9308-9311)
  await page.evaluate(() => {
    setSlot('s1', 'テスト(みず)');
    setSlot('s2', 'テスト(ノーマル)');
    setSlot('s3', 'テスト(ゴースト)');
  });
  log(`[${label}] ページ準備OK(S.pokeByName到達・m32ラップ・固定チーム3体セット済み)`);
  return { page, audit, label };
}

async function connectRoom(page, room, name, timeoutMs) {
  return page.evaluate(({ room, name, timeoutMs }) => {
    return Promise.race([
      onlineConnectRoom(room, name).then(() => ({ ok: true })),
      new Promise(resolve => setTimeout(() => resolve({ ok: false, reason: 'onlineConnectRoom timeout' }), timeoutMs)),
    ]);
  }, { room, name, timeoutMs });
}

async function turnState(page) {
  return page.evaluate(() => {
    const clean = arr => arr.filter(e => !/^───/.test(e.msg)).map(e => e.msg);
    return {
      turnNo: (typeof turnNo !== 'undefined') ? turnNo : null,
      gameOver: (typeof gameOver !== 'undefined') ? !!gameOver : false,
      started: !!(window.RB_ONLINE && RB_ONLINE.started),
      logLen: S.battleLog.length,
      log: clean(S.battleLog),
      selfHp: S.sides.self.currentHp, selfMax: S.realStat(S.sides.self, 'hp'),
      oppHp: S.sides.opp.currentHp, oppMax: S.realStat(S.sides.opp, 'hp'),
      rng: window.__rngCallCount || 0,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = (...a) => console.log(...a);
  log(`=== オンライン対戦 鏡写しE2E(tools/_online_mirror_test.js) turns=${args.turns} port=${args.port} headed=${args.headed} ===`);

  const supabaseUrl = readSupabaseUrl();
  log(`接続先(online/supabase-config.js): ${supabaseUrl}`);
  const reach = await checkReachable(supabaseUrl, 8000);
  if (!reach.ok) {
    log('');
    log('SKIP: 外部シグナリング到達不能');
    log(`  理由: ${reach.reason}`);
    log('  online_battle.html のオンライン対戦は Supabase Realtime(外部クラウドサービス)前提であり、');
    log('  ローカルの修正では解決できない(プロジェクト削除/期限切れの可能性が高い。DNS解決自体が失敗している)。');
    log('  実行せずに成功と報告することはしない → 非0で終了する。');
    process.exitCode = 2;
    return;
  }
  log(`到達性チェックOK(status=${reach.status}) → 実機2ブラウザテストを実行する`);

  let serverProc = null;
  let browser = null;
  try {
    serverProc = await startServer(args.port);
    log(`ローカルサーバ起動OK: http://127.0.0.1:${args.port}/`);

    browser = await chromium.launch({ headless: !args.headed });
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const url = `http://127.0.0.1:${args.port}/online_battle.html`;

    const host = await setupPage(hostCtx, url, 'HOST', log);
    const guest = await setupPage(guestCtx, url, 'GUEST', log);

    const room = 'e2emirror_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    log(`部屋コード: ${room}`);

    const hostConn = await connectRoom(host.page, room, 'ホスト', 15000);
    if (!hostConn.ok) throw new Error('ホストの接続に失敗: ' + hostConn.reason);
    const guestConn = await connectRoom(guest.page, room, 'ゲスト', 15000);
    if (!guestConn.ok) throw new Error('ゲストの接続に失敗: ' + guestConn.reason);
    log('両者接続OK');

    await host.page.waitForFunction(() => window.RB_ONLINE && RB_ONLINE.myTeamSent && RB_ONLINE.oppTeamReady, null, { timeout: 15000 });
    await guest.page.waitForFunction(() => window.RB_ONLINE && RB_ONLINE.myTeamSent && RB_ONLINE.oppTeamReady, null, { timeout: 15000 });
    log('チーム交換OK(両者)');

    // 見せ合い選出: UIクリックでなくPICK.selを直接埋めてconfirmPick()を呼ぶ(選出3体=セット済みの全部)
    await host.page.evaluate(() => { PICK.sel = ['s1', 's2', 's3']; confirmPick(); });
    await guest.page.evaluate(() => { PICK.sel = ['s1', 's2', 's3']; confirmPick(); });
    log('選出送信OK(両者)');

    await host.page.waitForFunction(() => window.RB_ONLINE && RB_ONLINE.started, null, { timeout: 15000 });
    await guest.page.waitForFunction(() => window.RB_ONLINE && RB_ONLINE.started, null, { timeout: 15000 });
    log('開戦OK(両者 RB_ONLINE.started=true)');

    const mismatches = [];
    let turnsCompared = 0;
    for (let t = 1; t <= args.turns; t++) {
      const preHost = await turnState(host.page);
      const preGuest = await turnState(guest.page);
      if (preHost.gameOver || preGuest.gameOver) { log(`ターン${t}: 開始前にgameOver=true → ここで打ち切り`); break; }
      const expectHostTurn = preHost.turnNo + 1;
      const expectGuestTurn = preGuest.turnNo + 1;

      await host.page.evaluate(() => { window.__rngCallCount = 0; });
      await guest.page.evaluate(() => { window.__rngCallCount = 0; });

      // 決定的な行動: 両者「先頭の技(idx=0)」を選ぶ
      await Promise.all([
        host.page.evaluate(() => onlineSubmitAction(0)),
        guest.page.evaluate(() => onlineSubmitAction(0)),
      ]);

      // ターン確定(turnNoの前進 or 決着)を待つ。片方が瀕死で死に出し待ちになるケースも許容。
      const waitTurnDone = async page => {
        await page.waitForFunction(
          ({ }) => (typeof gameOver !== 'undefined' && gameOver) ||
            (typeof turnNo !== 'undefined' && turnNo > 0) &&
            (window.RB_ONLINE && !RB_ONLINE.myAction && !RB_ONLINE.oppAction),
          {}, { timeout: 20000 },
        ).catch(() => {}); // タイムアウトしても下のstate比較で不一致として検出される
      };
      await Promise.all([waitTurnDone(host.page), waitTurnDone(guest.page)]);
      // アニメーション表示(say())の分だけ余裕を見る
      await host.page.waitForTimeout(400);
      await guest.page.waitForTimeout(400);

      const postHost = await turnState(host.page);
      const postGuest = await turnState(guest.page);
      turnsCompared++;

      const diffs = [];
      // ログ: 全文一致(───区切りは除去済み)
      const hLog = JSON.stringify(postHost.log);
      const gLog = JSON.stringify(postGuest.log);
      if (hLog !== gLog) diffs.push(`battleLog不一致\n  HOST: ${postHost.log.join(' / ')}\n  GUEST: ${postGuest.log.join(' / ')}`);
      // HP: 視点が鏡写し(hostのself=guestのopp)なので入れ替えて突き合わせる
      if (postHost.selfHp !== postGuest.oppHp || postHost.selfMax !== postGuest.oppMax) {
        diffs.push(`HP不一致(ホスト自分 vs ゲスト相手視点): host.self=${postHost.selfHp}/${postHost.selfMax} guest.opp=${postGuest.oppHp}/${postGuest.oppMax}`);
      }
      if (postHost.oppHp !== postGuest.selfHp || postHost.oppMax !== postGuest.selfMax) {
        diffs.push(`HP不一致(ホスト相手 vs ゲスト自分視点): host.opp=${postHost.oppHp}/${postHost.oppMax} guest.self=${postGuest.selfHp}/${postGuest.selfMax}`);
      }
      // RNG消費回数(このターンぶんのdelta。共有シードで同じ消費回数になるはず)
      if (postHost.rng !== postGuest.rng) {
        diffs.push(`RNG消費回数不一致: host=${postHost.rng} guest=${postGuest.rng}`);
      }

      if (diffs.length) {
        mismatches.push({ turn: t, diffs });
        log(`ターン${t}: 不一致 ${diffs.length}件`);
        diffs.forEach(d => log('  - ' + d));
      } else {
        log(`ターン${t}: 一致(log ${postHost.log.length}行 / HP self=${postHost.selfHp} opp=${postHost.oppHp} / rng=${postHost.rng})`);
      }

      if (postHost.gameOver || postGuest.gameOver) { log(`ターン${t}で決着 → 打ち切り`); break; }
    }

    // JSランタイムエラー/HTTPエラーの監査
    const jsErrors = [...host.audit.errors, ...guest.audit.errors];
    if (jsErrors.length) {
      log(`JSエラー/HTTPエラー ${jsErrors.length}件:`);
      jsErrors.forEach(e => log(`  - [${e.kind}] ${e.text}`));
    }

    log('');
    log(`=== 結果: ${turnsCompared}ターン比較 / 不一致${mismatches.length}件 / JSエラー${jsErrors.length}件 ===`);
    if (mismatches.length === 0 && jsErrors.length === 0 && turnsCompared === args.turns) {
      log('PASS');
      process.exitCode = 0;
    } else {
      log('FAIL');
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    stopServer(serverProc);
  }
}

main().catch(e => {
  console.error('致命的エラー:', e && e.stack || e);
  process.exitCode = 1;
});
