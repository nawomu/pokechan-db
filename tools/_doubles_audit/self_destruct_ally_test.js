/*
 * tools/_doubles_audit/self_destruct_ally_test.js
 * 監査対象: じばく/だいばくはつ/ほうでん/ねっぷう のダブル挙動
 *           (範囲=「自分以外の全員」は味方も巻き込む / 範囲補正0.75 / 自爆技の使用者ひんし / しめりけ)
 * 実行: node tools/_doubles_audit/self_destruct_ally_test.js
 *
 * ★期待値の出どころ(権威ソース・一字一句の引用は下のCLAIM注釈に記す)。エンジンの出力を写していない。
 *   - ポケモンWiki「じばく」        reference/_authority_corpus/moves/じばく.json
 *   - ポケモンWiki「だいばくはつ」  reference/_authority_corpus/moves/だいばくはつ.json
 *   - ポケモンWiki「ほうでん」      reference/_authority_corpus/moves/ほうでん.json
 *   - ポケモンWiki「ねっぷう」      reference/_authority_corpus/moves/ねっぷう.json
 *   - ポケモンWiki「ダブルバトル」  reference/_authority_corpus/rules/ダブルバトル.json
 *   - ポケモンWiki「ダメージ」      reference/_authority_corpus/rules/ダメージ.json
 *   - ポケモンWiki「しめりけ」      reference/_authority_corpus/abilities/しめりけ.json
 * ★Champions搭載: master/moves.json で じばく/だいばくはつ/ほうでん/ねっぷう すべて champions:true、
 *   master/abilities.json で しめりけ champions:true(Wiki しめりけ にも「Champions」説明文あり)。
 *
 * 流儀は tools/_doubles_fixture_test.js に合わせる(buildEngine / setFormat({slotsPerSide:2}) /
 * placeSlot / runTurn / battleLog)。placeSlot・build2v2・hitLines・msgList は同ファイルからの写し
 * (require すると向こうのテストが走ってしまうため)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// ===== _doubles_fixture_test.js からの写し(fixture流儀をそのまま踏襲) =====
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
// ★E.battleLog は vm(別レルム)の配列。for で1件ずつ読んでこの場の配列へ詰め直す。
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
// 乱数を定数にして「配置だけが違う2つの実行」を比べられるようにする(0.5=急所なし・
// 追加効果(ほうでん30%/ねっぷう10%)は発動しない・命中率90%の技は当たる・まもるは成功する)。
const halfRandom = () => 0.5;

// =====================================================================================
// CLAIM 1: じばく/だいばくはつ/ほうでん の範囲は「自分以外の全員」=ダブルでは味方も巻き込む。
//   出典(ポケモンWiki「ほうでん」): 「| 範囲 |\n\n 自分以外の全員」
//   出典(ポケモンWiki「じばく」/「だいばくはつ」): 同じく「| 範囲 |\n\n 自分以外の全員」
//   出典(ポケモンWiki「ダブルバトル」§対象が変わる技の一覧):
//     「自分以外全員\n\n・うたかたのアリア\n\n・かえんだん\n\n・じしん\n\n・じならし\n\n・じばく\n\n
//       ・シンクロノイズ\n\n・だいばくはつ\n\n…・ほうでん\n\n・マグニチュード\n\n・ミストバースト」
//   出典(ポケモンWiki「じばく」第五〜第九世代 説明文):
//     「ばくはつを おこして じぶんの まわりに いるものを こうげきする。 つかった あとに ひんしに なる。」
//   → 使用者以外の3枠(相手2枠+味方1枠)すべてがダメージを受ける。
// =====================================================================================
test('CLAIM1: ほうでん(自分以外全体)はダブルで相手2枠と味方1枠の3体すべてにダメージを与える', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'リザードン', 'houden');   // 使用者
  placeSlot(E, 'self', 1, 'フシギバナ');             // 味方(くさ/どく=でんきは等倍)
  placeSlot(E, 'opp', 0, 'カメックス');
  placeSlot(E, 'opp', 1, 'カメックス');
  const allyMax = E.realStat(E.slotOf('self', 1), 'hp');
  const oppMax0 = E.realStat(E.slotOf('opp', 0), 'hp');
  const oppMax1 = E.realStat(E.slotOf('opp', 1), 'hp');
  E.setRandom(halfRandom);
  E.runTurn();
  const hits = hitLines(E.battleLog).filter(h => h.move === 'ほうでん');
  assert.equal(hits.length, 3,
    `自分以外の全員=3体(相手2枠+味方1枠)にダメージ行が出るはず。実際=${JSON.stringify(hits)}`);
  assert.ok(E.slotOf('opp', 0).currentHp < oppMax0, '相手の左枠がダメージを受ける');
  assert.ok(E.slotOf('opp', 1).currentHp < oppMax1, '相手の右枠がダメージを受ける');
  assert.ok(E.slotOf('self', 1).currentHp < allyMax,
    `味方(self:1)も巻き込まれてダメージを受けるはず(Wiki「範囲=自分以外の全員」)。残HP=${E.slotOf('self', 1).currentHp}/${allyMax}`);
  assert.ok(hits.some(h => h.defender === 'フシギバナ'),
    `味方あての被弾行が出るはず。ログ=${JSON.stringify(msgList(E.battleLog))}`);
});

// =====================================================================================
// CLAIM 2: ねっぷう の範囲は「相手全員」=ダブルでも味方は巻き込まない(自分以外全体と区別される)。
//   出典(ポケモンWiki「ねっぷう」): 「| 範囲 |\n\n 相手全員」
//   出典(ポケモンWiki「ダブルバトル」§対象が変わる技の一覧・「相手全員」の列挙に ねっぷう が在る):
//     「相手全員\n\n・アストラルビット\n\n…・ねっさのあらし\n\n・ねっぷう\n\n・バークアウト\n\n…」
//   → 相手2枠だけがダメージを受け、味方は無傷。
// =====================================================================================
test('CLAIM2: ねっぷう(相手全体)はダブルで相手2枠だけに当たり、味方は無傷のまま', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'リザードン', 'neppuu');   // 使用者
  placeSlot(E, 'self', 1, 'フシギバナ');             // 味方(くさ=ほのおは2倍=当たれば必ず目に見える)
  placeSlot(E, 'opp', 0, 'カメックス');
  placeSlot(E, 'opp', 1, 'カメックス');
  const allyMax = E.realStat(E.slotOf('self', 1), 'hp');
  const oppMax0 = E.realStat(E.slotOf('opp', 0), 'hp');
  const oppMax1 = E.realStat(E.slotOf('opp', 1), 'hp');
  E.setRandom(halfRandom);
  E.runTurn();
  const hits = hitLines(E.battleLog).filter(h => h.move === 'ねっぷう');
  assert.equal(hits.length, 2,
    `相手全員=2体にだけダメージ行が出るはず。実際=${JSON.stringify(hits)}`);
  assert.ok(E.slotOf('opp', 0).currentHp < oppMax0, '相手の左枠がダメージを受ける');
  assert.ok(E.slotOf('opp', 1).currentHp < oppMax1, '相手の右枠がダメージを受ける');
  assert.equal(E.slotOf('self', 1).currentHp, allyMax,
    'ねっぷうは「相手全員」なので味方(self:1)は無傷のまま');
});

// =====================================================================================
// CLAIM 3: 範囲補正。第五世代以降は対象が複数なら0.75倍。第四世代の「じばく/だいばくはつは対象2体では
//          範囲補正が掛からない」例外は第四世代限定なので、Champions(第九世代規則)では適用しない
//          =ダブルで対象2体のじばくにも0.75倍が掛かる。
//   出典(ポケモンWiki「ダメージ」§範囲補正):
//     「・第四世代では複数を対象とするわざなら0.75倍。
//       ・じばく・だいばくはつのみ、対象が3体の時のみ0.75倍。(対象が2体のみなら1倍のまま)
//       ・第五世代以降は複数を対象とするわざなら0.75倍。」
//   出典(ポケモンWiki「だいばくはつ」§第四世代以前):
//     「第四世代のダメージ計算でのみ、他の自分以外が対象のわざとは異なり、攻撃対象が2体しかいない場合は
//       範囲補正が掛からない。3体いる場合は範囲補正でダメージが3/4倍になる。」
//   → 対象1体のとき=1倍 / 対象2体のとき=0.75倍。同じ相手・同じ乱数(定数0.5)で両方を測り、
//     「対象2体の与ダメ ÷ 対象1体の与ダメ = 0.75(整数丸めの±1以内)」を確かめる。
// =====================================================================================
function jibakuDamageOnOppFront(oppRightPresent) {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'リザードン', 'jibaku');
  placeSlot(E, 'self', 1, null, null);                           // 味方枠は空=対象に数えない
  placeSlot(E, 'opp', 0, 'カメックス');
  if (oppRightPresent) placeSlot(E, 'opp', 1, 'カメックス');
  else placeSlot(E, 'opp', 1, null, null);
  E.setRandom(halfRandom);
  E.runTurn();
  const hits = hitLines(E.battleLog).filter(h => h.move === 'じばく' && h.defender === '相手の カメックス');
  return { dmg: hits.length ? hits[0].dmg : null, nTargets: hits.length, log: msgList(E.battleLog) };
}
test('CLAIM3: じばくは対象2体(ダブル)で0.75倍・対象1体で1倍(第四世代の2体例外は第九世代では適用しない)', () => {
  const one = jibakuDamageOnOppFront(false);   // 対象=相手の左枠だけ=1体
  const two = jibakuDamageOnOppFront(true);    // 対象=相手の左右2枠=2体
  assert.equal(one.nTargets, 1, `対象1体の配置では相手左枠への被弾行が1本。実際=${one.nTargets} / ${JSON.stringify(one.log)}`);
  assert.ok(two.dmg != null, `対象2体の配置でも相手左枠への被弾行が出るはず。ログ=${JSON.stringify(two.log)}`);
  const expected = one.dmg * 0.75;   // ★Wiki「第五世代以降は複数を対象とするわざなら0.75倍」から導いた期待値
  assert.ok(Math.abs(two.dmg - expected) <= 1,
    `対象2体のじばくは対象1体の0.75倍(±1=整数丸め分)になるはず。1体=${one.dmg} / 2体=${two.dmg} / 期待=${expected}`);
  assert.ok(two.dmg < one.dmg,
    `対象2体のほうが必ず小さい(第四世代の「2体なら1倍」例外は第九世代では無い)。1体=${one.dmg} / 2体=${two.dmg}`);
});

// =====================================================================================
// CLAIM 4: じばく/だいばくはつは、まもるで無効化されても・命中しなくても使用者はひんしになる。
//   出典(ポケモンWiki「だいばくはつ」§技の仕様):
//     「・技が相性やまもる状態により無効化されたときや、命中しなかったとき、姿を隠していて当たらなかった
//       ときでも、使用者はひんしになる。」
//   出典(ポケモンWiki「じばく」§技の仕様): 「・威力を除けばだいばくはつと同じ効果を持つ。技の効果に
//     ついてはだいばくはつ#技の仕様を参照とする。」
//   出典(ポケモンWiki「じばく」§判定): 「・まもる: ○」(=まもるで防がれる技である)
//   → ダブルで相手2枠がともにまもるを使った場合、2枠ともダメージ0で、使用者は自分でひんしになる。
// =====================================================================================
test('CLAIM4: ダブルで相手2枠がまもってじばくが全部防がれても、使用者はひんしになる', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'リザードン', 'jibaku');
  placeSlot(E, 'self', 1, null, null);
  placeSlot(E, 'opp', 0, 'カメックス', 'mamoru');   // まもるは優先度+4=じばくより先
  placeSlot(E, 'opp', 1, 'カメックス', 'mamoru');
  const oppMax0 = E.realStat(E.slotOf('opp', 0), 'hp');
  const oppMax1 = E.realStat(E.slotOf('opp', 1), 'hp');
  E.setRandom(halfRandom);
  E.runTurn();
  const msgs = msgList(E.battleLog);
  const blocked = msgs.filter(m => /防いだ/.test(m));
  assert.equal(blocked.length, 2, `相手2枠ともまもるで防ぐはず。防いだ行=${JSON.stringify(blocked)} / 全ログ=${JSON.stringify(msgs)}`);
  assert.equal(E.slotOf('opp', 0).currentHp, oppMax0, 'まもった相手の左枠は無傷');
  assert.equal(E.slotOf('opp', 1).currentHp, oppMax1, 'まもった相手の右枠は無傷');
  assert.equal(E.slotOf('self', 0).currentHp, 0,
    `まもるで全部防がれても使用者はひんしになる(Wiki「まもる状態により無効化されたとき…でも、使用者はひんしになる」)。残HP=${E.slotOf('self', 0).currentHp}`);
  assert.equal(E.slotOf('self', 0).fainted, true, '使用者のfaintedフラグが立つ');
});

// =====================================================================================
// CLAIM 5: しめりけのポケモンが「場にいる」とじばく/だいばくはつは失敗し、使用者はひんしにならない。
//          ダブルでは自分の味方枠・相手の右枠も「場」に含まれる。
//   出典(ポケモンWiki「しめりけ」§効果):
//     「・この特性のポケモンが場にいる間、特性の所有者を含めた全てのポケモンが使う爆発する技は失敗する。
//       以下の技が該当する。」(表に じばく/だいばくはつ/ビックリヘッド/ミストバースト)
//   出典(ポケモンWiki「しめりけ」§説明文 Champions):
//     「全員 爆発の技が使用できず 爆発する特性も発動しない。」
//   出典(ポケモンWiki「だいばくはつ」§技の仕様):
//     「・特性しめりけのポケモンが場にいるときは失敗し、使用者はひんしにならない。このときもPPは消費する。」
//   → しめりけがどの枠に居ても(相手の左枠/相手の右枠/自分の味方枠)じばくは失敗し、使用者は生き残る。
// =====================================================================================
function jibakuWithDampAt(side, idx) {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'リザードン', 'jibaku', { ability: 'もうか' });
  placeSlot(E, 'self', 1, 'フシギバナ', null, { ability: 'しんりょく' });
  placeSlot(E, 'opp', 0, 'カメックス', null, { ability: 'げきりゅう' });
  placeSlot(E, 'opp', 1, 'カメックス', null, { ability: 'げきりゅう' });
  E.slotOf(side, idx).ability = 'しめりけ';   // ★どの枠に置くかだけを変える
  const maxes = {
    u: E.realStat(E.slotOf('self', 0), 'hp'),
    a: E.realStat(E.slotOf('self', 1), 'hp'),
    o0: E.realStat(E.slotOf('opp', 0), 'hp'),
    o1: E.realStat(E.slotOf('opp', 1), 'hp'),
  };
  E.setRandom(halfRandom);
  E.runTurn();
  return {
    msgs: msgList(E.battleLog),
    userHp: E.slotOf('self', 0).currentHp, userFainted: E.slotOf('self', 0).fainted,
    allyHp: E.slotOf('self', 1).currentHp, oppHp0: E.slotOf('opp', 0).currentHp, oppHp1: E.slotOf('opp', 1).currentHp,
    maxes,
  };
}
function assertDampBlocked(r, where) {
  assert.ok(r.msgs.some(m => /しかし うまく きまらなかった/.test(m)),
    `${where} のしめりけでじばくは失敗するはず(「しかしうまく決まらなかった!」)。ログ=${JSON.stringify(r.msgs)}`);
  assert.equal(r.oppHp0, r.maxes.o0, `${where}: 失敗なので相手の左枠は無傷`);
  assert.equal(r.oppHp1, r.maxes.o1, `${where}: 失敗なので相手の右枠は無傷`);
  assert.equal(r.allyHp, r.maxes.a, `${where}: 失敗なので味方も無傷`);
  assert.equal(r.userFainted, false,
    `${where}: しめりけで失敗したときは使用者はひんしにならない(Wiki「失敗し、使用者はひんしにならない」)。残HP=${r.userHp}/${r.maxes.u}`);
  assert.equal(r.userHp, r.maxes.u, `${where}: 使用者のHPは満タンのまま`);
}
test('CLAIM5a(対照): しめりけが相手の左枠(正面)に居るとじばくは失敗し使用者はひんしにならない', () => {
  assertDampBlocked(jibakuWithDampAt('opp', 0), '相手の左枠(正面)');
});
test('CLAIM5b: しめりけが自分の味方枠(self:1)に居てもじばくは失敗し使用者はひんしにならない', () => {
  assertDampBlocked(jibakuWithDampAt('self', 1), '自分の味方枠');
});
test('CLAIM5c: しめりけが相手の右枠(opp:1)に居てもじばくは失敗し使用者はひんしにならない', () => {
  assertDampBlocked(jibakuWithDampAt('opp', 1), '相手の右枠');
});
