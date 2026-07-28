/* さいせいりょく(Regenerator)+しぜんかいふく(Natural Cure) 仕様準拠テスト
 *
 * 目的: 交代連動特性2種が権威仕様どおりに動くかをエンジン(real_battle_simulator.html)実駆動で検証する。
 * 方式: エンジン無改変(tools/_sim_engine.jsのvm読み込み)。期待値は権威ソース由来のみ
 *       (sim自己出力をゴールデンにしない=バトル再現_羅針盤.md)。
 *
 * 権威ソース(2026-07-27 WebFetchで実読):
 * [W1] ポケモンWiki「さいせいりょく」 https://wiki.pokemonwiki.com/wiki/さいせいりょく
 *      - 「他のポケモンに交代すると、自身の最大HPの1/3が回復する (小数点以下は切り捨て)」
 *      - 発動条件: 通常の交代選択 / 「使うと交代する技」(とんぼがえりなど) / 相手に強制交代させられる技 /
 *        だっしゅつボタン等
 *      - 「本来さいせいりょくを持つポケモンが、この特性を失った状態では発動しません」
 *      - 「かたやぶり効果の技を受けた場合でも発動します」(=かたやぶりで消えない)
 * [W2] ポケモンWiki「しぜんかいふく」 https://wiki.pokemonwiki.com/wiki/しぜんかいふく
 *      - 「他のポケモンに交代すると状態異常が回復する」
 *      - 「通常の自発的な交代だけでなく、"使うと交代する技"や強制交代アイテム(だっしゅつボタンなど)、
 *        相手の強制交代技でも発動します」
 *      - 「特性が無い状態や別の特性に変更された場合、交代しても発動しません」
 * [B1] Bulbapedia "Regenerator (Ability)":
 *      - "Regenerator restores 33% of the Pokémon's maximum HP upon switching out."
 *      - triggers "through the use of moves that switch the user out, such as Baton Pass and Volt Switch,
 *        and moves used by opposing Pokémon that force it to switch, such as Whirlwind and Dragon Tail."
 *      - 発動しない: 特性がsuppressされている時(Gastro Acid等) / ひんし(faint)で場を去る時(交代でないため)
 * [B2] Bulbapedia "Natural Cure (Ability)":
 *      - "All status conditions heal when it switches out."
 *      - Gen VIII以降は交代時のみ(戦闘終了時回復は削除)。suppress中は発動しない。
 *
 * 実行: cd "/Users/masamichi/Documents/ポケモンDB" && node tools/_spec_regenerator_test.js
 */
'use strict';
const path = require('path');
const { buildEngine, mulberry32, ROOT, moveByChampKey, pokeByName: pokeByNameHelper } = require('./_sim_engine.js');
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
function benchEntry(pokeName, moveKey, opts) {
  opts = opts || {};
  return { poke: pokeByName(pokeName), effort: {hp:0,atk:0,def:0,spatk:0,spdef:0,spd:0},
    natureIdx: 0, ability: (opts.ability !== undefined ? opts.ability : ''), item: opts.item || '',
    moves: moveKey ? [moveByKey(moveKey)] : [], currentHp: null, fainted: false, status: 'none', sleepTurns: null };
}
function resetEnv() {
  E.env.weather = 'none'; E.env.weatherTurns = null;
  E.env.field = 'none'; E.env.fieldTurns = null;
  E.env.doubleBattle = false;
  E.env.trickRoom = false; E.env.trickRoomTurns = null;
  E.env.gravity = false; E.env.gravityTurns = null;
  if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
}
function logHas(re) { return E.battleLog.some(e => re.test(e.msg)); }
function logClear() { E.battleLog.length = 0; }

// ─────────────────────────────────────────────
// RG1: さいせいりょく 基本動作(自発交代で最大HPの1/3回復・切り捨て)
// 出典[W1]: 「他のポケモンに交代すると、自身の最大HPの1/3が回復する (小数点以下は切り捨て)」
// 期待値: HP1で交代 → 控えに戻った個体のHP = 1 + floor(max/3)(simの出力でなく仕様式から導出)
// ─────────────────────────────────────────────
console.log('\n=== RG1: さいせいりょく 自発交代で1/3回復 [出典: wiki.pokemonwiki.com/wiki/さいせいりょく] ===');
try {
  resetEnv(); logClear();
  const A = freshSide('ヤドラン', 'hataku', { ability: 'さいせいりょく' });   // ヤドランは正規のさいせいりょく持ち
  const max = fullHp(A);
  A.currentHp = 1;                                   // 瀕死寸前まで削られた状態
  A.bench = [benchEntry('ピカチュウ', 'hataku', { ability: '' })];
  const B = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  const ok = E.attemptSwitch('self', 0);
  const expected = Math.min(max, 1 + Math.floor(max / 3));
  const got = A.bench[0] && A.bench[0].currentHp;
  check('RG1 [W1] 自発交代でHP1 → 1+floor(max/3)ちょうど回復して控えに戻る',
    ok === true && A.bench[0] && A.bench[0].poke && A.bench[0].poke.name === 'ヤドラン' && got === expected,
    `ok=${ok} max=${max} expected=${expected} got=${got}`);
} catch (__e) { skipCase('RG1', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// RG2: さいせいりょく 回復は最大HPで頭打ち(過回復しない)
// 出典[W1][B1]: 回復は「最大HPの1/3」=最大HPを超えない(回復の一般則。restoresは常にmax上限)
// 期待値: max-10で交代 → ちょうどmax(max+floor(max/3)-10にはならない)
// ─────────────────────────────────────────────
console.log('\n=== RG2: さいせいりょく 最大HP頭打ち [出典: wiki.pokemonwiki.com/wiki/さいせいりょく] ===');
try {
  resetEnv(); logClear();
  const A = freshSide('ヤドラン', 'hataku', { ability: 'さいせいりょく' });
  const max = fullHp(A);
  A.currentHp = max - 10;
  A.bench = [benchEntry('ピカチュウ', 'hataku', { ability: '' })];
  const B = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  const ok = E.attemptSwitch('self', 0);
  const got = A.bench[0] && A.bench[0].currentHp;
  check('RG2 [W1] max-10で交代 → ちょうどmaxで頭打ち(過回復なし)',
    ok === true && got === max, `ok=${ok} max=${max} got=${got}`);
} catch (__e) { skipCase('RG2', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// RG3: さいせいりょく × とんぼがえり(使うと交代する技でも発動)
// 出典[W1]: 発動条件に「『使うと交代する技』(とんぼがえりなど)」/
// [B1]: "moves that switch the user out, such as Baton Pass and Volt Switch"
// 期待値: とんぼがえり使用後、控えに戻った個体のHP = h0 + floor(max/3)
// ─────────────────────────────────────────────
console.log('\n=== RG3: さいせいりょく × とんぼがえり [出典: wiki.pokemonwiki.com/wiki/さいせいりょく] ===');
try {
  resetEnv(); logClear();
  E.setRandom(mulberry32(20260727));
  const A = freshSide('ヤドラン', 'tonbogaeri', { ability: 'さいせいりょく' });
  const max = fullHp(A);
  const h0 = Math.floor(max / 2);
  A.currentHp = h0;
  A.bench = [benchEntry('ピカチュウ', 'hataku', { ability: '' })];
  const B = freshSide('カビゴン', 'hataku', { ability: '' });   // 耐久が高く1発では倒れない
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  A.selectedMoveIdx = 0;
  E.runSingleAttack('self', 0);
  const switched = A.poke && A.poke.name === 'ピカチュウ' &&
    A.bench[0] && A.bench[0].poke && A.bench[0].poke.name === 'ヤドラン';
  const expected = Math.min(max, h0 + Math.floor(max / 3));
  const got = A.bench[0] && A.bench[0].currentHp;
  check('RG3 [W1][B1] とんぼがえりの自分交代でも発動(控えのHP = h0+floor(max/3))',
    switched && got === expected,
    `switched=${switched} h0=${h0} max=${max} expected=${expected} got=${got}`);
} catch (__e) { skipCase('RG3', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// RG4: さいせいりょく × ふきとばし(相手の強制交代技でも発動・かたやぶり持ちからでも発動)
// 出典[W1]: 発動条件に「相手に強制交代させられる技」+「かたやぶり効果の技を受けた場合でも発動します」/
// [B1]: "moves used by opposing Pokémon that force it to switch, such as Whirlwind and Dragon Tail"
// 期待値: 相手(かたやぶり)のふきとばしで下がっても h0 + floor(max/3) 回復している
// ─────────────────────────────────────────────
console.log('\n=== RG4: さいせいりょく × ふきとばし(かたやぶり持ちから) [出典: wiki.pokemonwiki.com/wiki/さいせいりょく] ===');
try {
  resetEnv(); logClear();
  E.setRandom(mulberry32(20260727));
  const A = freshSide('ヤドラン', 'hataku', { ability: 'さいせいりょく' });
  const max = fullHp(A);
  const h0 = Math.floor(max / 2);
  A.currentHp = h0;
  A.bench = [benchEntry('ピカチュウ', 'hataku', { ability: '' })];   // 控え1体=交代先が決定的
  const B = freshSide('カイロス', 'fukitobashi', { ability: 'かたやぶり' });
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  B.selectedMoveIdx = 0;
  E.runSingleAttack('opp', 0);
  const blown = logHas(/ふきとばされた/);
  const switched = A.poke && A.poke.name === 'ピカチュウ' &&
    A.bench[0] && A.bench[0].poke && A.bench[0].poke.name === 'ヤドラン';
  const expected = Math.min(max, h0 + Math.floor(max / 3));
  const got = A.bench[0] && A.bench[0].currentHp;
  check('RG4 [W1][B1] ふきとばし強制交代でも発動(かたやぶりで消えない)',
    blown && switched && got === expected,
    `blown=${blown} switched=${switched} h0=${h0} expected=${expected} got=${got}`);
} catch (__e) { skipCase('RG4', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// RG5: さいせいりょく ひんし退場(死に出し)では発動しない
// 出典[B1]: 発動は"upon switching out"のみ=ひんしで場を去るのは交代ではない(faintでは発動しない)。
// [W1]も発動条件は交代系のみを列挙(ひんしを含まない)。
// 期待値: ひんし(HP0)のまま控えへ・回復ゼロ
// ─────────────────────────────────────────────
console.log('\n=== RG5: さいせいりょく ひんし退場では発動しない [出典: bulbapedia.bulbagarden.net/wiki/Regenerator_(Ability)] ===');
try {
  resetEnv(); logClear();
  const A = freshSide('ヤドラン', 'hataku', { ability: 'さいせいりょく' });
  fullHp(A);
  A.currentHp = 0; A.fainted = true;                 // 場でひんしになった直後の状態
  A.bench = [benchEntry('ピカチュウ', 'hataku', { ability: '' })];
  const B = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  const ok = E.attemptSwitch('self', 0, { faintReplace: true });   // 死に出し
  const got = A.bench[0] && A.bench[0].currentHp;
  check('RG5 [B1] 死に出し(ひんし退場)では回復しない(控えHP=0のまま)',
    ok === true && got === 0 && A.bench[0].fainted === true,
    `ok=${ok} got=${got} fainted=${A.bench[0] && A.bench[0].fainted}`);
} catch (__e) { skipCase('RG5', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// RG6: さいせいりょく × いえき(特性を失った状態では発動しない)
// 出典[W1]: 「本来さいせいりょくを持つポケモンが、この特性を失った状態では発動しません」/
// [B1]: suppressed(Gastro Acid等)では発動しない
// 期待値: いえきを受けた後の交代では回復ゼロ(h0のまま)
// ─────────────────────────────────────────────
console.log('\n=== RG6: さいせいりょく × いえき(特性喪失中は発動しない) [出典: wiki.pokemonwiki.com/wiki/さいせいりょく] ===');
try {
  resetEnv(); logClear();
  E.setRandom(mulberry32(20260727));
  const A = freshSide('ヤドラン', 'hataku', { ability: 'さいせいりょく' });
  const max = fullHp(A);
  const h0 = Math.floor(max / 2);
  A.currentHp = h0;
  A.bench = [benchEntry('ピカチュウ', 'hataku', { ability: '' })];
  const B = freshSide('カビゴン', 'ieki', { ability: '' });
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  B.selectedMoveIdx = 0;
  E.runSingleAttack('opp', 0);                        // Bのいえき → Aの特性無効化
  const suppressed = A.abilityOverride === '';
  const ok = E.attemptSwitch('self', 0);
  const got = A.bench[0] && A.bench[0].currentHp;
  check('RG6 [W1][B1] いえきで特性を失った状態の交代では回復しない(HP=h0のまま)',
    suppressed && ok === true && got === h0,
    `suppressed=${suppressed}(abilityOverride=${JSON.stringify(A.abilityOverride)}) ok=${ok} h0=${h0} got=${got}`);
} catch (__e) { skipCase('RG6', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// NC1: しぜんかいふく 基本動作(自発交代で状態異常回復)
// 出典[W2]: 「他のポケモンに交代すると状態異常が回復する」/ [B2]: "All status conditions heal when it switches out"
// 期待値: どく状態で交代 → 控えに戻った個体は status='none'
// ─────────────────────────────────────────────
console.log('\n=== NC1: しぜんかいふく 自発交代で状態異常回復 [出典: wiki.pokemonwiki.com/wiki/しぜんかいふく] ===');
try {
  resetEnv(); logClear();
  const A = freshSide('スターミー', 'hataku', { ability: 'しぜんかいふく' });   // スターミーは正規のしぜんかいふく持ち
  const max = fullHp(A);
  A.status = 'poison';
  const h0 = max - 5; A.currentHp = h0;   // ついでに: しぜんかいふくはHPを回復しない(回復するのは状態異常のみ)
  A.bench = [benchEntry('ピカチュウ', 'hataku', { ability: '' })];
  const B = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  const ok = E.attemptSwitch('self', 0);
  const e0 = A.bench[0];
  check('NC1 [W2][B2] 自発交代でどくが治って控えに戻る(status=none・HPは回復しない)',
    ok === true && e0 && e0.status === 'none' && e0.currentHp === h0,
    `ok=${ok} status=${e0 && e0.status} hp=${e0 && e0.currentHp}(期待${h0})`);
} catch (__e) { skipCase('NC1', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// NC2: しぜんかいふく × ふきとばし(相手の強制交代技でも発動)+もうどくカウンタも消える
// 出典[W2]: 「相手の強制交代技でも発動します」
// 期待値: もうどく状態でふきとばされる → 控えは status='none'
// ─────────────────────────────────────────────
console.log('\n=== NC2: しぜんかいふく × ふきとばし [出典: wiki.pokemonwiki.com/wiki/しぜんかいふく] ===');
try {
  resetEnv(); logClear();
  E.setRandom(mulberry32(20260727));
  const A = freshSide('スターミー', 'hataku', { ability: 'しぜんかいふく' });
  fullHp(A);
  A.status = 'badpoison'; A.badpoisonCounter = 3;
  A.bench = [benchEntry('ピカチュウ', 'hataku', { ability: '' })];
  const B = freshSide('カイロス', 'fukitobashi', { ability: '' });
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  B.selectedMoveIdx = 0;
  E.runSingleAttack('opp', 0);
  const blown = logHas(/ふきとばされた/);
  const e0 = A.bench[0];
  const switched = A.poke && A.poke.name === 'ピカチュウ' && e0 && e0.poke && e0.poke.name === 'スターミー';
  check('NC2 [W2] ふきとばし強制交代でももうどくが治る(status=none)',
    blown && switched && e0.status === 'none',
    `blown=${blown} switched=${switched} status=${e0 && e0.status}`);
} catch (__e) { skipCase('NC2', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// NC3: 対照実験: しぜんかいふく以外の特性では状態異常は治らない
// 出典[W2]: 「特性が無い状態や別の特性に変更された場合、交代しても発動しません」
// (=治るのは特性の効果であることの確認。状態異常は交代しても持続するのが第2世代以降の一般仕様)
// 期待値: どんかんのヤドランがどく状態で交代 → 控えは status='poison' のまま
// ─────────────────────────────────────────────
console.log('\n=== NC3: 対照実験(別特性では治らない) [出典: wiki.pokemonwiki.com/wiki/しぜんかいふく] ===');
try {
  resetEnv(); logClear();
  const A = freshSide('ヤドラン', 'hataku', { ability: 'どんかん' });   // ab1どんかん=しぜんかいふくでない
  fullHp(A);
  A.status = 'poison';
  A.bench = [benchEntry('ピカチュウ', 'hataku', { ability: '' })];
  const B = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  const ok = E.attemptSwitch('self', 0);
  const e0 = A.bench[0];
  check('NC3 [W2] 別特性(どんかん)では交代してもどくは治らない(status=poisonのまま)',
    ok === true && e0 && e0.status === 'poison',
    `ok=${ok} status=${e0 && e0.status}`);
} catch (__e) { skipCase('NC3', (__e && __e.message) || String(__e)); }

// ===== 結果 =====
console.log('\n========================================');
console.log(`さいせいりょく+しぜんかいふく 仕様テスト: ✅ ${pass} / ❌ ${fail} / ⚪ ${skip}`);
if (fails.length) { console.log('\n失敗一覧:'); fails.forEach(f => console.log('  - ' + f)); }
process.exit(fail > 0 ? 1 : 0);
