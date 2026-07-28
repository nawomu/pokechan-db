/* ばけのかわ(Disguise)仕様検証テスト(2026-07-27・検証担当)
 *
 * 目的: エンジン(real_battle_simulator.html)の「ばけのかわ」が権威仕様どおりに動くかを、
 *       エンジン無改変のまま node で駆動して確かめる(sim自己出力をゴールデンにしない)。
 *
 * 権威ソース(2026-07-27 WebFetchで実取得した実在引用のみ):
 * [W] ポケモンWiki日本語版 https://wiki.pokemonwiki.com/wiki/ばけのかわ
 *   ・「「ばけたすがた」のときに攻撃技を受けるとダメージを0にして「ばれたすがた」へとフォルムチェンジする」
 *   ・「第八世代からは最大HPの1/8を消費する (小数点以下切り捨て)」
 *   ・「「ばれたすがた」で交代しても「ばれたすがた」のまま戻らない」
 *   ・「連続攻撃技を受けた場合、ダメージは最初の1発目の分しか防げない」
 *   ・「かたやぶりの効果を持つ技に対しばけのかわは発動しない」
 *   ・「変化技に対しては発動しない」
 *   ・「こんらん時の自分への攻撃には発動し、ダメージを防ぐ。」
 * [B] Bulbapedia https://bulbapedia.bulbagarden.net/wiki/Disguise_(Ability)
 *   ・"If a Mimikyu in its Disguised Form is hit by a damaging move or hits itself in confusion,
 *      Disguise prevents the move from calling the damage formula."
 *   ・"When a Disguised Form Mimikyu's Disguise is busted, upon changing to its Busted Form it now
 *      loses HP equal to 1/8 of its maximum HP, rounded down."
 *   ・"Mimikyu remains in Busted Form if it is switched out, but reverts to Disguised Form outside of battle."
 *   ・"Disguise activates at the first strike of a multistrike move such as Water Shuriken and will
 *      not block damage from remaining strikes."
 *   ・"Pokémon with Mold Breaker, Teravolt, or Turboblaze will ignore Disguise, hitting through the
 *      disguise without busting it."
 *   ・"Disguise will not protect against status moves, entry hazards, or weather damage."
 *
 * 実行: cd "/Users/masamichi/Documents/ポケモンDB" && node tools/_spec_disguise_test.js
 * 方式: tools/_sim_hard_interaction_test.js と同じ buildEngine() 読み込みパターン。
 *       エンジン・既存ハーネスは一切編集しない(このファイルのみ新規)。
 */
'use strict';
const path = require('path');
const { buildEngine, moveByChampKey, pokeByName: pokeByNameHelper, ROOT } = require('./_sim_engine.js');
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
  if (!s.poke) throw new Error('存在しないポケモン: ' + pokeName);
  const keys = Array.isArray(moveKeys) ? moveKeys : [moveKeys];
  s.moves = keys.map(k => moveByKey(k));
  if (s.moves.some(m => !m)) throw new Error('存在しない技: ' + keys.join(','));
  s.selectedMoveIdx = 0;
  s.ability = (opts.ability !== undefined) ? opts.ability : (s.poke.ab1 || '');
  s.item = opts.item || '';
  s.currentHp = E.realStat(s, 'hp');
  return s;
}
function benchEntry(pokeName, moveKey) {
  return { poke: pokeByName(pokeName), effort: {hp:0,atk:0,def:0,spatk:0,spdef:0,spd:0},
    natureIdx: 0, ability: '', item: '', moves: [moveByKey(moveKey)],
    currentHp: null, fainted: false, status: 'none', sleepTurns: null };
}
function resetEnv() {
  E.env.weather = 'none'; E.env.weatherTurns = null;
  E.env.field = 'none';   E.env.fieldTurns = null;
  E.env.doubleBattle = false; E.env.trickRoom = false; E.env.trickRoomTurns = null;
  E.env.gravity = false; E.env.gravityTurns = null;
  if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
  E.battleLog.length = 0;
}
const logCount = re => E.battleLog.filter(e => re.test(e.msg)).length;

// 乱数固定: 0.5=命中(acc90でも当たる)・非急所・乱数中間。ケースごとに差し替え
E.setRandom(() => 0.5);

// ─────────────────────────────────────────────
// C1: 基本動作 — 初撃無効+最大HP1/8チップ(切り捨て)+2発目は素通し
// 期待値の出典: [W]「ダメージを0にして…フォルムチェンジ」「第八世代からは最大HPの1/8を消費する(小数点以下切り捨て)」
//              [B]"loses HP equal to 1/8 of its maximum HP, rounded down"
// ─────────────────────────────────────────────
console.log('\n=== C1: 基本動作(初撃無効+1/8チップ+2発目素通し) ===');
{
  resetEnv();
  const atk = freshSide('カイロス', 'naminori', { ability: '' });
  const def = freshSide('ミミッキュ', 'hataku');   // ab1=ばけのかわ
  E.sides.self = atk; E.sides.opp = def;
  E.phaseInitA();
  const maxHp = E.realStat(def, 'hp');
  const chip = Math.floor(maxHp / 8);   // 出典: [W]小数点以下切り捨て(実HPで1/8<1になることはない)
  check('C1-a 場出しで皮をまとう(disguise=true)', def.disguise === true, `disguise=${def.disguise}`);

  E.setRandom(() => 0.5);
  E.runSingleAttack('self', 0);   // なみのり(単発・特殊)
  check('C1-b 初撃は技ダメージ0+最大HP1/8だけ減る(HP = max - floor(max/8))',
    def.currentHp === maxHp - chip,
    `currentHp=${def.currentHp} 期待=${maxHp - chip} (max=${maxHp} chip=${chip})`);
  check('C1-c 皮が剥がれた状態になる(disguise=false, disguiseBroken=true)',
    def.disguise === false && def.disguiseBroken === true,
    `disguise=${def.disguise} disguiseBroken=${def.disguiseBroken}`);

  const hpBefore2 = def.currentHp;
  E.runSingleAttack('self', 0);   // 2発目
  check('C1-d 剥がれた後の2発目は通常ダメージが入る(チップ以外のHP減少)',
    def.currentHp < hpBefore2 && logCount(/ばけのかわで \d+ ダメージ/) === 1,
    `hpBefore=${hpBefore2} hpAfter=${def.currentHp} chipLog=${logCount(/ばけのかわで \d+ ダメージ/)}`);
}

// ─────────────────────────────────────────────
// C2: 連続技 — 1発目のみブロック・2発目以降は通常ダメージ
// 期待値の出典: [W]「連続攻撃技を受けた場合、ダメージは最初の1発目の分しか防げない」
//              [B]"Disguise activates at the first strike of a multistrike move ... will not block
//                  damage from remaining strikes"
// ダブルウイング=固定2発(effects: 連続攻撃 hits:2)・ひこう(ゴースト/フェアリーに等倍)を使用
// ─────────────────────────────────────────────
console.log('\n=== C2: 連続技(1発目のみブロック) ===');
{
  resetEnv();
  const atk = freshSide('カイロス', 'daburuuingu', { ability: '' });
  const def = freshSide('ミミッキュ', 'hataku');
  E.sides.self = atk; E.sides.opp = def;
  E.phaseInitA();
  const maxHp = E.realStat(def, 'hp');
  const chip = Math.floor(maxHp / 8);
  E.setRandom(() => 0.5);   // acc90命中・非急所
  E.runSingleAttack('self', 0);
  const lost = maxHp - def.currentHp;
  check('C2-a 1発目はブロック(はがれたログ1回)+チップ1/8',
    logCount(/ばけのかわが はがれた/) === 1 && logCount(/ばけのかわで \d+ ダメージ/) === 1,
    `はがれた=${logCount(/ばけのかわが はがれた/)} chipLog=${logCount(/ばけのかわで \d+ ダメージ/)}`);
  check('C2-b 2発目は通常ダメージが入る(総HP減少がチップより大きい)',
    lost > chip, `lost=${lost} chip=${chip} maxHp=${maxHp}`);
  check('C2-c 剥がれ状態が確定している(disguise=false, disguiseBroken=true)',
    def.disguise === false && def.disguiseBroken === true,
    `disguise=${def.disguise} disguiseBroken=${def.disguiseBroken}`);
}

// ─────────────────────────────────────────────
// C3: per-battleフラグ — 剥がれたら交代しても戻らない
// 期待値の出典: [W]「「ばれたすがた」で交代しても「ばれたすがた」のまま戻らない」
//              [B]"Mimikyu remains in Busted Form if it is switched out"
// ─────────────────────────────────────────────
console.log('\n=== C3: 交代しても皮は戻らない(per-battle) ===');
{
  resetEnv();
  const atk = freshSide('カイロス', 'naminori', { ability: '' });
  const mim = freshSide('ミミッキュ', 'hataku');
  mim.bench = [benchEntry('ピカチュウ', 'hataku')];
  E.sides.self = atk; E.sides.opp = mim;
  E.phaseInitA();
  E.setRandom(() => 0.5);
  E.runSingleAttack('self', 0);   // 皮を剥がす
  check('C3-a 前提: 皮が剥がれた', mim.disguise === false && mim.disguiseBroken === true,
    `disguise=${mim.disguise} disguiseBroken=${mim.disguiseBroken}`);

  E.sides.self = mim; E.sides.opp = atk;
  E.attemptSwitch('self', 0);   // ピカチュウへ交代(ミミッキュは控えへ)
  E.attemptSwitch('self', 0);   // ミミッキュを場に戻す
  check('C3-b 再登場しても皮は戻らない(disguise=false のまま)',
    mim.poke.name.indexOf('ミミッキュ') === 0 && mim.disguise === false && mim.disguiseBroken === true,
    `poke=${mim.poke && mim.poke.name} disguise=${mim.disguise} disguiseBroken=${mim.disguiseBroken}`);

  const hpBefore = mim.currentHp;
  E.sides.self = atk; E.sides.opp = mim;
  E.runSingleAttack('self', 0);   // 再登場後の被弾
  check('C3-c 再登場後の被弾は通常ダメージ(再ブロックも二重チップも無い)',
    mim.currentHp < hpBefore && logCount(/ばけのかわで \d+ ダメージ/) === 1,
    `hpBefore=${hpBefore} hpAfter=${mim.currentHp} chipLog=${logCount(/ばけのかわで \d+ ダメージ/)}`);
}

// ─────────────────────────────────────────────
// C4: かたやぶり — 貫通して通常ダメージ・皮は消費されない(剥がれない・チップ無し)
// 期待値の出典: [W]「かたやぶりの効果を持つ技に対しばけのかわは発動しない」
//              [B]"Pokémon with Mold Breaker, Teravolt, or Turboblaze will ignore Disguise,
//                  hitting through the disguise without busting it"
// ─────────────────────────────────────────────
console.log('\n=== C4: かたやぶり貫通(皮は消費されない) ===');
{
  resetEnv();
  const atk = freshSide('カイロス', 'naminori', { ability: 'かたやぶり' });
  const def = freshSide('ミミッキュ', 'hataku');
  E.sides.self = atk; E.sides.opp = def;
  E.phaseInitA();
  const maxHp = E.realStat(def, 'hp');
  E.setRandom(() => 0.5);
  E.runSingleAttack('self', 0);
  check('C4-a かたやぶりの攻撃は通常ダメージが入る(HPが減る)',
    def.currentHp < maxHp, `currentHp=${def.currentHp} maxHp=${maxHp}`);
  check('C4-b 皮は消費されない(disguise=true のまま・剥がれログ/チップログ無し)',
    def.disguise === true && def.disguiseBroken !== true &&
    logCount(/ばけのかわ/) === 0,
    `disguise=${def.disguise} disguiseBroken=${def.disguiseBroken} 皮関連ログ=${logCount(/ばけのかわ/)}`);
}

// ─────────────────────────────────────────────
// C5: 変化技 — ばけのかわは発動しない(技の効果はそのまま通る・皮は残る)
// 期待値の出典: [W]「変化技に対しては発動しない」
//              [B]"Disguise will not protect against status moves"
// ─────────────────────────────────────────────
console.log('\n=== C5: 変化技には発動しない ===');
{
  resetEnv();
  const atk = freshSide('カイロス', 'denjiha', { ability: '' });   // でんじは(変化・acc90)
  const def = freshSide('ミミッキュ', 'hataku');
  E.sides.self = atk; E.sides.opp = def;
  E.phaseInitA();
  const maxHp = E.realStat(def, 'hp');
  E.setRandom(() => 0.5);
  E.runSingleAttack('self', 0);
  check('C5-a 変化技では皮は剥がれずHPも減らない',
    def.disguise === true && def.currentHp === maxHp && logCount(/ばけのかわ/) === 0,
    `disguise=${def.disguise} currentHp=${def.currentHp}/${maxHp} 皮関連ログ=${logCount(/ばけのかわ/)}`);
  check('C5-b 変化技の効果自体は通る(でんじは→まひ)',
    def.status === 'paralysis', `status=${def.status}`);
}

// ─────────────────────────────────────────────
// C6: こんらん自傷 — ばけのかわが発動してダメージを防ぐ(両wiki一致)
// 期待値の出典: [W]「こんらん時の自分への攻撃には発動し、ダメージを防ぐ。」
//              [B]"If a Mimikyu in its Disguised Form is hit by a damaging move or hits itself in
//                  confusion, Disguise prevents the move from calling the damage formula."
// 期待: 自傷ダメージは防がれ、皮が剥がれる(第8世代仕様に合わせるならチップ1/8のみ減る)。
//       少なくとも「素の自傷ダメージがそのまま入る+皮が残る」は仕様違反。
// ─────────────────────────────────────────────
console.log('\n=== C6: こんらん自傷はばけのかわが防ぐ ===');
{
  resetEnv();
  const mim = freshSide('ミミッキュ', 'hataku');
  const opp = freshSide('カビゴン', 'tsuruginomai', { ability: '' });   // 相手は自分対象の変化技のみ(干渉しない)
  E.sides.self = mim; E.sides.opp = opp;
  E.phaseInitA();
  const maxHp = E.realStat(mim, 'hp');
  const chip = Math.floor(maxHp / 8);
  mim.confusion = 2;   // こんらん状態(残2ターン)
  E.setRandom(() => 0.2);   // 0.2 < 1/3 → こんらん自傷が必ず発生
  E.runTurn();
  const selfHitHappened = logCount(/わけもわからず じぶんを こうげきした/) === 1;
  check('C6-a 前提: こんらん自傷が発生した', selfHitHappened, `battleLog自傷行=${selfHitHappened}`);
  // 権威仕様: 自傷は防がれ皮が剥がれる → HP減少は素の自傷ダメージではなくチップ(1/8)のみ、disguise=false
  check('C6-b [W]「こんらん時の自分への攻撃には発動し、ダメージを防ぐ」— 自傷ダメージは0(HP減少はチップ1/8のみ)+皮が剥がれる',
    mim.disguise === false && mim.disguiseBroken === true && mim.currentHp === maxHp - chip,
    `disguise=${mim.disguise} disguiseBroken=${mim.disguiseBroken} currentHp=${mim.currentHp} 期待=${maxHp - chip}(max=${maxHp})`);
}

// ─────────────────────────────────────────────
console.log('\n========================================');
console.log(`結果: pass=${pass} fail=${fail} (total=${pass + fail})`);
if (fails.length) { console.log('FAIL一覧:'); fails.forEach(f => console.log('  ✗ ' + f)); }
process.exit(fail ? 1 : 0);
