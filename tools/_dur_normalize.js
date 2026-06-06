/* duration 正規化: 範囲文字列→[min,max] / 継続系英語→和文enum。simは読まない(表示のみ)。
 * dry-run(既定)→ --apply で backup→書込→検証。実行: node tools/_dur_normalize.js [--apply] */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), FILE = path.join(ROOT, 'pokechan_data.js');
const APPLY = process.argv.includes('--apply');
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return { lit: t.slice(s, i + 1), start: s, end: i + 1 }; } } } }
function ser(v) { if (v === null) return 'null'; if (Array.isArray(v)) return '[' + v.map(ser).join(', ') + ']'; if (typeof v === 'object') return '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + ser(x)).join(', ') + '}'; return JSON.stringify(v); }

// 正規化マップ: 範囲文字列→配列 / 継続系英語→和文enum
const MAP = {
  '1-4 turns': [1, 4], '1-4': [1, 4], '2-3 turns': [2, 3], '2-3': [2, 3],
  'until_user_leaves': '自分が場を離れるまで',
  'until_removed': '消えるまで',
  'until_effect_removed': '消えるまで',
  'until_target_leaves': '相手が場を離れるまで',
  'until_destroyed': 'こわれるまで',
  'while_target_remains': '相手が場にいるあいだ',
  'until_user_or_target_leaves': 'どちらかが場を離れるまで',
  'until_end_of_next_turn': '次のターンの終わりまで',
  'until_this_move_activates': 'この技が出るまで',
};

const src = fs.readFileSync(FILE, 'utf8');
const M = lit(src, 'const WAZA_MAP =');
const map = JSON.parse(M.lit);
const log = [], unmapped = [];
for (const m of Object.values(map)) {
  for (const e of ((m.battle_data || {}).effects || [])) {
    if (typeof e.duration === 'string') {
      if (MAP[e.duration] !== undefined) { log.push(`${m.name}: "${e.duration}" → ${JSON.stringify(MAP[e.duration])}`); e.duration = MAP[e.duration]; }
      else unmapped.push(`${m.name}: "${e.duration}"`);
    }
  }
}
console.log(`\n=== duration 正規化 ${APPLY ? '適用' : 'DRY-RUN'} ===\n変更 ${log.length} 件`);
log.forEach(x => console.log('  ' + x));
console.log(`\n未マップの文字列duration: ${unmapped.length}`); unmapped.forEach(x => console.log('  ⚠ ' + x));
if (!APPLY) { console.log('\n(dry-run。--apply で書込)'); process.exit(0); }
if (unmapped.length) { console.error('\n❌ 未マップあり。MAPに追加してから再実行。'); process.exit(1); }
const bak = FILE + '.durnorm.bak';
if (!fs.existsSync(bak)) fs.copyFileSync(FILE, bak);
fs.writeFileSync(FILE, src.slice(0, M.start) + ser(map) + src.slice(M.end));
console.log(`\n✅ 書込完了。backup: ${path.basename(bak)}`);
