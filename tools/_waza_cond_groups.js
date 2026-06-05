const rows=require('../review/_cond_survey.json');
const GROUP=require('./_cond_groupmap.js');
const grpKeys={};
for(const r of rows){ const g=GROUP[r.cond.type]||'(未分類)'; (grpKeys[g]=grpKeys[g]||[]).push(r.key); }
const order=['場・フィールド','接地','天気','タイプ','状態異常','道具','相手の技','このターン','行動順','前ターン失敗','接触で被弾','複合','たくわえ数','性別','撃破時','先制使用','味方対象','すがた','(未分類)'];
const out=[];
for(const g of order){ if(!grpKeys[g])continue; const keys=[...new Set(grpKeys[g])]; out.push({group:g,keys}); }
require('fs').writeFileSync(__dirname+'/../review/_cond_groups.json',JSON.stringify(out,null,1));
console.log(out.map(o=>`${o.group}: ${o.keys.length}技`).join('\n'));
