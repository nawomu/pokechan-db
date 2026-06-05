/**
 * わざタグ 一括適用: (1)誤分類141件の修正 (2)全タグの可読リネーム
 * pokechan_data.js の各技 "tags":[...] のみをピンポイント置換 (他バイトは不変)。
 * バックアップ→書込→再パース検証→before/after JSON 出力。
 * 実行: node tools/_waza_apply.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');

const findings = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/waza_audit_findings.json'), 'utf8')).findings;
const renameMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/waza_tag_rename_map.json'), 'utf8'));

const srcText = fs.readFileSync(FILE, 'utf8');

// --- WAZA_MAP オブジェクトリテラルの範囲を文字列対応で抽出 ---
function findObjectLiteral(text, marker) {
  const at = text.indexOf(marker);
  if (at < 0) throw new Error('marker not found: ' + marker);
  let i = text.indexOf('{', at);
  const start = i;
  let depth = 0, inStr = false, esc = false;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else { if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { return { start, end: i + 1 }; } } }
  }
  throw new Error('unbalanced braces');
}
const { start, end } = findObjectLiteral(srcText, 'const WAZA_MAP =');
const literal = srcText.slice(start, end);
const orig = JSON.parse(literal);          // 検証用(変更しない)
const keys = Object.keys(orig);
console.log('技数:', keys.length);

// --- 名前→キー ---
const nameToKey = {};
for (const k of keys) nameToKey[orig[k].name] = k;

// --- 修正(findings)を技名ごとに集約 ---
const removeByMove = {};   // name -> Set(oldTag)
const addByMove = {};      // name -> Set(oldTag)  (reassign先が既存語彙のときのみ)
const manualLog = [];
for (const f of findings) {
  (removeByMove[f.move] = removeByMove[f.move] || new Set()).add(f.tag);
  if (f.action && f.action.startsWith('reassign:')) {
    const tgt = f.action.split(':')[1].trim();
    if (renameMap[tgt]) (addByMove[f.move] = addByMove[f.move] || new Set()).add(tgt);
    else manualLog.push(`${f.move}: ${f.tag} を削除 (推奨追加 ${tgt} は既存語彙に無いため手動)`);
  }
  if (!nameToKey[f.move]) manualLog.push(`⚠ 技名未一致: ${f.move}`);
}

// --- 各技の新tags算出 ---
const changes = [];            // {key,name,oldTags,newTags}
const unknownTags = new Set(); // renameMapに無いタグ
let removedCount = 0, addedCount = 0;
const newTagsByKey = {};
for (const k of keys) {
  const m = orig[k];
  const oldTags = m.tags || [];
  let t = [...oldTags];
  const rem = removeByMove[m.name];
  if (rem) { const before = t.length; t = t.filter(x => !rem.has(x)); removedCount += before - t.length; }
  const add = addByMove[m.name];
  if (add) for (const a of add) if (!t.includes(a)) { t.push(a); addedCount++; }
  // rename
  t = t.map(x => { if (renameMap[x]) return renameMap[x]; unknownTags.add(x); return x; });
  t = [...new Set(t)]; // 重複統合
  newTagsByKey[k] = t;
  if (JSON.stringify(t) !== JSON.stringify(oldTags)) changes.push({ key: k, name: m.name, oldTags, newTags: t });
}
console.log('変更技数:', changes.length, '/ 削除タグ:', removedCount, '/ reassign追加:', addedCount);
if (unknownTags.size) console.log('⚠ renameMap未収録タグ:', [...unknownTags].join(', '));

// --- pokechan_data.js を tagsだけピンポイント置換 ---
let body = srcText;
function replaceMoveTags(text, key, newTags) {
  const keyTok = '"key": ' + JSON.stringify(key);
  const ki = text.indexOf(keyTok);
  if (ki < 0) throw new Error('key token not found: ' + key);
  const ti = text.indexOf('"tags": [', ki);
  if (ti < 0) throw new Error('tags not found for: ' + key);
  const te = text.indexOf(']', ti);
  const newArr = '"tags": [' + newTags.map(x => JSON.stringify(x)).join(', ') + ']';
  return text.slice(0, ti) + newArr + text.slice(te + 1);
}
for (const c of changes) body = replaceMoveTags(body, c.key, c.newTags);

// バックアップ＆書込
fs.writeFileSync(FILE + '.bak', srcText);
fs.writeFileSync(FILE, body);

// --- 検証: 再パースして tags以外が不変か / tagsが期待通りか ---
const body2 = fs.readFileSync(FILE, 'utf8');
const lit2 = body2.slice(...Object.values(findObjectLiteral(body2, 'const WAZA_MAP =')));
const after = JSON.parse(lit2);
let drift = 0, tagMismatch = 0;
const stripTags = o => { const c = { ...o }; delete c.tags; return JSON.stringify(c); };
for (const k of keys) {
  if (!after[k]) { console.log('欠落:', k); drift++; continue; }
  if (stripTags(orig[k]) !== stripTags(after[k])) { console.log('tags以外が変化:', k); drift++; }
  if (JSON.stringify(after[k].tags) !== JSON.stringify(newTagsByKey[k])) { console.log('tags不一致:', k); tagMismatch++; }
}
console.log('検証 — 技数:', Object.keys(after).length, '/ tags以外のdrift:', drift, '/ tags不一致:', tagMismatch);

// --- findings の (move,oldTag) が消えたか最終確認 ---
let remain = 0;
for (const f of findings) { const k = nameToKey[f.move]; if (k && (after[k].tags || []).includes(f.tag)) { remain++; console.log('残存誤タグ:', f.move, f.tag); } }
console.log('誤タグ残存:', remain, '(0が正常)');

fs.writeFileSync(path.join(ROOT, 'review/waza_apply_changes.json'), JSON.stringify({ changedMoves: changes.length, removedTags: removedCount, manual: manualLog, changes }, null, 1));
console.log('\n手動フォロー必要:', manualLog.length, '件');
manualLog.forEach(x => console.log('  - ' + x));
console.log('\nbackup: pokechan_data.js.bak / changes: review/waza_apply_changes.json');
