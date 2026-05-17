# SEO セットアップ手順 — 2026-05-18

**作成**: 2026-05-18 JST
**作成セッション**: ポケモンDB セッション (UI + i18n + SEO 担当)
**対象**: Google Search Console / sitemap.xml / hreflang 戦略

---

## 🎯 ひとことで

> sitemap.xml を最新化 (5/18 lastmod、新ページ type_chart + battle_simulator を追加)。
> Google Search Console 登録は **あべ作業** が必要なため、本ドキュメントで手順書化。

---

## ✅ 5/18 ポケモンDB セッションで実施したこと

### 1. sitemap.xml 更新

- 全 URL の `<lastmod>` を `2026-05-18` に更新
- 新規 URL 追加 (5/17 公開):
  - `https://pchamdb.com/battle_simulator.html` (priority 0.7)
  - `https://pchamdb.com/type_chart.html` (priority 0.7)
- 主要機能ページの priority/changefreq は据え置き
- hreflang はトップページ (`/` / `index_en.html`) と法的ページ (`*_en.html`) の 2 URL ペアのみ。データツール系 (pokemon_db_v9 / waza-list / party_checker / battle_simulator / type_chart) は **単一 URL でランタイム言語切替** なので hreflang 対象外

### 2. robots.txt 確認 (変更なし)

```
User-agent: *
Allow: /

Sitemap: https://pchamdb.com/sitemap.xml
```

→ 既に sitemap 参照 + 全 path 許可で問題なし

---

## 📋 Google Search Console 登録手順 (あべ作業)

### 前提
- Google アカウント: あべの Google アカウント (GA4 と同じが理想)
- 対象ドメイン: `pchamdb.com`
- 検証方法: **ドメインプロパティ** 推奨 (サブドメイン全て一括カバー)

### Step 1. Search Console にアクセスしプロパティ追加

1. https://search.google.com/search-console にアクセス
2. 「**プロパティを追加**」をクリック
3. プロパティタイプ選択:
   - **ドメイン** (推奨): `pchamdb.com` を入力 → DNS TXT レコード認証
   - URL プレフィックス (簡易): `https://pchamdb.com` を入力 → HTML タグ / Analytics 認証

#### 推奨: ドメインプロパティ
- メリット: `www`/サブドメイン/`http`/`https` を全てカバー、将来 i18n サブドメイン化 (`en.pchamdb.com` 等) しても 1 プロパティで OK
- デメリット: Cloudflare DNS で TXT レコード追加が必要

#### 簡易: URL プレフィックス
- メリット: HTML タグを `index.html` の `<head>` 末尾に貼るだけ
- デメリット: 言語別ページ単位の登録 (ja / en 別々の SC プロパティを管理する手間)

→ **ドメインプロパティで進めるのを推奨**。Cloudflare DNS 経由なら数分で完了。

### Step 2-A. ドメインプロパティの場合 (推奨)

1. Search Console から「DNS レコードに以下の TXT を追加」と表示される (例: `google-site-verification=xxxxx...`)
2. **Cloudflare ダッシュボード** にログイン → `pchamdb.com` → **DNS** → **Records**
3. 「Add record」→ Type: `TXT`、Name: `@` (or `pchamdb.com`)、Content: 上記 google-site-verification 文字列、TTL: Auto
4. Cloudflare 側で保存 → Search Console に戻り「確認」クリック
5. 通常 1-5 分で検証完了 (DNS 伝播時間)

### Step 2-B. URL プレフィックスの場合

1. HTML タグ認証を選択 → `<meta name="google-site-verification" content="xxxxx" />` を表示
2. `index.html` の `<head>` 末尾 (他の meta タグ近く) に貼り付け
3. commit + push → デプロイ完了後に Search Console で「確認」クリック

**注意**: ジャストの位置決めはあべに依頼するか、本ドキュメント末尾に手順を残しておく → 必要なら後で実装手伝う。

### Step 3. sitemap.xml 送信 (両方共通)

1. Search Console 左メニュー → 「**サイトマップ**」
2. 「新しいサイトマップの追加」に `https://pchamdb.com/sitemap.xml` (またはドメイン認証なら `sitemap.xml` だけ) を入力
3. 「送信」クリック
4. 1-2 日後に「成功」ステータスになり、含まれている 18 URL が認識される

### Step 4. GA4 リンク連携 (任意・推奨)

1. Search Console → 設定 → 関連付け → Google Analytics プロパティ
2. PchamDB (`G-3Y3S9N1K7H`) を選択 → 連携
3. GA4 で「集客 > Search Console」レポートが見られるようになる

### Step 5. 確認したい主要指標 (初週)

- **カバレッジ**: 送信した 18 URL のうち何件がインデックスされたか
- **検索パフォーマンス**: クエリ別表示回数・クリック数 (CTR)
- **モバイルユーザビリティ**: 問題なしか確認 (PchamDB は CSS 完備のはず)
- **コア ウェブ バイタル**: LCP / CLS / FID (これは数週間後)

---

## 🌐 hreflang 戦略 (現状方針)

### 現在の方式: ハイブリッド

| 種別 | URL 方式 | hreflang |
|---|---|---|
| トップ / 制作秘話 / 法的ページ | **ja / en で別 URL** (`*.html` ⇔ `*_en.html`) | ✅ sitemap で alternate 指定 |
| データツール (pokemon_db_v9 / waza-list / party_checker / battle_simulator / type_chart) | **単一 URL + ランタイム多言語切替** | ❌ hreflang 不要 (同一 URL) |

→ 単一 URL 方式は SEO 的に「言語別検索結果に出にくい」デメリットあるが、保守コストが圧倒的に低い。

### 将来検討 (HANDOFF_I18N_PUBLISH より)

選択肢 A: **lang サブパス** (`pchamdb.com/en/pokemon_db_v9.html`)
- メリット: 言語別 URL で SEO 強い
- デメリット: GitHub Pages 静的サイトで `/en/*` を扱うには rewriting 必要 (`_redirects` or Cloudflare Workers)

選択肢 B: **lang サブドメイン** (`en.pchamdb.com/pokemon_db_v9.html`)
- メリット: ドメインプロパティで SC に統合しやすい
- デメリット: DNS / CNAME 設定追加、メンテ少々

選択肢 C: **クエリパラメータ** (`pokemon_db_v9.html?lang=en`)
- メリット: 既存ファイル流用、変更最小
- デメリット: Google は同一 URL とみなす傾向あり、SEO 効果薄

→ **現状は方式 C 寄り** (URL は共通、JS で言語切替)。短期的にこのまま、AdSense 承認後に必要なら A/B へ移行検討。

---

## 🚦 残作業 / 後続

### あべ作業 (このセッションでは実施不可)

1. **Search Console プロパティ追加** (Step 1-2、5-10 分)
2. **Cloudflare DNS で TXT レコード追加** (Step 2-A、3-5 分)
3. **sitemap.xml 送信** (Step 3、1 分)
4. **GA4 連携** (Step 4、任意、3 分)

### コード側の TODO (随時)

- [ ] 新ページ追加時は sitemap.xml の url block も追加する習慣
  - 例: 将来 `move_calculator.html` などを追加したら、`<url>` ブロック追加 + push
- [ ] lastmod は **大幅変更時のみ更新** で OK (こまめに更新しすぎると逆に SEO 信頼性が落ちる)
- [ ] 多言語ページの hreflang は必要に応じて拡張

---

## 🔗 関連

- 既存 SEO 実装: `HANDOFF_NEW_SESSION_NET_PUBLISH.md` (5/10 の SEO 強化作業)
- 将来戦略: `HANDOFF_I18N_PUBLISH.md` (hreflang / サブパス戦略)
- 既存ファイル: `sitemap.xml`, `robots.txt`, `index.html` の `<head>` JSON-LD
- GA4 連携: GA4 / Search Console 双方をプロパティペアで紐づけ可

---

## 📊 sitemap.xml 構成サマリ (5/18 時点)

| URL | priority | changefreq | hreflang |
|---|---|---|---|
| `/` (ja) | 1.0 | weekly | ja/en |
| `/index_en.html` | 0.9 | weekly | ja/en |
| `/pokemon_db_v9.html` | 0.9 | weekly | — |
| `/waza-list.html` | 0.9 | weekly | — |
| `/party_checker.html` | 0.8 | weekly | — |
| `/battle_simulator.html` | 0.7 | weekly | — |
| `/type_chart.html` | 0.7 | weekly | — |
| `/making.html` (+en) | 0.5 / 0.4 | monthly | ja/en |
| `/terms.html` (+en) | 0.4 / 0.3 | monthly | ja/en |
| `/privacy.html` (+en) | 0.4 / 0.3 | monthly | ja/en |
| `/disclaimer.html` (+en) | 0.4 / 0.3 | monthly | ja/en |
| `/contact.html` (+en) | 0.4 / 0.3 | monthly | ja/en |

→ 計 **18 URL**
