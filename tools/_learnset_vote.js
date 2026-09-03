// tools/_learnset_vote.js — 全国行(PokeAPI暫定)の覚える技を Wiki × Bulbapedia × PokeAPI の3者で1技ずつ投票(A3 第2部・2026-09-04)
//   ルール(two-source-verify): Wiki最新世代表 と Bulbapedia最新世代表 が一致した技だけ採用(PokeAPI=現状 が違えば直す)。
//   W≠B の技は現状維持で unresolved に残す。Z-A(第九世代扱い・PP無し/CD制)は両方で除外=「最新作品」は SV/SwSh/BDSP/LA まで。
//   種類は level/tm/egg/tutor のみ(イベント配布/過去作/進化前限定は比べない)。
//   出力: reference/_learnset_vote.json  / --apply で reference/_learnsets_fixes.json に根拠つきでマージ(同名キーは上書きでなく更新)
const fs = require('fs'), path = require('path');
const A = require('./_wiki_learnset_audit.js');
const { parseNational, pickForm, formOf, VG_GEN, VG_TAG, DIR } = A;
const L = require('../master/learnsets.json').items;
const EN = require('../i18n/en.json');
const MOVES = require('../master/moves.json').items;
const nm = v => typeof v === 'string' ? v : v && v.name;
const en2ja = {}; Object.entries(EN.moves).forEach(([slug, v]) => { const m = MOVES.find(x => x.slug === slug); if (m && nm(v)) en2ja[nm(v)] = m.name; });
Object.assign(en2ja, { 'Vice Grip': 'はさむ', 'Hi Jump Kick': 'とびひざげり', 'Faint Attack': 'だましうち', 'Smelling Salt': 'きつけ', 'Sand-Attack': 'すなかけ', 'Softboiled': 'タマゴうみ', 'SolarBeam': 'ソーラービーム', 'ThunderPunch': 'かみなりパンチ', 'DynamicPunch': 'ばくれつパンチ' });
const TYPES_EN = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
const TAB_TOK = new Set(['S','V','Sw','Sh','BD','SP','LA','ZA','P','E','US','UM','Su','Mo','SM','LGPE','X','Y','OR','AS','ΩR','αS']);
// タブ記号の並び(例 Sw Sh BD SP = SwSh と BDSP 共通の表)→ 作品の集合。空=その世代の全作品共通
const TAB_OF = toks => { const t = toks.join(','), g = []; if (/S,V/.test(t) || toks.includes('SV')) g.push('SV'); if (/Sw,Sh/.test(t)) g.push('SwSh'); if (/BD,SP/.test(t)) g.push('BDSP'); if (toks.includes('LA')) g.push('LA'); if (toks.includes('ZA')) g.push('ZA'); if (/P,E/.test(t)) g.push('LGPE'); if (/US,UM/.test(t)) g.push('USUM'); return g; };
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 };
const KIND_OF = h => /leveling/i.test(h) ? 'level' : /^By TM/i.test(h) ? 'tm' : /breeding/i.test(h) ? 'egg' : /tutoring/i.test(h) ? 'tutor' : null;

// ── Bulbapedia: "##H4 <kind>" / [形ラベル] [タブ] ##TABLE ##TABLE Generation X ##TABLE (other gens) ##TABLE <データ表> … Bold …
function parseBulba(txt) {
  const Ls = txt.split('\n'); const tables = []; let kind = null, label = null, pend = [];
  for (let i = 0; i < Ls.length; i++) {
    const x = Ls[i];
    if (x.startsWith('##H4')) { kind = KIND_OF(x.slice(5).trim()); label = null; pend = []; continue; }
    if (!kind) continue;
    if (x === '##TABLE' && Ls[i + 1] === '##TABLE' && /^Generation (I|II|III|IV|V|VI|VII|VIII|IX)$/.test(Ls[i + 2] || '')) {
      const gen = ROMAN[Ls[i + 2].split(' ')[1]];
      const toks = pend.filter(t => TAB_TOK.has(t)), labs = pend.filter(t => !TAB_TOK.has(t) && !/^(Other generations|Bold|Italic|Click|indicates|STAB|when used|-)/.test(t) && !/^[IVX]+$/.test(t));
      if (labs.length) label = labs[labs.length - 1];
      const tab = TAB_OF(toks);
      // データ表 = この後 3つ目の ##TABLE
      let j = i + 3, n = 0; while (j < Ls.length && n < 2) { if (Ls[j] === '##TABLE') n++; j++; }
      const t = { kind, gen, tab, label, moves: [], unknown: [], za: tab.length === 1 && tab[0] === 'ZA' }; tables.push(t);
      let hdr = true;
      for (; j < Ls.length; j++) {
        const y = Ls[j];
        if (y.startsWith('##') || /^(Bold|Italic)$/.test(y)) break;
        if (hdr && y === 'CD') t.za = true;   // Z-A表(CD列)=除外
        if (TYPES_EN.includes(Ls[j + 1]) && /^(Physical|Special|Status)$/.test(Ls[j + 2] || '')) { hdr = false; const name = /^[*^‡]$|^[A-Z]{2}$/.test(y) ? Ls[j - 1] : y; const ja = en2ja[name]; if (ja) t.moves.push(ja); else t.unknown.push(name); }   // 「Present *」=脚注記号(連鎖遺伝等)は前の行が技名
      }
      pend = []; i = j - 1; continue;
    }
    if (!x.startsWith('##')) pend.push(x);
  }
  return tables;
}
const VG_OF = { 9: 'scarlet-violet', SwSh: 'sword-shield', BDSP: 'brilliant-diamond-and-shining-pearl', LA: 'legends-arceus' };
const pickBulbaForm = (tables, row, species) => {
  tables.forEach(t => { if (t.label && (/\.$/.test(t.label) || /^All |can learn| and /.test(t.label))) t.label = ''; });   // 脚注文・「All regular forms」・「A and B …」=共通
  const labels = [...new Set(tables.map(t => t.label || ''))];
  const enRow = nm(EN.pokemon[row.name]) || '', enSp = nm(EN.pokemon[species]) || species;
  const f = formOf(row.name); const enF = (enRow.match(/\((.*)\)$/) || [])[1];
  if (f && /ダルマモード|ノーマルモード/.test(f)) { const f2 = f.replace(/\s*(ダルマモード|ノーマルモード)\s*/g, '').trim(); return pickBulbaForm(tables, { name: f2 ? `${species}(${f2})` : species }, species); }   // モードで技は変わらない
  // ★地方のすがたは、その地方名(Alolan等)を持つ見出しが無ければ「その作品に居ない」= 共通表を流用しない
  const region = (f && f.match(/アローラ|ガラル|ヒスイ|パルデア/) || [])[0];
  const REGION_EN = { 'アローラ': 'Alolan', 'ガラル': 'Galarian', 'ヒスイ': 'Hisuian', 'パルデア': 'Paldean' };
  if (region && !labels.some(l => l.includes(REGION_EN[region]))) return null;
  if (labels.length === 1) return tables;
  const pick = lab => tables.filter(t => (t.label || '') === lab);
  const enF1 = enF && enF.replace(/ Form$/, '');   // "Blue-Striped Form" → "Blue-Striped"
  const cand = labels.find(l => l && l === enRow) || (enF && labels.find(l => l && (l === enF || l.includes(enF) || enF.includes(l) || (enF1 && l.split('/').some(p => p.trim().startsWith(enF1))))))
    || (!f && !/^(メガ|ゲンシ)/.test(row.name) && (labels.find(l => l === enSp) || labels.filter(l => l && enRow.includes(l)).sort((a, b) => b.length - a.length)[0] || labels.find(l => l === '')))   // "Standard Galarian Darmanitan" ⊃ "Galarian Darmanitan"(最長一致)
    || (/^(メガ|ゲンシ)/.test(row.name) && (labels.find(l => l === enSp) || labels.find(l => l === '')));
  // 見つからない時: 行の英名に含まれる最長のラベル("Darmanitan (Zen Mode)"⊃"Darmanitan")→ 無ければ共通表
  const cand2 = cand ? cand : (labels.filter(l => l && enRow.includes(l)).sort((a, b) => b.length - a.length)[0] ?? (labels.includes('') ? '' : null));
  if (cand2 == null) return null;
  const got = pick(cand2); const has = new Set(got.map(t => t.kind));
  return cand2 ? got.concat(tables.filter(t => !t.label && !has.has(t.kind))) : got;   // 共通表(見出し無し)を、無い種類だけ足す
};

module.exports = { parseBulba, pickBulbaForm };
if (require.main === module) main();
function main() {
const filt = process.argv.find(a => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]);
const APPLY = process.argv.includes('--apply');
const out = [], sum = { rows: 0, no_bulba: 0, no_bform: 0, no_wform: 0, agree_all: 0, changed: 0, unresolved_only: 0, gen_fixed: 0, add: 0, remove: 0, unresolved: 0, unknown_en: {} };
for (const r of L) {
  if (r.champions) continue; if (filt && !r.name.includes(filt)) continue;
  sum.rows++;
  const sp = String(r.name).replace(/[（(].*$/, '');
  const wf = path.join(DIR, `wiki_${sp}.txt`), bf = path.join(DIR, `bulba_learn_${A.speciesOf(sp)}.txt`);
  const res = { name: r.name, vg: r.latest_version_group };
  // Wiki
  const wt0 = fs.existsSync(wf) ? (parseNational(fs.readFileSync(wf, 'utf8')) || []).filter(t => ['level','tm','egg','tutor'].includes(t.kind)) : [];
  const wt = wt0.filter(t => t.tag !== 'ZA');
  // 「共通」「オス・メス」「ハイなすがた・ローなすがたで共通。」= 全すがた共通の表 → 見出し無し扱い
  wt.forEach(t => { if (t.form && /共通|・/.test(t.form)) t.form = null; });
  // ★第九世代が Z-A だけの種(ポッポ等)は Wiki種ページに SV/第八世代の表が無い(別ページ)。Z-Aは比べない方針 → 保留(🙋 Z-Aを「最新作品」に数えるか要判断)
  if (!wt.length && wt0.length) { sum.za_only = (sum.za_only || 0) + 1; out.push({ ...res, status: 'za_only' }); continue; }
  const forms = [...new Set(wt.map(t => t.form || ''))];
  const wg = pickForm(forms.map(fm => ({ form: fm || null, label: fm || null, tables: wt.filter(t => (t.form || '') === fm) })), r, sp);
  if (!wg) { sum.no_wform++; out.push({ ...res, status: 'no_wform', forms }); continue; }
  // 基本のすがた(括弧なし)の行には、見出し無しの表(LAブロック等)も足す
  if (!formOf(r.name) && wg.form) wg.tables = wg.tables.concat(wt.filter(t => !t.form));
  // すがた行: 選んだ群に無い種類(TM/タマゴ/教え)の見出し無し表=共通表 → 足す(シェイミ: レベルだけ形別・TMは共通)
  else if (wg.form) { const has = new Set(wg.tables.map(t => t.kind)); wg.tables = wg.tables.concat(wt.filter(t => !t.form && !has.has(t.kind))); }
  const wikiGen = Math.max(0, ...wg.tables.filter(t => t.kind === 'level').map(t => t.gen));
  // Bulbapedia
  if (!fs.existsSync(bf)) { sum.no_bulba++; out.push({ ...res, status: 'no_bulba' }); continue; }
  const bt0 = parseBulba(fs.readFileSync(bf, 'utf8')).filter(t => !t.za);
  const bt = pickBulbaForm(bt0, r, sp);
  if (!bt || !bt.length) { sum.no_bform++; out.push({ ...res, status: 'no_bform', labels: [...new Set(bt0.map(t => t.label))] }); continue; }
  bt.forEach(t => t.unknown.forEach(u => { sum.unknown_en[u] = (sum.unknown_en[u] || 0) + 1; }));
  const bGen = Math.max(0, ...bt.filter(t => t.kind === 'level').map(t => t.gen));
  const ourGen = VG_GEN[r.latest_version_group] || 0;
  // 作品(G)を決める: Wiki と Bulbapedia の最新世代が一致していればそれ。第8世代はタブ(SwSh/BDSP/LA)の一致で決める
  if (wikiGen !== bGen) { out.push({ ...res, status: 'gen_disagree', wikiGen, bGen, ourGen }); sum.unresolved_only++; continue; }
  let G = null, vg = r.latest_version_group;
  if (wikiGen === 9) { G = 'SV'; vg = VG_OF[9]; }
  else if (wikiGen === 8) {
    const wt8 = new Set(wg.tables.filter(t => t.gen === 8 && t.tag).map(t => t.tag)), bt8 = new Set(bt.filter(t => t.gen === 8).flatMap(t => t.tab));
    const both = ['LA','BDSP','SwSh'].filter(g => wt8.has(g) && bt8.has(g));
    const either = ['LA','BDSP','SwSh'].filter(g => (wt8.size ? wt8.has(g) : true) && (bt8.size ? bt8.has(g) : true));   // 片方が無印(その世代1作品だけ)なら他方のタグに従う
    const ourTag = ourGen === 8 ? VG_TAG[r.latest_version_group] : null;
    G = ourTag && either.includes(ourTag) ? ourTag : (both[0] || either[0] || (!wt8.size && !bt8.size ? 'SwSh' : null));
    if (!G) { out.push({ ...res, status: 'gen8_tab_disagree', wt8: [...wt8], bt8: [...bt8] }); sum.unresolved_only++; continue; }
    vg = VG_OF[G];
  } else { out.push({ ...res, status: 'old_gen', wikiGen, ourGen }); sum.unresolved_only++; continue; }
  // ★LAの表は両サイトとも必ず LA と明示される → G=LA では見出し無し表(=SwSh/BDSP共通)を混ぜない(パラスのBDSP技がLA行に入る事故)
  const okW = t => G === 'LA' ? t.tag === 'LA' : (!t.tag || t.tag === 'SV' || t.tag === G);
  const okB = t => G === 'LA' ? t.tab.includes('LA') : (!t.tab.length || t.tab.includes(G));
  const W = new Map(); wg.tables.filter(t => t.gen === wikiGen && okW(t)).forEach(t => t.moves.forEach(m => { if (!W.has(m)) W.set(m, t.kind); }));
  const B = new Map(); bt.filter(t => t.gen === bGen && okB(t)).forEach(t => t.moves.forEach(m => { if (!B.has(m)) B.set(m, t.kind); }));
  const P = new Set(r.learn);
  const all = new Set([...W.keys(), ...B.keys(), ...P]);
  const add = [], remove = [], unresolved = [];
  for (const m of all) {
    const w = W.has(m), b = B.has(m), p = P.has(m);
    if (w === b) { if (w && !p) add.push(m); else if (!w && p) remove.push(m); }
    else unresolved.push(`${m}[W:${w ? W.get(m) : '-'} B:${b ? B.get(m) : '-'} P:${p ? '○' : '-'}]`);
  }
  const genFix = vg !== r.latest_version_group;
  Object.assign(res, { status: (add.length || remove.length || genFix) ? 'changed' : unresolved.length ? 'unresolved_only' : 'agree', G, vg_new: genFix ? vg : undefined, wikiGen, W_n: W.size, B_n: B.size, P_n: P.size, add: add.map(m => m + '[' + W.get(m) + '/' + B.get(m) + ']'), remove, unresolved });
  sum[res.status]++; if (genFix) sum.gen_fixed++; sum.add += add.length; sum.remove += remove.length; sum.unresolved += unresolved.length;
  if (res.status === 'agree') sum.agree_all++;
  out.push(res);
}
sum.agree_all = sum.agree || 0; delete sum.agree;
fs.writeFileSync('reference/_learnset_vote.json', JSON.stringify({ voted_at: new Date().toISOString().slice(0, 10), rule: 'Wiki最新世代表 × Bulbapedia最新世代表 が一致した技だけ採用(PokeAPIが違えば直す)。W≠B は現状維持=unresolved。Z-A/イベント/過去作/進化前限定は比べない', summary: sum, rows: out }, null, 1));
console.log(JSON.stringify(sum));
if (filt) console.log(JSON.stringify(out, null, 1));
if (APPLY) {
  const fp = 'reference/_learnsets_fixes.json'; const fx = JSON.parse(fs.readFileSync(fp, 'utf8')); fx.fixes = fx.fixes || {};
  let n = 0;
  for (const r of out) {
    if (r.status !== 'changed') continue;
    const cur = fx.fixes[r.name] || {};
    const add = [...new Set([...(cur.learn_add || []), ...r.add.map(m => m.replace(/\[.*$/, ''))])].filter(m => !r.remove.includes(m));
    const rem = [...new Set([...(cur.learn_remove || []), ...r.remove])].filter(m => !add.includes(m));
    const e = { ...cur, learn_add: add, learn_remove: rem, source: 'wiki_bulbapedia_verified' };
    if (r.vg_new) e.set = { ...(cur.set || {}), latest_version_group: r.vg_new };
    e['根拠'] = `[2026-09-04 A3第2部 3者投票] ポケモンWiki「${r.name.replace(/[（(].*$/, '')}」おぼえるわざ(第${r.wikiGen}世代${r.G !== 'SV' ? '・' + r.G : ''}表: レベル/マシン/タマゴ/教え)と Bulbapedia「Learnset」(Generation ${['','I','II','III','IV','V','VI','VII','VIII','IX'][r.wikiGen]}${r.G !== 'SV' ? '・' + r.G + 'タブ' : ''})の2ソースが一致した技だけ採用。PokeAPI(現状)との差: 足す${r.add.length}/外す${r.remove.length}${r.vg_new ? '・作品を ' + r.vg + '→' + r.vg_new + ' へ(PokeAPIは古い作品どまり)' : ''}。W≠Bで保留=${r.unresolved.length}件は現状維持(_learnset_vote.json)` + (cur['根拠'] ? ' / 旧: ' + cur['根拠'] : '');
    if (!add.length) delete e.learn_add; if (!rem.length) delete e.learn_remove;
    fx.fixes[r.name] = e; n++;
  }
  fx.updated_at = '2026-09-04';
  fs.writeFileSync(fp, JSON.stringify(fx, null, 1));
  console.log('applied', n, 'rows →', fp);
}
}
