// tools/_fetch_pokeapi_items_raw.js — PokeAPI の全どうぐ(約2180件)を GraphQL から一括取得して裏に溜める
// 目的(B-3・2026-09-04): 持ち物master(master/items.json)を「全世代の持てる道具」に広げる入力。
//   ★これは中間ファイル(reference/_pokeapi_items_raw.json)。master への反映は build_master_v2.js が
//   「attributes に holdable を持つ道具のうち master に無いもの」を pokeapi_provisional の行として足し、
//   既存行には空欄(pokeapi_id/pokeapi_slug/names/cost/fling_power/effect_en)だけを埋める(Champions正典の値は上書きしない)。
//   旧 reference/_old_master/items_master.json(tools/_fetch_pokeapi_masters.js・2026-06)と違い、attributes(holdable等)/
//   pocket/fling_power/効果文/フレーバー(ja+en 最新VG)/初出世代 を持つ=「持てる道具か」をデータで判定できる。
// 使い方: node tools/_fetch_pokeapi_items_raw.js   (決定的・再実行で上書き)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const GQL = 'https://beta.pokeapi.co/graphql/v1beta';
const LANGS = ['ja', 'en', 'fr', 'de', 'es', 'it', 'ko', 'zh-Hans', 'zh-Hant'];
async function gql(q) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
      const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300)); return j.data;
    } catch (e) { if (a === 3) throw e; await new Promise(r => setTimeout(r, 1500 * (a + 1))); }
  }
}
(async () => {
  const out = {}; const CH = 150; let off = 0, total = 0;
  for (;;) {
    const q = `query{ pokemon_v2_item(order_by:{id:asc},limit:${CH},offset:${off}){
      id name cost fling_power
      pokemon_v2_itemcategory{ name pokemon_v2_itempocket{ name } }
      pokemon_v2_itemattributemaps{ pokemon_v2_itemattribute{ name } }
      pokemon_v2_itemnames{ name pokemon_v2_language{ name } }
      pokemon_v2_itemeffecttexts(where:{pokemon_v2_language:{name:{_eq:"en"}}}){ short_effect effect }
      pokemon_v2_itemflavortexts(where:{pokemon_v2_language:{name:{_in:["ja","en"]}}},order_by:{version_group_id:desc}){ flavor_text pokemon_v2_language{ name } pokemon_v2_versiongroup{ name generation_id } }
      pokemon_v2_itemgameindices(order_by:{generation_id:asc}){ generation_id }
      pokemon_v2_itemflingeffect{ name }
    } }`;
    const d = await gql(q);
    const rows = d.pokemon_v2_item || [];
    for (const it of rows) {
      const names = {}; (it.pokemon_v2_itemnames || []).forEach(n => { const l = n.pokemon_v2_language.name; if (LANGS.includes(l)) names[l] = n.name; });
      const flavor = {}; (it.pokemon_v2_itemflavortexts || []).forEach(f => {   // 言語ごとに最新VGの1本だけ(降順なので最初に見た物)
        const l = f.pokemon_v2_language.name; if (!flavor[l]) flavor[l] = { text: f.flavor_text.replace(/\s*\n\s*/g, ''), version_group: f.pokemon_v2_versiongroup.name, gen: f.pokemon_v2_versiongroup.generation_id };
      });
      const eff = (it.pokemon_v2_itemeffecttexts || [])[0] || {};
      const gi = (it.pokemon_v2_itemgameindices || []).map(g => g.generation_id);
      out[it.name] = {
        id: it.id, slug: it.name, cost: it.cost, fling_power: it.fling_power,
        fling_effect: it.pokemon_v2_itemflingeffect ? it.pokemon_v2_itemflingeffect.name : null,
        category: it.pokemon_v2_itemcategory ? it.pokemon_v2_itemcategory.name : null,
        pocket: (it.pokemon_v2_itemcategory && it.pokemon_v2_itemcategory.pokemon_v2_itempocket) ? it.pokemon_v2_itemcategory.pokemon_v2_itempocket.name : null,
        attributes: (it.pokemon_v2_itemattributemaps || []).map(a => a.pokemon_v2_itemattribute.name).sort(),
        holdable: (it.pokemon_v2_itemattributemaps || []).some(a => /^holdable/.test(a.pokemon_v2_itemattribute.name)),
        names,
        effect_en: eff.short_effect || null, effect_en_long: eff.effect || null,
        flavor_ja: flavor.ja || null, flavor_en: flavor.en || null,
        gen_introduced: gi.length ? gi[0] : (flavor.ja ? flavor.ja.gen : (flavor.en ? flavor.en.gen : null)),
        gen_introduced_source: gi.length ? 'game_indices' : (flavor.ja || flavor.en ? 'flavor_text_version_group' : null),
      };
    }
    total += rows.length; off += CH;
    process.stdout.write(`\r${total}`);
    if (rows.length < CH) break;
  }
  const holdable = Object.values(out).filter(x => x.holdable).length;
  const res = { what: 'PokeAPI 全どうぐの生データ(裏溜め・中間ファイル。masterではない)', fetched: new Date().toISOString().slice(0, 10),
    source: 'https://beta.pokeapi.co/graphql/v1beta pokemon_v2_item', count: total, holdable_count: holdable,
    note: 'holdable=attributes に holdable/holdable-active/holdable-passive のいずれかを持つ。names=9言語(ja-Hrktは除外)。flavor_*=言語ごとに最新version_groupの1本。gen_introduced=item_game_indices の最小 generation(無ければフレーバー文のVG世代=印 gen_introduced_source)。',
    items: out };
  fs.writeFileSync(path.join(ROOT, 'reference/_pokeapi_items_raw.json'), JSON.stringify(res, null, 1));
  console.log(`\nreference/_pokeapi_items_raw.json: ${total} 件(holdable ${holdable})`);
})().catch(e => { console.error(e); process.exit(1); });
