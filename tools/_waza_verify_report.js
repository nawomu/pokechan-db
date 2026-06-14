#!/usr/bin/env node
// 独立検証の結果(/tmp/verify_all_results.json)+素材(/tmp/wvm_full.json)から
// レビューHTML(review/waza_verify_report.html)を生成。フィルタ付き(両方/データ/エンジン/OK/機械漏れ)。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const r = JSON.parse(fs.readFileSync('/tmp/verify_all_results.json', 'utf8'));
const mat = JSON.parse(fs.readFileSync('/tmp/wvm_full.json', 'utf8'));

const TC = { 'ノーマル': '#A8A878', 'ほのお': '#F08030', 'みず': '#6890F0', 'でんき': '#F8D030', 'くさ': '#78C850', 'こおり': '#98D8D8', 'かくとう': '#C03028', 'どく': '#A040A0', 'じめん': '#E0C068', 'ひこう': '#A890F0', 'エスパー': '#F85888', 'むし': '#A8B820', 'いわ': '#B8A038', 'ゴースト': '#705898', 'ドラゴン': '#7038F8', 'あく': '#705848', 'はがね': '#B8B8D0', 'フェアリー': '#EE99AC' };
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const VC = { ok: '#4ade80', compose_fix: '#fbbf24', effects_fix: '#f59e0b', both: '#f87171' };
const VL = { ok: 'OK', compose_fix: 'エンジン修正', effects_fix: 'データ追加', both: '両方' };
const ORD = { both: 0, effects_fix: 1, compose_fix: 2, ok: 3 };

r.sort((a, b) => ORD[a.verdict] - ORD[b.verdict] || a.name.localeCompare(b.name, 'ja'));
const cnt = { ok: 0, compose_fix: 0, effects_fix: 0, both: 0 };
r.forEach(x => { if (cnt[x.verdict] !== undefined) cnt[x.verdict]++; });
const leakN = r.filter(x => x.machine_leak).length;

function effView(efs) {
  if (!efs || !efs.length) return '<span class="none">(なし)</span>';
  return efs.map((e, i) => {
    const rows = Object.entries(e).filter(([k]) => k !== 'kind').map(([k, v]) =>
      `<div class="ef-kv"><span class="ef-k">${esc(k)}</span><span class="ef-v">${esc(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span></div>`).join('');
    return `<div class="ef-block"><div class="ef-kind">${i + 1}. ${esc(e.kind)}</div>${rows}</div>`;
  }).join('');
}

const cards = r.map(x => {
  const m = mat[x.name] || {};
  const tc = TC[m.type] || '#666';
  const empty = !m.compose || !m.compose.trim();
  const probs = (x.compose_problems || []).map(p => `<li>${esc(p)}</li>`).join('');
  const miss = (x.missing_in_effects || []).map(p => `<li>${esc(p)}</li>`).join('');
  return `<div class="card" data-v="${x.verdict}" data-leak="${x.machine_leak ? 1 : 0}">
    <div class="hd"><span class="tp" style="background:${tc}">${esc(m.type || '')}</span><span class="nm">${esc(x.name)}</span>
      <span class="v" style="background:${VC[x.verdict]}">${VL[x.verdict]}</span>${x.machine_leak ? '<span class="leak">&#9888;機械漏れ</span>' : ''}
      <span class="meta">威力${m.power ?? '—'}/命中${m.accuracy ?? '—'}/${esc(m.category || '')}</span></div>
    <div class="cols">
      <div class="col"><div class="ch">&#9881; effects(生成元)</div><div class="cb">${effView(m.effects)}</div></div>
      <div class="col"><div class="ch">&#128221; compose</div><div class="cb ${empty ? 'empty' : ''}">${empty ? '(空っぽ！)' : esc(m.compose)}</div></div>
      <div class="col"><div class="ch">&#128008; ヤックン</div><div class="cb yak">${esc(m.legacy)}</div></div>
    </div>
    ${probs ? `<div class="sec"><b>composeの問題</b><ul>${probs}</ul></div>` : ''}
    ${miss ? `<div class="sec dt"><b>effectsに足りない意味</b><ul>${miss}</ul></div>` : ''}
    <div class="note">${esc(x.note)}</div>
  </div>`;
}).join('\n');

const CSS = `body{background:#0c1322;color:#e6edf3;font-family:"Hiragino Kaku Gothic ProN",Meiryo,sans-serif;margin:0;padding:14px;font-size:13px}
h1{font-size:17px;color:#9fb4d8;margin:0 0 4px} .sub{color:#8b94a7;font-size:12px;margin-bottom:10px}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center}
.bar button{padding:4px 12px;border-radius:8px;border:1px solid #2a3450;background:#141927;color:#e6edf3;cursor:pointer;font-weight:700;font-size:12px}
.bar button.on{outline:2px solid #58a6ff} #q{width:220px;padding:6px 10px;border-radius:8px;border:1px solid #2a3450;background:#141927;color:#e6edf3}
.card{background:#141927;border:1px solid #232a3a;border-radius:10px;padding:10px;margin-bottom:10px}
.hd{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap} .tp{padding:2px 8px;border-radius:6px;color:#fff;font-weight:700;font-size:11px}
.nm{font-weight:800;font-size:15px} .v{padding:2px 9px;border-radius:7px;font-weight:800;font-size:11px;color:#0c1322}
.leak{font-size:10px;color:#f87171;font-weight:700} .meta{color:#8b94a7;font-size:11px;margin-left:auto}
.cols{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:9px}
.col{background:#0c1322;border:1px solid #232a3a;border-radius:8px;padding:7px;min-width:0}
.ch{font-size:11px;color:#9fb4d8;margin-bottom:5px;font-weight:700} .cb{font-size:12px;line-height:1.55;word-break:break-word}
.cb.empty{color:#f87171;font-weight:700} .cb.yak{color:#a5b4d0}
.ef-block{border-left:3px solid #3a4660;padding-left:6px;margin-bottom:6px} .ef-kind{font-weight:700;color:#7dd3fc;font-size:11px}
.ef-kv{display:flex;gap:5px;font-family:monospace;font-size:10px} .ef-k{color:#8b94a7} .ef-v{color:#cdd6e6;word-break:break-all}
.sec{margin-top:7px;font-size:12px} .sec b{color:#fbbf24} .sec.dt b{color:#f59e0b} .sec ul{margin:3px 0 0;padding-left:17px} .sec li{margin:2px 0;color:#cdd6e6}
.note{margin-top:7px;font-size:11.5px;color:#9fb4d8;border-top:1px solid #232a3a;padding-top:5px}
.none{color:#5a6478} @media(max-width:900px){.cols{grid-template-columns:1fr}}`;

const JS = `const cards=[...document.querySelectorAll(".card")];let filt="all";
function apply(){const v=document.getElementById("q").value.trim();
cards.forEach(c=>{const okF=filt==="all"||(filt==="leak"?c.dataset.leak==="1":c.dataset.v===filt);
const okQ=!v||c.querySelector(".nm").textContent.includes(v);c.style.display=okF&&okQ?"":"none";});}
document.querySelectorAll(".bar button").forEach(b=>b.addEventListener("click",()=>{filt=b.dataset.f;
document.querySelectorAll(".bar button").forEach(x=>x.classList.remove("on"));b.classList.add("on");apply();}));
document.getElementById("q").addEventListener("input",apply);`;

const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>説明文 独立検証 全${r.length}技</title><style>${CSS}</style></head><body>
<h1>説明文 独立検証レポート — 全${r.length}技</h1>
<div class="sub">作る人(compose)≠判定する人(別sonnet・898エージェント)。effectsだけ盲訳→legacy照合。2026-06-14</div>
<div class="bar">
  <button data-f="all" class="on">全部 ${r.length}</button>
  <button data-f="both" style="color:${VC.both}">両方 ${cnt.both}</button>
  <button data-f="effects_fix" style="color:${VC.effects_fix}">データ追加 ${cnt.effects_fix}</button>
  <button data-f="compose_fix" style="color:${VC.compose_fix}">エンジン修正 ${cnt.compose_fix}</button>
  <button data-f="ok" style="color:${VC.ok}">OK ${cnt.ok}</button>
  <button data-f="leak" style="color:#f87171">機械漏れ ${leakN}</button>
  <input id="q" placeholder="技名…">
</div>
<div id="list">${cards}</div>
<script>${JS}</script></body></html>`;

fs.writeFileSync(path.join(ROOT, 'review', 'waza_verify_report.html'), html);
console.log('wrote review/waza_verify_report.html /', r.length, '技 / ok', cnt.ok, 'compose', cnt.compose_fix, 'effects', cnt.effects_fix, 'both', cnt.both, 'leak', leakN);
