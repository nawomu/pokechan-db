# GLMタスク T19: 説明文の整合検査(effects → compose → 説明文)— **調査のみ・修正禁止**

送信元: claude-design → glm-impl
位置づけ: ①内部データの一本化。**T18の権威データ待ちとは独立**なので、今すぐできる。
根拠: `仕様書_サイト全体.md` **第5の軸「説明文の作り方(鉄壁のルール)」**(2026-07-29 阿部さん)。

## 鉄壁のルール(これを機械で検査できる形にするのが本タスク)
- **技の説明文は effects から compose で生成する。手で書かない。**
- 順序は **①effects(simの土台) → ②composeが訳す**。逆は禁止(effects空で説明文だけ手書き=simが動かない偽の完成)。
- 手書きオーバーレイ `reference/moves_desc_override.json` は **新kind実装までの一時しのぎ**。恒久手段ではない。
- **特性・持ち物は別ルート**(composeを通さず、公式のゲーム内テキストをそのまま)。本タスクの対象外。

## 大原則(破ったら成果物は捨てる)
- ★**調査のみ。1バイトも修正するな**。`git add`/`commit`/`push` 禁止。書いてよいのは下記の出力JSONだけ。
- ★**全コマンドはフォアグラウンド同期実行**。止まらず完走。1本ごとに5行以内で報告。
- ★**全数**でやる。★**推測で埋めるな**(分からなければ unknown)。
- ★**枠が85%に近づいたらキリのいい所で止めて報告**すること(書きかけを残さない)。

---

## 出力1: `reference/_truth_desc_compose.json` — 本番の説明文 vs composeで再生成した文
対象: **Champions版(pokechan_data.js)と全国版(pokechan_data_all.js)の両方**。

やり方(★重要): **`compose()` の生出力ではなく、ビルダーと同じ後処理を通した文**と比べること。
- 全国版ビルダー `tools/_build_pokechan_data_all.js` の **`composeDesc(m)`** が正しい比較対象
  (ダメージ技には冒頭に「ダメージ。」を付ける等の後処理がある)。**その関数と同じ処理を再現**して使う。
- ★2026-07-29 にClaudeが `compose()` の生出力と比べて「498技中327件が違う」と誤認した。**差はほぼ全部「ダメージ。」の有無**だった。同じ間違いをしないこと。

各技について `{key, name, version:"champions"|"national", production, regenerated, match:true/false, diff_kind:"ダメージ。の有無"|"語尾"|"内容が違う"|"その他"}`。
集計: 一致数 / 不一致数 / **不一致の型ごとの件数**。

## 出力2: `reference/_truth_desc_override.json` — 手書きオーバーレイの棚卸し
`reference/moves_desc_override.json` を読み、**いま何件が実際に効いているか**を出す。
- 各件 `{key, name, override_text, compose_text, still_needed:true/false/unknown, reason}`
- `still_needed` の判定: **composeで同じ意味の文が作れるようになっていれば false**(=オーバーレイを外せる候補)。
  判定に迷ったら **unknown** とし、理由を書く(勝手に決めない)。
- ★これは「**新kindを実装すべき技のリスト**」でもある。effectsで表現できていない=バトルで不発の疑い。

## 出力3: `reference/_truth_desc_empty.json` — 説明文が空/effectsが空の技
- `description` が空の技、`battle_data.effects` が空の技を**両版で全数**列挙。
- 各件 `{key, name, version, has_description, has_effects, learners_count}`
- ★**effectsが空=simで不発**の可能性。これが「バトルを作り直す時に埋めるべき穴」の一覧になる。

---

## 報告フォーマット(1本ごと・5行以内)
`[T19-n 完了] <出力> / 件数=N / 一番危ないもの=… / 未確認=…`

## 参考(読んでよい)
- `仕様書_サイト全体.md`(第5の軸=説明文の作り方)
- `review/rules.html`(書き方のルール本体)/ `tools/_waza_compose.js`(compose)
- `設計_データSSOT一本化_2026-07-28.md`(§10 失敗の記録)
