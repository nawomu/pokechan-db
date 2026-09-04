// tools/_fetch_wiki_move_text_gen8_all.js — ポケモンWikiの技ページを生テキストで裏溜め(2026-09-04)
// 対象=reference/_gen8_all_removed_candidates.json の items(=R10後工程「gensに8を含む旧技の第八世代使用不可 全数照合」の対象50件)
// 出力: reference/_genus_material/wiki_moves/wiki_<技名>.txt(既存はスキップ=再開可・旧セット66件と同じディレクトリを共有)
// 失敗記録: reference/_genus_material/wiki_moves/_fetch_fail_gen8_all.json(既存の _fetch_fail.json は上書きしない=別ファイル)
// 使い方: node tools/_fetch_wiki_move_text_gen8_all.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'reference/_genus_material/wiki_moves');
fs.mkdirSync(DIR, { recursive: true });
const cand = require(path.join(ROOT, 'reference/_gen8_all_removed_candidates.json'));
const targets = cand.items;
const strip = h => h.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ').replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|div|tr|li|h\d|th|td)>/g, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const fail = {}; let done = 0, skip = 0;
  for (const c of targets) {
    const name = c.name_ja;
    const out = path.join(DIR, `wiki_${name}.txt`);
    if (fs.existsSync(out) && fs.statSync(out).size > 500) { skip++; continue; }
    try {
      const r = await fetch('https://wiki.pokemonwiki.com/wiki/' + encodeURIComponent(name), { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) { fail[name] = 'HTTP' + r.status; continue; }
      const t = strip(await r.text());
      if (t.length < 200) { fail[name] = 'too-short'; continue; }
      fs.writeFileSync(out, t); done++;
    } catch (e) { fail[name] = String(e.message || e); }
    await sleep(700);
  }
  fs.writeFileSync(path.join(DIR, '_fetch_fail_gen8_all.json'), JSON.stringify({ fetched: '2026-09-04', fail }, null, 1));
  console.log('done fetched', done, 'skip', skip, 'fail', Object.keys(fail).length, JSON.stringify(Object.keys(fail)));
})();
