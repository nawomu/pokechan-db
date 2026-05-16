# HANDOFF: i18n 公開 (SEO / hreflang / sitemap / meta) 引き継ぎ

**作成日**: 2026-05-16 (orchestrator セッションからの引き継ぎ)
**渡し先**: ポケモンDBレポジトリ (`~/Documents/ポケモンDB/`) で動いている別セッション
**前提**: [HANDOFF_I18N.md](./HANDOFF_I18N.md) と [HANDOFF_I18N_IMPLEMENTATION.md](./HANDOFF_I18N_IMPLEMENTATION.md) を読了

このファイルは**公開戦略の決定とそれに伴う SEO/meta タグ作業**専用の引き継ぎです。
公開戦略はあべさんの判断が必要ですが、判断材料と実装素材は本セッションでプリビルド済みです。

---

## 🗺️ 現状棚卸し (2026-05-16 時点)

`i18n/audit_seo_meta.py` の結果:

| ページ | lang | runtime.js | mount | data-i18n | hreflang 件数 |
|---|---|---|---|---|---|
| index.html | ja | ✅ | ✅ | 17 | 3 |
| index_en.html | en | ❌ | ❌ | 0 | 3 |
| party_checker.html | ja | ✅ | ✅ | 26 | 2 |
| pokemon_db_v9.html | ja | ✅ | ✅ | 0 | 2 |
| waza-list.html | ja | ✅ | ✅ | 0 | 2 |
| battle_simulator.html | ja | ❌ | ❌ | 0 | 0 |
| making.html / making_en.html | ja/en | ❌ | ❌ | 0 | 3 |
| contact.html / contact_en.html | ja/en | ❌ | ❌ | 0 | 3 |
| terms.html | ja | ❌ | ❌ | 0 | 3 (terms_en.html を参照しているが**ファイルは未作成**) |
| privacy.html | ja | ❌ | ❌ | 0 | 3 (privacy_en.html 同上) |
| disclaimer.html / disclaimer_en.html | ja/en | ❌ | ❌ | 0 | 3 |

**主な問題点**:

1. **方式が混在**: 動的切替 (runtime.js + data-i18n) と 静的別ページ (_en.html) が同居
2. **hreflang 不整合**: terms.html / privacy.html は `terms_en.html` `privacy_en.html` を参照するが**ファイルが存在しない** (404 リンク)
3. **言語サポートが ja/en のみ**: 他 7 言語向けの hreflang・サイトマップなし
4. **battle_simulator は完全に i18n 対象外**
5. **canonical / og:url が hard-coded**: 動的切替に追従していない

---

## 🎯 URL 戦略 3 案 — 判断材料

3 案すべて分の hreflang ブロックと sitemap.xml をプリビルドしてあります (`i18n/hreflang_blocks_strategy_*.html` と `i18n/sitemap_strategy_*.xml`)。

### 案 A: サブディレクトリ方式 ⭐ **推奨**

URL 例:
- `https://pchamdb.com/` (ja, デフォルト)
- `https://pchamdb.com/en/` `https://pchamdb.com/en/party_checker.html`
- `https://pchamdb.com/es/` `https://pchamdb.com/zh-Hant/` ...

**メリット**:
- SEO 最強 (Google が言語別に index する)
- URL がきれいでシェアしやすい
- 公式の `hreflang` ベストプラクティスに一致
- 既存の ja 用 URL は変更不要 (`pchamdb.com/` のまま)

**デメリット**:
- 静的ホスティング (Cloudflare Pages 等) で各言語ディレクトリを用意する必要
- runtime.js を「URL に応じて初期言語を決める」ロジックに変更要 (現状は localStorage ベース)
- 同じ HTML を 9 言語分配置 (実体は同じ、シンボリックリンク or サーバー側 rewrite で省力化可能)

**実装メモ**:
- Cloudflare Pages の場合 `_redirects` で `/en/* /index.html 200` (rewrite) すれば物理ファイル不要
- または `vercel.json` の rewrites で同様
- runtime.js: `<html lang>` 属性 or `pathname.match(/^\/(\w+(?:-\w+)?)\//)` で言語抽出

### 案 B: クエリパラメータ方式

URL 例:
- `https://pchamdb.com/` (ja)
- `https://pchamdb.com/?lang=en`
- `https://pchamdb.com/party_checker.html?lang=zh-Hant`

**メリット**:
- 既存の HTML ファイル構造に手を入れずに済む
- 実装が最も簡単 (runtime.js は URL クエリも見るだけ)
- Cloudflare の設定不要

**デメリット**:
- SEO が弱い (Google は `?lang=en` を別ページとして扱うが評価は分散)
- URL がきれいではない
- Google は `?lang=` クエリのインデックス制御を `Parameter Handling` で個別設定要

### 案 C: 拡張子サフィックス方式 (現状の延長)

URL 例:
- `https://pchamdb.com/index.html` (ja)
- `https://pchamdb.com/index_en.html`
- `https://pchamdb.com/index_zh_hans.html`

**メリット**:
- 既に index_en.html などが存在 → 既存資産を活用
- SEO 評価は案 A に近い

**デメリット**:
- **9 言語 × 14 ページ = 126 ファイル**を物理的に管理 → 運用負担大
- ja を更新したとき他 8 言語にも反映する仕組みが要る
- runtime.js は不要になる (静的別ページ方式)

---

## 📋 推奨: 案 A (サブディレクトリ方式) + Cloudflare rewrites

理由:
- SEO 強い
- URL が直感的
- 物理ファイルは 1 セット (`index.html` など) のみで OK (Cloudflare で `/en/index.html` を `/index.html` に内部 rewrite)
- runtime.js が `pathname` から言語を決める軽微な変更だけで対応可能

実装手順:
1. `runtime.js` の言語決定ロジックに pathname 解析を追加 (localStorage より優先)
2. Cloudflare Pages の `_redirects` に rewrite ルール追加
3. 各 HTML の `<head>` に hreflang ブロック挿入 (`i18n/hreflang_blocks_strategy_A.html` から)
4. canonical を `pathname` ベースの動的計算に変更
5. `i18n/sitemap_strategy_A.xml` をルートに配置
6. 既存の `index_en.html` `making_en.html` `contact_en.html` `disclaimer_en.html` は**削除 or 301 リダイレクト** (案 A 移行後は不要)

---

## 📦 プリビルド済み素材

### 1. ページメタ (title / description / og:*) - 9 言語 × 10 ページ

**ファイル**: `i18n/page_meta.json`

各ページの 9 言語分:
- `title`
- `description`
- `og_title`
- `og_description`
- `og_locale` (例: `ja_JP`, `en_US`, `zh_CN`, `zh_TW`)

サンプル (`index.html`):
```json
{
  "ja": { "title": "PchamDB - ポケモンチャンピオンズ 非公式ファンデータベース", ... },
  "en": { "title": "PchamDB - Unofficial Pokémon Champions Fan Database", ... },
  "es": { "title": "PchamDB - Base de datos no oficial de fans de Pokémon Champions", ... },
  ...
}
```

**使い方** (runtime.js 拡張):

```javascript
// runtime.js の loadLang() 内で page_meta も読み込む
const pageMeta = await fetchJson(BASE + 'page_meta.json');
const cur = pageMeta[location.pathname.split('/').pop() || 'index.html'];
if (cur && cur[currentLang]) {
  document.title = cur[currentLang].title;
  const setMeta = (name, content) => {
    const el = document.querySelector(`meta[name="${name}"]`) ||
               document.querySelector(`meta[property="${name}"]`);
    if (el) el.setAttribute('content', content);
  };
  setMeta('description', cur[currentLang].description);
  setMeta('og:title', cur[currentLang].og_title);
  setMeta('og:description', cur[currentLang].og_description);
  setMeta('og:locale', cur[currentLang].og_locale);
}
```

### 2. hreflang ブロック (3 戦略分)

**ファイル**:
- `i18n/hreflang_blocks_strategy_A.html` (案 A: サブディレクトリ)
- `i18n/hreflang_blocks_strategy_B.html` (案 B: クエリ)
- `i18n/hreflang_blocks_strategy_C.html` (案 C: サフィックス)

各ファイルに 10 ページ × 10 行 (9 言語 + x-default) の `<link rel="alternate">` ブロックがある。
採用する戦略を決めたら、対応する HTML を各ページの `<head>` にコピペ。

### 3. sitemap.xml (3 戦略分)

**ファイル**:
- `i18n/sitemap_strategy_A.xml` (90 URLs, 93 KB)
- `i18n/sitemap_strategy_B.xml` (90 URLs, 98 KB)
- `i18n/sitemap_strategy_C.xml` (90 URLs, 95 KB)

各 URL に `<xhtml:link rel="alternate">` を 10 件 (9 言語 + x-default) 埋め込み済 (Google 公式推奨形式)。

採用戦略の sitemap を**ルートに配置**して `robots.txt` から参照:

```
Sitemap: https://pchamdb.com/sitemap.xml
```

### 4. UI 翻訳辞書 (9 言語完全)

`i18n/ui-{ja,en,de,es,fr,it,ko,zh-Hans,zh-Hant}.json` — 各 113 キー、整合性確認済。

### 5. メインコンテンツ翻訳辞書 (9 言語)

`i18n/{ja,en,de,es,fr,it,ko,zh-Hans,zh-Hant}.json` — types/abilities/pokemon/moves/genera/natures/status

---

## 🔧 実装作業チェックリスト (案 A 採用想定)

### Phase 1: ベース設定 (推定 1〜2 時間)

- [ ] **戦略決定**: あべさんと相談して案 A/B/C 決定
- [ ] **Cloudflare Pages 設定**: `_redirects` に `/en/* /index.html 200`, `/es/* /index.html 200`, ... の rewrite 追加 (案 A の場合)
- [ ] **runtime.js 拡張**: pathname から言語抽出するロジック追加 (案 A) または querystring (案 B)
- [ ] **page_meta.json をルート (or `i18n/`) に配置**

### Phase 2: 各 HTML への hreflang + meta 動的化 (推定 2〜3 時間)

各ページ (`index.html`, `party_checker.html`, ...) に以下を追加:

- [ ] `<head>` 内に `i18n/hreflang_blocks_strategy_A.html` から該当ブロックを貼付
- [ ] runtime.js の起動時に `page_meta.json` から `title` / `description` / `og:*` を上書きする処理を有効化
- [ ] `<link rel="canonical">` を pathname から動的計算 (case-by-case)

### Phase 3: 既存資産の整理 (推定 30 分)

- [ ] `index_en.html`, `making_en.html`, `contact_en.html`, `disclaimer_en.html` を**削除 or 301 リダイレクト** (案 A 採用なら不要、Cloudflare で /index_en.html → /en/ にリダイレクト)
- [ ] `terms_en.html`, `privacy_en.html` 参照を hreflang から除去 (実在しないファイル) — または案 A 採用で /en/terms.html に置換

### Phase 4: サイトマップと robots (推定 15 分)

- [ ] `i18n/sitemap_strategy_A.xml` をルートにコピー → `sitemap.xml` にリネーム
- [ ] `robots.txt` に `Sitemap:` 行追加
- [ ] Google Search Console で **新サイトマップを再送信**
- [ ] Search Console の「インターナショナル ターゲティング」で hreflang エラーを確認

### Phase 5: battle_simulator 対応 (推定 1〜2 時間)

- [ ] `<head>` に runtime.js 追加
- [ ] 言語切替マウントポイント追加
- [ ] 主要 UI 文言に data-i18n 追加 (詳細は `HANDOFF_I18N_IMPLEMENTATION.md` の項目 5)

---

## ⚠️ 既知の問題 / 注意点

### 1. 存在しない _en.html リンク

`terms.html`, `privacy.html` の hreflang が `terms_en.html` `privacy_en.html` を指しているがファイルが無い。
**現状でも 404 リンクが Google 由来で叩かれる可能性**があるので、案 A 移行で正しい URL に置換すべき。

### 2. og:image は全言語共通

現状 `https://pchamdb.com/branding/logo/logo_main_transparent.png` で固定。
言語別ロゴが必要なら別ファイル用意 (低優先)。

### 3. 動的言語切替時の URL 同期

案 A/B では言語切替時に URL も更新すべき (`history.pushState`):

```javascript
// runtime.js setLang() 内に追加:
if (URL_STRATEGY === 'A') {
  const path = location.pathname.replace(/^\/[a-z]{2}(?:-[A-Za-z]+)?\//, '/');
  const newPath = (lang === 'ja') ? path : `/${lang}${path}`;
  history.replaceState(null, '', newPath + location.search);
} else if (URL_STRATEGY === 'B') {
  const u = new URL(location.href);
  if (lang === 'ja') u.searchParams.delete('lang');
  else u.searchParams.set('lang', lang);
  history.replaceState(null, '', u.toString());
}
```

これがないと、ユーザがコピペして共有した URL の言語が再現できない。

### 4. JSON-LD の `inLanguage` プロパティ

`index.html` の `<script type="application/ld+json">` 内に `"inLanguage": "ja"` がある。
案 A 採用なら各言語版で書き換え要 (runtime.js or 静的別レンダリング)。

### 5. zh-Hans / zh-Hant の表記

Google は `zh-Hans` `zh-Hant` を推奨。`zh-CN` `zh-TW` も有効だが地域指定になる。
本プロジェクトは Hans/Hant 系で統一済。

---

## 📂 関連ファイル一覧

| ファイル | 用途 |
|---|---|
| `i18n/audit_seo_meta.py` | 全 HTML の SEO/meta 状態を集計 |
| `i18n/seo_audit.json` | 上記の生 JSON 出力 |
| `i18n/build_page_meta.py` | 9 言語 × 10 ページの title/description 生成スクリプト |
| `i18n/page_meta.json` | 上記の成果物 (runtime.js に組込) |
| `i18n/build_hreflang_and_sitemap.py` | 3 戦略分の hreflang + sitemap 生成 |
| `i18n/hreflang_blocks_strategy_{A,B,C}.html` | 各戦略の hreflang ブロック集 (10 ページ分) |
| `i18n/sitemap_strategy_{A,B,C}.xml` | 各戦略の sitemap (90 URLs ずつ) |

---

## 💡 一目で「推奨フロー」

```
1. あべさんと戦略 A/B/C 相談 (1案 = 推奨)
        ↓
2. (案 A の場合) Cloudflare Pages _redirects 設定
        ↓
3. runtime.js を pathname/querystring 対応に拡張 + page_meta.json 読込追加
        ↓
4. 各 HTML <head> に hreflang ブロック貼付
        ↓
5. sitemap.xml をルートに配置 + robots.txt 更新
        ↓
6. Google Search Console で sitemap 再送信
        ↓
7. battle_simulator.html を i18n 化 (Phase 5)
```

各ステップに必要な素材は `i18n/` 配下にプリビルド済。コピペでほぼ動くはず。

---

最終更新: 2026-05-16 (orchestrator セッションで素材プリビルド完了)
