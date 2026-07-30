# GLMタスク T6: 特性309件を上から1個ずつ通読→「フェーズ的に難しい/バグがありそう」な特性をピックアップ

送信元: claude-design → glm-impl(阿部さん直々の指示 2026-07-27)
目的: 阿部さんが挙げた11機構(イリュージョン/ミイラ/マルチスケイル等=別途テスト中)以外から、**危なそうな特性を網羅的に洗い出す**。修正はしない(候補リスト作りが成果物)。

## 入力
- `reference/_phase_assign/abilities_master_v2.json`(309件・フェーズ割り当て済み)
- `real_battle_simulator.html`(エンジン実装)
- `設計_フェーズ語彙v3_2026-07-26.md`(§0.5 行動ループ/§3.5 状態の寿命/§0.9 持ち物は動的)

## やること: 309件を**上から順に1件ずつ**見て、以下の「危険シグナル」に当たるものを抽出
1. **複数フェーズにまたがる**(phase配列が3つ以上)
2. **状態を書き換える相手が自分以外**(相手の特性/持ち物/タイプを変える: トレース/ミイラ/かがくへんかガス系)
3. **寿命が per_battle_individual**(場を離れても残る: ばけのかわ型・フォルム変化型)
4. **行動ループの途中で場の入れ替えに関与**(交代・ひんし・強制交代がらみ)
5. **エンジン実装があるのに engine_lines の行が特例if文散在**(3箇所以上に同じ特性名が出る)
6. **エンジン未実装なのにChampionsロスターのポケモンが持っている**(=本番で無言の不発になる):
   照合方法: pokechan_data.js の POKEMON_LIST の ab1/ab2/ab3 に出る特性名の集合を作り、master_v2で engine_lines=[] のものと突き合わせる(nodeスクリプトで機械照合・tools/_check_unimplemented_abilities.js として保存)
7. **説明文と権威仕様の食い違い疑い**(noteに疑義が書かれているもの)

## 出力: `reference/_risky_abilities_2026_07_27.json` + サマリmd(`reference/_risky_abilities_summary_2026_07_27.md`)
各候補: {name, signals:[該当シグナル番号], phase, engine_lines, champions_holder:true/false, risk:"高/中/低", why:"1-2文", suggested_test:"どういうテストで確かめるべきか1文"}
- risk高=Championsロスターが持っていて挙動が怪しい(=本番で実害) / 中=全部版のみ or 発生条件が稀 / 低=理論上
- サマリmdには risk高 の一覧表と件数統計。

## 規律
- **修正しない・エンジン編集しない**。新規2ファイル+tools/1本のみ。commit/git add禁止。
- 1件ずつ。憶測で risk を上げ下げしない(シグナルに基づく機械的判定+理由明記)。
- 完了したら agmsg で claude-design へ: 件数統計(高/中/低)+risk高の名前一覧+3ファイルのパス。
