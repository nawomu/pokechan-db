/* 技ターン検証テスト環境（設計: TEST_ENV_DESIGN_技ターン検証.md）
 * 方式: real_battle_simulator.html の実エンジンを Node の vm でそのまま実行（sim無改変・単一ソース）。
 *       DOM/window は吸収プロキシでダミー化し、エンジン関数(calcDamage/runTurn 等)を取り出して検証する。
 * 実行: node tools/_sim_test.js   （全件pass=exit0 / 1件でもfail=exit1 → /goal の合否に使う）
 * 段階(設計§3): ①追加効果なし純粋攻撃 → ②状態異常 → ③能力ランク → ④優先度/素早さ → ⑤天候/フィールド
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const data = require(path.join(ROOT, 'pokechan_data.js')); // S1で追加した export

// --- 決定論PRNG（mulberry32）。Math.random をこれに差し替えて再現性を担保 ---
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- DOM/ブラウザの吸収プロキシ: あらゆる get/呼び出しを飲み込み、例外を出さない ---
function absorber() {
  const target = function () {};
  const p = new Proxy(target, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive || prop === Symbol.iterator) return undefined;
      if (prop === 'length') return 0;
      if (prop === 'value' || prop === 'textContent' || prop === 'innerHTML') return '';
      if (prop === 'checked') return false;
      if (prop === 'forEach' || prop === 'map' || prop === 'filter') return () => [];
      return p;
    },
    set() { return true; }, apply() { return p; }, construct() { return p; }, has() { return true; },
  });
  return p;
}

// real_battle_simulator.html の実エンジンを vm で読み込み、エンジン関数群を返す
function buildEngine() {
  const html = fs.readFileSync(path.join(ROOT, 'real_battle_simulator.html'), 'utf8');
  const allInline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const inline = allInline.filter(s => s.includes('function calcDamage') || s.includes('function runTurn'));
  const itemsSrc = fs.readFileSync(path.join(ROOT, 'items_database.js'), 'utf8');

  const noop = () => {};
  const win = {
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    matchMedia: () => absorber(), getComputedStyle: () => absorber(),
    scrollTo: noop, requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout: noop,
    alert: noop, confirm: () => true, prompt: () => '',
  };
  const sandbox = Object.assign({}, data, {
    window: win, document: absorber(), confirm: () => true, alert: () => {}, prompt: () => '',
    console, navigator: {}, location: absorber(), addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout: noop,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, dataLayer: [],
  });
  win.window = win; Object.assign(win, data); sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  vm.runInContext(itemsSrc, ctx, { filename: 'items_database.js' });
  // 描画系(DOM依存)は no-op に差し替え（テストでは描画不要・ロジックのみ検証）。function宣言は再代入可。
  const expose = `\n;try {
    if (typeof renderBoth==='function') renderBoth = function(){};
    if (typeof renderBattleLog==='function') renderBattleLog = function(){};
    if (typeof render==='function') render = function(){};
    if (typeof renderMoves==='function') renderMoves = function(){};
    if (typeof updateUndoButton==='function') updateUndoButton = function(){};
  } catch(e){}
  ;globalThis.__engine = (function(){ try { return {
    sides, env, LEVEL, calcDamage, realStat, rankedStat, makeSideState, runTurn,
    decideOrder, phaseHitCheck, phaseDealDamage, phaseApplyEffects,
    setRandom: (fn)=>{ Math.random = fn; },
  }; } catch(e){ globalThis.__engineErr = String(e&&e.stack||e); return null; } })();`;
  vm.runInContext(inline.join('\n') + expose, ctx, { filename: 'sim-inline.js' });
  if (!sandbox.__engine) throw new Error('エンジン公開に失敗: ' + sandbox.__engineErr);
  return sandbox.__engine;
}

// ===== 軽量テストランナー =====
let pass = 0, fail = 0; const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; fails.push(name); console.log('  ❌ ' + name + (detail ? '  → ' + detail : '')); }
}

const E = buildEngine();
const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
function freshSide(pokeName, moveKey) {
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  s.moves = moveKey ? [data.WAZA_MAP[moveKey]] : [];
  s.selectedMoveIdx = 0;
  return s;
}
function resetEnv() { E.env.weather = 'none'; E.env.field = 'none'; E.env.doubleBattle = false; E.env.trickRoom = false; }

console.log('=== 段① 追加効果なしの純粋攻撃技（はたく: ノーマル物理40） ===');
// 受けは「ノーマル等倍」になるタイプ。フシギバナ(くさ/どく)はノーマル技を等倍で受ける。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  const move = data.WAZA_MAP.hataku;

  // T1: calcDamage が健全（等倍・無効でない・min>0・min<=max・HP未満）
  const r = E.calcDamage('self', 'opp', move);
  check('T1 calcDamageが結果を返す', !!r, 'null');
  check('T1 無効でない(等倍)', r && !r.immune, r && r.reason);
  check('T1 ダメージ>0 かつ min<=max', r && r.min > 0 && r.min <= r.max, r && `min=${r.min} max=${r.max}`);
  check('T1 ダメージ < 相手HP(40威力なので一撃ではない)', r && r.max < r.hp, r && `max=${r.max} hp=${r.hp}`);
  check('T1 現状ゴールデン値 min=16 max=19', r && r.min === 16 && r.max === 19, r && `min=${r.min} max=${r.max}`);

  // T2: 「左が技→右が食らう」単発フロー(phaseDealDamage)。決定論seedで1値に確定。
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260608));
  const hp0 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = hp0;
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.phaseDealDamage('self', 'opp', move);
  const dealt = hp0 - E.sides.opp.currentHp;
  check('T2 右のHPが減った', E.sides.opp.currentHp < hp0, `hp0=${hp0} now=${E.sides.opp.currentHp}`);
  check('T2 減少量が計算範囲[16,19]内', dealt >= 16 && dealt <= 19, `dealt=${dealt}`);
  check('T2 余計な状態異常が付いていない', E.sides.opp.status === 'none', E.sides.opp.status);
  check('T2 余計なランク変化なし', Object.values(E.sides.opp.rank).every(v => v === 0), JSON.stringify(E.sides.opp.rank));
  check('T2 自分は反動等で減っていない(単発攻撃)', E.sides.self.currentHp === E.realStat(E.sides.self, 'hp'), `self=${E.sides.self.currentHp}`);
}

console.log('\n=== 段① マルチターン: 左→右 両者がはたく(runTurn・決定論) ===');
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260608));
  const selfHp0 = E.realStat(E.sides.self, 'hp');
  const oppHp0 = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check('T3 両者がはたくを撃ち、両者のHPが減った',
    E.sides.self.currentHp < selfHp0 && E.sides.opp.currentHp < oppHp0,
    `self ${selfHp0}->${E.sides.self.currentHp} / opp ${oppHp0}->${E.sides.opp.currentHp}`);
  check('T3 状態異常もランク変化も起きていない',
    E.sides.self.status === 'none' && E.sides.opp.status === 'none' &&
    Object.values(E.sides.self.rank).every(v => v === 0) && Object.values(E.sides.opp.rank).every(v => v === 0));
}

console.log(`\n=== 結果: ${pass} pass / ${fail} fail ===`);
if (fail) { console.log('失敗:', fails.join(' / ')); process.exit(1); }
console.log('✅ 全件パス');
process.exit(0);
