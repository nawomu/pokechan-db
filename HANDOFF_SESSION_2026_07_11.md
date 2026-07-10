# HANDOFF 2026-07-11(オンラインバトル磨き+検証WF+プリセット実戦化・コンテキスト100%で区切り)

前: `HANDOFF_SESSION_2026_07_10_PART2.md`(必読)。本セッションは07-10深夜の続き〜07-11昼。**全push・ライブ確認済み。最終 b7418c26**。simベースライン=**823 pass / 2 fail(T185dどくびし既知)**(T309-T314追加で814→823)。

## 1. 今日やったこと(全部本番)
- **演出FB反映**: KO爆発のサブベース半減・KOスロー=タメ200ms→0.15倍速600ms(じっくり)。
- **AI戦に見せ合い選出**(6体表示→3体選ぶ→AIもランダム3体→3vs3)。`PICK.aiMode`+confirmPickのAI分岐+`_pickOverride`流用。
- **選出画面v5**: 編成カプセル(slotCapsuleHtml/.team-row .slot)をそのまま流用・中央=編成と同じ幅(250-300px)・相手=クリムゾン名前非公開・見出し=お互いの名前・弱点チップ(中央常設+相手hoverフロート=weakChipsFor)・持ち物表示。**「編成と同じデザイン・違うと違和感」が阿部さんの軸**。
- **交代画面v2**(Sonnet実装/Fable検証): 同デザイン統一。左=自分6体(**選外3体うっすら**.sw-ghost・ひんし✕・場に出ている印)/中央=読取専用詳細/右=相手6体(**場に出た子だけ表示・未登場=黒シルエット**.sw-hidden・HPバーのみ・名前/持ち物絶対非公開)。**AI戦にもCOMMAND45秒**(actTimerStartのゲート=in-battleクラスに変更・AI戦でもRB_ONLINE.fullTeams/revealedをstartBattleでセット)。
- **交代技の交代先選択**(07-10深夜): 技選択直後「だれに かわる？」・pivotIdxを行動と一緒に送信・エンジン`__rbSwitchPick(liveIdxs, sideKey)`side対応。
- **「ひんし状態のため行動できない」行削除**(阿部さん承認・実機準拠。engine 2箇所+battle_log_i18nパターン撤去)。
- **独自メガ=自作SVGフォールバック**(公式画像が無い姿のみ。判定=`poke.mega && !SPRITE_API_ID[poke.name]`。公式メガは公式画像のまま)。
- **モバイル: バトル開始でscrollTo(0,0)**(相手HPバー画面外の根治)。
- **MBアイテム4件解禁**: いのちのたま/たつじんのおび/ちからのハチマキ/ものしりメガネ(ヤックン権威で調査→フラグ更新のみ=エンジン実装済みだった)。**simテストT309-T314追加**。items_list.htmlは**手更新**(下記注意)。
- **プリセットv2**: GameWith上位255人の生JSON(S3直取り!)+ヤックン投稿420件=実戦1,748構築→**58ビルド**(`reference/preset_builds_draft_v2.json`・検証58/58)。**こだわりハチマキ/メガネ/チョッキ/ゴツメ/ふうせんは1,748件中0回=Championsに存在しない**(実データ確証)。実際の人気TOP5持ち物は全部実装済みに。**方針確定: 1体=1ビルド・メガが強い種はメガストーン型**。
- **技→エフェクト対応表 設計完了**(`設計_技エフェクト対応表_2026-07-11.md`+`reference/move_fx_map_draft_v1.json`=攻撃技326種100%カバー・3層解決(上書き61/フラグ規則/タイプ×分類既定36)・shapes27種)。
- **検証ワークフロー(3視点並列・350ターン・スクショ479枚)**=「ちょいちょいエラー」の正体特定。**JSエラー0・仕様バグ13件**(報告書=タスク出力 w72xat7z2。要点は§3)。
- エンジン+battle_log buster=**20260711a**。

## 2. ★注意・間違えた点(必読)
1. **エージェント編集中のファイルはgit addしない**([[agent-file-commit-lockout]])。07-10に2回巻き込みpush。キーワードgrepはすり抜ける(sw-card等)→**diff全文目視のみ例外**。
2. **items_list.htmlの再生成禁止**: `tools/_build_items_list.js`は現行ページより古い(現行はi18n配線を手強化済み)。再生成→残ja188×3言語=release_check赤。**手更新する**(メトロノーム行の書式を真似る)。TODO=ビルダー追随。
3. **`_review/` は.gitignore**(SSOT items_database.jsonはコミットされない。派生items_database.jsをコミット)。
4. **simテストの技キーはローマ字キー**(`data.WAZA_MAP['hataku']`)で、**みずでっぽうはDB非収録**だった。技を使うテストは必ず存在確認(なみのり等の収録技で)。
5. Playwrightのhover はリモート画像(HOME 3D)読込でレイアウトが揺れて"element is not stable"になる→**dispatchEvent(new MouseEvent('mouseenter'))で代替**。
6. ロビーの実Supabaseには**阿部さんの実ブラウザが残留していることがある**(名前「1」「2」等・旧バージョンのpresence)→E2Eは名前指定で対象を掴む。
7. presence再track=旧metaが残る→**revカウンタ最大のmetaを読む**(rb_online.js実装済み)。
8. release_checkの赤(551件など)は**まず「何のファイルを再生成/変更したか」**を疑う。
9. メガシンカ時の努力値: メガ種族値+同じ振りで再計算=正しい(実測: いじっぱりA32リザードン149→メガX 200)。

## 3. ★続きのやること(優先順)
**A. 検証WFの仕様バグ修正(エンジン・次の最優先)** ※報告書全文=/private/tmp/...tasks/w72xat7z2.output
1. **失敗技のPP消費**(本家は失敗でも消費)=**299ターン終わらないバトルの根治**。`real_battle_simulator.html` L4814/L5971の失敗分岐が`consumePP`(L5567)に到達しない。**2系統(ソロ/ロックステップ)両方に同時適用**。行動不能(ねむり/まひ/ひるみ)はPP不消費のまま=本家仕様の線引きを**権威ソースで裏取りしてから**。
2. **AIの不発技回避**: `aiScoreMove`が`requires/fails_if`を見ていない→`failsByCondition()`再利用で不発確定技を大減点。
3. **メガログの主語**: `megaEvolve()`(L5536)がst.poke差替**後**にpname→進化前名で出す+「◯◯は メガ◯◯に メガシンカした！」形式に。**battle_log_i18nのPATTERN/TPL 9言語同時更新+buster bump必須**。
4. 相打ち時のひんし表示順(被弾側告知→反動→反動側告知)+相打ち勝敗規則の権威裏取り(自己出力をゴールデンにしない)。
**B. プリセット58ビルドの組み込み**(データ完成済み): ①ボックス/プレビューに「おすすめビルド」ボタン→speciesMemoへ適用 ②**AIチーム生成をプリセット優先**(=AIが強くなる) ③v1とv2の統合(§9=v2優先・ウインディ/メガヘラクロスのみv1)。
**C. 技→エフェクト形状の実装**(設計/JSON完成済み): `shapeOf(mv)`をmoveClassOf後段に・接触突進の着弾グリフもshape化。**阿部さん確認5点**(はがね物理を全部歯車にするか/じばくに専用爆発形状/投擲技の形/コイン技/フェアリー物理のハートが可愛すぎないか)。
**D. レイアウト小物一括**: 技パネル補助ボタンのタップ目標44px化(モバイル)/技パネルと相手スプライトの重なり/言語ピルの重なり/real_battle編成のスタートボタン画面外。
**E. その他**: items_listビルダー追随・Wave4見た目磨き(色収差×メガの重なり=阿部さんFB待ち)・再戦フロー・不適切名フィルタ・ロビーpresenceのheartbeat(残留対策)。

## 4. ★ループ/ワークフローの回し方(今回確立した型)
- **体制**: 設計・検証・コミット=Fable(メインループ)/実装量産=Sonnetサブエージェント(Agent tool・model:'sonnet'・**git禁止を必ず明記**)/大規模調査=Workflow(並列fan-out→統合)。GLMはSonnet枠が切れた時の代替(glm headless)。
- **共有ファイルの直列化**: `online_battle.html`/`real_battle.html`を触るエージェントは**常に1体だけ**。エンジン(real_battle_simulator.html)/新規doc/referenceは並行OK。エージェント作業中に自分が同ファイルを直したくなったら**完了まで待つ**(直したらcommitはdiff目視後)。
- **ループ**: ScheduleWakeup 1800s(作業中)/3600s(待機)で再アーム。wakeupプロンプトに「①結果確認→自分でPlaywright検証→gate→commit(巻き込み注意)→push→ライブ確認→スクショ共有 ②次タスク起動 ③再アーム」を毎回書く。**毎心拍で見える報告+節目のみPushNotification**([[loop-visibility-feedback]])。
- **検証WFの型**(battle-pdca-check=再利用可): 3視点並列(solo長回し/オンライン2ブラウザ/モバイル)+スキーマ付き異常リスト→統合レポート。スクリプトは `~/.claude/projects/.../workflows/scripts/` に保存済み(resumeFromRunId可)。
- **調査WFの型**(fx-design-research): 並列リサーチ(スキーマ付き)→統合エージェントが仕様書を書く→docに保存→実装エージェントは「docが正」で起動。
- **完了条件の定型**: sim 823/2既知・JSエラー0・release_check exit0・push後ライブCDN確認(curl grep)・9言語(新文言はui-*.json同時+audit 0)。
- **E2Eの定型スクリプト**: scratchpad/test_lobby3.js(申し込み制ロビー)/test_pick_e2e.js(選出)/test_battle_v3.js(バトル)— 実Supabaseで2コンテキスト。

## 5. 実行中/未完のもの
- 実行中のエージェント/WF: なし(全部完了・回収済み)。ScheduleWakeupも未アーム(クリア後に必要なら再アーム)。
- 未コミットの残置(前セッション由来・触らず): HANDOFF_SESSION_2026_07_07.md(+17行)/review/sim_test_report.html/reference/_sprite_missing.json 等。
- ロビーに阿部さんの旧ブラウザ(名前「1」「2」)が残留していることがある→本人がタブを閉じれば消える。
