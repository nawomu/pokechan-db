/*
 * tools/_doubles_audit/tailwind_screens_both_slots_test.js
 *   ダブル監査: 「側(陣営)に残る効果」が両枠に効くか
 *     おいかぜ / リフレクター / ひかりのかべ / オーロラベール(+ ダブルでの壁は 1/2 ではなく 2/3)
 *   実行: node tools/_doubles_audit/tailwind_screens_both_slots_test.js
 *
 * 立場: 監査(修正はしない)。期待値は権威ソースの引用だけから立てる。
 *       エンジンの出力を期待値に写さない(CLAUDE.md「バトル再現の北極星」)。
 *       シングルの動作は対象外。ここは E.setFormat({slotsPerSide:2}) の fixture だけを見る。
 *
 * ──────────────── 出典(一字一句の引用) ────────────────
 * [S1] ポケモンWiki「おいかぜ」(ローカル保存 reference/_authority_corpus/moves/おいかぜ.json,
 *      url=https://wiki.pokemonwiki.com/wiki/おいかぜ, fetched_at 2026-07-28)
 *      範囲欄: 「味方の場」
 *      効果欄: 「味方の場を4ターン(第四世代では3ターン)の間おいかぜ状態にし、味方全員のすばやさを2倍にする。」
 *      #説明文/たたかうわざ 第七世代・第八世代・第九世代:
 *      「はげしく ふきあれる かぜのうずを つくり 4ターンの あいだ みかた ぜんいんの すばやさを あげる。」
 * [S2] ヤックン Champions 版 おいかぜ(= master/moves.json の description。ローカル一次資料)
 *      「4ターンの間、自分と味方の『すばやさ』が2倍になる。」
 *      (review/_doubles_research_2026-09-07/T5_味方連携技.md #60 に同一引用。
 *       同 T5_味方連携技_verify.md #60 で「引用一字一句一致」として co-sign 済み)
 * [S3] ポケモンWiki「リフレクター」(ローカル reference/_authority_corpus/moves/リフレクター.json,
 *      url=https://wiki.pokemonwiki.com/wiki/リフレクター, fetched_at 2026-07-28)
 *      範囲欄: 「自分(第一世代)\n→味方の場(第二世代以降)」
 *      効果欄: 「5ターンの間、味方の場をリフレクター状態にし、物理技で受けるダメージを減らす。」
 * [S4] ポケモンWiki「ひかりのかべ」(ローカル reference/_authority_corpus/moves/ひかりのかべ.json,
 *      url=https://wiki.pokemonwiki.com/wiki/ひかりのかべ, fetched_at 2026-07-28)
 *      範囲欄: 「自分(第一世代)\n→味方の場(第二世代以降)」
 *      効果欄: 「5ターンの間、味方の場をひかりのかべ状態にし、特殊技で受けるダメージを減らす。」
 * [S5] ポケモンWiki「オーロラベール」(ローカル reference/_authority_corpus/moves/オーロラベール.json,
 *      url=https://wiki.pokemonwiki.com/wiki/オーロラベール, fetched_at 2026-07-28)
 *      範囲欄: 「味方の場」
 *      効果欄: 「5ターンの間、味方の場をオーロラベール状態にし、攻撃技で受けるダメージを減らす。
 *               天候があられ7-8/ゆき9-になっているときのみ成功する。」
 * [S6] ヤックン Champions 版 オーロラベール(= master/moves.json の description)
 *      「天気が『ゆき』状態の時のみ使用でき、5ターンの間、自分と味方が受ける相手の物理攻撃と
 *        特殊攻撃のダメージを半分にする。味方が複数の場合は半分ではなく2/3になる。
 *        急所に当たった場合は軽減されない。交代しても効果は続く。」
 * [S7] ヤックン Champions 版 リフレクター / ひかりのかべ(= master/moves.json の description)
 *      リフレクター「5ターンの間、相手の物理攻撃のダメージを半分にする。味方が複数の場合は半分ではなく
 *        2/3になる。急所に当たった場合は軽減されない。交代しても効果は続く。」
 *      ひかりのかべ「5ターンの間、相手の特殊攻撃のダメージを半分にする。味方が複数の場合は半分ではなく
 *        2/3になる。急所に当たった場合は軽減されない。交代しても効果は続く。」
 *      (review/_doubles_research_2026-09-07/T3_範囲技と補正.md #10 に同一引用・Champions確認=Y)
 * [S8] ポケモンWiki「ダブルバトル」(T3_範囲技と補正.md #8 の引用)
 *      「壁によるダメージ補正率が1/2から2/3に弱体化する。正確な補正率は、第四世代では2/3、
 *        第五世代では2703/4096、第六世代以降では2732/4096となる。」
 * [S9] ポケモンWiki「ダブルバトル」(T3_範囲技と補正.md #11 の引用)
 *      「効果を受けているポケモンが1体しかいない場合のダメージ補正率は、第四世代以前では1/2になる。
 *        第五世代以降では2/3になる。」
 *      (= 第五世代以降は「受け手の数」で 1/2 に戻らない)
 *
 * ──────────────── Champions 搭載の確認 ────────────────
 * master/moves.json: おいかぜ champions=true / リフレクター champions=true /
 *                    ひかりのかべ champions=true / オーロラベール champions=true
 *                    4技すべて target=「味方の場」
 *   → blocked ではない(4技とも Champions に搭載)。
 *
 * ──────────────── 主張(期待値の出どころ) ────────────────
 * C1  おいかぜは「味方の場」の状態で、味方全員(=ダブルの自陣2枠とも)のすばやさが2倍になる。[S1][S2]
 * C1b (ズレの範囲を切り分けるための対照) 使用者自身の枠のすばやさは2倍になる。[S1][S2]
 * C2  リフレクターは「味方の場」をリフレクター状態にする=相方の枠が受ける物理ダメージも減る。[S3][S7]
 * C3  ひかりのかべは「味方の場」をひかりのかべ状態にする=相方の枠が受ける特殊ダメージも減る。[S4][S7]
 * C4  オーロラベールは「味方の場」をオーロラベール状態にする=両枠とも物理・特殊の両方が減る。[S5][S6]
 * C5  ダブル(味方が複数)での壁の軽減は1/2ではなく2732/4096(≒2/3)。[S7][S8][S9]
 *
 * ※「1/2 か 2/3 か」を味方の残り数で切り替えないこと(受け手が1体だけでも2/3)は[S9]の通り。
 *   シングル(slotsPerSide=1)の倍率は本監査の対象外([S9]とChampions効果文[S7]が食い違う論点のため
 *   ここでは触れない=境界線)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require(path.resolve(__dirname, '..', '_sim_engine.js'));
const data = require(path.join(ROOT, 'pokechan_data.js'));
const masterMoves = require(path.join(ROOT, 'master', 'moves.json'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
const masterMoveByName = n => (masterMoves.items || []).find(m => m.name === n);

// 枠1つに任意のポケモン/技/HPを置く(tools/_doubles_fixture_test.js の placeSlot をそのまま写した)。
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

// 2枠×2側のfixture(tools/_doubles_fixture_test.js の build2v2 と同じ流儀)。
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

// ★E.battleLogはvm(別レルム)の配列。for文で1件ずつ文字列に詰め直す(既知の罠)。
function msgList(log, from) {
  const out = [];
  for (let i = from || 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}
// 「<だれか> の <わざ>！」の行だけ拾って行動順を取る。
function actorOrder(msgs) {
  const out = [];
  for (const m of msgs) {
    const mm = /^(.+?) の (.+?)！/.exec(m);
    if (mm) out.push(mm[1]);
  }
  return out;
}

// ===== 前提: 4技すべて Champions 搭載(非搭載なら監査不能=blocked) =====
test('前提: おいかぜ/リフレクター/ひかりのかべ/オーロラベールは Champions 搭載(master/moves.json champions=true)', () => {
  for (const n of ['おいかぜ', 'リフレクター', 'ひかりのかべ', 'オーロラベール']) {
    const m = masterMoveByName(n);
    assert.ok(m, `master/moves.json に ${n} が在る`);
    assert.equal(m.champions, true, `${n} は Champions 搭載(champions=true)`);
    assert.equal(m.target, '味方の場', `${n} の target は「味方の場」(=側に効く技) / 実際=${m.target}`);
  }
});

// ─────────────────────────────────────────────────────────────────
// C1: おいかぜ = 味方の場 → 相方の枠のすばやさも2倍 [S1][S2]
//   観測手段: 行動順。カメックス(実数値98)は おいかぜ で196になり、ケンタロス(130)より先に動く。
//   「2倍」を素の数値で見ないのは effectiveSpeed() が非公開のため(行動順=実機で見える結果)。
// ─────────────────────────────────────────────────────────────────
// 自陣 枠0 が おいかぜ(または対照の つるぎのまい)を使った次のターンの行動順を返す。
function tailwindScenario(useTailwind, watchSlotIdx, watchPoke) {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'フシギバナ', useTailwind ? 'oikaze' : 'tsuruginomai');
  // 観測したい枠(watchSlotIdx)に watchPoke を置き、相手の ケンタロス と殴り合わせて順番を見る。
  // HPは十分に持たせて「先に倒れたから行動しなかった」を排除する。
  if (watchSlotIdx === 0) {
    placeSlot(E, 'self', 1, null, null);
  } else {
    placeSlot(E, 'self', 1, watchPoke, 'hataku', { targetChoice: { side: 'opp', idx: 0 }, hp: 400 });
  }
  placeSlot(E, 'opp', 0, 'ケンタロス', 'hataku', { targetChoice: { side: 'self', idx: watchSlotIdx }, hp: 400 });
  placeSlot(E, 'opp', 1, null, null);
  E.setRandom(mulberry32(11));
  E.runTurn();                       // ターン1: おいかぜを張る(順番はまだ変わらない)
  const mark = E.battleLog.length;

  // ターン2: 観測する枠だけ殴る。おいかぜを張った枠0は、観測対象が枠1のときは黙らせる。
  if (watchSlotIdx === 0) {
    const st = placeSlot(E, 'self', 0, watchPoke, 'hataku', { targetChoice: { side: 'opp', idx: 0 }, hp: 400 });
    st.selectedMoveIdx = 0;
  } else {
    E.slotOf('self', 0).moves = [];
    E.slotOf('self', 0).selectedMoveIdx = null;
    E.slotOf('self', 1).selectedMoveIdx = 0;
  }
  E.slotOf('opp', 0).selectedMoveIdx = 0;
  E.runTurn();
  return { order: actorOrder(msgList(E.battleLog, mark)), msgs: msgList(E.battleLog, mark) };
}

test('C1: おいかぜ(味方の場)で「相方の枠」のすばやさも2倍になり、速い相手より先に動く', () => {
  // 素の実数値: カメックス98 < ケンタロス130 < カメックス×2=196
  const E0 = build2v2();
  const spdKame = E0.realStat(placeSlot(E0, 'self', 1, 'カメックス', 'hataku'), 'spd');
  const spdKen = E0.realStat(placeSlot(E0, 'opp', 0, 'ケンタロス', 'hataku'), 'spd');
  assert.ok(spdKame < spdKen && spdKen < spdKame * 2,
    `fixtureの前提: カメックス(${spdKame}) < ケンタロス(${spdKen}) < カメックス×2(${spdKame * 2})`);

  const withTw = tailwindScenario(true, 1, 'カメックス');
  const without = tailwindScenario(false, 1, 'カメックス');

  // 対照(おいかぜ無し): 遅いので ケンタロス が先
  assert.equal(without.order[0], '相手の ケンタロス',
    `対照(おいかぜ無し)ではケンタロスが先に動く。実際=${JSON.stringify(without.order)}`);
  // 主張: おいかぜは「味方全員のすばやさを2倍にする」[S1] = 相方の枠も2倍 → カメックスが先
  assert.equal(withTw.order[0], 'カメックス',
    'おいかぜは「味方の場」の状態で味方全員のすばやさが2倍[S1][S2]。相方の枠(self:1)も2倍なら ' +
    `カメックス(196)がケンタロス(${spdKen})より先に動くはず。実際の順=${JSON.stringify(withTw.order)}\n` +
    withTw.msgs.join('\n'));
});

test('C1b(対照): おいかぜを使った「自分の枠」のすばやさは2倍になる(ズレの範囲の切り分け)', () => {
  // 使用者自身(フシギバナ100→200)がケンタロス130より先に動くか。ここが通れば
  // 「おいかぜの倍速そのもの」は在る=C1のfailは“側に広がっていない”ことだけを意味する。
  const E0 = build2v2();
  const spdFushi = E0.realStat(placeSlot(E0, 'self', 0, 'フシギバナ', 'hataku'), 'spd');
  const spdKen = E0.realStat(placeSlot(E0, 'opp', 0, 'ケンタロス', 'hataku'), 'spd');
  assert.ok(spdFushi < spdKen && spdKen < spdFushi * 2,
    `fixtureの前提: フシギバナ(${spdFushi}) < ケンタロス(${spdKen}) < フシギバナ×2(${spdFushi * 2})`);

  const withTw = tailwindScenario(true, 0, 'フシギバナ');
  assert.equal(withTw.order[0], 'フシギバナ',
    `おいかぜ使用者自身(self:0)は2倍[S1][S2]。実際の順=${JSON.stringify(withTw.order)}\n` + withTw.msgs.join('\n'));
});

// ─────────────────────────────────────────────────────────────────
// C2/C3/C4/C5: 壁。calcDamage(乱数を使わない)で「張る前/張った後」の最大ダメージを比べる。
//   急所は opts 無指定=非急所(壁が無視される条件を踏まない)。
// ─────────────────────────────────────────────────────────────────
const PHYS = data.WAZA_MAP['hataku'];            // はたく(物理・1体選択)
const SPEC = data.WAZA_MAP['saikokineshisu'];    // サイコキネシス(特殊・1体選択)

// 自陣 枠0 が壁技を使う。両枠について「張る前/後」の物理・特殊の最大ダメージを返す。
function screenScenario(moveKey, weather) {
  const E = build2v2();
  if (weather) E.env.weather = weather;          // オーロラベールは ゆき でしか成功しない[S5][S6]
  placeSlot(E, 'self', 0, 'フシギバナ', moveKey);
  placeSlot(E, 'self', 1, 'カメックス', null, { hp: 400 });
  placeSlot(E, 'opp', 0, 'ケンタロス', null, { hp: 400 });
  placeSlot(E, 'opp', 1, null, null);
  const read = () => ({
    phys0: E.calcDamage('opp', 'self', PHYS, {}, 0, 0).max,
    phys1: E.calcDamage('opp', 'self', PHYS, {}, 0, 1).max,
    spec0: E.calcDamage('opp', 'self', SPEC, {}, 0, 0).max,
    spec1: E.calcDamage('opp', 'self', SPEC, {}, 0, 1).max,
  });
  const before = read();
  E.setRandom(mulberry32(5));
  E.runTurn();
  const after = read();
  const lines = msgList(E.battleLog).filter(m => /張られた|きまらなかった/.test(m));
  return { before, after, lines };
}

// 2732/4096(≒2/3)に落ちているか。壁はダメージ式の途中に挟まる(以降も丸めが入る)ので ±1 を許す。
function assertTwoThirds(before, after, label, lines) {
  const want23 = before * 2732 / 4096;
  const want12 = before * 2048 / 4096;
  assert.ok(Math.abs(after - want23) <= 1,
    `${label}: ダブルの壁は2732/4096(≒2/3)[S7][S8]。軽減前=${before} → 期待≒${want23.toFixed(1)} / 実際=${after}\n` +
    lines.join('\n'));
  assert.ok(Math.abs(after - want12) > 1,
    `${label}: ダブルでは1/2にしてはいけない[S7][S8]。1/2なら≒${want12.toFixed(1)} / 実際=${after}`);
}

test('C2: リフレクター(味方の場)は「相方の枠」が受ける物理ダメージも減らす', () => {
  const r = screenScenario('rifurekutaa');
  assert.ok(r.lines.some(m => /リフレクター が 張られた/.test(m)),
    `前提: リフレクターが張られている。ログ=${JSON.stringify(r.lines)}`);
  // 対照(使用者の枠): 減っていること(=壁そのものは効いている)
  assert.ok(r.after.phys0 < r.before.phys0,
    `対照: 使用者の枠(self:0)の物理は減る。${r.before.phys0} → ${r.after.phys0}`);
  // 主張: 「味方の場をリフレクター状態にし、物理技で受けるダメージを減らす」[S3] → 相方も減る
  assert.ok(r.after.phys1 < r.before.phys1,
    'リフレクターは「味方の場」をリフレクター状態にする[S3]=相方の枠(self:1)の物理ダメージも減るはず。' +
    `self:1 物理 張る前=${r.before.phys1} / 張った後=${r.after.phys1}(変化なし=側に広がっていない)`);
  assertTwoThirds(r.before.phys1, r.after.phys1, 'self:1 物理(リフレクター)', r.lines);
  // 物理の壁なので特殊は減らない(壁の種類の取り違えが無いことの確認)
  assert.equal(r.after.spec0, r.before.spec0, 'リフレクターは特殊を減らさない(self:0)');
});

test('C3: ひかりのかべ(味方の場)は「相方の枠」が受ける特殊ダメージも減らす', () => {
  const r = screenScenario('hikarinokabe');
  assert.ok(r.lines.some(m => /ひかりのかべ が 張られた/.test(m)),
    `前提: ひかりのかべが張られている。ログ=${JSON.stringify(r.lines)}`);
  assert.ok(r.after.spec0 < r.before.spec0,
    `対照: 使用者の枠(self:0)の特殊は減る。${r.before.spec0} → ${r.after.spec0}`);
  assert.ok(r.after.spec1 < r.before.spec1,
    'ひかりのかべは「味方の場」をひかりのかべ状態にする[S4]=相方の枠(self:1)の特殊ダメージも減るはず。' +
    `self:1 特殊 張る前=${r.before.spec1} / 張った後=${r.after.spec1}(変化なし=側に広がっていない)`);
  assertTwoThirds(r.before.spec1, r.after.spec1, 'self:1 特殊(ひかりのかべ)', r.lines);
  assert.equal(r.after.phys0, r.before.phys0, 'ひかりのかべは物理を減らさない(self:0)');
});

test('C4: オーロラベール(味方の場)は両枠の物理・特殊をどちらも減らす', () => {
  const r = screenScenario('oororaberu', 'snow');
  assert.ok(r.lines.some(m => /オーロラベール が 張られた/.test(m)),
    `前提: ゆき下でオーロラベールが張られている[S5][S6]。ログ=${JSON.stringify(r.lines)}`);
  // 使用者の枠は物理・特殊の両方(=「攻撃技で受けるダメージ」[S5])
  assert.ok(r.after.phys0 < r.before.phys0, `self:0 物理も減る。${r.before.phys0} → ${r.after.phys0}`);
  assert.ok(r.after.spec0 < r.before.spec0, `self:0 特殊も減る。${r.before.spec0} → ${r.after.spec0}`);
  // 主張: 「自分と味方が受ける相手の物理攻撃と特殊攻撃のダメージ」[S6] → 相方の枠も両方
  assert.ok(r.after.phys1 < r.before.phys1,
    'オーロラベールは「自分と味方が受ける…物理攻撃と特殊攻撃」を減らす[S6]=相方の枠(self:1)の物理も減るはず。' +
    `self:1 物理 張る前=${r.before.phys1} / 張った後=${r.after.phys1}`);
  assert.ok(r.after.spec1 < r.before.spec1,
    'オーロラベールは相方の枠(self:1)の特殊も減らすはず[S6]。' +
    `self:1 特殊 張る前=${r.before.spec1} / 張った後=${r.after.spec1}`);
  assertTwoThirds(r.before.phys1, r.after.phys1, 'self:1 物理(オーロラベール)', r.lines);
  assertTwoThirds(r.before.spec1, r.after.spec1, 'self:1 特殊(オーロラベール)', r.lines);
});

test('C5: ダブルでの壁の軽減率は1/2ではなく2732/4096(≒2/3)', () => {
  // 「側に広がるか」とは別の主張なので、壁が確実に効いている枠(使用者の枠)で倍率だけを見る。
  const ref = screenScenario('rifurekutaa');
  assertTwoThirds(ref.before.phys0, ref.after.phys0, 'self:0 物理(リフレクター)', ref.lines);
  const ls = screenScenario('hikarinokabe');
  assertTwoThirds(ls.before.spec0, ls.after.spec0, 'self:0 特殊(ひかりのかべ)', ls.lines);
  const av = screenScenario('oororaberu', 'snow');
  assertTwoThirds(av.before.phys0, av.after.phys0, 'self:0 物理(オーロラベール)', av.lines);
  assertTwoThirds(av.before.spec0, av.after.spec0, 'self:0 特殊(オーロラベール)', av.lines);
});
