/**
 * 静的多言語ページ生成スクリプト
 * 使い方ガイド系のコンテンツページを、i18n JSON を使って各言語の静的HTMLに変換し
 * /<lang>/<page>.html として出力する。SEO向け(独立URL+hreflang)。
 *
 * 実行: cd tools && node build_i18n_pages.js
 * 依存: cheerio (tools/node_modules)
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://pchamdb.com';

const ALL_LANGS = ['ja', 'en', 'es', 'fr', 'de', 'it', 'ko', 'zh-Hans', 'zh-Hant'];
const GEN_LANGS = ALL_LANGS.filter(l => l !== 'ja');           // ja はルート(=x-default)

// 生成対象ページ (コンテンツページ)
const PAGES = ['index.html', 'how_to_use.html', 'db_guide.html', 'builder_guide.html'];
// 同一言語ディレクトリ内に留めるリンク(相対のまま)
const KEEP_RELATIVE = new Set(PAGES);

const dict = {};
for (const l of ALL_LANGS) dict[l] = JSON.parse(fs.readFileSync(path.join(ROOT, `i18n/ui-${l}.json`), 'utf8'));

function get(d, dotted) { return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), d); }

// 正規URL: index はディレクトリ形(/ , /en/) で統一、その他は /en/page.html
function pageUrl(page, lang) {
  if (page === 'index.html') return SITE + '/' + (lang === 'ja' ? '' : lang + '/');
  return SITE + '/' + (lang === 'ja' ? '' : lang + '/') + page;
}

function localize($, lang) {
  const d = dict[lang];
  $('[data-i18n]').each((i, el) => { const v = get(d, $(el).attr('data-i18n')); if (v != null) $(el).text(v); });
  $('[data-i18n-html]').each((i, el) => { const v = get(d, $(el).attr('data-i18n-html')); if (v != null) $(el).html(v); });
  $('[data-i18n-attr]').each((i, el) => {
    ($(el).attr('data-i18n-attr') || '').split(',').forEach(pair => {
      const [attr, key] = pair.split(':').map(s => (s || '').trim());
      const v = get(d, key); if (attr && v != null) $(el).attr(attr, v);
    });
  });
}

// /<lang>/ 配下に置くため、ルート資産への相対パスへ ../ を付与
function rewritePaths($) {
  $('[href],[src]').each((i, el) => {
    for (const attr of ['href', 'src']) {
      const val = $(el).attr(attr);
      if (!val) continue;
      if (/^(https?:|mailto:|tel:|data:|#|\/|\.\.\/)/i.test(val)) continue; // 絶対/特殊/既に../
      const base = val.split(/[?#]/)[0].split('/').pop();
      if (KEEP_RELATIVE.has(base)) continue; // 同一言語ディレクトリ内のページ
      $(el).attr(attr, '../' + val);
    }
  });
}

let count = 0;
for (const page of PAGES) {
  const srcHtml = fs.readFileSync(path.join(ROOT, page), 'utf8');
  for (const lang of GEN_LANGS) {
    const $ = cheerio.load(srcHtml, { decodeEntities: false });
    $('html').attr('lang', lang);
    localize($, lang);

    // index.html はタイトル/説明が data-i18n 化されていないので tagline から言語別に設定
    if (page === 'index.html') {
      const tagline = get(dict[lang], 'site.tagline') || '';
      const title = 'PchamDB - ' + tagline;
      $('title').text(title);
      $('meta[property="og:title"]').attr('content', title);
      $('meta[name="twitter:title"]').attr('content', title);
      $('meta[name="description"]').attr('content', tagline);
      $('meta[property="og:description"]').attr('content', tagline);
      $('meta[name="twitter:description"]').attr('content', tagline);
      $('meta[property="og:locale"]').attr('content', lang.replace('-', '_'));
    }

    rewritePaths($);

    // canonical / hreflang を再構築
    $('link[rel="canonical"]').remove();
    $('link[rel="alternate"][hreflang]').remove();
    const canonical = pageUrl(page, lang);
    let hl = `\n<link rel="canonical" href="${canonical}">\n`;
    for (const l of ALL_LANGS) hl += `<link rel="alternate" hreflang="${l}" href="${pageUrl(page, l)}">\n`;
    hl += `<link rel="alternate" hreflang="x-default" href="${pageUrl(page, 'ja')}">\n`;
    $('head').append(hl);
    $('meta[property="og:url"]').attr('content', canonical);

    // ツールページ(runtime i18n)が言語を引き継げるよう localStorage を先に設定
    $('head').prepend(`<script>try{localStorage.setItem('pchamdb.lang','${lang}')}catch(e){}</script>\n`);

    const outDir = path.join(ROOT, lang);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, page), $.html());
    count++;
  }
}
console.log(`生成完了: ${count} ファイル (${PAGES.length}ページ × ${GEN_LANGS.length}言語)`);
console.log('出力先: ' + GEN_LANGS.map(l => `/${l}/`).join(', '));

// ===== sitemap.xml 再生成 (多言語 hreflang 対応) =====
function buildSitemap() {
  const TODAY = '2026-06-01';
  const contentPr = { 'index.html': '1.0', 'how_to_use.html': '0.8', 'db_guide.html': '0.7', 'builder_guide.html': '0.7' };
  const tools = [['pokemon_db_v9.html', '0.9'], ['party_checker.html', '0.9'], ['waza-list.html', '0.8'], ['type_chart.html', '0.7'], ['battle_simulator.html', '0.8']];
  const legal = ['making', 'terms', 'privacy', 'disclaimer', 'contact'];
  const locFor = (page, lang) => pageUrl(page, lang);
  const alt = (page) => {
    let s = '';
    for (const l of ALL_LANGS) s += `    <xhtml:link rel="alternate" hreflang="${l}" href="${locFor(page, l)}"/>\n`;
    s += `    <xhtml:link rel="alternate" hreflang="x-default" href="${locFor(page, 'ja')}"/>\n`;
    return s;
  };
  let o = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  o += '  <!-- コンテンツページ (各言語の静的URL + hreflang) -->\n';
  for (const page of PAGES) for (const l of ALL_LANGS) {
    o += '  <url>\n';
    o += `    <loc>${locFor(page, l)}</loc>\n`;
    o += alt(page);
    o += `    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${l === 'ja' ? contentPr[page] : (page === 'index.html' ? '0.9' : '0.6')}</priority>\n  </url>\n`;
  }
  o += '  <!-- 主要機能ページ (単一URL + ランタイム言語切替) -->\n';
  for (const [f, pr] of tools) o += `  <url>\n    <loc>${SITE}/${f}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${pr}</priority>\n  </url>\n`;
  o += '  <!-- 制作・法的ページ (ja + en) -->\n';
  for (const p of legal) for (const suf of ['', '_en']) {
    o += '  <url>\n';
    o += `    <loc>${SITE}/${p}${suf}.html</loc>\n`;
    o += `    <xhtml:link rel="alternate" hreflang="ja" href="${SITE}/${p}.html"/>\n`;
    o += `    <xhtml:link rel="alternate" hreflang="en" href="${SITE}/${p}_en.html"/>\n`;
    o += `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/${p}.html"/>\n`;
    o += `    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n`;
  }
  o += '</urlset>\n';
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), o);
  const urls = (o.match(/<loc>/g) || []).length;
  console.log(`sitemap.xml 再生成: ${urls} URL`);
}
buildSitemap();
