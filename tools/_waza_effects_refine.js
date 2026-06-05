/**
 * 正規化specsへ taxonomy確定事項を適用:
 *  ① set_field→set_terrain統一・terrain value を日本語統一
 *  ② damage_modifier の applies_to:"power" → power_multiplier / ヘビーボンバーの field:"power"誤りを damage へ
 *  ③ バインド系7技を 1つの status 効果に集約
 *  ④ 取りこぼし: みきり(protect貫通) / なみだめ(never_miss) / ふいうち(fails_if)
 * 入力: review/waza_effects_specs_normalized.json → 出力: review/waza_effects_specs_final.json
 * 実行: node tools/_waza_effects_refine.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/waza_effects_specs_normalized.json'), 'utf8'));
const specs = data.specs;
const byName = n => specs.find(s => s.name === n);

const TERR_VAL = { electric_terrain: 'エレキフィールド', psychic_terrain: 'サイコフィールド', grassy_terrain: 'グラスフィールド', misty_terrain: 'ミストフィールド' };

let c1 = 0, c2 = 0, c4 = 0;
for (const s of specs) for (const e of (s.effects || [])) {
  // ① terrain
  if (e.kind === 'set_field') { e.kind = 'set_terrain'; c1++; }
  if ((e.kind === 'set_terrain' || e.kind === 'remove_terrain') && TERR_VAL[e.value]) { e.value = TERR_VAL[e.value]; c1++; }
  // ② power/damage 振分
  if (e.kind === 'damage_modifier' && e.applies_to === 'power') { e.kind = 'power_multiplier'; c2++; }
  if (e.kind === 'damage_modifier' && e.field === 'power') { delete e.field; e.applies_to = 'damage'; c2++; }
}

// ③ バインド集約
const BIND_NAMES = ['しめつける', 'まきつく', 'すなじごく', 'トラバサミ', 'ほのおのうず', 'うずしお', 'まとわりつく'];
const canonBind = () => ({ kind: 'status', target: 'opponent', phase: 'on_use', value: 'バインド', duration: [4, 5], turn_end_damage: 0.125, prevents_switch: true, immune: [{ type: 'target_type', value: 'ゴースト' }] });
let c3 = 0;
for (const n of BIND_NAMES) {
  const s = byName(n); if (!s) { console.log('⚠ バインド技未検出:', n); continue; }
  const keep = (s.effects || []).filter(e => !(e.value === 'バインド' || e.kind === 'chip_damage' || e.kind === 'prevent_switch'));
  s.effects = [canonBind(), ...keep];
  c3++;
}

// ④ 取りこぼし
const mikiri = byName('みきり');
if (mikiri) { const p = (mikiri.effects || []).find(e => e.kind === 'protect'); if (p) { p.partial_bypass = { by: ['ダイマックスわざ', 'Zわざ(攻撃)'], damage_fraction: 0.25 }; c4++; } }
const namidame = byName('なみだめ');
if (namidame) { namidame.effects.push({ kind: 'never_miss', target: 'opponent', phase: 'on_use' }); c4++; }
const fuiuchi = byName('ふいうち');
if (fuiuchi) { fuiuchi.fails_if = [{ type: 'target_not_selecting_attacking_move', note: '相手が攻撃技を選択していない/既に行動済みなら失敗' }]; c4++; }

fs.writeFileSync(path.join(ROOT, 'review/waza_effects_specs_final.json'), JSON.stringify({ specs }, null, 1));
const tally = {};
for (const s of specs) for (const e of (s.effects || [])) tally[e.kind] = (tally[e.kind] || 0) + 1;
console.log('① terrain統一:', c1, '/ ② power振分:', c2, '/ ③ バインド集約:', c3, '/ ④ 取りこぼし:', c4);
console.log('最終 specs:', specs.length, '/ distinct kind:', Object.keys(tally).length);
console.log('set_field残存(0が正常):', specs.flatMap(s => s.effects || []).filter(e => e.kind === 'set_field').length);
