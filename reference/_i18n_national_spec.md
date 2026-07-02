# 依頼(claude-design→glm-impl): 全国版セクション＋特性ページのi18n 9言語配線

## 目的
`ability_all.html` と `index.html`(全国版セクション)の未配線 data-i18n キー **10個**を、9言語すべてに追加する。既存キーは触らない。

## 追加先
`i18n/ui-ja.json` / `ui-en.json` / `ui-fr.json` / `ui-de.json` / `ui-es.json` / `ui-it.json` / `ui-ko.json` / `ui-zh-Hans.json` / `ui-zh-Hant.json` の **9ファイル全部**に同じキーで値を入れる。キーはドット区切り(`ability.col_no_title` など)＝JSONではネスト(`{"ability":{"col_no_title":"..."}}`)。既存の `ability` / `index` オブジェクトに追記(構造は既存キーに合わせる)。

## 追加する10キー(JA原文=正)
| キー | ja原文 |
|---|---|
| `ability.col_no_title` | No. |
| `ability.col_pokemon_title` | この特性を持つポケモン数 (クリックで一覧) |
| `index.section_national_heading` | 全国版(全部入り) |
| `index.section_national_sub` | ポケモンチャンピオンズだけでなく、これまでの全シリーズの全ポケモン・全わざ・全特性・全持ち物を収録した全部入り版。 |
| `index.card_national_pokedex_title` | 全国版ポケモン図鑑 |
| `index.card_national_pokedex_desc` | 全シリーズの全ポケモン(全国版)を種族値・タイプ・特性・わざで検索・閲覧。 |
| `index.card_national_moves_title` | 全わざリスト(全国版) |
| `index.card_national_moves_desc` | 全シリーズの全わざを収録。効果タグで「斬る技」「先制技」など細かく絞り込み。 |
| `index.card_national_items_title` | 全持ち物(全国版) |
| `index.card_national_items_desc` | 昔のシリーズも含めた全持ち物の効果・入手方法をカテゴリ別に一覧。 |
| `index.card_national_abilities_title` | 全特性一覧(全国版) |
| `index.card_national_abilities_desc` | 全シリーズの全特性(367)の効果と、その特性を持つポケモンを一覧で。 |

(※ `ability.col_pokemon`(所持ポケモン)は既に9言語あり=触らない。上のtitleは別キー。)

## 翻訳ルール(厳守)
- **公式語彙を使う**: 種族値=base stats/valeurs de base/Basiswerte/estadísticas base/statistiche base/종족값/种族值/種族值。タイプ相性/わざ/特性/持ち物なども既存 `ui-*.json` の対応語に合わせる(**サイト内で用語を統一**。既存キーの訳語を検索して流用)。
- **「全国版」= 全国図鑑(National)のニュアンス**。英語なら "National Dex" / "National (Complete) Edition" 等、各言語の図鑑用語に寄せる。
- **「斬る技」「先制技」= 公式技分類**: 英 slicing move / priority move。各言語の公式分類語を使う。既存 waza-list の該当訳があれば流用。
- **でっち上げ禁止**: 確信が持てない専門語は既存訳を検索して使う。無ければ言語QAできる範囲の自然な訳。プレースホルダはこの10キーには無い。
- 絵文字・記号は原文に無いので付けない(見出しの🌐はHTML側にある)。

## 完了後(必須)
1. 9ファイルすべてが**有効なJSON**であること(`node -e 'require("./i18n/ui-en.json")'` 等で確認)。
2. キー抜け0(10キー×9言語=90値すべて埋まっている)。
3. できたら agmsg で報告: `send.sh pchamdb glm-impl claude-design "i18n国別配線done: 10キー×9言語 追加・JSON妥当・キー抜け0"`。
4. **本番pushはしない**(ローカルのみ)。検証(実機/監査)は claude-design(私)が行う。
