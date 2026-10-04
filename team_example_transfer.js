/* URL carries a catalogue ID only. Resolve through PokeDB, then adapt to the existing editable state. */
'use strict';
(function(global){
 const keys=['hp','atk','def','spatk','spdef','spd'];
 function incomingId(){return new URLSearchParams(location.search).get('team-example');}
 function fail(message){throw new Error(message);}
 function resolve(id){
  const example=PokeDB.teamExample(id);if(!example)fail('invalid');
  if(!['single','double'].includes(example.format)||example.members.length!==6)fail('incompatible');
  const seen=new Set();
  const members=example.members.map(set=>{
   const pokemon=PokeDB.allPokemon().find(p=>p.slug===set.pokemon),ability=set.ability===null?null:PokeDB.ability(set.ability),item=PokeDB.items().find(i=>i.slug===set.item),nature=PokeDB.natures().find(n=>n.up===set.nature[0]&&n.down===set.nature[1]),moves=set.moves.map(id=>PokeDB.move(id));
   if(!pokemon||seen.has(pokemon.slug)||(set.ability!==null&&!ability)||!item||!nature||moves.length!==4||new Set(set.moves).size!==4||moves.some(m=>!m))fail('incompatible');seen.add(pokemon.slug);
   if(ability&&![pokemon.ab1,pokemon.ab2,pokemon.ab3].includes(ability.name))fail('incompatible');
   if(!Array.isArray(set.points)||set.points.length!==6||set.points.some(n=>!Number.isInteger(n)||n<0||n>32)||set.points.reduce((a,b)=>a+b,0)!==66)fail('incompatible');
   if(!moves.every(m=>(PokeDB.learnset(pokemon.name)||[]).includes(m.name)))fail('historicalRestricted');
   const mega=set.mega?PokeDB.allPokemon().find(p=>p.slug===set.mega):null;
   if(set.mega&&(!mega||!item.applies_to_pokemon||!item.applies_to_pokemon.includes(pokemon.name)))fail('incompatible');
   let gender=set.gender||'';
   if(gender&&!['♂','♀','—'].includes(gender))fail('incompatible');
   const fixed=pokemon.genderless?'—':pokemon.gender_female_pct===100?'♀':pokemon.gender_female_pct===0?'♂':'';
   if(gender&&fixed&&gender!==fixed)fail('incompatible');if(!gender&&fixed)gender=fixed;
   return {pokemon,ability,item,nature,moves,mega,gender,effort:Object.fromEntries(keys.map((k,i)=>[k,set.points[i]]))};
  });return {example,members};
 }
 function builderState(model,baseline,size){
  const state=Object.assign({},baseline,{party:Array(size).fill(null),slotFilters:{},partyNatures:Array(size).fill('まじめ'),partyEvs:Array.from({length:size},()=>Object.fromEntries(keys.map(k=>[k,0]))),partyItems:Array(size).fill(''),partyGenders:Array(size).fill(''),partyAbilities:Array(size).fill(null),partyExampleId:model.example.slug});
  model.members.forEach((m,i)=>{state.party[i]=m.pokemon.name;state.slotFilters[i]={_all:m.moves.map(x=>x.slug)};state.partyNatures[i]=m.nature.name;state.partyEvs[i]={...m.effort};state.partyItems[i]=m.item.slug;state.partyGenders[i]=m.gender;state.partyAbilities[i]=m.ability?m.ability.name:null;});return state;
 }
 function battleMembers(model,engine){
  if(model.example.format!=='single')fail('doubleUnsupported');
  return model.members.map(m=>{
   const poke=engine.pokeByName(m.pokemon.name),item=engine.itemByKey(m.item.slug),nature=engine.natureList().find(n=>n[0]===m.nature.name),moves=m.moves.map(x=>engine.usableMoves(poke).find(y=>y.name===x.name));
   if(!poke||poke.mega||!item||!nature||moves.some(x=>!x)||m.ability&&![poke.ab1,poke.ab2,poke.ab3].includes(m.ability.name))fail('incompatible');
   return {name:poke.name,ability:m.ability?m.ability.name:null,item:m.item.slug,nature:m.nature.name,effort:{...m.effort},gender:m.gender,moves};
  });
 }
 function issues(members){const out=[];members.forEach(m=>{
  if(!m.ability)out.push({code:'abilityNeeded',name:m.name||(m.pokemon&&m.pokemon.name)||''});
  if(!m.gender)out.push({code:'genderNeeded',name:m.name||(m.pokemon&&m.pokemon.name)||''});
  const item=typeof m.item==='string'?PokeDB.items().find(x=>x.slug===m.item):m.item;
  if(item&&item.implemented===false)out.push({code:'unsupportedItem',name:item.name});
 });return out;}
 let notice=null;
 function notify(code,details=[],title=null){notice={code,details,title};renderNotice();}
 function renderNotice(){
  if(!notice||!global.I18N||!document.body)return;
  let box=document.getElementById('team-example-notice');if(!box){box=document.createElement('section');box.id='team-example-notice';box.setAttribute('role','status');box.style.cssText='margin:12px;padding:14px;border:2px solid #ff9a3d;border-radius:10px;background:#fff8ee;color:#292929;font:14px/1.7 system-ui,sans-serif;';document.body.prepend(box);}
  box.replaceChildren();const head=document.createElement('p');head.textContent=I18N.t('teamTransfer.'+notice.code)+(notice.title?' — '+I18N.t(notice.title):'');box.append(head);
  notice.details.forEach(x=>{const p=document.createElement('p');p.textContent=I18N.t('teamTransfer.'+x.code)+(x.name?' ('+(x.code==='unsupportedItem'?I18N.item(x.name):I18N.pokemon(x.name))+')':'');box.append(p);});
 }
 function consume(){try{const u=new URL(location.href);u.searchParams.delete('team-example');history.replaceState(null,'',u.href);}catch(e){}}
 document.addEventListener('i18n:ready',renderNotice);document.addEventListener('i18n:changed',()=>{if(document.getElementById('team-example-notice'))renderNotice();});
 global.TeamExampleTransfer={incomingId,resolve,builderState,battleMembers,issues,notify,consume};
})(window);
