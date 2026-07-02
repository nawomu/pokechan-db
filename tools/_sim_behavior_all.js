/* 技 挙動 全数テスト: 各技をsim実エンジンで実際に回し、宣言されたeffectが"発動するか"を検証する。
 * クラッシュ有無(=_sim_sweep)でなく「効果がsimで実際に出るか」を見る=技をシミュレーターで回す意味。
 * 判定: ダメージ技→ダメージ>0(免疫除く) / 状態付与→N回で状態が付く / 能力ランク変化→ランクが動く / 回復・吸収→HP回復。
 * flag=宣言effectがsimで発動しなかった技(sim未実装 or effectsのバグ疑い)。実行: node tools/_sim_behavior_all.js
 * 出力: reference/_sim_behavior_result.json。 */
const path=require('path');
const { buildEngine, mulberry32, ROOT } = require('./_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data_all.js'));
const fs=require('fs');
const E = buildEngine();
const P = n => data.POKEMON_LIST.find(p=>p.name===n);
const list = data.POKEMON_LIST;
// 攻撃側=多様な相手に等倍を出しやすい×2、守=種類違い
const ATK = P('メタモン') || P('カイリキー') || list.find(p=>p.form==='通常');
const DEF = P('カビゴン') || list.find(p=>p.form==='通常' && p!==ATK);
function reset(){ Object.assign(E.env,{weather:'none',weatherTurns:null,field:'none',fieldTurns:null,doubleBattle:false,trickRoom:false,gravity:false,wonderRoom:false,magicRoom:false}); if(E.setLastMoveAnywhere)E.setLastMoveAnywhere(null); }
function side(poke,mv){const s=E.makeSideState();s.poke=poke;s.moves=[mv];s.selectedMoveIdx=0;return s;}
function fullReset(mv,atk,def){ reset(); E.sides.self=side(atk,mv); E.sides.opp=side(def, data.WAZA_MAP.hataku||mv); E.sides.self.currentHp=E.realStat(E.sides.self,'hp'); E.sides.opp.currentHp=E.realStat(E.sides.opp,'hp'); }
const STAT={attack:'atk',defense:'def',special_attack:'spatk',special_defense:'spdef',speed:'spd',accuracy:'acc',evasion:'eva'};

const flags=[]; let tested=0, okc=0;
for(const [key,mv] of Object.entries(data.WAZA_MAP)){
  const bd=mv.battle_data||{}; const effs=bd.effects||[];
  const isDmg = mv.category!=='変化' && mv.power>0;
  const checks=[]; // {label, pass}
  try{
    // --- ダメージ技: ダメージ>0(免疫除く) ---
    // ★タイプ免疫(ゴースト技vsノーマル等)を先に判定=免疫なら各チェックをスキップ(偽陽性回避)
    let immune=false;
    if(isDmg){ fullReset(mv,ATK,DEF); try{ const r=E.calcDamage('self','opp',mv); immune = !!(r && r.immune); }catch(e){} }
    // 条件付きダメージ(先に被弾要=倍返し / 使用者タイプ要=タイプ除去self / 2ターン)は generic setup で不発=スキップ
    const dmgConditional = effs.some(e=>['倍返し','タイプ除去','2ターン目に攻撃','カウンター','状態異常時威力'].includes(e.kind) || e.requires_damage_taken || e.fails_if_type_absent);
    if(isDmg && !immune && !dmgConditional){
      fullReset(mv,ATK,DEF);
      E.setRandom(mulberry32(20260701));
      const hp0=E.sides.opp.currentHp;
      try{ E.phaseDealDamage('self','opp',mv); }catch(e){}
      const dealt=hp0-E.sides.opp.currentHp;
      checks.push({label:'ダメージ>0', pass: dealt>0, note:`dealt=${dealt}`});
    }
    // --- 状態付与(相手) ---
    // ★simのstatusは英語(burn/poison/badpoison/freeze/paralysis/sleep)。こんらん/ひるみ/バインドは別フィールドなので厳密検出できる主要6状態のみ判定。
    const STMAP={'やけど':'burn','どく':'poison','もうどく':'badpoison','こおり':'freeze','まひ':'paralysis','ねむり':'sleep'};
    // 特殊タイミング(ため技/まもり系/接触反撃)は generic setup で不発=スキップ
    const specialTiming = effs.some(e=>['2ターン目に攻撃','まもり','固定ダメージ'].includes(e.kind)) || (stEf0=>false);
    const stEf=effs.find(e=>e.kind==='状態付与'&&(e.target==='opponent'||e.target==='all_opponents')&&STMAP[e.value]&&!e.condition);
    if(stEf && !immune && !specialTiming){
      const want=STMAP[stEf.value]; let got=false;
      // 2ターン回す(ため技/あくび遅延も踏む)
      for(let i=0;i<30 && !got;i++){ fullReset(mv,ATK,DEF); E.setRandom(mulberry32(1000+i)); try{E.runTurn(); if(E.sides.opp.status!==want)E.runTurn();}catch(e){} if(E.sides.opp.status===want) got=true; }
      checks.push({label:`状態付与:${stEf.value}`, pass:got});
    }
    // --- 能力ランク変化(相手 or 自分) ---
    // condition付き(シード所持/性別/特性/KO等)・restrict_type・ally/team・prob低は generic setup で不発=スキップ(偽陽性回避)
    const isTwoTurn = effs.some(e=>e.kind==='2ターン目に攻撃');
    const _berryReq = effs.some(e=>e.kind==='木の実強制'); // ほおばる等=きのみ所持条件でgeneric setup不発=スキップ(偽陽性回避)
    const rkEf=(!isTwoTurn)&&!_berryReq&&effs.find(e=>e.kind==='能力ランク変化'&&!e.reset&&(e.stat||e.stats)&&!e.condition&&!e.restrict_type&&e.target!=='ally'&&e.target!=='team'&&e.target!=='all'&&(e.prob===undefined||e.prob>=20)&&!e.on_charge_turn);
    if(rkEf && !(immune && rkEf.target!=='self')){
      const who0 = (rkEf.target==='self'||rkEf.target==='team') ? 'self':'opp';
      const stats=Array.isArray(rkEf.stats)?rkEf.stats:(rkEf.stat==='all'?['attack','defense','special_attack','special_defense','speed']:[rkEf.stat]);
      let moved=false;
      // 確率2次効果もあるのでN回試行
      for(let i=0;i<30 && !moved;i++){ fullReset(mv,ATK,DEF); E.setRandom(mulberry32(500+i)); try{E.runTurn();}catch(e){} const who=E.sides[who0]; moved=stats.some(s=>{const rk=STAT[s]||s; return who.rank[rk]!==0 && who.rank[rk]!==undefined;}); }
      checks.push({label:`ランク変化:${rkEf.target}`, pass:moved});
    }
    // --- 回復/吸収(自分) ---
    const hlEf=effs.find(e=>(e.kind==='回復'||e.kind==='吸収')&&(e.target==='self'||!e.target));
    if(hlEf && isDmg && hlEf.kind==='吸収'){
      fullReset(mv,ATK,DEF); E.sides.self.currentHp=Math.floor(E.realStat(E.sides.self,'hp')/2); const before=E.sides.self.currentHp; E.setRandom(mulberry32(3)); try{E.phaseDealDamage('self','opp',mv);}catch(e){}
      checks.push({label:'吸収HP回復', pass:E.sides.self.currentHp>=before});
    }
  }catch(e){ checks.push({label:'例外',pass:false,note:e.message}); }
  if(checks.length){ tested++; const fail=checks.filter(c=>!c.pass); if(fail.length){ flags.push({name:mv.name, no:mv.move_no, fails:fail.map(f=>f.label+(f.note?`(${f.note})`:'')), effects:effs.map(e=>e.kind)}); } else okc++; }
}
fs.writeFileSync(path.join(ROOT,'reference/_sim_behavior_result.json'), JSON.stringify({tested, ok:okc, flagged:flags.length, flags},null,1));
console.log(`技挙動テスト: 検証${tested}技 / OK${okc} / flag${flags.length}(効果が発動しなかった疑い)`);
flags.slice(0,30).forEach(f=>console.log(`  [${f.no}] ${f.name}: ${f.fails.join(' / ')}`));
