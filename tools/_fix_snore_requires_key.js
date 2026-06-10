/* SSOT修正: いびき requires のキー user_status → self_status に統一(2026-06-11 段70実装時)
 *
 * 背景: 「自分がねむり状態の時だけ使える」条件のキーが いびき=user_status / ねごと=self_status と
 *   2様に割れていた(該当は全490技中この2技のみ)。エンジン(requires self_status ゲート)は
 *   self_status を読むため、別名分岐をエンジンに足すのでなくデータを揃える(effects-sim-phase-first)。
 *   標準は self_status(対象呼称の規約 self/opponent と整合)。
 *   出典: Bulbapedia "Snore"(自分がねむっている時だけ使える)。
 *
 * compose への影響: なし(_waza_compose.js は requires を読まない=grepで確認済み)。
 *
 * 実行: node tools/_fix_snore_requires_key.js        … dry-run
 *       node tools/_fix_snore_requires_key.js --write … 書き込み
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
    name: 'いびき requires(user_status→self_status)', expect: 1,
    from: '{"type": "user_status", "value": "ねむり"}',
    to:   '{"type": "self_status", "value": "ねむり"}',
  },
];

let ok = true;
for (const f of FIXES) {
  const parts = txt.split(f.from);
  const n = parts.length - 1;
  if (n !== f.expect) { console.log(`❌ ${f.name}: 出現${n}件(期待${f.expect})`); ok = false; continue; }
  txt = parts.join(f.to);
  console.log(`✅ ${f.name}: ${n}件置換OK`);
}
if (!ok) { console.log('中断(書き込みなし)'); process.exit(1); }

if (WRITE) {
  fs.writeFileSync(FILE, txt);
  console.log(`\n書き込み完了(${FIXES.length}件)`);
} else {
  console.log('\n(dry-run: --write で書き込み)');
}
