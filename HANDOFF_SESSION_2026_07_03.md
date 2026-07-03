# HANDOFF — 2026-07-03（オラクル検証200/200完全一致＋多言語の構造化・完全化）

最終更新: 2026-07-03 夜。前回=`HANDOFF_SESSION_2026_07_02.md`(DB統一公開・必読)。
**✅ 成果はすべて本番公開済み(pchamdb.com)。ただし§4-1のPagesデプロイ障害の顛末を必ず読むこと。**

---

## 0. 一言サマリ
①(早朝)**Showdown決定論差分テスト200局面で完全一致(200/200)**=こだわり系×1.5を攻撃実数値適用(実機準拠)に修正+ハーネスの急所検出バグ修正で達成。**うちのダメージエンジンは実機同等と証明済み**。②(午後)阿部さんの実地レビューで多言語漏れ16件発見→全解消。③**構造的多言語化**=「絶対多言語になる前提」の構造(辞書自動生成/共通アクセサ/STRICT監査/release_check)。④**技説明文を全1417技×8言語で完全化**(WF並列翻訳640件)+items/moves_db_allのベタ書き2721件解消+タグ語彙345種。

## 1. 今日できたもの(全部公開済み)
- **sim**: det test 200/200(tools/_showdown_det_test.js・回帰ゲート入り)。こだわり系=攻撃実数値にfloor適用(SD/実機準拠)。
- **多言語パッチ16件**: ポケモン名辞書315→1288件(全ページ共通)/特性ホバー+説明9言語/技一覧ポップアップ/わざ列ヘッダ/習得数(新技は—が正: Z・ダイマ・ピカブイ限定)/新タグチップ+カテゴリ再編(対象カテゴリ新設)/Genフィルタ/タイトル/持ち物モーダルカテゴリ見出し/ability_allモーダル名前/items_db_all標準ヘッダー/更新日付6箇所撤去/news.htmlに07/03告知。
- **構造(#13)**: `tools/build_i18n_entities.js`(master→i18n辞書・冪等※generated_at廃止済)/`I18N.name(kind,id)`・`I18N.desc(kind,id)`(i18n/runtime.js)/STRICT監査(ALLOWLIST36件=全て根拠付き独自エンティティ)/`tools/release_check.sh`=**push前必須ゲート(構文+冪等+監査)・現在exit 0**。設計=`設計_構造的多言語化_2026-07-03.md`。
- **翻訳**: moves.desc全1417技×8言語=空0(WF32+7エージェント・ja混入0・scratch=reference/_transl_scratch/はgitignore)。
- **静的ページ**: items_db_all(1781)/moves_db_all(940)を`data-slug`+ランタイム言語スワップ化(生成器=tools/_build_items_db_all.js等)・STRICT監査対象に昇格。
- **タグ語彙**: move_tags_i18n 286→345種×8言語。

## 2. ★失敗と教訓(必読)
1. **`git add -A`事故**: 大量コミット時にスクラップ255ファイル(阿部さんの手描きシートスキャン/説明用スクショ/バックアップ/監査チャンク)が公開リポジトリに混入→直後のコミットでHEADから除去+.gitignore恒久化済み。**ただしgit履歴(9a1405c)には残存→履歴書き換え(force-push)の可否=阿部さん判断待ち**。教訓: 公開リポジトリでgit add -A禁止・コミット前にadd対象を必ず目視。
2. **Pagesデプロイの一時障害**: 76db797のdeployジョブが失敗し最後の3コミットが約2時間未反映だった(阿部さんのGitHubメールで発覚)。空コミット再トリガーで復旧。**新ルール: push後は`curl | grep 新バスター`でライブ反映確認まで**(memory: self-verify-pdca-rule)。
3. **ビルダーの冪等性**: generated_atタイムスタンプが冪等性を壊していた→廃止。「ビルド2回=差分0」がrelease_checkのゲート。
4. **翻訳worklistの選定基準ミス**: 「enに無いもの」だけ抽出→enには有るが他言語に無い42件が漏れた(尻尾WFで回収済)。全数照合は言語ごとに。
5. **長時間エージェント運用**: 出力ファイルは完了時書込=mtime生存判定は不可(誤検知2回)。後追いSendMessageは処理されないことがある→**完了後に「明示リストで再開」が確実**。停滞はnudge→TaskStop+設計確定させて縮小再投入。
6. **並行書き込みの回避**: 翻訳WFはscratchに書かせ、i18n/*.jsonへのマージは他エージェント完了後に自分で(read-modify-writeレース回避)。

## 3. 運用ルール(今日確定・恒久)
- **リリース手順**: ①release_check.sh exit0 ②キャッシュバスターbump ③news.html更新(手動更新日付は全廃済み) ④push ⑤**ライブ反映確認**(curl+バスター)。
- **新規ページチェックリスト**: 標準ヘッダー(ナビ+言語切替)+フッター/i18n配線(生ja禁止)/エンティティは共通辞書ID参照/バスター/ニュース。詳細=`設計_構造的多言語化_2026-07-03.md`。
- **ALLOWLIST運用**: 意図的ja(独自エンティティ・法務)のみ・1件ずつ根拠コメント必須・乱用禁止。

## 4. 次やること
1. **阿部さん判断待ち**: (a)git履歴書き換えの可否 (b)「ダメージ。」接頭辞の要不要(耳) (c)G-Max33技収録 (d)キック技フラグ予防付与。
2. **新技の外国語名がenフォールバックのもの**(例: fr aqua-cutter="Aqua Cutter"→正式は"Tranch'Aqua")→master_pokemon/movesのnames欠落をPokeAPI再取得で補完(でっち上げ禁止)。
3. **バトル続き**: 相互作用テスト拡大(3軸=特性×技×持ち物の狙い撃ち層)/skip特性8件(かぜのり等=全国版ポケ導入時)/det testの局面拡大・定期回帰化/全国バトル版sim(=設計を先に見せる案件)。
4. 耳確認(review/waza_list_confirm.html=最新)・GLM再稼働時はagmsgモニター張り直し(数十分で落ちる仕様=落ちたら再アーム)。

## 5. 主要新規ファイル(今日)
tools/: build_i18n_entities.js / release_check.sh / _showdown_det_test.js(200局面) / _build_items_db_all.js / _build_moves_db_all.js / _ability_interaction_test.js / _item_interaction_test.js / _meaning_audit.js / _compose_consistency_audit.js
docs: 設計_構造的多言語化_2026-07-03.md / 実装計画_技フラグ・メタデータ補完_2026-07-02.md / 設計_バトル再現ファースト_逆算_2026-07-02.md
