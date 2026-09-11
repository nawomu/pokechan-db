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
  if (opts.ability != null) st.ability = opts.ability;   // D3-3c: 引き寄せ系テストの特性上書き用
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
  // pname()は相手側の全枠に「相手の 」を前置する(D6-2 2026-09-11 で枠0だけ→全枠に修正。それ以前は opp:1 に付かないギャップだった)
  assert.equal(JSON.stringify(order), JSON.stringify(['ケンタロス', '相手の リザードン', 'フシギバナ', '相手の カメックス']),
    `速度降順(110>100>80>78)で行動する。実際の順=${JSON.stringify(order)}`);
  // 正面(同slotId)が既定対象: ケンタロス(self:0)→リザードン(opp:0)/フシギバナ(self:1)→カメックス(opp:1)
  assert.equal(hits[0].defender, '相手の リザードン', 'self:0(ケンタロス)の既定対象はopp:0(リザードン)=正面');
  assert.equal(hits[2].defender, '相手の カメックス', 'self:1(フシギバナ)の既定対象はopp:1(カメックス)=正面');
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

// ===== D3-3b: 味方対象の効果適用(てだすけ=味方威力上昇 / ミルクのみ=自分か味方) =====
// 根拠: master/moves.json battle_data.effects(既存データ)+ 設計書§4.2/§4.5(#91,#92)。
// てだすけはphaseApplyEffectsを直接呼ぶ(atkIdx=0固定でも良い=ef.target==='ally'の解決は
// sides[atkSide].slotsから「自分以外の生存枠」を探すだけ=defSide/defIdxに依存しない実装のため)。
test('D3-3b-A: てだすけで味方の次の攻撃威力が1.5倍になる(ダメージ比較)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'tedasuke');
  placeSlot(E, 'self', 1, 'カメックス', 'hataku');
  placeSlot(E, 'opp', 0, 'カビゴン', null);
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  const before = E.calcDamage('self', 'opp', data.WAZA_MAP.hataku, null, 1, 0);
  E.phaseApplyEffects('self', 'opp', data.WAZA_MAP.tedasuke, 0);
  assert.equal(E.slotOf('self', 1).helpingHandMult, 1.5, 'てだすけでhelpingHandMultが1.5になる');
  const after = E.calcDamage('self', 'opp', data.WAZA_MAP.hataku, null, 1, 0);
  assert.equal(after.min, Math.floor(before.min * 1.5), `min: 1.5倍(floor)になるはず(before=${before.min} after=${after.min})`);
  assert.equal(after.max, Math.floor(before.max * 1.5), `max: 1.5倍(floor)になるはず(before=${before.max} after=${after.max})`);
});

test('D3-3b-B: てだすけは既に行動を終えた味方には失敗する(#91)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'tedasuke');
  placeSlot(E, 'self', 1, 'カメックス', 'hataku');
  E.slotOf('self', 1).movedThisTurn = true;   // 味方は既に行動済み
  E.phaseApplyEffects('self', 'opp', data.WAZA_MAP.tedasuke, 0);
  assert.ok(!E.slotOf('self', 1).helpingHandMult, '行動済みの味方にはhelpingHandMultが付かない');
  const msgs = msgList(E.battleLog);
  assert.ok(msgs.some(m => m.includes('てだすけ！ しかし うまく きまらなかった！')),
    `失敗ログが出るはず(実際=${JSON.stringify(msgs)})`);
});

test('D3-3b-C: 自分か味方(ミルクのみ)で味方を選べる', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'mirukunomi', { targetChoice: { side: 'self', idx: 1 }, hp: 1 });
  placeSlot(E, 'self', 1, 'カメックス', null, { hp: 1 });
  placeSlot(E, 'opp', 0, 'カビゴン', null);
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.equal(E.slotOf('self', 0).currentHp, 1, '使用者自身(self:0)は回復しない(味方を選んだので)');
  assert.ok(E.slotOf('self', 1).currentHp > 1, `targetChoiceで選んだ味方(self:1)がミルクのみで回復する(実際=${E.slotOf('self', 1).currentHp})`);
});

// ===== D3-3c: 引き寄せHandler(このゆびとまれ/いかりのこな/ひらいしん)+ignore =====
// 根拠: 設計書§4.3(#28,#29,#30,#31,#33,#34)。すべて実際のダメージ/ランク変化の有無で判定する
// (自己出力を期待値にしない)。

test('D3-3c-1: このゆびとまれで相手の単体攻撃が宣言者に向く(#28)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'konoyubitomare');   // 優先度+2=先に宣言できる
  placeSlot(E, 'self', 1, 'カメックス', null);
  // opp:0はself:1を名指ししているが、このゆびとまれの宣言でself:0に引き寄せられるはず
  placeSlot(E, 'opp', 0, 'ゲンガー', 'hataku', { targetChoice: { side: 'self', idx: 1 } });
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  const self0Max = E.realStat(E.slotOf('self', 0), 'hp');
  const self1Max = E.realStat(E.slotOf('self', 1), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.ok(E.slotOf('self', 0).currentHp < self0Max, `宣言者(self:0)が引き寄せて被弾するはず(実際=${E.slotOf('self', 0).currentHp}/${self0Max})`);
  assert.equal(E.slotOf('self', 1).currentHp, self1Max, '名指しされていたself:1は無傷のまま(引き寄せられた)');
});

test('D3-3c-2: 味方(同じ側)の攻撃は引き寄せられない(#28=相手側の単体技だけ)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'konoyubitomare');
  placeSlot(E, 'self', 1, 'カメックス', 'hataku');   // 自分の味方=opp:0を普通に狙う(正面)
  placeSlot(E, 'opp', 0, 'カビゴン', null);
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  const self0Max = E.realStat(E.slotOf('self', 0), 'hp');
  const opp0Max = E.realStat(E.slotOf('opp', 0), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.equal(E.slotOf('self', 0).currentHp, self0Max, '宣言者(self:0)は味方の攻撃までは引き寄せない=無傷');
  assert.ok(E.slotOf('opp', 0).currentHp < opp0Max, `味方(self:1)の攻撃はopp:0へ普通に通るはず(実際=${E.slotOf('opp', 0).currentHp}/${opp0Max})`);
});

test('D3-3c-3: 範囲技(自分以外全体)は引き寄せられない(#28,#29「単体技だけ」)', () => {
  // D4-1a(2026-09-11)で自分以外全体は正面1体スタブでなく本物のTargetSet(相手2+味方1)になった。
  // このゆびとまれの宣言(self:0)は単体技だけを引く=範囲技には無関係=self:0だけに集中せず
  // 通常のTargetSet(self側=攻撃者から見た相手側=self:0とself:1の両方)に当たることで実証する。
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'konoyubitomare');
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, null, null, { fainted: true });
  placeSlot(E, 'opp', 1, 'ドサイドン', 'jishin');   // じしん=自分以外全体=self:0とself:1の両方(D4-1a)
  const self0Max = E.realStat(E.slotOf('self', 0), 'hp');
  const self1Max = E.realStat(E.slotOf('self', 1), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.ok(E.slotOf('self', 0).currentHp < self0Max,
    `範囲技は宣言者(self:0)にも通常どおり当たる=引き寄せで免除されない(実際=${E.slotOf('self', 0).currentHp}/${self0Max})`);
  assert.ok(E.slotOf('self', 1).currentHp < self1Max, `self:1もそのまま受ける(実際=${E.slotOf('self', 1).currentHp}/${self1Max})`);
});

test('D3-3c-4: いかりのこなはくさタイプが撃つと免疫で無視される(#34)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'ikarinokona');   // 宣言(粉技)
  placeSlot(E, 'self', 1, 'カメックス', null);
  // opp:0(フシギバナ=くさタイプ)がself:1を名指し→いかりのこな免疫でそのままself:1に当たるはず
  placeSlot(E, 'opp', 0, 'フシギバナ', 'hataku', { targetChoice: { side: 'self', idx: 1 } });
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  const self0Max = E.realStat(E.slotOf('self', 0), 'hp');
  const self1Max = E.realStat(E.slotOf('self', 1), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.equal(E.slotOf('self', 0).currentHp, self0Max, 'くさタイプの免疫でself:0(宣言者)は引き寄せない=無傷');
  assert.ok(E.slotOf('self', 1).currentHp < self1Max, `名指しどおりself:1が被弾するはず(実際=${E.slotOf('self', 1).currentHp}/${self1Max})`);
});

test('D3-3c-5: ひらいしん2体はランク補正・トリックルームを除いた素のすばやさが高い方に引き寄せる(#29,#32)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', '10manboruto');   // でんき単体技・targetChoiceなし=正面(opp:0)既定
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カビゴン', null, { ability: 'ひらいしん' });   // 素早さ30(遅い)
  placeSlot(E, 'opp', 1, 'ゲンガー', null, { ability: 'ひらいしん' });   // 素早さ110(速い)
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.equal(E.slotOf('opp', 0).rank.spatk || 0, 0, '素早さが遅い方(カビゴン)は引き寄せない=とくこう変化なし');
  assert.equal(E.slotOf('opp', 1).rank.spatk || 0, 1, `素早さが速い方(ゲンガー)に引き寄せてとくこう+1になるはず(実際=${E.slotOf('opp', 1).rank.spatk})`);
});

test('D3-3c-6: すじがねいり持ちが撃つと引き寄せを無視する(#33)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', '10manboruto', { ability: 'すじがねいり' });
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カビゴン', null);   // ひらいしん無し=正面のまま被弾するはず
  placeSlot(E, 'opp', 1, 'ゲンガー', null, { ability: 'ひらいしん' });   // 引き寄せ資格はあるが無視されるはず
  const opp0Max = E.realStat(E.slotOf('opp', 0), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.ok(E.slotOf('opp', 0).currentHp < opp0Max, `すじがねいりで引き寄せ無視=正面(opp:0)が被弾するはず(実際=${E.slotOf('opp', 0).currentHp}/${opp0Max})`);
  assert.equal(E.slotOf('opp', 1).rank.spatk || 0, 0, 'opp:1(ひらいしん)は引き寄せられない=とくこう変化なし');
});

test('D3-3c-7: ねらいうち相当(effects宣言ignores_redirect:true)は引き寄せを無視する(#33)', () => {
  const E = build2v2();
  const orig = data.WAZA_MAP['10manboruto'];
  // ★ねらいうちはChampions非搭載(設計書§1.2)=named moveのfixtureが無いため、エンジンが読む
  // 汎用フラグ(ignores_redirect:true)を直接検証する(データが増えたらこの合成を実move参照に差し替える)。
  const snipeShotLike = Object.assign({}, orig, {
    battle_data: Object.assign({}, orig.battle_data, {
      effects: (orig.battle_data.effects || []).concat([{ ignores_redirect: true }]),
    }),
  });
  placeSlot(E, 'self', 0, 'フシギバナ', null);
  E.slotOf('self', 0).moves = [snipeShotLike];
  E.slotOf('self', 0).selectedMoveIdx = 0;
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カビゴン', null);
  placeSlot(E, 'opp', 1, 'ゲンガー', null, { ability: 'ひらいしん' });
  const opp0Max = E.realStat(E.slotOf('opp', 0), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.ok(E.slotOf('opp', 0).currentHp < opp0Max, `ignores_redirectで引き寄せ無視=正面(opp:0)が被弾するはず(実際=${E.slotOf('opp', 0).currentHp}/${opp0Max})`);
  assert.equal(E.slotOf('opp', 1).rank.spatk || 0, 0, 'opp:1(ひらいしん)は引き寄せられない=とくこう変化なし');
});

// ===== D4-1a: 対象集合(TargetSet)と範囲技の対象ループ(2026-09-11・設計_ダブルバトル_2026-09-07.md§4.2/§4.5) =====
// マジカルシャイン(相手全体・特殊80・命中100・追加効果なし)を使う=結果の分岐要因をダメージ計算以外に持たせない。
test('D4-1a-1: 相手全体の技が2枠に当たる(HPが両方減る)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'majikarushain');
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カビゴン', null);
  placeSlot(E, 'opp', 1, 'ゲンガー', null);
  const opp0Max = E.realStat(E.slotOf('opp', 0), 'hp');
  const opp1Max = E.realStat(E.slotOf('opp', 1), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.ok(E.slotOf('opp', 0).currentHp < opp0Max, `opp:0がダメージを受ける(実際=${E.slotOf('opp', 0).currentHp}/${opp0Max})`);
  assert.ok(E.slotOf('opp', 1).currentHp < opp1Max, `opp:1もダメージを受ける(実際=${E.slotOf('opp', 1).currentHp}/${opp1Max})`);
});

test('D4-1a-2: 対象順が位置順(自分以外全体=味方→相手左→相手右の順でログに現れる)', () => {
  const E = build2v2();
  // ぶんまわす(自分以外全体・物理60・命中100)。攻撃者=opp:1。TargetSet=self:0,self:1(相手2)+opp:0(味方)。
  // 位置順(台帳#1)=攻撃者から見た味方側(opp側)を先に(idx昇順)→相手側(self側)をidx昇順。
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'ゲンガー', null);
  placeSlot(E, 'opp', 0, 'カメックス', null);
  placeSlot(E, 'opp', 1, 'ドサイドン', 'bunmawasu');
  E.setRandom(mulberry32(11));
  E.runTurn();
  const hits = hitLines(E.battleLog).filter(h => h.move === 'ぶんまわす');
  assert.equal(hits.length, 3, `3体(味方opp:0+相手self:0/self:1)に当たるはず(実際=${hits.length})`);
  // pname()は「opp:0」に限り常に「相手の」を前置する固定のUI表示規約(D3-2から既知・攻撃者がどちらでも不変)。
  assert.equal(hits[0].defender, '相手の カメックス', '先に味方(opp:0)へ当たる(位置順=味方が先)');
  assert.equal(hits[1].defender, 'カビゴン', '次に相手側の左(self:0)へ当たる');
  assert.equal(hits[2].defender, 'ゲンガー', '最後に相手側の右(self:1)へ当たる');
});

test('D4-1a-3: 片方が既にひんしなら残り1体だけに当たる(空き枠は数えない)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'majikarushain');
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カビゴン', null, { fainted: true });
  placeSlot(E, 'opp', 1, 'ゲンガー', null);
  const opp1Max = E.realStat(E.slotOf('opp', 1), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  assert.ok(!msgs.some(m => m.includes('あいてが いなかった')), '残り1体がいるので不発にならない');
  assert.ok(E.slotOf('opp', 1).currentHp < opp1Max, `残ったopp:1にだけ当たる(実際=${E.slotOf('opp', 1).currentHp}/${opp1Max})`);
});

test('D4-1a-4: 対象の集合が空なら不発になる', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'majikarushain');
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カビゴン', null, { fainted: true });
  placeSlot(E, 'opp', 1, 'ゲンガー', null, { fainted: true });
  E.setRandom(mulberry32(3));
  assert.doesNotThrow(() => { E.runTurn(); }, 'runTurn()が例外を出さない');
  const msgs = msgList(E.battleLog);
  assert.ok(msgs.some(m => m.includes('あいてが いなかった')), '相手が全滅していれば不発ログが出る');
});

// ===== D4-1b: 範囲補正×0.75(B022/B023)と壁2/3(B020)(2026-09-11・設計_ダブルバトル_2026-09-07.md§4.4) =====
// マジカルシャイン(相手全体・特殊80・命中100・追加効果なし)でcalcDamageを直接呼び、乱数(命中/急所ロール)に
// 依存しない形でopts.spreadCountの効果だけを検証する(急所はランク0では確率ロールされない=決定論的)。
test('D4-1b-1: calcDamageはopts.spreadCount>=2の時だけダブル範囲×0.75チップが付く(対象1相当では付かない)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'majikarushain');
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カビゴン', null);
  placeSlot(E, 'opp', 1, 'カビゴン', null);
  const mv = E.slotOf('self', 0).moves[0];
  const noSpread = E.calcDamage('self', 'opp', mv, undefined, 0, 0);
  const oneTarget = E.calcDamage('self', 'opp', mv, { spreadCount: 1 }, 0, 0);
  const twoTargets = E.calcDamage('self', 'opp', mv, { spreadCount: 2 }, 0, 0);
  assert.ok(!noSpread.chips.some(c => c.label === 'ダブル範囲'), 'spreadCountを渡さない(単体経路)場合は補正チップが付かない');
  assert.ok(!oneTarget.chips.some(c => c.label === 'ダブル範囲'), 'spreadCount=1(相方ひんし相当)では補正チップが付かない');
  const chip = twoTargets.chips.find(c => c.label === 'ダブル範囲');
  assert.ok(chip && chip.factor === 0.75, 'spreadCount=2では×0.75チップが付く');
  assert.ok(twoTargets.max < noSpread.max, `×0.75の分だけ最大ダメージが下がる(補正あり=${twoTargets.max} / なし=${noSpread.max})`);
  assert.equal(oneTarget.max, noSpread.max, 'spreadCount=1は補正なしと同じ最大ダメージになる');
});

test('D4-1b-2: runTurn経由でも対象2体(×0.75)は対象1体(相方ひんし=補正なし)より1発のダメージが小さい', () => {
  // 数学的に保証される比較(乱数のロール位置に依存しない): 補正なしの最小ロール(×0.85)でも
  // 補正ありの最大ロール(×0.75×1.00=0.75)を必ず上回る(0.85>0.75)ので、どちらの16乱数を引いても
  // 「対象2体(補正あり)<対象1体(補正なし)」が成り立つ=同一シードでなくても安全に比較できる。
  const E2 = build2v2();
  placeSlot(E2, 'self', 0, 'フシギバナ', 'majikarushain');
  placeSlot(E2, 'self', 1, null, null, { fainted: true });
  placeSlot(E2, 'opp', 0, 'カビゴン', null);
  placeSlot(E2, 'opp', 1, 'カビゴン', null);
  E2.setRandom(mulberry32(3));
  E2.runTurn();
  const dmg2 = E2.realStat(E2.slotOf('opp', 0), 'hp') - E2.slotOf('opp', 0).currentHp;

  const E1 = build2v2();
  placeSlot(E1, 'self', 0, 'フシギバナ', 'majikarushain');
  placeSlot(E1, 'self', 1, null, null, { fainted: true });
  placeSlot(E1, 'opp', 0, 'カビゴン', null, { fainted: true });
  placeSlot(E1, 'opp', 1, 'カビゴン', null);
  E1.setRandom(mulberry32(3));
  E1.runTurn();
  const dmg1 = E1.realStat(E1.slotOf('opp', 1), 'hp') - E1.slotOf('opp', 1).currentHp;

  assert.ok(dmg1 > dmg2, `対象1体(補正なし=${dmg1})の方が対象2体(補正あり=${dmg2})より大きいダメージになる`);
});

test('D4-1b-3: 壁の軽減率はダブルで2732/4096(≒2/3)・シングルで0.5になる(ダメージ数値で確認)', () => {
  const EDouble = build2v2();
  placeSlot(EDouble, 'self', 0, 'カビゴン', 'hataku');   // はたく=ノーマル物理(リフレクター対象)・1体選択
  placeSlot(EDouble, 'self', 1, null, null, { fainted: true });
  placeSlot(EDouble, 'opp', 0, 'フシギバナ', null);
  placeSlot(EDouble, 'opp', 1, null, null, { fainted: true });
  const mvD = EDouble.slotOf('self', 0).moves[0];
  EDouble.slotOf('opp', 0).reflect = true;
  const withWallDouble = EDouble.calcDamage('self', 'opp', mvD, undefined, 0, 0);
  const doubleChip = withWallDouble.chips.find(c => c.kind === 'wall');
  assert.ok(doubleChip, 'ダブル(format.slotsPerSide===2)でも壁のチップが付く');
  assert.ok(Math.abs(doubleChip.factor - 2732 / 4096) < 1e-9, `ダブルの壁係数は2732/4096(実際=${doubleChip.factor})`);

  const ESingle = buildEngine();
  ESingle.sides.self.poke = pokeByName('カビゴン');
  ESingle.sides.self.moves = [data.WAZA_MAP['hataku']];
  ESingle.sides.self.currentHp = ESingle.realStat(ESingle.sides.self, 'hp');
  ESingle.sides.opp.poke = pokeByName('フシギバナ');
  ESingle.sides.opp.moves = [];
  ESingle.sides.opp.currentHp = ESingle.realStat(ESingle.sides.opp, 'hp');
  ESingle.resetBattle();
  const mvS = ESingle.sides.self.moves[0];
  ESingle.sides.opp.reflect = true;
  const withWallSingle = ESingle.calcDamage('self', 'opp', mvS, undefined, 0, 0);
  const singleChip = withWallSingle.chips.find(c => c.kind === 'wall');
  assert.ok(singleChip, 'シングルでも壁のチップが付く');
  assert.equal(singleChip.factor, 0.5, 'シングル(format.slotsPerSide===1)の壁係数は従来どおり0.5');

  assert.ok(withWallDouble.max > withWallSingle.max,
    `ダブル(2/3)の方がシングル(1/2)より軽減が弱い=最大ダメージが大きい(ダブル=${withWallDouble.max} / シングル=${withWallSingle.max})`);
});

// ===== D4-1c: 対象別反応と反応の後処理(2026-09-11・設計_ダブルバトル_2026-09-07.md§4.5末尾・#73,#74) =====
function benchEntry(pokeName, moveKey) {
  return { poke: pokeByName(pokeName), effort: {hp:0,atk:0,def:0,spatk:0,spdef:0,spd:0},
    natureIdx: 0, ability: '', item: '', moves: moveKey ? [data.WAZA_MAP[moveKey]] : [],
    currentHp: null, fainted: false, status: 'none', sleepTurns: null };
}

test('D4-1c-1: いかくは相手全体(2枠)に個別に-1をかける', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null, { ability: 'いかく' });
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カメックス', null);
  placeSlot(E, 'opp', 1, 'フシギバナ', null);
  E.phaseInitA();
  assert.equal(E.slotOf('opp', 0).rank.atk, -1, 'opp:0のこうげきが-1になる');
  assert.equal(E.slotOf('opp', 1).rank.atk, -1, 'opp:1のこうげきも-1になる');
});

test('D4-1c-2: 両方がまけんきなら両方が同じ値になる(対象ごとに独立判定・いかく-1+まけんき+2=net+1が既存仕様どおり両者に効く)', () => {
  // まけんきは「下がった分はそのまま適用された上で」こうげき+2を追加する既存仕様(T250=_sim_test.js既存テストで
  // 確認済み=いかくのように"下がる対象と同じ能力"を+2するケースはnet+1になるのが正しい・Bulbapedia "Defiant"
  // 「the Pokémon's stat stage change still occurs before Defiant's stat changes take effect」)。
  // D4-1cで検証したいのはこの数値そのものでなく「対象ごとに独立に同じ反応が起きるか」=opp:0とopp:1が
  // 同じ値になること(位置順・片方だけ違う結果にならないこと)。
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null, { ability: 'いかく' });
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カメックス', null, { ability: 'まけんき' });
  placeSlot(E, 'opp', 1, 'フシギバナ', null, { ability: 'まけんき' });
  E.phaseInitA();
  assert.equal(E.slotOf('opp', 0).rank.atk, 1, 'opp:0はいかく-1+まけんき+2=net+1(既存仕様どおり)');
  assert.equal(E.slotOf('opp', 1).rank.atk, 1, 'opp:1も同じ反応(対象ごとに独立判定=対称)');
});

test('D4-1c-3: だっしゅつパックはいかくが両対象を処理し終えてから発動する(1回)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null, { ability: 'いかく' });
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カメックス', null);
  E.slotOf('opp', 0).item = 'eject_pack';
  E.slotOf('opp', 0).bench = [benchEntry('ゲンガー', null)];
  placeSlot(E, 'opp', 1, 'フシギバナ', null);   // だっしゅつパック無し=そのまま-1で残る(比較対象)
  E.phaseInitA();
  // いかくが両対象(opp:0,opp:1)を処理し終えてから、だっしゅつパック(opp:0)が発動して控えに交代する。
  // 交代前にopp:1がまだ処理されていなければ交代後にopp:1の-1が付かない=「両対象処理後」の証拠になる。
  assert.equal(E.slotOf('opp', 0).poke.name, 'ゲンガー', 'opp:0はだっしゅつパックでゲンガーに交代している');
  assert.equal(E.slotOf('opp', 0).item, '', 'だっしゅつパックは消費される');
  assert.equal(E.slotOf('opp', 1).rank.atk, -1, 'opp:1はいかくの-1を受けたまま(交代前に処理済み)');
});

// ===== D4-2a: 交代を枠単位に(2026-09-11・実装指示D4-2a・設計_ダブルバトル_2026-09-07.md§3) =====
// benchは側(sides[side].bench)に置く。attemptSwitch(sideKey, benchIdx, {slotIdx})で「その枠」だけ入れ替わる。

test('D4-2a-1: 枠1の個体がとんぼがえりで交代→枠1だけ入れ替わる(枠0は不変)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);          // 枠0は行動しない=不変であることの対照
  placeSlot(E, 'self', 1, 'ケンタロス', 'tonbogaeri'); // 枠1がとんぼがえりで自分交代する
  E.sides.self.bench = [benchEntry('ピカチュウ', null)];   // benchは側に置く(build2v2はまだ空)
  placeSlot(E, 'opp', 0, 'フシギバナ', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  E.setRandom(mulberry32(1));
  assert.doesNotThrow(() => { E.runTurn(); });
  assert.equal(E.slotOf('self', 0).poke.name, 'カビゴン', '枠0は交代していない(とんぼがえりを使ったのは枠1)');
  assert.equal(E.slotOf('self', 1).poke.name, 'ピカチュウ', '枠1がbench(側の控え)のピカチュウに入れ替わる');
  assert.ok(E.sides.self.bench.some(b => b && b.poke && b.poke.name === 'ケンタロス'),
    '元の枠1の個体(ケンタロス)がbench(側の控え)に回る');
});

test('D4-2a-2: だっしゅつボタンを枠1が持つ→枠1だけ脱出する(枠0は無傷のまま)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'ケンタロス', null);
  E.slotOf('self', 1).item = 'eject_button';   // 枠1(sides.self本体ではない方の枠オブジェクト)が持つ
  E.sides.self.bench = [benchEntry('ピカチュウ', null)];
  // opp:0が単体技でself:1を名指しする(枠1だけが被弾する)
  placeSlot(E, 'opp', 0, 'リザードン', 'hataku', { targetChoice: { side: 'self', idx: 1 } });
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  const self0Max = E.realStat(E.slotOf('self', 0), 'hp');
  E.setRandom(mulberry32(1));
  assert.doesNotThrow(() => { E.runTurn(); });
  assert.equal(E.slotOf('self', 0).poke.name, 'カビゴン', '枠0は無傷のまま(名指しされていない)');
  assert.equal(E.slotOf('self', 0).currentHp, self0Max, '枠0のHPも減っていない');
  assert.equal(E.slotOf('self', 1).poke.name, 'ピカチュウ', '枠1がだっしゅつボタンでピカチュウに脱出する');
});

// ===== D4-2b: 複数ひんしと死に出し(2026-09-11・実装指示D4-2b・設計_ダブルバトル_2026-09-07.md§7) =====

test('D4-2b-1: 同ターンに相手2枠が倒れる→ターン終了で2枠とも補充・順序が正準順(側→枠)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'ゲンガー', null);
  placeSlot(E, 'opp', 0, 'カメックス', null, { fainted: true });
  placeSlot(E, 'opp', 1, 'フシギバナ', null, { fainted: true });
  E.sides.opp.bench = [benchEntry('ピカチュウ', null), benchEntry('サンダース', null)];
  E.setRandom(mulberry32(1));
  assert.doesNotThrow(() => { E.runTurn(); });
  assert.equal(E.slotOf('opp', 0).poke.name, 'ピカチュウ', 'opp:0がcanonSlots順(側→枠)で先に補充される');
  assert.equal(E.slotOf('opp', 1).poke.name, 'サンダース', 'opp:1が次に補充される');
});

test('D4-2b-2: 控えが1体しか無い→片方だけ補充・以後1vs2で続行(空席のまま)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'ゲンガー', null);
  placeSlot(E, 'opp', 0, 'カメックス', null, { fainted: true });
  placeSlot(E, 'opp', 1, 'フシギバナ', null, { fainted: true });
  E.sides.opp.bench = [benchEntry('ピカチュウ', null)];   // 控え1体だけ(#68)
  E.setRandom(mulberry32(1));
  assert.doesNotThrow(() => { E.runTurn(); });
  assert.equal(E.slotOf('opp', 0).poke.name, 'ピカチュウ', 'opp:0はcanonSlots順で先に補充される');
  assert.ok(E.slotOf('opp', 1).fainted, 'opp:1は控え不足で空席(ひんしのまま)続行する');
});

test('D4-2b-3: 死に出しの個体が設置技(ステルスロック)で倒れる→ターンを進めずさらに補充する', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'ゲンガー', null);
  placeSlot(E, 'opp', 0, 'カメックス', null, { fainted: true });
  E.slotOf('opp', 0).stealthRock = true;   // opp側の設置技(枠0=sides.opp自身が持つ側条件として設定)
  placeSlot(E, 'opp', 1, 'フシギバナ', null);
  const weak = benchEntry('ピジョット', null);
  weak.currentHp = 1;   // ステルスロックのダメージでどんな相性でも確実にひんしになる
  E.sides.opp.bench = [weak, benchEntry('ライチュウ', null)];
  E.setRandom(mulberry32(1));
  assert.doesNotThrow(() => { E.runTurn(); });
  assert.equal(E.slotOf('opp', 0).poke.name, 'ライチュウ',
    'ピジョットがステルスロックで即ひんし→ターンを進めずライチュウまで補充が連鎖する');
});

// ===== D4-2c: 勝敗(2026-09-11・実装指示D4-2c・設計_ダブルバトル_2026-09-07.md§1.1 訂正3/§7) =====

test('D4-2c-1: 相手の最後の2体が同時に倒れる→勝ち', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'ゲンガー', null);
  placeSlot(E, 'opp', 0, 'カメックス', null, { fainted: true });
  placeSlot(E, 'opp', 1, 'フシギバナ', null, { fainted: true });
  E.sides.opp.bench = [];
  const result = E.checkBattleWinner();
  assert.equal(result.over, true, 'バトルは終了している(相手の場+控えが全滅)');
  assert.equal(result.winner, 'self', '相手が全滅=自分の勝ち');
});

test('D4-2c-2: 自分の最後の1体が相手の最後の1体をみちづれで倒す→「最後に倒れた側」の規則で判定', () => {
  const E = build2v2();
  // 攻撃側(self:0)が最後に技を使った側=A.4規則(自爆技でなければ最後に行動した側の勝ち)。
  placeSlot(E, 'self', 0, 'カビゴン', 'hataku');
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  E.sides.self.bench = [];
  placeSlot(E, 'opp', 0, 'ライチュウ', null, { hp: 1 });   // みちづれを構えて自分もひんしになる側(はたく=ノーマルが通る相性)
  E.slotOf('opp', 0).destinyBond = true;
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  E.sides.opp.bench = [];
  E.setRandom(mulberry32(1));
  assert.doesNotThrow(() => { E.runTurn(); });
  assert.ok(E.slotOf('opp', 0).fainted, 'みちづれの持ち主(opp:0)は倒れている');
  assert.ok(E.slotOf('self', 0).fainted, 'みちづれで攻撃側(self:0)も道連れに倒れている(=両者全滅)');
  const result = E.checkBattleWinner();
  assert.equal(result.over, true, '両者全滅で決着している');
  assert.equal(result.simultaneous, true, '同時全滅の分岐を通る');
  assert.equal(result.winner, 'self',
    '既存のみちづれ規則(real_battle.htmlのA.4)=最後に技を出した攻撃側(self)の勝ち。みちづれ使用側(opp)の負け');
});

// ===== D4-2d: 持ち物の枠対応(2026-09-11・実装指示D4-2d) =====

test('D4-2d-1: 相手全体技で両枠のだっしゅつボタンが成立→素の素早さが高い方から順に脱出(両方脱出)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'majikarushain');   // 相手全体の攻撃技(D4-1a-1で使用実績あり)
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カビゴン', null);    // 素早さ30(遅い)
  E.slotOf('opp', 0).item = 'eject_button';
  placeSlot(E, 'opp', 1, 'ゲンガー', null);    // 素早さ110(速い)
  E.slotOf('opp', 1).item = 'eject_button';
  E.sides.opp.bench = [benchEntry('ピカチュウ', null), benchEntry('サンダース', null)];
  E.setRandom(mulberry32(3));
  assert.doesNotThrow(() => { E.runTurn(); });
  assert.notEqual(E.slotOf('opp', 0).poke.name, 'カビゴン', 'opp:0(遅い)もだっしゅつボタンで脱出する');
  assert.notEqual(E.slotOf('opp', 1).poke.name, 'ゲンガー', 'opp:1(速い)もだっしゅつボタンで脱出する');
  const msgs = msgList(E.battleLog);
  const idxFast = msgs.findIndex(m => m.includes('ゲンガー は 引っ込んだ'));
  const idxSlow = msgs.findIndex(m => m.includes('カビゴン は 引っ込んだ'));
  assert.ok(idxFast >= 0, 'ゲンガー(速い)の交代ログが出る');
  assert.ok(idxSlow >= 0, 'カビゴン(遅い)の交代ログが出る');
  assert.ok(idxFast < idxSlow,
    `素の素早さが高い枠(ゲンガー)から先に脱出する(実際: ゲンガー=${idxFast}行目, カビゴン=${idxSlow}行目)`);
});

// ===== D4-3a: 全枠の開始登場・メガ・交代封じ・溜め技の引き寄せ先送り
//              (2026-09-11・実装指示D4-3a・設計_ダブルバトル_2026-09-07.md§4.3/§5・diff 0) =====

test('D4-3a-1: バトル開始の登場特性(いかく×2)は4体が出揃ってからすばやさ順で発動する(#14,#15)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null, { ability: 'いかく' });   // 素早さ78
  placeSlot(E, 'self', 1, 'カビゴン', null);                             // 素早さ30(最遅)
  placeSlot(E, 'opp', 0, 'ゲンガー', null, { ability: 'いかく' });       // 素早さ110(最速)
  placeSlot(E, 'opp', 1, 'フシギバナ', null);                            // 素早さ80
  E.phaseInitA();
  const msgs = msgList(E.battleLog);
  const idxOpp0 = msgs.findIndex(m => m.includes('相手の ゲンガー の いかくで'));
  const idxSelf0 = msgs.findIndex(m => m.includes('カメックス の いかくで'));
  assert.ok(idxOpp0 >= 0 && idxSelf0 >= 0, 'いかくのログが両方出る');
  assert.ok(idxOpp0 < idxSelf0,
    `4体中最速(opp:0=ゲンガー110)のいかくが先に発動する(実際: opp:0=${idxOpp0}行目, self:0=${idxSelf0}行目)`);
});

test('D4-3a-2: megaEvolveは枠1を直接メガシンカさせられる(枠0は無傷のまま)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, 'フシギバナ', null);
  E.slotOf('opp', 1).item = 'mega_stone_venusaur';
  const ok = E.megaEvolve('opp', 1);
  assert.equal(ok, true, '枠1のメガシンカが成立する');
  assert.equal(E.slotOf('opp', 1).poke.name, 'メガフシギバナ', '枠1がメガフシギバナになる');
  assert.equal(E.slotOf('opp', 0).poke.name, 'ゲンガー', '枠0は無関係のまま(交代していない)');
});

test('D4-3a-3: 相手の枠1がかげふみを持っていると自分は交代できない(#かげふみは相手側いずれかの枠を見る)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null);
  placeSlot(E, 'self', 1, 'カビゴン', null);
  E.sides.self.bench = [benchEntry('ピカチュウ', null)];
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, 'フシギバナ', null, { ability: 'かげふみ' });
  const ok = E.attemptSwitch('self', 0, { slotIdx: 0 });
  assert.equal(ok, false, '相手の枠1のかげふみで自分(枠0)は交代できない');
  assert.equal(E.slotOf('self', 0).poke.name, 'カメックス', '交代失敗=出ているポケモンは変わらない');
});

test('D4-3a-4: 溜め技(そらをとぶ)は宣言ターンは引き寄せを無視し、実行ターンにこのゆびとまれが効く(#35)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'ピジョット', 'sorawotobu');
  // ★self:1は生存させておく(このゆびとまれ=target:自分の変化技を「相手opp:1」が使う時、既定defが
  // slotOf('self',1)になる=phaseApplyEffects冒頭の`if(def.fainted) return;`にひっかかり自分向けの
  // 引き寄せ宣言そのものが不発になる、という別件の既存ギャップ(D4-3aのスコープ外)を踏まないため)。
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'カビゴン', null);
  placeSlot(E, 'opp', 1, 'フシギバナ', null);
  const opp0Max = E.realStat(E.slotOf('opp', 0), 'hp');
  const opp1Max = E.realStat(E.slotOf('opp', 1), 'hp');
  E.setRandom(mulberry32(7));
  E.runTurn();   // ターン1: 溜めに入る(攻撃しない)
  assert.ok(E.slotOf('self', 0).charging, '1ターン目は溜めに入る');
  assert.equal(E.slotOf('opp', 0).currentHp, opp0Max, '1ターン目は攻撃していない=ノーダメージ');
  assert.equal(E.slotOf('opp', 1).currentHp, opp1Max, '1ターン目は攻撃していない=ノーダメージ');
  // ターン2: opp:1がこのゆびとまれを宣言→そらをとぶの着地先が正面(opp:0)からopp:1へ引き寄せられるはず
  const opp1 = E.slotOf('opp', 1);
  opp1.moves = [data.WAZA_MAP['konoyubitomare']];
  opp1.selectedMoveIdx = 0;
  E.runTurn();
  assert.equal(E.slotOf('opp', 0).currentHp, opp0Max, '正面(opp:0)は引き寄せで無傷のまま');
  assert.ok(E.slotOf('opp', 1).currentHp < opp1Max,
    `このゆびとまれの宣言者(opp:1)が引き寄せて被弾するはず(実際=${E.slotOf('opp', 1).currentHp}/${opp1Max})`);
});

// ===== D4-3b: 交代とメガの並び=すばやさ順(2026-09-11・実装指示D4-3b・
//              設計_ダブルバトル_2026-09-07.md§5・#13・P03=意図した挙動変更) =====

test('D4-3b-1: 両側が同ターンに交代を選ぶ→速い方(相手)が先に引っ込む', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);   // 素早さ30(遅い)
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'ゲンガー', null);    // 素早さ110(速い)
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  E.sides.self.bench = [benchEntry('カメックス', null)];
  E.sides.opp.bench = [benchEntry('フシギバナ', null)];
  E.sides.self.switchChoice = 0;
  E.sides.opp.switchChoice = 0;
  E.setRandom(mulberry32(9));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  const idxOpp = msgs.findIndex(m => m.includes('ゲンガー は 引っ込んだ'));
  const idxSelf = msgs.findIndex(m => m.includes('カビゴン は 引っ込んだ'));
  assert.ok(idxOpp >= 0 && idxSelf >= 0, '両側とも交代ログが出る');
  assert.ok(idxOpp < idxSelf,
    `速い方(opp=ゲンガー)が先に引っ込む(実際: opp=${idxOpp}行目, self=${idxSelf}行目)`);
});

test('D4-3b-2: 両側が同ターンにメガを予約→速い方(相手)が先にメガシンカする(ログ順・P03)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', null);   // 素早さ80
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'スターミー', null);    // 素早さ115(速い)
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  E.slotOf('self', 0).item = 'mega_stone_venusaur';
  E.slotOf('opp', 0).item = 'mega_stone_starmie';
  E.sides.self.megaChoice = true;
  E.sides.opp.megaChoice = true;
  E.setRandom(mulberry32(9));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  const idxOpp = msgs.findIndex(m => m.includes('メガスターミー に メガシンカした'));
  const idxSelf = msgs.findIndex(m => m.includes('メガフシギバナ に メガシンカした'));
  assert.ok(idxOpp >= 0 && idxSelf >= 0, '両側ともメガシンカのログが出る');
  assert.ok(idxOpp < idxSelf,
    `速い方(opp=スターミー)が先にメガシンカする(実際: opp=${idxOpp}行目, self=${idxSelf}行目)`);
  assert.equal(E.slotOf('self', 0).poke.name, 'メガフシギバナ', '自分もメガシンカが成立している');
  assert.equal(E.slotOf('opp', 0).poke.name, 'メガスターミー', '相手もメガシンカが成立している');
});

test('D4-3b-3: トリックルーム下では両側交代の順が逆転する(遅い方=自分が先)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);   // 素早さ30(遅い)
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'ゲンガー', null);    // 素早さ110(速い)
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  E.sides.self.bench = [benchEntry('カメックス', null)];
  E.sides.opp.bench = [benchEntry('フシギバナ', null)];
  E.sides.self.switchChoice = 0;
  E.sides.opp.switchChoice = 0;
  E.env.trickRoom = true;
  E.setRandom(mulberry32(9));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  const idxOpp = msgs.findIndex(m => m.includes('ゲンガー は 引っ込んだ'));
  const idxSelf = msgs.findIndex(m => m.includes('カビゴン は 引っ込んだ'));
  assert.ok(idxOpp >= 0 && idxSelf >= 0, '両側とも交代ログが出る');
  assert.ok(idxSelf < idxOpp,
    `トリックルームでは遅い方(self=カビゴン)が先に引っ込む(実際: self=${idxSelf}行目, opp=${idxOpp}行目)`);
});

// 2026-09-11 壊す側レビュー指摘#3: 交代/メガの同速タイに乱数点を新設するとオフライン/undoの再現性が変わる+同速の細則は
// 権威未確認(台帳)→乱数を引かず canonSides 順(旧実装の self→opp と同じ結果)に戻した。期待値=乱数0回・順序=canonSides。
test('D4-3b-4: 両側が同ターンに交代・同速→乱数を引かず canonSides 順で決定的に並ぶ(#13・同速細則は未確認=台帳)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null);   // 素早さ78(交代前=同速タイの判定対象)
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カメックス', null);    // 同速
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  // 交代先(枠0=switchedThisTurnで技フェーズはno-opだが、moveOfSlotが返すnullどうし+同速だと
  // schedulerの行動順決定側でも別のtieが1回立ってしまい「switch-phaseの1回」を隠す=交代先は
  // わざと異なる素早さの2種にして、switch-phase由来の乱数だけを切り出して見る)。
  E.sides.self.bench = [benchEntry('フシギバナ', null)];   // 交代先(素早さ80)
  E.sides.opp.bench = [benchEntry('カビゴン', null)];      // 交代先(素早さ30・自分側と異なる速さ)
  E.sides.self.switchChoice = 0;
  E.sides.opp.switchChoice = 0;
  const rng = countingRandom(42);
  E.setRandom(rng);
  E.runTurn();
  assert.equal(rng.count(), 0, `同速タイの交代(orderSidesBySpeedForPhase)は乱数を引かない(実際=${rng.count()}回)`);
  const lines = E.battleLog.map(l => l.msg);
  const iSelf = lines.findIndex(m => /^カメックス は 引っ込んだ/.test(m)), iOpp = lines.findIndex(m => /^相手の カメックス は 引っ込んだ/.test(m));
  assert.ok(iSelf >= 0 && iOpp >= 0 && iSelf < iOpp, `canonSides順(自分→相手)で引っ込む: self=${iSelf} opp=${iOpp} log=${JSON.stringify(lines.slice(0,6))}`);
});

// ===== D5-0: 枠ごとの「選択」をエンジンに配線(UIはまだ)
//              (2026-09-11・実装指示spec_d5_0_choices.md 1.〜4.) =====

test('D5-0-1: 枠1のswitchChoiceで枠1だけ交代する(枠0は不変・switchChoice/selectedMoveIdx/targetChoiceは枠ごと)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null);
  placeSlot(E, 'self', 1, 'カビゴン', null);
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  E.sides.self.bench = [benchEntry('フシギバナ', null)];
  E.slotOf('self', 1).switchChoice = 0;
  E.setRandom(mulberry32(1));
  E.runTurn();
  assert.equal(E.slotOf('self', 0).poke.name, 'カメックス', '枠0はswitchChoiceを立てていない=交代していない');
  assert.equal(E.slotOf('self', 1).poke.name, 'フシギバナ', '枠1がswitchChoiceどおり交代する');
});

test('D5-0-2: メガは側で1回だけ=枠0がメガ済みなら枠1はメガできない(megaUsedはsides[side]に一本化して枠で共有)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', null);
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  E.slotOf('self', 0).item = 'mega_stone_venusaur';
  E.slotOf('self', 1).item = 'mega_stone_blastoise';
  const ok1 = E.megaEvolve('self', 0);
  assert.equal(ok1, true, '枠0のメガシンカは成立する');
  const ok2 = E.megaEvolve('self', 1);
  assert.equal(ok2, false, '枠0がメガ済み(側で共有)なので枠1はメガできない');
  assert.equal(E.slotOf('self', 1).poke.name, 'カメックス', '枠1はメガシンカしていない(canMegaEvolveがsides[side].megaUsedを見て弾く)');
});

test('D5-0-3: 枠1のmegaChoiceで枠1がメガシンカする(枠0はメガ選択なしのまま無関係)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'フシギバナ', null);
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  E.slotOf('self', 1).item = 'mega_stone_venusaur';
  E.slotOf('self', 1).megaChoice = true;
  E.setRandom(mulberry32(1));
  E.runTurn();
  assert.equal(E.slotOf('self', 1).poke.name, 'メガフシギバナ', '枠1がmegaChoiceどおりメガシンカする');
  assert.equal(E.slotOf('self', 0).poke.name, 'カビゴン', '枠0はmegaChoiceを立てていない=無関係のまま');
});

test('D5-0-4: setChoiceで書いたtargetがtargetLockに届く(公開API経由でも枠1(右)を狙って当てられる)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'hataku');
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カメックス', null);
  placeSlot(E, 'opp', 1, 'カビゴン', null);
  const ok = E.setChoice('self', 0, { moveIdx: 0, target: { side: 'opp', idx: 1 } });
  assert.equal(ok, true, 'setChoiceが成立する');
  const opp0Max = E.realStat(E.slotOf('opp', 0), 'hp');
  const opp1Max = E.realStat(E.slotOf('opp', 1), 'hp');
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.ok(E.slotOf('opp', 1).currentHp < opp1Max, `setChoiceのtargetで指定したopp:1が被弾する(実際=${E.slotOf('opp', 1).currentHp}/${opp1Max})`);
  assert.equal(E.slotOf('opp', 0).currentHp, opp0Max, '指定していないopp:0は無傷のまま');
});

test('D5-0-5: getChoiceCandidatesは空席/ひんし枠を候補に出さない(1体選択=相手2枠+味方1枠)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'hataku');
  placeSlot(E, 'self', 1, null, null, { fainted: true });          // 空席
  placeSlot(E, 'opp', 0, 'カメックス', null);
  placeSlot(E, 'opp', 1, 'カビゴン', null, { fainted: true });     // ひんし(枠には残る=空席とは別扱い)
  const cand = E.getChoiceCandidates('self', 0);
  assert.equal(cand.moves.length, 1, 'はたく1本ぶんの候補が出る');
  const targets = cand.moves[0].targets;
  assert.ok(Array.isArray(targets), 'はたく(1体選択)は対象候補(配列)を持つ');
  assert.ok(targets.some(t => t.side === 'opp' && t.idx === 0), '生存しているopp:0は候補に入る');
  assert.ok(!targets.some(t => t.side === 'opp' && t.idx === 1), 'ひんしのopp:1は候補に入らない');
  assert.ok(!targets.some(t => t.side === 'self' && t.idx === 1), '空席のself:1は候補に入らない');
  assert.equal(cand.switches.length, 0, '控えが無いのでswitchesは空');
  assert.equal(cand.canMega, false, 'メガストーンを持っていないのでcanMegaはfalse');
});

test('D5-0-6: getChoiceCandidatesはchooses:falseの技(相手全体等)はtargetsをnullで返す', () => {
  const E = build2v2();
  // ねっぷう= '相手全体'(chooses:false)。1体選択(はたく)と両方持たせて対比する。
  placeSlot(E, 'self', 0, 'フシギバナ', 'hataku');
  E.slotOf('self', 0).moves.push(data.WAZA_MAP.neppuu);
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  placeSlot(E, 'opp', 0, 'カメックス', null);
  placeSlot(E, 'opp', 1, 'カビゴン', null);
  const cand = E.getChoiceCandidates('self', 0);
  assert.equal(cand.moves.length, 2, '技2本ぶんの候補が出る');
  assert.ok(Array.isArray(cand.moves[0].targets), 'はたく(1体選択)はtargetsを持つ');
  assert.equal(cand.moves[1].targets, null, 'ねっぷう(相手全体=chooses:false)はtargets=null(選ばせない)');
});

test('D5-0-7: autoChooseで4体全員が(枠0=既存AI・枠1=最小フォールバックで)動く', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', null);
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, 'カビゴン', null);
  [['self', 0], ['self', 1], ['opp', 0], ['opp', 1]].forEach(([side, idx]) => {
    const st = E.slotOf(side, idx);
    st.moves = [data.WAZA_MAP.hataku];
    st.pp = [10];
  });
  E.autoChoose('self');
  E.autoChoose('opp');
  assert.equal(E.slotOf('self', 0).selectedMoveIdx, 0, '枠0(既存のaiChooseMove)が技を選ぶ');
  assert.equal(E.slotOf('self', 1).selectedMoveIdx, 0, '枠1(PPが残る技の先頭という最小フォールバック)が技を選ぶ');
  assert.equal(E.slotOf('opp', 0).selectedMoveIdx, 0, '相手枠0も技を選ぶ');
  assert.equal(E.slotOf('opp', 1).selectedMoveIdx, 0, '相手枠1も技を選ぶ');
  E.setRandom(mulberry32(5));
  assert.doesNotThrow(() => { E.runTurn(); }, 'runTurn()が例外を出さない');
  [['self', 0], ['self', 1], ['opp', 0], ['opp', 1]].forEach(([side, idx]) => {
    assert.ok(E.slotOf(side, idx).movedThisTurn, `${side}:${idx} が行動する(movedThisTurn)`);
  });
});

// =====================================================================================
// E1(2026-09-11・実装指示 spec_e1_engine_slots.md・設計_ダブルバトル_2026-09-07.md§3/§4.5):
//   a. 「枠0しか回していない」個体単位の処理を全枠へ(ターン終了スリップ/道具の反応/ターン終了の特性ループ)
//   b. 側の効果(おいかぜ/壁/設置物)を側へ一本化(枠1以降はアクセサでsides[s]を読む)
//   c. 範囲技の「自分向け効果の後処理」で相手向け追加効果が先頭の対象に二重適用される穴を閉じる
//   d. しめりけ=場の全枠 / e. ミラーアーマーは実際に下がらないなら不発 / f. いやしのすずは場の味方枠も治す
// ★期待値は権威ソース(ポケモンWiki/Bulbapedia)の記述から立てる(エンジンの出力を写さない)。
// ★シングル不変(862/0・stdout diff 0)は既存ゲートの担当=ここは slotsPerSide:2 のfixtureだけを見る。
// =====================================================================================

// ----- a: ターン終了の個体処理が枠1でも回る -----
// 出典: ポケモンWiki「どく(状態異常)」= 毎ターン終了時に最大HPの1/8のダメージ(どくタイプ/はがねタイプは
//       どく状態にならないがここでは直接 status を立てる fixture なので付与経路は問わない)。
test('E1-a-1: ターン終了のスリップ(どく)が枠1でも処理される(枠0だけ見ていた穴)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'フシギバナ', null);
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  const s1 = E.slotOf('self', 1);
  s1.status = 'poison';
  const max = E.realStat(s1, 'hp');
  s1.currentHp = max;
  E.setRandom(mulberry32(7));
  E.runTurn();
  assert.equal(s1.currentHp, max - Math.floor(max / 8),
    `枠1のどくが最大HPの1/8(=${Math.floor(max / 8)})削られる。実際の残HP=${s1.currentHp}/${max}`);
  assert.ok(msgList(E.battleLog).some(m => m.includes('フシギバナ') && m.includes('どくで')),
    '枠1のどくダメージのログが出る');
});

// 出典: ポケモンWiki「たべのこし」= ターン終了時に最大HPの1/16回復。
test('E1-a-2: ターン終了のたべのこし回復が枠1でも発動する', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'フシギバナ', null);
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  const s1 = E.slotOf('self', 1);
  s1.item = 'leftovers';
  const max = E.realStat(s1, 'hp');
  s1.currentHp = max - 40;
  E.setRandom(mulberry32(7));
  E.runTurn();
  assert.equal(s1.currentHp, max - 40 + Math.max(1, Math.floor(max / 16)),
    `枠1のたべのこしで1/16(=${Math.floor(max / 16)})回復する。実際=${s1.currentHp}`);
});

// 出典: ポケモンWiki「オボンのみ」= HPが половина… (日本語Wiki)「HPが最大HPの1/2以下になったとき
//       最大HPの1/4回復して消費する」。道具の反応(itemReactions)が枠1でも回ることの確認。
test('E1-a-3: 道具の反応(オボンのみ)が枠1でも発動して消費される', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'フシギバナ', null);
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  const s1 = E.slotOf('self', 1);
  s1.item = 'berry_sitrus';
  const max = E.realStat(s1, 'hp');
  s1.currentHp = Math.floor(max / 2) - 1;   // 半分以下
  E.setRandom(mulberry32(7));
  E.runTurn();
  assert.ok(s1.currentHp > Math.floor(max / 2) - 1,
    `枠1のオボンのみでHPが回復する(実際=${s1.currentHp}/${max})`);
  assert.ok(!s1.item, '発動したオボンのみは消費される(持ち物が無くなる)');
});

// 出典: Bulbapedia "Leech Seed"= 吸い取ったHPは「タネを植えたポケモンがいた"位置"」のポケモンが受け取る。
test('E1-a-4: やどりぎのタネは「植えた枠」がHPを吸い取る(枠1が植えたら枠1が回復する)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'フシギバナ', 'yadorigi');
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  E.setChoice('self', 1, { moveIdx: 0, target: { side: 'opp', idx: 1 } });
  const seeder = E.slotOf('self', 1);
  const seeded = E.slotOf('opp', 1);
  const sMax = E.realStat(seeder, 'hp');
  seeder.currentHp = sMax - 60;
  const tMax = E.realStat(seeded, 'hp');
  seeded.currentHp = tMax;
  E.setRandom(mulberry32(11));
  E.runTurn();
  assert.ok(seeded.currentHp < tMax, `植えられたopp:1が削られる(実際=${seeded.currentHp}/${tMax})`);
  assert.ok(seeder.currentHp > sMax - 60,
    `吸い取り先は「植えた枠」=self:1(実際=${seeder.currentHp}、植えた直後=${sMax - 60})`);
  assert.equal(E.slotOf('self', 0).currentHp, E.realStat(E.slotOf('self', 0), 'hp'),
    '植えていない枠0は回復しない(満タンのまま)');
});

// ----- b: 側の効果は側に一本化され、両枠に効く -----
// 出典: ポケモンWiki「おいかぜ」=「4ターンの間、味方全員のすばやさが2倍になる」(味方側全体の効果)。
test('E1-b-1: おいかぜを枠0が張ると枠1のすばやさも2倍になる(行動順で確認)', () => {
  const E = build2v2();
  // self:1 フシギバナ(80) < opp:0 リザードン(100) → おいかぜ(×2=160)があれば先に動く
  placeSlot(E, 'self', 0, 'カビゴン', 'oikaze');
  placeSlot(E, 'self', 1, 'フシギバナ', 'hataku');
  placeSlot(E, 'opp', 0, 'リザードン', 'hataku');
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  const before = E.effectiveSpeed(E.slotOf('self', 1));
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.equal(E.sides.self.tailwindTurns, 3, 'おいかぜが側に立ち、このターンの終わりに1減って残り3');
  const after = E.effectiveSpeed(E.slotOf('self', 1));
  assert.equal(after, before * 2,
    `枠1(おいかぜを張っていない側の相方)のすばやさも2倍になる(実際 ${before}→${after})`);
});

// 出典: ポケモンWiki「リフレクター」=「5ターンの間、味方が受ける物理技のダメージを半減(ダブルバトルでは2/3)」
//       =味方側全体の効果。ダブルの係数2732/4096は設計§4.4(第六世代〜)。
test('E1-b-2: リフレクターを枠0が張ると枠1の物理被ダメも2732/4096になる', () => {
  function dmg(withScreen, screenSlot) {
    const E = build2v2();
    placeSlot(E, 'self', 0, 'カビゴン', null);
    placeSlot(E, 'self', 1, 'カメックス', null);
    placeSlot(E, 'opp', 0, 'ケンタロス', 'hataku');
    placeSlot(E, 'opp', 1, null, null, { fainted: true });
    if (withScreen) {
      // 技で張るのと同じ状態(側の欄に立てる)。どちらの枠から立てても側に1本だけ立つ。
      E.slotOf('self', screenSlot).reflect = true;
    }
    const res = E.calcDamage('opp', 'self', data.WAZA_MAP.hataku, undefined, 0, 1);
    return res.variations[res.variations.length - 1];   // 乱数最大値で比較(乱数を引かない)
  }
  const plain = dmg(false, 0);
  const viaSlot0 = dmg(true, 0);
  const viaSlot1 = dmg(true, 1);
  // 壁はダメージ計算の途中(M=pokeRound段)で掛かるので、最終値は素×2732/4096の±1に入る
  // (監査 tools/_doubles_audit/tailwind_screens_both_slots_test.js の assertTwoThirds と同じ判定)。
  assert.ok(Math.abs(viaSlot0 - plain * 2732 / 4096) <= 1,
    `枠0が張った壁で枠1の被ダメが2732/4096(≒${(plain * 2732 / 4096).toFixed(1)})になる(素=${plain} → 実際=${viaSlot0})`);
  assert.ok(Math.abs(viaSlot0 - plain * 2048 / 4096) > 1,
    `ダブルでは1/2(≒${(plain * 2048 / 4096).toFixed(1)})にはしない(実際=${viaSlot0})`);
  assert.equal(viaSlot1, viaSlot0, '枠1から張っても同じ(側の欄に1本化されている)');
});

test('E1-b-3: 枠1が張った壁/おいかぜ/設置物は枠0からも同じ値として読める(側に1本化)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null);
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, 'フシギバナ', null);
  const s0 = E.slotOf('self', 0), s1 = E.slotOf('self', 1);
  s1.lightScreen = true; s1.tailwindTurns = 4; s1.spikesLayers = 2; s1.stealthRock = true;
  assert.equal(s0.lightScreen, true, '枠1が張ったひかりのかべが枠0からも見える');
  assert.equal(s0.tailwindTurns, 4, '枠1が張ったおいかぜが枠0からも見える');
  assert.equal(s0.spikesLayers, 2, '枠1が撒いたまきびしが枠0からも見える');
  assert.equal(s0.stealthRock, true, '枠1が撒いたステルスロックが枠0からも見える');
  assert.equal(E.sides.self.lightScreen, true, '実体は sides[side](=側の欄)に1本だけ');
  assert.equal(E.slotOf('opp', 0).lightScreen, false, '相手側には立たない(側ごとに別)');
});

// 出典: ポケモンWiki「リフレクター」=5ターン。ダブルでも「側」で1つの効果なので、
//       2枠あってもターン終了のカウントダウンは1ターンぶんだけ進む(枠で回すと2ずつ減ってしまう)。
test('E1-b-4: 壁の残りターンは側で1ターンぶんだけ減る(2枠あっても二重減算しない)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', 'rifurekutaa');
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  placeSlot(E, 'opp', 1, 'フシギバナ', null);
  E.setRandom(mulberry32(3));
  E.runTurn();
  assert.equal(E.sides.self.reflect, true, 'リフレクターが張られている');
  assert.equal(E.sides.self.screenTurns.reflect, 4,
    `5ターンのうち張ったターンの終わりに1減って残り4(実際=${E.sides.self.screenTurns.reflect})`);
  E.setRandom(mulberry32(4));
  E.runTurn();
  assert.equal(E.sides.self.screenTurns.reflect, 3,
    `次のターンも1だけ減る(実際=${E.sides.self.screenTurns.reflect})`);
});

// ----- c: 範囲技の追加効果が先頭の対象に二重ロールしない -----
// 出典: ポケモンWiki「いわなだれ」= 追加効果「30%の確率で ひるみ状態にする」/ 相手全体。
//       対象ごとに独立に1回だけ振られる(設計§4.5 #49)。
test('E1-c-1: いわなだれ(相手全体)のひるみは対象ごとに1回だけ振られる(先頭の対象に二重ロールしない)', () => {
  let flinch0 = 0, flinch1 = 0, doubleLine = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const E = build2v2();
    placeSlot(E, 'self', 0, 'カビゴン', 'iwanadare');
    placeSlot(E, 'self', 1, null, null, { fainted: true });
    placeSlot(E, 'opp', 0, 'カメックス', null);
    placeSlot(E, 'opp', 1, 'フシギバナ', null);
    // 相手は倒れない(ひるみ判定まで到達する)ようHPを十分に持たせる
    E.slotOf('opp', 0).currentHp = 9999; E.slotOf('opp', 1).currentHp = 9999;
    E.setRandom(mulberry32(1000 + i));
    E.runTurn();
    const msgs = msgList(E.battleLog).filter(m => m.includes('は ひるんだ'));
    const l0 = msgs.filter(m => m.includes('カメックス')).length;
    const l1 = msgs.filter(m => m.includes('フシギバナ')).length;
    if (l0 > 1 || l1 > 1) doubleLine++;
    if (l0 === 1) flinch0++;
    if (l1 === 1) flinch1++;
  }
  assert.equal(doubleLine, 0, `同じ対象に「ひるんだ！」が2回出ることは無い(実際=${doubleLine}/${N}回)`);
  const r0 = flinch0 / N, r1 = flinch1 / N;
  assert.ok(r0 > 0.18 && r0 < 0.42, `先頭の対象(opp:0)のひるみ率は30%前後(実際=${(r0 * 100).toFixed(1)}%)`);
  assert.ok(r1 > 0.18 && r1 < 0.42, `2番目の対象(opp:1)のひるみ率も30%前後(実際=${(r1 * 100).toFixed(1)}%)`);
});

// ----- d: しめりけは場の全枠 -----
// 出典: Bulbapedia "Damp"= 場にいるどのポケモンも じばく/だいばくはつ 等を使えなくなる。
test('E1-d-1: しめりけは味方枠/相手の右枠に居てもじばくを止める(場の全枠を見る)', () => {
  function selfKOHappened(dampAt) {
    const E = build2v2();
    placeSlot(E, 'self', 0, 'カビゴン', 'jibaku');
    placeSlot(E, 'self', 1, 'カメックス', null, { ability: dampAt === 'self1' ? 'しめりけ' : 'ふみん' });
    placeSlot(E, 'opp', 0, 'ゲンガー', null, { ability: dampAt === 'opp0' ? 'しめりけ' : 'ふみん' });
    placeSlot(E, 'opp', 1, 'フシギバナ', null, { ability: dampAt === 'opp1' ? 'しめりけ' : 'ふみん' });
    E.setRandom(mulberry32(5));
    E.runTurn();
    return !!E.slotOf('self', 0).fainted;
  }
  assert.equal(selfKOHappened('none'), true, '対照: しめりけが居なければじばくは成立して使用者はひんし');
  assert.equal(selfKOHappened('opp0'), false, '相手の正面(opp:0)のしめりけで失敗する');
  assert.equal(selfKOHappened('opp1'), false, '相手の右枠(opp:1)のしめりけでも失敗する');
  assert.equal(selfKOHappened('self1'), false, '自分の味方枠(self:1)のしめりけでも失敗する');
});

// ----- e: ミラーアーマーは「実際に下がらない」なら不発 -----
// 出典: ポケモンWiki「いかく」#特性の仕様「みがわり/しろいきり状態で防いだ場合や、すでに最低だったため
//       攻撃が下がらなかった場合、ミラーアーマーは発動しない。」
test('E1-e-1: こうげきが既に-6の枠ではミラーアーマーが発動しない(いかく側に返らない)', () => {
  const E = build2v2();
  const intim = placeSlot(E, 'self', 0, 'ケンタロス', null, { ability: 'いかく' });
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  const f0 = placeSlot(E, 'opp', 0, 'カメックス', null, { ability: 'ミラーアーマー' });
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  f0.rank.atk = -6;
  intim.rank.atk = 0;
  E.phaseInitA();
  assert.equal(f0.rank.atk, -6, '前提どおり -6 のまま(これ以上下がらない)');
  assert.equal(intim.rank.atk, 0,
    `下がらなかったので跳ね返らない=いかく側のこうげきは0のまま(実際=${intim.rank.atk})`);
  assert.ok(!msgList(E.battleLog).some(m => m.includes('ミラーアーマー')), '跳ね返しのログも出ない');
});

test('E1-e-2: しろいきり状態の枠ではミラーアーマーが発動しない(しろいきりが防ぐ)', () => {
  const E = build2v2();
  const intim = placeSlot(E, 'self', 0, 'ケンタロス', null, { ability: 'いかく' });
  placeSlot(E, 'self', 1, null, null, { fainted: true });
  const f0 = placeSlot(E, 'opp', 0, 'カメックス', null, { ability: 'ミラーアーマー' });
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  f0.rank.atk = 0; intim.rank.atk = 0;
  f0.mist = true;   // しろいきり(側の場の効果)
  E.phaseInitA();
  assert.equal(f0.rank.atk, 0, 'しろいきりでこうげきは下がらない');
  assert.equal(intim.rank.atk, 0,
    `しろいきりで防いだ場合もミラーアーマーは発動しない=いかく側は0のまま(実際=${intim.rank.atk})`);
  assert.ok(msgList(E.battleLog).some(m => m.includes('しろいきりで 能力が下がらない')),
    '代わりにしろいきりのログが出る');
  assert.ok(!msgList(E.battleLog).some(m => m.includes('ミラーアーマー')), 'ミラーアーマーのログは出ない');
});

// ----- f: いやしのすずは場の味方枠も治す -----
// 出典: ポケモンWiki「いやしのすず」=「戦闘に出ていない手持ちポケモンも含めた、味方全員の状態異常を治す」/
//       ヤックン /ch/「自分と味方と 手持ちのポケモン全員の 状態異常を回復する。[音]」
test('E1-f-1: いやしのすずは使用者・場の味方枠・控えの状態異常を全部治す', () => {
  const E = build2v2();
  const user = placeSlot(E, 'self', 0, 'カビゴン', 'iyashinosuzu');
  const ally = placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ゲンガー', null);
  const foe1 = placeSlot(E, 'opp', 1, 'フシギバナ', null);
  user.status = 'burn';
  ally.status = 'paralysis';
  foe1.status = 'burn';
  E.sides.self.bench = [benchEntry('ピカチュウ', null)];
  E.sides.self.bench[0].status = 'sleep';
  E.setRandom(mulberry32(9));
  E.runTurn();
  assert.equal(user.status, 'none', '使用者(self:0)のやけどが治る');
  assert.equal(ally.status, 'none', '場の味方枠(self:1)のまひも治る');
  assert.equal(E.sides.self.bench[0].status, 'none', '控えのねむりも治る');
  assert.equal(foe1.status, 'burn', '相手(opp:1)の状態異常は治らない(味方だけ)');
  assert.ok(msgList(E.battleLog).some(m => m.includes('カメックス') && m.includes('状態異常が 治った')),
    '場の味方枠のログは既存文言(「◯◯ の 状態異常が 治った！」)で出る');
});

// =============================================================================
// E2(2026-09-11・指示書 spec_e2_ally_abilities.md): 「味方を読む」特性群(Champions搭載分)
//   期待値はすべて権威ソース(ポケモンWiki / master/abilities.json の Champions 効果文 /
//   reference/_ability_facts.json)の引用から立てる。エンジンの出力を写していない。
//   ★土台 = allySlotsOf(side, idx)(同じ側の自分以外の在場・生存枠)。シングルは常に空=全機構が不発。
// =============================================================================

// ----- 機構1: フレンドガード(監査 friend_guard) -----
// 出典: ポケモンWiki『フレンドガード』効果節「自分以外の味方ポケモンが受ける攻撃技のダメージが3/4倍になる。」
//       備考節「自身へのダメージは減らせないので、シングルバトルで発動することはない。」
test('E2-1-1: フレンドガードは味方が受ける攻撃技のダメージを3/4にし、保持者自身のダメージは減らさない', () => {
  const mv = data.WAZA_MAP['hataku'];
  // (a) 味方(self:1)が受ける: 保持者(self:0)の特性だけを入れ替えて比べる
  const mk = (holderAb) => {
    const E = build2v2();
    placeSlot(E, 'self', 0, 'イッカネズミ(4ひきかぞく)', null, { ability: holderAb });
    placeSlot(E, 'self', 1, 'カメックス', null, { ability: 'げきりゅう' });
    placeSlot(E, 'opp', 0, null, null);
    placeSlot(E, 'opp', 1, 'ケンタロス', null, { ability: '' });
    return E;
  };
  const ally = mk('フレンドガード').calcDamage('opp', 'self', mv, {}, 1, 1);
  const allyCtrl = mk('テクニシャン').calcDamage('opp', 'self', mv, {}, 1, 1);
  assert.ok(ally.chips.some(c => c.label === 'フレンドガード' && c.factor === 0.75),
    `味方が受ける側に フレンドガード ×0.75 のチップが付く(実際=${JSON.stringify(ally.chips)})`);
  assert.ok(ally.max < allyCtrl.max,
    `味方の被ダメージが減る(FGあり=${ally.max} / 対照=${allyCtrl.max})`);
  // 3/4 は「最終ダメージ補正」の鎖=壁と同じ位置。16通りの乱数列のすべてで pokeRound(v,3072) と一致する
  const q = (n) => { const x = n * 3072; return Math.floor(x / 4096) + ((x % 4096) > 2048 ? 1 : 0); };
  for (let i = 0; i < 16; i++){
    assert.equal(ally.variations[i], q(allyCtrl.variations[i]),
      `乱数${i}番: 3/4(pokeRound(v,3072))と一致するはず(対照=${allyCtrl.variations[i]} → 期待=${q(allyCtrl.variations[i])} / 実際=${ally.variations[i]})`);
  }
  // (b) 保持者自身(self:0)が受ける分は減らない(備考節)
  const self = mk('フレンドガード').calcDamage('opp', 'self', mv, {}, 1, 0);
  const selfCtrl = mk('テクニシャン').calcDamage('opp', 'self', mv, {}, 1, 0);
  assert.equal(self.max, selfCtrl.max,
    `保持者自身のダメージは対照と同値(FGあり=${self.max} / 対照=${selfCtrl.max})`);
});

// ----- 機構2: テレパシー(監査 telepathy) -----
// 出典: ポケモンWiki『テレパシー』効果節「味方から受ける攻撃技を無効化する。」
//       特性の仕様節「・変化技は無効化できない。」「・かたやぶりの効果を持つ技に対してテレパシーは発動しない。」
test('E2-2-1: テレパシーは味方の攻撃技だけを無効化する(変化技は通る・かたやぶりの味方には発動しない)', () => {
  const run = (moveKey, holderAb, attackerAb) => {
    const E = build2v2();
    placeSlot(E, 'self', 0, 'カビゴン', moveKey, { ability: attackerAb, targetChoice: { side: 'self', idx: 1 } });
    const holder = placeSlot(E, 'self', 1, 'サーナイト', null, { ability: holderAb });
    placeSlot(E, 'opp', 0, null, null, { fainted: true });
    placeSlot(E, 'opp', 1, null, null, { fainted: true });
    const maxHp = E.realStat(holder, 'hp');
    E.setRandom(mulberry32(5));
    E.runTurn();
    return { hp: holder.currentHp, maxHp, status: String(holder.status), msgs: msgList(E.battleLog) };
  };
  const ctrl = run('hataku', 'シンクロ', '');
  assert.ok(ctrl.hp < ctrl.maxHp, `対照(テレパシー無し)では味方のはたくで減る(${ctrl.hp}/${ctrl.maxHp})`);
  const tp = run('hataku', 'テレパシー', '');
  assert.equal(tp.hp, tp.maxHp, `攻撃技は無効化=HP満タンのまま(実際=${tp.hp}/${tp.maxHp})`);
  // E4-B(2026-09-12): 実機文言に置き換えた。出典= ポケモンWiki『テレパシー』特性の仕様節
  //   「「<所持者>は 味方からの 攻撃を 受けない!」とメッセージが流れる。」
  assert.ok(tp.msgs.some(m => /は 味方からの 攻撃を 受けない！$/.test(m) && m.includes('サーナイト')),
    `無効化は実機文言(「◯◯ は 味方からの 攻撃を 受けない！」)で出る。実際=${JSON.stringify(tp.msgs)}`);
  const statusMove = run('denjiha', 'テレパシー', '');
  assert.equal(statusMove.status, 'paralysis', '変化技(でんじは)は無効化できない=まひする');
  const breaker = run('hataku', 'テレパシー', 'かたやぶり');
  assert.ok(breaker.hp < breaker.maxHp,
    `かたやぶりを持つ味方の攻撃技にはテレパシーが発動しない(実際=${breaker.hp}/${breaker.maxHp})`);
});

// ----- 機構3: プラス/マイナス(監査 plus_minus) -----
// 出典: master/abilities.json『プラス』effect_ja「特性『プラス』か『マイナス』のポケモンが戦闘にいると
//       『とくこう』が1.5倍になる。(自分の味方が対象で、相手の場にいるだけでは発動しない)」
//       reference/_ability_facts.json facts.プラス「・プラスやマイナスのポケモンが相手の場にいるだけでは発動しない。」
// 倍率の独立オラクル: とくこうランク+1 = ×1.5(rankMult(+1)=(2+1)/2)。
test('E2-3-1: 味方にプラス/マイナスが居るとプラス持ちのとくこうが1.5倍(=ランク+1と同値)・物理と相手側は無関係', () => {
  const mv = data.WAZA_MAP['pawaajiemu'];   // パワージェム(特殊80)
  const mk = (opts) => {
    const E = build2v2();
    const atk = placeSlot(E, 'self', 0, 'デンリュウ', null, { ability: 'プラス' });
    placeSlot(E, 'self', 1, opts.ally ? 'ライボルト' : null, null, opts.ally ? { ability: opts.allyAbility } : {});
    placeSlot(E, 'opp', 0, 'カビゴン', null, { ability: 'どんかん' });
    placeSlot(E, 'opp', 1, opts.oppAlly ? 'ライボルト' : null, null, opts.oppAlly ? { ability: opts.oppAllyAbility } : {});
    if (opts.spatkRank) atk.rank = Object.assign({}, atk.rank, { spatk: opts.spatkRank });
    return E;
  };
  const withMinus = mk({ ally: true, allyAbility: 'マイナス' }).calcDamage('self', 'opp', mv, {}, 0, 0);
  const oracle15  = mk({ ally: true, allyAbility: 'どんかん', spatkRank: 1 }).calcDamage('self', 'opp', mv, {}, 0, 0);
  const plain     = mk({ ally: true, allyAbility: 'どんかん' }).calcDamage('self', 'opp', mv, {}, 0, 0);
  assert.deepEqual(Array.from(withMinus.variations), Array.from(oracle15.variations),
    'とくこう1.5倍は「とくこうランク+1」と同じ実数値・同じ丸めになる(16通り全部一致)');
  assert.notDeepEqual(Array.from(withMinus.variations), Array.from(plain.variations),
    '補正なしとは違う値になる(=特性が発動している)');
  // 味方が「プラス」でも発動する(第五世代以降=どちらの味方でも可)
  const allyPlus = mk({ ally: true, allyAbility: 'プラス' }).calcDamage('self', 'opp', mv, {}, 0, 0);
  assert.deepEqual(Array.from(allyPlus.variations), Array.from(oracle15.variations),
    '味方がプラス(同じ特性)でも1.5倍になる');
  // 相手の場のマイナスでは発動しない
  const oppMinus = mk({ ally: true, allyAbility: 'どんかん', oppAlly: true, oppAllyAbility: 'マイナス' })
    .calcDamage('self', 'opp', mv, {}, 0, 0);
  assert.deepEqual(Array.from(oppMinus.variations), Array.from(plain.variations),
    '相手の場のマイナスでは発動しない');
  // 物理技には乗らない(とくこう限定)
  const physMv = data.WAZA_MAP['hataku'];
  const physWith = mk({ ally: true, allyAbility: 'マイナス' }).calcDamage('self', 'opp', physMv, {}, 0, 0);
  const physPlain = mk({ ally: true, allyAbility: 'どんかん' }).calcDamage('self', 'opp', physMv, {}, 0, 0);
  assert.deepEqual(Array.from(physWith.variations), Array.from(physPlain.variations),
    '物理技のダメージは変わらない(とくこうだけが上がる)');
});

// ----- 機構4: そうだいしょう(監査 supreme_overlord) -----
// 出典: ポケモンWiki『そうだいしょう』効果節「…ひんし1匹につき10%ずつ補正率が上がる。最大補正率は+50%。」
//       特性の仕様節「威力の補正率は特性が発動した時点で決まる。」
//       「特性が発動した後に味方がひんしになっても補正率は上昇しない。」
//       「その戦闘でひんしになった味方がいないときは特性バーとメッセージは現れない。」
test('E2-4-1: そうだいしょうは登場時のひんし数で威力補正が確定し、その後味方が倒れても上がらない', () => {
  const mv = data.WAZA_MAP['aianheddo'];
  // Q12 = [1.0,1.1,1.2,1.3,1.4,1.5](@smogon/calc gen789 powMod と同じ表)
  const Q12 = [4096, 4506, 4915, 5325, 5734, 6144];
  const mkHolder = (benchFainted, allyFainted) => {
    const E = build2v2();
    placeSlot(E, 'self', 0, 'ドドゲザン', null, { ability: 'そうだいしょう' });
    placeSlot(E, 'self', 1, 'カメックス', null, allyFainted ? { fainted: true } : {});
    placeSlot(E, 'opp', 0, 'ケンタロス', null, { ability: '' });
    placeSlot(E, 'opp', 1, null, null);
    E.sides.self.bench = [];
    for (let i = 0; i < benchFainted; i++){
      const b = benchEntry('カメックス', null); b.fainted = true; b.currentHp = 0;
      E.sides.self.bench.push(b);
    }
    E.phaseInitA();
    return E;
  };
  const base = mkHolder(0, false).calcDamage('self', 'opp', mv, {}, 0, 0);
  assert.ok(!base.chips.some(c => String(c.label).includes('そうだいしょう')),
    'ひんし0体では補正チップが付かない(=発動しない)');
  // ひんし1〜5体で ×1.1〜×1.5(5体で打ち止め)
  for (let n = 1; n <= 5; n++){
    const E = mkHolder(n, false);
    const r = E.calcDamage('self', 'opp', mv, {}, 0, 0);
    const chip = r.chips.find(c => String(c.label).includes('そうだいしょう'));
    assert.ok(chip, `ひんし${n}体で補正チップが付く(実際=${JSON.stringify(r.chips)})`);
    assert.equal(chip.factor, Q12[n] / 4096, `ひんし${n}体の補正は ×${Q12[n] / 4096}`);
    // E4-B(2026-09-12): 実機文言に置き換えた。出典= ポケモンWiki『そうだいしょう』特性の仕様節
    //   「「<ポケモン>は 倒された 仲間から 力を もらった!」とメッセージが出る。」
    assert.ok(msgList(E.battleLog).some(m => /は 倒された 仲間から 力を もらった！$/.test(m)),
      `ひんし${n}体では発動ログ(実機文言「◯◯ は 倒された 仲間から 力を もらった！」)が出る`);
  }
  // 上限: ひんし6体でも ×1.5 のまま
  const capped = mkHolder(6, false).calcDamage('self', 'opp', mv, {}, 0, 0);
  assert.equal(capped.chips.find(c => String(c.label).includes('そうだいしょう')).factor, 1.5,
    '最大補正率は+50%(ひんし6体でも1.5倍で打ち止め)');
  // 「発動した後に味方がひんしになっても上がらない」: 登場後に隣の枠を倒す
  const E2 = mkHolder(1, false);
  const before = E2.calcDamage('self', 'opp', mv, {}, 0, 0);
  const ally = E2.slotOf('self', 1);
  ally.currentHp = 0; ally.fainted = true;            // 登場後に味方が倒れた
  const after = E2.calcDamage('self', 'opp', mv, {}, 0, 0);
  assert.equal(after.chips.find(c => String(c.label).includes('そうだいしょう')).factor,
    before.chips.find(c => String(c.label).includes('そうだいしょう')).factor,
    '登場後に味方が倒れても補正率は登場時点の値のまま');
});

// ----- 機構5: おもてなし(監査 hospitality) -----
// 出典: ポケモンWiki『おもてなし』効果節「場に出たときに、味方のHPを最大HPの1/4分だけ回復する
//       (小数点以下切り捨て)。」/ 特性の仕様節「味方がいないときや、味方のHPが満タンのときは発動しない。」
//       「いかくやかわりものなど、他の多くの場に出たときに発動する特性より発動の優先順位が低い。」
// E4-B(2026-09-12): おもてなしの発動行=実機文言。出典= ポケモンWiki『おもてなし』特性の仕様節
//   「発動時、「<特性所持者>が たてた お茶を <味方>は 飲みほした!」というメッセージが出る。」
const TEA_RE = /が たてた お茶を .* は 飲みほした！$/;
test('E2-5-1: おもてなしは登場時に味方のHPを1/4(切り捨て)回復し、満タン/味方不在では発動せず、いかくより後に発動する', () => {
  // (a) 回復量 = 味方の最大HP÷4 の切り捨て / 自分は回復しない
  const E = build2v2();
  const host = placeSlot(E, 'self', 0, 'ヤバソチャ(ボンサクのすがた)', null, { ability: 'おもてなし' });
  const ally = placeSlot(E, 'self', 1, 'カメックス', null, { hp: 1 });
  placeSlot(E, 'opp', 0, 'フシギバナ', null);
  placeSlot(E, 'opp', 1, null, null);
  const hostMax = E.realStat(host, 'hp');
  host.currentHp = Math.max(1, Math.floor(hostMax / 2));
  const hostBefore = host.currentHp;
  const allyMax = E.realStat(ally, 'hp');
  E.phaseInitA();
  assert.equal(ally.currentHp, 1 + Math.floor(allyMax / 4),
    `味方は 1 → 1+floor(${allyMax}/4) になる(実際=${ally.currentHp})`);
  assert.equal(host.currentHp, hostBefore, '自分(保持者)は回復しない');

  // (b) 味方が満タン/味方不在では発動しない(ログも出ない)
  const full = build2v2();
  placeSlot(full, 'self', 0, 'ヤバソチャ(ボンサクのすがた)', null, { ability: 'おもてなし' });
  placeSlot(full, 'self', 1, 'カメックス', null);   // 満タン
  placeSlot(full, 'opp', 0, 'フシギバナ', null);
  placeSlot(full, 'opp', 1, null, null);
  full.phaseInitA();
  // E4-B(2026-09-12): 発動行は実機文言「◯◯が たてた お茶を △△は 飲みほした！」に置き換えた
  //   (出典= ポケモンWiki『おもてなし』特性の仕様節)。発動の有無はこの行で見る。
  assert.ok(!msgList(full.battleLog).some(m => TEA_RE.test(m)), '満タンの味方には発動しない');

  const solo = build2v2();
  const h2 = placeSlot(solo, 'self', 0, 'ヤバソチャ(ボンサクのすがた)', null, { ability: 'おもてなし' });
  placeSlot(solo, 'self', 1, null, null);
  placeSlot(solo, 'opp', 0, 'フシギバナ', null);
  placeSlot(solo, 'opp', 1, null, null);
  h2.currentHp = 1;
  solo.phaseInitA();
  assert.equal(h2.currentHp, 1, '味方がいないときは発動しない(自分も回復しない)');
  assert.ok(!msgList(solo.battleLog).some(m => TEA_RE.test(m)), '味方不在では発動ログも出ない');

  // (c) いかくより後に発動する(おもてなし側が速い配置でも順序が逆転しない)
  const ord = build2v2();
  placeSlot(ord, 'self', 0, 'ヤバソチャ(ボンサクのすがた)', null, { ability: 'おもてなし' });
  const kuchiito = placeSlot(ord, 'self', 1, 'クチート', null, { hp: 1, ability: 'いかく' });
  placeSlot(ord, 'opp', 0, 'フシギバナ', null);
  placeSlot(ord, 'opp', 1, null, null);
  assert.ok(ord.effectiveSpeed(ord.slotOf('self', 0)) > ord.effectiveSpeed(kuchiito),
    '前提: おもてなし側の方が速い(素早さ順なら先に発動してしまう配置)');
  ord.setRandom(mulberry32(1));
  ord.phaseInitA();
  const m = msgList(ord.battleLog);
  const iIntim = m.findIndex(x => x.includes('いかく'));
  const iHosp = m.findIndex(x => TEA_RE.test(x));
  assert.ok(iIntim >= 0 && iHosp >= 0, `両方の発動ログが出る(実際=${JSON.stringify(m)})`);
  assert.ok(iIntim < iHosp, `いかく(${iIntim})が おもてなし(${iHosp})より先(発動の優先順位が低い)`);
});

// ----- 機構6: きみょうなくすり(監査 curious_medicine) -----
// 出典: master/abilities.json slug=curious-medicine effect_ja「戦闘に出た時、味方のポケモンの能力ランクの
//       変化をもとに戻す。上がったランクも戻る。(ダブルバトル用)『クリアボディ』などランクの低下を防ぐ
//       特性や『しろいきり』の効果を無視して元に戻す。」
//       reference/_ability_facts.json「・味方のランクが変化していないときは発動しない。」
//       「…きみょうなくすりを持つポケモン自身のランクは戻らない。」
test('E2-6-1: きみょうなくすりは登場時に味方のランクだけを0に戻す(クリアボディ/しろいきりを無視・自分と相手は戻らない)', () => {
  const E = build2v2();
  const ally = placeSlot(E, 'self', 0, 'メタグロス', null, { ability: 'クリアボディ' });
  placeSlot(E, 'self', 1, 'ケンタロス', null, { ability: '' });
  const foe0 = placeSlot(E, 'opp', 0, 'カメックス', null, { ability: '' });
  placeSlot(E, 'opp', 1, 'フシギバナ', null, { ability: '' });
  ally.rank = { atk: 2, def: 0, spatk: 2, spdef: 0, spd: -1, acc: 0, eva: 3 };
  ally.mist = true;                                   // しろいきり状態も無視する
  foe0.rank = { atk: 2, def: 0, spatk: 0, spdef: 0, spd: 1, acc: 0, eva: 0 };
  E.sides.self.bench = [benchEntry('ヤドキング(ガラル)', null)];
  E.sides.self.bench[0].ability = 'きみょうなくすり';
  assert.notEqual(E.attemptSwitch('self', 0, { slotIdx: 1 }), false, '枠1へ きみょうなくすり持ちが出られる');
  const holder = E.slotOf('self', 1);
  holder.rank.atk = -1;                               // 自分のランク(戻らないことの確認用)
  // ★E.slotOf(...).rank は vm(別レルム)のオブジェクト=deepEqualは prototype 違いで落ちる(既知の罠)。
  //   この場(Nodeレルム)のプレーンオブジェクトに詰め直してから比べる。
  const rankOf = (st) => { const r = st.rank || {}; const o = {};
    for (const k of ['atk','def','spatk','spdef','spd','acc','eva']) o[k] = Number(r[k] || 0); return o; };
  assert.deepEqual(rankOf(ally), { atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0, acc: 0, eva: 0 },
    `味方(self:0)の全ランクが0に戻る(上がった分も)。実際=${JSON.stringify(rankOf(ally))}`);
  assert.equal(holder.rank.atk, -1, 'きみょうなくすり持ち自身のランクは戻らない');
  assert.deepEqual(rankOf(foe0), { atk: 2, def: 0, spatk: 0, spdef: 0, spd: 1, acc: 0, eva: 0 },
    '相手側のランクは戻らない(対象は味方だけ)');
  const msgs = msgList(E.battleLog);
  assert.ok(msgs.some(m => m.includes('きみょうなくすり')), '発動ログが既存の型で出る');
  assert.ok(!msgs.some(m => m.includes('能力が下がらない')),
    'クリアボディ/しろいきりの無効化ログは出ない(無視して0に戻す)');
});

test('E2-6-2: 味方のランクが±0なら きみょうなくすり は発動しない', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', null, { ability: '' });   // ランクは全部0
  placeSlot(E, 'self', 1, 'ケンタロス', null, { ability: '' });
  placeSlot(E, 'opp', 0, 'カメックス', null, { ability: '' });
  placeSlot(E, 'opp', 1, 'フシギバナ', null, { ability: '' });
  E.sides.self.bench = [benchEntry('ヤドキング(ガラル)', null)];
  E.sides.self.bench[0].ability = 'きみょうなくすり';
  E.attemptSwitch('self', 0, { slotIdx: 1 });
  assert.ok(!msgList(E.battleLog).some(m => m.includes('きみょうなくすり')),
    '味方のランクが変化していないときは発動しない(ログも出ない)');
});

// ----- 機構7: いやしのこころ(監査 healer) -----
// 出典: ポケモンWiki『いやしのこころ』効果節「ターン終了時に、自分に隣接する味方の状態異常が50％
//       (スカーレット・バイオレットまでは30%) の確率で回復する。」
//       説明文節(Champions)「ターン終わりに 状態異常の味方を 50%の確率で治す。」
//       特性の仕様節「・こんらんなどの状態変化は治せない。」「・いやしのこころのポケモン自身の状態異常は治せない。」
//       「・どく/…のダメージ判定より前であるため、いやしのこころが発動するターンはこれらのダメージを受けない。」
test('E2-7-1: いやしのこころは味方の状態異常だけを50%で治し、自分とこんらんは治さない', () => {
  const N = 200;
  let allyCured = 0, selfCured = 0, confusionCleared = 0;
  for (let seed = 1; seed <= N; seed++){
    const E = build2v2();
    const healer = placeSlot(E, 'self', 0, 'タブンネ', 'tsuruginomai', { ability: 'いやしのこころ' });
    const ally = placeSlot(E, 'self', 1, 'カメックス', 'tsuruginomai', { ability: 'げきりゅう' });
    placeSlot(E, 'opp', 0, 'ケンタロス', 'tsuruginomai', { ability: 'どんかん' });
    placeSlot(E, 'opp', 1, 'ケンタロス', 'tsuruginomai', { ability: 'どんかん' });
    healer.status = 'burn';
    ally.status = 'burn';
    ally.confusion = 5;
    E.setRandom(mulberry32(seed));
    E.runTurn();
    if (String(ally.status) === 'none') allyCured++;
    if (String(healer.status) === 'none') selfCured++;
    if (Number(ally.confusion || 0) === 0) confusionCleared++;
  }
  // 50%なら期待値100・σ≈7.07 → ±3.5σ=75〜125(旧世代値30%の約60件はこの帯の外)
  assert.ok(allyCured >= 75 && allyCured <= 125,
    `味方が治る確率は50%の帯(75〜125/200)に入る。実際=${allyCured}/${N}`);
  assert.equal(selfCured, 0, `いやしのこころ本人の状態異常は1度も治らない。実際=${selfCured}/${N}`);
  assert.equal(confusionCleared, 0, `こんらん(状態変化)は治らない。実際=${confusionCleared}/${N}`);
});

test('E2-7-2: いやしのこころが治したターンは味方がスリップダメージを受けない(スリップより前の段)', () => {
  let cured = 0, curedButDamaged = 0, notCured = 0, notCuredUndamaged = 0;
  for (let seed = 3001; seed <= 3200; seed++){
    const E = build2v2();
    const ally = placeSlot(E, 'self', 0, 'カメックス', 'tsuruginomai', { ability: 'げきりゅう', hp: 100 });
    placeSlot(E, 'self', 1, 'タブンネ', 'tsuruginomai', { ability: 'いやしのこころ' });
    placeSlot(E, 'opp', 0, 'ケンタロス', 'tsuruginomai', { ability: 'どんかん' });
    placeSlot(E, 'opp', 1, 'ケンタロス', 'tsuruginomai', { ability: 'どんかん' });
    ally.status = 'poison';
    const before = ally.currentHp;
    E.setRandom(mulberry32(seed));
    E.runTurn();
    const damaged = ally.currentHp < before;
    if (String(ally.status) === 'none'){ cured++; if (damaged) curedButDamaged++; }
    else { notCured++; if (!damaged) notCuredUndamaged++; }
  }
  assert.ok(cured > 0, `治ったターンが在る(実際=${cured})`);
  assert.equal(curedButDamaged, 0, `治ったターンはどくダメージを受けない。実際=${curedButDamaged}/${cured}`);
  assert.equal(notCuredUndamaged, 0, `治らなかったターンはどくダメージを受ける。実際=${notCuredUndamaged}/${notCured}`);
});

// ----- 機構8: かがくのちから/レシーバー(監査 power_of_alchemy_receiver) -----
// 出典: ポケモンWiki『レシーバー』効果節「味方のポケモンがひんしになったとき、そのポケモンの特性と同じ
//       特性になる。」「コピーできない特性を持つ味方がひんしになったときは発動しない。」
//       ポケモンWiki『かがくのちから』特性の仕様節「場に出た時に発動する特性をコピーした場合、
//       コピーした直後にその特性の効果が発動する。」
//       master/abilities.json slug=receiver: コピー不可リストに『ばけのかわ』を含む30件。
test('E2-8-1: レシーバーは倒れた味方の特性を引き継ぎ(コピー不可なら不発)、登場特性ならその場で発動する', () => {
  const scene = (allyAbility, seed) => {
    const E = build2v2();
    const receiver = placeSlot(E, 'self', 0, 'ナゲツケサル', 'kiaidame', { ability: 'レシーバー' });
    const ally = placeSlot(E, 'self', 1, 'フシギバナ', 'kiaidame', { hp: 1, ability: allyAbility });
    const oppA = placeSlot(E, 'opp', 0, 'ケンタロス', 'kiaidame', { ability: '' });
    const oppB = placeSlot(E, 'opp', 1, 'リザードン', 'hataku', { ability: '' });
    E.setRandom(mulberry32(seed == null ? 3 : seed));
    E.runTurn();
    return { E, receiver, ally, oppA, oppB };
  };
  // コピー可(ようりょくそ)
  const ok = scene('ようりょくそ');
  assert.equal(ok.ally.fainted, true, '前提: 味方がひんしになっている');
  assert.equal(ok.E.sideAbility(ok.receiver), 'ようりょくそ', '倒れた味方の特性を引き継ぐ');
  // コピー不可(ばけのかわ=master のコピー不可リスト所載)
  const ng = scene('ばけのかわ');
  assert.equal(ng.ally.fainted, true, '前提: 不可の側でも味方がひんしになっている');
  assert.equal(ng.E.sideAbility(ng.receiver), 'レシーバー', 'コピー不可の特性は引き継がない(レシーバーのまま)');
  // 登場特性(いかく)をコピーしたら、その場で相手2枠のこうげきが-1
  const intim = scene('いかく', 11);
  assert.equal(intim.E.sideAbility(intim.receiver), 'いかく', 'いかくを引き継ぐ');
  assert.equal(intim.oppA.rank.atk, -1, 'コピー直後にいかくが発動して opp:0 のこうげき-1');
  assert.equal(intim.oppB.rank.atk, -1, '同じく opp:1 も-1(ダブルのいかくは相手全体)');
});

test('E2-8-2: 相手が倒れてもレシーバーは引き継がない(味方限定)', () => {
  const E = build2v2();
  const receiver = placeSlot(E, 'self', 0, 'ナゲツケサル', 'kiaidame', { ability: 'レシーバー' });
  placeSlot(E, 'self', 1, 'リザードン', 'hataku', { ability: '' });
  placeSlot(E, 'opp', 0, 'ケンタロス', 'kiaidame', { ability: '' });
  const oppB = placeSlot(E, 'opp', 1, 'フシギバナ', 'kiaidame', { hp: 1, ability: 'ようりょくそ' });
  E.setRandom(mulberry32(5));
  E.runTurn();
  assert.equal(oppB.fainted, true, '前提: 相手(opp:1)がひんしになっている');
  assert.equal(E.sideAbility(receiver), 'レシーバー', '相手が倒れても引き継がない');
});

// ----- 機構9: きょうせい(監査 symbiosis) -----
// 出典: ポケモンWiki『きょうせい』効果節「味方のポケモンが持ち物を消費した際、自身の持ち物をその味方に渡す。」
//       特性の仕様節「きょうせいによって渡した道具が消費できる条件を満たしている場合、即座に消費する。」
//       「味方がはたきおとす・ふしょくガス・やきつくすを受けて持ち物を失った場合、きょうせいは発動しない。」
test('E2-9-1: きょうせいは味方が道具を消費した時だけ自分の道具を渡す(失った時・相手の消費では渡さない)', () => {
  const fixture = (oppMove) => {
    const E = build2v2();
    const ally = placeSlot(E, 'self', 0, 'カメックス', 'tsuruginomai');
    const symb = placeSlot(E, 'self', 1, 'ヤレユータン', 'tsuruginomai', { ability: 'きょうせい' });
    const o0 = placeSlot(E, 'opp', 0, 'フシギバナ', oppMove || 'tsuruginomai');
    placeSlot(E, 'opp', 1, 'フシギバナ', 'tsuruginomai');
    return { E, ally, symb, o0 };
  };
  // (a) 味方がオボンのみを消費 → たべのこしが渡る
  {
    const { E, ally, symb } = fixture();
    ally.item = 'berry_sitrus';
    ally.currentHp = Math.floor(E.realStat(ally, 'hp') / 2);
    symb.item = 'leftovers';
    E.setRandom(mulberry32(101));
    E.runTurn();
    assert.equal(String(ally.item), 'leftovers', `味方の持ち物が leftovers になる(実際=${ally.item})`);
    assert.equal(String(symb.item), '', `きょうせい側の持ち物は無くなる(実際=${symb.item})`);
    // E4-B(2026-09-12): 実機文言に置き換えた。出典= ポケモンWiki『きょうせい』特性の仕様節
    //   「「<きょうせいのポケモン>は <道具名>を <味方のポケモン>に 持たせた!」というメッセージが出る。」
    assert.ok(msgList(E.battleLog).some(m => /^.+ は .+を .+ に 持たせた！$/.test(m)),
      `発動ログが実機文言(「◯◯ は □□を △△ に 持たせた！」)で出る`);
  }
  // (b) はたきおとすで「失った」時は発動しない(consumeItemを通らない=構造的に除外)
  {
    const { E, ally, symb } = fixture('hatakiotosu');
    ally.item = 'leftovers';
    symb.item = 'berry_sitrus';     // HP満タン=自分では消費しない
    E.setRandom(mulberry32(104));
    E.runTurn();
    assert.ok(msgList(E.battleLog).some(m => m.includes('はたきおとした')), '前提: はたきおとすが決まる');
    assert.equal(String(symb.item), 'berry_sitrus', 'きょうせい側の持ち物は残る');
    assert.notEqual(String(ally.item), 'berry_sitrus', '味方は受け取らない');
  }
  // (c) 相手側の消費では発動しない(味方限定)
  {
    const { E, symb, o0 } = fixture();
    o0.item = 'berry_sitrus';
    o0.currentHp = Math.floor(E.realStat(o0, 'hp') / 2);
    symb.item = 'leftovers';
    E.setRandom(mulberry32(105));
    E.runTurn();
    assert.equal(String(symb.item), 'leftovers', '相手の消費では渡さない');
    assert.notEqual(String(o0.item), 'leftovers', '相手にきょうせいの持ち物は渡らない');
  }
});

test('E2-9-2: きょうせいで渡した道具は条件を満たしていれば即座に消費される', () => {
  const E = build2v2();
  const ally = placeSlot(E, 'self', 0, 'カメックス', 'tsuruginomai');
  const symb = placeSlot(E, 'self', 1, 'ヤレユータン', 'tsuruginomai', { ability: 'きょうせい' });
  placeSlot(E, 'opp', 0, 'フシギバナ', 'tsuruginomai');
  placeSlot(E, 'opp', 1, 'フシギバナ', 'tsuruginomai');
  ally.item = 'berry_sitrus';
  ally.currentHp = 1;
  symb.item = 'berry_sitrus';
  const max = E.realStat(ally, 'hp');
  assert.ok(1 + Math.floor(max / 4) <= Math.floor(max / 2),
    `前提: 1個目の回復後もHPは1/2以下(max=${max})=2個目の発動条件を満たす`);
  E.setRandom(mulberry32(103));
  E.runTurn();
  const heals = msgList(E.battleLog).filter(m => /オボンのみで HPを \d+ 回復した/.test(m));
  assert.equal(heals.length, 2, `自分のぶん+渡されたぶんの2回消費する。実際=${JSON.stringify(heals)}`);
  assert.equal(String(ally.item), '', '受け取ったオボンのみは手元に残らない(即座に消費)');
  assert.equal(String(symb.item), '', 'きょうせい側の持ち物は渡して無くなる');
});

// ----- 機構10: スイートベール/アロマベール/フラワーベール(監査 veils) -----
// 出典: ポケモンWiki『スイートベール』効果節「自分を含めた味方のポケモンはねむり・ねむけ状態にならなくなる。」
//       『アロマベール』効果節「自分を含めた味方のポケモンは、以下の状態変化にならなくなる。」
//         →「メロメロ」「アンコール」「いちゃもん」「かなしばり」「ちょうはつ」「かいふくふうじ」
//       『フラワーベール』効果節「味方の場にいるすべてのくさタイプのポケモンは、他のポケモンからランク補正を
//         下げられず、状態異常・ねむけにもされない。」
//         同 特性の仕様節「自発的にランクを下げたり…に対しては発動しない。」→「リーフストームなど…」
function veilScene(opts) {
  const E = build2v2();
  placeSlot(E, 'self', 0, opts.attacker, opts.moveKey,
    { ability: opts.attackerAbility || '', targetChoice: { side: 'opp', idx: 0 } });
  placeSlot(E, 'self', 1, null, null);
  const victim = placeSlot(E, 'opp', 0, opts.victim, null, { ability: opts.victimAbility || '' });
  const ally = placeSlot(E, 'opp', 1, opts.ally, null, { ability: opts.allyAbility });
  if (opts.attackerGender) E.slotOf('self', 0).gender = opts.attackerGender;
  if (opts.victimGender) victim.gender = opts.victimGender;
  if (opts.allyGender) ally.gender = opts.allyGender;
  E.setRandom(mulberry32(opts.seed == null ? 1 : opts.seed));
  E.runTurn();
  return { E, victim, ally, msgs: msgList(E.battleLog) };
}

test('E2-10-1: スイートベールの味方はねむり・ねむけ(あくび)にならない', () => {
  const base = { attacker: 'カメックス', victim: 'リザードン', victimAbility: 'もうか', ally: 'ペロリーム' };
  // ねむりごな(命中75): 対照が当たる seed を先に探してから同じ seed をベール有りに使う
  let seed = null, ctrlStatus = null;
  for (let s = 1; s <= 200 && seed == null; s++){
    const r = veilScene(Object.assign({}, base, { moveKey: 'nemurigona', allyAbility: 'かるわざ', seed: s }));
    if (String(r.victim.status) === 'sleep'){ seed = s; ctrlStatus = String(r.victim.status); }
  }
  assert.ok(seed, '対照(ベール無し)でねむりごなが当たる seed が在る');
  assert.equal(ctrlStatus, 'sleep', '対照ではねむる');
  const veil = veilScene(Object.assign({}, base, { moveKey: 'nemurigona', allyAbility: 'スイートベール', seed }));
  assert.equal(String(veil.victim.status), 'none',
    `味方のスイートベールでねむらない(実際=${veil.victim.status} / ログ=${JSON.stringify(veil.msgs)})`);
  // あくび(ねむけ)=命中判定なし
  const ctrlY = veilScene(Object.assign({}, base, { moveKey: 'akubi', allyAbility: 'かるわざ' }));
  assert.ok(ctrlY.victim.pendingStatus && String(ctrlY.victim.pendingStatus.code) === 'sleep',
    `対照ではねむけが入る(ログ=${JSON.stringify(ctrlY.msgs)})`);
  const veilY = veilScene(Object.assign({}, base, { moveKey: 'akubi', allyAbility: 'スイートベール' }));
  assert.ok(!veilY.victim.pendingStatus,
    `味方のスイートベールでねむけにもならない(ログ=${JSON.stringify(veilY.msgs)})`);
});

test('E2-10-2: アロマベールの味方はちょうはつ・いちゃもん・メロメロにならない', () => {
  const base = { attacker: 'カメックス', victim: 'リザードン', victimAbility: 'もうか', ally: 'フレフワン' };
  // ちょうはつ / いちゃもん
  const cases = [
    { moveKey: 'chouhatsu', label: 'ちょうはつ', landed: v => (v.tauntTurns || 0) > 0 },
    { moveKey: 'ichamon', label: 'いちゃもん', landed: v => v.tormented === true },
  ];
  for (const c of cases){
    const ctrl = veilScene(Object.assign({}, base, { moveKey: c.moveKey, allyAbility: 'いやしのこころ' }));
    assert.ok(c.landed(ctrl.victim), `対照では ${c.label} が入る(ログ=${JSON.stringify(ctrl.msgs)})`);
    const veil = veilScene(Object.assign({}, base, { moveKey: c.moveKey, allyAbility: 'アロマベール' }));
    assert.ok(!c.landed(veil.victim),
      `味方のアロマベールで ${c.label} を防ぐ(ログ=${JSON.stringify(veil.msgs)})`);
    assert.ok(veil.msgs.some(m => m.includes('アロマベール')),
      `既存の型「◯◯ は アロマベールで △△に ならない！」が出る(ログ=${JSON.stringify(veil.msgs)})`);
  }
  // メロメロ(異性同士で成立)
  const mero = { attacker: 'カメックス', attackerGender: '♂', moveKey: 'meromero',
                 victim: 'リザードン', victimAbility: 'もうか', victimGender: '♀',
                 ally: 'フレフワン', allyGender: '♀' };
  const ctrlM = veilScene(Object.assign({}, mero, { allyAbility: 'いやしのこころ' }));
  assert.equal(ctrlM.victim.attracted, true, `対照ではメロメロになる(ログ=${JSON.stringify(ctrlM.msgs)})`);
  const veilM = veilScene(Object.assign({}, mero, { allyAbility: 'アロマベール' }));
  assert.notEqual(veilM.victim.attracted, true,
    `味方のアロマベールでメロメロにならない(ログ=${JSON.stringify(veilM.msgs)})`);
});

test('E2-10-3: フラワーベールの味方(くさタイプ)は相手からのランク低下・状態異常を受けないが、自傷は防がない', () => {
  const base = { attacker: 'カメックス', victim: 'フシギバナ', victimAbility: 'しんりょく',
                 ally: 'フラージェス(あかいはな)' };
  // (a) 相手の技によるランク低下(あまえる=こうげき-2)
  const ctrlA = veilScene(Object.assign({}, base, { moveKey: 'amaeru', allyAbility: 'きょうせい' }));
  assert.equal(ctrlA.victim.rank.atk, -2, 'あまえるは こうげき-2(対照)');
  const veilA = veilScene(Object.assign({}, base, { moveKey: 'amaeru', allyAbility: 'フラワーベール' }));
  assert.equal(veilA.victim.rank.atk, 0,
    `くさタイプの味方はランクを下げられない(実際=${veilA.victim.rank.atk} / ログ=${JSON.stringify(veilA.msgs)})`);
  assert.ok(veilA.msgs.some(m => m.includes('フラワーベール') && m.includes('能力が下がらない')),
    `既存の型「◯◯ は フラワーベールで 能力が下がらない！」が出る(ログ=${JSON.stringify(veilA.msgs)})`);
  // (b) 相手の技による状態異常(でんじは=まひ)
  let seed = null;
  for (let s = 1; s <= 200 && seed == null; s++){
    const r = veilScene(Object.assign({}, base, { moveKey: 'denjiha', allyAbility: 'きょうせい', seed: s }));
    if (String(r.victim.status) === 'paralysis') seed = s;
  }
  assert.ok(seed, '対照(ベール無し)で でんじは が当たる seed が在る');
  const veilB = veilScene(Object.assign({}, base, { moveKey: 'denjiha', allyAbility: 'フラワーベール', seed }));
  assert.equal(String(veilB.victim.status), 'none',
    `くさタイプの味方は状態異常にもならない(実際=${veilB.victim.status} / ログ=${JSON.stringify(veilB.msgs)})`);
  // (c) 自分の技による自傷のランク低下は防がない(リーフストーム=とくこう-2)
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null, { ability: 'げきりゅう' });
  placeSlot(E, 'self', 1, null, null);
  const shooter = placeSlot(E, 'opp', 0, 'フシギバナ', 'riifusutoomu',
    { ability: 'しんりょく', targetChoice: { side: 'self', idx: 0 } });
  placeSlot(E, 'opp', 1, 'フラージェス(あかいはな)', null, { ability: 'フラワーベール' });
  E.setRandom(mulberry32(1));
  E.runTurn();
  assert.equal(shooter.rank.spatk, -2,
    `自発的なランク低下(リーフストーム)は防がない(実際=${shooter.rank.spatk})`);
});

// ----- E2 付随: ものまねハーブの全枠化(E1残件・指示書「前提」) -----
// 出典: items_database.js宣言 / Bulbapedia "Mirror Herb"(相手の能力上昇をコピーして消費)。
// 旧実装は slotOf('self',0)/slotOf('opp',0) 決め打ちで、ダブルでは「味方」の上昇をコピーする実バグだった。
test('E2-x-1: ものまねハーブは相手枠の上昇だけをコピーする(味方の上昇はコピーしない)', () => {
  // (a) 相手の枠1(idx=1)が持っていても、相手側の上昇をコピーする
  const E = build2v2();
  const riser = placeSlot(E, 'self', 0, 'カメックス', 'tsuruginomai');   // つるぎのまい=こうげき+2
  placeSlot(E, 'self', 1, null, null);
  placeSlot(E, 'opp', 0, 'フシギバナ', null);
  const herb1 = placeSlot(E, 'opp', 1, 'ケンタロス', null, { ability: '' });
  herb1.item = 'mirror_herb';
  E.setRandom(mulberry32(7));
  E.runTurn();
  assert.equal(riser.rank.atk, 2, '前提: つるぎのまいで こうげき+2');
  assert.equal(herb1.rank.atk, 2,
    `相手の右枠(opp:1)のものまねハーブも同じ分だけ上がる(実際=${herb1.rank.atk})`);
  assert.equal(String(herb1.item), '', 'ものまねハーブは消費される');

  // (b) 「味方」の上昇はコピーしない(旧実装のバグ: target=self:1 の時に self:0 を相手と誤認していた)
  const E2 = build2v2();
  placeSlot(E2, 'self', 0, 'カメックス', null);
  const allyRiser = placeSlot(E2, 'self', 1, 'フシギバナ', 'tsuruginomai');
  placeSlot(E2, 'opp', 0, null, null);
  placeSlot(E2, 'opp', 1, null, null);
  const herbAlly = E2.slotOf('self', 0);
  herbAlly.item = 'mirror_herb';
  E2.setRandom(mulberry32(7));
  E2.runTurn();
  assert.equal(allyRiser.rank.atk, 2, '前提: 味方(self:1)が こうげき+2');
  assert.equal(herbAlly.rank.atk, 0,
    `味方の上昇はコピーしない(実際=${herbAlly.rank.atk})`);
  assert.equal(String(herbAlly.item), 'mirror_herb', 'ものまねハーブは消費されない');
});

// ============================================================================
// E3(2026-09-12・spec_e3_ally_moves.md): ダブル専用の技
//   機構1 ワイドガード(側の欄 sideProtect / kind=範囲まもり)
//   機構2 ファストガード(同じ側の欄・先制技だけ)
//   機構3 サイドチェンジ(位置入替)
// ★出典つきの主張(Wiki逐語)の検査は tools/_doubles_audit/wide_guard_quick_guard_test.js /
//   ally_switch_test.js(監査=期待値は権威ソース)が持つ。ここは「実装の土台が壊れていないか」
//   (側の欄のアクセサ・ターン境界・解除・入替の不変条件・予約された行動の追随)を見る。
// ============================================================================

// ===== E3-1: 側のまもりは「側の欄」=枠1が張っても枠0の味方が守られる =====
// 出典: ポケモンWiki「ワイドガード」効果「そのターンの間、味方全体を複数のポケモンが対象になる技から守る。」
test('E3-1: 枠1(右)が張ったワイドガードで枠0(左)の味方も範囲技から守られる', () => {
  const E = build2v2();
  const ally = placeSlot(E, 'self', 0, 'カメックス', null);              // 守られるべき味方(行動しない)
  placeSlot(E, 'self', 1, 'フシギバナ', 'waidogaado');                   // ★枠1が張る(側の欄アクセサ経由)
  placeSlot(E, 'opp', 0, 'ケンタロス', 'jishin');                        // 相手の範囲技
  placeSlot(E, 'opp', 1, null, null);
  const hp0 = ally.currentHp;
  E.setRandom(mulberry32(5));
  E.runTurn();
  assert.equal(ally.currentHp, hp0,
    `枠1が張っても側全体が守られる(枠0のHP ${hp0}→${ally.currentHp})\n` + msgList(E.battleLog).join('\n'));
});

// ===== E3-2: ファストガードは優先度0の技を防がない(過剰ブロックの負のコントロール) =====
// 出典: ポケモンWiki「ファストガード」効果「そのターンの間、味方全体を優先度が高いわざから守る。」
test('E3-2: ファストガード中でも優先度0の単体技は味方に通る', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'fasutogaado');
  const ally = placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ケンタロス', 'hataku', { targetChoice: { side: 'self', idx: 1 } });
  placeSlot(E, 'opp', 1, null, null);
  const hp0 = ally.currentHp;
  E.setRandom(mulberry32(5));
  E.runTurn();
  assert.ok(ally.currentHp < hp0,
    `優先度0の技は防がない(味方HP ${hp0}→${ally.currentHp})\n` + msgList(E.battleLog).join('\n'));
});

// ===== E3-3: 側のまもりは「そのターンの間」だけ=次のターンには残らない =====
test('E3-3: ワイドガードは次のターンには残らない(ターン境界でクリア)', () => {
  const E = build2v2();
  const user = placeSlot(E, 'self', 0, 'フシギバナ', 'waidogaado');
  placeSlot(E, 'self', 1, null, null);
  placeSlot(E, 'opp', 0, 'ケンタロス', 'jishin');
  placeSlot(E, 'opp', 1, null, null);
  E.setRandom(mulberry32(5));
  E.runTurn();                                   // 1ターン目: 守る
  const hp1 = user.currentHp;
  assert.equal(hp1, E.realStat(user, 'hp'), '1ターン目は無傷');
  user.moves = []; user.selectedMoveIdx = null;   // 2ターン目はワイドガードを使わない
  E.runTurn();
  assert.ok(user.currentHp < hp1,
    `2ターン目はワイドガードが残っていないのでじしんが通る(HP ${hp1}→${user.currentHp})\n` + msgList(E.battleLog).join('\n'));
});

// ===== E3-4: フェイントは側のまもりを取り除く(1体に当たれば味方全員ぶん解除) =====
// 出典: ポケモンWiki「ワイドガード」技の仕様「フェイント/…を受けるとワイドガードは取り除かれる。」
//       「1体のポケモンに当たればその味方全員のワイドガード状態が解除される。」
test('E3-4: フェイントでワイドガードが解除され、後から来た範囲技が味方にも通る', () => {
  const E = build2v2();
  const user = placeSlot(E, 'self', 0, 'フシギバナ', 'waidogaado');      // 優先度+3
  const ally = placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ケンタロス', 'feinto', { targetChoice: { side: 'self', idx: 0 } });   // 優先度+2
  placeSlot(E, 'opp', 1, 'カメックス', 'jishin');                        // 優先度0(フェイントの後)
  const allyHp0 = ally.currentHp;
  E.setRandom(mulberry32(9));
  E.runTurn();
  assert.ok(ally.currentHp < allyHp0,
    `フェイントを1体が受けたら味方全員ぶんのワイドガードが消える(味方HP ${allyHp0}→${ally.currentHp})\n`
    + msgList(E.battleLog).join('\n'));
  assert.equal(user.sideProtect, null, '側の欄(sideProtect)が消えている');
});

// ===== E3-5: 位置入替のあとも「予約した個体」が自分の行動をする =====
// 入替は枠オブジェクトの中身の交換なので、予約(Intent)を枠番号のまま引くと別個体の行動になる。
test('E3-5: サイドチェンジの後、まだ行動していない味方は自分の技を自分で出す', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', 'hataku', { targetChoice: { side: 'opp', idx: 0 } });
  placeSlot(E, 'self', 1, 'フーディン', 'saidochenji');   // 優先度+2=先に入替
  placeSlot(E, 'opp', 0, 'ケンタロス', null);
  placeSlot(E, 'opp', 1, null, null);
  E.setRandom(mulberry32(11));
  E.runTurn();
  const log = msgList(E.battleLog);
  assert.equal(E.slotOf('self', 0).poke.name, 'フーディン', '前提: 入替が成立している');
  assert.ok(log.some(m => /^カメックス の はたく！/.test(m)),
    `はたくを出したのは予約した個体(カメックス)であるべき\n` + log.join('\n'));
  assert.ok(!log.some(m => /^フーディン の はたく！/.test(m)),
    `入替で枠に来たフーディンが味方の技を出してはいけない\n` + log.join('\n'));
});

// ===== E3-6: 入替で「対象位置」に使用者自身が来た技は失敗する =====
// 出典: ポケモンWiki「サイドチェンジ」技の仕様「…自分以外の1体が対象の技/味方1体が対象の技の対象位置に
//   技の使用者自身が移動していた場合、その技は失敗する。」(Wikiの例=いやしのはどうと同じ形)
test('E3-6: 味方が使用者の位置へ撃った味方1体対象の技は、入替で自分自身の位置になり失敗する', () => {
  const E = build2v2();
  const ally = placeSlot(E, 'self', 0, 'フレフワン', 'aromamisuto', { targetChoice: { side: 'self', idx: 1 } });
  placeSlot(E, 'self', 1, 'フーディン', 'saidochenji');
  placeSlot(E, 'opp', 0, 'ケンタロス', null);
  placeSlot(E, 'opp', 1, null, null);
  E.setRandom(mulberry32(11));
  E.runTurn();
  const log = msgList(E.battleLog);
  assert.equal(E.slotOf('self', 0).poke.name, 'フーディン', '前提: 入替が成立している');
  assert.equal(ally.rank.spdef, 0,
    `対象位置に自分自身が来たのでアロマミストは失敗する(とくぼう=${ally.rank.spdef})\n` + log.join('\n'));
  assert.ok(log.some(m => /アロマミスト！ しかし うまく きまらなかった！$/.test(m)),
    `既存の失敗文言で失敗する\n` + log.join('\n'));
});

// ===== E3-7: 入替の不変条件(slots[0] === sides[s] と 側の欄のアクセサ)が壊れていない =====
test('E3-7: サイドチェンジの後も枠0===側のオブジェクトで、枠1の側の欄アクセサが生きている', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null);
  placeSlot(E, 'self', 1, 'フーディン', 'saidochenji');
  placeSlot(E, 'opp', 0, 'ケンタロス', null);
  placeSlot(E, 'opp', 1, null, null);
  E.setRandom(mulberry32(11));
  E.runTurn();
  assert.equal(E.slotOf('self', 0).poke.name, 'フーディン', '前提: 入替が成立している');
  assert.equal(E.sides.self.slots[0], E.sides.self, '枠0は側のオブジェクトそのもの(自己修復で枠1が消える条件を踏んでいない)');
  assert.equal(E.sides.self.slots.length, 2, '枠が2つのまま残っている');
  // 側の欄(壁)のアクセサ: 枠1に書くと枠0(=側)でも読める
  E.slotOf('self', 1).reflect = true;
  assert.equal(E.sides.self.reflect, true, '枠1の側の欄アクセサが sides[s] を指したまま');
  E.slotOf('self', 1).reflect = false;
  // 個体の欄(HP)は枠ごとに独立したまま
  assert.notEqual(E.slotOf('self', 0), E.slotOf('self', 1), '枠0と枠1は別オブジェクトのまま');
});

// ============================================================================
// E3 追加(2026-09-12・オンライン ロックステップ監査): forEachSlotItemOrder の正準化
//   旧実装は ①シングル枝が fn('self',0); fn('opp',0) の側ラベル決め打ち
//            ②ダブル枝の同速タイが安定ソート=入力順(self先)
//   のどちらも「側ラベル依存」で、A/Bのクライアント(self/oppが鏡写し)で処理順が逆になり
//   この順を通る乱数点(ターン終了のしゅうかく/ムラっけ 等)が desync していた。
//   正しくは canonSides()/canonSlots()(=ホスト基準の正準順)で回す。
// ★ここでは「__rbCanonFirst='opp' を立てた鏡写しのエンジン」と「立てないエンジン」で、
//   同じ seed から★同じ実体★(鏡写しで対応する枠)が同じ乱数を引くことを確認する。
// ============================================================================
// vm(別レルム)の window へ触るための入口。エンジン関数は vm 内で作られているので、その Function
// コンストラクタ経由で vm の globalThis を取れる(_sim_engine.js は window を公開していないため)。
function vmWindowOf(E) {
  return E.runTurn.constructor('return this')().window;
}
// 同速(同種)の2体に ムラっけ(ターン終了に乱数2回)を持たせて1ターン回し、両者のランクを返す。
// canonFirst='opp' を立てると canonSides() が ['opp','self'] になる=鏡写しのクライアント側。
function moodyRanksAfterTurn(canonFirst) {
  const E = buildEngine();
  const win = vmWindowOf(E);
  if (canonFirst) win.__rbCanonFirst = canonFirst; else delete win.__rbCanonFirst;
  E.setFormat({ slotsPerSide: 1 });
  for (const s of ['self', 'opp']) {
    const st = E.slotOf(s, 0);
    st.poke = pokeByName('フシギバナ');      // 同種=素の素早さが必ず同値=タイを踏む
    st.ability = 'ムラっけ';
    st.moves = []; st.selectedMoveIdx = null;
    st.currentHp = E.realStat(st, 'hp');
    st.fainted = false;
  }
  E.setRandom(mulberry32(2026));
  E.runTurn();
  const pick = st => ({ atk: st.rank.atk, def: st.rank.def, spatk: st.rank.spatk, spdef: st.rank.spdef, spd: st.rank.spd });
  return { self: pick(E.slotOf('self', 0)), opp: pick(E.slotOf('opp', 0)) };
}

test('E3-canon-1: ムラっけの乱数消費順が側ラベルに依存しない(鏡写しの2クライアントで同じ実体が同じ結果)', () => {
  const A = moodyRanksAfterTurn(null);     // クライアントA(ホスト側=正準の先頭が self)
  const B = moodyRanksAfterTurn('opp');    // クライアントB(鏡写し=自分から見た opp がホスト)
  // 非自明であることの確認(2体の結果が同じなら、この検査は何も言っていない)
  assert.notDeepEqual(A.self, A.opp, '前提: 先に引いた方と後に引いた方で結果が違う(=順序が観測できる)');
  // 鏡写しの対応: Aの self ⇔ Bの opp が同じ実体。
  assert.deepEqual(B.opp, A.self,
    `鏡写しの相手枠(=Aの自分)が同じ乱数を引くはず A.self=${JSON.stringify(A.self)} B.opp=${JSON.stringify(B.opp)}`);
  assert.deepEqual(B.self, A.opp,
    `鏡写しの自分枠(=Aの相手)が同じ乱数を引くはず A.opp=${JSON.stringify(A.opp)} B.self=${JSON.stringify(B.self)}`);
});

// ===== E4-A: deferEntry(同時入場の登場効果=全員出揃ってからすばやさ順・順は1回決めて固定) =====
// 2026-09-12・指示書 spec_e4_defer_entry_and_messages.md A / 設計_ダブルバトル_2026-09-07.md §5(台帳#14/#15/#66)
//   「同時入場の登場効果=全員出揃ってから すばやさ順・順は1回決めて固定」
//   「入場者ごとに switch_in → entry_hazard を逐次で回し、全員が出揃ってから…entry_ability」
// 順序の鍵は orderSlotsBySpeedForPhase(効果すばやさ降順・トリックルームで反転・同速は canonSlots)。
// いかく持ちを両側の控えに置き、どちらの「いかく」の行が先に出るかで順序を観測する。
function intimidateBench(pokeName) {
  const e = benchEntry(pokeName, null);
  e.ability = 'いかく';   // BENCH_FIELDS に 'ability' が入っているので入場時に枠へ引き継がれる
  return e;
}
// 両側の枠1が同時にひんし → ターン終了で両側が死に出し。控えは いかく持ち2体(速度差あり)。
function dieOutBothSides(trickRoom) {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', null);
  placeSlot(E, 'self', 1, 'カメックス', null, { fainted: true });
  placeSlot(E, 'opp', 0, 'フシギバナ', null);
  placeSlot(E, 'opp', 1, 'カメックス', null, { fainted: true });
  E.sides.self.bench = [intimidateBench('ゲンガー')];    // すばやさ110(速い)
  E.sides.opp.bench = [intimidateBench('カビゴン')];     // すばやさ30(遅い)
  if (trickRoom) E.env.trickRoom = true;
  E.setRandom(mulberry32(7));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  return {
    E, msgs,
    fast: msgs.findIndex(m => /^ゲンガー の いかくで /.test(m)),
    slow: msgs.findIndex(m => /^相手の カビゴン の いかくで /.test(m)),
  };
}

test('E4-A-1: 両側同時の死に出しで いかく持ち2体が出る→速い方のいかくが先(全員出揃ってからすばやさ順)', () => {
  const r = dieOutBothSides(false);
  assert.equal(r.E.slotOf('self', 1).poke.name, 'ゲンガー', '前提: self:1 が ゲンガー で補充される');
  assert.equal(r.E.slotOf('opp', 1).poke.name, 'カビゴン', '前提: opp:1 が カビゴン で補充される');
  assert.ok(r.fast >= 0 && r.slow >= 0, `両方のいかくの行が出る(実際=${JSON.stringify(r.msgs)})`);
  assert.ok(r.fast < r.slow,
    `速い ゲンガー(110) のいかくが 遅い カビゴン(30) より先(実際: fast=${r.fast}行目 / slow=${r.slow}行目)`);
  // 「全員出揃ってから」= 2体とも場に出た後に登場効果が回る。=2本の「場に出た」行が2本のいかく行より前。
  const lastEntry = Math.max(
    r.msgs.findIndex(m => /代わりに ゲンガー が 場に出た！$/.test(m)),
    r.msgs.findIndex(m => /代わりに 相手の カビゴン が 場に出た！$/.test(m)));
  assert.ok(lastEntry >= 0 && lastEntry < r.fast,
    `2体とも出揃ってから登場効果が回る(最後の登場行=${lastEntry} / 最初のいかく=${r.fast})`);
});

test('E4-A-2: トリックルーム下でも同じ順序(登場特性の順は補正抜きの素早さ実数値=場の状態を考慮しない・Wiki おもてなし)', () => {
  const r = dieOutBothSides(true);
  assert.ok(r.fast >= 0 && r.slow >= 0, `両方のいかくの行が出る(実際=${JSON.stringify(r.msgs)})`);
  assert.ok(r.fast < r.slow,
    `トリックルームでも速い ゲンガー(110) が先(実際: fast=${r.fast}行目 / slow=${r.slow}行目)`);
});

test('E4-A-3: deferEntry 未指定の attemptSwitch は従来どおりその場で登場効果を発動する(既存呼び出しは無変更)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', null);
  placeSlot(E, 'self', 1, 'カメックス', null, { fainted: true });
  placeSlot(E, 'opp', 0, 'フシギバナ', null);
  placeSlot(E, 'opp', 1, null, null);
  E.sides.self.bench = [intimidateBench('ゲンガー')];
  const from = E.battleLog.length;
  E.setRandom(mulberry32(3));
  assert.equal(E.attemptSwitch('self', 0, { ignoreTrapping: true, faintReplace: true, slotIdx: 1 }), true,
    '交代自体は成功する');
  const msgs = msgList(E.battleLog).slice(from);
  assert.ok(msgs.some(m => /^ゲンガー の いかくで /.test(m)),
    `deferEntry を渡さなければ attemptSwitch の中でいかくが発動する(実際=${JSON.stringify(msgs)})`);
  assert.equal(E.flushDeferredEntries(), 0, '積まれていないので flush は何もしない(0件)');
});

test('E4-A-4: シングルで両者が同時にひんし→「場に出た」行は従来の side 順のまま・登場効果だけがすばやさ順', () => {
  // ★シングルの絶対条件(sim 862/0・sim_test_report.html の diff 0)は別ゲートで担保済み。
  //   ここは「相討ち(両者同時ひんし)」という既存テスト母集団に無い配置での挙動を固定する。
  const E = buildEngine();
  E.setFormat({ slotsPerSide: 1 });
  // 相討ちの作り方: 両者ともHP1のどく状態で、ダメージの出ない変化技(つるぎのまい)を撃たせる。
  // ターン終了のスリップで両者が同時にひんしになり、そのまま両側の死に出しへ入る。
  const put = (side, name) => {
    const st = E.slotOf(side, 0);
    st.poke = pokeByName(name); st.moves = [data.WAZA_MAP.tsuruginomai]; st.selectedMoveIdx = 0;
    st.currentHp = 1; st.fainted = false; st.status = 'poison';
    return st;
  };
  put('self', 'カメックス');
  put('opp', 'カメックス');
  E.sides.self.bench = [intimidateBench('カビゴン')];    // 自分側=遅い(30)
  E.sides.opp.bench = [intimidateBench('ゲンガー')];     // 相手側=速い(110)
  E.setRandom(mulberry32(11));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  const entSelf = msgs.findIndex(m => /代わりに カビゴン が 場に出た！$/.test(m));
  const entOpp = msgs.findIndex(m => /代わりに 相手の ゲンガー が 場に出た！$/.test(m));
  assert.ok(entSelf >= 0 && entOpp >= 0, `両側とも死に出しの行が出る(実際=${JSON.stringify(msgs)})`);
  assert.ok(entSelf < entOpp, '入場そのものの順は従来どおり self→opp(activeSides順)で不変');
  const iSelf = msgs.findIndex(m => /^カビゴン の いかくで /.test(m));
  const iOpp = msgs.findIndex(m => /^相手の ゲンガー の いかくで /.test(m));
  assert.ok(iSelf >= 0 && iOpp >= 0, `両方のいかくの行が出る(実際=${JSON.stringify(msgs)})`);
  assert.ok(entOpp < iOpp && entOpp < iSelf, '2体とも出揃ってから登場効果が回る');
  assert.ok(iOpp < iSelf,
    `登場効果は側の順ではなくすばやさ順(速い 相手の ゲンガー が先)。実際: opp=${iOpp} / self=${iSelf}`);
});
