// プリセット集の機械照合スクリプト(scratchpad専用・本番非改変)
// 1) 技名がWAZA_MAPに実在するか 2) その技のlearnersに種名が入っているか
// 3) 特性がPOKEMON_LISTのab1/ab2/ab3のいずれかか 4) 性格がNATURESに実在するか
// 5) 持ち物がitems_database.jsonでimplemented_in_pokechan=trueか 6) EV合計66・各ステータス32以下か
const fs = require('fs');
const path = require('path');
const REPO = '/Users/masamichi/Documents/ポケモンDB';
const D = require(path.join(REPO, 'pokechan_data.js'));

const itemsTxt = fs.readFileSync(path.join(REPO, 'items_database.js'), 'utf8');
const sandbox = {};
new Function('window', itemsTxt.replace('window.ITEMS_DATABASE', 'window.ITEMS_DATABASE'))(sandbox);
const ITEMS = sandbox.ITEMS_DATABASE.items;

const presets = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'preset_builds_draft_v1.json'),
  'utf8'
));

const nameToMove = {};
for (const m of Object.values(D.WAZA_MAP)) nameToMove[m.name] = m;

let ok = 0, fail = 0;
const report = [];

for (const p of presets) {
  const errs = [];
  const poke = D.POKEMON_LIST.find(x => x.name === p.species);
  if (!poke) errs.push(`種が見つからない: ${p.species}`);

  // moves
  for (const mv of p.moves) {
    const m = nameToMove[mv];
    if (!m) { errs.push(`技が存在しない: ${mv}`); continue; }
    if (!m.learners || !m.learners.includes(p.species)) {
      errs.push(`${p.species} は ${mv} のlearnersに含まれない`);
    }
  }
  if (new Set(p.moves).size !== p.moves.length) errs.push('技が重複');

  // ability
  if (poke) {
    const abs = [poke.ab1, poke.ab2, poke.ab3].filter(Boolean);
    if (!abs.includes(p.ability)) errs.push(`特性不一致: ${p.ability} not in [${abs.join('/')}]`);
  }

  // nature
  if (!D.NATURES[p.nature]) errs.push(`性格が存在しない: ${p.nature}`);

  // item
  const isMegaStoneName = /ナイト$/.test(p.item);
  const item = ITEMS.find(x => x.name === p.item);
  if (!item) errs.push(`持ち物が存在しない: ${p.item}`);
  else if (!item.implemented_in_pokechan) errs.push(`持ち物が未実装: ${p.item}`);

  // mega item <-> mega species consistency
  const isMegaSpecies = p.species.startsWith('メガ');
  if (isMegaSpecies && item && item.category !== 'mega_stone') {
    errs.push(`メガ種なのに持ち物がメガストーンでない: ${p.item}`);
  }
  if (!isMegaSpecies && item && item.category === 'mega_stone') {
    errs.push(`非メガ種なのにメガストーンを持たせている: ${p.item}`);
  }

  // EV total / cap
  const ev = p.ev;
  const total = ev.hp + ev.atk + ev.def + ev.spatk + ev.spdef + ev.spd;
  if (total !== 66) errs.push(`EV合計が66でない: ${total}`);
  for (const [k, v] of Object.entries(ev)) {
    if (v < 0 || v > 32) errs.push(`EV上限(32)超過/負数: ${k}=${v}`);
  }

  if (errs.length) { fail++; report.push({ id: p.id, species: p.species, errs }); }
  else ok++;
}

console.log(`OK: ${ok} / FAIL: ${fail} / TOTAL: ${presets.length}`);
if (report.length) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('全プリセット、技実在・learners一致・特性一致・性格一致・持ち物実装・EV上限とも問題なし');
}
