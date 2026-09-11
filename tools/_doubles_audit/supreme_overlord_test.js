/*
 * tools/_doubles_audit/supreme_overlord_test.js
 *   ダブルバトル監査: とくせい「そうだいしょう」(倒れた味方の数で威力補正・発動時点で確定)
 *   実行: node tools/_doubles_audit/supreme_overlord_test.js
 *
 * ★これは監査用テスト(修正はしない)。期待値はすべて権威ソースの引用から立てており、
 *   エンジンの出力を写していない(自己出力をゴールデンにしない=バトル再現_羅針盤)。
 *
 * 出典(一字一句の引用):
 *  [W1] ポケモンWiki「そうだいしょう」『効果』節
 *       「場に出たとき、その戦闘でひんしになった味方ポケモンの数に応じて、使用する攻撃技の威力が
 *         上昇する効果が発動する。ひんし1匹につき10%ずつ補正率が上がる。最大補正率は+50%。」
 *  [W2] ポケモンWiki「そうだいしょう」『説明文』節(Champions)
 *       「登場した時 その戦闘で倒された手持ちの ポケモン1匹につき 技の威力が10%上がる。最大で50%まで上がる。」
 *  [W3] ポケモンWiki「そうだいしょう」『特性の仕様』節
 *       「その戦闘で味方がひんしになってから場に出たときに発動し、特性バーと
 *         「<ポケモン>は 倒された 仲間から 力を もらった!」とメッセージが出る。」
 *  [W4] ポケモンWiki「そうだいしょう」『特性の仕様』節
 *       「その戦闘でひんしになった味方がいないときは特性バーとメッセージは現れない。」
 *  [W5] ポケモンWiki「そうだいしょう」『特性の仕様』節
 *       「威力の補正率は特性が発動した時点で決まる。」
 *       「特性が発動した後に味方がひんしになっても補正率は上昇しない。」
 *  [C1] master/abilities.json slug=supreme-overlord(champions:true / regulation:M-C)
 *       effect_ja「場に出た時に、これまでに『ひんし』状態になった味方のポケモン数×10%だけ技の威力が上がる。
 *                 (最大1.5倍)技の威力の上昇率は、場に出た時点で決まる。その後に味方がひんしになっても、
 *                 上昇率は変わらない。」
 *  [R1] review/_doubles_research_2026-09-07/T6_特性と持ち物.md #25
 *       「そうだいしょうの威力補正率は「発動した時点」で確定し、その後に味方が倒れても上昇しない」
 *  [R2] reference/_ability_facts.json「そうだいしょう」(出典=ポケモンWiki そうだいしょう『特性の仕様』節)
 *
 * 主張(ダブルでどう動くべきか):
 *  A1 ダブルで味方が1体ひんしになったあとに場に出ると、使う攻撃技の威力が+10%(×1.1)になる。
 *     発動時に「倒された 仲間から 力を もらった」旨のメッセージが出る。[W1][W2][W3][C1]
 *  A2 ダブルでは同じターンに両枠の味方が倒れることがある。ひんし2体のあとに出ると+20%(×1.2)=体数に比例する。[W1][W2][C1]
 *  A3 登場時点でひんしになった味方が0体なら発動しない(威力は素のまま・メッセージも出ない)。[W4][W1]
 *  A4 ★ダブル固有の肝: 自分が場にいる間に隣の枠の味方が倒れても、補正率は登場時点の値のまま上がらない。[W5][C1][R1]
 *  A5 ひんし5体(手持ち6体で倒せる上限)のあとに出ると+50%(×1.5)=最大補正。[W1][W2][C1]
 *
 * 測り方: E.calcDamage(乱数を使わない=16通りの幅をそのまま返す)の max を使って「同じ技・同じ受け役・
 *   同じ自分」で補正率だけを比べる。乱数ロールの食い違いが入らないので、倍率の比は威力補正そのものになる。
 *   丸め(pokeRound)の段差を吸収するため帯で判定する(±0.04)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

const HOLDER = 'ドドゲザン';       // Champions版でそうだいしょうを持つ唯一の個体(ab2=そうだいしょう)
const ABIL   = 'そうだいしょう';
const MOVE   = 'aianheddo';        // アイアンヘッド(はがね・物理・威力80・単体選択)=ドドゲザンのタイプ一致
const SAC    = 'カメックス';       // 生贄の味方役(特性は無印にする)
const FOE    = 'ケンタロス';       // 受け役/攻撃役(ノーマル単=はがね技は等倍・はたくは命中100)

// --- tools/_doubles_fixture_test.js からコピー(requireするとそのファイルのテストが走ってしまうため) ---
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

// 控え1体ぶんのデータ(tools/_doubles_fixture_test.js の benchEntry と同じ形 + ability/hp/moveKey を指定できるよう拡張)
function benchEntry(pokeName, opts) {
  opts = opts || {};
  return { poke: pokeByName(pokeName), effort: { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0 },
    natureIdx: 0, ability: opts.ability || '', item: '',
    moves: opts.moveKey ? [data.WAZA_MAP[opts.moveKey]] : [],
    currentHp: opts.hp != null ? opts.hp : null, fainted: false, status: 'none', sleepTurns: null };
}

// ★E.battleLogはvm(別レルム)の配列なので、文字列プリミティブに詰め直してから使う(fixtureと同じ罠回避)。
function msgsFrom(log, fromIdx) {
  const out = [];
  for (let i = fromIdx || 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}
function faintCount(log) {
  return msgsFrom(log, 0).filter(m => /は ひんしになった/.test(m)).length;
}
// 「そうだいしょうが発動した」と読める行(Wikiの専用メッセージ[W3]だけでなく特性名も拾う広めの網)
function overlordLines(msgs) {
  return msgs.filter(m => /そうだいしょう/.test(m) || (/倒された/.test(m) && /力/.test(m)));
}

// 相手(opp)が はたく で指定した自分の枠を殴る1ターン。targets=[0] / [1] / [0,1]
function oppAttackTurn(E, seed, targets) {
  for (const i of [0, 1]) {
    if (targets.includes(i)) {
      placeSlot(E, 'opp', i, FOE, 'hataku', { ability: '', targetChoice: { side: 'self', idx: i } });
    } else {
      placeSlot(E, 'opp', i, null, null);
    }
  }
  E.setRandom(mulberry32(seed));
  E.runTurn();
}

// 控えの1体を「その枠」に出す(死に出し/通常交代のどちらも attemptSwitch=実機の登場処理を通る)。
function putIn(E, slotIdx, pokeName, opts) {
  const st = E.slotOf('self', slotIdx);
  const wasFainted = !!st.fainted;
  E.sides.self.bench.push(benchEntry(pokeName, opts));
  const ok = E.attemptSwitch('self', E.sides.self.bench.length - 1,
    { slotIdx, ignoreTrapping: true, faintReplace: wasFainted });
  assert.ok(ok, `fixtureの前提: ${pokeName} が self:${slotIdx} に出られる(attemptSwitchがtrueを返す)`);
  return E.slotOf('self', slotIdx);
}

// そうだいしょう持ち(self:0)がアイアンヘッドで opp:0 を殴るときの最大ダメージ。
// 受け役は毎回その場で置き直す(満タン・ランク0・特性なし)=どのシナリオでも受け側は同一条件。
function holderDamage(E) {
  const holder = E.slotOf('self', 0);
  assert.equal(holder.poke && holder.poke.name, HOLDER, `測定の前提: self:0 が ${HOLDER}`);
  assert.equal(E.sideAbility(holder), ABIL, `測定の前提: self:0 の特性が ${ABIL}`);
  assert.equal(holder.rank.atk || 0, 0, '測定の前提: 攻撃側のこうげきランクは0(ランク差で倍率が動かないように)');
  assert.ok(!holder.status || holder.status === 'none', '測定の前提: 攻撃側は状態異常なし(やけど補正を避ける)');
  const def = placeSlot(E, 'opp', 0, FOE, null, { ability: '' });
  def.rank = { atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0, acc: 0, eva: 0 };
  const r = E.calcDamage('self', 'opp', data.WAZA_MAP[MOVE], {}, 0, 0);
  assert.ok(r && r.max > 0, 'アイアンヘッドのダメージが計算できる(受け役はノーマル単=等倍)');
  return { max: r.max, min: r.min, chips: JSON.parse(JSON.stringify(r.chips || [])) };
}

/* ひんしになった味方が n 体の状態で そうだいしょう持ちを場に出す。
 * 手持ちは「生贄 n 体(+必要なら生き残りの味方1体)+ ドドゲザン」=実機の6体以内に収まる構成。
 *  n=0: 誰も倒れない1ターンのあと、通常交代でドドゲザンが出る
 *  n=1: 味方1体が倒れ、その枠にドドゲザンが出る(もう1枠の味方は生存)
 *  n=2: ★ダブル固有=同じターンに両枠の味方が倒れ、そのあとドドゲザンが出る
 *  n=5: 2体→2体→1体の順に倒れ(手持ち6体の上限)、5体目のあとにドドゲザンが出る
 */
function enterAfterFaints(n, seed) {
  const E = build2v2();
  E.sides.self.bench = [];
  seed = seed || 11;
  if (n === 0) {
    placeSlot(E, 'self', 0, SAC, null, { ability: '' });          // 満タン=はたくでは倒れない
    placeSlot(E, 'self', 1, SAC, null, { ability: '' });
    oppAttackTurn(E, seed, [0]);                                   // 1ターン経過するが誰もひんしにならない
  } else if (n === 1) {
    placeSlot(E, 'self', 0, SAC, null, { ability: '', hp: 1 });
    placeSlot(E, 'self', 1, SAC, null, { ability: '' });           // 隣の味方は生存したまま
    oppAttackTurn(E, seed, [0]);
  } else if (n === 2) {
    placeSlot(E, 'self', 0, SAC, null, { ability: '', hp: 1 });
    placeSlot(E, 'self', 1, SAC, null, { ability: '', hp: 1 });
    oppAttackTurn(E, seed, [0, 1]);                                // ダブルなので同一ターンに2体倒れる
  } else if (n === 5) {
    placeSlot(E, 'self', 0, SAC, null, { ability: '', hp: 1 });
    placeSlot(E, 'self', 1, SAC, null, { ability: '', hp: 1 });
    oppAttackTurn(E, seed, [0, 1]);                                // 2体
    putIn(E, 0, SAC, { hp: 1 }); putIn(E, 1, SAC, { hp: 1 });
    oppAttackTurn(E, seed + 1, [0, 1]);                            // 4体
    putIn(E, 0, SAC, { hp: 1 });
    oppAttackTurn(E, seed + 2, [0]);                               // 5体
  } else {
    throw new Error('未対応のn=' + n);
  }
  assert.equal(faintCount(E.battleLog), n,
    `fixtureの前提: ここまでにひんしになった味方がちょうど${n}体(ログの「は ひんしになった！」行で数える)`);
  const from = E.battleLog.length;
  putIn(E, 0, HOLDER, { ability: ABIL, moveKey: MOVE });
  const msgs = msgsFrom(E.battleLog, from);
  return { E, dmg: holderDamage(E), msgs, entryLines: overlordLines(msgs) };
}

// 交代や経過ターンの有無そのものが測定値を動かしていないことの担保(素の基準値)。
function referenceDamage() {
  const E = build2v2();
  E.sides.self.bench = [];
  placeSlot(E, 'self', 0, HOLDER, null, { ability: ABIL });
  placeSlot(E, 'self', 1, SAC, null, { ability: '' });
  return holderDamage(E);
}

const fmt = d => `max=${d.max}/min=${d.min}/補正チップ=${JSON.stringify(d.chips)}`;
function ratioOk(r, target) { return Math.abs(r - target) <= 0.04; }

// ★A3/A4は「上がらない」ことを確かめる否定形の主張なので、機構が丸ごと未実装でも自動的に通ってしまう
//   (=「エンジンがそうしているから」で通る偽の合格)。必ず陽性対照を先に踏ませる。
function assertOverlordIsLive() {
  const base = enterAfterFaints(0, 101).dmg;
  const one = enterAfterFaints(1, 101).dmg;
  assert.ok(one.max > base.max,
    '陽性対照: 味方が1体ひんしになったあとに登場したら威力が上がるはず([W1]「ひんし1匹につき10%ずつ補正率が上がる。」)。' +
    `上がらないなら否定形の主張は検証になっていない=機構が未実装。ひんし0=${fmt(base)} / ひんし1=${fmt(one)}`);
}

// ===== A1: 味方1体ひんし後の登場で+10%・発動メッセージが出る =====
test('そうだいしょう-A1: 味方が1体ひんしになったあとに場に出ると威力が+10%(×1.1)になり、発動メッセージが出る', () => {
  const ref = referenceDamage();
  const base = enterAfterFaints(0, 11).dmg;
  assert.equal(base.max, ref.max,
    `測定の担保: 「1ターン経過+交代で登場」しただけでダメージは変わらない(素の基準=${fmt(ref)} / ひんし0で登場=${fmt(base)})`);

  const r = enterAfterFaints(1, 11);
  const ratio = r.dmg.max / base.max;
  console.log(`  A1 ひんし0=${r ? base.max : ''} → ひんし1=${r.dmg.max} (×${ratio.toFixed(3)}) / 登場ログ=${JSON.stringify(r.msgs)}`);
  assert.ok(ratioOk(ratio, 1.1),
    '[W1]「場に出たとき、その戦闘でひんしになった味方ポケモンの数に応じて、使用する攻撃技の威力が上昇する効果が発動する。' +
    'ひんし1匹につき10%ずつ補正率が上がる。」[W2]「登場した時 その戦闘で倒された手持ちの ポケモン1匹につき 技の威力が10%上がる。」' +
    ` → ×1.1のはず。実測 ×${ratio.toFixed(3)}(ひんし0=${fmt(base)} / ひんし1=${fmt(r.dmg)})`);
  assert.ok(r.entryLines.length > 0,
    '[W3]「その戦闘で味方がひんしになってから場に出たときに発動し、特性バーと「<ポケモン>は 倒された 仲間から 力を もらった!」' +
    `とメッセージが出る。」→ 発動を示す行が登場ログに出るはず。実際の登場ログ=${JSON.stringify(r.msgs)}`);
});

// ===== A2: ダブルで同一ターンに2枠の味方が倒れた後の登場で+20% =====
test('そうだいしょう-A2: 同じターンに両枠の味方(2体)が倒れたあとに場に出ると威力が+20%(×1.2)になる', () => {
  const base = enterAfterFaints(0, 23).dmg;
  const r = enterAfterFaints(2, 23);
  const ratio = r.dmg.max / base.max;
  console.log(`  A2 ひんし0=${base.max} → ひんし2=${r.dmg.max} (×${ratio.toFixed(3)})`);
  assert.ok(ratioOk(ratio, 1.2),
    '[W1]「ひんし1匹につき10%ずつ補正率が上がる。」[W2]「倒された手持ちの ポケモン1匹につき 技の威力が10%上がる。」' +
    ' → ダブルでは同じターンに場の2枠が倒れうる。その2体ぶん=×1.2のはず。' +
    `実測 ×${ratio.toFixed(3)}(ひんし0=${fmt(base)} / ひんし2=${fmt(r.dmg)})`);
});

// ===== A3: ひんし0体で登場したら発動しない =====
test('そうだいしょう-A3: ひんしになった味方が0体のまま登場したら発動しない(威力は素のまま・メッセージも出ない)', () => {
  const ref = referenceDamage();
  const r = enterAfterFaints(0, 37);
  console.log(`  A3 素の基準=${ref.max} / ひんし0で登場=${r.dmg.max} / 登場ログ=${JSON.stringify(r.msgs)}`);
  assertOverlordIsLive();                 // ★空振り合格の防止(機構が在ることを先に示す)
  assert.equal(r.dmg.max, ref.max,
    '[W1]「その戦闘でひんしになった味方ポケモンの数に応じて」→ 0体なら補正なし(素の威力のまま)。' +
    ` 実測 素=${fmt(ref)} / ひんし0で登場=${fmt(r.dmg)}`);
  assert.equal(r.entryLines.length, 0,
    '[W4]「その戦闘でひんしになった味方がいないときは特性バーとメッセージは現れない。」' +
    ` → 発動を示す行は出ないはず。実際の登場ログ=${JSON.stringify(r.msgs)}`);
});

// ===== A4: 発動後に隣の味方が倒れても補正率は上がらない(ダブル固有の肝) =====
test('そうだいしょう-A4: 場に出たあとに隣の枠の味方が倒れても、補正率は登場時点の値のまま上がらない', () => {
  const base = enterAfterFaints(0, 59).dmg;

  const E = build2v2();
  E.sides.self.bench = [];
  placeSlot(E, 'self', 0, SAC, null, { ability: '', hp: 1 });
  placeSlot(E, 'self', 1, SAC, null, { ability: '', hp: 1 });
  oppAttackTurn(E, 59, [0]);                                  // 味方1体目が倒れる(ひんし1)
  assert.equal(faintCount(E.battleLog), 1, 'fixtureの前提: この時点でひんしは1体');
  putIn(E, 0, HOLDER, { ability: ABIL, moveKey: MOVE });       // ひんし1の時点で登場=ここで補正率が確定
  const atEntry = holderDamage(E);
  E.slotOf('self', 0).selectedMoveIdx = null;                  // そうだいしょう持ちは行動しない(測定を乱さない)
  oppAttackTurn(E, 60, [1]);                                   // 自分が場にいる間に隣の味方が倒れる(ひんし2)
  assert.equal(faintCount(E.battleLog), 2, 'fixtureの前提: 隣の枠の味方も倒れてひんしは2体になった');
  assert.equal(E.slotOf('self', 0).poke.name, HOLDER, 'fixtureの前提: そうだいしょう持ちは場に残っている');
  const after = holderDamage(E);

  const rEntry = atEntry.max / base.max, rAfter = after.max / base.max;
  console.log(`  A4 ひんし0=${base.max} / 登場時(ひんし1)=${atEntry.max}(×${rEntry.toFixed(3)})`
    + ` / 隣が倒れた後(ひんし2)=${after.max}(×${rAfter.toFixed(3)})`);
  assertOverlordIsLive();                 // ★空振り合格の防止(機構が在ることを先に示す)
  assert.ok(ratioOk(rEntry, 1.1),
    `前提(登場時の補正): [W1]「ひんし1匹につき10%ずつ」→ 登場時点で×1.1。実測 ×${rEntry.toFixed(3)}(${fmt(atEntry)})`);
  assert.equal(after.max, atEntry.max,
    '[W5]「威力の補正率は特性が発動した時点で決まる。」「特性が発動した後に味方がひんしになっても補正率は上昇しない。」' +
    `[C1]「その後に味方がひんしになっても、上昇率は変わらない。」→ ×1.1のまま(×1.2にしない)。` +
    ` 実測 登場時=${fmt(atEntry)} / 隣が倒れた後=${fmt(after)}`);
  assert.ok(!ratioOk(rAfter, 1.2),
    `[W5]「特性が発動した後に味方がひんしになっても補正率は上昇しない。」→ ×1.2になってはいけない。実測 ×${rAfter.toFixed(3)}`);
});

// ===== A5: ひんし5体=最大補正+50% =====
test('そうだいしょう-A5: 味方5体がひんしになったあとに場に出ると威力が+50%(×1.5)=最大補正になる', () => {
  const base = enterAfterFaints(0, 97).dmg;
  const r = enterAfterFaints(5, 97);
  const ratio = r.dmg.max / base.max;
  console.log(`  A5 ひんし0=${base.max} → ひんし5=${r.dmg.max} (×${ratio.toFixed(3)})`);
  assert.ok(ratioOk(ratio, 1.5),
    '[W1]「ひんし1匹につき10%ずつ補正率が上がる。最大補正率は+50%。」[W2]「最大で50%まで上がる。」' +
    `[C1]「(最大1.5倍)」→ 手持ち6体で倒せる上限=5体ぶんの×1.5のはず。実測 ×${ratio.toFixed(3)}` +
    `(ひんし0=${fmt(base)} / ひんし5=${fmt(r.dmg)})`);
});
