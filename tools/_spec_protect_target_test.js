/* 検証(spec test): まもる(protecting)が「自分対象(target:自分)」の技をブロックしてしまうか(実証用)
 * 目的: 権威コーパス(reference/_authority_flags.json・出典 wiki.pokemonwiki.com)全数照合で見つかった
 *   「target(範囲)誤登録48件・protect誤登録122件」の疑いについて、コード読みだけで断定せず、
 *   実際にエンジン(real_battle_simulator.html)を動かして実害があるか確かめる(CLAUDE.md investigate-carefully-not-guess)。
 *
 * 対象技: かたくなる(Harden・authority range=自分・authority protect=×)。
 *   このデータは Champions(pokechan_data.js)には存在しない(全国版のみ=data=all/pokechan_data_all.js)ため、
 *   PCHAM_DATA=pokechan_data_all.js でエンジンを読み込む(tools/_sim_engine.jsのPCHAM_DATA差替機構=T4)。
 *
 * 実機コード(real_battle_simulator.html:7213/5911)は:
 *   if (_protBefore && mv.protect === true && protectBlocks(_protBefore, mv) && !_protPierce){ ... ブロック ... }
 *   protectBlocks() (L3693)は mv.target を一切見ない → mv.protect===true の技は「自分」対象でもブロック対象になる構造。
 *
 * 実行: cd "/Users/masamichi/Documents/ポケモンDB" && PCHAM_DATA=pokechan_data_all.js node tools/_spec_protect_target_test.js
 */
'use strict';
const path = require('path');
process.env.PCHAM_DATA = process.env.PCHAM_DATA || 'pokechan_data_all.js';
const { buildEngine, mulberry32, ROOT, moveByChampKey, pokeByName: pokeByNameHelper } = require('./_sim_engine.js');
const data = require(path.join(ROOT, process.env.PCHAM_DATA));

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; fails.push(name + (detail ? '  → ' + detail : '')); console.log('  ❌ ' + name + (detail ? '  → ' + detail : '')); }
}

const E = buildEngine();
function moveByName(n) {
  const list = Object.values(data.WAZA_MAP || {});
  return list.find(m => m.name === n) || null;
}
function pokeByName(n) { return pokeByNameHelper(data, n); }

function freshSide(pokeName, mv, opts) {
  opts = opts || {};
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  if (!s.poke) throw new Error('存在しないポケモン(全部版): ' + pokeName);
  s.moves = [mv];
  s.selectedMoveIdx = 0;
  s.ability = (opts.ability !== undefined) ? opts.ability : (s.poke.ab1 || '');
  if (opts.item !== undefined) s.item = opts.item;
  return s;
}
function fullHp(s) { const max = E.realStat(s, 'hp'); s.currentHp = max; return max; }
function resetEnv() {
  E.env.weather = 'none'; E.env.weatherTurns = null;
  E.env.field = 'none';   E.env.fieldTurns = null;
  E.env.doubleBattle = false; E.env.trickRoom = false; E.env.trickRoomTurns = null;
  E.env.gravity = false; E.env.gravityTurns = null;
  E.env.wonderRoom = false; E.env.wonderRoomTurns = null;
  E.env.magicRoom = false; E.env.magicRoomTurns = null;
  if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
}

// ─────────────────────────────────────────────
console.log('\n=== データ確認: かたくなる(Harden)の現状値(pokechan_data_all.js) ===');
const mamoru = moveByName('まもる');
const katakunaru = moveByName('かたくなる');
console.log('  まもる:', mamoru && { name: mamoru.name, protect: mamoru.protect, target: mamoru.target });
console.log('  かたくなる:', katakunaru && { name: katakunaru.name, protect: katakunaru.protect, target: katakunaru.target });
check('前提: まもるが存在する', !!mamoru);
check('前提: かたくなるが存在する(全部版のみ・Championsには無い)', !!katakunaru);
check('修正後: かたくなるはprotect:false(reference/_authority_target_protect_fix.json適用済・出典wiki.pokemonwiki.com)',
  katakunaru && katakunaru.protect === false,
  `protect=${katakunaru && katakunaru.protect}`);

// ─────────────────────────────────────────────
// ★2026-07-28実証ログ(修正前・記録として残す): 修正前は mv.protect===true のままだったため、
//   このP1と全く同じ手順(相手がまもる中に自分がかたくなるを撃つ)で実際に
//   「相手の◯◯は まもる で こうげきを 防いだ！」がログに出て、ぼうぎょランクが上がらなかった(実バグを実証)。
//   修正後の今は不発せずランクが+1上がることを固定回帰テストとして確認する(再発防止)。
console.log('\n=== P1: 相手がまもる中に自分がかたくなる(自分強化技)を使ったら実際どうなるか(修正後=回帰防止) ===');
try {
  resetEnv();
  const atk = freshSide('ピカチュウ', katakunaru, { ability: '' });
  const def = freshSide('カビゴン', mamoru, { ability: '' });
  fullHp(atk); fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  def.protecting = mamoru;   // 相手はまもるで守りの体勢に入っている(H22方式のブリッジ)
  const beforeDef = atk.rank.def || 0;
  E.battleLog.length = 0;
  E.setRandom(mulberry32(1));
  // 実機と同一の呼び出し経路(runSingleAttack)で1手実行する。
  atk.selectedMoveIdx = 0;
  E.runSingleAttack('self', 0);
  const blockedLine = E.battleLog.some(ev => /で こうげきを 防いだ/.test(ev.msg));
  const afterDef = atk.rank.def || 0;
  console.log('  battleLog:', E.battleLog.map(e => e.msg));
  console.log(`  防御ランク: 実行前=${beforeDef} 実行後=${afterDef} ブロック行=${blockedLine}`);
  check('P1 [回帰防止] 相手のまもる中に自分強化技(かたくなる)を使ってもブロックされず、ぼうぎょランクが+1上がる',
    blockedLine === false && afterDef === beforeDef + 1,
    `blockedLine=${blockedLine} beforeDef=${beforeDef} afterDef=${afterDef}`);
} catch (e) { check('P1 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== P2(対照): protect:falseに直したかたくなるなら同条件でブロックされないことを確認 ===');
try {
  resetEnv();
  const fixedKatakunaru = Object.assign({}, katakunaru, { protect: false });
  const atk = freshSide('ピカチュウ', fixedKatakunaru, { ability: '' });
  const def = freshSide('カビゴン', mamoru, { ability: '' });
  fullHp(atk); fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  def.protecting = mamoru;
  const beforeDef = atk.rank.def || 0;
  E.battleLog.length = 0;
  E.setRandom(mulberry32(1));
  atk.selectedMoveIdx = 0;
  E.runSingleAttack('self', 0);
  const blockedLine = E.battleLog.some(ev => /で こうげきを 防いだ/.test(ev.msg));
  const afterDef = atk.rank.def || 0;
  console.log('  battleLog:', E.battleLog.map(e => e.msg));
  check('P2 [対照実験] protect:falseに直すとブロックされず、ぼうぎょランクが+1上がる(=修正の効果を確認)',
    blockedLine === false && afterDef === beforeDef + 1,
    `blockedLine=${blockedLine} beforeDef=${beforeDef} afterDef=${afterDef}`);
} catch (e) { check('P2 実行', false, e.message); }

// ─────────────────────────────────────────────
// ★2026-07-28(権威コーパス全919技照合タスクC): エンジン構造的ガードの実証。
//   real_battle_simulator.html の protectBlocks()(L3693)に targetsSelfOrAllyOnly() チェックを追加し、
//   target(範囲)が 自分/味方の場/全体の場/味方系 の「変化技」は、データのprotect値に関わらず
//   相手のまもるでブロックされないようにした(「データが正しければ起きない」バグの二重化)。
//   P3はデータを意図的に壊して(かたくなるのprotectをtrueに強制上書き=修正前と同じ壊れた値)も、
//   ガードだけでブロックされないことを確認する(データ側の正しさに依存しない防御であることの証明)。
console.log('\n=== P3: データを意図的に壊しても(target=自分の変化技にprotect:trueを強制)エンジンのガードでブロックされない ===');
try {
  resetEnv();
  const corruptedKatakunaru = Object.assign({}, katakunaru, { protect: true });   // ★意図的にデータを壊す(修正前の実バグ状態を再現)
  check('前提: 意図的に壊したデータはprotect:true(まもるチェックを通ればブロックされてしまう状態)', corruptedKatakunaru.protect === true);
  const atk = freshSide('ピカチュウ', corruptedKatakunaru, { ability: '' });
  const def = freshSide('カビゴン', mamoru, { ability: '' });
  fullHp(atk); fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  def.protecting = mamoru;
  const beforeDef = atk.rank.def || 0;
  E.battleLog.length = 0;
  E.setRandom(mulberry32(1));
  atk.selectedMoveIdx = 0;
  E.runSingleAttack('self', 0);
  const blockedLine = E.battleLog.some(ev => /で こうげきを 防いだ/.test(ev.msg));
  const afterDef = atk.rank.def || 0;
  console.log('  battleLog:', E.battleLog.map(e => e.msg));
  check('P3 [構造的ガード実証] protect:trueに壊されたデータでも、target=自分の変化技はエンジンのガードでブロックされず、ぼうぎょランクが+1上がる',
    blockedLine === false && afterDef === beforeDef + 1,
    `blockedLine=${blockedLine} beforeDef=${beforeDef} afterDef=${afterDef}`);
} catch (e) { check('P3 実行', false, e.message); }

// ─────────────────────────────────────────────
// ★P4(例外の確認・過剰適用していないことの証明): がまん(Bide)は target=自分 だが category=物理。
//   自分に宣言してから2ターン目に受けたダメージの2倍を「相手」へ返す技で、実際の攻撃は相手を対象にしており、
//   権威コーパス(reference/_authority_flags.json「がまん」)でも まもる:○(ブロックされる)。
//   もしガードが「target=自分なら無条件でブロックしない」という単純すぎる実装だったら、
//   がまんまで誤って無敵になってしまう(過剰適用のバグ)。targetsSelfOrAllyOnly/protectBlocksを直接呼び、
//   category==='変化' 限定のガードになっていること(がまんは対象外のまま)を確認する。
console.log('\n=== P4: がまん(target=自分・category=物理)はガードの対象外(過剰適用していないことの確認) ===');
try {
  const gaman = moveByName('がまん');
  check('前提: がまんが存在する', !!gaman);
  check('前提: がまんはtarget=自分', gaman && gaman.target === '自分', `target=${gaman && gaman.target}`);
  check('前提: がまんはcategory=物理(変化技ではない)', gaman && gaman.category === '物理', `category=${gaman && gaman.category}`);
  check('前提: がまんは権威由来でprotect=true(まもるで防げる。reference/_authority_corpus/moves/がまん.json)',
    gaman && gaman.protect === true, `protect=${gaman && gaman.protect}`);
  check('targetsSelfOrAllyOnly(がまん) === false(category=物理なのでガードの対象外)',
    typeof E.targetsSelfOrAllyOnly === 'function' && E.targetsSelfOrAllyOnly(gaman) === false);
  const dummyProtectMove = { battle_data: { effects: [{ kind: 'まもり' }] } };
  check('protectBlocks(まもる中, がまん) === true(通常どおりブロック対象=ガードが過剰適用していない)',
    typeof E.protectBlocks === 'function' && E.protectBlocks(dummyProtectMove, gaman) === true);
  // 対照: 同じtarget=自分でもcategory=変化(かたくなる)ならガード対象になることも合わせて確認
  check('targetsSelfOrAllyOnly(かたくなる) === true(category=変化・target=自分なのでガード対象)',
    typeof E.targetsSelfOrAllyOnly === 'function' && E.targetsSelfOrAllyOnly(katakunaru) === true);
  check('protectBlocks(まもる中, かたくなる) === false(ガードでブロックされない)',
    typeof E.protectBlocks === 'function' && E.protectBlocks(dummyProtectMove, katakunaru) === false);
} catch (e) { check('P4 実行', false, e.message); }

// ===== 結果 =====
console.log('\n========================================');
console.log(`結果: pass=${pass} fail=${fail}`);
if (fails.length) { console.log('失敗:'); fails.forEach(f => console.log('  ・' + f)); }
process.exit(fail ? 1 : 0);
