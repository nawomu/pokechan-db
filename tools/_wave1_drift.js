/* Wave1ゲート検証: triaged 5フィールド(note/doubles_note/effect/detail/sub_effects/value)に英語prose残ゼロか。
 * 許可: HP/PP等の定着略語のみ。enum値(value)は VALUE許可外の英語が無いこと。 */
const fs=require('fs'),path=require('path');
const FILE=path.resolve(__dirname,'..','pokechan_data.js');
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(FILE,'utf8'),'const WAZA_MAP ='));
const ALLOW=/^(HP|PP|MAX|SV)$/i;
const hasEn=s=>{ if(typeof s!=='string')return false; const ws=s.match(/[A-Za-z]{2,}/g)||[]; return ws.some(w=>!ALLOW.test(w)); };
const PROSE=['note','doubles_note','effect','detail'];
const VALUE_EN=new Set(); // value に残る英語(enum除く)を別集計
const hits=[];
for(const m of Object.values(map)){
  const bd=m.battle_data; if(!bd||!bd.effects)continue;
  for(const e of bd.effects){
    for(const f of PROSE) if(hasEn(e[f])) hits.push(`${m.name}.${f}: ${e[f]}`);
    if(Array.isArray(e.sub_effects)) e.sub_effects.forEach(s=>{ if(hasEn(s)) hits.push(`${m.name}.sub_effects: ${s}`);});
    if(typeof e.value==='string' && /[A-Za-z]{3,}/.test(e.value)) VALUE_EN.add(e.value);
  }
}
console.log('=== Wave1ゲート: triaged 5フィールドの英語prose残 ===');
console.log('残:', hits.length, '件');
hits.slice(0,40).forEach(h=>console.log('  ✗ '+h));
console.log('\n=== value に残る英語(参考: 多くはenum, 一部Wave2/未対応) ===');
console.log([...VALUE_EN].join(' / '));
