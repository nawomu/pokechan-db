# OGP / meta タグ 9 言語対応 調査 + 補強 — 2026-05-18

**作成**: 2026-05-18 JST (夕方)
**作成セッション**: ポケモンDB セッション
**対象**: 全 17 HTML ページの OGP / Twitter Card / meta description / og:locale 系

---

## 🎯 ひとことで

> 全 17 ページの OGP/meta を監査。**ja 版 6 ページ** + **単一URL 多言語ページ 2 ファイル** に `og:locale:alternate` を追加 (Facebook SNS の代替言語表示対応)。
> **battle_simulator.html は meta タグ完全欠如** → Phase3 領域のため別途依頼。
> 単一URL 多言語ページ (waza-list / type_chart) は Phase3 領域のため別途依頼。

---

## 📊 調査結果 (17 ページ)

### ✅ 既に整備済み

| ページ | meta desc | og:title | og:desc | og:img | og:locale | og:locale:alt | twitter:card | html lang |
|---|---|---|---|---|---|---|---|---|
| index_en.html | ✅ | ✅ | ✅ | 2 | 2 | 1 | ✅ | en |
| making_en.html | ✅ | ✅ | ✅ | 1 | 2 | 1 | ✅ | en |
| terms_en.html | ✅ | ✅ | ✅ | 1 | 2 | 1 | ✅ | en |
| privacy_en.html | ✅ | ✅ | ✅ | 1 | 2 | 1 | ✅ | en |
| disclaimer_en.html | ✅ | ✅ | ✅ | 1 | 2 | 1 | ✅ | en |
| contact_en.html | ✅ | ✅ | ✅ | 1 | 2 | 1 | ✅ | en |

→ \_en.html ペアは og:locale:alternate に ja_JP が指定されており完備。

### 🟡 ja 版に og:locale:alternate なし → 本作業で追加

| ページ | 修正前 | 修正後 |
|---|---|---|
| index.html | og:locale: ja_JP のみ | + en_US 追加 |
| making.html | 同上 | + en_US 追加 |
| terms.html | 同上 | + en_US 追加 |
| privacy.html | 同上 | + en_US 追加 |
| disclaimer.html | 同上 | + en_US 追加 |
| contact.html | 同上 | + en_US 追加 |

### 🟢 単一URL 多言語ページに 8 言語 alternate 追加 (本作業で実装)

| ページ | 修正後 |
|---|---|
| pokemon_db_v9.html | og:locale ja_JP + 8 言語 alternate (en/ko/zh_CN/zh_TW/fr/de/it/es) |
| party_checker.html | 同上 (8 言語) |

理由: これらは単一URL でランタイム多言語切替するため、SNS シェアされた時に Facebook が代替言語を識別できるようにする。

### 🔴 未補強 (Phase3 領域、別途依頼)

| ページ | 状況 | 必要な対応 |
|---|---|---|
| **battle_simulator.html** | **meta description / og:* / twitter:card 全て無し** | 新規追加 (HTML テンプレ + 内容、要 Phase3 判断) |
| waza-list.html | og:locale ja_JP のみ | 8 言語 alternate 追加 (pokemon_db_v9 と同じ) |
| type_chart.html | 同上 | 8 言語 alternate 追加 (現在 Phase3 が UX 拡張中、合わせて) |

---

## 💡 補足: Facebook OGP の og:locale:alternate 仕様

- 1 つの URL で複数言語提供する場合に追加する meta
- Facebook がユーザーの言語設定に基づいて自動切替の対象として認識
- 値の形式は POSIX ロケール (`ja_JP`, `en_US`, `ko_KR`, `zh_CN`, `zh_TW` 等)
- 複数並べる場合は `og:locale:alternate` タグを言語ごとに **複数記述**
  - 例: `<meta property="og:locale:alternate" content="en_US"><meta property="og:locale:alternate" content="ko_KR">` ...

参考: https://ogp.me/#optional / Facebook OG Debugger で検証可

---

## 🚦 Phase3 セッションへの依頼事項

ポケモンDB セッションからは battle_simulator / waza-list / type_chart を **触らない方針** のため、以下を Phase3 で対応願います:

### 1. battle_simulator.html の meta/OGP 完全実装 (高優先度)

現状 0 件 → 以下を `<head>` に追加推奨 (他ページのテンプレ参考):

```html
<meta name="description" content="PchamDB バトルシミュレータ — ポケモンチャンピオンズの対戦ダメージ計算・タイプ相性・確定数判定 + メガ進化/持ち物倍率対応">
<meta property="og:title" content="バトルシミュレータ - PchamDB">
<meta property="og:description" content="ダメージ計算・確定数・タスキ判定・持ち物倍率対応のバトルシミュレータ">
<meta property="og:type" content="website">
<meta property="og:url" content="https://pchamdb.com/battle_simulator.html">
<meta property="og:image" content="https://pchamdb.com/branding/logo/logo_main_white_bg.png">
<meta property="og:locale" content="ja_JP">
<meta property="og:locale:alternate" content="en_US">
<meta property="og:locale:alternate" content="ko_KR">
<meta property="og:locale:alternate" content="zh_CN">
<meta property="og:locale:alternate" content="zh_TW">
<meta property="og:locale:alternate" content="fr_FR">
<meta property="og:locale:alternate" content="de_DE">
<meta property="og:locale:alternate" content="it_IT">
<meta property="og:locale:alternate" content="es_ES">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="バトルシミュレータ - PchamDB">
<meta name="twitter:description" content="ダメージ計算・確定数・タスキ判定・持ち物倍率対応">
<meta name="twitter:image" content="https://pchamdb.com/branding/logo/logo_main_white_bg.png">
```

→ Phase3 が C5 持ち物統合 + Init-B メガ進化と進めるタイミングで合わせて追加してもらえると最適。

### 2. waza-list.html に 8 言語 og:locale:alternate 追加

pokemon_db_v9.html と同じパターン:
```html
<meta property="og:locale" content="ja_JP">
<meta property="og:locale:alternate" content="en_US">
<meta property="og:locale:alternate" content="ko_KR">
<meta property="og:locale:alternate" content="zh_CN">
<meta property="og:locale:alternate" content="zh_TW">
<meta property="og:locale:alternate" content="fr_FR">
<meta property="og:locale:alternate" content="de_DE">
<meta property="og:locale:alternate" content="it_IT">
<meta property="og:locale:alternate" content="es_ES">
```

### 3. type_chart.html に 8 言語 og:locale:alternate 追加

同上。Phase3 が UX 拡張作業中なので合わせて修正推奨。

---

## ✅ 本作業の git 変更

| ファイル | 変更 |
|---|---|
| index.html | + og:locale:alternate (en_US) |
| making.html | + og:locale:alternate (en_US) |
| terms.html | + og:locale:alternate (en_US) |
| privacy.html | + og:locale:alternate (en_US) |
| disclaimer.html | + og:locale:alternate (en_US) |
| contact.html | + og:locale:alternate (en_US) |
| pokemon_db_v9.html | + og:locale:alternate × 8 |
| party_checker.html | + og:locale:alternate × 8 |
| (新規) HANDOFF_OGP_META_2026_05_18.md | 本文書 |

→ 8 ファイル修正、+22 lines (en_US × 6 + 8 言語 × 2 ファイル)

---

## 🔗 関連

- HANDOFF_COLLAB_2026_05_18.md (作業分担マップ)
- HANDOFF_SEO_SETUP_2026_05_18.md (Search Console 登録手順)
- sitemap.xml (5/18 最新化済)
- 既存メモリ: `feedback_image_background.md` (白背景版を使う = 既に og:image は適切)
