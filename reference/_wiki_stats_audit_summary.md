# 種族値/タイプ/特性 全数照合(ポケモンWiki) — 結果 2026-09-04

道具: `node tools/_wiki_stats_audit.js` → `reference/_wiki_stats_audit.json`(全1273行)。
対象: `master/pokemon.json` 全行(ours_national 941行=PokeAPI一本の値に、独立ソース=ポケモンWiki本文ダンプ `reference/_genus_material/wiki_<種名>.txt` を当てる)。
食い違いは3本目(ヤックン/ch/=Champions正典・PokeAPI・Bulbapedia/Serebii)で決めた。**masterは fixes 経由でしか直していない。**

## 集計(最終)
- 種族値: ok 1270 / NG 1(キバゴ) / no_page 2(メガニャオニクス♀♂=Wikiに単独ページ無し・Champions正典行)
- タイプ: ok 1264 / 並び順違い 15→**修正済み(0)** / Wikiダンプに欄なし 7(別ソースで確認済み・下記)
- 特性: ok 1264 / NG 3(バスラオ3姿=Wikiダンプに隠れ特性行が無いだけ) / Wikiダンプに欄なし 4(別ソースで確認済み)

## 判定
### 修正した(15件・`reference/_pokemon_fixes.json` に根拠つき・同名キーはマージ)
タイプ1/タイプ2の並びが逆だった champions_authority 行: ロトム5姿(でんき/○)・シャンデラ(ゴースト/ほのお)・マッギョ(じめん/でんき)・ウルガモス(むし/ほのお)・ヌメルゴン(ヒスイ)(はがね/ドラゴン)・オンバーン(ひこう/ドラゴン)・ジジーロン(ノーマル/ドラゴン)・アーマーガア(ひこう/はがね)・アヤシシ(ノーマル/エスパー)・キラフロル/メガキラフロル(いわ/どく)。
3ソース一致(ヤックン/ch/ タイプ欄 alt・Wiki infobox・PokeAPI slot)。バトル計算は順不同だが表示の正しさのため。views_diff は multiset(順序違い)として説明済み=UNEXPLAINED 0。

### 修正しない(masterが正)
- **キバゴ HP**: master 46 / Wiki本文 48(合計322)。Bulbapedia「base stat total of 320」・Serebii「Base Stats - Total: 320」・PokeAPI hp 46 → **Wikiの誤記**。masterのまま。

### Wikiダンプに欄が無く別ソースで確認した(masterが正・7行+3行)
- バスラオ3姿: タイプ みず=ヤックン/ch/ n550/n550f/n550w 一致。特性 すてみ|いしあたま|びびり + てきおうりょく + 隠れ かたやぶり=ヤックン/ch/ 一致(Wikiダンプは隠れ特性行が欠落)
- イルカマン(ナイーブ/マイティ): みず・マイティチェンジ=ヤックン/ch/ n934/n934f 一致
- コレクレー(はこ): ゴースト・びびり=ヤックン/ch/ n976 一致 / コレクレー(とほ): ゴースト・にげあし=PokeAPI(gimmighoul-roaming)+Wiki本文(にげあし記載あり)
- フーパ(いましめ/ときはな): マジシャン=ヤックン/ch/ n720/n720u 一致(隠れ特性なし)

## 次(A3)
同じWikiページの「おぼえるわざ」表で `master/learnsets.json` を全数照合する。
