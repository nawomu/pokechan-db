/** 指定キーの「現在の構造化データ全部+説明」を1行JSONで出力(監査エージェント入力用)。
 * 実行: node tools/_waza_dump_full.js <key1> <key2> ... */
const fs=require('fs'),path=require('path');
const FILE=path.resolve(__dirname,'..','pokechan_data.js');
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(FILE,'utf8'),'const WAZA_MAP ='));
for(const k of process.argv.slice(2)){const m=map[k];if(!m){console.log(JSON.stringify({key:k,error:'not found'}));continue;}
 const bd=m.battle_data||{};
 console.log(JSON.stringify({key:k,name:m.name,type:m.type,category:m.category,power:m.power||null,accuracy:m.accuracy!=null?m.accuracy:null,pp:m.pp,contact:!!m.contact,protect:!!m.protect,flags:m.flags&&Object.keys(m.flags).filter(x=>m.flags[x]),priority:bd.priority||0,effects:bd.effects||[],requires:bd.requires,fails_if:bd.fails_if,immune:bd.immune,blocked_by:bd.blocked_by,not_blocked_by:bd.not_blocked_by,description:m.description_legacy||m.description||''}));}
