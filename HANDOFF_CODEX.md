# pchamdb プロジェクト — Codex 引き継ぎ資料

**作成**: 2026-05-13 JST  
**作成者**: コーディ (Claude Code、通知担当メインセッション)  
**対象**: Codex (実装担当)

---

## 👥 現在の協業体制

| 呼称 | 環境 | 役割 |
|---|---|---|
| **アベ** | 人間 | 最終判断者 |
| **コーディ** | Claude Code (iPhone Remote Control 経由) | 通知・監視・アベ対話ハブ |
| **Codex** | Codex | 実装・コード変更・バッチ処理 |

**先生 (Cowork) は #018 で退場済み**。アベ ⇔ コーディ直接対話に移行。

---

## 🎯 プロジェクト概要

ポケモンチャンピオンズ専用の **わざ・特性データベース** を独自ドメイン `pchamdb.com` で公開し、収益化する。

- サイト名: **pchamdb** (読み: ピーちゃんDB)
- マスコット: **ぴ〜ちゃん** (黄色キャップ、赤Pロゴ、黄黒ジャケット) — 透明背景PNG手元あり
- ホスティング: **GitHub Pages** (リポジトリ: `nawomu/pokechan-db`)
- ドメイン管理予定: **Cloudflare Registrar**

---

## ✅ 完了済み

| 項目 | 状態 |
|---|---|
| わざ収集 (170/170ポケモン) | ✅ 完了 |
| わざ説明文リライト (485技) | ✅ 完了 (vs ヤッくん類似度≥0.7 → **0件**、完全独自371件) |
| リライトルール v6 確定 | ✅ 確定 |
| 技タグ体系設計 (~290タグ) | ✅ 完了 (`_review/tag_database.json`) |
| 技タグ付与 (490技) | ✅ 完了 (`_review/waza_classified_v2.json`) |
| action_classifier セーフガード | ✅ 実装済み |
| Phase 3 オーケストレーター | ✅ 完了 |
| わざリライト結果 pokechan_data.js への適用 | ✅ 完了済み (確認要) |

---

## 🚧 残作業 (優先順)

### 優先 1: ネット公開 Phase 1〜5

詳細: `~/Documents/ポケモンDB/HANDOFF_PUBLISHING.md`  
GitHub: https://github.com/nawomu/pokechan-db/blob/main/HANDOFF_PUBLISHING.md

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | ドメイン取得 (`pchamdb.com`) + Cloudflare DNS + GitHub Pages 連携 | **未着手** |
| 2 | 法的ページ4種 + 全HTMLにフッター追加 | **未着手** |
| 3 | SEO 基盤 (index.html / OGP / sitemap.xml / GA4 / Search Console) | **未着手** |
| 4 | セキュリティヘッダー等 | 任意 |
| 5 | 収益化準備 (Amazon → AdSense) | Phase 1-3 完了後 |

**アベ判断保留事項** (Phase 開始前に確認):
1. `.jp` ドメイン防衛取得するか (年+¥2,400)
2. OGP 画像デザイン方針

### 優先 2: バトルシミュレータ実装

タグ体系・Phase 構造の設計は完了済み。  
参照: `~/Documents/ポケモンDB/CLAUDE.md` (バトルPhase構造 v7、タグ設計原則)  
データ: `~/Documents/ポケモンDB/_review/waza_classified_v2.json`

### 優先 3: dialogue_engine v0.1 (Phase 4)

- 実装先: `phase3_pokechan_db/` のオーケストレーター拡張
- 内容: PreToolUse hooks / launchd 連携 / 毎朝 WF-E 自動起動
- 参照: `phase3_pokechan_db/CLAUDE.md` §Phase 4

---

## 📁 主要ファイル一覧

```
~/Documents/ポケモンDB/
├── pokechan_data.js              ← 公開サイト用データ (WAZA_MAP / ABILITY_DESC)
├── pokemon_db_v9.html            ← マスターDB (const DATA = [...] inline)
├── HANDOFF_PUBLISHING.md         ← ネット公開 チェックリスト (5フェーズ)
├── HANDOFF_NEW_SESSION_NET_PUBLISH.md ← 新セッション向け詳細引き継ぎ
├── CLAUDE.md                     ← バトル設計思考パターン・データ構造
├── _review/
│   ├── tag_database.json         ← タグ説明DB (~290タグ)
│   ├── waza_classified_v2.json   ← 全490技 × タグ
│   └── needs_web_search.json     ← 不明技リスト
└── rewrite_workspace/
    ├── 11_rewrites_full_draft.json ← 最終リライト結果 (485件)
    └── 02_official_descriptions.json ← PokéAPI 多言語データ

~/Documents/Claude/Projects/ポケモンチャンピオンズ わざ収集作業/abe_orchestrator/phase3_pokechan_db/
├── main.py                       ← オーケストレーター本体
├── tools/action_classifier.py    ← リスク分類セーフガード
├── CLAUDE.md                     ← Phase 3 コーディ起動ガイド
└── shared/
    ├── incoming/                 ← 先生からのメッセージ (現在空)
    └── outgoing/                 ← コーディからの返信
```

---

## 🛡️ 絶対遵守ルール

| ルール | 内容 |
|---|---|
| 削除禁止 | ファイル・データ削除はアベ明示許可なし禁止。`_archive/` への移動で代替 |
| action_classifier | HIGH リスク操作は `--confirm` なしでブロック |
| JST 統一 | 時刻はすべて JST |
| リスク確認 | 不確かな操作はアベに確認してから実行 |

---

## 🔔 コーディ (このセッション) との連携

- **完了通知・進捗報告**: Codex → `shared/outgoing/` にファイル書き込み → コーディが検知・アベに通知
- **指示受け渡し**: アベ → コーディ (Claude Code) → `shared/incoming/msg_NNN.md` に書き込み → Codex が処理
- **メッセージ番号**: 先生退場後は通し番号 #019 以降。奇数=Codex向け指示、偶数=Codex返信

---

## 💬 参照情報源

- **技仕様**: yakkun.com (ポケモン徹底攻略)
- **育成考察Wiki**: ダメージ計算 8フェーズ構造の出典
- **Bulbapedia / Smogon**: 海外検証情報
- **AppMedia**: ポケチャン仕様ツール

---

以上。不明点はアベに確認してください。
