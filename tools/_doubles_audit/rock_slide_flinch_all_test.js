/*
 * tools/_doubles_audit/rock_slide_flinch_all_test.js
 *   監査: ダブルで「いわなだれ/エアスラッシュ等の追加効果(ひるみ)が対象ごとに独立」かを権威ソースの値で検証する。
 *   実行: node tools/_doubles_audit/rock_slide_flinch_all_test.js
 *   立場: 監査のみ(エンジン無改変)。期待値は下の出典の数字だけから作り、エンジンの出力は一切写していない。
 *
 * ── 出典(一字一句の引用) ─────────────────────────────────────────────
 * [S1] ポケモンWiki「いわなだれ」(ローカル写し reference/_authority_corpus/moves/いわなだれ.json
 *      = https://wiki.pokemonwiki.com/wiki/いわなだれ ・2026-07-28取得)
 *      「範囲 | 相手全員」/「効果 | 追加効果として、30%の確率で相手をひるませる(第二世代以降)。」
 * [S2] ポケモンWiki「追加効果」(https://wiki.xn--rckteqa2e.com/wiki/追加効果 ・2026-09-11取得)
 *      「特定の攻撃技が命中したときにそれぞれに設定された一定確率で起こる。」
 *      表「いわなだれ 30%」「エアスラッシュ 30%」(ひるみ状態にする技)/「ワイドブレイカー 100% -1」(こうげき)
 *      「特性りんぷん・持ち物おんみつマントのポケモンは相手の攻撃による追加効果を受けない。」
 * [S3] ポケモンWiki「ひるみ」(https://wiki.xn--rckteqa2e.com/wiki/ひるみ ・2026-09-11取得)
 *      「ひるみの効果 / そのターンの間、行動できなくなる。」
 *      「ひるみ状態が発生するかは、ダメージを与えたときに決定する。技を受けたポケモンが行動するときではない。」
 *      「いわなだれ：30%(第二世代以降)」「エアスラッシュ：30%」
 *      「ひるみの予防 / とくせい / せいしんりょく」
 * [S4] Bulbapedia "Rock Slide (move)" (https://bulbapedia.bulbagarden.net/wiki/Rock_Slide_(move) ・2026-09-11取得)
 *      "Rock Slide inflicts damage and has a 30% chance of causing each target to flinch."
 *      "In battles with multiple opponents, Rock Slide targets all adjacent opponents."
 * [S5] Bulbapedia "Air Slash (move)" (https://bulbapedia.bulbagarden.net/wiki/Air_Slash_(move) ・2026-09-11取得)
 *      "Air Slash inflicts damage and has a 30% chance of causing the target to flinch."
 * [S6] 設計_ダブルバトル_2026-09-07.md §4.5(#49/#50)
 *      「対象ループは「1体分を全部やってから次」(#50): per-target で hit_check → crit → damage_calc →
 *        damage_apply → post_hit_react を回す。命中・急所・乱数・みがわり・持ち物は対象ごとに独立に振る」
 *
 * ── Champions 搭載確認(master = SSOT) ────────────────────────────────
 *   master/moves.json: いわなだれ champions=true (target=相手全体 / acc=90)
 *                      エアスラッシュ champions=true (target=1体選択 / acc=95)
 *   master/abilities.json: せいしんりょく champions=true / ノーガード champions=true
 *
 * ── 主張(出典→ダブルでどう動くべきか) ───────────────────────────────
 *   主張1: いわなだれ は相手2体が対象([S1]範囲=相手全員 / [S4] targets all adjacent opponents)で、
 *          ひるみ判定は「対象ごとに1回・30%」([S4] each target 30% / [S1][S2][S3] 30%)。
 *          判定はその対象にダメージを与えた時点([S3])=どちらか片方だけがひるむ事も両方ひるむ事も起こり、
 *          各枠の発生率は 30% ・両方ひるむ率は 0.3×0.3=9%(独立)。★左右どちらの枠も 30%(片方だけ高い等は無い)。
 *   主張2: せいしんりょくを持つ個体はひるまない([S3]ひるみの予防=せいしんりょく)。これは個体ごとの耐性なので、
 *          同じ1発のいわなだれで「持っている枠は0回ひるまない/持っていない相方はひるむ」になる。
 *   主張3: ひるみの効果は「そのターンの間、行動できなくなる」([S3])=ひるんだ個体だけが動けず、
 *          ひるんでいない相方はそのターン普通に行動する(側単位でなく個体単位)。
 *   主張4: エアスラッシュ は 1体選択([S2]表/master target=1体選択)で、ひるみは "the target"([S5])1体だけ。
 *          選んだ枠は30%でひるみ、選んでいない相方は0%(ひるみが隣の枠へ漏れない)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// ★placeSlot は tools/_doubles_fixture_test.js の同名関数の写し(requireするとあちらのテストが走るため)。
//   差分は2点だけ(どちらも「1つのエンジンで何千ターンも回す」ための状態リセット。判定ロジックには無関係):
//   (a) st.pp = null  … PP切れ→わるあがき差し替えが起きないようPP管理を従来動作=無効にする
//                       (engine側の「st.pp が無い時は従来動作」をそのまま使う)。
//   (b) 特性は毎回明示的に入れ直す … 指定が無い時は ab1(既定の特性)へ戻す。前の試行の ability 上書きが
//                       残ると「相手の特性が相方に効いた」ように見える偽陽性になる(実際に一度踏んだ)。
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
  st.pp = null;
  st.ability = opts.ability != null ? opts.ability : (st.poke ? st.poke.ab1 : '');
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

// vm(別レルム)の配列から新規ログ行だけを取り出す(_doubles_fixture_test.js と同じ回避策)。
function newLines(log, from) {
  const out = [];
  for (let i = from; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}

// ── 盤面の固定部品 ───────────────────────────────────────────────
// 攻撃側: バンギラス(すばやさ61) + とくせい ノーガード。
//   ノーガードは「命中率の揺れ」だけを消すために使う(いわなだれ 命中90/エアスラッシュ 命中95 の外れが
//   混ざると「30%」の検証にならない)。ひるみ率そのものには無関係(ノーガードは命中の特性)。
// 受け側: カビゴン(すばやさ30・ab1 めんえき) / ヤドラン(すばやさ30・ab1 どんかん)
//   = どちらもひるみ耐性を持たない・名前が違うのでログで枠を区別できる・攻撃側より遅い。
//   HP=9999 にして絶対に倒れないようにする([S2]「相手を倒した場合には発生しない」の影響を排除)。
const OPP0 = 'カビゴン';
const OPP1 = 'ヤドラン';
const ATTACKER = 'バンギラス';
const BIG_HP = 9999;

// いわなだれを1発撃ってN回分の「どちらの枠がひるんだか」を数える。
// oppOpts0/1 で受け側の特性を差し替える。相手は技を選ばない=行動しないので flinched フラグを直接読める
// (engine はターン開始で flinched をクリアする=前ターンの持ち越しは無い)。
function runRockSlideTrials(E, n, seed, oppOpts0, oppOpts1) {
  E.setRandom(mulberry32(seed));
  const res = { n: n, f0: 0, f1: 0, both: 0, only0: 0, only1: 0, neither: 0, extraFlinchLogTurns: 0 };
  for (let i = 0; i < n; i++) {
    placeSlot(E, 'self', 0, ATTACKER, 'iwanadare', { ability: 'ノーガード' });
    placeSlot(E, 'self', 1, null, null);
    placeSlot(E, 'opp', 0, OPP0, null, Object.assign({ hp: BIG_HP }, oppOpts0 || {}));
    placeSlot(E, 'opp', 1, OPP1, null, Object.assign({ hp: BIG_HP }, oppOpts1 || {}));
    const from = E.battleLog.length;
    E.runTurn();
    const lines = newLines(E.battleLog, from);
    const f0 = !!E.slotOf('opp', 0).flinched;
    const f1 = !!E.slotOf('opp', 1).flinched;
    if (f0) res.f0++;
    if (f1) res.f1++;
    if (f0 && f1) res.both++; else if (!f0 && !f1) res.neither++; else if (f0) res.only0++; else res.only1++;
    // 「対象ごとに1回」の直接確認: ひるみ成立ログの本数は ひるんだ枠の数 と一致するはず。
    const flinchLogs = lines.filter(s => /は ひるんだ！/.test(s)).length;
    if (flinchLogs > (f0 ? 1 : 0) + (f1 ? 1 : 0)) res.extraFlinchLogTurns++;
  }
  return res;
}

const pct = (c, n) => (c / n) * 100;

// ===== 主張1 =====
test('主張1: いわなだれ(相手全体)のひるみは対象ごとに1回・各枠30%で独立に振られる [S1][S2][S3][S4]', () => {
  const E = build2v2();
  const N = 4000;
  const r = runRockSlideTrials(E, N, 20260911, null, null);
  const r0 = pct(r.f0, N), r1 = pct(r.f1, N), rBoth = pct(r.both, N);
  const detail = `N=${N} / opp0(${OPP0})=${r.f0}(${r0.toFixed(1)}%) opp1(${OPP1})=${r.f1}(${r1.toFixed(1)}%)`
    + ` / both=${r.both}(${rBoth.toFixed(1)}%) only0=${r.only0} only1=${r.only1} neither=${r.neither}`
    + ` / ひるみログが枠数より多かったターン=${r.extraFlinchLogTurns}`;

  // (1-a) 4通りの組み合わせが全部起こる=側単位の1回判定ではなく対象ごとの判定([S4] each target)
  assert.ok(r.only0 > 0 && r.only1 > 0, `片方だけひるむ事が両向きに起こる(対象ごとの判定)。${detail}`);
  assert.ok(r.both > 0 && r.neither > 0, `両方ひるむ/両方ひるまないも起こる。${detail}`);

  // (1-b) 発生率は出典の30%。左右どちらの枠も同じ30%([S1]30% / [S4] each target 30%)。
  //       許容は ±3.0pp(N=4000・p=0.3 の標準偏差0.72pp の約4倍)。
  assert.ok(Math.abs(r0 - 30) <= 3.0, `opp0(位置順で先の枠)のひるみ率は出典の30%±3.0pp であるべき。${detail}`);
  assert.ok(Math.abs(r1 - 30) <= 3.0, `opp1(位置順で後の枠)のひるみ率は出典の30%±3.0pp であるべき。${detail}`);

  // (1-c) 独立なら両方ひるむ率は 0.3×0.3=9%。許容 ±3.0pp。
  assert.ok(Math.abs(rBoth - 9) <= 3.0, `両方ひるむ率は 30%×30%=9%±3.0pp であるべき(対象ごとに独立)。${detail}`);

  // (1-d) 「対象ごとに1回」の直接確認: 同じ枠にひるみ成立ログが2本出るターンがあってはいけない。
  assert.equal(r.extraFlinchLogTurns, 0, `1発のいわなだれで同じ枠のひるみ判定が2回走っている。${detail}`);
});

// ===== 主張2 =====
test('主張2: せいしんりょくはその個体だけのひるみ耐性(相方は同じ1発でひるむ) [S3]', () => {
  const E = build2v2();
  const N = 1000;

  // (2-a) 先の枠(opp0)が せいしんりょく
  const a = runRockSlideTrials(E, N, 31337, { ability: 'せいしんりょく' }, null);
  assert.equal(a.f0, 0, `せいしんりょくの枠は一度もひるまないはず(opp0=${a.f0}/${N})`);
  assert.ok(a.f1 > 0, `相方(耐性なし)は同じいわなだれでひるむはず(opp1=${a.f1}/${N})`);

  // (2-b) 後の枠(opp1)が せいしんりょく(左右を入れ替えても同じ)
  const b = runRockSlideTrials(E, N, 31338, null, { ability: 'せいしんりょく' });
  assert.equal(b.f1, 0, `せいしんりょくの枠は一度もひるまないはず(opp1=${b.f1}/${N})`);
  assert.ok(b.f0 > 0, `相方(耐性なし)は同じいわなだれでひるむはず(opp0=${b.f0}/${N})`);
});

// ===== 主張3 =====
test('主張3: ひるみは個体単位(ひるんだ枠だけ動けない・相方はそのターン行動する) [S3]', () => {
  const E = build2v2();
  // 相手2体に はたく を持たせ、攻撃側(バンギラス61)より遅い相手(30/30)にする=いわなだれが先に通る。
  // self:1 は フシギバナ(技なし)= opp1 の はたく の正面対象を用意するだけ。
  function oneTurn(seed) {
    placeSlot(E, 'self', 0, ATTACKER, 'iwanadare', { ability: 'ノーガード' });
    placeSlot(E, 'self', 1, 'フシギバナ', null, { hp: BIG_HP });
    placeSlot(E, 'opp', 0, OPP0, 'hataku', { hp: BIG_HP });
    placeSlot(E, 'opp', 1, OPP1, 'hataku', { hp: BIG_HP });
    E.setRandom(mulberry32(seed));
    const from = E.battleLog.length;
    E.runTurn();
    const lines = newLines(E.battleLog, from);
    return {
      f0: !!E.slotOf('opp', 0).flinched,
      f1: !!E.slotOf('opp', 1).flinched,
      blocked0: lines.some(s => s === `相手の ${OPP0} は ひるんで うごけない！`),
      blocked1: lines.some(s => s === `相手の ${OPP1} は ひるんで うごけない！`),
      acted0: lines.some(s => s.startsWith(`相手の ${OPP0} の はたく！`)),
      acted1: lines.some(s => s.startsWith(`相手の ${OPP1} の はたく！`)),
      lines: lines,
    };
  }
  // 「片方だけひるんだターン」を両向き1件ずつ探す(探索は決定論: seed 1..600 を順に)。
  let caseOnly0 = null, caseOnly1 = null;
  for (let seed = 1; seed <= 600 && !(caseOnly0 && caseOnly1); seed++) {
    const r = oneTurn(seed);
    if (r.f0 && !r.f1 && !caseOnly0) caseOnly0 = { seed, r };
    if (!r.f0 && r.f1 && !caseOnly1) caseOnly1 = { seed, r };
  }
  assert.ok(caseOnly0, 'opp0だけがひるむターンが見つからない(主張1が壊れている可能性)');
  assert.ok(caseOnly1, 'opp1だけがひるむターンが見つからない(主張1が壊れている可能性)');

  for (const c of [{ tag: 'opp0だけひるみ', ...caseOnly0, who: 0 }, { tag: 'opp1だけひるみ', ...caseOnly1, who: 1 }]) {
    const r = c.r;
    const dump = `seed=${c.seed} / ${JSON.stringify(r.lines)}`;
    if (c.who === 0) {
      assert.ok(r.blocked0, `${c.tag}: ひるんだ ${OPP0} は「ひるんで うごけない」で行動できないはず。${dump}`);
      assert.ok(!r.acted0, `${c.tag}: ひるんだ ${OPP0} は はたく を出せないはず。${dump}`);
      assert.ok(!r.blocked1, `${c.tag}: ひるんでいない ${OPP1} が「ひるんで うごけない」になってはいけない。${dump}`);
      assert.ok(r.acted1, `${c.tag}: ひるんでいない ${OPP1} はそのターン普通に行動するはず。${dump}`);
    } else {
      assert.ok(r.blocked1, `${c.tag}: ひるんだ ${OPP1} は「ひるんで うごけない」で行動できないはず。${dump}`);
      assert.ok(!r.acted1, `${c.tag}: ひるんだ ${OPP1} は はたく を出せないはず。${dump}`);
      assert.ok(!r.blocked0, `${c.tag}: ひるんでいない ${OPP0} が「ひるんで うごけない」になってはいけない。${dump}`);
      assert.ok(r.acted0, `${c.tag}: ひるんでいない ${OPP0} はそのターン普通に行動するはず。${dump}`);
    }
  }
});

// ===== 主張4 =====
test('主張4: エアスラッシュ(1体選択)のひるみは選んだ枠だけ30%・相方は0% [S2][S5]', () => {
  const E = build2v2();
  const N = 4000;
  function trials(seed, targetIdx) {
    E.setRandom(mulberry32(seed));
    const res = { f0: 0, f1: 0 };
    for (let i = 0; i < N; i++) {
      placeSlot(E, 'self', 0, ATTACKER, 'easurasshu',
        { ability: 'ノーガード', targetChoice: { side: 'opp', idx: targetIdx } });
      placeSlot(E, 'self', 1, null, null);
      placeSlot(E, 'opp', 0, OPP0, null, { hp: BIG_HP });
      placeSlot(E, 'opp', 1, OPP1, null, { hp: BIG_HP });
      E.runTurn();
      if (E.slotOf('opp', 0).flinched) res.f0++;
      if (E.slotOf('opp', 1).flinched) res.f1++;
    }
    return res;
  }
  // (4-a) 後の枠(opp1)を指名
  const a = trials(777001, 1);
  assert.equal(a.f0, 0, `選んでいない ${OPP0} はひるまないはず(opp0=${a.f0}/${N})`);
  assert.ok(Math.abs(pct(a.f1, N) - 30) <= 3.0,
    `選んだ ${OPP1} のひるみ率は30%±3.0pp であるべき(実測 ${pct(a.f1, N).toFixed(1)}% / ${a.f1}/${N})`);

  // (4-b) 先の枠(opp0)を指名
  const b = trials(777002, 0);
  assert.equal(b.f1, 0, `選んでいない ${OPP1} はひるまないはず(opp1=${b.f1}/${N})`);
  assert.ok(Math.abs(pct(b.f0, N) - 30) <= 3.0,
    `選んだ ${OPP0} のひるみ率は30%±3.0pp であるべき(実測 ${pct(b.f0, N).toFixed(1)}% / ${b.f0}/${N})`);
});
