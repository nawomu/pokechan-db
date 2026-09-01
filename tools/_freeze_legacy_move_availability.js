#!/usr/bin/env node
/* tools/_freeze_legacy_move_availability.js — 旧生成物 pokechan_data_all.js の WAZA_MAP[*].availability を凍結する
 *
 * 目的(段B・計画_マスターからページへ流す_2026-09-01.md): 旧生成物にしか無い資産7項目の③。
 *   availability = 各技が「どの世代から登場したか/非標準か」等(Pokemon Showdown由来、
 *   reference/_showdown/moves.json の gen/isNonstandard を deriveAvailabilityAll() で結合したもの
 *   =tools/_build_pokechan_data_all.js:52-64)。919件全部が値を持つが master/moves.json には欄自体が無い。
 *
 * ★この外部由来ソース(Showdown)自体は master に未移送のため、いま一度だけ pokechan_data_all.js から
 *   出来上がった値をそのまま凍結する。build_master_v2.js はこの凍結ファイルを読む(pokechan_data_all.js
 *   を直接読まない・段Eで旧生成物入力を切る準備)。
 *
 * 出力: reference/_legacy_move_availability.json = { "<slug(=WAZA_MAPのキー)>": {availability...}, ... }
 *
 * 実行: node tools/_freeze_legacy_move_availability.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const A = require(path.join(ROOT, 'pokechan_data_all.js'));

const out = {};
let count = 0;
Object.entries(A.WAZA_MAP).forEach(([slug, m]) => {
  if (m.availability === undefined) return;
  out[slug] = m.availability;
  count++;
});

const payload = {
  meta: {
    what: '旧生成物 pokechan_data_all.js の WAZA_MAP[*].availability を凍結したもの(段B資産③)',
    generated_at: new Date().toISOString().slice(0, 10),
    generator: 'tools/_freeze_legacy_move_availability.js',
    source: 'pokechan_data_all.js WAZA_MAP[slug].availability(verbatim)。' +
            '出どころ=Pokemon Showdown reference/_showdown/moves.json(gen/isNonstandard)を' +
            'deriveAvailabilityAll()(tools/_build_pokechan_data_all.js:52-64)で結合したもの。',
    note: '値は一切加工していない。キーはWAZA_MAPのキー(=master/moves.jsonのslug)。',
    row_count: Object.keys(A.WAZA_MAP).length,
    with_availability_count: count,
  },
  availability: out,
};
fs.writeFileSync(path.join(ROOT, 'reference/_legacy_move_availability.json'), JSON.stringify(payload, null, 1) + '\n');
console.log(`✍ reference/_legacy_move_availability.json  ${count}件`);
