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

test('D4-3b-4: 両側が同ターンに交代・同速→乱数を1回だけ消費してcanonSides順に順序を決める(#13)', () => {
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
  assert.equal(rng.count(), 1, `同速タイの交代(orderSidesBySpeedForPhase)は乱数を1回だけ引く(実際=${rng.count()}回)`);
});
