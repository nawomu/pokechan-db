#!/usr/bin/env node
'use strict';
// images/item/ に実在する道具スプライト(PokeAPI由来 *.png)の一覧を images/item/_manifest.json に書く。
//   node tools/_gen_item_sprite_manifest.js
// items_db_all_v2.html はこれを読み、一覧に無い slug の画像を最初から要求しない(PokeAPI に無い第八/九世代の道具=404 を出さない)。
// 画像を足したら必ず再実行する。master には何も書かない(画像はサイト資産であってデータではない)。
const fs = require('fs');
const path = require('path');
const DIR = path.resolve(__dirname, '../images/item');
const OUT = path.join(DIR, '_manifest.json');
const list = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)).sort();
fs.writeFileSync(OUT, JSON.stringify(list) + '\n');
console.log(`images/item/_manifest.json: ${list.length} 枚`);
