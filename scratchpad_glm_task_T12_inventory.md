# GLMタスク T12: 現状把握(データ資産の全数棚卸し)— **調査のみ・修正禁止**

送信元: claude-design → glm-impl
目的: データを**一本化して引っ越す**前に、**「失ってはいけない情報」を全部リスト化**する。
★背景: 本日 `build_champions_view` を素で回すと**説明文が5件静かに消える**ことが判明した(どくのトゲ/メイカー4種)。**同種の"片方にしか無い資産"が他にもあるはず**。それを全部出すのがこのタスク。

## 大原則(破ったら成果物は捨てる)
- ★**調査のみ。1バイトも修正するな**。`git add`/`commit`/`push` 禁止。書いてよいのは下記の出力JSONだけ。
- ★**全コマンドはフォアグラウンド同期実行**(バックグラウンド待ち禁止)。止まらず完走。
- ★**全数**でやる。サンプルの「ほぼ同じ」は禁止(今日それで痛い目を見ている)。
- ★**推測で埋めるな**。分からなければ `"unknown"` と書く。
- ★1本終わるごとに**agmsgで5行以内の報告**(まとめない)。

## 対象(この4本を順に。1本ずつ)

### 棚卸し1: `reference/_inv1_field_gap.json` — 項目(フィールド)の差
`pokechan_data.js`(Champions) と `pokechan_data_all.js`(全国版) を **node で require して**比較する。
- **ポケモン**: 双方の1件が持つキーの集合を出し、**片方にしか無いキー**を全部挙げる。
  ★Champions側には `chouhatsu` `jikosaisei` `haneyasume` など**「その技を覚えるか」のフラグ列が150以上**ある。**全部列挙**し、`learners`/`POKEMON_WAZA` から**再現可能かどうか**を1件サンプルで検証して書く(再現できるなら引っ越しで捨てられる)。
- **技**: 同様(全国版だけが持つ `priority` `tags` `availability` `national_new` など)。
- 出力: `{entity, only_in_champions:[...], only_in_national:[...], reproducible_from:{key:"…"}, note}`

### 棚卸し2: `reference/_inv2_value_gap.json` — 値の差(同じものが違う値になっていないか)
- **技**: 名前(`name`)で突き合わせる(★キー体系が違う=Championsは `reitoupanchi` 形式のローマ字、全国版は `karate-chop` 形式の英語スラグ。**キーでは突き合わない**)。
  比較する項目: `power / accuracy / pp / type / category / target / priority / contact / protect / flags / battle_data.effects / description / description_legacy`
  → **値が違うものを全部**列挙(項目ごとに旧値/新値)。
- **ポケモン**: 名前で突き合わせ、`type1/type2/種族値6/total/ab1-3/weight_kg/form/mega` を比較。
  ★**名前が一致しない313体中68体**があるはず。**その一覧も出す**(切り詰め・表記ゆれの検出が目的。例: 「フラエッテ(えいえん)」vs「フラエッテ(えいえんのはな)」)。
- **特性の説明(ABILITY_DESC)**: 両方にあるキーで**文言が違うもの**を全部。
- 出力: `{entity, name, field, champions_value, national_value}` の配列。

### 棚卸し3: `reference/_inv3_handmade_assets.json` — 手で作り込んだ資産の在り処
「機械で再生成できない=失ったら二度と戻らない」情報を洗い出す。
- 技の `description`(うちの独自説明文)/`description_legacy`/`battle_data.effects`/`flags`/`tags`
- 特性の `ABILITY_DESC`
- **どのファイルが"最新の正"を持っているか**を、ファイルの更新日時と中身の両方で判定して書く。
- ★特に「**生成物にしか無い**(SSOT `reference/master_*.json` に無い)」ものを**必ず特定**する。これが引っ越しで消える候補。
- 出力: `{asset, lives_in:[files], count, only_in_generated:true/false, risk:"高/中/低", note}`

### 棚卸し4: `reference/_inv4_builders.json` — 生成系の入出力表
`tools/` の中で **データを生成・変換するスクリプト**を全部洗い、**入力→出力**を表にする。
- 最低限: `build_master.js` / `build_champions_view.js` / `build_national_view.js` / `_build_pokechan_data_all.js` / `_gen_content_pages.js` / `build_i18n_pages.js` / `_build_moves_db_all.js` / `_build_pokemon_db_all.js`
- 各スクリプトについて: `{script, inputs:[...], outputs:[...], last_run_evidence, circular:true/false, note}`
- ★**循環(生成物→SSOT の逆流)しているもの**に必ず `circular:true` を立てる。
- ★**出力が古いまま止まっているもの**(例: `pokechan_data.new.js` は7/4で停止)も記録。

## 報告フォーマット(1本ごと・5行以内)
`[T12-n 完了] <棚卸し名> / 出力=<ファイル> / 件数=N / 一番危ないもの=… / 未確認=…`

## 参考(読んでよい)
- `設計_データSSOT一本化_2026-07-28.md`(現状の実測・配線図)
- `review/データ配線_現状調査_2026-07-28.html`(全4,999ページの走査結果)
- `HANDOFF_SESSION_2026_07_28_PART2.md`(§4=土台の破綻)
