#!/usr/bin/env node
/* tools/_page_guard_test.js — ★ページの番人(忘れても赤くなる仕組み)
 *
 * なぜ要るか(2026-07-31 阿部さん):
 *   「なんか作る時に、もうパッと新しく作っちゃう。確認しないで作っちゃう癖なんだよね。
 *    でもプログラムを作る場合って絶対 元を意識しなきゃいけないのに、その意識がいつまでたってもない。
 *    やっぱりMDに書いておいた方がいいのかな。**それでも忘れるのかな**。」
 *
 * ★答え: 忘れる。実測済み。
 *   同日、Claudeは CLAUDE.md に「足りないときは一つのものを広げる」と**自分で書いた1時間後に**、
 *   `data_browser.html` があるのに `review/マスターデータ確認.html` を新しく作った。
 *   → **文章のルールでは止まらない。赤くなる物だけが止める。**
 *
 * この番人が見張るもの:
 *   G1 データ直読み  … ページが pokechan_data*.js / items_database.js / master/*.json を直接読んでいないか
 *   G2 ページ増加    … 手作りページが台帳(_page_ledger.json)より増えていないか
 *   G3 参照元の重複  … 同じ仕事のページが2枚ないか(台帳の role が重複していないか)
 *   G4 事実の表の直書き … TYPE_CHART / ABILITY_TYPE_IMMUNITY / NATURE(S)?_(ARR|LIST|TABLE) / LEGACY_FORM_NAME
 *                        のような「事実の表」を master/ 以外で新しく定義していないか(2026-09-04 拡張・
 *                        review/_page_data_audit_r2_2026-09-04.md ③A。_gen_content_pages.js の TYPE_CHART
 *                        直書き重複が網の外だった=この検出があれば初日に見つかっていた)
 *   G5 旧マスター参照   … reference/_old_master/README.md が挙げる10ファイルへの require/readFileSync/
 *                        writeFileSync を、安全弁(ALLOW_OLD_MASTER_WRITE)が同じファイルに無い限り検出
 *                        (2026-09-04 拡張・同③B)
 *   G4/G5 の走査対象 = tools/**\/*.js + root直下の *.js も含む(2026-09-04 拡張・同③C。
 *                      G1〜G3 は従来どおり手作りページ(.html)だけを見る)
 *
 * ★基準を上げて通すのは禁止(CLAUDE.md と同じ規律)。増やすなら台帳に
 *   「なぜ既存を広げられないのか」を1行書く。書かないと通らない。
 *   ★G4/G5 も同じ規律: 既知の現状(このコミット時点で見つかっている分)は台帳の
 *   allow_fact_table / allow_old_master_ref に理由つきで記録して現状維持=緑にする。
 *   これは隠蔽ではなく「今ここまでは分かっている」の記録(CLAUDE.md「基準を上げて通すのは禁止」の実践)。
 *   新規に増えた分だけが赤くなる。
 *
 * 実行: node tools/_page_guard_test.js
 *       node tools/_page_guard_test.js --accept   … ★阿部さんが承認した時だけ台帳を今に更新
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const LEDGER = path.join(ROOT, 'reference/_page_ledger.json');
// バックアップ・生成物・言語別ページ・取得した生素材(_genus_material=Wiki/Bulbapediaの写し)は対象外(手作りページだけを見る)
// バックアップ・生成物・言語別ページは対象外(手作りページだけを見る)
const SKIP_DIR = /(^|\/)(\.git|node_modules|bak|_review|backup|_genus_material|content|pokemon|ability|move|type|item|en|fr|de|es|it|ko|zh-Hans|zh-Hant|scratchpad)(\/|$)/;
const SKIP_FILE = /\.bak\.html$|_backup|_OLD|OLD_tmp/;

function handmadePages() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = path.relative(ROOT, p);
      if (e.isDirectory()) { if (!SKIP_DIR.test(rel + '/') && !e.name.startsWith('.')) walk(p); continue; }
      if (!e.name.endsWith('.html')) continue;
      if (SKIP_DIR.test(rel) || SKIP_FILE.test(rel)) continue;
      out.push(rel);
    }
  })(ROOT);
  return out.sort();
}

function directReaders(pages) {
  const bad = [];
  for (const rel of pages) {
    let s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    // ★<pre> の中は「表示しているだけ」で読み込んでいない(2026-07-31 実機で誤検知)。
    //   内部構造仕様書は他のJSの中身を埋め込んで見せているので、そのまま検査すると全部“直読み”になる。
    s = s.replace(/<pre[\s\S]*?<\/pre>/g, '');
    const hits = [];
    if (/src\s*=\s*["'][^"']*pokechan_data(_all)?\.js/.test(s)) hits.push('pokechan_data*.js');
    if (/src\s*=\s*["'][^"']*items_database\.js/.test(s)) hits.push('items_database.js');
    // document.write で組み立てている場合も拾う(★これを見落として battle_lab が表から消えていた)
    if (/document\.write/.test(s) && /['"]pokechan_data(_all)?\.js/.test(s)) hits.push('pokechan_data*.js(動的)');
    // ページから master を直読みするのも禁止(検査用の道具は台賬で除外する)
    if (/fetch\(\s*[`'"][^`'"]*master\/\w+\.json/.test(s)) hits.push('master/*.json(直読み)');
    if (hits.length) bad.push({ page: rel, reads: hits });
  }
  return bad;
}

// ★G4/G5(2026-09-04拡張)用: tools/**/*.js + root直下 *.js を歩く。
//   G1〜G3(手作りページ=.html)とは別の走査対象(review/_page_data_audit_r2_2026-09-04.md ③C)。
const SKIP_JS_DIR = /(^|\/)(\.git|node_modules|_review|backup|bak|_genus_material|scratchpad|\.codex|_old_master|_legacy_snapshot)(\/|$)/;
function jsFiles() {
  const out = [];
  const toolsDir = path.join(ROOT, 'tools');
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = path.relative(ROOT, p);
      if (e.isDirectory()) { if (!SKIP_JS_DIR.test(rel + '/') && !e.name.startsWith('.')) walk(p); continue; }
      if (e.name.endsWith('.js')) out.push(rel);
    }
  })(toolsDir);
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.js')) out.push(e.name);
  }
  // ★番人自身は除外(このファイルのコメント/正規表現ソースに識別子名が literal で出るため自己誤検知する)
  return out.filter(rel => rel !== 'tools/_page_guard_test.js').sort();
}

// ★G4: 「事実の表」の直書き検出。参照(RHSが識別子/プロパティアクセス)ではなく、
//   「新しく定義している」形(= [ か = { で始まる代入)だけを拾う。
//   例: `const TYPE_CHART = [...]`(引っかかる) / `const TYPE_CHART = MASTER.meta.tables.TYPE_CHART;`(引っかからない)
const FACT_TABLE_RE = /\b(TYPE_CHART|ABILITY_TYPE_IMMUNITY|NATURES?_(?:ARR|LIST|TABLE)|LEGACY_FORM_NAME)\s*=\s*[\[{]/g;
function factTableHits(htmlPages, jsPages) {
  const out = [];
  const scanOne = (rel, isHtml) => {
    let s;
    try { s = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return; }
    if (isHtml) s = s.replace(/<pre[\s\S]*?<\/pre>/g, ''); // ★仕様書等のコード引用は除外(G1と同じ理由)
    const seen = new Set();
    FACT_TABLE_RE.lastIndex = 0;
    let m;
    while ((m = FACT_TABLE_RE.exec(s))) { if (!seen.has(m[1])) { seen.add(m[1]); out.push({ file: rel, table: m[1] }); } }
  };
  htmlPages.forEach(p => scanOne(p, true));
  jsPages.forEach(p => scanOne(p, false));
  return out;
}

// ★G5: 旧マスター(reference/_old_master/README.md が挙げる10ファイル)への参照検出。
//   同じファイルに ALLOW_OLD_MASTER_WRITE の明示ガード(_fetch_pokeapi_masters.js方式)があれば安全弁ありとして除外。
const OLD_MASTER_NAMES = ['moves_master.json', 'pokeapi_master.json', 'items_master.json', 'abilities_master.json',
  'learnsets_master.json', 'master_pokemon.json', 'master_moves.json', 'master_abilities.json',
  'master_items.json', '_verify_master.json'];
const OLD_MASTER_RE = new RegExp('(?:require|readFileSync|writeFileSync)\\s*\\([^)]*?(' +
  OLD_MASTER_NAMES.map(n => n.replace(/\./g, '\\.')).join('|') + ')', 'g');
function oldMasterHits(jsPages) {
  const out = [];
  for (const rel of jsPages) {
    let s;
    try { s = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { continue; }
    if (/ALLOW_OLD_MASTER_WRITE/.test(s)) continue; // 安全弁あり=OK
    OLD_MASTER_RE.lastIndex = 0;
    const names = new Set();
    let m;
    while ((m = OLD_MASTER_RE.exec(s))) names.add(m[1]);
    if (names.size) out.push({ file: rel, names: [...names].sort() });
  }
  return out;
}

const pages = handmadePages();
const direct = directReaders(pages);
const jsPages = jsFiles();
const factTables = factTableHits(pages, jsPages);
const oldMasterRefs = oldMasterHits(jsPages);

let ledger = null;
try { ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch (e) {}

if (process.argv.includes('--accept')) {
  const roles = {};
  (ledger && ledger.pages || []).forEach(p => { roles[p.page] = p; });
  // ★G4/G5は理由つきの許容リストにする(既存項目の理由(why)は引き継ぐ・新規は「(未記入・要理由)」)。
  const prevFT = new Map((ledger && ledger.allow_fact_table || []).map(x => [x.file + '::' + x.table, x.why]));
  const prevOM = new Map((ledger && ledger.allow_old_master_ref || []).map(x => [x.file, x.why]));
  const next = {
    note: '★ページの台帳。新しいページを増やす時は、ここに「なぜ既存を広げられないのか」を書く。' +
          '書かないと tools/_page_guard_test.js が赤くなる。' +
          ' allow_fact_table/allow_old_master_ref も同じ規律(G4/G5・2026-09-04拡張): why欄に理由を書く。',
    accepted_at: new Date().toISOString().slice(0, 10),
    allow_direct: direct.map(d => d.page),
    pages: pages.map(p => roles[p] || { page: p, role: '(未記入)', why_new: '(未記入)' }),
    allow_fact_table: factTables.map(x => ({ file: x.file, table: x.table, why: prevFT.get(x.file + '::' + x.table) || '(未記入・要理由)' })),
    allow_old_master_ref: oldMasterRefs.map(x => ({ file: x.file, names: x.names, why: prevOM.get(x.file) || '(未記入・要理由)' })),
  };
  fs.writeFileSync(LEDGER, JSON.stringify(next, null, 1) + '\n');
  console.log(`✅ 台帳を更新: ${pages.length} ページ / 直読み許容 ${next.allow_direct.length} 件 / ` +
    `事実の表 許容 ${next.allow_fact_table.length} 件 / 旧マスター参照 許容 ${next.allow_old_master_ref.length} 件 → ${path.relative(ROOT, LEDGER)}`);
  process.exit(0);
}

console.log('=== ページの番人 ===');
let ng = 0;

// G1: データ直読み
const allow = new Set((ledger && ledger.allow_direct) || []);
const newDirect = direct.filter(d => !allow.has(d.page));
console.log(`\nG1 データの直読み: ${direct.length} 件(台帳で許容済み ${direct.length - newDirect.length} 件)`);
if (newDirect.length) {
  ng++;
  console.log('  ❌ 台帳に無い直読みが増えました(★ページは pokedb.js だけを読む決まり):');
  newDirect.forEach(d => console.log(`     ${d.page}  ← ${d.reads.join(' / ')}`));
} else {
  console.log('  ✅ 新しい直読みなし');
}

// G2: ページの増加
const known = new Set((ledger && ledger.pages || []).map(p => p.page));
const added = pages.filter(p => !known.has(p));
console.log(`\nG2 手作りページ: ${pages.length} 枚(台帳 ${known.size} 枚)`);
if (!ledger) {
  console.log('  ⚠ 台帳がまだありません。`node tools/_page_guard_test.js --accept` で作ってください。');
} else if (added.length) {
  ng++;
  console.log('  ❌ 台帳に無いページが増えました:');
  added.forEach(p => console.log(`     ${p}`));
  console.log('  ★増やす前に「同じ仕事をしているページ」を探しましたか?');
  console.log('    足りないときは、一つのものを広げる(CLAUDE.md「新しいページを作る時の絶対手順」)。');
  console.log('    どうしても要るなら reference/_page_ledger.json に why_new を1行書いて --accept。');
} else {
  console.log('  ✅ 増えていない');
}

// G3: 役割の重複(同じ仕事のページが2枚ないか)
if (ledger) {
  const byRole = {};
  (ledger.pages || []).forEach(p => {
    if (!p.role || p.role === '(未記入)') return;
    (byRole[p.role] = byRole[p.role] || []).push(p.page);
  });
  const dup = Object.entries(byRole).filter(([, v]) => v.length > 1);
  console.log(`\nG3 役割の重複: ${dup.length} 件`);
  if (dup.length) {
    ng++;
    dup.forEach(([r, v]) => console.log(`  ❌ 「${r}」が ${v.length} 枚: ${v.join(' / ')}`));
  } else {
    console.log('  ✅ 同じ仕事のページは重複していない');
  }
  const blank = (ledger.pages || []).filter(p => !p.role || p.role === '(未記入)').length;
  if (blank) console.log(`  ⚠ 役割が未記入のページ ${blank} 枚(埋めるほど重複を検知できる)`);
}

// G4: 事実の表の直書き(新規出現だけ赤・2026-09-04拡張)
const allowFT = new Set((ledger && ledger.allow_fact_table || []).map(x => x.file + '::' + x.table));
const newFT = factTables.filter(x => !allowFT.has(x.file + '::' + x.table));
console.log(`\nG4 事実の表(TYPE_CHART等)の直書き: ${factTables.length} 件(台帳で許容済み ${factTables.length - newFT.length} 件)`);
if (newFT.length) {
  ng++;
  console.log('  ❌ 台帳に無い「事実の表」の直書きが増えました(master/ を広げるか既存の表を再利用してください):');
  newFT.forEach(x => console.log(`     ${x.file}  ← ${x.table}`));
} else {
  console.log('  ✅ 新しい直書きなし');
}

// G5: 旧マスター(reference/_old_master/)参照(新規出現だけ赤・2026-09-04拡張)
const allowOM = new Set((ledger && ledger.allow_old_master_ref || []).map(x => x.file));
const newOM = oldMasterRefs.filter(x => !allowOM.has(x.file));
console.log(`\nG5 旧マスター参照(reference/_old_master/README.md 記載の10ファイル): ${oldMasterRefs.length} 件` +
  `(台帳で許容済み ${oldMasterRefs.length - newOM.length} 件・うち安全弁ありは検出対象外)`);
if (newOM.length) {
  ng++;
  console.log('  ❌ 台帳に無い旧マスター参照が増えました(本物のマスターは master/*.json だけ。' +
    'ALLOW_OLD_MASTER_WRITE のような明示ガードを付けるか、参照先を master/ に直してください):');
  newOM.forEach(x => console.log(`     ${x.file}  ← ${x.names.join(' / ')}`));
} else {
  console.log('  ✅ 新しい旧マスター参照なし');
}

console.log('');
if (ng) { console.log(`❌ ${ng} 件で赤。★基準を上げて通すのは禁止。`); process.exit(1); }
console.log('✅ 悪化なし。');
