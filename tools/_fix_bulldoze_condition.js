/* SSOT修正: じならし の威力倍率条件の記法を じしん と統一(2026-06-11 条件威力倍率ファミリー実装時)
 *
 * 背景: 「グラスフィールドで威力半減」が2技で記法が違った。
 *   じしん  : {"type": "field", "value": "グラスフィールド"}
 *   じならし: {"type": "field_is", "value": "グラスフィールド"}
 * → 意味は同一。エンジン(calcDamage の fieldMul)と _cond_render は field を読む
 *   (field_is は _cond_render に同文の別名がいるだけ)。一意な記法に揃える(effects-sim-phase-first)。
 * ※実効はどちらも「場側ルール(グラスフィールドの 場の威力補正 moves: じしん/じならし/マグニチュード)」が
 *   半減を担当し技側はスキップされる=エンジン挙動は不変(テスト T138 で固定済)。
 *
 * compose への影響: _cond_render の field / field_is は同文(「場が『…』の時」)のため出力不変。
 *   実行後に review/waza_compose.html 再生成 + git diff ゼロで確認すること。
 *
 * 実行: node tools/_fix_bulldoze_condition.js        … dry-run
 *       node tools/_fix_bulldoze_condition.js --write … 書き込み
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
    name: 'じならし(field_is→field=じしんと同形に統一)',
    from: '"condition": {"type": "field_is", "value": "グラスフィールド"}',
    to:   '"condition": {"type": "field", "value": "グラスフィールド"}',
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
