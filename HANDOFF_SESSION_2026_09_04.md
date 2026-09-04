# HANDOFF 2026-09-04(木)夜 → 09-05(金)朝: 夜間自走の総括(②ページ移行ほぼ完走)

作成: 2026-09-05 00:30 JST(Fable・自走中)。阿部さん指示=「朝まで全部使い切って(Sonnet/Codex)・金曜リセットまでがんがん」。
前提の運用: Fable=設計/検証/コミット、Sonnet=実装、Codex=照合([[fable-token-economy]])。全部 `main` に push 済み。

---

## 0. 結論(1分で)

- **②「ページを pokedb.js 1本読みに作り変える」= 棚卸し10ページのうち 9ページ完了**(残り1つ `waza-list_v2.html` は 🙋 処遇待ち)。生成物 `pokechan_data*.js`/`items_database.js` を直接読むページは **旧版(二重掲載中)と ③凍結のバトル系だけ**になった。
- 今夜の push(順): `2996ab78` W13 → `845fe7ff` W14 → `81258ab3` 調査 → `b8819335` W15/16 → `2ead3efc` W17 → `65a6b703` W18 → `71066fa7` W19 → `2ef53ddf` どげざつき訂正。
- Codex 第八世代照合(W4)= 50/50 can_use・fixes なし(`59586952`)。
- **M-C「参加できるポケモン」一覧リンク: 9/5 00:05 時点でまだ無し**(`node tools/_watch_official_news.js`)。
- W20(新版ページ群の壊す側レビュー)→ §6。是正 W21 `264ac507`・特性名 W22 `d7f1c979` → §6b。**夜間ぶんの push は全部 main に載っている(最終 = W21)。**

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
10. ~~pokemon_db_v10 / all_v10 で特性名が言語切替後も日本語のまま~~ → **解決 `d7f1c979`(W22)**。配線漏れではなく**辞書側の未訳プレースホルダ**(name===ja の既存エントリを builder が確定訳と誤認して固定)。builder 修正+`reference/_i18n_names_fixes.json` に6件×8言語(Wiki+Bulbapedia 二重一致)。🙋 残る判断 = **es は スペイン版を採用**(ほのおのたてがみ=Crin de Fuego / ドラゴンスキン=Piel Dragontina。中南米版 Melena de Fuego / Piel Dracónica は不採用分として fixes に記録)。中南米版が正なら差し替え。

## 5. 工数の見直し(阿部さん「一週間と言って一時間で終わる」への答え)

今夜の実測: ②の 9ページ移行 = **Sonnet 7本(各20〜40分)+ Fable 検証・コミット = 約6時間**(9/4 18:00 → 9/5 00:30、枠待ちなし)。9/4 昼の見積り「②=数日」は過大だった。
残りの大物は **③バトル作り直し**(フェーズ設計の実装・特性不一致90件・未実装87件)。これは「設計→実装→実機照合(権威ソース)」のループが本体で、実装より**照合が時間を食う**(1機構=1エージェント・全件反証の規律 [[audit-thoroughness-not-negotiable]])。二本立て見積り: **枠を気にしなければ 2〜3日の連続稼働 / 5h・週間枠の中では 1〜2週間**。①②が済んだので着手条件は整った(CLAUDE.md「全体の順番」③)。

## 6. W20(新版ページ群の壊す側レビュー)の結果

00:45 完了(Sonnet・読み取り専用・14ページ×7観点・全数)。
- **所見1(実害・条件付き)**: `master/*.json` が 404 のとき 11ページが**無言**(`.catch()` 無し・コンソールのみ)。`ability_all.html`/`items_db_all_v2.html` だけ画面に出る。→ **W21 で是正**(pokedb.js に `showLoadError()` 共通部品+ i18n `common.db_load_error` 9言語+13ページに `.catch`)。結果は §6b。
- 所見2: damage_calc_v2 の iframe 直読み=既知の R1 暫定例外(③解禁まで)。追加対応なし。
- 所見3/4(問題なし・確認): learners() の mode 追随=旧新全件一致(まもる 322/322・全国 1251/1251)/ abilityDesc 313件一致 / pokemon_db_v10 DATA 1273件一致(null vs "" の表記差のみ・表示影響なし)/ `?learns=` バナー件数一致。
- 所見5: 言語切替後の残りは (a) フッター社名(翻訳対象外) (b) items_db_all_v2 の意図的JA併記(`data-i18n-audit-skip`) (c) **pokemon_db_v10/all_v10 の特性名(メガソーラー等)が未訳=v9 から在る既存問題**(移行が原因ではない)→ 🙋 §4-10。
- 所見6: 4か条の機械検査=実行コードでの生成物/master/reference 直読み 0件。所見8: 競合(master 1.5秒遅延)=13ページ全部正常。
- 注記: items_list.html は SSG(ビルド時に焼く)なので実行時1本読みの観点は対象外。

### 6b. W21(所見1の是正)・W22(特性6件の公式名)の結果 — 01:20 完了・push 済み

- **W21 `264ac507`**: `PokeDB.showLoadError(err, targetEl?)` を pokedb.js に追加(表なら colspan 行・要素なら div・指定なしなら固定バナー=重複しない)。文言 = i18n `common.db_load_error`(9言語・`{msg}`)。**master の fetch は I18N 辞書より先に失敗する**ので `i18n:ready/i18n:changed` で自動再描画(Sonnet が実機でレースを踏んで発見。指示書より一歩広いが妥当と判断して採用)。fetch 失敗の `err.message` は Fable が言語中立に直した(『が読めません』→『(HTTP 404)』。英語文の中に日本語が残っていた)。13ページに `.catch`・`?v=20260905`。実機 = 404経路で表示/通常経路 innerText 不変/pageerror 0/監査 en 0。
- **W22 `d7f1c979`**: §4-10 参照。辞書の未訳プレースホルダが原因(配線漏れではない)。builder 1行修正+fixes 6件×8言語。
- W20 の所見はこれで**全部消化**(所見2=既知の R1 例外、3/4/6/8=問題なし)。

## 7. 次回の入口

1. `node tools/_watch_official_news.js` → M-C 一覧が出ていたら `--roster M-C` → 照合 → `reference/_regulations.json` next → `node tools/build_master_v2.js` → `node tools/build_views.js` → `_views_diff`(UNEXPLAINED 0)→ `_ssot_guard_test` → `_page_guard_test` → push(手順書 `公式情報の探し方_レギュ更新手順_2026-09-03.md`)。9/9 切替(段H)= role next→current。
2. §4 の 🙋 を阿部さんに(特に 1・2 = 旧版引退)。
3. W20 の指摘があれば重大度順に Sonnet へ(修正は新版だけ・旧版は触らない)。
4. その後 ③バトル作り直しの設計に入る(`設計_バトルエンジン原理_2026-07-26.md` から)。**★入口 = `review/_battle_rework_inventory_2026-09-05.md`(W23・01:40・読み取り専用の棚卸し)**: 特性90件は今も同名で有効・データ側(effect_ja)は全件記入済み=残るはエンジン側のみ / 「未実装87」は別集計(`review/現状棚卸し_ルール実装点検_2026-07-28.html`)/ 技の effects phase は旧5値のまま(スラグ化未実施=compose全数再照合を伴う重作業)/ `_phase_design_a1〜a4`+`_t11_spec_g1〜g4`=設計42件・実装0 / 新規5特性+6持ち物がフェーズ割当外 / effects 空52技は全部「ダメージのみ」で正当 / desc_house 空4特性(うなぎのぼり/おもかげやどし/はどうのぼうご/ほのおのたてがみ=声=阿部さん)。**§7(W24・02:05)= 87件側の全数再判定**: 87 は `review/現状棚卸し_ルール実装点検_2026-07-28.html` のルール単位集計(実装済254/部分50/未実装87/未確認44/対象外4 を再現)。今 = 未実装のまま 78 / 意図的不実装 6(テラスタル・ダイマ・Z=憲法§22で決定済み・当初から誤集計)/ 部分 1(こだいかっせい・クォークチャージの素早さ側は実装済み)/ 未確認 2 / 対象消滅 0。特性90件との名前重なり15件(中身の同一性は未確認)。W24 の 🙋「グランドコートが master に在るのにエンジン注記は未収録」は Fable 確認済み=**champions:false の PokeAPI 暫定行**なので Champions ビューに無いのは正しい(注記は正しい・対応不要)。**W25(02:30)= 新規11件のフェーズ割当 草案** `review/_phase_assign_draft_new11_2026-09-05.json`(status: draft・`reference/_phase_assign/` には入れていない=採否は 🙋§6-3): ARシステム P04 / うなぎのぼり P01b+P06e+P11b / おもかげやどし P03(テラスタル起動=憲法§22で意図的不実装なので**実装対象外になる可能性**)/ はどうのぼうご P10b(実装済 L2017-2027・接触判定が isPhys 代用=既知の穴)/ ほのおのたてがみ P08a / メガストーン6件 mega_evolve。**Fable 裏取り(ほのおのたてがみ)**: ポケモンWiki『こうげき・とくこうを1.5倍にしてダメージを計算』+ Bulbapedia『Attack or Special Attack stat is multiplied by 1.5』= **機構は能力値×1.5(はがねつかい型)であって威力×1.5ではない**。ただし公式フレーバー/ヤックン文は『威力が1.5倍』なので effect_ja は変えない(説明文=公式準拠・機構の事実は③の「事実の表」に持つ)。はがねつかいも同じ型(master 文は威力・機構は能力値)。**§8(W26・02:45)= 重なり15特性の1件ずつ照合**: 同じ穴14 / 別の穴1(アロマベール: 90側=自分の状態技5種免疫・87側=ダブルの味方保護)/ 解決0(おうごんのからだ・もふもふ・ほうしは説明文だけ解決済み・機構は未実装)。87側は内部重複(はやあし3行・ふしぎなうろこ3行・おうごんのからだ2行)があり、実装リストでは1件に畳む。**W27(03:00)= ③実装バックログ統合 `review/_battle_rework_backlog_2026-09-05.md`**: 90件監査+87件棚卸し+設計42+新規11草案を1本の票(B001〜B169・実数168件)に。種別=特性103/ルール28/技15/持ち物15/フェーズ骨格6/複合1・フェーズ割当済117/未割当46/新設待ち5・依存で止まる21件(主にB064ダブル基本構造)。§4に並び順の案(決定は阿部さん)・§5に🙋8点→**Fable が master 実測で §6 に訂正**: ナイトメア=Bad Dreams(実在・疑義なし)/グランドコート=W24で解決済み/ヒーリングシフト=Triage(技でなく**特性**・master 実在・champions:false)。§5-1(アロマベール)も t11_spec_g4 の spec 欄実読で決着=自己免疫側(6種・味方保護はダブル時と明記)。**阿部さん判断が要るのは §5 の 2(B064ダブル構造の着手要否)/3(特性103件の粒度)/7(おもかげやどし=テラスタル部分の切り分け)だけ**。§6 に 🙋5点(87件側の扱い/きずなへんげ champions:false/新規11件の割当/`real_battle_simulator.html` の「凍結」の定義=9/3に M-C 対応コミットあり/198件3分類の在り処)。
