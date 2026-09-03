#!/usr/bin/env node
// Bulbapedia 種ページの「Learnset」節(最新世代の表)を裏溜めする(A3 全国行の第3ソース・2026-09-04)
//   出力: reference/_genus_material/bulba_learn_<種名>.txt
//   形式: "##H4 <見出し>" / "##TABLE <表の頭(Generation/タブ)>" / 1行1セル(テキスト化)。監査器 tools/_wiki_learnset_audit.js 側で読む。
//   対象: 引数の種名(無ければ _wiki_learnset_audit.json の national diff/wiki_newer/no_form 行の種)。既存(>500B)はスキップ。
const fs = require('fs'), path = require('path');
const DIR = 'reference/_genus_material';
const EN = require('../i18n/en.json').pokemon;
const P = require('../master/pokemon.json').items;
const { speciesOf } = require('./_fetch_wiki_champions_learnsets.js');
// 種名→Bulbapediaのページ名: メガ/ゲンシは元の種・フォーム付きの行しか無い種は括弧を落とす・フォーム名しか無い訳語は種名へ
const EN_SPECIAL = { 'Normal': 'Castform', 'Zen Mode': 'Darmanitan', 'Hero of Many Battles': 'Zamazenta', 'Teal Mask': 'Ogerpon' };
const enName = sp => { const base = speciesOf(sp); const r = P.find(x => x.name === base) || P.find(x => x.name.startsWith(base)); let v = r && EN[r.name]; v = typeof v === 'string' ? v : v && v.name; if (!v) return null; v = v.replace(/\s*\(.*\)$/, ''); return EN_SPECIAL[v] || v; };
let species = process.argv.slice(2);
if (!species.length) {
  const a = require('../reference/_wiki_learnset_audit.json');
  species = [...new Set(a.rows.filter(r => r.kind === 'national' && ['diff', 'wiki_newer', 'no_form'].includes(r.status)).map(r => r.name.replace(/[（(].*$/, '')))];
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = h => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').split('\n').map(s => s.trim()).filter(Boolean).join('\n');
function toText(html) {
  const i = html.indexOf('id="Learnset"'); if (i < 0) return null;
  let j = html.indexOf('<h3', i + 10); if (j < 0) j = html.length;
  const seg = html.slice(i, j);
  const out = [];
  // h4 と table の並びで切る(tableの入れ子=外側の枠 table は「Generation」を含む頭・内側=データ表)
  const re = /<h4[^>]*>([\s\S]*?)<\/h4>|<table[^>]*>/g; let m, last = 0;
  const pushText = (s, e) => { const t = strip(seg.slice(s, e)); if (t) out.push(t); };
  while ((m = re.exec(seg))) {
    pushText(last, m.index);
    if (m[0].startsWith('<h4')) out.push('##H4 ' + strip(m[1]).replace(/\n/g, ' '));
    else out.push('##TABLE');
    last = m.index + m[0].length;
  }
  pushText(last, seg.length);
  return out.join('\n');
}
(async () => {
  const fails = [];
  for (const sp of species) {
    const f = path.join(DIR, `bulba_learn_${speciesOf(sp)}.txt`);
    if (fs.existsSync(f) && fs.statSync(f).size > 500) continue;
    const en = enName(sp); if (!en) { fails.push({ sp, why: 'no_en' }); continue; }
    const url = 'https://bulbapedia.bulbagarden.net/wiki/' + encodeURIComponent(en.replace(/ /g, '_')) + '_(Pok%C3%A9mon)';
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (pchamdb learnset audit)' } });
      if (!r.ok) { fails.push({ sp, en, status: r.status }); await sleep(700); continue; }
      const t = toText(await r.text());
      if (!t) { fails.push({ sp, en, why: 'no_learnset' }); await sleep(700); continue; }
      fs.writeFileSync(f, `#SOURCE ${url}\n#EN ${en}\n` + t + '\n');
      console.log('ok', sp, en, t.length);
    } catch (e) { fails.push({ sp, en, why: String(e).slice(0, 80) }); }
    await sleep(700);
  }
  fs.writeFileSync(path.join(DIR, '_fetch_bulba_learn_fail.json'), JSON.stringify(fails, null, 1));
  console.log('done', species.length, 'fails', fails.length);
})();
