// tools/_build_sprite_api_ids.js
//
// GLM タスク S1: SPRITE_API_ID 全形態ビルダー
// reference/pokeapi_master.json(1302件・正)から ja表示名→PokeAPI id のインデックスを構築し、
// DB(POKEMON_LIST)の全 name と join して sprite_api_ids.js の未収載フォルム系を補完再生成する。
//   目的: 現状 ~278件しかなく、全部版(1219名)のフォルム系(ギラティナ/ジガルデ/コライドン/
//         シャリタツ/ミライドン 等)が未収載→3D(HOME)画像モードで空白になる、を解消する。
//
// 【運用】このファイルは「書くだけ」(GLM worktreeはnode実行不可・サンドボックスで失敗する)。
//         実行・検証は親(メインrepo)が行う:
//           node tools/_build_sprite_api_ids.js            # 上書き
//           node tools/_build_sprite_api_ids.js --dry-run  # 書き込まずレポートのみ
//
// 【禁止】実在しない id のでっち上げ(join不成立は必ず unresolved へ) /
//         既存エントリの削除・変更(1件も消さない・値も変えない) /
//         sprite_api_ids.js 以外の出力先。

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MASTER = path.join(ROOT, 'reference', 'pokeapi_master.json');
const DB_FILES = [
  path.join(ROOT, 'pokechan_data_all.js'),
  path.join(ROOT, 'pokechan_data.js'),
];
const OUT = path.join(ROOT, 'sprite_api_ids.js');

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// 既存 SPRITE_API_ID を読む(1件も消さない・値も変えない)。
// 現行ファイルは ヘッダ2行 + `const SPRITE_API_ID = {1行JSON};` 形式。
// ---------------------------------------------------------------------------
function loadExisting(file) {
  const src = fs.readFileSync(file, 'utf8');
  // 1行JSON(値は数値のみ=ネスト `}` 無し)を非貪欲で抜く。末尾 `};` で終わる。
  const m = src.match(/const\s+SPRITE_API_ID\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) throw new Error('SPRITE_API_ID が見つかりません: ' + file);
  return JSON.parse(m[1]);
}

function loadMaster(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// DB(POKEMON_LIST)の name を読む。
// 【罠】vm で const はコンテキストに載らない → 完了値で受ける。
function loadDbNames(file) {
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return []; // 片方存在しない場合は無視(ユニオンなので空でOK)
  }
  const ctx = vm.createContext({});
  const list = vm.runInContext(src + ';POKEMON_LIST', ctx);
  return Array.isArray(list) ? list.map(x => x && x.name).filter(Boolean) : [];
}

// ---------------------------------------------------------------------------
// フォームラベル → 合成名用バリアント(仕様 b/c)。
//   a. 「種名(ラベルそのまま)」は呼び出し元で登録済み。ここではラベル側バリアントを返す。
//   b. 「〇〇のすがた」→ 地方名のみ(アローラ/ガラル/ヒスイ/パルデア)。
//      入れ子「<地方>のすがた(◯◯)」→ 内側ラベルで「<地方>◯◯」と「◯◯」の両方。
//   c. 末尾「のすがた」を落とした版(残す版は a と同一)。
// ---------------------------------------------------------------------------
function labelVariants(label) {
  const out = new Set();

  // c. 末尾の「のすがた」を落とす
  const stripped = label.replace(/のすがた$/, '');
  if (stripped !== label) out.add(stripped);

  // b. 地方単独(アローラのすがた → アローラ)
  const REGIONS = ['アローラ', 'ガラル', 'ヒスイ', 'パルデア'];
  for (const r of REGIONS) {
    if (label === r + 'のすがた') out.add(r);
  }

  // b入れ子. 「<地方>のすがた(◯◯)」→「<地方>◯◯」と「◯◯」
  //   全角/半角カッコ両方を受ける。
  const nest = label.match(/^([^（(]+)のすがた[（(]([^）)]+)[）)]$/);
  if (nest) {
    const region = nest[1];
    const inner = nest[2];
    out.add(region + inner);
    out.add(inner);
  }
  return out;
}

// ---------------------------------------------------------------------------
// pokeapi_master から ja表示名→id インデックスを構築。
// 各エントリが登録する名前(仕様1):
//   - species_names.ja  (is_default のときのみ)
//   - full_names.ja     (あればそのまま)
//   - form_names.ja があれば合成名バリアント全部(a/b/c)
// 同名衝突時は先勝ち(既に登録済みの名前は上書きしない)。
// ---------------------------------------------------------------------------
function buildIndex(master) {
  const idx = new Map();
  const add = (name, id) => {
    if (name == null) return;
    name = String(name).trim();
    if (!name) return;
    if (!idx.has(name)) idx.set(name, id);
    // 全角英数字バリアント(PokeAPI「メガミュウツーＸ」⇔ DB「メガミュウツーX」)
    const nfkc = name.normalize('NFKC');
    if (nfkc !== name && !idx.has(nfkc)) idx.set(nfkc, id);
  };

  for (const e of master) {
    const sp = e && e.species_names && e.species_names.ja;
    const fm = e && e.form_names && e.form_names.ja;
    const fn = e && e.full_names && e.full_names.ja;

    if (e.is_default && sp) add(sp, e.id);   // 種名は基本種のみ
    if (fn) add(fn, e.id);                   // 完全名があればそのまま
    if (fm && sp) {
      add(fm, e.id);                         // d. ラベル単体(メガ系はform名=完全名: メガボーマンダ等)
      add(sp + '(' + fm + ')', e.id);        // a. ラベルそのまま
      for (const v of labelVariants(fm)) {
        add(sp + '(' + v + ')', e.id);       // b/c. バリアント
      }
    }
  }
  return idx;
}

// ---------------------------------------------------------------------------
// 追加解決パス(2026-07-21 パッチ): インデックス不成立の名前を slug ベースで解決。
//   e. 〈slug〉注釈名: ジガルデ(１０％フォルム)〈zygarde-10〉 → slug 直引き。
//   f. slug断片パーレン: ヒヒダルマ(ガラル・standard) → galar-standard を
//      form_slug / slug末尾 と照合(地方語 ja→en マップ + ascii断片)。
//   g. 純ascii断片で form 不成立: ガーメイル(plant)/コフーライ(icy-snow) など
//      PokeAPIに独立idが無い見た目違い → 基本種idで代用(c-NNN→ベース種代用の既存前例と同方針)。
// ---------------------------------------------------------------------------
const REGION_EN = { 'アローラ': 'alola', 'ガラル': 'galar', 'ヒスイ': 'hisui', 'パルデア': 'paldea' };
function resolveBySlug(name, master, bySlug, defaultBySpecies) {
  // e. 〈slug〉直引き
  const sm = name.match(/〈([a-z0-9-]+)〉/);
  if (sm && bySlug.has(sm[1])) return { id: bySlug.get(sm[1]).id, how: 'slug' };

  const pm = name.match(/^(.+?)[（(]([^（()）]+)[）)]/);
  if (!pm) return null;
  const base = pm[1], label = pm[2];

  // f. 断片トークン(・区切り)→ en slug断片
  const toks = label.split('・').map(t => t.trim()).filter(Boolean);
  const enToks = [];
  let allMapped = toks.length > 0;
  for (const t of toks) {
    if (REGION_EN[t]) enToks.push(REGION_EN[t]);
    else if (/^[a-z0-9-]+$/i.test(t)) enToks.push(t.toLowerCase());
    else { allMapped = false; break; }
  }
  if (allMapped) {
    const frag = enToks.join('-');
    const hit = master.find(e => e.species_names && e.species_names.ja === base &&
      (e.form_slug === frag || (e.slug && e.slug.endsWith('-' + frag))));
    if (hit) return { id: hit.id, how: 'frag' };
    // g. 純asciiのみ(地方語を含まない)で不成立 → 基本種代用
    if (toks.every(t => /^[a-z0-9-]+$/i.test(t)) && defaultBySpecies.has(base)) {
      return { id: defaultBySpecies.get(base), how: 'base-substitute' };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
function main() {
  const existing = loadExisting(OUT);
  const existingOrder = Object.keys(existing); // 挿入順維持(JSオブジェクトは文字列キー挿入順を保持)
  const existingSet = new Set(existingOrder);

  const master = loadMaster(MASTER);
  const idx = buildIndex(master);

  // DB名の全集合 = 両DBの POKEMON_LIST の name のユニオン
  const dbNames = new Set();
  for (const p of DB_FILES) {
    for (const n of loadDbNames(p)) dbNames.add(n);
  }

  // 各DB名について: 既存にあればそのまま(値も既存優先)。
  //                 無ければインデックスを引き、ヒットすれば追加・しなければ unresolved。
  const bySlug = new Map(master.map(e => [e.slug, e]));
  const defaultBySpecies = new Map();
  for (const e of master) {
    const sp = e && e.species_names && e.species_names.ja;
    if (e.is_default && sp && !defaultBySpecies.has(sp)) defaultBySpecies.set(sp, e.id);
  }

  const added = {};
  const unresolved = [];
  const baseSubstituted = [];
  for (const name of [...dbNames].sort((a, b) => a.localeCompare(b, 'ja'))) {
    if (existingSet.has(name)) continue;
    if (idx.has(name)) {
      added[name] = idx.get(name);
      continue;
    }
    const r = resolveBySlug(name, master, bySlug, defaultBySpecies);
    if (r) {
      added[name] = r.id;
      if (r.how === 'base-substitute') baseSubstituted.push(name);
    } else {
      unresolved.push(name); // join不成立=でっち上げず unresolved(Champions独自・自作メガは正常)
    }
  }

  // 出力オブジェクト: 既存(元の順) → 新規(ja名ソート)。diff 最小化。
  const result = {};
  for (const k of existingOrder) result[k] = existing[k];
  for (const k of Object.keys(added)) result[k] = added[k];

  // フォーマット現行踏襲: ヘッダ2行(由来コメントを日付2026-07-21で更新) + `const SPRITE_API_ID = {1行JSON};`
  const header = [
    '// 自動生成(tools/_build_sprite_api_ids.js: reference/pokeapi_master.json(1302件)から全フォルムをjoin補完。2026-07-21)',
    '// キャラ画像=公式風スプライト(PokeAPI)モードで使用。無い名前=Champions独自/自作メガ等(join不成立=未収載、自作SVG継続)',
  ].join('\n');
  const body = 'const SPRITE_API_ID = ' + JSON.stringify(result) + ';';
  // ★HOME絵の右向き例外(2026-07-21 阿部さん報告→全278体を目視分類・生PNG二重確認済み)。
  //   ほぼ全HOME絵は左向き=自分側だけCSSでscaleX(-1)反転する設計だが、この6体は素材が右向き
  //   → ページ側で .fr クラスを付け「自分=無反転/相手=反転」に逆転させ向き合わせる。
  //   追加報告があればここにidを足して再生成(判定は生PNG目視で二重確認してから)。
  const facesRight = 'const HOME_FACES_RIGHT = new Set([197,257,10050,750,970,981]);';
  const text = header + '\n' + body + '\n' + facesRight + '\n';

  if (!DRY_RUN) {
    fs.writeFileSync(OUT, text, 'utf8');
  }

  // 標準出力レポート
  const addedCount = Object.keys(added).length;
  console.log('[build_sprite_api_ids] added: ' + addedCount + '件');
  console.log('[build_sprite_api_ids] unresolved: ' + unresolved.length + '件 (Champions独自・自作メガ等は正常=ID未割当)');
  if (unresolved.length) console.log('  ' + unresolved.join(', '));
  if (baseSubstituted.length) console.log('[build_sprite_api_ids] base-substitute(独立id無し→基本種代用): ' + baseSubstituted.length + '件: ' + baseSubstituted.join(', '));
  console.log('[build_sprite_api_ids] total: ' + Object.keys(result).length + '件 (existing ' + existingOrder.length + ' + added ' + addedCount + ')');
  console.log(DRY_RUN ? '[build_sprite_api_ids] --dry-run: 書き込まず' : '[build_sprite_api_ids] wrote: ' + OUT);
}

main();
