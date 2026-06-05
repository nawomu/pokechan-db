/**
 * ワークフロー抽出specs({specs:[...]})の確認ビュー生成。
 * 実行: node tools/_waza_effects_specs_view.js <specs.json> <out.html> [タイトル]
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const [specPath, outPath, title] = process.argv.slice(2);

function lit(text, marker) {
  const at = text.indexOf(marker); let i = text.indexOf('{', at), s = i, d = 0, inS = false, esc = false;
  for (; i < text.length; i++) { const c = text[i];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; }
    else { if (c === '"') inS = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return text.slice(s, i + 1); } } }
}
const map = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));
const specs = JSON.parse(fs.readFileSync(path.resolve(ROOT, specPath), 'utf8')).specs;
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const META = new Set(['kind', 'target', 'phase', 'duration']);
const ALLOWED = new Set(['key', 'name', 'en', 'priority', 'flags', 'effects', 'requires', 'fails_if', 'immune', 'blocked_by', 'not_blocked_by']);

const kindTally = {};
for (const m of specs) for (const e of (m.effects || [])) kindTally[e.kind] = (kindTally[e.kind] || 0) + 1;
const kinds = Object.entries(kindTally).sort((a, b) => b[1] - a[1]);
function val(v) { return Array.isArray(v) ? v.map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' / ') : (typeof v === 'object' ? JSON.stringify(v) : v); }
function effBlock(e) {
  const head = `<b>${esc(e.kind)}</b>` + (e.target ? ` <span class="t">→${esc(e.target)}</span>` : '') +
    (e.phase ? ` <span class="ph">[${esc(e.phase)}${e.duration ? ' ' + esc(e.duration) + (typeof e.duration === 'number' ? ' turns' : '') : ''}]</span>` : '');
  const params = Object.entries(e).filter(([k]) => !META.has(k)).map(([k, v]) => `<div class="p"><span class="k">${esc(k)}</span>: ${esc(val(v))}</div>`).join('');
  return `<div class="eff">${head}${params}</div>`;
}
function extra(mv) {
  const b = [];
  if (mv.priority != null) b.push(`<div class="x prio">優先度 ${mv.priority > 0 ? '+' : ''}${esc(mv.priority)}</div>`);
  if (mv.flags && mv.flags.length) b.push(`<div class="x flag">flags: ${esc(mv.flags.join(', '))}</div>`);
  if (mv.requires) b.push(`<div class="x req">requires: ${esc(mv.requires.map(val).join(' / '))}</div>`);
  if (mv.fails_if) b.push(`<div class="x fail">fails_if: ${esc(mv.fails_if.map(val).join(' / '))}</div>`);
  if (mv.immune) b.push(`<div class="x imm">immune: ${esc(mv.immune.map(val).join(' / '))}</div>`);
  if (mv.blocked_by) b.push(`<div class="x blk">blocked_by: ${esc(mv.blocked_by.join(', '))}</div>`);
  if (mv.not_blocked_by) b.push(`<div class="x blk">not_blocked_by: ${esc(mv.not_blocked_by.join(', '))}</div>`);
  const stray = Object.keys(mv).filter(k => !ALLOWED.has(k));
  if (stray.length) b.push(`<div class="x stray">⚠ schema外: ${esc(stray.join(', '))}</div>`);
  return b.join('');
}
const rows = specs.map((mv, i) => {
  const m = map[mv.key] || {};
  return `<tr><td class="num">${i + 1}</td>
   <td class="nm"><b>${esc(mv.name)}</b><div class="meta">${esc(m.type || '')}/${esc(m.category || '')} PP${esc(m.pp || '')}</div></td>
   <td class="ja">${esc(m.description_legacy || m.description || '')}</td>
   <td class="en">${esc(mv.en || '')}</td>
   <td class="ef">${(mv.effects || []).map(effBlock).join('')}${extra(mv)}</td></tr>`;
}).join('\n');

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title || 'effects specs')}</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3}
 header{position:sticky;top:0;background:#161b22;border-bottom:1px solid #30363d;padding:12px 18px;z-index:10}
 h1{font-size:16px;margin:0 0 4px} .glossary{padding:10px 18px;background:#11161c;border-bottom:1px solid #30363d;font-size:12px}
 .chip{display:inline-block;background:#21262d;border:1px solid #30363d;border-radius:5px;padding:2px 7px;margin:2px} .uniq{border-color:#a371f7} .fam{border-color:#1f6f3f}
 table{border-collapse:collapse;width:100%;font-size:13px} th{position:sticky;top:0;background:#21262d;text-align:left;padding:7px 9px;border-bottom:2px solid #30363d;font-size:12px;color:#9aa7b4}
 td{padding:9px;border-bottom:1px solid #21262d;vertical-align:top} .num{color:#6e7681;width:30px} .nm{width:110px} .nm .meta{font-size:11px;color:#8b949e;margin-top:2px}
 .ja{width:23%;color:#c9d1d9;line-height:1.5} .en{width:22%;color:#a5d6ff;font-size:12px;line-height:1.45} .ef{width:35%}
 .eff{background:#0d2818;border:1px solid #1f6f3f;border-radius:6px;padding:5px 8px;margin:3px 0;font-family:ui-monospace,monospace;font-size:11.5px;line-height:1.5}
 .eff b{color:#7ee787} .eff .t{color:#ffa657} .eff .ph{color:#79c0ff} .eff .p{margin-left:9px} .eff .p .k{color:#d2a8ff}
 .x{font-size:11px;border-radius:5px;padding:2px 7px;margin:2px 0;font-family:ui-monospace,monospace}
 .prio{background:#1c2b1a;color:#7ee787} .flag{background:#2b2616;color:#e3b341} .req{background:#16263b;color:#79c0ff}
 .fail{background:#3b1618;color:#ff7b72} .imm{background:#2d2233;color:#d2a8ff} .blk{background:#21262d;color:#9aa7b4} .stray{background:#3b2e16;color:#e3b341}
 tr:hover td{background:#161b22}
</style></head><body>
<header><h1>${esc(title || 'effects specs')} — ${specs.length}技</h1></header>
<div class="glossary"><b>kind(${kinds.length}種):</b> ${kinds.map(([k, n]) => `<span class="chip ${n === 1 ? 'uniq' : 'fam'}">${esc(k)} <b style="color:#6e7681">×${n}</b></span>`).join('')}</div>
<table><thead><tr><th>#</th><th>技</th><th>JP説明</th><th>英訳</th><th>構造化 effects</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
fs.writeFileSync(path.resolve(ROOT, outPath), html);
console.log('生成:', outPath, '/', specs.length, '技 /', kinds.length, 'kind');
