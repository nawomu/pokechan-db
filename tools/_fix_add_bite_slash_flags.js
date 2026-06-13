#!/usr/bin/env node
// flags に bite / slash を追加する(2026-06-13・がんじょうあご/きれあじ実装の前提データ)
// 出典: ポケモンWiki「がんじょうあご」「きれあじ」の対象技表 + 1技ずつ個別ページをsonnetワークフローで裏取り済み
// (裏取り結果: /tmp/flag_verify 結果より。confirmed=true の技だけをここに列挙する)
// pokechan_data.js は直接編集禁止 → dry-run → --write
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'pokechan_data.js');
const WRITE = process.argv.includes('--write');
let src = fs.readFileSync(FILE, 'utf8');

// 裏取り済みリスト(ワークフロー結果を反映して確定)
// 2026-06-13 sonnetワークフロー(wf_3632b4ff)で24/24件 confirmed(各技ページ/特性ページの記述を個別確認)
const BITE = ['かみくだく', 'かみつく', 'かみなりのキバ', 'こおりのキバ', 'サイコファング', 'どくどくのキバ', 'ほのおのキバ'];
const SLASH = ['アクアカッター', 'エアカッター', 'エアスラッシュ', 'がんせきアックス', 'クロスポイズン',
  'サイコカッター', 'シェルブレード', 'シザークロス', 'せいなるつるぎ', 'ソーラーブレード', 'つじぎり',
  'つばめがえし', 'ドゲザン', 'ネズミざん', 'ひけん・ちえなみ', 'むねんのつるぎ', 'リーフブレード'];

let ok = true, added = 0;
function addFlag(name, flag){
  // 各技エントリの "flags": {...} に "<flag>": true を足す。flags が {} でも既存キーありでも対応
  const ni = src.indexOf(`"name": "${name}"`);
  if (ni < 0){ console.error(`❌ ${name}: エントリが見つからない`); ok = false; return; }
  const fi = src.indexOf('"flags"', ni);
  const next = src.indexOf('"name"', ni + 10);
  if (fi < 0 || (next > 0 && fi > next)){ console.error(`❌ ${name}: flagsが見つからない`); ok = false; return; }
  const open = src.indexOf('{', fi);
  const seg = src.slice(fi, open + 1);
  if (src.slice(fi, src.indexOf('}', open) + 1).includes(`"${flag}"`)){ console.log(`⏭ ${name}: ${flag} は既にある`); return; }
  const empty = src[open + 1] === '}';
  const ins = empty ? `"${flag}": true` : `"${flag}": true, `;
  src = src.slice(0, open + 1) + ins + src.slice(open + 1);
  console.log(`✅ ${name}: flags.${flag} 追加`);
  added++;
}

BITE.forEach(n => addFlag(n, 'bite'));
SLASH.forEach(n => addFlag(n, 'slash'));

if (!ok){ console.error('中止(未発見あり)'); process.exit(1); }
try { new Function(src); console.log('✅ 置換後の構文OK'); }
catch (e) { console.error('❌ SyntaxError:', e.message); process.exit(1); }
console.log(`追加: ${added}件`);
if (WRITE) { fs.writeFileSync(FILE, src); console.log('WROTE pokechan_data.js'); }
else console.log('(dry-run。書き込みは --write)');
