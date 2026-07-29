// tools/_spec_metronome_test.js — メトロノーム(道具) 権威仕様テスト
// 出典: ポケモンWiki「メトロノーム(道具)」
//   効果:『同じわざを連続して使うと、そのたびに与えるダメージが増えていく。上限は+100%。
//          途中で別のわざを使うとリセットされる。』『第五世代以降は+20%』
//   Champions節:『同じ技を連続で使った場合 威力が上がる。2回目で1.2倍 3回目で1.4倍と上がり
//                 最大で2倍まで上がる。やめると元に戻る。』
// ★このテストが守る根治(2026-07-28): 連続使用回数を calcDamage(純粋な計算関数)の中で書き換えていたため、
//   技リストのダメージ表示・AIの読み・みらいよちが呼ぶだけで回数が進む/リセットされる実バグがあった。
//   数えるのは「技を実際に使った」確定点 noteMoveUsed のみ。
// 実行: node tools/_spec_metronome_test.js
const path = require("path");
process.chdir(path.resolve(__dirname, ".."));
const ROOT = path.resolve(__dirname, "..");
const { buildEngine, mulberry32 } = require("./_sim_engine.js");
const data = require(path.join(ROOT, "pokechan_data.js"));
const E = buildEngine();
const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
const moveByName = n => (data.WAZA_MAP && (data.WAZA_MAP[n] || Object.values(data.WAZA_MAP).find(m => m.name === n))) || null;

function freshSide(pokeName, moveNames, item) {
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  s.moves = (moveNames || []).map(moveByName).filter(Boolean);
  s.selectedMoveIdx = 0;
  s.ability = (s.poke && s.poke.ab1) || "";
  s.item = item || null;
  s.currentHp = E.realStat(s, 'hp');
  return s;
}
function resetEnv(){
  E.env.magicRoom=false;E.env.weather='none';E.env.weatherTurns=null;E.env.field='none';E.env.fieldTurns=null;
  E.env.doubleBattle=false;E.env.trickRoom=false;E.env.trickRoomTurns=null;E.env.gravity=false;E.env.gravityTurns=null;
  E.env.wonderRoom=false;E.env.wonderRoomTurns=null;if(E.setLastMoveAnywhere)E.setLastMoveAnywhere(null);
}
let pass=0,fail=0;const fails=[];
function check(n,c,d){if(c){pass++;console.log("  ✅ "+n);}else{fail++;fails.push(n+" → "+d);console.log("  ❌ "+n+"  → "+d);}}

console.log("=== メトロノーム(道具) 権威仕様テスト ===");
console.log("  権威:『同じわざを連続して使うと、そのたびに与えるダメージが増えていく。上限は+100%。途中で別のわざを使うとリセットされる。』");
console.log("  Champions:『2回目で1.2倍 3回目で1.4倍と上がり 最大で2倍まで上がる。やめると元に戻る。』");

const MV1 = 'かえんほうしゃ', MV2 = 'あくのはどう';
const dmg = () => {
  const r = E.calcDamage('self','opp', E.sides.self.moves[0], {crit:false});
  return r ? (r.max || r.dmg || r.damage || 0) : 0;
};

// C1: ★死にコード化していた根治点 — 計算(表示)を何度呼んでも回数は進まない
{
  resetEnv();
  E.sides.self = freshSide('リザードン',[MV1,MV2],'metronome');
  E.sides.opp  = freshSide('カビゴン',[MV1]);
  E.setRandom(mulberry32(1));
  const before = E.sides.self.metronomeCount || 0;
  for (let i=0;i<5;i++) dmg();            // 技リストのダメージ表示を5回描いたのと同じ
  const after = E.sides.self.metronomeCount || 0;
  check("C1 ダメージ計算を5回呼んでも連続使用回数が進まない(計算関数は読むだけ)", before===0 && after===0, `before=${before} after=${after}`);
}

// C2: 実際に使った時だけ回数が進む(2回目=1.2倍・3回目=1.4倍)
{
  resetEnv();
  E.sides.self = freshSide('リザードン',[MV1,MV2],'metronome');
  E.sides.opp  = freshSide('カビゴン',[MV1]);
  E.setRandom(mulberry32(1));
  const d1 = dmg();                                   // 1回目(補正なし)
  E.noteMoveUsed(E.sides.self, E.sides.self.moves[0]); // 1回目を使った
  E.noteMoveUsed(E.sides.self, E.sides.self.moves[0]); // 2回目を使った
  const c2 = E.sides.self.metronomeCount;
  const d2 = dmg();
  E.noteMoveUsed(E.sides.self, E.sides.self.moves[0]); // 3回目
  const c3 = E.sides.self.metronomeCount;
  const d3 = dmg();
  check("C2-a 同じ技を2回使うと回数=1(=1.2倍)", c2===1, `count=${c2}`);
  check("C2-b 同じ技を3回使うと回数=2(=1.4倍)", c3===2, `count=${c3}`);
  check("C2-c ダメージが 1回目 < 2回目 < 3回目 と増える", d1<d2 && d2<d3, `d1=${d1} d2=${d2} d3=${d3}`);
  check("C2-d 3回目は1回目のおよそ1.4倍", Math.abs(d3/d1 - 1.4) < 0.06, `比=${(d3/d1).toFixed(3)}`);
}

// C3: 別の技を使うとリセット(権威『途中で別のわざを使うとリセットされる』)
{
  resetEnv();
  E.sides.self = freshSide('リザードン',[MV1,MV2],'metronome');
  E.sides.opp  = freshSide('カビゴン',[MV1]);
  E.setRandom(mulberry32(1));
  const s = E.sides.self;
  E.noteMoveUsed(s, s.moves[0]); E.noteMoveUsed(s, s.moves[0]); E.noteMoveUsed(s, s.moves[0]);
  const before = s.metronomeCount;
  E.noteMoveUsed(s, s.moves[1]);   // 別の技
  check("C3 別の技を使うと回数が0に戻る", before===2 && s.metronomeCount===0, `before=${before} after=${s.metronomeCount}`);
}

// C4: 上限は+100%(=回数5でとまる)
{
  resetEnv();
  E.sides.self = freshSide('リザードン',[MV1,MV2],'metronome');
  E.sides.opp  = freshSide('カビゴン',[MV1]);
  const s = E.sides.self;
  for (let i=0;i<12;i++) E.noteMoveUsed(s, s.moves[0]);
  check("C4 上限+100%(回数は5で頭打ち=2.0倍)", s.metronomeCount===5, `count=${s.metronomeCount}`);
}

// C5: 交代でリセット(控えの別ポケモンへ回数が持ち越されない)
{
  resetEnv();
  E.sides.self = freshSide('リザードン',[MV1,MV2],'metronome');
  E.sides.opp  = freshSide('カビゴン',[MV1]);
  const s = E.sides.self;
  E.noteMoveUsed(s, s.moves[0]); E.noteMoveUsed(s, s.moves[0]);
  const before = s.metronomeCount;
  E.clearVolatilesOnSwitch(s);
  check("C5 交代で回数がリセットされる(持ち越さない)", before===1 && (s.metronomeCount||0)===0 && !s._metronomeLastMoveKey,
        `before=${before} after=${s.metronomeCount} lastKey=${s._metronomeLastMoveKey}`);
}

console.log(`\n============================================================`);
console.log(`メトロノーム仕様テスト結果: pass=${pass} fail=${fail}`);
if (fails.length){ console.log("失敗:"); fails.forEach(f=>console.log("  - "+f)); }
process.exit(fail ? 1 : 0);
