/* 全国版 sim 全数スイープ: real_battle_simulator の実エンジンに pokechan_data_all.js(全国版919技)を食わせ、
 * 各技を1つずつ runTurn で回して「JSエラー/クラッシュ/技が実行されない」を機械検出する。
 * effectsの破綻を炙り出す一次ゲート(論理正しさでなく"落ちないか")。実行: node tools/_sim_sweep_all.js
 * 出力: reference/_sim_sweep_result.json(errored一覧) + サマリ。 */
const path = require('path');
const fs = require('fs');
const { buildEngine, mulberry32, ROOT } = require('./_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data_all.js'));
const E = buildEngine();

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
// 攻守: 実在する適当な2体(なければ先頭)。ノーマル等倍で受けられる相手が理想。
const ATK = pokeByName('カイリキー') || data.POKEMON_LIST.find(p=>p.form==='通常') || data.POKEMON_LIST[0];
const DEF = pokeByName('カビゴン') || data.POKEMON_LIST.find(p=>p.form==='通常' && p!==ATK) || data.POKEMON_LIST[1];
const SAFE = data.WAZA_MAP.hataku || Object.values(data.WAZA_MAP).find(m=>m.category!=='変化');

function resetEnv(){ Object.assign(E.env,{weather:'none',weatherTurns:null,field:'none',fieldTurns:null,doubleBattle:false,trickRoom:false,trickRoomTurns:null,gravity:false,gravityTurns:null,wonderRoom:false,wonderRoomTurns:null,magicRoom:false,magicRoomTurns:null}); if(E.setLastMoveAnywhere)E.setLastMoveAnywhere(null); }
function side(poke, mv){ const s=E.makeSideState(); s.poke=poke; s.moves=[mv]; s.selectedMoveIdx=0; return s; }

const errored=[], ok=[];
let i=0;
for (const [key, mv] of Object.entries(data.WAZA_MAP)) {
  i++;
  try {
    resetEnv();
    E.sides.self = side(ATK, mv);
    E.sides.opp  = side(DEF, SAFE);
    E.sides.self.currentHp = E.realStat(E.sides.self,'hp');
    E.sides.opp.currentHp  = E.realStat(E.sides.opp,'hp');
    E.setRandom(mulberry32(20260701));
    // 2ターン回す(ため技/連続技/ターン終了処理まで踏む)
    E.runTurn();
    E.runTurn();
    ok.push(mv.name);
  } catch(e) {
    errored.push({ key, move: mv.name, no: mv.move_no, err: String(e && e.message || e).slice(0,200) });
  }
}
fs.writeFileSync(path.join(ROOT,'reference/_sim_sweep_result.json'), JSON.stringify({total:i, ok:ok.length, errored}, null, 1));
console.log(`全国版 sim スイープ: ${i}技 / OK(落ちない):${ok.length} / エラー:${errored.length}`);
console.log(`攻:${ATK&&ATK.name} 守:${DEF&&DEF.name}`);
if(errored.length){
  console.log('--- エラー技(先頭30) ---');
  errored.slice(0,30).forEach(e=>console.log(`  [${e.no}] ${e.move}: ${e.err}`));
}
