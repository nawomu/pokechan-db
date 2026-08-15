#!/usr/bin/env node
// _check_ability_champions_meta.js — 特性の champions印 / champions_pokemon_count が
// 自分のデータと権威コーパスに対して整合しているかを機械で検査する。LLM不使用=数え上げと突き合わせのみ。
//
// なぜ要るか: 特性ラウンド1で「champions印・count がおかしい」という指摘が131件出た。
//   1件ずつエージェントに見せると高いが、これは数えれば決まる話なので機械で決着させる。
//   前科あり = コーパス取り直しの時に champions_pokemon_count を落として311件全部が0になった(2026-08-15朝)。
//
// 3つの情報源を突き合わせる:
//   A) master/pokemon.json を自前で数えた実数(champions:true かつ ab1/ab2/ab3 がその特性)
//   B) master/abilities.json の champions / champions_pokemon_count
//   C) 権威コーパス reference/_authority_corpus_ch/abilities_ch.json に本文があるか(=Championsに在る)
//
// 出力: reference/_ability_champions_meta_check.json + 標準出力にサマリ
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const abilities = J('master/abilities.json').items;
const pokemon = J('master/pokemon.json').items || J('master/pokemon.json');

// A) 実数を数える。★メガは別個体として持っている行があるので、行そのものを素直に数える
//    (「メガ済み混入」は持ち物側で踏んだ罠なので、ここでは内訳も出して人が見て判断できるようにする)
const actual = {};   // name -> [ポケモン名...]
for (const p of pokemon) {
  if (!p.champions) continue;
  for (const k of ['ab1', 'ab2', 'ab3']) {
    const ab = p[k];
    if (!ab) continue;
    (actual[ab] = actual[ab] || []).push(p.display_name || p.name);
  }
}

// C) 権威コーパスに本文があるか
const chHas = {};
for (const a of (J('reference/_authority_corpus_ch/abilities_ch.json').abilities || [])) {
  const body = (a.effect || a.effect_ja || '').trim();
  chHas[a.name] = body.length > 0;
}

const rows = [];
for (const a of abilities) {
  const owners = actual[a.name] || [];
  const countActual = owners.length;
  const countStored = a.champions_pokemon_count;
  const inCorpus = !!chHas[a.name];

  const problems = [];
  if (countActual !== countStored) {
    problems.push(`count不一致: 格納=${countStored} / うちのポケモンデータの実数=${countActual}`);
  }
  // champions印は「Championsにこの特性が存在するか」。持っているポケモンが1体でも居れば true が筋
  if (countActual > 0 && !a.champions) {
    problems.push(`champions印がfalseだが、Championsのポケモンが${countActual}体この特性を持っている`);
  }
  if (countActual === 0 && a.champions) {
    problems.push('champions印がtrueだが、Championsのポケモンで誰もこの特性を持っていない');
  }
  // 権威コーパスとの食い違いは「印の根拠」を疑う材料。断定はしない(コーパスは全310件を機械取得したもので、
  // Championsに無い特性のページも存在しうるため)
  if (inCorpus !== a.champions) {
    problems.push(`参考: 権威コーパスの本文${inCorpus ? 'あり' : 'なし'} ⇔ champions印=${a.champions}`);
  }

  if (problems.length) {
    rows.push({
      name: a.name,
      champions_stored: a.champions,
      count_stored: countStored,
      count_actual: countActual,
      corpus_has_body: inCorpus,
      owners: owners.slice(0, 12),
      problems,
    });
  }
}

// 分類
const countMismatch = rows.filter(r => r.count_actual !== r.count_stored);
const flagFalseButOwners = rows.filter(r => r.count_actual > 0 && !r.champions_stored);
const flagTrueNoOwners = rows.filter(r => r.count_actual === 0 && r.champions_stored);
const onlyCorpusDiff = rows.filter(r => r.problems.every(p => p.startsWith('参考:')));

const out = {
  what: '特性の champions印 / champions_pokemon_count の整合検査(LLM不使用)',
  generated_at: new Date().toISOString().slice(0, 10),
  totals: {
    abilities: abilities.length,
    rows_with_problems: rows.length,
    count_mismatch: countMismatch.length,
    flag_false_but_has_owners: flagFalseButOwners.length,
    flag_true_but_no_owners: flagTrueNoOwners.length,
    only_corpus_difference: onlyCorpusDiff.length,
  },
  note: '★count は master/pokemon.json(champions:true の行の ab1/ab2/ab3)を自前で数えた実数。' +
        '外部の値を写すのをやめて自前で数える方針(2026-08-15朝に count退行バグを踏んだ後の決定)に従っている。' +
        '「参考:」で始まる問題は権威コーパスとの差で、Championsに無い特性のページも存在しうるため単独では誤りの証拠にならない。',
  rows,
};
fs.writeFileSync(path.join(ROOT, 'reference/_ability_champions_meta_check.json'), JSON.stringify(out, null, 2));

console.log('=== 特性 champions メタ情報 整合検査 ===');
console.log(`特性 ${abilities.length}件 / 問題あり ${rows.length}件`);
console.log(`  count不一致                 : ${countMismatch.length}`);
console.log(`  印false なのに所持者が居る  : ${flagFalseButOwners.length}`);
console.log(`  印true なのに所持者が居ない : ${flagTrueNoOwners.length}`);
console.log(`  権威コーパスとの差のみ(参考): ${onlyCorpusDiff.length}`);
console.log('→ reference/_ability_champions_meta_check.json');
