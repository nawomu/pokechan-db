# DB01 → DB02 次サイクル指示書 — 2026-05-18

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB01 (リーダー)
**宛先**: DB02
**前サイクル**: `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_AB.md` (タスク A+B 完了報告) を承認

---

## 🎯 ひとことで

> 前サイクルで types-master + runtime.js 拡張 + pokemon_db_v9 対応すべて完了 ✅
> 次は **P303 が ja 版で行った type_chart SEO 強化を 8 言語に同期** を主タスクとして依頼。
> あべ判断 4 件は本書では取り扱わず、別途あべに確認 → 判断後に追加指示。

---

## ✅ 前サイクル成果(承認)

- `c3500ec`: 全 18 タイプ × 9 言語 × 4 表記 マスター辞書 + short3 識別表記化 — **本番反映済**
- types-master.json / runtime.js / pokemon_db_v9 すべて検証 OK
- 識別性検証(`types-master-verify.md`)も品質高い、海外 wiki 慣習も調査済
- pokemon_db_v9.html の Filter/Exclude chip がランタイム言語切替で短縮表記が切り替わる動作 → 本番反映済

→ **完了承認**。あべ判断 4 件は私(DB01)からあべに確認します。

---

## ✅ 次タスク D: type_chart SEO 強化を 8 言語に同期翻訳

### 背景

P303 が `d5fa0ed` で type_chart の SEO を強化:

| 要素 | 改訂後 (ja) |
|---|---|
| `<title>` | タイプ相性表・**弱点早見表** - **ポケモンチャンピオンズ用タイプ図鑑** - PchamDB (非公式) |
| `<meta name="description">` | **ポケモンチャンピオンズ向け** タイプ相性表・**弱点早見表**。全18タイプの相性マトリクスと**攻撃範囲・耐性リスト**を集計列付きで一覧... |
| `og:title` / `twitter:title` | 上記同様 |
| `og:description` / `twitter:description` | 上記同様 |
| WebApplication JSON-LD `name` / `description` | 上記同様 |
| `ui-ja.json` `type_chart.title_h1` | タイプ相性表・弱点早見表 - ポケモンチャンピオンズ用タイプ図鑑 - PchamDB (非公式) |

ja のみ更新済。**en/ko/zh-Hant/zh-Hans/fr/de/it/es の 8 言語が古いまま** → これを同期翻訳依頼。

### 成果物

#### D-1. `i18n/ui-*.json` の `type_chart.title_h1` を 8 言語に同期

各言語で同等の SEO キーワード(ポケモンチャンピオンズ / 弱点早見表 / タイプ図鑑相当語句)を含めて訳す。

参考: ja 改訂版「タイプ相性表・弱点早見表 - ポケモンチャンピオンズ用タイプ図鑑 - PchamDB (非公式)」

ヒント:
- **ポケモンチャンピオンズ**: en = "Pokémon Champions" / fr = "Pokémon Champions" / de = "Pokémon Champions" / it = "Pokémon Champions" / es = "Pokémon Champions" / ko = "포켓몬 챔피언스" / zh-Hant = "寶可夢冠軍" / zh-Hans = "宝可梦冠军"
- **弱点早見表**: en = "weakness chart" / "quick reference" / fr = "table des faiblesses" / de = "Schwächen-Übersicht" / it = "tabella debolezze" / es = "tabla de debilidades" / ko = "약점 일람표" / zh-* = "弱點速查表" / "弱点速查表"
- **タイプ図鑑**: en = "type chart" / "type guide" / fr = "guide des types" / de = "Typen-Handbuch" / it = "guida ai tipi" / es = "guía de tipos" / ko = "타입 도감" / zh-* = "屬性圖鑑" / "属性图鉴"

#### D-2. type_chart.html の OGP/Twitter meta も同期 (任意、判断委任)

type_chart.html 自体は静的に ja の og:title / og:description が書かれている。
- ja: 既に P303 が強化済
- 他言語版が存在しない(type_chart.html は単一 URL でランタイム言語切替)

→ **og:* meta は触らない**。multiple alternate locale で対応済(8 言語 alternate も既に追加済)。
→ **D-1 のみで OK**。

#### D-3. JSON-LD 内の `name` / `description` の多言語化 (任意、判断委任)

現状 type_chart.html の WebApplication JSON-LD は `inLanguage: ja` 固定の ja 文言。
→ 多言語化は将来検討(JSON-LD を 9 言語切替する仕組みが必要、現時点ではスコープ外)。
→ **D-1 のみで OK**。

### 工数

- D-1 のみ: **30-45 分**(8 言語 × `type_chart.title_h1` 1 キーの翻訳 + JSON 構文検証)

### 検証

- `for f in i18n/ui-*.json; do python3 -c "import json; json.load(open('$f'))" && echo "✓ $f"; done`
- 各言語で `type_chart.title_h1` が長くなりすぎていないか(80 字以内推奨)

---

## 📤 P302/P303 への展開依頼の保留について

DB02 報告書末尾「P302/P303 への展開依頼」(タイプ表示を `I18N.type(t, 'short3')` 経由に統一)について:

- **P302 への展開**: 私(DB01)から P302 への次サイクル指示書 `HANDOFF_DB01_TO_P302_2026_05_18_NEXT.md` に組み込み済 → P302 が対応
- **P303 への展開**: type_chart は既に `I18N.type(t)` を使用、後方互換で問題なし。将来 short3 化したい場合は 5/19 以降の別タスク

→ DB02 から再依頼は **不要**。DB01 経由で振り分け済。

---

## ❌ あべ判断 4 件は本書では対象外

DB02 報告書の「あべ判断仰ぎ要事項 4 件」(英語 Dark/Steel 略、ドイツ語 Electric、中国語 Psychic、日本語 2 文字) は **私(DB01)からあべに確認する** スコープ。判断回答が出たら別途追加指示を出します。

→ DB02 は **現状の types-master.json の short3 採用案で動作している前提** で次タスク D に集中して OK。

---

## 📋 完了報告フォーマット

完了したら以下を作成:

```markdown
HANDOFF_DB02_TO_DB01_2026_05_18_TASK_D.md

- [x] D-1: 8 言語の type_chart.title_h1 を SEO 強化版に同期
- [x] 検証: JSON 構文 9/9 OK
- [x] (任意) 8 言語の長さチェック (80 字以内目安)

local commit: <hash>
```

---

## 🔗 関連

- 前サイクル指示書: `HANDOFF_DB01_TO_DB02_2026_05_18.md`
- 前サイクル完了報告: `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_AB.md`
- P303 SEO 強化 commit: `d5fa0ed`
- P303 完了報告: `HANDOFF_P303_TO_DB01_2026_05_18_AB_DONE.md` (の Task B)
