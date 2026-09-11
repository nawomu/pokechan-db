/*
 * tools/_doubles_audit/telepathy_test.js
 *   ダブルバトル監査: とくせい「テレパシー」(味方の攻撃技を受けない)
 *   実行: node tools/_doubles_audit/telepathy_test.js
 *
 * ★このファイルは「監査」= エンジンを直さない。期待値は権威ソース(ポケモンWiki)の文言からだけ作る。
 *   エンジンの出力を期待値に写さない(自己参照=偽の正解・CLAUDE.md「バトル再現の北極星」)。
 *
 * Champions搭載の確認(2026-09-11):
 *   master/abilities.json テレパシー → champions:true / regulation:"M-C"
 *   master/pokemon.json  サーナイト(ab3=テレパシー)/チャーレム/ヤレユータン/ムシャーナ → champions:true
 *   使う技も全部 champions:true (はたく / なみのり / でんじは / かたやぶり)
 *   ※「はじけるほのおの火花は防げない」(Wiki特性の仕様)だけは はじけるほのお champions:false = 対象外。
 *
 * 出典(一字一句): ポケモンWiki「テレパシー」
 *   https://wiki.pokemonwiki.com/wiki/テレパシー (最終更新 2026年7月20日・2026-09-11 取得で再確認)
 *   写し: reference/_authority_corpus/abilities/テレパシー.json
 *
 *   [出典1] 効果節:
 *     「味方から受ける攻撃技を無効化する。」
 *   [出典2] 特性の仕様節:
 *     「・テレパシーのポケモンを選択して使用された1体を選択する攻撃技も無効化する。」
 *   [出典3] 特性の仕様節:
 *     「・発動すると特性バーが現れ、「<所持者>は 味方からの 攻撃を 受けない!」とメッセージが流れる。」
 *   [出典4] 特性の仕様節:
 *     「・変化技は無効化できない。」
 *   [出典5] こんなときに使おう節:
 *     「なみのりのような、味方を巻き込む攻撃技から身を守れる。」
 *   [出典6] 特性の仕様節:
 *     「・かたやぶりの効果を持つ技に対してテレパシーは発動しない。」
 *   [出典8] ポケモンWiki「かたやぶり」(2026-09-11 live再取得・出典6の裏取り=特性かたやぶり側の記述):
 *     『無視する特性』一覧に「テレパシー」が載り、『特性の仕様』節に
 *     「第五世代以降では、以下のように味方のポケモンの特性も無視する。」
 *     「かたやぶりのポケモンが使う技を、味方はふゆう/テレパシーなどの特性で無効化できない。」
 *     → 主張5は「特性かたやぶりを持つ味方が撃つ」形で検証してよい(出典6の『かたやぶりの効果を持つ技』と同義)
 *   [出典7] 備考節(テストの置き場所の根拠):
 *     「第七世代以降の特性の説明文には「技を 回避する」とあるが、テレパシーによる無効化は命中判定とは
 *       関係しない。例えばテレパシーで技が無効化されてもからぶりほけんは発動しない。」
 *   [参考] 備考節: 「・シングルバトルでは発動することが無い。」= 本テストを全部ダブル(2枠)で組む理由
 *
 * 主張 → テスト対応:
 *   主張1 [出典1][出典2] 味方が撃った1体選択の攻撃技は無効化=HPが1も減らない      → test 1
 *   主張2 [出典3]         無効化すると「味方からの 攻撃を 受けない」と出る           → test 2
 *   主張3 [出典4]         味方の変化技は無効化できない(でんじは→まひする)           → test 3
 *   主張4 [出典1][出典5] 味方を巻き込む範囲攻撃技(なみのり)も無効化される           → test 4
 *   主張5 [出典6]         かたやぶりを持つ味方の攻撃技には発動しない(=ダメージが通る) → test 5
 *
 * ★「エンジンがそうしているから通る」を避ける作法:
 *   - 主張1/4 は「テレパシー無し(シンクロ)の同配置では必ずダメージが入る」対照を同じテスト内に置く
 *     (技が別の理由で不発なら対照も0になる=テストが沈黙しない)。
 *   - 主張5 は差分テスト(普通の味方=無効化 / かたやぶりの味方=通る)。片方だけでは「特性が何もしていない」
 *     状態でも通ってしまうため、2つの対比そのものを合否にする。
 *   - ★主張3(変化技は無効化できない)は「テレパシーが未実装でも通る」空振りの合格になり得る主張。
 *     監査結果を読む側が取り違えないよう明記する: 2026-09-11 時点の実装では主張3だけが通り、
 *     主張1/2/4/5 は落ちる=「通った1本は実装の証拠ではない」。実装後に主張3が落ちたら
 *     「変化技まで無効化している」実バグのサインとして使う(その時に初めて意味を持つテスト)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// _doubles_fixture_test.js と同じ流儀(requireはしない=あちらはテストを実行してしまうのでコピー)
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

// ★E.battleLogはvm(別レルム)の配列。for文で1件ずつ文字列化して持ち越す(既知の罠)。
function msgList(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}

/*
 * 共通fixture: 自陣だけの「味方が味方を撃つ」盤面。
 *   self:0 = カビゴン(撃つ側。abilityは呼び出し側で指定)
 *   self:1 = サーナイト(テレパシー所持者。ab3=テレパシー・master確認済)
 *   相手側2枠はひんし枠(空)=テレパシーの判定に相手を混ぜない。
 * 戻り値: { holder, maxHp, msgs }
 */
function runAllyAttack(moveKey, holderAbility, attackerAbility, seed) {
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カビゴン', moveKey, {
    targetChoice: { side: 'self', idx: 1 },
    ability: attackerAbility,
  });
  placeSlot(E, 'self', 1, 'サーナイト', null, { ability: holderAbility });
  placeSlot(E, 'opp', 0, null, null, { fainted: true });
  placeSlot(E, 'opp', 1, null, null, { fainted: true });
  const maxHp = E.realStat(E.slotOf('self', 1), 'hp');
  E.setRandom(mulberry32(seed == null ? 5 : seed));
  E.runTurn();
  const holder = E.slotOf('self', 1);
  return { holder, maxHp, msgs: msgList(E.battleLog) };
}

// 「味方からの 攻撃を 受けない」= [出典3] の文言。空白/感嘆符の全角半角はエンジン表記の自由度として許す
// (出典が決めているのは文言であって記号幅ではない)。
const ACTIVATE_RE = /味方からの\s*攻撃を\s*受けない/;

// ===== 主張1: 味方が撃った1体選択の攻撃技は無効化される(HPが1も減らない) =====
// [出典1]「味方から受ける攻撃技を無効化する。」
// [出典2]「テレパシーのポケモンを選択して使用された1体を選択する攻撃技も無効化する。」
test('主張1: 味方が名指しで撃った1体選択の攻撃技(はたく)をテレパシーが無効化する=HPが減らない', () => {
  // 対照: テレパシーでない特性(シンクロ=サーナイトのab1)なら同じ配置でダメージが入るはず。
  // これが0なら「技が別の理由で不発」=テスト自体が無意味なので先に落とす。
  const ctrl = runAllyAttack('hataku', 'シンクロ', null);
  assert.ok(ctrl.holder.currentHp < ctrl.maxHp,
    `対照(テレパシー無し)では味方のはたくでHPが減るはず=この配置で技が成立している証拠` +
    `(実際=${ctrl.holder.currentHp}/${ctrl.maxHp} / ログ=${JSON.stringify(ctrl.msgs)})`);

  const r = runAllyAttack('hataku', 'テレパシー', null);
  assert.equal(r.holder.currentHp, r.maxHp,
    `[出典1/2] 味方から受ける攻撃技は無効化される=HPは満タンのまま(${r.maxHp})であるべき。` +
    `実際=${r.holder.currentHp}/${r.maxHp} / ログ=${JSON.stringify(r.msgs)}`);
});

// ===== 主張2: 無効化したときに発動メッセージが出る =====
// [出典3]「発動すると特性バーが現れ、「<所持者>は 味方からの 攻撃を 受けない!」とメッセージが流れる。」
test('主張2: 無効化したターンに「味方からの 攻撃を 受けない」のメッセージが所持者の名前つきで出る', () => {
  const r = runAllyAttack('hataku', 'テレパシー', null);
  const line = r.msgs.find(m => ACTIVATE_RE.test(m));
  assert.ok(line,
    `[出典3] 発動メッセージ「〜は 味方からの 攻撃を 受けない!」が出るべき。` +
    `実際のログ=${JSON.stringify(r.msgs)}`);
  assert.ok(line.includes('サーナイト'),
    `[出典3] メッセージは所持者(<所持者>=サーナイト)の名前を含むべき。実際="${line}"`);
});

// ===== 主張3: 味方の変化技は無効化できない =====
// [出典4]「・変化技は無効化できない。」
test('主張3: 味方の変化技(でんじは)はテレパシーで無効化できない=まひ状態になる', () => {
  // でんじは=命中90。seed 5 は命中する列(命中しなければ下のassertメッセージで分かる)。
  const r = runAllyAttack('denjiha', 'テレパシー', null);
  assert.equal(r.holder.status, 'paralysis',
    `[出典4] 変化技は無効化できない=味方のでんじはでまひするべき。` +
    `実際のstatus=${r.holder.status} / ログ=${JSON.stringify(r.msgs)}`);
  assert.equal(r.msgs.filter(m => ACTIVATE_RE.test(m)).length, 0,
    `[出典4] 変化技ではテレパシーは発動しない=発動メッセージが出てはいけない。` +
    `実際のログ=${JSON.stringify(r.msgs)}`);
});

// ===== 主張4: 味方を巻き込む範囲攻撃技も無効化される =====
// [出典5]「なみのりのような、味方を巻き込む攻撃技から身を守れる。」([出典1]の「攻撃技」に範囲技も含む)
test('主張4: 味方が撃った範囲攻撃技(なみのり=自分以外全体)もテレパシーが無効化する', () => {
  // なみのりは target='自分以外全体'(pokechan_data)=対象選択しない→targetChoiceは効かないが
  // 味方枠が巻き込まれる。対照(シンクロ)で巻き込みが成立していることを先に確かめる。
  const ctrl = runAllyAttack('naminori', 'シンクロ', null);
  assert.ok(ctrl.holder.currentHp < ctrl.maxHp,
    `対照(テレパシー無し)では味方のなみのりに巻き込まれてHPが減るはず` +
    `(実際=${ctrl.holder.currentHp}/${ctrl.maxHp} / ログ=${JSON.stringify(ctrl.msgs)})`);

  const r = runAllyAttack('naminori', 'テレパシー', null);
  assert.equal(r.holder.currentHp, r.maxHp,
    `[出典5] なみのりのような味方を巻き込む攻撃技から身を守れる=HPは満タンのまま(${r.maxHp})。` +
    `実際=${r.holder.currentHp}/${r.maxHp} / ログ=${JSON.stringify(r.msgs)}`);
});

// ===== 主張5: かたやぶりの効果を持つ技には発動しない(差分テスト) =====
// [出典6]「・かたやぶりの効果を持つ技に対してテレパシーは発動しない。」
test('主張5: かたやぶりを持つ味方の攻撃技にはテレパシーが発動しない(普通の味方=無効化との差分)', () => {
  // (a) 普通の特性の味方が撃つ → 無効化される(主張1と同じ期待・ここでは差分の片側として必要)
  const plain = runAllyAttack('hataku', 'テレパシー', 'めんえき');
  assert.equal(plain.holder.currentHp, plain.maxHp,
    `差分の片側: かたやぶりでない味方の攻撃技は無効化される=HP満タン(${plain.maxHp})。` +
    `実際=${plain.holder.currentHp}/${plain.maxHp} / ログ=${JSON.stringify(plain.msgs)}`);

  // (b) かたやぶり持ちの味方が撃つ → テレパシーは発動せずダメージが通る
  const breaker = runAllyAttack('hataku', 'テレパシー', 'かたやぶり');
  assert.ok(breaker.holder.currentHp < breaker.maxHp,
    `[出典6] かたやぶりの効果を持つ技に対してテレパシーは発動しない=ダメージが通るべき。` +
    `実際=${breaker.holder.currentHp}/${breaker.maxHp} / ログ=${JSON.stringify(breaker.msgs)}`);
  assert.equal(breaker.msgs.filter(m => ACTIVATE_RE.test(m)).length, 0,
    `[出典6] かたやぶり相手では発動メッセージも出てはいけない。実際のログ=${JSON.stringify(breaker.msgs)}`);
});
