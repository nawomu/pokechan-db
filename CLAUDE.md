# ポケモンDB (PchamDB) プロジェクト — 運用原則

最終更新: 2026-05-14 JST

---

## ポケモンデータの参照ルール

**マスターDB**: `pokemon_db_v9.html` の `const DATA = [...]`

タイプ・種族値・特性・技学習などは **このDBが正**。記憶ベースの「公式情報」を優先しない。  
不一致を見つけたら、まず **マスターDB を信頼** して、自分の記憶が間違っている前提で対応する。

---

## 設計資料の参照先

バトルシミュレータ設計・Phase構造・タグ体系・思考パターンは:

→ **`HANDOFF_PHASE3_SIMULATOR.md`** を参照

---

## macOS 障害対策

ファイルが開けない症状 (Numbers/Excel ハング系) が出たら:

```bash
killall cfprefsd
PID=$(pgrep -x ScopedBookmarkAgent) && kill -9 "$PID"
```

それでもダメな場合: `_review/html_tables/index.html` を Chrome で開く。
