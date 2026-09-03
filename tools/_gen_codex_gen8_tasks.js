// tools/_gen_codex_gen8_tasks.js — R10 gen8-removed候補のうちverdict!=="both"(=JP wiki第八世代一覧表に行が無かった技。主にZワザ/相棒わざ)を
// Codexに二人目の目として確認させるタスクを生成(2026-09-03)
// 材料=reference/_genus_material/wiki_moves/wiki_<技名>.txt(tools/_fetch_wiki_move_text.js)
// 出力=reference/_genus_material/codex_tasks_gen8.json
// 回し方: bash tools/codex_task_runner.sh "$PWD/reference/_genus_material/codex_tasks_gen8.json" <shard> <nshard>  (CODEX_MODEL指定なし=一般モデル)
// 回収: node tools/_collect_codex_gen8.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const candidates = require(path.join(ROOT, 'reference/_gen8_removed_candidates.json'));
const targets = candidates.filter(x => x.verdict !== 'both');

const tasks = []; let nomat = 0;
const seenSlug = new Set();
for (const c of targets) {
  if (seenSlug.has(c.slug)) continue; seenSlug.add(c.slug);
  const mat = path.join(ROOT, 'reference/_genus_material/wiki_moves', `wiki_${c.name_ja}.txt`);
  if (!fs.existsSync(mat)) { nomat++; continue; }
  tasks.push({
    slug: c.slug,
    prompt: `あなたは検証担当。ポケモンの技「${c.name_ja}」(英語名=${c.name_en}・slug=${c.slug})が、第八世代(ポケットモンスター ソード・シールド、および同エンジンのブリリアントダイヤモンド・シャイニングパール)のバトルで「選択して使用できる技」かどうかを確認する。

材料=ポケモンWikiのこの技のページの生テキスト全文(${mat})。ファイルは一切書き換えない。ページを全文読んで判断すること。記憶や一般知識だけで断定しない(ページに書いてあることを根拠にする)。ページに直接の記述が無ければ verdict は "unknown" とし、根拠にした周辺情報(例:このわざの分類がZワザである・第七世代で追加された、等)を note に書く。

参考情報(このプロジェクトの調査・英語版Bulbapediaの一覧表より): この技はBulbapediaの「List of moves by availability (Generation VIII)」で「SwSh列=✘(使用不可)」と記録されている。ただしJP wikiの「わざ一覧(第八世代)」の通し番号表にはこの技の行自体が存在しなかった(Zワザ/相棒わざなど、通常のわざ番号表とは別枠で扱われている可能性がある)。

確認してほしいこと:
1. このページで、この技が「Zワザ」「相棒わざ」等どの技カテゴリに属すると書かれているか(quote)。
2. このページに「第七世代限定」「第八世代では使用できない」等、世代・作品限定を示す記述があるか(あれば一字一句quote)。
3. 上記1・2から、第八世代(SwSh/BDSP)で使用できるか。verdict="can_use"(使える)/"cannot_use"(使えない)/"unknown"(ページから判断できない)。

最後のメッセージは次のJSONだけ(前後に文章を付けない): {"slug":"${c.slug}","verdict":"can_use|cannot_use|unknown","category_quote":str,"gen_limit_quote":str,"note":str}`
  });
}
fs.writeFileSync(path.join(ROOT, 'reference/_genus_material/codex_tasks_gen8.json'), JSON.stringify({ out: 'reference/_gen8_audit_codex', tasks }, null, 1));
console.log('tasks', tasks.length, 'no material', nomat);
