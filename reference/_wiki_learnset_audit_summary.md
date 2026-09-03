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

## 第2部(2026-09-04): 全国行 955 を「Wiki × Bulbapedia × PokeAPI」の3者投票で確定 → 245行を修正
道具: `tools/_fetch_bulba_learnsets.js`(Bulbapedia種ページ Learnset を裏溜め→`bulba_learn_<種名>.txt`・387種)/ **`tools/_learnset_vote.js`**(投票→`reference/_learnset_vote.json`・`--apply` で `_learnsets_fixes.json` へ)
ルール: 技ごとに **Wiki==Bulbapedia なら採用**(PokeAPIに無ければ learn_add/あれば learn_remove→`learn_legacy`=R10 廃止マーク・消さない)。**W≠B は PokeAPI のまま(保留)**。作品(第8世代の SwSh/BDSP/LA)は両サイトのタブ一致で決め、`latest_version_group` も一致した最新作品へ(`set`)。**Z-A は比べない**(CD制・PP無し)。
集計: changed **245**(SV 145 / SwSh 52 / BDSP 17 / LA 31・`latest_version_group` 更新 27)/ agree(3者一致) 20 / 保留のみ 95 / **za_only 79**(第九世代が Z-A だけの種=ポッポ/ビードル/ズバット/ケーシィ等。Wiki種ページに SV/第8世代表が無い→現状維持)/ no_bulba 495(第1部で ok だった行=取得せず)/ no_bform 2(コラッタ(アローラ)/ラッタ(アローラ)=BDSPに居ない→現状維持)
- 足す 1586 / 外す 409(外した技の大半= どくどく/いびき/おんがえし/ないしょばなし/めざめるパワー/やつあたり/りんしょう=第8世代で廃止・PokeAPI が USUM/LGPE 値のままだった行)
- 保留 176 の系統: Bulbapedia だけがタマゴわざを載せる(くすぐる16/カウンター9/クロスチョップ8/プレゼント6/つじぎり6…)= PokeAPI と同じ(ゲーム内部データ由来)・Wiki は省く → 現状維持(PokeAPI 側=Bulbapedia 側)
- 実測で直した罠: ①Wiki の フォーム見出しは語形が揃わない(ときはなたれしフーパ/すなちのミノ/オス…)→「次の行が世代見出し」で判定 ②「共通」「オス・メス」「〜で共通。」の表は見出し無し扱い ③形別はレベルだけ・TMは共通(シェイミ等)→ 無い種類だけ共通表を足す ④**G=LA は両サイトとも LA 明示の表だけ**(見出し無し=SwSh/BDSP共通表を混ぜると パラスの BDSP技が LA行に入る) ⑤地方のすがた(コラッタ(アローラ))は共通表を流用しない(その作品に居ないだけ) ⑥Bulbapedia の "Red-Striped/Blue-Striped Basculin"・"Standard Galarian Darmanitan"⊃"Galarian Darmanitan"(最長一致)
- 検算: シェイミ/フーパ/ストリンダー/ネクロズマ各フォルムは W=B=PokeAPI が完全一致(=解析が正しい印)。コラッタ BDSP の「ひっさつまえば 外す」は Wiki/Bulbapedia とも第8世代レベル表に無い(Super Fang=**いかりのまえば**は在る。★記憶で「ひっさつまえば=Super Fang」と思い込んだが Wiki で確認したら逆=master が正・CLAUDE.md の警告どおり)
- 🙋 方針確認(現状=採用済み): (a) 進化後にもタマゴわざを載せる(Wiki/Bulbapedia/PokeAPI 全部そう) (b) Z-A を「最新作品」に数えない(za_only 79 は第8世代=BDSP/LGPE 等の値のまま)
