/** てつのこぶし誤付与14技の「削除前→削除後」比較HTML。
 * before=現状(てつのこぶし effect 有) / after=その effect を除いた版 を同一エンジンで生成。
 * 実行: node tools/_tetsu_compare.js  → review/tetsu_compare.html  ※データは変更しない(表示比較のみ) */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { compose, map } = require('./_waza_compose.js');
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const hasTetsu = e => /てつのこぶし/.test(JSON.stringify(e));

const rows = [];
for (const m of Object.values(map)) {
  const eff = (m.battle_data || {}).effects || [];
  if (!eff.some(hasTetsu)) continue;
  const before = compose(m).text;
  // after = てつのこぶし effect を除いたクローン
  const clone = JSON.parse(JSON.stringify(m));
  clone.battle_data.effects = eff.filter(e => !hasTetsu(e));
  const after = compose(clone).text || '(他効果なし=説明文なし)';
  const removed = eff.filter(hasTetsu).map(e => e.kind);
  rows.push({ name: m.name, before, after, removed });
}

const tr = r => `<tr>
  <td class="mv">${esc(r.name)}<div class="rm">除外: ${esc(r.removed.join('・'))}</div></td>
  <td class="bf">${esc(r.before)}</td>
  <td class="af">${esc(r.after)}</td>
</tr>`;

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>てつのこぶし誤付与 — 削除前後の比較</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:16px;line-height:1.75}
 header{padding:14px 20px;background:#161b22;border-bottom:1px solid #30363d}
 h1{font-size:20px;margin:0} .lead{font-size:13.5px;color:#9aa7b4;margin-top:8px;max-width:980px}
 table{border-collapse:collapse;width:100%} th{background:#21262d;color:#9aa7b4;font-size:13.5px;padding:10px;text-align:left;border-bottom:2px solid #30363d;position:sticky;top:0}
 td{padding:12px;border-bottom:1px solid #1c2128;vertical-align:top;font-size:15.5px}
 .mv{color:#d2a8ff;font-weight:700;white-space:nowrap} .rm{color:#ff9bce;font-size:11px;font-weight:400;margin-top:5px}
 .bf{color:#9aa7b4;min-width:300px} .af{color:#7ee787;min-width:300px;font-weight:500;border-left:3px solid #2ea043;padding-left:14px}
 tr:hover td{background:#161b22}
 .count{color:#ffd479;font-weight:700}
</style></head><body>
<header><h1>🔧 てつのこぶし誤付与 — 削除「前 → 後」(<span class="count">${rows.length}技</span>)</h1>
<div class="lead">「特性てつのこぶし=パンチ系1.2倍」は<b>特性のルール</b>なので、技ごとに持つのは誤付与。これを技データから削除すると説明文がどう変わるか。<br><b style="color:#9aa7b4">灰=削除前(今)</b> → <b style="color:#7ee787">緑=削除後</b>。1.2倍の一文が消えるだけ(他の効果は残る)。1.2倍は特性ABILITY_DESC(公式準拠)が担当。<br><b>⚠「後」が空に見える技</b>(ドレインパンチ/マッハパンチ等)は、その技の<b>他の効果(吸収・優先度など)がまだテンプレ未対応 or effect外</b>なだけで、<b>データの効果は消えません</b>(後で開通順が当たれば出る)。<br>※これは表示比較のみ。<b>データはまだ変更していません。</b> 削除前に「simがこの per-move効果で1.2倍を掛けていないか」の裏取りも必要。</div></header>
<table><thead><tr><th>技</th><th>削除前(今)</th><th>削除後</th></tr></thead><tbody>${rows.map(tr).join('')}</tbody></table>
<footer style="padding:18px 20px;color:#6e7681;font-size:12px">_tetsu_compare.js / 同一エンジンで生成 / データ無変更</footer>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'tetsu_compare.html'), html);
console.log('生成: review/tetsu_compare.html /', rows.length, '技');
