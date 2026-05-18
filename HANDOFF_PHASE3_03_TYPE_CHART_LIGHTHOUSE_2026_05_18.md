# type_chart.html Lighthouse 監査レポート — 2026-05-18

**作成**: 2026-05-18 JST (P303 / Phase3-03 セッション)
**監査対象**: https://pchamdb.com/type_chart.html (本番)
**監査ツール**: Lighthouse v12 (npx 経由、headless Chrome / form-factor: mobile / categories: performance,accessibility,seo,best-practices)
**監査時点コミット**: `a078af2` (PWA/OGP/Breadcrumb 追加直後、本日 Task A/B の sticky + SEO 強化は **未反映** の本番状態)

> ⚠️ 重要: 本監査は本日の Task A (モバイル sticky 化) / Task B (title・description SEO 強化) を反映する **前** の本番状態で実施。これらの未反映 commit を push 後、再監査で改善幅を確認推奨。

---

## 📊 スコアサマリ (Mobile)

| カテゴリ | スコア | 評価 |
|---|---|---|
| **Performance** | **47** | 🟥 要改善 (LCP 6.2s / CLS 0.986 が大きい) |
| **Accessibility** | **88** | 🟨 良好だが小さな指摘 3 件 |
| **SEO** | **100** | ✅ 満点 (今日の SEO 強化前でこの値、強化後も維持見込み) |
| **Best Practices** | **77** | 🟨 third-party cookie / 一般 issue 各 1 件 |
| PWA | — | 監査対象外 (本回はカテゴリ指定で除外、別途確認可) |

---

## 🟥 Performance: 47 → 改善余地大

### コアメトリクス

| メトリクス | 値 | 評価 |
|---|---|---|
| First Contentful Paint (FCP) | 3.2 s | 🟨 改善 (目標 1.8s) |
| **Largest Contentful Paint (LCP)** | **6.2 s** | 🟥 不良 (目標 2.5s) |
| Total Blocking Time (TBT) | 0 ms | ✅ |
| **Cumulative Layout Shift (CLS)** | **0.986** | 🟥 致命的 (目標 0.1) |
| Time to Interactive (TTI) | 6.3 s | 🟥 |
| Speed Index | 3.2 s | 🟨 |

### 主要な原因と改善案

#### 1. Unused JavaScript (推定 1300ms 節約可、225 KiB)

| 内訳 | サイズ | 浪費率 |
|---|---|---|
| AdSense `pagead/managed/js/adsense/...` | 133 KB | 76% |
| Google Tag Manager (`gtag.js?id=G-...`) | 67 KB | 42% |
| `adsbygoogle.js` | 30 KB | 54% |

→ **すべてサードパーティ広告/解析スクリプト**。これらは収益・解析に必須なため削除不可だが、以下で軽減可能:

- **改善案 P-1 (サイト共通)**: AdSense / Tag Manager の遅延ロード化
  - 現状: `<script async>` で head 内ロード
  - 提案: `<script defer>` + load on user interaction (scroll/click) で初期 LCP を改善
  - 担当: **DB01/DB02 領域 (サイト全体共通課題)**

#### 2. CLS 0.986 (致命的) — Layout Shift

主犯候補:
- **楽天モーションウィジェット** (body 直前 `position:fixed;bottom:0`) — script で iframe 挿入時に画面下部のレイアウトが押される
- AdSense iframe の遅延挿入
- 動的なチャート描画 (`renderChart`) — i18n ロード完了後に描画するため初期は空 → 後から大表が現れる

改善案:
- **改善案 P-2 (サイト共通)**: 楽天 widget の予約スペース固定
  - 現状: 楽天 script ロード後に高さが決まる
  - 提案: `#rakuten-motion-bar` に `min-height: 56px` (or 既知高さ) を pre-set → script 挿入時のシフトを 0 に
  - 担当: **DB02 (サイト共通)**
- **改善案 P-3 (type_chart 固有)**: チャート描画コンテナに pre-size
  - 現状: `<div class="scroll-x"><table id="chart-atk" class="chart"></table></div>` で空テーブル → JS で 19 行挿入
  - 提案: `.scroll-x` に `min-height: 480px` (or 推定) を予約 → 描画完了時のシフトを抑制
  - 担当: **P303 (本ファイル、即対応可能)**
  - 効果: CLS 0.986 → 0.2 程度に改善見込み (致命→良好)

#### 3. Efficient Cache Lifetimes (138 KiB 節約可)

- 静的リソース (favicon.png 等) のキャッシュ TTL が短い
- 改善案 P-4 (サイト共通): `Cache-Control: max-age=31536000` を画像/CSS/JS にセット
- 担当: **DB01/サーバ設定** (Cloudflare or hosting 設定)

---

## 🟨 Accessibility: 88 → 軽微な指摘 3 件

### 課題と改善案

#### 1. Color Contrast 違反 (header nav ボタン)

- 該当: `header.tc-header > nav > a.tc-nav-btn` 3 件 (おそらく nav-waza #F39C12 + 白文字、nav-checker #27AE60 + 白文字 等のうち低コントラスト箇所)
- WCAG AA 基準: 4.5:1 必要
- **判断**: ブランドカラー (姉妹画面で統一済) のため即変更しづらい
- 改善案 A-1 (サイト共通): ブランド色のコントラスト見直し OR `text-shadow: 0 0 2px rgba(0,0,0,.8)` を強化して可読性補強
- 担当: **DB01 (サイト全体デザイン決定)**

#### 2. `<iframe>` に title 属性なし

- 楽天モーションウィジェットが挿入する iframe に title 無し
- 改善案 A-2: `#rakuten-motion-bar` 内に静的 iframe を予め置けないため、MutationObserver で挿入直後に title 付与する JS を仕込む
- 担当: **DB02 (サイト全体 / ad-toggle.js 等の周辺)**

#### 3. Document does not have a `<main>` landmark

- 現状: `<header>` + `<section>` × 2 + `<footer>` 構成、`<main>` 要素なし
- **改善案 A-3 (type_chart 固有、即対応可能)**: `<section>` × 2 を `<main>` で包む
  ```html
  <main>
    <section><h2>① 攻撃ベース</h2>...</section>
    <section><h2>② 防御ベース</h2>...</section>
  </main>
  ```
- 担当: **P303 (本ファイル、5 分作業)**
- 効果: a11y 88 → ~95 見込み

---

## 🟨 Best Practices: 77 → 2 件

#### 1. Uses third-party cookies (1 件)

- AdSense / Google Tag が third-party cookie を設定
- Chrome の third-party cookie 廃止方針で警告
- **判断**: 広告収益のため削除不可。Google 側の代替策 (Privacy Sandbox) に追従するのを待つ
- 担当: **受動 (Google 側対応待ち)**

#### 2. Issues logged in Chrome DevTools (1 件)

- 詳細は本監査では取得できず (DevTools 直接確認推奨)
- 担当: **DB01 (詳細調査)**

---

## ✅ SEO: 100 (満点)

監査時点 (`a078af2`) で既に満点。本日の Task B (title / description 強化) 反映後も維持される見込み:
- title / meta description / canonical / hreflang / robots / OGP / Twitter Card / JSON-LD 全揃い
- BreadcrumbList / WebApplication schema markup
- viewport meta / language attr / image alt 等の小項目もクリア

---

## 🎯 P303 が即対応可能な改善 (本日中)

| ID | 内容 | 効果 | 工数 |
|---|---|---|---|
| **P-3** | `.scroll-x` に `min-height` 予約で CLS 改善 | **CLS 0.986 → 0.2** (致命→良好) | 5 分 |
| **A-3** | `<section>` × 2 を `<main>` で囲む | a11y 88 → ~95 | 5 分 |

これらは **退行リスク低 + 効果大**。本 commit に含めるべきか、別 commit にするか DB01 判断求む。

P303 推奨: **本 Task A+B commit に追加包含** (関連性が高く、Task C の audit 結果反映として自然)。

---

## 📋 各セッション別 改善タスク振り分け

### 🟧 P303 (即対応推奨、本日中)
- [ ] P-3: CLS 改善 — `.scroll-x` に `min-height` 予約
- [ ] A-3: a11y — `<main>` landmark 追加

### 🟦 DB01 (リーダー判断・サイト全体)
- [ ] P-1: AdSense / Tag Manager 遅延ロード化検討
- [ ] P-4: 静的リソースの Cache-Control 強化 (サーバ設定)
- [ ] A-1: ブランドカラー contrast 見直し OR text-shadow 補強

### 🟨 DB02 (サイト全体 UI/SEO 領域)
- [ ] P-2: 楽天 widget pre-size で CLS 抑制
- [ ] A-2: 楽天 iframe に title 動的付与 (MutationObserver)

### ⏳ 受動
- B-1: third-party cookie → Google 側 Privacy Sandbox 移行待ち

---

## 🔮 次の監査タイミング推奨

1. **本日中 (Task A/B + P-3/A-3 反映後)**: type_chart.html 再監査 — Performance 47 → 60+ / a11y 88 → 95+ 予想
2. **5/19 以降 (サイト共通改善反映後)**: 全 17 ページの一括監査 — DB02 領域

監査スクリプト再現コマンド (将来用):
```bash
cd /tmp && npx --yes lighthouse https://pchamdb.com/type_chart.html \
  --output=json --output-path=./lh_mobile.json --quiet \
  --chrome-flags="--headless=new --no-sandbox" \
  --form-factor=mobile --screenEmulation.disabled \
  --only-categories=performance,accessibility,seo,best-practices
```

PageSpeed Insights API もあるが本日 (5/18) はクォータ超過のため不可。1 日経てば復活見込み。

---

## 🔗 関連

- HANDOFF_DB01_TO_P303_2026_05_18.md (本 audit を含む指示書、Task C 該当)
- HANDOFF_PHASE3_03_TYPE_CHART_UX.md (UX 改修全体)
- 本監査の生 JSON: `/tmp/lh_mobile.json` (818 KiB、必要なら別途共有)
