# i18n カバレッジ監査レポート

対象ファイル: 17件 / 対象言語: 9

## 1. HTML 別 — i18n 参照キー数 / ハードコード日本語の検出件数

| ファイル | data-i18n キー | JS呼び出しキー | 未翻訳日本語(検出) |
|---|---:|---:|---:|
| index.html | 24 | 0 | 36 |
| index_en.html | 0 | 0 | 1 |
| pokemon_db_v9.html | 26 | 45 | 98 |
| party_checker.html | 57 | 0 | 152 |
| battle_simulator.html | 0 | 0 | 287 |
| waza-list.html | 1 | 0 | 166 |
| type_chart.html | 18 | 0 | 98 |
| making.html | 1 | 0 | 72 |
| making_en.html | 1 | 0 | 1 |
| privacy.html | 0 | 0 | 72 |
| privacy_en.html | 0 | 0 | 1 |
| terms.html | 0 | 0 | 69 |
| terms_en.html | 0 | 0 | 1 |
| contact.html | 0 | 0 | 68 |
| contact_en.html | 0 | 0 | 1 |
| disclaimer.html | 0 | 0 | 66 |
| disclaimer_en.html | 0 | 0 | 1 |

## 2. ハードコード日本語の検出 (各ファイル先頭 20 件)

### `index.html` — 36 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 15 | html_text | `PchamDB - ポケモンチャンピオンズ 非公式ファンデータベース` |
| 71 | html_text | `:root {
    --orange: #FF7A00;
    --orange-light: #FFB347;
    --blue: #1E5BB8;` |
| 391 | html_text | `管理人` |
| 391 | html_text | `ぴ〜ちゃん` |
| 391 | html_text | `みんなの対戦準備を応援しています！` |
| 391 | html_text | `(ピーチャンディービー) は、ポケモンチャンピオンズの` |
| 392 | html_text | `対戦・パーティ構築に役立つ` |
| 392 | html_text | `非公式ファンデータベース` |
| 392 | html_text | `です。` |
| 396 | html_text | `広告 / PR` |
| 403 | html_text | `ポケモンDB` |
| 403 | html_text | `全ポケモンの種族値・タイプ・特性・覚えるわざを検索・閲覧できる総合データベース` |
| 404 | html_text | `開く →` |
| 406 | html_text | `パーティチェッカー` |
| 407 | html_text | `パーティ構成のタイプ相性・弱点を瞬時にチェック。対戦準備に必須のツール` |
| 410 | html_text | `開く →` |
| 413 | html_text | `わざ一覧` |
| 413 | html_text | `全わざのデータを検索・閲覧。威力・命中・効果・覚えるポケモンも一目で` |
| 414 | html_text | `開く →` |
| 418 | html_text | `タイプ相性表` |

_…他 16 件_

### `index_en.html` — 1 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 297 | html_text | `🇯🇵 日本語` |

### `pokemon_db_v9.html` — 98 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 15 | html_text | `ポケモンDB - PchamDB (非公式)` |
| 75 | html_text | `* { box-sizing: border-box; }
html { min-height: 100%; }
body {
  font-family: "` |
| 1155 | html_text | `ポケモンチャンピオンズ` |
| 1160 | html_text | `リセット` |
| 1176 | html_text | `🔍 補完①` |
| 1179 | html_text | `🔍 補完②` |
| 1180 | html_text | `🔍 補完③` |
| 1181 | html_text | `列表示:` |
| 1182 | html_text | `チェック` |
| 1184 | html_text | `タイプ` |
| 1188 | html_text | `能力値` |
| 1189 | html_text | `とくせい` |
| 1189 | html_text | `相性18` |
| 1190 | html_text | `集計+スコア` |
| 1191 | html_text | `わざ` |
| 1193 | html_text | `変化` |
| 1194 | html_text | `物理` |
| 1196 | html_text | `特殊` |
| 1197 | html_text | `絞込:` |
| 1199 | html_text | `除外:` |

_…他 78 件_

### `party_checker.html` — 152 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 15 | html_text | `手持ちわざチェッカー - PchamDB (非公式)` |
| 75 | html_text | `*{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100%}
body{font` |
| 615 | html_text | `/* ===== 入室時ポップアップ広告 (楽天) ===== */
.entry-popup {
  position: fixed;
  inset: 0;` |
| 694 | html_text | `📣 PR / 楽天市場` |
| 695 | html_text | `✕ 閉じる` |
| 700 | html_text | `※ PchamDB は楽天アフィリエイトの参加者です` |
| 701 | html_text | `ページ下部にも商品があります` |
| 767 | html_text | `わざ検索:` |
| 768 | html_text | `分類:` |
| 768 | html_text | `変化` |
| 769 | html_text | `物理` |
| 770 | html_text | `特殊` |
| 770 | html_text | `種族値:` |
| 771 | html_text | `種族` |
| 773 | html_text | `性補` |
| 774 | html_text | `準振` |
| 775 | html_text | `最大` |
| 775 | html_text | `順位` |
| 777 | html_text | `⚔️ バトルへ送る` |
| 778 | html_text | `ポケモンを選択` |

_…他 132 件_

### `battle_simulator.html` — 287 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 15 | html_text | `バトルシミュレータ - PchamDB (非公式)` |
| 74 | html_text | `*{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100%}
body{
  f` |
| 646 | html_text | `⚔️ バトルシミュレーター` |
| 647 | html_text | `Lv50固定 / 個体値31固定 / 能力P最大66（各32）` |
| 650 | html_text | `👥 チェッカー` |
| 651 | html_text | `📋 わざリスト` |
| 652 | html_text | `📊 タイプ相性` |
| 653 | html_text | `⚡ リアルバトル` |
| 659 | html_text | `📥 技チェッカーから受信したパーティ` |
| 660 | html_text | `クリア` |
| 670 | html_text | `ポケモンを選択` |
| 673 | html_text | `▾ 選択` |
| 677 | html_text | `能力P合計` |
| 688 | html_text | `＋ 持ち物を選択` |
| 700 | html_text | `🌐 環境` |
| 702 | html_text | `⇄ 自分 / 相手を入れ替え` |
| 705 | html_text | `天候` |
| 707 | html_text | `なし` |
| 708 | html_text | `はれ` |
| 709 | html_text | `あめ` |

_…他 267 件_

### `waza-list.html` — 166 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 14 | html_text | `わざリスト - PchamDB (非公式)` |
| 75 | html_text | `/* === waza-list 固有スタイル (共通部分は waza_picker.css に分離) === */` |
| 82 | html_text | `📋 わざリスト` |
| 82 | html_text | `リスト: 04/19更新` |
| 85 | html_text | `🎯 チェッカー` |
| 86 | html_text | `📊 タイプ相性` |
| 94 | html_text | `🔍 効果フィルター ▲` |
| 97 | html_text | `🧬 全ポケモンを選択中 ▾` |
| 109 | html_text | `全0技` |
| 111 | html_text | `🔄 リセット` |
| 112 | html_text | `🔀 検索: OR` |
| 113 | html_text | `📌 シングル選択` |
| 114 | html_text | `※ヘッダーでソート、その下でフィルタ` |
| 123 | html_text | `0 件選択中` |
| 125 | html_text | `全解除` |
| 126 | html_text | `キャンセル` |
| 127 | html_text | `✅ 確定` |
| 134 | html_text | `技フラグ:` |
| 135 | html_text | `👊 パンチ系` |
| 136 | html_text | `🔊 音技` |

_…他 146 件_

### `type_chart.html` — 98 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 15 | html_text | `タイプ相性表・弱点早見表 - ポケモンチャンピオンズ用タイプ図鑑 - PchamDB (非公式)` |
| 71 | html_text | `*{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100%}
body{font` |
| 205 | html_text | `📊 タイプ相性表` |
| 209 | html_text | `🎯 チェッカー` |
| 210 | html_text | `⚔️ シミュレータ` |
| 211 | html_text | `⚡ リアルバトル` |
| 212 | html_text | `📋 わざリスト` |
| 219 | html_text | `ばつぐん (×2)` |
| 219 | html_text | `いまひとつ (×0.5)` |
| 220 | html_text | `こうかなし (×0)` |
| 220 | html_text | `空白 = 等倍 (×1)` |
| 221 | html_text | `① 攻撃ベース` |
| 221 | html_text | `行：攻撃わざのタイプ / 列：防御ポケモンのタイプ（単体評価）` |
| 222 | html_text | `デフォルトは` |
| 222 | html_text | `正規順` |
| 222 | html_text | `（公式と同じ並び）。左端の` |
| 227 | html_text | `列でいつでも正規順に戻せます。` |
| 227 | html_text | `「●数」「▲数」「×数」` |
| 227 | html_text | `をクリックすればその多い順 / 少ない順に並べ替え。` |
| 228 | html_text | `右側のリストで「●で抜群を取れる相手」「▲しか入らない相手」「×無効化される相手」が一目で分かります。` |

_…他 78 件_

### `making.html` — 72 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 15 | html_text | `制作の裏側 — Claude Code と1ヶ月で作った話 - PchamDB` |
| 73 | html_text | `.making-hero {
    text-align: center;
    margin: 24px 0 32px;
  }
  .making-he` |
| 241 | html_text | `ホーム` |
| 241 | html_text | `&gt; 制作の裏側` |
| 247 | html_text | `制作の裏側 — Claude Code と1ヶ月で作った話` |
| 248 | html_text | `PchamDB がどうやって生まれたか、ぴ〜ちゃんがお話しします 🐉` |
| 251 | html_text | `🌱 きっかけ` |
| 252 | html_text | `ポケモンチャンピオンズが発表されて、「対戦準備をもっと楽にできるツールがほしい」と思ったのが始まりでした。
    既存の攻略サイトは情報量こそ豊富ですが、対戦` |
| 255 | html_text | `一画面で横並びに見られるツール` |
| 255 | html_text | `がなかなか見つかりませんでした。` |
| 257 | html_text | `「ないなら、自分で作るしかない」── そう思って動き始めたのが2026年4月のことです。` |
| 261 | html_text | `でも、自分はバリバリのエンジニアではない。プログラミングは少しかじった程度。
    1人で全部作るのは正直しんどい。そこで頼ったのが` |
| 263 | html_text | `でした。` |
| 267 | html_text | `広告 / PR` |
| 271 | html_text | `🛠 使ったツール・スタック` |
| 275 | html_text | `コーディングのメインパートナー。CLI でファイル編集・実行まで一気通貫` |
| 279 | html_text | `フレームワークは使わず、素のHTML+JSで実装。静的ホスティングしやすい` |
| 283 | html_text | `無料で独自ドメイン (pchamdb.com) で公開。CDN もついてくる` |
| 287 | html_text | `多言語化のための公式翻訳データ取得元` |
| 290 | html_text | `楽天アフィリエイト` |

_…他 52 件_

### `making_en.html` — 1 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 230 | html_text | `🇯🇵 日本語` |

### `privacy.html` — 72 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 15 | html_text | `プライバシーポリシー - PchamDB` |
| 73 | html_text | `ホーム` |
| 73 | html_text | `&gt; プライバシーポリシー` |
| 77 | html_text | `プライバシーポリシー` |
| 78 | html_text | `最終更新日: 2026年5月11日` |
| 81 | html_text | `(以下「当サイト」) は、ユーザーのプライバシーを尊重し、
    個人情報の保護に努めます。本ポリシーでは、当サイトにおける情報の取り扱い方針を定めます。` |
| 85 | html_text | `1. 取得する情報` |
| 86 | html_text | `当サイトは、以下の情報を取得することがあります。` |
| 88 | html_text | `1-1. アクセスログ` |
| 90 | html_text | `IP アドレス` |
| 91 | html_text | `ブラウザの種類・バージョン` |
| 92 | html_text | `OS の種類` |
| 93 | html_text | `リファラ (どこから来たか)` |
| 94 | html_text | `アクセス日時` |
| 95 | html_text | `閲覧ページ` |
| 97 | html_text | `これらの情報は、サイト運営の改善・統計分析のためにのみ使用します。` |
| 100 | html_text | `当サイトは、ユーザー体験の向上のために Cookie および LocalStorage を使用します。` |
| 104 | html_text | `: チェックリスト機能 (C1/C2/C3 等) の状態を、ユーザーのブラウザ内にのみ保存します。サーバーには送信されません。` |
| 105 | html_text | `: アクセス解析および広告配信のために使用される場合があります (詳細は下記)。` |
| 107 | html_text | `Cookie の受け入れはブラウザ設定で拒否できます。
    Cookie を無効にしても当サイトの基本機能はご利用いただけますが、一部機能が制限される場合が` |

_…他 52 件_

### `privacy_en.html` — 1 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 67 | html_text | `🇯🇵 日本語` |

### `terms.html` — 69 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 15 | html_text | `利用規約 - PchamDB` |
| 73 | html_text | `ホーム` |
| 73 | html_text | `&gt; 利用規約` |
| 77 | html_text | `利用規約` |
| 78 | html_text | `最終更新日: 2026年5月11日` |
| 80 | html_text | `本利用規約 (以下「本規約」) は、` |
| 81 | html_text | `(以下「当サイト」) が提供するサービスの利用条件を定めるものです。
    当サイトをご利用いただく全てのユーザー (以下「ユーザー」) は、本規約に同意した` |
| 85 | html_text | `第1条 (適用)` |
| 86 | html_text | `本規約は、ユーザーと当サイト管理者との間の当サイトの利用に関わる一切の関係に適用されます。
    当サイトに掲載された個別ルール・注意書きは、本規約の一部を構` |
| 91 | html_text | `第2条 (当サイトの性質)` |
| 93 | html_text | `当サイトは非公式ファンサイトです。` |
| 93 | html_text | `任天堂株式会社・株式会社ポケモン・株式会社ゲームフリーク・株式会社クリーチャーズなど、
    ポケモン関連企業とは一切関係ありません。` |
| 97 | html_text | `当サイトに掲載される情報は、ファンが独自に調査・整理したものであり、公式の発表内容と異なる場合があります。
    最新かつ正確な情報については、必ず公式情報源` |
| 103 | html_text | `広告 / PR` |
| 107 | html_text | `第3条 (利用条件)` |
| 108 | html_text | `当サイトのご利用にあたり、ユーザーは以下を遵守するものとします。` |
| 110 | html_text | `本規約および関連する法令を遵守すること` |
| 111 | html_text | `当サイトの運営を妨害する行為を行わないこと` |
| 112 | html_text | `当サイトのデータを商用目的で大量転載・再配布しないこと` |
| 113 | html_text | `他のユーザー・第三者・当サイト管理者の権利を侵害しないこと` |

_…他 49 件_

### `terms_en.html` — 1 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 67 | html_text | `🇯🇵 日本語` |

### `contact.html` — 68 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 15 | html_text | `お問い合わせ - PchamDB` |
| 42 | html_text | `/* Google Forms ボタン */
  .form-cta {
    background: linear-gradient(135deg, #FF` |
| 159 | html_text | `ホーム` |
| 159 | html_text | `&gt; お問い合わせ` |
| 163 | html_text | `お問い合わせ` |
| 164 | html_text | `最終更新日: 2026年5月11日` |
| 168 | html_text | `PchamDB をご利用いただきありがとうございます。` |
| 169 | html_text | `ご意見・ご質問・誤情報のご報告などは、下記のフォームよりお願いします。` |
| 185 | html_text | `Google フォームでお問い合わせを受け付けています` |
| 187 | html_text | `スパム対策のため Google アカウントでのログインが必要な場合があります` |
| 189 | html_text | `お問い合わせフォームへ →` |
| 192 | html_text | `※ 別タブで Google フォームが開きます` |
| 193 | html_text | `※ Google アカウントでのログインが必要な場合があります` |
| 214 | html_text | `広告 / PR` |
| 218 | html_text | `こんなご連絡を歓迎します` |
| 222 | html_text | `誤情報・データの誤りの報告` |
| 223 | html_text | `わざ・とくせい・種族値・タイプ等のデータに誤りがあった場合` |
| 227 | html_text | `機能のご要望` |
| 228 | html_text | `「こんな機能があったら便利」というアイデア` |
| 232 | html_text | `バグ・不具合のご報告` |

_…他 48 件_

### `contact_en.html` — 1 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 138 | html_text | `🇯🇵 日本語` |

### `disclaimer.html` — 66 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 15 | html_text | `免責事項 - PchamDB` |
| 73 | html_text | `ホーム` |
| 73 | html_text | `&gt; 免責事項` |
| 77 | html_text | `免責事項` |
| 78 | html_text | `最終更新日: 2026年5月11日` |
| 80 | html_text | `1. 非公式ファンサイトであることの明示` |
| 82 | html_text | `当サイト「PchamDB」は、ポケモンファンが運営する非公式のファンサイトです。` |
| 82 | html_text | `任天堂株式会社・株式会社ポケモン・株式会社ゲームフリーク・株式会社クリーチャーズなど、
    ポケモン関連企業とは一切関係ありません。` |
| 86 | html_text | `当サイトは、上記企業から運営に関する依頼・許諾・後援等は一切受けておらず、
    また当サイトの内容について上記企業に責任は一切ありません。` |
| 92 | html_text | `広告 / PR` |
| 96 | html_text | `2. 商標および著作権について` |
| 97 | html_text | `当サイトで使用しているポケモン関連の名称・用語等の商標および著作権は、
    各権利者に帰属します。` |
| 102 | html_text | `「ポケモン」「Pokémon」「ポケットモンスター」「モンスターボール」「ポケモンチャンピオンズ」等の名称・ロゴ` |
| 103 | html_text | `作品中に登場するポケモン名・わざ名・特性名・タイプ名・道具名等` |
| 104 | html_text | `キャラクター・ゲーム画面・ゲームタイトル等` |
| 106 | html_text | `これらの権利は、任天堂株式会社・株式会社ポケモン・株式会社ゲームフリーク・株式会社クリーチャーズに帰属します。` |
| 109 | html_text | `一方、当サイトの独自要素 (キャラクター「ぴ〜ちゃん」、サイトデザイン、独自に作成した解説文・データ構造・ソースコード等) の
    著作権は、当サイト管理者` |
| 114 | html_text | `3. 情報の正確性について` |
| 115 | html_text | `当サイトに掲載されている情報については、可能な限り正確を期しておりますが、
    その内容について` |
| 117 | html_text | `いかなる保証もいたしません` |

_…他 46 件_

### `disclaimer_en.html` — 1 件

| 行 | 種別 | 検出文字列 |
|---:|---|---|
| 67 | html_text | `🇯🇵 日本語` |

## 3. ui-*.json と 参照キーの整合性

- 参照キー総数 (HTML data-i18n + JS呼び出し): **153**
- ui-ja.json leaf キー数: **372**
- ⚠️ HTML/JS 参照だが ui-ja.json に **未定義** (1 件):
  - `db.`

- ℹ️ ui-ja.json に存在するが HTML/JS で **未参照** (220 件): _省略可_
  - `buttons.back`
  - `buttons.back_to_top`
  - `buttons.close`
  - `buttons.filter`
  - `buttons.open`
  - `buttons.search`
  - `checker.count_selected`
  - `checker.count_selected_of_total`
  - `checker.ef_exclude_charge`
  - `checker.ef_exclude_recharge`
  - `checker.ef_flag_ball`
  - `checker.ef_flag_charge`
  - `checker.ef_flag_dance`
  - `checker.ef_flag_ohko`
  - `checker.ef_flag_pulse`
  - `checker.ef_flag_punch`
  - `checker.ef_flag_recharge`
  - `checker.ef_flag_slice`
  - `checker.ef_flag_sound`
  - `checker.ef_flag_wind`
  - `checker.ef_label_exclude`
  - `checker.ef_label_flag`
  - `checker.ef_label_misc`
  - `checker.ef_label_opp_down1`
  - `checker.ef_label_opp_down2`
  - `checker.ef_label_self_up1`
  - `checker.ef_label_self_up2`
  - `checker.ef_label_status`
  - `checker.ef_misc_bind`
  - `checker.ef_misc_crit`
  - _…他 190 件_

## 4. 9 言語 ui-*.json のキー集合差分 (vs ja)

| 言語 | キー数 | jaに対する欠損 | jaにない余剰 |
|---|---:|---:|---:|
| ja | 372 | 0 | 0 |
| en | 372 | 0 | 0 |
| es | 372 | 0 | 0 |
| fr | 372 | 0 | 0 |
| de | 372 | 0 | 0 |
| it | 372 | 0 | 0 |
| ko | 372 | 0 | 0 |
| zh-Hans | 372 | 0 | 0 |
| zh-Hant | 372 | 0 | 0 |

## 5. サマリ

- HTML/JS 参照 i18n キー総数: **153**
- 未翻訳日本語検出 (全ファイル合計): **1190** 件
- ui-ja.json 未定義の参照キー: **1** 件
- 9言語間のキー欠損 (vs ja): **0** 件