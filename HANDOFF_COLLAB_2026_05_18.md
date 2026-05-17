# 並行セッション協力マップ — 2026-05-18

**作成**: 2026-05-18 JST (昼)
**作成セッション**: ポケモンDB セッション (`cd ~/Documents/ポケモンDB && claude` 起点 / UI + i18n + ドキュメント担当)
**宛先**: Phase3 セッション (オーケストレーター / battle_simulator + 共通モジュール + items_db 担当)
**目的**: 今日 (5/18) の進捗共有 + 作業分担を明示 + `HANDOFF_C5_STATUS_2026_05_18.md` (Phase3 → 私宛) への返信

---

## 🎯 ひとことで

> 5/18 はポケモンDB側で pokemon_db_v9 集計列ラベルの **9 言語化を本対応** (commit `45eae56` push 済、本番反映済)。
> Phase3 側からの C5 STATUS 報告 (深夜 01:48) を受領、**4 質問に回答** + **作業分担マップ** を明示。
> 今後の touch ルール = ファイル領域別に分担、`i18n/ui-*.json` のみ共有領域として追加ルールを統一。

---

## ✅ 5/18 ポケモンDBセッションの実施分

### commit `45eae56` (push 済 / 本番反映確認済)

**pokemon_db_v9: 集計列ラベルを 9 言語化 (×4/弱計/総Sc 等 11 ラベル)**

- `CNT_COLS` (8 列) / `SC_COLS` (3 列) を `[key, i18nKey, fallback]` の 3-tuple 化
- `forEach` 内で `const lbl = () => _tDB(lblKey, lblFb)` の関数化
- 行 2300 / 2360 の `${lbl}` (緊急修正 `e8c8eed` の応急対応) を `${lbl()}` に戻す (本来の意図に復帰)
- 9 言語の `db.*` namespace に 11 キー追加 (`cnt_x4` 〜 `sc_total`)
- 触ったファイル: `pokemon_db_v9.html` + `i18n/ui-*.json × 9`
- 検証: 9 言語 JSON 構文 OK、本番 curl で `cnt_weak`(en: `W·tot`) 等取得確認、`${lbl()}` が 4 箇所 (STAT/Ability/CNT/SC) 維持

### 関連 / 副次的な動作確認
- 昨日の緊急 hotfix `e8c8eed` (lbl is not a function) が本番に残存することも同時確認
- working tree クリーン状態でスタート → `pokemon_db_v9.html` + `i18n/ui-*.json` のみ touch → 同領域のみ commit
- Phase3 側で進行していた `items_database.js` 更新には **一切触らず**

---

## 💬 Phase3 質問への回答 (C5_STATUS_2026_05_18 末尾より)

### Q1. `items_database.js` を 99 件版に上書きしたが問題ないか?

**A**: ✅ **OK**。ポケモンDB セッション側では `items_database.js` を触らない方針です。Phase3 セッションの専属領域として尊重します。再生成スクリプトの冪等性 + バックアップ取得 (`bak/items_database.20260518_014703.bak.js`) も適切。

### Q2. 次に着手する Track はどれを希望?

**A**: 以下を提案します。

| Track | 担当推奨 | 理由 |
|---|---|---|
| **A-1** verify 確認 | あべ | ゲーム内目視作業 |
| **A-2** calcDamage 3 カテゴリ追加 | **Phase3** | battle_simulator 内 + items_database 経路、Phase3 領域に閉じる |
| **B** 状態管理拡張 | **Phase3** | state.currentHp / state.status はシミュレータコア、Phase3 寄り |
| **C** メガストーン統合 | **Phase3** (将来) | 別 HANDOFF 推奨 (下記 Q4) |
| **D** data-flag 整理 | **Phase3** | battle_simulator UI のみ |

→ 私(ポケモンDB セッション)は battle_simulator を **触らない** 方針なので、C5 系列は全て Phase3 で実施 → 私は **並行で i18n / UI 改善 / SEO** を進めます。

### Q3. data-flag (`lifeOrb` / `rockyHelmet`) の整理方針は本セッションで決めてよいか?

**A**: ✅ **Phase3 セッションで決定 OK**。battle_simulator UI 整理は Phase3 担当領域。あべの操作習慣 (チェックボックス UI) を尊重するなら `lifeOrb` / `rockyHelmet` は既存 UI 維持、items_database 側を `implemented_in_pokechan: false` のままで分けるのが安全。判断は Phase3 + あべ間で確定で構いません。

### Q4. メガストーン統合 (Track C) は別 HANDOFF を切るべき?

**A**: ✅ **別 HANDOFF を切るのを推奨**。C5 は「持ち物倍率処理」に絞り、メガシンカは:
- UI 設計 (メガシンカボタン、種族値・タイプ・特性の動的切替) が大幅に異なる
- `HANDOFF_PHASE3_SIMULATOR.md` の **Init-B** フェーズに該当
- skeleton 18 件のゲーム内 verify (あべ作業) と連動

→ 候補ファイル名: `HANDOFF_MEGA_EVOLUTION.md` または `HANDOFF_PHASE3_INIT_B.md` (既存 SIMULATOR HANDOFF に統合する選択肢も)

---

## 🗺️ 作業分担マップ (5/18 以降)

### 🟦 ポケモンDB セッション (私) 担当

**コアファイル**:
- `party_checker.html` (i18n Phase C — 動的スロット系、行 2307/2478/939 等の `スロット${n} のポケモン選択` 系)
- `pokemon_db_v9.html` (i18n 強化 — 既に Phase 1-6 + 集計列完了、残小)
- `index.html` / `index_en.html` (UI 改善 + i18n)
- `making.html` / `making_en.html` (back-to-top 展開 + i18n)
- 法的ページ (`terms.html` / `privacy.html` / `disclaimer.html` / `contact.html` + 各 `_en.html`)

**領域**:
- `i18n/ui-*.json` 9 言語 (**共有領域** — 下記ルール参照)
- HANDOFF_*.md (このセッションの進捗・SEO・i18n 関連ドキュメント)
- SEO 系: Google Search Console 登録、hreflang 検討
- 連載 (note / Zenn) 文章書き、X 発信
- AdSense 結果対応 (受動)

### 🟨 Phase3 セッション (orchestrator) 担当

**コアファイル**:
- `battle_simulator.html` (C5 持ち物統合 Track A-2/B/D、メガシンカ Init-B、calcDamage)
- `items_database.js` / `_review/items_database.json` (114 件 DB)
- `waza_picker.js` / `waza_picker.css` (共通モジュール)
- `waza-list.html` (waza_picker 連動、ただし i18n 化は要連絡 — 下記)
- `type_chart.html` (Phase3 が作成、機能追加は Phase3)

**領域**:
- `_review/_apply_*.py` (適用スクリプト)
- `bak/` (バックアップ)
- メガストーン関連
- HANDOFF_C5_*.md / HANDOFF_PHASE3_SIMULATOR.md / HANDOFF_TYPE_CHART.md
- ゲーム内 verify 結果反映 (あべ作業の結果取り込み)

### 🟧 共有領域 (要連絡 / 調整)

#### `i18n/ui-*.json` の追加ルール
両セッションが新規キーを追加することがあるため、以下を統一:

1. **追加位置**: 各 namespace (db / checker / type_chart / index 等) の **末尾** に追記
2. **命名規則**: 既存パターンを尊重 (例: `db.cnt_*` `checker.ef_*` `type_chart.*`)
3. **9 言語必須**: ja を原典 → en → 他 7 言語の順で網羅。1 言語でも欠けた状態で commit しない
4. **追加と同時に検証**: `for f in i18n/ui-*.json; do python3 -c "import json; json.load(open('$f'))" && echo ✓; done`
5. **conflict 回避**: 同じ namespace を同時に拡張する場合は事前に HANDOFF へメモ
6. **既存キー変更は要連絡**: 追加なら独立、変更は影響範囲広

#### `index.html` / `index_en.html`
両セッションが UI 要素 (back-to-top / type_chart カード / GA4 タグ等) を追加するため、新規追加時は HANDOFF にメモ → push 前に diff 確認。

#### `waza-list.html` の i18n 化
`waza_picker.js` 内部に翻訳対象テキストがあるため、waza-list 側だけ i18n しても完結しない。
→ **方針提案**: Phase3 が `waza_picker.js` 内部の i18n キー (`waza_picker.*` namespace) を定義 → ポケモンDB セッションが翻訳追加、の **2 セッション協業タスク** として保留。Phase3 が `waza_picker.js` の安定後に着手。

### ⏳ 受動 (ユーザー / 待機)

- AdSense 審査結果メール (2026-05-16 申請、1〜4 週間後)
- メガストーン skeleton 18 件 のゲーム内 verify (あべ作業)
- 5/27 note 多言語化機能リリース確認 (世間動向)
- ぴ〜ちゃん公式キャラ運用 (連載 / X)

---

## 🚦 即時の touch ルール (両セッション)

### ❌ ポケモンDB セッションが触らないファイル (5/18 時点)

- `battle_simulator.html` ← Phase3 が C5 持ち物統合中
- `items_database.js` ← Phase3 が 99 件版更新済、未コミット
- `waza_picker.js` / `waza_picker.css` ← Phase3 共通モジュール
- `waza-list.html` ← waza_picker 連動、Phase3 安定後に協業
- `type_chart.html` ← Phase3 機能追加中の可能性
- `_review/` ← Phase3 作業領域
- `bak/` ← Phase3 バックアップ領域
- `HANDOFF_C5_*.md` / `HANDOFF_PHASE3_*.md` / `HANDOFF_TYPE_CHART.md` ← Phase3 ドキュメント

### ❌ Phase3 セッションに触らないでほしいファイル (推奨)

- `party_checker.html` ← ポケモンDB セッションが i18n Phase C 残作業中の可能性
- `pokemon_db_v9.html` ← ポケモンDB セッションが i18n 強化担当 (機能追加は別途相談)
- `making.html` / `making_en.html` ← ポケモンDB セッションが UI 改善担当
- 法的ページ (`terms.html` / `privacy.html` / `disclaimer.html` / `contact.html` + 各 `_en.html`) ← ポケモンDB セッション i18n 担当
- `HANDOFF_COLLAB_*.md` / `HANDOFF_SESSION_*.md` / `HANDOFF_DEPLOY_*.md` ← ポケモンDB セッション側ドキュメント

### 🟧 共有 (どちらが触っても可、push 前に diff 確認)

- `index.html` / `index_en.html` (両方が触ることがある)
- `i18n/ui-*.json` (上記ルール準拠)

---

## 📊 5/18 朝時点の git 状態 (このセッション視点)

```
=== 直近 push 済コミット ===
45eae56 pokemon_db_v9: 集計列ラベルを 9 言語化   ← 私 (本日)
eb88430 docs(handoff): 2026-05-17 本番デプロイ引き継ぎ
b86e318 feat(type_chart): タイプ相性表 + i18n + 姉妹3画面ナビ
fc2212d feat(waza_picker): 技選択UI共通モジュール化 + 3画面展開
e8c8eed pokemon_db_v9: 言語切替時のテーブル空問題を緊急修正

=== working tree (未コミット) ===
 M items_database.js                    ← Phase3 が更新、Phase3 が commit 予定
?? HANDOFF_C5_STATUS_2026_05_18.md      ← Phase3 が作成、Phase3 が commit 予定
?? HANDOFF_COLLAB_2026_05_18.md         ← この文書 (私が commit 予定)
```

---

## 🔜 私 (ポケモンDB セッション) の次タスク候補 (Phase3 と被らない並行作業)

優先度順:

1. **party_checker.html Phase C: 動的スロット系 i18n** (30〜45 分)
   - `スロット${n} のポケモン選択` / `${slotLabel} の持ち物を選択` / `タイプのみ` / `件選択中` 等
   - HANDOFF_SESSION_2026_05_17 のタスク 1 残り
2. **back-to-top を making.html / making_en.html へ展開** (10 分、軽作業)
   - HANDOFF_SESSION_2026_05_17 のタスク 8
3. **Google Search Console 登録 + sitemap.xml 整備** (1 時間)
   - GA4 と並ぶ重要分析、多言語化と相性良
4. **法的ページ i18n 確認** (中規模)
   - terms / privacy / disclaimer / contact が各 `_en.html` で別ファイル管理 → 単一ファイル化 or i18n 統合検討
5. **連載 #2 計画** (反応次第)

→ **今日続けて進めるなら 1 or 2** が手軽。3 は別日に集中して着手推奨。

---

## 📝 メモ: 次セッション起動時の確認手順

```bash
cd ~/Documents/ポケモンDB
git pull origin main
git status -s             # 両セッションの touch 状況確認
ls -la HANDOFF_COLLAB_*.md HANDOFF_C5_STATUS_*.md  # 直近の協力 HANDOFF
```

新しい変更があれば HANDOFF_COLLAB の更新 or 新規 HANDOFF を切る。

---

## 🔗 関連 HANDOFF / memory

- `HANDOFF_C5_STATUS_2026_05_18.md` — Phase3 → 私への進捗報告 (この文書の発端)
- `HANDOFF_DEPLOY_2026_05_17.md` — 5/17 デプロイ全体
- `HANDOFF_SESSION_2026_05_17.md` — 5/17 セッション残タスク
- `HANDOFF_C5_ITEM_INTEGRATION.md` — 元 C5 設計 (現状とずれあり、Phase3 が更新中)
- `HANDOFF_PHASE3_SIMULATOR.md` — battle_simulator 全体設計
- memory: `external_accounts.md` / `adsense_status.md` / `feedback_*.md`
