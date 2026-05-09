# ポケモンDB 作業引き継ぎメモ（Cowork → Code）

## リポジトリ情報
- GitHub: https://github.com/nawomu/pokechan-db
- 公開サイト: https://nawomu.github.io/pokechan-db/pokemon_db_v9.html
- ブランチ: main（直接push運用）

---

## 今回Coworkで実施した作業

### 1. 技カテゴリフラグデータのスクレイピング
yakkun.com のポケモンチャンピオンズ（ch）ページから、以下のカテゴリに属する技名一覧を収集。

| フラグキー | カテゴリ名 | 技数 | 取得方法 |
|---|---|---|---|
| punch | パンチ系 | 14技 | yakkun `?punch=1` |
| sound | 音技 | 24技 | yakkun `?sound=1` |
| dance | 踊り系 | 9技 | yakkun `?dance=1` |
| slice | 切る技 | 21技 | yakkun `?slice=1` |
| wind | 風技 | 9技 | yakkun `?wind=1` |
| ball | 弾技 | 17技 | yakkun `?ball=1` |
| pulse | 波動技 | 5技 | yakkun `?pulse=1` |
| ohko | 一撃必殺 | 4技 | 手動特定（じわれ/つのドリル/ぜったいれいど/ハサミギロチン） |
| charge | ターン技（ため技） | 10技 | yakkun `?charging_turn=1` |
| recharge | 反動で動けなくなる技 | 6技 | yakkun `?recharge=1` |
| change_type | タイプ変更 | 7技 | yakkun `?change_type=1` |
| change_ability | 特性変更 | 6技 | yakkun `?change_ability=1` |
| change_item | 道具変更 | 9技 | 効果説明から手動特定 |
| change_target | 対象変更 | 2技（このゆびとまれ・いかりのこな） | 手動特定 |

### 2. pokechan_data.js の更新
- WAZA_MAP 全490技に `flags: {}` フィールドを追加
- 108技に上記フラグを付与（5技は複数カテゴリ所属）
- push済み（main ブランチ）

### 3. waza-list-template.html にフィルターUI追加
- 「🔍 効果フィルター」ボタン（クリックで折りたたみパネル開閉）
- フィルターカテゴリ：
  - **技フラグ系**：パンチ/音技/踊り/切る/風/弾/波動/一撃必殺/溜め/リチャージ/タイプ変更/特性変更/道具変更/対象変更
  - **状態異常**：まひ/ねむり/こおり/やけど/どく/こんらん/ひるみ（description正規表現）
  - **自分ランク上昇**：攻撃/防御/特攻/特防/素早
  - **相手ランク下降**：攻撃/防御/特攻/特防/素早
  - **その他**：回復/急所/連続攻撃/先制/バインド/交代強制
- フィルタリングロジック：カテゴリ内OR・カテゴリ間AND
- 「🔄 リセット」ボタンあり

### 4. pokemon_db_v9.html の微修正
- WAZA_MASTERアダプターに `flags: m.flags || {}` を追加

### 5. 状態異常フィルターの誤判定修正
description テキストの regex を厳密化：

| 状態異常 | 修正前パターン | 修正後パターン |
|---|---|---|
| ねむり | `/ねむり/` | `/相手を.*ねむり.*状態/` |
| ひるみ | `/ひるませ\|ひるみ/` | `/ひるませ/` |

**修正背景：**
- ふいうち・エレキフィールド・さわぐ・ねごとが「ねむり」に誤ヒット → 除外済み
- じたんだ・やけっぱちが「ひるみ」に誤ヒット → 除外済み

**ねむり正しい5技：** うたう・ねむりごな・さいみんじゅつ・あくび・フェイタルクロー

---

## 残課題・未対応事項

### フィルター精度
- **まひ100%・どく100%・こんらん100%・ひるみ確率別**：現状未分類（確率区別なし）
- **自分のランク下降**：検出精度が低い
- **自分がひんしになる技・ダメージ回復技**：一部検出漏れあり

### データ関連
- wind・change_type・change_ability・change_item・change_target の一部は実際のチャンピオンズ未登場の技が含まれる可能性あり（要検証）
- スクレイピングデータ生JSONはCoworkセッション内のみ存在（リポジトリ未コミット）

### 未実装フィルター
- まひ100% / どく100% / こんらん100% の確率別フィルター
- 自分のランク下降フィルター（精度向上必要）
- 自分がひんしになる技

---

## 技術メモ

### フィルタリングの仕組み（waza-list-template.html）
```js
// flagsベースのフィルター例
const matchFlag = selectedFlags.every(flag => move.flags?.[flag]);

// 状態異常（description regex）
const STATUS_PAT = {
  sleep: /相手を.*ねむり.*状態/,
  flinch: /ひるませ/,
};
```

### GitHub push方法
PATを使ったContents API経由での直接push（GitHub Actions不使用）。

---

## 参考URL
- yakkun チャンピオンズ技検索: https://yakkun.com/ch/zukan/search/
- 修正コミット: https://github.com/nawomu/pokechan-db/commit/ef936b663d23548ffd8dce57be0bb422c62b2590
