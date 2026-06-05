/** 交代系11技に精査標準を適用:
 *  - effects: timing/note/notes 除去・強制交代に selection:random_one・wild_battle→ext
 *  - immune: dynamax_target → ext.dynamax / fails_if: 野生レベル失敗 → ext.wild(no_replacement_availableは保持)
 *  - battle_data.ext(非表示namespace・日本語)に退避。旧ブール残骸は触らない。
 * 実行: node tools/_waza_block02_apply.js */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),FILE=path.join(ROOT,'pokechan_data.js');
const KEYS=["fukitobashi","hoeru","batontatchi","tonbogaeri","tomoenage","borutochenji","doragonteeru","sutezerifu","kuikkutaan","shippokiri","samuigyagu"];
function ser(v){if(v===null)return 'null';if(Array.isArray(v))return '['+v.map(ser).join(', ')+']';if(typeof v==='object')return '{'+Object.entries(v).map(([k,x])=>JSON.stringify(k)+': '+ser(x)).join(', ')+'}';return JSON.stringify(v);}
function spanFrom(t,b){let i=b,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return{start:b,end:i+1};}}}throw new Error('unb');}
function findObj(t,m,f=0){return spanFrom(t,t.indexOf('{',t.indexOf(m,f)));}
const src=fs.readFileSync(FILE,'utf8');let body=src;
const log=[];
for(const key of KEYS){
 const anchor='"'+key+'": {"name"';const ai=body.indexOf(anchor);if(ai<0)throw new Error('missing '+key);
 const ms=spanFrom(body,body.indexOf('{',ai+key.length+3));const bds=findObj(body,'"battle_data": {',ms.start);
 const bd=JSON.parse(body.slice(bds.start,bds.end));const ext=bd.ext||{};
 // effects 変換
 for(const e of (bd.effects||[])){
   delete e.timing; delete e.note; delete e.notes;
   if(e.wild_battle){ext.wild=(ext.wild?ext.wild+' / ':'')+'野生では戦闘終了';delete e.wild_battle;}
   if(typeof e.kind==='string'&&e.kind.indexOf('強制交代')===0&&!e.selection)e.selection='random_one';
 }
 // immune: dynamax を ext へ
 if(Array.isArray(bd.immune)){const dyn=bd.immune.filter(x=>x.type==='dynamax_target');const keep=bd.immune.filter(x=>x.type!=='dynamax_target');
   if(dyn.length)ext.dynamax='ダイマックス相手には(交代効果が)無効';
   if(keep.length)bd.immune=keep;else delete bd.immune;}
 // fails_if: 野生レベル失敗 を ext へ(no_replacement_available 等は保持)
 if(Array.isArray(bd.fails_if)){const wild=bd.fails_if.filter(x=>x.type==='wild_target_level_higher_than_user');const keep=bd.fails_if.filter(x=>x.type!=='wild_target_level_higher_than_user');
   if(wild.length)ext.wild=(ext.wild?ext.wild+' / ':'')+'相手が自分より高レベルだと失敗(野生)';
   if(keep.length)bd.fails_if=keep;else delete bd.fails_if;}
 if(Object.keys(ext).length)bd.ext=ext;
 body=body.slice(0,bds.start)+ser(bd)+body.slice(bds.end);
 log.push(key);
}
fs.writeFileSync(FILE+'.block02.bak',src);fs.writeFileSync(FILE,body);
// 検証
function lit(t,m){return t.slice(...Object.values(findObj(t,m)));}
const before=JSON.parse(lit(src,'const WAZA_MAP =')),after=JSON.parse(lit(body,'const WAZA_MAP ='));
const set=new Set(KEYS);let drift=0;for(const k in before){if(set.has(k))continue;if(JSON.stringify(before[k])!==JSON.stringify(after[k]))drift++;}
console.log('適用:',log.length,'/ 非対象drift:',drift,(drift===0?'✅':'❌'));
['fukitobashi','tonbogaeri','tomoenage'].forEach(k=>console.log('\n■'+after[k].name+': '+JSON.stringify(after[k].battle_data.effects)+'\n  ext:'+JSON.stringify(after[k].battle_data.ext||null)+' / immune:'+JSON.stringify(after[k].battle_data.immune||null)+' / fails_if:'+JSON.stringify(after[k].battle_data.fails_if||null)));
