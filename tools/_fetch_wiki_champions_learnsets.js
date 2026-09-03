// tools/_fetch_wiki_champions_learnsets.js — ポケモンWikiの「<種名>/Pokémon Championsのおぼえるわざ」を生テキストで裏溜め
// 目的: Champions行(master/learnsets.json champions=true・出典=ヤックン/ch/ 1本)の覚える技を第2ソースで全数照合する材料(2026-09-04)
// 出力: reference/_genus_material/wiki_ch_learn_<種名>.txt(既存はスキップ=再開可)。種名=master名の括弧を落とし、メガ/ゲンシ接頭辞と末尾X/Yを外したもの
// 使い方: node tools/_fetch_wiki_champions_learnsets.js   (0.7秒間隔・失敗は reference/_genus_material/_fetch_ch_learn_fail.json)
const fs = require('fs'), path = require('path');
const DIR = 'reference/_genus_material';
const L = require('../master/learnsets.json').items.filter(x => x.champions);
// 種名: 括弧を落とす → メガ/ゲンシ接頭辞を外す(メガニウム=種名そのものは残す) → メガのX/Y/Z接尾辞を外す(メガライチュウX/メガアブソルZ等) → ♂♀はニャオニクスだけ外す(ニドラン♂♀は種名)
const BASE = new Set(require('../master/pokemon.json').items.filter(x => !x.mega && !/^ゲンシ/.test(x.name)).map(x => String(x.name).replace(/[（(].*$/, '')));
const speciesOf = n => {
  let s = String(n).replace(/[（(].*$/, '');
  if (/^(メガ|ゲンシ)/.test(s) && !BASE.has(s)) {
    s = s.replace(/^(メガ|ゲンシ)/, '');
    if (!BASE.has(s) && BASE.has(s.replace(/[XYZ]$/, ''))) s = s.replace(/[XYZ]$/, '');
    if (!BASE.has(s) && BASE.has(s.replace(/[♂♀]$/, ''))) s = s.replace(/[♂♀]$/, '');
  }
  return s;
};
const species = [...new Set(L.map(x => speciesOf(x.name)))];
const strip = h => h.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ').replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|div|tr|li|h\d|th|td)>/g, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#8212;/g, '—')
  .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));
module.exports = { speciesOf };
if (require.main === module) (async () => {
  const fail = {}; let done = 0, skip = 0;
  for (const sp of species) {
    const out = path.join(DIR, `wiki_ch_learn_${sp}.txt`);
    if (fs.existsSync(out) && fs.statSync(out).size > 1000) { skip++; continue; }
    try {
      const r = await fetch('https://wiki.pokemonwiki.com/wiki/' + encodeURIComponent(sp) + '/' + encodeURIComponent('Pokémon_Championsのおぼえるわざ'), { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) { fail[sp] = 'HTTP' + r.status; await sleep(700); continue; }
      const t = strip(await r.text());
      if (!/Pokémon Champions/.test(t)) { fail[sp] = 'no-table'; await sleep(700); continue; }
      fs.writeFileSync(out, t); done++;
      if (done % 25 === 0) console.log('fetched', done, 'skip', skip, 'fail', Object.keys(fail).length);
    } catch (e) { fail[sp] = String(e.message || e); }
    await sleep(700);
  }
  fs.writeFileSync(path.join(DIR, '_fetch_ch_learn_fail.json'), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), fail }, null, 1));
  console.log('done fetched', done, 'skip', skip, 'fail', Object.keys(fail).length, Object.keys(fail).slice(0, 30).join(','));
})();
