# T5_味方連携技.md 裏取り(反証)結果

- 検査対象: `/Users/masamichi/Documents/ポケモンDB/review/_doubles_research_2026-09-07/T5_味方連携技.md`
- 検査日: 2026-09-07 / 検査: 裏取り担当(反証者)
- 検査した主張: **89件(#1〜#89・全数。サンプリングなし)**
- 区分: **A**=Champions で確認できた(ヤックン/ch/・Serebii Champions・公式) / **B**=一般世代の権威2ソース一致 / **B1**=1ソースのみ / **C**=不明・矛盾・取得失敗
- 集計: **A=36 / B=41 / B1=9 / C=3**

## 使った第2ソース
| 種別 | URL / パス |
|---|---|
| ローカル(ポケモンWiki 2026-07-28取得) | `reference/_authority_corpus/rules/ダブルバトル.json` (`url`= https://wiki.pokemonwiki.com/wiki/ダブルバトル ) |
| ローカル(ヤックン /ch/ Champions版 497技) | `reference/_authority_corpus_ch/moves_ch.json` |
| ローカル(ヤックン /ch/ Champions版 314特性) | `reference/_authority_corpus_ch/abilities_ch.json` |
| ポケモンWiki | https://wiki.pokemonwiki.com/wiki/サイドチェンジ |
| Bulbapedia | Double_Battle / Ally_Switch / Round / Sky_Drop / Hold_Hands / Fire_Pledge / Heal_Bell / Coaching / Flame_Burst / Helping_Hand / Instruct (move) |
| Showdown 実装(実ファイルをDLして全数照合) | `data/moves.ts`(21297行) / `sim/battle-actions.ts`(1970行) / `sim/battle-queue.ts`(420行) / `sim/pokemon.ts` |

**★Showdown の行番号は全22技を実ファイルで再現確認し、元ファイルの引用行番号と完全一致した**(helpinghand 8576 / round 15493 / afteryou 195 / quash 14449 / instruct 9644 / coaching 2590 / aromaticmist 591 / holdhands 8936 / acupressure 137 / pollenpuff 13565 / flameburst 5564 / skydrop 16675 / selfdestruct 16001 / explosion 4967 / tailwind 18869 / healbell 8243 / aromatherapy 556 / fakeout 5088 / allyswitch 302 / firepledge 5380 / grasspledge 7579 / waterpledge 20512 / prioritizeAction battle-queue.ts 277-287 / Dancer battle-actions.ts 318-344)。**コード引用の改変・でっち上げは1件も無かった。**

---

## 検査表

| # | 主張(要約) | 元出典 | 第2ソースURL | 一致/不一致/未発見 | 区分 | 指摘 |
|---|---|---|---|---|---|---|
| 1 | ダブルでは味方にも攻撃できる。相手1体/相手全体対象の技では味方を攻撃不可 | ポケモンWiki(ローカル) | Showdown `pokemon.ts getMoveTargets`(target種別 normal/adjacentFoe/allAdjacentFoes) | 一致 | B | 引用は raw_text に**一字一句存在**。target種別で決まるという備考も実装と整合 |
| 2 | てだすけ等はシングルで「無効」/おさきにどうぞ等は「意味が無い」 | ポケモンWiki(ローカル) | Bulbapedia Helping_Hand「Helping Hand will fail in a Single Battle.」/ Hold_Hands「It will fail if used in a Single Battle」/ Coaching「If used in a Single Battle...Coaching will fail.」 | 一致 | B | 引用verbatim確認。**★Champions欄の要修正**: 列挙されたうち **てをつなぐ と スポットライト は Champions 497技に不在**(ch実在=てだすけ/アロマミスト/コーチング/ドラゴンエール/おさきにどうぞ/さきおくり/サイドチェンジ/このゆびとまれ/いかりのこな)。「Y」の根拠列に不在2件を混ぜないこと |
| 3 | 範囲技は0.75倍(第四世代〜)/第三世代は0.5倍・味方巻き込み技は対象外 | ポケモンWiki(ローカル) | Bulbapedia Double_Battle「In Generation III...reduced by 50%...In subsequent games...reduced by 25%」 | 一致 | B | 「(but not moves that hit all Pokémon on the field, such as Earthquake)」がWikiの「味方を巻き込む技には適用されない」と一致 |
| 4 | 実際の対象が1体だけなら範囲補正なし。2体対象なら片方無効化でも補正あり | ポケモンWiki(ローカル) | Bulbapedia Double_Battle「only takes effect if there are multiple targets when the move is executed whenever or not they would be hit by it, a slot with no Pokémon in it does not count as a target」 | 一致 | B | 「無効化されても補正はかかる」= Bulbapedia の「whenever or not they would be hit」と一致 |
| 5 | 第四世代のじばく/だいばくはつのみ、対象2体でも範囲補正なし | ポケモンWiki(ローカル) | 第2ソース未発見 | 未発見 | **B1** | 引用verbatim。第五世代以降の扱いは元ファイル通り不明のまま。設計では第四世代限定の例外として封じておく |
| 6 | 複数対象技のダメージ処理順(第三=1P1→2P1→1P2→2P2 / 第四=すばやさ順 / 第五以降=味方→左敵→右敵) | ポケモンWiki(ローカル) | Bulbapedia Double_Battle「**From Generation IV onward**, moves that target multiple Pokémon resolve in order of the target's respective Speed stats.」 | **不一致** | **C** | **★最重要の矛盾**。第五世代以降について、ポケモンWiki=位置順 / Bulbapedia=すばやさ順。**Showdown は JP Wiki 側**(`pokemon.ts getMoveTargets` の `case 'allAdjacent'` は `adjacentAllies()` を push した後 `adjacentFoes()` を push するだけで**速度ソートを一切かけない**)。2対1でJP Wiki有利だが、Bulbapedia を反証しきれていない。設計採用前に要決着 |
| 7 | 味方単体対象で味方が消えた時、第四世代までは敵へ再標的/第五世代以降は失敗 | ポケモンWiki(ローカル) | Bulbapedia Double_Battle に該当記述なし | 未発見 | **B1** | 引用verbatim。Showdown `getMoveTargets` の default 分岐は「If a targeted foe faints, the move is retargeted」= **敵**限定の再標的で、味方消滅時の再標的は無い(=第五世代以降側と整合)が明示的裏取りではない |
| 8 | 壁の補正 第四=2/3・第五=2703/4096・第六以降=2732/4096 | ポケモンWiki(ローカル) | Bulbapedia Double_Battle に記載なし | 未発見 | **B1** | 引用verbatim。数値が実装に直結するので Bulbapedia「Light Screen」/「Damage」ページで別途裏取りすべき(今回取得せず) |
| 9 | 壁の効果を受けるのが1体だけなら 第四以前1/2・第五以降2/3 | ポケモンWiki(ローカル) | 第2ソース未発見 | 未発見 | **B1** | 同上 |
| 10 | じしんは味方を巻き込むため扱いづらい(ドリルライナー等で代用) | ポケモンWiki(ローカル) | — | 未発見 | **B1** | 引用verbatim(Wikiの「対戦」節)。**これは戦術論であって仕様ではない**。設計書には「じしん=自分以外全体=味方を巻き込む」という target 事実だけ採り、代用技の話は落とすべき |
| 11 | てだすけ=優先度+5、味方の技の威力1.5倍 | ヤックン/ch/ | ローカル ch corpus 実データ(move=270, target=味方1体) | 一致 | **A** | 引用**一字一句一致**を再現確認 |
| 12 | てだすけはシングルで無効 | ポケモンWiki | Bulbapedia Helping_Hand「Helping Hand will fail in a Single Battle.」 | 一致 | B | |
| 13 | Showdown: 対象が newlySwitched でなく willMove でもなければ不発。重ねがけで1.5倍ずつ乗算 | Showdown moves.ts L8576 | Bulbapedia Helping_Hand「It will fail if there is no adjacent ally, or if the ally has already acted this turn.」「two Helping Hands...increase by 125%」 | 一致 | B | コード再現確認済。1.5×1.5=2.25(=+125%)が Bulbapedia と数値一致=実装と仕様が一致している強い証拠 |
| 14 | りんしょう: 同ターンの2本目以降は速度無視で連続・威力2倍・音系・みがわり貫通 | master/moves.json(元ファイルは「**Champions未実装 N**」と断定) | ローカル `moves_ch.json` **move=496 に実在** / Bulbapedia Round「all but the first Round within a turn will double in power to 120」「can now hit Pokémon even if they are behind a substitute」(第六世代〜) | **一致(ただし元ファイルの区分が誤り)** | **A** | **★重大な誤り。りんしょうは Champions 実装済み**。ch原文=「同じターンに他のポケモンも『りんしょう』を使おうとすると、『すばやさ』に関係なく最初に使用したポケモンに続いて使用でき、最初以外の『りんしょう』は威力が2倍になる。音系の技。相手の『みがわり』状態を貫通する。(ダブルバトル用)」(target=1体選択)。元ファイルは**英語名由来の「ラウンド」で検索して0件→未実装と誤判定**。しかも同じ元ファイルの **#88 でりんしょうを ch 実在技として列挙している=自己矛盾**。区分 N → **A** に修正し、引用も master ではなく ch 原文に差し替えること |
| 15 | Showdown: round は `onTry` で `prioritizeAction`、`sourceEffect==='round'` で威力2倍 | Showdown moves.ts L15493 | Bulbapedia Round | 一致 | B | コード再現確認済。`prioritizeAction` が `order=3` にして `list.unshift` するのも battle-queue.ts L277-287 で確認 |
| 16 | ちかい3技は第五世代から | ポケモンWiki | Bulbapedia Fire_Pledge | 一致 | B | Champions非実装は ch corpus で再現確認(ほのお/みず/くさのちかい とも**不在**) ✓ |
| 17 | 先に動く方は待機し、2匹目の行動に割り込んで威力150で発動 | ポケモンWiki | Bulbapedia Fire_Pledge「the ally moving first will not itself use a move, but instead the ally moving second will use a combined attack with a power of 150」 | 一致 | B | |
| 18 | セッター成功時、アタッカーはさきおくりの効果を無視して繰り上がる | ポケモンWiki | Showdown: quash は `action.order=201`、pledge は `prioritizeAction`(=`order=3`+先頭挿入)で上書き | 一致 | B | 実装レイヤーの差という元ファイルの説明は正しい |
| 19 | くさ+みず=湿原(速さ1/4)/ほのお+くさ=火の海(1/8ダメージ)/みず+ほのお=虹(追加効果2倍) | ポケモンWiki | Bulbapedia Fire_Pledge「Rainbow...doubles the probability of additional effects...four turns」「Sea of Fire...1/8 of their maximum HP...four turns」+ Showdown grasspledge `onModifySpe → chainModify(0.25)` | 一致 | B | Bulbapedia の Fire Pledge ページには Swamp(湿原)の記載が無いが、Showdown の 0.25 が JP Wiki の 1/4 と一致。**duration=4ターン**は元ファイルに書かれていない=設計時に補うこと |
| 20 | Showdown: pledge 3技の相互参照実装(prioritizeAction / タイプ変更 / basePower 150 / condition) | Showdown moves.ts L5380,7579,20512 | Bulbapedia Fire_Pledge | 一致 | B | 全3ブロックを実読して確認。`move.self={sideCondition:'waterpledge'}`(虹=自分の場)/ `move.sideCondition='firepledge'`(火の海=相手の場)の非対称も正しい |
| 21 | サイドチェンジ=優先度+2、自分と味方1体の位置交代、ダブルバトル用 | ヤックン/ch/ | ローカル ch corpus(move=502, target=自分) | 一致 | **A** | 引用**一字一句一致** |
| 22 | 第9世代から連続使用で成功率が1/3ずつになる(失敗でリセット) | ヤックン/ch/ | ローカル ch corpus / Bulbapedia Ally_Switch「The **Pokémon Champions** description clarifies that "With each consecutive use, this move's chance of success becomes 1/3 of what it was before."」 | 一致 | **A** | Bulbapedia が **Champions の説明文として明示**しており、A区分の裏付けが二重に取れた |
| 23 | 優先度は第六世代以前+1、第七世代以降+2 | ポケモンWiki/サイドチェンジ | 実ページ再取得で「+1（第六世代以前）、+2（第七世代以降）」を確認 + Bulbapedia「priority is +1」(Gen V-VI)→「increased to +2」(Gen VII-VIII) | 一致 | B | 元ファイルは「(要約引用)」と正直に注記していた。実ページ表記は上記の通り |
| 24 | 対象位置に使用者自身が移動していた場合、その技は失敗 | ポケモンWiki/サイドチェンジ | 実ページ再取得で**verbatim一致** + Bulbapedia「the Pokémon is now targeting itself when it would execute the move, the move will fail」 | 一致 | B | 元ファイルの備考「技の対象はポケモンではなく**位置**に固定される」は両ソースと整合。設計上の要点として妥当 |
| 25 | 移動先が隣接しない位置になった場合その技は失敗 | ポケモンWiki/サイドチェンジ | 実ページ再取得で**verbatim一致**。Bulbapedia側に対応記述を確認できず | 一部未発見 | **B1** | 元ファイルの「トリプルバトルのケースと推定」は**推定**のまま。ダブルでは隣接しない位置が発生しないので**ダブル設計には不要** |
| 26 | ダブルでは交代以外で唯一位置を変更できる方法 | ポケモンWiki/サイドチェンジ | 実ページ再取得で**verbatim一致**。第2ソース未発見 | 未発見 | **B1** | ★引用は正しいが**主張自体が要注意**。Wikiの編集者見解に近く、しれいとう(場から退く)等の周辺事象と整合を取っていない。設計の前提条件には使わないこと |
| 27 | Showdown: allyswitch はダブル/トリプル以外で失敗、トリプル中央で失敗、counter 3→729 の1/3判定 | Showdown moves.ts L302 | ch corpus の「1/3になっていく」 | 一致 | B | コード再現確認済。counterMax=729(=3^6)、`onStart`で counter=3、`onRestart`で `randomChance(1,counter)`、失敗で volatile 削除、成功で `counter*=3`。元ファイルの記述に誤りなし |
| 28 | おさきにどうぞ=相手が直後に行動できる。ダブルバトル用 | ヤックン/ch/ | ローカル ch corpus(move=495, target=1体選択) | 一致 | **A** | 引用**一字一句一致** |
| 29 | シングルバトルでは使っても意味が無い | ポケモンWiki | Showdown `afteryou`/`quash`: `if (this.activePerHalf === 1) return false; // fails in singles` | **一部不一致** | **B1** | ★Wikiは「意味が無い」(=成立するが効果皆無)、Showdown は**明示的に失敗(fails)**。元ファイルは #2 備考でこの書き分けに注意と書いているが、**#29の主張自体が Showdown と食い違う**。設計では Showdown 準拠(=シングルでは技が失敗)を採るのが安全。ダブル専用設計なら影響なし |
| 30 | Showdown afteryou: activePerHalf===1 で不発、willMove があれば prioritizeAction | Showdown moves.ts L195 | — | 一致 | B | コード再現確認済 |
| 31 | さきおくり=相手の行動が最後になる。ダブルバトル用 | ヤックン/ch/ | ローカル ch corpus(move=511, target=1体選択) | 一致 | **A** | 引用**一字一句一致** |
| 32 | Showdown quash: シングルで不発、`action.order = 201` | Showdown moves.ts L14449 | — | 一致 | B | コード再現確認済 |
| 33 | さいはい: 直前の技をもう一度出させる。反動技等には失敗 | master/moves.json(元ファイルは「**Champions一次引用は取得失敗**」と記載) | ローカル `moves_ch.json` **move=629 に実在** / Bulbapedia Instruct(失敗条件の一覧) | **一致(ただし元ファイルの「取得失敗」が誤り)** | **A** | **★重大な誤り。ch 原文は取得済みのローカルファイルに存在した**。ch原文=「相手が最後に使用した技をその場でもう一度使わせる。『はかいこうせん』など反動のある技や、ターン技、ダイマックス技、『ダイマックスほう』など一部の技は失敗する。」(target=1体選択)。「取得失敗」を撤回し引用を差し替えること。**さらに元ファイルの重大な取りこぼし**: さいはいの target は「1体選択」=ダブルでは**味方も指定できる**(Showdown も `target:"normal"`)。ダブルでのさいはいの本来の使い方(味方に強技を2回撃たせる)が元ファイルに一切書かれていない |
| 34 | Showdown instruct: lastMove無し/ダイマックス/failinstruct/isZ/isMax/charge/recharge/beakblast/focuspunch/shelltrap/PP0 で不発 | Showdown moves.ts L9644 | Bulbapedia Instruct の失敗条件一覧と一致 | 一致 | B | コード再現確認済(条件式が一字一句一致) |
| 35 | おどりこ: 踊り系12技に反応して直後に同じ技を使える | ヤックン/ch/ abilities_ch.json | ローカル abilities_ch.json(id:203) | 一致 | **A** | 引用**一字一句一致**(アクアステップ含む12技も一致)。「技ではなく特性」という元ファイルの注意喚起は妥当 |
| 36 | Showdown Dancer: 速度の低い順に発動、同速は特性取得が新しい方が先。対象選択ロジック | Showdown battle-actions.ts L318-344 | — | 一致 | B | コード・コメントとも**verbatim一致**。「Ties go to whichever Pokemon has had the ability for the least amount of time」= 元ファイルの「取得が新しい順が先」で解釈も正しい |
| 37 | コーチング: 自分を除く味方全体のこうげき・ぼうぎょ+1。ダブルバトル用 | ヤックン/ch/ | ローカル ch corpus(move=826, target=味方全体) | 一致 | **A** | 引用**一字一句一致** |
| 38 | Showdown coaching: `boosts:{atk:1,def:1}`, `target:"adjacentAlly"` | Showdown moves.ts L2590 | Bulbapedia Coaching「boosts the Attack and Defense of **all allies** (but not the user...)」+ ポケモンWiki 分類「**自分以外の味方全員**」+ ヤックン ch「味方全体」 | **コードは一致 / 仕様との差は Showdown 側が外れ値** | B | ★元ファイルが「要検証(取得できず)」とした点を**決着させた**。ヤックン/ポケモンWiki/Bulbapedia の**3ソースが「自分以外の味方全体」で一致**し、Showdown の `adjacentAlly` だけが単体。**設計は「自分以外の味方全体」を採用**すること(ダブルでは同一挙動、トリプル以上でのみ差) |
| 39 | アロマミスト: 味方1体のとくぼう+1。ダブルバトル用 | ヤックン/ch/ | ローカル ch corpus(move=584, target=味方1体) | 一致 | **A** | 引用**一字一句一致** |
| 40 | Showdown aromaticmist: `boosts:{spd:1}`, `target:"adjacentAlly"`, `flags:{bypasssub:1}` | Showdown moves.ts L591 | — | 一致 | B | コード再現確認済(bypasssub も実在) |
| 41 | てをつなぐ: 効果なし。対象は味方1体 | ポケモンWiki | Bulbapedia Hold_Hands「Hold Hands has no effect in battle.」「1 Ally: Affects an adjacent ally」 | 一致 | B | Champions非実装は ch corpus で**不在**を再現確認 ✓ |
| 42 | ダブル/トリプルでしか成功しない | ポケモンWiki | Bulbapedia「It will fail if used in a Single Battle or Horde Encounter」 | 一致 | B | Bulbapedia は**大量発生(Horde)でも失敗**と追記。元ファイルより情報が広い |
| 43 | 成功しても戦闘アニメだけでメッセージは出ない | ポケモンWiki | Bulbapedia「it and its target ally will perform a brief animation together」 | 一致 | B | |
| 44 | Showdown holdhands: `isNonstandard:"Unobtainable"`、多数の fail 系フラグ | Showdown moves.ts L8936 | — | 一致 | B | コード再現確認済 |
| 45 | つぼをつく: ランダムで7ランクのどれか1つが+2 | ヤックン/ch/ | ローカル ch corpus(move=367, target=自分か味方) | 一致 | **A** | 引用**一字一句一致** |
| 46 | 自分の代わりに味方を対象にできる | ポケモンWiki | ch target欄「自分か味方」+ Showdown `target:"adjacentAllyOrSelf"` | 一致 | **A** | 3ソース一致。元ファイルの「不明」は **A に格上げ可** |
| 47 | Showdown acupressure: `adjacentAllyOrSelf`、全ランク+6なら失敗、余地のあるものから1つ+2 | Showdown moves.ts L137 | — | 一致 | B | コード再現確認済 |
| 48 | かふんだんご: 味方に使うとHP1/2回復 | ヤックン/ch/ | ローカル ch corpus(move=642, target=1体選択) | 一致 | **A** | 引用**一字一句一致** |
| 49 | 味方対象時は半分回復(ダブルの技変化として明記) | ポケモンWiki(ローカル) | ch と一致 | 一致 | B | 引用verbatim |
| 50 | Showdown pollenpuff: 味方なら basePower=0/infiltrates、heal 0.5、ヒールブロックで不発 | Showdown moves.ts L13565 | — | ほぼ一致 | B | コードは正確。**軽微な誤り**: 元ファイルは「なにも おこらない」で不発と書くが、実コードは `this.add('cant', source, 'move: Heal Block', move)`(=かいふくふうじで技が出せない表示)。「なにもおこらない」は満タン時の `NOT_FAIL` 側。表現を分けること |
| 51 | はじけるほのおは対象の味方にも最大HPの1/16 | ポケモンWiki(ローカル) | Bulbapedia Flame_Burst「the up to two Pokémon that are both allied with and adjacent to the target」「equal to 1/16 of their respective maximum HP」 | 一致 | B | Champions非実装を ch corpus で再現確認 ✓ |
| 52 | Showdown flameburst: onHit と onAfterSubDamage 両方で 1/16。`isNonstandard:"Past"` | Showdown moves.ts L5564 | Bulbapedia「is not affected by...Substitute」 | 一致 | B | コード再現確認済。みがわり越しに漏れるという元ファイルの読みも Bulbapedia と一致 |
| 53 | 味方に選べるが実際には必ず失敗する | ポケモンWiki/フリーフォール | Bulbapedia Sky_Drop「Sky Drop can target allies, but will fail when attempting to perform the move on them.」 | 一致 | B | |
| 54 | 対象のおもさ200.0kg以上で失敗(第六世代以降) | ポケモンWiki | Bulbapedia「Targets weighing 440.9 lbs. (200 kg) or more cannot be lifted」「introduced in Generations VI and VII」 | 一致 | B | 世代表記も一致 |
| 55 | 対象がひこうタイプならダメージなし(**全世代**) | ポケモンWiki/フリーフォール | Bulbapedia Sky_Drop「Sky Drop does no damage to Flying-type Pokémon」— ただし**第五世代の文脈**で記載され、以降の世代への継続は明記なし | 一部未発見 | **B1** | ★**世代表記が裏取り不足**。「全世代(登場世代から)」は Bulbapedia から確認できない。ただし Showdown の現行(第九世代基準)データに `if (target.hasType('Flying')) { this.add('-immune', target); return null; }` が実在するため**現行世代でも有効**なのは確か。「全世代」→「第五世代で確認・現行 Showdown 実装にも存在(第六〜第九の一次資料は未取得)」に弱めること。Champions非実装なので設計影響は小 |
| 56 | Showdown skydrop: 味方なら return false、200.0kg 以上で失敗 | Showdown moves.ts L16675 | — | 一致 | B | コード再現確認済。**元ファイル未記載の事実**: 同じ行で `target.volatiles['substitute']` でも失敗(元ファイルは「取れなかった点6」で自ら指摘済み=誠実) |
| 57 | じばく/だいばくはつ: 攻撃後ひんし。対象は自分以外全体 | ヤックン/ch/ | ローカル ch corpus(move=120/153, target=自分以外全体) | 一致 | **A** | 引用**一字一句一致** |
| 58 | 「自分以外全員」グループの技でダブルでは味方も巻き込む | ポケモンWiki(ローカル) | Wiki「対象が変わる技の一覧>自分以外全員」に じばく・だいばくはつ を実在確認 + ch target欄「自分以外全体」+ Showdown `target:"allAdjacent"` | 一致 | B | 3ソース一致 |
| 59 | Showdown: `selfdestruct:"always"`, `target:"allAdjacent"` | Showdown moves.ts L16001/L4967 | — | 一致 | B | コード再現確認済。**★備考に誤りあり**: 元ファイルは `noparentalbond` を「こだわりメガネ的な複製技(こどもうでんぱ等)の対象外」と説明するが、**noparentalbond は特性「おやこあい」(Parental Bond)で2回目が発動しないという意味**。「こだわりメガネ」「こどもうでんぱ」は無関係。備考を削除/訂正すること |
| 60 | おいかぜ: 4ターン、自分と味方のすばやさ2倍 | ヤックン/ch/ | ローカル ch corpus(move=366, target=味方の場) | 一致 | **A** | 引用**一字一句一致** |
| 61 | Showdown tailwind: sideCondition, allySide, chainModify(2), duration 4(persistent で6) | Showdown moves.ts L18869 | — | 一致 | B | コード再現確認済 |
| 62 | ちょうはつは「味方の場」グループではない | master/moves.json | ポケモンWiki「味方の場」一覧(おいかぜ/オーロラベール/おまじない/しろいきり/しんぴのまもり/たたみがえし/トリックガード/ハッピータイム/ひかりのかべ/ファストガード/リフレクター/ワイドガード)に**ちょうはつは不在**を実確認 + ch target「1体選択」 | 一致 | B | 元ファイルのタスク文への訂正は**妥当**。Wikiの一覧を実データで再現確認した |
| 63 | いやしのすず: 手持ち全員の状態異常を治す。ダイウォール不可・みがわり貫通・音系 | ヤックン/ch/ | ローカル ch corpus(move=215)の**原文と一致しない** | **不一致(引用の改変)** | **C** | **★引用の整合性違反。ch 原文は「自分と味方全体のポケモンの状態異常を治す。音系の技。味方が『みがわり』状態でも効果が発生する。この技は『ダイウォール』の効果も受けない。」** 元ファイルの「手持ち全員の状態異常をすべて治す。（ダイウォールの効果も受けない）味方が『みがわり』状態でも、効果がとどく。音系の技。」は**語も順序も別物**。内容(手持ち全員)は Bulbapedia「cures the user, all Pokémon in the user's party, and the user's allies」+ Showdown `target:"allyTeam"` が裏付けるので**事実は正しいが、かぎ括弧の中身は原文に差し替え必須** |
| 64 | アロマセラピー: 手持ちを含む味方全員の状態異常を回復 | ポケモンWiki/アロマセラピー | Showdown `target:"allyTeam"` + 全 party ループ | 一致 | B | Champions非実装を ch corpus で再現確認 ✓ |
| 65 | いやしのすずとアロマセラピーは一長一短(具体差は本文に明記なし) | ポケモンWiki | 具体差の記述を第2ソースで確認できず | 未発見 | **C** | 元ファイルが自ら「取得できず」としている通り。#66 で機構差を補っているのは妥当な進め方 |
| 66 | Showdown 両技の相違(ぼうおん vs あまいもの、みがわり貫通の有無、かがくへんかガス系は共通) | Showdown moves.ts L8243/L556 | Bulbapedia Heal_Bell「Generation VI onward: Heal Bell no longer affects active Pokémon with the Ability Soundproof」「Heal Bell affects Pokémon even if they are behind a substitute」 | コードは一致 / **日本語特性名2件が誤り** | B | コード内容は正確(`ally !== source` ガードで自分自身は免疫判定外、も正しい)。**★誤り2件**: `sapsipper` の日本語名は「**そうしょく**」(✗あまいもの)、`goodasgold` は「**おうごんのからだ**」(✗かがくへんかガス。かがくへんかガス=neutralizinggas は別特性)。CLAUDE.md の「名前の不一致は機能が到達不能になる実バグを生む」に該当するので必ず訂正。**世代差の補足**: Soundproof 免疫は第五世代だけ無効化され第六世代以降で復活(Bulbapedia)=世代を書き添えるべき |
| 67 | アロマセラピーは `isNonstandard:"Past"` | Showdown moves.ts L556 | — | 一致 | B | コード再現確認済 |
| 68 | ねこだまし: 優先度+3、100%ひるみ、出た最初のターンのみ | ヤックン/ch/ | ローカル ch corpus(move=252, target=1体選択) | 一致 | **A** | 引用**一字一句一致** |
| 69 | Showdown fakeout: `source.activeMoveActions > 1` で不発 | Showdown moves.ts L5088 | — | 一致 | B | コード再現確認済。「ターン数でなく行動回数」という元ファイルの読みは正しい |
| 70 | かがくのちから/レシーバー: 味方ひんし時に特性コピー、場を離れると戻る(ダブルバトル用) | ヤックン/ch/ abilities_ch.json | ローカル abilities_ch.json(id:231/209) | 一致 | **A** | 引用**一字一句一致**。元ファイルは除外特性リスト(ARシステム〜レシーバーの30件)を省略しているが**改変ではない** |
| 71 | きょうえん: ダブルで場に出た時、味方の能力ランク変化をコピー | ヤックン/ch/ abilities_ch.json | ローカル abilities_ch.json(id:294) / ポケモンWiki「味方のランク補正と**きゅうしょアップ状態**を自分にコピーする」 | 一致(粒度差) | **A** | 引用**一字一句一致**。元ファイルの「矛盾ではなく粒度差」という判断は妥当。**設計は Wiki の広い方(急所アップ含む)を採るのが安全**(Champions が外したという積極的証拠はない) |
| 72 | おもてなし: 場に出た時、自分を除く味方全体のHPを1/4ずつ回復(ダブルバトル用) | ヤックン/ch/ abilities_ch.json | ローカル abilities_ch.json(id:299) | 一致 | **A** | 引用**一字一句一致** |
| 73 | しれいとう: 味方ヘイラッシャの口に入り行動不能、ヘイラッシャは全能力+2、ひんしまで交代不可 | ポケモンWiki(元ファイルは「**Ch未検索=不明**」) | ローカル `abilities_ch.json` **id:279 に実在** | **一致(ただし元ファイルの「未検索」が誤り・ch の方が精密)** | **A** | **★誤り。引用元として挙げた同じローカルファイルに存在した**。ch原文=「ダブルバトルで味方に『ヘイラッシャ』がいると口の中に入り、『ヘイラッシャ』の『こうげき』『ぼうぎょ』『とくこう』『とくぼう』『すばやさ』ランクが2段階ずつ上がる。口の中にいる間は、技を受けず、行動もできない。また自分もヘイラッシャも交代できない。ヘイラッシャが『ひんし』状態になると、もとに戻る。」 **Wikiより3点詳しい**: (a)「全能力」ではなく**5能力ランク**(命中/回避は含まない) (b)口の中では**技を受けない** (c)**自分もヘイラッシャも**交代できない。設計は ch 版を採ること |
| 74 | ひらいしん/よびみず: ダブルでは自分以外全員の該当タイプ単体攻撃技を自分に引き寄せる(複数対象技はそのまま) | ヤックン/ch/ abilities_ch.json | ローカル abilities_ch.json(id:31/114) | 一致 | **A** | 引用**一字一句一致** |
| 75 | スクリューおびれ/すじがねいり: ちゅうもくのまと/サイドチェンジ/ひらいしん・よびみずで対象変更されない | ポケモンWiki(元ファイルは「**Ch 不明**」) | ローカル `abilities_ch.json` **id:239/242 に実在** | **一致(元ファイルの「不明」は格上げ可)** | **A** | ch原文=「特性『ひらいしん』『よびみず』や技『いかりのこな』『このゆびとまれ』『サイドチェンジ』『スポットライト』の攻撃対象を変更する効果の影響を受けずに攻撃できる。」 Wikiの「ちゅうもくのまと」は**いかりのこな/このゆびとまれ/スポットライトが付与する状態変化名**なので両者は一致。**注**: ch の列挙に含まれる**スポットライトは Champions 497技に不在** |
| 76-89 | ch 497技のうち name/effect に「ダブル」を含む16件。うちダブルアタック/ダブルウイングは誤検出、残14件 | ヤックン/ch/ moves_ch.json | **同じ走査を独立に再実行**: ヒット16件・除外2件・残14件、technames と target 欄すべて元ファイルの表と**完全一致** | 一致 | **A** | 全数再現確認済。**補足すべき漏れ**: 「ダブル」の語を含まないためこの走査に出ないが ch に実在する重要なダブル用技 = **ワイドガード**(味方の場・複数対象技を防ぐ)、**ファストガード**(味方の場・先制技を防ぐ)、**てだすけ**(味方1体)、**ドラゴンエール**(味方全体・急所アップ)、**いのちのしずく**(味方全体・1/4回復)、**じばそうさ**、**とおぼえ**(味方全体こうげき+1)。「ダブル」文字列走査は**必要条件でなく十分条件ですらない**ので、target 欄(味方1体/味方全体/味方の場/自分以外全体)での走査を併用すべき |

---

## 矛盾・要注意

### 致命(設計に入る前に必ず直す)
1. **#14 りんしょうを「Champions未実装(N)」と誤判定** — ch corpus に `move=496` で実在し「(ダブルバトル用)」と明記。英語名「ラウンド」で検索したための誤り。しかも**同じ元ファイルの #88 でりんしょうを ch 技として列挙しており自己矛盾**。区分 N→**A**、引用も master でなく ch 原文へ。
2. **#33 さいはいの「Champions一次引用は取得失敗」が誤り** — ch corpus に `move=629` で実在(全文あり)。取得失敗の記載を撤回すること。**加えて、さいはいの target が「1体選択」=ダブルでは味方も指定できるという最重要のダブル用途が元ファイルに一切書かれていない。**
3. **#63 いやしのすずの引用がヤックン原文と一致しない(改変)** — かぎ括弧内が原文と別文。事実自体は正しいが、引用の信頼性を壊すので原文へ差し替え必須。
4. **#66 日本語特性名2件が誤り** — `sapsipper`=**そうしょく**(✗あまいもの)、`goodasgold`=**おうごんのからだ**(✗かがくへんかガス)。名前の取り違えは CLAUDE.md の禁止事項。
5. **#59 備考の noparentalbond 説明が誤り** — 特性「おやこあい」の話であり、こだわりメガネ/こどもうでんぱとは無関係。

### 矛盾(決着していない)
6. **#6 複数対象技のダメージ処理順** — ポケモンWiki(第五世代以降=味方→左敵→右敵)vs Bulbapedia(第四世代以降=すばやさ順)。**Showdown は JP Wiki 側**(`pokemon.ts getMoveTargets` の `allAdjacent` は `adjacentAllies()`→`adjacentFoes()` の順に push するだけで速度ソートなし)。2対1で JP Wiki 有利だが、Bulbapedia を反証しきれていない。**シミュレータのダメージ適用順に直結するので実機/第3ソースで決着させること。**
7. **#38 コーチングの対象範囲** — 元ファイルは「未検証」としたが、本検査で**ヤックン ch「味方全体」/ポケモンWiki「自分以外の味方全員」/Bulbapedia「all allies」の3ソースが一致**し、Showdown の `adjacentAlly` だけが外れ値と判明。**設計は「自分以外の味方全体」**を採る(ダブルでは同一挙動)。

### 世代の取り違え・裏取り不足
8. **#55 フリーフォールのひこうタイプ無効の世代範囲** — 「全世代」は Bulbapedia から裏取りできない(第五世代の文脈で記載)。Showdown 現行データには存在。表記を弱めること。
9. **#5 / #7 / #8 / #9 は1ソース(ポケモンWiki)のみ**。特に **#8 の壁補正 2703/4096・2732/4096 は数値がそのまま実装に入る**ので第2ソース必須。
10. **#29「意味が無い」vs Showdown「fails in singles」** — おさきにどうぞ/さきおくりはWikiの言う「効果皆無」ではなく Showdown では**明示的に失敗**。挙動が異なる(ちょうはつ・カウンター判定などに波及)。

### Champions 非搭載を「使える」前提にしていないかの確認(疑ってかかった結果)
- 元ファイルの **N 判定は正しい**: ほのお/みず/くさのちかい・てをつなぐ・はじけるほのお・フリーフォール・アロマセラピー は ch 497技に**不在**を独立に再現確認。
- ただし **#2 の「Champions確認 Y」列に、Champions 非実装の てをつなぐ・スポットライト が混じった列挙**になっている(Y の根拠として挙げた技だけは実在するが、行全体が Y に見える)。**スポットライトは Champions 不在**。
- **#75 の ch 原文に登場する「スポットライト」も Champions 497技に不在**。
- 逆に **りんしょう・さいはい・しれいとう・スクリューおびれ/すじがねいり は Champions 実装済みなのに N/不明にされていた**(=非搭載の過大評価。上記1・2・#73・#75)。

### 網羅性のギャップ(反証ではなく補足)
11. **#76-89 の「『ダブル』文字列走査」は取りこぼす** — ワイドガード/ファストガード/てだすけ/ドラゴンエール/いのちのしずく/じばそうさ/とおぼえ は ch に実在するダブル用技だが本文に「ダブル」が無く一覧に出ない。**target 欄(味方1体/味方全体/味方の場/自分以外全体)での走査を併用すべき。**
12. **ちかい技の場の効果の持続=4ターン**(Bulbapedia・Showdown `duration:4`)が #19 に書かれていない。
13. **てだすけの重ねがけ倍率**は 1.5×1.5=2.25(=+125%)、3回で 3.375(+237.5%)(Bulbapedia・Showdown 一致)。#13 に数値を明記すべき。

---

## 設計で使ってよい確定事項(A/B のみ)

**A(Champions で確認できた・そのまま実装してよい)**
- てだすけ = 優先度+5 / 味方1体 / 味方の技の威力1.5倍(重ねがけは乗算: 2回で2.25倍・3回で3.375倍)
- サイドチェンジ = 優先度+2 / 自分と味方1体の位置交代 / 第9世代から連続使用で成功率が1/3ずつ低下・失敗でリセット(実装 counter 3→9→27…上限729)
- おさきにどうぞ = 相手を直後に行動させる(1体選択) / さきおくり = 相手の行動を最後にする(1体選択)
- **りんしょう = Champions 実装済み**。同ターンの2本目以降は速度無視で連続・威力2倍・音系・みがわり貫通(1体選択)
- **さいはい = Champions 実装済み**(1体選択=**ダブルでは味方も指定可**)。反動技/ターン技/ダイマックス技等には失敗
- コーチング = 自分を除く**味方全体**のこうげき・ぼうぎょ+1 / アロマミスト = 味方1体のとくぼう+1
- つぼをつく = 自分か味方1体のランダム1ランク+2(7種) / かふんだんご = 味方に使うとHP1/2回復
- じばく・だいばくはつ = 対象「自分以外全体」・攻撃後に必ず自分がひんし
- おいかぜ = 味方の場・4ターン・すばやさ2倍 / ねこだまし = 優先度+3・100%ひるみ・場に出て最初の行動のみ
- いやしのすず = 味方全体・状態異常回復・音系・みがわり貫通(引用は ch 原文へ差し替えること)
- 特性: おどりこ(踊り系12技に反応) / かがくのちから・レシーバー(味方ひんし時に特性コピー・場を離れると戻る・除外30特性あり) / きょうえん(ダブルで場に出た時に味方のランク変化をコピー) / おもてなし(登場時に自分を除く味方全体を最大HP1/4回復) / **しれいとう(ch版: ヘイラッシャの5能力ランク+2・口の中では技を受けず行動できない・自分もヘイラッシャも交代不可)** / ひらいしん・よびみず(自分以外全員の該当タイプ**単体**攻撃技を引き寄せ・複数対象技はそのまま) / **スクリューおびれ・すじがねいり(引き寄せ系と サイドチェンジ の対象変更を受けない)**
- ch でダブル用と明記された14技(#76-89 の表)は全数再現確認済み

**B(一般世代の権威2ソース一致・Champions で覆されるまでの既定値)**
- 範囲補正: 複数対象になった時のみ**0.75倍**(第三世代のみ0.5倍かつ味方巻き込み技は対象外)。**実際の対象が1体だけなら補正なし**、2体対象なら片方が無効化されても補正あり
- ちかい3技(Champions 非実装): 味方2匹が同ターンに選ぶと先攻側が待機→後攻側に割り込んで**威力150**、さきおくりの order を無視して繰り上がる。虹=追加効果2倍(自分の場・4ターン)/火の海=非ほのおに毎ターン最大HP1/8(相手の場・4ターン)/湿原=すばやさ1/4(相手の場・4ターン)
- サイドチェンジの対象解決: **技の対象は「ポケモン」ではなく「位置」に固定**。入れ替え後にその位置へ使用者自身が来ていたらその技は失敗。優先度は第六世代以前+1・第七世代以降+2
- てだすけは**既に行動を終えた味方には失敗**(場に出たばかりの味方には成功)。シングルでは失敗
- ダンサー(おどりこ)の発動順: **補正前すばやさ実数値の低い順**、同速は特性取得が新しい方が先。外部発動(Dancer由来)には連鎖しない
- てをつなぐ(Champions 非実装): 効果なし・味方1体・シングル/大量発生では失敗
- はじけるほのお(Champions 非実装): 命中した相手の隣接味方に最大HP1/16、**みがわり越しでも漏れる**
- フリーフォール(Champions 非実装): 味方に使うと失敗・おもさ200.0kg以上で失敗(第六世代以降)・みがわりにも失敗
- いやしのすず vs アロマセラピー の実差: (1)免疫特性が **ぼうおん** vs **そうしょく**(2)いやしのすずは**みがわり貫通**、アロマセラピーは**みがわりで防がれる**。**おうごんのからだ**は両方に共通で免疫。どちらも手持ち(控え)を含めて回復
- ちょうはつは「味方の場」の技ではない(相手単体対象の変化技封じ)
