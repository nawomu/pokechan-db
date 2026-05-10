# pchamdb ネット公開作業 引継ぎ資料

**FROM**: コーディ (Claude Code GUI 環境)
**TO**: 先生 (Cowork 環境)
**最終更新**: 2026-05-10 JST
**ステータス**: 準備フェーズ → Cowork 側で公開作業着手依頼

---

## 🎯 ひとことで

> 既存の個人プロジェクト「ポケモンDB」(GitHub Pages) を **`pchamdb.com` という独自ドメインで一般公開し、控えめな広告・アフィリエイトで収益化する**。
> Cowork 側で **インフラ整備・法的ページ作成・SEO 基盤構築** をまとめて担当してほしい。
> コーディ (= Claude Code) 側は **わざ説明文のリライト・多言語データ準備** を並行進行中。

---

## 📍 プロジェクト基本情報

| 項目 | 内容 |
|---|---|
| サイト名（仮） | **pchamdb** (P Cham DB / Pチャン DB) |
| 意味 | Pokémon Champions Database |
| 対象ゲーム | ポケモンチャンピオンズ (2025-2026 発売、対戦特化型新作) |
| 現公開URL | https://nawomu.github.io/pokechan-db/ |
| 公開後ドメイン | `pchamdb.com` (.jp も防衛取得検討) |
| GitHub | https://github.com/nawomu/pokechan-db (main ブランチ自動デプロイ) |
| ローカル作業 dir | `/Users/masamichi/Documents/ポケモンDB/` |
| ホスティング | GitHub Pages (将来的に Cloudflare Pages へ移行可能性) |

### コア機能
- **メインDB** (`pokemon_db_v9.html`): ポケモン170+匹の種族値・タイプ・特性・覚えわざ等
- **わざリスト** (`waza-list-template.html`): 全485技、フィルタ・ソート・優先度・効果分類
- **パーティチェッカー** (`party_checker.html`): タイプ相性・補完分析
- **共有データ** (`pokechan_data.js`): WAZA_MAP, POKEMON_LIST, ABILITY_DESC, TYPE_COLORS

### 独自要素 (差別化)
- C1/C2/C3 マイチェック機能 (LocalStorage)
- 複数列ソート (Shift+クリック)
- ポケ名クリック → 使えるわざ一覧iframe表示
- とくせいホバーで説明tooltip
- わざリスト: 効果フィルタ (パンチ系/音技/状態異常/ランク変化等の切り口)

---

## ⚖️ 法的整理 (既調査済み)

詳細はアベ・先生・コーディ間の議論ログ参照。以下は結論サマリー。

### 任天堂・ポケモン株式会社の公式規約

- **ポケモン公式サイト利用規約** ([pokemon.co.jp/rules/](https://www.pokemon.co.jp/rules/))
  - 「データのコピー、複製、改変、出版、掲示、電送、配布することは固くお断りします」
  - 「個人的に楽しむ場合に限って利用を許諾」
  - **商用利用・広告掲載に関する明文条項は無い**
- **任天堂ネットワークサービスガイドライン** ([nintendo.co.jp/networkservice_guideline](https://www.nintendo.co.jp/networkservice_guideline/ja/index.html))
  - 動画配信・投稿向け。**ファンサイト・データベースは対象外**
- **ポケモン二次創作ガイドライン**: `pokemon.co.jp/policy/guideline/` は **404** (現在利用規約 `/rules/` に統合)

### 業界慣行 (グレーゾーン運用の実態)

| サイト | 運営期間 | 状態 |
|---|---|---|
| ヤッくん (yakkun.com) | 1999〜 | 黙認状態で継続 |
| ポケモン徹底攻略 | 1999〜 | 同上 |
| Game8 | 2017〜 | 法人運営、商用OK |
| altema | 〜 | 法人運営、商用OK |
| GameWith | 〜 | 法人運営、商用OK |

→ 25年以上の業界実績から「事実情報の整理＋自作テキスト＋非公式明記＋公式画像不使用」なら実質許容範囲。

### 採るべきリスク回避策

```
[ ] 全ページフッターに「非公式ファンサイト」明記
[ ] 著作権表示: © 2026 Pokémon. © 1995-2026 Nintendo / Creatures Inc. / GAME FREAK inc.
                ポケットモンスター・ポケモン・Pokémonは任天堂・クリーチャーズ・
                ゲームフリークの商標です。
[ ] 公式画像・ロゴ・ドット絵を使わない (現状クリア)
[ ] わざ説明文の出典確認 → コーディ側でリライト中 (後述)
[ ] サイト名に「公式」「Official」を入れない
[ ] 過度な広告を避ける (画面の30%以下)
[ ] 任天堂から指摘があれば即対応する姿勢
```

---

## 📋 作業項目チェックリスト (Cowork へ依頼)

優先度順。完了したらチェック。

### Phase 1: ドメインとインフラ (1-2日)

- [ ] **ドメイン取得**: `pchamdb.com` (Cloudflare Registrar 推奨、年¥1,300)
  - 防衛取得検討: `pchamdb.jp` (年¥2,400)、`pchamdb.net` (年¥1,500)
  - 取得後、購入完了通知をアベに
- [ ] **Cloudflare アカウント作成** (アベ用、無料プラン)
- [ ] **DNS 設定** (Cloudflare 上)
  - A/CNAME レコードで GitHub Pages へ向ける
  - 公式ドキュメント: [GitHub Pages カスタムドメイン](https://docs.github.com/ja/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [ ] **GitHub Pages 側でカスタムドメイン設定**
  - `nawomu/pokechan-db` リポジトリの Settings → Pages
  - Custom domain: `pchamdb.com`
  - Enforce HTTPS チェック
  - リポジトリに `CNAME` ファイルを追加 (内容: `pchamdb.com`)
- [ ] **HTTPS発行確認** (Let's Encrypt 自動、〜1時間)

### Phase 2: 法的ページ作成 (半日〜1日)

`/Users/masamichi/Documents/ポケモンDB/` 内に以下を新規作成:

- [ ] `terms.html` - **利用規約**
  - サイトのデータ利用条件
  - 免責事項
  - 改定権の保留
  - 推奨ジェネレータ: [プライバシーポリシー作成ツール](https://www.kiyaku.jp/) など
- [ ] `privacy.html` - **プライバシーポリシー**
  - LocalStorage の利用 (個人C1/C2/C3 のみ、サーバー送信なし)
  - Google Analytics の利用
  - Cloudflare Analytics の利用
  - Cookie の使用
  - お問い合わせ窓口
- [ ] `disclaimer.html` - **免責事項・著作権表記**
  - 「本サイトは非公式ファンサイトです」明記
  - 任天堂・ポケモン株式会社・クリーチャーズ・ゲームフリークの商標表記
  - データの正確性は保証しない旨
- [ ] `contact.html` - **お問い合わせ**
  - メール / Twitter / フォーム のいずれか
- [ ] **既存 HTML 全ファイルにフッター追加**:
  ```html
  <footer style="margin-top:24px;padding:12px;border-top:1px solid #ccc;font-size:11px;color:#666;text-align:center">
    <a href="/disclaimer.html">免責・著作権</a> ·
    <a href="/terms.html">利用規約</a> ·
    <a href="/privacy.html">プライバシー</a> ·
    <a href="/contact.html">お問い合わせ</a><br>
    本サイトは非公式ファンサイトです。©2026 Pokémon. ©1995-2026 Nintendo/Creatures Inc./GAME FREAK inc.<br>
    ポケットモンスター・ポケモン・Pokémonは任天堂・クリーチャーズ・ゲームフリークの商標です。
  </footer>
  ```
  対象: `pokemon_db_v9.html`, `party_checker.html`, `index.html` (作成要)

### Phase 3: SEO 基本セット (半日)

- [ ] **`index.html` 作成** (現状未作成、ランディングページ)
  - サイト概要
  - 各ツール (DB / わざリスト / パーティチェッカー) へのリンク
  - 「非公式」明記
- [ ] **各HTMLに `<title>` と `<meta>` を整備**
  - `<title>{ページ名} - pchamdb (非公式)</title>`
  - `<meta name="description" content="...">`
  - `<meta name="robots" content="index, follow">`
- [ ] **OGP 設定** (SNS 共有用)
  ```html
  <meta property="og:title" content="...">
  <meta property="og:description" content="...">
  <meta property="og:image" content="https://pchamdb.com/ogp.png">
  <meta property="og:url" content="https://pchamdb.com/">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  ```
- [ ] **OGP 画像作成** (`ogp.png`, 1200×630)
  - 「pchamdb - 非公式ポケチャンDB」のような画像
- [ ] **`favicon.ico` 作成**
- [ ] **`robots.txt`** 作成
- [ ] **`sitemap.xml`** 生成
  - 全公開ページ列挙
  - 自動生成スクリプト推奨 (`generate_sitemap.py` 等)
- [ ] **Google Search Console 登録**
  - サイトオーナー認証 (DNS TXT レコード or HTMLファイル)
  - `sitemap.xml` 提出
- [ ] **Google Analytics 4 (GA4) セットアップ**
  - 全HTMLに gtag.js 埋め込み
  - 計測ID 取得 (アベに共有)
- [ ] **Cloudflare Analytics 有効化** (自動、無料)

### Phase 4: 追加セキュリティ (任意・推奨)

- [ ] **GitHub アカウントの 2FA 設定** (アベに依頼)
- [ ] **リポジトリの branch protection** (main 直プッシュ禁止、PR必須)
  - ※ あべは個人開発なのでオフでも可。判断はアベに委ねる
- [ ] **`_headers` ファイル作成** (Cloudflare Pages 用、現状GH Pagesでは無効だが将来用)
  ```
  /*
    Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;
    Referrer-Policy: strict-origin-when-cross-origin
    X-Content-Type-Options: nosniff
    Permissions-Policy: geolocation=(), microphone=(), camera=()
  ```

### Phase 5: 収益化準備 (Phase 1-3 完了後)

- [ ] **Amazon アソシエイト 申請** (審査ゆるめ、即承認も多い)
- [ ] **広告配置箇所の決定** (画面下部 or サイドバー、コンテンツ内ど真ん中は避ける)
- [ ] **Google AdSense 申請** (PV月3,000以上推奨、それ未満だと審査落ちやすい)
- [ ] **(オプション) 楽天アフィリエイト**

---

## ⚙️ 判断保留事項 (アベの決裁待ち)

先生→アベ確認の上で進めて欲しい項目:

1. **`.jp` ドメインも防衛取得するか？** (年+¥2,400)
2. **`.net` `.gg` などの追加防衛も必要か？**
3. **OGP画像のデザイン方針** (ロゴ風、シンプルテキスト、イラスト等)
4. **GA4 / Cloudflare Analytics の片方 or 両方？** (ともに無料なので両方推奨)
5. **AdSense は当初から入れるか？それともPV伸びてから？**
6. **読み方の正式表記**: 「ピーチャム」「ピーチャン」「ピーチャムDB」「ピーチャンDB」どれをタグライン・SEO用に統一する？

---

## 🔄 コーディ (cody) 側で並行進行中の作業

### わざ説明文リライトプロジェクト (進行中・約30%完了)

**目的**: 現状の説明文がヤッくん/Game8/GameWith からのスクレイピング由来で、独自テキストに書き換える必要がある。

**作業状況** (`/Users/masamichi/Documents/ポケモンDB/rewrite_workspace/`):

| ファイル | 内容 | 状態 |
|---|---|---|
| `01_current_moves.json` | 現状全485技 | ✅ |
| `02_official_descriptions.json` | PokéAPI 10言語 | ✅ |
| `03_missing_moves.json` | 公式未取得9件 | ✅ |
| `04_patterns.json` | 頻出パターン80 | ✅ |
| `06_game8_descriptions.json` | Game8 全485件 | ✅ |
| `07_gamewith_descriptions.json` | GameWith 684件 | ✅ |
| `08_comparison_v2.html` | 4者比較レポート | ✅ |
| `09_rewrites_sample.json` | AI下書き 30件サンプル | 🔄 進行中 |
| `10_comparison_v3.html` | 編集UI付きレポート | ✅ |

**重要発見**:
- 現状 vs 公式 → 類似度ほぼゼロ (公式コピーリスクなし)
- 現状 vs Game8 → **34%が高類似度 (≥0.5)**
- 現状 vs GameWith → **57%が高類似度 (≥0.5)**

→ Game8/GameWith 系統からのスクレイピングが疑われる。**全485件リライト必要**。

**リライトアプローチ**:
- AIで全件下書き → アベがレポートで確認・修正 → JSONエクスポート → コーディが pokechan_data.js に適用

**多言語化準備も同時進行**:
- PokéAPI から各国語の技名・説明文 (ja, en, zh-Hant, ko, es, fr, de, it) 取得済み
- 公開後、UI言語切替機能を実装予定

→ **このリライトが完了するまで本番デプロイは保留**を推奨。先生は Phase 1-4 のインフラ整備を優先で進めて、リライト完了後に Phase 5 (収益化) と最終公開。

---

## 📚 参考リソース・既存ファイル

### このプロジェクトの主要HTMLファイル
```
/Users/masamichi/Documents/ポケモンDB/
├── pokemon_db_v9.html         (メインDB、~3,900行)
├── waza-list-template.html    (わざリスト、Blob URL/iframe両用)
├── party_checker.html         (パーティチェッカー)
├── pokechan_data.js           (共有データ、~1.65MB)
└── rewrite_workspace/         (コーディ作業中)
```

### 既存の HANDOFF.md
- `/Users/masamichi/Documents/ポケモンDB/HANDOFF.md` (もしあれば参照)
- GitHub: https://github.com/nawomu/pokechan-db/blob/main/HANDOFF.md

### 議論ログ・調査済み内容
- ポケモン公式サイト利用規約: https://www.pokemon.co.jp/rules/
- 任天堂ガイドライン: https://www.nintendo.co.jp/networkservice_guideline/ja/index.html
- Cloudflare 推奨理由: 卸値ドメイン + CDN無料 + DDoS無料 + WAF無料

---

## 💬 連絡・調整方法

### 質問・確認が必要な時
- 即時ならアベに直接 (Slack / メール)
- 非緊急なら `shared/incoming/` 経由でメッセージファイル投函（既存運用ルール準拠）

### 完了報告
- Phase 完了ごとに この HANDOFF_PUBLISHING.md にチェック入れて GitHub にコミット
- アベ・コーディに進捗通知

### コーディとの並行作業の調整
- リライト作業の進捗はコーディが別途報告
- インフラ作業に支障があれば即フィードバック

---

## 🚦 推奨スケジュール

```
Day 1   : Phase 1 (ドメイン取得 + DNS + GitHub Pages 連携)
Day 2-3 : Phase 2 (法的ページ作成)
Day 3-4 : Phase 3 (SEO 基盤)
Day 5   : Phase 4 (セキュリティ)
[ここでコーディのリライト完了を待つ]
Day 7+  : Phase 5 (収益化開始)
```

---

## ✅ 完了基準

このプロジェクトの「公開準備完了」とは:

1. ✅ `https://pchamdb.com` でアクセス可能
2. ✅ HTTPS 有効、Cloudflare 配信
3. ✅ 全ページに法的フッター
4. ✅ 利用規約・プラポリ・免責・お問い合わせページ完備
5. ✅ Google Search Console で確認済、sitemap提出済
6. ✅ GA4 / Cloudflare Analytics 計測中
7. ✅ OGP / favicon / index.html 完備
8. ✅ コーディの説明文リライト完了
9. ✅ Amazon アソシエイト承認、控えめに広告配置

---

**質問があればコーディまたはアベまで。**
**よろしくお願いします！**

— コーディ (Claude Code GUI), 2026-05-10 JST
