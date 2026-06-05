/* detail / sub_effects / value(英語) を host kind 照合付きで吸い出す */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(path.join(ROOT,'pokechan_data.js'),'utf8'),'const WAZA_MAP ='));
const isEn=s=>typeof s==='string'&&/[A-Za-z]{3,}/.test(s);
// value は「日本語にすべき英語の値」だけ拾う(列挙識別子 max_hp 等と区別が難しいので、明らかな英単語複数 or 既知の語のみ)
const VALUE_TARGET=new Set(['trapped','tailwind',"user's ability",'minimized','bound']);
const det=[], sub=[], val=[];
for(const m of Object.values(map)){
  const bd=m.battle_data; if(!bd||!bd.effects)continue;
  const allKinds=bd.effects.map(e=>e.kind);
  const desc=(m.description_legacy||m.description||'').slice(0,130);
  bd.effects.forEach(e=>{
    if(isEn(e.detail)) det.push({move:m.name,en:e.detail,hostKind:e.kind,allKinds,desc});
    if(Array.isArray(e.sub_effects)) e.sub_effects.forEach(s=>{ if(isEn(s)) sub.push({move:m.name,en:s,hostKind:e.kind,allKinds,desc}); });
    if(typeof e.value==='string' && VALUE_TARGET.has(e.value)) val.push({move:m.name,en:e.value,hostKind:e.kind,allKinds,desc});
  });
}
const dump=(arr,name)=>{ console.log(`\n===== ${name} (${arr.length}) =====`); arr.forEach((o,i)=>{ console.log(`${i+1}.【${o.move}】host=「${o.hostKind}」`); console.log(`   ${o.en}`); }); };
dump(det,'detail'); dump(sub,'sub_effects'); dump(val,'value(英語)');
fs.writeFileSync(path.join(ROOT,'review','_detail_ctx.json'),JSON.stringify({detail:det,sub_effects:sub,value:val},null,1));
console.log('\n→ review/_detail_ctx.json / detail',det.length,'sub',sub.length,'value',val.length);
