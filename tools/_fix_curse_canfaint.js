/* SSOT修正: のろい(ゴースト)のHPコストに「HP不足でも実行する」を宣言(2026-06-11 継続削りファミリー実装時)
 *
 * 背景: HPコスト技は2種類ある。
 *   はらだいこ/ソウルビート等: HPがコスト以下なら技ごと失敗(支払いなし)
 *   のろい(ゴースト): HPが足りなくても実行し、自分はひんしになる。それでも相手にのろいは付く
 *   出典: Bulbapedia "Curse" ("If this causes the user's HP to drop to 0, the move will
 *         execute fully but cause the user to faint")
 * → エンジンに技名分岐を足すのでなくデータに宣言する(effects-sim-phase-first)。
 *   宣言なし=HP不足で失敗(既定)。のろいだけ "can_faint_self": true を持つ。
 *
 * compose への影響: compose は can_faint_self キーを読まない(未知キーは無視)ため説明文出力は不変。
 *   実行後に review/waza_compose.html 再生成 + git diff ゼロで確認すること。
 *
 * 実行: node tools/_fix_curse_canfaint.js        … dry-run
 *       node tools/_fix_curse_canfaint.js --write … 書き込み
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
    name: 'のろい(HP不足でも実行=自分がひんしになることを宣言)',
    from: '{"kind": "HPが減る", "target": "self", "phase": "on_use", "fraction": 0.5, "condition": {"type": "user_type", "value": "ゴースト"}}',
    to:   '{"kind": "HPが減る", "target": "self", "phase": "on_use", "fraction": 0.5, "can_faint_self": true, "condition": {"type": "user_type", "value": "ゴースト"}}',
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
