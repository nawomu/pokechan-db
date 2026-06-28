# HANDOFF — 2026-06-28(全国版新技445の「ヤックン→effects→compose」一本化)

最終更新: 2026-06-28 JST。前回 = `HANDOFF_SESSION_2026_06_26_PART2.md`。
**引き継ぎ必読: CLAUDE.md → 本書 → `次回ここから.md` → `ヤックン耳_判断ログ.md`**。

> ⚠️ このセッションの成果は**全部ローカル・未push**(本番 pchamdb.com 未反映)。本番反映は阿部さんの確認OK後。

---

## 0. 一言サマリ
全国版DBの新技445の説明文が「**effectsから来ていない/別技の説明が紛れた壊れデータ**」だったのを、阿部さんの出発点(**まずバトル=effectsを作り、訳せば説明文**)に立ち返って全面修復。①壊れていた**ヤックン(お手本/legacy)を本物のYakkunから取り直し** ②そのヤックンを正データに**全427技のeffectsをワークフローで構築** ③**compose で効果文を一本化**(穴ゼロ多数・タグ自動) ④語彙に無い場操作系12技は**新kindを追加して正攻法化**。

---

## 1. このセッションでやったこと(時系列)

### A. 問題発見
- 確認ビューで「Effects(元データ)が空なのに効果文がある」=**composeを通っていない**ことが判明(`tools/_waza_list_confirm.js` 345行: national技は `m.description`(=`moves_ja_desc.json`)を直出し、composeでない)。
- 効果文・legacy・effectsが三者バラバラ(例: みかづきのいのり=回復技なのに効果文「反動」・legacyも別技)。

### B. 全445技 権威監査(ワークフロー)
- 各技の真の効果を権威基準で独立判定+反証検証 → **確定問題252技**(重大172/軽微80)。記録= `reference/_check_triage.md` / `_fix_targets.json` / `_check_result.json`。
- **横断的事実**: legacy(ヤックン)が wrong=207技 / desc wrong=142 / battle_data missing=115。

### C. ★ヤックン(お手本)を本物のYakkunから取り直し ← 根本原因の修復
- 旧 `reference/moves_yakkun.json` は**Yakkun技番号≠PokeAPI id の取り違え**で全面崩壊(例: ダイサンダー=Yakkun741/PokeAPI759、burning-bulwark=ブラッドムーンの文)。
- **ブラウザ同一オリジンfetch(403回避)+EUC-JPデコード+英語名照合**でYakkun全940番をスイープ→**427/445技を本物の効果文に置換**(残18=シャドウ技ダーク〜はSV未収録)。手法メモリ= [[yakkun-scrape-method]]。
- `reference/_yk_scraped.json`(取得元) → `tools/_apply_yakkun_scrape.js` → `reference/moves_yakkun.json`(=description_legacy/ヤック列)。

### D. ★effects構築(ワークフロー)→ compose一本化
- 正しくなったヤックンを正データに、**並列ワークフローで全427技のeffectsを121kind語彙のみで構築**(`tools/_apply_built_effects.js`で反映+compose穴チェック)。スキーマ表= `reference/_effect_schema_guide.md`。
- ビルド `tools/_build_pokechan_data_all.js` に**修正オーバーレイ MFIX**(`reference/moves_battle_data_fix.json`)を追加。MFIX在る技は battle_data を差替+**説明文をcompose生成に一本化**(マザー流: ダメージ技は「ダメージ。{効果}」)。
- 結果: 410/427が compose穴ゼロ・ヤックンと意味一致・タグ自動生成。

### E. ★語彙外メカの扱い(出発点ルールの再確認)
- 121kindで構造化できない技が判明:
  - **17穴技**(威力可変=なつき度/相手HP割合/連続・技タイプ変更=IV/道具/テラス等): effectsは有るがcomposeが特殊basis未対応で穴。
  - **12空技**(場操作・道具操作系): 該当kindが無くeffects空。
- 一度「説明文オーバーレイ `reference/moves_desc_override.json`」で手書き補完したが、**阿部さんに「effects空=simが動かない・出発点に反する」と指摘**され、正攻法へ:
  - **場操作系12技に新kindを追加**(compose `tools/_waza_compose.js`末尾): 場入れ替え/ランク低下防御/地形依存技/跳ね返し/おんねん/よこどり/道具封じ/急所無効/さきどり/テレキネシス/道具譲渡/賞金倍。effectsを入れ(sim土台)・説明文はcompose生成に戻した。穴0。
  - **17穴技は当面オーバーレイ手書きのまま**(effectsは有=sim土台あり/composeの特殊basis未対応分だけ手書き)。

### F. ★出発点ルールを明文化(2026-06-28 阿部さん)
- `CLAUDE.md`「★★出発点＝まずバトル(sim)から考える」+ メモリ [[effects-sim-phase-first]] に追記:
  「まずバトルを動かす目的でeffectsを作り、訳せば説明文。**effects空で説明文だけ手書きは禁止**(simが動かない偽の完成)。121kindに無いメカは**新kindを足す**。」

---

## 2. 現在の状態(全国版新技445)
| 状態 | 数 | 備考 |
|---|---|---|
| effects+compose(穴ゼロ) | ~398 | メインの声レビュー対象(効果↔ヤック) |
| ダメージのみ(effects空が正常) | 40 | 純ダメージ技 |
| 17穴技(effects有・説明文は一時手書き) | 17 | 威力可変/技タイプ変更の特殊basis |
| 場操作系(新kind・正攻法) | 12 | このセッションで正攻法化 |
| 効果なし技(はねる等) | 3 | 一言補完 |
| シャドウ技(ダーク〜・Yakkun無) | 18 | 別枠・未対応 |
| **説明文空** | **0** | ✅ |

コミット5本(ローカル): `98d2ffb`(ヤックン取り直し+ダイ18) / `78431b8`(427構築) / `d771630`(29補完) / `537caae`(場操作12新kind+ルール明文化) ほか。

---

## 2.5 ★全427照合→修正(2026-06-29 追加)
全427技を機械照合WF(`_verify_result.json`)→ ok264/要対応163。多くは**系統的なcompose欠落**だったので一括補修:
- **技分類フラグ描画**(音/風/切る/弾/噛み/踊り/パンチ/波動/こな)= `_move_flags.json`をbuildで適用(pilot分マージ)＋composeで後置発声。
- **優先度**= national技の`battle_data.priority`を技優先度から設定→「優先度±Nの先制/後攻技」。
- **ダイマックスわざ18**= 必中(命中率・回避率無視)追加＋自己ランク上昇を味方全体(team)に。
→ 再照合で163→**77に減**(ok86解消)。残77を修正WFでeffects再構築→反映。さらに明確バグ(undefined×2=テクスチャー/サイコシフト・瀕死回避穴=みねうち)をcompose補修。**全overlay穴0・undefined0・実行エラー0**。
- needs_compose 約70件を**ほぼ解消**(2026-06-29続き): `_cond_render.js`に条件追加(弱点をつく/交代時/HP半分/味方倒れ/ダイマックス/テラス/連携技/まるくなる)＋composeに大量render追加(直前技模倣の出し分け=ものまね/オウムがえし/スケッチ・ランダム技母集団=ゆびをふる/ねこのて・威力可変=なつき逆/連続/きのみ消費・回復prob・連続攻撃power_per_hit・吸収condition・場の威力補正duration・状態展開=かいふくふうじ/無防備/地形・ランクコピー奪う・道具封じトレーナー・プレート/カセット判定・範囲まもりdetail・拘束both・ランクリセットall・特性team・PP回復・per_turn)。**全overlay穴0・undefined0・compose実行エラー0**。照合: 427中ok≈405。
- **★残=genuinely複雑な約22技**(状態機械/特殊条件・niche): いかり(被弾でこうげき+1の状態機械)・わるあがき(タイプ無視ダメージflag)・みやぶる/ミラクルアイ(ゴースト/あく無効解除)・ころがる(自分拘束が「ねをはる」と誤訳)・おしおき/ハートスワップ(参照取り違え)・フリーフォール/シンクロノイズ/みずのちかい/ふんじん/トラップシェル(条件・連携)・ねらいうち/やきつくす/ダークホール/でんこうそうげき/じんらい/じょうか/とぎすます/さいきのいのり/ボディパージ等の発動条件・対象限定。多くは既存kindに条件/フラグrenderを足すか、新kind少々で解決可。worklist継続。

## 3. ★後でやること(続き)
1. ~~17穴技を正攻法化~~ **✅完了(commit 90628af)**: composeに威力可変(なつき度/相手HP割合/連続/エコー/残りPP/きのみ/ちかい/ランダム/確率表)・技タイプ変更(IV/タイプ1/テラス/メモリ/きのみ)・まもり貫通最小形・能力ランク変化stat_by_conditionのrenderを追加→オーバーレイ脱却。**全427技 compose穴0・本番937技デグレ無**。overlay残=効果なし3技(はねる/おいわい/てをつなぐ)のみ。
   - ※軽微: ころがるの「自分拘束」が「地面に根をはって」と訳される(ねをはる用の文)=声レビューで要調整。
2. ~~シャドウ技18(ダーク〜)~~ **✅完了(commit 5c661f2)**: type=shadow=コロシアム/XD(GC外伝)専用・本編/SVに無い→**全国版から除外**(typeで判定=シャドーボール等の本編ゴースト技は残す)。WAZA_MAP 937→919・national_new 445→**427**(全てYakkun有・効果文有=Yakkun無ギャップ解消)。
3. **低確信の複雑系の声サインオフ**: rage/bide/sketch/conversion/mimic等(構築時confidence<0.8)。声・分類の最終判定は阿部さんの耳(北極星)。
4. **本番公開(push)**: 阿部さんOK後。全部版の公開導線(index→全国版)も。
5. 後回し: 全部版sim(937技のeffectsをsimが実行=別スプリント)。新kind(場入れ替え等)のsim実装はここ。全部版の9言語i18n。

---

## 4. 主要ファイル早見(このセッション)
| 用途 | ファイル |
|---|---|
| ヤックン(お手本/legacy)取り直し | `reference/_yk_scraped.json` → `tools/_apply_yakkun_scrape.js` → `reference/moves_yakkun.json` |
| effects構築の反映+穴チェック | `tools/_apply_built_effects.js` → `reference/moves_battle_data_fix.json`(MFIX overlay) |
| スキーマ表(エージェント用) | `reference/_effect_schema_guide.md` |
| 説明文オーバーレイ(一時/効果なし) | `reference/moves_desc_override.json`(残20=17穴+効果なし3) |
| composeエンジン(新kind追加) | `tools/_waza_compose.js`(末尾に場操作系12kind) |
| 監査記録 | `reference/_check_triage.md` / `_fix_targets.json` / `_all_holes.json` |
| 確認ビュー | `review/waza_list_confirm.html` ← `tools/_waza_list_confirm.js` |

ローカル確認: `python3 -m http.server 8000`。`node tools/_build_pokechan_data_all.js`(再生成)→`node tools/_waza_list_confirm.js`。
関連メモリ: [[effects-sim-phase-first]] / [[yakkun-scrape-method]] / [[national-moves-grouping-todo]] / [[p4b-compose-verify-loop]]。
