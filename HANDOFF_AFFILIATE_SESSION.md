# PchamDB 楽天アフィリエイト展開 — 引き継ぎメモ
最終更新: 2026-05-15

---

## ✅ 完了済み作業

### Git ログ（最新5件）
```
6c16397  fix(popup): 閉じるボタンが効かないバグを修正
80d05c6  広告: 5商品厳選・1行固定レイアウトに統一
98825da  pokemon_db_v9: スリム広告帯に変更
ca1568c  party_checker: スリム広告帯 + 入室時PRポップアップ実装
4fe843c  waza-list 専用: スリム広告帯 (.slim) を導入
```

### 全ページ広告展開済み

| ページ | 広告クラス | 商品数 | 備考 |
|---|---|---|---|
| index.html | `.ad-section.rakuten.slim` | 5 | ✅ |
| pokemon_db_v9.html | `.ad-section.rakuten.slim` | 5 | ✅ |
| waza-list.html | `.ad-section.rakuten.slim` | 5 | ✅ |
| party_checker.html | `.ad-section.dark.rakuten.slim` | 5 (グリッド) + 5 (ポップアップ) | ✅ |

### party_checker 入室時ポップアップ
- 表示条件: sessionStorage に `pchamdb_entry_popup_shown` がない場合（タブ内1回）
- 表示タイミング: ページ読み込み後 800ms
- 閉じる: 3秒カウントダウン後にボタン有効化
- バイパス URL: `?forcepop`（テスト用）/ `?nopop`（広告OFF）
- **バグ修正済み (6c16397)**: `display: flex` が `hidden` 属性を上書きしていた問題
  - CSS: `.entry-popup[hidden] { display: none !important; }`
  - JS: `close()` 内で `popup.style.display = 'none'` も追加（二重防御）

### 採用5商品（全ページ共通）
1. **terada-ya** — ピカチュウぬいぐるみリュック
2. **bansyuselect** — ポケカ MEGAドリームex
3. **cellutane**
4. **benebox**
5. **honeys-online**

楽天アフィリエイトID: `53b80f6e.8c5584d0.53b80f6f.ffc45287`

---

## 🆕 2026-05-15: 広告トグル機構 (全ページ共通)

ユーザが画面下部の楽天バーを × で閉じた後、**右下に「📣 Ad」ボタン**で復活できる仕組みを実装。状態は `localStorage` に保存され、全ページ間で同期する。

### 実装ファイル
- **`ad-toggle.js`** (新規・共有モジュール、リポジトリ直下)
  - 役割: `#ad-hide-btn` / `#ad-show-btn` のクリック処理 + body padding / mirror-bar 位置の調整 + localStorage 永続化
  - キー名: `pchamdb_ad_hidden_v1`

### 各ページの変更点 (適用済み 14 ファイル)
1. 楽天バー内の × ボタン: inline `onclick=...` を削除 → `id="ad-hide-btn"`
2. 楽天バーの直後に **`#ad-show-btn`** (📣 Ad ピル) を挿入 (`display:none` 初期)
3. 旧 `<script>document.body.style.paddingBottom = '180px';</script>` を **`<script src="ad-toggle.js" defer></script>`** に置換

### 適用済みページ (14)
JP: `party_checker.html`, `index.html`, `pokemon_db_v9.html`, `waza-list.html`, `waza-list-template.html`, `contact.html`, `disclaimer.html`, `privacy.html`, `terms.html`
EN: `index_en.html`, `contact_en.html`, `disclaimer_en.html`, `privacy_en.html`, `terms_en.html`

### i18n 注意
- 復活ボタンのテキストは **「📣 Ad」(英語固定)** で全言語共通
- 将来 i18n を入れるなら `data-i18n` 属性を `#ad-show-btn` に付与して翻訳辞書に追加するパスを推奨

---

## 🔲 未確認・ペンディング

### ★最優先: ポップアップ閉じる修正の動作確認
- URL: `https://pchamdb.com/party_checker.html?forcepop`
- 確認項目:
  1. ポップアップが表示される
  2. 3秒後に「✕ 閉じる」が有効化される
  3. ボタンをクリック → ポップアップが消える
  4. 下部広告が5商品×1行になっている
- キャッシュが残っている場合は `Cmd+Shift+R` またはハード再読み込み

### オプション（優先度順）
- **B**: ポップアップを他ページ (index / pokemon_db_v9 / waza-list) にも展開
- **C**: ポップアップ頻度を「1セッション1回」→「1日1回」に変更 (localStorage使用)
- **D**: Phase 3 本来のわざデータ追加作業に復帰

### 待機中
- **Amazon アソシエイト**: サポートへ問い合わせ済み、返答待ち
  - `affiliate-config.js` の `amazon.enabled: false` は変更しない

---

## 📁 主要ファイル

| ファイル | 場所 | 備考 |
|---|---|---|
| `ad-section.css` | `~/Documents/ポケモンDB/` | 全ページ共通広告CSS |
| `affiliate-config.js` | 同上 | Amazon/楽天ID管理 |
| `party_checker.html` | 同上 | ポップアップ実装済み |
| `index.html` | 同上 | slim広告 |
| `pokemon_db_v9.html` | 同上 | slim広告 |
| `waza-list.html` | 同上 | slim広告 |

---

## ⚠️ 注意事項

- `git status` に多数の `.bak` ファイルがあるが **コミット不要** (`.gitignore` 管理)
- `contact.html` / `disclaimer.html` / `privacy.html` / `terms.html` は未コミットの変更あり → 次セッション冒頭で内容確認してからコミット判断
- Cloudflare CDN キャッシュの伝搬は数分〜数十分かかることがある

---

## 🎯 次セッションの推奨開始手順

1. `https://pchamdb.com/party_checker.html?forcepop` を開く
2. ポップアップ動作を確認（閉じるボタンが機能するか）
3. OK → アベに確認完了を報告
4. 次のタスク (B/C/D) をアベに確認して着手
