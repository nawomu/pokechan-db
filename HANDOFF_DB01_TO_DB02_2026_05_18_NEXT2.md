# DB01 → DB02 次サイクル指示書 #2 — 2026-05-18

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB01 (リーダー)
**宛先**: DB02
**前サイクル**: `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_VA_D.md` (タスク VA + D 完了) を承認

---

## 🎯 ひとことで

> 前サイクルで types-master 中国語 Psychic 修正 + 8 言語 type_chart SEO 同期 すべて完了 ✅
> 次は **HANDOFF_INDEX_2026_05_18.md の更新**(5/18 大量 HANDOFF が増えたので一覧再整理)。
> + 任意で 楽天 widget iframe title 動的付与 (Lighthouse audit で判明した a11y 改善)。

---

## ✅ 前サイクル成果(承認)

- `bb7464c`: VA (Psychic 超能力) + D (8 言語 type_chart SEO 同期、全 80 字以内) — **本番反映済**
- 各言語の SEO キーワード(ポケモンチャンピオンズ / 弱点早見表 / タイプ図鑑相当語)が綺麗に統一
- types-master.json と verify.md の整合性も OK、一意性再検証 9/9 PASS

→ **完了承認**。

---

## ✅ 次タスク J-1: HANDOFF_INDEX_2026_05_18.md の更新(主タスク、必須)

### 背景

5/18 で大量 HANDOFF が増加(計 30+ 文書 in 5/18)。前回 P302 が `fa6e8a5` で作った `HANDOFF_INDEX_2026_05_18.md` は 12 件版 → 現在は **増えた分が未反映**。

### 成果物

`HANDOFF_INDEX_2026_05_18.md` を更新:

1. **新規 HANDOFF を追加リスト化**(5/18 夜以降に作られた分):
   - `HANDOFF_OGP_META_2026_05_18.md`
   - `HANDOFF_JSON_LD_SCHEMA_2026_05_18.md`
   - `HANDOFF_POKEMONDB_FINAL_PART2_2026_05_18.md`
   - `HANDOFF_NAV_TYPE_CHART_DONE_2026_05_18.md`
   - `HANDOFF_POKEMONDB02_2026_05_18_PART3.md`
   - `HANDOFF_DB01_TO_DB02_2026_05_18.md` / `_NEXT.md` / `_NEXT2.md` (本書) / `_VERIFY_ANSWER.md`
   - `HANDOFF_DB01_TO_P302_2026_05_18.md` / `_NEXT.md`
   - `HANDOFF_DB01_TO_P303_2026_05_18.md` / `_NEXT.md`
   - `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_AB.md` / `_TASK_VA_D.md`
   - `HANDOFF_P302_TO_DB01_2026_05_18_TASK_C.md` / `_TASK_G.md`
   - `HANDOFF_P303_TO_DB01_2026_05_18_AB_DONE.md` / `_TASK_H.md`
   - `HANDOFF_PHASE3_03_TYPE_CHART_LIGHTHOUSE_2026_05_18.md`
   - `HANDOFF_PHASE3_TO_OTHERS_2026_05_18.md` / `HANDOFF_PHASE3_03_TO_OTHERS_2026_05_18.md`
   - `HANDOFF_SEO_SETUP_2026_05_18.md` / `HANDOFF_LEGAL_PAGES_I18N_2026_05_18.md` / `HANDOFF_SESSION_TOPOLOGY_2026_05_18.md`

2. **担当領域別に再分類**(現状の表に DB01/DB02/P301/P302/P303 列を加えて整理):

```markdown
| 文書 | 担当 | 種別 | 状態 |
|---|---|---|---|
| HANDOFF_DB01_TO_DB02_*.md | DB01→DB02 | 指示書 | ✅ |
| HANDOFF_DB02_TO_DB01_*.md | DB02→DB01 | 完了報告 | ✅ |
...
```

3. **依存関係マップ更新**(5/18 夜のサイクル運用フローを反映):

```
DB01 (指示書) → 各セッション → 完了報告 → DB01 (集約 + 次指示書) → ループ
P301 (あべ直管理、ループ外)
```

4. **5/18 通算 commit / push 数の最新化**(現在 50+ commits)

### 工数

20-30 分

### 検証

- `ls -la HANDOFF_*2026_05_18*.md | wc -l` で実数と INDEX 記載数が一致
- 各 HANDOFF のリンクが有効

---

## ✅ 次タスク J-2: 楽天 widget iframe title 動的付与 (任意、a11y 改善)

### 背景

P303 の Lighthouse 監査(`HANDOFF_PHASE3_03_TYPE_CHART_LIGHTHOUSE_2026_05_18.md`)で **A-2 サイト共通 a11y 課題** と判明:
- 楽天モーションウィジェットの iframe に `title` 属性なし → スクリーンリーダで識別不可
- これは **DB02 領域**(サイト全体に効く a11y 改善)

### 成果物

`ad-toggle.js` または独立スクリプト(`a11y-fix.js` 新規 可)で:

1. **MutationObserver** で `rakuten-motion-bar` 配下の iframe 出現を監視
2. iframe 出現後に `title="広告: 楽天モーションウィジェット (PR)"` (ja) / `title="Ad: Rakuten Motion Widget (PR)"` (en) 等を動的付与
3. 9 言語対応で `I18N.t('common.rakuten_widget_title', '広告: 楽天モーションウィジェット (PR)')` 使用推奨

実装例:
```javascript
const obs = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType === 1 && node.tagName === 'IFRAME') {
        const parent = node.closest('#rakuten-motion-bar');
        if (parent && !node.title) {
          node.title = (window.I18N && I18N.t)
            ? I18N.t('common.rakuten_widget_title', '広告: 楽天モーションウィジェット (PR)')
            : '広告: 楽天モーションウィジェット (PR)';
        }
      }
    }
  }
});
obs.observe(document.body, { childList: true, subtree: true });
```

- 9 言語の `common.rakuten_widget_title` 翻訳キー追加(`ui-*.json` の `common` namespace 末尾)
- 全 17 HTML に対象スクリプトが読み込まれることを確認(rakuten widget が出るページ範囲)

### 工数

30-45 分(実装 + 9 言語キー追加 + 検証)

### 検証

- Chrome DevTools で iframe 出現後に title 属性が付くか確認
- スクリーンリーダ(VoiceOver Mac)で読み上げ確認(任意)

### 注意

J-2 は **任意**。J-1 を優先、時間あれば J-2 着手。

---

## ❌ 本サイクルで取り扱わない項目

- DB02 のサイト共通 a11y A-1 (color contrast) — ブランド色変更の影響大、別 HANDOFF で判断仰ぐ
- P-2 楽天 widget pre-size (CLS) — DB02 領域、ただし widget 仕様未確認、別 HANDOFF
- Search Console / AdSense — あべ作業
- 法的ページ Option B — 中期検討、AdSense 承認後

---

## 📋 完了報告フォーマット

```markdown
HANDOFF_DB02_TO_DB01_2026_05_18_TASK_J.md

- [x] J-1: HANDOFF_INDEX_2026_05_18.md 更新 (件数, 分類, 依存関係マップ, 通算統計)
- [x|/] J-2: 楽天 widget iframe title 動的付与 (実装内容 / または保留理由)
- [x] 検証: INDEX 記載数 = 実 HANDOFF 数 / a11y iframe title 確認

local commit: <hash>
```

---

## 🔗 関連

- 前サイクル指示書: `HANDOFF_DB01_TO_DB02_2026_05_18_NEXT.md` + `_VERIFY_ANSWER.md`
- 前サイクル完了報告: `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_VA_D.md`
- P303 Lighthouse 監査: `HANDOFF_PHASE3_03_TYPE_CHART_LIGHTHOUSE_2026_05_18.md` (A-2 の出典)
- 既存 INDEX: `HANDOFF_INDEX_2026_05_18.md` (12 件版、更新対象)
