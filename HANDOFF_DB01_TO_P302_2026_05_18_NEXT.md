# DB01 → P302 次サイクル指示書 — 2026-05-18

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB01 (リーダー)
**宛先**: P302
**前サイクル**: `HANDOFF_P302_TO_DB01_2026_05_18_TASK_C.md` (タスク C 完了報告) を承認

---

## 🎯 ひとことで

> 前サイクルでバトルシミュレーターカード追加完了 ✅、C-4 sitemap priority 0.7→0.8 は DB01 が `41a138e` で対応済。
> 次は **DB02 が作った types-master.json を P302 領域のファイルに展開** 依頼。
> ⚠️ **P301 (あべ直管理) が battle_simulator.html を触っている可能性が高い** → 慎重に競合回避。

---

## ✅ 前サイクル成果(承認)

- `89b2909`: バトルシミュレーターカード追加(11 ファイル、9 言語訳)— **本番反映済**
- C-4 sitemap priority: DB01 が `41a138e` で対応(0.7 → 0.8、party_checker と同レイヤー)

→ **完了承認**。

---

## ✅ 次タスク G: types-master を P302 領域のファイルに展開

### 背景

DB02 が `c3500ec` で `i18n/types-master.json` + `runtime.js` の `I18N.type(jaName, format='short3')` 拡張を実装完了。
P302 領域のファイルでタイプ表示が **古い方式で 3 文字短縮を表現している箇所** があれば、新仕様に切替依頼。

### 成果物

#### G-1. battle_simulator.html のタイプ表示確認

**🚨 注意**: P301 (あべ直管理) が battle_simulator.html を **同時に触っている可能性が高い**。

**事前確認**:
1. `git status` で `battle_simulator.html` が working tree に modified として残っていないか確認
2. modified なら **P301 の作業中** → 本タスクは保留(あべ判断待ち、または P301 完了後)
3. clean なら作業着手可能

**作業内容**(着手可能な場合):
- battle_simulator.html 内でタイプ表示の 3 文字短縮を行っている箇所を grep
  - 例: `slice(0,3)` / `TYPE_SHORT` 変数 / 手動マップ等
- 該当箇所を `I18N.type(jaName, 'short3')` 経由に切替
- `i18n:changed` / `i18n:ready` で関連描画関数を再呼出するロジック追加(必要なら)

#### G-2. waza-list.html / waza_picker.js のタイプ表示確認

waza_picker.js (共通モジュール) でタイプ短縮表示している箇所:
- 同様に grep → `I18N.type(jaName, 'short3')` 経由に切替
- waza-list.html 直接編集はモジュール参照のみのため最小限

**参考**: `pokemon_db_v9.html` の `type3()` の置換 + 末尾の `i18n:changed` リスナーが手本(DB02 が `c3500ec` で実装済)

### 工数

- G-1 (battle_simulator): grep + 置換 + 検証 = **30-60 分**(P301 と被らないことが前提)
- G-2 (waza-list / waza_picker): 同 **30-60 分**

**合計 60-120 分**(両方やる場合)

### 検証

- 言語切替 (ja/en/ko/zh-Hant/zh-Hans/fr/de/it/es) で各画面のタイプ表示が `short3` 値に切り替わるか
- 既存の TYPE_COLORS / data-attribute (`data-waza-type` 等の **キーは日本語名のまま維持**)
- ブラウザ実機(orchestrator port 8765 サーバが起動中なら活用、または `python3 -m http.server` で別ポート)

---

## ⚠️ P301 競合回避(最重要)

### 現状(5/18 夜 DB01 観測時点)

- working tree に `M battle_simulator.html` が残存(P301 作業中の可能性)
- P301 はあべ直管理 → DB01 経由の指示は出さない、状況把握のみ

### P302 がやるべき確認

1. **着手前**:
   - `git pull origin main` で最新化
   - `git status` で `battle_simulator.html` が modified か確認
   - **modified なら P302 は battle_simulator.html を touch しない**。G-1 を保留 → G-2 (waza-list / waza_picker) のみ着手
2. **着手中**:
   - 小さな commit を頻繁に作る(P301 と差分小さく)
3. **着手後**:
   - DB01 に完了報告 → DB01 が P301 push 状況確認後に最終 push

### 代替案

P301 が battle_simulator を活発に動かしている期間中は、G-1 をスキップして G-2 だけ実施しても OK。
G-1 は **5/19 以降に P301 が安定した段階で再着手** という選択肢もあり。

---

## ❌ 本サイクルで取り扱わない項目

- C5 Track B-2 / B-3 (きのみターン終了処理 / hp_drain) — **あべ判断待ち**(`HANDOFF_PHASE3_C5_TURNEND.md` の案 A/B/C 選択)
- Init-B (メガ進化統合) — **あべ判断 GO 待ち**(`HANDOFF_PHASE3_INIT_B.md`)
- verify:true 24 件 ゲーム内確認 — **あべ作業**

→ P302 は **タスク G のみ** に集中。あべ判断項目が来たら DB01 経由で追加指示します。

---

## 📋 完了報告フォーマット

完了したら以下を作成:

```markdown
HANDOFF_P302_TO_DB01_2026_05_18_TASK_G.md

- [x|/] G-1: battle_simulator.html タイプ表示を short3 経由に
       (またはスキップ理由: P301 競合のため保留)
- [x|/] G-2: waza-list.html / waza_picker.js タイプ表示を short3 経由に
- [x] 検証: 言語切替 9 言語、JSON/JS 構文 OK

local commits: <hash list>
```

`[x]` = 完了 / `[/]` = スキップ(理由併記)

---

## 🔗 関連

- 前サイクル指示書: `HANDOFF_DB01_TO_P302_2026_05_18.md`
- 前サイクル完了報告: `HANDOFF_P302_TO_DB01_2026_05_18_TASK_C.md`
- DB02 完了報告(展開依頼元): `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_AB.md` の「P302/P303 への展開依頼」
- types-master.json: `c3500ec` で本番反映済
- runtime.js 拡張: 同 commit に含まれる
- 参考実装: `pokemon_db_v9.html` の `type3()` 置換 + i18n:changed リスナー
