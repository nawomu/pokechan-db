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
function resetEnv() { E.env.weather = 'none'; E.env.field = 'none'; E.env.doubleBattle = false; E.env.trickRoom = false; }

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

console.log(`\n=== 結果: ${pass} pass / ${fail} fail ===`);
if (fail) { console.log('失敗:', fails.join(' / ')); process.exit(1); }
console.log('✅ 全件パス');
process.exit(0);
