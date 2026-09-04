'use strict';
// 「凍結された表示順」(reference/_legacy_order.json)を使って行を並べる共有アルゴリズム(2026-09-04 一本化)。
//
// 背景: 同じNo.のフォーム(通常/メガ等)のタイブレーク順は、master配列そのものの並び(メガが先)と
// 旧ページの表示順(通常が先)で食い違う。これを解決していた式(sortByLegacyOrder。旧
// tools/build_views.js 内にだけ実装があった)を1本に切り出し、
//   ① build_views.js(生成物 pokechan_data*.js の行順・変更なし)
//   ② tools/build_master_v2.js(master/pokemon.json の各行に display_order/champions_display_order
//      を焼き込む。pokedb.js経由ページ<例: pokemon_db.html>が reference/*.json を直接読まずに
//      同じタイブレークを再現できるようにするため)
// の両方が呼ぶ。CLAUDE.md「データは一つ。SSOTはmaster/*.jsonだけ」に合わせ、ページはこの結果を
// masterのフィールドから読むだけにする(reference/*.jsonへの依存はbuilder側だけに残す)。
//
// 使い方: const { buildOrderIndex, buildAliasCandidates, orderKeyFor, sortByLegacyOrder } = require('./_lib/legacy_order');

/** 凍結順の名前配列 → {名前: 出現位置(最初の1回だけ)} の索引 */
function buildOrderIndex(names) {
  const idx = new Map();
  (names || []).forEach((n, i) => { if (!idx.has(n)) idx.set(n, i); });
  return idx;
}

/** reference/_name_normalize.json の行配列(entity列を含む) → {official_name: [legacy時代の名前候補,...]}
 *  entity で対象(例: 'pokemon')を絞る。champions_name_was / display_name の順に候補を積む。 */
function buildAliasCandidates(nameNormalizeRows, entity) {
  const aliasCandidates = {};
  (nameNormalizeRows || []).filter(r => r.entity === entity).forEach(r => {
    if (!r.official_name) return;
    const arr = aliasCandidates[r.official_name] || (aliasCandidates[r.official_name] = []);
    if (r.champions_name_was) arr.push(r.champions_name_was);
    if (r.display_name) arr.push(r.display_name);
  });
  return aliasCandidates;
}

/** 名前1件の凍結順キーを引く。直接一致しなければ aliasCandidates で逆引き。見つからなければ null */
function orderKeyFor(name, idx, aliasCandidates) {
  if (idx.has(name)) return idx.get(name);
  const alts = (aliasCandidates && aliasCandidates[name]) || [];
  for (const a of alts) if (idx.has(a)) return idx.get(a);
  return null;
}

/** rows(各要素は最低限 name/no/mega を持つ)を frozenNames(凍結順の名前配列)で並べ替える。
 *  ①凍結順にある名前はその位置 ②直接一致しない名前は aliasCandidates で逆引き ③それでも
 *  見つからない名前(=master限定の新規行)は末尾に追加(非メガを先・メガを後ろ、各グループ内は
 *  no昇順→name(ja)昇順)。戻り値: { rows: 並べ替え後の配列(同じ要素の参照), unmatchedCount, unmatchedNames } */
function sortByLegacyOrder(rows, frozenNames, aliasCandidates) {
  const idx = buildOrderIndex(frozenNames);
  const matched = [], unmatched = [];
  rows.forEach(r => {
    const k = orderKeyFor(r.name, idx, aliasCandidates);
    if (k == null) unmatched.push(r); else matched.push([k, r]);
  });
  matched.sort((a, b) => a[0] - b[0]);
  const cmp = (a, b) => (Number(a.no) - Number(b.no)) || String(a.name).localeCompare(String(b.name), 'ja');
  const nonMega = unmatched.filter(r => !r.mega).sort(cmp);
  const mega = unmatched.filter(r => r.mega).sort(cmp);
  return { rows: matched.map(x => x[1]).concat(nonMega, mega), unmatchedCount: unmatched.length, unmatchedNames: unmatched.map(r => r.name) };
}

module.exports = { buildOrderIndex, buildAliasCandidates, orderKeyFor, sortByLegacyOrder };
