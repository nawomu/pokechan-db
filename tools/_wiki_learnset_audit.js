// tools/_wiki_learnset_audit.js — master/learnsets.json の覚える技をポケモンWikiと全数照合(2026-09-04・監査のみ=master/fixesは触らない)
//   Champions行(318): Wiki「<種名>/Pokémon Championsのおぼえるわざ」(reference/_genus_material/wiki_ch_learn_<種名>.txt)と learn を集合で比較
//   全国行(955):      Wiki種ページ(wiki_<種名>.txt)の「おぼえるわざ」最新世代表(レベル/わざマシン/タマゴ/その他)と learn を比較。
//                    Wikiの最新世代 > うちの latest_version_group の世代 なら wiki_newer(PokeAPIが古い=DLC追加等)として別集計
// 出力: reference/_wiki_learnset_audit.json  使い方: node tools/_wiki_learnset_audit.js [名前で絞る]
const fs = require('fs'), path = require('path');
const DIR = 'reference/_genus_material';
const MOVES = new Set(require('../master/moves.json').items.map(m => m.name));
const TYPES = ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
const { speciesOf } = require('./_fetch_wiki_champions_learnsets.js');
const L = require('../master/learnsets.json').items;
const GEN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const VG_GEN = { 'scarlet-violet': 9, 'sword-shield': 8, 'brilliant-diamond-and-shining-pearl': 8, 'legends-arceus': 8, 'ultra-sun-ultra-moon': 7, 'sun-moon': 7, 'lets-go-pikachu-lets-go-eevee': 7 };
const VG_TAG = { 'sword-shield': 'SwSh', 'brilliant-diamond-and-shining-pearl': 'BDSP', 'legends-arceus': 'LA' };
const formOf = n => { const m = String(n).match(/[（(](.*)[)）]$/); return m ? m[1] : null; };
const isMoveRow = (L, i) => MOVES.has(L[i]) && TYPES.includes(L[i + 1]);

// ── Champions: 「Pokémon Champions」の直前行=フォーム見出し。表=わざ名+タイプ行
function parseChampions(txt) {
  const L = txt.split('\n').map(s => s.trim()); const groups = []; let g = null;
  for (let i = 0; i < L.length; i++) {
    const x = L[i];
    if (L[i + 1] === 'Pokémon Champions' && !/Championsのおぼえるわざ/.test(x)) { g = { label: (x === 'Champions' || x === 'が') ? null : x, moves: [] }; groups.push(g); continue; }   // 見出し無し(単一フォーム)=label null
    if (g && isMoveRow(L, i)) g.moves.push(x);
  }
  return groups.filter(g => g.moves.length);
}
// ── 全国: 「おぼえるわざ」節を 種類(level/tm/egg/other/tutor) × 世代 × フォーム見出し で表に分ける
function parseNational(txt) {
  const L = txt.split('\n').map(s => s.trim());
  let s = -1; L.forEach((x, i) => { if (x === 'おぼえるわざ') s = i; });
  if (s < 0) return null;
  let e = L.findIndex((x, i) => i > s && x === '入手方法'); if (e < 0) e = L.length;
  const tables = []; let kind = null, gen = null, tag = null, form = null, cur = null, pending = null, block = null;
  for (let i = s + 1; i < e; i++) {
    const x = L[i];
    let m;
    if (/^Pokemon LEGENDS Z-A$/.test(x)) { block = 'ZA'; kind = null; cur = null; pending = null; continue; }   // ★Z-A(第九世代扱い)は別ブロック=SV表と混ぜない
    if (/^Pokémon LEGENDS アルセウス$/.test(x)) { block = 'LA'; form = null; cur = null; pending = null; continue; }   // ★LA表は各種類の節の末尾に「Pokémon LEGENDS アルセウス/第八世代 (…)」で出る=タグLA・すがたは基本に戻す
    if ((m = x.match(/^(レベルアップわざ|わざマシン.*わざ|タマゴわざ|その他の場所で覚えるわざ|人から教えてもらえる ?わざ|教え技|特別なわざ)/))) {
      kind = /レベル/.test(x) ? 'level' : /マシン/.test(x) ? 'tm' : /タマゴ/.test(x) ? 'egg' : /教え/.test(x) ? 'tutor' : 'other'; form = null; cur = null; pending = null; if (block === 'LA') block = null; continue;
    }
    if ((m = x.match(/^(?:(SwSh|BDSP|LA|SV)[：:])?第([一二三四五六七八九])世代/))) {
      gen = GEN_NUM[m[2]]; tag = m[1] || block || null; if (pending) form = pending; pending = null;
      cur = { kind, gen, tag, form, moves: [] }; tables.push(cur); continue;
    }
    if (kind && !cur && x && !/^(その他の世代|Lv\.|No\.|わざ|タイプ|分類|威力|命中|PP|遺伝元|わざマシン)$/.test(x) && !/も参照|太字|進化/.test(x)) pending = x; // 世代見出しの直前=フォーム見出し候補
    if (cur && isMoveRow(L, i)) cur.moves.push(x);
    // 次の表のフォーム見出し(表の途中に出る「ニャース(アローラのすがた)」など)
    // ★どんな文字列でも「次の行が世代見出し」なら見出し(ときはなたれしフーパ/すなちのミノ/れんげきのかた/オス/メス 等は語形が揃わない)
    if (cur && x && !isMoveRow(L, i) && !TYPES.includes(x) && !/太字|進化|も参照|^その他の世代/.test(x) && L[i + 1] && /^(?:(SwSh|BDSP|LA|SV)[：:])?第[一二三四五六七八九]世代/.test(L[i + 1])) { pending = x; cur = null; }
  }
  return tables;
}
const pickForm = (groups, row, species) => {
  const f = formOf(row.name);
  if (groups.length === 1) return groups[0];
  const byLabel = lab => groups.find(g => g.label === lab || (g.form || '') === lab);
  if (f) {
    const hit = groups.find(g => (g.label || g.form || '').includes(f)) || groups.find(g => (g.label || g.form || '') === row.name) || groups.find(g => { const lab = g.label || g.form || ''; return lab && f.includes(lab); });
    if (hit) return hit;
    // ヒヒダルマ(ノーマルモード/ダルマモード)=「ヒヒダルマ」、(ガラルのすがた ダルマモード)=「ヒヒダルマ(ガラルのすがた)」(モードで技は変わらない)
    const f2 = f.replace(/\s*(ダルマモード|ノーマルモード)\s*/g, '').trim();
    if (f2 !== f) return pickForm(groups, { name: f2 ? `${species}(${f2})` : species }, species);
    // すがた専用の表が無い(バスラオ あかすじ/あおすじ・ネクロズマ各フォルム・チェリム ネガ)= 見出し無しの表が共通
    // ★ただし地方のすがた(アローラ等)は別: その作品に居ないだけ(コラッタ(アローラ)はBDSPに居ない)→ 共通表を流用しない
    if (/アローラ|ガラル|ヒスイ|パルデア/.test(f)) return null;
    return groups.find(g => !g.form && !g.label) || null;
  }
  if (/[♀♂]$/.test(row.name)) { const sx = /♀$/.test(row.name) ? 'メス' : 'オス'; const g = groups.find(g => (g.label || g.form || '') === sx || (g.label || g.form || '').includes(sx + 'のすがた')); if (g) return g; }   // メガニャオニクス♀/♂ → メス/オス
  if (/^(メガ|ゲンシ)/.test(row.name)) return byLabel(row.name) || byLabel(species) || byLabel(species + 'のすがた') || groups.find(g => !g.form && !g.label) || (groups.length ? groups[0] : null);   // メガ/ゲンシは元と同じ技=元の表
  // 基本のすがた: 種名そのもの / 「○○のすがた」 / フォーム無しの表
  return byLabel(species) || byLabel(species + 'のすがた') || groups.find(g => !g.form && !g.label) || groups.find(g => !/[（(]/.test(g.label || g.form || '')) || groups[0];
};
module.exports = { parseChampions, parseNational, pickForm, speciesOf, formOf, isMoveRow, VG_GEN, VG_TAG, GEN_NUM, TYPES, MOVES, DIR };
if (require.main === module) {
const filt = process.argv[2];
const rows = [], sum = { rows: 0, ch_ok: 0, ch_diff: 0, ch_no_page: 0, ch_no_form: 0, nat_ok: 0, nat_diff: 0, nat_wiki_newer: 0, nat_wiki_older: 0, nat_no_page: 0, nat_no_form: 0 };
for (const r of L) {
  if (filt && !r.name.includes(filt)) continue;
  sum.rows++;
  const learn = new Set(r.learn);
  if (r.champions) {
    const sp = speciesOf(r.name), f = path.join(DIR, `wiki_ch_learn_${sp}.txt`);
    if (!fs.existsSync(f)) { sum.ch_no_page++; rows.push({ name: r.name, kind: 'champions', status: 'no_page', species: sp }); continue; }
    const groups = parseChampions(fs.readFileSync(f, 'utf8'));
    const g = pickForm(groups, r, sp);
    if (!g) { sum.ch_no_form++; rows.push({ name: r.name, kind: 'champions', status: 'no_form', labels: groups.map(x => x.label) }); continue; }
    const w = new Set(g.moves);
    const wikiOnly = [...w].filter(m => !learn.has(m)), masterOnly = [...learn].filter(m => !w.has(m));
    const ok = !wikiOnly.length && !masterOnly.length; sum[ok ? 'ch_ok' : 'ch_diff']++;
    rows.push({ name: r.name, kind: 'champions', status: ok ? 'ok' : 'diff', label: g.label, wiki_n: w.size, master_n: learn.size, wiki_only: wikiOnly, master_only: masterOnly, master_only_in_confiscated: masterOnly.filter(m => (r.confiscated || []).includes(m)), wiki_only_in_confiscated: wikiOnly.filter(m => (r.confiscated || []).includes(m)) });
  } else {
    const sp = String(r.name).replace(/[（(].*$/, ''), f = path.join(DIR, `wiki_${sp}.txt`);
    if (!fs.existsSync(f)) { sum.nat_no_page++; rows.push({ name: r.name, kind: 'national', status: 'no_page', species: sp }); continue; }
    const tables0 = parseNational(fs.readFileSync(f, 'utf8')) || [];
    const tables = tables0.filter(t => t.tag !== 'ZA');   // ★Z-A(CD制・PP無し)は比べない。第九世代がZ-Aだけの種(ポッポ等)は SV表が無い= za_only
    if (!tables.length && tables0.length) { sum.nat_za_only = (sum.nat_za_only || 0) + 1; rows.push({ name: r.name, kind: 'national', status: 'za_only', our_vg: r.latest_version_group }); continue; }
    tables.forEach(t => { if (t.form && /共通|・/.test(t.form)) t.form = null; });
    const ourGen = VG_GEN[r.latest_version_group] || null, ourTag = VG_TAG[r.latest_version_group] || null;
    const wikiGen = Math.max(0, ...tables.filter(t => t.kind === 'level').map(t => t.gen));
    const forms = [...new Set(tables.map(t => t.form || ''))];
    const groups = forms.map(fm => ({ form: fm || null, label: fm || null, tables: tables.filter(t => (t.form || '') === fm) }));
    const g = pickForm(groups, r, sp);
    if (!g) { sum.nat_no_form++; rows.push({ name: r.name, kind: 'national', status: 'no_form', forms, our_gen: ourGen, wiki_gen: wikiGen }); continue; }
    // 世代が違う表は比べない(Wikiが新しい=PokeAPI側が古い/Wikiが古い=要確認)
    if (wikiGen !== ourGen) { const st = wikiGen > ourGen ? 'wiki_newer' : 'wiki_older'; sum['nat_' + st]++; rows.push({ name: r.name, kind: 'national', status: st, our_vg: r.latest_version_group, our_gen: ourGen, wiki_gen: wikiGen, form: g.form }); continue; }
    // 同世代: SwSh/BDSP/LA のタグ付き表は、うちの作品に合う表だけ採る(タグ無しは共通)
    const use = g.tables.filter(t => t.gen === ourGen && (!t.tag || t.tag === 'SV' || t.tag === ourTag));
    const w = new Map(); use.forEach(t => t.moves.forEach(m => { if (!w.has(m)) w.set(m, t.kind); }));
    const wikiOnly = [...w.keys()].filter(m => !learn.has(m)), masterOnly = [...learn].filter(m => !w.has(m));
    const ok = !wikiOnly.length && !masterOnly.length; sum[ok ? 'nat_ok' : 'nat_diff']++;
    rows.push({ name: r.name, kind: 'national', status: ok ? 'ok' : 'diff', our_vg: r.latest_version_group, gen: ourGen, form: g.form, tables: use.map(t => t.kind + (t.tag ? ':' + t.tag : '') + '=' + t.moves.length), wiki_n: w.size, master_n: learn.size, wiki_only: wikiOnly.map(m => m + '[' + w.get(m) + ']'), master_only: masterOnly, master_only_in_legacy: masterOnly.filter(m => (r.learn_legacy || []).includes(m)) });
  }
}
fs.writeFileSync('reference/_wiki_learnset_audit.json', JSON.stringify({ audited_at: new Date().toISOString().slice(0, 10), summary: sum, rows }, null, 1));
console.log(JSON.stringify(sum));
if (filt) console.log(JSON.stringify(rows, null, 1));
}
