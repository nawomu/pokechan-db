# 全角英数字 残存監査 (2026-09-04)

対象: `master/*.json` / `i18n/*.json`(キー・値) / `reference/_*_additions.json` `_*_fixes.json` `_pokemon_notes.json` / 生成物 `pokechan_data_all.js` `pokechan_data.js` `items_database.js` / 主要ページ(`*.html` 直下)。
検出パターン: `０-９` `Ａ-Ｚ` `ａ-ｚ` `％` `＋` `－`。機械抽出は `/private/tmp/.../scratchpad/scan_zenkaku.py`(JSON構造を再帰的に歩く)+ 各HTMLの正規表現抽出で実施。**読むだけ**(このmdと候補jsonの2ファイルのみ新規作成・既存ファイルは無編集・無コミット)。

---

## ① 結論と件数

**生の一致件数**: JSON系(master/reference/i18n) 4541件 + HTML直書き 994件(うち`items_db_all.html`が898件) ≒ **合計5535件のヒット文字**。機械候補ファイル `reference/_zenkaku_candidates_2026-09-04.json` には5001エントリを収録(HTML側は代表箇所を行単位で抽出、i18nの装飾用「＋」記号は件数のみ報告に留め候補には未収録=下記⑤参照)。

件数は多いが、**実体は少数の"型"に集約できる**。重要度順に:

### 最重要(1) — ツール自身の`zen2han()`が「％＋－」を扱えていない(根本原因)
`tools/build_master_v2.js` `build_views.js` `_views_diff.js` `_watch_official_news.js` `_legacy_asset_test.js` の**5箇所**に個別実装された `zen2han()` はいずれも
```js
s.replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
```
で、**％(ＦＦ０５)・＋(ＦＦ０Ｂ)・－(ＦＦ０Ｄ)を1文字も変換しない**。`tools/build_i18n_entities.js` だけ`％`を追加済みだが＋－は無し。CLAUDE.mdの2026-08-01ルールが挙げる例そのもの(「１０％フォルム」)が**ツール側の非対応で今も残る**理由がこれ。→ ④で最優先の直し方として提示。

### 最重要(2) — `master/abilities.json` の唯一のアビリティ名残存 = 生きた名寄せ不一致バグ
`master/abilities.json` の `names.ja`(id無し, slug=`rks-system`)が全角「**ＡＲシステム**」のまま(313件中これ1件だけ)。ところが:
- `master/pokemon.json` No.773 シルヴァディの `ab1` は既に半角「ARシステム」(`reference/_pokemon_fixes.json`で2026-08-01ルールに沿って修正済み)
- 静的生成済みコンテンツページ `ability/ARシステム.html` / `pokemon/silvally.html` / `ability/index.html` も全て半角
- `reference/_pokemon_fixes.json` の当該fixの根拠文には「abilities.jsonは全角『ＡＲシステム』を統合済み(313→312件)」と書かれているが、**実際のabilities.jsonは今も313件でこの1件は未統合**。この根拠メモ自体が「やったはずが実は反映されていない」ことを示す状態証拠。

→ `pokemon.ab1`↔`abilities.names.ja` は完全一致文字列で結合される設計(`tools/build_master_v2.js`が`names.add(p[k])`等で名前突合)なので、**このズレは次回フル再ビルド時に静かに特性データが引けなくなる型のバグ**(CLAUDE.mdが名指しする「フラエッテナイト/いじげんラッシュ/i18n468件」と同型)。しかも**単純にabilities.jsonを書き換えても再ビルドで消える**(下記③④)。

### 最重要(3) — 旧版ページが今も全9言語ホームからリンクされている
`items_db_all.html`(898件ヒット。中身は「わざマシン０１」等**全角のみ・全1219件データ**でmaster/items.jsonの範囲外=完全孤立)が、**index.html含む全9言語トップページ**からリンクされている。SSOT対応版 `items_db_all_v2.html`(0件ヒット・`pokedb.js`読込)は既に存在するが**ナビからは未昇格**。`moves_db_all.html`(16件, `sitemap.html`のみからリンク)と`pokemon_db_all.html`(5件, ナビはv9系に切替済みでこちらは孤立ページだがまだ物理的に存在しクロール可能)も同型の「作り直し完了・入れ替え未了」。

### 主要パターン一覧(件数)

| # | パターン | 件数 | 状態 |
|---|---|---|---|
| A | i18n辞書: 全角キーが424種×最大8言語ファイル | 3392 | ほぼ**孤立**(下記③) |
| B | i18n辞書: 値側の全角(中国語Ｚ/Ｘ/Ｙ/Ｑ/％表記・「＋」装飾・メタログ) | 966 | 要判断(下記⑤⑥) |
| C | `master/items.json` `flavor_ja`(公式フレーバーテキスト内のＨＰ/ＰＰ/数字) | 75 | 出典に忠実な可能性あり(下記⑥) |
| D | `master/items.json` `names.zh-Hant/zh-Hans`(メガストーン・Zクリスタル計38品目×2言語) | 66 | 中国語表記慣習の可能性(下記⑥) |
| E | `master/abilities.json` `desc_house`(自前要約文中のＨＰ/２倍/５ターン等) | 16 | 明確に違反(自前文=言い訳なし) |
| F | `master/pokemon.json` 本体(名前2件×2欄+genus_ja 5組×2件) | 14 | 一部は孤立キー化の火種 |
| G | `master/learnsets.json`(pokemon.jsonの重複) | 4 | Fと同期 |
| H | `reference/_*_fixes.json` 内の根拠文・引用 | 5 | 引用は改変注意(下記⑥) |
| I | `items_db_all.html` 直書き(旧版・全9言語ホームからリンク) | 898(449品目) | 最優先(上記) |
| J | `moves_db_all.html` 直書き(旧版・sitemapのみ) | 16(8技) | masterは既に修正済み・生成が古いだけ |
| K | `pokemon_db_all.html` 直書き(旧版・ナビは既にv9へ) | 5(2体+1特性) | 一部はmaster自体が未修正 |
| L | UI装飾の「＋」記号(追加ボタン等) | 約60 | 名寄せ対象外・デザイン判断(下記⑤) |

---

## ② 全件表(代表・グループ単位)

*(全件の実インスタンスは `reference/_zenkaku_candidates_2026-09-04.json` に5001行で収録。ここでは人が読める粒度でグループ化。)*

### F. `master/pokemon.json` 本体(全14件)

| キー | 現在値 | 半角化 | 全角が正典の可能性 | 影響(grep実測) |
|---|---|---|---|---|
| No.201 `name`/`display_name` | アンノーン(Ａ) | アンノーン(A) | 不明(Unownの代表フォーム表記。ゲーム内表記は文字1つのみでＡ/A表記の公式一次資料は未確認) | `pokemon/unown.html``pokemon/all.html``master/learnsets.json``sprite_api_ids.js``pokechan_data_all.js``i18n/*.json`(8言語, キーも全角)。全て現状"全角で統一"なので**今は不整合なし**だが直すなら全箇所同時 |
| No.474 `name`/`display_name` | ポリゴンＺ | ポリゴンZ | 不明(公式ロゴはZ、テキスト表記は資料により揺れる) | `pokemon/porygon-z.html``type/ノーマル.html``ability/てきおうりょく.html``ability/ダウンロード.html``ability/アナライズ.html``master/learnsets.json``sprite_api_ids.js``pokechan_data_all.js``i18n/*.json`(8言語)。**同No.233「ポリゴン２」は既に「ポリゴン2」へ修正済み**(2026-08-01ルール適用済み)なのに474だけ未適用=**適用漏れ** |
| genus_ja ×2件(No.90/91系) | ２まいがいポケモン | 2まいがいポケモン | なし(数字は単なる個数) | `i18n/genera.*`(8言語) |
| genus_ja ×2件(サイホーン系) | １ぽんヅノポケモン | 1ぽんヅノポケモン | なし | 同上 |
| genus_ja ×2件(サンドパン系?) | ２ほんキバポケモン | 2ほんキバポケモン | なし | 同上 |
| genus_ja ×4件(ポリゴン系) | ＤＮＡポケモン | DNAポケモン | なし | 同上 |

### master/abilities.json(全19件)

| フィールド | 件数 | 現在値(例) | 全角が正典の可能性 |
|---|---|---|---|
| `items[0].names.ja`(rks-system) | 1 | ＡＲシステム | **無し**。同ability の英語圏名・pokemon.json側・生成済みページが軒並み半角。全角はここ1箇所だけの取り残し |
| `items[0].names.zh-Hant/zh-Hans` | 2 | ＡＲ系統/ＡＲ系统 | 上と同じ理由で無し |
| `desc_house`(自前要約文) | 16 | 「ＨＰが半分になると…」「いつもの２倍」「５ターンのあいだ」等 | **無し**。desc_houseは公式原文コピーでなく自社の短文要約(CLAUDE.mdの「独自作成」対象)なので言い訳が立たない |

### master/items.json(全141件)

| フィールド | 件数 | 全角が正典の可能性 |
|---|---|---|
| `flavor_ja`(公式ポケッチ/道具袋のフレーバーテキスト) | 75 | **中〜高**。PokeAPIの`flavor_text_entries`(ja)を`fill()`でそのまま転記(`tools/build_master_v2.js` L512)。歴代ゲームのテキストボックスは全角固定幅フォントで「ＨＰ」「１０」等を全角表示していた版が実在し、**原文の忠実な転記である可能性が高い**。ただしCLAUDE.mdの「英数字は半角で統一」は説明文も対象と明記しており、当サイトの表示ルールとしては半角化が筋 |
| `names.zh-Hant`/`names.zh-Hans`(メガストーンX/Y・Zクリスタル全34種+マイナー2種、計66件) | 66 | **不明〜中**。中国語圏の公式/大手Wiki表記では英字1文字を全角(ＸＹＺ)で埋め込む組版慣習が見られることがある。今回は未検証(中国語一次資料への到達なし)。全角のまま統一されている(半角と混在していない)ため**意図的な選択の可能性を排除できない**→断言せず要確認 |

### 学習セット(learnsets.json) — 4件
`アンノーン(Ａ)`・`ポリゴンＺ`の `name`/`display_name` 重複(pokemon.jsonと同期して直す対象。学習セット単独の別データではない)。

### reference/_*_fixes.json 内 — 5件
- `_abilities_fixes.json` の `authority.desc_add_quotes[].quote`(3件): 「50％」「50％以上」「ジガルデ(10％フォルム)」を含む**引用文**。これは監査時に外部権威資料から引いた"根拠の直接引用"であり、**引用元が実際に全角で書かれていたかどうかを確認せずに正規化すると引用の正確性が崩れる**。要確認、断定不可。
- `_pokemon_fixes.json` の「根拠」欄(1件): 上記★最重要(2)で詳述。データ値ではなく監査メモ内の説明文だが、内容自体が誤り(未完了の作業を完了と記載)なので**是正対象**。
- `_moves_fixes.json`(1件): Bulbapedia URLの一部に`(move)`があるだけの誤検出(半角括弧内の英字だが、URLなので対象外・ノイズ)。

### 生成物(pokechan_data_all.js / pokechan_data.js) — 6件
全てmaster側の残存(F・abilities)がそのまま透過しているだけ。**masterを直して`node tools/build_views.js`を再実行すれば自動的に消える**(生成物側を直接編集する必要はない=CLAUDE.mdのSSOT原則どおり)。`items_database.js`は0件(クリーン)。

### items_db_all.html(旧版・898件=449品目)
`master/items.json`(423件・持てる道具のみ)には存在しない**わざマシン(TM,173)・わざレコード(TR,100)・ひでんマシン(HM,8)・アメ類(17)・データカード(27)・その他(124=きのみバッジ/鍵/メールキー/ブーストアイテム旧名/メガストーン旧名/Zクリスタル/でんせつのメモ等)**が全角のまま直書きされた**独自データ表**(pokedb.js/items_database.jsを一切読まない=CLAUDE.mdの「ページ専用データを作るな」に抵触する旧設計)。**全9言語のトップページからリンクされている現役ページ**。

### moves_db_all.html(旧版・16件=8技)
`10まんボルト` `テクスチャー2` `Vジェネレート` `DDラリアット` `10まんばりき` `1000まんボルト` `Gのちから` `3ぼんのや` — **master/moves.jsonは全て既に半角化済み**であることを確認。ページ生成が2026-08-01ルール適用より前のスナップショットで止まっている(**再生成すれば直る**)。

### pokemon_db_all.html(旧版・5件=2体1特性)
`ポリゴン２`(masterは既に修正済み=ページが古い)/`ポリゴンＺ``ＡＲシステム`(masterも同じく未修正=両方直す必要)。

---

## ③ 孤立キー表(i18n辞書のキーがmasterの現在値と一致しない)

`i18n/*.json` は**日本語の正典名をキーに使う**設計。masterが半角化されるとキーが追従していない限り"読者には旧仮名(全角)の見た目のまま"にはならない(コードは通常"現在のmaster値"でキーを引くので、масterが半角に直った瞬間そのキーの翻訳は「見つからずJP直書きにフォールバック」になる=i18n漏れの実害)。

### ③-1. 実害あり(masterは既に半角化済みなのに、i18n辞書には全角キーだけが残っている=死んだ孤立エントリ)

| 全角キー(孤立) | 対応する現行(半角)キーの有無 | 対象言語ファイル |
|---|---|---|
| `pokemon.ポリゴン２` | ○ `pokemon.ポリゴン2` は既存 | ja以外の8言語ファイル全て(en/fr/de/es/it/ko/zh-Hant/zh-Hans) |
| `pokemon.イッカネズミ(４ひきかぞく)` | ○ `pokemon.イッカネズミ(4ひきかぞく)` は既存 | 同上8言語+`_meta.synthesized`ログ6件 |
| `pokemon.ジガルデ(５０％フォルム)` / `〈zygarde-50-power-construct〉`付き | ○ `pokemon.ジガルデ(50%フォルム)` は既存 | 同上8言語 |
| `pokemon.ジガルデ(１０％フォルム)` / `〈zygarde-10〉`付き | ○ `pokemon.ジガルデ(10%フォルム)` は既存 | 同上8言語 |
| `pokemon.50％フォルム` / `pokemon.10％フォルム`(単独ラベル) | 半角版キーが見当たらない(コード側からの参照も未検出=用途不明・死蔵の可能性) | 同上8言語 |

→ この5パターン×8言語 ≒ 44件は**今すぐ削除して安全**(現行コードはどれも半角キーで引いており、全角キーは既に誰からも参照されていないゴミ)。

### ③-2. 未実害だがmaster側修正時に連動しないと新たに孤立化する(現在はmasterも全角のまま=一致)

| キー | master現在値 | 備考 |
|---|---|---|
| `abilities.ＡＲシステム` | 一致(全角) | ★最重要(2)。master修正と**同じコミットで**キーも半角化必須。片方だけ直すと即座に孤立化する |
| `pokemon.アンノーン(Ａ)` | 一致(全角) | 同時対応が必要 |
| `pokemon.ポリゴンＺ` | 一致(全角) | 同時対応が必要 |
| `genera.２まいがいポケモン` `genera.１ぽんヅノポケモン` `genera.２ほんキバポケモン` `genera.ＤＮＡポケモン` | 一致(全角) | 同時対応が必要(4種×8言語=32件) |

### ③-3. 構造的孤立(masterの現行スコープに対応物が存在しない=旧世代アイテムカタログの残骸)

`items.*` 名前空間の**424キー中410キー**が該当。`master/items.json`は423件の「持てる道具」のみをスコープにしており、以下のカテゴリはそもそも収録範囲外:

| カテゴリ | 件数(ユニークキー) | 例 |
|---|---|---|
| わざマシン(TM) | 172 | `items.わざマシン０１`〜`１７１`, `わざマシン００` |
| わざレコード(TR, 第9世代) | 100 | `items.わざレコード００`〜`９９` |
| ひでんマシン(HM) | 8 | `items.ひでんマシン０１`〜`０８` |
| アメ類(けいけんアメ/げんきのアメ 等) | 17 | `items.けいけんアメＸＬ` 等 |
| でんせつのメモ/はいたつぶつ/ひきかえけん | 9 | `items.でんせつのメモ１`〜`３` 等 |
| その他(旧メガストーン名・Zクリスタル種族専用名・データカード・ブースター旧名・鍵・メール等) | 約104 | `items.リザードナイトＸ` `items.ノーマルＺ` 等 |

これらは`items_db_all.html`(②参照)の直書きテーブルと1対1で対応しており、**「旧・全部入り持ち物DB」がi18n辞書とHTMLの両方に生き残っている**構図。現行コードからの参照は確認できず(`grep`で items_database.js / master/items.json / tools/*.js に該当なし)、**実害は現状ゼロだがサイズの90%以上を占めるデッドウェイト**。

---

## ④ 直し方の提案

### 優先度1: `zen2han()` ユーティリティ自体の拡張(根本原因への対処)
`tools/build_master_v2.js`(L92)・`build_views.js`(L20)・`_views_diff.js`(L17)・`_watch_official_news.js`(L40)・`_legacy_asset_test.js`(L101)の正規表現に `％＋－` を追加:
```js
/[０-９Ａ-Ｚａ-ｚ％＋－]/g
```
(コードポイント差分は`０-９Ａ-Ｚａ-ｚ`と同じ`-0xFEE0`で成立。`％`→`%`、`＋`→`+`、`－`→`-`も同じ式で変換できることを確認済み)。5箇所に別々の実装がコピペされている状態自体もDRY違反なので、余裕があれば共通モジュール化(`tools/_lib_zen2han.js`等)を検討。**これをやらないと、今回検出した個別データを直しても新規データ追加のたびに同じ穴から全角％＋－が再侵入する**。

### 優先度2: `master/abilities.json` の`ＡＲシステム`(★最重要2)
**単純に`reference/_abilities_fixes.json`に書いても効かない**ことを確認済み — `tools/build_master_v2.js`のfixes適用ロジック(L237-243)は`effect_ja`/`name_en`しかホワイトリストしておらず、しかもその後(L281)で`it.names = o.names;`が`reference/_old_master/abilities_master.json`から**names全体を無条件上書き**するため、そこで全角に戻る。恒久修正には次のいずれかが必要:
1. `tools/build_master_v2.js` L283 `it.names = o.names;` を `it.names = Object.assign({}, o.names, {ja: zen2han(o.names.ja), 'zh-Hant': zen2han(o.names['zh-Hant']), 'zh-Hans': zen2han(o.names['zh-Hans'])});` のように**代入時に正規化**する(推奨・同じ穴からの再侵入も防げる)
2. `reference/_old_master/abilities_master.json`(PokeAPI由来の中間ファイル)のjaフィールド自体を直接正規化する(中間ファイルなのでmasterの絶対ルール違反にはならないが、次回PokeAPI再取得で戻る可能性あり)
3. `_abilities_fixes.json`の適用ロジックに`names`キーのサポートを追加する

**同じコミットで** `i18n/*.json` の `abilities.ＡＲシステム` キーも `abilities.ARシステム` へリネームする(③-2参照。片方だけ直すと孤立キー化する)。

### 優先度3: `master/pokemon.json` のNo.201/No.474 + genus_ja 5組
こちらは`_pokemon_fixes.json`の`set`方式がそのまま使える(シルヴァディの`ab1`修正と同じ仕組み。効果は`Object.entries(f.set).forEach(([k,v])=>it[k]=v)`で任意フィールドを上書きできることを確認済み)。入口:
```json
"fixes": {
  "アンノーン(Ａ)": { "set": { "name": "アンノーン(A)", "display_name": "アンノーン(A)" } },
  "ポリゴンＺ": { "set": { "name": "ポリゴンZ", "display_name": "ポリゴンZ" } }
}
```
genus_jaも同様に`set`で足せる。**同じコミットでi18n該当キー(③-2)も改名**、かつ`master/learnsets.json`は`pokemon.json`から派生転記されているため`build_master_v2.js`再実行で自動追従するか要確認(手で二重に直さない)。

### 優先度4: `master/items.json` flavor_ja・desc_house
- `desc_house`(自前文16件)は`_abilities_fixes.json`の`effect_ja`と違うフィールドなので**現状のfixesホワイトリストに`desc_house`を追加するコード修正が先に必要**(items系`_items_fixes.json`も同様に`flavor_ja`/`names.zh-*`がホワイトリスト外=L449の`['name_en','category','effect_ja','champions_added_in']`に無い)。
- `flavor_ja`(75件)は優先度1のzen2han拡張後、PokeAPI転記時(`tools/build_master_v2.js` L512 `fill('flavor_ja', ...)`)に`zen2han()`を通す一括対応が現実的(75件を個別fixesで書くのは非効率)。ただし**公式原文の全角表記を保存する価値があるかは阿部さんの判断を仰ぐ**(⑥参照)。

### 優先度5: 旧版ページの入れ替え(データ修正ではなくページ運用の話)
- `items_db_all.html`→`items_db_all_v2.html`へ**全9言語ホーム+index.html+sitemap.htmlのリンク差し替え**、確認後に旧版削除(CLAUDE.mdの「新版が確かめられてから旧版を消す」手順どおり)。TM/TR/HM/アメ等は**現行items.jsonのスコープにそもそも無い**ため、v2へ完全移行するなら「持てる道具」の外側にあるこれらの分類をmasterに残すかどうかの設計判断が別途必要(このカテゴリの424個のi18nキー・898件のHTML直書きは、その判断が出るまで塩漬けでよい)。
- `moves_db_all.html`は`node tools/build_views.js`相当の再生成(またはこのページ専用の生成器)を再実行するだけで直る可能性が高い(masterは既に正しい)。生成コマンドの特定が必要(このページの生成器がbuild_views.jsに統合されているか未確認・要調査)。
- `pokemon_db_all.html`はナビから既に外れているため実害は低いが、リンク切れではなく生きたURLとして残っているならindex.htmlのv9系と同様に旧版として削除対象に含めるか判断要。

### 優先度6(低): i18n孤立キーの掃除
③-1(44件、実害なし=死蔵)は削除して問題なし。③-3(410キー)はitems.jsonのスコープ設計判断が先。

---

## ⑤ 保留: UI装飾の「＋」記号(件数概算60件)
`battle_lab.html``real_battle_simulator.html``battle_simulator.html``online_battle.html``damage_calc.html``party_checker.html``fx_editor.html``pokemon_db_v9.html``pokemon_db_all_v9.html``index.html``builder_guide.html`+`i18n/ui-*.json`(9言語)+`i18n/_ui_sweep_result.json`。いずれも「追加」ボタンやHP/ダメージのポップアップ演出に使う**装飾グリフ**で、名前・技名・データキーとしての名寄せには一切関与しない(grep実測で他ファイルからこの文字列を"キー"として参照している箇所は無し)。半角"+"に変えると見た目の太さ/字幅が変わるため**デザイン上の選択**であり、機械的な一括置換は勧めない。ルールの文言上は違反だが、影響ゼロ・意図的な可能性ありとして本監査では**候補jsonに含めず、件数のみ報告**。要否は阿部さんの判断事項。

## ⑥ 保留: 出典忠実性が疑わしい3件
1. `master/items.json.flavor_ja`(75件) — 公式フレーバーテキストの転記。全角ＨＰ等が原文の可能性(中〜高confidence、未検証)
2. `master/items.json.names.zh-Hant/zh-Hans`(66件) — 中国語表記慣習の可能性(不明、未検証。中国語一次資料へのアクセスなし)
3. `reference/_abilities_fixes.json` の`authority.desc_add_quotes[].quote`(3件) — 外部権威資料からの直接引用。引用元の実際の表記を確認せず正規化すると引用の正確性が崩れるおそれ

いずれも「記憶で断言せず権威ソース確認 or 阿部さんに聞く」(CLAUDE.md北極星)に該当するため、本監査では**「不明」のまま**報告し、候補jsonでは`to`列(半角化案)は機械変換した値を参考として入れてあるが、**適用は推奨しない**。
