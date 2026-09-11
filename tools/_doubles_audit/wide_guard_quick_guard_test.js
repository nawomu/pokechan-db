/*
 * tools/_doubles_audit/wide_guard_quick_guard_test.js
 *   ダブル監査: ワイドガード / ファストガード(味方全体を範囲技・先制技から守る)
 *   実行: node tools/_doubles_audit/wide_guard_quick_guard_test.js
 *
 * ★このファイルは「監査」=エンジンを直さない。期待値はすべて権威ソースの逐語引用から立てる。
 *   エンジンの現在の出力を正解にしない(バトル再現_羅針盤「自己出力をゴールデンにしない」)。
 *
 * ── Champions 搭載確認(master/moves.json・2026-09-11 実測) ──────────────────
 *   ワイドガード key 468: champions=true / priority=3 / target='味方の場' / category='変化'
 *   ファストガード key 500: champions=true / priority=3 / target='味方の場' / category='変化'
 *   → 両方とも Champions 搭載。status=blocked ではない。
 *   (参考: トリックガード key 577 は champions=false = 対象外)
 *
 * ── 出典 ────────────────────────────────────────────────────────────────────
 *   review/_doubles_research_2026-09-07/T4_引き寄せと保護.md
 *   review/_doubles_research_2026-09-07/T4_引き寄せと保護_verify.md(二重チェック済・等級A/B)
 *   一次 = ポケモンWiki「ワイドガード」/「ファストガード」/「まもる」, Bulbapedia Wide Guard /
 *          Quick Guard / Protection, ヤックン /ch/ corpus(Champions effect 文)
 *
 * ── 主張(逐語引用つき) ─────────────────────────────────────────────────────
 *  C1 [verify #25・等級A] ワイドガードは味方全体を複数対象技から守る
 *     JP Wiki ワイドガード 逐語:「そのターンの間、味方全体を複数のポケモンが対象になる技から守る。」
 *     ch corpus 逐語:「そのターンの間、自分と味方は相手や味方が使った複数のポケモンが対象の技を受けない。」
 *     → 使用者だけでなく「味方」も守られる。これがシングルとの差。
 *
 *  C2 [verify #26・等級A] 味方が撃った巻き添えの複数対象技も防ぐ
 *     JP Wiki ワイドガード 逐語:「味方が使う じしん や なみのり など 自分以外が対象のわざ も防ぐことができる」
 *     Bulbapedia 逐語: "including ally moves like Earthquake and Surf"
 *
 *  C3 [verify 結論節・等級A] ワイドガードは単体技を防げない
 *     結論節 逐語:「複数対象技(allAdjacent / allAdjacentFoes)だけ」を防ぐ /「**単体技は防げない**」
 *     Showdown wideguard 実コード(verify #27 で引用訂正済):
 *       `if (move?.target !== 'allAdjacent' && move.target !== 'allAdjacentFoes') { return; }`
 *     → 過剰ブロックを禁じる負のコントロール。
 *
 *  C4 [verify #29・等級A] ファストガードは味方全体を「優先度が高いわざ」から守る
 *     JP Wiki ファストガード 逐語:「そのターンの間、味方全体を優先度が高いわざから守る。」
 *     ch corpus 逐語:「特性の効果による先制攻撃も受けない」(= Champions 確定)
 *     → 使用者だけでなく「味方」も守られる。
 *
 *  C5 [verify 矛盾・要注意 §1・等級B(JP Wiki + Showdown 実装の2ソース一致)]
 *     ワイドガード/ファストガードは自分自身は連続使用で失敗しない(第六世代以降)
 *     verify 逐語:「**第六世代以降**: WG/FG は**自分自身は連続使用で失敗しない**。しかし**成功すると
 *     カウンターは進む**ため、**その後に使うまもる系の成功率が 1/3, 1/9… に落ちる**」
 *     Showdown 実装: `wideguard`/`quickguard` の `onTry` は `return !!this.queue.willAct();` のみで
 *     **stall を参照しない**(= 自分は落ちない)。`onHitSide` で `addVolatile('stall')` はする(= 他を縛る)。
 *     → 本テストが見るのは前半「自分は失敗しない」だけ(後半のカウンター前進は別主張=本件の範囲外)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// placeSlot / build2v2 は tools/_doubles_fixture_test.js の流儀をそのまま写したもの。
// ★require しない(あのファイルは読み込むとテストを実行してしまう)ので定義をコピーしている。
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
  // resetBattle() が slots[1] を生やすには「側」に何か居る必要がある(_slots_test.js と同じ流儀)
  for (const s of ['self', 'opp']) {
    E.sides[s].poke = pokeByName('フシギバナ');
    E.sides[s].moves = [];
    E.sides[s].currentHp = E.realStat(E.sides[s], 'hp');
  }
  E.resetBattle();
  return E;
}

// ★E.battleLog は vm(別レルム)の配列。for で1件ずつ文字列に写す(_doubles_fixture_test.js の既知の罠)。
function msgList(E) {
  const out = [];
  for (let i = 0; i < E.battleLog.length; i++) out.push(String(E.battleLog[i].msg));
  return out;
}
function dump(E) { return '\n--- battleLog ---\n' + msgList(E).join('\n') + '\n-----------------'; }

// データ前提の自己確認(master→view の値が動いたらテストの意味が変わるのでここで固定する)
const WIDE = data.WAZA_MAP['waidogaado'];
const FAST = data.WAZA_MAP['fasutogaado'];
const JISHIN = data.WAZA_MAP['jishin'];
const SEKKA = data.WAZA_MAP['denkousekka'];

test('前提: ワイドガード/ファストガードは Champions 搭載・優先度+3・範囲=味方の場', () => {
  assert.equal(WIDE.name, 'ワイドガード');
  assert.equal(FAST.name, 'ファストガード');
  // 出典 C1/C4: 範囲は「味方の場」(=味方全体に効く側の状態)・優先度+3
  assert.equal(WIDE.target, '味方の場', 'ワイドガードの範囲は味方の場(= 味方全体が守られる)');
  assert.equal(FAST.target, '味方の場', 'ファストガードの範囲は味方の場(= 味方全体が守られる)');
  assert.equal(WIDE.battle_data.priority, 3, 'ワイドガードは優先度+3(JP Wiki)');
  assert.equal(FAST.battle_data.priority, 3, 'ファストガードは優先度+3(JP Wiki)');
  // 前提となる攻撃技の性質
  assert.equal(JISHIN.target, '自分以外全体', 'じしんは複数対象技(自分以外全体)');
  assert.equal(SEKKA.battle_data.priority, 1, 'でんこうせっかは優先度+1(= 先制技)');
});

// ===== C1: ワイドガードは「味方」を相手の複数対象技から守る =====
// JP Wiki 逐語「そのターンの間、味方全体を複数のポケモンが対象になる技から守る。」
test('C1: ワイドガードは使用者の味方も相手のじしん(複数対象技)から守る', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'waidogaado');   // ワイドガードを使う側
  placeSlot(E, 'self', 1, 'カメックス', null);            // 守られるべき「味方」(行動しない)
  placeSlot(E, 'opp', 0, 'ケンタロス', 'jishin');          // 相手の複数対象技
  placeSlot(E, 'opp', 1, 'カメックス', null);
  E.setRandom(mulberry32(5));
  const userHp0 = E.slotOf('self', 0).currentHp;
  const allyHp0 = E.slotOf('self', 1).currentHp;
  E.runTurn();
  const userHp1 = E.slotOf('self', 0).currentHp;
  const allyHp1 = E.slotOf('self', 1).currentHp;
  // 期待値は出典から: ワイドガードが成立したターン、じしんは自陣のどちらにも通らない。
  assert.equal(userHp1, userHp0,
    `ワイドガード使用者はじしんを受けない(JP Wiki「味方全体を…守る」)。HP ${userHp0}→${userHp1}` + dump(E));
  assert.equal(allyHp1, allyHp0,
    `★味方も守られる(ここがシングルとの差)。味方HP ${allyHp0}→${allyHp1}` + dump(E));
});

// ===== C2: 味方が撃った巻き添えの複数対象技も防ぐ =====
// JP Wiki 逐語「味方が使う じしん や なみのり など 自分以外が対象のわざ も防ぐことができる」
test('C2: ワイドガードは味方が撃ったじしんの巻き添えからも自分を守る', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'waidogaado');   // 優先度+3 で先に成立する
  placeSlot(E, 'self', 1, 'カメックス', 'jishin');        // 味方が撃つ = 自分(self:0)が巻き添えになる
  placeSlot(E, 'opp', 0, 'ケンタロス', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  E.setRandom(mulberry32(11));
  const userHp0 = E.slotOf('self', 0).currentHp;
  E.runTurn();
  const userHp1 = E.slotOf('self', 0).currentHp;
  // 味方のじしんが実際に撃たれたことを確認(技が不発なら test が無意味になるため)
  const log = msgList(E);
  assert.ok(log.some(m => m.includes('じしん')), '味方のじしんがこのターン実際に撃たれている' + dump(E));
  assert.equal(userHp1, userHp0,
    `味方が撃った複数対象技の巻き添えもワイドガードで防ぐ(JP Wiki 逐語)。HP ${userHp0}→${userHp1}` + dump(E));
});

// ===== C3: 単体技は防げない(過剰ブロックの禁止・負のコントロール) =====
// verify 結論節 逐語「複数対象技(allAdjacent / allAdjacentFoes)だけ」/「単体技は防げない」
test('C3: ワイドガードは単体技(はたく)を防がない', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'waidogaado');
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ケンタロス', 'hataku', { targetChoice: { side: 'self', idx: 0 } });
  placeSlot(E, 'opp', 1, 'カメックス', null);
  E.setRandom(mulberry32(5));
  const hp0 = E.slotOf('self', 0).currentHp;
  E.runTurn();
  const hp1 = E.slotOf('self', 0).currentHp;
  assert.ok(hp1 < hp0,
    `ワイドガード中でも単体技は通る(= 過剰ブロックしていない)。HP ${hp0}→${hp1}` + dump(E));
});

// ===== C4: ファストガードは「味方」を先制技から守る =====
// JP Wiki 逐語「そのターンの間、味方全体を優先度が高いわざから守る。」
test('C4: ファストガードは使用者の味方も相手の先制技(でんこうせっか)から守る', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'fasutogaado');   // ファストガードを使う側
  placeSlot(E, 'self', 1, 'カメックス', null);             // 守られるべき「味方」
  // 相手は先制技(優先度+1)を「味方(self:1)」に向けて撃つ
  placeSlot(E, 'opp', 0, 'ケンタロス', 'denkousekka', { targetChoice: { side: 'self', idx: 1 } });
  placeSlot(E, 'opp', 1, 'カメックス', null);
  E.setRandom(mulberry32(5));
  const allyHp0 = E.slotOf('self', 1).currentHp;
  E.runTurn();
  const allyHp1 = E.slotOf('self', 1).currentHp;
  assert.equal(allyHp1, allyHp0,
    `★ファストガードは味方も先制技から守る(JP Wiki「味方全体を優先度が高いわざから守る」)。` +
    `味方HP ${allyHp0}→${allyHp1}` + dump(E));
});

// ===== C5: 自分自身は連続使用で失敗しない(第六世代以降) =====
// verify §1 逐語「WG/FG は自分自身は連続使用で失敗しない」/ Showdown onTry は stall を参照しない
test('C5: ファストガードを3ターン連続で使っても自分は失敗しない', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'fasutogaado');
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ケンタロス', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  // まもる系の「連続使用で成功率が下がる」実装があれば必ず踏むよう、乱数を常に 0.99 に固定する
  // (成功率が 1 未満になった瞬間に失敗する = 連続使用ペナルティの有無を決定的に可視化できる)。
  E.setRandom(() => 0.99);
  for (let t = 0; t < 3; t++) E.runTurn();
  const log = msgList(E);
  const fails = log.filter(m => m.includes('ファストガード') && m.includes('きまらなかった'));
  assert.equal(fails.length, 0,
    `ファストガード自身は連続使用で失敗しない(第六世代以降)。失敗行 ${fails.length} 本: ` +
    JSON.stringify(fails) + dump(E));
});

// ===== おまけ(同じ主張をワイドガードでも見る) =====
test('C5b: ワイドガードを3ターン連続で使っても自分は失敗しない', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', 'waidogaado');
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ケンタロス', null);
  placeSlot(E, 'opp', 1, 'カメックス', null);
  E.setRandom(() => 0.99);
  for (let t = 0; t < 3; t++) E.runTurn();
  const log = msgList(E);
  const fails = log.filter(m => m.includes('ワイドガード') && m.includes('きまらなかった'));
  assert.equal(fails.length, 0,
    `ワイドガード自身は連続使用で失敗しない(第六世代以降)。失敗行 ${fails.length} 本: ` +
    JSON.stringify(fails) + dump(E));
});
