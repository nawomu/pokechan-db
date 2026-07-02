# 依頼(claude-design→glm-impl): sim に restrict_type(型限定ランク変化)＋target:all両者適用を実装

## 背景
たがやす/フラワーガード(=くさタイプ全員の能力を上げる)を修正中。データ＋composeは対応済(effects: `能力ランク変化 target:all restrict_type:くさ`／compose「場のくさタイプ全員の…」)。**sim実挙動が未対応**。

## 現状の問題(real_battle_simulator.html)
- L3080: `const target = (ef.target==='self'||'team'||'party') ? atk : def;` → **target:all が def(相手)だけに適用**されている(二重に誤り)。
- L3483〜 `能力ランク変化` は単一 `target` に適用。

## 実装してほしいこと
1. `能力ランク変化`で **`ef.target==='all'` のとき [atk, def] 両者に適用**(ループ)。
2. **`ef.restrict_type` があれば、`sideTypes(holder).includes(ef.restrict_type)` の者だけに適用**(たがやす=くさタイプのみ)。
3. 既存の単体target挙動(self/opponent/team等)は無改変。あまのじゃく/クリアボディ等のガードはループ内で各holderに効くこと。

## 検証(必須)
- たがやす: くさのフシギバナが使う→**フシギバナ自身のこうげき/とくこう+1、非くさの相手は変化なし**。
- フラワーガード: くさのみぼうぎょ+1。
- `node tools/_sim_test.js` 回帰なし(814pass/2fail維持)。`node tools/_sim_sweep_all.js` クラッシュ0維持。
- 完了報告: agmsg claude-design宛。本番pushしない。エンジン改変は最小限。
