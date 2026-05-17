# 本番デプロイ引き継ぎ — 2026-05-17 セッション分

**作成**: 2026-05-17 20:30 JST
**起点セッション**: phase3_pokechan_db ディレクトリで起動した今日のセッション
**目的**: 今日の作業内容を ポケモンDB セッション (`cd ~/Documents/ポケモンDB && claude`) で commit + push してもらう

---

## 🎯 ひとことで

> 今日 (5/17) のセッションで **type_chart ページ + i18n + 姉妹3画面ナビ + メガストーン skeleton 18種** を実装。
> 加えて前セッション (waza_picker 共通モジュール) の未コミット分も一緒に出る。
> Git 状態は全部 working tree。新規ファイル5 + 修正14 = 19 ファイル。
> bak/_review/_apply は gitignore で除外済 → 本番に余計なものは出ない。

---

## 📂 デプロイ対象ファイル

### 🆕 新規ファイル (5)

| ファイル | 内容 | 由来 |
|---|---|---|
| `type_chart.html` | タイプ相性表ページ (攻撃ベース/防御ベース 2 マトリクス + 集計列) | 5/17 セッション |
| `waza_picker.js` (~69KB) | 技選択 UI 共通モジュール JS | プリセッション |
| `waza_picker.css` (~26KB) | 技選択 UI 共通モジュール CSS | プリセッション |
| `HANDOFF_TYPE_CHART.md` | type_chart 関連の引き継ぎ文書 | 5/17 セッション |
| `HANDOFF_WAZA_PICKER_MODULE.md` | waza_picker の引き継ぎ文書 | プリセッション |

### ✏️ 修正ファイル (14)

| ファイル | 主な変更 | 由来 |
|---|---|---|
| `waza-list.html` | waza_picker 共通モジュール化 (大幅 refactor、約 1600 行削減) | プリセッション |
| `battle_simulator.html` | move-picker / stats-picker iframe 統合 + type_chart ナビボタン追加 | 両方 |
| `pokemon_db_v9.html` | type_chart ナビボタン追加 (CSS + JS) | 5/17 セッション |
| `index.html` | type_chart 緑カード追加 + `--green` CSS 変数 | プリセッション |
| `index_en.html` | 同上 (英語版) | プリセッション |
| `i18n/ui-ja.json` | `type_chart` セクション 30 キー (+ プリセッション 39 キー) | 両方 |
| `i18n/ui-en.json` | 同上 (英語訳) | 両方 |
| `i18n/ui-de.json` | 同上 (ドイツ語訳) | 両方 |
| `i18n/ui-es.json` | 同上 (スペイン語訳) | 両方 |
| `i18n/ui-fr.json` | 同上 (フランス語訳) | 両方 |
| `i18n/ui-it.json` | 同上 (イタリア語訳) | 両方 |
| `i18n/ui-ko.json` | 同上 (韓国語訳) | 両方 |
| `i18n/ui-zh-Hans.json` | 同上 (簡体中文訳) | 両方 |
| `i18n/ui-zh-Hant.json` | 同上 (繁体中文訳) | 両方 |

### 🚫 gitignore で除外 (デプロイされない)

- `bak/` — 全 HTML/JSON バックアップ
- `_review/items_database.json` — 検討用、未公開
- `_review/bak/items_database.20260517_201545.bak.json` — 同上
- `_review/_apply_mega_skeletons.py` — 一回限りスクリプト
- `i18n/_apply_type_chart.py` — 一回限りスクリプト (`i18n/*.py` パターン)
- `i18n/__pycache__/`

---

## 🚀 推奨デプロイ手順

### Option A: 2 commit に分ける (推奨)

履歴が読みやすい。waza_picker と type_chart は独立した作業なので分ける価値あり。

```bash
cd ~/Documents/ポケモンDB

# === Commit 1: waza_picker 共通モジュール (プリセッション分) ===
git add waza_picker.js waza_picker.css \
        waza-list.html \
        index.html index_en.html \
        HANDOFF_WAZA_PICKER_MODULE.md

# battle_simulator.html の waza_picker 関連部分のみステージ (-p で対話的)
git add -p battle_simulator.html
# → move-picker-modal / stats-picker-modal / iframe 関連の hunk を y、
#   nav-type-chart の hunk は n でスキップ

git commit -m "$(cat <<'EOF'
feat(waza_picker): 技選択UIを共通モジュール化 + 3画面展開

waza_picker.{js,css} に技選択UI (フィルタ・テーブル・ソート・タイプ
ボタン・ポケモン選択・効果フィルター) を集約。waza-list は単独で
全機能、party_checker/battle_simulator は iframe で URL クエリ
(mode=browse/multi/single, pokemon, lock, slot, initial) を渡して
呼び出し、postMessage で確定値を受け取る構成。

- waza-list.html: waza_picker.{js,css} 読み込みで自動初期化
- battle_simulator.html: move-picker-modal (single) + stats-picker-modal
  (party_checker?stats_only=true) を iframe で開く
- index.html / index_en.html: type_chart カード追加 + --green CSS 変数

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# === Commit 2: type_chart ページ + 姉妹3画面ナビ + i18n (今日分) ===
git add type_chart.html \
        pokemon_db_v9.html \
        i18n/ui-*.json \
        HANDOFF_TYPE_CHART.md
# battle_simulator.html の残り (nav-type-chart 部分)
git add battle_simulator.html

git commit -m "$(cat <<'EOF'
feat(type_chart): タイプ相性表ページ追加 + i18n + 姉妹3画面ナビ

type_chart.html は ① 攻撃ベース / ② 防御ベース の 2 マトリクスを
集計列 (●数/▲数/×数 + 各リスト) 付きで表示。ソート可能。
TYPE_CHART データは battle_simulator.html からコピーし CSV1/2 と全
18 タイプで突合一致 (100%)。

i18n 対応:
- ui-*.json (9 言語) に type_chart セクション 30 キー追加
- static text → data-i18n / data-i18n-html、動的テーブル → I18N.t()
- タイプ名は I18N.type(jaName) で翻訳、i18n:changed で再描画
- 言語スイッチャーは #i18n-switcher-mount に runtime.js が自動挿入

姉妹3画面ナビ追加:
- party_checker / pokemon_db_v9 / battle_simulator の各ナビ末尾に
  「📊 タイプ相性」緑ボタン (#2E8B57 / hover #246B45) を追加
- 別タブで type_chart.html を起動

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# === push (GitHub Pages 自動デプロイ) ===
git push origin main
```

### Option B: 1 commit にまとめる (シンプル)

```bash
cd ~/Documents/ポケモンDB
git add -A  # 全部 (gitignore で bak/_review/_apply は自動除外)
git commit -m "$(cat <<'EOF'
feat: waza_picker 共通モジュール + type_chart ページ + i18n 9 言語

waza_picker.{js,css} に技選択UIを集約し waza-list / party_checker /
battle_simulator の 3 画面で再利用。新規 type_chart.html (タイプ相性表)
を追加し、姉妹3画面ナビにリンク。9 言語 i18n に type_chart セクション
30 キー追加。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

→ シンプルだが、後で「なぜここを変更?」を辿る時に履歴が読みにくい。

---

## ✅ プッシュ前の確認チェックリスト

```bash
cd ~/Documents/ポケモンDB

# 1. 想定どおりのファイルが対象になっているか
git status -s

# 2. 隠れた差分がないか (改行のみ等)
git diff --stat HEAD

# 3. JSON 構文 OK
for f in i18n/ui-*.json; do python3 -c "import json; json.load(open('$f'))" && echo "✓ $f"; done

# 4. type_chart.html を localhost で目視 (port 8765 サーバ動作中なはず)
open http://localhost:8765/type_chart.html
# - 緑ナビボタン「📊 タイプ相性」が DB / チェッカー / バトルシミュレータ の各ページにある
# - type_chart 右上 🌐 から言語切替 → static + 動的テーブル両方が翻訳される
```

---

## 📝 デプロイ後の通常チェック

- https://pchamdb.com/type_chart.html (リダイレクト中なら https://nawomu.github.io/pokechan-db/type_chart.html)
- https://pchamdb.com/index.html → 緑カード「📊 タイプ相性表」をクリックで遷移
- https://pchamdb.com/battle_simulator.html → 右上ナビ末尾に「📊 タイプ相性」緑ボタン
- 各言語 (`?lang=en` 等または右上スイッチャー) で表示確認

---

## 🚫 本デプロイに含まれない作業

| HANDOFF | 残タスク | 規模 | 補足 |
|---|---|---|---|
| **HANDOFF_C5_ITEM_INTEGRATION** | battle_simulator 持ち物プルダウン統合 (114件DB活用) | 大 | 次のメインタスク候補 |
| **HANDOFF_SESSION_2026_05_17** | `waza-list.html` 自体の i18n (158 ハードコード残) | 中 | waza_picker 内部翻訳含む |
| **HANDOFF_TYPE_CHART** D | 未実装メガストーン 21 種の継続監視 | 小 | todo フィールド記録のみ |
| **HANDOFF_TYPE_CHART** E | ゲーム内 verify (skeleton 18 + アイテム 5) | 小 | あべ作業 |
| **HANDOFF_I18N_PUBLISH** | hreflang / `_redirects` / lang サブパス戦略決定 | 中 | あべ判断要 |
| **HANDOFF_PUBLISHING** | ドメイン取得・法的ページ・SEO 基盤 | 別領域 | Cowork 担当 |
| **HANDOFF_AD_STRATEGY** | A-E 各種広告検証・X 補足スレッド | 継続 | 別ライン |

---

## 🔐 メガストーン 18 種データの注意

`_review/items_database.json` の skeleton 18 種 (verify:true) に Bulbapedia/Serebii/攻略大百科一致の標準 Gen6/7 メガシンカ仕様を追記したが、**`_review/` は gitignore で公開されないため本デプロイには含まれない**。

ポケチャン版で独自仕様の可能性ありゲーム内 verify 後に `_review/` の方の verify:true を false に変更 → 後続セッションで battle_simulator 持ち物プルダウン統合 (HANDOFF_C5) に反映する流れ。

参考: `_review/_apply_mega_skeletons.py` (適用スクリプト、参考用に残置)

---

## 関連ファイル

- HANDOFF_TYPE_CHART.md — 今日の type_chart 作業詳細 (A/B/C 完了済)
- HANDOFF_WAZA_PICKER_MODULE.md — プリセッションの waza_picker 設計
- memory: `project_waza_picker_module.md` / `project_type_chart.md` / `project_pokechan_items_db.md`
