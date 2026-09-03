// tools/_fetch_wiki_pokemon_text.js — ポケモンWikiの種ページを生テキストで裏溜め(2026-09-03・図鑑諸元の全数照合の材料)
// 出力: reference/_genus_material/wiki_<種名>.txt(既存はスキップ=再開可)。種名=master名から括弧を落としたもの(メガ○○/ゲンシ○○はWikiに独立ページあり)
// 使い方: node tools/_fetch_wiki_pokemon_text.js   (0.7秒間隔・失敗は reference/_genus_material/_fetch_fail.json)
const fs = require('fs'), path = require('path');
const DIR = 'reference/_genus_material';
const P = require('../master/pokemon.json').items;
const species = [...new Set(P.map(x => String(x.name).replace(/[（(].*$/, '')))];
const strip = h => h.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ').replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|div|tr|li|h\d|th|td)>/g, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const fail = {}; let done = 0, skip = 0;
  for (const sp of species) {
    const out = path.join(DIR, `wiki_${sp}.txt`);
    if (fs.existsSync(out) && fs.statSync(out).size > 2000) { skip++; continue; }
    try {
      const r = await fetch('https://wiki.pokemonwiki.com/wiki/' + encodeURIComponent(sp), { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) { fail[sp] = 'HTTP' + r.status; continue; }
      const t = strip(await r.text());
      if (!/おもさ/.test(t)) { fail[sp] = 'no-infobox'; continue; }
      fs.writeFileSync(out, t); done++;
      if (done % 50 === 0) console.log('fetched', done, 'skip', skip, 'fail', Object.keys(fail).length);
    } catch (e) { fail[sp] = String(e.message || e); }
    await sleep(700);
  }
  fs.writeFileSync(path.join(DIR, '_fetch_fail.json'), JSON.stringify({ fetched: '2026-09-03', fail }, null, 1));
  console.log('done fetched', done, 'skip', skip, 'fail', Object.keys(fail).length, Object.keys(fail).slice(0, 20).join(','));
})();
