#!/usr/bin/env node
/* 旧フィルタ vs 詳細タグの突合・全カテゴリ網羅チェック(2026-06-18 阿部さん依頼)
 * 実行: node tools/_waza_filter_tag_crosscheck.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
const W = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));
const allMoves = Object.values(W);
const src = fs.readFileSync(path.join(ROOT, 'waza_picker.js'), 'utf8');
const fn = src.match(/function getMoveFilterTags\(m\) \{[\s\S]*?^\}/m)[0];
eval(fn);

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
  if (catKey === 'target') return (TARGET_PAT_MAP[val] || []).some(p => (m.target || '') === p);
  if (['self_up2', 'self_up1', 'opp_down2', 'opp_down1', 'self_down2', 'self_down1'].includes(catKey)) {
    const RC = {
      self_up2: ['self', d => d >= 2], self_up1: ['self', d => d === 1],
      opp_down2: ['opp', d => d <= -2], opp_down1: ['opp', d => d === -1],
      self_down2: ['self', d => d <= -2], self_down1: ['self', d => d === -1],
    };
    const [tgtKey, check] = RC[catKey];
    const key = STAT_KEY_MAP[val];
    // bd.rank_changes + effects[能力ランク変化] 両方拾う(picker.jsと同じロジック)
    const STAT_EN = { attack:'atk', defense:'def', special_attack:'spa', special_defense:'spd', speed:'spe', accuracy:'acc', evasion:'eva' };
    const TGT_EN = { self:'self', opponent:'opp' };
    const effRanks = (effects || []).filter(e => e.kind === '能力ランク変化' && e.stat_choice !== 'random_one_of').flatMap(e => {
      const stats = Array.isArray(e.stats) ? e.stats : (e.stat ? [e.stat] : []);
      const delta = (e.stages != null) ? e.stages : (e.delta != null ? e.delta : 0);
      const mappedTgt = TGT_EN[e.target];
      if (!mappedTgt) return [];
      return stats.map(s => ({ target: mappedTgt, stat: STAT_EN[s] || s, delta }));
    });
    return [...(bd.rank_changes || []), ...effRanks].some(r => r.target === tgtKey && r.stat === key && check(r.delta));
  }
  return false;
}

const CHIP_TO_TAG = {
  'flag:punch': /^👊 パンチ$/,
  'flag:sound': /^🔊 音$/,
  'flag:ball': /^🔵 弾$/,
  'flag:pulse': /^〰️ 波動$/,
  'flag:ohko': /^💀 一撃必殺$/,
  'flag:charge': /1ターン目|2ターン目に攻撃/,
  'flag:recharge': /使った次のターンは動けない/,
  'status:まひ': /^⚡ (\d+%)?まひ(\(自\))?$/,
  'status:ねむり': /^💤 (\d+%)?ねむり(\(自\))?$/,
  'status:こおり': /^❄️ (\d+%)?こおり(\(自\))?$/,
  'status:やけど': /^🔥 (\d+%)?やけど(\(自\))?$/,
  'status:どく': /^(☠️|💀) (\d+%)?(どく|もうどく)(\(自\))?$/,
  'status:こんらん': /^🌀 (\d+%)?こんらん(\(自\))?$/,
  'status:ひるみ': /^😵 (\d+%)?ひるみ(\(自\))?$/,
  'self_up2:こうげき': /^📊 (\d+% )?自攻\+[2-6]$/, 'self_up1:こうげき': /^📊 (\d+% )?自攻\+1$/,
  'self_up2:ぼうぎょ': /^📊 (\d+% )?自防\+[2-6]$/, 'self_up1:ぼうぎょ': /^📊 (\d+% )?自防\+1$/,
  'self_up2:とくこう': /^📊 (\d+% )?自特攻\+[2-6]$/, 'self_up1:とくこう': /^📊 (\d+% )?自特攻\+1$/,
  'self_up2:とくぼう': /^📊 (\d+% )?自特防\+[2-6]$/, 'self_up1:とくぼう': /^📊 (\d+% )?自特防\+1$/,
  'self_up2:すばやさ': /^📊 (\d+% )?自速\+[2-6]$/, 'self_up1:すばやさ': /^📊 (\d+% )?自速\+1$/,
  'opp_down2:こうげき': /^📊 (\d+% )?相攻-[2-6]$/, 'opp_down1:こうげき': /^📊 (\d+% )?相攻-1$/,
  'opp_down2:ぼうぎょ': /^📊 (\d+% )?相防-[2-6]$/, 'opp_down1:ぼうぎょ': /^📊 (\d+% )?相防-1$/,
  'opp_down2:とくこう': /^📊 (\d+% )?相特攻-[2-6]$/, 'opp_down1:とくこう': /^📊 (\d+% )?相特攻-1$/,
  'opp_down2:とくぼう': /^📊 (\d+% )?相特防-[2-6]$/, 'opp_down1:とくぼう': /^📊 (\d+% )?相特防-1$/,
  'opp_down2:すばやさ': /^📊 (\d+% )?相速-[2-6]$/, 'opp_down1:すばやさ': /^📊 (\d+% )?相速-1$/,
  'self_down2:こうげき': /^📊 (\d+% )?自攻-[2-6]$/, 'self_down1:こうげき': /^📊 (\d+% )?自攻-1$/,
  'self_down2:ぼうぎょ': /^📊 (\d+% )?自防-[2-6]$/, 'self_down1:ぼうぎょ': /^📊 (\d+% )?自防-1$/,
  'self_down2:とくこう': /^📊 (\d+% )?自特攻-[2-6]$/, 'self_down1:とくこう': /^📊 (\d+% )?自特攻-1$/,
  'self_down2:とくぼう': /^📊 (\d+% )?自特防-[2-6]$/, 'self_down1:とくぼう': /^📊 (\d+% )?自特防-1$/,
  'self_down2:すばやさ': /^📊 (\d+% )?自速-[2-6]$/, 'self_down1:すばやさ': /^📊 (\d+% )?自速-1$/,
};

function tagsOf(m) { return getMoveFilterTags(m).map(t => t.text); }

console.log('=== 旧フィルタ vs 詳細タグ 全カテゴリ突合 ===\n');
const results = [];
for (const [chipKey, tagPat] of Object.entries(CHIP_TO_TAG)) {
  const [catKey, val] = chipKey.split(':');
  const oldSet = new Set(allMoves.filter(m => chipMatch(m, catKey, val)).map(m => m.name));
  const newSet = new Set(allMoves.filter(m => tagsOf(m).some(t => tagPat.test(t))).map(m => m.name));
  const onlyOld = [...oldSet].filter(x => !newSet.has(x));
  const onlyNew = [...newSet].filter(x => !oldSet.has(x));
  const ok = onlyOld.length === 0 && onlyNew.length === 0;
  results.push({ chipKey, oldCount: oldSet.size, newCount: newSet.size, onlyOld, onlyNew, ok });
}

let totalGap = 0;
const byCat = {};
for (const r of results) {
  const cat = r.chipKey.split(':')[0];
  byCat[cat] = byCat[cat] || { ok: 0, ng: 0, items: [] };
  if (r.ok) byCat[cat].ok++; else { byCat[cat].ng++; totalGap += r.onlyOld.length + r.onlyNew.length; }
  byCat[cat].items.push(r);
}

for (const [cat, info] of Object.entries(byCat)) {
  console.log(`### ${cat} (${info.ok}✅ / ${info.ng}❌) ###`);
  for (const r of info.items) {
    const mark = r.ok ? '✅' : '❌';
    console.log(`  ${mark} ${r.chipKey}: 旧${r.oldCount} / 新${r.newCount}`);
    if (r.onlyOld.length) console.log(`     旧のみ(タグ漏れ): ${r.onlyOld.join('、')}`);
    if (r.onlyNew.length) console.log(`     新のみ(過剰): ${r.onlyNew.join('、')}`);
  }
  console.log();
}

console.log(`=== 突合ギャップ合計: ${totalGap}件 ===`);
process.exit(totalGap > 0 ? 1 : 0);
