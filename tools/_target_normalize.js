/* effect.target の日本語scope4値→英語トークン(B方針=英語enum)。
 * ※ move-level の m.target は触らない(別フィールド・sim依存・日本語のまま)。
 * パースして effect.target だけ直す(雑置換だと m.target を巻き込み sim破壊)。
 * dry-run(既定)→ --apply。 実行: node tools/_target_normalize.js [--apply] */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), FILE = path.join(ROOT, 'pokechan_data.js');
const APPLY = process.argv.includes('--apply');
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return { lit: t.slice(s, i + 1), start: s, end: i + 1 }; } } } }
function ser(v) { if (v === null) return 'null'; if (Array.isArray(v)) return '[' + v.map(ser).join(', ') + ']'; if (typeof v === 'object') return '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + ser(x)).join(', ') + '}'; return JSON.stringify(v); }

const MAP = { '相手全体': 'all_opponents', '自分以外全体': 'all_but_self', '手持ち全員': 'party', '交代先': 'incoming' };

const src = fs.readFileSync(FILE, 'utf8');
const M = lit(src, 'const WAZA_MAP =');
const map = JSON.parse(M.lit);
const log = [];
for (const m of Object.values(map)) {
  for (const e of ((m.battle_data || {}).effects || [])) {
    if (MAP[e.target]) { log.push(`${m.name}「${e.kind}」: target ${e.target} → ${MAP[e.target]}`); e.target = MAP[e.target]; }
  }
}
console.log(`\n=== effect.target 正規化 ${APPLY ? '適用' : 'DRY-RUN'} === ${log.length}件`);
log.forEach(x => console.log('  ' + x));
// 安全確認: m.target に日本語が残ってる(=触ってない)ことを表示
const mt = new Set(); for (const m of Object.values(map)) if (m.target) mt.add(m.target);
console.log('\n[確認] m.target(move-level・今回不変・sim依存)の値:', [...mt].slice(0, 12).join(' / '));
if (!APPLY) { console.log('\n(dry-run。--apply で書込)'); process.exit(0); }
const bak = FILE + '.tgtnorm.bak';
if (!fs.existsSync(bak)) fs.copyFileSync(FILE, bak);
fs.writeFileSync(FILE, src.slice(0, M.start) + ser(map) + src.slice(M.end));
console.log(`\n✅ 書込完了。backup: ${path.basename(bak)}`);
