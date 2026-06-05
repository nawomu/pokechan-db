/* effects/move-level の自由記述に英語(ASCII語)が残っているものを全列挙 */
const fs=require('fs'),path=require('path');
const FILE=path.resolve(__dirname,'..','pokechan_data.js');
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(FILE,'utf8'),'const WAZA_MAP ='));
// 英語っぽい(ASCIIアルファベットが3連以上・日本語混在でも拾う)値を検出
const enRe=/[A-Za-z]{3,}/;
// type値・kind等の「正当な識別子」は別扱い: condition.type / kind は対象外(表示で日本語化済)
const SKIP_KEYS=new Set(['type','kind','target','phase','stat','stats','semi_invulnerable','replacement','pass','pass_to_replacement']);
const hits=[];
function walk(obj,pathStr,key,moveName){
  if(typeof obj==='string'){ if(enRe.test(obj) && !SKIP_KEYS.has(key)) hits.push({moveName,key,path:pathStr,val:obj}); return; }
  if(Array.isArray(obj)){ obj.forEach((v,i)=>walk(v,pathStr+'['+i+']',key,moveName)); return; }
  if(obj&&typeof obj==='object'){ for(const k in obj) walk(obj[k],pathStr+'.'+k,k,moveName); }
}
for(const [k,m] of Object.entries(map)){
  const bd=m.battle_data; if(!bd)continue;
  // description系は対象外(徹底攻略原文)
  walk(bd, k, '', m.name);
}
// 集約: ユニークな値ごとに件数
const byVal={};
for(const h of hits){ (byVal[h.val]=byVal[h.val]||{count:0,key:h.key,moves:new Set(),paths:new Set()}); byVal[h.val].count++; byVal[h.val].moves.add(h.moveName); byVal[h.val].paths.add(h.path.replace(/\[\d+\]/g,'[]')); }
console.log('英語残骸を含む値:', Object.keys(byVal).length,'種 / 総出現', hits.length,'件\n');
const sorted=Object.entries(byVal).sort((a,b)=>b[1].count-a[1].count);
for(const [val,info] of sorted){
  console.log(`【${info.key}】×${info.count}  技: ${[...info.moves].slice(0,5).join('・')}${info.moves.size>5?' …':''}`);
  console.log(`   "${val}"`);
}
fs.writeFileSync(path.resolve(__dirname,'..','review','_en_notes.json'),JSON.stringify(sorted.map(([val,info])=>({val,key:info.key,count:info.count,moves:[...info.moves],paths:[...info.paths]})),null,1));
