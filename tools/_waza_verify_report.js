#!/usr/bin/env node
// 独立検証の結果(/tmp/verify_all_results.json)+素材(/tmp/wvm_full.json)から
// 「効果kind別グループ+目次+進捗」のレビューHTML(review/waza_verify_report.html)を生成。
// 確認ページ(waza_list_confirm.html)の見せ方に合わせる(似た技=同じkind=同じ直し方が一目)。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const results = JSON.parse(fs.readFileSync('/tmp/verify_all_results.json', 'utf8'));
const mat = JSON.parse(fs.readFileSync('/tmp/wvm_full.json', 'utf8'));
const RES = Object.fromEntries(results.map(x => [x.name, x]));

const TC = { 'ノーマル': '#A8A878', 'ほのお': '#F08030', 'みず': '#6890F0', 'でんき': '#F8D030', 'くさ': '#78C850', 'こおり': '#98D8D8', 'かくとう': '#C03028', 'どく': '#A040A0', 'じめん': '#E0C068', 'ひこう': '#A890F0', 'エスパー': '#F85888', 'むし': '#A8B820', 'いわ': '#B8A038', 'ゴースト': '#705898', 'ドラゴン': '#7038F8', 'あく': '#705848', 'はがね': '#B8B8D0', 'フェアリー': '#EE99AC' };
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const VC = { ok: '#4ade80', compose_fix: '#fbbf24', effects_fix: '#f59e0b', both: '#f87171' };
const VL = { ok: 'OK', compose_fix: 'エンジン修正', effects_fix: 'データ追加', both: '両方' };
const ORD = { both: 0, effects_fix: 1, compose_fix: 2, ok: 3 };

// 確認ページと同じ並び順をベースに、残りは頻度順
const KIND_ORDER = ['急所率上昇', 'ひるみ', '威力可変', '能力ランク変化', '状態付与', '拘束', '反動', '威力倍率', '自分瀕死', '回復', 'HPが減る', '固定ダメージ', '継続削り', '連続攻撃', '必中'];

// 技 → そのeffectsに含まれるkind集合。検証対象(=verify結果がある技)だけ
const byKind = new Map();
for (const x of results) {
  const m = mat[x.name];
  if (!m) continue;
  const kinds = [...new Set((m.effects || []).map(e => e.kind))];
  if (!kinds.length) kinds.push('(効果データなし)');
  for (const k of kinds) {
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(x.name);
  }
}
const restKinds = [...byKind.keys()].filter(k => !KIND_ORDER.includes(k)).sort((a, b) => byKind.get(b).length - byKind.get(a).length);
const ordered = [...KIND_ORDER.filter(k => byKind.has(k)), ...restKinds];

function effView(efs, hi) {
  if (!efs || !efs.length) return '<span class="none">(なし)</span>';
  return efs.map((e, i) => {
    const rows = Object.entries(e).filter(([k]) => k !== 'kind').map(([k, v]) =>
      `<div class="ef-kv"><span class="ef-k">${esc(k)}</span><span class="ef-v">${esc(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span></div>`).join('');
    const on = e.kind === hi ? ' hi' : '';
    return `<div class="ef-block${on}"><div class="ef-kind">${i + 1}. ${esc(e.kind)}</div>${rows}</div>`;
  }).join('');
}

function card(name, hiKind) {
  const x = RES[name]; const m = mat[name] || {};
  const tc = TC[m.type] || '#666';
  const empty = !m.compose || !m.compose.trim();
  const probs = (x.compose_problems || []).map(p => `<li>${esc(p)}</li>`).join('');
  const miss = (x.missing_in_effects || []).map(p => `<li>${esc(p)}</li>`).join('');
  return `<div class="card" data-v="${x.verdict}" data-leak="${x.machine_leak ? 1 : 0}">
    <div class="hd"><span class="tp" style="background:${tc}">${esc(m.type || '')}</span><span class="nm">${esc(name)}</span>
      <span class="v" style="background:${VC[x.verdict]}">${VL[x.verdict]}</span>${x.machine_leak ? '<span class="leak">&#9888;機械漏れ</span>' : ''}
      <span class="meta">威力${m.power ?? '—'}/命中${m.accuracy ?? '—'}/${esc(m.category || '')}</span></div>
    <div class="cols">
      <div class="col"><div class="ch">&#9881; effects</div><div class="cb">${effView(m.effects, hiKind)}</div></div>
      <div class="col"><div class="ch">&#128221; compose</div><div class="cb ${empty ? 'empty' : ''}">${empty ? '(空っぽ！)' : esc(m.compose)}</div></div>
      <div class="col"><div class="ch">&#128008; ヤックン</div><div class="cb yak">${esc(m.legacy)}</div></div>
    </div>
    ${probs ? `<div class="sec2"><b>composeの問題</b><ul>${probs}</ul></div>` : ''}
    ${miss ? `<div class="sec2 dt"><b>effectsに足りない意味</b><ul>${miss}</ul></div>` : ''}
    <div class="note">${esc(x.note)}</div>
  </div>`;
}

// 各グループの集計と本体
let sections = '';
const toc = [];
ordered.forEach((k, i) => {
  const names = [...new Set(byKind.get(k))].sort((a, b) => ORD[RES[a].verdict] - ORD[RES[b].verdict] || a.localeCompare(b, 'ja'));
  const c = { ok: 0, compose_fix: 0, effects_fix: 0, both: 0 };
  names.forEach(n => c[RES[n].verdict]++);
  const okN = c.ok; const fixN = names.length - okN;
  const pct = Math.round(okN / names.length * 100);
  toc.push({ k, i, n: names.length, okN, fixN, pct });
  sections += `<section id="sec-${i}"><h2 class="sec-h">【${esc(k)}】<span class="sec-n">${names.length}技</span>
    <span class="sec-prog"><span style="color:${VC.ok}">OK ${okN}</span> / <span style="color:#f87171">要修正 ${fixN}</span> (${pct}%)</span>
    <a class="toTop" href="#top">▲目次</a></h2>
    ${names.map(n => card(n, k)).join('\n')}</section>`;
});

// 目次チップ(要修正が多い順=直し甲斐がある順)
const tocSorted = [...toc].sort((a, b) => b.fixN - a.fixN);
const chips = tocSorted.map(t => {
  const col = t.pct === 100 ? VC.ok : t.pct >= 50 ? VC.compose_fix : '#f87171';
  return `<a class="chip" href="#sec-${t.i}" style="border-color:${col}"><span class="ck">${esc(t.k)}</span><span class="cc">${t.okN}/${t.n}</span></a>`;
}).join('');

const cnt = { ok: 0, compose_fix: 0, effects_fix: 0, both: 0 };
results.forEach(x => { if (cnt[x.verdict] !== undefined) cnt[x.verdict]++; });
const leakN = results.filter(x => x.machine_leak).length;

const CSS = `body{background:#0c1322;color:#e6edf3;font-family:"Hiragino Kaku Gothic ProN",Meiryo,sans-serif;margin:0;padding:14px;font-size:13px}
h1{font-size:17px;color:#9fb4d8;margin:0 0 4px} .sub{color:#8b94a7;font-size:12px;margin-bottom:8px}
.prog{background:#141927;border:1px solid #2a3450;border-radius:9px;padding:9px 12px;margin-bottom:10px;font-size:13px}
.prog b{font-size:15px}
.toc{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.chip{display:inline-flex;gap:6px;align-items:center;padding:3px 9px;border-radius:8px;border:1px solid #2a3450;background:#141927;color:#e6edf3;text-decoration:none;font-size:11.5px}
.chip:hover{background:#1b2540} .ck{font-weight:700} .cc{color:#8b94a7;font-family:monospace}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;position:sticky;top:0;background:#0c1322;padding:6px 0;z-index:5}
.bar button{padding:4px 12px;border-radius:8px;border:1px solid #2a3450;background:#141927;color:#e6edf3;cursor:pointer;font-weight:700;font-size:12px}
.bar button.on{outline:2px solid #58a6ff} #q{width:200px;padding:6px 10px;border-radius:8px;border:1px solid #2a3450;background:#141927;color:#e6edf3}
section{margin-bottom:18px} .sec-h{font-size:15px;color:#fbbf24;border-bottom:1px solid #2a3450;padding-bottom:4px;display:flex;align-items:center;gap:10px}
.sec-n{color:#8b94a7;font-size:12px;font-weight:400} .sec-prog{font-size:12px;font-weight:700} .toTop{margin-left:auto;font-size:11px;color:#58a6ff;text-decoration:none}
.card{background:#141927;border:1px solid #232a3a;border-radius:10px;padding:10px;margin:8px 0}
.hd{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap} .tp{padding:2px 8px;border-radius:6px;color:#fff;font-weight:700;font-size:11px}
.nm{font-weight:800;font-size:15px} .v{padding:2px 9px;border-radius:7px;font-weight:800;font-size:11px;color:#0c1322}
.leak{font-size:10px;color:#f87171;font-weight:700} .meta{color:#8b94a7;font-size:11px;margin-left:auto}
.cols{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:9px}
.col{background:#0c1322;border:1px solid #232a3a;border-radius:8px;padding:7px;min-width:0}
.ch{font-size:11px;color:#9fb4d8;margin-bottom:5px;font-weight:700} .cb{font-size:12px;line-height:1.55;word-break:break-word}
.cb.empty{color:#f87171;font-weight:700} .cb.yak{color:#a5b4d0}
.ef-block{border-left:3px solid #3a4660;padding-left:6px;margin-bottom:6px} .ef-block.hi{border-left-color:#fbbf24;background:#1a1d12}
.ef-kind{font-weight:700;color:#7dd3fc;font-size:11px} .ef-block.hi .ef-kind{color:#fbbf24}
.ef-kv{display:flex;gap:5px;font-family:monospace;font-size:10px} .ef-k{color:#8b94a7} .ef-v{color:#cdd6e6;word-break:break-all}
.sec2{margin-top:7px;font-size:12px} .sec2 b{color:#fbbf24} .sec2.dt b{color:#f59e0b} .sec2 ul{margin:3px 0 0;padding-left:17px} .sec2 li{margin:2px 0;color:#cdd6e6}
.note{margin-top:7px;font-size:11.5px;color:#9fb4d8;border-top:1px solid #232a3a;padding-top:5px}
.none{color:#5a6478} @media(max-width:900px){.cols{grid-template-columns:1fr}}`;

const JS = `const cards=[...document.querySelectorAll(".card")];const secs=[...document.querySelectorAll("section")];let filt="all";
function apply(){const v=document.getElementById("q").value.trim();
cards.forEach(c=>{const okF=filt==="all"||(filt==="leak"?c.dataset.leak==="1":c.dataset.v===filt);
const okQ=!v||c.querySelector(".nm").textContent.includes(v);c.style.display=okF&&okQ?"":"none";});
secs.forEach(s=>{const any=[...s.querySelectorAll(".card")].some(c=>c.style.display!=="none");s.style.display=any?"":"none";});}
document.querySelectorAll(".bar button").forEach(b=>b.addEventListener("click",()=>{filt=b.dataset.f;
document.querySelectorAll(".bar button").forEach(x=>x.classList.remove("on"));b.classList.add("on");apply();}));
document.getElementById("q").addEventListener("input",apply);`;

const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>説明文 独立検証(kind別)全${results.length}技</title><style>${CSS}</style></head><body id="top">
<h1>説明文 独立検証レポート — 効果kind別グループ</h1>
<div class="sub">作る人(compose)≠判定する人(別sonnet・898エージェント)。似た技=同じkind=同じ直し方が一目。2026-06-14</div>
<div class="prog">📊 進捗: <b style="color:${VC.ok}">OK ${cnt.ok}</b> ｜ <b style="color:${VC.compose_fix}">エンジン修正 ${cnt.compose_fix}</b> ｜ <b style="color:${VC.effects_fix}">データ追加 ${cnt.effects_fix}</b> ｜ <b style="color:${VC.both}">両方 ${cnt.both}</b> ｜ <b style="color:#f87171">機械漏れ ${leakN}</b> ／ 全${results.length}技・${ordered.length}グループ</div>
<div class="toc">${chips}</div>
<div class="bar">
  <button data-f="all" class="on">全部</button>
  <button data-f="both" style="color:${VC.both}">両方</button>
  <button data-f="effects_fix" style="color:${VC.effects_fix}">データ追加</button>
  <button data-f="compose_fix" style="color:${VC.compose_fix}">エンジン修正</button>
  <button data-f="ok" style="color:${VC.ok}">OK</button>
  <button data-f="leak" style="color:#f87171">機械漏れ</button>
  <input id="q" placeholder="技名…">
</div>
${sections}
<script>${JS}</script></body></html>`;

fs.writeFileSync(path.join(ROOT, 'review', 'waza_verify_report.html'), html);
console.log('wrote review/waza_verify_report.html / kind別', ordered.length, 'グループ / 全', results.length, '技');
