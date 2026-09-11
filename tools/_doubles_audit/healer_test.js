/*
 * tools/_doubles_audit/healer_test.js — 監査: 特性「いやしのこころ」のダブルでの挙動
 * 実行: node tools/_doubles_audit/healer_test.js
 *
 * ★このファイルは監査用(エンジンは直さない)。期待値は権威ソース(ポケモンWiki)の引用から立てる。
 *   エンジンの出力を写して期待値にしない(自己参照=偽の正解・CLAUDE.md「バトル再現の北極星」)。
 *   ダブル限定の挙動だけを見る(シングルの動作は対象外)。
 *
 * 出典1: ポケモンWiki『いやしのこころ』 https://wiki.pokemonwiki.com/wiki/いやしのこころ (oldid=815725・2026-09-11 取得)
 *   「効果」節(一字一句):
 *     「ターン終了時に、自分に隣接する味方の状態異常が50％ (スカーレット・バイオレットまでは30%) の確率で回復する。」
 *   「説明文」節 Champions(一字一句): 「ターン終わりに 状態異常の味方を 50%の確率で治す。」
 *   「特性の仕様」節(一字一句):
 *     ・「こんらんなどの状態変化は治せない。」
 *     ・「いやしのこころのポケモン自身の状態異常は治せない。」
 *     ・「場に出ていない控えの味方には効果がない。」
 *     ・「トリプルバトルでは隣接していない味方は治せない。」
 *     ・「発動のタイミングはターンの終了時になる。」
 *     ・「どく/もうどく/やけど/あくむ/ナイトメアのダメージ判定より前であるため、いやしのこころが発動する
 *        ターンはこれらのダメージを受けない。」
 *   「備考」節(一字一句): 「自分の状態異常は治せないため、シングルバトルで発動することはない。」
 *
 * 出典2: master/abilities.json slug=healer (champions:true / regulation:"M-C" / champions_pokemon_count:4)
 *   effect_ja(一字一句): 「毎ターン終了時、50%の確率で自分以外の味方の状態異常が治る。(ポケモンSVまでは1/3の確率)
 *     自分に隣接する味方にのみ効果があり、控えのポケモンには効かない。『こんらん』などの状態変化は治せない。」
 *   → Champions搭載済み=blockedではない。確率の正典は Champions の 50%
 *     ([[champions-plus-alpha-canon-rule]]: ①Championsに在る値が正典)。
 *   ※ review/_doubles_research_2026-09-07/T6_特性と持ち物.md #22 は「30%」と書いているが、それはWikiの
 *     「スカーレット・バイオレットまでは30%」側の値。Champions説明文とmaster effect_jaが揃って50%なので
 *     本監査の期待値は 50% を採る。
 *
 * ダブルでどう動くべきか(主張・各1テスト):
 *   C1 ターン終了時、隣の味方(ダブルではもう片方の枠)の状態異常が50%の確率で治る。
 *   C2 いやしのこころ本人の状態異常は治せない(味方は治るのに自分は治らない)。
 *   C3 こんらんなどの「状態変化」は治せない(同じターンに状態異常は治っても こんらん は残る)。
 *   C4 どく/やけどのダメージ判定より前に発動する=治ったターンはスリップダメージを受けない。
 *
 * ★各テストには「同じ条件で味方が実際に治る」対照を必ず同居させる。こうしないと「何も起きないエンジン」が
 *   『治らない』側の assert だけで空振り合格してしまう(エンジンがそうしているから通る、を防ぐ)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('./../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const ABILITY = 'いやしのこころ';
const HEALER_POKE = 'タブンネ';    // pokechan_data.js(Champions版)で ab1=いやしのこころ
const ALLY_POKE = 'カメックス';    // 味方役。ab1=げきりゅう(この盤面では何もしない)
const ALLY_ABILITY = 'げきりゅう';
const FOE_POKE = 'ケンタロス';
const FOE_ABILITY = 'どんかん';    // 本来のいかく(ランク干渉)を持ち込まないため明示的に置き換える
const SAFE_MOVE = 'tsuruginomai';  // 無害な自分対象技(ダメージ0=スリップダメージの観測を汚さない)
const N = 200;                     // 1主張あたりの試行数(seedを1ずつ変えて回す)

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// 枠1つに任意のポケモン/技/HPを置く(_doubles_fixture_test.js の placeSlot をそのまま写したもの。
// require しないのは、あのファイルが読み込むだけでテストを実行してしまうため)。
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
  E.sides.self.poke = pokeByName(HEALER_POKE);
  E.sides.self.moves = [];
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.poke = pokeByName(FOE_POKE);
  E.sides.opp.moves = [];
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.resetBattle();
  return E;
}

// ★E.battleLogはvm(別レルム)の配列。for文で1件ずつこの場の文字列に詰め直す(fixture testの既知の罠と同じ)。
function msgList(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}

/* 1ターンだけ回す。
 *   opt.healerIdx : いやしのこころを置く自分側の枠(0 or 1)。味方はもう片方の枠(=ダブルでは常に隣接)
 *   opt.allyStatus / opt.healerStatus : 状態異常コード('burn'/'poison'/...)
 *   opt.allyConfusion : 味方に置くこんらんの残りターン
 *   opt.allyHp : 味方のHPを固定(スリップダメージの観測用)
 * 返り値はこの場(Nodeレルム)のプレーンな値だけ。 */
function runTrial(E, seed, opt) {
  opt = opt || {};
  const hIdx = opt.healerIdx != null ? opt.healerIdx : 0;
  const aIdx = hIdx === 0 ? 1 : 0;
  E.resetBattle();   // HP/状態/ランクを初期化(battleLogもクリアされる)
  const healer = placeSlot(E, 'self', hIdx, HEALER_POKE, SAFE_MOVE, { ability: ABILITY });
  const ally = placeSlot(E, 'self', aIdx, ALLY_POKE, SAFE_MOVE,
    Object.assign({ ability: ALLY_ABILITY }, opt.allyHp != null ? { hp: opt.allyHp } : {}));
  placeSlot(E, 'opp', 0, FOE_POKE, SAFE_MOVE, { ability: FOE_ABILITY });
  placeSlot(E, 'opp', 1, FOE_POKE, SAFE_MOVE, { ability: FOE_ABILITY });
  if (opt.allyStatus) ally.status = opt.allyStatus;
  if (opt.healerStatus) healer.status = opt.healerStatus;
  if (opt.allyConfusion) ally.confusion = opt.allyConfusion;
  const allyHpBefore = ally.currentHp;
  E.setRandom(mulberry32(seed));
  E.runTurn();
  return {
    allyStatus: String(ally.status),
    healerStatus: String(healer.status),
    allyConfusion: Number(ally.confusion || 0),
    allyHpBefore: allyHpBefore,
    allyHpAfter: ally.currentHp,
    healerAbility: String(E.sideAbility(healer)),
    msgs: msgList(E.battleLog),
  };
}

// ===== 前提: 対象の特性がこの枠に乗っていること(テストが空振りでないことの足場) =====
test('healer-0(前提): self:0 の タブンネ の特性が いやしのこころ として読めている', () => {
  const E = build2v2();
  const r = runTrial(E, 1, { allyStatus: 'burn' });
  assert.equal(r.healerAbility, ABILITY,
    `sideAbility()が「${ABILITY}」を返す。実際=${r.healerAbility}`);
});

// ===== C1: ターン終了時、隣の味方の状態異常が50%で治る =====
// Wiki「効果」: 「ターン終了時に、自分に隣接する味方の状態異常が50％ (…) の確率で回復する。」
// Champions説明文: 「ターン終わりに 状態異常の味方を 50%の確率で治す。」
test('healer-C1: 隣の味方(self:1)のやけどが ターン終了時に 50%の確率で治る', () => {
  const E = build2v2();
  let cured = 0;
  for (let seed = 1; seed <= N; seed++) {
    if (runTrial(E, seed, { healerIdx: 0, allyStatus: 'burn' }).allyStatus === 'none') cured++;
  }
  assert.ok(cured > 0,
    `いやしのこころが1度も発動していない(治った回数=${cured}/${N})。` +
    `Wiki「ターン終了時に、自分に隣接する味方の状態異常が50％…の確率で回復する」`);
  // 50%なら期待値100・標準偏差約7.07 → ±3.5σで 75〜125。旧値30%(約60件)はこの帯の外に落ちる。
  assert.ok(cured >= 75 && cured <= 125,
    `治った回数が50%の帯(75〜125)に入る。実際=${cured}/${N}(約${(100 * cured / N).toFixed(1)}%)`);
});

// ===== C2: 本人の状態異常は治せない =====
// Wiki「特性の仕様」: 「いやしのこころのポケモン自身の状態異常は治せない。」
// Wiki「備考」: 「自分の状態異常は治せないため、シングルバトルで発動することはない。」
test('healer-C2: 本人と味方が同じやけどでも、味方だけ治り 本人は1度も治らない', () => {
  const E = build2v2();
  let allyCured = 0, selfCured = 0;
  for (let seed = 1001; seed <= 1000 + N; seed++) {
    const r = runTrial(E, seed, { healerIdx: 0, allyStatus: 'burn', healerStatus: 'burn' });
    if (r.allyStatus === 'none') allyCured++;
    if (r.healerStatus === 'none') selfCured++;
  }
  // 対照(同じターンに味方は治る)= 「何も起きないエンジン」ではここで落ちる
  assert.ok(allyCured > 0,
    `対照: 同じ条件で味方(self:1)のやけどは治る。実際=${allyCured}/${N}`);
  assert.equal(selfCured, 0,
    `いやしのこころ本人(self:0)のやけどは1度も治らない。実際=${selfCured}/${N}`);
});

// ===== C3: こんらん等の状態変化は治せない =====
// Wiki「特性の仕様」: 「こんらんなどの状態変化は治せない。」
// master effect_ja: 「『こんらん』などの状態変化は治せない。」
test('healer-C3: 味方のやけどは治るが、同じ味方のこんらんは消えない', () => {
  const E = build2v2();
  let statusCured = 0, confusionCleared = 0;
  for (let seed = 2001; seed <= 2000 + N; seed++) {
    const r = runTrial(E, seed, { healerIdx: 0, allyStatus: 'burn', allyConfusion: 5 });
    if (r.allyStatus === 'none') statusCured++;
    if (r.allyConfusion === 0) confusionCleared++;   // 残り5から始めるので自然減(1/ターン)では0にならない
  }
  assert.ok(statusCured > 0,
    `対照: 同じ味方のやけど(状態異常)は治る。実際=${statusCured}/${N}`);
  assert.equal(confusionCleared, 0,
    `こんらん(状態変化)は治らない=残りターンが0にならない。実際に0になった回数=${confusionCleared}/${N}`);
});

// ===== C4: スリップダメージ判定より前に発動する =====
// Wiki「特性の仕様」: 「どく/もうどく/やけど/あくむ/ナイトメアのダメージ判定より前であるため、
//   いやしのこころが発動するターンはこれらのダメージを受けない。」
// ★ここでは いやしのこころ を self:1 に、どく状態の味方を self:0 に置く(ダブルでは両枠が互いに隣接=
//   Wikiの「隣接する味方」の条件はどちらの並びでも満たす)。
test('healer-C4: どくが治ったターンは 味方が どくダメージを受けない(治らなかったターンは受ける)', () => {
  const E = build2v2();
  const FIXED_HP = 100;
  let cured = 0, notCured = 0, curedButDamaged = 0, notCuredButUndamaged = 0;
  for (let seed = 3001; seed <= 3000 + N; seed++) {
    const r = runTrial(E, seed, { healerIdx: 1, allyStatus: 'poison', allyHp: FIXED_HP });
    const damaged = r.allyHpAfter < r.allyHpBefore ||
      r.msgs.some(m => new RegExp(`^${ALLY_POKE} は どくで \\d+ ダメージ`).test(m));
    if (r.allyStatus === 'none') { cured++; if (damaged) curedButDamaged++; }
    else { notCured++; if (!damaged) notCuredButUndamaged++; }
  }
  assert.equal(notCuredButUndamaged, 0,
    `対照: 治らなかったターンは どくダメージを受ける(最大HPの1/8)。` +
    `受けなかった回数=${notCuredButUndamaged}/${notCured}`);
  assert.ok(cured > 0,
    `対照: どくも いやしのこころ で治る(治った回数=${cured}/${N})。Wiki「…状態異常が…の確率で回復する」`);
  assert.equal(curedButDamaged, 0,
    `治ったターンは どくダメージを受けない(発動がダメージ判定より前)。受けた回数=${curedButDamaged}/${cured}`);
});
