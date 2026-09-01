#!/usr/bin/env node
/* tools/_freeze_legacy_order.js — 旧生成物の行順(4パス構造など)を凍結する
 *
 * 目的(段B・計画_マスターからページへ流す_2026-09-01.md): 旧生成物にしか無い資産7項目の⑦。
 *   master/pokemon.json は (no, name) の単純ソートで、旧 pokechan_data_all.js / pokechan_data.js の
 *   POKEMON_LIST の並び順(4段バケット構造。棚卸し§5参照)とは別物。この並び順は
 *   reference/pokeapi_master.json(PokeAPI取得順)をそのまま引き継いでいるだけで、明文化された
 *   ソートキーではないため、いま一度だけ「実際にどの順で並んでいたか」を凍結する。
 *   WAZA_MAP/ABILITY_DESC のキー順序(オブジェクトの挿入順)も同様に凍結する。
 *
 * ★段Bではこの並び順を master/ に書き戻さない(このファイルは「生成器(段C)が使う」ためのもの)。
 *   build_master_v2.js は本ファイルを読まない・使わない(README代わりに残すだけ)。
 *
 * 出力: reference/_legacy_order.json
 *   pokemon_all: pokechan_data_all.js POKEMON_LIST の名前配列(出現順そのまま)
 *   pokemon_champions: pokechan_data.js POKEMON_LIST の名前配列(出現順そのまま)
 *   waza_all / waza_champions: WAZA_MAP のキー配列(Object.keys=挿入順そのまま)
 *   ability_desc_all / ability_desc_champions: ABILITY_DESC のキー配列(Object.keys=挿入順そのまま)
 *
 * 実行: node tools/_freeze_legacy_order.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const A = require(path.join(ROOT, 'pokechan_data_all.js'));
const C = require(path.join(ROOT, 'pokechan_data.js'));

const payload = {
  meta: {
    what: '旧生成物の行順/キー順を凍結したもの(段B資産⑦)。段C(生成器)が旧表示順を再現する際に使う。',
    generated_at: new Date().toISOString().slice(0, 10),
    generator: 'tools/_freeze_legacy_order.js',
    note: 'POKEMON_LIST の並びは4段バケット構造(①全種1周→②地方/メガ以外の追加フォルム→③メガ全部→' +
          '④地方フォルムを地方ごとにグループ化)。明文化されたソートキーではなく、' +
          'reference/pokeapi_master.json(PokeAPI取得順)の引き継ぎ。ここでは「実際に出た順」をそのまま記録する。' +
          'WAZA_MAP/ABILITY_DESC はオブジェクトなので Object.keys() の挿入順=定義順そのまま。',
  },
  pokemon_all: A.POKEMON_LIST.map(p => p.name),
  pokemon_champions: C.POKEMON_LIST.map(p => p.name),
  waza_all: Object.keys(A.WAZA_MAP),
  waza_champions: Object.keys(C.WAZA_MAP),
  ability_desc_all: Object.keys(A.ABILITY_DESC || {}),
  ability_desc_champions: Object.keys(C.ABILITY_DESC || {}),
};
fs.writeFileSync(path.join(ROOT, 'reference/_legacy_order.json'), JSON.stringify(payload, null, 1) + '\n');
console.log('✍ reference/_legacy_order.json  ' +
  `pokemon_all=${payload.pokemon_all.length} pokemon_champions=${payload.pokemon_champions.length} ` +
  `waza_all=${payload.waza_all.length} waza_champions=${payload.waza_champions.length} ` +
  `ability_desc_all=${payload.ability_desc_all.length} ability_desc_champions=${payload.ability_desc_champions.length}`);
