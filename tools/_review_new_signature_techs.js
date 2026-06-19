#!/usr/bin/env node
// レギュMBで完全に新規追加された8技だけの確認HTML(2026-06-19)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
const W = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));
const NEW = ['どくばりセンボン', 'ひっくりかえす', 'どげざつき', 'ソウルクラッシュ', 'はいすいのじん', 'ふんどのこぶし', 'ゴールドラッシュ', 'コインビーム'];
const TYPE_COLORS = { 'ノーマル':'#A8A878','ほのお':'#F08030','みず':'#6890F0','でんき':'#F8D030','くさ':'#78C850','こおり':'#98D8D8','かくとう':'#C03028','どく':'#A040A0','じめん':'#E0C068','ひこう':'#A890F0','エスパー':'#F85888','むし':'#A8B820','いわ':'#B8A038','ゴースト':'#705898','ドラゴン':'#7038F8','あく':'#705848','はがね':'#B8B8D0','フェアリー':'#EE99AC' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const techs = NEW.map(n => Object.values(W).find(m => m.name === n)).filter(Boolean);

const cards = techs.map((m, i) => `
<div class="card">
  <div class="card-hdr">
    <span class="num">#${i + 1}</span>
    <span class="type-cell" style="background:${TYPE_COLORS[m.type] || '#999'}">${esc(m.type)}</span>
    <span class="cls-badge cls-${m.category === '物理' ? 'phys' : m.category === '特殊' ? 'spec' : 'stat'}">${esc(m.category)}</span>
    <h2>${esc(m.name)}</h2>
  </div>
  <div class="card-stats">
    <div><b>威力</b> <span>${m.power ?? '—'}</span></div>
    <div><b>命中</b> <span>${m.accuracy ?? '—'}</span></div>
    <div><b>PP</b> <span>${m.pp ?? '—'}</span></div>
    <div><b>対象</b> <span>${esc(m.target)}</span></div>
    <div><b>接触</b> <span>${m.contact ? '○' : '×'}</span></div>
    <div><b>守</b> <span>${m.protect ? '○' : '×'}</span></div>
  </div>
  <div class="card-block">
    <div class="lbl">📝 効果(新compose)</div>
    <div class="effect">${esc(m.description)}</div>
  </div>
  <div class="card-block legacy-block">
    <div class="lbl">🏛 やっくん風(legacy)</div>
    <div class="legacy">${esc(m.description_legacy)}</div>
  </div>
  <div class="card-block">
    <div class="lbl">🐾 覚えるポケモン (${m.learners.length}体)</div>
    <div class="mb-list">${m.learners.map(p => `<span class="mb-chip">${esc(p)}</span>`).join('')}</div>
  </div>
</div>
`).join('\n');

const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>レギュMB 完全新規8技 確認</title>
<style>
body{margin:0;font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;background:#f5f7fa;color:#222;font-size:14px;padding:0 0 60px}
.hdr{padding:18px;background:#1F4E79;color:#fff;position:sticky;top:0;z-index:50}
.hdr h1{font-size:18px;margin:0}
.hdr .sub{font-size:12.5px;color:#cfe0f0;margin-top:5px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px;padding:14px}
.card{background:#fff;border:1px solid #d6dee8;border-radius:10px;padding:14px;box-shadow:0 2px 4px rgba(0,0,0,.04)}
.card-hdr{display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.card-hdr h2{margin:0;font-size:17px;color:#1F4E79;flex-grow:1}
.num{color:#7a8aa0;font-weight:700;font-size:12px}
.type-cell{display:inline-block;color:#fff;padding:3px 9px;border-radius:4px;font-weight:700;font-size:11.5px}
.cls-badge{display:inline-block;padding:2px 8px;border-radius:4px;color:#fff;font-size:11px;font-weight:700}
.cls-phys{background:#f0883e}.cls-spec{background:#58a6ff}.cls-stat{background:#6e7681}
.card-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:7px 0;border-top:1px solid #eee;border-bottom:1px solid #eee;margin-bottom:8px;font-size:12.5px}
.card-stats div{display:flex;justify-content:space-between;padding:3px 8px}
.card-stats b{color:#7a8aa0;font-weight:700}
.card-stats span{font-family:monospace;color:#222}
.card-block{margin:6px 0}
.lbl{font-size:11.5px;font-weight:700;color:#1F4E79;margin-bottom:3px}
.effect{font-size:13px;line-height:1.6;color:#33415c}
.legacy-block{background:#fff8e1;border-radius:6px;padding:6px 10px;border-left:3px solid #FFB74D}
.legacy{font-size:12.5px;line-height:1.6;color:#5d4037}
.mb-list{display:flex;flex-wrap:wrap;gap:4px}
.mb-chip{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;background:#dff0d8;color:#1B5E20;border:1px solid #9CCC9E;font-weight:600}
</style></head><body>
<div class="hdr">
<h1>🆕 レギュMB 完全新規追加 8技</h1>
<div class="sub">${techs.length}技。今まで WAZA_MAP になかった、レギュMBで完全に新規追加された専用技/シグネチャー技。やっくん風(legacy)説明と効果(新compose)を並べて確認用。</div>
</div>
<div class="grid">${cards}</div>
</body></html>`;

const outPath = path.join(ROOT, 'review', 'new_signature_techs_confirm.html');
fs.writeFileSync(outPath, html);
console.log('生成:', outPath, '/', techs.length, '技');
