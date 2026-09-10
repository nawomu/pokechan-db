# T3「範囲技と補正」裏取り(反証)レポート

- 対象: `review/_doubles_research_2026-09-07/T3_範囲技と補正.md`(主張35件・全数検査)
- 検査日: 2026-09-07 / 検査者: 裏取り担当(元ファイルは未編集)
- 区分: **A**=Champions で確認 / **B**=一般世代の権威2ソース一致 / **B1**=1ソースのみ / **C**=不明・矛盾・取得失敗

## 使ったURL・ファイル(自分で開き直したもの)
- https://wiki.xn--rckteqa2e.com/wiki/ダブルバトル (301→ https://wiki.pokemonwiki.com/wiki/ダブルバトル で 200・**2026-09-07 に生ページを再取得**)
- https://wiki.xn--rckteqa2e.com/wiki/ダメージ (同上・生ページ再取得)
- https://bulbapedia.bulbagarden.net/wiki/Damage
- https://bulbapedia.bulbagarden.net/wiki/Reflect_(move)
- https://bulbapedia.bulbagarden.net/wiki/Wide_Guard_(move)
- https://bulbapedia.bulbagarden.net/wiki/Dragon_Darts_(move)
- https://bulbapedia.bulbagarden.net/wiki/Weakness_Policy
- https://bulbapedia.bulbagarden.net/wiki/Double_Battle
- https://bulbapedia.bulbagarden.net/wiki/Self-Destruct_(move)
- https://bulbapedia.bulbagarden.net/wiki/Flame_Burst_(move)
- https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/battle-actions.ts(**生ソースを取得して行番号で確認**)
- https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/battle.ts / data/mods/gen4/scripts.ts / data/mods/gen4/moves.ts
- ローカル: `reference/_authority_corpus/rules/{ダブルバトル,ダメージ}.json` / `reference/_ability_facts.json` / `reference/_authority_corpus_ch/{moves_ch,abilities_ch,items_ch_full}.json`

**先に1点**: 元ファイルが使った `wiki.pokemonwiki.com` は偽ドメインではない。`wiki.xn--rckteqa2e.com`(=wiki.ポケモン.com)が **301 で pokemonwiki.com に転送**される正規の移転先。ただし `https://` を付けて直接叩くと 403 を返すので、URL 表記は `https://wiki.xn--rckteqa2e.com/wiki/...` に統一するのが安全。

---

## 検査表

| # | 主張(要約) | 元出典 | 第2ソースURL | 一致/不一致/未発見 | 区分 | 指摘 |
|---|---|---|---|---|---|---|
| 1 | 範囲技のダメージ0.75倍 | JP Wiki ダブルバトル | https://bulbapedia.bulbagarden.net/wiki/Damage | 一致 | **B** | 引用は生ページで再確認(2026-09-07)。原文は末尾に「（ダメージ#範囲補正)」が付く。世代欄「第四世代〜第五世代以降」は曖昧 → 正しくは**第四世代以降が0.75倍/第三世代は0.5倍**。 |
| 2 | Bulbapedia "Targets is 0.75 (0.5 in Battle Royals)…" | Bulbapedia Damage | JP Wiki ダメージ「第五世代以降は複数を対象とするわざなら0.75倍」 | 一致(逐語) | **B** | 引用は Gen V以降 節に**逐語で実在**。 |
| 3 | 補正条件は「実行時点の対象数」・実際に当たったかは問わない | Bulbapedia Damage | JP Wiki ダブルバトル「2体が攻撃対象になれば、片方に無効化された場合でも範囲補正がかかる」 | 一致(内容)/**世代ラベル不正確** | **B** | ★引用文 "regardless of whether the move actually hits or can hit all the targets" は **Gen III 節と Gen IV 節にのみ存在**。Gen V以降 節は "if the move has more than one target when the move is executed, and 1 otherwise" までで、"regardless…" は書かれていない。世代欄「第五世代以降」は出典と不一致 → 「第三・第四世代の明文＋第五世代以降も同趣旨」に直すべき。 |
| 4 | 片方ひんしで1体なら補正なし/2体なら無効化でも補正あり | JP Wiki ダブルバトル | Bulbapedia Damage(Gen IV) "provided there is more than one such target when the move is executed…" | 一致 | **B** | 逐語で実在(生ページ再確認)。 |
| 5 | 第三世代は0.5倍・味方を巻き込む技には非適用 | JP Wiki ダブルバトル/ダメージ | Bulbapedia Damage(Gen III) "unless it targets all other Pokémon, like Earthquake" | 一致 | **B** | Champions非対象で正しい(N)。 |
| 6 | 第四世代のじばく/だいばくはつは対象2体なら補正なし・3体で0.75倍 | JP Wiki 2ページ | Bulbapedia Self-Destruct(該当記述**未発見**)/Showdown `data/mods/gen4/` に例外実装**なし** | 未発見(反証も出ず) | **B1** | 同一Wikiの2ページ=1ソース。**Showdownのgen4modは `spreadModifier` 上書き口(scripts.ts:74)を持つがじばく例外は未実装** → 差分オラクルとしては食い違う。第四世代限定なのでChampions設計には不要。 |
| 7 | ドラゴンアローは2体1回ずつ・範囲補正で落ちない | JP Wiki + ヤックン/ch/ | Bulbapedia Dragon Darts(逐語)+ `moves_ch.json`(target=**1体選択**) | 一致 | **A** | Champions効果文を`moves_ch.json`で逐語再確認。target が「1体選択」＝そもそも spreadHit にならない、が実装上の理由。**元ファイルの未確認事項5は解消**: Bulbapedia に "Dragon Darts (Japanese: **ドラゴンアロー** Dragon Arrow)" と明記=同一技。 |
| 8 | 壁は1/2→2/3・正確値 第四2/3・第五2703/4096・第六以降2732/4096 | JP Wiki ダブルバトル | https://bulbapedia.bulbagarden.net/wiki/Reflect_(move) | 一致 | **B** | 数値は両ソース一致。ただし**Champions確認欄「Y」は言い過ぎ**(ヤックン/ch/ は「2/3」としか書かない=分数値は未確認。元ファイル自身が末尾7で認めている→表のY/Nを N/一部 に直すべき)。 |
| 9 | Bulbapedia「一律適用・恩恵を受ける数に関わらず」 | Bulbapedia Reflect | 原文再取得 | **不一致(引用改変)** | **C** | ★★重大。元ファイルの引用 "This applies uniformly in Double and Triple Battles regardless of how many Pokémon benefit." は**逐語ではない**。原文は "Reflect now always reduces damage by (roughly) a third rather than a half (…2703/4096 in Generation V, or 2732/4096 in Generation VI onward) **in Double Battles and Triple Battles**, regardless of how many Pokémon on a given side are being protected by it." — **「always … a third」はダブル/トリプル内限定**。元の切り方だと「常に1/3軽減」が全形式に及ぶ読みになり、意味が変わる。 |
| 10 | Champions効果文「味方が複数の場合は半分ではなく2/3」 | `moves_ch.json` | ローカル再読(リフレクター/ひかりのかべ/オーロラベール3件) | 一致(逐語) | **A** | 3技とも同文言を確認。 |
| 11 | 1体しかいない時 第四以前1/2・第五以降2/3。**「シングルか否かは無関係」** | JP Wiki ダブルバトル | Bulbapedia Damage / Reflect | 前半一致・**後半の括弧書きは不一致** | **C** | ★★重大。①「効果を受けているポケモンが1体しかいない場合…第五世代以降では2/3」は逐語で実在(生ページ再確認)し、Bulbapedia Reflect の "regardless of how many Pokémon on a given side are being protected" と整合 = **ダブル内の話としては B**。②しかし追記の**「シングルバトルか否かは無関係」は出典にない推論で、Bulbapedia と矛盾**(Gen V以降でも**シングルでは0.5**。Reflect の 1/3 化は "in Double Battles and Triple Battles" に限定)。③さらに Gen III/IV 節は "if, in a Double Battle, when the move is executed, the only Pokémon on the target's side is the target, **Screen remains as 0.5**" と明記=JP Wikiの「第四世代以前は1/2」と一致。**設計に「形式は無関係」を持ち込むと壁の倍率がシングルで壊れる。** |
| 12 | 急所なら壁無効/すりぬけも壁無効 | JP Wiki ダメージ | Bulbapedia Reflect "Pokémon with the Ability Infiltrator ignore the effects of Reflect when attacking" + `abilities_ch.json` すりぬけ | 一致 | **A** | **元ファイルは過小評価**。Champions のすりぬけ効果文に「相手の『オーロラベール』『リフレクター』『ひかりのかべ』『しろいきり』『しんぴのまもり』『みがわり』の効果を受けない。」と**明記**=すりぬけ側もChampions確認済み(A)。 |
| 13 | リフレクター/ひかりのかべ と オーロラベールは重複しない | JP Wiki ダメージ | Bulbapedia Damage(Gen V+ other表)"Does not stack, even if e.g. Light Screen and Aurora Veil are active at the same time." | 一致 | **B** | Champions効果文には非重複の記述なし=Champions不明のままで正しい。 |
| 14 | 処理順 第三=1P/2P交互・第四=すばやさ順・第五以降=味方→左→右 | JP Wiki ダブルバトル | Bulbapedia Double Battle(#16) | **不一致** | **C** | 引用は逐語で実在(生ページ再確認)。ただし英語版と真っ向から食い違う(下記「矛盾」参照)。Showdown は `getAllActive` を `speedSort`(battle-actions.ts:181-182 / battle.ts:466-468)する箇所を持ち、**すばやさ順寄りの実装**に見える=第2・第3ソースが JP Wiki を支持していない。**設計で「味方→左→右」を確定として実装しないこと。** |
| 15 | 第四世代のみ「あとだし」は状態異常判定/交代/範囲技の被弾順も後 | `_ability_facts.json` L510-511 | (第2ソース未調査) | 一致(ローカル逐語) | **B1** | 行番号 510/511 は実在し逐語一致。出典は `ポケモンWiki『あとだし』第四世代のみ節`。★元ファイルの説明文「なまけ等ではなく…"後手系"ではなく本来は「あとだし」効果を持つ特性、原文まま」は**日本語として破綻していて誤読を招く** → 単に「**特性あとだし(Stall, en:Stall)**」と書けばよい。`abilities_ch.json` に あとだし(id100) は在るが、第四世代限定規則なのでChampionsには**適用しない**。 |
| 16 | Bulbapedia「第四世代以降、対象のすばやさ順」 | Bulbapedia Double Battle | 原文再取得 | 一致(逐語) | **B1** | "From Generation IV onward, moves that target multiple Pokémon resolve in order of the target's respective Speed stats." 逐語で実在。#14と矛盾。 |
| 17 | 複数のさまようたましい/ミイラ: 味方優先→左→右 | `_ability_facts.json` L5308-5309 | 同ファイル L16124-16125(**ミイラ**側の同趣旨記述) | 一致 | **B1** | 逐語一致。出典は `ポケモンWiki『さまようたましい』特性の仕様節`。ただしWiki同一系統=実質1ソース。両特性ともChampions搭載(さまようたましい id254 / ミイラ id152)。 |
| 18 | 対象の味方が使用前にひんし: 第四以前は敵へ/第五以降は失敗 | JP Wiki ダブルバトル | 未発見 | 一致(元出典のみ) | **B1** | 生ページで逐語確認。Bulbapedia側の対応記述は見つからず。 |
| 19 | Showdown `if (!pokemon.hp && targets.length === 1) { hit++; break; }` | Showdown battle-actions.ts | 生ソース取得(`hitStepMoveHitLoop`, **L857開始 / 該当条件 L966-969**) | 一致(逐語) | **B1** | ★元ファイルの懸念(末尾3「要約経由で逐語は保証できない」)は解消 = **コードは逐語で実在**。関数名・条件式とも一致。指摘どおり**連続攻撃ループの打ち切り条件**であって範囲技の対象ループではない、という注記も正しい。 |
| 20 | 反動は totalDamage(全対象合計)基準 | Showdown battle-actions.ts | 生ソース(L965 `move.totalDamage += damage[i];` / L981-982 `applyRecoilDamage(move.totalDamage, …)` / L1379-1385 `applyRecoilDamage`) | 一致(逐語) | **B1** | コード直上のコメントは "Total damage dealt is accumulated for the purposes of **recoil (Parental Bond)**" = 主眼はおやこあい。実機の範囲反動技の裏取りが無い点は元ファイルの指摘どおり。 |
| 21 | `spreadHit` 設定と `freeforall ? 0.5 : 0.75` | Showdown battle-actions.ts | 生ソース(**L551** `if (targets.length > 1 && !move.smartTarget) move.spreadHit = true;` / **L1735** `const spreadModifier = this.battle.gameType === 'freeforall' ? 0.5 : 0.75;`) | 一致(逐語) | **B1** | ★**位置の訂正**: spreadModifier は `getDamage` ではなく **`modifyDamage`(L1724-1738)**の中。`smartTarget` がドラゴンアローの例外を担う推測も、L896-951 の smartTarget 分岐とコメント "When Dragon Darts targets two different pokemon…" で裏付いた。 |
| 22 | バトルロイヤルは0.5倍 | JP Wiki ダメージ | Bulbapedia Damage "0.5 in Battle Royals" + Showdown L1735 | 一致 | **B** | 3ソース一致。第七世代限定機構でChampions非対象。 |
| 23 | 範囲補正は天気/急所/乱数/タイプ一致/相性より前 | Showdown modifyDamage | **JP Wiki ダメージ 第五世代以降 の式**「ダメージ = (…+2)×**範囲補正**×おやこあい補正×天気補正×急所補正×乱数補正×タイプ一致補正×相性補正×やけど補正×M×Mprotect」 | 一致 | **B** | ★**格上げ**。元ファイルは「要約経由なので留意」としていたが、生コード(L1731-1742: `baseDamage += 2;` → spreadHit → 天気 → crit → randomizer → STAB → types)と JP Wiki の式が**順序まで完全一致**。実装2ソース+権威1ソース。**補足**: 壁補正は範囲補正の直後ではなく **相性・やけどの後の M の中**(JP Wiki 明記) → 実装時は分けること。 |
| 24 | 命中は対象ごとに独立 | Showdown hitStepAccuracy | 生ソース(**L690-753**: `for (const [i, target] of targets.entries())` … `if (accuracy !== true && !this.battle.randomChance(accuracy, 100))` … `hitResults[i]`) | 一致(逐語) | **B1** | 逐語で実在。公式一次資料は未発見(元ファイル末尾8のとおり)。 |
| 25 | 急所は対象ごとに独立 | Showdown getDamage | 生ソース(**L1637** `const moveHit = target.getMoveHitData(move);` / **L1638-1641** `moveHit.crit = move.willCrit \|\| false; if (move.willCrit === undefined) { if (critRatio) { moveHit.crit = this.battle.randomChance(1, critMult[critRatio]); } }`) | 一致(逐語) | **B1** | 逐語で実在。 |
| 26 | ワイドガードは味方全員を複数対象技から守る(味方のじしん等も) | ヤックン/ch/ + Bulbapedia | 両方を原文で再確認 | 一致(逐語) | **A** | ★**元ファイルに落ちている重要事実**: 同じBulbapedia段落に(a)"**Wide Guard will block these moves even in Single Battles.**" (b)"Moves that break protection, like **Feint**, will remove the effects of Wide Guard." (c)"The Ability **Unseen Fist** allows contact moves to bypass Wide Guard." (d)第五・第六世代は複数対象の**変化技を防げなかった**。設計に要反映。 |
| 27 | ワイドガードはドラゴンダーツに効かない | Bulbapedia Dragon Darts | JP側未発見 | 一致(逐語) | **B1** | "Wide Guard does not affect Dragon Darts." 逐語で実在。**英日名称対応も同ページで確定**(ドラゴンアロー)→ 元ファイル末尾5の宿題は消してよい。ただしChampions効果文には非記載のまま。 |
| 28 | 使用者がひんしでも継続/最後に動くと失敗 | Bulbapedia Wide Guard | 原文再取得 | 内容一致・**引用が逐語でない** | **B1** | 原文は "The protection granted by Wide Guard **goes on until the end of the turn** even if the user faints during the turn." / "**If the user goes last in the turn, the move will fail.**" 前者の引用文字列は元ファイルの言い換え。かぎ括弧で出すなら原文に差し替え。 |
| 29 | こんじょう: 範囲直接攻撃の途中で状態異常→同じ技の他対象のダメージにも反映 | `_ability_facts.json` L4036-4037 | 未調査 | 一致(ローカル逐語) | **B1** | 出典は `ポケモンWiki『こんじょう』特性の仕様節`。★**用語の誤り**: 「特性『かえんのまもり』」は誤りで**かえんのまもりは技**(トーチカも技)。★**Champions適用範囲**: `moves_ch.json`(497技)に **かえんのまもり は無い**。トーチカ・ぶんまわす・ワイドブレイカーは在る → Championsでは「トーチカ×直接攻撃の全体技」だけが該当。 |
| 30 | じゃくてんほけんは対象ごとに独立消費(きょうせいより先) | Bulbapedia Weakness Policy | JP側未調査 | 一致(逐語) | **B1** | 引用は逐語で実在。★**Champions非搭載**: `items_ch_full.json`(一般45+きのみ28+メガストーン75+ボール27)に **じゃくてんほけん は無い**。「対象ごとに独立発動」という一般則の傍証としては使えるが、**Champions実装対象ではない**。 |
| 31 | きょうせい×同時発動の例外(しろいハーブ/ものまねハーブ/だっしゅつパック) | `_ability_facts.json` L3896-3897 | 未調査 | 一致(ローカル逐語) | **B1** | `generation_caveat:true`・出典は `ポケモンWiki きょうせい『第七世代以降』節` = 世代表記「第七世代以降」は正しい。★**Champions適用範囲が大幅に狭い**: きょうせい(id184)は在るが、引用に出る**じゃくてんほけん/じゅうでんち/ふうせん/だっしゅつパック/ものまねハーブ/アッキのみ/タラプのみ は Champions のアイテム表に無い**。残るのは **しろいハーブ・きあいのタスキ・オボンのみ** など。 |
| 32 | 「特性ヘイラッシャ」が全体技を受けると範囲補正がかかる | `_ability_facts.json` L5744-5745 | 未調査 | 引用は一致・**帰属が誤り** | **B1** | ★**誤り**: **ヘイラッシャは特性ではなくポケモン(Dondozo)**。この fact の所属特性は **しれいとう(Commander, id279)**、出典は `ポケモンWiki しれいとう『シャリタツ側の効果』節`。世代は第九世代(SV)。しれいとう自体はChampions搭載(効果文に「ダブルバトルで味方に『ヘイラッシャ』がいると口の中に入り…ランクが2段階ずつ上がる」)。 |
| 33 | はじけるほのおの1/16巻き添え | JP Wiki ダブルバトル | Bulbapedia Flame Burst(コアシリーズ節の該当文は**未取得**) | 元出典は一致 | **B1** | 生ページで逐語確認。★**Champions非搭載**: `moves_ch.json` 497技に **はじけるほのお は無い** → Champions設計では実装対象外。Champions確認欄は「不明」でなく **N** が正しい。 |
| 34 | ダブルで対象が変わる技のカテゴリ一覧 | JP Wiki ダブルバトル | `master/moves.json` / `moves_ch.json` | 一致(一覧の存在) | **B1** | 一覧自体は生ページに実在。★**Champions非搭載の例が混ざる**: 挙げられた「うつしえ/さきどり/ダイウォール以外のダイマックスわざ」「フリーフォール」は **Champions の497技に無い**(ダイ系は『ダイビング』のみ)。Champions の target 語彙は実測13種(1体選択353/自分58/ランダム1体6/相手全体22/全体の場15/味方1体2/味方全体6/自分以外全体16/味方の場7/全体2/不定5/相手の場4/自分か味方1)。 |
| 35 | 相手全員の防御・特防を合計して比較する特性 | `_ability_facts.json` L13944-13945 | 未調査 | 引用は一致・**帰属が曖昧** | **B1** | 引用は逐語一致。★所属特性は **ダウンロード(Download, id88)**。元ファイルの「トレース対象特定等の一部特性の判定式」は誤導(トレースは無関係)。ダウンロードはChampions搭載だが、Champions効果文は「相手の『ぼうぎょ』が『とくぼう』より低い場合は…」までで**合計比較の明記なし**=Champions不明。 |

---

## 矛盾・要注意(設計者向け)

1. **【最重要】#9/#11 壁の倍率**: 元ファイルの Bulbapedia 引用は**切り取りで意味が変わっている**。原文は「always … a third」を **"in Double Battles and Triple Battles"** に限定している。したがって #11 の括弧書き「**シングルバトルか否かは無関係**」は出典に無く、**誤り**。正しくは「①シングル=0.5 ②ダブル(第五世代以降)=2703/2732/4096(≒2/3)で、**味方が1体でも2/3のまま** ③ダブルでも第四世代以前は味方1体なら0.5」。
2. **【要判断】Champions の壁の文言と一般則が食い違う**: ヤックン/ch/ は3技とも「**味方が複数の場合は**半分ではなく2/3」= 1体なら1/2 と読める。一方 JP Wiki(第五世代以降)と Bulbapedia は「ダブルなら**味方の数によらず**2/3」。Champions がどちらか(=味方がひんしで1体になった時の壁倍率)は**未確定**。実機かヤックン/ch/の詳細ページで要確認。
3. **【未決】#14 vs #16 処理順**: JP Wiki「第五世代以降=味方→左→右(すばやさ非依存)」 vs Bulbapedia「第四世代以降=対象のすばやさ順」。第3のソース(Showdown)は `speedSort` を使う箇所があり **JP Wiki を支持していない**。**どちらも確定にしない**。#17(さまようたましい)の「すばやさによらず左→右」は**特性の上書き順**の話で、ダメージ適用順の証明にはならない(元ファイルは「一般順序と一致する実例」と書くが論拠として弱い)。
4. **#3 の世代ラベル誤り**: "regardless of whether the move actually hits…" は Bulbapedia の **Gen III / Gen IV 節**の文。第五世代以降の節には無い。
5. **Champions に無いものを前提に書いている箇所**(私の第一級の疑い項目): **じゃくてんほけん(#30)**・**だっしゅつパック/ものまねハーブ/じゅうでんち/ふうせん/アッキのみ(#31)**・**かえんのまもり(#29)**・**はじけるほのお(#33)**・**うつしえ/さきどり/フリーフォール/ダイマックスわざ(#34)** は `moves_ch.json`(497技)/`items_ch_full.json`(175件)に存在しない。Champions版の設計にそのまま入れないこと(一般世代DBの器としては残してよい)。
6. **特性名の取り違え2件**: #32「特性ヘイラッシャ」→ 正しくは**特性しれいとう**(ヘイラッシャはポケモン)。#35「トレース対象特定等」→ 正しくは**特性ダウンロード**。
7. **引用が逐語でない箇所**(かぎ括弧のまま設計書に持ち込まない): #9(全面的な言い換え)、#28(言い換え)、#23(要約文)。#19/#20/#21/#24/#25 は今回**生ソースで逐語を確認済み**なので、元ファイル末尾3の警告は解除してよい(ただし #21 の関数名は `getDamage`→**`modifyDamage`**、行 L1724-1738 に訂正)。
8. **#6 の Showdown 差分**: JP Wiki の「第四世代じばく/だいばくはつは2体なら補正なし」は Showdown の gen4 mod に実装されていない。第四世代を再現する時だけ効いてくる既知の乖離として記録。
9. **未解決のまま残るもの**: みがわりと範囲技の対象ごと独立判定(出典なし)、範囲反動技の実機挙動(出典なし)、命中/急所/乱数の対象ごと独立を明記した公式系一次資料(未発見)。元ファイルの取得失敗申告は妥当。
10. **軽微**: #8 の Champions確認欄「Y」は**分数値まで含めて読むと過大**(ヤックンは「2/3」表記のみ)。#33 の Champions欄は「不明」→ **N** に。

---

## 設計で使ってよい確定事項(A/B)

- **A(Champions確認済み)**
  - 壁3種(リフレクター/ひかりのかべ/オーロラベール)は**味方が複数のとき 1/2 → 2/3**、**急所には軽減が乗らない**、**交代しても継続**(ヤックン/ch/ 効果文)。
  - **すりぬけ**は オーロラベール/リフレクター/ひかりのかべ/しろいきり/しんぴのまもり/みがわり を**すべて貫通**(Champions特性文に明記)。
  - **ワイドガード**=優先度+3、そのターン自分と味方が「複数対象の技」を受けない、**味方が使った全体技も含む**(Champions効果文 + Bulbapedia)。
  - **ドラゴンアロー**は Champions では target=**1体選択**の2回攻撃。相手2匹なら1回ずつ、**まもる/タイプ相性で通らない側があれば片方に2回**。**範囲補正はかからない**(=spread扱いにしない)。
- **B(一般世代・権威2ソース一致)**
  - 範囲補正は **第四世代以降0.75倍 / 第三世代0.5倍(味方巻き込み技は1倍) / バトルロイヤル0.5倍**。
  - 判定は「**技の実行時点で対象が2体以上いたか**」。**当たったか・無効化されたかは問わない**。片方が既にひんしで1体しか対象にならなかった時だけ補正なし。
  - 第五世代以降の掛け順は **範囲補正 → おやこあい → 天気 → 急所 → 乱数 → タイプ一致 → 相性 → やけど → M(壁を含む) → Mprotect**。各段で丸めが入るので**順序を入れ替えない**。**壁は M の中**(相性・やけどより後)。
  - **急所に当たった攻撃には壁の軽減が乗らない**。**すりぬけも壁を無視**。
  - **リフレクター/ひかりのかべ と オーロラベールは重複しない**。
  - 壁の正確値: 第四世代 2/3 / 第五世代 2703/4096 / 第六世代以降 2732/4096。**ダブルでは恩恵を受ける味方が1体でも(第五世代以降は)2/3のまま**、ただし**シングルは0.5**、**第四世代以前のダブルで対象側が1体なら0.5**。
