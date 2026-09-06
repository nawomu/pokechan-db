#!/usr/bin/env node
'use strict';
// 技の性質フラグ8欄の照合結果(review/_move_flag_audit_2026-09-06/reconcile.json)のうち、
// 二重ソース一致(class A=明示一致 / A-rule=一方が一般規則・もう一方が明示)だけを reference/_moves_fixes.json に根拠つきで書く。
//   node tools/_move_flag_apply_reconcile.js [--classes=A,A-rule,A-implied] [--dry]
// ・書くのは fixes[slug].set["flags.<field>"](パスキー。既存の set の他キーは残す=同名キーはマージ)
// ・根拠は fixes[slug].flags_evidence[field] = { class, policy, yakkun:{src,q}, wiki:[{src,q}], why }(quote_1/quote_2 等の既存欄は触らない)
// ・値を変える(既に非nullの値と食い違う)セルは書かず、conflicts に出して止まる(推測で上書きしない)
// ・master には書かない(build_master_v2.js が適用する)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const classes = ((argv.find(a => a.startsWith('--classes=')) || '--classes=A,A-rule').split('=')[1]).split(',');
const dry = argv.includes('--dry');
const verifiedTag = (argv.find(a => a.startsWith('--verified=')) || '').split('=')[1] || '';

const R = J('review/_move_flag_audit_2026-09-06/reconcile.json');
const FX_PATH = path.join(ROOT, 'reference/_moves_fixes.json');
const F = JSON.parse(fs.readFileSync(FX_PATH, 'utf8'));
F.fixes = F.fixes || {};
const master = Object.fromEntries(J('master/moves.json').items.map(x => [x.slug, x]));

let written = 0, unchanged = 0, skipped = 0; const conflicts = [];
for (const m of R.moves) {
  const mv = master[m.slug];
  if (!mv) { skipped++; continue; }
  for (const [field, c] of Object.entries(m.fields)) {
    if (!classes.includes(c.class)) continue;
    const v = c.yakkun.value;
    if (typeof v !== 'boolean') continue;
    const cur = mv.flags ? mv.flags[field] : null;
    if (cur !== null && cur !== undefined && cur !== v) { conflicts.push({ slug: m.slug, name: m.name, field, master: cur, reconcile: v }); continue; }
    const e = F.fixes[m.slug] = F.fixes[m.slug] || {};
    e.set = e.set || {};
    e.flags_evidence = e.flags_evidence || {};
    const key = `flags.${field}`;
    const ev = { class: c.class, policy: (c.wiki && c.wiki.policy) || [], yakkun: c.yakkun.quotes, wiki: (c.wiki && c.wiki.quotes) || [], why: [(c.wiki && c.wiki.why) || '', `一次=ヤックン/ch/(Champions正典) 二次=ポケモンWiki(第九世代)。${c.class === 'A' ? '両者が明示で一致' : c.class === 'A-rule' ? '一方が明示・他方が一般規則(例外表に無い=使える 等)で一致' : '世代限定の含意(P4)で一致・WF検証済み'}`].filter(Boolean).join(' / ') };
    if (e.set[key] === v && JSON.stringify(e.flags_evidence[field]) === JSON.stringify(ev)) { unchanged++; continue; }
    e.set[key] = v;
    e.flags_evidence[field] = ev;
    e.aspect = e.aspect ? (e.aspect.includes('技の性質フラグ') ? e.aspect : e.aspect + ' / 技の性質フラグ(flags_evidence)') : '技の性質フラグ(flags_evidence)';
    e.verified = e.verified && !e.verified.includes('reconcile.json') ? e.verified + ' + review/_move_flag_audit_2026-09-06/reconcile.json' + (verifiedTag ? ` (${verifiedTag})` : '') : (e.verified || 'review/_move_flag_audit_2026-09-06/reconcile.json' + (verifiedTag ? ` (${verifiedTag})` : ''));
    written++;
  }
}
console.log(`書込 ${written} / 変化なし ${unchanged} / 対象外slug ${skipped} / 衝突 ${conflicts.length}`);
if (conflicts.length) { console.log(JSON.stringify(conflicts, null, 1)); process.exitCode = 2; }
else if (!dry && written) { F.updated_at = new Date().toISOString().slice(0, 10); fs.writeFileSync(FX_PATH, JSON.stringify(F, null, 1) + '\n'); console.log('→ reference/_moves_fixes.json'); }
