/* 共通: real_battle_simulator.html の実エンジンを Node の vm でそのまま読み込む(sim無改変・単一ソース)。
 * _sim_test.js(テスト) と _sim_probe.js(全技観測) で共有。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// 決定論PRNG(mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// DOM/ブラウザの吸収プロキシ: あらゆる get/呼び出しを飲み込み例外を出さない
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

// エンジン関数群を取り出して返す
function buildEngine() {
  const data = require(path.join(ROOT, process.env.PCHAM_DATA || 'pokechan_data.js'));   // ★T4: PCHAM_DATA env var で差替可能(未指定=従来)
  const html = fs.readFileSync(path.join(ROOT, 'real_battle_simulator.html'), 'utf8');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
    .filter(s => s.includes('function calcDamage') || s.includes('function runTurn'));
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
  const expose = `\n;try {
    // DOMContentLoadedはvmでは発火しない → ITEM_BY_KEY(道具の逆引き)を手で詰める(段94で判明)
    if (typeof ITEM_BY_KEY !== 'undefined' && window.ITEMS_DATABASE && Array.isArray(window.ITEMS_DATABASE.items)){
      window.ITEMS_DATABASE.items.forEach(it=>{ ITEM_BY_KEY[it.key] = it; });
    }
    // POKE_MAP_BY_NAME(名前→ポケモン逆引き)も同じ理由で手詰め(段117=メガシンカで判明)
    if (typeof POKE_MAP_BY_NAME !== 'undefined' && typeof POKEMON_LIST !== 'undefined'){
      POKEMON_LIST.forEach(p=>{ POKE_MAP_BY_NAME[p.name] = p; });
    }
    if (typeof registerVirtualItems === 'function') registerVirtualItems();   // 汎用メガストーン
    if (typeof renderBoth==='function') renderBoth = function(){};
    if (typeof renderBattleLog==='function') renderBattleLog = function(){};
    if (typeof render==='function') render = function(){};
    if (typeof renderMoves==='function') renderMoves = function(){};
    if (typeof updateUndoButton==='function') updateUndoButton = function(){};
  } catch(e){}
  ;globalThis.__engine = (function(){ try { return {
    sides, env, LEVEL, calcDamage, realStat, rankedStat, makeSideState, runTurn,
    decideOrder, phaseHitCheck, phaseDealDamage, phaseApplyEffects, phaseSlipFor, battleLog,
    runSingleAttack: (typeof runSingleAttack !== 'undefined') ? runSingleAttack : null,
    attemptSwitch: (typeof attemptSwitch !== 'undefined') ? attemptSwitch : null,
    aiChooseMove: (typeof aiChooseMove !== 'undefined') ? aiChooseMove : null,
    phaseInitA: (typeof phaseInitA !== 'undefined') ? phaseInitA : null,
    initPP: (typeof initPP !== 'undefined') ? initPP : null,
    aiChooseAction: (typeof aiChooseAction !== 'undefined') ? aiChooseAction : null,
    aiScoreMove: (typeof aiScoreMove !== 'undefined') ? aiScoreMove : null,
    megaEvolve: (typeof megaEvolve !== 'undefined') ? megaEvolve : null,
    resetBattle: (typeof resetBattle !== 'undefined') ? resetBattle : null,
    effectiveSpeed: (typeof effectiveSpeed !== 'undefined') ? effectiveSpeed : null,
    variablePower: (typeof variablePower !== 'undefined') ? variablePower : null,
    TEST_POKEMON: (typeof TEST_POKEMON !== 'undefined') ? TEST_POKEMON : null,
    usableMoves: (typeof usableMoves !== 'undefined') ? usableMoves : null,
    dummyAbilityList: (typeof dummyAbilityList !== 'undefined') ? dummyAbilityList : null,
    moveTypeEff: (typeof moveTypeEff !== 'undefined') ? moveTypeEff : null,
    sideTypes: (typeof sideTypes !== 'undefined') ? sideTypes : null,
    sideAbility: (typeof sideAbility !== 'undefined') ? sideAbility : null,
    setLastMoveAnywhere: (typeof lastMoveAnywhere !== 'undefined') ? (m)=>{ lastMoveAnywhere = m || null; } : null,
    setRandom: (fn)=>{ Math.random = fn; },
  }; } catch(e){ globalThis.__engineErr = String(e&&e.stack||e); return null; } })();`;
  vm.runInContext(inline.join('\n') + expose, ctx, { filename: 'sim-inline.js' });
  if (!sandbox.__engine) throw new Error('エンジン公開に失敗: ' + sandbox.__engineErr);
  return sandbox.__engine;
}

module.exports = { buildEngine, mulberry32, absorber, ROOT };
