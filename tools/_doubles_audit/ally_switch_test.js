/*
 * tools/_doubles_audit/ally_switch_test.js
 *   サイドチェンジ(ally-switch / 技No.502)のダブル挙動 監査テスト(読み取り専用・エンジンは直さない)
 *   実行: node tools/_doubles_audit/ally_switch_test.js
 *
 * ★期待値の出どころ(権威ソース。エンジンの出力を写していない):
 *  S1 ヤックン /ch/ (Champions版・ローカル写し reference/_authority_corpus_ch/moves_ch.json / master/moves.json
 *     の description_legacy と一字一句同じ・T5_味方連携技_verify.md #21/#22 で二重確認済):
 *     「必ず先制できる(優先度:+2)。自分と味方1体の位置を交代する。ダブルバトル用。」
 *     「第9世代からは、連続で使うと失敗しやすくなる。具体的には、最初は成功するが、使う度に
 *       成功率が1/3になっていく(失敗するとリセットされる)。」
 *  S2 ポケモンWiki「サイドチェンジ」https://wiki.pokemonwiki.com/wiki/サイドチェンジ (本セッションで実取得):
 *     第九世代の技説明 =「自分と味方の場所を入れ替える。連続で使うと成功率が 前に使った時の1/3になる。[優先度+2]」
 *     「ダブルバトルとトリプルバトルで効果を発揮する技。味方と位置を変更することで、相手が味方に対して
 *       使用した技を代わりに受けることができる。」
 *     「…の対象位置に技の使用者自身が移動していた場合、その技は失敗する。例えばダブルバトルで
 *       サイドチェンジ使用者Aに対し、味方Bがいやしのはどうを使用したとき、サイドチェンジが成功すると
 *       いやしのはどうの対象位置にいるポケモンがB自身に変わるが…」(=技の対象は「位置」に固定)
 *     「技が成功した後、次に使うサイドチェンジの成功率は約1/3ずつ低下していく。」
 *  S3 review/_doubles_research_2026-09-07/00_シングルとの違い一覧.md #36(区分A):
 *     「技の対象は『ポケモン』でなく『位置』に固定されるので、入替後はその位置にいる個体に当たる」
 *  Champions搭載: master/moves.json slug=ally-switch → champions:true / champions_added:true /
 *     champions_mode:"ダブル" / regulation:"M-C" / priority:2 / target:"自分"。
 *
 * 主張は4本に分け、テストも1主張=1testで独立させている(1本目が落ちても残りが走る)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require(path.join(__dirname, '..', '_sim_engine.js'));
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// tools/_doubles_fixture_test.js の placeSlot をそのまま写したもの(requireすると向こうのテストが走るため)
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

// 2枠×2側のfixture(_doubles_fixture_test.js の build2v2 と同じ流儀)
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

function msgList(log) {           // E.battleLog は vm(別レルム)配列なので1件ずつ詰め直す
  const out = [];
  for (let i = 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}
const nameAt = (E, side, idx) => (E.slotOf(side, idx).poke ? E.slotOf(side, idx).poke.name : null);

// サイドチェンジの使用者は学習者から採る(pokechan_data.js の WAZA_MAP.saidochenji.learners)
const USER_FAST = 'フーディン';   // 素早さ種族120(ケンタロス110より速い)
const USER_SLOW = 'ランクルス';   // 素早さ種族30(ケンタロス110より遅い=優先度の検証用)

// ===== 主張1: 技が成功すると「自分と味方1体の位置を交代する」(S1・S2の技説明) =====
test('ally-switch-1: 自分(self:1)と味方(self:0)の位置が入れ替わる', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null);
  placeSlot(E, 'self', 1, USER_FAST, 'saidochenji');
  placeSlot(E, 'opp', 0, 'フシギバナ', null);
  placeSlot(E, 'opp', 1, 'フシギバナ', null);
  E.setRandom(mulberry32(11));
  assert.doesNotThrow(() => { E.runTurn(); }, 'runTurn()が例外を出さない');
  // 出典の期待値: 1回目は必ず成功(S1「最初は成功する」)→ 枠の中身が入れ替わる
  assert.equal(nameAt(E, 'self', 0), USER_FAST,
    `使用者が味方の位置(self:0)へ移動するはず(実際=${nameAt(E, 'self', 0)})`);
  assert.equal(nameAt(E, 'self', 1), 'カメックス',
    `味方が使用者の位置(self:1)へ移動するはず(実際=${nameAt(E, 'self', 1)})`);
});

// ===== 主張2: 優先度+2=自分より速い相手の通常技(優先度0)より先に解決する(S1「必ず先制できる(優先度:+2)」/S2「[優先度+2]」) =====
test('ally-switch-2: 素早さで負けていても優先度+2で相手の通常技より先に動く', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null);
  placeSlot(E, 'self', 1, USER_SLOW, 'saidochenji');   // 種族30 < ケンタロス110
  placeSlot(E, 'opp', 0, 'ケンタロス', 'hataku');       // 優先度0
  placeSlot(E, 'opp', 1, 'フシギバナ', null);
  E.setRandom(mulberry32(12));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  const iSwitch = msgs.findIndex(m => m.includes('サイドチェンジ'));
  const iHataku = msgs.findIndex(m => m.includes('はたく'));
  assert.ok(iSwitch >= 0, `サイドチェンジの行がログに出るはず(ログ=${JSON.stringify(msgs)})`);
  assert.ok(iHataku >= 0, 'はたくの行がログに出るはず');
  assert.ok(iSwitch < iHataku,
    `優先度+2なので遅い使用者でも先に解決するはず(サイドチェンジ=${iSwitch}行目 / はたく=${iHataku}行目)`);
});

// ===== 主張3: 技の対象は「ポケモン」でなく「位置」に固定=入替後はその位置にいる個体に当たる
//       (S2「相手が味方に対して使用した技を代わりに受けることができる」「対象位置にいるポケモンが…変わる」/ S3 #36) =====
test('ally-switch-3: 相手が味方(self:0)に撃った単体技は、入替後にその位置へ来た使用者が受ける', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null);                 // 相手の既定対象(正面)
  placeSlot(E, 'self', 1, USER_SLOW, 'saidochenji');
  placeSlot(E, 'opp', 0, 'ケンタロス', 'hataku', { targetChoice: { side: 'self', idx: 0 } });
  placeSlot(E, 'opp', 1, 'フシギバナ', null);
  const maxOf = name => {
    for (const idx of [0, 1]) if (nameAt(E, 'self', idx) === name) return E.realStat(E.slotOf('self', idx), 'hp');
    return null;
  };
  const userMax = maxOf(USER_SLOW), allyMax = maxOf('カメックス');
  E.setRandom(mulberry32(13));
  E.runTurn();
  const hpOf = name => {
    for (const idx of [0, 1]) if (nameAt(E, 'self', idx) === name) return E.slotOf('self', idx).currentHp;
    return null;
  };
  // 出典の期待値: self:0 という「位置」が狙われているので、入替後にそこへ来た使用者が被弾し、
  // 本来狙われていた個体(カメックス)は self:1 へ逃げて無傷になる。
  assert.ok(hpOf(USER_SLOW) < userMax,
    `入替でself:0へ来た使用者が代わりに受けるはず(${USER_SLOW}のHP=${hpOf(USER_SLOW)}/${userMax})`);
  assert.equal(hpOf('カメックス'), allyMax,
    `入替でself:1へ移った味方は無傷のはず(カメックスのHP=${hpOf('カメックス')}/${allyMax})`);
});

// ===== 主張4: 第9世代の連続使用ペナルティ=1回目は必ず成功・2回連続目の成功率は1/3
//       (S1「最初は成功するが、使う度に成功率が1/3になっていく(失敗するとリセットされる)」/
//        S2「技が成功した後、次に使うサイドチェンジの成功率は約1/3ずつ低下していく」) =====
test('ally-switch-4: 1ターン目は必ず成功・2ターン連続目の成功率は約1/3に落ちる', () => {
  const TRIALS = 240;
  let firstOk = 0, secondOk = 0;
  for (let seed = 1; seed <= TRIALS; seed++) {
    const E = build2v2();
    placeSlot(E, 'self', 0, 'カメックス', null);
    placeSlot(E, 'self', 1, USER_FAST, 'saidochenji');
    placeSlot(E, 'opp', 0, 'フシギバナ', null);
    placeSlot(E, 'opp', 1, 'フシギバナ', null);
    E.setRandom(mulberry32(seed));
    E.runTurn();                                   // 1回目(出典: 必ず成功)
    const after1 = nameAt(E, 'self', 0) === USER_FAST;
    if (after1) firstOk++;
    // 2ターン目も同じ使用者に同じ技を宣言させる(枠が入れ替わっていれば使用者は self:0 側にいる)
    const userIdx = nameAt(E, 'self', 0) === USER_FAST ? 0 : 1;
    const st = E.slotOf('self', userIdx);
    st.moves = [data.WAZA_MAP['saidochenji']];
    st.selectedMoveIdx = 0;
    E.runTurn();                                   // 2回目(出典: 成功率 1/3)
    // 2回目が成功すれば位置は元に戻る(使用者が self:1 に戻る)。失敗すればそのまま。
    if (after1 && nameAt(E, 'self', 1) === USER_FAST) secondOk++;
  }
  const firstRate = firstOk / TRIALS, secondRate = secondOk / TRIALS;
  assert.equal(firstRate, 1,
    `1回目は必ず成功するはず(実測 成功率=${firstRate} / ${firstOk}/${TRIALS})`);
  assert.ok(secondRate > 0.20 && secondRate < 0.47,
    `2回連続目の成功率は約1/3(0.333)のはず(実測=${secondRate.toFixed(3)} / ${secondOk}/${TRIALS})`);
});
