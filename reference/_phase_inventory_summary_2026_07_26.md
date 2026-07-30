# フェーズインベントリ抽出 P1 サマリ（機械作業・判断なし）

- 依頼: claude-design → glm-impl (`scratchpad_glm_task_phase_inventory.md`)
- 出力JSON: `reference/_phase_inventory_2026_07_26.json`
- 実行: `node tools/_build_phase_inventory.js`

## 件数表

| 項目 | 件数 |
|---|---|
| 技(全部版 WAZA_MAP) | 919 |
| 　うち effects 非空配列 | 866 |
| 　うち effects 配列で無い | 0 |
| 　うち effects == [] | 53 |
| effect instance 総数 | 1170 |
| **effect kind 数** | **140** |
| 特性(全部版∪Champions) | 309 |
| 　全部版のみ | 114 |
| 　Champions版のみ | 0 |
| 　両ファイルで説明文が異なる | 0 |
| **持ち物** | **169** |
| エンジン特性照合: 抽出名(候補)数 | 65 |
| エンジン特性照合: 総ヒット数 | 92 |
| エンジン特性照合: unlisted(文字列引数取れず) | 64 |

## エンジン *Ability*( 系 関数別 呼び出し件数

| 関数 | 件数 |
|---|---|
| sideAbility | 112 |
| defAbilityVs | 24 |
| hasAbilityShield | 10 |
| fireEntryAbility | 4 |
| renderAbilitySelect | 2 |
| dummyAbilityList | 2 |
| attachAbilityChange | 2 |

## 抽出できなかった・想定と違った箇所（正直な列挙）

- effect の深い階層に kind が見つかった: 2件（nested_kinds に格納。本集計はトップレベル kind のみ）
- effect kind の phase 集計は effect 直下の .phase のみ。phase 無しは __no_phase__ として集計。
- 特性説明文: 全部版とChampions版で別物の可能性があるため両方を別々に保持（desc_differs_between_files に機械的差分ありの名前を列挙）。
- 全部版にのみ存在する特性: 114件
- 持ち物: items_database.js の items 配列(169件想定)を全フィールドそのまま収録。implemented_in_pokechan 等のフラグもrawに含む。
- エンジン特性照合: *Ability*( 系7関数の呼び出し行を走査。最初の文字列リテラル引数を「特性名候補」とした（変数引数や複雑な式は unlisted）。
- エンジン注意: 文字列リテラル引数が必ず特性名とは限らない（defAbilityVs 等でカテゴリ/タイプ文字列の可能性）。名前解決は設計側で要確認。
- エンジン注意: 本抽出は real_battle_simulator.html のみ。battle_simulator.html 等の別エンジンは対象外。

## 代表的な effect kind（上位10・参考）

| kind | 技数 | instance数 | phase分布 | fields数 |
|---|---|---|---|---|
| 能力ランク変化 | 209 | 228 | on_use:222 this_turn:3 turn_end:2 __no_phase__:1 | 24 |
| 状態付与 | 157 | 158 | on_use:140 lasting:11 delayed:5 this_turn:2 | 30 |
| 必中 | 82 | 100 | on_use:97 lasting:3 | 5 |
| 威力倍率 | 57 | 57 | on_use:41 this_turn:16 | 6 |
| 回復 | 28 | 38 | on_use:32 delayed:3 turn_end:2 lasting:1 | 17 |
| 威力可変 | 36 | 36 | on_use:36 | 23 |
| 状態異常回復 | 30 | 35 | on_use:33 delayed:2 | 7 |
| 連続攻撃 | 32 | 32 | on_use:32 | 10 |
| 急所率上昇 | 29 | 30 | on_use:27 lasting:3 | 7 |
| みがわり貫通 | 20 | 20 | on_use:20 | 2 |

(全kindの一覧・fields詳細・特性/持ち物全文はJSON参照)