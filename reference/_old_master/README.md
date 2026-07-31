# ★これは「旧マスター」です。マスターではありません。

2026-07-31 に `reference/` 直下から、ここへ**退避**しました(消していません)。

## なぜ退避したか
阿部さんが内部構造仕様書を見て「**一番のマスターって何なの?**」と言った原因が、この10本でした。
`reference/` 直下に `master_pokemon.json`(1365件)/ `pokeapi_master.json`(1302件)/
`items_master.json`(2180件)… と**紛らわしい名前で並んでいて、どれが本物か分からない**状態でした。
しかも `CLAUDE.md` にも「SSOT = reference/master_*.json」という**古い記述**が残っていました(同日訂正済み)。

## 本物はどこか
★**マスターは `master/*.json` ただ1つです。直すのはそこだけ。**

| 本物(master/) | 件数 |
|---|---|
| pokemon.json | 1,257 |
| moves.json | 919 |
| abilities.json | 313 |
| items.json | 169 |
| learnsets.json | 313 |
| regulations.json | 1 |
| types.json | 18 |
| natures.json | 25 |

## ここのファイルの扱い
- `master/` を作る前の**中間ファイル**です。参照しないでください
- **消していないのは、作り直しの経緯を追えるようにするため**(いきなり消さない=CLAUDE.md §5)
- 屋台骨の入れ替えが終わって不要と確認できたら、そのとき削除します
