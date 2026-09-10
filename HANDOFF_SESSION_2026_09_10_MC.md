# 2026-09-10 Claude Fable: レギュレーションM-C 本番反映(切替・24行・特性2・持ち物12・技7・没収2)+ やること整理

**状態: M-C反映=完了・全ゲート緑・commit/push済み(下の §4)。ダブル(B064)の束は前回どおり🙋4の返事待ちで未コミット。**

## 0. 次に開いたら最初にやること(順番)

1. **§2 の 🙋 を阿部さんに確認**(家の分類/効果文12件・イキリンコ4色・news文言)。返事が無くても §3 の T1 から進めてよい(データ作業・設計判断なし)。
2. **`HANDOFF_SESSION_2026_09_07_DOUBLES.md` §3-A の🙋4(ダブル設計)** は依然返事待ち。返事が来たら同 §4 の束を commit → D0残り → D1。
3. Supabase 不通(同 §5)は阿部さんの手で。

## 1. 今日やったこと(全部 二重ソース・根拠は各 fixes に引用つき)

| 何を | どこに | 根拠 |
|---|---|---|
| **レギュ切替** M-B→M-C を `role:current`、M-B の項目を削除(R4 2枠)。期間=9/9 15:00〜12/2 10:59・公式一覧リンク・調整内容(`announced.balance_changes`)を記録 | `reference/_regulations.json` | 公式#816(9/9更新)・#817(更新データ配信) |
| **ポケモン25行 champions:true**(19種: プクリン/ペルシアン2/カモネギ/バリヤード/マルノーム/ゴーゴート/エースバーン/インテレオン/フォクスライ/ストリンダー2/オトスパス/ニャイキング/ネギガナイト/バチンウニ/イエッサン2/パーモット/オリーヴァ/イキリンコ4/マフィティフ)。カモネギ(ガラル)/バリヤード(ガラル)は**未実装のまま** | `_pokemon_fixes.json`(既存7キーはマージ) | 公式一覧 `_official_rosters/M-C.json`(262行/231種)+ヤックン/ch/zukan「登場・内定」+Serebii Newly Useable。重さ=ヤックン/ch と master 一致(値は変えず) |
| **メガ特性2件**: メガグソクムシャ=かたいツメ / メガセグレイブ=ねつこうかん | `_pokemon_additions.json` ab1 + `_pokemon_notes.json` | ヤックン/ch/zukan/n768m・n951m × Serebii megaabilities の二重一致 |
| **持ち物12件をChampions入り**(エレキ/グラス/サイコ/ミストシード・グランドコート・ゴツゴツメット・しめつけバンド・だっしゅつボタン・ながねぎ・ノーマルジュエル・ふうせん・レッドカード)+ナイト4の入手(2000VP) | `_items_fixes.json` | ヤックン/ch/item.htm「レギュMCで追加」+ ゲーム内ショップ実機スクショ(Yarty_mano・阿部さん共有) |
| **技7件**: きりさく80/解禁・ねらいうち85/PP16・スターアサルト170/PP8・ねがいごとPP8・ちからをすいとるPP8・ミルクのみ対象「自分か味方」/PP8・でんこうそうげき flags.punch | `_moves_fixes.json` | 公式#817(禁止/解禁/PP)+ヤックン/ch/move_changes.htm+move_list.htm+Game8画像 |
| **没収2件**: ニョロトノ はたく / ブリジュラス ミラーコート・メタルバースト | `_learnsets_fixes.json` learn_remove | 公式#817+ヤックン/ch/zukan 没収欄(n186/n1023) |
| **公式一覧 vs master 全数照合** | `node tools/_watch_official_news.js --roster M-C` | 231種/231種・公式にだけ0・うちにだけ0 |

**道具の変更(データ以外)**:
- `tools/build_master_v2.js`: 持ち物 fixes が `champions/acquisition/acquisition_note/notes/source/effect_house` も受け付ける+PokeAPI暫定行の追加**後**にもう一度 fixes を当てる(順序バグ: 暫定行に当たっていなかった)。
- `tools/_views_diff.js`: (j') 終了レギュの `added_in` は残す(名簿が `_official_rosters/` に在るもの) / (m) `_items_fixes.json` 根拠つき上書き欄 / (m') fixes で Champions 入りした行は additions 扱い。
- `tools/_fetch_pokeapi_items_raw.js` + `tools/build_i18n_entities.js`: 持ち物の公式フレーバー文を**9言語**で取り、辞書の効果文が**空の欄だけ**埋める(機械翻訳なし)。副産物=fr 229件など既存の空欄も公式文で埋まった。
- `news.html` + `i18n/ui-*.json news.card1_title`: 現行レギュの開幕カードを `{reg}` 差し込みに(M-B固定文言を撤去)。日付/期間は master(regulations)から。M-C先行カードは「次」が無いので自動で非表示。
- `real_battle_simulator.html`: テスト用ダミーの体重 93.5→89.4(348匹の平均・T54 追従。ロジック無変更)。
- `?v=20260910`: 6ページの pokechan_data(_all).js / items_database.js。
- 再生成: `items_list.html`(190件)・コンテンツ静的ページ 9言語 14,463枚(`GEN_LANGS=ja,en,fr,de,es,it,ko,zh-Hans,zh-Hant node tools/_gen_content_pages.js` ★既定は ja,en だけ=hreflang が消えるので必ず9言語指定)。

**ゲート**: 番人 悪化なし / views_diff 未説明0 / engine 19/19 / `_sim_test` 825/825 / Playwright 段D 8/8 / i18n 監査 3言語×24ページ 残日本語0(news.html の82技説明は「訳なし=意図的ja」で監査除外=T2) / バトル系7ページ JSエラー0。

## 2. 🙋 阿部さんに確認してほしいこと

1. **持ち物12件の「家の分類(category)」と効果文(effect_ja)は私の仮置き**(シード4=defense_boost / グランドコート・しめつけバンド・だっしゅつボタン・レッドカード=misc / ながねぎ・ノーマルジュエル=attack_boost / ゴツゴツメット・ふうせん=defense_boost)。分類の変更と、文の声(耳)を見てください(items_list.html「M-Cで追加」バッジの行)。
2. **イキリンコ**: 公式一覧は「イキリンコ」2行(0931-000/002=隠れ特性で分かれる2系統)。master は羽色4色すべてに champions:true(osomatsusan の一覧に4色・ヤックン/ch は1ページで内定)。この扱いでよいか。
3. **news.html**: 「M-C 開幕 — 35ポケモン+82技+18持ち物」カードは master から自動。M-C の**調整内容(禁止技/PP/威力変更)の記事**は書いていない(文章=阿部さんの領域)。書くなら材料は `_regulations.json` の `announced.balance_changes`。
4. ガブリアスナイトZ / ボーマンダナイトの入手方法はヤックン一覧に未掲載=空欄のまま(推測で埋めない)。
5. 持ち物12件の `implemented`(バトルのピッカーに出す印)は **false のまま**=ピッカーには出ない。うちのエンジンが各道具に対応しているか(③)を確認してから true にする(T3)。

## 3. 残タスク(優先順・「やること整理」)

| # | やること | 入口/道具 | 規模 |
|---|---|---|---|
| **T1** | **M-C新規28行のChampions習得技を取り込む**(新24行+ボーマンダ/グソクムシャ/セグレイブ/ゴリランダー)。現状=`learnsets.json` の champions:false のまま=ページ/バトルは**全国版の技にフォールバック**(例: プクリン88技・グソクムシャ57技)。ヤックン/ch/zukan/nXXX の「覚える技」+「没収された技」を取り、`_authority_corpus_ch/learnsets_ch.json` 経由か `_learnsets_fixes.json` で入れる。二人目の目=ポケモンWiki「Pokémon Championsのおぼえるわざ」 | メモリ [[yakkun-ch-change-pages]] / [[yakkun-scrape-method]] / A3の流儀 `reference/_wiki_learnset_audit_summary.md` | 中(28ページ×2ソース) |
| **T2** | **Champions入りした技82件の説明文(description)の多言語**(news.html/waza-list で意図的jaにしてある)。並列WFで翻訳→`i18n/*.json moves` | [[i18n-static-and-battlelog-arch]] の翻訳WF | 中 |
| **T3** | 持ち物12件のエンジン対応の確認→`implemented`。effect_house(家の言い回し)。※③凍結の範囲=対応表だけ作る | `real_battle_simulator.html` の道具処理 | 小〜中 |
| **T4** | **ヤックン/ch/move_changes.htm「威力・効果の変更された技」全件 vs master の全数照合**(ボーンラッシュ30/であいがしら100/かげぬい90/トロピカルキック85/くちばしキャノン120/…/フリーズドライ追加効果削除/ゴールドラッシュ命中95 等=M-B以前の変更も含む。R1監査で拾えているか) | 同ページ(ブラウザfetch) | 小 |
| **T5** | ヤックン/ch/move_changes.htm「覚える技の変更点」(ポケモン別 新規習得/没収) vs `learnsets.json` 全数照合 | 同上 | 中 |
| **T6** | ミルクのみの effects(battle_data)の target を「自分か味方」に追随=ダブル(B064)の語彙で。今回は master.target のみ変更 | 設計_ダブルバトル_2026-09-07.md | 小(B064内) |
| **T7** | M-Cで新しくChampionsに来た技82件の effects/説明文は全国版由来の暫定(R2②)。Champions正典(ヤックン/ch/技ページ)で1件ずつ上書き=技監査R1の流儀 | `技監査R1_*` 台帳 | 中 |
| **T8** | 新種19種の図鑑諸元(高さ/性別/分類)は PokeAPI暫定のまま(重さだけ一致確認済み)。ヤックン/ch/で確定→fixes | `_pokemon_fixes.json` | 小 |
| **T9** | 定期watcherの結果で「M-D 発表」が出たら `role:next` で足す(R4) | 手順書 §3 | — |

持ち越し(前回から): B064 ダブル(🙋4返事待ち→commit→D0残→D1)/ Supabase 不通 / AdSense 再審査・Search Console の結果待ち / `making.html:356` の古い記述 / `HANDOFF_SESSION_2026_09_04.md` §4 3〜9。

## 4. commit
1コミット(日本語メッセージ・trailer)。**含めない**: ダブル(B064)の束(`設計_ダブルバトル_2026-09-07.md` / `review/_doubles_research_2026-09-07/` / `review/_b064_d0_2026-09-07/` / `tools/_online_mirror_test.js` / `tools/_lab_adversarial_test.js` / `HANDOFF_SESSION_2026_09_07_DOUBLES.md` / `review/_codex_trial/astra_handover_last_message.md`)と、テスト副産物(`reference/_sim_behavior_result.json` / `review/i18n_audit_latest.json` / `reference/_views_diff_report.json`)。

## 5. 今日の学び(規律)
- **`git stash` を使わない**: 再ビルドした master/ と衝突して pop が2回失敗(復元はできた)。比較は worktree か別クローンで。
- 公式#817 は「禁止/解禁/PP」だけ。威力・分類の変更はヤックン/ch/move_changes.htm が唯一の表(メモリ [[yakkun-ch-change-pages]])。
- Game8 画像の「グソクムシャ 没収:はたきおとす」は**今回の更新の没収ではなく**、新規参戦時点で最初から無い技(ヤックン没収欄は教え技(USUM)由来)。公式の「ニョロトノ: はたく」が正。
- `_gen_content_pages.js` の既定は ja,en → 9言語指定しないと hreflang が7言語分消える。
