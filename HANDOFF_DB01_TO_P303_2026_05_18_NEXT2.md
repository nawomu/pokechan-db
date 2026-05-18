# DB01 → P303 次サイクル指示書 #2 — 2026-05-18

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB01 (リーダー)
**宛先**: P303
**前サイクル**: `HANDOFF_P303_TO_DB01_2026_05_18_TASK_H.md` (タスク H 完了 + 再 Lighthouse) を承認

---

## 🎯 ひとことで

> 前サイクルで H-1 CLS + H-2 a11y 完了 ✅、再 Lighthouse で **Performance 47 → 89 (+42)** の劇的改善 ✅
> 本サイクルは **types-master 連携を type_chart.html に展開**(5/19 持ち越し予定だったが、4 セッション統一のため 5/18 中に完遂依頼)。
> 軽 (15-30 分)、退行リスク低、5/18 4 セッション完全クローズへの最後の 1 ピース。

---

## ✅ 前サイクル成果(承認)

- `a2fa5a3`: H-1 CLS + H-2 a11y(scroll-x min-height + main landmark)— **本番反映済**
- `0130d24`: 完了報告書 — **本番反映済**
- 再 Lighthouse 結果が **Performance 47 → 89 (+42)** / **CLS 0.986 → 0.202** / **a11y 88 → 90** — 構造的改善で本番でも同程度の改善期待

→ **完了承認**。提案された即対応(P303 推奨 (a))が大成功。

---

## ✅ 次タスク K: types-master 連携を type_chart.html に展開

### 背景

DB02 が `c3500ec` + `bb7464c` で全 18 タイプ × 9 言語 × 4 表記の `types-master.json` を完成。
DB02 / P302 が pokemon_db_v9 / waza_picker / waza-list ですでに `I18N.type(t, 'short3')` 経由に切替。
**残るは type_chart.html のみ** = P303 領域。

P303 報告書(`HANDOFF_P303_TO_DB01_2026_05_18_TASK_H.md`)で「5/19 以降の別タスク」と保留した件、4 セッション統一のため **5/18 中に完遂** 依頼。

### 成果物

#### K-1: type_chart.html のタイプ表示を `I18N.type(t, 'short3')` 経由に

確認手順:
1. type_chart.html 内で **タイプ名を短縮形(`tType()` / `slice(0,3)` / `TYPE_SHORT` 等)で表示している箇所** を grep
2. 該当箇所を `I18N.type(jaName, 'short3')` 経由に置換
3. `i18n:changed` / `i18n:ready` リスナで関連描画関数を再呼出(必要なら)

参考実装:
- `pokemon_db_v9.html` の `type3()` 関数(`c3500ec` で実装)
- `waza_picker.js` の `wpType3()` 関数(`0347911` で実装)

### 工数

15-30 分(grep + 置換 + 検証)

### 検証

- 言語切替 9 言語で type_chart.html の タイプ短縮表記が切り替わる
- 既存の `tType()` でフル表記している箇所は **触らない**(後方互換維持)
- HTTP 200 / JSON 構文 OK

### 注意

- type_chart.html 内で **既に `I18N.type(t)` を使ってる箇所** は full 表記。これは `'full'` モードで動作 → **触らない**
- 短縮表記が必要な箇所(セル幅が狭い、ヘッダ等)のみ `'short3'` に変更
- もし type_chart.html で **短縮表記が一切使われていない** なら、本タスクは **NO-OP** 報告 OK

---

## ❌ 本サイクルで取り扱わない項目

- サイト共通の a11y A-1 (color contrast) — DB01 領域、ブランド色変更の影響大で別 HANDOFF
- サイト共通の P-1 / P-2 / P-4 (AdSense / 楽天 / Cache-Control) — DB02 領域、別 HANDOFF
- 5/19 以降の発展タスク(types-master.json への追加表記、ulrich short 等) — 別途指示

---

## 📋 完了報告フォーマット

```markdown
HANDOFF_P303_TO_DB01_2026_05_18_TASK_K.md

- [x] K-1: type_chart.html タイプ短縮表示を I18N.type(t, 'short3') 経由に
       置換箇所: <件数 / 行番号>
       (もしくは NO-OP の場合: 該当箇所なし、現状で types-master 連携完了済)
- [x] 検証: 言語切替 9 言語 / JSON 構文 / HTTP 200

local commit: <hash>
```

---

## 🚦 5/18 4 セッション統合完了に向けて

K 完了 = **types-master が全 P302 / P303 / DB02 領域に完全展開**:

| 領域 | ファイル | short3 経由 | commit |
|---|---|---|---|
| DB02 | pokemon_db_v9.html | ✅ | c3500ec |
| P302 | waza_picker.js / waza-list.html | ✅ | 0347911 |
| **P303** | **type_chart.html** | **← K で完了** | (本サイクル) |
| 保留 | battle_simulator.html | ⏳ P301 競合中 | (将来) |

→ K 完了で 4 セッション統合の 5/18 最終ピース完成。お願いします。

---

## 🔗 関連

- 前サイクル指示書: `HANDOFF_DB01_TO_P303_2026_05_18_NEXT.md`
- 前サイクル完了報告: `HANDOFF_P303_TO_DB01_2026_05_18_TASK_H.md`
- types-master.json: `c3500ec` (DB02 初版) + `bb7464c` (中国語 Psychic 修正)
- runtime.js 拡張: `c3500ec` (DB02)
- 参考実装: `pokemon_db_v9.html` の `type3()` / `waza_picker.js` の `wpType3()`
