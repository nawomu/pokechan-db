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

console.log(`\n=== 結果: ${pass} pass / ${fail} fail ===`);
if (fail) { console.log('失敗:', fails.join(' / ')); process.exit(1); }
console.log('✅ 全件パス');
process.exit(0);
