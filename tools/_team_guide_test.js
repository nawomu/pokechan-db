'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..');const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const db={};for(const k of ['pokemon','moves','abilities','items','natures','learnsets'])db[k]=read('master/'+k+'.json').items;
const c={window:{},document:{addEventListener(){}},PokeDB:{teamExample:()=>read('master/team_examples.json').items[0],ready:{then(fn){fn();return{catch(){}};}}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'team_guide.js'),'utf8')+';this.sets=TEAM_GUIDE_SETS',c);
assert.equal(c.sets.length,6);assert.equal(new Set(c.sets.map(s=>s.pokemon)).size,6);assert.equal(new Set(c.sets.map(s=>s.item)).size,6);
for(const s of c.sets){
 const p=db.pokemon.find(p=>p.slug===s.pokemon),a=db.abilities.find(a=>a.slug===s.ability),item=db.items.find(i=>i.slug===s.item);
 assert(p && a && item,s.pokemon);assert([p.ab1,p.ab2,p.ab3].includes(a.name),s.pokemon+' ability');
 assert(db.natures.some(n=>n.up===s.nature[0]&&n.down===s.nature[1]),s.pokemon+' nature');
 assert.equal(s.points.reduce((a,b)=>a+b,0),66);assert(s.points.every(n=>Number.isInteger(n)&&n>=0&&n<=32));
 const learned=db.learnsets.find(l=>l.name===p.name);
 assert.equal(new Set(s.moves).size,4);
 for(const id of s.moves){const move=db.moves.find(m=>m.slug===id);assert(move,id);assert(learned.learn.includes(move.name),s.pokemon+' cannot learn '+id);}
 for(const lang of ['','en/','fr/','de/','es/','it/','ko/','zh-Hans/','zh-Hant/'])assert(fs.existsSync(path.join(root,lang+'pokemon/'+p.slug+'.html')));
}
const ja=read('i18n/ui-ja.json').teamGuide,ability=db.abilities.find(a=>a.slug==='clear-body');
if(ability.effect_i18n)assert.equal(ability.effect_i18n.source_ja,ability.effect_ja);
for(const lang of ['ja','en','fr','de','es','it','ko','zh-Hans','zh-Hant']){
 const text=read('i18n/ui-'+lang+'.json').teamGuide;assert.deepEqual(Object.keys(text).sort(),Object.keys(ja).sort());
 assert(Object.values(text).every(v=>typeof v==='string'&&v.length>0));
 if(lang!=='ja'){
  const dict=read('i18n/'+lang+'.json');assert(dict.abilities[ability.name].short_effect);if(lang==='en'||ability.effect_i18n)assert.equal(dict.abilities[ability.name].short_effect,lang==='en'?ability.effect_en:ability.effect_i18n.translations[lang]);
  for(const s of c.sets){const p=db.pokemon.find(p=>p.slug===s.pokemon);assert(dict.pokemon[p.name]!==p.name,lang+':pokemon');for(const id of s.moves)assert(dict.moves[id]&&dict.moves[id].name,lang+':'+id);}
 }
}
console.log('PASS: six unique sets, point caps, abilities, natures, 24 learnable moves, 54 detail links, 9 article dictionaries, existing ability dictionaries (canonical translations checked when provided)');
