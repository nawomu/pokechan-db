// tools/_fetch_pokeapi_pokemon_raw.js — 全ポケモン(master/pokemon.json の slug 全件)の図鑑諸元を PokeAPI(GraphQL)から一括取得して裏に溜める
// 目的(2026-09-03 阿部さん「既存のポケモンのデータは全部DBに入れておいて。次の更新でいちいち取ってこなくて済むように」):
//   重さ/高さ/性別比/分類/タマゴグループ/捕捉率/経験値タイプ/伝説・幻フラグ/特性(隠れ含む) を全件キャッシュ。
//   ★これは中間ファイル(reference/_pokeapi_pokemon_raw.json)。master への反映は build_master_v2.js が「champions=false or 値が空の欄だけ」を
//   pokeapi_provisional として埋める(Champions正典の値は上書きしない=出典の優先順位①②)。
// 使い方: node tools/_fetch_pokeapi_pokemon_raw.js   (決定的・再実行で上書き)
const fs = require('fs');
const GQL = 'https://beta.pokeapi.co/graphql/v1beta';
const P = require('../master/pokemon.json').items;
const slugs = [...new Set(P.map(p => p.slug).filter(Boolean))];
async function gql(q) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
      const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300)); return j.data;
    } catch (e) { if (a === 3) throw e; await new Promise(r => setTimeout(r, 1500 * (a + 1))); }
  }
}
(async () => {
  const out = {}; const CH = 100;
  for (let i = 0; i < slugs.length; i += CH) {
    const part = slugs.slice(i, i + CH);
    const q = `query{ pokemon_v2_pokemon(where:{name:{_in:${JSON.stringify(part)}}}){
      id name height weight base_experience is_default
      pokemon_v2_pokemonabilities(order_by:{slot:asc}){ slot is_hidden pokemon_v2_ability{ name pokemon_v2_abilitynames(where:{pokemon_v2_language:{name:{_eq:"ja"}}}){name} } }
      pokemon_v2_pokemonspecy{ id gender_rate capture_rate base_happiness hatch_counter is_legendary is_mythical is_baby
        pokemon_v2_growthrate{name}
        pokemon_v2_pokemonspeciesnames(where:{pokemon_v2_language:{name:{_in:["ja","en"]}}}){genus pokemon_v2_language{name}}
        pokemon_v2_pokemonegggroups{ pokemon_v2_egggroup{name} }
      }
    } }`;
    const d = await gql(q);
    for (const p of d.pokemon_v2_pokemon) {
      const sp = p.pokemon_v2_pokemonspecy || {};
      const genus = {}; (sp.pokemon_v2_pokemonspeciesnames || []).forEach(n => { genus[n.pokemon_v2_language.name] = n.genus; });
      out[p.name] = {
        id: p.id, dex: sp.id || null, is_default: p.is_default,
        height_m: p.height != null ? p.height / 10 : null,       // PokeAPI=デシメートル
        weight_kg: p.weight != null ? p.weight / 10 : null,      // PokeAPI=ヘクトグラム
        base_experience: p.base_experience,
        gender_rate: sp.gender_rate,                              // -1=性別不明 / 0..8 = ♀の割合(8分の)
        capture_rate: sp.capture_rate, base_happiness: sp.base_happiness, hatch_counter: sp.hatch_counter,
        is_legendary: !!sp.is_legendary, is_mythical: !!sp.is_mythical, is_baby: !!sp.is_baby,
        growth_rate: sp.pokemon_v2_growthrate ? sp.pokemon_v2_growthrate.name : null,
        genus_ja: genus.ja || null, genus_en: genus.en || null,
        egg_groups: (sp.pokemon_v2_pokemonegggroups || []).map(g => g.pokemon_v2_egggroup.name),
        abilities: (p.pokemon_v2_pokemonabilities || []).map(a => ({ slot: a.slot, hidden: a.is_hidden, en: a.pokemon_v2_ability.name, ja: (a.pokemon_v2_ability.pokemon_v2_abilitynames[0] || {}).name || null })),
      };
    }
    process.stdout.write(`\r${Math.min(i + CH, slugs.length)}/${slugs.length}`);
  }
  // ★GraphQL(beta)は id 10277 で止まっている(2026-09-03 実測)。ZA メガ等はRESTにだけ在る → RESTで補完
  //   うちの slug と PokeAPI の名前が違うものは ALIAS(推測でなく REST 一覧で実在確認済み)
  const ALIAS = { 'floette-eternal-mega': 'floette-mega' };   // frillish-male/jellicent-male はREST側も同名(GraphQLにだけ無い)
  const rest = async u => { for (let a = 0; a < 4; a++) { try { const r = await fetch(u); if (r.status === 404) return null; if (!r.ok) throw new Error(r.status); return await r.json(); } catch (e) { if (a === 3) throw e; await new Promise(r => setTimeout(r, 1500 * (a + 1))); } } };
  for (const s of slugs.filter(s => !out[s])) {
    const p = await rest(`https://pokeapi.co/api/v2/pokemon/${ALIAS[s] || s}`); if (!p) continue;
    const sp = await rest(p.species.url) || {};
    const genus = {}; (sp.genera || []).forEach(n => { genus[n.language.name] = n.genus; });
    const abilities = [];
    for (const a of p.abilities || []) {
      const ab = await rest(a.ability.url) || {};
      abilities.push({ slot: a.slot, hidden: a.is_hidden, en: a.ability.name, ja: ((ab.names || []).find(n => n.language.name === 'ja') || {}).name || null });
    }
    out[s] = {
      id: p.id, dex: sp.id || null, is_default: p.is_default, pokeapi_slug: p.name, via: 'rest',
      height_m: p.height != null ? p.height / 10 : null, weight_kg: p.weight != null ? p.weight / 10 : null,
      base_experience: p.base_experience, gender_rate: sp.gender_rate, capture_rate: sp.capture_rate,
      base_happiness: sp.base_happiness, hatch_counter: sp.hatch_counter,
      is_legendary: !!sp.is_legendary, is_mythical: !!sp.is_mythical, is_baby: !!sp.is_baby,
      growth_rate: sp.growth_rate ? sp.growth_rate.name : null, genus_ja: genus.ja || null, genus_en: genus.en || null,
      egg_groups: (sp.egg_groups || []).map(g => g.name), abilities,
    };
    process.stdout.write(`\rrest ${s}          `);
  }
  const missing = slugs.filter(s => !out[s]);
  fs.writeFileSync('reference/_pokeapi_pokemon_raw.json', JSON.stringify({
    what: 'PokeAPI 図鑑諸元の生データ(全件キャッシュ。masterへは build_master_v2.js が champions正典の無い欄だけ pokeapi_provisional で埋める)',
    fetched: new Date().toISOString(), source: GQL, count: Object.keys(out).length, missing_slugs: missing, items: out,
  }, null, 1));
  console.log(`\nsaved ${Object.keys(out).length} / missing ${missing.length}: ${missing.join(',')}`);
})();
