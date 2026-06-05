/** 監査(review/waza_effects_audit.json)の27技をpokechan_data.jsへ適用。
 *  正規化: stat配列→stats / 不要timing除去。effectsを実行手順順にソート。surgical置換+backup+検証。
 * 実行: node tools/_waza_audit_apply.js */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),FILE=path.join(ROOT,'pokechan_data.js');
const changed=JSON.parse(fs.readFileSync(path.join(ROOT,'review/waza_effects_audit.json'),'utf8'));
const dict=JSON.parse(fs.readFileSync(path.join(ROOT,'review/waza_kind_dict.json'),'utf8'));
const JA2EN={},GRP={};for(const d of dict){JA2EN[d.ja]=d.en;GRP[d.en]=d.group;}
const DMG=new Set(['power','crit','accuracy','charge','damage_modifier']),MT=new Set(['change_move_type','add_move_type','override_type_effectiveness','change_target_move_type']);
const POST=new Set(['recoil','recoil_attacker','drain','faint_self','switch_self_out','force_switch']),RES=new Set(['chip_damage','damage_over_time','perish_song','delayed_attack']),FG=new Set(['field','screen','hazard','terrain','weather','trap']);
function rank(e){const en=JA2EN[e.kind],g=GRP[en];if(RES.has(en)||e.phase==='turn_end'||e.phase==='delayed')return 6;if(MT.has(en))return 1;if(DMG.has(g))return 1;if(POST.has(en))return 4;if(e.phase==='lasting'||FG.has(g))return 5;return 3;}
function norm(e){const o={...e};if(Array.isArray(o.stat)){o.stats=o.stat;delete o.stat;}delete o.timing;return o;}
function ser(v){if(v===null)return 'null';if(Array.isArray(v))return '['+v.map(ser).join(', ')+']';if(typeof v==='object')return '{'+Object.entries(v).map(([k,x])=>JSON.stringify(k)+': '+ser(x)).join(', ')+'}';return JSON.stringify(v);}
function spanFrom(t,b){let i=b,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return{start:b,end:i+1};}}}throw new Error('unb');}
function findObj(t,m,f=0){const at=t.indexOf(m,f);return spanFrom(t,t.indexOf('{',at));}
const src=fs.readFileSync(FILE,'utf8');let body=src;
const finalEff={};
for(const mv of changed){finalEff[mv.key]=mv.effects.map(norm).map((e,i)=>({e,i,r:rank(e)})).sort((a,b)=>a.r-b.r||a.i-b.i).map(x=>x.e);}
for(const mv of changed){const anchor='"'+mv.key+'": {"name"';const ai=body.indexOf(anchor);if(ai<0)throw new Error('missing '+mv.key);
 const ms=spanFrom(body,body.indexOf('{',ai+mv.key.length+3));const bd=findObj(body,'"battle_data": {',ms.start);
 const o=JSON.parse(body.slice(bd.start,bd.end));o.effects=finalEff[mv.key];body=body.slice(0,bd.start)+ser(o)+body.slice(bd.end);}
fs.writeFileSync(FILE+'.audit.bak',src);fs.writeFileSync(FILE,body);
const loadMap=t=>JSON.parse(t.slice(...Object.values(findObj(t,'const WAZA_MAP ='))));
const before=loadMap(src),after=loadMap(body);const keys=new Set(changed.map(m=>m.key));
let drift=0,ok=0;for(const k in before){if(keys.has(k))continue;if(JSON.stringify(before[k])!==JSON.stringify(after[k]))drift++;}
for(const mv of changed){if(JSON.stringify(after[mv.key].battle_data.effects)===JSON.stringify(finalEff[mv.key]))ok++;else console.log('不一致',mv.key);}
console.log('技総数:',Object.keys(after).length,'/ 適用:',changed.length,'/ effects一致:',ok,'/ drift:',drift);
console.log(drift===0&&ok===changed.length?'✅ 検証OK (backup: pokechan_data.js.audit.bak)':'❌ NG');
