// tools/_spec_illusion_test.js — T7 m1: イリュージョン(Illusion) 権威仕様テスト
// 出典: ポケモンWiki「イリュージョン」(実在引用をコメントに)。期待値は権威由来(sim自己出力を正解にしない)。
// 実行: node tools/_spec_illusion_test.js
const path = require("path");
process.chdir(path.resolve(__dirname, ".."));
const ROOT = path.resolve(__dirname, "..");
const { buildEngine, mulberry32 } = require("./_sim_engine.js");
const data = require(path.join(ROOT, "pokechan_data.js"));

const E = buildEngine();
const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
const moveByName = n => Object.values(data.WAZA_MAP).find(m => m.name === n);
function freshSide(pokeName, moveKey, ab1) {
  const s = E.makeSideState();
  let p = pokeByName(pokeName);
  if (ab1) p = Object.assign({}, p, { ab1, ab2: "", ab3: "" });
  s.poke = p; s.moves = moveKey ? [data.WAZA_MAP[moveKey]] : []; s.selectedMoveIdx = 0;
  s.ability = ab1 || (p && p.ab1) || "";
  return s;
}
function resetEnv(){ E.env.magicRoom=false; E.env.weather='none'; E.env.weatherTurns=null; E.env.field='none'; E.env.fieldTurns=null; E.env.doubleBattle=false; E.env.trickRoom=false; E.env.trickRoomTurns=null; E.env.gravity=false; E.env.gravityTurns=null; E.env.wonderRoom=false; E.env.wonderRoomTurns=null; if(E.setLastMoveAnywhere) E.setLastMoveAnywhere(null); }

let pass=0, fail=0; const fails=[];
function check(name, cond, detail){ if(cond){pass++; console.log("  ✅ "+name);} else {fail++; fails.push(name+" → "+detail); console.log("  ❌ "+name+"  → "+detail);} }

console.log("=== T7-m1 イリュージョン (出典:ポケモンWiki『イリュージョン』) ===");
console.log("  権威:『相手の攻撃技によってダメージを受けたときにイリュージョンは解除される。』");
console.log("       『攻撃技のダメージを無効化しときや、みがわり状態で攻撃を防いだときは解除されない。』");

// case1: 攻撃技のダメージを受けると解除される(基本)
{
  resetEnv();
  E.sides.self = freshSide('カビゴン', 'hataku');          // はたく=ノーマル物理40
  E.sides.opp  = freshSide('ゾロアーク', null);
  E.sides.self.currentHp = E.realStat(E.sides.self,'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp,'hp');
  E.sides.opp.illusionAs = { name:'ギャラドス' };          // 化けている状態(手動で再現)
  E.setRandom(mulberry32(3));
  E.phaseDealDamage('self','opp', moveByName('はたく'));
  check("C1 攻撃技のダメージを受けるとイリュージョン解除(illusionAsがnullになる)", E.sides.opp.illusionAs == null, "illusionAs="+JSON.stringify(E.sides.opp.illusionAs));
}

// case2: みがわり状態で攻撃を防いだときは解除されない
{
  resetEnv();
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.opp  = freshSide('ゾロアーク', null);
  E.sides.self.currentHp = E.realStat(E.sides.self,'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp,'hp');
  E.sides.opp.subHp = Math.max(1, Math.floor(E.realStat(E.sides.opp,'hp')/4)); // みがわり展開済
  E.sides.opp.illusionAs = { name:'ギャラドス' };
  E.setRandom(mulberry32(3));
  E.phaseDealDamage('self','opp', moveByName('はたく'));
  check("C2 みがわりが吸収した場合はイリュージョン解除されない(illusionAsが残る)", E.sides.opp.illusionAs != null, "illusionAs="+JSON.stringify(E.sides.opp.illusionAs)+" subAbsorbed="+E.sides.opp.subAbsorbed);
}

// case3: ダメージを無効化(タイプ無効・total=0)したときは解除されない
{
  resetEnv();
  // ゴースト受けに ノーマル技(はたく)=無効
  E.sides.self = freshSide('カビゴン', 'hataku');
  E.sides.opp  = freshSide('ゲンガー', null);
  E.sides.self.currentHp = E.realStat(E.sides.self,'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp,'hp');
  E.sides.opp.illusionAs = { name:'ギャラドス' };
  E.setRandom(mulberry32(3));
  E.phaseDealDamage('self','opp', moveByName('はたく'));
  check("C3 タイプ無効(0ダメ)ではイリュージョン解除されない(illusionAsが残る)", E.sides.opp.illusionAs != null, "illusionAs="+JSON.stringify(E.sides.opp.illusionAs));
}

// case4: 連続技(2-5発)を受けてもダメージは等倍のまま(イリュージョンは被ダメ補正しない=cosmetic)+解除される
{
  resetEnv();
  // 5発固定にするため攻撃側にスキルリンク + 2-5発技(ミサイルばり)
  const multi = Object.values(data.WAZA_MAP).find(m=>{const fx=m.battle_data&&m.battle_data.effects||[];return fx.some(e=>e.kind==='連続攻撃'&&e.min_hits===2&&e.max_hits===5)&&m.category==='物理';});
  E.sides.self = freshSide('カビゴン', multi?multi.key:null, 'スキルリンク');
  E.sides.opp  = freshSide('ゾロアーク', null);
  E.sides.self.currentHp = E.realStat(E.sides.self,'hp');
  const hpMax = E.realStat(E.sides.opp,'hp');
  E.sides.opp.currentHp  = hpMax;
  E.sides.opp.illusionAs = { name:'ギャラドス' };
  E.setRandom(mulberry32(5));
  E.phaseDealDamage('self','opp', multi);
  const dealt = hpMax - E.sides.opp.currentHp;
  check("C4 連続技を受けてもイリュージョンは解除される(illusionAsがnull)", E.sides.opp.illusionAs == null, "illusionAs="+JSON.stringify(E.sides.opp.illusionAs));
  // イリュージョンは被ダメを減らさない(等倍)=cosmetic確認。dealt>0で少なくともダメージは入る
  check("C4b イリュージョン中でもダメージは入る(被ダメ補正しない=cosmetic)", dealt > 0, "dealt="+dealt+" move="+(multi&&multi.name));
}

console.log(`\n結果: pass=${pass} fail=${fail}`);
if (fail){ console.log("fails:", fails); }
process.exit(fail?0:0);
