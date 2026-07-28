// tools/_spec_magicmirror_test.js — T7 m9: マジックミラー(Magic Bounce)/マジックコート(Magic Coat) 権威仕様テスト
// 出典: ポケモンWiki『マジックミラー』『戦闘中、常にマジックコート状態になる。』
//   『かたやぶり系の効果がある変化技は跳ね返せない。』『マジックコート(技)は同じく跳ね返す』
// 実行: node tools/_spec_magicmirror_test.js
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
function resetEnv(){ E.env.magicRoom=false;E.env.weather='none';E.env.weatherTurns=null;E.env.field='none';E.env.fieldTurns=null;E.env.doubleBattle=false;E.env.trickRoom=false;E.env.trickRoomTurns=null;E.env.gravity=false;E.env.gravityTurns=null;E.env.wonderRoom=false;E.env.wonderRoomTurns=null;if(E.setLastMoveAnywhere)E.setLastMoveAnywhere(null);}
let pass=0,fail=0;const fails=[];
function check(n,c,d){if(c){pass++;console.log("  ✅ "+n);}else{fail++;fails.push(n+" → "+d);console.log("  ❌ "+n+"  → "+d);}}

console.log("=== T7-m9 マジックミラー/マジックコート (出典:ポケモンWiki『マジックミラー』) ===");
console.log("  権威:『あいてに だされた へんかわざを うけずに そのまま かえす。』");
console.log("       『かたやぶり系の効果がある変化技は跳ね返せない。』『マジックコート状態(技)も同じく跳ね返す』");

const denjiha = moveByName('でんじは');   // 変化技・1体選択(でんきまひ付与)
console.log("  でんじは target=%s category=%s", denjiha&&denjiha.target, denjiha&&denjiha.category);

// C1: 変化技(でんじは)を跳ね返す→攻撃側がまひになる
{
  resetEnv();
  E.sides.self = freshSide('カビゴン', denjiha?denjiha.key:null);   // 変化技使用者
  E.sides.opp  = freshSide('カビゴン', null, 'マジックミラー');     // 跳ね返す側
  E.sides.self.currentHp=E.realStat(E.sides.self,'hp'); E.sides.opp.currentHp=E.realStat(E.sides.opp,'hp');
  E.sides.self.pp = E.initPP ? E.initPP(E.sides.self.moves) : null;
  E.setRandom(mulberry32(4));
  const log0 = E.battleLog.length;
  try { E.runSingleAttack('self', 0); } catch(e){ check("C1 runSingleAttack", false, String(e)); }
  const logs = E.battleLog.slice(log0).map(e=>e.msg).join('/');
  check("C1 マジックミラーで でんじは を跳ね返す(ログ)", /跳ね返した/.test(logs), "logs="+logs);
  check("C1b 跳ね返された攻撃側がまひ(self.status=paralysis)", E.sides.self.status==='paralysis' || /まひ/.test(logs), "self.status="+E.sides.self.status+" logs="+logs);
  check("C1c 跳ね返した側(opp)はまひにならない", E.sides.opp.status!=='paralysis', "opp.status="+E.sides.opp.status);
}
// C2: かたやぶり攻撃側の変化技は跳ね返せない
{
  resetEnv();
  E.sides.self = freshSide('カイロス', denjiha?denjiha.key:null, 'かたやぶり'); // かたやぶり+変化技
  E.sides.opp  = freshSide('カビゴン', null, 'マジックミラー');
  E.sides.self.currentHp=E.realStat(E.sides.self,'hp'); E.sides.opp.currentHp=E.realStat(E.sides.opp,'hp');
  E.sides.self.pp = E.initPP ? E.initPP(E.sides.self.moves) : null;
  E.setRandom(mulberry32(4));
  const log0 = E.battleLog.length;
  try { E.runSingleAttack('self', 0); } catch(e){}
  const logs = E.battleLog.slice(log0).map(e=>e.msg).join('/');
  check("C2 かたやぶり相手の変化技は跳ね返されない(跳ね返しログ無し)", !/跳ね返した/.test(logs), "logs="+logs);
  // C2b: でんじはは命中判定で外れる事がある(RNG)ので「反射の有無」だけを確定検証する。
  //   反射されていれば攻撃側(self)がまひになる。かたやぶりで跳ね返されない→selfはまひにならない(命中/外れ問わず)。
  check("C2b かたやぶりで跳ね返されない→攻撃側(self)はまひにならない(反射でなければselfへは戻らない)", E.sides.self.status !== 'paralysis' && !/跳ね返した/.test(logs), "self.status="+E.sides.self.status+" logs="+logs);
}
// C3: マジックコート(技・magicCoatTurn)でも跳ね返す
{
  resetEnv();
  E.sides.self = freshSide('カビゴン', denjiha?denjiha.key:null);
  E.sides.opp  = freshSide('カビゴン', null, null);
  E.sides.opp.magicCoatTurn = true;   // マジックコート構え(技)
  E.sides.self.currentHp=E.realStat(E.sides.self,'hp'); E.sides.opp.currentHp=E.realStat(E.sides.opp,'hp');
  E.sides.self.pp = E.initPP ? E.initPP(E.sides.self.moves) : null;
  E.setRandom(mulberry32(4));
  const log0 = E.battleLog.length;
  try { E.runSingleAttack('self', 0); } catch(e){}
  const logs = E.battleLog.slice(log0).map(e=>e.msg).join('/');
  check("C3 マジックコート(技)でもでんじはを跳ね返す(ログ)", /跳ね返した/.test(logs), "logs="+logs);
}
// C4: 攻撃技(ダメージ技)は跳ね返さない(変化技のみ対象)
{
  resetEnv();
  E.sides.self = freshSide('カビゴン', 'hataku');               // 攻撃技
  E.sides.opp  = freshSide('カビゴン', null, 'マジックミラー');
  E.sides.self.currentHp=E.realStat(E.sides.self,'hp'); E.sides.opp.currentHp=E.realStat(E.sides.opp,'hp');
  E.sides.self.pp = E.initPP ? E.initPP(E.sides.self.moves) : null;
  const hpBefore = E.sides.opp.currentHp;
  E.setRandom(mulberry32(4));
  const log0 = E.battleLog.length;
  try { E.runSingleAttack('self', 0); } catch(e){}
  const logs = E.battleLog.slice(log0).map(e=>e.msg).join('/');
  check("C4 攻撃技(はたく)は跳ね返されない(ダメージが入る)", !/跳ね返した/.test(logs) && E.sides.opp.currentHp < hpBefore, "oppHP before="+hpBefore+" after="+E.sides.opp.currentHp+" logs="+logs);
}
console.log(`\n結果: pass=${pass} fail=${fail}`);
if(fail)console.log("fails:",fails);
