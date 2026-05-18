# サイト全体 Lighthouse audit + 改善提案レポート — 2026-05-18

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB02 (タスク M)
**audit ツール**: `npx lighthouse@13.3.0` (Mobile form-factor, 4 カテゴリ)
**audit 対象**: 主要 6 ページ (本番 URL)
**対象指示書**: `HANDOFF_DB01_TO_DB02_2026_05_18_NEXT3.md` (タスク M)

---

## 🎯 ひとことで

> 主要 6 ページの Lighthouse audit (Mobile) を完遂。**SEO は全ページ満点**、**A11y はページにより 67-95 と振れ大**、**Performance は 42-74 で全ページ「Reduce unused JS」が 1.2-1.9 秒の改善余地**、**Best Practices は third-party cookie 由来で全ページ 73-77 横並び**。
>
> 改善 PR は 5/19 以降。最優先は **(1) AdSense 遅延ロード / unused JS 削減** / **(2) ブランド色 contrast 見直し (全ページ共通 A11y 減点)** / **(3) フォーム label 付与 (Battle Simulator / Pokédex / Move List)** の 3 つ。

---

## 📊 M-1: ページ別スコア (Mobile)

| Priority | ページ | URL | Perf | A11y | SEO | BP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|---|
| 1 | トップ | `/` | **42** | 95 | 100 | 77 | 10.4 s | **0.453** | 10 ms |
| 2 | Pokédex | `/pokemon_db_v9.html` | 47 | 82 | 100 | 77 | 9.4 s | 0.128 | 380 ms |
| 3 | Party Checker | `/party_checker.html` | **74** | 92 | 100 | 73 | 9.3 s | 0.058 | 70 ms |
| 4 | Move List | `/waza-list.html` | 49 | 83 | 100 | 77 | 9.1 s | 0.212 | 80 ms |
| 5 | Battle Simulator | `/battle_simulator.html` | 71 | **67** | 100 | 77 | 5.9 s | **0** | 60 ms |
| 6 | Making | `/making.html` | 43 | 95 | 100 | 77 | 8.3 s | **0.410** | 30 ms |
| 参考 | Type Chart | `/type_chart.html` (P303 既存) | 89 | 90 | — | — | — | 0.202 | — |

凡例: 太字 = 注目値 (高い / 低い)。Type Chart は P303 が 5/18 に audit 済 (改善後 Perf 47 → 89)。

### 主要メトリクスの観察

- **LCP がほぼ全ページ 8〜10 秒台** (Battle Simulator のみ 5.9 秒) — Web Vitals の "Poor" 域。本番でも改善が体感に直結
- **CLS はページ依存に大きく振れる**: トップ 0.453 / Making 0.41 が悪化、Battle Simulator 0、Party Checker 0.058 は良好
- **TBT は全ページ 380 ms 以下** で大きな問題なし (Pokédex 380 ms のみ要注意)
- **FCP**: Party Checker のみ 1.1 秒で優秀、他は 3.4〜6.1 秒 (JS 重い影響)

---

## 🔍 横断的な改善候補 (優先順)

### Performance (全ページ Perf 42-74 → 80+ 狙い)

#### P-1: AdSense / 楽天 widget の遅延ロード ★★★
- **対象**: 全 6 ページ (全ページで `Reduce unused JavaScript` が 1.2〜1.9 秒の改善余地)
- **現状**: AdSense / 楽天 が同期的に読み込まれて FCP / LCP を遅延
- **改善案**:
  - AdSense: `async` + `IntersectionObserver` 経由でビューポート手前で初回ロード
  - 楽天 widget: 既に `ad-toggle.js` で動的制御済 (0b31bca) → 遅延ロード化拡張
- **期待効果**: LCP 2-3 秒短縮 / Perf スコア +15〜25
- **工数**: 中 (2-3 時間) / **影響範囲**: 全ページ
- **オーナー候補**: DB02 (ad-toggle.js owner)

#### P-2: Cache-Control / 圧縮 ★★
- **対象**: 静的アセット (HTML / CSS / JS) 全般
- **現状**: Cache-Control ヘッダの最適化余地あり (Netlify / Cloudflare の設定)
- **改善案**: `_headers` または Cloudflare Page Rules で immutable 化
- **期待効果**: リピート訪問 LCP 短縮 (初回は不変)
- **工数**: 小 (30 分-1 時間)

#### P-3: 大量データの virtualization (Pokédex / Move List) ★
- **対象**: `pokemon_db_v9.html` / `waza-list.html` (TBT 380 ms / 80 ms)
- **現状**: 1000 件超のリスト一括描画
- **改善案**: IntersectionObserver による段階描画 / `content-visibility:auto`
- **期待効果**: TBT < 100 ms / LCP 1-2 秒短縮
- **工数**: 中-大 (3-5 時間)
- **オーナー候補**: DB02 / P302

---

### Accessibility (ページにより 67-95、要改善箇所多い)

#### A-1: ブランド色 color-contrast 見直し ★★★ (全ページ共通)
- **対象**: 全 6 ページ (weight 7 の減点が全ページに存在)
- **現状**: 一部テキスト / バッジ等で contrast 比 4.5:1 を下回る箇所あり
- **改善案**: ブランドカラーパレットの darker / lighter バリエーション追加、半透明テキスト見直し
- **期待効果**: A11y +5〜10 / 全ページ統一
- **工数**: 中 (2-4 時間、デザイン判断要)
- **オーナー候補**: **あべ判断要** (ブランドアイデンティティに影響)

#### A-2: フォーム label / select の関連付け ★★★ (データ系)
- **対象**: `pokemon_db_v9.html` / `waza-list.html` / `battle_simulator.html` (weight 10 減点)
- **現状**:
  - **Pokédex / Move List**: `<select>` 要素に label / `aria-label` なし
  - **Battle Simulator**: `<select>` + form elements に label なし
- **改善案**: 各 `<select>` に `aria-label` / 関連 `<label>` を付与
- **期待効果**: A11y +8〜15 (特に Battle Simulator 67 → 85+ 期待)
- **工数**: 小-中 (1-2 時間)
- **オーナー候補**: Pokédex → DB02 / Move List → P302 / Battle Simulator → P301 or P302

#### A-3: Touch targets (タップ領域) ★★ (データ系)
- **対象**: `pokemon_db_v9.html` / `waza-list.html` / `battle_simulator.html` (weight 7)
- **現状**: 一部ボタン / リンクが 48×48 px 未満で隣接
- **改善案**: タップ領域を 48px 以上 / padding 増 / 間隔確保
- **期待効果**: A11y +3〜5、モバイル UX 向上
- **工数**: 中 (2-3 時間)

#### A-4: main landmark 不在 ★ (データ系)
- **対象**: `pokemon_db_v9.html` / `waza-list.html` (weight 3)
- **現状**: `<main>` 要素なし or 不適切
- **改善案**: `<main>` ラッパ追加 (P303 が type_chart で `a2fa5a3` 適用済の手法)
- **期待効果**: A11y +2〜3
- **工数**: 小 (15-30 分)

#### A-5: Battle Simulator 特有 ★
- **対象**: `battle_simulator.html` (A11y 67、最低スコア)
- **追加項目**:
  - **Heading elements are not in a sequentially-descending order** (weight 3) — h1 → h3 のスキップ等
- **オーナー候補**: P301 (本体 owner)

#### A-6: Party Checker 特有 ★
- **対象**: `party_checker.html`
- **追加項目**:
  - **Links do not have a discernible name** (weight 7) — `aria-label` なしのアイコンリンク
- **オーナー候補**: P301 (party_checker も触る範囲)

---

### CLS (Cumulative Layout Shift)

#### C-1: トップページの cards-section CLS ★★★
- **対象**: `/` (CLS 0.453、Poor 域)
- **現状**: `body > main.cards-section` で大きなレイアウトシフト
- **推定原因**: 画像 / カード要素の width/height 未指定 / 後置 JS による DOM 注入
- **改善案**: `aspect-ratio` 指定 / 画像 width-height 明示 / カード pre-size
- **期待効果**: CLS 0.453 → 0.1 以下、Perf 大幅改善
- **工数**: 中 (2-3 時間)

#### C-2: Making の body CLS ★★
- **対象**: `making.html` (CLS 0.41)
- **推定原因**: AdSense / 楽天 widget の遅延描画による body shift
- **改善案**: 広告枠 pre-size / `aspect-ratio` 指定
- **期待効果**: P-1 と併せて改善

#### C-3: Move List の body CLS ★
- **対象**: `waza-list.html` (CLS 0.212)
- **推定原因**: フィルタバー / 大量行の段階描画によるシフト
- **改善案**: P-3 (virtualization) と併せて検討

---

### Best Practices (全ページ 73-77、ほぼ同一の減点パターン)

#### BP-1: Third-party cookies (構造的) — 対応見送り
- **対象**: 全 6 ページ (weight 5 減点)
- **現状**: Google AdSense / 楽天アフィリエイトが third-party cookie を使用
- **対応**: **収益化に必須のため改善見送り**。将来 AdSense / 楽天が Privacy Sandbox 対応すれば自然改善
- **影響**: BP 95 → 77 になっている主因 (5 点減点) ← 受容

#### BP-2: Console errors / DevTools Issues panel
- **対象**: 全 6 ページ (weight 1 減点)
- **改善案**: 各ページの Console 警告 / Issues panel を確認し潰す (要個別調査)
- **工数**: 小-中 (1-2 時間)

#### BP-3: Party Checker の `Serves images with low resolution`
- **対象**: `party_checker.html` のみ (weight 1)
- **改善案**: ポケモン画像で 1x サイズが小さい箇所を 2x / WebP 化
- **工数**: 中 (画像生成 + 差し替え)

---

### SEO (全ページ 100)

✅ 改善余地なし。維持を継続。

---

## 🚦 5/19 以降の改善 PR 候補 (優先順)

| 優先 | PR テーマ | 期待 Perf gain | 期待 A11y gain | 対象 | オーナー |
|---|---|---|---|---|---|
| 1 | **AdSense 遅延ロード (P-1)** | +15〜25 | — | 全ページ | DB02 |
| 2 | **ブランド色 contrast 見直し (A-1)** | — | +5〜10 | 全ページ | **あべ判断要** |
| 3 | **フォーム label 付与 (A-2)** | — | +8〜15 | データ系 3 ページ | DB02 / P302 / P301 |
| 4 | **トップページ CLS 修正 (C-1)** | +5〜10 | — | `/` | DB02 / あべ |
| 5 | **大量データ virtualization (P-3)** | +10〜15 | — | Pokédex / Move List | DB02 / P302 |
| 6 | **Touch target サイズ調整 (A-3)** | — | +3〜5 | データ系 3 ページ | データ系 owner |
| 7 | **main landmark 追加 (A-4)** | — | +2〜3 | Pokédex / Move List | DB02 / P302 |
| 8 | **Battle Simulator 個別 A11y (A-5)** | — | +5〜10 | Battle Simulator | P301 |
| 9 | **Party Checker link names (A-6)** | — | +3〜5 | Party Checker | P301 |
| 10 | **Cache-Control 最適化 (P-2)** | リピート訪問のみ | — | 全ページ | DB02 / インフラ |

---

## 📌 取り扱わない / 受容項目

- **BP の third-party cookie 減点** — 収益化必須で構造的、改善見送り (BP 77 が天井)
- **Missing source maps for large first-party JavaScript** — 大量 JS 埋め込み戦略の都合、見送り (weight 0)
- **Type Chart 再 audit** — P303 が `HANDOFF_PHASE3_03_TYPE_CHART_LIGHTHOUSE_2026_05_18.md` で実施済、再計測不要
- **法的ページ (privacy / terms 等) の audit** — 構造類似でサンプリング省略
- **多言語別の audit** — 構造同一でサンプリング省略 (`/index_en.html` 等は別 PR で必要時)

---

## 🔬 計測条件 (再現性)

```bash
npx lighthouse@13.3.0 <URL> \
  --form-factor=mobile \
  --only-categories=performance,accessibility,seo,best-practices \
  --output=json --output-path=./<name>.json \
  --chrome-flags="--headless=new --no-sandbox" \
  --quiet
```

- 実施日時: 2026-05-18 16:57-17:01 JST
- ネットワーク: モバイル simulated (4G slow, 1.6 Mbps)
- CPU: 4x slowdown
- 各ページ 1 回計測 (ばらつき許容)

JSON レポート 6 件: `/tmp/lighthouse_reports/{top,pokedex,party,waza,battle,making}.json` (commit 対象外、ローカルのみ)

---

## 🔗 関連

- 指示書: `HANDOFF_DB01_TO_DB02_2026_05_18_NEXT3.md` (タスク M)
- 完了報告: `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_M.md` (本サイクル)
- P303 type_chart 参考: `HANDOFF_PHASE3_03_TYPE_CHART_LIGHTHOUSE_2026_05_18.md`
- commit ルール: `HANDOFF_COMMIT_RULES_2026_05_18.md`
- HANDOFF カタログ: `HANDOFF_INDEX_2026_05_18.md`
