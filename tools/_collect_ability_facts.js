#!/usr/bin/env node
// _collect_ability_facts.js — 清書WFの journal.jsonl から「事実の表」(_ability_facts.json)へ回収する(LLM不使用)
//
// 番人を兼ねる: 取り込む前に全行を機械検査し、通らない行は表に入れず rejected として別記する。
//   ① ability 名が master に実在するか(正規化つき)
//   ② kind が 数値/条件/除外 のどれかか
//   ③ authority_quote が Wiki生ページの raw_text に**一字一句**(空白無視)実在するか
//      … Wikiページが無い特性の行は quote_unverifiable として rejected(推測・捏造を構造的に締め出す)
//
// 使い方: node tools/_collect_ability_facts.js <runId> [runId...]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const runIds = process.argv.slice(2);
if (!runIds.length) { console.error('usage: node tools/_collect_ability_facts.js <runId> [runId...]'); process.exit(1); }

const master = {};
J('master/abilities.json').items.forEach(a => { master[a.name] = a; });
const norm = n => {
  n = String(n).replace(/^["'「『]+|["'」』]+$/g, '').trim();
  if (master[n]) return n;
  const s = n.replace(/[_\s]*[((]?R\d+[^ ]*$/, '').replace(/\s*\([A-Za-z0-9 .'-]+\)\s*$/, '').trim();
  return master[s] ? s : null;
};
const squash = s => String(s).replace(/\s+/g, '');

const projRoot = path.join(process.env.HOME, '.claude', 'projects');
function findJournal(runId) {
  let hit = null;
  const walk = dir => {
    if (hit) return;
    let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of es) {
      if (hit) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name === runId) { const j = path.join(p, 'journal.jsonl'); if (fs.existsSync(j)) { hit = j; return; } } walk(p); }
    }
  };
  walk(projRoot);
  return hit;
}

const ledger = J('reference/_ability_facts.json');
ledger.facts = ledger.facts || {};
const rejected = [];
const mbRelated = [];
let seenAbilities = 0, accepted = 0, dupSkipped = 0;

const wikiCache = {};
function wikiRaw(name) {
  if (name in wikiCache) return wikiCache[name];
  const p = path.join(ROOT, 'reference/_authority_corpus/abilities', name + '.json');
  let raw = null;
  if (fs.existsSync(p)) { try { raw = squash(J('reference/_authority_corpus/abilities/' + name + '.json').raw_text || ''); } catch (e) {} }
  return (wikiCache[name] = raw);
}

for (const runId of runIds) {
  const journal = findJournal(runId);
  if (!journal) { console.error('✗ journalが見つからない:', runId); process.exit(1); }
  for (const line of fs.readFileSync(journal, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let j; try { j = JSON.parse(line); } catch (e) { continue; }
    if (j.type !== 'result' || !j.result || !Array.isArray(j.result.rows)) continue;
    const name = norm(j.result.ability);
    if (!name) { rejected.push({ ability: j.result.ability, why: 'masterに無い特性名' }); continue; }
    seenAbilities++;
    const existing = ledger.facts[name] || [];
    const existQuotes = new Set(existing.map(r => squash(r.authority_quote)));
    const raw = wikiRaw(name);
    for (const r of j.result.rows) {
      if (!['数値', '条件', '除外'].includes(r.kind)) { rejected.push({ ability: name, fact: r.fact, why: 'kind不正: ' + r.kind }); continue; }
      const q = squash(r.authority_quote || '');
      if (q.length < 10) { rejected.push({ ability: name, fact: r.fact, why: '引用が短すぎ/空' }); continue; }
      if (!raw) { rejected.push({ ability: name, fact: r.fact, why: 'quote_unverifiable(Wiki生ページ無し)' }); continue; }
      if (!raw.includes(q)) { rejected.push({ ability: name, fact: r.fact, quote: (r.authority_quote || '').slice(0, 120), why: '引用がWiki原文に一字一句実在しない' }); continue; }
      if (existQuotes.has(q)) { dupSkipped++; continue; }
      existQuotes.add(q);
      existing.push({ kind: r.kind, fact: r.fact, authority_quote: r.authority_quote, source: r.source || '',
        generation_caveat: !!r.generation_caveat, origin: r.origin || '' });
      accepted++;
    }
    if (existing.length) ledger.facts[name] = existing;
    for (const m of (j.result.mold_breaker_related || [])) mbRelated.push({ ability: name, ...m });
  }
}

ledger.collected_at = new Date().toISOString();
ledger.ability_count = Object.keys(ledger.facts).length;
ledger.row_count = Object.values(ledger.facts).reduce((a, v) => a + v.length, 0);
fs.writeFileSync(path.join(ROOT, 'reference/_ability_facts.json'), JSON.stringify(ledger, null, 1));
fs.writeFileSync(path.join(ROOT, 'reference/_ability_facts_rejected.json'), JSON.stringify({
  what: '清書WFの行のうち機械検査(引用の一字一句実在/名前/kind)を通らなかったもの。表には入れていない。再走 or 個別確認の対象',
  collected_at: new Date().toISOString(), count: rejected.length, rejected,
  mold_breaker_related: mbRelated,
}, null, 1));
console.log(`✍ _ability_facts.json: 特性${ledger.ability_count} 行${ledger.row_count}(今回受入${accepted}/重複スキップ${dupSkipped})`);
console.log(`✍ _ability_facts_rejected.json: 却下${rejected.length} かたやぶり分離${mbRelated.length}`);
