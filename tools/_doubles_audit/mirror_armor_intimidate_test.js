/*
 * tools/_doubles_audit/mirror_armor_intimidate_test.js
 *   ダブル監査: ミラーアーマー × いかく(跳ね返し・複数体の解決順)
 *   実行: node tools/_doubles_audit/mirror_armor_intimidate_test.js
 *
 * 立場: 監査(修正はしない)。期待値は権威ソースの引用だけから立てる。
 *       エンジンの出力を期待値に写さない(CLAUDE.md「バトル再現の北極星」)。
 *       シングルの動作は対象外。ここは E.setFormat({slotsPerSide:2}) の fixture だけを見る。
 *
 * ──────────────── 出典(一字一句の引用・2026-09-11 live取得) ────────────────
 * [I1] ポケモンWiki「いかく」#効果
 *      https://wiki.pokemonwiki.com/wiki/いかく (?action=raw 7行目)
 *      「ダブルバトル・バトルロイヤル・マックスレイドバトル・テラレイドバトルでは相手全体に効果がある。」
 * [I2] 同 #特性の仕様 (raw 254行目)
 *      「ダブルバトル・トリプルバトルで複数の相手を対象に取る場合、第四世代では素早さが高い順に攻撃を
 *        下げていく。第五世代以降は素早さに関係なく相手から見て左側のポケモンから順に攻撃を下げていく。」
 * [I3] 同 #特性の仕様 (raw 262行目)
 *      「ミラーアーマーのポケモンはいかくの効果を跳ね返す。このときいかくのポケモンのみ攻撃が1段階下がる。」
 * [I4] 同 #特性の仕様 (raw 263行目)
 *      「みがわり/しろいきり状態で防いだ場合や、すでに最低だったため攻撃が下がらなかった場合、
 *        ミラーアーマーは発動しない。」
 * [I5] 同 #特性の仕様「第五世代以降での効果の発動順」手順 (raw 281-297行目・抜粋)
 *      「# 相手から見て左側のポケモンを対象にする」
 *      「## 攻撃ランクがすでに最低なら不発 (あまのじゃくの場合は攻撃が最大なら不発)」
 *      「## ミラーアーマーの発動」
 *      「## 攻撃を下げる効果が実際に発動する」
 *      「# 相手から見て右側のポケモンを対象にする」
 *      「#* 1-1.-1-10.と同様の処理を繰り返す」
 *      (= 1体ぶんの判定が左→右で2周する。「最低なら不発」は「ミラーアーマーの発動」より前の段)
 * [M1] ポケモンWiki「ミラーアーマー」#特性の仕様 (?action=raw 53行目)
 *      https://wiki.pokemonwiki.com/wiki/ミラーアーマー
 *      「複数のポケモンの能力を下げる効果を使われた場合、この特性を持っているポケモンのみが跳ね返し、
 *        その他のポケモンが守られることはない。ミラーアーマーでランク低下を跳ね返す対象は、技や特性を
 *        発動させたポケモン単体になる。」
 * [M2] 同 (raw 54行目)
 *      「複数のミラーアーマーのポケモンが同時に能力を下げる効果を受けた場合、攻撃技による効果は
 *        使用者の味方→左側の敵→右側の敵の優先順で、いかく/わたげ/かんろなミツによる効果は
 *        左側の敵→右側の敵→使用者の味方の優先順にミラーアーマーが発動し、その分使用者は複数回
 *        ランクを低下させられる。」
 * [M3] 同 (raw 27行目)
 *      「……いかく/わたげなどのとくせいなどの効果で、他のポケモンによりミラーアーマーのポケモンの
 *        能力が下げられようとしたとき、効果を跳ね返して下げようとしたポケモンの能力を低下させる。」
 * [L1] review/_doubles_research_2026-09-07/T6_特性と持ち物.md #9/#10(ローカルの控え・同趣旨)
 *      #9「ミラーアーマーはいかくの効果を跳ね返し、このときいかくを発動したポケモン(自分)のみ攻撃が1段階下がる」
 *      #10「…いかく/わたげ/かんろなミツ由来は『左側の敵→右側の敵→使用者の味方』の優先順で跳ね返り、
 *           使用者は複数回ランクを下げられ得る」
 *      同_verify.md 48行「**A**」/ 49行「原文verbatim確認。ローカル引用の出所は本物」
 *
 * ──────────────── Champions 搭載の確認 ────────────────
 *   master/abilities.json: いかく champions:true / ミラーアーマー champions:true
 *   (= ダブルで両方同時に場に出うる=この相互作用は Champions の射程内)
 *   ※[I4]/[M1] に出てくる「クリアチャーム」は master/items.json で champions:false のため、
 *     クリアチャーム絡みの裁定(いかく手順 1-7)はこの監査の対象から外す。
 *
 * ──────────────── 左右(「相手から見て左側」)のfixture上の取り決め ────────────────
 *   本リポジトリのダブルfixture(tools/_doubles_fixture_test.js・設計_ダブルバトル_2026-09-07.md)は
 *   slot idx 昇順 = 「相手から見て左側から」 の並びとして扱う。[I2]/[M2] の「左側→右側」は
 *   この取り決めの下で「idx 0 → idx 1」を意味する。★ここで監査したいのは並びの呼び名ではなく
 *   「第五世代以降は素早さに関係なく固定順」([I2])という中身なので、W4 は わざと
 *   「遅い方を idx 0 / 速い方を idx 1」に置いて、速度順でないことを確かめる形にする。
 *
 * ──────────────── 実装の在り処(file:line) ────────────────
 *   real_battle_simulator.html:3063 phaseInitA()      … 登場時特性の唯一のディスパッチ点(速度降順)
 *   real_battle_simulator.html:3080 fireEntryAbility()… 1体ぶんの登場処理
 *   real_battle_simulator.html:3090-3117 いかく       … 相手側の全枠を idx 昇順でループし
 *                                                       applyRankStageGuarded(_tgt, st, 'atk', -1, 'Init-A', …)
 *   real_battle_simulator.html:4210-4222 ミラーアーマー… rbRegisterHandler('stat_stage','mirror_armor_reflect')
 *                                                       → applyRankStageGuarded(source, source, rk, rawStages, phase)
 *   real_battle_simulator.html:4276-4290 core_apply    … クランプ適用(=実際に下がる段)。ミラーアーマーは
 *                                                       この「実際に下がる段」より前で handled:true して打ち切る
 *   real_battle_simulator.html:4325 applyRankStageGuarded … 薄いラッパー(fromOpponent = source!==target)
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// ---- tools/_doubles_fixture_test.js からコピー(requireすると向こうのテストが走ってしまうため) ----
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
// vm(別レルム)の配列は for で1件ずつ読み替える(fixture と同じ既知の罠対策)
function msgList(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}

// 登場時に何もしない特性(fireEntryAbility の分岐に一切該当しない)=ノイズ源を潰すための埋め草
const INERT = 'ふみん';
const RANKS = ['atk', 'def', 'spatk', 'spdef', 'spd', 'acc', 'eva'];
function zeroRanks(st) { for (const k of RANKS) st.rank[k] = 0; }

// self:0 = いかく持ち / self:1 = その味方。opp:0 / opp:1 = いかくを受ける2体。
// 速度は「いかくを先に撃たせる」都合で self:0 を最速にしておく(phaseInitA は速度降順で登場処理を回す)。
//   ケンタロス110 > リザードン100 > フシギバナ80 > カメックス78
function setup(o) {
  o = o || {};
  const E = build2v2();
  const intim = placeSlot(E, 'self', 0, 'ケンタロス', 'hataku', { ability: 'いかく' });
  const mate = placeSlot(E, 'self', 1, 'リザードン', 'hataku', { ability: INERT });
  const f0 = placeSlot(E, 'opp', 0, o.foe0 || 'カメックス', 'hataku', { ability: o.ab0 || INERT });
  const f1 = placeSlot(E, 'opp', 1, o.foe1 || 'フシギバナ', 'hataku', { ability: o.ab1 || INERT });
  [intim, mate, f0, f1].forEach(zeroRanks);
  E.setRandom(mulberry32(1));
  assert.equal(E.sideAbility(intim), 'いかく', '前提: self:0 が いかく持ちとして認識されている');
  return { E, intim, mate, f0, f1 };
}
// 「ミラーアーマーで跳ね返した」行だけを順番に抜く(誰が跳ね返したかの順序を見る)
function reflectLines(E) {
  return msgList(E.battleLog).filter(m => m.includes('ミラーアーマー'));
}

// ===== 0 [土台] ポジティブ・コントロール ===================================================
// 「主張が落ちたのは fixture が登場時特性を回していないせい」という言い逃れを先に塞ぐ。
// [I1]「ダブルバトル…では相手全体に効果がある。」
test('MA-0 [土台/I1] ダブルでいかくは相手2枠ともに効く(phaseInitAが登場特性を回している証拠)', () => {
  const { E, f0, f1 } = setup();
  E.phaseInitA();
  assert.equal(f0.rank.atk, -1, '[I1] 相手枠0のこうげき-1');
  assert.equal(f1.rank.atk, -1, '[I1] 相手枠1のこうげき-1');
});

// ===== 主張1 [I3][M3] ミラーアーマーは受けず、いかく側のみ こうげき-1 ======================
// 「ミラーアーマーのポケモンはいかくの効果を跳ね返す。このときいかくのポケモンのみ攻撃が1段階下がる。」
test('MA-1 [I3] ダブル: ミラーアーマーの枠は下がらず、いかく側だけ こうげき-1', () => {
  const { E, intim, f0 } = setup({ ab0: 'ミラーアーマー' });
  E.phaseInitA();
  assert.equal(f0.rank.atk, 0,
    `[I3] ミラーアーマーの相手枠0は こうげきが下がらない。実際=${f0.rank.atk}`);
  assert.equal(intim.rank.atk, -1,
    `[I3]「いかくのポケモンのみ攻撃が1段階下がる」→ いかく側は -1。実際=${intim.rank.atk}`);
  assert.ok(reflectLines(E).length >= 1, '[I3] 跳ね返しのログが出ている');
});

// ===== 主張2 [M1] 跳ね返すのは持っている1体だけ・味方(もう1枠)は守られない =================
// 「複数のポケモンの能力を下げる効果を使われた場合、この特性を持っているポケモンのみが跳ね返し、
//   その他のポケモンが守られることはない。」
test('MA-2 [M1] ダブル: ミラーアーマーの味方(相手枠1)は守られず こうげき-1 のまま', () => {
  const { E, intim, f0, f1 } = setup({ ab0: 'ミラーアーマー' });
  E.phaseInitA();
  assert.equal(f1.rank.atk, -1,
    `[M1]「その他のポケモンが守られることはない」→ 相手枠1は -1。実際=${f1.rank.atk}`);
  assert.equal(f0.rank.atk, 0, '[M1] 跳ね返したのは持っている枠0だけ');
  assert.equal(intim.rank.atk, -1, '[M1] 跳ね返し1回ぶん=いかく側は -1');
});

// ===== 主張3 [M1] 跳ね返りの宛先は「発動させたポケモン単体」=いかく側の味方は下がらない ======
// 「ミラーアーマーでランク低下を跳ね返す対象は、技や特性を発動させたポケモン単体になる。」
test('MA-3 [M1] ダブル: 跳ね返りはいかくの本体だけ・いかく側の味方のランクは動かない', () => {
  const { E, mate } = setup({ ab0: 'ミラーアーマー', ab1: 'ミラーアーマー' });
  E.phaseInitA();
  for (const k of RANKS) {
    assert.equal(mate.rank[k] | 0, 0,
      `[M1]「発動させたポケモン単体」→ いかく側の味方(self:1)の ${k} は動かない。実際=${mate.rank[k]}`);
  }
});

// ===== 主張4 [M2] 2体ともミラーアーマー → いかく側は複数回下がる(こうげき-2) ==============
// 「…その分使用者は複数回ランクを低下させられる。」
test('MA-4 [M2] ダブル: 相手2体ともミラーアーマーなら いかく側は こうげき-2(2回ぶん)', () => {
  const { E, intim, f0, f1 } = setup({ ab0: 'ミラーアーマー', ab1: 'ミラーアーマー' });
  E.phaseInitA();
  assert.equal(f0.rank.atk, 0, '[M2] 相手枠0は下がらない');
  assert.equal(f1.rank.atk, 0, '[M2] 相手枠1も下がらない');
  assert.equal(intim.rank.atk, -2,
    `[M2]「その分使用者は複数回ランクを低下させられる」→ 2体ぶん=-2。実際=${intim.rank.atk}`);
  assert.equal(reflectLines(E).length, 2, '[M2] 跳ね返しは2回起きる');
});

// ===== 主張5 [I2][M2] 跳ね返りの順は「左側の敵→右側の敵」= 素早さ順ではない ================
// [I2]「第五世代以降は素早さに関係なく相手から見て左側のポケモンから順に攻撃を下げていく。」
// [M2]「いかく/わたげ/かんろなミツによる効果は 左側の敵→右側の敵→使用者の味方 の優先順に
//       ミラーアーマーが発動し」
// ★わざと「遅い方を idx 0(左) / 速い方を idx 1(右)」に置く。素早さ順なら速い方が先に来てしまうので、
//   固定順(左→右)かどうかがログの並びで分かる。
test('MA-5 [I2][M2] ダブル: 跳ね返りは左(idx0)→右(idx1)の固定順・素早さに影響されない', () => {
  // opp:0 = カメックス(すばやさ78・遅い) / opp:1 = ケンタロス(110・速い)
  const { E } = setup({ foe0: 'カメックス', ab0: 'ミラーアーマー', foe1: 'ケンタロス', ab1: 'ミラーアーマー' });
  assert.ok(E.realStat(E.slotOf('opp', 1), 'spd') > E.realStat(E.slotOf('opp', 0), 'spd'),
    '前提: idx1(右)の方が素早い配置になっている');
  E.phaseInitA();
  const lines = reflectLines(E);
  assert.equal(lines.length, 2, '跳ね返しログが2本');
  assert.ok(lines[0].includes('カメックス'),
    `[I2][M2] 先に跳ね返すのは左=idx0(カメックス)。実際の1本目=${JSON.stringify(lines[0])}`);
  assert.ok(lines[1].includes('ケンタロス'),
    `[I2][M2] 後が右=idx1(ケンタロス)。実際の2本目=${JSON.stringify(lines[1])}`);
});

// ===== 主張6 [I4][I5] 対象の攻撃がすでに最低なら不発 → その枠のミラーアーマーは発動しない ====
// [I4]「…すでに最低だったため攻撃が下がらなかった場合、ミラーアーマーは発動しない。」
// [I5] 手順: 「## 攻撃ランクがすでに最低なら不発」が「## ミラーアーマーの発動」より前の段にある。
// ★ダブル固有の形にする: 左(idx0)は こうげき-6 のミラーアーマー(=不発→跳ね返らない)、
//   右(idx1)は 0 のミラーアーマー(=跳ね返る)。正解は「いかく側は -1 だけ」。
//   per-target の判定が独立していれば、片方の門が閉じた分はいかく側に返ってこない。
test('MA-6 [I4][I5] ダブル: こうげき-6の枠ではミラーアーマーが発動しない(いかく側は-1だけ)', () => {
  const { E, intim, f0, f1 } = setup({ ab0: 'ミラーアーマー', ab1: 'ミラーアーマー' });
  f0.rank.atk = -6;   // 左(idx0)はすでに最低
  E.phaseInitA();
  assert.equal(f0.rank.atk, -6, '前提どおり 左(idx0)は -6 のまま(これ以上下がらない)');
  assert.equal(f1.rank.atk, 0, '[I4] 右(idx1)のミラーアーマーは下がらない');
  assert.equal(reflectLines(E).length, 1,
    `[I4]「すでに最低だったため攻撃が下がらなかった場合、ミラーアーマーは発動しない」→ 跳ね返しは右の1回だけ。実際=${reflectLines(E).length}回`);
  assert.equal(intim.rank.atk, -1,
    `[I4][I5] 跳ね返りは1回ぶんだけ=いかく側は -1。実際=${intim.rank.atk}`);
});
