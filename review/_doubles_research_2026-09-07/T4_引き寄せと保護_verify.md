# T4「引き寄せと保護」裏取り(反証)結果

- 対象ファイル: `review/_doubles_research_2026-09-07/T4_引き寄せと保護.md`(39主張・全数検査)
- 検査日: 2026-09-07 / 担当: 裏取り(反証者)
- 元ファイルは編集していない。修正案はすべて本ファイル側に書いた。

## 検査の前提(まず確認したこと)

| 項目 | 結果 |
|---|---|
| T4が使った `https://wiki.pokemonwiki.com/wiki/…` は本物か | **本物**。`https://wiki.xn--rckteqa2e.com/wiki/…` は現在 **301 Moved Permanently** で `wiki.pokemonwiki.com` に転送される(実測)。ポケモンWiki(日本語)の新ドメイン。URLの捏造ではない |
| ローカル `reference/_authority_corpus/rules/ダブルバトル.json` | `url` フィールドも `https://wiki.pokemonwiki.com/wiki/ダブルバトル`。T4が本文中で `wiki.xn--rckteqa2e.com` と書いているのは表記ゆれのみ |
| `reference/_authority_corpus_ch/moves_ch.json` | **497件=絞り込み済み**(全国919技の一部)→ **技の不在はChampions非採用の証拠になる** |
| `reference/_authority_corpus_ch/abilities_ch.json` | **314件=全国の特性ほぼ全件**(masterは313件)→ **特性の在/不在はChampions採否の証拠にならない**(★T4の#17/#21のChampions欄の根拠が弱い理由) |
| Showdownソース | `data/moves.ts`(21297行)/`data/abilities.ts`(5706)/`sim/pokemon.ts`(2304)/`sim/battle.ts`(3369)/`data/conditions.ts`(956)を master から実取得して該当関数を直読 |

---

## 主張ごとの検査結果

| # | 主張(要約) | 元出典 | 第2ソースURL | 一致/不一致/未発見 | 区分 | 指摘 |
|---|---|---|---|---|---|---|
| 1 | このゆびとまれ=対象選択技のみ引き寄せ・全体技に無効 | JP Wiki このゆびとまれ | https://bulbapedia.bulbagarden.net/wiki/Follow_Me_(move) | 一致 | **A** | 事実は正。ただし**引用が逐語でない**。原文は「対象を選択する技にしか効果はない。」(T4は「対象を選択しない技には効果がない」と裏返して括弧書き)。Bulbapedia: "Follow Me has no effect on moves which hit multiple Pokémon in a battle." ch corpus「ただし、全体技には効果がない。ダブルバトル用。」 |
| 2 | 優先度 第五世代以前+3 / 第六世代以降+2 | JP Wiki このゆびとまれ | Bulbapedia Follow Me | 一致 | **A** | 原文逐語確認「第五世代以前: +3 / 第六世代以降: +2」。Bulbapedia "Follow Me now has +2 priority"(Gen VI〜)。Showdown `followme` priority:2。ch corpus「優先度:+2」 |
| 3 | 味方2体が同ターンに使ったら**先に使った方**が優先 | JP Wiki このゆびとまれ | Bulbapedia Follow Me / Showdown `sim/battle.ts` | 一致 | **B** | 原文逐語一致。Bulbapedia "If another Pokémon on the same team is already the center of attention, **the first user takes priority**"。★**T4が「コード裏付けなし」とした箇所は解決**: `Battle.compareRedirectOrder`(battle.ts)が `priority desc → speed desc → effectOrder 昇順`。`resolvePriority` に `if (callbackName.endsWith('SwitchIn') \|\| callbackName.endsWith('RedirectTarget')) { handler.effectOrder = handler.state?.effectOrder; }` があり、コメントに "They should activate in the order they were created" と明記 |
| 4 | いかりのこな=相手の技を自分が受ける・全体技無効 | JP Wiki いかりのこな | Bulbapedia Rage Powder | 一致 | **A** | Bulbapedia "Rage Powder has no effect on moves which hit multiple Pokémon in a battle."。**引用は逐語でない**(JPページの効果文は在来ゲーム文「相手の 攻撃を すべて じぶんに むける。」)。ch corpus で意味は確定 |
| 5 | 優先度 第五+3 / 第六以降+2 | JP Wiki いかりのこな | Bulbapedia Rage Powder | 一致 | **A** | 双方一致。Showdown `ragepowder` priority:2 |
| 6 | くさ/ぼうじん/ぼうじんゴーグルは無効(第六世代で追加) | JP Wiki いかりのこな | Bulbapedia Rage Powder | 一致(**追加あり**) | **A** | JP原文は「くさタイプ・特性ぼうじん・ぼうじんゴーグルのいずれかを持ったポケモンの**行動は**、いかりのこなで発生したちゅうもくのまと状態を**無視する**」=免疫は**撃つ側**にある、という向きが重要(T4の「無効条件」は向きが曖昧)。★Bulbapediaは免疫リストに **Stalwart と Propeller Tail も含む**("Grass-type Pokémon, Pokémon with Overcoat, Stalwart, Propeller Tail, and Pokémon holding the Safety Goggles are now immune")=T4は2つ漏らしている |
| 7 | スポットライト=注目の的化・優先度+3・既に注目の的なら失敗 | JP Wiki スポットライト | https://bulbapedia.bulbagarden.net/wiki/Spotlight_(move) | 一致(失敗条件は**未発見**) | **B1** | 優先度+3・範囲「1体選択」はJP/Bulbapedia両方で確認。「すでにちゅうもくのまと状態になっているポケモンに対しては失敗する。」は**JP Wikiのみ**(Bulbapedia側に該当文なし)。Showdown `spotlight` は `isNonstandard: "Past"` |
| 8 | 第八世代以降 選択できない技 | JP Wiki スポットライト | Bulbapedia Spotlight | 一致 | **B** | 双方逐語確認。Bulbapedia "Spotlight cannot be selected in a battle"。Champions=N は moves_ch.json(絞り込み497件)に不在+`isNonstandard:"Past"` で妥当 |
| 9 | キングシールド/みちづれの味方に攻撃を向けさせる戦術 | JP Wiki スポットライト | なし | 一致(第2ソース未発見) | **B1** | JP原文逐語一致。第七世代限定の戦術知識。**Championsでは技自体が使えないので設計には不要** |
| 10 | スポットライトは他の全リダイレクトより優先 | Bulbapedia Spotlight | Showdown `data/moves.ts` | 一致 | **B** | Bulbapedia逐語一致。Showdown `spotlight: onFoeRedirectTargetPriority: 2` > `followme/ragepowder: 1` > `lightningrod/stormdrain`(未指定=0) |
| 11 | ひらいしん=でんき技引き寄せ+無効化+とくこう+1(第五世代以降) | ローカル ダブルバトル.json | Bulbapedia Lightning Rod / ch abilities | 一致(**世代欄が誤り**) | **A** | 効果自体はA(ch corpus「でんきタイプの技を受けるとダメージが無効化され、自分の『とくこう』ランクが1段階上がる。またダブルバトルの時、自分以外の全てのポケモンのでんきタイプの単体攻撃技の攻撃対象が自分になる。(攻撃対象が複数の技の場合はそのまま)」)。★**世代欄の「第四世代(無効化・被ダメ0)」はT4自身の引用と矛盾**: 引用文は「第五世代以降は**さらに**ダメージを無効化し、とくこうが1段階上がる」=第三・四世代は**引き寄せのみで無効化なし**。Bulbapediaも Gen V で "immunity to all Electric-type moves, and raises ... Special Attack" が加わったとする |
| 12 | 複数のひらいしん→**素の**すばやさ実数値が最速のものが優先 | JP Wiki ひらいしん | Bulbapedia Lightning Rod / Showdown | 一致(核) / **実装は不一致** | **B**(核)+**C**(素の実数値) | JP原文は**T4の引用より1文長い**: 「…すばやさが一番高いポケモンのひらいしんが優先される。**ランク補正やトリックルーム状態などの効果を除外したすばやさ実数値を比較する。**」→ T4の主張本文は正しく、引用欄が切れているだけ。Bulbapedia "it will be redirected to the one with the highest speed"(素/補正込みの別は言及なし)。★**Showdownは食い違う**: `compareRedirectOrder` の speed は `handler.speed = pokemon.speed`、`pokemon.speed = getActionSpeed()` = `getStat('spe', false, false)`(**ランク補正込み**)+**トリックルームで 10000-speed に反転**。Magic Bounce だけ `getStat('spe', true, true)`(素)の特例があるのに RedirectTarget には無い |
| 13 | 場に注目の的がいればひらいしんは引き寄せられない | JP Wiki ひらいしん | Bulbapedia Lightning Rod | 一致 | **B** | JP逐語一致。Bulbapedia "If another Pokémon becomes the center of attention, Electric-type moves will be directed to it instead of the Pokémon with Lightning Rod."。Showdownの優先度数値(1/2 > 0)とも整合 |
| 14 | 第四世代以降は味方のでんき技も引き寄せる | JP Wiki ひらいしん | Bulbapedia Lightning Rod / ch abilities | 一致 | **A** | JP「第四世代以降では味方が使用するでんき技も引き寄せる。」/ Bulbapedia "Moves used by allies are now redirected as well."(Gen IV)/ ch corpus「**自分以外の全ての**ポケモンの…攻撃対象が自分になる」=Champions水準で味方込みが確定 |
| 15 | まもる中でも引き寄せは発動、防げる技ならとくこうは上がらない | JP Wiki ひらいしん | なし | 一致(第2ソース未発見) | **B1** | JP原文逐語一致(今回再取得で確認)。英語側に対応記述を見つけられず |
| 16 | ちかい系/ねらいうちは引き寄せない・直接狙われれば無効化はする | JP Wiki ひらいしん | Showdown `data/abilities.ts` | 一致 | **B** | JP原文逐語一致。Showdown `lightningrod.onAnyRedirectTarget` 冒頭 `if (move.type !== 'Electric' \|\| move.flags['pledgecombo']) return;`(ちかい合体を除外)。無効化は別ハンドラ `onTryHit` なので直接狙いでも効く=T4の区別は正しい |
| 17 | よびみずはひらいしんと同型(最速優先/注目の的優先/味方のみず技も) | JP Wiki よびみず | Showdown `stormdrain` | 一致 | **B1→B**(機構)/ **C**(Champions欄) | JP原文3文すべて逐語一致を確認。Showdown `stormdrain` は `lightningrod` と型が完全に同一。★**Champions欄「N」の根拠が弱い**: masterの `champions:false` のみ。abilities_ch.json(314件=全国全件)は絞り込みリストではないので在否は証拠にならない。**設計では「よびみずがChampionsに居るか」を未確定として扱うこと**。なおT4が#20備考で引いた「溜め始めた時によびみずが場にいなくても…」はJPページに**その文言では存在しない**。実際の原文は「ダイビングなど、みずタイプの溜め技が使われたときは、各ターンごとに攻撃が引き寄せられるかが判定される。」 |
| 18 | Showdown リダイレクト優先度 99>2>1>0>-1 | Showdown moves.ts/abilities.ts | 自前で全数grep | 一致 | **B** | 全数確認: `onRedirectTargetPriority` は counter(-1, 3014行)/mirrorcoat(-1, 12013行)/skydrop(99, 16749行)の3件のみ。`onFoeRedirectTargetPriority` は followme(1, 6062)/ragepowder(1, 14611)/spotlight(2, 17777)の3件のみ。abilities.ts には優先度指定なし=0。**T4の数値は完全に正しい** |
| 19 | RedirectTarget は default: 分岐でのみ発火(全体技は対象外) | Showdown sim/pokemon.ts | 自前で `getMoveTargets` 全文確認 | 一致 | **B** | `getMoveTargets`(791行)の `switch(move.target)` で `all/foeSide/allySide/allyTeam` `allAdjacent/allAdjacentFoes` `allies` の各case には無く、`default:` 内 835行にのみ `target = this.battle.priorityEvent('RedirectTarget', this, this, move, target);` |
| 20 | ダブル以上(`activePerHalf > 1`)かつ `!tracksTarget` かつ溜め1ターン目でない時のみ発火 | Showdown sim/pokemon.ts | 同上 | 一致 | **B** | 829〜836行で逐語確認。溜め技は実行ターンに `isCharging=false` となり再判定=JP Wikiよびみずの「各ターンごとに判定」と整合 |
| 21 | すじがねいり/スクリューおびれ=対象変更を受けない | JP Wiki すじがねいり | master/ch abilities | 一致(**範囲に差**) | **A**(機構)/ **C**(スクリューおびれのChampions欄) | JP原文逐語:「使用する技の対象が、相手の特性・ちゅうもくのまと・サイドチェンジにより変更させられることがない。」 ★**JP原文は「スポットライト」を名指ししていない**(名指しは master / ch corpus の effect 文の側)。Showdown実装は `move.tracksTarget = move.target !== 'scripted'` + `Battle#getTarget` の `if (pokemon.hasAbility(['stalwart','propellertail'])) tracksTarget = true;`。スクリューおびれ champions=N は master フラグのみが根拠(#17と同じ弱さ) |
| 22 | よびみず/ひらいしんを**直接**狙えば無効化は発生する | ローカル `_ability_facts.json` | **JP Wiki すじがねいり(今回 再取得成功)** | 一致 | **B** | ★T4が「一次URL再取得できず」とした点は**解決**。JP原文:「使用するみず/でんき技がよびみず/ひらいしんに引き寄せられることはないが、よびみず/ひらいしんのポケモンに**直接使用した場合は攻撃を無効化される**。」 |
| 23 | 判定は「技を選んだ時点」でなく「技が使用される時点」 | ローカル `_ability_facts.json` | **JP Wiki すじがねいり(今回 再取得成功)** | 一致 | **B** | ★同じく**解決**。JP原文:「技を選択する時点ではなく、技が使用される時点で特性の効果が発動するかが判定される。」+「特性を消された場合その行動は効果がなくなり、新たに特性を得た場合はその行動に効果がある。」 |
| 24 | ねらいうち=引き受け無視+急所ランク+1・第八世代 | JP Wiki ねらいうち | Showdown `snipeshot` / Bulbapedia Follow Me | 一致 | **B** | JP原文逐語一致(急所ランク+1・第八世代)。Showdown `snipeshot: { critRatio: 2, tracksTarget: true, target: "normal" }`。Bulbapedia Follow Me 側にも "Snipe Shot and the Abilities Stalwart and Propeller Tail ignore Follow Me and hit the intended target." |
| 25 | ワイドガード=複数対象技から味方全体を守る・優先度+3 | JP Wiki ワイドガード | Bulbapedia Wide Guard / ch corpus | 一致 | **A** | JP原文逐語:「そのターンの間、味方全体を複数のポケモンが対象になる技から守る。」優先度+3・**範囲=味方の場**。ch corpus と一致。Showdown `wideguard` priority:3 / target:"allySide" |
| 26 | 味方のじしん/なみのりも防げる | JP Wiki ワイドガード | Bulbapedia Wide Guard / ch corpus | 一致 | **A** | JP逐語一致。Bulbapedia "including ally moves like Earthquake and Surf"。ch corpus「相手や味方が使った複数のポケモンが対象の技を受けない」 |
| 27 | Showdown `wideguard` は allAdjacent/allAdjacentFoes のみ防ぐ | Showdown moves.ts | 自前でコード直読 | 結論一致 / **引用は不一致** | **B** | 結論は正しいが**コード引用が誤り**。実コード(20826行)は `if (move?.target !== 'allAdjacent' && move.target !== 'allAdjacentFoes') { return; }` = **AND**。T4は `\|\|` と書き、さらに備考で「ORで繋ぎ」と誤った解説を足している(ORなら常に真=常にreturnになり機能しない)。また「JP Wikiの**ダブルバトル頁**にドラゴンアローの記述」も誤り: 該当文は**ワイドガードのページ**側(ドラゴンアローは防げない)。ダブルバトル頁にあるのは「ドラゴンアローは有効な相手が2体いる場合は2体を1回ずつ攻撃する。」 |
| 28 | ワイドガード等の連続使用ペナルティ | Bulbapedia Protection | **JP Wiki まもる/ワイドガード/ファストガード + Showdown** | **不一致** | **B**(要修正) | ★★**最重要の誤り**。T4が「暫定的な正」とした「**ワイドガードとファストガードの間でのみカウンターを共有**」は**どの出典にも無い**。正しくは下の「矛盾・要注意」§1参照。JP Wiki まもる原文:「第五世代ではまもるとワイドガード/ファストガードを連続で使ったときは、順番に関わらず成功率が低くなる。」/ ワイドガード・ファストガード両ページ:第六世代以降は**自身は失敗しないが、成功後にまもる系を使うとその成功率が1/3になる**。Showdownも `wideguard`/`quickguard` に `onHitSide(side, source) { source.addVolatile('stall'); }` が**在り**、`onTry` は `return !!this.queue.willAct();` のみで **stall を参照しない**=「自分は落ちないがカウンターは進める」を実装している |
| 29 | ファストガード=優先度が上がった技から味方全体を守る・優先度+3・第六世代以降は特性由来も防ぐ | JP Wiki ファストガード | Bulbapedia Quick Guard / Showdown / ch corpus | 一致 | **A** | JP効果文の原文は「そのターンの間、味方全体を優先度が高いわざから守る。」(T4引用の2文はどちらもこの表記では取れなかった=**逐語でない**)。Bulbapedia: Gen V は "does not block moves that have been given an increased priority through Prankster"。Showdown `quickguard`: `if (move.priority <= 0.1) return;` + 同旨コメント。ch corpus「特性の効果による先制攻撃も受けない」=**Champions確定**。★T4が漏らした例外2つ: **ふかしのこぶし**の直接攻撃技は防げない(JP)、**フェイント**は貫通する(Bulbapedia) |
| 30 | 「クイックガード」は別技でなく Quick Guard の日本語名=ファストガード | Bulbapedia Quick Guard | ch corpus | 一致 | **A** | Bulbapedia逐語 "Japanese Name: ファストガード (Fast Guard)"。ch corpus にも「ファストガード」で収録 |
| 31 | トリックガード=味方への変化技を無効化・優先度+3・第六世代 | JP Wiki トリックガード | **Bulbapedia Crafty Shield(今回 日本語名 取得成功)** | 一致(**例が誤り**) | **B** | ★T4が「取得失敗・推論」とした**日英対応は解決**: Bulbapedia "Japanese Name: トリックガード (Trick Guard)"。JP: 優先度+3・範囲=味方の場・第六世代初出・**BDSP・SVで使用不可**(=Champions非採用の直接の根拠になる。masterフラグ頼みでなくてよい)。★**T4の除外例「自分自身へのつぶしあい系」は出典なし**。JPページの実例は「自分含む全員が対象」=おちゃかい/たがやす/フラワーガード/ほろびのうた、「味方全員が対象」=アシストギア/アロマセラピー/いのちのしずく。**なおShowdownは `if (['self','all'].includes(move.target) \|\| move.category !== 'Status') return;` で "self" と "all" しか除外しておらず、JPの言う「味方全員が対象のわざ」を除外していない=実装とJP Wikiが食い違う可能性あり** |
| 32 | トリックガードは連続使用しても失敗しない | Bulbapedia Crafty Shield | JP Wiki トリックガード / Showdown | 一致 | **B** | 三方一致。Bulbapedia "Crafty Shield can be used consecutively without failing." / JP「連続で使用しても失敗しない」/ Showdown `craftyshield` に `onHitSide` の `addVolatile('stall')` が**無い**(=カウンターに参加もしない。#28のWG/FGとの明確な差) |
| 33 | まもる/みきり/キングシールドは対象=自分のみ | master + JP Wiki まもる | ch corpus | 一致 | **A** | JPページの範囲欄「自分」、ch corpus も target=自分。Showdown `protect: { target: "self" }`。※Bulbapedia Protect の抽出では Target が "Opponent" と返ったが、これは要約ツール側の誤読(実際のPS実装/JP/ch はすべて self)。**出典間の対立ではない** |
| 34 | まもるの連続使用成功率の世代別式 | Bulbapedia Protect | JP Wiki まもる / Showdown conditions.ts | **不一致(部分)** | **C** | ★式が不正確・下限が欠落。JP Wiki まもる原文: 第五世代「連続で使うごとに成功率は半減していく。**下限はない**。」/ 第六世代以降「連続で使うごとに1/3になる。**下限は 1/3^6=1/729**。」 Showdown `data/conditions.ts` の `stall`: `counterMax: 729`, `onStart(){ counter = 3 }`, `onRestart(){ counter *= 3 }` = **1/729 で頭打ち**。T4の「第五世代…最大1/4294967296」は**今回どの一次ソースでも確認できず**、JP Wikiは逆に「下限はない」と書く。またT4は第六世代以降の**1/729の下限を書き落としている**(simの実装値に直結するので設計上重要)。Bulbapedia側の要約は第三〜四世代 "lowest: 1/8"、第五世代以降 "×1/3, lowest 1/729" と返り、**JPと第五世代で食い違う**=第五世代は設計対象外なので保留でよい |
| 35 | Showdown `protect` は味方/相手の区別をしない=味方の単体技も防ぐ | Showdown battle.ts/moves.ts | 自前でコード直読 | 一致 | **B** | `checkMoveBypassesProtect`(battle.ts 1300行)は T4の引用どおり逐語一致。`protect` の condition `onTryHit` も `if (this.checkMoveBypassesProtect(move, source, target)) return;` のみで source 側の陣営判定なし |
| 36 | まもるが防げないのは 自分対象/自分+味方全員対象/全員対象/設置技 | Bulbapedia Protect | Showdown moves.ts(実データ) | 引用は一致 / **備考が不一致** | **B**(要修正) | Bulbapedia引用は逐語一致。★**備考の結論が誤り**: 「まもるは複数体が対象になる技(allAdjacent/allAdjacentFoes)を防げない=ダブルで相手のじしん等はワイドガードでしか防げない」は**誤り**。Showdown実データ: `earthquake { flags: { protect: 1, ... }, target: "allAdjacent" }` / `surf` も同じ → **まもるで防げる**。Bulbapediaの "moves that target all Pokémon" は `target: 'all'` のこと(`perishsong` / `teatime` は **protectフラグ自体が無い**)。ワイドガードの存在意義は「味方**も**まとめて守る」であって「まもるでは防げないから」ではない |
| 37 | JP版まもる記事に「味方の技を防げるか」の明文なし | JP Wiki まもる | 自前で再取得(2回) | 一致(**未発見を再現**) | **C** | 私も同ページを2通りのプロンプトで再取得したが該当文は無かった。T4の「取得失敗ではなく該当記述が存在しない」という書き方は妥当 |
| 38 | ダブル限定/ダブルで意味を持つ技の一覧 | ローカル ダブルバトル.json | ch corpus | 一致 | **B** | ローカルJSON内に逐語存在を確認:「てだすけ/アロマミスト/てをつなぐ/コーチング/ドラゴンエールはシングルバトルでは無効。おさきにどうぞ/さきおくり/サイドチェンジ/このゆびとまれ/いかりのこな/スポットライトはシングルバトルでは使っても意味が無い。」 |
| 39 | 「自分」対象の技=いかりのこな/このゆびとまれ/サイドチェンジ | ローカル ダブルバトル.json | master/moves.json | 一致 | **B** | ローカルJSON逐語存在を確認。master も3件とも target="自分" |

---

## 矛盾・要注意(設計に入る前に必ず読む)

1. **★#28 ワイドガード/ファストガードの連続使用は「独立」ではない(T4の暫定結論は誤り)**
   - T4は「WG⇔FG間**でのみ**カウンターを共有」を暫定の正としたが、**どの出典にもその記述はない**。
   - **第五世代**: まもる/みきり/こらえる/ワイドガード/ファストガードが**1本のカウンターを共有**(JP Wiki まもる「第五世代ではまもるとワイドガード/ファストガードを連続で使ったときは、順番に関わらず成功率が低くなる。」)。
   - **第六世代以降**: WG/FG は**自分自身は連続使用で失敗しない**。しかし**成功するとカウンターは進む**ため、**その後に使うまもる系の成功率が 1/3, 1/9… に落ちる**(JP Wiki ワイドガード/ファストガード両ページ)。
   - Showdown実装がこれを正確に写している: `wideguard`/`quickguard` は `onHitSide(side, source) { source.addVolatile('stall'); }` を**持つ**が、`onTry` は `return !!this.queue.willAct();` だけで **stall を参照しない**。対して `craftyshield`/`matblock` は `addVolatile('stall')` を**持たない**(=カウンターに一切関与しない)。`protect` は `onPrepareHit` で `this.runEvent('StallMove', pokemon)` を**参照し**、`onHit` で `addVolatile('stall')` する。
   - **Bulbapedia "Protection" の "not tied to any other move" は片方向にしか正しくない**(WG/FG自身は他の技に縛られないが、他の技をWG/FGが縛る)。**日本語Wiki+Showdown実装(2ソース一致)を採る**。

2. **★#36 まもるは「じしん」「なみのり」を防げる(T4の備考は誤り)**
   - `earthquake` / `surf` は `flags: { protect: 1, ... }` かつ `target: "allAdjacent"`。`checkMoveBypassesProtect` は `move.flags['protect']` だけを見るので**まもるで止まる**。
   - Bulbapediaの "moves that target all Pokémon" は `target: 'all'`(ほろびのうた・おちゃかい等、**protectフラグなし**)を指す別カテゴリ。
   - **設計上の意味**: 「複数対象技=まもる不可、ワイドガード専用」という分岐を実装に入れてはいけない。ワイドガードの独自性は「**味方の分も、味方が撃った巻き添えも**まとめて守る」点。

3. **★#12 引き寄せの速さ比較で 権威記述 と Showdown が食い違う**
   - JP Wiki(ひらいしん): 「ランク補正やトリックルーム状態などの効果を**除外した**すばやさ実数値を比較する。」
   - Showdown: `compareRedirectOrder` の speed は `handler.speed = pokemon.speed` → `getActionSpeed()` = `getStat('spe', false, false)`(**ランク補正込み**)+**トリックルームで `10000 - speed` に反転**。Magic Bounce だけ `getStat('spe', true, true)`(素の値)の特例が入っているのに RedirectTarget には無い。
   - **本プロジェクトは権威ソース優先の方針なので、JP Wiki(素の実数値・トリックルーム無関係)を採るべき**。Showdownを差分オラクルに使う時、ここは**既知の期待差分**として登録しておくこと。

4. **#27 Showdownのコード引用が誤り**(`&&` を `\|\|` と書き、備考でも「ORで繋ぎ」と誤解説)。結論は正しいので、引用文だけ差し替えれば足りる。

5. **#11 世代欄がT4自身の引用と矛盾**。第三・四世代のひらいしんは**引き寄せのみ**(ダメージ無効化・とくこう上昇は第五世代から)。T4の「第四世代(無効化・被ダメ0)」は削除すべき。

6. **#34 まもるの成功率の下限が欠落**。第六世代以降(=Champions)の下限は **1/729**(JP Wiki と Showdown `counterMax: 729` の2ソース一致)。simに入れる数字はこれ。「第五世代…最大1/4294967296」は今回どの出典でも裏が取れず、かつ JP Wiki は「下限はない」と書く(第五世代は設計対象外なので落としてよい)。

7. **#31 トリックガードの除外例が出典なし**。「自分自身へのつぶしあい系」はJP Wikiにもshowdownにも見当たらない。実際の除外例は 全員対象(おちゃかい/たがやす/フラワーガード/ほろびのうた)と 味方全員対象(アシストギア/アロマセラピー/いのちのしずく)。**さらに Showdown は `['self','all']` しか除外しておらず「味方全員が対象」を除外していない**=JP WikiとShowdownの食い違いの可能性(Champions非採用技なので設計優先度は低い)。

8. **Championsの在/不在の判定根拠が資料によって強さが違う(#17 よびみず・#21 スクリューおびれ・#24 ねらいうち)**
   - `moves_ch.json` は **497件=絞り込み済み**なので、**技の不在は Champions非採用の証拠として使える**(スポットライト/トリックガード/ねらいうち)。
   - `abilities_ch.json` は **314件=全国の特性ほぼ全件**(masterは313件)。**特性の在/不在は証拠にならない**。よびみず・スクリューおびれの Champions 欄「N」は **master の `champions:false` フラグだけ**が根拠なので、設計では**未確定**として扱うこと(T4の末尾§6の注意書きは妥当だが、表の「N」表記が強すぎる)。

9. **引用の逐語性が全体的に甘い**(#1 #4 #6 #29 が顕著)。かぎ括弧の中が原文と一致しない=T4の運用ルール「引用(原文・かぎ括弧)」違反。**事実は概ね正しい**ので、引用文の差し替えで直る。本ファイルの各行に原文を載せたので、そのまま置き換え可能。

10. **URLについては問題なし**。`wiki.xn--rckteqa2e.com` は現在 `wiki.pokemonwiki.com` へ 301 転送される同一サイト(実測)。T4のURL群は有効。

---

## 設計で使ってよい確定事項(A/B のみ)

**引き寄せ(リダイレクト)**
- このゆびとまれ/いかりのこな: 対象を**1体選ぶ技だけ**を自分に集める。**全体・複数対象技には効かない**。優先度は**第六世代以降+2**(Champions=+2)。対象は「自分」。[A]
- いかりのこな は **くさタイプ / 特性ぼうじん / ぼうじんゴーグル** の**撃つ側**に無視される(第六世代〜)。Bulbapediaは**すじがねいり/スクリューおびれ**も無視側に挙げる。[A]
- ひらいしん(Champions搭載): でんき技を**自分以外の全ポケモン**(=味方の技も含む)から引き寄せ、**無効化+とくこう+1**。**複数対象の技は引き寄せない**。第三・四世代は引き寄せのみ。[A]
- よびみず はひらいしんと**完全に同型**(みずタイプ)。ただし**ChampionsにあるかはT4/本検査ともに未確定**。[B/機構]
- **引き寄せの強さ順**: スポットライト(2) > このゆびとまれ・いかりのこな(1) > ひらいしん・よびみず(0)。場に「ちゅうもくのまと」がいれば ひらいしん/よびみず は引き寄せられない。[B]
- **同ターンに味方2体が引き寄せ技を使ったら、先に使った(=先に効果が付いた)方が優先**。Showdownは `compareRedirectOrder` の `effectOrder 昇順`で実装。[B]
- **同じ特性が複数いたら すばやさが一番高い方**。★JP Wikiは「**ランク補正・トリックルームを除外した素の実数値**」と明記。Showdownは補正込み+TR反転なので**ここは権威優先**。[B/要注意3]
- ひらいしんは**まもる中でも引き寄せは発動する**が、まもるで防げる技ならとくこうは上がらない。[B1]
- **引き寄せを無視する側**: すじがねいり(Champions搭載)/スクリューおびれ/ねらいうち。判定は**技を選んだ時点でなく使用される時点**の特性で行う。**直接狙った場合はタイプ無効化そのものは発生する**。[B]
- 引き寄せ判定は**ダブル以上でのみ**、かつ**溜め技の1ターン目では発火せず、実行ターンに改めて判定**する。[B]

**保護**
- まもる/みきり/キングシールド: 対象は**自分だけ**(味方は各自で使う必要がある)。**味方が撃った単体技も防ぐ**(実装上、陣営の区別なし)。**じしん/なみのり等の複数対象技も防ぐ**(protectフラグを持つため)。防げないのは 自分対象技 / 自分+味方全員対象技 / **場の全員対象技(target:'all')** / 設置技。[B]
- まもる系の連続使用: **第六世代以降は 1/3 ずつ低下、下限 1/729**。失敗するとリセット。[B/A(ch)]
- ワイドガード(Champions搭載): 優先度+3・範囲=味方の場。**複数対象技(allAdjacent / allAdjacentFoes)だけ**を、**相手が撃ったものも味方が撃ったものも**防ぐ。**ドラゴンアローは防げない**。**単体技は防げない**。[A]
- ファストガード(Champions搭載・英語名 Quick Guard。「クイックガード」という別技は存在しない): 優先度+3・範囲=味方の場。**優先度が上がった技**(いたずらごころ等で上がったものを含む/第六世代以降)を防ぐ。**ふかしのこぶし**の直接攻撃技と**フェイント**は防げない。[A]
- ★**ワイドガード/ファストガードは自身が連続使用で失敗することはない(第六世代以降)が、成功するとまもる系のカウンターを進める**。第五世代はまもると同一カウンター。[B/要注意1]
- トリックガード(Crafty Shield): **Champions非採用**(第六世代初出・**BDSP/SVで使用不可**、moves_ch.json にも不在)。連続使用で失敗しない。[B]
- スポットライト: **第八世代以降 選択できない**=**Champions非対象**。設計に入れる必要なし。[B]
