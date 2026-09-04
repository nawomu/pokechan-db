// PokeAPI 全ポケモン variety(基本+メガ/リージョン/フォルム ~1302)を多言語マスターで取得。
// 「裏溜め」consolidated master(i18n/cache の per-file キャッシュを補完する一覧)。決定的取得=正確。
// 出力: reference/pokeapi_master.json
// ★★止め金(2026-09-04・兄弟2本 _fetch_pokeapi_masters.js/_fetch_pokeapi_learnsets.js と同型・
//   2026-07-31に付いたガードの付け忘れ=review/_page_data_audit_r2_2026-09-04.md 指摘): このスクリプトは
//   reference/pokeapi_master.json に**書き戻す**。その場所は2026-07-31に「紛らわしい旧マスター」として
//   reference/_old_master/ へ退避した。ここを走らせると、片付けたはずのファイルが reference/ 直下に
//   **復活し、また「どれが本物のマスターか分からない」状態に戻る**(阿部さんが実際にそう言った状態)。
//   ★本物のマスターは master/*.json ただ1つ。生成は node tools/build_master_v2.js。
//   どうしても取り直したい時だけ、意図を示して実行すること:
//       ALLOW_OLD_MASTER_WRITE=1 node tools/_fetch_pokeapi_varieties.js
if (!process.env.ALLOW_OLD_MASTER_WRITE) {
  console.error('■ 中止しました: このスクリプトは旧マスター(reference/pokeapi_master.json)に書き戻します。');
  console.error('  本物のマスターは master/*.json です(生成= node tools/build_master_v2.js)。');
  console.error('  どうしても必要なら ALLOW_OLD_MASTER_WRITE=1 を付けて実行してください。');
  process.exit(2);
}

const fs=require('fs');
const GQL='https://beta.pokeapi.co/graphql/v1beta';
const LANGS=['ja-Hrkt','en','fr','de','es','it','ko','zh-Hans','zh-Hant'];
const LMAP={'ja-Hrkt':'ja','en':'en','fr':'fr','de':'de','es':'es','it':'it','ko':'ko','zh-Hans':'zh-Hans','zh-Hant':'zh-Hant'};
async function gql(q){for(let a=0;a<4;a++){try{const r=await fetch(GQL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});const j=await r.json();if(j.errors)throw new Error(JSON.stringify(j.errors).slice(0,200));return j.data;}catch(e){if(a===3)throw e;await new Promise(r=>setTimeout(r,1500*(a+1)));}}}
const LF=`{pokemon_v2_language:{name:{_in:${JSON.stringify(LANGS)}}}}`;
function names(arr){const o={};(arr||[]).forEach(n=>{o[LMAP[n.pokemon_v2_language.name]]=n.name;});return o;}
// pokemon_name=フォームの「完全名」(例: Hisuian Samurott)。name(=Hisuian Form等のラベル)とは別カラム。
// ラベルで種名を上書きすると壊れる(2026-07-06発覚)ため完全名も取得する
function fullNames(arr){const o={};(arr||[]).forEach(n=>{if(n.pokemon_name)o[LMAP[n.pokemon_v2_language.name]]=n.pokemon_name;});return o;}
(async()=>{
  const all=[]; const CH=300;
  for(let off=0;;off+=CH){
    const q=`query{ pokemon_v2_pokemon(limit:${CH},offset:${off},order_by:{id:asc}){
      id name is_default
      pokemon_v2_pokemonspecy{ id pokemon_v2_pokemonspeciesnames(where:${LF}){name pokemon_v2_language{name}} }
      pokemon_v2_pokemonforms{ form_name is_mega pokemon_v2_pokemonformnames(where:${LF}){name pokemon_name pokemon_v2_language{name}} }
      pokemon_v2_pokemontypes(order_by:{slot:asc}){ pokemon_v2_type{name} }
      pokemon_v2_pokemonstats{ base_stat pokemon_v2_stat{name} }
      pokemon_v2_pokemonabilities(order_by:{slot:asc}){ is_hidden pokemon_v2_ability{name} }
    } }`;
    const d=await gql(q); const rows=d.pokemon_v2_pokemon; if(!rows.length)break;
    for(const p of rows){
      const sp=p.pokemon_v2_pokemonspecy||{};
      const form=(p.pokemon_v2_pokemonforms||[])[0]||{};
      const stats={}; (p.pokemon_v2_pokemonstats||[]).forEach(s=>stats[s.pokemon_v2_stat.name]=s.base_stat);
      all.push({
        id:p.id, slug:p.name, dex:sp.id||null, is_default:p.is_default,
        is_mega:!!form.is_mega, form_slug:form.form_name||'',
        species_names:names(sp.pokemon_v2_pokemonspeciesnames),
        form_names:names(form.pokemon_v2_pokemonformnames),
        full_names:fullNames(form.pokemon_v2_pokemonformnames),
        types:(p.pokemon_v2_pokemontypes||[]).map(t=>t.pokemon_v2_type.name),
        stats:{hp:stats.hp,atk:stats.attack,def:stats.defense,spa:stats['special-attack'],spd:stats['special-defense'],spe:stats.speed},
        abilities:(p.pokemon_v2_pokemonabilities||[]).map(a=>({name:a.pokemon_v2_ability.name,hidden:a.is_hidden})),
      });
    }
    process.stdout.write(`\rvarieties: ${all.length}`);
    if(rows.length<CH)break;
  }
  fs.writeFileSync('reference/pokeapi_master.json',JSON.stringify(all));
  console.log(`\nsaved reference/pokeapi_master.json: ${all.length} varieties`);
})();
