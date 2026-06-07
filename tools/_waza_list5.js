/** 確認一覧(5列): ①技名 ②表示設定 ③エフェクト ④作られる文章(エンジン) ⑤ヤックンの文章。
 * 実行: node tools/_waza_list5.js → review/waza_list5.html  ※同一エンジンrequire・本番無変更 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { compose, map } = require('./_waza_compose.js');
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const rows = [];
let voiced = 0, partial = 0;
for (const m of Object.values(map)) {
  const { text, holes } = compose(m);
  if (!text) continue; // 生成文のある技だけ
  if (holes.length) partial++; else voiced++;
  const bd = m.battle_data || {};
  const setting = [m.type, m.category, m.power != null ? `威力${m.power}` : '威力—', m.accuracy != null ? `命中${m.accuracy}` : '命中—', `PP${m.pp}`].join('・') + (m.subcategory ? `・[${m.subcategory}]` : '');
  const eff = (bd.effects || []).map(e => esc(JSON.stringify(e))).join('\n');
  rows.push(`<tr>
    <td class="mv">${esc(m.name)}</td>
    <td class="set">${esc(setting)}</td>
    <td class="src">${eff}${holes.length ? `<div class="hole">⚠未対応: ${esc(holes.join('・'))}</div>` : ''}</td>
    <td class="gen">${esc(text)}</td>
    <td class="leg">${esc(m.description_legacy || '')}</td>
  </tr>`);
}

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>技説明 確認一覧(5列)</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:15px;line-height:1.7}
 header{padding:12px 18px;background:#161b22;border-bottom:1px solid #30363d}
 h1{font-size:19px;margin:0} .lead{font-size:13px;color:#9aa7b4;margin-top:6px}
 table{border-collapse:collapse;width:100%} th{background:#21262d;color:#9aa7b4;font-size:12.5px;padding:8px;text-align:left;border-bottom:2px solid #30363d;position:sticky;top:0}
 td{padding:9px;border-bottom:1px solid #1c2128;vertical-align:top}
 .mv{color:#d2a8ff;font-weight:700;white-space:nowrap;font-size:15px}
 .set{color:#9aa7b4;font-size:12px;min-width:150px}
 .src{color:#79c0ff;font-family:ui-monospace,monospace;font-size:11px;line-height:1.55;max-width:330px;white-space:pre-wrap;word-break:break-all}
 .hole{color:#ffd479;font-size:11px;margin-top:4px}
 .gen{color:#7ee787;min-width:260px;font-size:15px} .leg{color:#e6edf3;min-width:260px;font-size:13.5px;border-left:3px solid #30363d;padding-left:11px}
 tr:hover td{background:#161b22}
 .count{color:#7ee787}
</style></head><body>
<header><h1>📋 技説明 確認一覧 — 5列</h1>
<div class="lead">①技名 ②表示設定 ③エフェクト(本番SSOT) ④<b style="color:#7ee787">作られる文章(エンジン生成)</b> ⑤ヤックンの文章(参照). 記号=「」/ 数字・段階表はデータのまま忠実。<span class="count">生成 ${voiced + partial}技</span>(うち一部未対応 ${partial})。本番=無変更。</div></header>
<table><thead><tr><th>①技名</th><th>②表示設定</th><th>③エフェクト</th><th>④作られる文章</th><th>⑤ヤックンの文章</th></tr></thead>
<tbody>${rows.join('')}</tbody></table>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_list5.html'), html);
console.log('生成: review/waza_list5.html / 生成文あり', rows.length, '技(完全', voiced, '/ 一部未対応', partial, ')');
