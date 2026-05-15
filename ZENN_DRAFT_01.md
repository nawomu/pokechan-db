# Zenn 技術記事ドラフト #1

**想定タイトル候補:**
- 「Claude Code で SEO 対応の個人開発サイトを 1ヶ月で作った話」
- 「Claude Code と素のHTML/JSで対戦DBサイトを公開するまで」
- 「JSON-LD / OGP / 楽天アフィリエイトを Claude Code に任せて出来上がったサイト」

**想定タイプ:** `tech` (技術記事)
**想定 Topics:** `claude`, `claudecode`, `html`, `javascript`, `seo`
**想定文字数:** 3000〜5000文字
**Emoji 案:** 🐉 or 🔧

---

# 本文ドラフト

## はじめに

ポケモンチャンピオンズの非公式DB **[PchamDB](https://pchamdb.com)** を Claude Code と1ヶ月で作りました。

本記事では、特に **「フレームワーク不使用 + Claude Code でどこまでやれるか」** という観点で、技術的にハマった点とその解決策を共有します。

対象読者は、

- Claude Code でプロダクト開発に挑戦してみたい方
- 個人開発で SEO まで意識したい方
- 素のHTML/JSで動的なテーブルアプリを作ってみたい方

---

## 技術スタック

驚くほどシンプルです。

| 領域 | 採用技術 |
|------|---------|
| フロントエンド | HTML5 + CSS + Vanilla JS (フレームワーク無し) |
| ホスティング | GitHub Pages + Cloudflare (独自ドメイン) |
| 開発支援 | Claude Code (CLI版) |
| データ取得 | PokeAPI (多言語化用) |
| 解析 | Google Analytics + Search Console |
| 収益 | 楽天アフィリエイト + Amazon Associates |

**ビルドツールなし、npm install なし、package.json なし。** ファイルを開いて編集して保存するだけ。GitHub に push したら反映される。これが意外と快適でした。

---

## Claude Code との分担

Claude Code は CLI ベースのAIコーディングアシスタントです。Anthropic 製。

私の進め方は以下のような感じでした:

```
私 → 「タイプ相性のテーブル、横スクロールできるようにして」
Claude → ファイル読んで、CSS追加して、動作確認用のコマンドまで提案
私 → ブラウザで確認 → 「ここちょっと崩れてる」 → Claude が修正
```

**Claude Code の便利な点:**
- ファイル読み書き、コマンド実行、Git操作まで一気通貫
- セッションをまたいでも HANDOFF.md でコンテキスト引き継ぎ可能
- TaskCreate でマルチステップタスクを管理

**人間の役割:**
- 設計判断（どのデータ構造にするか、何を実装するか）
- データ検証（ポケモンの種族値などは公式情報源と人間が突合せ）
- UX判断（このボタンは目立たせるか、隠すか等）

---

## ハマったポイント 3つ

### 1. 巨大テーブルの横スクロールバーが見えない

ポケモンDBは横に約60列ある巨大テーブルです。`overflow-x: scroll` を `.wrap` に設定して横スクロールできるようにしましたが、**ページを一番下までスクロールしないと横スクロールバーが見えない** という問題が発生しました。

**解決策: ミラースクロールバー**

画面下部に固定表示するゴーストスクロールバーを実装。テーブルのスクロールと連動させます。

```html
<div id="h-mirror-scroll" style="position:fixed;bottom:180px;...overflow-x:scroll;">
  <div id="h-mirror-inner" style="height:1px;"></div>
</div>
<script>
const wrap = document.querySelector('.wrap');
const mirror = document.getElementById('h-mirror-scroll');
const inner = document.getElementById('h-mirror-inner');
inner.style.width = wrap.scrollWidth + 'px';
new ResizeObserver(() => inner.style.width = wrap.scrollWidth + 'px').observe(wrap);
wrap.addEventListener('scroll', () => mirror.scrollLeft = wrap.scrollLeft);
mirror.addEventListener('scroll', () => wrap.scrollLeft = mirror.scrollLeft);
</script>
```

さらに、オリジナルの横スクロールバーが2本見えないように:

```css
.wrap::-webkit-scrollbar:horizontal { height: 0; display: none; }
```

これで画面下に固定の横スクロールバーだけが見える、Excel ライクなUXに。

---

### 2. JSON-LD を hook が JS としてエラー判定する

PostToolUse hook で HTML 内の `<script>` を構文チェックするスクリプトを設定していました。これが SEO のために追加した **JSON-LD ブロックを JavaScript として解析してエラー** にしてしまう問題が発生。

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  ...
}
</script>
```

JSON は `{` から始まるとブロック扱いされ、`:` で `Unexpected token ':'` になります。

**解決策: hook を `type` 属性で除外**

```bash
node -e "
const blocks = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const jsBlocks = blocks.filter(m => {
  const attrs = m[1] || '';
  if (/type\s*=\s*[\"']application\/(ld\+)?json[\"']/i.test(attrs)) return false;
  if (/type\s*=\s*[\"']text\/template[\"']/i.test(attrs)) return false;
  return m[2].trim().length > 0;
});
for (const b of jsBlocks) new Function(b[2]);
"
```

`application/ld+json`、`application/json`、`text/template` などのデータ用 script を除外し、本物のJavaScriptのみを `new Function()` で検証する形に変更しました。

---

### 3. ローカルファイル（`file://`）で `fetch()` が動かない

開発中、ローカルファイルを Chrome で開いて確認することが多かったのですが、CORS 制限で `fetch()` が失敗します。本番（HTTPS）では問題ないコードが、ローカルでは動かない。

具体的には、ポケモン名をクリックして「習得わざ一覧モーダル」を開く機能で、`waza-list-template.html` を fetch して Blob URL を作る処理が失敗しました。

**解決策: フォールバック実装**

```javascript
function openMovesForPokemon(pokemonName) {
  buildWazaListBlobUrl(pokemonName)
    .then(url => {
      // 本番: Blob URL でモーダルに表示
      modalIframe.src = url;
      showModal();
    })
    .catch(() => {
      // ローカル: 静的ファイル + URLパラメーターで代替
      modalIframe.src = 'waza-list.html?pokemon=' + encodeURIComponent(pokemonName);
      showModal();
    });
}
```

そして受け取り側 `waza-list.html`:

```javascript
const INITIAL_POKEMON_FILTER = new URLSearchParams(location.search).get('pokemon') || null;
```

これでローカル開発でも本番と同等の UX を維持できました。

---

## SEO 周りでやったこと

意外と Claude Code はSEO業務との相性が良いです。**「OGPとTwitter Card と canonical を全ページに追加して」** で一発で終わります。

- `<meta name="description">` 各ページ独自
- OGP (`og:title`, `og:description`, `og:image`, `og:url`, `og:site_name`, `og:locale`)
- Twitter Card (`twitter:card="summary_large_image"`)
- `<link rel="canonical">`
- JSON-LD 構造化データ (`WebSite`, `Organization`, `WebApplication`)
- `sitemap.xml` + `robots.txt`

ここで効いたのは **「hook で JSON-LD をスキップする」修正** でした（上記）。

---

## 数字で振り返る1ヶ月

- 総ファイル数: HTML 9個、JSON翻訳ファイル 9言語分、画像数十枚
- データ規模: ポケモン1000種以上、わざ900種以上
- コミット数: 数十回（小さく頻繁に）
- 私の役割: 設計・データ検証・最終確認
- Claude Code の役割: 実装・整形・ドキュメント生成

「全部AIでやった」と言うとちょっと違う。「**設計と判断は人間、実装は AI**」と言うと正確だと思います。

---

## 個人開発で Claude Code を使う上で大事なこと

1. **データの正は人間が決める** ── AIに正解を聞かない、参考までに留める
2. **小さく頻繁にコミット** ── 戻れるポイントを増やす
3. **HANDOFF.md でコンテキスト管理** ── セッションをまたぐ大きな作業はメモを残す
4. **タスク管理** ── TaskCreate で進捗可視化、迷子防止

---

## おわりに

PchamDB は公開中で、これから多言語化（9言語対応）と機能拡張を進めていきます。

- 🔗 サイト: https://pchamdb.com
- 🔗 制作の裏側: https://pchamdb.com/making.html

ご意見・指摘などあればぜひ。次回は **「Claude Code で多言語化と PokeAPI 連携をした話」** を書く予定です。

---

## チェック項目（投稿前）

- [ ] タイトル決定
- [ ] Topics（最大5個）設定
- [ ] サムネ画像（Zennは自動生成も可）
- [ ] コードブロックの言語指定確認
- [ ] PchamDBサイト動作確認後に投稿
- [ ] 公開後にXで告知（`#Zenn` `#ClaudeCode` タグ）
