# T8_Showdown実装マップ.md 裏取り(反証)レポート

**検査対象**: `/Users/masamichi/Documents/ポケモンDB/review/_doubles_research_2026-09-07/T8_Showdown実装マップ.md`(主張24件・全数検査)
**検査日**: 2026-09-07
**検査方法**: 元ファイルの引用を、対象コミットのソースを**自分で再取得**して逐語照合(`curl` で raw を取得しローカル grep)。そのうえで **別ソース**(同リポジトリの別ファイル/世代mod、ポケモンWiki日本語版、Bulbapedia、ヤックン `/ch/`=Champions版)で同じ事実を探した。
**元ファイルは編集していない**(修正案は本ファイルにのみ記載)。

**コミット同一性の確認**: `https://api.github.com/repos/smogon/pokemon-showdown/commits/master` → `"sha": "6b4bc34e44cc2541929cc4b8fff96e756ab3f268"` / `"date": "2026-09-06T10:17:10Z"`。**元ファイルの記載と完全一致**(検査時点でmasterは進んでいない=行番号もそのまま使える)。

**使った第2ソース一覧**:
- https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/{battle,battle-actions,battle-queue,pokemon,side,field,dex-moves}.ts (再取得・逐語照合)
- https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/abilities.ts (ひらいしん/よびみず/イリュージョンの実体)
- https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen3/scripts.ts , .../data/mods/gen4/scripts.ts (範囲補正の世代差=決定打)
- https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/scripts.ts (56バイト=3行を実測確認)
- https://wiki.xn--rckteqa2e.com/wiki/ダブルバトル (ポケモンWiki日本語版・**ライブ再取得**して引用確認)
- https://bulbapedia.bulbagarden.net/wiki/Double_Battle , https://bulbapedia.bulbagarden.net/wiki/Damage
- ローカル既取得: `reference/_authority_corpus_ch/moves_ch.json`(出典 https://yakkun.com/ch/move_list.htm ・497技)/ `abilities_ch.json`(出典 https://yakkun.com/ch/zukan/search/?tokusei=<id> ・314特性)= **Champions版(A判定の根拠)**
- ローカル実測: `master/moves.json`(919技のtarget列を再集計)

---

## 主張ごとの検査結果

区分: **A**=Championsで確認 / **B**=一般世代の権威2ソース一致 / **B1**=1ソースのみ / **C**=不明・矛盾・取得失敗
※ #1〜#24 の大半は「Showdownエンジン内部の実装」であり、コード自体が唯一の一次ソースで外部の権威ソースが存在しない。この種は**コードで逐語再確認できた=B1**とした(「裏が取れていない」ではなく「二重化しようがない」の意)。

| # | 主張(要約) | 元出典 | 第2ソースURL | 一致/不一致/未発見 | 区分 | 指摘 |
|---|---|---|---|---|---|---|
| 1 | `activePerHalf` = triples:3 / doubles・playerCount>2:2 / 他:1 | sim/battle.ts | 同ファイル再取得 L221-223 で逐語一致。`'multi'`/`'freeforall'`/`'rotation'` の実在も sim/battle.ts L1914・L1550・sim/side.ts L252 で確認 | 一致 | B1 | 補足=`'rotation'` は `Side.active` が3枠(side.ts L252)なのに `activePerHalf` は1になる(battle.ts の三項に rotation が無い)。Showdown側の非対称。ダブル設計には無害だが「activePerHalf=場の枠数」と読み切らないこと |
| 2 | `Side` は `pokemon[]`(手持ち)と `active[]`(場・doublesは長さ2でnull初期化)を分離 | sim/side.ts | 同ファイル L178-179(`pokemon: Pokemon[]` / `active: Pokemon[]`)、L248-257(switch文) | 一致 | B1 | 引用は逐語一致 |
| 3 | `Pokemon.position` は手持ち内index。場のスロットは `getSlot()` | sim/pokemon.ts | 同ファイル L74-79(コメント)/ L520-524(getSlot) | 一致(ただし要注意) | B1 | **★言い過ぎ**。コメント原文は「Index of `pokemon.side.pokemon` and `pokemon.side.active`, **which are guaranteed to be the same for active pokemon**. Note that this isn't its field position **in multi battles**」。つまり**通常のダブル(side 2つ)では `position` はそのまま場の枠(0=左,1=右)**であり、`getSlot()` の `positionOffset = Math.floor(side.n/2)*active.length` は n=0,1 のとき常に0。**「場の位置ではない」が成り立つのはマルチ(side 4つ)だけ**。target_lock 設計では「ダブルでは position=枠」で組んでよい |
| 4 | 状態は Field(全体)/ Side.sideConditions / Side.slotConditions[] / Pokemon.volatiles の4層 | sim/field.ts, sim/side.ts | field.ts L16-20、side.ts L196-197、pokemon.ts L93、battle.ts L123(`readonly field: Field`=Battleに1つ) | 一致 | B1 | 補足=マルチでは `sides[2].sideConditions = sides[0].sideConditions` と**同一オブジェクトを共有**する(battle.ts L1923-1924)。通常のダブルでは無関係 |
| 5 | `order` 定数テーブル team:1 … residual:300 | sim/battle-queue.ts | 同ファイル L174-195 で逐語一致(`resolveAction` 内、`if (!action.order)` のとき補完) | 一致 | B1 | 元表に無い実値: `megaEvoX:104` `megaEvoY:104` も同値。既定200は `move` と `event` のみ許可(それ以外は throw、L200-202) |
| 6 | 並べ替えは `speedSort`(選択ソート)+ 同点は `prng.shuffle` の1箇所 | sim/battle.ts | comparePriority L404-411 / speedSort L429-459 / `BattleQueue.sort()` L413-416 が `battle.speedSort(this.list)` を呼ぶ。`prng.shuffle` の出現は**7ファイル中 battle.ts:456 の1箇所のみ**(grep実測) | 一致 | B1 | **要注意の抜け**: イベントハンドラの並べ替えは3系統ある(battle.ts L789-794)。`Invulnerability/TryHit/DamagingHit/EntryHazard` は `compareLeftToRightOrder`、`fastExit`(=`priorityEvent`。RedirectTarget等)は `compareRedirectOrder`、**それ以外だけ** `speedSort`。前2者は**乱数を使わない決定的ソート**=「タイは必ず乱数」ではない |
| 7 | `resolveAction` が megaEvo/terastallize/runDynamax/priorityChargeMove/beforeTurnMove 等に展開・`deferPriority` は gen===7 かつ mega | sim/battle-queue.ts | 同ファイル L205-249(展開)/ L256(`const deferPriority = this.battle.gen === 7 && action.mega && action.mega !== 'done';`)で逐語一致 | 一致 | B1 | **本文の括弧内が文章として破綻**(「きあいのタスキでなくプランクスト系ではない」)。事実部分は正しい=`action.fractionalPriority = this.battle.runEvent('FractionalPriority', ...)`(L248)。設計に渡す前に括弧内を削除推奨 |
| 8 | `getActionSpeed` が priority(ModifyPriority)と speed を確定。Gen4限定で fractionalPriority<0 なら逆順 | sim/battle.ts | 同ファイル L2619-2662。条件は **`this.gen <= 4`**(コメントは "in Gen 4") | 一致(条件式に差) | B1 | **世代表記の詰め**: 元表は「Gen4限定」だがコードは `gen <= 4`(第3世代以前も同じ枝)。実質は第4世代の話だが、うちの実装に写す時は `<=4` で書くこと |
| 9 | `runAction` 末尾の共通処理(強制交代→faintMessages→checkFainted→switches集計→makeRequest('switch')) | sim/battle.ts | 同ファイル L2820-2914 で順序一致。第2ソース(挙動): ポケモンWiki「第四世代以降では、ポケモンがひんしになった場合、そのターン終了時に次のポケモンを繰り出す」/ Bulbapedia "If a Pokémon faints, it is not replaced until the end of the turn" | 一致 | **B** | **条件の抜け**: `checkFainted()` は無条件ではなく **`if (!this.queue.peek() \|\| (this.gen <= 3 && ['move','residual'].includes(...)))`**(L2840-2843)。つまり**第4世代以降は「キューが空=ターン終了時」にしか瀕死フラグが立たない**(=ダブルの補充がターン終了時になる根拠そのもの)。元表の「Gen3以前は即時」だけでは、なぜ現行が終了時なのかが落ちる |
| 10 | 瀕死交代要求は枠ごとbool配列 `forceSwitch: [true,true]`。**内部の switchIn 順は送信された配列順** | sim/battle.ts | 前半: battle.ts L1418-1432 で逐語一致。後半: side.ts L1010-1014(`instaswitch` を枠順に push)→ side.ts L1183(`queue.addChoice`)→ battle-queue.ts L302-308(`resolveAction` で order/priority/speed 付与)→ **battle.ts L2998-3019 `commitChoices()` が `this.queue.sort()`** | **前半一致 / 後半不一致** | **C** | **★誤り**。`commitChoices()` のコメント原文「the new switch choices are **sorted** and inserted before the rest of the turn」。強制交代は `instaswitch`(order 3)として**素早さ順に並べ替えられて**実行される=「選ばれた順/送信順」ではない。ダブルの2体同時補充の順序を送信順で実装すると再現が壊れる |
| 11 | `runSwitch` はキュー先頭の連続 `runSwitch` を全部回収→`speedSort`→`fieldEvent('SwitchIn', switchersIn)` 1回 | sim/battle-actions.ts | 同ファイル L175-192 で逐語一致。fieldEvent は battle.ts L484-506 | 一致 | B1 | **重要な補足(元表に無い)**: `runSwitch` は `battle.speedOrder = allActive.map(a => a.getFieldPositionValue())`(L183)を**先に固定**し、`resolvePriority` が SwitchIn 系ハンドラの speed から `this.speedOrder.indexOf(...) / (this.activePerHalf*2)` を引く(battle.ts L1008-1012)。コメント「Pokemon speeds including ties are resolved before all onSwitchIn handlers and aren't re-sorted in-between」=**同時入場の同速タイは1回だけ決めて以後ぶれない**。うちの実装もタイを1回だけ引いて固定する必要がある |
| 12 | `validTargetLoc` の符号(正=相手/負=味方)と隣接式 | sim/battle.ts | 同ファイル L2399-2431 で逐語一致。符号の定義は pokemon.ts L780-789 のコメント "Returns a relative location: 1-3, positive for foe, and negative for ally" | 一致 | B1 | doubles(numSlots=2)で式を手計算しても「相手2体=常に隣接/味方1体=隣接/自分=非隣接」になることを確認。元表の読みは正しい |
| 13 | `isAdjacent` は activePerHalf<=2 なら「自分以外は常に隣接」。`adjacentFoes()` も同様に `side.foes()` | sim/pokemon.ts | 同ファイル L741-746 / L732-735 で逐語一致 | 一致 | B1 | 元表の結論「ダブルに『隣接していない』概念は事実上ない」は正しい |
| 14 | `getTarget` の解決順。**対象が瀕死(味方 or free-for-all以外の相手)なら再ターゲットせずその瀕死体を返す** | sim/battle.ts | battle.ts L2464-2487 を再読。加えて **pokemon.ts L822-828**(`getMoveTargets` の default 枝)にコメント **"If a targeted foe faints, the move is retargeted"**。ポケモンWiki「味方単体に対して技を選択したが…第五世代以降ではその技は失敗する」 | **不一致** | **C** | **★条件が反転している**。コードは (a) `if (this.gameType === 'freeforall') return target;`(=FFAの**相手**だけ再ターゲットしない)(b) `if (target.isAlly(pokemon)) … return target;`(=**味方**なら再ターゲットしない)の2枝だけ。**通常のダブルで狙った相手が瀕死になった場合は素通りして `getRandomTarget` に落ちる=もう片方の相手へ再ターゲットする**。元表の「free-for-all以外での相手なら再ターゲットしない」は逆。日本語Wikiも「味方が居なくなった場合」だけを失敗ケースとして挙げており、相手の側は触れていない。**この誤りをそのまま設計に入れると、ダブルの最頻ケース(相方が先に相手を倒した)が全部不発になる** |
| 15 | `getRandomTarget` の分岐(self系→自分 / adjacentAlly / singlesは foe.active[0] / activePerHalf>2 / それ以外 randomFoe) | sim/battle.ts | 同ファイル L2490-2521。`Side.randomFoe()` は side.ts L369-373(`battle.sample(this.foes())`) | 一致 | B1 | 末尾の実コードは `return pokemon.side.randomFoe() \|\| pokemon.side.foe.active[0];`(||フォールバックが元表で落ちている)。ダブルで相手2体から等確率という結論は正しい |
| 16 | 対象そらし=`RedirectTarget` を `priorityEvent` で呼ぶ。charge技と「いのちのハーブ」所持時はスキップ | sim/pokemon.ts | pokemon.ts L829-837 を再読。実体は data/abilities.ts L2343-2362(`lightningrod`)/ L4645〜(`stormdrain`)の `onAnyRedirectTarget`。Champions: ヤックン/ch/ ひらいしん「ダブルバトルの時、自分以外の全てのポケモンのでんきタイプの単体攻撃技の攻撃対象が自分になる。(攻撃対象が複数の技の場合はそのまま)」 | コード引用は一致 / 説明は不一致 | **A(機構)/C(説明)** | **★2点の誤り**。①アイテム名が違う: コードは **`powerherb`(パワフルハーブ)**であって「いのちのハーブ」ではない。②論理が反転: `isCharging` の式は `… && !(this.hasItem('powerherb') && move.id !== 'skydrop')` なので、**パワフルハーブ持ちは isCharging が false になり、そらしを「スキップしない=そらされる」**。③括弧内の技名列挙(「ちょうはつ」「ねこだまし」「かみなり(ひかりごけ)」)は全部でたらめ。正しくは**ひらいしん/よびみず(特性)・このゆびとまれ/いかりのこな(技)**。④コードの条件 `if (this.battle.activePerHalf > 1 && !move.tracksTarget)` = **そらしはダブル以上でしか起きない**(元表に無い) |
| 17 | SwitchIn / RedirectTarget 系はさらに `effectOrder`(生成順)で決着 | sim/battle.ts | 同ファイル L994-1000 のコメントを逐語確認 | 一致 | B1 | ただし #6 の指摘のとおり、RedirectTarget は `speedSort` ではなく `Battle.compareRedirectOrder`(L413-419)でソートされ、そこでは `effectHolder.abilityState.effectOrder` を見る。「先に場に出ていた方が先」という結論は同じ |
| 18 | スプレッド技は `spreadHit` を立て、8段階パイプラインで対象配列を順にフィルタ。対象順は allAdjacent=味方→敵 | sim/battle-actions.ts | battle-actions.ts L550-586(`targets.length > 1 && !move.smartTarget`、gen<=6/gen===4のステップ入替も逐語一致)/ pokemon.ts L809-817(`allAdjacent` が `adjacentAllies()` の後に fall through で `adjacentFoes()`)。第2ソース: ポケモンWiki「第五世代からは味方→敵から見て左側の敵→右側の敵の順に処理される」 | 一致 | **B** | **世代注記を足すべき**: 同Wikiは「第三世代では1P1匹目→2P1匹目→…、**第四世代ではすばやさが高いポケモンから**処理される」とも書く。Showdownの現行(位置順)は**第五世代以降の仕様**。なお Bulbapedia は "From Generation IV onward, moves that target multiple Pokémon resolve in order of the target's respective Speed stats" と書いており**日本語Wikiと食い違う**(下記「矛盾・要注意」参照) |
| 19 | `spreadHit` なら ×0.75(FFAは×0.5)。**この倍率は元々Gen5でダブル用に導入・コード上は世代分岐なし** | sim/battle-actions.ts | 倍率自体: battle-actions.ts L1733-1737 で逐語一致(`modifyDamage` 内)。**世代**: data/mods/gen3/scripts.ts L51-54 は `move.spreadHit && move.target === 'allAdjacentFoes'` のとき **0.5**、data/mods/gen4/scripts.ts L73-76 は **0.75**。ポケモンWiki「攻撃範囲が広がる技は、ダメージが3/4(0.75倍)に減少する」「第三世代ではダメージが1/2(0.5倍)に減少するが、味方を巻き込む技には適用されない」「第四世代以降の『相手全員が対象の技』は範囲補正でダメージが3/4倍になる」。Bulbapedia Damage: Gen III "Targets is 0.5 in Double Battles if the move targets both foes (unless it targets all other Pokémon, like Earthquake…)" / Gen IV "Targets is 0.75 in Double Battles if the used move has more than one target"。Champions: ヤックン/ch/ ワイドフォース「相手全体を攻撃する(その時ダブルバトルではダメージは0.75倍)」 | 値=一致 / 世代由来=**不一致** | **A(値0.75)/C(世代由来)** | **★世代の取り違え**。0.75は**第四世代**から。第三世代は0.5で、しかも**「相手全員が対象」の技だけ**(味方を巻き込むじしん等には範囲補正なし)。「Gen5で導入」「コード上は世代分岐なし」は誤り(mods層に世代分岐が**ある**)。**値0.75/FFA0.5はChampionsでも確認済(A)**なので、うちのダブル実装は0.75で確定してよい。追加の実装条件=**「実行時に対象が2体以上」でなければ補正なし**(コードは `targets.length > 1`、Wikiも「片方がすでにひんしだったため1体しか攻撃対象にならなかった場合は範囲補正がかからない」) |
| 20 | `Side.switchIn(pokemon, pos, sourceEffect, isDrag)` の退場→入場→`isDrag && gen>=5` は即時 runSwitch | sim/battle-actions.ts | 同ファイル **L62-160** で逐語一致(`if (isDrag && this.battle.gen >= 5)` L153-158) | 一致 | B1 | **関数の所属が違う**: これは `Side` のメソッドではなく **`BattleActions.switchIn`**(sim/battle-actions.ts)。呼ぶ側が `battle.actions.switchIn(...)`。関数名で指せる形にする約束なので直すべき |
| 21 | `MoveTarget` は15種 / `master/moves.json` の target は日本語13種=別体系 | sim/dex-moves.ts, master/moves.json | dex-moves.ts L23-25 で15種を逐語確認。`master/moves.json` を**再集計**(919技): 1体選択674 / 自分96 / 相手全体60 / 自分以外全体20 / 全体の場20 / 味方の場12 / 味方全体10 / 不定9 / ランダム1体6 / 相手の場4 / 全体4 / 味方1体3 / 自分か味方1 = **ちょうど13種・合計919** | 一致 | B1 | 元表の実測は再現できた。なお日本語13種は**ヤックンの「対象」表記と同じ語彙**(`_authority_corpus_ch/moves_ch.json` の target 値と一致)=出所は徹底攻略。対応表未作成という申し送りは妥当 |
| 22 | `gameType === 'doubles'` の文字列比較は**7ファイル中 side.ts の1箇所のみ** | sim/side.ts | 7ファイルを grep 実測: **sim/side.ts:249** と **sim/battle.ts:222** の**2箇所** | **不一致** | **C** | **★自己矛盾**。battle.ts:222 は元ファイル自身が主張#1で引用している行(`this.gameType === 'doubles') ? 2 :`)。「1箇所のみ」は誤り。結論(=他は `activePerHalf` で抽象化されている)は生きるが、件数の主張は取り下げるべき |
| 23 | `chooseMove` は自陣2枠以上なら targetLoc 必須 | sim/side.ts | 同ファイル L659-668 で逐語一致 | 一致 | B1 | 直後に `validTargetLoc` の二重チェックが入る(L666-668)ことも確認 |
| 24 | `foePokemonLeft()/foes()/allies()` は multi のときだけ `allySide` を合算。通常doublesは allySide=null | sim/side.ts | side.ts L381-389(foePokemonLeft)/ L397-403(foes)/ L390-396(allies)/ L404-407(activeTeam)/ L176(`allySide: Side \| null = null`)/ battle.ts L1918-1924(multiでの結線) | おおむね一致 | B1 | **正確には**: `allies()` は `allySide` を見ず **`activeTeam()`** 経由(multiのとき `sides[n%2]` と `sides[n%2+2]` の active を連結)、`foes()` は `this.foe.allies(all)`。`allySide` を直接見るのは `foePokemonLeft()`/`isAlly()`/勝敗表示など。「ダブルとマルチを混同するな」という結論は正しい |

---

## 元ファイル「取れなかった/矛盾した点」への回答

| 項 | 元の記述 | 検査結果 |
|---|---|---|
| 1 | `data/scripts.ts` が3行だけ | **正しい**(実測56バイト、`export const Scripts: BattleScriptsData = { gen: 9 };`)。**追加で解決**: 世代別の実体は `data/mods/gen<N>/scripts.ts` にある。実際に gen3(16,311バイト)/gen4(7,911バイト)を取得し、範囲補正の世代差を確認できた(#19)。gen5 は 80バイト=ほぼ空。**「未調査」ではなく mods を1本引けば解決する** |
| 2 | `sim/global-types.d.ts` が404 | **正しい**(再取得でも404)。`MoveTarget` は `sim/dex-moves.ts` L23-25 |
| 3 | 13種 vs 15種は別体系 | **妥当**。13種は再集計で完全一致(#21)。追記=日本語13種はヤックンの「対象」表記(`_authority_corpus_ch/moves_ch.json`)と同語彙。ただしヤックン表記は**Champions基準**なので、これを直接simのtarget解決に使うと `allAdjacent`(自分以外全体)と `allAdjacentFoes`(相手全体)の区別は取れるが、`normal`/`any`/`adjacentFoe` の区別が「1体選択」に潰れている点に注意 |
| 4 | 「Illusion等は除外」が確認できなかった | **元の判断が正しい**(でっち上げ回避は適切)。**追加で解決**: イリュージョンは `data/abilities.ts` L2055-2061 の **`onBeforeSwitchIn`** で解決される(=`BattleActions.switchIn` 内の `runEvent('BeforeSwitchIn')`、`runSwitch` の**前**)。したがって「同時入場の順序判定から除外する」ロジックは**存在しない**。ダブル向けの余談として、コード内コメント「yes, you can Illusion an active pokemon but only if it's to your right」あり |
| 5 | Champions確認列が全部「不明」 | **一部は埋まる**。本検査で **範囲補正0.75(A)** と **ひらいしん/よびみず型リダイレクト(A)** はヤックン `/ch/` で確認できた(下記「確定事項」)。他の実装細部(order定数・effectOrder・speedSort)はChampionsの一次情報が存在しないため「不明」のままで正しい |
| 6 | `data/mods/gen9/` 未確認 | 本検査では gen3/gen4 のみ取得。gen9 mod は未取得=**未確認のまま**(ただしGen9は本体 `sim/` 側が現行仕様なので、ダブル基本挙動の調査には mods/gen9 は不要と見られる) |

---

## 矛盾・要注意

1. **【重大・誤り】#14 の対象再解決が逆**: 「free-for-all以外での相手が瀕死なら再ターゲットしない」は逆。**通常のダブルでは、狙った相手が瀕死になったらもう片方の相手へ再ターゲットする**(`sim/pokemon.ts` L823-828 のコメント "If a targeted foe faints, the move is retargeted")。再ターゲットしないのは (a) **味方**が瀕死のとき (b) **free-for-all の相手**のときの2つだけ。設計にそのまま写すと最頻ケースが全滅する。
2. **【重大・誤り】#10 の同時補充順**: 「送信された配列順」ではなく **`Battle.commitChoices()` の `this.queue.sort()`(=素早さ順)** で決まる。
3. **【誤り】#19 の世代由来**: 0.75は**第四世代**から(第三世代は0.5・しかも「相手全員が対象」の技限定)。「Gen5で導入」「コードに世代分岐なし」はどちらも誤り(`data/mods/gen3|gen4/scripts.ts` に分岐が実在)。→ 元ファイルの CLAUDE.md ルール(世代を明記する)に照らして要修正。
4. **【誤り】#16 の記述**: アイテムは**パワフルハーブ**(`powerherb`)で、しかも**そらしをスキップしない側**。括弧内の技名列挙(ちょうはつ/ねこだまし/かみなり等)は無根拠。正しい主体は**ひらいしん・よびみず(特性)/このゆびとまれ・いかりのこな(技)**。また `activePerHalf > 1` 条件=**そらしはダブル以上でのみ発生**。
5. **【誤り】#22 の件数**: `gameType === 'doubles'` は `sim/side.ts:249` と `sim/battle.ts:222` の**2箇所**(後者は元ファイル自身が#1で引用済み)。
6. **【言い過ぎ】#3**: 「position は場のスロット位置ではない」はマルチ限定の話。**通常のダブルでは position がそのまま枠(0/1)**。
7. **【所属誤り】#20**: `Side.switchIn` ではなく **`BattleActions.switchIn`**。
8. **【条件落ち】#9**: `checkFainted()` は「キューが空(=ターン終了時)」または「gen<=3 かつ次が move/residual」のときだけ走る。ダブルの「ターン終了時に補充」の根拠がここ。
9. **【権威ソース同士の食い違い・未決着】範囲技の処理順**: ポケモンWiki日本語版は「**第五世代からは味方→敵から見て左側の敵→右側の敵**の順」、Bulbapedia(Double Battle)は「**From Generation IV onward … in order of the target's respective Speed stats**」。**Showdownの実装は位置順**(`adjacentAllies()`→`adjacentFoes()`)で日本語Wiki側と一致。第九世代/Championsの一次情報は取れていない。**設計で処理順に依存する挙動(はじけるほのお等の連鎖)を作るときは、ここを実機で確かめてから決めること**。
10. **【文章の破綻】#7・#16 の括弧内**が意味を成していない(生成時のノイズと見られる)。設計書へ転記する前に削除すべき。
11. **【未検証】`data/mods/gen9/`** は本検査でも未取得。ダブル基本挙動には影響しないと見ているが、断定はしていない。

---

## 設計で使ってよい確定事項(A / B)

**A(Champions で確認できた)**
- ダブルの**範囲補正は0.75倍**。出典=ヤックン `/ch/` 技一覧 ワイドフォース「その時ダブルバトルではダメージは0.75倍」(https://yakkun.com/ch/move_list.htm)。free-for-all の0.5はChampionsに該当形式なしのため無視してよい。
- **単体攻撃技の対象そらし(ひらいしん/よびみず)はChampionsに存在し、ダブル限定・単体技のみ**。出典=ヤックン `/ch/` 特性「ダブルバトルの時、自分以外の全てのポケモンのでんきタイプの単体攻撃技の攻撃対象が自分になる。(攻撃対象が複数の技の場合はそのまま)」。
- **Championsにダブル専用の技/特性が多数ある**(ヤックン `/ch/` に「ダブルバトル用。」の明記: サイドチェンジ・さきおくり・おさきにどうぞ・いかりのこな 等)=ダブルは実装対象として実在する。

**B(一般世代の権威2ソースが一致)**
- **第四世代以降、瀕死になったポケモンの補充はターン終了時**(ポケモンWiki「そのターン終了時に次のポケモンを繰り出す」/ Bulbapedia "not replaced until the end of the turn")。1ターンで相手2体が同時に倒れると、後攻の技は**対象不在で失敗しうる**。
- **範囲補正の世代差**: 第三世代=0.5(「相手全員が対象」の技のみ)/ 第四世代以降=0.75(ポケモンWiki+Bulbapedia Damage+Showdownのgen3/gen4 mod)。
- **範囲補正は「実行時に対象が2体以上」でのみ掛かる**(ポケモンWiki「片方がすでにひんしだったため1体しか攻撃対象にならなかった場合は範囲補正がかからない」/ Showdown `targets.length > 1`)。
- **味方単体を対象にした技は、その味方が居なくなると第五世代以降は失敗**(ポケモンWiki/ Showdown が瀕死の味方をそのまま返す実装)。**相手が居なくなった場合は失敗せず、もう片方へ再ターゲット**(Showdown `getMoveTargets` のコメント)。
- **範囲技の処理順は(第五世代以降)味方→左の敵→右の敵**(ポケモンWiki+Showdown実装が一致。※Bulbapediaのみ「素早さ順」と食い違う=上記「矛盾」9)。

**B1(コードで逐語確認・エンジン内部で外部ソースなし。実装の写経元として安全)**
- 状態の4層(Field / Side.sideConditions / Side.slotConditions[枠] / Pokemon.volatiles)。
- 行動順の5段(order → priority(+fractionalPriority) → speed → subOrder → effectOrder)と `order` 定数テーブル。
- 同速タイの乱数消費点は `speedSort` の `prng.shuffle` **1箇所のみ**(RedirectTarget等の `priorityEvent` 系と Invulnerability/TryHit/DamagingHit/EntryHazard は**決定的ソート**で乱数を使わない)。
- 同時入場は連続 `runSwitch` をまとめて回収し、**素早さ順を1回だけ固定**(`battle.speedOrder`)してから SwitchIn を発火。以後ハンドラ間で並べ直さない。
- ダブルでは「隣接」概念が実質無い(`activePerHalf <= 2` なら自分以外は全員隣接)。
- ダブル判定は `'doubles'` 文字列ではなく **`activePerHalf`(場の枠数)** に正規化する(Showdown流。ただし件数の主張#22は誤り)。
