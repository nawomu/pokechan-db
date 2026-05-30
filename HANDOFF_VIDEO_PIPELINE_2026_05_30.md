# 動画制作パイプライン — ハンドオフ (明日続行用)

**作成**: 2026-05-30 JST
**作成セッション**: video / VJ 素材制作セッション
**ステータス**: 🟢 2 本納品済み・続行可能 (グロー効果が未完)
**目的**: ffmpeg / Node 無しの Mac で、Blender ヘッドレス描画 → Swift エンコードで動画を量産する手順を引き継ぐ

---

## ⚠️ 最重要: 保存場所

成果物・スクリプトは **`/tmp` は揮発性 (再起動で消える)** なので、すべて **`video_workspace/`** に永続化済み。
`video_workspace/` は `.gitignore` 済み (公開リポジトリに出ない / GitHub Pages で配信されない)。

```
video_workspace/
├── typevideo/          # タイプ相性 解説動画
│   ├── build_slides.py # スライド9枚を Blender で生成
│   ├── encode.py       # ❌ 廃止 (Blender に FFMPEG 出力なし)
│   ├── png2mp4.swift   # PNG連番 → mp4 エンコーダ (本命)
│   ├── png2mp4         # 上記をコンパイル済みバイナリ
│   └── type_matchup.mp4 # 納品物 (594フレーム 1280x720 ~20s)
└── vj/
    ├── warp.py         # ワープ VJ 素材生成 (Blender)
    ├── png2mp4         # エンコーダ (同じバイナリのコピー)
    └── warp_vj.mp4     # 納品物 (150フレーム 30fps 5sループ 1.1MB)
```

> 注: PNG連番 (`slide_*.png`) は **永続化していない**。スクリプトから再生成できるため。
> 必要になったら下記コマンドで再描画する。

---

## 🛠 パイプライン全体像

この Mac には **ffmpeg も Node(npx) も Homebrew も無い**。代わりに:

```
[1] Blender 5.1.2 ヘッドレスで PNG 連番を描画
        ↓
[2] Swift + AVFoundation 製の自作エンコーダ png2mp4 で mp4 化
```

### 利用可能なツール
- `python3` 3.9.6 (PIL なし / PyObjC なし)
- `swiftc` (`/usr/bin/swiftc`) — AVFoundation 使用可
- Blender 5.1.2 (`/Applications/Blender.app/Contents/MacOS/Blender`)
- Final Cut Pro / Motion (スクリプト自動化は **不可**)
- 日本語フォント: `/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc` → Blender 内で "Hiragino Sans W6"

### 実行コマンド

**(A) タイプ相性動画**
```bash
cd video_workspace/typevideo
/Applications/Blender.app/Contents/MacOS/Blender --background --python build_slides.py
# slide_000.png .. slide_008.png が出る
./png2mp4 . type_matchup.mp4 30 66   # <dir> <out> <fps> <holdフレーム数>
```

**(B) ワープ VJ 素材**
```bash
cd video_workspace/vj
/Applications/Blender.app/Contents/MacOS/Blender --background --python warp.py
# slide_0001.png .. slide_0150.png が出る (Blender が直接連番出力)
./png2mp4 . warp_vj.mp4 30 1          # holdは1 (各フレーム1枚=アニメーション)
```

**png2mp4 を再コンパイルする場合**
```bash
swiftc -O png2mp4.swift -o png2mp4
```

---

## 🎬 warp.py のチューニング (VJ 続行のキモ)

スクリプト冒頭の定数を触るだけで質感が変わる:

| 定数 | 現値 | 意味 |
|------|------|------|
| `N` | 130 | 四角の数 (増やすと密度↑) |
| `L` | 150 | ループ長 = 総フレーム数 (5s @30fps) |
| `FPS` | 30 | |
| `ZFAR` | 60.0 | 奥行きの開始距離 |
| `P` | 3.5 | 加速指数。大きいほど「ヒュンッ」と急加速 |
| `RMIN/RMAX` | 1.2 / 9.0 | カメラ軸からの放射半径レンジ |
| `BASE` | 0.16 | 四角の基本サイズ |
| `STREAK` | 7.0 | 手前で放射方向に伸びる量 (光線っぽさ) |

動きの式: `u=((f/L)+phase)%1` の進行度に対し `d=ZFAR*(1-u**P)` で奥→手前。
`fade=smoothstep(0,0.05,u)` で遠方ポップイン防止、`streak=1+STREAK*(u**5)` で手前ストレッチ。
ループは `phase` を四角ごとにずらして seamless。

---

## ❌ 未完: グロー / ブルーム効果

`warp.py` のコンポジタ・グロー (`CompositorNodeGlare` FOG_GLOW) は **Blender 5.1 で `scene.node_tree` が取れず skip 中** (try/except で `GLOW_SKIP`)。
光がにじむ「ヒカリモノ」感を足したいので、明日の続きの第一候補:

- **案1**: EEVEE の Bloom を使う。ただし 5.1 系で Bloom がレガシー EEVEE から外れている可能性あり → 要 API 確認。
- **案2**: コンポジタを正しい 5.1 API で有効化 (`scene.use_nodes=True` の後に `scene.node_tree` ではなく別経路かもしれない。`bpy.context.scene.compositing_node_group` 等の新APIを調査)。
- **案3 (確実)**: PNG 連番に対し後段でガウスぼかし合成。ただし PIL が無いので Swift 側 (Core Image `CIGaussianBlur` + screen 合成) でやるのが現実的。png2mp4.swift を拡張する案。

---

## 📌 Blender 5.1 API ハマりどころ (再発防止メモ)
- Principled BSDF はキー名でなく型で取る: `next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')`
- エンジン enum は `'BLENDER_EEVEE'` (`_NEXT` は無い)
- VSE は `sequence_editor.strips` (旧 `.sequences` は廃止 / 空コレクションは falsy なので `or` フォールバック不可 → `hasattr` で分岐)
- **`render.image_settings.file_format` に `'FFMPEG'` が無い** → Blender 単体で動画出力できない (→ Swift エンコーダ必須)
- コンポジタ `scene.node_tree` が AttributeError (上記グロー問題)

## 📌 png2mp4.swift 仕様
- 引数: `<slideDir> <out.mp4> <fps> <holdFrames>`
- `slide_*.png` を名前順ソート → 各 PNG を `holdFrames` 枚ずつ保持して H.264 6Mbps で書き出し
- 静止画スライドショー (hold=66) もアニメ連番 (hold=1) も同じバイナリで対応
