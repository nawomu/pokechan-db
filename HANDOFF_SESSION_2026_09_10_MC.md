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

## 2. 🙋 阿部さんに確認してほしいこと(確認用ページ= https://claude.ai/code/artifact/42b93fd2-6379-4133-8752-a84da48b75a6 ・9/10 作成)

1. ~~持ち物12件の「家の分類」と効果文は私の仮置き~~ → **9/10夜 3サイト裏取りで矛盾なし(阿部さん「確信があれば聞かずに進めて」)**。元の文:(シード4=defense_boost / グランドコート・しめつけバンド・だっしゅつボタン・レッドカード=misc / ながねぎ・ノーマルジュエル=attack_boost / ゴツゴツメット・ふうせん=defense_boost)。分類の変更と、文の声(耳)を見てください(items_list.html「M-Cで追加」バッジの行)。
2. ~~**イキリンコ**~~ → **決定(9/10 阿部さん)**: 4色とも使える扱いでよい(違いは隠れ特性だけ)。masterは4行 champions:true のまま。
3. ~~**news.html**~~ → **決定(9/10 阿部さん)**: 調整内容の記事は書かなくてよい。開幕カードは master から自動表示。
4. ガブリアスナイトZ / ボーマンダナイトの入手方法はヤックン一覧に未掲載=空欄のまま(推測で埋めない)。
5. ~~持ち物12件の `implemented`~~ → **決定・実施(9/10 阿部さん「フィールド系のエンジンが無いなら作る/無いなら作って付け足す」「ながねぎはガラルも入れておく」)**: 9個をエンジンに実装(§1b)・12個とも implemented:true=ピッカーに出る。

## 1b. 持ち物9個のエンジン実装(9/10 夕・阿部さん指示・Sonnet実装/Fable検証)

- 仕様=二重ソース(ポケモンWiki各道具「詳細な仕様」+「フィールド#シード系アイテム」× ヤックン/ch/item.htm)。指示書= scratchpad `spec_items_mc_engine.md`(セッション限り)・分類= `reference/_phase_assign/items_batch_07.json`(10件)・語彙v3 S09 に react段(シード)を追記。
- `real_battle_simulator.html`: シード4種(`_SEED_MAP`/`_seedTryOne`/`resolveTerrainSeeds`=フィールド発生直後(特性メイカー/技)+`fireEntryAbility`末尾の登場時・接地不要・+6なら消費しない・マジックルーム無効)/ グランドコート(技で出したフィールドも8ターン)/ しめつけバンド(バインド付与時に1/6固定)/ ながねぎ(`applies_to_pokemon` 配列で判定・急所+2)/ ノーマルジュエル(実効タイプ=ノーマルで×5325/4096・成功時に消費)/ だっしゅつボタン(`resolveEjectButton`・被弾後に自分で交代先を選ぶ・控え無しは不発)/ レッドカード(`resolveRedCard`・攻撃者をランダム交代・ねをはる/きゅうばんは消費のみ・それ以外の罠は無視)。Fable追加=`_itemForcedSwitch`(持ち物の交代が先に起きたら とんぼがえり等の自分交代は起きない)。
- 発見: 4つのフィールド技の effects に旧・簡易版シード(holds_item 条件のランク変化・消費なし/登場時なし/+6キャップなし)が埋まっていた → その分岐を無効化して新実装に一本化(二重発動を T322 が検出)。
- **近似(要検証)**: ①だっしゅつボタン×レッドカード同時成立=本当は素の素早さ順・今はレッドカード→だっしゅつボタン固定 ②ちからずく「発動した」判定=威力補正と同じ条件で近似 ③ばけのかわ肩代わりでダメージ0の時=本当は発動するが今は不発(`total>0` ガード) ④きゅうばんは特性自体がエンジン未実装(park)。
- テスト: `tools/_sim_test.js` 段150 T315〜T346(34件)。全ハーネス緑: sim **859/0** / sweep 919/0 / hard 174/0 skip11 / behavior 605/605 flag0 / engine 19/0 / lab 32/32 / adversarial **10/10**(S9 のテスト側修正 `tools/_lab_adversarial_test.js` も同梱=前回の未コミット分) / Playwright 段D 8/8 / バトル系ページ JSエラー0。
- master: `_items_fixes.json` に implemented:true(12)+ながねぎ `applies_to_pokemon`(ガラル込み)・builder の fixes 受付欄に implemented/applies_to_pokemon・views に `applies_to_pokemon` 列(views_diff (n)/(m)別名で未説明0)。


## 1c. 夜の自走(9/10 19:00〜・阿部さん「ネットで裏取りして確信があれば聞かずに進める/残タスクをがんがん/余ればダブル/Codexは補助程度」)

| 済 | 内容 | commit |
|---|---|---|
| T1 | 新規29行(19種25行+ボーマンダ/グソクムシャ/セグレイブ/ゴリランダー)のChampions習得技=**ヤックン/ch × Serebii /pokedex-champions/ 26/26 完全一致**→権威コーパスに追記・builderが凍結スナップショット外の行も権威から作る(メガは元の種から複写)・A3の全国行fixはChampions行に当てない・Champions初登場の技10件(+きりさく等5)=**技表 496→511**(ローマ字キー生成 `tools/_lib/kana_romaji.js`・i18n別名)。★ヤックン `#move_list` は「◆没収された技」見出しの**前後**で分ける(past_move クラスに頼ると19技が混入) | `932220950` |
| T4 | ヤックン/ch/move_changes.htm「威力・効果の変更された技」33件 vs master=31一致・**フリーズドライ(Championsは追加効果こおり無し)/ふんどのこぶし(蓄積は交代でリセット・最大350)**を修正(Wiki Champions欄+Serebii) | `11badb9fe` |
| T5 | **全Champions行(非メガ266行)をヤックン/ch/から取り直し**(Chrome同一オリジンfetch・120行/回で弾かれる→400ms間隔+再試行)→235行一致・30行は「きりさく解禁」(公式#817)→learn_add(+メガ18行)・残1=ランクルス(A3決着)。記録=`reference/_yakkun_ch_learnsets_all_2026-09-10.json` | `6b3a922d8` |
| T8 | 新種25行の図鑑諸元=**Wiki×ヤックン×master 100/100一致**→暫定の印を外す(Sonnet照合) | 同上 |
| 持ち物12件 | **3サイト(Wiki/Bulbapedia/Serebii ItemDex)で矛盾なし**(Sonnet照合)。補記: ふうせん=まきびし/どくびし/ねばねばネットも無効・しめつけバンド=攻撃系へ。notes の「仮置き」を「確認済み」に | 同上 |
| B064 D1 | **完了・検収済み**(`battle_scheduler.js`+`tools/_scheduler_test.js` 14/0)。近似・未確認7点=コード内コメント(isPresent不成立時の理由 not_present / item・run 帯の細則 / futureSight・wish を側の場に分類した根拠弱 / forecastForm の所在 / moveToFront・Back は拡張API / rng 必須)。**D2 前半(D2-a scheduler接続・D2-b slotOf)をSonnetに発注中**(指示書= scratchpad `spec_d2_connect.md`。ゲート=全ハーネス+sim_test_report.html の stdout diff 0) | `1b13884b5` |
| B064 D2 | **完了・検収済み**(前半 `047085aba`=scheduler接続/slotOf・後半 `f44577f06`=実行ループのscheduler化(追加実行=さいはい は extra キュー・フォーカスレンズ判定は hasActed)/isPresent実体化/undo機械生成版(検証用)・`3c4e29882`=**undoが復元していなかった揮発欄10件+presenceEpoch を本番に反映**(H56で恒久監視・hard 183/0))。全段 stdout diff 0(親も独立確認)。決定=おさきにどうぞ/さきおくり/りんしょうはエンジン未実装(0件)=D3で新設。本番 snapshotBattleState の完全機械生成化は H56(ソース静的解析)の作り直しが要るため保留 | 上記 |
| B064 D3-1 | **完了・検収済み** `bb7ed3e61`(battle.format・env.doubleBattle は format の getter/setter・sides[側].slots[]・slotOf 枠読み(自己修復付き)・activeSlots・setFormat・_slots_test 5/0・シングル diff 0) | `bb7ed3e61` |
| B064 D3-2 | **完了・検収済み** `de227d918`(fixture で4体1列+TARGET_KINDS 表+targetLock=正面既定/消失時の選び直し/ランダム1体の乱数点・_doubles_fixture_test 11/0・シングル diff 0)。★暫定=runTurn が format で旧経路/slots 経路を分岐(コピー経路)=D3-3a で一本化 | `de227d918` |
| B064 D3-3 | **完了・検収済み** `192d9074e`(シングルも slots 経路に一本化=コピー経路ゼロ・味方対象効果(てだすけ×1.5/行動済み失敗・ミルクのみ味方・fails_if:no_ally の隠れブロッカー修正)・引き寄せ Handler(このゆびとまれ/いかりのこな=宣言順・ひらいしん=素の素早さ・すじがねいり/ignores_redirect 無視)。fixture 21/0・シングル diff 0。残=溜め技1ターン目の先送り(#35)) | `192d9074e` |
| B064 D4-1 | **完了・検収済み** `88efb93e2`(範囲技=対象集合(位置順)・対象ごとのループ・×0.75(実行時対象≥2)・壁 2732/4096・いかくの対象別反応。fixture 31/0・シングル diff 0。未実装=ドラゴンアロー(flags 無し・#37)/ 全体・味方全体は現行データ全部変化技) | `88efb93e2` |
| B064 D4-2 | **完了・検収済み** `2e5321213`(枠単位の交代=attemptSwitch slotIdx・bench 側一元化・複数ひんし/死に出し(正準順・#7未確認)・勝敗 isSideDefeated/checkBattleWinner・持ち物の枠対応。fixture 39/0・シングル diff 0) | `2e5321213` |
| B064 D4-3 | **完了・検収済み** `819c68f68`(全枠の開始登場=速度順固定・megaEvolve(side,slot)・かげふみ等=相手いずれかの枠・溜め技#35・**交代/メガをすばやさ順**(同速のみ乱数1回。既存テストに題材なし=diff 0)。fixture 47/0) | `819c68f68` |
| B064 レビュー | **完了・修正済み** `2d3e348cf`: 指摘=①このゆびとまれの新規ログ行がシングルにも漏れる(9言語未対応)→撤去(無音) ②undo が復元しない新設欄2件→snapshot/undo/H56/枠定数に追加 ③交代・メガの同速タイに新設した乱数点→撤去(canonSides 順・同速細則は未確認) ④台帳#5 の分岐点を名前付き定数に。問題なし=×0.75の時点/壁/ひらいしん速度/このゆびとまれ origin/死に出し上限/テストの根拠。残(既知)=checkBattleWinner はページ未接続(D5/D6)・道具後処理が単体/範囲で別経路・くろいまなざし解除は過剰解除の近似 | `2d3e348cf` |
| B064 D5-0 | **完了・検収済み** `39b683ed7`(枠ごとの選択をエンジンが読む・megaUsed は側で共有・setChoice/getChoiceCandidates/autoChoose 公開・fixture 54/0) | `39b683ed7` |
| B064 D5-1 | **発注中**: 開発プレビュー **新規ページ `battle_doubles_preview.html`**(noindex・導線非公開・pokedb.js のみ・9言語・対象選択UI・死に出し・勝敗・既存ログ文言のみ)+PDCA Playwright。battle_lab(5000行・1vs1密結合)の改修は避けた=統合(入口A)は D6 で。指示書= scratchpad `spec_d5_1_preview.md` | — |
| 持ち物レビュー | 壊す側Sonnetの指摘3件を修正(印の消し忘れ=変化技の自分交代が無言で不発/固定ダメージ経路/ばけのかわ)+T347〜349 → 862/0 | `5afcc7b48` |
| T2 | 8言語の技説明は15技とも既訳あり。JAを変えた3技(ミルクのみ/フリーズドライ/ふんどのこぶし)の8言語を Sonnet が再翻訳中 | — |

残: T6(ミルクのみ effects target=B064語彙)/ T7(新15技の effects をChampions正典で再確認=説明文は一致確認済み)/ ガブリアスナイトZ・ボーマンダナイトの入手(ヤックン未掲載)/ D1検収→D2。

## 3. 残タスク(優先順・「やること整理」)

| # | やること | 入口/道具 | 規模 |
|---|---|---|---|
| ~~**T1**~~ 完了(§1c) | ~~M-C新規28行のChampions習得技を取り込む~~(新24行+ボーマンダ/グソクムシャ/セグレイブ/ゴリランダー)。現状=`learnsets.json` の champions:false のまま=ページ/バトルは**全国版の技にフォールバック**(例: プクリン88技・グソクムシャ57技)。ヤックン/ch/zukan/nXXX の「覚える技」+「没収された技」を取り、`_authority_corpus_ch/learnsets_ch.json` 経由か `_learnsets_fixes.json` で入れる。二人目の目=ポケモンWiki「Pokémon Championsのおぼえるわざ」 | メモリ [[yakkun-ch-change-pages]] / [[yakkun-scrape-method]] / A3の流儀 `reference/_wiki_learnset_audit_summary.md` | 中(28ページ×2ソース) |
| **T2** | **Champions入りした技82件の説明文(description)の多言語**(news.html/waza-list で意図的jaにしてある)。並列WFで翻訳→`i18n/*.json moves` | [[i18n-static-and-battlelog-arch]] の翻訳WF | 中 |
| ~~**T3**~~ | ~~持ち物12件のエンジン対応~~ → **完了(9/10 §1b)**。残=近似4点の検証・きゅうばん特性の実装(③) | — | — |
| ~~**T4**~~ 完了(§1c) | ~~ヤックン/ch/move_changes.htm「威力・効果の変更された技」全件 vs master の全数照合**(ボーンラッシュ30/であいがしら100/かげぬい90/トロピカルキック85/くちばしキャノン120/…/フリーズドライ追加効果削除/ゴールドラッシュ命中95 等=M-B以前の変更も含む。R1監査で拾えているか) | 同ページ(ブラウザfetch) | 小 |
| ~~**T5**~~ 完了(§1c・全行取り直しで代替) | ~~ヤックン/ch/move_changes.htm「覚える技の変更点」(ポケモン別 新規習得/没収) vs `learnsets.json` 全数照合 | 同上 | 中 |
| **T6** | ミルクのみの effects(battle_data)の target を「自分か味方」に追随=ダブル(B064)の語彙で。今回は master.target のみ変更 | 設計_ダブルバトル_2026-09-07.md | 小(B064内) |
| **T7** | M-Cで新しくChampionsに来た技82件の effects/説明文は全国版由来の暫定(R2②)。Champions正典(ヤックン/ch/技ページ)で1件ずつ上書き=技監査R1の流儀 | `技監査R1_*` 台帳 | 中 |
| ~~**T8**~~ 完了(§1c) | ~~新種19種の図鑑諸元(高さ/性別/分類)は PokeAPI暫定のまま(重さだけ一致確認済み)。ヤックン/ch/で確定→fixes | `_pokemon_fixes.json` | 小 |
| **T9** | 定期watcherの結果で「M-D 発表」が出たら `role:next` で足す(R4) | 手順書 §3 | — |

持ち越し(前回から): B064 ダブル(🙋4返事待ち→commit→D0残→D1)/ Supabase 不通 / AdSense 再審査・Search Console の結果待ち / `making.html:356` の古い記述 / `HANDOFF_SESSION_2026_09_04.md` §4 3〜9。

## 4. commit
1コミット(日本語メッセージ・trailer)。**含めない**: ダブル(B064)の束(`設計_ダブルバトル_2026-09-07.md` / `review/_doubles_research_2026-09-07/` / `review/_b064_d0_2026-09-07/` / `tools/_online_mirror_test.js` / `tools/_lab_adversarial_test.js` / `HANDOFF_SESSION_2026_09_07_DOUBLES.md` / `review/_codex_trial/astra_handover_last_message.md`)と、テスト副産物(`reference/_sim_behavior_result.json` / `review/i18n_audit_latest.json` / `reference/_views_diff_report.json`)。

## 5. 今日の学び(規律)
- **`git stash` を使わない**: 再ビルドした master/ と衝突して pop が2回失敗(復元はできた)。比較は worktree か別クローンで。
- 公式#817 は「禁止/解禁/PP」だけ。威力・分類の変更はヤックン/ch/move_changes.htm が唯一の表(メモリ [[yakkun-ch-change-pages]])。
- Game8 画像の「グソクムシャ 没収:はたきおとす」は**今回の更新の没収ではなく**、新規参戦時点で最初から無い技(ヤックン没収欄は教え技(USUM)由来)。公式の「ニョロトノ: はたく」が正。
- `_gen_content_pages.js` の既定は ja,en → 9言語指定しないと hreflang が7言語分消える。
