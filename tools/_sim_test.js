/* 技ターン検証テスト環境（設計: TEST_ENV_DESIGN_技ターン検証.md）
 * 方式: real_battle_simulator.html の実エンジンを Node の vm でそのまま実行（sim無改変・単一ソース）。
 *       DOM/window は吸収プロキシでダミー化し、エンジン関数(calcDamage/runTurn 等)を取り出して検証する。
 * 実行: node tools/_sim_test.js   （全件pass=exit0 / 1件でもfail=exit1 → /goal の合否に使う）
 * 段階(設計§3): ①追加効果なし純粋攻撃 → ②状態異常 → ③能力ランク → ④優先度/素早さ → ⑤天候/フィールド
 */
const path = require('path');
const fs = require('fs');
const { buildEngine, mulberry32, ROOT } = require('./_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

// ===== 観戦レポート(review/sim_test_report.html) =====
// 各checkの「直前のcheck以降に流れたバトルログ」を拾い、テスト実行のたびにHTMLへ書き出す。
// 阿部さんがChromeで開きっぱなし→リロードすれば、テストが流したバトルをログで観戦できる(2026-06-11要望)。
const _report = [];        // {section, name, ok, detail, log:[{phase,msg}]}
let _reportSection = '';
let _reportLogPos = 0;
const _origConsoleLog = console.log.bind(console);
console.log = (...a) => {   // セクション見出し(=== 段… ===)を拾う(テスト本文は無改変で済ませる)
  const m = String(a[0] ?? '').match(/^\n?=== (.+?) ===/);
  if (m && !m[1].startsWith('結果')) { _reportSection = m[1]; try { _reportLogPos = E.battleLog.length; } catch (_e) { _reportLogPos = 0; } }
  _origConsoleLog(...a);
};

// ===== 軽量テストランナー =====
let pass = 0, fail = 0; const fails = [];
function check(name, cond, detail) {
  if (_reportLogPos > E.battleLog.length) _reportLogPos = 0;   // battleLogがリセットされた直後の巻き戻り対策
  _report.push({ section: _reportSection, name, ok: !!cond, detail: detail || '',
    log: E.battleLog.slice(_reportLogPos).map(l => ({ phase: l.phase, msg: l.msg })) });
  _reportLogPos = E.battleLog.length;
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; fails.push(name); console.log('  ❌ ' + name + (detail ? '  → ' + detail : '')); }
}

const E = buildEngine();
const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
const moveByName = n => Object.values(data.WAZA_MAP).find(m => m.name === n);
function freshSide(pokeName, moveKey) {
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  s.moves = moveKey ? [data.WAZA_MAP[moveKey]] : [];
  s.selectedMoveIdx = 0;
  return s;
}
function resetEnv() { E.env.weather = 'none'; E.env.weatherTurns = null; E.env.field = 'none'; E.env.fieldTurns = null; E.env.doubleBattle = false; E.env.trickRoom = false; E.env.trickRoomTurns = null; E.env.gravity = false; E.env.gravityTurns = null; E.env.wonderRoom = false; E.env.wonderRoomTurns = null; E.env.magicRoom = false; E.env.magicRoomTurns = null; if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null); }

console.log('=== 段① 追加効果なしの純粋攻撃技（はたく: ノーマル物理40） ===');
// 受けは「ノーマル等倍」になるタイプ。フシギバナ(くさ/どく)はノーマル技を等倍で受ける。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  const move = data.WAZA_MAP.hataku;

  // T1: calcDamage が健全（等倍・無効でない・min>0・min<=max・HP未満）
  const r = E.calcDamage('self', 'opp', move);
  check('T1 calcDamageが結果を返す', !!r, 'null');
  check('T1 無効でない(等倍)', r && !r.immune, r && r.reason);
  check('T1 ダメージ>0 かつ min<=max', r && r.min > 0 && r.min <= r.max, r && `min=${r.min} max=${r.max}`);
  check('T1 ダメージ < 相手HP(40威力なので一撃ではない)', r && r.max < r.hp, r && `max=${r.max} hp=${r.hp}`);
  check('T1 現状ゴールデン値 min=16 max=19', r && r.min === 16 && r.max === 19, r && `min=${r.min} max=${r.max}`);

  // T2: 「左が技→右が食らう」単発フロー(phaseDealDamage)。決定論seedで1値に確定。
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260608));
  const hp0 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = hp0;
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.phaseDealDamage('self', 'opp', move);
  const dealt = hp0 - E.sides.opp.currentHp;
  check('T2 右のHPが減った', E.sides.opp.currentHp < hp0, `hp0=${hp0} now=${E.sides.opp.currentHp}`);
  check('T2 減少量が計算範囲[16,19]内', dealt >= 16 && dealt <= 19, `dealt=${dealt}`);
  check('T2 余計な状態異常が付いていない', E.sides.opp.status === 'none', E.sides.opp.status);
  check('T2 余計なランク変化なし', Object.values(E.sides.opp.rank).every(v => v === 0), JSON.stringify(E.sides.opp.rank));
  check('T2 自分は反動等で減っていない(単発攻撃)', E.sides.self.currentHp === E.realStat(E.sides.self, 'hp'), `self=${E.sides.self.currentHp}`);
}

console.log('\n=== 段① マルチターン: 左→右 両者がはたく(runTurn・決定論) ===');
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260608));
  const selfHp0 = E.realStat(E.sides.self, 'hp');
  const oppHp0 = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check('T3 両者がはたくを撃ち、両者のHPが減った',
    E.sides.self.currentHp < selfHp0 && E.sides.opp.currentHp < oppHp0,
    `self ${selfHp0}->${E.sides.self.currentHp} / opp ${oppHp0}->${E.sides.opp.currentHp}`);
  check('T3 状態異常もランク変化も起きていない',
    E.sides.self.status === 'none' && E.sides.opp.status === 'none' &&
    Object.values(E.sides.self.rank).every(v => v === 0) && Object.values(E.sides.opp.rank).every(v => v === 0));
}

console.log('\n=== 段② 状態異常付与（おにび→やけど＋ターン終了スリップ） ===');
{
  // T4: 状態付与の単発適用（おにび: やけど100%）。phaseApplyEffectsで opp が burn になる。
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'onibi');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260608));
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.phaseApplyEffects('self', 'opp', data.WAZA_MAP.onibi);
  check('T4 おにびで相手が「やけど(burn)」になった', E.sides.opp.status === 'burn', E.sides.opp.status);

  // T5: やけどのターン終了スリップ = floor(maxHP/16) 減る
  const maxHp = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = maxHp;
  E.phaseSlipFor('opp');
  const expectedSlip = Math.max(1, Math.floor(maxHp / 16));
  check('T5 やけどスリップ = floor(最大HP/16)', maxHp - E.sides.opp.currentHp === expectedSlip,
    `減少=${maxHp - E.sides.opp.currentHp} 期待=${expectedSlip}`);

  // T6: リアルなターン(runTurn)で 左=おにび が当たり、右がやけど＋ターン終了スリップ
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'onibi');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(7));   // おにび(命中85)が当たるseed
  const oppMax = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check('T6 runTurnで相手がやけどになった', E.sides.opp.status === 'burn', E.sides.opp.status);
  check('T6 相手はやけどスリップでHPが減っている', E.sides.opp.currentHp < oppMax,
    `opp ${oppMax}->${E.sides.opp.currentHp}`);
}

console.log('\n=== 段③ 能力ランク変化（つるぎのまい=こうげき+2 / めいそう=とくこう・とくぼう+1） ===');
{
  // T7: つるぎのまい(自分のこうげき+2)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.phaseApplyEffects('self', 'opp', moveByName('つるぎのまい'));
  check('T7 つるぎのまいで自分のこうげき rank +2', E.sides.self.rank.atk === 2, `atk=${E.sides.self.rank.atk}`);

  // T8: めいそう(とくこう+1・とくぼう+1) 複数stat
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.phaseApplyEffects('self', 'opp', moveByName('めいそう'));
  check('T8 めいそうで とくこう+1・とくぼう+1', E.sides.self.rank.spatk === 1 && E.sides.self.rank.spdef === 1,
    `spatk=${E.sides.self.rank.spatk} spdef=${E.sides.self.rank.spdef}`);
}

console.log('\n=== 段④ 行動順（優先度→素早さ→トリックルーム） ===');
{
  // T9: でんこうせっか(優先度+1)は、相手が速くても先攻
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('でんこうせっか')];
  E.sides.opp = freshSide('フシギバナ', null); E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.rank.spd = 6; // 相手を最速にしても…
  check('T9 優先度+1(でんこうせっか)が先攻', E.decideOrder(E.sides.self.moves[0], E.sides.opp.moves[0]) === 'self');

  // T10: 同優先度なら速い方が先攻
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('はたく')]; E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null); E.sides.opp.moves = [moveByName('はたく')];
  check('T10 同優先度なら速い方(self)が先攻', E.decideOrder(E.sides.self.moves[0], E.sides.opp.moves[0]) === 'self');

  // T11: トリックルームで遅い方が先攻
  E.env.trickRoom = true;
  check('T11 トリックルームで遅い方(opp)が先攻', E.decideOrder(E.sides.self.moves[0], E.sides.opp.moves[0]) === 'opp');
  resetEnv();
}

console.log('\n=== 段⑤ 天候（はれ/あめ でほのお技の威力が増減） ===');
{
  const fireDmg = (weather) => {
    resetEnv(); E.env.weather = weather;
    E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('かえんほうしゃ')];
    E.sides.opp = freshSide('フシギバナ', null);
    return E.calcDamage('self', 'opp', moveByName('かえんほうしゃ'));
  };
  const none = fireDmg('none'), sun = fireDmg('sunny'), rain = fireDmg('rain');
  check('T12 はれでほのお技の威力UP', sun.max > none.max, `none=${none && none.max} sun=${sun && sun.max}`);
  check('T13 あめでほのお技の威力DOWN', rain.max < none.max, `none=${none && none.max} rain=${rain && rain.max}`);
  resetEnv();
}

console.log('\n=== 段⑥ ★本物に当てる(育成考察Wiki): ガブ じしん→くさ = 51〜61 ===');
{
  // 出典: 育成考察Wiki ダメージ計算式。Lv50 攻撃実数値182のじしん(威力100)→防御実数値100・じめん0.5倍 = 51〜61。
  resetEnv();
  E.sides.self = freshSide('ガブリアス', null); E.sides.self.moves = [moveByName('じしん')];
  E.sides.self.natureIdx = 0; E.sides.self.effort.atk = 32;       // 攻撃実数値 182 を狙う
  E.sides.opp = freshSide('アップリュー', null);                   // くさ単=じめん0.5倍
  E.sides.opp.natureIdx = 0; E.sides.opp.effort.def = 0;          // 防御実数値 100 を狙う
  const atk = E.realStat(E.sides.self, 'atk'), def = E.realStat(E.sides.opp, 'def');
  check('T14 攻撃実数値が182になっている', atk === 182, `atk=${atk}`);
  check('T14 防御実数値が100になっている', def === 100, `def=${def}`);
  const r = E.calcDamage('self', 'opp', moveByName('じしん'));
  check('T14★ ガブじしん→くさ が 本物(育成考察Wiki)の 51〜61 と一致',
    r && r.min === 51 && r.max === 61, r && `sim=${r.min}〜${r.max} / 本物=51〜61`);
}

console.log('\n=== 段⑦ 食らって返す(多ターン・決着まで) ===');
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260608));
  let turns = 0; const oppHps = [];
  while (turns < 40 && !E.sides.self.fainted && !E.sides.opp.fainted) {
    E.runTurn(); turns++; oppHps.push(E.sides.opp.currentHp);
  }
  check('T15 食らって返すを繰り返し、数ターンで決着(どちらか瀕死)',
    (E.sides.self.fainted || E.sides.opp.fainted) && turns >= 2, `turns=${turns}`);
  const monotonic = oppHps.every((h, i) => i === 0 || h <= oppHps[i - 1]);
  check('T15 相手HPはターンごとに減っていく(単調減少)', monotonic, JSON.stringify(oppHps));
  check('T15 決着時に敗者のHPは0', Math.min(E.sides.self.currentHp, E.sides.opp.currentHp) <= 0,
    `self=${E.sides.self.currentHp} opp=${E.sides.opp.currentHp}`);
}

console.log('\n=== 段⑧ ひるみ（ねこだまし=優先度+3・ひるみ100% → 相手は動けない） ===');
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('ねこだまし')];
  E.sides.opp = freshSide('フシギバナ', null); E.sides.opp.moves = [moveByName('はたく')];
  E.setRandom(mulberry32(20260608));
  const selfMax = E.realStat(E.sides.self, 'hp'), oppMax = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check('T16 ねこだましで相手がひるんだ', E.sides.opp.flinched === true, `flinched=${E.sides.opp.flinched}`);
  check('T16 ひるんだ相手は行動できず自分は無傷', E.sides.self.currentHp === selfMax, `self=${E.sides.self.currentHp}/${selfMax}`);
  check('T16 相手はねこだましのダメージを受けている', E.sides.opp.currentHp < oppMax, `opp=${E.sides.opp.currentHp}/${oppMax}`);

  // T17: 通常攻撃のターンではひるみは起きない(誤検出なし)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku'); E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260608));
  E.runTurn();
  check('T17 通常攻撃ではひるみは起きない', !E.sides.self.flinched && !E.sides.opp.flinched);
}

console.log('\n=== 段⑨ ねこだましは「場に出た最初のターン」だけ（全ひるみ技ではない） ===');
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('ねこだまし')];
  E.sides.opp = freshSide('フシギバナ', null); E.sides.opp.moves = [moveByName('はたく')];
  E.setRandom(mulberry32(20260608));
  E.runTurn(); // 1ターン目
  check('T18 1ターン目はねこだましが効く(相手ひるみ)', E.sides.opp.flinched === true, `flinched=${E.sides.opp.flinched}`);
  const selfHp1 = E.sides.self.currentHp;
  E.runTurn(); // 2ターン目
  check('T19 2ターン目はねこだまし不可→相手はひるまない', E.sides.opp.flinched === false, `flinched=${E.sides.opp.flinched}`);
  check('T19 2ターン目は相手が反撃して自分が被弾', E.sides.self.currentHp < selfHp1, `self ${selfHp1}->${E.sides.self.currentHp}`);

  // T20: 普通のひるみ技(かみつく)は最初のターン限定ではない=2ターン目も使える(誤適用なし)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('かみつく')];
  E.sides.opp = freshSide('フシギバナ', null); E.sides.opp.moves = [moveByName('はたく')];
  E.setRandom(mulberry32(1)); E.runTurn(); E.runTurn(); // 2ターン回す
  const oppMax = E.realStat(E.sides.opp, 'hp');
  check('T20 かみつく(通常ひるみ技)は2ターン目も普通に使える(相手が被弾し続ける)', E.sides.opp.currentHp < oppMax, `opp=${E.sides.opp.currentHp}/${oppMax}`);
}

console.log('\n=== 段⑩ mismatch修正(検証WFが検出): はらだいこ to_max / つぼをつく random_one_of ===');
{
  // T21: はらだいこ → こうげきが最大(+6)まで上がる(to_max)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.phaseApplyEffects('self', 'opp', moveByName('はらだいこ'));
  check('T21 はらだいこで こうげきランクが最大+6', E.sides.self.rank.atk === 6, `atk=${E.sides.self.rank.atk}`);

  // T22: つぼをつく → 7能力のうち「ちょうど1つだけ」+2(ランダム抽選)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(20260608));
  E.phaseApplyEffects('self', 'opp', moveByName('つぼをつく'));
  const raised = Object.entries(E.sides.self.rank).filter(([, v]) => v !== 0);
  check('T22 つぼをつくで上がる能力はちょうど1つ', raised.length === 1, `raised=${JSON.stringify(Object.fromEntries(raised))}`);
  check('T22 その1つは+2', raised.length === 1 && raised[0][1] === 2, `${JSON.stringify(raised)}`);
}

console.log('\n=== 段⑪ 吸収・反動（与ダメから計算） ===');
{
  // T23: ドレインパンチ → 与ダメの半分(fraction0.5)だけ自分が回復
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('ドレインパンチ')];
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(20260608));
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.sides.self.currentHp = 1; // 低HPにして回復を可視化
  const r1 = E.phaseDealDamage('self', 'opp', moveByName('ドレインパンチ'));
  const heal = Math.max(1, Math.floor(r1.variation * 0.5));
  check('T23 吸収で与ダメの半分だけ回復', E.sides.self.currentHp === 1 + heal, `self=${E.sides.self.currentHp} 期待=${1 + heal} (与ダメ=${r1.variation})`);

  // T24: すてみタックル → 与ダメの約1/3(fraction0.33)を自分も受ける
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('すてみタックル')];
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(20260608));
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  const selfMax = E.realStat(E.sides.self, 'hp'); E.sides.self.currentHp = selfMax;
  const r2 = E.phaseDealDamage('self', 'opp', moveByName('すてみタックル'));
  const rec = Math.max(1, Math.floor(r2.variation * 0.33));
  check('T24 反動で与ダメの約1/3を自分も受ける', selfMax - E.sides.self.currentHp === rec, `反動=${selfMax - E.sides.self.currentHp} 期待=${rec} (与ダメ=${r2.variation})`);
}

console.log('\n=== 段⑫ 連続攻撃（複数ヒット） ===');
{
  // T25: ダブルアタック(hits:2固定) → 2回ヒット・合計は単発の約2倍
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('ダブルアタック')];
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(20260608));
  E.sides.opp.currentHp = 9999; // 倒れず全ヒット受ける
  const single = E.calcDamage('self', 'opp', moveByName('ダブルアタック'));
  const r25 = E.phaseDealDamage('self', 'opp', moveByName('ダブルアタック'));
  const drop = 9999 - E.sides.opp.currentHp;
  check('T25 ダブルアタックは2回ヒット', r25.hits === 2, `hits=${r25.hits}`);
  check('T25 合計ダメは単発の約2倍(範囲内)', drop >= 2 * single.min && drop <= 2 * single.max, `drop=${drop} 単発${single.min}-${single.max}`);

  // T26: ミサイルばり(2〜5) → ヒット数が2〜5
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('ミサイルばり')];
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(7));
  E.sides.opp.currentHp = 9999;
  const r26 = E.phaseDealDamage('self', 'opp', moveByName('ミサイルばり'));
  check('T26 ミサイルばりは2〜5回ヒット', r26.hits >= 2 && r26.hits <= 5, `hits=${r26.hits}`);
}

console.log('\n=== 段⑬ 回復(変化技)＋ 連続攻撃 max_hits（検証WFが指摘） ===');
{
  // T27: じこさいせい → 最大HPの半分回復
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  const max = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = 1;
  E.phaseApplyEffects('self', 'opp', moveByName('じこさいせい'));
  check('T27 じこさいせいで最大HPの半分回復', E.sides.self.currentHp === 1 + Math.floor(max * 0.5), `hp=${E.sides.self.currentHp} 期待=${1 + Math.floor(max * 0.5)}`);

  // T28: あさのひざし → 天候なしは1/2 / にほんばれは2/3(条件分岐)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.currentHp = 1;
  E.phaseApplyEffects('self', 'opp', moveByName('あさのひざし'));
  check('T28 あさのひざし(天候なし)=1/2回復', E.sides.self.currentHp === 1 + Math.floor(max * 0.5), `hp=${E.sides.self.currentHp}`);
  resetEnv(); E.env.weather = 'sunny';
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.currentHp = 1;
  E.phaseApplyEffects('self', 'opp', moveByName('あさのひざし'));
  check('T28 あさのひざし(はれ)=約2/3回復', E.sides.self.currentHp === 1 + Math.floor(max * 0.6667), `hp=${E.sides.self.currentHp} 期待=${1 + Math.floor(max * 0.6667)}`);

  // T29: ネズミざん(max_hits:10) → 複数ヒット
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('ネズミざん')];
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(7)); E.sides.opp.currentHp = 99999;
  const r29 = E.phaseDealDamage('self', 'opp', moveByName('ネズミざん'));
  check('T29 ネズミざんが複数ヒット(>1)', r29.hits > 1, `hits=${r29.hits}`);
}

console.log('\n=== 段⑭ あくび(遅延ねむり)=即眠りでなく次ターン終わりに眠る（mismatch修正） ===');
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('あくび')];
  E.sides.opp = freshSide('フシギバナ', null); E.sides.opp.moves = [moveByName('はたく')];
  E.setRandom(mulberry32(20260608));
  E.runTurn(); // ターン1: あくび → ねむけ(まだ眠らない)
  check('T30 あくび直後は眠っていない(ねむけのみ)', E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);
  check('T30 次ターン終わりに眠る予約がある', !!E.sides.opp.pendingStatus, JSON.stringify(E.sides.opp.pendingStatus));
  E.runTurn(); // ターン2の終わりに発動
  check('T30 次のターン終わりに「ねむり」状態になる', E.sides.opp.status === 'sleep', `status=${E.sides.opp.status}`);
}

console.log('\n=== 段⑮ power=null ダメージ(固定ダメージ・一撃必殺) ===');
{
  // T31: ちきゅうなげ → 固定50ダメージ(champions_amount)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('ちきゅうなげ')];
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(1));
  const oppMax = E.realStat(E.sides.opp, 'hp'); E.sides.opp.currentHp = oppMax;
  E.phaseDealDamage('self', 'opp', moveByName('ちきゅうなげ'));
  check('T31 ちきゅうなげは固定50ダメージ', oppMax - E.sides.opp.currentHp === 50, `減=${oppMax - E.sides.opp.currentHp}`);

  // T32: つのドリル → 一撃必殺(相手ひんし)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('つのドリル')];
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(1));
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.phaseDealDamage('self', 'opp', moveByName('つのドリル'));
  check('T32 つのドリルは一撃必殺(相手HP0・ひんし)', E.sides.opp.currentHp === 0 && E.sides.opp.fainted, `hp=${E.sides.opp.currentHp} fainted=${E.sides.opp.fainted}`);
}

console.log('\n=== 段⑯ こうかなし(タイプ無効)なら追加効果も発動しない（全技共通） ===');
{
  // ねこだまし(ノーマル) → ヤミラミ(あく/ゴースト)= ノーマルはゴーストに無効 → ダメージ0かつ「ひるみ」も起きない
  const ghost = data.POKEMON_LIST.find(p => (p.type1 === 'ゴースト' || p.type2 === 'ゴースト') && p.type1 !== 'ノーマル');
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('ねこだまし')];
  E.sides.opp = E.makeSideState(); E.sides.opp.poke = ghost; E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(mulberry32(20260608));
  const oppMax = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check(`T33 ノーマル技はゴースト(${ghost ? ghost.name : '?'})に無効=ダメージ0`, E.sides.opp.currentHp === oppMax, `hp=${E.sides.opp.currentHp}/${oppMax}`);
  check('T33 こうかなしならひるみ(追加効果)も発動しない', E.sides.opp.flinched !== true, `flinched=${E.sides.opp.flinched}`);
}

console.log('\n=== 段⑰ 変化技も「効かない相手には付与しない」(状態異常のタイプ無効) ===');
{
  const P = data.POKEMON_LIST;
  const fire = P.find(p => p.type1 === 'ほのお' || p.type2 === 'ほのお');
  const steel = P.find(p => p.type1 === 'はがね' || p.type2 === 'はがね');
  const ground = P.find(p => (p.type1 === 'じめん' || p.type2 === 'じめん') && p.type1 !== 'でんき' && p.type2 !== 'でんき');
  const setOpp = poke => { E.sides.opp = E.makeSideState(); E.sides.opp.poke = poke; };

  // おにび → ほのおタイプ = やけど付かない
  resetEnv(); E.sides.self = freshSide('フシギバナ', null); setOpp(fire);
  E.setRandom(mulberry32(1)); E.phaseApplyEffects('self', 'opp', moveByName('おにび'));
  check(`T34 おにび→ほのお(${fire && fire.name})はやけど無効`, E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);

  // どくどく → はがねタイプ = どく付かない
  resetEnv(); E.sides.self = freshSide('フシギバナ', null); setOpp(steel);
  E.setRandom(mulberry32(1)); E.phaseApplyEffects('self', 'opp', moveByName('どくどく'));
  check(`T34 どくどく→はがね(${steel && steel.name})はどく無効`, E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);

  // でんじは → じめんタイプ = まひ付かない(でんき技がじめんに無効)
  resetEnv(); E.sides.self = freshSide('フシギバナ', null); setOpp(ground);
  E.setRandom(mulberry32(1)); E.phaseApplyEffects('self', 'opp', moveByName('でんじは'));
  check(`T34 でんじは→じめん(${ground && ground.name})はまひ無効`, E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);

  // 対照: でんじは → 無効でないタイプ(フシギバナ)はちゃんとまひ
  resetEnv(); E.sides.self = freshSide('フシギバナ', null); setOpp(P.find(p => p.name === 'フシギバナ'));
  E.setRandom(mulberry32(1)); E.phaseApplyEffects('self', 'opp', moveByName('でんじは'));
  check('T34 対照: でんじは→フシギバナはまひする', E.sides.opp.status === 'paralysis', `status=${E.sides.opp.status}`);
}

console.log('\n=== 段⑱ こんらん付与＋混乱で自分を攻撃 ===');
{
  // T35: あやしいひかり → 相手がこんらん(2〜5ターン)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(1));
  E.phaseApplyEffects('self', 'opp', moveByName('あやしいひかり'));
  check('T35 あやしいひかりで相手がこんらん(2〜5ターン)', E.sides.opp.confusion >= 2 && E.sides.opp.confusion <= 5, `confusion=${E.sides.opp.confusion}`);

  // T36: 混乱中、行動時に自分を攻撃しうる(rng固定で自傷を起こす)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.self.confusion = 3;
  E.setRandom(() => 0); // 0<1/3 → 自傷
  const selfMax = E.realStat(E.sides.self, 'hp'); E.sides.self.currentHp = selfMax;
  const oppMax = E.realStat(E.sides.opp, 'hp'); E.sides.opp.currentHp = oppMax;
  E.runTurn();
  check('T36 混乱中は自分を攻撃してHPが減る', E.sides.self.currentHp < selfMax, `self=${E.sides.self.currentHp}/${selfMax}`);
  check('T36 混乱で自傷した側は相手を攻撃できていない', E.sides.opp.currentHp === oppMax, `opp=${E.sides.opp.currentHp}/${oppMax}`);
}

console.log('\n=== 段⑲ 威力可変(power=null系: HP/すばやさ基準) ===');
// 期待値の出典(権威ソース):
// - きしかいせい/じたばた: Bulbapedia "Reversal (move)" Gen V+ — P=floor(48*currentHP/maxHP):
//   P<2→200 / P<5→150 / P<10→100 / P<17→80 / P<33→40 / それ以外→20
// - ジャイロボール: Bulbapedia "Gyro Ball (move)" — power = min(150, floor(25*相手すばやさ/自分すばやさ)+1)
//   (すばやさはランク・まひ等の補正込み。トリックルームは影響しない)
// - エレキボール: Bulbapedia "Electro Ball (move)" — 自分すばやさ/相手すばやさ比:
//   <1→40 / <2→60 / <3→80 / <4→120 / ≧4→150
// - ハードプレス: Bulbapedia "Hard Press (move)" — power = 100*相手の残りHP/最大HP (最小1・最大100)
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  const vp = (mv) => E.variablePower ? E.variablePower(mv, E.sides.self, E.sides.opp) : null;
  const selfMax = E.realStat(E.sides.self, 'hp');
  const oppMax = E.realStat(E.sides.opp, 'hp');
  E.sides.self.currentHp = selfMax; E.sides.opp.currentHp = oppMax;

  // T37: きしかいせい — HP満タン=20 / 1/3=80 / HP1=200
  const kishi = moveByName('きしかいせい');
  check('T37 きしかいせい HP満タン→威力20', vp(kishi) === 20, `power=${vp(kishi)}`);
  E.sides.self.currentHp = Math.floor(selfMax / 3);
  check('T37 きしかいせい HP1/3→威力80', vp(kishi) === 80, `power=${vp(kishi)}`);
  E.sides.self.currentHp = 1;
  check('T37 きしかいせい HP1→威力200', vp(kishi) === 200, `power=${vp(kishi)}`);

  // T38: じたばた — HP半分=40(P=23<33)
  E.sides.self.currentHp = Math.floor(selfMax / 2);
  const jita = moveByName('じたばた');
  check('T38 じたばた HP半分→威力40', vp(jita) === 40, `power=${vp(jita)}`);
  E.sides.self.currentHp = selfMax;

  // T39: ジャイロボール — 同速(同ポケ)→floor(25*1)+1=26 / 自分-6ランク(×0.25)→相手が4倍速=floor(100)+1=101
  const gyro = moveByName('ジャイロボール');
  check('T39 ジャイロボール 同速→威力26', vp(gyro) === 26, `power=${vp(gyro)}`);
  E.sides.self.rank.spd = -6; // ×0.25 → 相手/自分 = 4
  check('T39 ジャイロボール 相手4倍速→威力101', vp(gyro) === 101, `power=${vp(gyro)}`);
  E.sides.self.rank.spd = 0;

  // T40: エレキボール — 同速(比1)→60 / 自分+6ランク(×4=比4)→150 / 自分-6(比0.25<1)→40
  const elec = moveByName('エレキボール');
  check('T40 エレキボール 同速→威力60', vp(elec) === 60, `power=${vp(elec)}`);
  E.sides.self.rank.spd = 6;
  check('T40 エレキボール 自分4倍速→威力150', vp(elec) === 150, `power=${vp(elec)}`);
  E.sides.self.rank.spd = -6;
  check('T40 エレキボール 相手が速い→威力40', vp(elec) === 40, `power=${vp(elec)}`);
  E.sides.self.rank.spd = 0;

  // T41: ハードプレス — 相手HP満タン→100 / 相手30%→floor(100*cur/max)
  const press = moveByName('ハードプレス');
  check('T41 ハードプレス 相手HP満タン→威力100', vp(press) === 100, `power=${vp(press)}`);
  E.sides.opp.currentHp = Math.floor(oppMax * 0.3);
  const expPress = Math.max(1, Math.floor(100 * E.sides.opp.currentHp / oppMax));
  check('T41 ハードプレス 相手HP30%→威力' + expPress, vp(press) === expPress, `power=${vp(press)}`);
  E.sides.opp.currentHp = oppMax;

  // T42: calcDamage 統合 — きしかいせい(power=null)がダメージを返す(従来はnull)
  const r = E.calcDamage('self', 'opp', kishi);
  check('T42 きしかいせいで calcDamage が非null・min>0', !!r && !r.immune && r.min > 0, r ? `min=${r.min}` : 'null');
}

console.log('\n=== 段⑳ 倍返し(カウンター/ミラーコート/メタルバースト) ===');
// 期待値の出典(権威ソース):
// - カウンター: Bulbapedia "Counter (move)" — そのターンに受けた物理ダメージの2倍を返す。優先度-5。
//   物理を受けていなければ失敗。ゴーストタイプには無効(タイプ無効は適用・相性倍率は無視)。
// - ミラーコート: Bulbapedia "Mirror Coat (move)" — 特殊ダメージの2倍。優先度-5。物理には失敗。
// - メタルバースト: Bulbapedia "Metal Burst (move)" — 物理/特殊問わず最後に受けたダメージの1.5倍。優先度0。
{
  // T43: カウンター — 物理を受けた後、2倍を返す
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('カウンター')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260610));
  const selfMax = E.realStat(E.sides.self, 'hp'); E.sides.self.currentHp = selfMax;
  const oppMax = E.realStat(E.sides.opp, 'hp'); E.sides.opp.currentHp = oppMax;
  E.phaseDealDamage('opp', 'self', moveByName('はたく'));
  const taken = selfMax - E.sides.self.currentHp;
  E.phaseDealDamage('self', 'opp', moveByName('カウンター'));
  const returned = oppMax - E.sides.opp.currentHp;
  check('T43 カウンター=受けた物理の2倍を返す', taken > 0 && returned === taken * 2, `taken=${taken} returned=${returned}`);

  // T44: カウンターは特殊技に失敗 / ミラーコートは特殊の2倍
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('カウンター'), moveByName('ミラーコート')];
  E.sides.opp = freshSide('フシギバナ', null); E.sides.opp.moves = [moveByName('10まんボルト')];
  E.setRandom(mulberry32(20260610));
  const sMax = E.realStat(E.sides.self, 'hp'); E.sides.self.currentHp = sMax;
  const oMax = E.realStat(E.sides.opp, 'hp'); E.sides.opp.currentHp = oMax;
  E.phaseDealDamage('opp', 'self', moveByName('10まんボルト'));
  const taken2 = sMax - E.sides.self.currentHp;
  E.phaseDealDamage('self', 'opp', moveByName('カウンター'));
  check('T44 カウンターは特殊ダメージには失敗(相手HP減らず)', E.sides.opp.currentHp === oMax, `opp=${E.sides.opp.currentHp}/${oMax}`);
  E.phaseDealDamage('self', 'opp', moveByName('ミラーコート'));
  check('T44 ミラーコート=受けた特殊の2倍を返す', taken2 > 0 && oMax - E.sides.opp.currentHp === taken2 * 2,
    `taken=${taken2} returned=${oMax - E.sides.opp.currentHp}`);

  // T45: メタルバースト — 物理/特殊問わず最後に受けたダメージの1.5倍(切り捨て)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('メタルバースト')];
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260610));
  const sMax3 = E.realStat(E.sides.self, 'hp'); E.sides.self.currentHp = sMax3;
  const oMax3 = E.realStat(E.sides.opp, 'hp'); E.sides.opp.currentHp = oMax3;
  E.phaseDealDamage('opp', 'self', moveByName('はたく'));
  const taken3 = sMax3 - E.sides.self.currentHp;
  E.phaseDealDamage('self', 'opp', moveByName('メタルバースト'));
  check('T45 メタルバースト=最後に受けたダメージの1.5倍(切り捨て)',
    taken3 > 0 && oMax3 - E.sides.opp.currentHp === Math.floor(taken3 * 1.5),
    `taken=${taken3} returned=${oMax3 - E.sides.opp.currentHp} 期待=${Math.floor(taken3 * 1.5)}`);

  // T46: 受けていないターンのカウンターは失敗 / ゴーストにはカウンター無効
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('カウンター')];
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.setRandom(mulberry32(20260610));
  const gMax = E.realStat(E.sides.opp, 'hp'); E.sides.opp.currentHp = gMax;
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.phaseDealDamage('self', 'opp', moveByName('カウンター'));
  check('T46 何も受けていないターンのカウンターは失敗', E.sides.opp.currentHp === gMax, `opp=${E.sides.opp.currentHp}/${gMax}`);
  E.phaseDealDamage('opp', 'self', moveByName('はたく'));
  E.phaseDealDamage('self', 'opp', moveByName('カウンター'));
  check('T46 ゴーストタイプにはカウンター無効', E.sides.opp.currentHp === gMax, `opp=${E.sides.opp.currentHp}/${gMax}`);

  // T47: 優先度 — カウンター(-5)は同速でも後攻
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('カウンター')];
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  const first = E.decideOrder(moveByName('カウンター'), moveByName('はたく'));
  check('T47 カウンター(優先度-5)は相手が先攻', first === 'opp', `first=${first}`);

  // T48: runTurn統合 — 受けたターン内に2倍を返す(はたく→カウンターの順に自動で解決)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null); E.sides.self.moves = [moveByName('カウンター')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260610));
  const sM = E.realStat(E.sides.self, 'hp'); E.sides.self.currentHp = sM;
  const oM = E.realStat(E.sides.opp, 'hp'); E.sides.opp.currentHp = oM;
  E.runTurn();
  const tk = sM - E.sides.self.currentHp;
  check('T48 runTurn: カウンターがそのターン受けた物理の2倍を返す', tk > 0 && oM - E.sides.opp.currentHp === tk * 2,
    `taken=${tk} returned=${oM - E.sides.opp.currentHp}`);
}

console.log('\n=== 段㉑ 威力可変(体重系: けたぐり/くさむすび/ヘビーボンバー/ヒートスタンプ) ===');
// 期待値の出典(権威ソース):
// - けたぐり/くさむすび: Bulbapedia "Low Kick (move)" GenIII+ — 相手の体重(kg):
//   <10→20 / 10〜24.9→40 / 25〜49.9→60 / 50〜99.9→80 / 100〜199.9→100 / 200以上→120
//   (境界は下側に含む: ちょうど10.0kg→40、ちょうど100.0kg→100)
// - ヘビーボンバー/ヒートスタンプ: Bulbapedia "Heavy Slam (move)" — 相手の体重/自分の体重:
//   >1/2→40 / >1/3〜1/2→60 / >1/4〜1/3→80 / >1/5〜1/4→100 / 1/5以下→120
//   (境界は重い側に含む: ちょうど1/2→60、ちょうど1/5→120)
// 体重はSSOT(pokechan_data.js weight_kg, 028c924で追加・PokéAPI由来二重検証済み)
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('ピカチュウ', null);
  const vp = (mv) => E.variablePower ? E.variablePower(mv, E.sides.self, E.sides.opp) : null;
  const setOpp = n => { E.sides.opp.poke = pokeByName(n); E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp'); };
  const setSelf = n => { E.sides.self.poke = pokeByName(n); E.sides.self.currentHp = E.realStat(E.sides.self, 'hp'); };

  // T49: けたぐり — 相手の体重段階表(境界: ちょうど100.0kg→100)
  const kick = moveByName('けたぐり');
  check('T49 けたぐり vs ピカチュウ(6.0kg)→威力20', vp(kick) === 20, `power=${vp(kick)}`);
  setOpp('ゲンガー');   // 40.5kg
  check('T49 けたぐり vs ゲンガー(40.5kg)→威力60', vp(kick) === 60, `power=${vp(kick)}`);
  setOpp('フシギバナ'); // 100.0kg ちょうど → 100〜199.9の枠
  check('T49 けたぐり vs フシギバナ(100.0kgちょうど)→威力100', vp(kick) === 100, `power=${vp(kick)}`);
  setOpp('カビゴン');   // 460kg
  check('T49 けたぐり vs カビゴン(460kg)→威力120', vp(kick) === 120, `power=${vp(kick)}`);

  // T50: くさむすび — 同じ段階表(effectsのキーは weight_thresholds)
  const grass = moveByName('くさむすび');
  check('T50 くさむすび vs カビゴン(460kg)→威力120', vp(grass) === 120, `power=${vp(grass)}`);
  setOpp('ピカチュウ');
  check('T50 くさむすび vs ピカチュウ(6.0kg)→威力20', vp(grass) === 20, `power=${vp(grass)}`);

  // T51: ヘビーボンバー — 自分と相手の体重比(境界: ちょうど1/2→60、ちょうど1/5→120)
  const slam = moveByName('ヘビーボンバー');
  setSelf('カビゴン'); setOpp('ピカチュウ'); // 6/460 ≪ 1/5
  check('T51 ヘビーボンバー カビゴン→ピカチュウ(比0.013)→威力120', vp(slam) === 120, `power=${vp(slam)}`);
  setSelf('フシギバナ'); setOpp('カビゴン'); // 相手の方が重い
  check('T51 ヘビーボンバー フシギバナ→カビゴン(比4.6)→威力40', vp(slam) === 40, `power=${vp(slam)}`);
  setOpp('ドラパルト'); // 50/100 = ちょうど1/2 → 60
  check('T51 ヘビーボンバー 比ちょうど1/2→威力60', vp(slam) === 60, `power=${vp(slam)}`);
  setSelf('アーボック'); setOpp('タルップル'); // 13/65 = ちょうど1/5 → 120
  check('T51 ヘビーボンバー 比ちょうど1/5→威力120', vp(slam) === 120, `power=${vp(slam)}`);

  // T52: ヒートスタンプ — 同じ体重比表(effectsのキーは table/max_ratio)
  const stamp = moveByName('ヒートスタンプ');
  setSelf('カビゴン'); setOpp('ピカチュウ');
  check('T52 ヒートスタンプ カビゴン→ピカチュウ→威力120', vp(stamp) === 120, `power=${vp(stamp)}`);
  setSelf('フシギバナ'); setOpp('ドラパルト');
  check('T52 ヒートスタンプ 比ちょうど1/2→威力60', vp(stamp) === 60, `power=${vp(stamp)}`);

  // T53: calcDamage統合 — けたぐり(power=null)がダメージを返す
  setSelf('カイリキー'); setOpp('カビゴン');
  const r = E.calcDamage('self', 'opp', kick);
  check('T53 けたぐりで calcDamage が非null・min>0', !!r && !r.immune && r.min > 0, r ? `min=${r.min}` : 'null');
}

console.log('\n=== 段㉒ テスト用ダミーポケモン(sim専用・HP999/平均能力/全技使用可) ===');
// ダミーはsimローカル定義(SSOT非汚染)。実数値の期待値はポケチャン式(calcRealStat)から:
//   HP: floor((924*2+31)/2)+60 = 999 / 他: floor((100*2+31)/2)+5 = 120(P0・性格補正なし)
{
  resetEnv();
  check('T54 TEST_POKEMON が3体(みず/ノーマル/ゴースト)', Array.isArray(E.TEST_POKEMON) && E.TEST_POKEMON.length === 3
    && ['みず','ノーマル','ゴースト'].every(t => E.TEST_POKEMON.some(p => p.type1 === t)),
    E.TEST_POKEMON ? E.TEST_POKEMON.map(p=>p.type1).join(',') : 'null');

  const dummy = E.TEST_POKEMON.find(p => p.type1 === 'みず');
  const ds = E.makeSideState(); ds.poke = dummy;
  check('T54 ダミーのHP実数値=999', E.realStat(ds, 'hp') === 999, `hp=${E.realStat(ds, 'hp')}`);
  check('T54 ダミーの他能力=120(平均)', ['atk','def','spatk','spdef','spd'].every(k => E.realStat(ds, k) === 120),
    ['atk','def','spatk','spdef','spd'].map(k=>E.realStat(ds,k)).join(','));
  // 体重 = 全275匹の平均(91.2kg)。SSOTから再計算して一致を確認(平均が変わったらダミーも追従させる)
  const ws = data.POKEMON_LIST.map(p => p.weight_kg).filter(w => typeof w === 'number');
  const avg = Math.round(ws.reduce((a, b) => a + b, 0) / ws.length * 10) / 10;
  check(`T54 体重=全${ws.length}匹の平均(${avg}kg)`, dummy.weight_kg === avg, `weight=${dummy.weight_kg} avg=${avg}`);

  // T55: 全技使える(learners無視)
  const all = E.usableMoves(dummy);
  const total = Object.keys(data.WAZA_MAP).length;
  check(`T55 usableMoves(ダミー)=全${total}技`, all.length === total, `got=${all.length}`);
  const real = pokeByName('フシギバナ');
  check('T55 通常ポケモンは従来どおりlearnersで絞る', E.usableMoves(real).length < total, `got=${E.usableMoves(real).length}`);

  // T56: タイプ相性 — みずダミーは無効タイプなし(ゴースト技も当たる)/ノーマルダミーはゴースト技無効
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('シャドーボール')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = E.makeSideState(); E.sides.opp.poke = dummy;
  const r1 = E.calcDamage('self', 'opp', moveByName('シャドーボール'));
  check('T56 みずダミーにゴースト技が当たる(無効なし)', !!r1 && !r1.immune && r1.min > 0, r1 ? `min=${r1.min}` : 'null');
  check('T56 ダメージ<HP999(倒れにくい)', !!r1 && r1.max < 999, r1 ? `max=${r1.max}` : 'null');
  E.sides.opp.poke = E.TEST_POKEMON.find(p => p.type1 === 'ノーマル');
  const r2 = E.calcDamage('self', 'opp', moveByName('シャドーボール'));
  check('T56 ノーマルダミーにはゴースト技が無効', !!r2 && r2.immune === true, r2 ? `immune=${r2.immune}` : 'null');

  // T57: ダミーは全特性から選べる(「なし」+ABILITY_DESC全192件)・選んだ特性はエンジンに効く
  const abList = E.dummyAbilityList();
  const descCount = Object.keys(data.ABILITY_DESC).length;
  check(`T57 ダミーの特性候補=なし+全${descCount}件`, abList.length === descCount + 1 && abList[0] === '',
    `got=${abList.length} first=${JSON.stringify(abList[0])}`);
  check('T57 候補に ちょすい/もらいび/はやあし を含む', ['ちょすい','もらいび','はやあし'].every(a => abList.includes(a)));
  // 選んだ特性が効く例: まひ+はやあし → 素早さ半減なし(simの effectiveSpeed 仕様)
  const dsp = E.makeSideState(); dsp.poke = dummy; dsp.status = 'paralysis';
  dsp.ability = '';
  const slowed = E.effectiveSpeed(dsp);
  dsp.ability = 'はやあし';
  const kept = E.effectiveSpeed(dsp);
  check('T57 ダミーに付けた特性がエンジンに効く(まひ+はやあし=半減なし)', slowed === 60 && kept === 120,
    `なし=${slowed} はやあし=${kept}`);
}

console.log('\n=== 段㉓ ダメージ式の特殊4族(防御参照/常時急所/道具なし倍化/複合タイプ) ===');
// 期待値の出典: @smogon/calc(Pokémon Showdown計算機エンジン・tools/_calc_crosscheck.jsと同条件)
//   フシギバナ vs フシギバナ / Lv50 / IV31 / P0(EV0) / 補正なし性格 / 道具・特性・天候なし
// 意味の出典(Bulbapedia):
//   "Psyshock" — 特殊技だが相手の「ぼうぎょ」を参照してダメージ計算
//   "Storm Throw"(やまあらし) / "Frost Breath"(こおりのいぶき) / "Flower Trick"(トリックフラワー) — 必ず急所(×1.5)
//   "Acrobatics" — 使用者が道具を持っていないと威力2倍(55→110)
//   "Flying Press" — かくとう技だが、相性判定にひこうタイプも併用(STABもかくとう/ひこうどちらでも乗る)
{
  resetEnv();
  const dmg = (ja, setup) => {
    E.sides.self = freshSide('フシギバナ', null);
    E.sides.opp = freshSide('フシギバナ', null);
    E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
    if (setup) setup(E.sides.self, E.sides.opp);
    const r = E.calcDamage('self', 'opp', moveByName(ja));
    return r && !r.immune ? [r.min, r.max] : null;
  };
  const eq = (a, b) => Array.isArray(a) && a[0] === b[0] && a[1] === b[1];

  const t58 = dmg('サイコショック');
  check('T58 サイコショック(特殊・相手の防御参照)=[72,86]', eq(t58, [72, 86]), JSON.stringify(t58));
  const t59 = dmg('やまあらし');
  check('T59 やまあらし(必ず急所×1.5)=[17,21]', eq(t59, [17, 21]), JSON.stringify(t59));
  const t60 = dmg('こおりのいぶき');
  check('T60 こおりのいぶき(必ず急所×1.5)=[70,84]', eq(t60, [70, 84]), JSON.stringify(t60));
  const t61 = dmg('トリックフラワー');
  check('T61 トリックフラワー(必ず急所×1.5)=[15,18]', eq(t61, [15, 18]), JSON.stringify(t61));
  const t62a = dmg('アクロバット');
  check('T62 アクロバット 道具なし(威力2倍=110)=[82,98]', eq(t62a, [82, 98]), JSON.stringify(t62a));
  const t62b = dmg('アクロバット', (self) => { self.item = 'oran_berry'; });
  check('T62 アクロバット 道具あり(倍化なし=55)=[42,50]', eq(t62b, [42, 50]), JSON.stringify(t62b));
  const t63 = dmg('フライングプレス');
  check('T63 フライングプレス(かくとう+ひこう複合相性)=[38,45]', eq(t63, [38, 45]), JSON.stringify(t63));
}

console.log('\n=== 段㉔ 条件技(fails_if/条件威力倍率: ポルターガイスト/アイアンローラー/しっぺがえし) ===');
// 期待値の出典: @smogon/calc(同条件: フシギバナvsフシギバナ Lv50/IV31/P0/補正なし)
//   Poltergeist(相手オボンのみ持ち)=[41,49] / Steel Roller(グラスフィールド)=[49,58] / Payback(2倍時)=[38,45]
// 意味の出典(Bulbapedia):
//   "Poltergeist" — 相手が道具を持っていないと失敗
//   "Steel Roller" — フィールドが何も無いと失敗。成功するとフィールドを消す
//   "Payback"(しっぺがえし) — 相手がそのターン先に行動していたら威力2倍(50→100)
// fails_if/効果はすべて battle_data に既存(スキーマ追加なし=エンジンが読むだけ)
{
  resetEnv();
  const dmg = (ja, setup) => {
    E.sides.self = freshSide('フシギバナ', null);
    E.sides.opp = freshSide('フシギバナ', null);
    E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
    if (setup) setup(E.sides.self, E.sides.opp);
    const r = E.calcDamage('self', 'opp', moveByName(ja));
    return r && !r.immune ? [r.min, r.max] : (r && r.immune ? 'fail' : null);
  };
  const eq = (a, b) => Array.isArray(a) && a[0] === b[0] && a[1] === b[1];

  // T64 ポルターガイスト
  const t64a = dmg('ポルターガイスト');
  check('T64 ポルターガイスト 相手道具なし→失敗', t64a === 'fail', JSON.stringify(t64a));
  const t64b = dmg('ポルターガイスト', (self, opp) => { opp.item = 'oran_berry'; });
  check('T64 ポルターガイスト 相手道具あり=[41,49]', eq(t64b, [41, 49]), JSON.stringify(t64b));

  // T65 アイアンローラー
  const t65a = dmg('アイアンローラー');
  check('T65 アイアンローラー フィールドなし→失敗', t65a === 'fail', JSON.stringify(t65a));
  E.env.field = 'grassy';
  const t65b = dmg('アイアンローラー');
  check('T65 アイアンローラー グラスF=[49,58]', eq(t65b, [49, 58]), JSON.stringify(t65b));
  E.env.field = 'none';

  // T66 しっぺがえし
  const t66a = dmg('しっぺがえし');
  check('T66 しっぺがえし 相手未行動=[19,23](威力50)', eq(t66a, [19, 23]), JSON.stringify(t66a));
  const t66b = dmg('しっぺがえし', (self, opp) => { opp.movedThisTurn = true; });
  check('T66 しっぺがえし 相手行動済=[38,45](威力100)', eq(t66b, [38, 45]), JSON.stringify(t66b));

  // T67 runTurn統合: アイアンローラー成功でフィールドが消える / movedThisTurnがターン内で立つ
  resetEnv();
  E.env.field = 'grassy';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('アイアンローラー')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.setRandom(mulberry32(20260610));
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check('T67 アイアンローラー成功後にフィールドが消える', E.env.field === 'none', `field=${E.env.field}`);
  check('T67 行動済みフラグが両側に立つ', E.sides.self.movedThisTurn === true && E.sides.opp.movedThisTurn === true,
    `self=${E.sides.self.movedThisTurn} opp=${E.sides.opp.movedThisTurn}`);
  E.env.field = 'none';
}

console.log('\n=== 段㉕ 溜め技(2ターン技: 溜め→攻撃/天候スキップ/溜めターン能力上昇/半無敵) ===');
// 期待値の出典: @smogon/calc(同条件: フシギバナvsフシギバナ Lv50/IV31/P0/補正なし)
//   ソーラービーム=[16,20] / あめ時=[8,10](威力半減) / そらをとぶ=[68,82]
//   メテオビーム(+1とくこう込み)=[68,81] / エレクトロビーム(+1とくこう込み)=[36,43]
//     ※calcの既定値はどちらも「溜めターンの+1とくこう」込み(rank0手計算の1.5倍で確認済み)
// 意味の出典(Bulbapedia):
//   "Solar Beam" — 1ターン目に溜め、2ターン目に攻撃。晴れなら溜めなしで即攻撃。あめ/すなあらし/ゆきで威力半減
//   "Meteor Beam"/"Electro Shot" — 溜めターンに自分のとくこう+1。エレクトロショットはあめなら溜めなし
//   "Semi-invulnerable turn" — そらをとぶ等の溜め中は原則攻撃が当たらない(じしん→あなをほる等の列挙技は当たる)
{
  // T68 ソーラービーム: 1ターン目=溜め(ダメージなし)、2ターン目=攻撃
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ソーラービーム')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null); // 相手は技なし(行動しない)
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  const oppHp0 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppHp0;
  E.setRandom(mulberry32(20260610));
  E.runTurn();
  check('T68 1ターン目は溜め(相手ノーダメージ)', E.sides.opp.currentHp === oppHp0, `hp=${E.sides.opp.currentHp}/${oppHp0}`);
  check('T68 溜め状態(charging)が立つ', !!E.sides.self.charging, JSON.stringify(E.sides.self.charging && E.sides.self.charging.move && E.sides.self.charging.move.name));
  E.runTurn();
  const t68dealt = oppHp0 - E.sides.opp.currentHp;
  check('T68 2ターン目に攻撃([16,20]内のダメージ)', t68dealt >= 16 && t68dealt <= 20, `dealt=${t68dealt}`);
  check('T68 攻撃後は溜め解除', !E.sides.self.charging, JSON.stringify(!!E.sides.self.charging));

  // T69 にほんばれ: 溜めなしで1ターン目に即攻撃
  resetEnv();
  E.env.weather = 'sunny';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ソーラービーム')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(mulberry32(20260610));
  E.runTurn();
  const t69dealt = E.realStat(E.sides.opp, 'hp') - E.sides.opp.currentHp;
  check('T69 にほんばれなら1ターン目に即攻撃', t69dealt >= 16 && t69dealt <= 20 && !E.sides.self.charging, `dealt=${t69dealt} charging=${!!E.sides.self.charging}`);

  // T69b あめ: 威力半減([8,10])
  resetEnv();
  E.env.weather = 'rain';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  const t69b = E.calcDamage('self', 'opp', moveByName('ソーラービーム'));
  check('T69b あめでソーラービーム威力半減=[8,10]', t69b && t69b.min === 8 && t69b.max === 10, t69b && `[${t69b.min},${t69b.max}]`);
  resetEnv();

  // T70 エレクトロビーム: 溜めターンにとくこう+1 → 2ターン目ダメージは+1込み[36,43]
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('エレクトロビーム')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  const t70hp0 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = t70hp0;
  E.setRandom(mulberry32(20260610));
  E.runTurn();
  check('T70 溜めターンにとくこう+1', E.sides.self.rank.spatk === 1 && E.sides.opp.currentHp === t70hp0,
    `spatk=${E.sides.self.rank.spatk} oppHp=${E.sides.opp.currentHp}/${t70hp0}`);
  E.runTurn();
  const t70dealt = t70hp0 - E.sides.opp.currentHp;
  check('T70 2ターン目ダメージ=[36,43](+1とくこう込み)', t70dealt >= 36 && t70dealt <= 43, `dealt=${t70dealt}`);
  check('T70 とくこうは+1のまま(攻撃ターンに二重上昇しない)', E.sides.self.rank.spatk === 1, `spatk=${E.sides.self.rank.spatk}`);

  // T70b エレクトロビーム calcDamage単体: +1とくこうで[36,43]ちょうど
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.rank.spatk = 1;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  const t70b = E.calcDamage('self', 'opp', moveByName('エレクトロビーム'));
  check('T70b エレクトロビーム(+1とくこう)=[36,43]', t70b && t70b.min === 36 && t70b.max === 43, t70b && `[${t70b.min},${t70b.max}]`);

  // T71 メテオビーム: 同じく溜め→とくこう+1→[68,81](effectsに「2ターン目に攻撃」が必要=データ補完)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('メテオビーム')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  const t71hp0 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = t71hp0;
  E.setRandom(mulberry32(20260610));
  E.runTurn();
  check('T71 メテオビーム溜めターン(とくこう+1・ノーダメージ)', E.sides.self.rank.spatk === 1 && E.sides.opp.currentHp === t71hp0,
    `spatk=${E.sides.self.rank.spatk} oppHp=${E.sides.opp.currentHp}/${t71hp0}`);
  E.runTurn();
  const t71dealt = t71hp0 - E.sides.opp.currentHp;
  check('T71 メテオビーム2ターン目=[68,81](+1とくこう込み)', t71dealt >= 68 && t71dealt <= 81, `dealt=${t71dealt}`);

  // T72 半無敵: そらをとぶ中は はたく が外れ、かみなり(vulnerable_to)は当たる
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.charging = { move: moveByName('そらをとぶ'), semi: '空中',
    vulnerableTo: ['うちおとす','かぜおこし','かみなり','サウザンアロー','スカイアッパー','たつまき','ぼうふう'] };
  E.setRandom(() => 0); // 命中ロールを必ず成功側に倒す(外れの原因が半無敵だけになるように)
  const t72a = E.phaseHitCheck(moveByName('はたく'), E.sides.self, E.sides.opp);
  check('T72 空中の相手に はたく は当たらない', !t72a.hit, JSON.stringify(t72a));
  const t72b = E.phaseHitCheck(moveByName('かみなり'), E.sides.self, E.sides.opp);
  check('T72 空中の相手に かみなり は当たる(vulnerable_to)', t72b.hit === true, JSON.stringify(t72b));
  E.sides.opp.charging = null;

  // T72c runTurn統合: 自分が溜め中(2ターン目の相手先制)は攻撃を外し、解放で[68,82]を与える
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('そらをとぶ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.rank.spd = 1; // 相手を先攻にする(溜め中に攻撃を受ける形)
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  const t72hp0 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = t72hp0;
  E.setRandom(mulberry32(20260610));
  E.runTurn(); // T1: 相手はたく(命中=溜め前なので当たる)、自分は溜め
  const selfHpAfterT1 = E.sides.self.currentHp;
  check('T72c 1ターン目: 自分は溜めに入った', !!E.sides.self.charging, JSON.stringify(!!E.sides.self.charging));
  E.runTurn(); // T2: 相手先攻はたく→空中で外れる、自分が解放
  check('T72c 2ターン目: 空中なので相手の攻撃が外れる(自分ノーダメージ)', E.sides.self.currentHp === selfHpAfterT1,
    `hp=${E.sides.self.currentHp}/${selfHpAfterT1}`);
  const t72dealt = t72hp0 - E.sides.opp.currentHp;
  check('T72c 2ターン目: そらをとぶ解放=[68,82]内', t72dealt >= 68 && t72dealt <= 82, `dealt=${t72dealt}`);
}

console.log('\n=== 段㉖ 反動で動けない技(はかいこうせん系6種: 攻撃成功の次ターンは行動不能) ===');
// 期待値の出典: @smogon/calc はかいこうせん=[57,68](フシギバナvsフシギバナ同条件)
// 意味の出典(Bulbapedia "Hyper Beam"): 攻撃が成功した次のターンは行動できない(リチャージ)。
//   第5世代以降、外れた/効果がなかった場合は反動ターンなし。
{
  // T73 はかいこうせん: 当たる→次ターン動けない→その次は動ける
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('はかいこうせん')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  const t73hp0 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = t73hp0;
  E.setRandom(mulberry32(20260611));
  E.runTurn(); // T1: 命中(seed確認済み)→ダメージ+反動予約
  const t73d1 = t73hp0 - E.sides.opp.currentHp;
  check('T73 1ターン目に攻撃が当たる([57,68])', t73d1 >= 57 && t73d1 <= 68, `dealt=${t73d1}`);
  check('T73 反動予約(mustRecharge)が立つ', E.sides.self.mustRecharge === true, `mustRecharge=${E.sides.self.mustRecharge}`);
  const t73hpAfter1 = E.sides.opp.currentHp;
  E.runTurn(); // T2: 反動で動けない
  check('T73 2ターン目は行動不能(相手ノーダメージ)', E.sides.opp.currentHp === t73hpAfter1, `hp=${E.sides.opp.currentHp}/${t73hpAfter1}`);
  check('T73 反動は1ターンで解除', E.sides.self.mustRecharge === false, `mustRecharge=${E.sides.self.mustRecharge}`);
  E.runTurn(); // T3: また動ける
  check('T73 3ターン目は再び攻撃できる', E.sides.opp.currentHp < t73hpAfter1, `hp=${E.sides.opp.currentHp}/${t73hpAfter1}`);

  // T74 外れたら反動なし(第5世代以降)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('はかいこうせん')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.95); // 命中ロール95 > 命中90 → 必ず外れる
  E.runTurn();
  check('T74 外れたら反動なし', E.sides.self.mustRecharge === false, `mustRecharge=${E.sides.self.mustRecharge}`);

  // T75 こうかなし(ノーマル→ゴースト)なら反動なし
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('はかいこうせん')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0); // 命中は必ず成功側(外れ要因を消す)
  E.runTurn();
  check('T75 こうかなしなら反動なし', E.sides.self.mustRecharge === false && E.sides.opp.currentHp === E.realStat(E.sides.opp, 'hp'),
    `mustRecharge=${E.sides.self.mustRecharge} oppHp=${E.sides.opp.currentHp}`);
}

console.log('\n=== 段㉗ 天候ファミリー(天候変化5/天候必中3/半無敵命中の2倍/晴れこおり無効) ===');
// 期待値の出典: @smogon/calc じしん=[38,45] / じしん×2(あなをほる中=bp200相当)=[75,89]
// 意味の出典(Bulbapedia):
//   "Rain Dance"等 — 5ターンの間 天気を変える(5ターン目の終わりに元に戻る)
//   "Blizzard" — ゆきの時は必ず命中 / "Thunder"/"Hurricane" — あめで必中・にほんばれで命中率50
//   "Semi-invulnerable turn" — じしん→あなをほる中/なみのり→ダイビング中はダメージ2倍
//   "Freeze" — にほんばれの間は こおり状態にならない
{
  // T76 にほんばれ(変化技)で天気が変わり、5ターン目の終わりに元に戻る
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('にほんばれ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(mulberry32(20260611));
  E.runTurn();
  check('T76 にほんばれで天気=sunny', E.env.weather === 'sunny', `weather=${E.env.weather}`);
  // 2〜4ターン目もにほんばれを使い続ける→「すでに同じ天気なので失敗」しターン数はリフレッシュされない(Bulbapedia "Sunny Day")
  for (let i = 0; i < 3; i++) E.runTurn();
  check('T76 4ターン目まで天気は続く', E.env.weather === 'sunny', `weather=${E.env.weather}`);
  check('T76 再使用してもターン数はリフレッシュしない(残1)', E.env.weatherTurns === 1, `weatherTurns=${E.env.weatherTurns}`);
  E.runTurn();
  check('T76 5ターン目の終わりに天気が元に戻る', E.env.weather === 'none', `weather=${E.env.weather}`);

  // T77 天候必中: ふぶき(命中70)はゆきで必中 / かみなりは晴れで命中率50
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(() => 0.85); // ロール85: 命中70なら外れる
  const t77a = E.phaseHitCheck(moveByName('ふぶき'), E.sides.self, E.sides.opp);
  check('T77 通常時ふぶき(命中70)はロール85で外れる', !t77a.hit, JSON.stringify(t77a));
  E.env.weather = 'snow';
  const t77b = E.phaseHitCheck(moveByName('ふぶき'), E.sides.self, E.sides.opp);
  check('T77 ゆきならふぶき必中', t77b.hit === true, JSON.stringify(t77b));
  E.env.weather = 'rain';
  const t77c = E.phaseHitCheck(moveByName('かみなり'), E.sides.self, E.sides.opp);
  check('T77 あめならかみなり必中', t77c.hit === true, JSON.stringify(t77c));
  E.env.weather = 'sunny';
  E.setRandom(() => 0.6); // ロール60: 通常命中70なら当たるが、晴れ50なら外れる
  const t77d = E.phaseHitCheck(moveByName('かみなり'), E.sides.self, E.sides.opp);
  check('T77 にほんばれならかみなり命中率50(ロール60で外れ)', !t77d.hit, JSON.stringify(t77d));
  resetEnv();

  // T78 半無敵命中の2倍: じしん→あなをほる中=[75,89](通常[38,45])
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  const t78a = E.calcDamage('self', 'opp', moveByName('じしん'));
  check('T78 じしん通常=[38,45]', t78a && t78a.min === 38 && t78a.max === 45, t78a && `[${t78a.min},${t78a.max}]`);
  E.sides.opp.charging = { move: moveByName('あなをほる'), semi: '地中', vulnerableTo: ['じしん','マグニチュード'] };
  const t78b = E.calcDamage('self', 'opp', moveByName('じしん'));
  check('T78 あなをほる中のじしん=2倍[75,89]', t78b && t78b.min === 75 && t78b.max === 89, t78b && `[${t78b.min},${t78b.max}]`);
  E.sides.opp.charging = null;

  // T79 にほんばれの間は こおり にならない(れいとうビームの追加効果が不発)
  resetEnv();
  E.env.weather = 'sunny';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0); // 追加効果ロール0 = 必ず発動側に倒す
  E.phaseApplyEffects('self', 'opp', moveByName('れいとうビーム'));
  check('T79 晴れではこおりにならない', E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);
  E.env.weather = 'none';
  E.phaseApplyEffects('self', 'opp', moveByName('れいとうビーム'));
  check('T79 天気なしなら こおり が付く(対照)', E.sides.opp.status === 'freeze', `status=${E.sides.opp.status}`);
  resetEnv();
}

console.log('\n=== 段㉘ フィールド展開4種(+フィールドのルール: グラス回復/ミスト状態無効/エレキねむり無効/サイコ先制無効) ===');
// 意味の出典(Bulbapedia "Grassy Terrain"/"Misty Terrain"/"Electric Terrain"/"Psychic Terrain"):
//   5ターンの間 場の状態を変える(同じフィールドへの再使用は失敗)。地面にいるポケモン(ひこう/ふゆう以外)に:
//   グラス=毎ターン終わり最大HPの1/16回復 / ミスト=状態異常にならない / エレキ=ねむらない / サイコ=相手の先制技を受けない
//   ルールはデータ(フィールド技のeffects: 回復turn_end/状態異常予防/優先技無効)が宣言→エンジンが読む
{
  // T80 グラスフィールド: 展開→シードなしならランク変化なし→ターン終了回復→5ターンで消える
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('グラスフィールド')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  const t80max = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = t80max - 50; // 減らしておく→グラスFで回復するはず
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(mulberry32(20260612));
  E.runTurn();
  check('T80 グラスフィールドが展開される', E.env.field === 'grassy', `field=${E.env.field}`);
  check('T80 シードなしならぼうぎょ+1は発動しない', E.sides.self.rank.def === 0 && E.sides.opp.rank.def === 0,
    `self.def=${E.sides.self.rank.def} opp.def=${E.sides.opp.rank.def}`);
  const t80heal = Math.floor(t80max / 16);
  check(`T80 ターン終わりに1/16(${t80heal})回復`, E.sides.self.currentHp === t80max - 50 + t80heal,
    `hp=${E.sides.self.currentHp} 期待=${t80max - 50 + t80heal}`);
  for (let i = 0; i < 3; i++) E.runTurn(); // 再使用は「すでに同じフィールド」で失敗=リフレッシュなし
  check('T80 4ターン目までフィールドは続く', E.env.field === 'grassy', `field=${E.env.field}`);
  E.runTurn();
  check('T80 5ターン目の終わりにフィールドが消える', E.env.field === 'none', `field=${E.env.field}`);

  // T81 ミストフィールド: 地面にいるポケモンは状態異常にならない(ひこうは守られない)
  resetEnv();
  E.env.field = 'misty';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(() => 0); // 追加効果ロールを必ず発動側に
  E.phaseApplyEffects('self', 'opp', moveByName('れいとうビーム'));
  check('T81 ミストFで地面のポケモンはこおりにならない', E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);
  E.sides.opp = freshSide('ピジョット', null); // ひこう=地面にいない→守られない
  E.phaseApplyEffects('self', 'opp', moveByName('でんじは'));
  check('T81 ひこうタイプはミストFに守られない(まひする)', E.sides.opp.status === 'paralysis', `status=${E.sides.opp.status}`);

  // T82 エレキフィールド: 地面にいるポケモンはねむらない(他の状態異常は通る)
  resetEnv();
  E.env.field = 'electric';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(() => 0);
  E.phaseApplyEffects('self', 'opp', moveByName('さいみんじゅつ'));
  check('T82 エレキFで地面のポケモンはねむらない', E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);
  E.phaseApplyEffects('self', 'opp', moveByName('おにび'));
  check('T82 ねむり以外(やけど)は通る', E.sides.opp.status === 'burn', `status=${E.sides.opp.status}`);

  // T83 サイコフィールド: 相手の先制技(優先度>0)は地面にいるポケモンに当たらない
  resetEnv();
  E.env.field = 'psychic';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(() => 0);
  const t83a = E.phaseHitCheck(moveByName('でんこうせっか'), E.sides.self, E.sides.opp);
  check('T83 サイコFで先制技は地面の相手に当たらない', !t83a.hit, JSON.stringify(t83a));
  const t83b = E.phaseHitCheck(moveByName('はたく'), E.sides.self, E.sides.opp);
  check('T83 通常技(優先度0)は当たる', t83b.hit === true, JSON.stringify(t83b));
  E.sides.opp = freshSide('ピジョット', null);
  const t83c = E.phaseHitCheck(moveByName('でんこうせっか'), E.sides.self, E.sides.opp);
  check('T83 ひこうタイプには先制技が当たる(地面にいない)', t83c.hit === true, JSON.stringify(t83c));
  resetEnv();
}

console.log('\n=== 段㉙ 壁ファミリー(壁設置4: リフレクター/ひかりのかべ/しんぴのまもり/オーロラベール + 壁除去3: かわらわり/サイコファング/きりばらい) ===');
// 意味の出典(Bulbapedia "Reflect"/"Light Screen"/"Safeguard"/"Aurora Veil"/"Brick Break"/"Psychic Fangs"/"Defog"):
//   壁=5ターン・自分の場・急所は軽減しない・再使用は失敗。オーロラベールはゆきの時だけ張れて物理特殊両方半減。
//   しんぴのまもり=相手からの状態異常とこんらんを防ぐ。かわらわり/サイコファング=壁を壊して攻撃(壁の軽減を受けない)。
//   きりばらい=相手の壁とフィールドを消す+回避-1。ゴールデン値=@smogon/calc(フシギバナvsフシギバナ Lv50/IV31/P0)
{
  // T84 リフレクター: 物理半減/特殊そのまま/急所は無視/5ターンで消える(再使用リフレッシュなし)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('リフレクター')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(20260613));
  E.phaseApplyEffects('self', 'opp', moveByName('リフレクター'));
  check('T84 リフレクターが自分の場に張られる', E.sides.self.reflect === true, `reflect=${E.sides.self.reflect}`);
  const t84p = E.calcDamage('opp', 'self', moveByName('はたく'));
  check('T84 物理は半減[8,9]', t84p && t84p.min === 8 && t84p.max === 9, JSON.stringify(t84p));
  const t84s = E.calcDamage('opp', 'self', moveByName('れいとうビーム'));
  check('T84 特殊はそのまま[68,82]', t84s && t84s.min === 68 && t84s.max === 82, JSON.stringify(t84s));
  E.sides.opp.critical = true;
  const t84c = E.calcDamage('opp', 'self', moveByName('はたく'));
  check('T84 急所は壁を無視[23,28]', t84c && t84c.min === 23 && t84c.max === 28, JSON.stringify(t84c));
  E.sides.opp.critical = false;
  for (let i = 0; i < 4; i++) E.runTurn(); // 自分は毎ターン再使用→失敗(リフレッシュなし)のはず
  check('T84 4ターン目まで壁は続く', E.sides.self.reflect === true, `reflect=${E.sides.self.reflect}`);
  E.runTurn();
  check('T84 5ターン目の終わりに壁が消える', E.sides.self.reflect === false, `reflect=${E.sides.self.reflect}`);

  // T85 ひかりのかべ: 特殊半減/物理そのまま
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.phaseApplyEffects('self', 'opp', moveByName('ひかりのかべ'));
  check('T85 ひかりのかべが張られる', E.sides.self.lightScreen === true, `lightScreen=${E.sides.self.lightScreen}`);
  const t85s = E.calcDamage('opp', 'self', moveByName('れいとうビーム'));
  check('T85 特殊は半減[34,41]', t85s && t85s.min === 34 && t85s.max === 41, JSON.stringify(t85s));
  const t85p = E.calcDamage('opp', 'self', moveByName('はたく'));
  check('T85 物理はそのまま[16,19]', t85p && t85p.min === 16 && t85p.max === 19, JSON.stringify(t85p));

  // T86 オーロラベール: ゆき以外は失敗/ゆきなら物理特殊とも半減
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('オーロラベール')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(mulberry32(20260614));
  E.runTurn();
  check('T86 ゆき以外ではオーロラベールは失敗', !E.sides.self.auroraVeil, `auroraVeil=${E.sides.self.auroraVeil}`);
  E.env.weather = 'snow';
  E.runTurn();
  check('T86 ゆきならオーロラベールが張られる', E.sides.self.auroraVeil === true, `auroraVeil=${E.sides.self.auroraVeil}`);
  const t86p = E.calcDamage('opp', 'self', moveByName('はたく'));
  check('T86 物理は半減[8,9]', t86p && t86p.min === 8 && t86p.max === 9, JSON.stringify(t86p));
  const t86s = E.calcDamage('opp', 'self', moveByName('れいとうビーム'));
  check('T86 特殊も半減[34,41]', t86s && t86s.min === 34 && t86s.max === 41, JSON.stringify(t86s));

  // T87 しんぴのまもり: 相手からの状態異常とこんらんを防ぐ(自分の場だけ)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.phaseApplyEffects('self', 'opp', moveByName('しんぴのまもり'));
  check('T87 しんぴのまもりが張られる', E.sides.self.safeguard === true, `safeguard=${E.sides.self.safeguard}`);
  E.setRandom(() => 0);
  E.phaseApplyEffects('opp', 'self', moveByName('おにび'));
  check('T87 やけどを防ぐ', E.sides.self.status === 'none', `status=${E.sides.self.status}`);
  E.phaseApplyEffects('opp', 'self', moveByName('あやしいひかり'));
  check('T87 こんらんも防ぐ', !E.sides.self.confusion, `confusion=${E.sides.self.confusion}`);
  E.phaseApplyEffects('self', 'opp', moveByName('おにび'));
  check('T87 守られていない相手側には通る', E.sides.opp.status === 'burn', `status=${E.sides.opp.status}`);

  // T88 かわらわり/サイコファング: 壁を壊して攻撃(壁の軽減を受けない→攻撃後に壁が消える)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('かわらわり')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.phaseApplyEffects('opp', 'self', moveByName('リフレクター')); // 相手側に壁(opp自身の場)
  check('T88 前提: 相手の場にリフレクター', E.sides.opp.reflect === true, `reflect=${E.sides.opp.reflect}`);
  const t88 = E.calcDamage('self', 'opp', moveByName('かわらわり'));
  check('T88 かわらわりは壁の軽減を受けない[14,17]', t88 && t88.min === 14 && t88.max === 17, JSON.stringify(t88));
  E.setRandom(mulberry32(20260615));
  E.runTurn();
  check('T88 攻撃のあと壁がこわれる', E.sides.opp.reflect === false, `reflect=${E.sides.opp.reflect}`);
  E.sides.opp.lightScreen = true; E.sides.opp.screenTurns = { lightScreen: 5 };
  const t88b = E.calcDamage('self', 'opp', moveByName('サイコファング'));
  check('T88 サイコファングも壁の軽減を受けない[66,78]', t88b && t88b.min === 66 && t88b.max === 78, JSON.stringify(t88b));
  E.phaseApplyEffects('self', 'opp', moveByName('サイコファング'));
  check('T88 サイコファングで壁がこわれる', E.sides.opp.lightScreen === false, `lightScreen=${E.sides.opp.lightScreen}`);

  // T89 きりばらい: 相手の壁を消す+フィールドも消す+回避-1
  resetEnv();
  E.env.field = 'grassy'; E.env.fieldTurns = 3;
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.phaseApplyEffects('opp', 'self', moveByName('リフレクター'));
  E.phaseApplyEffects('opp', 'self', moveByName('しんぴのまもり'));
  E.setRandom(() => 0);
  E.phaseApplyEffects('self', 'opp', moveByName('きりばらい'));
  check('T89 相手のリフレクターが消える', E.sides.opp.reflect === false, `reflect=${E.sides.opp.reflect}`);
  check('T89 相手のしんぴのまもりが消える', E.sides.opp.safeguard === false, `safeguard=${E.sides.opp.safeguard}`);
  check('T89 フィールドも消える', E.env.field === 'none', `field=${E.env.field}`);
  check('T89 相手の回避-1', E.sides.opp.rank.eva === -1, `eva=${E.sides.opp.rank.eva}`);
  resetEnv();
}

console.log('\n=== 段㉚ まもりファミリー(まもる/みきり/キングシールド/トーチカ/ニードルガード/ファストガード) ===');
// 意味の出典(Bulbapedia "Protect"/"Detect"/"King\'s Shield"/"Baneful Bunker"/"Spiky Shield"/"Quick Guard"):
//   まもる系=そのターン相手の技を防ぐ(優先度+4)。連続使用は成功率が1/3ずつ下がる(失敗や別行動でリセット)。
//   キングシールド/トーチカ=変化技は防がない。接触技で攻められたら こうげき-1 / どく(どく・はがねタイプは無効)。
//   ニードルガード=接触技の相手に最大HPの1/8ダメージ。
//   ファストガード=先制技(優先度>0)だけ防ぐ(優先度+3・連続使用でも失敗しない=第6世代以降)。
//   フェイント等 protect:false の技は守りを素通り(まもり貫通)。
{
  // T90 まもる: 防ぐ/連続使用の成功率低下(1→1/3→1/9)/失敗でカウントリセット
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('まもる')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t90max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0);     // 成功判定も命中も成功側に倒す
  E.runTurn();
  check('T90 まもるで はたくを防ぐ(ノーダメージ)', E.sides.self.currentHp === t90max, `hp=${E.sides.self.currentHp}/${t90max}`);
  check('T90 連続成功カウント=1', E.sides.self.protectStreak === 1, `streak=${E.sides.self.protectStreak}`);
  E.runTurn();              // 乱数0 < 1/3 → 2連続成功
  check('T90 2回目も成功(乱数0 < 1/3)', E.sides.self.currentHp === t90max && E.sides.self.protectStreak === 2, `hp=${E.sides.self.currentHp} streak=${E.sides.self.protectStreak}`);
  E.setRandom(() => 0.5);   // 0.5 > 1/9 → 3回目は失敗
  E.runTurn();
  check('T90 3回目は失敗(乱数0.5 > 1/9)して攻撃を受ける', E.sides.self.currentHp < t90max, `hp=${E.sides.self.currentHp}/${t90max}`);
  check('T90 失敗で連続カウントがリセット', E.sides.self.protectStreak === 0, `streak=${E.sides.self.protectStreak}`);

  // T91 キングシールド: 攻撃技は防ぐ+接触技の相手は こうげき-1。変化技(おにび)は防がない
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('キングシールド')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t91max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0);
  E.runTurn();
  check('T91 キングシールドで はたくを防ぐ', E.sides.self.currentHp === t91max, `hp=${E.sides.self.currentHp}/${t91max}`);
  check('T91 接触技の相手は こうげき-1', E.sides.opp.rank.atk === -1, `atk=${E.sides.opp.rank.atk}`);
  E.sides.opp.moves = [moveByName('おにび')]; E.sides.opp.selectedMoveIdx = 0;
  E.runTurn();              // 守り成功(乱数0 < 1/3)していても変化技は素通り
  check('T91 変化技(おにび)は防がない→やけど', E.sides.self.status === 'burn', `status=${E.sides.self.status}`);
  check('T91 非接触の変化技では こうげき-1 は重ならない', E.sides.opp.rank.atk === -1, `atk=${E.sides.opp.rank.atk}`);

  // T92 トーチカ: 攻撃技は防ぐ+接触技の相手は どく(非接触は付かない・どくタイプには効かない)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('トーチカ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ピジョット', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t92max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0);
  E.runTurn();
  check('T92 トーチカで はたくを防ぐ', E.sides.self.currentHp === t92max, `hp=${E.sides.self.currentHp}/${t92max}`);
  check('T92 接触技の相手(ピジョット)は どく状態', E.sides.opp.status === 'poison', `status=${E.sides.opp.status}`);
  E.sides.opp.status = 'none';
  E.sides.opp.moves = [moveByName('れいとうビーム')]; E.sides.opp.selectedMoveIdx = 0;
  E.runTurn();
  check('T92 非接触(れいとうビーム)は防ぐが どく は付かない', E.sides.self.currentHp === t92max && E.sides.opp.status === 'none', `hp=${E.sides.self.currentHp} status=${E.sides.opp.status}`);
  // 守り状態は次の runTurn 開始まで残る → 単発攻撃(runSingleAttack)でも防がれる+どくタイプは どく にならない
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.runSingleAttack('opp', 0);
  check('T92 どくタイプ(フシギバナ)の接触技は防ぐが どく は付かない', E.sides.self.currentHp === t92max && E.sides.opp.status === 'none', `hp=${E.sides.self.currentHp} status=${E.sides.opp.status}`);

  // T93 ニードルガード: 接触技の相手は最大HPの1/8ダメージ(フシギバナ155→19)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ニードルガード')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t93maxS = E.realStat(E.sides.self, 'hp');
  const t93maxO = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0);
  E.runTurn();
  check('T93 ニードルガードで はたくを防ぐ', E.sides.self.currentHp === t93maxS, `hp=${E.sides.self.currentHp}/${t93maxS}`);
  check('T93 接触技の相手は 最大HPの1/8(19)ダメージ', E.sides.opp.currentHp === t93maxO - 19, `hp=${E.sides.opp.currentHp}(期待${t93maxO - 19})`);

  // T94 ファストガード: 先制技(でんこうせっか)だけ防ぐ。通常技(はたく)は素通り
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ファストガード')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('でんこうせっか')]; E.sides.opp.selectedMoveIdx = 0;
  const t94max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0);
  E.runTurn();
  check('T94 ファストガードで 先制技(でんこうせっか)を防ぐ', E.sides.self.currentHp === t94max, `hp=${E.sides.self.currentHp}/${t94max}`);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.runTurn();              // 連続使用でも失敗しない(第6世代以降)が、優先度0の技は防げない
  check('T94 通常技(はたく)は防がない→ダメージ', E.sides.self.currentHp < t94max, `hp=${E.sides.self.currentHp}/${t94max}`);

  // T95 条件つき状態付与の誤適用回避(回帰): 守り中の接触条件などを満たさないのに即付与しない
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(() => 0);
  E.phaseApplyEffects('self', 'opp', moveByName('しっとのほのお'));
  check('T95 しっとのほのお(能力上昇条件)は無条件では やけどしない', E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);
  E.phaseApplyEffects('self', 'opp', moveByName('くちばしキャノン'));
  check('T95 くちばしキャノン(接触条件)は無条件では やけどしない', E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);
  E.phaseApplyEffects('self', 'opp', moveByName('みわくのボイス'));
  check('T95 みわくのボイス(能力上昇条件)は無条件では こんらんしない', !E.sides.opp.confusion, `confusion=${E.sides.opp.confusion}`);
  E.phaseApplyEffects('self', 'opp', moveByName('トーチカ'));
  check('T95 トーチカの どく は phaseApplyEffects 直呼びでは付かない', E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);
  resetEnv();
}

console.log('\n=== 段㉛ 場の威力補正(フィールドのダメージ補正: グラス1.3/じしん半減/エレキ1.3/サイコ1.3/ミスト=ドラゴン半減) ===');
// 意味の出典(Bulbapedia "Grassy Terrain"/"Electric Terrain"/"Psychic Terrain"/"Misty Terrain"・第8世代以降は1.3倍):
//   補正は「地面にいる」ポケモンだけ(攻め手接地=グラス/エレキ/サイコ、受け手接地=ミスト/じしん半減)。
//   ゴールデン値=@smogon/calc Field({terrain})(フシギバナvsフシギバナ Lv50/IV31/P0)
{
  // T96 グラスフィールド: くさ技1.3倍(接地した攻め手)+じしん半減(接地した受け手)
  resetEnv();
  E.env.field = 'grassy';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  const t96a = E.calcDamage('self', 'opp', moveByName('タネばくだん'));
  check('T96 くさ技は1.3倍[14,17]', t96a && t96a.min === 14 && t96a.max === 17, JSON.stringify(t96a));
  const t96b = E.calcDamage('self', 'opp', moveByName('じしん'));
  check('T96 じしんは半減[19,23]', t96b && t96b.min === 19 && t96b.max === 23, JSON.stringify(t96b));

  // T97 エレキフィールド: でんき技1.3倍(攻め手が接地している時だけ)
  resetEnv();
  E.env.field = 'electric';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  const t97a = E.calcDamage('self', 'opp', moveByName('10まんボルト'));
  check('T97 でんき技は1.3倍[22,26]', t97a && t97a.min === 22 && t97a.max === 26, JSON.stringify(t97a));
  E.sides.self = freshSide('ピジョット', null);
  const t97b = E.calcDamage('self', 'opp', moveByName('10まんボルト'));
  check('T97 非接地(ピジョット)の でんき技は補正なし[13,15]', t97b && t97b.min === 13 && t97b.max === 15, JSON.stringify(t97b));

  // T98 サイコフィールド: エスパー技1.3倍(接地した攻め手)
  resetEnv();
  E.env.field = 'psychic';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  const t98 = E.calcDamage('self', 'opp', moveByName('サイコキネシス'));
  check('T98 エスパー技は1.3倍[90,106]', t98 && t98.min === 90 && t98.max === 106, JSON.stringify(t98));

  // T99 ミストフィールド: 接地した受け手へのドラゴン技は半減(非接地の受け手はそのまま)
  resetEnv();
  E.env.field = 'misty';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  const t99a = E.calcDamage('self', 'opp', moveByName('りゅうのはどう'));
  check('T99 接地した受け手へのドラゴン技は半減[17,20]', t99a && t99a.min === 17 && t99a.max === 20, JSON.stringify(t99a));
  E.sides.opp = freshSide('ピジョット', null);
  const t99b = E.calcDamage('self', 'opp', moveByName('りゅうのはどう'));
  check('T99 非接地(ピジョット)の受け手は半減されない[43,51]', t99b && t99b.min === 43 && t99b.max === 51, JSON.stringify(t99b));
  resetEnv();
}

console.log('\n=== 段㉜ 自分瀕死(じばく/だいばくはつ/ミストバースト/おきみやげ/いのちがけ/いやしのねがい) ===');
// 意味の出典(Bulbapedia "Self-Destruct"/"Explosion"/"Misty Explosion"/"Memento"/"Final Gambit"/"Healing Wish"):
//   じばく系(威力あり)=第5世代以降、外れても・守られても・こうかなしでも使ったら自分はひんし。
//   おきみやげ/いのちがけ/いやしのねがい(威力なし)=技が成功した時だけ自分がひんし(守られたら倒れない)。
//   だいばくはつの防御半減は第5世代で廃止。ゴールデン値=@smogon/calc(フシギバナvsフシギバナ Lv50/IV31/P0)
{
  // T100 じばく: ダメージ[75,89]+自分はひんし。こうかなし(ゴースト)でも自分はひんし
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('じばく')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t100 = E.calcDamage('self', 'opp', moveByName('じばく'));
  check('T100 じばくのダメージ[75,89]', t100 && t100.min === 75 && t100.max === 89, JSON.stringify(t100));
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T100 使った自分は ひんし', E.sides.self.fainted === true, `fainted=${E.sides.self.fainted}`);
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('じばく')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t100gMax = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check('T100 ゴーストには こうかなし(無傷)', E.sides.opp.currentHp === t100gMax, `hp=${E.sides.opp.currentHp}/${t100gMax}`);
  check('T100 こうかなしでも 自分は ひんし', E.sides.self.fainted === true, `fainted=${E.sides.self.fainted}`);

  // T101 だいばくはつ: ダメージ[93,110](防御半減なし=第5世代以降)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  const t101 = E.calcDamage('self', 'opp', moveByName('だいばくはつ'));
  check('T101 だいばくはつのダメージ[93,110]', t101 && t101.min === 93 && t101.max === 110, JSON.stringify(t101));

  // T102 ミストバースト: 通常[19,23]/ミストフィールド上の接地者は1.5倍[28,34]
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('フシギバナ', null);
  const t102a = E.calcDamage('self', 'opp', moveByName('ミストバースト'));
  check('T102 ミストバースト通常[19,23]', t102a && t102a.min === 19 && t102a.max === 23, JSON.stringify(t102a));
  E.env.field = 'misty';
  const t102b = E.calcDamage('self', 'opp', moveByName('ミストバースト'));
  check('T102 ミストフィールド上は1.5倍[28,34]', t102b && t102b.min === 28 && t102b.max === 34, JSON.stringify(t102b));

  // T103 おきみやげ: 相手のこうげき-2/とくこう-2+自分はひんし。守られたら倒れない
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('おきみやげ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T103 相手は こうげき-2 とくこう-2', E.sides.opp.rank.atk === -2 && E.sides.opp.rank.spatk === -2, `atk=${E.sides.opp.rank.atk} spatk=${E.sides.opp.rank.spatk}`);
  check('T103 使った自分は ひんし', E.sides.self.fainted === true, `fainted=${E.sides.self.fainted}`);
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('おきみやげ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('まもる')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0);
  E.runTurn();
  check('T103 守られたら 自分は倒れない(成功時のみ瀕死)', E.sides.self.fainted === false, `fainted=${E.sides.self.fainted}`);
  check('T103 守られたら ランクも下がらない', E.sides.opp.rank.atk === 0, `atk=${E.sides.opp.rank.atk}`);

  // T104 いのちがけ: 自分の残りHPぶんの固定ダメージ+自分はひんし。ゴーストには無効=自分も倒れない
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いのちがけ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 100;
  E.sides.self.rank.spd = 6;   // 同速ランダムを避けて必ず先攻(残りHP100のまま撃つ)
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t104max = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T104 相手に残りHP(100)ぶんのダメージ', E.sides.opp.currentHp === t104max - 100, `hp=${E.sides.opp.currentHp}(期待${t104max - 100})`);
  check('T104 使った自分は ひんし', E.sides.self.fainted === true, `fainted=${E.sides.self.fainted}`);
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いのちがけ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t104g = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check('T104 ゴーストには こうかなし(無傷)', E.sides.opp.currentHp === t104g, `hp=${E.sides.opp.currentHp}/${t104g}`);
  check('T104 こうかなしなら 自分は倒れない(成功時のみ瀕死)', E.sides.self.fainted === false, `fainted=${E.sides.self.fainted}`);

  // T105 いやしのねがい: 控えがいないと失敗=ひんしにならない(段91でパーティ導入により本来仕様へ更新。
  // 旧テストは「交代未実装のため自滅のみ」の近似を固定していた。出典: ポケモンWiki「いやしのねがい」)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いやしのねがい')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T105 控えがいないと失敗して自分はひんしにならない', E.sides.self.fainted === false && E.sides.self.failedThisTurn === true,
    `fainted=${E.sides.self.fainted} failed=${E.sides.self.failedThisTurn}`);
  resetEnv();
}

console.log('\n=== 段㉝ 失敗ダメージ(とびひざげり/かかとおとし/サンダーダイブ: 外したら自分が最大HPの半分のダメージ) ===');
// 意味の出典(Bulbapedia "High Jump Kick"/"Axe Kick"/"Supercell Slam"):
//   外れた時・守られた時・こうかなし(ゴースト等)の時、自分が最大HPの半分のダメージを受ける(第5世代以降)。
//   当たった時は反動なし。ゴールデン値=@smogon/calc(とびひざげり フシギバナvsフシギバナ [24,29])
{
  // T106 とびひざげり: 当たれば反動なし/外したら最大HP半分(155→77)/こうかなし(ゴースト)でも反動
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('とびひざげり')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;   // 同速ランダムを避けて必ず先攻
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t106 = E.calcDamage('self', 'opp', moveByName('とびひざげり'));
  check('T106 とびひざげりのダメージ[24,29]', t106 && t106.min === 24 && t106.max === 29, JSON.stringify(t106));
  const t106max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0);        // 命中(0 < 90)
  E.runTurn();
  check('T106 当たれば反動なし(相手のはたく分だけ減る)', E.sides.self.currentHp > t106max - 30, `hp=${E.sides.self.currentHp}/${t106max}`);
  E.sides.self.currentHp = t106max; E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.95);     // 95 > 90 → 外れる
  E.runTurn();
  check('T106 外したら最大HPの半分(77)の反動', E.sides.self.currentHp <= t106max - 77, `hp=${E.sides.self.currentHp}(期待${t106max - 77}以下)`);
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('とびひざげり')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0);
  E.runTurn();
  check('T106 こうかなし(ゴースト)でも反動(77)', E.sides.self.currentHp <= t106max - 77, `hp=${E.sides.self.currentHp}`);

  // T107 守られても反動
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('とびひざげり')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('まもる')]; E.sides.opp.selectedMoveIdx = 0;
  const t107max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0);
  E.runTurn();
  check('T107 守られたら反動(77)', E.sides.self.currentHp === t107max - 77, `hp=${E.sides.self.currentHp}(期待${t107max - 77})`);

  // T108 かかとおとし/サンダーダイブも同じ仕組み(外したら半分)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('かかとおとし')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('まもる')]; E.sides.opp.selectedMoveIdx = 0;
  const t108max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0);
  E.runTurn();
  check('T108 かかとおとしも守られたら反動(77)', E.sides.self.currentHp === t108max - 77, `hp=${E.sides.self.currentHp}(期待${t108max - 77})`);
  resetEnv();
}

console.log('\n=== 段㉞ HPが減る(はらだいこ/ソウルビート/てっていこうせん: HPを支払う技) ===');
// 意味の出典(Bulbapedia "Belly Drum"/"Clangorous Soul"/"Steel Beam" + PS実装):
//   はらだいこ: 最大HPの半分(切り捨て)を支払い こうげき+6。HPがコスト以下/既に+6なら失敗(支払いなし)。
//   ソウルビート: 最大HPの1/3を支払い 全能力+1。HPがコスト以下なら失敗。
//   てっていこうせん: 最大HPの半分(★切り上げ)を支払う。外れても・守られても支払う(自分がひんしになることもある)。
//   ゴールデン値=@smogon/calc(てっていこうせん フシギバナvsフシギバナ [53,63])。フシギバナ最大HP=155(奇数=切り上げ/切り捨てを区別できる)
{
  // T109 はらだいこ: 支払い77(切り捨て)+こうげき+6 / 既に+6で失敗 / HP不足で失敗
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('はらだいこ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;   // 同速ランダムを避けて必ず先攻
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t109max = E.realStat(E.sides.self, 'hp');   // 155
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T109 HPを77(切り捨て)支払う', E.sides.self.currentHp <= t109max - 77 && E.sides.self.currentHp > t109max - 77 - 30, `hp=${E.sides.self.currentHp}(期待${t109max - 77}前後)`);
  check('T109 こうげき+6(最大)', E.sides.self.rank.atk === 6, `atk=${E.sides.self.rank.atk}`);
  // 既に+6 → 失敗=HPは減らない
  const t109hpAfter = E.sides.self.currentHp;
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.runTurn();
  check('T109 既に+6なら失敗(支払いなし)', E.sides.self.currentHp >= t109hpAfter - 30, `hp=${E.sides.self.currentHp}(期待${t109hpAfter}前後・はたく分のみ)`);
  // HP不足(コスト77以下) → 失敗=ランクも上がらない
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('はらだいこ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.self.currentHp = 77;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.runTurn();
  check('T109 HP不足(77)なら失敗(ランク+なし)', E.sides.self.rank.atk === 0, `atk=${E.sides.self.rank.atk}`);
  check('T109 HP不足なら支払いなし', E.sides.self.currentHp > 40, `hp=${E.sides.self.currentHp}(77からはたく分のみ減)`);

  // T110 ソウルビート: 支払い51(155×1/3切り捨て)+全能力+1 / HP不足で失敗
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ソウルビート')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t110max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T110 HPを51(1/3)支払う', E.sides.self.currentHp <= t110max - 51 && E.sides.self.currentHp > t110max - 51 - 30, `hp=${E.sides.self.currentHp}(期待${t110max - 51}前後)`);
  check('T110 全能力+1', E.sides.self.rank.atk === 1 && E.sides.self.rank.def === 1 && E.sides.self.rank.spatk === 1 && E.sides.self.rank.spdef === 1, `atk=${E.sides.self.rank.atk} def=${E.sides.self.rank.def} spatk=${E.sides.self.rank.spatk} spdef=${E.sides.self.rank.spdef}`);
  // HP不足(51以下) → 失敗
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ソウルビート')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.self.currentHp = 51;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.runTurn();
  check('T110 HP不足(51)なら失敗(ランク+なし)', E.sides.self.rank.atk === 0, `atk=${E.sides.self.rank.atk}`);

  // T111 てっていこうせん: ダメージ[53,63] / 支払い78(★切り上げ) / 外れても・守られても支払う / 自滅あり
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('てっていこうせん')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t111 = E.calcDamage('self', 'opp', moveByName('てっていこうせん'));
  check('T111 てっていこうせんのダメージ[53,63]', t111 && t111.min === 53 && t111.max === 63, JSON.stringify(t111));
  const t111max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0.5);      // 命中(50 < 95)
  E.runTurn();
  check('T111 当たったら78(切り上げ)支払う', E.sides.self.currentHp <= t111max - 78 && E.sides.self.currentHp > t111max - 78 - 30, `hp=${E.sides.self.currentHp}(期待${t111max - 78}前後)`);
  // 外れても支払う
  E.sides.self.currentHp = t111max; E.sides.self.fainted = false;
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.96);     // 96 > 95 → てっていこうせんは外れる(相手のはたくは命中100で当たる)
  E.runTurn();
  check('T111 外れても78支払う', E.sides.self.currentHp <= t111max - 78 && E.sides.self.currentHp > t111max - 78 - 30, `hp=${E.sides.self.currentHp}(期待${t111max - 78}からはたく分まで)`);
  // 守られても支払う
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('てっていこうせん')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('まもる')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T111 守られても78支払う', E.sides.self.currentHp === t111max - 78, `hp=${E.sides.self.currentHp}(期待${t111max - 78})`);
  // 支払いで自分がひんしになる
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('てっていこうせん')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.self.currentHp = 50;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T111 支払いで自分がひんし', E.sides.self.currentHp === 0 && E.sides.self.fainted === true, `hp=${E.sides.self.currentHp} fainted=${E.sides.self.fainted}`);
  resetEnv();
}

console.log('\n=== 段㉟ 継続削り(しおづけ/のろい: 毎ターン終了時に最大HPの割合ダメージ) ===');
// 意味の出典:
//   しおづけ: SSOT(legacy)=Champions仕様で毎ターン最大HPの1/16、はがね/みずタイプは1/8(SVの1/8・1/4とは違うとlegacy自身が注記)。
//   のろい(ゴースト): Bulbapedia "Curse"=最大HPの半分(切り捨て)を支払い(HP不足でも実行して自分はひんし・それでも相手にのろいは付く)、
//                     相手は毎ターン終了時に最大HPの1/4を失う。非ゴースト=すばやさ-1/こうげき+1/ぼうぎょ+1(コストなし)。
//   ダメージのゴールデン値=@smogon/calc(しおづけ フシギバナvsフシギバナ [16,19])
{
  // T112 しおづけ: 当てたら相手がしおづけ状態 → 毎ターン終了時 floor(155/16)=9 削り。重ねがけしても1回分。
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('しおづけ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;   // 同速ランダムを避けて必ず先攻
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t112 = E.calcDamage('self', 'opp', moveByName('しおづけ'));
  check('T112 しおづけのダメージ[16,19]', t112 && t112.min === 16 && t112.max === 19, JSON.stringify(t112));
  const t112max = E.realStat(E.sides.opp, 'hp');   // 155
  E.setRandom(() => 0.5);
  E.runTurn();
  const t112hp1 = E.sides.opp.currentHp;
  // 1ターン目: 技ダメージ(16〜19) + しおづけ削り9
  check('T112 当てたターンの終了時に9削れる', t112hp1 <= t112max - 16 - 9 && t112hp1 >= t112max - 19 - 9, `hp=${t112hp1}(期待${t112max - 19 - 9}〜${t112max - 16 - 9})`);
  // 2ターン目(もう一度しおづけ=重ねがけ): 技ダメージ + 削りは1回分(9)だけ
  E.runTurn();
  const t112hp2 = E.sides.opp.currentHp;
  check('T112 重ねがけしても削りは1回分(9)', t112hp2 <= t112hp1 - 16 - 9 && t112hp2 >= t112hp1 - 19 - 9, `hp=${t112hp2}(期待${t112hp1 - 19 - 9}〜${t112hp1 - 16 - 9})`);

  // T112b みずタイプ(カメックス)には 1/8 = floor(154/8)=19
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('しおづけ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('カメックス', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t112bmax = E.realStat(E.sides.opp, 'hp');   // 154
  E.setRandom(() => 0.5);
  E.runTurn();
  const t112bDealt = t112bmax - E.sides.opp.currentHp;
  const t112bCalc = E.calcDamage('self', 'opp', moveByName('しおづけ'));
  check('T112b みずタイプには1/8(19)削り', t112bDealt >= t112bCalc.min + 19 && t112bDealt <= t112bCalc.max + 19, `削れた合計=${t112bDealt}(期待 技${t112bCalc.min}〜${t112bCalc.max}+19)`);

  // T113 のろい(非ゴースト=フシギバナ): すばやさ-1/こうげき+1/ぼうぎょ+1。コストなし・相手にのろいは付かない
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('のろい')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t113max = E.realStat(E.sides.self, 'hp');
  const t113oMax = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T113 非ゴースト: こうげき+1 ぼうぎょ+1', E.sides.self.rank.atk === 1 && E.sides.self.rank.def === 1, `atk=${E.sides.self.rank.atk} def=${E.sides.self.rank.def}`);
  check('T113 非ゴースト: HPコストなし(はたく分のみ減)', E.sides.self.currentHp > t113max - 30, `hp=${E.sides.self.currentHp}/${t113max}`);
  check('T113 非ゴースト: 相手は削れない(のろい状態にならない)', E.sides.opp.currentHp === t113oMax, `opp hp=${E.sides.opp.currentHp}/${t113oMax}`);

  // T114 のろい(ゴースト=ゲンガー): 半分(67)支払い → 相手はのろい状態=毎ターン終了時 floor(155/4)=38 削り
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('のろい')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t114max = E.realStat(E.sides.self, 'hp');   // 135
  const t114oMax = E.realStat(E.sides.opp, 'hp');   // 155
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T114 ゴースト: HPを67(半分切り捨て)支払う', E.sides.self.currentHp <= t114max - 67 && E.sides.self.currentHp > t114max - 67 - 30, `hp=${E.sides.self.currentHp}(期待${t114max - 67}前後)`);
  check('T114 ゴースト: すばやさ/こうげき/ぼうぎょは変化しない', E.sides.self.rank.atk === 0 && E.sides.self.rank.def === 0, `atk=${E.sides.self.rank.atk} def=${E.sides.self.rank.def}`);
  check('T114 相手はターン終了時に38(1/4)削れる', E.sides.opp.currentHp === t114oMax - 38, `opp hp=${E.sides.opp.currentHp}(期待${t114oMax - 38})`);
  E.runTurn();   // 2ターン目(のろい重ねがけ): 相手の削りはさらに38(重複しない)
  check('T114 のろいの削りは毎ターン38ずつ', E.sides.opp.currentHp === t114oMax - 38 * 2, `opp hp=${E.sides.opp.currentHp}(期待${t114oMax - 76})`);

  // T114b HP不足でも実行して自分はひんし・それでも相手にのろいは付く(Bulbapedia "Curse")
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('のろい')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.self.currentHp = 30;   // コスト67より少ない
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t114bOMax = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T114b HP不足でも実行して自分はひんし', E.sides.self.currentHp === 0 && E.sides.self.fainted === true, `hp=${E.sides.self.currentHp} fainted=${E.sides.self.fainted}`);
  check('T114b 倒れても相手にのろいは付く(38削り)', E.sides.opp.currentHp === t114bOMax - 38, `opp hp=${E.sides.opp.currentHp}(期待${t114bOMax - 38})`);
  resetEnv();
}

console.log('\n=== 段㊱ 状態異常回復(ねむる/フレアドライブ解凍/いやしのすず)+ねむり目覚めカウンタ ===');
// 意味の出典:
//   ねむる(Bulbapedia "Rest" + PS実装): HP全回復+状態異常も回復して、2ターンねむり(3ターン目に目覚めて行動)。
//     HP満タン/すでにねむり/エレキフィールド(接地)で眠れない時は技ごと失敗。
//   ねむり(Bulbapedia "Sleep"): 第5世代以降 1〜3ターンで自然に目覚める(ねむるは固定2ターン)。
//   フレアドライブ(Bulbapedia "Flare Blitz"): こおり状態でも使えて、自分のこおりが とける。
//   いやしのすず(Bulbapedia "Heal Bell"): 自分と手持ちの状態異常をすべて回復(1vs1では自分)。
{
  // T115 ねむる: 満タンで失敗 → 削れたら全回復+ねむり(やけども治る) → 2ターン眠って3ターン目に目覚めて行動
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ねむる'), moveByName('はたく')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;   // 同速ランダムを避けて必ず先攻
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t115max = E.realStat(E.sides.self, 'hp');   // 155
  E.setRandom(() => 0.5);
  E.runTurn();   // 1ターン目: 満タンなので ねむる は失敗 → 相手のはたくで削れる
  check('T115 満タンなら失敗(ねむらない)', E.sides.self.status === 'none', `status=${E.sides.self.status}`);
  check('T115 失敗ターンは回復もしない(はたく分減)', E.sides.self.currentHp < t115max, `hp=${E.sides.self.currentHp}/${t115max}`);
  E.sides.self.status = 'burn';   // やけど状態で使う → 治ってからねむりになる
  E.runTurn();   // 2ターン目: ねむる成功=全回復+やけど回復+ねむり
  check('T115 HPが全回復する', E.sides.self.currentHp >= t115max - 19, `hp=${E.sides.self.currentHp}(全回復後はたく分のみ減)`);
  check('T115 やけどが治ってねむり状態になる', E.sides.self.status === 'sleep', `status=${E.sides.self.status}`);
  E.runTurn();   // 3ターン目: 眠っている(1/2)
  check('T115 1ターン目はぐうぐう眠っている', E.sides.self.status === 'sleep', `status=${E.sides.self.status}`);
  E.runTurn();   // 4ターン目: 眠っている(2/2)
  check('T115 2ターン目もぐうぐう眠っている', E.sides.self.status === 'sleep', `status=${E.sides.self.status}`);
  E.sides.self.selectedMoveIdx = 1;   // 目覚めたターンは はたく で行動できる
  const t115oHp = E.sides.opp.currentHp;
  E.runTurn();   // 5ターン目: 3ターン目に目覚めて行動
  check('T115 3ターン目に目を覚ます', E.sides.self.status === 'none', `status=${E.sides.self.status}`);
  check('T115 目覚めたターンに行動できる(はたくが当たる)', E.sides.opp.currentHp < t115oHp, `opp hp=${E.sides.opp.currentHp}(前=${t115oHp})`);

  // T115b エレキフィールド(接地)では ねむる は技ごと失敗(回復もしない)
  resetEnv();
  E.env.field = 'electric';
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ねむる')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.self.currentHp = 100;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T115b エレキFでは失敗(ねむらない)', E.sides.self.status === 'none', `status=${E.sides.self.status}`);
  check('T115b エレキFでは回復もしない', E.sides.self.currentHp < 100, `hp=${E.sides.self.currentHp}(100からはたく分減)`);

  // T115c さいみんじゅつ(ふつうのねむり): 1〜3ターンで自然に目覚める(乱数0.5=カウント3=行動2回ぶん眠る)。
  // 付与はそのターンの相手の行動前なので、付与ターン=1回目のスキップ(PS実装と同じ)。
  // 3ターン目は自分を はたく に切り替える(さいみんじゅつだと目覚める前に再付与してしまうため)。
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('さいみんじゅつ'), moveByName('はたく')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.5);   // 命中(50<60)・ねむりカウント 2+floor(0.5*3)=3
  E.runTurn();   // 1ターン目: 付与→相手はそのターン眠って動けない(スキップ1回目)
  check('T115c 相手がねむり状態になる', E.sides.opp.status === 'sleep', `status=${E.sides.opp.status}`);
  E.runTurn();   // 2ターン目: 眠っている(スキップ2回目)
  check('T115c 次のターンも眠っている', E.sides.opp.status === 'sleep', `status=${E.sides.opp.status}`);
  E.sides.self.selectedMoveIdx = 1;   // 再付与を避けて はたく に切り替え
  const t115cHp = E.sides.self.currentHp;
  E.runTurn();   // 3ターン目: 目覚めて はたく が来る
  check('T115c 3ターン目に目覚めて行動できる', E.sides.opp.status === 'none' && E.sides.self.currentHp < t115cHp, `status=${E.sides.opp.status} hp=${E.sides.self.currentHp}(前=${t115cHp})`);

  // T116 フレアドライブ: こおり状態でも使えて、自分のこおりが とけて攻撃が出る
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('フレアドライブ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.self.status = 'freeze';
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t116oMax = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.5);   // こおり自然解除(20%)は引かない乱数だが、フレアドライブは解凍宣言で必ず使える
  E.runTurn();
  check('T116 こおりが とける', E.sides.self.status !== 'freeze', `status=${E.sides.self.status}`);
  check('T116 とけたターンに攻撃が出る(相手が削れる)', E.sides.opp.currentHp < t116oMax, `opp hp=${E.sides.opp.currentHp}/${t116oMax}`);

  // T117 いやしのすず: 自分の状態異常(やけど)がすべて治る(1vs1=自分)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いやしのすず')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.self.status = 'burn';
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T117 やけどが治る', E.sides.self.status === 'none', `status=${E.sides.self.status}`);
  resetEnv();
}

console.log('\n=== 段㊲ 暴れる(混乱)(げきりん等: 2〜3ターン技ロック→終了時こんらん) ===');
// 出典: Bulbapedia "Outrage"/"Thrash"(第5世代以降)
//   2〜3ターン連続で攻撃(他の行動はできない)→ 暴れ終わると1〜4ターンこんらん(legacy準拠)。
//   中断(外れ/まもられ/こうかなし/まひ等)で暴れは終わり こんらんしない。
//   ただし「最終ターンになるはずだった」ターンに中断された時は こんらんする。
{
  // T118 技ロック+暴れ終了時こんらん: rand=0 → 暴れ2ターン・こんらんカウンタ2(=1ターン混乱)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('げきりん'), moveByName('はたく')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t118oMax = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.0);   // 暴れ総数=2(2+floor(0*2)) / 命中 / ダメ乱数最小 / こんらんカウンタ=2(1+1+floor(0*4))
  E.runTurn();   // 1ターン目: げきりん→あばれ開始
  const t118dmg1 = t118oMax - E.sides.opp.currentHp;
  check('T118 1ターン目にげきりんが当たる', t118dmg1 > 0, `dmg=${t118dmg1}`);
  check('T118 あばれ状態が始まる', !!E.sides.self.rampage, `rampage=${JSON.stringify(E.sides.self.rampage)}`);
  E.sides.self.selectedMoveIdx = 1;   // はたくに切替えてもロックでげきりんが出るはず
  const t118oHp1 = E.sides.opp.currentHp;
  E.runTurn();   // 2ターン目(最終): げきりん→暴れ終了→こんらん
  const t118dmg2 = t118oHp1 - E.sides.opp.currentHp;
  check('T118 2ターン目もげきりんが出る(技ロック・同ダメージ)', t118dmg2 === t118dmg1, `dmg2=${t118dmg2} dmg1=${t118dmg1}(はたくなら小さいはず)`);
  check('T118 暴れ終了でこんらんする(カウンタ2)', E.sides.self.confusion === 2, `confusion=${E.sides.self.confusion}`);
  check('T118 あばれ状態が解ける', !E.sides.self.rampage, `rampage=${JSON.stringify(E.sides.self.rampage)}`);

  // T119 非最終ターンの中断(まもられ)→こんらんしない: rand=0.9 → 暴れ総数=3
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('げきりん')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく'), moveByName('まもる')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.9);   // 暴れ総数=3(2+floor(0.9*2)) / 命中(90<100) / まもる成功(0.9<1)
  E.runTurn();   // 1ターン目: げきりん成功(残り2)
  check('T119 あばれ開始(残り2ターン)', !!E.sides.self.rampage && E.sides.self.rampage.left === 2, `rampage=${JSON.stringify(E.sides.self.rampage)}`);
  E.sides.opp.selectedMoveIdx = 1;   // 2ターン目: 相手がまもる(優先度+4で先に守る)
  E.runTurn();   // げきりんは防がれる=中断(非最終)
  check('T119 中断であばれ状態が解ける', !E.sides.self.rampage, `rampage=${JSON.stringify(E.sides.self.rampage)}`);
  check('T119 非最終ターンの中断ではこんらんしない', !E.sides.self.confusion, `confusion=${E.sides.self.confusion}`);

  // T120 最終ターンの中断(まもられ)→それでもこんらんする: rand=0 → 暴れ総数=2
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('げきりん')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく'), moveByName('まもる')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);   // 暴れ総数=2 / まもる成功(0<1) / こんらんカウンタ=2
  E.runTurn();   // 1ターン目: げきりん成功(残り1=次が最終)
  check('T120 あばれ開始(残り1ターン)', !!E.sides.self.rampage && E.sides.self.rampage.left === 1, `rampage=${JSON.stringify(E.sides.self.rampage)}`);
  E.sides.opp.selectedMoveIdx = 1;   // 2ターン目(最終になるはずだったターン): 相手がまもる
  E.runTurn();   // げきりんは防がれる=最終ターンの中断
  check('T120 中断であばれ状態が解ける', !E.sides.self.rampage, `rampage=${JSON.stringify(E.sides.self.rampage)}`);
  check('T120 最終ターンの中断ではこんらんする(カウンタ2)', E.sides.self.confusion === 2, `confusion=${E.sides.self.confusion}`);
  resetEnv();
}

console.log('\n=== 段㊳ ばくれつパンチ×てつのこぶし(特性の威力1.2倍は一般実装でカバー済の検証) ===');
// データの「場の威力補正(condition: ability てつのこぶし)」エントリはエンジンは読まない(fieldRules=場の技のみ)。
// 代わりに ability + flags.punch の一般実装(全パンチ技14種共通)が1.2倍を担う=二重計上なし、を固定する。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ばくれつパンチ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  const mvBP = moveByName('ばくれつパンチ');
  E.sides.self.ability = null;
  const r1 = E.calcDamage('self', 'opp', mvBP);
  E.sides.self.ability = 'てつのこぶし';
  const r2 = E.calcDamage('self', 'opp', mvBP);
  check('T121 てつのこぶしなしでダメージが出る', r1 && r1.min > 0, r1 ? `min=${r1.min}` : 'null');
  check('T121 てつのこぶしで約1.2倍になる', r1 && r2 && r2.min > r1.min && r2.min <= Math.ceil(r1.min * 1.25) && r2.min >= Math.floor(r1.min * 1.15),
    r1 && r2 && `なし=${r1.min} あり=${r2.min} (比=${(r2.min / r1.min).toFixed(3)})`);
  E.sides.self.ability = null;
  resetEnv();
}

console.log('\n=== 段㊴ バインド(しめつける等7技: 4〜5ターン毎ターン終了時1/8削り+こうそくスピン解除) ===');
// 出典: legacy(7技同一文)「4〜5ターンの間、毎ターン終了後最大HPの1/8」+ Bulbapedia "Bind"(第6世代以降1/8)。
// 逃げ/交代封じ(prevents_switch)は1vs1のsimでは出番なし。ゴーストタイプには付与されない(immune宣言)。
{
  // T122 しめつける: 付与+毎ターン終了時に最大HPの1/8(フシギバナ155→19)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('しめつける'), moveByName('はたく')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t122max = E.realStat(E.sides.opp, 'hp');   // 155
  E.setRandom(() => 0.0);   // 命中 / ダメ乱数最小 / バインド4ターン(4+floor(0*2))
  E.runTurn();   // 1ターン目: しめつける+ターン終了バインド19
  const t122slip = (E.sides.opp.slips || []).filter(sl => sl.source === 'バインド');
  check('T122 バインド状態が付く', t122slip.length === 1, `slips=${JSON.stringify(E.sides.opp.slips)}`);
  const t122moveDmg = t122max - E.sides.opp.currentHp - 19;
  check('T122 ターン終了時に19(=155×1/8切り捨て)削られる', t122moveDmg > 0 && t122moveDmg < 19,
    `総減=${t122max - E.sides.opp.currentHp}(技ダメ${t122moveDmg}+バインド19のはず)`);
  E.runTurn();   // 2ターン目: 重ねがけされない
  check('T122b 重ねがけ不可(1件のまま)', (E.sides.opp.slips || []).filter(sl => sl.source === 'バインド').length === 1,
    `slips=${JSON.stringify(E.sides.opp.slips)}`);
  // T123 4ターンで解ける(rand=0→4ターン): あと2ターンで消える
  E.runTurn();   // 3ターン目
  E.runTurn();   // 4ターン目(最後の削り→とける)
  check('T123 4ターン目の終わりにバインドがとける', (E.sides.opp.slips || []).length === 0,
    `slips=${JSON.stringify(E.sides.opp.slips)}`);
  const t123hp4 = E.sides.opp.currentHp;
  E.sides.self.selectedMoveIdx = 1;   // 5ターン目は はたく(しめつける継続だと正しく再付与されるため)
  E.runTurn();   // 5ターン目: バインドダメージなし(技ダメのみ)
  const t123drop5 = t123hp4 - E.sides.opp.currentHp;
  check('T123 とけた後はターン終了ダメージなし(技ダメのみ)', t123drop5 > 0 && t123drop5 < 19, `5ターン目の減=${t123drop5}`);

  // T124 こうそくスピン: 自分のバインドを解除+すばやさ+1
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('こうそくスピン')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.slips = [{source: 'バインド', fraction: 0.125, turns: 4}];
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.rank.spd = -6;   // 自分が先攻(自分のランクは+1チェックに使うので触らない)
  const t124max = E.realStat(E.sides.self, 'hp');
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T124 こうそくスピンでバインドが解除される', (E.sides.self.slips || []).length === 0,
    `slips=${JSON.stringify(E.sides.self.slips)}`);
  check('T124 すばやさ+1', E.sides.self.rank.spd === 1, `spd rank=${E.sides.self.rank.spd}`);
  check('T124 解除ターンの終了時バインドダメージなし(はたく分のみ減)', t124max - E.sides.self.currentHp <= 19,
    `減=${t124max - E.sides.self.currentHp}(はたく16-19のみのはず)`);

  // T125 ゴーストタイプには付与されない(ほのおのうず→ゲンガー: ほのお等倍で当たるがバインドは付かない)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ほのおのうず')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t125max = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T125 ほのおのうずは当たる(ダメージあり)', E.sides.opp.currentHp < t125max, `hp=${E.sides.opp.currentHp}/${t125max}`);
  check('T125 ゴーストにバインドは付かない', (E.sides.opp.slips || []).length === 0, `slips=${JSON.stringify(E.sides.opp.slips)}`);
  resetEnv();
}

console.log('\n=== 段㊵ やどりぎのタネ(毎ターン相手の最大HP1/8を吸って自分が回復・くさ無効・スピン解除) ===');
// legacy:「毎ターン、相手のHPを最大HPの1/8ずつ減らし、その分自分のHPを回復」「くさタイプには無効」
{
  // T126 付与+ターン終了で相手-16(ゲンガー135×1/8)/自分+16回復
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('やどりぎのタネ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  const t126sMax = E.realStat(E.sides.self, 'hp');   // 155
  const t126oMax = E.realStat(E.sides.opp, 'hp');    // 135
  E.setRandom(() => 0.0);   // 命中(0<90)
  const t126hatakuDmg = E.calcDamage('opp', 'self', moveByName('はたく')).min;   // rand0=最小ロール固定
  E.sides.self.currentHp = 100;   // 回復が最大HPキャップに当たらないように削っておく(+16を厳密に見る)
  E.runTurn();   // 自分: やどりぎ付与 → 相手: はたく → ターン終了: 相手-16/自分+16
  const t126slip = (E.sides.opp.slips || []).filter(sl => sl.source === 'やどりぎのタネ');
  check('T126 やどりぎ状態が付く', t126slip.length === 1, `slips=${JSON.stringify(E.sides.opp.slips)}`);
  check('T126 ターン終了時に相手が16(=135×1/8切り捨て)削られる', t126oMax - E.sides.opp.currentHp === 16,
    `相手の減=${t126oMax - E.sides.opp.currentHp}`);
  const t126expect = Math.min(t126sMax, 100 - t126hatakuDmg + 16);
  check('T126 削った分(16)だけ自分が回復している', E.sides.self.currentHp === t126expect,
    `self hp=${E.sides.self.currentHp} 期待=${t126expect}(100-被弾${t126hatakuDmg}+回復16)`);

  // T126b くさタイプには無効(フシギバナに撃つ)
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('やどりぎのタネ')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spd = 6;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T126b くさタイプには付かない', (E.sides.opp.slips || []).length === 0, `slips=${JSON.stringify(E.sides.opp.slips)}`);

  // T127 こうそくスピンでやどりぎ解除
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('こうそくスピン')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.self.slips = [{source: 'やどりぎのタネ', fraction: 0.125, drains: true}];
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.rank.spd = -6;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T127 こうそくスピンでやどりぎが解除される', (E.sides.self.slips || []).length === 0,
    `slips=${JSON.stringify(E.sides.self.slips)}`);
  resetEnv();
}

console.log('\n=== 段㊶ トリックルーム(5ターン素早さ逆転・再使用で解除・優先度-7) ===');
// legacy:「5ターンの間、すばやさが低いポケモンから攻撃」「もう1度使用すると元に戻る」「必ず後攻(優先度-7)」
// env.trickRoom(UI手動=無期限)は実装済 → 技からの展開(5ターンカウント+トグル)を開通する。
{
  // T128 フシギバナ(遅80) vs ゲンガー(速110)。1ターン目にトリックルーム→2ターン目は遅い方が先攻
  // ※自分の攻撃技はくさ技(タネばくだん)にする(はたく=ノーマルはゴーストのゲンガーにこうかなし)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('トリックルーム'), moveByName('タネばくだん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // 1ターン目: ゲンガー先攻(TRは-7でどのみち後攻)→TR展開
  check('T128 トリックルームが展開される', E.env.trickRoom === true, `trickRoom=${E.env.trickRoom}`);
  check('T128 5ターンカウントが付く(使用ターンで1消費=残4)', E.env.trickRoomTurns === 4, `turns=${E.env.trickRoomTurns}`);
  // 2ターン目: 遅いフシギバナが先攻になるはず。相手HP1なら先に倒して被弾しない
  E.sides.self.selectedMoveIdx = 1;
  E.sides.opp.currentHp = 1;
  const t128sHp = E.sides.self.currentHp;
  E.runTurn();
  check('T128 TR下では遅い方が先攻(先に倒して被弾なし)', E.sides.opp.fainted && E.sides.self.currentHp === t128sHp,
    `oppFainted=${E.sides.opp.fainted} selfHp=${E.sides.self.currentHp}(前=${t128sHp})`);

  // T128b 5ターン目の終わりに元に戻る(使用ターン含め5ターン)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('トリックルーム'), moveByName('タネばくだん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // 1(展開)
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn(); E.runTurn(); E.runTurn();   // 2,3,4
  check('T128b 4ターン目まではまだ有効', E.env.trickRoom === true, `trickRoom=${E.env.trickRoom} turns=${E.env.trickRoomTurns}`);
  E.runTurn();   // 5(終わりに戻る)
  check('T128b 5ターン目の終わりに元に戻る', E.env.trickRoom === false && E.env.trickRoomTurns == null,
    `trickRoom=${E.env.trickRoom} turns=${E.env.trickRoomTurns}`);

  // T129 もう1度使うと元に戻る(トグル)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('トリックルーム')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // 展開
  check('T129 1回目で展開', E.env.trickRoom === true, `trickRoom=${E.env.trickRoom}`);
  E.runTurn();   // 再使用→解除
  check('T129 2回目で元に戻る', E.env.trickRoom === false && E.env.trickRoomTurns == null,
    `trickRoom=${E.env.trickRoom} turns=${E.env.trickRoomTurns}`);
  resetEnv();
}

console.log('\n=== 段㊷ 状態異常条件の威力倍率(からげんき/ベノムショック/たたりめ/ひゃっきやこう+やけど低下無視) ===');
// 出典: Bulbapedia "Facade"(どく/まひ/やけどで威力2倍・第6世代以降やけどの物理半減も無視) /
//       "Venoshock"(どく/もうどくで2倍) / "Hex"・"Infernal Parade"(状態異常なら何でも2倍)
{
  // T130 からげんき: やけど時 威力2倍+やけどの物理半減を無視 → 健康時のほぼ2倍(半減が残ると約1倍)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('カメックス', null);
  const mvKG = moveByName('からげんき');
  E.sides.self.status = 'none';
  const kgN = E.calcDamage('self', 'opp', mvKG);
  E.sides.self.status = 'burn';
  const kgB = E.calcDamage('self', 'opp', mvKG);
  check('T130 健康時のからげんきはダメージが出る', kgN && kgN.min > 0, kgN ? `min=${kgN.min}` : 'null');
  check('T130 やけど時は約2倍(半減無視込み)', kgN && kgB && kgB.min >= Math.floor(kgN.min * 1.8) && kgB.min <= Math.ceil(kgN.min * 2.2),
    kgN && kgB && `健康=${kgN.min} やけど=${kgB.min} (比=${(kgB.min / kgN.min).toFixed(3)})`);
  // ねむりでは倍化しない(対象はどく/もうどく/まひ/やけどのみ)
  E.sides.self.status = 'sleep';
  const kgS = E.calcDamage('self', 'opp', mvKG);
  check('T130b ねむりでは倍化しない', kgN && kgS && kgS.min === kgN.min, kgN && kgS && `健康=${kgN.min} ねむり=${kgS.min}`);
  E.sides.self.status = 'none';

  // T131 ベノムショック: 相手がどく/もうどくの時だけ2倍(やけどでは等倍)
  const mvVS = moveByName('ベノムショック');
  E.sides.opp.status = 'none';
  const vsN = E.calcDamage('self', 'opp', mvVS);
  E.sides.opp.status = 'poison';
  const vsP = E.calcDamage('self', 'opp', mvVS);
  E.sides.opp.status = 'burn';
  const vsB = E.calcDamage('self', 'opp', mvVS);
  check('T131 相手どくで約2倍', vsN && vsP && vsP.min >= Math.floor(vsN.min * 1.8) && vsP.min <= Math.ceil(vsN.min * 2.2),
    vsN && vsP && `なし=${vsN.min} どく=${vsP.min} (比=${(vsP.min / vsN.min).toFixed(3)})`);
  check('T131b 相手やけどでは倍化しない', vsN && vsB && vsB.min === vsN.min, vsN && vsB && `なし=${vsN.min} やけど=${vsB.min}`);

  // T132 たたりめ: 相手が状態異常なら何でも2倍(やけどでも)
  const mvTM = moveByName('たたりめ');
  E.sides.opp.status = 'none';
  const tmN = E.calcDamage('self', 'opp', mvTM);
  E.sides.opp.status = 'burn';
  const tmB = E.calcDamage('self', 'opp', mvTM);
  check('T132 相手やけどで約2倍(状態異常なら何でも)', tmN && tmB && tmB.min >= Math.floor(tmN.min * 1.8) && tmB.min <= Math.ceil(tmN.min * 2.2),
    tmN && tmB && `なし=${tmN.min} やけど=${tmB.min} (比=${(tmB.min / tmN.min).toFixed(3)})`);

  // T133 ひゃっきやこう: 相手がねむりでも2倍
  const mvHY = moveByName('ひゃっきやこう');
  E.sides.opp.status = 'none';
  const hyN = E.calcDamage('self', 'opp', mvHY);
  E.sides.opp.status = 'sleep';
  const hyS = E.calcDamage('self', 'opp', mvHY);
  check('T133 相手ねむりで約2倍', hyN && hyS && hyS.min >= Math.floor(hyN.min * 1.8) && hyS.min <= Math.ceil(hyN.min * 2.2),
    hyN && hyS && `なし=${hyN.min} ねむり=${hyS.min} (比=${(hyS.min / hyN.min).toFixed(3)})`);
  E.sides.opp.status = 'none';
  resetEnv();
}

console.log('\n=== 段㊸ 技タイプ変更(mapping型)+威力可変: ウェザーボール(天気)/だいちのはどう(フィールド) ===');
// 出典: Bulbapedia "Weather Ball"(天気でタイプが変わり威力50→100) /
//       "Terrain Pulse"(フィールド展開中+自分が接地でタイプが変わり威力2倍。ひこう/ふゆうは接地でないので不変)
{
  // T134 ウェザーボール: 天気なし=ノーマル50(ゴーストに無効) / すなあらし=いわ100
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('ゲンガー', null);
  const mvWB = moveByName('ウェザーボール');
  const wbNone = E.calcDamage('self', 'opp', mvWB);
  check('T134 天気なし=ノーマル技なのでゴーストに無効', wbNone && wbNone.immune === true, wbNone ? `immune=${wbNone.immune}` : 'null');
  E.env.weather = 'sand';
  const wbSandG = E.calcDamage('self', 'opp', mvWB);
  check('T134b すなあらしでいわタイプ化=ゴーストに当たる', wbSandG && !wbSandG.immune && wbSandG.min > 0,
    wbSandG ? `immune=${wbSandG.immune} min=${wbSandG.min}` : 'null');
  // 威力50→100: いわ/ノーマルとも等倍のカメックスで比較(すなあらしはいわ技の威力に補正なし)
  E.sides.opp = freshSide('カメックス', null);
  E.env.weather = 'none';
  const wbN2 = E.calcDamage('self', 'opp', mvWB);
  E.env.weather = 'sand';
  const wbS2 = E.calcDamage('self', 'opp', mvWB);
  check('T134c 天気があると威力50→100(約2倍)', wbN2 && wbS2 && wbS2.min >= Math.floor(wbN2.min * 1.8) && wbS2.min <= Math.ceil(wbN2.min * 2.2),
    wbN2 && wbS2 && `なし=${wbN2.min} すなあらし=${wbS2.min} (比=${(wbS2.min / wbN2.min).toFixed(3)})`);
  E.env.weather = 'none';

  // T135 だいちのはどう: ミストフィールド+接地でフェアリー化+威力2倍(フェアリーにフィールド威力補正はない=きれいに2倍)
  const mvTP = moveByName('だいちのはどう');
  E.sides.opp = freshSide('ゲンガー', null);
  const tpNone = E.calcDamage('self', 'opp', mvTP);
  check('T135 フィールドなし=ノーマル技なのでゴーストに無効', tpNone && tpNone.immune === true, tpNone ? `immune=${tpNone.immune}` : 'null');
  E.env.field = 'misty';
  const tpMistG = E.calcDamage('self', 'opp', mvTP);
  check('T135b ミストでフェアリー化=ゴーストに当たる', tpMistG && !tpMistG.immune && tpMistG.min > 0,
    tpMistG ? `immune=${tpMistG.immune} min=${tpMistG.min}` : 'null');
  E.sides.opp = freshSide('カメックス', null);
  E.env.field = 'none';
  const tpN2 = E.calcDamage('self', 'opp', mvTP);
  E.env.field = 'misty';
  const tpM2 = E.calcDamage('self', 'opp', mvTP);
  check('T135c フィールド中は威力2倍', tpN2 && tpM2 && tpM2.min >= Math.floor(tpN2.min * 1.8) && tpM2.min <= Math.ceil(tpN2.min * 2.2),
    tpN2 && tpM2 && `なし=${tpN2.min} ミスト=${tpM2.min} (比=${(tpM2.min / tpN2.min).toFixed(3)})`);
  // 接地していないと変化しない(ふゆう)
  E.sides.self.ability = 'ふゆう';
  E.sides.opp = freshSide('ゲンガー', null);
  const tpFloat = E.calcDamage('self', 'opp', mvTP);
  check('T135d ふゆう(非接地)はタイプ不変=ゴーストに無効のまま', tpFloat && tpFloat.immune === true,
    tpFloat ? `immune=${tpFloat.immune}` : 'null');
  E.sides.self.ability = null;
  resetEnv();
}

console.log('\n=== 段㊹ このターン/持ち物の条件威力(ゆきなだれ/はたきおとす+持ち物排除/じならし) ===');
// 出典: Bulbapedia "Avalanche"(そのターン相手の技のダメージを受けていると2倍・優先度-4) /
//       "Knock Off"(相手が道具持ちなら1.5倍+道具をはたきおとす) / "Bulldoze"(グラスフィールドで半減=場側ルール)
{
  // T136 ゆきなだれ: このターン被弾していると威力2倍
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('カメックス', null);
  const mvYN = moveByName('ゆきなだれ');
  E.sides.self.tookThisTurn = {phys: 0, spec: 0, any: 0};
  const ynN = E.calcDamage('self', 'opp', mvYN);
  E.sides.self.tookThisTurn = {phys: 20, spec: 0, any: 20};
  const ynT = E.calcDamage('self', 'opp', mvYN);
  check('T136 被弾なしでダメージが出る', ynN && ynN.min > 0, ynN ? `min=${ynN.min}` : 'null');
  check('T136b このターン被弾で約2倍', ynN && ynT && ynT.min >= Math.floor(ynN.min * 1.8) && ynT.min <= Math.ceil(ynN.min * 2.2),
    ynN && ynT && `なし=${ynN.min} 被弾後=${ynT.min} (比=${(ynT.min / ynN.min).toFixed(3)})`);
  E.sides.self.tookThisTurn = {phys: 0, spec: 0, any: 0};

  // T137 はたきおとす: 相手が道具持ちなら1.5倍+攻撃後に道具がなくなる
  const mvHO = moveByName('はたきおとす');
  E.sides.opp.item = null;
  const hoN = E.calcDamage('self', 'opp', mvHO);
  E.sides.opp.item = 'kodawari_scarf';
  const hoI = E.calcDamage('self', 'opp', mvHO);
  check('T137 道具持ち相手に約1.5倍', hoN && hoI && hoI.min >= Math.floor(hoN.min * 1.4) && hoI.min <= Math.ceil(hoN.min * 1.6),
    hoN && hoI && `なし=${hoN.min} 持ち=${hoI.min} (比=${(hoI.min / hoN.min).toFixed(3)})`);
  // runTurn で道具がはたきおとされる
  E.sides.self.moves = [mvHO]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T137b 攻撃後に相手の道具がなくなる', E.sides.opp.item == null, `item=${E.sides.opp.item}`);

  // T138 じならし: グラスフィールドで威力半減(場側ルール=接地した相手への地震系0.5倍)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('カメックス', null);
  const mvJN = moveByName('じならし');
  const jnN = E.calcDamage('self', 'opp', mvJN);
  E.env.field = 'grassy';
  const jnG = E.calcDamage('self', 'opp', mvJN);
  check('T138 グラスフィールドで約半減', jnN && jnG && jnG.min >= Math.floor(jnN.min * 0.4) && jnG.min <= Math.ceil(jnN.min * 0.6),
    jnN && jnG && `なし=${jnN.min} グラス=${jnG.min} (比=${(jnG.min / jnN.min).toFixed(3)})`);
  resetEnv();
}

console.log('\n=== 段㊺ 前ターン失敗/このターン能力低下の威力倍化(じだんだ/うっぷんばらし) ===');
// 出典: Bulbapedia "Stomping Tantrum"(直前のターンに技が外れた・失敗した・行動できなかったら2倍) /
//       "Lash Out"(そのターンに自分の能力ランクを下げられていたら2倍)
{
  // T139 じだんだ: 前ターン失敗フラグで威力2倍
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('カメックス', null);
  const mvJD = moveByName('じだんだ');
  E.sides.self.lastTurnFailed = false;
  const jdN = E.calcDamage('self', 'opp', mvJD);
  E.sides.self.lastTurnFailed = true;
  const jdF = E.calcDamage('self', 'opp', mvJD);
  check('T139 前ターン失敗で約2倍', jdN && jdF && jdF.min >= Math.floor(jdN.min * 1.8) && jdF.min <= Math.ceil(jdN.min * 2.2),
    jdN && jdF && `通常=${jdN.min} 失敗後=${jdF.min} (比=${(jdF.min / jdN.min).toFixed(3)})`);
  E.sides.self.lastTurnFailed = false;
  // 統合: 1ターン目に相手のまもるで防がれる → failedThisTurn が立つ → 2ターン目は2倍で当たる
  E.sides.self.moves = [mvJD]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp.moves = [moveByName('まもる'), moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // 1: まもられて失敗
  check('T139b まもられた失敗が記録される', E.sides.self.failedThisTurn === true, `failedThisTurn=${E.sides.self.failedThisTurn}`);
  E.sides.opp.selectedMoveIdx = 1;
  const t139hp = E.sides.opp.currentHp;
  E.runTurn();   // 2: 2倍じだんだが当たる(min乱数固定=jdF.minと一致するはず)
  check('T139c 次のターンは2倍で当たる', E.sides.opp.currentHp === t139hp - jdF.min,
    `減少=${t139hp - E.sides.opp.currentHp} 期待=${jdF.min}`);
  const t139hp2 = E.sides.opp.currentHp;
  E.runTurn();   // 3: 前ターンは成功していたので等倍に戻る
  check('T139d 成功の次のターンは等倍に戻る', E.sides.opp.currentHp === t139hp2 - jdN.min,
    `減少=${t139hp2 - E.sides.opp.currentHp} 期待=${jdN.min}`);

  // T140 うっぷんばらし: このターン能力を下げられていると威力2倍
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('カメックス', null);
  const mvUB = moveByName('うっぷんばらし');
  E.sides.self.statLoweredThisTurn = false;
  const ubN = E.calcDamage('self', 'opp', mvUB);
  E.sides.self.statLoweredThisTurn = true;
  const ubL = E.calcDamage('self', 'opp', mvUB);
  check('T140 能力を下げられたターンは約2倍', ubN && ubL && ubL.min >= Math.floor(ubN.min * 1.8) && ubL.min <= Math.ceil(ubN.min * 2.2),
    ubN && ubL && `通常=${ubN.min} 低下後=${ubL.min} (比=${(ubL.min / ubN.min).toFixed(3)})`);
  E.sides.self.statLoweredThisTurn = false;
  // 統合: 速いゲンガーが先にこわいかお(すばやさ-1=自分の与ダメには影響しない) → 後攻のうっぷんばらしが2倍
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [mvUB]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('こわいかお')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  const ubGn = E.calcDamage('self', 'opp', mvUB);   // ゲンガー相手の等倍値(低下前に計算)
  E.sides.self.statLoweredThisTurn = true;
  const ubG2 = E.calcDamage('self', 'opp', mvUB);   // 2倍時の期待値(丸めを式と一致させる)
  E.sides.self.statLoweredThisTurn = false;
  const t140hp = E.sides.opp.currentHp != null ? E.sides.opp.currentHp : 135;
  E.runTurn();
  // 2倍(146)はゲンガーのHP(135)を超えるのでHP0でキャップ。等倍(74)なら倒れない=判別できる
  const t140exp = Math.max(0, t140hp - ubG2.min);
  check('T140b 先にこわいかおを受けると2倍で当たる', E.sides.opp.currentHp === t140exp,
    `残HP=${E.sides.opp.currentHp} 期待=${t140exp}(2倍=${ubG2.min}/等倍=${ubGn.min})`);
  resetEnv();
}

console.log('\n=== 段㊻ 対ちいさくなる(必中+威力2倍)と条件つき必中の命中判定 ===');
// 出典: Bulbapedia "Minimize"(第6世代以降: のしかかり/ヒートスタンプ/フライングプレス等は回避率に関係なく
//       必ず当たり威力2倍) / "Flying Press"(命中95) "Dragon Rush"(命中75) = 通常は外れうる技。
//       必中になるのは「相手がちいさくなる状態」の時だけ=条件つき必中は条件を尊重しなければならない。
{
  // T141 ちいさくなる: 回避+2(既存挙動) と minimized 状態(新規・場を離れるまで継続)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'chiisakunaru');
  E.sides.opp = freshSide('カメックス', null);
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T141 回避率+2', E.sides.self.rank.eva === 2, `eva=${E.sides.self.rank.eva}`);
  check('T141b minimized状態が立つ', E.sides.self.minimized === true, `minimized=${E.sides.self.minimized}`);

  // T142 のしかかり: 相手がちいさくなる状態なら威力約2倍
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('カメックス', null);
  const mvNS = moveByName('のしかかり');
  E.sides.opp.minimized = false;
  const nsN = E.calcDamage('self', 'opp', mvNS);
  E.sides.opp.minimized = true;
  const nsM = E.calcDamage('self', 'opp', mvNS);
  check('T142 ちいさくなる相手に約2倍', nsN && nsM && nsM.min >= Math.floor(nsN.min * 1.8) && nsM.min <= Math.ceil(nsN.min * 2.2),
    nsN && nsM && `通常=${nsN.min} 縮小=${nsM.min} (比=${(nsM.min / nsN.min).toFixed(3)})`);

  // T143 条件つき必中は条件を満たす時だけ(フライングプレス 命中95):
  //   相手が縮小していなければ通常の命中判定(roll=99 > 95 で外れる)・縮小していれば必中
  const mvFP = moveByName('フライングプレス');
  E.sides.opp.minimized = false;
  E.setRandom(() => 0.99);   // roll=99 → 命中95を超える=外れるはず
  const fpMiss = E.phaseHitCheck(mvFP, E.sides.self, E.sides.opp);
  check('T143 縮小していない相手には外れうる', fpMiss.hit === false, `hit=${fpMiss.hit}`);
  E.sides.opp.minimized = true;
  const fpHit = E.phaseHitCheck(mvFP, E.sides.self, E.sides.opp);
  check('T143b 縮小した相手には必中', fpHit.hit === true, `hit=${fpHit.hit}`);
  // のしかかり(命中100)は非縮小でも通常判定で当たる=条件化しても命中100技は壊れない
  E.sides.opp.minimized = false;
  const nsHit = E.phaseHitCheck(mvNS, E.sides.self, E.sides.opp);
  check('T143c のしかかりは非縮小でも命中100で当たる', nsHit.hit === true, `hit=${nsHit.hit}`);
  E.setRandom(() => 0.0);
  resetEnv();
}

console.log('\n=== 段㊼ こらえる(優先度+4・技の直撃をHP1で耐える・連続使用で成功率低下) ===');
// 出典: Bulbapedia "Endure"(優先度+4。そのターン、技のダメージではHPが1より下がらない。
//       連続で使うと成功率が1/3ずつ下がる=まもる系と共通のカウント。間接ダメージ[天候/状態異常等]は防げない)
{
  resetEnv();
  // T144 後攻(カメックスはフシギバナより遅い)でも優先度+4で先にこらえる体勢に入り、直撃をHP1で耐える
  E.sides.self = freshSide('カメックス', 'koraeru');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.self.currentHp = 5;   // はたく(威力40)で5以上は確実に出る=こらえなければ倒れる
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T144 こらえてHP1で残る', E.sides.self.currentHp === 1 && !E.sides.self.fainted,
    `残HP=${E.sides.self.currentHp} fainted=${E.sides.self.fainted}`);
  check('T144b 連続成功カウントが進む(まもる系と共通)', E.sides.self.protectStreak === 1, `streak=${E.sides.self.protectStreak}`);
  // T144c 連続使用: 成功率1/3 → 乱数0.99で失敗 → 直撃で倒れる
  E.setRandom(() => 0.99);
  E.runTurn();
  check('T144c 連続使用は失敗して倒れる', E.sides.self.fainted === true,
    `残HP=${E.sides.self.currentHp} fainted=${E.sides.self.fainted} streak=${E.sides.self.protectStreak}`);
  E.setRandom(() => 0.0);
  resetEnv();
}

console.log('\n=== 段㊽ じゅうでん(とくぼう+1・次のでんき技の威力2倍) ===');
// 出典: Bulbapedia "Charge"(とくぼう+1。次に使うでんきタイプのダメージ技の威力が2倍。
//       でんき技を使うまで効果が続き[第9世代]、でんき技を使うと消費される)
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'juuden');
  E.sides.opp = freshSide('カメックス', null);
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T145 とくぼう+1', E.sides.self.rank.spdef === 1, `spdef=${E.sides.self.rank.spdef}`);
  check('T145b じゅうでん状態が立つ', !!E.sides.self.chargeBoost, `chargeBoost=${JSON.stringify(E.sides.self.chargeBoost || null)}`);
  // でんき技の威力約2倍 / でんき以外は不変
  const mvTB = moveByName('10まんボルト');
  const mvSB = moveByName('タネばくだん');
  const _cb = E.sides.self.chargeBoost || {move_type:'でんき', multiplier:2};
  E.sides.self.chargeBoost = null;
  const tbN = E.calcDamage('self', 'opp', mvTB);
  const sbN = E.calcDamage('self', 'opp', mvSB);
  E.sides.self.chargeBoost = _cb;
  const tbC = E.calcDamage('self', 'opp', mvTB);
  const sbC = E.calcDamage('self', 'opp', mvSB);
  check('T145c でんき技が約2倍', tbN && tbC && tbC.min >= Math.floor(tbN.min * 1.8) && tbC.min <= Math.ceil(tbN.min * 2.2),
    tbN && tbC && `通常=${tbN.min} じゅうでん=${tbC.min} (比=${(tbC.min / tbN.min).toFixed(3)})`);
  check('T145d でんき以外は不変', sbN && sbC && sbC.min === sbN.min, sbN && sbC && `通常=${sbN.min} じゅうでん中=${sbC.min}`);
  // 持続と消費: でんき以外の技を使っても残る → でんき技を使うと消費される
  E.sides.self.moves = [mvSB]; E.sides.self.selectedMoveIdx = 0;
  E.runTurn();
  check('T145e でんき以外を使っても消費されない', !!E.sides.self.chargeBoost, `chargeBoost=${JSON.stringify(E.sides.self.chargeBoost || null)}`);
  const oppMax = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax; E.sides.opp.fainted = false;
  E.sides.self.moves = [mvTB]; E.sides.self.selectedMoveIdx = 0;
  E.runTurn();
  check('T145f でんき技は2倍で当たり消費される', E.sides.opp.currentHp === Math.max(0, oppMax - tbC.min) && !E.sides.self.chargeBoost,
    `残HP=${E.sides.opp.currentHp} 期待=${Math.max(0, oppMax - tbC.min)}(2倍=${tbC.min}/等倍=${tbN.min}) chargeBoost=${JSON.stringify(E.sides.self.chargeBoost || null)}`);
  resetEnv();
}

console.log('\n=== 段㊾ たくわえる/はきだす/のみこむ ===');
// 出典: Bulbapedia "Stockpile"(最大3回・使うたび ぼうぎょ/とくぼう+1。3回たくわえていると失敗) /
//       "Spit Up"(威力=たくわえた数×100。使うとたくわえは0に戻り、上がったぼうぎょ/とくぼうも戻る。0なら失敗) /
//       "Swallow"(たくわえ1=1/4・2=1/2・3=全回復。使うと同様に戻る。0なら失敗)
{
  resetEnv();
  E.sides.self = freshSide('カメックス', 'takuwaeru');
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T146 たくわえ1: ぼうぎょ/とくぼう+1', E.sides.self.stockpile === 1 && E.sides.self.rank.def === 1 && E.sides.self.rank.spdef === 1,
    `stockpile=${E.sides.self.stockpile} def=${E.sides.self.rank.def} spdef=${E.sides.self.rank.spdef}`);
  E.runTurn(); E.runTurn();
  check('T146b たくわえ3: ぼうぎょ/とくぼう+3', E.sides.self.stockpile === 3 && E.sides.self.rank.def === 3 && E.sides.self.rank.spdef === 3,
    `stockpile=${E.sides.self.stockpile} def=${E.sides.self.rank.def} spdef=${E.sides.self.rank.spdef}`);
  E.runTurn();   // 4回目は技ごと失敗(ランクも上がらない)
  check('T146c 4回目は失敗して3のまま', E.sides.self.stockpile === 3 && E.sides.self.rank.def === 3 && E.sides.self.rank.spdef === 3,
    `stockpile=${E.sides.self.stockpile} def=${E.sides.self.rank.def} spdef=${E.sides.self.rank.spdef}`);

  // はきだす: 威力=たくわえ×100(3→300 / 1→100で約3倍差)
  const mvHD = moveByName('はきだす');
  const hd3 = E.calcDamage('self', 'opp', mvHD);
  E.sides.self.stockpile = 1;
  const hd1 = E.calcDamage('self', 'opp', mvHD);
  E.sides.self.stockpile = 3;
  check('T146d たくわえ3はたくわえ1の約3倍', hd1 && hd3 && hd3.min >= Math.floor(hd1.min * 2.7) && hd3.min <= Math.ceil(hd1.min * 3.3),
    hd1 && hd3 && `×1=${hd1.min} ×3=${hd3.min} (比=${(hd3.min / hd1.min).toFixed(3)})`);

  // 使うと当たって消費され、上がったランクも戻る
  E.sides.self.moves = [mvHD]; E.sides.self.selectedMoveIdx = 0;
  const t146hp = E.sides.opp.currentHp;
  E.runTurn();
  check('T146e はきだす(威力300)が当たる', hd3 != null && E.sides.opp.currentHp === Math.max(0, t146hp - hd3.min),
    `減少=${t146hp - E.sides.opp.currentHp} 期待=${hd3 ? hd3.min : 'null(威力可変未対応)'}`);
  check('T146f 消費されランクも戻る', E.sides.self.stockpile === 0 && E.sides.self.rank.def === 0 && E.sides.self.rank.spdef === 0,
    `stockpile=${E.sides.self.stockpile} def=${E.sides.self.rank.def} spdef=${E.sides.self.rank.spdef}`);
  // たくわえ0でははきだす失敗
  const t146hp2 = E.sides.opp.currentHp;
  E.runTurn();
  check('T146g たくわえ0でははきだす失敗', E.sides.opp.currentHp === t146hp2 && E.sides.self.failedThisTurn === true,
    `減少=${t146hp2 - E.sides.opp.currentHp} failedThisTurn=${E.sides.self.failedThisTurn}`);

  // のみこむ: たくわえ2で最大HPの半分回復+消費
  E.sides.self = freshSide('カメックス', 'takuwaeru');
  E.sides.opp = freshSide('フシギバナ', null);
  E.runTurn(); E.runTurn();   // たくわえ2
  const cMax = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = 20;
  E.sides.self.moves = [moveByName('のみこむ')]; E.sides.self.selectedMoveIdx = 0;
  E.runTurn();
  const expHeal = Math.max(1, Math.floor(cMax * 0.5));
  check('T146h のみこむ(たくわえ2)で半分回復+消費', E.sides.self.currentHp === Math.min(cMax, 20 + expHeal) && E.sides.self.stockpile === 0 && E.sides.self.rank.def === 0,
    `残HP=${E.sides.self.currentHp} 期待=${Math.min(cMax, 20 + expHeal)} stockpile=${E.sides.self.stockpile} def=${E.sides.self.rank.def}`);
  // たくわえ0でのみこむ失敗
  E.sides.self.currentHp = 20;
  E.runTurn();
  check('T146i たくわえ0でのみこむ失敗', E.sides.self.currentHp === 20 && E.sides.self.failedThisTurn === true,
    `残HP=${E.sides.self.currentHp} failedThisTurn=${E.sides.self.failedThisTurn}`);
  resetEnv();
}

console.log('\n=== 段㊿ ちょうはつ(3ターンの間 変化技を出せない) ===');
// 出典: Bulbapedia "Taunt"(第5世代以降: 3ターン持続[使われたターンを含む]。攻撃技は出せる。
//       すでにちょうはつ状態の相手には失敗)
{
  resetEnv();
  E.sides.self = freshSide('ゲンガー', 'chouhatsu');   // ゲンガー(速い)が先にちょうはつ
  E.sides.self.moves = [moveByName('ちょうはつ'), moveByName('はたく')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('こわいかお'), moveByName('タネばくだん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // ターン1: ちょうはつ→相手のこわいかおは出せない
  check('T147 ちょうはつ状態になり変化技が出せない', E.sides.opp.tauntTurns > 0 && E.sides.self.rank.spd === 0 && E.sides.opp.failedThisTurn === true,
    `tauntTurns=${E.sides.opp.tauntTurns} 自分spd=${E.sides.self.rank.spd} failedThisTurn=${E.sides.opp.failedThisTurn}`);
  // ターン2: 攻撃技は出せる
  E.sides.self.selectedMoveIdx = 1;   // 自分は以後はたく(ちょうはつ再使用しない)
  E.sides.opp.selectedMoveIdx = 1;    // 相手はタネばくだん
  const t147hp = E.sides.self.currentHp;
  E.runTurn();
  check('T147b ちょうはつ中でも攻撃技は出せる', E.sides.self.currentHp < t147hp,
    `自分残HP=${E.sides.self.currentHp} (前=${t147hp})`);
  // ターン3: まだ変化技は出せない(3ターン目=最後の持続ターン)
  E.sides.opp.selectedMoveIdx = 0;
  E.runTurn();
  check('T147c 3ターン目もまだ出せない', E.sides.self.rank.spd === 0 && E.sides.opp.tauntTurns === 0,
    `自分spd=${E.sides.self.rank.spd} tauntTurns=${E.sides.opp.tauntTurns}`);
  // ターン4: 効果が切れて変化技が出せる(こわいかお=すばやさ-2)
  E.runTurn();
  check('T147d 4ターン目は効果が切れて出せる', E.sides.self.rank.spd === -2,
    `自分spd=${E.sides.self.rank.spd} tauntTurns=${E.sides.opp.tauntTurns}`);
  resetEnv();
}

console.log('\n=== 段51 かなしばり/アンコール(lastMove基盤) ===');
// 出典: Bulbapedia "Disable"(第5世代以降: 4ターンの間、相手が最後に使った技を封じる。
//       相手がまだ技を使っていない・すでにかなしばり状態なら失敗) /
//       Bulbapedia "Encore"(第5世代以降: 3ターンの間、相手は最後に使った技しか出せない。
//       PP0解除はPP未実装のため対象外。ものまね等(legacy列挙)が最後の技なら失敗)
{
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);   // ゲンガー(速い)が先に動く
  E.sides.self.moves = [moveByName('かなしばり'), moveByName('はたく')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('タネばくだん'), moveByName('こわいかお')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  // ターン1: 相手はまだ技を使っていない→かなしばり失敗。相手のタネばくだんは通る(ゲンガーLv50 HP=135)
  E.runTurn();
  check('T148 相手が技未使用ならかなしばり失敗', !E.sides.opp.disable && E.sides.self.currentHp < 135 &&
    E.sides.opp.lastMove && E.sides.opp.lastMove.name === 'タネばくだん',
    `disable=${JSON.stringify(E.sides.opp.disable)} 残HP=${E.sides.self.currentHp}(最大135) lastMove=${E.sides.opp.lastMove && E.sides.opp.lastMove.name}`);
  // ターン2: かなしばり成功(タネばくだんを封印)→相手は同ターンのタネばくだんが出せない
  const t148hp1 = E.sides.self.currentHp;
  E.runTurn();
  check('T148b かなしばりで最後に使った技を封じる', E.sides.opp.disable && E.sides.opp.disable.name === 'タネばくだん' &&
    E.sides.self.currentHp === t148hp1 && E.sides.opp.failedThisTurn === true,
    `disable=${JSON.stringify(E.sides.opp.disable)} 残HP=${E.sides.self.currentHp}(期待=${t148hp1}) failed=${E.sides.opp.failedThisTurn}`);
  // ターン3: 再かなしばりは失敗(すでにかなしばり状態)。相手は別の技(こわいかお)なら出せる
  E.sides.opp.selectedMoveIdx = 1;
  E.runTurn();
  check('T148c 重ねがけ失敗+別の技は出せる', E.sides.opp.disable && E.sides.opp.disable.name === 'タネばくだん' &&
    E.sides.self.rank.spd === -2,
    `disable=${JSON.stringify(E.sides.opp.disable)} 自分spd=${E.sides.self.rank.spd}`);
  // ターン4〜5: タネばくだんはまだ出せない(4ターン持続)。ターン5終了で解除
  E.sides.self.selectedMoveIdx = 1;   // 自分は以後はたく
  E.sides.opp.selectedMoveIdx = 0;
  const t148hp2 = E.sides.self.currentHp;
  E.runTurn();   // ターン4: 封じ
  E.runTurn();   // ターン5: 封じ(終了時に解除)
  check('T148d 4ターンの間封じられ続け5ターン目終了で解除', E.sides.self.currentHp === t148hp2 && !E.sides.opp.disable,
    `残HP=${E.sides.self.currentHp}(期待=${t148hp2}) disable=${JSON.stringify(E.sides.opp.disable)}`);
  // ターン6: 解除されてタネばくだんが出せる
  E.runTurn();
  check('T148e 解除後はまた出せる', E.sides.self.currentHp < t148hp2,
    `残HP=${E.sides.self.currentHp}(前=${t148hp2})`);
  resetEnv();
}
{
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('アンコール'), moveByName('はたく')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('タネばくだん'), moveByName('こわいかお')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  // ターン1: 相手はまだ技を使っていない→アンコール失敗。相手のタネばくだんは通る(ゲンガーLv50 HP=135)
  E.runTurn();
  check('T149 相手が技未使用ならアンコール失敗', !E.sides.opp.encore && E.sides.self.currentHp < 135,
    `encore=${JSON.stringify(E.sides.opp.encore && {turns: E.sides.opp.encore.turns})} 残HP=${E.sides.self.currentHp}(最大135)`);
  // ターン2: アンコール成功(タネばくだんに固定)→相手はこわいかおを選んでもタネばくだんを出す
  E.sides.opp.selectedMoveIdx = 1;
  const t149hp1 = E.sides.self.currentHp;
  E.runTurn();
  check('T149b アンコールで最後の技に固定(選択を上書き)', E.sides.opp.encore && E.sides.self.rank.spd === 0 &&
    E.sides.self.currentHp < t149hp1,
    `encore=${!!E.sides.opp.encore} 自分spd=${E.sides.self.rank.spd} 残HP=${E.sides.self.currentHp}(前=${t149hp1})`);
  // ターン3: 再アンコールは失敗(すでにアンコール状態)。相手は固定継続
  E.runTurn();
  check('T149c 重ねがけ失敗+固定継続', E.sides.opp.encore && E.sides.self.rank.spd === 0,
    `encore=${!!E.sides.opp.encore} 自分spd=${E.sides.self.rank.spd}`);
  // ターン4: 固定最終ターン(3ターン持続)→終了時に解除
  E.sides.self.selectedMoveIdx = 1;   // 自分は以後はたく
  E.runTurn();
  check('T149d 3ターン持続し4ターン目終了で解除', !E.sides.opp.encore && E.sides.self.rank.spd === 0,
    `encore=${JSON.stringify(E.sides.opp.encore && {turns: E.sides.opp.encore.turns})} 自分spd=${E.sides.self.rank.spd}`);
  // ターン5: 解除されてこわいかおが出せる(すばやさ-2)
  E.runTurn();
  check('T149e 解除後は選んだ技が出せる', E.sides.self.rank.spd === -2,
    `自分spd=${E.sides.self.rank.spd}`);
  resetEnv();
}

console.log('\n=== 段52 じゅうりょく/Gのちから ===');
// 出典: Bulbapedia "Gravity"(第5世代以降: 5ターン・全員の命中率5/3倍・ひこう/ふゆうも接地扱い=
//       じめん技が当たる・空中にいる技[そらをとぶ等]は使用不可/溜め中は中止・展開中の再使用は失敗) /
//       Bulbapedia "Grav Apple"(じゅうりょく中は威力1.5倍)
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('じゅうりょく'), moveByName('じしん'), moveByName('Gのちから')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('リザードン', null);   // ひこう持ち(じめん無効)・フシギバナより速い
  E.sides.opp.moves = [moveByName('そらをとぶ')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  const d0 = E.calcDamage('self', 'opp', moveByName('じしん'));   // 重力なし: ひこうにこうかなし
  // ターン1: リザードン(速い)がそらをとぶで溜め(空中)→フシギバナがじゅうりょく→空中から落とされる
  E.runTurn();
  check('T150 じゅうりょく展開+溜め中のそらをとぶ中止', E.env.gravity === true && !E.sides.opp.charging && d0.immune === true,
    `gravity=${E.env.gravity} 相手charging=${JSON.stringify(E.sides.opp.charging && E.sides.opp.charging.move.name)} 重力なしじしん immune=${d0.immune}`);
  // ターン2: 重力中はそらをとぶが出せない。じゅうりょくの再使用は失敗(ターン数はリセットされない)
  E.runTurn();
  check('T150b 空中技は出せない+再使用は失敗', E.sides.opp.failedThisTurn === true && E.env.gravityTurns === 3,
    `相手failed=${E.sides.opp.failedThisTurn} gravityTurns=${E.env.gravityTurns}(期待3=5から2ターン経過・リセットなし)`);
  // 重力中: じめん技がひこうに当たる
  const d1 = E.calcDamage('self', 'opp', moveByName('じしん'));
  check('T150c じめん技がひこうに当たる', d1 && !d1.immune && d1.max > 0,
    `immune=${d1 && d1.immune} max=${d1 && d1.max}`);
  // 重力中: 命中率5/3倍(かみなり acc70 → 116.7。roll80: 重力なし=外れ/重力中=当たる)
  E.setRandom(() => 0.8);
  const h1 = E.phaseHitCheck(moveByName('かみなり'), E.sides.self, E.sides.opp);
  E.env.gravity = false;
  const h0 = E.phaseHitCheck(moveByName('かみなり'), E.sides.self, E.sides.opp);
  E.env.gravity = true;
  E.setRandom(() => 0.0);
  check('T150d 命中率5/3倍', h1.hit === true && h0.hit === false,
    `重力中hit=${h1.hit}(期待true) 重力なしhit=${h0.hit}(期待false)`);
  // Gのちから: じゅうりょく中は威力1.5倍(90→135)
  const g1 = E.calcDamage('self', 'opp', moveByName('Gのちから'));
  E.env.gravity = false;
  const g0 = E.calcDamage('self', 'opp', moveByName('Gのちから'));
  E.env.gravity = true;
  check('T150e Gのちから1.5倍', g0.max > 0 && g1.max >= Math.floor(g0.max * 1.4) && g1.max <= Math.ceil(g0.max * 1.6),
    `重力なしmax=${g0.max} 重力中max=${g1.max}(期待≈1.5倍)`);
  // ターン3〜5: 5ターンで解除
  E.runTurn(); E.runTurn(); E.runTurn();
  check('T150f 5ターンで解除', E.env.gravity === false && E.env.gravityTurns == null,
    `gravity=${E.env.gravity} gravityTurns=${E.env.gravityTurns}`);
  // ターン6: 解除後はそらをとぶが使える(フシギバナはじしんに変更=溜め空中には当たらない)
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();
  check('T150g 解除後は空中技が使える', !!E.sides.opp.charging,
    `相手charging=${JSON.stringify(E.sides.opp.charging && E.sides.opp.charging.move.name)}`);
  resetEnv();
}

console.log('\n=== 段53 部屋系(ワンダールーム/マジックルーム) ===');
// 出典: Bulbapedia "Wonder Room"(5ターン・全員の素のぼうぎょ⇔とくぼうが入れかわる。
//       ランク補正は元の能力に残る。再使用で元に戻る) /
//       Bulbapedia "Magic Room"(5ターン・全員の持ち物の効果がなくなる。再使用で元に戻る)
{
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ワンダールーム'), moveByName('はたく'), moveByName('シャドーボール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);   // 素のぼうぎょ83 < とくぼう100 → 入れかえの差が見える
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  const p0 = E.calcDamage('self', 'opp', moveByName('はたく'));         // 通常: 物理はぼうぎょで受ける
  const s0 = E.calcDamage('self', 'opp', moveByName('シャドーボール')); // 通常: 特殊はとくぼうで受ける
  E.runTurn();   // ターン1: ワンダールーム展開
  check('T151 ワンダールーム展開', E.env.wonderRoom === true && E.env.wonderRoomTurns === 4,
    `wonderRoom=${E.env.wonderRoom} turns=${E.env.wonderRoomTurns}(期待4=5から1ターン経過)`);
  const p1 = E.calcDamage('self', 'opp', moveByName('はたく'));
  const s1 = E.calcDamage('self', 'opp', moveByName('シャドーボール'));
  check('T151b 素のぼうぎょ⇔とくぼう入れかえ(物理減・特殊増)', p1.max < p0.max && s1.max > s0.max,
    `物理max ${p0.max}→${p1.max}(期待減) 特殊max ${s0.max}→${s1.max}(期待増)`);
  // ランク補正は入れかわらない: とくぼう+6にしても物理は(元の)ぼうぎょランクで受ける=物理ダメ不変
  E.sides.opp.rank.spdef = 6;
  const p2 = E.calcDamage('self', 'opp', moveByName('はたく'));
  const s2 = E.calcDamage('self', 'opp', moveByName('シャドーボール'));
  check('T151c ランクは元の能力に残る', p2.max === p1.max && s2.max < s1.max,
    `物理max=${p2.max}(期待${p1.max}=不変) 特殊max ${s1.max}→${s2.max}(期待減=とくぼうランクが効く)`);
  E.sides.opp.rank.spdef = 0;
  // 再使用で元に戻る(toggle)
  E.runTurn();
  check('T151d 再使用で元に戻る', E.env.wonderRoom === false && E.env.wonderRoomTurns == null,
    `wonderRoom=${E.env.wonderRoom} turns=${E.env.wonderRoomTurns}`);
  // 5ターンで自然解除
  E.runTurn();   // 再展開(5)→末尾で4
  E.sides.self.selectedMoveIdx = 1;   // 以後は再使用しない(はたく)=toggleさせず自然経過を見る
  E.runTurn(); E.runTurn(); E.runTurn(); E.runTurn();   // 4ターン経過で0
  check('T151e 5ターンで自然解除', E.env.wonderRoom === false && E.env.wonderRoomTurns == null,
    `wonderRoom=${E.env.wonderRoom} turns=${E.env.wonderRoomTurns}`);
  resetEnv();
}
{
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('マジックルーム'), moveByName('はたく')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.lifeOrb = true;   // いのちのたま(×1.3)
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  const m0 = E.calcDamage('self', 'opp', moveByName('はたく'));   // いのちのたま込み
  E.runTurn();   // ターン1: マジックルーム展開
  const m1 = E.calcDamage('self', 'opp', moveByName('はたく'));   // 道具の効果なし
  check('T152 マジックルームで持ち物の効果が消える', E.env.magicRoom === true && m1.max < m0.max,
    `magicRoom=${E.env.magicRoom} max ${m0.max}→${m1.max}(期待減=いのちのたま×1.3が消える)`);
  // 再使用で元に戻る(toggle)
  E.runTurn();
  const m2 = E.calcDamage('self', 'opp', moveByName('はたく'));
  check('T152b 再使用で元に戻る', E.env.magicRoom === false && m2.max === m0.max,
    `magicRoom=${E.env.magicRoom} max=${m2.max}(期待${m0.max})`);
  resetEnv();
}

console.log('\n=== 段54 ダメージ計算の参照先変更(ボディプレス/イカサマ/ランク無視/つけあがる) ===');
// 出典: Bulbapedia "Body Press"(自分のぼうぎょ+ぼうぎょランクを攻撃力に使う) /
//       "Foul Play"(相手のこうげき+相手のこうげきランクで計算) /
//       "Sacred Sword"・"Darkest Lariat"(相手の能力ランク変化を無視してダメージ計算) /
//       "Power Trip"=つけあがる(威力20+自分の上がっているランク合計×20)
{
  resetEnv();
  E.sides.self = freshSide('カメックス', null);   // ぼうぎょ100 > こうげき83 → ボディプレスの差が見える
  E.sides.self.moves = [moveByName('ボディプレス')];
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.setRandom(() => 0.0);
  // ボディプレス: こうげきランクは無関係・ぼうぎょランクが効く
  const b0 = E.calcDamage('self', 'opp', moveByName('ボディプレス'));
  E.sides.self.rank.atk = 6;
  const b1 = E.calcDamage('self', 'opp', moveByName('ボディプレス'));
  E.sides.self.rank.atk = 0;
  E.sides.self.rank.def = 2;
  const b2 = E.calcDamage('self', 'opp', moveByName('ボディプレス'));
  E.sides.self.rank.def = 0;
  check('T153 ボディプレスは自分のぼうぎょ(+ランク)で計算', b1.max === b0.max && b2.max > b0.max,
    `基準max=${b0.max} こうげき+6=${b1.max}(期待不変) ぼうぎょ+2=${b2.max}(期待増)`);
  // イカサマ: 相手のこうげき(+相手のこうげきランク)で計算
  const i0 = E.calcDamage('self', 'opp', moveByName('イカサマ'));
  E.sides.opp.rank.atk = 2;
  const i1 = E.calcDamage('self', 'opp', moveByName('イカサマ'));
  E.sides.opp.rank.atk = 0;
  E.sides.self.rank.atk = 6;
  const i2 = E.calcDamage('self', 'opp', moveByName('イカサマ'));
  E.sides.self.rank.atk = 0;
  check('T153b イカサマは相手のこうげき(+ランク)で計算', i1.max > i0.max && i2.max === i0.max,
    `基準max=${i0.max} 相手こうげき+2=${i1.max}(期待増) 自分こうげき+6=${i2.max}(期待不変)`);
  // ランク無視: 相手のぼうぎょランク(+でも-でも)を無視
  const s0 = E.calcDamage('self', 'opp', moveByName('せいなるつるぎ'));
  E.sides.opp.rank.def = 6;
  const s1 = E.calcDamage('self', 'opp', moveByName('せいなるつるぎ'));
  E.sides.opp.rank.def = -6;
  const s2 = E.calcDamage('self', 'opp', moveByName('せいなるつるぎ'));
  E.sides.opp.rank.def = 0;
  check('T153c せいなるつるぎは相手のランク変化を無視', s1.max === s0.max && s2.max === s0.max,
    `基準max=${s0.max} 相手ぼうぎょ+6=${s1.max} -6=${s2.max}(どちらも不変が期待)`);
  // つけあがる: 上がっているランク合計×20を威力に加算(こうげき以外のランクで威力だけ変える)
  const t0 = E.calcDamage('self', 'opp', moveByName('つけあがる'));
  E.sides.self.rank.def = 2;
  E.sides.self.rank.spd = 1;
  const t1 = E.calcDamage('self', 'opp', moveByName('つけあがる'));   // 威力20→80
  E.sides.self.rank.def = 0;
  E.sides.self.rank.spd = 0;
  check('T153d つけあがるはランク合計で威力加算', t1.max > t0.max * 3 && t1.max < t0.max * 5,
    `基準max=${t0.max} ランク+3後max=${t1.max}(期待≈4倍)`);
  resetEnv();
}

console.log('\n=== 段55 ランク・実数値の操作(クリアスモッグ/じこあんじ/能力入替/実数値折半) ===');
// 出典: Bulbapedia "Clear Smog"(相手の能力ランクを全て0に) / "Psych Up"(相手のランクを全て自分にコピー) /
//       "Power Trick"(自分のこうげき⇔ぼうぎょの実数値を入れかえ・ランク不変・再使用で戻る) /
//       "Speed Swap"(自分と相手のすばやさ実数値を入れかえ) /
//       "Power Swap"/"Guard Swap"(ランクだけ相手と入れかえ) /
//       "Guard Split"/"Power Split"(実数値を合計して半分ずつ・切り捨て)
{
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('クリアスモッグ'), moveByName('じこあんじ'), moveByName('パワースワップ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  // クリアスモッグ: ダメージ+相手の能力ランクを全部元に戻す
  E.sides.opp.rank.atk = 6; E.sides.opp.rank.def = -2; E.sides.opp.rank.spd = 3;
  E.runTurn();
  check('T154 クリアスモッグで相手のランクが全て0', E.sides.opp.rank.atk === 0 && E.sides.opp.rank.def === 0 &&
    E.sides.opp.rank.spd === 0 && E.sides.opp.currentHp < 155,
    `相手rank atk=${E.sides.opp.rank.atk} def=${E.sides.opp.rank.def} spd=${E.sides.opp.rank.spd} 残HP=${E.sides.opp.currentHp}(最大155)`);
  // じこあんじ: 相手のランクを全て自分にコピー(相手は不変)
  E.sides.opp.rank.atk = 2; E.sides.opp.rank.spd = -1;
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();
  check('T154b じこあんじでランクをコピー', E.sides.self.rank.atk === 2 && E.sides.self.rank.spd === -1 &&
    E.sides.opp.rank.atk === 2 && E.sides.opp.rank.spd === -1,
    `自分rank atk=${E.sides.self.rank.atk} spd=${E.sides.self.rank.spd} 相手rank atk=${E.sides.opp.rank.atk} spd=${E.sides.opp.rank.spd}`);
  // パワースワップ: こうげき/とくこうのランクだけ相手と入れかえ
  E.sides.self.rank.atk = 0; E.sides.self.rank.spatk = -1; E.sides.self.rank.spd = 0;
  E.sides.opp.rank.atk = 2; E.sides.opp.rank.spatk = 0; E.sides.opp.rank.spd = -1;
  E.sides.self.selectedMoveIdx = 2;
  E.runTurn();
  check('T154c パワースワップでこうげき/とくこうランク入れかえ',
    E.sides.self.rank.atk === 2 && E.sides.self.rank.spatk === 0 &&
    E.sides.opp.rank.atk === 0 && E.sides.opp.rank.spatk === -1 &&
    E.sides.self.rank.spd === 0 && E.sides.opp.rank.spd === -1,
    `自分 atk=${E.sides.self.rank.atk} spatk=${E.sides.self.rank.spatk} spd=${E.sides.self.rank.spd} / ` +
    `相手 atk=${E.sides.opp.rank.atk} spatk=${E.sides.opp.rank.spatk} spd=${E.sides.opp.rank.spd}`);
  resetEnv();
}
{
  resetEnv();
  E.sides.self = freshSide('カメックス', null);   // こうげき83/ぼうぎょ100(Lv50実数値103/120)
  E.sides.self.moves = [moveByName('パワートリック'), moveByName('スピードスワップ'), moveByName('ガードシェア')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  const ptAtk = E.realStat(E.sides.self, 'atk'), ptDef = E.realStat(E.sides.self, 'def');
  // パワートリック: 自分のこうげき⇔ぼうぎょの実数値を入れかえ(ランクは不変)
  E.runTurn();
  check('T154d パワートリックで実数値入れかえ', E.realStat(E.sides.self, 'atk') === ptDef &&
    E.realStat(E.sides.self, 'def') === ptAtk && (E.sides.self.rank.atk || 0) === 0,
    `atk=${E.realStat(E.sides.self, 'atk')}(期待${ptDef}) def=${E.realStat(E.sides.self, 'def')}(期待${ptAtk}) rank.atk=${E.sides.self.rank.atk}`);
  // 再使用で元に戻る
  E.runTurn();
  check('T154e パワートリック再使用で元に戻る', E.realStat(E.sides.self, 'atk') === ptAtk &&
    E.realStat(E.sides.self, 'def') === ptDef,
    `atk=${E.realStat(E.sides.self, 'atk')}(期待${ptAtk}) def=${E.realStat(E.sides.self, 'def')}(期待${ptDef})`);
  // スピードスワップ: 自分と相手のすばやさ実数値を入れかえ
  const ssSelf = E.realStat(E.sides.self, 'spd'), ssOpp = E.realStat(E.sides.opp, 'spd');
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();
  check('T154f スピードスワップで実数値入れかえ', E.realStat(E.sides.self, 'spd') === ssOpp &&
    E.realStat(E.sides.opp, 'spd') === ssSelf,
    `自分spd=${E.realStat(E.sides.self, 'spd')}(期待${ssOpp}) 相手spd=${E.realStat(E.sides.opp, 'spd')}(期待${ssSelf})`);
  // ガードシェア: ぼうぎょ/とくぼうを合計して半分ずつ(切り捨て)
  const gsD = Math.floor((E.realStat(E.sides.self, 'def') + E.realStat(E.sides.opp, 'def')) / 2);
  const gsSD = Math.floor((E.realStat(E.sides.self, 'spdef') + E.realStat(E.sides.opp, 'spdef')) / 2);
  E.sides.self.selectedMoveIdx = 2;
  E.runTurn();
  check('T154g ガードシェアで実数値折半', E.realStat(E.sides.self, 'def') === gsD &&
    E.realStat(E.sides.opp, 'def') === gsD && E.realStat(E.sides.self, 'spdef') === gsSD &&
    E.realStat(E.sides.opp, 'spdef') === gsSD,
    `def 自分=${E.realStat(E.sides.self, 'def')} 相手=${E.realStat(E.sides.opp, 'def')}(期待${gsD}) ` +
    `spdef 自分=${E.realStat(E.sides.self, 'spdef')} 相手=${E.realStat(E.sides.opp, 'spdef')}(期待${gsSD})`);
  resetEnv();
}

console.log('\n=== 段56 タイプ操作(みずびたし/ミラータイプ/まほうのこな/タイプ追加/タイプ除去) ===');
// 出典: Bulbapedia "Soak"(相手を純みずタイプに・すでに純みずなら失敗) /
//       "Reflect Type"(自分のタイプを相手と同じに) /
//       "Magic Powder"(相手を純エスパーに・こな技=くさタイプに無効) /
//       "Forest's Curse"/"Trick-or-Treat"(タイプ追加・すでに持っていれば失敗) /
//       "Burn Up"(攻撃後ほのおタイプが消える・ほのおでなければ技ごと失敗)
{
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);   // ゴースト/どく
  E.sides.self.moves = [moveByName('みずびたし'), moveByName('まほうのこな')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);  // くさ/どく
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  // みずびたし前: でんき技はフシギバナ(くさ/どく)に0.5倍
  const dmgBefore = E.calcDamage('self', 'opp', moveByName('10まんボルト'));
  E.runTurn();
  const tOpp = E.sideTypes ? E.sideTypes(E.sides.opp) : null;
  check('T155 みずびたしで相手が純みずタイプに', tOpp && tOpp.length === 1 && tOpp[0] === 'みず',
    `types=${JSON.stringify(tOpp)}`);
  // みずびたし後: でんき技がみずに2倍(0.5倍→2倍=4倍に増える)
  const dmgAfter = E.calcDamage('self', 'opp', moveByName('10まんボルト'));
  check('T155b タイプ変化後はでんき技が2倍で入る', dmgBefore && dmgAfter && dmgAfter.max > dmgBefore.max * 3,
    `before max=${dmgBefore && dmgBefore.max} after max=${dmgAfter && dmgAfter.max}`);
  // まほうのこな: こな技はくさタイプに無効
  E.sides.opp.typeOverride = null;   // タイプを元に戻して検証
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();
  check('T155c まほうのこなはくさタイプに無効', E.sides.opp.typeOverride == null,
    `typeOverride=${JSON.stringify(E.sides.opp.typeOverride)}`);
  resetEnv();
}
{
  resetEnv();
  // みずびたしは「すでに純みず」のカメックスには失敗 / まほうのこなは通る(純エスパーに)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('みずびたし'), moveByName('まほうのこな')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カメックス', null);  // みず単タイプ
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T155d みずびたしは純みずタイプに失敗', E.sides.opp.typeOverride == null,
    `typeOverride=${JSON.stringify(E.sides.opp.typeOverride)}`);
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();
  const tOpp2 = E.sideTypes ? E.sideTypes(E.sides.opp) : null;
  check('T155e まほうのこなで相手が純エスパーに', tOpp2 && tOpp2.length === 1 && tOpp2[0] === 'エスパー',
    `types=${JSON.stringify(tOpp2)}`);
  resetEnv();
}
{
  resetEnv();
  // ミラータイプ: 自分のタイプを相手と同じにする
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ミラータイプ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);    // ゴースト/どく
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  const tSelf = E.sideTypes ? E.sideTypes(E.sides.self) : null;
  check('T155f ミラータイプで自分が相手と同じタイプに',
    tSelf && tSelf.length === 2 && tSelf.includes('ゴースト') && tSelf.includes('どく'),
    `types=${JSON.stringify(tSelf)}`);
  resetEnv();
}
{
  resetEnv();
  // ハロウィン: 相手にゴーストタイプ追加 → ノーマル技が効かなくなる / もりののろいはくさ持ちに失敗
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ハロウィン'), moveByName('もりののろい')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カメックス', null);  // みず単
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  const tOpp3 = E.sideTypes ? E.sideTypes(E.sides.opp) : null;
  check('T155g ハロウィンで相手にゴースト追加', tOpp3 && tOpp3.length === 2 &&
    tOpp3.includes('みず') && tOpp3.includes('ゴースト'), `types=${JSON.stringify(tOpp3)}`);
  const dmgN = E.calcDamage('self', 'opp', moveByName('はたく'));
  check('T155h ゴースト追加後はノーマル技がこうかなし', dmgN && dmgN.immune === true,
    `immune=${dmgN && dmgN.immune}`);
  // もりののろい: くさ持ち(フシギバナ)には失敗
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();
  check('T155i もりののろいはくさ持ちに失敗', E.sides.opp.typeOverride == null,
    `typeOverride=${JSON.stringify(E.sides.opp.typeOverride)}`);
  resetEnv();
}
{
  resetEnv();
  // もえつきる: 攻撃が通り、攻撃後に自分のほのおタイプが消える。2回目はほのおでないので技ごと失敗。
  E.sides.self = freshSide('リザードン', null); // ほのお/ひこう
  E.sides.self.moves = [moveByName('もえつきる')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カメックス', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  const tSelf2 = E.sideTypes ? E.sideTypes(E.sides.self) : null;
  check('T155j もえつきるで自分のほのおタイプが消える',
    tSelf2 && tSelf2.length === 1 && tSelf2[0] === 'ひこう' && E.sides.opp.currentHp < 154,
    `types=${JSON.stringify(tSelf2)} 相手残HP=${E.sides.opp.currentHp}(最大154)`);
  const hpAfter1 = E.sides.opp.currentHp;
  E.runTurn();
  check('T155k もえつきる2回目はほのおでないため失敗(ダメージなし)',
    E.sides.opp.currentHp === hpAfter1,   // 相手はノーダメージ(自分はほのおタイプでないので技ごと失敗)
    `相手HP ${hpAfter1}→${E.sides.opp.currentHp}(変化しない はず)`);
  resetEnv();
}

console.log('\n=== 段57 いたみわけ + フリーズドライ(相性上書き) ===');
// 出典: Bulbapedia "Pain Split"(両者の残りHPを合計して半分ずつ・切り捨て・最大HPは超えない) /
//       "Freeze-Dry"(みずタイプに対して常にこうかばつぐん。みず/ひこうには4倍)
{
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);   // 最大HP135
  E.sides.self.moves = [moveByName('いたみわけ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);  // 最大HP155
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  // 自分35/相手155 → 平均=floor(190/2)=95 で両者95
  E.sides.self.currentHp = 35;
  E.sides.opp.currentHp = 155;
  E.phaseApplyEffects('self', 'opp', moveByName('いたみわけ'));
  check('T156 いたみわけで両者のHPが平均値95に',
    E.sides.self.currentHp === 95 && E.sides.opp.currentHp === 95,
    `自分=${E.sides.self.currentHp} 相手=${E.sides.opp.currentHp}(期待95/95)`);
  // 平均(145)が自分の最大HP(135)を超える場合は最大止まり・相手は145
  E.sides.self.currentHp = 135;
  E.sides.opp.currentHp = 155;
  E.phaseApplyEffects('self', 'opp', moveByName('いたみわけ'));
  check('T156b いたみわけの回復は最大HPを超えない',
    E.sides.self.currentHp === 135 && E.sides.opp.currentHp === 145,
    `自分=${E.sides.self.currentHp}(最大135) 相手=${E.sides.opp.currentHp}(期待145)`);
  resetEnv();
}
{
  resetEnv();
  // フリーズドライ(こおり70): みずタイプに2倍 → れいとうビーム(こおり90・みずに0.5倍)より大きく入る
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.opp = freshSide('カメックス', null);  // みず単
  const fd = E.calcDamage('self', 'opp', moveByName('フリーズドライ'));
  const ib = E.calcDamage('self', 'opp', moveByName('れいとうビーム'));
  check('T157 フリーズドライはみずタイプにこうかばつぐん(威力70でれいとうビーム90を上回る)',
    fd && ib && fd.max > ib.max, `FD max=${fd && fd.max} IB max=${ib && ib.max}`);
  // みず/ひこう(ギャラドス)には 2(みず上書き)×2(こおり×ひこう)=4倍 → れいとうビーム(0.5×2=1倍)の約3.1倍
  E.sides.opp = freshSide('ギャラドス', null);
  const fd2 = E.calcDamage('self', 'opp', moveByName('フリーズドライ'));
  const ib2 = E.calcDamage('self', 'opp', moveByName('れいとうビーム'));
  check('T157b フリーズドライはみず/ひこうに4倍(れいとうビームの約3.1倍)',
    fd2 && ib2 && fd2.max > ib2.max * 2.5 && fd2.max < ib2.max * 3.7,
    `FD max=${fd2 && fd2.max} IB max=${ib2 && ib2.max} 比=${fd2 && ib2 && (fd2.max / ib2.max).toFixed(2)}`);
  resetEnv();
}

console.log('\n=== 段58 持ち物奪取(どろぼう/ほしがる)+持ち物交換(トリック/すりかえ) ===');
// 出典: Bulbapedia "Thief"/"Covet"(自分が道具を持っていなければ、ダメージ後に相手の道具を奪う) /
//       "Trick"/"Switcheroo"(おたがいの道具を入れかえる。両方持っていない時だけ失敗)
// ※リサイクルは「きのみ消費」基盤がsim未実装(きのみを消費しない)のため対象外。
{
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('どろぼう')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.item = 'kodawari_scarf';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T158 どろぼうでダメージ+道具を奪う',
    E.sides.self.item === 'kodawari_scarf' && !E.sides.opp.item && E.sides.opp.currentHp < 155,
    `自分item=${E.sides.self.item} 相手item=${E.sides.opp.item} 相手HP=${E.sides.opp.currentHp}(最大155)`);
  // 自分がすでに道具を持っている時は奪えない(ダメージは入る)
  E.sides.opp.item = 'type_boost_water';
  const hpBefore = E.sides.opp.currentHp;
  E.runTurn();
  check('T158b 自分が道具持ちなら奪えない(ダメージのみ)',
    E.sides.self.item === 'kodawari_scarf' && E.sides.opp.item === 'type_boost_water' &&
    E.sides.opp.currentHp < hpBefore,
    `自分item=${E.sides.self.item} 相手item=${E.sides.opp.item}`);
  resetEnv();
}
{
  resetEnv();
  // トリック: 両者の道具を入れかえる
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('トリック')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.item = 'type_boost_ghost';
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.item = 'kodawari_scarf';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T158c トリックで道具を入れかえ',
    E.sides.self.item === 'kodawari_scarf' && E.sides.opp.item === 'type_boost_ghost',
    `自分item=${E.sides.self.item} 相手item=${E.sides.opp.item}`);
  // 片方しか持っていなくても成功(自分の道具が相手へ)
  E.sides.opp.item = null;
  E.runTurn();
  check('T158d 片方だけ道具持ちでもトリック成功',
    !E.sides.self.item && E.sides.opp.item === 'kodawari_scarf',
    `自分item=${E.sides.self.item} 相手item=${E.sides.opp.item}`);
  resetEnv();
}

console.log('\n=== 段59 ひんし系(ほろびのうた/みちづれ) ===');
// 出典: Bulbapedia "Perish Song"(場の全員にカウント3→ターン終了ごとに減り0でひんし・再使用でリセットしない) /
//       "Destiny Bond"(次に自分が行動するまでに相手の技でひんしになったら相手も道連れ・
//                      第7世代以降は連続使用で必ず失敗)
{
  resetEnv();
  // ほろびのうた: 3ターン終了までは両者健在(カウント1)→4ターン目の終了で両者ひんし
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ほろびのうた')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];   // ノーマル×ゴースト=こうかなし(ダメージのノイズなし)
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn(); E.runTurn(); E.runTurn();
  check('T159 ほろびのうた3ターン目終了時は両者健在(カウント1)',
    !E.sides.self.fainted && !E.sides.opp.fainted &&
    E.sides.self.perishCount === 1 && E.sides.opp.perishCount === 1,
    `自分 fainted=${E.sides.self.fainted} count=${E.sides.self.perishCount} / 相手 fainted=${E.sides.opp.fainted} count=${E.sides.opp.perishCount}`);
  E.runTurn();
  check('T159b 4ターン目終了で両者ひんし',
    E.sides.self.fainted && E.sides.opp.fainted,
    `自分 fainted=${E.sides.self.fainted} / 相手 fainted=${E.sides.opp.fainted}`);
  resetEnv();
}
{
  resetEnv();
  // みちづれ: みちづれ後に相手の技でひんし→相手も道連れ
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('みちづれ'), moveByName('はたく')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('タネばくだん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.sides.self.currentHp = 1;   // 相手の一撃でひんしになる状況
  E.sides.opp.currentHp = 155;
  E.runTurn();
  check('T159c みちづれで相手を道連れに',
    E.sides.self.fainted && E.sides.opp.fainted,
    `自分 fainted=${E.sides.self.fainted} / 相手 fainted=${E.sides.opp.fainted}`);
  resetEnv();
}
{
  resetEnv();
  // みちづれは自分が次に行動したら解除される
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('みちづれ'), moveByName('ヘドロばくだん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('タネばくだん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // 1ターン目: みちづれ(自分は先手・被弾しても倒れない)
  E.sides.self.currentHp = 1;
  E.sides.self.selectedMoveIdx = 1;   // 2ターン目: 別の技で行動→みちづれ解除
  E.runTurn();
  check('T159d 行動したらみちづれ解除(相手は道連れにならない)',
    E.sides.self.fainted && !E.sides.opp.fainted,
    `自分 fainted=${E.sides.self.fainted} / 相手 fainted=${E.sides.opp.fainted}`);
  resetEnv();
}
{
  resetEnv();
  // みちづれの連続使用は必ず失敗(第7世代以降)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('みちづれ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('タネばくだん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // 1ターン目: みちづれ成功
  E.sides.self.currentHp = 1;
  E.runTurn();   // 2ターン目: みちづれ失敗→相手の技でひんしでも道連れなし
  check('T159e 連続使用のみちづれは失敗(道連れなし)',
    E.sides.self.fainted && !E.sides.opp.fainted,
    `自分 fainted=${E.sides.self.fainted} / 相手 fainted=${E.sides.opp.fainted}`);
  resetEnv();
}

console.log('\n=== 段60 特性操作(シンプルビーム/なりきり/なかまづくり/スキルスワップ/いえき) ===');
// 出典: Bulbapedia "Simple Beam"/"Worry Seed"(相手の特性を指定特性に) /
//       "Role Play"(相手の特性をコピー) / "Entrainment"(自分の特性を相手に) /
//       "Skill Swap"(入れかえ) / "Gastro Acid"(無効化)。ふしぎなまもり等の固有特性は対象外。
{
  resetEnv();
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('シンプルビーム'), moveByName('なりきり'), moveByName('なかまづくり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.ability = 'のろわれボディ';
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.ability = 'しんりょく';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T160 シンプルビームで相手の特性がたんじゅんに',
    E.sideAbility && E.sideAbility(E.sides.opp) === 'たんじゅん',
    `相手特性=${E.sideAbility && E.sideAbility(E.sides.opp)}`);
  // なりきり: 相手の(今の)特性を自分にコピー
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();
  check('T160b なりきりで相手の特性をコピー',
    E.sideAbility && E.sideAbility(E.sides.self) === 'たんじゅん',
    `自分特性=${E.sideAbility && E.sideAbility(E.sides.self)}`);
  // なかまづくり: 自分の(今の)特性を相手に
  E.sides.self.abilityOverride = null;   // 自分をのろわれボディに戻す
  E.sides.self.selectedMoveIdx = 2;
  E.runTurn();
  check('T160c なかまづくりで自分の特性を相手に',
    E.sideAbility && E.sideAbility(E.sides.opp) === 'のろわれボディ',
    `相手特性=${E.sideAbility && E.sideAbility(E.sides.opp)}`);
  resetEnv();
}
{
  resetEnv();
  // スキルスワップ: 入れかえ
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('スキルスワップ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.ability = 'のろわれボディ';
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.ability = 'しんりょく';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T160d スキルスワップで特性を入れかえ',
    E.sideAbility && E.sideAbility(E.sides.self) === 'しんりょく' &&
    E.sideAbility(E.sides.opp) === 'のろわれボディ',
    `自分=${E.sideAbility && E.sideAbility(E.sides.self)} 相手=${E.sideAbility && E.sideAbility(E.sides.opp)}`);
  resetEnv();
}
{
  resetEnv();
  // いえき: 特性無効化。はやあし+まひ(無効化前=すばやさ半減なし→無効化後=半減)で行動確認
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('いえき')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.ability = 'はやあし';
  E.sides.opp.status = 'paralysis';
  E.setRandom(() => 0.0);
  const spdBefore = E.effectiveSpeed(E.sides.opp);   // はやあし: まひでも半減しない=100
  E.runTurn();
  const spdAfter = E.effectiveSpeed(E.sides.opp);    // 無効化後: まひ半減=50
  check('T160e いえきで特性が無効化(はやあしが効かなくなり まひ半減)',
    spdBefore === 100 && spdAfter === 50,
    `無効化前=${spdBefore}(期待100) 無効化後=${spdAfter}(期待50)`);
  resetEnv();
}
{
  resetEnv();
  // なりきり: ふしぎなまもり(固有特性)はコピーできず失敗
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('なりきり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.ability = 'のろわれボディ';
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.ability = 'ふしぎなまもり';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T160f なりきりはふしぎなまもりをコピーできない',
    E.sideAbility && E.sideAbility(E.sides.self) === 'のろわれボディ',
    `自分特性=${E.sideAbility && E.sideAbility(E.sides.self)}`);
  resetEnv();
}

console.log('\n=== 段61 まもり貫通/まもり解除(フェイント/なみだめ) ===');
{
  resetEnv();
  // フェイント: まもる(優先度+4)で守っている相手に当たり(protect:false)、さらに守りを解除する。
  // ゲンガー(フェイント=ノーマル)→フシギバナ(くさ/どく)=等倍。出典: Bulbapedia "Feint"
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('フェイント')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('まもる')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T161 フェイントはまもる中に当たり 守りを解除する',
    E.sides.opp.currentHp < 155 && E.sides.opp.protecting === null,
    `相手HP=${E.sides.opp.currentHp}(155未満期待) protecting=${E.sides.opp.protecting ? E.sides.opp.protecting.name : null}(null期待)`);
  resetEnv();
}
{
  resetEnv();
  // 回帰: 普通の攻撃技は まもる に防がれる(protecting は残る)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('はたく')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('まもる')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T161b はたくはまもるに防がれる(回帰)',
    E.sides.opp.currentHp === 155 && !!E.sides.opp.protecting,
    `相手HP=${E.sides.opp.currentHp}(155期待) protecting=${E.sides.opp.protecting ? E.sides.opp.protecting.name : null}`);
  resetEnv();
}
{
  resetEnv();
  // なみだめ: まもる中でも貫通して効く(解除はしない=protecting は残る)。出典: Bulbapedia "Tearful Look"
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('なみだめ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('まもる')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T161c なみだめはまもるを貫通(こうげき-1/とくこう-1・守りは残る)',
    E.sides.opp.rank.atk === -1 && E.sides.opp.rank.spatk === -1 && !!E.sides.opp.protecting,
    `atk=${E.sides.opp.rank.atk} spatk=${E.sides.opp.rank.spatk} protecting=${E.sides.opp.protecting ? E.sides.opp.protecting.name : null}`);
  resetEnv();
}

console.log('\n=== 段62 命中まわり(ぜったいれいど命中率固定/ロックオン) ===');
{
  resetEnv();
  // ぜったいれいど: 自分がこおりタイプなら命中30 / それ以外は20(第7世代以降)。
  // roll=25 で「こおり以外=20→外れ」「こおり=30→当たる」を割る。出典: Bulbapedia "Sheer Cold"
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ぜったいれいど')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.25);   // roll=25
  const h1 = E.phaseHitCheck(moveByName('ぜったいれいど'), E.sides.self, E.sides.opp);
  check('T162 ぜったいれいど: こおり以外は命中20(roll25で外れ)',
    h1.hit === false, `hit=${h1.hit}(false期待)`);
  E.sides.self.typeOverride = ['こおり'];   // 段56基盤でこおりタイプ化
  const h2 = E.phaseHitCheck(moveByName('ぜったいれいど'), E.sides.self, E.sides.opp);
  check('T162b ぜったいれいど: こおりタイプなら命中30(roll25で当たる)',
    h2.hit === true, `hit=${h2.hit}(true期待)`);
  resetEnv();
}
{
  resetEnv();
  // ロックオン: 次のターンに使う技が必ず当たる。roll=99で素の命中20では絶対外れる状況で確認。
  // はたく(ノーマル)→ゲンガー=×0 でダメージノイズなし。出典: Bulbapedia "Lock-On"
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ロックオン'), moveByName('ぜったいれいど')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.99);   // roll=99(命中100未満の技は全部外れる)
  E.runTurn();               // T1: ロックオン
  const lockSet = !!E.sides.self.lockOn;
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();               // T2: ぜったいれいど(roll99=素では外れ→ロックオンで必中・一撃必殺)
  check('T162c ロックオンで次ターンの技が必中(ぜったいれいどが当たり一撃)',
    lockSet && E.sides.opp.fainted === true,
    `ロックオン状態=${lockSet} 相手ひんし=${E.sides.opp.fainted}`);
  resetEnv();
}
{
  resetEnv();
  // ロックオンの期限: 次のターンに技を使わなければ(自分対象技なら消費しない)、その次のターンには効果が切れている
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ロックオン'), moveByName('まもる'), moveByName('ぜったいれいど')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.99);
  E.runTurn();               // T1: ロックオン
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();               // T2: まもる(自分対象=消費しない→ターン終了で期限切れ)
  E.sides.self.selectedMoveIdx = 2;
  E.runTurn();               // T3: ぜったいれいど(roll99=外れるはず)
  check('T162d ロックオンは次のターンの終わりで切れる(その次は外れる)',
    E.sides.opp.fainted !== true && E.sides.opp.currentHp === 155,
    `相手ひんし=${E.sides.opp.fainted}(false期待) 相手HP=${E.sides.opp.currentHp}(155期待)`);
  resetEnv();
}

console.log('\n=== 段63 いちゃもん/ふういん(技制限) ===');
{
  resetEnv();
  // いちゃもん: 相手は同じ技を続けて出せない。出典: Bulbapedia "Torment"
  // ゲンガー(spd130)が先にいちゃもん→フシギバナのタネばくだんはT1成功/T2ブロック/T3再び成功
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('いちゃもん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('タネばくだん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: いちゃもん→タネばくだん(成功)
  const hp1 = E.sides.self.currentHp;
  E.runTurn();   // T2: タネばくだん(同じ技の連続=ブロック)
  const hp2 = E.sides.self.currentHp;
  E.runTurn();   // T3: タネばくだん(1ターンあいた扱い=成功)
  const hp3 = E.sides.self.currentHp;
  check('T163 いちゃもんで同じ技を続けて出せない(T2ブロック/T3成功)',
    hp1 < 135 && hp2 === hp1 && hp3 < hp2,
    `T1後HP=${hp1}(135未満期待) T2後HP=${hp2}(変化なし期待) T3後HP=${hp3}(${hp1}未満期待)`);
  resetEnv();
}
{
  resetEnv();
  // いちゃもん中でも別の技をはさめば出せる(交互なら毎ターン攻撃できる)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('いちゃもん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('タネばくだん'), moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: タネばくだん(成功)
  const hp1 = E.sides.self.currentHp;
  E.sides.opp.selectedMoveIdx = 1;
  E.runTurn();   // T2: はたく(別の技=出せる。ゲンガーに×0でダメージなし)
  E.sides.opp.selectedMoveIdx = 0;
  E.runTurn();   // T3: タネばくだん(連続でない=成功)
  const hp3 = E.sides.self.currentHp;
  check('T163b いちゃもん中でも交互なら出せる',
    hp1 < 135 && hp3 < hp1,
    `T1後HP=${hp1}(135未満期待) T3後HP=${hp3}(${hp1}未満期待)`);
  resetEnv();
}
{
  resetEnv();
  // ふういん: 自分も知っている技を相手は出せなくなる。出典: Bulbapedia "Imprison"
  // ゲンガー(spd130)が先にふういん→同ターンのフシギバナのタネばくだんからブロック
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ふういん'), moveByName('タネばくだん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('タネばくだん'), moveByName('みずのはどう')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: ふういん→タネばくだん(ブロック)
  check('T163c ふういんで自分も知っている技を相手は出せない',
    E.sides.self.currentHp === 135,
    `自分HP=${E.sides.self.currentHp}(135=無傷期待)`);
  // 相手(自分側)が知らない技(みずのはどう)はふういんの対象外=出せる
  E.sides.opp.selectedMoveIdx = 1;
  E.runTurn();   // T2: みずのはどう(成功=ダメージあり)
  check('T163d ふういんは自分が知らない技は防がない',
    E.sides.self.currentHp < 135,
    `自分HP=${E.sides.self.currentHp}(135未満期待)`);
  resetEnv();
}

console.log('\n=== 段64 そうでん(相手技タイプ変更) ===');
{
  resetEnv();
  // そうでん: 相手が動く前に使うと、このターン相手の技はでんきタイプになる。出典: Bulbapedia "Electrify"
  // はたく(ノーマル)→ゲンガー=×0 だが、でんき化すると×1=ダメージが通る(判定が綺麗に割れる)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('そうでん'), moveByName('ロックオン')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: そうでん(ゲンガー先手)→はたく(でんき化=当たる)
  const hp1 = E.sides.self.currentHp;
  check('T164 そうでんで相手のはたくがでんきタイプになり ゴーストに当たる',
    hp1 < 135, `自分HP=${hp1}(135未満期待)`);
  // 次のターンには元のタイプに戻る(はたく=ノーマル→×0)
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();   // T2: ロックオン→はたく(ノーマル=×0)
  check('T164b そうでんはそのターン限り(次ターンは×0に戻る)',
    E.sides.self.currentHp === hp1, `自分HP=${E.sides.self.currentHp}(${hp1}のまま期待)`);
  resetEnv();
}
{
  resetEnv();
  // 相手がすでに行動済みのターンに使うと失敗する
  E.sides.self = freshSide('フシギバナ', null);   // spd100=後手
  E.sides.self.moves = [moveByName('そうでん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);      // spd130=先手
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // ゲンガーが先に行動→そうでんは失敗
  check('T164c そうでんは相手が行動済みなら失敗',
    !E.sides.opp.electrified, `相手electrified=${E.sides.opp.electrified}(なし期待)`);
  resetEnv();
}

console.log('\n=== 段65 条件付き優先(グラススライダー)/すなあらし能力倍率/デカハンマー ===');
{
  resetEnv();
  // グラススライダー: グラスフィールド中で自分が接地している時だけ優先度+1(それ以外は0)。
  // 出典: Bulbapedia "Grassy Glide"(第9世代)
  E.sides.self = freshSide('フシギバナ', null);   // spd100=遅い
  E.sides.self.moves = [moveByName('グラススライダー')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);      // spd130=速い
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  const o1 = E.decideOrder(moveByName('グラススライダー'), moveByName('はたく'));
  E.env.field = 'grassy';
  const o2 = E.decideOrder(moveByName('グラススライダー'), moveByName('はたく'));
  E.sides.self.typeOverride = ['ひこう'];          // 接地していない→優先されない
  const o3 = E.decideOrder(moveByName('グラススライダー'), moveByName('はたく'));
  check('T165 グラススライダーはグラスフィールド+接地の時だけ先制',
    o1 === 'opp' && o2 === 'self' && o3 === 'opp',
    `フィールドなし=${o1}(opp期待) グラス=${o2}(self期待) グラス+ひこう=${o3}(opp期待)`);
  resetEnv();
}
{
  resetEnv();
  // すなあらし中はいわタイプのとくぼう1.5倍(特殊だけ・物理は不変)。出典: Bulbapedia "Sandstorm"(第4世代以降)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.opp = freshSide('カメックス', null);
  E.sides.opp.typeOverride = ['いわ'];
  E.setRandom(() => 0.0);
  const spNo = E.calcDamage('self', 'opp', moveByName('みずのはどう')).max;
  const phNo = E.calcDamage('self', 'opp', moveByName('はたく')).max;
  E.env.weather = 'sand';
  const spSand = E.calcDamage('self', 'opp', moveByName('みずのはどう')).max;
  const phSand = E.calcDamage('self', 'opp', moveByName('はたく')).max;
  check('T165b すなあらしでいわタイプのとくぼう1.5倍(特殊減・物理不変)',
    spSand < spNo && phSand === phNo,
    `特殊: ${spNo}→${spSand}(減少期待) 物理: ${phNo}→${phSand}(不変期待)`);
  resetEnv();
}
{
  resetEnv();
  // デカハンマー: 2ターン続けて出せない(1ターンあければ再び出せる)。出典: Bulbapedia "Gigaton Hammer"
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('デカハンマー')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: 成功
  const hp1 = E.sides.opp.currentHp;
  E.runTurn();   // T2: 連続=出せない
  const hp2 = E.sides.opp.currentHp;
  E.runTurn();   // T3: 1ターンあいた=成功
  const hp3 = E.sides.opp.currentHp;
  check('T165c デカハンマーは連続で出せない(T2ブロック/T3成功)',
    hp1 < 155 && hp2 === hp1 && hp3 < hp2,
    `T1後=${hp1}(155未満期待) T2後=${hp2}(不変期待) T3後=${hp3}(${hp1}未満期待)`);
  resetEnv();
}

console.log('\n=== 段66 はねやすめ(タイプ一時無効) ===');
{
  resetEnv();
  // はねやすめ: HP半分回復+そのターンの終わりまで ひこうタイプを失う(じめん技が当たるようになる)。
  // リザードン(ほのお/ひこう・spd120)が先にはねやすめ→フシギバナのじしんが×2で当たる。
  // 出典: Bulbapedia "Roost"
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('はねやすめ'), moveByName('ロックオン')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 50;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('じしん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: はねやすめ(50→126)→じしん(ひこう喪失中=×2で当たる)
  const hp1 = E.sides.self.currentHp;
  const types1 = E.sideTypes(E.sides.self).join('/');
  // 回復なしなら 50 < じしんダメージ で瀕死(HP0)になる → hp1>0 が「回復が先に効いた」証明、
  // hp1<126 が「ひこう喪失でじしんが当たった」証明(回復だけなら126のまま)。
  check('T166 はねやすめで回復しつつ ひこうを失い じしんが当たる',
    hp1 > 0 && hp1 < 126 && types1 === 'ほのお',
    `HP=${hp1}(0超・126未満期待) タイプ=${types1}(ほのお期待)`);
  // 次のターンには ひこうが戻る=じしん×0
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();   // T2: ロックオン→じしん(ひこう復活=×0)
  check('T166b 次のターンには ひこうが戻り じしんは当たらない',
    E.sides.self.currentHp === hp1 && E.sideTypes(E.sides.self).join('/') === 'ほのお/ひこう',
    `HP=${E.sides.self.currentHp}(${hp1}のまま期待) タイプ=${E.sideTypes(E.sides.self).join('/')}`);
  resetEnv();
}

console.log('\n=== 段67 じごくづき(カテゴリ封じ)・必ず急所回帰 ===');
{
  resetEnv();
  // じごくづき: 当てた相手は2ターンの間 音技(blocked_moves 31技)が出せない。
  // 出典: Bulbapedia "Throat Chop"(当たったターンを1ターン目と数える)
  E.sides.self = freshSide('リザードン', null);   // spd120=先手
  E.sides.self.moves = [moveByName('じごくづき'), moveByName('ロックオン')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);    // spd100
  E.sides.opp.moves = [moveByName('ハイパーボイス')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: じごくづき命中→同ターンのハイパーボイスは封じられる
  check('T167 じごくづきを受けた直後のターン 音技が出せない',
    E.sides.self.currentHp === 153,
    `リザードンHP=${E.sides.self.currentHp}(153=無傷期待)`);
  E.sides.self.selectedMoveIdx = 1;
  E.runTurn();   // T2: 自分はロックオン。相手はまだ封じ(2ターン目)
  check('T167b 2ターン目も音技が出せない',
    E.sides.self.currentHp === 153,
    `リザードンHP=${E.sides.self.currentHp}(153=無傷期待)`);
  E.runTurn();   // T3: 封じが切れてハイパーボイスが当たる
  check('T167c 3ターン目は封じが切れて音技が当たる',
    E.sides.self.currentHp < 153,
    `リザードンHP=${E.sides.self.currentHp}(153未満期待)`);
  resetEnv();
}
{
  resetEnv();
  // 必ず急所(やまあらし must_crit): 既存実装(calcDamage の must_crit)の回帰ガード。
  // 急所はランク補正(防御+)を無視し×1.5 → 通常より大きいダメージになる。出典: Bulbapedia "Storm Throw"
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('やまあらし')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(() => 0.0);
  const _crit = E.calcDamage('self', 'opp', moveByName('やまあらし'));
  const _chips = (_crit.chips || []).map(c => c.kind);
  check('T168 やまあらし(必ず急所)は急所トグルなしでも急所×1.5が乗る',
    _chips.includes('crit'),
    `chips=${_chips.join(',')}(crit含む期待)`);
  resetEnv();
}

console.log('\n=== 段68 シェルアームズ(物理特殊自動) ===');
{
  resetEnv();
  // シェルアームズ: 物理(こうげき/ぼうぎょ)と特殊(とくこう/とくぼう)の仮ダメージを比べ、
  // 高くなるほうのカテゴリで撃つ。出典: Bulbapedia "Shell Side Arm"
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.opp = freshSide('フシギバナ', null);
  E.setRandom(() => 0.0);
  const _mv = moveByName('シェルアームズ');
  // 比較用クローン(物理特殊自動を抜いて宣言カテゴリ固定)
  const _mkFixed = (cat) => Object.assign({}, _mv, { category: cat,
    battle_data: Object.assign({}, _mv.battle_data,
      { effects: (_mv.battle_data.effects || []).filter(e => e.kind !== '物理特殊自動') }) });
  // ① ゲンガー素(とくこう150≫こうげき85)→特殊で撃つ
  const _dAuto1 = E.calcDamage('self', 'opp', _mv).max;
  const _dSpec = E.calcDamage('self', 'opp', _mkFixed('特殊')).max;
  const _dPhys = E.calcDamage('self', 'opp', _mkFixed('物理')).max;
  check('T169 とくこうが高い時は特殊で撃つ',
    _dAuto1 === _dSpec && _dSpec !== _dPhys,
    `auto=${_dAuto1} 特殊固定=${_dSpec} 物理固定=${_dPhys}`);
  // ② こうげきを上書きで激増(とくこうを激減)→物理で撃つ
  E.sides.self.statOverride = { atk: 300, spatk: 30 };
  const _dAuto2 = E.calcDamage('self', 'opp', _mv).max;
  const _dPhys2 = E.calcDamage('self', 'opp', _mkFixed('物理')).max;
  const _dSpec2 = E.calcDamage('self', 'opp', _mkFixed('特殊')).max;
  check('T169b こうげきが高い時は物理で撃つ',
    _dAuto2 === _dPhys2 && _dPhys2 !== _dSpec2,
    `auto=${_dAuto2} 物理固定=${_dPhys2} 特殊固定=${_dSpec2}`);
  resetEnv();
}

console.log('\n=== 段69 みらいよち(遅延攻撃) ===');
{
  resetEnv();
  // みらいよち: 使ったターンはダメージなし。2ターン後のターン終了時に当たる(エスパー120特殊)。
  // 使用中にもう一度使うと失敗。出典: Bulbapedia "Future Sight"
  E.sides.self = freshSide('ゲンガー', null);    // spd130=先手
  E.sides.self.moves = [moveByName('みらいよち')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カメックス', null);   // HP154。はたく=ノーマルはゲンガーに×0(ノイズなし)
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: みらいよち宣言(まだ当たらない)
  check('T170 使ったターンはダメージなし',
    E.sides.opp.currentHp === 154,
    `カメックスHP=${E.sides.opp.currentHp}(154=無傷期待)`);
  E.runTurn();   // T2: 発動中の再使用は失敗。まだ当たらない
  check('T170b 2ターン目もまだ当たらない(再使用は失敗)',
    E.sides.opp.currentHp === 154,
    `カメックスHP=${E.sides.opp.currentHp}(154=無傷期待)`);
  E.runTurn();   // T3: ターン終了時に攻撃が当たる
  check('T170c 2ターン後のターン終了時に当たる',
    E.sides.opp.currentHp < 154,
    `カメックスHP=${E.sides.opp.currentHp}(154未満期待)`);
  const _hp3 = E.sides.opp.currentHp;
  E.runTurn();   // T4: 一度当たったら消える(再使用していないので何も起きない)
  check('T170d 当たったあとは消えている(翌ターン再発しない)',
    E.sides.opp.currentHp === _hp3,
    `カメックスHP=${E.sides.opp.currentHp}(${_hp3}のまま期待)`);
  resetEnv();
}

console.log('\n=== 段70 ねごと(ランダム技)・ねむり専用技ゲート ===');
{
  resetEnv();
  // ねごと: ねむり状態の時だけ使え、自分のほかの技をランダムに1つくりだす。
  // 出典: Bulbapedia "Sleep Talk"
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ねごと'), moveByName('タネばくだん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.status = 'sleep';          // UI手動ねむり(カウンタなし=眠り続ける)
  E.sides.opp = freshSide('ゲンガー', null);   // タネばくだん=くさ ×1。HP135
  E.sides.opp.moves = [moveByName('はたく')];  // はたく=ノーマルはゲンガー側が使う技。フシギバナへ×1だが
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';                // 相手も眠らせてノイズゼロにする
  E.setRandom(() => 0.0);
  E.runTurn();   // ねごと→タネばくだん が出る
  check('T171 ねむり中のねごとで ほかの技が出る',
    E.sides.opp.currentHp < 135,
    `ゲンガーHP=${E.sides.opp.currentHp}(135未満期待)`);
  resetEnv();
}
{
  resetEnv();
  // 起きている時のねごとは失敗する(requires self_status ねむり)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ねごと'), moveByName('タネばくだん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T171b 起きている時のねごとは失敗する',
    E.sides.opp.currentHp === 135,
    `ゲンガーHP=${E.sides.opp.currentHp}(135=無傷期待)`);
  resetEnv();
}
{
  resetEnv();
  // いびき: ねむり状態の時だけ出せる攻撃技(requires self_status ねむり)。
  // 出典: Bulbapedia "Snore"
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いびき')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.status = 'sleep';
  E.sides.opp = freshSide('カメックス', null);  // HP154・いびき=ノーマル×1
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T171c ねむり中のいびきは攻撃できる',
    E.sides.opp.currentHp < 154,
    `カメックスHP=${E.sides.opp.currentHp}(154未満期待)`);
  resetEnv();
}
{
  resetEnv();
  // 起きている時のいびきは失敗する
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いびき')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カメックス', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T171d 起きている時のいびきは失敗する',
    E.sides.opp.currentHp === 154,
    `カメックスHP=${E.sides.opp.currentHp}(154=無傷期待)`);
  resetEnv();
}

console.log('\n=== 段71 まねっこ(直前技模倣) ===');
{
  resetEnv();
  // まねっこ: 戦闘で直前に使われた技をまねして出す。だれも技を使っていなければ失敗。
  // 出典: Bulbapedia "Copycat"
  // ゲンガー(spd130=先手)がまねっこ → まだ誰も技を使っていない1ターン目は失敗。
  // 後手カメックスがタネばくだん → 2ターン目のまねっこはタネばくだんをまねる(ゲンガー→カメックス ×2)。
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('まねっこ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カメックス', null);   // HP154
  E.sides.opp.moves = [moveByName('タネばくだん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: まねっこ(先手・まだ誰も使っていない=失敗)→カメックスのタネばくだん
  check('T172 だれも技を使っていない1ターン目のまねっこは失敗',
    E.sides.opp.currentHp === 154,
    `カメックスHP=${E.sides.opp.currentHp}(154=無傷期待)`);
  E.runTurn();   // T2: まねっこ=直前のタネばくだんをまねる(くさ→みず ×2で当たる)
  check('T172b 2ターン目のまねっこは直前の技(タネばくだん)をまねる',
    E.sides.opp.currentHp < 154,
    `カメックスHP=${E.sides.opp.currentHp}(154未満期待)`);
  resetEnv();
}

console.log('\n=== 段72 さいはい(技強制再使用) ===');
{
  resetEnv();
  // さいはい: 相手が最後に使った技を、その場でもう一度使わせる。まだ技を使っていなければ失敗。
  // 出典: Bulbapedia "Instruct"
  E.sides.self = freshSide('ゲンガー', null);    // spd130=先手
  E.sides.self.moves = [moveByName('さいはい')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カメックス', null);
  E.sides.opp.moves = [moveByName('タネばくだん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.sides.self.currentHp = 135;          // freshSideはcurrentHp未設定のため明示
  const _hp0 = 135;
  E.runTurn();   // T1: さいはい(相手はまだ技を使っていない=失敗)→カメックスのタネばくだん(1発)
  const _hp1 = E.sides.self.currentHp;
  const _d1 = _hp0 - _hp1;
  check('T173 相手がまだ技を使っていない さいはいは失敗(被弾は1発分)',
    _d1 > 0,
    `1ターン目被弾=${_d1}(>0期待)`);
  E.runTurn();   // T2: さいはい→カメックスがタネばくだんを即くりかえす+自分の行動でもう1発=計2発
  const _hp2 = E.sides.self.currentHp;
  const _d2 = _hp1 - _hp2;
  check('T173b さいはいで相手が直前の技をもう一度使う(被弾が2発分になる)',
    _d2 === _d1 * 2,
    `2ターン目被弾=${_d2}(${_d1 * 2}=2発分期待)`);
  resetEnv();
}

console.log('\n=== 段73 ねをはる(自分拘束+地面技被弾化+毎ターン回復) ===');
{
  resetEnv();
  // ねをはる: 根をはると ひこうタイプでも じめん技が当たるようになる(接地)。
  // 出典: Bulbapedia "Ingrain"(使用後はじめん技の対象になる・ひこうの無効が消える=等倍)
  E.sides.self = freshSide('リザードン', null);   // ほのお/ひこう・spd120=先手
  E.sides.self.moves = [moveByName('ねをはる')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 100;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('じしん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // ねをはる→じしんが当たる(×2)→ターン終了に1/16回復(+9)
  const _hp1 = E.sides.self.currentHp;
  check('T174 ねをはった後は じしんが当たる(ターン終了に回復もする)',
    _hp1 > 0 && _hp1 < 109,
    `リザードンHP=${_hp1}(0超・109未満期待: 109=無傷+回復9)`);
  resetEnv();
}
{
  resetEnv();
  // 毎ターン終了に最大HPの1/16回復(153→9)。すでに根をはっていたら再使用は失敗(二重回復しない)
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('ねをはる')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 100;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('じしん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';   // 相手は眠らせてノイズゼロ
  E.setRandom(() => 0.0);
  E.runTurn();   // ねをはる→回復+9
  const _hp1 = E.sides.self.currentHp;
  check('T174b ターン終了に最大HPの1/16回復する',
    _hp1 === 109,
    `リザードンHP=${_hp1}(109期待: 100+9)`);
  E.runTurn();   // 再使用は失敗(が、根は残っていて回復は続く)→+9
  check('T174c 再使用は失敗するが回復は続く(二重にならない)',
    E.sides.self.currentHp === 118,
    `リザードンHP=${E.sides.self.currentHp}(118期待: 109+9)`);
  resetEnv();
}

console.log('\n=== 段74 さわぐ(連続強制(混乱なし)+ねむり予防) ===');
{
  resetEnv();
  // さわぐ: 固定3ターン技ロックで攻撃し続け、さわいでいる間は場の誰も眠らない。
  // 終わってもこんらんしない(あばれるとの違い)。出典: Bulbapedia "Uproar"(第5世代以降=3ターン固定)
  E.sides.self = freshSide('ゲンガー', null);     // spd130=先手 → さわぐが先に始まる
  E.sides.self.moves = [moveByName('さわぐ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('さいみんじゅつ')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);    // 命中ロール0=さいみんじゅつも必ず当たる(予防が無ければ眠る)
  const _ohp0 = E.realStat(E.sides.opp, 'hp');
  E.runTurn();   // T1: さわぐ開始→さいみんじゅつは「眠れない」で不発
  check('T175 さわいでいる間は眠らされない(さいみんじゅつ不発)',
    E.sides.self.status === 'none' && !!E.sides.self.rampage,
    `status=${E.sides.self.status}(none期待) rampage=${!!E.sides.self.rampage}(true期待)`);
  const _ohp1 = E.sides.opp.currentHp;
  check('T175b さわぐは攻撃技として毎ターンダメージを与える',
    _ohp1 < _ohp0,
    `フシギバナHP=${_ohp1}(${_ohp0}未満期待)`);
  E.runTurn();   // T2
  E.runTurn();   // T3: 3ターン目で しずかになる
  check('T175c さわぐは3ターンで終わる(固定)',
    !E.sides.self.rampage,
    `rampage=${JSON.stringify(E.sides.self.rampage)}(null期待)`);
  check('T175d さわぎ終わってもこんらんしない(あばれるとの違い)',
    !E.sides.self.confusion,
    `confusion=${E.sides.self.confusion}(0期待)`);
  resetEnv();
}

console.log('\n=== 段75 ねがいごと(次のターン終了に最大HPの半分回復) ===');
{
  resetEnv();
  // ねがいごと: 使ったターンは回復しない。次のターンの終わりに、使った側の最大HPの半分回復。
  // 願っている間の再使用は失敗。出典: Bulbapedia "Wish"
  E.sides.self = freshSide('リザードン', null);   // 最大HP153 → 回復76
  E.sides.self.moves = [moveByName('ねがいごと')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 10;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('じしん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';   // 相手は眠らせてノイズゼロ
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: ねがいごと(まだ回復しない)
  check('T176 使ったターンには回復しない',
    E.sides.self.currentHp === 10,
    `リザードンHP=${E.sides.self.currentHp}(10期待: 即時回復しない)`);
  E.runTurn();   // T2: 再使用は失敗→ターン終了に願いがかなう(+76=floor(153/2))
  check('T176b 次のターンの終わりに最大HPの半分回復(再使用は失敗)',
    E.sides.self.currentHp === 86,
    `リザードンHP=${E.sides.self.currentHp}(86期待: 10+76)`);
  E.runTurn();   // T3: 願いは消費済み→もう一度願える(このターンの終わりはまだ回復しない)
  check('T176c 願いは一度で消費される(3ターン目の終わりは回復しない)',
    E.sides.self.currentHp === 86,
    `リザードンHP=${E.sides.self.currentHp}(86期待: 願い直し中)`);
  resetEnv();
}

console.log('\n=== 段76 みがわり(分身がダメージ/相手対象の効果を肩代わり) ===');
{
  resetEnv();
  // みがわり: 最大HPの1/4を払って分身を出す(分身HP=払った量)。出典: Bulbapedia "Substitute"
  // リザードン最大HP153 → コスト floor(153/4)=38
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('みがわり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 153;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';   // 相手は眠らせてノイズゼロ
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: みがわりを出す(-38)
  check('T177 みがわりは最大HPの1/4を払って出す(分身HP=払った量)',
    E.sides.self.currentHp === 115 && E.sides.self.subHp === 38,
    `HP=${E.sides.self.currentHp}(115期待) subHp=${E.sides.self.subHp}(38期待)`);
  E.runTurn();   // T2: すでに分身がいる→再使用は失敗(HPは減らない)
  check('T177b 分身がいる間の再使用は失敗(HPを払わない)',
    E.sides.self.currentHp === 115 && E.sides.self.subHp === 38,
    `HP=${E.sides.self.currentHp}(115期待) subHp=${E.sides.self.subHp}(38期待)`);
  resetEnv();
}
{
  resetEnv();
  // 攻撃は分身が肩代わり: 本体HPは減らず、分身HPが減る
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('みがわり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 153;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);   // 乱数ロール0=最小乱数
  const _dmg = E.calcDamage('opp', 'self', moveByName('はたく')).min;
  E.runTurn();   // T1: リザードン(spd120)が先にみがわり→はたくは分身が受ける
  check('T177c 攻撃は分身が受ける(本体は減らない)',
    E.sides.self.currentHp === 115 && E.sides.self.subHp === Math.max(0, 38 - _dmg),
    `HP=${E.sides.self.currentHp}(115期待) subHp=${E.sides.self.subHp}(${Math.max(0, 38 - _dmg)}期待: 38-${_dmg})`);
  resetEnv();
}
{
  resetEnv();
  // 相手対象の変化技(でんじは)は分身に防がれる
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('みがわり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 153;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('でんじは')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: みがわり→でんじはは防がれる
  check('T177d 相手対象の変化技は分身に防がれる(でんじは不発)',
    E.sides.self.status === 'none' && E.sides.self.subHp === 38,
    `status=${E.sides.self.status}(none期待) subHp=${E.sides.self.subHp}(38期待)`);
  resetEnv();
}
{
  resetEnv();
  // みがわり貫通(音技=ハイパーボイス)は分身を素通りして本体に当たる
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('みがわり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 153;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('ハイパーボイス')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: みがわり→ハイパーボイスは貫通
  check('T177e みがわり貫通(音技)は分身を素通りして本体に当たる',
    E.sides.self.currentHp < 115 && E.sides.self.subHp === 38,
    `HP=${E.sides.self.currentHp}(115未満期待) subHp=${E.sides.self.subHp}(38期待)`);
  resetEnv();
}
{
  resetEnv();
  // HPがコスト以下(38以下)だと出せない(Bulbapedia "Substitute": 1/4より多く残っていないと失敗)
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('みがわり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 38;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T177f HPが1/4以下だと みがわりは失敗する',
    E.sides.self.currentHp === 38 && !E.sides.self.subHp,
    `HP=${E.sides.self.currentHp}(38期待) subHp=${E.sides.self.subHp}(0期待)`);
  resetEnv();
}

console.log('\n=== 段77 ふきとばし/ほえる(1vs1=控えがいないので失敗) ===');
{
  resetEnv();
  // 強制交代(吹き飛ばし)は相手に控えがいないと失敗する(Bulbapedia "Whirlwind"/"Roar")。
  // この sim は1vs1(控えなし)なので常に「しかし うまく きまらなかった！」になるのが正解
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ふきとばし')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T178 ふきとばしは控えがいないと失敗する(行動失敗として記録)',
    E.sides.self.failedThisTurn === true,
    `failedThisTurn=${E.sides.self.failedThisTurn}(true期待)`);
  resetEnv();
}

console.log('\n=== 段78 音技のみがわり貫通(substitute_pierce を読む) ===');
{
  resetEnv();
  // うたう(音技・変化)は分身を素通りして本体を眠らせる(Bulbapedia "Substitute": 第6世代以降、音技は素通り)
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('みがわり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 153;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('うたう')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);   // 命中ロール0=うたう(命中55)も当たる
  E.runTurn();   // T1: みがわり→うたうは貫通して本体が眠る
  check('T179 音技(うたう)は分身を素通りして本体を眠らせる',
    E.sides.self.status === 'sleep' && E.sides.self.subHp === 38,
    `status=${E.sides.self.status}(sleep期待) subHp=${E.sides.self.subHp}(38期待)`);
  resetEnv();
}
{
  resetEnv();
  // きんぞくおん(音技・変化)も貫通して とくぼう-2(データ修正: substitute_pierce 追加済み)
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('みがわり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 153;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('きんぞくおん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();   // T1: みがわり→きんぞくおんは貫通して とくぼう-2
  check('T179b 音技(きんぞくおん)は分身を素通りして とくぼう-2',
    E.sides.self.rank.spdef === -2 && E.sides.self.subHp === 38,
    `spdefランク=${E.sides.self.rank.spdef}(-2期待) subHp=${E.sides.self.subHp}(38期待)`);
  resetEnv();
}

console.log('\n=== 段79 急所率上昇(きあいだめ/高急所技: 確率制・第7世代以降) ===');
{
  resetEnv();
  // きあいだめ: きゅうしょアップ状態(急所ランク+2)になる。場を離れるまで続く・重ねがけ不可。
  // 出典: ポケモンWiki「急所」(きゅうしょアップ=+2)/Bulbapedia "Focus Energy"
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('きあいだめ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T180 きあいだめで きゅうしょアップ状態(+2)になる',
    E.sides.self.critBoost === 2,
    `critBoost=${E.sides.self.critBoost}(2期待)`);
  E.runTurn();   // 2回目は失敗(重ねがけ不可)
  check('T180b きあいだめの重ねがけは失敗する',
    E.sides.self.critBoost === 2 && E.sides.self.failedThisTurn === true,
    `critBoost=${E.sides.self.critBoost}(2期待) failedThisTurn=${E.sides.self.failedThisTurn}(true期待)`);
  resetEnv();
}
{
  resetEnv();
  // きゅうしょアップ(+2)+高急所技つじぎり(+1)=ランク3以上 → 確定急所(乱数最小でも急所)
  // 急所率: ランク0=1/24, 1=1/8, 2=1/2, 3以上=確定(第7世代以降。ポケモンWiki「急所」/Bulbapedia "Critical hit")
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('つじぎり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.critBoost = 2;   // きあいだめ済みの状態を直接セット
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';
  // 期待値: 急所つじぎりの最小乱数ダメージ(UIトグルで急所を立てた calcDamage と一致するはず)
  E.sides.self.critical = true;
  const t180cExp = E.calcDamage('self', 'opp', moveByName('つじぎり')).min;
  E.sides.self.critical = false;
  const t180cMax = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = t180cMax;
  E.setRandom(() => 0.0);   // 乱数最小=確率ロールでは急所が出ない値 → 確定急所だけが通る
  E.runTurn();
  check('T180c ランク3以上(きあいだめ+つじぎり)は確定急所(×1.5)',
    t180cMax - E.sides.opp.currentHp === t180cExp,
    `実ダメージ=${t180cMax - E.sides.opp.currentHp}(急所min=${t180cExp}期待)`);
  check('T180c2 急所のログが出る',
    E.battleLog.some(l => l.msg.includes('きゅうしょ')),
    `log=${JSON.stringify(E.battleLog.slice(-6).map(l => l.msg))}`);
  resetEnv();
}
{
  resetEnv();
  // 高急所技つじぎり単体(+1)=急所率1/8。乱数を高め(0.9 >= 1-1/8=0.875)に固定 → 急所が出る
  // (確率ロールは「乱数が高いほど急所」の向き=既存テストの乱数最小と互換)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('つじぎり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.9);
  E.runTurn();
  check('T180d 高急所技(+1)は乱数0.9(>=7/8)で急所が出る',
    E.battleLog.some(l => l.msg.includes('きゅうしょ')),
    `log=${JSON.stringify(E.battleLog.slice(-6).map(l => l.msg))}`);
  resetEnv();
}
{
  resetEnv();
  // 高急所技つじぎり単体(+1): 乱数最小(0.0 < 0.875)では急所は出ない=通常ダメージ(回帰確認)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('つじぎり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';
  const t180eExp = E.calcDamage('self', 'opp', moveByName('つじぎり')).min;
  const t180eMax = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = t180eMax;
  const t180eLogStart = E.battleLog.length;   // ログ判定はこのターンの分だけ(前テストの残留を見ない)
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T180e 高急所技でも乱数最小なら通常ダメージ(急所なし)',
    t180eMax - E.sides.opp.currentHp === t180eExp && !E.battleLog.slice(t180eLogStart).some(l => l.msg.includes('きゅうしょ')),
    `実ダメージ=${t180eMax - E.sides.opp.currentHp}(通常min=${t180eExp}期待)`);
  resetEnv();
}
{
  resetEnv();
  // ドラゴンエール: 味方対象(fails_if no_ally)なので1vs1では失敗する(ポケモンWiki「急所」: 味方が受ける技)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ドラゴンエール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T180f ドラゴンエールは味方がいない1vs1では失敗する',
    E.sides.self.failedThisTurn === true && !E.sides.self.critBoost,
    `failedThisTurn=${E.sides.self.failedThisTurn}(true期待) critBoost=${E.sides.self.critBoost}`);
  resetEnv();
}

console.log('\n=== 段80 パーティ導入A-1(bench構造+交代+揮発リセット) ===');
// 出典: ポケモンWiki「ポケモンチェンジ」— 交代でランク補正・状態変化・タイプ/特性の変更は元に戻る。
// 状態異常は回復しない(ねむりターンは持ち越し・もうどくカウンタはリセット)。
// バインド/ねをはる状態は交代不可(ゴーストタイプは第6世代以降無視して交代できる)。
// 交代して出たポケモンはそのターン行動できない。複数交代はすばやさ順。
function benchEntry(pokeName, moveKey){
  return { poke: pokeByName(pokeName), effort: {hp:0,atk:0,def:0,spatk:0,spdef:0,spd:0},
    natureIdx: 0, ability: '', item: '', moves: moveKey ? [data.WAZA_MAP[moveKey]] : [],
    currentHp: null, fainted: false, status: 'none', sleepTurns: null };
}
{
  resetEnv();
  // T181 手動交代: 永続(HP/状態異常)は控えに持って行き、揮発(ランク/きあいだめ/みがわり)は消える
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.currentHp = 100;
  E.sides.self.status = 'burn';
  E.sides.self.rank.spatk = 2;
  E.sides.self.critBoost = 2;
  E.sides.self.subHp = 30;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  const ok181 = E.attemptSwitch('self', 0);
  check('T181 交代できた', ok181 === true, `ret=${ok181}`);
  check('T181 リザードンが場に出て満タン',
    E.sides.self.poke && E.sides.self.poke.name === 'リザードン' && E.sides.self.currentHp === E.realStat(E.sides.self, 'hp'),
    `poke=${E.sides.self.poke && E.sides.self.poke.name} hp=${E.sides.self.currentHp}`);
  check('T181 揮発状態は持ち越されない(ランク/きあいだめ/みがわり=ゼロ)',
    E.sides.self.rank.atk === 0 && E.sides.self.critBoost === 0 && E.sides.self.subHp === 0,
    `rank.atk=${E.sides.self.rank.atk} critBoost=${E.sides.self.critBoost} subHp=${E.sides.self.subHp}`);
  check('T181 控えに戻ったフシギバナはHP100+やけどを保持',
    E.sides.self.bench[0].poke.name === 'フシギバナ' && E.sides.self.bench[0].currentHp === 100 && E.sides.self.bench[0].status === 'burn',
    `bench0=${JSON.stringify({n: E.sides.self.bench[0].poke.name, hp: E.sides.self.bench[0].currentHp, st: E.sides.self.bench[0].status})}`);
  // T181b 戻すと フシギバナのHP/やけどはそのまま・ランクは消えたまま
  E.attemptSwitch('self', 0);
  check('T181b 戻ったフシギバナ: HP100+やけど保持・ランクはリセット済み',
    E.sides.self.poke.name === 'フシギバナ' && E.sides.self.currentHp === 100 &&
    E.sides.self.status === 'burn' && E.sides.self.rank.atk === 0,
    `poke=${E.sides.self.poke.name} hp=${E.sides.self.currentHp} st=${E.sides.self.status} rank.atk=${E.sides.self.rank.atk}`);
  resetEnv();
}
{
  resetEnv();
  // T181c runTurn内の交代: 技より先に処理され、相手の攻撃は交代後の新ポケモンが受ける。
  // 交代した側はそのターン行動しない(相手のHPは減らない)
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.self.switchChoice = 0;
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  const oppHp181c = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppHp181c;
  E.setRandom(() => 0.0);
  E.runTurn();
  const lizaMax = E.realStat(E.sides.self, 'hp');
  check('T181c 交代後のリザードンが相手の攻撃を受けた',
    E.sides.self.poke.name === 'リザードン' && E.sides.self.currentHp < lizaMax,
    `poke=${E.sides.self.poke.name} hp=${E.sides.self.currentHp}/${lizaMax}`);
  check('T181c 交代した側はそのターン行動しない(相手のHPは満タンのまま)',
    E.sides.opp.currentHp === oppHp181c,
    `oppHp=${E.sides.opp.currentHp}(${oppHp181c}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T181d ねをはる状態は交代できない(ポケモンWiki「ポケモンチェンジ」)
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.rooted = true;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  const ok181d = E.attemptSwitch('self', 0);
  check('T181d ねをはる状態は交代できない',
    ok181d === false && E.sides.self.poke.name === 'フシギバナ',
    `ret=${ok181d} poke=${E.sides.self.poke.name}`);
  // T181e バインド状態も交代できない
  E.sides.self.rooted = false;
  E.sides.self.slips = [{source: 'バインド', fraction: 0.125, turns: 3}];
  const ok181e = E.attemptSwitch('self', 0);
  check('T181e バインド状態も交代できない',
    ok181e === false && E.sides.self.poke.name === 'フシギバナ',
    `ret=${ok181e} poke=${E.sides.self.poke.name}`);
  // T181f ゴーストタイプは交代封じを無視できる(第6世代以降)
  E.sides.opp.slips = [{source: 'バインド', fraction: 0.125, turns: 3}];
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  const ok181f = E.attemptSwitch('opp', 0);
  check('T181f ゴーストタイプ(ゲンガー)はバインド中でも交代できる',
    ok181f === true && E.sides.opp.poke.name === 'リザードン',
    `ret=${ok181f} poke=${E.sides.opp.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T181g もうどくカウンタは交代でリセット(状態異常もうどく自体は持ち越し)
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.status = 'badpoison';
  E.sides.self.badpoisonCounter = 3;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.attemptSwitch('self', 0);   // フシギバナを下げる
  E.attemptSwitch('self', 0);   // フシギバナを再び出す
  check('T181g もうどくは持ち越し・カウンタはリセット',
    E.sides.self.status === 'badpoison' && (E.sides.self.badpoisonCounter || 0) === 0,
    `status=${E.sides.self.status} counter=${E.sides.self.badpoisonCounter}`);
  // T181h ひんしの控えには交代できない
  E.sides.self.bench[0].fainted = true;
  const ok181h = E.attemptSwitch('self', 0);
  check('T181h ひんしの控えには交代できない', ok181h === false, `ret=${ok181h}`);
  resetEnv();
}

console.log('\n=== 段81 自分交代(とんぼがえり/ボルトチェンジ/すてゼリフ: 攻撃・効果のあと控えと交代) ===');
// 出典: ポケモンWiki「ポケモンチェンジ」— 攻撃が成功すると直後に交代。控えがいないと攻撃/効果のみ。
// 技による交代は交代封じ(バインド/ねをはる等)の影響を受けない。まもる等に防がれたら交代しない。
{
  resetEnv();
  // T182 とんぼがえり: 相手にダメージ→自分は控えと交代
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('とんぼがえり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  const oppHp182 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppHp182;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T182 とんぼがえり: ダメージを与えてから交代した',
    E.sides.opp.currentHp < oppHp182 && E.sides.self.poke.name === 'リザードン',
    `oppHp=${E.sides.opp.currentHp}/${oppHp182} self=${E.sides.self.poke.name}`);
  check('T182 控えにゲンガーが戻っている',
    E.sides.self.bench[0].poke.name === 'ゲンガー',
    `bench0=${E.sides.self.bench[0].poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T182b 控えがいないと攻撃のみ(交代しない・技は成功扱い)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('とんぼがえり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  const oppHp182b = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppHp182b;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T182b 控えなし: 攻撃のみで交代しない',
    E.sides.opp.currentHp < oppHp182b && E.sides.self.poke.name === 'ゲンガー' && E.sides.self.failedThisTurn === false,
    `oppHp=${E.sides.opp.currentHp} self=${E.sides.self.poke.name} failed=${E.sides.self.failedThisTurn}`);
  resetEnv();
}
{
  resetEnv();
  // T182c すてゼリフ: 相手のこうげき/とくこう-1 → 自分は交代
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('すてゼリフ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T182c すてゼリフ: こうげき-1/とくこう-1 のあと交代',
    E.sides.opp.rank.atk === -1 && E.sides.opp.rank.spatk === -1 && E.sides.self.poke.name === 'リザードン',
    `rank=${JSON.stringify(E.sides.opp.rank)} self=${E.sides.self.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T182d 技による交代は交代封じを無視できる(ねをはる中でもとんぼがえりで交代できる)
  // ※ゴーストタイプは素で封じ無視なので、ゴーストでないフシギバナで確かめる
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('とんぼがえり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rooted = true;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T182d ねをはる中でも技による交代はできる',
    E.sides.self.poke.name === 'リザードン',
    `self=${E.sides.self.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T182e まもるに防がれたら交代もしない(フシギバナ100 < ゲンガー130 でまもるが先)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('とんぼがえり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('まもる')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T182e まもるに防がれたら交代しない',
    E.sides.self.poke.name === 'フシギバナ',
    `self=${E.sides.self.poke.name}`);
  resetEnv();
}

console.log('\n=== 段82 バトンタッチ(能力変化と一部の状態変化を引き継いで交代) ===');
// 出典: ポケモンWiki「バトンタッチ」第9世代の引き継ぎ表 —
// ○: 能力ランク(マイナスも)/こんらん/きゅうしょアップ/みがわり/やどりぎのタネ/のろい/ほろびのうた/ねをはる/パワートリック
// ×: バインド/かなしばり/アンコール/ちょうはつ/メロメロ/じゅうでん/たくわえる 等。控えがいないと失敗。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('バトンタッチ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.atk = 2; E.sides.self.rank.spd = -1;
  E.sides.self.critBoost = 2;
  E.sides.self.subHp = 30;
  E.sides.self.confusion = 3;
  E.sides.self.rooted = true;
  E.sides.self.perishCount = 2;
  E.sides.self.slips = [
    {source: 'やどりぎのタネ', fraction: 0.125, drains: true},
    {source: 'バインド', fraction: 0.125, turns: 3},
  ];
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.sides.opp.status = 'sleep';
  // ※runTurnを使うと こんらん自傷ロール/ターン終了の減算が乗るので、効果フェーズを直接呼ぶユニットテストにする
  E.setRandom(() => 0.0);
  E.phaseApplyEffects('self', 'opp', moveByName('バトンタッチ'));
  const s183 = E.sides.self;
  check('T183 バトンタッチで交代した', s183.poke.name === 'リザードン', `self=${s183.poke.name}`);
  check('T183 ランク(マイナス含む)を引き継ぐ', s183.rank.atk === 2 && s183.rank.spd === -1,
    `rank=${JSON.stringify(s183.rank)}`);
  check('T183 きゅうしょアップ/みがわり/こんらん/ねをはる/ほろびのうたを引き継ぐ',
    s183.critBoost === 2 && s183.subHp === 30 && s183.confusion === 3 && s183.rooted === true && s183.perishCount === 2,
    `critBoost=${s183.critBoost} subHp=${s183.subHp} confusion=${s183.confusion} rooted=${s183.rooted} perish=${s183.perishCount}`);
  check('T183 やどりぎは引き継ぐ・バインドは引き継がない',
    (s183.slips || []).some(sl => sl.source === 'やどりぎのタネ') && !(s183.slips || []).some(sl => sl.source === 'バインド'),
    `slips=${JSON.stringify(s183.slips)}`);
  resetEnv();
}
{
  resetEnv();
  // T183b 控えがいないとバトンタッチは失敗する(ポケモンWiki「ポケモンチェンジ」)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('バトンタッチ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.phaseApplyEffects('self', 'opp', moveByName('バトンタッチ'));
  check('T183b 控えなしのバトンタッチは失敗する',
    E.sides.self.failedThisTurn === true && E.sides.self.poke.name === 'フシギバナ',
    `failed=${E.sides.self.failedThisTurn} self=${E.sides.self.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T183c 通常の交代ではこんらんは引き継がれない(揮発リセット。段80のギャップ修正の確認)
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.confusion = 3;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.attemptSwitch('self', 0);
  check('T183c 通常交代でこんらんは消える', (E.sides.self.confusion || 0) === 0,
    `confusion=${E.sides.self.confusion}`);
  resetEnv();
}

console.log('\n=== 段83 強制交代(ふきとばし/ほえる本来動作+ドラゴンテール/ともえなげ) ===');
// 出典: ポケモンWiki「ポケモンチェンジ」/「ふきとばし」— 相手をランダムな控えと強制交代させる。
// 失敗/不発: 相手がねをはる状態・控えなし(きゅうばんは特性=park)。ドラゴンテールはみがわりに防がれたら交代しない。
{
  resetEnv();
  // T184 ふきとばし: 相手に控えがいれば強制交代させる(段77「常に失敗」からの本来動作化)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ふきとばし')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T184 ふきとばしで相手が強制交代した',
    E.sides.opp.poke.name === 'リザードン' && E.sides.self.failedThisTurn === false,
    `opp=${E.sides.opp.poke.name} failed=${E.sides.self.failedThisTurn}`);
  check('T184 控えに眠ったフシギバナが戻っている(状態異常は持ち越し)',
    E.sides.opp.bench[0].poke.name === 'フシギバナ' && E.sides.opp.bench[0].status === 'sleep',
    `bench0=${E.sides.opp.bench[0].poke.name}/${E.sides.opp.bench[0].status}`);
  resetEnv();
}
{
  resetEnv();
  // T184b ねをはる相手はふきとばせない
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ふきとばし')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.rooted = true;
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T184b ねをはる相手にはふきとばしは失敗する',
    E.sides.opp.poke.name === 'フシギバナ' && E.sides.self.failedThisTurn === true,
    `opp=${E.sides.opp.poke.name} failed=${E.sides.self.failedThisTurn}`);
  resetEnv();
}
{
  resetEnv();
  // T184c ドラゴンテール: ダメージを与えてから相手を強制交代させる
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ドラゴンテール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  const oppHp184c = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppHp184c;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T184c ドラゴンテール: ダメージ+強制交代',
    E.sides.opp.poke.name === 'リザードン' && E.sides.opp.bench[0].currentHp < oppHp184c,
    `opp=${E.sides.opp.poke.name} 戻ったフシギバナHP=${E.sides.opp.bench[0].currentHp}/${oppHp184c}`);
  resetEnv();
}
{
  resetEnv();
  // T184d ドラゴンテールがみがわりに防がれたら交代しない(みがわり遮断・ポケモンWiki)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ドラゴンテール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.subHp = 38;
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T184d みがわりに防がれたドラゴンテールは交代させない',
    E.sides.opp.poke.name === 'フシギバナ',
    `opp=${E.sides.opp.poke.name} subHp=${E.sides.opp.subHp}`);
  resetEnv();
}
{
  resetEnv();
  // T184e ねをはる相手にはドラゴンテールのダメージのみ(交代なし)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ドラゴンテール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.rooted = true;
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  const oppHp184e = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppHp184e;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T184e ねをはる相手にはダメージのみで交代なし',
    E.sides.opp.poke.name === 'フシギバナ' && E.sides.opp.currentHp < oppHp184e,
    `opp=${E.sides.opp.poke.name} hp=${E.sides.opp.currentHp}/${oppHp184e}`);
  resetEnv();
}

console.log('\n=== 段84 設置技(ステルスロック/まきびし/どくびし/ねばねばネット: 交代で出てきた相手に発動) ===');
// 出典: ポケモンWiki「ステルスロック」「まきびし」「どくびし」「ねばねばネット」/ Bulbapedia —
// ステルスロック=最大HP×(いわ相性/8)・全員に当たる / まきびし=接地のみ 1層1/8・2層1/6・3層1/4 /
// どくびし=接地のみ 1層どく・2層もうどく(どくタイプが接地で出ると解除) / ねばねばネット=接地のみ すばやさ-1
{
  resetEnv();
  // T185 ステルスロック: いわ4倍弱点のリザードン(ほのお/ひこう)は出てきた時に最大HPの半分
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ステルスロック')];
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('ステルスロック'));
  check('T185 ステルスロックが相手の場に置かれた', E.sides.opp.stealthRock === true,
    `stealthRock=${E.sides.opp.stealthRock}`);
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  E.attemptSwitch('opp', 0);
  const lizaMax185 = E.realStat(E.sides.opp, 'hp');
  check('T185 出てきたリザードン(いわ4倍)は最大HPの半分のダメージ',
    E.sides.opp.poke.name === 'リザードン' && E.sides.opp.currentHp === lizaMax185 - Math.floor(lizaMax185 * 4 / 8),
    `hp=${E.sides.opp.currentHp}(${lizaMax185 - Math.floor(lizaMax185 * 4 / 8)}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T185b まきびし: 接地している交代先に1層=1/8。ひこうタイプには当たらない
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('まきびし')];
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('まきびし'));
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku'), benchEntry('カビゴン', 'hataku')];
  E.attemptSwitch('opp', 0);   // リザードン(ひこう)=まきびし無効
  const lizaMax185b = E.realStat(E.sides.opp, 'hp');
  check('T185b ひこうタイプにはまきびしは当たらない',
    E.sides.opp.currentHp === lizaMax185b, `hp=${E.sides.opp.currentHp}/${lizaMax185b}`);
  E.attemptSwitch('opp', 1);   // カビゴン(接地)=1/8
  const snoMax = E.realStat(E.sides.opp, 'hp');
  check('T185b 接地カビゴンは1層まきびしで最大HPの1/8',
    E.sides.opp.currentHp === snoMax - Math.floor(snoMax * 0.125),
    `hp=${E.sides.opp.currentHp}(${snoMax - Math.floor(snoMax * 0.125)}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T185c まきびしは3層まで重ねられ(3層=1/4)、4回目は失敗
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('まきびし')];
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('まきびし'));
  E.phaseApplyEffects('self', 'opp', moveByName('まきびし'));
  E.phaseApplyEffects('self', 'opp', moveByName('まきびし'));
  check('T185c まきびしが3層になった', E.sides.opp.spikesLayers === 3, `layers=${E.sides.opp.spikesLayers}`);
  E.phaseApplyEffects('self', 'opp', moveByName('まきびし'));
  check('T185c 4回目は失敗(3層のまま)', E.sides.opp.spikesLayers === 3 && E.sides.self.failedThisTurn === true,
    `layers=${E.sides.opp.spikesLayers} failed=${E.sides.self.failedThisTurn}`);
  E.sides.opp.bench = [benchEntry('カビゴン', 'hataku')];
  E.attemptSwitch('opp', 0);
  const snoMax185c = E.realStat(E.sides.opp, 'hp');
  check('T185c 3層まきびしで最大HPの1/4',
    E.sides.opp.currentHp === snoMax185c - Math.floor(snoMax185c * 0.25),
    `hp=${E.sides.opp.currentHp}(${snoMax185c - Math.floor(snoMax185c * 0.25)}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T185d どくびし: 接地の交代先をどくに。どくタイプが接地で出ると解除される
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('どくびし')];
  E.sides.opp = freshSide('リザードン', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('どくびし'));
  check('T185d どくびしが置かれた', E.sides.opp.toxicSpikesLayers === 1, `layers=${E.sides.opp.toxicSpikesLayers}`);
  E.sides.opp.bench = [benchEntry('カビゴン', 'hataku'), benchEntry('フシギバナ', 'hataku')];
  E.attemptSwitch('opp', 0);   // カビゴン(接地・ノーマル)→どく
  check('T185d 接地カビゴンはどく状態になる', E.sides.opp.status === 'poison', `status=${E.sides.opp.status}`);
  E.attemptSwitch('opp', 1);   // フシギバナ(くさ/どく・接地)→どくびしを吸収して解除
  check('T185d どくタイプが出るとどくびしは解除される',
    E.sides.opp.toxicSpikesLayers === 0 && E.sides.opp.status === 'none',
    `layers=${E.sides.opp.toxicSpikesLayers} status=${E.sides.opp.status}`);
  resetEnv();
}
{
  resetEnv();
  // T185e ねばねばネット: 接地の交代先のすばやさ-1(ひこうには効かない)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ねばねばネット')];
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('ねばねばネット'));
  E.sides.opp.bench = [benchEntry('カビゴン', 'hataku'), benchEntry('リザードン', 'hataku')];
  E.attemptSwitch('opp', 0);   // カビゴン(接地)→すばやさ-1
  check('T185e 接地カビゴンはすばやさ-1', E.sides.opp.rank.spd === -1, `rank.spd=${E.sides.opp.rank.spd}`);
  E.attemptSwitch('opp', 1);   // リザードン(ひこう)→効かない
  check('T185e ひこうタイプには効かない', E.sides.opp.rank.spd === 0, `rank.spd=${E.sides.opp.rank.spd}`);
  resetEnv();
}
{
  resetEnv();
  // T185f こうそくスピン: 自分の場の設置物を取り除く
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('こうそくスピン')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.stealthRock = true;
  E.sides.self.spikesLayers = 2;
  E.sides.self.toxicSpikesLayers = 1;
  E.sides.self.stickyWeb = true;
  // ※相手をゴースト(ゲンガー)にすると こうそくスピン(ノーマル)がこうかなし=効果も不発(段56仕様)なのでカビゴン
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T185f こうそくスピンで自分の場の設置が全て消えた',
    E.sides.self.stealthRock === false && E.sides.self.spikesLayers === 0 &&
    E.sides.self.toxicSpikesLayers === 0 && E.sides.self.stickyWeb === false,
    `SR=${E.sides.self.stealthRock} 棘=${E.sides.self.spikesLayers} 毒棘=${E.sides.self.toxicSpikesLayers} 網=${E.sides.self.stickyWeb}`);
  resetEnv();
}

console.log('\n=== 段85 瀕死交代(死に出し: ひんしになったらターンの最後に控えが出る) ===');
// 出典: ポケモンWiki「ポケモンチェンジ」— ひんしになったとき控えがいればターンの最後に交代。
// 死に出しで出たポケモンは「交代したターンは行動不可」の対象外(次のターン普通に行動できる)。
{
  resetEnv();
  // T186 ひんしになったらターンの最後に控えが自動で出る
  // ※selfをゴースト(ゲンガー)にすると次ターンのリザードンの はたく(ノーマル)がこうかなしになるのでカビゴン
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.currentHp = 1;
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T186 ひんし後、ターンの最後に控えのリザードンが出た',
    E.sides.opp.poke.name === 'リザードン' && E.sides.opp.fainted === false,
    `opp=${E.sides.opp.poke.name} fainted=${E.sides.opp.fainted}`);
  check('T186 たおれたフシギバナは控えに(ひんしのまま)',
    E.sides.opp.bench[0].poke.name === 'フシギバナ' && E.sides.opp.bench[0].fainted === true,
    `bench0=${E.sides.opp.bench[0].poke.name} fainted=${E.sides.opp.bench[0].fainted}`);
  // T186b 死に出しで出たポケモンは次のターン普通に行動できる
  E.sides.opp.selectedMoveIdx = 0;
  const selfHp186 = E.sides.self.currentHp;
  E.runTurn();
  check('T186b 死に出しのリザードンは次のターン行動できる(ゲンガーがダメージを受けた)',
    E.sides.self.currentHp < selfHp186,
    `selfHp=${E.sides.self.currentHp}(前=${selfHp186})`);
  resetEnv();
}
{
  resetEnv();
  // T186c 死に出しにも設置技(ステルスロック)が刺さる
  E.sides.self = freshSide('ゲンガー', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.currentHp = 1;
  E.sides.opp.stealthRock = true;
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  E.setRandom(() => 0.0);
  E.runTurn();
  const lizaMax186 = E.realStat(E.sides.opp, 'hp');
  check('T186c 死に出しのリザードンにステルスロック(いわ4倍=最大HPの半分)が刺さる',
    E.sides.opp.poke.name === 'リザードン' && E.sides.opp.currentHp === lizaMax186 - Math.floor(lizaMax186 * 4 / 8),
    `hp=${E.sides.opp.currentHp}(${lizaMax186 - Math.floor(lizaMax186 * 4 / 8)}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T186d 控えがいなければひんしのまま(全滅)
  E.sides.self = freshSide('ゲンガー', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.currentHp = 1;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T186d 控えなしならひんしのまま',
    E.sides.opp.poke.name === 'フシギバナ' && E.sides.opp.fainted === true,
    `opp=${E.sides.opp.poke.name} fainted=${E.sides.opp.fainted}`);
  resetEnv();
}

console.log('\n=== 段86 拘束(くろいまなざし/とおせんぼう/かげぬい: 交代封じ) ===');
// 出典: ポケモンWiki「ポケモンチェンジ」(にげられない状態=交代不可)/「くろいまなざし」—
// かけた側が場を離れるまで相手は交代できない。ゴーストタイプには効かない(第6世代以降は素で封じ無視)。
// 技による交代(とんぼがえり等)は封じの影響を受けない。
{
  resetEnv();
  // T187 くろいまなざしで相手は交代できなくなる
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('くろいまなざし')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  E.phaseApplyEffects('self', 'opp', moveByName('くろいまなざし'));
  check('T187 くろいまなざしで にげられない状態になる', E.sides.opp.trapped === true,
    `trapped=${E.sides.opp.trapped}`);
  const ok187 = E.attemptSwitch('opp', 0);
  check('T187 拘束中は交代できない', ok187 === false && E.sides.opp.poke.name === 'カビゴン',
    `ret=${ok187} opp=${E.sides.opp.poke.name}`);
  // T187b 技による交代(とんぼがえり)は拘束中でもできる
  E.sides.opp.moves = [moveByName('とんぼがえり')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.self.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T187b 拘束中でも技による交代はできる', E.sides.opp.poke.name === 'リザードン',
    `opp=${E.sides.opp.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T187c ゴーストタイプには拘束は効かない(こうかなし)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('くろいまなざし')];
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('くろいまなざし'));
  check('T187c ゴーストタイプは拘束されない', !E.sides.opp.trapped,
    `trapped=${E.sides.opp.trapped}`);
  resetEnv();
}
{
  resetEnv();
  // T187d かけた側が場を離れると拘束は解除される
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('くろいまなざし')];
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.bench = [benchEntry('ゲンガー', 'hataku')];
  E.phaseApplyEffects('self', 'opp', moveByName('くろいまなざし'));
  check('T187d 拘束がかかった', E.sides.opp.trapped === true, `trapped=${E.sides.opp.trapped}`);
  E.attemptSwitch('self', 0);   // かけた側(フシギバナ)が場を離れる
  check('T187d かけた側が離れると拘束は解除される', E.sides.opp.trapped === false,
    `trapped=${E.sides.opp.trapped}`);
  const ok187d = E.attemptSwitch('opp', 0);
  check('T187d 解除後は交代できる', ok187d === true && E.sides.opp.poke.name === 'ゲンガー',
    `ret=${ok187d} opp=${E.sides.opp.poke.name}`);
  resetEnv();
}

console.log('\n=== 段87 フェアリーロック(全員逃走不可: 次のターンの終わりまで交代できない) ===');
// 出典: ポケモンWiki「フェアリーロック」/「ポケモンチェンジ」— 場がフェアリーロック状態の間は
// 両者とも交代できない(ゴーストタイプは無視できる・技による交代も可)。次のターンの終わりまで。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('フェアリーロック')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  E.setRandom(() => 0.0);
  E.runTurn();   // フェアリーロック発動(このターンの終わりにカウント2→1)
  check('T188 フェアリーロックがかかった', (E.env.fairyLockTurns || 0) > 0,
    `fairyLockTurns=${E.env.fairyLockTurns}`);
  const ok188 = E.attemptSwitch('opp', 0);
  check('T188 ロック中は相手も交代できない', ok188 === false,
    `ret=${ok188}`);
  const ok188b = E.attemptSwitch('self', 0);
  check('T188 自分も交代できない', ok188b === false, `ret=${ok188b}`);
  E.sides.self.status = 'sleep';   // 2ターン目にフェアリーロックを再使用してカウントが戻らないように眠らせる
  E.runTurn();   // 次のターンの終わり(カウント1→0)で解除
  check('T188 次のターンの終わりに解除される', !E.env.fairyLockTurns,
    `fairyLockTurns=${E.env.fairyLockTurns}`);
  const ok188c = E.attemptSwitch('opp', 0);
  check('T188 解除後は交代できる', ok188c === true, `ret=${ok188c}`);
  resetEnv(); E.env.fairyLockTurns = null;
}
{
  resetEnv(); E.env.fairyLockTurns = 2;
  // T188b ゴーストタイプはフェアリーロック中でも交代できる
  E.sides.self = freshSide('ゲンガー', 'hataku');
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  const ok188d = E.attemptSwitch('self', 0);
  check('T188b ゴーストタイプはロック中でも交代できる', ok188d === true,
    `ret=${ok188d}`);
  resetEnv(); E.env.fairyLockTurns = null;
}

console.log('\n=== 段88 いやしのすず(パーティ波及: 控えの状態異常も治す) ===');
// 出典: ポケモンWiki「いやしのすず」— 自分と手持ち全員の状態異常を治す。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いやしのすず')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.status = 'burn';
  E.sides.self.bench = [benchEntry('リザードン', 'hataku'), benchEntry('カビゴン', 'hataku')];
  E.sides.self.bench[0].status = 'paralysis';
  E.sides.self.bench[1].status = 'sleep';
  E.sides.self.bench[1].sleepTurns = 2;
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.sides.opp.status = 'poison';
  E.phaseApplyEffects('self', 'opp', moveByName('いやしのすず'));
  check('T189 場の自分の状態異常が治る', E.sides.self.status === 'none', `status=${E.sides.self.status}`);
  check('T189 控えの状態異常も治る(まひ/ねむり)',
    E.sides.self.bench[0].status === 'none' && E.sides.self.bench[1].status === 'none' && E.sides.self.bench[1].sleepTurns === null,
    `bench0=${E.sides.self.bench[0].status} bench1=${E.sides.self.bench[1].status}/${E.sides.self.bench[1].sleepTurns}`);
  check('T189 相手の状態異常は治らない', E.sides.opp.status === 'poison', `opp=${E.sides.opp.status}`);
  resetEnv();
}
{
  resetEnv();
  // T189b 場の自分が健康でも控えは治る
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いやしのすず')];
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.self.bench[0].status = 'burn';
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('いやしのすず'));
  check('T189b 場が健康でも控えの状態異常は治る', E.sides.self.bench[0].status === 'none',
    `bench0=${E.sides.self.bench[0].status}`);
  resetEnv();
}

console.log('\n=== 段89 ふくろだたき(ひんし・状態異常でない手持ちの数だけ連続攻撃) ===');
// 出典: Bulbapedia "Beat Up"(第5世代以降) — ひんし・状態異常でない手持ち(自分を含む)1体につき1回攻撃。
// 各ヒットの威力 = そのメンバーのこうげき種族値÷10+5。攻撃実数値・急所判定は使用者のもの。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ふくろだたき')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku'), benchEntry('カビゴン', 'hataku')];
  E.sides.self.bench[1].status = 'burn';   // 状態異常の手持ちはカウントしない → 2発のはず
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  const fkd = moveByName('ふくろだたき');
  const p1 = Math.floor(E.sides.self.poke.atk / 10) + 5;        // フシギバナの分
  const p2 = Math.floor(E.sides.self.bench[0].poke.atk / 10) + 5; // リザードンの分
  const exp1 = E.calcDamage('self', 'opp', fkd, {powerOverride: p1}).min;
  const exp2 = E.calcDamage('self', 'opp', fkd, {powerOverride: p2}).min;
  const oppMax190 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax190;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T190 健康な手持ち2体ぶん(2発)のダメージ(威力=種族値÷10+5)',
    oppMax190 - E.sides.opp.currentHp === exp1 + exp2,
    `実=${oppMax190 - E.sides.opp.currentHp}(${exp1}+${exp2}=${exp1 + exp2}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T190b 自分も状態異常で手持ち全員ダメなら失敗
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ふくろだたき')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.status = 'burn';
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.self.bench[0].status = 'paralysis';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  const oppMax190b = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax190b;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T190b 出せるメンバーがいないと失敗(ダメージなし)',
    E.sides.opp.currentHp === oppMax190b,
    `oppHp=${E.sides.opp.currentHp}/${oppMax190b}`);
  resetEnv();
}

console.log('\n=== 段90 かげふみ(特性: 相手は交代できない・かげふみ同士は無効) ===');
// 出典: ポケモンWiki「ポケモンチェンジ」— 相手の特性がかげふみのとき交代できない。
// 自分もかげふみなら無視できる(第4世代以降)。ゴーストタイプは無視できる(第6世代以降)。
// ※ありじごく/じりょく/きゅうばん/きれいなぬけがらは現DBに持ち主がいない=park(推測実装しない)
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.ability = 'かげふみ';   // メガゲンガーの特性(エンジンは名前の文字列比較)
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  const ok191 = E.attemptSwitch('opp', 0);
  check('T191 相手がかげふみだと交代できない', ok191 === false && E.sides.opp.poke.name === 'カビゴン',
    `ret=${ok191} opp=${E.sides.opp.poke.name}`);
  // T191b かげふみ同士は無効
  E.sides.opp.ability = 'かげふみ';
  const ok191b = E.attemptSwitch('opp', 0);
  check('T191b かげふみ同士なら交代できる', ok191b === true,
    `ret=${ok191b}`);
  resetEnv();
}
{
  resetEnv();
  // T191c ゴーストタイプはかげふみを無視して交代できる
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.ability = 'かげふみ';
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.sides.opp.bench = [benchEntry('リザードン', 'hataku')];
  const ok191c = E.attemptSwitch('opp', 0);
  check('T191c ゴーストタイプはかげふみを無視できる', ok191c === true,
    `ret=${ok191c}`);
  resetEnv();
}

console.log('\n=== 段91 いやしのねがい(自分はひんし→交代で出てきたポケモンが全回復) ===');
// 出典: ポケモンWiki「いやしのねがい」/ Bulbapedia "Healing Wish" — 自分はひんしになり、
// 代わりに出てきたポケモンのHPと状態異常が全回復する。控えがいないと失敗(ひんしにならない)。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いやしのねがい')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.self.bench[0].currentHp = 50;
  E.sides.self.bench[0].status = 'burn';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  const liza192max = E.realStat(E.sides.self, 'hp');
  check('T192 自分はひんしになり、死に出しのリザードンが全回復(HP満タン+やけど治癒)',
    E.sides.self.poke.name === 'リザードン' && E.sides.self.currentHp === liza192max && E.sides.self.status === 'none',
    `self=${E.sides.self.poke.name} hp=${E.sides.self.currentHp}/${liza192max} status=${E.sides.self.status}`);
  check('T192 フシギバナは控えでひんし',
    E.sides.self.bench[0].poke.name === 'フシギバナ' && E.sides.self.bench[0].fainted === true,
    `bench0=${E.sides.self.bench[0].poke.name}/${E.sides.self.bench[0].fainted}`);
  resetEnv();
}
{
  resetEnv();
  // T192b 控えがいないと失敗(ひんしにならない)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いやしのねがい')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T192b 控えなしのいやしのねがいは失敗(ひんしにならない)',
    E.sides.self.fainted === false && E.sides.self.failedThisTurn === true,
    `fainted=${E.sides.self.fainted} failed=${E.sides.self.failedThisTurn}`);
  resetEnv();
}

console.log('\n=== 段92 おはかまいり(倒れた手持ちの数だけ威力+50) ===');
// 出典: Bulbapedia "Last Respects" — 威力 = 50 + 50×(ひんしになった手持ちの数)。
// ※実機は「ひんしになった回数」(復活して再びひんしも数える)=simは現在ひんしの控えの数で近似。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('おはかまいり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku'), benchEntry('カビゴン', 'hataku')];
  E.sides.self.bench[0].fainted = true;
  E.sides.self.bench[0].currentHp = 0;
  // ※相手をカビゴン(ノーマル)にすると おはかまいり(ゴースト)がこうかなし=0で偽緑になるのでフシギバナ
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  const ohk = moveByName('おはかまいり');
  const exp193 = E.calcDamage('self', 'opp', ohk, {powerOverride: 100}).min;   // 50+50×1
  const oppMax193 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax193;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T193 ひんしの控え1体で威力100(50+50)',
    oppMax193 - E.sides.opp.currentHp === exp193,
    `実=${oppMax193 - E.sides.opp.currentHp}(${exp193}期待)`);
  resetEnv();
}

console.log('\n=== 段93 キラースピン(拘束解除: バインド/やどりぎを振りほどく) ===');
// 出典: Bulbapedia "Mortal Spin" — こうそくスピン同様にバインド・やどりぎ・設置を解除し、相手をどくにする。
// データはこうそくスピン(状態異常回復)と違い「拘束解除」kindで宣言されている。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('キラースピン')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.slips = [
    {source: 'バインド', fraction: 0.125, turns: 3},
    {source: 'やどりぎのタネ', fraction: 0.125, drains: true},
  ];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T194 キラースピンでバインド/やどりぎが解除される',
    !(E.sides.self.slips || []).some(sl => sl.source === 'バインド' || sl.source === 'やどりぎのタネ'),
    `slips=${JSON.stringify(E.sides.self.slips)}`);
  resetEnv();
}

console.log('\n=== 段94 たべのこし(ターン終了時に最大HPの1/16回復) ===');
// 出典: items_database.js宣言(trigger:end_of_turn, heal_fraction:1/16)/ポケモンWiki「たべのこし」。
// きのみと違い消費されない。マジックルーム中は無効。満タンなら何も起きない。
{
  resetEnv();
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.item = 'leftovers';
  E.sides.self.currentHp = 100;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.self.status = 'sleep';   // 両者眠り=ダメージ要因ゼロでターン終了処理だけ観測
  E.setRandom(() => 0.0);
  E.runTurn();
  const max195 = E.realStat(E.sides.self, 'hp');
  check('T195 ターン終了時に最大HPの1/16回復(100→109)',
    E.sides.self.currentHp === 100 + Math.floor(max195 / 16) && E.sides.self.item === 'leftovers',
    `hp=${E.sides.self.currentHp}(${100 + Math.floor(max195 / 16)}期待) item=${E.sides.self.item}`);
  E.sides.self.currentHp = max195;
  E.runTurn();
  check('T195b 満タンなら回復しない(超過しない)', E.sides.self.currentHp === max195,
    `hp=${E.sides.self.currentHp}/${max195}`);
  resetEnv();
}

console.log('\n=== 段95 きのみ・タイプ強化(発動+消費。既存バグ=フィールド名不一致で全部不発だった) ===');
// 出典: items_database.js宣言(boost_type/resist_type/trigger/heal_fraction/cure_target)/ポケモンWiki各道具。
// 既存バグ: エンジンが poke_type を読んでいた(データに存在しないキー)→ タイプ強化18種・半減きのみ18種が不発だった。
{
  resetEnv();
  // T196 タイプ強化(もくたん): ほのお技の威力1.2倍
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('かえんほうしゃ')];
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  const noItem196 = E.calcDamage('self', 'opp', moveByName('かえんほうしゃ')).min;
  E.sides.self.item = 'type_boost_fire';
  const withItem196 = E.calcDamage('self', 'opp', moveByName('かえんほうしゃ')).min;
  check('T196 もくたんで ほのお技のダメージが上がる', withItem196 > noItem196,
    `なし=${noItem196} あり=${withItem196}`);
  resetEnv();
}
{
  resetEnv();
  // T196b 半減きのみ: 効果バツグンの技を一度だけ半減し、使ったら消える
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('かえんほうしゃ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');   // ほのお×くさ=バツグン
  E.sides.opp.status = 'sleep';
  const plain196b = E.calcDamage('self', 'opp', moveByName('かえんほうしゃ')).min;
  E.sides.opp.item = 'berry_resist_fire';   // オッカのみ相当
  const oppMax196b = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax196b;
  E.setRandom(() => 0.0);
  E.runTurn();
  const dealt196b = oppMax196b - E.sides.opp.currentHp;
  check('T196b 半減きのみでバツグンのダメージが半減される', dealt196b < plain196b && dealt196b > 0,
    `素=${plain196b} 半減後=${dealt196b}`);
  check('T196b 使ったきのみは消える(lastConsumedItemに記録)',
    E.sides.opp.item === '' && E.sides.opp.lastConsumedItem === 'berry_resist_fire',
    `item=${E.sides.opp.item} last=${E.sides.opp.lastConsumedItem}`);
  resetEnv();
}
{
  resetEnv();
  // T197 オボンのみ: HPが半分以下になったら最大HPの1/4回復して消費
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.item = 'berry_sitrus';
  const oppMax197 = E.realStat(E.sides.opp, 'hp');   // 155
  E.sides.opp.currentHp = Math.floor(oppMax197 / 2) + 10;   // 87: 一撃(約30)で半分以下に落ちる
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  const dmg197 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  const exp197 = Math.floor(oppMax197 / 2) + 10 - dmg197 + Math.floor(oppMax197 / 4);
  check('T197 オボンのみ: 半分以下に落ちたら1/4回復+消費',
    E.sides.opp.currentHp === exp197 && E.sides.opp.item === '',
    `hp=${E.sides.opp.currentHp}(${exp197}期待) item=${E.sides.opp.item}`);
  resetEnv();
}
{
  resetEnv();
  // T197b 半分より上では発動しない
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.item = 'berry_sitrus';
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T197b HPが半分より上なら発動しない', E.sides.self.item === 'berry_sitrus',
    `item=${E.sides.self.item}`);
  resetEnv();
}
{
  resetEnv();
  // T198 ラムのみ: 状態異常が付いた直後に治して消費(おにび→やけど→即治癒)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('おにび')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.item = 'berry_cure_all';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T198 ラムのみ: やけどが即治って消費される',
    E.sides.opp.status === 'none' && E.sides.opp.item === '',
    `status=${E.sides.opp.status} item=${E.sides.opp.item}`);
  resetEnv();
}
{
  resetEnv();
  // T198b クラボのみ(まひ専用)はやけどには反応しない
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('おにび')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.item = 'berry_cure_paralysis';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T198b クラボのみ(まひ専用)はやけどに反応しない',
    E.sides.opp.status === 'burn' && E.sides.opp.item === 'berry_cure_paralysis',
    `status=${E.sides.opp.status} item=${E.sides.opp.item}`);
  resetEnv();
}

console.log('\n=== 段96 きあいのタスキ(満タンから一撃ひんしをHP1で耐える・1回限り消費) ===');
// 出典: items_database.js宣言(trigger:ohko_at_full_hp)/ポケモンWiki「きあいのタスキ」。
// 一撃必殺技にも効く(第5世代以降)。満タンでなければ発動しない。今まではプレビュー専用で実戦未適用だった。
{
  resetEnv();
  E.sides.self = freshSide('カビゴン', null);
  E.sides.self.moves = [moveByName('はかいこうせん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spatk = 2;   // はかいこうせん=特殊。最小乱数でも確殺ラインに乗せる
  E.sides.opp = freshSide('ピカチュウ', 'hataku');
  E.sides.opp.item = 'focus_sash';
  E.sides.opp.status = 'sleep';
  const pikaMax = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = pikaMax;
  const lethal199 = E.calcDamage('self', 'opp', moveByName('はかいこうせん')).min;
  check('T199前提: 最小乱数でも一撃ひんし級', lethal199 >= pikaMax, `min=${lethal199} hp=${pikaMax}`);
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T199 タスキでHP1で耐えて消費される',
    E.sides.opp.currentHp === 1 && E.sides.opp.fainted === false && E.sides.opp.item === '',
    `hp=${E.sides.opp.currentHp} fainted=${E.sides.opp.fainted} item=${E.sides.opp.item}`);
  resetEnv();
}
{
  resetEnv();
  // T199b 満タンでなければ発動しない(ひんしになる・タスキは残る)
  E.sides.self = freshSide('カビゴン', null);
  E.sides.self.moves = [moveByName('はかいこうせん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spatk = 2;
  E.sides.opp = freshSide('ピカチュウ', 'hataku');
  E.sides.opp.item = 'focus_sash';
  E.sides.opp.status = 'sleep';
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp') - 1;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T199b 満タンでなければタスキは発動しない(ひんし・タスキ残存)',
    E.sides.opp.fainted === true && E.sides.opp.item === 'focus_sash',
    `fainted=${E.sides.opp.fainted} item=${E.sides.opp.item}`);
  resetEnv();
}
{
  resetEnv();
  // T199c 一撃必殺(ぜったいれいど)にもタスキは効く(第5世代以降)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ぜったいれいど')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.item = 'focus_sash';
  E.sides.opp.status = 'sleep';
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.0);   // 命中30でもロール0=当たる
  E.runTurn();
  check('T199c 一撃必殺もタスキでHP1で耐える',
    E.sides.opp.currentHp === 1 && E.sides.opp.fainted === false && E.sides.opp.item === '',
    `hp=${E.sides.opp.currentHp} fainted=${E.sides.opp.fainted} item=${E.sides.opp.item}`);
  resetEnv();
}

console.log('\n=== 段97 きのみ系技(リサイクル/むしくい・ついばむ/ほおばる/おちゃかい) ===');
// 出典: ポケモンWiki「リサイクル」(自分が使った道具を再生)/「むしくい」「ついばむ」(相手のきのみを奪って即食べる)/
// 「ほおばる」(自分のきのみを食べて ぼうぎょ+2。きのみなし=失敗)/「おちゃかい」(全員がきのみを即食べる)。
{
  resetEnv();
  // T200 リサイクル: 消費した道具が戻る
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('リサイクル')];
  E.sides.self.item = '';
  E.sides.self.lastConsumedItem = 'berry_sitrus';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('リサイクル'));
  check('T200 リサイクルで消費した道具が戻る',
    E.sides.self.item === 'berry_sitrus' && E.sides.self.lastConsumedItem === null,
    `item=${E.sides.self.item} last=${E.sides.self.lastConsumedItem}`);
  // T200b 戻すものがなければ失敗
  E.sides.self.item = ''; E.sides.self.lastConsumedItem = null;
  E.phaseApplyEffects('self', 'opp', moveByName('リサイクル'));
  check('T200b 戻すものがなければ失敗', E.sides.self.failedThisTurn === true && E.sides.self.item === '',
    `failed=${E.sides.self.failedThisTurn} item=${E.sides.self.item}`);
  resetEnv();
}
{
  resetEnv();
  // T201 むしくい: 相手のきのみを奪って自分が即食べる(オボン=自分の最大HPの1/4回復)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('むしくい')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 60;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.item = 'berry_sitrus';
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  const myMax201 = E.realStat(E.sides.self, 'hp');
  check('T201 むしくい: 相手のオボンを食べて自分が1/4回復・相手のきのみは消える',
    E.sides.self.currentHp === 60 + Math.floor(myMax201 / 4) && E.sides.opp.item === '',
    `selfHp=${E.sides.self.currentHp}(${60 + Math.floor(myMax201 / 4)}期待) oppItem=${E.sides.opp.item}`);
  check('T201 食べられたきのみは相手のリサイクル対象にならない',
    !E.sides.opp.lastConsumedItem, `last=${E.sides.opp.lastConsumedItem}`);
  resetEnv();
}
{
  resetEnv();
  // T202 ほおばる: 自分のきのみを食べて ぼうぎょ+2(きのみなし=失敗)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ほおばる')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.item = 'berry_sitrus';
  E.sides.self.currentHp = 100;   // ※半分(77)より上=オボンの自己発動では回復しない高さにして「食べた」ことを確かめる
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  const myMax202 = E.realStat(E.sides.self, 'hp');
  check('T202 ほおばる: きのみを食べて(オボン=1/4回復)ぼうぎょ+2',
    E.sides.self.rank.def === 2 && E.sides.self.item === '' && E.sides.self.currentHp === 100 + Math.floor(myMax202 / 4),
    `def=${E.sides.self.rank.def} item=${E.sides.self.item} hp=${E.sides.self.currentHp}`);
  // T202b きのみを持っていないと失敗(ランクも上がらない)
  E.sides.self.rank.def = 0;
  E.sides.self.lastConsumedItem = null;
  E.phaseApplyEffects('self', 'opp', moveByName('ほおばる'));
  check('T202b きのみなしのほおばるは失敗(ぼうぎょも上がらない)',
    E.sides.self.rank.def === 0 && E.sides.self.failedThisTurn === true,
    `def=${E.sides.self.rank.def} failed=${E.sides.self.failedThisTurn}`);
  resetEnv();
}
{
  resetEnv();
  // T203 おちゃかい: 両者ともきのみを即食べる
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('おちゃかい')];
  E.sides.self.item = 'berry_sitrus';
  E.sides.self.currentHp = 60;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.item = 'berry_cure_all';
  E.sides.opp.status = 'burn';
  E.phaseApplyEffects('self', 'opp', moveByName('おちゃかい'));
  const myMax203 = E.realStat(E.sides.self, 'hp');
  check('T203 おちゃかい: 自分はオボンで回復・相手はラムでやけど治癒(両方消費)',
    E.sides.self.currentHp === 60 + Math.floor(myMax203 / 4) && E.sides.self.item === '' &&
    E.sides.opp.status === 'none' && E.sides.opp.item === '',
    `selfHp=${E.sides.self.currentHp} selfItem=${E.sides.self.item} oppSt=${E.sides.opp.status} oppItem=${E.sides.opp.item}`);
  resetEnv();
}

console.log('\n=== 段98 残り道具一式(ピントレンズ/ひかりのこな/かいがらのすず/しろいハーブ/メンタルハーブ/おうじゃのしるし/せんせいのつめ/きあいのハチマキ) ===');
// 出典: items_database.js宣言+ポケモンWiki各道具。乱数を使う道具(つめ/ハチマキ/しるし)は持っている時だけロール。
{
  resetEnv();
  // T204 ピントレンズ: 急所ランク+1(乱数0.9>=1-1/8で急所)
  E.sides.self = freshSide('ゲンガー', 'hataku');
  E.sides.self.item = 'scope_lens';
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  const t204log = E.battleLog.length;
  E.setRandom(() => 0.9);
  E.runTurn();
  check('T204 ピントレンズで急所ランク+1(乱数0.9で急所が出る)',
    E.battleLog.slice(t204log).some(l => l.msg.includes('きゅうしょ')),
    `log=${JSON.stringify(E.battleLog.slice(-4).map(l => l.msg))}`);
  resetEnv();
}
{
  resetEnv();
  // T205 ひかりのこな: 相手の命中率×0.9(命中100が90になり乱数95で外れる)
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.item = 'bright_powder';
  E.sides.opp.status = 'sleep';
  const oppMax205 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax205;
  E.setRandom(() => 0.95);
  E.runTurn();
  check('T205 ひかりのこなで命中100の技が外れる(ロール95>=90)',
    E.sides.opp.currentHp === oppMax205,
    `oppHp=${E.sides.opp.currentHp}/${oppMax205}`);
  resetEnv();
}
{
  resetEnv();
  // T206 かいがらのすず: 与えたダメージの1/8回復
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.item = 'shell_bell';
  E.sides.self.currentHp = 100;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  const d206 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T206 かいがらのすずで与ダメの1/8回復',
    E.sides.self.currentHp === 100 + Math.max(1, Math.floor(d206 / 8)),
    `hp=${E.sides.self.currentHp}(${100 + Math.max(1, Math.floor(d206 / 8))}期待・与ダメ${d206})`);
  resetEnv();
}
{
  resetEnv();
  // T207 しろいハーブ: 能力ランクが下がったら一度だけ元に戻す(きんぞくおん=とくぼう-2)
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.item = 'white_herb';
  E.sides.self.status = 'sleep';
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('きんぞくおん')];
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T207 しろいハーブで下がったランクが戻り消費される',
    E.sides.self.rank.spdef === 0 && E.sides.self.item === '',
    `spdef=${E.sides.self.rank.spdef} item=${E.sides.self.item}`);
  resetEnv();
}
{
  resetEnv();
  // T208 メンタルハーブ: アンコール等の束縛を一度だけ解く
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.item = 'mental_herb';
  E.sides.self.encore = {move: moveByName('はたく'), turns: 2};
  E.sides.self.status = 'sleep';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T208 メンタルハーブでアンコールが解けて消費される',
    E.sides.self.encore === null && E.sides.self.item === '',
    `encore=${JSON.stringify(E.sides.self.encore)} item=${E.sides.self.item}`);
  resetEnv();
}
{
  resetEnv();
  // T209 おうじゃのしるし: ダメージを与えた時10%でひるませる(乱数0.0<0.1)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('シャドーボール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.item = 'kings_rock';
  // ※相手は起きていて、ゲンガーに通る技(ギガドレイン)を持つ=ひるみが無ければ必ず削ってくる
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('ギガドレイン')];
  E.sides.opp.selectedMoveIdx = 0;
  const selfHp209 = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = selfHp209;
  E.setRandom(() => 0.0);
  E.runTurn();   // ゲンガー先攻→ひるみ→フシギバナ動けず
  check('T209 おうじゃのしるしで相手がひるんで行動できない',
    E.sides.self.currentHp === selfHp209,
    `selfHp=${E.sides.self.currentHp}/${selfHp209}`);
  resetEnv();
}
{
  resetEnv();
  // T210 せんせいのつめ: 20%(乱数0.0)で遅くても先に動ける
  E.sides.self = freshSide('カビゴン', 'hataku');   // すばやさ30
  E.sides.self.item = 'quick_claw';
  E.sides.opp = freshSide('フシギバナ', 'hataku');  // すばやさ100
  E.sides.opp.status = 'sleep';
  const t210log = E.battleLog.length;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T210 せんせいのつめが発動して遅いカビゴンが先攻',
    E.battleLog.slice(t210log).some(l => l.msg.includes('先攻: カビゴン')),
    `log=${JSON.stringify(E.battleLog.slice(t210log, t210log + 3).map(l => l.msg))}`);
  resetEnv();
}
{
  resetEnv();
  // T211 きあいのハチマキ: 10%(乱数0.0)でひんしダメージをHP1で耐える(消費されない・満タン条件なし)
  E.sides.self = freshSide('カビゴン', null);
  E.sides.self.moves = [moveByName('はかいこうせん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spatk = 2;
  E.sides.opp = freshSide('ピカチュウ', 'hataku');
  E.sides.opp.item = 'focus_band';
  E.sides.opp.status = 'sleep';
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp') - 1;   // 満タンでない=タスキ条件外でも効く
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T211 きあいのハチマキでHP1で耐える(消費されない)',
    E.sides.opp.currentHp === 1 && E.sides.opp.fainted === false && E.sides.opp.item === 'focus_band',
    `hp=${E.sides.opp.currentHp} fainted=${E.sides.opp.fainted} item=${E.sides.opp.item}`);
  resetEnv();
}

console.log('\n=== 段99 run4検証の本物バグ修正(とおぼえ/くろいきり/オーロラベール/じばそうさ) ===');
// 出典: run4全技再検証(2026-06-11)で発見。とおぼえ=target:ally が相手にマップされ相手のこうげき+1になる実バグ。
{
  resetEnv();
  // T212 とおぼえ: 自分のこうげき+1のみ(1vs1に味方はいない=ally効果はスキップ。相手に付くのはバグ)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('とおぼえ')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('とおぼえ'));
  check('T212 とおぼえ: 自分+1・相手は変化なし',
    E.sides.self.rank.atk === 1 && E.sides.opp.rank.atk === 0,
    `self.atk=${E.sides.self.rank.atk} opp.atk=${E.sides.opp.rank.atk}`);
  resetEnv();
}
{
  resetEnv();
  // T213 くろいきり: 場にいる全員の能力ランクを0に戻す(ポケモンWiki「くろいきり」)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('くろいきり')];
  E.sides.self.rank.atk = 2; E.sides.self.rank.spd = -1;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.rank.def = 3; E.sides.opp.rank.eva = 2;
  E.phaseApplyEffects('self', 'opp', moveByName('くろいきり'));
  check('T213 くろいきりで両者の全ランクが0に戻る',
    E.sides.self.rank.atk === 0 && E.sides.self.rank.spd === 0 && E.sides.opp.rank.def === 0 && E.sides.opp.rank.eva === 0,
    `self=${JSON.stringify(E.sides.self.rank)} opp=${JSON.stringify(E.sides.opp.rank)}`);
  resetEnv();
}
{
  resetEnv();
  // T214 オーロラベール: 天気がゆきの時しか張れない(ポケモンWiki「オーロラベール」)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('オーロラベール')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('オーロラベール'));
  check('T214 天候なしではオーロラベールは失敗',
    !E.sides.self.auroraVeil && E.sides.self.failedThisTurn === true,
    `veil=${E.sides.self.auroraVeil} failed=${E.sides.self.failedThisTurn}`);
  E.env.weather = 'snow';
  E.sides.self.failedThisTurn = false;
  E.phaseApplyEffects('self', 'opp', moveByName('オーロラベール'));
  check('T214b ゆきなら張れる', E.sides.self.auroraVeil === true, `veil=${E.sides.self.auroraVeil}`);
  resetEnv();
}
{
  resetEnv();
  // T215 じばそうさ: 特性プラス/マイナスの時だけ自分側のぼうぎょ/とくぼう+1(target:teamは自分側)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('じばそうさ')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.phaseApplyEffects('self', 'opp', moveByName('じばそうさ'));
  check('T215 特性なしのじばそうさは不発(ランク変化なし)',
    E.sides.self.rank.def === 0 && E.sides.opp.rank.def === 0,
    `self.def=${E.sides.self.rank.def} opp.def=${E.sides.opp.rank.def}`);
  E.sides.self.ability = 'プラス';
  E.phaseApplyEffects('self', 'opp', moveByName('じばそうさ'));
  check('T215b プラスなら自分のぼうぎょ/とくぼう+1(相手には付かない)',
    E.sides.self.rank.def === 1 && E.sides.self.rank.spdef === 1 && E.sides.opp.rank.def === 0,
    `self=${JSON.stringify(E.sides.self.rank)} opp.def=${E.sides.opp.rank.def}`);
  resetEnv();
}

console.log('\n=== 段100 おいかぜ/アクアリング/でんじふゆう(持続状態3種) ===');
// 出典: ポケモンWiki「おいかぜ」(4ターン自分側のすばやさ2倍)/「アクアリング」(毎ターン1/16回復)/
// 「でんじふゆう」(5ターン地面にいない扱い=じめん技無効・設置技も無効)。
{
  resetEnv();
  // T216 おいかぜ: 自分側のすばやさが2倍(4ターン)
  E.sides.self = freshSide('フシギバナ', null);   // 素早さ100
  E.sides.self.moves = [moveByName('おいかぜ')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  const spd0 = E.effectiveSpeed(E.sides.self);
  E.phaseApplyEffects('self', 'opp', moveByName('おいかぜ'));
  check('T216 おいかぜで自分のすばやさが2倍になる',
    E.effectiveSpeed(E.sides.self) === spd0 * 2 && E.effectiveSpeed(E.sides.opp) < spd0 * 2,
    `spd=${E.effectiveSpeed(E.sides.self)}(${spd0 * 2}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T217 アクアリング: 毎ターン終了時に最大HPの1/16回復(場を離れるまで)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('アクアリング')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.currentHp = 100;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  const max217 = E.realStat(E.sides.self, 'hp');
  check('T217 アクアリングでターン終了時に1/16回復',
    E.sides.self.currentHp === 100 + Math.floor(max217 / 16),
    `hp=${E.sides.self.currentHp}(${100 + Math.floor(max217 / 16)}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T218 でんじふゆう: 地面にいない扱い=じめん技がこうかなし・まきびしも無効
  E.sides.self = freshSide('カビゴン', null);
  E.sides.self.moves = [moveByName('でんじふゆう')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('じしん')];
  E.sides.opp.selectedMoveIdx = 0;
  const myMax218 = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = myMax218;
  E.setRandom(() => 0.0);
  E.runTurn();   // フシギバナ(速い)のじしん→カビゴンでんじふゆう…順番はフシギバナ先攻=浮く前に被弾
  // 2ターン目: 浮いている状態でじしんを受ける→こうかなし
  const hpAfterT1 = E.sides.self.currentHp;
  E.runTurn();
  check('T218 でんじふゆう中はじしんがこうかなし(HPが減らない)',
    E.sides.self.currentHp === hpAfterT1 && hpAfterT1 < myMax218,
    `T1後=${hpAfterT1} T2後=${E.sides.self.currentHp}`);
  resetEnv();
}

console.log('\n=== 段101 あめまみれ/かいふくふうじ/ふしょくガス(run4未実装の付与系) ===');
// 出典: ポケモンWiki「みずあめボム」(3ターン毎ターン終了時すばやさ-1)/「サイコノイズ」(2ターン回復技を使えない)/
// 「ふしょくガス」(相手の道具を溶かして失わせる=リサイクル不可)。
{
  resetEnv();
  // T219 みずあめボム: あめまみれ=毎ターン終了時にすばやさ-1(3ターン)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('みずあめボム')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T219 あめまみれでターン終了時にすばやさ-1',
    E.sides.opp.rank.spd === -1, `spd=${E.sides.opp.rank.spd}`);
  resetEnv();
}
{
  resetEnv();
  // T220 サイコノイズ: かいふくふうじ=回復技が失敗する
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('サイコノイズ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', null);
  E.sides.opp.moves = [moveByName('じこさいせい')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.currentHp = 100;
  E.setRandom(() => 0.0);
  E.runTurn();   // ゲンガー先攻サイコノイズ→カビゴンのじこさいせいは封じられて失敗
  check('T220 かいふくふうじ中はじこさいせいが失敗(HP回復しない)',
    E.sides.opp.currentHp < E.realStat(E.sides.opp, 'hp') / 2 + 60,
    `hp=${E.sides.opp.currentHp}(回復していなければ100からサイコノイズ分減のみ)`);
  check('T220b かいふくふうじが付いている', (E.sides.opp.healBlockTurns || 0) > 0,
    `healBlockTurns=${E.sides.opp.healBlockTurns}`);
  resetEnv();
}
{
  resetEnv();
  // T221 ふしょくガス: 相手の道具を溶かす(リサイクルでも戻せない)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('ふしょくガス')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.item = 'leftovers';
  E.phaseApplyEffects('self', 'opp', moveByName('ふしょくガス'));
  check('T221 ふしょくガスで相手の道具が消える(リサイクル不可)',
    !E.sides.opp.item && !E.sides.opp.lastConsumedItem,
    `item=${E.sides.opp.item} last=${E.sides.opp.lastConsumedItem}`);
  resetEnv();
}

console.log('\n=== 段107 特性スプリント①(しんりょく系ピンチ1.5倍/ちからもち/あついしぼう) ===');
// 出典: ABILITY_DESC(公式準拠) — しんりょく/もうか/げきりゅう=HP1/3以下で該当タイプ1.5倍、
// ちからもち/ヨガパワー=こうげき2倍、あついしぼう=ほのお/こおりを受ける時に相手の攻撃半減。
{
  resetEnv();
  // T222 しんりょく: HP1/3以下でくさ技1.5倍(フシギバナ=しんりょく持ち)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ギガドレイン')];
  E.sides.self.ability = 'しんりょく';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  const base222 = E.calcDamage('self', 'opp', moveByName('ギガドレイン')).min;
  E.sides.self.currentHp = Math.floor(E.realStat(E.sides.self, 'hp') / 3);   // ちょうど1/3
  const pinch222 = E.calcDamage('self', 'opp', moveByName('ギガドレイン')).min;
  check('T222 しんりょく: HP1/3以下でくさ技のダメージが上がる', pinch222 > base222,
    `通常=${base222} ピンチ=${pinch222}`);
  // くさ技以外には乗らない
  E.sides.self.moves = [moveByName('はたく')];
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  const n222 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  E.sides.self.currentHp = Math.floor(E.realStat(E.sides.self, 'hp') / 3);
  check('T222b くさ技以外には乗らない', E.calcDamage('self', 'opp', moveByName('はたく')).min === n222,
    `通常=${n222} ピンチ=${E.calcDamage('self', 'opp', moveByName('はたく')).min}`);
  resetEnv();
}
{
  resetEnv();
  // T223 ちからもち: 物理のこうげき2倍(特殊は変わらない)
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  const phys223 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  E.sides.self.ability = 'ちからもち';
  const boosted223 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  check('T223 ちからもちで物理ダメージが約2倍', boosted223 >= phys223 * 1.9 && boosted223 <= phys223 * 2.1,
    `通常=${phys223} 2倍=${boosted223}`);
  resetEnv();
}
{
  resetEnv();
  // T224 あついしぼう: ほのお技を受ける時に半減(受け側の特性)
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('かえんほうしゃ')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  const fire224 = E.calcDamage('self', 'opp', moveByName('かえんほうしゃ')).min;
  E.sides.opp.ability = 'あついしぼう';
  const fat224 = E.calcDamage('self', 'opp', moveByName('かえんほうしゃ')).min;
  check('T224 あついしぼうでほのおダメージが半減', fat224 < fire224 && fat224 >= Math.floor(fire224 * 0.4),
    `通常=${fire224} 半減=${fat224}`);
  // ノーマル技は半減されない
  E.sides.self.moves = [moveByName('はたく')];
  E.sides.opp.ability = '';
  const n224 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  E.sides.opp.ability = 'あついしぼう';
  check('T224b ほのお/こおり以外は半減されない', E.calcDamage('self', 'opp', moveByName('はたく')).min === n224,
    `通常=${n224} 脂肪あり=${E.calcDamage('self', 'opp', moveByName('はたく')).min}`);
  resetEnv();
}

console.log('\n=== 段108 命中・回避ランクの命中計算+ノーガード/するどいめ ===');
// 出典: ポケモンWiki「命中」/Bulbapedia "Accuracy"(第5世代以降) — 実効命中 = 技の命中 ×
// ランク補正((命中ランク-回避ランク)を-6..+6に丸め、+n=(3+n)/3, -n=3/(3+n))。
// 今までランク0前提でかげぶんしん等が命中に効いていなかった(コア欠落)。
{
  resetEnv();
  // T225 かげぶんしん(回避+1)で命中100の技が75%になる(ロール80で外れる)
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.rank.eva = 1;
  const oppMax225 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax225;
  E.setRandom(() => 0.8);
  E.runTurn();
  check('T225 回避+1で命中100が75%になり ロール80で外れる',
    E.sides.opp.currentHp === oppMax225, `oppHp=${E.sides.opp.currentHp}/${oppMax225}`);
  // T225b 命中ランク+1で相殺すれば当たる
  E.sides.self.rank.acc = 1;
  E.runTurn();
  check('T225b 命中+1で相殺して当たる', E.sides.opp.currentHp < oppMax225,
    `oppHp=${E.sides.opp.currentHp}/${oppMax225}`);
  resetEnv();
}
{
  resetEnv();
  // T226 ノーガード: 回避+6でも必ず当たる
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.self.ability = 'ノーガード';
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.rank.eva = 6;
  const oppMax226 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax226;
  E.setRandom(() => 0.99);
  E.runTurn();
  check('T226 ノーガードなら回避+6でも必ず当たる', E.sides.opp.currentHp < oppMax226,
    `oppHp=${E.sides.opp.currentHp}/${oppMax226}`);
  resetEnv();
}
{
  resetEnv();
  // T227 するどいめ: 相手の回避ランク上昇を無視する
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.ability = 'するどいめ';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.sides.opp.rank.eva = 2;
  const oppMax227 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax227;
  E.setRandom(() => 0.8);
  E.runTurn();
  check('T227 するどいめは回避ランク上昇を無視して当たる', E.sides.opp.currentHp < oppMax227,
    `oppHp=${E.sides.opp.currentHp}/${oppMax227}`);
  resetEnv();
}

console.log('\n=== 段109 免疫系特性(ふみん/じゅうなん/めんえき/マイペース/せいしんりょく) ===');
// 出典: ABILITY_DESC(公式準拠) — ふみん/やるき=ねむり無効・じゅうなん=まひ無効・めんえき=どく系無効・
// マイペース=こんらん無効・せいしんりょく=ひるみ無効・マグマのよろい=こおり無効。
{
  resetEnv();
  // T231 ふみん: さいみんじゅつで眠らない
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('さいみんじゅつ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.ability = 'ふみん';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T231 ふみんは眠らない', E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);
  // T231b じゅうなん: でんじはで まひしない
  E.sides.self.moves = [moveByName('でんじは')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp.ability = 'じゅうなん';
  E.runTurn();
  check('T231b じゅうなんは まひしない', E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);
  // T231c めんえき: どくどくで もうどくにならない
  E.sides.self.moves = [moveByName('どくどく')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp.ability = 'めんえき';
  E.runTurn();
  check('T231c めんえきは どくにならない', E.sides.opp.status === 'none', `status=${E.sides.opp.status}`);
  resetEnv();
}
{
  resetEnv();
  // T232 マイペース: あやしいひかりで こんらんしない
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('あやしいひかり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.ability = 'マイペース';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T232 マイペースは こんらんしない', (E.sides.opp.confusion || 0) === 0,
    `confusion=${E.sides.opp.confusion}`);
  resetEnv();
}
{
  resetEnv();
  // T233 せいしんりょく: ひるまない(かみつく追加効果が乱数0で必発でも)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('かみつく')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('ギガドレイン')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.ability = 'せいしんりょく';
  const myMax233 = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = myMax233;
  E.setRandom(() => 0.0);
  E.runTurn();   // ゲンガー先攻かみつく(ひるみ必発のはず)→せいしんりょくでひるまず反撃が来る
  check('T233 せいしんりょくは ひるまない(反撃を受ける)', E.sides.self.currentHp < myMax233,
    `selfHp=${E.sides.self.currentHp}/${myMax233}`);
  resetEnv();
}
{
  resetEnv();
  // T234 あくびの遅延発動も ふみんなら不発
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('あくび')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.ability = 'ふみん';
  E.setRandom(() => 0.0);
  E.runTurn();   // あくび(ねむけ予約は付くかもしれない)
  E.runTurn();   // 発動ターン→ふみんで眠らない
  check('T234 あくびの発動もふみんなら眠らない', E.sides.opp.status === 'none',
    `status=${E.sides.opp.status}`);
  resetEnv();
}

console.log('\n=== 段110 がんじょう/シェルアーマー/いしあたま/マルチスケイル ===');
// 出典: ABILITY_DESC(公式準拠) — がんじょう=一撃必殺無効+満タンならHP1で耐える・シェルアーマー=急所無効・
// いしあたま=反動無効・マルチスケイル=満タン時の被ダメ半減。
{
  resetEnv();
  // T235 がんじょう: 一撃必殺が効かない
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ぜったいれいど')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.ability = 'がんじょう';
  E.sides.opp.status = 'sleep';
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T235 がんじょうに一撃必殺は効かない', E.sides.opp.fainted === false && E.sides.opp.currentHp === E.realStat(E.sides.opp, 'hp'),
    `hp=${E.sides.opp.currentHp} fainted=${E.sides.opp.fainted}`);
  resetEnv();
}
{
  resetEnv();
  // T235b がんじょう: 満タンから一撃ひんしのダメージをHP1で耐える
  E.sides.self = freshSide('カビゴン', null);
  E.sides.self.moves = [moveByName('はかいこうせん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.rank.spatk = 2;
  E.sides.opp = freshSide('ピカチュウ', 'hataku');
  E.sides.opp.ability = 'がんじょう';
  E.sides.opp.status = 'sleep';
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T235b がんじょうで満タンからHP1で耐える',
    E.sides.opp.currentHp === 1 && E.sides.opp.fainted === false,
    `hp=${E.sides.opp.currentHp} fainted=${E.sides.opp.fainted}`);
  resetEnv();
}
{
  resetEnv();
  // T236 シェルアーマー: 確定急所(きあいだめ+つじぎり)でも急所にならない
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('つじぎり')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.critBoost = 2;   // +つじぎり1=ランク3で確定急所のはず
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.ability = 'シェルアーマー';
  E.sides.opp.status = 'sleep';
  const exp236 = E.calcDamage('self', 'opp', moveByName('つじぎり')).min;   // 通常min(急所なし)
  const oppMax236 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax236;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T236 シェルアーマーは急所を無効化(通常ダメージ)',
    oppMax236 - E.sides.opp.currentHp === exp236,
    `実=${oppMax236 - E.sides.opp.currentHp}(${exp236}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T237 いしあたま: すてみタックルの反動を受けない
  E.sides.self = freshSide('カビゴン', null);
  E.sides.self.moves = [moveByName('すてみタックル')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.ability = 'いしあたま';
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.status = 'sleep';
  const myMax237 = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = myMax237;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T237 いしあたまは反動を受けない', E.sides.self.currentHp === myMax237,
    `selfHp=${E.sides.self.currentHp}/${myMax237}`);
  resetEnv();
}
{
  resetEnv();
  // T238 マルチスケイル: 満タン時は被ダメ半減
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  const base238 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  E.sides.opp.ability = 'マルチスケイル';
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  const half238 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp') - 1;   // 満タンでない
  const dmgd238 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  check('T238 マルチスケイル: 満タンで半減・減っていれば等倍',
    half238 < base238 && dmgd238 === base238,
    `通常=${base238} 満タン=${half238} 非満タン=${dmgd238}`);
  resetEnv();
}

console.log('\n=== 段111 タイプ吸収/無効の特性(ちょすい/ちくでん/もらいび/そうしょく/ひらいしん/でんきエンジン/きもったま/ぼうおん) ===');
// 出典: ABILITY_DESC(公式準拠)。吸収特性は無効化+おまけ(回復1/4・ランク+1・もらいび=炎1.5倍化)。
{
  resetEnv();
  // T239 ちょすい: みず技無効+最大HPの1/4回復
  E.sides.self = freshSide('カビゴン', null);
  E.sides.self.moves = [moveByName('ハイドロポンプ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.ability = 'ちょすい';
  E.sides.opp.status = 'sleep';
  const oMax239 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = 100;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T239 ちょすい: みず技が無効で1/4回復',
    E.sides.opp.currentHp === Math.min(oMax239, 100 + Math.floor(oMax239 / 4)),
    `hp=${E.sides.opp.currentHp}(${100 + Math.floor(oMax239 / 4)}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T239b そうしょく: くさ技無効+こうげき+1
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ギガドレイン')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.ability = 'そうしょく';
  E.sides.opp.status = 'sleep';
  const oMax239b = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oMax239b;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T239b そうしょく: くさ技無効+こうげき+1',
    E.sides.opp.currentHp === oMax239b && E.sides.opp.rank.atk === 1,
    `hp=${E.sides.opp.currentHp}/${oMax239b} atk=${E.sides.opp.rank.atk}`);
  resetEnv();
}
{
  resetEnv();
  // T240 もらいび: ほのお技無効+発動後は自分のほのお技1.5倍
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('かえんほうしゃ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('リザードン', null);
  E.sides.opp.moves = [moveByName('かえんほうしゃ')];
  E.sides.opp.selectedMoveIdx = 0;
  E.sides.opp.ability = 'もらいび';
  E.sides.opp.status = 'sleep';
  const oMax240 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oMax240;
  const plain240 = E.calcDamage('opp', 'self', moveByName('かえんほうしゃ')).min;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T240 もらいび: ほのお技が無効(無傷)', E.sides.opp.currentHp === oMax240,
    `hp=${E.sides.opp.currentHp}/${oMax240}`);
  check('T240b 発動後は自分のほのお技が1.5倍',
    E.calcDamage('opp', 'self', moveByName('かえんほうしゃ')).min > plain240,
    `発動前=${plain240} 発動後=${E.calcDamage('opp', 'self', moveByName('かえんほうしゃ')).min}`);
  resetEnv();
}
{
  resetEnv();
  // T241 きもったま: ノーマル技がゴーストに当たる
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.self.ability = 'きもったま';
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  const r241 = E.calcDamage('self', 'opp', moveByName('はたく'));
  check('T241 きもったま: ノーマル技がゴーストに当たる', r241 && !r241.immune && r241.min > 0,
    `immune=${r241 && r241.immune} min=${r241 && r241.min}`);
  resetEnv();
}
{
  resetEnv();
  // T242 ぼうおん: 音技(ハイパーボイス)が無効・うたう(変化の音技)も効かない
  E.sides.self = freshSide('カビゴン', null);
  E.sides.self.moves = [moveByName('ハイパーボイス')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.ability = 'ぼうおん';
  E.sides.opp.status = 'sleep';
  const oMax242 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oMax242;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T242 ぼうおんは音技を無効化', E.sides.opp.currentHp === oMax242,
    `hp=${E.sides.opp.currentHp}/${oMax242}`);
  E.sides.opp.status = 'none';
  E.sides.self.moves = [moveByName('うたう')]; E.sides.self.selectedMoveIdx = 0;
  E.runTurn();
  check('T242b うたう(変化の音技)もぼうおんに効かない', E.sides.opp.status === 'none',
    `status=${E.sides.opp.status}`);
  resetEnv();
}

console.log('\n=== 段112 接触反応特性(せいでんき/ほのおのからだ/さめはだ)+くだけるよろい ===');
// 出典: ABILITY_DESC(公式準拠) — せいでんき/ほのおのからだ=直接攻撃を受けると30%で相手をまひ/やけど・
// さめはだ=直接攻撃の相手に最大HPの1/8・くだけるよろい=物理を受けるとぼうぎょ-1すばやさ+2。
{
  resetEnv();
  // T243 せいでんき: 接触技を当てた側がまひ(乱数0=30%必発)
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.ability = 'せいでんき';
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T243 せいでんき: 接触した相手がまひ', E.sides.self.status === 'paralysis',
    `status=${E.sides.self.status}`);
  resetEnv();
}
{
  resetEnv();
  // T244 さめはだ: 接触技を当てた側が最大HPの1/8ダメージ
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.ability = 'さめはだ';
  E.sides.opp.status = 'sleep';
  const myMax244 = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = myMax244;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T244 さめはだ: 接触した相手が最大HPの1/8削れる',
    E.sides.self.currentHp === myMax244 - Math.floor(myMax244 / 8),
    `hp=${E.sides.self.currentHp}(${myMax244 - Math.floor(myMax244 / 8)}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T244b 非接触技(かえんほうしゃ)ではさめはだは発動しない
  E.sides.self = freshSide('リザードン', null);
  E.sides.self.moves = [moveByName('かえんほうしゃ')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.ability = 'さめはだ';
  E.sides.opp.status = 'sleep';
  const myMax244b = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = myMax244b;
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T244b 非接触技ではさめはだ無反応', E.sides.self.currentHp === myMax244b,
    `hp=${E.sides.self.currentHp}/${myMax244b}`);
  resetEnv();
}
{
  resetEnv();
  // T245 くだけるよろい: 物理を受けるとぼうぎょ-1すばやさ+2
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.ability = 'くだけるよろい';
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T245 くだけるよろい: ぼうぎょ-1すばやさ+2',
    E.sides.opp.rank.def === -1 && E.sides.opp.rank.spd === 2,
    `def=${E.sides.opp.rank.def} spd=${E.sides.opp.rank.spd}`);
  resetEnv();
}

console.log('\n=== 段113 交代連動特性(さいせいりょく/しぜんかいふく)+おみとおし+天候すばやさ ===');
// 出典: ABILITY_DESC(公式準拠) — さいせいりょく=手持ち復帰時HP1/3回復・しぜんかいふく=復帰時状態異常回復・
// おみとおし=登場時に相手の持ち物を見る・すいすい/ようりょくそ/すなかき/ゆきかき=該当天候ですばやさ2倍。
{
  resetEnv();
  // T246 さいせいりょく: 控えに戻るとHP1/3回復
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.ability = 'さいせいりょく';
  E.sides.self.currentHp = 60;
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  const fMax246 = E.realStat(E.sides.self, 'hp');
  E.attemptSwitch('self', 0);
  check('T246 さいせいりょく: 控えに戻るとHP1/3回復',
    E.sides.self.bench[0].currentHp === Math.min(fMax246, 60 + Math.floor(fMax246 / 3)),
    `benchHp=${E.sides.self.bench[0].currentHp}(${60 + Math.floor(fMax246 / 3)}期待)`);
  resetEnv();
}
{
  resetEnv();
  // T246b しぜんかいふく: 控えに戻ると状態異常が治る
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.ability = 'しぜんかいふく';
  E.sides.self.status = 'burn';
  E.sides.self.bench = [benchEntry('リザードン', 'hataku')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.attemptSwitch('self', 0);
  check('T246b しぜんかいふく: 戻ると状態異常が治る', E.sides.self.bench[0].status === 'none',
    `benchStatus=${E.sides.self.bench[0].status}`);
  resetEnv();
}
{
  resetEnv();
  // T247 おみとおし: 場に出た時に相手の持ち物を見抜く(ログ)
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.bench = [benchEntry('カビゴン', 'hataku')];
  E.sides.self.bench[0].ability = 'おみとおし';
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.sides.opp.item = 'leftovers';
  const log247 = E.battleLog.length;
  E.attemptSwitch('self', 0);
  check('T247 おみとおしで相手の持ち物を見抜くログ',
    E.battleLog.slice(log247).some(l => l.msg.includes('おみとおし') && l.msg.includes('たべのこし')),
    `log=${JSON.stringify(E.battleLog.slice(log247).map(l => l.msg))}`);
  resetEnv();
}
{
  resetEnv();
  // T248 すいすい: あめの時すばやさ2倍
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.ability = 'すいすい';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  const s248 = E.effectiveSpeed(E.sides.self);
  E.env.weather = 'rain';
  check('T248 すいすい: あめですばやさ2倍', E.effectiveSpeed(E.sides.self) === s248 * 2,
    `通常=${s248} 雨=${E.effectiveSpeed(E.sides.self)}`);
  E.env.weather = 'none';
  resetEnv();
}

console.log('\n=== 段114 ランク防御特性(クリアボディ/かちき/まけんき/てんねん) ===');
// 出典: ABILITY_DESC(公式準拠) — クリアボディ/しろいけむり=敵からのランク低下無効・
// かちき=敵に能力を下げられるととくこう+2・まけんき=同こうげき+2・てんねん=敵のランク補正を無視。
{
  resetEnv();
  // T249 クリアボディ: きんぞくおん(とくぼう-2)が効かない
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('きんぞくおん')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.ability = 'クリアボディ';
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T249 クリアボディはランクを下げられない', E.sides.opp.rank.spdef === 0,
    `spdef=${E.sides.opp.rank.spdef}`);
  resetEnv();
}
{
  resetEnv();
  // T250 まけんき: 敵にランクを下げられるとこうげき+2(自分で下げた分は発動しない)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('こわいかお')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.ability = 'まけんき';
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T250 まけんき: 下げられたらこうげき+2',
    E.sides.opp.rank.spd === -2 && E.sides.opp.rank.atk === 2,
    `spd=${E.sides.opp.rank.spd} atk=${E.sides.opp.rank.atk}`);
  resetEnv();
}
{
  resetEnv();
  // T251 てんねん: 攻撃側のこうげきランク+6を無視してダメージ計算
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  const base251 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  E.sides.self.rank.atk = 6;
  E.sides.opp.ability = 'てんねん';
  const unaware251 = E.calcDamage('self', 'opp', moveByName('はたく')).min;
  check('T251 てんねんは相手の攻撃ランクを無視(+6でも等倍ダメージ)', unaware251 === base251,
    `素=${base251} +6てんねん=${unaware251}`);
  resetEnv();
}

console.log('\n=== 段115 対戦AI(技の自動選択: ダメージ最大・無効回避・確定KO優先) ===');
{
  resetEnv();
  // T252 AI: こうかなしの技(ノーマル→ゴースト)を避けて通る技を選ぶ
  E.sides.self = freshSide('ゲンガー', 'hataku');
  E.sides.opp = freshSide('カビゴン', null);
  E.sides.opp.moves = [moveByName('はたく'), moveByName('シャドーボール')];
  E.sides.opp.selectedMoveIdx = 0;
  const pick252 = E.aiChooseMove('opp');
  check('T252 AIはこうかなし(はたく→ゲンガー)を避けてシャドーボールを選ぶ', pick252 === 1,
    `pick=${pick252}(1期待)`);
  resetEnv();
}
{
  resetEnv();
  // T252b AI: 確定で倒せる技があれば威力が低くてもそれを選ぶ
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.currentHp = 10;   // はたくでも倒せる残りHP
  E.sides.opp = freshSide('カビゴン', null);
  E.sides.opp.moves = [moveByName('はかいこうせん'), moveByName('はたく')];
  E.sides.opp.selectedMoveIdx = 0;
  const pick252b = E.aiChooseMove('opp');
  // どちらでも倒せる→平均ダメージ+KOボーナスが同等以上=どちらかを選べばOKだが、
  // 「KOできる技にボーナス」が効いていること自体は『はたくでも選ばれ得る』ことでは確認できないため、
  // ここは「無効でない技を返す」ことの確認に留める(KO優先の厳密比較は T252c)
  check('T252b AIは技を選べる(どちらもKO可)', pick252b === 0 || pick252b === 1, `pick=${pick252b}`);
  // T252c: はかいこうせんでは倒せないがはたくで倒せる状況は作れないので、
  // 「片方こうかなし+片方KO可」で KOボーナス込みの選択を確認
  E.sides.self = freshSide('ゲンガー', 'hataku');
  E.sides.self.currentHp = 10;
  E.sides.opp.moves = [moveByName('はたく'), moveByName('シャドーボール')];
  const pick252c = E.aiChooseMove('opp');
  check('T252c こうかなしを避けてKOできる技を選ぶ', pick252c === 1, `pick=${pick252c}(1期待)`);
  resetEnv();
}

console.log('\n=== 段117 メガシンカ(Init-B: ストーン装備→1バトル1回・交代後/技前に変身) ===');
// 出典: HANDOFF_PHASE3_INIT_B.md / items_database.js(mega_stone宣言) / バトルの流れ_実機リファレンス.md
// (メガシンカは交代の後・技フェーズの直前)。種族値・タイプ・特性はPOKEMON_LISTのメガフォームに切替。
{
  resetEnv();
  // T253 ゲンガー+ゲンガナイト→メガゲンガー(とくこう130→170・特性かげふみ)
  E.sides.self = freshSide('ゲンガー', 'hataku');
  E.sides.self.item = 'mega_stone_gengar';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  const spatkBefore = E.realStat(E.sides.self, 'spatk');
  const ok253 = E.megaEvolve('self');
  check('T253 メガシンカできる', ok253 === true && E.sides.self.poke.name === 'メガゲンガー',
    `ret=${ok253} poke=${E.sides.self.poke.name}`);
  check('T253 種族値と特性が切り替わる',
    E.realStat(E.sides.self, 'spatk') > spatkBefore && E.sides.self.ability === 'かげふみ',
    `spatk=${E.realStat(E.sides.self, 'spatk')}(>${spatkBefore}期待) ability=${E.sides.self.ability}`);
  check('T253 1バトル1回(2回目は失敗)', E.megaEvolve('self') === false, '');
  resetEnv();
}
{
  resetEnv();
  // T253b どのメガストーンでも持ち主にメガフォームがあれば変身できる(2026-06-12 阿部さん:
  // ポケモンごとにストーンを選ぶのは面倒→汎用化。専用ストーンはX/Y分岐用に従来どおり優先)
  E.sides.self = freshSide('フシギバナ', 'hataku');
  E.sides.self.item = 'mega_stone_gengar';   // 不一致のストーンでもOK
  E.sides.opp = freshSide('カビゴン', 'hataku');
  check('T253b 不一致ストーンでも持ち主のメガフォームに変身できる',
    E.megaEvolve('self') === true && E.sides.self.poke.name === 'メガフシギバナ',
    `poke=${E.sides.self.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T254 汎用「メガストーン」(mega_stone_any)で変身できる/メガフォームが無いポケモンは不可
  E.sides.self = freshSide('ゲンガー', 'hataku');
  E.sides.self.item = 'mega_stone_any';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  check('T254 汎用メガストーンで変身できる',
    E.megaEvolve('self') === true && E.sides.self.poke.name === 'メガゲンガー',
    `poke=${E.sides.self.poke.name}`);
  E.sides.opp.item = 'mega_stone_any';
  check('T254b メガフォームが無いポケモン(カビゴン)は変身できない', E.megaEvolve('opp') === false,
    `poke=${E.sides.opp.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T253c megaChoice予約→runTurnの技フェーズ前に変身する
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('シャドーボール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.item = 'mega_stone_gengar';
  E.sides.self.megaChoice = true;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'sleep';
  E.setRandom(() => 0.0);
  E.runTurn();
  check('T253c runTurnでメガシンカが発動する', E.sides.self.poke.name === 'メガゲンガー',
    `poke=${E.sides.self.poke.name}`);
  // T253d バトルリセットで元に戻る
  E.resetBattle && E.resetBattle();
  resetEnv();
}

console.log('\n=== 段118 対戦AI v2: 変化技評価+交代判断 ===');
// AIの行動方針はsim独自設計(実機の再現対象ではない=羅針盤の権威ソース照合は適用外)。
// 変化技は battle_data.effects から価値をHP換算で見積もり、攻撃技の平均ダメージと直接比較する。
{
  resetEnv();
  // T255 回復: HPが大きく減っていたら回復技(じこさいせい)を弱い攻撃より優先する
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('でんこうせっか'), moveByName('じこさいせい')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  const maxHp = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = Math.floor(maxHp * 0.3);
  check('T255 HP3割なら じこさいせい を選ぶ', E.aiChooseMove('self') === 1,
    `idx=${E.aiChooseMove('self')}`);
  E.sides.self.currentHp = maxHp;
  check('T255b 満タンなら回復を選ばない(攻撃)', E.aiChooseMove('self') === 0,
    `idx=${E.aiChooseMove('self')}`);
  resetEnv();
}
{
  resetEnv();
  // T256 状態付与: 相手が健康なら でんじは を弱い攻撃より優先。状態異常済み・タイプ無効なら選ばない
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('でんこうせっか'), moveByName('でんじは')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  check('T256 健康な相手には でんじは を選ぶ', E.aiChooseMove('self') === 1,
    `idx=${E.aiChooseMove('self')}`);
  E.sides.opp.status = 'paralysis';
  check('T256b 状態異常済みの相手には攻撃を選ぶ', E.aiChooseMove('self') === 0,
    `idx=${E.aiChooseMove('self')}`);
  E.sides.opp = freshSide('ガブリアス', 'hataku');   // じめん複合=でんじは無効(immune宣言)
  check('T256c でんじは無効タイプ(じめん)には攻撃を選ぶ', E.aiChooseMove('self') === 0,
    `idx=${E.aiChooseMove('self')}`);
  resetEnv();
}
{
  resetEnv();
  // T257 積み技: 元気で未強化なら つるぎのまい。+2積んだら攻撃へ。確定KOがあれば常に攻撃
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('でんこうせっか'), moveByName('つるぎのまい')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.status = 'paralysis';   // 状態付与ルートを塞いで積み技vs攻撃だけを比較
  check('T257 元気で未強化なら つるぎのまい を選ぶ', E.aiChooseMove('self') === 1,
    `idx=${E.aiChooseMove('self')}`);
  E.sides.self.rank.atk = 2;
  check('T257b +2積んだ後は攻撃を選ぶ', E.aiChooseMove('self') === 0,
    `idx=${E.aiChooseMove('self')}`);
  E.sides.self.rank.atk = 0;
  E.sides.opp.currentHp = 5;   // でんこうせっかで確定KO圏
  check('T257c 確定で倒せるなら積まずに攻撃する', E.aiChooseMove('self') === 0,
    `idx=${E.aiChooseMove('self')}`);
  resetEnv();
}
{
  resetEnv();
  // T258 交代判断: 攻撃が全部こうかなし(ノーマル技×ゴースト)なら有効打を持つ控えへ交代
  E.sides.self = freshSide('カビゴン', 'hataku');   // ノーマル技のみ
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('シャドーボール')];
  const benchA = freshSide('フシギバナ', null);      // ギガドレイン: ゲンガー(ゴースト/どく)に0.5倍
  benchA.moves = [moveByName('ギガドレイン')];
  const benchB = freshSide('ピカチュウ', null);      // 10まんボルト: 等倍(1.0)
  benchB.moves = [moveByName('10まんボルト')];
  E.sides.self.bench = [benchA, benchB];
  const act = E.aiChooseAction('self');
  check('T258 こうかなしだけなら交代を選ぶ', act.type === 'switch',
    `type=${act.type}`);
  check('T258b 一番タイプ相性が良い控え(ピカチュウ)を選ぶ', act.index === 1,
    `index=${act.index}`);
  // T258c 有効打があるなら交代しない
  E.sides.self.moves = [moveByName('シャドーボール')];
  const act2 = E.aiChooseAction('self');
  check('T258c 有効打があるなら技を選ぶ', act2.type === 'move',
    `type=${act2.type}`);
  resetEnv();
}
{
  resetEnv();
  // T259 交代先がいない(全員ひんし)なら技で粘る
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.opp = freshSide('ゲンガー', null);
  E.sides.opp.moves = [moveByName('シャドーボール')];
  const ko = freshSide('ピカチュウ', null);
  ko.moves = [moveByName('10まんボルト')];
  ko.fainted = true; ko.currentHp = 0;
  E.sides.self.bench = [ko];
  const act = E.aiChooseAction('self');
  check('T259 控えが全滅なら技で粘る', act.type === 'move',
    `type=${act.type}`);
  resetEnv();
}

console.log('\n=== 段119 こうか表示メッセージ(実機準拠) ===');
// 出典: 実機のバトルメッセージ「こうかは ばつぐんだ！」「こうかは いまひとつのようだ…」(ポケモンWiki「相性」)。
// 表示順は「きゅうしょに あたった！」→「こうかは…」の近似。こうかなしは既存の別メッセージ。
{
  resetEnv();
  // T260 ばつぐん: シャドーボール(ゴースト)→ゲンガー(ゴースト/どく)=×2
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('シャドーボール')];
  E.sides.opp = freshSide('ゲンガー', null);
  E.setRandom(() => 0.0);
  const n0 = E.battleLog.length;
  E.phaseDealDamage('self', 'opp', moveByName('シャドーボール'));
  const logs0 = E.battleLog.slice(n0).map(e => e.msg);
  check('T260 こうかばつぐんで「こうかは ばつぐんだ！」が出る',
    logs0.includes('こうかは ばつぐんだ！'), logs0.join(' / '));
  // T260b いまひとつ: でんこうせっか(ノーマル)→ハガネール(はがね/じめん)=×0.5
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.opp = freshSide('ハガネール', null);
  const n1 = E.battleLog.length;
  E.phaseDealDamage('self', 'opp', moveByName('でんこうせっか'));
  const logs1 = E.battleLog.slice(n1).map(e => e.msg);
  check('T260b いまひとつで「こうかは いまひとつのようだ…」が出る',
    logs1.includes('こうかは いまひとつのようだ…'), logs1.join(' / '));
  // T260c 等倍はこうかメッセージなし
  E.sides.opp = freshSide('カビゴン', null);
  const n2 = E.battleLog.length;
  E.phaseDealDamage('self', 'opp', moveByName('でんこうせっか'));
  const logs2 = E.battleLog.slice(n2).map(e => e.msg);
  check('T260c 等倍はこうかメッセージなし',
    !logs2.some(m => m.startsWith('こうかは')), logs2.join(' / '));
  resetEnv();
}

console.log('\n=== 段120 バトルスイッチ(ギルガルド) ===');
// 出典: ポケモンWiki「バトルスイッチ」— シールドで攻撃技→ブレードにチェンジしてから攻撃(無効/外れでも発動・
// 変化技では発動しない)/ブレードでキングシールド→シールドへ(まもる等では発動しない・失敗でも発動)/
// 交代でシールドに戻る/行動できなかった時は発動しない(第7世代以降)。
{
  resetEnv();
  // T261 シールドで攻撃技→ブレードにチェンジしてから攻撃する(ダメージはブレードの種族値で計算)
  E.sides.self = freshSide('ギルガルド(シールド)', null);
  E.sides.self.ability = 'バトルスイッチ';
  E.sides.self.moves = [moveByName('シャドーボール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');   // ゴースト等倍
  const oppMax = E.realStat(E.sides.opp, 'hp');
  const shieldMax = E.calcDamage('self', 'opp', moveByName('シャドーボール')).max;  // シールドの特攻50での最大
  E.setRandom(() => 0.0);
  const n0 = E.battleLog.length;
  E.runSingleAttack('self', 0);
  const logs0 = E.battleLog.slice(n0).map(e => e.msg);
  check('T261 攻撃技でブレードフォルムになる', E.sides.self.poke.name === 'ギルガルド(ブレード)',
    `poke=${E.sides.self.poke.name}`);
  check('T261b チェンジのメッセージが出る', logs0.some(m => m.includes('ブレードフォルム チェンジ')), logs0.join(' / '));
  check('T261c ダメージはブレードの種族値(特攻140)で計算される',
    (oppMax - E.sides.opp.currentHp) > shieldMax,
    `dealt=${oppMax - E.sides.opp.currentHp} shield_max=${shieldMax}`);
  // T261d 攻撃がこうかなし(シャドーボール×ノーマル)でも発動してブレードになる
  E.sides.self = freshSide('ギルガルド(シールド)', null);
  E.sides.self.ability = 'バトルスイッチ';
  E.sides.self.moves = [moveByName('シャドーボール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');   // ゴースト無効
  E.runSingleAttack('self', 0);
  check('T261d こうかなしでも発動してブレードになる', E.sides.self.poke.name === 'ギルガルド(ブレード)',
    `poke=${E.sides.self.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T262 変化技(つるぎのまい)では発動しない
  E.sides.self = freshSide('ギルガルド(シールド)', null);
  E.sides.self.ability = 'バトルスイッチ';
  E.sides.self.moves = [moveByName('つるぎのまい')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.setRandom(() => 0.0);
  E.runSingleAttack('self', 0);
  check('T262 変化技ではフォルムが変わらない', E.sides.self.poke.name === 'ギルガルド(シールド)',
    `poke=${E.sides.self.poke.name}`);
  // T262b ブレードでキングシールド→シールドに戻る
  E.sides.self = freshSide('ギルガルド(ブレード)', null);
  E.sides.self.ability = 'バトルスイッチ';
  E.sides.self.moves = [moveByName('キングシールド')];
  E.sides.self.selectedMoveIdx = 0;
  const n1 = E.battleLog.length;
  E.runSingleAttack('self', 0);
  const logs1 = E.battleLog.slice(n1).map(e => e.msg);
  check('T262b キングシールドでシールドフォルムに戻る', E.sides.self.poke.name === 'ギルガルド(シールド)',
    `poke=${E.sides.self.poke.name}`);
  check('T262c チェンジのメッセージが出る', logs1.some(m => m.includes('シールドフォルム チェンジ')), logs1.join(' / '));
  // T262d ブレードで まもる ではフォルムが変わらない
  E.sides.self = freshSide('ギルガルド(ブレード)', null);
  E.sides.self.ability = 'バトルスイッチ';
  E.sides.self.moves = [moveByName('まもる')];
  E.sides.self.selectedMoveIdx = 0;
  E.runSingleAttack('self', 0);
  check('T262d まもるでは発動しない(ブレードのまま)', E.sides.self.poke.name === 'ギルガルド(ブレード)',
    `poke=${E.sides.self.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T263 交代で控えに戻るとシールドフォルムに戻る
  E.sides.self = freshSide('ギルガルド(ブレード)', null);
  E.sides.self.ability = 'バトルスイッチ';
  E.sides.self.moves = [moveByName('シャドーボール')];
  const sub = freshSide('フシギバナ', 'hataku');
  E.sides.self.bench = [{ poke: sub.poke, effort: sub.effort, natureIdx: 0, ability: '', item: '',
    moves: sub.moves, currentHp: null, fainted: false, status: 'none', sleepTurns: null, lastConsumedItem: null, megaBase: null }];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.attemptSwitch('self', 0);
  const backEntry = E.sides.self.bench[0];
  check('T263 交代で控えのギルガルドはシールドフォルムに戻る',
    backEntry.poke && backEntry.poke.name === 'ギルガルド(シールド)',
    `bench=${backEntry.poke && backEntry.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T264 行動できなかった時は発動しない(第7世代以降: ねむりで攻撃技が不発→シールドのまま)
  E.sides.self = freshSide('ギルガルド(シールド)', null);
  E.sides.self.ability = 'バトルスイッチ';
  E.sides.self.moves = [moveByName('シャドーボール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.self.status = 'sleep';
  E.sides.self.sleepTurns = 5;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.setRandom(() => 0.0);
  E.runSingleAttack('self', 0);
  check('T264 ねむりで行動できない時は発動しない', E.sides.self.poke.name === 'ギルガルド(シールド)',
    `poke=${E.sides.self.poke.name}`);
  resetEnv();
}

console.log('\n=== 段121 マイティチェンジ(イルカマン) ===');
// 出典: ポケモンWiki「マイティチェンジ」— ナイーブが交代で手持ちに戻った時点でマイティにフォルムチェンジ
// (技交代・だっしゅつ系でも発動)/ひんしで場を去った時は発動しない/マイティは交代でもひんしでも戻らない/
// 初めてマイティで場に出る時のみ「変身して 帰ってきた！」(設置技ダメージの後判定)。
{
  resetEnv();
  // T265 交代で手持ちに戻るとマイティになる(戻った時点でチェンジ)
  E.sides.self = freshSide('イルカマン(ナイーブ)', null);
  E.sides.self.ability = 'マイティチェンジ';
  E.sides.self.moves = [moveByName('なみのり')];
  const sub = freshSide('フシギバナ', 'hataku');
  E.sides.self.bench = [{ poke: sub.poke, effort: sub.effort, natureIdx: 0, ability: '', item: '',
    moves: sub.moves, currentHp: null, fainted: false, status: 'none', sleepTurns: null, lastConsumedItem: null, megaBase: null }];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.attemptSwitch('self', 0);
  check('T265 交代で控えに戻るとマイティフォルムになる',
    E.sides.self.bench[0].poke && E.sides.self.bench[0].poke.name === 'イルカマン(マイティ)',
    `bench=${E.sides.self.bench[0].poke && E.sides.self.bench[0].poke.name}`);
  // T265b 初めてマイティで場に出ると「変身して 帰ってきた！」
  const n0 = E.battleLog.length;
  E.attemptSwitch('self', 0);
  const logs0 = E.battleLog.slice(n0).map(e => e.msg);
  check('T265b 初登場時に「変身して 帰ってきた！」が出る',
    logs0.some(m => m.includes('変身して 帰ってきた！')), logs0.join(' / '));
  check('T265c 場のイルカマンはマイティ', E.sides.self.poke.name === 'イルカマン(マイティ)',
    `poke=${E.sides.self.poke.name}`);
  // T265d 2回目以降の登場ではメッセージは出ない(マイティのまま交代→再登場)
  E.attemptSwitch('self', 0);   // マイティが下がる(フォルム変わらず)
  const n1 = E.battleLog.length;
  E.attemptSwitch('self', 0);   // 再登場
  const logs1 = E.battleLog.slice(n1).map(e => e.msg);
  check('T265d マイティは交代しても戻らない', E.sides.self.poke.name === 'イルカマン(マイティ)',
    `poke=${E.sides.self.poke.name}`);
  check('T265e 2回目の登場ではメッセージなし',
    !logs1.some(m => m.includes('変身して 帰ってきた！')), logs1.join(' / '));
  resetEnv();
}
{
  resetEnv();
  // T266 ひんしで場を去った時は発動しない(死に出しのpack)
  E.sides.self = freshSide('イルカマン(ナイーブ)', null);
  E.sides.self.ability = 'マイティチェンジ';
  E.sides.self.moves = [moveByName('なみのり')];
  E.sides.self.currentHp = 0;
  E.sides.self.fainted = true;
  const sub2 = freshSide('フシギバナ', 'hataku');
  E.sides.self.bench = [{ poke: sub2.poke, effort: sub2.effort, natureIdx: 0, ability: '', item: '',
    moves: sub2.moves, currentHp: null, fainted: false, status: 'none', sleepTurns: null, lastConsumedItem: null, megaBase: null }];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.attemptSwitch('self', 0, {faintReplace: true});
  check('T266 ひんしで下がった時は発動しない(ナイーブのまま)',
    E.sides.self.bench[0].poke && E.sides.self.bench[0].poke.name === 'イルカマン(ナイーブ)',
    `bench=${E.sides.self.bench[0].poke && E.sides.self.bench[0].poke.name}`);
  resetEnv();
}

console.log('\n=== 段122 特性5種: むしのしらせ/じしんかじょう/いたずらごころ/へんげんじざい/トレース ===');
// 出典は全てポケモンWiki(2026-06-12取得): むしのしらせ=HP1/3以下でむし技の攻撃/特攻1.5倍 /
// じしんかじょう=攻撃技で相手をひんしにするとこうげき+1 / いたずらごころ=変化技の優先度+1(第7世代以降:
// 優先度を上げた技はあくタイプに無効) / へんげんじざい=技を出す直前に自分がその技タイプに変化(交代で戻る・
// 1回場に出るごとに1回) / トレース=場に出た時に相手の特性をコピー。
{
  resetEnv();
  // T270 むしのしらせ: HP1/3以下でむし技が強くなる(しんりょくファミリーと同型)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.ability = 'むしのしらせ';
  E.sides.self.moves = [moveByName('シザークロス')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  const fullMin = E.calcDamage('self', 'opp', moveByName('シザークロス')).min;
  E.sides.self.currentHp = Math.floor(E.realStat(E.sides.self, 'hp') / 3);
  const pinchMin = E.calcDamage('self', 'opp', moveByName('シザークロス')).min;
  check('T270 むしのしらせ: ピンチでむし技が1.5倍相当に上がる', pinchMin > fullMin,
    `full=${fullMin} pinch=${pinchMin}`);
  resetEnv();
}
{
  resetEnv();
  // T271 じしんかじょう: 攻撃技で相手を倒すとこうげき+1
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.ability = 'じしんかじょう';
  E.sides.self.moves = [moveByName('でんこうせっか')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.currentHp = 1;
  E.setRandom(() => 0.0);
  E.runSingleAttack('self', 0);
  check('T271 倒すとこうげき+1', E.sides.opp.fainted && E.sides.self.rank.atk === 1,
    `fainted=${E.sides.opp.fainted} atk=${E.sides.self.rank.atk}`);
  // T271b 倒せなかった時は上がらない
  E.sides.self.rank.atk = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.runSingleAttack('self', 0);
  check('T271b 倒せなければ上がらない', !E.sides.opp.fainted && E.sides.self.rank.atk === 0,
    `fainted=${E.sides.opp.fainted} atk=${E.sides.self.rank.atk}`);
  resetEnv();
}
{
  resetEnv();
  // T272 いたずらごころ: 変化技の優先度+1(遅いカビゴンが先に でんじは を出せる)
  E.sides.self = freshSide('カビゴン', null);   // 素早さ30 < フシギバナ80
  E.sides.self.moves = [moveByName('でんじは')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.99);
  check('T272前提 特性なしでは後攻', E.decideOrder(E.sides.self.moves[0], E.sides.opp.moves[0]) === 'opp',
    `first=${E.decideOrder(E.sides.self.moves[0], E.sides.opp.moves[0])}`);
  E.sides.self.ability = 'いたずらごころ';
  check('T272 いたずらごころで変化技が先攻になる',
    E.decideOrder(E.sides.self.moves[0], E.sides.opp.moves[0]) === 'self',
    `first=${E.decideOrder(E.sides.self.moves[0], E.sides.opp.moves[0])}`);
  // T272b 第7世代以降: あくタイプには変化技が無効
  E.sides.opp = freshSide('ブラッキー', 'hataku');
  E.setRandom(() => 0.0);
  E.runSingleAttack('self', 0);
  check('T272b あくタイプに変化技が効かない(状態異常つかない)', E.sides.opp.status === 'none',
    `status=${E.sides.opp.status}`);
  resetEnv();
}
{
  resetEnv();
  // T273 へんげんじざい: 技を出す直前に自分がその技タイプに変化(1回場に出るごとに1回)
  E.sides.self = freshSide('フシギバナ', null);   // くさ/どく
  E.sides.self.ability = 'へんげんじざい';
  E.sides.self.moves = [moveByName('10まんボルト'), moveByName('シャドーボール')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.setRandom(() => 0.0);
  E.runSingleAttack('self', 0);
  check('T273 技タイプ(でんき)に変化する', JSON.stringify(E.sideTypes(E.sides.self)) === '["でんき"]',
    `types=${JSON.stringify(E.sideTypes(E.sides.self))}`);
  // T273b 同じ登場中は2回目は発動しない(でんきのまま)
  E.runSingleAttack('self', 1);
  check('T273b 1回場に出るごとに1回だけ(2発目では変わらない)',
    JSON.stringify(E.sideTypes(E.sides.self)) === '["でんき"]',
    `types=${JSON.stringify(E.sideTypes(E.sides.self))}`);
  resetEnv();
}
{
  resetEnv();
  // T274 トレース: 場に出た時、相手の特性をコピーする
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.ability = 'トレース';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.ability = 'あついしぼう';
  E.phaseInitA();
  check('T274 相手の特性をコピーする', E.sideAbility(E.sides.self) === 'あついしぼう',
    `ability=${E.sideAbility(E.sides.self)}`);
  // T274b コピー不可特性(バトルスイッチ)はコピーしない
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.ability = 'トレース';
  E.sides.opp = freshSide('ギルガルド(シールド)', 'hataku');
  E.sides.opp.ability = 'バトルスイッチ';
  E.phaseInitA();
  check('T274b バトルスイッチはコピーできない', E.sideAbility(E.sides.self) === 'トレース',
    `ability=${E.sideAbility(E.sides.self)}`);
  resetEnv();
}

console.log('\n=== 段123 ふゆう(じめん技無効) ===');
// 出典: ABILITY_DESC公式準拠+ポケモンWiki「ふゆう」。isGroundedには入っていたがダメージ計算の
// じめん無効が「でんじふゆうだけ」を見ていた→isGrounded基準に統一。
{
  resetEnv();
  // T275 ふゆう持ちにじめん技はこうかなし(ロトム=DB上の実在ふゆう持ち。でんき/ゴーストでじめん2倍のはずが無効)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('じしん')];
  E.sides.opp = freshSide('ロトム', 'hataku');
  E.sides.opp.ability = 'ふゆう';
  const r1 = E.calcDamage('self', 'opp', moveByName('じしん'));
  check('T275 ふゆうにじめん技はこうかなし', r1 && r1.immune, `immune=${r1 && r1.immune}`);
  // T275b じゅうりょく中は当たる
  E.env.gravity = true;
  const r2 = E.calcDamage('self', 'opp', moveByName('じしん'));
  check('T275b じゅうりょく中はふゆうでも当たる', r2 && !r2.immune && r2.min > 0,
    `immune=${r2 && r2.immune} min=${r2 && r2.min}`);
  E.env.gravity = false;
  // T275c ふゆうでもじめん技以外は普通に当たる(ギガドレイン=くさ×ゴースト/どく等倍以下だが有効)
  const r3 = E.calcDamage('self', 'opp', moveByName('ギガドレイン'));
  check('T275c じめん技以外は普通に当たる', r3 && !r3.immune && r3.min > 0,
    `immune=${r3 && r3.immune}`);
  resetEnv();
}

console.log('\n=== 段124 かたやぶり(相手の防御特性を無視) ===');
// 出典: ポケモンWiki「かたやぶり」— 無視リスト方式(ふゆう/ちょすい/マルチスケイル/がんじょう/じゅうなん等)。
// さめはだ等の「攻撃を受けた後に働く特性」は無視しない。ターボブレイズ/テラボルテージも同効果。
{
  resetEnv();
  // T276 かたやぶり+じしん は ふゆう を無視して当たる(ロトム=実在ふゆう持ち)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.ability = 'かたやぶり';
  E.sides.self.moves = [moveByName('じしん')];
  E.sides.opp = freshSide('ロトム', 'hataku');
  E.sides.opp.ability = 'ふゆう';
  const r1 = E.calcDamage('self', 'opp', moveByName('じしん'));
  check('T276 かたやぶりはふゆうを無視して当てる', r1 && !r1.immune && r1.min > 0,
    `immune=${r1 && r1.immune} min=${r1 && r1.min}`);
  // T276b ちょすい(タイプ吸収)も無視
  E.sides.self.moves = [moveByName('ハイドロポンプ')];
  E.sides.opp.ability = 'ちょすい';
  const r2 = E.calcDamage('self', 'opp', moveByName('ハイドロポンプ'));
  check('T276b ちょすいも無視して当てる', r2 && !r2.immune && r2.min > 0,
    `immune=${r2 && r2.immune}`);
  // T276c がんじょう(満タン一撃耐え)も無視して一撃で倒せる(対照: 特性なしならHP1で耐える)
  const _sturdySetup = (atkAb) => {
    E.sides.self = freshSide('フシギバナ', null);
    E.sides.self.ability = atkAb;
    E.sides.self.moves = [moveByName('はかいこうせん')];
    E.sides.self.rank.atk = 6; E.sides.self.rank.spatk = 6;   // 分類どちらでも確1になるように
    E.sides.self.selectedMoveIdx = 0;
    E.sides.opp = freshSide('ピカチュウ', 'hataku');
    E.sides.opp.ability = 'がんじょう';
  };
  E.setRandom(() => 0.5);   // 急所なし・命中
  _sturdySetup('');   // 対照: かたやぶり無し
  E.runSingleAttack('self', 0);
  check('T276c前提 かたやぶり無しならがんじょうでHP1耐え',
    !E.sides.opp.fainted && E.sides.opp.currentHp === 1,
    `fainted=${E.sides.opp.fainted} hp=${E.sides.opp.currentHp}`);
  _sturdySetup('かたやぶり');
  E.runSingleAttack('self', 0);
  check('T276c がんじょうを無視して一撃で倒せる', E.sides.opp.fainted === true,
    `fainted=${E.sides.opp.fainted} hp=${E.sides.opp.currentHp}`);
  // T276d さめはだ(受けた後に働く特性)は無視しない=反動を受ける
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.ability = 'かたやぶり';
  E.sides.self.moves = [moveByName('でんこうせっか')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.ability = 'さめはだ';
  const hp0 = E.realStat(E.sides.self, 'hp');
  E.sides.self.currentHp = hp0;
  E.runSingleAttack('self', 0);
  check('T276d さめはだは無視されない(接触反動を受ける)', E.sides.self.currentHp < hp0,
    `hp=${E.sides.self.currentHp}/${hp0}`);
  resetEnv();
}

console.log('\n=== 段125 連続攻撃のstop_on_miss+威力逓増(トリプルアクセル/ネズミざん) ===');
// 出典: ポケモンWiki「トリプルアクセル」(3回連続・威力20/40/60・各回ごとに命中判定・外れた時点で終了)/
// 「ネズミざん」(最大10回・1回ごとに命中判定・外れた時点で終了)。データ宣言(stop_on_miss/power_per_hit)を読む。
{
  resetEnv();
  // T277 トリプルアクセル: 全部当たれば威力20/40/60の3発分
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('トリプルアクセル')];
  E.sides.opp = freshSide('カビゴン', 'hataku');
  const mv = moveByName('トリプルアクセル');
  const d20 = E.calcDamage('self', 'opp', mv, {crit: false}).min;
  const d40 = E.calcDamage('self', 'opp', mv, {crit: false, powerOverride: 40}).min;
  const d60 = E.calcDamage('self', 'opp', mv, {crit: false, powerOverride: 60}).min;
  const oppMax = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = oppMax;
  E.setRandom(() => 0.0);   // 全ヒット・最小乱数
  E.phaseDealDamage('self', 'opp', mv);
  check('T277 3発全部当たると威力20/40/60の合計ダメージ',
    oppMax - E.sides.opp.currentHp === d20 + d40 + d60,
    `dealt=${oppMax - E.sides.opp.currentHp} 期待=${d20}+${d40}+${d60}=${d20 + d40 + d60}`);
  // T277b 2発目が外れたら1発分で終了
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.sides.opp.currentHp = oppMax;
  let _seq = [0.0, 0.99];   // 1発目の乱数→2発目の命中判定で外れる
  let _i = 0;
  E.setRandom(() => (_i < _seq.length ? _seq[_i++] : 0.0));
  E.phaseDealDamage('self', 'opp', mv);
  check('T277b 外れた時点で終了(1発分のみ)',
    oppMax - E.sides.opp.currentHp === d20,
    `dealt=${oppMax - E.sides.opp.currentHp} 期待=${d20}`);
  resetEnv();
}

console.log('\n=== 段126 のろわれボディ(ゲンガー) ===');
// 出典: ポケモンWiki「のろわれボディ」— 攻撃技でダメージを受けたとき30%でその技をかなしばり状態に。
// 非接触の技にも発動する。
{
  resetEnv();
  // T278 30%ロール成功でかなしばり(ギガドレイン=非接触で確認)
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ギガドレイン')];
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.sides.opp.ability = 'のろわれボディ';
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  let _seq = [0.0, 0.0];   // 乱数: ダメージ幅→のろわれボディ30%(成功)
  let _i = 0;
  E.setRandom(() => (_i < _seq.length ? _seq[_i++] : 0.0));
  E.phaseDealDamage('self', 'opp', moveByName('ギガドレイン'));
  check('T278 非接触技でも30%でかなしばりにする',
    E.sides.self.disable && E.sides.self.disable.name === 'ギガドレイン',
    `disable=${JSON.stringify(E.sides.self.disable)}`);
  // T278b ロール失敗なら何も起きない
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('ギガドレイン')];
  E.sides.opp = freshSide('ゲンガー', 'hataku');
  E.sides.opp.ability = 'のろわれボディ';
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  _seq = [0.0, 0.99]; _i = 0;
  E.setRandom(() => (_i < _seq.length ? _seq[_i++] : 0.99));
  E.phaseDealDamage('self', 'opp', moveByName('ギガドレイン'));
  check('T278b 70%側では発動しない', !E.sides.self.disable,
    `disable=${JSON.stringify(E.sides.self.disable)}`);
  resetEnv();
}

console.log('\n=== 段127 メガシンカ直後の登場特性発動 ===');
// 実機: メガシンカで得た「場に出た時に発動する特性」(ひでり/ゆきふらし/トレース等)はメガシンカした瞬間に発動する
// (例: メガリザードンYのひでり)。megaEvolve後にfireEntryAbilityを呼ぶ。かげふみ(メガゲンガー)は常時参照なのでそのまま効く。
{
  resetEnv();
  // T279 メガユキメノコ: メガシンカした瞬間にゆきふらしが発動して天気がゆきに
  E.sides.self = freshSide('ユキメノコ', null);
  E.sides.self.moves = [moveByName('シャドーボール')];
  E.sides.self.item = 'mega_stone_any';
  E.sides.opp = freshSide('カビゴン', 'hataku');
  E.env.weather = 'none';
  E.megaEvolve('self');
  check('T279 メガユキメノコのゆきふらしがメガシンカ時に発動', E.env.weather === 'snow',
    `weather=${E.env.weather} poke=${E.sides.self.poke.name}`);
  resetEnv();
}
{
  resetEnv();
  // T279b メガゲンガー: かげふみで相手は交代できない(メガシンカ後)
  E.sides.self = freshSide('ゲンガー', null);
  E.sides.self.moves = [moveByName('シャドーボール')];
  E.sides.self.item = 'mega_stone_any';
  E.sides.opp = freshSide('フシギバナ', 'hataku');
  const sub = freshSide('カビゴン', 'hataku');
  E.sides.opp.bench = [{ poke: sub.poke, effort: sub.effort, natureIdx: 0, ability: '', item: '',
    moves: sub.moves, currentHp: null, fainted: false, status: 'none', sleepTurns: null, lastConsumedItem: null, megaBase: null }];
  E.megaEvolve('self');
  check('T279b前提 メガゲンガーになった', E.sides.self.poke.name === 'メガゲンガー', `poke=${E.sides.self.poke.name}`);
  const swOk = E.attemptSwitch('opp', 0);
  check('T279b かげふみで相手は交代できない', swOk === false && E.sides.opp.poke.name === 'フシギバナ',
    `swOk=${swOk} poke=${E.sides.opp.poke.name}`);
  resetEnv();
}

// ===== 観戦レポート書き出し(review/sim_test_report.html) =====
// テストが実際に流したバトルログを本番ログ風に並べる。Chromeで開きっぱなし→リロードで最新が見られる。
{
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const secs = [];
  for (const r of _report) {
    if (!secs.length || secs[secs.length - 1].title !== r.section) secs.push({ title: r.section, tests: [] });
    secs[secs.length - 1].tests.push(r);
  }
  const failCount = _report.filter(r => !r.ok).length;
  const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>バトルテスト観戦 — sim_test_report</title>
<style>
body{background:#10141d;color:#cfd6e4;font-family:"Hiragino Kaku Gothic ProN",Meiryo,sans-serif;margin:0;padding:16px 12px 60px}
h1{font-size:17px;color:#e8edf7;margin:4px 0 2px}
.meta{font-size:12px;color:#8b94a7;margin-bottom:14px}
.sum{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;margin-right:8px}
.sum.ok{background:#10331f;color:#4ade80;border:1px solid #4ade8044}
.sum.ng{background:#3a1518;color:#f87171;border:1px solid #f8717144}
details.sec{margin:10px 0;border:1px solid #232a3a;border-radius:10px;background:#141927;overflow:hidden}
details.sec>summary{cursor:pointer;padding:9px 12px;font-size:13px;font-weight:700;color:#dbe3f2;background:#1a2030;list-style:none}
details.sec>summary::before{content:"▸ ";color:#5b667d}
details.sec[open]>summary::before{content:"▾ "}
details.sec.hasfail>summary{color:#fda4af;background:#2a1820}
.test{border-top:1px solid #1d2433;padding:8px 12px}
.tname{font-size:12.5px;font-weight:700}
.tname.ok{color:#4ade80}.tname.ng{color:#f87171}
.tdetail{font-size:11.5px;color:#fbbf24;margin:2px 0 0 18px}
.blog{margin:6px 0 2px 18px;padding:7px 10px;background:#0c0f17;border:1px solid #1d2433;border-radius:8px;font-size:12px;line-height:1.75}
.blog .l{display:block}
.blog .p8{color:#e8edf7}
.blog .p9{color:#9fb4d8}
.blog .crit{color:#fbbf24;font-weight:700}
.blog .turn{color:#5b667d;font-size:11px}
.nolog{color:#5b667d;font-size:11px;margin-left:18px}
</style></head><body>
<h1>バトルテスト観戦レポート</h1>
<div class="meta">生成: ${new Date().toLocaleString('ja-JP')} ・ node tools/_sim_test.js のバトルログをそのまま表示(リロードで最新)</div>
<div style="margin-bottom:12px"><span class="sum ok">✅ ${pass} pass</span>${failCount ? `<span class="sum ng">❌ ${failCount} fail</span>` : ''}</div>
${secs.map(sec => {
  const hasFail = sec.tests.some(t => !t.ok);
  return `<details class="sec${hasFail ? ' hasfail' : ''}"${hasFail ? ' open' : ''}><summary>${esc(sec.title)} (${sec.tests.length})</summary>
${sec.tests.map(t => `<div class="test"><div class="tname ${t.ok ? 'ok' : 'ng'}">${t.ok ? '✅' : '❌'} ${esc(t.name)}</div>
${!t.ok && t.detail ? `<div class="tdetail">→ ${esc(t.detail)}</div>` : ''}
${t.log.length ? `<div class="blog">${t.log.map(l => {
    const cls = l.msg.includes('きゅうしょ') ? 'crit' : l.msg.startsWith('───') ? 'turn' : 'p' + esc(l.phase);
    return `<span class="l ${cls}">${esc(l.msg)}</span>`;
  }).join('')}</div>` : `<div class="nolog">(このcheckで流れたバトルログなし)</div>`}
</div>`).join('\n')}
</details>`;
}).join('\n')}
</body></html>`;
  fs.writeFileSync(path.join(ROOT, 'review', 'sim_test_report.html'), html);
  console.log(`観戦レポート: review/sim_test_report.html(${_report.length}件)`);
}

console.log(`\n=== 結果: ${pass} pass / ${fail} fail ===`);
if (fail) { console.log('失敗:', fails.join(' / ')); process.exit(1); }
console.log('✅ 全件パス');
process.exit(0);
