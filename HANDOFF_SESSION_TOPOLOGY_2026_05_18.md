# セッショントポロジー — 2026-05-18 (5 セッション体制)

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB01 (リーダー)
**目的**: 5 セッション同時並行運用のマップを明示し、競合回避 + 効率を最大化

---

## 🎯 ひとことで

> 5/18 夜から **5 セッション体制** が正式始動。
> DB01 をリーダー(指示出し + 集約 + 最終 push)、DB02 / P302 / P303 が DB01 経由で実作業、**P301 はあべ直管理**。
> 各セッションの担当領域を明示し、被り(特に P301 と P302 の battle_simulator 共有)を事前に検知。

---

## 🗺️ 5 セッション マップ

| セッション | 管理者 | 役割 | コアファイル | 領域 |
|---|---|---|---|---|
| **DB01** | あべ直 | **リーダー** | (実装しない) | 指示出し / 集約 / 最終 push / HANDOFF 文書 |
| **DB02** | DB01 経由 | 実作業 | `i18n/*.json` / `pokemon_db_v9.html` / 法的ページ / `making.html` | i18n / SEO / ドキュメント / UI 一貫性 |
| **P301** | **あべ直** | 実作業 | `battle_simulator.html` (ブラッシュアップ) | バトルシミュレーター UX 改修・機能拡張 |
| **P302** | DB01 経由 | 実作業 | `battle_simulator.html` (C5 / Init-B) / `items_database.js` / 設計 HANDOFF | 持ち物統合・メガ進化・ホームページから battle へのリンク |
| **P303** | DB01 経由 | 実作業 | `type_chart.html` | type_chart UX 改修・SEO 強化 |

---

## ⚠️ 競合リスクと回避策

### 🔴 P301 ⇔ P302: `battle_simulator.html` 共有

**最大の競合候補**。両セッションがbattle_simulator 本体を編集する可能性。

**回避策**:
- **P301 = ブラッシュアップ(UI/UX 改修・機能拡張)** をあべ直管理
- **P302 = C5 持ち物統合 / Init-B メガ進化 / index 連携** を DB01 経由
- 作業時間帯のずらし or 「P301 が先に push → P302 が pull してから着手」の運用

→ あべが P301 を管理しているので、P302 への指示出しタイミングは P301 完了待ちを推奨。今回の P302 タスク C (index.html カード追加) は battle_simulator.html 本体に触らない設計なので **被らない**(完了済 `89b2909`)。

### 🟧 DB02 ⇔ P302/P303: `i18n/ui-*.json` 共有

3 セッションが同 JSON を編集する可能性。

**回避策**:
- 新 namespace を追加(例: DB02 が `types-master` を新ファイルで作成)
- 既存 namespace 末尾追記時は事前に HANDOFF へ namespace 名明示
- 編集前 `git pull` / 編集後 `git status` 確認
- DB01 が namespace 衝突を集約時に検知 → 必要なら調整指示

### 🟧 DB02 ⇔ P302: `index.html` / `index_en.html`

両方が共有編集の可能性(P302 はバトル カード追加、DB02 は他 UI 改善)。

**回避策**: 編集前 `git pull`、競合時は DB01 が手動マージ判断。

---

## 📋 5/18 夜時点の進行状況

### push 済(最新 HEAD)

| commit | セッション | 内容 |
|---|---|---|
| `f470c76` | DB01 | DB02 / P302 / P303 への 3 指示書 |
| `89b2909` | P302 | タスク C: バトルシミュレーターカード追加(push 待ち、本 commit と同時 push 予定) |

### 進行中(working tree、未 commit)

| ファイル | セッション | 推定作業 |
|---|---|---|
| `i18n/types-master.json` (新規) | **DB02** | タスク A: タイプ名マスター DB 作成中 |
| `i18n/ui-ja.json` (modified) | P303 or 共有 | 不明、要確認 |
| `type_chart.html` (modified) | P303 | タスク A/B: モバイル sticky 化 / SEO 強化 |

→ 各セッションが個別 commit を作成 → DB01 が最終 push でまとめる流れ。

---

## 🔄 運用フロー(再確認)

```
[各実作業セッション]                    [DB01]
    ↓                                     ↓
1. HANDOFF_DB01_TO_*.md を git pull で取得
                                          ↓
2. 指示書を読んで実装 + ローカル commit
                                          ↓
3. HANDOFF_*_TO_DB01_*.md で完了報告 ────→ 集約 + 検証
                                          ↓
                                       競合 / 不整合検知?
                                          ↓
4. (必要なら追加指示 / 調整)              ↓
                                          ↓
                                       問題なし → git push origin main
                                          ↓
                                       全セッションへ本番反映通知
```

**例外**: P301 はあべ直管理。報告 / 通知は集約対象だが、指示は DB01 から出さない。

---

## 🚦 即時の touch ルール(5/18 夜版)

### 各セッションが触ってよいファイル

- **DB01**: `HANDOFF_DB01_*.md` (新規指示書) / `HANDOFF_SESSION_*.md` (本ファイル等) のみ
- **DB02**: `i18n/types-master.json` (新規) / `i18n/runtime.js` (拡張) / `pokemon_db_v9.html` (Filter/Exclude UI)
- **P301**: `battle_simulator.html` (本体)、あべ直管理
- **P302**: `index.html` / `index_en.html` / `i18n/ui-*.json` の `index.card_battle_*` (タスク C 完了済)、その他 C5/Init-B は battle_simulator.html(P301 と要調整)
- **P303**: `type_chart.html` / `i18n/ui-ja.json` の `type_chart.*` (atk_note/def_note の更新等)

### 触らないルール

- **DB02**: battle_simulator / type_chart / waza_picker / waza-list 本体は触らない
- **P302**: type_chart / waza-list (waza_picker 経由を除く) / 法的ページ は触らない
- **P303**: battle_simulator / pokemon_db_v9 / 法的ページ は触らない
- **DB01**: 実装系ファイル全般を touch しない(集約 + ドキュメント + push のみ)

---

## 📊 セッション別 5/18 commit 集計(暫定、5/18 夜時点)

| セッション | commits | 主要成果 |
|---|---|---|
| DB01 (旧 ポケモンDB02 → リーダー化) | 17+ | i18n / SEO / 法的 / PWA / 3 指示書 / 集約 |
| DB02 (新規) | 0 (進行中、types-master.json 作業) | タイプ名マスター DB(作業中) |
| P301 (新規) | 不明 | バトルシミュレーターのブラッシュアップ(あべ直、未確認) |
| P302 (旧 Phase3 メイン) | 10+ | focus_sash / Init-B / 設計 / バトルカード `89b2909` |
| P303 (旧 Phase3-03) | 2+ | type_chart UX 改修 / 継続作業中 |

---

## 🔗 関連 HANDOFF (5/18 夜時点、4 セッション体制版 + P301 追記)

- HANDOFF_COLLAB_2026_05_18.md (旧 3 セッション分担マップ、本書で 5 セッション化)
- HANDOFF_DB01_TO_DB02_2026_05_18.md (タスク A + B)
- HANDOFF_DB01_TO_P302_2026_05_18.md (タスク C、`89b2909` で完了済)
- HANDOFF_DB01_TO_P303_2026_05_18.md (継続作業)
- HANDOFF_INDEX_2026_05_18.md (全 HANDOFF カタログ、P302 が更新中)
- ユーザー指示原文: 2026-05-18 夜「P301 を新規立ち上げ、あべ直管理、battle_simulator ブラッシュアップ」
