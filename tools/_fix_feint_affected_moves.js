/* SSOT修正: フェイント まもり解除 の affected_moves 先頭「まもり」→ 技名「まもる」に統一(2026-06-11 段61実装時)
 *
 * 背景: フェイントの まもり解除 effect の affected_moves が ["まもり", "みきり", ...] と
 *   技名でない「まもり」で始まっていた(技 WAZA_MAP に「まもり」という技は存在しない=正しくは「まもる」)。
 *   エンジン(phaseApplyEffects の まもり解除 分岐)は protecting の技名と照合するため、
 *   別名分岐をエンジンに足すのでなくデータを技名に揃える(effects-sim-phase-first)。
 *   出典: Bulbapedia "Feint"(Protect=まもる を解除する)。
 *
 * compose への影響: 確認すること(affected_moves を読み上げる場合は文言が「まもり」→「まもる」に変わる)。
 *
 * 実行: node tools/_fix_feint_affected_moves.js        … dry-run
 *       node tools/_fix_feint_affected_moves.js --write … 書き込み
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
    name: 'フェイント まもり解除 affected_moves(まもり→まもる)', expect: 1,
    from: '"removes_protection": true, "affected_moves": ["まもり", "みきり"',
    to:   '"removes_protection": true, "affected_moves": ["まもる", "みきり"',
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
