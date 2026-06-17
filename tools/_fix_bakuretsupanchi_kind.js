#!/usr/bin/env node
/* ばくれつパンチの effects[1].kind 誤分類を修正(2026-06-17 阿部さん発見):
   現状: kind="場の威力補正" (=フィールド威力補正用)
   正: kind="威力倍率" (=特性条件の威力倍率)
   根拠: 他の「てつのこぶし1.2倍」技9本(ほのお/れいとう/かみなり/きあい/コメット/ドレイン/バレット/ジェット/ぶちかまし)はすべて kind=威力倍率。ばくれつパンチだけ場の威力補正に分類されていた=誤分類。
   使い方:
     node tools/_fix_bakuretsupanchi_kind.js          # dry-run
     node tools/_fix_bakuretsupanchi_kind.js --write  # 実書込み
*/
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

function lit(t, marker) {
  const at = t.indexOf(marker); if (at < 0) return null;
  let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false;
  for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return { s, e: i + 1, text: t.slice(s, i + 1) }; } } }
  return null;
}

const src = fs.readFileSync(FILE, 'utf8');
const WAZA_LIT = lit(src, 'const WAZA_MAP =');
const WAZA_START = WAZA_LIT.s;
const WAZA_MAP = JSON.parse(WAZA_LIT.text);

const KEY = 'bakuretsupanchi';
const m = WAZA_MAP[KEY];
if (!m) { console.error('NOT FOUND'); process.exit(1); }

const targetIdx = (m.battle_data.effects || []).findIndex(e =>
  e.kind === '場の威力補正' && e.condition && e.condition.type === 'ability' && e.condition.value === 'てつのこぶし'
);
if (targetIdx < 0) { console.log('既に修正済 or 該当effect無し=変更不要'); process.exit(0); }

const next = JSON.parse(JSON.stringify(m));
next.battle_data.effects[targetIdx].kind = '威力倍率';

console.log('### ばくれつパンチ');
console.log('  before: effects['+targetIdx+'].kind = 場の威力補正');
console.log('  after : effects['+targetIdx+'].kind = 威力倍率');

const keyMarker = `"${KEY}":`;
const obj = lit(src.slice(WAZA_START), keyMarker);
const sG = obj.s + WAZA_START, eG = obj.e + WAZA_START;
const replaced = JSON.stringify(next, null, 2).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n');
const out = src.slice(0, sG) + replaced + src.slice(eG);

if (WRITE) { fs.writeFileSync(FILE, out); console.log('✓ pokechan_data.js に書き込みました'); }
else { console.log('(dry-run / --write で実書込み)'); }
