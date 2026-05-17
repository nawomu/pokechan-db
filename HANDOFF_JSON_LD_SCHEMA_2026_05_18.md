# JSON-LD schema 補強 — 2026-05-18

**作成**: 2026-05-18 JST (夕方〜夜)
**作成セッション**: ポケモンDB セッション
**対象**: 全 17 HTML ページの structured data (schema.org / JSON-LD)

---

## 🎯 ひとことで

> 17 ページの JSON-LD を監査し、不足 10 ファイルに schema を追加。
> 法的 8 ファイルに **WebPage/ContactPage + BreadcrumbList** を新規実装、
> pokemon_db_v9 / party_checker に **BreadcrumbList** を追加。
> 検索結果のリッチスニペット (パンくず表示) が有効になる + Google が
> サイト構造を正確に把握できる。

---

## 📊 監査結果 (修正前 → 修正後)

| ページ | 修正前 | 修正後 | 変更内容 |
|---|---|---|---|
| index.html | Organization+WebSite+ImageObject | 同上 | 据え置き (Top ページは Breadcrumb 不要) |
| index_en.html | 同上 | 同上 | 同上 |
| pokemon_db_v9.html | WebApplication+WebSite+Offer | **+ BreadcrumbList** | 2 ブロック構成 |
| party_checker.html | 同上 | **+ BreadcrumbList** | 2 ブロック構成 |
| waza-list.html | WebApplication+WebSite+Offer | 同上 | Phase3 領域、別途依頼 |
| type_chart.html | 同上 | 同上 | Phase3 領域、別途依頼 |
| battle_simulator.html | **なし** | **なし** | Phase3 領域、別途依頼 |
| making.html | Article+WebPage+Organization+ImageObject | 同上 | 既に充分 |
| making_en.html | 同上 | 同上 | 同上 |
| terms.html | **なし** | **WebPage + BreadcrumbList** | 新規 |
| terms_en.html | **なし** | **WebPage + BreadcrumbList** | 新規 |
| privacy.html | **なし** | **WebPage + BreadcrumbList** | 新規 |
| privacy_en.html | **なし** | **WebPage + BreadcrumbList** | 新規 |
| disclaimer.html | **なし** | **WebPage + BreadcrumbList** | 新規 |
| disclaimer_en.html | **なし** | **WebPage + BreadcrumbList** | 新規 |
| contact.html | **なし** | **ContactPage + BreadcrumbList** | 新規 |
| contact_en.html | **なし** | **ContactPage + BreadcrumbList** | 新規 |

→ **私領域 10 ファイル** に schema 追加。**Phase3 領域 3 ファイル** は別途依頼。

---

## 🔨 実装内容

### 法的 8 ファイル: WebPage + BreadcrumbList

各ファイルの `</head>` 直前に独立した `<script type="application/ld+json">` を追加。

例 (terms.html):
```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "利用規約 - PchamDB",
  "url": "https://pchamdb.com/terms.html",
  "inLanguage": "ja",
  "description": "PchamDB (ピーチャンディービー) の利用規約。",
  "isPartOf": { "@type": "WebSite", "name": "PchamDB", "url": "https://pchamdb.com/" },
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "PchamDB", "item": "https://pchamdb.com/" },
      { "@type": "ListItem", "position": 2, "name": "利用規約", "item": "https://pchamdb.com/terms.html" }
    ]
  }
}
```

ポイント:
- ja 版は `"inLanguage": "ja"` + breadcrumb item は `https://pchamdb.com/`
- en 版は `"inLanguage": "en"` + breadcrumb item は `https://pchamdb.com/index_en.html`
- contact.html / contact_en.html は `@type: ContactPage` (より specific)、それ以外は `WebPage`

### pokemon_db_v9 / party_checker: BreadcrumbList を独立 script で追加

既存の WebApplication schema は維持しつつ、別 `<script>` で BreadcrumbList を並列追加 (Google は両方を統合的に認識)。

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "PchamDB", "item": "https://pchamdb.com/" },
    { "@type": "ListItem", "position": 2, "name": "ポケモンDB", "item": "https://pchamdb.com/pokemon_db_v9.html" }
  ]
}
```

---

## 🧪 検証

| 項目 | 結果 |
|---|---|
| 全 17 ページの ld+json 数 | 8 → **18 ブロック** (法的 +8、データツール +2) |
| JSON 構文検証 | **18/18 OK、エラーなし** |
| 検証スクリプト | `python3` で全 ld+json ブロックを抽出 → `json.loads` で構文確認 |

push 後の本番確認推奨:
- https://search.google.com/test/rich-results — Google リッチリザルトテスト
- 各 URL を入力 → 「BreadcrumbList」「WebPage」等が検出されるか確認

---

## 🚦 Phase3 セッションへの依頼事項

### 1. battle_simulator.html に JSON-LD 一式 (高優先度)

現状 0 件。OGP/meta も欠如しているので、合わせて追加推奨。テンプレ:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "バトルシミュレータ",
  "url": "https://pchamdb.com/battle_simulator.html",
  "description": "ポケモンチャンピオンズの対戦ダメージ計算・タイプ相性・確定数判定 + メガ進化/持ち物倍率対応",
  "applicationCategory": "GameApplication",
  "operatingSystem": "Web",
  "browserRequirements": "Requires JavaScript",
  "isPartOf": { "@type": "WebSite", "name": "PchamDB", "url": "https://pchamdb.com/" },
  "inLanguage": "ja",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "JPY" }
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "PchamDB", "item": "https://pchamdb.com/" },
    { "@type": "ListItem", "position": 2, "name": "バトルシミュレータ", "item": "https://pchamdb.com/battle_simulator.html" }
  ]
}
</script>
```

### 2. waza-list.html に BreadcrumbList 追加

既存 WebApplication schema の後ろに、独立 script で:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "PchamDB", "item": "https://pchamdb.com/" },
    { "@type": "ListItem", "position": 2, "name": "わざ一覧", "item": "https://pchamdb.com/waza-list.html" }
  ]
}
```

### 3. type_chart.html に BreadcrumbList 追加

同上のパターンで `"name": "タイプ相性表"`、`"item": "https://pchamdb.com/type_chart.html"`。

Phase3 が現在 UX 拡張中なので、合わせて追加してもらえると最適。

---

## ✅ 本作業の git 変更

| ファイル | 変更 |
|---|---|
| terms.html | +18 lines (WebPage + BreadcrumbList) |
| terms_en.html | +18 lines |
| privacy.html | +18 lines |
| privacy_en.html | +18 lines |
| disclaimer.html | +18 lines |
| disclaimer_en.html | +18 lines |
| contact.html | +18 lines (ContactPage + BreadcrumbList) |
| contact_en.html | +18 lines |
| pokemon_db_v9.html | +11 lines (BreadcrumbList) |
| party_checker.html | +11 lines (BreadcrumbList) |
| (新規) HANDOFF_JSON_LD_SCHEMA_2026_05_18.md | 本文書 |

→ **10 HTML 修正 + 1 新規 HANDOFF、計約 +180 lines**

---

## 🎯 SEO 効果 (期待値)

| 効果 | 影響範囲 | 検証方法 |
|---|---|---|
| 検索結果でパンくず表示 | 全 10 ページ (法的 8 + データツール 2) | 1-2 週間後の Google 検索結果 |
| サイト構造の正確な把握 | サイト全体 | Search Console > リッチリザルト |
| 法的ページの正式 schema 認識 | terms / privacy / disclaimer / contact | リッチリザルトテスト |
| (将来) FAQPage 検討余地 | contact.html | お問い合わせ FAQ を整理した時 |

---

## 🔗 関連

- HANDOFF_SEO_SETUP_2026_05_18.md (Search Console 登録手順 + sitemap)
- HANDOFF_OGP_META_2026_05_18.md (OGP/Twitter Card 監査)
- HANDOFF_COLLAB_2026_05_18.md (作業分担マップ)
- sitemap.xml (5/18 最新化済)
