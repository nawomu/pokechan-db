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
 *
 * ★基準を上げて通すのは禁止(CLAUDE.md と同じ規律)。増やすなら台帳に
 *   「なぜ既存を広げられないのか」を1行書く。書かないと通らない。
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

const pages = handmadePages();
const direct = directReaders(pages);

let ledger = null;
try { ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch (e) {}

if (process.argv.includes('--accept')) {
  const roles = {};
  (ledger && ledger.pages || []).forEach(p => { roles[p.page] = p; });
  const next = {
    note: '★ページの台帳。新しいページを増やす時は、ここに「なぜ既存を広げられないのか」を書く。' +
          '書かないと tools/_page_guard_test.js が赤くなる。',
    accepted_at: new Date().toISOString().slice(0, 10),
    allow_direct: direct.map(d => d.page),
    pages: pages.map(p => roles[p] || { page: p, role: '(未記入)', why_new: '(未記入)' }),
  };
  fs.writeFileSync(LEDGER, JSON.stringify(next, null, 1) + '\n');
  console.log(`✅ 台帳を更新: ${pages.length} ページ / 直読み許容 ${next.allow_direct.length} 件 → ${path.relative(ROOT, LEDGER)}`);
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

console.log('');
if (ng) { console.log(`❌ ${ng} 件で赤。★基準を上げて通すのは禁止。`); process.exit(1); }
console.log('✅ 悪化なし。');
