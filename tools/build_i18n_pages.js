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

// 生成対象ページ (クリーンに data-i18n 化済みのコンテンツページ)
const PAGES = ['how_to_use.html', 'db_guide.html', 'builder_guide.html'];
// 同一言語ディレクトリ内に留めるリンク(相対のまま) ※ index は Phase2 で追加予定
const KEEP_RELATIVE = new Set(PAGES);

const dict = {};
for (const l of ALL_LANGS) dict[l] = JSON.parse(fs.readFileSync(path.join(ROOT, `i18n/ui-${l}.json`), 'utf8'));

function get(d, dotted) { return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), d); }

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
    rewritePaths($);

    // canonical / hreflang を再構築
    $('link[rel="canonical"]').remove();
    $('link[rel="alternate"][hreflang]').remove();
    const canonical = `${SITE}/${lang}/${page}`;
    let hl = `\n<link rel="canonical" href="${canonical}">\n`;
    hl += `<link rel="alternate" hreflang="ja" href="${SITE}/${page}">\n`;
    for (const l of GEN_LANGS) hl += `<link rel="alternate" hreflang="${l}" href="${SITE}/${l}/${page}">\n`;
    hl += `<link rel="alternate" hreflang="x-default" href="${SITE}/${page}">\n`;
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
