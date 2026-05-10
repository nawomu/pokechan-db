# pchamdb ネット公開作業 - 新Codyセッション引き継ぎ

**作成**: 2026-05-10 JST (旧Codyセッション末尾)
**目的**: 新Codyセッションでネット公開作業を継続

---

## 🎯 ひとことで

> ポケモンDB ( `pokechan-db` ) を独自ドメイン **`pchamdb.com`** で一般公開、控えめな広告・アフィリエイトで収益化する。
> 旧セッションで方針はほぼ固まったが、実際のドメイン購入・DNS設定等の**作業はこれから**。
> 並行して進めていたわざ説明文リライトは**完了済み** (本セッションで処理)。

---

## 📋 これまでに決まったこと (固定済み)

### ブランド・ドメイン

| 項目 | 決定内容 | 理由 |
|---|---|---|
| サイト名 | **pchamdb** (P Cham DB / Pチャン DB) | "poke" を避け任天堂商標リスク回避 |
| 主ドメイン | **`pchamdb.com`** | 取得未確認、要確認 |
| 防衛取得 | `.jp` 検討中 (アベ判断要) | フィッシング対策 |
| 読み方 | **「ピーちゃん DB」で確定** ✅ | マスコットイラスト「ぴ〜ちゃん」誕生で確定 |
| 意味 | P okémon Cham pions Database | 略称 |
| マスコット | **ぴ〜ちゃん** (黄色キャップに大きな赤P、黄黒ジャケット) | 透明背景PNG画像あり、ユーザ手元保管 |
| カラーパレット | **黄色 + 黒 + 赤(ロゴ)** | マスコットから決定 |

### 技術スタック

| 項目 | 決定内容 |
|---|---|
| ホスティング | **GitHub Pages** (現状維持、将来 Cloudflare Pages 移行可) |
| ドメイン管理 | **Cloudflare Registrar** (卸値で最安、年¥1,300前後) |
| CDN/セキュリティ | **Cloudflare 無料プラン** (DDoS対策・WAF・SSL自動) |
| 解析 | Google Analytics 4 + Cloudflare Analytics 両方 |
| バックエンド | **不要** (静的サイト、データはJSに埋込) |

### 法的方針

- ✅ 全ページフッターに**「非公式ファンサイト」**明記
- ✅ 著作権表示 (©2026 Pokémon. ©1995-2026 Nintendo/Creatures Inc./GAME FREAK inc.)
- ✅ 公式画像・ロゴは使わない (現状クリア)
- ✅ わざ説明文は独自リライト済み (このセッションで完了、後述)
- ✅ 利用規約・プラポリ・免責・お問い合わせページ作成必須

---

## ✅ 完了済み (旧セッション)

### わざ説明文リライト (大幅進化、最終状態)

**全485技、ヤッくん由来テキストを独自リライト + 複数回ユーザフィードバック反映**:

| 指標 | リライト前 | 最終 |
|---|---|---|
| vs ヤッくん 類似度 ≥0.7 | ~485件 | **0件** ✅ |
| vs ヤッくん 類似度 ≥0.5 | ~430件 | **114件** (中類似度) |
| 完全独自 (<0.5) | ~50件 | **371件** ✅ |
| 総文字数 | 25,654字 | **14,196字** (-45%) |

**適用ルール (v6最終版)**:
- ポケチャン特化 (対戦のみ・Lv50固定・ダイマ無し・野生概念なし)
- Game8 ハイブリッド表現
- 体言止め多用 ("攻撃する。"→"攻撃。")
- 「必ず命中」→「必中」
- 「N%の確率で」→「確率N%で」
- 「ずつ」削除 (1段階ずつ → 1段階)
- 「代わりに、」→「が、」
- 「特性Xの時、威力Y」→「特性X威力Y」
- 単一ステータス時「ランク」省略 (こうげきランクが+1 → こうげきが+1)
- 優先度・後攻技を文頭に移動 + 末尾の重複削除
- 技名リストの順序変更 (ヤッくんと違う順)
- 長すぎる技名リストを「カテゴリ + 代表数個 + など」に圧縮
- DB外技 (マグニチュード/テレキネシス/ふみつけ等) の言及削除
- ちいさくなる効果技は「ちいさくなる中の敵には必中・威力2倍」を文頭

**ユーザ編集 (3回分、計23件)**:
1. hataku, fukitobashi, shimetsukeru, sutemitakkuru, kauntaa
2. sorawotobu, noshikakari, abareru, misairubari, hoeru, naminori, fubuki, hakaikousen, ketaguri, chikyuunage
3. misairubari, tsunodoriru, kanashibari, ketaguri, kauntaa, yadorigi
+ Cody生成 ハイブリッドリライト約170件
+ 機械処理 263件

**作業ファイル**:
```
~/Documents/ポケモンDB/rewrite_workspace/
├── 11_rewrites_full_draft.json   ← 最終リライト結果 (485件)
├── 09_rewrites_sample.json       ← レポート読込用 (= 11と同内容)
├── rewrite_engine.py             ← リライトエンジン本体
├── build_report_v3.py            ← レポート生成
├── 10_comparison_v3.html         ← 比較・編集レポート
└── 02_official_descriptions.json ← PokéAPI 多言語データ (10言語)
```

### 引継ぎ済み資料

- `~/Documents/ポケモンDB/HANDOFF_PUBLISHING.md` ← **元々先生向けに作成、GitHub にpush済み** ([リンク](https://github.com/nawomu/pokechan-db/blob/main/HANDOFF_PUBLISHING.md))
- shared/outgoing/cody_publish_handoff_20260510_1148.md ← 先生に通知 (但し先生は別件に流れた)

---

## 🚧 これから新セッションでやること

### Phase 1: ドメイン取得 + 基本設定 (1-2日)

```
[ ] 1-1. Cloudflare アカウント作成 (アベが既に持っていれば省略)
[ ] 1-2. pchamdb.com の空き確認 (Cloudflare Registrar)
[ ] 1-3. アベに購入確認 → 購入 (年~¥1,300)
[ ] 1-4. .jp 取得するか最終確認 → 必要なら購入 (年~¥2,400)
[ ] 1-5. GitHub Pages カスタムドメイン設定
        - リポジトリ Settings → Pages → Custom domain
        - リポジトリに CNAME ファイル追加
[ ] 1-6. DNS 設定 (Cloudflare 上)
        - CNAME or A レコードで GitHub Pages へ
[ ] 1-7. HTTPS 自動発行確認 (~1時間)
[ ] 1-8. https://pchamdb.com/ でアクセス確認
```

### Phase 2: 法的ページ作成 (半日〜1日)

```
[ ] 2-1. terms.html (利用規約) 作成
[ ] 2-2. privacy.html (プライバシーポリシー) 作成
        - LocalStorage の利用 (個人C1/C2/C3 のみ)
        - GA4 / Cloudflare Analytics の利用
[ ] 2-3. disclaimer.html (免責・著作権) 作成
        - 「非公式ファンサイト」明記
        - 任天堂・ポケモン関連商標表記
[ ] 2-4. contact.html (お問い合わせ) 作成
[ ] 2-5. 全HTMLにフッター追加 (pokemon_db_v9.html, party_checker.html, index.html)
        - フッター文言は HANDOFF_PUBLISHING.md §Phase 2 参照
```

### Phase 3: SEO 基盤 + 画像素材作成 (半日〜1日)

```
[ ] 3-1. index.html 作成 (ランディングページ・現状未作成)
        - ぴ〜ちゃん画像をヒーローイメージに
        - 各ツール (DB / わざリスト / パーティチェッカー) へのリンク
        - 「非公式」明記
[ ] 3-2. 各HTMLの <title> と <meta description> 整備
[ ] 3-3. OGP メタタグ追加 (og:title, og:description, og:image, og:url)
[ ] 3-4. 画像素材作成 (ぴ〜ちゃんマスコットから派生)
        詳細は下記「画像素材作成タスク」参照
[ ] 3-5. robots.txt 作成
[ ] 3-6. sitemap.xml 生成
[ ] 3-7. Google Search Console 登録、サイトマップ提出
[ ] 3-8. GA4 セットアップ (gtag.js 全HTMLに埋込)
[ ] 3-9. Cloudflare Analytics 有効化
```

#### 🎨 画像素材作成タスク (Phase 3-4 詳細)

ぴ〜ちゃんマスコットから派生して以下を作成:

| 素材 | サイズ | 用途 | 作り方 |
|---|---|---|---|
| **favicon.ico** | 16×16 / 32×32 / 48×48 | ブラウザタブ・ブックマーク | キャップのPだけクロップ |
| **favicon-192.png** | 192×192 | Apple Touch Icon | 同上 |
| **ogp.png** | 1200×630 | Twitter/Discord/SNS共有 | フル ぴ〜ちゃん + サイト名テキスト |
| **header-logo.png** | 200×60 | サイトヘッダー | ロゴ風(キャップP + "pchamdb") |
| **404-illustration.png** | 任意 | エラーページ | 「ぴ〜ちゃんが見つけられなかった…」 |

**作成手段の選択肢**:
- **A) Affinity MCP 経由** (Affinity Designer/Photo 起動・MCP有効化が必要)
  - ベクター・高品質・レイヤー操作可能
  - ユーザに Affinity 起動と元画像パス共有を依頼
- **B) Python+Pillow スクリプト** (Affinity 不要、手軽)
  - クロップ・リサイズ・テキストオーバーレイ可能
  - 元画像PNGパスだけあれば即生成可能
- **C) AI画像生成** (バリエーション拡張)
  - 別ポーズ・空状態用イラスト等

**推奨フロー**: B (Pillow) で叩き台 → 必要に応じて A (Affinity) で仕上げ

### Phase 4: わざ説明文の本適用 (※このセッションで準備済み)

```
[ ] 4-1. rewrite_workspace/11_rewrites_full_draft.json を pokechan_data.js に適用
        - 各わざの description を新リライトで置換
        - 自動化スクリプトを書く必要あり (apply_rewrites.py 的な)
[ ] 4-2. パーティチェッカー側の説明文も更新確認
[ ] 4-3. 動作確認 (ローカル)
[ ] 4-4. GitHub にコミット&プッシュ
```

### Phase 5: 収益化開始 (Phase 1-4 完了後)

```
[ ] 5-1. Amazon アソシエイト 申請 (即承認多い)
[ ] 5-2. 広告配置場所決定 (画面下部 or サイドバー、コンテンツ中央は避ける)
[ ] 5-3. AdSense 申請 (PV月3,000以上推奨、未満だと審査落ち)
[ ] 5-4. 広告コードを各HTMLに埋込
```

---

## ⚙️ アベの判断保留事項

新セッション開始時に以下をアベに確認すべき項目:

1. **`.jp` ドメインも取得?** (年+¥2,400)
2. **GA4 / Cloudflare Analytics 両方使う?** (両方無料・推奨)
3. **AdSense は当初から?** それとも PV 伸びてから?
4. ~~読み方の正式表記~~ → **「ピーちゃん DB」で確定済み** ✅
5. ~~OGP 画像のデザイン方針~~ → **マスコット ぴ〜ちゃん を活用** で決定 ✅
6. **Cloudflare アカウント既にある?** なければ新規作成
7. **ぴ〜ちゃん画像のローカルパス確認** (例: `~/Downloads/pchan.png` 等)
8. **画像素材作成手段選択**: Affinity 経由 / Python+Pillow / 両方併用

---

## 📂 重要ファイル位置

### 主要HTMLファイル
```
~/Documents/ポケモンDB/
├── pokemon_db_v9.html          ← メインDB (~3,900行)
├── waza-list-template.html     ← わざリスト
├── party_checker.html          ← パーティチェッカー
└── pokechan_data.js            ← 共有データ (~1.65MB、わざ説明含む)
```

### このセッションの成果物
```
~/Documents/ポケモンDB/
├── HANDOFF_PUBLISHING.md              ← 元々先生向け (GitHub push済)
├── HANDOFF_NEW_SESSION_NET_PUBLISH.md ← この資料 (新Codyセッション向け)
└── rewrite_workspace/                 ← わざリライト作業フォルダ
    ├── 11_rewrites_full_draft.json    ← 最終485件リライト
    ├── 10_comparison_v3.html          ← 比較レポート
    └── (他、エンジン・スクリプト)
```

### GitHub
- リポジトリ: https://github.com/nawomu/pokechan-db
- 現公開URL: https://nawomu.github.io/pokechan-db/

---

## 📞 関係者

| 呼称 | 環境 | 役割 |
|---|---|---|
| **アベ** | 人間 | 最終判断者、購入決済 |
| **先生** | Cowork | 当初公開作業を依頼したが別件に流れた → 今後はCody新セッションで進める |
| **コーディ** (旧セッション) | Claude Code GUI | わざリライト完了 |
| **コーディ** (新セッション) | Claude Code GUI | **これから公開作業実行** |

---

## 🚀 新セッション開始時の最初のメッセージ案

新セッションを起動したら、以下をペーストすれば即座に文脈が引き継がれます:

```
ポケモンDB (pchamdb) のネット公開作業を進めたい。

引き継ぎ資料を読んで、現状把握してください:
~/Documents/ポケモンDB/HANDOFF_NEW_SESSION_NET_PUBLISH.md

把握できたら、まず Phase 1 (ドメイン取得+基本設定) から進めましょう。
最初に「アベの判断保留事項」を確認させてください。
```

---

## 📝 最終チェックリスト (新セッション開始前)

旧セッション (= このセッション) で完了確認:

- [x] わざ説明文リライト完了 (vs ヤッくん類似度0.7+ → 0件)
- [x] HANDOFF_PUBLISHING.md 作成・GitHub push済
- [x] このHANDOFF_NEW_SESSION_NET_PUBLISH.md 作成
- [x] rewrite_workspace/ にすべての作業ファイル保存済み

新セッション開始後にやること:
- [ ] 上記の「最初のメッセージ案」をペースト
- [ ] アベの判断保留6項目を確認
- [ ] Phase 1 から順次実行

---

**新Codyセッション、よろしくお願いします！**

— コーディ (旧セッション終了時, 2026-05-10 JST)
