// tools/_gen_codex_dex_tasks.js — 図鑑諸元(分類/たかさ/おもさ/性別)の全数照合タスクをCodex(Spark)用に生成(2026-09-03)
// 材料=reference/_genus_material/wiki_<種名>.txt(tools/_fetch_wiki_pokemon_text.js)。出力=reference/_genus_material/codex_tasks_dex_all.json
// 回し方: CODEX_MODEL=gpt-5.3-codex-spark bash tools/codex_task_runner.sh "$PWD/reference/_genus_material/codex_tasks_dex_all.json" <shard> <nshard>
// 回収: node tools/_collect_codex_dex.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const P = require('../master/pokemon.json').items;
const g = x => x.genderless || x.gender_female_pct == null ? 'ふめい(性別不明)' : x.gender_female_pct === 100 ? '100% ♀' : x.gender_female_pct === 0 ? '100% ♂' : `${100 - x.gender_female_pct}% ♂ ・ ${x.gender_female_pct}% ♀`;
const tasks = []; let nomat = 0;
for (const x of P) {
  const sp = String(x.name).replace(/[（(].*$/, ''); const form = String(x.name).slice(sp.length);
  const mat = path.join(ROOT, 'reference/_genus_material', `wiki_${sp}.txt`);
  if (!fs.existsSync(mat)) { nomat++; continue; }
  const ours = `分類=${x.genus_ja ?? '(空)'} / たかさ=${x.height_m ?? '(空)'}m / おもさ=${x.weight_kg ?? '(空)'}kg / 性別=${g(x)}`;
  const formNote = form ? `★この行は「${x.name}」=種「${sp}」の姿「${form}」。ページ内にその姿(フォルム)専用の値があればそれと比べ、無ければ種の値と比べて note に「姿専用の値なし」と書く。` : '';
  tasks.push({ slug: x.slug, prompt: `あなたは検証担当。ポケモン1体(slug=${x.slug}・名前=${x.name})の図鑑諸元を、ポケモンWikiの生テキスト(${mat})を全文読んで一字一句確かめる。ファイルは一切書き換えない。記憶で補完しない(ページに無ければunknown)。引用の無い判定は書かない。${formNote}
うちの値: ${ours}
各項目について verdict = match / mismatch / unknown、quote = ページに一字一句実在する原文(見出し行と値の行)。★表記の違い(単位・全角半角・「性別不明」と「ふめい」・♂♀の並び順)は mismatch にしない=値が同じなら match。小数や%の数が違うときだけ mismatch。
最後のメッセージは次のJSONだけ(前後に文章を付けない): {"slug":"${x.slug}","items":[{"aspect":"分類|たかさ|おもさ|性別","ours":str,"page_value":str,"verdict":"match|mismatch|unknown","quote":str,"note":str}]}` });
}
fs.writeFileSync(path.join(ROOT, 'reference/_genus_material/codex_tasks_dex_all.json'), JSON.stringify({ out: 'reference/_dex_audit_codex', tasks }, null, 1));
console.log('tasks', tasks.length, 'no material', nomat);
