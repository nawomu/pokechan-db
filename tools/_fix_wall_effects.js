/* SSOT修正: 壁設置4技の effects 記法を統一 + サイコファング 壁除去の screens→values
 *
 * 背景(2026-06-10 壁ファミリー実装時): 壁設置の4エントリで記法がバラバラだった。
 *   リフレクター: value:"reflect"(英語) / reduces:"physical_damage"(文字列) / fraction / doubles:{fraction}
 *   ひかりのかべ: category:"special" / multiplier / multiplier_multi_battle
 *   しんぴのまもり: effect:"…"(散文のみ・構造なし)
 *   オーロラベール: value:"aurora_veil"(英語) / multiplier_single / ignored_by:"critical_hit"(文字列)
 * → エンジンに全表記の分岐を足すのでなくデータを揃える(effects-sim-phase-first / 英語禁止標準)。
 *
 * 統一記法: value=日本語名 / reduces=[…] / multiplier / multiplier_multi / ignored_by=[…] / prevents=[…]
 * compose は壁系キーを一切読まない(grep確認済み)ため説明文出力は不変=ヤックン耳への影響なし。
 *
 * 実行: node tools/_fix_wall_effects.js        … dry-run
 *       node tools/_fix_wall_effects.js --write … 書き込み
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
    name: 'リフレクター',
    from: '{"kind": "壁設置", "value": "reflect", "target": "team", "phase": "lasting", "duration": 5, "reduces": "physical_damage", "fraction": 0.5, "doubles": {"fraction": 0.6667}, "ignored_by": ["critical_hit"], "persists_through_switch": true}',
    to:   '{"kind": "壁設置", "value": "リフレクター", "target": "team", "phase": "lasting", "duration": 5, "reduces": ["physical_damage"], "multiplier": 0.5, "multiplier_multi": 0.6667, "ignored_by": ["critical_hit"], "persists_through_switch": true}',
  },
  {
    name: 'ひかりのかべ',
    from: '{"kind": "壁設置", "target": "team", "phase": "lasting", "duration": 5, "value": "ひかりのかべ", "category": "special", "multiplier": 0.5, "multiplier_multi_battle": 0.6667, "ignored_by": ["critical_hit"], "persists_through_switch": true}',
    to:   '{"kind": "壁設置", "value": "ひかりのかべ", "target": "team", "phase": "lasting", "duration": 5, "reduces": ["special_damage"], "multiplier": 0.5, "multiplier_multi": 0.6667, "ignored_by": ["critical_hit"], "persists_through_switch": true}',
  },
  {
    name: 'しんぴのまもり',
    from: '{"kind": "壁設置", "target": "team", "phase": "lasting", "duration": 5, "value": "しんぴのまもり", "effect": "自分と味方が、状態異常やこんらんにならなくなる", "persists_through_switch": true}',
    to:   '{"kind": "壁設置", "value": "しんぴのまもり", "target": "team", "phase": "lasting", "duration": 5, "prevents": ["状態異常", "こんらん"], "source": "opponent", "persists_through_switch": true}',
  },
  {
    name: 'オーロラベール',
    from: '{"kind": "壁設置", "target": "team", "phase": "lasting", "duration": 5, "value": "aurora_veil", "reduces": ["physical_damage", "special_damage"], "multiplier_single": 0.5, "multiplier_multi": 0.6667, "persists_through_switch": true, "ignored_by": "critical_hit"}',
    to:   '{"kind": "壁設置", "value": "オーロラベール", "target": "team", "phase": "lasting", "duration": 5, "reduces": ["physical_damage", "special_damage"], "multiplier": 0.5, "multiplier_multi": 0.6667, "ignored_by": ["critical_hit"], "persists_through_switch": true}',
  },
  {
    name: 'サイコファング(screens→values)',
    from: '{"kind": "壁除去", "target": "opponent_team", "phase": "on_use", "screens": ["リフレクター", "ひかりのかべ", "オーロラベール"]}',
    to:   '{"kind": "壁除去", "target": "opponent_team", "phase": "on_use", "values": ["リフレクター", "ひかりのかべ", "オーロラベール"]}',
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
