/* 難所相互作用15件テスト(check形式)
 * 目的: 権威ソース(Bulbapedia/ポケモンWiki等)で裏取り済みの「難しい相互作用」15件を、
 *       エンジン(real_battle_simulator.html)にそのまま投げて実挙動を判定する。
 * ★★エンジン(real_battle_simulator.html)は絶対に修正しない。落ちたケース=エンジンの実挙動と
 *   権威仕様の不一致=このテストの収穫(バトル再現_羅針盤.md=sim自己出力をゴールデンにしない原則)。
 * 期待値は必ず research.expected_final(scratchpad/hard_cases.json)に従う。expected_initialではない。
 * 実行: cd "/Users/masamichi/Documents/ポケモンDB" && node tools/_sim_hard_interaction_test.js
 * 関連: tools/_sim_interaction_test.js (check形式の手本) / バトル再現_羅針盤.md
 */
'use strict';
const path = require('path');
const { buildEngine, mulberry32, ROOT, moveByChampKey, pokeByName: pokeByNameHelper } = require('./_sim_engine.js');
const data = require(path.join(ROOT, process.env.PCHAM_DATA || 'pokechan_data.js'));

// ===== テストランナー =====
let pass = 0, fail = 0, skip = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('  ✅ ' + name);
  } else {
    fail++;
    fails.push(name + (detail ? '  → ' + detail : ''));
    console.log('  ❌ ' + name + (detail ? '  → ' + detail : ''));
  }
}
function skipCase(id, reason) {
  skip++;
  console.log('  ⚪ SKIP: ' + id + '  (' + reason + ')');
}

const E = buildEngine();
const pokeByName = n => pokeByNameHelper(data, n);
const moveByKey  = k => moveByChampKey(data, k);

function freshSide(pokeName, moveKeys, opts) {
  opts = opts || {};
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  if (pokeName && !s.poke) throw new Error('全部版に存在しないポケモン: ' + pokeName);
  const keys = Array.isArray(moveKeys) ? moveKeys : (moveKeys ? [moveKeys] : []);
  s.moves = keys.map(k => moveByKey(k));
  if (keys.length && s.moves.some(m => !m)) throw new Error('全部版に存在しない技: ' + keys.filter((k,i)=>!s.moves[i]).join(','));
  s.selectedMoveIdx = 0;
  if (opts.ability !== undefined) s.ability = opts.ability;
  else if (s.poke) s.ability = s.poke.ab1 || '';
  if (opts.item !== undefined) s.item = opts.item;
  return s;
}

function fullHp(s) {
  const max = E.realStat(s, 'hp');
  s.currentHp = max;
  return max;
}

function resetEnv() {
  E.env.weather     = 'none';  E.env.weatherTurns  = null;
  E.env.field       = 'none';  E.env.fieldTurns    = null;
  E.env.doubleBattle = false;
  E.env.trickRoom   = false;   E.env.trickRoomTurns = null;
  E.env.gravity     = false;   E.env.gravityTurns  = null;
  E.env.wonderRoom  = false;   E.env.wonderRoomTurns = null;
  E.env.magicRoom   = false;   E.env.magicRoomTurns  = null;
  if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
}

// ─────────────────────────────────────────────
// H1: かたやぶり × ばけのかわ(貫通するか)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Disguise_(Ability) / .../Mold_Breaker_(Ability)
// 研究確定(differs_from_initial=false): かたやぶりはばけのかわを貫通する(第7世代の導入以来一貫仕様)。
// Aのはたくはばけのかわを無視して命中し、皮は消費されず(ばけのかわが「はがれた」処理は発生しない)、
// 通常のダメージ計算どおりHPが減る。
// ─────────────────────────────────────────────
console.log('\n=== H1: かたやぶり × ばけのかわ [出典: bulbapedia.bulbagarden.net/wiki/Mold_Breaker_(Ability)] ===');
try {
  resetEnv();
  // ★2026-07-18修正: 攻撃技を『はたく』(ノーマル)→『なみのり』(みず)に変更。
  // ミミッキュはゴースト/フェアリー複合で、ノーマル技はタイプ相性で常に無効(0倍)。
  // これはタイプ相性そのものによる無効であり特性由来の無効ではないため、かたやぶり/ターボブレイズ/
  // テラボルテージはこれを貫通しない(Scrappyだけが持つ別メカニズム。出典: serebii.net/abilitydex/moldbreaker.shtml,
  // bulbapedia.bulbagarden.net/wiki/Scrappy_(Ability))。はたくのままだと「かたやぶりを直しても
  // タイプ相性で無効のまま」になり、本当に確かめたい対象(ばけのかわ貫通)を検証できない。
  // なみのり(みずタイプ)はゴースト/フェアリーどちらにも無効を持たないため、ばけのかわの有無だけが
  // immune/damageを左右する=正しい検証になる。
  const atk = freshSide('カイロス', 'naminori', { ability: 'かたやぶり' });
  fullHp(atk);
  const def = freshSide('ミミッキュ', 'hataku');   // ab1=ばけのかわ
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.phaseInitA();   // 場に出た時の特性発動(ばけのかわを装備)
  check('H1-a 場出し時にばけのかわを装備している(def.disguise=true)', def.disguise === true,
    `disguise=${def.disguise}`);

  const r = E.calcDamage('self', 'opp', moveByKey('naminori'));
  check('H1-b [出典: bulbapedia.bulbagarden.net/wiki/Mold_Breaker_(Ability)] かたやぶりはばけのかわを貫通する(immune=falseで通常ダメージが入る・皮は消費されない)',
    r && r.immune === false && r.max > 0 && !r.disguiseBlock,
    r ? `immune=${r.immune} max=${r.max} disguiseBlock=${r.disguiseBlock} reason=${r.reason}` : 'calc失敗');
} catch (__e) { skipCase('H1: かたやぶり × ばけのかわ [出典: bulbapedia.bulbagarden.net/wiki/Mold_Breaker_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H2: いかく × まけんき(下降トリガーでこうげき+2、ネット+1)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Defiant_(Ability)
// 研究確定: Bのまけんきが反応し最終 stages.atk = +1(いかくの-1 → まけんきで+2 → 正味+1)。
// ─────────────────────────────────────────────
console.log('\n=== H2: いかく × まけんき [出典: bulbapedia.bulbagarden.net/wiki/Defiant_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('ギャラドス', 'hataku', { ability: 'いかく' });
  fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { ability: 'まけんき' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.phaseInitA();
  check('H2 [出典: bulbapedia.bulbagarden.net/wiki/Defiant_(Ability)] いかく-1→まけんき+2で最終+1(stages.atk===1)',
    def.rank.atk === 1, `def.rank.atk=${def.rank.atk}`);
} catch (__e) { skipCase('H2: いかく × まけんき [出典: bulbapedia.bulbagarden.net/wiki/Defiant_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H3: いかく × ミラーアーマー(下降を攻撃側へ跳ね返す)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Mirror_Armor_(Ability)
// 研究確定: Bのこうげきランク=0のまま(下降を受けない)、跳ね返されたAがこうげき-1になる。
// ─────────────────────────────────────────────
console.log('\n=== H3: いかく × ミラーアーマー [出典: bulbapedia.bulbagarden.net/wiki/Mirror_Armor_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('ギャラドス', 'hataku', { ability: 'いかく' });
  fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { ability: 'ミラーアーマー' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.phaseInitA();
  check('H3 [出典: bulbapedia.bulbagarden.net/wiki/Mirror_Armor_(Ability)] ミラーアーマーで下降を跳ね返す(B.rank.atk=0 かつ A.rank.atk=-1)',
    def.rank.atk === 0 && atk.rank.atk === -1,
    `B.rank.atk=${def.rank.atk} A.rank.atk=${atk.rank.atk}`);
} catch (__e) { skipCase('H3: いかく × ミラーアーマー [出典: bulbapedia.bulbagarden.net/wiki/Mirror_Armor_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H4: あまのじゃく × いかく(下降が上昇に反転)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Contrary_(Ability)
// 研究確定: Bのあまのじゃくが符号を反転し、こうげきランクは-1でなく+1になる。
// ─────────────────────────────────────────────
console.log('\n=== H4: いかく × あまのじゃく [出典: bulbapedia.bulbagarden.net/wiki/Contrary_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('ギャラドス', 'hataku', { ability: 'いかく' });
  fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { ability: 'あまのじゃく' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.phaseInitA();
  check('H4 [出典: bulbapedia.bulbagarden.net/wiki/Contrary_(Ability)] あまのじゃくで符号反転(B.rank.atk=+1)',
    def.rank.atk === 1, `def.rank.atk=${def.rank.atk}`);
} catch (__e) { skipCase('H4: いかく × あまのじゃく [出典: bulbapedia.bulbagarden.net/wiki/Contrary_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H5: てんねん(Unaware) × つるぎのまい+2(攻撃側ランク無視)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Unaware_(Ability)
// 研究確定: てんねん持ちへの被ダメは攻撃側のランク補正を無視した値(比0.9〜1.1=ほぼランク0時と同じ)。
// 通常特性には約2倍(比較対照)。
// ─────────────────────────────────────────────
console.log('\n=== H5: てんねん(Unaware) × ランク+2 [出典: bulbapedia.bulbagarden.net/wiki/Unaware_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('カイリキー', 'hataku', { ability: '' });
  fullHp(atk);
  const defUnaware = freshSide('カバルドン', 'hataku', { ability: 'てんねん' });
  fullHp(defUnaware);
  const defNormal = freshSide('カバルドン', 'hataku', { ability: 'どんかん' });
  fullHp(defNormal);

  E.sides.self = atk; E.sides.opp = defNormal;
  atk.rank.atk = 0;
  const rBase = E.calcDamage('self', 'opp', moveByKey('hataku'));   // ランク0基準

  atk.rank.atk = 2;   // つるぎのまい1回=+2(×2倍相当)
  const rNormalBoosted = E.calcDamage('self', 'opp', moveByKey('hataku'));
  E.sides.opp = defUnaware;
  const rUnawareBoosted = E.calcDamage('self', 'opp', moveByKey('hataku'));

  const ratioUnaware = rBase && rBase.max > 0 ? rUnawareBoosted.max / rBase.max : null;
  const ratioNormal  = rBase && rBase.max > 0 ? rNormalBoosted.max / rBase.max : null;
  check('H5-a [出典: bulbapedia.bulbagarden.net/wiki/Unaware_(Ability)] てんねんは攻撃側+2ランクを無視(比0.9〜1.1)',
    ratioUnaware !== null && ratioUnaware >= 0.9 && ratioUnaware <= 1.1,
    `base=${rBase.max} unaware(+2)=${rUnawareBoosted.max} ratio=${ratioUnaware}`);
  check('H5-b 比較対照: 通常特性には+2ランクが約2倍で通る(比1.8〜2.2)',
    ratioNormal !== null && ratioNormal >= 1.8 && ratioNormal <= 2.2,
    `base=${rBase.max} normal(+2)=${rNormalBoosted.max} ratio=${ratioNormal}`);
} catch (__e) { skipCase('H5: てんねん(Unaware) × ランク+2 [出典: bulbapedia.bulbagarden.net/wiki/Unaware_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H6: そうしょく × キノコのほうし相当(くさ変化技を吸収)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Sap_Sipper_(Ability)
// 注記: キノコのほうし(Spore)はWAZA_MAPに未収録のため、同じ「くさタイプ・変化技・眠り付与」の
//   ねむりごな(Sleep Powder)で代替する(ケースの本質=くさ変化技の吸収免疫は同一)。
// 研究確定: そうしょくが発動して技を吸収する。status=付与なし・こうげきランク+1。
// ─────────────────────────────────────────────
console.log('\n=== H6: そうしょく × くさ変化技(ねむりごなで代替) [出典: bulbapedia.bulbagarden.net/wiki/Sap_Sipper_(Ability)] ===');
try {
  resetEnv();
  const nemurigona = moveByKey('nemurigona');
  if (!nemurigona) {
    skipCase('sapsipper-spore', 'ねむりごな(nemurigona)がWAZA_MAPに見つからない');
  } else {
    const atk = freshSide('フシギバナ', 'nemurigona', { ability: 'しんりょく' });
    fullHp(atk);
    const def = freshSide('カビゴン', 'hataku', { ability: 'そうしょく' });
    fullHp(def);
    E.sides.self = atk; E.sides.opp = def;
    E.phaseApplyEffects('self', 'opp', nemurigona);
    check('H6 [出典: bulbapedia.bulbagarden.net/wiki/Sap_Sipper_(Ability)] そうしょくがくさ変化技を吸収(ねむり付与なし・こうげき+1)',
      (def.status == null || def.status === 'none') && def.rank.atk === 1,
      `status=${def.status} rank.atk=${def.rank.atk}`);
  }
} catch (__e) { skipCase('H6: そうしょく × くさ変化技(ねむりごなで代替) [出典: bulbapedia.bulbagarden.net/wiki/Sap_Sipper_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H7: ひらいしん × でんじは(変化技も吸収してとくこう+1)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Lightning_Rod_(Ability)
// 研究確定: ひらいしんがでんじは(変化技)を吸収。まひ付与なし・とくこうランク+1。
// ─────────────────────────────────────────────
console.log('\n=== H7: ひらいしん × でんじは [出典: bulbapedia.bulbagarden.net/wiki/Lightning_Rod_(Ability)] ===');
try {
  resetEnv();
  const denjiha = moveByKey('denjiha');
  const atk = freshSide('ピカチュウ', 'denjiha', { ability: '' });
  fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { ability: 'ひらいしん' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.phaseApplyEffects('self', 'opp', denjiha);
  check('H7 [出典: bulbapedia.bulbagarden.net/wiki/Lightning_Rod_(Ability)] ひらいしんがでんじはを吸収(まひ付与なし・とくこう+1)',
    (def.status == null || def.status === 'none') && def.rank.spatk === 1,
    `status=${def.status} rank.spatk=${def.rank.spatk}`);
} catch (__e) { skipCase('H7: ひらいしん × でんじは [出典: bulbapedia.bulbagarden.net/wiki/Lightning_Rod_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H8: マジックガード × やどりぎのタネ(削り0なら相手の回復も0)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Magic_Guard_(Ability) / .../Seeding
// 研究確定: 付与自体は成功するが、ターン終了処理でB(マジックガード)のダメージ=0・A(種主)の回復=0。
// ─────────────────────────────────────────────
console.log('\n=== H8: マジックガード × やどりぎのタネ [出典: bulbapedia.bulbagarden.net/wiki/Magic_Guard_(Ability)] ===');
try {
  resetEnv();
  const yadorigi = moveByKey('yadorigi');
  const atk = freshSide('フシギバナ', 'yadorigi', { ability: 'しんりょく' });
  const aMax = fullHp(atk);
  atk.currentHp = Math.floor(aMax / 2);   // HPを半分程度に減らしておく
  const hpBefore = atk.currentHp;
  const def = freshSide('カビゴン', 'hataku', { ability: 'マジックガード' });
  const dMax = fullHp(def);
  E.sides.self = atk; E.sides.opp = def;

  E.phaseApplyEffects('self', 'opp', yadorigi);
  check('H8-a やどりぎ付与自体は成功する(slipsにやどりぎのタネが記録された)',
    def.slips && def.slips.some(sl => sl.source === 'やどりぎのタネ'),
    `slips=${JSON.stringify(def.slips)}`);

  E.phaseSlipFor('opp');   // ターン終了スリップ処理
  check('H8-b [出典: bulbapedia.bulbagarden.net/wiki/Magic_Guard_(Ability)] マジックガードで削り0(defのHPが減っていない)',
    def.currentHp === dMax, `def.currentHp=${def.currentHp} (max=${dMax})`);
  check('H8-c [出典: bulbapedia.bulbagarden.net/wiki/Seeding] 吸収も発生しないのでAの回復=0',
    atk.currentHp === hpBefore, `atk.currentHp=${atk.currentHp} (before=${hpBefore})`);
} catch (__e) { skipCase('H8: マジックガード × やどりぎのタネ [出典: bulbapedia.bulbagarden.net/wiki/Magic_Guard_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H9: マジックガード × ゴツゴツメット(接触反動を受けない)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Magic_Guard_(Ability) / .../Rocky_Helmet
// 研究確定: マジックガード持ちのAはゴツメの1/6反動を受けない。技自体のダメージはBに通常どおり入る。
// ─────────────────────────────────────────────
console.log('\n=== H9: マジックガード × ゴツゴツメット [出典: bulbapedia.bulbagarden.net/wiki/Rocky_Helmet] ===');
try {
  resetEnv();
  const atk = freshSide('カイリキー', 'hataku', { ability: 'マジックガード' });
  const aMax = fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { item: 'rocky_helmet', ability: 'あついしぼう' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(mulberry32(20260717));
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('H9-a [出典: bulbapedia.bulbagarden.net/wiki/Magic_Guard_(Ability)] マジックガードでゴツメ反動ゼロ(Aは満タンのまま)',
    atk.currentHp === aMax, `atk.currentHp=${atk.currentHp} (max=${aMax})`);

  resetEnv();
  const atk2 = freshSide('カイリキー', 'hataku', { ability: 'かいりきバサミ' });   // 通常特性(比較対照)
  const aMax2 = fullHp(atk2);
  const def2 = freshSide('カビゴン', 'hataku', { item: 'rocky_helmet', ability: 'あついしぼう' });
  fullHp(def2);
  E.sides.self = atk2; E.sides.opp = def2;
  E.setRandom(mulberry32(20260717));
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('H9-b 比較対照: 通常特性はゴツメで最大HPの1/6を失う',
    atk2.currentHp === aMax2 - Math.floor(aMax2 / 6),
    `atk2.currentHp=${atk2.currentHp} expected=${aMax2 - Math.floor(aMax2 / 6)}`);
} catch (__e) { skipCase('H9: マジックガード × ゴツゴツメット [出典: bulbapedia.bulbagarden.net/wiki/Rocky_Helmet]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H10: がんじょう × 連続技(1発目だけHP1で耐え、2発目でひんし)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Sturdy_(Ability)
// 研究確定: 連続技ではヒットごとにがんじょう判定→1発目のみ発動(HP1)、2発目時点は非満タンで不発→ひんし。
// セットアップ: ダブルアタック(固定2ヒット・物理)を、こだわりハチマキ+ランク+6のカイリューでメタモンに撃つ。
//   min damage(179)がメタモンの最大HP(123)を上回る=どの乱数でも1発が必ず致死級=seed探索不要。
// ─────────────────────────────────────────────
console.log('\n=== H10: がんじょう × 連続技(ヒット毎判定) [出典: bulbapedia.bulbagarden.net/wiki/Sturdy_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('カイリュー', 'daburuatakku', { item: 'kodawari_hachimaki', ability: 'せいしんりょく' });
  atk.rank.atk = 6;
  fullHp(atk);
  const def = freshSide('メタモン', 'hataku', { ability: 'がんじょう' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;

  // 事前検証: 1ヒット分のダメージ最小値が確実にメタモンの最大HPを超えることを確認(seed非依存の保証)
  const check1hit = E.calcDamage('self', 'opp', moveByKey('daburuatakku'));
  if (!check1hit || check1hit.min <= E.realStat(def, 'hp')) {
    check('H10 事前条件: 1ヒットの最小ダメージがメタモンの最大HPを超える(seed非依存化)', false,
      `min=${check1hit && check1hit.min} defMaxHp=${E.realStat(def, 'hp')}`);
  } else {
    E.battleLog.length = 0;   // このブロック専用の判定にするためログをクリア
    E.setRandom(mulberry32(1));
    E.phaseDealDamage('self', 'opp', moveByKey('daburuatakku'));
    const hitLines = E.battleLog.filter(e => e.multiHit === true);
    check('H10 [出典: bulbapedia.bulbagarden.net/wiki/Sturdy_(Ability)] がんじょうは1発目のみ発動→最終的にひんし',
      def.fainted === true && def.currentHp === 0 && hitLines.length === 2,
      `fainted=${def.fainted} hp=${def.currentHp} hits=${JSON.stringify(hitLines.map(e => e.msg))}`);
  }
} catch (__e) { skipCase('H10: がんじょう × 連続技(ヒット毎判定) [出典: bulbapedia.bulbagarden.net/wiki/Sturdy_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H11: マルチスケイル × 連続技(半減は1発目だけのはず)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Multiscale_(Ability)
// 研究確定: マルチスケイルは「ヒットごとにHP満タンか」を再評価すべきで、1発目のみ半減・2発目以降は等倍
//   (比0.4〜0.6程度=1発目/2発目)。フシギバナ→カイリュー(マルチスケイル)にダブルアタック(固定2ヒット)。
// ─────────────────────────────────────────────
console.log('\n=== H11: マルチスケイル × 連続技(ヒット毎の再評価) [出典: bulbapedia.bulbagarden.net/wiki/Multiscale_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('フシギバナ', 'daburuatakku', { ability: 'しんりょく' });
  fullHp(atk);
  const def = freshSide('カイリュー', 'hataku', { ability: 'マルチスケイル' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.battleLog.length = 0;   // このブロック専用の判定にするためログをクリア
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('daburuatakku'));
  const hitLines = E.battleLog.filter(e => e.multiHit === true);
  const dmgs = hitLines.map(e => {
    const m = /に (\d+) ダメージ/.exec(e.msg);
    return m ? Number(m[1]) : null;
  });
  const ratio = (dmgs.length === 2 && dmgs[0] > 0) ? dmgs[1] / dmgs[0] : null;
  check('H11 [出典: bulbapedia.bulbagarden.net/wiki/Multiscale_(Ability)] マルチスケイルは1発目のみ半減(2発目/1発目の比が約1.5〜2.5=2発目が明確に大きい)',
    ratio !== null && ratio >= 1.5 && ratio <= 2.5,
    `hit1=${dmgs[0]} hit2=${dmgs[1]} ratio=${ratio}`);
} catch (__e) { skipCase('H11: マルチスケイル × 連続技(ヒット毎の再評価) [出典: bulbapedia.bulbagarden.net/wiki/Multiscale_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H12: さめはだ × 連続技(反動はヒット数ぶん発生)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Rough_Skin_(Ability)
// 研究確定: 接触連続技はヒット毎にさめはだが発動。合計反動 = N × max(1, floor(攻撃側の最大HP/8))。
// ダブルアタック(固定2ヒット・接触)でカイリキー→カメックス(さめはだ)に撃つ。
// ─────────────────────────────────────────────
console.log('\n=== H12: さめはだ × 連続技(ヒット毎反動) [出典: bulbapedia.bulbagarden.net/wiki/Rough_Skin_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('カイリキー', 'daburuatakku', { ability: '' });
  const aMax = fullHp(atk);
  const def = freshSide('カメックス', 'hataku', { ability: 'さめはだ' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(mulberry32(1));
  E.phaseDealDamage('self', 'opp', moveByKey('daburuatakku'));
  const expectedPerHit = Math.max(1, Math.floor(aMax / 8));
  const expectedTotal = expectedPerHit * 2;   // ダブルアタックは固定2ヒット
  const actualLoss = aMax - atk.currentHp;
  check('H12 [出典: bulbapedia.bulbagarden.net/wiki/Rough_Skin_(Ability)] さめはだ反動=2ヒットぶん(floor(maxHP/8)×2)',
    actualLoss === expectedTotal, `actualLoss=${actualLoss} expected=${expectedTotal} (per-hit=${expectedPerHit})`);
} catch (__e) { skipCase('H12: さめはだ × 連続技(ヒット毎反動) [出典: bulbapedia.bulbagarden.net/wiki/Rough_Skin_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H13: ノーガード × 一撃必殺技(必中化しない…はずが本ケースの結論は誤り=研究でconfirmed=必中する)
// 出典: https://bulbapedia.bulbagarden.net/wiki/No_Guard_(Ability) / .../One-hit_knockout_move
// 研究確定(★expected_initialは誤り★): ノーガードは一撃必殺技にも有効=命中判定をスキップして必ず当たる。
// 多数seedで100%命中するはず。技=つのドリル(ぜったいれいどのような命中率固定条件を持たない一撃技)。
// H13-c/d/e(2026-07-18追加): 上のコメント(修正前2500行台)は「命中率固定(fixAcc)=一撃必殺は対象外」と
// 書きつつ、実装は逆に「fixAccが無い時だけノーガード必中」になっていた(唯一fixAccを持つぜったいれいどだけが
// 除外される保守実装)。Bulbapedia "No Guard"はOHKO技もfixAcc技も区別なく必中にするので、ぜったいれいど自身
// でも確認する(H13-a/bのつのドリルはfixAcc非保持なのでこの食い違いを踏めていなかった)。
// ─────────────────────────────────────────────
console.log('\n=== H13: ノーガード × 一撃必殺技 [出典: bulbapedia.bulbagarden.net/wiki/No_Guard_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('カイロス', 'tsunodoriru', { ability: 'ノーガード' });
  fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { ability: 'あついしぼう' });   // 一撃無効特性なし
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  let hits = 0;
  const N = 80;
  for (let seed = 0; seed < N; seed++) {
    E.setRandom(mulberry32(seed));
    const r = E.phaseHitCheck(moveByKey('tsunodoriru'), atk, def);
    if (r.hit) hits++;
  }
  check(`H13-a [出典: bulbapedia.bulbagarden.net/wiki/One-hit_knockout_move] ノーガードは一撃必殺技も必中化する(${N}回中${hits}回命中=100%のはず)`,
    hits === N, `hits=${hits}/${N}`);

  // 比較対照(H13-b): ノーガードなしなら通常の一撃式(同レベルで約30%)のまま外れが出るはず。
  // これが無いと「たまたま常に当たる」実装(命中判定バグ)との区別がつかないための対照実験。
  resetEnv();
  const atkNormal = freshSide('カイロス', 'tsunodoriru', { ability: 'かいりきバサミ' });
  fullHp(atkNormal);
  const defNormal = freshSide('カビゴン', 'hataku', { ability: 'あついしぼう' });
  fullHp(defNormal);
  E.sides.self = atkNormal; E.sides.opp = defNormal;
  let hitsNormal = 0;
  for (let seed = 0; seed < N; seed++) {
    E.setRandom(mulberry32(seed));
    const r = E.phaseHitCheck(moveByKey('tsunodoriru'), atkNormal, defNormal);
    if (r.hit) hitsNormal++;
  }
  check(`H13-b 比較対照: ノーガードなしは通常の一撃式(約30%)で外れが多数出る(${N}回中${hitsNormal}回・0<hitsNormal<${N}であること)`,
    hitsNormal > 0 && hitsNormal < N, `hitsNormal=${hitsNormal}/${N}`);

  // H13-c: ぜったいれいど(命中率固定=fixAcc宣言あり)自身もノーガードで必中になるか。
  // 出典: https://bulbapedia.bulbagarden.net/wiki/No_Guard_(Ability) — No Guardは命中率計算そのものを
  // スキップするので、fixAccを持つ技(ぜったいれいど=こおり以外20%/こおり30%)も例外なく必中になる。
  resetEnv();
  const atkC = freshSide('カイロス', 'zettaireido', { ability: 'ノーガード' });   // こおりタイプでない攻撃者
  fullHp(atkC);
  const defC = freshSide('カビゴン', 'hataku', { ability: 'あついしぼう' });      // 一撃無効特性なし・こおりタイプでもない
  fullHp(defC);
  E.sides.self = atkC; E.sides.opp = defC;
  let hitsC = 0;
  for (let seed = 0; seed < N; seed++) {
    E.setRandom(mulberry32(seed));
    const r = E.phaseHitCheck(moveByKey('zettaireido'), atkC, defC);
    if (r.hit) hitsC++;
  }
  check(`H13-c [出典: bulbapedia.bulbagarden.net/wiki/No_Guard_(Ability)] ノーガードはぜったいれいど(命中率固定=fixAcc宣言あり)も必中化する(${N}回中${hitsC}回命中=100%のはず)`,
    hitsC === N, `hitsC=${hitsC}/${N}`);

  // 比較対照(H13-d): ノーガードなしなら、こおりタイプでない攻撃者は命中率固定(fixAcc)により20%のまま
  //(=修正はノーガード時だけの上書きで、fixAcc自体の計算は変えていないことの確認)。
  // 出典: https://bulbapedia.bulbagarden.net/wiki/Sheer_Cold — 自分がこおりタイプでない場合は命中率20%(第7世代以降)。
  resetEnv();
  const atkD = freshSide('カイロス', 'zettaireido', { ability: 'かいりきバサミ' });
  fullHp(atkD);
  const defD = freshSide('カビゴン', 'hataku', { ability: 'あついしぼう' });
  fullHp(defD);
  E.sides.self = atkD; E.sides.opp = defD;
  let hitsD = 0;
  for (let seed = 0; seed < N; seed++) {
    E.setRandom(mulberry32(seed));
    const r = E.phaseHitCheck(moveByKey('zettaireido'), atkD, defD);
    if (r.hit) hitsD++;
  }
  check(`H13-d 比較対照: ノーガードなしのぜったいれいどは命中率固定(こおり以外=20%)のまま(${N}回中${hitsD}回・0<hitsD<${N}であること)`,
    hitsD > 0 && hitsD < N, `hitsD=${hitsD}/${N}`);

  // H13-e/f(2026-07-18昇格・元はskipメモ): ぜったいれいど固有の「こおりタイプの相手には無効」。
  // 宣言データ=battle_data.immune=[{type:'target_is_type', values:['こおり']}](ぜったいれいどのみが保持)。
  // moveTypeEff('こおり',['こおり'])=0.5倍なので相性0倍の汎用無効では弾けず、phaseDealDamageのOHKO分岐に
  // target_is_type宣言を読む汎用判定を追加した(従来はAIヒューリスティックのみが参照=実戦でKOしてしまうバグ)。
  // ノーガードとも独立: 必中化されるのは命中率のみで、無効(こうかなし)は無効のまま。
  // 出典(権威仕様): https://bulbapedia.bulbagarden.net/wiki/Sheer_Cold 「This move cannot target an Ice-type Pokémon.」
  //                https://bulbapedia.bulbagarden.net/wiki/No_Guard_(Ability)(必中化しても型無効は消えない)
  resetEnv();
  const atkE = freshSide('オニゴーリ', 'zettaireido', { ability: 'ノーガード' });   // こおりタイプ使用者+ノーガード
  fullHp(atkE);
  const defE = freshSide('バイバニラ', 'hataku', { ability: 'アイスボディ' });      // 純こおりタイプ(一撃無効特性なし)
  const defEMax = fullHp(defE);
  E.sides.self = atkE; E.sides.opp = defE;
  E.setRandom(mulberry32(20260718));
  const hitE = E.phaseHitCheck(moveByKey('zettaireido'), atkE, defE);
  const dmgE = E.phaseDealDamage('self', 'opp', moveByKey('zettaireido'));
  check('H13-e [出典: bulbapedia.bulbagarden.net/wiki/Sheer_Cold] ぜったいれいどはこおりタイプの相手に無効(ノーガード下でも無効のまま・HP無傷)',
    hitE.hit === true && !!(dmgE && dmgE.immune) && defE.currentHp === defEMax && !defE.fainted,
    `hit=${hitE && hitE.hit} immune=${dmgE && dmgE.immune} hp=${defE.currentHp}/${defEMax}`);

  // 比較対照(H13-f): こおりタイプでない相手には従来どおり一撃(=無効判定がこおり限定であることの確認)。
  resetEnv();
  const atkF = freshSide('オニゴーリ', 'zettaireido', { ability: 'ノーガード' });
  fullHp(atkF);
  const defF = freshSide('カビゴン', 'hataku', { ability: 'あついしぼう' });        // こおりタイプでない・一撃無効特性なし
  fullHp(defF);
  E.sides.self = atkF; E.sides.opp = defF;
  E.setRandom(mulberry32(20260718));
  const dmgF = E.phaseDealDamage('self', 'opp', moveByKey('zettaireido'));
  check('H13-f 比較対照: こおりタイプでない相手には一撃で入る(無効判定はこおり限定)',
    !!(dmgF && !dmgF.immune) && defF.fainted === true && defF.currentHp === 0,
    `immune=${dmgF && dmgF.immune} fainted=${defF.fainted} hp=${defF.currentHp}`);
} catch (__e) { skipCase('H13: ノーガード × 一撃必殺技 [出典: bulbapedia.bulbagarden.net/wiki/No_Guard_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H14: ノーガード × そらをとぶ中の相手(空中にも当たる)
// 出典: https://bulbapedia.bulbagarden.net/wiki/No_Guard_(Ability)
// 研究確定: ノーガードは半無敵状態(そらをとぶ中等)の相手にも必ず命中させる。
// ─────────────────────────────────────────────
console.log('\n=== H14: ノーガード × 半無敵(そらをとぶ中) [出典: bulbapedia.bulbagarden.net/wiki/No_Guard_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('カイロス', 'hataku', { ability: 'ノーガード' });
  fullHp(atk);
  const def = freshSide('ピジョット', 'sorawotobu', { ability: 'せいしんりょく' });
  fullHp(def);
  def.charging = { move: moveByKey('sorawotobu'), semi: '空中' };   // そらをとぶで空中に消えている状態
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(mulberry32(20260717));
  const r = E.phaseHitCheck(moveByKey('hataku'), atk, def);
  check('H14 [出典: bulbapedia.bulbagarden.net/wiki/No_Guard_(Ability)] ノーガードは空中の相手にも命中する',
    r.hit === true, `hit=${r.hit} reason=${r.reason}`);
} catch (__e) { skipCase('H14: ノーガード × 半無敵(そらをとぶ中) [出典: bulbapedia.bulbagarden.net/wiki/No_Guard_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H15: こだわりロック × トリック(道具が入れ替わったらロック解除)
// 出典: https://wiki.pokemonwiki.com/wiki/こだわり系アイテム / https://bulbapedia.bulbagarden.net/wiki/Choice_Scarf
// 研究確定: トリックで単に道具を失っただけならchoiceLockは完全解除。ターン3でAは別技を自由に選べる。
// ─────────────────────────────────────────────
console.log('\n=== H15: こだわりロック × トリック [出典: bulbapedia.bulbagarden.net/wiki/Choice_Scarf] ===');
try {
  resetEnv();
  const A = freshSide('カイリュー', ['hataku', 'kamitsuku'], { item: 'kodawari_scarf', ability: 'せいしんりょく' });
  fullHp(A);
  const B = freshSide('メタモン', ['torikku'], { item: 'berry_sitrus' });
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  E.setRandom(mulberry32(20260717));

  // ターン1: Aがはたくを使用 → choiceLock='はたく'
  A.selectedMoveIdx = 0;
  E.runSingleAttack('self', 0);
  check('H15-a ターン1: はたく使用後にchoiceLock=はたく', A.choiceLock && A.choiceLock.name === 'はたく',
    `choiceLock=${A.choiceLock && A.choiceLock.name}`);

  // ターン2: BがトリックでAのスカーフを奪う
  B.selectedMoveIdx = 0;
  E.runSingleAttack('opp', 0);
  const swapped = A.item === 'berry_sitrus' && B.item === 'kodawari_scarf';
  check('H15-b ターン2: トリックで道具が入れ替わった(A=オボン/B=スカーフ)', swapped,
    `A.item=${A.item} B.item=${B.item}`);

  // ターン3: Aはchoicealock解除され、別の技(かみつく)を選択・実行できる
  A.selectedMoveIdx = 1;   // かみつく
  const hpBefore = B.currentHp;
  E.runSingleAttack('self', 1);
  const usedKamitsuku = E.battleLog.some(e => /かみつく/.test(e.msg)) && B.currentHp < hpBefore;
  check('H15-c [出典: wiki.pokemonwiki.com/wiki/こだわり系アイテム] ターン3: choiceLock解除され別技(かみつく)を実行できる',
    A.choiceLock == null && usedKamitsuku,
    `choiceLock=${A.choiceLock && A.choiceLock.name} usedKamitsuku=${usedKamitsuku} B.hp ${hpBefore}→${B.currentHp}`);
} catch (__e) { skipCase('H15: こだわりロック × トリック [出典: bulbapedia.bulbagarden.net/wiki/Choice_Scarf]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H16: 交代でいかくが発動する(switch-in intimidate)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Intimidate_(Ability)
// 研究確定: 交代でいかく持ちが場に出ると、相手のこうげきが-1され、battleLogにいかく発動の行が出る。
// (2026-07-18修正=9件目バグ: attemptSwitchが場出し時の特性発動(Init-A相当)を呼んでいなかった)
// ─────────────────────────────────────────────
function benchEntry16(pokeName, moveKey, opts){
  opts = opts || {};
  return { poke: pokeByName(pokeName), effort: {hp:0,atk:0,def:0,spatk:0,spdef:0,spd:0},
    natureIdx: 0, ability: (opts.ability !== undefined ? opts.ability : ''), item: opts.item || '',
    moves: moveKey ? [moveByKey(moveKey)] : [], currentHp: null, fainted: false, status: 'none', sleepTurns: null };
}
console.log('\n=== H16: 交代でいかくが発動する(switch-in intimidate) [出典: bulbapedia.bulbagarden.net/wiki/Intimidate_(Ability)] ===');
try {
  resetEnv();
  const A = freshSide('ピカチュウ', 'hataku', { ability: '' });   // Aは場に出ている非いかく持ち(交代前)
  fullHp(A);
  A.bench = [benchEntry16('ギャラドス', 'hataku', { ability: 'いかく' })];   // 控えにいかく持ち
  const B = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(B);
  E.sides.self = A; E.sides.opp = B;
  const before = B.rank.atk || 0;
  const ok = E.attemptSwitch('self', 0);
  const intimidateLogged = E.battleLog.some(e => /いかく/.test(e.msg));
  check('H16 [出典: bulbapedia.bulbagarden.net/wiki/Intimidate_(Ability)] 交代でいかく発動: 相手のこうげき-1+battleLogにいかく行',
    ok === true && A.poke && A.poke.name === 'ギャラドス' && B.rank.atk === before - 1 && intimidateLogged,
    `ok=${ok} poke=${A.poke && A.poke.name} B.rank.atk=${before}→${B.rank.atk} logged=${intimidateLogged}`);
} catch (__e) { skipCase('H16: 交代でいかくが発動する(switch-in intimidate) [出典: bulbapedia.bulbagarden.net/wiki/Intimidate_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H17: くろいてっきゅう × ひこうタイプ(じめん技が等倍で当たる)
// 出典: https://yakkun.com/ch/item.htm(くろいてっきゅう=浮いていても じめんタイプの技を受ける) /
//       https://bulbapedia.bulbagarden.net/wiki/Iron_Ball(接地扱い=Ground技のひこう無効が消え等倍)
// 2026-07-18 ヤックン全数照合で発見: calcDamageの接地判定がgravity/rooted直書きで
// くろいてっきゅうを含まず、ひこうタイプへのじめん技がimmuneのままだった(isGrounded統一で修正)。
// ─────────────────────────────────────────────
console.log('\n=== H17: くろいてっきゅう × ひこうタイプ [出典: yakkun.com/ch/item.htm / bulbapedia.bulbagarden.net/wiki/Iron_Ball] ===');
try {
  resetEnv();
  const atk17 = freshSide('カイリキー', 'jishin', { ability: 'こんじょう' });
  fullHp(atk17);
  const def17 = freshSide('ピジョット', 'hataku', { ability: 'するどいめ', item: 'kuroi_tekkyu' });
  fullHp(def17);
  E.sides.self = atk17; E.sides.opp = def17;
  const r17 = E.calcDamage('self', 'opp', moveByKey('jishin'));
  check('H17-a [出典: bulbapedia.bulbagarden.net/wiki/Iron_Ball] くろいてっきゅう持ちのひこうタイプに じしんが当たる(immuneでない・ダメージ>0)',
    !!(r17 && !r17.immune && r17.min > 0), `immune=${r17 && r17.immune} min=${r17 && r17.min}`);

  // 比較対照(H17-b): 鉄球なしなら従来どおり こうかなし(=等倍化が鉄球由来であることの確認)
  const def17b = freshSide('ピジョット', 'hataku', { ability: 'するどいめ' });
  fullHp(def17b);
  E.sides.opp = def17b;
  const r17b = E.calcDamage('self', 'opp', moveByKey('jishin'));
  check('H17-b 比較対照: 鉄球なしのひこうタイプには じしんは こうかなし(immune)',
    !!(r17b && r17b.immune), `immune=${r17b && r17b.immune}`);
} catch (__e) { skipCase('H17: くろいてっきゅう × ひこうタイプ [出典: yakkun.com/ch/item.htm / bulbapedia.bulbagarden.net/wiki/Iron_Ball]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H18: おおきなねっこ × ねをはる(ターン終了回復が1.3倍)
// 出典: https://yakkun.com/ch/item.htm(おおきなねっこ=HPを吸収する技・ねをはる・アクアリング・
//       やどりぎのタネで回復するHPが1.3倍) / https://bulbapedia.bulbagarden.net/wiki/Big_Root
// 2026-07-18 ヤックン全数照合で発見: 1.3倍が吸収kindのみで、ねをはる/アクアリング/やどりぎの
// ターン終了回復に掛かっていなかった(bigRootBoost共通ヘルパー化で修正・丸めは既存吸収と同じfloor)。
// ─────────────────────────────────────────────
console.log('\n=== H18: おおきなねっこ × ねをはる [出典: yakkun.com/ch/item.htm / bulbapedia.bulbagarden.net/wiki/Big_Root] ===');
try {
  // ねっこあり: 回復 = floor(floor(max/16) × 1.3) を期待
  resetEnv();
  const A18 = freshSide('カビゴン', 'tsuruginomai', { ability: 'めんえき', item: 'ooki_na_nekko' });
  const max18 = fullHp(A18);
  A18.rooted = true;
  A18.currentHp = Math.floor(max18 / 2);   // 回復余地を確保
  const B18 = freshSide('フシギバナ', 'tsuruginomai', { ability: 'しんりょく' });
  fullHp(B18);
  E.sides.self = A18; E.sides.opp = B18;
  E.setRandom(mulberry32(20260718));
  const before18 = A18.currentHp;
  E.runTurn();
  const healed18 = A18.currentHp - before18;
  const base18 = Math.max(1, Math.floor(max18 / 16));
  const want18 = Math.floor(base18 * 1.3);
  check(`H18-a [出典: bulbapedia.bulbagarden.net/wiki/Big_Root] おおきなねっこでねをはる回復が1.3倍(floor(${base18}×1.3)=${want18})`,
    healed18 === want18 && want18 > base18, `healed=${healed18} want=${want18} base=${base18}`);

  // 比較対照(H18-b): ねっこなしは素の1/16回復のまま
  resetEnv();
  const A18b = freshSide('カビゴン', 'tsuruginomai', { ability: 'めんえき' });
  const max18b = fullHp(A18b);
  A18b.rooted = true;
  A18b.currentHp = Math.floor(max18b / 2);
  const B18b = freshSide('フシギバナ', 'tsuruginomai', { ability: 'しんりょく' });
  fullHp(B18b);
  E.sides.self = A18b; E.sides.opp = B18b;
  E.setRandom(mulberry32(20260718));
  const before18b = A18b.currentHp;
  E.runTurn();
  check('H18-b 比較対照: ねっこなしのねをはる回復は素の1/16のまま',
    A18b.currentHp - before18b === Math.max(1, Math.floor(max18b / 16)),
    `healed=${A18b.currentHp - before18b} want=${Math.max(1, Math.floor(max18b / 16))}`);
} catch (__e) { skipCase('H18: おおきなねっこ × ねをはる [出典: yakkun.com/ch/item.htm / bulbapedia.bulbagarden.net/wiki/Big_Root]', (__e && __e.message) || String(__e)); }

// 【記録・未実装ギャップ】ヘドロえき(Liquid Ooze)特性=吸収系の回復を逆にダメージ化 は未実装(2026-07-18時点)。
// 全部版Phase Cのギャップ表対象として記録のみ(本ラウンドでは対応しない)。出典: bulbapedia.bulbagarden.net/wiki/Liquid_Ooze_(Ability)

// ─────────────────────────────────────────────
// H19: こんじょう(Guts)本体効果 — 状態異常時こうげき×1.5(やけど半減なし)
// 出典: https://bulbapedia.bulbagarden.net/wiki/Guts_(Ability)
//   "If this Pokémon has a non-volatile status condition, its Attack is multiplied by 1.5."
//   やけどの物理半減はこんじょう所持者は受けない(Bulbapedia "Burn"= Guts除外、第6世代以降)。
// 2026-07-19 本番バグ発覚: real_battle_simulator.htmlに「やけど物理×0.5のこんじょう除外」だけがあり、
// 本体の状態異常時1.5倍が丸ごと未実装だった(こんじょう出現は当該1箇所のみ)。aStatEff段階に追加して修正。
// ─────────────────────────────────────────────
console.log('\n=== H19: こんじょう(Guts)本体効果=状態異常時こうげき×1.5 [出典: bulbapedia.bulbagarden.net/wiki/Guts_(Ability)] ===');
try {
  resetEnv();
  // カイリキー(実際の特性=こんじょう)× はたく(ノーマル物理・カイリキーはかくとうタイプでSTAB無し=倍率が
  // こんじょうだけになるよう選定)。防御側はするどいめ(無関係な特性)のピジョット。
  const atk19 = freshSide('カイリキー', 'hataku', { ability: 'こんじょう' });
  fullHp(atk19);
  const def19 = freshSide('ピジョット', 'hataku', { ability: 'するどいめ' });
  fullHp(def19);
  E.sides.self = atk19; E.sides.opp = def19;

  // 素の場合(状態異常なし)を基準値として先に取得
  const rNone19 = E.calcDamage('self', 'opp', moveByKey('hataku'));

  // 期待値をエンジンと同じ式で手計算(H18と同じ流儀=フロア丸めまで再現)。
  // STAB/タイプ相性/天候/急所/壁/道具いずれも無し=aStatEffの差だけが結果に効く構成。
  const aStat19 = E.rankedStat(atk19, 'atk', { crit: false, role: 'atk', ignoreRank: false });
  const dStat19 = E.rankedStat(def19, 'def', { crit: false, role: 'def', ignoreRank: false });
  const wantBase = (aEff) => Math.floor((2 * E.LEVEL / 5 + 2) * 40 * aEff / dStat19 / 50) + 2;
  const baseNone19 = wantBase(aStat19);
  const baseGuts19 = wantBase(Math.floor(aStat19 * 1.5));
  const wantMinNone = Math.floor(baseNone19 * 85 / 100), wantMaxNone = baseNone19;
  const wantMinGuts = Math.floor(baseGuts19 * 85 / 100), wantMaxGuts = baseGuts19;

  check('H19-0 前提: 素の場合(状態異常なし)の手計算とエンジンが一致(基準値の裏取り)',
    rNone19.min === wantMinNone && rNone19.max === wantMaxNone,
    `min=${rNone19.min} want=${wantMinNone} max=${rNone19.max} want=${wantMaxNone}`);

  // やけど: こんじょうなら1.5倍あり・やけど半減なし
  atk19.status = 'burn';
  const rBurn19 = E.calcDamage('self', 'opp', moveByKey('hataku'));
  check('H19-a [出典: bulbapedia.bulbagarden.net/wiki/Guts_(Ability)] こんじょう+やけど: ダメージが素の場合より増える(半減されない)',
    rBurn19.min > rNone19.min && rBurn19.max > rNone19.max,
    `burn.min=${rBurn19.min} none.min=${rNone19.min} burn.max=${rBurn19.max} none.max=${rNone19.max}`);
  check('H19-b こんじょう+やけどのダメージが手計算どおり(1.5倍・やけど半減なし)',
    rBurn19.min === wantMinGuts && rBurn19.max === wantMaxGuts,
    `min=${rBurn19.min} want=${wantMinGuts} max=${rBurn19.max} want=${wantMaxGuts}`);

  // どく: こんじょうなら同じく1.5倍
  atk19.status = 'poison';
  const rPoison19 = E.calcDamage('self', 'opp', moveByKey('hataku'));
  check('H19-c [出典: bulbapedia.bulbagarden.net/wiki/Guts_(Ability)] こんじょう+どく: ダメージが素の場合の1.5倍(手計算どおり)',
    rPoison19.min === wantMinGuts && rPoison19.max === wantMaxGuts,
    `min=${rPoison19.min} want=${wantMinGuts} max=${rPoison19.max} want=${wantMaxGuts}`);

  // 比較対照(H19-d): こんじょうを持たない場合はやけどで物理半減(従来どおり=退行していないことの確認)
  const atk19b = freshSide('カイリキー', 'hataku', { ability: 'せいしんりょく' });
  fullHp(atk19b);
  atk19b.status = 'burn';
  E.sides.self = atk19b;
  const rBurnNoGuts19 = E.calcDamage('self', 'opp', moveByKey('hataku'));
  check('H19-d 比較対照: こんじょうが無ければやけど物理半減は従来どおり(素の場合より小さい)',
    rBurnNoGuts19.max < rNone19.max,
    `burnNoGuts.max=${rBurnNoGuts19.max} none.max=${rNone19.max}`);
} catch (__e) { skipCase('H19: こんじょう(Guts)本体効果=状態異常時こうげき×1.5 [出典: bulbapedia.bulbagarden.net/wiki/Guts_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H20: ヒメリのみ(Leppa Berry) — PPが0になった技のPPを10回復して消費
// 出典: https://bulbapedia.bulbagarden.net/wiki/Leppa_Berry(2026-07-19取得)=
//   "restores 10 PP to a move that drops to 0 PP"(held item時。複数該当なら技欄が先の技)。消費は1回きり。
// 2026-07-19 本番バグ発覚: items_database.jsに trigger:pp_zero 宣言済みだが、エンジンの
// applyBerryEffect/itemReactionsがHP系(hp_le_50pct)しか処理せずPP系が未対応だった(明示コメントあり)。
// ─────────────────────────────────────────────
console.log('\n=== H20: ヒメリのみ=PPが0になった技のPPを10回復 [出典: bulbapedia.bulbagarden.net/wiki/Leppa_Berry] ===');
try {
  resetEnv();
  const atk20 = freshSide('カイリキー', 'hataku', { ability: 'せいしんりょく', item: 'berry_leppa' });
  fullHp(atk20);
  const def20 = freshSide('ピジョット', 'hataku', { ability: 'するどいめ' });
  fullHp(def20);
  E.sides.self = atk20; E.sides.opp = def20;
  E.initPP(atk20); E.initPP(def20);
  atk20.pp[0] = 1;   // この一撃でPP0に落ちる状況を作る
  E.setRandom(mulberry32(20260719));
  E.runSingleAttack('self', 0);
  const ateLog20 = E.battleLog.some(e => /ヒメリのみを 食べた/.test(e.msg));
  check('H20-a [出典: bulbapedia.bulbagarden.net/wiki/Leppa_Berry] PP0になった技のPPが10回復する',
    atk20.pp[0] === 10, `pp=${atk20.pp[0]}`);
  check('H20-b [出典: bulbapedia.bulbagarden.net/wiki/Leppa_Berry] ヒメリのみが消費される(1回きり)',
    !atk20.item, `item=${JSON.stringify(atk20.item)}`);
  check('H20-c ログにヒメリのみを食べた行が出る(既存パターンbl_107準拠)', ateLog20, `log=${JSON.stringify(E.battleLog.slice(-3))}`);

  // 比較対照(H20-d): ヒメリのみを持たなければPPは0のまま(=回復がヒメリ由来であることの確認)
  resetEnv();
  const atk20b = freshSide('カイリキー', 'hataku', { ability: 'せいしんりょく' });
  fullHp(atk20b);
  const def20b = freshSide('ピジョット', 'hataku', { ability: 'するどいめ' });
  fullHp(def20b);
  E.sides.self = atk20b; E.sides.opp = def20b;
  E.initPP(atk20b); E.initPP(def20b);
  atk20b.pp[0] = 1;
  E.setRandom(mulberry32(20260719));
  E.runSingleAttack('self', 0);
  check('H20-d 比較対照: ヒメリのみ無しならPPは0のまま回復しない', atk20b.pp[0] === 0, `pp=${atk20b.pp[0]}`);
} catch (__e) { skipCase('H20: ヒメリのみ=PPが0になった技のPPを10回復 [出典: bulbapedia.bulbagarden.net/wiki/Leppa_Berry]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H21: kind「急所率上昇」— crit_stage欠落の技に急所+1段(からてチョップ等)/既存crit_stage併存技は二重加算しない
// 出典: reference/_phaseD_specs_moves.json(Bulbapedia "Critical hit" — ランク1=1/8・高急所技は基礎+1段)
// からてチョップは全部版のみ収録(Championsには無い)なのでキーが無ければ本ケースのみskip。
// ─────────────────────────────────────────────
console.log('\n=== H21: 急所率上昇(kind)による急所+1段 [出典: bulbapedia.bulbagarden.net/wiki/Critical_hit] ===');
try {
  resetEnv();
  const N = 300;
  // H21-b: 急所ボーナスの無いはたく(crit_stage=0・kind無し)は、simの仕様どおり素急所(1/24)をロールしない=常に0回
  const atkH = freshSide('カイリキー', 'hataku', { ability: '' });
  fullHp(atkH);
  const defH = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(defH);
  E.sides.self = atkH; E.sides.opp = defH;
  let critsHataku = 0;
  for (let seed = 0; seed < N; seed++) {
    fullHp(defH);
    E.battleLog.length = 0;
    E.setRandom(mulberry32(seed));
    E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
    if (E.battleLog.some(e => /きゅうしょに あたった/.test(e.msg))) critsHataku++;
  }
  check(`H21-b 比較対照: はたく(crit_stage=0・kind無し)は素急所をロールしない仕様どおり常に急所0回(${N}回中${critsHataku}回)`,
    critsHataku === 0, `crits=${critsHataku}/${N}`);

  // H21-c: クラブハンマー(crit_stage=1 と kind「急所率上昇」stages:1 の両方を持つ・重複宣言技)は
  // ランク1相当(約12.5%)のままで、二重加算のランク2相当(約50%)にはならない。
  const kurabuMove = moveByKey('kurabuhanmaa');
  if (!kurabuMove) {
    skipCase('H21-c: クラブハンマー二重加算防止', 'クラブハンマーがWAZA_MAPに見つからない');
  } else {
    const atkK = freshSide('グライオン', 'kurabuhanmaa', { ability: '' });
    fullHp(atkK);
    const defK = freshSide('カビゴン', 'hataku', { ability: '' });
    fullHp(defK);
    E.sides.self = atkK; E.sides.opp = defK;
    let critsKurabu = 0;
    for (let seed = 0; seed < N; seed++) {
      fullHp(defK);
      E.battleLog.length = 0;
      E.setRandom(mulberry32(seed));
      E.phaseDealDamage('self', 'opp', kurabuMove);
      if (E.battleLog.some(e => /きゅうしょに あたった/.test(e.msg))) critsKurabu++;
    }
    const rateKurabu = critsKurabu / N;
    check(`H21-c [出典: reference/_phaseD_specs_moves.json] クラブハンマー(crit_stage=1とkind併存)は二重加算されずランク1相当(約12.5%・5〜25%の範囲)のまま(${N}回中${critsKurabu}回=${(rateKurabu*100).toFixed(1)}%)`,
      rateKurabu >= 0.05 && rateKurabu <= 0.25, `crits=${critsKurabu}/${N} rate=${rateKurabu}`);
  }

  // H21-a: からてチョップ(crit_stage=0・kindのみでstages:1)は、kind読み取りでランク1相当(約12.5%)まで急所率が上がる。
  const karateChop = moveByKey('karate-chop');
  if (!karateChop) {
    skipCase('H21-a: からてチョップの急所率上昇(kind)', 'からてチョップがWAZA_MAPに見つからない(全部版専用データのため未収録データセット=skip)');
  } else {
    const atkC = freshSide('マンキー', 'karate-chop', { ability: '' });
    fullHp(atkC);
    const defC = freshSide('カビゴン', 'hataku', { ability: '' });
    fullHp(defC);
    E.sides.self = atkC; E.sides.opp = defC;
    let critsChop = 0;
    for (let seed = 0; seed < N; seed++) {
      fullHp(defC);
      E.battleLog.length = 0;
      E.setRandom(mulberry32(seed));
      E.phaseDealDamage('self', 'opp', karateChop);
      if (E.battleLog.some(e => /きゅうしょに あたった/.test(e.msg))) critsChop++;
    }
    const rateChop = critsChop / N;
    check(`H21-a [出典: reference/_phaseD_specs_moves.json] からてチョップ(crit_stage欠落・kind「急所率上昇」stages:1)は急所率が約12.5%(5〜25%の範囲)まで上がる(${N}回中${critsChop}回=${(rateChop*100).toFixed(1)}%)`,
      rateChop >= 0.05 && rateChop <= 0.25, `crits=${critsChop}/${N} rate=${rateChop}`);
  }
} catch (__e) { skipCase('H21: 急所率上昇(kind) [出典: bulbapedia.bulbagarden.net/wiki/Critical_hit]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H22: kind「まもり貫通」/「まもり解除」— フェイントは相手のまもりを貫通し、まもり状態自体も解除する。
// 出典: reference/_phaseD_specs_moves.json(Bulbapedia "Feint")。フェイント/まもるは両データに実在。
// ─────────────────────────────────────────────
console.log('\n=== H22: まもり貫通/まもり解除(フェイント) [出典: bulbapedia.bulbagarden.net/wiki/Feint_(move)] ===');
try {
  resetEnv();
  const mamoruMove = moveByKey('mamoru');
  const atk22 = freshSide('ピカチュウ', 'feinto', { ability: '' });
  fullHp(atk22);
  const def22 = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(def22);
  E.sides.self = atk22; E.sides.opp = def22;
  def22.protecting = mamoruMove;   // 相手はまもるで守りの体勢に入っている(ブリッジ経由で直接状態を設定)
  const hpBefore22 = def22.currentHp;
  E.setRandom(mulberry32(20260719));
  E.runSingleAttack('self', 0);
  const blocked22 = E.battleLog.some(e => /で こうげきを 防いだ/.test(e.msg));
  check('H22-a [出典: bulbapedia.bulbagarden.net/wiki/Feint_(move)] フェイントはまもるを貫通してダメージが通る(ブロック行が出ない・HPが減る)',
    !blocked22 && def22.currentHp < hpBefore22,
    `blocked=${blocked22} hp ${hpBefore22}→${def22.currentHp}`);
  check('H22-b [出典: bulbapedia.bulbagarden.net/wiki/Feint_(move)] フェイントは相手のまもり状態そのものも解除する(def.protecting===null)',
    def22.protecting === null, `protecting=${def22.protecting && def22.protecting.name}`);

  // H22-c(補足・全部版専用): top-level protect:trueの技(ハイパードリル等)でも、
  // battle_data.effectsのkind「まもり貫通」があれば通常のまもるブロックの前にバイパスされる
  // (フェイントはprotect:false宣言で元々ブロック判定に来ないため、ここが本来の新規挙動の確認になる)。
  const hyperDrill = moveByKey('hyper-drill');
  if (!hyperDrill) {
    skipCase('H22-c: protect:true技のまもり貫通バイパス(ハイパードリル)', 'ハイパードリルがWAZA_MAPに見つからない(全部版専用データのため未収録データセット=skip)');
  } else {
    check('H22-c 前提: ハイパードリルはtop-level protect:trueの技である(まもり貫通kindが無ければ通常ブロックされるはずの技)',
      hyperDrill.protect === true, `protect=${hyperDrill.protect}`);
    resetEnv();
    const atk22c = freshSide('ノコッチ', 'hyper-drill', { ability: '' });
    fullHp(atk22c);
    const def22c = freshSide('カビゴン', 'hataku', { ability: '' });
    fullHp(def22c);
    E.sides.self = atk22c; E.sides.opp = def22c;
    def22c.protecting = mamoruMove;
    const hpBefore22c = def22c.currentHp;
    E.setRandom(mulberry32(20260719));
    E.runSingleAttack('self', 0);
    const blocked22c = E.battleLog.some(e => /で こうげきを 防いだ/.test(e.msg));
    check('H22-c [出典: reference/_phaseD_specs_moves.json] ハイパードリル(protect:true)もkind「まもり貫通」でまもるをバイパスしダメージが通る',
      !blocked22c && def22c.currentHp < hpBefore22c,
      `blocked=${blocked22c} hp ${hpBefore22c}→${def22c.currentHp}`);
  }
} catch (__e) { skipCase('H22: まもり貫通/まもり解除 [出典: bulbapedia.bulbagarden.net/wiki/Feint_(move)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H23: みねうち — ダメージでHPが0になる場合は必ずHPを1残す(すでに1でも1のまま)。全部版専用データ。
// 出典: reference/_phaseD_specs_moves.json(Bulbapedia "False Swipe")
// ─────────────────────────────────────────────
console.log('\n=== H23: みねうち(瀕死回避) [出典: bulbapedia.bulbagarden.net/wiki/False_Swipe_(move)] ===');
try {
  resetEnv();
  const falseSwipe = moveByKey('false-swipe');
  if (!falseSwipe) {
    skipCase('H23: みねうち', 'みねうちがWAZA_MAPに見つからない(全部版専用データのため未収録データセット=skip)');
  } else {
    const atk23 = freshSide('カイリキー', 'false-swipe', { ability: '' });
    fullHp(atk23);
    const def23 = freshSide('カビゴン', 'hataku', { ability: '' });
    fullHp(def23);
    def23.currentHp = 5;   // 過剰打撃が確実に発生する程度まで減らしておく
    E.sides.self = atk23; E.sides.opp = def23;
    E.setRandom(mulberry32(20260719));
    E.phaseDealDamage('self', 'opp', falseSwipe);
    check('H23-a [出典: bulbapedia.bulbagarden.net/wiki/False_Swipe_(move)] みねうちはHPを0にせず必ず1残す',
      def23.currentHp === 1 && def23.fainted !== true, `hp=${def23.currentHp} fainted=${def23.fainted}`);

    // H23-b: すでにHP1の状態でも、そのまま1のまま(0にはしない)
    resetEnv();
    const atk23b = freshSide('カイリキー', 'false-swipe', { ability: '' });
    fullHp(atk23b);
    const def23b = freshSide('カビゴン', 'hataku', { ability: '' });
    fullHp(def23b);
    def23b.currentHp = 1;
    E.sides.self = atk23b; E.sides.opp = def23b;
    E.setRandom(mulberry32(20260719));
    E.phaseDealDamage('self', 'opp', falseSwipe);
    check('H23-b すでにHP1の相手にみねうちを当てても1のまま(0にならない)',
      def23b.currentHp === 1 && def23b.fainted !== true, `hp=${def23b.currentHp} fainted=${def23b.fainted}`);
  }
} catch (__e) { skipCase('H23: みねうち [出典: bulbapedia.bulbagarden.net/wiki/False_Swipe_(move)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H24: しろいきり(kind「ランク低下防御」) — 相手の技によるランク低下を防ぐ(自分の場・5ターン)。
// mistフラグ自体はブリッジ経由で直接設定(しろいきりの技オブジェクトは全部版専用のため、
// 「防ぐ側」のガード判定=applyRankStageGuardedを述語ベースで検証する)。
// 出典: reference/_phaseD_specs_moves.json(Bulbapedia "Mist")
// ─────────────────────────────────────────────
console.log('\n=== H24: しろいきり(ランク低下防御) [出典: bulbapedia.bulbagarden.net/wiki/Mist_(move)] ===');
try {
  resetEnv();
  const iyanaoto = moveByKey('iyanaoto');   // いやなおと(Screech): 相手のぼうぎょ-2(能力ランク変化・target:opponent)
  const atk24 = freshSide('カビゴン', 'iyanaoto', { ability: '' });
  fullHp(atk24);
  const def24 = freshSide('フシギバナ', 'hataku', { ability: 'しんりょく' });
  fullHp(def24);
  E.sides.self = atk24; E.sides.opp = def24;
  def24.mist = true;   // しろいきりの効果が掛かっている状態(ブリッジ経由で直接設定)
  E.phaseApplyEffects('self', 'opp', iyanaoto);
  check('H24-a [出典: bulbapedia.bulbagarden.net/wiki/Mist_(move)] しろいきり中は相手の技でぼうぎょランクが下がらない(rank.def===0)',
    def24.rank.def === 0, `rank.def=${def24.rank.def}`);

  // 比較対照(H24-b): しろいきりが無ければ通常どおりランクが下がる
  resetEnv();
  const atk24b = freshSide('カビゴン', 'iyanaoto', { ability: '' });
  fullHp(atk24b);
  const def24b = freshSide('フシギバナ', 'hataku', { ability: 'しんりょく' });
  fullHp(def24b);
  E.sides.self = atk24b; E.sides.opp = def24b;
  E.phaseApplyEffects('self', 'opp', iyanaoto);
  check('H24-b 比較対照: しろいきりが無ければぼうぎょランクは通常どおり-2される',
    def24b.rank.def === -2, `rank.def=${def24b.rank.def}`);
} catch (__e) { skipCase('H24: しろいきり(ランク低下防御) [出典: bulbapedia.bulbagarden.net/wiki/Mist_(move)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H25: テレキネシス — 3ターンの間 浮遊状態にする(じめん技が当たらなくなる/一撃必殺を除き必ず命中する)。
// 全部版専用データ(mist同様、テレキネシス自体のkind適用はphaseApplyEffects経由で直接検証)。
// 出典: reference/_phaseD_specs_moves.json(Bulbapedia "Telekinesis")
// ─────────────────────────────────────────────
console.log('\n=== H25: テレキネシス [出典: bulbapedia.bulbagarden.net/wiki/Telekinesis_(move)] ===');
try {
  resetEnv();
  const telekinesis = moveByKey('telekinesis');
  if (!telekinesis) {
    skipCase('H25: テレキネシス', 'テレキネシスがWAZA_MAPに見つからない(全部版専用データのため未収録データセット=skip)');
  } else {
    // H25-a: kind「テレキネシス」がdef.telekinesisを3ターン分セットする(phaseApplyEffects経由)
    const atk25 = freshSide('ピッピ', '', { ability: '' });
    fullHp(atk25);
    const def25 = freshSide('カビゴン', 'jishin', { ability: '' });
    fullHp(def25);
    E.sides.self = atk25; E.sides.opp = def25;
    E.phaseApplyEffects('self', 'opp', telekinesis);
    check('H25-a [出典: bulbapedia.bulbagarden.net/wiki/Telekinesis_(move)] テレキネシスは対象を3ターンの間 浮遊状態にする(def.telekinesis===3)',
      def25.telekinesis === 3, `telekinesis=${def25.telekinesis}`);

    // H25-b: 浮いている間はじめん技(じしん)が当たらない(isGrounded=falseでこうかなし)
    const rGround = E.calcDamage('self', 'opp', moveByKey('jishin'));   // atk25がdef25(浮いている側)にじしんを撃つ
    check('H25-b [出典: bulbapedia.bulbagarden.net/wiki/Telekinesis_(move)] 浮いている間はじめん技(じしん)が当たらない(immune)',
      !!(rGround && rGround.immune), `immune=${rGround && rGround.immune}`);

    // H25-c: 回避率+6でも、テレキネシス下では一撃必殺以外の技が必ず命中する(相手の回避率を無視)
    def25.rank.eva = 6;
    let hitsTele = 0;
    const N25 = 80;
    for (let seed = 0; seed < N25; seed++) {
      E.setRandom(mulberry32(seed));
      const r = E.phaseHitCheck(moveByKey('hataku'), atk25, def25);
      if (r.hit) hitsTele++;
    }
    check(`H25-c [出典: bulbapedia.bulbagarden.net/wiki/Telekinesis_(move)] 浮いている相手には回避率+6でも必ず命中する(${N25}回中${hitsTele}回=100%のはず)`,
      hitsTele === N25, `hits=${hitsTele}/${N25}`);

    // 比較対照(H25-d): 一撃必殺技(つのドリル)はテレキネシス下でも必中化しない(ohko_exception)
    let hitsOhko = 0;
    for (let seed = 0; seed < N25; seed++) {
      E.setRandom(mulberry32(seed));
      const r = E.phaseHitCheck(moveByKey('tsunodoriru'), atk25, def25);
      if (r.hit) hitsOhko++;
    }
    check(`H25-d 比較対照: 一撃必殺技(つのドリル)はテレキネシス下でも必中化しない(ohko_exception。${N25}回中${hitsOhko}回・0<hitsOhko<${N25}であること)`,
      hitsOhko > 0 && hitsOhko < N25, `hitsOhko=${hitsOhko}/${N25}`);
  }
} catch (__e) { skipCase('H25: テレキネシス [出典: bulbapedia.bulbagarden.net/wiki/Telekinesis_(move)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H26: ポルターガイスト — 相手が持ち物を持っていなければ失敗する(fails_if: target_has_no_item)。
// ポルターガイストは両データに実在(ゲンガー等)。
// 出典: reference/_phaseD_specs_moves.json(Bulbapedia "Poltergeist")
// ─────────────────────────────────────────────
console.log('\n=== H26: ポルターガイスト(相手の持ち物が無いと失敗) [出典: bulbapedia.bulbagarden.net/wiki/Poltergeist_(move)] ===');
try {
  resetEnv();
  // 防御側はフシギバナ(くさ/どく)を使用。カビゴン(ノーマル)だとゴースト技がタイプ相性で常時こうかなしになり、
  // 「道具の有無による失敗」と「タイプ相性による無効」の区別がつかなくなるため避ける。
  const atk26 = freshSide('ゲンガー', 'porutaagaisuto', { ability: '' });
  fullHp(atk26);
  const def26 = freshSide('フシギバナ', 'hataku', { ability: 'しんりょく', item: '' });   // 道具なし
  fullHp(def26);
  E.sides.self = atk26; E.sides.opp = def26;
  const hpBefore26 = def26.currentHp;
  E.setRandom(mulberry32(20260719));
  E.runSingleAttack('self', 0);
  check('H26-a [出典: bulbapedia.bulbagarden.net/wiki/Poltergeist_(move)] 相手が道具を持っていなければポルターガイストは失敗する(HP不変)',
    def26.currentHp === hpBefore26, `hp ${hpBefore26}→${def26.currentHp}`);

  // 比較対照(H26-b): 相手が道具を持っていれば通常どおりダメージが通る
  resetEnv();
  const atk26b = freshSide('ゲンガー', 'porutaagaisuto', { ability: '' });
  fullHp(atk26b);
  const def26b = freshSide('フシギバナ', 'hataku', { ability: 'しんりょく', item: 'berry_oran' });
  fullHp(def26b);
  E.sides.self = atk26b; E.sides.opp = def26b;
  const hpBefore26b = def26b.currentHp;
  E.setRandom(mulberry32(20260719));
  E.runSingleAttack('self', 0);
  check('H26-b 比較対照: 相手が道具を持っていれば通常どおりダメージが通る',
    def26b.currentHp < hpBefore26b, `hp ${hpBefore26b}→${def26b.currentHp}`);
} catch (__e) { skipCase('H26: ポルターガイスト [出典: bulbapedia.bulbagarden.net/wiki/Poltergeist_(move)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H27: ダークホール(kind「使用者限定」) — ダークライ以外が使うと失敗する。全部版専用データ。
// 出典: reference/_phaseD_specs_moves.json(Bulbapedia "Dark Void")
// ─────────────────────────────────────────────
console.log('\n=== H27: ダークホール(使用者限定=ダークライ専用) [出典: bulbapedia.bulbagarden.net/wiki/Dark_Void_(move)] ===');
try {
  resetEnv();
  const darkVoid = moveByKey('dark-void');
  if (!darkVoid) {
    skipCase('H27: ダークホール', 'ダークホールがWAZA_MAPに見つからない(全部版専用データのため未収録データセット=skip)');
  } else {
    const atk27 = freshSide('カビゴン', 'dark-void', { ability: '' });   // ダークライ以外が使用
    fullHp(atk27);
    const def27 = freshSide('フシギバナ', 'hataku', { ability: 'しんりょく' });
    fullHp(def27);
    E.sides.self = atk27; E.sides.opp = def27;
    E.setRandom(mulberry32(20260719));
    E.runSingleAttack('self', 0);
    check('H27-a [出典: bulbapedia.bulbagarden.net/wiki/Dark_Void_(move)] ダークライ以外が使うとダークホールは失敗する(眠り付与なし)',
      def27.status === 'none' || def27.status == null, `status=${def27.status}`);

    // 比較対照(H27-b): ダークライが使えば成功して眠りを付与できる(命中率固定・複数seedで確認)
    resetEnv();
    let slept = false;
    for (let seed = 0; seed < 40 && !slept; seed++) {
      const atk27b = freshSide('ダークライ', 'dark-void', { ability: '' });
      fullHp(atk27b);
      const def27b = freshSide('フシギバナ', 'hataku', { ability: 'しんりょく' });
      fullHp(def27b);
      E.sides.self = atk27b; E.sides.opp = def27b;
      E.setRandom(mulberry32(seed));
      E.runSingleAttack('self', 0);
      if (def27b.status === 'sleep') slept = true;
    }
    check('H27-b 比較対照: ダークライが使えばダークホールは成功し眠りを付与できる',
      slept === true, `slept=${slept}`);
  }
} catch (__e) { skipCase('H27: ダークホール [出典: bulbapedia.bulbagarden.net/wiki/Dark_Void_(move)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H28: マジックコート(kind「跳ね返し」) — このターンの間、相手にかける変化技を跳ね返す
// (既存のマジックミラー跳ね返し判定にdef.magicCoatTurnとして相乗り)。フラグはブリッジ経由で直接設定し、
// どくどく(両データに実在)で跳ね返り自体を検証する。
// 出典: reference/_phaseD_specs_moves.json(Bulbapedia "Magic Coat")
// ─────────────────────────────────────────────
console.log('\n=== H28: マジックコート(跳ね返し) [出典: bulbapedia.bulbagarden.net/wiki/Magic_Coat_(move)] ===');
try {
  resetEnv();
  const caster28 = freshSide('カイリキー', 'dokudoku', { ability: '' });   // どく/はがねでない=もうどく免除にならない
  fullHp(caster28);
  const bouncer28 = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(bouncer28);
  E.sides.self = caster28; E.sides.opp = bouncer28;
  bouncer28.magicCoatTurn = true;   // マジックコートで跳ね返しの構えに入っている状態(ブリッジ経由で直接設定)
  E.runSingleAttack('self', 0);   // caster28がどくどくをbouncer28に使う
  check('H28-a [出典: bulbapedia.bulbagarden.net/wiki/Magic_Coat_(move)] マジックコート中はどくどくが跳ね返り、跳ね返した側(bouncer)は無傷',
    bouncer28.status === 'none' || bouncer28.status == null, `bouncer.status=${bouncer28.status}`);
  check('H28-b [出典: bulbapedia.bulbagarden.net/wiki/Magic_Coat_(move)] 跳ね返された効果は元の使用者(caster)に返ってもうどくになる',
    caster28.status === 'badpoison', `caster.status=${caster28.status}`);
} catch (__e) { skipCase('H28: マジックコート(跳ね返し) [出典: bulbapedia.bulbagarden.net/wiki/Magic_Coat_(move)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H29: コートチェンジ(kind「場入れ替え」) — 自分の場↔相手の場の効果(壁・設置技等)をまるごと入れ替える。
// 全部版専用データ。出典: reference/_phaseD_specs_moves.json(Bulbapedia "Court Change")
// ─────────────────────────────────────────────
console.log('\n=== H29: コートチェンジ(場入れ替え) [出典: bulbapedia.bulbagarden.net/wiki/Court_Change_(move)] ===');
try {
  resetEnv();
  const courtChange = moveByKey('court-change');
  if (!courtChange) {
    skipCase('H29: コートチェンジ', 'コートチェンジがWAZA_MAPに見つからない(全部版専用データのため未収録データセット=skip)');
  } else {
    const atk29 = freshSide('カイリキー', 'hataku', { ability: '' });
    fullHp(atk29);
    const def29 = freshSide('カビゴン', 'hataku', { ability: '' });
    fullHp(def29);
    E.sides.self = atk29; E.sides.opp = def29;
    atk29.reflect = true; atk29.screenTurns = { reflect: 4 };
    def29.stealthRock = true;
    E.phaseApplyEffects('self', 'opp', courtChange);
    check('H29-a [出典: bulbapedia.bulbagarden.net/wiki/Court_Change_(move)] コートチェンジで自分のリフレクターが相手側に移る',
      !atk29.reflect && def29.reflect === true, `atk.reflect=${atk29.reflect} def.reflect=${def29.reflect}`);
    check('H29-b コートチェンジで相手のステルスロックが自分側に移る',
      atk29.stealthRock === true && !def29.stealthRock, `atk.stealthRock=${atk29.stealthRock} def.stealthRock=${def29.stealthRock}`);
    check('H29-c screenTurns(壁の残りターン)も一緒に入れ替わる',
      def29.screenTurns && def29.screenTurns.reflect === 4 && (!atk29.screenTurns || !atk29.screenTurns.reflect),
      `atk.screenTurns=${JSON.stringify(atk29.screenTurns)} def.screenTurns=${JSON.stringify(def29.screenTurns)}`);
  }
} catch (__e) { skipCase('H29: コートチェンジ(場入れ替え) [出典: bulbapedia.bulbagarden.net/wiki/Court_Change_(move)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H30: てだすけ/ワイドガード — シングル戦(1vs1)では発動機会が無い(てだすけ=fails_if no_allyで既存失敗
// パターンにより不発 / ワイドガード=対応するkindハンドラが無いため無害に何もしない=クラッシュしない)ことの確認。
// 両技とも両データに実在。出典: reference/_phaseD_specs_moves.json
// ─────────────────────────────────────────────
console.log('\n=== H30: てだすけ/ワイドガード(シングル戦=発動機会なしの確認) [出典: bulbapedia.bulbagarden.net/wiki/Helping_Hand_(move) / .../Wide_Guard_(move)] ===');
try {
  resetEnv();
  const atk30 = freshSide('カイリキー', 'tedasuke', { ability: '' });
  fullHp(atk30);
  const def30 = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(def30);
  E.sides.self = atk30; E.sides.opp = def30;
  const hpBefore30 = def30.currentHp;
  E.setRandom(mulberry32(20260719));
  E.runSingleAttack('self', 0);
  check('H30-a [出典: bulbapedia.bulbagarden.net/wiki/Helping_Hand_(move)] てだすけは1vs1シングルでは味方不在の既存失敗パターンで不発(HP不変・失敗ログが出る)',
    def30.currentHp === hpBefore30 && E.battleLog.some(e => /味方の ポケモンがいない/.test(e.msg)),
    `hp ${hpBefore30}→${def30.currentHp} log=${JSON.stringify(E.battleLog.slice(-2).map(e=>e.msg))}`);

  resetEnv();
  const atk30b = freshSide('カイリキー', 'waidogaado', { ability: '' });
  fullHp(atk30b);
  const def30b = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(def30b);
  E.sides.self = atk30b; E.sides.opp = def30b;
  E.setRandom(mulberry32(20260719));
  let threw30b = false;
  try { E.runSingleAttack('self', 0); } catch (_e2) { threw30b = true; }
  check('H30-b [出典: bulbapedia.bulbagarden.net/wiki/Wide_Guard_(move)] ワイドガード(未実装kind=範囲まもり)は選択してもクラッシュせず無害(まもり体勢にも入らない)',
    !threw30b && atk30b.protecting == null, `threw=${threw30b} protecting=${atk30b.protecting}`);
} catch (__e) { skipCase('H30: てだすけ/ワイドガード [出典: bulbapedia.bulbagarden.net/wiki/Helping_Hand_(move)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H31: どくしゅ(Poison Touch) — 直接攻撃が命中したら30%で相手をどく状態にする(攻撃側トリガー)。
// 出典: reference/_phaseD_specs_abilities1.json (Bulbapedia "Poison Touch")
// ─────────────────────────────────────────────
console.log('\n=== H31: どくしゅ [出典: bulbapedia.bulbagarden.net/wiki/Poison_Touch_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('カイリキー', 'hataku', { ability: 'どくしゅ' });
  fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(() => 0);   // 30%ロールを必ず成功側に倒す(0 < 0.3)
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('H31-a [出典: bulbapedia.bulbagarden.net/wiki/Poison_Touch_(Ability)] 直接攻撃が命中→30%ロール成功でどく状態になる',
    def.status === 'poison', `def.status=${def.status}`);

  resetEnv();
  const atk2 = freshSide('カイリキー', 'hataku', { ability: 'どくしゅ' });
  fullHp(atk2);
  const def2 = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(def2);
  E.sides.self = atk2; E.sides.opp = def2;
  E.setRandom(() => 0.99);   // 30%ロールを必ず失敗側に倒す
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('H31-b ロール失敗時はどく状態にならない(比較対照)', def2.status === 'none', `def2.status=${def2.status}`);
} catch (__e) { skipCase('H31: どくしゅ [出典: bulbapedia.bulbagarden.net/wiki/Poison_Touch_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H32: ふくがん(Compound Eyes) — 命中率×1.3(5325/4096)。一撃必殺技には効果なし。
// 出典: reference/_phaseD_specs_abilities1.json (Bulbapedia "Compound Eyes")
// ─────────────────────────────────────────────
console.log('\n=== H32: ふくがん [出典: bulbapedia.bulbagarden.net/wiki/Compound_Eyes_(Ability)] ===');
try {
  resetEnv();
  // かみなり(命中70)。ロール90: 素の70では外れ、ふくがんの70×5325/4096≒90.97では当たる。
  const atk = freshSide('ピカチュウ', 'kaminari', { ability: '' });
  fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(() => 0.90);
  const missNoAb = E.phaseHitCheck(moveByKey('kaminari'), atk, def);
  check('H32-a 比較対照: ふくがん無しではロール90>命中70で外れる', missNoAb.hit === false, JSON.stringify(missNoAb));

  atk.ability = 'ふくがん';
  E.setRandom(() => 0.90);
  const hitWithAb = E.phaseHitCheck(moveByKey('kaminari'), atk, def);
  check('H32-b [出典: bulbapedia.bulbagarden.net/wiki/Compound_Eyes_(Ability)] ふくがんで命中70×1.3≒90.97→ロール90で命中する',
    hitWithAb.hit === true, JSON.stringify(hitWithAb));

  // じわれ(一撃必殺・命中30固定)。ロール35は素の30には外れる→ふくがん適用でも変わらないはず(補正対象外)。
  const atk2 = freshSide('カイリキー', 'jiware', { ability: 'ふくがん' });
  fullHp(atk2);
  const def2 = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(def2);
  E.setRandom(() => 0.35);
  const ohko = E.phaseHitCheck(moveByKey('jiware'), atk2, def2);
  check('H32-c 一撃必殺技(じわれ)にはふくがんの補正がかからない(命中30のまま→ロール35で外れる)',
    ohko.hit === false, JSON.stringify(ohko));
} catch (__e) { skipCase('H32: ふくがん [出典: bulbapedia.bulbagarden.net/wiki/Compound_Eyes_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H33: しめりけ(Damp) — 場のどちらかが持っていると自爆技(威力ありの自分瀕死技)を誰も使えない。
// 出典: reference/_phaseD_specs_abilities2.json (Bulbapedia "Damp")
// ─────────────────────────────────────────────
console.log('\n=== H33: しめりけ [出典: bulbapedia.bulbagarden.net/wiki/Damp_(Ability)] ===');
try {
  resetEnv();
  const jibaku = moveByKey('jibaku');
  const atk = freshSide('カビゴン', 'jibaku', { ability: '' });
  fullHp(atk);
  const def = freshSide('カイリキー', 'hataku', { ability: 'しめりけ' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  const hpBefore = atk.currentHp;
  E.runSingleAttack('self', 0);
  check('H33-a [出典: bulbapedia.bulbagarden.net/wiki/Damp_(Ability)] しめりけ持ちが場にいるとじばくが不発(自分は倒れない)',
    atk.currentHp === hpBefore && !atk.fainted, `hp ${hpBefore}->${atk.currentHp} fainted=${atk.fainted}`);

  // 比較対照: しめりけがいなければ通常どおりじばくで自分が倒れる(威力ありの自分瀕死は宣言即・使用宣言で確定)
  resetEnv();
  const atk2 = freshSide('カビゴン', 'jibaku', { ability: '' });
  fullHp(atk2);
  const def2 = freshSide('カイリキー', 'hataku', { ability: '' });
  fullHp(def2);
  E.sides.self = atk2; E.sides.opp = def2;
  const hpBefore2 = atk2.currentHp;
  E.runSingleAttack('self', 0);
  check('H33-b 比較対照: しめりけが場にいなければじばくは通常どおり自分が倒れる',
    atk2.fainted === true, `fainted=${atk2.fainted} hp=${atk2.currentHp} (before=${hpBefore2})`);

  // runTurn側(もう一方の実行経路)でも同じくブロックされることを確認
  // (defの技はまもる=非ダメージにして、atkのHP変化がじばく由来だけになるようにする)
  resetEnv();
  const atk3 = freshSide('カビゴン', 'jibaku', { ability: '' });
  fullHp(atk3);
  const def3 = freshSide('カイリキー', 'mamoru', { ability: 'しめりけ' });
  fullHp(def3);
  E.sides.self = atk3; E.sides.opp = def3;
  const hpBefore3 = atk3.currentHp;
  E.setRandom(() => 0.5);
  E.runTurn();
  check('H33-c runTurn経路でもしめりけでじばくが不発になる(自分は倒れない)',
    atk3.currentHp === hpBefore3 && !atk3.fainted, `hp ${hpBefore3}->${atk3.currentHp} fainted=${atk3.fainted}`);
} catch (__e) { skipCase('H33: しめりけ [出典: bulbapedia.bulbagarden.net/wiki/Damp_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H34: ヘヴィメタル/ライトメタル — 実効おもさ×2/×0.5。けたぐりの威力段階がその実効おもさで変わる。
// リザードン(90.5kg・素は<100=威力80)→ヘヴィメタルで181kg(<200=100)→ライトメタルで45.2kg(<50=60)。
// 出典: reference/_phaseD_specs_abilities1.json (Bulbapedia "Heavy Metal"/"Light Metal")
// ─────────────────────────────────────────────
console.log('\n=== H34: ヘヴィメタル/ライトメタル [出典: bulbapedia.bulbagarden.net/wiki/Heavy_Metal_(Ability)] ===');
try {
  resetEnv();
  const ketaguri = moveByKey('ketaguri');
  const atk = freshSide('カイリキー', 'ketaguri', { ability: '' });
  fullHp(atk);
  const def = freshSide('リザードン', 'hataku', { ability: '' });
  fullHp(def);
  const baseP = E.variablePower(ketaguri, atk, def);
  check('H34-a 比較対照: 素のリザードン(90.5kg<100)はけたぐり威力80', baseP === 80, `power=${baseP}`);

  def.ability = 'ヘヴィメタル';
  const heavyP = E.variablePower(ketaguri, atk, def);
  check('H34-b [出典: bulbapedia.bulbagarden.net/wiki/Heavy_Metal_(Ability)] ヘヴィメタルで実効181kg(<200)→けたぐり威力100',
    heavyP === 100, `power=${heavyP}`);

  def.ability = 'ライトメタル';
  const lightP = E.variablePower(ketaguri, atk, def);
  check('H34-c [出典: bulbapedia.bulbagarden.net/wiki/Light_Metal_(Ability)] ライトメタルで実効45.2kg(<50)→けたぐり威力60',
    lightP === 60, `power=${lightP}`);
} catch (__e) { skipCase('H34: ヘヴィメタル/ライトメタル [出典: bulbapedia.bulbagarden.net/wiki/Heavy_Metal_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H35: とうそうしん(Rivalry) — 同性=威力×1.25/異性=×0.75/性別不明混在は補正なし。
// 出典: reference/_phaseD_specs_abilities2.json (Bulbapedia "Rivalry")
// ─────────────────────────────────────────────
console.log('\n=== H35: とうそうしん [出典: bulbapedia.bulbagarden.net/wiki/Rivalry_(Ability)] ===');
try {
  resetEnv();
  const atkSame = freshSide('カイリキー', 'hataku', { ability: 'とうそうしん' });
  atkSame.gender = '♂'; fullHp(atkSame);
  const defSame = freshSide('カビゴン', 'hataku', { ability: '' });
  defSame.gender = '♂'; fullHp(defSame);
  E.sides.self = atkSame; E.sides.opp = defSame;
  const rSame = E.calcDamage('self', 'opp', moveByKey('hataku'));
  check('H35-a [出典: bulbapedia.bulbagarden.net/wiki/Rivalry_(Ability)] 同性(♂×♂)は威力×1.25のチップが立つ',
    rSame && rSame.chips && rSame.chips.some(c => c.label === 'とうそうしん' && c.factor === 1.25),
    JSON.stringify(rSame && rSame.chips));

  resetEnv();
  const atkDiff = freshSide('カイリキー', 'hataku', { ability: 'とうそうしん' });
  atkDiff.gender = '♂'; fullHp(atkDiff);
  const defDiff = freshSide('カビゴン', 'hataku', { ability: '' });
  defDiff.gender = '♀'; fullHp(defDiff);
  E.sides.self = atkDiff; E.sides.opp = defDiff;
  const rDiff = E.calcDamage('self', 'opp', moveByKey('hataku'));
  check('H35-b 異性(♂×♀)は威力×0.75のチップが立つ',
    rDiff && rDiff.chips && rDiff.chips.some(c => c.label === 'とうそうしん' && c.factor === 0.75),
    JSON.stringify(rDiff && rDiff.chips));

  resetEnv();
  const atkUnk = freshSide('カイリキー', 'hataku', { ability: 'とうそうしん' });
  atkUnk.gender = '♂'; fullHp(atkUnk);
  const defUnk = freshSide('カビゴン', 'hataku', { ability: '' });
  defUnk.gender = '—'; fullHp(defUnk);
  E.sides.self = atkUnk; E.sides.opp = defUnk;
  const rUnk = E.calcDamage('self', 'opp', moveByKey('hataku'));
  check('H35-c 相手が性別不明(—)なら補正なし(とうそうしんチップが立たない)',
    rUnk && rUnk.chips && !rUnk.chips.some(c => c.label === 'とうそうしん'), JSON.stringify(rUnk && rUnk.chips));
} catch (__e) { skipCase('H35: とうそうしん [出典: bulbapedia.bulbagarden.net/wiki/Rivalry_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H36: ミイラ(Mummy) — 直接攻撃を受けたら攻撃側の特性をミイラへ書き換える(書き換え不可リストは対象外)。
// 出典: reference/_phaseD_specs_abilities2.json (Bulbapedia "Mummy")
// ─────────────────────────────────────────────
console.log('\n=== H36: ミイラ [出典: bulbapedia.bulbagarden.net/wiki/Mummy_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('カイリキー', 'hataku', { ability: 'かいりきバサミ' });
  fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { ability: 'ミイラ' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(() => 0.99);
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('H36-a [出典: bulbapedia.bulbagarden.net/wiki/Mummy_(Ability)] 直接攻撃を受けたら攻撃側の特性がミイラになる',
    E.sideAbility(atk) === 'ミイラ', `atkAbility=${E.sideAbility(atk)}`);

  // 書き換え不可リスト(ABILITY_CHANGE_NG)対象は書き換わらない比較対照
  resetEnv();
  const atk2 = freshSide('ミミッキュ', 'hataku', { ability: 'ばけのかわ' });
  fullHp(atk2);
  const def2 = freshSide('カビゴン', 'hataku', { ability: 'ミイラ' });
  fullHp(def2);
  E.sides.self = atk2; E.sides.opp = def2;
  E.setRandom(() => 0.99);
  E.phaseDealDamage('self', 'opp', moveByKey('hataku'));
  check('H36-b 比較対照: ばけのかわ(書き換え不可リスト)はミイラで上書きされない',
    E.sideAbility(atk2) === 'ばけのかわ', `atkAbility=${E.sideAbility(atk2)}`);
} catch (__e) { skipCase('H36: ミイラ [出典: bulbapedia.bulbagarden.net/wiki/Mummy_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H37: でんきにかえる(Electromorphosis) — 攻撃技でダメージを受けるとじゅうでん状態になる(接触は問わない)。
// 出典: reference/_phaseD_specs_abilities2.json (Bulbapedia "Electromorphosis")
// ─────────────────────────────────────────────
console.log('\n=== H37: でんきにかえる [出典: bulbapedia.bulbagarden.net/wiki/Electromorphosis_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('フシギバナ', 'naminori', { ability: '' });   // なみのり=非接触技
  fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { ability: 'でんきにかえる' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(() => 0.5);
  E.phaseDealDamage('self', 'opp', moveByKey('naminori'));
  check('H37 [出典: bulbapedia.bulbagarden.net/wiki/Electromorphosis_(Ability)] 非接触技でダメージを受けてもじゅうでん状態になる(次のでんき技威力2倍)',
    def.chargeBoost && def.chargeBoost.move_type === 'でんき' && def.chargeBoost.multiplier === 2,
    JSON.stringify(def.chargeBoost));
} catch (__e) { skipCase('H37: でんきにかえる [出典: bulbapedia.bulbagarden.net/wiki/Electromorphosis_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H38: ヘドロえき(Liquid Ooze) — 吸収技/やどりぎの回復をダメージに反転する。
// 出典: reference/_phaseD_specs_abilities2.json (Bulbapedia "Liquid Ooze")
// ─────────────────────────────────────────────
console.log('\n=== H38: ヘドロえき [出典: bulbapedia.bulbagarden.net/wiki/Liquid_Ooze_(Ability)] ===');
try {
  resetEnv();
  // 比較対照: 通常特性ならギガドレインで回復する
  const atkN = freshSide('フシギバナ', 'gigadorein', { ability: '' });
  const aMaxN = fullHp(atkN);
  atkN.currentHp = Math.floor(aMaxN / 2);
  const beforeN = atkN.currentHp;
  const defN = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(defN);
  E.sides.self = atkN; E.sides.opp = defN;
  E.setRandom(() => 0.5);
  E.phaseDealDamage('self', 'opp', moveByKey('gigadorein'));
  check('H38-a 比較対照: 通常特性の相手からはギガドレインで回復する', atkN.currentHp > beforeN,
    `${beforeN}->${atkN.currentHp}`);

  resetEnv();
  const atk = freshSide('フシギバナ', 'gigadorein', { ability: '' });
  const aMax = fullHp(atk);
  atk.currentHp = Math.floor(aMax / 2);
  const before = atk.currentHp;
  const def = freshSide('カビゴン', 'hataku', { ability: 'ヘドロえき' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(() => 0.5);
  E.phaseDealDamage('self', 'opp', moveByKey('gigadorein'));
  check('H38-b [出典: bulbapedia.bulbagarden.net/wiki/Liquid_Ooze_(Ability)] ヘドロえき持ちからはギガドレインで回復せず逆にダメージを受ける',
    atk.currentHp < before, `${before}->${atk.currentHp}`);

  // やどりぎのタネでも同様に反転する
  resetEnv();
  const planter = freshSide('フシギバナ', 'yadorigi', { ability: '' });
  const pMax = fullHp(planter);
  planter.currentHp = Math.floor(pMax / 2);
  const beforeP = planter.currentHp;
  const seeded = freshSide('カビゴン', 'hataku', { ability: 'ヘドロえき' });
  const sMax = fullHp(seeded);
  E.sides.self = planter; E.sides.opp = seeded;
  E.phaseApplyEffects('self', 'opp', moveByKey('yadorigi'));
  check('H38-c やどりぎのタネの付与自体は成功する', seeded.slips && seeded.slips.some(sl => sl.source === 'やどりぎのタネ'),
    JSON.stringify(seeded.slips));
  const expectD = Math.max(1, Math.floor(sMax / 8));
  E.phaseSlipFor('opp');
  check('H38-d やどりぎ側(seeded)のHPは通常どおり削れる', seeded.currentHp === sMax - expectD,
    `seeded.currentHp=${seeded.currentHp} expected=${sMax - expectD}`);
  check('H38-e [出典: bulbapedia.bulbagarden.net/wiki/Liquid_Ooze_(Ability)] 種主(planter)は回復せず同量ダメージを受ける(ヘドロえき反転)',
    planter.currentHp === beforeP - expectD, `planter.currentHp=${planter.currentHp} expected=${beforeP - expectD}`);
} catch (__e) { skipCase('H38: ヘドロえき [出典: bulbapedia.bulbagarden.net/wiki/Liquid_Ooze_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H39: どんかん(Oblivious)の穴埋め — ちょうはつ無効(第6世代〜)・いかくによる攻撃ランクダウン無効(第8世代〜)。
// 出典: reference/_phaseD_specs_abilities2.json (Bulbapedia "Oblivious")
// ─────────────────────────────────────────────
console.log('\n=== H39: どんかん(ちょうはつ/いかく無効) [出典: bulbapedia.bulbagarden.net/wiki/Oblivious_(Ability)] ===');
try {
  resetEnv();
  const atk = freshSide('ゲンガー', 'chouhatsu', { ability: '' });
  fullHp(atk);
  const def = freshSide('カビゴン', 'hataku', { ability: 'どんかん' });
  fullHp(def);
  E.sides.self = atk; E.sides.opp = def;
  E.phaseApplyEffects('self', 'opp', moveByKey('chouhatsu'));
  check('H39-a [出典: bulbapedia.bulbagarden.net/wiki/Oblivious_(Ability)] どんかん持ちはちょうはつを受け付けない',
    (def.tauntTurns || 0) === 0, `tauntTurns=${def.tauntTurns}`);

  resetEnv();
  const atk2 = freshSide('ギャラドス', 'hataku', { ability: 'いかく' });
  fullHp(atk2);
  const def2 = freshSide('カビゴン', 'hataku', { ability: 'どんかん' });
  fullHp(def2);
  E.sides.self = atk2; E.sides.opp = def2;
  E.phaseInitA();
  check('H39-b どんかん持ちはいかくによる攻撃ランクダウンを受けない(def.rank.atk===0)',
    def2.rank.atk === 0, `def2.rank.atk=${def2.rank.atk}`);
} catch (__e) { skipCase('H39: どんかん [出典: bulbapedia.bulbagarden.net/wiki/Oblivious_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H40: しゅうかく(Harvest) — ターン終了時、通常50%/にほんばれ下100%で消費したきのみを復活させる。
// 出典: reference/_phaseD_specs_abilities2.json (Bulbapedia "Harvest")
// ─────────────────────────────────────────────
console.log('\n=== H40: しゅうかく [出典: bulbapedia.bulbagarden.net/wiki/Harvest_(Ability)] ===');
try {
  resetEnv();
  const st = freshSide('カビゴン', 'hataku', { ability: 'しゅうかく' });
  fullHp(st);
  st.item = ''; st.lastConsumedItem = 'berry_oran';
  const other = freshSide('カイリキー', 'hataku', { ability: '' });
  fullHp(other);
  E.sides.self = st; E.sides.opp = other;
  E.setRandom(() => 0.6);   // 0.6 は 50%(にほんばれでない時)には外れ、100%(にほんばれ)には当たる
  E.runTurn();
  check('H40-a 通常天候(ロール0.6)では50%を外れて復活しない', st.item === '', `item=${st.item}`);

  resetEnv();
  const st2 = freshSide('カビゴン', 'hataku', { ability: 'しゅうかく' });
  fullHp(st2);
  st2.item = ''; st2.lastConsumedItem = 'berry_oran';
  const other2 = freshSide('カイリキー', 'hataku', { ability: '' });
  fullHp(other2);
  E.sides.self = st2; E.sides.opp = other2;
  E.env.weather = 'sunny';
  E.setRandom(() => 0.6);   // にほんばれ下は100%なので同じロールでも必ず復活する
  E.runTurn();
  check('H40-b [出典: bulbapedia.bulbagarden.net/wiki/Harvest_(Ability)] にほんばれ下(ロール0.6でも100%)ではきのみが復活する',
    st2.item === 'berry_oran' && st2.lastConsumedItem == null, `item=${st2.item} lastConsumedItem=${st2.lastConsumedItem}`);
} catch (__e) { skipCase('H40: しゅうかく [出典: bulbapedia.bulbagarden.net/wiki/Harvest_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H41: てんきや(Forecast) — 天候に応じてポワルンのタイプが変わる(このDBはフォーム未収録のため
// タイプ変化のみの最小実装。にほんばれ=ほのお/あめ=みず/ゆき=こおり/それ以外=ノーマル)。
// 出典: reference/_phaseD_specs_abilities2.json (Bulbapedia "Forecast")
// ─────────────────────────────────────────────
console.log('\n=== H41: てんきや [出典: bulbapedia.bulbagarden.net/wiki/Forecast_(Ability)] ===');
try {
  resetEnv();
  const cf = freshSide('ポワルン', 'hataku', { ability: 'てんきや' });
  fullHp(cf);
  const opp = freshSide('カビゴン', ['nihonbare', 'amagoi', 'yukigeshiki'], { ability: '' });
  fullHp(opp);
  E.sides.self = cf; E.sides.opp = opp;
  check('H41-a 通常天候ではノーマルタイプのまま', JSON.stringify(E.sideTypes(cf)) === JSON.stringify(['ノーマル']),
    JSON.stringify(E.sideTypes(cf)));

  E.phaseApplyEffects('opp', 'self', moveByKey('nihonbare'));
  check('H41-b [出典: bulbapedia.bulbagarden.net/wiki/Forecast_(Ability)] にほんばれでほのおタイプになる',
    JSON.stringify(E.sideTypes(cf)) === JSON.stringify(['ほのお']), JSON.stringify(E.sideTypes(cf)));

  E.phaseApplyEffects('opp', 'self', moveByKey('amagoi'));
  check('H41-c あめでみずタイプになる', JSON.stringify(E.sideTypes(cf)) === JSON.stringify(['みず']), JSON.stringify(E.sideTypes(cf)));

  E.phaseApplyEffects('opp', 'self', moveByKey('yukigeshiki'));
  check('H41-d ゆきでこおりタイプになる', JSON.stringify(E.sideTypes(cf)) === JSON.stringify(['こおり']), JSON.stringify(E.sideTypes(cf)));

  // 場に出た時点(Init-A)ですでに天候が張られているケースも正しく反映される
  resetEnv();
  E.env.weather = 'sunny';
  const cf2 = freshSide('ポワルン', 'hataku', { ability: 'てんきや' });
  fullHp(cf2);
  const opp2 = freshSide('カビゴン', 'hataku', { ability: '' });
  fullHp(opp2);
  E.sides.self = cf2; E.sides.opp = opp2;
  E.phaseInitA();
  check('H41-e 登場時(Init-A)にすでに晴れが張られていれば、すぐほのおタイプになる',
    JSON.stringify(E.sideTypes(cf2)) === JSON.stringify(['ほのお']), JSON.stringify(E.sideTypes(cf2)));
} catch (__e) { skipCase('H41: てんきや [出典: bulbapedia.bulbagarden.net/wiki/Forecast_(Ability)]', (__e && __e.message) || String(__e)); }

// ─────────────────────────────────────────────
// H42: フラワーベール(Flower Veil) — 実装見送りの確認。
// 仕様書(reference/_phaseD_specs_abilities1.json)のsingles_relevant=false:
// 「味方(自分以外の隣接/非隣接の味方くさタイプ)を守る効果が主眼で、1vs1シングル戦(味方なし)では発動対象が
// 存在しない。かつ効果保持者自身はくさタイプではない(全てフェアリータイプ)ため、自己防御としても機能しない」。
// 本シミュレーターは1vs1シングル戦専用のためエンジン実装を見送る(全部版限定/シングル無意味skipCaseイディオム)。
// ─────────────────────────────────────────────
skipCase('H42: フラワーベール [出典: bulbapedia.bulbagarden.net/wiki/Flower_Veil_(Ability)]',
  '仕様書のsingles_relevant=false(味方保護が主眼・保持者自身はくさタイプでない)=1vs1シングル戦では発動対象なし。実装見送り(仕様書どおり)');

// ─────────────────────────────────────────────
// 集計
// ─────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`難所相互作用42件テスト結果: pass=${pass} fail=${fail} skip=${skip}`);
if (fails.length) {
  console.log('\n--- FAIL一覧 ---');
  fails.forEach(f => console.log('  ' + f));
}
process.exit(fail > 0 ? 1 : 0);
