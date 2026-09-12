#!/usr/bin/env node
'use strict';
/*
 * tools/_doubles_fuzz_playwright.js — ダブルバトル ランダム自走ファズ(ページ版・実機Playwright・補助)
 *
 * 実行:
 *   node tools/_doubles_fuzz_playwright.js                      (既定 --n=10)
 *   node tools/_doubles_fuzz_playwright.js --n=10 --seed=1 --port=8000
 *   node tools/_doubles_fuzz_playwright.js --n=1 --headed --maxTurns=60   (目で見る)
 *
 * 何をするか:
 *   online_battle.html?format=double の ★AI戦★ を、本物のDOMクリック(技カプセル/対象板/交代画面/
 *   メガシンカ/死に出し)で最後まで回す。エンジン直叩き版(tools/_doubles_fuzz_engine.js)が見られない
 *   「ページ側の固まり」=タイマー・メッセージ送り・選択UIの詰まりを実機で捕まえるのが役目。
 *
 * 合否(この検証が見るもの):
 *   P1 jserror     JSエラー(pageerror/console error)が0 / http404 素材の取りこぼしが0(別枠で数える)
 *   P2 timer       行動UI(技メニュー/対象板/交代画面)が開いている間、45秒タイマーが動いている(RB_ACT.t)
 *   P3 progress    ターンが進む(同じターンで一定回数以上待たされたら「固まり」として記録)
 *   P4 finish      勝敗バナー(#result-banner.show)が出て終わる(maxTurns以内)
 *   P5 board       ダブルの盤面が2枠ある(枠1の要素 f-self-1 / f-opp-1 が存在する)
 *
 * ★このハーネスは読むだけ(online_battle.html / real_battle_simulator.html を1行も直さない)。
 *   見つけた破れは直さず報告する。
 *
 * 流儀(tools/_online_doubles_loopback_playwright.js と同じ):
 *   ・ローカルサーバ(python3 -m http.server)が無ければ立てる
 *   ・編成/選出の「入口」だけはページの関数を呼ぶ(randomize / lobbyVsAi / #pick-ok)。
 *     ★バトル中の行動は必ず本物のクリック(ここがファズの本体)。
 *   ・自動メッセージ送りON+最速にして1戦を現実的な時間に収める。
 *   ・45秒タイマーは「動いているか」を見る(P2)。一方で、ハーネスの待ちで本当に45秒切れると
 *     時間切れの自動選択に乗っ取られてランダム操作にならないので、メニューを見つけるたび left を戻す
 *     (tools/_online_doubles_loopback_playwright.js の keepTimer と同じ理由・同じ手口)。
 */
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { observePage } = require('./_lib/browser_audit');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const o = { n: 10, seed: 1, port: 8000, maxTurns: 60, headed: false, battleMs: 150000 };
  argv.slice(2).forEach(a => {
    let m;
    if ((m = /^--n=(\d+)$/.exec(a))) o.n = +m[1];
    else if ((m = /^--seed=(\d+)$/.exec(a))) o.seed = +m[1];
    else if ((m = /^--port=(\d+)$/.exec(a))) o.port = +m[1];
    else if ((m = /^--maxTurns=(\d+)$/.exec(a))) o.maxTurns = +m[1];
    else if ((m = /^--battleMs=(\d+)$/.exec(a))) o.battleMs = +m[1];
    else if (a === '--headed') o.headed = true;
  });
  return o;
}
// 決定論PRNG(engine版と同じ mulberry32)。--seed で操作列を再現できる。
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function probe(port) {
  return new Promise(resolve => {
    const r = http.get({ host: '127.0.0.1', port, path: '/online_battle.html', timeout: 2000 }, res => { res.resume(); resolve(true); });
    r.on('error', () => resolve(false));
    r.on('timeout', () => { r.destroy(); resolve(false); });
  });
}
async function ensureServer(port, log) {
  if (await probe(port)) { log(`ローカルサーバ: すでに動いている(http://127.0.0.1:${port}/)`); return null; }
  const proc = spawn('python3', ['-m', 'http.server', String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (await probe(port)) { log(`ローカルサーバ起動: http://127.0.0.1:${port}/`); return proc; }
  }
  try { proc.kill('SIGTERM'); } catch (e) {}
  throw new Error('ローカルサーバが起動しませんでした(port=' + port + ')');
}

// ---- ページ操作の部品 ----
const waitSim = page => page.waitForFunction(() => {
  try { return typeof S !== 'undefined' && !!S && typeof S.pokeList === 'function' && S.pokeList().length > 0; } catch (e) { return false; }
}, null, { timeout: 30000 });

// 自動メッセージ送りON+最速(1戦を現実的な時間に収める)
const fastMsg = page => page.evaluate(() => {
  const a = document.getElementById('auto-msg'); if (a) a.checked = true;
  const s = document.getElementById('msg-speed');
  if (s) { const o = document.createElement('option'); o.value = '500'; s.appendChild(o); s.value = '500'; }
});
const keepTimer = page => page.evaluate(() => { if (typeof RB_ACT !== 'undefined') RB_ACT.left = 45; });

// いまの画面の状態(どのUIが開いているか・ターン・勝敗・タイマー)
const snap = page => page.evaluate(() => {
  const vis = id => { const e = document.getElementById(id); return !!e && e.style.display !== 'none' && e.offsetParent !== null; };
  const rb = document.getElementById('result-banner');
  const tb = document.getElementById('target-board');
  return {
    turn: (typeof turnNo !== 'undefined') ? turnNo : null,
    over: (typeof gameOver !== 'undefined') ? !!gameOver : false,
    banner: !!(rb && (rb.className || '').includes('show')),
    moves: vis('moves') && !!document.querySelector('#moves button.tcol:not([disabled])'),
    party: vis('party') && !!document.querySelector('#party .sw-mine .slot[data-i]:not([disabled]):not(.taken):not(.sw-ghost):not(.active):not(.dead)'),
    board: !!(tb && (tb.className || '').includes('show')),
    busy: (typeof busy !== 'undefined') ? !!busy : false,
    timer: (typeof RB_ACT !== 'undefined') ? !!RB_ACT.t : null,
    slot1: !!document.getElementById('f-self-1') && !!document.getElementById('f-opp-1'),
    canMega: !!document.querySelector('#moves .mega-side'),
    logLen: (typeof S !== 'undefined' && S.battleLog) ? S.battleLog.length : 0,
    // ★進捗の signal: メッセージ送りの最中は battleLog が伸びない(ログは行動時に一度に書かれ、
    //   メッセージはそれを再生するだけ)。msgbox の文字が変わっているかも見ないと「再生中」を
    //   「固まり」と誤判定する(実測: 6ターンの試合で17回も誤って手押しした)。
    msgLen: (() => { const e = document.getElementById('msg-lines'); return e ? e.textContent.length : 0; })(),
  };
});

// クリック: セレクタに合う「有効な要素」からr番目(0..1の乱数で決める)を押す。押せたらtrue
async function clickRandom(page, selector, r) {
  return page.evaluate(({ sel, r }) => {
    const list = [...document.querySelectorAll(sel)].filter(e => !e.disabled);
    if (!list.length) return false;
    list[Math.floor(r * list.length)].click();
    return true;
  }, { sel: selector, r });
}

async function runOne(browser, url, seed, opts, out) {
  const rng = mulberry32(seed);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  // ★既知の環境ノイズ(ページのバグではない)= Supabase Realtime。このプロジェクトのURLは現在 DNS解決
  //   できない(tools/_online_doubles_loopback_playwright.js 冒頭に記録済みの事実)。オンライン対戦の
  //   ロビー購読が必ず失敗するので、supabase 宛の通信/コンソールだけ除外する。それ以外は全部拾う。
  const isSupabase = u => /supabase\.co/.test(String(u || ''));
  const obs = observePage(page, {
    origin: url, checkConsole: true,
    ignoreResponse: r => { try { return isSupabase(r.url()); } catch (e) { return false; } },
  });
  const keepErr = er => !(er.kind === 'console' && isSupabase(er.text));
  const res = { seed, turns: 0, finished: false, violations: [], log: [], nudges: 0 };
  const note = (kind, detail) => res.violations.push({ kind, detail });
  try {
    // ★再現性: ページ内の Math.random(編成の抽選・AIの選択・命中/乱数ダメージ)も seed で固定する。
    //   これが無いと --seed はクリック順だけを決め、同じ seed でも毎回ちがう試合になる(実測)。
    //   ページのファイルは触らない(addInitScript=実行時の差し替え)。
    await page.addInitScript(s => {
      let a = s >>> 0;
      Math.random = function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }, (seed * 2654435761) >>> 0);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitSim(page);
    await fastMsg(page);
    // 編成=おまかせ(ページの抽選をそのまま使う=ページが出せない編成を作らない)
    await page.evaluate(() => { if (window.__randomizeAll) window.__randomizeAll(); });
    // AI戦の入口(見せ合い選出 → pickCount=4体)
    await page.evaluate(() => { lobbyVsAi(); });
    await page.waitForSelector('#pick-screen', { timeout: 15000 });
    // 選出: 自分の6体から pickCount 体をランダムに選ぶ(セルを本物のクリックで)
    const picked = await page.evaluate(r => {
      const cells = [...document.querySelectorAll('#pick-mine .slot')];
      const order = cells.map((c, i) => ({ c, k: (Math.sin((i + 1) * r * 9301) + 1) / 2 })).sort((a, b) => a.k - b.k);
      let n = 0;
      for (const o of order) { if (n >= FORMAT.pickCount) break; o.c.click(); n = PICK.sel.length; }
      return PICK.sel.length;
    }, rng());
    if (picked !== 4) note('pick', `選出が4体にならなかった(実際=${picked})`);
    await page.click('#pick-ok');
    await page.waitForSelector('#battle', { state: 'visible', timeout: 15000 });

    // P5: ダブルの盤面(枠1)が出ている
    let s = await snap(page);
    if (!s.slot1) note('board', 'ダブルなのに枠1の盤面要素(f-self-1 / f-opp-1)が無い');

    let stuck = 0, lastTurn = -1, lastLogLen = -1, lastMsgLen = -1, steps = 0;
    const MAX_STEPS = opts.maxTurns * 14;
    const deadline = Date.now() + opts.battleMs;   // 1戦の上限(これを越えたら打ち切って記録=無限待ちを作らない)
    while (steps++ < MAX_STEPS) {
      if (Date.now() > deadline) { note('timeout', `1戦が ${Math.round(opts.battleMs / 1000)} 秒を越えた(turn=${lastTurn})`); break; }
      s = await snap(page);
      if (s.banner || s.over) { res.finished = true; break; }
      res.turns = s.turn || res.turns;
      // 進捗の番人(P3): ターンもログも伸びない状態が続いたら固まり
      if (s.turn === lastTurn && s.logLen === lastLogLen && s.msgLen === lastMsgLen) stuck++; else stuck = 0;
      lastTurn = s.turn; lastLogLen = s.logLen; lastMsgLen = s.msgLen;
      if (stuck > 80) {
        // 固まりの材料をできるだけ集めて残す(メッセージ送りチェーン/死に出しの待ち/枠の生死)
        const diag = await page.evaluate(() => {
          const slot = (sd, i) => { const x = S.slotOf(sd, i); return x && x.poke ? `${x.poke.name}${x.fainted ? '(ひんし)' : ''} ${x.currentHp}` : '空席'; };
          const bench = sd => (S.sides[sd].bench || []).map(e => e && e.poke ? `${e.poke.name}${e.fainted ? '(ひんし)' : ''}` : '-').join(',');
          return {
            sayQueue: (typeof sayQueue !== 'undefined') ? sayQueue.length : null,
            busy: (typeof busy !== 'undefined') ? !!busy : null,
            autoTimer: (typeof autoTimer !== 'undefined') ? !!autoTimer : null,
            swForced: (typeof swForced !== 'undefined') ? !!swForced : null,
            swPivot: (typeof swPivot !== 'undefined') ? !!swPivot : null,
            gameOver: (typeof gameOver !== 'undefined') ? !!gameOver : null,
            self: [slot('self', 0), slot('self', 1)], opp: [slot('opp', 0), slot('opp', 1)],
            benchSelf: bench('self'), benchOpp: bench('opp'),
            msgboxShown: (() => { const m = document.getElementById('msgbox'); return !!m && m.style.display !== 'none'; })(),
          };
        }).catch(() => null);
        note('stuck', `ターン${s.turn}でログが伸びないまま固まった(UI: moves=${s.moves} party=${s.party} board=${s.board} busy=${s.busy} timer=${s.timer}) 状態=${JSON.stringify(diag)}`);
        break;
      }

      if (s.board) {
        if (s.timer !== true) note('timer', `対象板が開いているのに45秒タイマーが止まっている(turn=${s.turn})`);
        await keepTimer(page);
        if (!await clickRandom(page, '#target-board .tb-slot[data-side]', rng())) {
          await clickRandom(page, '#target-board .tb-close', 0);
        }
        await page.waitForTimeout(120);
        continue;
      }
      if (s.moves) {
        if (s.timer !== true) note('timer', `技メニューが開いているのに45秒タイマーが止まっている(turn=${s.turn})`);
        await keepTimer(page);
        // メガシンカ(出ている時だけ・35%)
        if (s.canMega && rng() < 0.35) { await clickRandom(page, '#moves .mega-side', 0); await page.waitForTimeout(80); }
        // 交代(12%)= 技メニューの「🔄 ポケモン」から交代画面へ
        if (rng() < 0.12) {
          await clickRandom(page, '#moves .party-open', 0);
          await page.waitForTimeout(150);
          const s2 = await snap(page);
          if (s2.party) {
            await clickRandom(page, '#party .sw-mine .slot[data-i]:not(.taken):not(.sw-ghost):not(.active):not(.dead)', rng());
            await page.waitForTimeout(150);
            // 行の下に出る「交代する」の確認(出ない場合は素通り)
            await clickRandom(page, '#party .sw-confirm .sw-yes', 0);   // 「交代する」(markup=online_battle.html:4163)
            await page.waitForTimeout(150);
            continue;
          }
          // 交代画面が出なければ技選択に戻す
          await clickRandom(page, '#party .sw-back', 0);
          await page.waitForTimeout(120);
          continue;
        }
        await clickRandom(page, '#moves button.tcol', rng());
        await page.waitForTimeout(150);
        continue;
      }
      if (s.party) {
        // 死に出し/強制交代。タイマーは交代画面でも動いているのが正(P2)
        if (s.timer !== true) note('timer', `交代画面が開いているのに45秒タイマーが止まっている(turn=${s.turn})`);
        await keepTimer(page);
        await clickRandom(page, '#party .sw-mine .slot[data-i]:not(.taken):not(.sw-ghost):not(.active):not(.dead)', rng());
        await page.waitForTimeout(150);
        await clickRandom(page, '#party .sw-confirm .sw-yes', 0);   // 「交代する」(死に出しは sw-back が無い=強制)
        await page.waitForTimeout(200);
        continue;
      }
      // メッセージ送り中などの待ち。★自動送りONでも「1コマで止まる」ことがある(既知:
      // tools/_online_doubles_loopback_playwright.js の waitMoves が同じ現象に同じ対処をしている=
      // 実機ではプレイヤーが画面をタップして進める操作)。何も開いていないまま止まったら
      // #field を1回だけ人間のように押して進める。回数は数えて報告する(止まりやすさの指標)。
      if (stuck > 0 && stuck % 25 === 0) {
        res.nudges++;
        await page.evaluate(() => { const f = document.getElementById('field'); if (f) f.click(); });
        await page.waitForTimeout(300);
        continue;
      }
      await page.waitForTimeout(180);
    }
    if (!res.finished) {
      if (!res.violations.some(v => v.kind === 'stuck')) note('finish', `${opts.maxTurns}ターン相当の操作で決着しなかった(turn=${res.turns})`);
    }
    // 直近のログを再現材料として持つ
    res.log = await page.evaluate(() => (typeof S !== 'undefined' && S.battleLog)
      ? S.battleLog.slice(-14).map(e => String(e.msg)) : []);
  } catch (e) {
    note('exception', String(e && e.message || e));
  }
  // P1: JSエラー。★読めるように分ける: 実行時エラー(jserror)と 素材の404(http404)は別の話
  //   (404は画像/音の取りこぼし=onerrorで見た目は繕われるが、真のJSエラーを埋もれさせるので別枠)。
  //   同じ文は1回だけ数える(同じ素材を何度も描くので同文が何十行も出る)。
  const seen = new Set();
  obs.errors.filter(keepErr).forEach(er => {
    const kind = (er.kind === 'http' || er.kind === 'network') ? 'http404' : 'jserror';
    const text = `${er.kind}: ${er.text}`;
    if (seen.has(text)) return;
    seen.add(text);
    note(kind, text);
  });
  obs.dispose();
  await ctx.close();
  return res;
}

async function main() {
  const o = parseArgs(process.argv);
  const log = (...a) => console.log(...a);
  log(`[doubles-fuzz/page] n=${o.n} seed=${o.seed} port=${o.port} maxTurns=${o.maxTurns}`);
  const server = await ensureServer(o.port, log);
  const url = `http://127.0.0.1:${o.port}/online_battle.html?format=double`;
  const browser = await chromium.launch({ headless: !o.headed });
  const byKind = {};
  const bad = [];
  let finished = 0, nudges = 0;
  const t0 = Date.now();
  try {
    for (let i = 0; i < o.n; i++) {
      const seed = o.seed + i;
      const r = await runOne(browser, url, seed, o, log);
      if (r.finished) finished++;
      nudges += r.nudges;
      log(`  #${i + 1}/${o.n} seed=${seed} turns=${r.turns} 決着=${r.finished ? 'はい' : 'いいえ'} 破れ=${r.violations.length} メッセージ送りの手押し=${r.nudges}回`);
      if (r.violations.length) {
        bad.push(r);
        r.violations.forEach(v => { byKind[v.kind] = (byKind[v.kind] || 0) + 1; });
      }
    }
  } finally {
    await browser.close();
    if (server) { try { server.kill('SIGTERM'); } catch (e) {} }
  }
  log(`\n=== 結果(ページ版) ===`);
  log(`実行: ${o.n}戦 / 決着 ${finished}戦 / ${Math.round((Date.now() - t0) / 1000)}秒 / メッセージ送りの手押し 合計${nudges}回`);
  const kinds = Object.keys(byKind);
  if (!kinds.length) { log('破れ 0件 ✅'); return; }
  log('破れの内訳: ' + kinds.map(k => `${k}=${byKind[k]}`).join(' / '));
  bad.forEach(r => {
    log(`\n--- seed=${r.seed} (turns=${r.turns}) ---`);
    r.violations.forEach(v => log(`  [${v.kind}] ${v.detail}`));
    r.log.forEach(L => log('   | ' + L));
    log(`再現: node tools/_doubles_fuzz_playwright.js --n=1 --seed=${r.seed} --headed`);
  });
  process.exitCode = 1;
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
