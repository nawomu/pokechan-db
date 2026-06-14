#!/usr/bin/env node
// 説明文の独立検証(直訳テスト自動版)の素材を出す。
// 各技の {name, effects, compose, legacy} を JSON で。引数で技名を絞れる(無指定=全技)。
// 使い方: node tools/_waza_verify_material.js [技名 技名 …]  → /tmp/waza_verify_material.json
const fs = require('fs');
const { compose, map } = require('./_waza_compose.js');

const want = process.argv.slice(2);
const all = Object.values(map);
const picked = want.length ? all.filter(m => want.includes(m.name)) : all;

const out = picked.map(m => {
  let composed = '';
  try { composed = compose(m).text || ''; } catch (e) { composed = '(compose失敗: ' + e.message + ')'; }
  return {
    name: m.name,
    type: m.type, category: m.category, power: m.power, accuracy: m.accuracy,
    effects: (m.battle_data && m.battle_data.effects) || [],
    flags: (m.battle_data && m.flags) || m.flags || {},
    compose: composed,
    legacy: m.description_legacy || m.description || '',
  };
});

fs.writeFileSync('/tmp/waza_verify_material.json', JSON.stringify(out, null, 2));
console.log('wrote', out.length, 'moves → /tmp/waza_verify_material.json');
