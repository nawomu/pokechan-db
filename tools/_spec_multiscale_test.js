/* 特性「マルチスケイル」仕様検証テスト(検証担当・2026-07-27)
 *
 * 目的: real_battle_simulator.html のマルチスケイル実装(段: calcDamage 3.75節・約L1977-1984 /
 *       かたやぶり無視リスト _BREAKABLE L3451 / 連続技per-hit再評価 L2995-3008)が権威仕様どおりかを
 *       エンジン無改変のまま node で駆動して確かめる。simの自己出力をゴールデンにしない
 *       (バトル再現_羅針盤.md)。期待値は全て下記の権威ソースの記述から導出。
 *
 * ★権威ソース(2026-07-27 WebFetchで実読・引用は実在文字列):
 *  [W] ポケモンWiki日本語版「マルチスケイル」(wiki.pokemonwiki.com/wiki/マルチスケイル):
 *      ・「HPが満タンの時に 受けるダメージが半減する」
 *      ・連続技:「各攻撃を受ける段階でHPが満タンであるなら、2発目以降のダメージであっても半減できる」
 *        (=判定はヒット毎。通常は1発目でHPが減るので実質1発目のみ半減)
 *      ・「かたやぶり効果を持つ技のダメージは半減しない」
 *      ・「ダメージ固定技のダメージは半減しない」
 *  [B] Bulbapedia "Multiscale (Ability)" (クロスチェック):
 *      ・"Multiscale reduces damage taken from damage-dealing moves by half when at maximum HP."
 *      ・"When hit with a multistrike move at maximum HP, only the first hit will have its
 *         damage reduced. All further hits deal full damage."
 *      ・"It does not reduce the amount of HP taken from moves that deal direct damage."
 *  [AS] Bulbapedia "Ability Shield" / items_database.js宣言(とくせいガード=かたやぶりの無視から保護)
 *
 * 実行: cd "/Users/masamichi/Documents/ポケモンDB" && node tools/_spec_multiscale_test.js
 * 流用元パターン: tools/_sim_hard_interaction_test.js / tools/_sim_engine.js
 */
'use strict';
const path = require('path');
const { buildEngine, mulberry32, ROOT, moveByChampKey, pokeByName: pokeByNameHelper } = require('./_sim_engine.js');
const data = require(path.join(ROOT, process.env.PCHAM_DATA || 'pokechan_data.js'));

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; fails.push(name + (detail ? '  → ' + detail : '')); console.log('  ❌ ' + name + (detail ? '  → ' + detail : '')); }
}

const E = buildEngine();
const pokeByName = n => pokeByNameHelper(data, n);
const moveByKey  = k => moveByChampKey(data, k);

function freshSide(pokeName, moveKeys, opts) {
  opts = opts || {};
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  if (pokeName && !s.poke) throw new Error('データに存在しないポケモン: ' + pokeName);
  const keys = Array.isArray(moveKeys) ? moveKeys : (moveKeys ? [moveKeys] : []);
  s.moves = keys.map(k => moveByKey(k));
  if (keys.length && s.moves.some(m => !m)) throw new Error('データに存在しない技: ' + keys.filter((k,i)=>!s.moves[i]).join(','));
  s.selectedMoveIdx = 0;
  if (opts.ability !== undefined) s.ability = opts.ability;
  else if (s.poke) s.ability = s.poke.ab1 || '';
  if (opts.item !== undefined) s.item = opts.item;
  return s;
}
function fullHp(s) { const max = E.realStat(s, 'hp'); s.currentHp = max; return max; }
function resetEnv() {
  E.env.weather = 'none'; E.env.weatherTurns = null;
  E.env.field = 'none'; E.env.fieldTurns = null;
  E.env.doubleBattle = false;
  E.env.trickRoom = false; E.env.trickRoomTurns = null;
  E.env.gravity = false; E.env.gravityTurns = null;
  E.env.wonderRoom = false; E.env.wonderRoomTurns = null;
  E.env.magicRoom = false; E.env.magicRoomTurns = null;
  if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hasMSChip = r => !!(r && r.chips && r.chips.some(c => c.label === 'マルチスケイル'));

// 共通セットアップ: カイリキー(はたく=ノーマル40・カイリューに等倍) → カイリュー
// マルチスケイル以外の変数を消すため attacker ability は明示的に無指定('')から始める。
function setup(atkAbility, defAbility, defItem) {
  resetEnv();
  const atk = freshSide('カイリキー', ['hataku', 'chikyuunage', 'daburuatakku'], { ability: atkAbility, item: '' });
  fullHp(atk);
  const def = freshSide('カイリュー', 'hataku', { ability: defAbility, item: defItem || '' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  return { atk, def };
}

// ── ベースライン(特性なし・満タン): 全ケースの「半減していない」基準値。
//    sim自身の出力だが「MSあり/なしの比較の物差し」としてのみ使う(期待の向き=権威ソース由来)。
const base0 = (() => { setup('', ''); return E.calcDamage('self', 'opp', moveByKey('hataku')); })();
console.log(`\n[基準] カイリキー はたく → カイリュー(特性なし・満タン): min=${base0.min} max=${base0.max}`);

// ─────────────────────────────────────────────
// C1: 基本動作 — HP満タンで被ダメ半減
// 期待の出典 [W]「HPが満タンの時に 受けるダメージが半減する」/ [B] "reduces damage ... by half when at maximum HP"
// 期待値: 特性なし基準の約0.5倍(×0.5は基礎値に pokeRound(base,2048) で掛かるため、後段のfloor連鎖で
//         最終値は厳密な half と±数残る → max比 0.45〜0.55 で判定) + 補正チップに マルチスケイル が載る。
// ─────────────────────────────────────────────
console.log('\n=== C1: HP満タンで半減 [出典: ポケモンWiki「マルチスケイル」/ Bulbapedia "Multiscale"] ===');
try {
  setup('', 'マルチスケイル');
  const r = E.calcDamage('self', 'opp', moveByKey('hataku'));
  const ratio = r && base0.max > 0 ? r.max / base0.max : null;
  check('C1-a 満タン時のダメージが特性なしの約半分(max比0.45〜0.55)',
    ratio !== null && ratio >= 0.45 && ratio <= 0.55,
    `MSあり max=${r && r.max} 特性なし max=${base0.max} ratio=${ratio}`);
  check('C1-b 補正チップに マルチスケイル(factor 0.5)が載っている',
    hasMSChip(r) && r.chips.find(c => c.label === 'マルチスケイル').factor === 0.5,
    `chips=${JSON.stringify(r && r.chips)}`);
} catch (e) { check('C1 実行', false, String(e && e.message || e)); }

// ─────────────────────────────────────────────
// C2: HPが満タンでなければ半減しない
// 期待の出典 [W]「HPが満タンの時に」(=満タンでない時は発動しない。1でも減っていれば対象外)
// 期待値: currentHp = max-1 で、特性なし基準と 16変動値が完全一致・チップなし。
// ─────────────────────────────────────────────
console.log('\n=== C2: 満タンでない時は半減しない [出典: ポケモンWiki「マルチスケイル」] ===');
try {
  const { def } = setup('', 'マルチスケイル');
  def.currentHp = E.realStat(def, 'hp') - 1;
  const r = E.calcDamage('self', 'opp', moveByKey('hataku'));
  check('C2-a HPが1でも減っていると特性なしと完全一致(16変動値ぜんぶ)',
    r && eq(r.variations, base0.variations),
    `MS(欠けHP) max=${r && r.max} 特性なし max=${base0.max}`);
  check('C2-b マルチスケイルのチップが載らない', !hasMSChip(r), `chips=${JSON.stringify(r && r.chips)}`);
} catch (e) { check('C2 実行', false, String(e && e.message || e)); }

// ─────────────────────────────────────────────
// C3: 連続技 — 判定はヒット毎(1発目半減・1発目でHPが減った2発目は等倍)
// 期待の出典 [W]「各攻撃を受ける段階でHPが満タンであるなら、2発目以降のダメージであっても半減できる」
//           (=ヒット毎にHP満タンかを再評価。1発目がダメージを与えた後の2発目は満タンでない→等倍)
//           [B] "only the first hit will have its damage reduced. All further hits deal full damage."
// 期待値: ダブルアタック(固定2ヒット)で、1発目∈[半減時の16変動値]、2発目∈[1発目被弾後HPでの等倍16変動値]。
//         期待集合はどちらも権威仕様(満タン→半減/非満タン→等倍)から状態を作って導出。
// ─────────────────────────────────────────────
console.log('\n=== C3: 連続技はヒット毎判定 [出典: ポケモンWiki「マルチスケイル」/ Bulbapedia "Multiscale"] ===');
try {
  const { def } = setup('', 'マルチスケイル');
  const maxHp = E.realStat(def, 'hp');
  // 期待集合A: 満タン+MS → 半減された変動値(=1発目にありうる値)
  const setA = E.calcDamage('self', 'opp', moveByKey('daburuatakku')).variations.slice();
  // 期待集合B(候補): 1発目の各候補ダメージ後のHPで再計算した等倍変動値の和集合(=2発目にありうる値)
  const setB = new Set();
  for (const d1 of new Set(setA)) {
    def.currentHp = maxHp - d1;
    E.calcDamage('self', 'opp', moveByKey('daburuatakku')).variations.forEach(v => setB.add(v));
  }
  // 実行: 満タンに戻して実際に連続技を撃つ
  def.currentHp = maxHp;
  E.battleLog.length = 0;
  E.setRandom(mulberry32(1));   // H11実績シード(2ヒットとも命中・非急所)
  E.phaseDealDamage('self', 'opp', moveByKey('daburuatakku'));
  const dmgs = E.battleLog.filter(e => e.multiHit === true)
    .map(e => { const m = /に (\d+) ダメージ/.exec(e.msg); return m ? Number(m[1]) : null; });
  check('C3-a 2ヒットとも命中している(前提)', dmgs.length === 2 && dmgs.every(d => d != null),
    `dmgs=${JSON.stringify(dmgs)}`);
  if (dmgs.length === 2) {
    check('C3-b 1発目は半減値(満タン+MSの変動値のどれか)', setA.includes(dmgs[0]),
      `hit1=${dmgs[0]} 半減候補=${JSON.stringify([...new Set(setA)].sort((a,b)=>a-b))}`);
    check('C3-c 2発目は等倍値(1発目被弾後HPでの非半減変動値のどれか)', setB.has(dmgs[1]),
      `hit2=${dmgs[1]} 等倍候補=${JSON.stringify([...setB].sort((a,b)=>a-b))}`);
    check('C3-d 2発目/1発目 ≒ 2(1.5〜2.5)', dmgs[0] > 0 && dmgs[1] / dmgs[0] >= 1.5 && dmgs[1] / dmgs[0] <= 2.5,
      `hit1=${dmgs[0]} hit2=${dmgs[1]} ratio=${dmgs[1] / dmgs[0]}`);
  }
} catch (e) { check('C3 実行', false, String(e && e.message || e)); }

// ─────────────────────────────────────────────
// C4: かたやぶりで無効
// 期待の出典 [W]「かたやぶり効果を持つ技のダメージは半減しない」
// 期待値: 攻撃側かたやぶり・防御側マルチスケイル満タンでも、特性なし基準と16変動値が完全一致・チップなし。
// (かたやぶり自体にダメージ補正は無い=Bulbapedia "Mold Breaker" なので完全一致が正しい期待)
// ─────────────────────────────────────────────
console.log('\n=== C4: かたやぶりで無効 [出典: ポケモンWiki「マルチスケイル」/ Bulbapedia "Mold Breaker"] ===');
try {
  setup('かたやぶり', 'マルチスケイル');
  const r = E.calcDamage('self', 'opp', moveByKey('hataku'));
  check('C4-a かたやぶり相手には満タンでも半減しない(特性なし基準と完全一致)',
    r && eq(r.variations, base0.variations),
    `かたやぶり時 max=${r && r.max} 基準 max=${base0.max}`);
  check('C4-b マルチスケイルのチップが載らない', !hasMSChip(r), `chips=${JSON.stringify(r && r.chips)}`);
} catch (e) { check('C4 実行', false, String(e && e.message || e)); }

// ─────────────────────────────────────────────
// C5: とくせいガードを持つとかたやぶりでも半減が生きる(境界)
// 期待の出典 [AS] Bulbapedia "Ability Shield"(持ち主の特性は無視されない)+items_database.js宣言
// 期待値: C1と同じく約半分+チップあり。
// ─────────────────────────────────────────────
console.log('\n=== C5: とくせいガード × かたやぶり [出典: Bulbapedia "Ability Shield"] ===');
try {
  setup('かたやぶり', 'マルチスケイル', 'ability_shield');
  const r = E.calcDamage('self', 'opp', moveByKey('hataku'));
  const ratio = r && base0.max > 0 ? r.max / base0.max : null;
  check('C5 とくせいガード装備なら かたやぶり相手でも半減(max比0.45〜0.55+チップあり)',
    ratio !== null && ratio >= 0.45 && ratio <= 0.55 && hasMSChip(r),
    `max=${r && r.max} 基準=${base0.max} ratio=${ratio} chips=${JSON.stringify(r && r.chips)}`);
} catch (e) { check('C5 実行', false, String(e && e.message || e)); }

// ─────────────────────────────────────────────
// C6: 固定ダメージ技は半減しない
// 期待の出典 [W]「ダメージ固定技のダメージは半減しない」/ [B] "does not reduce the amount of HP taken
//           from moves that deal direct damage."
// 期待値: ちきゅうなげ(固定=使用者のレベル分。champions_amount=50)がマルチスケイル満タンの
//         カイリューにそのまま50入る(半減で25にならない)。
// ─────────────────────────────────────────────
console.log('\n=== C6: 固定ダメージは半減しない [出典: ポケモンWiki「マルチスケイル」/ Bulbapedia "Multiscale"] ===');
try {
  const { atk, def } = setup('', 'マルチスケイル');
  const maxHp = def.currentHp;
  atk.selectedMoveIdx = 1;   // chikyuunage
  E.setRandom(mulberry32(2));
  E.phaseDealDamage('self', 'opp', moveByKey('chikyuunage'));
  const loss = maxHp - def.currentHp;
  check('C6 ちきゅうなげ=50がそのまま入る(25に半減しない)', loss === 50,
    `loss=${loss} (期待50・半減バグなら25)`);
} catch (e) { check('C6 実行', false, String(e && e.message || e)); }

// ===== 結果 =====
console.log('\n========================================');
console.log(`マルチスケイル仕様テスト: ${pass} passed / ${fail} failed`);
if (fails.length) { console.log('失敗:'); fails.forEach(f => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
