# フェーズ C-5 Track B-2/B-3: ターン終了処理 — 設計検討 (起草)

**作成**: 2026-05-18 02:55 JST
**作成セッション**: phase3_pokechan_db 起点 (Phase3 側)
**ステータス**: 🟡 設計検討中・実装未着手
**前段**: HANDOFF_C5_STATUS_2026_05_18.md Track B-2/B-3

---

## 🎯 ひとことで

> ポケチャン実装済の **きのみ系 (10件) + HP回復系 (2件: たべのこし/かいがらのすず)** は「ダメージ受けた後 / ターン終了時」に発動するため、現状の damage 一発計算型シミュレータには直接組み込めない。
> **3 つの実装方針** (フル機能化 / 部分シミュ / 注釈のみ) を比較し、推奨は **C 案 (注釈のみ)** — 既存シミュレータの哲学を保ちつつ「次に何が起きるか」をユーザーに伝える方式。

---

## 📦 対象アイテム (12 件)

### berry_status_cure (7件) — 状態異常解除きのみ

| key | name | 発動条件 |
|---|---|---|
| `berry_cure_paralysis` | クラボのみ | まひ状態になった時 (即時 or ターン終了) |
| `berry_cure_sleep` | カゴのみ | ねむり状態 |
| `berry_cure_poison` | モモンのみ | どく/もうどく |
| `berry_cure_burn` | チーゴのみ | やけど |
| `berry_cure_freeze` | ナナシのみ | こおり |
| `berry_cure_confusion` | キーのみ | こんらん |
| `berry_cure_all` | ラムのみ | 全状態異常+こんらん |

### berry_hp_cure (3件) — HP/PP 回復きのみ

| key | name | 発動条件 |
|---|---|---|
| `berry_oran` | オレンのみ | HP < max/2 で +10 回復 (一回) |
| `berry_sitrus` | オボンのみ | HP < max/2 で +max/4 回復 (一回) |
| `berry_leppa` | ヒメリのみ | PP が 0 になった技に +10 PP (一回) |

### hp_drain (2件)

| key | name | 発動条件 |
|---|---|---|
| `leftovers` | たべのこし | ターン終了時 最大HPの 1/16 回復 |
| `shell_bell` | かいがらのすず | 技で与えたダメージの 1/8 を自分の HP に回復 |

**訂正履歴 (2026-05-19)**: 旧版で「`kaifuku_no_kona` (仮)」「`tabesashino_iyashi` (仮)」と記載していたが、これらは架空の名称。GameWith (https://gamewith.jp/pokemon-champions/546487) と `items_database.js` の実物で確認の結果、hp_drain カテゴリの実体は `leftovers` / `shell_bell` の 2 件。

---

## 🛠️ 実装方針 (3 案比較)

### 案 A: フル機能化 (ターン進行シミュレータ)

state にターン管理 (HP / 状態異常 / PP) を持たせ、ターン進行ボタンで状態を更新。

**メリット**:
- 「タスキ→きのみ→次ターン」のような連鎖が再現できる
- ガチ対戦シミュレータとして完成度高い

**デメリット**:
- 工数: 1〜2 週間 (state 拡張、UI 大改造、テスト必須)
- 既存「一発ダメ計算」UI と相性悪い (画面構成変更)
- 既存ユーザーの学習コスト高

→ **このセッション群では非推奨**。HANDOFF_PHASE3_SIMULATOR の長期構想に。

### 案 B: 部分シミュ (ダメージ受けた後の状態表示)

calcDamage の結果に追加情報を含める。例:
- 「この攻撃で防御側 HP が 50% を切る → オレンのみで +10 回復」
- 「相手の鬼火を受けたらやけど → チーゴのみで即解除」

**メリット**:
- state 拡張は最小
- ユーザーが「持ち物の効果を確認したい」ニーズに直接応える

**デメリット**:
- 表示ロジックが複雑化 (条件分岐が多い)
- 状態異常を受ける/与える側の判定が必要 (シミュレータには「相手の状態異常を受ける技」概念が薄い)

### 案 C: 注釈のみ (推奨)

ダメージ計算 chip / koLabel と同じレベルで、「この持ち物はこんな効果」と注釈を出す。

例:
- 防御側にオレンのみ装備 → result に `defItemEffectNote: "HP < 50% で +10 回復"` 追加
- 表示側でダメージブロックの下に注釈表示

**メリット**:
- 最小実装、退行リスク低
- ユーザーが持ち物の効果を一目で確認できる
- 状態管理を一切いじらない

**デメリット**:
- 動的シミュレーションではない (「実際何ターン耐えるか」は手計算)

---

## 📋 案 C の実装設計 (詳細)

### Step 1: items_database.js のスキーマ拡張 (任意)

既存の `effect` フィールドで足りる場合は不要。表示時に `effect` を出すだけ。

### Step 2: calcDamage 内で持ち物注釈を組み立て

```javascript
// 既存の return の前
const defItem = def.item ? ITEM_BY_KEY[def.item] : null;
let itemEffectNote = null;
if (defItem){
  const category = defItem.category;
  if (category === 'berry_status_cure' || category === 'berry_hp_cure' || category === 'hp_drain'){
    itemEffectNote = `${defItem.name}: ${defItem.effect}`;
  }
}

return {
  ...,
  itemEffectNote,
};
```

### Step 3: 表示側でノート表示

```javascript
// chipsHtml の後
const itemNoteHtml = result.itemEffectNote
  ? `<div class="dmg-item-note">${result.itemEffectNote}</div>`
  : '';

body = `
  ...
  ${chipsHtml}
  ${itemNoteHtml}
  ${recoilLine}
`;
```

CSS (新規):
```css
.dmg-item-note {
  font-size: .65rem;
  color: #8b949e;
  background: #161b22;
  border-left: 3px solid #5e5fd9;
  padding: 4px 8px;
  margin-top: 4px;
}
```

### Step 4: 動作確認

- 防御側にオレンのみ → ダメージ表示の下に「オレンのみ: HP1/2以下になった時に最大HPの10を回復する。」が出る
- 持ち物なし or 該当外カテゴリ → 注釈なし

---

## ⚠️ 設計上の注意

### A. 攻撃側の持ち物注釈

このセッションで対象になる berry 系は防御側が想定。攻撃側ベリー (例: ノーマル威力強化系) は別。

### B. 既存ベリー (`berry_resist`) と重複しない

`berry_resist` は既に calcDamage 内で実装済 (chip 表示)。`itemEffectNote` は補助情報なので重複表示しない。

### C. 状態異常解除きのみの表示は文脈依存

例: 「相手のかえんほうしゃで自分がやけど → チーゴのみで解除」というケースの場合、攻撃側 vs 防御側を区別して、技の追加効果と連動した注釈が望ましい。
→ ただしこれは複雑。**最初は単純に "持ち物効果" として出す**。

### D. ふうせん / くろいヘドロ / かいふくのこな

これらは別 category (`survival` / `hp_drain` / `misc`) なので、Step 2 の category 判定リストを拡張すれば対応可能。

---

## 🔮 実装フェーズ (案 C 採用時)

| フェーズ | 内容 | 工数目安 |
|---|---|---|
| **B-2-1** | calcDamage に `itemEffectNote` 追加 (約 10 行) | 30 分 |
| **B-2-2** | 表示側に `itemNoteHtml` 追加 + CSS | 30 分 |
| **B-2-3** | 動作確認 (案件きのみ各 1 例) | 30 分 |

合計: **1.5 時間**

---

## 🟡 案 A や B を採用する場合

C 案でユーザー体験に問題があった場合の遷移:
- **C → B**: itemEffectNote の出し方を文脈依存 (技の追加効果と連動) にする
- **C → A**: ターン進行ボタンを追加、state.currentHp / state.status を動的更新

ただし C → A への移行は大規模リライト。最初から A を選ぶか別フェーズ。

---

## 📝 あべへの確認事項

1. 案 A/B/C のどれを採用するか?
2. 案 C 採用時、まず 1 件 (オレンのみ) で動作確認 → 全 12 件展開する流れで OK か?
3. 状態異常きのみ (チーゴのみ等) は「攻撃で状態異常を受けた時」と「ターン終了時」のどちらの解釈で説明文を書くか?

→ あべ判断後に B-2 着手予定。

---

## 🔗 関連 HANDOFF

- `HANDOFF_C5_STATUS_2026_05_18.md` — C5 ギャップ分析
- `HANDOFF_PHASE3_SIMULATOR.md` — battle_simulator 全体設計、次フェーズ候補 #6 とも関連
- `HANDOFF_PHASE3_INIT_B.md` — メガ進化統合 (同レベルの未着手フェーズ)
- `HANDOFF_PHASE3_C5_TEST_SCENARIOS.md` — 既存実装の動作確認シナリオ
