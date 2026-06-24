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
const L = require(path.join(ROOT, 'i18n', 'content-ui.json'));

function T(lang, key) {
  const e = L[key];
  if (!e) throw new Error('content_i18n: unknown label key: ' + key);
  return e[lang] != null ? e[lang] : (e.en != null ? e.en : e.ja);   // 未訳は en→ja フォールバック
}

module.exports = { LANGS, NONJA, dict, ui, tPoke, tType, tAbName, tAbDesc, T, L };
