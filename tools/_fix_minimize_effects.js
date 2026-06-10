/* SSOT修正: 対ちいさくなる(必中+威力2倍)ファミリー6技の記法を統一(2026-06-11 実装時)
 *
 * 背景: 「相手がちいさくなるを使っていると必ず命中し威力2倍」(legacy 6技同旨)なのに記法が4様だった。
 *   のしかかり      : condition target_used_minimize / 威力倍率 phase:this_turn
 *   ヒートスタンプ  : condition target_minimized(←これを標準とする)
 *   フライングプレス: condition target_used + value:"ちいさくなる"
 *   ドラゴンダイブ  : condition target_used_move + kind ダメージ倍率(applies_to:damage)
 *   ヘビーボンバー  : condition target_used_move + kind ダメージ倍率(applies_to:damage・キー順違い)
 *   サンダーダイブ  : condition target_used_move + kind 威力可変に multiplier(威力可変は本来table型)
 * → エンジンに全表記の分岐を足すのでなくデータを揃える(effects-sim-phase-first)。
 *   倍率は全て「威力2倍」に統一(Bulbapedia "Minimize": doubles in power。PS実装も basePower 倍)。
 * ※ゴーストダイブにエントリが無いのは正しい(legacy明記「第7世代以降は必中2倍効果はない」=Bulbapedia一致)。
 *
 * 統一記法:
 *   {"kind": "威力倍率", "target": "self", "phase": "on_use", "multiplier": 2, "condition": {"type": "target_minimized"}}
 *   {"kind": "必中", "target": "opponent", "phase": "on_use", "condition": {"type": "target_minimized"}}
 *
 * compose への影響: ★ドラゴンダイブ/ヘビーボンバー/サンダーダイブは意図的に変わる(穴埋め)。
 *   ダメージ倍率/威力可変(multiplier型)は compose が読めず〔穴〕だった →
 *   威力倍率に統一すると「相手が「ちいさくなる」を使っている時、威力が2倍になる。」が発声され legacy の意味に揃う。
 *   条件タイプ4様の条件文は _cond_render で全て同文(「相手が『ちいさくなる』を使っている時」)=条件文は不変。
 *   実行後に review/waza_compose.html 再生成 + 機械漏れ検知が増えないことを確認すること。
 *
 * 実行: node tools/_fix_minimize_effects.js        … dry-run
 *       node tools/_fix_minimize_effects.js --write … 書き込み
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

let txt = fs.readFileSync(FILE, 'utf8');

const STD_MUL = '{"kind": "威力倍率", "target": "self", "phase": "on_use", "multiplier": 2, "condition": {"type": "target_minimized"}}';
const STD_HIT = '{"kind": "必中", "target": "opponent", "phase": "on_use", "condition": {"type": "target_minimized"}}';

// 生テキストは `"key": value` 形式(コロン・カンマ後にスペース) → 同形式で置換する
// expect = ファイル内の出現数(全置換)。1なら従来どおり一意置換。
const FIXES = [
  { name: 'のしかかり 威力倍率(this_turn/target_used_minimize→統一形)', expect: 1,
    from: '{"kind": "威力倍率", "target": "self", "phase": "this_turn", "multiplier": 2, "condition": {"type": "target_used_minimize"}}',
    to: STD_MUL },
  { name: 'のしかかり 必中(target_used_minimize→統一形)', expect: 1,
    from: '{"kind": "必中", "target": "opponent", "phase": "on_use", "condition": {"type": "target_used_minimize"}}',
    to: STD_HIT },
  { name: 'フライングプレス 威力倍率(target_used→統一形)', expect: 1,
    from: '{"kind": "威力倍率", "target": "self", "phase": "on_use", "multiplier": 2, "condition": {"type": "target_used", "value": "ちいさくなる"}}',
    to: STD_MUL },
  { name: 'フライングプレス 必中(target_used→統一形)', expect: 1,
    from: '{"kind": "必中", "target": "opponent", "phase": "on_use", "condition": {"type": "target_used", "value": "ちいさくなる"}}',
    to: STD_HIT },
  { name: 'ドラゴンダイブ ダメージ倍率(applies_to前置)→威力倍率統一形', expect: 1,
    from: '{"kind": "ダメージ倍率", "target": "opponent", "phase": "on_use", "multiplier": 2, "applies_to": "damage", "condition": {"type": "target_used_move", "value": "ちいさくなる"}}',
    to: STD_MUL },
  { name: 'ヘビーボンバー ダメージ倍率(applies_to後置)→威力倍率統一形', expect: 1,
    from: '{"kind": "ダメージ倍率", "target": "opponent", "phase": "on_use", "multiplier": 2, "condition": {"type": "target_used_move", "value": "ちいさくなる"}, "applies_to": "damage"}',
    to: STD_MUL },
  { name: 'サンダーダイブ 威力可変(multiplier型)→威力倍率統一形', expect: 1,
    from: '{"kind": "威力可変", "target": "opponent", "phase": "on_use", "multiplier": 2, "condition": {"type": "target_used_move", "value": "ちいさくなる"}}',
    to: STD_MUL },
  { name: '必中 target_used_move(ドラゴンダイブ/ヘビーボンバー/サンダーダイブ)→統一形', expect: 3,
    from: '{"kind": "必中", "target": "opponent", "phase": "on_use", "condition": {"type": "target_used_move", "value": "ちいさくなる"}}',
    to: STD_HIT },
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
  console.log(`\n書き込み完了(${FIXES.length}グループ)`);
} else {
  console.log('\n(dry-run: --write で書き込み)');
}
