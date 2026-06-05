/* effect フィールドの英語フリーテキストを host kind 照合付きで吸い出す(note と同形式の仕分け用) */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(path.join(ROOT,'pokechan_data.js'),'utf8'),'const WAZA_MAP ='));
const isEn=s=>typeof s==='string'&&/[A-Za-z]{3,}/.test(s);
const out=[];
for(const m of Object.values(map)){
  const bd=m.battle_data; if(!bd||!bd.effects)continue;
  const allKinds=bd.effects.map(e=>e.kind);
  bd.effects.forEach(e=>{
    if(isEn(e.effect)){
      out.push({move:m.name, en:e.effect, hostKind:e.kind,
        hostCond:e.condition?(e.condition.value||e.condition.type):null,
        value:typeof e.value==='string'?e.value:undefined,
        allKinds, desc:(m.description_legacy||m.description||'').slice(0,140)});
    }
  });
}
out.forEach((o,i)=>{
  console.log(`${i+1}. 【${o.move}】 host=「${o.hostKind}」${o.hostCond?' cond='+o.hostCond:''}${o.value?' value='+o.value:''}`);
  console.log(`   全kind: ${o.allKinds.join(' / ')}`);
  console.log(`   effect: ${o.en}`);
});
fs.writeFileSync(path.join(ROOT,'review','_effect_ctx.json'),JSON.stringify(out,null,1));
console.log('\n計',out.length,'件 → review/_effect_ctx.json');
