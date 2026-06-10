/* SSOT修正: きんぞくおん battle_data に "substitute_pierce": true を追加(2026-06-11 段78実装時)
 *
 * 背景: みがわり貫通の正キーは battle_data.substitute_pierce(全DB調査: 21技が宣言)。
 *   相手対象の音技(flags.sound)で唯一きんぞくおんだけ top キーが無かった
 *   (同型のいやなおと=とくぼう版の兄弟技は宣言あり)。エンジン(piercesSub)は
 *   substitute_pierce を読むため、別名分岐をエンジンに足すのでなくデータを揃える
 *   (effects-sim-phase-first)。
 *   出典: Bulbapedia "Substitute"(第6世代以降、音技はみがわりを素通りする)/"Metal Sound"。
 *
 * compose への影響: なし(_waza_compose.js は substitute_pierce / みがわり を読まない=grepで確認済み)。
 *
 * 実行: node tools/_fix_metal_sound_sub_pierce.js        … dry-run
 *       node tools/_fix_metal_sound_sub_pierce.js --write … 書き込み
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

let txt = fs.readFileSync(FILE, 'utf8');

// 生テキストは `"key": value` 形式(コロン・カンマ後にスペース) → 同形式で挿入する
// (位置は いやなおと と同じ crit_changes 直後)
const FIXES = [
  {
    name: 'きんぞくおん substitute_pierce 追加', expect: 1,
    from: '"音系の技。相手の『とくぼう』ランクを2段階下げる。", "battle_data": {"crit_stage": 0, "must_crit": false, "crit_changes": [], "rank_changes"',
    to:   '"音系の技。相手の『とくぼう』ランクを2段階下げる。", "battle_data": {"crit_stage": 0, "must_crit": false, "crit_changes": [], "substitute_pierce": true, "rank_changes"',
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
