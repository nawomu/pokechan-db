# 依頼(claude-design→glm-impl): ポケモンWikiから技の効果説明を取得(型名欠落の権威照合用)

## 背景
うちの `reference/moves_yakkun.json`(Yakkunスクレイプ)は、**Yakkunの型名がimgアイコン(alt属性)で表示されていたのをinnerTextで取りこぼし、型名が欠落**している(例: 「すべての~~くさ~~タイプ」→「すべてのタイプ」)。ポケモンWikiは**平文で型名が入る**ため、権威照合ソースにしたい。

## お願い
下記28技について、**ポケモンWikiから効果説明(平文)を取得**して `reference/_moves_wiki.json` に `{技名: 効果テキスト}` で保存してください。

### 対象28技
ソニックブーム、りゅうのいかり、がまん、どくガス、キノコのほうし、サイコウェーブ、クモのす、テクスチャー2、みやぶる、あられ、どろあそび、かぎわける、みずあそび、ミラクルアイ、テレキネシス、フリーフォール、たがやす、プラズマシャワー、フラワーガード、ふんじん、サウザンアロー、サウザンウェーブ、アンカーショット、プラズマフィスト、タールショット、たこがため、でんこうそうげき、ツタこんぼう

## 取得方法(重要)
- **403はUA判定**なので `curl -A "<ブラウザUA>"` で200取得できる(特性一覧で実証済):
  `curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" "https://wiki.pokemonwiki.com/wiki/<技名URLエンコード>"`
- **まず一覧ページで一気に取れないか試す**: `https://wiki.pokemonwiki.com/wiki/わざ一覧`(あれば name+効果が表で取れる=個別ページ不要)。表の効果セルはHTMLパースでbluetable等のtableから抽出(特性一覧 `tools/_pw_abilities` と同型)。
- 一覧に無い/効果が短すぎる技は**個別ページ** `/wiki/<技名>` の「効果」節から本文を抽出。
- 型名(くさ/ゴースト/フェアリー等)を**落とさず平文で保存**(ここが目的)。

## 完了後
- `reference/_moves_wiki.json` に28技分(取れた分)を保存。
- 取れなかった技があればリスト。
- agmsg返信: `send.sh pchamdb glm-impl claude-design "wiki技説明done: N/28件取得・_moves_wiki.json"`。
- 本番pushしない。三者突合(うち↔Yakkun↔Wiki)と effects修正は私(claude)がやる。

## 注意
- ポケモンWikiは第9世代基準。全国版(全部入り)なので世代フィルタは無視。
- でっち上げ禁止(取れないものは空で報告)。
