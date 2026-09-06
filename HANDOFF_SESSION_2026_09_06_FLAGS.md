# 2026-09-06 Codex主体: 技フラグ統合と設計継続

## 停止・Claudeへ引き継ぎ(2026-09-06 12時ごろ)

**阿部さんの直接指示: Codex週間残30%のため今すぐ停止、続きはClaudeが担当。Codexは自動再開しない。ゴールは未達のまま中断(完了扱いにしない)。** 子担当2名も停止済み。pushなし。新しい調査/検証を追加せず、この引き継ぎとworktree内コミットまでで終了する。

### 実際の完了範囲

- 判断待ち棚卸しと入口整理を完了。旧9ページ/waza-list旧試作/表示順2列/試験採否の古いGO待ちは閉じた。
- `tools/_lib/move_flag_schema.js` と builderへ統合済み。919技に8列のboolean|nullを用意し、既存contact/protectをflagsへ移送、トップ列は派生互換列とした。旧58種類486セルとトップの真偽値を全数維持。新6項目5514セルはnullのまま。説明文・effects・battle実装は変更していない。
- `tools/_lib/move_flag_wiki_evidence.js`: 原文と世代付きの二次観測。無世代記述は候補のみ。
- `tools/_move_flag_audit.js`: slug別の引用/比較/保留理由とhashを保存。同じ入力の2回目は再計算0・書込0を確認。自動fix適用はしない。
- ヤックン/ch/実画面の8マスを **238/497技** 保存。残259技。ファイル=`review/_move_flag_audit_2026-09-06/sources/yakkun_ch.json`。JSONのrecordsキーはヤックンのURL番号であり、PokeAPI番号ではない。masterとのjoinは技名で行う。
- 行動順清書とB064段階計画は文書作成済み、最終採用の内容検収はClaudeへ引き継ぐ。本番battleコードは未変更。

### 検証と限界

- schema11件・Wiki12件・audit3件(各テスト内の複数ケースを含む)合格。
- build_master_v2 → build_views → views_diff未説明0 → ssot/page番人緑 → Playwright8/8ページ・名簿全件一致・JSエラー0。
- 独立レビュー=`review/_move_flag_integration_review_2026-09-06.md`。HEAD比較で旧flags/他の技フィールドの退行0、他masterは日付のみ。views_diffには既存flags丸ごと許容があるため、HEAD全数比較を別に実施した。
- **監査完了ではない**。現在のsummaryは919技/7352セル保留、eligible0。Championsの世代付き二次根拠が足りず、Wiki候補一致を確定に格上げしていない。summary/observationsは収集途中の時点なので、238技保存後の再実行が必要。根拠つきfixの新規追加は0。
- 最後にbuilderへ追加した必須入力チェックは「全国習得技入力欠落時、masterを一切書かず異常終了」を実測済み。これを足した後の全ゲート再実行は停止指示により未実施(正常時の生成ロジックは同じ)。
- `set.flags`全体置換は旧キーを消せる将来リスクあり。今後の事実投入は`flags.*`で行い、丸ごと置換の防止を先に検討。作業メモ系キーの分離とball/bullet等の監査は残作業。

### Claudeの次の一手

1. このworktreeのコミットを確認。着手前差分`reference/_views_diff_report.json`と未追跡`codex_report_last_message.txt`/`node_modules`は他作業のものなので一括stage/削除しない。着手前原本=`/tmp/astra-main-sync-20260906/`。
2. 資料の所在を確認。`reference/_authority_corpus_ch/`内の4JSONと`reference/_pokeapi_learnsets_raw.json`はmainのignored資料へのローカルsymlinkで、コミットしない。全国習得技入力がないと過去には1273→316へ減ったため、現在は起動前チェックで停止する。
3. 保存済み238技をURLと名前で除外して残259技を取得。Claudeの利用可能な通常ブラウザ手段でよい。Codexは1技ごとに画面のtitle/URL/表を照合し3技ごとにlocal formへ保存した。名前とタイトル不一致は採らない。`tools/_move_flag_collect_server.py`を使うなら再起動(127.0.0.1:8766)。
4. 引用と対象世代を確認して一次/二次の不一致を反証する。別名統合・古い世代の転用・未確認をfalse化は禁止。`node tools/_move_flag_audit.js --master master/moves.json --primary-list ../ポケモンDB/reference/_authority_corpus_ch/moves_ch.json --primary-rendered review/_move_flag_audit_2026-09-06/sources/yakkun_ch.json --wiki-corpus ../ポケモンDB/reference/_authority_corpus --out review/_move_flag_audit_2026-09-06` で変更分のみ再処理できる。
5. 二重根拠の確定分だけ`reference/_moves_fixes.json`の既存slugへ追記→生成・全ゲート。必要な事実を調べる作業と、器を用意した作業を混同しない。その後に行動順設計/B064計画を検収。

停止時の検証ログは `review/_move_flag_audit_2026-09-06/checks/` に保存。常駐処理は停止する。ブラウザの生ページを再開条件にせず、ファイルから再開する。

---

## 以下は停止前の経過(履歴)

阿部さんの直接GOを受け、ゴールと独立担当2名のオーケストレーションで進行。現在は未完了。作業順=古い判断待ち整理→技フラグ統合→行動順清書→B064段階計画。全体③の実装凍結は維持。

- 作業場: `ポケモンDB-codex` / `astra/handover`。mainの`3b67cf31`へfast-forwardして開始。
- 着手前の差分 `reference/_views_diff_report.json` と未追跡 `codex_report_last_message.txt` / `node_modules` は他作業のもの。前者は `/tmp/astra-main-sync-20260906/` に原本とdiffを保全。無差別なstash/checkout禁止。
- 入口の古い判断待ちは `review/_pending_decisions_2026-09-06.md` に実装・git根拠で整理した。旧9ページ/waza-list旧試作/表示順2列は完了。現存items_db_all/moves_db_all等の別問題と混ぜない。

## 省エネの実行規律

`review/_move_flag_workflow_2026-09-06.md`。既存コーパスを再利用し、1技ずつの引用付き照合と反証を機械処理する。差分hashが同じなら再処理しない。収集は小バッチで永続化、同一失敗2回でその経路を止める。ゴール継続は利用するが、常駐cron/無人CLI再起動/空の待機ループは作らない。

## 根拠の現状

- 棚卸し=`review/_move_flag_inventory_2026-09-06.md`。919技、Champions497技。既存のsound等の値は維持し、別名を一律統合しない。
- mainのgit管理外 `reference/_authority_corpus_ch/moves_ch.json` は497技の接触/まもる2列。8マス全体の既存資料ではない。
- Wikiコーパスはmainの `reference/_authority_corpus/` にある。世代未指定やChampionsへの転用はcandidateとして保持、確定扱いにしない。
- 実ブラウザで取得したヤックン8マスは `review/_move_flag_audit_2026-09-06/sources/yakkun_ch.json`。ヤックンmove番号とPokeAPI番号は別物、URL番号でmasterをjoinしない。
- 取得経路の問題: 素のHTTP403。Chrome表示は成功したが長い一括処理が60秒制限で失われ、その後`Debugger unattached`が2回。再試行を打ち切り、claude-designへ既存資産/取得手段をagmsg照会。取得済みは保存1技。
- 公式M-C: `node tools/_watch_official_news.js --roster M-C --dry` と公式本文を確認、全一覧はまだ後日発表。入力変更なし。

## 次に検収するもの

1. flags正典への構造統合: 既存値を維持、contact/protectは派生互換列、新規未確認セル=null。新事実は二重根拠確定分だけfixes経由。
2. 全数差分/番人/実機。型整備を全データ監査完了とは呼ばない。
3. `設計_行動順再評価_2026-09-05.md` と `review/_b064_staged_plan_2026-09-06.md`。本番battleコードを変更せず、未確認の同速乱数/Champions細則を残して検収。

進行後にこの節へ実測・次の再開点を追記する。
