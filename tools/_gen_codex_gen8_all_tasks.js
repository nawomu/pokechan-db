// tools/_gen_codex_gen8_all_tasks.js — R10後工程(Spark)「gensに8を含む旧技の第八世代使用不可 全数照合」
// 対象=reference/_gen8_all_removed_candidates.json の items(50件・前回の152件候補とは重複無し)
// 材料=reference/_genus_material/wiki_moves/wiki_<技名>.txt(tools/_fetch_wiki_move_text_gen8_all.js で取得済み)
// 出力=reference/_genus_material/codex_tasks_gen8_all.json
// 回し方: bash tools/codex_task_runner.sh "$PWD/reference/_genus_material/codex_tasks_gen8_all.json" <shard> <nshard>  (CODEX_MODEL指定なし=一般モデル)
// 回収: node tools/_collect_codex_gen8_all.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const cand = require(path.join(ROOT, 'reference/_gen8_all_removed_candidates.json'));
const targets = cand.items;

const tasks = []; let nomat = 0;
const seenSlug = new Set();
for (const c of targets) {
  if (seenSlug.has(c.slug)) continue; seenSlug.add(c.slug);
  const mat = path.join(ROOT, 'reference/_genus_material/wiki_moves', `wiki_${c.name_ja}.txt`);
  if (!fs.existsSync(mat)) { nomat++; continue; }
  tasks.push({
    slug: c.slug,
    prompt: `あなたは検証担当。ポケモンの技「${c.name_ja}」(英語名=${c.name_en}・slug=${c.slug})が、第八世代(ポケットモンスター ソード・シールド、および同エンジンのブリリアントダイヤモンド・シャイニングパール)のバトルで「選択して使用できる技」かどうかを確認する。

材料=ポケモンWikiのこの技のページの生テキスト全文(${mat})。ファイルは一切書き換えない。ページを全文読んで判断すること。記憶や一般知識だけで断定しない(ページに書いてあることを根拠にする)。ページに直接の記述が無ければ verdict は "unknown" とし、根拠にした周辺情報(例:このわざが追加された世代・削除の記述の有無等)を note に書く。

参考情報(このプロジェクトのマスターデータより・未確認の仮説): この技はマスターデータ上、初出=第${c.master_gen_introduced}世代、これまで記録されている使用可能世代=[${c.master_gens.join(',')}]で、**第九世代(スカーレット・バイオレット)が含まれていない**(=現行世代では選択できない可能性がある)。ただし「いつから使えなくなったか」(第八世代からか、第九世代からか)はまだ未確認。この技が第七世代までしか使えない旧技で、かつ第八世代(SwSh/BDSP)でも既に選択できなかった可能性がある、という仮説を検証してほしい。

確認してほしいこと:
1. このページに、この技の「登場作品」「対応バージョン」等の一覧(通常わざ一覧の対応マーク○×表・作品名の列挙など)があれば、そこに第八世代(ソード・シールド/ブリリアントダイヤモンド・シャイニングパール)が含まれているか含まれていないか(あれば一字一句quote)。
2. このページに「第七世代限定」「第八世代では使用できない」「(第八世代で)技の削除」等、世代・作品限定を明示する記述があるか(あれば一字一句quote)。
3. 上記1・2から、第八世代(SwSh/BDSP)で使用できるか。verdict="can_use"(使える)/"cannot_use"(使えない)/"unknown"(ページから判断できない)。

最後のメッセージは次のJSONだけ(前後に文章を付けない): {"slug":"${c.slug}","verdict":"can_use|cannot_use|unknown","availability_quote":str,"gen_limit_quote":str,"note":str}`
  });
}
fs.writeFileSync(path.join(ROOT, 'reference/_genus_material/codex_tasks_gen8_all.json'), JSON.stringify({ out: 'reference/_gen8_all_audit_codex', tasks }, null, 1));
console.log('tasks', tasks.length, 'no material', nomat);
