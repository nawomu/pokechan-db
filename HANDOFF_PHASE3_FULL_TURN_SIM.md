# フェーズ FULL: 忠実バトルシミュレータ — 全体ロードマップ (起草版)

**作成**: 2026-05-19 JST
**作成セッション**: phase3_pokechan_db 起点
**ステータス**: 🟡 起草・あべ判断待ち (実装未着手)
**スコープ**: 案 A「フル機能化」採用後の全体実装計画
**実装対象ファイル**: `real_battle_simulator.html` (新規、`battle_simulator.html` のコピーから派生)
**既存ファイル方針**: `battle_simulator.html` は「クイック計算ツール」としてそのまま維持。リファクタ・破壊変更は行わない

---

## 🎯 ゴール定義

> `real_battle_simulator.html` (新規) で **「ゲームの忠実な流れをそのまま再現する」** シミュレータを構築する。
> 既存の `battle_simulator.html` は「クイック計算ツール」としてそのまま維持し、本ロードマップでは触らない。
> 「ターン進行ボタンを押す → 行動順決定 → 技発動 → ダメージ反映 → 追加効果 → ターン終了処理 (きのみ・持ち物発動含む)」までを **1 ターン単位で破綻なく** 進められ、複数ターンの戦闘が再現できる状態を目指す。

### 完成判定 (Definition of Done)

以下のシナリオが破綻なく回ること:

1. **ターン跨ぎ HP/状態異常**: やけど → 鬼火を回避 → 次ターンスリップ継続
2. **きのみ自動発動**: HP < 1/2 でオレンのみが自動消費され +10 回復、装備欄から消える
3. **状態異常解除**: ねむりはターンカウンタ管理、解除確率で起きる
4. **天候/フィールドのターンカウンタ**: 5 ターンで終了
5. **メガ進化**: ボタン押下で種族値・タイプ・特性が切り替わり、以降の計算に反映
6. **行動阻害**: こんらん/メロメロ/バインドが正しくロール
7. **多ターン技**: はかいこうせん→次ターン recharge、あばれる→2-3 ターンロック

---

## 📊 現状把握 (battle_simulator.html 2836 行 → real_battle_simulator.html の出発点)

### ✅ 既に実装済み (案 A の土台として活用可能)

| 領域 | 実装内容 | 行 |
|---|---|---|
| **state 基盤** | `sides.{self,opp}.currentHp / status / rank / badpoisonCounter / fainted` | 918-942, 1387-1396 |
| **環境状態** | `env.{weather, field, doubleBattle, trickRoom}` | 904-909 |
| **履歴スタック** | `battleHistory` (最大 50) + `snapshotBattleState` + `undoBattle` | 1551-1609 |
| **PHASES 配列** | Init-A 〜 10h まで枠あり | 1338-1349 |
| **Init-A 特性** | いかく / 天候 4 種 / メイカー 4 種 | 1404-1443 |
| **行動順判定** | `movePriority` / `effectiveSpeed` / `decideOrder` | 1351-1384 |
| **命中判定** | `phaseHitCheck` (簡易) | 1445-1455 |
| **ダメージ処理** | `phaseDealDamage` (Atk-Base 〜 8 + 反動) | 1457-1482 |
| **状態異常付与** | `phaseApplyEffects` (Phase 9、ちからずく考慮) | 1484-1508 |
| **スリップダメ** | `phaseSlipFor` (やけど/どく/もうどく + 砂) | 1510-1549 |
| **片側攻撃** | `runSingleAttack` (⚔ボタン) | 1611-1644 |
| **両側ターン** | `runTurn` (行動順 → 各側順次) | 1646〜 |
| **行動阻害 (基本)** | ねむり / こおり / まひ の skip 判定 | 1627-1629 |

### ❌ 未実装 / 不十分

| 領域 | 不足内容 |
|---|---|
| **state 拡張** | PP / 天候カウンタ / フィールドカウンタ / 壁カウンタ / ルームカウンタ / バインド / アイテム消費フラグ / ねむりターン |
| **Init-B** | メガ進化 (種族値/タイプ/特性の動的切替) — 別 HANDOFF 起草済 |
| **0c 変化技効果** | 能力変動 (self_atk_up_1 等) 即時適用 / 防御技 / 溜め技 / 一撃必殺 |
| **9 適用後** | 反動以外の自爆系 / 回復技 / 交代技 / メタ技 |
| **10b バインド** | まきつく/しめつける継続ダメ (HP/8、4-5 ターン) |
| **10c 天候継続** | 砂以外の継続効果 (現状は砂ダメのみ、雪/雨の継続効果なし) |
| **10d 場の継続回復** | グラスフィールド HP/16 / アクアリング HP/16 / やどりぎ HP/8 |
| **10e 時間差カウンタ** | ねがいごと / みらいよち / ほろびのうた / ロックオン |
| **10f ターン数カウンタ** | 天候 5T / フィールド 5T / 壁 5T / ルーム 5T / 技封じ |
| **10g recharge** | はかいこうせん / ハイドロカノン → 次ターン行動不可 |
| **10h ロック技** | あばれる / げきりん / さわぐ (2-3 ターン継続、後でこんらん) |
| **きのみ自動発動** | berry_status_cure 7件 / berry_hp_cure 3件 (オレン/オボン/ヒメリ) |
| **持ち物発動** | `leftovers` / `shell_bell` / `focus_sash` 以外の survival |
| **アイテム消費** | 一度発動したきのみを `state.item = ''` にする処理 |
| **行動阻害 (拡張)** | こんらん / メロメロ / ひるみ / バインドの拘束 |
| **状態異常の解除** | ねむり (1-3 ターン後起床) / こおり (毎ターン 20% で解凍) / バインド終了 |
| **PP 管理** | 各技の残 PP、0 になったら使えない、ヒメリのみ発動条件 |

---

## 🧭 設計方針

### A. state は「完全な永続オブジェクト」へ拡張

現状 `currentHp` 等が `sides.{self,opp}` に直接生えているが、UI 編集用の `effort/natureIdx` 等と混在している。
これを **「セットアップ用フィールド」と「バトル中の揮発状態」を分離** し、バトル開始時に揮発側を初期化する設計に整理する。

提案:
```javascript
sides.self = {
  // セットアップ (UI 編集)
  poke, effort, natureIdx, ability, item, moves,
  // バトル中の揮発状態 (battleState 配下に集約)
  battleState: {
    currentHp, status, statusTurns,    // 状態異常残ターン
    rank: {...},
    item,                              // 装備中アイテム (消費で '' になる)
    pp: [n,n,n,n],                     // 各技 PP
    badpoisonCounter,
    bind: {turnsLeft, dmgRate},        // バインド継続ダメ
    confusion: {turnsLeft},
    attract: {target},
    recharge,                          // 次ターン行動不可
    lockMove: {moveIdx, turnsLeft},    // あばれる等
    isMegaEvolved,
    fainted,
  }
}

env.battleState = {
  weather: {kind, turnsLeft},
  field: {kind, turnsLeft},
  trickRoom: {turnsLeft},
  wishCount: {self, opp},              // ねがいごと
  futureSightCount: {self, opp},       // みらいよち
  // ...
};
```

→ **大幅リファクタになるが、ここを綺麗にしないと後続フェーズで参照地獄になる**。

### B. 計算と表示を完全分離

現状 `calcDamage` 内で chip 構築や表示用文言生成が混在。
**phase 関数は state を更新するだけ / 表示は別関数** に分離する。

### C. 確率処理は seed 可能にする

`Math.random()` 直叩きを `state.rng()` に置換 (将来テストで seed 固定可能に)。

### D. UI 哲学: 既存ファイルと役割分担

既存ユーザーの「ダメ計算ツール」用途を壊さない:
- **`battle_simulator.html`** (既存・維持) — クイック計算ツール、ダメージ計算特化、一発表示
- **`real_battle_simulator.html`** (新規・本ロードマップ) — ターン進行型シミュレータ、フル機能
- ナビバーから両画面に行き来できる (4 画面体制: type_chart / battle_simulator / real_battle_simulator / party_checker)

### E. アイテム消費の永続化

きのみ等が発動したら `battleState.item = ''` にして、UI 上に「消費済」マーク表示。**Undo で復元可能**。

---

## 🛠️ フェーズ分割 (実装順)

### Phase F1: state 拡張・リファクタ (3〜5 日)

| ID | 内容 | 工数 | リスク |
|---|---|---|---|
| F1-1 | `battleState` サブオブジェクト導入、real_ 内の参照を全置換 | 1 日 | 中 (新規ファイル単独なので限定的) |
| F1-2 | `env.battleState` 導入 (天候/フィールド/壁/ルームをカウンタ式に) | 半日 | 中 |
| F1-3 | バトル開始ボタンで `battleState` 初期化、リセットで全消去 | 半日 | 低 |
| F1-4 | `Math.random()` → `state.rng()` 置換 (将来 seed 化) | 2 時間 | 低 |
| F1-5 | (削除: 別ファイル化により不要) | — | — |
| F1-6 | 既存シナリオ全 5 件 + 退行確認 (S5-A〜D) | 1 日 | 必須 |

**完了条件**: 既存の挙動が変わらない (リファクタのみ)、ターン進行モードで HP/状態異常が安定して持続する。

### Phase F2: ターン終了処理 10b〜10h (5〜7 日)

| ID | 内容 | 工数 | 依存 |
|---|---|---|---|
| F2-1 | **10b バインド継続ダメ** (state.bind 管理) | 半日 | F1 |
| F2-2 | **10c 天候継続効果拡張** (霰廃止、雪は氷タイプ防御UP のみ等) | 1 日 | F1 |
| F2-3 | **10d 場の継続回復** (グラスフィールド HP/16, アクアリング, やどりぎ) | 1 日 | F1 |
| F2-4 | **10e 時間差カウンタ** (ねがいごと 2T後発動 / みらいよち 3T後発動 / ほろびのうた 3T カウントダウン) | 1.5 日 | F1 |
| F2-5 | **10f ターン数カウンタ消化** (天候 5T / 壁 5T / トリックルーム 5T 終了) | 半日 | F1, F2-2 |
| F2-6 | **10g recharge** (はかいこうせん次ターン skip) | 半日 | F1 |
| F2-7 | **10h ロック技** (あばれる 2-3T → 終了時こんらん付与) | 1 日 | F1 |

### Phase F3: 持ち物・きのみ発動 (3〜4 日)

| ID | 内容 | 工数 | 依存 |
|---|---|---|---|
| F3-1 | **`leftovers`** ターン終了時 HP+1/16 (`hp_drain` の片方) | 1 時間 | F1 |
| F3-2 | **`shell_bell`** 与ダメ 1/8 を攻撃側に回復 (Phase 9 直後) | 1 時間 | F1 |
| F3-3 | **`berry_oran` / `berry_sitrus`** HP < 1/2 で自動発動 + 消費 | 半日 | F1 |
| F3-4 | **`berry_leppa`** PP 0 になった技に +10 (PP 管理が前提 → F4) | 1 時間 | F4 |
| F3-5 | **`berry_cure_*` (7 件)** 状態異常になった瞬間 + ターン終了時の発動 | 1.5 日 | F1, F2 |
| F3-6 | **アイテム消費の永続化 & UI 表示** (消費済マーク、Undo 復元) | 半日 | F3-3 |
| F3-7 | **動作確認**: 12 件 + 既存 5 件の退行 | 半日 | 必須 |

### Phase F4: PP 管理 (1〜2 日)

| ID | 内容 | 工数 | 依存 |
|---|---|---|---|
| F4-1 | `battleState.pp` 初期化、各技使用時に -1 | 半日 | F1 |
| F4-2 | PP 0 の技は選択不可 (UI で grayout) | 半日 | F4-1 |
| F4-3 | PP 表示 (各技横に `5/15` 形式) | 1 時間 | F4-1 |
| F4-4 | ヒメリのみ発動 (F3-4 と統合) | 1 時間 | F3-4 |

### Phase F5: 0c 変化技効果 (5〜7 日)

| ID | 内容 | 工数 |
|---|---|---|
| F5-1 | **能力変動** (self_atk_up_1 / opp_def_down_2 等を tag DB から自動適用) | 2 日 |
| F5-2 | **防御技** (まもる / みきり、連続使用で確率減衰) | 1 日 |
| F5-3 | **溜め技** (ソーラービーム → 晴れで 1T 化、はかいこうせん系) | 1 日 |
| F5-4 | **一撃必殺命中判定** (ぜったいれいど等、レベル差で命中変動) | 半日 |
| F5-5 | **回復技** (じこさいせい / つきのひかり 天候連動) | 1 日 |

### Phase F6: 行動阻害の拡張 (2〜3 日)

| ID | 内容 | 工数 |
|---|---|---|
| F6-1 | **こんらん** (33% で自傷 40 ダメ固定) | 半日 |
| F6-2 | **メロメロ** (50% で行動不能) | 半日 |
| F6-3 | **ひるみ** (先制技で命中後、次行動 skip) | 半日 |
| F6-4 | **バインドの拘束** (まきつく中は交代不可、F2-1 と連動) | 半日 |
| F6-5 | **状態異常解除** (ねむり 1-3T 起床 / こおり 20%/T 解凍 / まひ 自然回復なし) | 1 日 |

### Phase F7: Init-B メガ進化 (5〜7 時間)

→ **`HANDOFF_PHASE3_INIT_B.md` Step 1-5 をそのまま採用**。F1 のリファクタ後に実施。

### Phase F8: テストシナリオ整備 (継続的)

| ID | 内容 |
|---|---|
| F8-1 | 各フェーズ完了時に動作確認シナリオを `HANDOFF_PHASE3_C5_TEST_SCENARIOS.md` に追記 |
| F8-2 | ターン跨ぎシナリオ (やけど 3 ターン継続) |
| F8-3 | きのみ消費 → 再装備不可シナリオ |
| F8-4 | メガ進化後の特性発動シナリオ |
| F8-5 | 多ターン技の状態遷移シナリオ |

---

## 🕸️ 依存関係グラフ

```
F1 (state リファクタ)
 ├─ F2 (ターン終了処理) ─┐
 ├─ F3 (持ち物・きのみ) ─┤
 ├─ F4 (PP 管理) ────────┼─→ 統合動作確認
 ├─ F5 (変化技効果) ─────┤
 ├─ F6 (行動阻害拡張) ──┤
 └─ F7 (メガ進化) ───────┘
```

**最重要**: F1 を疎かにすると F2-F7 全てに歪みが伝播する。F1 完了 → 退行確認 → 並行着手が安全。

---

## 📅 工数見積もり (全体)

| Phase | 工数 | 累計 |
|---|---|---|
| F1 リファクタ | 3〜5 日 | 5 日 |
| F2 ターン終了処理 | 5〜7 日 | 12 日 |
| F3 持ち物・きのみ | 3〜4 日 | 16 日 |
| F4 PP 管理 | 1〜2 日 | 18 日 |
| F5 変化技効果 | 5〜7 日 | 25 日 |
| F6 行動阻害拡張 | 2〜3 日 | 28 日 |
| F7 Init-B メガ進化 | 1 日 (5〜7h) | 29 日 |
| F8 テスト整備 | 継続 (各フェーズ +1 日相当) | — |

**合計: 約 4〜5 週間** (1 人日 8h × 連続作業時)

実作業時間ベースなら **2〜3 週間** で完成見込み。

---

## ⚠️ リスク分析

### R1. F1 リファクタの退行リスク (新規ファイル化により大幅に縮小)

旧計画では既存 `battle_simulator.html` をリファクタする想定だったが、**新規 `real_battle_simulator.html` で独立実装** することにより、既存利用者の体験を壊すリスクは消失。

ただし以下の注意は残る:
- 共有ファイル (`items_database.js` / `pokechan_data.js`) を変更する場合は `battle_simulator.html` の動作確認も必須
- 共通モジュール (`waza_picker.js/css`) を改修する場合も同上

**対策**:
- 共有ファイルへの変更は最小限に
- 改修必要時は両画面で退行確認

### R2. アイテム消費 UI の合意

きのみが発動して消えた時、UI 上での見せ方:
- (a) 「消費済 (オレンのみ)」とテキスト表示
- (b) プルダウンが空白に戻り、横に履歴チップ
- (c) プルダウンは元のまま、別欄に「消費済」アイコン

→ あべ判断要。

### R3. 確率処理の再現性

`Math.random()` 直叩きだと **Undo で同じ結果に戻らない**。
seed 化 + 各ロールを log に残す設計が必要 (F1-4)。

### R4. 既存ユーザーの混乱

「クイック計算」と「バトル進行」モードの切替で、操作感が変わる。
→ デフォルトは現状 (クイック)、モード切替はオプトイン。

### R5. 仕様の正答性 (ポケチャン独自仕様)

ポケチャンが本家と異なる仕様 (テラスタル削除、雪の効果、霰廃止、メガ進化の独自) がある。
→ **各実装後にあべがゲーム内で 1 件以上検証** することを必須化。

---

## ✅ あべ判断済 (2026-05-19)

| 項目 | 決定 |
|---|---|
| 実装方針 | 案 A フル機能化 |
| ファイル戦略 | `real_battle_simulator.html` で新規実装、既存は維持 |
| ファイル名 | `real_battle_simulator.html` |
| ベース | `battle_simulator.html` をコピーして改造 |
| ナビバー | 4 画面体制 (type_chart / battle_simulator / real_battle_simulator / party_checker) |
| 公開時期 | 開発中はローカルのみ、F3 完成後に本番デプロイ |
| 工数 | 2-3 週間覚悟 |

## ❓ 残る確認事項

1. **アイテム消費 UI** — R2 の 3 案 (a)「消費済」表記 / (b) プルダウン空白 + 履歴チップ / (c) アイコンのみ — どれが好み?
2. **検証ペース** — 各フェーズ完了でゲーム内検証を挟むか、F4 まで一気に進めてからまとめて検証か?
3. **デプロイ判断** — F3 完成時にあべ確認 → 本番反映の流れで OK?

---

## 🏷️ タグ DB との対応マップ

`_review/tag_database.json` (v13_drain_recoil_fix, 169 タグ × 14 軸) は **本ロードマップのハンドラー実装テンプレート**。各 F フェーズで、対応する Phase のタグを 1 件ずつ handler 化していけば実装が網羅される。

### タグ分布サマリー

| Phase | 件数 | 主要内容 |
|---|---|---|
| Pre | 2 | `damage_only` / `has_secondary_effect` |
| 0a | 7 | 優先度 `priority_plus_1` 〜 `priority_minus_6` |
| **0c** | **11** | `must_hit` `must_crit` `ohko` `defense_protect` `charge_normal` `charge_invulnerable` `charge_with_stat_up` 等 |
| Atk-Base | 3 | `defense_swap_atk` (ボディプレス) / `use_opp_atk` (イカサマ) / `auto_select_phys_spec` |
| Def-Base | 2 | `stat_ignore` (能力ランク無視) / `use_def_for_spe` (サイコショック型) |
| **1** | **19** | HP/体重連動・状態異常時2倍・天候/フィールド連動・てつのこぶし 等 |
| 3 | 1 | `power_by_hp_target_high` |
| 4 | 5 | `self_atk_up_1/2` `self_spa_up_1/2` `target_hp_half` |
| 7 | 7 | `multi_2_fixed` `multi_2_5_random` `multi_thrash` `wall_light/aurora/mist` |
| 8 | 7 | `hp_drain_self` `fixed_damage` `type_ignore` `ghost_immune` `recoil_1_4` 等 |
| **9** | **94** | 状態異常付与 8 種 + 能力変動 50 種 + 吸収/反動/メタ系 36 種 |
| 10 | 3 | `recharge_next` (はかいこうせん) / `lock_self_self` / `lock_3turn` (あばれる系) |
| 10d | 2 | `recovery_per_turn` (アクアリング/ねをはる) / `recovery_drain_seed` (やどりぎ) |
| 10e | 1 | `future_attack` (みらいよち) |
| meta | 5 | 対象軸 `target_self/opp/ally/all/field` |

### F フェーズ ↔ タグ群の対応

| F フェーズ | 対応タグ Phase | タグ件数 | 代表タグ |
|---|---|---|---|
| **F2-1** バインド継続 | (新規追加要) | — | バインド状態を tag DB に追加要 |
| **F2-3** 場の継続回復 | Phase 10d | 2 | `recovery_per_turn` / `recovery_drain_seed` |
| **F2-4** 時間差カウンタ | Phase 10e | 1 | `future_attack` + ねがいごと/ほろびのうたを追加 |
| **F2-6** recharge | Phase 10 | 1 | `recharge_next` |
| **F2-7** ロック技 | Phase 10 | 2 | `lock_self_self` / `lock_3turn` |
| **F5-1** 能力変動 | Phase 9 (能力変動系) | 50 | `self_atk_up_1` 〜 `opp_evasion_down` |
| **F5-2** 防御技 | Phase 0c | 1 | `defense_protect` |
| **F5-3** 溜め技 | Phase 0c | 3 | `charge_normal` / `charge_invulnerable` / `charge_with_stat_up` |
| **F5-4** 一撃必殺 | Phase 0c | 1 | `ohko` |
| **F5-5** 回復技 | Phase 9 (吸収系) | ~10 | `drain_half` 他 |
| **F6-1〜3** 行動阻害 | Phase 9 (status_*) | 8 | `status_confuse` `status_flinch` `status_attract` 等 |
| **F4** PP 管理 | (タグ DB 外) | — | `battle_data.pp` 直接参照 |

### 実装パターン

```javascript
// tag → handler のレジストリ (PHASES 配列と並列)
const TAG_HANDLERS = {
  'self_atk_up_1': (atk, def, move) => { atk.battleState.rank.atk = Math.min(6, atk.battleState.rank.atk + 1); },
  'opp_def_down_2': (atk, def, move) => { def.battleState.rank.def = Math.max(-6, def.battleState.rank.def - 2); },
  'status_burn':     (atk, def, move) => { if (def.battleState.status === 'none') def.battleState.status = 'burn'; },
  'recharge_next':   (atk, def, move) => { atk.battleState.recharge = true; },
  // ... 169 タグ分
};

// Phase 9 で全タグを順次適用
function phase9(atk, def, move){
  if (!move.tags) return;
  for (const tag of move.tags){
    const handler = TAG_HANDLERS[tag];
    if (handler) handler(sides[atk], sides[def], move);
  }
}
```

→ tag DB のおかげで **「未実装の効果を見落とす」リスクが大幅に減る**。実装漏れチェックも tag DB を全件走査すれば自動化可能。

---

## 🔗 関連 HANDOFF

- `HANDOFF_PHASE3_SIMULATOR.md` — 全体設計と Phase 構造 v7 (このロードマップの上位)
- `HANDOFF_PHASE3_INIT_B.md` — F7 メガ進化の詳細設計
- `HANDOFF_PHASE3_C5_TURNEND.md` — F3 (持ち物・きのみ) の旧案 A/B/C 比較 (案 A 採用で本ロードマップに統合)
- `HANDOFF_PHASE3_C5_TEST_SCENARIOS.md` — 既存実装の動作確認シナリオ
- `HANDOFF_C5_STATUS_2026_05_18.md` — 持ち物統合ギャップ分析
- **`_review/tag_database.json`** — 169 タグ × 14 軸 × Phase 付き (本ロードマップのハンドラー実装テンプレート)
- **`_review/waza_classified_v2.json`** — 全 490 技 × タグ (どのタグがどの技で使われるかの逆引き)
- memory: `project_battle_simulator_status.md` — 進捗履歴
- memory: `project_pokechan_items_db.md` — items_database.js の経緯
