# HANDOFF: データアーキテクチャ (Single Source Of Truth)

最終更新: 2026-05-21
ステータス: 🟢 運用中 (一部統一作業中)

---

## 🎯 大原則 1: データの正確性

**ポケモンに関する全データは、必ず公式ソースで確認したものを使用する**。憶測・自分勝手な命名・記憶ベースのデータは禁止。

### 過去の事故例 (絶対に繰り返さない)
- **2026-05-19**: `kaifuku_no_kona` という架空 key を hp_drain カテゴリに記載 → 実際は `leftovers`/`shell_bell`
- **2026-05-06**: ブリジュラスのタイプを「でんき/ドラゴン」と主張 → 実際は「はがね/ドラゴン」
- **2026-05-17**: 未実装メガ 21 種記載が約 1 ヶ月で陳腐化、10 種は既に新実装
- **2026-05-21**: NATURES (性格) 議論で公式確認せず「両方持つ案」を提案 → ユーザーから「公式調べて一本化しろ」と指摘

### 公式ソース優先順位

| 優先 | ソース | 用途 |
|---|---|---|
| 1 | **PokeAPI** (https://pokeapi.co) | 機械可読、9言語、種族値・タイプ・性格・特性・わざ・持ち物すべて |
| 2 | **マスターDB** (`pokechan_data.js`) | pokechan サイトの SSOT |
| 3 | **Serebii / Game8** | チャンピオンズ固有情報 |
| 4 | **アルテマ** | チャンピオンズ未実装一覧 |
| 5 | **Bulbapedia** | CC BY-NC-SA、転載不可だが答え合わせ用 |

### 検証フロー (必須)

データ追加・記載が必要 → **まず公式で確認** → 不明なら**調査タスク化、勘で書かない** → ソースを `source:` フィールドに記録

---

## 🎯 大原則 2: データ重複の禁止 (Single Source Of Truth)

**サイト内でデータベースの重複は禁止**。各データ種別には「正本（マスター）」が 1 つだけ存在し、各 HTML / ページは `<script src>` 経由で参照する。

新しいページ・機能を追加する際は、必ずこの一覧を確認し、マスターを参照すること。
**ページ内に独自データ配列 (`const POKEMONS = [...]` 等) を埋め込まないこと**。

---

## 📁 マスターデータ一覧 (Single Source Of Truth)

| データ種別 | マスターファイル | 変数名 / 構造 | 件数 (目安) |
|---|---|---|---|
| **ポケモン基本** (no, name, form, mega, type, 種族値) | `pokechan_data.js` | `POKEMON_LIST` / `DATA` | ~170 + メガ60 |
| **わざマスター** (name, type, power, accuracy, pp 等) | `pokechan_data.js` | `WAZA_MAP` (内部キー=ローマ字) | ~482 |
| **ポケモン→わざ習得** | `pokechan_data.js` | `POKEMON_WAZA` | - |
| **特性** (説明文) | `pokechan_data.js` | `ABILITY_DESC` | ~192 |
| **わざタグ** (分類用、検索用) | `pokechan_data.js` | `WAZA_TAG_DB` | - |
| **タイプ** (18種) | `pokechan_data.js` | `TYPES` / `TYPE_COLORS` / `TYPE_KANJI` / `TYPE_OFFENSIVE_STATS` / `TYPE_DISPLAY` | 18 |
| **ステランク** | `pokechan_data.js` | `STAT_RANK` | - |
| **持ち物** (マスター) | `_review/items_database.json` | - | 132+ (2026-05-21 拡張予定) |
| **持ち物** (ランタイム配信) | `items_database.js` | `window.ITEMS_DATABASE` (auto-generated from JSON) | - |
| **性格** (25種) | ⚠️ **2026-05-21 統合予定**: `pokechan_data.js` の `NATURES` (予定) | - | 25 |
| **状態異常** | (要追加調査・統一) | - | ~20 |
| **i18n 翻訳辞書** (9言語) | `i18n/{lang}.json` | items / ui / genera / natures / status / targets | 130+ ui keys |
| **i18n ランタイム** | `i18n/runtime.js` | `I18N` グローバル | - |

---

## 📂 HTML / JS 依存関係 (2026-05-21 時点)

| HTML | 依存する .js | 用途 |
|---|---|---|
| `pokemon_db_v9.html` | pokechan_data.js, i18n/runtime.js, ad-toggle.js | ポケモン図鑑 |
| `party_checker.html` | pokechan_data.js, items_database.js, i18n/runtime.js, ad-toggle.js | パーティチェッカー |
| `battle_simulator.html` | pokechan_data.js, items_database.js | ダメ計算シミュレータ |
| `real_battle_simulator.html` | pokechan_data.js, items_database.js | (開発ストップ中、battle_simulator のコピー) |
| `type_chart.html` | i18n/runtime.js, ad-toggle.js | タイプ相性表 (タイプ定数はインライン保持、小さいため例外OK) |
| `waza-list.html` | pokechan_data.js, waza_picker.js, i18n/runtime.js, ad-toggle.js | わざ一覧 |
| `index.html` | i18n/runtime.js, ad-toggle.js, affiliate-config.js, onelink.js | トップページ |

---

## 🛡️ 運用ルール

### 新規ページを追加するとき

1. **必要なデータ種別を上記マスター表から特定**
2. そのマスターファイルを `<script src>` で参照
3. ❌ HTML 内にポケモン・わざ・特性等の配列を直接書かない
4. もしマスターに無い新規データがある場合は、まず `pokechan_data.js` か新しい `*_database.json` に追加してから参照する

### データを更新するとき

1. **必ずマスターを更新**。派生ファイル (items_database.js 等) は再生成する
2. 更新前にバックアップ（`bak/*.{timestamp}.bak.*`）
3. items_database.json → items_database.js の自動生成スクリプト: 要場所確認 (TODO)

### 国際化 (i18n) との関係

- 翻訳辞書: `i18n/{lang}.json` (ja/en/de/es/fr/it/ko/zh-Hans/zh-Hant)
- ランタイム: `i18n/runtime.js`
- 現状の key 設計: マスターの日本語名 (例: `items["たべのこし"] = "Leftovers"`)
- 将来案: PokeAPI スラッグ key 統一（互換性のため当面は日本語名 key 継続）

---

## 🚧 既知の重複 (未統一・要解消)

| 項目 | 重複箇所 | 統一方針 | 期限 |
|---|---|---|---|
| 性格 (NATURES) | `battle_simulator.html` / `real_battle_simulator.html` / `party_checker.html` で `const NATURES = [...]` 重複 | `pokechan_data.js` に集約、各 HTML から削除 | **2026-05-21** 着手 |
| 状態異常 (STATUS) | 複数 HTML で個別マッチ → 詳細調査必要 | (今後判断) | 未定 |

---

## 📜 履歴

- **2026-05-06**: `pokechan_data.js` を SSOT として確立 (POKEMON_LIST / DATA / WAZA_MAP / ABILITY_DESC / TYPES)
- **2026-05-16**: `items_database.js` を `items_database.json` から自動生成、両 HTML 共有開始
- **2026-05-21**: サイト全体のデータ重複監査実施。性格データの重複を発見、統一作業着手予定。本ドキュメント新設。

---

## 🔗 関連 HANDOFF

- `HANDOFF_INDEX.md` — 全 HANDOFF の索引
- `HANDOFF_I18N.md` — i18n 多言語化の進捗
- `HANDOFF_I18N_IMPLEMENTATION.md` — runtime.js 実装側
- `HANDOFF_ITEM_RESEARCH.md` — 持ち物データ収集
- `HANDOFF_C5_ITEM_INTEGRATION.md` — battle_simulator フェーズC-5 持ち物統合
