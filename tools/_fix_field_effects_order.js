#!/usr/bin/env node
/* フィールド技(エレキ/グラス/サイコ/ミスト)の effects 並び順を整える(2026-06-17 阿部さん):
   現状:[0]=シードの能力ランク変化, [1]=フィールド展開, [2+]=状態/威力/回復
   修正:フィールド展開を先頭へ・シードの能力ランク変化を末尾へ
   理由:技の主目的は「フィールド展開」=先頭・シードのぼうぎょ+1は「おまけ」=末尾。
        composeの順=effectsの順なので、ここを直すと声も自然になる(simも「フィールド展開→シード発動」の順で正しい)。
   使い方:
     node tools/_fix_field_effects_order.js          # dry-run(変更プレビュー)
     node tools/_fix_field_effects_order.js --write  # 実書込み
*/
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

const KEYS = ['erekifiirudo', 'gurasufiirudo', 'saikofiirudo', 'misutofiirudo'];

// pokechan_data.js のテキスト内で技ブロックを丸ごと切り出して、effects 配列だけ差し替える(他のキー順は保つ)。
const src = fs.readFileSync(FILE, 'utf8');
let out = src, changed = 0;

function lit(t, marker) {
  const at = t.indexOf(marker); if (at < 0) return null;
  let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false;
  for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return { s, e: i + 1, text: t.slice(s, i + 1) }; } } }
  return null;
}

const WAZA_MAP_LITERAL = lit(src, 'const WAZA_MAP =');
const WAZA_MAP = JSON.parse(WAZA_MAP_LITERAL.text);
const WAZA_START = WAZA_MAP_LITERAL.s; // WAZA_MAP の開始位置(ポケモン側の同名キー誤マッチを避けるため、ここ以降だけ検索)

function reorderEffects(effs) {
  const seed = effs.find(e => e.kind === '能力ランク変化' && e.condition && /holds_item|holding_item/.test(e.condition.type));
  const display = effs.find(e => e.kind === 'フィールド展開');
  if (!seed || !display) return null;
  const rest = effs.filter(e => e !== seed && e !== display);
  return [display, ...rest, seed]; // フィールド展開→他(状態/威力/回復)→シード
}

for (const key of KEYS) {
  const m = WAZA_MAP[key]; if (!m) { console.log(`SKIP ${key}: 技が見つからない`); continue; }
  const cur = (m.battle_data && m.battle_data.effects) || [];
  const next = reorderEffects(cur);
  if (!next) { console.log(`SKIP ${key}: シード/フィールド展開が無い`); continue; }
  const order0 = cur.map(e => e.kind).join('→');
  const order1 = next.map(e => e.kind).join('→');
  if (order0 === order1) { console.log(`OK ${key}: 既に順番OK`); continue; }
  console.log(`\n### ${m.name} (${key})`);
  console.log(`  before: ${order0}`);
  console.log(`  after : ${order1}`);
  // テキストレベルでこの技のブロックを置き換える(WAZA_MAP範囲内の "key": を探す=ポケモンの同名フィールド誤マッチを避ける)
  const keyMarker = `"${key}":`;
  const at = out.indexOf(keyMarker, WAZA_START); if (at < 0) { console.log(`  ERR: ${key} のキー位置がWAZA_MAP内に見つからない`); continue; }
  const obj = lit(out.slice(WAZA_START), keyMarker); if (!obj) { console.log(`  ERR: ${key} のオブジェクトが切り出せない`); continue; }
  obj.s += WAZA_START; obj.e += WAZA_START; // ローカル→グローバル座標
  const next_m = JSON.parse(obj.text);
  next_m.battle_data.effects = next;
  // インデントは2(既存に合わせる) - JSON.stringifyのspace:2で出して、各行に4スペース足す
  const replaced = JSON.stringify(next_m, null, 2).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n');
  out = out.slice(0, obj.s) + replaced + out.slice(obj.e);
  changed++;
}

console.log(`\n変更技数: ${changed}/4`);
if (WRITE && changed > 0) {
  fs.writeFileSync(FILE, out);
  console.log('✓ pokechan_data.js に書き込みました');
} else if (changed > 0) {
  console.log('(dry-run / --write で実書込み)');
}
