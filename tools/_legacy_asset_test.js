#!/usr/bin/env node
/* tools/_legacy_asset_test.js — 段Bのゲート:「旧生成物にしか無かった資産」が master(+凍結ファイル)から
 *   全数再現できるかを確認する。
 *
 * 対象= reference/_plans/棚卸し_生成物にしか無い資産_2026-09-01.md で legacy_only と判定された7項目のうち、
 *   段Bで master へ運んだもの:
 *     ①TYPE_KANJI/TYPE_DISPLAY/TYPE_OFFENSIVE_STATS/DEFAULT_TYPE_ORDER → master/types.json meta.tables
 *     ②POKEMON_LIST.season → master/pokemon.json[].seasons(非空のみ厳密照合。空行は regulation フォールバック
 *       で意図的に変わるため対象外)
 *     ③WAZA_MAP[*].availability → master/moves.json[].availability
 *     ④ABILITY_DESC(家の流儀) → master/abilities.json[].desc_house
 *     ⑥items_database.js の構造化フィールド(≈25種) → master/items.json[]の同名キー
 *   ⑤STAT_RANK(computed・masterに欄を持たない設計)と⑦行順(段Cの仕事)はこのテストの対象外。
 *
 * 判定: 各フィールドについて、legacy側の非空値の**全件**が master(+凍結ファイル)から一致して
 *   引けるかを確認する。1件でも欠落/不一致があれば exit 1。
 *
 * 実行: node tools/_legacy_asset_test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

let failures = 0;
const results = [];
function check(name, total, missing, mismatched, sampleBad) {
  const ok = missing === 0 && mismatched === 0;
  if (!ok) failures++;
  results.push({ name, total, missing, mismatched, ok, sample_bad: (sampleBad || []).slice(0, 5) });
  console.log(`${ok ? '✅' : '❌'} ${name}: 全${total}件 / 欠落${missing} / 不一致${mismatched}`);
}

// ── ① 型の静的4テーブル ──────────────────────────────────────────────
{
  const A = require(path.join(ROOT, 'pokechan_data_all.js'));
  const C = require(path.join(ROOT, 'pokechan_data.js'));
  const types = J('master/types.json');
  const tables = (types.meta && types.meta.tables) || {};
  const bad = [];
  ['TYPE_KANJI', 'TYPE_DISPLAY', 'TYPE_OFFENSIVE_STATS', 'DEFAULT_TYPE_ORDER'].forEach(k => {
    const legacy = JSON.stringify(C[k]);
    const master = JSON.stringify(tables[k]);
    if (legacy !== master) bad.push(k);
    // 全国版とも一致しているか(2つの旧ファイルで食い違っていないか)も確認
    if (JSON.stringify(A[k]) !== legacy) bad.push(k + '(A/C不一致)');
  });
  check('①types静的4テーブル', 4, 0, bad.length, bad);
}

// ── ② pokemon.season(非空のみ) ───────────────────────────────────────
{
  const frozen = J('reference/_legacy_seasons.json').seasons || {};
  const A = require(path.join(ROOT, 'pokechan_data_all.js'));
  const NAMEMAP = (() => {
    const d = J('reference/_name_normalize.json');
    const rows = Array.isArray(d) ? d : (d.rows || []);
    const m = {};
    rows.forEach(r => { if (r.display_name) m[r.display_name] = r; });
    return m;
  })();
  const master = J('master/pokemon.json');
  const byName = new Map(master.items.map(x => [x.name, x]));

  let total = 0, missing = 0, mismatched = 0; const bad = [];
  A.POKEMON_LIST.forEach(p => {
    const season = Array.isArray(p.season) ? p.season : [];
    if (!season.length) return; // 空配列は対象外(regulationフォールバックで意図的に変わるため)
    total++;
    const off = (NAMEMAP[p.name] && NAMEMAP[p.name].official_name) || p.name;
    const row = byName.get(off);
    if (!row) { missing++; bad.push({ legacy: p.name, off, reason: 'master行が無い' }); return; }
    if (JSON.stringify(row.seasons) !== JSON.stringify(season)) {
      mismatched++; bad.push({ legacy: p.name, off, expected: season, got: row.seasons });
    }
  });
  check('②pokemon.seasons(非空245件)', total, missing, mismatched, bad);
}

// ── ③ moves.availability(全919件) ──────────────────────────────────
{
  const frozen = J('reference/_legacy_move_availability.json').availability || {};
  const master = J('master/moves.json');
  const bySlug = new Map(master.items.filter(x => x.slug).map(x => [x.slug, x]));
  let total = 0, missing = 0, mismatched = 0; const bad = [];
  Object.entries(frozen).forEach(([slug, avail]) => {
    total++;
    const row = bySlug.get(slug);
    if (!row) { missing++; bad.push({ slug, reason: 'master行が無い' }); return; }
    if (JSON.stringify(row.availability) !== JSON.stringify(avail)) {
      mismatched++; bad.push({ slug, expected: avail, got: row.availability });
    }
  });
  check('③moves.availability(919件)', total, missing, mismatched, bad);
}

// ── ④ abilities.desc_house ─────────────────────────────────────────
{
  const frozen = J('reference/_legacy_ability_desc.json');
  const zen2han = s => String(s == null ? '' : s).replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  const master = J('master/abilities.json');
  const byName = new Map(master.items.map(x => [x.name, x]));
  // 優先順=champions→national。この合成後の「あるべき値」を1件ずつ照合する。
  const expect = {};
  Object.entries(frozen.national || {}).forEach(([k, v]) => { expect[zen2han(k)] = v; });
  Object.entries(frozen.champions || {}).forEach(([k, v]) => { expect[zen2han(k)] = v; }); // championsで上書き=優先
  let total = 0, missing = 0, mismatched = 0; const bad = [];
  Object.entries(expect).forEach(([name, text]) => {
    total++;
    const row = byName.get(name);
    if (!row) { missing++; bad.push({ name, reason: 'master行が無い' }); return; }
    if (row.desc_house !== text) { mismatched++; bad.push({ name, expected: text, got: row.desc_house }); }
  });
  check('④abilities.desc_house', total, missing, mismatched, bad);
}

// ── ⑥ items.json 構造化フィールド(≈25種) ────────────────────────────
{
  global.window = global.window || {};
  require(path.join(ROOT, 'items_database.js'));
  const ITEMS_DB = global.window.ITEMS_DATABASE;
  const flat = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      if (o.name && (o.key || o.effect || o.category)) flat.push(o);
      Object.values(o).forEach(walk);
    }
  })(ITEMS_DB);
  const seen = new Set();
  const legacy = flat.filter(x => { const k = x.key || x.name; if (seen.has(k)) return false; seen.add(k); return true; });
  const master = J('master/items.json');
  const byName = new Map(master.items.map(x => [x.name, x]));

  const FIELD_MAP = {
    acquisition: 'acquisition', acquisition_note: 'acquisition_note', restriction: 'restriction',
    notes: 'notes', verify: 'verify', q12: 'q12', factor: 'factor', source_q12: 'source_q12',
    boost_type: 'boost_type', vp_cost: 'vp_cost', resist_type: 'resist_type', trigger: 'trigger',
    cure_target: 'cure_target', is_default: 'is_default',
    heal_amount_fixed: 'heal_amount_fixed', heal_fraction: 'heal_fraction',
    heal_fraction_of_damage: 'heal_fraction_of_damage', heal_fraction_for_poison: 'heal_fraction_for_poison',
    damage_fraction_for_others: 'damage_fraction_for_others', damage_fraction_to_attacker: 'damage_fraction_to_attacker',
    proc_chance: 'proc_chance', self_inflict: 'self_inflict', drawback: 'drawback', pokeapi_slug: 'pokeapi_slug',
    source: 'legacy_source_note', // ★改名(providence の source と衝突するため)
  };
  let total = 0, missing = 0, mismatched = 0; const bad = [];
  Object.entries(FIELD_MAP).forEach(([legacyKey, masterKey]) => {
    legacy.forEach(it => {
      if (it[legacyKey] === undefined) return;
      total++;
      const row = byName.get(it.name);
      if (!row) { missing++; bad.push({ field: legacyKey, name: it.name, reason: 'master行が無い' }); return; }
      if (JSON.stringify(row[masterKey]) !== JSON.stringify(it[legacyKey])) {
        mismatched++; bad.push({ field: legacyKey, name: it.name, expected: it[legacyKey], got: row[masterKey] });
      }
    });
  });
  check('⑥items構造化フィールド(≈25種・のべ' + total + '値)', total, missing, mismatched, bad);
}

// ── 結果 ────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, 'reference/_legacy_asset_test_report.json'), JSON.stringify({
  generated_at: new Date().toISOString().slice(0, 10), results,
}, null, 1) + '\n');

if (failures) {
  console.log(`\n❌ ${failures}項目で欠落/不一致があります。段Bは未完了です。`);
  process.exit(1);
}
console.log('\n✅ 段Bゲート合格: 旧生成物にしか無かった資産(①②③④⑥)は全て master(+凍結ファイル)から再現できます。');
process.exit(0);
