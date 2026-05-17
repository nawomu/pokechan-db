# フェーズ C-5 持ち物プルダウン — 進捗報告

**作成**: 2026-05-18 JST
**作成セッション**: phase3_pokechan_db 起点セッション (UI 担当)
**宛先**: Phase3 側セッション (オーケストレーター担当) / 並行作業中のセッション
**目的**: HANDOFF_C5_ITEM_INTEGRATION.md が古い情報のため、現状ギャップを共有し作業分担を整理

---

## 🎯 ひとことで

> HANDOFF_C5 の **Step 1〜2 (DB読み込み + プルダウン UI) はすでに実装済み**。
> `items_database.js` を最新 99 件版に更新済み。`calcDamage` での持ち物倍率処理は **5 系統が動作・残り 7 カテゴリ + メガストーンが未統合**。

---

## ✅ 5/18 セッションで実施した変更

### 1. `items_database.js` を最新版に再生成
- 旧: 59 件 (2026-05-16 版)
- 新: **99 件** (2026-05-17 のメガ skeleton 18 種詳細追加分を含む)
- 出典: `_review/items_database.json` (114 件) から `implemented_in_pokechan: true` を抽出、`mega_stone_marker` を除外
- バックアップ: `bak/items_database.20260518_014703.bak.js`

新カテゴリ別内訳:
| category | 件数 |
|---|---|
| mega_stone | 41 |
| type_boost | 18 |
| berry_resist | 18 |
| berry_status_cure | 7 |
| survival | 4 |
| berry_hp_cure | 3 |
| speed_boost | 2 |
| hp_drain | 2 |
| attack_boost | 2 |
| misc | 1 |
| defense_boost | 1 |

### 2. ギャップ分析実施 (battle_simulator.html 編集なし)

---

## 📊 battle_simulator.html の現状実装マップ

### ✅ すでに実装済 (UI 骨組み)

| 要素 | 場所 | 状態 |
|---|---|---|
| 持ち物選択モーダル | line 739-748 (`#item-modal-ov`) | ✅ 完成 |
| `openItemModal(side)` | line 1915 | ✅ カテゴリ別 optgroup 描画 |
| `closeItemModal()` | line 1925 | ✅ |
| `_renderItemModalList()` | line 1930 | ✅ |
| `_pickItemFromModal(key)` | line 1965 | ✅ `sides[side].item = key` で保存 |
| `state.item: ''` | line 844 | ✅ |
| `ITEM_BY_KEY` 逆引き | (line 872 付近) | ✅ |
| 持ち物 pill 表示 | line 588, 723 (`item-pill empty`) | ✅ |

### ✅ calcDamage で動作中の倍率 (5 系統)

| 系統 | 行 | 実装方式 | 倍率 |
|---|---|---|---|
| `type_boost` (タイプ強化) | 1092-1096 | プルダウン経由 (`atk.item` + `ITEM_BY_KEY`) | ×1.2 (Q12=4915) |
| でんきだま (ピカチュウ専用) | 1099-1102 | プルダウン経由 (`light_ball` key) | ×2 (Q12=8192) |
| `berry_resist` (半減きのみ) | 1144-1150 | プルダウン経由 (`def.item`) + 効果ばつぐん時のみ | ×0.5 (Q12=2048) |
| いのちのたま (`lifeOrb`) | 1137-1140 | **古い `data-flag` 経由** (チェックボックス) | ×1.3 |
| ゴツゴツメット (`rockyHelmet`) | 1168 | **古い `data-flag` 経由** (チェックボックス) | 反動 HP/6 |

### 🟡 未統合の持ち物カテゴリ (7 種 + メガ)

| category | 件数 | 推定実装量 | 備考 |
|---|---|---|---|
| `attack_boost` | 2 | 小 | ハチマキ等 (大半は `implemented_in_pokechan: false` で除外済) |
| `defense_boost` | 1 | 小 | 単純な防御 ×1.5 系 |
| `speed_boost` | 2 | 小 | スカーフ系 (素早さ計算は別関数) |
| `survival` | 4 | **中** | タスキ等、HP1 残り判定が必要 |
| `berry_status_cure` | 7 | **中** | 状態異常解除、ターン終了時処理 |
| `berry_hp_cure` | 3 | **中** | HP 自動回復、`currentHp` 更新ロジック必要 |
| `hp_drain` | 2 | 中 | リサイクル系、ターン終了時処理 |
| `misc` | 1 | 小 | (要個別確認) |
| `mega_stone` | 41 | **大** | メガシンカ UI 別途設計必要 (HANDOFF_PHASE3_SIMULATOR Init-B) |

### ⚠️ 二重管理状態 (要整理)

| 旧 (`data-flag` チェックボックス) | 新 (`items_database.js` key) | 現状 | 推奨方針 |
|---|---|---|---|
| `lifeOrb` (line 636, 650) | `life_orb` (`implemented_in_pokechan: false`) | 旧 only で動作 | 新側に統合 or 旧を維持 |
| `rockyHelmet` (line 670, 678) | `rocky_helmet` (`verify: true`) | 旧 only で動作 | 同上 |
| `disguise` (line 671, 679) | (これは特性) | 旧 only | 維持 |
| `critical` (line 635, 649) | (これは状態) | 旧 only | 維持 |

→ `life_orb` / `rocky_helmet` は本家用なので JSON では未実装フラグ。一方 UI チェックボックスは動作する状態 → プルダウンと共存させるか、新側に寄せるか判断要。

---

## 🛠️ 残タスク提案 (作業分担用)

### Track A: 軽量・独立・低リスク (このセッションで実施可)

A-1. **JSON から `verify: true` 項目の最終確認**
- ふうせん / くろいヘドロ / パンチグローブ / メンタルハーブ / ホズのみ / ゴツゴツメット
- skeleton 18 メガ (5/17 追加分) も含めて 24 件
- → あべ作業 (ゲーム内確認)

A-2. **`attack_boost` / `defense_boost` / `speed_boost` カテゴリの calcDamage 統合** (約 5 件)
- 既存 `type_boost` のパターン (line 1092) と同型コード
- 推定工数: 30〜60 分

### Track B: 中規模・状態管理拡張

B-1. **`survival` カテゴリ (タスキ等)** — HP1 残し判定を calcDamage か koHits 判定に追加
B-2. **`berry_status_cure` / `berry_hp_cure`** — ターン終了処理を新規追加 (state.currentHp / state.status 連動)
B-3. **`hp_drain`** — 同上

### Track C: 大規模・別フェーズ

C-1. **メガストーン 41 種統合** — メガシンカボタン UI + 種族値・タイプ・特性の動的切替
- HANDOFF_PHASE3_SIMULATOR の Init-B フェーズに該当
- skeleton 18 件は標準 Gen6/7 仕様で詳細追加済み (`_review` 内)
- 詳細あり 23 件 + skeleton 18 件 = 計 41 件

### Track D: 整理・リファクタリング

D-1. **data-flag (`lifeOrb` / `rockyHelmet`) を items_database.js 駆動に統合**
- 既存チェックボックス UI は残しつつ、内部で同じデータ経路にする (or プルダウン側に寄せて重複 UI 削除)
- リスク: あべの操作習慣に影響

---

## 🚦 セッション間の調整ポイント

### このセッション (phase3_pokechan_db 起点) で触ったファイル
- `items_database.js` (再生成、99件)
- `bak/items_database.20260518_014703.bak.js` (バックアップ追加)

### **Phase3 側セッションが触らないでほしいファイル** (このセッションが続きを想定している場合)
なし — `items_database.js` 再生成は冪等で、Phase3 側でも同じスクリプトを再実行できる。

### **作業分担提案**
- **A-1 (verify 確認)**: あべ作業
- **A-2 (calcDamage 3 カテゴリ追加)**: どちらかのセッションで小タスク
- **B (中規模)**: 1セッションに寄せる方が安全 (state 拡張がぶつかる)
- **C (メガストーン)**: 別フェーズ、本セッション群では着手しない方向
- **D (data-flag 整理)**: 後回し or 別セッション

---

## 📝 ファイル状態 (git diff -A から)

```
=== このセッション編集後の git status (5/18 早朝) ===
 M items_database.js   ← このセッションで再生成 (5/16 版→5/17 版)
?? HANDOFF_C5_STATUS_2026_05_18.md  ← この報告書 (新規)
?? bak/items_database.20260518_014703.bak.js  ← gitignore 対象、コミットされない
```

(注: 直近の本番 push 後の差分のみ表示)

---

## 🔗 関連 HANDOFF / memory

- `HANDOFF_C5_ITEM_INTEGRATION.md` — 元 HANDOFF (2026-05-16、現状と若干乖離)
- `HANDOFF_PHASE3_SIMULATOR.md` — battle_simulator 全体設計
- `HANDOFF_DEPLOY_2026_05_17.md` — 直前のデプロイ引き継ぎ
- memory: `project_pokechan_items_db.md` — items_database.json 経緯
- memory: `project_battle_simulator_status.md` — battle_simulator 進捗

---

## ✅ Phase3 側セッションへの質問・確認事項

1. `items_database.js` を 99 件版に上書きしたが問題ないか? (もしそちらでも別の最新化作業を予定していたら教えてください)
2. 次に着手する Track はどれを希望? (A-2 が現実的で価値高、B は中規模、C は別フェーズ)
3. data-flag (`lifeOrb` / `rockyHelmet`) の整理方針は本セッションで決めてよいか?
4. メガストーン統合 (Track C) は別 HANDOFF を切り直すべきか、HANDOFF_PHASE3_SIMULATOR Init-B に統合か?
