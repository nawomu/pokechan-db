# 覚える技(master/learnsets.json)全数照合 — 結果まとめ(A3・2026-09-04)

道具: `tools/_fetch_wiki_champions_learnsets.js`(Wiki「<種名>/Pokémon Championsのおぼえるわざ」を裏溜め→`reference/_genus_material/wiki_ch_learn_<種名>.txt`・208種)
　　 `tools/_wiki_learnset_audit.js`(監査のみ → `reference/_wiki_learnset_audit.json`)
修正の入口: **`reference/_learnsets_fixes.json`(新設・learn_add/learn_remove・根拠つき)** → `build_master_v2.js buildLearnsets` の最後で適用(同名キーはマージ)

## Champions行 318(出典=ヤックン/ch/ 1本だった) → 第2ソース=ポケモンWiki Championsページと集合比較
- **316/316 一致**(2 no_page = メガグソクムシャ/メガセグレイブ=M-C予告分・Wikiにまだページ無し)
- 食い違い1件 → 修正済み: **ランクルス パワースワップ**
  - ヤックン/ch/zukan/n579: 『パワースワップ[マシン60(剣盾)] …12×』(×=Championsで使えない → うちは confiscated)
  - ポケモンWiki Championsのおぼえるわざ: 66技・**あり** / Bulbapedia『Reuniclus (Pokémon)/Champions learnset』: 本表66技・**あり**(Inaccessible moves 7技には無い)
  - 2対1 → learn に戻した([[two-source-verify-then-commit]])。実機で確かめられたら根拠に追記
- フォーム対応: ロトム6/ニャオニクス♂♀/地方のすがた/メガ(元の表を使う)は全部一致
- ★Wikiの Champions表は **PP が Champions値**(10まんボルト16 等)= `master/moves.json` の pp 第2ソースにも使える(次の宿題)

## 全国行 955(出典=PokeAPI暫定・`latest_version_group`)→ Wiki種ページ「おぼえるわざ」最新世代表と比較
集計: ok 512 / diff 321 / wiki_newer 107 / no_form 15
- **wiki_newer 107**: Wikiの最新世代 > うちの作品(例: ポッポ=PokeAPI最新 LGPE だが Wikiは第九世代=SV DLC藍の円盤で追加)。
  内訳 SwSh→9: 57 / LA→9: 13 / USUM→9: 12 / USUM→8: 13 / LGPE→9: 6 / LGPE→8: 6。**PokeAPIのDLC/BDSP/LA 学習データ欠け**=learn が古い作品の値
- **diff 321** の系統(暫定分析・未修正):
  1. PokeAPIが SV で消えた技を残している: くすぐる(16行)/プレゼント 等 → Wikiに無い(=SVで使えない)。master_only
  2. Wikiは進化後にもタマゴわざを載せる(ニドリーナのカウンター等)が PokeAPI は基本形だけ → wiki_only[egg]
  3. SwSh行: 教え技(tutor)/DLC技が PokeAPI に無い(ポニータ(ガラル)のひのこ等)
  4. LA行(52): PokeAPI の LA 学習データが大きく欠ける(パラス/ベロリンガ等 level+tutor が丸ごと無い)
  5. サンドパン(アローラ)等: PokeAPI SV のレベル技が部分欠け
- ★方針(要設計・次): 全国行の出典を「PokeAPI→Wiki(最新世代表)」に替えて PokeAPI を第2ソースに回すのが筋(足りないから別を作らず、一つの器の中身を正しい方に寄せる)。
  食い違いは Bulbapedia(第3)で決める。Z-A表(第九世代扱い)は SV と混ぜない(監査器は除外済み)。`learn_legacy`(廃止技)は R10 どおり残す
