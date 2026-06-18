#!/usr/bin/env node
/* タグの整合性チェック(2026-06-18 阿部さん依頼):
 * 1. 絵文字違いで同じ意味のタグ(バインド重複型)
 * 2. 同一技内のタグ重複
 * 3. クラス違いで同 text のタグ(tag-fieldとtag-misc両方など)
 * 4. 1技だけのタグ一覧(統合候補の参考)
 * 実行: node tools/_waza_tags_audit.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'review', 'waza_list_confirm.html');
const SRC = path.join(ROOT, 'tools', '_waza_list_confirm.js');

if (!fs.existsSync(HTML)) { console.error('先に node tools/_waza_list_confirm.js を実行'); process.exit(1); }
const html = fs.readFileSync(HTML, 'utf8');

// タグと技を抽出
const rows = html.split(/<tr[^>]*data-tags=/);
const tagCount = {}, tagMoves = {};
for (let i = 1; i < rows.length; i++) {
  const m = rows[i].match(/^"([^"]*)"/); if (!m) continue;
  const tags = m[1].split('|').filter(s => s);
  const nm = rows[i].match(/<span class="name-cell">([^<]+)<\/span>/);
  const move = nm ? nm[1] : '?';
  for (const t of tags) { tagCount[t] = (tagCount[t] || 0) + 1; (tagMoves[t] = tagMoves[t] || []).push(move); }
}

let issues = 0;

// ① 絵文字違いで同じ意味(絵文字を除去+先頭の数字%もまとめてカット=確率違いを「同じ意味」扱いしない)
const stripEmoji = t => t.replace(/^[^\p{L}\p{N}]+/u, '').trim(); // 先頭の非文字(=絵文字+空白等)を除去
const norm = t => stripEmoji(t);
const byNorm = {};
for (const t of Object.keys(tagCount)) { const n = norm(t); (byNorm[n] = byNorm[n] || []).push(t); }
const dupes = Object.entries(byNorm).filter(([, arr]) => arr.length >= 2);
console.log('### ① 絵文字違いで同じ素テキスト ###');
let realDupes = 0;
for (const [n, arr] of dupes) {
  // 確率違い(NN%XXX)はバリエーション=正当な分離
  if (/^\d+%/.test(n)) continue;
  console.log(`  素[${n}]:`);
  for (const t of arr) console.log(`    ${tagCount[t]}技  ${t} ← ${tagMoves[t].slice(0,3).join('、')}${tagMoves[t].length>3?'...':''}`);
  realDupes++;
  issues++;
}
if (!realDupes) console.log('  (なし)');

// ② 同一技内のタグ重複
console.log('\n### ② 同一技内のタグ重複 ###');
let inMoveDupes = 0;
for (let i = 1; i < rows.length; i++) {
  const m = rows[i].match(/^"([^"]*)"/); if (!m) continue;
  const tags = m[1].split('|').filter(s => s);
  const set = new Set(tags);
  if (tags.length !== set.size) {
    const nm = rows[i].match(/<span class="name-cell">([^<]+)<\/span>/);
    console.log(`  ◆${nm ? nm[1] : '?'}: ${tags.filter((t, j, a) => a.indexOf(t) !== j).join(', ')}`);
    inMoveDupes++; issues++;
  }
}
if (!inMoveDupes) console.log('  (なし)');

// ③ クラス違いで同 text(ソースで out.push を全部見る)
console.log('\n### ③ ソースコードで同 text・別 cls のタグ ###');
const src = fs.readFileSync(SRC, 'utf8');
const re = /out\.push\(\{cls:\s*['"]([^'"]+)['"],\s*text:\s*['"`]([^'"`]+)/g;
const texts = {};
let m;
while ((m = re.exec(src))) { const [, cls, text] = m; (texts[text] = texts[text] || new Set()).add(cls); }
const clsDupes = Object.entries(texts).filter(([, s]) => s.size > 1);
if (clsDupes.length) { for (const [t, s] of clsDupes) { console.log(`  ${t} → ${[...s].join(', ')}`); issues++; } }
else console.log('  (なし)');

// ④ 1技だけのタグ
const ones = Object.entries(tagCount).filter(([, c]) => c === 1).sort();
console.log(`\n### ④ 1技だけのタグ(統合候補・${ones.length}件)###`);
for (const [t, ] of ones.slice(0, 40)) console.log(`  ${t} ← ${tagMoves[t][0]}`);
if (ones.length > 40) console.log(`  …他 ${ones.length - 40} 件`);

// ⑤ 統計サマリ
const total = Object.keys(tagCount).length;
console.log('\n### ⑤ 統計 ###');
console.log(`  総タグ種数: ${total}`);
console.log(`  1技だけ: ${ones.length}`);
console.log(`  2〜5技: ${Object.values(tagCount).filter(c => c >= 2 && c <= 5).length}`);
console.log(`  6〜20技: ${Object.values(tagCount).filter(c => c >= 6 && c <= 20).length}`);
console.log(`  20技超: ${Object.values(tagCount).filter(c => c > 20).length}`);

console.log(`\n=== ${issues ? '⚠ ' + issues + '件の課題' : '✅ 重大な重複なし'} ===`);
process.exit(issues > 0 ? 1 : 0);
