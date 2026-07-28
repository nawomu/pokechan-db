/* みがわり(Substitute)仕様検証テスト(check形式・報告のみ=エンジン無修正)
 *
 * 権威仕様(2026-07-27 WebFetchで実読・引用は実在文字列):
 *  [W] ポケモンWiki「みがわり」:
 *      「最大HPの1/4分だけ自分のHPを減らし、みがわりを作る(小数点以下切り捨て)」
 *      失敗文「しかし 身代わりを だすには 体力が 足りなかった!」「しかし <使用者>の 身代わりは すでに でていた」
 *      対策側=「第六世代以降の音技」「第五世代以降の連続攻撃技」「第六世代以降の…すりぬけ」
 *  [W2] ポケモンWiki「みがわり (状態変化)」:
 *      「分身が出る前になった状態異常/状態変化は基本的にそのまま残る」(=分身がある間、新規の状態異常はブロック)
 *      「相手が使用した、みがわり側に作用する攻撃技の追加効果」はブロック
 *  [B] Bulbapedia "Substitute (doll)":
 *      "By decreasing its HP by 25% (rounded down) of its maximum HP when using Substitute,
 *       the user creates a substitute with the same amount of HP as it lost."
 *      失敗 = "the user already has a substitute or if losing the required HP would cause the user to faint."
 *      連続技 = "if a substitute breaks in the middle of a multistrike move, the move will continue
 *               hitting the Pokémon that was behind the substitute."(第5世代以降)
 *      ドレイン = "From Generation III onward, HP-draining moves except Dream Eater can successfully
 *                hit substitutes and drain HP from them."(回復量は分身に与えたダメージ基準)
 *      音技 = "starting in Generation VI, this includes almost all sound-based moves (the only
 *             exception being Howl, ...)"
 *      すりぬけ = "A Pokémon with Infiltrator can also successfully use any move except Transform or
 *                Sky Drop on a Pokémon behind a substitute (since Generation VI)."
 *      かたやぶりは貫通手段として記載なし(かたやぶりが無視するのは特性のみ。みがわりは特性ではない)。
 *      保護 = "any stat stages being lowered; all status conditions (poison, burn, paralysis, freeze,
 *             and sleep) and confusion."
 *
 * 実行: cd "/Users/masamichi/Documents/ポケモンDB" && node tools/_spec_substitute_test.js
 * 期待値はすべて上記の権威仕様から導出(sim自身の出力をゴールデンにしない=バトル再現_羅針盤.md)。
 */
'use strict';
const path = require('path');
const { buildEngine, mulberry32, ROOT, moveByChampKey, pokeByName: pokeByNameHelper } = require('./_sim_engine.js');
const data = require(path.join(ROOT, process.env.PCHAM_DATA || 'pokechan_data.js'));

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; fails.push(name + (detail ? '  -> ' + detail : '')); console.log('  [NG] ' + name + (detail ? '  -> ' + detail : '')); }
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
  s.moves = keys.map(k => { const m = moveByKey(k); if (!m) throw new Error('存在しない技: ' + k); return m; });
  s.selectedMoveIdx = 0;
  s.ability = (opts.ability !== undefined) ? opts.ability : '';   // 既定=特性なし(せいでんき等の混入を防ぐ)
  if (opts.item !== undefined) s.item = opts.item;
  return s;
}
function fullHp(s) { const max = E.realStat(s, 'hp'); s.currentHp = max; return max; }
function resetEnv() {
  E.env.weather = 'none'; E.env.weatherTurns = null;
  E.env.field = 'none'; E.env.fieldTurns = null;
  E.env.doubleBattle = false; E.env.trickRoom = false; E.env.trickRoomTurns = null;
  E.env.gravity = false; E.env.gravityTurns = null;
  E.env.wonderRoom = false; E.env.wonderRoomTurns = null; E.env.magicRoom = false; E.env.magicRoomTurns = null;
  if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
}
// A(self)がidx番の技を1回撃つ
function attack(side, idx, rndFn) {
  E.setRandom(rndFn || mulberry32(20260727));
  E.sides[side].selectedMoveIdx = idx;
  E.runSingleAttack(side, idx);
}
function setup(atkDef) {   // {self:side, opp:side} を場にセット
  E.sides.self = atkDef.self; E.sides.opp = atkDef.opp;
  E.initPP(atkDef.self); E.initPP(atkDef.opp);
}

// ─────────────────────────────────────────────
console.log('\n=== S1: 基本設置(HP1/4切り捨て消費・分身HP=消費分) [出典: B "decreasing its HP by 25% (rounded down) ... substitute with the same amount of HP as it lost" / W「最大HPの1/4分だけ自分のHPを減らし」] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('ピカチュウ', ['hataku']);
  const max = fullHp(A); fullHp(B);
  setup({self: A, opp: B});
  const cost = Math.floor(max / 4);   // 期待コスト=最大HPの1/4切り捨て(権威仕様から導出)
  attack('self', 0);
  check('S1-a HPが最大HPの1/4(切り捨て)だけ減る', A.currentHp === max - cost, `max=${max} cost期待=${cost} 実HP=${A.currentHp}`);
  check('S1-b 分身のHP=消費した量と同じ', A.subHp === cost, `subHp=${A.subHp} 期待=${cost}`);
}

// ─────────────────────────────────────────────
console.log('\n=== S2: すでに分身がいると失敗(HPも払わない) [出典: B "fails ... the user already has a substitute" / W「しかし <使用者>の 身代わりは すでに でていた」] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('ピカチュウ', ['hataku']);
  const max = fullHp(A); fullHp(B);
  setup({self: A, opp: B});
  attack('self', 0);                      // 1回目=成功
  const hpAfter1 = A.currentHp, subAfter1 = A.subHp;
  attack('self', 0);                      // 2回目=失敗のはず
  check('S2-a 2回目は失敗しHPを払わない', A.currentHp === hpAfter1, `1回目後HP=${hpAfter1} 2回目後HP=${A.currentHp}`);
  check('S2-b 分身HPも変わらない', A.subHp === subAfter1, `subHp=${A.subHp} 期待=${subAfter1}`);
}

// ─────────────────────────────────────────────
console.log('\n=== S3: HP不足で失敗(境界=コストちょうどは失敗/コスト+1は成功して残HP1) [出典: B "if losing the required HP would cause the user to faint" / W「しかし 身代わりを だすには 体力が 足りなかった!」] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('ピカチュウ', ['hataku']);
  const max = fullHp(A); fullHp(B);
  const cost = Math.floor(max / 4);
  setup({self: A, opp: B});
  A.currentHp = cost;                     // ちょうどコスト=払うとひんし→失敗のはず
  attack('self', 0);
  check('S3-a HP=コストちょうどでは失敗(HP不変・分身なし)', A.currentHp === cost && !(A.subHp > 0), `HP=${A.currentHp} subHp=${A.subHp}`);
  A.currentHp = cost + 1;                 // コスト+1=払っても残HP1→成功のはず
  attack('self', 0);
  check('S3-b HP=コスト+1では成功して残HP1', A.currentHp === 1 && A.subHp === cost, `HP=${A.currentHp} subHp=${A.subHp} 期待subHp=${cost}`);
}

// ─────────────────────────────────────────────
console.log('\n=== S4: 相手対象の変化技(でんじは)をブロック [出典: B 保護="all status conditions (poison, burn, paralysis, freeze, and sleep)" / W2「分身が出る前になった状態異常/状態変化は基本的にそのまま残る」(新規はブロック)] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('ピカチュウ', ['denjiha']);
  fullHp(A); fullHp(B);
  setup({self: A, opp: B});
  attack('self', 0);                      // カビゴンが分身を出す
  check('S4-前提 分身が出ている', A.subHp > 0, `subHp=${A.subHp}`);
  attack('opp', 0, () => 0);              // でんじは(必ず命中するようroll=0)
  check('S4-a でんじはは分身に防がれて まひ にならない', A.status === 'none', `status=${A.status}`);
}

// ─────────────────────────────────────────────
console.log('\n=== S5: 音技(変化)は貫通=うたうで眠る [出典: B "starting in Generation VI, this includes almost all sound-based moves" / W「第六世代以降の音技」] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('ピカチュウ', ['utau']);
  fullHp(A); fullHp(B);
  setup({self: A, opp: B});
  attack('self', 0);
  check('S5-前提 分身が出ている', A.subHp > 0, `subHp=${A.subHp}`);
  attack('opp', 0, () => 0);              // うたう(命中55%→roll=0で必ず命中)
  check('S5-a うたう(音技)は分身を貫通して ねむり になる', A.status === 'sleep', `status=${A.status}`);
  check('S5-b 分身は消えない(素通り)', A.subHp > 0, `subHp=${A.subHp}`);
}

// ─────────────────────────────────────────────
console.log('\n=== S6: 音技(攻撃=ハイパーボイス)は分身でなく本体に当たる [出典: B 同上(音技はGen6+で貫通)] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('ピカチュウ', ['haipaaboisu']);
  fullHp(A); fullHp(B);
  setup({self: A, opp: B});
  attack('self', 0);
  const subBefore = A.subHp, hpBefore = A.currentHp;
  attack('opp', 0);
  check('S6-a 本体のHPが減る', A.currentHp < hpBefore, `hp ${hpBefore}->${A.currentHp}`);
  check('S6-b 分身のHPは減らない', A.subHp === subBefore, `subHp ${subBefore}->${A.subHp}`);
}

// ─────────────────────────────────────────────
console.log('\n=== S7: 連続技の途中で分身が壊れたら残りは本体に当たる [出典: B "the move will continue hitting the Pokémon that was behind the substitute" / W「第五世代以降の連続攻撃技」] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('ピカチュウ', ['daburuatakku']);   // 確定2発
  fullHp(A); fullHp(B);
  setup({self: A, opp: B});
  attack('self', 0);
  A.subHp = 1;                            // 1発目で必ず壊れる分身(弱った分身を再現)
  const hpBefore = A.currentHp;
  attack('opp', 0);
  check('S7-a 分身は壊れる', A.subHp === 0, `subHp=${A.subHp}`);
  check('S7-b 2発目は本体に当たり本体HPが減る', A.currentHp < hpBefore, `hp ${hpBefore}->${A.currentHp}`);
}

// ─────────────────────────────────────────────
console.log('\n=== S8: ドレイン技は分身に当たり、分身に与えたダメージ分吸収する(本体は無傷) [出典: B "From Generation III onward, HP-draining moves except Dream Eater can successfully hit substitutes and drain HP from them."] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('フシギバナ', ['gigadorein']);
  fullHp(A); const maxB = fullHp(B);
  setup({self: A, opp: B});
  attack('self', 0);
  const subBefore = A.subHp, hpBefore = A.currentHp;
  B.currentHp = Math.floor(maxB / 2);     // 回復が観測できるようBのHPを半分に
  const bBefore = B.currentHp;
  attack('opp', 0);
  const dealt = subBefore - A.subHp;
  check('S8-a 分身がダメージを受ける(本体は無傷)', dealt > 0 && A.currentHp === hpBefore, `分身被ダメ=${dealt} 本体hp ${hpBefore}->${A.currentHp}`);
  check('S8-b 攻撃側は分身に与えた分の1/2(切り捨て)回復する', B.currentHp === bBefore + Math.max(1, Math.floor(dealt / 2)), `B hp ${bBefore}->${B.currentHp} 期待+${Math.max(1, Math.floor(dealt / 2))} (dealt=${dealt})`);
}

// ─────────────────────────────────────────────
console.log('\n=== S9: かたやぶりは みがわりを貫通しない(特性でないものは無視できない) [出典: B "Substitute (doll)" の貫通手段一覧に Mold Breaker の記載なし(貫通=すりぬけ/音技/Transform等のみ)] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('カイロス', ['hataku'], {ability: 'かたやぶり'});
  fullHp(A); fullHp(B);
  setup({self: A, opp: B});
  attack('self', 0);
  const subBefore = A.subHp, hpBefore = A.currentHp;
  attack('opp', 0);
  check('S9-a かたやぶりでも分身が受ける(本体無傷)', A.subHp < subBefore && A.currentHp === hpBefore, `subHp ${subBefore}->${A.subHp} 本体hp ${hpBefore}->${A.currentHp}`);
}

// ─────────────────────────────────────────────
console.log('\n=== S10: すりぬけは みがわりを貫通する [出典: B "A Pokémon with Infiltrator can also successfully use any move except Transform or Sky Drop on a Pokémon behind a substitute (since Generation VI)."] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('カイロス', ['hataku'], {ability: 'すりぬけ'});
  fullHp(A); fullHp(B);
  setup({self: A, opp: B});
  attack('self', 0);
  const subBefore = A.subHp, hpBefore = A.currentHp;
  attack('opp', 0);
  check('S10-a すりぬけは分身を素通りして本体に当たる', A.currentHp < hpBefore && A.subHp === subBefore, `本体hp ${hpBefore}->${A.currentHp} subHp ${subBefore}->${A.subHp}`);
}

// ─────────────────────────────────────────────
console.log('\n=== S11: 分身が受けた攻撃技の追加効果(のしかかり=まひ30%)は本体に及ばない [出典: W2「相手が使用した、みがわり側に作用する攻撃技の追加効果」はブロック / B 保護=paralysis等] ===');
{
  resetEnv();
  const A = freshSide('カビゴン', ['migawari']);
  const B = freshSide('カイロス', ['noshikakari']);
  fullHp(A); fullHp(B);
  setup({self: A, opp: B});
  attack('self', 0);
  const hpBefore = A.currentHp;
  attack('opp', 0, () => 0);              // roll=0: 命中確定・追加効果判定も(防がれなければ)必ず発動する条件
  check('S11-a 分身が受けた のしかかり の まひ は本体に付かない', A.status === 'none', `status=${A.status}`);
  check('S11-b 本体はダメージも受けていない', A.currentHp === hpBefore, `hp ${hpBefore}->${A.currentHp}`);
}

// ─────────────────────────────────────────────
console.log('\n──────── 結果 ────────');
console.log(`pass=${pass} fail=${fail}`);
if (fails.length) { console.log('失敗一覧:'); fails.forEach(f => console.log('  - ' + f)); process.exitCode = 1; }
