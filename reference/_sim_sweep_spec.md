# 依頼(claude-design→glm-impl): バトルシミュレーター全数スイープ＋クラッシュ修正

## 背景(標準フローSTEP4)
`技データ作成_標準フロー_2026-07-01.md` の STEP4「バトルシミュレーターを回す(ちゃんと動くまで)」。全国版919技を実エンジンで回し、**クラッシュ/JSエラー/挙動破綻**を潰す。客観pass/fail=GLM適任。

## タスク
1. **スイープ実行**: `node tools/_sim_sweep_all.js`(私が作成済。real_battle_simulatorの実エンジンにpokechan_data_all.jsを食わせ、全技をrunTurnで回す)。結果=`reference/_sim_sweep_result.json`＋サマリ。
2. **クラッシュ調査＆修正**: 現状**2件クラッシュ**=`ソニックブーム`/`りゅうのいかり`(固定ダメージ技)で `a.includes is not a function`。
   - エンジン(`real_battle_simulator.html`)の固定ダメージ処理を読み、原因特定。**データ側(effects/moves_battle_data_fix)で直せるなら直す**(免疫型ゴースト/フェアリーの構造など)。エンジン改変は最小限＋要相談。
   - ★注意: 固定ダメージ技のタイプ免疫(ソニックブーム=ゴースト無効/りゅうのいかり=フェアリー無効)が正。`reference/moves_yakkun.json`の該当技は型名修正済(参照可)。
3. **再スイープ**: 修正→再実行を**クラッシュ0になるまでループ**。
4. **既存テスト維持**: `node tools/_sim_test.js`(505+テスト)が **pass維持**(814 pass/2 fail=T185d既知は許容)を確認。デグレさせない。

## 完了条件
- `_sim_sweep_all.js`: **エラー0**(919技すべて落ちない)。
- `_sim_test.js`: 回帰なし。
- agmsg返信: `send.sh pchamdb glm-impl claude-design "sim sweep done: 919技エラーN→0・修正内容・_sim_test回帰なし"`。

## 禁止・注意
- 本番push無し。effects/composeの**意味の正しさ**判定は私(claude)＋阿部さん(声)。GLMは**落ちない・回る**を担保する機械修正まで。
- effectsを変えたら説明(compose)も変わる=それは想定内(STEP5で再生成)。
