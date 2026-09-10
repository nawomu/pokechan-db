# T6_特性と持ち物.md 裏取り(反証)レポート

- **対象**: `/Users/masamichi/Documents/ポケモンDB/review/_doubles_research_2026-09-07/T6_特性と持ち物.md`
- **裏取り日**: 2026-09-07
- **検査数**: 85(番号付き主張 #1〜#70 = 70件 + 「3. Showdown実装の要点」表 15行)。サンプルではなく全数。
- **元ファイルは編集していない。** 修正案はすべてこの verify 側に書いた。

## 区分の定義(本レポートでの運用)

| 区分 | 意味 |
|---|---|
| **A** | Champions で確認できた(ポケモンWikiの `{{game|Champs}}` 説明文節、または `master/*.json` の `champions:true` で搭載が裏付く主張本体) |
| **B** | 一般世代の権威が2ソース以上一致(ポケモンWiki + Bulbapedia、またはポケモンWiki + Showdown実装) |
| **B1** | ポケモンWiki 1ソースのみ(反証は出なかったが二重チェック未成立) |
| **C** | 不明・矛盾・取得失敗 |

## 使った第2ソース

- ポケモンWiki 生wikitext(MediaWiki API): `https://wiki.pokemonwiki.com/w/api.php?action=parse&page=<題名>&prop=wikitext&format=json`
  - ★確認: `https://wiki.xn--rckteqa2e.com/wiki/いかく` は **301 で `https://wiki.pokemonwiki.com/wiki/いかく` にリダイレクト**する。T6が使っている `wiki.pokemonwiki.com` は正統な現行ドメインで、問題なし。
- Bulbapedia: `https://bulbapedia.bulbagarden.net/wiki/Intimidate_(Ability)` / `Download_(Ability)` / `Imposter_(Ability)` / `Double_Battle`
- Pokémon Showdown(master): `data/abilities.ts` `data/items.ts` `data/moves.ts` `sim/battle.ts` `sim/battle-actions.ts` `sim/pokemon.ts` `sim/side.ts`
- ローカル SSOT: `master/abilities.json` / `master/items.json` / `master/moves.json`

### ★Champions欄そのものの独立検証(重要・全数一致)

T6の「Champions確認」列は `master/*.json` の `champions` フラグを根拠にしている(自己参照になりうる)。そこで**ポケモンWiki側の `{{game|Champs}}` 説明文節の有無**という完全に独立した指標で 46件を突き合わせた結果、**46/46 完全一致**した。

- Champs節あり(=Champions搭載): いかく・せいしんりょく・ミラーアーマー・まけんき・かちき・フレンドガード・テレパシー・プラス・いやしのこころ・おもてなし・きみょうなくすり・そうだいしょう・レシーバー・きょうせい・スイートベール・アロマベール・フラワーベール・ひらいしん・すじがねいり・あとだし・どくげしょう・かわりもの・トレース・アナライズ・たべのこし・いかりのこな
- Champs節なし(=非搭載): ばんけん・きょうえん・わたげ・かがくのちから・よびみず・スクリューおびれ・はがねのせいしん・パステルベール・フラワーギフト・しれいとう・バッテリー・パワースポット・しょうりのほし・ダウンロード・にげあし・じゃくてんほけん・だっしゅつパック・レッドカード・ものまねハーブ・ぼうじんゴーグル

→ **T6のChampions列は信頼してよい**(ただし下記 #6 / #13 / #18 / #39 の書き方に難あり)。

---

## 1. 特性(#1〜#57)

| # | 主張(要約) | 元出典 | 第2ソースURL | 一致/不一致/未発見 | 区分 | 指摘 |
|---|---|---|---|---|---|---|
| 1 | いかくはダブルで相手全体 | wiki/いかく | bulbapedia Intimidate_(Ability) / SD `data/abilities.ts` `intimidate.onStart`→`adjacentFoes()` | 一致 | **A** | 引用が原文でない。原文=「ダブルバトル・バトルロイヤル・マックスレイドバトル・テラレイドバトルでは相手全体に効果がある。」/ **世代欄「第七〜九世代」は誤り寄り**。効果自体は第三世代から。列挙されたバトル形式が世代で増えただけ |
| 2 | トリプル中央3体・端2体 | wiki/いかく | bulbapedia「Intimidate does not affect non-adjacent Pokémon」 | 一致 | **B** | ★**世代の取り違え**。「第六世代〜(トリプル導入以降)」は誤り。ポケモンWiki『トリプルバトル』冒頭=「[[第五世代]]と[[第六世代]]で採用された。」=第五世代導入・**第七世代以降は非搭載**。Championsにもトリプルは無い |
| 3 | 第四=素早さ順/第五以降=左から | wiki/いかく | SD `sim/side.ts` `foes()`→`activeTeam()`のスロット順 | 一致(前半)/**未発見**(後半) | **B1** | 原文一致は確認(「第四世代では素早さが高い順に…第五世代以降は素早さに関係なく相手から見て左側のポケモンから順に」)。ただし備考の「Showdownは`adjacentFoes()`の配列順=左から」は**未検証の推測**。`Side.foes()`はスロット配列順を返すだけで、それが「相手から見て左」に対応する保証はコード上に無い。設計時は自前で左右順を定義すること |
| 4 | いかく解決手順 | wiki/いかく | (単独) | 一致(内容)/**不一致(件数と内訳)** | **B1** | ★2点。(a)「手順11項目」は誤り。原文はトップレベル**6項目**(1.左側 2.右側 3.しろいハーブ 4.びんじょう 5.ものまねハーブ 6.だっしゅつパック)+1の下に**10サブ項目**。(b) claim欄が「まもる/しろいきり/…」と**まもるを判定列に含めている**が、Wikiは「まもる状態のポケモンに対しても効果がある」=**まもるはいかくを防がない**。誤読を生む |
| 5 | きもったま/せいしんりょく/どんかん/マイペース(第八世代以降) | wiki/いかく | bulbapedia「Intimidate no longer affects Pokémon with Oblivious, Own Tempo, Inner Focus, or Scrappy」(Gen VIII〜) / SD `innerfocus.onTryBoost` | 一致 | **A** | 原文verbatim確認。Champions搭載は せいしんりょく のみ検証済(Champs節あり)。きもったま/どんかん/マイペースの搭載可否は未検証 |
| 6 | ばんけんはいかくで攻撃+1 | wiki/いかく | bulbapedia「Intimidate raises the Attack stat of a Pokémon with Guard Dog by one stage」/ SD `guarddog.onTryBoost` | 一致 | **B** | ★**Champions欄「不明」は解消できる**。`master/abilities.json` ばんけん=`champions:false`(0体)かつポケモンWiki『ばんけん』に `{{game|Champs}}` 節なし → **N** と確定してよい |
| 7 | しろいきり/かいりきバサミ/クリアボディ/しろいけむり/メタルプロテクト/フラワーベールで無効 | wiki/いかく | (単独) | 一致 | **B1** | 原文verbatim確認。Champions欄「Y」は一括で内訳が無い。フラワーベールのみ Y(2体) を確認 |
| 8 | 競合時は補正抜き素早さ実数値が高い方の特性優先 | wiki/いかく | (単独) | 一致 | **B1** | 原文「いかくを防げる特性を持つポケモンが、味方のフラワーベールの効果対象である場合、補正抜きの素早さ実数値が高いポケモンが持つ特性が優先して発動する。」verbatim確認 |
| 9 | ミラーアーマーで跳ね返し・いかく側のみ-1 | wiki/いかく | SD `data/abilities.ts` `mirrorarmor.onTryBoost`(2657行) | 一致 | **A** | ★**備考のフック名が誤り**。「`onFoeRedirect`系ではなく`onModifyBoost`/`onAnyModifyBoost`系」→ 実装は **`onTryBoost`**。`onModifyBoost` は別物(ランク補正の読み値を変える方) |
| 10 | 複数ミラーアーマーの跳ね返り優先順 | ローカル`_ability_facts.json` | wiki/ミラーアーマー 生wikitext 53行(live再取得) | 一致 | **B1** | 原文verbatim確認。ローカル引用の出所は本物。ただしポケモンWiki単独 |
| 11 | あまのじゃく/たんじゅん/まけんき/かちきは発動 | wiki/いかく | SD `defiant`/`competitive` `onAfterEachBoost` | 一致 | **B** | ★**引用中の「たんじゃん」は誤記**(原文=たんじゅん)。データに転記されると名寄せを壊す |
| 12 | 下がった能力の数だけまけんき/かちきが逐一発動 | ローカル`_ability_facts.json` | SD `sim/battle.ts` 2076行 `runEvent('AfterEachBoost',…)` が**per-statループ内**にある | 一致 | **B** | 引用の帰属が雑。「くすぐる/おきみやげ…下がった能力の数だけ」は**まけんき**節の文、「ベノムトラップで3回」は**かちき**節の文。T6は「かちきはくすぐる/おきみやげで2回」と書くが、その形の原文引用は無い。★また**ベノムトラップは `master/moves.json` で `champions:false`** =Championsでは起こらない例 |
| 13 | わたげ複数回でまけんきが逐一発動 | ローカル`_ability_facts.json` | SD `cottondown.onDamagingHit`→`getAllActive()` | 一致 | **B** | ★**Champions欄「Y」が誤解を招く**。わたげ=`champions:false`(0体・Champs節なし)。Championsではこの局面は発生しない。「まけんきはY / わたげはN」と分けて書くべき |
| 14 | フレンドガードは味方の被ダメ3/4 | wiki(ローカル) | wiki/フレンドガード live 4行・56行・59行 / SD `friendguard.onAnyModifyDamage` | 一致 | **A** | Champs説明文=「味方が受けるダメージを3/4にする。」/ ★**取りこぼし**: Wikiには「複数体で累積(2体=9/16≒56.25%、3体=27/64)」の記述があるがT6に無い。ダブルではフレンドガード2体は成立しないが記録価値あり |
| 15 | SD実装: friendguard | SD data/abilities.ts | 実コード1533-1539行 | 一致 | **B** | コード完全一致 |
| 16 | テレパシーは味方の攻撃技を無効化・シングルでは無意味 | wiki/テレパシー | SD `telepathy.onTryHit`(`target.isAlly(source) && move.category !== 'Status'`) | 一致 | **A** | ★**引用「味方から 受ける 攻撃を 受けない」は原文に存在しない**。原文は「味方の 攻撃を 読み取って 受けない。」(第五世代説明文)/「味方から受ける攻撃技を無効化する。」(効果節)。チェレン文「シングルバトルでは 意味がないけど」は verbatim 確認済。Champs説明文=「味方からの攻撃を回避する。」 |
| 17 | 変化技は不可・1体選択攻撃技は可・かたやぶりには不発 | wiki/テレパシー | SD `move.category !== 'Status'` | 一致 | **A** | 原文verbatim確認(『特性の仕様』節) |
| 18 | はじけるほのおの火花は防げない | wiki/テレパシー | (単独) | 一致 | **B1** | ★**はじけるほのおは `champions:false`**。Champions欄「Y」はテレパシーのYであって、この局面はChampionsでは起こらない |
| 19 | プラス/マイナスは味方限定・第三世代のみ相手側でも発動 | wiki(ローカル) | wiki/プラス live 66-67行 / SD `plus.onModifySpA`→`allies()` | 一致 | **A** | ★**世代の記述が不正確**。原文66-67行=「第三世代のみ、マイナスのポケモンが相手の場にいるときも発動する。そのためシングルバトルでも発動する。」「**第四世代では**、マイナスのポケモンが相手の場にいるだけでは発動しない。よってシングルバトルで発動することはなくなった。」→ **シングル不発になったのは第四世代から**。第五世代の変更点は「プラス/マイナスどちらの味方でも可」になったこと |
| 20 | SD実装: plus/minus | SD data/abilities.ts | 実コード3317-3325行 / `sim/pokemon.ts` 720行 `allies()` は自分を除外 | 一致 | **B** | 「シングルでは`allies()`が空配列」も `allies(){ return this.side.allies().filter(ally => ally !== this); }` で裏取り済 |
| 21 | 複数プラス/マイナスでも累積せず1.5倍 | wiki(ローカル) | SD: 最初の該当味方で `return this.chainModify(1.5)` = 重複しない | 一致 | **A** | |
| 22 | いやしのこころは隣接味方の状態異常を30%で治す(ターン終了時) | wiki(ローカル) | SD `healer` = `onResidual` + `adjacentAllies()` + `randomChance(3, 10)` | 一致 | **A** | 3ソース相当で確度高い |
| 23 | おもてなしは場に出たとき味方HPを1/4回復 | wiki(ローカル) | SD `hospitality.onStart` → `adjacentAllies()` に `heal(ally.baseMaxhp / 4)` | 一致 | **A** | Showdownは**隣接味方限定**。「みがわり/姿を隠している味方も対象」はポケモンWiki単独(B1相当の細目) |
| 24 | きみょうなくすりは味方のランクを0にリセット・無効化系を無視 | wiki(ローカル) | (単独) | 一致 | **A**(搭載)/細目**B1** | 引用verbatim確認。無効化系無視の細目はポケモンWiki単独 |
| 25 | そうだいしょうの補正率は発動時点で確定 | wiki(ローカル) | SD `supremeoverlord.onStart` が `side.totalFainted` を `effectState.fallen` に固定 | 一致 | **A** | ★**取りこぼし**: Showdownは `Math.min(totalFainted, 5)` =**上限5体**(倍率最大6144/4096)。T6に上限の記載なし |
| 26 | かがくのちから/レシーバーはひんし味方の特性を引き継ぐ | wiki(ローカル)+wiki/レシーバー | wiki/レシーバー live 6行・26行 / SD `powerofalchemy.onAllyFaint`(`flags['noreceiver']` 除外) | 一致 | **A**(レシーバー) | 「シングルバトルでは意味がない、ダブルバトル専用の特性」verbatim確認。かがくのちからは `champions:false` =B扱い |
| 27 | きょうえんはランク+急所アップをコピー | wiki(ローカル) | wiki/きょうえん live 4行・35行 / SD `costar.onStart` = `ally.boosts` コピー + `focusenergy/laserfocus/dragoncheer/gmaxchistrike` 移送 | 一致 | **B** | Champions N は正しい(Champs節なし・0体) |
| 28 | きょうせいは味方の道具消費で自分の道具を渡す | wiki(ローカル) | SD `symbiosis.onAllyAfterUseItem` | 一致 | **A**(基本効果)/除外細目**B1** | メガストーン/専用アイテム/Zクリスタルの除外リストはポケモンWiki単独 |
| 29 | 第七世代以降の同時消費と発動順 | wiki(ローカル) | (単独) | 一致 | **B1** | 原文verbatim確認 |
| 30 | スイートベールは味方のねむり/ねむけを防ぐ・治さない | wiki(ローカル) | SD `sweetveil` = `onAllySetStatus`(slp) + `onAllyTryAddVolatile`(yawn)。治療処理なし | 一致 | **A** | |
| 31 | アロマベールは6状態を防ぐ | wiki(ローカル) | SD `aromaveil.onAllyTryAddVolatile` = attract/disable/encore/healblock/taunt/torment | 一致 | **A** | 日本語6種と1対1対応することを確認 |
| 32 | フラワーベールはくさタイプ味方の状態異常/ランク低下を防ぐ | wiki(ローカル) | SD `flowerveil.onAllyTryBoost`(`!target.hasType('Grass')` で除外・自分起因は除外)+ `onAllySetStatus` | 一致 | **A** | |
| 33 | バッテリーはみらいよち/はめつのねがいにも効きシングルでも発動 | wiki(ローカル) | wiki/バッテリー live 25行 verbatim / SD: 該当の遅延技例外の実装は**見当たらず** | 一致(Wiki)/**未発見**(SD) | **B1** | Showdown `battery.onAllyBasePower` は `attacker !== effectState.target` のみ。遅延技のシングル例外は実装で確認できない。**Showdownを差分オラクルにすると食い違う可能性** |
| 34 | バッテリー2体で6923/4096、3体で9000/4096 | wiki(ローカル) | SD `chainModify([5325, 4096])` の重ねがけ=1.3²≒1.69 と整合 | 一致 | **B** | Champions N ✓ |
| 35 | パワースポットは物理/特殊問わず1.3倍 | wiki(ローカル) | SD `powerspot.onAllyBasePower`(カテゴリ判定なし) | 一致 | **B** | Champions N ✓ |
| 36 | ひらいしん/よびみずの引き寄せ・第五世代以降は無効化+とくこう+1 | ローカル ダブルバトル.json | SD `lightningrod` = `onTryHit`(無効化+boost)と `onAnyRedirectTarget`(引き寄せ)の**二本立て** | 一致 | **A** | 引用「第五世代以降はさらにダメージを無効化し、とくこうが1段階上がる」はローカル corpus の該当節に verbatim 存在を確認。★**よびみずは `champions:false`**。「ひらいしんY(5)」だけでなく「よびみずN」も明記すべき |
| 37 | 複数持ちは補正抜き素早さ最速が優先 | wiki(ローカル) | (単独) | 一致 | **B1** | |
| 38 | アロマミストは引き寄せ不可・特性で無効化不可 | wiki(ローカル) | (単独) | 一致 | **B1** | アロマミスト自体は `champions:true` |
| 39 | すじがねいり/スクリューおびれは対象変更されない | wiki(ローカル) | SD `stalwart`/`propellertail` = ともに `move.tracksTarget = …`。引き寄せ(`onAnyRedirectTarget`)だけを無効化し、直撃時の `onTryHit` 無効化は残る | 一致 | **B** | ★**Champions欄「Y(2体)」は すじがねいり のみ**。スクリューおびれ=`champions:false`(0体・Champs節なし)。2特性を1行にまとめたためChampions可否が潰れている。分割推奨 |
| 40 | しょうりのほしは味方全員の命中1.1倍・一撃必殺には無効 | wiki(ローカル) | wiki/しょうりのほし live 53行「正確な補正率は4506/4096倍」56行「一撃必殺技の命中率は上昇しない」/ SD `victorystar` = `chainModify([4506, 4096])` | 一致 | **B** | 数値まで完全一致。Champions N ✓ |
| 41 | はがねのせいしんは味方のはがね技1.5倍 | wiki(ローカル) | SD `steelyspirit.onAllyBasePower`(type==='Steel' → 1.5) | 一致 | **B** | Champions N ✓ |
| 42 | パステルベールは味方のどくを予防+能動治療 | wiki(ローカル) | SD `pastelveil.onStart` が `alliesAndSelf()` を回して `cureStatus()` | 一致 | **B** | Champions N ✓ |
| 43 | フラワーギフト・ノーてんき/エアロックで不発 | wiki(ローカル) | SD `flowergift.onWeatherChange` が `pokemon.effectiveWeather()` を見る(ノーてんき/エアロックはここで打ち消される) | 一致 | **B** | 「ばんのうがさを持っていても発動しない」はポケモンWiki単独 |
| 44 | わたげは自分以外全員のすばやさ-1・無効化時は不発 | wiki(ローカル) | SD `cottondown.onDamagingHit` が `this.getAllActive()` から自分を除いた全員に `boost({spe:-1})` | 一致 | **B** | Champions N ✓ |
| 45 | わたげはミラーアーマーで跳ね返る | wiki(ローカル) | (単独) | 一致 | **B1** | |
| 46 | ダウンロード(ダブルの比較対象=T6は「取得失敗」) | wiki(ローカル) | ★**解決**: wiki/ダウンロード live 42-43行「ダブルバトルなどで相手の場に複数のポケモンがいる場合、**相手全員の防御と特防をそれぞれ足し上げた値を比較する**。」+ bulbapedia「adding the stats of all opposing Pokémon」+ SD `download.onStart` の `totaldef`/`totalspd` 合算 | 一致(3ソース) | **B** | ★**T6の「取れなかった点1」は解決済み**。合計値で比較(平均でも片方選択でもランダムでもない)。トリプルは対角の相手も合計に含む(同43行)。Champions N |
| 47 | アナライズは3体以上いる場では「場で最後」でなければ不発 | wiki(ローカル) | SD `analytic.onBasePower` が `this.getAllActive()` を回して**誰か1体でも未行動なら不発** | 一致 | **A** | 実装が主張と完全に同型 |
| 48 | あとだしはトリックルーム下でも後攻 | wiki(ローカル) | SD `stall` = `onFractionalPriority: -0.1` のみ(トリックルームの分岐なし=常に後攻側で整合) | 一致 | **A** | ダブル固有の記述が無いのはT6の記載どおり |
| 49 | にげあしはダブルでは味方のどちらかが持っていれば逃げられる | wiki(ローカル) | wiki/にげあし live 134行 verbatim / SD `runaway` は**実装なし**(flagsのみ=Showdownに逃走が無い) | 一致(Wiki)/**未発見**(SD) | **B1** | ★設計注意: にげあし=`champions:false`、かつChampionsは対戦専用で「にげる」自体が存在しない可能性が高い。**ダブル設計では使わない** |
| 50 | どくげしょうは味方の物理技で発動しても敵の場にどくびし | wiki(ローカル) | SD `toxicdebris.onDamagingHit`: `const side = source.isAlly(target) ? source.side.foe : source.side;` と `toxicSpikes.layers < 2` | 一致 | **A** | ★実装と主張が逐語レベルで一致。2段階目の条件も一致 |
| 51 | かわりもの(ダブルでの対象=T6は「取得失敗」) | wiki(ローカル) | ★**解決**: wiki/かわりもの live 75-77行「ダブルバトル/トリプルバトル/バトルロイヤルでは**自分の正面にいるポケモン**に変身する。」「正面のポケモンに対してかわりものを発動できなかった場合、**他に変身できる相手がいたとしてもかわりものは発動しない**。」+ bulbapedia「the opponent in the position directly opposite it」+ SD `imposter.onSwitchIn` = `foe.active[length - 1 - pokemon.position]` | 一致(3ソース) | **A** | ★**T6の「取れなかった点2」は解決済み**。ランダムでも選択でもなく**正面固定**。正面が不可なら不発 |
| 52 | トレース複数時はランダム・可否混在なら可の方 | wiki/トレース | wiki/トレース live 202-203行 verbatim | 一致 | **A** | 「コピーできる特性とコピーできない特性がどちらもいる場合、必ずコピーできる特性の方をトレースする。」も確認 |
| 53 | 保留→同時2体繰り出しは素早さ高い方(TR下は低い方) | wiki/トレース | live 206行 verbatim(単独) | 一致 | **B1** | 細則はポケモンWiki単独 |
| 54 | トリプルの対角はトレース対象外 | wiki/トレース | live 204行 verbatim(単独) | 一致 | **B1** | ★**世代の取り違え**(#2と同型)。「第六世代〜(トリプル導入以降)」は誤り。トリプルは**第五世代導入・第五/第六世代のみ** |
| 55 | かがくへんかガス退場時、交代先が出る前に隣の特性をコピーできる | wiki/トレース | live 198行 verbatim(単独) | 一致 | **B1** | ダブル明記あり |
| 56 | ダブル記事が挙げるダブル特有特性22項目 | ローカル ダブルバトル.json | ローカル corpus『ダブルバトルにおけるとくせい』節を全数照合 | 一致 | **A** | 列挙は**完全一致**(順序・語も同じ)。★備考「本テーブルの#1-45で個別に深掘り済み」は**不正確**=**しれいとう** に個別行が無い(しれいとうは `champions:false`) |
| 57 | せいしんりょくは第八世代からいかく無効化 | wiki/せいしんりょく | live 4-5行「ひるみ状態にならない。」「特性いかくを無効化する。([[第八世代]]以降)」+ Champs説明文「相手の攻撃にひるまず いかくも効かない。」 | 一致 | **A** | ★Champs説明文にいかく無効化まで明記されている=**Championsで直接確認できる数少ない行**。設計で強く使える |

## 2. 持ち物(#58〜#70)

| # | 主張(要約) | 元出典 | 第2ソースURL | 一致/不一致/未発見 | 区分 | 指摘 |
|---|---|---|---|---|---|---|
| 58 | ぼうじんゴーグルは粉技無効・いかりのこなの注目の的を無視(第六世代以降)・判定は行動開始時 | wiki/ぼうじんゴーグル, wiki/いかりのこな | wiki/いかりのこな live 156-161行 verbatim / SD `safetygoggles.onImmunity('powder')` + `ragepowder` の `source.runStatusImmunity('powder')` | 一致 | **B1**→実質**B** | 「ポケモンの行動開始時に判定」も原文159-161行で確認。★設計注意: **ぼうじんゴーグルは `champions:false`**。Championsで いかりのこな を無視できるのは **くさタイプ or 特性ぼうじん(`champions:true`・3体)** のみ |
| 59 | いかりのこなの優先度/対象/Champions説明文 | wiki/いかりのこな | live 33-34行 Champs節「相手の技を全て自分が受ける。相手を選ぶ技にしか効果はない。[優先度+2]」verbatim / `master/moves.json` | 一致 | **A** | ★**T6の「取れなかった点4」は解決済み**。`master/moves.json` 突合の結果 `target=自分` / `priority=2` / `flags.powder=true` / `flags.double_battle_oriented=true` / `champions=true` で**Champions説明文と完全一致**。「シングルでは使っても意味が無い」もローカル ダブルバトル.json に verbatim 存在を確認 |
| 60 | だっしゅつパックは同時低下時、素早さ最速の1体のみ発動 | wiki/だっしゅつパック | live 45行 verbatim(単独) | 一致 | **B1** | 「スピードスワップ・ランク補正・トリックルームを除外した実数値」も原文確認。★Showdownの `ejectpack` にはこの1体限定ロジックが見当たらない=**Showdownを差分オラクルにすると食い違う可能性**(要検証) |
| 61 | レッドカード→だっしゅつパックの順 | wiki/だっしゅつパック | live 49行 verbatim(単独) | 一致 | **B1** | |
| 62 | 両者2体同時交代時のいかく処理順 | wiki/だっしゅつパック | live 54行 verbatim(単独) | 一致 | **B1** | |
| 63 | ものまねハーブは行動終了後に合計をコピー | wiki/ものまねハーブ | live 33行 verbatim / SD `mirrorherb.onFoeAfterBoost` が `effectState.boosts` に**加算**して後で消費 | 一致 | **B1**→実質**B** | |
| 64 | 複数ものまねハーブは素早さ順に**全員**発動 | wiki/ものまねハーブ | live 41行 verbatim(単独) | 一致 | **B1** | ★T6の「取れなかった点6」で指摘済のとおり、だっしゅつパック/レッドカードとは非対称。**丸めない**という注意は妥当 |
| 65 | ものまねハーブの発動判定順 | wiki/ものまねハーブ | live 39-40行 verbatim(単独) | 一致 | **B1** | #4のいかく手順(しろいハーブ→びんじょう→ものまねハーブ→だっしゅつパック)と整合することも確認 |
| 66 | レッドカードは全体技同時被弾時、素早さ最速の1体のみ発動 | wiki/レッドカード | live 62行 verbatim / SD `redcard.onAfterMoveSecondary` の `source.forceSwitchFlag` ガードで2体目以降が早期return=**1体のみ**を実装で再現 | 一致 | **B** | 実装が主張を裏付ける数少ない道具行 |
| 67 | 野生戦: シングルは戦闘終了/ダブル等は控えが引きずり出される | wiki/レッドカード | live 59行 verbatim(単独) | 一致 | **B1** | 野生戦=Champions非対象。設計優先度は低い |
| 68 | じゃくてんほけんは範囲補正後でもタイプ相性が抜群なら発動 | SD `data/items.ts` | SD `weaknesspolicy.onDamagingHit` = `target.getMoveHitData(move).typeMod > 0` のみ(実ダメージ値を見ない)を実コードで確認。wiki/じゃくてんほけんは「ダブル」「範囲」「全体攻撃」いずれもヒット0 | 一致(SD)/**未発見**(Wiki) | **B1** | T6の自己申告どおり推論。★ただし**間接的な傍証**を発見: wiki/じゃくてんほけん『詳細な仕様』節に「所持者の**あついしぼう/たいねつによりダメージが減少しただけでは発動に影響しない**。元から受けた技のタイプが弱点だった場合は発動する。」=**ダメージ量の減少はトリガに影響しない**という一般原則がWikiにある。範囲補正も同じダメージ補正なので推論の確度は上がる |
| 69 | まけんき/かちきがじゃくてんほけんより先に発動 | wiki/じゃくてんほけん | live 56行 verbatim(単独) | 一致 | **B1** | 「きょうせいはじゃくてんほけんを発動させた後に発動判定がある」(同57行)も#29と整合 |
| 70 | たべのこしにダブル差なし | wiki/たべのこし | 生wikitext全文で「ダブル」0件・「トリプル」0件を再現確認 / SD `leftovers` は `onResidual` の `heal(baseMaxhp/16)` のみでゲームタイプ分岐なし | 一致 | **A** | 不在の確認という性質は元ファイルが正直に明記済み。Champs節ありも確認 |

## 3. 「Showdown実装の要点」表(15行)

| 行 | 一致/不一致 | 区分 | 指摘 |
|---|---|---|---|
| いかく `intimidate.onStart` | 一致 | **B** | コードは2193-2207行で完全一致。★ただし本文に**キリル文字が混入**している:「`substitute`**волат**イル有無」。`волат` はロシア語文字。文字化けなので要修正 |
| フレンドガード `onAnyModifyDamage` | 一致 | **B** | 1533-1539行と逐語一致 |
| プラス/マイナス `onModifySpA` | 一致 | **B** | 3317-3325行。`allies()` が自分を除くことも `sim/pokemon.ts` 720行で裏取り |
| Follow Me `followme` | 一致 | **B** | `onTry(source){ return this.activePerHalf > 1; }`(6050-6052行)を確認。Follow Me=このゆびとまれ ✓ |
| Rage Powder `ragepowder` | 一致 | **B** | `onFoeRedirectTargetPriority:1` と `source.runStatusImmunity('powder')` を確認(14611-14616行)。実flagsは `{ noassist:1, failcopycat:1, powder:1 }` |
| Spotlight `spotlight` | 一致 | **B** | `onFoeRedirectTargetPriority: 2` 確認(17777行)。★**注記漏れ**: Showdownで `isNonstandard: "Past"`(17762行)=**第九世代では使用不可**。`master/moves.json` も `champions:false`。現行ダブル設計の対象外である旨を書くべき |
| **Ally Switch(ポジションチェンジ)** | コードは一致/**名前が不一致** | **C** | ★★**日本語名が誤り**。Ally Switch の日本語名は **「サイドチェンジ」**(`master/moves.json` slug=`ally-switch`、ポケモンWiki『ダブルバトル』本文も「サイドチェンジ」)。**「ポジションチェンジ」という技は `master/moves.json` に存在しない**。コード内容(`gameType !== 'doubles' && !== 'triples'` で失敗・`swapPosition`)は302-331行で正しい |
| **てをつなぐ(Helping Hand)** | コードは一致/**名前が不一致** | **C** | ★★**日本語名が誤り**。**てをつなぐ = Hold Hands**(`master/moves.json` slug=`hold-hands`)。**Helping Hand の日本語名は「てだすけ」**(slug=`helping-hand`)。Bulbapedia の Double Battle 記事も "Helping Hand, Ally Switch, …, Hold Hands" と別技として列挙。コード内容(`target:"adjacentAlly"`・`effectState.multiplier` 初期1.5・`onRestart` で累積)は8576-8608行で正しい |
| 範囲技0.75倍 | コードは一致/**関数名が不一致** | **B** | ★**関数名が誤り**。`getBaseDamage` ではなく **`modifyDamage`**(`sim/battle-actions.ts` 1724行、該当は1733-1737行)。`gameType === 'freeforall' ? 0.5 : 0.75` とコメント `// multi-target modifier (doubles only)` は逐語一致。★また551行の囲み関数は `spreadMoveHit` ではなく **`trySpreadMoveHit`**(550行)。行番号551と条件 `targets.length > 1 && !move.smartTarget` は正しい |
| だっしゅつパック `ejectpack` | 一致 | **B** | `onAfterBoost` の `boost[i] < 0` → `effectState.eject = true`、`onAnySwitchInPriority: -4` を1705-1725行で確認 |
| ものまねハーブ `mirrorherb` | 一致 | **B** | `onFoeAfterBoost` で `effectState.boosts` 加算・`ready` フラグ・`onAnySwitchInPriority: -3` を4146-4168行で確認 |
| じゃくてんほけん `weaknesspolicy` | 一致 | **B** | 7592-7606行で完全一致 |
| レッドカード `redcard` | 一致 | **B** | 5142-5160行。`target.useItem(source)` と `runEvent('DragOut', …)` を確認 |
| ぼうじんゴーグル `safetygoggles` | 一致 | **B** | 5454-5468行で完全一致 |
| たべのこし `leftovers` | 一致 | **B** | 3334-3345行。`onResidualOrder: 5` / `onResidualSubOrder: 4` も付いている(T6は未記載) |

---

## 矛盾・要注意

### ★ 直すべき誤り(データ化する前に必ず修正)

1. **Ally Switch の日本語名(Showdown表)**: 「ポジションチェンジ」→ **「サイドチェンジ」**。`master/moves.json` に「ポジションチェンジ」は存在しない。CLAUDE.md の「名前の不一致は機能が到達不能になる実バグ」型。
2. **Helping Hand の日本語名(Showdown表)**: 「てをつなぐ」→ **「てだすけ」**。「てをつなぐ」は Hold Hands。1と同型の実バグ予備軍。
3. **トリプルバトルの導入世代(#2, #54)**: 「第六世代〜(トリプル導入以降)」→ **第五世代で導入、第五・第六世代のみ採用**(ポケモンWiki『トリプルバトル』冒頭)。第七世代以降は非搭載=Championsにも無い。
4. **範囲技0.75倍の関数名(Showdown表)**: `getBaseDamage` → **`modifyDamage`**(`sim/battle-actions.ts` 1724行)。あわせて551行の関数は `trySpreadMoveHit`。
5. **ミラーアーマーのフック名(#9備考)**: `onModifyBoost`/`onAnyModifyBoost` → **`onTryBoost`**。
6. **#4「手順11項目」**: 実際は**トップレベル6項目 + サブ10項目**。さらに claim欄が**まもるを判定列に含めている**が、原文は「まもる状態のポケモンに対しても効果がある」=**まもるはいかくを防がない**。
7. **#11引用の「たんじゃん」**: 原文は **「たんじゅん」**。
8. **#16引用「味方から 受ける 攻撃を 受けない」**: 原文に存在しない。正しくは「味方の 攻撃を 読み取って 受けない。」または「味方から受ける攻撃技を無効化する。」
9. **#1の世代欄「第七〜九世代」**: ダブルで相手全体は**第三世代から**の効果。列挙されたバトル形式が世代で増えただけ。
10. **#19の世代**: シングルで発動しなくなったのは**第四世代**から。第五世代の変更は「プラス/マイナスどちらの味方でも可」。
11. **Showdown表いかく行にキリル文字混入**: 「волатイル」→「volatile」。
12. **#56備考「#1-45で個別に深掘り済み」**: **しれいとう**に個別行が無い(かつ `champions:false`)。

### ★ Champions欄の書き方(誤読を招く)

13. **#6 ばんけん「不明」** → `champions:false`(0体)+ポケモンWikiにChamps節なし = **N** と確定できる。
14. **#13「Y」** → まけんきはY、**わたげはN**。Championsではこの局面は起こらない。
15. **#18「Y」** → テレパシーはY、**はじけるほのおはN**。同上。
16. **#12「Y」** → まけんき/かちきはY、**ベノムトラップはN**。3能力低下の例はChampionsでは起こらない。
17. **#39「Y(2体)」** → **すじがねいりのみY**。**スクリューおびれはN**(0体)。2特性を1行に束ねたためChampions可否が潰れている。
18. **#36** → ひらいしんY(5)は正しいが、**よびみずはN**。ダブル設計で「よびみず」を前提にできない。

### ★ Showdown を差分オラクルにすると食い違う恐れ(要検証)

19. **#60 だっしゅつパック「素早さ最速の1体のみ発動」**: Showdown `ejectpack` に1体限定ロジックが見当たらない(各所持者が独立した `effectState` を持つ)。一方 **#66 レッドカードは `source.forceSwitchFlag` ガードで1体限定を実装済**。同型のはずのロジックが実装で非対称。
20. **#33 バッテリー/#35 パワースポットの「シングルでも遅延技に効く」**: Showdown の `onAllyBasePower` にはこの例外実装が見当たらない。
21. **#3 いかくの「左から」順**: Showdown は `Side.foes()` のスロット配列順に処理するだけで、それが「相手から見て左」に対応する保証はコードに無い。**自前で左右順を定義すること**。

### ★ 元ファイルの「取れなかった点」のうち3件は解決した

- **取れなかった点1(ダウンロードのダブル比較対象)** → **解決**。相手全員の防御・特防を**それぞれ足し上げた合計値**で比較(ポケモンWiki + Bulbapedia + Showdown の3ソース一致)。トリプルでは対角の相手も合計に含む。
- **取れなかった点2(かわりものの対象)** → **解決**。**自分の正面のポケモン固定**。正面に変身できない相手がいた場合、他に変身できる相手がいても**不発**(ポケモンWiki + Bulbapedia + Showdown の3ソース一致)。
- **取れなかった点4(いかりのこなの master 突合)** → **解決**。`master/moves.json` と Champions説明文が完全一致(`target=自分` / `priority=2` / `flags.powder=true` / `champions=true`)。

### ★ 元ファイルの取りこぼし(誤りではないが設計で要る)

- **#14 フレンドガードの累積**: 2体で 9/16(56.25%)、3体で 27/64。ダブルでは成立しないがトリプル/レイドでは成立。
- **#25 そうだいしょうの上限**: Showdown は `Math.min(totalFainted, 5)`=**上限5体**。
- **たべのこし**: `onResidualOrder: 5` / `onResidualSubOrder: 4`(ターン終了処理の並び順)。
- **#59の周辺**: `master/moves.json` には `flags.double_battle_oriented` というダブル向けフラグが既にあり、いかりのこな/このゆびとまれ/サイドチェンジ/アロマミストに立っている。設計で使える既存資産。

---

## 設計で使ってよい確定事項(A / B のみ)

### Champions で確認できた(A)

- **いかく**はダブルで相手全体に効果(Champions搭載19体)。対象ごとに個別判定され、対象ごとに別々の反応(無効化/跳ね返し/まけんき等)が起こりうる。
- **せいしんりょく**は Champions説明文で「相手の攻撃にひるまず **いかくも効かない**」=ひるみ無効といかく無効の両方が Champions で確定(10体)。
- **ミラーアーマー**(1体)はいかくを跳ね返し、いかく側だけが攻撃-1になる。実装フックは `onTryBoost`。
- **テレパシー**(5体)は味方の**攻撃技のみ**を無効化(変化技は不可、かたやぶりには不発)。Champions説明文=「味方からの攻撃を回避する。」シングルでは発動しない。
- **フレンドガード**(2体)は自分以外の味方の被ダメを3/4に。Champions説明文=「味方が受けるダメージを3/4にする。」
- **プラス/マイナス**(2体/1体)は**味方の場**に相方がいるときのみ特攻1.5倍。複数いても**累積しない**。
- **いやしのこころ**(4体)=ターン終了時、隣接味方の状態異常を30%で治す。
- **おもてなし**(1体)=場に出たとき味方HPを最大HPの1/4回復(隣接味方)。
- **きみょうなくすり**(1体)=場に出たとき味方のランク補正を0にリセット。
- **そうだいしょう**(1体)=補正率は発動時点で確定(以後倒れても上がらない)。
- **レシーバー**(1体)=ひんしになった味方の特性を引き継ぐ。**ダブル専用**(コピー不可特性なら不発)。
- **きょうせい**(3体)=味方が道具を消費すると自分の道具を渡す。
- **スイートベール**(3体)=味方のねむり/ねむけを**予防**(既存を治す効果は無い)。
- **アロマベール**(2体)=味方のメロメロ/アンコール/いちゃもん/かなしばり/ちょうはつ/かいふくふうじを予防。
- **フラワーベール**(2体)=くさタイプの味方の状態異常/ねむけ/ランク低下を予防。
- **ひらいしん**(5体)=でんき技を引き寄せ、無効化し、とくこう+1(第五世代以降)。※**よびみずは Champions 非搭載**。
- **すじがねいり**(2体)=ちゅうもくのまと/サイドチェンジ/ひらいしん・よびみずで対象を変えられない。※**スクリューおびれは非搭載**。
- **アナライズ**(2体)=**場全体で一番最後に行動した**ときのみ発動(ダブルではシングルと条件が変わる)。
- **あとだし**(1体)=必ず後攻(トリックルーム下でも)。
- **どくげしょう**(1体)=物理技を受けると**常に敵側の場**をどくびしにする(味方の物理技で誤爆しても敵側)。2段階目まで既にあるなら不発。
- **かわりもの**(1体)=ダブルでは**自分の正面**のポケモンに変身。正面に変身できないなら**不発**(他を代わりに選ばない)。
- **トレース**(4体)=コピー可能な相手が複数なら**ランダム**。可/不可が混在するなら**必ず可の方**。
- **いかりのこな**(Champions実装・優先度+2・対象=自分・粉技)=相手の技を全部自分が受ける。**シングルでは意味が無い**。
- **たべのこし**=シングル/ダブルで挙動差なし(ゲームタイプ分岐が権威にも実装にも無い)。
- **ポケモンWiki『ダブルバトル』が挙げるダブル特有特性22項目**の列挙は原文と完全一致(ただし **しれいとう は Champions 非搭載**)。

### 一般世代の権威2ソース一致(B)

- **いかくを無効化する特性**(第八世代以降追加): きもったま/せいしんりょく/どんかん/マイペース。**ばんけん**はいかくで攻撃が**+1**になる(ただしばんけんは Champions 非搭載)。
- **ランク低下の反応は per-stat**: 1回の効果で複数能力が下がると、下がった**能力の数だけ**まけんき/かちきが逐一発動する(Showdown も per-stat ループ内でイベントを回している)。
- **わたげ**は自分以外の**敵味方全員**のすばやさ-1。無効化された攻撃では発動しない。(Champions 非搭載)
- **ダウンロード**はダブルで**相手全員の防御・特防をそれぞれ合計して比較**する。(Champions 非搭載)
- **しょうりのほし**は味方全員の命中率 ×4506/4096。一撃必殺技には効かない。(Champions 非搭載)
- **バッテリー/パワースポット**は味方の技威力 ×5325/4096(=1.3)。複数体で**累積**する(2体で6923/4096)。(いずれも Champions 非搭載)
- **はがねのせいしん**は味方のはがね技 ×1.5。(Champions 非搭載)
- **パステルベール**は味方のどく/もうどくを予防し、既にどくの味方を**能動的に治す**。(Champions 非搭載)
- **きょうえん**は味方のランク補正 + 急所アップ状態の両方をコピーする。(Champions 非搭載)
- **かがくのちから**は `noreceiver` 相当のコピー不可特性なら不発。(Champions 非搭載)
- **レッドカード**は全体技で複数所持者が同時に条件を満たしても**素早さ最速の1体のみ**発動(Showdown も `forceSwitchFlag` ガードで同挙動)。(Champions 非搭載)
- **範囲技のダメージ低減**は ×0.75(`gameType==='freeforall'` のときのみ 0.5)。実装は `sim/battle-actions.ts` の `modifyDamage`、`move.spreadHit` は `trySpreadMoveHit`(551行)で `targets.length > 1 && !move.smartTarget` のときに立つ。
- **リダイレクトの優先度**: スポットライト(`onFoeRedirectTargetPriority: 2`)> このゆびとまれ/いかりのこな(同 1)。いかりのこなだけ粉判定(`runStatusImmunity('powder')`)で抜けられる。※スポットライトは第九世代で使用不可(`isNonstandard: "Past"`)かつ Champions 非搭載。
- **サイドチェンジ(Ally Switch)** はダブル/トリプル以外では失敗する(実装にゲームタイプ判定が明示されている)。
- **てだすけ(Helping Hand)** は `target: "adjacentAlly"`、倍率1.5で重ねがけ累積可能。
