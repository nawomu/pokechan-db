# HANDOFF — 2026-07-02（DB統一 本番公開＋バトルスプリント第1弾＝Showdownオラクル検証合格）

最終更新: 2026-07-02 夜。前回=`HANDOFF_SESSION_2026_07_01_PART2.md`。
**✅ このセッションの成果は本番公開済み(pchamdb.com・コミット10本push済)。**

## 0. 一言サマリ
①**DB統一(T1〜T5)完走・本番公開**: 統一マスターSSOT→Champions view→回帰全ゲート→pokechan_data.js差替→push。②**監査4本**(Showdownフラグ突合/意味要素チェッカー/特性逆引き/compose統一性)→**P1〜P8の系統修正**(接触110技・踊り/風/弾/粉・Max/Zメタデータ+タグ・世代availability+世代列9言語)。③**バトルスプリント**: 特性4件実装(20/20)・持ち物14件実装(14/14)・**Showdown差分オラクルで一致率99.2%(120局面)=うちのダメージ式は正しいと証明**。④体制: 夜間自走ループ(/loop+Sonnetサブエージェント+検品)で回した。GLMは夜間クォータ切れで不参加。

## 1. 本番公開されたもの(pchamdb.com)
- **pokechan_data.js = 統一master由来に差替**(desc全再生成・move_no正規化7技・フラグ純増58)。バックアップ=`pokechan_data.js.pre_unify_bak_20260702`(ローカル・gitignore)。
- 統一マスター`reference/master_{pokemon,moves,abilities,items}.json`+ビルダー3本(`build_master.js`/`build_champions_view.js`/`build_national_view.js`※全国版も master参照化済・旧ビルダー@deprecated)。
- フラグ/メタデータ: 接触277技(SD完全一致)・切る/噛み/パンチ/音/波動/弾/風/踊り/粉・is_max/z構造(専用Zワザ文)・availability(世代列・ui-*9言語)。タグ新設: Zワザ/ダイマックス/相手全体/場の全員/切る/風/踊り/粉。
- sim新実装: 特性=すてみ/ぼうじん/てつのトゲ/りんぷん。持ち物14件=こだわりハチマキ/メガネ・いのちのたま・とつげきチョッキ・ゴツゴツメット・かえんだま・どくどくだま・たつじんのおび・ふうせん(消滅)・くろいヘドロ・ちからのハチマキ・ものしりメガネ・パンチグローブ・しんかのきせき(NFE450種セット内蔵)。
- 全国版にコインビーム合流(920技)。

## 2. 検証基盤(今後の柱)
- **Showdownデータ取込**: `reference/_showdown/{moves,abilities,items,species,learnsets}.json`+MIT LICENSE(取得=vendor/showdown npm→Dexダンプ)。3段活用=①データ突合②差分対局③実装教科書(`設計_バトル再現ファースト_逆算_2026-07-02.md`)。
- **テストハーネス群**(tools/): `_ability_interaction_test.js`(特性20/20)・`_item_interaction_test.js`(持ち物14/14)・`_showdown_det_test.js`(決定論120局面99.2%)・`_showdown_diff_test.js`(乱数独立で参考値)・`_meaning_audit.js`(意味要素)・`_compose_consistency_audit.js`(compose統一性)。
- **回帰ゲートの定型**: _sim_test 814/2(T185d既知)・_sim_sweep 920/0・_sim_behavior 607/0・build_champions_view unexpected=0・PCHAM_DATA env varで任意データ差し込み可。

## 3. ★重要な確認事項(検証で確定した事実)
- **うちのダメージ式・相性・STAB・実数値計算は正しい**(SD差分53件は全件「乱数系列独立」が原因と証明=`reference/_diff_root_cause_report.json`)。
- 残る既知差=**こだわり系×1.5の丸め順**(±2HP・det test 1件)→次タスク。
- ヤックン耳の観点: 説明文はeffects→compose一本(MDESC=0件)。「ダメージ。」接頭辞の要不要は**阿部さん保留のまま**。

## 3.5 ★7/3早朝の追記(ループ続行分)
- こだわり系×1.5=攻撃実数値適用(SD準拠)に修正→det 120/120。
- 決定論ハーネス200局面に拡大(やけど半減/天候/壁/チョッキ/からげんき)→**200/200完全一致**(最後の3件はハーネスの急所検出漏れ=エンジン無罪)。
- **結論: うちのダメージエンジンはShowdown(≒実機)と決定論200局面で完全一致。**

## 4. 次やること
1. ~~こだわり丸め順~~✅ 2. ~~決定論ハーネス拡大~~✅(200/200)→det testを定期回帰ゲートに組込む運用へ。
3. 全国バトル版sim(全ポケ使用可・データは揃った)・持ち物残り(Champions外の538-159件)・skip特性8件(かぜのり等=全国版ポケ導入時)。
4. 意味監査の軽微残(P4残の表記統一)・確認ビュー最新化・耳確認(阿部さん)。
5. GLM復帰時: 相互作用テストの拡大量産など機械作業。

## 5. 運用メモ(今夜の学び)
- 夜間自走= /loopダイナミック+Sonnetサブエージェント直列+完了通知駆動+25分ハートビート。エージェント出力ファイルは完了時書込=mtime生存判定は不可(誤検知2回)。長時間エージェントはSendMessageでnudge→だめならTaskStop+設計を確定させて縮小再投入が有効。
- agmsgモニターは数十分で落ちる(4回再起動)→落ちたら再アームでOK。
