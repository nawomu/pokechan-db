# HANDOFF — 2026-07-01 PART2(技データ品質を全数検証で高水準化＋DB統一設計＋標準フロー確定)

最終更新: 2026-07-01 JST。前回=`HANDOFF_SESSION_2026_07_01.md`(PART1)。
**引き継ぎ必読順: CLAUDE.md → 本書 → `次回ここから.md`冒頭PART2 → `技データ作成_標準フロー_2026-07-01.md` → `設計_DB統一_2026-07-01.md`**。
> ⚠️ このセッションの成果は**全部ローカル・未push**(本番pchamdb.com未反映)。本番反映は阿部さんの声サインオフOK後。

---

## 0. 一言サマリ
①**技データ作成の標準フローを6ステップに確定・文書化**(ヤックン→検証→effects→sim→compose→比較)。②**ヤックン(参照データ)の二重汚染を発見＆完全修復**(型名欠落28/28・authentic再取得法を確立)。③**compose品質を全919技で全数監査**し、原因の「焼き込み陳腐化」を**焼き込み撲滅(compose再生成)という systematic fix で一掃**。④**技の挙動sim全数テスト**を構築し「効果が実際にsimで発動するか」を検証(実バグflame-burst発見・修正)。⑤特性の三者照合監査＋Conquest60削除＋**DB統一(1本化)設計**。⑥GLM併用(設計=Claude/実装=GLM/検証=Claude)。

---

## 1. このセッションでやったこと(カテゴリ別)

### A. 標準フロー確定(最重要・今後の基準) ✅
`技データ作成_標準フロー_2026-07-01.md`。6步: ①ヤックン正しく取得 ②Wiki/他サイトで整合検証 ③ヤックン基準にeffects ④**simを徹底して回す** ⑤effectsからcompose ⑥compose↔ヤックン比較(**ちょっと違えばOK・丸写しNG**)。

### B. ヤックン汚染の発見＆修復 ✅
- **型名欠落**: `moves_yakkun`が、Yakkunの型名(`<img class=type_icon alt=くさ>`アイコン)を`innerText`で取りこぼし欠落(「すべての~~くさ~~タイプ」→「すべてのタイプ」)。**28/28修復**。
- **スラッグ不整合**: `moves_ja_desc`が別技の説明と紐付いていた(フラワーガード↔とどめばり等)=別の汚染。
- ★**authentic再取得法(実証済・再現必須)**: Yakkun `/ch/`(チャンピオンズ専用)を**ブラウザ同一オリジンfetch + `TextDecoder('euc-jp')` + type_iconのalt差込**で抽出。技一覧=`/ch/move_list.htm`(497・ch-id↔名前・ただしnational専用技は含まれず個別ページ掃引)。**ch-id≈全国版技番号**(オフセット0〜33)。レート制限あり=低速paced+time-box。詳細=`reference/_yakkun_typefix_status.md`。バックアップ=`moves_yakkun.json.pre_typefix_bak`。

### C. compose品質 全919技 全数監査＋焼き込み撲滅(★大成果) ✅
- (a) compose↔Yakkun(national427技・ワークフロー)→実バグ2(たがやす/フラワーガードのくさ限定漏れ)。
- (b) compose↔legacy(未監査465技・ワークフロー)→flag48。**検証で「effectsは正しいのに、ビルダーがChampions技の古い焼き込みdescを転記していた」と判明**。
- ★**焼き込み撲滅を実装**(`tools/_build_pokechan_data_all.js`に`composeDescH`=穴判定→**Champions技もcompose穴なしなら再生成**)。48 flagを一掃(どろぼう/きりばらい/フリーズドライ/ドレインキッス/ソウルビート/さいはい等が一発で正しく)。**=統一リビルドの核心(焼込撲滅→compose一本化)の先取り実装**。

### D. たがやす/フラワーガード くさ限定(全層修正) ✅
データ(`restrict_type:くさ`)＋compose(「場のくさタイプ全員の…」)＋**sim**(能力ランク変化で`target:all→[atk,def]両者`＋`restrict_type→型フィルタ`。`real_battle_simulator.html`のL3483〜。GLM実装/私検証: くさのみ+1・非くさ0で確認)。

### E. 技の挙動sim全数テスト(★STEP4=技をsimで実際に回す) ✅
- `tools/_sim_behavior_all.js`: クラッシュ有無でなく「効果が実際に発動するか」(ダメージ出る/状態付く/ランク動く/吸収でHP回復)を実エンジンで検証。偽陽性を精緻化(225→1)=タイプ免疫スキップ・確率N回試行・condition/restrict_type/2ターン/低probスキップ。
- **検証607技 / OK606 / 実バグ発見・修正: はじけるほのお(flame-burst)** = 固定ダメージのamountが日本語文で壊れ、威力70の主ダメージまで0にしていた(クラッシュしないので既存スイープでは不可視)。→ 壊れた固定ダメージeffect除去で修正。
- 残flag=ほおばる(木の実強制=きのみ所持条件の偽陽性)。sim全数スイープ919技/0クラッシュ・sim_test 814pass/2fail(T185d既知)維持。
- 補助チェック(天候/フィールド/自己回復)26/28 OK。effect値データ品質スキャン=破損はflame-burstのみ(他30は正規ラベル)。

### F. 特性・DB統一 ✅
- 特性効果 三者照合監査(Wiki全306+Yakkun)13修正・7却下(Wikiが外れ)。`reference/_ability_audit_findings.md`。**Conquest60削除**(ability_all=311・生成器フィルタ`id<10000`)。
- **DB統一(1本化)設計=`設計_DB統一_2026-07-01.md`**(全部版をSSOTに裏で作り直し→Champions抽出→本番差替。内部突合済=結合はid/slug・独自層薄い・タグ既に統一・compose engine共通)。

---

## 2. ★間違ったこと・失敗(必読)
1. **compose捏造イメージ**: 自分拘束を一律「地面に根をはって、交代できなくなる」と描いていた(はいすいのじん=背水の陣に誤適用・ねをはる用の言い回し)。→「自分は交代できなくなる」に修正。**教訓: composeは情景を勝手に足さない=メカニズムだけ訳す**(阿部さん指摘)。
2. **機械的な型名差し戻しは危険**: 壊れたyakkunに型名を正規表現で挿入したら、複雑な技(みやぶる=ゴースト→ノーマル・かくとう等)で誤り多発。→ **authentic再取得が正解**。内部ソース(ja_desc)も汚染していたので鵜呑み禁止。
3. **サンプル/ヒューリスティックで安心しない**(PART1からの継続教訓): 挙動テストも偽陽性225件から精緻化して初めて実バグ1件が見えた。
4. **私の挙動テストのAPIミス**: 状態はsim内部で英語(burn/paralysis)なのに日本語(やけど)で比較→偽陽性大量。特性の登場時発火は`fireEntryAbility`(内部・top-level非公開)なのに手動呼びしてNG誤判定。**sim内部の表現を先に確認すべき**。

## 3. ★反省・教訓(lessons)
1. **焼き込みは陳腐化する**=compose(effects由来)を常に**再生成**すべき。焼込descの転記が48 flagの主因だった。→ 統一リビルドの核心。
2. **全数照合＋実挙動テストが最強**: 「compose↔参照」の全数監査で系統(焼込)が見え、「効果が実際にsimで発動するか」の挙動テストで隠れバグ(flame-burst=クラッシュしないが0ダメージ)が見えた。
3. **権威ソースは三者照合**: Yakkunも間違う(が正確)、Wikiは平文だがフレーバー、ja_descも汚染。単一を鵜呑みにしない。
4. **GLM分業が有効**だが、**GLMは5時間クォータ制**(2026-07-01 20:58に100%到達)。不在時はClaudeが実装も引き取る。

## 4. ★注意すること(cautions)
1. **★絶対=effects→compose(逆禁止)**。effects空で説明だけ手書きはsimが動かない=偽の完成。ヤックン**丸写し禁止**(独自化=「ちょっと違えばOK」)。
2. **本番Champions(`pokechan_data.js`)は依然 焼込のまま**。焼込撲滅は`pokechan_data_all.js`(全国版)のビルダーにのみ適用。**Champions側は統一リビルドでmasterから導出する時に解消**(それまで本番descは古いまま=push前に注意)。
3. **Yakkunスクレイプ**: Cloudflare+レート制限+EUC-JP+型名はimg alt。curl/WebFetch/GLMは403(ブラウザ必須)。高速掃引は~6件で遮断=低速paced。
4. **sim未実装**: ダイマックス(L3986明記)。→「ダイマックス相手には無効」系の説明欠落はmoot(bug でない)。
5. **キャッシュバスター**: JS変更時は`?v=`bump(waza_picker.js等)。
6. **声/意味の最終判定は阿部さん＋Claude**。GLMは機械ゲート(sim pass/fail・量産)まで。

## 5. ★次やること(おすすめ順)
1. **GLMクォータ回復後 or Claudeで**: ガーディアン・デ・アローラ(Z技)の固定ダメージamount「相手の残りHPの3/4」がパースされるか確認(flame-burstと同種疑い・Z発動ゲートの可能性も・優先度低)。挙動テストharnessにほおばる(木の実強制)スキップを足す。
2. **★DB統一リビルド着手**(本命・明日Fable5に設計を託せる)= `設計_DB統一_2026-07-01.md`のschema/ビルダー骨格。全部版SSOT→Champions view(旧schema互換で出力・焼込撲滅を本番Championsにも波及)→回帰(sim_test 505+全数スイープ)→本番差替。
3. **声サインオフ**(`review/waza_list_confirm.html`で効果↔ヤック=阿部さんの耳)=本番公開の前提。
4. 特性ページ仕上げ(所持ポケ0のJA名・i18n9言語)・index全国版セクションのi18n9言語値。
5. **本番push**(1〜3が阿部さんOK後・キャッシュバスター注意)。

## 6. GLM状況
- **5時間クォータ100%使い切り(2026-07-01 20:58)**。Weekly 30%。回復まで実装はClaudeが引き取る。agmsg monitorモードON(チーム`pchamdb`/claude-design・glm-impl)。起動=`glm`コマンド。

## 7. 主要変更ファイル(このセッション)
- `tools/_build_pokechan_data_all.js`(★焼込撲滅=composeDescH)/`tools/_waza_compose.js`(restrict_type render・捏造修正・免疫注記)/`real_battle_simulator.html`(restrict_type+target:all)/`reference/moves_yakkun.json`(型名28/28)/`reference/moves_battle_data_fix.json`(restrict_type・flame-burst)/`reference/abilities_master.json`(Conquest除外・Champions4追加)/`tools/_fetch_pokeapi_masters.js`(生成器フィルタ)/`pokechan_data.js`(ゆきふらしゆき・abilities_desc_ja12修正)/i18n/ui-*.json(全国版9言語)/index.html(全国版セクション)。
- 新規harness: `tools/_sim_sweep_all.js`(クラッシュ)/`tools/_sim_behavior_all.js`(挙動)。
- 記録: `reference/_yakkun_typefix_status.md` / `reference/_ability_audit_findings.md` / `reference/_compose_legacy_audit_result.json`。

## 8. 関連ドキュメント
`技データ作成_標準フロー_2026-07-01.md` / `設計_DB統一_2026-07-01.md` / `reference/_yakkun_typefix_status.md` / `CLAUDE.md` / `わざ説明文_開通手順.md` / `ヤックン耳_判断ログ.md` / `review/rules.html`。
