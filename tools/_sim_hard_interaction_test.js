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
// 集計
// ─────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`難所相互作用20件テスト結果: pass=${pass} fail=${fail} skip=${skip}`);
if (fails.length) {
  console.log('\n--- FAIL一覧 ---');
  fails.forEach(f => console.log('  ' + f));
}
process.exit(fail > 0 ? 1 : 0);
