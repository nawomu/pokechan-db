# HANDOFF: 次セッションへの引き継ぎ (2026-05-20 PART2 → 次)

**作成**: 2026-05-20 JST 夜
**前セッション**: Claude Opus 4.7 / 前セッション (`HANDOFF_I18N_NEXT_SESSION_2026_05_20.md`) からの引き継ぎ完了後の作業
**ステータス**: 主要 4 修正 push 完了 / 振る舞いガイド永続化完了 / 残作業は段階 2 のみ

---

## 一番最初に読むファイル (順番厳守)

1. **本ファイル** (現在の作業状態)
2. **グローバル `~/.claude/CLAUDE.md`** ← 「セッション開始時の振る舞いガイド」セクション追加済み、必ず読む
3. **プロジェクト memory: `feedback_collaboration_style.md`** ← 詳細な振る舞いガイド
4. `HANDOFF_I18N_SESSION_2026_05_20.md` ← 落とし穴パターン集 A〜G、必読
5. `HANDOFF_I18N_NEXT_SESSION_2026_05_20.md` ← 前セッションの引き継ぎ、参考

**フロントロードの効果**: 上記を読み込むことで「丁寧 + 慎重 + 切り分け重視」の自己一貫性がロックインされる。前セッション (朝) は HANDOFF を読まずに「一発目から口調悪い + 勝手に push」で大失敗した経緯がある。

---

## 本セッション (2026-05-20 夜) の成果

### push 済み 4 commit (全て本番反映済み)

| # | hash | 内容 |
|---|---|---|
| 1 | `fc9ba30` | waza-list / party_checker に `refreshAllI18nContent` 共通化 (HANDOFF パターン B 対策) |
| 2 | `2f70406` | party_checker モーダル z-index を Ad bar より上に引き上げ (z:10001~10005) |
| 3 | `8012658` | 技選択モーダル (iframe mode=multi) で選択技が反映されないバグ修正 (`_all` キーをフォールバック) |
| 4 | `1373087` | ad-toggle.js: iframe 経由では Ad bar を自動非表示 |

### git 管理外の永続化 (~/.claude/)
- グローバル `~/.claude/CLAUDE.md` に **「セッション開始時の振る舞いガイド (2026-05-20追加)」** セクション追加
- プロジェクト memory に **`feedback_collaboration_style.md`** 新規作成
- プロジェクト `memory/MEMORY.md` に 1 行 pointer 追加

---

## 現在の git 状態 (予想)

```bash
git status -s
```
予想出力:
```
 M HANDOFF_PHASE3_C5_TURNEND.md   ← Phase3 (温存)
 M battle_simulator.html          ← Phase3 (温存)
 M party_checker.html             ← Phase3 系統 4 hunks のみ残存
 M type_chart.html                ← Phase3 (温存)
?? HANDOFF_PHASE3_FULL_TURN_SIM.md
?? real_battle_simulator.html
```

`party_checker.html` の unstaged 4 hunks (Phase3 系統、温存対象):
- L479: nav-real-battle CSS
- L504: ev-row レイアウト変更
- L1215: `_evRefresh` の MIN/DEC/INC/MAX ボタン並び替え
- L1755: `renderPcTabs` への rbBtn (リアルバトル) 追加

**触らない**。あべ判断「バトルシミュレータは一旦保留」のため。

---

## 残タスク (次セッション)

### Task #4: party_checker.html 本体多言語化 (約 123 件)

- ?audit=1 で未翻訳テキストをリストアップ済み (前々セッションで 123 件カウント)
- 範囲:
  - **HTML 静的ラベル**: ステータス名 (HP / こうげき / ぼうぎょ / とくこう / とくぼう / すばやさ / 合計)、性格、特性、弱点、耐性、手持ち、持ち物、各タイプラベル (かくと / じめん / こおり / ひこう / はがね / でんき / あく / ほのお / いわ / みず / フェア / ノーマ / どく / くさ / ゴース / ドラゴ / むし / エスパ) 等
  - **JS 動的生成**: 性格 / 特性の値 (まじめ / しんりょく / ようりょくそ等)、能力値表、タブ切替、モーダル中身 (技選択モーダルタイトル等)
  - **iframe / モーダル対応**: 既に `refreshAllI18nContent` で対応済み (本セッション)
- 進め方は `HANDOFF_I18N_SESSION_2026_05_20.md` の「他ページ進め方ガイド」参照

### 任意 (時間あれば)
- waza-list の本体多言語化 (タグ/効果整理サイクル待ちで意図的に対象外、後回し)
- `waza-list-template.html` の削除可否 (Phase3 で不要、あべ確認待ち)
- ローカル文字列 `タブ1` の言語非依存化 (localStorage 起因、残課題 #5)

---

## 重要な注意事項

### 1. PDF / HANDOFF の git 状態が実状況とズレることがある
本セッション開始時、前セッションの HANDOFF は「party_checker.html stage 済」と書いていたが、実際は all unstaged になっていた。セッション交代時に stage 情報が剥がれることがある。
→ **HANDOFF 読了後、必ず `git status -s` で実状況を確認**

### 2. 同じファイルに「私の修正」と「温存対象」が混在する場合、`git add -p` で hunk 単位分離
本セッションでの実例 (party_checker.html):
- 私の修正 hunks (i18n / z-index / slotFilters _all) を y で stage
- Phase3 系統 4 hunks を n でスキップ
- 確認: `git diff --cached --stat` で stage 内容を必ず可視化

### 3. Ad bar z-index 9999 は全ページモーダルと干渉する設計バグ
2026-05-15 (`07285f6`) で ad-toggle.js 導入時、既存モーダルの z-index 確認が漏れていた。
本セッションで:
- party_checker のモーダル z:200/250/300/600/700 → 10001~10005 (commit `2f70406`)
- iframe (親モーダル内) 経由は ad-toggle.js が自動非表示化 (commit `1373087`)
他ページで同種のバグがあるか、新規モーダル追加時は要確認。

### 4. Auto Mode は main 直接 push を soft block する場合あり
- 「動作確認 OK」≠「commit / push 承認」と解釈される (前タスクの承認は新 commit には波及しない)
- 都度「commit + push して」と明示承認が必要
- ブロックされたら焦らず状況を伝えてユーザーに承認を求める

### 5. Phase3 系統は触らない / `git add .` `-A` `commit -a` 禁止
個別ファイル指定で commit、`git diff --cached --stat` で内容確認。詳細は `HANDOFF_COMMIT_RULES_2026_05_18.md`。

### 6. 削除前に必ず承認、`_archive/` への移動を優先
CLAUDE.md ルール再強調。「クリーンアップ」「不要ファイル除去」も同様、勝手にやらない。

---

## 開発環境

### サーバ
localhost:8080 で起動中 (確認: `pgrep -fl 'http.server 8080'`)。落ちていたら:
```bash
killall cfprefsd
PID=$(pgrep -x ScopedBookmarkAgent) && kill -9 "$PID"
/usr/bin/pkill -f 'http.server 8080'
python3 -m http.server 8080 --bind 127.0.0.1 --directory ~/Documents/ポケモンDB
```

### audit ツール
- ローカル: <http://127.0.0.1:8080/{ファイル}?audit=1>
- 本番: <https://pchamdb.com/{ファイル}?audit=1>
- 非 ja モード時、DOM 内日本語が赤枠 + コンソール出力
- 個別除外: `data-i18n-audit-skip` 属性
- 静的解析: `python3 i18n/audit_i18n_coverage.py --md /tmp/audit.md`

### 翻訳キーの差分監視
```bash
python3 i18n/audit_i18n_coverage.py --md /tmp/audit.md
grep -E "^\| party_checker" /tmp/audit.md
```

---

## 参照 HANDOFF

- 本ファイル (現在)
- `HANDOFF_I18N_NEXT_SESSION_2026_05_20.md` (前セッション、i18n 構造修正の動作確認依頼)
- `HANDOFF_I18N_SESSION_2026_05_20.md` (前々セッション、14 commit + 落とし穴パターン集 A〜G + チェックリスト 10 項目)
- `HANDOFF_COMMIT_RULES_2026_05_18.md` (commit 安全ルール、全セッション必読)
- `HANDOFF_PHASE3_SIMULATOR.md` (Phase3 バトルシミュレータ設計、現在保留)
- グローバル `~/.claude/CLAUDE.md` (Karpathy 4 原則 / Cat Wu 教訓 / 振る舞いガイド)
- プロジェクト `CLAUDE.md` (マスター DB ルール / Phase3 系統触らない)
- プロジェクト memory `feedback_collaboration_style.md` (詳細な振る舞いガイド)

---

## 引き継ぎチェックリスト

新セッションが開始時に確認:
- [ ] 本ファイル + グローバル CLAUDE.md + プロジェクト memory を読了
- [ ] `git status -s` で実状況を確認 (HANDOFF と差異がないか)
- [ ] サーバが動いているか確認 (`pgrep -fl 'http.server 8080'`)、必要なら再起動
- [ ] 残タスク #4 (段階 2 本体多言語化) の進め方ガイドを `HANDOFF_I18N_SESSION_2026_05_20.md` から確認
- [ ] あべから「進めてよい」「commit + push して」を明示的にもらってから着手 / push
- [ ] 動作確認 OK 後にのみ push、commit + push は明示承認後 (Auto Mode 対策)
- [ ] 想定外動作 / ブロック時は「なぜそうなったか」を 1 行で明示してから次のアクション

---

おつかれさまでした。次セッションも HANDOFF 経由でスムーズに作業継続できるはずです。
