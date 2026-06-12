/* 生成したコンテンツページを sitemap.xml に反映(JA単独URL)。
 * <!-- CONTENT_PAGES_START/END --> マーカー間を毎回置換するので何度でも安全に再実行可。
 * 実行: node tools/_gen_content_sitemap.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = 'https://pchamdb.com';
const today = new Date().toISOString().slice(0, 10);

function list(dir) {
  return fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.html')).sort();
}
function url(loc, pri, freq) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${pri}</priority>\n  </url>`;
}

const blocks = [];
// 一覧(index)は優先度高め(/type/ は一覧ページ廃止のため除外)
for (const dir of ['pokemon', 'move', 'ability']) {
  blocks.push(url(`${BASE}/${dir}/`, '0.7', 'weekly'));
}
// 個別ページ
for (const dir of ['pokemon', 'ability', 'type']) {
  for (const f of list(dir)) {
    if (f === 'index.html') continue;
    blocks.push(url(`${BASE}/${dir}/${encodeURIComponent(f)}`, '0.6', 'monthly'));
  }
}

const marker = `  <!-- CONTENT_PAGES_START -->\n${blocks.join('\n')}\n  <!-- CONTENT_PAGES_END -->`;
const xmlPath = path.join(ROOT, 'sitemap.xml');
let xml = fs.readFileSync(xmlPath, 'utf8');
const re = /  <!-- CONTENT_PAGES_START -->[\s\S]*?  <!-- CONTENT_PAGES_END -->\n?/;
if (re.test(xml)) {
  xml = xml.replace(re, marker + '\n');
} else {
  xml = xml.replace('</urlset>', marker + '\n</urlset>');
}
fs.writeFileSync(xmlPath, xml);
console.log('✅ sitemap.xml 更新:', blocks.length, 'URL追加 (lastmod', today + ')');
