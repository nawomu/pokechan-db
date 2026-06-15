#!/usr/bin/env node
// 説明文の判定を「機械的に確実なものだけ」で付け直す(2026-06-14 阿部さん)。
// sonnet判定者の過剰判定(急所+1を直せ/優先度がeffectsに無い/ダイマックス無効/ダメージkind無し 等)は全部捨て、
// 信用できる2信号だけで採点する: ①compose空っぽ ②機械漏れ(英語/キー/true/undefined/生の小数)。
// 加えて「穴(composeが喋れない効果kindが残ってる)」を③として拾う。これ以外はOK(意味・声の最終判定は阿部さんの耳)。
// 出力: /tmp/verify_all_results.json を上書き → 続けて _waza_verify_report.js でHTML再生成。
const fs = require('fs');
const { compose, clause, map, isFullyGated } = require('./_waza_compose.js');

// 機械漏れの検出: 子どもが読めない機械語。HP/PP/Zなど大文字の略語は許可(英小文字3連・true/false/undefined/null・0.125等の生小数・キーっぽい snake_case)
const LEAK = /[a-z]{3,}|[A-Za-z_]+_[A-Za-z_]+|\btrue\b|\bfalse\b|\bundefined\b|\bnull\b|\d\.\d{2,}/;

const out = [];
for (const m of Object.values(map)) {
  const eff = (m.battle_data && m.battle_data.effects) || [];
  if (!eff.length) continue;
  let text = '';
  try { text = compose(m).text || ''; } catch (e) { text = ''; }
  const empty = !text.trim();
  const leak = !empty && LEAK.test(text);
  // 穴 = composeが喋れない効果kindが1つでも残ってる(他の効果は喋れていても、その分の意味が落ちる)
  const holes = eff.filter(e => clause(e, m) === null && !(e.kind === '能力ランク変化' && e.on_charge_turn) && !isFullyGated(e)).map(e => e.kind);

  let verdict, problems = [];
  if (empty) { verdict = 'compose_fix'; problems.push('composeが空っぽ(エンジンに効果kindのcaseが無い)'); }
  else if (holes.length) { verdict = 'compose_fix'; problems.push('一部の効果をまだ喋れていない: ' + [...new Set(holes)].join('・')); }
  else { verdict = 'ok'; }

  out.push({ name: m.name, verdict, machine_leak: leak, compose_problems: problems, missing_in_effects: [], note: '機械チェックによる判定(空白/機械漏れ/穴)。意味・声の最終判定は阿部さんの耳。' });
}

fs.writeFileSync('/tmp/verify_all_results.json', JSON.stringify(out));
const cnt = { ok: 0, compose_fix: 0 };
out.forEach(x => cnt[x.verdict]++);
console.log('再判定(機械チェック):', out.length, '技 / OK', cnt.ok, '/ 要修正', cnt.compose_fix, '/ 機械漏れ', out.filter(x => x.machine_leak).length);
