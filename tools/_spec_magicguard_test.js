// tools/_spec_magicguard_test.js — T7 m8: マジックガード(Magic Guard) 権威仕様テスト
// 出典: ポケモンWiki『マジックガード』『こうげき いがいでは ダメージを うけない。』
//   『こんらん状態/命令無視による自傷ダメージ』は受ける(防げない)。状態異常のダメージは防ぐが付与は防がない。
// 実行: node tools/_spec_magicguard_test.js
const path = require("path");
process.chdir(path.resolve(__dirname, ".."));
const ROOT = path.resolve(__dirname, "..");
const { buildEngine, mulberry32 } = require("./_sim_engine.js");
const data = require(path.join(ROOT, "pokechan_data.js"));
const E = buildEngine();
const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
const moveByName = n => Object.values(data.WAZA_MAP).find(m => m.name === n);
function freshSide(pokeName, moveKey, ab1, item) {
  const s = E.makeSideState();
  let p = pokeByName(pokeName);
  if (ab1) p = Object.assign({}, p, { ab1, ab2: "", ab3: "" });
  s.poke = p; s.moves = moveKey ? [data.WAZA_MAP[moveKey]] : []; s.selectedMoveIdx = 0;
  s.ability = ab1 || (p && p.ab1) || "";
  if (item) s.item = item;
  return s;
}
function resetEnv(){ E.env.magicRoom=false;E.env.weather='none';E.env.weatherTurns=null;E.env.field='none';E.env.fieldTurns=null;E.env.doubleBattle=false;E.env.trickRoom=false;E.env.trickRoomTurns=null;E.env.gravity=false;E.env.gravityTurns=null;E.env.wonderRoom=false;E.env.wonderRoomTurns=null;if(E.setLastMoveAnywhere)E.setLastMoveAnywhere(null);}
let pass=0,fail=0;const fails=[];
function check(n,c,d){if(c){pass++;console.log("  ✅ "+n);}else{fail++;fails.push(n+" → "+d);console.log("  ❌ "+n+"  → "+d);}}

console.log("=== T7-m8 マジックガード (出典:ポケモンWiki『マジックガード』) ===");
console.log("  権威:『こうげき いがいでは ダメージを うけない。』『どく/やけどのダメージは受けない』");
console.log("       『すなあらし/あられ』のダメージ受けない。『こんらん自傷』は防げない(受ける)。");

// C1: すなあらしスリップを無効(通常ポケは受ける対照あり)
{
  resetEnv(); E.env.weather='sand';
  const mg = freshSide('カビゴン', null, 'マジックガード'); mg.currentHp=E.realStat(mg,'hp');
  const nm = freshSide('カビゴン', null, 'あついしぼう'); nm.currentHp=E.realStat(nm,'hp'); // あついしぼう=砂スリップを受ける(ノーマル単)
  E.sides.self = mg; E.sides.opp = nm;
  E.setRandom(mulberry32(1));
  E.phaseSlipFor('self'); E.phaseSlipFor('opp');
  check("C1 マジックガードはすなあらしスリップ無効(HP減少なし)", mg.currentHp === E.realStat(mg,'hp'), "mg HP="+mg.currentHp+"/"+E.realStat(mg,'hp'));
  check("C1b 対照: 非MGはすなあらしスリップを受ける(HP減少)", nm.currentHp < E.realStat(nm,'hp'), "nm HP="+nm.currentHp+"/"+E.realStat(nm,'hp'));
}
// C2: どくスリップ無効
{
  resetEnv();
  const mg = freshSide('カビゴン', null, 'マジックガード'); mg.currentHp=E.realStat(mg,'hp'); mg.status='poison';
  const nm = freshSide('カビゴン', null, 'あついしぼう'); nm.currentHp=E.realStat(nm,'hp'); nm.status='poison';
  E.sides.self = mg; E.sides.opp = nm;
  E.setRandom(mulberry32(1));
  E.phaseSlipFor('self'); E.phaseSlipFor('opp');
  check("C2 マジックガードはどくスリップ無効(HP減少なし・状態異常は残る)", mg.currentHp === E.realStat(mg,'hp') && mg.status==='poison', "mg HP="+mg.currentHp+" status="+mg.status);
  check("C2b 対照: 非MGはどくスリップを受ける", nm.currentHp < E.realStat(nm,'hp'), "nm HP="+nm.currentHp);
}
// C3: やけどスリップ無効 + やけど物理半減は残る(攻撃技のダメージ補正はMGの対象外)
{
  resetEnv();
  const mg = freshSide('カビゴン', null, 'マジックガード'); mg.currentHp=E.realStat(mg,'hp'); mg.status='burn';
  E.sides.self = mg; E.setRandom(mulberry32(1));
  E.phaseSlipFor('self');
  check("C3a マジックガードはやけどスリップ無効(HP減少なし)", mg.currentHp === E.realStat(mg,'hp'), "mg HP="+mg.currentHp);
  // やけど物理半減: やけどMG攻撃側の物理技は半減される(出典『やけど(物理技のダメージは通常どおり半減する)』)
  resetEnv();
  const atk = freshSide('カビゴン', 'hataku', 'マジックガード'); atk.currentHp=E.realStat(atk,'hp'); atk.status='burn';
  const def = freshSide('カビゴン', null, null); def.currentHp=E.realStat(def,'hp');
  E.sides.self=atk; E.sides.opp=def; E.setRandom(mulberry32(2));
  const r1 = E.calcDamage('self','opp', moveByName('はたく'));
  resetEnv();
  const atk2 = freshSide('カビゴン', 'hataku', 'マジックガード'); atk2.currentHp=E.realStat(atk2,'hp'); atk2.status='none';
  const def2 = freshSide('カビゴン', null, null); def2.currentHp=E.realStat(def2,'hp');
  E.sides.self=atk2; E.sides.opp=def2; E.setRandom(mulberry32(2));
  const r0 = E.calcDamage('self','opp', moveByName('はたく'));
  const mx = r => r && (r.max!=null?r.max:r.variations[r.variations.length-1]);
  check("C3b やけどMG攻撃側の物理技は半減(MGは攻撃技ダメ補正に影響しない)", mx(r1) <= Math.ceil(mx(r0)*0.6) && mx(r1) < mx(r0), "burn="+mx(r1)+" none="+mx(r0));
}
// C4: いのちのたま反動無効(MG攻撃側は反動を受けない)
{
  resetEnv();
  const atk = freshSide('カビゴン', 'hataku', 'マジックガード', 'life_orb'); atk.currentHp=E.realStat(atk,'hp');
  const def = freshSide('カビゴン', null, null); def.currentHp=E.realStat(def,'hp');
  E.sides.self=atk; E.sides.opp=def; E.setRandom(mulberry32(2));
  const before = atk.currentHp;
  E.phaseDealDamage('self','opp', moveByName('はたく'));
  check("C4 マジックガード+いのちのたま は反動なし(攻撃側HPは減少しない・被弾チップのみ)", atk.currentHp === before, "atk before="+before+" after="+atk.currentHp);
}
console.log(`\n結果: pass=${pass} fail=${fail}`);
if(fail)console.log("fails:",fails);
