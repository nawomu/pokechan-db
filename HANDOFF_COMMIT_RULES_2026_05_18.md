# 全セッション必読: commit 操作ルール — 2026-05-18

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB01 (リーダー)
**宛先**: **全セッション (DB02 / P301 / P302 / P303)**
**根拠**: P302 報告書 `HANDOFF_P302_TO_DB01_2026_05_18_TASK_G.md` の「commit 巻き込み事故報告」

---

## 🚨 ひとことで

> 4-5 セッション並行運用中の **commit 巻き込み事故** を防ぐため、全セッション必須ルール。
> 違反事例: P303 が `git add .` で P302 の未 commit ファイルを巻き込み → 1 commit に 2 セッションの 2 タスクが混在。
> **個別ファイル指定 + `git diff --cached --stat` 確認の徹底** が解決策。

---

## 🔴 禁止コマンド(全セッション必須)

以下のコマンドは **絶対に使わない** (他セッションの未 commit ファイルを巻き込むため):

```bash
git add .             # ❌ NG — カレントディレクトリの全 modified を巻き込み
git add -A            # ❌ NG — repo 全体の全 modified を巻き込み
git add --all         # ❌ NG — -A と同義
git commit -a         # ❌ NG — 全 tracked file modified を強制ステージ
git commit --all      # ❌ NG — -a と同義
```

→ これらは **単独セッション運用ではOK**だが、4-5 セッション並行下では **競合の温床**。

---

## ✅ 推奨コマンド(全セッション必須)

### 1. 個別ファイル指定で `git add`

```bash
# 良い例
git add waza_picker.js
git add waza-list.html HANDOFF_P302_TO_DB01_2026_05_18_TASK_G.md

# 複数ファイルを一度に追加する場合も、ファイル名を明示
git add file1.html file2.css file3.json
```

### 2. commit 前に必ず diff 確認

```bash
git diff --cached --stat    # staged 変更のサマリ
git diff --cached            # staged 変更の詳細
```

→ **自分の作業以外のファイルが含まれていないか確認**。混入していたら `git restore --staged <他セッションファイル>` で除外。

### 3. working tree 状態を頻繁に確認

```bash
git status -s
```

→ `M battle_simulator.html` 等、自分が触っていないファイルが modified で残っていれば **他セッションが作業中** = touch しない。

---

## 🎯 推奨ワークフロー(全セッション、commit 前)

```bash
# 1. 最新化
git pull origin main

# 2. 状況確認 (他セッションの未 commit がないか)
git status -s

# 3. 自分のファイルだけ stage
git add <自分のファイル1> <自分のファイル2> ...

# 4. stage 内容を確認 (重要!)
git diff --cached --stat
#   ↑ ここで他セッションのファイルが含まれていたら絶対 NG
#   含まれていたら git restore --staged <そのファイル> で除外

# 5. commit
git commit -m "..."
```

---

## 🛡️ 各セッションの touch 境界(再掲)

ファイル別の owner ルール(HANDOFF_COLLAB_2026_05_18 + HANDOFF_SESSION_TOPOLOGY_2026_05_18 統合版):

| セッション | 触ってよいファイル | 触ってはいけないファイル |
|---|---|---|
| **DB01** | `HANDOFF_DB01_*.md` / `HANDOFF_COMMIT_RULES_*.md` / `HANDOFF_SESSION_*.md` / sitemap.xml (例外) | 実装系 HTML/CSS/JS 全般、他セッション領域全て |
| **DB02** | `i18n/types-master.json` / `i18n/runtime.js` / `i18n/ui-*.json` (新 namespace) / `pokemon_db_v9.html` / `ad-toggle.js` / `HANDOFF_INDEX_2026_05_18.md` | battle_simulator / type_chart / waza_picker / waza-list / 法的ページ(自分が触る予定の時を除く) |
| **P301** | `battle_simulator.html` (本体) | 他全て (あべ直管理) |
| **P302** | `battle_simulator.html` (P301 と被らない時) / `items_database.js` / `waza_picker.js` / `waza-list.html` / `HANDOFF_PHASE3_*.md` | type_chart / pokemon_db_v9 / 法的ページ / index 主要部 |
| **P303** | `type_chart.html` / `i18n/ui-ja.json` の `type_chart.*` のみ / `HANDOFF_PHASE3_03_*.md` | battle_simulator / pokemon_db_v9 / waza_picker / waza-list / 法的ページ |

→ 自分の touch 範囲外のファイルが working tree に modified で出ていたら、それは **他セッションの作業中** = 触らない。

---

## 🚨 巻き込み事故が起きた場合の対処

### 検出方法

commit 後、`git show <commit> --stat` で確認:
- 自分の作業ファイルだけが含まれているか
- 他セッションのファイルが混入していないか

### 混入が発覚した場合

#### 軽症(まだ push してない)

```bash
# 直前の commit を取り消し、stage は維持
git reset --soft HEAD~1

# 他セッションのファイルを unstage
git restore --staged <他セッションのファイル>

# 自分のファイルだけで再 commit
git commit -m "..."
```

#### 重症(既に push 済)

巻き込み事故が push されてしまった場合:
- **revert は避ける**(他セッションの作業も巻き戻ってしまう)
- **報告書に「commit 巻き込み事故報告」セクションを追加**(P302 が `013b271` で実施した例参照)
- DB01 が状況を集約 → 必要なら全セッションへ通知

---

## 📋 各セッションの確認チェックリスト

**作業開始時**:
- [ ] `git pull origin main` で最新化
- [ ] `git status -s` で他セッションの作業が working tree にあるか確認
- [ ] あれば、その owner と自分が触る予定ファイルが重ならないか確認

**commit 直前**:
- [ ] `git add <個別ファイル>` で stage(`.` / `-A` / `commit -a` 不使用)
- [ ] `git diff --cached --stat` で stage 内容を目視確認
- [ ] 他セッションのファイルが混入していないか確認
- [ ] 混入していたら `git restore --staged <ファイル>` で除外

**commit 後**:
- [ ] `git show HEAD --stat` で内容確認
- [ ] 想定どおりのファイル群か再確認

---

## 🔗 関連

- 事故報告原典: `HANDOFF_P302_TO_DB01_2026_05_18_TASK_G.md` (line 200- 「commit 巻き込み事故報告」)
- 担当領域マップ: `HANDOFF_COLLAB_2026_05_18.md`
- セッショントポロジー: `HANDOFF_SESSION_TOPOLOGY_2026_05_18.md`
- 全 5/18 HANDOFF カタログ: `HANDOFF_INDEX_2026_05_18.md` (32 件版、DB02 が `0b31bca` で更新済)

---

## 📌 5/19 以降の運用

- 新セッション起動時、最初に **本書 + HANDOFF_INDEX を確認**
- commit 操作で迷ったら DB01 に判断仰ぎ
- 巻き込み事故が再発したら DB01 経由で全セッションに再周知

---

**全セッション、本ルールに従い 5/19 以降の作業を進めてください。**
