#!/usr/bin/env node
/* tools/_master_diff.js — ★旧データ ↔ マスターデータ(master/)の全数差分
 *
 * 目的: 引っ越しの安全確認。「**何が消えるか・何が変わるか**」を1件ずつ出す。
 *   2026-07-28に「再ビルドで説明文が5件静かに消える」を踏みかけた。**同じ事故を防ぐための関門**。
 *
 * 出力: review/マスターデータ差分.html + reference/_master_diff.json
 * 実行: node tools/_master_diff.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const C = require(path.join(ROOT, 'pokechan_data.js'));
const A = require(path.join(ROOT, 'pokechan_data_all.js'));
global.window = global.window || {};
require(path.join(ROOT, 'items_database.js'));
const M = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'master', f), 'utf8'));
const mv = M('moves.json'), pk = M('pokemon.json'), ab = M('abilities.json'), it = M('items.json'), ls = M('learnsets.json');

const zen = s => String(s == null ? '' : s).replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
const out = { generated_at: new Date().toISOString().slice(0, 19), sections: [] };
const sec = (title, note, rows) => out.sections.push({ title, note, count: rows.length, rows });

// ── 1) 技: 旧(Champions版)にあって master に無い / 値が変わる ───────────
{
  const byName = {}; mv.items.forEach(m => { byName[zen(m.name)] = m; });
  const lost = [], changed = [];
  Object.values(C.WAZA_MAP).forEach(o => {
    const n = zen(o.name); const m = byName[n];
    if (!m) { lost.push({ name: o.name, why: 'masterに無い' }); return; }
    const cmp = [['power', o.power, m.power], ['accuracy', o.accuracy, m.accuracy], ['pp', o.pp, m.pp],
                 ['type', o.type, m.type], ['category', o.category, m.category]];
    cmp.forEach(([f, a, b]) => { if ((a || null) !== (b || null)) changed.push({ name: o.name, field: f, old: a, new: b, source: m.source }); });
    if ((o.description || '') !== (m.description || '')) changed.push({ name: o.name, field: 'description', old: (o.description || '').slice(0, 40), new: (m.description || '').slice(0, 40), source: m.source });
    const oe = JSON.stringify((o.battle_data && o.battle_data.effects) || null);
    const me = JSON.stringify((m.battle_data && m.battle_data.effects) || null);
    if (oe !== me) changed.push({ name: o.name, field: 'effects', old: oe.slice(0, 50), new: me.slice(0, 50), source: m.source });
  });
  sec('技: masterから消えるもの', '★消えてよいのは「コインビーム(存在しない技)」だけのはず', lost);
  sec('技: 値が変わるもの', 'Champions権威の値で上書きされた分。PPなどが正典に揃う', changed);
}

// ── 2) 特性 ───────────────────────────────────────────────────────
{
  const byName = {}; ab.items.forEach(a => { byName[a.name] = a; });
  const lost = [], changed = [];
  Object.keys(C.ABILITY_DESC || {}).forEach(n => {
    const m = byName[n];
    if (!m) { lost.push({ name: n, why: 'masterに無い', old: C.ABILITY_DESC[n] }); return; }
    if ((C.ABILITY_DESC[n] || '') !== (m.effect_ja || '')) changed.push({ name: n, field: 'effect_ja', old: C.ABILITY_DESC[n], new: m.effect_ja, source: m.source });
  });
  const added = ab.items.filter(a => a.champions && !(C.ABILITY_DESC || {})[a.name]).map(a => ({ name: a.name, new: (a.effect_ja || '').slice(0, 50), source: a.source }));
  sec('特性: masterから消えるもの', '★1件も消えてはいけない', lost);
  sec('特性: 説明文が変わるもの', '公式のゲーム内テキスト(Champions)に揃う', changed);
  sec('特性: 新しく説明が付くもの', '★「(説明データなし)」だった穴が埋まる', added);
}

// ── 3) ポケモン ───────────────────────────────────────────────────
{
  const byDisp = {}; pk.items.forEach(p => { byDisp[p.display_name] = p; byDisp[p.name] = byDisp[p.name] || p; });
  const lost = [], renamed = [], statDiff = [];
  C.POKEMON_LIST.forEach(o => {
    const m = byDisp[o.name];
    if (!m) { lost.push({ name: o.name, why: 'masterに無い' }); return; }
    if (m.name !== o.name) renamed.push({ old: o.name, new: m.name, display: m.display_name });
    ['hp', 'atk', 'def', 'spatk', 'spdef', 'spd', 'total'].forEach(k => {
      if ((o[k] || null) !== (m[k] || null)) statDiff.push({ name: o.name, field: k, old: o[k], new: m[k], source: m.source });
    });
  });
  sec('ポケモン: masterから消えるもの', '★1件も消えてはいけない', lost);
  sec('ポケモン: 名前が正式名称に変わるもの', '★画面表示(display_name)は変わらない', renamed);
  sec('ポケモン: 種族値が変わるもの', '★0件が期待値(2026-07-29に0件差を確認済み)', statDiff);
}

// ── 4) 持ち物 ────────────────────────────────────────────────────
{
  const byName = {}; it.items.forEach(i => { byName[i.name] = i; });
  const flat = []; (function walk(o) { if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') { if (o.name && (o.key || o.effect)) flat.push(o); Object.values(o).forEach(walk); } })(global.window.ITEMS_DATABASE);
  const seen = new Set(); const lost = [], changed = [];
  flat.forEach(o => { const k = o.key || o.name; if (seen.has(k)) return; seen.add(k);
    const m = byName[o.name];
    if (!m) { lost.push({ name: o.name, why: 'masterに無い' }); return; }
    if ((o.effect || '') !== (m.effect_ja || '')) changed.push({ name: o.name, field: 'effect', old: (o.effect || '').slice(0, 40), new: (m.effect_ja || '').slice(0, 40), source: m.source });
  });
  sec('持ち物: masterから消えるもの', '★1件も消えてはいけない', lost);
  sec('持ち物: 効果文が変わるもの', 'Champions実在の75件は公式テキストに揃う', changed);
}

// ── 5) 学習データ ─────────────────────────────────────────────────
{
  const byName = {}; ls.items.forEach(l => { byName[l.name] = l; });
  const chKeyName = {}; Object.entries(C.WAZA_MAP).forEach(([k, m]) => { chKeyName[k] = m.name; });
  const rows = [];
  C.POKEMON_LIST.forEach(p => {
    const m = byName[p.name]; if (!m) return;
    const oursKeys = (C.POKEMON_WAZA && C.POKEMON_WAZA[p.name]) || [];
    const ours = new Set(oursKeys.map(k => chKeyName[k] || k));
    const now = new Set(m.learn || []);
    const removed = [...ours].filter(x => !now.has(x));
    const added = [...now].filter(x => !ours.has(x));
    if (removed.length || added.length || (!oursKeys.length && now.size)) {
      rows.push({ name: p.name, 旧: ours.size, 新: now.size, 消える: removed.slice(0, 6), 増える: added.slice(0, 6), 没収: (m.confiscated || []).length });
    }
  });
  sec('学習データ: 変わるもの', '★「消える」は権威で没収された技のはず。空だった38体は「増える」側に出る', rows);
}

fs.writeFileSync(path.join(ROOT, 'reference/_master_diff.json'), JSON.stringify(out, null, 1) + '\n');

// ── HTML ─────────────────────────────────────────────────────────
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const H = [`<meta charset="utf-8"><title>マスターデータ差分 — PchamDB</title>
<meta name="robots" content="noindex,nofollow,noarchive">
<style>body{font-family:-apple-system,"Hiragino Sans",sans-serif;margin:0;background:#f6f7f9;color:#1c1e22;line-height:1.7}
.wrap{max-width:1100px;margin:0 auto;padding:24px 20px 80px}h1{border-bottom:4px solid #c33;padding-bottom:8px}
h2{margin-top:30px;background:#fff;padding:10px 14px;border-left:8px solid #c33;border-radius:0 6px 6px 0}
table{border-collapse:collapse;width:100%;background:#fff;margin:8px 0;font-size:13px}
th,td{border:1px solid #dcdee3;padding:5px 9px;text-align:left;vertical-align:top}th{background:#eef1f6}
.ok{color:#0a0;font-weight:bold}.bad{color:#c00;font-weight:bold}
.note{background:#fffbe6;border:1px solid #e8d48b;padding:10px 14px;border-radius:6px;font-size:13px;margin:8px 0}
</style><div class="wrap"><h1>マスターデータ差分(旧 → master/)</h1>
<p>生成 ${out.generated_at} ／ <code>node tools/_master_diff.js</code><br>
★<b>引っ越しの安全確認</b>。「何が消えるか・何が変わるか」を全数で出す。<b>消えてよいのはコインビーム(存在しない技)だけ</b>。</p>`];
out.sections.forEach(s => {
  const bad = /消える/.test(s.title) && s.count > 0;
  H.push(`<h2>${esc(s.title)} — <span class="${bad ? 'bad' : 'ok'}">${s.count}件</span></h2><div class="note">${esc(s.note)}</div>`);
  if (!s.count) { H.push('<p class="ok">なし ✅</p>'); return; }
  const keys = Object.keys(s.rows[0]);
  H.push('<table><tr>' + keys.map(k => `<th>${esc(k)}</th>`).join('') + '</tr>');
  s.rows.slice(0, 200).forEach(r => H.push('<tr>' + keys.map(k => `<td>${esc(Array.isArray(r[k]) ? r[k].join('、') : r[k])}</td>`).join('') + '</tr>'));
  H.push('</table>');
  if (s.count > 200) H.push(`<p>…ほか ${s.count - 200}件(全件は reference/_master_diff.json)</p>`);
});
H.push('</div>\n<script src="../internal_home.js?v=20260729a"></script>');
fs.writeFileSync(path.join(ROOT, 'review/マスターデータ差分.html'), H.join('\n'));
console.log('=== 旧 → master/ の差分 ===');
out.sections.forEach(s => console.log(`  ${s.count > 0 && /消える/.test(s.title) ? '❌' : '  '} ${s.title}: ${s.count}件`));
console.log('\n出力: review/マスターデータ差分.html / reference/_master_diff.json');
