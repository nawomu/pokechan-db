#!/usr/bin/env node
/* tools/_freeze_legacy_assets_r2.js — 段C差し戻し対応(コーディネーター指摘 2026-09-01)。
 * 段Bの棚卸しに無かった追加の legacy_only 資産4件を凍結する(このスクリプトは一度だけ実行し、
 * 出力をrepoにコミットする。以後 build_master_v2.js はこのファイルだけを読む。pokechan_data*.js /
 * items_database.js を直接読むのはこの凍結スクリプトだけに閉じ込める)。
 *
 * 4) reference/_legacy_move_subcategory.json — 全国版WAZA_MAP[*].subcategory(271件・技グループ分けの資産)
 * 5) reference/_legacy_move_champions_flags.json — Champions版WAZA_MAP[*].added / .mode
 * 6) reference/_legacy_pokemon_champions_added_in.json — Champions版POKEMON_LIST[*].added_in
 * 7) reference/_legacy_item_effect.json — items_database.js[*].effect(家の流儀の短文。169件全部)
 *
 * 実行: node tools/_freeze_legacy_assets_r2.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const A = require(path.join(ROOT, 'reference', '_legacy_snapshot', 'pokechan_data_all.js'));
const C = require(path.join(ROOT, 'reference', '_legacy_snapshot', 'pokechan_data.js'));
global.window = global.window || {};
require(path.join(ROOT, 'reference', '_legacy_snapshot', 'items_database.js'));
const ITEMS_DB = global.window.ITEMS_DATABASE;
const NOW = '2026-09-01';

function write(name, obj) {
  fs.writeFileSync(path.join(ROOT, 'reference', name), JSON.stringify(obj, null, 1) + '\n');
  console.log('wrote', name);
}

// ── 4) moves.subcategory(全国版・slugキー) ─────────────────────────
{
  const subcategory = {};
  let n = 0;
  Object.entries(A.WAZA_MAP).forEach(([slug, w]) => { if (w.subcategory) { subcategory[slug] = w.subcategory; n++; } });
  write('_legacy_move_subcategory.json', {
    meta: { what: '旧pokechan_data_all.js WAZA_MAP[*].subcategoryの凍結(技グループ分けの資産・作り直し禁止)', generated_at: NOW, generator: 'tools/_freeze_legacy_assets_r2.js', count: n },
    subcategory,
  });
}

// ── 5) moves.added / mode(Champions版・champions_keyキー) ──────────
{
  const added = {}, mode = {};
  let na = 0, nm = 0;
  Object.entries(C.WAZA_MAP).forEach(([key, w]) => {
    if ('added' in w) { added[key] = w.added; na++; }
    if ('mode' in w) { mode[key] = w.mode; nm++; }
  });
  write('_legacy_move_champions_flags.json', {
    meta: { what: '旧pokechan_data.js WAZA_MAP[*].added / .mode の凍結', generated_at: NOW, generator: 'tools/_freeze_legacy_assets_r2.js', count_added: na, count_mode: nm },
    added, mode,
  });
}

// ── 6) pokemon.added_in(Champions版・nameキー) ─────────────────────
{
  const added_in = {};
  let n = 0;
  C.POKEMON_LIST.forEach(p => { if ('added_in' in p) { added_in[p.name] = p.added_in; n++; } });
  write('_legacy_pokemon_champions_added_in.json', {
    meta: { what: '旧pokechan_data.js POKEMON_LIST[*].added_in の凍結', generated_at: NOW, generator: 'tools/_freeze_legacy_assets_r2.js', count: n },
    added_in,
  });
}

// ── 7) items.effect(家の流儀の短文・keyキー優先/nameフォールバック) ──
{
  const effect = {};
  let n = 0;
  ITEMS_DB.items.forEach(it => { const k = it.key || it.name; if (it.effect) { effect[k] = it.effect; n++; } });
  write('_legacy_item_effect.json', {
    meta: { what: '旧items_database.js items[*].effect(家の流儀の短文)の凍結。master.effect_jaはChampions権威の長文で別物', generated_at: NOW, generator: 'tools/_freeze_legacy_assets_r2.js', count: n },
    effect,
  });
}
console.log('done');
