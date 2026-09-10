/*
 * tools/_slots_test.js — D3-1c: 状態モデルの枠化(battle.format / sides[sideId].slots[])のnode:testテスト
 * 実行: node tools/_slots_test.js
 *
 * 上位文書: 実装指示 D3-1(2026-09-10深夜)「テスト」節1〜5をそのまま実装する。
 * 期待値はテストコード側で明示的に判定する(自己出力をゴールデンにしない)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('./_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
const moveByName = n => Object.values(data.WAZA_MAP).find(m => m.name === n);

// _sim_test.js等と同じ既存流儀: makeSideState()に直接ポケモン/技を詰める(単体技=ダブル範囲補正の対象外)
function freshSide(E, pokeName, moveKey) {
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  s.moves = moveKey ? [data.WAZA_MAP[moveKey]] : [];
  s.selectedMoveIdx = moveKey ? 0 : null;
  s.currentHp = E.realStat(s, 'hp');
  return s;
}

// ===== 1: 既定formatはsingle/1枠/pick3。slotOf('self',0) === sides.self(同一参照) =====
test('既定format = single/slotsPerSide1/pickCount3。slotOf(\'self\',0)はsides.selfと同一オブジェクト', () => {
  const E = buildEngine();
  assert.equal(E.battle.format.slotsPerSide, 1, '既定slotsPerSide=1');
  assert.equal(E.battle.format.pickCount, 3, '既定pickCount=3');
  assert.equal(E.battle.format.name, 'single', '既定name=single');
  assert.equal(E.slotOf('self', 0), E.sides.self, 'slotOf(self,0)はsides.selfと同一参照');
  assert.equal(E.slotOf('opp', 0), E.sides.opp, 'slotOf(opp,0)はsides.oppと同一参照');
  // ★E.activeSides()はvm(別レルム)で作られた配列なので、assert/strictのdeepEqual(=deepStrictEqual)は
  // プロトタイプ不一致でfailする(_snapshot_equiv_test.jsと同じ既知の罠)。内容比較はJSON.stringifyで行う。
  assert.equal(JSON.stringify(E.activeSides()), JSON.stringify(['self', 'opp']), 'activeSides()は既定でself/opp');
});

// ===== 2: setFormat({slotsPerSide:2}) → resetBattle 後、sides.self.slots.length===2、slots[1].poke===null =====
test('setFormat({slotsPerSide:2}) → resetBattle() で2枠目(空席)が生える', () => {
  const E = buildEngine();
  E.sides.self = freshSide(E, 'フシギバナ', 'hataku');
  E.sides.opp = freshSide(E, 'フシギバナ', 'hataku');

  E.setFormat({ slotsPerSide: 2 });
  assert.equal(E.battle.format.slotsPerSide, 2, 'setFormatでslotsPerSide=2');
  assert.equal(E.battle.format.name, 'double', 'setFormatでname=double(明示name省略時の既定導出)');

  E.resetBattle();
  assert.equal(E.sides.self.slots.length, 2, 'resetBattle後にself.slots.length===2');
  assert.equal(E.sides.opp.slots.length, 2, 'resetBattle後にopp.slots.length===2');
  assert.equal(E.sides.self.slots[0], E.sides.self, 'slots[0]は引き続きsides.self自身');
  assert.equal(E.sides.self.slots[1].poke, null, '2枠目(fixture)は空席=poke null');
  assert.equal(E.sides.opp.slots[1].poke, null, '2枠目(fixture)は空席=poke null(opp側)');

  // シングルに戻すと1枠に戻る(setDoubleBattleFlag/setFormatどちらの経路でも縮む)
  E.setFormat({ slotsPerSide: 1 });
  E.resetBattle();
  assert.equal(E.sides.self.slots.length, 1, 'シングルに戻すとslots.length===1');
});

// ===== 3: fixtureで2枠目にpokeを置いてrunTurn()を1回回しても例外0・ログはシングルと同じ =====
test('2枠目にpokeを置いてもrunTurn()は例外を出さず、ログはシングルと同じ行になる(2枠目は無視)', () => {
  const move = data.WAZA_MAP.hataku;
  assert.ok(move && move.target !== '相手全体' && move.target !== '自分以外全体' && move.target !== '全体',
    '前提: はたくは範囲技ではない(ダブル×0.75補正の対象外=単純比較できる技を選んでいる)');

  // --- シングル(基準) ---
  const E1 = buildEngine();
  E1.setRandom(mulberry32(12345));
  E1.sides.self = freshSide(E1, 'フシギバナ', 'hataku');
  E1.sides.opp = freshSide(E1, 'フシギバナ', 'hataku');
  E1.runTurn();
  const singleLog = E1.battleLog.map(l => l.msg);
  assert.ok(singleLog.length > 0, 'シングルのログが空でない(前提)');

  // --- ダブルfixture(2枠目に別ポケモンを置く。1枠目の対戦はシングルと全く同じ組み方) ---
  const E2 = buildEngine();
  E2.setRandom(mulberry32(12345));
  E2.setFormat({ slotsPerSide: 2 });
  E2.sides.self = freshSide(E2, 'フシギバナ', 'hataku');
  E2.sides.opp = freshSide(E2, 'フシギバナ', 'hataku');
  E2.resetBattle();   // slots[1]を生やす(D3-1bのfixture経路)
  // 2枠目に「居るだけ」のポケモンを置く(D3-1では対象選択もループも枠を回さない=止め地点)
  E2.slotOf('self', 1).poke = pokeByName('ピカチュウ');
  E2.slotOf('self', 1).currentHp = E2.realStat(E2.slotOf('self', 1), 'hp');
  E2.slotOf('opp', 1).poke = pokeByName('ピカチュウ');
  E2.slotOf('opp', 1).currentHp = E2.realStat(E2.slotOf('opp', 1), 'hp');

  // resetBattle()自身が「バトルリセット」ログ行を積むので、比較対象はrunTurn()が新たに積む分だけに絞る
  // (E1側はresetBattleを呼んでいない=土台を揃えるための比較テクニックであって挙動の話ではない)。
  const logLenBeforeTurn = E2.battleLog.length;
  assert.doesNotThrow(() => { E2.runTurn(); }, 'ダブルfixture(2枠目在り)でもrunTurn()が例外を出さない');
  const doubleLog = E2.battleLog.slice(logLenBeforeTurn).map(l => l.msg);
  // ★battleLogはvm(別レルム)の配列(E1/E2はそれぞれ別のvmコンテキスト)なのでassert.deepEqual(=strict)は
  // プロトタイプ不一致でfailする(_snapshot_equiv_test.jsと同じ既知の罠)。内容比較はJSON.stringifyで行う。
  assert.equal(JSON.stringify(doubleLog), JSON.stringify(singleLog),
    '2枠目にポケモンが居てもrunTurn()自身が積むログはシングルと同じ行になる(2枠目はD3-1では無視=止め地点)');
});

// ===== 4: undo(pushHistory→変更→undoBattle)の後もslots[0]===sides.self =====
test('undo(pushHistory→変更→undoBattle)の後もslotOf(\'self\',0)===sides.self(同一オブジェクト)のまま', () => {
  const E = buildEngine();
  E.sides.self = freshSide(E, 'フシギバナ', 'hataku');
  E.sides.opp = freshSide(E, 'フシギバナ', 'hataku');
  const hooks = E.sides.__undoTestHooks;
  const selfRef = E.sides.self;

  hooks.pushHistory();
  E.sides.self.currentHp = 1;   // 何か変更する
  hooks.undoBattle();

  assert.equal(E.sides.self, selfRef, 'undoBattleはsides.selfのオブジェクト参照そのものを差し替えない(前提)');
  assert.equal(E.slotOf('self', 0), E.sides.self, 'undo後もslotOf(self,0)===sides.self');
  assert.equal(E.slotOf('self', 0), selfRef, 'undo後もslotOf(self,0)は変更前と同一オブジェクト');
});

// ===== 5: env.doubleBattleへの書き込みはbattle.format.slotsPerSideに反映される(互換setter) =====
test('env.doubleBattle = true/false は battle.format.slotsPerSide=2/1 に反映される(互換setter)', () => {
  const E = buildEngine();
  assert.equal(E.battle.format.slotsPerSide, 1, '前提: 既定は1');

  E.env.doubleBattle = true;
  assert.equal(E.battle.format.slotsPerSide, 2, 'env.doubleBattle=trueでslotsPerSide===2');
  assert.equal(E.env.doubleBattle, true, '読み出しもtrueに追随(派生値)');

  E.env.doubleBattle = false;
  assert.equal(E.battle.format.slotsPerSide, 1, 'env.doubleBattle=falseでslotsPerSide===1');
  assert.equal(E.env.doubleBattle, false, '読み出しもfalseに追随(派生値)');
});
