# T2「技の対象(target)体系」裏取り(反証)レポート

対象ファイル: `/Users/masamichi/Documents/ポケモンDB/review/_doubles_research_2026-09-07/T2_対象体系.md`(編集していない)
検査日: 2026-09-07 / 検査者: 裏取り担当(反証者)
検査方法: 全40主張を1つずつ。①元出典を自分で開き引用の実在と改変を確認 ②別ソースで同じ事実を探す ③A/B/B1/Cに区分。

## 自分で取り直した一次資料

| 資料 | 取得方法 | 備考 |
|---|---|---|
| ポケモンWiki「ダブルバトル」 | `https://wiki.xn--rckteqa2e.com/wiki/ダブルバトル` を WebFetch → **301 で `https://wiki.pokemonwiki.com/wiki/ダブルバトル` へ転送**。転送先を再取得 | 元レポのURL表記(xn--)とローカル`ダブルバトル.json`内の`url`(wiki.pokemonwiki.com)の食い違いは**同一サイトの正規リダイレクト**。問題なし |
| ローカル `reference/_authority_corpus/rules/ダブルバトル.json` | Read(fetched_at=2026-07-28) | 節名: 概要/発生/シングルバトルとの違い/**ダブルバトルにおける技**/対象が変わる技の一覧/ダブルバトルにおけるとくせい/… |
| Showdown `sim/{battle,battle-actions,pokemon,side,dex-moves,global-types}.ts`, `data/{moves,abilities,conditions}.ts` | curl で全文再取得 | |
| Showdown 世代mod `data/mods/{gen3,gen4,gen5,gen6,gen7,gen8}/moves.ts` | curl(**元レポ未取得のもの**) | F3の宿題を解消 |
| Bulbapedia `Category:Moves_by_range` / `Damage` / `Double_Battle` / `Curse_(move)` / `Thrash_(move)` | WebFetch | |
| ローカル `master/moves.json`(919) / `reference/_authority_corpus_ch/{moves_ch,abilities_ch}.json`(497技/314特性) | node で独立再集計 | |

---

## 検査結果表(全40件)

| # | 主張(要約) | 元出典 | 第2ソースURL | 一致/不一致/未発見 | 区分 | 指摘 |
|---|---|---|---|---|---|---|
| A1 | Showdown `MoveTarget` は15値 | sim/dex-moves.ts | (同ファイルを独立再取得) `raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/dex-moves.ts` L23-25 | **一致** | B1 | 引用は正確。ただし「1行で列挙」は誤り(L24-25の2行)。**同ファイルL5-22に15値の公式ドキュメントコメントがあり、元レポはこれを引いていない**(下の「設計で使ってよい」に転記) |
| A2 | Bulbapedia「Moves by range」の**サブカテゴリは15個**でShowdownの15値と1:1、「件数(15=15)が一致することを確認」 | Bulbapedia Category:Moves_by_range | https://bulbapedia.bulbagarden.net/wiki/Category:Moves_by_range(再取得) | **不一致** | **C** | ★**実測17個**。`Long-range moves` と `Moves with ranges that vary` が余分。「15=15で一致」は**成立しない**。1:1対応の根拠として使えない |
| A3 | master(919技)の target 13種の件数 | ローカル `master/moves.json` | node で独立再集計 | **一致(完全一致)** | B1 | 674/60/96/6/12/20/9/20/4/4/10/3/1、合計919。数値に誤りなし |
| A4 | ヤックン`/ch/`(497技)の target 13種の件数 | `reference/_authority_corpus_ch/moves_ch.json` | node で独立再集計 | **一致(完全一致)** | **A** | 353/58/6/22/15/2/6/16/7/2/5/4/1、合計497。Champions側も同じ13語彙 |
| B1 | 「相手1体(味方は選べない)」= `adjacentFoe`。実例=うつしえ・**さきどり(Snipe Shot系)**・ダイウォール以外のダイマックスわざ | 局所wiki + data/moves.ts | wiki再取得 / moves.ts 再集計 | 一致(ただし誤記1) | B | ★**「さきどり(Snipe Shot系)」は誤り**。さきどり=**Me First**(master slug `me-first`、Showdown `mefirst: adjacentFoe`)。**Snipe Shot=ねらいうち**で `target:"normal"` かつ `tracksTarget:true`(=リダイレクト無視)という**別機構**。混同すると設計を誤る。★実測 adjacentFoe=53=gmax*33 + max*18 + doodle + mefirst(maxguard=ダイウォールは含まれず、wiki記述と整合) |
| B2 | 「相手ランダム1体」6技= `randomNormal` | 局所wiki + data/moves.ts | 再集計 + `moves_ch.json` | **一致** | **A** | randomNormal は outrage/petaldance/ragingfury/struggle/thrash/uproar のちょうど6件。wiki列挙6件と完全一致。master・Champions とも「ランダム1体」6件 |
| B3 | 「相手全員」= `allAdjacentFoes`。Showdown 62 vs master 60 の**差2件は非標準/過去世代限定技の扱い差と推定** | 局所wiki + data/moves.ts | slug 突合(python) | 一致(推定は不一致) | B | ★**推定は誤り。差分を特定した**: Showdown 側だけにある2件は **`nihillight` と `polarflare`**(=masterに**未収録の新技**)。「非標準/過去世代限定技」ではない。逆向きの差(master側だけ)は**0件** |
| B4 | 「相手の場」4技= `foeSide` | 局所wiki + data/moves.ts | 再集計 + `moves_ch.json` | **一致** | **A** | spikes/stealthrock/stickyweb/toxicspikes の4件で wiki・master・Champions すべて4件一致 |
| B5 | 「自分以外全員」= `allAdjacent`。なみのりは第三世代のみ相手全体 | 局所wiki + data/moves.ts | slug 突合 | **一致** | B | allAdjacent 20件 ⇔ master「自分以外全体」20件が**技単位で完全1:1**(差分0)。wiki も「なみのり 3のみ」を相手全員に、「なみのり 4-」を自分以外全員に置いており整合 |
| B6 | wikiの「全体の場」と「自分含む全員」はShowdownでは両方 `all` | 局所wiki + data/moves.ts | slug 突合 | **一致** | B | `all`24件 = master「全体の場」20 + 「全体」4 で**技単位まで完全一致**(全体4=ほろびのうた/たがやす/フラワーガード/おちゃかい) |
| B7 | 「味方の場」= `allySide`。Showdown 14 vs master 12 の**差2件は非標準/過去技または未収録の可能性** | 局所wiki + data/moves.ts | slug 突合 | 一致(推定は不一致) | B | ★**推定は誤り。差分を特定した**: **`gearup`(アシストギア)と `magneticflux`(じばそうさ)**。両方 master に**収録済み**で、masterでは`味方全体`に分類されている=**未収録ではなく分類差**。日本語wikiもこの2件を「味方全員」側に置いている |
| B8 | 「味方1体」3件= `adjacentAlly`(Showdown実装は5件でコーチング/ドラゴンエールも含む) | 局所wiki + Bulbapedia + data/moves.ts | slug 突合 + `moves_ch.json` | **一致** | **A** | adjacentAlly=5(aromaticmist/coaching/dragoncheer/helpinghand/holdhands)。master は3(味方1体)+2(味方全体)に割れる。Champions効果文も**コーチング=`味方全体`「自分を除く味方全体…(ダブルバトル用)」**で二分を裏づけ。アロマミストの引用も原文どおり |
| B9 | 「自分か味方」(つぼをつく)= `adjacentAllyOrSelf` | 局所wiki + data/moves.ts | 再集計 + `moves_ch.json` | **一致** | **A** | acupressure 1件のみ。wiki/master/Champions すべて1件 |
| B10 | 「自分」(いかりのこな/このゆびとまれ/サイドチェンジ)= `self` | 局所wiki + data/moves.ts | 再集計 + `moves_ch.json` | **一致** | **A** | Champions いかりのこな効果文に「ダブルバトル用。」の明記を実確認 |
| B11 | 「味方全体」はShowdownでは `allyTeam`(控え含む)と `allies`(場の隣接味方のみ)の**2種**に分かれる | 局所wiki + data/moves.ts | slug 突合 + dex-moves.ts ドキュメント + pokemon.ts `getMoveTargets` | **部分不一致** | **C** | ★2点誤り。(a)master「味方全体」10件は**4つのShowdown値**に割れる: `allies`4(howl/junglehealing/lifedew/lunarblessing)+`allyTeam`2(aromatherapy/healbell)+`adjacentAlly`2(coaching/dragoncheer)+`allySide`2(gearup/magneticflux)。「2種」は**過少**。(b)`allies`は「隣接味方のみ」ではない。`getMoveTargets` は `targets = this.alliesAndSelf()`、dex-moves.ts の定義も「allies - The move affects **all active Pokémon on the user's team**」=**使用者自身を含む場の味方全員** |
| B12 | 「不定」= `scripted`。カウンター/ミラーコート/メタルバーストの3件が一致。Wikiの不定9件には**ほうふく**等も含まれ別target | data/moves.ts | 再集計 + `moves_ch.json` | **部分不一致** | **A**(本体) | 本体(scripted=comeuppance/counter/metalburst/mirrorcoat の4件、カウンターのChampions引用も原文どおり)は確認。★誤り2点: (a)**ほうふく(comeuppance)も `scripted`**。本文の「3件は一致/ほうふくは別target」は誤り(同じ行の備考では4件と書いており**自己矛盾**)。(b)「Wikiの『不定』9件」= 誤帰属。**wikiの「対象が変わる技の一覧」に『不定』というカテゴリは存在しない**。9件は`master/moves.json`の語彙 |
| B13 | ほろびのうたは `all` だが効果は使用時に場にいた個体のみ | 局所wiki + moves_ch | `moves_ch.json` を実読 | **一致** | **A** | Champions効果文の引用が一字一句原文どおり |
| C1 | ダブルは2体に指示・味方にも攻撃できる。ただし相手1体/相手全体対象の技は味方を攻撃できない | 局所wiki「シングルバトルとの違い」 | https://bulbapedia.bulbagarden.net/wiki/Double_Battle + sim/dex-moves.ts L5-22 | **一致** | B | 引用は原文どおり。備考の「`normal`は味方を選べる/`adjacentFoe`は選べない」も Showdown 公式コメント「normal - The move can hit **one adjacent Pokémon of your choice**」「adjacentFoe - The move can target **a foe**」および `validTargetLoc`(`normal`→`isAdjacent`のみ / `adjacentFoe`→`isAdjacent && isFoe`)で裏づけ |
| C2 | `getRandomTarget` の分岐(singles→foe.active[0] / activePerHalf>2→隣接敵から抽出 / それ以外→`side.randomFoe()`) | sim/battle.ts L2490- | 同ファイル再取得(L2490-2522) | **一致** | B1 | 引用は正確。★1点だけ精度不足: 「`normal`/`adjacentFoe`/`randomNormal`は singles なら foe.active[0]」→ 実際は `if (this.gameType === 'singles') return pokemon.side.foe.active[0];` が**target種別を問わず**(self系/adjacentAlly系を先に返した後の)全経路に効く。備考の「ダブルでは adjacentFoes() と randomFoe() が実質同集合」は `adjacentFoes(){ if (activePerHalf<=2) return this.side.foes(); }` で**正しい** |
| C3 | つぼをつくは味方を対象にできる | 局所wiki | data/moves.ts(`acupressure: adjacentAllyOrSelf`) | **一致** | B | 引用は原文どおり。★出典の**節名が誤り**: この文は「対象が変わる技の一覧」ではなく**「ダブルバトルにおける技」**節にある(D1/E1/E3/G1〜G5も同じ取り違え) |
| D1 | 味方単体対象の技で対象が消えた場合、第四世代までは敵のどちらか/第五世代以降は失敗 | 局所wiki | wiki本体を再取得して原文確認 | **一致(原文確認済)** | B1 | 引用は一字一句正しい。ただし第2の権威ソースは未発見(Bulbapedia Double Battle は「両方の相手が倒れると技が不発」までしか書いておらず、**味方対象時の世代差は未記載**)。節名の取り違えのみ |
| D2 | 現行実装はひんし味方をそのまま返し、`getMoveTargets` の `target.fainted` で不発。`adjacentAllyOrSelf` は `gen!==5` なら自分に振替 | sim/battle.ts / sim/pokemon.ts | 両ファイル再取得(battle.ts L2466-2478 / pokemon.ts L843-845) | **一致** | B | 引用コードは正確。wiki の「第五世代以降は失敗」と実装が整合するという結論も妥当 |
| D3 | 敵がひんしなら `getRandomTarget` で再抽選(コメント "If a targeted foe faints, the move is retargeted") | sim/pokemon.ts | 同ファイル再取得(L821-826) | **一致** | B1 | コード・コメントとも原文どおり |
| D4 | 野生2体では片方を倒さないとボールを投げられない(第四世代以降) | 局所wiki | https://bulbapedia.bulbagarden.net/wiki/Double_Battle | **一致** | B | Bulbapedia「it is impossible to use a Poké Ball to catch a Pokémon unless the other Pokémon is knocked out first」。ただしChampions対人戦には無関係(元レポの注記どおり) |
| E1 | あばれる系は選択時は自分対象、実行時に相手からランダム1体 | 局所wiki + Bulbapedia Thrash | wiki再取得 + https://bulbapedia.bulbagarden.net/wiki/Thrash_(move) | 一致(引用が不正確) | **A** | 事実は wiki/Bulbapedia/Champions(target=ランダム1体)で一致。★**Bulbapediaの引用が原文ではない**。元レポの「In double battles, Thrash targets the user when selected, but is used against one random foe when executed.」は本文に存在しない。実文は「**In battles with multiple opponents, the user selects itself as the target, but hits an adjacent opponent that is selected at random upon each use of the move.**」で、しかも**Generation II to IV 節**の記述。意味は保たれるが「かぎ括弧=原文」の規律に反する。また実文の "**upon each use**"(連続行動の毎ターン抽選)という情報が落ちている |
| E2 | `randomNormal` は `targetLoc` を無視して必ず `getRandomTarget` に渡る=乱数消費は実行時 | sim/battle.ts getTarget | 再取得(L2464) | **一致** | B1 | 条件式は原文どおり。結論も妥当 |
| E3 | わるあがきは相手からランダム1体 | 局所wiki | wiki再取得 + moves_ch + moves.ts | **一致** | **A** | 3ソース一致 |
| E4 | `side.randomFoe()` の定義を**発見できず「取得失敗」** | sim/battle.ts | sim/side.ts を再grep | **未発見は誤り(発見できた)** | B1 | ★**取得失敗ではない**。`sim/side.ts` **L369-373**: `randomFoe() { const actives = this.foes(); if (!actives.length) return null; return this.battle.sample(actives); }`。`foes()`(L397-403)は `this.foe.allies(all)` 経由で **`!!pokemon.hp`(生存)で絞り込み**、`Battle#sample`(battle.ts L355)は `this.prng.sample(items)` = **生存中の敵から一様乱択**。重み付けなし。宿題2は解消 |
| F1 | カウンター等は `scripted` で実行時に「直前に自分を殴った相手」に解決。Champions は「最後に受けた技のみ有効」 | data/moves.ts + moves_ch | 再集計 + `moves_ch.json` 実読 | **一致** | **A** | Champions引用は一字一句原文どおり。ほうふく(comeuppance)も Champions で「そのターンに最後に受けた技のダメージの1.5倍」=同系統 |
| F2 | のろいは使用者のタイプで target が `self`↔`normal`、味方を選ぶと `randomNormal` | data/moves.ts curse | 再取得(curse ブロック) | **一致** | B1 | `onModifyMove` コードは原文どおり。`target:"normal"` / `nonGhostTarget:"self"` も確認 |
| F3 | のろいのランダム化世代がwiki(第三・第八のみ)とShowdown(世代分岐なし)で食い違う疑い。**世代別modは未取得** | 局所wiki / data/moves.ts | **`data/mods/gen{3,4,5,6,7,8}/moves.ts` を新規取得** + https://bulbapedia.bulbagarden.net/wiki/Curse_(move) | **部分解決+新たな矛盾** | **C** | ★調べた結果: **gen8 mod** は `curse: { inherit: true, onModifyMove(…非ゴーストなら nonGhostTarget)…, **target: "randomNormal"** }` = **第八世代はゴーストのろい=ランダム確定**(wiki と一致)。**gen7 mod** は `target: "normal"`(=第四〜七世代は選択可、wiki と一致)。**gen3/gen4/gen5/gen6 mod に curse の target 上書きは無し**=gen7の"normal"を継承 → **第三世代のランダム化は Showdown では再現されておらず、Bulbapedia にも第三世代の記載なし**(=wiki単独主張)。さらに **Bulbapedia は「Generation VIII **onwards**, Ghost-type Pokémon are no longer able to choose targets for Curse in a Double Battle, and will always attempt to inflict the curse on a random opponent.」= 第九世代も含む**と読める一方、日本語wikiは「第三世代と第八世代**において**」= 第九世代は除外、Showdown gen9 も「味方を選んだ時だけ randomNormal」。★**第九世代(=Champions基準)の挙動が3ソースで食い違う。設計前に要決着** |
| F4 | 「不定」9件のうち、しぜんのちから/ねこのて/よこどりは「技内容が不定」型で対象は固定。**ねこのて→`copycat`** | data/moves.ts | master 再集計 + moves.ts 再取得 | **部分不一致** | **C** | 9件の内訳(カウンター/ゆびをふる/のろい/ミラーコート/しぜんのちから/ねこのて/よこどり/メタルバースト/ほうふく)は master と完全一致。★**マッピング誤り**: **ねこのて = `assist`**(master slug `assist`、`target:"self"`)。**`copycat` は オウムがえし**で別技。分類の結論(self固定)は偶然合っているが、技IDが違うので設計に持ち込むと誤配線になる。★また B12 と同じく**ほうふく を「対象ポケモンが不定」側に置いたのは正しいが、B12本文で `scripted` から除外している**のと矛盾 |
| G1 | 複数対象技は0.75倍(第四世代以降) | 局所wiki + Bulbapedia Damage | wiki再取得 + https://bulbapedia.bulbagarden.net/wiki/Damage + https://bulbapedia.bulbagarden.net/wiki/Double_Battle + Showdown `battle-actions.ts` | 本体**一致** / 備考**不一致** | B | 本体は3ソース一致(Bulbapedia Damage「0.75 in Double Battles if the used move has more than one target」/ Bulbapedia Double Battle「any move that can hit multiple Pokémon has its damage reduced by 25%」/ Showdown `getDamage` の `const spreadModifier = this.battle.gameType === 'freeforall' ? 0.5 : 0.75;`)。★**備考が重大な取り違え**: 「Bulbapediaが範囲補正の正確係数として3072/4096・2703/4096・2732/4096と記載」は**誤り**。(a)Bulbapedia Damage を再取得したが**その分数は載っていない**。(b)**2703/4096・2732/4096 は日本語wikiの『壁(リフレクター/ひかりのかべ)』のダブル補正率**で、同wiki の直前行「壁によるダメージ補正率が1/2から2/3に弱体化する。正確な補正率は、第四世代では2/3、第五世代では2703/4096、第六世代以降では2732/4096となる。」から来ている。(c)Showdown でも `[2732, 4096]` は **auroraveil / lightscreen / reflect の3技にしか出現せず**、範囲補正は **flat 0.75**。**範囲補正と壁補正を混ぜている** |
| G2 | 第三世代は0.5倍、味方を巻き込む技には適用されない | 局所wiki + Bulbapedia Damage | wiki再取得 + Bulbapedia Double Battle | **一致** | B | Bulbapedia Double Battle「In Generation III, … moves that can hit both foes (**but not moves that hit all Pokémon on the field, such as Earthquake**) have their damage reduced by 50%」で適用条件まで一致 |
| G3 | 1体しか対象にならなければ補正なし。2体対象なら片方が無効化されても補正あり | 局所wiki | Showdown `battle-actions.ts` L551 + `pokemon.ts` adjacency | **一致(実装で裏づけ)** | B | `trySpreadMoveHit` 冒頭 `if (targets.length > 1 && !move.smartTarget) move.spreadHit = true;` が**命中判定より前**に立つ=無効化されても補正は残る。`targets` は `adjacentFoes()`/`adjacentAllies()` 由来で、`Side#foes()` が `!!pokemon.hp` で絞る=**ひんしは対象に数えない**。★元レポが引いた Bulbapedia の「However, a Pokémon that has fainted is NOT a target.」は今回の再取得では**該当箇所を確認できず**(弱い引用) |
| G4 | 第四世代のじばく/だいばくはつのみ、対象2体でも範囲補正がかからない | 局所wiki | wiki再取得(原文確認)/ Showdown gen4 mod は未確認 | 一致(wiki原文のみ) | B1 | wiki原文は確認。第2ソース未発見。Showdown gen4 の該当実装は私も未確認 |
| G5 | 複数対象技のダメージ処理順: 第三=1P1→2P1→1P2→2P2 / 第四=すばやさ順 / 第五以降=味方→敵左→右 | 局所wiki | Bulbapedia Double Battle + Showdown `getMoveTargets` | **矛盾** | **C** | ★**Bulbapedia Double Battle と衝突**: 「**From Generation IV onward**, moves that target multiple Pokémon resolve **in order of the target's respective Speed stats**」= 第五世代以降も**すばやさ順**と読める。一方 Showdown は `getMoveTargets` が `allAdjacent` で `adjacentAllies()` → `adjacentFoes()` の**枠順**で配列を作り `trySpreadMoveHit` がその順に処理=**日本語wikiの第五世代以降(枠順)側**。**現行(第九/Champions)は枠順が有力だが、権威2ソースが割れている** |
| H1 | 単体選択技は `RedirectTarget` 優先度イベントで対象を上書きできる(溜め技/smartTargetは除外) | sim/pokemon.ts | 再取得(L827-836) | **一致** | B1 | コードは原文どおり |
| H2 | スクリューおびれ/すじがねいりは対象変更の影響を受けない | 局所wiki | data/abilities.ts + sim/battle.ts + **`abilities_ch.json`** | **一致** | **A** | 元レポは「abilities.ts側は未確認(取得失敗)」としていたが**確認できた**。`propellertail`(L3486-)/`stalwart`(L4503-)とも `onModifyMove(move){ move.tracksTarget = move.target !== 'scripted'; }`、`battle.ts getTarget` L2443 が `if (pokemon.hasAbility(['stalwart','propellertail'])) tracksTarget = true;` → `originalTarget` を返す。さらに **Champions確認可**: ヤックン`/ch/`特性「すじがねいり」「スクリューおびれ」=「特性『ひらいしん』『よびみず』や技『いかりのこな』『このゆびとまれ』『サイドチェンジ』『スポットライト』の攻撃対象を変更する効果の影響を受けずに攻撃できる。」→ **区分を「不明」から A に上げられる** |
| H3 | テレパシーは味方が使用した攻撃技を無効化する | 局所wiki | data/abilities.ts + `abilities_ch.json` | **一致** | **A** | Showdown `telepathy`(L4931-)`onTryHit(target, source, move){ if (target !== source && target.isAlly(source) && move.category !== 'Status') { … return null; } }` = **変化技は素通り**。**Champions確認可**: 「味方の技のダメージを受けない。」→ 区分を A に。備考の「対象決定後の無効化でtarget語彙に影響しない」も正しい |

---

## 矛盾・要注意

1. **A2 は事実誤り(件数)**。Bulbapedia「Moves by range」のサブカテゴリは **17個**(15ではない)。「15=15で一致」を根拠に Wiki分類↔Showdown target を 1:1 とみなす記述は**取り下げるべき**。実際、日本語wikiの分類と Showdown target は **1:1 ではない**(B6=2区分が`all`1値に統合、B11=master1区分が Showdown 4値に分裂)。
2. **G1備考の「範囲補正の正確係数 2703/4096・2732/4096」は壁(リフレクター/ひかりのかべ/オーロラベール)の補正率**。範囲補正は世代を通じて第三=0.5 / 第四以降=0.75(Showdownは flat 0.75)。**混ぜたまま設計に入れるとダメージ計算が壊れる。最優先の訂正項目**。
3. **F3: 第九世代(=Champions基準)のゴーストのろいの対象が3ソースで割れている**。日本語wiki=「第三世代と第八世代において」(第九は選択可) / Bulbapedia=「Generation VIII **onwards**」(第九もランダム) / Showdown gen9=「味方を選んだ時だけ randomNormal」。**Champions効果文(ヤックン`/ch/`のろい)には対象の記述が無く決着しない**。設計前に阿部さん判断 or 追加権威確認が必要。なお**第八世代=ランダム**は wiki+Bulbapedia+Showdown gen8 mod の3点一致で確定。
4. **G5: 複数対象技の処理順が日英wikiで矛盾**。日本語wiki「第五世代からは味方→敵から見て左→右」 vs Bulbapedia「From Generation IV onward … in order of Speed」。Showdown実装は枠順で日本語wiki側。**現行世代は枠順を採るのが妥当だが、確定扱いにしない**。
5. **技ID(英語名)の取り違えが2件**。「さきどり=Snipe Shot」(正: Me First / Snipe Shot=ねらいうち)、「ねこのて=copycat」(正: assist / copycat=オウムがえし)。**どちらも別の実在技に当たってしまう型の誤り**で、そのまま配線すると静かにバグる([[investigate-carefully-not-guess]] の型)。
6. **B12 と F4 が同一ファイル内で自己矛盾**(ほうふくを `scripted` から除外/包含)。正: **ほうふくは `scripted`(4件のうちの1つ)**。
7. **「不定」は日本語wikiのカテゴリではなく `master/moves.json` の語彙**。元レポは繰り返し「Wikiの『不定』」と書いているが、wiki「対象が変わる技の一覧」に該当カテゴリは存在しない。出典の付け替えが必要。
8. **出典の節名取り違え(6か所)**。C3/D1/E1/E3/G1〜G5 が引く文はすべて「**ダブルバトルにおける技**」節にあり、「対象が変わる技の一覧」節ではない。引用文自体は原文どおりなので事実に影響はないが、追跡可能性が落ちる。
9. **Bulbapedia Thrash の引用が原文ではない**(E1)。意味は保たれるが、かぎ括弧の中身が創作。加えて実文は Gen II–IV 節、"upon each use of the move"(連続行動の**毎回**抽選)という設計上重要な情報が欠落。
10. **元レポが「取得失敗/未確認」とした宿題のうち4件は、実際には取得できた**: 宿題2(`randomFoe` 定義)、宿題3(B3/B7の件数差の技名特定)、宿題6(`stalwart`/`propellertail` の abilities.ts 実装)、宿題1の一部(gen8/gen7 mod による curse の世代差)。**「取得失敗」と書く前の探索が浅い**。
11. **カバーされていない target 値が1つある**: Showdown `any`(24件: 空を飛ぶ/エアスラッシュ/ヒートスタンプ系ではなく acrobatics/aerialace/aeroblast/airslash/aurasphere/bounce/bravebird/chatter/darkpulse/dragonascent/dragonpulse/drillpeck/fly/flyingpress/gust/healpulse/hurricane/oblivionwing/peck/pluck/skyattack/skydrop/waterpulse/wingattack)。dex-moves.ts の定義は「any - The move can hit **any other active Pokémon, not just those adjacent**」。**ダブルでは `normal` と挙動が同じになるためT2では触れなくても実害は薄いが、対応表に穴がある**ことは明記すべき。
12. **wikiにあるのにT2が拾っていないダブル固有の対象仕様**(いずれも Champions効果文で裏が取れる):
    - **ドラゴンアロー**: wiki「有効な相手が2体いる場合は2体を1回ずつ攻撃する」「2体を攻撃するときもダメージが落ちない」。Champions「相手が2匹いる場合は、それぞれに1回ずつ攻撃する。ただし…ダメージを与えられない時は片方に2回攻撃する」。Showdown= `dragondarts: { smartTarget: true, target:"normal" }` + `trySpreadMoveHit` の `&& !move.smartTarget` で**範囲補正の対象外**。→ **`smartTarget` は独立の対象機構としてT3/設計に必要**。
    - **かふんだんご**: wiki「味方を対象にしたときはHPを半分回復する効果になる」。Champions「味方に使った場合、ダメージではなく味方のHPを最大HPの1/2回復する」。`target:"normal"`(味方選択可)の実用例。
    - **フリーフォール**: wiki「味方を対象にしたときは失敗する」。
    - **ひらいしん/よびみず**: Champions「ダブルバトルの時、自分以外の全てのポケモンの(でんき/みず)タイプの**単体攻撃技**の攻撃対象が自分になる。(攻撃対象が複数の技の場合はそのまま)」。H1のRedirectTargetの本体だが、T2はH2の引用の中でしか触れていない。Showdown の `stormdrain/lightningrod` の `onAnyRedirectTarget` は `['randomNormal','adjacentFoe'].includes(move.target) ? 'normal' : move.target` と読み替えて `validTarget` を見る=**randomNormal/adjacentFoe もリダイレクト対象になる**。
    - **はじけるほのお**: wiki「ダメージを受けたポケモンと同じチームの別のポケモンも、HPが最大HPの1/16だけ減少する」。
13. **Championsに存在しない技を実例に使っている**(B1)。**うつしえ・さきどり はどちらも Champions 497技に未収録**(ダイマックス技も同様)。つまり **Champions では `adjacentFoe` に相当する技が1つも無い**。設計上は「Champions版に adjacentFoe 区分は不要(ただし器としては残す)」と結論できる — 元レポはここまで踏み込んでいない。
14. **master の 13語彙は `adjacentFoe` を表現できない**。うつしえ/さきどりとも master の target は `1体選択`(=`normal` と同居)。B1の対応表は Wiki↔Showdown としては正しいが、**master側には受け皿が無い**ことが本文から読み取れない。ダブル実装時に「味方を選べる/選べない」を master から引けない=**器を広げる必要がある**(SSOT側の宿題)。

---

## 設計で使ってよい確定事項(A / B のみ)

**A(Champions で確認できた)**
- Champions の target 語彙は master と同じ13分類で、件数は 1体選択353 / 自分58 / 相手全体22 / 自分以外全体16 / 全体の場15 / 味方の場7 / 味方全体6 / ランダム1体6 / 不定5 / 相手の場4 / 全体2 / 味方1体2 / 自分か味方1(計497)。
- 相手ランダム1体は6技(あばれる/げきりん/さわぐ/だいふんげき/はなびらのまい/わるあがき)で確定。選択時ではなく**実行時に抽選**。
- 相手の場は4技(まきびし/どくびし/ステルスロック/ねばねばネット)で確定。
- 味方1体(`adjacentAlly`)= アロマミスト/てだすけ/てをつなぐ。**コーチング/ドラゴンエールは Champions では「味方全体」**(「自分を除く味方全体…(ダブルバトル用)」)。
- 自分か味方(`adjacentAllyOrSelf`)= つぼをつく の1技のみ。
- 自分(`self`)にはダブル専用の いかりのこな/このゆびとまれ/サイドチェンジ が含まれ、いかりのこな効果文に「ダブルバトル用。」の明記あり。
- 「不定」(`scripted`)= カウンター/ミラーコート/メタルバースト/**ほうふく**。Champions効果文「**『ダブルバトル』の時は最後に受けた技のみ有効になる**」=直近1回で上書き。
- ほろびのうたは場全体に効くが、**技使用時に場にいた個体のみ**が対象(交代で解除)。
- すじがねいり/スクリューおびれ=「ひらいしん・よびみず・いかりのこな・このゆびとまれ・サイドチェンジ・スポットライト の対象変更の影響を受けない」。
- テレパシー=「味方の技のダメージを受けない」(**変化技は通る**: Showdown `move.category !== 'Status'`)。
- ひらいしん/よびみず=「ダブルの時、自分以外の全ポケモンの当該タイプの**単体**攻撃技の対象が自分になる。複数対象技はそのまま」。

**B(一般世代の権威2ソース一致)**
- ダブルでは味方も攻撃対象に選べる。ただし「相手1体専用(`adjacentFoe`)」「相手全体(`allAdjacentFoes`)」の技は味方を選べない。
- `allAdjacent`(自分以外全員)は master「自分以外全体」20技と**技単位で完全一致**(じしん/じばく/だいばくはつ/なみのり4-/ばくおんぱ 等)。
- `foeSide` 4技 / `all` 24技(=master「全体の場」20+「全体」4)も**技単位で完全一致**。
- 範囲補正: **第三世代=0.5倍(相手2体を撃つ技のみ。じしん等の味方巻き込み技には不適用)/第四世代以降=0.75倍**。Showdown も flat 0.75(`spreadModifier`)。
- 実際の対象が1体になった場合は範囲補正なし。**2体が対象になれば、片方が無効化されても補正はかかる**(実装上 `spreadHit` は命中判定より前に確定)。
- 対象の味方がひんしで場に誰もいない場合、**第五世代以降はその技が失敗**(第四世代までは敵のどちらかに向く)。
- 選んだ**敵**が実行前にひんしなら、他の生存中の敵へ自動で振り替わる(実装 `getRandomTarget`)。振替は**生存中の敵からの一様乱択**(`Side#randomFoe` → `foes()` が `!!pokemon.hp` で絞る → `PRNG#sample`)。
- 単体選択技は `RedirectTarget` イベントで対象を強制変更できる。**溜め技(charge、パワフルハーブ等の例外あり)と `smartTarget` 技は除外**。

**使ってはいけない/保留**
- A2の「Bulbapedia 15カテゴリ=Showdown 15値の1:1」、G1備考の分数(2703/2732は壁の値)、F3の第九世代のろい、G5の処理順、F4の「ねこのて=copycat」、B1の「さきどり=Snipe Shot」、B11の「allies=隣接味方のみ/2種のみ」、B3・B7の差分理由の推定。
