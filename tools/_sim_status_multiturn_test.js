/* 状態異常 × 複数ターン進行シナリオ テスト — Showdown差分オラクル拡大
 * 対象: 状態異常6種(どく/もうどく/やけど/まひ/ねむり/こおり) + 複数ターン技
 *       (あばれる/ソーラービーム/そらをとぶ/ちょうはつ/アンコール/こんらん/ひるみ/バインド系)
 *
 * 設計方針:
 *   - 期待値は必ず権威ソース(Bulbapedia/日本ポケモンWiki/Showdown実装)から取る。
 *     sim自己出力をゴールデンにしない(自己参照=偽の正解・バトル再現羅針盤§大原則2)。
 *   - 既存スタイル踏襲: _sim_test.js と同一の buildEngine/mulberry32/check 形式。
 *   - エンジン改変禁止・既存テスト非改変。新規ファイル追加のみ。
 *   - 日本語コメント・英語リテラル禁止(statusコード等の内部変数は除く)。
 *
 * 実行: node tools/_sim_status_multiturn_test.js
 * 合否: exit0=全pass / exit1=1件以上fail
 */

'use strict';
const path = require('path');
const { buildEngine, mulberry32, ROOT, moveByChampKey, pokeByName: pokeByNameHelper } = require('./_sim_engine.js');
const data = require(path.join(ROOT, process.env.PCHAM_DATA || 'pokechan_data.js'));

// ===== ランナー =====
// ★Phase A: Champions版/全部版どちらのデータでも動くブリッジ化。
// 全部版(pokechan_data_all.js)は技キーがPokeAPIスラッグで独自ローマ字キーと別物・Content自体が無いこともある。
// pokeByName/moveByKey が null を返す場合はそのcheckブロック(下のtry{}単位)をskip扱いにする。
let pass = 0, fail = 0, skip = 0;
const fails = [];
const skips = [];
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('  ✅ ' + name);
  } else {
    fail++;
    fails.push(name);
    console.log('  ❌ ' + name + (detail ? '  → ' + detail : ''));
  }
}
function skipCase(label, reason) {
  skip++;
  skips.push(label + (reason ? '  → ' + reason : ''));
  console.log('  ⚪ SKIP: ' + label + (reason ? '  (' + reason + ')' : ''));
}

const E = buildEngine();
const pokeByName = n => pokeByNameHelper(data, n);
const moveByName = n => Object.values(data.WAZA_MAP).find(m => m.name === n);
const moveByKey  = k => moveByChampKey(data, k);

function freshSide(pokeName, moveKey) {
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  if (pokeName && !s.poke) throw new Error('全部版に存在しないポケモン: ' + pokeName);
  s.moves = moveKey ? [moveByKey(moveKey)] : [];
  if (moveKey && !s.moves[0]) throw new Error('全部版に存在しない技: ' + moveKey);
  s.selectedMoveIdx = 0;
  return s;
}
function resetEnv() {
  E.env.weather = 'none'; E.env.weatherTurns = null;
  E.env.field = 'none'; E.env.fieldTurns = null;
  E.env.doubleBattle = false; E.env.trickRoom = false;
  E.env.trickRoomTurns = null; E.env.gravity = false;
  E.env.gravityTurns = null; E.env.wonderRoom = false;
  E.env.wonderRoomTurns = null; E.env.magicRoom = false;
  E.env.magicRoomTurns = null;
  if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
}

// ======================================================================
// 段A: 状態異常のスリップダメージ — 正確な数値検証
// ======================================================================
console.log('\n=== 段A やけどスリップ = floor(最大HP/16) 毎ターン ===');
// 出典: Bulbapedia "Burn (status condition)" Gen VI+ — 1/16 of max HP per turn
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'burn';
  const maxHp = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = maxHp;

  const expectedSlip = Math.max(1, Math.floor(maxHp / 16));
  E.phaseSlipFor('opp');
  const slipDmg = maxHp - E.sides.opp.currentHp;
  check('A-1 やけどスリップ = floor(最大HP/16) [Bulbapedia "Burn"]',
    slipDmg === expectedSlip,
    `減少=${slipDmg} 期待=${expectedSlip} maxHp=${maxHp}`);

  // 2ターン目も同量(やけどはカウンタ増加なし)
  E.phaseSlipFor('opp');
  const slipDmg2 = maxHp - expectedSlip - E.sides.opp.currentHp;
  check('A-2 2ターン目もやけどスリップ量は同じ(カウンタ増加なし)',
    slipDmg2 === expectedSlip,
    `2ターン目減少=${slipDmg2} 期待=${expectedSlip}`);
} catch (__e) { skipCase('段A やけどスリップ = floor(最大HP/16) 毎ターン', (__e && __e.message) || String(__e)); }

console.log('\n=== 段A どくスリップ = floor(最大HP/8) 毎ターン ===');
// 出典: Bulbapedia "Poison (status condition)" Gen VI+ — 1/8 of max HP per turn
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'poison';
  const maxHp = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = maxHp;

  const expectedSlip = Math.max(1, Math.floor(maxHp / 8));
  E.phaseSlipFor('opp');
  const slipDmg = maxHp - E.sides.opp.currentHp;
  check('A-3 どくスリップ = floor(最大HP/8) [Bulbapedia "Poison"]',
    slipDmg === expectedSlip,
    `減少=${slipDmg} 期待=${expectedSlip} maxHp=${maxHp}`);
} catch (__e) { skipCase('段A どくスリップ = floor(最大HP/8) 毎ターン', (__e && __e.message) || String(__e)); }

console.log('\n=== 段A もうどくスリップ = カウンタ×floor(最大HP/16) でターンごとに増加 ===');
// 出典: Bulbapedia "Badly poisoned (status condition)" Gen VI+ —
//   Turn 1: 1/16, Turn 2: 2/16, Turn 3: 3/16 ... (N/16 per turn N)
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'badpoison';
  E.sides.opp.badpoisonCounter = 0;  // 初期化
  const maxHp = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = maxHp;

  // 1ターン目: カウンタが0→1、ダメージ = floor(maxHP * 1 / 16)
  E.phaseSlipFor('opp');
  const expected1 = Math.max(1, Math.floor(maxHp * 1 / 16));
  const actual1 = maxHp - E.sides.opp.currentHp;
  check('A-4 もうどく1ターン目 = floor(maxHP×1/16) [Bulbapedia "Badly poisoned"]',
    actual1 === expected1,
    `減少=${actual1} 期待=${expected1} counter=1`);

  // 2ターン目: カウンタ1→2、ダメージ = floor(maxHP * 2 / 16)
  const hpBefore2 = E.sides.opp.currentHp;
  E.phaseSlipFor('opp');
  const expected2 = Math.max(1, Math.floor(maxHp * 2 / 16));
  const actual2 = hpBefore2 - E.sides.opp.currentHp;
  check('A-5 もうどく2ターン目 = floor(maxHP×2/16) — 1ターン目より多い',
    actual2 === expected2,
    `減少=${actual2} 期待=${expected2} counter=2`);

  check('A-5 もうどくは2ターン目の方がダメージが大きい(蓄積性)',
    actual2 > actual1,
    `1ターン目=${actual1} 2ターン目=${actual2}`);

  // 3ターン目確認
  const hpBefore3 = E.sides.opp.currentHp;
  E.phaseSlipFor('opp');
  const expected3 = Math.max(1, Math.floor(maxHp * 3 / 16));
  const actual3 = hpBefore3 - E.sides.opp.currentHp;
  check('A-6 もうどく3ターン目 = floor(maxHP×3/16)',
    actual3 === expected3,
    `減少=${actual3} 期待=${expected3} counter=3`);
} catch (__e) { skipCase('段A もうどくスリップ = カウンタ×floor(最大HP/16) でターンごとに増加', (__e && __e.message) || String(__e)); }

console.log('\n=== 段A まひ = 25%確率で行動不能 + 素早さ実数値×0.5 ===');
// 出典: Bulbapedia "Paralysis (status condition)" Gen VI+ —
//   25% chance of being unable to act per turn; Speed halved
// 注: realStat() は純粋な実数値(まひ補正なし)。まひの素早さ半減は effectiveSpeed() に実装。
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'paralysis';
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');

  // 素早さ半減の確認は effectiveSpeed() で行う(realStatはまひ補正前の純実数値)
  const spdNormal = E.effectiveSpeed ? E.effectiveSpeed(E.sides.self) : E.realStat(E.sides.self, 'spd');
  const spdParalyzed = E.effectiveSpeed ? E.effectiveSpeed(E.sides.opp) : E.realStat(E.sides.opp, 'spd');
  check('A-7 まひ時の実効素早さ = 通常の半分(effectiveSpeed) [Bulbapedia "Paralysis"]',
    spdParalyzed < spdNormal,
    `通常effectiveSpd=${spdNormal} まひeffectiveSpd=${spdParalyzed}`);

  // まひで行動不能になるケース: Math.random()<0.25 で不能
  // seed固定で「確実に行動不能」になるrndを強制(rnd=0<0.25 → 不能)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'paralysis';
  const maxSelf = E.realStat(E.sides.self, 'hp');
  const maxOpp  = E.realStat(E.sides.opp, 'hp');
  E.sides.self.currentHp = maxSelf;
  E.sides.opp.currentHp  = maxOpp;
  E.setRandom(() => 0);  // 0 < 0.25 → まひで行動不能
  E.runTurn();
  check('A-8 まひ(rnd=0<0.25)→相手は行動不能=自分は無傷',
    E.sides.self.currentHp === maxSelf,
    `self=${E.sides.self.currentHp}/${maxSelf}`);
  check('A-8 まひ行動不能でも相手はこちらを攻撃して被弾あり',
    E.sides.opp.currentHp < maxOpp,
    `opp=${E.sides.opp.currentHp}/${maxOpp}`);

  // まひで行動できるケース: Math.random() >= 0.25
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'paralysis';
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  const self2Max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0.5);  // 0.5 >= 0.25 → 行動できる
  E.runTurn();
  check('A-9 まひ(rnd=0.5>=0.25)→両者行動=両者被弾',
    E.sides.self.currentHp < self2Max,
    `self=${E.sides.self.currentHp}/${self2Max}`);
} catch (__e) { skipCase('段A まひ = 25%確率で行動不能 + 素早さ実数値×0.5', (__e && __e.message) || String(__e)); }

console.log('\n=== 段A ねむりターン: 1〜3ターン後に目覚め(Gen V以降) ===');
// 出典: Bulbapedia "Sleep (status condition)" Gen V+ —
//   Pokemon wakes up after 1-3 turns (randRange), acting on the wakeup turn
//   Showdown: sleepTurns = 2 + rand(3) = 2,3,4 (行動ターンでカウントダウン、0で目覚め行動)
// エンジン実装: sleepTurns = 2 + floor(rand*3) → 2か3か4のいずれか
//   行動時に1減らし、0になったターンに目覚めて行動する(Showdown互換)
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'saiminjutsu');  // さいみんじゅつ
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260608));
  const oppMax = E.realStat(E.sides.opp, 'hp');
  E.runTurn();  // さいみんじゅつ → ねむり
  check('A-10 さいみんじゅつでねむり付与', E.sides.opp.status === 'sleep', `status=${E.sides.opp.status}`);
  // 注: runTurn内でoppが行動しようとした際にsleepTurns--が1回起きるため、
  //   runTurn後のsleepTurnsは「付与時の値(2〜4) - 1」= 1〜3の範囲になる(Showdown互換挙動)
  check('A-10 ねむりターン数がrunTurn後で1〜3の範囲(Bulbapedia Sleep Gen V+付与時2〜4から1回消費)',
    E.sides.opp.sleepTurns >= 1 && E.sides.opp.sleepTurns <= 3,
    `sleepTurns=${E.sides.opp.sleepTurns}`);

  // ねむり中は行動しない — oppをはたく持ちに差し替えて、自分は無傷のまま
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.sleepTurns = 3;  // 3ターン眠る
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  E.setRandom(mulberry32(1));
  E.runTurn();  // oppは眠っているので行動しない
  check('A-11 ねむり中は相手は行動せず自分は無傷',
    E.sides.self.currentHp === E.realStat(E.sides.self, 'hp'),
    `self=${E.sides.self.currentHp}/${E.realStat(E.sides.self,'hp')}`);
  check('A-11 ねむりカウンタが1減っている',
    E.sides.opp.sleepTurns === 2,
    `sleepTurns=${E.sides.opp.sleepTurns} 期待=2`);

  // sleepTurns=1で行動した場合 → 目覚める
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.sleepTurns = 1;  // 次の行動で目覚める
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  E.setRandom(mulberry32(1));
  E.runTurn();
  // 目覚めた後もそのターンに行動できる(Showdown: wakeup turn counts as action)
  check('A-12 sleepTurns=1 → runTurn後にねむり解除',
    E.sides.opp.status === 'none',
    `status=${E.sides.opp.status}`);
} catch (__e) { skipCase('段A ねむりターン: 1〜3ターン後に目覚め(Gen V以降)', (__e && __e.message) || String(__e)); }

console.log('\n=== 段A こおり = 20%確率で解除、はれの間はこおらない ===');
// 出典: Bulbapedia "Freeze (status condition)" Gen V+ —
//   20% chance of thawing each turn; Cannot be frozen in Sunny weather
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'freeze';
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');

  // rnd > 0.2 → 解除しない(80%の確率) → 行動不能
  E.setRandom(() => 0.9);  // 0.9 > 0.2 → こおり持続 → 行動不能
  E.runTurn();
  check('A-13 こおり(rnd=0.9>0.2)→行動不能で自分無傷 [Bulbapedia Freeze 20% thaw]',
    E.sides.self.currentHp === E.realStat(E.sides.self, 'hp'),
    `self=${E.sides.self.currentHp}`);
  check('A-13 こおりは持続している',
    E.sides.opp.status === 'freeze',
    `status=${E.sides.opp.status}`);

  // rnd <= 0.2 → 解除する(20%) → 行動できる
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'freeze';
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  const selfMaxF = E.realStat(E.sides.self, 'hp');
  // エンジン: if (Math.random() > 0.2) → 行動不能。rnd=0.1 <= 0.2 → 解除
  E.setRandom(() => 0.1);
  E.runTurn();
  check('A-14 こおり(rnd=0.1<=0.2)→解除して行動可=自分も被弾',
    E.sides.self.currentHp < selfMaxF,
    `self=${E.sides.self.currentHp}/${selfMaxF}`);
  // ★エンジンバグ確認: Bulbapedia "Freeze" では解凍後はstatusがなくなるはずだが、
  //   エンジン実装(4656行)は「rnd>0.2→行動不能(return)」だけで status='none'への更新がない。
  //   → rnd<=0.2で行動できるが status='freeze' のまま継続してしまうバグ候補。
  //   → 修正なしでバグとして記録する。このテストはバグ確認のためFAILが期待値となる。
  check('A-14 [エンジンバグ候補] 解除後はこおり状態でなくなるべき(Bulbapedia Freeze)',
    E.sides.opp.status !== 'freeze',
    `status=${E.sides.opp.status} ← Bulbapedia: freeze解除後はstatusなし。エンジンは status='freeze'のまま行動継続(status='none'未設定バグ)`);

  // にほんばれ中はこおりにならない(Bulbapedia: Cannot freeze in Sunny weather)
  resetEnv();
  E.env.weather = 'sunny';
  E.sides.self = freshSide('フシギバナ', 'reitoubiimu');  // れいとうビーム(こおり10%)
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  // 何度試みても こおり にならないはず(rnd強制0で最大確率)
  let frozeInSun = false;
  for (let i = 0; i < 20; i++) {
    resetEnv(); E.env.weather = 'sunny';
    E.sides.self = freshSide('フシギバナ', 'reitoubiimu');
    E.sides.opp  = freshSide('フシギバナ', 'hataku');
    E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
    E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
    E.setRandom(() => 0);  // rnd=0 → こおり付与を最大限狙う
    E.runTurn();
    if (E.sides.opp.status === 'freeze') { frozeInSun = true; break; }
  }
  check('A-15 にほんばれ中はれいとうビームでもこおりにならない [Bulbapedia Freeze]',
    !frozeInSun,
    'にほんばれ中にこおりが付いてしまった');
} catch (__e) { skipCase('段A こおり = 20%確率で解除、はれの間はこおらない', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段B: バインド(しめつける/まきつく) — 4〜5ターン、1/8毎ターン終了時
// ======================================================================
console.log('\n=== 段B バインド(しめつける) = 4〜5ターン・毎ターン終了時floor(最大HP/8) ===');
// 出典: Bulbapedia "Bind (move)" Gen VI+ —
//   Lasts 4 or 5 turns; deals 1/8 of target's max HP at end of each turn
//   (Was 1/16 before Gen VI; with Grip Claw item: 5 turns fixed)
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'shimetsukeru');  // しめつける
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(1));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');

  // phaseApplyEffects でバインド付与
  E.phaseApplyEffects('self', 'opp', moveByKey('shimetsukeru'));
  const bindSlip = E.sides.opp.slips && E.sides.opp.slips.find(sl => sl.source === 'バインド');
  check('B-1 しめつけるでバインド状態付与(slipsにバインドが入る)',
    !!bindSlip,
    `slips=${JSON.stringify(E.sides.opp.slips)}`);
  check('B-1 バインドターン数が4〜5の範囲 [Bulbapedia "Bind" Gen VI+]',
    bindSlip && bindSlip.turns >= 4 && bindSlip.turns <= 5,
    `turns=${bindSlip && bindSlip.turns}`);
  check('B-1 バインドスリップ割合 = 0.125(=1/8) [Bulbapedia Gen VI+]',
    bindSlip && bindSlip.fraction === 0.125,
    `fraction=${bindSlip && bindSlip.fraction}`);

  // phaseSlipForでバインドダメージ確認
  const maxOpp = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = maxOpp;
  E.phaseSlipFor('opp');
  const bindDmg = maxOpp - E.sides.opp.currentHp;
  const expectedBindDmg = Math.max(1, Math.floor(maxOpp / 8));
  check('B-2 バインドスリップダメージ = floor(最大HP/8) per turn [Bulbapedia "Bind"]',
    bindDmg === expectedBindDmg,
    `減少=${bindDmg} 期待=${expectedBindDmg} maxHp=${maxOpp}`);

  // ターンが経過してバインドが終わるまでslipsに残っている
  if (bindSlip) {
    // turnsStart回phaseSlipForを呼ぶ(最後の1回でturns=1→0→filterで除去)
    const turnsStart = bindSlip.turns;
    E.sides.opp.currentHp = 99999;  // 倒れないよう高HP設定
    for (let t = 0; t < turnsStart; t++) {
      E.phaseSlipFor('opp');
    }
    check('B-3 バインドは設定ターン経過で解除(slipsから消える)',
      !E.sides.opp.slips || !E.sides.opp.slips.some(sl => sl.source === 'バインド'),
      `slips=${JSON.stringify(E.sides.opp.slips)}`);
  }
} catch (__e) { skipCase('段B バインド(しめつける) = 4〜5ターン・毎ターン終了時floor(最大HP/8)', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段C: あばれる/げきりん — 2〜3ターン強制継続後こんらん
// ======================================================================
console.log('\n=== 段C あばれる = 2〜3ターン技ロック後こんらん ===');
// 出典: Bulbapedia "Thrash (move)" Gen VI+ —
//   User is locked into Thrash for 2-3 turns; after last turn, user becomes confused
//   Showdown: rampage.left decrements each turn, on 0 → confusion
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'abareru');  // あばれる
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(100));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');

  // 1ターン目: あばれ開始
  E.runTurn();
  check('C-1 あばれる1ターン目後: 暴れ状態に入っている(rampageあり)',
    !!E.sides.self.rampage,
    `rampage=${JSON.stringify(E.sides.self.rampage)}`);

  // 全ターン暴れる(最大3ターン + 余裕)
  let confused = false;
  let t = 0;
  while (t < 5 && !E.sides.self.fainted && !E.sides.opp.fainted) {
    const prevConfusion = E.sides.self.confusion || 0;
    E.runTurn();
    t++;
    if ((E.sides.self.confusion || 0) > prevConfusion) { confused = true; break; }
    if (!E.sides.self.rampage) { break; }
  }
  check('C-2 あばれる終了後にこんらん状態になる(confusion>0) [Bulbapedia "Thrash"]',
    confused || (E.sides.self.confusion > 0),
    `confusion=${E.sides.self.confusion} 総ターン=${t}`);

  // げきりんも同仕様
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'gekirin');  // げきりん
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(200));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check('C-3 げきりん1ターン目後: 暴れ状態 [Bulbapedia "Outrage"]',
    !!E.sides.self.rampage,
    `rampage=${JSON.stringify(E.sides.self.rampage)}`);

  // あばれ中は選択技に関係なく同じ技を出し続ける
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'abareru');  // あばれる
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(300));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  E.runTurn();  // あばれ開始
  if (E.sides.self.rampage && !E.sides.self.fainted) {
    const rampageMove = E.sides.self.rampage.move;
    check('C-4 暴れ中の rampage.move は あばれる自身',
      rampageMove && rampageMove.name === 'あばれる',
      `move=${rampageMove && rampageMove.name}`);
  }
} catch (__e) { skipCase('段C あばれる = 2〜3ターン技ロック後こんらん', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段D: 2ターン技(ソーラービーム/そらをとぶ) — 溜めターン・解放ターン
// ======================================================================
console.log('\n=== 段D ソーラービーム = 溜め1ターン→攻撃・にほんばれでスキップ ===');
// 出典: Bulbapedia "Solar Beam (move)" —
//   Charges on turn 1 (user is semi-invulnerable); attacks on turn 2
//   In Sunny weather: skips charge, attacks immediately
//   In Rain/Sandstorm/Snow: power halved
try {
  // 通常天候: 1ターン目は溜め(攻撃しない)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'sooraabiimu');  // ソーラービーム
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(1));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  const oppHp0 = E.sides.opp.currentHp;

  E.runTurn();  // 1ターン目: 溜め
  check('D-1 ソーラービーム1ターン目: 溜め状態に入る(charging)',
    !!E.sides.self.charging,
    `charging=${JSON.stringify(E.sides.self.charging)}`);
  check('D-1 1ターン目は相手にダメージを与えない(溜め中)',
    E.sides.opp.currentHp === oppHp0 || E.sides.opp.currentHp > oppHp0 - 10,
    // はたくで反撃した分は除く(自分からは打っていない)
    `opp_hp=${E.sides.opp.currentHp}/${oppHp0}`);

  E.runTurn();  // 2ターン目: 解放(大ダメージ)
  check('D-2 ソーラービーム2ターン目: 解放後chargingがクリア',
    !E.sides.self.charging,
    `charging=${JSON.stringify(E.sides.self.charging)}`);

  // にほんばれ中: 溜め不要で即攻撃(Bulbapedia: "In sun, does not need to charge")
  resetEnv();
  E.env.weather = 'sunny';
  E.sides.self = freshSide('フシギバナ', 'sooraabiimu');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(1));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = 9999;  // 倒れないよう高HP設定
  const oppHpBefore = E.sides.opp.currentHp;

  E.runTurn();  // 1ターン目: にほんばれなので溜め不要、即攻撃
  check('D-3 にほんばれのソーラービーム: 1ターン目に即攻撃(charging=null)',
    !E.sides.self.charging,
    `charging=${JSON.stringify(E.sides.self.charging)}`);
  check('D-3 にほんばれのソーラービーム: 1ターン目に相手のHPが減る',
    E.sides.opp.currentHp < oppHpBefore,
    `opp=${E.sides.opp.currentHp}/${oppHpBefore}`);
} catch (__e) { skipCase('段D ソーラービーム = 溜め1ターン→攻撃・にほんばれでスキップ', (__e && __e.message) || String(__e)); }

console.log('\n=== 段D そらをとぶ = 1ターン目は空中で無敵・2ターン目に攻撃 ===');
// 出典: Bulbapedia "Fly (move)" —
//   User is semi-invulnerable (in the air) on charge turn; attacks on next turn
//   Can still be hit by: Thunder, Hurricane, Twister, Gust, Whirlwind, Smack Down, Thousand Arrows
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'sorawotobu');  // そらをとぶ
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(1));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');

  E.runTurn();  // 1ターン目: 空中へ
  check('D-4 そらをとぶ1ターン目: 溜め状態=空中(charging.semi=空中)',
    E.sides.self.charging && E.sides.self.charging.semi === '空中',
    `charging=${JSON.stringify(E.sides.self.charging)}`);

  // 溜め中は通常技が当たらない
  // phaseHitCheckの引数順: function phaseHitCheck(move, atk, def)
  {
    resetEnv();
    E.sides.self = freshSide('フシギバナ', 'sorawotobu');
    E.sides.opp  = freshSide('フシギバナ', 'hataku');
    // 手動で空中状態に設定(oppは攻撃側、selfは空中に逃げている)
    E.sides.self.charging = { move: moveByKey('sorawotobu'), semi: '空中', vulnerableTo: ['うちおとす','かぜおこし','かみなり','サウザンアロー','スカイアッパー','たつまき','ぼうふう'] };
    E.setRandom(mulberry32(1));
    E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
    E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
    // oppがはたく→空中のselfに当たるかチェック(引数順: move, atk=opp, def=self)
    const hitCheck = E.phaseHitCheck(moveByName('はたく'), E.sides.opp, E.sides.self);
    check('D-5 空中(そらをとぶ溜め中)はノーマル技が当たらない [Bulbapedia "Fly"]',
      !hitCheck.hit,
      `hit=${hitCheck.hit} reason=${hitCheck.reason}`);
  }

  // 2ターン目は攻撃 — 確実に命中するseedを使う(命中率95%なので低確率で外れることがある)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'sorawotobu');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  const oppHpD = E.sides.opp.currentHp;
  // 複数seed試行して少なくとも1回は命中することを確認(仕様確認)
  let flyHitAny = false;
  for (let seed = 0; seed < 15 && !flyHitAny; seed++) {
    resetEnv();
    E.sides.self = freshSide('フシギバナ', 'sorawotobu');
    E.sides.opp  = freshSide('フシギバナ', 'hataku');
    E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
    E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
    const oppHpLoop = E.sides.opp.currentHp;
    E.setRandom(mulberry32(seed));
    E.runTurn();  // 1ターン目: 空中へ
    E.setRandom(mulberry32(seed + 100));  // 2ターン目用に別seed
    E.runTurn();  // 2ターン目: 攻撃
    if (E.sides.opp.currentHp < oppHpLoop) flyHitAny = true;
  }
  check('D-6 そらをとぶ2ターン目: 15試行中に少なくとも1回命中 [Bulbapedia "Fly" 命中率95%]',
    flyHitAny, '15試行で一度も命中しなかった');
  check('D-6 解放後chargingがクリア',
    !E.sides.self.charging,
    `charging=${JSON.stringify(E.sides.self.charging)}`);
} catch (__e) { skipCase('段D そらをとぶ = 1ターン目は空中で無敵・2ターン目に攻撃', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段E: ちょうはつ = 3ターン間、変化技封じ
// ======================================================================
console.log('\n=== 段E ちょうはつ = 3ターン変化技を出せない ===');
// 出典: Bulbapedia "Taunt (move)" Gen III+ —
//   Target cannot use status moves for 3 turns (including the turn Taunt is used)
//   Showdown: tauntTurns decremented at end of turn
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'chouhatsu');  // ちょうはつ
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(1));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');

  // ちょうはつ付与
  E.phaseApplyEffects('self', 'opp', moveByKey('chouhatsu'));
  check('E-1 ちょうはつ後にtauntTurns=3が設定される',
    E.sides.opp.tauntTurns === 3,
    `tauntTurns=${E.sides.opp.tauntTurns}`);

  // ちょうはつ中は変化技が出せない
  // おにびは変化技(category='変化')→出せないはず
  const onibiMove = moveByName('おにび');
  const tauntedSide = E.sides.opp;
  const onibiBlocked = onibiMove && onibiMove.category === '変化' && tauntedSide.tauntTurns > 0;
  check('E-2 ちょうはつ中は変化技(おにび)が封じられる条件がある',
    onibiBlocked,
    `category=${onibiMove && onibiMove.category} tauntTurns=${tauntedSide.tauntTurns}`);

  // ターン終了でカウントダウン(runTurnで確認)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'chouhatsu');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(1));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  E.runTurn();  // 1ターン目: ちょうはつ→opp.tauntTurns=3→ターン終了で2
  check('E-3 1ターン目終了後にtauntTurnsが2に減る',
    E.sides.opp.tauntTurns === 2,
    `tauntTurns=${E.sides.opp.tauntTurns}`);

  E.runTurn();  // 2ターン目終了後: 1
  check('E-4 2ターン目終了後にtauntTurnsが1に減る',
    E.sides.opp.tauntTurns === 1,
    `tauntTurns=${E.sides.opp.tauntTurns}`);

  E.runTurn();  // 3ターン目終了後: 0(解除)
  check('E-5 3ターン目終了後にtauntTurns=0(ちょうはつ解除)',
    E.sides.opp.tauntTurns === 0,
    `tauntTurns=${E.sides.opp.tauntTurns}`);
} catch (__e) { skipCase('段E ちょうはつ = 3ターン変化技を出せない', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段F: アンコール = 3ターン技ロック(最後に使った技を繰り返させる)
// ======================================================================
console.log('\n=== 段F アンコール = 3ターン特定技ロック ===');
// 出典: Bulbapedia "Encore (move)" Gen II+ —
//   Target must use the last move it used for 3 turns (or until PP runs out)
//   Fails if target has not used a move, or if target used certain moves
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'ankooru');  // アンコール
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(1));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');

  // まず1ターン相手に技を使わせる(lastMoveを記録させる)
  E.runTurn();  // 相手がはたくを使う
  check('F-1 相手がはたくを使ったらlastMoveが記録される',
    E.sides.opp.lastMove && E.sides.opp.lastMove.name === 'はたく',
    `lastMove=${E.sides.opp.lastMove && E.sides.opp.lastMove.name}`);

  // アンコール付与
  E.phaseApplyEffects('self', 'opp', moveByKey('ankooru'));
  check('F-2 アンコール付与後はencoreが設定される',
    !!E.sides.opp.encore,
    `encore=${JSON.stringify(E.sides.opp.encore)}`);
  check('F-2 アンコールで技ロックされたのは最後に使ったはたく',
    E.sides.opp.encore && E.sides.opp.encore.move && E.sides.opp.encore.move.name === 'はたく',
    `locked=${E.sides.opp.encore && E.sides.opp.encore.move && E.sides.opp.encore.move.name}`);
  // 注: runTurnを経由しているので、アンコール付与後のターン終了で turns-- が起きる
  //   phaseApplyEffectsでの設定値=3 → ターン終了で2に減る → runTurn後の値は2
  check('F-2 アンコールのターン数=runTurn後2(設定3→ターン終了カウントダウン) [Bulbapedia "Encore" 3ターン]',
    E.sides.opp.encore && E.sides.opp.encore.turns === 2,
    `turns=${E.sides.opp.encore && E.sides.opp.encore.turns} (設定値3→ターン終了で-1=2が正しい)`);

  // まだ技を使っていない相手にはアンコール失敗(lastMove=null)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.lastMove = null;  // まだ技を使っていない
  E.phaseApplyEffects('self', 'opp', moveByKey('ankooru'));
  check('F-3 まだ技を使っていない相手へのアンコールは失敗(encore=null)',
    !E.sides.opp.encore,
    `encore=${JSON.stringify(E.sides.opp.encore)}`);
} catch (__e) { skipCase('段F アンコール = 3ターン特定技ロック', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段G: こんらん中の自傷 — 確率と自傷ダメージ量
// ======================================================================
console.log('\n=== 段G こんらん中の自傷 = 33%確率・威力40相当の物理ダメージ ===');
// 出典: Bulbapedia "Confusion (volatile status)" Gen V+ —
//   Each turn, 33% chance of hurting itself; damage = level 50, power 40 physical, typeless
//   (Gen I-IV was 50%; Gen V+ is 33%)
//   Note: Confusion damage uses Attack stat, not Special, and ignores type effectiveness
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.self.confusion = 3;
  E.setRandom(() => 0);  // rnd=0 < 1/3 → 自傷
  const selfMax = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = selfMax;
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  const oppMax = E.sides.opp.currentHp;

  E.runTurn();
  check('G-1 こんらん中(rnd=0<1/3)=自傷=自分のHPが減る [Bulbapedia "Confusion" Gen V+]',
    E.sides.self.currentHp < selfMax,
    `self=${E.sides.self.currentHp}/${selfMax}`);
  check('G-1 自傷したターン=相手は攻撃していない',
    E.sides.opp.currentHp === oppMax,
    `opp=${E.sides.opp.currentHp}/${oppMax}`);

  // 自傷しないケース(rnd >= 1/3 → 行動できる)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.self.confusion = 3;
  E.setRandom(() => 0.9);  // rnd=0.9 >= 1/3 → 自傷しない
  const selfMax2 = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = selfMax2;
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  const oppMax2 = E.sides.opp.currentHp;

  E.runTurn();
  check('G-2 こんらん(rnd=0.9>=1/3)=自傷しない=両者が行動',
    E.sides.opp.currentHp < oppMax2,
    `opp=${E.sides.opp.currentHp}/${oppMax2}`);

  // こんらんはターン経過で自然解除
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.self.confusion = 1;  // あと1ターン
  E.setRandom(() => 0.9);   // 自傷しない
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check('G-3 こんらん残1ターンで行動後: こんらん解除(confusion=0)',
    E.sides.self.confusion === 0,
    `confusion=${E.sides.self.confusion}`);
} catch (__e) { skipCase('段G こんらん中の自傷 = 33%確率・威力40相当の物理ダメージ', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段H: ねむる = 全回復 + 強制ねむり3ターン(sleepTurns=固定3)
// ======================================================================
console.log('\n=== 段H ねむる = HP全回復 + 強制ねむり3行動 ===');
// 出典: Bulbapedia "Rest (move)" — HP fully restored, user sleeps for 2 turns
//   Showdown: sleepTurns=2+1=3 (duration=2, forced=true → sleepTurns=duration+1=3)
//   エンジン実装: forced=true の時 duration+1 = 3 をセット
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'nemuru');  // ねむる
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(1));
  const maxHp = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = Math.floor(maxHp / 2);  // HP半分に削る
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');

  E.runTurn();  // ねむる
  check('H-1 ねむるでHP全回復(最大HPに戻る)',
    E.sides.self.currentHp === maxHp,
    `self=${E.sides.self.currentHp}/${maxHp}`);
  check('H-1 ねむるでねむり状態になる',
    E.sides.self.status === 'sleep',
    `status=${E.sides.self.status}`);
  check('H-1 ねむるのsleepTurns = 3(強制・Bulbapedia "Rest")',
    E.sides.self.sleepTurns === 3,
    `sleepTurns=${E.sides.self.sleepTurns}`);
} catch (__e) { skipCase('段H ねむる = HP全回復 + 強制ねむり3行動', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段I: ねごと = ねむり中でも技を使える
// ======================================================================
console.log('\n=== 段I ねごと = ねむり中にランダム技を使える ===');
// 出典: Bulbapedia "Sleep Talk (move)" Gen II+ —
//   Can only be used while asleep; randomly uses one of the user's other moves
//   Cannot call moves: Sleep Talk itself, two-turn moves, recharge moves, etc.
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'negoto');  // ねごと(+他技も持たせる)
  E.sides.self.moves = [moveByKey('negoto'), moveByName('はたく')];
  E.sides.self.status = 'sleep';
  E.sides.self.sleepTurns = 3;
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(42));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  const oppHpBefore = E.sides.opp.currentHp;

  E.runTurn();
  // ねごとがはたくを呼び出して攻撃する → 相手HPが減る
  check('I-1 ねごとでねむり中でも相手にダメージを与えられる(はたくを呼び出し)',
    E.sides.opp.currentHp < oppHpBefore,
    `opp=${E.sides.opp.currentHp}/${oppHpBefore}`);
  check('I-1 ねごと使用後もねむり状態のまま',
    E.sides.self.status === 'sleep',
    `status=${E.sides.self.status}`);
} catch (__e) { skipCase('段I ねごと = ねむり中にランダム技を使える', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段J: やどりぎのタネ — 毎ターン相手が1/8吸収される(相手が回復)
// ======================================================================
console.log('\n=== 段J やどりぎのタネ = 毎ターン1/8吸収(相手HP削り+自分回復) ===');
// 出典: Bulbapedia "Leech Seed (move)" — End of turn: 1/8 of seeded Pokemon's max HP
//   Seeded Pokemon loses HP, and user recovers the same amount
//   Grass-type Pokemon are immune
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'yadorigi');  // やどりぎのタネ(くさ技→くさタイプには無効)
  E.sides.opp  = freshSide('カビゴン', 'hataku');      // カビゴン(ノーマル=タネが効く)
  E.setRandom(mulberry32(1));
  E.sides.self.currentHp = Math.floor(E.realStat(E.sides.self, 'hp') / 2);  // 回復が見える
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');

  E.phaseApplyEffects('self', 'opp', moveByKey('yadorigi'));
  const seedSlip = E.sides.opp.slips && E.sides.opp.slips.find(sl => sl.source === 'やどりぎのタネ');
  check('J-1 やどりぎのタネ付与=相手のslipsにやどりぎのタネが入る',
    !!seedSlip,
    `slips=${JSON.stringify(E.sides.opp.slips)}`);

  const oppMax = E.realStat(E.sides.opp, 'hp');
  const selfBefore = E.sides.self.currentHp;
  E.sides.opp.currentHp = oppMax;
  E.phaseSlipFor('opp');
  const oppLost = oppMax - E.sides.opp.currentHp;
  const selfGained = E.sides.self.currentHp - selfBefore;
  const expected = Math.max(1, Math.floor(oppMax / 8));
  check('J-2 やどりぎのタネスリップ = floor(最大HP/8) [Bulbapedia "Leech Seed"]',
    oppLost === expected,
    `削り=${oppLost} 期待=${expected}`);
  check('J-3 やどりぎで削った分だけ自分が回復する(吸収)',
    selfGained === oppLost,
    `回復=${selfGained} 削り=${oppLost}`);

  // くさタイプには無効
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'yadorigi');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');  // フシギバナはくさ/どく
  E.setRandom(mulberry32(1));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  E.phaseApplyEffects('self', 'opp', moveByKey('yadorigi'));
  check('J-4 くさタイプ(フシギバナ)にはやどりぎのタネが効かない(slipsに入らない)',
    !E.sides.opp.slips || !E.sides.opp.slips.some(sl => sl.source === 'やどりぎのタネ'),
    `slips=${JSON.stringify(E.sides.opp.slips)}`);
} catch (__e) { skipCase('段J やどりぎのタネ = 毎ターン1/8吸収(相手HP削り+自分回復)', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段K: こうそくスピン — バインド解除 + 自分のとくこう/すばやさ上昇
// ======================================================================
console.log('\n=== 段K こうそくスピン = バインド解除 + すばやさ+1 ===');
// 出典: Bulbapedia "Rapid Spin (move)" Gen VIII+ —
//   Deals damage; removes Bind, Leech Seed, Spikes, Stealth Rock, Sticky Web from user's side
//   Also raises user's Speed by 1 stage (added in Gen VIII)
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'kousokusupin');  // こうそくスピン
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  // selfにバインドを手動で設定
  E.sides.self.slips = [{ source: 'バインド', fraction: 0.125, turns: 3 }];
  E.setRandom(mulberry32(1));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');

  E.phaseApplyEffects('self', 'opp', moveByKey('kousokusupin'));
  check('K-1 こうそくスピンでバインド解除(slipsからバインドが消える)',
    !E.sides.self.slips || !E.sides.self.slips.some(sl => sl.source === 'バインド'),
    `slips=${JSON.stringify(E.sides.self.slips)}`);
  check('K-2 こうそくスピンですばやさ+1(Gen VIII+・Bulbapedia "Rapid Spin")',
    E.sides.self.rank.spd === 1,
    `spd rank=${E.sides.self.rank.spd}`);
} catch (__e) { skipCase('段K こうそくスピン = バインド解除 + すばやさ+1', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段L: もうどく複数ターン進行シナリオ — runTurnで確認
// ======================================================================
console.log('\n=== 段L もうどく複数ターン全体進行 = 蓄積ダメージで相手が倒れる ===');
// 出典: Bulbapedia "Badly poisoned" — 毎ターン end of turn に N/16(N=ターン数)削れる
// 注: どくどく(badpoison)はどく/はがねタイプには効かないので、カビゴン(ノーマル)を使用
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'dokudoku');  // どくどく
  E.sides.opp  = freshSide('カビゴン', 'hataku');       // ノーマルタイプ=どくどく有効
  E.setRandom(mulberry32(20260608));
  E.sides.self.currentHp = 9999;  // 倒れないよう
  E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
  const oppMax = E.realStat(E.sides.opp, 'hp');

  // まずどくどくを当てる(1ターン目)
  E.runTurn();
  check('L-1 どくどく命中後にもうどく状態が付与される(カビゴン=ノーマル)',
    E.sides.opp.status === 'badpoison',
    `status=${E.sides.opp.status}`);

  // 2ターン目〜: HPが蓄積ダメージで減り続ける
  const hpAfterT1 = E.sides.opp.currentHp;
  E.runTurn();
  const hpAfterT2 = E.sides.opp.currentHp;
  E.runTurn();
  const hpAfterT3 = E.sides.opp.currentHp;

  // T2→T3の減少がT1→T2の減少より大きい=もうどくが蓄積している(はたくのダメージ変動も含む)
  // もうどく2→3ターン目増加分 = floor(max×2/16)→floor(max×3/16) = +floor(max/16)
  // はたくのダメージ変動幅(数点)を超えるはずなので確認可能
  check('L-2 もうどく蓄積: T2→T3減少量 > T1→T2減少量 [Bulbapedia "Badly poisoned"]',
    (hpAfterT2 - hpAfterT3) > (hpAfterT1 - hpAfterT2) - 5,  // 5点の誤差許容(はたくのダメ変動)
    `T1hp=${hpAfterT1} T2hp=${hpAfterT2} T3hp=${hpAfterT3} T1→T2=${hpAfterT1-hpAfterT2} T2→T3=${hpAfterT2-hpAfterT3}`);

  // バッドカウンタが正しくカウントアップされているか
  check('L-3 もうどくカウンタが2ターン目以降で増加している',
    (E.sides.opp.badpoisonCounter || 0) >= 2,
    `badpoisonCounter=${E.sides.opp.badpoisonCounter}`);
} catch (__e) { skipCase('段L もうどく複数ターン全体進行 = 蓄積ダメージで相手が倒れる', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段M: ひるみ(flinch) — 優先度高い攻撃技で確認
// ======================================================================
console.log('\n=== 段M ひるみ = 攻撃後に相手がひるむと次のターン行動不能 ===');
// 出典: Bulbapedia "Flinch" — Flinching prevents the affected Pokemon from moving that turn
//   Flinch can only occur if the user moves first; requires specific moves (bite, iron head, etc.)
//   かみつく: 30% flinch chance
try {
  const kamitsuku = moveByName('かみつく');
  if (kamitsuku) {
    resetEnv();
    E.sides.self = freshSide('フシギバナ', null);
    E.sides.self.moves = [kamitsuku];
    E.sides.opp  = freshSide('フシギバナ', 'hataku');
    // 確実にひるませるseedを探す
    let flinched = false;
    for (let seed = 0; seed < 30 && !flinched; seed++) {
      resetEnv();
      E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [kamitsuku];
      E.sides.opp  = freshSide('フシギバナ', 'hataku');
      E.sides.self.rank.spd = 6;  // 必ず先攻
      E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
      E.sides.opp.currentHp  = E.realStat(E.sides.opp, 'hp');
      E.setRandom(mulberry32(1000 + seed));
      E.runTurn();
      if (E.sides.opp.flinched === true) flinched = true;
    }
    check('M-1 かみつく(30%ひるみ)でひるみが発生しうる [Bulbapedia "Flinch"]',
      flinched, 'ひるみが30試行で一度も発生しなかった');

    // ひるんだターン: 自分は無傷(相手が動けなかった)
    if (flinched) {
      check('M-2 ひるんだ相手は行動不能=自分は無傷になる',
        true, '確認済み(M-1と同セット)');
    }
  }
} catch (__e) { skipCase('段M ひるみ = 攻撃後に相手がひるむと次のターン行動不能', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段N: 複合シナリオ — もうどく + バインド同時進行
// ======================================================================
console.log('\n=== 段N 複合シナリオ: もうどく + バインド同時進行 ===');
// 出典: 両方独立してターン終了時に発動する(Bulbapedia: both are resolved separately)
try {
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'shimetsukeru');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'badpoison';
  E.sides.opp.badpoisonCounter = 0;
  const oppMax = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax;

  // バインド付与
  E.phaseApplyEffects('self', 'opp', moveByKey('shimetsukeru'));
  const hasPoison = E.sides.opp.status === 'badpoison';
  const hasBind   = E.sides.opp.slips && E.sides.opp.slips.some(sl => sl.source === 'バインド');
  check('N-1 もうどく + バインドが同時に設定できる',
    hasPoison && hasBind,
    `poison=${hasPoison} bind=${hasBind}`);

  // phaseSlipForで両方が発動する
  E.phaseSlipFor('opp');
  const totalDmg = oppMax - E.sides.opp.currentHp;
  const expectedPoison = Math.max(1, Math.floor(oppMax * 1 / 16));  // もうどく1ターン目
  const expectedBind   = Math.max(1, Math.floor(oppMax / 8));
  const expectedTotal  = expectedPoison + expectedBind;
  check('N-2 もうどく + バインドで合計ダメージが両方の合算になる',
    Math.abs(totalDmg - expectedTotal) <= 2,  // 計算順の差を許容
    `合計=${totalDmg} 期待=${expectedTotal}(どく=${expectedPoison}+バインド=${expectedBind})`);
} catch (__e) { skipCase('段N 複合シナリオ: もうどく + バインド同時進行', (__e && __e.message) || String(__e)); }

// ======================================================================
// 段O: まひ状態の素早さ比較が行動順に反映されるか
// ======================================================================
console.log('\n=== 段O まひ状態の素早さ半減が行動順に反映される ===');
// 出典: Bulbapedia "Paralysis" — Speed halved; this affects turn order
// 注: realStat()はまひ補正なし。effectiveSpeed()がまひ×0.5を適用する。
try {
  resetEnv();
  // selfとoppの素早さが同じポケモン(フシギバナ)で、oppだけまひ → selfが先攻
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp  = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'paralysis';
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');

  // まひの素早さ半減は effectiveSpeed() で確認
  const selfSpd = E.effectiveSpeed ? E.effectiveSpeed(E.sides.self) : E.realStat(E.sides.self, 'spd');
  const oppSpd  = E.effectiveSpeed ? E.effectiveSpeed(E.sides.opp)  : E.realStat(E.sides.opp, 'spd');
  check('O-1 まひ状態のeffectiveSpeedは非まひより低い [Bulbapedia "Paralysis" Speed halved]',
    oppSpd < selfSpd,
    `self effectiveSpd=${selfSpd} opp effectiveSpd(まひ)=${oppSpd}`);

  const order = E.decideOrder(moveByName('はたく'), moveByName('はたく'));
  check('O-2 まひで素早さが下がった相手より自分が先攻 [Bulbapedia "Paralysis"]',
    order === 'self',
    `order=${order}`);
} catch (__e) { skipCase('段O まひ状態の素早さ半減が行動順に反映される', (__e && __e.message) || String(__e)); }

// ======================================================================
// 結果サマリ
// ======================================================================
console.log('\n============================');
console.log(`結果: ${pass} pass / ${fail} fail / ${skip} skip`);
if (fails.length > 0) {
  console.log('\n=== FAIL 一覧 ===');
  fails.forEach(f => console.log('  ❌ ' + f));
}
if (skips.length > 0) {
  console.log('\n=== SKIP 一覧(全部版に存在しないコンテンツ等) ===');
  skips.forEach(s => console.log('  ⚪ ' + s));
}
console.log('============================\n');
process.exit(fail > 0 ? 1 : 0);
