#!/usr/bin/env node
// 説明文 独立検証レポート — 確認ページ(waza_list_confirm.html)と同じ明るいテーブル/色/項目で。
// 効果kind別セクション・分類バッジ(物理=橙/特殊=青/変化=灰)・⚙effects/📝compose/🐈ヤック/判定。
// 入力: /tmp/verify_all_results.json(判定・穴開通前)+ /tmp/wvm_full.json(最新compose/legacy/effects)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const results = JSON.parse(fs.readFileSync('/tmp/verify_all_results.json', 'utf8'));
const mat = JSON.parse(fs.readFileSync('/tmp/wvm_full.json', 'utf8'));
const RES = Object.fromEntries(results.map(x => [x.name, x]));

const TYPE_COLORS = { 'ノーマル': '#A8A878', 'ほのお': '#F08030', 'みず': '#6890F0', 'でんき': '#F8D030', 'くさ': '#78C850', 'こおり': '#98D8D8', 'かくとう': '#C03028', 'どく': '#A040A0', 'じめん': '#E0C068', 'ひこう': '#A890F0', 'エスパー': '#F85888', 'むし': '#A8B820', 'いわ': '#B8A038', 'ゴースト': '#705898', 'ドラゴン': '#7038F8', 'あく': '#705848', 'はがね': '#B8B8D0', 'フェアリー': '#EE99AC' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clsBadge = c => c === '物理' ? 'cls-phys' : c === '特殊' ? 'cls-spec' : 'cls-stat';
const VL = { ok: 'OK', compose_fix: 'エンジン', effects_fix: 'データ', both: '両方' };
const ORD = { both: 0, effects_fix: 1, compose_fix: 2, ok: 3 };

// 確認ページと同じ KIND_ORDER 並び + 残り頻度順
const KIND_ORDER = ['急所率上昇', 'ひるみ', '威力可変', '能力ランク変化', '状態付与', '拘束', '反動', '威力倍率', '自分瀕死', '回復', 'HPが減る', '固定ダメージ', '継続削り', '連続攻撃', '必中'];

const byKind = new Map();
for (const x of results) {
  const m = mat[x.name]; if (!m) continue;
  const kinds = [...new Set((m.effects || []).map(e => e.kind))];
  if (!kinds.length) kinds.push('(効果データなし)');
  for (const k of kinds) { if (!byKind.has(k)) byKind.set(k, []); byKind.get(k).push(x.name); }
}
const restKinds = [...byKind.keys()].filter(k => !KIND_ORDER.includes(k)).sort((a, b) => byKind.get(b).length - byKind.get(a).length);
const ordered = [...KIND_ORDER.filter(k => byKind.has(k)), ...restKinds];

// effectsを生成元プログラム風(kind: 各キー)に1行で
function effSrc(efs) {
  if (!efs || !efs.length) return '(なし)';
  return efs.map(e => {
    const kv = Object.entries(e).filter(([k]) => k !== 'kind').map(([k, v]) => `${k}:${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ');
    return `【${e.kind}】 ${kv}`;
  }).join('\n');
}

const THEAD = `<thead><tr>
  <th class="col-class">分類</th><th class="col-type">タイプ</th><th class="col-name">技名</th>
  <th class="col-power">威</th><th class="col-acc">命</th>
  <th class="col-effsrc">⚙ 生成元プログラム(effects)</th>
  <th class="col-effect">📝 説明文(compose)</th>
  <th class="col-yakkun">🐈 ヤック(legacy)</th>
  <th class="col-verdict">判定</th>
</tr></thead>`;

function row(name) {
  const x = RES[name]; const m = mat[name] || {};
  const color = TYPE_COLORS[m.type] || '#888';
  const empty = !m.compose || !m.compose.trim();
  const diag = [];
  (x.compose_problems || []).forEach(p => diag.push('・' + p));
  (x.missing_in_effects || []).forEach(p => diag.push('▲データ: ' + p));
  const diagHtml = diag.length ? `<div class="diag">${esc(diag.join(' / '))}</div>` : '';
  return `<tr>
    <td class="col-class"><span class="cls-badge ${clsBadge(m.category)}">${esc(m.category || '')}</span></td>
    <td class="col-type"><span class="type-cell" style="background:${color}">${esc(m.type || '')}</span></td>
    <td class="col-name"><span class="name-cell">${esc(name)}</span></td>
    <td class="col-power num-cell">${m.power ?? '—'}</td>
    <td class="col-acc num-cell">${m.accuracy ?? '—'}</td>
    <td class="col-effsrc">${esc(effSrc(m.effects))}</td>
    <td class="col-effect ${empty ? 'gen-none' : ''}">${empty ? '(空っぽ)' : esc(m.compose)}</td>
    <td class="col-yakkun">${esc(m.legacy)}</td>
    <td class="col-verdict"><span class="vbadge v-${x.verdict}">${VL[x.verdict]}</span>${x.machine_leak ? '<span class="vleak">機械漏れ</span>' : ''}${diagHtml}</td>
  </tr>`;
}

let sections = '';
const toc = [];
ordered.forEach((k, i) => {
  const names = [...new Set(byKind.get(k))].sort((a, b) => ORD[RES[a].verdict] - ORD[RES[b].verdict] || a.localeCompare(b, 'ja'));
  const c = { ok: 0, compose_fix: 0, effects_fix: 0, both: 0 };
  names.forEach(n => c[RES[n].verdict]++);
  const okN = c.ok, fixN = names.length - okN, pct = Math.round(okN / names.length * 100);
  toc.push({ k, i, n: names.length, okN, fixN, pct });
  sections += `<section class="sec" id="sec-${i}"><h2 class="sec-h">【${esc(k)}】<span class="sec-n">${names.length}技</span>
    <span class="sec-ok">OK ${okN}</span><span class="sec-ng">要修正 ${fixN}</span></h2>
    <div class="tbl-wrap"><table>${THEAD}<tbody>${names.map(row).join('\n')}</tbody></table></div></section>`;
});

const tocSorted = [...toc].sort((a, b) => b.fixN - a.fixN);
const chips = tocSorted.map(t => {
  const cls = t.pct === 100 ? 'is-done' : t.pct >= 50 ? 'is-working' : 'is-todo';
  return `<a class="toc-chip ${cls}" href="#sec-${t.i}">${esc(t.k)}<span class="toc-n">${t.okN}/${t.n}</span></a>`;
}).join('');

const cnt = { ok: 0, compose_fix: 0, effects_fix: 0, both: 0 };
results.forEach(x => { if (cnt[x.verdict] !== undefined) cnt[x.verdict]++; });
const leakN = results.filter(x => x.machine_leak).length;
const emptyNow = results.filter(x => { const m = mat[x.name]; return m && (!m.compose || !m.compose.trim()); }).length;

const CSS = `
body { margin:0; font-family:-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif; background:#fff; color:#222; }
.hdr { padding:10px 16px; background:#1F4E79; color:#fff; }
.hdr h1 { font-size:16px; margin:0; }
.hdr .sub { font-size:11px; color:#cfe0f0; margin-top:4px; }
.tbl-wrap { overflow-x:visible; }
.toc { padding:10px 16px 12px; background:#eef3fa; border-bottom:2px solid #1F4E79; }
.toc-prog { font-size:12.5px; color:#33415c; margin-bottom:9px; padding:6px 10px; background:#fff; border:1px solid #C5D2E5; border-radius:6px; }
.toc-prog b.p-ok { color:#2E7D32; } .toc-prog b.p-eng { color:#C77800; } .toc-prog b.p-dat { color:#E65100; } .toc-prog b.p-both { color:#C0392B; } .toc-prog b.p-leak { color:#B71C1C; }
.toc-chips { display:flex; flex-wrap:wrap; gap:5px; }
.toc-chip { display:inline-flex; align-items:center; gap:4px; text-decoration:none; font-size:12px; font-weight:700; border-radius:14px; padding:3px 10px; white-space:nowrap; transition:background .12s,border-color .12s,color .12s; }
.toc-chip.is-done { color:#1B5E20; background:#fff; border:1px solid #9CCC9E; } .toc-chip.is-done:hover { background:#2E7D32; color:#fff; }
.toc-chip.is-working { color:#8a5a00; background:#fff; border:1px solid #E3C58A; } .toc-chip.is-working:hover { background:#C77800; color:#fff; }
.toc-chip.is-todo { color:#C0392B; background:#fff; border:1px solid #E0A6A6; } .toc-chip.is-todo:hover { background:#C0392B; color:#fff; }
.toc-chip:hover .toc-n { color:#fff; } .toc-n { font-size:10px; color:#7a8aa0; font-weight:600; }
.bar { position:sticky; top:0; z-index:80; background:#fff; padding:7px 16px; border-bottom:1px solid #C5D2E5; display:flex; gap:7px; flex-wrap:wrap; align-items:center; }
.bar button { padding:4px 12px; border-radius:14px; border:1px solid #C5D2E5; background:#fff; cursor:pointer; font-weight:700; font-size:12px; color:#1F4E79; }
.bar button.on { background:#1F4E79; color:#fff; border-color:#1F4E79; }
.bar input { padding:5px 10px; border-radius:8px; border:1px solid #C5D2E5; font-size:13px; }
.to-top { position:fixed; right:20px; bottom:22px; z-index:200; background:#1F4E79; color:#fff; text-decoration:none; font-size:13px; font-weight:700; padding:10px 15px; border-radius:24px; box-shadow:0 3px 10px rgba(0,0,0,.28); opacity:.92; }
.sec { margin:0 0 22px; }
.sec-h { position:sticky; top:34px; z-index:60; margin:0; padding:8px 16px; background:#10263d; color:#fff; font-size:15px; border-top:2px solid #4a90d9; }
.sec-n { font-size:12px; color:#9cc4ee; margin-left:10px; font-weight:400; }
.sec-ok { font-size:11px; color:#7ee787; background:#16361f; padding:2px 8px; border-radius:5px; margin-left:10px; font-weight:400; }
.sec-ng { font-size:11px; color:#ffd479; background:#3a2e12; padding:2px 8px; border-radius:5px; margin-left:8px; font-weight:400; }
.sec thead th { top:67px; }
table { border-collapse:collapse; width:100%; font-size:11px; background:#fff; }
thead th { background:#1F4E79; color:#fff; padding:4px 6px; text-align:center; border:1px solid #0a2040; white-space:nowrap; font-weight:700; font-size:11px; position:sticky; top:34px; z-index:50; }
thead th.col-name, thead th.col-effect, thead th.col-yakkun, thead th.col-effsrc { text-align:left; }
tbody td { padding:3px 5px; border:1px solid #DDD; vertical-align:top; }
tbody tr:nth-child(even) { background:#F9F9F9; }
tbody tr:hover { background:#E3F2FD !important; }
.type-cell { display:block; color:#fff; text-align:center; padding:3px 4px; border-radius:3px; font-weight:700; font-size:12px; white-space:nowrap; }
td.col-type { padding:1px !important; width:64px; }
.name-cell { font-weight:700; color:#1F4E79; }
td.col-name { width:120px; }
.num-cell { text-align:center; font-family:monospace; }
td.col-power, td.col-acc { width:34px; text-align:center; }
.cls-badge { display:inline-block; padding:1px 6px; border-radius:3px; color:#fff; font-size:10px; font-weight:700; }
.cls-badge.cls-phys { background:#f0883e; } .cls-badge.cls-spec { background:#58a6ff; } .cls-badge.cls-stat { background:#6e7681; }
td.col-class { width:42px; text-align:center; }
td.col-effsrc { font-family:ui-monospace,SFMono-Regular,monospace; font-size:11px; color:#2a7d4f; line-height:1.5; min-width:330px; max-width:480px; white-space:pre-wrap; word-break:normal; overflow-wrap:anywhere; background:#F6FBF7; }
td.col-effect { min-width:260px; font-size:12px; color:#222; line-height:1.5; }
td.col-effect.gen-none { color:#C0392B; font-weight:700; }
td.col-yakkun { min-width:260px; font-size:12px; color:#555; line-height:1.5; background:#FFFDF5; }
td.col-verdict { width:120px; text-align:center; }
.vbadge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; }
.vbadge.v-ok { background:#E6F5E6; color:#1B5E20; border:1px solid #9CCC9E; }
.vbadge.v-compose_fix { background:#FFF3E0; color:#A35200; border:1px solid #FFB74D; }
.vbadge.v-effects_fix { background:#FFE0B2; color:#E65100; border:1px solid #FB8C00; }
.vbadge.v-both { background:#FBEAEA; color:#A33; border:1px solid #E0A6A6; }
.vleak { display:inline-block; margin-top:3px; font-size:9px; color:#B71C1C; background:#FFEBEE; border:1px solid #E57373; border-radius:3px; padding:0 4px; }
.diag { font-size:10px; color:#777; margin-top:4px; text-align:left; line-height:1.4; }
`;

const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>説明文 独立検証(kind別・確認ページ準拠) - PchamDB</title><style>${CSS}</style></head><body>
<div class="hdr" id="top"><h1>🔍 説明文 独立検証 — 効果kind別(確認ページ準拠デザイン)</h1>
<div class="sub">作る人(compose)≠判定する人(別sonnet)。${results.length}技・${ordered.length}グループ。⚠判定バッジは穴開通"前"の判定 / compose列は最新(空っぽ=${emptyNow}技)。2026-06-14</div></div>
<div class="toc">
<div class="toc-prog">📊 判定(開通前): <b class="p-ok">OK ${cnt.ok}</b> ｜ <b class="p-eng">エンジン ${cnt.compose_fix}</b> ｜ <b class="p-dat">データ ${cnt.effects_fix}</b> ｜ <b class="p-both">両方 ${cnt.both}</b> ｜ <b class="p-leak">機械漏れ ${leakN}</b>　／　今のcompose空っぽ=${emptyNow}技</div>
<div class="toc-chips">${chips}</div></div>
<div class="bar">
<button data-f="all" class="on">全部</button>
<button data-f="both">両方</button><button data-f="effects_fix">データ</button><button data-f="compose_fix">エンジン</button><button data-f="ok">OK</button><button data-f="leak">機械漏れ</button>
<input id="q" placeholder="技名でしぼり込み…">
</div>
${sections}
<a href="#top" class="to-top">▲ 上へ</a>
<script>
const rows=[...document.querySelectorAll("tbody tr")];const secs=[...document.querySelectorAll(".sec")];let filt="all";
function vof(r){const b=r.querySelector(".vbadge");return b?[...b.classList].find(c=>c.startsWith("v-")).slice(2):"";}
function apply(){const v=document.getElementById("q").value.trim();
rows.forEach(r=>{const leak=!!r.querySelector(".vleak");const okF=filt==="all"||(filt==="leak"?leak:vof(r)===filt);
const okQ=!v||r.querySelector(".name-cell").textContent.includes(v);r.style.display=okF&&okQ?"":"none";});
secs.forEach(s=>{const any=[...s.querySelectorAll("tbody tr")].some(r=>r.style.display!=="none");s.style.display=any?"":"none";});}
document.querySelectorAll(".bar button").forEach(b=>b.addEventListener("click",()=>{filt=b.dataset.f;
document.querySelectorAll(".bar button").forEach(x=>x.classList.remove("on"));b.classList.add("on");apply();}));
document.getElementById("q").addEventListener("input",apply);
</script></body></html>`;

fs.writeFileSync(path.join(ROOT, 'review', 'waza_verify_report.html'), html);
console.log('wrote review/waza_verify_report.html / 確認ページ準拠 / kind', ordered.length, 'グループ / 空っぽ', emptyNow);
