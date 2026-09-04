#!/usr/bin/env node
/* tools/_freeze_legacy_move_flag_keys.js — 段C準備: pokechan_data.js(Champions版)の
 * POKEMON_LIST行が持つ「技別フラグ列」(169個。pokemon_db.htmlの技フィルタチェックボックスが使う。
 * 例: mamoru/chouhatsu/negoto…)のキー名だけを凍結する。
 *
 * ★段Bの棚卸し(reference/_plans/棚卸し_生成物にしか無い資産_2026-09-01.md)には無かった追加発見。
 *   キー名は master/moves.json[].champions_key と1対1(169件全部が一致・検証済み)。
 *   値(true/false)はここでは凍結しない → build_views.js が master/learnsets.json から
 *   都度計算する(棚卸しドキュメント記載の方式: 対象ポケモンのlearn[]にその技名が入っていればtrue)。
 *
 * ★これは「キー名の一覧」だけの凍結(名前だけ・データではない)。build_views.js はこの凍結ファイルを
 *   読むだけで pokechan_data.js を直接requireしない(段Cの禁止事項を守る)。
 *
 * 実行(一度だけ・再実行は差分監査用): node tools/_freeze_legacy_move_flag_keys.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const C = require(path.join(ROOT, 'reference', '_legacy_snapshot', 'pokechan_data.js'));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'master/moves.json'), 'utf8'));

const KNOWN_NON_FLAG_KEYS = new Set([
  'no', 'name', 'weight_kg', 'form', 'mega', 'type1', 'type2',
  'hp', 'atk', 'def', 'spatk', 'spdef', 'spd', 'total', 'ab1', 'ab2', 'ab3', 'resist',
  'cnt4', 'cnt2', 'cnt1', 'cnthf', 'cntqf', 'cnt0', 'cnt42', 'cnthfqf',
  'okatazuke', 'added_in',
]);

const allKeys = new Set();
C.POKEMON_LIST.forEach(p => Object.keys(p).forEach(k => allKeys.add(k)));
const flagKeys = [...allKeys].filter(k => !KNOWN_NON_FLAG_KEYS.has(k)).sort();

const champKeySet = new Set(M.items.filter(x => x.champions_key).map(x => x.champions_key));
const notFound = flagKeys.filter(k => !champKeySet.has(k));

const out = {
  meta: {
    what: '段C準備: pokechan_data.js POKEMON_LIST の技別フラグ列(169個)のキー名だけを凍結したもの。',
    generated_at: '2026-09-01',
    generator: 'tools/_freeze_legacy_move_flag_keys.js',
    note: 'キー名=master/moves.json[].champions_key と1対1(169/169一致・検証済み・not_found_in_master=0件)。' +
      '値(true/false)はここに無い。build_views.js が master/learnsets.json[].learn から都度計算する。',
    not_found_in_master: notFound,
  },
  count: flagKeys.length,
  keys: flagKeys,
};
fs.writeFileSync(path.join(ROOT, 'reference/_legacy_champions_move_flag_keys.json'), JSON.stringify(out, null, 1) + '\n');
console.log('flagKeys:', flagKeys.length, 'notFoundInMaster:', notFound.length);
