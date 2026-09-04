// tools/_collect_codex_gen8_all.js — reference/_gen8_all_audit_codex/*.json を回収し、
// reference/_gen8_all_removed_candidates.json に codex.verdict/availability_quote/gen_limit_quote/note を合流する(2026-09-04)
// master/moves.json の現在値(gens/gen_removed)と突き合わせ、"cannot_use" かつ quote ありのものだけを
// reference/_gen8_all_audit_codex/_summary_<date>.md の候補一覧に列挙する(fixesへの適用はしない=親がWiki+Bulbapedia二重一致を確認してから当てる)
// このスクリプトが上書きするのは reference/_gen8_all_removed_candidates.json 自体と _summary_*.md だけ(master/やfixesは触らない=対象外ルールに抵触しない)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CAND_PATH = path.join(ROOT, 'reference/_gen8_all_removed_candidates.json');
const AUDIT_DIR = path.join(ROOT, 'reference/_gen8_all_audit_codex');
const master = require(path.join(ROOT, 'master/moves.json'));
const bySlug = {}; master.items.forEach(m => { bySlug[m.slug] = m; });

const cand = JSON.parse(fs.readFileSync(CAND_PATH, 'utf8'));
let ok = 0, missing = 0;
const missingSlugs = [];
for (const c of cand.items) {
  const f = path.join(AUDIT_DIR, `${c.slug}.json`);
  if (fs.existsSync(f)) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      c.codex = { verdict: j.verdict, availability_quote: j.availability_quote, gen_limit_quote: j.gen_limit_quote, note: j.note };
      ok++;
    } catch (e) { c.codex = { error: 'parse-fail: ' + String(e.message || e) }; }
  } else {
    missing++; missingSlugs.push(c.slug);
  }
}
fs.writeFileSync(CAND_PATH, JSON.stringify(cand, null, 1));

const verdictCounts = {};
for (const c of cand.items) {
  const v = c.codex ? c.codex.verdict : 'no-codex-result';
  verdictCounts[v] = (verdictCounts[v] || 0) + 1;
}

// cannot_use かつ根拠quoteがある技だけを候補としてまとめる(適用はしない)
const cannotUse = cand.items.filter(c => c.codex && c.codex.verdict === 'cannot_use' &&
  ((c.codex.availability_quote && c.codex.availability_quote.trim()) || (c.codex.gen_limit_quote && c.codex.gen_limit_quote.trim())));

const today = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push(`# R10後工程(Spark)全数照合: gensに8を含む旧技50件の第八世代使用不可確認 — 結果(${today})`);
lines.push('');
lines.push(`対象 = \`reference/_gen8_all_removed_candidates.json\` の50件(master/moves.json で gen_introduced<=7 & gens に8を含み9を含まず & gen_removed未設定・前回の152件候補とは重複無し)。`);
lines.push(`Codex(汎用モデル)に **ポケモンWiki個別ページ本文だけ** を読ませ「第八世代(SwSh/BDSP)で選択して使えるか」を独立判定させた。回収 ${ok}/${cand.items.length}(未回収 ${missing}${missingSlugs.length ? ': ' + missingSlugs.join(', ') : ''})。`);
lines.push('');
lines.push('## Codex判定の内訳');
lines.push('');
lines.push('| verdict | 件数 |');
lines.push('|---|---|');
for (const [v, n] of Object.entries(verdictCounts)) lines.push(`| ${v} | ${n} |`);
lines.push('');
lines.push(`## cannot_use(第八世代で使えないと判定・根拠quoteあり)= ${cannotUse.length}件`);
lines.push('');
if (cannotUse.length) {
  lines.push('★これらは「候補」であり、まだ master には適用していない。適用前に Wiki+Bulbapedia の二重一致を確認すること(CLAUDE.md 二重ソース確認ルール)。');
  lines.push('');
  for (const c of cannotUse) {
    const m = bySlug[c.slug];
    lines.push(`### ${c.name_ja}(${c.name_en} / ${c.slug})`);
    lines.push(`- master現在値: gen_introduced=${m.availability.gen_introduced}, gens=[${(m.availability.gens || []).join(',')}], gen_removed=${m.availability.gen_removed || 'null'}`);
    if (c.codex.availability_quote) lines.push(`- availability_quote: 「${c.codex.availability_quote}」`);
    if (c.codex.gen_limit_quote) lines.push(`- gen_limit_quote: 「${c.codex.gen_limit_quote}」`);
    if (c.codex.note) lines.push(`- note: ${c.codex.note}`);
    lines.push('');
  }
} else {
  lines.push('(該当なし)');
  lines.push('');
}
fs.writeFileSync(path.join(AUDIT_DIR, `_summary_${today}.md`), lines.join('\n'));

console.log('collected', ok, 'missing', missing, missingSlugs);
console.log('codex verdict distribution:', JSON.stringify(verdictCounts, null, 1));
console.log('cannot_use candidates (need double-source check before applying):', cannotUse.length);
