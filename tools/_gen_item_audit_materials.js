#!/usr/bin/env node
// 持ち物監査の照合材料(1件=1ファイル)を生成する。LLM不使用=引用と列挙のみ。
// 出力: <outdir>/<名前>.json = { master_row, yakkun_ch_effect, wiki_path, prev_findings }
//   - master_row: master/items.json の当該行(修正適用後の最新)
//   - yakkun_ch_effect: reference/_authority_corpus_ch/items_ch_full.json(4表・img alt復元済み)から名前一致で引く。無ければ null
//   - wiki_path: reference/_authority_corpus/items/<名前>.json が実在すればそのパス。無ければ null
//   - prev_findings: パイロット+ラウンド1台帳の当該件の指摘(既知)+適用済み修正(resolved)
// 使い方: node tools/_gen_item_audit_materials.js <outdir> [名前...(省略時=全169件)]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const outdir = process.argv[2];
if (!outdir) { console.error('usage: node tools/_gen_item_audit_materials.js <outdir> [名前...]'); process.exit(1); }
fs.mkdirSync(outdir, { recursive: true });

const master = J('master/items.json').items;
const chFull = J('reference/_authority_corpus_ch/items_ch_full.json');
const fixes = J('reference/_items_fixes.json').fixes || {};

// /ch/ 4表 → 名前→効果文(同名が複数表にあれば結合)
const chByName = {};
Object.values(chFull.tables).forEach(rows => rows.forEach(([name, effect]) => {
  if (!name) return;
  chByName[name] = chByName[name] ? chByName[name] + '\n' + effect : effect;
}));

// 過去ラウンドの台帳 → 名前→指摘リスト(verdictがmatch以外のchecks+反証のmissed/overturned)
const prevByName = {};
const addFinding = (name, f) => { (prevByName[name] = prevByName[name] || []).push(f); };
for (const ledger of ['reference/_item_audit_pilot.json', 'reference/_item_audit_round1.json', 'reference/_item_audit_round2.json']) {
  let d; try { d = J(ledger); } catch (e) { continue; }
  const entries = Array.isArray(d) ? d : (d.results || []);
  entries.forEach(e => {
    const name = e.name; if (!name) return;
    const checks = (e.found && e.found.checks) || [];
    checks.filter(c => c.verdict && c.verdict !== 'match').forEach(c =>
      addFinding(name, { from: ledger.replace('reference/_item_audit_', '').replace('.json', ''), aspect: c.aspect, verdict: c.verdict, authority_quote: c.authority_quote || '', note: c.note || '' }));
    const reb = e.rebuttal || {};
    ['overturned', 'missed'].forEach(k => (reb[k] || []).forEach(m =>
      addFinding(name, { from: ledger.replace('reference/_item_audit_', '').replace('.json', '') + ':反証', aspect: m.aspect || '', verdict: k, authority_quote: m.authority_quote || '', note: m.why || '' })));
  });
}

const names = process.argv.length > 3 ? process.argv.slice(3) : master.map(it => it.name);
let written = 0, noWiki = [], noCh = [];
names.forEach(name => {
  const row = master.find(it => it.name === name);
  if (!row) { console.error(`✗ masterに無い: ${name}`); process.exit(1); }
  const wikiRel = `reference/_authority_corpus/items/${name}.json`;
  const wikiAbs = path.join(ROOT, wikiRel);
  const hasWiki = fs.existsSync(wikiAbs);
  if (!hasWiki) noWiki.push(name);
  if (!chByName[name]) noCh.push(name);
  const resolved = [];
  if (fixes[name]) resolved.push({ what: `修正適用済み(2026-08-02〜): ${Object.keys(fixes[name]).filter(k => k !== 'basis').join('/')} を正典化`, basis: fixes[name].basis || '', applied: fixes[name] });
  if ((row.effect_ja || '').includes('戦闘中1回') || (chByName[name] || '').includes('メガシンカ'))
    resolved.push({ what: '「(戦闘中1回)」等の回数表記=阿部さん決定で意図的に復元(2026-08-01)。指摘不要' });
  fs.writeFileSync(path.join(outdir, `${name}.json`), JSON.stringify({
    master_row: row,
    yakkun_ch_effect: chByName[name] || null,
    wiki_path: hasWiki ? wikiAbs : null,
    prev_findings: { note: 'known=過去ラウンド(パイロット/ラウンド1)で既に指摘済み=繰り返し不要。resolved=決定・適用済み=指摘不要', resolved, known: prevByName[name] || [] },
  }, null, 1), 'utf8');
  written++;
});
console.log(`✍ ${written}件 → ${outdir}`);
if (noWiki.length) console.log(`⚠ Wiki生ページ無し(wiki_path=null) ${noWiki.length}件: ${noWiki.join('、')}`);
if (noCh.length) console.log(`⚠ /ch/効果文無し(yakkun_ch_effect=null) ${noCh.length}件: ${noCh.join('、')}`);
