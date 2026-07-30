# GLM作業キュー T13〜T17(内部データ一本化・**調査と表づくりのみ**)

送信元: claude-design → glm-impl
位置づけ: 全体の順番 **①内部データの一本化 → ②ページの参照元を pokedb.js へ → ③バトル作り直し** の **①**。
★**③バトルの修正は凍結中**。触らないこと。

## 大原則(全タスク共通・破ったら成果物は捨てる)
- ★**上から1本ずつ**。1本終わったら**その場でagmsg報告**(5行以内)→ 次へ。まとめて最後に報告しない。
- ★**全コマンドはフォアグラウンド同期実行**(run_in_background禁止)。止まらず完走。
- ★**本番データ・エンジン・HTMLは1バイトも変更しない**。`git add`/`commit`/`push` 禁止。
  書いてよいのは **各タスクで指定された出力JSON/MDだけ**。
- ★**全数**でやる。サンプルの「ほぼ同じ」は禁止。
- ★**推測で埋めるな**。分からなければ `"unknown"` / 「未確認」と正直に書く。
- ★引用・出典は**実在文字列のみ**(捏造厳禁)。
- 参照してよい前提資料:
  - `仕様書_サイト全体.md`(第1の軸=データベースは一つ)
  - `設計_データSSOT一本化_2026-07-28.md`(§9器と中身 / §10失敗の記録 / §13技のグループ分け)
  - `reference/_authority_corpus_ch/`(Champions正典: `abilities_ch.json` 315 / `moves_ch.json` 497 / `lists_ch.json`=道具75+種族値313体)
  - `reference/_inv1〜4_*.json`(棚卸し結果)

---

## T13: Champions正典 vs 現データ の全数照合(**新DBの中身の正解表**をつくる)
出力: `reference/_truth_abilities.json` / `_truth_items.json` / `_truth_stats.json`

技(`moves_ch.json` 497件)は照合済み(うちのChampions版と491/497一致・不一致5件)。**残り3種**をやる。

1. **特性**: `abilities_ch.json`(315件・うちChampions実在201) ↔ `pokechan_data.js` の `ABILITY_DESC`
   → 各件 `{name, champions_effect(権威原文), ours_desc, verdict:"一致"|"文言差"|"うちに無い"|"Championsに無い", champions_pokemon_count}`
2. **道具**: `lists_ch.json` の `items`(**75件**) ↔ `items_database.js`(うちは167件)
   → ★**Championsの道具は75件しかない**。うちの167件のうち**どれがChampions実在か**を判定する表を作る。
   → 各件 `{name, in_champions:true/false, champions_effect, ours_effect, verdict}`
3. **種族値**: `lists_ch.json` の `stats`(313体) ↔ `pokechan_data.js` の `POKEMON_LIST`
   → HP/攻/防/特攻/特防/素早/合計 を**全数比較**。`{no, name, field, champions_value, ours_value}` の不一致一覧。
   ★名前は「フラエッテ(えいえん)」等の**切り詰め17件**があるので、**図鑑番号(no)で突き合わせる**こと。

報告: `[T13 完了] 特性N件差 / 道具N件差 / 種族値N件差 / 一番危ないもの=… / 未確認=…`

---

## T14: 技のフラグ列169 ↔ POKEMON_WAZA の全数照合(**フラグ列を捨ててよいか確定**)
出力: `reference/_truth_move_flags.json`

`pokechan_data.js` の `POKEMON_LIST` 各件にある **169個の「その技を覚えるか」フラグ列**(`chouhatsu` `jikosaisei` `haneyasume` …)が、
**`POKEMON_WAZA`(覚える技)から完全に導出できるか**を **313体×169列=全数**で検証する。

- 各フラグ列がどの技名に対応するか(ローマ字→技名)の対応表も作る
- 不一致(フラグは立っているが `POKEMON_WAZA` に無い / 逆)を**全部列挙**
- 結論を `conclusion:"導出可能・列は捨ててよい"` or `"導出不能・理由…"` と明記

★これは `設計_データSSOT一本化` §13(ポケモンDB右側の技列がずれる問題)の根拠になる。

報告: `[T14 完了] 全数=313×169 / 不一致N件 / 結論=… / 未確認=…`

---

## T15: キー対応表(一本化の土台)
出力: `reference/_key_map.json`

**技**: Championsのローマ字キー(`reitoupanchi`)↔ 全国版の英語スラグ(`thunder-punch`)↔ 技名 ↔ `move_no`
**ポケモン**: Champions名 ↔ 全国版名 ↔ `no` ↔ (あれば)英語名
**特性 / 道具**: 同様に名前 ↔ (あれば)英語名

- 突き合わせは**名前と番号の両方**で行い、**どちらでも一致しないもの**を `unmatched` に全部出す
- ★Champions側にしか無いもの(メガ等)・全国版にしか無いものも**両方向で列挙**

報告: `[T15 完了] 技N件対応/未対応N / ポケモンN件対応/未対応N / 特性・道具… / 未確認=…`

---

## T16: 名前の正規化表(正式名称へ)
出力: `reference/_name_normalize.json`

`tools/_ssot_guard_test.js` が検出した**切り詰め17件**(`reference/_ssot_guard_report.json` の `G3_truncated_names`)を起点に、
**Champions名 → 正式名称** の対応表を作る。

- 各件 `{champions_name, official_name, source:"全国版"|"権威"|"unknown", affects:[…]}`
- ★`affects` には **その名前を参照している箇所**を挙げる(`items_database.js` の `applies_to`、`mega_form`、エンジン内の文字列比較、i18n辞書のキー等を**grepで実際に探す**)
- ★**ニャオニクス問題**: うちは `ニャオニクス♀`/`ニャオニクス♂`、全国版は `ニャオニクス(オスのすがた)`/`(メスのすがた)`。
  **どちらを正式名称とすべきかは判断が要る**ので、**両方の表記を並べて `decision_needed:true` にする**(勝手に決めない)。
- ★**到達不能のメガ2件**(フラエッテナイト・ニャオニクスナイト)が、この表で直るかどうかも書く。

報告: `[T16 完了] 正規化N件 / 判断待ちN件 / 参照箇所の総数N / 未確認=…`

---

## T17: 新DBのスキーマ案(**設計の提案のみ・実装しない**)
出力: `reference/_newdb_schema_proposal.md`

**器=全国版の範囲**(1219体/919技/310特性/167持ち物)、**中身(値)の正典=Champions** という形(`設計_データSSOT一本化` §9)で、
1件あたりどんな項目を持つべきかの**スキーマ案**を書く。

必ず含めること:
- **キーは英語スラグに統一**(PokeAPI準拠)
- **`champions: true/false`**(Championsに在るか)
- **`source: "champions" | "gen9" | "gen8" | …` と `verified_at`**(値がどこ由来か=後から上書きすべきものが分かる)
- **技のタグ**(わざリストのフィルタとポケモンDB右側の列が**同じタグを見る**ため)
- **`priority` の置き場所を1つに統一**(現状: Champions版は `battle_data.priority`、全国版は最上位 `priority`)
- 説明文(`description` / `description_legacy`)・`battle_data.effects` / `flags` は**そのまま運ぶ**(作り直さない)
- ★**移行スクリプトの手順案**も箇条書きで(実装はしない)

報告: `[T17 完了] スキーマ案=… / 未解決の設計判断N件(阿部さん判断が要るもの) / 未確認=…`

---

## 枠について
- あなたの**5時間枠**が上限に近づいたら、**キリのいい所で止めて報告**すること(書きかけを残さない)。
- 止まったら私(claude-design)が枠の回復後に再開の合図を出す。
