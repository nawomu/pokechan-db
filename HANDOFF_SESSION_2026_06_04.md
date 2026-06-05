# セッション引き継ぎ — 2026-06-04

**作成**: 2026-06-04 JST
**ステータス**: 🟡 作業中(全て未コミット)。技効果の **構造化effects全面移行が一段落**し、いまは **ブロック単位の careful 精査フェーズ** の途中。
**再開地点**: `review/waza_proto_done.html`(やった分80技・move-level展開表示)を確認。**02〜06まで適用完了**(02交代/03バインド/04ため・硬直・避けてる相手に命中/05連続攻撃/06反動・失敗ダメージ・HPが減る・自分がひんし)。→ 次は 07回復・吸収 など(`review/waza_blocks.json` の48ブロック)。backup 多数(末尾)。

> **06(25技)= 統一適用済**(`.b06.bak`/`.b06fix.bak`): 6サブタイプに細分 — ①与ダメージ反動=`反動`(basis 4綴り→削除)②失敗ダメージ=`失敗ダメージ`(新kind/反動から分離・表示「外すと自分もダメージ」)③HPが減る(コスト)=basis綴り削除④自分がひんし=`自分瀕死`に統一(`HPが減る fraction:1`から変換: いやしのねがい/いのちがけ)⑤こらえる⑥接触反動。のろいの呪いダメージ→`継続削り`。はらだいこ=`to_max:true`。**教訓: `note`一括削除でいのちがけのゴースト無効が消えた→`.b06fix.bak`で復活。「noteは消さず構造化」**。表示: 割合を文脈付きに(「与えたダメージの33%」「毎ターン最大HPの25%」)。

> **05 連続攻撃(15技)= 統一適用済**(`.b05.bak`): ヒット数を6通り以上でバラバラ表現していたのを4タイプに統一 — ①2〜5回ランダム=`min_hits:2,max_hits:5`(表示「2〜5回攻撃」)②決まった回数=`hits:2`(「2回攻撃」)③外れるまで最大N回=`max_hits:N,stop_on_miss:true`(「外れるまで最大3回攻撃」: トリプルアクセル/ネズミざん)④手持ちの数だけ=`hits_by:"…手持ちの数(自分含む)"`(ふくろだたき)。トリプルアクセル=`power_per_hit:[20,40,60]`、ドラゴンアロー=`doubles_note`(日本語)。`fixed`/`stop_on`/英語note 等の乱立を解消。

> **★★北極星(全表現の根本原則・ユーザー明言)**: **PchamDB の全説明文(技・特性・その他もろもろ)は「小学校低学年(6〜8歳)にもわかる」言葉で書く。** 初めての人・知らない人・子供にも優しく・丁寧に・そのまま伝わること。専門用語・略語・記号で「これ何?」と思わせない(`半無敵`→`水中の相手にも命中`、`HPコスト`→`HPが減る`、`▲1`→`1段階アップ` 等)。技effectsだけでなく**特性(ABILITY_DESC)等の説明文全般**に適用。→ [[plain-language-principle]] / [[waza-effects-review-standards]]
>
> **★最重要の進め方(ユーザー指示)**:
> 1. **文節照合(横)**: 技ごとに説明文を一節(=一挙動)に分解し、各節がデータに表れているか個別照合。
> 2. **行だけで全節を追える表示**を目指す(貫通リスト・ext等を潰さず展開)。
> 3. **説明文に無い情報を推測で足さない**(selection失敗例参照)。ただしユーザー確認済みの実装仕様は明確な項目で構造化可。
> 4. **【新・最重要 2026-06-05】分けられるだけ細かく分ける + 二重の視点**: 大ブロックを最小単位まで割る(機構 × **変化/物理/特殊** × **攻撃有無**)。例: バインドは 純拘束(変化)/物理+バインド/特殊+バインド で別物。そのうえで (横)説明↔データ照合 に加え (縦)**細グループ内で技同士を並べて一貫性・正当な差異を確認**する。縦比較で初めて「1技だけ書式が違う/冗長」に気づける。→ [[block-review-method]] #14・#15

---

## 🎯 ひとことで

技の「効果」を、旧 `tags`(文字列フラグ)から **構造化 `battle_data.effects`(日本語kind・実行手順順・AND/OR/IF表現)** へ全面移行完了(全490技)。simの参照も移行し旧tags・旧用語集を撤去。そのうえで「機械一括では機微を取りこぼす」と判断し、**1ブロックずつ説明文と一語一語照合して精査する**フェーズへ移行。02交代系を完了、03バインドが適用待ち。

---

## ✅ 今日やったこと(前半: 構造化effects 全面移行)

すべて `pokechan_data.js` の `battle_data` に対して。各段階に backup あり。

1. **パイロット27技**(効果タグが空だった変化技)→ effects適用。`tools/_waza_effects_apply.js`
2. **残り463技**(変化143/物理201/特殊119)→ ダイナミックワークフロー3波で `JP説明→英訳→構造化effects` 抽出 → 正規化(`tools/_waza_effects_normalize.js`)→ 精緻化(`tools/_waza_effects_refine.js`: set_field→set_terrain統一・multiplier→power/damage振分・バインド7技を1statusに集約・取りこぼし3件)
3. **全490技を適用**(`tools/_waza_effects_apply_all.js`): effectsを**実行手順順**(行動順→威力判定→命中後→攻撃後→場継続→ターン終了)にソート → **kindを日本語化** → battle_data書込
4. **2軸辞書** `review/waza_kind_dict.json`(122 kind・日↔英・**英語=多言語i18nピボット**)
5. **旧tags撤去**: sim 2ファイルの movePriority→`battle_data.priority`、never_miss→effects の `必中`/`ignores_accuracy` 参照へ移行。全490技から `tags` 撤去。phase9 status判定を `'状態付与'` へ
6. **WAZA_TAG_DB 削除**(参照ゼロの旧用語集169キー・18KB)
7. **論理監査**(ダイナミックワークフロー42エージェント・全490技): AND/OR/IF の論理ずれ検証 → **27技修正**(`tools/_waza_audit_apply.js`)。AND=複数能力を`stats:[]`+共有prob(げんしのちから等)/OR=`selection:"random_one"`(フェイタルクロー)/IF=排他`condition`(しおづけ二重加算修正)/バグ修正(シャカシャカほう吸収対象 相手→自分・すてゼリフ欠落追加)
8. **新リストUI試作** `review/waza_list_proto.html`(横並び: ①優先②基本データ+効果フロー+導出タグ+徹底攻略説明、AND/OR/IFバッジ)

---

## ✅ 今日やったこと(後半: ブロック精査フェーズ)

「一語一語、技ごとに議論しながら、小ブロックで少しずつ」方針へ転換。

- **ブロック分け**: 48ブロック → `review/waza_blocks.json`(効果kindで主ブロックを1つ割当)
- **精査方法**: 1ブロックずつ、2〜3エージェント並列で説明文を節分解→現effects全フィールドと網羅照合(ok/partial/missing/wrong)→提案+論点。**自動適用せず必ず議論して確定**。WF script: `.../workflows/scripts/waza-block-review-wf_4470d1ed-bba.js`
- **02 交代系(11技)= 適用済**(`tools/_waza_block02_apply.js`, backup `pokechan_data.js.block02.bak`)。ここで**表現標準を確定**([[waza-effects-review-standards]] / 下記)。ふきとばし の貫通7種・ext退避など。
- **02の追修正(セッション最後)**: ふきとばし を文節照合した結果、
  - **`selection:"random_one"` を強制交代4技(ふきとばし/ほえる/ともえなげ/ドラゴンテール)から削除**。理由=説明文に「ランダム」と書かれていない(=推測で足した違反)・選ぶ配列も無く「どれか1つ」と誤表示。→ **標準#5は撤回**。`pokechan_data.js.selfix.bak`。
  - **`tools/_waza_proto_done.js` の表示を強化**: 効果セルに move-level(`not_blocked_by`貫通リスト全列挙 / `fails_if`失敗条件 / `immune` / `ext`非表示拡張 / `replacement`交代先 / `pass`引継)を**展開表示**。これで「行だけで説明文の全節を追える」ようになった。ふきとばし の8節すべてが表示で確認可能。
  - **交代先の選択方式を `replacement` で表現**(`backup .replfix.bak`): **自分交代**(とんぼがえり/バトンタッチ/ボルトチェンジ/クイックターン/しっぽきり/さむいギャグ)= `replacement:"任意"`(プレイヤーが控えから選択)/ **強制交代**(ふきとばし/ほえる/ともえなげ/ドラゴンテール)= `replacement:"ランダム"`。説明文に明記は無いが**ユーザー確認済みの実装仕様**。前項で撤回した曖昧な `selection:"random_one"` を、明確な項目へ作り直した形。
  - **バトンタッチの引き継ぎを精緻化**(`backup .baton.bak`): `pass:["能力ランク変化","一部の状態変化"]` + `needs_research`(全状態変化ではなく**一部のみ**。みがわり/やどりぎ/きあいだめ等は○・ちょうはつ/メロメロ等は×。**正確なリストは要調査**)。いえきの例外と同じく「推測で全リストを埋めず、要調査フラグで正直に」。
  - **用語の日本語化(表示・kind)**: `揮発状態`→**`状態変化`**(公式用語。状態異常と区別)/ kind `HPコスト`→**`HPが減る`**(データ9箇所+2軸辞書+ja辞書を統一・`backup .hpfix.bak`)。→ 明日以降、ja辞書ベースで他kindの分かりにくい表記も見直す価値あり。
- **04 ため(溜め技/2ターン技)9技 = 統一適用完了**(`backup .tameapply.bak`)。**縦比較で「同じ溜め+半無敵を9通りバラバラ表現」を発見**(`state`/`semi_invulnerable_state`/`invulnerable_state`の4書式・回避リスト3形式・英語残骸)。→ 統一構造へ: `{kind:"ため", phase:"lasting", duration:1, semi_invulnerable:"空中/地中/水中/消失", vulnerable_to:[半無敵を貫通する技], skip_charge_if_weather:[天候]}` + 追加効果は別effect。**kind `溜め中回避`・`消失` を ため に統合(廃止)**。エレクトロビームの溜めターン特攻+1は `on_charge_turn:true`。対象: そらをとぶ/あなをほる/ダイビング/とびはねる/ソーラービーム/ソーラーブレード/エレクトロビーム/ゴッドバード/ゴーストダイブ。
- **04r 反動硬直6技 = 統一適用済**(`.b04rest.bak`): 全部同一機構(次ターン行動不能)なのに `effect`/`note` 別フィールド+英語prose乱立 → `{kind:"反動硬直", phase:"lasting", duration:1}` に統一(kindで意味伝わるので英語除去)。
- **04s 半無敵命中5技 = 統一適用済**(`.b04rest.bak`): 縦比較で3軸の不整合発覚 → ①半無敵命中は `hits_state:["空中/地中/水中"]`(**状態名で溜め技の `semi_invulnerable` と完全対応**: なみのり=水中↔ダイビング=水中)+ `damage_multiplier:2`(有る技のみ) ②天候必中は `cases:[{weather,accuracy:"必中"/数値}]` に統一(never_miss/always_hits表記ゆれ解消)③こんらん duration `"1-4 turns"`→`[1,4]`。対象: なみのり/かみなり/じしん/うずしお/ぼうふう。**→ ブロック04完全完了(ため9+反動硬直6+半無敵命中5=20技)**。
- **03 バインド/拘束(9技)= 適用完了**。`review/waza_block03_review.json`。6技は元々正しく、残り3技を修正(下記):
  - **immune を effect-level へ統一**(Rule A書式 `{type:"target_type", value:"X"}` / Rule B 場所=効果内)。くろいまなざし/かげぬい の move-level immune(`target_type_in`/`values` の非標準書式)を 拘束effect内の `{type:"target_type", value:"ゴースト"}` へ移動。英語prose(`effect:"target cannot..."`)除去。`backup .bind3.bak`
  - **まとわりつく**: 冗長な別 `拘束` effect + move-level immune を削除し単一 `状態付与` へ集約。
  - **純拘束技に `prevents_switch:true`(交代不可)を明示**(くろいまなざし/かげぬい)。バインド技の `状態付与+prevents_switch` と揃えた。`backup .trapfix.bak`
  - 表示も effect-level immune と `values`書式を拾えるよう堅牢化(`immStr`)。「無効: target_type_in」のような壊れ表示を解消。

### ⚠️ 明日まず片付ける: 03バインドの3技(immune統一ルール適用)
精査で出た不統一を、下記ルールで直す(ユーザー確認待ち):
- **ルールA(immune書式)**: `{type:"target_type", value:"ゴースト"}`(単数)/ 複数型は `values:[...]`。→ **くろいまなざし** の `{type:"target_type_in", values:["ゴースト"]}` をこれに統一。
- **ルールB(immuneの場所=effect-level)**: 無効はその効果に付ける。→ **くろいまなざし/かげぬい** の move-level immune を `拘束` effect 内へ移動。
- **まとわりつく**: 冗長な別 `拘束` effect(+ move-level immune `applies_to:trap`)を削除し、単一 `状態付与`(prevents_switch内包)へ集約(既定「1statusに集約」方針どおり)。
- `turn_end_damage`(毎ターン1/8)は単一status のサブフィールドで維持(別 turn_end effect に分けない)。

---

## 📐 確定した表現標準(全ブロック共通) — [[waza-effects-review-standards]]

1. **英語フリーテキスト禁止** → note/自由記述値は日本語
2. **`timing` フィールド廃止**(実行段は effects の並び順 + execRank で表現)
3. **Champions非対象は `battle_data.ext`(非表示namespace・日本語)へ退避**(削除せず将来用に保持・メイン非表示)。例: ダイマックス無効・野生限定挙動
4. **強制交代の対象ランダム** → `selection:"random_one"`
5. **`no_replacement_available`** 等の一般仕様は害なければ保持
6. **旧スキーマ残骸は別管理**(下記)

---

## 📌 残件(明日以降)

1. **(明日最初)** `review/waza_proto_done.html` を確認 → 03バインド3技に上記ルール適用
2. **ブロック精査の続き**(残46ブロック)。`review/waza_blocks.json` 参照。1ブロックずつ WF精査→議論→適用
3. **旧 battle_data ブール残骸の一括掃除**(別管理): `rank_changes`×114, `must_hit`×11, `self_switch`×6, `recoil`×12, `multi_hit`×16 等 **33種**が新effectsと重複して温存されている。waza_picker.js が今これを読むので、本実装移行と同時に除去
4. **新リストUI本実装**: `waza-list.html` / `waza_picker.js` を新effectsへ移行(現状 `getMoveFilterTags`/`matchesEffectFilter` が旧スキーマ依存)。導出フィルタタグの再構築
5. **simulator 本実装**: 構造化effectsの consume(威力倍率/反動/吸収/連続/場継続/ターン終了処理)。現状 phase9(状態異常)・priority・never_miss のみ
6. (別件・待ち)AdSense / Amazon アソシエイト承認待ち

---

## 🗂️ 主要ファイル / ツール

**データ**: `pokechan_data.js`(SSOT・WAZA_MAP/effects 日本語kind)
**辞書**: `review/waza_kind_dict.json`(日↔英2軸)/ `review/waza_kind_ja.json` / `review/waza_kind_canonical.json`
**ブロック**: `review/waza_blocks.json`(48ブロック)
**ビュー(生成元→出力)**:
- `tools/_waza_proto_done.js` → `review/waza_proto_done.html`(★やった分・プロト形式)
- `tools/_waza_list_proto.js` → `review/waza_list_proto.html`(全490・横並びプロト)
- `tools/_waza_effects_ja_view.js` → `review/waza_effects_ja.html`(技ファミリ別・日本語フロー ※specs基準で論理監査前)
**精査ヘルパ**: `tools/_waza_dump_full.js`(キー→全フィールド+説明。not_blocked_by 出力漏れを06-04修正)/ `tools/_waza_keys.js`
**適用スクリプト**: `_waza_effects_apply_all.js` / `_waza_audit_apply.js` / `_waza_block02_apply.js`

## 💾 backup(復旧用)
`pokechan_data.js.effects.bak`(effects適用前)/ `.tagsbak`(tags撤去前)/ `.tagdbbak`(TAG_DB削除前)/ `.audit.bak`(論理監査前)/ `.block02.bak`(交代系適用前)/ `.selfix.bak`(selection削除前)/ `.replfix.bak`(replacement付与前)/ `.baton.bak`(バトンタッチ前)/ `.hpfix.bak`(HPコスト改名前)/ `.bind3.bak`(バインド3技前)/ `.trapfix.bak`(交代不可付与前)/ `.tameapply.bak`(ため統一前)/ `.tamerename.bak`(kind「ため」改名前)/ `.noguard.bak`(ノーガード説明更新前)/ `.noguardmv.bak`(vulnerable_if付与前)/ `.b04rest.bak`(反動硬直・半無敵命中 統一前)/ `.rechargerename.bak`(反動硬直→次のターン行動不能 改名前)/ `.rmdur.bak`(行動不能のduration除去前)/ `.spread.bak`(範囲技target整理前)/ `.funen.bak`(ふんえん範囲修正前)/ `.b05.bak`(連続攻撃統一前)/ `.b06.bak`(06統一前)/ `.b06fix.bak`(いのちがけ無効復活前)

## 🧬 特性ドメイン(ABILITY_DESC・別管理)
特性は `pokechan_data.js` の `const ABILITY_DESC`(192件)= **特性名→説明文のみで未構造化**(技のような effects は無い)。半無敵と連動する重要例: **ノーガード**=命中率/回避率無視で必中・半無敵(そらをとぶ等)の相手にも当たる(説明を完全版へ更新済)。これに対応し、ため技5技に `vulnerable_if:["特性ノーガード"]`(=半無敵を貫通する条件。`vulnerable_to`=貫通する技 と対)を付与。**将来、特性も技と同様に構造化するか要検討**(技が一段落後の別ドメイン作業)。

## ⚠️ 注意
- 全作業 **未コミット**。明日の精査が一段落したらまとめてコミット検討
- ビューは生成物。直接編集せず生成元 `tools/_waza_*.js` を編集して再生成
- 関連memory: [[waza-effects-rollout-status]] / [[waza-effects-review-standards]] / [[waza-effects-team-convention]]
