# HANDOFF: NATURES 統合作業 中間状態 (Phase 1-2 完了)

**作成**: 2026-05-22 11:10 JST
**前セッション**: 2026-05-21 PART2 → 2026-05-22 朝 (Phase 1-2 完了直後で停止)
**目的**: ポケモンDB ディレクトリで並行作業中の別 Claude Code セッションへの状況共有 + 衝突回避ルール
**関連 HANDOFF**: `HANDOFF_NEXT_SESSION_2026_05_21_PART2.md` (i18n 段階 2 完了記録)

---

## TL;DR (3 行)

1. **`pokechan_data.js` に公式 25 種の NATURES マスターを追加済** + `items_database.json` にメガストーン 18 件追加 (114 → 132) + `items_database.js` 再生成 (99 → 118)。 すべて純粋追加で既存破壊なし、 バックアップ取得済 (`bak/*.20260521_2027.bak.*`)
2. **`party_checker.html` の造語 (どんかん / やさしい) と公式と異なる中性扱い、 おっとり / おとなしい の up/down 入替は未修正**。 3 HTML の `const NATURES` 重複定義もそのまま
3. **未決 1 件保留**: メガストーン汎用化案 (個別 60+ 石を 1 個に集約 + メガシンカ可能ポケのみ選択 UI 制御) は前提通り個別 70 件 (新規実装 18 + 既存 41 + 未実装 11) で進める方針 (2026-05-22 あべ判断)

---

## 完了している作業 (Phase 1-2)

### Phase 1: バックアップ取得 (5 ファイル、 2026-05-21 20:27)

```
bak/pokechan_data.20260521_2027.bak.js
bak/party_checker.20260521_2027.bak.html
bak/battle_simulator.20260521_2027.bak.html
bak/real_battle_simulator.20260521_2027.bak.html
_review/bak/items_database.20260521_2027.bak.json
```

### Phase 2: 純粋追加 (既存に影響なし)

#### A. `pokechan_data.js` line 77-81 付近に NATURES マスター追加

公式 25 種 (PokeAPI `/nature/{1..25}` + チャンピオンズ公式画面準拠、 中性 5 種は `null/null`):

```javascript
const NATURES = {
  // 中性 5 種 (補正なし、 PokeAPI が flavor_text を持つ公式キー)
  'がんばりや': { up: null, down: null },
  'すなお':    { up: null, down: null },
  'まじめ':    { up: null, down: null },
  'てれや':    { up: null, down: null },
  'きまぐれ':  { up: null, down: null },
  // atk+ (4)
  'さみしがり': { up: 'atk', down: 'def' },
  'いじっぱり': { up: 'atk', down: 'spatk' },
  'やんちゃ':  { up: 'atk', down: 'spdef' },
  'ゆうかん':  { up: 'atk', down: 'spd' },
  // def+ (4)
  'ずぶとい':  { up: 'def', down: 'atk' },
  'わんぱく':  { up: 'def', down: 'spatk' },
  'のうてんき': { up: 'def', down: 'spdef' },
  'のんき':   { up: 'def', down: 'spd' },
  // spatk+ (4)
  'ひかえめ':  { up: 'spatk', down: 'atk' },
  'おっとり':  { up: 'spatk', down: 'def' },
  'うっかりや': { up: 'spatk', down: 'spdef' },
  'れいせい':  { up: 'spatk', down: 'spd' },
  // spdef+ (4)
  'おだやか':  { up: 'spdef', down: 'atk' },
  'おとなしい': { up: 'spdef', down: 'def' },
  'しんちょう': { up: 'spdef', down: 'spatk' },
  'なまいき':  { up: 'spdef', down: 'spd' },
  // spd+ (4)
  'おくびょう': { up: 'spd', down: 'atk' },
  'せっかち':  { up: 'spd', down: 'def' },
  'ようき':   { up: 'spd', down: 'spatk' },
  'むじゃき':  { up: 'spd', down: 'spdef' },
};
```

データは本家 25 種、 UI は省略表示 21 マス (中性 5 種をまとめて 1 マスにする) という仕様。

#### B. `_review/items_database.json` にメガストーン 18 件追加 (114 → 132)

- 内訳: 新規実装 10 種 (`absolite` / `aerodactylite` / `alakazite` / `ampharosite` / `banettite` / `sharpedonite` / `sablenite` / `medichamite` / `slowbronite` / `tyranitarite`) + 依然未実装 8 種 (`mewtwonite_x` / `mewtwonite_y` / `rayquazaite` / `latiosite` / `latiasite` / `mawilite` / `swampertite` / `sceptilite` / `blazikenite` / `diancite` / `mewnite`) のうち 8/11
- 実装済は `implemented_in_pokechan: true`、 未実装は `implemented_in_pokechan: false`
- 残り未実装 3 種 (要追加、 PART3 セッションで確認): メガレックウザ / メガディアンシー / メガミュウ など

詳しい一覧は `~/.claude/projects/-Users-masamichi-Documents-Claude-Projects--------------------abe-orchestrator-phase3-pokechan-db/memory/project_pokechan_items_db.md` 参照。

#### C. `items_database.js` を JSON から再生成 (`implemented_in_pokechan: true` only)

- 99 → 118 件 (実装済メガ 18 + その他 +1 差分)

---

## 未着手の作業 (Phase 3 / 4 / 5)

### Phase 3: `party_checker.html` の造語修正 (中リスク、 書き換え)

| line | 現状 | 公式 (修正後) | 修正内容 |
|---|---|---|---|
| 1045 | `'どんかん': { up: 'def', down: 'def' }` | 削除 → 中性「がんばりや」を新規追加 `{ up: null, down: null }` | **造語削除 + 配置正常化** |
| 1057 | `'やさしい': { up: 'spdef', down: 'def' }` | 削除 → 中性「すなお」を新規追加 `{ up: null, down: null }` | **造語削除 + 配置正常化** |
| 1066 | `'がんばりや': { up: 'spd', down: 'spd' }` | 削除 (中性 5 種にまとめ済) | **重複削除** (公式は中性、 spd+/spd- は架空) |
| 1051 | `'おとなしい': { up: 'spatk', down: 'def' }` ? | `'おっとり': { up: 'spatk', down: 'def' }` | **おっとり / おとなしい の up/down 入替** |
| (他) | 既存「おっとり」 | `'おとなしい': { up: 'spdef', down: 'def' }` | 同上 |

→ 修正後、 中性 5 種 (がんばりや / すなお / まじめ / てれや / きまぐれ) を全て `null/null` にする。

### Phase 4: 3 HTML から `const NATURES` 削除 → SSOT 参照に切替 (中〜大リスク、 破壊的)

重複定義:
- `party_checker.html:1036` — `const NATURES = { ... }` (object 形式)
- `battle_simulator.html:882` — `const NATURES = [ ... ]` (array 形式) ← 形式差異あり、 参照側のコード調整必要
- `real_battle_simulator.html:882` — `const NATURES = [ ... ]` (array 形式)

→ Phase 3 で party_checker を直してから、 3 ファイル全部を `pokechan_data.js` の `NATURES` 参照に切替。 array 形式の 2 ファイルは `Object.entries(NATURES)` 等で形式変換が必要。

### Phase 5: 持ち物 i18n 9 言語追記 (小リスク、 独立)

- `i18n/build_items.py` を 18 件 (新規メガ) ぶん拡張
- 9 言語の `items-*.json` に追記
- key 設計は C 案 (英語スラッグ主キー、 `legacy_key` 併記) — 2026-05-21 確定済

Phase 3/4 とは独立、 並列可。

---

## 未決事項 (前セッション末で保留)

### バトルシミュレータの性格選択 UI を party_checker と統一 ← **やる確定**

あべ最後の指示:
> バトルシミュレーターの方の性格の選択画面と、 チェッカーの方の選択の並びが違うというか。 色も赤と青で、 一番下に補正なしがまとまっているから、 チェッカーの方と同じ仕様にバトルシミュレーターの方も合わせてください。

仕様:
- 色 = 赤 (up ステ) / 青 (down ステ) の対比表示
- 中性 5 種を「補正なし」として一番下に集約 (21 マス UI)
- 21 マス内訳: 5×4 マトリクス (補正あり 20 種) + 1 マス (中性まとめ)

実装場所: `battle_simulator.html` (および `real_battle_simulator.html` も合わせる?)。 Phase 4 と同時に進めるのが筋。

### メガストーン汎用化案 ← **保留 (2026-05-22 判断)**

あべの提案:
> メガストーンは単に「メガストーン」というアイテムを 1 個持たせるだけで、 汎用的に扱えるようにしてもいいかもしれませんね。 ピクシーとか、 ウツボナイト、 スターミーナイトといった個別の石をいちいち選ばせなくても、 メガシンカしないポケモンにはメガストーンを選べないように制御する仕様の方が、 本来は望ましいです。

判断 (2026-05-22): **前提通り個別 70 件で進める**。 後日改めて検討。 今のセッションでは汎用化に切り替えない。

---

## もう片方の ポケモンDB セッションへの依頼 (衝突回避)

このセッション (phase3_pokechan_db cwd) と並行で動いている ポケモンDB セッションがあるため、 同時に同じファイルを触ると最悪マージ事故になる。 以下のルールで進めたい:

### 触らないでほしいファイル (このセッション側が Phase 3/4 で触る予定)

- `party_checker.html` (Phase 3 造語修正)
- `battle_simulator.html` (Phase 4 NATURES 切替 + UI 統一)
- `real_battle_simulator.html` (Phase 4 NATURES 切替)
- `pokechan_data.js` (Phase 4 で NATURES を読み出す側からも触る可能性)

### 触っていいファイル (このセッションは触らない予定)

- i18n 系 (`i18n/*.json`、 `lang-*.json`、 `ui-*.json`、 `i18n/audit_*.py`、 `i18n/fetch_*.py`) ← 前 HANDOFF の i18n 残作業はそちらで進めて OK
- `waza-list*.html`
- `_review/items_database.json` (Phase 5 が来たらこちら側が触るが、 まだ未着手)
- `HANDOFF_*.md` (新規追加は OK、 既存編集はこちらの担当範囲のもの以外なら OK)

### 連絡方法

- どちらかのセッションがファイルに触る前に、 もう片方の HANDOFF を確認
- 衝突が予想されたら、 あべに「○○ファイル、 両セッションが触りそう」と確認してから着手
- セッション完了時は `/handoff` で記録を残す

---

## 現状 git 状態 (2026-05-22 11:00 時点)

```
M HANDOFF_PHASE3_C5_TURNEND.md   ← Phase3 系統 (温存対象、 触らない)
M battle_simulator.html          ← Phase3 系統 + 本タスク Phase 4 対象
M items_database.js              ← 本タスク Phase 2 で再生成済 (118 件)
M party_checker.html             ← 本タスク Phase 3 対象 + Phase3 系統 4 hunks (温存)
M pokechan_data.js               ← 本タスク Phase 2 で NATURES 追加済
M type_chart.html                ← Phase3 系統 (温存)
?? HANDOFF_DATA_ARCHITECTURE.md
?? HANDOFF_NATURES_INTEGRATION_PART3.md  ← 本ファイル (これから新規)
?? HANDOFF_PHASE3_FULL_TURN_SIM.md
?? real_battle_simulator.html
```

直近 commit: `a948d7a` (2026-05-21 PART2 完了 docs commit)。

### 重要な制約

- **`HANDOFF_PHASE3_C5_TURNEND.md` / `type_chart.html` の Phase3 系統 変更**は別軸の保留作業 (バトルシミュレータ温存)、 触らない
- **`party_checker.html` の Phase3 系統 4 hunks** (L479 / L504 / L1224 / L1764) も保留対象、 NATURES 修正と同じファイルだが hunk 分離手順で混在を避ける (前 HANDOFF 「重要な注意事項 2」参照)
- **commit / push はあべの明示承認後** (Auto Mode 対策)

---

## 次にやることの案

| 案 | 内容 | 工数 | リスク |
|---|---|---|---|
| **A** | Phase 3 (party_checker 造語修正のみ) を完遂し、 動作確認 → commit | 中 | 中 (書き換え + Phase3 系統 hunk 混在) |
| **B** | Phase 5 (持ち物 i18n、 独立タスク) を先に終わらせる | 中 | 小 |
| **C** | Phase 3 + 4 をまとめてやる (NATURES 修正 + 3 HTML SSOT 化 + battle_sim UI 統一) | 大 | 中〜大 |
| **D** | 何もせずあべ判断待ち、 ポケモンDB セッションの動きを見てから決める | 小 | 小 |

推奨は **A → 動作確認 → commit → 別タスク (B か Phase 4)**。 Phase 3 を独立 commit にしておくと、 Phase 4 で何か壊しても巻き戻しやすい。

---

## 環境情報

- **サーバ**: localhost:8080 起動中 (PID 19561、 Python 3.14、 `~/Documents/ポケモンDB`)
- **audit**: <http://127.0.0.1:8080/party_checker.html?audit=1>、 <http://127.0.0.1:8080/battle_simulator.html?audit=1>
- **直近 commit**: `a948d7a` docs(handoff) PART2 完了
- **作業ディレクトリ**: phase3_pokechan_db セッション側 (本ファイル作成元)

---

## 引き継ぎチェックリスト (ポケモンDB セッション向け)

新セッションが受け取る側で確認:

- [ ] 本ファイルを Read で読み込み
- [ ] グローバル `~/.claude/CLAUDE.md` + プロジェクト memory も読み込み (`/pickup` 推奨)
- [ ] `git status -s` で実状況を確認 (上記想定との差異)
- [ ] 触る予定のファイルが「触らないでほしいファイル」一覧に入ってないか確認
- [ ] 入っていたら、 あべに確認してから着手
- [ ] セッション完了時は `/handoff` で次セッション向け md を生成

---

おつかれさまでした。 Phase 2 まで完了済の状態で安全に停止しています。 Phase 3 以降は仕様判断 (UI 統一は確定、 メガストーン汎用化は保留) を踏まえて着手してください。
