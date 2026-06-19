#!/usr/bin/env node
// レギュMB 新ポケモン追加で learners が変化した技だけを確認HTML化(2026-06-19 阿部さん依頼)
// バックアップ(追加前)と現在を比較→差分のある技だけリストアップ
// 各技について: 技名・タイプ・分類・威力・命中・PP・効果・やっくん説明(legacy)・追加されたMBポケモン名
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function lit(t, m, start = '{') {
  const at = t.indexOf(m); let i = t.indexOf(start, at), s = i, d = 0, S = false, e = false;
  for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === start) d++; else if (c === (start === '{' ? '}' : ']')) { d--; if (d === 0) return t.slice(s, i + 1); } } }
}

// 現在
const curSrc = fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8');
const curW = JSON.parse(lit(curSrc, 'const WAZA_MAP =', '{'));

// バックアップ(learners追加前)
const bakPath = path.join(ROOT, 'pokechan_data.js.before_learners_2026-06-18.bak');
if (!fs.existsSync(bakPath)) { console.error('バックアップなし'); process.exit(1); }
const bakSrc = fs.readFileSync(bakPath, 'utf8');
const bakW = JSON.parse(lit(bakSrc, 'const WAZA_MAP =', '{'));

const MB_POKEMON = new Set(['メガライチュウX','メガライチュウY','ラフレシア','ハリーセン','ジュカイン','メガジュカイン','バシャーモ','メガバシャーモ','ラグラージ','メガラグラージ','クチート','メガクチート','メタグロス','メガメタグロス','ムクホーク','メガムクホーク','ムシャーナ','ペンドラー','メガペンドラー','ズルズキン','メガズルズキン','シビルドン','メガシビルドン','カエンジシ','メガカエンジシ','カラマネロ','メガカラマネロ','ガメノデス','メガガメノデス','ドラミドロ','メガドラミドロ','オーロンゲ','タイレーツ','メガタイレーツ','ハリーマン','ハカドッグ','コノヨザル','サーフゴー']);

// 差分を取得: 新たに追加された(MB)ポケモンを各技ごとに集計
const diffs = [];
for (const k of Object.keys(curW)) {
  const curLearners = curW[k].learners || [];
  const bakLearners = (bakW[k] && bakW[k].learners) || [];
  const added = curLearners.filter(n => !bakLearners.includes(n) && MB_POKEMON.has(n));
  if (added.length === 0) continue;
  diffs.push({
    key: k,
    name: curW[k].name,
    type: curW[k].type,
    category: curW[k].category,
    power: curW[k].power,
    accuracy: curW[k].accuracy,
    pp: curW[k].pp,
    description: curW[k].description,
    description_legacy: curW[k].description_legacy,
    target: curW[k].target,
    contact: curW[k].contact,
    protect: curW[k].protect,
    addedMBPokemon: added,
  });
}

console.log('レギュMBポケモン追加で learners に変化があった技:', diffs.length, '件');

// HTML生成
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TYPE_COLORS = { 'ノーマル':'#A8A878','ほのお':'#F08030','みず':'#6890F0','でんき':'#F8D030','くさ':'#78C850','こおり':'#98D8D8','かくとう':'#C03028','どく':'#A040A0','じめん':'#E0C068','ひこう':'#A890F0','エスパー':'#F85888','むし':'#A8B820','いわ':'#B8A038','ゴースト':'#705898','ドラゴン':'#7038F8','あく':'#705848','はがね':'#B8B8D0','フェアリー':'#EE99AC' };

// タイプ別ソート
diffs.sort((a, b) => {
  if (a.type !== b.type) return a.type.localeCompare(b.type, 'ja');
  return (b.power || 0) - (a.power || 0);
});

// タイプ別グルーピング
const byType = {};
for (const d of diffs) { (byType[d.type] = byType[d.type] || []).push(d); }

const rows = diffs.map((d, i) => `
<tr id="row-${d.key}">
  <td class="num">${i + 1}</td>
  <td><span class="type-cell" style="background:${TYPE_COLORS[d.type] || '#999'}">${esc(d.type)}</span></td>
  <td><span class="cls-badge cls-${d.category === '物理' ? 'phys' : d.category === '特殊' ? 'spec' : 'stat'}">${esc(d.category)}</span></td>
  <td class="movename">${esc(d.name)}</td>
  <td class="num">${d.power ?? '—'}</td>
  <td class="num">${d.accuracy ?? '—'}</td>
  <td class="num">${d.pp ?? '—'}</td>
  <td class="effect">${esc(d.description || '—')}</td>
  <td class="legacy">${esc(d.description_legacy || '(legacyなし)')}</td>
  <td class="mb-poke">
    <span class="mb-count">${d.addedMBPokemon.length}体追加</span>
    <div class="mb-list">${d.addedMBPokemon.map(p => `<span class="mb-chip">${esc(p)}</span>`).join('')}</div>
  </td>
</tr>`).join('\n');

const summary = Object.entries(byType).sort((a, b) => b[1].length - a[1].length).map(([t, arr]) =>
  `<a class="sum-chip" href="#type-${esc(t)}" style="background:${TYPE_COLORS[t] || '#999'}">${esc(t)}<b>${arr.length}</b></a>`
).join('');

const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>レギュMB 新ポケモン追加で learners 変化した技 確認</title>
<style>
body{margin:0;font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;background:#fff;color:#222;font-size:13px}
.hdr{padding:14px 18px;background:#1F4E79;color:#fff;position:sticky;top:0;z-index:50}
.hdr h1{font-size:17px;margin:0}
.hdr .sub{font-size:12px;color:#cfe0f0;margin-top:5px}
.bar{padding:9px 18px;background:#eef3fa;border-bottom:1px solid #C5D2E5;display:flex;gap:6px;align-items:center;flex-wrap:wrap;position:sticky;top:54px;z-index:40}
.bar input{padding:5px 12px;border-radius:8px;border:1px solid #C5D2E5;font-size:13px;width:220px}
.sum-chip{display:inline-flex;align-items:center;gap:5px;text-decoration:none;color:#fff;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700}
.sum-chip b{background:rgba(255,255,255,.25);padding:1px 6px;border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:12.5px}
thead{position:sticky;top:96px;background:#1F4E79;color:#fff;z-index:30}
thead th{padding:6px 8px;text-align:left;border-right:1px solid #173e63;font-size:11.5px;font-weight:700}
tbody td{padding:6px 8px;border-bottom:1px solid #EEE;vertical-align:top}
tbody tr:hover{background:#f3f6fb}
tbody tr:nth-child(2n){background:#fafbfd}
td.num{text-align:center;font-family:monospace;width:50px;color:#555}
td.movename{font-weight:700;color:#1F4E79;min-width:120px}
.type-cell{display:inline-block;color:#fff;padding:2px 8px;border-radius:3px;font-weight:700;font-size:11px}
.cls-badge{display:inline-block;padding:1px 6px;border-radius:3px;color:#fff;font-size:10px;font-weight:700}
.cls-phys{background:#f0883e}.cls-spec{background:#58a6ff}.cls-stat{background:#6e7681}
td.effect{font-size:12px;color:#33415c;min-width:200px;max-width:260px}
td.legacy{font-size:11.5px;color:#5d4037;background:#fff8e1;min-width:280px;max-width:380px;line-height:1.5}
td.mb-poke{min-width:200px;max-width:300px}
.mb-count{font-size:11px;color:#1F4E79;font-weight:700}
.mb-list{margin-top:3px;display:flex;flex-wrap:wrap;gap:3px}
.mb-chip{display:inline-block;font-size:10.5px;padding:1px 6px;border-radius:8px;background:#dff0d8;color:#1B5E20;border:1px solid #9CCC9E}
.legacy-toggle{cursor:pointer;color:#1F4E79;font-size:11px;text-decoration:underline}
.section-row{background:#1F4E79;color:#fff}
.section-row td{padding:6px 12px;font-weight:700;font-size:13px}
</style></head><body>
<div class="hdr">
<h1>🔍 レギュMB 新ポケモン追加で learners 変化した技 確認</h1>
<div class="sub">${diffs.length}件・新38ポケモン追加で WAZA_MAP の learners 配列に変化があった技だけ・タイプ別ソート(タイプ→威力降順)</div>
</div>
<div class="bar">
<input id="q" placeholder="🔍 技名/タイプ/ポケモン名 で絞り込み">
<span class="sum-stats">タイプ別件数:</span>
${summary}
</div>
<table>
<thead><tr>
  <th>#</th><th>タイプ</th><th>分類</th><th>わざ名</th><th>威力</th><th>命中</th><th>PP</th><th>効果(新compose)</th><th>やっくん(legacy)</th><th>追加されたMBポケモン</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<script>
const inp = document.getElementById('q');
const rows = [...document.querySelectorAll('tbody tr')];
inp.addEventListener('input', () => {
  const q = inp.value.trim().toLowerCase();
  for (const r of rows) {
    const txt = r.textContent.toLowerCase();
    r.style.display = !q || txt.includes(q) ? '' : 'none';
  }
});
</script>
</body></html>`;

const outPath = path.join(ROOT, 'review', 'mb_new_techs_confirm.html');
fs.writeFileSync(outPath, html);
console.log('生成:', outPath, '/', diffs.length, '件');

// タイプ別サマリ
console.log('\n=== タイプ別 ===');
for (const [t, arr] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
  console.log('  ' + t + ': ' + arr.length + '件');
}
