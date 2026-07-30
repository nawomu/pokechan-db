# GLMタスク: 敵対的テスト第2弾 = undo復元漏れ 壁/場・ターン追跡8フィールド根治(H56 DEFERRED)

送信元: claude-design(設計/検証) → glm-impl(実装)
方針: 機械ゲート(ハーネス)で自走できる自己完結タスク。声/taste判断なし。**本番pushしない・commitしない**。完了したら claude-design に報告。

---

## 背景

2026-07-21の敵対的シナリオテストWave1で「一手もどす(undo)」の状態復元漏れ11フィールドを根治した。その時、壁/場・ターン追跡系の**8フィールドは次波送り**にしてハーネス側で `EXCLUDED_KNOWN_GAP_DEFERRED` として可視化してある。今回それを閉じる。

対象8フィールド(すべて mon 状態オブジェクトのプロパティ・`real_battle_simulator.html` L1133-1178 で初期化):
- `reflect` (boolean) — リフレクター
- `lightScreen` (boolean) — ひかりのかべ
- `auroraVeil` (boolean) — オーロラベール
- `safeguard` (boolean) — しんぴのまもり
- `screenTurns` (object `{flag:残ターン数}`) — 技で張った壁の残ターン(mistも入る)
- `tookThisTurn` (object `{phys, spec, any}`) — このターン受けたダメージ記録(からげんき系の参照元)
- `movedThisTurn` (boolean) — このターン既に行動したか(アナライズ等の参照元)
- `usedMoveNames` (array of string) — 実際に使った技名の記録(とっておき用)

## やること

### (1) snapshot に8件追加
`real_battle_simulator.html` の `snapshotBattleState()` 内 `snap()`(現状 L5261-5296。末尾の `switchedThisTurn: !!st.switchedThisTurn,` の直後あたり=A-1パーティ節の前後どちらでも可)に、7/21 Wave1と同じパターンで追加:

```js
    // 2026-07-22 敵対的テストWave2: H56で次波送りにした壁/場・ターン追跡系の復元漏れを閉じる
    reflect: !!st.reflect,
    lightScreen: !!st.lightScreen,
    auroraVeil: !!st.auroraVeil,
    safeguard: !!st.safeguard,
    screenTurns: {...(st.screenTurns || {})},              // 壁の残ターン(値は数値=浅いコピーで十分)
    tookThisTurn: {...(st.tookThisTurn || {phys:0, spec:0, any:0})},
    movedThisTurn: !!st.movedThisTurn,
    usedMoveNames: [...(st.usedMoveNames || [])],
```
※オブジェクト/配列(screenTurns/tookThisTurn/usedMoveNames)は必ず**コピー**する(参照共有だと巻き戻しにならない=既存の charging/rank/slips 等と同じ作法)。

### (2) restore に8件追加(snapshotと対で)
`undoBattle()` 内 `restore(st, src)`(現状 L5324-5404。`st.switchedThisTurn = !!src.switchedThisTurn;` の直後あたり)に対で追加:

```js
    // 2026-07-22 Wave2: snapと対で壁/場・ターン追跡系を巻き戻す
    st.reflect = !!src.reflect;
    st.lightScreen = !!src.lightScreen;
    st.auroraVeil = !!src.auroraVeil;
    st.safeguard = !!src.safeguard;
    st.screenTurns = {...(src.screenTurns || {})};
    st.tookThisTurn = {...(src.tookThisTurn || {phys:0, spec:0, any:0})};
    st.movedThisTurn = !!src.movedThisTurn;
    st.usedMoveNames = [...(src.usedMoveNames || [])];
```

### (3) ハーネスの除外を解除
`tools/_sim_hard_interaction_test.js` L2358 の `EXCLUDED_KNOWN_GAP_DEFERRED` を**空 Set に**する(8件全部を復元対象に戻す):
```js
  const EXCLUDED_KNOWN_GAP_DEFERRED = new Set([]);
```

### (4) 検証(全部グリーンを確認してから報告)
```
node tools/_sim_hard_interaction_test.js     # H56の復元スイープ含め全ケースpass・除外0件で通ること
node tools/_sim_test.js                       # 814pass/2fail(T185d既知)= 回帰なし
node tools/_sim_sweep_all.js                  # 919技クラッシュ0
```
- H56スイープが「復元確認=全件 / 既知ギャップ次波送り=0件」になること。
- 8フィールドが実際に巻き戻ることをスイープが確認する(除外を外したので、漏れがあれば即fail)。
- もし fail が出たら、その原因(どのフィールドがどう不一致か)を**修正せず先に報告**でも、直せそうなら直して報告でもよい。ただし snapshot/restore の対称性(snapに入れたらrestoreにも/コピー忘れ)を最初に疑うこと。

## 制約(厳守)
- 変更ファイルは **`real_battle_simulator.html` と `tools/_sim_hard_interaction_test.js` の2つだけ**。
- エンジンの挙動ロジック(ダメージ計算・壁の効果本体)は**触らない**。undoのsnapshot/restore と ハーネスの除外解除のみ。
- **本番pushしない・git commitしない・git addしない**(claude-design が検証してからコミットする)。
- 完了報告に: ①各ハーネスの結果数値(hard/test/sweep) ②H56スイープの内訳(復元確認N件/除外0件) ③触ったファイルと行 を含める。
