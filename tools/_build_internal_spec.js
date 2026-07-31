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
      // ★2026-07-31 修正(阿部さんが「内部構造を把握したい」と言って発覚):
      //   document.write('<script src="' + src + '">') のように**変数で組み立てている**ページは
      //   src="..." に文字列が現れないため directData が空になり、
      //   直読みにも配管経由にも焼き込みにも入らず**表から消えていた**(battle_lab.html が実例)。
      //   → document.write を使っているページは、ファイル内に literal で書かれたデータ名も拾う。
      const dynSrcs = dyn
        ? [...new Set([...s.matchAll(/['"]((?:pokechan_data(?:_all)?|items_database)\.js)(?:\?[^'"]*)?['"]/g)].map(m => m[1]))]
        : [];
      pages.push({
        page: rel,
        viaPokedb: srcs.some(x => /(^|\/)pokedb\.js$/.test(x)),
        directData: [...new Set([...srcs.filter(x => /pokechan_data(_all)?\.js|items_database\.js/.test(x)), ...dynSrcs])],
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
      // ★件数の数え方(2026-07-31 修正): トップのキー数を数えると嘘になる。
      //   master/pokemon.json は {meta,count,champions_count,items} なので「4件」と出ていた(実際は1,257体)。
      //   → 中身の配列(items/list/data)を優先し、無ければ配列そのもの、それも無ければキー数。
      let count = '?';
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(d)) count = d.length;
        else if (d && typeof d === 'object') {
          const arr = ['items', 'list', 'data', 'abilities', 'moves', 'pokemon'].map(k => d[k]).find(Array.isArray);
          count = arr ? arr.length : (typeof d.count === 'number' ? d.count : Object.keys(d).length);
        }
      } catch (e) {}
      // ★本物(master/)と、紛らわしい旧マスター(reference/)を区別する。
      //   阿部さんの問い「一番のマスターって何なの?」の原因が、この並びだったため(2026-07-31)。
      const rel = path.relative(ROOT, p);
      rows.push({ file: rel, bytes: st.size, mtime: st.mtime.toISOString().slice(0, 10), count,
                  isReal: rel.startsWith('master/') });
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

// ── 5b. ★配管(pokedb.js)がいま実際にどこを向いているか ──────────────
//   阿部さんの指摘(2026-07-31): 「これJSがマスターなの? 一番のマスターって何なの?」
//   → pokedb.js は**配管**であってマスターではない。しかも今は**先が旧データを向いている**。
//     「マスター経由」と書くのは二重に嘘なので、実際の供給先を読み取って正直に出す。
function pipeTarget() {
  try {
    const s = fs.readFileSync(path.join(ROOT, 'pokedb.js'), 'utf8');
    const def = (s.match(/DEFAULT_MODE\s*=\s*'([^']+)'/) || [])[1] || null;
    const modes = [...s.matchAll(/^\s*(\w+)\s*:\s*\{\s*file:\s*'([^']+)'/gm)].map(m => ({ mode: m[1], file: m[2] }));
    const cur = modes.find(m => m.mode === def) || null;
    return { default_mode: def, modes, current_file: cur ? cur.file : null };
  } catch (e) { return { default_mode: null, modes: [], current_file: null }; }
}

// ── 5c. ★使っているJSの中身を、この画面で読めるようにする ─────────────
//   阿部さん(2026-07-31)「pokedb.js の中身を確認したい。使っているjsも開けるようにして」
//   ★新しいページは作らない(=本書に埋め込む)。「足りないときは一つのものを広げる」。
//   大きいものは先頭だけ。★黙って切らず「何行中の何行か」を必ず出す。
const SRC_FULL_KB = 60;      // これ以下は全文
const SRC_HEAD_LINES = 80;   // これを超えるものは先頭だけ
// ★行だけで切ると失敗する(2026-07-31 実測): pokechan_data.js は「111行で2.3MB」=1行が巨大。
//   「先頭80行」がほぼ全文になり、生成HTMLが 6.7MB に膨らんだ。→ 文字数でも必ず切る。
const SRC_HEAD_CHARS = 4000;
/**
 * ★JSを「人が読める形」に組み立てる(2026-07-31 阿部さん
 *   「JSファイルやっぱ見てもわからない。人が見てもわかるような感じ、HTMLで整理するとか」)
 *
 * ★方針: 解説を**書かない**(書いた説明は必ず腐る)。
 *   うちのJSは日本語コメントが厚いので、**そのコメントを拾って組み立てる**だけにする。
 *   拾えなかったものは「(説明なし)」と正直に出す=説明が無いファイルが一目で分かる。
 */
function explain(text) {
  const lines = text.split('\n');

  // ① 冒頭のブロックコメント = このファイルは何か
  let head = '';
  const m = text.match(/^\s*(?:#![^\n]*\n)?\s*\/\*([\s\S]*?)\*\//);
  if (m) head = m[1].split('\n').map(l => l.replace(/^\s*\*? ?/, '')).join('\n').trim();
  else {
    const top = [];
    for (const l of lines) {
      if (/^\s*\/\//.test(l)) top.push(l.replace(/^\s*\/\/ ?/, ''));
      else if (top.length) break;
      else if (l.trim()) break;
    }
    head = top.join('\n').trim();
  }

  // ② 区切りコメント(// ── 見出し ──)= 中がどう分かれているか
  const sections = [];
  lines.forEach((l, i) => {
    const s = l.match(/^\s*\/\/\s*[─━=\-–—]{2,}\s*(.+?)\s*[─━=\-–—]{2,}\s*$/)
           || l.match(/^\s*\/\/\s*[─━]+\s*(.+?)\s*$/);
    if (s && s[1] && s[1].length <= 60) sections.push({ line: i + 1, title: s[1] });
  });

  // ③ 名前の付いた処理 + その直前のコメント = 何ができるか
  const parts = [];
  lines.forEach((l, i) => {
    const f = l.match(/^\s*(?:async\s+)?function\s+(\w+)\s*\(/)
           || l.match(/^\s*(?:const|var|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|\w+\s*=>)/)
           || l.match(/^\s*(\w+)\s*:\s*function\s*\(/);
    if (!f) return;
    // 直前の連続コメント(/** */ 1行 or // 行)を拾う
    let note = '';
    for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
      const p = lines[j];
      const jd = p.match(/^\s*\/\*\*\s*(.+?)\s*\*\/\s*$/);
      const sl = p.match(/^\s*\/\/\s*(.+)$/);
      if (jd) { note = jd[1]; break; }
      if (sl) { note = sl[1] + (note ? ' ' + note : ''); continue; }
      if (p.trim() === '') continue;
      break;
    }
    parts.push({ name: f[1], line: i + 1, note });
  });

  // ④ 読む/書く相手(配線)
  const io = new Set();
  for (const re of [
    /require\(\s*['"`]([^'"`]+\.(?:js|json))['"`]/g,
    /readFileSync\([^)]*['"`]([^'"`]+\.(?:js|json|html|md))['"`]/g,
    /writeFileSync\([^)]*['"`]([^'"`]+\.(?:js|json|html|md))['"`]/g,
    /fetch\(\s*[`'"]([^`'"]+)[`'"]/g,
    /src=["']?\s*\+?\s*['"]([\w./\-]+\.js)/g,
    /['"]([\w./\-]+\.(?:js|json))(?:\?[^'"]*)?['"]/g,
  ]) {
    let mm; while ((mm = re.exec(text)) !== null) {
      const v = mm[1];
      if (/^(fs|path|vm|url|http|https|child_process)$/.test(v)) continue;
      io.add(v);
    }
  }
  return { head, sections, parts, io: [...io].slice(0, 24) };
}

function sources() {
  const want = ['pokedb.js', 'internal_home.js', 'move_fx_map.js', 'battle_fx_cues.js',
                'preset_builds.js', 'sprite_api_ids.js', 'items_database.js',
                'fx_primitives.js', 'battle_log_i18n.js',
                'pokechan_data.js', 'pokechan_data_all.js', 'pokedb_v2.js'];
  return want.filter(f => fs.existsSync(path.join(ROOT, f))).map(f => {
    const p = path.join(ROOT, f);
    const st = fs.statSync(p);
    const text = fs.readFileSync(p, 'utf8');
    const lines = text.split('\n');
    const full = st.size <= SRC_FULL_KB * 1024;
    let body = full ? text : lines.slice(0, SRC_HEAD_LINES).join('\n');
    let cutChars = false;
    if (!full && body.length > SRC_HEAD_CHARS) { body = body.slice(0, SRC_HEAD_CHARS); cutChars = true; }
    return {
      file: f, kb: Math.round(st.size / 1024), lines: lines.length, full, cutChars,
      body,
      shown: full ? lines.length : Math.min(SRC_HEAD_LINES, lines.length),
      chars: body.length, totalChars: text.length,
      mtime: st.mtime.toISOString().slice(0, 10),
      // ★人が読める形(コメントから組み立てる)。解説は書かない=腐らせない
      exp: explain(text),
    };
  });
}

// ── 組み立て ───────────────────────────────────────────────────────
const pages = scanPages();
const pipe = pipeTarget();
const srcs = sources();
const srcSet = new Set(srcs.map(s => s.file));
const anchor = f => 'src-' + f.replace(/[^a-zA-Z0-9]/g, '_');
const master = scanMaster();
const builders = scanBuilders();
const guard = guardReport();
const auth = authority();

const direct = pages.filter(p => p.directData.length && !p.viaPokedb);
// ★2026-07-31: 「直読み35」にバックアップが19枚混ざっていて実態が見えなかった(阿部さん把握のため分ける)
const isBak = p => /(^|\/)bak\//.test(p.page) || /\.bak\.html$|_backup|_OLD|OLD_tmp/.test(p.page);
const directLive = direct.filter(p => !isBak(p));
const directBak = direct.filter(isBak);
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

// ★阿部さんの問い「一番のマスターって何なの?」への答えを、最初に置く(2026-07-31)
H.push(`<h2>0. ★一番のマスターは何か(いちばん大事な図)</h2>
<div class="note" style="background:#eef6ff;border-color:#9cc3ea">
<b>マスター(大本)= <code>master/*.json</code> だけです。JSファイルはマスターではありません。</b>
</div>
<table>
<tr><th style="width:26%">層</th><th>もの</th><th>役割</th></tr>
<tr><td><b>① マスター(大本)</b></td>
    <td><code>master/pokemon.json</code> <code>moves.json</code> <code>abilities.json</code> <code>items.json</code> <code>learnsets.json</code></td>
    <td class="ok"><b>★データ本体。直すのはここだけ。</b>器=全国版の範囲 / 値の正典=Champions(<code>champions</code>の印つき)</td></tr>
<tr><td><b>② 配管(参照元1枚)</b></td>
    <td><a href="../pokedb.js" target="_blank"><code>pokedb.js</code></a></td>
    <td><b>データを持っていません。</b>「どこから読むか」を決めるだけの1枚。
        ★いまの供給先 = <code>${esc(pipe.current_file || '不明')}</code>(既定モード <code>${esc(pipe.default_mode || '?')}</code>)
        ${pipe.current_file && !/master/.test(pipe.current_file) ? '<br><b class="bad">★まだ①マスターを向いていません(旧データを向いている)</b>' : ''}</td></tr>
<tr><td><b>③ 旧データ(生成物)</b></td>
    <td>${['pokechan_data.js', 'pokechan_data_all.js', 'items_database.js'].map(f => `<a href="../${f}" target="_blank"><code>${f}</code></a>`).join(' ')}</td>
    <td>①から作られる予定の生成物。<b>手で直さない。</b>いずれ捨てる</td></tr>
<tr><td><b>④ ページ</b></td>
    <td>${pages.length} 枚</td>
    <td>②の配管だけを読むのが決まり。いま②経由=<b>${viaDb.length}枚</b> / ③を直読み=<b class="${direct.length ? 'bad' : 'ok'}">${direct.length}枚</b></td></tr>
</table>
<p><small>★読み方: <b>②が①を向いた瞬間に、②を読んでいる全ページのデータが一斉に切り替わります。</b>
だから「一箇所直せば全部変わる」。逆に③を直読みしているページは、②を直しても<b>変わりません</b>(だから直読みを0枚にする)。</small></p>`);

H.push(`<h2>0b. ひと目で分かる数字</h2><div class="grid">
<div class="card"><div>ページ総数</div><div class="big">${pages.length}</div></div>
<div class="card"><div>参照元1枚(<code>pokedb.js</code>)経由</div><div class="big ${viaDb.length ? 'ok' : 'bad'}">${viaDb.length}</div></div>
<div class="card"><div>データを直読み<br>(★減らす対象・<b>生きているページだけ</b>)</div><div class="big ${directLive.length ? 'bad' : 'ok'}">${directLive.length}</div>
<div><small>ほかに バックアップ ${directBak.length} 枚(数えない)</small></div></div>
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

// ★2026-07-31 阿部さんの指摘で全面的に直した箇所:
//   ① 「✅ マスター経由」は嘘だった(pokedb.jsはマスターでなく配管。しかも今は旧データを向いている)
//   ② ページ名をクリックしたら実物が開くようにする(JSもブラウザで中身が見られる)
//   ③ slice(0,60) の黙った打ち切りをやめる(件数を必ず出す=省略するなら明示する)
// ★生きているページを先に、バックアップは後ろにまとめる(混ぜると実態が見えないため)
const rows2 = [...viaDb, ...directLive, ...directBak];
H.push(`<h2>2. どのページが、どのデータを見ているか <span style="font-size:14px;font-weight:normal">(データを読む ${rows2.length} 枚を全部。省略なし)</span></h2>
<div class="note" style="background:#eef6ff;border-color:#9cc3ea"><b>★追う数字は「生きているページ ${directLive.length} 枚」です。</b>
下の表の後半 ${directBak.length} 枚は <code>bak/</code> などのバックアップで、直す対象ではありません(混ざっていて実態が見えなかったので分けました)。</div>
<p>★決まり: <b>ページは参照元1枚 <a href="../pokedb.js" target="_blank"><code>pokedb.js</code></a> だけを読む</b>。<code>pokechan_data*.js</code> の直読みは禁止。</p>
<div class="note"><b>「経由」は「マスターを見ている」という意味ではありません。</b>
配管(<code>pokedb.js</code>)を通っているというだけで、<b>その配管の先はいま <code>${esc(pipe.current_file || '不明')}</code></b> です。
①マスターに繋ぎ替えるのはこれから(<code>?data=v2</code>)。</div>
<table><tr><th>ページ(クリックで開く)</th><th>読んでいるもの(クリックで中身)</th><th>判定</th></tr>`);
for (const p of rows2) {
  const via = p.viaPokedb;
  const link = (f, label) => `<a href="../${esc(f)}" target="_blank"><code>${esc(label || f)}</code></a>`;
  const reads = via
    ? `${link('pokedb.js')} <small>→ ${esc(pipe.current_file || '?')}</small>`
    : p.directData.map(d => link(d.replace(/\?.*$/, ''), d)).join(' ');
  H.push(`<tr><td>${link(p.page)}</td><td>${reads}${p.dynamicLoad ? ' <small>(document.writeで動的読み込み)</small>' : ''}</td>`
       + `<td class="${via ? 'ok' : 'bad'}">${via ? '✅ 配管(pokedb.js)経由' : '❌ 直読み'}</td></tr>`);
}
H.push(`</table><p><small>※データを読まないページ(${bakedCount}枚)は「生成ページ=データが焼き込まれている」。元データを直したら<b>再生成が必要</b>。</small></p>`);

// ★2026-07-31: 本物と旧を混ぜて並べていたのが「どれがマスターか分からない」原因だったので、表を2つに割る。
const mReal = master.filter(m => m.isReal), mOld = master.filter(m => !m.isReal);
H.push(`<h2>3. マスターデータ(大本)</h2>
<p>★呼び名=<b>マスターデータ</b>。置き場所は <code>master/</code> <b>ただ1つ</b>。<b>直すのはここだけ</b>。</p>
<div class="note" style="background:#eaf7ea;border-color:#8bc98b"><b>★本物はこの ${mReal.length} 本だけです。</b></div>
<table><tr><th>ファイル(生JSON)</th><th>★確認用(人が読める形)</th><th>件数</th><th>サイズ</th><th>最終更新</th></tr>`);
for (const m of mReal) {
  // ★2026-07-31 阿部さん「JSONでパッと見ても何かわからないから、HTMLで見やすくして。横に列を足して」
  const stem = path.basename(m.file, '.json');
  H.push(`<tr><td><a href="../${esc(m.file)}" target="_blank"><code>${esc(m.file)}</code></a></td>`
       + `<td><a href="マスターデータ確認.html?f=${encodeURIComponent(stem)}" target="_blank">📋 ${esc(stem)} を見る</a></td>`
       + `<td><b>${m.count}</b></td><td>${(m.bytes / 1024).toFixed(0)} KB</td><td>${m.mtime}</td></tr>`);
}
H.push(`</table>
<p><small>★<b>確認用</b>= <a href="マスターデータ確認.html" target="_blank"><code>review/マスターデータ確認.html</code></a>。
マスターのJSONを<b>そのまま表にしただけ</b>(登場順・全件・列を隠さない)。加工も並べ替えもしていません。</small></p>`);
if (mOld.length) {
  H.push(`<div class="note"><b class="bad">⚠️ 紛らわしい「旧マスター」が ${mOld.length} 本 残っています。</b>
  これは<b>マスターではありません</b>(<code>master/</code> を作る前の中間ファイル)。
  ★<code>CLAUDE.md</code> には今も「SSOT = <code>reference/master_*.json</code>」と書かれていますが、
  <b>その記述は古い</b>(現在の本物は <code>master/</code>)。<b>消す/CLAUDE.mdを直すかは阿部さんの判断待ち。</b></div>
  <table><tr><th>ファイル</th><th>件数</th><th>最終更新</th></tr>`);
  for (const m of mOld) H.push(`<tr><td><code>${esc(m.file)}</code></td><td>${m.count}</td><td>${m.mtime}</td></tr>`);
  H.push(`</table>`);
}

/** ★JSを「人が読める形」で出す(2026-07-31 阿部さん「JSファイル見てもわからない」)
 *  ★解説は書かない。ファイル内の日本語コメントを拾って組み立てるだけ(書いた説明は腐るため)。
 *  拾えなければ「(このファイルには説明が書かれていません)」と正直に出す。 */
function renderExplain(s) {
  const e = s.exp || { head: '', sections: [], parts: [], io: [] };
  const H = [];
  H.push(`<div style="background:#f4f8ff;border-left:4px solid #6a9fd8;padding:10px 14px;margin:8px 0;border-radius:0 6px 6px 0">`);
  H.push(`<div style="font-weight:bold;margin-bottom:4px">このファイルは何をするもの?</div>`);
  H.push(e.head
    ? `<div style="white-space:pre-wrap;font-size:13px;line-height:1.6">${esc(e.head)}</div>`
    : `<div class="bad">(このファイルには説明が書かれていません — 書き足したほうがよい印)</div>`);
  H.push(`</div>`);

  if (e.io.length) {
    H.push(`<div style="margin:6px 0"><b>つながっている相手(読む/書くファイル)</b><br>`
      + e.io.map(f => `<a href="../${esc(f.replace(/^\.\.\//, ''))}" target="_blank"><code>${esc(f)}</code></a>`).join(' ／ ')
      + `</div>`);
  }
  if (e.sections.length) {
    H.push(`<div style="margin:6px 0"><b>中の区切り(${e.sections.length})</b><ol style="margin:4px 0 0 18px;font-size:13px">`
      + e.sections.map(x => `<li>${esc(x.title)} <span class="cols">(${x.line}行目)</span></li>`).join('')
      + `</ol></div>`);
  }
  if (e.parts.length) {
    const withNote = e.parts.filter(p => p.note).length;
    H.push(`<details style="margin:6px 0"><summary><b>できること(${e.parts.length}個 / 説明つき ${withNote}個)</b></summary>`
      + `<table style="margin-top:6px"><tr><th>名前</th><th>何をするか(ファイル内のコメントから)</th><th>行</th></tr>`
      + e.parts.map(p => `<tr><td><code>${esc(p.name)}</code></td>`
          + `<td>${p.note ? esc(p.note) : '<span class="cols">(説明なし)</span>'}</td>`
          + `<td class="num">${p.line}</td></tr>`).join('')
      + `</table></details>`);
  }
  return H.join('\n');
}

// ★2026-07-31 阿部さん「pokedb.js の中身を確認したい。使っているjsも開けるようにして」
//   → 新しいページを作らず、本書に埋め込む。大きいものは先頭だけ(★何行中の何行かを必ず出す)。
H.push(`<h2>3b. 使っているJSの中身(ここで読める)</h2>
<p>★<b>プログラムが読めなくて大丈夫です。</b>各ファイルの<b>先頭に書いてある日本語の説明を、そのまま抜き出して</b>並べています(★説明は後から書き足したものではないので、実物とズレません)。<br><b>配管まわりの小さいJSは全文</b>、<b>データ本体は大きいので先頭 ${SRC_HEAD_CHARS.toLocaleString()} 文字だけ</b>載せています(全文はファイル名のリンクから)。</p>
<table><tr><th>ファイル</th><th>大きさ</th><th>行数</th><th>ここに載せた範囲</th><th>更新</th></tr>`);
for (const s of srcs) {
  H.push(`<tr><td><a href="#${anchor(s.file)}"><code>${esc(s.file)}</code></a></td>`
       + `<td class="num">${s.kb} KB</td><td class="num">${s.lines}</td>`
       + `<td class="${s.full ? 'ok' : ''}">${s.full ? '全文' : (s.cutChars ? `先頭 ${s.chars.toLocaleString()} 文字 / 全 ${s.totalChars.toLocaleString()} 文字` : `先頭 ${s.shown} 行 / 全 ${s.lines} 行`)}</td>`
       + `<td>${s.mtime}</td></tr>`);
}
H.push(`</table>`);
for (const s of srcs) {
  H.push(`<div class="card" id="${anchor(s.file)}">
  <div><b><a href="../${esc(s.file)}" target="_blank"><code>${esc(s.file)}</code></a></b>
   <span class="cols">${s.kb} KB ／ ${s.lines} 行 ／ ${s.full ? '<b class="ok">全文</b>' : (s.cutChars ? `<b>先頭 ${s.chars.toLocaleString()} 文字だけ</b>(全 ${s.totalChars.toLocaleString()} 文字 ★1行が巨大なため文字数で切った)` : `<b>先頭 ${s.shown} 行だけ</b>(全 ${s.lines} 行)`)}</span></div>
  ${renderExplain(s)}
  <details><summary>プログラムのそのままの中身を見る(読めなくて大丈夫)</summary>
  <pre style="background:#1e1e22;color:#e6e6e6;padding:12px;border-radius:6px;overflow:auto;max-height:70vh;font-size:12px;line-height:1.5">${esc(s.body)}</pre>
  </details></div>`);
}

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
