// Called by build_master_v2.js; reference input -> master catalogue only.
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
function build(root){
 const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const source=read('reference/_team_examples.json'),db={};
 for(const k of ['pokemon','moves','abilities','items','natures'])db[k]=read('master/'+k+'.json').items;
 const ids=new Set();
 for(const e of source.items){
  assert(e.slug&&!ids.has(e.slug),'Duplicate/missing example ID');ids.add(e.slug);
  assert(['single','double'].includes(e.format));assert(/^https:\/\//.test(e.source.url));
  assert(e.source.author&&e.source.checked_at&&(e.regulation===null||typeof e.regulation==='string'));assert(e.season===null||typeof e.season==='string');
  assert(e.members.length===6);assert.equal(new Set(e.members.map(s=>s.pokemon)).size,6);
  for(const s of e.members){
   assert(Object.keys(s).every(k=>['ability','item','moves','nature','points','pokemon','gender','mega','notes'].includes(k)));
   assert(['ability','item','moves','nature','points','pokemon'].every(k=>k in s));
   const p=db.pokemon.find(p=>p.slug===s.pokemon),a=db.abilities.find(a=>a.slug===s.ability);
   assert(p&&(s.ability===null||(a&&[p.ab1,p.ab2,p.ab3].includes(a.name))),'Invalid Pokemon/ability reference');
   if(s.gender)assert(['♂','♀','—'].includes(s.gender));
   if(s.mega){assert(db.pokemon.some(p=>p.slug===s.mega&&p.mega));const item=db.items.find(i=>i.slug===s.item);assert(item&&item.applies_to_pokemon.includes(p.name),'Stone/base-form mismatch');}
   assert(db.items.some(i=>i.slug===s.item));assert(db.natures.some(n=>n.up===s.nature[0]&&n.down===s.nature[1]));
   assert(s.points.length===6&&s.points.every(n=>Number.isInteger(n)&&n>=0&&n<=32));assert.equal(s.points.reduce((a,b)=>a+b,0),66);
   assert(s.moves.length===4&&new Set(s.moves).size===4);for(const id of s.moves)assert(db.moves.some(m=>m.slug===id),'Invalid move reference');
  }
 }
 const output={meta:{source:'reference/_team_examples.json',schema:1,note:source.note},count:source.items.length,items:source.items};
 fs.writeFileSync(path.join(root,'master/team_examples.json'),JSON.stringify(output,null,1)+'\n');
 console.log('  master/team_examples.json: '+output.count);return output.count;
}
module.exports={build};
