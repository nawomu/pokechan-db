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

// ページファイル名 → i18n セクションキー (how_to_use だけ howto に対応)
function sectionKey(page) {
  return page.replace('.html', '') === 'how_to_use' ? 'howto' : page.replace('.html', '');
}

// JSON-LD の inLanguage を再帰的に言語別へ差し替え
function setInLanguage(node, lang) {
  if (Array.isArray(node)) { node.forEach(n => setInLanguage(n, lang)); return; }
  if (node && typeof node === 'object') {
    if ('inLanguage' in node) node.inLanguage = lang;
    for (const k of Object.keys(node)) setInLanguage(node[k], lang);
  }
}

// FAQPage の mainEntity を i18n(howto.faqN_q / faqN_a)から言語別に生成
function buildFaq(d) {
  const out = [];
  for (let i = 1; i <= 5; i++) {
    const q = get(d, `howto.faq${i}_q`), a = get(d, `howto.faq${i}_a`);
    if (q && a) out.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });
  }
  return out;
}

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
    } else {
      // ガイド系: meta description / og:title / og:description を言語別に上書き
      // (title は data-i18n=page_title で localize 済み → それを og/twitter に流用)
      const desc = get(dict[lang], sectionKey(page) + '.meta_desc') || '';
      const locTitle = $('title').text();
      if (desc) {
        $('meta[name="description"]').attr('content', desc);
        $('meta[property="og:description"]').attr('content', desc);
        $('meta[name="twitter:description"]').attr('content', desc);
      }
      if (locTitle) {
        $('meta[property="og:title"]').attr('content', locTitle);
        $('meta[name="twitter:title"]').attr('content', locTitle);
      }
      $('meta[property="og:locale"]').attr('content', lang.replace('-', '_'));
    }

    // JSON-LD: inLanguage を言語別化し、how_to_use の FAQ は i18n から再生成
    $('script[type="application/ld+json"]').each((i, el) => {
      let json;
      try { json = JSON.parse($(el).html()); } catch (e) { return; }
      setInLanguage(json, lang);
      if (page === 'how_to_use.html' && json['@type'] === 'FAQPage') {
        json.mainEntity = buildFaq(dict[lang]);
      }
      $(el).html('\n' + JSON.stringify(json, null, 2) + '\n');
    });

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

// Sitemap generation is shared with the content builder. The old hard-coded
// short list discarded thousands of valid URLs whenever i18n was regenerated.
require('./_gen_content_sitemap.js').build();
