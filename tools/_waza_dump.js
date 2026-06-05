/**
 * 指定キーの技データを1行JSONで出力(ワークフローのエージェント入力用)。
 * 実行: node tools/_waza_dump.js <key1> <key2> ...
 */
const fs = require('fs'), path = require('path');
const FILE = path.resolve(__dirname, '..', 'pokechan_data.js');
function lit(text, marker) {
  const at = text.indexOf(marker); let i = text.indexOf('{', at), s = i, d = 0, inS = false, esc = false;
  for (; i < text.length; i++) { const c = text[i];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; }
    else { if (c === '"') inS = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return text.slice(s, i + 1); } } }
}
const map = JSON.parse(lit(fs.readFileSync(FILE, 'utf8'), 'const WAZA_MAP ='));
for (const k of process.argv.slice(2)) {
  const m = map[k];
  if (!m) { console.log(JSON.stringify({ key: k, error: 'not found' })); continue; }
  console.log(JSON.stringify({
    key: k, name: m.name, type: m.type, category: m.category, pp: m.pp,
    power: m.power || null, accuracy: m.accuracy || null,
    flags: m.flags && Object.keys(m.flags).length ? Object.keys(m.flags) : null,
    current_effects: (m.battle_data && m.battle_data.effects) || null,
    desc: m.description_legacy || m.description || ''
  }));
}
