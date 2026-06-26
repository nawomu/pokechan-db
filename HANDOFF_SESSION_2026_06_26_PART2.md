# HANDOFF — 2026-06-26 PART2(全国版DB＝共通SSOT 1本化・全部入りページ・新技445の説明/タグ/確認ビュー合流)

最終更新: 2026-06-26 JST。前半(裏マスター裏溜め・全部入りDB初版)= `HANDOFF_SESSION_2026_06_26.md`。**本書はその続きセッション(別 /clear)**。
**引き継ぎ必読: CLAUDE.md → 本書 → `次回ここから.md` → `ヤックン耳_判断ログ.md`**。

> ⚠️ **このセッションの成果は全部ローカル・未公開(未commit/未push)。本番反映は阿部さんの確認OK後。**

---

## 0. 一言サマリ
「**大元のデータを1本だけ作り、全画面はそこから描画(ハードコード禁止)・今後の追加はデータに足すだけ**」(阿部さん指示)を実装。**共通SSOTアダプタ `pokechan_data_all.js`** を新設し、既存ページ(v9/waza-list)のクローンに食わせて**全国版(全1219ポケ・937技)**を、**既存CSS/デザインそのまま**で作った。新技445には**マザー流の説明文**と**構造化タグ(battle_data)**をダイナミックワークフローで生成。新技を**確認ビューに合流**(M-A/M-B/🆕新規を季列で区分)。

---

## 1. ★確立した運用ルール(全国版DB・不変)

### R1. 共通SSOT 1本化(最重要)
- **大元 = `reference/*.json`**(PokeAPI由来・9言語名つき): `pokeapi_master.json`(1302 variety)/`moves_master.json`(937)/`items_master.json`(2180)/`abilities_master.json`(367)/**新規 `learnsets_master.json`**(variety slug→move slug[])。
- **アダプタ = `tools/_build_pokechan_data_all.js` → `pokechan_data_all.js`**: 大元から `pokechan_data.js` と**同一schema**(POKEMON_LIST/DATA/WAZA_MAP/POKEMON_WAZA/TYPES/NATURES/ABILITY_DESC…)を生成。全国版の各ページはこれを `<script src>` で読むだけ。
- **運用**: 新ポケ/技が出たら ①`_fetch_pokeapi_*.js`(masters/varieties/learnsets)再生成 → ②`_build_pokechan_data_all.js` 再生成 → ③**HTMLは無変更**(src参照だけ)。ページのハードコード変更ゼロ=これが達成形。

### R2. 既存デザインのクローン方式
- 本番ページを**コピーして1行差し替え**(`pokechan_data.js`→`pokechan_data_all.js`)だけで全国版にする。CSS/JSは触らない。`pokemon_db_all_v9.html`(v9形)/`waza-list_all.html`(waza-list形)。
- 共有ファイル(`waza_picker.js`)を触る時は**ガード**(本番waza-listに影響しない条件)を入れる。例: `national_new` は本番データに無=常にfalse。

### R3. 見た目だけのフォームは間引く
- 「種族値+タイプ+特性が基本形と同一」or キャップ/コスプレ/トーテム/gmax/starter のフォームは**全国版から除外**(1302→1219)。`subcatFromTags`の前にある `isCosmetic()`。メガ/リージョン/ロトム等「中身が違う」フォームは残す。

### R4. Generation と Season は別項目(裏で両方管理)
- **Generation(Gen1〜9)**: dex由来。全ポケにあり。表記は**翻訳不要(Gen1等)**。ポケモンDBの「Gen」列で表示。
- **Season(M-A/M-B)**: Champions のシーズン(「使える季・複数可」)。Champions名簿に名前一致した分だけ。**裏(データ)に持つが全国版テーブルには出さない**(非Championsは空で大半が空列になるため)。本番Champions DB(`pokemon_db_v9.html`)には **SSN列**として表示(全行に値=映える)。

### R5. 伝説区分マーク
- **出典**: PokeAPI species の `is_legendary`/`is_mythical`(`i18n/cache/species/*.json`)+ **禁止級(Restricted)は固定リスト**(`reference/legend_status.json` 生成器内の25 dex)。
- **3区分**: 禁止級伝説(Restricted)/準伝説(Sub-Legendary)/幻(Mythical)。
- **マーク**: JA=**禁/準/幻**、英語+多言語=**R/S/My**(MythicalのMはメガと被るので My)。**ポケモン名列でなく「型」列**(メガ M と併存)に表示+型フィルタに選択肢追加。

### R6. タグ/グループは battle_data の effects から(手で並べない)
- CLAUDE.md原則。新技445は**ダイナミックWFで構造化effects(状態付与/能力ランク変化/急所/連続/反動/回復/設置/フィールド…)を生成** → `reference/moves_tags.json` → アダプタ `bdFromTags()` で battle_data 化 → 既存タグエンジンが自動でタグ化。

### R7. 説明文はマザーリスト(公開waza-list)のスタイルに合わせる
- マザー(本番 `pokechan_data.js` の description)は**簡潔技術スタイル**: 自身/敵・〜化(こおり化)・確率N%で・**ダメージのみ**/**ダメージ。{効果}**・N段階上昇/低下・分数(1/3, 最大HP/8)。
- ※これは CLAUDE.md北極星(子ども口調)とは**別系統**。全国版リファレンスは**マザー流に統一**(2026-06-26 阿部さん確定)。声の最終判定は阿部さんの耳。

### R8. PDCA(画面確認)を毎回。本番は確認後
- 変更後は**Playwright実機でJSエラー0・件数・描画・操作を確認してから報告**(中身=効果列が埋まってるか等の内容まで見る。JSエラー0だけで「できた」と言わない=このセッションで一度失敗を指摘された)。
- 全部ローカルで確認 → **阿部さんOK後に commit→push**。

---

## 2. このセッションでやったこと(成果物)

### A. スプライト ローカル同梱(本番安定化)
- `images/poke/`(全1302枚・PokeAPI由来)を並列curlでDL→ローカル参照に。`pokemon_db_all.html` の SPRITE()差替。**※既にcommit済(d4df30a)**。
- `images/item/`(862枚・道具スプライト)も同様DL(未commit)。

### B. 全部入りページ(独自ダークテーマ・初版)
- `pokemon_db_all.html`(1302→Gen/タイプ/種族値/検索)・`moves_db_all.html`(937技)・`items_db_all.html`(2180道具)。生成器 `tools/_build_{moves,items}_db_all.js`。
- ※後に「既存v9デザインで」の要望でメインは下記Cに移行。これらは参照用に残す。

### C. ★共通SSOT + 全国版(v9/waza-listデザイン)= 本命
- `reference/learnsets_master.json`(`tools/_fetch_pokeapi_learnsets.js`・QA `tools/_qa_learnsets.js`)。
- `pokechan_data_all.js`(`tools/_build_pokechan_data_all.js`・QA `tools/_qa_pokechan_all.js`): POKEMON_LIST 1219 / WAZA_MAP 937 / POKEMON_WAZA / resistはタイプ相性表から計算 / 490curated層(説明/battle_data/体重/subcategory)をオーバーレイ。
- `pokemon_db_all_v9.html`(v9クローン): **Gen列**(No-名前間)・**伝説バッジ(型列)**・見た目フォーム間引き・**死に技列(0learner 115技)除外**・**わざ列順=変化→物理→特殊に修正**・新技の暫定subcategory導出。
- `waza-list_all.html`(waza-listクローン): 937技・**🆕新規追加のみフィルタ**(ツールバー)・新技にマザー流説明+構造化タグ。

### D. 新技445の説明/タグ(ダイナミックWF)
- `reference/moves_ja_desc.json`(445技・マザー流説明・WF再生成済)。
- `reference/moves_tags.json`(445技・効果分類→battle_data素・WF)。
- `reference/legend_status.json`(伝説区分83体)。

### E. 本番Champions DB
- `pokemon_db_v9.html` に **SSN列(M-A継続/🆕M-B)** 追加(No-名前間・色チップ・絞込)。本番waza-list等は無影響。

### F. 確認ビュー(阿部さん用)に新技合流
- `review/waza_list_confirm.html`(`tools/_waza_list_confirm.js`): 全国版新技445を合流。**季列で3区分(M-A/🆕M-B/🆕新規)**・新技は効果列=マザー流説明/ヤック列=公式effect(en)・専用セクション「🆕新技(全国版追加)」+効果カテゴリにも混在・**右端「確認OK」チェック列(localStorage記録)はそのまま**。
- `review/_new_moves_review.html`(`tools/_build_new_moves_review.js`): 新技445だけの単体レビュー(新版↔en・チェック列)。

---

## 3. ★後でやること(順番が大事)
1. **新技445の effects/タグ/説明を阿部さんが確認・確定**(場 = `review/waza_list_confirm.html` の🆕新規 / `review/_new_moves_review.html`)。声・分類の最終判定は人間の耳。
2. → **waza-list全部版のグループ分けを確定**(新技のグループ分けは現状**暫定=自動導出**。メモリ [[national-moves-grouping-todo]])。
3. → **ポケモンDBわざ列の subcategory を正式化**(`subcatFromTags` を確定分類に差し替え)。順番=waza-list確定→ポケモンDB追従。
4. **コミット→本番公開**(pchamdb.com)。全部版の公開導線(index→全国版)も。
5. 後回し: 全部版の **9言語i18n**(現状ja+en・名前混在) / 道具を既存デザインに / **sim全部版**(937技の battle_data 整備=別スプリント)。

---

## 4. 主要ファイル早見(このセッション)
| 用途 | ファイル |
|---|---|
| 共通SSOTアダプタ | `tools/_build_pokechan_data_all.js` → `pokechan_data_all.js` |
| learnset取得/QA | `tools/_fetch_pokeapi_learnsets.js` / `_qa_learnsets.js` / `_qa_pokechan_all.js` |
| 全国版ポケDB(v9形) | `pokemon_db_all_v9.html` |
| 全国版わざリスト | `waza-list_all.html`(+ `waza_picker.js` に national_new配線) |
| 新技 説明/タグ/伝説 | `reference/{moves_ja_desc,moves_tags,legend_status,learnsets_master}.json` |
| 確認ビュー(合流) | `review/waza_list_confirm.html` ← `tools/_waza_list_confirm.js` |
| 新技単体レビュー | `review/_new_moves_review.html` ← `tools/_build_new_moves_review.js` |
| 本番Champions DB | `pokemon_db_v9.html`(SSN列追加) |

ローカル確認: `python3 -m http.server 8000`。言語固定キー= localStorage `pchamdb.lang`。
