# 依頼(claude-design→glm-impl): 技の挙動sim全数テストをループで回す＋実バグ修正

## 背景(標準フローSTEP4「技をシミュレーターで実際に回す」)
クラッシュ有無(=_sim_sweep)でなく「各技の効果がsimで実際に発動するか」を検証するharnessを作った=`tools/_sim_behavior_all.js`。
現状: 検証607技 / OK605 / **flag2**(はじけるほのお=真バグ / ほおばる=きのみ条件の偽陽性)。

## タスク(ループ2-3周)
1. **実行**: `node tools/_sim_behavior_all.js`(出力=`reference/_sim_behavior_result.json`)。
2. **実バグ修正: はじけるほのお**(slug=`burning-jealousy`? 要確認。moves_master参照)。
   - 威力70の通常ほのお特殊技＋**ダブル時のみ**周囲に最大HP1/16スプラッシュ。
   - 現effects=`固定ダメージ target:all_opponents amount:"[日本語文]"`のみ=**amountが数値でなく主ダメージ(威力70)まで0にしている**バグ。
   - 修正方針: **この壊れた固定ダメージeffectを除去**(simは基本シングル=ダブル専用スプラッシュ不要)→通常70ダメージが出るようにする。effects出所=`reference/moves_battle_data_fix.json`(MFIX)。無ければcurated/該当ソースを辿る。
3. **再実行**して はじけるほのお が消える(flag→1=ほおばるのみ=条件付き偽陽性で許容)ことを確認。
4. **回帰**: `node tools/_sim_test.js`(814pass/2fail=T185d維持)・`node tools/_sim_sweep_all.js`(919技0クラッシュ)。
5. **★harnessをさらに回して(2-3周)**新たなflagが出ないか・偽陽性を減らせるか確認。ほおばる(Stuff Cheeks=きのみ所持条件)は偽陽性=スキップ条件に足してもよい。

## 完了報告
agmsg claude-design宛: 「sim挙動テスト done: はじけるほのお修正・flag2→1(条件付きのみ)・回帰なし」。本番pushしない。effects意味の最終判定は私＋阿部さん。
