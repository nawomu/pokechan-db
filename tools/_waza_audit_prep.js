/**
 * タグ誤分類 監査の入力データ生成。
 * WAZA_MAP から tag→[{name,desc}] を作り、グループに分割して
 * review/audit_groups/group_NN.json に書き出す。workflow の各エージェントが読む。
 * 実行: node tools/_waza_audit_prep.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8');
const WAZA_MAP = new Function('window', 'document', 'navigator', 'console', src + '\n;return WAZA_MAP;')({}, {}, {}, console);
const moves = Object.values(WAZA_MAP);

// 広域フラグ/寄せ集めは監査対象外 (キーワード誤りの性質が違う)
const EXCLUDE = new Set(['has_secondary_effect', 'other_misc']);

// tag -> [{name, desc}]
const tagMoves = {};
for (const m of moves) {
  const desc = m.description || m.description_legacy || '';
  for (const t of (m.tags || [])) {
    if (EXCLUDE.has(t)) continue;
    (tagMoves[t] = tagMoves[t] || []).push({ name: m.name, desc });
  }
}
const tags = Object.keys(tagMoves).sort();

// 累積「タグ×技」ペア数 ~55 を上限にグループ化
const BUDGET = 55;
const groups = [];
let cur = { tags: [] }, curCount = 0;
for (const t of tags) {
  const n = tagMoves[t].length;
  if (curCount > 0 && curCount + n > BUDGET) { groups.push(cur); cur = { tags: [] }; curCount = 0; }
  cur.tags.push({ tag: t, moves: tagMoves[t] });
  curCount += n;
}
if (cur.tags.length) groups.push(cur);

const outDir = path.join(ROOT, 'review/audit_groups');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
groups.forEach((g, i) => {
  g.name = 'group_' + String(i).padStart(2, '0');
  fs.writeFileSync(path.join(outDir, g.name + '.json'), JSON.stringify(g, null, 1));
});

const totalPairs = tags.reduce((s, t) => s + tagMoves[t].length, 0);
console.log('監査対象タグ:', tags.length, '/ タグ×技ペア:', totalPairs);
console.log('グループ数:', groups.length, '(各 ~' + BUDGET + 'ペア上限)');
console.log('出力: review/audit_groups/group_00.json .. group_' + String(groups.length - 1).padStart(2, '0') + '.json');
console.log('GROUP_COUNT=' + groups.length);
console.log('DIR=' + outDir);
