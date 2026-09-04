# HANDOFF 2026-09-04(木)夜 → 09-05(金)朝: 夜間自走の総括(②ページ移行ほぼ完走)

作成: 2026-09-05 00:30 JST(Fable・自走中)。阿部さん指示=「朝まで全部使い切って(Sonnet/Codex)・金曜リセットまでがんがん」。
前提の運用: Fable=設計/検証/コミット、Sonnet=実装、Codex=照合([[fable-token-economy]])。全部 `main` に push 済み。

---

## 0. 結論(1分で)

- **②「ページを pokedb.js 1本読みに作り変える」= 棚卸し10ページのうち 9ページ完了**(残り1つ `waza-list_v2.html` は 🙋 処遇待ち)。生成物 `pokechan_data*.js`/`items_database.js` を直接読むページは **旧版(二重掲載中)と ③凍結のバトル系だけ**になった。
- 今夜の push(順): `2996ab78` W13 → `845fe7ff` W14 → `81258ab3` 調査 → `b8819335` W15/16 → `2ead3efc` W17 → `65a6b703` W18 → `71066fa7` W19 → `2ef53ddf` どげざつき訂正。
- Codex 第八世代照合(W4)= 50/50 can_use・fixes なし(`59586952`)。
- **M-C「参加できるポケモン」一覧リンク: 9/5 00:05 時点でまだ無し**(`node tools/_watch_official_news.js`)。
- W20(新版ページ群の壊す側レビュー・Sonnet・読み取り専用)を 00:20 に起動 → 結果は本書 §6 に追記(未着なら `次回ここから.md` 冒頭を見る)。

---

## 1. 今夜できたページ(全部「旧版不変・二重掲載・台帳登録・番人緑・i18n 0件」)

| W | 新版 | 旧版 | 要点 | commit |
|---|---|---|---|---|
| W13 | `suggest_lite_v2.html` / `suggest_partner_v2.html` | suggest_lite/partner | data-files=pokemon,types・弱点集計/提案スコアがJSON一致 | `2996ab78` |
| W14 | `damage_calc_v2.html` | damage_calc | 検索UI/技一覧=pokedb.js・**計算は凍結エンジン(iframe `real_battle_simulator.html` `__sim`)経由の二経路=R1暫定例外をヘッダ明記**。24シナリオ結果文字列一致 | `845fe7ff` |
| W15/16 | `party_checker_v2.html` + `pokedb.js statRankAll()/statRank()` | party_checker | STAT_RANK は生成物と同式の遅延派生(モード別キャッシュ)。450行一致 | `b8819335` |
| W17 | `pokemon_db_v10.html` + `master/pokemon.json display_order / champions_display_order` | pokemon_db_v9 | 表示順を master に持たせた(全国順とChampions順は別=2列)。`tools/_lib/legacy_order.js` 共有・生成物バイト不変。**ページが reference/ を読む案(refJson)は撤回** | `2ead3efc` |
| W18 | `pokemon_db_all_v10.html` + `pokedb.js learnsetNational()/learnersNational` | pokemon_db_all_v9 | v9→v10差分を all_v9 に3-way merge。**pokedb.js abilityDesc のバグ修正**(effect_ja だけ→desc_house 優先=build_views abilityText と同順・309/313件が生成物側へ揃う) | `65a6b703` |
| W19 | `waza-list_v3.html` / `waza-list_all_v3.html` + `waza_picker_v3.js` | waza-list / waza-list_all / waza_picker.js | 496/919 全数一致。**地雷是正: 説明文を正規表現で読んで優先度を出す `_extractPriority` 廃止→master の priority**。差分=グラススライダー(旧1→0)・どげざつき(旧1→0)の意図分のみ。v2番号は旧試作が占有→v3 | `71066fa7` |

pokedb.js に今夜足した窓口: `statRankAll/statRank`, `learnsetNational(name)`, `IDX.learnersNational`(learn ∪ learn_legacy ∪ confiscated), `learners()` の全国分岐, `abilityDesc` の desc_house 優先。(9/4 昼の `dd86e89c` で typeKanji/typeDisplay/typeOffensiveStats/defaultTypeOrder/move(champions_key)/learners(mode)/learnsetKeys/nature も済み)

## 2. データ訂正(二重ソース一致=阿部さんに聞かず適用の規則 [[two-source-verify-then-commit]])

- **どげざつき(false-surrender)** `2ef53ddf`: W19 の priority 置換で表面化。ポケモンWiki + Bulbapedia とも「優先度0・命中 -(必中)・威力80・効果=必ず命中する」。旧データの『優先度+1の先制技。前のターンに相手にダメージを与えていない時は失敗する』(accuracy=100・fails_if no_damage_dealt_last_turn・description/description_legacy)は両ソースに無い=**別の技の文が紛れ込んだ誤り**。`reference/_moves_fixes.json` の既存キーに**追記マージ**(accuracy=null・effects=[必中(ignores)]・fails_if=[]・説明文2本)。表現は master 内の同型(aerial-ace/shock-wave)に揃えた。
- `tools/_views_diff.js` の規則(g)を「`_moves_fixes.json` が set した列を slug×列の単位で許容」に一般化(旧は availability 限定)。UNEXPLAINED 0 / allowlisted 8434。基準は上げていない(許容は fixes に根拠がある slug×列だけ)。

## 3. 調査で分かったこと(fixes なし)

- learnsets↔moves の champions 印ギャップ = **M-C 予告7体だけ**(26技59行)。`master/moves.json` champions:true 497 = ヤックン/ch/ 497 一致。7体の学習リストはヤックン注記「未実装=SV/ZA参考」由来 → **M-C 本実装(9/9)後に差し替え**(`81258ab3`・`review/_learnset_champions_gap_2026-09-04.md`)。

## 4. 🙋 阿部さん判断待ち(今夜ぶん・積み残し含む)

1. **旧版の引退**: speed_compare / suggest_lite / suggest_partner / damage_calc / party_checker / pokemon_db_v9 / pokemon_db_all_v9 / waza-list / waza-list_all(+`waza_picker.js`)。新版で置き換えてよければ nav/canonical を新版へ向けて旧を削除(順序: 新版を正典URLに→旧削除)。
2. **`waza-list_v2.html` / `waza_picker_v2.js`(別系統の旧試作)**: 退避か削除か。決まれば v3 を v2 に改名するかも決める(改名は機械的)。
3. **`ABILITY_TYPE_IMMUNITY`**(特性→タイプ無効の表・party_checker_v2 のページ内直書き・台帳で許容中)を master の「事実の表」第2号にしてよいか。
4. `party_checker_v2` は持ち物を `PokeDB.raw('items')` 181件で引いている(`items()` は 154件=champions のみ)。旧版と同じ母集団を保つための措置。`items()` の定義(champions のみ)を「家の分類あり=181」に広げるか。
5. `display_order` が2列(全国順/Champions順)である設計でよいか(旧2ページの並びが違うため)。
6. localStorage の形式: party_checker 旧=champions_key/新=slug(`pokechan_slot_filters_v2` キー)。旧版を引退させるまでは両方読めるようにしてある。ヒメリのみが party_checker のピッカーに出ない旧バグは**新版でも同じ挙動を温存**(直すなら別件)。
7. damage_calc_v2 の「計算だけ凍結エンジン経由」= R1 の暫定例外。③(バトル作り直し)で解消する前提でよいか。
8. 以前からの持ち越し: `.codex/` gitignore・`reference/_dex_audit_codex/`・`_genus_material/*` の未追跡ファイル(消すか git 管理か)/ waza-list-template.html 削除 / items 入手方法 空64件 / flavor_ja 全角75件 / magnetic-flux(effects設計)/ 10-000-000-volt(文言)/ Z技28 / X投稿 / 耳チェック6件 / buddy_finder / ゲーム内ロスター画面 / ページ側「現行既定・次へ切替」UI(段H=9/9)/ 旧版 pokemon_db_all.html の全角キー(ポリゴン２)は旧版引退後に削除可。
9. i18n 監査ハーネス `tools/i18n_audit_playwright.js` の PAGES 既定一覧に新版ページを足すか(今は `--page=` 指定で個別に回している)。nav への新版昇格も同時に。

## 5. 工数の見直し(阿部さん「一週間と言って一時間で終わる」への答え)

今夜の実測: ②の 9ページ移行 = **Sonnet 7本(各20〜40分)+ Fable 検証・コミット = 約6時間**(9/4 18:00 → 9/5 00:30、枠待ちなし)。9/4 昼の見積り「②=数日」は過大だった。
残りの大物は **③バトル作り直し**(フェーズ設計の実装・特性不一致90件・未実装87件)。これは「設計→実装→実機照合(権威ソース)」のループが本体で、実装より**照合が時間を食う**(1機構=1エージェント・全件反証の規律 [[audit-thoroughness-not-negotiable]])。二本立て見積り: **枠を気にしなければ 2〜3日の連続稼働 / 5h・週間枠の中では 1〜2週間**。①②が済んだので着手条件は整った(CLAUDE.md「全体の順番」③)。

## 6. W20(新版ページ群の壊す側レビュー)の結果

(00:20 起動・完了次第ここに追記。未追記なら `次回ここから.md` 冒頭を見る)

## 7. 次回の入口

1. `node tools/_watch_official_news.js` → M-C 一覧が出ていたら `--roster M-C` → 照合 → `reference/_regulations.json` next → `node tools/build_master_v2.js` → `node tools/build_views.js` → `_views_diff`(UNEXPLAINED 0)→ `_ssot_guard_test` → `_page_guard_test` → push(手順書 `公式情報の探し方_レギュ更新手順_2026-09-03.md`)。9/9 切替(段H)= role next→current。
2. §4 の 🙋 を阿部さんに(特に 1・2 = 旧版引退)。
3. W20 の指摘があれば重大度順に Sonnet へ(修正は新版だけ・旧版は触らない)。
4. その後 ③バトル作り直しの設計に入る(`設計_バトルエンジン原理_2026-07-26.md` から)。
