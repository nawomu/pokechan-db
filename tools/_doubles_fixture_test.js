/*
 * tools/_doubles_fixture_test.js — D3-2c: ダブルfixture(4体Intent+target_lock)のnode:testテスト
 * 実行: node tools/_doubles_fixture_test.js
 *
 * 上位文書: 実装指示 D3-2(2026-09-11)「D3-2c」節1〜7をそのまま実装する。
 * 根拠は設計書 §4.2/§4.5(Wiki由来)。自己出力を期待値にしない=期待値はテストコード側で明示的に判定する。
 * ★シングルの絶対条件はこのファイルの対象外(それは_slots_test.js等の既存ゲートが守る)。
 *   ここはE.setFormat({slotsPerSide:2})のfixtureだけを対象にする(D3-2の絶対条件どおり)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('./_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// カウント付きrng: mulberry32(seed)を包んで呼び出し回数を数える(D1のtiePolicy=randomの1回性等を
// 実機の全パイプライン込みで検証するのに使う=battle_scheduler.js自体の単体テストではなくrunTurn経由)。
function countingRandom(seed) {
  const base = mulberry32(seed);
  let count = 0;
  const fn = () => { count++; return base(); };
  fn.count = () => count;
  fn.reset = () => { count = 0; };
  return fn;
}

// 枠1つに任意のポケモン/技/HPを置く(D3-1のfixture流儀=slotOf(side,idx)へ直接書く)。
function placeSlot(E, side, idx, pokeName, moveKey, opts) {
  const st = E.slotOf(side, idx);
  opts = opts || {};
  st.poke = pokeName ? pokeByName(pokeName) : null;
  st.moves = moveKey ? [data.WAZA_MAP[moveKey]] : [];
  st.selectedMoveIdx = moveKey ? 0 : null;
  st.currentHp = st.poke ? (opts.hp != null ? opts.hp : E.realStat(st, 'hp')) : null;
  st.fainted = !!opts.fainted;
  if (opts.fainted) st.currentHp = 0;
  st.targetChoice = opts.targetChoice || null;
  return st;
}

// 2枠×2側のfixtureを作る(全スロットいったん空席から)。個別のplaceSlot呼び出しで埋める。
function build2v2() {
  const E = buildEngine();
  E.setFormat({ slotsPerSide: 2 });
  // resetBattle()がslots[1]を生やすには「側」に何か居る必要があるので、まず仮の個体を置いてから
  // resetBattle()を呼び、その後で4枠すべてplaceSlot()で確定させる(_slots_test.jsと同じ流儀)。
  E.sides.self.poke = pokeByName('フシギバナ');
  E.sides.self.moves = [];
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.poke = pokeByName('フシギバナ');
  E.sides.opp.moves = [];
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.resetBattle();
  return E;
}

// ★E.battleLogはvm(別レルム)の配列(_slots_test.js/_snapshot_equiv_test.js既知の罠と同じ)。
// .map()等をvm配列に直接連鎖するとプロトタイプがvm由来のままになり、後続のassert.deepEqualが
// プロトタイプ不一致でfailする。for文で1件ずつ読み、この場(Node本体のレルム)のArray/Objectに
// 詰め直すことで回避する(msgは文字列プリミティブなのでレルムを持ち越さない)。
function hitLines(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const mm = /^(.+?) の (.+?)！ (.+?) に (\d+) ダメージ！/.exec(String(log[i].msg));
    if (mm) out.push({ attacker: mm[1], move: mm[2], defender: mm[3], dmg: Number(mm[4]) });
  }
  return out;
}
function msgList(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}

// ===== 1: 2枠×2側・4体が優先度→素早さの順に1ターンで全員行動する(ログの行動行が4本・順序が期待どおり) =====
test('D3-2c-1: 4体(優先度同値・速度4通り)が素早さ降順で1ターンに全員行動する', () => {
  const E = build2v2();
  // ケンタロス110 > リザードン100 > フシギバナ80 > カメックス78(全員 はたく=優先度0・1体選択・正面)
  placeSlot(E, 'self', 0, 'ケンタロス', 'hataku');
  placeSlot(E, 'self', 1, 'フシギバナ', 'hataku');
  placeSlot(E, 'opp', 0, 'リザードン', 'hataku');
  placeSlot(E, 'opp', 1, 'カメックス', 'hataku');
  E.setRandom(mulberry32(1));
  assert.doesNotThrow(() => { E.runTurn(); }, 'runTurn()が例外を出さない');
  const hits = hitLines(E.battleLog);
  assert.equal(hits.length, 4, '4本のダメージ行が出る(4体全員が行動した証拠)');
  const order = hits.map(h => h.attacker);
  // pname()は「相手側の枠0だけ」に「相手の 」を前置する(opp:1にはまだ付かない=D5前のUI表示ギャップ・
  // D3-2の対象外)。opp:0(リザードン)はここに該当するので前置きされる。
  assert.equal(JSON.stringify(order), JSON.stringify(['ケンタロス', '相手の リザードン', 'フシギバナ', 'カメックス']),
    `速度降順(110>100>80>78)で行動する。実際の順=${JSON.stringify(order)}`);
  // 正面(同slotId)が既定対象: ケンタロス(self:0)→リザードン(opp:0)/フシギバナ(self:1)→カメックス(opp:1)
  assert.equal(hits[0].defender, '相手の リザードン', 'self:0(ケンタロス)の既定対象はopp:0(リザードン)=正面');
  assert.equal(hits[2].defender, 'カメックス', 'self:1(フシギバナ)の既定対象はopp:1(カメックス)=正面');
});

// ===== 2: 同速集団3体以上で乱数消費が1回(setRandom呼び出し回数を数える) =====
test('D3-2c-2: 同速3体の集団がいる時といない時でrng消費がちょうど1回分だけ違う(=tie解決1回分)', () => {
  // ★つるぎのまい自体もbattle_data.effects[].prob(既定100)チェックのため使用者ごとにMath.random()を
  // 1回消費する(既存エンジンの仕様=D3-2で変えない・変えてはいけない)。「同速3体のtie解決1回」だけを
  // 取り出すため、同じ技構成のまま「速度がタイする配置」と「4体とも速度が異なる配置」を比較する差分法で
  // 検証する(test 5のランダム1体と同じ手法)。
  function countRng(seed, speedNames) {
    const E = build2v2();
    placeSlot(E, 'self', 0, speedNames[0], 'tsuruginomai');
    placeSlot(E, 'self', 1, speedNames[1], 'tsuruginomai');
    placeSlot(E, 'opp', 0, speedNames[2], 'tsuruginomai');
    placeSlot(E, 'opp', 1, speedNames[3], 'tsuruginomai');
    const rng = countingRandom(seed);
    E.setRandom(rng);
    rng.reset();
    E.runTurn();
    return rng.count();
  }
  // タイ配置: self:0/self:1/opp:0=フシギバナ(同速80)で3体タイ集団・opp:1=ケンタロス(110・単独)
  const tied = countRng(7, ['フシギバナ', 'フシギバナ', 'フシギバナ', 'ケンタロス']);
  // 非タイ配置: 4体とも速度が異なる(同じ4種の技消費内訳=つるぎのまい×4はそのまま)
  const untied = countRng(7, ['フシギバナ', 'カメックス', 'リザードン', 'ケンタロス']);
  assert.equal(tied - untied, 1,
    `同速3体のtie解決だけがrngを1回多く消費するはず(タイ配置=${tied} / 非タイ配置=${untied})`);
});

// ===== 3: 1体選択: targetChoiceで相手の右枠を指定→その枠が受ける。指定なし→正面 =====
test('D3-2c-3a: targetChoiceで相手の枠1(右)を指定するとその枠が受ける', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'hataku', { targetChoice: { side: 'opp', idx: 1 } });
  placeSlot(E, 'self', 1, null, null);
  placeSlot(E, 'opp', 0, 'カメックス', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  const oppMax = E.realStat(E.slotOf('opp', 0), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.ok(E.slotOf('opp', 1).currentHp < oppMax, 'targetChoiceで指定したopp:1がダメージを受ける');
  assert.equal(E.slotOf('opp', 0).currentHp, oppMax, '指定していないopp:0は無傷のまま');
});

test('D3-2c-3b: targetChoice省略時は正面(同slotId)が既定対象になる', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'hataku');   // targetChoiceなし=既定
  placeSlot(E, 'self', 1, null, null);
  placeSlot(E, 'opp', 0, 'カメックス', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  const oppMax = E.realStat(E.slotOf('opp', 0), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.ok(E.slotOf('opp', 0).currentHp < oppMax, '既定(正面)のopp:0がダメージを受ける');
  assert.equal(E.slotOf('opp', 1).currentHp, oppMax, '正面でないopp:1は無傷のまま');
});

// ===== 4: 対象消失(相手なら選び直し・味方なら失敗・両方消失なら不発) =====
test('D3-2c-4a: 相手の正面が既に倒れていたら残った相手枠へ選び直して当たる(失敗しない)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'hataku');   // targetChoiceなし=正面(opp:0)既定
  placeSlot(E, 'self', 1, null, null);
  placeSlot(E, 'opp', 0, 'カメックス', null, { fainted: true });   // 正面が先に倒れている
  placeSlot(E, 'opp', 1, 'カメックス', null);
  const oppMax = E.realStat(E.slotOf('opp', 1), 'hp');
  E.setRandom(mulberry32(5));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  assert.ok(!msgs.some(m => m.includes('あいてが いなかった')), '選び直しが起きるので不発文言は出ない');
  assert.ok(E.slotOf('opp', 1).currentHp < oppMax, '残っていたopp:1に選び直して命中する');
});

test('D3-2c-4b: 味方1体を選んでいて、その味方が倒れていたら失敗ログが出る', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'tedasuke', { targetChoice: { side: 'self', idx: 1 } });
  placeSlot(E, 'self', 1, 'フシギバナ', null, { fainted: true });   // 選んだ味方が既に倒れている
  placeSlot(E, 'opp', 0, 'カメックス', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  E.setRandom(mulberry32(9));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  assert.ok(msgs.some(m => m.includes('てだすけ！ しかし うまく きまらなかった！')),
    `味方が居ない味方1体技は既存の汎用失敗文言で失敗する(実際のログ=${JSON.stringify(msgs)})`);
});

test('D3-2c-4c: 相手2枠とも倒れていたら不発(「あいてが いなかった」)になる', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'hataku');
  placeSlot(E, 'self', 1, null, null);
  placeSlot(E, 'opp', 0, 'カメックス', null, { fainted: true });
  placeSlot(E, 'opp', 1, 'カメックス', null, { fainted: true });
  E.setRandom(mulberry32(11));
  assert.doesNotThrow(() => { E.runTurn(); }, '相手全滅でも例外を出さない');
  const msgs = msgList(E.battleLog);
  assert.ok(msgs.some(m => m.includes('あいてが いなかった')), '相手が2枠とも居ない=既存の不発文言が出る');
});

// ===== 5: ランダム1体は相手2枠生存で乱数1回・シングルでは0回(候補数に応じた差分で検証) =====
test('D3-2c-5: ランダム1体は「相手2枠生存」と「相手1枠のみ」でrng消費がちょうど1回分だけ違う', () => {
  function countRngFor(oppCount) {
    const E = build2v2();
    placeSlot(E, 'self', 0, 'ウインディ', 'daifungeki');   // だいふんげき=target:ランダム1体
    placeSlot(E, 'self', 1, null, null);
    placeSlot(E, 'opp', 0, 'カメックス', null);
    placeSlot(E, 'opp', 1, 'カメックス', null, { fainted: oppCount < 2 });
    const rng = countingRandom(21);
    E.setRandom(rng);
    rng.reset();
    E.runTurn();
    return rng.count();
  }
  const withTwo = countRngFor(2);
  const withOne = countRngFor(1);
  assert.equal(withTwo - withOne, 1,
    `相手2枠生存時だけ対象抽選の1回分が上乗せされるはず(2枠=${withTwo} / 1枠=${withOne})`);
});

test('D3-2c-5b: シングルではランダム1体でも対象抽選は起きない(候補が1体しかいないため2枠fixtureの1枠と同じ消費)', () => {
  const E1 = build2v2();
  placeSlot(E1, 'self', 0, 'ウインディ', 'daifungeki');
  placeSlot(E1, 'self', 1, null, null);
  placeSlot(E1, 'opp', 0, 'カメックス', null);
  placeSlot(E1, 'opp', 1, 'カメックス', null, { fainted: true });   // 相手1枠のみ生存(fixture比較基準)
  const rng1 = countingRandom(21);
  E1.setRandom(rng1);
  rng1.reset();
  E1.runTurn();

  const E2 = buildEngine();   // 純粋シングル(setFormat無し=既定slotsPerSide1)
  E2.sides.self = (() => { const s = E2.makeSideState(); s.poke = pokeByName('ウインディ'); s.moves = [data.WAZA_MAP.daifungeki]; s.selectedMoveIdx = 0; s.currentHp = E2.realStat(s, 'hp'); return s; })();
  E2.sides.opp = (() => { const s = E2.makeSideState(); s.poke = pokeByName('カメックス'); s.moves = []; s.selectedMoveIdx = null; s.currentHp = E2.realStat(s, 'hp'); return s; })();
  const rng2 = countingRandom(21);
  E2.setRandom(rng2);
  rng2.reset();
  E2.runTurn();

  assert.equal(rng1.count(), rng2.count(),
    `相手候補が1体しかいない点で条件は同じ=rng消費も同じになるはず(fixture1枠=${rng1.count()} / シングル=${rng2.count()})`);
});

// ===== 6: 退場/ひんしした枠の未実行Intentは実行されない =====
test('D3-2c-6: 先に倒された枠の(未実行の)行動は来ない。他の枠は通常どおり行動する', () => {
  const E = build2v2();
  // ケンタロス(110)が最速でopp:1(ピカチュウ、瀕死1HP)を名指しで倒す。ピカチュウ(90)は
  // まだ行動していない=自分の番が来る前に倒れる。フシギバナ(80)→カメックス(78・技なし)は通常どおり。
  placeSlot(E, 'self', 0, 'ケンタロス', 'hataku', { targetChoice: { side: 'opp', idx: 1 } });
  placeSlot(E, 'self', 1, 'フシギバナ', 'hataku');   // 既定(正面)=opp:0
  placeSlot(E, 'opp', 0, 'カメックス', null);
  placeSlot(E, 'opp', 1, 'ピカチュウ', null, { hp: 1 });   // 瀕死寸前・技なし(生きていれば行動する枠)
  E.setRandom(mulberry32(13));
  assert.doesNotThrow(() => { E.runTurn(); }, '途中で1枠が倒れても例外を出さない');
  assert.ok(E.slotOf('opp', 1).fainted || E.slotOf('opp', 1).currentHp <= 0, '前提: ピカチュウは倒れている');
  const hits = hitLines(E.battleLog);
  assert.equal(hits.length, 2, '実際に行動できたのは2体(ケンタロス→ピカチュウ/フシギバナ→カメックス)だけ');
  const attackers = hits.map(h => h.attacker);
  assert.equal(JSON.stringify(attackers), JSON.stringify(['ケンタロス', 'フシギバナ']), 'ケンタロス→フシギバナの順で行動する(ピカチュウの分は無い)');
  const msgs = msgList(E.battleLog);
  assert.ok(!msgs.some(m => m.includes('ピカチュウ') && m.includes('選択していない')),
    'ピカチュウ自身の(未実行の)行動ログは出ない=Intentごと実行されなかった証拠');
});

// ===== 7: シングル(1枠)fixtureで同じテストを回して従来ログと一致(既存_sim_testの代表ケースを再現) =====
test('D3-2c-7: シングル(1枠)fixtureは既存の代表ケース(同速2体のはたく)と同じログ形になる', () => {
  const E = buildEngine();   // setFormat無し=既定でslotsPerSide1(シングル)
  E.setRandom(mulberry32(12345));   // _slots_test.js テスト3と同じseed=同じ既知の結果と突き合わせる
  E.sides.self = (() => { const s = E.makeSideState(); s.poke = pokeByName('フシギバナ'); s.moves = [data.WAZA_MAP.hataku]; s.selectedMoveIdx = 0; s.currentHp = E.realStat(s, 'hp'); return s; })();
  E.sides.opp = (() => { const s = E.makeSideState(); s.poke = pokeByName('フシギバナ'); s.moves = [data.WAZA_MAP.hataku]; s.selectedMoveIdx = 0; s.currentHp = E.realStat(s, 'hp'); return s; })();
  E.runTurn();
  const msgs = msgList(E.battleLog);
  // 既知の結果(_slots_test.js テスト3の「シングル(基準)」ブロックと同一の組み方・同一seed)と一致するはず。
  assert.deepEqual(msgs, [
    '─── ターン開始 ───',
    '先攻: 相手の フシギバナ',
    '相手の フシギバナ の はたく！ フシギバナ に 17 ダメージ！ (残HP 138/155)',
    'フシギバナ の はたく！ 相手の フシギバナ に 17 ダメージ！ (残HP 138/155)',
    '─── ターン終了 ───',
  ], `シングルfixtureのログが既知の結果と一致しない(実際=${JSON.stringify(msgs)})`);
});
