# HANDOFF: CLAUDE.md 改善提案 (未実施)

**作成**: 2026-05-27 JST
**作成セッション**: Claude Code (/init レビュー時)
**状態**: 🟡 提案のみ。あべ承認待ち、未着手
**対象ファイル**: `/Users/masamichi/Documents/ポケモンDB/CLAUDE.md` (現行 33 行)

---

## 経緯

`/init` を実行した際、既存 CLAUDE.md を上書きするのではなく、現状を読み込んで不足箇所を提案する方針に切り替え。本書はその提案を後続セッションが拾えるよう残したもの。

現行 CLAUDE.md は「Claude が誤った前提で動かないための最低限のガード」に絞られており、簡潔さは長所。以下は **追記候補** であり、必須ではない。採用可否はあべ判断。

---

## 提案サマリ

| # | 内容 | 必要度 | 根拠 |
|---|---|---|---|
| 1 | 静的サイトであることの明示 (ビルド/テストランナー無し) | 高 | 新規 Claude が npm/test で迷子になる |
| 2 | git commit 禁止コマンド (`git add .` 等) | 高 | 巻き込み事故が複数回発生済 (`HANDOFF_COMMIT_RULES_2026_05_18.md`)。Claude のデフォルト挙動と衝突するので明示が要る |
| 3 | 並行セッション運用 (`shared/` 連絡ボード) | 中 | `shared/` は `.gitignore` 除外で気づかない |
| 4 | SSOT データアーキへのポインタ (`HANDOFF_DATA_ARCHITECTURE.md`) | 中 | 既存「マスター DB を信頼」と隣接、対象が複数あるので明示すると事故予防 |
| 5 | 公開ドメイン (`pchamdb.com` / CNAME) | 低 | CLAUDE.md に書くほどでもないかも |
| 6 | マスター DB 表記の精緻化 | **要事実確認** | 後述 |

---

## 追記ブロック ドラフト (採用時にそのまま使える形)

### Block A: プロジェクトの性質 (項目 1)

挿入位置: 現行「最終更新」行の直後、「## ポケモンデータの参照ルール」の前

```markdown
---

## プロジェクトの性質

**ビルドプロセスなしの静的サイト** (https://pchamdb.com / GitHub Pages)。HTML を直接編集 → git push → 即配信。npm / バンドラ / テストランナーは使わない。動作確認は実ブラウザで行う。

HTML は `<script src="pokechan_data.js">` で SSOT を直接参照し、i18n は `<script defer src="i18n/runtime.js">` で 9 言語ランタイム切替 (`I18N.t/pokemon/move/ability/nature/type`) を行う。
```

---

### Block B: SSOT データアーキへのポインタ (項目 4)

挿入位置: 現行「## ポケモンデータの参照ルール」セクション内に補強として追加

```markdown
**サイト内データの重複は禁止**。新規ページは独自配列 (`const POKEMONS = [...]`) を埋め込まず、マスターを `<script src>` で参照する。マスター一覧と HTML→JS 依存関係は `HANDOFF_DATA_ARCHITECTURE.md` を参照。

公式ソース優先順位: PokeAPI → マスター DB → Serebii/Game8 → アルテマ → Bulbapedia (転載不可、答え合わせのみ)。憶測でのキー命名は禁止。
```

---

### Block C: git commit ルール (項目 2、最重要)

挿入位置: 新セクションとして「## macOS 障害対策」の前

````markdown
---

## git commit ルール (並行セッション運用の前提)

複数セッション並行で巻き込み事故が頻発した経緯から、以下を厳守 (詳細: `HANDOFF_COMMIT_RULES_2026_05_18.md`)。

**禁止コマンド**:
```bash
git add .         # 他セッションの未 commit を巻き込む
git add -A
git commit -a
```

**必須フロー**:
```bash
git status -s                 # 他セッション作業の有無を確認
git add <個別ファイル名>        # ファイル名を明示
git diff --cached --stat      # stage 内容を目視確認 (必須)
git commit -m "..."           # 想定外ファイルがあれば git restore --staged で除外
```

巻き込みが起きたら push 前なら `git reset --soft HEAD~1` でリカバリ。push 後の revert は他セッションも巻き戻すため避ける。
````

---

### Block D: 並行セッション運用 (項目 3)

挿入位置: Block C の直後

```markdown
---

## 並行セッション運用

**i18n セッション** と **phase3 セッション** が恒常的に同時進行する想定。`shared/` ディレクトリ (git 除外) が連絡ボード:

- `shared/STATUS_i18n.md` / `shared/STATUS_phase3.md`: 各セッションの現状ボード
- `shared/incoming/` / `shared/outgoing/`: 単発長文連絡
- Slack `#pokechan-db-sessions` (`C0B5ET0FQ7P`): 短文中継

セッション開始時は `shared/README.md` + 相手の `STATUS_*.md` を読む。担当領域・編集前宣言ルール等の運用詳細も同 README に集約。
```

---

## ⚠️ 要事実確認: 項目 6 (マスター DB 表記の不整合)

**現行 CLAUDE.md (2026-05-14)**:
> マスター DB: `pokemon_db_v9.html` の `const DATA = [...]`

**`HANDOFF_DATA_ARCHITECTURE.md` (2026-05-21 新設)**:
> ポケモン基本 (no, name, form, mega, type, 種族値) のマスター = `pokechan_data.js` の `POKEMON_LIST` / `DATA`

両者の関係について 3 つの可能性がある:

- **(a)** 両方が同じデータで、`pokechan_data.js` 側が「実コード参照用 SSOT」、`pokemon_db_v9.html` 側が「人間が読む形 / 図鑑ページ内部 DATA」で実体は同期している
- **(b)** 役割が分かれていて、図鑑表示用と party_checker / sim 用で別データ
- **(c)** 単に CLAUDE.md が古く、`HANDOFF_DATA_ARCHITECTURE.md` (5/21 新設) が新しい正解。CLAUDE.md の該当行は書き換えるべき

**観測事実** (今回のレビューで確認できた範囲):
- `pokechan_data.js` 冒頭コメントに「このファイルが Single Source Of Truth」と明記
- `pokemon_db_v9.html` は HTML 単体で動く図鑑ページ (依存: `pokechan_data.js`, `i18n/runtime.js`, `ad-toggle.js` ※ `HANDOFF_DATA_ARCHITECTURE.md` 記載)
- `pokemon_db_v9.html` の `const DATA` を実際に読んで両者の関係を確定する作業は **未実施**

→ 後続セッションへの依頼: `pokemon_db_v9.html` の `const DATA` がインライン保持なのか、`pokechan_data.js` の `DATA` を再エクスポートしているだけなのかを grep で確認のうえ、(a)/(b)/(c) を判定 → CLAUDE.md の該当行も合わせて修正。

---

## 採用時のオプション

後続セッションは、以下のどれかで進めて OK:

- **全部採用** (Block A〜D + 項目 6 確定後の修正) → CLAUDE.md を書き換え
- **一部採用** (例: Block C のみ最重要として先行採用)
- **却下** → 本書を `incoming/processed/` 相当の場所へアーカイブ

いずれにせよ、CLAUDE.md 編集は通常 phase3 領域。i18n セッションが触る場合は事前宣言推奨。

---

## 関連

- 現行: `CLAUDE.md`
- データアーキ: `HANDOFF_DATA_ARCHITECTURE.md`
- commit ルール: `HANDOFF_COMMIT_RULES_2026_05_18.md`
- 並行運用: `shared/README.md`
- バトルシミュ設計: `HANDOFF_PHASE3_SIMULATOR.md`
