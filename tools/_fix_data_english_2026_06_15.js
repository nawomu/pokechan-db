// データ側の英語残りを構造化フィールドに置換(2026-06-15)。
// 対象:
//   1. ちからをすいとる effects[0].amount = "equal to target's current Attack stat value"
//      → { type: 'target_stat', stat: 'attack' }
//   2. どくびし effects[1].trigger = "a grounded Poison-type Pokemon switches in on this side"
//      → 削除し auto_removed_by: { type:'poke_type_switch_in', poke_type:'どく' } を追加
// 安全手順: dry-run→件数アサート→--write
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

const src = fs.readFileSync(FILE, 'utf8');

// 1. ちからをすいとる: amount の英文字列を構造化に置換(コロン後にスペースあり=pretty-print形式)
const OLD1 = '"amount": "equal to target\'s current Attack stat value"';
const NEW1 = '"amount": {"type": "target_stat", "stat": "attack"}';
const c1 = (src.match(new RegExp(OLD1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

// 2. どくびし: trigger削除 + auto_removed_by挿入
const OLD2 = '"value": "どくびし", "trigger": "a grounded Poison-type Pokemon switches in on this side"';
const NEW2 = '"value": "どくびし", "auto_removed_by": {"type": "poke_type_switch_in", "poke_type": "どく"}';
const c2 = (src.match(new RegExp(OLD2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

console.log(`[dry-run] ちからをすいとる amount: ${c1} 件 (期待=1)`);
console.log(`[dry-run] どくびし trigger→auto_removed_by: ${c2} 件 (期待=1)`);

if (c1 !== 1 || c2 !== 1) {
  console.error('件数アサート失敗。データ側の文字列が想定と一致しない。中断。');
  process.exit(1);
}

if (!WRITE) {
  console.log('\ndry-run 完了。--write で書き込む。');
  process.exit(0);
}

let next = src.split(OLD1).join(NEW1);
next = next.split(OLD2).join(NEW2);

// JSON 検証(WAZA_MAP のみ)
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
try { JSON.parse(lit(next, 'const WAZA_MAP =')); } catch (e) { console.error('JSON検証失敗:', e.message); process.exit(1); }

fs.writeFileSync(FILE, next);
console.log('\n書き込み完了。');
