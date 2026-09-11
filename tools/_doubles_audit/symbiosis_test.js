/*
 * tools/_doubles_audit/symbiosis_test.js — ダブル監査: きょうせい(Symbiosis)
 * 実行: node tools/_doubles_audit/symbiosis_test.js
 *
 * ★監査専用(エンジン無改変・修正しない)。期待値は「権威ソース=ポケモンWiki『きょうせい』の逐語」から立てる。
 *   エンジンの出力を期待値に写さない(自己参照=偽の正解。CLAUDE.md「バトル再現の北極星」)。
 *
 * 出典(2026-09-11 取得 curl -A "Mozilla/5.0"
 *   https://wiki.xn--rckteqa2e.com/wiki/きょうせい → 301 → https://wiki.pokemonwiki.com/wiki/きょうせい):
 *
 *  (S1) 『効果』節 …… 「味方のポケモンが持ち物を消費した際、自身の持ち物をその味方に渡す。」
 *  (S2) 『説明文』節 Champions …… 「味方が道具を消費すると 自分の持っている道具を味方に渡す。」
 *  (S3) 『特性の仕様』節 …… 「発動したときは特性バーと「<きょうせいのポケモン>は <道具名>を
 *        <味方のポケモン>に 持たせた!」というメッセージが出る。」
 *  (S4) 『特性の仕様』節 …… 「きょうせいによって渡した道具が消費できる条件を満たしている場合、
 *        即座に消費する。」
 *  (S5) 『特性の仕様』節 …… 「味方がはたきおとす・ふしょくガス・やきつくすを受けて持ち物を失った場合、
 *        きょうせいは発動しない。」
 *  (S6) 『特性の仕様』節 …… 「味方が持ち物を消費した瞬間にきょうせいのポケモンが場にいなければ発動しない。
 *        シングルバトルでは発動しない。」
 *
 *  ローカル写し: review/_doubles_research_2026-09-07/T6_特性と持ち物.md #28,#29
 *
 * Champions搭載(=監査対象になる): master/abilities.json slug=symbiosis →
 *   "champions": true / "regulation": "M-C" / "champions_pokemon_count": 3。
 *   道具も season:["M-C"] = オボンのみ(berry_sitrus)/たべのこし(leftovers)。
 *
 * ★先に読む注意(2026-09-11 時点の事実): real_battle_simulator.html に「きょうせい」「symbiosis」は
 *   grep 0件。したがって否定形の主張4・5が pass しても「実装が出典どおり抑制している」証拠ではなく、
 *   「機構が無いので何も起きない」空振りの pass。合否の本体は肯定形の主張1〜3。
 *
 * fixtureの流儀は tools/_doubles_fixture_test.js と同じ(buildEngine / setFormat({slotsPerSide:2}) /
 * placeSlot / runTurn / battleLog)。placeSlot・build2v2・msgList は同ファイルから写した
 * (requireするとそのファイルのテストが走ってしまうため)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// --- ここから tools/_doubles_fixture_test.js からの写し(流儀を変えない) ---
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
// ★E.battleLogはvm(別レルム)の配列。for文で1件ずつ文字列化して持ち出す(既知の罠)。
function msgList(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}
// --- 写しここまで ---

// (S3)の発動メッセージ「<きょうせい>は <道具名>を <味方>に 持たせた!」(全角/半角の!どちらでも拾う)
const HANDED_RE = /は .*を .*に 持たせた[!！]/;
const handedLines = msgs => msgs.filter(m => HANDED_RE.test(m));
const itemOf = st => (st.item == null ? '' : String(st.item));
// itemReactions()のオボンのみ消費ログ: `… は オボンのみで HPを N 回復した！`
const SITRUS_RE = /オボンのみで HPを \d+ 回復した/;

// 共通fixture。self:0 = 道具を消費する味方(カメックス・素早さ78)
//              self:1 = きょうせい(ヤレユータン ab3=きょうせい・素早さ60)
//              opp:0 / opp:1 = フシギバナ
// ★相手の既定技は つるぎのまい(自分対象)。ダメージで味方のHPが動くとfixtureの
//   「HPが1/2以下」前提が崩れるため、攻撃させたいテストだけ oppMove で上書きする。
function fixture(opts) {
  opts = opts || {};
  const E = build2v2();
  const ally = placeSlot(E, 'self', 0, 'カメックス', opts.allyMove || 'tsuruginomai');
  const symb = placeSlot(E, 'self', 1, 'ヤレユータン', 'tsuruginomai', { ability: 'きょうせい' });
  const o0 = placeSlot(E, 'opp', 0, 'フシギバナ', opts.oppMove || 'tsuruginomai');
  const o1 = placeSlot(E, 'opp', 1, 'フシギバナ', 'tsuruginomai');
  // fixtureの前提を明示: ヤレユータンの第3特性がきょうせいであること(データ側が変わったら気付けるように)
  assert.equal(symb.poke.ab3, 'きょうせい',
    'fixture前提: ヤレユータンの隠れ特性は きょうせい(pokechan_data.js)');
  assert.equal(E.sideAbility(symb), 'きょうせい',
    'fixture前提: self:1 の特性が きょうせい として引ける');
  return { E, ally, symb, o0, o1 };
}
const halfHp = (E, st) => Math.floor(E.realStat(st, 'hp') / 2);

// ===== 主張1 (S1/S2): 味方が持ち物を消費したら、きょうせいは自分の持ち物をその味方に渡す =====
// 「味方のポケモンが持ち物を消費した際、自身の持ち物をその味方に渡す。」(S1)
// 「味方が道具を消費すると 自分の持っている道具を味方に渡す。」(S2 = Champions説明文)
// fixture: 味方(self:0)がHP1/2でオボンのみを消費 / きょうせい(self:1)は たべのこし を持つ。
// 期待値(出典から): たべのこし は self:0 の手に移り、self:1 の持ち物は無くなる。
test('きょうせい-1: 味方がオボンのみを消費したら、きょうせいのたべのこしがその味方に渡る(S1/S2)', () => {
  const { E, ally, symb } = fixture();
  ally.item = 'berry_sitrus';
  ally.currentHp = halfHp(E, ally);      // オボンのみの発動条件(HP1/2以下)
  symb.item = 'leftovers';
  E.setRandom(mulberry32(101));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  // 前提チェック: 味方が実際にオボンのみを「消費」していないとこの主張は検証できない
  assert.ok(msgs.some(m => SITRUS_RE.test(m)),
    `前提: 味方(self:0)がオボンのみを消費する。log=${JSON.stringify(msgs)}`);
  assert.equal(itemOf(ally), 'leftovers',
    `S1「自身の持ち物をその味方に渡す」→ 味方の持ち物が leftovers になる。実際=${JSON.stringify(itemOf(ally))}`);
  assert.equal(itemOf(symb), '',
    `S1「自身の持ち物を…渡す」→ きょうせい側の持ち物は無くなる。実際=${JSON.stringify(itemOf(symb))}`);
});

// ===== 主張2 (S3): 発動時に「<きょうせい>は <道具名>を <味方>に 持たせた!」のログが1行出る =====
test('きょうせい-2: 発動時に「…は …を …に 持たせた!」のメッセージが出る(S3)', () => {
  const { E, ally, symb } = fixture();
  ally.item = 'berry_sitrus';
  ally.currentHp = halfHp(E, ally);
  symb.item = 'leftovers';
  E.setRandom(mulberry32(102));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  assert.ok(msgs.some(m => SITRUS_RE.test(m)),
    `前提: 味方(self:0)がオボンのみを消費する。log=${JSON.stringify(msgs)}`);
  const hit = handedLines(msgs);
  assert.equal(hit.length, 1,
    `S3: 発動メッセージが1行出る。実際=${JSON.stringify(hit)} / 全log=${JSON.stringify(msgs)}`);
  assert.ok(/ヤレユータン/.test(hit[0]) && /たべのこし/.test(hit[0]) && /カメックス/.test(hit[0]),
    `S3: メッセージに「きょうせいのポケモン/道具名/味方のポケモン」の3つが入る。実際=${JSON.stringify(hit[0])}`);
});

// ===== 主張3 (S4): 渡した道具が消費できる条件を満たしていれば、受け取った味方は即座に消費する =====
// 「きょうせいによって渡した道具が消費できる条件を満たしている場合、即座に消費する。」(S4)
// fixture: 味方(self:0)はHP1で自分のオボンのみを消費 → 回復しても最大HPの1/4+1なので まだ1/2以下
//          → きょうせい(self:1)の オボンのみ を受け取り、条件を満たすので即座に2個目を消費する。
// 期待値(出典から): オボンのみの回復ログが2行(自分のぶん+渡されたぶん)・最後に味方の手元は空。
test('きょうせい-3: 渡されたオボンのみは条件を満たしていれば即座に消費される(S4)', () => {
  const { E, ally, symb } = fixture();
  ally.item = 'berry_sitrus';
  ally.currentHp = 1;
  symb.item = 'berry_sitrus';
  const max = E.realStat(E.slotOf('self', 0), 'hp');
  // 出典からの計算: 1個目で 1 + floor(max/4) まで回復。これが floor(max/2) 以下=2個目の条件も満たす
  assert.ok(1 + Math.floor(max / 4) <= Math.floor(max / 2),
    `前提: 1個目の回復後もHPは1/2以下(max=${max})=2個目の発動条件を満たす`);
  E.setRandom(mulberry32(103));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  const heals = msgs.filter(m => SITRUS_RE.test(m));
  assert.equal(heals.length, 2,
    `S4: 自分のぶん+きょうせいで渡されたぶんの2回オボンのみを消費する。実際=${JSON.stringify(heals)} / 全log=${JSON.stringify(msgs)}`);
  assert.equal(itemOf(ally), '',
    `S4「即座に消費する」→ 受け取ったオボンのみは手元に残らない。実際=${JSON.stringify(itemOf(ally))}`);
  assert.equal(itemOf(symb), '',
    `S1: きょうせい側の持ち物は渡して無くなる。実際=${JSON.stringify(itemOf(symb))}`);
});

// ===== 主張4 (S5): 味方がはたきおとすで持ち物を「失った」場合は発動しない(=消費ではない) =====
// 「味方がはたきおとす・ふしょくガス・やきつくすを受けて持ち物を失った場合、きょうせいは発動しない。」(S5)
// fixture: 相手(opp:0)が正面の味方(self:0)に はたきおとす。
//          きょうせい(self:1)は オボンのみ をHP満タンで持つ(=自分では消費しない)。
test('きょうせい-4: 味方がはたきおとすで持ち物を失っても発動しない(S5)', () => {
  const { E, ally, symb } = fixture({ oppMove: 'hatakiotosu' });
  ally.item = 'leftovers';
  symb.item = 'berry_sitrus';            // HP満タン=自分では消費しない
  E.setRandom(mulberry32(104));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  assert.ok(msgs.some(m => /はたきおとした/.test(m)),
    `前提: 味方(self:0)の持ち物が はたきおとす で失われる。log=${JSON.stringify(msgs)}`);
  assert.equal(handedLines(msgs).length, 0,
    `S5: はたきおとすで失った場合は発動しない(発動メッセージ0行)。実際=${JSON.stringify(handedLines(msgs))}`);
  assert.equal(itemOf(symb), 'berry_sitrus',
    `S5: きょうせい側の持ち物は渡らず残る。実際=${JSON.stringify(itemOf(symb))}`);
  assert.notEqual(itemOf(ally), 'berry_sitrus',
    `S5: 味方はきょうせいの持ち物を受け取らない。実際=${JSON.stringify(itemOf(ally))}`);
});

// ===== 主張5 (S1/S6): 発動は「味方」の消費に限る。相手側の消費では発動しない =====
// S1「味方のポケモンが持ち物を消費した際」/ S6「味方が持ち物を消費した瞬間に…シングルバトルでは発動しない。」
//   = きょうせいは「自分と同じ側の隣の枠」だけを見る特性(だからシングルでは無意味)。
// fixture: 相手(opp:0)がHP1/2でオボンのみを消費 / きょうせい(self:1)は たべのこし を持つ。
test('きょうせい-5: 相手側(敵)の道具消費では発動しない=味方限定(S1/S6)', () => {
  const { E, symb, o0 } = fixture();
  o0.item = 'berry_sitrus';
  o0.currentHp = halfHp(E, o0);
  symb.item = 'leftovers';
  E.setRandom(mulberry32(105));
  E.runTurn();
  const msgs = msgList(E.battleLog);
  assert.ok(msgs.some(m => SITRUS_RE.test(m)),
    `前提: 相手(opp:0)がオボンのみを消費する。log=${JSON.stringify(msgs)}`);
  assert.equal(handedLines(msgs).length, 0,
    `S1/S6: 相手の消費は発動条件ではない(発動メッセージ0行)。実際=${JSON.stringify(handedLines(msgs))}`);
  assert.equal(itemOf(symb), 'leftovers',
    `S1/S6: きょうせい側の持ち物は残る。実際=${JSON.stringify(itemOf(symb))}`);
  assert.notEqual(itemOf(o0), 'leftovers',
    `S1/S6: 相手にきょうせいの持ち物が渡ってはいけない。実際=${JSON.stringify(itemOf(o0))}`);
});
