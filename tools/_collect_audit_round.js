#!/usr/bin/env node
// _collect_audit_round.js — 監査ワークフローの結果を journal.jsonl から台帳へ組み立てる(LLM不使用)
//
// なぜ要るか(2026-08-13):
//   完了通知に全結果を載せると、その巨大テキストを親セッションが読むコストが監査そのものと同じ桁になっていた
//   (54件で subagent 7.1M に対し、親のメインループも数M)。ワークフローは要約(digest)だけ返す形に変え、
//   全文は journal.jsonl から機械的に拾う。★監査の丁寧さ(1件=1エージェント・全件反証・引用必須)は一切変えていない。
//   削っているのは「同じ内容を親がもう一度読む」という純粋な無駄だけ。
//
// 使い方:
//   node tools/_collect_audit_round.js <runId> <台帳パス> [--dry]
//   例: node tools/_collect_audit_round.js wf_f4d3f5d4-fa0 reference/_item_audit_round3.json
//
// 出力: 台帳の results[] に {name, found, rebuttal} を追記(既存の name はスキップ=二重追記しない)
//       + 新発見の候補を標準出力に一覧(既知語を含む note は除外)

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const [runId, ledgerRel, ...flags] = process.argv.slice(2);
if (!runId || !ledgerRel) {
  console.error('usage: node tools/_collect_audit_round.js <runId> <台帳パス(repo相対)> [--dry]');
  process.exit(1);
}
const dry = flags.includes('--dry');

// runId から journal.jsonl を探す(セッションを跨いでも見つかるよう projects 配下を走査)
const projRoot = path.join(process.env.HOME, '.claude', 'projects');
let journal = null;
const walk = dir => {
  if (journal) return;
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    if (journal) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === runId) { const j = path.join(p, 'journal.jsonl'); if (fs.existsSync(j)) { journal = j; return; } } walk(p); }
  }
};
walk(projRoot);
if (!journal) { console.error(`✗ journal.jsonl が見つからない: runId=${runId}`); process.exit(1); }

const found = new Map(), rebuttal = new Map();
for (const line of fs.readFileSync(journal, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let j; try { j = JSON.parse(line); } catch (e) { continue; }
  if (j.type !== 'result' || !j.result || typeof j.result !== 'object') continue;
  const r = j.result;
  if (Array.isArray(r.checks)) { if (r.name) found.set(r.name, r); }        // 照合結果
  else if (typeof r.agreed === 'boolean' && r.name) rebuttal.set(r.name, r); // 反証結果
}
console.log(`journal: ${journal}`);
console.log(`  照合 ${found.size}件 / 反証 ${rebuttal.size}件`);
const noName = found.size && !rebuttal.size;
if (noName) console.log('  ⚠ 反証にnameが無い(古いスキーマのrun)。反証は台帳に載らないので、必要なら手当てすること');

const ledgerPath = path.join(ROOT, ledgerRel);
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const have = new Set(ledger.results.map(e => e.name));
let added = 0;
const fresh = [];
for (const [name, f] of found) {
  if (have.has(name)) { console.log(`  = 既に台帳にある(skip): ${name}`); continue; }
  ledger.results.push({ name, found: f, rebuttal: rebuttal.get(name) || null });
  added++;
  // 新発見の候補を拾う(既知語を含む note は除外。判断は人間/親がやる)
  const known = /既知|round1|round2|prev|resolved|既指摘|既出/;
  for (const c of f.checks) {
    if (['mismatch', 'extra_in_ours'].includes(c.verdict) && !known.test(c.note || ''))
      fresh.push({ name, verdict: c.verdict, aspect: c.aspect, note: (c.note || '').slice(0, 200) });
    else if (c.verdict === 'missing_in_ours' && /新規|sim/.test(c.note || '') && !known.test(c.note || ''))
      fresh.push({ name, verdict: 'missing(sim影響)', aspect: c.aspect, note: (c.note || '').slice(0, 200) });
  }
}
if (!dry) fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1), 'utf8');
console.log(`${dry ? '(dry) ' : '✍ '}${ledgerRel}: +${added}件 → 計${ledger.results.length}件`);
console.log(`\n★新発見の候補 ${fresh.length}件`);
for (const x of fresh) console.log(`  [${x.verdict}] ${x.name} — ${x.aspect}\n      ${x.note}`);
