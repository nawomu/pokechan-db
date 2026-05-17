# HANDOFF: 技選択 UI 共通モジュール化 + 3 画面展開

**最終更新**: 2026-05-17 19:28 JST  
**前セッション ID**: `0c4ee387-c89c-42a2-8f8e-591c57aac304` (~13.9 MB)  
**再開**: `claude --resume 0c4ee387-c89c-42a2-8f8e-591c57aac304`

---

## 🎯 セッションの目的 (達成済み)

「全ての画面で同じ技選択 UI を使えるようにする」=
- **waza-list.html** (単独) / **party_checker.html** (技選択モーダル) / **battle_simulator.html** (技スロット) を共通化
- ベースは waza-list (機能が最も豊富)
- 上部レイアウト・タイプボタン・効果フィルタ・テーブル列を統一

## ✅ 今回の主要成果

### 1. 共通モジュール作成
- **`waza_picker.js`** (69 KB, ~1400 行) — フィルタ・テーブル・ソート・タイプボタン・ポケモン選択・効果フィルター
- **`waza_picker.css`** (26 KB, ~440 行) — 全スタイル集約

### 2. URL クエリでモード切替
```
waza-list.html?mode={browse|multi|single}&pokemon=<name>&lock=1&slot=<n>&initial=k1,k2
```
- `mode=browse` (既定): 閲覧のみ
- `mode=multi`: 左端チェック+確定 (複数選択、party_checker 用)
- `mode=single`: 左端チェック+確定 (1 件だけ、battle_simulator 用)

### 3. postMessage で iframe 通知
- `{type: 'waza-picker:confirm', slot, pokemon, keys}` — multi 確定
- `{type: 'waza-picker:pick', slot, pokemon, key}` — single 確定
- `{type: 'waza-picker:cancel'}` — キャンセル

### 4. UI 統一
- 3 段構成 (sticky 固定): タイトル+ナビ / タイプボタン / 検索系
- タイプボタン: 18 タイプ + 全タイプ表示 (略表記、均等幅、0 件のタイプは disabled)
- ポケモン選択: 「🧬 全ポケモンを選択中 ▾」検索可能ドロップダウン
- 効果フィルター: 94 chip (技フラグ/状態異常/ランク/対象/除外/順番/etc) Row 3 の左端トグル

### 5. C1/C2/C3 列の撤去
- waza-list の死に機能 (LocalStorage `wazalist_checks_v1` で完結、他ページ非連携) を削除
- LocalStorage 値は残置 (害なし)

### 6. party_checker iframe 化
- `#pf-ov > #pf-box` に `<iframe id="pf-iframe" src="waza-list.html?mode=multi&...">`
- `openPokemonFilter(slotIdx)` で iframe を開く
- `slotFilters[pfSlot] = {_all: keys}` で確定キーを保存 (旧「タイプ別」構造から変更)
- 旧 DOM は `#pf-box-legacy` (display:none) で残置

### 7. battle_simulator iframe 化
- `#move-picker-modal` (技選択, mode=single) + `#stats-picker-modal` (能力値編集, party_checker?stats_only=true)
- 技スロット (`.move-row-empty`) クリック → 技選択 iframe (ポケ未選択時は自動でポケ選択モーダル)
- 「✏️ スライダーで編集」ボタン → party_checker の能力値スライダー UI を iframe で開く
- postMessage 受信で `sides[side].moves[idx]` / `sides[side].effort,natureIdx` に反映
- HP 連動 (`currentHp = realStat(st, 'hp')`)

### 8. party_checker に `stats_only` モード追加
- `party_checker.html?stats_only=true&poke=&effort=&nature=&slot=` で能力値編集ポップアップ単独表示
- 他 UI を CSS で全部非表示
- 決定/キャンセルで `stats-picker:confirm/cancel` を親に postMessage

---

## 📁 ファイル構成

| ファイル | サイズ | 役割 |
|---|---|---|
| `waza_picker.js` | 69 KB | **共通** 技選択ロジック |
| `waza_picker.css` | 26 KB | **共通** スタイル |
| `waza-list.html` | 33 KB | 単独ページ (browse) |
| `party_checker.html` | 164 KB | iframe 化 (multi) + `stats_only` モード追加 |
| `battle_simulator.html` | 108 KB | iframe 化 (single + stats) |

**バックアップ** (`~/Documents/ポケモンDB/bak/`):
- `battle_simulator.20260517_085614.bak.html` (防御特性追加前)
- `battle_simulator.20260517_094223.bak.html` (HP連動修正前)
- `party_checker.20260517_095943.bak.html` (個体値表記変更前)
- `party_checker.20260517_161202.bak.html` (iframe 化前)
- `waza-list.20260517_112744.bak.html` (C1/C2/C3 撤去前)
- `waza_picker.20260517_151413.bak.js` (関数化前)

---

## 🔄 動作確認ポイント (次セッションで実施)

### A. waza-list (browse)
- http://localhost:8765/waza-list.html
- [ ] タイプボタン押下で絞り込み
- [ ] ポケモン選択 → 「該当しないタイプ」がグレーアウト
- [ ] 効果フィルター開閉
- [ ] 検索ボックスのオートコンプリート
- [ ] 「習得」セルクリックで habile モーダル
- [ ] スクロール時 3 段が固定、 thead も追随

### B. party_checker (multi)
- http://localhost:8765/party_checker.html
- [ ] ポケモン選択 → 技選択ボタンクリックで iframe モーダル開く
- [ ] チェック → 確定で `slotFilters[pfSlot]._all` に反映
- [ ] キャンセル/× で閉じる

### C. battle_simulator (single + stats)
- http://localhost:8765/battle_simulator.html
- [ ] ポケモン選択前に技スロットクリック → ポケ選択モーダルが開く
- [ ] ポケ選択後、技スロットクリック → 技選択 iframe (1 件だけチェック)
- [ ] 確定で `sides[side].moves[idx]` に反映
- [ ] 「✏️ スライダーで編集」ボタン → 能力値スライダー iframe
- [ ] 決定で能力P/性格が battle_simulator に反映 + HP 連動

---

## ⚠️ 既知の課題 / 改善候補

### High
- **E. battle_simulator 既存技スロットの再選択**: 現状は selectedMoveIdx 更新のみ。クリックで再選択モーダルを開く方が直感的

### Mid
- **C. waza-list 単独ページのカラースキーム**: ダーク基調と一部ライトが混在 (テーブル本体が白背景、上部バーが紺)
- **D. i18n キー追加**: 新 UI の「全ポケモンを選択中」「技スロット n」等が ja ハードコード。`ui-{lang}.json` に追加すべき
- **F. iframe ロード時のスピナー**: 重い瞬間がある (CSS スピナー追加すべき)

### Low
- **A. `pf-box-legacy` の正式撤去**: party_checker 旧 DOM (約 3000 行) が `display:none` で残置。動作確認 OK 後に削除可
- **B. `slotFilters` の構造整理**: 旧「タイプ別」構造 → 新「_all 統合」に変更したが、 既存の filter 表示処理がこれを正しく扱うか要確認

---

## 🚀 次の作業 (推奨着手順)

1. **動作確認** (上記 A/B/C) — 全画面ブラウザで触ってバグ拾い
2. **High 課題 (E)**: battle_simulator 既存スロットの再選択モーダル
3. **Mid 課題 (D)**: i18n キー追加 (`HANDOFF_I18N_IMPLEMENTATION.md` 参照)
4. **Low 課題 (A)**: `pf-box-legacy` 撤去 (確認後)

---

## 💡 重要な実装方針

- **入れ子モーダル防止**: multi/single 時は `.learners-cell`/`td.col-name`/`td.col-effect` を `pointer-events:none` に
- **タイプボタン 0 件無効化**: ポケモン選択時、`syncWpTypeBar` 内で各タイプ件数を計算して disabled
- **single も multi 同様 UI**: 「行クリック即選択」は廃止、 左端チェックボックス + 確定 (single は 1 件制限)
- **確定バー中央寄せ**: 右下 Ad と被らない (`#wp-confirm-bar { justify-content: center }`)
- **sticky 固定の動的調整**: `--top-bar-height` CSS 変数を JS で実高さに更新 (リサイズ対応)
- **削除禁止原則**: `pf-box-legacy`、no-op 化した旧関数 (`setupSingleMode`/`setupMultiMode`) はすべて残置

---

## 📚 関連ドキュメント / Memory

- `memory/project_waza_picker_module.md` — 本作業の memory 記録 (技術詳細)
- `memory/project_battle_simulator_status.md` — battle_simulator 進捗 (別軸、C-3〜C-5)
- `memory/project_pokechan_items_db.md` — 持ち物 DB (別作業)
- `HANDOFF_I18N_IMPLEMENTATION.md` — i18n 実装側 HANDOFF
- `HANDOFF_PHASE3_SIMULATOR.md` — battle_simulator 全体設計

---

## 🔧 ローカル開発

```bash
# サーバ起動 (まだの場合)
cd ~/Documents/ポケモンDB
python3 -m http.server 8765 &

# 確認 URL
open http://localhost:8765/waza-list.html
open http://localhost:8765/party_checker.html
open http://localhost:8765/battle_simulator.html
```

**重要**: file:// と http://localhost:8765/ は別オリジン扱いで localStorage が共有されないので、3 画面を同じオリジンで開く (= 全部 localhost 経由)。
</content>
</invoke>
