// バトルラボ 敵対的シナリオテスト(Wave2・UI状態機械の決定的台本)
// 設計=設計_敵対的シナリオテスト_2026-07-21.md Wave2(10本)。tools/_lab_monkey.js / _lab_fx_verify.js の
// スタイルに合わせる(乱打でなく、各シナリオ=「操作列→不変条件assert」の台本・シードなし=完全決定的)。
//
// ★このファイルはバグを直さない。見つけて報告するだけ(battle_lab.html等は無改造)。
//
// 発見の鍵: battle_lab.htmlは単一<script>直書きなので、page.evaluate()から busy/sayQueue/S/swForced/
// labChoicePending/gameOver/labUndoSnap 等の let 変数、および say/labRunForcedQueue/labReviveContinue/
// openBattlePicker/doTurn/executeTurn/toggleLabAI/ghRenderAll/labBeginTurn 等の関数宣言をベア識別子で
// 直接読み書きできる(グローバル字句スコープ共有・実測確認済み)。既存ハーネスのiframe文字列eval越しより
// 直接的なので、これを使って「実際に起きうるがUIから辿るのが大変な状態」へ直接遷移させてから台本を回す。
//
// 実行前提: python3 -m http.server 8000 をリポジトリ直下で(このスクリプトが自前でも起動/停止する)。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const REPO_DIR = path.resolve(__dirname, '..');
const PORT = process.env.LAB_PORT || 8000;
const URL = process.env.LAB_URL || `http://localhost:${PORT}/battle_lab.html`;
const SHOT_DIR = '/private/tmp/claude-501/-Users-masamichi-Documents-----DB/c66c96f4-b801-478b-9805-ec9088008d04/scratchpad/adversarial';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
function ok(name, pass, detail){
  results.push({ name, pass, detail: detail || '' });
  console.log((pass ? '✅ PASS ' : '❌ FAIL ') + name);
  if (detail) console.log('    ' + detail);
}

function pingServer(){
  return new Promise(resolve => {
    const req = http.get(URL, res => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function waitUntil(page, fn, timeout = 15000, iv = 100){
  const t0 = Date.now();
  while (Date.now() - t0 < timeout){
    const v = await page.evaluate(fn).catch(() => false);
    if (v) return true;
    await page.waitForTimeout(iv);
  }
  return false;
}

async function screenshot(page, name){
  try { await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') }); } catch (e) {}
}

// ★2026-07-21: ▶バトルスタートは直接開戦でなく、まず選出(pick)画面(#lab-pick-screen)を挟むようになった。
// ハーネスは「6たいぜんぶでバトル」(#lpk-gofull=常に押せる・選出ゼロなら編成順そのまま=旧来のstartBattle相当)
// を選んで素通りさせる。決定的シナリオ台本の性質(乱数不使用)を崩さない最短経路。
async function passLabPickScreen(page){
  const shown = await waitUntil(page, () => !!document.getElementById('lab-pick-screen'), 8000);
  if (!shown) return false;
  await page.evaluate(() => { const b = document.getElementById('lpk-gofull'); if (b) b.click(); });
  return true;
}

async function newTrackedPage(browser){
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|404|net::ERR|Failed to load resource|adsbygoogle|googlesyndication/.test(m.text())){
      errors.push('console: ' + m.text());
    }
  });
  page._errors = errors;
  return page;
}

// ===== 共通セットアップ: 完全決定的な編成(乱数不使用)でバトル開始 =====
// self s1 = メガフォームを持つ種(S.pokeByName('メガ'+name)が引ける種)を毎回同じロジックで選ぶ
// (具体名を決め打ちしない=データセット変更に強い・かつMath.random不使用=再現性100%)。
async function freshBattle(page){
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); }
    const s = document.getElementById('msg-speed'); if (s){ s.value = '250'; s.dispatchEvent(new Event('change')); }
  });
  await page.evaluate(() => {
    const list = S.pokeList().filter(isPickable);
    const megaCap = list.find(p => S.pokeByName('メガ' + p.name)) || list[0];
    const rest = list.filter(p => p !== megaCap);
    const selfNames = [megaCap.name, rest[0].name, rest[1].name];
    const oppNames = [rest[2].name, rest[3].name, rest[4].name];
    ['s1', 's2', 's3'].forEach((id, i) => setSlot(id, selfNames[i]));
    ['o1', 'o2', 'o3'].forEach((id, i) => setSlot(id, oppNames[i]));
    window.__TEAM = { selfNames, oppNames, megaCapName: megaCap.name };
  });
  await page.evaluate(() => document.getElementById('btn-start').click());
  await passLabPickScreen(page);
  await waitUntil(page, () => document.body.classList.contains('in-battle'), 15000);
  await waitUntil(page, () => (typeof busy !== 'undefined') && !busy && document.getElementById('moves').style.display === 'flex', 20000);
}

// 「新バトルが開始できる」不変条件の共通チェック(乱数使用=容認。値でなく“開始できるか”だけを見る)。
// ★シナリオ側でauto-msgをOFFにしたまま呼ばれても詰まらないよう、ここで必ずON+高速に戻してから始める
// (残留設定はこのチェックの合否に混ざってはいけない=この関数自体は「新バトルが始められるか」だけを見る)。
async function canStartNewBattle(page){
  await page.evaluate(() => {
    const a = document.getElementById('auto-msg'); if (a && !a.checked){ a.checked = true; a.dispatchEvent(new Event('change')); }
    const s = document.getElementById('msg-speed'); if (s){ s.value = '250'; s.dispatchEvent(new Event('change')); }
  });
  await page.evaluate(() => { const b = document.getElementById('btn-random'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('btn-start').click());
  await passLabPickScreen(page);
  const started = await waitUntil(page, () => document.body.classList.contains('in-battle'), 15000);
  if (!started) return { ok: false, reason: 'in-battleクラスが付かない(startBattleが効いていない)' };
  const movesShown = await waitUntil(page, () => !busy && document.getElementById('moves').style.display === 'flex', 20000);
  return { ok: movesShown, reason: movesShown ? '' : 'moves画面が出ない(busy固着 or 詰み)' };
}

async function runScenario(browser, name, fn){
  const page = await newTrackedPage(browser);
  const tag = name.replace(/[^\w]+/g, '_').slice(0, 60);
  try {
    const { pass, detail } = await fn(page);
    if (!pass) await screenshot(page, tag + '_FAIL');
    ok(name, pass, detail);
  } catch (e){
    await screenshot(page, tag + '_EXCEPTION');
    ok(name, false, 'EXCEPTION: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e)));
  } finally {
    await page.close().catch(() => {});
  }
}

// ===================================================================
// シナリオ1: replay中(busy=true)に退出→新バトル
// exitBattleToSetup(~2521)はbusyを触らない=退出後もbusy残留の疑い。
// ===================================================================
async function s1(page){
  await freshBattle(page);
  await page.evaluate(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = false; a.dispatchEvent(new Event('change')); } });
  await page.evaluate(() => { say(['てすと せりふ その1', 'てすと せりふ その2', 'てすと せりふ その3'], () => { window.__s1Done = true; labBeginTurn(); }); });
  const busy1 = await page.evaluate(() => busy);
  const qlen1 = await page.evaluate(() => sayQueue.length);
  await page.evaluate(() => document.getElementById('btn-exit').click());
  await page.waitForTimeout(300);
  const afterExit = await page.evaluate(() => ({
    inBattle: document.body.classList.contains('in-battle'),
    busy, sayQueueLen: sayQueue.length,
    setupShown: document.getElementById('setup').style.display !== 'none',
    msgboxShown: document.getElementById('msgbox').style.display !== 'none',
  }));
  await page.evaluate(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); } });
  const nb = await canStartNewBattle(page);
  const busyAfterNewBattle = await waitUntil(page, () => !busy, 10000);
  const errs = page._errors.slice();
  const pass = busy1 === true && qlen1 === 2 && !afterExit.inBattle && afterExit.setupShown && !afterExit.msgboxShown &&
    nb.ok && busyAfterNewBattle && errs.length === 0;
  return {
    pass,
    detail: `busy1=${busy1} qlen1=${qlen1}(期待2) afterExit=${JSON.stringify(afterExit)} newBattle=${JSON.stringify(nb)} ` +
      `busyAfterNewBattle=${busyAfterNewBattle} errors=${JSON.stringify(errs)}`,
  };
}

// ===================================================================
// シナリオ2: 強制交代画面(swForced)で退出→新バトル
// exitBattleToSetup(~2534)はlabChoicePending等は消すがswForced/swPivot/RB_PIVOTは消さない。
// ===================================================================
async function s2(page){
  await freshBattle(page);
  async function triggerForcedSwitch(){
    await page.evaluate(() => {
      S.sides.self.currentHp = 0; S.sides.self.fainted = true;
      labForcedQueue = ['self'];
      labRunForcedQueue();
    });
    return waitUntil(page, () => document.getElementById('party').style.display === 'flex' && swForced === true, 8000);
  }
  const partyShown = await triggerForcedSwitch();
  const preExit = await page.evaluate(() => ({ swForced, swPivot }));
  await page.evaluate(() => document.getElementById('btn-exit').click());
  await page.waitForTimeout(300);
  const afterExit = await page.evaluate(() => ({
    inBattle: document.body.classList.contains('in-battle'),
    swForced, swPivot,
    partyDisplay: document.getElementById('party').style.display,
  }));
  const nb = await canStartNewBattle(page);
  // 残留フラグが次の本物の強制交代に影響しないか、もう一度同じ状況を作って確かめる
  const partyShown2 = await triggerForcedSwitch();
  await page.evaluate(() => document.getElementById('lab-ai-self').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('lab-ai-self').click());
  await page.waitForTimeout(400);
  const picked = await page.evaluate(() => {
    const b = document.querySelector('.sw-mine .slot[data-i]:not(.dead)');
    if (b){ b.click(); return true; } return false;
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => { const y = document.querySelector('.sw-confirm .sw-yes'); if (y) y.click(); });
  const backToMoves = await waitUntil(page, () => !busy && document.getElementById('moves').style.display === 'flex', 10000);
  const errs = page._errors.slice();
  const pass = partyShown && !afterExit.inBattle && nb.ok && partyShown2 && picked && backToMoves && errs.length === 0;
  return {
    pass,
    detail: `partyShown=${partyShown} preExit=${JSON.stringify(preExit)} afterExit=${JSON.stringify(afterExit)} ` +
      `newBattle=${JSON.stringify(nb)} partyShown2(2回目)=${partyShown2} picked=${picked} backToMoves=${backToMoves} errors=${JSON.stringify(errs)}`,
  };
}

// ===================================================================
// シナリオ3: 全滅選択中(labChoicePending)の退出→c-revive-continueリスナー二重化の疑い
// ===================================================================
async function s3(page){
  await freshBattle(page);
  await page.evaluate(() => {
    window.__revives = 0;
    const _orig = labReviveContinue;
    window.labReviveContinue = function(){ window.__revives = (window.__revives || 0) + 1; return _orig.apply(this, arguments); };
  });
  async function goToChoicePending(){
    await page.evaluate(() => {
      S.sides.self.currentHp = 0; S.sides.self.fainted = true;
      (S.sides.self.bench || []).forEach(e => { if (e && e.poke){ e.currentHp = 0; e.fainted = true; } });
      labForcedQueue = ['self'];
      labRunForcedQueue();
    });
    return waitUntil(page, () => labChoicePending === true, 8000);
  }
  const reached1 = await goToChoicePending();
  await page.evaluate(() => document.getElementById('btn-exit').click());   // labChoicePending中は確認なしのはず(L1)
  await page.waitForTimeout(300);
  const afterExit1 = await page.evaluate(() => ({
    inBattle: document.body.classList.contains('in-battle'),
    labChoicePending,
    rcDisplay: document.getElementById('c-revive-continue') ? document.getElementById('c-revive-continue').style.display : '(要素なし)',
  }));
  const nb = await canStartNewBattle(page);
  const reached2 = await goToChoicePending();
  await page.evaluate(() => document.getElementById('c-revive-continue').click());
  await page.waitForTimeout(400);
  const revives = await page.evaluate(() => window.__revives);
  const errs = page._errors.slice();
  const pass = reached1 && !afterExit1.inBattle && !afterExit1.labChoicePending && nb.ok && reached2 && revives === 1 && errs.length === 0;
  return {
    pass,
    detail: `reached1=${reached1} afterExit1=${JSON.stringify(afterExit1)} newBattle=${JSON.stringify(nb)} reached2=${reached2} ` +
      `revives(1クリックでの発火回数)=${revives}(期待1) errors=${JSON.stringify(errs)}`,
  };
}

// ===================================================================
// シナリオ4: replay中(busy=true)に「＋ついか」ピッカーを開く
// openBattlePicker(~2328)はbusy/swForcedガード無し。
// ===================================================================
async function s4(page){
  await freshBattle(page);
  await page.evaluate(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = false; a.dispatchEvent(new Event('change')); } });
  const benchLenBefore = await page.evaluate(() => (S.sides.self.bench || []).length);
  // ★doneコールバックはlabBeginTurn(実際のターン境界=endOfTurnが最終的に呼ぶのと同じ入口)にする。
  // ダミーのno-opだと「キューが尽きてもUIが戻らない」という“このテストコード自身が作る詰み”が混入するため。
  await page.evaluate(() => { say(['ついかピッカーてすと1', 'ついかピッカーてすと2', 'ついかピッカーてすと3'], () => { window.__s4Done = true; labBeginTurn(); }); });
  const busyDuring = await page.evaluate(() => busy);
  await page.evaluate(() => openBattlePicker('self'));
  const pickerOpen = await waitUntil(page, () => document.getElementById('poke-picker').style.display === 'flex', 3000);
  const picked = await page.evaluate(() => {
    const b = document.querySelector('#pp-list button[data-n]');
    if (b){ b.click(); return true; } return false;
  });
  await page.waitForTimeout(300);
  const afterPick = await page.evaluate(() => ({
    benchLen: (S.sides.self.bench || []).length,
    benchOk: (S.sides.self.bench || []).every(e => e && e.poke),
    pickerClosed: document.getElementById('poke-picker').style.display === 'none',
    busy,
  }));
  await page.evaluate(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); } });
  for (let i = 0; i < 6 && await page.evaluate(() => busy); i++){ await page.evaluate(() => advanceMsg()); await page.waitForTimeout(200); }
  const settled = await waitUntil(page, () => !busy, 8000);
  const uiSane = await waitUntil(page, () =>
    document.getElementById('moves').style.display === 'flex' ||
    document.getElementById('party').style.display === 'flex' ||
    !document.body.classList.contains('in-battle'), 5000);
  const nb = await canStartNewBattle(page);
  const errs = page._errors.slice();
  const pass = busyDuring === true && pickerOpen && picked && afterPick.benchLen === benchLenBefore + 1 &&
    afterPick.benchOk && settled && uiSane && nb.ok && errs.length === 0;
  return {
    pass,
    detail: `busyDuring=${busyDuring} pickerOpen=${pickerOpen} picked=${picked} benchLenBefore=${benchLenBefore} ` +
      `afterPick=${JSON.stringify(afterPick)} settled=${settled} uiSane=${uiSane} newBattle=${JSON.stringify(nb)} errors=${JSON.stringify(errs)}`,
  };
}

// ===================================================================
// シナリオ5: replay中にAIトグルを連打(250msポーラーlabAIResyncTimerの収束確認)
// ===================================================================
async function s5(page){
  await freshBattle(page);
  await page.evaluate(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = false; a.dispatchEvent(new Event('change')); } });
  await page.evaluate(() => { say(['AIとぐるてすと1', 'AIとぐるてすと2', 'AIとぐるてすと3', 'AIとぐるてすと4', 'AIとぐるてすと5'], () => { window.__s5Done = true; labBeginTurn(); }); });
  const selfClicks = 9, oppClicks = 6;   // 奇数/偶数で最終状態を予測可能にする
  for (let i = 0; i < selfClicks; i++){ await page.evaluate(() => document.getElementById('lab-ai-self').click()); await page.waitForTimeout(30); }
  for (let i = 0; i < oppClicks; i++){ await page.evaluate(() => document.getElementById('lab-ai-opp').click()); await page.waitForTimeout(30); }
  const expectSelf = selfClicks % 2 === 1;
  const expectOpp = oppClicks % 2 === 1;
  const timerActiveDuringBusy = await page.evaluate(() => labAIResyncTimer !== null);
  for (let i = 0; i < 8 && await page.evaluate(() => busy); i++){ await page.evaluate(() => advanceMsg()); await page.waitForTimeout(150); }
  const busyCleared = await waitUntil(page, () => !busy, 8000);
  const converged = await waitUntil(page, () => labAIResyncTimer === null, 4000);   // 収束=ポーラーが自然停止するか
  const finalState = await page.evaluate(() => ({
    self: labAI.self, opp: labAI.opp,
    uiSelfOn: document.getElementById('lab-ai-self').classList.contains('on'),
    uiOppOn: document.getElementById('lab-ai-opp').classList.contains('on'),
  }));
  const uiSane = await waitUntil(page, () =>
    document.getElementById('moves').style.display === 'flex' ||
    (document.getElementById('lab-turn-indicator') && document.getElementById('lab-turn-indicator').style.display === 'block'), 6000);
  const nb = await canStartNewBattle(page);
  const errs = page._errors.slice();
  const pass = timerActiveDuringBusy && busyCleared && converged &&
    finalState.self === expectSelf && finalState.opp === expectOpp &&
    finalState.uiSelfOn === expectSelf && finalState.uiOppOn === expectOpp &&
    uiSane && nb.ok && errs.length === 0;
  return {
    pass,
    detail: `timerActiveDuringBusy=${timerActiveDuringBusy} busyCleared=${busyCleared} converged(labAIResyncTimer→null)=${converged} ` +
      `finalState=${JSON.stringify(finalState)} expect(self=${expectSelf},opp=${expectOpp}) uiSane=${uiSane} newBattle=${JSON.stringify(nb)} errors=${JSON.stringify(errs)}`,
  };
}

// ===================================================================
// シナリオ6: リアルターン再生中(busy=true)に神の手でHPを直接0にする
// ghRenderSideの各リスナー(~4416+)はbusyガード無し(事前確認済み)。「実際に何が起きるか」を観測する。
// ===================================================================
async function s6(page){
  await freshBattle(page);
  await page.evaluate(() => { if (!labAI.opp) document.getElementById('lab-ai-opp').click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); }
    const s = document.getElementById('msg-speed'); if (s){ s.value = '600'; s.dispatchEvent(new Event('change')); }
  });
  await page.evaluate(() => { const t = document.getElementById('gh-toggle'); if (t && document.getElementById('gh-body').style.display === 'none') t.click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { const b = document.querySelector('#moves button[data-i]'); if (b) b.click(); });
  const becameBusy = await waitUntil(page, () => busy === true, 4000);
  const applied = await page.evaluate(() => {
    const slider = document.querySelector('#gh-self .gh-row[data-idx=""] .gh-hp');
    if (!slider) return false;
    slider.value = '0';
    slider.dispatchEvent(new Event('input'));
    return true;
  });
  const liveFaintedDuringBusy = await page.evaluate(() => S.sides.self.fainted === true && busy === true);
  for (let i = 0; i < 10 && await page.evaluate(() => busy); i++){ await page.evaluate(() => advanceMsg()); await page.waitForTimeout(250); }
  const busyCleared = await waitUntil(page, () => !busy, 10000);
  const interactable = await waitUntil(page, () => {
    const m = document.getElementById('moves'), p = document.getElementById('party'), rc = document.getElementById('c-revive-continue');
    return (m && m.style.display === 'flex') || (p && p.style.display === 'flex') || (rc && rc.style.display !== 'none') || gameOver;
  }, 8000);
  const finalState = await page.evaluate(() => ({
    fainted: S.sides.self.fainted, labChoicePending, gameOver,
    partyDisplay: document.getElementById('party').style.display,
    movesDisplay: document.getElementById('moves').style.display,
    rcDisplay: document.getElementById('c-revive-continue') ? document.getElementById('c-revive-continue').style.display : '(なし)',
  }));
  const nb = await canStartNewBattle(page);
  const errs = page._errors.slice();
  const pass = becameBusy && applied && liveFaintedDuringBusy && busyCleared && interactable && nb.ok && errs.length === 0;
  return {
    pass,
    detail: `becameBusy=${becameBusy} applied=${applied} liveFaintedDuringBusy(replay中に即fainted=true)=${liveFaintedDuringBusy} ` +
      `busyCleared=${busyCleared} interactable(詰みでないか)=${interactable} finalState=${JSON.stringify(finalState)} newBattle=${JSON.stringify(nb)} errors=${JSON.stringify(errs)}`,
  };
}

// ===================================================================
// シナリオ7: リアルターン再生中(busy=true)に言語切替
// ===================================================================
async function s7(page){
  await freshBattle(page);
  await page.evaluate(() => { if (!labAI.opp) document.getElementById('lab-ai-opp').click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = false; a.dispatchEvent(new Event('change')); } });
  await page.evaluate(() => { const b = document.querySelector('#moves button[data-i]'); if (b) b.click(); });
  const becameBusy = await waitUntil(page, () => busy === true, 4000);
  const switched = await page.evaluate(async () => {
    if (window.I18N && I18N.setLang){ await I18N.setLang('en'); return true; }
    return false;
  });
  await page.waitForTimeout(400);
  const postSwitch = await page.evaluate(() => ({
    lang: window.I18N && I18N.lang, busy,
    msgboxText: (document.querySelector('#msgbox') || {}).textContent || '',
  }));
  for (let i = 0; i < 10 && await page.evaluate(() => busy); i++){ await page.evaluate(() => advanceMsg()); await page.waitForTimeout(200); }
  const busyCleared = await waitUntil(page, () => !busy, 8000);
  const interactable = await waitUntil(page, () =>
    document.getElementById('moves').style.display === 'flex' || document.getElementById('party').style.display === 'flex', 8000);
  await page.evaluate(async () => { if (window.I18N && I18N.setLang) await I18N.setLang('ja'); });
  await page.waitForTimeout(300);
  const nb = await canStartNewBattle(page);
  const errs = page._errors.slice();
  const pass = becameBusy && switched && postSwitch.busy === true && busyCleared && interactable && nb.ok && errs.length === 0;
  return {
    pass,
    detail: `becameBusy=${becameBusy} switched=${switched} postSwitch=${JSON.stringify(postSwitch)} busyCleared=${busyCleared} ` +
      `interactable=${interactable} newBattle=${JSON.stringify(nb)} errors=${JSON.stringify(errs)}`,
  };
}

// ===================================================================
// シナリオ8: 全滅選択中(labChoicePending)の「↩1手もどす」ボタン=表示されるが死んでいる疑い
// updateLabUndoButton(~4196)はlabChoicePendingを見ない(表示条件=labUndoSnap&&in-battle&&!gameOver)。
// labUndoTurn(~4202)はlabChoicePendingをガードする=クリックしても無反応のはず。
// ===================================================================
async function s8(page){
  await freshBattle(page);
  await page.evaluate(() => { if (!labAI.opp) document.getElementById('lab-ai-opp').click(); });
  await page.waitForTimeout(150);
  await page.evaluate(() => { const b = document.querySelector('#moves button[data-i]'); if (b) b.click(); });
  await waitUntil(page, () => !busy && document.getElementById('moves').style.display === 'flex', 15000);
  const hadUndoSnap = await page.evaluate(() => !!labUndoSnap);
  await page.evaluate(() => {
    S.sides.self.currentHp = 0; S.sides.self.fainted = true;
    (S.sides.self.bench || []).forEach(e => { if (e && e.poke){ e.currentHp = 0; e.fainted = true; } });
    labForcedQueue = ['self'];
    labRunForcedQueue();
  });
  const reached = await waitUntil(page, () => labChoicePending === true, 8000);
  const preState = await page.evaluate(() => ({
    undoBtnVisible: document.getElementById('lab-undo-btn').style.display !== 'none',
    labUndoSnap: !!labUndoSnap,
    labChoicePending,
  }));
  await page.evaluate(() => document.getElementById('lab-undo-btn').click());
  await page.waitForTimeout(300);
  const postState = await page.evaluate(() => ({
    labChoicePending, labUndoSnap: !!labUndoSnap,
    partyDisplay: document.getElementById('party').style.display,
    rcDisplay: document.getElementById('c-revive-continue').style.display,
  }));
  const errs = page._errors.slice();
  const noBreak = postState.labChoicePending === true && errs.length === 0;   // ガードが効いていれば状態は変わらない
  await page.evaluate(() => document.getElementById('c-revive-continue').click());
  await waitUntil(page, () => document.getElementById('party').style.display === 'flex', 8000);
  // 全員ひんし(控えも全滅させた)なので選べる非ひんしスロットは無い。場の子(data-i=-1)を♻ふっかつすると
  // M4(battle_lab.html:3707-3714)により交代不要と判定され、labRunForcedQueue()経由で自動的に技画面へ戻る。
  const picked = await page.evaluate(() => {
    const b = document.querySelector('.sw-mine .slot.dead .sw-revive[data-i="-1"]');
    if (b){ b.click(); return true; } return false;
  });
  const backToMoves = await waitUntil(page, () => !busy && document.getElementById('moves').style.display === 'flex', 10000);
  const nb = await canStartNewBattle(page);
  // ★2026-07-21修正後の期待: 全滅選択中(labChoicePending)はundoボタンが「非表示」になる
  // (updateLabUndoButtonに!labChoicePending条件を追加済み)。クリック相当も無反応・状態破壊なしを維持。
  const pass = hadUndoSnap && reached && !preState.undoBtnVisible && preState.labUndoSnap && noBreak &&
    picked && backToMoves && nb.ok && errs.length === 0;
  return {
    pass,
    detail: `【観測】labChoicePending中の undoボタン表示=${preState.undoBtnVisible}(期待=false・S8修正済み)。` +
      `postState=${JSON.stringify(postState)}。hadUndoSnap=${hadUndoSnap} reached=${reached} ` +
      `preState=${JSON.stringify(preState)} picked=${picked} backToMoves=${backToMoves} newBattle=${JSON.stringify(nb)} errors=${JSON.stringify(errs)}`,
  };
}

// ===================================================================
// シナリオ9: メガ進化→KO→♻ふっかつ = labRevive(~3354)はentry.poke/megaBase/megaUsedを触らない
// →復帰後もメガ姿のまま固定される疑い(canMegaEvolveはmegaUsed=trueで塞がれるので再メガ自体は防がれるはず)。
// ===================================================================
async function s9(page){
  await freshBattle(page);
  const megaInfo = await page.evaluate(() => {
    const okE = !!S.megaEvolve('self');
    return { ok: okE, nameAfter: S.sides.self.poke.name, megaUsed: !!S.sides.self.megaUsed, item: S.sides.self.item };
  });
  if (!megaInfo.ok) return { pass: false, detail: 'メガシンカ自体に失敗(S.megaEvolveがfalse): ' + JSON.stringify(megaInfo) };
  await page.evaluate(() => {
    S.sides.self.currentHp = 0; S.sides.self.fainted = true;
    (S.sides.self.bench || []).forEach(e => { if (e && e.poke){ e.currentHp = 0; e.fainted = true; } });
    labForcedQueue = ['self'];
    labRunForcedQueue();
  });
  const reached = await waitUntil(page, () => labChoicePending === true, 8000);
  await page.evaluate(() => document.getElementById('c-revive-continue').click());
  const partyShown = await waitUntil(page, () => document.getElementById('party').style.display === 'flex', 8000);
  const reviveClicked = await page.evaluate(() => {
    const b = document.querySelector('.sw-mine .slot.dead .sw-revive[data-i="-1"]');
    if (b){ b.click(); return true; } return false;
  });
  await page.waitForTimeout(400);
  const afterRevive = await page.evaluate(() => ({
    name: S.sides.self.poke.name,
    isMegaForm: S.sides.self.poke.name.indexOf('メガ') === 0,
    megaUsed: !!S.sides.self.megaUsed,
    canReMega: !!S.canMegaEvolve(S.sides.self),
    fainted: S.sides.self.fainted,
    currentHp: S.sides.self.currentHp,
  }));
  const backToPlay = await waitUntil(page, () => !busy &&
    (document.getElementById('moves').style.display === 'flex' || document.getElementById('party').style.display === 'flex'), 10000);
  const nb = await canStartNewBattle(page);
  const errs = page._errors.slice();
  // 厳密な不変条件=二重メガ阻止(canReMega===false)/生存/エラー0/新バトル可。
  // フォーム復帰(isMegaForm===false)は「実機で正しいはずの挙動」として計測はするがFAIL原因は別途detailで明示する。
  const noDoubleMega = !afterRevive.canReMega;
  const pass = reached && partyShown && reviveClicked && noDoubleMega && !afterRevive.fainted && !afterRevive.isMegaForm &&
    backToPlay && nb.ok && errs.length === 0;
  return {
    pass,
    detail: `megaInfo=${JSON.stringify(megaInfo)} reached=${reached} partyShown=${partyShown} reviveClicked=${reviveClicked} ` +
      `afterRevive=${JSON.stringify(afterRevive)} (isMegaForm=trueなら復帰後もメガ姿のまま=フォーム復帰していないバグ。noDoubleMega=${noDoubleMega}は再メガ阻止できているか) ` +
      `backToPlay=${backToPlay} newBattle=${JSON.stringify(nb)} errors=${JSON.stringify(errs)}`,
  };
}

// ===================================================================
// シナリオ10: あばれ(げきりん相当)ロック中にundo→showActionUI/showCmdの
// setTimeout(()=>doTurn(null),450)(battle_lab.html:3115,3126)はハンドル未保存=キャンセル不能。
// undo後のlabBeginTurn()呼び出し(labUndoTurn末尾)が「もう1本」同種タイマーを積み、
// 両方が実弾(executeTurn)を撃つと1回のundoから2ターン分が走る「二重発火」になる疑い。
// ===================================================================
async function s10(page){
  await freshBattle(page);
  await page.evaluate(() => {
    const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); }
    const s = document.getElementById('msg-speed'); if (s){ s.value = '500'; s.dispatchEvent(new Event('change')); }
  });
  await page.evaluate(() => {
    window.__doTurnCalls = 0; window.__executeTurnCalls = 0;
    const _dt = doTurn, _et = executeTurn;
    window.doTurn = function(){ window.__doTurnCalls++; return _dt.apply(this, arguments); };
    window.executeTurn = function(){ window.__executeTurnCalls++; return _et.apply(this, arguments); };
  });
  const setupInfo = await page.evaluate(() => {
    S.sides.opp.currentHp = S.realStat(S.sides.opp, 'hp');   // 相手満タン=この後の被弾で終局しないように
    const usable = S.usableMoves(S.sides.self.poke);
    const mv = usable.find(m => m.category !== '変化') || usable[0];
    if (!mv) return { ok: false };
    S.sides.self.rampage = { move: mv, left: 3, noConfusion: true };   // あばれロック(左3=turn1後も継続する)
    S.sides.self.selectedMoveIdx = 0;
    S.sides.opp.selectedMoveIdx = 0;
    return { ok: true, moveName: mv.name };
  });
  if (!setupInfo.ok) return { pass: false, detail: '自分の使用可能技が見つからずrampageを注入できない(セットアップ失敗)' };
  await page.evaluate(() => executeTurn());   // turn1: rampage.moveで実行(left 3→2)
  const t1Done = await waitUntil(page, () => !busy, 10000);
  const afterT1 = await page.evaluate(() => ({
    rampageLeft: S.sides.self.rampage && S.sides.self.rampage.left,
    turnNo, executeTurnCalls: window.__executeTurnCalls,
    selfFainted: S.sides.self.fainted, oppFainted: S.sides.opp.fainted,
  }));
  // ここで自然経路のshowActionUI()が既に setTimeout(doTurn(null),450) を1本仕込んでいるはず(timerA)。
  // 即座にundoでlabBeginTurn()経由のtimerBを重ねる(決定的=busy===falseになった直後を狙う。上のwaitUntilで既に保証)。
  await page.evaluate(() => document.getElementById('lab-undo-btn').click());
  const undoConsumedSnap = await page.evaluate(() => !labUndoSnap);
  // 両タイマー(約450ms)の実弾を見極めるための固定待機(タイマー自体がsetTimeoutなので状態ポーリングに置き換え不能な領域。
  // ただし短めに抑え、後続の「正当な多段あばれ継続」との混同を避ける=timerA/timerBの452ms前後だけを見る)。
  await page.waitForTimeout(1500);
  await waitUntil(page, () => !busy, 8000);
  const finalState = await page.evaluate(() => ({
    doTurnCalls: window.__doTurnCalls, executeTurnCalls: window.__executeTurnCalls,
    turnNo, gameOver, labChoicePending, busy,
    selfFainted: S.sides.self.fainted, oppFainted: S.sides.opp.fainted,
  }));
  const uiSane = await waitUntil(page, () =>
    document.getElementById('moves').style.display === 'flex' || document.getElementById('party').style.display === 'flex' || finalState.gameOver, 8000);
  const nb = await canStartNewBattle(page);
  const errs = page._errors.slice();
  // 不変条件: 1回のundoクリックから実際に走った追加ターン(executeTurn実弾)は高々1つまで(=busyガードで
  // もう1本は無効化されているのが正しい)。2つ以上実弾が出たら「1回のundoで2ターン分消費」の二重発火。
  const noDoubleFire = finalState.executeTurnCalls <= 2;   // 1(turn1) + 1(undo後の正当な継続) まで許容
  const pass = afterT1.rampageLeft > 0 && noDoubleFire && uiSane && nb.ok && errs.length === 0;
  return {
    pass,
    detail: `setupInfo=${JSON.stringify(setupInfo)} afterT1=${JSON.stringify(afterT1)} undoConsumedSnap=${undoConsumedSnap} ` +
      `finalState=${JSON.stringify(finalState)}(executeTurnCalls>=3なら二重発火の疑い濃厚。2は「undo後にあばれが正当に1回自動継続」の想定内) ` +
      `noDoubleFire=${noDoubleFire} uiSane=${uiSane} newBattle=${JSON.stringify(nb)} errors=${JSON.stringify(errs)}`,
  };
}

// ===================================================================
async function main(){
  let httpProc = null;
  const already = await pingServer();
  if (!already){
    console.log('[setup] python3 -m http.server ' + PORT + ' を起動します…');
    httpProc = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: REPO_DIR, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 30 && !ready; i++){ await new Promise(r => setTimeout(r, 300)); ready = await pingServer(); }
    if (!ready){ console.error('[setup] サーバ起動確認できず。中止。'); process.exit(2); }
  } else {
    console.log('[setup] 既存のサーバ(port ' + PORT + ')を使用します。');
  }

  const browser = await chromium.launch();
  const scenarios = [
    ['S1 replay中に退出→新バトル(busy残留の疑い・exitBattleToSetup ~2521)', s1],
    ['S2 強制交代画面(swForced)で退出→新バトル(swForced/RB_PIVOT残留の疑い ~2534)', s2],
    ['S3 全滅選択中の退出→c-revive-continueリスナー二重化の疑い(showLabGameOverChoice ~5439)', s3],
    ['S4 replay中に「＋ついか」ピッカー(openBattlePicker busy/swForcedガード無し ~2328)', s4],
    ['S5 replay中にAIトグル連打(250msポーラーlabAIResyncTimerの競合 ~4158)', s5],
    ['S6 リアルターン再生中に神の手でHP=0(ghRenderSide busyガード無し ~4416)', s6],
    ['S7 バトル中に言語切替(sayQueue/msgbox再翻訳の競合)', s7],
    ['S8 全滅選択中の「↩1手もどす」ボタン(表示条件と動作条件の不一致疑い ~4196/4202)', s8],
    ['S9 メガ進化→KO→♻ふっかつ(labRevive ~3354はpoke/megaBaseを戻さない疑い)', s9],
    ['S10 あばれロック中undo→UI自動続行の二重発火(showActionUI ~3125のsetTimeout未保存)', s10],
  ];

  for (const [name, fn] of scenarios){
    console.log('\n--- ' + name + ' ---');
    // eslint-disable-next-line no-await-in-loop
    await runScenario(browser, name, fn);
  }

  await browser.close();
  if (httpProc) httpProc.kill();

  const fails = results.filter(r => !r.pass);
  console.log('\n==== ADVERSARIAL SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' PASS ====');
  results.forEach(r => console.log((r.pass ? '✅' : '❌') + ' ' + r.name));
  if (fails.length){
    console.log('\n---- FAIL詳細 ----');
    fails.forEach(r => { console.log('❌ ' + r.name); console.log('   ' + r.detail); });
  }
  console.log('\nスクリーンショット保存先: ' + SHOT_DIR);
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('ADVERSARIAL HARNESS ERROR', e); process.exit(2); });
