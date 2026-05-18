# P302 → DB01 完了報告 — Task C (ホームページにバトルシミュレーターカード追加)

**作成**: 2026-05-18 夜 JST
**作成セッション**: P302 (Phase3 メイン / battle_simulator 領域)
**宛先**: DB01 (リーダー)
**指示書**: `HANDOFF_DB01_TO_P302_2026_05_18.md`
**ステータス**: ✅ 完了 (push 待ち、DB01 が代理 push)

---

## ✅ チェックリスト

- [x] **C-1**: index.html にバトルシミュレーターカード追加 (配置: **Type Chart の右隣** = (A) 案採用)
- [x] **C-2**: index_en.html に同カード追加 (英語静的、`jp-badge` 付き)
- [x] **C-3**: 9 言語の `card_battle_title` / `card_battle_desc` を `ui-*.json` の `index` namespace に追加
- [ ] **C-4**: sitemap priority 調整 → **DB02 へ依頼** (sitemap.xml は DB02 領域、battle_simulator を 0.7 → 0.85 に上げる選択は DB01 経由で判断要)
- [x] **検証**: JSON 構文 OK (9/9)、HTTP 200 (index/index_en)、目視で追加箇所確認

---

## 📂 変更ファイル一覧

| ファイル | 変更 |
|---|---|
| `index.html` | `--red: #C0392B` 変数追加 / `.card.red` border + cta CSS 追加 / Type Chart カードの直後にバトルシミュレーターカード追加 |
| `index_en.html` | 同上 (英語静的) |
| `i18n/ui-ja.json` | `index.card_battle_title` / `card_battle_desc` 追加 |
| `i18n/ui-en.json` | 同上 (英訳) |
| `i18n/ui-ko.json` | 同上 (韓訳) |
| `i18n/ui-zh-Hant.json` | 同上 (繁中) |
| `i18n/ui-zh-Hans.json` | 同上 (簡中) |
| `i18n/ui-fr.json` | 同上 (仏訳) |
| `i18n/ui-de.json` | 同上 (独訳) |
| `i18n/ui-it.json` | 同上 (伊訳) |
| `i18n/ui-es.json` | 同上 (西訳) |

合計 **11 ファイル変更**。

---

## 🎨 デザイン詳細

### 配色

- 新規カラー: `--red: #C0392B` (battle_simulator のページ内ナビ `.bs-nav-btn.nav-sim` と同色)
- クラス名は **`.card.red`** (既存パターン `.card.orange/blue/yellow/green` に合わせて色名で命名、`.card.battle` ではなく)
- アイコン: ⚔️ (battle_simulator の page-title 絵文字と同じ)

### 配置 (A) 案採用

```
[Pokédex 🔍] [Party Checker 🛡️] [Move List ⚡] [Type Chart 📊] [Battle Simulator ⚔️] ← NEW
```

対戦準備ツール群 (Type Chart + Battle Simulator) を末尾に並べた形。Making 等の別カテゴリ系カードがあれば、その左に挿入される位置。

### 9 言語訳の採用

DB01 指示書の翻訳案をそのまま採用。`I18N.t()` / `data-i18n` で 9 言語切替対応。

---

## 🧪 検証結果

### JSON 構文

全 9 言語 (de/en/es/fr/it/ja/ko/zh-Hans/zh-Hant) で `python3 -c "import json; json.load(open(...))"` クリア。

### 翻訳確認 (各言語の card_battle_title)

```
ja: バトルシミュレータ
en: Battle Simulator
ko: 배틀 시뮬레이터
zh-Hant: 對戰模擬器
zh-Hans: 对战模拟器
fr: Simulateur de combat
de: Kampf-Simulator
it: Simulatore di Lotta
es: Simulador de Combate
```

### HTTP

- localhost:8765/index.html → 200
- localhost:8765/index_en.html → 200

### 目視 (差分)

- index.html line 431-436: 新規カード要素
- index_en.html line 346-351: 新規カード要素 (英語+jp-badge)
- 既存 4 カード (orange/blue/yellow/green) は無変更

---

## 📦 バックアップ

```
bak/index.20260518_104035.bak.html
bak/index_en.20260518_104035.bak.html
bak/ui-ja.json.20260518_104035.bak.json
```

(他 8 言語の ui-*.json は Python スクリプトで上書き、必要なら git で元バージョン復元可)

---

## 🚦 DB01 へのお願い

1. ローカル commit を作成 (P302 で実施)
2. **push は DB01 にお任せ** (touch ルール準拠)
3. push 後、本番 (https://pchamdb.com/ + https://pchamdb.com/index_en.html) で:
   - ⚔️ Battle Simulator カードが Type Chart の右に表示
   - クリックで battle_simulator.html が新規タブで開く
   - 右上🌐から言語切替 → カードのタイトル・説明が 9 言語切り替わる
4. **C-4 (sitemap priority 調整)** は判断: DB02 に振るか、現状の 0.7 維持か?

---

## 📌 注意・残課題

### C-4: sitemap.xml priority 調整

指示書では「任意、P302 判断、DB02 経由でも可」。sitemap.xml は DB02 領域なので P302 では touch しません。
**DB01 から DB02 へ「battle_simulator を 0.7 → 0.85 に上げる」指示を出すか、現状維持かを判断願います**。

### 競合確認

- 作業中 `git status` 確認: `index.html` / `index_en.html` / `i18n/ui-*.json` に他セッションの touch なし
- working tree クリーン (作業前 → 作業後)

### 他の変更なし

- battle_simulator 本体は **touch せず** (指示書通り)
- sitemap.xml は **touch せず** (C-4 は DB01 判断待ち)

---

## 🔗 関連

- 指示書: `HANDOFF_DB01_TO_P302_2026_05_18.md`
- battle_simulator 本体: 既に本番反映済 (`8adc834` で SEO/PWA 含む)
- 関連 HANDOFF: `HANDOFF_PHASE3_TO_OTHERS_2026_05_18.md` (P302 → 2 セッション宛、前回作業)

---

**P302 (Phase3 メイン) 本日 5 回目の commit、Task C 完遂。お疲れさまでした 🎉**
