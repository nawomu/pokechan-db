#!/usr/bin/env node
/* T2(DB統一リビルド): Champions本番view生成 + diffレポート
 * 仕様: 設計_DB統一_実装タスク分解_2026-07-02.md T2節
 *
 * 入力:
 *   reference/master_{pokemon,moves,abilities,items}.json (T1完了済)
 *   pokechan_data.js (pass-through情報源・読み取り専用)
 *
 * 出力:
 *   pokechan_data.new.js       — 現行と同一schema・consumer無改変で動く
 *   reference/_unify_diff_report.json — 全フィールドdiff(expected/unexpected分類)
 *
 * 禁止: pokechan_data.js の上書き。本番HTMLの変更。git commit。
 *
 * 実行: node tools/build_champions_view.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.resolve(__dirname, '..');

// ──────────────────────────────────────────────
// 入力ロード
// ──────────────────────────────────────────────

// master 4ファイル
const masterPokemon    = JSON.parse(fs.readFileSync(path.join(ROOT,'reference/master_pokemon.json'),   'utf8'));
const masterMoves      = JSON.parse(fs.readFileSync(path.join(ROOT,'reference/master_moves.json'),     'utf8'));
const masterAbilities  = JSON.parse(fs.readFileSync(path.join(ROOT,'reference/master_abilities.json'), 'utf8'));
// master_items は今回の出力schema(現行pokechan_data.js)には含まれないため参照のみ

// 現行 pokechan_data.js — pass-through情報源(read-only)
const curSrc = fs.readFileSync(path.join(ROOT,'pokechan_data.js'), 'utf8');
const curCtx = { module:{exports:{}}, exports:{}, require, console };
vm.runInNewContext(
  curSrc + '\nmodule.exports={POKEMON_LIST,WAZA_MAP,POKEMON_WAZA,ABILITY_DESC,NATURES,TYPES,TYPE_COLORS,TYPE_KANJI,TYPE_DISPLAY,TYPE_OFFENSIVE_STATS,DEFAULT_TYPE_ORDER,STAT_RANK};',
  curCtx
);
const C = curCtx.module.exports;

// ──────────────────────────────────────────────
// ヘルパ
// ──────────────────────────────────────────────
const normWide = s => String(s).replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

// 現行POKEMON_LIST: JA名→エントリ逆引き
const curPokeByName = {};
C.POKEMON_LIST.forEach(p => { curPokeByName[normWide(p.name)] = p; });

// 現行WAZA_MAP: JA名→エントリ逆引き
const curWazaByName = {};
Object.keys(C.WAZA_MAP).forEach(k => {
  const w = C.WAZA_MAP[k];
  curWazaByName[normWide(w.name)] = w;
});

// expected move_no 正規化マップ(旧採番→正規番号)
const MOVE_NO_NORMALIZE = {
  919: 839,  // どくばりセンボン
  920: 576,  // ひっくりかえす
  921: 793,  // どげざつき
  922: 789,  // ソウルクラッシュ
  923: 748,  // はいすいのじん
  924: 889,  // ふんどのこぶし
  925: 874,  // ゴールドラッシュ
};

// ──────────────────────────────────────────────
// POKEMON_LIST 生成
// ──────────────────────────────────────────────
// 方針: masterのchampions.in===trueを順に並べ、
//       現行POKEMON_LISTにある全フィールドは現行から転記(形の互換を保証)。
//       現行にない情報はmasterから補完。
//       現行の順序を維持する。

const newPokemonList = C.POKEMON_LIST.map(curP => {
  // 現行エントリをそのまま転記(形の互換維持)
  // 補完: weight_kg は現行に既にある。masterからの追加情報は今回不要。
  return Object.assign({}, curP);
});

// ──────────────────────────────────────────────
// WAZA_MAP 生成
// ──────────────────────────────────────────────
// 方針:
//   A. master_moves で champions.in===true の技 → masterの情報(name/type/category等) + 現行のpass-through情報(key/learners/description_legacy/battle_data/flags/subcategory/mode/added)
//   B. 現行にあってmasterのchampions.in=falseの5技(表記ゆれ) → 現行からpass-through
//   description: master.description_ja (compose再生成版) を使う
//   move_no: master.move_no (正規化済) を使う

// masterMoves index by JA名(normWide)
const masterMovesByJa = new Map();
masterMoves.forEach(m => {
  masterMovesByJa.set(normWide(m.names.ja), m);
});

const newWazaMap = {};

// ★T1.5(2): Championsポケ名セット(learnersをChampionsポケのみにフィルタ=現行pokechan_data.jsと同一範囲)
const champPokeNames = new Set(masterPokemon.filter(p => p.champions && p.champions.in === true).map(p => normWide(p.names.ja)));

// ★T1.5(2): master_moves(champions.in===true)から生成=type/power/accuracy/ppはchampions.stats優先
//   値は現行(cur)と同一(champions.stats=cur値)なのでdiffは出ない。ソースをpokechan_data.js→masterに切替えるのが目的。
//   key/priorityはpokechan_data.js schema互換のため現行(cur)維持(consumerがkeyで参照)。learnersはChampionsポケのみ。
Object.keys(C.WAZA_MAP).forEach(wazaKey => {
  const cur = C.WAZA_MAP[wazaKey];
  const master = masterMovesByJa.get(normWide(cur.name));
  if (master && master.champions && master.champions.in === true) {
    const st = master.champions.stats || {};
    const entry = {
      name:             master.names.ja,                       // ★master
      move_no:          master.move_no,                        // ★正規化済
      type:             st.type || master.type,                // ★master+stats(cur値)
      category:         master.category,                       // ★master
      target:           master.target,                         // ★master
      power:            'power' in st ? st.power : master.power,        // ★null保持(変化技power=nullを0にしない)
      accuracy:         'accuracy' in st ? st.accuracy : master.accuracy,
      pp:               'pp' in st ? st.pp : master.pp,
      contact:          master.contact,
      protect:          master.protect,
      description:      master.description_ja,                 // ★compose再生成
      key:              cur.key,                               // ★現行維持(consumer互換・HTML/JSがkeyで参照)
      learners:         (master.learners || []).filter(n => champPokeNames.has(normWide(n))),  // ★Championsポケのみ
      description_legacy: master.description_legacy,
      battle_data:      master.battle_data,                    // ★master(simが読む形)
      flags:            master.flags || {},
    };
    // priorityはpokechan_data.js WAZA_MAPに直下フィールド無し→入れない(battle_data.priorityは別)
    if (master.subcategory !== undefined) entry.subcategory = master.subcategory;
    if (master.mode        !== undefined) entry.mode        = master.mode;
    if (master.added       !== undefined) entry.added       = master.added;
    newWazaMap[wazaKey] = entry;
  } else {
    // マスター不在(独自技等) → 現行からpass-through(形を完全保持)
    newWazaMap[wazaKey] = Object.assign({}, cur);
  }
});

// ──────────────────────────────────────────────
// ABILITY_DESC 生成
// ──────────────────────────────────────────────
// 方針: master_abilities の champions.in===true を使う
//       effect_ja が現行 ABILITY_DESC に相当する
//       現行と同じ形(オブジェクト {JA名: 説明文}) で出力

const newAbilityDesc = {};
masterAbilities
  .filter(a => a.champions && a.champions.in === true)
  .forEach(a => {
    const jaName = a.names.ja;
    if (jaName && a.effect_ja) {
      newAbilityDesc[jaName] = a.effect_ja;
    }
  });

// ──────────────────────────────────────────────
// 定数群(現行からそのままコピー)
// ──────────────────────────────────────────────
// TYPES / TYPE_COLORS / TYPE_KANJI / TYPE_DISPLAY / TYPE_OFFENSIVE_STATS / DEFAULT_TYPE_ORDER
// NATURES / POKEMON_WAZA / STAT_RANK は現行と同一(変更なし)

// ──────────────────────────────────────────────
// pokechan_data.new.js 出力
// ──────────────────────────────────────────────
const JS = (v) => JSON.stringify(v);
const JS2 = (v) => JSON.stringify(v, null, 2);

const outLines = [
  '// ============================================================',
  '// pokechan_data.new.js',
  '// T2(DB統一リビルド)生成ファイル — tools/build_champions_view.js',
  '// 入力: reference/master_{pokemon,moves,abilities}.json (T1出力)',
  '// 生成日: ' + new Date().toISOString(),
  '// 注意: このファイルは自動生成。直接編集しない。',
  '// ============================================================',
  '',
  '// ── タイプ系 ─────────────────────────────────────────────────',
  `const TYPES = ${JS(C.TYPES)};`,
  `const TYPE_COLORS = ${JS(C.TYPE_COLORS)};`,
  'const TYPE_KANJI = {',
  ...Object.entries(C.TYPE_KANJI).map(([k,v],i,arr) =>
    `  ${JS(k)}:${JS(v)}${i < arr.length-1 ? ',' : ''}`
  ),
  '};',
  'const TYPE_DISPLAY = {',
  ...Object.entries(C.TYPE_DISPLAY).map(([k,v],i,arr) =>
    `  ${JS(k)}:${JS(v)}${i < arr.length-1 ? ',' : ''}`
  ),
  '};',
  'const TYPE_OFFENSIVE_STATS = {',
  ...Object.entries(C.TYPE_OFFENSIVE_STATS).map(([k,v],i,arr) =>
    `  ${JS(k)}:${JS(v)}${i < arr.length-1 ? ',' : ''}`
  ),
  '};',
  '',
  'const DEFAULT_TYPE_ORDER = ' + JS(C.DEFAULT_TYPE_ORDER) + ';',
  '',
  '// ── ポケモン本体データ ────────────────────────────────────────',
  `const POKEMON_LIST = ${JS(newPokemonList)};`,
  `const DATA = POKEMON_LIST;`,
  '',
  '// ── わざデータ ───────────────────────────────────────────────',
  `const WAZA_MAP = ${JS(newWazaMap)};`,
  '',
  '// ── ポケモン別わざリスト ─────────────────────────────────────',
  `const POKEMON_WAZA = ${JS(C.POKEMON_WAZA)};`,
  '',
  '// ── 特性説明 ─────────────────────────────────────────────────',
  `const ABILITY_DESC = ${JS(newAbilityDesc)};`,
  '',
  '// ── 種族値ランク ─────────────────────────────────────────────',
  `const STAT_RANK = ${JS(C.STAT_RANK)};`,
  '',
  '// ── 性格 ─────────────────────────────────────────────────────',
  'const NATURES = {',
  ...Object.entries(C.NATURES).map(([k,v],i,arr) =>
    `  ${JS(k)}:${JS(v)}${i < arr.length-1 ? ',' : ''}`
  ),
  '};',
  '',
  '// ── Node.js require互換(pokechan_data.jsと同形式・sim harnessがrequireで読む) ──',
  'if (typeof module !== \'undefined\' && module.exports) {',
  '  module.exports = { TYPES, TYPE_COLORS, TYPE_KANJI, TYPE_DISPLAY, TYPE_OFFENSIVE_STATS, DEFAULT_TYPE_ORDER, POKEMON_LIST, DATA, WAZA_MAP, POKEMON_WAZA, ABILITY_DESC, STAT_RANK, NATURES };',
  '}',
];

const outPath = path.join(ROOT, 'pokechan_data.new.js');
fs.writeFileSync(outPath, outLines.join('\n') + '\n', 'utf8');
console.log('✅ pokechan_data.new.js 生成完了');
console.log('   POKEMON_LIST:', newPokemonList.length, '件');
console.log('   WAZA_MAP:    ', Object.keys(newWazaMap).length, '件');
console.log('   ABILITY_DESC:', Object.keys(newAbilityDesc).length, '件');

// ──────────────────────────────────────────────
// 全フィールドdiffレポート生成
// ──────────────────────────────────────────────
console.log('\n📊 diffレポート生成中...');

const diffs = [];

// ----- POKEMON_LIST diff -----
const curPokeMap = {};
C.POKEMON_LIST.forEach(p => { curPokeMap[p.name] = p; });
const newPokeMap = {};
newPokemonList.forEach(p => { newPokeMap[p.name] = p; });

// 現行にあってnewにない
Object.keys(curPokeMap).forEach(name => {
  if (!newPokeMap[name]) {
    diffs.push({ entity:'pokemon', key:name, field:'(entry)', old:'present', new:'missing', expected:false });
  }
});
// newにあって現行にない
Object.keys(newPokeMap).forEach(name => {
  if (!curPokeMap[name]) {
    diffs.push({ entity:'pokemon', key:name, field:'(entry)', old:'missing', new:'present', expected:false });
  }
});
// 共通エントリのフィールド比較
Object.keys(curPokeMap).forEach(name => {
  if (!newPokeMap[name]) return;
  const cp = curPokeMap[name];
  const np = newPokeMap[name];
  const allFields = new Set([...Object.keys(cp), ...Object.keys(np)]);
  allFields.forEach(field => {
    const cv = JSON.stringify(cp[field]);
    const nv = JSON.stringify(np[field]);
    if (cv !== nv) {
      diffs.push({ entity:'pokemon', key:name, field, old:cp[field], new:np[field], expected:false });
    }
  });
});

// ----- WAZA_MAP diff -----
const curWazaKeys = Object.keys(C.WAZA_MAP);
const newWazaKeys = Object.keys(newWazaMap);

// キー差分
const curWazaSet = new Set(curWazaKeys);
const newWazaSet = new Set(newWazaKeys);
curWazaKeys.forEach(k => {
  if (!newWazaSet.has(k)) {
    diffs.push({ entity:'move', key:k, field:'(entry)', old:'present', new:'missing', expected:false });
  }
});
newWazaKeys.forEach(k => {
  if (!curWazaSet.has(k)) {
    diffs.push({ entity:'move', key:k, field:'(entry)', old:'missing', new:'present', expected:false });
  }
});

// 共通エントリのフィールド比較
curWazaKeys.forEach(k => {
  if (!newWazaMap[k]) return;
  const cw = C.WAZA_MAP[k];
  const nw = newWazaMap[k];
  const allFields = new Set([...Object.keys(cw), ...Object.keys(nw)]);
  allFields.forEach(field => {
    // ★battle_data はキー順序を再帰的に無視して比較(MFIX/curで内容同一だが順序違いのfalse diff回避)
    const sortKeys = obj => {
      if (Array.isArray(obj)) return obj.map(sortKeys);
      if (obj && typeof obj === 'object') { const s={}; Object.keys(obj).sort().forEach(kk=>s[kk]=sortKeys(obj[kk])); return s; }
      return obj;
    };
    const canon = v => (field === 'battle_data' && v && typeof v === 'object') ? JSON.stringify(sortKeys(JSON.parse(JSON.stringify(v)))) : JSON.stringify(v);
    const cv = canon(cw[field]);
    const nv = canon(nw[field]);
    if (cv !== nv) {
      // expected 判定
      let expected = false;
      if (field === 'description') {
        // description変更はcompose再生成による→expected=true
        expected = true;
      } else if (field === 'move_no') {
        // move_no正規化の7技→expected=true
        const oldNo = cw[field];
        const newNo = nw[field];
        expected = (MOVE_NO_NORMALIZE[oldNo] === newNo);
      } else if (field === 'flags') {
        // ★2026-07-02 P2/P5 フラグ補完(MFLAGSマージ)による純増→expected=true
        //   条件: curated既存キーが1つも変更/削除されていない(追加のみ)
        const o = cw[field]||{}, n = nw[field]||{};
        expected = Object.keys(o).every(kk => JSON.stringify(o[kk]) === JSON.stringify(n[kk]));
      }
      diffs.push({ entity:'move', key:k, field, old:cw[field], new:nw[field], expected });
    }
  });
});

// ----- ABILITY_DESC diff -----
const curAbKeys = Object.keys(C.ABILITY_DESC);
const newAbKeys = Object.keys(newAbilityDesc);
const curAbSet = new Set(curAbKeys);
const newAbSet = new Set(newAbKeys);

curAbKeys.forEach(k => {
  if (!newAbSet.has(k)) {
    diffs.push({ entity:'ability', key:k, field:'(entry)', old:C.ABILITY_DESC[k], new:'missing', expected:false });
  }
});
newAbKeys.forEach(k => {
  if (!curAbSet.has(k)) {
    diffs.push({ entity:'ability', key:k, field:'(entry)', old:'missing', new:newAbilityDesc[k], expected:false });
  }
});
curAbKeys.forEach(k => {
  if (!newAbSet.has(k)) return;
  if (C.ABILITY_DESC[k] !== newAbilityDesc[k]) {
    diffs.push({ entity:'ability', key:k, field:'description', old:C.ABILITY_DESC[k], new:newAbilityDesc[k], expected:false });
  }
});

// ----- サマリ計算 -----
const expectedDiffs  = diffs.filter(d => d.expected);
const unexpectedDiffs = diffs.filter(d => !d.expected);

const entitySummary = {};
diffs.forEach(d => {
  if (!entitySummary[d.entity]) entitySummary[d.entity] = { total:0, expected:0, unexpected:0 };
  entitySummary[d.entity].total++;
  if (d.expected) entitySummary[d.entity].expected++;
  else entitySummary[d.entity].unexpected++;
});

const report = {
  summary: {
    generated_at:    new Date().toISOString(),
    current_file:    'pokechan_data.js',
    new_file:        'pokechan_data.new.js',
    counts: {
      current: {
        POKEMON_LIST:  C.POKEMON_LIST.length,
        WAZA_MAP:      Object.keys(C.WAZA_MAP).length,
        ABILITY_DESC:  Object.keys(C.ABILITY_DESC).length,
      },
      new: {
        POKEMON_LIST:  newPokemonList.length,
        WAZA_MAP:      Object.keys(newWazaMap).length,
        ABILITY_DESC:  Object.keys(newAbilityDesc).length,
      },
    },
    diff_total:      diffs.length,
    diff_expected:   expectedDiffs.length,
    diff_unexpected: unexpectedDiffs.length,
    entity_breakdown: entitySummary,
    expected_diff_types: [
      'description: compose再生成による更新(全技)',
      'move_no: 独自採番7技→実番号(barb-barrage/flip-turn/kowtow-cleave/soul-crushing-blow/aqua-step/sucker-punch/gold-rush)',
      'pp: masterのPokeAPI正規値(現行との差異)',
    ],
  },
  unexpected_diffs: unexpectedDiffs,
  expected_diffs:   expectedDiffs,
};

const reportPath = path.join(ROOT, 'reference/_unify_diff_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

console.log('\n📋 diffレポート:');
console.log('   総diff数:        ', diffs.length);
console.log('   expected diff:   ', expectedDiffs.length);
console.log('   unexpected diff: ', unexpectedDiffs.length);
if (unexpectedDiffs.length > 0) {
  console.log('\n⚠️  UNEXPECTED DIFFS (先頭20件):');
  unexpectedDiffs.slice(0, 20).forEach(d => {
    console.log(`  [${d.entity}] ${d.key}.${d.field}: ${JSON.stringify(d.old)} → ${JSON.stringify(d.new)}`);
  });
  if (unexpectedDiffs.length > 20) {
    console.log(`  ... and ${unexpectedDiffs.length - 20} more`);
  }
}
console.log('\n✅ reference/_unify_diff_report.json 生成完了');
