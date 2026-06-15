# 引き継ぎ — 2026-06-15(説明文の声チェック・workflow投入と engine 大量修正)

最終更新: 2026-06-15 JST / 前回: HANDOFF_SESSION_2026_06_14.md(独立検証ループ実装/穴開通0)

---

## ★冒頭(注意)= court ループからの復帰

前セッションが Opus 4.8 の "court ループ" バグ(ツール呼び出しトークンが英単語に化けて空振り)で詰まっていたところを、新セッションで引き継ぎ再起動。原因と回避は記事参照(loop-engineering / wharfe)。**実害ゼロ**(ファイル/データは無傷・空振りで何も書かれなかっただけ)。新セッションでは court 化は再発せず、全 tool call が通った。

---

## 1. このセッションの主役 = 声チェックを workflow に乗せた

前セッション(2026-06-14)で「穴ゼロ・機械チェック満点」になったあと、残るのは「声・意味」の人間チェックだった。今回それを workflow(独立判定者≠作る人)に乗せて、機械的diff候補を構造抽出 → Opus(=私)が個別裏取りして直す、というループを開通。

### 1-1. 構造抽出 workflow(2波)
- **wave1**: top 30 kinds(全moves-kindの大半) → **250 findings**(sonnet並列30 agents・sub-tokens 768k)
- **wave2**: 残 90 kinds → **159 findings**(sonnet並列90 agents・sub-tokens 1.77M)
- 合計 **409 findings 構造抽出**(kind/move/type/missing_concept/legacy_quote/compose_now/fix_hint)
- script: `tools/_dump_kind_moves.js`(kind指定で全技を構造化dump)+ workflow scripts(retain in `~/.claude/projects/.../workflows/scripts/`)

### 1-2. 機械的regex pre-scan(LLM不要・確定的)
- `tools/_scan_compose_gaps.js`: legacy↔compose を regex で diff(英語残・JSON断片・数値欠・名詞欠・verbatim長文一致=盗用リスク)
- 202 件 flagged。workflow findings の cross-check に有用。

---

## 2. compose engine の修正(=声バグの真の修正)

★sonnet判定者の判定は鵜呑み禁止(2026-06-14教訓)。findings は機械的diff候補。Opus が個別裏取り(Bulbapedia等)してから修正。**30〜40技ぶんの「明らかなcompose出力バグ」を engine 改修で一掃**。

### コミット履歴(2026-06-15)

| commit | 範囲 |
|---|---|
| `2b0f748` | ダイマックス等の未解禁システムを表示ゲート化(SYSTEMS_IN_GAME) + 4技(ふきとばし/ほえる/ともえなげ/ドラゴンテール)に印追加 |
| `893d344` | 7技以上の compose 出力バグ修正(状態異常回復重複・自分交代変化技誤発火・つぼをつくランダム1つ・どくびし空欄・しんぴのまもり空欄・ほおばる方向逆転・ちからをすいとる回復計算空欄) |
| `a513ab3` | 状態付与のタイプ免疫一律訳(粉技・きのこ技で大量解消)+ duration_turns + 技タイプ変更(フィールド/天気判定) |
| `c4723a0` | 6技以上の声バグ(value配列=トライアタック・変化技別表現=きりばらい・fails_if=ねこだまし/きあいだめ・accuracy_check=どくどく) |
| `d4208a2` | 6技以上(modifier=せいちょう・forced=ねむる・delayed=あくび・lasting=ねをはる・note=ちからをすいとる) |
| `c447a37` | 7技以上(能力入替=スピードスワップ・持ち物排除=ふしょくガス・回復「全部だけ」=のみこむ・免疫重複=やどりぎのタネ・自分拘束ワード=ねをはる) |
| `a486ce2` | 6技以上(部屋系=マジックルーム別文・木の実強制 target別=むしくい/おちゃかい/ほおばる・みがわり設置 主要効果補完) |

### 主要な engine 構造改修(再利用可能)
- **`SYSTEMS_IN_GAME`** (mega/dynamax/tera/zmove フラグ): 未解禁システムへの言及を一律ゲート。フラグを `true` にするだけで全技一斉表示(書き直し0)
- **`isFullyGated(e)`**: 効果まるごとが未解禁システム専用なら穴でなくゲート(skip)
- **`gateList(arr)`**: リストから未解禁システムの項目を除く(まもり貫通の bypasses/not_bypassed/values 等)
- **bd.immune 一律訳**: target_type / ability / item / on_switch_in_pokemon / target_type_in / pokemon_type を吸収。ゴースト・dynamax_target・not_grounded・move_class は既存ハンドラに委ねスキップ。重複チェックは「」を取り除いて正規化
- **bd.fails_if 後置補完**: current_hp_below_fraction / ally_already_in_state / not_users_first_turn_on_field / user_already_in_state
- **bd.requires accuracy_check.bypass_if**: user_type_in を訳す(どくどく等)

### データ修正(`tools/_fix_data_english_2026_06_15.js`)
- ちからをすいとる: amount を構造化(`{type:'target_stat',stat:'attack'}`)
- どくびし: trigger(英文)を auto_removed_by(構造)に置換

---

## 3. 残り作業(次セッションへの宿題)

### 3-1. ★最重要 = 阿部さんの耳で声チェック
機械チェックは満点だが、compose 下書きが「声・意味」として正しいかは未判定。`waza_list_confirm.html` を効果kind別に見て、「この言い回しはヘン」を拾う→直す。北極星(子どもがうちの出力だけでヤックンに戻れる)が合否。

### 3-2. workflow findings の残り
- wave1: 約220件未処理(missing_concept/condition/named_entity/exception が主)
- wave2: 約140件未処理(同上)
- これらは「engine で一発で直る共通patternが見つかれば一気に減る」「個別技の意味判断は阿部さんの耳」の2系統。
- ★engine fix の打順は **複数技で共通pattern** を探す→1ヶ所直して大量解消、が効率的(粉技免疫の修正で20技一気に直った例)

### 3-3. 触ってない findings カテゴリ
- フィールド展開 (グラスフィールド等の細部=シードの「地面にいないでも発動」、ねむけ予防)
- まもり貫通 / まもり解除 (フェイントの解除→攻撃 vs 貫通 区別)
- ふきとばし/ほえるの野生戦闘終了 = Champions に野生なし → 対象外で正しい
- ダイマックス/Z技関連の取りこぼし = ゲート中=設計どおり

### 3-4. データ側英語残り(compose に露出していないので最低限)
- キングシールド/トーチカ bd.immune[].effect = "breaks through, deals 1/4 damage"
- ステルスロック effects.scaling/example
- さむいギャグ/ゆきげしき effects.side_effect
- ミラーコート/メタルバースト/ほうふく effects.redirects_to/source
- いたみわけ effects.dynamax_handling
- ちいさくなる effects.generation_notes
- ねばねばネット effects.value='sticky_web'(compose は handled)

これらは compose 出力には現れない=放置可。ただし将来「effects も英語ゼロ」を目指すなら _fix で構造化。

---

## 4. 不変の運用(変えない)
- 説明文の基準=`review/rules.html`(元データ`tools/_rules.js`)。確認=`waza_list_confirm.html` / `waza_verify_report.html`。SSOT=`ヤックン耳_判断ログ.md`
- 声の最終判定は阿部さんの耳。Claudeは★→✓に上げない
- pokechan_data.js編集は`tools/_fix_*.js`(dry-run→--write・件数アサート)
- 本番(waza-list.html等)は今もlegacy維持。composeは確認ページ内のみ
- コミット末尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## 5. 触ってない領域 (別セッション担当)
- content_samples/ / 画像 ビルダー説明ページ/ / 画像 ポケモンDB説明ページ/ — content-pages-separate-session メモ参照(触らない・コミットしない)
- pl.m3u8 / *.tagdbbak / *.tagsbak / review/_pilot.html — 不明・触らない
- review/sim_test_report.html — sim sprint(別セッション)のタイムスタンプだけ更新済・コミットしない
