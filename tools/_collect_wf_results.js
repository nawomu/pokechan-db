#!/usr/bin/env node
// _collect_wf_results.js — Workflowのjournal.jsonlから result 行を台帳JSONへ写す。LLM不使用=写すだけ。
// (tools/_collect_audit_round.js は監査ラウンド専用。こちらは汎用: 仕分け/調査系WFの回収に使う)
//
// journal行の形式(実測 2026-08-21): {"type":"result","key":"v2:<プロンプトハッシュ>","agentId":"…","result":<agentの返り値>}
//   - 同一keyはresume再実行の重複 → 後勝ちで1件に畳む
//   - 台帳のlabelは result.ability / result.name があればそれ、無ければ key
//
// 使い方: node tools/_collect_wf_results.js <journal.jsonl> <出力.json> "<what説明>"
//   同じ出力ファイルが在れば results をマージ(同labelは新しい方で上書き)
const fs = require('fs');

const [jpath, outPath, what] = process.argv.slice(2);
if (!jpath || !outPath) {
  console.error('usage: node tools/_collect_wf_results.js <journal.jsonl> <出力.json> "<what>"');
  process.exit(1);
}

const lines = fs.readFileSync(jpath, 'utf8').split('\n').filter(Boolean);
const byKey = {};
let resultRows = 0;
for (const line of lines) {
  let o; try { o = JSON.parse(line); } catch (e) { continue; }
  if (o.type !== 'result') continue;
  resultRows++;
  byKey[o.key || `#${resultRows}`] = o.result ?? o.value ?? null;
}

const merged = {};
let prev = null;
try { prev = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch (e) {}
if (prev && Array.isArray(prev.results)) for (const r of prev.results) merged[r.label] = r;
for (const [k, v] of Object.entries(byKey)) {
  const label = (v && (v.ability || v.name)) || k;
  merged[label] = { label, value: v };
}

const out = {
  what: what || (prev && prev.what) || '',
  journal: jpath,
  collected_at: new Date().toISOString(),
  count: Object.keys(merged).length,
  results: Object.values(merged),
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`✍ ${outPath}: ${resultRows} result行(key一意 ${Object.keys(byKey).length}) → 台帳 ${out.count} 件`);
