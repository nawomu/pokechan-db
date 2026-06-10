/* 体重マージ(一回もの): review/_weights_collected.json の weight_kg を
 * pokechan_data.js の POKEMON_LIST 各エントリへ挿入する。
 * 安全策: アンカー(`"no":"XXX","name":"YYY",`)が本文中にちょうど1回ずつ存在することを
 * 全件確認してから書き込む(0回 or 2回以上が1件でもあれば中断・書き込まない)。
 * 実行: node tools/_merge_weights.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');

const collected = require(path.join(ROOT, 'review', '_weights_collected.json'));
let src = fs.readFileSync(FILE, 'utf8');

// 既にマージ済みなら何もしない(二重挿入防止)
if (src.includes('"weight_kg"')) {
  console.log('すでに weight_kg が存在します。中断(二重マージ防止)。');
  process.exit(1);
}

// 1) 全件のアンカー一意性を先に検証
const jobs = [];
const problems = [];
for (const w of collected.weights) {
  const anchor = `{"no":${JSON.stringify(w.no)},"name":${JSON.stringify(w.name)},`;
  const first = src.indexOf(anchor);
  const second = first >= 0 ? src.indexOf(anchor, first + 1) : -1;
  if (first < 0) problems.push(`見つからない: ${w.no} ${w.name}`);
  else if (second >= 0) problems.push(`複数ヒット: ${w.no} ${w.name}`);
  else jobs.push({ anchor, insert: `"weight_kg":${w.weight_kg},` });
}
if (problems.length) {
  console.log('❌ アンカー検証失敗(書き込みません):');
  problems.forEach(p => console.log('  -', p));
  process.exit(1);
}
console.log('アンカー検証OK:', jobs.length, '件すべて一意');

// 2) 挿入(アンカー直後に weight_kg)
let count = 0;
for (const j of jobs) {
  src = src.replace(j.anchor, j.anchor + j.insert);
  count++;
}
fs.writeFileSync(FILE, src);
console.log('✅ 挿入:', count, '件 →', FILE);

// 3) 事後検証: 読み直して全件一致するか
delete require.cache[require.resolve(FILE)];
const data = require(FILE);
const byKey = {};
collected.weights.forEach(w => { byKey[w.no + '|' + w.name] = w.weight_kg; });
let ok = 0, bad = 0;
for (const p of data.POKEMON_LIST) {
  const exp = byKey[p.no + '|' + p.name];
  if (p.weight_kg === exp) ok++;
  else { bad++; console.log('  ❌', p.no, p.name, 'got', p.weight_kg, 'exp', exp); }
}
console.log(`事後検証: 一致 ${ok} / 不一致 ${bad} / 総数 ${data.POKEMON_LIST.length}`);
process.exit(bad ? 1 : 0);
