/*
 * tools/_doubles_audit/hospitality_test.js
 *   ダブルバトル監査: とくせい「おもてなし」(登場時に味方のHPを1/4回復)
 *   実行: node tools/_doubles_audit/hospitality_test.js
 *
 * ★これは監査用テスト(修正はしない)。期待値はすべて権威ソースの引用から立てており、
 *   エンジンの出力を写していない(自己出力をゴールデンにしない=バトル再現_羅針盤)。
 *
 * 出典(一字一句の引用):
 *  [W1] ポケモンWiki「おもてなし」『効果』節
 *       「場に出たときに、味方のHPを最大HPの1/4分だけ回復する (小数点以下切り捨て)。」
 *  [W2] ポケモンWiki「おもてなし」説明文(Champions)
 *       「登場した時 味方のHPを その味方の最大HPの1/4回復する。」
 *  [W3] ポケモンWiki「おもてなし」『特性の仕様』節
 *       「味方がいないときや、味方のHPが満タンのときは発動しない。」
 *  [W4] ポケモンWiki「おもてなし」『特性の仕様』節
 *       「発動時、「<特性所持者>が たてた お茶を <味方>は 飲みほした!」というメッセージが出る。」
 *  [W5] ポケモンWiki「おもてなし」『特性の仕様』節
 *       「いかくやかわりものなど、他の多くの場に出たときに発動する特性より発動の優先順位が低い。」
 *  [C1] master/abilities.json slug=hospitality(champions:true / regulation:M-C)
 *       effect_ja「戦闘に出た時に、自分を除く味方全体のHPをそれぞれ最大HPの1/4ずつ回復する。(ダブルバトル用)
 *                 ただし、味方がいないときや、味方のHPが満タンのときは発動しない(回復量の端数は切り捨て)。」
 *  [R1] review/_doubles_research_2026-09-07/T6_特性と持ち物.md #23(上記Wikiの引用を載せた調査行)
 *
 * 主張(ダブルでどう動くべきか):
 *  A1 登場時、味方(自分を除く同じ側のもう1枠)のHPを「その味方の最大HP」の1/4(小数点以下切り捨て)回復する。[W1][W2][C1]
 *  A2 味方のHPが満タンのときは発動しない(発動行が出ない・HPも動かない)。[W3][C1]
 *  A3 味方がいないときは発動しない。自分自身は回復しない(「自分を除く味方」)。[W3][C1]
 *  A4 発動時に専用のメッセージ「◯◯が たてた お茶を △△は 飲みほした！」が出る。[W4]
 *  A5 同時入場では、いかく等の他の登場特性より「あと」に発動する(素早さ順より優先順位が低い)。[W5]
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

const HOST = 'ヤバソチャ(ボンサクのすがた)';   // Champions版でおもてなしを持つ唯一の個体(ab1=おもてなし)
const ALLY = 'カメックス';                     // 味方役(回復量の端数切り捨てを見るため最大HPが4の倍数でない個体)
const INTIMIDATE = 'クチート';                 // いかく持ち・すばやさ50(=HOSTの70より遅い)→A5の順序検証に使う

// 枠1つに任意のポケモン/技/HP/特性を置く(tools/_doubles_fixture_test.js の placeSlot と同じ流儀。
// あのファイルは require するとテストが走ってしまうのでコピーして使う)。
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

// ★E.battleLogはvm(別レルム)の配列なので、文字列プリミティブに詰め直してから使う(fixtureと同じ罠回避)。
function msgsFrom(log, fromIdx) {
  const out = [];
  for (let i = fromIdx; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}

// 「おもてなしが発動した」と読める行を拾う。Wikiの専用メッセージ[W4]だけでなく、
// 特性名を含む行・お茶の行のいずれかを拾う広めの網(実装が別文言でも発動事実は検出できるようにする)。
function hospitalityLines(msgs) {
  return msgs.filter(m => /おもてなし/.test(m) || (/お茶/.test(m) && /飲/.test(m)));
}

// おもてなし持ちが登場する2v2の場を作る。ally=null で「味方がいない」場にできる。
function setupEntry(opts) {
  opts = opts || {};
  const E = build2v2();
  const host = placeSlot(E, 'self', 0, HOST, null, { ability: 'おもてなし' });
  const allyName = ('ally' in opts) ? opts.ally : ALLY;
  const ally = allyName
    ? placeSlot(E, 'self', 1, allyName, null, { hp: opts.allyHp, ability: opts.allyAbility })
    : placeSlot(E, 'self', 1, null, null);
  placeSlot(E, 'opp', 0, 'フシギバナ', null);
  placeSlot(E, 'opp', 1, null, null);
  if (opts.hostHp != null) host.currentHp = opts.hostHp;
  const from = E.battleLog.length;
  E.setRandom(mulberry32(1));
  E.phaseInitA();          // ダブルの登場処理(設計どおり全枠ぶんのfireEntryAbilityがここから走る)
  return { E, host, ally, msgs: msgsFrom(E.battleLog, from) };
}

// ★A2/A3は「発動しない」ことを確かめる否定形の主張なので、機構が丸ごと未実装でも自動的に通ってしまう
//   (=「エンジンがそうしているから」で通る偽の合格)。それを防ぐため、同じエンジンで「発動すべき場では
//   ちゃんと発動する」ことを先に確かめる陽性対照(positive control)を必ず踏ませる。
function assertHospitalityIsLive() {
  const r = setupEntry({ allyHp: 1 });
  const healed = r.ally.currentHp > 1;
  const fired = hospitalityLines(r.msgs).length > 0;
  assert.ok(healed || fired,
    '陽性対照: 傷ついた味方がいる場ではおもてなしが発動するはず(発動しないなら否定形の主張は検証になっていない=' +
    `未実装)。味方HP=${r.ally.currentHp}(開始1) / ログ=${JSON.stringify(r.msgs)}`);
}

// ===== A1: 味方の最大HPの1/4(切り捨て)を回復する =====
test('おもてなし-A1: 登場時に味方のHPをその味方の最大HPの1/4(端数切り捨て)回復する', () => {
  // [W1]「場に出たときに、味方のHPを最大HPの1/4分だけ回復する (小数点以下切り捨て)。」
  // [W2]「登場した時 味方のHPを その味方の最大HPの1/4回復する。」
  const E0 = build2v2();
  const probe = placeSlot(E0, 'self', 1, ALLY, null);
  const allyMax = E0.realStat(probe, 'hp');          // 味方の最大HP(エンジンの実数値計算=データ側の事実)
  const expectHeal = Math.floor(allyMax / 4);        // ★期待値はWikiの式(最大HP÷4の切り捨て)から立てる
  assert.ok(allyMax % 4 !== 0,
    `端数切り捨てを見るため最大HPは4の倍数でない個体を使う(${ALLY}の最大HP=${allyMax})`);

  const startHp = 1;
  const r = setupEntry({ allyHp: startHp });
  assert.equal(r.ally.currentHp, startHp + expectHeal,
    `味方のHPは ${startHp} → ${startHp + expectHeal} になるはず(最大HP${allyMax}の1/4=${expectHeal}). 実際=${r.ally.currentHp}`);
});

// ===== A2: 味方が満タンなら発動しない =====
test('おもてなし-A2: 味方のHPが満タンのときは発動しない', () => {
  // [W3]「味方がいないときや、味方のHPが満タンのときは発動しない。」
  assertHospitalityIsLive();                          // 陽性対照(未実装を「合格」にしないため)
  const r = setupEntry({});                           // allyHp省略=満タン
  const allyMax = r.E.realStat(r.ally, 'hp');
  assert.equal(r.ally.currentHp, allyMax, '満タンの味方のHPは動かない');
  const fired = hospitalityLines(r.msgs);
  assert.equal(fired.length, 0,
    `満タンの味方には発動しない=おもてなしの発動行は出ないはず。実際に出た行=${JSON.stringify(fired)}`);
});

// ===== A3: 味方がいないときは発動しない・自分は回復しない =====
test('おもてなし-A3: 味方がいないときは発動しない(自分自身は回復しない)', () => {
  // [W3]「味方がいないときや、味方のHPが満タンのときは発動しない。」
  // [C1]「自分を除く味方全体のHPをそれぞれ最大HPの1/4ずつ回復する」=自分は対象外
  assertHospitalityIsLive();                          // 陽性対照(未実装を「合格」にしないため)
  const E0 = build2v2();
  const probe = placeSlot(E0, 'self', 0, HOST, null, { ability: 'おもてなし' });
  const hostMax = E0.realStat(probe, 'hp');
  const hostStart = Math.max(1, Math.floor(hostMax / 2));

  const r = setupEntry({ ally: null, hostHp: hostStart });
  assert.equal(r.host.currentHp, hostStart,
    `味方がいない場では自分のHPも回復しない(${hostStart}のまま)。実際=${r.host.currentHp}`);
  const fired = hospitalityLines(r.msgs);
  assert.equal(fired.length, 0,
    `味方がいないときは発動しない=発動行は出ないはず。実際に出た行=${JSON.stringify(fired)}`);

  // 「自分を除く」のもう半分: 味方が居て実際に発動する場でも、自分のHPは1/4も回復しない。
  const r2 = setupEntry({ allyHp: 1, hostHp: hostStart });
  assert.equal(r2.host.currentHp, hostStart,
    `味方を回復させるときも自分は回復しない(${hostStart}のまま)。実際=${r2.host.currentHp}`);
});

// ===== A4: 専用メッセージ =====
test('おもてなし-A4: 発動時に「◯◯が たてた お茶を △△は 飲みほした！」のメッセージが出る', () => {
  // [W4]「発動時、「<特性所持者>が たてた お茶を <味方>は 飲みほした!」というメッセージが出る。」
  const r = setupEntry({ allyHp: 1 });
  const tea = r.msgs.filter(m => /たてた お茶を/.test(m) && /飲みほした/.test(m));
  assert.equal(tea.length, 1,
    `お茶のメッセージが1行出るはず。実際のログ=${JSON.stringify(r.msgs)}`);
  assert.match(tea[0], new RegExp(`ヤバソチャ`), '行に特性所持者の名前が入る');
  assert.match(tea[0], new RegExp(ALLY), '行に回復した味方の名前が入る');
});

// ===== A5: いかく等の他の登場特性より後に発動する =====
test('おもてなし-A5: 同時入場ではいかく(他の登場特性)より後に発動する(素早さ順に優先しない)', () => {
  // [W5]「いかくやかわりものなど、他の多くの場に出たときに発動する特性より発動の優先順位が低い。」
  // 配置: self:0 = ヤバソチャ(おもてなし・すばやさ70) / self:1 = クチート(いかく・すばやさ50・HP1)
  // 素早さだけで並べると おもてなし(70) → いかく(50) の順になる場だが、Wikiの優先順位ではいかくが先。
  const E = build2v2();
  placeSlot(E, 'self', 0, HOST, null, { ability: 'おもてなし' });
  const ally = placeSlot(E, 'self', 1, INTIMIDATE, null, { hp: 1, ability: 'いかく' });
  placeSlot(E, 'opp', 0, 'フシギバナ', null);
  placeSlot(E, 'opp', 1, null, null);

  const hostSpd = E.effectiveSpeed(E.slotOf('self', 0));
  const allySpd = E.effectiveSpeed(ally);
  assert.ok(hostSpd > allySpd,
    `この配置ではおもてなし側が速い(${HOST}=${hostSpd} > ${INTIMIDATE}=${allySpd})=素早さ順なら先になってしまう前提`);

  const from = E.battleLog.length;
  E.setRandom(mulberry32(1));
  E.phaseInitA();
  const msgs = msgsFrom(E.battleLog, from);

  const iIntimidate = msgs.findIndex(m => /いかく/.test(m));
  const iHosp = msgs.findIndex(m => /おもてなし/.test(m) || (/お茶/.test(m) && /飲/.test(m)));
  assert.ok(iIntimidate >= 0, `いかくの発動行が出るはず。実際のログ=${JSON.stringify(msgs)}`);
  assert.ok(iHosp >= 0, `おもてなしの発動行が出るはず。実際のログ=${JSON.stringify(msgs)}`);
  assert.ok(iIntimidate < iHosp,
    `いかく(${iIntimidate}行目)がおもてなし(${iHosp}行目)より先に発動するはず。実際のログ=${JSON.stringify(msgs)}`);
});
