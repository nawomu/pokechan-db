#!/usr/bin/env node
/* tools/_freeze_legacy_ability_desc.js — 旧生成物2本の ABILITY_DESC(家の流儀の短文)を凍結する
 *
 * 目的(段B・計画_マスターからページへ流す_2026-09-01.md): 旧生成物にしか無い資産7項目の④。
 *   master/abilities.json.effect_ja は Champions権威コーパス(ヤックン/ch/)由来の長文(公式準拠)。
 *   旧ページの ABILITY_DESC は「家の流儀」の短文(例:「毎ターンすばやさ+1。」)で**別の文章**。
 *   CLAUDE.mdの「ABILITY_DESCは公式準拠なのでそのまま可」方針とeffect_jaの権威優先方針は両立するが、
 *   ★旧ページの短文をそのまま再現するには、この短文を別途持つ必要がある(=desc_house)。
 *
 * ★このスクリプトは「一度だけ実行して結果をrepoにコミットする」凍結用。build_master_v2.js は
 *   pokechan_data.js / pokechan_data_all.js を直接読まず、この凍結ファイルを読む
 *   (段Eで旧生成物入力を切る準備)。effect_ja は一切変更しない(この凍結は desc_house 専用)。
 *
 * 出力: reference/_legacy_ability_desc.json = { national: {name: text}, champions: {name: text} }
 *
 * 実行: node tools/_freeze_legacy_ability_desc.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const A = require(path.join(ROOT, 'reference', '_legacy_snapshot', 'pokechan_data_all.js'));
const C = require(path.join(ROOT, 'reference', '_legacy_snapshot', 'pokechan_data.js'));

const national = Object.assign({}, A.ABILITY_DESC || {});
const champions = Object.assign({}, C.ABILITY_DESC || {});

const payload = {
  meta: {
    what: '旧生成物2本(全国版/Champions版)の ABILITY_DESC(家の流儀の短文)を凍結したもの(段B資産④)',
    generated_at: new Date().toISOString().slice(0, 10),
    generator: 'tools/_freeze_legacy_ability_desc.js',
    source: 'pokechan_data_all.js ABILITY_DESC(national) / pokechan_data.js ABILITY_DESC(champions)。verbatim。',
    note: 'master/abilities.json.effect_ja(Champions権威コーパス由来)とは別文章。この凍結ファイルの値は' +
          'master/abilities.json.desc_house に「Championsを優先・無ければ全国版」で1本化して載せる(desc_house_sourceに由来記録)。',
    national_count: Object.keys(national).length,
    champions_count: Object.keys(champions).length,
  },
  national,
  champions,
};
fs.writeFileSync(path.join(ROOT, 'reference/_legacy_ability_desc.json'), JSON.stringify(payload, null, 1) + '\n');
console.log(`✍ reference/_legacy_ability_desc.json  national=${Object.keys(national).length}件 champions=${Object.keys(champions).length}件`);
