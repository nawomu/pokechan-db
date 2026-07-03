/* 生成したコンテンツページを sitemap.xml に反映。
 * 全言語URL × hreflangクラスタ形式 (Google推奨方式)
 * <!-- CONTENT_PAGES_START/END --> マーカー間を毎回置換するので何度でも安全に再実行可。
 * 実行: node tools/_gen_content_sitemap.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = 'https://pchamdb.com';
const LANGS = ['ja', 'en', 'fr', 'de', 'es', 'it', 'ko', 'zh-Hans', 'zh-Hant'];
const NON_JA = LANGS.filter(l => l !== 'ja');
const today = new Date().toISOString().slice(0, 10);

// en/kind/slug.html のhreflang="ja"からja URLを取得
function jaUrlFromEnPage(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/hreflang="ja" href="([^"]+)"/);
  return m ? m[1] : null;
}

// ability/type: en/種別/slug.html -> クラスタ(ja URL + 全言語 URL)
function buildCluster(kind) {
  const dir = path.join(ROOT, 'en', kind);
  if (!fs.existsSync(dir)) return [];
  const slugs = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html').sort();
  return slugs.map(f => {
    const slug = f.replace('.html', '');
    const jaUrl = jaUrlFromEnPage(path.join(dir, f));
    if (!jaUrl) { console.warn('⚠ ja URL not found:', f); return null; }
    const urls = { ja: jaUrl };
    for (const l of NON_JA) urls[l] = `${BASE}/${l}/${kind}/${slug}.html`;
    return { slug, urls };
  }).filter(Boolean);
}

// pokemon: slug共通(英語) - en/pokemon/*.html から取得
function buildPokemonCluster() {
  const dir = path.join(ROOT, 'en', 'pokemon');
  const slugs = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html').sort();
  return slugs.map(f => {
    const slug = f.replace('.html', '');
    const urls = { ja: `${BASE}/pokemon/${slug}.html` };
    for (const l of NON_JA) urls[l] = `${BASE}/${l}/pokemon/${slug}.html`;
    return { slug, urls };
  });
}

// hreflangクラスタ付きXMLエントリを1言語のURLごとに生成
function clusterEntries(cluster, pri, freq) {
  const { urls } = cluster;
  const xhtmlLinks = LANGS.map(l =>
    `    <xhtml:link rel="alternate" hreflang="${l}" href="${urls[l]}"/>`
  ).join('\n');
  const xdef = `    <xhtml:link rel="alternate" hreflang="x-default" href="${urls['ja']}"/>`;

  // 全言語URLそれぞれを<loc>として登録(Google推奨方式)
  return LANGS.map(l =>
    `  <url>\n    <loc>${urls[l]}</loc>\n${xhtmlLinks}\n${xdef}\n    <lastmod>${today}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${pri}</priority>\n  </url>`
  ).join('\n');
}

const blocks = [];

// インデックスページ(言語別なし=jaのみ)
for (const dir of ['pokemon', 'ability']) {
  blocks.push(`  <url>\n    <loc>${BASE}/${dir}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`);
}

// コンテンツページ(全言語 × hreflangクラスタ)
const pokemonClusters = buildPokemonCluster();
const abilityClusters = buildCluster('ability');
const typeClusters = buildCluster('type');

for (const c of pokemonClusters) blocks.push(clusterEntries(c, '0.6', 'monthly'));
for (const c of abilityClusters) blocks.push(clusterEntries(c, '0.6', 'monthly'));
for (const c of typeClusters) blocks.push(clusterEntries(c, '0.5', 'monthly'));

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
const total = pokemonClusters.length * 9 + abilityClusters.length * 9 + typeClusters.length * 9 + 2;
console.log('✅ sitemap.xml 更新:', total, 'URL追加 (lastmod', today + ')');
console.log('  pokemon:', pokemonClusters.length * 9, '/ ability:', abilityClusters.length * 9, '/ type:', typeClusters.length * 9);
