// tools/_wiki_stats_audit.js — 種族値/タイプ/特性を ポケモンWiki(裏溜め reference/_genus_material/wiki_<種名>.txt)と全数突き合わせ(2026-09-04)
// 目的: master/pokemon.json の ours_national 941行(=PokeAPI一本の値)に独立ソースを1本当てる。食い違いは3本目(Serebii/Bulbapedia)で決める。
// 判定: 種族値=そのページの全フォーム表のどれかと6値一致→ok / タイプ=infoboxのどれかのブロックと集合一致→ok(並び違いは order_diff で別記) / 特性=どれかのブロックの 通常+隠れ に ab1..ab3 が全部ある→ok
// 出力: reference/_wiki_stats_audit.json(全行)+ 画面に集計。master/fixes は触らない(監査だけ)。wiki_no_data=Wiki本文ダンプにその欄が無い(別ソースで手当て=reference/_wiki_stats_audit_summary.md)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'reference/_genus_material');
const P = require('../master/pokemon.json').items;
const TYPES = ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
function splitTypes(s) { const out = []; let t = String(s || '').replace(/&#32;|※|\s/g, ''); while (t) { const h = TYPES.find(x => t.startsWith(x)); if (!h) return []; out.push(h); t = t.slice(h.length); } return out; }
const ABIL = require('../master/abilities.json').items.map(x => x.name).sort((x, y) => y.length - x.length);
function splitAbils(s) { const raw = String(s || '').replace(/&#32;|※/g, '').replace(/\s*[（(].*$/, '').trim(); const out = []; let t = raw; while (t) { const h = ABIL.find(x => t.startsWith(x)); if (!h) return { ok: false, list: [raw] }; out.push(h); t = t.slice(h.length); } return { ok: out.length > 0, list: out }; }
const STAT = ['HP', 'こうげき', 'ぼうぎょ', 'とくこう', 'とくぼう', 'すばやさ'];

function parse(txt) {
  const L = txt.split('\n');
  // 種族値表: 「種族値|能力値 の範囲」の直前行がフォーム名(無ければ種名)。表内は 能力名 → 次行が値
  const tables = [];
  for (let i = 0; i < L.length; i++) {
    if (L[i] === '種族値' && /^能力値/.test(L[i + 1] || '')) {
      const label = L[i - 1] === '種族値' ? '' : L[i - 1];
      const st = {}; let j = i;
      for (; j < Math.min(i + 60, L.length); j++) {
        const k = STAT.indexOf(L[j]);
        if (k >= 0 && /^\d+$/.test(L[j + 1])) st[STAT[k]] = +L[j + 1];
        if (L[j] === '合計') break;
      }
      if (Object.keys(st).length === 6) tables.push({ label, stats: STAT.map(s => st[s]) });
    }
  }
  // infobox(「分類」〜「タマゴグループ」)を状態機械で読む: 見出し(タイプ/たかさ/おもさ/とくせい/隠れ特性/図鑑の色)→値行…。
  // 「今の見出しの値として成立しない行」= フォーム名(メガ○○/アローラのすがた/○○ロトム…)= 新ブロック開始。
  // タイプ列「くさあく 」・特性列「せいでんきしぜんかいふく」は連結されることがある→名簿(TYPES / master abilities)で分割。
  // ★別フォームのブロックは基本形と同じ項目を省く(例: アローラニャースは隠れ特性びびりだけ)→ 無い項目は先頭ブロックから継承
  const FIELD = /^(タイプ|たかさ|おもさ|とくせい|図鑑の色|隠れ特性|分類)/;
  // 範囲=「分類」の次行が『○○ポケモン』(種の分類名)である最初の所 〜 その後の最初の「タマゴグループ」(わざ表にも「分類」列があるため単純な indexOf は使わない)
  const s0 = L.findIndex((x, i) => x === '分類' && /ポケモン$/.test(L[i + 1] || '')); let s1 = L.indexOf('タマゴグループ', s0 < 0 ? 0 : s0); if (s1 < 0) s1 = L.length;
  const blocks = []; let cur = null, field = null, nval = 0;
  const open = (label) => { cur = { label, types: [], abils: null, hidden: null }; blocks.push(cur); field = null; };
  if (s0 >= 0) open('');
  const isVal = (ln) => {
    if (field === 'タイプ') return splitTypes(ln).length > 0;
    if (field === 'たかさ' || field === 'おもさ') return /[\d?？]/.test(ln);
    if (field === 'とくせい' || field === '隠れ特性') return splitAbils(ln).ok;
    if (field === '図鑑の色') return nval === 0 && ln.length <= 2;
    if (field === '分類') return nval === 0 && /ポケモン$/.test(ln);
    return false;
  };
  for (let i = Math.max(0, s0); i < s1; i++) {
    const ln = L[i]; if (!ln.trim()) continue;
    const m = ln.match(FIELD);
    if (m) { field = m[1]; nval = 0; if (field === 'とくせい') cur.abils = []; if (field === '隠れ特性') cur.hidden = []; continue; }
    if (isVal(ln)) {
      nval++;
      if (field === 'タイプ') cur.types.push(...splitTypes(ln));
      else if (field === 'とくせい') cur.abils.push(...splitAbils(ln).list);
      else if (field === '隠れ特性') cur.hidden.push(...splitAbils(ln).list);
    } else open(ln.trim());
  }
  const base = blocks[0];
  for (const b of blocks) {
    b.inherited = [];
    if (!b.types.length && base && base.types.length) { b.types = base.types.slice(); b.inherited.push('types'); }
    if (b.abils == null) { b.abils = base && base.abils ? base.abils.slice() : []; if (b !== base) b.inherited.push('abils'); }
    if (b.hidden == null) { b.hidden = base && base.hidden ? base.hidden.slice() : []; if (b !== base) b.inherited.push('hidden'); }
    b.all = b.abils.concat(b.hidden);
  }
  return { tables, blocks };
}

const cache = {};
function page(sp) {
  if (sp in cache) return cache[sp];
  const f = path.join(DIR, `wiki_${sp}.txt`);
  cache[sp] = fs.existsSync(f) ? parse(fs.readFileSync(f, 'utf8')) : null;
  return cache[sp];
}

const out = []; const sum = { rows: 0, no_page: 0, stats_ok: 0, stats_ng: 0, stats_none: 0, type_ok: 0, type_ng: 0, type_no_data: 0, type_order_diff: 0, abil_ok: 0, abil_ng: 0, abil_no_data: 0 };
for (const r of P) {
  const sp = String(r.name).replace(/[（(].*$/, '');
  const pg = page(sp);
  const row = { name: r.name, species: sp, source: r.source };
  sum.rows++;
  if (!pg) { row.result = 'no_page'; sum.no_page++; out.push(row); continue; }
  const mine = [r.hp, r.atk, r.def, r.spatk, r.spdef, r.spd];
  const hit = pg.tables.find(t => t.stats.every((v, i) => v === mine[i]));
  if (!pg.tables.length) { row.stats = 'none'; sum.stats_none++; }
  else if (hit) { row.stats = 'ok'; row.stats_label = hit.label; sum.stats_ok++; }
  else { row.stats = 'NG'; row.mine = mine; row.wiki = pg.tables; sum.stats_ng++; }
  const t1 = r.type1, t2 = r.type2 || '';
  const abs = [r.ab1, r.ab2, r.ab3].filter(Boolean);
  const myT = [t1, t2].filter(Boolean);
  const exact = pg.blocks.some(b => b.types.join('/') === myT.join('/'));
  const setHit = pg.blocks.some(b => b.types.length === myT.length && myT.every(t => b.types.includes(t)));
  const typeOk = setHit;
  const noType = !pg.blocks.some(b => b.types.length);
  row.type = typeOk ? (exact ? 'ok' : 'order_diff') : (noType ? 'wiki_no_data' : 'NG'); if (!typeOk) { row.mine_type = myT; row.wiki_blocks = pg.blocks; }
  if (!exact && setHit) { row.mine_type = myT; row.wiki_types = pg.blocks.map(b => b.types.join('/')); sum.type_order_diff++; }
  typeOk ? sum.type_ok++ : (noType ? sum.type_no_data++ : sum.type_ng++);
  const abOk = pg.blocks.some(b => abs.every(a => b.all.includes(a)));
  const noAb = !pg.blocks.some(b => b.all.length);
  row.abil = abOk ? 'ok' : (noAb ? 'wiki_no_data' : 'NG'); if (!abOk) { row.mine_abil = abs; row.wiki_blocks = pg.blocks; }
  abOk ? sum.abil_ok++ : (noAb ? sum.abil_no_data++ : sum.abil_ng++);
  out.push(row);
}
fs.writeFileSync(path.join(ROOT, 'reference/_wiki_stats_audit.json'), JSON.stringify({ audited_at: new Date().toISOString().slice(0, 10), summary: sum, rows: out }, null, 1));
console.log(JSON.stringify(sum));
