# 多言語化 (i18n) — 引き継ぎ資料

**作成**: 2026-05-14 JST
**作成者**: Claude Sonnet 4.6 (前セッション)
**対象**: 別セッションで多言語化を引き継ぐ担当者
**目的**: PchamDB の多言語化に必要な調査・実装情報の引き継ぎ

> **注記**: SEO 対策は別セッションで対応中。本ファイルは多言語化のみを扱う。

---

## 🎯 タスク概要

PchamDB (https://pchamdb.com) をポケモン公式対応9言語のうち、優先順位をつけて段階導入する。

ユーザー (あべ) の元発言:
> 「X多言語化してるから、ツイートするなら多言語化しておいた方がいい」
> 「世界のポケモン人口を見て優先順位をつけた方がいいのではないでしょうか」
> 「多言語化はただ日本語を訳すだけではダメ。ポケモンの正式な英語、中国語、
>  フランス語、ポルトガル語、スペイン語など、それぞれ表現が決まったものがある」

---

## 🚫 多言語化の絶対原則

**ポケモン関連用語は勝手に訳すな** — すべて任天堂/株式会社ポケモンの公式翻訳が決まっている。

| 日本語 | 英語 | 中国語(簡) | フランス語 | ドイツ語 |
|--------|------|---------|----------|---------|
| ピカチュウ | Pikachu | 皮卡丘 | Pikachu | Pikachu |
| フシギダネ | Bulbasaur | 妙蛙种子 | Bulbizarre | Bisasam |
| いかく(特性) | Intimidate | 威吓 | Intimidation | Bedroher |
| でんき(タイプ) | Electric | 电 | Électrik | Elektro |
| でんこうせっか | Quick Attack | 电光一闪 | Vive-Attaque | Ruckzuckhieb |

勝手に訳すと **著作権・商標問題＋ファンからの信用失墜** のダブルパンチ。必ず公式翻訳DBから引っ張る。

---

## 📚 公式翻訳データの取得先

### 第1候補: PokeAPI (https://pokeapi.co)
- **オープンソース、無料、RESTful**
- 多言語対応: `en, fr, de, es, it, ja-Hrkt, ja, ko, zh-Hans, zh-Hant` 等
- `names` フィールドに `language` プロパティ付きで提供
- 例: `GET /pokemon-species/1/` → `names: [{name:"Bulbasaur",language:{name:"en"}}, ...]`
- **わざ・特性・タイプもすべて多言語あり**

### 第2候補: Bulbapedia
- https://bulbapedia.bulbagarden.net/wiki/Localization
- 「List of moves in other languages」「List of abilities in other languages」等の網羅ページあり
- スクレイピングが必要だが、PokeAPI を補完できる

### 第3候補: veekun pokedex (https://veekun.com/dex)
- ROM dump ベースの SQLite/CSV 配布あり
- PokeAPI のデータ元の1つ

### 非推奨: 公式ポケモン各国サイト
- 最も信頼性は高いが、スクレイピング困難＋利用規約注意

---

## 🌍 ポケモン公式対応言語 (9言語)

メインゲーム正式対応:
1. 日本語
2. 英語
3. スペイン語
4. フランス語
5. ドイツ語
6. イタリア語
7. 韓国語
8. 中国語 (簡体)
9. 中国語 (繁体)

---

## 📊 優先順位の判断材料 (2026年5月時点 Web検索)

### ポケモンGO 統計
- 月間アクティブユーザー: 約110M (2025年12月)
- **支出**: 米国38%, 日本31%, ドイツ5%
- **ダウンロード**: 米国、ブラジル、インド、メキシコ、ロシア
- 地域別収益: Americas $257M, Asia-Pacific $203M, EMEA $84M (2024)

### VGC 競技シーン
- **英語が圧倒的1位** (Smogon, Pokemon Showdown, 公式VGC)
- 欧州主要言語 (独・仏・伊) は欧州VGCで存在感あり
- 日本語、韓国語、中国語(繁体: 台湾) も競技勢あり

### 私案: 段階導入順序
| 段階 | 言語 | 理由 |
|------|------|------|
| 第1段階 | **英語** | 最大市場、競技シーンの主要言語、海外流入の大半 |
| 第2段階 | **スペイン語** | スペイン+ラテンアメリカで第2の市場 |
| 第3段階 | 中国語(繁体)・韓国語 | アジア競技勢 |
| 第4段階 | ドイツ語・フランス語・イタリア語 | 欧州VGC |
| 第5段階 | 中国語(簡体)・ポルトガル語(BR) | GO人口多いが対戦コミュは小さめ |

**最初は「英語＋トップページのみ」から始めて反応を見るのが現実的。**

---

## 🌐 翻訳が必要な対象

### A. ポケモンデータ (pokechan_data.js)
- ポケモン名 (POKEMON_LIST)
- タイプ名
- 特性名
- わざ名 (WAZA_MAP keys + names)
- わざの説明文 (description, description_legacy)

### B. UI文言 (各HTMLファイル)
- ボタン名、見出し、フィルター名、ツールチップ、placeholder
- 列名 (HP, 攻, 防, 特攻 etc.)
- アラート・エラーメッセージ

### C. メタ情報 (各HTML head)
- `<title>`
- `<meta name="description">`
- OGP (og:title, og:description, og:image, og:url, og:site_name)
- Twitter Card

### D. 法的ページ
- 利用規約 (terms.html)
- プライバシーポリシー (privacy.html)
- 免責事項 (disclaimer.html)
- お問い合わせ (contact.html) — Googleフォーム自体も多言語版が必要

---

## 🏗️ 実装方針の選択肢

### A. 静的多言語: `/en/`, `/es/` サブディレクトリで独立HTML
- ✅ SEO に優しい (URL別、hreflang 自然)
- ❌ ファイル数 × 言語数、メンテ負担大

### B. 動的切替: `?lang=en` クエリで JSON 辞書切り替え
- ✅ ファイル数増えない、メンテ容易
- ⚠️ SEO はやや弱いが hreflang + JSの prerender で対応可能

### C. 完全データ駆動: PokeAPI の language array を直接利用
- ✅ 翻訳作業ゼロ (公式データのみ使用)
- ❌ オフラインで動かない、API依存リスク

**推奨: A + B のハイブリッド**
- トップ・法的ページは A (静的)
- データ部 (DB/チェッカー/わざリスト) は B (JSON切替)

---

## 🌐 多言語SEO (本作業で必要な部分のみ)

- `<html lang="ja">` を言語ごとに切替
- `<link rel="alternate" hreflang="en" href="..." />` 各ページに付与
- `x-default` の指定
- sitemap.xml に多言語URLを追記（基盤SEOは別セッションで完了予定）

---

## 📁 関連ファイル

```
~/Documents/ポケモンDB/
├── index.html                ← トップページ
├── pokemon_db_v9.html        ← ポケモンDB (マスターDB: const DATA)
├── party_checker.html        ← 手持ちわざチェッカー
├── waza-list.html            ← わざリスト (独立アクセス版)
├── waza-list-template.html   ← わざリスト (iframe埋込テンプレ)
├── pokechan_data.js          ← マスターデータ (POKEMON_LIST, WAZA_MAP, ABILITY_DESC)
├── contact.html              ← お問い合わせ
├── terms.html                ← 利用規約
├── privacy.html              ← プライバシーポリシー
├── disclaimer.html           ← 免責事項
├── sitemap.xml               ← Untracked、要確認
├── robots.txt                ← Untracked、要確認
├── favicon.ico / favicon.png ← Untracked
└── HANDOFF_*.md              ← 各タスク引き継ぎ資料
```

---

## ⚠️ 注意点・制約 (CLAUDE.md より)

- **著作権**: ポケモン名・わざ名等は任天堂/株式会社ポケモン/ゲームフリーク/クリーチャーズの商標
- **非公式表明**: 全ページに「⚠️ 当サイトは非公式ファンサイトです」必須
- **アフィリエイト**: 楽天モーションウィジェット入っているため PR 表記必須
- **マスターDB原則**: `pokemon_db_v9.html` の `const DATA = [...]` が正
- **削除操作**: あべの明示的許可なしに絶対しない (`_archive/` への移動が鉄則)
- **リスク確認**: セキュリティ上の懸念があれば必ずあべに確認
- **言語**: 日本語で対話

---

## 🐦 X (旧Twitter) 発信について

ユーザーは「PchamDBアカウントを作って『AIのClaudeで1ヶ月で作りました』と言ったらいいか」と検討中。

### 前セッションでの結論
- 「AIで作った」公言は最近珍しくないので大きな炎上リスクは低い
- ただし「非公式ポケモンサイト + 楽天アフィリエイト + AI生成」の組合せは「楽して稼ぐ」と誤読されるリスクあり
- 推奨文体: 「Claude Code をパートナーに、データ検証と整理を1ヶ月で形にしました」
  → **手作業の検証努力 (マスターDBとの突合せ等) を並列で語る**

### 多言語ツイート対応
- ユーザーのX アカウントは多言語化済み
- ローンチ告知は **日本語＋英語** から開始、反応を見て言語追加が現実的

---

## 🚀 次の具体的アクション (推奨順)

> SEO 基盤整備 (meta/OGP/JSON-LD/sitemap/robots) は別セッションで対応中。
> 本作業は Phase 2 以降から着手する。

### Phase 2: 英語版データ生成 (1〜2日)
1. PokeAPI からポケモン名・わざ名・特性名・タイプ名の英語辞書をスクリプト生成
   - 出力先案: `i18n/en.json` または `pokechan_data_en.js`
2. マスターDB との突合せ・検証 (キー一致確認)
3. 不一致箇所のリストアップ

### Phase 3: UI 英訳 (2〜3日)
1. 各HTMLファイルからUI文言抽出
2. 英訳辞書 `i18n/en/ui.json` 作成
3. 言語切替UI追加 (ヘッダーに 🌐 ボタン or 旗アイコン)
4. JavaScript で動的差し替え or 静的英語版HTML生成

### Phase 4: SNS 発信文 多言語化 (半日)
1. ローンチツイート 日本語版 + 英語版作成
2. プロフィール多言語化

### Phase 5: 第2言語 (スペイン語) 着手 (1週間〜)
- 反応を見て判断

---

## 📚 参照リンク

### 公式・データソース
- PokeAPI: https://pokeapi.co/
- PokeAPI ドキュメント: https://pokeapi.co/docs/v2
- Bulbapedia ローカライゼーション: https://bulbapedia.bulbagarden.net/wiki/Localization
- Bulbapedia わざ多言語: https://bulbapedia.bulbagarden.net/wiki/List_of_moves_in_other_languages
- veekun pokedex: https://veekun.com/dex

### 統計・市場データ
- Statista Pokemon: https://www.statista.com/topics/6019/pokemon-gaming/
- Pokemon GO Statistics 2026 (LEVVVEL): https://levvvel.com/pokemon-go-statistics/
- Pokemon GO Statistics 2026 (Business of Apps): https://www.businessofapps.com/data/pokemon-go-statistics/

---

## 🔗 関連 HANDOFF ファイル

- `HANDOFF_PHASE3_SIMULATOR.md` — バトルシミュレータ設計 (タグ体系・Phase構造)
- `HANDOFF_AFFILIATE_SESSION.md` — アフィリエイト関連
- `HANDOFF_CODEX.md` — Codex 連携

---

**最終更新**: 2026-05-14
**前セッションの記録**: `~/.claude/projects/-Users-masamichi-Documents-----DB/44448ed8-2a79-4656-bca9-45b27d6fdd49.jsonl`
