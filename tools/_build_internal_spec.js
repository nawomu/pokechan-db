#!/usr/bin/env node
/* tools/_build_internal_spec.js — ★内部構造仕様書(自動生成)
 *
 * 目的(2026-07-29 阿部さん):
 *   「俺はプログラムが分からないので任せていたら、だんだん意図とズレてデータが2つになったり、
 *    ページごとにデータが分かれていったりする。**内部構造が分かる設計図を作って、随時 俺がチェックする**。」
 *
 * → 文章のルール(CLAUDE.md) → 落ちるテスト(_ssot_guard_test.js) → **見える画面(これ)** の3段目。
 *
 * ★中身は必ず「生成」する(手書きの仕様書は腐るため)。実データを毎回スキャンして作る。
 * 出力: review/内部構造仕様書.html ＋ reference/_internal_spec_snapshot.json(直近の生成)
 * 実行: node tools/_build_internal_spec.js            … 作業の区切りごとに再生成する
 *       node tools/_build_internal_spec.js --reviewed … ★阿部さんが確認したら実行(基準を今に更新)
 *
 * ★差分は「前回の生成」ではなく「**阿部さんが最後に確認した時点**」と比べる。
 *   毎回生成しても差分が消えないようにするため(随時チェックできる)。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT_HTML = path.join(ROOT, 'review/内部構造仕様書.html');
const SNAP = path.join(ROOT, 'reference/_internal_spec_snapshot.json');       // 直近の生成
const REVIEWED = path.join(ROOT, 'reference/_internal_spec_reviewed.json');    // ★阿部さんが最後に確認した時点

const SKIP_DIRS = new Set(['.git', 'node_modules', '_review', 'backup', 'scratchpad']);
const DATA_FILES = ['pokechan_data.js', 'pokechan_data_all.js', 'items_database.js', 'pokedb.js'];

// ── 1. ページ×データの配線を全数スキャン ─────────────────────────────
function scanPages() {
  const pages = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name)); continue; }
      if (!e.name.endsWith('.html')) continue;
      const p = path.join(dir, e.name);
      const rel = path.relative(ROOT, p);
      let s = ''; try { s = fs.readFileSync(p, 'utf8'); } catch (err) { continue; }
      const srcs = [...s.matchAll(/src\s*=\s*["']([^"']+\.js)(\?[^"']*)?["']/g)].map(m => m[1]);
      const dyn = /pokechan_data(_all)?\.js/.test(s) && /document\.write/.test(s);
      pages.push({
        page: rel,
        viaPokedb: srcs.some(x => /(^|\/)pokedb\.js$/.test(x)),
        directData: srcs.filter(x => /pokechan_data(_all)?\.js|items_database\.js/.test(x)),
        dynamicLoad: dyn,
        // ★データ系のスクリプトを1つも読まない=データが焼き込まれた静的ページ
        //   (広告やアナリティクスの<script src>は数に入れない。2026-07-29 修正)
        baked: !srcs.some(x => /pokechan_data|items_database|pokedb\.js|waza_picker|preset_builds|sprite_api/.test(x)),
      });
    }
  })(ROOT);
  return pages;
}

// ── 2. マスターデータ(候補含む)の一覧 ───────────────────────────────
function scanMaster() {
  const rows = [];
  const dirs = [['master', 'master'], ['reference', 'reference']];
  for (const [dir] of dirs) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!/^master[_/]|_master\.json$|^master\.json$/.test(f) && dir !== 'master') continue;
      if (!f.endsWith('.json')) continue;
      const p = path.join(abs, f);
      const st = fs.statSync(p);
      let count = '?';
      try { const d = JSON.parse(fs.readFileSync(p, 'utf8')); count = Array.isArray(d) ? d.length : Object.keys(d).length; } catch (e) {}
      rows.push({ file: path.relative(ROOT, p), bytes: st.size, mtime: st.mtime.toISOString().slice(0, 10), count });
    }
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file));
}

// ── 3. 生成系(ビルダー)の入出力 ────────────────────────────────────
function scanBuilders() {
  const dir = path.join(ROOT, 'tools');
  const rows = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    let s = ''; try { s = fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { continue; }
    const writes = [...s.matchAll(/writeFileSync\(\s*(?:path\.join\([^,]+,\s*)?['"`]([^'"`]+)['"`]/g)].map(m => m[1]);
    const reads = [...s.matchAll(/require\(\s*(?:path\.join\([^,]+,\s*)?['"`]([^'"`]+\.(?:js|json))['"`]/g)].map(m => m[1])
      .filter(x => !x.startsWith('./_') && !/^(fs|path|vm|url|cheerio|playwright)/.test(x));
    if (!writes.length) continue;
    const outs = writes.filter(w => /\.(js|json|html)$/.test(w));
    if (!outs.length) continue;
    // 循環判定: 生成物(pokechan_data*)を読んで master を書く / その逆
    const readsGenerated = reads.some(r => /pokechan_data/.test(r));
    const writesMaster = outs.some(o => /master/.test(o));
    rows.push({ script: 'tools/' + f, reads: [...new Set(reads)].slice(0, 6), writes: [...new Set(outs)].slice(0, 6), circular: readsGenerated && writesMaster });
  }
  return rows.sort((a, b) => (b.circular - a.circular) || a.script.localeCompare(b.script));
}

// ── 4. 番人の結果 ──────────────────────────────────────────────────
function guardReport() {
  try {
    const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'reference/_ssot_guard_report.json'), 'utf8'));
    let base = {}; try { base = JSON.parse(fs.readFileSync(path.join(ROOT, 'reference/_ssot_guard_baseline.json'), 'utf8')); } catch (e) {}
    return Object.entries(rep).map(([k, v]) => ({ key: k, count: v.count, base: base[k] ?? null, items: (v.items || []).slice(0, 8) }));
  } catch (e) { return []; }
}

// ── 5. 権威コーパス ────────────────────────────────────────────────
function authority() {
  const dir = path.join(ROOT, 'reference/_authority_corpus_ch');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
    const p = path.join(dir, f);
    let n = '?';
    try { const d = JSON.parse(fs.readFileSync(p, 'utf8')); n = d.count || (Array.isArray(d) ? d.length : Object.keys(d).length); } catch (e) {}
    return { file: 'reference/_authority_corpus_ch/' + f, count: n, mtime: fs.statSync(p).mtime.toISOString().slice(0, 10) };
  });
}

// ── 組み立て ───────────────────────────────────────────────────────
const pages = scanPages();
const master = scanMaster();
const builders = scanBuilders();
const guard = guardReport();
const auth = authority();

const direct = pages.filter(p => p.directData.length && !p.viaPokedb);
const viaDb = pages.filter(p => p.viaPokedb);
const bakedCount = pages.filter(p => p.baked).length;

// ★差分は「阿部さんが最後に確認した時点」と比べる(随時チェックできるように)
let prev = null;
try { prev = JSON.parse(fs.readFileSync(REVIEWED, 'utf8')); } catch (e) {}
if (!prev) { try { prev = JSON.parse(fs.readFileSync(SNAP, 'utf8')); } catch (e) {} }
const snapshot = {
  generated_at: new Date().toISOString().slice(0, 19),
  pages_total: pages.length, pages_direct: direct.length, pages_via_pokedb: viaDb.length, pages_baked: bakedCount,
  direct_list: direct.map(p => p.page).sort(),
  guard: Object.fromEntries(guard.map(g => [g.key, g.count])),
};
const diff = prev ? {
  pages_total: snapshot.pages_total - prev.pages_total,
  pages_direct: snapshot.pages_direct - prev.pages_direct,
  new_direct: snapshot.direct_list.filter(x => !prev.direct_list.includes(x)),
  fixed_direct: (prev.direct_list || []).filter(x => !snapshot.direct_list.includes(x)),
  guard: Object.fromEntries(Object.keys(snapshot.guard).map(k => [k, snapshot.guard[k] - (prev.guard?.[k] ?? snapshot.guard[k])])),
  since: prev.generated_at,
} : null;

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const H = [];
H.push(`<meta charset="utf-8"><title>内部構造仕様書 — PchamDB</title>\n<meta name="robots" content="noindex,nofollow,noarchive">
<style>
body{font-family:-apple-system,"Hiragino Sans",sans-serif;margin:0;background:#f7f7f9;color:#222;line-height:1.7}
.wrap{max-width:1100px;margin:0 auto;padding:24px}
h1{border-bottom:4px solid #c33;padding-bottom:8px}
h2{margin-top:36px;background:#fff;padding:10px 14px;border-left:8px solid #c33;border-radius:0 6px 6px 0}
table{border-collapse:collapse;width:100%;background:#fff;margin:10px 0;font-size:14px}
th,td{border:1px solid #ddd;padding:6px 10px;vertical-align:top}
th{background:#eee;text-align:left}
code{background:#f0f0f0;padding:1px 5px;border-radius:3px;font-size:13px}
.ok{color:#0a0;font-weight:bold}.bad{color:#c00;font-weight:bold}.warn{color:#c60;font-weight:bold}
.card{background:#fff;border:1px solid #ddd;border-radius:8px;padding:14px 18px;margin:10px 0}
.big{font-size:32px;font-weight:bold}
.grid{display:flex;gap:14px;flex-wrap:wrap}
.grid .card{flex:1;min-width:190px;text-align:center}
.note{background:#fffbe6;border:1px solid #e8d48b;padding:10px 14px;border-radius:6px}
</style><div class="wrap">`);

H.push(`<h1>内部構造仕様書(自動生成)</h1>
<p>生成 ${snapshot.generated_at} JST ／ <code>node tools/_build_internal_spec.js</code> で再生成<br>
★この画面は<b>阿部さんが随時チェックする</b>ためのもの。<b>中身は毎回スキャンして生成</b>している(手書きの仕様書は腐るため)。<br>
確認し終わったら <code>node tools/_build_internal_spec.js --reviewed</code> を実行すると、<b>「ここまで確認済み」の基準</b>が更新され、次回はそこからの差分だけが出ます。</p>
<div class="note"><b>見るのはここだけでいい:</b> ①「まだマスターデータ経由になっていないページ」が減っているか ②「番人」が赤くなっていないか ③「前回からの差分」に<b>新しい直読みページ</b>が出ていないか。</div>`);

H.push(`<h2>0. ひと目で分かる数字</h2><div class="grid">
<div class="card"><div>ページ総数</div><div class="big">${pages.length}</div></div>
<div class="card"><div>参照元1枚(<code>pokedb.js</code>)経由</div><div class="big ${viaDb.length ? 'ok' : 'bad'}">${viaDb.length}</div></div>
<div class="card"><div>データを直読み<br>(★減らす対象)</div><div class="big ${direct.length ? 'bad' : 'ok'}">${direct.length}</div></div>
<div class="card"><div>データ焼き込み<br>(静的な生成ページ)</div><div class="big">${bakedCount}</div></div>
</div>`);

if (diff) {
  H.push(`<h2>1. 前回チェック以降に変わったこと <span style="font-size:14px;font-weight:normal">(基準 ${esc(diff.since)})</span></h2><table>
  <tr><th>項目</th><th>変化</th></tr>
  <tr><td>ページ総数</td><td>${diff.pages_total >= 0 ? '+' : ''}${diff.pages_total}</td></tr>
  <tr><td><b>データ直読みページ</b></td><td class="${diff.pages_direct > 0 ? 'bad' : (diff.pages_direct < 0 ? 'ok' : '')}">${diff.pages_direct >= 0 ? '+' : ''}${diff.pages_direct}</td></tr>
  <tr><td class="bad">★新しく直読みを始めたページ</td><td>${diff.new_direct.length ? diff.new_direct.map(x => `<code>${esc(x)}</code>`).join(' ') : '<span class="ok">なし</span>'}</td></tr>
  <tr><td class="ok">直読みをやめたページ</td><td>${diff.fixed_direct.length ? diff.fixed_direct.map(x => `<code>${esc(x)}</code>`).join(' ') : 'なし'}</td></tr>
  </table>`);
} else {
  H.push(`<h2>1. 前回チェックからの差分</h2><p>初回のため差分なし(次回から表示されます)。</p>`);
}

H.push(`<h2>2. どのページが、どのデータを見ているか</h2>
<p>★決まり: <b>ページは参照元1枚 <code>pokedb.js</code> だけを読む</b>。<code>pokechan_data*.js</code> の直読みは禁止。</p>
<table><tr><th>ページ</th><th>読んでいるもの</th><th>判定</th></tr>`);
for (const p of [...viaDb, ...direct].slice(0, 60)) {
  const via = p.viaPokedb;
  H.push(`<tr><td><code>${esc(p.page)}</code></td><td>${via ? '<code>pokedb.js</code>' : p.directData.map(d => `<code>${esc(d)}</code>`).join(' ')}${p.dynamicLoad ? ' <small>(document.writeで動的読み込み)</small>' : ''}</td><td class="${via ? 'ok' : 'bad'}">${via ? '✅ マスター経由' : '❌ 直読み'}</td></tr>`);
}
H.push(`</table><p><small>※データを読まないページ(${bakedCount}枚)は「生成ページ=データが焼き込まれている」。元データを直したら<b>再生成が必要</b>。</small></p>`);

H.push(`<h2>3. マスターデータ(大本)</h2>
<p>★呼び名=<b>マスターデータ</b>。置き場所は <code>master/</code> ただ1つにする(移行中)。<b>直すのはここだけ</b>。</p>
<table><tr><th>ファイル</th><th>件数</th><th>サイズ</th><th>最終更新</th></tr>`);
for (const m of master) H.push(`<tr><td><code>${esc(m.file)}</code></td><td>${m.count}</td><td>${(m.bytes / 1024).toFixed(0)} KB</td><td>${m.mtime}</td></tr>`);
H.push(`</table>`);

H.push(`<h2>4. 権威(外の情報源から取ってきた正典)</h2>
<table><tr><th>ファイル</th><th>件数</th><th>取得日</th></tr>`);
for (const a of auth) H.push(`<tr><td><code>${esc(a.file)}</code></td><td>${a.count}</td><td>${a.mtime}</td></tr>`);
H.push(`</table><p><small>出典=ポケモン徹底攻略(ヤックン)の <code>/ch/</code> チャンピオンズページ。内部参照専用(説明文のコピー元にしない)。</small></p>`);

H.push(`<h2>5. 生成系(どのスクリプトが何を作るか)</h2>
<p>★<b>逆流(生成物→マスターデータ)は禁止</b>。赤は循環しているもの。</p>
<table><tr><th>スクリプト</th><th>入力</th><th>出力</th><th>判定</th></tr>`);
for (const b of builders.slice(0, 20)) {
  H.push(`<tr><td><code>${esc(b.script)}</code></td><td>${b.reads.map(r => `<code>${esc(r)}</code>`).join('<br>') || '-'}</td><td>${b.writes.map(w => `<code>${esc(w)}</code>`).join('<br>')}</td><td class="${b.circular ? 'bad' : 'ok'}">${b.circular ? '❌ 循環' : '✅'}</td></tr>`);
}
H.push(`</table>`);

H.push(`<h2>6. 番人(破ったら落ちる検査)</h2>
<p><code>node tools/_ssot_guard_test.js</code> ／ 基準より悪化したら赤。★<b>基準を上げて通すのは禁止</b>。</p>
<table><tr><th>検査</th><th>いま</th><th>基準</th><th>判定</th><th>中身(一部)</th></tr>`);
for (const g of guard) {
  const worse = g.base != null && g.count > g.base, better = g.base != null && g.count < g.base;
  H.push(`<tr><td>${esc(g.key)}</td><td>${g.count}</td><td>${g.base ?? '-'}</td><td class="${worse ? 'bad' : better ? 'ok' : ''}">${worse ? '❌ 悪化' : better ? '✅ 改善' : '— 維持'}</td><td><small>${esc(JSON.stringify(g.items).slice(0, 120))}</small></td></tr>`);
}
H.push(`</table>`);

H.push(`<h2>7. 決まりごと(この画面で守られているか確認する)</h2><ol>
<li><b>データは一つ。絶対に一つ。</b>どのページにもデータは一つ。複数持たない。ページごとに作らない</li>
<li><b>直すのはマスターデータだけ</b>(<code>master/</code>)。生成物・各ページのコピーは手で直さない</li>
<li><b>ページは参照元1枚 <code>pokedb.js</code> だけを読む</b></li>
<li><b>値の正典はChampions</b> → 無ければ最新世代。<b>器は全国版の範囲</b></li>
<li><b>名前は正式名称</b>(表示名は <code>display_name</code> で別に持つ)</li>
<li><b>現行レギュレーション=M-B</b>。過去は保持しない。<b>M-Bフラグが立つものだけリアルバトルに出す</b></li>
<li><b>作り直しは別で作ってから入れ替える</b>(旧を残す→全数差分→回帰→昇格→確認後に旧を削除)</li>
</ol>
<p>→ 詳細=<code>仕様書_サイト全体.md</code> / <code>設計_データSSOT一本化_2026-07-28.md</code>(★§10 失敗の記録)</p>`);

H.push(`</div>\n<script src="../internal_home.js?v=20260729a"></script>`);
fs.writeFileSync(OUT_HTML, H.join('\n'));
fs.writeFileSync(SNAP, JSON.stringify(snapshot, null, 1) + '\n');
if (process.argv.includes('--reviewed')) {
  fs.writeFileSync(REVIEWED, JSON.stringify(snapshot, null, 1) + '\n');
  console.log('★確認済みとして基準を更新しました(次回からはここからの差分を表示します)');
}

console.log('生成:', path.relative(ROOT, OUT_HTML));
console.log(`  ページ ${pages.length} / pokedb経由 ${viaDb.length} / 直読み ${direct.length} / 焼き込み ${bakedCount}`);
console.log(`  マスターデータ候補 ${master.length}本 / 権威コーパス ${auth.length}本 / ビルダー ${builders.length}本(循環 ${builders.filter(b => b.circular).length})`);
if (diff) console.log(`  前回差分: 直読み ${diff.pages_direct >= 0 ? '+' : ''}${diff.pages_direct} / 新規直読み ${diff.new_direct.length}件`);
