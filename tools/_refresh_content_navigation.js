'use strict';
// Refresh only home links in existing generated pages, preserving their data,
// canonical URLs and legacy redirects. Run after changing the common template.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const LANGS = ['en', 'fr', 'de', 'es', 'it', 'ko', 'zh-Hans', 'zh-Hant'];
const changes = [];
let checked = 0;
for (const lang of LANGS) {
  if (!fs.existsSync(path.join(ROOT, lang, 'index.html'))) throw new Error(`Missing ${lang} home`);
  for (const kind of ['pokemon', 'ability', 'type']) {
    for (const name of fs.readdirSync(path.join(ROOT, lang, kind))) {
      if (!name.endsWith('.html')) continue;
      const rel = `${lang}/${kind}/${name}`, file = path.join(ROOT, rel);
      const before = fs.readFileSync(file, 'utf8');
      if (/http-equiv=["']refresh["']/i.test(before)) continue;
      const old = before.match(/href="\.\.\/\.\.\/index\.html"/g) || [];
      const fixed = before.match(/href="\.\.\/index\.html"/g) || [];
      if (old.length + fixed.length !== 3) throw new Error(`Unexpected home links: ${rel}`);
      checked++;
      const after = before.replaceAll('href="../../index.html"', 'href="../index.html"');
      if (before !== after) changes.push({ file, after });
    }
  }
}
// Validate the entire input before writing any file.
if (process.argv.includes('--check')) {
  if (changes.length) throw new Error(`${changes.length} pages still point to the Japanese home`);
} else {
  for (const { file, after } of changes) fs.writeFileSync(file, after);
}
console.log(JSON.stringify({ checked, changed: changes.length }));
