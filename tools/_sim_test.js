/* 技ターン検証テスト環境（設計: TEST_ENV_DESIGN_技ターン検証.md）
 * 方式: real_battle_simulator.html の実エンジンを Node の vm でそのまま実行（sim無改変・単一ソース）。
 *       DOM/window は吸収プロキシでダミー化し、エンジン関数(calcDamage/runTurn 等)を取り出して検証する。
 * 実行: node tools/_sim_test.js   （全件pass=exit0 / 1件でもfail=exit1 → /goal の合否に使う）
 * 段階(設計§3): ①追加効果なし純粋攻撃 → ②状態異常 → ③能力ランク → ④優先度/素早さ → ⑤天候/フィールド
 */
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('./_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

// ===== 軽量テストランナー =====
let pass = 0, fail = 0; const fails = [];
function check(name, cond, detail) {
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
function resetEnv() { E.env.weather = 'none'; E.env.weatherTurns = null; E.env.field = 'none'; E.env.fieldTurns = null; E.env.doubleBattle = false; E.env.trickRoom = false; }

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

  // T105 いやしのねがい: 使ったら自分はひんし(引き継ぎ回復は交代未実装のため対象外)
  resetEnv();
  E.sides.self = freshSide('フシギバナ', null);
  E.sides.self.moves = [moveByName('いやしのねがい')]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = freshSide('フシギバナ', null);
  E.sides.opp.moves = [moveByName('はたく')]; E.sides.opp.selectedMoveIdx = 0;
  E.setRandom(() => 0.5);
  E.runTurn();
  check('T105 使った自分は ひんし', E.sides.self.fainted === true, `fainted=${E.sides.self.fainted}`);
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

console.log(`\n=== 結果: ${pass} pass / ${fail} fail ===`);
if (fail) { console.log('失敗:', fails.join(' / ')); process.exit(1); }
console.log('✅ 全件パス');
process.exit(0);
