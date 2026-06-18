#!/usr/bin/env node
// 旧フィルタ vs 詳細タグの突合・全カテゴリ網羅チェック
// 旧の chipFn でヒットする技セットと、新タグでカバーされる技セットを比較
const fs = require('fs');
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
const W = JSON.parse(lit(fs.readFileSync('./pokechan_data.js', 'utf8'), 'const WAZA_MAP ='));
const allMoves = Object.values(W);
const src = fs.readFileSync('./waza_picker.js', 'utf8');
const fn = src.match(/function getMoveFilterTags\(m\) \{[\s\S]*?^\}/m)[0];
eval(fn);

// 旧フィルタの chipFn(picker.js から取り出した判定ロジック)
const STAT_KEY_MAP = { 'こうげき': 'atk', 'ぼうぎょ': 'def', 'とくこう': 'spa', 'とくぼう': 'spd', 'すばやさ': 'spe', '命中率': 'acc', '回避率': 'eva' };
const TARGET_PAT_MAP = {
  '相手全体': ['相手全体', '全体', '自分以外全体'], '自分以外': ['自分以外全体', '相手全体', '全体'],
  '味方': ['味方1体', '味方全体', '味方の場', '自分か味方'], '場': ['全体の場', '相手の場', '味方の場'],
};
function chipMatch(m, catKey, val) {
  const flags = m.flags || {}; const bd = m.battle_data || {}; const effects = bd.effects || [];
  if (catKey === 'flag') return !!flags[val];
  if (catKey === 'status') {
    if (val === 'ひるみ') return effects.some(e => e.kind === 'ひるみ' || (e.kind === '状態付与' && e.value === 'ひるみ'));
    if (val === 'どく') return effects.some(e => e.kind === '状態付与' && (e.value === 'どく' || e.value === 'もうどく'));
    return effects.some(e => e.kind === '状態付与' && e.value === val);
  }
  return false;
}

// 状態異常で突合(状態異常タグだけマッチ・条件タグ「ねむり中でも使える」等は除外)
const statuses = ['まひ', 'ねむり', 'こおり', 'やけど', 'どく', 'こんらん', 'ひるみ'];
console.log('=== 状態異常: 旧フィルタ vs 詳細タグ 突合 ===\n');
let totalGaps = 0;
for (const s of statuses) {
  // 状態異常タグの形式: 「😵 30%ひるみ」「⚡ 100%まひ」「☠️ どく」「🌀 こんらん(自)」など
  // どくは「もうどく」も含めて拾う(旧フィルタと同じ仕様)
  const values = s === 'どく' ? ['どく', 'もうどく'] : [s];
  const pat = new RegExp('^(😵|⚡|💤|❄️|🔥|☠️|💀|🌀|💕)\\s*(\\d+%)?\\s?(' + values.join('|') + ')(\\(自\\))?$');
  const oldSet = new Set(allMoves.filter(m => chipMatch(m, 'status', s)).map(m => m.name));
  const newSet = new Set(allMoves.filter(m => getMoveFilterTags(m).some(t => pat.test(t.text))).map(m => m.name));
  const onlyOld = [...oldSet].filter(x => !newSet.has(x));
  const onlyNew = [...newSet].filter(x => !oldSet.has(x));
  const ok = oldSet.size === newSet.size && onlyOld.length === 0 && onlyNew.length === 0;
  console.log(`${ok ? '✅' : '❌'} ${s}: 旧${oldSet.size}件 / 新${newSet.size}件 ${ok ? '一致' : ''}`);
  if (onlyOld.length) { console.log(`  旧にのみ(タグ漏れ): ${onlyOld.join('、')}`); totalGaps += onlyOld.length; }
  if (onlyNew.length) { console.log(`  新にのみ(過剰タグ): ${onlyNew.join('、')}`); totalGaps += onlyNew.length; }
}
console.log(`\n突合ギャップ: ${totalGaps}件`);
process.exit(totalGaps > 0 ? 1 : 0);
