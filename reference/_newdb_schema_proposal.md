# 新DBスキーマ案(設計提案のみ・実装しない)

- 依頼: claude-design → glm-impl (T17 / scratchpad_glm_queue_T13-T17.md)
- 位置づけ: 内部データ一本化(①)の土台設計。**器=全国版の範囲**、**中身(値)の正典=Champions**(`設計_データSSOT一本化` §9)。
- 新呼び名: 一本化した大本のデータ=**「マスターデータ」**。置き場は **`master/` ただ1つ**(`pokemon/moves/abilities/items/learnsets/regulations`)。
- 本提案は設計のみ。移行スクリプトの実装はしない(手順案のみ)。

---

## 0. 設計の北極星
1. **データは1本**(`master/`)。生成物(pokechan_data*.js 等)はすべて `master/` から派生し、**生成物をビルダの入力にしない**(現状の `build_master ↔ build_champions_view` 循環=T12-4・破綻の根因を断つ)。
2. **器=全国版**(1219体/919技/310特性/167持ち物)。**中身=Champions正典**。Championsに無い分は `source: gen9/gen8/...` で残し、`verified_at` で上書き順を明示。
3. **名前=正式名称**で持つ。**画面の短い名前は別欄 `display_name`**(阿部さん決定)。全角/半角・切り詰め・表記ゆれは**正規化ルール1件**で吸収し、二度と二度持たない。

---

## 1. 共通スキーマ(全エンティティ共通フィールド)

| フィールド | 型 | 内容 |
|---|---|---|
| `slug` | string(**キー**) | PokeAPI準拠の英語スラッグ(`thunder-punch`, `greninja-ash`)。**主キー=これ1つ**。Championsローマ字キー(`reitoupanchi`)は `_aliases` に退避。 |
| `name` | string | **正式名称**(全国版表記・例: `ニャオニクス(オスのすがた)` / `フラエッテ(えいえんのはな)`)。**正規化ルール適用済みの正**。 |
| `display_name` | string | **画面表示用の短縮名**(例: `ニャオニクス♂` / `フラエッテ(えいえん)`)。**現Champions表記を継承**。表示側はこちらを読む。 |
| `champions` | boolean | Championsに登場するか(器は全国版だが、実戦で使うのはこのフラグが true のもの)。`_truth_*` / `lists_ch` 由来。 |
| `source` | enum | `"champions" \| "gen9" \| "gen8" \| ...`。**値がどこ由来か**。後から上書きすべき所が分かる(Champions正典が最優先)。 |
| `verified_at` | string(ISO) | その値を最終確認した日付。stale 検出用。 |
| `_aliases` | string[] | 旧キー/別表記(Championsローマ字キー・ヤックンcorpus名等)。後方互換の参照専用。**突合には使わない**。 |

---

## 2. エンティティ別スキーマ

### 2.1 `master/pokemon.json`(器=全国版1219体・うちChampions実在=313)
- 共通 + `no`(図鑑番号・3桁), `is_default`, `is_mega`, `form_slug`, `types:[slug]`, `stats:{hp,atk,def,spatk,spdef,spd,total}`, `abilities:{1,2,hidden: ability_slug}`, `weight_kg`, `gen`, `legend`
- ★**`name`は正式名称で統一**(T16の37件の正規化を適用済み)。表示は `display_name`。
- ★**種族値はChampions正典優先**(T13:名前突合で一致297/値差0=Champions値が健全。全国版と完全一致)。

### 2.2 `master/moves.json`(器=全国版919技・うちChampions実在=497)
- 共通 + `move_no`, `type:slug`, `category`, `power`, `accuracy`, `pp`, `target`, **`priority`**(★1箇所に統一・下記§4), `contact`, `protect`, `flags:{}`, `tags:[]`, `battle_data:{effects:[],...}`, `description`, `description_legacy`, `national_new`(全国版にのみある新技フラグ)
- ★**技タグ**(`tags`)は「わざリストのフィルタ」と「ポケモンDB右側の技列」が**同じタグを見る**(=現状の169列の代わり。T14で列は捨て可を確定済)。
- ★全角/半角5件(T16③)は `name=正式(全国・全角)` / `display_name=現Champions(半角)` で解決。

### 2.3 `master/abilities.json`(310特性)
- 共通 + `effect_ja`(正典・Champions優先), `effect_en`, `is_original`(うちの独自定義か), `is_linked`
- ★Champions独自説明文5件(メイカー4+どくのトゲ=T12-3)は `source:"champions"` で**正として保持**(全国版公式文で上書きしない)。

### 2.4 `master/items.json`(167持ち物・うちChampions実在=75)
- 共通 + `category`, `effect`, `factor/q12`(倍率), `applies_to`(メガストーン=進化先poke slug), `mega_form`(メガ進化先slug), `implemented_in_pokechan`, `vp_cost`
- ★T16で**フラエッテナイトの到達不能は `name` 正規化で解消**(applies_to=`フラエッテ(えいえんのはな)`↔poke `name` 同じ)。ニャオニクスナイトも正式名決定後に解消。

### 2.5 `master/learnsets.json`(★新設・T18で照合)
- `pokemon_slug → { learn: [move_slug...], confiscated: [move_slug...] }`
- `learn`=覚える技、`confiscated`=**そのポケモンで(レギュレーション等で)没収された技**(T18: 権威 learnsets_ch 6628件対応)。
- ★これが現在の169フラグ列(T14で捨て可)の後継。**フラグ列は学習表から導出**=列を持たない。

### 2.6 `master/regulations.json`
- `name`(現行=`M-B`), `active_period`, `allowed:{pokemon:[slug], moves:[slug], items:[slug]}`, `current: true/false`
- ★`regulation` フラグは各エンティティではなく**ここに集約**(ポケモン/技/持ち物が現行M-Bで使えるかはこの表が唯一の正)。

---

## 3. 全角→半角の正規化ルール(1件・全エンティティ適用)
- **`name`(正式)は全国版(全角優先)を正とする**。`display_name`は現Champions(半角)を保持。
- 正規化関数(突合・重複排除用): 全角数字`０-９`→半角、全角英`Ａ-Ｚａ-ｚ`→半角、全角空白→半角。**これ1つでT16③の5件+将来の表記ゆれを吸収**。
- 突合は**`slug`(英スラッグ)が主**。名前での突合が必要な時だけ正規化関数を通す(番号は補助)。

---

## 4. `priority` の置き場所を1つに統一
- 現状: Champions版=`battle_data.priority`、全国版=最上位 `priority`(T12-1で検出=全492件がこの差でhit)。
- **新スキーマ: 最上位 `priority` のみ**(`move.priority`)。`battle_data` には置かない。ビルダは両経路の旧データを最上位に寄せて出力。

---

## 5. 移行スクリプト手順案(実装しない・箇条書き)
1. **入力は現SSOT素材のみ**(reference/master_*.json・abilities_desc_ja・moves_battle_data_fix・pokeapi_master・learnsets_master・_authority_corpus_ch)。**生成物(pokechan_data*.js)は入力にしない**(循環断絶)。
2. ポケモン: pokeapi_master(器1219)を軸に、Champions正典(lists_ch.stats・T13)の種族値を `source:"champions"` で上書き。`name`=正式・`display_name`=現Champions(T16)。
3. 技: 全国版(器919)が軸。★**コインビームは実在しない技(権威497/全国版/Wiki全てに存在せず・サーフゴーの専用技は「ゴールドラッシュ」)=阿部さん決定で削除・新DBに持ち込まない**。`priority`を最上位に寄せ。effects/flags/tags/description/description_legacy はそのまま運ぶ(作り直さない)。Champions独自説明文5件は正として保持。**どげざつきは実在するがChampions現レギュで没収→`learnsets.confiscated` に分類**(T18の6628件の例)。
4. learnsets: 権威 learnsets_ch(208体/12799件/没収6628)と現POKEMON_WAZAをT18で照合→`master/learnsets.json`。
5. 各エンティティに `champions`/`source`/`verified_at` を付与。
6. 派生ビルダ(champions_view/national_view/content/i18n)は**`master/` からの一方向生成**に切り替え(逆流禁止)。
7. **検証**: 既存4ハーネス(sim/sweep/hard/behavior)+ T12-T18 の _truth/_inv/_key_map で突合ゲート。

---

## 6. 未解決の設計判断(阿部さん判断が要るもの)
1. **メガフォーム**: ★**解決(阿部さん決定①)** — 独自メガの正式名=**うちの表記が正式**(権威ヤックンChampionsメガ一覧101件と一致: メガニャオニクス♂/♀・メガフラエッテも実在)。英slugのみ用意(`meowstic-mega-male` 等)・slug自作の必要なし。[_name_normalize.json unresolved_mega=0に解決済]
2. **特性説明文の正**: Champions独自短文5件(メイカー4+どくのトゲ)を正とするか、全国版(公式寄り)を正とするか(T12-3・T13で差)。本案は Champions独自=正(`source:"champions"`)を提案。
3. **没収技(confiscated)の範囲**: 権威 learnsets_ch の6628件が「レギュM-Bの没収」全域か、一部か(T18で精査予定)。
4. **`regulation` の多レギュ対応**: ★**解決(阿部さん決定④)** — 現行M-B 1本で始める(`regulations.json` は1レコード)。複数レコード化は実際に次レギュが出た時・それまで作り込まない。
5. **旧キー(ローマ字)の後方互換**: `_aliases` に残す期間(エンジン/i18nの参照切り替えが終わるまで)。

---

## 7. 参照(本提案の根拠)
- `設計_データSSOT一本化_2026-07-28.md`(§9器と中身 / §10失敗の記録 / §13技のグループ分け)
- T12-4(生成系I/O・master↔pokechan_data.js 循環), T13(_truth: 種族値0差・特性195文言差), T14(169列=捨て可), T15(_key_map), T16(_name_normalize 3型37件)
- `_authority_corpus_ch/`(Champions正典: abilities_ch 315 / moves_ch 497 / lists_ch items75+stats313 / learnsets_ch 208)
