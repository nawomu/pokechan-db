# DB01 → DB02 指示書 — 2026-05-18

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB01 (リーダー)
**宛先**: DB02 (実作業セッション)
**領域**: i18n / SEO / ドキュメント

---

## 🎯 ひとことで

> あべからの新指示 2 件のうち、**タイプ名の多言語マスター DB 作成 + pokemon_db_v9 上部 UI の多言語化** を DB02 に振る。
> タイプ名は全 18 タイプ × 9 言語 × 4 表記(正式 / フル / 3 文字 / 英語フル)で、各画面が **1 つの参照先** を見れば済む構造に。
> 3 文字版は各言語で識別性検証が必要 — 採用案は最終的にあべ判断。

---

## ✅ タスク A: タイプ名 多言語マスター DB 作成

### 背景

現状の問題:
- 日本語は 3 文字「ノーマ / フェア / かくと」等で表記されているが、他言語版がない / 散在
- `pokemon_db_v9.html` 上部のタイプ chip(`ノーマ ほのお みず ...`)は **英語版に切り替えると日本語のまま** = i18n 未対応
- `type_chart.html` / `waza-list.html` / `party_checker.html` / `battle_simulator.html` で個別に翻訳がバラついている可能性

### 成果物

#### A-1. 新ファイル: `i18n/types-master.json`

```json
{
  "_meta": {
    "description": "全 18 タイプ × 9 言語 × 4 表記のマスター辞書。各画面はここを参照",
    "format_definitions": {
      "official_ja": "日本語の正式名 (ゲーム公式表記)",
      "full": "各言語の正式表記 (例: Normal / 一般 / Acier)",
      "short3": "各言語の 3 文字相当短縮 (テーブル/chip 用)",
      "en_full": "英語フル (Smogon/Bulbapedia 準拠)"
    },
    "updated": "2026-05-18"
  },
  "types": {
    "normal": {
      "official_ja": "ノーマル",
      "en_full": "Normal",
      "full": {
        "ja": "ノーマル",
        "en": "Normal",
        "ko": "노말",
        "zh-Hant": "一般",
        "zh-Hans": "一般",
        "fr": "Normal",
        "de": "Normal",
        "it": "Normale",
        "es": "Normal"
      },
      "short3": {
        "ja": "ノーマ",
        "en": "NOR",
        "ko": "노말",
        "zh-Hant": "一般",
        "zh-Hans": "一般",
        "fr": "NOR",
        "de": "NOR",
        "it": "NOR",
        "es": "NOR"
      }
    },
    "fire": { ... },
    ...
  }
}
```

→ 全 18 タイプ分。各タイプは `normal / fire / water / electric / grass / ice / fighting / poison / ground / flying / psychic / bug / rock / ghost / dragon / dark / steel / fairy` のキー。

#### A-2. 3 文字版の識別性検証(あべ判断仰ぎ用)

各言語で「3 文字相当ショート」が **タイプを一意に識別できるか** を検証して、報告書としてまとめる:

**検証手順**:
1. Bulbapedia / Smogon (英語) でタイプ略称の慣習を確認
2. 各国 Pokémon Wiki (Pokepedia FR / PokéWiki DE 等)でも確認
3. **紛らわしい候補**(英語例: FIGhting / FIRe / FLYing が "F?" で被る)を洗い出し
4. 採用案 + 代替案を提示

**提出物**: `i18n/types-master-verify.md` (調査結果 + 採用案 + 代替案)

#### A-3. `i18n/runtime.js` を拡張

現状: `I18N.type(jaName)` で full 表記のみ取得可能

拡張案:
```js
// 現在: I18N.type('ノーマル') → 'Normal' (en)
// 拡張: I18N.type('ノーマル', 'short3') → 'NOR' (en)
//      I18N.type('ノーマル', 'full') → 'Normal' (en) [デフォルト]

function tType(jaName, format = 'full') {
  if (!jaName) return jaName;
  // jaName から types-master の key (lowercase en) を逆引きするマップを作る
  const key = JA_TO_KEY[jaName];  // 'ノーマル' → 'normal'
  if (!key) return jaName;
  const entry = typesMaster.types[key];
  if (!entry) return jaName;
  const langDict = entry[format];
  return langDict ? langDict[currentLang] || langDict.en : jaName;
}
```

`loadLang(lang)` で `types-master.json` も読み込む処理を追加。

#### A-4. 既存参照箇所の置換

ファイル別に確認 + 必要なら置換:

| ファイル | 現状参照 | 修正方針 |
|---|---|---|
| `pokemon_db_v9.html` | `tDisp(t)` (内部関数で 3 文字に短縮) | `I18N.type(t, 'short3')` に置換 |
| `type_chart.html` | `I18N.type(t)` | 既存 OK、必要なら short3 オプション追加 |
| `waza-list.html` (waza_picker.js) | 内部 type 表示関数あり | 確認 → 統一 |
| `party_checker.html` | 既に i18n 化済 (Phase C) | 確認 → short3 必要箇所のみ調整 |

→ **P302/P303 領域のファイル (battle_simulator / waza_picker / type_chart) は P302/P303 と協議要**(DB01 が判断)。DB02 は **pokemon_db_v9.html だけ** をまず修正、他は要相談として残す。

### 工数 / 規模感

- A-1 (マスター JSON 作成): 30-45 分
- A-2 (識別性検証 + 報告書): 30-45 分(リサーチ含む)
- A-3 (runtime.js 拡張): 15-30 分
- A-4 (pokemon_db_v9 参照置換): 15-30 分

**合計 1.5-2.5 時間**

---

## ✅ タスク B: pokemon_db_v9.html 上部 UI 多言語化

### 背景

スクリーンショット(ユーザー提供)で確認:
- 上部ツールバー: `Reset / All / C1 C2 C3 / 100% / Match① ② ③` — **一部は英語化済**
- 列表示 chip: `Check / Type / Stats / Abilities / Matchups 18 / Counts+Score / Moves` — **英語化済 ✓**
- カテゴリ chip: `Status / Physical / Special` — **英語化済 ✓**
- **Filter: 後ろのタイプ chip** = `ノーマ ほのお みず でんき...` ← **日本語のまま 🔴**
- **Exclude: 後ろのタイプ chip** = 同上 ← **日本語のまま 🔴**

→ つまり、**タイプ chip の表示**が i18n に乗っていない。タスク A の types-master を参照する形に修正すれば解決。

### 成果物

タスク A の A-4 で `I18N.type(t, 'short3')` 経由に切り替える + `i18n:changed` イベントで chip を再描画。

該当箇所(grep で確定要):
- `pokemon_db_v9.html` の Filter chip 生成箇所
- Exclude chip 生成箇所
- ヘッダラベル「Filter:」「Exclude:」「Show:」(これも data-i18n 未対応なら追加)

### 工数

タスク A-4 と一体で **15-30 分**(A-4 に含まれるイメージ)

---

## 🚦 注意点

### 1. types-master.json と既存 ui-*.json の関係

既存 `ui-*.json` の `targets` namespace (例: `"1体選択": "Selected target"`) は **わざの対象指定** であり、**タイプ名とは別物**。重複しない。

types-master.json を **新ファイル** として作り、既存 ui-*.json は触らない方針が安全。

### 2. P302 / P303 と被らないように

- `battle_simulator.html` のタイプ表示は P302 領域 → **DB02 は touch しない**
- `type_chart.html` のタイプ表示は P303 領域 → **DB02 は touch しない**
- `waza_picker.js` / `waza-list.html` のタイプ表示は P302 領域 → **DB02 は touch しない**

DB02 が直接修正するのは:
- `i18n/types-master.json` (新規)
- `i18n/types-master-verify.md` (新規)
- `i18n/runtime.js` (拡張)
- `pokemon_db_v9.html` (タスク B)

他ファイルへの展開は **HANDOFF で P302/P303 へ依頼書を残す**(DB01 経由で渡す)。

### 3. push は DB01 経由

DB02 はローカル commit のみ。push は DB01 (私)が最終的にまとめる。

---

## 📋 完了報告フォーマット

完了したら以下のフォーマットで `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_AB.md` を作成:

```markdown
- [x] A-1: i18n/types-master.json 作成 (全 18 タイプ × 9 言語)
- [x] A-2: 識別性検証 → i18n/types-master-verify.md
- [x] A-3: runtime.js に I18N.type(jaName, format) 拡張
- [x] A-4: pokemon_db_v9.html のタイプ chip を I18N.type(t, 'short3') 経由に
- [x] B: pokemon_db_v9.html 上部の Filter/Exclude/Show ラベルも data-i18n 化

- [ ] 他ファイル (battle_simulator / type_chart / waza-list / waza_picker)
       への展開は P302/P303 へ依頼書を作成 → DB01 へ
```

---

## 🔗 関連

- HANDOFF_COLLAB_2026_05_18.md (3 セッション分担マップ、4 セッション化で要更新)
- HANDOFF_POKEMONDB02_2026_05_18_PART3.md (Part 3 進捗)
- ユーザー指示原文: 2026-05-18 夜「タイプ表記の多言語データベース作成」
