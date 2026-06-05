/* 各 condition.type の代表例を1つずつ + ヤックン説明 を出力 */
const rows=require('../review/_cond_survey.json');
const fs=require('fs'),path=require('path');
const FILE=path.resolve(__dirname,'..','pokechan_data.js');
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(FILE,'utf8'),'const WAZA_MAP ='));
const seen={};
for(const r of rows){
  if(seen[r.cond.type])continue; seen[r.cond.type]=1;
  const m=map[r.key];
  console.log('● type:',r.cond.type,'| kind:',r.kind,'| 例:',r.name);
  console.log('  cond:',JSON.stringify(r.cond));
  console.log('  説明:',(m.description_legacy||m.description||'').slice(0,90));
  console.log('');
}
