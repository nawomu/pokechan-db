#!/usr/bin/env node
// _build_sim_todo_abilities.js — 特性監査台帳の unknown を「simの宿題」へ機械的に退避する(LLM不使用)
//
// なぜ(2026-08-16 阿部さん決定・HANDOFF_2026_08_16 §4-3):
//   R1/R2 の unknown 745件 = 「権威ページに書いていない」を正直に残した数字。推測で埋めない。
//   説明文にも表にも入れられない(根拠が無い)ので、バトル実装(③)の時に1件ずつ実機/権威で
//   確かめる宿題として退避する。持ち物の reference/_sim_todo_items.json と同じ思想。
//
// ★短さ撤回(2026-08-16)後の注意: 「説明文に足すべきものが混ざってないか」の見直しは未実施。
//   needs_desc_review: true のまま残す(機械では判定しない=まとめない)。
//
// 使い方: node tools/_build_sim_todo_abilities.js [出力先(既定 reference/_sim_todo_abilities.json)]
// 入力: reference/_ability_audit_round{1,2,...}.json(在るだけ全部)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const out = process.argv[2] || 'reference/_sim_todo_abilities.json';

const rows = [];
const seen = new Set();
const files = fs.readdirSync(path.join(ROOT, 'reference')).filter(f => /^_ability_audit_round\d+\.json$/.test(f)).sort();
for (const f of files) {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(ROOT, 'reference', f), 'utf8')); } catch (e) { continue; }
  const round = 'R' + f.match(/round(\d+)/)[1];
  for (const e of (d.results || [])) {
    for (const c of ((e.found && e.found.checks) || [])) {
      if (c.stale_material) continue;
      if (c.verdict !== 'unknown') continue;
      const key = e.name + '|' + (c.aspect || '').slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        ability: e.name, round, aspect: c.aspect || '',
        ours: (c.ours || '').slice(0, 300),
        note: (c.note || '').slice(0, 400),
        needs_desc_review: true,
      });
    }
  }
}
fs.writeFileSync(path.join(ROOT, out), JSON.stringify({
  what: '特性監査の unknown(権威ページに書いていない=判定できなかった観点)の退避先。推測で埋めない。バトル③着手時に1件ずつ確かめる',
  rule: '説明文にも表にも入れない(根拠が無い)。needs_desc_review=「説明文に足すべきものが混ざってないか」の見直し(短さ撤回後の宿題)が未実施の印',
  generator: 'tools/_build_sim_todo_abilities.js',
  built_at: new Date().toISOString(),
  count: rows.length,
  rows,
}, null, 1));
console.log(`✍ ${out}: ${rows.length} 件(入力=${files.join(', ')})`);
