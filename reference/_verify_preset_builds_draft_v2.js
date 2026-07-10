// v2プリセット集(実戦ソース版)の機械照合スクリプト(scratchpad寄りのreference専用・本番非改変)
// v1(reference/_verify_preset_builds_draft_v1.js)を土台に、item_pending/substitute_item の検証を追加。
// 1) 技名がWAZA_MAPに実在するか 2) その技のlearnersに種名が入っているか
// 3) 特性がPOKEMON_LISTのab1/ab2/ab3のいずれかか 4) 性格がNATURESに実在するか
// 5) item_pending=false の持ち物はitems_database.jsonでimplemented_in_pokechan=trueか
// 6) item_pending=true の場合は substitute_item が実在しimplemented_in_pokechanか
// 7) メガ種は持ち物(item)自体がそのメガ専用ストーン(実装済)であること(pendingにはならない想定)
// 8) EV合計66・各ステータス32以下か
const fs = require('fs');
const path = require('path');
const REPO = '/Users/masamichi/Documents/ポケモンDB';
const D = require(path.join(REPO, 'pokechan_data.js'));

const itemsTxt = fs.readFileSync(path.join(REPO, 'items_database.js'), 'utf8');
const sandbox = {};
new Function('window', itemsTxt.replace('window.ITEMS_DATABASE', 'window.ITEMS_DATABASE'))(sandbox);
const ITEMS = sandbox.ITEMS_DATABASE.items;
const itemByName = new Map(ITEMS.map(i => [i.name, i]));

const presetFile = process.argv[2] || path.join(__dirname, 'preset_builds_draft_v2.json');
const presets = JSON.parse(fs.readFileSync(presetFile, 'utf8'));

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
  if (p.moves.length !== 4) errs.push(`技が4つでない: ${p.moves.length}`);

  // ability
  if (poke) {
    const abs = [poke.ab1, poke.ab2, poke.ab3].filter(Boolean);
    if (!abs.includes(p.ability)) errs.push(`特性不一致: ${p.ability} not in [${abs.join('/')}]`);
  }

  // nature
  if (!D.NATURES[p.nature]) errs.push(`性格が存在しない: ${p.nature}`);

  // item / item_pending / substitute_item
  const item = itemByName.get(p.item);
  if (!item) errs.push(`持ち物が存在しない: ${p.item}`);
  if (p.item_pending) {
    if (item && item.implemented_in_pokechan) {
      errs.push(`item_pending=trueだが持ち物は既に実装済み: ${p.item}(見直し要)`);
    }
    if (!p.substitute_item) {
      errs.push('item_pending=trueなのにsubstitute_itemが無い');
    } else {
      const sub = itemByName.get(p.substitute_item);
      if (!sub) errs.push(`substitute_itemが存在しない: ${p.substitute_item}`);
      else if (!sub.implemented_in_pokechan) errs.push(`substitute_itemが未実装: ${p.substitute_item}`);
    }
  } else {
    if (item && !item.implemented_in_pokechan) errs.push(`持ち物が未実装なのにitem_pending=false: ${p.item}`);
    if (p.substitute_item) errs.push(`item_pending=falseなのにsubstitute_itemが設定されている: ${p.substitute_item}`);
  }

  // mega item <-> mega species consistency (メガ種は必ずitem自体が対応するメガストーン・実装済であること)
  const isMegaSpecies = p.species.startsWith('メガ');
  if (isMegaSpecies) {
    if (p.item_pending) errs.push('メガ種なのにitem_pending=true(メガストーンは常に実装済のはず)');
    if (item && item.category !== 'mega_stone') {
      errs.push(`メガ種なのに持ち物がメガストーンでない: ${p.item}`);
    }
    if (item && item.category === 'mega_stone' && item.mega_form && item.mega_form !== p.species) {
      errs.push(`メガストーンの対応先(${item.mega_form})とspeciesが不一致: ${p.species}`);
    }
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
  console.log('全プリセット、技実在・learners一致・特性一致・性格一致・持ち物実装(またはitem_pending+substitute_item)・EV上限とも問題なし');
}
