// tools/_collect_codex_dex.js — Codex図鑑諸元照合の回収: mismatch/unknown を一覧化(2026-09-03)。出力=reference/_dex_audit_codex/_summary.json + 画面
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '../reference/_dex_audit_codex');
const P = Object.fromEntries(require('../master/pokemon.json').items.map(x => [x.slug, x]));
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_') && !f.startsWith('.')) : [];
const rows = [], counts = { match: 0, mismatch: 0, unknown: 0 };
for (const f of files) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  for (const it of j.items || []) {
    counts[it.verdict] = (counts[it.verdict] || 0) + 1;
    if (it.verdict !== 'match') rows.push({ slug: j.slug, name: P[j.slug]?.name, provisional: (P[j.slug]?.provisional_fields || []), aspect: it.aspect, ours: it.ours, page: it.page_value, verdict: it.verdict, quote: it.quote, note: it.note });
  }
}
fs.writeFileSync(path.join(DIR, '_summary.json'), JSON.stringify({ collected: files.length, counts, rows }, null, 1));
console.log('files', files.length, counts);
rows.filter(r => r.verdict === 'mismatch').forEach(r => console.log('✗', r.name, r.aspect, 'ours=' + r.ours, 'page=' + r.page, '|', (r.note || '').slice(0, 60)));
console.log('unknown', rows.filter(r => r.verdict === 'unknown').length);
