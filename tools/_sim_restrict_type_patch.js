#!/usr/bin/env node
/* claude-design→glm-impl依頼: sim に restrict_type(型限定)＋target:all適用を実装。
 * 能力ランク変化ブロックで target:all → [atk,def]両適用、restrict_type → sideTypes(holder).includes の者のみ。
 * 既存単体target(self/opponent/team等)は無改変(_rankHolders=[target])。既存適用コードは for(const target...) で
 * shadow しそのまま動く。エンジン改変は最小限・行番号assert付き。
 * 実行: node tools/_sim_restrict_type_patch.js (べき等ではない=2回実行NG)
 */
const fs = require('fs');
const F = 'real_battle_simulator.html';
const lines = fs.readFileSync(F, 'utf8').split('\n');

// 行番号(1-based)の安全確認。ズレてたら即停止。
const assert = (idx1, expect) => {
  if (!lines[idx1 - 1].includes(expect))
    throw new Error(`L${idx1} expect<${expect}> got<${lines[idx1 - 1]}>`);
};
assert(3489, '}');                 // resetブロック閉じ
assert(3490, 'condition付き');     // 能力ランク変化のcondition節コメント
assert(3559, '}');                 // for(const k of keys) の閉じ
assert(3560, 'やどりぎ');          // 次の kindブロック

// L3489(reset閉じ)の後にholders開始を挿入。L3490-3559(condition〜for k適用)を2sp字下げ。末尾にholders閉じ追加。
const holdersOpen = [
  '      // ★target:all(たがやす/フラワーガード等)=場の全員に適用。restrict_type=その型限定(くさ等)。',
  '      // 既存単体target(self/opponent/team等)は _rankHolders=[target] で従来どおり。各holderはshadowし既存適用コードがそのまま動く。',
  "      const _rankHolders = (ef.target === 'all') ? [atk, def] : [target];",
  '      for (const target of _rankHolders){',
  '        if (ef.restrict_type && !sideTypes(target).includes(ef.restrict_type)) continue;',
  '        if (target.fainted) continue;'
];
const inner = lines.slice(3489, 3559).map(l => l.length ? '  ' + l : l);  // L3490-3559 を 2sp 字下げ
const holdersClose = ['      }'];

const out = [
  ...lines.slice(0, 3489),   // L1-3489(reset閉じまで)
  ...holdersOpen,
  ...inner,                   // 字下げ済み L3490-3559
  ...holdersClose,
  ...lines.slice(3559),       // L3560-(やどりぎ以降)
];
fs.writeFileSync(F, out.join('\n'));
console.log('✅ patched: holdersループ開始(L3489後) + L3490-3559を2sp字下げ + holders閉じ(L3559後)');
