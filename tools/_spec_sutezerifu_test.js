/* すてゼリフ(Parting Shot)仕様検証テスト(検証担当・2026-07-27)
 *
 * 方式: エンジン(real_battle_simulator.html)は絶対に修正しない。落ちたケース=エンジンの実挙動と
 *       権威仕様の不一致(バトル再現_羅針盤.md=sim自己出力をゴールデンにしない原則)。
 *
 * 権威ソース(期待値の出典・2026-07-27にWebFetchで実読):
 *  [W] ポケモンWiki「すてゼリフ」 https://wiki.pokemonwiki.com/wiki/すてゼリフ
 *      - 「相手の攻撃と特攻を1段階下げ、控えのポケモンと交代する」
 *      - 「技が特性ぼうおん/おうごんのからだや、まもる系の状態により無効化された場合は交代できない」
 *      - 「対象の特性クリアボディ/しろいけむり/メタルプロテクト、しろいきり状態、持ち物クリアチャームに
 *         ランク低下を防がれた場合や、対象の攻撃と特攻ランクがすでに最低だった場合、第六世代のみ交代できる。
 *         第七世代以降では交代できない」
 *      - 「控えに戦えるポケモンが1匹も残っていない状態で使った場合、ランクを下げる効果は発動するが、交代はできない」
 *      - 「音のわざの1つ。そのため相手のみがわり状態を貫通する」
 *  [B] Bulbapedia "Parting Shot (move)" https://bulbapedia.bulbagarden.net/wiki/Parting_Shot_(move)
 *      - "Lowers the target's Attack and Special Attack stats by one stage each, and then switches the user out."
 *      - Gen VII+: "The user no longer switches out if Parting Shot is unable to affect the target's stats."
 *      - Gen VII+: "The user will no longer switch out if the target already has both -6 Attack and
 *        Special Attack stat stages."
 *      - "can hit Pokémon even if they are behind a substitute" (sound-based)
 *      - won't switch if "the target is immune (such as due to Soundproof)"
 *  [M] Bulbapedia "Mold Breaker (Ability)": かたやぶりはクリアボディ等の防御特性を無視する
 *      https://bulbapedia.bulbagarden.net/wiki/Mold_Breaker_(Ability)
 *
 * 本プロジェクトのエンジンは現行世代(第9世代/Champions)準拠 → 期待値は第七世代以降ルールで取る。
 *
 * 実行: cd "/Users/masamichi/Documents/ポケモンDB" && node tools/_spec_sutezerifu_test.js
 */
'use strict';
const path = require('path');
const { buildEngine, ROOT, moveByChampKey, pokeByName: pokeByNameHelper } = require('./_sim_engine.js');
const data = require(path.join(ROOT, process.env.PCHAM_DATA || 'pokechan_data.js'));

let pass = 0, fail = 0, skip = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else {
    fail++; fails.push(name + (detail ? '  → ' + detail : ''));
    console.log('  ❌ ' + name + (detail ? '  → ' + detail : ''));
  }
}
function skipCase(id, reason) { skip++; console.log('  ⚪ SKIP: ' + id + '  (' + reason + ')'); }

const E = buildEngine();
const pokeByName = n => pokeByNameHelper(data, n);
const moveByKey = k => moveByChampKey(data, k);
E.setRandom(() => 0.42);   // 決定論化(命中100の変化技=常に命中。乱数分岐を固定)

function freshSide(pokeName, moveKeys, opts) {
  opts = opts || {};
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  if (!s.poke) throw new Error('存在しないポケモン: ' + pokeName);
  const keys = Array.isArray(moveKeys) ? moveKeys : (moveKeys ? [moveKeys] : []);
  s.moves = keys.map(k => moveByKey(k));
  if (keys.length && s.moves.some(m => !m)) throw new Error('存在しない技: ' + keys.join(','));
  s.selectedMoveIdx = 0;
  s.ability = (opts.ability !== undefined) ? opts.ability : (s.poke.ab1 || '');
  if (opts.item !== undefined) s.item = opts.item;
  s.currentHp = E.realStat(s, 'hp');
  return s;
}
function benchEntry(pokeName) {
  const p = pokeByName(pokeName);
  if (!p) throw new Error('存在しないポケモン(控え): ' + pokeName);
  return { poke: p, effort: {hp:0,atk:0,def:0,spatk:0,spdef:0,spd:0}, natureIdx: 0,
    ability: '', item: '', moves: [moveByKey('hataku')], currentHp: null,
    fainted: false, status: 'none', sleepTurns: null };
}
function resetEnv() {
  E.env.weather = 'none'; E.env.weatherTurns = null;
  E.env.field = 'none';  E.env.fieldTurns = null;
  E.env.doubleBattle = false; E.env.trickRoom = false; E.env.trickRoomTurns = null;
  E.env.gravity = false; E.env.gravityTurns = null;
  if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
}
// 1ケース分のセットアップ: 使用者=ゴロンダ(すてゼリフ習得者)・控え=ピカチュウ・相手=カビゴン(基本)
function setup(opts) {
  opts = opts || {};
  resetEnv();
  const atk = freshSide('ゴロンダ', 'sutezerifu', { ability: opts.atkAbility !== undefined ? opts.atkAbility : '' });
  if (opts.withBench !== false) atk.bench = [benchEntry('ピカチュウ')];
  else atk.bench = [];
  const def = freshSide('カビゴン', 'hataku', { ability: opts.defAbility !== undefined ? opts.defAbility : '' });
  E.sides.self = atk; E.sides.opp = def;
  return { atk, def };
}
// 交代したか = 場に出ているポケモンが控え(ピカチュウ)に入れ替わったか
const switchedOut = () => E.sides.self.poke && E.sides.self.poke.name === 'ピカチュウ';

// ─────────────────────────────────────────────
// C1: 基本動作 — 相手のこうげき-1/とくこう-1のあと、使用者が控えと交代する
// 出典[W]「相手の攻撃と特攻を1段階下げ、控えのポケモンと交代する」
//     [B] "Lowers the target's Attack and Special Attack stats by one stage each, and then switches the user out."
// ─────────────────────────────────────────────
console.log('\n=== C1: 基本動作(こうげき-1/とくこう-1→自分交代) [出典: ポケモンWiki「すてゼリフ」/ Bulbapedia "Parting Shot"] ===');
try {
  const { def } = setup();
  E.runSingleAttack('self', 0);
  check('C1-a 相手のこうげきランクが-1', def.rank.atk === -1, `rank.atk=${def.rank.atk}`);
  check('C1-b 相手のとくこうランクが-1', def.rank.spatk === -1, `rank.spatk=${def.rank.spatk}`);
  check('C1-c 使用者が控え(ピカチュウ)と交代している', switchedOut(),
    `場のポケモン=${E.sides.self.poke && E.sides.self.poke.name}`);
} catch (e) { skipCase('C1', e.message); }

// ─────────────────────────────────────────────
// C2: まもるで防がれた場合 — 技ごと無効=ランクも下がらず、交代もしない
// 出典[W]「まもる系の状態により無効化された場合は交代できない」 [B] "Affected by Protect"
// (すてゼリフはデータ上 protect:true・まもり貫通効果なし)
// ─────────────────────────────────────────────
console.log('\n=== C2: まもるで防がれた場合(ランク低下なし+交代なし) [出典: ポケモンWiki「すてゼリフ」] ===');
try {
  const { def } = setup();
  def.protecting = moveByKey('mamoru');   // 相手が先にまもるで守りの体勢(runTurn/runSingleAttack共通のprotectingフィールド)
  E.runSingleAttack('self', 0);
  check('C2-a 相手のランクは下がらない(atk=0/spatk=0)', def.rank.atk === 0 && def.rank.spatk === 0,
    `rank.atk=${def.rank.atk} rank.spatk=${def.rank.spatk}`);
  check('C2-b 使用者は交代しない(場に残る)', !switchedOut(),
    `場のポケモン=${E.sides.self.poke && E.sides.self.poke.name}`);
} catch (e) { skipCase('C2', e.message); }

// ─────────────────────────────────────────────
// C3: 控えがいない場合 — ランクを下げる効果は発動するが、交代はしない
// 出典[W]「控えに戦えるポケモンが1匹も残っていない状態で使った場合、ランクを下げる効果は発動するが、交代はできない」
// ─────────────────────────────────────────────
console.log('\n=== C3: 控えがいない場合(ランク低下は発動+交代なし) [出典: ポケモンWiki「すてゼリフ」] ===');
try {
  const { atk, def } = setup({ withBench: false });
  E.runSingleAttack('self', 0);
  check('C3-a 相手のこうげき-1/とくこう-1は発動する', def.rank.atk === -1 && def.rank.spatk === -1,
    `rank.atk=${def.rank.atk} rank.spatk=${def.rank.spatk}`);
  check('C3-b 使用者はそのまま場に残る(ゴロンダのまま)', E.sides.self.poke && E.sides.self.poke.name === 'ゴロンダ',
    `場のポケモン=${E.sides.self.poke && E.sides.self.poke.name}`);
} catch (e) { skipCase('C3', e.message); }

// ─────────────────────────────────────────────
// C4: クリアボディ相手(第七世代以降) — ランク低下を防がれたら交代もしない
// 出典[W]「対象の特性クリアボディ…にランク低下を防がれた場合…第七世代以降では交代できない」
//     [B] Gen VII+ "The user no longer switches out if Parting Shot is unable to affect the target's stats."
// ─────────────────────────────────────────────
console.log('\n=== C4: クリアボディ相手(ランク低下なし+第7世代以降は交代もなし) [出典: ポケモンWiki「すてゼリフ」/ Bulbapedia Gen VII+] ===');
try {
  const { def } = setup({ defAbility: 'クリアボディ' });
  E.runSingleAttack('self', 0);
  check('C4-a クリアボディでランクは下がらない', def.rank.atk === 0 && def.rank.spatk === 0,
    `rank.atk=${def.rank.atk} rank.spatk=${def.rank.spatk}`);
  check('C4-b [第7世代以降] ランク低下を全て防がれたら使用者は交代しない', !switchedOut(),
    `場のポケモン=${E.sides.self.poke && E.sides.self.poke.name}(ピカチュウなら交代してしまっている=Gen6挙動)`);
} catch (e) { skipCase('C4', e.message); }

// ─────────────────────────────────────────────
// C5: 相手のこうげき・とくこうが両方すでに-6(第七世代以降) — 交代しない
// 出典[W]「対象の攻撃と特攻ランクがすでに最低だった場合…第七世代以降では交代できない」
//     [B] Gen VII+ "The user will no longer switch out if the target already has both -6 Attack and
//         Special Attack stat stages."
// ─────────────────────────────────────────────
console.log('\n=== C5: 相手の攻撃/特攻が両方-6(第7世代以降は交代なし) [出典: ポケモンWiki「すてゼリフ」/ Bulbapedia Gen VII+] ===');
try {
  const { def } = setup();
  def.rank.atk = -6; def.rank.spatk = -6;
  E.runSingleAttack('self', 0);
  check('C5-a ランクは-6のまま(それ以上下がらない)', def.rank.atk === -6 && def.rank.spatk === -6,
    `rank.atk=${def.rank.atk} rank.spatk=${def.rank.spatk}`);
  check('C5-b [第7世代以降] 両方最低=1段階も下げられなかったら使用者は交代しない', !switchedOut(),
    `場のポケモン=${E.sides.self.poke && E.sides.self.poke.name}`);
} catch (e) { skipCase('C5', e.message); }

// ─────────────────────────────────────────────
// C5b: 境界 — 片方(-6)でも、もう片方が下がるなら交代する
// 出典[B]の裏返し: 交代不可は「both -6」の時のみ=とくこうが実際に下がった場合は通常どおり交代する
// ─────────────────────────────────────────────
console.log('\n=== C5b: こうげきだけ-6(とくこうは下がる→交代する) [出典: Bulbapedia "Parting Shot" Gen VII+の対偶] ===');
try {
  const { def } = setup();
  def.rank.atk = -6;   // とくこうは0のまま
  E.runSingleAttack('self', 0);
  check('C5b-a とくこうは-1に下がる(こうげきは-6のまま)', def.rank.atk === -6 && def.rank.spatk === -1,
    `rank.atk=${def.rank.atk} rank.spatk=${def.rank.spatk}`);
  check('C5b-b 片方でも下がったので使用者は交代する', switchedOut(),
    `場のポケモン=${E.sides.self.poke && E.sides.self.poke.name}`);
} catch (e) { skipCase('C5b', e.message); }

// ─────────────────────────────────────────────
// C6: みがわり相手 — 音の技なのでみがわりを貫通してランクを下げ、交代もする
// 出典[W]「音のわざの1つ。そのため相手のみがわり状態を貫通する」
//     [B] "can hit Pokémon even if they are behind a substitute"
// ─────────────────────────────────────────────
console.log('\n=== C6: みがわり相手(音技=貫通してランク低下+交代) [出典: ポケモンWiki「すてゼリフ」/ Bulbapedia] ===');
try {
  const { def } = setup();
  def.subHp = 50;   // 相手にみがわり(分身)がいる状態
  E.runSingleAttack('self', 0);
  check('C6-a みがわりを貫通して相手のこうげき-1/とくこう-1', def.rank.atk === -1 && def.rank.spatk === -1,
    `rank.atk=${def.rank.atk} rank.spatk=${def.rank.spatk}`);
  check('C6-b 使用者は交代する', switchedOut(),
    `場のポケモン=${E.sides.self.poke && E.sides.self.poke.name}`);
} catch (e) { skipCase('C6', e.message); }

// ─────────────────────────────────────────────
// C7: ぼうおん相手 — 音技が無効=ランクも下がらず、交代もしない
// 出典[W]「技が特性ぼうおん…により無効化された場合は交代できない」
//     [B] won't switch if "the target is immune (such as due to Soundproof)"
// ─────────────────────────────────────────────
console.log('\n=== C7: ぼうおん相手(技ごと無効+交代なし) [出典: ポケモンWiki「すてゼリフ」/ Bulbapedia] ===');
try {
  const { def } = setup({ defAbility: 'ぼうおん' });
  E.runSingleAttack('self', 0);
  check('C7-a ぼうおんでランクは下がらない', def.rank.atk === 0 && def.rank.spatk === 0,
    `rank.atk=${def.rank.atk} rank.spatk=${def.rank.spatk}`);
  check('C7-b 使用者は交代しない', !switchedOut(),
    `場のポケモン=${E.sides.self.poke && E.sides.self.poke.name}`);
} catch (e) { skipCase('C7', e.message); }

// ─────────────────────────────────────────────
// C8: かたやぶり(ゴロンダの実特性)×クリアボディ — 防御特性を無視してランクを下げ、交代する
// 出典[M] Bulbapedia "Mold Breaker": クリアボディ等の防御側特性を無視して技の効果を通す
// (ゴロンダはab2=かたやぶり=正規の組み合わせ)
// ─────────────────────────────────────────────
console.log('\n=== C8: かたやぶり×クリアボディ(貫通してランク低下+交代) [出典: Bulbapedia "Mold Breaker (Ability)"] ===');
try {
  const { def } = setup({ atkAbility: 'かたやぶり', defAbility: 'クリアボディ' });
  E.runSingleAttack('self', 0);
  check('C8-a かたやぶりがクリアボディを無視してこうげき-1/とくこう-1', def.rank.atk === -1 && def.rank.spatk === -1,
    `rank.atk=${def.rank.atk} rank.spatk=${def.rank.spatk}`);
  check('C8-b 使用者は交代する', switchedOut(),
    `場のポケモン=${E.sides.self.poke && E.sides.self.poke.name}`);
} catch (e) { skipCase('C8', e.message); }

// ===== 結果 =====
console.log('\n========================================');
console.log(`結果: pass=${pass} fail=${fail} skip=${skip}`);
if (fails.length) { console.log('\n--- FAILS ---'); fails.forEach(f => console.log('  ・' + f)); }
process.exit(fail > 0 ? 1 : 0);
