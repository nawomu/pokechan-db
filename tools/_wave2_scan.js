/* Wave2: triaged5フィールド以外に残る英語prose を全スキャン。enum語彙キーは除外。壊れキー(技名キー)検出。 */
const fs=require('fs'),path=require('path');
const FILE=path.resolve(__dirname,'..','pokechan_data.js');
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(FILE,'utf8'),'const WAZA_MAP ='));
const DONE=new Set(['note','doubles_note','effect','detail','sub_effects']);          // Wave1済
const ENUM=new Set(['kind','target','phase','stat','stats','type','value','values','duration','basis','of','multiplier','fraction','prob','stages','condition','immune','requires','fails_if','not_blocked_by','blocked_by','selection','crit_stage','amount','prevents_switch','ignores_accuracy','bypasses_substitute','hits','min_hits','max_hits','hits_by','stop_on_miss','semi_invulnerable','vulnerable_to','vulnerable_if','replacement','pass','to_max','power_per_hit','hits_state','damage_multiplier','cases','skip_charge_if_weather','on_charge_turn','minimum','champions_amount','exceptions']);
const isEn=s=>typeof s==='string'&&/[A-Za-z]{3,}/.test(s);
const isJP=s=>/[ぁ-んァ-ヶ一-龠]/.test(s);
const byKey={}, broken=[], valueProse=[];
function rec(k,v,move,kind){ (byKey[k]=byKey[k]||[]).push({move,kind,v}); }
for(const m of Object.values(map)){
  const bd=m.battle_data; if(!bd||!bd.effects)continue;
  for(const e of bd.effects){
    for(const [k,v] of Object.entries(e)){
      if(DONE.has(k))continue;
      // 壊れキー: キー自体が日本語(技名)で値が英語
      if(isJP(k)){ broken.push({move:m.name,kind:e.kind,key:k,v}); continue; }
      if(k==='value'){ if(isEn(v)&&v.split(/\s+/).length>=4){ valueProse.push({move:m.name,kind:e.kind,v}); } continue; }
      if(ENUM.has(k))continue;
      if(isEn(v)) rec(k,v,m.name,e.kind);
      if(Array.isArray(v)) v.forEach(x=>{ if(isEn(x)) rec(k,x,m.name,e.kind); });
    }
  }
}
let total=0;
console.log('=== Wave2 残prose(キー別) ===');
for(const k of Object.keys(byKey).sort((a,b)=>byKey[b].length-byKey[a].length)){
  console.log(`\n【${k}】×${byKey[k].length}`); total+=byKey[k].length;
  byKey[k].forEach(o=>console.log(`  ${o.move}「${o.kind}」: ${o.v}`));
}
console.log(`\n=== 壊れキー(技名がキー) ×${broken.length} ===`);
broken.forEach(o=>console.log(`  ${o.move}「${o.kind}」: "${o.key}":"${o.v}"`));
console.log(`\n=== value内ロングプロセ ×${valueProse.length} ===`);
valueProse.forEach(o=>console.log(`  ${o.move}「${o.kind}」: ${o.v}`));
console.log(`\n総prose ${total} / 壊れキー ${broken.length} / valueプロセ ${valueProse.length}`);
fs.writeFileSync(path.resolve(__dirname,'..','review','_wave2_scan.json'),JSON.stringify({byKey,broken,valueProse},null,1));
