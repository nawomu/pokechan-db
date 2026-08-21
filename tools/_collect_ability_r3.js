#!/usr/bin/env node
// _collect_ability_r3.js — 特性R3ワークフローの journal.jsonl から台帳へ回収する(LLM不使用)
//
// なぜ専用スクリプトか: R3のバッチ1・2は反証スキーマに name が無く、journal の反証結果が
// どの特性のものか journal 単体では分からない。→ agentId から agent-<id>.jsonl(トランスクリプト)を開き、
// プロンプト内の『特性「X」』を読んで結線する(機械的な写しのみ・内容には触れない)。
// バッチ3以降はスキーマに name を足したのでトランスクリプト無しでも結線できる。
//
// 使い方: node tools/_collect_ability_r3.js <台帳パス> <runId> [runId...]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const [ledgerRel, ...runIds] = process.argv.slice(2);
if (!ledgerRel || !runIds.length) {
  console.error('usage: node tools/_collect_ability_r3.js <台帳パス> <runId> [runId...]');
  process.exit(1);
}

const projRoot = path.join(process.env.HOME, '.claude', 'projects');
function findRunDir(runId) {
  let hit = null;
  const walk = dir => {
    if (hit) return;
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (hit) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name === runId) { hit = p; return; } walk(p); }
    }
  };
  walk(projRoot);
  return hit;
}

const foundMap = new Map();     // name -> found result(後勝ち)
const rebuttalMap = new Map();  // name -> rebuttal result(後勝ち)
let unlinked = 0;

// エージェントが name にラウンド注記を付けることがある(実例: 「いかりのこうら_R3」「さいせいりょく(R3=相互作用と例外)」)
// → master の正式名に正規化する。masterに無い name はそのまま残す(勝手に同一視しない)。
const masterNames = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'master/abilities.json'), 'utf8')).items.map(a => a.name));
function normName(n) {
  n = String(n).replace(/^["'「『]+|["'」』]+$/g, '').trim();  // 実例: 『"ほろびのボディ"』と引用符ごと返した照合エージェントがいた
  if (masterNames.has(n)) return n;
  let s = n.replace(/_R\d+$/, '').replace(/[((]R\d+[^))]*[))]$/, '').trim();
  s = s.replace(/\s*R\d+[((][^))]*[))](照合)?$/, '').trim();   // 実例: 「じりょく R3(相互作用と例外)照合」
  s = s.replace(/[_\s]*R\d+[_\s][^ ]*$/, '').trim();            // 実例: 「パワースポット_R3_相互作用と例外」
  return masterNames.has(s) ? s : n;
}

for (const runId of runIds) {
  const dir = findRunDir(runId);
  if (!dir) { console.error(`✗ run が見つからない: ${runId}`); process.exit(1); }
  const journal = path.join(dir, 'journal.jsonl');
  for (const line of fs.readFileSync(journal, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let j; try { j = JSON.parse(line); } catch (e) { continue; }
    if (j.type !== 'result' || !j.result || typeof j.result !== 'object') continue;
    const r = j.result;
    if (Array.isArray(r.checks) && r.name) { r.name = normName(r.name); foundMap.set(r.name, r); continue; }
    if (typeof r.agreed === 'boolean') {
      let name = r.name || null;
      if (!name && j.agentId) {
        // トランスクリプトのプロンプトから『特性「X」』を拾う
        const t = path.join(dir, `agent-${j.agentId}.jsonl`);
        try {
          const txt = fs.readFileSync(t, 'utf8');
          const m = txt.match(/特性「([^」]+)」の照合結果/);
          if (m) name = m[1];
        } catch (e) {}
      }
      if (name) rebuttalMap.set(normName(name), r); else unlinked++;
    }
  }
}

let ledger;
try { ledger = JSON.parse(fs.readFileSync(path.join(ROOT, ledgerRel), 'utf8')); }
catch (e) {
  ledger = {
    what: '特性312件の全数照合ラウンド3(レンズ=相互作用と例外)。1件=1照合エージェント+全件反証(Sonnet)。2026-08-21〜22夜',
    materials: 'scratchpad/audit_abilities_r3(master修正3件+スロット修正後に再生成。ARシステム/おもかげやどしのWiki生ページは2026-08-21取り直し済み)',
    runs: [],
    results: [],
  };
}
ledger.runs = [...new Set([...(ledger.runs || []), ...runIds])];
const byName = new Map(ledger.results.map(e => [e.name, e]));
let added = 0, updated = 0;
for (const [name, found] of foundMap) {
  const entry = { name, found, rebuttal: rebuttalMap.get(name) || null };
  if (byName.has(name)) { byName.set(name, entry); updated++; }
  else { byName.set(name, entry); added++; }
}
ledger.results = [...byName.values()];
ledger.collected_at = new Date().toISOString();
ledger.count = ledger.results.length;
fs.writeFileSync(path.join(ROOT, ledgerRel), JSON.stringify(ledger, null, 1));
const noReb = ledger.results.filter(e => !e.rebuttal).length;
console.log(`✍ ${ledgerRel}: 照合${foundMap.size} 反証${rebuttalMap.size} → 台帳${ledger.count}件(新規${added}/更新${updated}) 反証なし${noReb} 結線不能${unlinked}`);
