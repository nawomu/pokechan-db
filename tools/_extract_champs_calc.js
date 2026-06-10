/* Champions計算機(VGC.calc Champions版)のデータ抽出(一回もの・読むだけ)
 * 出典: https://vgc-champions-calc.pages.dev/ (note記事 https://note.com/engage_redive/n/n90e4c72f48ff
 *   で紹介されている計算機のポケモンチャンピオンズ版。2026-06-10 阿部さん指定の参考ソース)
 * バンドルJSに埋め込まれた技データ({id,name,nameEn,type,category,power,...})と
 * ポケモンデータ({id,name,nameEn,types,baseStats,abilities,height,weight})を正規表現で抽出し
 * review/_champions_calc_data.json に保存する。
 * 実行: node tools/_extract_champs_calc.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://vgc-champions-calc.pages.dev/';

async function main() {
  // 1) index.html からバンドルURLを取る(ハッシュ付きファイル名は変わりうる)
  const html = await (await fetch(SITE)).text();
  const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!m) throw new Error('バンドルURLが見つからない');
  const bundleUrl = SITE.replace(/\/$/, '') + m[1];
  console.log('バンドル:', bundleUrl);
  const js = await (await fetch(bundleUrl)).text();
  console.log('サイズ:', (js.length / 1e6).toFixed(2), 'MB');

  // 2) 技データ抽出: {id:"...",name:"...",nameEn:"...",type:"...",category:"...",...}
  //    power/accuracy は無い技もある。flags は1段ネストまで。
  const moveRe = /\{id:"([a-z0-9]+)",name:"([^"]+)",nameEn:"([^"]+)",type:"([a-z]+)",category:"(physical|special|status)"((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g;
  const moves = [];
  for (const mm of js.matchAll(moveRe)) {
    const [, id, name, nameEn, type, category, rest] = mm;
    const num = (key) => { const r = rest.match(new RegExp(`${key}:(\\d+)`)); return r ? Number(r[1]) : null; };
    moves.push({
      id, name, nameEn, type, category,
      power: num('power'), accuracy: rest.includes('accuracy:!0') ? true : num('accuracy'), pp: num('pp'),
      isSpread: rest.includes('isSpread:!0') || undefined,
    });
  }
  console.log('技:', moves.length);

  // 3) ポケモンデータ抽出
  const pokeRe = /\{id:"(\d+[a-z0-9-]*)",name:"([^"]+)",nameEn:"([^"]+)",types:\[([^\]]+)\],baseStats:\{hp:(\d+),attack:(\d+),defense:(\d+),specialAttack:(\d+),specialDefense:(\d+),speed:(\d+)\},abilities:\[([^\]]*)\](?:,height:([\d.]+))?(?:,weight:([\d.]+))?/g;
  const pokemon = [];
  for (const pm of js.matchAll(pokeRe)) {
    const [, id, name, nameEn, types, hp, atk, def, spa, spd, spe, abilities, height, weight] = pm;
    pokemon.push({
      id, name, nameEn,
      types: types.split(',').map(s => s.replace(/"/g, '').trim()),
      baseStats: { hp: +hp, atk: +atk, def: +def, spatk: +spa, spdef: +spd, spd: +spe },
      abilities: abilities.split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean),
      height: height ? +height : null, weight: weight ? +weight : null,
    });
  }
  console.log('ポケモン:', pokemon.length);

  const out = {
    source: SITE, bundle: bundleUrl, fetched: '2026-06-10',
    note: 'Champions向けダメージ計算機のバンドルから抽出。阿部さん指定の参考ソース(note記事の計算機のChampions版)',
    move_count: moves.length, pokemon_count: pokemon.length,
    moves, pokemon,
  };
  const outPath = path.join(ROOT, 'review', '_champions_calc_data.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log('✅ →', outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
