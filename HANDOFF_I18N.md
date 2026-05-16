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

### 第2候補: Bulbapedia ── 「答え合わせ」用途のみ
- 親ページ: https://bulbapedia.bulbagarden.net/wiki/Localization
- 「○○ in other languages」シリーズが網羅されており、公式翻訳の最も信頼できる**人間用参照**
  - https://bulbapedia.bulbagarden.net/wiki/List_of_moves_in_other_languages — わざ × 全言語
  - https://bulbapedia.bulbagarden.net/wiki/List_of_Abilities_in_other_languages — 特性 × 全言語
  - https://bulbapedia.bulbagarden.net/wiki/List_of_categories_in_other_languages — 図鑑分類（たねポケモン → Seed Pokémon 等）× 全言語
  - List of natures in other languages — 性格 25種 × 全言語
  - Items / Locations / Characters in other languages — 必要なら拡張
- **ライセンス: CC BY-NC-SA 2.5 (非商用条件あり)**
- PchamDB は楽天アフィを入れているため、Bulbapedia 文章の**転載・自動スクレイピング取り込みは規約違反リスク**
- 採用方針: **PokeAPI で取得した英訳の検証・抜け項目の確認**用途に限定。データ本体としては使わない

### 第3候補: Pokémon Showdown データファイル ── わざ説明文の統一表記用 (新規)
- https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts
- https://github.com/smogon/pokemon-showdown/blob/master/data/abilities.ts
- **ライセンス: MIT** (商用利用可)
- わざ・特性の **`shortDesc` / `desc` が競技勢の業界標準英文**
- PokeAPI の `flavor_text_entries` は版による表記揺れがあるため、説明文の統一表記が欲しい場合に併用候補
- ただし**多言語非対応** (data ファイルは英語専用、translations/ は UI/チャット用のみ)

### 第4候補: PokéJisho (https://pokejisho.com/en/jisho/)
- ポケモン日英特化辞書 (名前・特性・アイテム・わざ・性格)
- **利用規約・ライセンス記載が見当たらない**ため、データ取り込みではなく**個別チェック用**として参照
- 規約が後日明文化されたら扱いを再評価

### 補助参考: PokéCommunity 国際名 CSV (https://www.pokecommunity.com/threads/international-list-of-names-in-csv.460446/)
- コミュニティ投稿の名前 CSV (英・独・仏・伊・西・韓・中)
- 最新性とライセンスは要確認。**裏取り目的**にのみ使う

### 補助参考: Smogon 翻訳解説記事 (https://www.smogon.com/articles/lost-in-translation)
- 日英訳の文化的背景の解説。データ源ではなく**翻訳の裏付け資料**

### 旧第3候補だった veekun pokedex — 採用見送り
- https://veekun.com/dex (CSV/SQLite 配布あり)
- PokeAPI の元データだが **Gen 8 以降が未整備** (Issue #284 で停滞)
- ポケモンチャンピオンズ = Gen 9 想定のため**この用途では使えない**

### 非推奨: 公式ポケモン各国サイト / pokemondb.net / Serebii
- 最も信頼性は高いが、スクレイピング困難＋利用規約上の明示的許諾なし

---

## 🛡️ ライセンス・利用方針 (2026-05-15 追記)

PchamDB は楽天アフィリエイトを設置する**商用扱いサイト**である前提で、各データソースを以下のように位置づける。

| データ | 取得元 | 採用形態 |
|---|---|---|
| ポケモン名 / 特性名 / わざ名 / タイプ名 / 図鑑分類 / 性格名 / 状態異常名 | **PokeAPI v2** (フリー、出典明記推奨) | データ取り込み |
| わざ説明文（統一表記が欲しい場合） | **Pokémon Showdown** (MIT) | 任意で併用 |
| 公式翻訳の検証・抜け確認 | **Bulbapedia** (CC BY-NC-SA, 非商用) | 人間が参照するのみ、転載しない |
| 個別チェック | **PokéJisho** (規約不明) | 人間が参照するのみ |

**原則**: PokeAPI を主データソースとし、Bulbapedia は「答え合わせ用」として人間が参照する場合に限る。スクレイパーは Bulbapedia に向けないこと。

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


### B-1. UI 文言の確定マッピング (2026-05-15 更新)

party_checker / pokemon_db_v9 で使う日英用語の確定対応表。
これに沿って i18n 辞書を作るとブレない。

#### 種族値表示モード (チェッカー上部ボタン)
| 日本語 | 英語 | 内訳 |
|---|---|---|
| 種族 | Base | 種族値 (raw base stat) |
| 6V | 6V (or `Lv50`) | IV=31・EV=0・補正なし の Lv50 実数値 |
| 性補 | +Nature | IV=31・EV=0・性格1.1 |
| 準振 | **Max EV** | IV=31・EV=252・補正なし |
| 最大 | **Max+** | IV=31・EV=252・性格1.1 |
| 順位 | Rank | 全ポケモン中の順位 |

#### 性格関連
| 日本語 | 英語 |
|---|---|
| 性格 | Nature |
| 性格補正 | Nature Effect (説明用) / Nature (短縮) |
| 性格 ↑ (上がる) | Boosted (+10%) |
| 性格 ↓ (下がる) | Lowered (−10%) |
| 補正なし | Neutral |
| 中性性格 (まじめ・どんかん 等) | Neutral Nature |

#### ステ略号
| 日本語 | 英略 | 英フル |
|---|---|---|
| HP | HP | HP |
| こうげき | Atk | Attack |
| ぼうぎょ | Def | Defense |
| とくこう | SpA | Special Attack |
| とくぼう | SpD | Special Defense |
| すばやさ | Spe | Speed |

#### 表示例 (性格効果)
| 日本語 | 英語 |
|---|---|
| ぼうぎょ↑ / こうげき↓ | Def↑ / Atk↓ |
| とくこう↑ / すばやさ↓ | SpA↑ / Spe↓ |

#### 能力ポイント (Champions 方式) 関連
| 日本語 | 英語 |
|---|---|
| 能力ポイント | Power Points (or Stat Points) |
| 黄色いライン (性格 ↑ ボーナス pt) | Yellow line (+1 bonus from nature) |
| 青いライン (性格 ↓ 無駄 pt) | Blue line (wasted pt, no gain) |
| Reset | Reset (そのまま) |
| MAX / MIN | MAX / MIN (そのまま) |
| 📣 Ad (広告再表示ボタン) | 📣 Ad (全言語固定。HANDOFF_AFFILIATE_SESSION.md 参照) |

**注意**: ポケモン名・わざ名・特性名・タイプ名 は上記マッピングの対象外。**必ず PokeAPI 等の公式翻訳から取得すること** (第1原則)。

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

**最終更新**: 2026-05-15 (海外データソース再調査・ライセンス方針追加・次着手手順記載)

---

## ✅ 2026-05-16 完了報告 (続): D-1 / D-2 / D-3 / E

このセッションで本番ページの言語切替が**実動作**するようになりました。

| 項目 | 内容 | 規模 |
|---|---|---|
| **D-1** | `index.html` に data-i18n 属性挿入 | 15 ユニークキー / 17 属性 |
| **D-2** | `party_checker.html` 静的 HTML に data-i18n 挿入 | 32 ユニークキー / 31 属性 |
| **D-3** | 言語切替ボタン | runtime.js が `#i18n-switcher-mount` 自動マウント。両ページに既存 |
| **E** | UI キー整合性監査 | スクリプト化: `i18n/audit_ui_keys.py` |

### 監査結果 (audit_ui_keys.py)
- HTML 参照ユニークキー: **47**
- ui-ja / ui-en keys: 各 **113**（完全一致）
- 未定義参照: **0** ✅
- 浮きキー (未参照): 66 件 — stats.*, table.*, lang.*, common.* など他ページ用にプール

### 追加したキー (ui-ja/en.json)
- `index.*`: card_pokedex_desc / card_party_checker_desc / card_moves_desc / open_arrow
- `checker.*`: 25 キー（move_search / category / sv_base..sv_rank / send_to_battle / select_pokemon / select_move / etc）

### バックアップ
```
bak/index.20260516_064500.bak.html
bak/party_checker.20260516_064500.bak.html
```

### 残ったハードル
- **party_checker.html の JS 動的生成部分** (タブバー、わざテーブル等) は未翻訳。これらは `I18N.t()` を呼ぶよう個別に書き換えが必要
- **チアセクション (index.html line 330-331)** は HTML 内包 (`<strong>`, `<br>`, `<a>`) のため data-i18n 不可。マルチ要素分割が必要
- **footer の not_affiliated 段落** は textContent 置換で `<br>` が消える。JA 表示時にレイアウトが微妙に変化

### 動作確認手順 (ローカル)
```bash
cd ~/Documents/ポケモンDB
python3 -m http.server 8765 &
open http://localhost:8765/index.html
# 右上 🌐 ボタン → English → ページ全体 (見出し/カード/フッター) が英語化
open http://localhost:8765/party_checker.html
# フィルタバー (わざ検索/分類/種族値…) と各モーダル (ポケモン選択/技選択/性格選択/EV) が英語化
```

---

## ✅ 2026-05-16 完了報告: A / B / C 実行済み

このセッションで以下が完了しました。**8 言語すべて** (en/de/es/fr/it/ko/zh-Hans/zh-Hant + ja) に書き込み済み。

| 種別 | 件数 | データソース | 実行スクリプト |
|---|---|---|---|
| genera (ジャンル) | 712 種 | PokeAPI species cache | `i18n/build_genera.py` |
| natures (性格) | 25 種 | PokeAPI `/nature/{1..25}/` | `i18n/build_natures.py` |
| status (状態異常) | 7 種 | 手動定義（PokeAPI に ja/de/it/ko/zh なし） | `i18n/build_status.py` |

### カバレッジ

- genera: en/fr/ko = 100% 、de/zh = 99%、es = 91%、it = 91% (es/it は PokeAPI の翻訳欠落分は英語フォールバック)
- natures: 全 8 言語 100%
- status: 主要 7 種 (まひ/ねむり/こおり/やけど/どく/もうどく/こんらん) のみ。**手動翻訳のため公式表記と差異があれば直接編集要**

### バックアップ

```
i18n/bak/{lang}.20260516_064320.bak.json   # 全 8 ファイル
```

### _meta に追加されたキー

```json
"genera_fallback_to_en": <int>,
"natures_fallback_to_en": <int>,
"status_source": "hand-curated (PokeAPI move-ailment lacks ja/de/it/ko/zh)",
"status_count": 7
```

### 次の候補

- **D. ランタイム実装確認**: `i18n/runtime.js` と `preview.html` で言語切替がどう動いているか把握 → 本番 (index/party_checker など) へ移植
- **E. UI 文言キー整合性確認**: `ui-en.json` の各キーが HTML 側で参照されているか突合
- **C 拡張**: status 7 種以外（メロメロ/バインド/やどりぎ等）を追加するなら手動翻訳テーブルを `build_status.py` に追記

---

## 🚀 次セッションでの再開手順 (2026-05-15 追記)

### 起動

```bash
cd ~/Documents/ポケモンDB && claude
```

### 最初に確認すべきこと

1. このファイル (`HANDOFF_I18N.md`) を読み、上の「📚 公式翻訳データの取得先」「🛡️ ライセンス・利用方針」を把握
2. memory: `project_i18n_phase2.md` で現状サマリを確認
3. 当面の対象言語は **英語のみ**

### 着手予定タスク (優先順)

#### A. ジャンル (genus) を en.json に追加 — 最優先

API 再リクエスト不要、cache から抽出するだけ。

```bash
cd ~/Documents/ポケモンDB/i18n
cp en.json en.json.bak  # 必ずバックアップ

# cache/species/*.json の genera[lang=en] を集めて en.json[genera] に追加
python3 << 'PY'
import json, glob
from pathlib import Path

ja_to_en = {}
for f in glob.glob('cache/species/*.json'):
    if f.endswith('_list.json'):
        continue
    d = json.load(open(f))
    ja_genus = next((g['genus'] for g in d.get('genera', []) if g['language']['name']=='ja'), None)
    en_genus = next((g['genus'] for g in d.get('genera', []) if g['language']['name']=='en'), None)
    if ja_genus and en_genus:
        ja_to_en[ja_genus] = en_genus

en = json.load(open('en.json'))
en['genera'] = ja_to_en
json.dump(en, open('en.json', 'w'), ensure_ascii=False, indent=2)
print(f"  genera: {len(ja_to_en)} 件追加")
PY
```

#### B. 性格 25種を en.json に追加

```bash
# PokeAPI /nature/{1..25}/ を取得 → en.json[natures] に追加
# fetch_i18n.py を拡張する形が自然。新規スクリプトでも可
```

実装メモ:
- エンドポイント: `https://pokeapi.co/api/v2/nature/{id}/` (id=1〜25)
- `names[lang=ja] → names[lang=en]` のマッピングを作る
- 例: がんばりや → Hardy、いじっぱり → Adamant、ようき → Jolly、ひかえめ → Modest

#### C. 状態異常を en.json に追加

```bash
# PokeAPI /move-ailment/ 一覧 → 各 /move-ailment/{id}/
```

実装メモ:
- 一覧: `https://pokeapi.co/api/v2/move-ailment/`
- 個別: `https://pokeapi.co/api/v2/move-ailment/{id}/`
- 約20件
- やけど → Burn、どく → Poison、まひ → Paralysis 等

#### D. 言語切替ボタンの本番ページへの組込

`runtime.js` を読み、preview.html でどう動いているか把握 → 本番ページに移植

#### E. UI 文言キー整合性確認

`ui-en.json` の各キーが index.html / pokemon_db_v9.html / party_checker.html / waza-list.html で参照されているか突合

### 制約リマインダ

- `en.json` 書き込み前に必ず `.bak` を取る
- Bulbapedia から**データ転載・自動スクレイピング禁止** (CC BY-NC-SA 非商用)
- 性格・特性・タイプ・わざ・ポケモン名は**勝手に訳さない** — PokeAPI 公式翻訳のみ
**前セッションの記録**: `~/.claude/projects/-Users-masamichi-Documents-----DB/44448ed8-2a79-4656-bca9-45b27d6fdd49.jsonl`

