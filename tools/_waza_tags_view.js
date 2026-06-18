/* タグベース一覧 — タグごとに含まれている技を一覧表示するページ(2026-06-18 阿部さん依頼)
 * 並び順: タグの多い順(降順)
 * 出力: review/waza_tags_view.html
 * 元データ: tools/_waza_list_confirm.js の getMoveFilterTags(同一エンジン=タグ生成の二重管理を防ぐ)
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

// 既存のタグ生成ロジックを再利用するため、_waza_list_confirm.js を読み込んで getMoveFilterTags を取り出す。
// module.exportsしてないが、生成済みHTMLから抽出するのが手堅い→既存の data-tags 属性をパース。
const { compose, map: WAZA_MAP } = require('./_waza_compose.js');

// 既に review/waza_list_confirm.html が最新なら、そこから data-tags を読み出す。
// なければ簡易フォールバック(警告)。
const CONFIRM_HTML = path.join(ROOT, 'review', 'waza_list_confirm.html');
if (!fs.existsSync(CONFIRM_HTML)) {
  console.error('review/waza_list_confirm.html が無い→ 先に node tools/_waza_list_confirm.js を実行');
  process.exit(1);
}
const html = fs.readFileSync(CONFIRM_HTML, 'utf8');

// 各 <tr data-tags="..."> から技名とタグを抽出
// <tr data-tags="🤢 状態で..|🔻 ..">...<span class="name-cell">技名</span>...</tr>
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const moveTags = {}; // move名 → タグ配列
const tagMoves = {}; // タグ → 技配列 [{name, type, category, power, accuracy, learners}]
const rowRe = /<tr data-tags="([^"]*)">[\s\S]*?<\/tr>/g;
let m;
let n = 0;
while ((m = rowRe.exec(html))) {
  const tagsStr = m[1];
  const block = m[0];
  const nameMatch = block.match(/<span class="name-cell">([^<]+)<\/span>/);
  if (!nameMatch) continue;
  const name = nameMatch[1];
  if (moveTags[name]) continue; // 同じ技が複数kindセクションに出現→1回だけ集計
  // タイプ・分類・威力・命中・PP・習得数も拾う(行内のセル順から推測=不安定なので簡易)
  const typeMatch = block.match(/class="type-cell"[^>]*>([^<]+)</);
  const clsMatch = block.match(/class="cls-badge[^"]*">([^<]+)</);
  const powerMatch = block.match(/<td class="col-power num-cell">([^<]+)</);
  const accMatch = block.match(/<td class="col-acc num-cell">([^<]+)</);
  const ppMatch = block.match(/<td class="col-pp num-cell">([^<]+)</);
  const learnMatch = block.match(/<td class="col-learners">([^<]+)</);
  const data = {
    name,
    type: typeMatch ? typeMatch[1] : '',
    category: clsMatch ? clsMatch[1] : '',
    power: powerMatch ? powerMatch[1].replace(/<[^>]+>/g, '').trim() : '',
    accuracy: accMatch ? accMatch[1].replace(/<[^>]+>/g, '').trim() : '',
    pp: ppMatch ? ppMatch[1].replace(/<[^>]+>/g, '').trim() : '',
    learners: learnMatch ? learnMatch[1].replace(/<[^>]+>/g, '').trim() : '',
  };
  const tags = tagsStr.split('|').filter(s => s);
  moveTags[name] = tags;
  for (const t of tags) {
    if (!tagMoves[t]) tagMoves[t] = [];
    tagMoves[t].push(data);
  }
  n++;
}
console.log(`抽出: ${n}行 / ${Object.keys(moveTags).length}技 / ${Object.keys(tagMoves).length}タグ`);

// タグの多い順(降順)、同数はタグ名で昇順
const tags = Object.entries(tagMoves).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ja'));

const typeColors = { "ノーマル": "#A8A878", "ほのお": "#F08030", "みず": "#6890F0", "でんき": "#F8D030", "くさ": "#78C850", "こおり": "#98D8D8", "かくとう": "#C03028", "どく": "#A040A0", "じめん": "#E0C068", "ひこう": "#A890F0", "エスパー": "#F85888", "むし": "#A8B820", "いわ": "#B8A038", "ゴースト": "#705898", "ドラゴン": "#7038F8", "あく": "#705848", "はがね": "#B8B8D0", "フェアリー": "#EE99AC" };
const clsBadge = c => c === '物理' ? 'cls-phys' : c === '特殊' ? 'cls-spec' : 'cls-stat';

// タグ別グループ統計
const totalMoves = Object.keys(moveTags).length;
const totalTagCount = tags.length;
const oneOnly = tags.filter(t => t[1].length === 1).length;
const twoToFive = tags.filter(t => t[1].length >= 2 && t[1].length <= 5).length;
const sixToTwenty = tags.filter(t => t[1].length >= 6 && t[1].length <= 20).length;
const above20 = tags.filter(t => t[1].length > 20).length;

const sections = tags.map(([tag, moves], i) => {
  const id = 'tag-' + i;
  const rows = moves.map(d => {
    const color = typeColors[d.type] || '#999';
    return `<tr>
<td class="num">${d.learners}</td>
<td class="mv"><a href="http://localhost:8000/review/waza_list_confirm.html#${encodeURIComponent(d.name)}" target="_blank">${esc(d.name)}</a></td>
<td class="type"><span class="type-cell" style="background:${color}">${esc(d.type)}</span></td>
<td class="cls"><span class="cls-badge ${clsBadge(d.category)}">${esc(d.category)}</span></td>
<td class="num">${esc(d.power)}</td>
<td class="num">${esc(d.accuracy)}</td>
<td class="num">${esc(d.pp)}</td>
</tr>`;
  }).join('\n');
  return `<section class="tag-sec" id="${id}" data-tag="${esc(tag)}">
<h2><span class="tag-name">${esc(tag)}</span><span class="tag-count">${moves.length}技</span></h2>
<table>
<thead><tr><th>習得</th><th>わざ名</th><th>タイプ</th><th>分類</th><th>威力</th><th>命中</th><th>PP</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</section>`;
}).join('\n');

const toc = tags.map(([tag, moves], i) =>
  `<a class="toc-chip" href="#tag-${i}" data-tag="${esc(tag)}">${esc(tag)}<span class="c">${moves.length}</span></a>`
).join('');

const out = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>タグ別 技一覧 — タグの多い順</title>
<style>
body{margin:0;font-family:-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;background:#fff;color:#222;font-size:14px}
.hdr{padding:12px 18px;background:#1F4E79;color:#fff;position:sticky;top:0;z-index:50}
.hdr h1{font-size:17px;margin:0}
.hdr .sub{font-size:12px;color:#cfe0f0;margin-top:5px}
.bar{padding:9px 18px;background:#eef3fa;border-bottom:1px solid #C5D2E5;display:flex;gap:8px;align-items:center;flex-wrap:wrap;position:sticky;top:48px;z-index:40}
.bar input{padding:5px 12px;border-radius:8px;border:1px solid #C5D2E5;font-size:13px;width:220px}
.bar button{padding:4px 12px;border-radius:14px;border:1px solid #C5D2E5;background:#fff;cursor:pointer;font-weight:700;font-size:12px;color:#1F4E79}
.bar button.on{background:#1F4E79;color:#fff;border-color:#1F4E79}
.summary{font-size:12px;color:#33415c;background:#fff;border:1px solid #C5D2E5;border-radius:6px;padding:5px 10px}
.toc{padding:10px 18px;background:#f5f8fc;border-bottom:1px solid #C5D2E5;max-height:160px;overflow-y:auto}
.toc-chip{display:inline-flex;align-items:center;gap:4px;text-decoration:none;font-size:11.5px;background:#fff;border:1px solid #C5D2E5;color:#1F4E79;border-radius:12px;padding:2px 9px;margin:2px;white-space:nowrap}
.toc-chip:hover{background:#1F4E79;color:#fff}
.toc-chip .c{color:#7a8aa0;font-weight:700}
.toc-chip:hover .c{color:#cfe0f0}
.tag-sec{margin:18px 18px 24px;border:1px solid #C5D2E5;border-radius:8px;overflow:hidden;background:#fff}
.tag-sec h2{margin:0;padding:9px 14px;background:#1F4E79;color:#fff;font-size:14px;display:flex;align-items:center;gap:10px}
.tag-name{flex:1}
.tag-count{font-size:11px;background:#173049;padding:2px 9px;border-radius:10px}
.tag-sec table{border-collapse:collapse;width:100%;font-size:12.5px}
.tag-sec thead th{background:#f3f6fb;color:#1F4E79;padding:5px 8px;text-align:center;border-bottom:1px solid #C5D2E5;font-weight:700;font-size:11px}
.tag-sec tbody td{padding:4px 8px;border-bottom:1px solid #EEE;vertical-align:middle}
.tag-sec tbody tr:hover{background:#f3f6fb}
td.mv a{color:#1F4E79;font-weight:700;text-decoration:none}
td.mv a:hover{text-decoration:underline}
td.num{text-align:center;font-family:monospace;width:50px}
td.type{width:62px;text-align:center;padding:1px}
.type-cell{display:block;color:#fff;text-align:center;padding:3px 4px;border-radius:3px;font-weight:700;font-size:11px;white-space:nowrap}
td.cls{width:42px;text-align:center}
.cls-badge{display:inline-block;padding:1px 6px;border-radius:3px;color:#fff;font-size:10px;font-weight:700}
.cls-badge.cls-phys{background:#f0883e}
.cls-badge.cls-spec{background:#58a6ff}
.cls-badge.cls-stat{background:#6e7681}
.tag-sec.hidden{display:none}
.to-top{position:fixed;right:20px;bottom:22px;z-index:200;background:#1F4E79;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 15px;border-radius:24px;box-shadow:0 3px 10px rgba(0,0,0,.28);opacity:.92}
.to-top:hover{background:#16395c}
</style></head><body>
<div class="hdr" id="top">
<h1>🏷 タグ別 技一覧 — タグの多い順</h1>
<div class="sub">全${totalTagCount}タグ・${totalMoves}技。タグごとに含まれる技を表示。技名クリックで waza_list_confirm に飛びます。</div>
</div>
<div class="bar">
<input id="q" placeholder="タグ名でしぼり込み…">
<button data-f="all" class="on">全部</button>
<button data-f="lots">多い順(6技以上)</button>
<button data-f="few">少ない(2-5技)</button>
<button data-f="one">1技だけ</button>
<span class="summary">📊 1技=${oneOnly} / 2〜5技=${twoToFive} / 6〜20技=${sixToTwenty} / 20技超=${above20}</span>
</div>
<nav class="toc">${toc}</nav>
${sections}
<a href="#top" class="to-top">↑ 上へ</a>
<script>
const secs=[...document.querySelectorAll(".tag-sec")];
const chips=[...document.querySelectorAll(".toc-chip")];
let filter="all";
function apply(){
  const q=document.getElementById("q").value.trim().toLowerCase();
  for(const s of secs){
    const tag=s.dataset.tag.toLowerCase();
    const count=parseInt(s.querySelector(".tag-count").textContent);
    const matchQ=!q||tag.includes(q);
    let matchF=true;
    if(filter==="lots")matchF=count>=6;
    else if(filter==="few")matchF=count>=2&&count<=5;
    else if(filter==="one")matchF=count===1;
    s.classList.toggle("hidden",!(matchQ&&matchF));
  }
  for(const c of chips){
    const tag=c.dataset.tag.toLowerCase();
    c.style.display=!q||tag.includes(q)?"":"none";
  }
}
document.getElementById("q").addEventListener("input",apply);
document.querySelectorAll(".bar button[data-f]").forEach(b=>b.addEventListener("click",()=>{
  filter=b.dataset.f;
  document.querySelectorAll(".bar button[data-f]").forEach(x=>x.classList.remove("on"));
  b.classList.add("on");
  apply();
}));
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'review', 'waza_tags_view.html'), out);
console.log(`生成: review/waza_tags_view.html / ${tags.length}タグ・${totalMoves}技`);
