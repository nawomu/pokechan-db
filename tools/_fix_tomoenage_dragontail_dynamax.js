/** ともえなげ・ドラゴンテール の 強制交代(攻撃) 効果に「ダイマックス相手は交代だけ無効」マーカーを追加。
 *  Bulbapedia裏取り(2026-06-15): Circle Throw / Dragon Tail はダイマックス相手にダメージは通るが交代させられない(追加効果のみ無効=C区分)。
 *  使い方: node tools/_fix_tomoenage_dragontail_dynamax.js        (dry-run)
 *          node tools/_fix_tomoenage_dragontail_dynamax.js --write (書き込み) */
const fs = require('fs'), path = require('path');
const FILE = path.resolve(__dirname, '..', 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

const OLD = `{"kind": "強制交代(攻撃)", "target": "opponent", "phase": "on_use", "replacement": "ランダム"}`;
const NEW = `{"kind": "強制交代(攻撃)", "target": "opponent", "phase": "on_use", "replacement": "ランダム", "no_switch_if_target_dynamax": true}`;

const text = fs.readFileSync(FILE, 'utf8');
const count = text.split(OLD).length - 1;
console.log('対象文字列の一致件数:', count, '(期待=2: ともえなげ・ドラゴンテール)');
if (count !== 2) { console.error('✗ 件数が2でない。中止。'); process.exit(1); }

const next = text.split(OLD).join(NEW);
const m = next.match(/const WAZA_MAP = (\{[\s\S]*?\});\n/);
if (!m) { console.error('✗ WAZA_MAP を切り出せず。中止。'); process.exit(1); }
let parsed;
try { parsed = JSON.parse(m[1]); } catch (e) { console.error('✗ 置換後 WAZA_MAP が JSON.parse 不可。中止:', e.message); process.exit(1); }
const chk = ['ともえなげ', 'ドラゴンテール'].map(nm => {
  const mv = Object.values(parsed).find(x => x.name === nm);
  const ok = (mv.battle_data.effects || []).some(e => e.kind === '強制交代(攻撃)' && e.no_switch_if_target_dynamax === true);
  return `${nm}: マーカー ${ok ? 'あり✓' : 'なし✗'}`;
});
console.log(chk.join(' / '));
if (chk.some(s => s.includes('✗'))) { console.error('✗ 検証失敗。中止。'); process.exit(1); }

if (WRITE) { fs.writeFileSync(FILE, next); console.log('✅ 書き込み完了。'); }
else { console.log('— dry-run(--write で書き込み)。検証は全て通過。'); }
