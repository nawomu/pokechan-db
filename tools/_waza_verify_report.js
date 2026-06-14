#!/usr/bin/env node
// 説明文 独立検証レポート — 確認ページ(waza_list_confirm)と「列・並び・色・行」を完全に同じにする。
// 確認ページの buildRow/THEAD/CSS をそのまま再利用し(二重管理しない)、末尾に【判定】列だけ足す。
// 入力: /tmp/verify_all_results.json(独立判定・穴開通前)。compose/legacy/effectsは confirm 側の最新を使う。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// require すると confirm ページも再生成される(=最新化されるので好都合)。同じ行HTMLを取り出す。
const { buildRow, THEAD, CSS, moves, ordered, byKind, esc } = require('./_waza_list_confirm.js');

const results = JSON.parse(fs.readFileSync('/tmp/verify_all_results.json', 'utf8'));
const RES = Object.fromEntries(results.map(x => [x.name, x]));
const VL = { ok: 'OK', compose_fix: 'エンジン', effects_fix: 'データ', both: '両方' };
const ORD = { both: 0, effects_fix: 1, compose_fix: 2, ok: 3 };

// 判定セル(確認ページの行の末尾に差し込む)
function verdictCell(name) {
  const x = RES[name];
  if (!x) return '<td class="col-verdict"><span class="vbadge v-none">未検証</span></td>';
  const diag = [];
  (x.compose_problems || []).forEach(p => diag.push('・' + p));
  (x.missing_in_effects || []).forEach(p => diag.push('▲データ: ' + p));
  const d = diag.length ? `<div class="diag">${esc(diag.join(' / '))}</div>` : '';
  const leak = x.machine_leak ? '<span class="vleak">機械漏れ</span>' : '';
  return `<td class="col-verdict"><span class="vbadge v-${x.verdict}">${VL[x.verdict]}</span>${leak}${d}</td>`;
}
const vOrd = name => (RES[name] ? ORD[RES[name].verdict] : 99);

// THEAD に【判定】列を追加
const THEAD2 = THEAD.replace('</tr></thead>', '<th class="col-verdict">判定</th></tr></thead>');

// confirm と同じ KIND_ORDER 並び(ordered をそのまま使う)。各 section の行を判定の重い順に並べ替え+判定列追加
let sections = '';
const toc = [];
ordered.forEach((k, i) => {
  let ms = byKind.get(k) || [];
  // 判定が重い(both)順 → 名前順
  ms = [...ms].sort((a, b) => vOrd(a.name) - vOrd(b.name) || a.name.localeCompare(b.name, 'ja'));
  const c = { ok: 0, compose_fix: 0, effects_fix: 0, both: 0, none: 0 };
  ms.forEach(m => { const v = RES[m.name] ? RES[m.name].verdict : 'none'; c[v] = (c[v] || 0) + 1; });
  const okN = c.ok, fixN = ms.length - okN;
  toc.push({ k, i, n: ms.length, okN, fixN, pct: Math.round(okN / ms.length * 100) });
  const rows = ms.map(m => buildRow(m).replace('</tr>', verdictCell(m.name) + '</tr>')).join('\n');
  sections += `<section class="sec" id="sec-${i}"><h2 class="sec-h">【${esc(k)}】<span class="sec-n">${ms.length}技</span>
    <span class="sec-ok">OK ${okN}</span><span class="sec-ng">要修正 ${fixN}</span></h2>
    <div class="tbl-wrap"><table>${THEAD2}<tbody>${rows}</tbody></table></div></section>`;
});

const tocSorted = [...toc].sort((a, b) => b.fixN - a.fixN);
const chips = tocSorted.map(t => {
  const cls = t.pct === 100 ? 'is-done' : t.pct >= 50 ? 'is-working' : 'is-todo';
  return `<a class="toc-chip ${cls}" href="#sec-${t.i}">${esc(t.k)}<span class="toc-n">${t.okN}/${t.n}</span></a>`;
}).join('');

const cnt = { ok: 0, compose_fix: 0, effects_fix: 0, both: 0 };
results.forEach(x => { if (cnt[x.verdict] !== undefined) cnt[x.verdict]++; });
const leakN = results.filter(x => x.machine_leak).length;

// 判定列だけの追加CSS(他は confirm の CSS をそのまま使う)
const EXTRA_CSS = `
.bar { position:sticky; top:0; z-index:80; background:#fff; padding:7px 16px; border-bottom:1px solid #C5D2E5; display:flex; gap:7px; flex-wrap:wrap; align-items:center; }
.bar button { padding:4px 12px; border-radius:14px; border:1px solid #C5D2E5; background:#fff; cursor:pointer; font-weight:700; font-size:12px; color:#1F4E79; }
.bar button.on { background:#1F4E79; color:#fff; border-color:#1F4E79; }
.bar input { padding:5px 10px; border-radius:8px; border:1px solid #C5D2E5; font-size:13px; }
.sec-h { top:34px; } thead th { top:34px; } .sec thead th { top:67px; }
.sec-ng { font-size:11px; color:#ffd479; background:#3a2e12; padding:2px 8px; border-radius:5px; margin-left:8px; font-weight:400; }
td.col-verdict { width:130px; text-align:center; vertical-align:top; }
thead th.col-verdict { min-width:90px; }
.vbadge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; }
.vbadge.v-ok { background:#E6F5E6; color:#1B5E20; border:1px solid #9CCC9E; }
.vbadge.v-compose_fix { background:#FFF3E0; color:#A35200; border:1px solid #FFB74D; }
.vbadge.v-effects_fix { background:#FFE0B2; color:#E65100; border:1px solid #FB8C00; }
.vbadge.v-both { background:#FBEAEA; color:#A33; border:1px solid #E0A6A6; }
.vbadge.v-none { background:#F0F0F0; color:#999; border:1px solid #DDD; }
.vleak { display:inline-block; margin-top:3px; font-size:9px; color:#B71C1C; background:#FFEBEE; border:1px solid #E57373; border-radius:3px; padding:0 4px; }
.diag { font-size:10px; color:#777; margin-top:4px; text-align:left; line-height:1.4; }
.toc { padding:10px 16px 12px; background:#eef3fa; border-bottom:2px solid #1F4E79; }
.toc-prog { font-size:12.5px; color:#33415c; margin-bottom:9px; padding:6px 10px; background:#fff; border:1px solid #C5D2E5; border-radius:6px; }
.toc-prog b.p-ok { color:#2E7D32; } .toc-prog b.p-eng { color:#C77800; } .toc-prog b.p-dat { color:#E65100; } .toc-prog b.p-both { color:#C0392B; } .toc-prog b.p-leak { color:#B71C1C; }
.toc-chips { display:flex; flex-wrap:wrap; gap:5px; }
.toc-chip { display:inline-flex; align-items:center; gap:4px; text-decoration:none; font-size:12px; font-weight:700; border-radius:14px; padding:3px 10px; white-space:nowrap; }
.toc-chip.is-done { color:#1B5E20; background:#fff; border:1px solid #9CCC9E; } .toc-chip.is-working { color:#8a5a00; background:#fff; border:1px solid #E3C58A; } .toc-chip.is-todo { color:#C0392B; background:#fff; border:1px solid #E0A6A6; }
.toc-n { font-size:10px; color:#7a8aa0; font-weight:600; }
`;

const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>説明文 独立検証 — 確認ページ準拠 + 判定列</title><style>${CSS}${EXTRA_CSS}</style></head><body>
<div class="hdr" id="top"><h1>🔍 説明文 独立検証 — 確認ページと同じ列 + 【判定】</h1>
<div class="sub">作る人(compose)≠判定する人(別sonnet)。全${moves.length}技・${ordered.length}グループ。⚠判定列は穴開通"前"の判定 / 効果(compose)列は最新。2026-06-14</div></div>
<div class="toc">
<div class="toc-prog">📊 判定(開通前): <b class="p-ok">OK ${cnt.ok}</b> ｜ <b class="p-eng">エンジン ${cnt.compose_fix}</b> ｜ <b class="p-dat">データ ${cnt.effects_fix}</b> ｜ <b class="p-both">両方 ${cnt.both}</b> ｜ <b class="p-leak">機械漏れ ${leakN}</b></div>
<div class="toc-chips">${chips}</div></div>
<div class="bar">
<button data-f="all" class="on">全部</button><button data-f="both">両方</button><button data-f="effects_fix">データ</button><button data-f="compose_fix">エンジン</button><button data-f="ok">OK</button><button data-f="leak">機械漏れ</button>
<input id="q" placeholder="技名でしぼり込み…">
</div>
${sections}
<a href="#top" class="to-top">↑ 上へ</a>
<script>
const rows=[...document.querySelectorAll("tbody tr")];const secs=[...document.querySelectorAll(".sec")];let filt="all";
function vof(r){const b=r.querySelector(".vbadge");return b?[...b.classList].find(c=>c.startsWith("v-")).slice(2):"";}
function apply(){const v=document.getElementById("q").value.trim();
rows.forEach(r=>{const leak=!!r.querySelector(".vleak");const okF=filt==="all"||(filt==="leak"?leak:vof(r)===filt);
const nm=r.querySelector(".name-cell");const okQ=!v||(nm&&nm.textContent.includes(v));r.style.display=okF&&okQ?"":"none";});
secs.forEach(s=>{const any=[...s.querySelectorAll("tbody tr")].some(r=>r.style.display!=="none");s.style.display=any?"":"none";});}
document.querySelectorAll(".bar button").forEach(b=>b.addEventListener("click",()=>{filt=b.dataset.f;
document.querySelectorAll(".bar button").forEach(x=>x.classList.remove("on"));b.classList.add("on");apply();}));
document.getElementById("q").addEventListener("input",apply);
</script></body></html>`;

fs.writeFileSync(path.join(ROOT, 'review', 'waza_verify_report.html'), html);
console.log('wrote review/waza_verify_report.html / 確認ページ準拠(同じ列)+判定 / kind', ordered.length, 'グループ');
