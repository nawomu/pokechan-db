#!/usr/bin/env node
/* tools/_freeze_legacy_seasons.js — 旧生成物 pokechan_data_all.js の POKEMON_LIST.season を凍結する
 *
 * 目的(段B・計画_マスターからページへ流す_2026-09-01.md): 旧生成物にしか無い資産7項目の②。
 *   season = そのポケモンが過去+現在、どのレギュレーションで登場したかの履歴配列(例 ["M-A","M-B"])。
 *   master/regulations.json は「過去のレギュレーションは保持しない」設計なので、M-Aの履歴(218件)は
 *   master側では再構築できない。★この履歴を失う前に、いま一度だけスナップショットして reference/ に凍結する。
 *
 * ★このスクリプトは「一度だけ実行して結果をrepoにコミットする」凍結用。build_master_v2.js は
 *   pokechan_data_all.js を直接読まず、この凍結ファイルを読む(段Eで旧生成物入力を切る準備)。
 *
 * 出力: reference/_legacy_seasons.json = { "<pokechan_data_all.js の生の名前>": [...season] , ... }
 *   キーは**正規化前の生の名前**(全角混じりも含む・verbatim)。build_master_v2.js 側で
 *   e.nat.name(A.POKEMON_LIST の生の行オブジェクト)をキーに引く前提。
 *
 * 実行: node tools/_freeze_legacy_seasons.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const A = require(path.join(ROOT, 'pokechan_data_all.js'));

const out = {};
let nonEmpty = 0;
A.POKEMON_LIST.forEach(p => {
  const season = Array.isArray(p.season) ? p.season.slice() : [];
  out[p.name] = season;
  if (season.length) nonEmpty++;
});

const payload = {
  meta: {
    what: '旧生成物 pokechan_data_all.js の POKEMON_LIST.season を凍結したもの(段B資産②)',
    generated_at: new Date().toISOString().slice(0, 10),
    generator: 'tools/_freeze_legacy_seasons.js',
    source: 'pokechan_data_all.js POKEMON_LIST[].season(verbatim・生の名前をキーに)',
    note: '値は一切加工していない。キーは正規化前の生の名前(全角混じりも含む)。' +
          'master/regulations.json は過去レギュを保持しない設計のため、この凍結ファイルがM-A履歴の唯一の保存場所。',
    row_count: A.POKEMON_LIST.length,
    nonempty_count: nonEmpty,
  },
  seasons: out,
};
fs.writeFileSync(path.join(ROOT, 'reference/_legacy_seasons.json'), JSON.stringify(payload, null, 1) + '\n');
console.log(`✍ reference/_legacy_seasons.json  ${A.POKEMON_LIST.length}件(非空 ${nonEmpty}件)`);
