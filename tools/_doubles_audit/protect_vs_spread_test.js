/*
 * tools/_doubles_audit/protect_vs_spread_test.js
 *   監査対象機構: 「まもる × 範囲技」(ダブル)
 *     = 1体だけまもる → 他の対象には当たる / 範囲補正(×0.75)は「対象数」で維持される
 *   実行: node tools/_doubles_audit/protect_vs_spread_test.js
 *
 * ★この監査は修正をしない(エンジンを触らない)。期待値は下の出典(権威ソース)の引用からだけ作る。
 *   エンジンの出力を写して「エンジンがそうしているから通る」テストにはしない:
 *   - 絶対ダメージ値は一つも期待値に書かない(機体/レベル/乱数に依存するため)。
 *   - 範囲補正は「対象2体の1発」と「対象1体の1発」の比が Wiki の 3/4(0.75) になるか、で判定する。
 *   - 乱数は E.setRandom(()=>0) で固定(16通り乱数[85..100]の先頭=85%側に固定)。両ケースで同じ乱数に
 *     なるので、比から乱数要素が消える=0.75だけが残る。
 *
 * ======================================================================================
 * 出典(一字一句の引用)
 * ======================================================================================
 * [A] ポケモンWiki「まもる」 https://wiki.xn--rckteqa2e.com/wiki/まもる (2026-09-11 取得)
 *   ・諸元表: 「範囲 / 自分」「優先度 / +2 (第二世代)+3 (第三・四世代)+4 (第五世代以降)」
 *   ・効果: 「そのターンの間まもる状態となり、受ける技を無効化する。連続で使用すると失敗しやすくなる。優先度が高い。」
 *   ・Champions説明文: 「使ったターン中 相手の技から身を守る。連続で使うと成功率が 前に使った時の1/3になる。[優先度+4]」
 *   → 範囲=自分。守るのは「自分」だけ(味方の枠には何も起きない)。
 *
 * [B] ポケモンWiki「いわなだれ」 https://wiki.xn--rckteqa2e.com/wiki/いわなだれ (2026-09-11 取得)
 *       「範囲 / 相手全員」 ... 判定: 「まもる: ○」
 *     ポケモンWiki「じしん」 https://wiki.xn--rckteqa2e.com/wiki/じしん (2026-09-11 取得)
 *       「範囲 / 自分以外の全員」 ... 判定: 「まもる: ○」
 *     ポケモンWiki「なみのり」 https://wiki.xn--rckteqa2e.com/wiki/なみのり (2026-09-11 取得)
 *       「範囲 / 相手全員(第三世代)→自分以外の全員(第四世代以降)」 ... 判定: 「まもる: ○」
 *   → 範囲技(相手全体/自分以外全体)も まもる で防がれる。「範囲技はワイドガード専用」ではない。
 *   (同旨の二重確認: review/_doubles_research_2026-09-07/T4_引き寄せと保護_verify.md #36
 *    「★備考の結論が誤り: 『まもるは複数体が対象になる技を防げない』は誤り。Showdown実データ:
 *      earthquake { flags: { protect: 1, ... }, target: "allAdjacent" } / surf も同じ → まもるで防げる。
 *      Bulbapediaの "moves that target all Pokémon" は target: 'all' のこと」)
 *
 * [C] ポケモンWiki「ダブルバトル」 https://wiki.xn--rckteqa2e.com/wiki/ダブルバトル (2026-09-11 取得)
 *   ・「攻撃範囲が広がる技は、ダメージが3/4(0.75倍)に減少する（ダメージ#範囲補正)。」
 *   ・「攻撃範囲が広がる技でも、片方がすでにひんしだったため1体しか攻撃対象にならなかった場合は
 *      範囲補正がかからない。2体が攻撃対象になれば、片方に無効化された場合でも範囲補正がかかる。」
 *   ・「集中攻撃をまもるで防ぐことができれば大きなアドバンテージとなる。」
 *   ・範囲の一覧: 「相手全員」に いわなだれ/ハイパーボイス/マジカルシャイン 等、
 *                「自分以外全員」に じしん/なみのり 等が載る。
 *   → 「実行時点で2体が対象」なら、片方が無効化(=まもるで防がれた)でも範囲補正は残る。
 *      片方がひんしで対象が1体になった時だけ補正が消える。
 *
 * [D] Bulbapedia "Damage" https://bulbapedia.bulbagarden.net/wiki/Damage
 *   "Targets is 0.75 (0.5 in Battle Royals) if the move has more than one target when the move is
 *    executed, and 1 otherwise"
 *   "only if there is more than one such target when the move is executed, regardless of whether the
 *    move actually hits or can hit all the targets"
 *   → [C]と独立に同じ条件(実行時点の対象数≥2・実際に当たったかは問わない)と同じ倍率(0.75)を確認。
 *   (引用の在り処: review/_doubles_research_2026-09-07/T3_範囲技と補正.md #1,#2,#3,#4)
 *
 * [E] Champions搭載の確認(master/moves.json・champions:true):
 *     まもる(target:自分, protect:false) / いわなだれ(相手全体, protect:true) /
 *     じしん(自分以外全体, protect:true) / なみのり(自分以外全体, protect:true) /
 *     ハイパーボイス(相手全体, protect:true) … いずれも champions:true = 搭載。
 *
 * ======================================================================================
 * 主張(期待値の元)
 * ======================================================================================
 *  主張1 [A]    : まもるの範囲は「自分」。守るのは使用者だけで、味方の枠は守りの体勢にならない。
 *  主張2 [B]    : 範囲技(相手全体/自分以外全体)も まもる で防がれる(まもる:○)。
 *  主張3 [A][C] : 範囲技に対して片方だけがまもった時、もう片方の対象には普通に当たる
 *                 (= まもるは「技そのもの」を止めるのではなく「その枠への命中」を止める)。
 *  主張4 [C][D] : 片方がまもって無効化されても、対象が2体だったなら範囲補正(×0.75)はかかったまま。
 *  主張5 [C][D] : 片方がすでにひんしで対象が1体しかいない時は範囲補正がかからない(=1倍)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// ---- fixture の流儀は tools/_doubles_fixture_test.js からコピー(requireするとそのファイルのテストが走るため) ----
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
  if (opts.ability != null) st.ability = opts.ability;
  return st;
}
function build2v2() {
  const E = buildEngine();
  E.setFormat({ slotsPerSide: 2 });
  E.sides.self.poke = pokeByName('フシギバナ');
  E.sides.self.moves = [];
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.poke = pokeByName('フシギバナ');
  E.sides.opp.moves = [];
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.resetBattle();
  return E;
}
// ★E.battleLogはvm(別レルム)の配列。for文で1件ずつ文字列化してこちらのレルムに詰め直す。
function msgList(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}
// 「◯◯ の <技>！ ◯◯ に N ダメージ！」行だけを拾う
function hitLines(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const mm = /^(.+?) の (.+?)！ (.+?) に (\d+) ダメージ！/.exec(String(log[i].msg));
    if (mm) out.push({ attacker: mm[1], move: mm[2], defender: mm[3], dmg: Number(mm[4]) });
  }
  return out;
}

// 乱数固定: 16通り乱数[85..100]の index 0(=85%)に固定し、まもるの成功判定(Math.random() < 成功率)も
// 必ず成功側に落とす。両ケースで同じ値を使うので、ダメージの比から乱数要素が消える。
const FIXED_RNG = () => 0;

// ハイパーボイス(相手全体・命中100・追加効果なし)でopp:1が受けた1発のダメージを返す共通ヘルパ。
// opp:0 の状態だけを引数で変える(まもる宣言 / 何もしない / ひんし)=変数は1つだけ。
function dmgOnOpp1(opp0Mode) {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'haipaaboisu');   // 攻撃側(相手全体の範囲技)
  placeSlot(E, 'self', 1, null, null);                    // 味方は空席(味方側の要素を混ぜない)
  placeSlot(E, 'opp', 0, 'カメックス', opp0Mode === 'protect' ? 'mamoru' : null,
    opp0Mode === 'fainted' ? { fainted: true } : undefined);
  placeSlot(E, 'opp', 1, 'リザードン', null);             // 測定対象(ノーマル技に等倍=無効化要素なし)
  const max1 = E.realStat(E.slotOf('opp', 1), 'hp');
  E.setRandom(FIXED_RNG);
  E.runTurn();
  const st1 = E.slotOf('opp', 1);
  return { E, dmg: max1 - st1.currentHp, max1: max1, msgs: msgList(E.battleLog) };
}

// ===== 主張1 [A]: まもるの範囲は「自分」=味方の枠は守りの体勢にならない =====
test('PS-1: まもるは使用者の枠だけを守りの体勢にする(味方の枠には何も立たない)【出典A: まもる「範囲 / 自分」】', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, null, null);
  placeSlot(E, 'self', 1, null, null);
  placeSlot(E, 'opp', 0, 'カメックス', 'mamoru');
  placeSlot(E, 'opp', 1, 'リザードン', null);
  E.setRandom(FIXED_RNG);
  E.runTurn();
  // 出典Aの「範囲=自分」から: 守りの旗が立つのは宣言した枠(opp:0)だけ。
  assert.ok(E.slotOf('opp', 0).protecting, 'まもるを宣言した opp:0 は守りの体勢に入る');
  assert.equal(E.slotOf('opp', 1).protecting || null, null,
    'まもるは範囲=自分なので、味方(opp:1)の枠には守りの旗が立たない');
  const declared = msgList(E.battleLog).filter(m => /守りの体勢に入った/.test(m));
  assert.equal(declared.length, 1, `守りの体勢に入る宣言は1枠分だけ(実際=${JSON.stringify(declared)})`);
});

// ===== 主張2 [B]: 範囲技も まもる で防がれる(まもる:○)=「範囲技はワイドガード専用」ではない =====
test('PS-2: 相手全体/自分以外全体の範囲技は まもる で防がれる【出典B: いわなだれ・じしん・なみのり「まもる: ○」】', () => {
  // (a) 相手全体 = ハイパーボイス
  {
    const r = dmgOnOpp1('protect');
    const E = r.E;
    assert.equal(E.slotOf('opp', 0).currentHp, E.realStat(E.slotOf('opp', 0), 'hp'),
      '相手全体の範囲技を まもる で防いだ枠(opp:0)は無傷のまま');
    assert.ok(r.msgs.some(m => /まもる で こうげきを 防いだ/.test(m)),
      `「まもるで防いだ」行が出る(実際のログ=${JSON.stringify(r.msgs)})`);
    assert.ok(!hitLines(E.battleLog).some(h => h.defender === '相手の カメックス'),
      'まもった枠に対するダメージ行は1本も出ない');
  }
  // (b) 自分以外全体 = じしん(味方も巻き込む側の範囲技でも、防ぐ側の扱いは同じ)
  {
    const E = build2v2();
    placeSlot(E, 'self', 0, 'ケンタロス', 'jishin');
    placeSlot(E, 'self', 1, 'カビゴン', null);     // 味方も対象に入る(自分以外全体)
    placeSlot(E, 'opp', 0, 'カメックス', 'mamoru');
    placeSlot(E, 'opp', 1, 'カビゴン', null);
    const maxProt = E.realStat(E.slotOf('opp', 0), 'hp');
    const maxAlly = E.realStat(E.slotOf('self', 1), 'hp');
    const maxFoe1 = E.realStat(E.slotOf('opp', 1), 'hp');
    E.setRandom(FIXED_RNG);
    E.runTurn();
    assert.equal(E.slotOf('opp', 0).currentHp, maxProt,
      '自分以外全体(じしん)も まもる:○ = 防いだ枠は無傷');
    assert.ok(E.slotOf('opp', 1).currentHp < maxFoe1, '防いでいない相手(opp:1)はじしんを受ける');
    assert.ok(E.slotOf('self', 1).currentHp < maxAlly,
      '「自分以外全体」なので攻撃側の味方(self:1)も巻き込まれる(まもるは相手の枠しか守っていない)');
  }
});

// ===== 主張3 [A][C]: 1体だけまもる → もう片方の対象には当たる =====
test('PS-3: 片方だけがまもっても、範囲技はもう片方の対象に当たる(技ごと不発にはならない)【出典A+C】', () => {
  const r = dmgOnOpp1('protect');
  const E = r.E;
  assert.equal(E.slotOf('opp', 0).currentHp, E.realStat(E.slotOf('opp', 0), 'hp'),
    'まもった opp:0 は無傷');
  assert.ok(r.dmg > 0,
    `まもっていない opp:1 はダメージを受ける(実際=${r.dmg})。まもるは「その枠への命中」だけを止める`);
  const hits = hitLines(E.battleLog);
  assert.equal(hits.length, 1, `ダメージ行はまもっていない1枠分だけ出る(実際=${JSON.stringify(hits)})`);
  assert.equal(hits[0].defender, '相手の リザードン', 'ダメージ行の受け手はまもっていない枠');
  const blocked = r.msgs.filter(m => /こうげきを 防いだ/.test(m));
  assert.equal(blocked.length, 1, `防いだ行は1枠分だけ(実際=${JSON.stringify(blocked)})`);
});

// ===== 主張4 [C][D]: 片方がまもって無効化されても、対象2体なら範囲補正は維持される =====
test('PS-4: 片方がまもっても範囲補正は残る(まもられた時の1発 = 2体とも生存で誰も守らない時の1発)【出典C「2体が攻撃対象になれば、片方に無効化された場合でも範囲補正がかかる」/ 出典D "regardless of whether the move actually hits"】', () => {
  const protected_ = dmgOnOpp1('protect');   // opp:0 がまもる(=無効化された) / 対象は2体
  const plain = dmgOnOpp1('none');           // opp:0 は何もしない / 対象は2体
  assert.ok(protected_.dmg > 0 && plain.dmg > 0, '両ケースで opp:1 は被弾している(前提)');
  // 出典Cの「片方に無効化された場合でも範囲補正がかかる」= 補正は対象数だけで決まる
  //  → 乱数を固定した同一条件なので、2つのダメージは一致しなければならない。
  assert.equal(protected_.dmg, plain.dmg,
    `まもるは対象数を減らさない=範囲補正は変わらない。` +
    `まもられた時=${protected_.dmg} / 誰も守らない時=${plain.dmg}`);
});

// ===== 主張5 [C][D]: 片方がひんしで対象1体 → 範囲補正なし(=主張4の補正が本当に0.75であることの裏付け) =====
test('PS-5: 対象が2体(片方まもる)の1発は、対象1体(片方ひんし)の1発の3/4になる【出典C「攻撃範囲が広がる技は、ダメージが3/4(0.75倍)に減少する」「片方がすでにひんしだったため1体しか攻撃対象にならなかった場合は範囲補正がかからない」】', () => {
  const twoTargets = dmgOnOpp1('protect');   // 対象2体(片方はまもるで無効化)→ 出典C: 範囲補正あり
  const oneTarget = dmgOnOpp1('fainted');    // 対象1体(片方ひんし)       → 出典C: 範囲補正なし
  assert.ok(oneTarget.dmg > 0 && twoTargets.dmg > 0, '両ケースで opp:1 は被弾している(前提)');
  assert.ok(twoTargets.dmg < oneTarget.dmg,
    `対象2体の方が小さい(範囲補正が乗っている)。2体=${twoTargets.dmg} / 1体=${oneTarget.dmg}`);
  // 倍率の期待値は出典Cの 3/4 だけから作る。各補正段で切り捨てが入るので ±1HP の遊びを許す。
  const expected = oneTarget.dmg * 0.75;
  assert.ok(Math.abs(twoTargets.dmg - expected) <= 1,
    `2体対象の1発は 1体対象の1発 × 3/4 になる。` +
    `期待=${expected}(=${oneTarget.dmg}×0.75・切り捨て誤差±1まで許容) / 実際=${twoTargets.dmg}`);
  // まもるは「対象数」を減らさない(主張4)ことの再確認: ひんしだけが対象数を減らす。
  const ratio = twoTargets.dmg / oneTarget.dmg;
  assert.ok(ratio < 0.85,
    `比が 0.85 未満=「補正なし(1倍)」ではありえない(実際の比=${ratio.toFixed(4)})`);
});
