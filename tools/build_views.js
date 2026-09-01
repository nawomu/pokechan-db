#!/usr/bin/env node
/* tools/build_views.js — 段C(計画_マスターからページへ流す_2026-09-01.md)
 *
 * master/*.json だけから、旧生成物と同一schemaの3ファイルを作る。
 *   pokechan_data_all.new.js (全国版) / pokechan_data.new.js (Champions版) / items_database.new.js
 *
 * ★絶対ルール: この生成器は pokechan_data*.js / items_database.js を一切 require しない。
 *   入力は master/*.json と、段Bで凍結した reference/_legacy_*.json だけ。
 *
 * 出力は *.new.js(本番ファイルは触らない・入れ替えは段D)。
 *
 * 実行: node tools/build_views.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const zen2han = s => String(s == null ? '' : s).replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

// ── 入力(master/ + 段Bの凍結ファイルのみ) ──────────────────────────
const MASTER = {
  pokemon:   J('master/pokemon.json').items,
  moves:     J('master/moves.json').items,
  abilities: J('master/abilities.json').items,
  items:     J('master/items.json').items,
  learnsets: J('master/learnsets.json').items,
  types:     J('master/types.json'),
  natures:   J('master/natures.json').items,
};
const LEGACY_ORDER = J('reference/_legacy_order.json');
const NAMEMAP_ROWS = (() => { const d = J('reference/_name_normalize.json'); return Array.isArray(d) ? d : (d.rows || []); })();
const MOVE_FLAG_KEYS = J('reference/_legacy_champions_move_flag_keys.json').keys;

// ══════════════════════════════════════════════════════════════════
// 行順の再現(段Bの凍結順 reference/_legacy_order.json を使う)
// ★ルール(このファイルで確定): ①凍結順にある名前はその位置 ②リネームで直接一致しない名前は
//   reference/_name_normalize.json(entity=pokemon)の champions_name_was / display_name で逆引き
//   ③それでも見つからない名前(=master限定で足した新規行)は「末尾に追加」。追加分の内訳は
//   非メガを先・メガを後ろにまとめ、各グループ内は no昇順→name(ja)昇順。
//   (計画書が例示した「メガのバケツ/その種の後ろ」の精神を保ちつつ、実装を単純化した版)
// ══════════════════════════════════════════════════════════════════
const aliasCandidates = {}; // official_name(master.name) → [legacy時代の名前候補]
NAMEMAP_ROWS.filter(r => r.entity === 'pokemon').forEach(r => {
  const arr = aliasCandidates[r.official_name] || (aliasCandidates[r.official_name] = []);
  if (r.champions_name_was) arr.push(r.champions_name_was);
  if (r.display_name) arr.push(r.display_name);
});

function buildOrderIndex(names) {
  const idx = new Map();
  names.forEach((n, i) => { if (!idx.has(n)) idx.set(n, i); });
  return idx;
}
function orderKeyFor(name, idx) {
  if (idx.has(name)) return idx.get(name);
  const alts = aliasCandidates[name] || [];
  for (const a of alts) if (idx.has(a)) return idx.get(a);
  return null;
}
function sortByLegacyOrder(rows, frozenNames) {
  const idx = buildOrderIndex(frozenNames);
  const matched = [], unmatched = [];
  rows.forEach(r => {
    const k = orderKeyFor(r.name, idx);
    if (k == null) unmatched.push(r); else matched.push([k, r]);
  });
  matched.sort((a, b) => a[0] - b[0]);
  const cmp = (a, b) => (Number(a.no) - Number(b.no)) || String(a.name).localeCompare(String(b.name), 'ja');
  const nonMega = unmatched.filter(r => !r.mega).sort(cmp);
  const mega = unmatched.filter(r => r.mega).sort(cmp);
  return { rows: matched.map(x => x[1]).concat(nonMega, mega), unmatchedCount: unmatched.length, unmatchedNames: unmatched.map(r => r.name) };
}
function buildOrderIndexSimple(keys) { return buildOrderIndex(keys); }
function sortByFrozenKeyList(rows, frozenKeys, keyOf, fallbackCmp) {
  const idx = buildOrderIndex(frozenKeys);
  const matched = [], unmatched = [];
  rows.forEach(r => { const k = idx.has(keyOf(r)) ? idx.get(keyOf(r)) : null; if (k == null) unmatched.push(r); else matched.push([k, r]); });
  matched.sort((a, b) => a[0] - b[0]);
  unmatched.sort(fallbackCmp);
  return { rows: matched.map(x => x[1]).concat(unmatched), unmatchedCount: unmatched.length };
}

// ══════════════════════════════════════════════════════════════════
// タイプ / 性格
// ══════════════════════════════════════════════════════════════════
function buildTypeTables() {
  const sorted = MASTER.types.items.slice().sort((a, b) => a.index - b.index);
  const TYPES = sorted.map(t => t.name);
  const TYPE_COLORS = {}; sorted.forEach(t => { TYPE_COLORS[t.name] = t.color; });
  const tables = MASTER.types.meta.tables || {};
  return {
    TYPES, TYPE_COLORS,
    TYPE_KANJI: tables.TYPE_KANJI || {},
    TYPE_DISPLAY: tables.TYPE_DISPLAY || {},
    TYPE_OFFENSIVE_STATS: tables.TYPE_OFFENSIVE_STATS || {},
    DEFAULT_TYPE_ORDER: tables.DEFAULT_TYPE_ORDER || [],
  };
}
function buildNatures() {
  const NATURES = {};
  MASTER.natures.forEach(n => { NATURES[n.name] = { up: n.up != null ? n.up : null, down: n.down != null ? n.down : null }; });
  return NATURES;
}

// ══════════════════════════════════════════════════════════════════
// 技: 名前/slug/champions_key の相互引き・覚える技の逆引き
// ══════════════════════════════════════════════════════════════════
const moveBySlug = new Map(MASTER.moves.filter(m => m.slug).map(m => [m.slug, m]));
const moveByChampKey = new Map(MASTER.moves.filter(m => m.champions_key).map(m => [m.champions_key, m]));
const moveNameToSlug = new Map(MASTER.moves.filter(m => m.slug).map(m => [m.name, m.slug]));
const moveNameToChampKey = new Map(MASTER.moves.filter(m => m.champions_key).map(m => [m.name, m.champions_key]));

// ★コーディネーター指摘(2026-09-01)A.1→再修正(同日2回目): 全国版の学習データは「本編の全技」。
//   learn(最新バージョングループ)∪ learn_legacy(旧作TM等)∪ confiscated(championsで没収=本編では覚えられる)。
//   検証結果: 旧POKEMON_WAZAに対する欠けが21,727→51件に減少(残る51件は権威/データ差としてallowlist列挙)。
//   Champions版は没収を反映した「いま実際に使える技」だけを見せるので learn のみ(変更なし)。
//   名前照合はzen2hanで揃える(旧は全角『１０まんボルト』のため)。
const learnByNameChampions = new Map(); // pokemon名 → Set(いま覚えられる技名・zen2han済み・没収は含まない)
const learnByNameNational = new Map();  // pokemon名 → Set(本編の全技名。learn∪learn_legacy∪confiscated)
MASTER.learnsets.forEach(l => {
  const learnSet = new Set((l.learn || []).map(zen2han));
  learnByNameChampions.set(l.name, learnSet);
  const natSet = new Set(learnSet);
  (l.learn_legacy || []).forEach(mv => natSet.add(zen2han(mv)));
  if (l.champions) (l.confiscated || []).forEach(mv => natSet.add(zen2han(mv)));
  learnByNameNational.set(l.name, natSet);
});

function buildLearnersIndex(pokemonNames, learnMap) {
  const idx = new Map(); // 技名 → [ポケモン名,...]
  pokemonNames.forEach(name => {
    const set = learnMap.get(name);
    if (!set) return;
    set.forEach(mv => { if (!idx.has(mv)) idx.set(mv, []); idx.get(mv).push(name); });
  });
  return idx;
}

// subcatFromEffects — tools/build_national_view.js:221-252 を移植(変化技のサブカテゴリ導出)
function subcatFromEffects(bd) {
  if (!bd) return 'その他';
  const effects = bd.effects || [];
  if (bd.recovery) return '回復';
  if (bd.screen) return '壁';
  if (bd.room) return 'ルーム';
  if (bd.weather_set) return '天候';
  if (bd.field_set) return 'フィールド';
  if (bd.hazard_set) return '設置';
  if (bd.move_block) return '技封じ';
  if (bd.trap_no_switch) return '捕縛';
  if (bd.force_switch_opp || bd.self_switch) return '交代';
  if (bd.support) return 'サポート';
  const statusFX = effects.filter(e => e.kind === '状態付与');
  const rankFX = effects.filter(e => e.kind === '能力ランク変化');
  const flinchFX = effects.filter(e => e.kind === 'ひるみ');
  if (statusFX.length > 0 || flinchFX.length > 0) return '状態異常';
  if (rankFX.length > 0) {
    const selfUp = rankFX.filter(e => (e.target === 'self' || e.target === 'ally') && e.stages > 0);
    const oppDown = rankFX.filter(e => (e.target === 'opponent' || e.target === 'all_opponents') && e.stages < 0);
    if (selfUp.length > 0) {
      const stats = selfUp.map(e => e.stat);
      if (stats.some(s => s === 'speed')) return '積み速';
      if (stats.some(s => s === 'defense' || s === 'special_defense')) return '積み防';
      return '積み攻';
    }
    if (oppDown.length > 0) return '能力下';
  }
  if (bd.cure_status) return '回復';
  if (bd.remove_hazards || bd.field_remove) return 'その他';
  return 'その他';
}

// ══════════════════════════════════════════════════════════════════
// WAZA_MAP(全国版・全919件、slugキー)
// ══════════════════════════════════════════════════════════════════
function buildWazaNational() {
  const learnersIdx = buildLearnersIndex(MASTER.pokemon.map(p => p.name), learnByNameNational);
  const rows = MASTER.moves.filter(m => m.slug).slice()
    .sort((a, b) => (a.move_no || 9999) - (b.move_no || 9999) || String(a.name).localeCompare(String(b.name), 'ja'));
  const WAZA_MAP = {};
  rows.forEach(m => {
    const battle_data = m.battle_data || { crit_stage: 0, must_crit: false, crit_changes: [], effects: [] };
    const entry = {
      name: m.name,
      move_no: m.move_no,
      type: m.type,
      category: m.category,
      target: m.target || '1体選択',
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      priority: m.priority || 0,
      contact: !!m.contact,
      protect: m.protect !== false,
      description: m.description || '',
      key: m.slug,
      learners: (learnersIdx.get(m.name) || []).slice(),
      national_new: !m.champions && !!m.description,
      description_legacy: m.description_legacy || '',
      battle_data,
      flags: m.flags || {},
      tags: m.tags || [],
      availability: m.availability != null ? m.availability : null,
    };
    if (m.flags && m.flags.is_max) entry.is_max = true;
    if (m.flags && m.flags.z) entry.z = m.flags.z;
    // ★コーディネーター指摘(2026-09-01)B.4: subcategoryは技グループ分けの資産(master.moves.subcategoryに
    //   段Bで凍結移送済み)。作り直さずそのまま出す。新規技(master値がnull)はキー自体を付けない
    //   (legacyも271件だけキーが在り、他は元からキー無し)。
    if (m.subcategory) entry.subcategory = m.subcategory;
    WAZA_MAP[m.slug] = entry;
  });
  return WAZA_MAP;
}

// ══════════════════════════════════════════════════════════════════
// WAZA_MAP(Champions版・champions_keyキー)
// ══════════════════════════════════════════════════════════════════
function buildWazaChampions() {
  const champPokemonNames = MASTER.pokemon.filter(p => p.champions).map(p => p.name);
  const learnersIdx = buildLearnersIndex(champPokemonNames, learnByNameChampions);
  const champMoves = MASTER.moves.filter(m => m.champions && m.champions_key);
  const noKeyCount = MASTER.moves.filter(m => m.champions && !m.champions_key).length;
  const { rows: sorted, unmatchedCount } = sortByFrozenKeyList(
    champMoves, LEGACY_ORDER.waza_champions, m => m.champions_key,
    (a, b) => (a.move_no || 9999) - (b.move_no || 9999)
  );
  const WAZA_MAP = {};
  sorted.forEach(m => {
    const battle_data = m.battle_data || { crit_stage: 0, must_crit: false, crit_changes: [], effects: [] };
    const entry = {
      name: m.name,
      move_no: m.move_no,
      type: m.type,
      category: m.category,
      target: m.target || '1体選択',
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      contact: !!m.contact,
      protect: m.protect !== false,
      description: m.description || '',
      key: m.champions_key,
      learners: (learnersIdx.get(m.name) || []).slice(),
      description_legacy: m.description_legacy || '',
      battle_data,
      flags: m.flags || {},
    };
    if (m.subcategory) entry.subcategory = m.subcategory;
    // ★コーディネーター指摘 B.5: added/mode(旧pokechan_data.js Champions版WAZA_MAP限定の列)を
    //   master.moves.champions_added/champions_mode(段Bで凍結移送済み)からそのまま復元する。
    if (m.champions_added != null) entry.added = m.champions_added;
    if (m.champions_mode != null) entry.mode = m.champions_mode;
    WAZA_MAP[m.champions_key] = entry;
  });
  return { WAZA_MAP, noKeyCount, unmatchedOrderCount: unmatchedCount };
}

// ══════════════════════════════════════════════════════════════════
// POKEMON_LIST(全国版・全master件)
// ══════════════════════════════════════════════════════════════════
function baseRow(p) {
  return {
    no: String(p.no != null ? p.no : 0).padStart(3, '0'),
    name: p.name,
    form: p.form || '',
    mega: !!p.mega,
    weight_kg: p.weight_kg != null ? p.weight_kg : null,
    type1: p.type1 || '',
    type2: p.type2 || '',
    hp: p.hp, atk: p.atk, def: p.def, spatk: p.spatk, spdef: p.spdef, spd: p.spd, total: p.total,
    ab1: p.ab1 || '', ab2: p.ab2 || '', ab3: p.ab3 || '',
    resist: Array.isArray(p.resist) ? p.resist.slice() : null,
  };
}
function buildPokemonNational() {
  const rows = MASTER.pokemon.map(p => Object.assign(baseRow(p), {
    gen: p.gen != null ? p.gen : null,
    season: Array.isArray(p.seasons) ? p.seasons.slice() : [],
    legend: p.legend || '',
  }));
  return sortByLegacyOrder(rows, LEGACY_ORDER.pokemon_all);
}

// ══════════════════════════════════════════════════════════════════
// resist配列からの集計(cnt4/cnt2/cnt1/cnthf/cntqf/cnt0/cnt42/cnthfqf)
// ══════════════════════════════════════════════════════════════════
function resistCounts(resist) {
  const c = { cnt4: 0, cnt2: 0, cnt1: 0, cnthf: 0, cntqf: 0, cnt0: 0 };
  (resist || []).forEach(v => {
    if (v === 4) c.cnt4++;
    else if (v === 2) c.cnt2++;
    else if (v === 1) c.cnt1++;
    else if (v === 0.5) c.cnthf++;
    else if (v === 0.25) c.cntqf++;
    else if (v === 0) c.cnt0++;
  });
  c.cnt42 = c.cnt4 + c.cnt2;
  c.cnthfqf = c.cnthf + c.cntqf;
  return c;
}

// ══════════════════════════════════════════════════════════════════
// POKEMON_LIST(Champions版・champions:true件のみ + 技別フラグ列)
// ══════════════════════════════════════════════════════════════════
function buildPokemonChampions() {
  const champ = MASTER.pokemon.filter(p => p.champions);
  const rows = champ.map(p => {
    const row = baseRow(p);
    Object.assign(row, resistCounts(p.resist));
    const learnSet = learnByNameChampions.get(p.name) || new Set();
    MOVE_FLAG_KEYS.forEach(ck => {
      const mv = moveByChampKey.get(ck);
      row[ck] = !!(mv && learnSet.has(mv.name));
    });
    // ★コーディネーター指摘(2026-09-01・3回目)③: okatazukeも他の169技フラグ列と同じ規則で計算する
    //   (learn に『おかたづけ』(champions_key='okatazuke')があれば true)。常時0の特別扱いは廃止。
    {
      const mv = moveByChampKey.get('okatazuke');
      row.okatazuke = !!(mv && learnSet.has(mv.name));
    }
    // ★コーディネーター指摘 B.6: added_in(旧pokechan_data.js POKEMON_LIST限定の列)を
    //   master.pokemon.champions_added_in(段Bで凍結移送済み。M-C予告分は'M-C'直書き)からそのまま復元する。
    if (p.champions_added_in != null) row.added_in = p.champions_added_in;
    return row;
  });
  return sortByLegacyOrder(rows, LEGACY_ORDER.pokemon_champions);
}

// ══════════════════════════════════════════════════════════════════
// POKEMON_WAZA(逆引き: ポケモン名 → 覚える技キー配列)
// ══════════════════════════════════════════════════════════════════
function buildPokemonWazaNational() {
  const out = {};
  MASTER.pokemon.forEach(p => {
    const set = learnByNameNational.get(p.name);
    const arr = set ? [...set].map(mv => moveNameToSlug.get(mv)).filter(Boolean).sort() : [];
    out[p.name] = arr;
  });
  return out;
}
function buildPokemonWazaChampions() {
  const out = {};
  MASTER.pokemon.filter(p => p.champions).forEach(p => {
    const set = learnByNameChampions.get(p.name);
    const arr = set ? [...set].map(mv => moveNameToChampKey.get(mv)).filter(Boolean).sort() : [];
    out[p.name] = arr;
  });
  return out;
}

// ══════════════════════════════════════════════════════════════════
// ABILITY_DESC(desc_house=旧ページの家の流儀。段B資産④)
// ══════════════════════════════════════════════════════════════════
function abilityText(a) { return a.desc_house != null ? a.desc_house : (a.effect_ja || ''); }
function buildAbilityDescNational() {
  const rows = MASTER.abilities.map(a => a);
  const { rows: sorted } = sortByFrozenKeyList(rows, LEGACY_ORDER.ability_desc_all, a => a.name,
    (a, b) => String(a.name).localeCompare(String(b.name), 'ja'));
  const out = {};
  sorted.forEach(a => { const t = abilityText(a); if (t) out[a.name] = t; });
  return out;
}
function buildAbilityDescChampions() {
  const rows = MASTER.abilities.filter(a => a.champions);
  const { rows: sorted } = sortByFrozenKeyList(rows, LEGACY_ORDER.ability_desc_champions, a => a.name,
    (a, b) => String(a.name).localeCompare(String(b.name), 'ja'));
  const out = {};
  sorted.forEach(a => { const t = abilityText(a); if (t) out[a.name] = t; });
  return out;
}

// ══════════════════════════════════════════════════════════════════
// STAT_RANK(段B資産⑤=computed。master不在のため式で再現。
//   ★コーディネーター指摘(2026-09-01)A.2: キーは旧と同じ形式に戻す
//   (pokemon_db_v9.html:2500 / pokemon_db_all_v9.html:2490 がこの形で引く):
//     form があり '通常' でなければ `${name}(${form})`、それ以外は name。
//   母集団は「そのファイル自身のPOKEMON_LIST」(Champions版=318 / 全国版=1273)で計算し直す
//   =旧の全国版STAT_RANKはChampions表をそのまま写していただけだったが、ページの表記
//   「全国図鑑内の順位」に合わせて母集団を広げる(意図した変更・diffツールのallowlistに明記)。
// ══════════════════════════════════════════════════════════════════
function lv50NonHp(base, boost) {
  const raw = Math.floor((2 * base + 31 + 63) * 0.5) + 5;
  return boost ? Math.floor(raw * boost) : raw;
}
function lv50Hp(base) { return Math.floor((2 * base + 31 + 63) * 0.5) + 60; }
function statRankKey(p) { return (p.form && p.form !== '通常') ? `${p.name}(${p.form})` : p.name; }
function buildStatRank(pokemonListRows) {
  const pop = pokemonListRows.filter(p => p.hp != null);
  const fields = ['hp_base', 'atk_base', 'def_base', 'spatk_base', 'spdef_base', 'spd_base', 'total_base',
    'hp_a', 'atk_a', 'def_a', 'spatk_a', 'spdef_a', 'spd_a', 'total_a',
    'atk_b', 'def_b', 'spatk_b', 'spdef_b', 'spd_b'];
  const rows = pop.map(p => {
    const hp_a = lv50Hp(p.hp), atk_a = lv50NonHp(p.atk), def_a = lv50NonHp(p.def),
      spatk_a = lv50NonHp(p.spatk), spdef_a = lv50NonHp(p.spdef), spd_a = lv50NonHp(p.spd);
    return {
      key: statRankKey(p), no: p.no,
      hp_base: p.hp, atk_base: p.atk, def_base: p.def, spatk_base: p.spatk, spdef_base: p.spdef, spd_base: p.spd, total_base: p.total,
      hp_a, atk_a, def_a, spatk_a, spdef_a, spd_a, total_a: hp_a + atk_a + def_a + spatk_a + spdef_a + spd_a,
      atk_b: lv50NonHp(p.atk, 1.1), def_b: lv50NonHp(p.def, 1.1), spatk_b: lv50NonHp(p.spatk, 1.1),
      spdef_b: lv50NonHp(p.spdef, 1.1), spd_b: lv50NonHp(p.spd, 1.1),
    };
  });
  const rankMaps = {};
  fields.forEach(f => {
    const sorted = rows.slice().sort((a, b) => b[f] - a[f]);
    const m = new Map();
    sorted.forEach((r, i) => { m.set(r.key, i > 0 && sorted[i - 1][f] === r[f] ? m.get(sorted[i - 1].key) : i + 1); });
    rankMaps[f] = m;
  });
  const STAT_RANK = {};
  rows.forEach(r => {
    const o = Object.assign({}, r); delete o.key;
    fields.forEach(f => { o[f + '_rank'] = rankMaps[f].get(r.key); });
    STAT_RANK[r.key] = o;
  });
  return STAT_RANK;
}

// ══════════════════════════════════════════════════════════════════
// items_database.js(ITEMS_DATABASE) — 静的メタは段Bの棚卸し対象外(まるごとハードコード=旧のまま複写)
// ══════════════════════════════════════════════════════════════════
const ITEMS_STATIC = {
  version: '1.0',
  updated: '2026-06-19',
  context: 'ポケモンチャンピオンズ (ポケチャン) battle_simulator.html 用持ち物マスタ',
  sources: {
    primary: 'vgc-champions-calc.pages.dev バンドル解析 (2026-05-16, /assets/index-Bt-7Kz3C.js)',
    secondary: [
      'アルテマ ポケチャン持ち物一覧 https://altema.jp/pokemonchampions/itemlist',
      'アルテマ ポケチャン未実装持ち物 https://altema.jp/pokemonchampions/mijisouitemlist',
      'Gamerch ポケチャン道具 https://gamerch.com/pokemonchampions/980380',
      'AppMedia ポケチャン持ち物 https://appmedia.jp/pokemonchampions/79922272',
      'Game8 ポケチャン道具 https://game8.jp/pokemon-champions/775655',
      'GameWith ポケチャン持ち物 https://gamewith.jp/pokemon-champions/546487',
    ],
  },
  categories: {
    attack_boost: '攻撃側威力補正',
    type_boost: 'タイプ別威力補正 (×1.2 / Q12=4915)',
    berry_resist: '半減きのみ (×0.5 / Q12=2048, 効果バツグン時のみ発動・1回)',
    berry_status_cure: '状態異常回復きのみ',
    berry_hp_cure: 'HP回復きのみ',
    defense_boost: '防御補正',
    status_inflict: '状態異常付与 (装備者デメリット系)',
    hp_drain: 'HP回復/反動',
    speed_boost: '素早さ補正',
    survival: '生存補助 (タスキ/ハチマキ等)',
    misc: 'その他',
    mega_stone: 'メガストーン (メガシンカ起動)',
  },
  regulation_mb: {
    active_period: '2026-06-17 〜 2026-09-02 10:59',
    rules: [
      '1回の対戦でメガシンカは1度のみ',
      'チームに複数のメガストーンを持たせることは可能',
      'メガシンカは技選択と同時にRボタンで発動',
      'メガ後の形態は対戦終了まで維持',
    ],
  },
};
const ITEMS_PASSTHROUGH_FIELDS = ['acquisition', 'acquisition_note', 'restriction', 'notes', 'verify', 'q12', 'factor',
  'source_q12', 'boost_type', 'vp_cost', 'resist_type', 'trigger', 'cure_target', 'is_default',
  'heal_amount_fixed', 'heal_fraction', 'heal_fraction_of_damage', 'heal_fraction_for_poison',
  'damage_fraction_for_others', 'proc_chance', 'damage_fraction_to_attacker', 'self_inflict', 'drawback', 'pokeapi_slug'];

// ★コーディネーター指摘(2026-09-01)A.3: i18n/en.json の pokemon[applies_to] から mega_target_en を導出。
const I18N_EN = (() => { try { return J('i18n/en.json'); } catch (e) { return { pokemon: {} }; } })();

function buildItems() {
  const pkByName = new Map(MASTER.pokemon.map(p => [p.name, p]));
  const abByName = new Map(MASTER.abilities.map(a => [a.name, a]));
  const pkByNo = new Map(); // no → mega:true な行の配列
  MASTER.pokemon.forEach(p => { if (p.mega && p.no != null) { if (!pkByNo.has(p.no)) pkByNo.set(p.no, []); pkByNo.get(p.no).push(p); } });
  const unresolvedMega = [];
  const items = MASTER.items.map(it => {
    const row = {
      key: it.slug || null,
      name: it.name,
      name_en: it.name_en || null,
      category: it.category || null,
      // ★コーディネーター指摘 B.7: effectはeffect_house(旧items_database.jsの家の流儀の短文。段Bで
      //   凍結移送済み)を優先。無い新規(ナイトZ等11件)だけeffect_ja(Champions権威の長文)にフォールバック。
      effect: it.effect_house != null ? it.effect_house : (it.effect_ja || null),
    };
    ITEMS_PASSTHROUGH_FIELDS.forEach(f => { if (it[f] !== undefined) row[f] = it[f]; });
    row.applies_to = it.applies_to || null;
    row.implemented_in_pokechan = !!it.implemented;
    if (it.legacy_source_note !== undefined) row.source = it.legacy_source_note;
    // mega_target_en: applies_to(対象の進化前の種、JA名)をi18n/en.jsonで引く
    if (it.applies_to && I18N_EN.pokemon && I18N_EN.pokemon[it.applies_to]) row.mega_target_en = I18N_EN.pokemon[it.applies_to];
    // メガストーン: applies_to_pokemon[0]のno(図鑑番号)を軸に、同じnoを持つmega:true行から選ぶ
    //   (computed_via_join)。★applies_to_pokemonは「まだメガ進化していない」対象(=進化前の種)を持つ
    //   設計(build_master_v2.jsのexpandAppliesTo参照)なので、その行自身はmega:falseで別途探す必要がある。
    //   同じnoに複数メガ候補(X/Y・♂♀・Z・色違い等)がある場合は優先順で絞り込む:
    //   ①base名の丸括弧(フォーム指定。例「シャリタツ(そったすがた)」)が候補名に含まれる
    //   ②持ち物名の末尾X/Y ③持ち物名の末尾Z(候補名の末尾Zと対応) ④♂♀(持ち物名 or base名の「オス/メス」)
    //   ⑤「メガ+base」の完全一致(色違い等の接尾辞が無い既定形を優先)⑥先頭候補
    if (it.category === 'mega_stone' && Array.isArray(it.applies_to_pokemon) && it.applies_to_pokemon.length) {
      const baseName = it.applies_to_pokemon[0];
      const base = pkByName.get(baseName);
      const coreName = n => String(n || '').replace(/\(.*?\)$/, '');
      const baseParen = (String(baseName).match(/\((.*?)\)$/) || [])[1] || null;
      let candidates = base && base.no != null ? (pkByNo.get(base.no) || []) : [];
      if (!candidates.length) {
        // no照合に失敗した場合の保険(no不明な手動追加行等)=旧来の名前照合にフォールバック
        const baseCore = coreName(baseName);
        candidates = MASTER.pokemon.filter(p => p.mega && (p.name === ('メガ' + baseCore) || p.name.startsWith('メガ' + baseCore)));
      }
      let target = candidates[0] || null;
      if (candidates.length > 1) {
        const nm = it.name || '';
        target =
          (baseParen && candidates.find(c => c.name.includes(baseParen))) ||
          (/X$/.test(nm) && candidates.find(c => /X/.test(c.name))) ||
          (/Y$/.test(nm) && candidates.find(c => /Y/.test(c.name))) ||
          ((/♂/.test(nm) || /オス/.test(baseName)) && candidates.find(c => /♂/.test(c.name))) ||
          ((/♀/.test(nm) || /メス/.test(baseName)) && candidates.find(c => /♀/.test(c.name))) ||
          (/Z$/.test(nm) && candidates.find(c => /Z$/.test(c.name))) ||
          (!/Z$/.test(nm) && candidates.find(c => !/Z$/.test(c.name) && !/[♂♀XY]$/.test(c.name))) ||
          candidates.find(c => c.name === 'メガ' + coreName(baseName)) ||
          candidates[0];
      }
      if (!target) target = base;
      if (!target) unresolvedMega.push({ item: it.name, base: baseName });
      if (target) {
        row.mega_form = target.name;
        row.mega_types = [target.type1, target.type2].filter(Boolean);
        // ★legacyのitems_database.jsは単字キー{H,A,B,C,D,S}(ポケモン一覧の種族値表記の流儀)を使う
        row.mega_stats = { H: target.hp, A: target.atk, B: target.def, C: target.spatk, D: target.spdef, S: target.spd };
        row.mega_ability = target.ab1 || null;
        const ab = row.mega_ability ? abByName.get(row.mega_ability) : null;
        // ★コーディネーター指摘(2026-09-01・3回目)②: mega_ability_desc_house(旧items_database.js独自の
        //   短文・段Cで凍結移送済み)を優先。無ければmaster/abilities.jsonのdesc_house(メガの特性名から)、
        //   それも無ければeffect_ja。
        row.mega_ability_desc = it.mega_ability_desc_house != null ? it.mega_ability_desc_house
          : (ab ? (ab.desc_house || ab.effect_ja || null) : null);
      }
    }
    return row;
  });
  const stats = {
    total_items: items.length,
    implemented_in_pokechan_true: items.filter(x => x.implemented_in_pokechan).length,
    implemented_in_pokechan_false: items.filter(x => !x.implemented_in_pokechan).length,
    with_q12_value: items.filter(x => x.q12 != null).length,
    with_verify_true: items.filter(x => x.verify === true).length,
    mega_stone_total: items.filter(x => x.category === 'mega_stone').length,
    mega_stone_detailed: items.filter(x => x.category === 'mega_stone' && x.mega_form).length,
  };
  return { items, stats, unresolvedMega };
}

// ══════════════════════════════════════════════════════════════════
// 出力
// ══════════════════════════════════════════════════════════════════
const J2 = (v) => JSON.stringify(v);
const HEADER = (what) =>
  `// 自動生成 by tools/build_views.js from master/ — 直接編集禁止。\n` +
  `// ${what}\n`;

function writeNationalView() {
  const t = buildTypeTables();
  const NATURES = buildNatures();
  const { rows: POKEMON_LIST, unmatchedCount: pkUnmatched } = buildPokemonNational();
  const WAZA_MAP = buildWazaNational();
  const POKEMON_WAZA = buildPokemonWazaNational();
  const ABILITY_DESC = buildAbilityDescNational();
  const STAT_RANK = buildStatRank(POKEMON_LIST);
  const out = HEADER('全国版(全部版)共通DB。pokechan_data_all.js と同一schema。master/*.json から生成。') +
`const TYPES = ${J2(t.TYPES)};
const TYPE_COLORS = ${J2(t.TYPE_COLORS)};
const TYPE_KANJI = ${J2(t.TYPE_KANJI)};
const TYPE_DISPLAY = ${J2(t.TYPE_DISPLAY)};
const TYPE_OFFENSIVE_STATS = ${J2(t.TYPE_OFFENSIVE_STATS)};
const DEFAULT_TYPE_ORDER = ${J2(t.DEFAULT_TYPE_ORDER)};
const POKEMON_LIST = ${J2(POKEMON_LIST)};
const DATA = POKEMON_LIST;
const WAZA_MAP = ${J2(WAZA_MAP)};
const POKEMON_WAZA = ${J2(POKEMON_WAZA)};
const ABILITY_DESC = ${J2(ABILITY_DESC)};
const STAT_RANK = ${J2(STAT_RANK)};
const NATURES = ${J2(NATURES)};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TYPES, TYPE_COLORS, TYPE_KANJI, TYPE_DISPLAY, TYPE_OFFENSIVE_STATS, DEFAULT_TYPE_ORDER, POKEMON_LIST, DATA, WAZA_MAP, POKEMON_WAZA, ABILITY_DESC, STAT_RANK, NATURES };
}
`;
  fs.writeFileSync(path.join(ROOT, 'pokechan_data_all.new.js'), out);
  return { pokemonCount: POKEMON_LIST.length, wazaCount: Object.keys(WAZA_MAP).length, pkUnmatched };
}

function writeChampionsView() {
  const t = buildTypeTables();
  const NATURES = buildNatures();
  const { rows: POKEMON_LIST, unmatchedCount: pkUnmatched } = buildPokemonChampions();
  const { WAZA_MAP, noKeyCount, unmatchedOrderCount } = buildWazaChampions();
  const POKEMON_WAZA = buildPokemonWazaChampions();
  const ABILITY_DESC = buildAbilityDescChampions();
  const STAT_RANK = buildStatRank(POKEMON_LIST);
  const out = HEADER('Champions版共通DB。pokechan_data.js と同一schema。master/*.json(champions:true)から生成。') +
`const TYPES = ${J2(t.TYPES)};
const TYPE_COLORS = ${J2(t.TYPE_COLORS)};
const TYPE_KANJI = ${J2(t.TYPE_KANJI)};
const TYPE_DISPLAY = ${J2(t.TYPE_DISPLAY)};
const TYPE_OFFENSIVE_STATS = ${J2(t.TYPE_OFFENSIVE_STATS)};
const DEFAULT_TYPE_ORDER = ${J2(t.DEFAULT_TYPE_ORDER)};
const POKEMON_LIST = ${J2(POKEMON_LIST)};
const DATA = POKEMON_LIST;
const WAZA_MAP = ${J2(WAZA_MAP)};
const POKEMON_WAZA = ${J2(POKEMON_WAZA)};
const ABILITY_DESC = ${J2(ABILITY_DESC)};
const STAT_RANK = ${J2(STAT_RANK)};
const NATURES = ${J2(NATURES)};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TYPES, TYPE_COLORS, TYPE_KANJI, TYPE_DISPLAY, TYPE_OFFENSIVE_STATS, DEFAULT_TYPE_ORDER, POKEMON_LIST, DATA, WAZA_MAP, POKEMON_WAZA, ABILITY_DESC, STAT_RANK, NATURES };
}
`;
  fs.writeFileSync(path.join(ROOT, 'pokechan_data.new.js'), out);
  return { pokemonCount: POKEMON_LIST.length, wazaCount: Object.keys(WAZA_MAP).length, pkUnmatched, noKeyCount, unmatchedOrderCount };
}

function writeItemsView() {
  const { items, stats, unresolvedMega } = buildItems();
  const out = HEADER('ポケチャン実装済の持ち物。master/items.json から生成(段C)。') +
`window.ITEMS_DATABASE = {
  "version": ${J2(ITEMS_STATIC.version)},
  "updated": ${J2(ITEMS_STATIC.updated)},
  "context": ${J2(ITEMS_STATIC.context)},
  "sources": ${J2(ITEMS_STATIC.sources)},
  "categories": ${J2(ITEMS_STATIC.categories)},
  "items": ${J2(items)},
  "stats": ${J2(stats)},
  "regulation_mb": ${J2(ITEMS_STATIC.regulation_mb)}
};
`;
  fs.writeFileSync(path.join(ROOT, 'items_database.new.js'), out);
  return { itemsCount: items.length, unresolvedMega };
}

// ── 実行 ────────────────────────────────────────────────────────────
console.log('=== build_views.js: master/ → *.new.js ===');
const r1 = writeNationalView();
console.log('pokechan_data_all.new.js: POKEMON_LIST=%d(order-unmatched=%d) / WAZA_MAP=%d', r1.pokemonCount, r1.pkUnmatched, r1.wazaCount);
const r2 = writeChampionsView();
console.log('pokechan_data.new.js: POKEMON_LIST=%d(order-unmatched=%d) / WAZA_MAP=%d(no champions_key=%d件除外・order-unmatched=%d)', r2.pokemonCount, r2.pkUnmatched, r2.wazaCount, r2.noKeyCount, r2.unmatchedOrderCount);
const r3 = writeItemsView();
console.log('items_database.new.js: items=%d unresolvedMega=%d', r3.itemsCount, r3.unresolvedMega.length);
if (r3.unresolvedMega.length) console.log(JSON.stringify(r3.unresolvedMega));
