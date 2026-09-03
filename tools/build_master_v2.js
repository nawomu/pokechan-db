#!/usr/bin/env node
/* tools/build_master_v2.js — ★マスターデータ(master/)の生成器
 *
 * 目的(2026-07-29 阿部さん):「データは一つ。絶対に一つ。」
 *   一本化した大本のデータ =「**マスターデータ**」。置き場所は master/ ただ1つ。
 *
 * ★この生成器は「別で作ってから入れ替える」の“別で作る”側。
 *   **既存ファイルを1バイトも変更しない**。出力は master/ の新規ファイルのみ。
 *
 * 器と中身(設計_データSSOT一本化_2026-07-28.md §9):
 *   - **器(範囲)= 全国版**(1219体 / 919技 / 310特性 / 167持ち物)
 *   - **中身(値)の正典 = Champions**。Championsに在るものはChampions版の値で上書き
 *   - Championsに無いものは最新世代の値を入れ、source に由来を残す
 *
 * 入力(すべて読み取り専用):
 *   reference/_legacy_snapshot/{pokechan_data.js, pokechan_data_all.js, items_database.js}(凍結・2026-09-01 段E)
 *   reference/_authority_corpus_ch/*.json(Champions権威)
 *   reference/_name_normalize.json(名前の正規化)
 *
 * 出力: master/{abilities,items,moves,pokemon,learnsets,regulations}.json
 * 実行: node tools/build_master_v2.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'master');
const NOW = new Date().toISOString().slice(0, 10);
// ★レギュは「現行」と「次」の2枠だけ(2026-09-03 阿部さん決定・R4)。reference/_regulations.json の role から読む(定数を手で切り替えない)。
//   REGULATION = 内容を入れる先(次があれば次・無ければ現行)。champions:true の行はここに入る(累積=前で使えたものは次でも使える)。
//   LIVE_REGS = 行の seasons に残すレギュ(現行+次)。終わったレギュ(M-A等)は seasons から外す(年に何度も増えて溜まる一方になるのを防ぐ。名簿は _official_rosters/ と git に残る)。
const REG_ITEMS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'reference/_regulations.json'), 'utf8')).items || []; } catch (e) { return []; } })();
const REG_CURRENT = (REG_ITEMS.find(r => r.role === 'current') || REG_ITEMS[0] || { id: 'M-C' }).id;
const REG_NEXT = (REG_ITEMS.find(r => r.role === 'next') || {}).id || null;
const REGULATION = REG_NEXT || REG_CURRENT;
const LIVE_REGS = REG_ITEMS.length ? REG_ITEMS.map(r => r.id) : [REGULATION];

// ── 入力 ────────────────────────────────────────────────────────────
// ★2026-09-01 段E: 入力は「凍結スナップショット」(reference/_legacy_snapshot/)。ルート直下の同名ファイルは
//   tools/build_views.js が master/ から生成するビューになったので、それを読むと循環する(生成物→master→生成物)。
const SNAP = path.join(ROOT, 'reference', '_legacy_snapshot');
const C = require(path.join(SNAP, 'pokechan_data.js'));        // Champions版(値の正典・凍結)
const A = require(path.join(SNAP, 'pokechan_data_all.js'));    // 全国版(器・凍結)
global.window = global.window || {};
require(path.join(SNAP, 'items_database.js'));
const ITEMS_DB = global.window.ITEMS_DATABASE;
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const AUTH = {
  abilities: J('reference/_authority_corpus_ch/abilities_ch.json'),
  moves:     J('reference/_authority_corpus_ch/moves_ch.json'),
  lists:     J('reference/_authority_corpus_ch/lists_ch.json'),
  learnsets: J('reference/_authority_corpus_ch/learnsets_ch.json'),
};
// ★段B(計画_マスターからページへ流す_2026-09-01.md): 旧生成物にしか無い資産を master へ運ぶ。
//   ★ここは凍結ファイル(reference/_legacy_*.json)を読む。pokechan_data*.js を直接読まない
//   (段Eで旧生成物入力を切る準備。C/Aは他の既存ロジックでまだ使うので requireは残っている)。
//   凍結の作り方= tools/_freeze_legacy_seasons.js 等(一度だけ実行してrepoにコミットする)。
const LEGACY = {
  seasons: (() => { try { return J('reference/_legacy_seasons.json').seasons || {}; } catch (e) { return {}; } })(),
  moveAvailability: (() => { try { return J('reference/_legacy_move_availability.json').availability || {}; } catch (e) { return {}; } })(),
  abilityDesc: (() => { try { return J('reference/_legacy_ability_desc.json'); } catch (e) { return { national: {}, champions: {} }; } })(),
  // ★段C差し戻し対応(2026-09-01・コーディネーター指摘)資産4〜7: tools/_freeze_legacy_assets_r2.js が凍結
  moveSubcategory: (() => { try { return J('reference/_legacy_move_subcategory.json').subcategory || {}; } catch (e) { return {}; } })(),
  moveChampionsFlags: (() => { try { return J('reference/_legacy_move_champions_flags.json'); } catch (e) { return { added: {}, mode: {} }; } })(),
  pokemonChampionsAddedIn: (() => { try { return J('reference/_legacy_pokemon_champions_added_in.json').added_in || {}; } catch (e) { return {}; } })(),
  itemEffect: (() => { try { return J('reference/_legacy_item_effect.json').effect || {}; } catch (e) { return {}; } })(),
  itemMegaAbilityDesc: (() => { try { return J('reference/_legacy_item_mega_ability_desc.json').mega_ability_desc || {}; } catch (e) { return {}; } })(),
};
const NAMEMAP = (() => {
  try {
    const d = J('reference/_name_normalize.json');
    const rows = Array.isArray(d) ? d : (d.rows || []);
    const m = {};
    // ★キーは display_name(いまのChampions表記) → official_name(正式名称)
    //   2026-07-30: champions_name というキーは存在せず、名前の正式化が効いていなかった
    rows.forEach(r => { if (r.display_name) m[r.display_name] = r; });
    return m;
  } catch (e) { return {}; }
})();

// ★英語slug対応表(tools/_match_pokemon_slugs.py が生成。種族値+タイプ+特性の一致で検証済み)
const SLUGMAP = (() => {
  try {
    const d = J('reference/_pokemon_slug_map.json');
    const m = {};
    (d.matched || []).forEach(r => { m[r.name] = r.slug; });
    return m;
  } catch (e) { return {}; }
})();

// ── 共通ヘルパ ──────────────────────────────────────────────────────
const zen2han = s => String(s == null ? '' : s).replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
const norm = s => zen2han(s).replace(/[()（）\s]/g, '').replace(/のすがた|フォルム/g, '');
const stamp = (src) => ({ source: src, verified_at: NOW });
// ★世代の控え: 全国版に行が無い(メガ/Champions権威由来)場合は図鑑No.から種の世代を出す
//   慣例に合わせる: 地方のすがたも元の種の世代(コラッタ(アローラ)=1・メガフシギバナ=1)
const genFromNo = (no) => {
  const n = Number(no);
  if (!Number.isFinite(n) || n < 1) return null;
  if (n <= 151) return 1; if (n <= 251) return 2; if (n <= 386) return 3;
  if (n <= 493) return 4; if (n <= 649) return 5; if (n <= 721) return 6;
  if (n <= 809) return 7; if (n <= 905) return 8; if (n <= 1025) return 9;
  return null;
};
// ★決められない値は勝手に決めず null を入れて unknowns に積む(推測で埋めない)
const unknowns = [];
const unk = (kind, key, why) => { unknowns.push({ kind, key, why }); return null; };

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
// ★verified_at の保全: 中身が1バイトも変わらない行は前回の日付を保つ
//   (再ビルドのたびに919件の日付だけが書き変わり、本当の差分が埋もれていた 2026-07-31 宿題)
const keepDates = (name, obj) => {
  try {
    // ★J()はROOT起点の相対パス専用。ここは絶対パスなので fs を直接使う
    const prev = JSON.parse(fs.readFileSync(path.join(OUT, name), 'utf8'));
    if (!Array.isArray(obj.items) || !Array.isArray(prev.items)) return;
    const keyOf = it => `${it.slug ?? ''}|${it.no ?? ''}|${it.name ?? ''}|${it.form ?? ''}`;  // slug=同名Zワザ(物理/特殊)の区別
    const bodyOf = it => JSON.stringify(Object.assign({}, it, { verified_at: null }));
    const prevMap = new Map();
    prev.items.forEach(it => {
      const k = keyOf(it);
      prevMap.set(k, prevMap.has(k) ? null : it);  // キー重複は安全側=保全しない
    });
    obj.items.forEach(it => {
      if (!('verified_at' in it)) return;
      const old = prevMap.get(keyOf(it));
      if (old && old.verified_at && bodyOf(old) === bodyOf(it)) it.verified_at = old.verified_at;
    });
  } catch (e) { /* 前回ファイルが無ければそのまま */ }
};
const write = (name, obj) => {
  keepDates(name, obj);
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1) + '\n');
  const n = Array.isArray(obj.items) ? obj.items.length : (obj.count || '?');
  console.log(`  ✍ master/${name}  ${n}件`);
};
const META = (what, extra) => Object.assign({
  what, generated_at: NOW, generator: 'tools/build_master_v2.js',
  rule: 'データは一つ。マスターデータは master/ にしかない。修正も追加もここだけ。',
  canon: '器=全国版の範囲 / 値の正典=Champions → 無ければ最新世代(source に由来を残す)',
  regulation_current: REGULATION,
}, extra || {});

// ══════════════════════════════════════════════════════════════════
// 1) abilities.json
// ══════════════════════════════════════════════════════════════════
// ★ナビ欄(「関連する項目…」)を効果文から落とす(2026-08-15 特性監査の前処理で59件を機械検出)。
//   出どころ= ヤックン/ch/ のスクレイプが、ページ下部の関連リンク欄まで効果文に取り込んでいた(コーパス側62件)。
//   コーパスは生の記録なので触らず、master生成時に落とす。
//   ★なぜ落とすか= 説明文はわざと短い設計([[pokemon-text-is-deliberately-short]])。関連リンクを説明文に
//   混ぜると「その特性の効果」だと誤読される(2026-07-30に同じ型のバグを26件直した実績あり)。
//   全59件の切り取り位置を機械検査済み(切った後が短すぎるものは0件)。
function stripNavi(s) {
  if (typeof s !== 'string') return s;
  return s.split(/関連する項目|関連項目/)[0].trim();
}

function buildAbilities() {
  const authByName = {};
  AUTH.abilities.abilities.forEach(a => { authByName[a.name] = a; });
  // 器 = 全国版の特性(ABILITY_DESC)+ Championsのポケモンが実際に持つ特性 + 権威
  // ★名前は半角に正規化してから集める(2026-08-15)。全国版に『ＡＲシステム』(全角)があり、権威の
  //   『ARシステム』(半角)と別項目として2行に分かれていた=同じ特性の重複。英数字は半角が家のルール
  //   ([[hankaku-alphanumeric-rule]]・全角は名寄せを静かに壊す)。
  const names = new Set([
    ...Object.keys(A.ABILITY_DESC || {}),
    ...Object.keys(C.ABILITY_DESC || {}),
    ...Object.keys(authByName),
  ].map(zen2han));
  // 全国版の説明は半角キーで引けるようにしておく(元データに全角キー『ＡＲシステム』がある)
  const natDesc = {};
  Object.entries(A.ABILITY_DESC || {}).forEach(([k, v]) => { natDesc[zen2han(k)] = v; });
  // ★段B資産④: desc_house(旧ページの「家の流儀」短文=ABILITY_DESC)を凍結ファイルから引く。
  //   effect_ja(権威長文)とは別欄。優先順=Champions版のABILITY_DESC → 無ければ全国版。
  const houseChamp = {}; Object.entries(LEGACY.abilityDesc.champions || {}).forEach(([k, v]) => { houseChamp[zen2han(k)] = v; });
  const houseNat = {}; Object.entries(LEGACY.abilityDesc.national || {}).forEach(([k, v]) => { houseNat[zen2han(k)] = v; });
  // Championsのポケモンが実際に持つ特性(印の根拠。champions.in フラグは信用しない=2026-07-28に10件漏れていた)
  // ★champions_pokemon_count は Champions のポケモン一覧から**自分で数える**(2026-08-15)。
  //   以前は権威コーパスの同名フィールドを写していたが、2026-08-15にコーパスを取り直した際に
  //   このフィールドを落としてしまい、311件すべてが0になる退行を起こした(特性監査R1が検出)。
  //   → 外部の値を写すのをやめ、うちのポケモンデータから数える(自己完結=同じ事故が起きない)。
  const usedInChampions = new Set();
  const chCount = {};
  C.POKEMON_LIST.forEach(p => {
    const seen = new Set();                          // 同じポケモンが同じ特性を2枠持つ場合の二重計上を防ぐ
    ['ab1', 'ab2', 'ab3'].forEach(k => {
      if (!p[k] || seen.has(p[k])) return;
      seen.add(p[k]);
      usedInChampions.add(p[k]); names.add(p[k]);
      chCount[p[k]] = (chCount[p[k]] || 0) + 1;
    });
  });
  // ★手動追加ポケモン(reference/_pokemon_additions.json)で champions=true の行も数える(2026-09-01・レギュM-C予告分:
  //   メガルカリオZ→はどうのぼうご 等)。ここで名前を足しておけば、下の additions で実体(効果文)に置き換わる。
  try {
    (J('reference/_pokemon_additions.json').items || []).filter(p => p.champions).forEach(p => {
      const seen = new Set();
      ['ab1', 'ab2', 'ab3'].forEach(k => {
        if (!p[k] || seen.has(p[k])) return;
        seen.add(p[k]); usedInChampions.add(p[k]); names.add(p[k]);
        chCount[p[k]] = (chCount[p[k]] || 0) + 1;
      });
    });
  } catch (e) {}

  const items = [...names].filter(Boolean).sort().map(name => {
    const au = authByName[name];
    const inCh = usedInChampions.has(name) || !!(au && au.champions_pokemon_count);
    // ★説明文: 公式のゲーム内テキスト(Champions)を最優先 → 権威の効果文 → うちの既存
    let effect = null, src = null;
    if (au && au.effect) { effect = au.effect; src = 'champions_authority'; }
    else if (C.ABILITY_DESC && C.ABILITY_DESC[name]) { effect = C.ABILITY_DESC[name]; src = 'ours_champions'; }
    else if (natDesc[name]) { effect = natDesc[name]; src = 'ours_national'; }
    else { effect = unk('ability_effect', name, '権威にもうちにも説明が無い'); src = 'unknown'; }
    // ★desc_house: 旧ページの「家の流儀」短文(旧ABILITY_DESC)。effect_ja(権威長文)とは別文章・別欄。
    let descHouse = null, descHouseSrc = null;
    if (houseChamp[name] !== undefined) { descHouse = houseChamp[name]; descHouseSrc = 'champions'; }
    else if (houseNat[name] !== undefined) { descHouse = houseNat[name]; descHouseSrc = 'national'; }
    return Object.assign({
      slug: null,                        // ★英語slugは未確定(PokeAPI照合が要る)→ unknown として残す
      name, display_name: name,
      effect_ja: stripNavi(effect),
      desc_house: descHouse,             // ★旧ページ(pokechan_data*.js)のABILITY_DESC。verbatim(stripNaviしない=別物として保存)
      desc_house_source: descHouseSrc,   // 'champions' | 'national' | null(旧に説明が無かった)
      champions: inCh,
      regulation: inCh ? REGULATION : null,
      champions_pokemon_count: chCount[name] || 0,
      name_en: au ? (au.en || null) : null,
    }, stamp(src));
  });
  items.filter(x => !x.name_en).forEach(x => unk('ability_slug', x.name, '英語名が権威に無い=slug未確定'));
  // ★監査で確定した修正を適用(reference/_abilities_fixes.json・全件根拠つき。持ち物と同じ仕組み)
  //   これが無いと、master/abilities.json を手で直しても再ビルドで静かに元に戻る(2026-08-16に気づいた)。
  //   effect_ja は上で「権威の効果文をそのまま」入れているので、権威側の誤り・未検証メモまで写る。
  //   ここで1件ずつ根拠つきに上書きする。
  try {
    const fx = J('reference/_abilities_fixes.json').fixes || {};
    items.forEach(it => {
      const f = fx[it.name];
      if (!f) return;
      ['effect_ja', 'name_en'].forEach(k => { if (f[k] != null) it[k] = f[k]; });
      if (f.effect_ja != null) it.source = 'audited';
    });
  } catch (e) {}

  // ★手動追加(器を広げる時の入力・2026-09-01 新設。第1号=レギュM-Cの新特性『はどうのぼうご』)
  //   同名が既に居れば上書き(上で names に足された分は効果文が unknown の空行なので、実体に置き換える)
  try {
    const adds = J('reference/_abilities_additions.json');
    (adds.items || []).forEach(a => {
      const i = items.findIndex(x => x.name === a.name);
      const row = Object.assign({}, a, { verified_at: a.verified_at || NOW });
      if (i >= 0) items[i] = Object.assign({}, items[i], row); else items.push(row);
      for (let k = unknowns.length - 1; k >= 0; k--) {          // 空行ぶんの unknown は取り下げる
        if (unknowns[k].kind === 'ability_effect' && unknowns[k].key === a.name) unknowns.splice(k, 1);
      }
    });
    items.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  } catch (e) {}

  write('abilities.json', { meta: META('特性', {
    fixes: '監査確定の修正は reference/_abilities_fixes.json(根拠つき)から適用',
    desc_house_field: 'desc_house=旧ページ(pokechan_data.js/pokechan_data_all.js)のABILITY_DESC(家の流儀の短文)を' +
      'reference/_legacy_ability_desc.jsonから移送(段B資産④)。effect_ja(Champions権威コーパス由来の長文)とは別文章・別欄。' +
      '優先順=Championsの旧ABILITY_DESC→無ければ全国版。desc_house_sourceに由来。両方に無ければnull(=旧にも説明が無かった特性)。',
  }), count: items.length,
    champions_count: items.filter(x => x.champions).length, items });
  return items.length;
}

// ══════════════════════════════════════════════════════════════════
// 2) items.json
// ══════════════════════════════════════════════════════════════════
// ★applies_to(持ち物の対象ポケモン名)を、マスターに実在する名前の配列へ展開する。
//   ①完全一致があればそれ ②無ければ「基本名で始まる」ものを全部(ニャオニクス → オス/メスのすがた)
//   ③メガ形も拾う(メガニャオニクス♀♂)。1つも見つからなければ null(推測で作らない)。
let _pkNamesCache = null;
function pkNames() {
  if (!_pkNamesCache) {
    _pkNamesCache = A.POKEMON_LIST.map(p => p.name);
    C.POKEMON_LIST.forEach(p => { const r = NAMEMAP[p.name]; const n = (r && r.official_name) ? r.official_name : p.name; if (!_pkNamesCache.includes(n)) _pkNamesCache.push(n); });
  }
  return _pkNamesCache;
}
// 『physical_attack』のような英小文字+アンダースコアの識別子は「補正の対象」であってポケモン名ではない
function looksLikeDescriptor(v) { return typeof v === 'string' && /^[a-z0-9_]+$/.test(v); }

// ★boosts(=何が上がるか)の是正表(2026-08-13 監査ラウンド3・Wiki+徹底攻略の二重チェック済み)
//   旧実装は applies_to(=発動条件)をそのまま boosts に複写していたため、条件と上昇対象が違う持ち物で
//   意味が壊れていた。ここは「条件」ではなく「上がるもの」だけを書く。basis は権威の引用。
const BOOSTS_FIX = {
  'のどスプレー': { value: 'special_attack',
    basis: 'Wiki効果節「音のわざを使用した後、自分のとくこうを1段階上げる。」/ 徹底攻略SV「…を使ったときに『とくこう』ランクが1段階上がる。」→ 条件=音技(sound_moves)・上がるのは とくこう' },
  'ブーストエナジー': { value: 'highest_stat_except_hp',
    basis: 'Wiki効果節「ランク補正込みで最も高い能力を上げる。…上げる能力にHPは含めない。」(攻/防/特攻/特防=1.3倍・素早さ=1.5倍)→ 条件=こだいかっせい/クォークチャージ・上がるのは HP以外の最高能力' },
  'いかさまダイス': { value: 'multi_hit_count',
    basis: 'Wiki効果節「2~5回当たる連続攻撃技を使用したとき、攻撃回数が必ず4回以上になる。」→ 条件=連続攻撃技・上がるのは 攻撃回数' },
  'パンチグローブ': { value: 'punch_move_power',
    basis: 'Wiki効果節「持たせたポケモンが以下のパンチ技を使用したとき威力が1.1倍になり、直接攻撃ではなくなる。」→ 上がるのは パンチ技の威力(ちからのハチマキ=physical_damage と同じ粒度に揃える)' },
  'ひかりのこな': { value: 'opponent_accuracy_down',
    basis: 'Wiki効果節「持たせたポケモンに対するわざの命中率が0.9倍になる」→ 自分の回避率が上がるのではなく、相手の命中率が下がる機構。evasion(回避ランク)と同一視すると誤実装になる' },
};
function expandAppliesTo(base) {
  if (!base || typeof base !== 'string') return null;
  if (looksLikeDescriptor(base)) return null;        // ★補正の対象なので、ポケモン名としては扱わない
  const all = pkNames();
  if (all.includes(base)) return [base];
  // ★『メガ+base』は拾わない(2026-08-13 R4で発見)。メガストーンは**まだメガ進化していない**
  //   ポケモンに持たせる道具なので、applies_to_pokemon に既にメガ進化した姿を入れるのは誤り。
  //   実害: ニャオニクスナイトに『メガニャオニクス♀/♂』が入っていた(=メガ済みにも持たせられると
  //   読めてしまう)。★base 自身が『メガ』で始まる名前(メガニウム等)は正当なので除外しない。
  const hit = all.filter(n => n === base || n.startsWith(base + '(') || n.startsWith(base + ' '));
  return hit.length ? hit : null;
}

function buildItems() {
  const flat = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      if (o.name && (o.key || o.effect || o.category)) flat.push(o);
      Object.values(o).forEach(walk);
    }
  })(ITEMS_DB);
  const seen = new Set();
  const ours = flat.filter(x => { const k = x.key || x.name; if (seen.has(k)) return false; seen.add(k); return true; });
  const authNames = new Set((AUTH.lists.items.rows || []).map(r => r[0]));
  const authEffect = {}; (AUTH.lists.items.rows || []).forEach(r => { authEffect[r[0]] = r[1]; });

  // ★メガストーンの「戦闘中1回だけ」復元(2026-08-01 阿部さん決定「残していい」)
  //   権威(/ch/)の一覧文には無いが、旧データが持っていた事実(メガシンカは戦闘中1回)を失わない。
  //   ・「にメガシンカさせる。」の直後に差し込む(入手方法の文は一字も変えない=足さず減らさず)
  //   ・定型「2000VPで購入する。」だけは承認済みの「(2000VPで購入)」形式に
  const restoreOncePerBattle = (t) => {
    if (!t || t.includes('戦闘中1回') || !t.includes('にメガシンカさせる。')) return t;
    let s = t.replace(/『(メガ[^』]+)』にメガシンカさせる。/, '$1にメガシンカさせる。'); // 『』の表記ゆれ統一
    s = s.replace('にメガシンカさせる。', 'にメガシンカさせる。戦闘中1回だけ。');
    s = s.replace(/戦闘中1回だけ。2000VPで購入する。$/, '戦闘中1回だけ。(2000VPで購入)');
    return s;
  };

  const items = ours.map(it => {
    const inCh = authNames.has(it.name);
    const rawEffect = inCh ? (authEffect[it.name] || it.effect || null) : (it.effect || null);
    return Object.assign({
      slug: it.key || null,
      name: it.name, display_name: it.name, name_en: it.name_en || null,
      category: it.category || null,
      effect_ja: (it.category === 'mega_stone') ? restoreOncePerBattle(rawEffect) : rawEffect,
      // ★段C差し戻し対応(2026-09-01)資産⑦: 旧items_database.js items[*].effect(家の流儀の短文)を
      //   凍結ファイル(reference/_legacy_item_effect.json)から移送。effect_ja(Champions権威の長文)とは
      //   別文章・別欄(155/169件が既に別文言=ABILITY_DESCのdesc_houseと同型)。キー=it.key||it.name。
      //   新規追加(ナイトZ等11件)は旧に無いのでnull(生成器がその時だけeffect_jaにフォールバックする)。
      effect_house: (() => { const k = it.key || it.name; return LEGACY.itemEffect[k] !== undefined ? LEGACY.itemEffect[k] : null; })(),
      // ★段C差し戻し対応(2026-09-01・3回目)資産②: 旧items_database.js items[*].mega_ability_desc
      //   (独自の短い言い換え文・57件)を凍結ファイルから移送。effect_ja/desc_houseとは別欄。
      mega_ability_desc_house: (() => { const k = it.key || it.name; return LEGACY.itemMegaAbilityDesc[k] !== undefined ? LEGACY.itemMegaAbilityDesc[k] : null; })(),
      // ★applies_to は「基本名」で書かれていることがある(例: ニャオニクスナイト → 『ニャオニクス』)。
      //   マスターの名前はフォーム名(『ニャオニクス(オスのすがた)』)なので、そのままでは一致せず
      //   **メガシンカが到達不能になる**(2026-07-30 GLMの独立検算で発見。フラエッテナイトと同じ型)。
      //   → 一致する名前の**配列**に展開しておく(照合する側は配列を見ればよい)。
      // ★applies_to は items_database で**2つの意味**に使われている(2026-07-30 発見):
      //   ①対象ポケモン(メガストーン)= 『ニャオニクス』『フラエッテ(えいえんのはな)』
      //   ②補正の対象(能力・技種別)= 『physical_attack』『speed』『sound_moves』
      //   → マスターデータでは**分ける**(同じ欄に別の意味を入れない)。
      applies_to: it.applies_to || null,                        // 旧データそのまま(移行用に残す)
      applies_to_pokemon: expandAppliesTo(it.applies_to),       // ①対象ポケモン(実在名の配列)
      // ★②補正の対象。旧実装は applies_to をそのまま複写していたが、applies_to は「発動条件」で
      //   ある場合が多く、「何が上がるか」を表していなかった(2026-08-13 監査ラウンド3で発見)。
      //   例: のどスプレー = 条件『音技を使った』/ 上がるのは『とくこう』。旧値は sound_moves で、
      //   sim がこの欄を読むと上昇対象を取り違える。→ BOOSTS_FIX で1件ずつ権威裏取りして上書きする。
      boosts: BOOSTS_FIX[it.name] !== undefined ? BOOSTS_FIX[it.name].value
            : (looksLikeDescriptor(it.applies_to) ? it.applies_to : null),
      implemented: it.implemented_in_pokechan === true,
      champions: inCh,
      regulation: inCh ? REGULATION : null,
      // ★段B資産⑥: items_database.js が持つ「構造化フィールド(≈25種)」をverbatimで移送する
      //   (棚卸し=reference/_plans/棚卸し_生成物にしか無い資産_2026-09-01.md §3で legacy_only と判定された欄)。
      //   items_database.js は build_master_v2.js の**元々の入力**(ITEMS_DB)なので、旧生成物のように
      //   凍結ファイルを別途作らず、ここで直接パススルーする(pokechan_data*.js とは扱いが違う)。
      //   ★値は一切加工しない。undefinedのキーは省く(空欄で埋めない=Object.assignでundefinedは飛ばす)。
      acquisition: it.acquisition !== undefined ? it.acquisition : undefined,
      acquisition_note: it.acquisition_note !== undefined ? it.acquisition_note : undefined,
      restriction: it.restriction !== undefined ? it.restriction : undefined,
      notes: it.notes !== undefined ? it.notes : undefined,
      verify: it.verify !== undefined ? it.verify : undefined,
      q12: it.q12 !== undefined ? it.q12 : undefined,
      factor: it.factor !== undefined ? it.factor : undefined,
      source_q12: it.source_q12 !== undefined ? it.source_q12 : undefined,
      boost_type: it.boost_type !== undefined ? it.boost_type : undefined,
      vp_cost: it.vp_cost !== undefined ? it.vp_cost : undefined,
      resist_type: it.resist_type !== undefined ? it.resist_type : undefined,
      trigger: it.trigger !== undefined ? it.trigger : undefined,
      cure_target: it.cure_target !== undefined ? it.cure_target : undefined,
      is_default: it.is_default !== undefined ? it.is_default : undefined,
      heal_amount_fixed: it.heal_amount_fixed !== undefined ? it.heal_amount_fixed : undefined,
      heal_fraction: it.heal_fraction !== undefined ? it.heal_fraction : undefined,
      heal_fraction_of_damage: it.heal_fraction_of_damage !== undefined ? it.heal_fraction_of_damage : undefined,
      heal_fraction_for_poison: it.heal_fraction_for_poison !== undefined ? it.heal_fraction_for_poison : undefined,
      damage_fraction_for_others: it.damage_fraction_for_others !== undefined ? it.damage_fraction_for_others : undefined,
      damage_fraction_to_attacker: it.damage_fraction_to_attacker !== undefined ? it.damage_fraction_to_attacker : undefined,
      proc_chance: it.proc_chance !== undefined ? it.proc_chance : undefined,
      self_inflict: it.self_inflict !== undefined ? it.self_inflict : undefined,
      drawback: it.drawback !== undefined ? it.drawback : undefined,
      pokeapi_slug: it.pokeapi_slug !== undefined ? it.pokeapi_slug : undefined,
      // ★棚卸しには明記されていないが同種の legacy_only 構造化欄(acquisitionの出典citation)。
      //   acquisition/acquisition_note と同じ90件グループに属する(段B時点で発見・追加で運ぶ)。
      legacy_source_note: it.source !== undefined ? it.source : undefined,
    }, stamp(inCh ? 'champions_authority' : 'ours_national'));
  });
  // ★監査で確定した修正を適用(reference/_items_fixes.json・全件根拠つき。2026-08-02 阿部さん承認)
  try {
    const fx = J('reference/_items_fixes.json').fixes || {};
    items.forEach(it => {
      const f = fx[it.name];
      if (!f) return;
      ['name_en', 'category', 'effect_ja', 'champions_added_in'].forEach(k => { if (f[k] != null) it[k] = f[k]; });
    });
  } catch (e) {}

  // ★手動追加(器を広げる時の入力・2026-09-01 新設。第1号=レギュM-Cのメガストーン『○○ナイトZ』3つ)
  try {
    const adds = J('reference/_items_additions.json');
    const have = new Set(items.map(x => x.name));
    (adds.items || []).forEach(a => {
      if (have.has(a.name)) return;                 // すでに居れば足さない(二重防止)
      // ★champions_added_in=初登場のレギュ(additionsの regulation 欄)。ページ(news等)が「このレギュで増えた持ち物」を大元から引くための印(2026-09-03 R1)
      items.push(Object.assign({}, a, { champions_added_in: a.champions_added_in || a.regulation || null, verified_at: a.verified_at || NOW }));
    });
  } catch (e) {}

  // ★R1(2026-09-03): seasons=そのアイテムが「現行/次」のどちらのレギュで使えるか(ポケモンの seasons と同じ模様)。
  //   champions:true の行だけ持つ(非Championsは器の範囲外なのでレギュの概念が無い=[])。
  //   ルール: champions_added_in が「次」(REG_NEXT)なら次のレギュではじめて使える=現行にはまだ居ない(push しない)。
  //   それ以外(現行で追加/最初から居る=champions_added_inがnull・M-B等)は現行にも次にも居る(レギュは累積)。
  items.forEach(x => {
    if (!x.champions) { x.seasons = []; return; }
    x.seasons = [];
    const addedInNext = x.champions_added_in === REG_NEXT;
    if (!addedInNext && REG_CURRENT) x.seasons.push(REG_CURRENT);
    if (!x.seasons.includes(REGULATION)) x.seasons.push(REGULATION);
    x.seasons = x.seasons.filter(s => LIVE_REGS.includes(s)).sort((a, b) => LIVE_REGS.indexOf(a) - LIVE_REGS.indexOf(b));
  });

  write('items.json', { meta: META('持ち物', {
    seasons_field: `★R1(2026-09-03 阿部さん): seasons=そのアイテムが使える現行/次のレギュ(champions:trueの行のみ・` +
      `pokemon.jsonのseasonsと同じモデル)。現行=${REG_CURRENT} / 次=${REG_NEXT || '(未発表)'}。` +
      'champions_added_inが次のレギュの行(例: アブソルナイトZ等M-C予告6件)は現行にはまだ居ない=[次]だけ。' +
      'それ以外(旧来品/現行で追加=M-B新規31件)はレギュ累積で[現行,次]。非Championsは[]。',
    fixes: '監査確定の修正は reference/_items_fixes.json(根拠つき)から適用',
    legacy_fields: '段B資産⑥: items_database.js のみが持つ構造化フィールド(acquisition/acquisition_note/restriction/notes/' +
      'verify/q12/factor/source_q12/boost_type/vp_cost/resist_type/trigger/cure_target/is_default/heal_*/damage_fraction_*/' +
      'proc_chance/self_inflict/drawback/pokeapi_slug/legacy_source_note)をverbatimで移送。値が無い品目はキー自体を省く。' +
      'legacy_source_note=旧データの`source`欄(出典citation文字列)。stamp()が書く provenance の`source`欄と名前が' +
      '衝突するため改名した(値は変えていない)。mega_form/mega_ability等のメガ関連派生欄はcomputed_via_join' +
      '(applies_to_pokemon経由でpokemon.json/abilities.jsonを引けば再現可能)のため運ばない。',
    effect_house_field: '段C差し戻し対応(2026-09-01)資産⑦: effect_house=旧items_database.jsのeffect(家の流儀の短文)を' +
      'reference/_legacy_item_effect.jsonから移送。effect_ja(Champions権威の長文)とは別欄。新規11件はnull。',
    mega_ability_desc_house_field: '段C差し戻し対応(2026-09-01・3回目)資産②: mega_ability_desc_house=旧items_database.jsの' +
      'mega_ability_desc(独自の短い言い換え文・57件)をreference/_legacy_item_mega_ability_desc.jsonから移送。' +
      '無い品目(空欄だった/新規)はnull=生成器がmaster/abilities.jsonのdesc_houseにフォールバックする。',
  }), count: items.length,
    champions_count: items.filter(x => x.champions).length, items });
  return items.length;
}

// ══════════════════════════════════════════════════════════════════
// 3) moves.json
// ══════════════════════════════════════════════════════════════════
function buildMoves() {
  const authByName = {};
  (AUTH.moves.moves || []).forEach(m => { authByName[m.name] = m; });
  const chByName = {}; Object.entries(C.WAZA_MAP).forEach(([k, m]) => { chByName[m.name] = Object.assign({ _champKey: k }, m); });
  const natByName = {}; Object.entries(A.WAZA_MAP).forEach(([k, m]) => { natByName[zen2han(m.name)] = Object.assign({ _slug: k }, m); });

  // ★キーは slug(英語)。名前をキーにすると、Z技の物理版/特殊版(breakneck-blitz--physical / --special)など
  //   **同名の別技が18件つぶれる**(2026-07-30に実際に潰れた=919→901)。設計どおり slug を主キーにする。
  const bySlug = new Map();
  Object.entries(A.WAZA_MAP).forEach(([slug, m]) => bySlug.set(slug, { nat: Object.assign({ _slug: slug }, m) }));
  Object.entries(C.WAZA_MAP).forEach(([ck, m]) => {
    const nz = zen2han(m.name);
    // Champions技は全国版の同名slugに合流(同名が複数ある場合は最初の1つ=Championsに専用Z技は無い)
    const hit = [...bySlug.entries()].find(([, v]) => v.nat && zen2han(v.nat.name) === nz);
    if (hit) hit[1].ch = Object.assign({ _champKey: ck }, m);
    else bySlug.set('champions:' + ck, { ch: Object.assign({ _champKey: ck }, m) });
  });
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };

  const items = [...bySlug.entries()].map(([slugKey, v]) => {
    const nat = v.nat, ch = v.ch;
    const nz = zen2han((nat && nat.name) || (ch && ch.name) || '');
    const au = authByName[nz] || (ch && authByName[ch.name]) || (nat && authByName[nat.name]);
    // ★コインビームは存在しない技=持ち込まない(2026-07-29 阿部さん決定)
    if (nz === 'コインビーム') return null;
    const inCh = !!au || (!!ch && !!authByName[(ch.name || '')]);
    const base = inCh && au ? au : null;
    const pri = ch ? ((ch.battle_data && ch.battle_data.priority) != null ? ch.battle_data.priority : (ch.priority || 0))
                   : (nat ? (nat.priority || 0) : 0);
    const src = inCh ? 'champions_authority' : (nat ? 'ours_national' : 'ours_champions');
    return Object.assign({
      slug: nat ? nat._slug : null,
      champions_key: ch ? ch._champKey : null,        // ★旧キーは _aliases として残す(引っ越し完了まで)
      // ★2026-07-31 修正(阿部さん決定: 数字は半角に揃える。「海外に全角は無いので」):
      //   ここは正規化済みの nz を作っておきながら、出力には全国版の生の名前(=全角)を使っていた。
      //   結果 master の中で表記が割れ、moves側『１０まんボルト』/ learnsets側『10まんボルト』となり、
      //   名前で突き合わせる工程で **141体分の技が静かに落ちる**状態だった(実測: 10まんボルト89体・
      //   10まんばりき47体・DDラリアット3体・3ぼんのや1体・Gのちから1体)。
      //   ★権威(ヤックン /ch/ の moves_ch・learnsets_ch)も Champions版データも半角なので、半角が正。
      name: nz || (nat && nat.name) || (ch && ch.name) || '',
      display_name: zen2han((ch && ch.name) || (nat && nat.name) || '') || nz,
      type: base ? base.type : (ch ? ch.type : (nat ? nat.type : null)),
      category: base ? base.category : (ch ? ch.category : (nat ? nat.category : null)),
      power: base ? num(base.power) : (ch ? (ch.power || null) : (nat ? (nat.power || null) : null)),
      accuracy: base ? num(base.accuracy) : (ch ? (ch.accuracy || null) : (nat ? (nat.accuracy || null) : null)),
      pp: base ? num(base.pp) : (ch ? (ch.pp || null) : (nat ? (nat.pp || null) : null)),
      priority: pri,                                   // ★置き場所を最上位に統一
      target: (ch && ch.target) || (nat && nat.target) || null,
      contact: (ch && ch.contact) != null ? ch.contact : ((nat && nat.contact) != null ? nat.contact : null),
      protect: (ch && ch.protect) != null ? ch.protect : ((nat && nat.protect) != null ? nat.protect : null),
      // ★段B資産③: 旧生成物 pokechan_data_all.js の WAZA_MAP[*].availability を凍結ファイルから引く。
      //   キー=nat._slug(=A.WAZA_MAPのキー=このmaster行のslug)。Championsにしか居ない技(nat無し)は
      //   全国版のShowdown由来データが無いので null のまま(推測で埋めない)。
      availability: (nat && LEGACY.moveAvailability[nat._slug] !== undefined) ? LEGACY.moveAvailability[nat._slug] : null,
      // ★段C差し戻し対応(2026-09-01)資産④: 旧生成物pokechan_data_all.jsのWAZA_MAP[*].subcategory
      //   (技のグループ分け=作り直し禁止の資産)を凍結ファイルから移送。キー=nat._slug。新規技はnull。
      subcategory: (nat && LEGACY.moveSubcategory[nat._slug] !== undefined) ? LEGACY.moveSubcategory[nat._slug] : null,
      // ★段C差し戻し対応 資産⑤: 旧pokechan_data.js(Champions版)WAZA_MAP[*].added / .mode。キー=ch._champKey。
      champions_added: (ch && LEGACY.moveChampionsFlags.added[ch._champKey] !== undefined) ? LEGACY.moveChampionsFlags.added[ch._champKey] : null,
      champions_mode: (ch && LEGACY.moveChampionsFlags.mode[ch._champKey] !== undefined) ? LEGACY.moveChampionsFlags.mode[ch._champKey] : null,
      // ★説明文とeffectsは既存の資産をそのまま移送(作り直さない)
      description: (ch && ch.description) || (nat && nat.description) || null,
      description_legacy: (ch && ch.description_legacy) || (nat && nat.description_legacy) || null,
      battle_data: (ch && ch.battle_data) || (nat && nat.battle_data) || null,
      flags: (ch && ch.flags) || (nat && nat.flags) || null,
      tags: (nat && nat.tags) || null,
      move_no: (nat && nat.move_no) || (ch && ch.move_no) || null,
      champions: inCh,
      regulation: inCh ? REGULATION : null,
    }, stamp(src));
  }).filter(Boolean).sort((a,b)=>(a.move_no||9999)-(b.move_no||9999) || String(a.name).localeCompare(String(b.name),'ja'));
  // ★監査で確定した修正を適用(reference/_moves_fixes.json・全件根拠つき。特性/持ち物/ポケモンと同じ仕組み。2026-09-02 R1仕分けで新設)
  //   キーは slug。set のフィールドをそのまま上書き。根拠なしで足さない・二重ソース一致のみ。
  try {
    const fx = J('reference/_moves_fixes.json').fixes || {};
    items.forEach(it => {
      const f = fx[it.slug];
      if (!f || !f.set) return;
      // キーはパス可("battle_data.effects[0].source" / "availability.gens")。途中が無ければ作らない(推測で器を足さない)
      Object.entries(f.set).forEach(([k, v]) => {
        const parts = k.replace(/\[(\d+)\]/g, '.$1').split('.');
        let o = it;
        for (let i = 0; i < parts.length - 1; i++) { o = o[parts[i]]; if (o == null) { unk('move_fix_path', it.slug, k + ' の途中が無い'); return; } }
        o[parts[parts.length - 1]] = v;
      });
      it.source = 'audited';
    });
  } catch (e) {}
  items.filter(x => !x.slug).forEach(x => unk('move_slug', x.name, '全国版に無い=英語slug未確定'));
  write('moves.json', { meta: META('技', {
    availability_field: 'availability=旧生成物pokechan_data_all.jsのWAZA_MAP[*].availabilityをreference/_legacy_move_availability.jsonから移送' +
      '(段B資産③。出どころ=Pokemon Showdown由来。Championsにしか居ない技はnull=推測で埋めない)。' +
      '★R10 世代の扱い(2026-09-03 阿部さん確定): 廃止技も消さない。gen_introduced=初出世代/gens=使える世代/gen_removed=この世代から使えない(廃止世代・二重ソース確定分のみ _moves_fixes.json で付与)/note=作品限定の但し書き(Let\'s Go限定等)。値は最後に使えた世代の実機値(SwSh内部データの数値は採らない)。',
    subcategory_field: '段C差し戻し対応(2026-09-01)資産④: subcategory=旧pokechan_data_all.jsのWAZA_MAP[*].subcategoryを' +
      'reference/_legacy_move_subcategory.jsonから移送(271件。技グループ分けの資産・作り直し禁止)。新規技はnull。',
    champions_flags_field: '段C差し戻し対応 資産⑤: champions_added/champions_mode=旧pokechan_data.js(Champions版)WAZA_MAP[*].added/.mode を' +
      'reference/_legacy_move_champions_flags.jsonから移送。Champions版生成器がadded/modeとして復元する。',
  }), count: items.length,
    champions_count: items.filter(x => x.champions).length, items });
  return items.length;
}

// ══════════════════════════════════════════════════════════════════
// 4) pokemon.json
// ══════════════════════════════════════════════════════════════════
function buildPokemon() {
  const chByName = {}; C.POKEMON_LIST.forEach(p => { chByName[p.name] = p; });
  const natByNorm = {}; A.POKEMON_LIST.forEach(p => { natByNorm[norm(p.name)] = p; });
  const authStats = {}; (AUTH.lists.stats.rows || []).forEach(r => { authStats[norm(r[1])] = r; });

  const all = new Map();
  // ★全国版側にも正式名称変換(NAMEMAP)をかける(2026-08-01)。
  //   これが無いと『ケンタロス(パルデア・combat-breed)』(全国版の英語名残骸)と
  //   『ケンタロス(パルデア単)』(Champions)が別キーになり、同じポケモンが二重に載る。
  //   両方を同じ正式名称に変換すれば、この合流Mapが自然に1行へ統合する。
  A.POKEMON_LIST.forEach(p => {
    const off = (NAMEMAP[p.name] && NAMEMAP[p.name].official_name) || p.name;
    all.set(off, { nat: p });
  });
  C.POKEMON_LIST.forEach(p => {
    const officialRow = NAMEMAP[p.name];
    const official = (officialRow && officialRow.official_name) ? officialRow.official_name : p.name;
    const key = all.has(official) ? official : (natByNorm[norm(p.name)] ? natByNorm[norm(p.name)].name : p.name);
    const e = all.get(key) || {};
    e.ch = p; e.display = p.name; all.set(key, e);
  });

  const items = [...all.entries()].map(([name, e]) => {
    const p = e.ch || e.nat;
    const inCh = !!e.ch;
    const au = authStats[norm(name)] || (e.ch ? authStats[norm(e.ch.name)] : null);
    const stat = k => {
      if (inCh && au) {
        const idx = { hp: 2, atk: 3, def: 4, spatk: 5, spdef: 6, spd: 7, total: 8 }[k];
        const v = Number(au[idx]); if (Number.isFinite(v)) return v;
      }
      return p[k] != null ? p[k] : null;
    };
    return Object.assign({
      slug: SLUGMAP[name] || null,                   // ★検証済み対応表から(無ければ null のまま=推測で埋めない)
      no: p.no != null ? Number(p.no) : null,
      name,                                          // ★正式名称
      display_name: e.display || name,               // ★画面用の短い名前
      form: p.form || null, mega: !!p.mega,
      type1: p.type1 || null, type2: p.type2 || null,
      hp: stat('hp'), atk: stat('atk'), def: stat('def'),
      spatk: stat('spatk'), spdef: stat('spdef'), spd: stat('spd'), total: stat('total'),
      ab1: p.ab1 || null, ab2: p.ab2 || null, ab3: p.ab3 || null,
      weight_kg: p.weight_kg != null ? p.weight_kg : null,
      gen: (e.nat && e.nat.gen) || genFromNo(p.no), legend: (e.nat && e.nat.legend) || null,
      resist: p.resist || null,
      champions: inCh,
      regulation: inCh ? REGULATION : null,
      // ★段B資産②: 旧生成物 pokechan_data_all.js の POKEMON_LIST.season(履歴配列)を凍結ファイルから引く。
      //   キーは e.nat(=A.POKEMON_LIST の生の行オブジェクト。既存のNAMEMAP解決ロジックで既に
      //   このmaster行に紐付いている)の生の名前。これで名前の食い違い(全角/英語slug残骸)があっても、
      //   既存の名前解決(off = NAMEMAP[p.name].official_name)がそのまま効く(2026-09-01 実測: 14件全て解決)。
      seasons: (e.nat && LEGACY.seasons[e.nat.name] !== undefined) ? LEGACY.seasons[e.nat.name].slice() : undefined,
      // ★段C差し戻し対応(2026-09-01)資産⑥: 旧pokechan_data.js(Champions版)POKEMON_LIST[*].added_in を
      //   凍結ファイルから移送。キーはe.ch.name(=Champions版の生の行名。旧の短縮表記のまま)。
      champions_added_in: (e.ch && LEGACY.pokemonChampionsAddedIn[e.ch.name] !== undefined) ? LEGACY.pokemonChampionsAddedIn[e.ch.name] : null,
    }, stamp(inCh && au ? 'champions_authority' : (inCh ? 'ours_champions' : 'ours_national')));
  });

  // ★手動追加(器を広げる時の入力。旧生成物に手書きしない・2026-08-01 新設)
  try {
    const adds = J('reference/_pokemon_additions.json');
    const have = new Set(items.map(x => x.name));
    (adds.items || []).forEach(a => {
      if (have.has(a.name)) return;                 // すでに居れば足さない(二重防止)
      items.push(Object.assign({}, a, { verified_at: NOW }));
    });
  } catch (e) {}

  // ★段B資産②(続き): 旧に無い行(手動追加分)や、旧の名前解決から漏れた行を埋める。
  //   規約(計画_マスターからページへ流す_2026-09-01.md 段B): regulationが立っていれば[regulation]、
  //   無ければ[](推測で過去のレギュを埋めない)。
  let seasonsFilled = 0;
  items.forEach(x => {
    if (x.seasons === undefined) {
      x.seasons = x.regulation ? [x.regulation] : [];
      seasonsFilled++;
    }
  });
  // ★段C差し戻し対応 資産⑥(続き): M-C予告分(regulation:'M-C')は旧に無いので凍結ファイルに無い。
  //   コーディネーター指示どおり'M-C'を直接入れる(手動追加・_pokemon_additions.json由来の行のみ対象)。

  // ★備考欄(阿部さん指示 2026-08-01「マスターに説明欄を絶対入れる。Claudeのため」)
  //   特殊なポケモン(見た目だけの色違いフォルム/バトル中しかならない姿/内部で別フォルム等)の意味を持たせる
  try {
    const notes = J('reference/_pokemon_notes.json').notes || {};
    items.forEach(x => { if (x.slug && notes[x.slug]) x.note = notes[x.slug]; });
  } catch (e) {}

  // ★監査で確定した修正を適用(reference/_pokemon_fixes.json・全件根拠つき。持ち物/特性と同じ仕組み)
  //   第1弾(2026-08-21)=隠れ特性スロット系統バグ: 全国版取得が「通常1+隠れ1」を ab1+ab2 に詰めていて、
  //   336体の隠れ特性が「特性2」欄に表示され「隠れ特性」欄が空だった(PokeAPI全数照合=reference/_pokemon_ability_slot_check.json)。
  try {
    const fx = J('reference/_pokemon_fixes.json').fixes || {};
    items.forEach(it => {
      const f = fx[it.name];
      if (!f || !f.set) return;
      Object.entries(f.set).forEach(([k, v]) => { it[k] = v; });
    });
  } catch (e) {}
  // ★2026-09-01: 次レギュ(M-C予定)の印は fixes 適用の**後**で付ける(ゴリランダー/セグレイブは fixes で regulation:'M-C' になるため。
  //   以前はこの前に走っていて、その2体の seasons/champions_added_in に M-C が入らず、ページのSSN列が「M-A M-B」と誤表示した)。
  //   規則: regulation が seasons に無ければ足す / 現行(REGULATION)より後のレギュで初登場なら champions_added_in にそのレギュ。
  //   ★レギュは累積(2026-09-01 阿部さん確定: 「M-Bだったやつは全部M-Cでも適用される前提で、プラス26体」)。
  //     → 現行レギュ(REGULATION)の行: 旧の季履歴が非空なら現行を足す(9/9に REGULATION='M-C' にすると
  //       ["M-A","M-B"] → ["M-A","M-B","M-C"] に自動で伸びる)。季なし[]の行(バトル中限定の姿など)は[]のまま。
  //     → 現行より後のレギュ(予告分)の行: 空でも足す + champions_added_in にそのレギュ(初登場の印)。
  items.forEach(x => {
    if (!x.regulation) return;
    if (!Array.isArray(x.seasons)) x.seasons = [];
    if (x.regulation === REGULATION) {
      // 旧の季が空[]でもChampions収録(champions:true)なら現行を入れる(2026-09-01 検算: 空の33行は全部
      // ロトム/ケンタロス種/ルガルガン等=旧データの名寄せ違いで季が付かなかっただけ。M-Aにいたかは推測になるので入れない)
      // ★R4修正(2026-09-03 実測): REGULATION が「次」(M-C)を指すようになってから、ここが次しか入れず
      //   68行(ロトム5姿/ケンタロス3種/ZAメガ24体/M-B追加メガ11体…)の seasons が ["M-C"] だけ=「M-Bでは使えない」の誤表示になっていた
      //   (公式M-B一覧 reference/_official_rosters/M-B.json にロトム/ケンタロス各姿が在る・旧Champions版にも居た行)。
      //   規則: champions_added_in が「次」でない行(null=最初から/現行で追加)は現行にも居る → 現行+次を累積で入れる。
      const addedInNext = REG_NEXT && x.champions_added_in === REG_NEXT;
      if (!addedInNext && REG_CURRENT && !x.seasons.includes(REG_CURRENT)) x.seasons.push(REG_CURRENT);
      if (!x.seasons.includes(REGULATION)) x.seasons.push(REGULATION);
      return;
    }
    if (!x.seasons.includes(x.regulation)) x.seasons.push(x.regulation);
    if (!x.champions_added_in) x.champions_added_in = x.regulation;
  });
  // ★R4(2026-09-03): seasons は「現行」と「次」だけ残す。終わったレギュは外す(履歴は reference/_legacy_seasons.json と git)。
  let seasonsTrimmed = 0;
  items.forEach(x => {
    if (!Array.isArray(x.seasons)) return;
    const t = x.seasons.filter(s => LIVE_REGS.includes(s)).sort((a, b) => LIVE_REGS.indexOf(a) - LIVE_REGS.indexOf(b));   // 順序=現行→次
    if (t.length !== x.seasons.length) seasonsTrimmed++;
    x.seasons = t;
  });

  // ★図鑑諸元の裏溜め(2026-09-03 阿部さん「既存のポケモンのデータは全部DBに入れておいて。次の更新でいちいち取ってこなくて済むように」)
  //   元=reference/_pokeapi_pokemon_raw.json(tools/_fetch_pokeapi_pokemon_raw.js・全1273件)。
  //   規律=出典の優先順位: Champions正典/監査確定の値(既に入っている欄)は**上書きしない**。空の欄だけ PokeAPI(最新世代)で埋め、
  //   埋めた欄名を provisional_fields に列挙する(=「最新世代からの暫定」の印。後でChampions/二重ソースで確定したら fixes で上書き→印が消える)。
  //   校正(2026-09-03 実測): Champions正典の重さ333/335がPokeAPIと一致(不一致2=イッカネズミ2形態はPokeAPI側の入れ違い・うち=ヤックン/ch/を保持)。
  //   ★特性は埋めない(ab1空の11体はPokeAPIも空=ZAメガ/M-C未発表。Wiki+Serebiiの二重一致で fixes に書く)。
  let pokeapiFilled = 0;
  try {
    const raw = J('reference/_pokeapi_pokemon_raw.json').items || {};
    let GENUS_WIKI = {}; try { GENUS_WIKI = J('reference/_pokemon_genus_wiki.json').items || {}; } catch (e) {}
    items.forEach(x => {
      const a = x.slug && raw[x.slug]; if (!a) return;
      const prov = [];
      const fill = (k, v) => { if (x[k] == null && v != null) { x[k] = v; prov.push(k); } };
      fill('weight_kg', a.weight_kg);
      fill('height_m', a.height_m);
      // 性別: PokeAPI gender_rate = -1(性別不明) / 0..8(♀が8分のN)
      if (x.gender_female_pct === undefined && a.gender_rate != null) {
        if (a.gender_rate < 0) { x.gender_female_pct = null; x.genderless = true; }
        else { x.gender_female_pct = a.gender_rate * 12.5; x.genderless = false; }
        prov.push('gender');
      }
      fill('genus_ja', a.genus_ja);
      // PokeAPIに日本語分類が無い(第九世代116種・2026-09-03実測) → ポケモンWikiの図鑑欄(reference/_pokemon_genus_wiki.json)で暫定補完
      if (x.genus_ja == null) { const sp = String(x.name).replace(/[（(].*$/, ''); const w = GENUS_WIKI[sp]; if (w) fill('genus_ja', w.genus_ja); }
      if (prov.length) { x.provisional_fields = [...new Set([...(x.provisional_fields || []), ...prov])]; pokeapiFilled++; }
    });
  } catch (e) {}

  items.sort((a, b) => (a.no || 9999) - (b.no || 9999) || String(a.name).localeCompare(String(b.name), 'ja'));

  write('pokemon.json', { meta: META('ポケモン', {
    provisional_fields: 'provisional_fields=PokeAPI(最新世代)から暫定で埋めた欄名(weight_kg/height_m/gender/genus_ja)。' +
      `Champions正典・監査確定の値は上書きしない。元=reference/_pokeapi_pokemon_raw.json。今回 ${pokeapiFilled} 件に暫定欄あり。` +
      '確定したら reference/_pokemon_fixes.json で上書き(fixesはこの埋めより先に走る=fixesで入れた欄は空でないので埋めず provisional にも載らない。第1例=2026-09-03 オーガポン♀100/イイネイヌ系♂100/カミッチュ4.4kg)。',
    note_field: 'note=備考(そのポケモンの特殊事情。見た目だけのフォルム違い/バトル中限定の姿など。元=reference/_pokemon_notes.json)',
    fixes: '監査確定の修正は reference/_pokemon_fixes.json(根拠つき)から適用',
    seasons_field: 'seasons=旧生成物pokechan_data_all.jsのPOKEMON_LIST.season(過去+現在のレギュ履歴配列)を' +
      `reference/_legacy_seasons.json から移送(段B資産②)。旧に対応行が無い/名前解決から漏れた行は` +
      `regulationがあれば[regulation]、無ければ[](推測で埋めない)。今回 ${seasonsFilled} 件がこのフォールバックで埋まった。` +
      `★R4(2026-09-03 阿部さん): seasons は現行と次(${LIVE_REGS.join('/')})の2枠だけ残す。終わったレギュを外した行=${seasonsTrimmed}件。`,
    regulation_model: `現行=${REG_CURRENT} / 次=${REG_NEXT || '(未発表)'}。champions:true の行の regulation は「内容を入れる先」=${REGULATION}(累積)。`,
    champions_added_in_field: '段C差し戻し対応(2026-09-01)資産⑥: champions_added_in=旧pokechan_data.js(Champions版)POKEMON_LIST[*].added_inを' +
      'reference/_legacy_pokemon_champions_added_inから移送。M-C予告分(regulation:M-C)は凍結に無いため直接"M-C"を入れる。',
  }), count: items.length,
    champions_count: items.filter(x => x.champions).length, items });
  return items.length;
}

// ══════════════════════════════════════════════════════════════════
// 5) learnsets.json(★没収技を confiscated として保持)
// ══════════════════════════════════════════════════════════════════
function buildLearnsets() {
  const authByOurs = {};
  AUTH.learnsets.pokemon.forEach(e => { if (e.matched_ours) authByOurs[e.matched_ours] = e; });
  const chKeyToName = {}; Object.entries(C.WAZA_MAP).forEach(([k, m]) => { chKeyToName[k] = m.name; });

  const items = C.POKEMON_LIST.map(p => {
    const au = authByOurs[p.name];
    const oursKeys = (C.POKEMON_WAZA && C.POKEMON_WAZA[p.name]) || null;
    const oursNames = oursKeys ? oursKeys.map(k => chKeyToName[k] || k) : null;
    // ★覚える技: 権威(Champions)を正典。無ければうちの既存
    //   ★ただし「権威の抽出が明らかにおかしい」時はうちを使う(2026-07-30 メタモンで発覚)。
    //     メタモンの権威ページは構造が違い、抽出器が「紫」「第1世代」「一般ポケモン」などを技名として拾っていた。
    //     判定=権威の技名がうちの技リスト(WAZA_MAP)に1つも無い → 抽出失敗とみなす。
    const authLooksBroken = (list) => {
      if (!list || !list.length) return true;
      const known = list.filter(n => Object.values(C.WAZA_MAP).some(m => m.name === n));
      return known.length === 0;                        // 1つも実在の技名でなければ抽出失敗
    };
    let learn, learnSrc;
    if (au && !authLooksBroken(au.learn)) { learn = au.learn; learnSrc = 'champions_authority'; }
    else if (oursNames) { learn = oursNames; learnSrc = au ? 'ours_champions(権威の抽出が壊れていたため)' : 'ours_champions'; }
    else { learn = unk('learnset', p.name, '権威の抽出が壊れており、うちにも学習データが無い'); learnSrc = 'unknown'; }
    // ★名前はポケモン本体(pokemon.json)と同じ正式名称に揃える(NAMEMAP)。
    //   これまで Champions表記(イダイトウ♂ 等)のままで、名前照合が30体分切れていた(2026-08-01 発見)
    const officialRow = NAMEMAP[p.name];
    const official = (officialRow && officialRow.official_name) ? officialRow.official_name : p.name;
    return Object.assign({
      slug: SLUGMAP[official] || SLUGMAP[p.name] || null,
      name: official, display_name: p.name, no: p.no != null ? Number(p.no) : null,
      learn: learn || [],
      confiscated: au ? (au.lost || []) : [],        // ★Championsで没収された技(ラボのON/OFF用)
      champions: true, regulation: REGULATION,
      authority_name: au ? au.name : null,
      ours_had: oursNames ? oursNames.length : 0,
    }, stamp(learnSrc));
  });
  // ★全国版(非Champions)の覚える技を追加(2026-08-01 阿部さん決定)
  //   目的=Championsに新ポケモンが追加されたら即対応できる下ごしらえ。
  //   出典=PokeAPI(tools/_fetch_national_learnsets.js の生データ)。canonルール②「無ければ最新世代」。
  //   ・learn        = その体が入っている最新の作品(version group)で覚えられる技
  //   ・learn_legacy = それより前の世代にしか無い技(★9世代までに廃止=含めて廃止マーク方式)
  //   ・Championsに追加されたら: 9世代との差分を champions_diff として記録→権威値で上書き(canonルール③)
  const nationalRows = buildNationalLearnsets(new Set(items.map(x => x.name)));
  const all = items.concat(nationalRows);
  // ★手動追加ポケモン(reference/_pokemon_additions.json)で learnset_from を持つ行は、その元の行を複写して1行足す
  //   (2026-09-01 新設・第1号=レギュM-C予告のメガシンカZ 3体)。メガシンカは元のポケモンと同じ技を覚える=
  //   既存の85メガ行のうち ルカリオ/アブソル/ガブリアス と各メガ行の learn が全一致することを確認して採った。
  //   Champions解禁後は権威(ヤックン/ch/)の値で上書き確認すること(canonルール③)。
  try {
    const adds = J('reference/_pokemon_additions.json');
    const have = new Set(all.map(x => x.name));
    (adds.items || []).filter(a => a.learnset_from && !have.has(a.name)).forEach(a => {
      const src = all.find(x => x.name === a.learnset_from);
      if (!src) { unk('learnset_from', a.name, '複写元 ' + a.learnset_from + ' の行が無い'); return; }
      all.push(Object.assign({}, src, {
        slug: a.slug || null, name: a.name, display_name: a.display_name || a.name, no: a.no != null ? a.no : src.no,
        learn: src.learn.slice(), confiscated: (src.confiscated || []).slice(),
        champions: !!a.champions, regulation: a.regulation || null, authority_name: null, ours_had: null,
        source: 'copied_from:' + a.learnset_from + '(メガシンカは元と同じ技。Champions解禁後に権威で確認)', verified_at: NOW,
      }));
    });
  } catch (e) {}
  write('learnsets.json', { meta: META('覚える技と没収技', {
    note: 'confiscated=Championsで没収された技。本番(リアルバトル)では出さない。ラボではON/OFFを選べる。',
    note_national: 'champions=false の行は PokeAPI由来の暫定(source=pokeapi_provisional)。learn=最新作品の技 / learn_legacy=過去世代のみ(廃止)。',
  }), count: all.length,
    champions_count: items.length,
    total_learn: all.reduce((s, x) => s + x.learn.length, 0),
    total_confiscated: all.reduce((s, x) => s + (x.confiscated || []).length, 0), items: all });
  return all.length;
}

// 全国版の覚える技(PokeAPI生データ → master行)。生データが無ければ空(段階導入)
function buildNationalLearnsets(championsNames) {
  let raw;
  try { raw = J('reference/_pokeapi_learnsets_raw.json'); } catch (e) { return []; }
  // version group → 順序(新しいほど大きい)。PokeAPIの版名
  const VG_ORDER = ['red-blue','yellow','gold-silver','crystal','ruby-sapphire','colosseum','xd','emerald',
    'firered-leafgreen','diamond-pearl','platinum','heartgold-soulsilver','black-white','black-2-white-2',
    'x-y','omega-ruby-alpha-sapphire','sun-moon','ultra-sun-ultra-moon','lets-go-pikachu-lets-go-eevee',
    'sword-shield','brilliant-diamond-and-shining-pearl','legends-arceus','scarlet-violet'];
  const vgRank = {}; VG_ORDER.forEach((v, i) => { vgRank[v] = i; });
  // 技slug → うちの技名(master moves)
  const moveJa = {}; // buildMoves と同じ元(全国版WAZA_MAP)から
  Object.entries(A.WAZA_MAP).forEach(([slug, m]) => { moveJa[slug] = zen2han(m.name); });

  // ★名前はslug経由で「いまの」master/pokemon.json から引く(取得時の名前は古くなり得る=名前替えに強く)
  let nameBySlug = {};
  try {
    const pk = JSON.parse(fs.readFileSync(path.join(OUT, 'pokemon.json'), 'utf8'));
    pk.items.forEach(p => { if (p.slug) nameBySlug[p.slug] = p.name; });
  } catch (e) {}

  const rows = [];
  Object.entries(raw.fetched || {}).forEach(([slug, d0]) => {
    const d = Object.assign({}, d0, { name: nameBySlug[slug] || d0.name });
    if (championsNames.has(d.name)) return;   // Champions行が正典(上書きしない)
    // その体が入っている最新の作品
    let latest = -1;
    (d.moves || []).forEach(mv => mv.vgs.forEach(v => { if ((vgRank[v] ?? -1) > latest) latest = vgRank[v]; }));
    const latestVg = latest >= 0 ? VG_ORDER[latest] : null;
    const learn = [], legacy = [], unmapped = [];
    (d.moves || []).forEach(mv => {
      const ja = moveJa[mv.move];
      const inLatest = latestVg && mv.vgs.includes(latestVg);
      if (!ja) { unmapped.push(mv.move); return; }   // うちの919技に無い(でっち上げない)
      (inLatest ? learn : legacy).push(ja);
    });
    rows.push({
      slug, name: d.name, display_name: d.name, no: d.no != null ? Number(d.no) : null,
      learn: learn.sort(), learn_legacy: legacy.sort(),
      unmapped_moves: unmapped.sort(),                  // 正直に残す(Zワザ等・後で精査)
      latest_version_group: latestVg,
      confiscated: [], champions: false, regulation: null,
      source: 'pokeapi_provisional', verified_at: NOW,
    });
  });
  return rows.sort((a, b) => (a.no || 9999) - (b.no || 9999) || String(a.name).localeCompare(String(b.name), 'ja'));
}

// ══════════════════════════════════════════════════════════════════
// 6) regulations.json
// ══════════════════════════════════════════════════════════════════
function buildRegulations() {
  // ★2026-09-01: 一覧は reference/_regulations.json が正(次のレギュ M-C の予告を持てるように)。無ければ従来の1件
  try {
    const reg = J('reference/_regulations.json');
    const items = (reg.items || []).map(r => Object.assign({}, r, { verified_at: r.verified_at || NOW }));
    if (items.length) {
      write('regulations.json', { meta: META('レギュレーション', { note: reg.rule || null }), count: items.length, items });
      return items.length;
    }
  } catch (e) {}
  const items = [{
    id: REGULATION, name: 'レギュレーション M-B', current: true,
    note: '現行レギュレーション。過去のレギュレーション(M-A等)は保持しない(後戻りしないため)。' +
          'リアルバトルは regulation===現行 のポケモン/技/持ち物だけを出す。',
    source: 'champions_authority', verified_at: NOW,
  }];
  write('regulations.json', { meta: META('レギュレーション'), count: items.length, items });
  return items.length;
}

// ── タイプ / 性格(★静的な参照表。2026-07-31 追加) ─────────────────
//   経緯: pokedb.js を master だけで動かそうとしたら、TYPES / TYPE_COLORS / NATURES が
//   master に無く、旧 pokechan_data.js を読むしかないことが判明した(=データが一つになっていない穴)。
//   ★中身は作らない・変えない。旧データに在るものを**そのまま移すだけ**。
function buildTypes() {
  const items = (C.TYPES || []).map((name, i) => ({
    index: i, name,
    color: (C.TYPE_COLORS || {})[name] || null,
    source: 'ours_champions', verified_at: NOW,
  }));
  // ★段B(計画_マスターからページへ流す_2026-09-01.md): 旧生成物にしか無い資産7項目の①。
  //   TYPE_KANJI/TYPE_DISPLAY/TYPE_OFFENSIVE_STATS/DEFAULT_TYPE_ORDER の静的4テーブルを追加する。
  //   ★中身は作らない・変えない。旧データに在るものをそのまま移すだけ(items配列と同じ流儀)。
  //   ★両ファイル(pokechan_data.js/pokechan_data_all.js)で完全一致を検証済み(2026-09-01)なので
  //   どちらから取っても同じ。Championsを基準側(C)に揃えて統一する。
  const tablesEqualToNational =
    JSON.stringify(C.TYPE_KANJI) === JSON.stringify(A.TYPE_KANJI) &&
    JSON.stringify(C.TYPE_DISPLAY) === JSON.stringify(A.TYPE_DISPLAY) &&
    JSON.stringify(C.TYPE_OFFENSIVE_STATS) === JSON.stringify(A.TYPE_OFFENSIVE_STATS) &&
    JSON.stringify(C.DEFAULT_TYPE_ORDER) === JSON.stringify(A.DEFAULT_TYPE_ORDER);
  if (!tablesEqualToNational) {
    unk('types_static_tables', 'TYPE_KANJI/TYPE_DISPLAY/TYPE_OFFENSIVE_STATS/DEFAULT_TYPE_ORDER',
      'pokechan_data.js と pokechan_data_all.js で値が食い違う(Championsの値を採用した)');
  }
  const tables = {
    TYPE_KANJI: C.TYPE_KANJI || {},
    TYPE_DISPLAY: C.TYPE_DISPLAY || {},
    TYPE_OFFENSIVE_STATS: C.TYPE_OFFENSIVE_STATS || {},
    DEFAULT_TYPE_ORDER: C.DEFAULT_TYPE_ORDER || [],
  };
  // ★2026-09-03: タイプ相性表を master に移送(4ページのインライン重複をなくす)。
  //   出所は reference/_type_chart.json(type_chart.html/battle_simulator.html/real_battle_simulator.html の
  //   3本のインライン const TYPE_CHART が完全一致することを検証済み・2026-09-03)。値は変えていない。
  //   order(C.TYPES と同じ並び)がずれていたら座標が全部ズレる事故になるので、ここで厳密検査する。
  let typeChart = null;
  try {
    const tc = J('reference/_type_chart.json');
    const orderOk = JSON.stringify(tc.order) === JSON.stringify(C.TYPES || []);
    const chart = tc.chart || [];
    const shapeOk = Array.isArray(chart) && chart.length === 18 && chart.every(row => Array.isArray(row) && row.length === 18);
    const validVals = new Set([0, 0.5, 1, 2]);
    const valuesOk = shapeOk && chart.every(row => row.every(v => validVals.has(v)));
    if (orderOk && shapeOk && valuesOk) {
      typeChart = chart;
    } else {
      unk('type_chart', 'reference/_type_chart.json',
        `検証失敗(order一致=${orderOk}/18x18=${shapeOk}/値∈{0,0.5,1,2}=${valuesOk})`);
    }
  } catch (e) {
    unk('type_chart', 'reference/_type_chart.json', `読み込み失敗: ${e.message}`);
  }
  if (typeChart) tables.TYPE_CHART = typeChart;
  write('types.json', { meta: META('タイプ(18)', {
    note: '★旧データからそのまま移送。値は変えていない。resist配列の並び順もこの index に対応する。' +
          ' meta.tables に静的4テーブル(TYPE_KANJI/TYPE_DISPLAY/TYPE_OFFENSIVE_STATS/DEFAULT_TYPE_ORDER)を格納' +
          '(items配列は18タイプの行データなので、items[].フィールドではなく meta 側に置いた)。' +
          `両ファイル(pokechan_data.js/pokechan_data_all.js)間で一致検証: ${tablesEqualToNational ? '一致(差分なし)' : '不一致(要確認・master/_unknowns.jsonに記録)'}。` +
          ' TYPE_CHART(攻撃タイプ=行/防御タイプ=列の倍率。出典=reference/_type_chart.json)も meta.tables に格納(2026-09-03)。',
    tables,
  }), count: items.length, items });
  return items.length;
}
function buildNatures() {
  const N = C.NATURES || {};
  const items = Object.entries(N).map(([name, v]) => Object.assign({ name }, v, {
    source: 'ours_champions', verified_at: NOW,
  }));
  write('natures.json', { meta: META('性格', { note: '★旧データからそのまま移送。値は変えていない。' }), count: items.length, items });
  return items.length;
}

// ── STAT_RANK(段B資産⑤・master には追加しない=computed) ─────────────────────
//   棚卸し(reference/_plans/棚卸し_生成物にしか無い資産_2026-09-01.md §「STAT_RANK」)の結論:
//   旧生成物のSTAT_RANKはmaster/pokemon.jsonの種族値(hp/atk/def/spatk/spdef/spd)から
//   Lv50計算式で完全再現できる=一意のコンテンツを持たない(masterに欄自体を足す必要が無い)。
//   ★検証済みの式(フシギバナ base_hp=80 → 187 で実測一致。2026-09-01):
//     HP実数値(Lv50・個体値31・努力値63):  hp_a  = floor((2*base_hp             + 31 + 63) * 0.5) + 60
//     HP以外の実数値(Lv50・個体値31・努力値63・性格補正なしの基準値):
//                                         stat_a = floor((2*base_stat           + 31 + 63) * 0.5) + 5
//     (性格上昇/下降がある場合は stat_a に ×1.1 / ×0.9 をかけてfloorする。旧STAT_RANKの各行は
//      性格ごとの実数値ではなく無補正の基準値+ランク(百分位)を持つ形だったため、生成器(段C)では
//      上式で実数値を出したうえで、同じ POKEMON_LIST 母集団内でのパーセンタイル順位を計算し直す
//      =rank自体は「どの集団を母数にするか」に依存するため、母集団の定義(全1219 or Champions313等)を
//      段Cで明示的に決めること。★旧STAT_RANKは実は1219件中275件(=Champions分のみ)しか埋まっておらず、
//      全国版専用ポケモンにはそもそも旧データにもrankが無かった=作り直しても「元の値の再現漏れ」にはならない)。

// ── 実行 ────────────────────────────────────────────────────────────
console.log('=== マスターデータ生成(master/) ===');
console.log('  ★既存ファイルは1バイトも変更しません。出力は master/ のみ。');
const n = {
  abilities: buildAbilities(), items: buildItems(), moves: buildMoves(),
  pokemon: buildPokemon(), learnsets: buildLearnsets(), regulations: buildRegulations(),
  types: buildTypes(), natures: buildNatures(),
};
fs.writeFileSync(path.join(OUT, '_unknowns.json'), JSON.stringify({
  note: '★決められなかった値の一覧。推測で埋めていない。ここを1件ずつ潰すのが次の作業。',
  generated_at: NOW, count: unknowns.length, items: unknowns,
}, null, 1) + '\n');
console.log('\n件数:', JSON.stringify(n));
console.log('★決められなかった値:', unknowns.length, '件 → master/_unknowns.json');
