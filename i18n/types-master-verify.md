# types-master.json 3 文字版 識別性検証レポート

**作成**: 2026-05-18 / **作成者**: DB02
**対象**: `i18n/types-master.json` の `short3.*`
**検証範囲**: 全 18 タイプ × 9 言語 (ja / en / es / fr / de / it / ko / zh-Hant / zh-Hans)

---

## 🎯 目的

各言語の 3 文字短縮(`short3`)が **タイプを一意に識別できるか** を機械検証 + 慣習照合し、採用案 + 代替案 + あべ判断要事項を提示。

---

## ✅ 自動検証結果(一意性 unique)

スクリプトで `types['*'].short3[lang]` が重複しないかチェック:

| 言語 | 18 タイプの一意性 | 備考 |
|---|---|---|
| ja | ✅ all unique | 既存 DB の慣習(`ノーマ` / `フェア` / `かくと` 等)を採用 |
| en | ✅ all unique | 3 文字大文字略。F 始まり 4 種(FIR/FIG/FLY/FAI)あり |
| ko | ✅ all unique | 元名が 1-2 文字のものは元のまま、3 文字以上のものは先頭 3 文字 |
| zh-Hant | ✅ all unique | 中国語は元名 1-2 文字。`超能力 → 超能` のみ短縮 |
| zh-Hans | ✅ all unique | 同上(简体字) |
| fr | ✅ all unique | 3 文字大文字略。アクセント保持(`ÉLE` / `TÉN` / `FÉE`) |
| de | ✅ all unique | 3 文字大文字略。ウムラウト保持(`KÄF`)、Electric=`ELK` で衝突回避 |
| it | ✅ all unique | 3 文字大文字略。`PSI` と Spanish `PSÍ` は別 |
| es | ✅ all unique | 3 文字大文字略。アクセント保持(`ELÉ` / `PSÍ`) |

→ **全 9 言語で 18 タイプ一意化に成功**。

---

## 📋 各言語 採用一覧

| key | ja | en | ko | zh-Hant | zh-Hans | fr | de | it | es |
|---|---|---|---|---|---|---|---|---|---|
| normal | ノーマ | NOR | 노말 | 一般 | 一般 | NOR | NOR | NOR | NOR |
| fire | ほのお | FIR | 불꽃 | 火 | 火 | FEU | FEU | FUO | FUE |
| water | みず | WAT | 물 | 水 | 水 | EAU | WAS | ACQ | AGU |
| electric | でんき | ELE | 전기 | 電 | 电 | ÉLE | **ELK** | ELT | ELÉ |
| grass | くさ | GRA | 풀 | 草 | 草 | PLA | PFL | ERB | PLA |
| ice | こおり | ICE | 얼음 | 冰 | 冰 | GLA | EIS | GHI | HIE |
| fighting | かくと | FIG | 격투 | 格鬥 | 格斗 | COM | KAM | LOT | LUC |
| poison | どく | POI | 독 | 毒 | 毒 | POI | GIF | VEL | VEN |
| ground | じめん | GRO | 땅 | 地面 | 地面 | SOL | BOD | TER | TIE |
| flying | ひこう | FLY | 비행 | 飛行 | 飞行 | VOL | FLU | VOL | VOL |
| psychic | エスパ | PSY | 에스 | 超能 | 超能 | PSY | PSY | PSI | PSÍ |
| bug | むし | BUG | 벌레 | 蟲 | 虫 | INS | KÄF | COL | BIC |
| rock | いわ | ROC | 바위 | 岩石 | 岩石 | ROC | GES | ROC | ROC |
| ghost | ゴース | GHO | 고스 | 幽靈 | 幽灵 | SPE | GEI | SPE | FAN |
| dragon | ドラゴ | DRA | 드래 | 龍 | 龙 | DRA | DRA | DRA | DRA |
| dark | あく | DRK | 악 | 惡 | 恶 | TÉN | UNL | BUI | SIN |
| steel | はがね | STL | 강철 | 鋼 | 钢 | ACI | STA | ACC | ACE |
| fairy | フェア | FAI | 페어 | 妖精 | 妖精 | FÉE | FEE | FOL | HAD |

**太字**: 機械的に先頭 3 文字でなく、衝突回避のため意図的に変更したもの。

---

## 🔍 慣習照合(海外 wiki / コミュニティ)

### 英語(en) — Smogon / Bulbapedia

- Smogon (competitive) は省略しない傾向。テーブル用なら "Norm/Fire/Water" のように **4 文字以上** を使うのが多い
- Bulbapedia もフルネーム表示が基本
- **PchamDB の方針**: 既存 ja 版で 3 文字を採用しているため、視覚レイアウトの統一性のため en も 3 文字大文字を採用
  - `DRK`(Dark)、`STL`(Steel) は機械的「DAR/STE」では「Dragon=DRA」と紛らわしいため変更
  - F 始まり 4 種(FIR/FIG/FLY/FAI)は識別可能だが、色 chip と併用される前提なら問題なし

### 韓国語(ko) — 한국 포켓몬 위키

- 韓国は元名が短く(`물` `독` `악` など 1 文字)、3 文字スライスする必要がない
- **採用方針**: 3 文字超のタイプのみ先頭 3 文字(`에스퍼 → 에스` / `고스트 → 고스` / `드래곤 → 드래` / `페어리 → 페어`)、その他は元のまま

### 中国語(zh-Hant / zh-Hans) — 神奇宝贝百科

- 公式表記が 1-2 文字に収まっているため、3 文字制限を **適用しない**
- 例外: `超能力 → 超能` (2 文字短縮)。これは UI の chip 幅統一のため
- `飛行/地面/岩石/妖精` 等の 2 文字タイプは元のまま

### フランス語(fr) — Poképédia

- 公式略称はなく、フルネーム表記が一般的
- **採用方針**: 3 文字大文字略。アクセント保持(`ÉLE` / `TÉN` / `FÉE`)で他言語との被りを避ける
- `VOL = Vol`(Flying)、`SOL = Sol`(Ground)、`PSY = Psy`(Psychic) は元から 3 文字以下

### ドイツ語(de) — PokéWiki

- 公式略称はなし。ウムラウト言語のため一部要工夫
- **衝突回避**:
  - Electric=`Elektro` の機械的略 `ELE` は他言語(en/fr/es)の Electric 略と被るため **`ELK`** に変更
  - `Käfer`(Bug) は `KÄF` でウムラウト保持
  - `Gestein`(Rock) と `Geist`(Ghost) は `GES` / `GEI` で 3 文字目で識別可能

### イタリア語(it) — Pokémon Central Wiki

- 公式略称はなし。3 文字大文字略
- **特記**: `Psico → PSI` (Psychic)。スペイン語の `Psíquico → PSÍ` とアクセント有無で識別

### スペイン語(es) — WikiDex

- 公式略称はなし。3 文字大文字略+アクセント保持
- 衝突なし

---

## ⚠️ あべ判断仰ぎ要事項

以下は **DB02 の判断で暫定採用** したが、あべの最終承認を求める:

### 1. 英語 Dark / Steel の略

- **採用**: `DRK` / `STL`(子音だけ抜き出した形)
- **代替案 1**: `DAR` / `STE`(機械的に先頭 3 文字)→ DAR/DRA が紛らわしい
- **代替案 2**: `Dark` / `Stl`(混合大小文字)→ 視覚的不統一

### 2. ドイツ語 Electric の略

- **採用**: `ELK`(Elektro の中段 3 文字)
- **代替案**: `ELE`(機械的先頭 3 文字)→ 他言語 Electric と被るが、UI 上は言語切替なので実害なし
- **可否**: `ELE` に戻しても OK か?

### 3. 中国語 「超能力」の扱い

- **採用**: zh-Hant/Hans ともに `超能` (2 文字短縮)
- **代替案**: `超能力` (3 文字フルキープ) → 他の 1-2 文字 chip と幅不揃いになる
- **可否**: 視覚統一を優先するなら現案、原語完全表記なら代替案

### 4. 日本語 「みず / くさ / どく / いわ / あく / むし」(2 文字)の扱い

- **採用**: 2 文字のまま(`みず` / `くさ` 等)
- chip 幅が他の 3 文字タイプ(`ノーマ` 等)とわずかに違うが、既存 DB と同じ表記
- **代替案**: パディング `みず　` (全角スペース埋め)で 3 文字幅化 → 視覚調整は CSS で対応可能なので不要

---

## 🧪 検証スクリプト(再利用可能)

```python
import json
with open('i18n/types-master.json') as f:
    m = json.load(f)
types = m['types']
langs = ['ja','en','ko','zh-Hant','zh-Hans','fr','de','it','es']
for L in langs:
    vals = [types[k]['short3'][L] for k in types]
    dups = [v for v in vals if vals.count(v) > 1]
    assert not dups, f"{L} has duplicates: {set(dups)}"
print("OK: all 9 langs have 18 unique short3 entries")
```

実行結果: ✅ 全 9 言語で 18 タイプ unique。

---

## 🔗 関連

- `i18n/types-master.json` (本検証の対象データ)
- `i18n/runtime.js` (拡張後の `I18N.type(jaName, 'short3')`)
- `HANDOFF_DB01_TO_DB02_2026_05_18.md` §A-2
