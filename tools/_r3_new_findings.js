#!/usr/bin/env node
// _r3_new_findings.js — R3台帳から「R1/R2に無い新発見の候補」を機械的に抽出する(LLM不使用)
//
// 突き合わせの鍵は authority_quote(権威ページの実在文の引用)。aspect の文言はラウンドごとに違うが、
// 引用は同じ原文を指すので重なりが機械で分かる。判定は「候補出し」まで=同一視はしない([[batch-vs-one-by-one-line]])。
//   - quote_overlap: R1/R2 のいずれかの引用と 30文字以上の共通部分文字列がある → 既知の可能性が高い
//   - note_says_known: note/aspect に「R1」「R2」「既知」「再検出」「同一指摘」を含む → エージェント自身が既知と明言
//   - どちらでもない non-match 行 = 新発見候補
//
// 使い方: node tools/_r3_new_findings.js [出力(既定 reference/_r3_new_findings.json)]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const out = process.argv[2] || 'reference/_r3_new_findings.json';
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// R1/R2 の既知引用を特性ごとに集める
const prevQuotes = {}; // name -> [quotes]
for (const f of ['reference/_ability_audit_round1.json', 'reference/_ability_audit_round2.json']) {
  const d = J(f);
  for (const e of (d.results || [])) {
    const name = e.name.replace(/\s*\([A-Za-z0-9 .'-]+\)\s*$/, '').trim();
    for (const c of ((e.found && e.found.checks) || [])) {
      const q = (c.authority_quote || '').replace(/\s+/g, '');
      if (q.length >= 10) (prevQuotes[name] = prevQuotes[name] || []).push(q);
    }
  }
}

function hasOverlap(q, prevs, minLen) {
  // qのminLen長の窓がどれかのprevに含まれるか(部分文字列走査・短い引用は全文一致で判定)
  if (!prevs || !prevs.length) return false;
  const qq = q.replace(/\s+/g, '');
  if (qq.length < minLen) return prevs.some(p => p.includes(qq) || qq.includes(p));
  for (let i = 0; i + minLen <= qq.length; i += 10) {
    const win = qq.slice(i, i + minLen);
    if (prevs.some(p => p.includes(win))) return true;
  }
  return false;
}

const r3 = J('reference/_ability_audit_round3.json');
const newRows = [], knownRows = [];
for (const e of (r3.results || [])) {
  for (const c of ((e.found && e.found.checks) || [])) {
    if (!['missing_in_ours', 'mismatch', 'extra_in_ours'].includes(c.verdict)) continue;
    const text = (c.note || '') + ' ' + (c.aspect || '');
    const noteKnown = /R1|R2|既知|再検出|同一指摘|重複(指摘)?/.test(text);
    const quoteKnown = hasOverlap(c.authority_quote || '', prevQuotes[e.name], 30);
    const row = { ability: e.name, aspect: c.aspect, verdict: c.verdict,
      authority_quote: (c.authority_quote || '').slice(0, 400), note: (c.note || '').slice(0, 300),
      known_reason: noteKnown ? 'note_says_known' : (quoteKnown ? 'quote_overlap' : null) };
    if (row.known_reason) knownRows.push(row); else newRows.push(row);
  }
}

// 反証で追加された missed(照合担当が見なかった観点)も新発見候補
for (const e of (r3.results || [])) {
  for (const m of ((e.rebuttal && e.rebuttal.missed) || [])) {
    const quoteKnown = hasOverlap(m.authority_quote || '', prevQuotes[e.name], 30);
    if (!quoteKnown) newRows.push({ ability: e.name, aspect: m.aspect || '', verdict: 'rebuttal_missed',
      authority_quote: (m.authority_quote || '').slice(0, 400), note: (m.why || '').slice(0, 300), known_reason: null });
  }
}

fs.writeFileSync(path.join(ROOT, out), JSON.stringify({
  what: 'R3(相互作用と例外)の新発見候補=R1/R2の引用と重ならないnon-match行。機械の候補出しであり同一視はしていない(最終判定は人/検証)',
  built_at: new Date().toISOString(),
  new_count: newRows.length, known_count: knownRows.length,
  new_by_ability: Object.entries(newRows.reduce((a, r) => (a[r.ability] = (a[r.ability] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]),
  new_rows: newRows, known_rows: knownRows,
}, null, 1));
console.log(`✍ ${out}: 新発見候補 ${newRows.length} / 既知扱い ${knownRows.length}`);
