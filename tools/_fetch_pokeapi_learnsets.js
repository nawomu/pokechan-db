// PokeAPI から全 variety(~1302)の learnset(覚える技 move slug 集合)を取得。
// 大元SSOTを汚さず別ファイルに切り出す。キー=variety slug(reference/pokeapi_master.json の slug と一致=JA名依存ゼロ)。
// 出力: reference/learnsets_master.json = { "<variety slug>": ["<move slug>", ...] }
// 実行: node tools/_fetch_pokeapi_learnsets.js
const fs=require('fs');
const GQL='https://beta.pokeapi.co/graphql/v1beta';
async function gql(q){for(let a=0;a<5;a++){try{const r=await fetch(GQL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});const j=await r.json();if(j.errors)throw new Error(JSON.stringify(j.errors).slice(0,200));return j.data;}catch(e){if(a===4)throw e;await new Promise(r=>setTimeout(r,1500*(a+1)));}}}
(async()=>{
  const out={}; const CH=120; let total=0;
  for(let off=0;;off+=CH){
    const q=`query{ pokemon_v2_pokemon(limit:${CH},offset:${off},order_by:{id:asc}){
      name
      pokemon_v2_pokemonmoves(distinct_on:move_id){ pokemon_v2_move{name} }
    } }`;
    const d=await gql(q); const rows=d.pokemon_v2_pokemon; if(!rows.length)break;
    for(const p of rows){
      const moves=[...new Set((p.pokemon_v2_pokemonmoves||[]).map(m=>m.pokemon_v2_move.name))].sort();
      out[p.name]=moves; total++;
    }
    process.stdout.write(`\rlearnsets: ${total} varieties`);
    if(rows.length<CH)break;
  }
  fs.writeFileSync('reference/learnsets_master.json',JSON.stringify(out));
  console.log(`\nsaved reference/learnsets_master.json: ${total} varieties`);
})();
