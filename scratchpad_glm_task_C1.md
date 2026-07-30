# GLM実装タスク C1: ポケモン一覧ページに絵2種並記 + 全国版一覧ページ新設

役割: 設計=Claude/実装=あなた(GLM)/検証=Claude/声=阿部さん。

## 0. まず読む
- `CLAUDE.md`(★多言語化ファースト節)

## 1. 編集してよいファイル(厳守)
- `tools/_gen_content_pages.js`
- `i18n/content-ui.json`(9言語キー追加)
- **生成済みHTMLは直接編集しない**(生成はClaude側で実行)。git commit/push禁止。

## 2. 背景(調査済み事実・行番号は現状)
- 一覧ページ生成 = `genPokemonIndex(lang)`(tools/_gen_content_pages.js:334-376)。行生成335-344、ヘッダ361-366。テーブル形式。**現在画像なし**。
- クライアントJS `listJs`(137-178)はソートで `children[idx]` の**列インデックスに依存**(children[0]=No前提)→列を足すならインデックス調整必須。
- データ源 `POKE = d.POKEMON_LIST`(14行・Champions 313体・ja名のみ・PokeAPI idなし)。
- 全国版データ = `reference/master_pokemon.json`(1365エントリ)。各: `{id(PokeAPI id), slug, dex, is_mega, form_slug, names{ja,en,…9言語}, types[], stats{hp,atk,def,spa,spd,spe}, abilities[], legend, champions}`。`champions!=null`が313体。
- 画像2種(全1365エントリで存在確認済み):
  - オリジナル絵: `images/sim/{names.ja}.svg`(onerrorで`.png`フォールバック→無ければremove。パターン=real_battle_simulator.html:7631)
  - APIスプライト: `images/poke/{id}.png`(onerrorでGitHub raw `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png` フォールバック。パターン=pokemon_db_all.html:38)
- Championsの PokeAPI id は POKEMON_LIST に無い→ master_pokemon.json を読み、`names.ja`→`id` のマップを作って引く(313体はchampions!=nullで対応取れる)。
- ラベルは `i18n/content-ui.json` に9言語で追加必須(未登録キーは `_content_i18n.js:42` がthrow)。

## 3. やること
### (A) 既存 `/pokemon/` 一覧(genPokemonIndex)に画像2列を追加
- 各行の**名前の左**に2枚: ①オリジナル絵(images/sim/{ja名}.svg) ②APIスプライト(images/poke/{id}.png+rawフォールバック)。サイズは高さ44px程度・lazy load(`loading="lazy"`=1ページ313行×2枚あるので必須)。
- 列を足したぶん `listJs` のソート列インデックスを修正(数値列のidxずれ注意)。
- ヘッダに画像列(ラベル例: `col_art`=「絵」/`col_sprite`=「公式」…キー名は任意、content-ui.jsonに9言語追加)。
- ページ下部かリード文近くに **PokeAPIクレジット**(既存 `pokemon_db_all.html` のクレジット文面を踏襲。「Images: PokéAPI」リンク)。

### (B) 全国版一覧ページ新設: `pokemon/all.html`(ja) / `{lang}/pokemon/all.html`
- 新関数 `genPokemonAllIndex(lang)` を追加し、実行ループ(419-427)に組み込む。
- データ= master_pokemon.json 全エントリ(1365)。**ja名で重複するフォームは1行に間引く**(names.jaのSetで初出のみ=約1330行)。
- 列: 絵(オリジナル) / 公式スプライト / No(dex) / 名前 / タイプ / 合計種族値 …既存一覧に準じつつ簡素でよい。技/特性列は不要。
- 名前の多言語は master の `names[lang]`(あれば)→ja フォールバック(i18n辞書を通さなくてよい=masterに9言語入ってる)。
- **個別ページへのリンクは champions!=null の313体だけ**(全国版の個別ページは存在しないため。リンク無しはプレーン表示)。
- 検索ボックス+タイプフィルタは既存 listJs を流用できる範囲で(無理に凝らない。検索だけでも可)。
- 既存 `/pokemon/index.html` から all.html への案内リンク(「全国版一覧(全ポケモン)」)と、all→index への戻りリンク。ラベルはcontent-ui.jsonに9言語。
- hreflang は既存 `hreflang()` の作法に合わせて all.html 用にも出す。
- タイトル/リード文もi18n(例: `pokemon_all_list`=「全国版ポケモン一覧」/`pokemon_all_lead`)。

### (C) i18n キー追加(content-ui.json・9言語)
- 追加するキー全部(col_art/col_sprite/pokemon_all_list/pokemon_all_lead/link_to_all/link_to_champions 等、命名は任意)を ja+en+fr+de+es+it+ko+zh-Hans+zh-Hant で。シンプルなUI語なので自然な訳でよい(公式ゲーム用語はでっち上げない=「全国図鑑」はNational Pokédex等の通用語を使う)。

## 4. 検証(できる範囲で)
- `node -e 'require("./tools/_content_i18n.js")'` 等でJSON構文チェック。
- `GEN_LANGS=ja node tools/_gen_content_pages.js` をドライ実行して throw しないこと(できれば。実行が承認ゲートで無理ならClaudeに回す)。

## 5. 報告
変更関数と行・追加i18nキー一覧(ja/en値)・listJsインデックス調整の内容・生成テスト結果・残点。**commitしないで停止。**
