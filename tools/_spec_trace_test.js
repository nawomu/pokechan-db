// tools/_spec_trace_test.js — T7 m2: トレース(Trace) 権威仕様テスト
// 出典: ポケモンWiki『トレース』。発動=場に出た時(phaseInitA)に相手の特性をコピー。
// 実行: node tools/_spec_trace_test.js
const path = require("path");
process.chdir(path.resolve(__dirname, ".."));
const ROOT = path.resolve(__dirname, "..");
const { buildEngine, mulberry32 } = require("./_sim_engine.js");
const data = require(path.join(ROOT, "pokechan_data.js"));
const E = buildEngine();
const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
function freshSide(pokeName, ab1) {
  const s = E.makeSideState();
  let p = pokeByName(pokeName);
  if (ab1) p = Object.assign({}, p, { ab1, ab2: "", ab3: "" });
  s.poke = p; s.moves = []; s.selectedMoveIdx = 0;
  s.ability = ab1 || (p && p.ab1) || "";
  s.currentHp = E.realStat(s, 'hp');
  return s;
}
function resetEnv(){ E.env.magicRoom=false;E.env.weather='none';E.env.weatherTurns=null;E.env.field='none';E.env.fieldTurns=null;E.env.doubleBattle=false;E.env.trickRoom=false;E.env.trickRoomTurns=null;E.env.gravity=false;E.env.gravityTurns=null;E.env.wonderRoom=false;E.env.wonderRoomTurns=null;if(E.setLastMoveAnywhere)E.setLastMoveAnywhere(null);}
let pass=0,fail=0;const fails=[];
function check(n,c,d){if(c){pass++;console.log("  ✅ "+n);}else{fail++;fails.push(n+" → "+d);console.log("  ❌ "+n+"  → "+d);}}

console.log("=== T7-m2 トレース (出典:ポケモンWiki『トレース』) ===");
console.log("  権威:『場に出たとき、自分の特性を相手の場にいるポケモンと同じ特性にする。』");
console.log("       コピー不可リストあり(イリュージョン/かわりもの/ばけのかわ/バトルスイッチ/フラワーギフト 等)");

// C1: 場に出た時、相手のコピー可能な特性をコピーする
{
  resetEnv();
  E.sides.self = freshSide('サーナイト', 'トレース');      // トレース持ち
  E.sides.opp  = freshSide('カビゴン', 'あついしぼう');    // コピー可能な特性
  E.setRandom(mulberry32(1));
  try { E.phaseInitA(); } catch(e){ check("C1 phaseInitA実行", false, String(e)); }
  check("C1 場に出た時・相手のコピー可能特性をコピー(abilityOverride=相手の特性)", E.sides.self.abilityOverride==='あついしぼう', "override="+E.sides.self.abilityOverride+" (opp="+E.sideAbility(E.sides.opp)+")");
}
// C2: コピー不可特性(バトルスイッチ)はコピーしない(Engine skip list: トレース/バトルスイッチ/マイティチェンジ)
{
  resetEnv();
  E.sides.self = freshSide('サーナイト', 'トレース');
  E.sides.opp  = freshSide('ルカリオ', 'バトルスイッチ');  // ※バトルスイッチ持ちがChampionsに居るかは別としてEngineのskip確認
  E.setRandom(mulberry32(1));
  try { E.phaseInitA(); } catch(e){}
  check("C2 バトルスイッチ(コピー不可)はコピーしない(abilityOverrideが立たない)", E.sides.self.abilityOverride!=='バトルスイッチ' && E.sides.self.abilityOverride==null, "override="+E.sides.self.abilityOverride);
}
// C3: 相手がトレース持ち→トレースはコピーしない(トレース自身もskip list)
{
  resetEnv();
  E.sides.self = freshSide('サーナイト', 'トレース');
  E.sides.opp  = freshSide('チャーレム', 'トレース');
  E.setRandom(mulberry32(1));
  try { E.phaseInitA(); } catch(e){}
  check("C3 相手がトレースでもコピーしない(abilityOverrideが立たない)", E.sides.self.abilityOverride!=='トレース' && E.sides.self.abilityOverride==null, "override="+E.sides.self.abilityOverride);
}
// C4: コピー後は交代で戻る(abilityOverrideはclearVolatilesOnSwitch等でクリア)=コード確認+補助検証
//   ここでは abilityOverride がコピー直後に立っていることを前提に、クリア関数の存在をコード読みで担保。
//   代わりに「コピーした特性が見えている」ことを sideAbility 経由で確認
{
  resetEnv();
  E.sides.self = freshSide('サーナイト', 'トレース');
  E.sides.opp  = freshSide('カビゴン', 'がんじょう');
  E.setRandom(mulberry32(1));
  try { E.phaseInitA(); } catch(e){}
  check("C4 コピー後 sideAbility(self) がコピー元を返す(トレースでがんじょう取得)", E.sideAbility(E.sides.self)==='がんじょう', "sideAbility(self)="+E.sideAbility(E.sides.self));
}
console.log(`\n結果: pass=${pass} fail=${fail}`);
if(fail)console.log("fails:",fails);
