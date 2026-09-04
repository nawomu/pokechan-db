# learnsets ↔ moves の champions印 食い違い調査 (2026-09-04)

**調査担当**: 読み取り専用サブエージェント(データ変更なし)
**依頼元**: damage_calc_v2 移行検証で見つかったギャップ(ボーマンダ/メガボーマンダ/グソクムシャ/メガグソクムシャ/ゴリランダー/セグレイブ/メガセグレイブの7体)

---

## 1. 結論(先に要約)

- **母集団**: `master/pokemon.json` の `champions:true`(=`pokedb.js` の `pick()` がChampionsモードで絞る条件そのもの)は **323体**。
  - 念のため「`champions:true` **または** `seasons` に `M-B` を含む」という広い条件でも試したが、**両者は完全に一致**(`champions:false` で `seasons` に `M-B` を持つ行は0件)。よって母集団はどちらの条件でも同じ323体。
- **全数列挙の結果**: `learnsets.json` の技リストのうち `moves.json` で `champions:true` が立っていない技は、**依頼で示された7体だけに存在**し、他の316体には1件もなかった。技の種類は**26種・のべ59行**(表は§2)。
- **権威ソースで確認した結果 → 全て分類(b)、修正不要**:
  - `moves.json` の `champions:true` フラグは `reference/_authority_corpus_ch/moves_ch.json`(ヤックン `/ch/move_list.htm` 全497技、2026-08-21取得)と**完全一致**(497/497、差分0)。つまり `moves.json` の champions印そのものは正しい。
  - 一方、この7体は **`master/pokemon.json` で `champions_added_in: "M-C"`**(次シーズン・2026-09-09開始・まだ本番未実装)。ヤックンの当該7体の個別ページ(`https://yakkun.com/ch/zukan/n373`, `n373m`, `n768`, `n768m`, `n812`, `n951`(セグレイブ), `n951m`)を実機で開いて確認したところ、**全ページに共通の注記**があった:
    > 「(ポケモン名)は、ポケモンチャンピオンズにまだ実装されていません。当サイトでは、今後の登場に向けて研究しやすいように、まだ実装されていないポケモンは、SV・ZAなどの最新ソフトの情報を参考情報として掲載しています。」
  - つまり `learnsets.json` の該当7体の `learn` 配列は、**ヤックンが「未実装ポケモンの参考情報」として載せているSV/ZA(最新本編ソフト)の技リストをそのまま取り込んだもの**であり、**Champions実装後の本当の技リストではない**。26技はいずれも `moves.json` で `source: "ours_national"`(全国版由来)・Champions497技リストに不在で、これは**矛盾ではなく整合**している(今はまだ存在しないポケモンなので「今のChampions技リスト」に居場所がなくて当然)。
  - `reference/_regulations.json` の M-C 項目にも同種の注記が既にある(メガアブソルZ等について「まだ実装されていません」参考情報・ナイトZ未解禁)。今回の7体も同じ現象の別インスタンス。
- **したがって**: これは「`moves.json` の champions印の漏れ」ではない。**`learnsets.json` 側が、M-C予告分のポケモンについて「本実装前のSV/ZA参考データ」を暫定的に持っている**、という状態を正しく認識すべき事案。2026-09-09のM-C本実装後、ヤックンの当該ページから注記が消えたタイミングで、7体の実際のChampions技リストを取り直して `learnsets.json` を更新するのが正しい対応(下記§4)。
- **逆方向(4)**: `moves.json` で `champions:true` なのに、Champions母集団(323体)の誰の `learn` にも出てこない技は **0件**(わるあがき除く)。

---

## 2. 全数列挙表(59行・26技種)

母集団323体中、`learnsets.json` の `learn` に `moves.json` 側 `champions:false` の技を含んでいたのはこの7体のみ。

| ポケモン | 技 | moves.json champions | moves.json source | availability.gens | gen_removed | champions_added_in(pokemon) |
|---|---|---|---|---|---|---|
| ボーマンダ | ずつき | false | ours_national | 1-9 | なし | M-C |
| ボーマンダ | たつまき | false | ours_national | 2-9 | なし | M-C |
| ボーマンダ | とっしん | false | ours_national | 1-9 | なし | M-C |
| ボーマンダ | にらみつける | false | ours_national | 1-9 | なし | M-C |
| ボーマンダ | ひのこ | false | ours_national | 1-9 | なし | M-C |
| ボーマンダ | りゅうのいぶき | false | ours_national | 2-9 | なし | M-C |
| ボーマンダ | スピードスター | false | ours_national | 1-9 | なし | M-C |
| ボーマンダ | テラバースト | false | ours_national | 9 | なし | M-C |
| メガボーマンダ | ずつき/たつまき/とっしん/にらみつける/ひのこ/りゅうのいぶき/スピードスター/テラバースト | false(全て) | ours_national | 同上 | なし | M-C |
| グソクムシャ | あられ | false | ours_national | 3-8 | なし | M-C |
| グソクムシャ | いわくだき | false | ours_national | 2-9 | なし | M-C |
| グソクムシャ | きりさく | false | ours_national | 1-9 | なし | M-C |
| グソクムシャ | すなかけ | false | ours_national | 1-9 | なし | M-C |
| グソクムシャ | まるくなる | false | ours_national | 1-9 | なし | M-C |
| グソクムシャ | みねうち | false | ours_national | 2-9 | なし | M-C |
| グソクムシャ | れんぞくぎり | false | ours_national | 2-9 | なし | M-C |
| グソクムシャ | スピードスター | false | ours_national | 1-9 | なし | M-C |
| メガグソクムシャ | あられ/いわくだき/きりさく/すなかけ/まるくなる/みねうち/れんぞくぎり/スピードスター | false(全て) | ours_national | 同上 | なし | M-C |
| ゴリランダー | えだづき | false | ours_national | 8-9 | なし | M-C |
| ゴリランダー | かいりき | false | ours_national | 1-9 | なし | M-C |
| ゴリランダー | くさのちかい | false | ours_national | 5-9 | なし | M-C |
| ゴリランダー | たたきつける | false | ours_national | 1-9 | なし | M-C |
| ゴリランダー | とっしん | false | ours_national | 1-9 | なし | M-C |
| ゴリランダー | なきごえ | false | ours_national | 1-9 | なし | M-C |
| ゴリランダー | はっぱカッター | false | ours_national | 1-9 | なし | M-C |
| ゴリランダー | ひっかく | false | ours_national | 1-9 | なし | M-C |
| ゴリランダー | みねうち | false | ours_national | 2-9 | なし | M-C |
| ゴリランダー | スピードスター | false | ours_national | 1-9 | なし | M-C |
| ゴリランダー | テラバースト | false | ours_national | 9 | なし | M-C |
| ゴリランダー | ドラムアタック | false | ours_national | 8-9 | なし | M-C |
| ゴリランダー | マジカルリーフ | false | ours_national | 3-9 | なし | M-C |
| セグレイブ | きょけんとつげき | false | ours_national | 9 | なし | M-C |
| セグレイブ | たいあたり | false | ours_national | 1-9 | なし | M-C |
| セグレイブ | とっしん | false | ours_national | 1-9 | なし | M-C |
| セグレイブ | にらみつける | false | ours_national | 1-9 | なし | M-C |
| セグレイブ | みねうち | false | ours_national | 2-9 | なし | M-C |
| セグレイブ | りゅうのいぶき | false | ours_national | 2-9 | なし | M-C |
| セグレイブ | テラバースト | false | ours_national | 9 | なし | M-C |
| メガセグレイブ | きょけんとつげき/たいあたり/とっしん/にらみつける/みねうち/りゅうのいぶき/テラバースト | false(全て) | ours_national | 同上 | なし | M-C |

(グソクムシャ/メガグソクムシャ、セグレイブ/メガセグレイブ、ボーマンダ/メガボーマンダは、メガシンカでも技構成が同じ設計のため技の重複行を1行にまとめて表示。生の全59行はスクリプト実行結果として上に貼った通り重複なし)

---

## 3. 権威ソースでの確認結果(§1の根拠の詳細)

### 3-1. moves.json champions印そのものの正しさ
`reference/_authority_corpus_ch/moves_ch.json`(ヤックン `/ch/move_list.htm`、取得日2026-08-21、497技)と `master/moves.json` の `champions:true` 集合(497件)を突合 → **完全一致(差分0)**。moves.json 側にバグは無い。

### 3-2. 7体の個別ページ実機確認(claude-in-chrome で直接閲覧・2026-09-04時点)
| ポケモン | URL | 結果 |
|---|---|---|
| ボーマンダ | https://yakkun.com/ch/zukan/n373 | 「まだ実装されていません」の注記あり。学習技リストはSV/ZA参考情報 |
| メガボーマンダ | https://yakkun.com/ch/zukan/n373m | 同上 |
| グソクムシャ | https://yakkun.com/ch/zukan/n768 | 同上 |
| メガグソクムシャ | https://yakkun.com/ch/zukan/n768m | 同上(learnsets_ch.json のスクレイプ元と一致) |
| ゴリランダー | https://yakkun.com/ch/zukan/n812 | 同上 |
| セグレイブ | https://yakkun.com/ch/zukan/n951 (ページ内表示の全国Noは998・ヤックン内部の連番idが951) | 同上 |
| メガセグレイブ | https://yakkun.com/ch/zukan/n951m | 同上(learnsets_ch.json のスクレイプ元と一致) |

いずれのページも冒頭に「(名前)は、ポケモンチャンピオンズにまだ実装されていません。当サイトでは、今後の登場に向けて研究しやすいように、まだ実装されていないポケモンは、SV・ZAなどの最新ソフトの情報を参考情報として掲載しています。」の一文があった。これは `reference/_authority_corpus_ch/learnsets_ch.json` が per-pokemon ページをスクレイプした際に**この注記(=データの性質)を取りこぼした**ことを意味する。スクレイプ結果の `learn`/`lost` 配列自体は正しく写せているが、それが「本当のChampions技リスト」ではなく「参考情報(SV/ZA全国版準拠)」であるという文脈が失われていた。

### 3-3. 二重チェック(公式発表・複数ソース)
`reference/_regulations.json` の M-C 項目(role: next)がすでに複数の一次情報で7体を「M-C確定」として記録している:
- champions-news.pokemon-home.com/ja/json/list.json(公式一次フィード)
- news.pokemon-home.com/ja/page/816.html(公式)
- x.com/NintendoAmerica 2026-08-31
- pokemon.com/us/news/get-ready-for-regulation-set-m-c-in-pokemon-champions(公式EN)
- serebii.net/pokemonchampions/rankedbattle/regulationm-c.shtml
- M-C開始日: **2026-09-09**(今日2026-09-04からあと5日)

つまり「7体はM-C予告分でまだ本番未実装」という前提は、ヤックンの注記・公式発表の両方で二重に裏付けられている。

### 3-4. 分類
全59行・26技種 → **すべて分類(b)**: 技はChampions(現行497技リスト)に存在せず、`learnsets.json` 側がM-C未実装ポケモンの「SV/ZA参考データ」を暫定的に持っている混入。`moves.json` のchampions印は正しい(修正候補なし)。

### 3-5. 未確認(c)
なし。全26技について、moves_ch.json(497技リスト)に不在であることを直接確認できたため「未確認」は0件。
ただし**将来的な意味での不確定**は残る: 2026-09-09にM-C本実装後、ヤックンの該当ページから注記が消えたら、実際にどの技が本当にChampionsへ実装されるかは**現時点では誰にも分からない**(SVの技全部がそのまま来る保証はない=Championsは技を絞る設計のため)。今回の26技がM-C実装後も引き続き「Championsに無い技」であり続ける可能性が高い(497技リストの傾向から、たいあたり/ひっかく/なきごえ/すなかけ/みねうち/とっしん/ずつき等の基礎的な弱い技は他の実装済みポケモンにも一律で使われていない)が、確定はM-C実装後の再確認が必要。

---

## 4. 逆方向チェック(§4: champions:true な技で、母集団の誰も学習していないもの)

`moves.json` で `champions:true`(497件)のうち、母集団323体の `learnsets.json` の `learn` に1件も出現しない技を全件チェック → **0件**(わるあがき除く・わるあがきは学習リストに載らない特殊技なので対象外)。497技すべてが誰かしらの `learn` に載っている。逆方向の食い違いは無し。

---

## 5. 使ったデータ・ソース一覧

- `master/pokemon.json`(champions母集団の判定=`champions:true`)
- `master/moves.json`(champions印・source・availability)
- `master/learnsets.json`(learn配列)
- `pokedb.js` 147-150行目 `pick()` (Championsモードの絞り込み条件 = `!!x.champions`)
- `reference/_authority_corpus_ch/moves_ch.json`(ヤックン `/ch/move_list.htm` 497技・2026-08-21取得・**権威**)
- `reference/_authority_corpus_ch/learnsets_ch.json`(ヤックン `/ch/zukan/n<番号>` per-pokemonページ・442件・2026-07-29取得。メガグソクムシャ/メガセグレイブ/メガボーマンダの3件がここに含まれる。**注記(まだ実装されていません)を欠落**)
- `reference/_regulations.json`(M-C予告・7体の`champions_added_in`根拠・公式発表の一次ソース群)
- ヤックン個別ページ実機閲覧(claude-in-chrome、2026-09-04): n373, n373m, n768, n768m, n812, n951, n951m

**未使用/意図的に避けたソース**: `reference/moves_yakkun.json`(手持ちヤックン427件)は memory `yakkun-champions-authority` により**「非Champions版=流用禁止」**と明記されているため、今回の裏取りには使っていない。

---

## 🙋 確認してください

**このデータギャップは「バグ」ではなく「M-C本実装待ちの暫定データ」である、という認識で合っているか確認をお願いします。** その上で、以下は親エージェント/阿部さんの判断で決めていただきたい点です(このサブエージェントはmoves.jsonにもlearnsets.jsonにも一切書き込んでいません):

1. **`reference/_moves_fixes.json` への追記は不要**という結論です(moves.jsonのchampions印自体は正しく497/497一致のため、フラグを追加すべき技は1つもありません)。もし「とりあえず7体だけ動くように」という目的で技側を無理にtrue化するなら、それは**実際には存在しない架空のChampions技リストを埋め込む**ことになるため、**推奨しません**。

2. 代わりに検討候補となるのは **`learnsets.json` 側への注記**です。もし親エージェント/阿部さんがこの案で進める場合の断片イメージ(既存の `reference/_*_fixes.json` の書式に合わせた例。**実際に書くかどうかは判断をお願いします**):

```json
{
  "ボーマンダ": {
    "note": "2026-09-04調査: learnの一部(ずつき/たつまき/とっしん/にらみつける/ひのこ/りゅうのいぶき/スピードスター/テラバースト等)はヤックンch個別ページの『まだ実装されていません』SV/ZA参考データを暫定採用したもの。M-C本実装(2026-09-09)後にhttps://yakkun.com/ch/zukan/n373 を再取得して本当のChampions技リストへ差し替える。",
    "provisional_source": "sv_za_reference_pending_mc_launch",
    "recheck_after": "2026-09-09"
  }
}
```
同様のキーを メガボーマンダ/グソクムシャ/メガグソクムシャ/ゴリランダー/セグレイブ/メガセグレイブ にも用意する想定です。**★同名キーが既に `_learnsets_fixes.json`(または相当ファイル)に存在する場合は、必ずマージ(上書きで消さない)してください** — CLAUDE.mdの絶対ルール。

3. **damage_calc_v2側の対応**: 現状「Championsモードでは`allMoves()`がchampions:trueに絞るので自然に落ちる」という挙動は、**今回の分析上は正しい動作**です(実際にChampionsに無い技を正しく除外できている)。旧版との一致もこの理屈で説明が付きます。damage_calc_v2側で改めて何か直す必要は無さそうですが、念のため親エージェントで最終確認をお願いします。

4. 2026-09-09のM-C本実装後、この7体のページを再取得して `learnsets.json` の `learn` を実際のChampions技リストに更新するタスクを、ロードマップかハンドオフに一言残しておくことをお勧めします(このサブエージェントでは編集していません)。
