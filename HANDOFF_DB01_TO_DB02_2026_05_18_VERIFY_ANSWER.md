# DB01 → DB02 補足指示: あべ判断 4 件回答 — 2026-05-18

**作成**: 2026-05-18 夜 JST
**作成セッション**: DB01 (リーダー)
**宛先**: DB02
**関連**: `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_AB.md` 末尾「あべ判断仰ぎ要事項 4 件」+ `i18n/types-master-verify.md`

---

## 🎯 ひとことで

> DB02 が `types-master-verify.md` に挙げた 4 件をあべに確認しました。
> **3 件は採用案そのまま OK、中国語 Psychic のみ修正必要**(`超能` → `超能力`)。
> DB02 で types-master.json と types-master-verify.md を更新お願いします。

---

## ✅ あべ回答(原文)

> 「母音を抜いた3文字のほうが人間はわかりやすいと思う。DRKとかでいい。ドイツはELKでいい、ELCじゃないよね？　中国の2文字化3文字化どっちでもいいなぁ、超能力でいいかな。　日本語2文字は2文字のままでいいよ」

## 📋 判断結果

| # | 項目 | DB02 採用案 | あべ判断 | アクション |
|---|---|---|---|---|
| 1 | 英語 Dark / Steel の略 | `DRK` / `STL` | **`DRK` / `STL`**(母音抜き継続) | ✅ **変更なし** — 採用案そのまま継続 |
| 2 | ドイツ語 Electric の略 | `ELK` | **`ELK`**(ELC ではない) | ✅ **変更なし** — 採用案そのまま継続 |
| 3 | 中国語 Psychic の扱い | `超能`(2 文字短縮) | **`超能力`(3 文字フル)** | 🔄 **修正必要** — `super` → `超能力` |
| 4 | 日本語 2 文字タイプ(`みず`等) | 2 文字のまま | **2 文字のまま** | ✅ **変更なし** — 採用案そのまま継続 |

---

## ✅ DB02 タスク VA (Verify Answer 対応)

### VA-1: `i18n/types-master.json` の中国語 Psychic short3 を修正

**対象キー**: `types.psychic.short3.zh-Hant` / `types.psychic.short3.zh-Hans`

**変更**:
- Before: `"超能"` (2 文字)
- After: `"超能力"` (3 文字)

繁体・簡体 両方とも同じ文字「超能力」で OK(両言語で同形)。

### VA-2: `i18n/types-master-verify.md` の判断結果を反映

該当セクション(あべ判断仰ぎ要事項 4 件)に「✅ あべ判断結果 (2026-05-18 夜)」のサブセクションを追記:

```markdown
### ✅ あべ判断結果(2026-05-18 夜)

| # | 項目 | 確定 |
|---|---|---|
| 1 | 英語 Dark / Steel の略 | DRK / STL (母音抜き継続) |
| 2 | ドイツ語 Electric の略 | ELK |
| 3 | 中国語 Psychic の扱い | **超能力** (3 文字、修正済) |
| 4 | 日本語 2 文字タイプ | 2 文字のまま |

→ types-master.json は中国語 Psychic のみ修正 (`超能` → `超能力`)。
他 3 件は採用案を確定値として継続使用。
```

### VA-3: 9 言語の short3 一意性 再検証

「超能力」3 文字に変更後も、繁中・簡中の全 18 タイプで `short3` が unique であることを Python スクリプトで再検証(他タイプと衝突しないか念のため)。

---

## 📋 完了報告フォーマット

```markdown
HANDOFF_DB02_TO_DB01_2026_05_18_TASK_VA.md

- [x] VA-1: types-master.json の zh-Hant/zh-Hans Psychic short3 を「超能力」に修正
- [x] VA-2: types-master-verify.md にあべ判断結果セクション追記
- [x] VA-3: 一意性再検証 OK (全 9 言語 18 タイプ unique 維持)

local commit: <hash>
```

---

## 🚦 同時並行注意

- 並行進行中: 同 DB02 へ別 NEXT 指示書 `HANDOFF_DB01_TO_DB02_2026_05_18_NEXT.md` のタスク D(8 言語 type_chart SEO 同期)
- 本 VA タスクと D タスクは **別ファイルを触る**(VA = types-master、D = ui-*.json) → 並行/順次どちらでも OK
- DB02 判断で「先に VA → D」or「先に D → VA」自由、または合体 1 commit でも OK

---

## 🔗 関連

- 前報告: `HANDOFF_DB02_TO_DB01_2026_05_18_TASK_AB.md` の「あべ判断仰ぎ要事項 4 件」
- 検証レポート: `i18n/types-master-verify.md`
- 関連 commit: `c3500ec` (types-master 初版)
- ユーザー回答原文: 上記「あべ回答(原文)」セクション
