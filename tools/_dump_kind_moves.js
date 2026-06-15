// kind名を渡すと、その効果kindを持つ全技の {key, name, legacy, compose, effects, requires, flags} を
// JSON で stdout に出すヘルパ。声チェック workflow が agent に渡す素材生成用。
// 使い方: node tools/_dump_kind_moves.js "必中"
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { compose } = require('./_waza_compose.js');

// pokechan_data.js から WAZA_MAP リテラルを切り出す(_waza_compose.js と同じ手口)
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
const WAZA_MAP = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));

const kind = process.argv[2];
if (!kind) { console.error('usage: node tools/_dump_kind_moves.js <kind>'); process.exit(2); }

const moves = Object.values(WAZA_MAP).filter(m => {
  const eff = (m.battle_data && m.battle_data.effects) || [];
  return eff.some(e => e.kind === kind);
});

const out = moves.map(m => {
  const eff = (m.battle_data && m.battle_data.effects) || [];
  let composed = '';
  try { composed = compose(m).text || ''; } catch (e) { composed = '(compose error: ' + e.message + ')'; }
  return {
    key: m.key,
    name: m.name,
    type: m.type,
    category: m.category,
    power: m.power,
    accuracy: m.accuracy,
    legacy: m.description_legacy || '',
    compose: composed,
    effects: eff,
    requires: (m.battle_data && m.battle_data.requires) || [],
    flags: m.flags || {},
    bd_extra: {
      must_hit: m.battle_data && m.battle_data.must_hit,
      not_blocked_by: m.battle_data && m.battle_data.not_blocked_by,
      substitute_pierce: m.battle_data && m.battle_data.substitute_pierce,
      immune: m.battle_data && m.battle_data.immune,
      priority: m.battle_data && m.battle_data.priority,
    },
  };
});

process.stdout.write(JSON.stringify({ kind, count: out.length, moves: out }, null, 2));
