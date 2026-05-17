# Phase3-03 — type_chart.html UX 改修 引き継ぎ

**作成**: 2026-05-18 JST
**作成セッション**: Phase3-03 (type_chart.html UX 改修担当)
**宛先**: 並行稼働中の Phase3 系セッション (Phase3 オーケストレーター / ポケモンDB セッション 等)
**目的**: 本セッションの変更内容共有 + 領域被り防止 + 残タスク連携

---

## 🎯 ひとことで

> 5/18 朝、type_chart.html を「公式タイプ相性表」に近いデフォルト表示に整える UX 改修を実施。
> 変更は **type_chart.html** と **i18n/ui-ja.json (type_chart namespace 2 キー)** のみ。
> battle_simulator.html / items_database.js / waza_picker.* / 他言語 ui-*.json (en/de/es/fr/it/ko/zh-Hans/zh-Hant) には **一切触っていない**。

---

## ✅ 実施した変更（4 件）

### 1. ヘッダーデザインを姉妹画面と統一

- 旧: `<h1>` 中央寄せ + `.topnav` 青文字テキストリンク列
- 新: `<header class="tc-header">` + `🏠 PchamDB BETA › 📊 タイプ相性表` ブレッドクラム + 右上カラーボタン群
  - ボタン: `🗄️ DB` (#2E86AB) / `🎯 チェッカー` (#27AE60) / `⚔️ シミュレータ` (#C0392B 新規) / `📋 わざリスト` (#F39C12)
  - 言語スイッチャー `#i18n-switcher-mount` は右端維持
- CSS: `header.tc-header` / `.tc-nav` / `.tc-nav-btn` クラス追加（battle_simulator.html の `bs-nav-btn` をクローン）

### 2. タイプ名表記は公式準拠（長表記）で確定

- 一時的に 3 文字短縮 (`ノマル` / `かく` / `エスパ` / `ゴース` / `ドラ` / `フェア`) を実装 → ユーザー判断で **公式長表記に戻す**
- `TYPE_SHORT_JA` 定数 / `tTypeShort()` ヘルパは **削除**
- 行ヘッダー・列ヘッダー・右側バッジすべてが `tType()` 経由 = `I18N.type()` ベースで動作

### 3. 左端に「#」列（正規順）追加 + デフォルトソート変更

- 18 行に `1, 2, …, 18` の番号セル `td.idx-num` を追加（`row.rowIdx + 1`）
- ヘッダー `th.idx-hdr[data-sort="idx"]` をクリックで正規順 (`rowIdx` 昇順) に復帰
  - 昇順 (1→18) で `▼` 表示、降順 (18→1) で `▲` 表示（ユーザー指示「降りる順」を**視覚的下降方向**と解釈）
- `state.sortKey === 'idx'` 分岐を `sortedData()` に追加
- click ハンドラを `th.sum-hdr[data-sort]` → `th[data-sort]` に拡張（# 列も拾う）
- ①攻撃ベース / ②防御ベース 両方の `defaultSort: 'idx', defaultDir: 'asc'` に変更（公式と同じデフォルト並び）
- ●数 / ▲数 / ×数 / 弱点数 / 半減数 / 無効数 の既存ソート挙動は **維持**

### 4. フッター追加 + 説明文 (`atk_note` / `def_note`) 更新

- `<footer class="site-footer">` ブロックを ②防御ベース セクション直後に追加
  - 内容は `index.html` / `disclaimer.html` 等と同じ「非公式注記 + 法的リンク 5 種 + 著作権」
  - `data-i18n="footer.unofficial"` / `data-i18n="footer.not_affiliated"` / `data-i18n="nav.making"` 等は既存キー流用
- フッター CSS は `legal-shared.css` の `footer` ルールを `footer.site-footer` 配下に inline 化（type_chart は legal-shared を import しないため）
- ②セクション以前の `atk_note` / `def_note` の説明文を「デフォルトは ● の多い順 / 弱点数の少ない順」→「デフォルトは正規順（# 列で復帰可）」に書き換え

---

## 📂 タッチしたファイル

| ファイル | 種別 | 行数差 |
|---|---|---|
| `type_chart.html` | 改修 | ヘッダー/ # 列 / フッター追加 + 短縮ヘルパ削除（最終 24,869 bytes） |
| `i18n/ui-ja.json` | キー値更新 | `type_chart.atk_note` / `type_chart.def_note` の 2 キーのみ JA 文言更新 |
| `bak/type_chart.20260517_202220.bak.html` | バックアップ | header 統一前 |
| `bak/type_chart.20260518_020630.bak.html` | バックアップ | # 列追加前 |

**触らなかったファイル**: `battle_simulator.html` / `items_database.js` / `waza_picker.js` / `waza_picker.css` / `pokemon_db_v9.html` / `party_checker.html` / `index.html` / 他言語 `ui-*.json` 8 件 / `_review/` 配下 / `HANDOFF_C5_*.md` / `HANDOFF_COLLAB_*.md`

---

## ⚠️ ポケモンDB セッション (UI/i18n 担当) へのお願い

以下 8 言語の `i18n/ui-*.json` で `type_chart.atk_note` / `type_chart.def_note` が **JA と乖離した状態** になっています。お時間あるときに同期お願いします：

- en / de / es / fr / it / ko / zh-Hans / zh-Hant の 8 ファイル
- 対象キー: `type_chart.atk_note` `type_chart.def_note`
- JA 原典は `ui-ja.json` の最新値（「正規順（公式と同じ並び）」「#列で復帰可」「●数 / 弱点数 列クリックでソート」のニュアンス）

緊急ではない（UI 文言の若干スタレが残るのみ、機能は壊れない）ですが、9 言語揃えるタイミングで合わせて頂けると helpful です。

---

## 🚫 領域被り防止メモ（Phase3 系セッション向け）

### 私 (Phase3-03) が触ったもの → 暫くロックしてください

- `type_chart.html` — 本セッションの作業領域。並行で機能追加が走ると merge 困難
- `i18n/ui-ja.json` の `type_chart.*` namespace — 上記 2 キー変更後の状態

### 私が触っていないもの → 引き続き他セッション領域

- `battle_simulator.html` — Phase3 オーケストレーター (C5 持ち物統合) 領域
- `items_database.js` / `_review/items_database.json` — Phase3 オーケストレーター
- `waza_picker.js` / `waza_picker.css` / `waza-list.html` — 共通モジュール、Phase3 オーケストレーター
- `pokemon_db_v9.html` / `party_checker.html` — ポケモンDB セッション (UI/i18n)
- `index.html` / `index_en.html` — ポケモンDB セッション (UI 改善 + i18n)
- 法的ページ (`terms.html` / `privacy.html` / `disclaimer.html` / `contact.html` + 各 `_en.html`) — ポケモンDB セッション
- 他言語 `ui-*.json` 8 件 — 上記お願い対象 (ポケモンDB セッション)

### 共有判断が必要

- `i18n/ui-ja.json` 全体: 私は `type_chart.*` 内のみ触っており、`db.*` `checker.*` 等の Phase3 / ポケモンDB セッションの追加領域は無変更。push 前に `git diff i18n/ui-ja.json` で範囲確認推奨

---

## 🧪 動作確認

- Chrome (macOS) で `file://` 直接開きで確認:
  - ① 攻撃ベース / ② 防御ベース 両方が **正規順 (ノーマル→フェアリー)** で初期描画
  - 左端 `#` 列に 1〜18 が降順表示（公式画像と同じ並び）
  - `●数` / `▲数` / `×数` / `弱点数` / `半減数` / `無効数` クリックで個別ソート可能、`#` クリックで戻る
  - 行/列ホバー、右側集計バッジ、言語スイッチャー、楽天広告バー、ページトップに戻るボタン等は既存通り動作
  - フッター: 「⚠️ 当サイトは非公式ファンサイトです」+ 5 リンク (制作の裏側 / 利用規約 / プライバシー / 免責 / お問い合わせ) + 著作権文 — index.html と同等

---

## 🔮 残タスク / 検討候補（Phase3-03 が手を出さず申し送り）

1. **他言語 8 言語の `atk_note` / `def_note` 同期** — ポケモンDB セッション (上述)
2. **`atk_note_v2` 等の新キー化** — 現状は既存キー上書き。COLLAB ルール「既存キー変更は要連絡」に沿うなら別キー化が安全。今回は JA 1 言語のみで影響最小化したため上書き選択
3. **`<title>` / `<meta name="description">` の SEO 文言** — 今回未変更。`type_chart.html` の `<title>` は `data-i18n="type_chart.title_h1"` のまま（i18n 経由で「タイプ相性表 - PchamDB (非公式)」）。SEO 強化したい場合は別途
4. **モバイル横スクロール時の `#` 列スティッキー化** — 18 列 + 集計 6 列で横長。`position:sticky;left:0` で # と行ヘッダーを固定すると見やすいが、現状は実装せず（既存の `scroll-x` overflow 動作のまま）
5. **HANDOFF_TYPE_CHART.md の追記** — 初版 HANDOFF (5/17) に「5/18 UX 改修」のサマリ追記が望ましい（今回は専用 HANDOFF として本ファイルを新規作成）

---

## 🔗 関連 HANDOFF / memory

- **`HANDOFF_INDEX_2026_05_18.md`** ← 5/18 全 HANDOFF (12 件) のインデックス + 依存図 + 担当領域マップ。**5/19 起動時は最初にここを読む**
- `HANDOFF_POKEMONDB_FINAL_2026_05_18.md` — ポケモンDB セッション 本日最終報告 Part 1 (T1-T5)
- `HANDOFF_POKEMONDB_PART2_2026_05_18.md` (推定 push 済 / `f791421`) — Part 2 (T6-T11: OGP + JSON-LD)
- `HANDOFF_PROGRESS_2026_05_18_PHASE3.md` v1+v2+v3 — Phase3 メイン進捗報告 (focus_sash / HANDOFF 整理 / 監査)
- `HANDOFF_TYPE_CHART.md` (5/17 初版実装) — このページの設計・i18n 経緯
- `HANDOFF_COLLAB_2026_05_18.md` (5/18 朝) — Phase3 / ポケモンDB セッション間の touch ルール（本ファイルはそのルール準拠）
- `HANDOFF_C5_STATUS_2026_05_18.md` — Phase3 オーケストレーター進捗（独立、被りなし）
- `HANDOFF_PHASE3_SIMULATOR.md` — battle_simulator 全体設計（type_chart とは別領域）
- `HANDOFF_PHASE3_C5_TEST_SCENARIOS.md` / `HANDOFF_PHASE3_C5_TURNEND.md` / `HANDOFF_PHASE3_INIT_B.md` — Phase3 メインの 5/18 設計検討
- `HANDOFF_SEO_SETUP_2026_05_18.md` / `HANDOFF_LEGAL_PAGES_I18N_2026_05_18.md` — ポケモンDB SEO + i18n 調査
- memory: `project_type_chart.md` — このページの実装メモ（更新候補）

---

## 🤝 5/18 三セッション協業の総括（Phase3-03 視点）

- **Phase3 メイン** (オーケストレーター): 9-10 commits、focus_sash 実装、C5 系設計検討 3 件、HANDOFF INDEX 作成、私の waza-list 依頼を完遂（未 commit）→ 完全終了宣言
- **ポケモンDB セッション** (UI/i18n/SEO/push 担当): 11 commits、Phase C i18n / sitemap / 法的ページ調査 / OGP / JSON-LD schema markup の充実、全 push 担当
- **Phase3-03** (本セッション): type_chart UX 改修 (公式準拠の長表記復帰 + 左端 # 列 + フッター + デフォルトソート変更) と他セッションへの依頼まとめ

合計 **21 commits 本番 push 済** + Phase3-03 working tree に **5 ファイル 4 種類の差分** が残存 (commit 待ち)。3 セッション同時並行が touch 領域競合ゼロで機能した稀な日。

---

## 📊 git 状態（本セッション視点 / 5/18 終電前）

```
M  type_chart.html              ← Phase3-03 (本セッション)
M  i18n/ui-ja.json               ← Phase3-03 (type_chart namespace 2 キー)
M  waza-list.html                ← Phase3 メインが私の依頼で追加 (未コミット)
M  waza_picker.css               ← Phase3 メインが私の依頼で追加 (未コミット)
?? HANDOFF_PHASE3_03_TYPE_CHART_UX.md  ← Phase3-03 (本ドキュメント)
?? bak/type_chart.20260518_020630.bak.html  ← Phase3-03 バックアップ
?? bak/type_chart.20260517_202220.bak.html  ← Phase3-03 バックアップ
```

**push 判断**: 5/18 のパターン (Phase3 系 → ポケモンDB02 が代理 push) 踏襲。本 working tree の push は **ポケモンDB02 へ依頼** (下記 `📤 ポケモンDB02 への push 依頼` セクション参照)。

---

## 📤 ポケモンDB02 への push 依頼（5/18 終局 / Phase3-03 → ポケモンDB02）

> **依頼者**: Phase3-03 (type_chart UX 改修担当)
> **被依頼者**: ポケモンDB02 セッション (5/18 push 担当として 21+ commits 代理 push 済)
> **依頼日**: 2026-05-18
> **依頼理由**: Phase3 系セッションは push 権限を持たない運用、Phase3-03 working tree に残る差分を origin/main へ反映するため
> **状況更新 (07:55 JST)**: waza-list ナビ追加は **Phase3 メインが `2fcba45` で対応・ポケモンDB02 が push 済**。本依頼書は **Phase3-03 本体 (type_chart UX 改修) の push のみ**に縮小。

### 🎯 push する内容（1 commit のみ）

#### Commit: `feat(type_chart): 公式準拠 + 左端 # 列 + フッター + ヘッダー統一 (Phase3-03)`

**対象ファイル**:
```
type_chart.html                                ← Phase3-03
i18n/ui-ja.json                                ← Phase3-03 (type_chart namespace 2 キーのみ)
HANDOFF_PHASE3_03_TYPE_CHART_UX.md             ← Phase3-03 (本ファイル、新規)
bak/type_chart.20260517_202220.bak.html        ← Phase3-03 バックアップ (新規)
bak/type_chart.20260518_020630.bak.html        ← Phase3-03 バックアップ (新規)
```

**変更概要** (commit message body 案):
```
- ヘッダーを battle_simulator と同デザインに統一 (🏠 PchamDB > 📊 タイプ相性表 + 右上カラーボタン4種)
- タイプ名は公式準拠の長表記で確定 (短縮ロジック完全削除)
- 左端 # 列 (1〜18) 追加、クリックで正規順 (公式デフォルト) に復帰
- ●数 / ▲数 / ×数 / 弱点数 / 半減数 / 無効数 の既存ソートは維持
- ①攻撃ベース / ②防御ベース 両方のデフォルトを # asc (公式と同じ並び) に変更
- フッター追加 (非公式注記 + 法的5リンク + 著作権、index.html と統一デザイン)
- atk_note / def_note を新デフォルト挙動に合わせて更新 (ja のみ、他8言語は別セッション同期予定)
```

### 🚀 push 手順（ポケモンDB02 が実行）

```bash
cd ~/Documents/ポケモンDB

# 0. 事前確認
git pull --ff-only                          # 最新を取得
git status -s                                # 差分が想定通り (M ui-ja.json / M type_chart.html / ?? HANDOFF_PHASE3_03_*.md) か確認
git diff --stat type_chart.html i18n/ui-ja.json

# 1. Commit
git add type_chart.html i18n/ui-ja.json \
        HANDOFF_PHASE3_03_TYPE_CHART_UX.md \
        bak/type_chart.20260517_202220.bak.html \
        bak/type_chart.20260518_020630.bak.html
git commit -m "$(cat <<'EOF'
feat(type_chart): 公式準拠 + 左端 # 列 + フッター + ヘッダー統一 (Phase3-03)

- ヘッダーを battle_simulator と同デザインに統一 (🏠 PchamDB > 📊 タイプ相性表 + 右上カラーボタン4種)
- タイプ名は公式準拠の長表記で確定 (短縮ロジック完全削除)
- 左端 # 列 (1〜18) 追加、クリックで正規順 (公式デフォルト) に復帰
- ●数 / ▲数 / ×数 / 弱点数 / 半減数 / 無効数 の既存ソートは維持
- ①攻撃ベース / ②防御ベース 両方のデフォルトを # asc (公式と同じ並び) に変更
- フッター追加 (非公式注記 + 法的5リンク + 著作権、index.html と統一デザイン)
- atk_note / def_note を新デフォルト挙動に合わせて更新 (ja のみ、他8言語は別セッション同期予定)

Co-Authored-By: Phase3-03 session <noreply@anthropic.com>
EOF
)"

# 2. push
git push origin main

# 3. 反映確認
git log --oneline -3                         # commit が origin/main に乗ったか確認
curl -sI https://pchamdb.com/type_chart.html | head -3  # 本番反映 (キャッシュ次第で 1-5 分)
```

### ✅ push 後の本番反映チェック (ポケモンDB02 が実施 / 任意)

- [ ] `https://pchamdb.com/type_chart.html` を開き、左端 # 列が 1〜18 で表示されるか確認
- [ ] ヘッダーが「🏠 PchamDB BETA › 📊 タイプ相性表」+ 右上カラーボタン4種で表示されるか確認
- [ ] type_chart のフッターが index.html と同じデザインで表示されているか確認
- [ ] 言語スイッチャーで EN/中文等に切替時、ナビと # 列が崩れないか確認
- [ ] モバイル幅 (Chrome DevTools 360px) でヘッダー・# 列・フッターが折り返し対応されているか

### ⚠️ ポケモンDB02 への補足

- Phase3-03 はここで作業終了 → 本ファイル含む差分を **そのまま push** して問題なし
- 他言語 8 ファイル (`ui-en.json` 等) の `type_chart.atk_note` / `def_note` 同期は **別セッション (5/19 以降のポケモンDB セッション) で対応** 予定。本 push には含めなくて良い
- 万一 push 前に conflict が出たら `git pull --rebase origin main` で解消、本ファイルの内容は素直に勝たせて OK
- waza-list ナビ追加分 (`2fcba45`) は既に push 済のため本 push には含まれない

---

## 📨 他セッションへの依頼: `type_chart.html` リンクを残ページに反映

ユーザー (あべ) から **5/18 朝に追加指示**: 「トップページおよび他のページについても、右上の遷移部分などに『相性表』へのリンクを追加してほしい」

私 (Phase3-03) で **type_chart.html 内のナビは整備済み** (`🗄️ DB` / `🎯 チェッカー` / `⚔️ シミュレータ` / `📋 わざリスト`)。各ページから type_chart への逆方向リンクは 5/17 の `HANDOFF_TYPE_CHART.md` A 項で「完了」とされていましたが、**今日改めて棚卸ししたところ 1 ページ欠けが確定** + 細部の不揃いがあるため、以下のとおり対応依頼です。

### 🟥 ~~欠落（必須対応）: `waza-list.html`~~ → ✅ **完了 (Phase3 メイン 2026-05-18 07:50 JST / commit `2fcba45`)**

- **対応者**: Phase3 メインセッション (本依頼を受け実装)
- **本対応 commit**: `2fcba45 feat(nav): waza-list にタイプ相性ナビボタンを追加 (Phase3-03 依頼)`
- **並行追加対応**: ポケモンDB02 も独立に対応 (`c4a0d63 waza-list: 📊 タイプ相性ナビボタンを追加 + 完了報告書`) → `3f60868` で「Phase3 メインが本対応者」と整合訂正済
- **対応内容** (HEAD/origin/main に反映済):
  - `waza-list.html` line 66 に `<button class="nav-type-chart" ... data-i18n="nav.type_chart">📊 タイプ相性</button>` 追加
  - `waza_picker.css` に `.top-bar button.nav-type-chart { background: #2E8B57; }` + hover `#246B45` 追加
  - `data-i18n="nav.type_chart"` (既存 9 言語キー流用) で多言語対応済
- **バックアップ**: `bak/waza-list.20260518_075127.bak.html` / `bak/waza_picker.20260518_075127.bak.css` (Phase3 メイン取得)
- **本番反映**: https://pchamdb.com/waza-list.html で目視確認可能 (ナビ右端の緑ボタン)

### 🟧 既に整備済みのページ（再確認のみ、変更不要）

| ページ | 現状 | 確認位置 |
|---|---|---|
| `index.html` | カード `class="card green"` で type_chart.html へリンク済み (📊 タイプ相性表) | line 418〜 |
| `index_en.html` | 同上 (英語版 Type Chart) | line 334〜 |
| `party_checker.html` | `pc-nav-btn nav-type-chart` 動的生成 | line 1731-1735 |
| `battle_simulator.html` | `bs-nav-btn nav-type-chart` 静的 | line 547 |
| `pokemon_db_v9.html` | `tab-waza-btn nav-type-chart` 動的生成 | line 1720-1723 |

→ これら 5 ページは変更不要。`waza-list.html` のみ追加で姉妹 6 ページの揃い踏みが完成。

### ❓ `index.html` の追加対応について（ユーザー意図の確認候補）

ユーザー (あべ) は明示的に「**トップページ**および他のページについても、**右上の遷移部分などに** 相性表へのリンクを追加」と発言。`index.html` には **既にカード型リンクがある**ものの、姉妹ページのような**右上のナビボタン**は存在しない (ヒーローエリア + カードグリッド設計のため)。

判断候補:
- **(A) 現状維持**: 既にカードがあるので追加不要 (推奨)
- **(B) ヒーロー上部に簡易ナビ追加**: 他ページと UI 一貫性を取りたい場合、`🗄️ DB / 🎯 チェッカー / ⚔️ シミュレータ / 📋 わざリスト / 📊 タイプ相性` のボタン群を hero 上に薄く配置
- **(C) ユーザーに再確認**: 「トップページにナビバーを追加する必要があるか、それともカードで十分か」

→ ポケモンDB セッション (index.html 担当) で **(C) を採用してあべに確認** が安全。`index_en.html` も同様。

### 🟨 補足対応候補（優先度低）

- **`making.html` / `making_en.html`**: 現状 breadcrumb のみで姉妹画面ナビ無し。コンテンツ記事ページなので type_chart リンクを追加するかはユーザー判断（ポケモンDB セッション領域）
- **法的ページ** (`terms.html` / `privacy.html` / `disclaimer.html` / `contact.html` + 各 `_en.html`): フッターの「ホーム」リンクのみで姉妹ナビ無し。これも通常は不要

### 📝 完了報告フォーマット案

waza-list.html 対応完了時、HANDOFF_COLLAB_2026_05_18.md または専用ハンドオフに以下のメモを残して頂けると Phase3-03 として把握しやすいです:

```
- [x] waza-list.html: 📊 タイプ相性 ナビボタン追加 (Phase3 オーケストレーター, YYYY-MM-DD)
- [x] バックアップ: bak/waza-list.YYYYMMDD_HHMMSS.bak.html
- [x] data-i18n="nav.type_chart" を付与 (9 言語対応済キー)
```

これで姉妹画面 6 ページの type_chart リンクが完全に揃います。
