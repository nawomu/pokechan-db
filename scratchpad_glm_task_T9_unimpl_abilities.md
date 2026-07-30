# GLMタスク T9: Champions保持なのに未実装の特性を「パターン単位」で実装(第1波)

送信元: claude-design → glm-impl
背景: T6の全数照合で、**Championsロスターのポケモンが持っているのにエンジン未実装(=本番で無言の不発)の特性が60件**判明。
本タスクは**実装パターンが既存機構と同型の"軽い群"**から刈る。**1件ずつ権威裏取り**は不変。

## 大原則(破ったら成果物は捨てる)
- ★権威(ポケモンWiki日本 https://wiki.pokemonwiki.com/wiki/<特性名> / Bulbapedia)を**実際にWebFetchで読んでから**実装。引用は**実在文字列のみ**(捏造厳禁)。
- ★**うちのABILITY_DESC原文も必ず読む**(`pokechan_data.js`/`pokechan_data_all.js`)。Champions独自仕様があればそちらが優先。食い違えば**実装せず報告**。
- ★**ランク変化を伴うものは必ず共有パイプライン `applyRankStageGuarded` 経由**(直接 `st.rank.X` を書かない=かそくで実際にバグった轍)。
- ★**かたやぶり**の影響を受けるか(受け側特性なら `defAbilityVs` 経由か)を必ず判定。
- 変更は最小限・**出典コメント必須**(file:line に権威URLと引用)。**commit/push/git add しない**。

## 実装対象(第1波・パターン別。1パターンずつ順に)

### パターンA: post_hit_react(被弾後の反応)= 既存の さめはだ/せいでんき と同型
`phaseDealDamage` の接触反応ブロック(L3076-3142付近)に追加する。**接触限定か非接触も含むか**を権威で必ず確認。
- ぎゃくじょう / じきゅうりょく / えんかく / すなはき / とびだすハバネロ / ほうし / さまようたましい / マジシャン(この2つは相手の特性/持ち物を書き換える=S07/S08相当・慎重に)

### パターンB: ターン終了(end_turn_ability_heal / end_turn_ability_other)= 既存の かそく/かんそうはだ と同型
`phaseSlipFor`/ターン終了ブロック(L7478付近)に追加。
- あめうけざら / うるおいボディ / だっぴ / はらぺこスイッチ

### パターンC: damage_calc(ダメージ計算内)= 既存の シェルアーマー/スナイパー と同型
- カブトアーマー(急所無効=シェルアーマーと同じ扱いか確認) / きょううん(急所率上昇)

### パターンD: atk_modify_power(威力補正)= 既存の もうか系/テクニシャン と同型
- ドラゴンスキン / フリーズスキン(**ノーマル技のタイプを変えて威力上昇**=タイプ変更を伴うので`move_property`相当の処理位置に注意)

### パターンE: accuracy_check / pre_use_check / protect_check
- ちどりあし(こんらん時の回避率) / じょおうのいげん・テイルアーマー(**相手の先制技を封じる**=優先度>0の技を無効化) / おうごんのからだ(変化技無効)

## 進め方
1. パターンごとに: 対象特性を全部権威で読む → 実装 → **その都度4ハーネス実行**(壊れていないか)
2. 各特性に最低1つのテストケースを `tools/_spec_ability_wave1_test.js`(新規)に追加。期待値は**権威由来**(sim出力をゴールデンにしない)。
3. 1パターン終わるごとに進捗を `reference/_ability_wave1_progress.json` に追記(やり直し防止)。

## 検証(完了条件)
node tools/_sim_test.js(825/0) / node tools/_sim_sweep_all.js(919/0) / node tools/_sim_hard_interaction_test.js(174/0/skip11) / node tools/_sim_behavior_all.js(flag0) + 新規specテスト全pass

## 報告(agmsgで claude-design へ)
①実装した特性ごと: 権威URL+実在引用 → 仕様 → 実装(file:line) → テストケース
②実装しなかったもの+理由(仕様が複雑/語彙に置き場が無い/Champions独自仕様と食い違う 等)
③4ハーネス+specテストの数値
※途中でz.ai枠に当たったら進捗JSONを保存して「ここまで」と報告(やり直し不要な作りにする)
