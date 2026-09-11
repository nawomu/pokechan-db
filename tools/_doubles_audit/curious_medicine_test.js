/*
 * tools/_doubles_audit/curious_medicine_test.js
 * 監査対象: 特性「きみょうなくすり」(Curious Medicine) のダブルでの挙動
 * 実行: node tools/_doubles_audit/curious_medicine_test.js
 * ★監査専用(修正はしない)。エンジン・既存ファイルは一切触っていない。
 *
 * ★北極星(バトル再現_羅針盤.md): 期待値は権威ソースの引用から作る。エンジンの出力を写さない。
 *   このファイルの assert の数値・真偽は下記 [S1]〜[S5] の引用だけから決めてある。
 *
 * ■ Champions 搭載の確認(= blocked ではない)
 *   master/abilities.json items[] slug="curious-medicine"
 *     "champions": true / "regulation": "M-C" / "champions_pokemon_count": 1 /
 *     "source": "audited" / "verified_at": "2026-09-03"
 *   pokechan_data.js POKEMON_LIST で ab1/ab2/ab3 に「きみょうなくすり」を持つのは
 *     「ヤドキング(ガラル)」1体のみ(ab1・すばやさ30)。
 *
 * ■ 出典(一字一句の引用)
 *  [S1] master/abilities.json items[] slug="curious-medicine" → effect_ja
 *       (desc_house_source="champions" = Champions のゲーム内テキスト)
 *       「戦闘に出た時、味方のポケモンの能力ランクの変化をもとに戻す。上がったランクも戻る。(ダブルバトル用)
 *         『クリアボディ』などランクの低下を防ぐ特性や『しろいきり』の効果を無視して元に戻す。
 *         『みがわり』状態や姿を隠しているポケモンのランクも戻る。」
 *  [S2] reference/_ability_facts.json facts.きみょうなくすり[0] authority_quote
 *       (source="ポケモンWiki『きみょうなくすり』特性の仕様節")
 *       「・特性クリアボディ/しろいけむり/メタルプロテクト/かいりきバサミ/はとむね/するどいめ/フラワーベール/
 *         ミラーアーマー、しろいきり状態を無視してランク補正をリセットする。」
 *  [S3] reference/_ability_facts.json facts.きみょうなくすり[4] authority_quote(同Wiki)
 *       「・同時に繰りだされたいかくを受けたときや、バトンタッチで変化した能力を引き継いだとき、
 *         スキルスワップでこの特性を得たときなど、きみょうなくすりを持つポケモン自身のランクは戻らない。」
 *  [S4] reference/_ability_facts.json facts.きみょうなくすり[3] authority_quote(同Wiki)
 *       「・味方のランクが変化していないときは発動しない。」
 *  [S5] review/_doubles_research_2026-09-07/T6_特性と持ち物.md #24(出典欄=上記Wiki)
 *       「きみょうなくすりは、場に出たとき味方のランク補正を0にリセットする。クリアボディ等の無効化系特性や
 *         しろいきりを無視し、あまのじゃく/たんじゅんの影響も受けない」
 *       ダブル必須欄「Y(1体)」/ 備考「per-switch。味方をリセット対象とする=単体戦では味方が存在せず無意味」
 *  ※ ポケモンWiki本体・ヤックン/ch/ への直接 curl は 2026-09-11 時点で Cloudflare の
 *    "Just a moment..." により 403。上記はいずれもリポジトリ内に一字一句で写された権威コーパス。
 *
 * ■ エンジン側の該当実装(grep 結果)
 *   real_battle_simulator.html に文字列「きみょうなくすり」は 0 件
 *     $ grep -c "きみょうなくすり" real_battle_simulator.html  → 0
 *   登場時特性の単一ディスパッチ点 = fireEntryAbility()
 *     real_battle_simulator.html:3079  function fireEntryAbility(s, slotIdx)
 *     real_battle_simulator.html:3090  if (ab === 'いかく'){ … } else if (ab === 'あめふらし'){ … }
 *                                       (いかく/天候/メイカー/おみとおし/ばけのかわ/パラドックス/てんきや/シード)
 *     → この if/else 連鎖にも、その後の個別処理にも きみょうなくすり の枝が無い。
 *   呼び出し元(= per-switch のトリガは揃っている)
 *     real_battle_simulator.html:3063  function phaseInitA()  → order 全枠に fireEntryAbility
 *     real_battle_simulator.html:3067  for (const sl of order) fireEntryAbility(sl.side, sl.idx);
 *     real_battle_simulator.html:7380  function attemptSwitch(sideKey, benchIdx, opts)
 *     real_battle_simulator.html:7465  fireEntryAbility(sideKey, slotIdx);   // 交代時の登場処理
 *   ランク変化の共通関数(リセット実装時に通す/通さないの判断材料)
 *     real_battle_simulator.html:4169  applyRankStageGuarded の注記(クリアボディ/しろいきり/ミラーアーマー/
 *                                      あまのじゃく/かちき・まけんき をここで一括処理)
 *     real_battle_simulator.html:4237  rbRegisterHandler('stat_stage', 'mist_guard', …)
 *                                      → ctx.fromOpponent が真のときだけ防ぐ(= しろいきり判定は味方起因では来ない)
 *
 * ■ 主張(claims)— テスト1本ずつ独立。シングルの動作は対象外。
 *  C1 場に出たとき、味方(同じ側のもう1枠)の能力ランク変化は上がった分も含めて0に戻る。[S1][S5]
 *  C2 きみょうなくすりを持つポケモン自身のランクは戻らない(同時に繰りだされていかくを受けた場合)。[S3]
 *  C3 リセットの対象は「味方」だけ=相手側のランク補正は戻らない。[S1](「味方のポケモンの能力ランクの変化を」)
 *  C4 味方のクリアボディ・しろいきりを無視してリセットする。[S1][S2]
 *  C5 味方のランクが変化していない(±0の)ときは発動しない。[S4]
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, ROOT } = require(path.join(__dirname, '..', '_sim_engine.js'));
const data = require(path.join(ROOT, 'pokechan_data.js'));

const HOLDER = 'ヤドキング(ガラル)';   // champions_pokemon_count=1 の当該1体(ab1=きみょうなくすり・すばやさ30)
const ABILITY = 'きみょうなくすり';

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// --- _doubles_fixture_test.js から写した fixture 流儀(require しない=あちらは読み込むとテストが走るため) ---
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
function benchEntry(pokeName, abilityName) {
  return { poke: pokeByName(pokeName), effort: {hp:0,atk:0,def:0,spatk:0,spdef:0,spd:0},
    natureIdx: 0, ability: abilityName || '', item: '', moves: [],
    currentHp: null, fainted: false, status: 'none', sleepTurns: null };
}
// vm(別レルム)のログ配列はこちら側の Array に詰め直して読む(_doubles_fixture_test.js の既知の罠)
function msgList(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}
const ZERO = { atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0, acc: 0, eva: 0 };
function setRank(st, obj) { st.rank = Object.assign({}, ZERO, obj); }
function rankOf(st) { const r = st.rank || {}; const o = {}; for (const k of Object.keys(ZERO)) o[k] = r[k] || 0; return o; }

// 「味方の枠1に きみょうなくすり持ちが交代で出てくる」fixture。
// 味方=self:0(ランクを事前に動かしておく)/ 交代で引っ込むのは self:1 / 相手=opp:0, opp:1(特性なし=中立)
function fixtureAllySwitchIn(opts) {
  opts = opts || {};
  const E = build2v2();
  placeSlot(E, 'self', 0, opts.allyName || 'カビゴン', null,
    opts.allyAbility != null ? { ability: opts.allyAbility } : { ability: '' });
  placeSlot(E, 'self', 1, 'ケンタロス', null, { ability: '' });   // ab1=いかくなので空に上書き(中立化)
  placeSlot(E, 'opp', 0, 'カメックス', null, { ability: '' });
  placeSlot(E, 'opp', 1, 'フシギバナ', null, { ability: '' });
  E.slotOf('self', 1).bench = [benchEntry(HOLDER, ABILITY)];
  E.sides.self.bench = [benchEntry(HOLDER, ABILITY)];
  return E;
}
// 枠1へ きみょうなくすり持ちを出す(attemptSwitch(sideKey, benchIdx, {slotIdx}) = engine:7380)
function switchInHolder(E) {
  const ok = E.attemptSwitch('self', 0, { slotIdx: 1 });
  assert.notEqual(ok, false, '交代(枠1へ きみょうなくすり持ちを出す)が成立する');
  assert.equal(E.slotOf('self', 1).poke.name, HOLDER, `枠1が ${HOLDER} になる`);
}

// ===== C1: 場に出たとき、味方のランク補正(上がった分も)が0に戻る [S1][S5] =====
test('C1: きみょうなくすり持ちが場に出ると、味方(同じ側のもう1枠)の能力ランク変化が上がった分も含めて0に戻る', () => {
  const E = fixtureAllySwitchIn();
  const ally = E.slotOf('self', 0);
  setRank(ally, { atk: 2, spd: -1, eva: 3 });   // 上がった分・下がった分・回避を混ぜる
  switchInHolder(E);
  // 期待値の出どころ=[S1]「味方のポケモンの能力ランクの変化をもとに戻す。上がったランクも戻る。」
  //              +[S5]「場に出たとき味方のランク補正を0にリセットする」→ 全項目0
  assert.deepEqual(rankOf(ally), ZERO,
    `味方(self:0)の全ランクが0に戻る(出典[S1][S5])。実際=${JSON.stringify(rankOf(ally))}`);
});

// ===== C2: きみょうなくすり自身のランクは戻らない(同時に繰りだされていかくを受けたとき) [S3] =====
test('C2: 同時に繰りだされていかくを受けたとき、きみょうなくすり持ち自身のこうげき-1は戻らない(味方の分だけ戻る)', () => {
  // バトル開始(phaseInitA・engine:3063)は全枠を素早さ降順に fireEntryAbility する。
  // 相手のゲンガー(すばやさ110)にいかくを持たせると、ヤドキング(ガラル)(30)より先に発動して
  // 自分側2枠のこうげきを-1にする。その後で きみょうなくすり の登場処理が走る
  // = [S3]「同時に繰りだされたいかくを受けたとき」そのものの状況。
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null, { ability: '' });      // 味方(すばやさ78)
  placeSlot(E, 'self', 1, HOLDER, null, { ability: ABILITY });        // きみょうなくすり(すばやさ30)
  placeSlot(E, 'opp', 0, 'ゲンガー', null, { ability: 'いかく' });    // すばやさ110=最初に発動
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  E.phaseInitA();
  const ally = E.slotOf('self', 0);
  const holder = E.slotOf('self', 1);
  const msgs = msgList(E.battleLog);
  // 前提(これが崩れるとC2を観測できない): いかくが自分側にかかっている
  assert.ok(msgs.some(m => /いかく/.test(m)), `いかくが発動している(前提)。ログ=${JSON.stringify(msgs)}`);
  assert.ok(msgs.some(m => /カメックス.*こうげきがさがった/.test(m)),
    `味方カメックスにもいかくが届いている(前提=ダブルのいかくは相手全体)。ログ=${JSON.stringify(msgs)}`);
  // 主張の要: 味方の-1は戻る[S1] / 自分の-1は残る[S3]
  assert.equal(ally.rank.atk, 0,
    `味方(self:0)のいかく-1は きみょうなくすりで0に戻る(出典[S1])。実際=${ally.rank.atk}`);
  assert.equal(holder.rank.atk, -1,
    `きみょうなくすり持ち自身のこうげきは-1のまま戻らない(出典[S3])。実際=${holder.rank.atk}`);
});

// ===== C3: リセットの対象は味方だけ=相手のランクは戻らない [S1] =====
test('C3: きみょうなくすり持ちが場に出ても、相手側(opp:0/opp:1)のランク補正は戻らない', () => {
  const E = fixtureAllySwitchIn();
  const ally = E.slotOf('self', 0);
  setRank(ally, { atk: 2 });
  setRank(E.slotOf('opp', 0), { atk: 2, spd: 1 });
  setRank(E.slotOf('opp', 1), { def: -2 });
  switchInHolder(E);
  // 前提: 味方側には効いている(効いていなければ「相手に効いていない」は何の証明にもならない)
  assert.equal(ally.rank.atk, 0, `味方(self:0)のランクは0に戻る(前提・出典[S1])。実際=${ally.rank.atk}`);
  // 主張: [S1]「味方のポケモンの能力ランクの変化をもとに戻す」= 相手は対象外
  assert.deepEqual(rankOf(E.slotOf('opp', 0)), Object.assign({}, ZERO, { atk: 2, spd: 1 }),
    `相手opp:0のランクはそのまま(出典[S1])。実際=${JSON.stringify(rankOf(E.slotOf('opp', 0)))}`);
  assert.deepEqual(rankOf(E.slotOf('opp', 1)), Object.assign({}, ZERO, { def: -2 }),
    `相手opp:1のランクもそのまま(出典[S1])。実際=${JSON.stringify(rankOf(E.slotOf('opp', 1)))}`);
});

// ===== C4: 味方のクリアボディ・しろいきりを無視してリセットする [S1][S2] =====
test('C4: 味方がクリアボディ+しろいきり状態でも、きみょうなくすりはそれを無視してランクを0に戻す', () => {
  const E = fixtureAllySwitchIn({ allyName: 'メタグロス', allyAbility: 'クリアボディ' });
  const ally = E.slotOf('self', 0);
  ally.mist = true;                       // しろいきり状態(engine:4237 mist_guard が見るフラグ)
  if (!ally.screenTurns) ally.screenTurns = {};
  ally.screenTurns.mist = 5;
  setRank(ally, { atk: 2, spatk: 2 });    // +2 → 0 は「低下」方向=無効化系が噛みうる状況を作る
  switchInHolder(E);
  assert.deepEqual(rankOf(ally), ZERO,
    `クリアボディ/しろいきりを無視して0に戻る(出典[S1][S2])。実際=${JSON.stringify(rankOf(ally))}`);
  const msgs = msgList(E.battleLog);
  assert.ok(!msgs.some(m => /能力が下がらない/.test(m)),
    `「能力が下がらない」(クリアボディ/しろいきりの無効化ログ)が出ない(出典[S2])。ログ=${JSON.stringify(msgs)}`);
});

// ===== C5: 味方のランクが変化していないときは発動しない [S4] =====
// ★「発動しない」は“発動の痕跡が観測できる”ことと対になって初めて検証できる主張なので、
//   (b) で「ランクが動いていれば発動する(=ログに特性名が出る+ランクが0に戻る)」を先に要求し、
//   (a) で「±0なら その痕跡が出ない」を要求する差分法で判定する。
//   (a) だけだと「そもそも何も実装されていない」でも通ってしまう=エンジン追認になるため。
test('C5: 味方のランクが±0のときは発動しない(ランクが動いているときは発動する=差分で確かめる)', () => {
  // (b) 味方のランクが動いている → 発動する
  const Eb = fixtureAllySwitchIn();
  const allyB = Eb.slotOf('self', 0);
  setRank(allyB, { atk: 2 });
  switchInHolder(Eb);
  const msgsB = msgList(Eb.battleLog);
  assert.equal(allyB.rank.atk, 0,
    `味方のランクが動いていれば0に戻る(出典[S1])。実際=${allyB.rank.atk}`);
  assert.ok(msgsB.some(m => m.includes(ABILITY)),
    `発動したことがログに出る(これが無いと[S4]の「発動しない」を観測できない)。ログ=${JSON.stringify(msgsB)}`);
  // (a) 味方のランクが±0 → 発動の痕跡が出ない
  const Ea = fixtureAllySwitchIn();
  setRank(Ea.slotOf('self', 0), {});
  switchInHolder(Ea);
  const msgsA = msgList(Ea.battleLog);
  assert.ok(!msgsA.some(m => m.includes(ABILITY)),
    `味方が±0なら ${ABILITY} の発動ログが出ない(出典[S4])。ログ=${JSON.stringify(msgsA)}`);
});
