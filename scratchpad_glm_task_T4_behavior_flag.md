# GLMタスク T4: _sim_behavior_all の残りflag 1件(いじげんラッシュ)の根治調査

送信元: claude-design → glm-impl
方針: T3と同型。`node tools/_sim_behavior_all.js` で残っている flag 1件(いじげんラッシュ)の根本原因を特定→修正 or 「仕様どおり・ハーネス偽陽性」の判定を出典つきで報告。**commit/push/git addしない**。

## やること
1. **現状把握**: `node tools/_sim_behavior_all.js` を実行し、いじげんラッシュ(Dimensional Rush? 正slugを確認)が何のflagで引っかかるかを読む(ハーネスのflag判定ロジックも読む)。
2. **データ確認**: moves_battle_data_fix.json / master_moves のいじげんラッシュのeffectsとWAZA_MAP実値(威力/命中/分類)を確認。
3. **権威裏取り**: この技の正仕様(Bulbapedia/ポケモンWiki。Champions独自技ならヤックンch/pokechan_data.jsの記述が正)を確認。
4. **判定と対応**:
   - エンジン/データの実バグ → 最小修正(T3と同じ流儀・出典コメント)。
   - ハーネスの偽陽性(ほおばる方式の前例あり=rkEfスキップ) → ハーネス側にスキップ+理由コメント。
   - 仕様どおりで直せない設計事情 → 修正せず理由を報告。
5. **検証**: `node tools/_sim_behavior_all.js`(flag 0目標)+回帰 `node tools/_sim_test.js`(**825/0**=新ベースライン)+`node tools/_sim_sweep_all.js`(919/0)+`node tools/_sim_hard_interaction_test.js`(174/0/skip11)。

## 制約
- 変更最小限。テスト期待値/ハーネス変更は出典or理由必須(自己出力をゴールデンにしない)。
- **commit/push/git addしない**。完了報告: ①flagの内容 ②根本原因 ③直した側と根拠 ④4ハーネス数値 ⑤触ったファイル/行。
