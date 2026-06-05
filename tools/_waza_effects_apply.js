/**
 * 効果構造化パイロット(27技)を pokechan_data.js の battle_data へ適用。
 * - effects(新スキーマ)/ priority / requires / fails_if / immune / blocked_by / not_blocked_by → battle_data へ
 * - flags(sound等) → top-level flags へ
 * - 既存 battle_data フィールド(crit_stage 等)は保持。tags は今回は不変(タグ撤去は別フェーズ)。
 * 各技の battle_data / flags サブオブジェクトのみピンポイント置換し、他バイトは不変。
 * backup → 書込 → 再パース検証(27技以外がdriftしないこと / effects一致)。
 * 実行: node tools/_waza_effects_apply.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');

const pilot = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/waza_effects_pilot.json'), 'utf8')).moves;
const srcText = fs.readFileSync(FILE, 'utf8');

// --- ファイル様式に合わせた serializer( ", " と ": " ) ---
function ser(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '[' + v.map(ser).join(', ') + ']';
  if (typeof v === 'object') return '{' + Object.entries(v).map(([k, val]) => JSON.stringify(k) + ': ' + ser(val)).join(', ') + '}';
  return JSON.stringify(v);
}

// --- 指定位置の '{' から対応する '}' までを返す(文字列対応) ---
function spanFrom(text, braceIdx) {
  let i = braceIdx, d = 0, inStr = false, esc = false;
  for (; i < text.length; i++) { const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else { if (c === '"') inStr = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return { start: braceIdx, end: i + 1 }; } } }
  throw new Error('unbalanced');
}
function findObjLiteral(text, marker, from = 0) {
  const at = text.indexOf(marker, from); if (at < 0) throw new Error('marker not found: ' + marker);
  return spanFrom(text, text.indexOf('{', at));
}

// move-level → battle_data へ移すキー
const BD_KEYS = ['priority', 'requires', 'fails_if', 'immune', 'blocked_by', 'not_blocked_by', 'effects'];

let body = srcText;
const applied = [];
for (const mv of pilot) {
  const anchor = `"${mv.key}": {"name"`;
  const ai = body.indexOf(anchor);
  if (ai < 0) throw new Error('move not found: ' + mv.key);
  const moveSpan = spanFrom(body, body.indexOf('{', ai + mv.key.length + 3));

  // --- battle_data を更新 ---
  const bdSpan = findObjLiteral(body, '"battle_data": {', moveSpan.start);
  if (bdSpan.end > moveSpan.end) throw new Error('battle_data out of move span: ' + mv.key);
  const bd = JSON.parse(body.slice(bdSpan.start, bdSpan.end));
  for (const k of BD_KEYS) if (mv[k] !== undefined) bd[k] = mv[k];
  body = body.slice(0, bdSpan.start) + ser(bd) + body.slice(bdSpan.end);

  // --- flags を更新(sound 等)。battle_data 置換で位置がずれるため再探索 ---
  if (mv.flags && mv.flags.length) {
    const ai2 = body.indexOf(anchor);
    const moveSpan2 = spanFrom(body, body.indexOf('{', ai2 + mv.key.length + 3));
    const fi = body.indexOf('"flags": {', moveSpan2.start);
    if (fi < 0 || fi > moveSpan2.end) throw new Error('flags not found: ' + mv.key);
    const fSpan = spanFrom(body, body.indexOf('{', fi));
    const flags = JSON.parse(body.slice(fSpan.start, fSpan.end));
    for (const f of mv.flags) flags[f] = true;
    body = body.slice(0, fSpan.start) + ser(flags) + body.slice(fSpan.end);
  }
  applied.push(mv.key);
}

// --- backup & 書込 ---
fs.writeFileSync(FILE + '.effects.bak', srcText);
fs.writeFileSync(FILE, body);

// --- 検証: 全 WAZA_MAP 再パース ---
function loadMap(text) { return JSON.parse(text.slice(...Object.values(findObjLiteral(text, 'const WAZA_MAP =')))); }
const before = loadMap(srcText), after = loadMap(body);
const pilotKeys = new Set(pilot.map(m => m.key));
let drift = 0, effOk = 0, effBad = 0;
for (const k of Object.keys(before)) {
  if (pilotKeys.has(k)) continue;
  if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) { console.log('⚠ drift(非対象が変化):', k); drift++; }
}
for (const mv of pilot) {
  const got = JSON.stringify((after[mv.key].battle_data || {}).effects);
  const exp = JSON.stringify(mv.effects);
  if (got === exp) effOk++; else { console.log('⚠ effects不一致:', mv.key); effBad++; }
}
console.log('技総数:', Object.keys(after).length);
console.log('適用:', applied.length, '/ effects一致:', effOk, '/ 不一致:', effBad, '/ 非対象drift:', drift);
console.log(drift === 0 && effBad === 0 ? '✅ 検証OK' : '❌ 検証NG — backup から復旧可: pokechan_data.js.effects.bak');
console.log('backup: pokechan_data.js.effects.bak');
