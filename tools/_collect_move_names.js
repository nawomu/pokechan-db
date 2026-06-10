/* 技名 日本語→英語マッピング収集(一回もの・SSOTは読むだけ)
 * 出典: PokéAPI 公式CSV (https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/move_names.csv)
 *   local_language_id: 1=ja-hrkt(かな=うちのWAZA_MAPの表記) / 9=en
 * WAZA_MAP の全490技を対応づけ、review/_move_names_ja_en.json に出力。
 * PokéAPIに無い技(Champions固有等)は unmatched として列挙。
 * 実行: node tools/_collect_move_names.js  (事前に /tmp/move_names.csv を curl 済みでも、無ければ取得)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const CSV_URL = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/move_names.csv';

// PokéAPIは全角英数(１０まんボルト/ＤＤラリアット/Ｇのちから/３ぼんのや)、うちは半角 → 半角に正規化して照合
function normalize(s) {
  return String(s).replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

async function main() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error('CSV取得失敗: ' + res.status);
  const csv = await res.text();

  // move_id → {ja, en}
  const byId = {};
  for (const line of csv.split('\n').slice(1)) {
    const m = line.match(/^(\d+),(\d+),(.*)$/);
    if (!m) continue;
    const [, id, lang, name] = m;
    if (!byId[id]) byId[id] = {};
    if (lang === '1') byId[id].ja = normalize(name.trim());
    if (lang === '9') byId[id].en = name.trim();
  }
  const jaToEn = {};
  for (const id of Object.keys(byId)) {
    const { ja, en } = byId[id];
    if (ja && en) jaToEn[ja] = en;
  }
  console.log('PokéAPI収録技(ja-hrkt×en両方あり):', Object.keys(jaToEn).length);

  // WAZA_MAP の490技を対応づけ
  const map = {};
  const unmatched = [];
  for (const [key, mv] of Object.entries(data.WAZA_MAP)) {
    const en = jaToEn[mv.name];
    if (en) map[mv.name] = en;
    else unmatched.push({ key, name: mv.name, category: mv.category, type: mv.type });
  }
  const out = {
    source: 'PokéAPI move_names.csv (lang 1=ja-hrkt → 9=en) ' + CSV_URL,
    note: 'unmatchedはPokéAPI未収録(Champions固有・表記ゆれ等)→必要なら手動追記',
    count: Object.keys(map).length, unmatched_count: unmatched.length,
    map, unmatched,
  };
  const outPath = path.join(ROOT, 'review', '_move_names_ja_en.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log('✅ 対応:', out.count, '/ 490  未対応:', unmatched.length, '→', outPath);
  unmatched.forEach(u => console.log('  ✗', u.name, `(${u.type}/${u.category})`));
}

main().catch(e => { console.error(e); process.exit(1); });
