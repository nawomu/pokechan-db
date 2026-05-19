# DB02 → DB01 タスク N 完了報告 — 2026-05-19

**作成**: 2026-05-19 11:48 JST
**作成セッション**: DB02 (5/19 再開)
**宛先**: DB01
**前サイクル成果物**: `HANDOFF_LIGHTHOUSE_SITEWIDE_2026_05_18.md` (タスク M)
**本タスクの起点**: あべからの「Lighthouse 改善 PR を進めて」指示

---

## 🎯 ひとことで

> 5/19 朝サイクル、Lighthouse 改善 PR の第 1 弾を実施。
> 当初の本命「P-1: 楽天 widget 遅延ロード」は **document.write 制約で技術的不可能** と判明し方針転換 →
> **C-1: トップ CLS 修正 (img width/height 追加)** を代替実施し push 済 (`c826c7b`)。
> CLS 0.453 → 0.1 以下、Perf スコア +5〜10 を期待。

---

## ✅ 完了項目

### push 済 commit

| commit | 内容 | 効果見込み |
|---|---|---|
| `c826c7b` | `index.html` / `index_en.html` の hero img 計 5 か所に `width="..." height="..."` 属性を追加 (intrinsic ratio で CSS の `max-width` + `width:%` + `height:auto` はそのまま機能) | CLS 0.453 → 0.1 以下 / Perf +5〜10 |

### 対象画像 (intrinsic dimension 指定)

- `branding/logo/logo_main_clean.png` 675×304 (ja + en 両方の hero-logo)
- `branding/logo/logo_pchamdb_jp.png` 724×90 (ja のみ hero-logo-jp)
- `branding/characters/pchan_main.png` 467×479 (cheer-char、CLS シフト最大要因)

### commit ルール準拠の確認

- 個別ファイル指定で `git add` (`. / -A / commit -a` 不使用)
- `git diff --cached --stat` で混入なし確認 (index.html + index_en.html のみ)
- working tree の P301 領域 (`battle_simulator.html` / `party_checker.html`) は **touch せず** 残置 (これは P301 が UX 変更後 あべ確認待ちで停止中のため、5/18 から続く既存状態)

---

## 🔬 試行錯誤の経緯 (重要な学習)

### 当初の方針: P-1 楽天 widget 遅延ロード (B-3 + B-1)

`HANDOFF_LIGHTHOUSE_SITEWIDE_2026_05_18.md` の P-1 (Reduce unused JavaScript 1.2-1.9 秒の改善余地) に着手。

**実装**:
- 全 11 ページ HTML (DB02 owner 範囲) の `<script type="text/javascript" src="rakuten_widget.js">` を `<script type="text/lazy-rakuten" data-src="rakuten_widget.js">` に書き換え
- `ad-toggle.js` に `loadRakutenWidget()` + `setupLazyAdLoad()` を追加 (requestIdleCallback + 初回ユーザーアクションでロード)

**ローカル検証で発覚した致命的問題**:
- ブラウザで開くと楽天バーが空のまま広告 iframe が生成されない
- 切り分けの結果、`rakuten_widget.js` (https://xml.affiliate.rakuten.co.jp/widget/js/rakuten_widget.js?20230106) は `document.write('<iframe ...>')` を **3 か所**で使用していると判明
- HTML5 仕様により、JS で動的 inject された `<script>` から呼ばれた `document.write` は **何も起きない or document が空になる**
- → 「placeholder script + JS で後 inject」方式は楽天 widget には **根本的に使えない**

**対応**: 全 12 ファイル変更を `git checkout -- <個別ファイル>` で revert (P301 領域は touch せず、working tree は元の P301 modified 状態に戻った)

### 方針転換: C-1 (確実な代替)

技術的な不確実性を排除し、確実に効果が出る項目に切り替え:
- C-1 (トップ CLS): `index.html` のみで完結、DB02 owner、画像 width/height 追加のみ → 副作用ゼロ・効果確実
- → 実装 → ローカル検証 (見た目崩れなし) → commit + push

---

## 🚨 5/19 朝の追加発見 (別調査推奨)

**楽天 widget の「ぐるぐる」現象**:
- C-1 検証中、楽天バーの広告 iframe が **ローディングスピナーのまま広告が表示されない**現象をあべが目視
- あべの確認: **本番環境 (pchamdb.com) でも同症状** = ローカル特有ではない
- 私のセッションの今日の変更とは **無関係** (`ad-toggle.js` は revert 済、変更は img タグの width/height のみ)
- ※その後あべの再確認で「**正常に商品 3 件が表示**」を確認 — 楽天サーバ側の一時的な遅延だった可能性が高い
- 推奨: 今後の DB01 集約サイクルで、最近の commit (`0b31bca` 等の ad-toggle.js MutationObserver 追加) との因果切り分けを別調査タスク化

---

## 📊 5/19 以降の改善 PR 残候補 (Lighthouse audit より、優先順)

P-1 が技術的に難しいと判明したため、**次の優先候補は以下**:

| 優先 | テーマ | オーナー | 備考 |
|---|---|---|---|
| **1** | C-1 補強: 他ページの `<img>` width/height 棚卸し (pokemon_db_v9 / Pokédex 等の Sprite 画像) | DB02 / P302 | 同じパターンで全ページに展開可能 |
| 2 | C-2 / C-3: making.html / waza-list の body CLS | DB02 / P302 | AdSense 承認後の pre-size 設計が必要 |
| 3 | A-1 ブランド色 contrast 見直し | **あべ判断要** | デザイン影響大 |
| 4 | A-2 フォーム label 付与 (Pokédex / Move List / Battle Simulator) | データ系 owner 分散 | 確実な A11y 改善 |
| 5 | P-1 楽天 widget 遅延ロード (**iframe wrapper 方式で再挑戦**) | DB02 | 新規 `rakuten_frame.html` 作成 + 各ページ HTML を `<iframe>` に置換、中で楽天 script が動く (document.write が新規 document で機能)。工数中、検証必要 |
| 6 | P-2 Cache-Control / 圧縮 (Cloudflare 設定) | DB02 / インフラ | _headers ファイル or Page Rules |

P-1 の iframe wrapper 方式は本タスクで時間内検証ができなかったため、別 PR として慎重設計推奨。

---

## 📌 注意・補足

- **P301 領域**: working tree に `battle_simulator.html` / `party_checker.html` の未 commit が **5/18 から継続中**。あべの UX 確認待ちで停止と引き継ぎあり。DB02 本タスクでも touch せず残置 (commit ルール準拠)
- **AdSense 審査中** (pub-8021399778265482, 5/18 20:17 申請、4 週間程度想定): 今回の C-1 変更は HTML の `<img>` 属性追加のみで、AdSense タグ・ポリシー周りには一切影響なし
- **本番反映**: `c826c7b` push 済 → Cloudflare / Netlify の自動デプロイで数分以内に pchamdb.com に反映予定
- **再計測**: 本番反映後、あべに PageSpeed Insights (https://pagespeed.web.dev/) で `https://pchamdb.com/` を再計測してもらうと CLS 改善の数値確認可能

---

## 🔗 関連

- 前サイクル成果物: `HANDOFF_LIGHTHOUSE_SITEWIDE_2026_05_18.md` (Lighthouse audit + 改善 PR 候補 10 件)
- 前サイクル完了報告: `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_M.md`
- commit ルール: `HANDOFF_COMMIT_RULES_2026_05_18.md` (本タスク準拠)
- HANDOFF カタログ: `HANDOFF_INDEX_2026_05_18.md`

local + push 済 commit: `c826c7b` (`origin/main` 反映済、`07545c9..c826c7b`)
