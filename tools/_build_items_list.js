#!/usr/bin/env node
// items_database.js から items_list.html を生成(2026-06-19 阿部さん依頼)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function lit(t, m, start = '{') {
  const at = t.indexOf(m); let i = t.indexOf(start, at), s = i, d = 0, S = false, e = false;
  for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === start) d++; else if (c === (start === '{' ? '}' : ']')) { d--; if (d === 0) return t.slice(s, i + 1); } } }
}
// items_database.json (元データ) から直接読み込む方が安全
const db = JSON.parse(fs.readFileSync(path.join(ROOT, '_review/items_database.json'), 'utf8'));
const items = db.items;

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CAT_LABEL = db.categories;
const CAT_ORDER = ['attack_boost', 'type_boost', 'berry_resist', 'berry_status_cure', 'berry_hp_cure', 'defense_boost', 'status_inflict', 'hp_drain', 'speed_boost', 'survival', 'misc', 'mega_stone'];

// MB追加分(2026-06-19反映)
const MB_NEW_KEYS = new Set([
  'mega_stone_raichu_x', 'mega_stone_raichu_y', 'mega_stone_sceptile', 'mega_stone_blaziken',
  'mega_stone_swampert', 'mega_stone_mawile', 'mega_stone_metagross', 'mega_stone_staraptor',
  'mega_stone_scolipede', 'mega_stone_scrafty', 'mega_stone_eelektross', 'mega_stone_pyroar',
  'mega_stone_malamar', 'mega_stone_barbaracle', 'mega_stone_dragalge', 'mega_stone_falinks',
  'metronome', 'ooki_na_nekko', 'koukaku_lens', 'focus_lens', 'hikari_no_nendo',
  'atsui_iwa', 'sarasara_iwa', 'shimetta_iwa', 'tsumetai_iwa', 'kireina_nukegara', 'kuroi_tekkyu'
]);

const byCat = {};
for (const it of items) { (byCat[it.category] = byCat[it.category] || []).push(it); }

const sections = CAT_ORDER.filter(c => byCat[c]).map(c => {
  const arr = byCat[c].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
  const rows = arr.map(it => {
    const isNew = MB_NEW_KEYS.has(it.key);
    const nameCell = isNew ? `<b>${esc(it.name)}</b> <span class="tag-new">🆕 06/19</span>` : esc(it.name);
    const effect = esc(it.effect || '');
    const acq = esc(it.acquisition_note || it.acquisition || '');
    const applies = it.applies_to ? `<br><span class="applies">対応: ${esc(it.applies_to)}</span>` : '';
    const factor = it.factor != null ? `×${it.factor}` : (it.q12 != null ? `(Q12: ${it.q12})` : '');
    return `<tr class="${isNew ? 'row-new' : ''}">
<td class="name">${nameCell}${applies}</td>
<td class="effect">${effect}</td>
<td class="factor">${factor}</td>
<td class="acq">${acq}</td>
</tr>`;
  }).join('\n');
  return `<section class="cat-sec" id="cat-${c}">
<h2><span class="cat-icon">${c === 'mega_stone' ? '✨' : '🎁'}</span> ${esc(CAT_LABEL[c] || c)} <span class="count">${arr.length}件</span></h2>
<table>
<thead><tr><th class="th-name">アイテム名</th><th class="th-effect">効果</th><th class="th-factor">倍率</th><th class="th-acq">入手</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</section>`;
}).join('\n');

const newCount = items.filter(it => MB_NEW_KEYS.has(it.key)).length;
const sumChips = CAT_ORDER.filter(c => byCat[c]).map(c =>
  `<a class="sum-chip" href="#cat-${c}">${esc(CAT_LABEL[c] || c)}<b>${byCat[c].length}</b></a>`
).join('');

const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>🎁 持ち物一覧 - PchamDB</title>
<meta name="description" content="ポケモンチャンピオンズ全持ち物一覧。メガストーン・威力補正・天気延長・タイプ強化・状態異常付与・きのみ等カテゴリ別">
<meta name="theme-color" content="#FF7A00">
<link rel="canonical" href="https://pchamdb.com/items_list.html">
<link rel="icon" href="favicon.png" type="image/png">
<style>
body{margin:0;font-family:-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;background:#f5f7fa;color:#222;font-size:14px;padding:0 0 60px}
.hdr{padding:14px 18px;background:linear-gradient(135deg,#FF7A00,#FFC107);color:#fff;position:sticky;top:0;z-index:50}
.hdr h1{font-size:18px;margin:0}
.hdr .sub{font-size:12px;color:#fff;margin-top:4px;opacity:.92}
.nav{padding:7px 18px;background:#1F4E79;color:#fff;display:flex;gap:10px;font-size:12px}
.nav a{color:#cfe0f0;text-decoration:none}.nav a:hover{color:#fff;text-decoration:underline}
.bar{padding:9px 18px;background:#eef3fa;border-bottom:1px solid #C5D2E5;display:flex;gap:6px;align-items:center;flex-wrap:wrap;position:sticky;top:74px;z-index:40}
.bar input{padding:5px 12px;border-radius:8px;border:1px solid #C5D2E5;font-size:13px;width:220px}
.sum-chip{display:inline-flex;align-items:center;gap:5px;text-decoration:none;color:#fff;background:#1F4E79;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700}
.sum-chip:hover{background:#FF7A00}
.sum-chip b{background:rgba(255,255,255,.25);padding:1px 6px;border-radius:8px}
.main{max-width:1200px;margin:0 auto;padding:14px 18px}
.cat-sec{background:#fff;border:1px solid #d6dee8;border-radius:10px;padding:14px 18px;margin-bottom:14px;box-shadow:0 2px 4px rgba(0,0,0,.04)}
.cat-sec h2{margin:0 0 12px 0;font-size:16px;color:#1F4E79;display:flex;align-items:center;gap:8px;border-bottom:2px solid #FF7A00;padding-bottom:6px}
.cat-icon{font-size:18px}
.count{font-size:11px;background:#FF7A00;color:#fff;padding:2px 9px;border-radius:10px;font-weight:700;margin-left:auto}
table{width:100%;border-collapse:collapse;font-size:12.5px}
thead{position:sticky;top:108px;background:#1F4E79;color:#fff;z-index:30}
thead th{padding:5px 8px;text-align:left;border-right:1px solid #173e63;font-size:11.5px;font-weight:700}
tbody td{padding:5px 8px;border-bottom:1px solid #EEE;vertical-align:top}
tbody tr:hover{background:#f3f6fb}
tbody tr:nth-child(2n){background:#fafbfd}
tbody tr.row-new{background:#FFFDE7}
tbody tr.row-new:hover{background:#FFF9C4}
.tag-new{display:inline-block;font-size:10px;background:#FF7A00;color:#fff;padding:1px 6px;border-radius:8px;font-weight:700;margin-left:4px}
td.name{min-width:140px;font-weight:700;color:#1F4E79}
td.effect{font-size:12px;color:#33415c;max-width:400px}
td.factor{width:80px;font-family:monospace;color:#E65100;text-align:center}
td.acq{font-size:11.5px;color:#5d4037;min-width:120px}
.applies{display:inline-block;font-size:11px;color:#7a8aa0;font-weight:400}
.bn-cat{position:fixed;bottom:14px;right:14px;background:#FF7A00;color:#fff;text-decoration:none;padding:7px 13px;border-radius:24px;font-size:12.5px;box-shadow:0 3px 8px rgba(0,0,0,.25);font-weight:700}
.bn-cat:hover{background:#E65100}
.update-note{background:#FFFDE7;border-left:4px solid #FFC107;padding:8px 12px;margin-bottom:14px;font-size:12.5px;color:#5d4037}
.update-note b{color:#FF7A00}
</style></head><body>
<div class="hdr">
<h1>🎁 持ち物一覧 - PchamDB</h1>
<div class="sub">全 ${items.length} アイテム・最終更新 06/19 (レギュMBで <b>+${newCount}件</b> 追加 🆕)</div>
</div>
<div class="nav">
<a href="index.html">🏠 トップ</a>
<a href="pokemon_db_v9.html">🗄️ ポケモンDB</a>
<a href="waza-list.html">📋 わざ一覧</a>
<a href="news.html">📰 ニュース</a>
<a href="party_checker.html">🎯 チームビルダー</a>
</div>
<div class="bar">
<input id="q" placeholder="🔍 アイテム名・効果で絞り込み…">
${sumChips}
</div>
<div class="main">
<div class="update-note">📅 <b>06/19 レギュMB更新</b>: メガストーン16種 + 通常持ち物11種 追加・1対戦でメガシンカ1度ルール・期間 2026/6/17〜9/2 10:59 (<a href="news.html">詳しくはニュース</a>)</div>
${sections}
</div>
<a href="#" class="bn-cat">↑ トップへ</a>
<script>
const inp = document.getElementById('q');
const allRows = [...document.querySelectorAll('tbody tr')];
inp.addEventListener('input', () => {
  const q = inp.value.trim().toLowerCase();
  for (const r of allRows) {
    const txt = r.textContent.toLowerCase();
    r.style.display = !q || txt.includes(q) ? '' : 'none';
  }
});
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'items_list.html'), html);
console.log('生成: items_list.html / 全' + items.length + 'アイテム (新規 ' + newCount + ')');
