/*
 * tools/_doubles_audit/ally_status_moves_test.js
 * 監査対象: 味方対象の変化技(てだすけ / コーチング / いやしのすず / アロマセラピー)のダブル挙動
 * 実行: node tools/_doubles_audit/ally_status_moves_test.js
 *
 * ★このファイルは「監査」です。エンジンは一切変更しません。
 * ★期待値は権威ソース(ポケモンWiki)の引用から立てています。エンジンの出力を写していません。
 *   - 出典が「1.5倍」と言うので 1.5倍を期待する。エンジンが何を返すかは見ていない。
 *   - 出典が「自身は効果対象外」と言うので 使用者のランクは 0 を期待する。
 *   - 出典が「自分と味方と手持ちのポケモン全員」と言うので 場の味方も治ることを期待する。
 *
 * ─── 出典(一字一句) ─────────────────────────────────────────────
 * [S1] ポケモンWiki「てだすけ」 https://wiki.pokemonwiki.com/wiki/てだすけ
 *   - 範囲:「自分 ( 第三世代 ) →味方1体 ( 第四世代 以降)」/ 優先度:「+5」
 *   - 効果:「1ターンの間、味方を てだすけ状態 にして、技の 威力 を1.5倍にする。 優先度 が高い。」
 *   - 説明文 Champions:「使ったターン中 味方の技の威力を1.5倍する。[優先度+5]」
 *   - 技の仕様:「対象の味方が、そのターンすでに行動していたときは失敗する。」
 *   - 技の仕様:「対象がすでにてだすけ状態になっているときも成功する。1ターンで同じポケモンに複数回
 *     てだすけを使用できれば、その分てだすけによる威力補正は累積する。トリプルバトル で両端のポケモンが
 *     中央のポケモンにてだすけを使用したときや、 さいはい でてだすけを2回使用したときに起こり得る。」
 *     ★=「重ね」が起こるのはトリプル/さいはい。2枠ダブルでは隣接味方は1体なので1ターンに1回しか
 *       かからない(=2.25倍にならない)。ダブルでの正しい期待値は「ちょうど1.5倍・翌ターンに残らない」。
 *   - 備考:「全ての技の中で最も 優先度 が高い (+5)。」
 * [S2] ポケモンWiki「コーチング」 https://wiki.pokemonwiki.com/wiki/コーチング
 *   - 範囲:「自分以外の味方全員」
 *   - 効果:「味方全員の 攻撃 と 防御 を 1段階 ずつ上げる。」
 *   - 説明文 Champions:「味方の攻撃 防御を1段階上げる。」
 *   - 備考:「自身は効果対象外であるため、 ダブルバトル 以上の場合の専用技と言える。」
 *   - 技の仕様:「シングルバトル のときや味方がいないときに使うと失敗する。」
 * [S3] ポケモンWiki「いやしのすず」 https://wiki.pokemonwiki.com/wiki/いやしのすず
 *   - 範囲:「てもち含む味方全員」
 *   - 効果:「戦闘に出ていない手持ちポケモンも含めた、味方全員の 状態異常 を治す。」
 *   - 説明文 Champions:「自分と味方と 手持ちのポケモン全員の 状態異常を回復する。[音]」
 * [S4] ヤックン /ch/ (Champions版・review/_doubles_research_2026-09-07/T5_味方連携技.md #11/#37/#63 の引用)
 *   - てだすけ:「必ず先制できる(優先度:+5)。使用したターンの間、味方の技の威力を1.5倍にする。」
 *   - コーチング:「自分を除く味方全体の『こうげき』『ぼうぎょ』ランクが1段階ずつ上がる(ダブルバトル用)。」
 *   - いやしのすず:「手持ち全員の状態異常をすべて治す。（ダイウォールの効果も受けない）味方が
 *     『みがわり』状態でも、効果がとどく。音系の技。」
 * [S5] アロマセラピー = Champions非搭載。master/moves.json の champions:false、
 *   pokechan_data.js(Champions版ビュー)の WAZA_MAP にキーが存在しない(T5 #64「masterでもchampions:false」)。
 *   → 本監査ではテストしない(非搭載機構をテストで縛らない)。
 * ──────────────────────────────────────────────────────────────
 *
 * エンジン側の該当実装(読んだ箇所・real_battle_simulator.html):
 *   L4895-4908  ally対象の解決(自陣の「自分以外の生存枠」を1つ選ぶ)
 *   L4913-4933  てだすけ(味方威力上昇): 行動済み判定→失敗 / helpingHandMult に乗算 / 成功ログ
 *   L2096-2101  helpingHandMult を base(威力)に乗算
 *   L8008-8010  helpingHandMult をターン開始でクリア
 *   L5392-5450  能力ランク変化(コーチングはここを ef.target==='ally' で通る)
 *   L5526-5562  状態異常回復(party/team は cureTgt=atk と atk.bench のみ。場の味方枠は見ていない)
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, ROOT } = require(path.join(__dirname, '..', '_sim_engine.js'));
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// ★_doubles_fixture_test.js の placeSlot をそのままコピー(requireすると向こうのテストが走ってしまう)。
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

// 同上(_doubles_fixture_test.js の build2v2 と同じ流儀)
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

// 同上(vm別レルム対策)
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
function benchEntry(pokeName) {
  return { poke: pokeByName(pokeName), effort: {hp:0,atk:0,def:0,spatk:0,spdef:0,spd:0},
    natureIdx: 0, ability: '', item: '', moves: [], currentHp: null, fainted: false,
    status: 'none', sleepTurns: null };
}
// ★乱数を定数にする: ダメージ乱数・追加効果判定をすべて固定し、「乱数の消費回数が配置で変わる」ことに
//   依存しない比較をできるようにする(倍率だけを見る)。0.5 は急所(1/24)にもならない・30%追加効果も出ない。
const FIXED = () => 0.5;

// =====================================================================================
// 主張1 [S1][S4]: てだすけは優先度+5なので、使う側が味方より遅くても味方の攻撃より先に処理される。
//   そのターン、味方の技の威力が1.5倍になる。
//   → 期待値: てだすけのログが味方の攻撃ログより前に出る / ダメージ比 ≒ 1.5倍
//   (威力の1.5倍なのでダメージ比は整数切り捨ての分だけ1.5から僅かにずれる=1.40〜1.60で判定)
// =====================================================================================
test('主張1: てだすけ(優先度+5)は遅い側が使っても味方の攻撃より先に解決し、味方の技の威力が1.5倍になる', () => {
  function run(helperMoveKey) {
    const E = build2v2();
    // self:0 カメックス(素早さ78)=てだすけ役(味方より遅い) / self:1 ケンタロス(110)=攻撃役
    placeSlot(E, 'self', 0, 'カメックス', helperMoveKey, { ability: '', targetChoice: { side: 'self', idx: 1 } });
    placeSlot(E, 'self', 1, 'ケンタロス', 'noshikakari', { ability: '' });
    placeSlot(E, 'opp', 0, 'カビゴン', null, { ability: '' });
    placeSlot(E, 'opp', 1, 'カビゴン', null, { ability: '' });
    E.setRandom(FIXED);
    E.runTurn();
    const msgs = msgList(E.battleLog);
    const hits = hitLines(E.battleLog).filter(h => h.attacker === 'ケンタロス');
    return { msgs, dmg: hits.length ? hits[0].dmg : null,
             helpIdx: msgs.findIndex(m => m.includes('てをかした')),
             atkIdx: msgs.findIndex(m => /^ケンタロス の のしかかり！/.test(m)) };
  }
  // 対照: てだすけの代わりに「味方に影響しない自分用の変化技(つるぎのまい)」を使わせる
  const plain = run('tsuruginomai');
  const helped = run('tedasuke');

  assert.ok(plain.dmg != null && helped.dmg != null,
    `両方の配置でケンタロスののしかかりが成立すること(対照=${plain.dmg} / てだすけ=${helped.dmg})`);
  // (a) 優先度+5 = 遅いカメックスのてだすけが、速いケンタロスの攻撃より先
  assert.ok(helped.helpIdx >= 0, `てだすけの成功ログが出る(実ログ=${JSON.stringify(helped.msgs)})`);
  assert.ok(helped.helpIdx < helped.atkIdx,
    `優先度+5なので素早さ78のてだすけが素早さ110の味方の攻撃より先に出る(てだすけ行=${helped.helpIdx} / 攻撃行=${helped.atkIdx})`);
  // (b) 威力1.5倍
  const ratio = helped.dmg / plain.dmg;
  assert.ok(ratio >= 1.40 && ratio <= 1.60,
    `味方の技の威力が1.5倍になる([S1]「技の 威力 を1.5倍にする」)。実測比=${ratio.toFixed(4)} (てだすけ=${helped.dmg} / 対照=${plain.dmg})`);
});

// =====================================================================================
// 主張2 [S1]: 「対象の味方が、そのターンすでに行動していたときは失敗する。」
//   ダブルで自然に起きる形= 味方2体が互いにてだすけ(どちらも優先度+5)。速い側が先に成功し、
//   遅い側のてだすけは「すでに行動した味方」が対象になるので失敗する。
//   → 期待値: 成功ログ1本(速い側) + 失敗(遅い側) / 成功ログは2本出ない
// =====================================================================================
test('主張2: すでに行動を終えた味方を対象にしたてだすけは失敗する(互いにてだすけ=速い側だけ成功)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'ケンタロス', 'tedasuke', { ability: '', targetChoice: { side: 'self', idx: 1 } }); // 110=先
  placeSlot(E, 'self', 1, 'カメックス', 'tedasuke', { ability: '', targetChoice: { side: 'self', idx: 0 } }); // 78=後
  placeSlot(E, 'opp', 0, 'カビゴン', null, { ability: '' });
  placeSlot(E, 'opp', 1, 'カビゴン', null, { ability: '' });
  E.setRandom(FIXED);
  E.runTurn();
  const msgs = msgList(E.battleLog);
  const okLines = msgs.filter(m => m.includes('てをかした'));
  assert.equal(okLines.length, 1,
    `成功するのは速い側の1本だけ([S1]「対象の味方が、そのターンすでに行動していたときは失敗する」)。実際の成功ログ=${JSON.stringify(okLines)} / 全ログ=${JSON.stringify(msgs)}`);
  assert.ok(/^ケンタロス は /.test(okLines[0]),
    `成功したのは先に動いたケンタロス側(実際=${okLines[0]})`);
  assert.ok(msgs.some(m => /^カメックス の てだすけ！/.test(m) && m.includes('うまく きまらなかった')),
    `後から動くカメックスのてだすけは失敗する(実ログ=${JSON.stringify(msgs)})`);
});

// =====================================================================================
// 主張3 [S1][S4]: 「1ターンの間」「使ったターン中」= 翌ターンには残らない。
//   また2枠ダブルでは隣接味方が1体しかいないので1ターンに1回しかかからない(=2.25倍にならない)。
//   「重ね(累積)」が起きるのはトリプル/さいはいのときだけ([S1]技の仕様)。
//   → 期待値: 1ターン目(てだすけあり)/2ターン目(てだすけなし)のダメージ比 ≒ 1.5
// =====================================================================================
test('主張3: てだすけの1.5倍はそのターン限りで翌ターンに残らない(2枠ダブルでは累積もしない)', () => {
  const E = build2v2();
  const helper = placeSlot(E, 'self', 0, 'カメックス', 'tedasuke', { ability: '', targetChoice: { side: 'self', idx: 1 } });
  placeSlot(E, 'self', 1, 'ケンタロス', 'noshikakari', { ability: '' });
  placeSlot(E, 'opp', 0, 'カビゴン', null, { ability: '' });
  placeSlot(E, 'opp', 1, 'カビゴン', null, { ability: '' });
  E.setRandom(FIXED);
  E.runTurn();
  const turn1 = hitLines(E.battleLog).filter(h => h.attacker === 'ケンタロス');
  assert.equal(turn1.length, 1, `1ターン目にケンタロスの攻撃が1本(実=${turn1.length})`);

  // 2ターン目: てだすけを出さない(味方に影響しない自分用の変化技に差し替える)。
  // 攻撃役・相手はそのまま(HPは減るがダメージ計算には影響しない)。
  helper.moves = [data.WAZA_MAP['tsuruginomai']];
  helper.selectedMoveIdx = 0;
  helper.targetChoice = null;
  const before = E.battleLog.length;
  E.runTurn();
  const after = [];
  for (let i = before; i < E.battleLog.length; i++) after.push({ msg: String(E.battleLog[i].msg) });
  const turn2 = hitLines(after).filter(h => h.attacker === 'ケンタロス');
  assert.equal(turn2.length, 1, `2ターン目にもケンタロスの攻撃が1本(実=${turn2.length})`);
  const msgs2 = after.map(x => x.msg);
  assert.ok(!msgs2.some(m => m.includes('てをかした')), '2ターン目はてだすけを出していない');

  const ratio = turn1[0].dmg / turn2[0].dmg;
  assert.ok(ratio >= 1.40 && ratio <= 1.60,
    `1ターン目(てだすけあり)が2ターン目(なし)の約1.5倍=倍率がターンを越えて残らず、かつ累積もしない。実測比=${ratio.toFixed(4)} (1T=${turn1[0].dmg} / 2T=${turn2[0].dmg})`);
});

// =====================================================================================
// 主張4 [S2][S4]: コーチングは「自分以外の味方全員」の こうげき+1・ぼうぎょ+1。
//   「自身は効果対象外」= 使用者のランクは動かない。相手のランクも動かない。
//   → 期待値: 味方枠 atk=+1 def=+1 / 使用者 atk=0 def=0 / 相手2枠 atk=0 def=0
// =====================================================================================
test('主張4: コーチングは自分を除く味方にこうげき+1・ぼうぎょ+1(使用者と相手は動かない)', () => {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', 'koochingu', { ability: '' });
  placeSlot(E, 'self', 1, 'ケンタロス', null, { ability: '' });
  placeSlot(E, 'opp', 0, 'カビゴン', null, { ability: '' });
  placeSlot(E, 'opp', 1, 'カビゴン', null, { ability: '' });
  E.setRandom(FIXED);
  E.runTurn();
  const user = E.slotOf('self', 0), ally = E.slotOf('self', 1);
  assert.equal(ally.rank.atk, 1, `味方(ケンタロス)のこうげきが+1([S2]「味方全員の 攻撃 と 防御 を 1段階 ずつ上げる」)。実=${ally.rank.atk}`);
  assert.equal(ally.rank.def, 1, `味方(ケンタロス)のぼうぎょが+1。実=${ally.rank.def}`);
  assert.equal(user.rank.atk, 0, `使用者(カメックス)のこうげきは上がらない([S2]「自身は効果対象外」)。実=${user.rank.atk}`);
  assert.equal(user.rank.def, 0, `使用者(カメックス)のぼうぎょも上がらない。実=${user.rank.def}`);
  assert.equal(E.slotOf('opp', 0).rank.atk, 0, '相手枠0のこうげきは動かない');
  assert.equal(E.slotOf('opp', 1).rank.atk, 0, '相手枠1のこうげきは動かない');
  assert.equal(E.slotOf('opp', 0).rank.def, 0, '相手枠0のぼうぎょは動かない');
  assert.equal(E.slotOf('opp', 1).rank.def, 0, '相手枠1のぼうぎょは動かない');
});

// =====================================================================================
// 主張5 [S3][S4]: いやしのすずは「自分と味方と 手持ちのポケモン全員の 状態異常を回復する」。
//   ダブルでは「味方」= 隣の枠で一緒に戦っている個体も含む(範囲=「てもち含む味方全員」)。
//   → 期待値: 使用者・場の味方枠・控え の3つすべてが 状態異常なし になる
// =====================================================================================
test('主張5: いやしのすずは使用者・場の味方枠・控えの状態異常を全部治す', () => {
  const E = build2v2();
  const user = placeSlot(E, 'self', 0, 'カメックス', 'iyashinosuzu', { ability: '' });
  const ally = placeSlot(E, 'self', 1, 'ケンタロス', null, { ability: '' });
  placeSlot(E, 'opp', 0, 'カビゴン', null, { ability: '' });
  placeSlot(E, 'opp', 1, 'カビゴン', null, { ability: '' });
  const bench = benchEntry('ピカチュウ');
  bench.status = 'burn';
  E.sides.self.bench = [bench];
  user.status = 'poison';
  ally.status = 'paralysis';
  E.setRandom(FIXED);
  E.runTurn();
  const msgs = msgList(E.battleLog);
  assert.equal(user.status, 'none',
    `使用者(カメックス)のどくが治る([S3]「自分と味方と 手持ちのポケモン全員の 状態異常を回復する」)。実=${user.status}`);
  assert.equal(E.sides.self.bench[0].status, 'none',
    `控え(ピカチュウ)のやけども治る([S3]「戦闘に出ていない手持ちポケモンも含めた」)。実=${E.sides.self.bench[0].status}`);
  assert.equal(E.slotOf('self', 1).status, 'none',
    `場で一緒に戦っている味方枠(ケンタロス)のまひも治る([S3]範囲「てもち含む味方全員」/ Champions説明文「自分と味方と 手持ちのポケモン全員」)。実=${E.slotOf('self', 1).status} / 全ログ=${JSON.stringify(msgs)}`);
});
