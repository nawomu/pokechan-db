#!/usr/bin/env node
/**
 * build_i18n_entities.js
 *
 * reference/master_{pokemon,moves,abilities,items}.json から
 * i18n/{lang}.json (8言語) を冪等に再生成するビルドスクリプト。
 *
 * 使い方:
 *   node tools/build_i18n_entities.js [--dry-run] [--lang=en,fr,de,...] [--overwrite]
 *
 * オプション:
 *   --dry-run      ファイル書き込みせず、差分件数のみコンソール出力
 *   --lang=...     カンマ区切りで対象言語を指定(デフォルト: en,fr,de,es,it,ko,zh-Hans,zh-Hant)
 *   --overwrite    既存エントリも master の値で上書きする(デフォルト: 新エントリのみ追加)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── パス定義 ─────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const REF_DIR = path.join(ROOT, 'reference');
const I18N_DIR = path.join(ROOT, 'i18n');

// ── CLI 引数パース ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const OVERWRITE = args.includes('--overwrite');

const langArg = args.find(a => a.startsWith('--lang='));
const ALL_LANGS = ['en', 'fr', 'de', 'es', 'it', 'ko', 'zh-Hans', 'zh-Hant'];
const TARGET_LANGS = langArg
  ? langArg.replace('--lang=', '').split(',').map(l => l.trim()).filter(Boolean)
  : ALL_LANGS;

// ── ユーティリティ ──────────────────────────────────────────────────────────
/**
 * JSON ファイルを読み込む。存在しない場合は null を返す。
 */
function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`[ERROR] Failed to parse ${filePath}: ${e.message}`);
    return null;
  }
}

/**
 * JSON ファイルを整形して書き込む。
 */
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 1) + '\n', 'utf8');
}

/**
 * 既存オブジェクトに新エントリをマージする。
 * OVERWRITE=false の場合: 既存キーは上書きしない(新キーのみ追加)。
 * OVERWRITE=true の場合: 全キーを上書き。
 * 返り値: { merged, added, updated } — 件数カウント付き。
 */
function mergeEntries(existing, incoming) {
  const merged = Object.assign({}, existing);
  let added = 0;
  let updated = 0;
  for (const [key, val] of Object.entries(incoming)) {
    if (!(key in merged)) {
      merged[key] = val;
      added++;
    } else if (OVERWRITE) {
      merged[key] = val;
      updated++;
    }
  }
  return { merged, added, updated };
}

// ── マスターデータ読み込み ──────────────────────────────────────────────────
function loadMaster(name) {
  const filePath = path.join(REF_DIR, `master_${name}.json`);
  const data = readJson(filePath);
  if (!data) {
    console.warn(`[WARN] master_${name}.json not found at ${filePath} — skipping`);
    return null;
  }
  return data;
}

const masterPokemon   = loadMaster('pokemon');
const masterMoves     = loadMaster('moves');
const masterAbilities = loadMaster('abilities');
const masterItems     = loadMaster('items');

// ── EN ベースの「コピー専用」セクション(master に無いため en.json から流用) ──
// 言語ごとに既存 json から持ってくるが、en.json が参照ベースになる
// (types / natures / status / genera / item_categories)
const COPY_SECTIONS = ['types', 'natures', 'status', 'genera', 'item_categories'];

// ── 言語ごとの欠落カウンタ ───────────────────────────────────────────────────
const missingReport = {}; // { lang: { pokemon: N, moves: N, abilities: N, items: N } }

// ── メイン処理 ───────────────────────────────────────────────────────────────
for (const lang of TARGET_LANGS) {
  console.log(`\n[${lang}] ── 処理開始 ──`);

  const existingPath = path.join(I18N_DIR, `${lang}.json`);
  const existing = readJson(existingPath) || {};

  // 生成する新しいデータ
  const output = {};
  const diffCounts = {};

  // ── 1. pokemon ────────────────────────────────────────────────────────────
  let pokemonMissing = 0;
  const incomingPokemon = {};
  if (masterPokemon) {
    for (const entry of masterPokemon) {
      const ja = entry.names && entry.names.ja;
      if (!ja) continue; // ja 名なしはスキップ
      const langName = entry.names[lang];
      if (!langName) {
        // ja フォールバック
        incomingPokemon[ja] = ja;
        pokemonMissing++;
      } else {
        incomingPokemon[ja] = langName;
      }
    }
  }
  const existingPokemon = existing.pokemon || {};
  const pokemonResult = mergeEntries(existingPokemon, incomingPokemon);
  output.pokemon = pokemonResult.merged;
  diffCounts.pokemon = { added: pokemonResult.added, updated: pokemonResult.updated };

  // ── 2. moves ──────────────────────────────────────────────────────────────
  let movesMissing = 0;
  const incomingMoves = {};
  if (masterMoves) {
    for (const entry of masterMoves) {
      const ja = entry.names && entry.names.ja;
      if (!ja) continue; // ja 名なしはスキップ(仕様通り)
      const key = entry.key || entry.slug;
      if (!key) continue;
      const langName = entry.names[lang];
      let name;
      if (!langName) {
        // en フォールバック
        name = entry.names.en || ja;
        movesMissing++;
      } else {
        name = langName;
      }
      // desc: ja のみ独自管理。他言語は空文字。en の場合、既存 desc があれば保持。
      const existingEntry = (existing.moves || {})[key];
      let desc = '';
      if (lang === 'en') {
        // en は既存の desc を保持(上書きしない)
        desc = (existingEntry && typeof existingEntry.desc === 'string')
          ? existingEntry.desc
          : '';
      } else {
        // 他言語: 既存があれば保持、なければ空
        desc = (existingEntry && typeof existingEntry.desc === 'string')
          ? existingEntry.desc
          : '';
      }
      incomingMoves[key] = { name, desc };
    }
  }
  const existingMoves = existing.moves || {};
  const movesResult = mergeEntries(existingMoves, incomingMoves);
  output.moves = movesResult.merged;
  diffCounts.moves = { added: movesResult.added, updated: movesResult.updated };

  // ── 3. abilities ──────────────────────────────────────────────────────────
  let abilitiesMissing = 0;
  const incomingAbilities = {};
  if (masterAbilities) {
    for (const entry of masterAbilities) {
      const ja = entry.names && entry.names.ja;
      if (!ja) continue;
      const langName = entry.names[lang];
      let name;
      if (!langName) {
        name = entry.names.en || ja;
        abilitiesMissing++;
      } else {
        name = langName;
      }
      // short_effect: en のみ effect_en から取得(短縮なし・そのまま)、他言語は空文字
      // 既存エントリの short_effect は保持
      const existingEntry = (existing.abilities || {})[ja];
      let short_effect = '';
      if (lang === 'en') {
        if (existingEntry && typeof existingEntry.short_effect === 'string' && existingEntry.short_effect) {
          short_effect = existingEntry.short_effect;
        } else {
          short_effect = entry.effect_en || '';
        }
      } else {
        short_effect = (existingEntry && typeof existingEntry.short_effect === 'string')
          ? existingEntry.short_effect
          : '';
      }
      incomingAbilities[ja] = { name, short_effect };
    }
  }
  const existingAbilities = existing.abilities || {};
  const abilitiesResult = mergeEntries(existingAbilities, incomingAbilities);
  output.abilities = abilitiesResult.merged;
  diffCounts.abilities = { added: abilitiesResult.added, updated: abilitiesResult.updated };

  // ── 4. items ──────────────────────────────────────────────────────────────
  let itemsMissing = 0;
  const incomingItems = {};
  if (masterItems) {
    for (const entry of masterItems) {
      const ja = entry.names && entry.names.ja;
      if (!ja) continue;
      const langName = entry.names[lang];
      let name;
      if (!langName) {
        name = entry.names.en || ja;
        itemsMissing++;
      } else {
        name = langName;
      }
      // effect: 既存を保持。en の場合は effect_en を使用(既存優先)
      const existingEntry = (existing.items || {})[ja];
      let effect = '';
      if (lang === 'en') {
        if (existingEntry && typeof existingEntry.effect === 'string' && existingEntry.effect) {
          effect = existingEntry.effect;
        } else {
          effect = entry.effect_en || '';
        }
      } else {
        effect = (existingEntry && typeof existingEntry.effect === 'string')
          ? existingEntry.effect
          : '';
      }
      incomingItems[ja] = { name, effect };
    }
  }
  const existingItems = existing.items || {};
  const itemsResult = mergeEntries(existingItems, incomingItems);
  output.items = itemsResult.merged;
  diffCounts.items = { added: itemsResult.added, updated: itemsResult.updated };

  // ── 5. コピーセクション(types / natures / status / genera / item_categories) ──
  // 既存 lang.json から持つ。存在しなければ en.json から持つ。
  // (master には含まれないため)
  const enJson = readJson(path.join(I18N_DIR, 'en.json')) || {};
  for (const section of COPY_SECTIONS) {
    if (existing[section]) {
      output[section] = existing[section];
    } else if (enJson[section]) {
      // en フォールバック(新規言語の場合)
      output[section] = enJson[section];
      console.log(`  [${section}] en フォールバックを使用`);
    }
  }

  // ── 6. _unresolved / _fallback_keys は既存のまま引き継ぎ ─────────────────
  if (existing._unresolved) output._unresolved = existing._unresolved;
  if (existing._fallback_keys) output._fallback_keys = existing._fallback_keys;

  // ── 7. _meta 構築 ─────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const entry_counts = {
    pokemon: Object.keys(output.pokemon || {}).length,
    moves: Object.keys(output.moves || {}).length,
    abilities: Object.keys(output.abilities || {}).length,
    items: Object.keys(output.items || {}).length,
    types: Object.keys(output.types || {}).length,
    natures: Object.keys(output.natures || {}).length,
    status: Object.keys(output.status || {}).length,
    genera: Object.keys(output.genera || {}).length,
    item_categories: Object.keys(output.item_categories || {}).length,
  };

  // 既存 _meta の手動上書き情報を保持
  const prevMeta = existing._meta || {};
  output._meta = Object.assign({}, prevMeta, {
    // generated_at廃止(2026-07-03): タイムスタンプは冪等性を壊す(ビルド2回=差分0がゲート)。生成元はgit履歴で追える。
    source: 'reference/master_{pokemon,moves,abilities,items}.json via build_i18n_entities.js',
    lang,
    build_script: 'tools/build_i18n_entities.js',
    entry_counts,
    // 既存の manual_overrides は保持
    manual_overrides: prevMeta.manual_overrides || {},
  });

  // ── 8. セクション順序を en.json に合わせて整列 ───────────────────────────
  // 既存の順序: _meta, types, abilities, pokemon, moves, ..., genera, natures, status, items, item_categories
  const SECTION_ORDER = [
    '_meta', 'types', 'abilities', 'pokemon', 'moves',
    '_unresolved', '_fallback_keys',
    'genera', 'natures', 'status', 'items', 'item_categories',
  ];
  const ordered = {};
  for (const key of SECTION_ORDER) {
    if (key in output) ordered[key] = output[key];
  }
  // 残りのキーは末尾に追加(上記リストにないもの)
  for (const key of Object.keys(output)) {
    if (!(key in ordered)) ordered[key] = output[key];
  }

  // ── 欠落カウント記録 ─────────────────────────────────────────────────────
  missingReport[lang] = {
    pokemon: pokemonMissing,
    moves: movesMissing,
    abilities: abilitiesMissing,
    items: itemsMissing,
  };

  // ── 差分レポート出力 ─────────────────────────────────────────────────────
  console.log(`  pokemon   : +${diffCounts.pokemon.added} added, ~${diffCounts.pokemon.updated} updated`);
  console.log(`  moves     : +${diffCounts.moves.added} added, ~${diffCounts.moves.updated} updated`);
  console.log(`  abilities : +${diffCounts.abilities.added} added, ~${diffCounts.abilities.updated} updated`);
  console.log(`  items     : +${diffCounts.items.added} added, ~${diffCounts.items.updated} updated`);

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] ${existingPath} は書き込みスキップ`);
  } else {
    writeJson(existingPath, ordered);
    console.log(`  [書き込み完了] ${existingPath}`);
  }
}

// ── 言語別欠落レポート ───────────────────────────────────────────────────────
console.log('\n\n━━━ 言語別 ja フォールバック(欠落)レポート ━━━');
console.log('lang'.padEnd(12) + 'pokemon'.padEnd(10) + 'moves'.padEnd(10) + 'abilities'.padEnd(12) + 'items');
console.log('─'.repeat(54));
for (const lang of TARGET_LANGS) {
  const r = missingReport[lang] || {};
  console.log(
    lang.padEnd(12) +
    String(r.pokemon || 0).padEnd(10) +
    String(r.moves || 0).padEnd(10) +
    String(r.abilities || 0).padEnd(12) +
    String(r.items || 0)
  );
}
console.log('\n完了。' + (DRY_RUN ? '(dry-run: ファイル未更新)' : ''));
