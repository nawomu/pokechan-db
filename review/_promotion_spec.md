# 構造化昇格・冗長削除 叩き台(ステップ② スペック) — 実データ裏取り済

最終更新: 2026-06-05 / 全て backup→書込→drift検証 前提。SSOTへの書込は適用セッションで実施。

---

## 昇格(本物=1件): とおせんぼう

`prevents_switch` が無く、`value:trapped`+英語effect で表現されている。足場=くろいまなざし/かげぬい(`拘束`+`prevents_switch`)。

**before**
```json
{"kind":"状態付与","target":"opponent","value":"trapped","phase":"lasting","duration":"until_user_leaves","effect":"target cannot flee or switch out"}
```
**after**
```json
{"kind":"拘束","target":"opponent","phase":"lasting","duration":"until_user_leaves","prevents_switch":true,"immune":[{"type":"target_type","value":"ゴースト"}]}
```
- `kind`: 状態付与→**拘束**(くろいまなざし等と統一)
- `value:trapped` 削除 / 英語 `effect` 削除(prevents_switch が表現)
- 表示対応済(`PK.prevents_switch='交代不可'`)→「交代不可」と出る
- ⚠️**要確認**: ゴースト immune の追加。トラップ技はゴースト無効が標準で、くろいまなざし/かげぬいは持つ。とおせんぼうは現在 immune 無し(フェアリーロックと同型の穴)。**統一のため付与を推奨**するが、推測でなく確認のうえ。NGなら immune 行は外す。

---

## 昇格(2件目): フェアリーロック — ゴースト除外を構造化(Bulbapedia確定)

SSOT内部矛盾(説明文「全ポケモン」vs note「ゴースト以外」)を Bulbapedia で決着 → **ゴースト除外が正**(note側が正しかった)。Mean Look家族と同じく ghost immune を構造化。

**before**(`全員逃走不可` effect・immune無し + 英語note)
```json
{"kind":"全員逃走不可", ... , "note":"all Pokemon that are not Ghost-type are trapped"}
```
**after**
```json
{"kind":"全員逃走不可", ... , "immune":[{"type":"target_type","value":"ゴースト"}]}
```
- ghost immune を追加(事実に基づく・推測ではない)→ 英語noteは重複で **A削除**
- 表示対応済(`immStr`/⛔無効:ゴースト)
- ※ kind名「全員逃走不可」は実際は「ゴースト以外」だが、immune で除外を表現するので名称はそのままで可(縦比較で Mean Look家族と整合)

---

## 既に構造化済 → 冗長プロセを A削除(3件・昇格不要)

裏取りの結果「未構造化フラグ」は誤りで、数値は既にある。プロセを消すだけ。

| 技 | 既存の構造 | 消すもの | 表示の手当て |
|---|---|---|---|
| **すなあらし** | `全体継続ダメージ fraction:0.0625` / `能力倍率 ×1.5` | note×2(英語) | FRAC_PRE に1行追加(下記) |
| **いやしのはどう** | `回復 fraction:0.5 target:opponent` | effect(英語) | 既存表示「回復 相手 最大HPの50%」で足りる |
| **アクアリング** | `回復 fraction:0.0625 phase:turn_end duration` | detail(英語) | 「毎ターン」を出すと尚良(任意) |

### 表示パッチ(tools/_waza_proto_done.js / _waza_cond_proto.js 共通の FRAC_PRE)
```js
// 追加
'全体継続ダメージ': '毎ターン最大HPの',
```
→ すなあらしが「毎ターン最大HPの6.25%」と出て、note無しで伝わる(ミストバーストの轍を踏まない)。

---

## 後日「構造化フェーズ2」へ(4件) — 今はプロセ訳のまま C 保持

新フィールド/新スキーマが要る=英語全廃のついでに即席で発明しない(review標準「推測でスキーマを足さない」)。simulator実装と整合する形で後日設計。**handoffに記録必須**(二重化の放置を防ぐ)。

| 技 | 必要な新スキーマ | 現状の保持先 |
|---|---|---|
| ぜったいれいど | 自分タイプ別の命中(`cases`は天候キーで形が違う) | note「こおりなら30%他20%」 |
| アシストパワー | `power_per_stage`(新フィールド) | note「+1ごとに威力20」 |
| おいかぜ | 味方場×能力倍率×持続の複合 | effect/value |
| メロメロ | メロメロ状態内在の50%行動不能を切り出すか要設計 | effect |

---

## 統合適用順(確定)
```
① いちゃもん kind 修正(状態付与/ちょうはつ → 専用kind「いちゃもん」)※最初
② 昇格: とおせんぼう(拘束+prevents_switch) + 表示 FRAC_PRE 追加
③ A削除: note27 + effect26 + detail0(②昇格・既構造化の冗長分を含む)
④ B ext退避: 純世代差7件
⑤ C日本語化: note/effect/detail/sub_effects/value(英語句置換) + defer4はプロセ訳のまま
全工程 backup → 書込 → drift検証(英語フリーテキスト残ゼロを grep で確認)
```
