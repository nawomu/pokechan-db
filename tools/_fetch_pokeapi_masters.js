// PokeAPI 特性/技/道具 の多言語マスターを consolidated で取得 → reference/{abilities,moves,items}_master.json
// 裏溜め。決定的取得(再実行可)。使い方: node tools/_fetch_pokeapi_masters.js [abilities|moves|items|all]
const fs=require('fs');
const GQL='https://beta.pokeapi.co/graphql/v1beta';
const LANGS=['ja-Hrkt','en','fr','de','es','it','ko','zh-Hans','zh-Hant'];
const LMAP={'ja-Hrkt':'ja','en':'en','fr':'fr','de':'de','es':'es','it':'it','ko':'ko','zh-Hans':'zh-Hans','zh-Hant':'zh-Hant'};
const LF=`{pokemon_v2_language:{name:{_in:${JSON.stringify(LANGS)}}}}`;
async function gql(q){for(let a=0;a<4;a++){try{const r=await fetch(GQL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});const j=await r.json();if(j.errors)throw new Error(JSON.stringify(j.errors).slice(0,200));return j.data;}catch(e){if(a===3)throw e;await new Promise(r=>setTimeout(r,1500*(a+1)));}}}
function names(arr){const o={};(arr||[]).forEach(n=>{o[LMAP[n.pokemon_v2_language.name]]=n.name;});return o;}
fs.mkdirSync('reference',{recursive:true});

async function abilities(){
  const all=[];const CH=400;
  for(let off=0;;off+=CH){
    const q=`query{ pokemon_v2_ability(limit:${CH},offset:${off},order_by:{id:asc}){ id name pokemon_v2_abilitynames(where:${LF}){name pokemon_v2_language{name}} pokemon_v2_abilityeffecttexts(where:{pokemon_v2_language:{name:{_eq:"en"}}}){short_effect} } }`;
    const d=await gql(q);const rows=d.pokemon_v2_ability;if(!rows.length)break;
    for(const a of rows)all.push({id:a.id,slug:a.name,names:names(a.pokemon_v2_abilitynames),effect_en:((a.pokemon_v2_abilityeffecttexts||[])[0]||{}).short_effect||''});
    process.stdout.write(`\rabilities: ${all.length}`);if(rows.length<CH)break;
  }
  fs.writeFileSync('reference/abilities_master.json',JSON.stringify(all));console.log(`\nabilities_master.json: ${all.length}`);
}
async function moves(){
  const all=[];const CH=400;
  for(let off=0;;off+=CH){
    const q=`query{ pokemon_v2_move(limit:${CH},offset:${off},order_by:{id:asc}){ id name power accuracy pp priority pokemon_v2_type{name} pokemon_v2_movedamageclass{name} pokemon_v2_movenames(where:${LF}){name pokemon_v2_language{name}} pokemon_v2_moveeffect{pokemon_v2_moveeffecteffecttexts(where:{pokemon_v2_language:{name:{_eq:"en"}}}){short_effect}} } }`;
    const d=await gql(q);const rows=d.pokemon_v2_move;if(!rows.length)break;
    for(const m of rows)all.push({id:m.id,slug:m.name,names:names(m.pokemon_v2_movenames),type:(m.pokemon_v2_type||{}).name,damage_class:(m.pokemon_v2_movedamageclass||{}).name,power:m.power,accuracy:m.accuracy,pp:m.pp,priority:m.priority,effect_en:((((m.pokemon_v2_moveeffect||{}).pokemon_v2_moveeffecteffecttexts||[])[0])||{}).short_effect||''});
    process.stdout.write(`\rmoves: ${all.length}`);if(rows.length<CH)break;
  }
  fs.writeFileSync('reference/moves_master.json',JSON.stringify(all));console.log(`\nmoves_master.json: ${all.length}`);
}
async function items(){
  const all=[];const CH=500;
  for(let off=0;;off+=CH){
    const q=`query{ pokemon_v2_item(limit:${CH},offset:${off},order_by:{id:asc}){ id name cost pokemon_v2_itemnames(where:${LF}){name pokemon_v2_language{name}} pokemon_v2_itemeffecttexts(where:{pokemon_v2_language:{name:{_eq:"en"}}}){short_effect} pokemon_v2_itemcategory{name} } }`;
    const d=await gql(q);const rows=d.pokemon_v2_item;if(!rows.length)break;
    for(const it of rows)all.push({id:it.id,slug:it.name,cost:it.cost,category:(it.pokemon_v2_itemcategory||{}).name,names:names(it.pokemon_v2_itemnames),effect_en:((it.pokemon_v2_itemeffecttexts||[])[0]||{}).short_effect||''});
    process.stdout.write(`\ritems: ${all.length}`);if(rows.length<CH)break;
  }
  fs.writeFileSync('reference/items_master.json',JSON.stringify(all));console.log(`\nitems_master.json: ${all.length}`);
}
(async()=>{const w=process.argv[2]||'all';
  if(w==='abilities'||w==='all')await abilities();
  if(w==='moves'||w==='all')await moves();
  if(w==='items'||w==='all')await items();
})();
