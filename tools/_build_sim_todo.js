#!/usr/bin/env node
// _build_sim_todo.js — 監査台帳から「sim実装課題」を機械的に積む(LLM不使用)
//
// なぜ別リストか(2026-08-13):
//   監査ラウンド3で出た発見の多くは「masterの説明文が間違っている」のではなく
//   「simが実装する時に必要な細則がどこにも書かれていない」種類だった。
//   ★説明文はわざと短い([[pokemon-text-is-deliberately-short]])ので effect_ja に足してはいけない。
//   → master は直さず、バトル実装の時に読む台帳としてここに積む。引用つきなので後から裏取り不要。
//
// 使い方: node tools/_build_sim_todo.js [出力先(既定 reference/_sim_todo_items.json)]
// 入力: reference/_item_audit_round{1,2,3}.json + _item_audit_pilot.json
// 拾う条件: verdict が missing_in_ours / mismatch で、note に「sim」「新規」「新発見」を含むもの
//           (= 監査担当が『simが誤実装しかねない』と判断したもの)。引用が空のものは捨てる。

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const out = process.argv[2] || 'reference/_sim_todo_items.json';

const LEDGERS = ['reference/_item_audit_pilot.json', 'reference/_item_audit_round1.json',
                 'reference/_item_audit_round2.json', 'reference/_item_audit_round3.json'];

const rows = [];
const seen = new Set();
for (const rel of LEDGERS) {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch (e) { continue; }
  const round = rel.match(/round(\d)/) ? `R${rel.match(/round(\d)/)[1]}` : 'pilot';
  for (const e of (Array.isArray(d) ? d : d.results || [])) {
    const checks = (e.found && e.found.checks) || [];
    for (const c of checks) {
      if (!['missing_in_ours', 'mismatch'].includes(c.verdict)) continue;
      const note = c.note || '';
      if (!/sim|新規|新発見/.test(note)) continue;
      const quote = (c.authority_quote || '').trim();
      if (!quote) continue;                       // 引用の無いものは積まない(推測で埋めない)
      const key = e.name + '|' + (c.aspect || '').slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ item: e.name, round, aspect: c.aspect, verdict: c.verdict,
                  authority_quote: quote, note: note.slice(0, 400),
                  rebuttal_agreed: (e.rebuttal || {}).agreed });
    }
  }
}
rows.sort((a, b) => a.item.localeCompare(b.item, 'ja'));

const doc = {
  what: '★持ち物のsim実装課題(監査で見つかった「実装時に要る細則」)。masterのeffect_jaには足さない(説明文はわざと短い設計)。バトルを作る時にここを読む。',
  how: 'node tools/_build_sim_todo.js で台帳から再生成(LLM不使用・引用つき)。ここを直接手で編集しない。',
  source: LEDGERS,
  generated_at: new Date().toISOString().slice(0, 10),
  count: rows.length,
  items: rows,
};
fs.writeFileSync(path.join(ROOT, out), JSON.stringify(doc, null, 1), 'utf8');
const byItem = rows.reduce((m, r) => (m[r.item] = (m[r.item] || 0) + 1, m), {});
const top = Object.entries(byItem).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log(`✍ ${out}: ${rows.length}件 / 対象 ${Object.keys(byItem).length}持ち物`);
console.log('  多い順:', top.map(([k, v]) => `${k}(${v})`).join(' '));
