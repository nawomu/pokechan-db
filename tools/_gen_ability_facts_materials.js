#!/usr/bin/env node
// _gen_ability_facts_materials.js — 「事実の表」量産の材料を1特性=1ファイルで生成(LLM不使用=引用と列挙のみ)
//
// 入力:
//   - reference/_ability_missing_triage.json … 仕分け済み(table_fact/table_and_desc の行だけ使う)
//   - reference/_r3_new_findings.json        … R3新発見候補(missing_in_ours / rebuttal_missed)
//   - reference/_ability_facts.json          … 既存の表(既に入っている事実=重複させない)
//   - reference/_authority_corpus/abilities/<名前>.json … Wiki生ページ(引用の実在の事前検査)
// 出力: <outdir>/<名前>.json = { ability, effect_ja, wiki_path, existing_facts, candidates[] }
//   candidates の quote_found_in_wiki は機械grep結果(空白無視)。false でも捨てない(エージェントが原文を確かめる)
//
// 使い方: node tools/_gen_ability_facts_materials.js <outdir> [名前...]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const outdir = process.argv[2];
if (!outdir) { console.error('usage: node tools/_gen_ability_facts_materials.js <outdir> [名前...]'); process.exit(1); }
fs.mkdirSync(outdir, { recursive: true });

const master = {};
J('master/abilities.json').items.forEach(a => { master[a.name] = a; });
const norm = n => {
  if (master[n]) return n;
  const s = String(n).replace(/\s*\([A-Za-z0-9 .'-]+\)\s*$/, '').trim();
  return master[s] ? s : null;
};

let facts = {}; try { facts = J('reference/_ability_facts.json').facts || {}; } catch (e) {}

const byAb = {};
const add = (name, row) => { const n = norm(name); if (!n) return console.error('⚠ masterに無い名前(捨てず記録):', name); (byAb[n] = byAb[n] || []).push(row); };

// ① 仕分け(table_fact / table_and_desc のみ。desc_add/drop/unsureはこの表に入れない)
const triage = J('reference/_ability_missing_triage.json');
for (const r of triage.results) {
  const v = r.value; if (!v || !Array.isArray(v.rows)) continue;
  for (const row of v.rows) {
    if (!['table_fact', 'table_and_desc'].includes(row.classification)) continue;
    add(v.ability, { from: '仕分け(' + (row.round || '') + ')', aspect: row.aspect || '', table_kind: row.table_kind || '',
      authority_quote: row.authority_quote || '', note: (row.reason || '').slice(0, 300),
      generation_caveat: !!row.generation_caveat });
  }
}
// ② R3新発見候補
const r3 = J('reference/_r3_new_findings.json');
for (const row of r3.new_rows) {
  if (!['missing_in_ours', 'rebuttal_missed'].includes(row.verdict)) continue;
  add(row.ability, { from: 'R3(' + row.verdict + ')', aspect: row.aspect || '', table_kind: '',
    authority_quote: row.authority_quote || '', note: (row.note || '').slice(0, 300), generation_caveat: false });
}

// 引用の事前grep(空白無視・先頭40字窓)
const squash = s => String(s).replace(/\s+/g, '');
let written = 0, totalCand = 0, preVerified = 0;
const names = process.argv.length > 3 ? process.argv.slice(3) : Object.keys(byAb).sort();
for (const name of names) {
  const cands = byAb[name] || [];
  if (!cands.length) continue;
  const wikiRel = 'reference/_authority_corpus/abilities/' + name + '.json';
  const wikiAbs = path.join(ROOT, wikiRel);
  let raw = null;
  if (fs.existsSync(wikiAbs)) { try { raw = squash(J(wikiRel).raw_text || ''); } catch (e) {} }
  for (const c of cands) {
    const q = squash(c.authority_quote);
    c.quote_found_in_wiki = !!(raw && q.length >= 10 && (raw.includes(q) || raw.includes(q.slice(0, 40))));
    if (c.quote_found_in_wiki) preVerified++;
    totalCand++;
  }
  fs.writeFileSync(path.join(outdir, name + '.json'), JSON.stringify({
    ability: name,
    effect_ja: master[name].effect_ja,
    wiki_path: fs.existsSync(wikiAbs) ? wikiAbs : null,
    existing_facts: facts[name] || [],
    candidates: cands,
  }, null, 1));
  written++;
}
console.log(`✍ ${written} 特性 / 候補 ${totalCand} 行(事前grepで引用実在 ${preVerified})→ ${outdir}`);
