# Astra(gpt-6-astra)への全面引き継ぎ(2026-09-05・阿部さん指示)

> 阿部さん原文(9/5 夕): 「Claudeがアストラを動かすんじゃなくて、逆にしてほしい。アストラに設計と構築を譲ってほしい。アストラに今Claudeがやってるこのポケモンの仕事を全部引き継いでみて、うまくいくかどうか、どのぐらいできるかを評価してほしい。」

## あなた(Astra)の役割
- **このセッションでは、あなたがこのプロジェクトの唯一の作業者**です。これまで Claude(Fable=設計/検証、Sonnet=実装)がやっていた仕事を、**設計も構築も検証も**あなた一人でやってください。Claude は今回**評価だけ**(手を出さない)。
- 決定権は阿部さん(人間)。**判断が要ること(好み/方針/文言の声/公開)は決めずに🙋で列挙**して止まる。Claude は「🙋を正しく残せたか」も評価します。
- 新しい Claude セッションが立ち上がった時と同じ手順で始めてください:
  1. `AGENTS.md` → 2. `CLAUDE.md`(全部) → 3. `今後の計画_ロードマップ.md` 冒頭 → 4. `次回ここから.md` 冒頭 → 5. 最新 `HANDOFF_SESSION_*.md` → 6. 着手する領域の設計書(CLAUDE.md ★の表が指すもの)
- 何をやるかは**自分で選ぶ**(ロードマップと `次回ここから.md` の順序に従う)。「今できること」を1セッション分(目安: 2〜4時間分の作業量)進めてください。着手前に **やること宣言(何を・なぜ・どの順・どのゲートで確かめるか)** を `review/_astra_session_report_2026-09-05.md` の冒頭に書いてから始める。

## この試験の環境(事実)
- 作業場所 = git worktree `/Users/masamichi/Documents/ポケモンDB-codex`・ブランチ `astra/handover`(main から分岐)。**main は触れない**。
- sandbox = workspace-write。**git commit / push はできません**(.git は外側)。commit は評価後に Claude が代行する → 代わりに **変更したファイル一覧と commit 文案(日本語)** を報告書に書く。
- **ネットワークなし**。公式お知らせ/PokeAPI/Wiki への確認が要る所は「未確認・要ネット」と書く(記憶で埋めない)。ローカルの権威コーパス `reference/_authority_corpus/` は使える。
- `node`・`python3` は使える。`node_modules` は用意済み。Playwright 実機確認 = `python3 -m http.server 8000 &` を自分で立てて `node tools/_views_pdca_playwright.js` 等。
- 一時ファイルは `tools/_tmp_*.js` の命名で、終わったら削除。

## 守るもの(CLAUDE.md の要点・違反は即失格として評価する)
1. データは一つ: SSOT = `master/*.json`。直すのは `reference/_*_additions.json` / `_*_fixes.json` / `_regulations.json`(同名キーはマージ・上書きで消さない)→ `node tools/build_master_v2.js` → `node tools/build_views.js` → `node tools/_views_diff.js`(未説明差分0)→ `node tools/_ssot_guard_test.js` / `node tools/_page_guard_test.js`。
2. 生成物(`pokechan_data*.js` / `items_database.js` / `sprite_api_ids.js` / `review/db_rules.html` / 言語別ディレクトリ)は手で書かない。ページは `pokedb.js` からしか読まない。ページ専用データ・文字列直書き禁止(i18n 9言語1セット)。
3. 番人の基準を上げて通すのは禁止。`git stash` / `git checkout -- .` 禁止。
4. ③バトル作り直しの**実装は凍結中**(阿部さん解凍待ち)。バトル系(`real_battle*` / `online_battle` / `battle_lab` / `battle_simulator` / `fx_editor` / `real_battle_simulator.html`)は**設計・棚卸しのみ**。
5. 記憶で断言しない。根拠は「ファイル:行」かローカル権威コーパス。**外部URLを書かない**(通信不可=全部記憶になる)。
6. 説明文の文言・声は阿部さんの領域。勝手に「改善」しない。
7. 英数字は半角。名前は正式名称。

## 報告書 `review/_astra_session_report_2026-09-05.md`(必須・日本語)
1. やること宣言(着手前に書く)
2. やったこと(ファイル:行の根拠つき)・回したゲートと結果(出力を貼る)
3. やれなかったこと・途中で止めたこととその理由
4. 変更ファイル一覧 + commit 文案
5. 🙋確認してください(阿部さん判断が要ること)
6. 自己申告: 読んだファイル / 読めなかったもの / 推測で書いた箇所 / 使ったモデル名 / 所要時間の体感
7. 次回ここから(次のセッションへの引き継ぎ・`次回ここから.md` の書式に合わせて)

Claude(Fable)はこの報告書と diff を、①ルール遵守 ②ゲート実測(自分で再実行) ③設計の妥当性 ④🙋の質 ⑤引き継ぎ文書の質 で評価します。
