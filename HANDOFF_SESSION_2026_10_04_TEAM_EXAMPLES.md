# 構築例一覧・共通カタログ（2026-10-04）

## ローカル実装
- `team_examples.html` / `team_examples.js`: 出典付きの構築例一覧。初期3件は既存記事で確認済みの s / sahararara_1010 の6体。6体の設定・能力ポイント・作者リンク・確認日・M-Bシングル/M-5最終291位（作者報告、公式未照合）を掲載。公開日は未確認と明示。新しい実績や構築は捏造していない。
- `reference/_team_examples.json` が構築設定/出典の唯一の編集入力。`tools/build_master_v2.js` → `_team_examples_catalogue.js` → `master/team_examples.json` → `pokedb.js` の `teamExamples()` / `teamExample(slug)` → 一覧と既存記事。
- カタログは既存記事の設定形（pokemon/ability/item/movesのID、natureの補正ペア、pointsの6配列）を維持。種族値・技諸元・特性説明等は複製しない。記事固有の設定配列を取り除き、同じカタログを読む。元記事の本文、出典、過去シーズンの扱いを保持。
- 過去のレギュは記事メタデータ。現行ルールの `master/regulations` を復活/変更しない。既存の個体おすすめプリセットは別用途の既存機能であり今回編集していない。
- カタログは明示指定したページだけ読み込む。既存ページの既定8ファイル読込は保持。ページは直接JSONをfetchしない。
- `--team-examples-only` により他の進行中マスターを再生成せず、このカタログだけ更新できる。通常の全体ビルドでも同じ生成器を呼ぶ。
- 9言語UIキー、台帳、ルートホーム/既存記事の導線、canonical/OG/JSON-LD/hreflang、既存共通解析タグ、sitemap追加。言語別indexの大量再生成は行っていない。

## 内部ツールの導線と限界
ビルダーと `online_battle.html?format=single` への普通のリンク。自分/相手の自動転送は今回未実装。特性等を含め手入力することと、内部ツールが現在のDBを使うことを本文に明示。既存v1 handoffは自分側のみ・特性なし・相手ランダム。将来の両側渡しは既存の保存/通信形式を確認して別工程で設計する。公式ゲームとの接続なし。

## 検証
- `node tools/build_master_v2.js --team-examples-only`（既存マスター/ビューを再生成しない）
- `node tools/_team_examples_test.js`: 実際のPokeDBローダー、入力→生成器→マスター→両消費者の変更伝播、同じ参照、未知ID拒否、9言語のVM描画、出典/実績/過去ルール/内部リンクを検証。
- `node tools/_team_guide_test.js`: 既存記事の6体/24技/習得/特性/配分66・各32/54詳細リンク/9言語の検証。
- ページ番人・SSOT番人は悪化なし。views diffはUNEXPLAINED 0。SSOT/viewsのレポート出力のみ委譲タスクの作業領域へ向け、既存のレポートを上書きしない形で実行。
- JS構文検査成功。`waza-list.html`の既存4行レスポンシブパッチ保持。
- **画面/レイアウト/実ブラウザ言語切替は未検証**。既存プレビュー拒否を別サーバー/CLI/ブラウザで迂回していない。静的/VM成功を実機確認とは呼ばない。

## 保持と未実施
既存239件の変更を保持。今回の変更だけ追加。commit/push/deploy/インストール/設定変更なし。追加構築は出典と設定が確認されたものをこの入力1箇所へ追加する。画像や原文の転載なし。公開は未実施。

## Additional curated sources (3 examples total)
- popocco: https://note.com/popocco_piece/n/n24216bfd8794 (published 2026-09-21); singles, M-C, September monthly challenge rank 2783/rating 1654, author reported, not independently verified.
- can: https://note.com/can27809124/n/ncc1e19073302 (published 2026-09-22); singles, M-C, reached Master 2026-09-22, author reported, not independently verified.
- Parent researcher checked source text and individual-card images. No images or original paragraphs copied. Both season numbers remain null/unconfirmed. All 72 move references resolve and match the current learnsets.
- Floette pre-Mega ability remains null. Base form and two exact stone names are explicitly marked as shared-master resolutions, not direct source statements. Golisopod Mega form is resolved from the source stone and marked likewise.
- Golisopite (mega_stone_golisopod) is currently implemented:false in the master. The page shows the simulator limitation; no entity fact was changed to fit the source.

## 2026-10-04 design follow-up and narrowly scoped publication
- User-authorized publication completed ONLY for waza-list.html (4 inserted CSS lines): commit be6b6523823c34faeec3a6bcf2219e05e4dbc77c, pushed main. The pre-commit page/data guards passed. GitHub Pages run https://github.com/nawomu/pokechan-db/actions/runs/37195603167 completed successfully; public HTTPS HTML contains all three added CSS rules. No browser visual verification claimed. All team-example work remains uncommitted and unpublished.
- team_examples.html now reuses content.css and site-footer.css, the existing clean site logo, and page-only team_examples.css. Member cards show existing original images/sim artwork, shared-master type badges, ability/nature chips, held-item images, four moves, training-point table, and optional Mega-form artwork. Six-member thumbnail navigation links to each card.
- Item assets are resolved using existing images/item/_manifest.json, an asset manifest only. Master records remain through PokeDB. Missing images (including three new Mega stones) show an explicit placeholder and existing localized no-image tooltip. No external article images, new Pokemon/item facts, or duplicated type-color table were added.
- Actual Library-provided user/reference screenshots were read as authorized inputs; no automated browser or alternate preview route was used. Manual-only local server remains at 127.0.0.1:8000, process 93376 (PTY session 85857). Agent has not fetched its pages.
- Re-ran canonical catalogue/real-loader/SSOT propagation/9-language tests, existing article tests, page guard, SSOT guard (no worsening), views diff (UNEXPLAINED 0), JS syntax and git diff --check. The catalogue VM test also checks every rendered image path exists. Screen layout and live browser interaction await user inspection.

## Latest user-approved team-example publication scope
- User explicitly changed the artwork choice to API images and authorized publication of the construction examples plus necessary top links and sitemaps. This supersedes the original-artwork choice for this page. Existing real_battle API mode uses local images/poke/{master.pokeapi_id}.png; the page follows that convention with PokeAPI's existing raw sprite URL as a fallback, never original images/sim. New cached PNGs 10296 and 10316 were checked and downloaded from the same existing PokeAPI sprites path.
- Nine language top pages link from Strategy Guides to the runtime-localized shared list and article; non-Japanese links include ?lang. build_i18n_pages preserves this query when regenerating. sitemap.html includes both links; sitemap.xml is generated by tools/_gen_content_sitemap.js from the isolated publication HTML metadata (one canonical list URL plus nine runtime-language alternatives, no invented static pages).
- Independent in-progress Clear Body translation/source/master/entity-generator changes and their generated entity pages are excluded. The article uses the already-published shared ability dictionary; tests accept optional audited translations only when the published master supplies them. All battle work and other drafts remain excluded.
- The user-supplied screenshot was materialized through the current Library skill and actual pixels inspected. No automated local browser preview was attempted.

- Publication snapshot validation passed against HEAD plus the selected feature files: catalogue and article tests, nine-language navigation and every static asset, page/data guards (no worsening), views diff (UNEXPLAINED 0), and actual top-page generator regeneration. Generated sitemap delta is exactly two new canonical URLs with the list language alternatives; zero existing entries changed/removed. No installation, credential change, browser preview or unrelated source rewrite.
