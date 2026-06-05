/**
 * わざ 効果・タグ レビューHTML生成 (一回限りの調査用)
 * pokechan_data.js の WAZA_MAP を読み、技/効果/タグの一覧を
 * 人間が見やすい単一HTML(review/waza_tags_review.html)に出力する。
 * 実行: node tools/_waza_report.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// ---- pokechan_data.js を評価して WAZA_MAP / TYPE_COLORS を取り出す ----
const src = fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8');
const sandbox = { window: {}, document: {}, navigator: {}, console };
const fn = new Function('window', 'document', 'navigator', 'console',
  src + '\n;return { WAZA_MAP: (typeof WAZA_MAP!=="undefined"?WAZA_MAP:null), TYPE_COLORS: (typeof TYPE_COLORS!=="undefined"?TYPE_COLORS:null) };');
const { WAZA_MAP, TYPE_COLORS } = fn(sandbox.window, sandbox.document, sandbox.navigator, sandbox.console);
if (!WAZA_MAP) { console.error('WAZA_MAP 取得失敗'); process.exit(1); }

const moves = Object.values(WAZA_MAP);
console.log('技数:', moves.length);

// ---- フィールド出現率 ----
const fieldCount = {};
for (const m of moves) for (const k of Object.keys(m)) fieldCount[k] = (fieldCount[k] || 0) + 1;
console.log('フィールド出現率:');
Object.entries(fieldCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}/${moves.length}`));

// ---- タグ語彙 (頻度 + 代表技) ----
const tagStat = {};
for (const m of moves) for (const t of (m.tags || [])) {
  (tagStat[t] = tagStat[t] || { count: 0, samples: [] });
  tagStat[t].count++;
  if (tagStat[t].samples.length < 5) tagStat[t].samples.push(m.name);
}
const tagsSorted = Object.entries(tagStat).sort((a, b) => b[1].count - a[1].count);
console.log('\nタグ種類数:', tagsSorted.length);

// ---- flags 語彙 ----
const flagStat = {};
for (const m of moves) for (const f of Object.keys(m.flags || {})) {
  if (m.flags[f]) { (flagStat[f] = flagStat[f] || { count: 0, samples: [] }); flagStat[f].count++; if (flagStat[f].samples.length < 5) flagStat[f].samples.push(m.name); }
}
const flagsSorted = Object.entries(flagStat).sort((a, b) => b[1].count - a[1].count);

// ---- battle_data.effects の kind 語彙 ----
const effKindStat = {};
for (const m of moves) {
  const effs = (m.battle_data && m.battle_data.effects) || [];
  for (const e of effs) { const k = e.kind || '?'; (effKindStat[k] = effKindStat[k] || { count: 0, samples: [] }); effKindStat[k].count++; if (effKindStat[k].samples.length < 5) effKindStat[k].samples.push(`${m.name}(${e.value ?? ''}${e.prob ? ' ' + e.prob + '%' : ''})`); }
}
const effSorted = Object.entries(effKindStat).sort((a, b) => b[1].count - a[1].count);

// ===== HTML 生成 =====
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tc = t => (TYPE_COLORS && TYPE_COLORS[t]) || '#888';

function tagChips(tags) {
  return (tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('') || '<span class="muted">—</span>';
}
function effList(m) {
  const effs = (m.battle_data && m.battle_data.effects) || [];
  if (!effs.length) return '<span class="muted">—</span>';
  return effs.map(e => `<span class="eff">${esc(e.kind)}${e.value != null ? ':' + esc(e.value) : ''}${e.prob ? ' ' + e.prob + '%' : ''}${e.target ? ' →' + esc(e.target) : ''}</span>`).join(' ');
}

const catColor = { '物理': '#C0392B', '特殊': '#1E5BB8', '変化': '#666' };

let rows = '';
for (const m of moves) {
  rows += `<tr data-name="${esc(m.name)}" data-tags="${esc((m.tags || []).join(' '))}">
    <td class="c-no">${esc(m.move_no ?? '')}</td>
    <td class="c-name">${esc(m.name)}</td>
    <td><span class="type" style="background:${tc(m.type)}">${esc(m.type)}</span></td>
    <td><span class="cat" style="color:${catColor[m.category] || '#333'}">${esc(m.category)}</span></td>
    <td class="num">${m.power || '—'}</td>
    <td class="num">${m.accuracy || '—'}</td>
    <td class="num">${m.pp || '—'}</td>
    <td class="c-desc">${esc(m.description || m.description_legacy || '')}</td>
    <td class="c-eff">${effList(m)}</td>
    <td class="c-tags">${tagChips(m.tags)}</td>
  </tr>`;
}

const tagTaxRows = tagsSorted.map(([t, s]) =>
  `<tr><td class="c-tags"><span class="tag">${esc(t)}</span></td><td class="num">${s.count}</td><td class="muted">${esc(s.samples.join(' / '))}</td></tr>`).join('');
const flagTaxRows = flagsSorted.map(([t, s]) =>
  `<tr><td><span class="tag flag">${esc(t)}</span></td><td class="num">${s.count}</td><td class="muted">${esc(s.samples.join(' / '))}</td></tr>`).join('');
const effTaxRows = effSorted.map(([t, s]) =>
  `<tr><td><span class="eff">${esc(t)}</span></td><td class="num">${s.count}</td><td class="muted">${esc(s.samples.join(' / '))}</td></tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>わざ 効果・タグ レビュー — PchamDB</title>
<style>
  :root{--orange:#FF7A00;--blue:#1E5BB8;--bg:#0f1320;--card:#1a2032;--ink:#e7ecf5;--muted:#8b97b0;--line:#2a3350}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;line-height:1.5;font-size:13px}
  header{padding:20px 24px;background:linear-gradient(135deg,#1a2238 0%,#101626 100%);border-bottom:2px solid var(--orange)}
  header h1{margin:0 0 6px;font-size:20px}
  header .sub{color:var(--muted);font-size:12px}
  .wrap{padding:18px 24px;max-width:1500px;margin:0 auto}
  h2{font-size:15px;margin:26px 0 10px;color:#ffce5a;border-left:4px solid var(--orange);padding-left:8px}
  .stats{display:flex;gap:18px;flex-wrap:wrap;margin:8px 0 0}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 14px}
  .stat b{font-size:20px;color:#fff;display:block}
  .stat span{color:var(--muted);font-size:11px}
  table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}
  th,td{padding:5px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  th{background:#222a40;position:sticky;top:0;font-size:11px;color:#bcd0f5;white-space:nowrap;cursor:default}
  tr:hover td{background:#212a44}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .muted{color:var(--muted)}
  .type{display:inline-block;color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700;white-space:nowrap}
  .cat{font-weight:700}
  .tag{display:inline-block;background:#26304d;color:#9fd0ff;border:1px solid #38507e;border-radius:10px;padding:0 7px;margin:1px 2px;font-size:11px;font-family:ui-monospace,Menlo,monospace}
  .tag.flag{color:#ffd27d;border-color:#7a5e2c;background:#33291a}
  .eff{display:inline-block;background:#1f3a2a;color:#9fe3b6;border:1px solid #2f5e43;border-radius:6px;padding:0 6px;margin:1px 2px;font-size:11px;font-family:ui-monospace,Menlo,monospace}
  .c-name{font-weight:700;white-space:nowrap}
  .c-desc{min-width:200px;max-width:300px}
  .c-tags{min-width:200px}
  .toolbar{position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 0;display:flex;gap:10px;align-items:center}
  #q{background:#0c1322;border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:8px 12px;font-size:13px;width:340px}
  #cnt{color:var(--muted)}
  .note{background:#15203a;border:1px solid var(--line);border-radius:8px;padding:12px 14px;color:#cdd8ef;font-size:12px;margin:10px 0}
</style></head>
<body>
<header>
  <h1>⚔️ わざ 効果・タグ レビュー</h1>
  <div class="sub">SSOT: <code>pokechan_data.js</code> の <code>WAZA_MAP</code> ／ バトルシミュレータ設計用 ・ 自動生成 (tools/_waza_report.js)</div>
</header>
<div class="wrap">

  <div class="stats">
    <div class="stat"><b>${moves.length}</b><span>技</span></div>
    <div class="stat"><b>${tagsSorted.length}</b><span>タグ種類</span></div>
    <div class="stat"><b>${flagsSorted.length}</b><span>flags 種類</span></div>
    <div class="stat"><b>${effSorted.length}</b><span>effect kind</span></div>
  </div>

  <div class="note">
    このページは「現状の技・効果・タグ」を確認するためのレビュー用です。<br>
    <b>tags</b> = 各技に付いた意味タグ(青) ／ <b>flags</b> = パンチ/音/弾などの分類(橙) ／ <b>effects</b> = battle_data の構造化効果(緑)。<br>
    バトルのフェーズ・優先順位で並べ直す設計のたたき台として、まずは語彙(タグ辞書)を眺めてください。
  </div>

  <h2>📚 タグ辞書 (${tagsSorted.length}種 / 出現頻度順)</h2>
  <table><thead><tr><th>タグ (tags)</th><th class="num">出現</th><th>代表技</th></tr></thead><tbody>${tagTaxRows}</tbody></table>

  <h2>🏷️ flags 辞書 (${flagsSorted.length}種)</h2>
  <table><thead><tr><th>flag</th><th class="num">出現</th><th>代表技</th></tr></thead><tbody>${flagTaxRows}</tbody></table>

  <h2>🧪 effect kind 辞書 (${effSorted.length}種 / battle_data.effects)</h2>
  <table><thead><tr><th>kind</th><th class="num">出現</th><th>代表技(値/確率)</th></tr></thead><tbody>${effTaxRows}</tbody></table>

  <h2>📋 全技一覧 (${moves.length}技)</h2>
  <div class="toolbar">
    <input id="q" type="text" placeholder="🔍 技名・タグで絞り込み (例: status_burn, パンチ)">
    <span id="cnt"></span>
  </div>
  <table id="tbl"><thead><tr>
    <th class="num">No</th><th>技名</th><th>タイプ</th><th>分類</th>
    <th class="num">威力</th><th class="num">命中</th><th class="num">PP</th>
    <th>効果(説明)</th><th>effects(構造)</th><th>tags</th>
  </tr></thead><tbody>${rows}</tbody></table>
</div>
<script>
  const q=document.getElementById('q'),rowsEl=[...document.querySelectorAll('#tbl tbody tr')],cnt=document.getElementById('cnt');
  function upd(){const v=q.value.trim().toLowerCase();let n=0;rowsEl.forEach(r=>{const hay=(r.dataset.name+' '+r.dataset.tags).toLowerCase();const show=!v||hay.includes(v);r.style.display=show?'':'none';if(show)n++;});cnt.textContent=n+' / '+rowsEl.length+' 技';}
  q.addEventListener('input',upd);upd();
</script>
</body></html>`;

const outDir = path.join(ROOT, 'review');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'waza_tags_review.html');
fs.writeFileSync(outPath, html);
console.log('\nHTML出力:', path.relative(ROOT, outPath));

// タグ語彙を機械可読でも出す (設計用)
fs.writeFileSync(path.join(outDir, 'waza_tags_list.json'), JSON.stringify({
  generated: 'review',
  total_moves: moves.length,
  tags: tagsSorted.map(([t, s]) => ({ tag: t, count: s.count, samples: s.samples })),
  flags: flagsSorted.map(([t, s]) => ({ flag: t, count: s.count, samples: s.samples })),
  effect_kinds: effSorted.map(([t, s]) => ({ kind: t, count: s.count, samples: s.samples })),
}, null, 2));
console.log('JSON出力: review/waza_tags_list.json');
