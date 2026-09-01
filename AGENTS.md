# AGENTS.md — Codex(および他エージェント)向けの入口(2026-09-02 新設)

★**まず `CLAUDE.md` を全部読むこと。** 本プロジェクトのルールの正本は CLAUDE.md(と、そこから指される設計書群)。本書は Codex 向けの差分だけを書く。

## 絶対ルール(CLAUDE.md の要点+Codex向け追加)
1. **データは一つ**: SSOT = `master/*.json`。ただし master は生成物なので**直接編集しない**。直すのは `reference/_pokemon_additions.json` / `_abilities_additions.json` / `_items_additions.json` / `_*_fixes.json` / `_regulations.json` だけ(全件根拠つき)。
2. **生成の流れ**: 入力を直す → `node tools/build_master_v2.js` → `node tools/build_views.js` → `node tools/_views_diff.js`(未説明差分0) → `node tools/_ssot_guard_test.js` / `node tools/_page_guard_test.js`(✅) → 実機 `node tools/_views_pdca_playwright.js`(要 `python3 -m http.server 8000`)。
3. `pokechan_data*.js` / `items_database.js` / `pokemon/` `ability/` 等の生成物・`reference/_legacy_snapshot/` は**手で書かない**。
4. **`git stash` 禁止・`git checkout -- .` 禁止**(並走エージェントの作業を消した事故あり)。自分が触ったファイルだけ扱う。
5. **推測で値を埋めない**。事実は権威ソース(ヤックン/ポケモンWiki/PokeAPI/公式)で裏取りし、出典を書く。二重チェック一致なら適用してよい(CLAUDE.md の two-source ルール)。
6. **説明文の文言・声の判断は人間(阿部さん)の領域**。勝手に文言を「改善」しない。
7. **公開の境界**: X投稿・外部送信は必ず阿部さんが実行。push は検証ゲートを全部通した後のみ。
8. 作業ログ: 大きな作業は `HANDOFF_SESSION_*.md` と `次回ここから.md` に追記(日本語)。

## いまの現在地
`次回ここから.md` の冒頭 → 最新 `HANDOFF_SESSION_*.md`。技監査R1の残り211件が主戦場(下記)。

## 技監査R1をCodexで回す(実験タスク)
- 材料生成: `node tools/_gen_move_audit_materials.js <出力dir>`(919件・LLM不使用)
- バッチ割: `reference/_move_r1_batches_rest_2026-09-01.json` の batches[3](100)/[4](100)/[5](11)
- ランナー: `bash tools/codex_move_audit.sh <材料dir> <batch番号>`(1技=照合→反証の2回 `codex exec`・結果は `reference/_move_audit_codex_r1/<slug>.json`・再実行は既存スキップ)
- 規律: 1件ずつ・一字一句・引用必須・まとめない(監査の丁寧さは削らない)。master の修正はしない(台帳に記録だけ)。
