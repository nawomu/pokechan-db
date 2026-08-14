#!/usr/bin/env node
// _gen_ability_audit_materials.js — 特性監査の照合材料(1件=1ファイル)を生成する。LLM不使用=引用と列挙のみ。
// (持ち物版 tools/_gen_item_audit_materials.js と同じ設計。権威の出どころだけ差し替え)
//
// 出力: <outdir>/<名前>.json = { master_row, yakkun_ch_effect, wiki_path, prev_findings }
//   - master_row: master/abilities.json の当該行(修正適用後の最新)
//   - yakkun_ch_effect: reference/_authority_corpus_ch/abilities_ch.json(ヤックン/ch/=Champions正典)
//   - wiki_path: reference/_authority_corpus/abilities/<名前>.json が実在すればそのパス
//   - prev_findings:
//       * known    = 過去ラウンドの台帳(reference/_ability_audit_round*.json)の指摘
//       * triage   = 2026-07-28 の三者照合(reference/_ch_ability_check_all.json・不一致90件)。
//                    ★これは「Champions正典 vs うちの説明 vs エンジン実装」の突き合わせ結果で、
//                    どこがズレているかの当たりが既についている。同じ指摘を繰り返させないために渡す。
//       * resolved = 適用済みの修正(reference/_abilities_fixes.json があれば)
//
// 使い方: node tools/_gen_ability_audit_materials.js <outdir> [名前...(省略時=全313件)]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const outdir = process.argv[2];
if (!outdir) { console.error('usage: node tools/_gen_ability_audit_materials.js <outdir> [名前...]'); process.exit(1); }
fs.mkdirSync(outdir, { recursive: true });

const master = J('master/abilities.json').items;
const chByName = {};
(J('reference/_authority_corpus_ch/abilities_ch.json').abilities || []).forEach(a => { chByName[a.name] = a; });
let fixes = {}; try { fixes = J('reference/_abilities_fixes.json').fixes || {}; } catch (e) {}

// 2026-07-28 の三者照合(不一致90件)
const triageByName = {};
try {
  J('reference/_ch_ability_check_all.json').forEach(r => { triageByName[r.name] = r; });
} catch (e) {}

// 過去ラウンドの台帳
const prevByName = {};
const add = (n, f) => { (prevByName[n] = prevByName[n] || []).push(f); };
for (const f of fs.readdirSync(path.join(ROOT, 'reference'))) {
  if (!/^_ability_audit_round\d+\.json$/.test(f)) continue;
  let d; try { d = J('reference/' + f); } catch (e) { continue; }
  const round = f.match(/round(\d+)/)[1];
  for (const e of (d.results || [])) {
    if (!e.name) continue;
    ((e.found && e.found.checks) || []).filter(c => c.verdict && c.verdict !== 'match')
      .forEach(c => add(e.name, { from: 'R' + round, aspect: c.aspect, verdict: c.verdict, authority_quote: c.authority_quote || '', note: c.note || '' }));
    const reb = e.rebuttal || {};
    ['overturned', 'missed'].forEach(k => (reb[k] || []).forEach(m =>
      add(e.name, { from: 'R' + round + ':反証', aspect: m.aspect || '', verdict: k, authority_quote: m.authority_quote || '', note: m.why || '' })));
  }
}

const names = process.argv.length > 3 ? process.argv.slice(3) : master.map(a => a.name);
let written = 0; const noWiki = [], noCh = [];
names.forEach(name => {
  const row = master.find(a => a.name === name);
  if (!row) { console.error(`✗ masterに無い: ${name}`); process.exit(1); }
  const wikiAbs = path.join(ROOT, 'reference/_authority_corpus/abilities', `${name}.json`);
  const hasWiki = fs.existsSync(wikiAbs);
  if (!hasWiki) noWiki.push(name);
  const ch = chByName[name];
  if (!ch) noCh.push(name);
  const resolved = [];
  if (fixes[name]) resolved.push({ what: `修正適用済み: ${Object.keys(fixes[name]).filter(k => k !== 'basis').join('/')}`, basis: fixes[name].basis || '' });
  fs.writeFileSync(path.join(outdir, `${name}.json`), JSON.stringify({
    master_row: row,
    yakkun_ch_effect: ch ? ch.effect : null,
    yakkun_ch_meta: ch ? { id: ch.id, en: ch.en, champions_pokemon_count: ch.champions_pokemon_count } : null,
    wiki_path: hasWiki ? wikiAbs : null,
    prev_findings: {
      note: 'triage=2026-07-28の三者照合で既に当たりが付いている不一致(Champions正典/うちの説明/エンジン実装)。known=過去ラウンドの指摘=繰り返し不要。resolved=適用済み',
      resolved, triage: triageByName[name] || null, known: prevByName[name] || [],
    },
  }, null, 1), 'utf8');
  written++;
});
console.log(`✍ ${written}件 → ${outdir}`);
if (noWiki.length) console.log(`⚠ Wiki生ページ無し ${noWiki.length}件: ${noWiki.slice(0, 12).join('、')}${noWiki.length > 12 ? '…' : ''}`);
if (noCh.length) console.log(`⚠ /ch/効果文無し ${noCh.length}件: ${noCh.slice(0, 12).join('、')}${noCh.length > 12 ? '…' : ''}`);
