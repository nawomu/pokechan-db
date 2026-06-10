/* SSOT修正: てっていこうせんのHPコストに端数処理を宣言(2026-06-11 HPが減るファミリー実装時)
 *
 * 背景: HPコストの端数は技ごとに違う。
 *   はらだいこ(半分・切り捨て) / てっていこうせん(半分・★切り上げ)
 *   出典: Bulbapedia "Belly Drum"(rounded down) / "Steel Beam"(rounded up)
 * → エンジンに技名分岐を足すのでなくデータに宣言する(effects-sim-phase-first)。
 *   宣言なし=切り捨て(既定)。てっていこうせんだけ "rounding": "up" を持つ。
 *
 * compose への影響: compose は rounding キーを読まない(未知キーは無視)ため説明文出力は不変。
 *   実行後に review/waza_compose.html 再生成 + git diff ゼロで確認すること。
 *
 * 実行: node tools/_fix_steelbeam_rounding.js        … dry-run
 *       node tools/_fix_steelbeam_rounding.js --write … 書き込み
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

let txt = fs.readFileSync(FILE, 'utf8');

// 生テキストは `"key": value` 形式(コロン・カンマ後にスペース) → 同形式で置換する
const FIXES = [
  {
    name: 'てっていこうせん(HPコスト半分=切り上げを宣言)',
    from: '{"kind": "HPが減る", "target": "self", "phase": "on_use", "fraction": 0.5, "always_pays_even_if_blocked": true}',
    to:   '{"kind": "HPが減る", "target": "self", "phase": "on_use", "fraction": 0.5, "rounding": "up", "always_pays_even_if_blocked": true}',
  },
];

let ok = true;
for (const f of FIXES) {
  const i = txt.indexOf(f.from);
  if (i < 0) { console.log(`❌ ${f.name}: 置換対象が見つからない`); ok = false; continue; }
  if (txt.indexOf(f.from, i + 1) >= 0) { console.log(`❌ ${f.name}: 置換対象が複数`); ok = false; continue; }
  txt = txt.slice(0, i) + f.to + txt.slice(i + f.from.length);
  console.log(`✅ ${f.name}: 置換OK`);
}
if (!ok) { console.log('中断(書き込みなし)'); process.exit(1); }

if (WRITE) {
  fs.writeFileSync(FILE, txt);
  console.log(`\n書き込み完了(${FIXES.length}件)`);
} else {
  console.log('\n(dry-run: --write で書き込み)');
}
