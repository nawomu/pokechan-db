'use strict';
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cheerio = require('cheerio');
const { build, readPages } = require('./_gen_content_sitemap');
const { plannedRedirects } = require('./_gen_legacy_redirects');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://pchamdb.com';

// Meaningful generator regressions: stale redirect/noindex URLs are removed,
// content cannot disappear on repeat, and lastmod isn't rewritten to today.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pchamdb-seo-test-'));
try {
  const page = (canonical, extra = '') => `<html><head><link rel="canonical" href="${SITE}/${canonical}">${extra}</head><body>Page</body></html>`;
  fs.writeFileSync(path.join(tmp, 'index.html'), page(''));
  fs.writeFileSync(path.join(tmp, 'new.html'), page('new.html'));
  fs.writeFileSync(path.join(tmp, 'old.html'), page('new.html', '<meta http-equiv="refresh" content="0;url=new.html">'));
  fs.writeFileSync(path.join(tmp, 'private.html'), page('private.html', '<meta name="robots" content="noindex,follow">'));
  fs.writeFileSync(path.join(tmp, 'sitemap.xml'), '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    ['','old.html','private.html'].map(p => `  <url>\n<loc>${SITE}/${p}</loc>\n<lastmod>2026-06-02</lastmod></url>\n`).join('') + '</urlset>\n');
  assert.deepEqual(build(tmp), { total: 2, removed: 2, changed: 0, added: 1 });
  const first = fs.readFileSync(path.join(tmp, 'sitemap.xml'), 'utf8');
  assert(first.includes('<lastmod>2026-06-02</lastmod>'));
  assert.equal((first.match(/<lastmod>/g) || []).length, 1);
  assert.deepEqual(build(tmp), { total: 2, removed: 0, changed: 0, added: 0 });
  assert.equal(fs.readFileSync(path.join(tmp, 'sitemap.xml'), 'utf8'), first);
  fs.writeFileSync(path.join(tmp, 'new.html'), page('new.html', '<link rel="alternate" hreflang="en" href="https://pchamdb.com/missing.html">'));
  assert.throws(() => build(tmp), /Alternate is not canonical/);
  assert.equal(fs.readFileSync(path.join(tmp, 'sitemap.xml'), 'utf8'), first, 'invalid input must not partially overwrite sitemap');
  console.log('PASS: generator inclusion/exclusion, historical lastmod, idempotence, fail-before-write');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// Full actual site: every indexable canonical appears once, and every legacy
// route reaches the intended real content directly in its original language.
const pages = readPages();
const xml = cheerio.load(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8'), { xmlMode: true });
const locs = xml('loc').toArray().map(e => xml(e).text());
assert.equal(new Set(locs).size, locs.length);
assert.deepEqual([...locs].sort(), [...pages.values()].map(p => p.url).sort());
const aliases = plannedRedirects();
for (const r of aliases) {
  const $ = cheerio.load(fs.readFileSync(path.join(ROOT, r.from), 'utf8'));
  const meta = $('meta[http-equiv="refresh"]').attr('content');
  assert(meta && meta.startsWith('0;url='), r.from);
  const target = new URL(meta.slice(6), SITE + '/' + r.from).href;
  assert.equal(target, SITE + '/' + r.to, r.from);
  assert.equal($('link[rel="canonical"]').attr('href'), target, r.from);
  assert(pages.has(r.to), 'noncanonical target: ' + r.to);
  assert(!locs.includes(SITE + '/' + r.from), 'alias in sitemap: ' + r.from);
}
console.log(`PASS: ${locs.length} canonical sitemap URLs, ${aliases.length} direct legacy redirects`);
