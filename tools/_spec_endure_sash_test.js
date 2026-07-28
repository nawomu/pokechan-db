/* 検証: きあいのタスキ + がんじょう + こらえる (spec test)
 * 目的: 「HP1で耐える」3機構が権威仕様どおりに動くかをエンジン
 *       (real_battle_simulator.html)実挙動で確かめる。エンジンは修正しない(報告のみ)。
 *
 * ★権威仕様(期待値の出典・2026-07-27 WebFetchで裏取り済み):
 * [W1] ポケモンWiki「きあいのタスキ」https://wiki.pokemonwiki.com/wiki/きあいのタスキ
 *   - 「HPが満タンのとき ひんしになりそうな 技を 受けても HP1で 1度だけ 耐える」
 *   - 「僅かでもHPを減らされると効果がなくなるが、その後HPを回復して再び満タンになれば発動可能になる」
 *   - 連続攻撃技: 「第五世代以降は最初の1発目に対してのみ発動し、2発目以降は耐えない」
 *   - 「所有者が特性がんじょうのポケモンである場合、がんじょうが優先して発動してきあいのタスキは消費されない」
 * [W2] ポケモンWiki「がんじょう」https://wiki.pokemonwiki.com/wiki/がんじょう
 *   - 「一撃必殺技を受けても無効化する」(HP満タン条件なし)
 *   - 「HPが満タンのとき一撃でひんしになるダメージを受けても、HPを1残して持ちこたえる」
 *   - 「がんじょうが発動できるかは各攻撃ごとに判定される。1発目を受けてHPが減少しているとき、
 *      2発目を受けるとがんじょうは発動しない」
 *   - 「かたやぶりの効果がある技や、特性を無視する技は耐えることはできない」
 * [W3] ポケモンWiki「こらえる」https://wiki.pokemonwiki.com/wiki/こらえる
 *   - 優先度+4(第五世代以降)・「連続で使用すると失敗しやすくなる」第六世代以降=成功率1/3・下限1/729
 *   - 「すでに残りHPが1のときでもこらえるの効果で耐えることができる」
 * [B1] Bulbapedia "Focus_Sash": "If the holder has full HP and is hit by a move that would
 *      otherwise cause fainting (including a one-hit knockout move), the Focus Sash will
 *      enable it to survive with 1 HP." / "The Focus Sash will only protect its holder from
 *      the first strike of a multistrike move."(Gen V+) / 使用後 "The item then disappears"
 * [B2] Bulbapedia "Sturdy_(Ability)": "A Pokémon with Mold Breaker will ignore Sturdy." /
 *      "When a multistrike move hits a Pokémon with Sturdy, Sturdy's effect can only activate
 *       for hits while the user has full HP." /
 *      "If a Pokémon with Sturdy is holding a Focus Sash, Sturdy will activate first."
 * [B3] Bulbapedia "Endure_(move)": "Endure now has a priority of +4"(Gen V+) /
 *      "can protect the user from fainting from multiple attacks in one turn" /
 *      連続使用の成功率低下はまもると同一式(第六世代以降1/3=[W3])
 *
 * 実行: cd "/Users/masamichi/Documents/ポケモンDB" && node tools/_spec_endure_sash_test.js
 * 読み込みパターンは tools/_sim_hard_interaction_test.js を流用。
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
  if (!s.poke) throw new Error('存在しないポケモン: ' + pokeName);
  const keys = Array.isArray(moveKeys) ? moveKeys : (moveKeys ? [moveKeys] : []);
  s.moves = keys.map(k => moveByKey(k));
  if (keys.length && s.moves.some(m => !m)) throw new Error('存在しない技: ' + keys.join(','));
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
// 確定致死の攻撃側(H10方式): カイリュー+こだわりハチマキ+ランク+6 → メタモン(最大HP123)に
// はたく/ダブルアタック1ヒットのmin damageが最大HPを必ず超える=seed非依存。
function lethalAttacker(moveKey, opts) {
  opts = opts || {};
  const a = freshSide('カイリュー', moveKey, { item: 'kodawari_hachimaki', ability: opts.ability !== undefined ? opts.ability : 'せいしんりょく' });
  a.rank.atk = 6;
  fullHp(a);
  return a;
}
function assertLethal(moveKey, def) {
  const r = E.calcDamage('self', 'opp', moveByKey(moveKey));
  const max = E.realStat(def, 'hp');
  if (!r || r.min <= max) throw new Error(`事前条件不成立: ${moveKey} min=${r && r.min} <= defMaxHp=${max}`);
}

// ─────────────────────────────────────────────
console.log('\n=== S1: きあいのタスキ基本(HP満タン+致死→HP1・消費) [出典W1/B1] ===');
try {
  resetEnv();
  const atk = lethalAttacker('hataku');
  const def = freshSide('メタモン', 'hataku', { ability: '', item: 'focus_sash' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  assertLethal('hataku', def);
  E.battleLog.length = 0;
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  const sashLine = E.battleLog.some(e => /きあいのタスキで もちこたえた/.test(e.msg));
  check('S1-a [W1「HPが満タンのとき…HP1で1度だけ耐える」] 致死ダメージをHP1で耐える',
    def.currentHp === 1 && !def.fainted && sashLine,
    `hp=${def.currentHp} fainted=${def.fainted} sashLine=${sashLine}`);
  check('S1-b [B1「The item then disappears」] タスキは消費される(item空)',
    def.item !== 'focus_sash', `item=${def.item}`);
  // 2発目(HP1=非満タン)は耐えない
  E.setRandom(mulberry32(2));
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('S1-c [W1「1度だけ」] 2発目の致死ダメージはひんし',
    def.fainted === true && def.currentHp === 0, `fainted=${def.fainted} hp=${def.currentHp}`);
} catch (e) { check('S1 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S2: きあいのタスキ×非満タン(発動しない) [出典W1] ===');
try {
  resetEnv();
  const atk = lethalAttacker('hataku');
  const def = freshSide('メタモン', 'hataku', { ability: '', item: 'focus_sash' });
  const max = fullHp(def);
  def.currentHp = max - 1;   // 僅かでもHPが減っている
  E.sides.self = atk; E.sides.opp = def;
  assertLethal('hataku', def);
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('S2-a [W1「僅かでもHPを減らされると効果がなくなる」] 非満タンではタスキ不発→ひんし',
    def.fainted === true && def.currentHp === 0, `fainted=${def.fainted} hp=${def.currentHp}`);
  check('S2-b 不発ならタスキは消費されない(item保持)',
    def.item === 'focus_sash', `item=${def.item}`);
} catch (e) { check('S2 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S3: きあいのタスキ×連続技(1発目のみ・2発目でひんし) [出典W1/B1] ===');
try {
  resetEnv();
  const atk = lethalAttacker('daburuatakku');   // 固定2ヒット
  const def = freshSide('メタモン', 'hataku', { ability: '', item: 'focus_sash' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  assertLethal('daburuatakku', def);   // 1ヒット分でも致死
  E.battleLog.length = 0;
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('daburuatakku'));
  const sashLine = E.battleLog.some(e => /きあいのタスキで もちこたえた/.test(e.msg));
  check('S3 [W1「第五世代以降は最初の1発目に対してのみ発動し、2発目以降は耐えない」] 1発目タスキ→2発目でひんし',
    sashLine && def.fainted === true && def.currentHp === 0 && def.item !== 'focus_sash',
    `sashLine=${sashLine} fainted=${def.fainted} hp=${def.currentHp} item=${def.item}`);
} catch (e) { check('S3 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S4: がんじょう基本(HP満タン+致死→HP1・消費なし) [出典W2] ===');
try {
  resetEnv();
  const atk = lethalAttacker('hataku');
  const def = freshSide('メタモン', 'hataku', { ability: 'がんじょう' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  assertLethal('hataku', def);
  E.battleLog.length = 0;
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  const gLine = E.battleLog.some(e => /がんじょうで もちこたえた/.test(e.msg));
  check('S4 [W2「HPが満タンのとき一撃でひんしになるダメージを受けても、HPを1残して持ちこたえる」]',
    def.currentHp === 1 && !def.fainted && gLine,
    `hp=${def.currentHp} fainted=${def.fainted} gLine=${gLine}`);
} catch (e) { check('S4 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S5: がんじょう×一撃必殺(無効・HP条件なし) [出典W2] ===');
try {
  resetEnv();
  const atk = freshSide('カイロス', 'tsunodoriru', { ability: 'かいりきバサミ' });
  fullHp(atk);
  const def = freshSide('メタモン', 'hataku', { ability: 'がんじょう' });
  const max = fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(mulberry32(1));
  const r1 = E.phaseDealDamage('self', 'opp', moveByKey('tsunodoriru'));
  check('S5-a [W2「一撃必殺技を受けても無効化する」] 満タン時: 無効・無傷',
    !!(r1 && r1.immune) && def.currentHp === max && !def.fainted,
    `immune=${r1 && r1.immune} hp=${def.currentHp}/${max}`);
  def.currentHp = Math.floor(max / 2);   // 非満タンでも一撃必殺無効はHP条件なし
  const r2 = E.phaseDealDamage('self', 'opp', moveByKey('tsunodoriru'));
  check('S5-b [W2 同上・満タン条件の記載なし] 非満タンでも一撃必殺は無効',
    !!(r2 && r2.immune) && !def.fainted,
    `immune=${r2 && r2.immune} hp=${def.currentHp} fainted=${def.fainted}`);
} catch (e) { check('S5 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S6: がんじょう×連続技(各攻撃ごとに判定→2発目でひんし) [出典W2/B2] ===');
try {
  resetEnv();
  const atk = lethalAttacker('daburuatakku');
  const def = freshSide('メタモン', 'hataku', { ability: 'がんじょう' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  assertLethal('daburuatakku', def);
  E.battleLog.length = 0;
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('daburuatakku'));
  const gLine = E.battleLog.some(e => /がんじょうで もちこたえた/.test(e.msg));
  check('S6 [W2「1発目を受けてHPが減少しているとき、2発目を受けるとがんじょうは発動しない」] 1発目のみ発動→ひんし',
    gLine && def.fainted === true && def.currentHp === 0,
    `gLine=${gLine} fainted=${def.fainted} hp=${def.currentHp}`);
} catch (e) { check('S6 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S7: かたやぶり×がんじょう(通常致死技=耐えられない) [出典W2/B2] ===');
try {
  resetEnv();
  const atk = lethalAttacker('hataku', { ability: 'かたやぶり' });
  const def = freshSide('メタモン', 'hataku', { ability: 'がんじょう' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  assertLethal('hataku', def);
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('S7 [W2「かたやぶりの効果がある技…は耐えることはできない」/B2「A Pokémon with Mold Breaker will ignore Sturdy.」]',
    def.fainted === true && def.currentHp === 0,
    `fainted=${def.fainted} hp=${def.currentHp}`);
} catch (e) { check('S7 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S8: かたやぶり×がんじょう×一撃必殺(無効も無視されKO) [出典B2] ===');
try {
  resetEnv();
  const atk = freshSide('カイロス', 'tsunodoriru', { ability: 'かたやぶり' });
  fullHp(atk);
  const def = freshSide('メタモン', 'hataku', { ability: 'がんじょう' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(mulberry32(1));
  const r = E.phaseDealDamage('self', 'opp', moveByKey('tsunodoriru'));
  check('S8 [B2「A Pokémon with Mold Breaker will ignore Sturdy.」=一撃必殺無効も無視→KO] かたやぶりの一撃必殺はがんじょうを貫通する',
    !!(r && !r.immune) && def.fainted === true && def.currentHp === 0,
    `immune=${r && r.immune} fainted=${def.fainted} hp=${def.currentHp}`);
} catch (e) { check('S8 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S9: がんじょう+きあいのタスキ同時所持(がんじょう優先・タスキ非消費) [出典W1/W2/B2] ===');
try {
  resetEnv();
  const atk = lethalAttacker('hataku');
  const def = freshSide('メタモン', 'hataku', { ability: 'がんじょう', item: 'focus_sash' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  assertLethal('hataku', def);
  E.battleLog.length = 0;
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  const gLine = E.battleLog.some(e => /がんじょうで もちこたえた/.test(e.msg));
  const sLine = E.battleLog.some(e => /きあいのタスキで もちこたえた/.test(e.msg));
  check('S9 [W2「がんじょうが先に発動してきあいのタスキは消費されない」/B2 "Sturdy will activate first."] HP1+タスキ保持',
    def.currentHp === 1 && !def.fainted && gLine && !sLine && def.item === 'focus_sash',
    `hp=${def.currentHp} gLine=${gLine} sLine=${sLine} item=${def.item}`);
} catch (e) { check('S9 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S10: こらえる基本(宣言経由・HP1でも耐える・同一ターン複数攻撃) [出典W3/B3] ===');
try {
  resetEnv();
  const atk = lethalAttacker('hataku');
  const def = freshSide('メタモン', 'koraeru', { ability: '' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(mulberry32(1));
  def.selectedMoveIdx = 0;
  E.runSingleAttack('opp', 0);   // こらえる宣言(初回は必ず成功)
  check('S10-a こらえる宣言で体勢に入る(enduring=true)', def.enduring === true, `enduring=${def.enduring}`);
  assertLethal('hataku', def);
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('S10-b [W3/B3] 致死ダメージをHP1で耐える', def.currentHp === 1 && !def.fainted,
    `hp=${def.currentHp} fainted=${def.fainted}`);
  // 同一ターン内の追撃もこらえる(B3 "can protect the user from fainting from multiple attacks in one turn")
  // + W3「すでに残りHPが1のときでもこらえるの効果で耐えることができる」
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('S10-c [W3「すでに残りHPが1のときでも…耐える」/B3 "multiple attacks in one turn"] HP1からの追撃も耐える',
    def.currentHp === 1 && !def.fainted, `hp=${def.currentHp} fainted=${def.fainted}`);
} catch (e) { check('S10 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S11: こらえる×連続技(全ヒットをHP1で耐える=タスキとの差) [出典B3] ===');
try {
  resetEnv();
  const atk = lethalAttacker('daburuatakku');
  const def = freshSide('メタモン', 'koraeru', { ability: '' });
  fullHp(def);
  def.enduring = true;   // こらえる体勢(宣言済み想定)
  E.sides.self = atk; E.sides.opp = def;
  assertLethal('daburuatakku', def);
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('daburuatakku'));
  check('S11 [B3 "can protect the user from fainting from multiple attacks in one turn"] 連続技の全ヒットを耐えHP1で生存',
    def.currentHp === 1 && !def.fainted, `hp=${def.currentHp} fainted=${def.fainted}`);
} catch (e) { check('S11 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S12: こらえる+きあいのタスキ(こらえる成立→タスキ非消費) [出典B1] ===');
// 期待値の導出: B1のタスキ発動条件は「ひんしになりそうな技を受けたとき(a move that would otherwise
// cause fainting)」。こらえる成立中はダメージがHP-1で止まり「ひんしになりそう」でなくなるため、
// タスキの発動条件を満たさない=消費されない。
try {
  resetEnv();
  const atk = lethalAttacker('hataku');
  const def = freshSide('メタモン', 'koraeru', { ability: '', item: 'focus_sash' });
  fullHp(def);
  def.enduring = true;
  E.sides.self = atk; E.sides.opp = def;
  assertLethal('hataku', def);
  E.battleLog.length = 0;
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  const endureLine = E.battleLog.some(e => /こらえた/.test(e.msg));
  const sashLine = E.battleLog.some(e => /きあいのタスキ/.test(e.msg));
  check('S12 [B1発動条件からの導出] こらえるで耐え、タスキは発動せず保持される',
    def.currentHp === 1 && !def.fainted && endureLine && !sashLine && def.item === 'focus_sash',
    `hp=${def.currentHp} endureLine=${endureLine} sashLine=${sashLine} item=${def.item}`);
} catch (e) { check('S12 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S13: こらえる連続使用の成功率低下(2回目≈1/3) [出典W3] ===');
try {
  const N = 300;
  let secondOk = 0;
  for (let seed = 0; seed < N; seed++) {
    resetEnv();
    const atk = freshSide('カイリュー', 'hataku', { ability: 'せいしんりょく' });
    fullHp(atk);
    const def = freshSide('メタモン', 'koraeru', { ability: '' });
    fullHp(def);
    E.sides.self = atk; E.sides.opp = def;
    E.setRandom(mulberry32(seed + 1));
    def.selectedMoveIdx = 0;
    E.runSingleAttack('opp', 0);           // 1回目: 必ず成功のはず
    if (!def.enduring) { secondOk = -9999; break; }   // 1回目失敗ならテスト前提が崩れる
    def.enduring = false;                  // ターンをまたいだ想定(体勢だけクリア・連続カウントは保持)
    E.runSingleAttack('opp', 0);           // 2回目: 成功率1/3のはず
    if (def.enduring) secondOk++;
  }
  const rate = secondOk / N;
  check(`S13 [W3 第六世代以降「成功率は1/3になる」] 2回目の成功率が約1/3(実測${(rate * 100).toFixed(1)}%・許容20〜47%)`,
    secondOk >= 0 && rate >= 0.20 && rate <= 0.47, `secondOk=${secondOk}/${N}`);
} catch (e) { check('S13 実行', false, e.message); }

// ─────────────────────────────────────────────
console.log('\n=== S14: こらえるの優先度+4 [出典W3/B3] ===');
try {
  const mv = moveByKey('koraeru');
  const ef = ((mv.battle_data && mv.battle_data.effects) || []).find(e => e.kind === 'こらえる');
  const pri = (mv.battle_data && mv.battle_data.priority != null) ? mv.battle_data.priority
            : (ef && ef.priority != null) ? ef.priority : null;
  check('S14 [W3「+4(第五世代以降)」/B3 "priority of +4"] こらえるの優先度宣言が+4',
    pri === 4, `priority=${pri} battle_data.priority=${mv.battle_data && mv.battle_data.priority}`);
} catch (e) { check('S14 実行', false, e.message); }

// ===== 結果 =====
console.log('\n========================================');
console.log(`結果: pass=${pass} fail=${fail}`);
if (fails.length) { console.log('失敗:'); fails.forEach(f => console.log('  ・' + f)); }
process.exit(fail ? 1 : 0);
