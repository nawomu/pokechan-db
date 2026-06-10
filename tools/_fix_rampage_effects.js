/* SSOT修正: 暴れるファミリー4技の effects 記法を統一(2026-06-11 暴れる(混乱)ファミリー実装時)
 *
 * 背景: legacy が4技とも同一文(「あばれ状態2〜3ターン→その後1〜4ターンこんらん」)なのに記法が4様だった。
 *   あばれる      : duration_turns + state:"あばれ" / delayed側 duration_turns + 英語trigger散文
 *   はなびらのまい: duration / delayed側 prob:100 + confusion_duration:"1-4"(文字列!) + 廃止キーtiming(英語散文)
 *   げきりん      : duration / delayed側 duration + prob:100 + 英語trigger散文
 *   だいふんげき  : kindが「暴れる(混乱)」ですらなく 状態付与(value:"あばれ") / delayed側 廃止キーtiming(英語散文)
 * → エンジンに全表記の分岐を足すのでなくデータを揃える(effects-sim-phase-first / timing廃止 / 英語散文禁止標準)。
 *
 * 統一記法(4技とも完全同一・legacyも同一文なので情報の損失なし):
 *   {"kind": "暴れる(混乱)", "target": "self", "phase": "lasting", "duration": [2, 3]},
 *   {"kind": "状態付与", "target": "self", "phase": "delayed", "value": "こんらん", "duration": [1, 4], "trigger": "rampage_end"}
 *   trigger は機械可読トークン(phase の on_use 等と同じ扱い)。prob:100 は既定値なので削除。
 * 出典: Bulbapedia "Thrash"/"Petal Dance"/"Outrage"/"Raging Fury"(2〜3ターン暴れ→こんらん。
 *   こんらん期間1〜4ターンは legacy=Champions仕様に従う)
 *
 * compose への影響: compose は「暴れる(混乱)」「duration_turns」「confusion_duration」を読まない(grep確認済み)。
 *   状態付与(delayed)の読み方が変わる可能性があるため、実行後に review/waza_compose.html 再生成 +
 *   git diff で cur列(説明文)不変を確認すること(src列のみの差分=データのエコーは許容)。
 *
 * 実行: node tools/_fix_rampage_effects.js        … dry-run
 *       node tools/_fix_rampage_effects.js --write … 書き込み
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

let txt = fs.readFileSync(FILE, 'utf8');

const STD = '{"kind": "暴れる(混乱)", "target": "self", "phase": "lasting", "duration": [2, 3]}, {"kind": "状態付与", "target": "self", "phase": "delayed", "value": "こんらん", "duration": [1, 4], "trigger": "rampage_end"}';

// 生テキストは `"key": value` 形式(コロン・カンマ後にスペース) → 同形式で置換する
const FIXES = [
  {
    name: 'あばれる(duration_turns/state/英語trigger→統一形)',
    from: '{"kind": "暴れる(混乱)", "target": "self", "phase": "lasting", "duration_turns": [2, 3], "state": "あばれ"}, {"kind": "状態付与", "target": "self", "phase": "delayed", "value": "こんらん", "duration_turns": [1, 4], "trigger": "when the rampage ends"}',
    to:   STD,
  },
  {
    name: 'はなびらのまい(prob/confusion_duration文字列/廃止timing→統一形)',
    from: '{"kind": "暴れる(混乱)", "target": "self", "phase": "lasting", "duration": [2, 3]}, {"kind": "状態付与", "target": "self", "phase": "delayed", "value": "こんらん", "prob": 100, "confusion_duration": "1-4", "timing": "after the thrashing turns end"}',
    to:   STD,
  },
  {
    name: 'げきりん(prob/英語trigger→統一形)',
    from: '{"kind": "暴れる(混乱)", "target": "self", "phase": "lasting", "duration": [2, 3]}, {"kind": "状態付与", "target": "self", "phase": "delayed", "value": "こんらん", "duration": [1, 4], "prob": 100, "trigger": "after the rampage ends"}',
    to:   STD,
  },
  {
    name: 'だいふんげき(状態付与"あばれ"→kind統一/廃止timing→統一形)',
    from: '{"kind": "状態付与", "target": "self", "phase": "on_use", "value": "あばれ", "duration": [2, 3]}, {"kind": "状態付与", "target": "self", "phase": "delayed", "value": "こんらん", "duration": [1, 4], "timing": "after the thrash lock ends"}',
    to:   STD,
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
