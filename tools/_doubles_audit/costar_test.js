/*
 * tools/_doubles_audit/costar_test.js — 監査(修正しない): きょうえん(Costar)のダブルバトル挙動
 * 実行: node tools/_doubles_audit/costar_test.js
 *
 * ★監査用。期待値は「エンジンの出力」からではなく権威ソース(ポケモンWiki)の文言から立てる
 *   (CLAUDE.md バトル再現の北極星=自己出力を正解にしない)。
 *
 * ── 出典(一字一句・2026-09-11 取得)─────────────────────────────────────────
 *  取得: curl -sL -A "Mozilla/5.0" https://wiki.pokemonwiki.com/wiki/きょうえん
 *        (旧ドメイン wiki.xn--rckteqa2e.com は 301 で上記へ移動)
 *
 *  [W1] 『効果』節
 *       「場に出たとき、自分のランク補正ときゅうしょアップ状態の有無を、味方と同じ状態にする。」
 *  [W2] 『特性の仕様』節
 *       「下がったランク補正もコピーする。」
 *  [W3] 『特性の仕様』節
 *       「バトンタッチできょうえんのポケモンがランクを引き継いだときや、ランクが変わっているポケモンの
 *        特性がきょうえんに変わった場合でも、特性が発動すると元のランクは上書きされて味方のランクと
 *        同じになる。」
 *  [W4] 『特性の仕様』節
 *       「すでにきゅうしょアップ状態のポケモンが、きゅうしょアップ状態でない味方の能力をコピーした場合、
 *        きゅうしょアップ状態は消える。」
 *  [W5] 『特性の仕様』節
 *       「シングルバトルのときか、ダブルバトルでも味方がひんしになって場にいないときは発動しない。」
 *  [W6] 『特性の仕様』節
 *       「場に出たときに味方がいれば、味方のランク補正が変化していない場合でも特性バーが出て
 *        「<所有者>は 味方の 能力変化を コピーした!」とメッセージが流れる。」
 *  (ランク補正+2=×2.0 も同Wiki『ランク補正』の公開値。本ファイルはこの値だけを使う)
 *
 * ── Champions 搭載状況(master = SSOT)────────────────────────────────────────
 *  master/abilities.json items[slug=costar]: "champions": false / "champions_pokemon_count": 0
 *  所有ポケモン(Wiki『所有ポケモン』節)= カラミンゴ(隠れ特性) → master/pokemon.json で champions:false
 *  pokechan_data.js(Champions版ビュー)にカラミンゴは不在(348体)・ABILITY_DESC にも きょうえん 無し
 *   → Champions 非搭載。このファイルは「器としてどうあるべきか」を出典で固定する監査記録であって、
 *     いますぐ実装せよという要求ではない(status=blocked の根拠資料)。
 *
 * ── 流儀 ────────────────────────────────────────────────────────────────────
 *  tools/_doubles_fixture_test.js と同じ(buildEngine / setFormat({slotsPerSide:2}) / placeSlot /
 *  battleLog)。placeSlot / build2v2 は同ファイルからのコピー(require すると向こうのテストが走る)。
 *  登場時特性の発動点は E.phaseInitA()(real_battle_simulator.html:3063・中身は fireEntryAbility:3080
 *  を速度降順で回す=「場に出た時の特性」の唯一のディスパッチ点。attemptSwitch/megaEvolve もここを呼ぶ)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// ---- tools/_doubles_fixture_test.js からコピー ----
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

// ---- 監査用の最小配置 -----------------------------------------------------
// self:0 = 味方(コピー元) / self:1 = きょうえん持ち(コピー先)。
// きょうえん以外の要因でランクが動くと判定が濁るので、残り3枠は登場時に何もしない特性で固定する
// (ふみん=Insomnia。fireEntryAbility:3080 の分岐に一切該当しない)。
const INERT = 'ふみん';
const RANKS = ['atk', 'def', 'spatk', 'spdef', 'spd', 'acc', 'eva'];
function rankSnapshot(st) {
  const o = {};
  for (const k of RANKS) o[k] = st.rank[k] | 0;
  return o;
}
function setup(opts) {
  opts = opts || {};
  const E = build2v2();
  // 味方=フシギバナ(80) / きょうえん持ち=カメックス(78)。
  // ★カラミンゴは Champions版ビューに不在なので、特性だけ placeSlot の opts.ability で載せる
  //   (監査の対象は「きょうえんという機構」であって種族ではない)。
  const ally = placeSlot(E, 'self', 0, 'フシギバナ', 'hataku', { ability: INERT });
  const costar = placeSlot(E, 'self', 1, 'カメックス', 'hataku', { ability: 'きょうえん' });
  placeSlot(E, 'opp', 0, 'リザードン', 'hataku', { ability: INERT });
  placeSlot(E, 'opp', 1, 'ケンタロス', 'hataku', { ability: INERT });
  for (const k of RANKS) { ally.rank[k] = 0; costar.rank[k] = 0; }
  ally.critBoost = 0; costar.critBoost = 0;
  if (opts.allyFainted) { ally.fainted = true; ally.currentHp = 0; }
  E.setRandom(mulberry32(1));
  assert.equal(E.sideAbility(costar), 'きょうえん', '前提: きょうえん持ちとして認識されている');
  return { E, ally, costar };
}

// ===== 0: 土台の正当性確認(ポジティブ・コントロール) ======================================
// 「主張1〜6が落ちたのは fixture が登場時特性を回していないせい」という言い逃れを塞ぐため、
// 実装済みの登場時特性(いかく)が同じ fixture/同じ E.phaseInitA() で確かに発動することを先に示す。
// (いかく= real_battle_simulator.html:3090。きょうえんと同じ fireEntryAbility の分岐の隣)
test('costar-0 [土台] 同じfixtureで実装済みの登場時特性(いかく)はphaseInitA()で発動する', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'ケンタロス', 'hataku', { ability: 'いかく' });
  placeSlot(E, 'self', 1, 'カメックス', 'hataku', { ability: INERT });
  const t0 = placeSlot(E, 'opp', 0, 'リザードン', 'hataku', { ability: INERT });
  const t1 = placeSlot(E, 'opp', 1, 'フシギバナ', 'hataku', { ability: INERT });
  E.setRandom(mulberry32(1));
  E.phaseInitA();
  assert.equal(t0.rank.atk, -1, 'いかくで相手枠0のこうげきが-1(=phaseInitA()が登場特性を回している証拠)');
  assert.equal(t1.rank.atk, -1, 'いかくで相手枠1のこうげきも-1');
  assert.ok(msgList(E.battleLog).some(m => m.includes('いかく')), 'いかくの発動ログが出ている');
});

// ===== 主張1 [W1] 登場時に味方の(上がった)ランク補正が自分にコピーされる ==================
test('costar-1 [W1] 登場時に味方の上昇ランクが自分にコピーされ、能力値に効く', () => {
  const { E, ally, costar } = setup();
  ally.rank.atk = 2;     // 味方は こうげき+2
  ally.rank.spd = 1;     //        すばやさ+1
  const rawAtk = E.realStat(costar, 'atk');
  E.phaseInitA();
  assert.equal(costar.rank.atk, 2,
    `[W1]「味方と同じ状態にする」→ こうげき+2 がコピーされる。実際=${costar.rank.atk}`);
  assert.equal(costar.rank.spd, 1,
    `[W1] すばやさ+1 もコピーされる。実際=${costar.rank.spd}`);
  // 状態だけでなく実際の能力値に効いていること(+2=×2.0・Wiki『ランク補正』の公開値)
  assert.equal(E.rankedStat(costar, 'atk'), Math.floor(rawAtk * 2),
    `コピー後のこうげき実数値は ランク+2(×2.0)が乗る。` +
    `実際=${E.rankedStat(costar, 'atk')} / 期待=${Math.floor(rawAtk * 2)}(素=${rawAtk})`);
});

// ===== 主張2 [W2] 下がったランク補正もコピーする ==========================================
test('costar-2 [W2] 味方の下降ランク(マイナス)もそのままコピーする', () => {
  const { E, ally, costar } = setup();
  ally.rank.atk = -2;    // 味方は こうげき-2
  ally.rank.eva = -1;    //        かいひ-1
  const rawAtk = E.realStat(costar, 'atk');
  E.phaseInitA();
  assert.equal(costar.rank.atk, -2,
    `[W2]「下がったランク補正もコピーする。」→ こうげき-2 になる。実際=${costar.rank.atk}`);
  assert.equal(costar.rank.eva, -1,
    `[W2] かいひ-1 もコピーされる(7項目すべてが対象)。実際=${costar.rank.eva}`);
  assert.equal(E.rankedStat(costar, 'atk'), Math.floor(rawAtk * 2 / 4),
    `こうげき-2(×0.5)が実数値に効く。実際=${E.rankedStat(costar, 'atk')} / 期待=${Math.floor(rawAtk * 2 / 4)}`);
});

// ===== 主張3 [W3] 自分が既に持っているランクは「上書き」される(加算でない) ================
test('costar-3 [W3] 自分の元のランクは上書きされて味方のランクと同じになる(加算しない)', () => {
  const { E, ally, costar } = setup();
  ally.rank.atk = -1;    // 味方: こうげき-1・ぼうぎょ+1
  ally.rank.def = 1;
  costar.rank.atk = 3;   // きょうえん側はバトンタッチ等で こうげき+3 を持っている
  costar.rank.spd = 2;   // 味方が動かしていない項目も「味方と同じ=0」に戻るべき
  E.phaseInitA();
  assert.equal(costar.rank.atk, -1,
    `[W3]「元のランクは上書きされて味方のランクと同じになる」→ +3 は残らず -1 になる` +
    `(加算なら+2・保持なら+3)。実際=${costar.rank.atk}`);
  assert.equal(costar.rank.spd, 0,
    `[W3] 味方が0の項目は自分の+2が消えて0になる。実際=${costar.rank.spd}`);
  assert.deepEqual(rankSnapshot(costar), rankSnapshot(ally),
    `[W1][W3] 7項目すべてが味方と同じ状態になる。` +
    `実際=${JSON.stringify(rankSnapshot(costar))} / 味方=${JSON.stringify(rankSnapshot(ally))}`);
});

// ===== 主張4 [W1] きゅうしょアップ状態の「有無」もコピーされる ============================
test('costar-4 [W1] 味方がきゅうしょアップ状態なら自分もきゅうしょアップ状態になる', () => {
  const { E, ally, costar } = setup();
  // きゅうしょアップ状態の保持先 = st.critBoost(real_battle_simulator.html:1284・
  // 急所ランクの式 3480 が読む。きあいだめ=+2 / 5313行)
  ally.critBoost = 2;
  E.phaseInitA();
  assert.ok(costar.critBoost > 0,
    `[W1]「きゅうしょアップ状態の有無を、味方と同じ状態にする。」→ 自分もきゅうしょアップになる。` +
    `実際 critBoost=${costar.critBoost}`);
  assert.equal(costar.critBoost, ally.critBoost,
    `同じ状態=段も味方と一致(きあいだめ=+2)。実際 自分=${costar.critBoost}/味方=${ally.critBoost}`);
});

// ===== 主張5 [W4] 自分が急所アップ・味方が急所アップでないなら、自分の急所アップは消える ====
test('costar-5 [W4] 味方が急所アップでないとき、自分の既存のきゅうしょアップ状態は消える', () => {
  const { E, ally, costar } = setup();
  ally.critBoost = 0;     // 味方は きあいだめ していない
  costar.critBoost = 2;   // きょうえん側は既にきゅうしょアップ
  E.phaseInitA();
  assert.equal(costar.critBoost, 0,
    `[W4]「すでにきゅうしょアップ状態のポケモンが、きゅうしょアップ状態でない味方の能力を` +
    `コピーした場合、きゅうしょアップ状態は消える。」→ 0 になる。実際=${costar.critBoost}`);
});

// ===== 主張6 [W6] 味方のランクが無変化でも発動して発動メッセージが出る ====================
test('costar-6 [W6] 味方のランクが変化していなくても発動し、コピーのログが出る', () => {
  const { E, costar } = setup();   // 味方のランクは全部0(setup が0で揃える)
  E.phaseInitA();
  const msgs = msgList(E.battleLog).filter(m => /コピー/.test(m));
  assert.ok(msgs.length >= 1,
    `[W6]「味方のランク補正が変化していない場合でも特性バーが出て「<所有者>は 味方の 能力変化を ` +
    `コピーした!」とメッセージが流れる。」→ コピーのログが1行以上出る。` +
    `実際のInit-Aログ=${JSON.stringify(msgList(E.battleLog))}`);
  assert.ok(msgs.some(m => m.includes(costar.poke.name)),
    `そのログは きょうえん持ち(${costar.poke.name})の行である。実際=${JSON.stringify(msgs)}`);
});

// ===== 主張7 [W5] 味方がひんしで場にいないときは発動しない(ネガティブ・コントロール) ======
// ★これは「起きてはいけない」側の主張。未実装エンジンでも自動的に通るので、
//   この1本だけで合格を主張してはいけない(主張1〜6と必ずセットで読む)。
test('costar-7 [W5] 味方がひんしで場にいないときは発動せず、自分のランク/急所アップは変わらない', () => {
  const { E, ally, costar } = setup({ allyFainted: true });
  ally.rank.atk = 2;      // 倒れた味方のランク(コピーされてはいけない)
  ally.critBoost = 2;
  costar.rank.spd = -1;   // きょうえん側が元から持っているランク(保持されるべき)
  const before = rankSnapshot(costar);
  E.phaseInitA();
  assert.deepEqual(rankSnapshot(costar), before,
    `[W5]「ダブルバトルでも味方がひんしになって場にいないときは発動しない。」→ ランクは変化しない。` +
    `実際=${JSON.stringify(rankSnapshot(costar))} / 期待=${JSON.stringify(before)}`);
  assert.equal(costar.critBoost, 0, '[W5] 倒れた味方のきゅうしょアップももらわない');
  const msgs = msgList(E.battleLog).filter(m => /コピー/.test(m));
  assert.deepEqual(msgs, [], `[W5] コピーのログが出ない。実際=${JSON.stringify(msgs)}`);
});
