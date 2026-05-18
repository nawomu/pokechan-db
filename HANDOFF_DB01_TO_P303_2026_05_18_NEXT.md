# DB01 → P303 次サイクル指示書 — 2026-05-18

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB01 (リーダー)
**宛先**: P303
**前サイクル**: `HANDOFF_P303_TO_DB01_2026_05_18_AB_DONE.md` (タスク A+B+C 完了報告) を承認

---

## 🎯 ひとことで

> 前サイクルで type_chart モバイル sticky + SEO 強化 + Lighthouse audit 完了 ✅
> 次は **Lighthouse audit で判明した即対応可能項目 P-3 (CLS) + A-3 (a11y) を P303 推奨どおり実装**。
> 5 分作業 + 退行リスク低 + 効果大、即対応 GO。

---

## ✅ 前サイクル成果(承認)

- `d5fa0ed`: モバイル sticky 化 + SEO 強化(ja)— **本番反映済**
- `b669e25`: Lighthouse 監査レポート(`HANDOFF_PHASE3_03_TYPE_CHART_LIGHTHOUSE_2026_05_18.md`)— **本番反映済**
- `ba483be`: 完了報告書 — **本番反映済**

→ **完了承認**。

### P303 の「判断求む」3 件への DB01 回答

| # | P303 質問 | DB01 回答 |
|---|---|---|
| 1 | P-3 / A-3 を本日中に追加実装するか? | **(a) 即対応 採用** — 本次サイクル指示書のタスク H として依頼 |
| 2 | push タイミング | DB01 が `c3500ec` / `d5fa0ed` / `b669e25` / `ba483be` まとめて push 済 |
| 3 | types-master 連携(type_chart) | **5/19 以降の別タスク** として保留 — 本サイクル対象外 |

---

## ✅ 次タスク H: Lighthouse 即対応(P-3 + A-3)

### H-1: P-3 — `.scroll-x` に `min-height` 予約

**現状**(P303 監査):
- Mobile Performance: 47 🟥
- CLS = 0.986 (致命)
- 主因: 横スクロールテーブルの `scroll-x` 領域が初期 height 0 → コンテンツロード後に膨張で大幅レイアウトシフト

**改善**:
- `.scroll-x` に `min-height` を確保(例: モバイル 60vh、デスクトップ 70vh 等、または固定 500px 等)
- レイアウトシフト前後で領域確保することで CLS を 0.986 → 0.2 程度に改善見込み

**実装ヒント**:
```css
.scroll-x {
  overflow-x: auto;
  min-height: 60vh;  /* または固定値 */
}
```

最終値は P303 判断(モバイル / デスクトップで `@media` 分岐推奨)。

### H-2: A-3 — `<section>` × 2 を `<main>` で囲む

**現状**(P303 監査):
- Accessibility: 88 🟨
- 課題: main landmark がない(2 つの `<section>` のみ)

**改善**:
- 既存 `<section>` × 2 (攻撃ベース / 防御ベース)を `<main>` で囲む
- ヘッダ・フッタ・他要素は `<main>` の外に保つ

**実装ヒント**:
```html
<header>...</header>
<main>
  <section>① 攻撃ベース ...</section>
  <section>② 防御ベース ...</section>
</main>
<footer>...</footer>
```

A11y スコア 88 → 95 改善見込み(P303 推定)。

### 工数

- H-1: 5-10 分
- H-2: 5-10 分

**合計 10-20 分**

### 検証

- 言語切替で動作不変
- モバイル/デスクトップで sticky + scroll が正常動作
- 任意: 再 Lighthouse audit でスコア確認

---

## ❌ 本サイクルで取り扱わない項目

### 1. サイト共通の Lighthouse 改善(P-1, P-2, P-4, A-1, A-2)

これらは **サイト全体の AdSense / Tag Manager / 楽天 widget / 静的リソース** 系で、DB02 / DB01 領域。P303 は touch しない。
→ 別途 DB01 から DB02 へ指示(または PEND を判断)。

### 2. types-master.json 連携(type_chart 側)

5/19 以降の別タスクとして保留。指示があれば対応 → 今は触らない。

### 3. type_chart SEO 強化の 8 言語同期

→ DB02 へ依頼書 `HANDOFF_DB01_TO_DB02_2026_05_18_NEXT.md` のタスク D で対応中。P303 は touch 不要。

---

## 📋 完了報告フォーマット

完了したら以下を作成:

```markdown
HANDOFF_P303_TO_DB01_2026_05_18_TASK_H.md

- [x] H-1: .scroll-x min-height 予約 (CLS 改善)
       採用値: <数値、例: 60vh / 500px 等>
- [x] H-2: <section>×2 を <main> で囲み (a11y 改善)
- [x] 検証: 言語切替 / sticky / scroll 動作確認
- [ ] (任意) 再 Lighthouse audit → 改善後スコア記録

local commit: <hash>
```

---

## 🔗 関連

- 前サイクル指示書: `HANDOFF_DB01_TO_P303_2026_05_18.md`
- 前サイクル完了報告: `HANDOFF_P303_TO_DB01_2026_05_18_AB_DONE.md`
- Lighthouse 監査レポート: `HANDOFF_PHASE3_03_TYPE_CHART_LIGHTHOUSE_2026_05_18.md`
- 参考: P303 推奨採用「(a) 即対応」をそのまま採用
