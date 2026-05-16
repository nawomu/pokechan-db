# HANDOFF: i18n 実装作業 引き継ぎ

**作成日**: 2026-05-16 (orchestrator セッションからの引き継ぎ)
**渡し先**: ポケモンDBレポジトリ (`~/Documents/ポケモンDB/`) で動いている別セッション
**前提**: [HANDOFF_I18N.md](./HANDOFF_I18N.md) を先に読んでいること

このファイルは「データ側 (i18n JSON 生成) は完了済み。あとは本番 HTML/JS への組込のみ」という状態の引き継ぎです。

---

## ✅ orchestrator セッションでこのセッション中に完了したこと

### データ整備 (A〜M)

| 項目 | 内容 | 件数 | スクリプト |
|---|---|---|---|
| A | genera (ジャンル) | 712 × 8 言語 | `i18n/build_genera.py` |
| B | natures (性格) | 25 × 8 言語 | `i18n/build_natures.py` |
| C/H | status (状態異常) | **20** × 8 言語 (手動翻訳、初期 7→20 に拡張) | `i18n/build_status.py` |
| F | abilities `short_effect` 補完 | es/it/ko/zh: 6/16→180+ | `i18n/build_ability_short_effect_fallback.py` |
| G | moves `desc` 補完 | fr +14, it +5, zh-Hant +5 (残 SV 新技は不可) | `i18n/build_move_desc_fallback.py` |
| I | `ui-{de,es,fr,it,ko,zh-Hans,zh-Hant}.json` 生成 | 各 130 キー | `i18n/build_ui_translations.py` |
| 追加 | **move targets** (敵単体/全体等) を 17 種 × 9 言語 | 17 × 9 言語 | `i18n/build_move_targets.py` |
| M | フォルム名カバレッジ | 275/275 (確認のみ、既に網羅済) | — |
| **K** | **items (持ち物) 多言語化** | **73 items + 12 categories × 9 言語** | `i18n/build_items.py` |

### 公開素材 (SEO / hreflang / sitemap)

`HANDOFF_I18N_PUBLISH.md` 参照。`i18n/page_meta.json` / `i18n/sitemap_strategy_*.xml` / `i18n/hreflang_blocks_strategy_*.html` をプリビルド済。

### 本番ページへの組込 (D-1 / D-2 / D-3)

| 項目 | 内容 | 件数 |
|---|---|---|
| D-1 | `index.html` に `data-i18n` 属性挿入 | 15 キー / 17 属性 |
| D-2 | `party_checker.html` 静的 HTML に挿入 | 32 キー / 31 属性 |
| D-3 | 言語切替 UI | runtime.js が自動マウント |

### 監査

```bash
python3 i18n/audit_ui_keys.py
```

結果: **全 9 言語のキー集合が完全一致 (113 キー)、HTML 参照 47 キーすべて定義済み**。

### バックアップ

| 場所 | 内容 |
|---|---|
| `i18n/bak/{lang}.20260516_064320.bak.json` | A/B/C 実行前の 8 言語 JSON |
| `i18n/bak/{lang}.20260516_*.bak.json` | F 実行前 |
| `i18n/bak/{lang}.moves.20260516_*.bak.json` | G 実行前 |
| `bak/index.20260516_064500.bak.html` | D-1 実行前 |
| `bak/party_checker.20260516_064500.bak.html` | D-2 実行前 |

---

## ⬜ 残作業 (実装側セッション向け)

### 🔴 優先度高

#### 1. party_checker.html の JS 動的生成部分の翻訳化

現在の data-i18n 属性は静的 HTML のみ。JavaScript で生成される以下の文字列は未翻訳:

**ファイル**: `party_checker.html`
**該当行と内容**:

| 行 | 元の文字列 | 推奨対応 |
|---|---|---|
| ~605 | `📣 PR / 楽天市場` | スキップ (広告) |
| ~608 | `3秒…` / `✕ 閉じる` | 動的タイマー。`I18N.t('common.closing_in', '3秒…')` 化 |
| ~1567 | `'📋 わざリスト'` (createElement で textContent 設定) | `I18N.t('nav.moves_list')` |
| ~1597 | `'タブ' + newId` | `I18N.t('checker.tab') + newId` (新キー要) |
| ~439 | `${EV_STAT_LABEL[k]}` (stats のラベル) | EV_STAT_LABEL を `I18N.t('stats.atk')` などへ書換 |
| ~2602 | `'全タイプ ▾'` | `I18N.t('checker.all_types')` 新キー要 |
| ~2604 | ``${pfSelectedTypes.size}タイプ ▾`` | 同上 + 動的件数 |
| ~2611 | `'<option value="">全対象</option>'` | `I18N.t('checker.all_targets')` |
| ~2645 | `${pfTempSel.size}件選択中 / 表示中 ${...}件` | 動的件数。テンプレート関数化要 |
| ~2733-2742 | `'—'` / `'+' + pri` / `'接●'` 等 | データ表示用シンボル。基本そのまま |
| ~2747 | `tDisp(m.type)` | 既存。`I18N.type(m.type)` 化 |

**実装パターン**:

```javascript
// Before
const btn = document.createElement('button');
btn.textContent = '📋 わざリスト';

// After: I18N が ready になってから設定
function setBtnText() {
  btn.textContent = window.I18N ? I18N.t('nav.moves_list', '📋 わざリスト') : '📋 わざリスト';
}
setBtnText();
document.addEventListener('i18n:ready', setBtnText);
document.addEventListener('i18n:changed', setBtnText);
```

または、要素生成直後に runtime.js の `applyDOM(el)` を呼ぶ:

```javascript
const btn = document.createElement('button');
btn.setAttribute('data-i18n', 'nav.moves_list');
btn.textContent = '📋 わざリスト';  // default fallback
bar.appendChild(btn);
if (window.I18N) I18N.apply(btn);  // 即時翻訳適用
```

後者の方が DRY で推奨。

#### 2. ポケモン名 / 技名 / 特性名 / タイプ名の動的翻訳

`party_checker.html` の検索・テーブル描画では `m.name`, `m.type` などを直接表示している。
**`I18N.pokemon(jaName)` / `I18N.move(keyOrJa)` / `I18N.ability(jaName)` / `I18N.type(jaName)` で置換要**。

該当箇所 (party_checker.html):
- `pokemon_db_v9.html` 側でも同様の書換が必要
- テーブル描画関数 (`pfRender` line 2744 等) の m.name → `I18N.move(m.key)` or `I18N.move(m.name)`
- m.type → `I18N.type(m.type)`
- カテゴリ "物理"/"特殊"/"変化" → `I18N.t('category.physical', '物理')` 等
- m.target (例: "敵単体") → 新規 `targets.*` キー群を ui-{lang}.json に追加要

**注**: 描画が大量回数走るのでパフォーマンス注意。`I18N.t()` は O(1) なので 1000 件程度なら問題なし。

#### 3. `i18n:changed` イベントでの再描画

ユーザが言語切替したとき、テーブル等は再描画が必要。

```javascript
document.addEventListener('i18n:changed', () => {
  if (typeof renderTable === 'function') renderTable();
  if (typeof pfRender === 'function') pfRender();
});
```

`party_checker.html` の末尾あたりに 1 か所追加すれば良い。

---

### 🟡 優先度中

#### 4. index.html のチアセクション (HTML 入子) の分割

**現状** (index.html line 330-331):

```html
<p class="cheer-text">管理人 <a href="making.html" class="pchan-link" title="制作の裏側を読む"><strong>ぴ〜ちゃん。</strong></a>みんなの対戦準備を応援しています！</p>
<p class="cheer-desc"><strong>PchamDB</strong> (ピーチャンディービー) は、ポケモンチャンピオンズの<br>対戦・パーティ構築に役立つ <strong>非公式ファンデータベース</strong> です。</p>
```

`data-i18n` は textContent 全置換なので `<strong>` `<br>` `<a>` が消える。

**対応**: テキストを区切って span に分割し、各 span に data-i18n:

```html
<p class="cheer-text">
  <span data-i18n="cheer.admin_label">管理人</span>
  <a href="making.html" class="pchan-link" title="制作の裏側を読む">
    <strong data-i18n="cheer.admin_name">ぴ〜ちゃん。</strong>
  </a>
  <span data-i18n="cheer.admin_message">みんなの対戦準備を応援しています！</span>
</p>
<p class="cheer-desc">
  <strong>PchamDB</strong>
  <span data-i18n="cheer.desc_line1">(ピーチャンディービー) は、ポケモンチャンピオンズの</span>
  <br>
  <span data-i18n="cheer.desc_line2">対戦・パーティ構築に役立つ</span>
  <strong data-i18n="cheer.desc_emphasis">非公式ファンデータベース</strong>
  <span data-i18n="cheer.desc_line3">です。</span>
</p>
```

そのうえで `ui-{lang}.json` の `cheer.*` 新キーを 9 言語に追加。

#### 5. battle_simulator.html への runtime.js 組込

**現状**: runtime.js を読み込んでいない (line 1: なし)。

**対応**:
1. `<head>` に `<script defer src="i18n/runtime.js"></script>` 追加
2. 言語切替マウントポイント挿入: `<span id="i18n-switcher-mount"></span>` を画面上部に
3. 主要 UI 文言に data-i18n 追加
4. ステ計算機・ダメ計の独自用語 (例: "性格補正", "実数値") は ui-ja.json/ui-en.json に `simulator.*` 新キー群を追加要

#### 6. SEO: hreflang タグの拡張

**現状** (index.html line 11-13):

```html
<link rel="alternate" hreflang="ja" href="https://pchamdb.com/">
<link rel="alternate" hreflang="en" href="https://pchamdb.com/index_en.html">
<link rel="alternate" hreflang="x-default" href="https://pchamdb.com/">
```

ja/en 別ページ方式と、runtime.js による動的切替方式が混在中。整合性を取る必要あり。

**判断ポイント**:
- (A) **URL ベース** (`/en/index.html`): SEO 強い、`hreflang` フル対応、サイトマップ別個
- (B) **クエリ** (`?lang=en`): SEO 中、実装簡単
- (C) **localStorage のみ** (現状): SEO 弱、ロボットからは ja に見える

公開戦略はあべさんと相談要。決まり次第:
- `runtime.js` の URL 同期処理を追加
- 各 HTML の hreflang を 9 言語分追記
- `sitemap-{lang}.xml` 生成

---

### 🟢 優先度低

#### 7. status (状態異常) を 7→20+ に拡張

**現状**: まひ/ねむり/こおり/やけど/どく/もうどく/こんらん の 7 種。

**追加候補** (要手動翻訳):
- メロメロ infatuation
- バインド bound
- やどりぎのタネ leech seed
- あくむ nightmare
- いちゃもん torment
- かなしばり disable
- ねむけ yawn (drowsy)
- かいふくふうじ heal block
- アンコール encore

**対応**: `i18n/build_status.py` の `STATUS` 辞書に追記すれば全 8 言語に反映される。

#### 8. items (もちもの) の i18n 化 — ✅ **完了**

完了済 (2026-05-16):
- `_review/items_database.json` の 73 items + 12 categories を 9 言語化済
- 各 `i18n/{lang}.json` に `items` と `item_categories` セクション追加済

**実装側で必要な作業**:
- party_checker または battle_simulator で持ち物名・効果を表示する箇所は `I18N.item(jaName)` か `i18n/{lang}.json[items][jaName]` を直接参照
- 必要なら `runtime.js` に `tItem(jaName)` を追加 (現状は item ヘルパーなし)

runtime.js への追加例:

```javascript
function tItem(jaName) {
  if (currentLang === 'ja' || !jaName) return jaName;
  const d = cache[currentLang];
  if (!d) return jaName;
  const entry = d.items && d.items[jaName];
  if (entry && entry.name) return entry.name;
  return jaName;
}
function tItemEffect(jaName) {
  if (!jaName) return null;
  const d = cache[currentLang];
  if (!d) return null;
  const entry = d.items && d.items[jaName];
  return (entry && entry.effect) || null;
}
function tItemCategory(catKey) {
  const d = cache[currentLang];
  if (!d || !d.item_categories) return catKey;
  return d.item_categories[catKey] || catKey;
}
```

そして `loadLang` 内の `cache[lang]` 構築で:

```javascript
cache[lang] = {
  ...,
  items: main ? main.items || {} : {},
  item_categories: main ? main.item_categories || {} : {},
};
```

最後に公開 API に追加:

```javascript
window.I18N = {
  ...,
  item: tItem,
  itemEffect: tItemEffect,
  itemCategory: tItemCategory,
};
```

#### 9. WAZA_TAG_DB (わざタグ) の多言語化

`pokechan_data.js` の `WAZA_TAG_DB` (タグ分類) は完全手動翻訳が必要。
party_checker の効果フィルターパネルで使われる。

---

## 📂 i18n フォルダ最終構成

```
i18n/
├── ja.json (不要 — runtime は ja を翻訳しない)
├── en.json          # PokeAPI 主辞書 (types/abilities/pokemon/moves) + genera/natures/status
├── de.json es.json fr.json it.json ko.json zh-Hans.json zh-Hant.json   # 同上 × 7 言語
├── ui-ja.json       # UI 文言原典 (113 キー)
├── ui-en.json ui-de.json ui-es.json ui-fr.json ui-it.json ui-ko.json
├── ui-zh-Hans.json ui-zh-Hant.json   # ui-ja と同じキー構造
├── runtime.js       # 言語切替ランタイム (公開 API: window.I18N)
├── preview.html     # 多言語データ確認ビュー
│
├── fetch_i18n.py    # 既存: 英語辞書生成 (古い)
├── fetch_multi.py   # 既存: 多言語版生成 (古い、新スクリプトに統合可)
├── resolve_multi.py # 既存
├── resolve_unresolved.py # 既存
│
├── build_genera.py                       # A: ジャンル抽出
├── build_natures.py                      # B: 性格取得
├── build_status.py                       # C: 状態異常 (手動)
├── build_ability_short_effect_fallback.py # F: ability fallback
├── build_move_desc_fallback.py           # G: move desc fallback
├── build_ui_translations.py              # I: UI 多言語化
├── audit_ui_keys.py                      # 整合性チェッカー
│
├── cache/           # PokeAPI 取得結果キャッシュ
│   ├── ability/     # 371 ファイル
│   ├── form/
│   ├── move/        # 937 ファイル
│   ├── nature/      # 25 ファイル (B 実行で生成)
│   ├── pokemon/
│   ├── species/     # 1025 ファイル
│   └── type/
└── bak/             # 編集前バックアップ (タイムスタンプ付)
```

---

## 🔧 公開 API リファレンス (runtime.js)

```javascript
window.I18N = {
  lang,                         // 'ja' | 'en' | ... 現在言語
  SUPPORTED,                    // ['ja','en','es','fr','de','it','ko','zh-Hans','zh-Hant']
  setLang(lang),                // 言語切替 + ページ全体再翻訳
  t(key, fallback),             // UI 文字列取得: I18N.t('buttons.search', '検索')
  pokemon(jaName),              // 'フシギダネ' → 'Bulbasaur'
  move(keyOrJa),                // 'hataku' or 'はたく' → 'Pound'
  moveDesc(keyOrJa),            // 技説明文
  ability(jaName),              // 'もうか' → 'Blaze'
  type(jaName),                 // 'ほのお' → 'Fire'
  apply(rootElement),           // DOM の data-i18n を再走査 (動的追加要素に使う)
  onReady(callback),            // 辞書ロード完了時のコールバック
};
```

### data-i18n 属性パターン

```html
<!-- textContent 翻訳 -->
<button data-i18n="buttons.search">検索</button>

<!-- 属性翻訳 (複数も可) -->
<input data-i18n-attr="placeholder:filter.type">

<!-- 複合 -->
<button data-i18n="buttons.search"
        data-i18n-attr="title:tip.search,aria-label:tip.search">検索</button>
```

### イベント

```javascript
document.addEventListener('i18n:ready',   e => { /* 初回ロード完了 */ });
document.addEventListener('i18n:changed', e => { /* 言語切替時 */ });
```

---

## ✅ 動作確認チェックリスト

実装時の最低限の確認:

- [ ] index.html を `python3 -m http.server 8765` で起動 → 右上 🌐 → English に切替 → カードタイトル/フッターが英語化
- [ ] party_checker.html → English → フィルタバー (わざ検索/分類/種族値) が英語化
- [ ] party_checker.html → English → ポケモン選択モーダル / 技選択モーダル / 性格選択 / EV 画面のボタンが英語化
- [ ] 言語切替後リロード → 言語が維持されている (localStorage)
- [ ] ブラウザの言語設定が ja 以外 → 初回訪問時に該当言語で表示
- [ ] 監査 `python3 i18n/audit_ui_keys.py` → 不整合 0

---

## 🎯 推奨着手順 (実装側セッションへ)

1. **動的 JS 部の最大インパクト**: 残作業 #2 (ポケモン名/技名のテーブル動的翻訳) — `I18N.move()` / `I18N.type()` を呼ぶだけで何百もの要素が翻訳される
2. **言語切替時の再描画**: 残作業 #3 — 1 行で完了、即効果大
3. **動的ボタン**: 残作業 #1 — タブバーなど目立つ要素から
4. **チアセクション**: 残作業 #4 — index.html を完全英語化したい場合
5. その他 (5〜9) は公開戦略次第

---

最終更新: 2026-05-16 (orchestrator セッションでの実装完了+引き継ぎ)
