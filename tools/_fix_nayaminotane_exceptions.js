#!/usr/bin/env node
/* なやみのタネに exceptions 追加(2026-06-17 阿部さん指摘):
   legacy:「ただし『なまけ』『バトルスイッチ』など一部の固有な特性の場合は失敗する」
   現状 effects[0] に exceptions が無く新compose が「相手の特性を『ふみん』に変える」だけ=情報落ち。
   既存のなりきり/スキルスワップ/いえきと同じ exceptions スキーマで追加。
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

const KEY = 'nayaminotane';
const m = WAZA_MAP[KEY];
if (!m) { console.error('NOT FOUND'); process.exit(1); }
const eff = m.battle_data.effects[0];
if (eff.exceptions) { console.log('既に exceptions あり=変更不要'); process.exit(0); }

const next = JSON.parse(JSON.stringify(m));
next.battle_data.effects[0].exceptions = [{
  type: 'ability',
  reason: 'certain form-related or unique abilities cannot be overwritten',
  values: ['なまけ', 'バトルスイッチ'],
  complete: false,
  needs_research: true
}];

console.log('### なやみのタネ');
console.log('  before: exceptions 無し');
console.log('  after : exceptions=[{type:ability, values:["なまけ","バトルスイッチ"], complete:false}]');

const keyMarker = `"${KEY}":`;
const obj = lit(src.slice(WAZA_START), keyMarker);
const sG = obj.s + WAZA_START, eG = obj.e + WAZA_START;
const replaced = JSON.stringify(next, null, 2).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n');
const out = src.slice(0, sG) + replaced + src.slice(eG);

if (WRITE) { fs.writeFileSync(FILE, out); console.log('✓ pokechan_data.js に書き込みました'); }
else { console.log('(dry-run / --write で実書込み)'); }
