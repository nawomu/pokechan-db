# GLMタスク T2: 全国版 ABILITY_DESC の空き特性説明を公式JAで補完(素材収集済み)

送信元: claude-design → glm-impl
方針: 特性説明は**公式準拠(PokeAPIのJA effect/flavor)=独自化不要**(CLAUDE.md「特性(ABILITY_DESC)は公式準拠なのでそのまま可」)。声の判断は不要=機械的な充填。**本番commit/pushはしない**(全国版SSOT編集は阿部さん報告とセットの運用=私が検証後に報告→阿部さんOKでcommit)。

## 背景・素材
- 全国版DBに新しく入った特性は `ABILITY_DESC`(全国版SSOT `pokechan_data_all.js`・ビルダー `tools/build_master.js` 経由)が**空/欠け**のものがある(Champions分しか埋まっていなかった残り)。ポケモンDBの特性ポップアップで説明が出ない。
- 収集済み素材: **`reference/_ability_desc_fill_2026-07-19.json`**(`entries[]` = {name_ja, slug, desc_ja(PokeAPI公式JA), version_group})。

## やること
1. まず現状把握: `pokechan_data_all.js` の `ABILITY_DESC` と、ビルダー `tools/build_master.js`(特性masterの生成箇所)を読んで、**ABILITY_DESCがどこで/どのキーで注入されるか**を特定する(slug結合 or JA名結合か)。パイプラインの正しい注入点=ビルダー入力(reference/*)を使い、生成物を手書きしない(effects→compose一方通行と同じ思想=ソースを直す)。
2. 素材 `_ability_desc_fill_2026-07-19.json` の各エントリを、**説明が空/欠けの特性にだけ**充填する(既に説明がある特性は**上書きしない**=Champions既存訳を壊さない)。結合はslug優先(JA名は表記ゆれで危険)。
3. 再ビルドして `ABILITY_DESC` に説明が入ること・**既存の説明が1件も変化しないこと**(充填は空欄のみ)を差分で確認。

## 検証(全部確認してから報告)
- **回帰ゲート**(全国版sim系が壊れてないこと): `node tools/_sim_sweep_all.js`(919/0)・`node tools/_sim_behavior_all.js`(現状維持)・`node tools/_sim_test.js`(823/2=T185d既知)。※特性説明は表示用データなのでsim挙動には影響しないはず=回帰0が期待値。
- **充填結果**: 何件を新規充填したか / 充填後もまだ空のままの特性が残るか(残るならその特性名リスト=素材に無い分)。
- **既存不変**: 充填前に説明があった特性の説明が1件も変わっていないこと(diffで確認)。
- **英語漏れ0**: 充填したdesc_jaにPokeAPIの英語が混ざっていないこと(たまにPokeAPIのJAキャッシュが英語fallbackのことがある=見つけたら報告、勝手に自作翻訳しない=でっち上げ禁止)。

## 制約(厳守)
- 触ってよいのは **ビルダー入力(reference配下)とビルダー(tools/build_master.js)、および再ビルドで生成される全国版データ**まで。手書きで生成物を直接編集しない(ソースを直して再ビルド)。
- **本番push/commit/git addしない**(SSOT編集は阿部さん報告とセット=claude-designが検証→阿部さんへ報告→OKでcommit)。
- 声/口調の判断はしない(公式JAをそのまま使う)。判断に迷う所(素材に無い特性・英語fallback・結合できないslug)は**勝手に埋めず報告**。
- 完了報告に: ①新規充填件数 ②まだ空の特性リスト ③既存不変の確認 ④回帰ゲート数値 ⑤触ったファイル/行 を含める。
