/* コンテンツ静的ページ(pokemon/ability/type)生成用の i18n 表＋アクセサ。
 * データ(名前/効果/タイプ/分類)は SSOT の i18n/*.json から引く。ここにあるのは
 * 「生成専用の固定UIラベル」だけ(見出し・表ヘッダ・パンくず等)。runtime.js は読まない=
 * ビルド時に静的化(案A・SEO)。法務フッタは ja 維持(2026-06-24 決定)。
 *
 * ★ラベルは段階導入: まず ja/en を完成。他言語は en にフォールバック(未訳は英語表示)→
 *   順次 fr/de/es/it/ko/zh-Hans/zh-Hant を埋める。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const LANGS = ['ja', 'en', 'fr', 'de', 'es', 'it', 'ko', 'zh-Hans', 'zh-Hant'];
const NONJA = LANGS.filter(l => l !== 'ja');

// --- SSOT 辞書ロード ---
const dict = {}; const ui = {};
for (const l of LANGS) {
  if (l === 'ja') continue;
  try { dict[l] = require(path.join(ROOT, 'i18n', l + '.json')); } catch (e) { dict[l] = {}; }
  try { ui[l] = require(path.join(ROOT, 'i18n', 'ui-' + l + '.json')); } catch (e) { ui[l] = {}; }
}

// --- エンティティ・アクセサ(ja は素通し / 非ja は辞書、無ければ ja フォールバック) ---
const _name = (e, ja) => (e == null ? ja : (typeof e === 'string' ? e : (e.name || ja)));
function tPoke(lang, ja) { if (lang === 'ja') return ja; return _name(dict[lang].pokemon && dict[lang].pokemon[ja], ja); }
function tType(lang, ja) { if (lang === 'ja') return ja; const t = dict[lang].types && dict[lang].types[ja]; return t || ja; }
function tAbName(lang, ja) { if (lang === 'ja') return ja; return _name(dict[lang].abilities && dict[lang].abilities[ja], ja); }
// 特性の効果文: ja=独自(ABILITY_DESC を呼び元で渡す) / 非ja=PokeAPI short_effect(無ければ ja)
function tAbDesc(lang, ja, jaDesc) {
  if (lang === 'ja') return jaDesc;
  const e = dict[lang].abilities && dict[lang].abilities[ja];
  return (e && typeof e === 'object' && (e.short_effect || e.desc)) || jaDesc;
}

// --- 固定UIラベル表(生成専用) ---
// 値が {n}/{x}/{t} を含むものはテンプレ(呼び元で replace)。
const L = {
  // 共通
  home:            { ja:'ホーム', en:'Home' },
  unofficial_note: { ja:'⚠️ 当サイトは非公式ファンサイトです', en:'⚠️ This is an unofficial fan site.' },
  related:         { ja:'関連', en:'Related' },
  none:            { ja:'なし', en:'None' },
  ad_pr:           { ja:'広告 / PR', en:'Ad / PR' },
  ad_aria:         { ja:'広告', en:'Advertisement' },
  unknown:         { ja:'不明', en:'Unknown' },
  // 特性
  ability_list:        { ja:'特性一覧', en:'Ability List' },
  ability_list_h1:     { ja:'特性(とくせい)一覧', en:'Ability List' },
  ability_list_lead:   { ja:'ポケモンが持つ「特性」全{n}種類の効果をまとめました。特性をえらぶと、くわしい効果と、その特性を持つポケモンが見られます。', en:'Effects of all {n} Abilities. Pick an Ability to see its detailed effect and the Pokémon that have it.' },
  ability_owners:      { ja:'この特性を持つポケモン({n})', en:'Pokémon with this Ability ({n})' },
  ability_no_owner:    { ja:'(このDB内に該当ポケモンなし)', en:'(No Pokémon in this DB.)' },
  ability_back:        { ja:'← 特性一覧へ戻る', en:'← Back to Ability List' },
  ability_title:       { ja:'{x}(特性)の効果と覚えるポケモン｜PchamDB', en:'{x} (Ability) — Effect & Pokémon with it | PchamDB' },
  ability_desc_meta:   { ja:'特性「{x}」の効果。{d} この特性を持つポケモン一覧も掲載。', en:'The Ability "{x}": {d} See the list of Pokémon with this Ability.' },
  ability_list_title:  { ja:'特性(とくせい)一覧 全{n}種｜PchamDB', en:'Ability List — All {n} Abilities | PchamDB' },
  ability_list_desc:   { ja:'ポケモンの特性{n}種類の効果一覧。各特性の効果と、その特性を持つポケモンを確認できます。', en:'A list of all {n} Pokémon Abilities and their effects, plus the Pokémon that have each one.' },
  // ポケモン
  pokemon_list:        { ja:'ポケモン一覧', en:'Pokémon List' },
  pokemon_list_lead:   { ja:'登録されている全{n}体のポケモン。<b>見出しをおすと並び替え</b>、<b>タイプをおすと絞り込み</b>できます。名前をおすと、そのポケモンの弱点・特性・覚える技が見られます。', en:'All {n} Pokémon in the database. <b>Click a header to sort</b>, <b>click a type to filter</b>. Click a name for its weaknesses, Abilities and learnable moves.' },
  pk_search_ph:        { ja:'🔎 名前でしぼりこむ(ひらがな・カタカナ)', en:'🔎 Filter by name' },
  pk_all:              { ja:'すべて', en:'All' },
  pk_count_unit:       { ja:'体', en:'' },     // 「N 体」/ en は「N」
  base_stats:          { ja:'種族値', en:'Base Stats' },
  stat_hp:             { ja:'HP', en:'HP' },
  stat_atk:            { ja:'こうげき', en:'Attack' },
  stat_def:            { ja:'ぼうぎょ', en:'Defense' },
  stat_spatk:          { ja:'とくこう', en:'Sp. Atk' },
  stat_spdef:          { ja:'とくぼう', en:'Sp. Def' },
  stat_spd:            { ja:'すばやさ', en:'Speed' },
  stat_total:          { ja:'合計', en:'Total' },
  col_no:              { ja:'No.', en:'No.' },
  col_name:            { ja:'なまえ', en:'Name' },
  col_type:            { ja:'タイプ', en:'Type' },
  col_ability:         { ja:'特性', en:'Ability' },
  col_ability_hint:    { ja:'(乗せると説明)', en:'(hover for details)' },
  col_hp:              { ja:'HP', en:'HP' },
  col_atk:             { ja:'こう', en:'Atk' },
  col_def:             { ja:'ぼう', en:'Def' },
  col_spatk:           { ja:'特こう', en:'SpA' },
  col_spdef:           { ja:'特ぼう', en:'SpD' },
  col_spd:             { ja:'すば', en:'Spe' },
  col_total:           { ja:'合計', en:'Tot' },
  type_matchup:        { ja:'タイプ相性(弱点・耐性)', en:'Type Matchups (Weaknesses & Resistances)' },
  abilities_h:         { ja:'特性', en:'Abilities' },
  learnable_moves:     { ja:'覚える技', en:'Learnable Moves' },
  other_forms:         { ja:'別のすがた:', en:'Other forms:' },
  weight:              { ja:'重さ', en:'Weight' },
  weak_4x:             { ja:'4倍ダメージ(大きな弱点)', en:'4× damage (major weakness)' },
  weak_2x:             { ja:'2倍ダメージ(弱点)', en:'2× damage (weakness)' },
  weak_half:           { ja:'0.5倍(半減)', en:'0.5× (resisted)' },
  weak_quarter:        { ja:'0.25倍(とても効きにくい)', en:'0.25× (very resisted)' },
  weak_zero:           { ja:'効果なし(無効)', en:'No effect (immune)' },
  no_move_data:        { ja:'(このDB内に技データなし)', en:'(No move data in this DB.)' },
  mv_sort:             { ja:'並び順:', en:'Sort:' },
  mv_sort_kind:        { ja:'種類順(物理→特殊→変化)', en:'By kind (Phys→Spec→Status)' },
  mv_sort_power:       { ja:'威力', en:'Power' },
  mv_sort_acc:         { ja:'命中', en:'Acc' },
  mv_sort_pp:          { ja:'PP', en:'PP' },
  mv_sort_name:        { ja:'名前', en:'Name' },
  mv_filter:           { ja:'しぼりこみ:', en:'Filter:' },
  mv_all_types:        { ja:'全タイプ', en:'All types' },
  mv_all_cats:         { ja:'全分類', en:'All categories' },
  mv_col_name:         { ja:'技名', en:'Move' },
  mv_col_type:         { ja:'タイプ', en:'Type' },
  mv_col_cat:          { ja:'分類', en:'Class' },
  mv_col_power:        { ja:'威力', en:'Power' },
  mv_col_acc:          { ja:'命中', en:'Acc' },
  mv_col_pp:           { ja:'PP', en:'PP' },
  cat_phys:            { ja:'物理', en:'Physical' },
  cat_spec:            { ja:'特殊', en:'Special' },
  cat_stat:            { ja:'変化', en:'Status' },
  pokemon_title:       { ja:'{x}(No.{no})の種族値・弱点・特性・覚える技｜PchamDB', en:'{x} (No.{no}) — Base Stats, Weaknesses, Abilities & Moves | PchamDB' },
  pokemon_desc_meta:   { ja:'{x}({t})の種族値・タイプ相性(弱点)・特性・覚える技の一覧。', en:'Base stats, type matchups (weaknesses), Abilities and learnable moves of {x} ({t}).' },
  pokemon_list_title:  { ja:'ポケモン一覧 全{n}体(種族値ソート・タイプ絞り込み)｜PchamDB', en:'Pokémon List — All {n} (sort by stats, filter by type) | PchamDB' },
  pokemon_list_desc:   { ja:'ポケモン{n}体の種族値・タイプ一覧。種族値で並び替え、タイプで絞り込みできます。各ポケモンの詳細(弱点・特性・覚える技)へ。', en:'Base stats and types of {n} Pokémon. Sort by stats, filter by type. Links to each Pokémon (weaknesses, Abilities, moves).' },
  // タイプ
  type_chart_nav:      { ja:'タイプ相性表', en:'Type Chart' },
  type_h1:             { ja:'{x}タイプ', en:'{x} type' },
  type_attacking:      { ja:'攻撃するとき({x}の技で攻める)', en:'When attacking (with {x} moves)' },
  type_defending:      { ja:'守るとき({x}タイプが受ける)', en:'When defending (as a {x} type)' },
  type_super:          { ja:'ばつぐん(2倍)', en:'Super effective (2×)' },
  type_notvery:        { ja:'いまひとつ(0.5倍)', en:'Not very effective (0.5×)' },
  type_no:             { ja:'効果なし', en:'No effect' },
  type_weak:           { ja:'弱点(2倍)', en:'Weak to (2×)' },
  type_resist:         { ja:'半減(0.5倍)', en:'Resists (0.5×)' },
  type_immune:         { ja:'効果なし(無効)', en:'No effect (immune)' },
  type_owners:         { ja:'{x}タイプのポケモン({n})', en:'{x}-type Pokémon ({n})' },
  type_title:          { ja:'{x}タイプの相性・ポケモン一覧｜PchamDB', en:'{x} Type — Matchups & Pokémon | PchamDB' },
  type_desc_meta:      { ja:'{x}タイプの弱点・耐性・攻撃相性と、{x}タイプのポケモン一覧。', en:'Weaknesses, resistances and offensive matchups of the {x} type, plus all {x}-type Pokémon.' },
  // フッタのリンクラベル(法務本文は ja 維持)
  foot_home:    { ja:'ホーム', en:'Home' },
  foot_making:  { ja:'制作の裏側', en:'Behind the scenes' },
  foot_terms:   { ja:'利用規約', en:'Terms' },
  foot_privacy: { ja:'プライバシーポリシー', en:'Privacy Policy' },
  foot_disc:    { ja:'免責事項', en:'Disclaimer' },
  foot_contact: { ja:'お問い合わせ', en:'Contact' },
  foot_sitemap: { ja:'サイトマップ', en:'Sitemap' },
  site_tagline: { ja:'ポケモンチャンピオンズ 非公式ファンデータベース', en:'Unofficial Pokémon Champions Fan Database' },
};

function T(lang, key) {
  const e = L[key];
  if (!e) throw new Error('content_i18n: unknown label key: ' + key);
  return e[lang] != null ? e[lang] : (e.en != null ? e.en : e.ja);   // 未訳は en→ja フォールバック
}

module.exports = { LANGS, NONJA, dict, ui, tPoke, tType, tAbName, tAbDesc, T, L };
