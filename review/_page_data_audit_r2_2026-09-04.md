# ページ由来のデータ監査 B-4 2周目(2026-09-04)

対象: 番人 `tools/_page_guard_test.js` の検査対象外(review/ 配下・_review/ 配下・tools/ の生成器・
`*_v2.html` 以外の補助ページ・online/ 等サブディレクトリ・root の `*.js` 部品)を全数走査。
1周目(2026-09-04 昼)は主要な公開ページ(root の本番html)を見た。本レポートはその続き=**新規の指摘のみ**を掘り下げ、
1周目で既に🙋に上がっている件は「既出」とだけ印を付ける。

**読むだけ・ファイルは書き換えていない。**

---

## ① 結論

- 新規に見つかった実害のある問題は**6件**(うち🔴高2件・🟠中3件・⚪低1件のオーファン群)。
  重い順トップ5:
  1. **🔴 `tools/_waza_list_confirm.js` が壊れている**(`reference/moves_master.json` を require しているが
     2026-07-31 に `reference/_old_master/` へ退避済み=存在しない → 実行すると即クラッシュ)。
     CLAUDE.md が「確認の場」と明記する **わざ説明文レビューの現行ツール**が今日から動かせない状態。
  2. **🔴 `tools/_gen_content_pages.js` が独自の TYPE_CHART(18×18)を直書き**(31〜43行目)。
     2026-09-03 にタイプ相性表を `master/types.json` 1本化した時(`a380b67b`)に見落とされた4本目の重複。
     content pages(pokemon/・ability/・move/・type/ 配下=1000ページ超)を作る生成器そのものなので、
     今後 master 側の値を直しても**このページ群だけ永遠に古い値のまま**になる(現状値は一致・実害はまだ無い)。
  3. **🟠 `tools/_build_master_admin.js` が壊れたまま**、`review/_master_pokemon.html`(5469行)/
     `_master_moves.html`(3819行)/`_master_items.html`(338行) を**2026-06-26で凍結**(SSOT統一=7/31より前の
     生データ)。ページ自体に「これは古い」の注記が無く、開くと現在の master と誤認しうる。
  4. **🟠 `tools/_build_new_moves_review.js` も壊れたまま**、`review/_new_moves_review.html`(4503行・
     2026-06-27生成で凍結)。役目は `waza_list_confirm.html` の「🆕新規」バッジに統合済み(コード上のコメントで確認)。
  5. **🟠 `tools/_fetch_pokeapi_varieties.js` に安全弁が無い**。同じ「旧マスターへの書き戻し」をする兄弟2本
     (`_fetch_pokeapi_masters.js`/`_fetch_pokeapi_learnsets.js`)は2026-07-31に `ALLOW_OLD_MASTER_WRITE=1`
     ガードが付いたのに、この1本だけ素通しで `reference/pokeapi_master.json`(旧マスターの紛らわしい置き場)を
     無条件に復活させられる。
  - ⚪ その他: 旧DB統一パイプライン(T1/T2)のオーファン生成器4〜5本(下記表参照)。呼び出し元が無いことは確認済み
    (require グラフ・package.json・shell/plistのどこからも参照なし)なので実害は今は無いが、動かない状態で
    tools/ に残り続けると次のセッションが「これが本物?」と誤解する典型パターン(CLAUDE.md 冒頭の番人設置理由そのもの)。

- **1周目からの繰り返し(既出・新規指摘なし)**: `ABILITY_TYPE_IMMUNITY`(pokemon_db_v9.html / pokemon_db_all_v9.html)・
  性格表(`NATURES_ARR`/`NATURE_LIST`)・`LEGACY_FORM_NAME`(real_battle.html/online_battle.html/battle_lab.html)・
  root本番ページの `pokechan_data*.js`/`items_database.js` 直読み17件(すべて `reference/_page_ledger.json`
  `allow_direct` に登録済み=③バトルエンジン作り直し待ちの既知債務。新規発見ではない)。

- **調べてクリーンだったもの**: root の `*.js` 部品8本(move_fx_map.js / battle_fx_cues.js / preset_builds.js は
  いずれも `tools/_build_*_js.js` が生成する正規のビュー。affiliate-config.js / onelink.js / ad-toggle.js /
  internal_home.js / fx_primitives.js はゲームデータを持たない純ユーティリティ)・`online/` 配下3ファイル・
  `tools/_content_i18n.js`(i18n/*.json を正しく読んでいる)・`_review/` 配下60ファイル(すべて2026年前半の
  一回限りの移行スクリプト/静的スナップショットで、現行パイプラインのどこからも参照されないことを確認済み。
  ただし `_review/items_database.json` という旧データの生コピーが1つ残っている=исторический・実害なし)・
  `content_samples/`(5ファイルの古いデザイン見本)・`review/db_rules.html` 等ルール文書系(文中で
  `master/*.json` のパスに言及しているだけで実際に fetch/require はしていない)。

---

## ② 全件表

| # | ファイル/行 | 何のデータ | 件数 | master のどれと重複 | 用途 | 状態/対処案 |
|---|---|---|---|---|---|---|
| 1 | `tools/_waza_list_confirm.js:424` `require('../reference/moves_master.json')` | 技の英語公式effect文(`effect_en`)を national_new 技の列に出すための逆引き表 | 919技分 | `master/moves.json`(ただし `effect_en` フィールド自体が現行masterに無い=移行漏れ) | `review/waza_list_confirm.html` を生成する**現行の確認ワークフロー本体**(CLAUDE.md 必読セットに明記) | 🔴壊れている(`node tools/_waza_list_confirm.js` は即 `MODULE_NOT_FOUND`)。**🙋対処要**: (a) `effect_en` を `master/moves.json` に正式フィールドとして足すか (b) 列自体を廃止するか (c) 専用の小さい参照ファイルを reference/ に残すか、方針決定が必要 |
| 2 | `tools/_gen_content_pages.js:31-43` | TYPE_CHART(18×18の直書き配列)+ TYPES名配列 | 18×18=324値 | `master/types.json` `meta.tables.TYPE_CHART`(2026-09-03 `a380b67b` で1本化したはずの表) | content pages(`pokemon/`・`ability/`・`move/`・`type/` 配下、全1000ページ超)の生成器 | 🔴値は現状一致(0行目・6行目を突き合わせ確認済み=まだ実害なし)だが、`a380b67b` が消したはずの重複の**取りこぼし**。master へ差し替えを推奨: `require('../master/types.json').meta.tables.TYPE_CHART` |
| 3 | `tools/_build_master_admin.js:5,13,95,160,163` | ポケモン/技/道具の裏管理ビュー全件 | 全ポケモン/全技/全道具 | 生成先 `review/_master_pokemon.html`(5469行)/`_master_moves.html`(3819行)/`_master_items.html`(338行) | review用(裏管理ダッシュボード) | 🟠生成器が `reference/{pokeapi,moves,items}_master.json` を読むが2026-07-31に `reference/_old_master/` へ退避済み=存在しない。3ページとも**2026-06-26で凍結**(SSOT統一より前のデータ、ページに古さの注記なし)。🙋削除 or `master/*.json` へ配線し直して再生成、方針待ち |
| 4 | `tools/_build_new_moves_review.js:5` `require('../reference/moves_master.json')` | 全国版新規445技のレビュー表(旧effect_en対比) | 445技 | `review/_new_moves_review.html`(4503行・2026-06-27で凍結) | review用(旧ワークフロー) | 🟠壊れている。役目は `waza_list_confirm.html` の「🆕新規」バッジに統合済み(`_waza_list_confirm.js` 内コメントで確認)。🙋削除候補 |
| 5 | `tools/_fetch_pokeapi_varieties.js:44-45` `fs.writeFileSync('reference/pokeapi_master.json', ...)` | PokeAPI全1302バラエティの多言語名(裏溜め) | 1302件 | `reference/_old_master/pokeapi_master.json`(退避済み) | 一回限りの取得スクリプト(i18n完全名修正2026-07-06で使用) | 🟠兄弟2本(`_fetch_pokeapi_masters.js`/`_fetch_pokeapi_learnsets.js`)は2026-07-31に `ALLOW_OLD_MASTER_WRITE=1` ガードが付いたのに、この1本だけ無条件で旧場所に書き戻せる。🙋同じ安全弁を追加、または `_fetch_pokeapi_pokemon_raw.js` に統合済みなら削除 |
| 6 | `tools/build_master.js:14-18` | 旧統一マスター生成器(T1)。`pokechan_data.js`+`reference/{pokeapi,moves,abilities,items}_master.json` を結合 | 全種 | 出力先 `reference/master_{pokemon,moves,abilities,items}.json`(退避済み=もう存在しない古い置き場) | 旧パイプライン(2026-07-01設計・`build_master_v2.js` に置き換え済み) | ⚪呼び出し元なし(package.json/シェル/plistどこからも参照なし)確認済み。動かすと即クラッシュ。🙋★凍結ヘッダ付与 or 削除 |
| 7 | `tools/build_national_view.js:26-29,52` | 旧全国版ビュー生成器(T2)。`reference/master_pokemon.json`等を直接require | 全種 | 同上(退避済み場所) | `tools/build_views.js` が同ロジックを移植済み(コード内コメント「build_national_view.js:221-252 を移植」で確認) | ⚪呼び出し元なし。🙋★凍結ヘッダ付与 or 削除 |
| 8 | `tools/build_champions_view.js:29-31` | 旧Champions版ビュー生成器(T2)。同上 | 同上 | 同上 | 同上(旧パイプライン) | ⚪呼び出し元なし。🙋★凍結ヘッダ付与 or 削除 |
| 9 | `tools/_qa_learnsets.js:4-6` | learnsets整合QA(read-only) | 全種 | `reference/{pokeapi,moves,learnsets}_master.json`(退避済み) | 旧QAツール | ⚪`tools/_learnset_vote.js`(Wiki×Bulbapedia×PokeAPI 3者投票・A3で使用中)に事実上置き換わっている。🙋★凍結ヘッダ or 削除 |
| 10 | `tools/_showdown_diff_test.js:23` | Showdown差分オラクル用の特性マスター参照 | 全特性 | `reference/abilities_master.json`(退避済み) | 差分テストハーネス(2026-07-02設計) | ⚪現行ゲート一覧(views_diff/ssot_guard/mc_engine_check/sim_test/i18n_audit/pdca_playwright)に含まれておらず、2026-07-02以降どのHANDOFFにも再登場なし=オーファン。🙋★凍結ヘッダ or 削除 |
| 11(既出) | `pokemon_db_v9.html` / `pokemon_db_all_v9.html` の `ABILITY_TYPE_IMMUNITY` | 特性→タイプ無効の事実表 | 数件(かたやぶり非対象等) | なし(masterに未収載の「事実の表」) | 本番ページ | 既出=1周目🙋#1(masterの「事実の表」第2号にしてよいか) |
| 12(既出) | `battle_simulator.html` の `NATURES_ARR` / `real_battle_simulator.html` の `NATURE_LIST` | 性格25種のUp/Down表 | 25件×2ファイル | `master/natures.json`(25件) | 本番ページ(バトル系) | 既出=1周目🙋#3。`party_checker.html` は `pokechan_data.js` の `NATURES` をそのまま使っており重複していないことを確認(誤って重複扱いしないよう明記) |
| 13(既出) | `real_battle.html`/`online_battle.html`/`battle_lab.html` の `LEGACY_FORM_NAME` | 旧フォーム名→正式名 対応表 | 33件×3ファイル | 名前正規化ロジック(master側に相当データなし) | 本番ページ(バトル系) | 既出=1周目🙋#3 |
| 14(既出) | root本番ページ17枚の `<script src="pokechan_data(_all)?.js">` / `items_database.js` 直読み | ビュー全体 | — | `pokechan_data.js`/`pokechan_data_all.js`/`items_database.js` | battle_lab/battle_simulator/damage_calc/fx_editor/online_battle/party_checker/pokemon_db_all_v9/pokemon_db_v9/real_battle/real_battle_simulator/speed_compare/suggest_lite/suggest_partner/waza-list*/`reference/_legacy_pages/ability_all_legacy_20260904.html` | **`reference/_page_ledger.json` の `allow_direct` に17件とも登録済み**=③バトルエンジン作り直しまでの既知債務。新規指摘ではない | — |
| 15(クリーン) | `_review/` 配下60ファイル(py39+html5+その他) | 2026年前半の一回限り移行スクリプト・静的スナップショット | — | — | 過去のワークフロー(Excel/CSV変換等) | 現行の `tools/*.js`・ドキュメントのどこからも参照されていないことを確認(唯一の参照は `tools/_build_items_list.js` のコメント内=「旧は`_review/items_database.json`だったが切替済み」)。`_review/items_database.json`(123,798バイト・2026-07-18)という旧データの生コピーが1つ残るが、読まれていないので実害なし |
| 16(クリーン) | root `*.js` 部品8本(move_fx_map.js/battle_fx_cues.js/preset_builds.js/affiliate-config.js/onelink.js/ad-toggle.js/internal_home.js/fx_primitives.js) | — | — | — | 前3本は `tools/_build_*_js.js` が生成する正規ビュー(手書きでない)。残り5本はゲームデータを持たない純UI/アフィリエイトユーティリティ | 問題なし |
| 17(クリーン) | `online/`(rb_online.js・supabase-config.js・test_connection.html) | — | — | — | オンライン対戦の接続設定 | ゲームデータの直書きなし。問題なし |
| 18(クリーン) | `tools/_content_i18n.js` | 生成専用の固定UIラベルのみ | — | `i18n/*.json`(正しく読んでいる) | content pages生成の多言語アクセサ | 問題なし |
| 19(クリーン) | `review/db_rules.html`・`rules.html`・設計/仕様doc系15ファイル(1周目grep該当分) | master/reference のファイルパスへの**文中言及**のみ | — | — | ルール文書・設計資料 | 実際の fetch/require は無いことを1件ずつ確認済み。誤検知として除外 |

---

## ③ 番人(`tools/_page_guard_test.js`)拡張の提案(検出を増やす方向のみ)

現状のG1は「`.html` ファイルが `<script src>`/`fetch()`/`document.write` で
`pokechan_data*.js` / `items_database.js` / `master/*.json` を**読み込む**行為」しか見ていない。
今回見つかった問題は**すべてこの網の外**だった。具体的な穴と拡張案:

- **A. 直書き「事実の表」検出**: `master/` 以外・生成物(`pokechan_data*.js`/`items_database.js`/content pages)
  以外のファイルで、`TYPE_CHART` / `ABILITY_TYPE_IMMUNITY` / `NATURE(S)?_(ARR|LIST|TABLE)` /
  `LEGACY_FORM_NAME` のような「事実の表」識別子を**新規に定義**していたら赤くする(既知6箇所は許容リストへ)。
  → これがあれば `tools/_gen_content_pages.js` のTYPE_CHART重複を初日に検出できていた。
- **B. 旧マスター参照検出**: `tools/**/*.js` を対象に追加し、`reference/_old_master/README.md` が挙げる
  10ファイル名(`moves_master.json`/`pokeapi_master.json`/`items_master.json`/`abilities_master.json`/
  `learnsets_master.json`/`master_pokemon.json`/`master_moves.json`/`master_abilities.json`/
  `master_items.json`/`_verify_master.json`)への `require`/`readFileSync` を、安全弁
  (`ALLOW_OLD_MASTER_WRITE`のような明示ガード)が同じファイルに無い限り赤くする。
  → 今回の🔴🟠5件・⚪4件をまとめて検出できる。
- **C. 走査対象の拡張**: G1の `handmadePages()` は `.html` のみを歩く。`tools/**/*.js` と root直下の `*.js` も
  対象に加える(現状は完全に対象外)。
- **D. 死んだ生成器のスナップショット化警告**: Bで赤くなった生成器が過去に `review/*.html` を出力していた場合、
  そのページの最終git更新日を突き合わせて「このページは壊れた生成器の産物・最終生成から◯日経過」と表示する
  (今回 `_master_pokemon.html` が2.5ヶ月前で凍結していると気づくのに手作業の `git log` が要った)。

いずれも**基準を上げて通す方向ではなく、検出を増やす方向のみ**(CLAUDE.mdの規律どおり)。

---

## ④ 🙋阿部さんの判断が要る点

1. **`tools/_waza_list_confirm.js` の `effect_en` 列をどう直すか**: (a) `master/moves.json` に `effect_en`
   フィールドを正式追加する (b) 確認ビューからその列を廃止する (c) 小さい参照ファイル(例
   `reference/_moves_effect_en.json`)を残す、のどれにするか。これが決まるまで
   `review/waza_list_confirm.html` は再生成できない(今あるファイルは動く直前の最後のスナップショットのまま)。
2. **`tools/_gen_content_pages.js` のTYPE_CHART直書きを `master/types.json` 参照に差し替えてよいか**
   (値は現状一致・挙動不変のはずだが、content pages 1000枚超の再生成を伴う変更なので確認)。
3. **`review/_master_pokemon.html`/`_master_moves.html`/`_master_items.html`(裏管理3ページ・2026-06-26で
   凍結・SSOT統一前のデータ)を削除するか、`master/*.json` 直読みに作り直すか**。
4. **`review/_new_moves_review.html` と生成器 `tools/_build_new_moves_review.js` を削除してよいか**
   (役目は `waza_list_confirm.html` の🆕新規バッジに統合済みと判断)。
5. **旧DB統一パイプラインのオーファン生成器5本**(`build_master.js`/`build_national_view.js`/
   `build_champions_view.js`/`_qa_learnsets.js`/`_showdown_diff_test.js`)を、B-3で他の凍結生成器にやったのと
   同じ「★凍結ヘッダ」付与にするか、削除するか。
6. **`tools/_fetch_pokeapi_varieties.js` に兄弟2本と同じ安全弁を足すか、削除するか**(現状だと実行時に
   旧マスターの紛らわしい置き場を無警告で復活させてしまう)。
7. **`_review/` 配下60ファイル(2026年前半の使用済み移行スクリプト・`items_database.json`旧コピー含む)を
   アーカイブ/削除するか、記録として残すか**(CLAUDE.md「いきなり消さない」の原則もあるので判断を仰ぐ)。

---

*作成: B-4 2周目監査(読み取り専用・ファイル変更なし)。次の一歩は上記🙋の返答を待ってから実施。*
