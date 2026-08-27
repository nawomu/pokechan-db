#!/usr/bin/env node
// _gen_move_audit_materials.js — 技監査の照合材料(1件=1ファイル)を生成する。LLM不使用=引用と列挙のみ。
// (特性版 tools/_gen_ability_audit_materials.js と同じ設計。違いは2点:
//   ①主キー=slug。技は同名の別技が18組ある(Z技の物理版/特殊版)。名前をキーにすると潰れる
//   ②権威の出どころ: Champions正典=reference/_authority_corpus_ch/moves_ch.json(497技・効果/対象つき
//     2026-08-21取り直し版) / ポケモンWiki生ページ=reference/_authority_corpus/moves/<名前>.json)
//
// 出力: <outdir>/<slug>.json = { master_row, yakkun_ch_row, wiki_path, prev_findings }
//
// 使い方: node tools/_gen_move_audit_materials.js <outdir> [slug...(省略時=全919件)]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const outdir = process.argv[2];
if (!outdir) { console.error('usage: node tools/_gen_move_audit_materials.js <outdir> [slug...]'); process.exit(1); }
fs.mkdirSync(outdir, { recursive: true });

const nfkc = s => String(s || '').normalize('NFKC');
const master = J('master/moves.json').items;

// Champions正典(497技)。名前は半角=masterと同じ正規化で照合
const chByName = {};
(J('reference/_authority_corpus_ch/moves_ch.json').moves || []).forEach(m => { chByName[nfkc(m.name)] = m; });

// Wiki生ページはファイル名が全角(NFKCで名寄せ)
const wikiDir = path.join(ROOT, 'reference/_authority_corpus/moves');
const wikiByName = {};
fs.readdirSync(wikiDir).forEach(f => { if (f.endsWith('.json')) wikiByName[nfkc(f.replace(/\.json$/, ''))] = path.join(wikiDir, f); });

// 過去ラウンドの台帳(reference/_move_audit_round*.json)。キーは slug(無ければ name)
const prevByKey = {};
const add = (k, f) => { (prevByKey[k] = prevByKey[k] || []).push(f); };
for (const f of fs.readdirSync(path.join(ROOT, 'reference'))) {
  if (!/^_move_audit_round\d+\.json$/.test(f)) continue;
  let d; try { d = J('reference/' + f); } catch (e) { continue; }
  const round = f.match(/round(\d+)/)[1];
  for (const e of (d.results || [])) {
    const key = e.slug || e.name; if (!key) continue;
    ((e.found && e.found.checks) || []).filter(c => c.verdict && c.verdict !== 'match')
      .forEach(c => add(key, { from: 'R' + round, aspect: c.aspect, verdict: c.verdict, authority_quote: c.authority_quote || '', note: c.note || '' }));
    const reb = e.rebuttal || {};
    ['overturned', 'missed'].forEach(k => (reb[k] || []).forEach(m =>
      add(key, { from: 'R' + round + ':反証', aspect: m.aspect || '', verdict: k, authority_quote: m.authority_quote || '', note: m.why || '' })));
  }
}

const slugs = process.argv.length > 3 ? process.argv.slice(3) : master.map(m => m.slug);
let written = 0; const noWiki = [], noCh = [];
slugs.forEach(slug => {
  const row = master.find(m => m.slug === slug);
  if (!row) { console.error(`✗ masterに無い: ${slug}`); process.exit(1); }
  const wikiPath = wikiByName[nfkc(row.name)] || null;
  if (!wikiPath) noWiki.push(row.name);
  const ch = chByName[nfkc(row.name)] || null;
  if (!ch && row.champions) noCh.push(row.name);
  fs.writeFileSync(path.join(outdir, `${slug}.json`), JSON.stringify({
    master_row: row,
    yakkun_ch_row: ch,   // Champions正典の行まるごと(type/分類/威力/命中/PP/接触/守る/対象/効果)。null=Championsに無い技
    wiki_path: wikiPath, // ポケモンWiki生ページ全文(null以外なら全文読む)
    prev_findings: {
      note: 'known=過去ラウンドの指摘=繰り返し不要',
      known: prevByKey[slug] || prevByKey[row.name] || [],
    },
  }, null, 1), 'utf8');
  written++;
});
console.log(`✍ ${written}件 → ${outdir}`);
if (noWiki.length) console.log(`⚠ Wiki生ページ無し ${noWiki.length}件: ${noWiki.slice(0, 12).join('、')}${noWiki.length > 12 ? '…' : ''}`);
if (noCh.length) console.log(`⚠ champions=trueなのに/ch/行無し ${noCh.length}件: ${noCh.slice(0, 12).join('、')}${noCh.length > 12 ? '…' : ''}`);
