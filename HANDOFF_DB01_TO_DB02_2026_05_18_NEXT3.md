# DB01 → DB02 次サイクル指示書 #3 — 2026-05-18

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB01 (リーダー)
**宛先**: DB02
**前サイクル**: `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_J.md` (タスク J 完了) を承認

---

## 🎯 ひとことで

> 前サイクルで HANDOFF_INDEX 32 件版 + 楽天 iframe a11y(MutationObserver)完了 ✅
> 次は **サイト全体 Lighthouse audit** — P303 が type_chart 単体で実施した audit を他 16 ページに展開、改善余地を洗い出し。
> 並行して **`HANDOFF_COMMIT_RULES_2026_05_18.md`** を必読(commit 操作ルール、全セッション周知)。

---

## ✅ 前サイクル成果(承認)

- `0b31bca`: HANDOFF_INDEX 32 件版 + 楽天 iframe title 9 言語動的付与 — **本番反映済**
- INDEX 32/32 件カバー、5 セッション体制反映、52 commits 統計反映
- 楽天 iframe a11y: MutationObserver + i18n:changed 連動 + 多重付与防止フラグ、設計綺麗

→ **完了承認**、ad-toggle.js 統合の判断も賢明(新ファイル増やさず、15 ページに自動展開)。

---

## 📢 必読: HANDOFF_COMMIT_RULES_2026_05_18.md

本サイクル指示書と一緒に `HANDOFF_COMMIT_RULES_2026_05_18.md` を新規作成しました。

**背景**: P302 報告書(`HANDOFF_P302_TO_DB01_2026_05_18_TASK_G.md`)で commit 巻き込み事故が判明。
4-5 セッション並行運用での **`git add .` / `-A` / `commit -a` 禁止** ルールを全セッション周知。

DB02 も以下を実施:
1. 作業開始時に `git pull origin main` + `git status -s`
2. commit 前に `git add <個別ファイル>`(`.` / `-A` 不使用)
3. `git diff --cached --stat` で他セッションのファイル混入なしを確認
4. commit 実行

→ 詳細は `HANDOFF_COMMIT_RULES_2026_05_18.md` を参照。

---

## ✅ 次タスク M: サイト全体 Lighthouse audit

### 背景

P303 が type_chart.html 単体で Lighthouse audit を実施 → **Performance 47/47 → 89** の劇的改善(`HANDOFF_PHASE3_03_TYPE_CHART_LIGHTHOUSE_2026_05_18.md`)。

サイト全体(全 17 ページ)で同様の audit を実施すれば:
- 各ページの **Performance / Accessibility / SEO / Best Practices** スコアを定量化
- 横断的な改善余地(AdSense / 楽天 widget / Cache-Control / contrast 等)を洗い出し
- 5/19 以降の改善 PR の優先順設定に活用

### 成果物

#### M-1: 主要ページの Lighthouse audit 実施

対象ページ(優先順):

| Priority | ページ | URL | 注記 |
|---|---|---|---|
| 1 | トップ | https://pchamdb.com/ | hero + カード型 |
| 2 | Pokédex | https://pchamdb.com/pokemon_db_v9.html | 大量データ、最も重要 |
| 3 | Party Checker | https://pchamdb.com/party_checker.html | 対戦準備ツール |
| 4 | Move List | https://pchamdb.com/waza-list.html | 大量データ |
| 5 | Battle Simulator | https://pchamdb.com/battle_simulator.html | 新規導線 |
| 6 | Type Chart | (P303 既存 audit、参考のみ、再 audit 不要) | (除外) |
| 7 | Making | https://pchamdb.com/making.html | 記事系 |
| 8 | トップ EN | https://pchamdb.com/index_en.html | 多言語ベンチ |

→ **5-6 ページ程度**で十分(法的ページ等は構造類似のためサンプリング)。

audit ツール:
- **PageSpeed Insights**(https://pagespeed.web.dev/、本番 URL を入力)が最も手軽
- または Chrome DevTools > Lighthouse タブ
- または ローカルで `npx lighthouse <url> --output html --output-path ./report.html`(P303 が type_chart で使用した方法)

カテゴリ:
- Performance / Accessibility / SEO / Best Practices(PWA は manifest 設定済なので低優先)
- form-factor: **mobile**(モバイル優先)+ **desktop**(任意)

#### M-2: 改善提案レポート作成

各ページのスコア + 主要メトリクス(LCP / CLS / FCP)を表形式でまとめる:

```markdown
HANDOFF_LIGHTHOUSE_SITEWIDE_2026_05_18.md (新規)

## ページ別スコア (Mobile)

| ページ | Perf | A11y | SEO | BP | 主要課題 |
|---|---|---|---|---|---|
| index.html | xx | xx | xx | xx | (CLS / LCP 等) |
| pokemon_db_v9.html | xx | xx | xx | xx | ... |
...

## 横断的な改善候補

### Performance
- AdSense 遅延ロード (全ページ)
- 楽天 widget pre-size (全ページ)
- 大量データの virtualization (pokemon_db_v9 / waza-list)

### Accessibility
- ブランド色 contrast (全ページ)
- iframe title 動的付与 (✅ 0b31bca で対応済、確認のみ)
- ...

### SEO
- 全ページ 100 点維持 (現状)
- ...

## 5/19 以降の改善 PR 候補
1. AdSense 遅延ロード (Priority 高、サイト全体)
2. ブランド色 contrast 見直し (Priority 中、デザイン影響大)
3. ...
```

### 工数

- M-1: 5-6 ページの audit 実施(各 2-5 分、合計 30-45 分)
- M-2: レポート作成(30-45 分)

**合計 60-90 分**

### 注意

- 監査は **本番 URL** で実施(ローカルだと AdSense 等の影響が出ない)
- 時間帯によってネットワーク遅延が変動 → 1 ページにつき 1 回で OK(ばらつきは許容)
- スコアは「目安」、メトリクスの方が改善優先順に効く

---

## ❌ 本サイクルで取り扱わない項目

- M で判明した改善実装 → 5/19 以降の別 PR
- AdSense 遅延ロード(全体最適、別 HANDOFF で慎重に)
- ブランド色 contrast 見直し(デザイン判断要、あべ判断)
- types-master / Search Console / 法的ページ Option B 等の前出項目

---

## 📋 完了報告フォーマット

```markdown
HANDOFF_DB02_TO_DB01_2026_05_18_TASK_M.md

- [x] M-1: Lighthouse audit 実施 (5-6 ページ、Mobile)
- [x] M-2: 改善提案レポート作成 (HANDOFF_LIGHTHOUSE_SITEWIDE_2026_05_18.md)
- [x] 検証: スコア記録 / 改善余地リスト

local commit: <hash>
```

---

## 🔗 関連

- 前サイクル指示書: `HANDOFF_DB01_TO_DB02_2026_05_18_NEXT2.md`
- 前サイクル完了報告: `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_J.md`
- P303 type_chart audit (参考): `HANDOFF_PHASE3_03_TYPE_CHART_LIGHTHOUSE_2026_05_18.md`
- commit ルール: `HANDOFF_COMMIT_RULES_2026_05_18.md` (本サイクル同時 push、全セッション必読)
- HANDOFF カタログ: `HANDOFF_INDEX_2026_05_18.md` (DB02 で 32 件版に更新済)
