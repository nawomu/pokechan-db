# フェーズC-5: 持ち物プルダウン実装 — 別セッション引き継ぎ

**作成**: 2026-05-16 JST
**作成者**: Claude Code (Opus 4.7) — 持ち物データ収集セッション
**引き継ぎ先**: battle_simulator.html を担当している別セッション
**前段HANDOFF**: `HANDOFF_ITEM_RESEARCH.md` (✅完了マーク済み)

---

## 🎯 このHANDOFFの目的

持ち物データ収集が完了した。`battle_simulator.html` に**持ち物プルダウンを追加し、ダメージ計算ロジックに統合する**ためのデータと実装方針を引き継ぐ。

**HANDOFF_PHASE3_SIMULATOR.md の「次フェーズ候補」#1 (持ち物プルダウン)** に対応。

---

## 📦 渡す成果物

| ファイル | 内容 | 用途 |
|---|---|---|
| `~/Documents/ポケモンDB/_review/items_database.json` | 73アイテムの構造化データ (Q12値・カテゴリ・実装フラグ付き) | **battle_simulator.html から fetch して使う本体** |
| `~/Documents/Claude/.../phase3_pokechan_db/items_data_pokechan.md` | 5サイト突合の生データ (出典・揺れの根拠・メガストーン詳細) | **検証時の参考資料**。実装時は不要 |
| `HANDOFF_ITEM_RESEARCH.md` | 収集タスク自体のHANDOFF (✅完了マーク付き) | **背景理解用** |

---

## ⚠️ 必読: HANDOFF_ITEM_RESEARCH.md からの前提訂正 (2件)

### 訂正1: メガストーンは「ある」

| HANDOFF_ITEM_RESEARCH.md の元記載 | 実態 (2026-05-16 確認) |
|---|---|
| 「メガ石、Zクリスタル → ポケチャンには存在しない」 | **メガストーン60種類が実装済み**。Zクリスタルだけ無し。 |

メガストーン入手区分:
- バトルチュートリアル報酬 8種 (スピアー/ライボルト/ギャラドス/ガブリアス/ハガネール/ヘラクロス/ボスゴドラ/ユキノオー)
- フロンティアショップ 2,000VP (大半)
- ポケモンZA連携 4種 (ブリガロン/マフォクシー/ゲッコウガ/フラエッテ)
- シーズン報酬・キャンペーン

**→ Init-B メガ進化フェーズ (HANDOFF_PHASE3_SIMULATOR.md の次フェーズ候補#5) は実装すべき。**

### 訂正2: vgc-champions-calc が想定する中核アイテムの多くがポケチャン未実装

| 持ち物 | 本家での倍率 | ポケチャン実装 |
|---|---|---|
| いのちのたま | ×1.3 | ❌ 未実装 |
| こだわりハチマキ | ×1.5 | ❌ 未実装 |
| こだわりメガネ | ×1.5 | ❌ 未実装 |
| ちからのハチマキ | ×1.1 | ❌ 未実装 |
| ものしりメガネ | ×1.1 | ❌ 未実装 |
| たつじんのおび | ×1.2 | ❌ 未実装 |
| とつげきチョッキ | 特防×1.5 | ❌ 未実装 |
| しんかのきせき | 防/特防×1.5 | ❌ 未実装 |
| パンチグローブ | パンチ系×1.1 | ❌ 未実装 |
| 各種プレート/ジュエル | タイプ強化 | ❌ 未実装 |
| かえんだま/どくどくだま | 自分やけど/もうどく | ❌ 未実装 |

**ソース**: アルテマ「未実装の持ち物一覧」 https://altema.jp/pokemonchampions/mijisouitemlist

→ **JSON では `implemented_in_pokechan: false` でフラグ付け済み**。プルダウンに出すかどうかは設計判断。

---

## 📋 items_database.json スキーマ詳解

### トップレベル

```json
{
  "version": "1.0",
  "updated": "2026-05-16",
  "categories": { /* カテゴリkey→説明 */ },
  "schema_notes": { /* フィールド意味 */ },
  "items": [ /* 73件 */ ],
  "stats": { /* 集計値 */ },
  "todo": [ /* 残タスク */ ]
}
```

### items[] の主要フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `key` | string | プログラム用ユニークキー (snake_case)。例: `kodawari_hachimaki` |
| `name` | string | 日本語名 (UI表示用)。例: `こだわりハチマキ` |
| `name_en` | string | 英語名 |
| `category` | string | カテゴリkey (12種類のいずれか) |
| `effect` | string | 人間向け効果説明 |
| `q12` | int / null | 4096分のN表現の整数倍率。例: 6144→×1.5 |
| `factor` | float | 倍率の小数表現 (= q12/4096) |
| `applies_to` | string | 効果対象 (`physical_attack`/`special_defense`/`damage` 等) |
| `side` | string | 適用側 (`attacker`/`defender`/`both`) |
| `restriction` | string | 使用制限 (`選択技固定`/`no_status_moves` 等) |
| `trigger` | string | 発動条件 (`end_of_turn`/`super_effective_only`/`hp_le_50pct` 等) |
| `proc_chance` | float | 発動確率 (0.0–1.0)。例: 0.20 |
| `vp_cost` | int | フロンティアショップでの購入VP |
| `is_default` | bool | 初期所持アイテム |
| `implemented_in_pokechan` | bool | **ポケチャンに実装されているか (false なら未実装、本家用)** |
| `source_q12` | string | Q12値の出典 (`vgc-champions-calc`/`spec_pokemon_main`) |
| `verify` | bool | true なら要追加検証 |
| `notes` | string | 補足 |

### カテゴリ12種

| key | 説明 | 件数 |
|---|---|---|
| `attack_boost` | 攻撃側威力補正 | 8 |
| `type_boost` | タイプ別威力補正 (×1.2) | 18 |
| `berry_resist` | 半減きのみ (×0.5) | 18 |
| `berry_status_cure` | 状態異常回復きのみ | 7 |
| `berry_hp_cure` | HP回復きのみ | 3 |
| `defense_boost` | 防御補正 | 4 |
| `status_inflict` | 状態異常付与 (装備者デメリット) | 2 |
| `hp_drain` | HP回復/反動 | 3 |
| `speed_boost` | 素早さ補正 | 2 |
| `survival` | 生存補助 (タスキ等) | 4 |
| `misc` | その他 | 2 |
| `mega_stone` | メガストーン (現状マーカー1件のみ、要拡充) | 1 |

---

## 🛠️ 推奨実装フロー

### Step 1: items_database.json を battle_simulator.html から読み込む

#### A案 (推奨): fetch + cache
```javascript
let ITEMS_DB = null;
async function loadItemsDB() {
  if (ITEMS_DB) return ITEMS_DB;
  const res = await fetch('_review/items_database.json');
  ITEMS_DB = await res.json();
  return ITEMS_DB;
}
```

#### B案: const として inline 化
```html
<script>
const ITEMS_DB = { /* JSONの中身を直貼り */ };
</script>
```
HTMLが肥大するが fetch 不要。pokechan_data.js と同様のパターン。

**判断**: HTML が既に巨大なら A案、開発しやすさ重視なら B案。

### Step 2: プルダウンUI追加

`battle_simulator.html` の各サイド (self/opp) に持ち物 select を追加:

```html
<label>持ち物
  <select id="item-self" data-side="self">
    <option value="">なし</option>
    <!-- カテゴリ別 optgroup で構成 -->
  </select>
</label>
```

**フィルタ方針** (推奨):
- デフォルトは `implemented_in_pokechan === true` のみ表示
- 「本家アイテム表示」トグルで `false` も含める (未来の実装拡張用)
- メガストーン (`category: "mega_stone"`) は別セレクト or 別フェーズで処理

### Step 3: ダメージ計算への組み込み

`calcDamage()` の終盤に持ち物倍率を挿入:

```javascript
// 攻撃側の持ち物
const atkItem = sides[atkSide].item;
if (atkItem && ITEMS_DB.items.find(i=>i.key===atkItem)?.q12) {
  const item = ITEMS_DB.items.find(i=>i.key===atkItem);
  // category 別に分岐
  if (item.category === 'attack_boost') {
    damage = pokeRound(damage, item.q12);
  } else if (item.category === 'type_boost' && item.boost_type === move.type) {
    damage = pokeRound(damage, item.q12);
  }
}

// 防御側の持ち物
const defItem = sides[defSide].item;
if (defItem) {
  const item = ITEMS_DB.items.find(i=>i.key===defItem);
  if (item?.category === 'berry_resist'
      && item.resist_type === move.type
      && effectiveness >= 2) {
    damage = pokeRound(damage, item.q12);  // ×0.5
  }
}
```

### Step 4: 既存 data-flag 系との置き換え

battle_simulator.html には既に以下が `data-flag` 形式で実装済み (520行付近):

| 既存 data-flag | JSON key | 移行方針 |
|---|---|---|
| `lifeOrb` | `life_orb` (未実装フラグ付き) | プルダウンに統一、チェックボックス削除 |
| `rockyHelmet` | `rocky_helmet` | 同上 |
| `disguise` | (これは特性) | 持ち物ではないので残す |
| `critical` | (これは状態) | 残す |

---

## 📊 既知のQ12値 (実装時に直書きしてもよい)

vgc-champions-calc バンドル解析 (2026-05-16) で**確認済み**:

| Q12 | 倍率 | 該当アイテム |
|---|---|---|
| 6144 | ×1.5 | こだわりハチマキ/メガネ |
| 5324 | ×1.3 (実1.2998) | いのちのたま |
| 4915 | ×1.2 (実1.1999) | たつじんのおび、タイプ強化系全般 |
| 4506 | ×1.1 (実1.0996) | ちからのハチマキ、ものしりメガネ |
| 2048 | ×0.5 | 半減きのみ |

vgc-champions-calc バンドル位置: `https://vgc-champions-calc.pages.dev/assets/index-Bt-7Kz3C.js`、変数名 `Ot=[...]`、469件のアイテム定義 (うち92件メガストーン)。

---

## ⚠️ 実装前に確認したい不明点 (`verify: true` 5件)

JSON 中で `verify: true` の項目はゲーム内で要確認:

1. **ふうせん** — ポケチャンに実装されているか？
2. **くろいヘドロ** — ポケチャンに実装されているか？
3. **パンチグローブ** — 倍率が×1.1か×1.0か (本家準拠で推定)
4. **メンタルハーブ** — 効果説明 (アンコール系のみ vs 状態異常全般、サイト間で揺れ)
5. **ホズのみ** — ノーマルタイプ半減の挙動 (本家でも特殊扱い)
6. **ゴツゴツメット** — `verify: true` (実装済みだが詳細未確認)

---

## 🔮 残タスク (引き継ぎ後の追加作業)

JSON の `todo` フィールドにも記載:

1. **メガストーン全60種を JSON 個別化** (現状はマーカー1件のみ。詳細は items_data_pokechan.md の 7-3 セクションに23種分の特性・種族値あり)
2. `verify: true` のゲーム内確認
3. 残り20種程度の未収集メガストーン調査 (本家のメガミュウツーX/Y、メガラティオス等が実装されているか不明)

---

## 📚 関連 HANDOFF / メモ

- `HANDOFF_PHASE3_SIMULATOR.md` — battle_simulator全体の設計 (このHANDOFFは #1 持ち物プルダウン に対応)
- `HANDOFF_ITEM_RESEARCH.md` — 持ち物データ収集タスク自体 (✅完了マーク付き)
- memory: `project_pokechan_items_db.md` — 収集経緯と前提訂正履歴
- memory: `reference_vgc_champions_calc.md` — Q12 整数パイプラインの参考実装
- memory: `project_battle_simulator_status.md` — battle_simulator 進捗 (フェーズC-3/C-4完了)

---

## ✅ 受け取り側のチェックリスト

着手時:
- [ ] `_review/items_database.json` を読み、件数 (73) とスキーマを確認
- [ ] 「実装済み 49 / 未実装 14 / メガ汎用 1」の内訳を理解
- [ ] HANDOFF_ITEM_RESEARCH.md の前提訂正2件を頭に入れる
- [ ] battle_simulator.html の既存 `data-flag="lifeOrb"` 等 (~520行) との関係を確認

完了時:
- [ ] このHANDOFFの末尾に ✅完了マーク追記
- [ ] `project_battle_simulator_status.md` を更新
- [ ] HANDOFF_PHASE3_SIMULATOR.md の「次フェーズ候補」表を更新 (#1完了マーク)
