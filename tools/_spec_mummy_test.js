/* ミイラ(Mummy)仕様検証テスト(2026-07-27・検証担当)
 * 目的: 「ミイラ」がエンジン(real_battle_simulator.html 3127-3138行)で権威仕様どおりに動くかを、
 *       エンジン無改変のまま node(vm)で駆動して確かめる。
 * ★エンジンは絶対に修正しない。落ちたケース=エンジン実挙動と権威仕様の不一致(=収穫)。
 *   sim自身の出力をゴールデンにしない(バトル再現_羅針盤.md)。
 *
 * 権威ソース(2026-07-27 WebFetchで実読・引用は実在文字列):
 *  [W] ポケモンWiki日本語版「ミイラ」 https://wiki.pokemonwiki.com/wiki/ミイラ
 *      - "直接攻撃でダメージを受けたとき、相手の特性をミイラにする。"
 *      - "かたやぶりの効果がある直接攻撃に対してもミイラは発動する。"
 *      - "直接攻撃の連続攻撃技を受けた場合、1発目の攻撃でミイラになったと表示される。"
 *  [B] Bulbapedia "Mummy (Ability)" https://bulbapedia.bulbagarden.net/wiki/Mummy_(Ability)
 *      - "When a Pokémon with Mummy is hit by a contact move, the attacker's Ability is changed to Mummy."
 *      - "As One, Battle Bond, Comatose, Commander, Disguise, Gulp Missile, Ice Face, Lingering Aroma,
 *         Multitype, Power Construct, RKS System, Schooling, Shields Down, Stance Change, Zen Mode,
 *         Zero to Hero, and Mummy itself are not affected by Mummy."
 *        (★この除外リストに ふしぎなまもり(Wonder Guard)・なまけ(Truant)は入っていない=ミイラで上書きされる)
 *      - "If a Pokémon with this Ability is hit by a multistrike move that makes contact (such as Fury
 *         Swipes), the attacking Pokémon's Ability will become Mummy after the first strike."
 *      - "The attacker regains its original Ability once it is switched out, faints, or the battle ends."
 *
 * 実行: cd "/Users/masamichi/Documents/ポケモンDB" && node tools/_spec_mummy_test.js
 * 読み込みパターンは tools/_sim_hard_interaction_test.js / tools/_sim_engine.js を流用。
 */
'use strict';
const path = require('path');
const { buildEngine, mulberry32, ROOT, moveByChampKey, pokeByName: pokeByNameHelper } = require('./_sim_engine.js');
const data = require(path.join(ROOT, process.env.PCHAM_DATA || 'pokechan_data.js'));

let pass = 0, fail = 0, skip = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; fails.push(name + (detail ? '  → ' + detail : '')); console.log('  ❌ ' + name + (detail ? '  → ' + detail : '')); }
}
function skipCase(id, reason) { skip++; console.log('  ⚪ SKIP: ' + id + '  (' + reason + ')'); }

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
  if (keys.length && s.moves.some(m => !m)) throw new Error('データに存在しない技: ' + keys.filter((k, i) => !s.moves[i]).join(','));
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
// 共通セットアップ: 攻撃側(ability/item指定)が ミイラ持ちカビゴン に指定技を1発撃つ
function hitMummy(atkName, atkAbility, moveKey, opts) {
  opts = opts || {};
  resetEnv();
  const atk = freshSide(atkName, moveKey, { ability: atkAbility, item: opts.item || '' });
  fullHp(atk);
  const def = freshSide(opts.defName || 'カビゴン', 'hataku', { ability: opts.defAbility !== undefined ? opts.defAbility : 'ミイラ' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(mulberry32(opts.seed || 20260727));
  const logStart = E.battleLog.length;
  E.phaseDealDamage('self', 'opp', moveByKey(moveKey));
  const newLogs = E.battleLog.slice(logStart).map(e => e.msg).join(' / ');
  return { atk, def, newLogs };
}

// ─────────────────────────────────────────────
// C1: 基本動作 — 直接攻撃を受けたら攻撃側の特性がミイラになる
// 出典[W]: "直接攻撃でダメージを受けたとき、相手の特性をミイラにする。"
// 出典[B]: "the attacker's Ability is changed to Mummy."
// ─────────────────────────────────────────────
console.log('\n=== C1: 基本動作(直接攻撃→攻撃側がミイラ化) [出典: ポケモンWiki「ミイラ」/Bulbapedia Mummy] ===');
try {
  const { atk, newLogs } = hitMummy('カイリキー', 'かいりきバサミ', 'hataku');
  check('C1-a 接触技を撃った側の特性がミイラに書き換わる(sideAbility)',
    E.sideAbility(atk) === 'ミイラ', `sideAbility=${E.sideAbility(atk)}`);
  check('C1-b 書き換えは一時上書き(abilityOverride)で元特性(st.ability)は保持',
    atk.abilityOverride === 'ミイラ' && atk.ability === 'かいりきバサミ',
    `override=${atk.abilityOverride} ability=${atk.ability}`);
  check('C1-c ミイラ化のログ行が出る',
    /ミイラに なった/.test(newLogs), `logs=${newLogs}`);
} catch (e) { skipCase('C1', e.message); }

// ─────────────────────────────────────────────
// C2: 非接触技では発動しない
// 出典[W]: "直接攻撃でダメージを受けたとき"(=直接攻撃限定)
// 出典[B]: "hit by a contact move"(10まんボルトは非接触: Bulbapedia "Thunderbolt" contact=No)
// ─────────────────────────────────────────────
console.log('\n=== C2: 非接触技では発動しない [出典: 同上(直接攻撃限定)] ===');
try {
  const mv = moveByKey('10manboruto');
  if (mv.contact) throw new Error('前提崩れ: 10まんボルトが contact=true になっている');
  const { atk } = hitMummy('カイリキー', 'かいりきバサミ', '10manboruto');
  check('C2 非接触技(10まんボルト)では特性は変わらない',
    E.sideAbility(atk) === 'かいりきバサミ' && atk.abilityOverride === null,
    `sideAbility=${E.sideAbility(atk)} override=${atk.abilityOverride}`);
} catch (e) { skipCase('C2', e.message); }

// ─────────────────────────────────────────────
// C3: 攻撃側がすでにミイラなら発動しない(ミイラ自身は対象外)
// 出典[B]: "... and Mummy itself are not affected by Mummy."
// 攻撃側=デスカーン(ab1=ミイラ・マスターDB実データ)
// ─────────────────────────────────────────────
console.log('\n=== C3: ミイラ×ミイラ(自身は対象外) [出典: Bulbapedia Mummy] ===');
try {
  const dk = pokeByName('デスカーン');
  if (!dk || dk.ab1 !== 'ミイラ') throw new Error('前提崩れ: デスカーンのab1がミイラでない');
  const { atk, newLogs } = hitMummy('デスカーン', 'ミイラ', 'hataku');
  check('C3 ミイラ持ちが攻撃してもミイラ化の再発動なし(overrideも立たない)',
    atk.abilityOverride === null && !/ミイラに なった/.test(newLogs),
    `override=${atk.abilityOverride} logs=${newLogs}`);
} catch (e) { skipCase('C3', e.message); }

// ─────────────────────────────────────────────
// C4: 書き換え不可特性(バトルスイッチ=Stance Change / ばけのかわ=Disguise)は変わらない
// 出典[B]: 除外リストに "Disguise ... Stance Change" が明記
// ─────────────────────────────────────────────
console.log('\n=== C4: 書き換え不可特性(バトルスイッチ/ばけのかわ) [出典: Bulbapedia Mummy 除外リスト] ===');
try {
  const r1 = hitMummy('ギルガルド(シールド)', 'バトルスイッチ', 'hataku');
  check('C4-a バトルスイッチ(Stance Change)はミイラで上書きされない',
    E.sideAbility(r1.atk) === 'バトルスイッチ' && r1.atk.abilityOverride === null,
    `sideAbility=${E.sideAbility(r1.atk)} override=${r1.atk.abilityOverride}`);
  const r2 = hitMummy('ミミッキュ', 'ばけのかわ', 'hataku');
  check('C4-b ばけのかわ(Disguise)はミイラで上書きされない',
    E.sideAbility(r2.atk) === 'ばけのかわ' && r2.atk.abilityOverride === null,
    `sideAbility=${E.sideAbility(r2.atk)} override=${r2.atk.abilityOverride}`);
} catch (e) { skipCase('C4', e.message); }

// ─────────────────────────────────────────────
// C5: かたやぶり相手にも発動する(かたやぶり自体はミイラに上書きされる)
// 出典[W]: "かたやぶりの効果がある直接攻撃に対してもミイラは発動する。"
// (かたやぶりはBulbapedia除外リストに無い=上書きされる)
// ─────────────────────────────────────────────
console.log('\n=== C5: かたやぶり×ミイラ [出典: ポケモンWiki「ミイラ」] ===');
try {
  const { atk } = hitMummy('カイロス', 'かたやぶり', 'hataku');
  check('C5 かたやぶり持ちの直接攻撃でもミイラは発動し、かたやぶりがミイラに書き換わる',
    E.sideAbility(atk) === 'ミイラ' && atk.abilityOverride === 'ミイラ',
    `sideAbility=${E.sideAbility(atk)} override=${atk.abilityOverride}`);
} catch (e) { skipCase('C5', e.message); }

// ─────────────────────────────────────────────
// C6: 連続技(接触)でもミイラ化する(1発目から)
// 出典[W]: "直接攻撃の連続攻撃技を受けた場合、1発目の攻撃でミイラになったと表示される。"
// 出典[B]: "the attacking Pokémon's Ability will become Mummy after the first strike."
// 技=ダブルアタック(固定2ヒット・接触。H10と同じ)。最終状態=ミイラで判定(発ごとの内部タイミングは不可観測)
// ─────────────────────────────────────────────
console.log('\n=== C6: 連続技(接触)でミイラ化 [出典: ポケモンWiki「ミイラ」/Bulbapedia Mummy] ===');
try {
  const mv = moveByKey('daburuatakku');
  if (!mv.contact) throw new Error('前提崩れ: ダブルアタックが contact=false');
  const { atk } = hitMummy('カイリュー', 'せいしんりょく', 'daburuatakku');
  check('C6 接触連続技を撃った側も技の後にはミイラになっている',
    E.sideAbility(atk) === 'ミイラ', `sideAbility=${E.sideAbility(atk)}`);
} catch (e) { skipCase('C6', e.message); }

// ─────────────────────────────────────────────
// C7: 交代で元の特性に戻る
// 出典[B]: "The attacker regains its original Ability once it is switched out, faints, or the battle ends."
// ─────────────────────────────────────────────
console.log('\n=== C7: 交代で元の特性に戻る [出典: Bulbapedia Mummy] ===');
try {
  const { atk } = hitMummy('カイリキー', 'かいりきバサミ', 'hataku');
  if (E.sideAbility(atk) !== 'ミイラ') throw new Error('前提崩れ: C7開始時点でミイラ化していない');
  const benchMon = freshSide('ゲンガー', 'hataku', { ability: '' });
  fullHp(benchMon);
  atk.bench = [{ poke: benchMon.poke, effort: { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0 },
    natureIdx: 0, ability: '', item: '', moves: benchMon.moves,
    currentHp: benchMon.currentHp, fainted: false, status: 'none', sleepTurns: null }];
  const ok = E.attemptSwitch('self', 0);
  const packed = atk.bench[0];   // 交代で控え枠に戻ったカイリキー
  check('C7-a 交代後、控えに戻ったカイリキーの永続特性は元のまま(かいりきバサミ)',
    ok === true && packed && packed.poke && packed.poke.name === 'カイリキー' && packed.ability === 'かいりきバサミ',
    `ok=${ok} benchName=${packed && packed.poke && packed.poke.name} benchAbility=${packed && packed.ability}`);
  check('C7-b 場のスロットにミイラ上書き(abilityOverride)が残らない',
    atk.abilityOverride === null, `override=${atk.abilityOverride}`);
} catch (e) { skipCase('C7', e.message); }

// ─────────────────────────────────────────────
// C8: とくせいガード(Ability Shield)を持つ攻撃側は書き換えられない
// 出典: Bulbapedia "Ability Shield": "An item to be held by a Pokémon. This cutting-edge shield
//       protects the holder from having its Ability changed by others."(特性変更から守る)
// ─────────────────────────────────────────────
console.log('\n=== C8: とくせいガード所持は書き換え不可 [出典: Bulbapedia Ability Shield] ===');
try {
  const { atk } = hitMummy('カイリキー', 'かいりきバサミ', 'hataku', { item: 'ability_shield' });
  check('C8 とくせいガード所持の攻撃側はミイラ化しない',
    E.sideAbility(atk) === 'かいりきバサミ' && atk.abilityOverride === null,
    `sideAbility=${E.sideAbility(atk)} override=${atk.abilityOverride}`);
} catch (e) { skipCase('C8', e.message); }

// ─────────────────────────────────────────────
// C9: なまけ(Truant)はミイラで上書き「される」(除外リストに無い)
// 出典[B]: 除外リスト("As One, Battle Bond, Comatose, Commander, Disguise, Gulp Missile, Ice Face,
//          Lingering Aroma, Multitype, Power Construct, RKS System, Schooling, Shields Down,
//          Stance Change, Zen Mode, Zero to Hero, and Mummy itself")に Truant は含まれない。
// ※全部版DB(pokechan_data_all.js)にケッキング(なまけ)が実在=到達可能な組み合わせ。
// ─────────────────────────────────────────────
console.log('\n=== C9: なまけはミイラで上書きされる [出典: Bulbapedia Mummy 除外リスト(Truantなし)] ===');
try {
  const { atk } = hitMummy('カイリキー', 'なまけ', 'hataku');
  check('C9 なまけ持ちの攻撃側はミイラに書き換わる(権威仕様)',
    E.sideAbility(atk) === 'ミイラ', `sideAbility=${E.sideAbility(atk)} override=${atk.abilityOverride}`);
} catch (e) { skipCase('C9', e.message); }

// ─────────────────────────────────────────────
// C10: ふしぎなまもり(Wonder Guard)はミイラで上書き「される」(除外リストに無い)
// 出典[B]: 同上の除外リストに Wonder Guard は含まれない。
// ※全部版DB(pokechan_data_all.js)にヌケニン(ふしぎなまもり)が実在=到達可能な組み合わせ。
// ─────────────────────────────────────────────
console.log('\n=== C10: ふしぎなまもりはミイラで上書きされる [出典: Bulbapedia Mummy 除外リスト(Wonder Guardなし)] ===');
try {
  const { atk } = hitMummy('カイリキー', 'ふしぎなまもり', 'hataku');
  check('C10 ふしぎなまもり持ちの攻撃側はミイラに書き換わる(権威仕様)',
    E.sideAbility(atk) === 'ミイラ', `sideAbility=${E.sideAbility(atk)} override=${atk.abilityOverride}`);
} catch (e) { skipCase('C10', e.message); }

// ===== 結果 =====
console.log('\n──────────────────────────');
console.log(`結果: pass=${pass} fail=${fail} skip=${skip}`);
if (fails.length) { console.log('FAILS:'); fails.forEach(f => console.log('  - ' + f)); }
process.exit(fail > 0 ? 1 : 0);
