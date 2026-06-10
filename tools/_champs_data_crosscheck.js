/* SSOT(pokechan_data.js) vs Champions計算機データ の全件照合
 * 参照: review/_champions_calc_data.json (tools/_extract_champs_calc.js で抽出)
 * 照合対象:
 *   技490: タイプ / 分類(物理・特殊・変化) / 威力 / 命中
 *   ポケモン275: タイプ / 種族値6 / 体重
 * 出力: review/_champs_data_crosscheck.json + コンソール要約
 * 注意: どちらが正しいかはこのツールでは決めない(ズレの列挙まで)。決着は権威ソース/阿部さん。
 * 実行: node tools/_champs_data_crosscheck.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const data = require(path.join(ROOT, 'pokechan_data.js'));
const champ = require(path.join(ROOT, 'review', '_champions_calc_data.json'));

const TYPE_EN2JA = {
  normal: 'ノーマル', fire: 'ほのお', water: 'みず', electric: 'でんき', grass: 'くさ', ice: 'こおり',
  fighting: 'かくとう', poison: 'どく', ground: 'じめん', flying: 'ひこう', psychic: 'エスパー', bug: 'むし',
  rock: 'いわ', ghost: 'ゴースト', dragon: 'ドラゴン', dark: 'あく', steel: 'はがね', fairy: 'フェアリー',
};
const CAT_EN2JA = { physical: '物理', special: '特殊', status: '変化' };
const norm = s => String(s).replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

// ===== 技 =====
const champMoves = {};
champ.moves.forEach(m => { champMoves[norm(m.name)] = m; });

const moveDiffs = [], moveUnmatched = [], moveOk = [];
for (const [key, mv] of Object.entries(data.WAZA_MAP)) {
  const cm = champMoves[norm(mv.name)];
  if (!cm) { moveUnmatched.push({ key, name: mv.name }); continue; }
  const d = [];
  if (TYPE_EN2JA[cm.type] !== mv.type) d.push(`type: うち=${mv.type} 計算機=${TYPE_EN2JA[cm.type]}`);
  if (CAT_EN2JA[cm.category] !== mv.category) d.push(`category: うち=${mv.category} 計算機=${CAT_EN2JA[cm.category]}`);
  // 表記正規化: power 0/null/— は同じ「威力なし」。accuracy true/0/null/必中/— は同じ「命中判定なし」
  const ourPower = (mv.power == null || mv.power === '—' || Number(mv.power) === 0) ? 0 : Number(mv.power);
  const champPower = (cm.power == null) ? 0 : cm.power;
  if (champPower !== ourPower) d.push(`power: うち=${ourPower || 'なし'} 計算機=${champPower || 'なし'}`);
  const ourAcc = (mv.accuracy == null || mv.accuracy === '—' || mv.accuracy === '必中' || Number(mv.accuracy) === 0) ? 0 : Number(mv.accuracy);
  const champAcc = (cm.accuracy === true || cm.accuracy == null || cm.accuracy === 0) ? 0 : Number(cm.accuracy);
  if (champAcc !== ourAcc) d.push(`accuracy: うち=${ourAcc || 'なし'} 計算機=${champAcc || 'なし'}`);
  if (d.length) moveDiffs.push({ key, name: mv.name, diffs: d });
  else moveOk.push(mv.name);
}

// ===== ポケモン =====
// 照合キー: ①JA名そのまま ②nameEn(うちのPokéAPI variety名 → "Rotom-Heat"形式に変換)
const champByJa = {}, champByEn = {};
champ.pokemon.forEach(p => {
  const k = norm(p.name).replace(/[ （）]/g, m => ({ '（': '(', '）': ')', ' ': '' }[m]));
  if (!champByJa[k]) champByJa[k] = p;
  if (!champByEn[p.nameEn]) champByEn[p.nameEn] = p;
});
const collected = require(path.join(ROOT, 'review', '_weights_collected.json'));
const apiByKey = {};
collected.weights.forEach(w => { apiByKey[w.no + '|' + w.name] = w.api; });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function findChamp(p) {
  const ja = norm(p.name).replace(/[ （）]/g, m => ({ '（': '(', '）': ')', ' ': '' }[m]));
  if (champByJa[ja]) return champByJa[ja];
  const api = apiByKey[p.no + '|' + p.name];
  if (!api) return null;
  const segs = api.split('-');
  // "rotom-heat"→"Rotom-Heat" / 見つからなければ末尾を削って試す("lycanroc-midday"→"Lycanroc")
  for (let n = segs.length; n >= 1; n--) {
    const en = segs.slice(0, n).map(cap).join('-');
    if (champByEn[en]) return champByEn[en];
  }
  return null;
}

const pokeDiffs = [], pokeUnmatched = [], pokeOk = []; let orderOnly = 0;
for (const p of data.POKEMON_LIST) {
  const cp = findChamp(p);
  if (!cp) { pokeUnmatched.push({ no: p.no, name: p.name, form: p.form, mega: p.mega }); continue; }
  const d = [];
  const ourTypes = [p.type1, p.type2].filter(Boolean);
  const champTypes = cp.types.map(t => TYPE_EN2JA[t]);
  // タイプは集合で比較(並び順だけの差は別カウント=実害なし)
  const setEq = ourTypes.length === champTypes.length && ourTypes.every(t => champTypes.includes(t));
  if (!setEq) d.push(`types: うち=${ourTypes.join('/')} 計算機=${champTypes.join('/')}`);
  else if (ourTypes.join('/') !== champTypes.join('/')) orderOnly++;
  for (const k of ['hp', 'atk', 'def', 'spatk', 'spdef', 'spd']) {
    if (p[k] !== cp.baseStats[k]) d.push(`${k}: うち=${p[k]} 計算機=${cp.baseStats[k]}`);
  }
  if (cp.weight != null && p.weight_kg !== cp.weight) d.push(`weight: うち=${p.weight_kg} 計算機=${cp.weight}`);
  if (d.length) pokeDiffs.push({ no: p.no, name: p.name, champ: cp.nameEn, diffs: d });
  else pokeOk.push(p.name);
}

const out = {
  generated: '2026-06-10', source: champ.source,
  moves: { ok: moveOk.length, diff: moveDiffs.length, unmatched: moveUnmatched.length, diffs: moveDiffs, unmatched_list: moveUnmatched },
  pokemon: { ok: pokeOk.length, diff: pokeDiffs.length, unmatched: pokeUnmatched.length, diffs: pokeDiffs, unmatched_list: pokeUnmatched },
};
fs.writeFileSync(path.join(ROOT, 'review', '_champs_data_crosscheck.json'), JSON.stringify(out, null, 1));

console.log('=== 技 (490) ===');
console.log(`  一致: ${moveOk.length} / ズレ: ${moveDiffs.length} / 計算機に無い: ${moveUnmatched.length}`);
moveDiffs.forEach(r => console.log(`  ✗ ${r.name}: ${r.diffs.join(' | ')}`));
if (moveUnmatched.length) console.log('  未対応:', moveUnmatched.map(u => u.name).join(', '));
console.log('=== ポケモン (275) ===');
console.log(`  一致: ${pokeOk.length} / ズレ: ${pokeDiffs.length} / 計算機に無い: ${pokeUnmatched.length} / タイプ並び順のみの差: ${orderOnly}`);
pokeDiffs.forEach(r => console.log(`  ✗ ${r.no} ${r.name}: ${r.diffs.join(' | ')}`));
if (pokeUnmatched.length) console.log('  未対応:', pokeUnmatched.map(u => u.name).join(', '));
console.log('→ 詳細: review/_champs_data_crosscheck.json');
