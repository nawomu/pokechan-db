'use strict';
// Preserve previously published URLs without duplicating Pokemon data/content.
// GitHub Pages cannot configure per-path HTTP 301s: Google's supported fallback is
// an immediate meta refresh. Keep these aliases OUT of sitemap.xml.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://pchamdb.com';
const LANGS = ['ja', 'en', 'fr', 'de', 'es', 'it', 'ko', 'zh-Hans', 'zh-Hant'];
const aliases = require('../reference/_legacy_url_redirects.json');
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function plannedRedirects() {
  const rows = [];
  for (const lang of LANGS) {
    const prefix = lang === 'ja' ? '' : lang + '/';
    for (const [old, target] of Object.entries(aliases.pokemon))
      rows.push({ from: prefix + 'pokemon/' + old, to: prefix + 'pokemon/' + target, lang });
    if (lang !== 'ja') for (const [old, targets] of Object.entries(aliases.localized_pages))
      rows.push({ from: prefix + old, to: targets[lang] || targets.ja, lang });
  }
  return rows;
}
function generate() {
  const rows = plannedRedirects();
  // Validate the entire plan BEFORE writing. Never overwrite a content page.
  const seen = new Set();
  for (const r of rows) {
    for (const p of [r.from, r.to]) {
      if (p.startsWith('/') || p.split('/').includes('..') || !p.endsWith('.html'))
        throw new Error('Unsafe route: ' + p);
    }
    if (r.from === r.to || seen.has(r.from)) throw new Error('Duplicate/self redirect: ' + r.from);
    seen.add(r.from);
    const target = fs.readFileSync(path.join(ROOT, r.to), 'utf8');
    if (/http-equiv=["']refresh["']/i.test(target) || /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(target))
      throw new Error('Target is not indexable content: ' + r.to);
    const source = path.join(ROOT, r.from);
    if (fs.existsSync(source) && !/http-equiv=["']refresh["']/i.test(fs.readFileSync(source, 'utf8')))
      throw new Error('Refusing to overwrite content: ' + r.from);
  }
  let changed = 0;
  for (const r of rows) {
    const url = SITE + '/' + r.to;
    const relative = path.posix.relative(path.posix.dirname(r.from), r.to);
    const html = `<!doctype html>\n<html lang="${r.lang}"><head><meta charset="utf-8">\n<meta http-equiv="refresh" content="0;url=${esc(relative)}">\n<link rel="canonical" href="${esc(url)}"><title>PchamDB</title></head>\n<body><a href="${esc(relative)}">${esc(url)}</a></body></html>\n`;
    const file = path.join(ROOT, r.from);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== html) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, html); changed++;
    }
  }
  console.log(`Legacy redirects: ${rows.length} checked, ${changed} written`);
}
module.exports = { plannedRedirects, generate };
if (require.main === module) generate();
