/* SSOT修正: たたりめ の威力倍率条件の記法を ひゃっきやこう と統一(2026-06-11 状態異常条件の威力倍率実装時)
 *
 * 背景: 「相手が状態異常なら何でも威力2倍」(Hex系)が2技で記法が違った。
 *   たたりめ      : {"type": "target_has_status", "value": "any_non_volatile_status"}(英語トークンが値に!)
 *   ひゃっきやこう: {"type": "target_has_status_condition"}(値なし=状態異常なら何でも)
 * → 意味は同一(Bulbapedia "Hex"/"Infernal Parade": doubles if the target has a status condition)。
 *   エンジンに両表記の分岐を足すのでなくデータを揃える(effects-sim-phase-first / 英語トークン禁止標準)。
 *
 * compose への影響: ★意図的に変わる(機械漏れの修正)。
 *   旧: 「相手が「any_non_volatile_status」状態のとき、威力が2倍になる。」← compose自身の機械漏れ検知で🔴
 *   新: 「相手が状態異常のとき、威力が2倍になる。」(ひゃっきやこうと同文・日本語のみ)
 *   実行後に review/waza_compose.html 再生成 + git diff で「たたりめの行だけが上記の変化」かつ
 *   機械漏れ検知が 3件→2件 になることを確認すること。
 *
 * 実行: node tools/_fix_hex_condition.js        … dry-run
 *       node tools/_fix_hex_condition.js --write … 書き込み
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
    name: 'たたりめ(英語トークン値→ひゃっきやこうと同じ値なし記法に統一)',
    from: '"condition": {"type": "target_has_status", "value": "any_non_volatile_status"}',
    to:   '"condition": {"type": "target_has_status_condition"}',
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
