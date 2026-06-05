/** 監査結果(141件)をタグ別にまとめたレビューHTMLを生成 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/waza_audit_findings.json'), 'utf8'));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const byTag = {};
for (const f of data.findings) (byTag[f.tag] = byTag[f.tag] || []).push(f);
const tags = Object.keys(byTag).sort((a, b) => byTag[b].length - byTag[a].length);

let blocks = tags.map(t => {
  const rows = byTag[t].map(f => `<tr>
    <td class="mv">${esc(f.move)}</td>
    <td><span class="act ${f.action.startsWith('reassign') ? 'reassign' : 'remove'}">${esc(f.action)}</span></td>
    <td class="rs">${esc(f.reason)}</td></tr>`).join('');
  return `<details open><summary><code>${esc(t)}</code> <span class="cnt">${byTag[t].length}件</span></summary>
    <table><thead><tr><th>技</th><th>対応</th><th>理由</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}).join('');

const removeN = data.findings.filter(f => f.action.startsWith('remove')).length;
const reassignN = data.findings.filter(f => f.action.startsWith('reassign')).length;

const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>わざタグ誤分類 監査結果 — PchamDB</title><style>
:root{--bg:#0f1320;--card:#1a2032;--ink:#e7ecf5;--muted:#8b97b0;--line:#2a3350}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN",system-ui,sans-serif}
header{padding:16px 22px;background:linear-gradient(135deg,#1a2238,#101626);border-bottom:2px solid #FF7A00}
header h1{margin:0 0 4px;font-size:19px}.sub{color:var(--muted);font-size:12px}
.wrap{padding:16px 22px;max-width:1100px;margin:0 auto}
.stats{display:flex;gap:14px;margin-bottom:14px;flex-wrap:wrap}
.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 14px}.stat b{font-size:20px;display:block}.stat span{color:var(--muted);font-size:11px}
details{background:var(--card);border:1px solid var(--line);border-radius:8px;margin:8px 0;overflow:hidden}
summary{cursor:pointer;padding:9px 12px;font-size:14px}summary code{color:#9fd0ff;background:#26304d;border:1px solid #38507e;border-radius:6px;padding:1px 8px;font-size:12px}
.cnt{color:var(--muted);font-size:12px;margin-left:6px}
table{border-collapse:collapse;width:100%}th,td{padding:5px 10px;border-top:1px solid var(--line);text-align:left;vertical-align:top}
th{color:#bcd0f5;font-size:11px}.mv{font-weight:700;white-space:nowrap}
.act{font-family:ui-monospace,monospace;font-size:11px;border-radius:6px;padding:1px 7px;white-space:nowrap}
.act.remove{background:#3a1f1f;color:#ff9b9b;border:1px solid #5e2f2f}.act.reassign{background:#1f2f3a;color:#9bd0ff;border:1px solid #2f4e5e}
.rs{color:#c7d2ea;font-size:12px}
</style></head><body>
<header><h1>🔍 わざタグ誤分類 監査結果</h1><div class="sub">workflow(16グループ×監査→検証) ／ 全件 high-confidence ／ 自動生成</div></header>
<div class="wrap">
<div class="stats">
  <div class="stat"><b>${data.findings.length}</b><span>誤分類(確定)</span></div>
  <div class="stat"><b>${removeN}</b><span>タグ削除</span></div>
  <div class="stat"><b>${reassignN}</b><span>別タグへ再割当</span></div>
  <div class="stat"><b>${tags.length}</b><span>関与タグ</span></div>
</div>
${blocks}
</div></body></html>`;

fs.writeFileSync(path.join(ROOT, 'review/waza_audit_result.html'), html);
console.log('出力: review/waza_audit_result.html');
