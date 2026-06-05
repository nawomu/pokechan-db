/** 全技キーをJSON配列で出力。 */
const fs=require('fs'),path=require('path');
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(path.resolve(__dirname,'..','pokechan_data.js'),'utf8'),'const WAZA_MAP ='));
console.log(JSON.stringify(Object.keys(map)));
