// tools/_collect_codex_gen8.js — reference/_gen8_audit_codex/*.json を回収し、reference/_gen8_removed_candidates.json に
// codex.verdict/codex.category_quote/codex.gen_limit_quote/codex.note を合流する(2026-09-03)
// このスクリプトは reference/_gen8_removed_candidates.json 自体を上書き更新する(master/や_moves_fixes.jsonではない=対象外ルールに抵触しない)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CAND_PATH = path.join(ROOT, 'reference/_gen8_removed_candidates.json');
const AUDIT_DIR = path.join(ROOT, 'reference/_gen8_audit_codex');

const candidates = JSON.parse(fs.readFileSync(CAND_PATH, 'utf8'));
let ok = 0, missing = 0;
for (const c of candidates) {
  const f = path.join(AUDIT_DIR, `${c.slug}.json`);
  if (fs.existsSync(f)) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      c.codex = { verdict: j.verdict, category_quote: j.category_quote, gen_limit_quote: j.gen_limit_quote, note: j.note };
      ok++;
    } catch (e) { c.codex = { error: 'parse-fail: ' + String(e.message || e) }; }
  } else if (c.verdict !== 'both') {
    missing++;
  }
}
fs.writeFileSync(CAND_PATH, JSON.stringify(candidates, null, 1));

const summary = {};
for (const c of candidates) {
  const v = c.codex ? c.codex.verdict : (c.verdict === 'both' ? 'n/a(both-sourced already)' : 'no-codex-result');
  summary[v] = (summary[v] || 0) + 1;
}
console.log('collected', ok, 'missing', missing);
console.log('codex verdict distribution:', JSON.stringify(summary, null, 1));
