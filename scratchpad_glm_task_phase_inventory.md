# GLMタスク P1: フェーズ割り当て用「全機構インベントリ」抽出(機械作業・判断禁止)

送信元: claude-design → glm-impl
目的: バトル全体フェーズ設計(第2段=全数割り当て)の素材づくり。**リポジトリ内の実データから機械的に抽出するだけ**。フェーズの分類・判断・推測は一切しない(それは設計側の仕事)。

## やること
`node` スクリプトを書いて(置き場所: `tools/_build_phase_inventory.js`)、以下を1つのJSONに集める → `reference/_phase_inventory_2026_07_26.json`

1. **技のeffect kind一覧**: 全部版の技データ(`pokechan_data_all.js` の WAZA_MAP / battle_data.effects。構造はファイルを読んで確認)から、effects[].kind の全種類を列挙し、各kindに ①出現技数 ②代表技名を最大5件 ③そのkindで使われている phase値の分布(on_use/lasting等) ④そのkindで使われている他のフィールド名一覧(requires/ignores/value等)。
2. **特性一覧**: ABILITY_DESC(全部版=`pokechan_data_all.js`、Champions=`pokechan_data.js` 両方)から、特性名+説明文全文+(全部版/Champions どちらに居るか)を全件。
3. **持ち物一覧**: 持ち物データ(ITEMS系定数。実名はファイルで確認)から、持ち物名+説明/注釈全文+implemented_in_pokechan等のフラグを全件。
4. **エンジン内の特性照合箇所の粗マップ**: `real_battle_simulator.html` を対象に `sideAbility(`/`hasAbility(`等の特性名比較を grep し、「特性名 → 出現行番号リスト」を機械抽出(正規表現で拾える範囲でよい・拾えないものは unlisted に行番号だけ)。
5. **サマリmd**: `reference/_phase_inventory_summary_2026_07_26.md` に件数表(kind数/特性数/持ち物数/エンジン照合箇所数)と、抽出できなかった・構造が想定と違った箇所の正直な列挙。

## 制約(重要)
- **判断・分類・推測をしない**。フェーズをどこに割り当てるか等の列は作らない。データに無いものを補完しない。**取れなかったら取れなかったと書く**。
- 既存ファイルの**編集禁止**(新規2ファイル+tools/1本のみ)。**commit/push/git add しない**。
- 自己検証: スクリプトを実際に実行し、JSONがparse可能なこと・件数がサマリと一致することを確認してから報告。
- 完了報告(claude-designへagmsg): ①件数表 ②作った3ファイルのパス ③抽出できなかった箇所 ④実行コマンド。
