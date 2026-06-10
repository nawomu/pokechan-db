/* SSOT(pokechan_data.js)修正スクリプト — 2026-06-10 阿部さん承認(「直してOK」)
 *
 * 修正内容(3系統・全て権威ソース確認済み):
 *  ①タイプ誤り25件: Champions計算機(vgc-champions-calc)とBulbapediaが一致して
 *    SSOTだけ違う → type1/type2 を修正し、resist[18]/cnt系8フィールドを再計算
 *  ②メガニウム baseエントリ破損: form="メガ進化"/mega=true/weight_kg=201 と
 *    メガの値が混入(別に正しいメガメガニウムentryが存在) → 通常/false/100.5(PokéAPI/Bulbapedia)
 *  ③フェアリー22匹の resist 誤り: 「ほのお→フェアリー」が0.5で保存されていた。
 *    正=1(等倍)。Champions計算機バンドルの相性表 fire:{...,fairy:1} と本家(Bulbapedia)が一致
 *    → タイプはそのまま、resist/cnt のみ再計算
 *
 * 触らないもの(うちが正しい or 未決着):
 *  - パンプジン3サイズの種族値/体重(計算機側が1サイズしか持たない)
 *  - イダイトウ♀の種族値(計算機側が♂の値を使っている)
 *  - メガジジーロン体重240.5 / イッカネズミ体重2.8(未決着=保留)
 *
 * 実行: node tools/_fix_ssot_types.js        … dry-run(差分一覧の表示のみ)
 *       node tools/_fix_ssot_types.js --write … 実際に書き込む
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const data = require(path.join(ROOT, 'pokechan_data.js'));
const { buildEngine } = require('./_sim_engine.js');
const E = buildEngine();
if (typeof E.moveTypeEff !== 'function') throw new Error('moveTypeEff がエンジンから取れない');

const WRITE = process.argv.includes('--write');

// ①タイプ修正25件: name → [type1, type2]("":単タイプ)
// 出典: review/_champs_data_crosscheck.json (Champions計算機) + Bulbapedia
const TYPE_FIXES = {
  'メガデンリュウ': ['でんき', 'ドラゴン'],
  'メガボスゴドラ': ['はがね', ''],
  'バクーダ': ['ほのお', 'じめん'],
  'メガバクーダ': ['ほのお', 'じめん'],
  'メガミミロップ': ['ノーマル', 'かくとう'],
  'ミカルゲ': ['ゴースト', 'あく'],
  'ダイケンキ(ヒスイ)': ['みず', 'あく'],
  'メガタブンネ': ['ノーマル', 'フェアリー'],
  'マッギョ(ガラル)': ['じめん', 'はがね'],
  'ゲッコウガ': ['みず', 'あく'],
  'エレザード': ['でんき', 'ノーマル'],
  'ケケンカニ': ['かくとう', 'こおり'],
  'ルガルガン(まよなか)': ['いわ', ''],
  'ルガルガン(たそがれ)': ['いわ', ''],
  'ヤレユータン': ['ノーマル', 'エスパー'],
  'アップリュー': ['くさ', 'ドラゴン'],
  'タルップル': ['くさ', 'ドラゴン'],
  'バリコオル': ['こおり', 'エスパー'],
  'デスバーン': ['じめん', 'ゴースト'],
  'バサギリ': ['むし', 'いわ'],
  'イダイトウ♂': ['みず', 'ゴースト'],
  'イダイトウ♀': ['みず', 'ゴースト'],
  'オオニューラ': ['かくとう', 'どく'],
  'ミミズズ': ['はがね', ''],
  'カミツオロチ': ['くさ', 'ドラゴン'],
};

// resist→cnt系の再計算(既存フィールドの定義どおり)
function calcResist(t1, t2) {
  return data.TYPES.map(t => E.moveTypeEff(t, [t1, t2].filter(Boolean)));
}
function calcCnt(resist) {
  const c = (v) => resist.filter(x => x === v).length;
  const cnt4 = c(4), cnt2 = c(2), cnt1 = c(1), cnthf = c(0.5), cntqf = c(0.25), cnt0 = c(0);
  return { cnt4, cnt2, cnt1, cnthf, cntqf, cnt0, cnt42: cnt4 + cnt2, cnthfqf: cnthf + cntqf };
}

let txt = fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8');
const summary = [];
let edits = 0;

// エントリ単位の置換ヘルパー: name で一意に特定し、次エントリ("no":)の手前までを対象にする
function patchEntry(name, fn) {
  const key = `"name":"${name}"`;
  const first = txt.indexOf(key);
  if (first < 0) throw new Error(`エントリが見つからない: ${name}`);
  if (txt.indexOf(key, first + 1) >= 0) throw new Error(`名前が一意でない: ${name}`);
  let end = txt.indexOf('"no":', first);          // 次エントリの先頭
  if (end < 0) end = txt.length;
  const seg = txt.slice(first, end);
  const newSeg = fn(seg);
  if (newSeg !== seg) { txt = txt.slice(0, first) + newSeg + txt.slice(end); edits++; }
}
function replaceOnce(seg, from, to, label, name) {
  // from: 文字列 or RegExp(非グローバル)。生テキストに 1.0 等の非正規数値表記が混在するためregex対応
  if (from instanceof RegExp) {
    const m = seg.match(from);
    if (!m) throw new Error(`${name}: 置換対象が見つからない(${label}): ${from}`);
    if (seg.slice(m.index + m[0].length).match(from)) throw new Error(`${name}: 置換対象が複数(${label})`);
    return seg.slice(0, m.index) + to + seg.slice(m.index + m[0].length);
  }
  const i = seg.indexOf(from);
  if (i < 0) throw new Error(`${name}: 置換対象が見つからない(${label}): ${from.slice(0, 60)}`);
  if (seg.indexOf(from, i + 1) >= 0) throw new Error(`${name}: 置換対象が複数(${label})`);
  return seg.slice(0, i) + to + seg.slice(i + from.length);
}

// === 対象を組み立てる: ①タイプ修正 + ③resist再計算が必要な全匹(=フェアリー22匹を含む) ===
for (const p of data.POKEMON_LIST) {
  const fix = TYPE_FIXES[p.name];
  const newT1 = fix ? fix[0] : p.type1;
  const newT2 = fix ? fix[1] : (p.type2 || '');
  const newResist = calcResist(newT1, newT2);
  const resistChanged = JSON.stringify(newResist) !== JSON.stringify(p.resist);
  if (!fix && !resistChanged) continue;

  const newCnt = calcCnt(newResist);
  const oldTypes = [p.type1, p.type2].filter(Boolean).join('/');
  const newTypes = [newT1, newT2].filter(Boolean).join('/');
  const cntChanges = Object.entries(newCnt).filter(([k, v]) => p[k] !== v)
    .map(([k, v]) => `${k}:${p[k]}→${v}`).join(' ');
  summary.push({
    name: p.name,
    kind: fix ? 'タイプ修正' : 'resist再計算',
    types: fix ? `${oldTypes} → ${newTypes}` : `${oldTypes}(変更なし)`,
    resist: resistChanged ? data.TYPES.filter((t, i) => newResist[i] !== p.resist[i])
      .map((t) => `${t}:${p.resist[data.TYPES.indexOf(t)]}→${newResist[data.TYPES.indexOf(t)]}`).join(' ') : '(変更なし)',
    cnt: cntChanges || '(変更なし)',
  });

  patchEntry(p.name, (seg) => {
    if (fix) {
      seg = replaceOnce(seg,
        `"type1":"${p.type1}","type2":"${p.type2 || ''}"`,
        `"type1":"${newT1}","type2":"${newT2}"`, 'type', p.name);
    }
    seg = replaceOnce(seg, /"resist":\[[^\]]*\]/,
      `"resist":${JSON.stringify(newResist)}`, 'resist', p.name);
    const newCntStr = `"cnt4":${newCnt.cnt4},"cnt2":${newCnt.cnt2},"cnt1":${newCnt.cnt1},"cnthf":${newCnt.cnthf},"cntqf":${newCnt.cntqf},"cnt0":${newCnt.cnt0},"cnt42":${newCnt.cnt42},"cnthfqf":${newCnt.cnthfqf}`;
    seg = replaceOnce(seg, /"cnt4":[\d.]+,"cnt2":[\d.]+,"cnt1":[\d.]+,"cnthf":[\d.]+,"cntqf":[\d.]+,"cnt0":[\d.]+,"cnt42":[\d.]+,"cnthfqf":[\d.]+/,
      newCntStr, 'cnt', p.name);
    return seg;
  });
}

// === ②メガニウム baseエントリ破損(メガの値が混入) ===
patchEntry('メガニウム', (seg) => {
  seg = replaceOnce(seg, '"weight_kg":201,"form":"メガ進化","mega":true',
    '"weight_kg":100.5,"form":"通常","mega":false', 'メガ混入', 'メガニウム');
  return seg;
});
summary.push({ name: 'メガニウム', kind: 'baseエントリ破損修正', types: 'くさ(変更なし)',
  resist: '(変更なし)', cnt: 'weight 201→100.5 / form メガ進化→通常 / mega true→false' });

// === 出力 ===
console.log(`=== SSOT修正 ${WRITE ? '(書き込み)' : '(dry-run: --write で実行)'} — ${summary.length}件 ===`);
for (const s of summary) {
  console.log(`\n■ ${s.name} [${s.kind}]`);
  console.log(`  タイプ: ${s.types}`);
  if (s.resist !== '(変更なし)') console.log(`  resist: ${s.resist}`);
  console.log(`  その他: ${s.cnt}`);
}
if (WRITE) {
  fs.writeFileSync(path.join(ROOT, 'pokechan_data.js'), txt);
  console.log(`\n✅ pokechan_data.js に書き込み完了(${edits}エントリ)`);
} else {
  console.log(`\n(dry-run: ${edits}エントリが変更対象。--write で書き込み)`);
}
