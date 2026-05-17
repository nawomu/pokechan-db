# HANDOFF インデックス — 2026-05-18

**作成**: 2026-05-18 03:30 JST
**作成セッション**: phase3_pokechan_db 起点 (Phase3 メイン)
**目的**: 5/18 で多数生まれた HANDOFF 文書を一覧化し、依存関係 + 担当領域 + 進捗状態 を明示

---

## 🗂️ 5/18 関連 HANDOFF 全リスト

| 文書 | 担当 | 種別 | 状態 |
|---|---|---|---|
| `HANDOFF_COLLAB_2026_05_18.md` | ポケモンDB | 協力マップ | ✅ push 済 |
| `HANDOFF_C5_STATUS_2026_05_18.md` | Phase3 | 進捗+ギャップ分析 | ✅ push 済 (追記分も) |
| `HANDOFF_C5_ITEM_INTEGRATION.md` | Phase3 | 元 HANDOFF + 完了追記 | 🟡 ローカル更新 |
| `HANDOFF_PHASE3_C5_TEST_SCENARIOS.md` | Phase3 | テストシナリオ集 | ✅ push 済 |
| `HANDOFF_PHASE3_C5_TURNEND.md` | Phase3 | Track B-2/B-3 設計検討 | ✅ push 済 |
| `HANDOFF_PHASE3_INIT_B.md` | Phase3 | メガ進化起草 | ✅ push 済 |
| `HANDOFF_PHASE3_SIMULATOR.md` | Phase3 | 全体設計 + 完了マーク | 🟡 ローカル更新 |
| `HANDOFF_PHASE3_03_TYPE_CHART_UX.md` | Phase3-03 | type_chart UX 改修 | 🟡 Phase3-03 進行中 |
| `HANDOFF_PROGRESS_2026_05_18_PHASE3.md` | Phase3 | 進捗報告 v1+v2 | 🟡 v2 ローカル |
| `HANDOFF_POKEMONDB_FINAL_2026_05_18.md` | ポケモンDB | 本日最終報告 | ✅ push 済 |
| `HANDOFF_SEO_SETUP_2026_05_18.md` | ポケモンDB | SEO 手順書 | ✅ push 済 |
| `HANDOFF_LEGAL_PAGES_I18N_2026_05_18.md` | ポケモンDB | 法的ページ調査 | ✅ push 済 |

---

## 🔗 依存・後続関係 (Phase3 領域)

```
HANDOFF_C5_ITEM_INTEGRATION.md (元 5/16、主要部完了)
   ↓ (主要部完了)
   ├─→ HANDOFF_C5_STATUS_2026_05_18.md (ギャップ分析 + 再評価)
   │     ↓
   │     ├─→ HANDOFF_PHASE3_C5_TEST_SCENARIOS.md (動作確認シナリオ)
   │     └─→ HANDOFF_PHASE3_C5_TURNEND.md (Track B-2/B-3 設計)
   │
   └─→ HANDOFF_PHASE3_INIT_B.md (メガ進化、Q4 で別 HANDOFF 化)

HANDOFF_PHASE3_SIMULATOR.md (battle_simulator 全体設計)
   ↓ (次フェーズ候補表で参照)
   ├─→ HANDOFF_PHASE3_INIT_B.md (#5)
   ├─→ HANDOFF_PHASE3_C5_TURNEND.md (#1 残作業)
   └─→ HANDOFF_PHASE3_03_TYPE_CHART_UX.md (関連: type_chart UX)
```

---

## 🟦🟨🟧 セッション別の担当領域 (5/18 確定)

### 🟦 ポケモンDB セッション (UI / i18n / SEO / ドキュメント / push 担当)

- `party_checker.html` (Phase C 動的スロット系 i18n 完了)
- `pokemon_db_v9.html` (集計列 9 言語化)
- `making.html` / `making_en.html` (back-to-top)
- `index.html` / `index_en.html` (共有領域)
- `sitemap.xml` (SEO)
- 法的ページ (terms / privacy / disclaimer / contact)
- `i18n/ui-*.json` の 8 言語 (ja は Phase3-03 が触る場合あり)
- **全 commit の push 担当** (Phase3 系から代理 push)

### 🟨 Phase3 メインセッション (battle_simulator / items / 設計)

- `battle_simulator.html` (focus_sash 実装、calcDamage)
- `items_database.js` (99 件版に再生成)
- `_review/items_database.json` + 監査スクリプト (gitignore で非公開)
- `HANDOFF_C5_*` / `HANDOFF_PHASE3_INIT_B` / `HANDOFF_PHASE3_SIMULATOR`
- **push 不可** (ポケモンDB に依頼)

### 🟧 Phase3-03 セッション (type_chart UX)

- `type_chart.html` (左端 # 列 + フッター + ソート UX 改善)
- `i18n/ui-ja.json` の type_chart namespace 2 キーのみ
- `HANDOFF_PHASE3_03_TYPE_CHART_UX.md`

### 🟪 あべ (人間)

- ゲーム内 verify (skeleton 18 メガ + 既存 6 = 24 件)
- Init-B 着手 GO サイン
- C5 Track B-2/B-3 案 A/B/C 選択
- Google Search Console / AdSense 各種登録
- 連載 #2 着手判断

---

## 📋 各 HANDOFF の要点まとめ

### Phase3 領域

#### `HANDOFF_C5_STATUS_2026_05_18.md`
- 元 HANDOFF C5 のギャップ分析
- 実装済 5 系統 (type_boost / でんきだま / berry_resist / lifeOrb / rockyHelmet)
- 未統合カテゴリと工数見積もり
- Track A-1〜D の分担提案
- Phase3 質問 Q1-Q4 → ポケDB 側回答済
- Track A-2 再評価 + B-1 タスキ代替案

#### `HANDOFF_C5_ITEM_INTEGRATION.md` (5/16 元 + 5/18 完了追記)
- ポケチャン持ち物統合の元 HANDOFF
- 主要部完了マーク追記 (今回)
- 実装余地なしと判明した持ち物リスト
- 別 HANDOFF へのポインタ (TURNEND / INIT_B / TEST_SCENARIOS)

#### `HANDOFF_PHASE3_C5_TEST_SCENARIOS.md`
- type_boost (S1) / berry_resist (S2) / でんきだま (S3) / focus_sash (S4) の動作確認手順
- 既存実装の退行確認 (S5) / chip 表示の特殊ケース (S6)
- タスキ実装による退行チェックリスト 8 項目

#### `HANDOFF_PHASE3_C5_TURNEND.md`
- berry_status_cure (7) / berry_hp_cure (3) / hp_drain (2) = 12 アイテムの設計検討
- 3 案 (A: フル / B: 部分 / C: 注釈のみ) 比較
- 推奨は案 C (1.5 時間で実装可能)
- あべ判断要事項 3 件

#### `HANDOFF_PHASE3_INIT_B.md`
- メガストーン 41 種統合の起草
- Step 1〜5 (effectivePoke / メガシンカボタン / calcDamage 参照書換 / ABILITY_DESC 連携 / リセット)
- フェーズ B-1〜B-5 (5〜7 時間)
- 未確定事項 4 件 (デザイン / HP 扱い / 解除ボタン / verify タイミング)

#### `HANDOFF_PHASE3_SIMULATOR.md` (継続更新)
- battle_simulator 全体設計 (Init-A / Init-B / Pre / 0a-0c / Atk-Base / 1-8 / 9 / 10a-10h)
- C-3 / C-4 完了報告
- 次フェーズ候補表 (#1 完了 / #2 全完了 / #5 Init-B 別 HANDOFF 化)

#### `HANDOFF_PROGRESS_2026_05_18_PHASE3.md`
- v1: 深夜枠 (focus_sash + Init-B) 報告
- v2: 03:00 以降の追加 (HANDOFF 整理 + テスト + 設計) 追記

### ポケモンDB 領域

#### `HANDOFF_COLLAB_2026_05_18.md`
- Phase3 セッションとの分担マップ
- Q1-Q4 回答 (items_database / Track 推奨 / data-flag / メガ別 HANDOFF)
- 共有領域のルール

#### `HANDOFF_POKEMONDB_FINAL_2026_05_18.md`
- 本日 T1-T4 完遂 (party_checker / making / sitemap / legal)
- Phase3 並行作業の代理 push 一覧
- 5/18 全体タイムライン

#### `HANDOFF_SEO_SETUP_2026_05_18.md`
- Search Console 登録手順
- sitemap.xml 最新化詳細
- GA4 連携手順

#### `HANDOFF_LEGAL_PAGES_I18N_2026_05_18.md`
- 法的ページ調査 (terms / privacy / disclaimer / contact 各 ja+en)
- Option A/B/C 比較、A 推奨

### Phase3-03 領域

#### `HANDOFF_PHASE3_03_TYPE_CHART_UX.md`
- type_chart UX 改修 (左端 # 列 + フッター + ソート UX)
- 触っているファイル: type_chart.html + i18n/ui-ja.json (2 キーのみ)

---

## 📌 5/19 以降の起動時チェックリスト

```bash
cd ~/Documents/ポケモンDB
git pull origin main
git status -s

# 最新の HANDOFF 一覧
ls -la HANDOFF_*2026_05_*.md

# 5/18 主要ドキュメント
cat HANDOFF_INDEX_2026_05_18.md  # ← この文書
cat HANDOFF_POKEMONDB_FINAL_2026_05_18.md  # ポケDB 側最終
cat HANDOFF_PROGRESS_2026_05_18_PHASE3.md  # Phase3 メイン側最終
```

5/19 着手前の確認:
- [ ] あべから Init-B GO サインを受けているか?
- [ ] あべから C5 Track B-2/B-3 案 A/B/C 選択を受けているか?
- [ ] Phase3-03 の type_chart UX 改修が push 済か?
- [ ] working tree に未コミット差分がないか?

---

## 🔗 関連 memory

- `project_pokechan_items_db.md` — items_database.json 経緯と前提訂正
- `project_battle_simulator_status.md` — battle_simulator 進捗 (C-3/C-4 完了マーク)
- `project_type_chart.md` — type_chart 実装メモ
- `project_waza_picker_module.md` — waza_picker 共通モジュール
- `feedback_tcc_locked_files_osascript_workaround.md` — システム制約のワークアラウンド
