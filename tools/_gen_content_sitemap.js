'use strict';
/* Canonical sitemap builder (single entry point for content + i18n builders).
 * Read the published HTML metadata, never infer nine URLs from one filename:
 * aliases, noindex pages and noncanonical copies must not enter the sitemap.
 * Existing unchanged entries/lastmod dates are preserved. New URLs omit lastmod
 * because a regeneration timestamp is not evidence of a content update.
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://pchamdb.com';
const LANGS = ['en', 'fr', 'de', 'es', 'it', 'ko', 'zh-Hans', 'zh-Hant'];
const KINDS = ['pokemon', 'ability', 'type', 'move'];
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function fileOf(url) {
  const u = new URL(url, SITE);
  if (u.origin !== SITE) throw new Error('External canonical/alternate URL: ' + url);
  let rel = decodeURIComponent(u.pathname).replace(/^\//, '');
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  if (rel.split('/').includes('..')) throw new Error('Unsafe URL: ' + url);
  return rel;
}
function publicFiles(root = ROOT) {
  const out = [];
  function add(dir) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) return;
    for (const f of fs.readdirSync(full).sort())
      if (f.endsWith('.html') && fs.statSync(path.join(full, f)).isFile()) out.push(path.posix.join(dir, f));
  }
  for (const prefix of ['', ...LANGS]) {
    add(prefix);
    for (const kind of KINDS) add(path.posix.join(prefix, kind));
  }
  return out;
}
function readPages(root = ROOT) {
  const pages = new Map();
  for (const file of publicFiles(root)) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const $ = cheerio.load(html.split(/<\/head\s*>/i)[0]);
    if ($('meta[http-equiv]').toArray().some(e => $(e).attr('http-equiv').toLowerCase() === 'refresh')) continue;
    if ($('meta[name]').toArray().some(e => /^(robots|googlebot)$/i.test($(e).attr('name')) && /\bnoindex\b/i.test($(e).attr('content') || ''))) continue;
    const cs = $('link[rel="canonical"]');
    if (cs.length !== 1) throw new Error('Expected one canonical: ' + file);
    const url = new URL(cs.attr('href'), SITE + '/' + file).href;
    if (fileOf(url) !== file) continue;
    const alternatives = $('link[rel="alternate"][hreflang]').toArray().map(e => ({
      lang: $(e).attr('hreflang'), url: new URL($(e).attr('href'), SITE + '/' + file).href
    }));
    pages.set(file, { url, alternatives });
  }
  // Fail closed instead of emitting broken or redirecting hreflang targets.
  for (const [file, p] of pages) for (const a of p.alternatives) {
    if (!pages.has(fileOf(a.url))) throw new Error('Alternate is not canonical indexable content: ' + file + ' -> ' + a.url);
  }
  return pages;
}
function build(root = ROOT) {
  const pages = readPages(root);
  const sm = path.join(root, 'sitemap.xml');
  const xml = fs.readFileSync(sm, 'utf8');
  const used = new Set();
  let removed = 0, changed = 0, added = 0;
  const render = (p, previous) => {
    const $ = cheerio.load(previous || '<url/>', { xmlMode: true });
    const alternatives = p.alternatives.map(a => `    <xhtml:link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(a.url)}"/>`).join('\n');
    // Keep historical dates and priority; never stamp every page with today.
    const extras = ['lastmod', 'changefreq', 'priority'].map(k => $(k).length ? `    <${k}>${esc($(k).text())}</${k}>\n` : '').join('');
    return `  <url>\n    <loc>${esc(p.url)}</loc>\n${alternatives ? alternatives + '\n' : ''}${extras}  </url>`;
  };
  let result = xml.replace(/  <url>[\s\S]*?<\/url>\n?/g, old => {
    const $ = cheerio.load(old, { xmlMode: true });
    const file = fileOf($('loc').text());
    const p = pages.get(file);
    if (!p || used.has(file)) { removed++; return ''; }
    used.add(file);
    const alts = $('xhtml\\:link').toArray().map(e => ({ lang: $(e).attr('hreflang'), url: $(e).attr('href') }));
    const key = xs => xs.map(x => x.lang + '=' + x.url).sort().join('\n');
    if ($('loc').text() === p.url && key(alts) === key(p.alternatives)) return old;
    changed++; return render(p, old) + '\n';
  });
  const additions = [];
  for (const [file, p] of pages) if (!used.has(file)) { additions.push(render(p)); added++; }
  if (additions.length) result = result.replace('</urlset>', '  <!-- Canonical pages added from HTML metadata -->\n' + additions.join('\n') + '\n</urlset>');
  if (result !== xml) fs.writeFileSync(sm, result);
  console.log(`sitemap: ${pages.size} canonical URLs; removed ${removed}, updated ${changed}, added ${added}`);
  return { total: pages.size, removed, changed, added };
}
module.exports = { build, readPages };
if (require.main === module) build();
