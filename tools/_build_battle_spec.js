#!/usr/bin/env node
/**
 * _build_battle_spec.js — 「バトル仕様書」を既存データから生成する
 *
 * 発案: 2026-07-28 阿部さん「かなり複雑になってくるので、フェーズを作るにあたっても、グループ分け・タグに
 *   おいても、設計仕様書を細かく作りながらメモしていかないと、セッションが変わると忘れちゃう」
 *
 * ★設計方針: **仕様書は手書きしない。データから生成する。**
 *   手書きの仕様書は必ず腐る(実装が動いても文書が追いつかない)。分類データ・権威コーパス・エンジンの
 *   実装行から毎回組み立てれば、走らせるたびに最新になる。
 *   人が手で書くのは「**なぜそう決めたか(decision)**」だけ → reference/_spec_decisions.json に追記していく。
 *
 * 入力:
 *   reference/_phase_assign/abilities_master_v2.json  (特性309)
 *   reference/_phase_assign/items_batch_*.json        (持ち物169)
 *   reference/_phase_assign/kinds_batch_*.json        (技kind140)
 *   reference/_authority_corpus/**                     (権威原文=引用の実在検証に使う)
 *   reference/_spec_decisions.json                     (手書きの決定メモ・任意)
 *   設計_フェーズ語彙v3_2026-07-26.md                   (フェーズの定義)
 * 出力:
 *   review/バトル仕様書.html   … フェーズごとに機構を並べた仕様書(人が読む)
 *   reference/_battle_spec.json … 同じ内容の機械可読版
 *
 * 使い方: node tools/_build_battle_spec.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PA = path.join(ROOT, 'reference', '_phase_assign');
const CORPUS = path.join(ROOT, 'reference', '_authority_corpus');

const readJSON = (p, def) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return def; } };
const glob = (dir, re) => { try { return fs.readdirSync(dir).filter(f => re.test(f)).map(f => path.join(dir, f)); } catch (e) { return []; } };

// --- 1. 機構を集める ---------------------------------------------------------
const mechanisms = [];
for (const r of readJSON(path.join(PA, 'abilities_master_v2.json'), []))
  mechanisms.push({ ...r, kind: '特性', name: r.name });
for (const f of glob(PA, /^items_batch_\d+\.json$/))
  for (const r of readJSON(f, [])) mechanisms.push({ ...r, kind: '持ち物', name: r.name });
for (const f of glob(PA, /^kinds_batch_\d+\.json$/))
  for (const r of readJSON(f, [])) mechanisms.push({ ...r, kind: '技kind', name: r.kind });  // ★spreadを先に置く(r.kindが種別を上書きする不具合を修正)

// --- 2. 権威原文で引用の実在を検証(捏造検出) --------------------------------
const corpusText = {};
for (const sub of ['moves', 'abilities', 'items', 'rules']) {
  for (const f of glob(path.join(CORPUS, sub), /\.json$/)) {
    const d = readJSON(f, null);
    if (d && d.title) corpusText[d.title] = d.raw_text || '';
  }
}
const allCorpus = Object.values(corpusText).join('\n');
function citeStatus(m) {
  const src = String(m.source || '');
  const q = src.match(/「([^」]{8,})」/);          // 「…」で囲まれた引用を検査
  if (!q) return src ? 'URLのみ' : 'なし';
  return allCorpus.includes(q[1]) ? '実在' : '★未検出';
}

// --- 3. 決定メモ(手書き)を読む ---------------------------------------------
const decisions = readJSON(path.join(ROOT, 'reference', '_spec_decisions.json'), {});

// --- 4. フェーズごとに束ねる -------------------------------------------------
const byPhase = {};
for (const m of mechanisms) {
  const phases = (m.phase && m.phase.length) ? m.phase : ['(未割り当て)'];
  for (const p of phases) (byPhase[p] = byPhase[p] || []).push(m);
}
const phaseOrder = Object.keys(byPhase).sort((a, b) => byPhase[b].length - byPhase[a].length);

// --- 5. 出力 -----------------------------------------------------------------
const stats = {
  総機構数: mechanisms.length,
  特性: mechanisms.filter(m => m.kind === '特性').length,
  持ち物: mechanisms.filter(m => m.kind === '持ち物').length,
  技kind: mechanisms.filter(m => m.kind === '技kind').length,
  フェーズ数: Object.keys(byPhase).length,
  引用実在: mechanisms.filter(m => citeStatus(m) === '実在').length,
  引用未検出: mechanisms.filter(m => citeStatus(m) === '★未検出').length,
  エンジン未実装: mechanisms.filter(m => !(m.engine_lines || []).length).length,
  決定メモ: Object.keys(decisions).length,
};
fs.writeFileSync(path.join(ROOT, 'reference', '_battle_spec.json'),
  JSON.stringify({ generated_at: new Date().toISOString(), stats, byPhase, decisions }, null, 1));

const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const badge = (t, cls) => `<span class="b ${cls}">${esc(t)}</span>`;

let html = `<!doctype html><meta charset="utf-8"><title>バトル仕様書(自動生成)</title>
<style>
:root{--bg:#f7f5f0;--panel:#fff;--ink:#2b2a26;--sub:#6b6a63;--line:#e4e0d6;--accent:#a4392f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Sans","Yu Gothic",sans-serif;line-height:1.7}
.wrap{max-width:1240px;margin:0 auto;padding:28px 18px 90px}
header{padding:30px 26px;background:linear-gradient(135deg,#2b2a26,#463c33);color:#f5f0e6;border-radius:14px;margin-bottom:22px}
h1{margin:0 0 6px;font-size:1.5rem}.meta{color:#d8cfc0;font-size:.9rem}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 26px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:9px 14px;font-size:.9rem}
.stat b{font-size:1.15rem;color:var(--accent)}
h2{margin:34px 0 10px;padding-bottom:6px;border-bottom:3px solid var(--accent);font-size:1.2rem}
h2 small{font-weight:normal;color:var(--sub);font-size:.8rem}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;font-size:.87rem}
th,td{padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}
th{background:#f0ece3;font-weight:600;white-space:nowrap}
tr:last-child td{border-bottom:0}
.b{display:inline-block;padding:1px 7px;border-radius:11px;font-size:.74rem;margin-right:4px;white-space:nowrap}
.ok{background:#eaf6ec;color:#1d6b36;border:1px solid #2f9e52}
.no{background:#fdecec;color:#8f1f1f;border:1px solid #c93b3b}
.warn{background:#fff6e0;color:#8a5c05;border:1px solid #c98a12}
.mute{background:#eef1f5;color:#4b5a6b;border:1px solid #8593a6}
.src{color:var(--sub);font-size:.8rem}
.note{background:#fffdf5;border-left:4px solid var(--accent);padding:12px 16px;border-radius:0 8px 8px 0;margin:14px 0}
code{background:#f0ece3;padding:1px 5px;border-radius:4px;font-size:.85em}
</style><div class="wrap">
<header><h1>バトル仕様書(自動生成)</h1>
<div class="meta">生成: ${new Date().toISOString()} / 生成器: <code>tools/_build_battle_spec.js</code></div></header>
<div class="note"><b>この文書は手書きではありません。</b>分類データ(<code>reference/_phase_assign/</code>)・権威コーパス・エンジンの実装行から<b>毎回組み立てて</b>います。
実装が変われば再生成するだけで最新になります(手書きの仕様書は必ず腐るため)。<br>
人が手で書くのは「<b>なぜそう決めたか</b>」だけ → <code>reference/_spec_decisions.json</code> に追記してください。ここに書いた決定は下の各行に表示されます。<br>
正典=<code>設計_バトルエンジン原理_2026-07-26.md</code>(原理) / <code>設計_フェーズ語彙v3_2026-07-26.md</code>(箱の一覧)。本書は<b>機構1件ごとの仕様</b>を担当します。</div>
<div class="stats">${Object.entries(stats).map(([k, v]) => `<div class="stat">${esc(k)} <b>${v}</b></div>`).join('')}</div>`;

for (const p of phaseOrder) {
  const list = byPhase[p].slice().sort((a, b) => String(a.kind).localeCompare(b.kind) || String(a.name).localeCompare(b.name));
  const dec = decisions[p];
  html += `<h2 id="${esc(p)}">${esc(p)} <small>${list.length}件</small></h2>`;
  if (dec) html += `<div class="note"><b>決定:</b> ${esc(dec)}</div>`;
  html += `<table><tr><th>種別</th><th>機構</th><th>発火</th><th>共有Section</th><th>実装</th><th>引用</th><th>根拠・備考</th></tr>`;
  for (const m of list) {
    const impl = (m.engine_lines || []).length ? badge('実装 ' + m.engine_lines.slice(0, 2).join(','), 'ok') : badge('未実装', 'no');
    const cs = citeStatus(m);
    const cb = cs === '実在' ? badge('引用実在', 'ok') : cs === '★未検出' ? badge('引用未検出', 'no') : badge(cs, 'mute');
    const conf = m.confidence === '高' ? '' : badge('確信度' + (m.confidence || '?'), 'warn');
    html += `<tr><td>${esc(m.kind)}</td><td><b>${esc(m.name)}</b> ${conf}</td>
      <td>${esc(m.fire_level || '')}${m.rng_timing ? '<br><span class="src">乱数:' + esc(m.rng_timing) + '</span>' : ''}</td>
      <td>${esc((m.shared_section || []).join(' / '))}</td><td>${impl}</td><td>${cb}</td>
      <td>${esc(m.note || m.desc || m.effect || '').slice(0, 160)}${m.needs_new_phase ? '<br>' + badge('要新フェーズ', 'warn') + esc(m.needs_new_phase).slice(0, 120) : ''}</td></tr>`;
  }
  html += `</table>`;
}
html += `</div>`;
fs.writeFileSync(path.join(ROOT, 'review', 'バトル仕様書.html'), html);

console.log('バトル仕様書を生成しました');
console.log(JSON.stringify(stats, null, 1));
