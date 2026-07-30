# GLMタスク T20: マスターデータの生成器を作る(**新規ファイルのみ・既存は1バイトも触らない**)

送信元: claude-design → glm-impl
位置づけ: **①内部データの一本化の本体**。調査は終わり、いよいよ「作る」段。
★ただし**既存のデータ・エンジン・HTMLは1バイトも変更しない**。**新しいファイルを別に作るだけ**(阿部さんの「別で作ってから入れ替える」)。

## 作るもの
`tools/build_master_v2.js`(新規)を書き、実行すると **`master/` に6本のJSON**を生成する。
```
master/
  ├ pokemon.json      器=全国版1219体(うちChampions313)
  ├ moves.json        器=全国版919技(うちChampions497)
  ├ abilities.json    310特性
  ├ items.json        167持ち物(うちChampions75)
  ├ learnsets.json    覚える技 ＋ ★没収技
  └ regulations.json  現行=M-B の1レコード
```

## 入力(すべて読み取り専用)
| 入力 | 用途 |
|---|---|
| `pokechan_data.js` | Champions版(**値はこちらが正典**) |
| `pokechan_data_all.js` | 全国版(**器=範囲**をこちらから) |
| `items_database.js` | 持ち物 |
| `reference/_authority_corpus_ch/*.json` | ★**Champions権威**(特性315 / 技497 / 道具75+種族値313 / 学習442) |
| `reference/_name_normalize.json` | 名前の正規化(3型37件) |
| `reference/_key_map.json` | キー対応表 |
| `reference/_truth_*.json` | これまでの照合結果 |

## スキーマ(`reference/_newdb_schema_proposal.md` に従う。要点だけ再掲)
- **`slug`**(英キー・PokeAPI準拠)を主キーにする。★Championsのローマ字キーは `_aliases` に残す
- **`name`**(正式名称) と **`display_name`**(画面用の短い名前)の**2欄**
- **`champions`**: Championsに登場するか(true/false)
- **`regulation`**: 現行=`"M-B"`(Championsに在るものだけ)
- **`source`** + **`verified_at`**: 値がどこ由来か(`"champions"` / `"gen9"` / …)
- 技は **`priority` を最上位に統一**(Champions版は `battle_data.priority` にあるので移す)
- learnsets は `{slug, learn:[技slug…], confiscated:[技slug…]}`

## ★値の決め方(器と中身)
1. **器(範囲)= 全国版**(1219体/919技/310特性/167持ち物)
2. **値の正典 = Champions**。Championsに在るものは**Champions版の値で上書き**
3. Championsに無いものは**最新世代の値をそのまま**入れ、`source` に由来を残す
4. ★**コインビームは持ち込まない**(存在しない技・削除決定済み)
5. 特性・持ち物の説明文は**公式のゲーム内テキスト(Champions)**を使う。権威コーパスに Champions の記述があればそれ、無ければ最新世代のものを入れて `source` を残す
6. **技の説明文は既存のものを移送**(作り直さない。effects→composeの資産をそのまま運ぶ)
7. **名前は正式名称**(`_name_normalize.json` の通り)。`display_name` は現Champions表記

## 大原則(破ったら成果物は捨てる)
- ★**既存ファイルを1バイトも変更しない**。書いてよいのは `tools/build_master_v2.js` と `master/*.json` のみ。`git add`/`commit`/`push` 禁止。
- ★**生成物を入力にしない**(循環を作らない)。入力は上の表のものだけ。
- ★**全コマンドはフォアグラウンド同期実行**。1本できるごとに5行以内で報告。
- ★**推測で埋めない**。決められない値は `null` + `"unknown"` を残して**報告する**(勝手に決めない)。
- ★**件数を必ず出す**(何件入って、何件が`source:champions`で、何件が暫定か)。

## 進め方(1本ずつ・この順)
1. `master/abilities.json`(いちばん単純・権威が揃っている)
2. `master/items.json`
3. `master/moves.json`(★説明文の移送・priorityの統一・コインビーム除外)
4. `master/pokemon.json`(★名前の正規化・display_name)
5. `master/learnsets.json`(★没収技を `confiscated` に入れる。権威の `matched_ours` で対応)
6. `master/regulations.json`(M-B 1レコード)

## 報告フォーマット(1本ごと・5行以内)
`[T20-n 完了] master/<file> / 件数=N(champions=N / 暫定=N) / 決められなかった値=… / 未確認=…`

## 参考
- `仕様書_サイト全体.md`(第1〜6の軸)/ `設計_データSSOT一本化_2026-07-28.md`(§9器と中身・§10失敗の記録・§14名前)
- `reference/_newdb_schema_proposal.md`(あなたが書いたスキーマ案)
