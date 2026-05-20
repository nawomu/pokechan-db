# HANDOFF: 2026-05-20 多言語化大規模セッション

**最終更新**: 2026-05-20 JST
**担当**: Claude Opus 4.7 セッション (Codex 5/19 朝サイクル `48413ec` 後続)
**領域**: DB02 (i18n) を主、UX 改善 (Phase 3) を従

## 概要

waza-list / pokemon_db_v9 の多言語化を大幅前進。未翻訳検出 audit ツール導入、
入れ子モーダル削減 (Phase 3 / 案 B) など UX 改善も含む。

**push: 10 commit** (`559d360` 〜 `e27753d`)、本番 pchamdb.com に全反映済み。

---

## Commit 一覧 (時系列)

| # | hash | 内容 |
|---|---|---|
| 1 | `559d360` | waza-list.html 上部 (ナビ/検索/確定バー) i18n 化 + audit 精度向上 (`<style>` + `data-i18n` 要素除外) |
| 2 | `168bd62` | waza-list テーブルヘッダ + フィルタ行 + 動的モードボタン (検索:OR/AND, シングル/複数選択, 全タイプ表示, count) |
| 3 | `4a3d983` | waza-list 効果フィルタ左ラベル 18 個 + テーブルデータ列 (分類/対象/対戦/接触/守貫/カテゴリ/N匹) |
| 4 | `93211ed` | waza-list 技名を `I18N.move()` 経由で多言語化 |
| 5 | `93f2148` | 数字頭技 3 件を 8 言語に追加 (10まんばりき=High Horsepower, 10まんボルト=Thunderbolt, 3ぼんのや=Triple Arrows) |
| 6 | `cc4bef1` | X (@PchamDB) リンクをトップ + 5 ページのフッターに追加 |
| 7 | `b4de9b5` | X カード簡素化 (2 ボタン横並び) + DB ホバー/モーダル多言語化 + 旧 Blob URL 廃止 |
| 8 | `2c8f678` | 未翻訳検出 audit ツール (`?audit=1`) を runtime.js に組み込み |
| 9 | `c738d6e` | 残る固定文「学習絞込バナー」「別タブで開く」を多言語化 |
| 10 | `e27753d` | Phase 3 入れ子モーダル削減 (履歴スタック + 戻るボタン + postMessage) |
| 11 | `2629c54` | HANDOFF 記録 |
| 12 | `9c6a7a1` | i18n:ready / i18n:changed ハンドラを `refreshAllI18nContent()` で共通化 (構造的取りこぼし防止) |
| 13 | `bda31d5` | ?learns=X 絞込バナーを `buildLearnsBanner()` に関数化 + `refreshAllI18nContent` に組み込み |
| 14 | **(本修正)** | **`buildLearnsBanner` スコープ修正: `init()` 内定義を `window.buildLearnsBanner` でグローバル公開、別 `<script>` ブロックの `refreshAllI18nContent` から呼べるように** |

---

## 主要な変更ファイル

### コード
- **`pokemon_db_v9.html`**: 旧 Blob URL 廃止 / `openMovesForPokemon` の i18n 化 + iframe 検出 / pmModal 履歴スタック + 戻るボタン + postMessage 受信 / `?learns=X` バナー多言語化 / ポケモン名ホバー多言語化
- **`waza_picker.js`**: `t*` ヘルパー追加 (tClass/tTarget/tMode/tContact/tGuard/tCategory/tLearnersCount) / render() データ列 i18n 化 / showLearners + setupNameHover + setupDescHover 多言語化 + iframe 検出 postMessage
- **`waza-list.html`**: 上部・テーブルヘッダ・フィルタ行・効果フィルタ左ラベルに `data-i18n` 計 80+ 箇所付与 / script タグに `?v=20260520b` cache buster
- **`index.html`**: X (@PchamDB) 2 ボタン (フォロー + シェア) を cheer-section 内に配置
- **`i18n/runtime.js`**: 未翻訳検出 audit ツール (`?audit=1`) 組み込み
- **`i18n/audit_i18n_coverage.py`**: `<style>` 除外 + `data-i18n` 付き要素のテキスト除外で精度向上
- **法務系 4 ファイル** (`terms/privacy/disclaimer/contact.html`): フッターに X リンク追加

### ui-*.json (9 言語、各 約 +60 キー)
- **waza.\*** (66 キー): 上部・ヘッダ・フィルタ・ホバー・モード・データ列・習得・急所・no_learners 等
- **db.\*** (110 キー): nav_*, tip_*, modal_movelist_title, learns_filter_banner, modal_back 等
- **index.\*** (14 キー): x_follow_label / x_share_label
- **メイン辞書** (`<lang>.json`) の moves に数字頭技 3 件追加 (8 言語)

---

## 重要な設計判断

### 1. 入れ子モーダル削減 (案 B 採用、Phase 3)
- **問題**: pokemon_db_v9 → モーダル A (waza-list iframe) → モーダル B (pokemon_db iframe) → モーダル C... と 3〜4 段重なる UX 問題
- **検討**: 1 段制限+新タブ / 履歴スタック / サイドパネル / ページ遷移
- **採用**: モーダル 1 個再利用 + 履歴スタック + 「← 戻る」+ postMessage
- **動作**: iframe 内クリックは `window.parent.postMessage({type:'pchamdb:openInModal', url, title}, '*')` で親に依頼 → 親が `pushModalLocation` で iframe.src を切替 + 履歴 push

### 2. 未翻訳検出 audit ツール (`?audit=1`)
- **目的**: 「何度も日本語に戻る」問題への根本対策
- **動作**: 非 ja 言語で DOM 内の日本語 (ひらがな/カタカナ/漢字) を検出 → console.warn + 赤枠ハイライト
- **使い方**: `https://pchamdb.com/pokemon_db_v9.html?audit=1` でアクセス、言語切替 → コンソールにリスト
- **手動再走査**: `window.I18N_AUDIT.detect()` (コンソール)
- **除外**: `data-i18n-audit-skip` 属性

### 3. 旧 Blob URL 廃止
- **旧**: openWazaList → waza-list-template.html (5/17、未 i18n) を Blob URL で開く → 「わざリストリンクが違うページに飛ぶ」と認識される
- **新**: waza-list.html を直リンク + `?pokemon=X` クエリで初期フィルタ
- **遺物**: `waza-list-template.html` は残存 (削除はあべ確認待ち)

### 4. キャッシュ対策
- iframe.src に `&v=Date.now()` (動的)
- waza-list.html の `<script src>` に `?v=20260520b` (静的、将来 build script で自動更新)
- 「iframe 内 JS が古いキャッシュ」問題に対応

### 5. 翻訳の責任分離
- **HTML 側**: `data-i18n` / `data-i18n-attr` / `data-i18n-html` で静的要素
- **JS 側**: 動的生成は `I18N.t / move / type / pokemon / ability` 経由
- **ヘルパー** (waza_picker.js): tClass / tTarget / tMode / tContact / tGuard / tCategory / tLearnersCount

---

## 対象外 (意図的に多言語化せず残した部分)

あべ判断「**タグ/効果の整理サイクル待ち**」:
- 効果フィルタパネルの ef-chip 群 (👊 パンチ系 / 💤 ねむり 等の約 130 個)
- テーブル本体「効果」列の説明文
- 大ホバーポップアップのタグバッジ (30%ひるみ、100%ねむり 等)

→ これらは「タグサブ階層」「バトルフェーズ対応付け」の整理サイクルで一気に多言語化予定

---

## 残課題 / 次サイクル

1. **`en.json` オフセットずれバグ**: `supiidosuwappu` キーに `name: "High Horsepower"` が誤マッピング (本来 Speed Swap)。fetch スクリプトの再検証必要。多言語データ全体に同様のずれがある可能性。
2. **`_en.html` 系 6 ファイル** (index_en / making_en / terms_en / privacy_en / disclaimer_en / contact_en) のフッターに X リンク未追加
3. **タグ・効果の整理サイクル** (あべ主導予定): 効果文を体系化、タグサブ階層導入、バトルフェーズ対応
4. **build バージョン自動化**: `?v=20260520b` は手動。デプロイ時に sed で自動置換する build.sh が欲しい
5. **localStorage の言語非依存化**: 「タブ1」など localStorage に日本語で保存された値は言語切替で更新されない
6. **`waza-list-template.html` の削除可否**: Phase 3 で完全に不要、削除はあべ確認待ち

---

## 開発・運用情報

### ローカル開発サーバ
```bash
killall cfprefsd
PID=$(pgrep -x ScopedBookmarkAgent) && kill -9 "$PID"
/usr/bin/pkill -f 'http.server 8080'
python3 -m http.server 8080 --bind 127.0.0.1 --directory ~/Documents/ポケモンDB
```

### audit ツール使用
- 本番: <https://pchamdb.com/pokemon_db_v9.html?audit=1>
- ローカル: <http://127.0.0.1:8080/pokemon_db_v9.html?audit=1>
- 非 ja モードに切替 → DOM 内日本語が赤枠 + コンソール出力
- 個別除外: `data-i18n-audit-skip` 属性

### コミットルール (再掲)
- `git add .` / `-A` / `commit -a` **禁止** (他セッション巻き込み防止)
- 個別ファイル指定 → `git diff --cached --stat` で確認 → commit → push
- 詳細: `HANDOFF_COMMIT_RULES_2026_05_18.md`

### Phase3 系統 (未コミット、触らない方針)
- `HANDOFF_PHASE3_C5_TURNEND.md` (M), `battle_simulator.html` (M), `party_checker.html` (M), `type_chart.html` (M)
- `HANDOFF_PHASE3_FULL_TURN_SIM.md`, `real_battle_simulator.html` (untracked)
- あべ判断「バトルシミュレータは一旦保留」のため温存中

---

## 学んだこと / 注意点

1. **ブラウザキャッシュは強敵**: 同 URL は中身が変わってもキャッシュから読まれる。`?v=` cache buster + DevTools "Disable cache" 両方覚える。
2. **iframe は独立した window**: localStorage は共有するが初期化シーケンスは別。i18n:changed の再レンダリングは親のみ、iframe 内は自前。
3. **動的生成内の固定日本語を見落としやすい**: `\`${m.name} を習得 ${n}匹\`` の「を習得」「匹」を I18N で囲み忘れる → audit ツールで一括検出可。
4. **postMessage は便利**: iframe ↔ 親通信に `type:'xxx'` で区別、小さなペイロード。
5. **i18n キー命名戦略**: 既存 (`table.*`, `checker.*`, `db.*`) を最大限再利用 → 9 言語 × N キーの新規コストを抑える。
6. **CLAUDE.md / Karpathy 原則を継続遵守**: 実装前に考える / シンプルさ優先 / 外科的変更 / ゴール駆動。Cat Wu 教訓 100% 成功率も意識。あべから「動作確認なしで push するな」と叱られた経験あり (今後必ず確認依頼してから push)。
7. **i18n:ready と i18n:changed は同じ処理を呼ぶ**: 別々に書くと片方だけ更新を忘れて取りこぼしが発生する。**必ず共通関数 `refreshAllI18nContent()` を経由する** (pokemon_db_v9.html で 12 番目の修正で対応)。iframe 内初回ロードで列ヘッダが日本語のまま残るバグの根本原因がこれだった。新しい再描画処理を追加するときも `refreshAllI18nContent()` を更新するだけで両方のイベントに反映される。

## 構造的取りこぼし防止チェックリスト (今後のため)

新しい翻訳対応を追加する時、以下を確認:

1. ☑ HTML 静的要素なら `data-i18n` / `data-i18n-attr` / `data-i18n-html` を付与したか
2. ☑ JS 動的生成なら `I18N.t()` / `I18N.move()` / `I18N.type()` / `I18N.pokemon()` / `I18N.ability()` を経由しているか
3. ☑ テンプレートリテラル内の固定日本語 (`「を習得」` 等) を I18N キー化したか
4. ☑ 9 言語すべてに翻訳キーを追加したか (差分 0 維持: `python3 i18n/audit_i18n_coverage.py`)
5. ☑ 動的に再描画される箇所なら `i18n:ready` と `i18n:changed` の **両方** で再描画されるか (`refreshAllI18nContent()` 経由が望ましい)
6. ☑ iframe で開かれる場合、`window.parent !== window` で iframe 検出して postMessage を使うか
7. ☑ ブラウザキャッシュ対策が必要なら `?v=` cache buster を script タグ or iframe.src に付与
8. ☑ `?audit=1` で本番に確認、未翻訳テキストが赤枠 + コンソールに出ないこと
9. ☑ 動作確認してから push (あべの指示: 「動作確認なしで push しない」絶対)
10. ☑ **スコープ確認**: `refreshAllI18nContent` から呼ぶ関数が **別 `<script>` ブロックや `init()` 関数内に定義されている** 場合、`window.xxx = function() {...}` でグローバル公開する。`typeof xxx === 'function'` は他スコープでは false になり、サイレントに呼ばれない (commit 14 の事例)。

## 多言語化の落とし穴パターン集 (他ページでも遭遇しうる)

### パターン A: 動的バナー / ヘッダーが初回ロード時のみ生成され、言語切替で更新されない
- **症状**: 初回 (i18n 未準備時) に日本語 fallback で生成 → そのまま残る
- **対処**: 関数化 → `refreshAllI18nContent` に登録 (commit 13)

### パターン B: i18n:ready と i18n:changed で別々の処理 → 片方だけ更新忘れ
- **症状**: 切替時は OK だが初回ロードで日本語残り (またはその逆)
- **対処**: 共通関数に集約 (commit 12)

### パターン C: 関数を別スコープから呼べない
- **症状**: 関数は定義しているのに `typeof xxx === 'function'` が false で呼ばれない
- **対処**: `window.xxx = function() {...}` でグローバル公開 (commit 14)

### パターン D: iframe 内で modal を開くと入れ子地獄
- **症状**: モーダル内 iframe で技名クリック → さらにモーダル → 3〜4 段重なる
- **対処**: postMessage で親に依頼 + 履歴スタック (commit 10、Phase 3 案 B)

### パターン E: iframe 内が言語切替に追従しない (古い JS キャッシュ)
- **症状**: iframe を開いた時、内部の JS が古いキャッシュで動く
- **対処**: iframe.src + script src に `?v=` cache buster (commit 7、本番では build スクリプト化推奨)

### パターン F: メイン辞書 (`<lang>.json`) のキー欠損 (数字頭技、新規追加技)
- **症状**: 特定の技だけ英語名にならず日本語のまま
- **対処**: 9 言語すべての moves セクションに該当キーを追加 (commit 5)

### パターン G: 翻訳された辞書のオフセットずれ (要再検証)
- **症状**: ある技のキーに別の技の英語名が誤マッピング (例: `supiidosuwappu` ↔ `High Horsepower`)
- **対処**: fetch スクリプトの検証必要 (残課題 #1)

## 他ページに同じ多言語化を進める時のガイド

`waza-list.html`、`type_chart.html`、`battle_simulator.html`、`party_checker.html` 等で
同様の i18n 対応を進める際:

1. **`?audit=1` で未翻訳をリストアップ**してから始める
2. 動的要素があれば「パターン A〜C」を確認、必要に応じて関数化 + 共通再描画関数登録
3. iframe で開かれる可能性があれば「パターン D〜E」を実装
4. メイン辞書の欠損は `python3 i18n/audit_i18n_coverage.py` で監視
5. 各段階で動作確認 → push (パターン的に守れていない場合は HANDOFF を再読)
