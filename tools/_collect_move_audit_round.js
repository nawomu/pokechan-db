#!/usr/bin/env node
// _collect_move_audit_round.js — 技監査WFの結果を journal.jsonl から台帳へ組み立てる(LLM不使用)
// tools/_collect_audit_round.js の技版。違いは2点:
//   ①キー=slug(技は同名の別技が18組ある。nameで潰すと消える)
//   ②name/slug は master/moves.json と照合して正規化(エージェントがnameに勝手な注記を付ける実績があるため。
//     照合できないslugは台帳に入れず、標準出力に警告として出す)
//
// 使い方: node tools/_collect_move_audit_round.js <runId[,runId...]> <台帳パス(repo相対)> [--dry]
//   ★複数runIdをまとめて渡せる(2026-08-23の教訓: 回収は全runId一括が安全)

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const [runIdsArg, ledgerRel, ...flags] = process.argv.slice(2);
if (!runIdsArg || !ledgerRel) {
  console.error('usage: node tools/_collect_move_audit_round.js <runId[,runId...]> <台帳パス> [--dry]');
  process.exit(1);
}
const dry = flags.includes('--dry');
const runIds = runIdsArg.split(',').map(s => s.trim()).filter(Boolean);

const master = JSON.parse(fs.readFileSync(path.join(ROOT, 'master/moves.json'), 'utf8')).items;
const bySlug = new Map(master.map(m => [m.slug, m]));

const projRoot = path.join(process.env.HOME, '.claude', 'projects');
const journals = [];
const walk = dir => {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (!e.isDirectory()) continue;
    if (runIds.includes(e.name)) {
      const j = path.join(p, 'journal.jsonl');
      if (fs.existsSync(j)) { journals.push(j); continue; }
    }
    walk(p);
  }
};
walk(projRoot);
if (journals.length !== runIds.length) {
  console.error(`✗ journal不足: 指定${runIds.length} / 発見${journals.length}(${journals.join(', ')})`);
  process.exit(1);
}

const found = new Map(), rebuttal = new Map(), badSlug = [];
for (const journal of journals) {
  for (const line of fs.readFileSync(journal, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let j; try { j = JSON.parse(line); } catch (e) { continue; }
    if (j.type !== 'result' || !j.result || typeof j.result !== 'object') continue;
    const r = j.result;
    if (!r.slug) continue;
    if (!bySlug.has(r.slug)) { badSlug.push(r.slug); continue; }
    r.name = bySlug.get(r.slug).name; // ★正規化(勝手な注記を消す)
    if (Array.isArray(r.checks)) found.set(r.slug, r);              // 照合結果
    else if (typeof r.agreed === 'boolean') rebuttal.set(r.slug, r); // 反証結果
  }
}
console.log(`journal ${journals.length}本: 照合 ${found.size}件 / 反証 ${rebuttal.size}件`);
if (badSlug.length) console.log(`⚠ masterに無いslug(台帳に入れない): ${[...new Set(badSlug)].join(', ')}`);

const ledgerPath = path.join(ROOT, ledgerRel);
let ledger;
if (fs.existsSync(ledgerPath)) ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
else ledger = { what: '技監査ラウンド台帳(1件=1照合エージェント+全件反証)', runs: [], results: [] };
ledger.runs = [...new Set([...(ledger.runs || []), ...runIds])];
const have = new Set(ledger.results.map(e => e.slug));
let added = 0;
const fresh = [];
for (const [slug, f] of found) {
  if (have.has(slug)) { console.log(`  = 既に台帳にある(skip): ${slug}`); continue; }
  ledger.results.push({ slug, name: f.name, found: f, rebuttal: rebuttal.get(slug) || null });
  added++;
  const known = /既知|round1|round2|prev|resolved|既指摘|既出/;
  for (const c of f.checks) {
    if (['mismatch', 'extra_in_ours'].includes(c.verdict) && !known.test(c.note || ''))
      fresh.push({ slug, name: f.name, verdict: c.verdict, aspect: c.aspect, note: (c.note || '').slice(0, 200) });
    else if (c.verdict === 'missing_in_ours' && !known.test(c.note || ''))
      fresh.push({ slug, name: f.name, verdict: 'missing_in_ours', aspect: c.aspect, note: (c.note || '').slice(0, 200) });
  }
}
ledger.count = ledger.results.length;
ledger.collected_at = new Date().toISOString().slice(0, 10);
if (!dry) fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1), 'utf8');
console.log(`${dry ? '(dry) ' : '✍ '}${ledgerRel}: +${added}件 → 計${ledger.results.length}件`);
console.log(`\n★新発見の候補 ${fresh.length}件(mismatch/extra/missing)`);
for (const x of fresh.slice(0, 60)) console.log(`  [${x.verdict}] ${x.name}(${x.slug}) — ${x.aspect}\n      ${x.note}`);
if (fresh.length > 60) console.log(`  …ほか${fresh.length - 60}件(台帳を見る)`);
