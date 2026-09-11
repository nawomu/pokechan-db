#!/usr/bin/env node
'use strict';
// ダブルのオンライン対戦(ロックステップ)ループバック検証 — D6-5(2026-09-11・spec_d6_5_lockstep.md d)
//
// 使い方: node tools/_online_doubles_loopback_playwright.js [--port=8000] [--turns=12] [--headed] [--only=double|single]
//
// ★なぜ「ループバック」か(事実):
//   本番の通信は Supabase Realtime(online/rb_online.js)。そのプロジェクトは現在 DNS解決すら
//   できない=実サーバでの2ブラウザ検証はできない(tools/_online_mirror_test.js が SKIP で止まる)。
//   そこで **同じ context に A/B の2ページを開き、window.RBOnline を BroadcastChannel ベースの
//   スタブに差し替える**(page.addInitScript=ページのファイルは1文字も変えない)。
//   スタブは online/rb_online.js が公開している関数群と同じシグネチャ・同じメッセージ型
//   (team/action/turnGo/start/ready/pick/faintReplace/resign/ping)を実装する。
//   → ロックステップの中身(行動の送受信・共有シード・死に出しの往復・鏡写し)は本番と同じ経路を通る。
//
// ★合否(このテストが見るもの):
//   ① A と B の battleLog が「相手の 」接頭の入れ替えを除いて**完全一致**(鏡写し)
//      = A のログを「B の視点」へ機械変換(自分の6体に接頭を付け/相手の6体から外す)して全文比較。
//   ② 4枠+控えの HP/ひんし が鏡写しで一致(A.self[i] == B.opp[i])
//   ③ 共有シードの乱数消費回数が一致(m32 を実行時ラップして計測)
//   ④ 送った payload の形: double = {fmt:'double', slots:[…]} / single = {kind,idx,mega,pivotIdx}(不変)
//   ⑤ JSエラー0
//
// 変更禁止(このテストは読むだけ): online_battle.html / real_battle_simulator.html / online/rb_online.js

const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { observePage } = require('./_lib/browser_audit');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { port: 8000, turns: 12, headed: false, only: 'both' };
  for (const a of argv) {
    if (a === '--headed') out.headed = true;
    else if (a.startsWith('--port=')) out.port = parseInt(a.slice(7), 10) || 8000;
    else if (a.startsWith('--turns=')) out.turns = Math.max(1, parseInt(a.slice(8), 10) || 12);
    else if (a.startsWith('--only=')) out.only = a.slice(7);
  }
  return out;
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

// ===================================================================
// ページへ注入する RBOnline スタブ(BroadcastChannel)。
// online/rb_online.js:324-347 の公開APIと同じ名前/引数/戻り値、handleMessage(:150-184)と同じ型で配る。
// ===================================================================
function rbOnlineStub(role) {
  const hooks = () => window.RBHooks || {};
  const st = { role: role, connected: false, roomCode: null, myId: null, peerPresent: false, peerId: null, name: null };
  let ch = null;
  window.__LB = { sent: [], recv: [] };

  function raw(o) { if (ch) ch.postMessage(o); }
  function send(type, data) {
    const payload = Object.assign({ type: type, from: st.myId }, data || {});
    try { window.__LB.sent.push(JSON.parse(JSON.stringify(payload))); } catch (e) { window.__LB.sent.push({ type: type }); }
    raw(payload);
  }
  function handle(m) {
    const h = hooks();
    switch (m.type) {
      case 'team': try { (h.applyOpponentTeam || function () {})(m.payload); } catch (e) {} break;
      case 'action': try { (h.onOpponentAction || function () {})(m.action); } catch (e) {} break;
      case 'turnGo': try { (h.onTurnGo || function () {})(m.action, m.seed, m.turn); } catch (e) {} break;
      case 'start': try { (h.onStart || function () {})(m.seed); } catch (e) {} break;
      case 'ready': try { (h.onPeerReady || function () {})(); } catch (e) {} break;
      case 'pick': try { (h.onPeerPick || function () {})(m.order); } catch (e) {} break;
      case 'turnResult': try { (h.playTurnResult || function () {})(m.log); } catch (e) {} break;
      case 'faintReplace': try { (h.onFaintReplace || function () {})(m.benchIdx, m.seed); } catch (e) {} break;
      case 'resign': try { (h.onResign || function () {})(); } catch (e) {} break;
      case 'ping': send('pong', {}); break;
    }
  }
  function connect(roomCode, displayName) {
    st.roomCode = String(roomCode || '');
    st.myId = role + '_' + Math.random().toString(36).slice(2, 8);
    st.name = String(displayName || 'Player').slice(0, 10);
    ch = new BroadcastChannel('pcham_loopback:' + st.roomCode);
    ch.onmessage = ev => {
      const m = ev.data || {};
      if (!m || m.from === st.myId) return;
      if (m.type === '__join' || m.type === '__here') {
        const had = st.peerPresent;
        st.peerPresent = true; st.peerId = m.from;
        if (m.type === '__join') raw({ type: '__here', from: st.myId, name: st.name });
        if (!had) { try { (hooks().onPeerJoined || function () {})(st.role, m.name); } catch (e) {} }
        return;
      }
      window.__LB.recv.push({ type: m.type });
      handle(m);
    };
    st.connected = true;
    raw({ type: '__join', from: st.myId, name: st.name });
    return Promise.resolve({ role: st.role });
  }
  function disconnect() { try { if (ch) ch.close(); } catch (e) {} ch = null; st.connected = false; st.peerPresent = false; }

  window.RBOnline = {
    connect: connect,
    disconnect: disconnect,
    sendTeam: function () { const h = hooks(); send('team', { payload: (h.getTeamPayload || function () { return null; })() }); },
    sendAction: function (action) { send('action', { action: action }); },
    sendTurnGo: function (action, seed, turn) { send('turnGo', { action: action, seed: seed, turn: turn }); },
    sendStart: function (seed) { send('start', { seed: seed }); },
    sendReady: function () { send('ready', {}); },
    sendPick: function (order) { send('pick', { order: order }); },
    sendTurnResult: function (logDiff) { send('turnResult', { log: logDiff }); },
    sendFaintReplace: function (benchIdx, seed) { send('faintReplace', { benchIdx: benchIdx, seed: seed }); },
    resign: function () { send('resign', {}); },
    ping: function () { send('ping', {}); },
    lobbyJoin: function () { return Promise.resolve(); },
    lobbyTrack: function () { return Promise.resolve(); },
    lobbySet: function () {},
    lobbyLeave: function () {},
    isNameNg: function () { return false; },
    get lobbyState() { return null; },
    get role() { return st.role; },
    get connected() { return st.connected; },
    get peerPresent() { return st.peerPresent; },
    get roomCode() { return st.roomCode; },
  };
}

// ---- ページ操作の部品 ----
const waitSim = page => page.waitForFunction(() => {
  try { return typeof S !== 'undefined' && !!S && typeof S.pokeList === 'function' && S.pokeList().length > 0; } catch (e) { return false; }
}, null, { timeout: 30000 });

const fastMsg = page => page.evaluate(() => {
  const a = document.getElementById('auto-msg'); if (a) a.checked = true;
  const s = document.getElementById('msg-speed');
  if (s) { const o = document.createElement('option'); o.value = '600'; s.appendChild(o); s.value = '600'; }
});

// m32(共有シード)をラップして乱数消費回数を数える(ページ改変ではなく実行時パッチ)
const wrapRng = page => page.evaluate(() => {
  if (window.__origM32) return;
  window.__origM32 = window.m32;
  window.__rng = 0;
  window.m32 = function (seed) { const g = window.__origM32(seed); return function () { window.__rng++; return g(); }; };
});

const waitIdle = (page, ms) => page.waitForFunction(() => {
  const mv = document.getElementById('moves'), pt = document.getElementById('party'), rb = document.getElementById('result-banner');
  return (mv && mv.style.display !== 'none') || (pt && pt.style.display !== 'none') || (rb && (rb.className || '').includes('show'));
}, null, { timeout: ms || 40000 }).catch(() => {});

const waitMovesOnce = (page, ms) => page.waitForFunction(() => {
  const mv = document.getElementById('moves');
  return mv && mv.style.display !== 'none' && mv.querySelector('button.tcol:not([disabled])');
}, null, { timeout: ms || 40000 });
// 技メニューを待つ。出ないまま止まったら「メッセージ送り」を1回だけ人間のように押して待ち直す
// (開幕の演出が1コマで止まる瞬間が稀にある=実測1/5回。実機では画面タップで進む操作なので同じことをする)
async function waitMoves(page, ms) {
  for (let i = 0; i < 3; i++) {
    try { await waitMovesOnce(page, i === 0 ? (ms || 25000) : 20000); return; }
    catch (e) {
      if (i === 2) throw e;
      await page.evaluate(() => { const f = document.getElementById('field'); if (f) f.click(); });
      await page.waitForTimeout(400);
    }
  }
}

const waitParty = (page, ms) => page.waitForFunction(() => {
  const pt = document.getElementById('party');
  return pt && pt.style.display !== 'none' && pt.querySelector('.sw-mine .slot[data-i]:not([disabled])');
}, null, { timeout: ms || 40000 });

// 盤面の全状態(鏡写し比較の材料)
const snap = page => page.evaluate(() => {
  const slotInfo = (side, i) => {
    const s = S.slotOf(side, i);
    if (!s || !s.poke) return null;
    return { name: s.poke.name, hp: s.currentHp, max: S.realStat(s, 'hp'), fainted: !!s.fainted, status: s.status || 'none' };
  };
  const bench = side => (S.sides[side].bench || []).map(e => e && e.poke
    ? { name: e.poke.name, hp: e.currentHp, fainted: !!e.fainted } : null);
  return {
    turn: (typeof turnNo !== 'undefined') ? turnNo : null,
    over: (typeof gameOver !== 'undefined') ? !!gameOver : false,
    started: !!(window.RB_ONLINE && RB_ONLINE.started),
    log: S.battleLog.filter(e => !/^───/.test(e.msg)).map(e => e.msg),
    self: [0, 1].map(i => slotInfo('self', i)),
    opp: [0, 1].map(i => slotInfo('opp', i)),
    benchSelf: bench('self'), benchOpp: bench('opp'),
    rng: window.__rng || 0,
    myAction: (window.RB_ONLINE && RB_ONLINE.myAction) || null,
    act: { left: RB_ACT.left, turn: RB_ACT.turn, running: !!RB_ACT.t },
    // ★いま場/控えに居る「表示名」を全部集める(メガシンカ等で名前が変わるので鏡写し変換の辞書に足す)
    nameSelf: [0, 1].map(i => S.slotOf('self', i)).concat(S.sides.self.bench || [])
      .map(e => e && e.poke && e.poke.name).filter(Boolean),
    nameOpp: [0, 1].map(i => S.slotOf('opp', i)).concat(S.sides.opp.bench || [])
      .map(e => e && e.poke && e.poke.name).filter(Boolean),
  };
});

// ★COMMANDタイマー(45秒)を巻き戻す。
// このテストは「プレイヤーが自分で選ぶ経路」を検証する。ところがメッセージ送り(600ms/行)+待ちで
// 1ターンが十数秒かかるため、放っておくと本物の45秒が切れて**時間切れの自動選択**(online_battle.html
// :5721 actTimerStart の timeout → doSwitchTo)が先に走り、交代画面のクリックを奪ってしまう
// (実測: 死に出しのターンで RB_ACT.left=0 → 自動で控え先頭が出た。両者の鏡写しは保たれていた=
//  時間切れ経路もロックステップとして正しく動く、という別の収穫)。
// 時間切れ自体の仕様は変えないので、テスト側で残り時間を戻して「人が選ぶ」方を通す。
const keepTimer = page => page.evaluate(() => { if (typeof RB_ACT !== 'undefined') RB_ACT.left = 45; });

// 全枠のHPを満タンに戻す(お膳立て)。A/B の**両ページで同じ個体に同じ値**を書くので鏡写しは崩れない。
// 4体しか居ないダブルは普通に殴り合うと3〜4ターンで控えが尽きる=交代/メガ/死に出しを順番に通せない。
// 「毎ターンの比較(ダメージが鏡写しか)」はこの回復の**前**に済ませているので検証の強さは落ちない。
const topUp = page => page.evaluate(() => {
  ['self', 'opp'].forEach(sd => [0, 1].forEach(i => {
    const s = S.slotOf(sd, i);
    if (s && s.poke && !s.fainted) s.currentHp = S.realStat(s, 'hp');
  }));
});

const names6 = page => page.evaluate(() => ({
  self: selfIds().map(id => slotVal[id]).filter(Boolean),
  opp: oppIds().map(id => slotVal[id]).filter(Boolean),
}));

// ---- ログの鏡写し変換(A の行 → B の視点) ----
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function toPeerView(line, myNames, theirNames) {
  // 置換済みの名前は「印つきの番号(日本語を含まないトークン)」に退避する。
  // ★これが無いと「メガフシギバナ」を置換したあと、その中の「フシギバナ」に2回目の置換が刺さる
  //   (=『メガ相手の フシギバナ』という嘘の行ができる)。トークンには日本語が無いので二度刺さらない。
  const toks = [];
  const put = text => { toks.push(text); return '' + (toks.length - 1) + ''; };
  const byLen = a => [...new Set(a)].sort((x, y) => y.length - x.length);   // 長い名前から(部分一致対策)
  let s = line;
  // ⓪ シングル限定の「先攻: 」行だけは側の言い方が **じぶんの / 相手の** の対で書かれている
  //    (real_battle_simulator.html:8201-8203 = 自分側だけ『じぶんの 』を足す・相手側は pname の『相手の 』)。
  //    ここは接頭を足すのでなく**入れ替える**(足すと『じぶんの 相手の ◯◯』になる)。
  byLen(theirNames).forEach(n => { s = s.split('先攻: 相手の ' + n).join(put('先攻: じぶんの ' + n)); });
  byLen(myNames).forEach(n => { s = s.split('先攻: じぶんの ' + n).join(put('先攻: 相手の ' + n)); });
  // ★名前の直後は「空白・記号・助詞」でなければならない(語の途中に刺さない)。
  //   例: 持ち物『フシギバナイト』の中の『フシギバナ』に刺さると『相手の フシギバナイト』という嘘ができる。
  const AFTER = '(?=[\\s！？、。()（）]|は|が|の|に|を|へ|と|も|や|$)';
  // ① 受け手から見ると「自分」になる側(= A の相手)= 「相手の 」を外す
  byLen(theirNames).forEach(n => { s = s.replace(new RegExp('相手の ' + esc(n) + AFTER, 'g'), () => put(n)); });
  // ② 受け手から見ると「相手」になる側(= A の自分)= 「相手の 」を付ける
  byLen(myNames).forEach(n => { s = s.replace(new RegExp(esc(n) + AFTER, 'g'), () => put('相手の ' + n)); });
  return s.replace(/(\d+)/g, (_, i) => toks[+i]);
}

// ===================================================================
// 1試合ぶんの駆動
// ===================================================================
function mkLogger() {
  const lines = [];
  const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
  return { log, lines };
}

async function openPair(browser, url, role2, prep, log) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const pages = [];
  for (const spec of role2) {
    const page = await context.newPage();
    const audit = observePage(page, { origin: url });
    await page.addInitScript(rbOnlineStub, spec.role);
    const res = await page.goto(url + spec.query, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!res || !res.ok()) throw new Error(`${spec.label}: document HTTP ${res ? res.status() : 'none'}`);
    await waitSim(page);
    await fastMsg(page);
    await wrapRng(page);
    await prep(page, spec);
    pages.push({ page, audit, label: spec.label, role: spec.role });
    log(`[${spec.label}] 準備OK(role=${spec.role} ${spec.query || '(single)'})`);
  }
  return { context, pages };
}

// 固定チームを作る: pool を共通手順で並べ、A は前半/B は後半を取る(=両者で種が重ならない)
const setTeam = (page, offset, fmt) => page.evaluate(({ offset, fmt }) => {
  if (fmt === 'double') { formatApply('double'); }
  const BAD = new Set(['ふゆう', 'ばけのかわ', 'ふしぎなまもり', 'マルチスケイル', 'がんじょう', 'テレパシー',
    'イリュージョン', 'かわりもの', 'へんしょく', 'きけんよち', 'トレース', 'ダウンロード', 'じょうねつのしずく']);
  const okMon = p => isPickable(p) && p.type1 !== 'ひこう' && p.type2 !== 'ひこう'
    && ![p.ab1, p.ab2, p.ab3].some(a => a && BAD.has(a));
  const pool = S.pokeList().filter(okMon);
  // 先頭=じしん(範囲技)を覚える子 / 2番目=1体選択の普通の技を持つ子
  const plain = m => m && m.target === '1体選択' && m.category !== '変化' && typeof m.power === 'number'
    && m.power >= 40 && m.power <= 90
    && !(m.battle_data && (m.battle_data.charge || m.battle_data.recharge || m.battle_data.self_faint
      || (m.battle_data.requires && m.battle_data.requires.length)));
  const withEq = [], withPlain = [];
  for (const p of pool) {
    let ms = null;
    try { ms = S.usableMoves(p); } catch (e) { continue; }
    if (!ms || !ms.length) continue;
    const eq = ms.find(m => m.name === 'じしん');
    const pl = ms.find(plain);
    if (eq && pl) withEq.push({ p, eq, pl });
    else if (pl) withPlain.push({ p, pl });
  }
  // ★A(offset=0)と B(offset=1)で**種が1体も重ならない**ように、同じ並びから別の区画を取る
  //   (両ページが同じ pool を同じ手順で作る=どちらから見ても相手の6体が分かる=ログの鏡写し変換の前提)
  const lead = withEq[offset];
  const rest = withPlain.slice(offset * 5, offset * 5 + 5);
  if (!lead || rest.length < 5) return { error: 'お膳立てできる子が見つからない' };
  const second = rest[0];
  const mine = [lead.p].concat(rest.map(x => x.p));
  if (mine.length < 6 || mine.some(p => !p)) return { error: '6体そろわない' };
  selfIds().forEach((id, i) => setSlot(id, mine[i].name));
  // 技は「覚える技」の中から固定で選ぶ(相手側の applyOpponentTeam が usableMoves で引き直すため、
  // 覚えない技を入れると相手側で autoMoves に落ちて**両者の技が食い違う**=それ自体が desync の種)
  const four = (p, first) => {
    const ms = S.usableMoves(p);
    const out = [first].concat(ms.filter(m => m.name !== first.name && plain(m)).slice(0, 3));
    while (out.length < 4) out.push(ms[out.length] || ms[0]);
    return out.slice(0, 4);
  };
  slotMoves[selfIds()[0]] = four(lead.p, lead.eq);     // 技0=じしん(範囲)
  slotMoves[selfIds()[1]] = four(second.p, second.pl); // 技0=1体選択
  return { names: mine.map(p => p.name), lead: lead.p.name, eq: lead.eq.name,
    leadMoves: slotMoves[selfIds()[0]].map(m => m.name), slot1Moves: slotMoves[selfIds()[1]].map(m => m.name) };
}, { offset, fmt });

// 1枠ぶんの入力(plan: {kind:'move',i,target} | {kind:'switch',bench} | {kind:'mega+move',i,target})
async function inputSlot(page, plan) {
  if (plan.mega) {
    const has = await page.evaluate(() => !!document.querySelector('#moves .mega-side'));
    if (has) await page.evaluate(() => document.querySelector('#moves .mega-side').click());
  }
  if (plan.kind === 'switch') {
    await page.evaluate(() => document.querySelector('#moves .party-open').click());
    try {
      await waitParty(page, 8000);
    } catch (e) {
      // 失敗の理由が分かる形で落とす(「交代できる控えが居ない」等を黙って timeout にしない)
      const d = await page.evaluate(() => ({
        partyOpen: document.getElementById('party').style.display,
        swSlotIdx: (typeof swSlotIdx !== 'undefined') ? swSlotIdx : null,
        rows: [...document.querySelectorAll('#party .sw-mine .slot')].map(b => ({
          i: b.dataset.i == null ? null : +b.dataset.i, dis: !!b.disabled, cls: b.className })),
        bench: (S.sides.self.bench || []).map((e, i) => ({ i, n: e && e.poke && e.poke.name, hp: e && e.currentHp, f: !!(e && e.fainted) })),
        slots: [0, 1].map(i => { const s = S.slotOf('self', i); return { i, n: s && s.poke && s.poke.name, hp: s && s.currentHp, f: !!(s && s.fainted) }; }),
      }));
      throw new Error('交代画面に選べる控えが出ない: ' + JSON.stringify(d));
    }
    const r = await page.evaluate(b => {
      const rows = [...document.querySelectorAll('#party .sw-mine .slot[data-i]:not([disabled])')];
      const el = (b == null) ? rows[0] : rows.find(x => +x.dataset.i === b);
      if (!el) return null;
      const i = +el.dataset.i;
      el.click();
      const y = document.querySelector('#party .sw-confirm .sw-yes');
      if (!y) return null;
      y.click();
      return i;
    }, plan.bench);
    return { kind: 'switch', bench: r };
  }
  const mi = plan.i == null ? 0 : plan.i;
  const clicked = await page.evaluate(i => {
    const b = document.querySelector(`#moves button.tcol[data-i="${i}"]:not([disabled])`)
      || document.querySelector('#moves button.tcol:not([disabled])');
    if (!b) return null;
    const n = +b.dataset.i;
    b.click();
    return n;
  }, mi);
  // 対象板が出たら指定の枠を押す(出ない技=範囲/自分対象はそのまま進む)
  const tb = await page.evaluate(() => !!document.getElementById('target-board'));
  let picked = null;
  if (tb) {
    picked = await page.evaluate(t => {
      const sel = t ? `#target-board .tb-slot[data-side="${t.side}"][data-idx="${t.idx}"]:not([disabled])` : null;
      const b = (sel && document.querySelector(sel)) || document.querySelector('#target-board .tb-slot[data-side]:not([disabled])');
      if (!b) return null;
      const out = { side: b.dataset.side, idx: +b.dataset.idx };
      b.click();
      return out;
    }, plan.target || null);
  }
  return { kind: 'move', i: clicked, board: tb, target: picked };
}

// 在場の枠ぶんだけ入力する(ダブル=枠0→枠1。入力が終わると自動で送信される)
async function inputTurn(page, plans, dbl) {
  const done = [];
  const n = dbl ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const vis = await page.evaluate(() => {
      const mv = document.getElementById('moves');
      return !!(mv && mv.style.display !== 'none');
    });
    if (!vis) break;
    const slotIdx = await page.evaluate(() => (typeof CMD !== 'undefined' ? CMD.slotIdx : 0));
    done.push(await inputSlot(page, plans[slotIdx] || plans[k] || { kind: 'move', i: 0 }));
    await page.waitForTimeout(120);
  }
  return done;
}

// 死に出し(自分側)の選択を必要な回数ぶんこなす。
// ★「空席があるか」をエンジンの状態で先に見る: 画面(交代画面)はメッセージ送りのアニメーションが
//   終わってから開くので、DOM だけ見て早合点すると「まだ開いていない」と取り違える
//   (取り違えると45秒の時間切れが先に来て、プレイヤーの選択経路を検証できない=実測でそうなった)。
const needMyReplace = page => page.evaluate(() => {
  const live = (S.sides.self.bench || []).some(e => e && e.poke && !e.fainted && !(e.currentHp != null && e.currentHp <= 0));
  if (!live) return false;
  return [0, 1].some(i => { const s = S.slotOf('self', i); return s && s.poke && (s.fainted || (s.currentHp != null && s.currentHp <= 0)); });
});
async function resolveReplaces(page, log, label) {
  for (let g = 0; g < 4; g++) {
    if (!await needMyReplace(page)) return g;   // 補充の要る空席が無い=この側は選ばない
    await waitParty(page, 30000);               // 交代画面が開くまで待つ(演出の分)
    const r = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#party .sw-mine .slot[data-i]:not([disabled])')];
      if (!rows.length) return null;
      const i = +rows[0].dataset.i;
      rows[0].click();
      const y = document.querySelector('#party .sw-confirm .sw-yes');
      if (!y) return null;
      y.click();
      return { bench: i, slot: (typeof swSlotIdx !== 'undefined') ? swSlotIdx : 0 };
    });
    log(`    [${label}] 死に出し選択: ${JSON.stringify(r)}`);
    // 選んだあとは「次の枠の画面が開く」か「両者そろって適用が終わる(pendingRep が消える)」まで待つ。
    // ここを待たずに次のループへ行くと、まだ適用前(=空席のまま)の状態を見て
    // 「もう一度選ぶ画面が出るはず」と誤解する(相手の選択待ちなので永遠に出ない)。
    await page.waitForFunction(() => {
      const pt = document.getElementById('party');
      return (pt && pt.style.display !== 'none') || !(window.RB_ONLINE && RB_ONLINE.pendingRep);
    }, null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(250);
    await page.evaluate(() => { if (typeof RB_ACT !== 'undefined') RB_ACT.left = 45; });
  }
  return 4;
}

async function run(args) {
  const { log, lines } = mkLogger();
  let FAIL = 0;
  const ok = (cond, msg, extra) => { log((cond ? '  OK   ' : '  FAIL ') + msg + (extra != null ? '  → ' + extra : '')); if (!cond) FAIL++; };

  let server = null, browser = null;
  try {
    server = await ensureServer(args.port, log);
    browser = await chromium.launch({ headless: !args.headed });
    const url = `http://127.0.0.1:${args.port}/online_battle.html`;

    // =============================================================
    // 試合1: ダブル
    // =============================================================
    if (args.only !== 'single') {
      log('');
      log('================= ① ダブルのループバック(A=host / B=guest) =================');
      const { context, pages } = await openPair(browser, url,
        [{ role: 'host', label: 'A', query: '?format=double' }, { role: 'guest', label: 'B', query: '?format=double' }],
        async (page, spec) => {
          const r = await setTeam(page, spec.role === 'host' ? 0 : 1, 'double');
          if (r.error) throw new Error(spec.label + ': ' + r.error);
          log(`[${spec.label}] チーム: ${r.names.join(' / ')}`);
          log(`[${spec.label}]   枠0の技: ${r.leadMoves.join(',')} / 枠1の技: ${r.slot1Moves.join(',')}`);
        }, log);
      const [A, B] = pages;

      const nmA = await names6(A.page), nmB = await names6(B.page);
      // 鏡写し変換の前提は「A と B で同じ種が居ない」こと(同名が両側に居ると側を区別できない)。
      // 部分一致(ライチュウ ⊂ ライチュウ(アローラ))は toPeerView が長い名前から置換するので問題ない。
      const dup = nmA.self.filter(n => nmB.self.includes(n));
      ok(dup.length === 0, '検証用チームは A と B で種が重ならない(鏡写し変換の前提)', dup.join(',') || 'なし');
      const all = nmA.self.concat(nmB.self);
      const sub = all.filter(x => all.some(y => y !== x && y.includes(x)));
      if (sub.length) log('  (参考)部分一致する名前: ' + sub.join(',') + ' → 長い名前から置換するので変換は成立する');

      const room = 'lb_dbl_' + Date.now().toString(36);
      await A.page.evaluate(r => onlineConnectRoom(r, 'A'), room);
      await B.page.evaluate(r => onlineConnectRoom(r, 'B'), room);
      for (const p of [A, B]) {
        await p.page.waitForFunction(() => window.RB_ONLINE && RB_ONLINE.myTeamSent && RB_ONLINE.oppTeamReady, null, { timeout: 20000 });
      }
      log('チーム交換OK(両者)');
      // 相手の技が「自分が送ったもの」と一致しているか(applyOpponentTeam の引き直しで落ちていないか)
      const mvCheck = await B.page.evaluate(() => oppIds().slice(0, 2).map(id => (slotMoves[id] || []).map(m => m && m.name)));
      const mvSent = await A.page.evaluate(() => selfIds().slice(0, 2).map(id => (slotMoves[id] || []).map(m => m && m.name)));
      ok(JSON.stringify(mvCheck) === JSON.stringify(mvSent), 'A の技構成が B 側の相手チームへそのまま渡った',
        JSON.stringify(mvCheck) + ' vs ' + JSON.stringify(mvSent));

      // 選出4体(ダブル)
      for (const p of [A, B]) {
        await p.page.waitForFunction(() => !!document.getElementById('pick-screen'), null, { timeout: 20000 });
        await p.page.evaluate(() => { PICK.sel = selfIds().slice(0, FORMAT.pickCount); confirmPick(); });
      }
      for (const p of [A, B]) await p.page.waitForFunction(() => window.RB_ONLINE && RB_ONLINE.started, null, { timeout: 20000 });
      const pc = await A.page.evaluate(() => FORMAT.pickCount);
      ok(pc === 4, 'ダブルの選出数=4', String(pc));
      await waitIdle(A.page); await waitIdle(B.page);
      const board = await A.page.evaluate(() => ({
        dbl: isDoubleBoard(), slots: boardSlots(), f1: !!document.getElementById('f-opp-1'),
        pb1: !!document.getElementById('pb-self-1'), deferSlots: !!engineWin().__rbDeferFaintReplaceSlots,
        deferOpp: !!engineWin().__rbDeferFaintReplaceOpp, canon: engineWin().__rbCanonFirst }));
      log('A の盤面: ' + JSON.stringify(board));
      ok(board.dbl && board.slots === 2 && board.f1 && board.pb1, 'オンラインでも枠1の盤面が出る(D6-5 c-2)', JSON.stringify(board));
      ok(board.deferSlots && board.deferOpp, '両側の死に出しがエンジンで保留される(b-1)', JSON.stringify(board));
      const canonB = await B.page.evaluate(() => engineWin().__rbCanonFirst);
      ok(board.canon === 'self' && canonB === 'opp', '正準サイド=ホスト側(A:self / B:opp)', board.canon + '/' + canonB);

      // ★死に出しに関わるページ関数の「呼ばれ方」を記録する実行時パッチ(ページは1文字も変えない)。
      //   不一致や固まりの原因を**推測でなく記録で**言えるようにする(どの経路が走ったか/誰が選んだか)。
      for (const p of [A, B]) {
        await p.page.evaluate(() => {
          window.__fn = [];
          ['endOfTurn', 'onlineBeginFaintReplace', 'onlineBeginFaintReplaceSlots', 'onlineRecordRepPick',
            'onlineTryApplyReplaces', 'onlineTryApplyReplacesSlots', 'beginFaintReplaceSlot', 'doSwitchTo',
            'afterFaintReplaceDone', 'nextSelfFaintReplaceSlot', 'showParty'].forEach(n => {
            const o = window[n];
            if (typeof o !== 'function') return;
            window[n] = function () {
              const args = [].slice.call(arguments).map(x => (x && typeof x === 'object') ? '{}' : String(x)).join(',');
              const who = (n === 'doSwitchTo' || n === 'onlineRecordRepPick')
                ? ' ←' + (new Error()).stack.split('\n').slice(2, 5).map(s => s.trim().replace(/^at /, '').split(' ')[0]).join('<') : '';
              window.__fn.push(n + '(' + args + ')@' + S.battleLog.length + who);
              return o.apply(this, arguments);
            };
          });
        });
      }

      // ---- ターンの台本 ----
      // 枠0の技0=じしん(範囲)・技1以降=1体選択 / 枠1の技0=1体選択
      // ★順番の理由: 交代/メガは「控えが生きているうち」に通す。死に出し(片側→両側)は最後に置き、
      //   その手前までは毎ターンHPを満タンに戻す(4体しか居ないダブルは放っておくと3ターンで壊滅する)。
      const plain = { 0: { kind: 'move', i: 1, target: { side: 'opp', idx: 0 } }, 1: { kind: 'move', i: 0, target: { side: 'opp', idx: 1 } } };
      const aim = (s, i) => ({ kind: 'move', i: 1, target: { side: s, idx: i } });
      const T = {
        1: { note: '両者とも1体選択(対象板で相手の左/右を選ぶ)',
          A: { 0: aim('opp', 0), 1: { kind: 'move', i: 0, target: { side: 'opp', idx: 1 } } },
          B: { 0: aim('opp', 1), 1: { kind: 'move', i: 0, target: { side: 'opp', idx: 0 } } } },
        2: { note: 'A の枠1が交代(ダブルの枠1だけ交代)',
          A: { 0: aim('opp', 0), 1: { kind: 'switch', bench: 0 } }, B: plain },
        3: { note: 'A の枠0がメガ+技(側で1回)', A: { 0: Object.assign({ mega: true }, aim('opp', 0)), 1: { kind: 'move', i: 0, target: { side: 'opp', idx: 1 } } }, B: plain },
        4: { note: 'A の枠0が範囲技(じしん)=対象板は出ない',
          A: { 0: { kind: 'move', i: 0 }, 1: { kind: 'move', i: 0, target: { side: 'opp', idx: 0 } } }, B: plain },
        5: { note: 'A の枠0が対象板で「味方(自分の枠1)」を選ぶ', A: { 0: aim('self', 1), 1: { kind: 'move', i: 0, target: { side: 'opp', idx: 0 } } }, B: plain },
        6: { note: 'B の枠1が交代', A: plain, B: { 0: aim('opp', 0), 1: { kind: 'switch', bench: 0 } } },
      };
      const FAINT_ONE = 9;    // 片側(B の枠1)だけ死に出し
      const FAINT_BOTH = 11;  // 両側同時の死に出し

      let mismatches = 0, compared = 0, sawBoard = false, sawSpread = false, sawAlly = false,
        sawSwitch = false, sawMega = false, sawRep = 0, sawBothRep = 0;

      for (let t = 1; t <= args.turns; t++) {
        const pre = await snap(A.page);
        if (pre.over) { log(`ターン${t}: すでに決着 → 打ち切り`); break; }
        const plan = T[t] || { note: '通常(1体選択)', A: plain, B: plain };

        // お膳立て(HPを削る)は**両ページへ鏡写しで同じ個体に**入れる(片方だけだと当然ズレる)
        let aPlans = plan.A, bPlans = plan.B, note = plan.note;
        if (t === FAINT_ONE) {
          note = '片側の死に出し(B の枠1 を HP1 にして倒す)';
          log('  お膳立て: B の枠1 を HP1 に');
          await A.page.evaluate(() => { const s = S.slotOf('opp', 1); if (s) s.currentHp = 1; });
          await B.page.evaluate(() => { const s = S.slotOf('self', 1); if (s) s.currentHp = 1; });
          aPlans = { 0: aim('opp', 1), 1: { kind: 'move', i: 0, target: { side: 'opp', idx: 1 } } };
        }
        if (t === FAINT_BOTH) {
          note = '両側同時の死に出し(A の枠1 と B の枠1 を HP1 → A の じしんで両方倒す)';
          log('  お膳立て: A の枠1 と B の枠1 を HP1 に');
          await A.page.evaluate(() => { [S.slotOf('self', 1), S.slotOf('opp', 1)].forEach(s => { if (s) s.currentHp = 1; }); });
          await B.page.evaluate(() => { [S.slotOf('self', 1), S.slotOf('opp', 1)].forEach(s => { if (s) s.currentHp = 1; }); });
          aPlans = { 0: { kind: 'move', i: 0 }, 1: { kind: 'move', i: 0, target: { side: 'opp', idx: 1 } } };   // じしん=味方の枠1も巻き込む
          bPlans = plain;
        }

        await waitMoves(A.page); await waitMoves(B.page);
        await keepTimer(A.page); await keepTimer(B.page);
        const inA = await inputTurn(A.page, aPlans, true);
        const inB = await inputTurn(B.page, bPlans, true);
        if (inA.concat(inB).some(x => x.board)) sawBoard = true;
        if (inA.some(x => x.kind === 'move' && x.board === false)) sawSpread = true;
        if (inA.some(x => x.target && x.target.side === 'self')) sawAlly = true;
        if (inA.concat(inB).some(x => x.kind === 'switch')) sawSwitch = true;

        // 送った payload(double の形)
        const sentA = await A.page.evaluate(() => {
          const s = window.__LB.sent.filter(m => m.type === 'action');
          return s.length ? s[s.length - 1].action : null;
        });
        if (t === 1) {
          log('  A が送った action: ' + JSON.stringify(sentA));
          ok(!!sentA && sentA.fmt === 'double' && Array.isArray(sentA.slots) && sentA.slots.length === 2,
            'ダブルの payload = {fmt:"double", slots:[枠0,枠1]}', JSON.stringify(sentA));
          const keys = sentA && sentA.slots ? Object.keys(sentA.slots[0]).sort().join(',') : '';
          ok(/idx/.test(keys) && /kind/.test(keys), '枠ごとに idx/kind/moveIdx/target/mega を持つ', keys);
        }

        // 死に出しのターンは、両ページが「何を待っているか」を必ず記録する(黙って自動補充されたら分かるように)
        if (t === FAINT_ONE || t === FAINT_BOTH) {
          const dump = p => p.evaluate(() => {
            const ew = engineWin();
            const P = window.RB_ONLINE && RB_ONLINE.pendingRep;
            return { pendingRep: P ? { fmt: P.fmt, need: P.need, picks: P.picks } : null,
              party: document.getElementById('party').style.display,
              forced: (typeof swForced !== 'undefined') ? swForced : null,
              slot: (typeof swSlotIdx !== 'undefined') ? swSlotIdx : null,
              flags: { self: !!ew.__rbDeferFaintReplace, opp: !!ew.__rbDeferFaintReplaceOpp, slots: !!ew.__rbDeferFaintReplaceSlots },
              fainted: ['self', 'opp'].map(sd => [0, 1].map(i => { const s = S.slotOf(sd, i); return s && s.poke ? (s.fainted ? 'X' : 'o') : '-'; }).join('')).join('/'),
              // ★生ログの末尾(─── 区切りを含む)= 補充が「ターン終了の前(エンジン)」か「後(ページ)」かが分かる
              rawTail: S.battleLog.slice(-14).map(e => e.msg),
              fn: (window.__fn || []).slice(-14),
              turnNo: (typeof turnNo !== 'undefined') ? turnNo : null, act: { left: RB_ACT.left, turn: RB_ACT.turn, running: !!RB_ACT.t } };
          });
          log('    [A] ' + JSON.stringify(await dump(A.page)));
          log('    [B] ' + JSON.stringify(await dump(B.page)));
        }
        // 死に出し(両者それぞれの画面で選ぶ)
        // ★A と B を**同時に**面倒みる: 片方を待ってからもう片方を見ると、
        //   「相手の選択を待っている側」を先に待ってしまって進まない(その間に45秒が切れて
        //   時間切れの自動選択に奪われる=実測でそうなった)。ロックステップは両者が並行に動く。
        const settle = async (p, label) => {
          await waitIdle(p.page, 90000);   // #moves / #party(死に出し) / 勝敗バナー のどれかが出るまで
          await keepTimer(p.page);
          return resolveReplaces(p.page, log, label);
        };
        const [repA, repB] = await Promise.all([settle(A, 'A'), settle(B, 'B')]);
        if (repA || repB) sawRep++;
        if (repA && repB) sawBothRep++;
        await Promise.all([waitIdle(A.page, 90000), waitIdle(B.page, 90000)]);
        await A.page.waitForTimeout(300); await B.page.waitForTimeout(300);

        const a = await snap(A.page), b = await snap(B.page);
        compared++;
        const diffs = [];
        // ① ログ(鏡写し変換して全文一致)。辞書=編成6体+いま場/控えに居る名前(メガシンカで名前が変わる)
        const myNames = [...new Set(nmA.self.concat(a.nameSelf, b.nameOpp))];
        const theirNames = [...new Set(nmB.self.concat(a.nameOpp, b.nameSelf))];
        const aAsB = a.log.map(l => toPeerView(l, myNames, theirNames));
        if (aAsB.length !== b.log.length) diffs.push(`ログの行数が違う A=${aAsB.length} B=${b.log.length}`);
        const n = Math.min(aAsB.length, b.log.length);
        for (let i = 0; i < n; i++) {
          if (aAsB[i] !== b.log[i]) diffs.push(`ログ不一致 #${i + 1}\n      A(B視点へ変換): ${aAsB[i]}\n      B(実物)       : ${b.log[i]}\n      A(原文)       : ${a.log[i]}`);
        }
        // ② HP/ひんし(鏡写し)
        [0, 1].forEach(i => {
          const x = JSON.stringify(a.self[i]), y = JSON.stringify(b.opp[i]);
          if (x !== y) diffs.push(`A.self[${i}] != B.opp[${i}]: ${x} / ${y}`);
          const p = JSON.stringify(a.opp[i]), q = JSON.stringify(b.self[i]);
          if (p !== q) diffs.push(`A.opp[${i}] != B.self[${i}]: ${p} / ${q}`);
        });
        if (JSON.stringify(a.benchSelf) !== JSON.stringify(b.benchOpp)) diffs.push(`控え(A自分 vs B相手)が違う: ${JSON.stringify(a.benchSelf)} / ${JSON.stringify(b.benchOpp)}`);
        if (JSON.stringify(a.benchOpp) !== JSON.stringify(b.benchSelf)) diffs.push(`控え(A相手 vs B自分)が違う: ${JSON.stringify(a.benchOpp)} / ${JSON.stringify(b.benchSelf)}`);
        // ③ 乱数消費回数
        if (a.rng !== b.rng) diffs.push(`乱数消費回数が違う A=${a.rng} B=${b.rng}`);

        const stateLine = `turnNo=${a.turn} / COMMAND残=${a.act.left}(A)/${b.act.left}(B) / log ${a.log.length}行 / self=${a.self.map(s => s ? s.name + ':' + s.hp + (s.fainted ? '(ひんし)' : '') : '空席').join(' ')}`
          + ` / opp=${a.opp.map(s => s ? s.name + ':' + s.hp + (s.fainted ? '(ひんし)' : '') : '空席').join(' ')}`
          + ` / 控え(自分)=${a.benchSelf.map(e => e ? e.name + ':' + e.hp + (e.fainted ? '(ひんし)' : '') : '-').join(' ')} / rng=${a.rng}`;
        if (diffs.length) {
          mismatches++;
          log(`  ターン${t}(${note}): 不一致 ${diffs.length}件  [${stateLine}]`);
          diffs.forEach(d => log('    - ' + d));
        } else {
          log(`  ターン${t}(${note}): 一致(${stateLine})`);
        }
        if (a.over || b.over) { log(`  ターン${t}で決着 → 打ち切り`); break; }
        // 比較のあとで回復(次のターンも全員そろって戦える=交代/メガ/死に出しを順番に通せる)
        await topUp(A.page); await topUp(B.page);
      }
      const megaLog = await A.page.evaluate(() => S.battleLog.some(e => /メガシンカした！/.test(e.msg)));
      sawMega = megaLog;

      ok(compared >= 10, `10ターン以上を比較した(実績 ${compared})`, String(compared));
      ok(mismatches === 0, `鏡写しの不一致0(${compared}ターン比較)`, String(mismatches));
      ok(sawBoard, '対象板を通るターンがあった');
      ok(sawSpread, '範囲技(じしん)を通るターンがあった');
      ok(sawAlly, '対象板で味方を選ぶターンがあった');
      ok(sawSwitch, '枠1の交代を通るターンがあった');
      ok(sawRep >= 1, `死に出しを通るターンがあった(${sawRep}回)`, String(sawRep));
      ok(sawBothRep >= 1, `両側同時の死に出しを通った(${sawBothRep}回)`, String(sawBothRep));
      log('  メガシンカのログ: ' + (sawMega ? 'あり' : 'なし(そのチームにメガ対象が居なかった)'));

      const errs = [...A.audit.errors, ...B.audit.errors];
      if (errs.length) errs.forEach(e => log(`  JSエラー/HTTP: [${e.kind}] ${e.text}`));
      ok(errs.length === 0, 'JSエラー0(A+B)', String(errs.length));
      await context.close();
    }

    // =============================================================
    // 試合2: シングル(payload と受信処理が不変であることの確認)
    // =============================================================
    if (args.only !== 'double') {
      log('');
      log('================= ② シングルのループバック(不変の確認) =================');
      const { context, pages } = await openPair(browser, url,
        [{ role: 'host', label: 'A', query: '' }, { role: 'guest', label: 'B', query: '' }],
        async (page, spec) => {
          const r = await setTeam(page, spec.role === 'host' ? 0 : 1, 'single');
          if (r.error) throw new Error(spec.label + ': ' + r.error);
          log(`[${spec.label}] チーム: ${r.names.join(' / ')}`);
        }, log);
      const [A, B] = pages;
      const nmA = await names6(A.page), nmB = await names6(B.page);
      const room = 'lb_sgl_' + Date.now().toString(36);
      await A.page.evaluate(r => onlineConnectRoom(r, 'A'), room);
      await B.page.evaluate(r => onlineConnectRoom(r, 'B'), room);
      for (const p of [A, B]) await p.page.waitForFunction(() => window.RB_ONLINE && RB_ONLINE.myTeamSent && RB_ONLINE.oppTeamReady, null, { timeout: 20000 });
      for (const p of [A, B]) {
        await p.page.waitForFunction(() => !!document.getElementById('pick-screen'), null, { timeout: 20000 });
        await p.page.evaluate(() => { PICK.sel = selfIds().slice(0, FORMAT.pickCount); confirmPick(); });
      }
      for (const p of [A, B]) await p.page.waitForFunction(() => window.RB_ONLINE && RB_ONLINE.started, null, { timeout: 20000 });
      const sgl = await A.page.evaluate(() => ({ pick: FORMAT.pickCount, dbl: isDoubleBoard(), slots: boardSlots(),
        f1: !!document.getElementById('f-opp-1'), deferSlots: !!engineWin().__rbDeferFaintReplaceSlots }));
      log('A(シングル)の盤面: ' + JSON.stringify(sgl));
      ok(sgl.pick === 3 && !sgl.dbl && sgl.slots === 1 && !sgl.f1, 'シングルは枠が1つ・DOMが増えない', JSON.stringify(sgl));
      ok(sgl.deferSlots === false, 'シングルでは __rbDeferFaintReplaceSlots を立てない(従来の死に出し経路)', String(sgl.deferSlots));

      let sMis = 0, sCmp = 0, shape = null;
      for (let t = 1; t <= 4; t++) {
        const pre = await snap(A.page);
        if (pre.over) break;
        await waitMoves(A.page); await waitMoves(B.page);
        await inputTurn(A.page, { 0: { kind: 'move', i: 0 } }, false);
        await inputTurn(B.page, { 0: { kind: 'move', i: 0 } }, false);
        if (t === 1) {
          shape = await A.page.evaluate(() => {
            const s = window.__LB.sent.filter(m => m.type === 'action');
            return s.length ? s[s.length - 1].action : null;
          });
        }
        await waitIdle(A.page, 60000); await waitIdle(B.page, 60000);
        await resolveReplaces(A.page, log, 'A'); await resolveReplaces(B.page, log, 'B');
        await waitIdle(A.page, 60000); await waitIdle(B.page, 60000);
        await A.page.waitForTimeout(250); await B.page.waitForTimeout(250);
        const a = await snap(A.page), b = await snap(B.page);
        sCmp++;
        const aAsB = a.log.map(l => toPeerView(l, nmA.self, nmB.self));
        let bad = 0;
        if (aAsB.length !== b.log.length) bad++;
        for (let i = 0; i < Math.min(aAsB.length, b.log.length); i++) {
          if (aAsB[i] !== b.log[i]) { bad++; log(`    - ログ不一致 #${i + 1}\n      A→B視点: ${aAsB[i]}\n      B実物  : ${b.log[i]}`); }
        }
        if (JSON.stringify(a.self[0]) !== JSON.stringify(b.opp[0])) { bad++; log(`    - HP不一致: ${JSON.stringify(a.self[0])} / ${JSON.stringify(b.opp[0])}`); }
        if (a.rng !== b.rng) { bad++; log(`    - 乱数消費回数: A=${a.rng} B=${b.rng}`); }
        if (bad) sMis++;
        log(`  ターン${t}: ${bad ? '不一致' + bad + '件' : '一致'}(log ${a.log.length}行 / self=${a.self[0] && a.self[0].hp} opp=${a.opp[0] && a.opp[0].hp} / rng=${a.rng})`);
        if (a.over || b.over) break;
      }
      log('  A が送った action(single): ' + JSON.stringify(shape));
      const keys = shape ? Object.keys(shape).sort().join(',') : '';
      ok(keys === 'idx,kind,mega,pivotIdx', 'シングルの payload は {kind,idx,mega,pivotIdx} のまま(byte不変)', keys);
      ok(shape && shape.fmt === undefined, 'シングルの payload に fmt が入らない(旧クライアントと相互運用)', String(shape && shape.fmt));
      ok(sMis === 0, `シングルも鏡写し一致(${sCmp}ターン)`, String(sMis));
      const errs = [...A.audit.errors, ...B.audit.errors];
      if (errs.length) errs.forEach(e => log(`  JSエラー/HTTP: [${e.kind}] ${e.text}`));
      ok(errs.length === 0, 'JSエラー0(A+B・シングル)', String(errs.length));
      await context.close();
    }

    log('');
    log(`=== 結果: FAIL ${FAIL}件 ===`);
    log(FAIL === 0 ? 'PASS' : 'FAIL');
    process.exitCode = FAIL === 0 ? 0 : 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) { try { server.kill('SIGTERM'); } catch (e) {} }
  }
}

run(parseArgs(process.argv.slice(2))).catch(e => {
  console.error('致命的エラー:', (e && e.stack) || e);
  process.exitCode = 1;
});
