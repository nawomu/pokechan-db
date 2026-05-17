# フェーズ Init-B: メガ進化シミュレータ統合 — 引き継ぎ (起草版)

**作成**: 2026-05-18 02:15 JST
**作成セッション**: phase3_pokechan_db 起点セッション (Phase3 担当領域)
**ステータス**: 🟡 起草中・未着手
**前段**: HANDOFF_C5_STATUS_2026_05_18.md Q4 で「別 HANDOFF を切る」と合意済

---

## 🎯 ひとことで

> battle_simulator.html に **メガ進化シミュレーション** を統合する。メガストーン (`category: "mega_stone"`) を装備したポケモンが、メガシンカボタンで「メガフォーム」に変身し、種族値・タイプ・特性が動的に切り替わる動作を実装。
> ポケチャン実装済メガストーン **41 種** (詳細あり 23 + skeleton 18) のデータは `_review/items_database.json` および `items_database.js` (99 件版) に整備済み。

---

## 📦 既存データ (利用可能)

### items_database.js (公開、99 件)

`category: "mega_stone"` のエントリ (41 件) に以下のフィールドが揃っている:

| フィールド | 用途 |
|---|---|
| `key` | `mega_stone_<英語名>` (例: `mega_stone_garchomp`) |
| `name` / `name_en` | メガストーン名 (ガブリアスナイト / Garchompite) |
| `applies_to` | 装備可能ポケモン (`ガブリアス`) |
| `mega_form` | メガフォーム名 (`メガガブリアス`) |
| `mega_target_en` | メガフォーム英語名 (`Garchomp` / `Charizard X`) |
| `mega_types` | メガ後タイプ配列 (`["ドラゴン", "じめん"]`) |
| `mega_ability` | メガ後特性 (`すなのちから`) |
| `mega_ability_desc` | 特性の効果説明 |
| `mega_stats` | 種族値 `{H, A, B, C, D, S}` |
| `acquisition` | 入手方法 (`tutorial_free` / `frontier_shop_2000VP` 等) |
| `verify` | true なら要ゲーム内確認 (skeleton 18 件は true) |

### 既存実装の踏み台

| 場所 | 内容 | 流用方針 |
|---|---|---|
| `state.poke` | 現在選択中のポケモンデータ | メガ前ポケモン情報のキャッシュ用に |
| `realStat(st, key)` | ランク補正抜きの実数値計算 | メガ後種族値で再計算可能 |
| `rankedStat(st, key, opts)` | ランク補正込み | 同上 |
| `ITEM_BY_KEY` | 持ち物 key 逆引き | メガストーンも含まれる |
| `state.item` | 装備中の持ち物 key | メガストーン判定の起点 |

---

## 🛠️ 推奨実装フロー

### Step 1: メガフォーム判定ロジック

```javascript
// state にメガ進化済フラグ追加
state: {
  poke: null,
  item: '',
  isMegaEvolved: false,  // ← 追加
  ...
}

// 装備中アイテムがメガストーンか?
function getMegaStoneFor(st){
  if (!st.item || !st.poke) return null;
  const item = ITEM_BY_KEY[st.item];
  if (!item || item.category !== 'mega_stone') return null;
  if (item.applies_to !== st.poke.name) return null;  // 装備条件不一致
  return item;
}

// メガ後の実効ポケモンデータ
function effectivePoke(st){
  if (!st.isMegaEvolved) return st.poke;
  const ms = getMegaStoneFor(st);
  if (!ms || !ms.mega_stats) return st.poke;
  // メガ後データで上書き
  return {
    ...st.poke,
    name: ms.mega_form,
    types: ms.mega_types || st.poke.types,
    hp: ms.mega_stats.H,
    atk: ms.mega_stats.A,
    def: ms.mega_stats.B,
    spatk: ms.mega_stats.C,
    spdef: ms.mega_stats.D,
    speed: ms.mega_stats.S,
    abilities: [ms.mega_ability],  // 表示用、ABILITY_DESC は別管理
  };
}
```

### Step 2: UI 追加 (メガシンカボタン)

ポケモン名表示の横に「メガシンカ ▲」ボタン追加。条件:
- `getMegaStoneFor(st)` が non-null
- まだメガ進化していない

押下で `state.isMegaEvolved = true` → 再描画 → 種族値・タイプ・特性が変わる。

```html
<button class="mega-evo-btn" data-side="self" title="メガシンカ">
  ⚡ メガシンカ
</button>
```

### Step 3: 既存 calcDamage 内の参照を effectivePoke 経由に

```javascript
// 既存
const atkTypes = atk.poke.types;
// 変更
const atkEffective = effectivePoke(atk);
const atkTypes = atkEffective.types;
// 同様に種族値、特性参照を effectivePoke 経由に
```

影響範囲:
- `realStat` / `rankedStat` を「メガ後種族値」で計算
- STAB 判定 → メガ後タイプで判定
- 特性発動条件 → メガ後特性で判定

### Step 4: ABILITY_DESC との連携

メガ後特性の説明文は `items_database.js` の `mega_ability_desc` に既に保存済み。
`pokechan_data.js` の ABILITY_DESC に追記 or items 側から動的取得するかは判断要。

推奨: ABILITY_DESC を「メガ後特性は items から優先取得」のフォールバックチェーンに。

### Step 5: 入れ替え時のリセット

`state.poke` が変わったら `state.isMegaEvolved = false` に戻す。同じく持ち物変更時も。

---

## ⚠️ 注意点・落とし穴

### A. 装備不一致のメガストーン

例: ガブリアスナイトをガブリアス以外に持たせた場合 (ゲーム上は装備不可、シミュ上は防ぐべき)。

→ 持ち物プルダウンの選択肢を `applies_to === st.poke.name` でフィルタするのが正解。
   現状の `_renderItemModalList` はカテゴリ別表示のみなので追加フィルタが必要。

### B. メガリザードン X/Y の選択

リザードンには XY 2 つのメガがある。プルダウンで `mega_stone_charizard_x` / `_y` を選び分ける形になる。今のスキーマでも対応可能。

### C. skeleton 18 件の verify

`verify: true` のメガデータは「標準 Gen6/7 仕様」ベース。ポケチャン版で独自仕様があった場合 (例: メガオーダイル→ドラゴンスキンのような変更)、ゲーム内検証後にデータ修正が必要。

→ verify 前のシミュレーション結果は「あくまで標準仕様での試算」と明示するのが安全。

### D. 既存 ABILITY_DESC との衝突

メガ後特性 (例: マルチスケイル) が ABILITY_DESC に既存の場合、items 側の mega_ability_desc と内容が若干違う可能性。要突合 (現状は 23 詳細メガで実施済の前提)。

### E. 既存 lifeOrb / rockyHelmet との混在 UI

メガ進化時はそれらのチェックボックスも維持される。重複したらどうするか (例: メガガルーラ + ゴツゴツメット)。原則的には維持で OK。

---

## 🔮 実装フェーズ分割案

| フェーズ | 内容 | 工数目安 | 依存 |
|---|---|---|---|
| **B-1** | `effectivePoke` 関数の追加 + state.isMegaEvolved | 1 時間 | なし |
| **B-2** | メガシンカボタン UI + イベント | 1〜2 時間 | B-1 |
| **B-3** | calcDamage の参照を effectivePoke 経由に | 2〜3 時間 | B-1, B-2 |
| **B-4** | 持ち物プルダウンの applies_to フィルタ | 30 分 | なし |
| **B-5** | skeleton 18 件の verify 完了反映 | 適宜 | あべ作業 |

合計工数目安: **5〜7 時間**

---

## 🔗 関連 HANDOFF

- **HANDOFF_C5_STATUS_2026_05_18.md** — 直前の持ち物統合作業
- **HANDOFF_PHASE3_SIMULATOR.md** — battle_simulator 全体設計
- **HANDOFF_C5_ITEM_INTEGRATION.md** — 持ち物 DB 整備の経緯 (主要部完了済)
- memory: `project_pokechan_items_db.md` — items_database.json 経緯

---

## ✅ 未確定事項

- [ ] メガシンカボタンのデザイン (位置・色・アイコン)
- [ ] HP の扱い (メガ進化で最大 HP が変わったら現在 HP はどうする?)
- [ ] メガ進化解除ボタンを設けるか (シミュレータでは戦闘 1 回のみだから不要かも)
- [ ] skeleton 18 件のあべ verify タイミング

→ B-1 着手前にあべに方針確認を推奨。
