# Search Console URL修復（2026-09-17）

## 原因と対応

ユーザーから Search Console の「ページにリダイレクトがあります」「404の修正検証に失敗」メールの修正依頼。Analytics の計測エラーではない。9/7開始・9/15失敗の404検証を確認。

- 404一覧31件を実際に読取り、本番HTTPを確認。旧ポケモンURL14件と制作紹介の旧URL3件が404、12件は既に200（うち4件は転送）、2件は旧バグによる特性名連結URLで正当な404。
- `3b477021e` で削除した旧URLは9言語×1,031件=9,279件。9/7の修正は検出済み5件だけだったため、別の旧URLがクロールされるたび404が増えた。
- `reference/_legacy_url_redirects.json` に履歴から確定した対応表を置き、`tools/_gen_legacy_redirects.js` で全9,279件と8言語の旧making URLを生成。ポケモン本文を複製せず、同じ言語の現行ページへ即時転送する。makingは英語のみ既存英語版、それ以外は既存日本語版。
- GitHub Pages用の即時meta refreshとcanonicalを使用。HTTP301ではない。Googleは0秒meta refreshを恒久移転のシグナルとして扱う。転送用URLはサイトマップに含めない。
- sitemapは14,542件中36件が転送URL、正規URL70件が欠落。実際のHTMLのcanonical/hreflang/noindex/refreshを読んで14,576件に修正。
- 二つのsitemap生成器が競合していた。`build_i18n_pages.js` の固定リスト生成を削除し、共通の `_gen_content_sitemap.js` を呼ぶよう統一。既存lastmodは保持し、再生成日で全件更新しない。

## 検証

- `node tools/_seo_structure_test.js`: 14,576正規URL・9,287転送全件成功。除外/追加/重複/冪等性/lastmod保持/壊れた入力時に書かないことも検証。
- 移行コミットで削除した9,279パスと復元した転送パスの集合が完全一致。
- 修正後の23,934 HTMLを静的走査: 壊れた内部リンク先0、canonical欠落/不整合0、hreflang参照先欠落0、sitemapの不適切URL0、正規ページの掲載漏れ0。JS生成リンク・全ページの画面品質まで保証するものではない。
- `_page_guard_test.js` / `_ssot_guard_test.js`: 既存問題から悪化なし。
- `node --check tools/build_i18n_pages.js`: 成功。全i18n本文再生成は実施していない。
- Chrome実機: `it/pokemon/p687-2.html` → `it/pokemon/malamar-mega.html`、`pokemon/p254.html` → `pokemon/sceptile.html`、`en/making.html` → `making_en.html` の遷移と内容表示を確認。
- 証跡は `review/_seo_recovery_2026-09-17/`。大きな全件監査JSONはローカル保管。

## 残件・優先順位

1. 修正の公開反映を本番HTTPで確認（最新実施状況は同フォルダーのREADME）。Googleの再クロール・正規URLへの評価統合は即時ではない。転送元が「リダイレクト」として除外されるのは正常。
2. 存在しない `ability/しぜんかいふくどくのトゲ.html` と `ability/もらいびこんじょう.html` は404を維持。全404をゼロにする目的で無関係なページへ転送しない。「修正を検証」を押すだけでは解消しない。
3. 「検出・インデックス未登録」10,597件、「クロール済み・未登録」109件、「Googleが別の正規を選択」12件は、代表URLの検査と検索流入・翻訳内容・ページの独自性を別途確認。今回のメールだけで全件がコードの不具合とは断定できない。インデックス登録は保証できない。
4. 全面リニューアルは現段階では不要。URL引継ぎと生成器を先に修復し、次は主要ページの登録状況・各言語の内容品質を優先。バトルE7/E8の残件は `HANDOFF_SESSION_2026_09_12_CLAUDE_STOP.md` のまま別作業。

## 再実行

```sh
node tools/_gen_legacy_redirects.js
node tools/_gen_content_sitemap.js
node tools/_seo_structure_test.js
```

既存の本文生成器は手で編集しない。URL追加・変更時は転送とsitemapの両方を検査する。作業前から存在するE7等の変更は今回の公開差分へ混ぜない。

## 根拠

- https://developers.google.com/search/docs/crawling-indexing/301-redirects
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://support.google.com/webmasters/answer/7440203?hl=en
