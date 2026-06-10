/* 体重データ収集(一回もの・SSOTは読むだけ・書かない)
 * POKEMON_LIST の275件それぞれを PokéAPI(ゲーム実データ由来)の該当フォームに対応づけ、
 * 体重(kg)を取得して review/_weights_collected.json に出力する。
 * PokéAPIに無いもの(Z-A/Champions世代の新メガ等)は unresolved として列挙→別途権威ソースで裏取り。
 * 実行: node tools/_collect_weights.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const API = 'https://pokeapi.co/api/v2';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch (e) { /* retry */ }
    await sleep(500 * (i + 1));
  }
  return null;
}

// SSOTの name/form/mega → PokéAPI variety 名の対応ルール
function pickVariety(entry, species) {
  const vs = species.varieties.map(v => v.pokemon.name);
  const def = species.varieties.find(v => v.is_default);
  const defName = def ? def.pokemon.name : vs[0];
  const has = s => vs.find(v => v === s) || null;
  const n = entry.name;

  if (entry.mega) {
    // メガリザードンX/Y のような X/Y 付き
    if (/X$/.test(n) && has(defName + '-mega-x')) return defName + '-mega-x';
    if (/Y$/.test(n) && has(defName + '-mega-y')) return defName + '-mega-y';
    // ニャオニクス等: defaultが性別フォーム名でも種族名+"-mega"が存在する
    return has(defName + '-mega') || has(species.name + '-mega'); // 無ければ null=unresolved(新メガ)
  }
  if (entry.form === 'リージョン') {
    if (n.includes('アローラ')) return has(defName + '-alola');
    if (n.includes('ガラル')) return has(defName + '-galar');
    if (n.includes('ヒスイ')) return has(defName + '-hisui');
    if (n.includes('パルデア単')) return has(defName + '-paldea-combat-breed');
    if (n.includes('パルデア炎')) return has(defName + '-paldea-blaze-breed');
    if (n.includes('パルデア水')) return has(defName + '-paldea-aqua-breed');
    return null;
  }
  // 通常フォームのうち特殊なもの
  const SPECIAL = {
    'ヒートロトム': 'rotom-heat', 'ウォッシュロトム': 'rotom-wash', 'フロストロトム': 'rotom-frost',
    'スピンロトム': 'rotom-fan', 'カットロトム': 'rotom-mow',
    'ギルガルド(シールド)': 'aegislash-shield', 'ギルガルド(ブレード)': 'aegislash-blade',
    'パンプジン(普通)': 'gourgeist-average', 'パンプジン(小)': 'gourgeist-small',
    'パンプジン(大)': 'gourgeist-large', 'パンプジン(特大)': 'gourgeist-super',
    'ルガルガン(まひる)': 'lycanroc-midday', 'ルガルガン(まよなか)': 'lycanroc-midnight',
    'ルガルガン(たそがれ)': 'lycanroc-dusk',
    'イルカマン(ナイーブ)': 'palafin-zero', 'イルカマン(マイティ)': 'palafin-hero',
    'フラエッテ(えいえん)': 'floette-eternal',
    'ニャオニクス♂': 'meowstic-male', 'ニャオニクス♀': 'meowstic-female',
    'イダイトウ♂': 'basculegion-male', 'イダイトウ♀': 'basculegion-female',
  };
  if (SPECIAL[n]) return has(SPECIAL[n]) || SPECIAL[n];
  return defName;
}

async function main() {
  const L = data.POKEMON_LIST;
  const nos = [...new Set(L.map(p => parseInt(p.no, 10)))];
  console.log('対象:', L.length, '件 / 種族:', nos.length);

  // 1) 種族ごとに species を取得(日本語名の照合 + varieties)
  const species = {};
  let done = 0;
  for (const no of nos) {
    species[no] = await getJson(`${API}/pokemon-species/${no}`);
    if (++done % 40 === 0) console.log('  species', done + '/' + nos.length);
    await sleep(60);
  }

  // 2) 各エントリ → variety 決定
  const wanted = new Map(); // varietyName -> [entries]
  const unresolved = [];
  for (const p of L) {
    const sp = species[parseInt(p.no, 10)];
    if (!sp) { unresolved.push({ no: p.no, name: p.name, reason: 'species取得失敗' }); continue; }
    const jaName = (sp.names.find(x => x.language.name === 'ja') || {}).name || '';
    const v = pickVariety(p, sp);
    if (!v) { unresolved.push({ no: p.no, name: p.name, form: p.form, mega: p.mega, ja: jaName, reason: 'PokéAPIに該当フォーム無し(新メガ等)' }); continue; }
    if (!wanted.has(v)) wanted.set(v, []);
    wanted.get(v).push({ entry: p, jaName });
  }

  // 3) variety ごとに体重取得(hectogram → kg)
  const out = [];
  done = 0;
  for (const [v, entries] of wanted) {
    const pk = await getJson(`${API}/pokemon/${v}`);
    for (const { entry, jaName } of entries) {
      if (!pk || pk.weight == null) {
        unresolved.push({ no: entry.no, name: entry.name, form: entry.form, mega: entry.mega, reason: `pokemon/${v} 取得失敗` });
      } else {
        out.push({
          no: entry.no, name: entry.name, form: entry.form, mega: entry.mega,
          weight_kg: pk.weight / 10, api: v, species_ja: jaName,
        });
      }
    }
    if (++done % 40 === 0) console.log('  pokemon', done + '/' + wanted.size);
    await sleep(60);
  }

  out.sort((a, b) => a.no.localeCompare(b.no) || a.name.localeCompare(b.name));
  const result = {
    source: 'PokéAPI v2 (ゲーム実データ由来) https://pokeapi.co',
    note: '体重はkg。unresolvedはPokéAPI未収録(Z-A/Champions世代の新メガ等)→権威ソースで別途裏取りが必要',
    count: out.length, unresolved_count: unresolved.length,
    weights: out, unresolved,
  };
  const outPath = path.join(ROOT, 'review', '_weights_collected.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 1));
  console.log('✅ 取得:', out.length, '/ 未解決:', unresolved.length, '→', outPath);
  unresolved.forEach(u => console.log('  ✗', u.no, u.name, '—', u.reason));
}

main().catch(e => { console.error(e); process.exit(1); });
