/*
 * tools/_doubles_audit/power_of_alchemy_receiver_test.js
 * 監査対象: かがくのちから/レシーバー(倒れた味方の特性を引き継ぐ)のダブル挙動
 * 実行: node tools/_doubles_audit/power_of_alchemy_receiver_test.js
 *
 * ★このファイルは「監査」=エンジンを直さない。期待値は権威ソースの引用から書く。
 *   エンジンの出力を写して期待値にしてはいけない(自己参照=偽の正解。CLAUDE.md「バトル再現の北極星」)。
 *
 * 出典(一字一句):
 *  [S1] ポケモンWiki「レシーバー」 https://wiki.pokemonwiki.com/wiki/レシーバー (2026年7月19日版)
 *       効果節: 「味方のポケモンがひんしになったとき、そのポケモンの特性と同じ特性になる。」
 *       効果節: 「コピーできない特性を持つ味方がひんしになったときは発動しない。」
 *       こんなときに使おう節: 「シングルバトルでは意味がない、ダブルバトル専用の特性。」
 *       こんなときに使おう節: 「ただし、仲間のポケモンが倒されるまでは無特性と同じであることには注意。」
 *       特性の仕様節: 「かがくのちからと全く同じ効果を持つ。かがくのちから#特性の仕様を参照とする。」
 *       所有ポケモン節: ナゲツケサル(特性1=レシーバー / 隠れ特性=まけんき)
 *  [S2] ポケモンWiki「かがくのちから」 https://wiki.pokemonwiki.com/wiki/かがくのちから (2026年8月30日版)
 *       特性の仕様節: 「場に出た時に発動する特性をコピーした場合、コピーした直後にその特性の効果が発動する。」
 *  [S3] master/abilities.json slug=receiver effect_ja:
 *       「場にいる味方のポケモンが『ひんし』状態になった時、自分の特性がそのポケモンと同じ特性になる。
 *         場から離れると元に戻る(ダブルバトル用)。味方の特性が『…』『ばけのかわ』『…』の場合は効果がない。」
 *       → コピー不可リストに『ばけのかわ』が入っている(本テストの不可側サンプル)。
 *  [S4] review/_doubles_research_2026-09-07/T6_特性と持ち物.md #26(引用付き事実・Champions確認=レシーバーY(1))
 *  [S5] T6 #1 / wiki「いかく」: 「ダブルバトルでは相手全体に効果がある」
 *       (主張4で「コピーしたいかくが直後に発動する」の観測点として使う)
 *
 * Champions搭載の確認(master):
 *  - レシーバー  : champions=true / regulation="M-C" / champions_pokemon_count=1(ナゲツケサル) → 搭載=対象
 *  - かがくのちから: champions=false / champions_pokemon_count=0              → Champions非搭載
 *  同一機構(「かがくのちからと全く同じ効果を持つ」[S1])なので、搭載側のレシーバーで機構を検証する。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require(path.join(__dirname, '..', '_sim_engine.js'));
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// --- tools/_doubles_fixture_test.js の流儀をそのままコピー(requireしない=あちらは実行でテストが走る) ---
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
function msgList(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}

// ---------------------------------------------------------------------------
// 共通fixture: 自分側 = ナゲツケサル(レシーバー) + 味方1体。相手側の opp:1 が
// 正面(self:1)の味方を はたく で倒す(味方HP=1 / はたく=命中100)。
// 相手の2体には atk ランクを動かさない きあいだめ を持たせる(主張4の観測を汚さないため)。
// ---------------------------------------------------------------------------
function allyFaintsScene(allyAbility, seed) {
  const E = build2v2();
  const receiver = placeSlot(E, 'self', 0, 'ナゲツケサル', 'kiaidame', { ability: 'レシーバー' });
  const ally = placeSlot(E, 'self', 1, 'フシギバナ', 'kiaidame', { hp: 1, ability: allyAbility });
  const oppA = placeSlot(E, 'opp', 0, 'ケンタロス', 'kiaidame', { ability: '' });
  const oppB = placeSlot(E, 'opp', 1, 'リザードン', 'hataku', { ability: '' });
  E.setRandom(mulberry32(seed == null ? 3 : seed));
  E.runTurn();
  return { E, receiver, ally, oppA, oppB, msgs: msgList(E.battleLog) };
}

// ===== 主張1: 味方がひんしになったとき、自分の特性はその味方の特性と同じになる =====
// [S1]「味方のポケモンがひんしになったとき、そのポケモンの特性と同じ特性になる。」
// [S3]「場にいる味方のポケモンが『ひんし』状態になった時、自分の特性がそのポケモンと同じ特性になる。」
// 期待値は「ようりょくそ」(=倒れた味方が持っていた特性名)。コピー不可リスト[S3]に載っていない特性を選んだ。
test('claim1: 味方(ようりょくそ)がひんしになった直後、レシーバー持ちの特性が ようりょくそ になる', () => {
  const s = allyFaintsScene('ようりょくそ');
  assert.equal(s.ally.fainted, true,
    `前提: 味方が実際にひんしになっていること。log=${JSON.stringify(s.msgs)}`);
  assert.equal(s.E.sideAbility(s.receiver), 'ようりょくそ',
    '[S1]「味方のポケモンがひんしになったとき、そのポケモンの特性と同じ特性になる」' +
    `→ 倒れた味方の特性 ようりょくそ になるべき。実際=${JSON.stringify(s.E.sideAbility(s.receiver))}`);
});

// ===== 主張2: コピーできない特性を持つ味方が倒れたときは発動しない(可/不可で結果が分かれる) =====
// [S1]「コピーできない特性を持つ味方がひんしになったときは発動しない。」
// [S3] コピー不可リストに『ばけのかわ』が含まれる。
// ★差分法で書く: 「不可なら レシーバー のまま」だけを見ると、機構が丸ごと未実装でも通ってしまう
//   (=エンジンがそうしているから通る悪いテスト)。可の場合と不可の場合で結果が「分かれること」を要求する。
test('claim2: コピー可(ようりょくそ)は引き継ぎ・コピー不可(ばけのかわ)は不発で、結果が分かれる', () => {
  const ok = allyFaintsScene('ようりょくそ');
  const ng = allyFaintsScene('ばけのかわ');
  assert.equal(ok.ally.fainted, true, '前提: 可の側でも味方がひんしになっている');
  assert.equal(ng.ally.fainted, true, '前提: 不可の側でも味方がひんしになっている');
  const abOk = ok.E.sideAbility(ok.receiver);
  const abNg = ng.E.sideAbility(ng.receiver);
  assert.equal(abNg, 'レシーバー',
    '[S1]「コピーできない特性を持つ味方がひんしになったときは発動しない」' +
    `→ ばけのかわ の味方が倒れてもレシーバーのまま。実際=${JSON.stringify(abNg)}`);
  assert.notEqual(abOk, abNg,
    'コピー可の味方が倒れた時と、コピー不可の味方が倒れた時で特性は違う結果になるべき' +
    `(可=${JSON.stringify(abOk)} / 不可=${JSON.stringify(abNg)} が同じ=コピー機構そのものが無い)`);
});

// ===== 主張3: 相手が倒れても発動しない(「味方」限定=ダブル専用である理由) =====
// [S1]「味方のポケモンがひんしになったとき」(=味方限定。自分以外が倒れると発動するのはソウルハート)
// [S1]「シングルバトルでは意味がない、ダブルバトル専用の特性。」(=味方枠が無いシングルでは不発)
test('claim3: 相手側のポケモンがひんしになっても引き継がない(レシーバーのまま)', () => {
  const E = build2v2();
  const receiver = placeSlot(E, 'self', 0, 'ナゲツケサル', 'kiaidame', { ability: 'レシーバー' });
  // self:1 が正面の opp:1 を倒す。倒れるのは「相手」=引き継ぎの対象外。
  placeSlot(E, 'self', 1, 'リザードン', 'hataku', { ability: '' });
  placeSlot(E, 'opp', 0, 'ケンタロス', 'kiaidame', { ability: '' });
  const oppB = placeSlot(E, 'opp', 1, 'フシギバナ', 'kiaidame', { hp: 1, ability: 'ようりょくそ' });
  E.setRandom(mulberry32(5));
  E.runTurn();
  assert.equal(oppB.fainted, true,
    `前提: 相手(opp:1)が実際にひんしになっていること。log=${JSON.stringify(msgList(E.battleLog))}`);
  assert.equal(E.sideAbility(receiver), 'レシーバー',
    '[S1]「味方のポケモンがひんしになったとき」=味方限定。相手が倒れても引き継がない。' +
    `実際=${JSON.stringify(E.sideAbility(receiver))}`);
});

// ===== 主張4: 場に出た時に発動する特性をコピーしたら、コピーした直後にその効果が発動する =====
// [S2]「場に出た時に発動する特性をコピーした場合、コピーした直後にその特性の効果が発動する。」
// 観測点: いかく。[S5]「ダブルバトルでは相手全体に効果がある」→ 相手2体のこうげきが -1 になる。
// (この場の相手2体は きあいだめ=こうげきランクを動かさない技なので、-1 は いかく 由来しかありえない)
test('claim4: 倒れた味方の いかく を引き継ぐと、その場で いかく が発動して相手2体のこうげき-1', () => {
  const s = allyFaintsScene('いかく', 11);
  assert.equal(s.ally.fainted, true, '前提: いかく持ちの味方がひんしになっている');
  assert.equal(s.E.sideAbility(s.receiver), 'いかく',
    `前提(主張1と同じ): いかく を引き継いでいること。実際=${JSON.stringify(s.E.sideAbility(s.receiver))}`);
  assert.equal(s.oppA.rank.atk, -1,
    '[S2]「コピーした直後にその特性の効果が発動する」+[S5]「ダブルバトルでは相手全体に効果がある」' +
    `→ opp:0 のこうげき-1。実際=${s.oppA.rank.atk}`);
  assert.equal(s.oppB.rank.atk, -1,
    `同上 → opp:1 のこうげきも-1。実際=${s.oppB.rank.atk}`);
});

// ===== 主張5: 味方が倒れるまでは無特性と同じ(勝手に引き継がない) =====
// [S1]「ただし、仲間のポケモンが倒されるまでは無特性と同じであることには注意。」
test('claim5: 誰もひんしにならないターンでは、味方の特性を引き継がない(レシーバーのまま)', () => {
  const E = build2v2();
  const receiver = placeSlot(E, 'self', 0, 'ナゲツケサル', 'kiaidame', { ability: 'レシーバー' });
  const ally = placeSlot(E, 'self', 1, 'フシギバナ', 'kiaidame', { ability: 'ようりょくそ' });  // HP満タン
  placeSlot(E, 'opp', 0, 'ケンタロス', 'kiaidame', { ability: '' });
  placeSlot(E, 'opp', 1, 'リザードン', 'kiaidame', { ability: '' });
  E.setRandom(mulberry32(7));
  E.runTurn();
  assert.equal(ally.fainted, false, '前提: 味方は倒れていない');
  assert.equal(E.sideAbility(receiver), 'レシーバー',
    '[S1]「仲間のポケモンが倒されるまでは無特性と同じ」→ 引き継ぎは起きない。' +
    `実際=${JSON.stringify(E.sideAbility(receiver))}`);
});
