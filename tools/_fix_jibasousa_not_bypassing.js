#!/usr/bin/env node
/* じばそうさの battle_data に not_bypassing:["ダイウォール"] を追加(2026-06-17 阿部さん・裏取り済)。
   理由:legacy「なお、『ダイウォール』は貫通しない」を新版にも反映するため。
        同じ味方支援系(いやしのすず・コーチング・アロマミスト・いのちのしずく)は貫通技一覧(神ゲー攻略)に載るが、
        じばそうさは載らない=ダイウォールに防がれる側=ヤックンの注意書きと一致。
   not_bypassing は not_blocked_by の対称形(=この技は◯◯に防がれる)。
   compose で SYSTEMS_IN_GAME.dynamax=false 時はカッコ書き、true 時はカッコ無し通常文に出る。
   使い方:
     node tools/_fix_jibasousa_not_bypassing.js          # dry-run
     node tools/_fix_jibasousa_not_bypassing.js --write  # 実書込み
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

const KEY = 'jibasousa';
const m = WAZA_MAP[KEY];
if (!m) { console.error('じばそうさが見つからない'); process.exit(1); }
const bd = m.battle_data || {};
if (Array.isArray(bd.not_bypassing) && bd.not_bypassing.includes('ダイウォール')) {
  console.log('既に not_bypassing:["ダイウォール"] あり=変更不要'); process.exit(0);
}

const next = { ...m, battle_data: { ...bd, not_bypassing: [...(bd.not_bypassing || []), 'ダイウォール'] } };
console.log('### じばそうさ');
console.log('  before bd.not_bypassing:', bd.not_bypassing);
console.log('  after  bd.not_bypassing:', next.battle_data.not_bypassing);

const keyMarker = `"${KEY}":`;
const obj = lit(src.slice(WAZA_START), keyMarker);
const sG = obj.s + WAZA_START, eG = obj.e + WAZA_START;
const replaced = JSON.stringify(next, null, 2).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n');
const out = src.slice(0, sG) + replaced + src.slice(eG);

if (WRITE) { fs.writeFileSync(FILE, out); console.log('✓ pokechan_data.js に書き込みました'); }
else { console.log('(dry-run / --write で実書込み)'); }
