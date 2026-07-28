#!/usr/bin/env node
// flags に slicing/slash を追加(2026-07-28・Champions正典化 A/B/C対応の一環)
// 出典: reference/_authority_corpus/moves/{シャドークロー,ドラゴンクロー,ブレイククロー,フェイタルクロー}.json の「技の仕様」節
//   各技とも共通の記述: 「Championsでは切る技の1つ。特性きれあじのポケモンが使うと威力が1.5倍になる。」
//   (フェイタルクローのみ追記あり:「スカーレット・バイオレットでは切る技には含まれない。」→SVでは対象外だがChampionsでは対象)
// きれあじ.json の効果表(26技)は crow系4技を含まない旧(SV)リストだったため、この4技だけ個別ページの
// Champions固有記述で裏取りして追加する(全国版moves/*.jsonを「切る技」「きれあじ」等で全数grepし、他に
// flags欠落の対象が無いことを確認済み=いあいぎり/きょじゅうざん/きりさく/サイコブレイド/しんぴのつるぎ/
// タキオンカッター/はっぱカッター/パワフルエッジ/れんぞくぎりはこのDB未実装=対象外)
// pokechan_data.js は直接編集禁止 → dry-run → --write (前例: tools/_fix_add_bite_slash_flags.js)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'pokechan_data.js');
const WRITE = process.argv.includes('--write');
let src = fs.readFileSync(FILE, 'utf8');

// Champions固有(SVでは切る技に含まれないが、Championsでは対象)。出典は各moves/*.jsonの「技の仕様」節。
const SLICING = ['シャドークロー', 'ドラゴンクロー', 'ブレイククロー', 'フェイタルクロー'];

let ok = true, added = 0;
function addFlags(name, flagList){
  // pokechan_data.js は "name":"X" (コロン後にスペース無し) 形式
  const ni = src.indexOf(`"name":"${name}"`);
  if (ni < 0){ console.error(`❌ ${name}: エントリが見つからない`); ok = false; return; }
  const fi = src.indexOf('"flags"', ni);
  const next = src.indexOf('"name"', ni + 10);
  if (fi < 0 || (next > 0 && fi > next)){ console.error(`❌ ${name}: flagsが見つからない`); ok = false; return; }
  const open = src.indexOf('{', fi);
  const close = src.indexOf('}', open);
  const existing = src.slice(fi, close + 1);
  const missing = flagList.filter(f => !existing.includes(`"${f}"`));
  if (missing.length === 0){ console.log(`⏭ ${name}: 既にすべてある`); return; }
  const empty = src[open + 1] === '}';
  const ins = missing.map(f => `"${f}":true`).join(',') + (empty ? '' : ',');
  src = src.slice(0, open + 1) + ins + src.slice(open + 1);
  console.log(`✅ ${name}: flags.${missing.join('/')} 追加`);
  added++;
}

SLICING.forEach(n => addFlags(n, ['slicing', 'slash']));

if (!ok){ console.error('中止(未発見あり)'); process.exit(1); }
try { new Function(src); console.log('✅ 置換後の構文OK'); }
catch (e) { console.error('❌ SyntaxError:', e.message); process.exit(1); }
console.log(`追加: ${added}件`);
if (WRITE) { fs.writeFileSync(FILE, src); console.log('WROTE pokechan_data.js'); }
else console.log('(dry-run。書き込みは --write)');
