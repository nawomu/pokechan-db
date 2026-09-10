# T7: Pokémon Champions ダブルバトル仕様 調査結果

- **主題**: Pokémon Champions のダブルバトル公式ルールと Champions 固有の仕様差(シングルとの違い)
- **調べた日**: 2026-09-07
- **凡例**: 「Champions確認」列 = Y(Champions公式/準公式ソースで直接確認)/N(一般世代のみの記述・Champions未確認)/不明

## 使ったURL一覧

1. https://champions-news.pokemon-home.com/ja/page/776.html (公式・レギュレーションM-B告知)
2. https://champions-news.pokemon-home.com/en/page/776.html (公式・英語版)
3. https://champions-news.pokemon-home.com/ja/page/816.html (公式・レギュレーションM-C告知)
4. https://www.pokemonchampions.jp/ja/battle/ (公式サイト・バトルについて)
5. https://bulbapedia.bulbagarden.net/wiki/Regulation_Set_M-B
6. https://bulbapedia.bulbagarden.net/wiki/Regulation_Sets_in_Pok%C3%A9mon_Champions
7. https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Champions
8. https://victoryroad.pro/champions-regulations/ (VGC公認大会ルールの詳細解説サイト)
9. https://yakkun.com/ch/changes.htm (徹底攻略・SVからの変更点まとめ)
10. https://game8.jp/pokemon-champions/776525 (ランクマ ルール記事)
11. https://gamewith.jp/pokemon-champions/546415 (ランクバトルのルールと報酬)
12. https://gamewith.jp/pokemon-champions/559137 (引き分けの条件と時間)
13. https://automaton-media.com/articles/newsjp/20260408-435416/ (TOD廃止・状態異常変更の報道記事)
14. /Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/ダブルバトル.json (ポケモンWiki「ダブルバトル」ローカル取得済・一般世代)
15. /Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus_ch/abilities_ch.json (ヤックン/ch/特性・ローカル取得済)
16. /Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus_ch/moves_ch.json (ヤックン/ch/技・ローカル取得済)
17. /Users/masamichi/Documents/ポケモンDB/reference/_regulations.json (レギュ現行/次・ローカル)
18. /Users/masamichi/Documents/ポケモンDB/reference/_official_news_snapshot.json (公式お知らせ一覧スナップショット・ローカル)

取得失敗: https://www.serebii.net/pokemonchampions/rankedbattle/ (HTTP 403)、https://yakkun.com/ch/ 個別ページの一部は直接WebFetchでは403(ブラウザ経由で取得成功したものは本文に反映)、https://www.pokemonchampions.jp/ja/rule/ (HTTP 403)

---

## 本文: 主張の表

| # | 主張 | 世代/適用範囲 | 出典URL | 引用 | Champions確認 | 備考 |
|---|---|---|---|---|---|---|
| 1 | Championsのランクバトル(ゲーム内ラダー)にはシングル・ダブル両方の対戦形式がある | Champions全期 | yakkun.com/ch/changes.htm | 「シングル・ダブル 両方対応」(SV/Champions比較表) | Y | SVも両対応だったが、Championsでも継続と明記 |
| 2 | 公式大会(VGC/TPCi主催)のPokémon Championsルールは全試合ダブルバトル | Champions・VGC2026シーズン | victoryroad.pro/champions-regulations/ | "Players will play in Double Battles in Pokémon Champions." | Y | 「ランクバトル」= 一般プレイヤー向けラダー(シングル/ダブル選択可)と「VGC公認大会」(常にダブル)は別概念。混同注意 |
| 3 | VGC公認大会は手持ち6体からダブル用に4体選出 | Champions・VGC | victoryroad.pro/champions-regulations/ | "Each player selects four out of the six Pokémon in their Battle Team." | Y | |
| 4 | ゲーム内ランクバトルの選出数=シングル3体・ダブル4体(パーティ6体は同一) | Champions・ランクバトル(ラダー) | game8.jp/pokemon-champions/776525 | 「バトルに選出するポケモン 3体（ダブルは4体）」 | Y | gamewith.jp/546415も同旨「選出ポケモン数: 3匹(ダブルバトルは4匹)」で相互確認。パーティ「6体」の明記は本記事に無いが、他の攻略記事(選出のコツ記事等)と符合 |
| 5 | 対戦時間: 総合時間20分/持ち時間7分/選択(ターン)時間45秒/選出(プレビュー)時間90秒 | Champions・公式レギュレーションM-B(共通ルール扱い) | champions-news.pokemon-home.com/ja/page/776.html | 「総合時間：最大20分」「持ち時間：最大7分」「1ターンあたりの選択時間：45秒」「ポケモン選出時間：90秒」 | Y | 英語版(en/page/776.html)で "Total time limit per game: 20 minutes" "Player timer per game: 7 minutes" "Turn time: 45 seconds" "Preview time: 90 seconds" と一致。victoryroad.pro でも同一数値("Team preview: 90 seconds" "Move time limit: 45 seconds" "Player total time limit...7 minutes" "Game time: 20 minutes") |
| 6 | シングル/ダブルで時間設定に差がある旨の記述は無し(同一の時間ルールが両形式に適用と推定) | Champions | 上記+gamewith.jp/559137 | (時間欄にシングル/ダブルの分岐記載なし) | Y(値は確認)/形式別差異は明文なし | 「明文なし(推定: シングルもダブルも同じ時間設定)」 |
| 7 | 持ち物の重複禁止(同じ持ち物を2匹以上に持たせられない) | Champions・公式ルール(パーティ全体・形式問わず) | champions-news.pokemon-home.com/ja/page/776.html | 「参加させるポケモンのうち2匹以上のポケモンに同じ「持ち物」を持たせることはできません」 | Y | 英語版 "Duplicate held items are not allowed."／victoryroad.pro "no two Pokémon may hold the same item."／yakkun.com/ch/changes.htmでも「重複の制限: パーティ内同一アイテム不可 → 同様」とSVから継続と明記 |
| 8 | 種族値被り禁止(同じ全国図鑑番号のポケモンを2匹編成できない。例:ヒートロトムとウォッシュロトムは同時不可) | Champions・VGC公認大会ルール | victoryroad.pro/champions-regulations/ | "A player's team cannot contain two Pokémon of the same species, that is, with the same National Pokédex number (for example, Heat Rotom and Wash Rotom are not allowed...)" | Y(VGCルールとして) | ゲーム内ランクバトルにも同一制約があるか個別未確認(通常のポケモン対戦の一般ルールとして歴代共通のため蓋然性は高いが、Champions公式お知らせページでの直接文言は今回未発見) |
| 9 | メガシンカは1試合につき1回のみ | Champions・レギュレーションM-A/M-B/M-C共通 | champions-news.pokemon-home.com/ja/page/816.html, /ja/page/776.html | 「メガシンカは1回の対戦で1度だけ可能です」 | Y | 英語版(en/776.html) "You can use Mega Evolution only one time per battle."／Bulbapedia Regulation Set M-A/M-B項でも "a player may only Mega Evolve once per battle" と一致 |
| 10 | メガシンカの基本仕様: 1バトル1回・メガストーン所持ポケモン1体のみ・発動後はひんし以外で解除されず交代しても維持 | Champions(XY/ORAS仕様を踏襲と分析) | yakkun.com/ch/changes.htm | 「メガシンカの基本仕様はXY/ORAS時代を踏襲しており、1バトルにつき1回のみ、メガストーン持ちのポケモン1匹だけが使用可能です。発動後はひんし以外で解除されず、交代しても維持されます。」 | Y(ヤックン準公式解説) | 同記事内で「交代→メガシンカ→わざ」の処理順が変更されている可能性を指摘するも「製品版でどのような仕様となっているかは不明確」と留保あり |
| 11 | レギュレーションM-B(現行)は2026-06-17〜2026-09-09 10:59、M-C(次)は2026-09-09〜2026-12-02 10:59 | Champions | reference/_regulations.json(ローカル), victoryroad.pro/champions-regulations/ | 「Regulation Set M-B: 17 June–9 September」「Regulation Set M-C...9 September to 2 December 2026」 | Y | ローカルmaster側の日付(JST)と海外サイトの日付(UTC/現地表記)は時差の分だけ日付境界が前後する場合がある点に注意。両者とも「レギュレーションが期間中ダブル/シングル問わず同一に適用される」という前提でPokémonプールを規定 |
| 12 | ダブルバトルはM-B期間中もランクバトルで提供されていた(使用率データが存在) | Champions・M-B(2026-06-17〜) | altema.jp/pokemonchampions/top30, gamewith.jp/pokemon-champions/558230 | 「【ポケモンチャンピオンズ】ランクバトルのダブル使用率トップ50」/「ダブルバトル使用率ランキング」 | Y(記事の存在自体が証拠) | 個別の使用率ランキングの数値までは今回未検証(対象外) |
| 13 | 時間切れ(総合時間20分経過)は、ランクバトル/カジュアルバトルでは状況に関わらず無条件で「引き分け」になる(TOD廃止) | Champions固有(第九世代までのTODから変更) | automaton-media.com/articles/newsjp/20260408-435416/, gamewith.jp/pokemon-champions/559137 | 「対戦全体の制限時間が切れるとランクバトル・カジュアルバトルでは『引き分け』となる仕様に変更」「ポケモンチャンピオンズでは、カジュアル/ランクバトルで対戦時間(20分)が切れると状況に関わらず引き分けになります」 | Y | 引き分け時はVP・SBS(シーズンバトルスコア)も獲得できずレートも変動しない(gamewith記事)。従来(SV等)は残りポケモン数・HP割合を参照してTODで勝敗判定だった、との対比記述あり |
| 14 | 公式大会(オンライン大会/TPCi大会)では引き分けでなく引き続きTODが適用され、残ポケモン数と残HP割合で勝敗を決定する | Champions・大会ルール(ランクバトルとは別枠) | gamewith.jp/pokemon-champions/559137 | 「チャンピオンズでも公式大会では引き分けではなくTODが採用される」 | Y | 「ランクバトル/カジュアル=無条件引き分け」と「公式大会=TOD」の二重構造。victoryroad.pro側は大会ルールとして「if the match ends with an unresolved outcome, the tiebreakers...late shows, then sudden death」と記載しており、TODそのものというより延長ルールとして説明(表現の整合は要注意=下記「矛盾した点」参照) |
| 15 | 自分と相手が同時にひんしになった場合(相打ち)は、ひんしの原因によって勝敗が判定される(引き分けにならない) | Champions固有 | gamewith.jp/pokemon-champions/559137 | 「自分と相手のポケモンが同時にひんしになった場合は、ひんしになった原因によって判定で勝敗が付きます」 | Y | 原因別の判定表(自滅技→受けた側の勝ち／反動技→攻撃側の勝ち／てっていこうせん→受けた側の勝ち／ほろびのうた→行動順が遅い方の勝ち／みちづれ→攻撃側の勝ち／天候ダメージ→行動順が遅い方の勝ち／毒ダメージ→行動順が遅い方の勝ち／特性ダメージ(さめはだ等)→攻撃した側の勝ち)が記事に掲載 |
| 16 | ターン内の選択時間(45秒)切れは自動で一番上の技を選択、2ターン連続で時間切れになると負け | Champions | gamewith.jp/pokemon-champions/559137 | 「時間切れになると一番上に配置されている技が自動で選択されます」「2ターン連続で時間切れになると負けになってしまう」 | Y | |
| 17 | 持ち時間(7分)を使い切ると即座に負け | Champions | gamewith.jp/pokemon-champions/559137 | 「『持ち時間』は1試合中に自分が使える操作時間の上限で、合計で7分までになっています。7分を使い切ってしまうと問答無用で負けになってしまいます」 | Y | |
| 18 | VGC公認大会の決着つかず時のタイブレークは「遅刻(late shows)」次に「サドンデス」の順 | Champions・VGC大会ルール | victoryroad.pro/champions-regulations/ | "If the match ends with an unresolved outcome, the tiebreakers that apply are first late shows, then sudden death." | Y | 「切断(disconnection)の場合は最新のルール文書を参照」との注記あり(具体文書は今回未特定=取得失敗) |
| 19 | スイスドロー戦は1本先取(Bo1)または3本先取(Bo3)、地域選手権以上ではBo3が強く推奨、決勝トーナメント(top cut)は全てBo3 | Champions・VGC大会ルール | victoryroad.pro/champions-regulations/ | "Matches played during Swiss rounds may be best-of-one or best-of-three, with the latter strongly recommended in Regional-level and higher-tier events. All top cuts must be played as best-of-three." | Y | |
| 20 | TPCi主催大会はオープンチームシート制(対戦開始時に相手とチームリストを交換し、種族/フォルム/特性/持ち物/覚えている技/努力値(SP)配分を開示。対戦後に返却、メモ・改ざん不可) | Champions・VGC大会ルール | victoryroad.pro/champions-regulations/ | "In TPCi events, players will compete with open team lists...Pokémon species, including forms or regional variants / Abilities / Held items / All known moves / Stat Alignment" | Y | |
| 21 | 技のPPは全技8/12/16/20の4段階に統一(ポイントアップ/ポイントマックス廃止) | Champions固有(第九世代までの可変PPから変更) | yakkun.com/ch/changes.htm | 「チャンピオンズではポイントアップ・ポイントマックスが存在せず、すべての技のPPが8・12・16・20の4段階に統一されました」 | Y | 対応表: 従来基本PP5(最大8)→8／基本PP10(最大16)→12／基本PP15(最大24)→16／基本PP20以上(最大32以上)→20。「さいきのいのり」(基本PP1)のみ対応が「不明」と記事に明記 |
| 22 | まもる(Protect)のPPが8に削減(SVは基本10・最大16) | Champions固有・ダブルバトルで多用される技 | yakkun.com/ch/changes.htm | 「まもるのPPが8に削減されたことです。SVでは基本PP10(最大16)でしたが、PP5相当の8にまで引き下げられました。ダブルバトルでよく使われるまもるは上限を意識する必要が出てきそうです」 | Y | 同記事「どくどく＋まもるの耐久戦術も制限されることになります」と分析(推定含む記述) |
| 23 | プレッシャー(Pressure)特性はPP標準化により相対的に強化。ダブルでプレッシャー2体に相手全体攻撃技(じしん/ハイパーボイス等)を撃つと1回でPPが合計3減る | Champions固有・ダブルバトル特有の運用 | yakkun.com/ch/changes.htm | 「特にダブルバトルで相手がプレッシャーのポケモンを2体並べた場合、じしん、ハイパーボイスなど相手全体を攻撃する技は一度にPPが3減ることになるため、さらに注意が必要です」 | Y(ヤックンの分析記事。ゲーム内の直接引用ではなく解説) | |
| 24 | まひ状態: 技が出せない確率が25%→12.5%に緩和 | Champions固有(SV=第九世代からの変更) | yakkun.com/ch/changes.htm | 「12.5%の確率で技が使えない。素早さが1/2になる」(SV欄は「25%の確率で技が使えない」) | Y | automaton-media.com記事でも「技が使えない確率が25％から12.5％に緩和」と一致 |
| 25 | こおり状態: 毎ターン25%で回復に加え、こおり状態になってから3ターン目で必ず回復する | Champions固有 | yakkun.com/ch/changes.htm | 「毎ターン25%で回復 ＋3ターン目で必ず回復」 | Y | automaton-media.com記事も同旨「こおり状態になってから3度目に回復するようになった」 |
| 26 | ねむり状態: 実質1〜2ターンで、2ターン目に1/3の確率で覚醒・3ターン目は必ず覚醒(SVは実質1〜3ターン) | Champions固有 | yakkun.com/ch/changes.htm | 「実質1～2ターン眠りで動けない。2ターン目に1/3の確率で目が覚めて、3ターン目で必ず目が覚める」 | Y | |
| 27 | 全ポケモンの個体値が31固定(厳選不要)。これにより同速対決(すばやさが完全一致するケース)が増加する可能性がある | Champions固有 | yakkun.com/ch/changes.htm | 「個体値の廃止」「同速対決が頻発する可能性があります」 | Y(個体値固定の事実)/同速増加は記事側の分析(推定) | 例: すばやさ種族値60族ユキノオーの最遅調整と61族バンギラスの最遅調整が、個体値31固定下では同じ実数値72になり「同速により(先制の可否が)ランダムになる」とヤックンが指摘 |
| 28 | 素早さが同値の場合の行動順は乱数(五分五分)で決まる、という一般仕様自体はChampionsでも変更された旨の記述は見当たらない | 一般世代(歴代シリーズ共通のメカニクス) | (Champions公式ソースでの直接言及は今回未発見) | — | 不明(明文なし) | 「明文なし(推定: 歴代同様ランダム50/50のまま。Championsが変更したという一次情報は見つからなかった)」。yakkun.com/ch/changes.htmは個体値廃止の"影響"として同速頻度増加を述べるのみで、同速時の決定方式自体の変更には触れていない |
| 29 | ダブルバトル専用の特性ロジック(隣接する味方への効果等)がChampionsのデータにもそのまま実装されている | Champions(第九世代仕様を継承) | reference/_authority_corpus_ch/abilities_ch.json(ヤックン/ch/特性・ローカル取得済) | 「自分以外の味方が受けるダメージが3/4に軽減される。(ダブルバトル用)」(フレンドガード)／「味方のポケモンの特殊技の威力が1.3倍になる。(ダブルバトル用)」(バッテリー)／「ダブルバトルで味方に『ヘイラッシャ』がいると口の中に入り…」(しれいとう=Commander)／「ダブルバトルで場に出た時、味方の能力ランクの変化を自分にコピーする」(きょうえん=Costar) | Y | 「(ダブルバトル用)」という注記がヤックン/ch/(Champions版)の特性データに明記されている6件を機械grepで確認済み(mimicry/battery/commander/costar/friend guard/curious medicine系) |
| 30 | ダブルバトル専用ロジックを持つ技もChampionsデータにそのまま存在する(いたみわけ系/このゆびとまれ等) | Champions(第九世代仕様を継承) | reference/_authority_corpus_ch/moves_ch.json(ヤックン/ch/技・ローカル取得済) | 「必ず先制できる(優先度:+2)。自分と味方1体の位置を交代する。ダブルバトル用。」(このゆびとまれ系) | Y | grep該当8件を確認(ダブルバトル関連の技=いたみわけ系反動技2件＋このゆびとまれ系1件 等) |
| 31 | (一般世代の参考知識)シングルとの違い一般論: 2体に同時指示・味方を攻撃可能・範囲技は3/4倍(第4世代以降、第3世代は1/2倍)・全体対象技の対象一覧・ダブル専用特性(アロマベール/いやしのこころ/おもてなし等)一覧 | 第三〜九世代・一般(Champions固有ではない) | reference/_authority_corpus/rules/ダブルバトル.json(ポケモンWiki日本語版・ローカル取得2026-07-28) | 「攻撃範囲が広がる技は、ダメージが3/4(0.75倍)に減少する」「第三世代ではダメージが1/2(0.5倍)に減少するが、味方を巻き込む技には適用されない」 | N(Champions個別確認なし。ただしChampions自体が第九世代ベースであるためこの一般ルールが土台になっている可能性が高い=推定) | 全文はローカルJSONのraw_textに保存済み(このレポートには要点のみ抜粋)。Champions固有の上書きが無い限りこの一般仕様が適用されると推定されるが、Champions側での直接確認はできていない |
| 32 | ダブルバトルの対象選択操作(十字キー等でのポケモン選択方法)・画面上の左右表示仕様 | Champions | (WebSearch/WebFetchで直接記述を発見できず) | — | 不明 | 「取得失敗」。famitsu.com/article/202607/81710等の攻略記事は戦術紹介が中心でUI操作の詳細記述なし。今回の調査時間内では一次/二次ソースを特定できなかった |

---

## 取れなかった/矛盾した点

1. **UI仕様(対象選択の操作・左右表示)は出典を特定できなかった**。Serebiiのランクバトル/バトルメカニクスページは https://www.serebii.net/pokemonchampions/rankedbattle/ 含め全てHTTP 403(Cloudflare等のbot対策と思われる)で直接取得不可。公式サイトの https://www.pokemonchampions.jp/ja/rule/ も同様に403。WebSearch経由の二次情報でも見つからず「取得失敗」とする。
2. **ゲーム内ランクバトル(ラダー)のパーティ編成体数「6体」の直接公式引用が取れていない**。選出数(シングル3/ダブル4)は複数の二次ソースで一致確認できたが、「手持ちは何体から選ぶのか=6体」という数字そのものを公式文からverbatim引用できていない(攻略記事の文脈上6体で間違いないと推測されるが、原文の直接引用としては弱い)。
3. **「公式大会=TOD」と「ランクバトル/カジュアル=無条件引き分け」の関係が、日本語記事(gamewith)と英語VGCルール解説(victoryroad.pro)で言葉の対応が完全に一致しない**。gamewith.jpは「公式大会ではTODが採用される」と明言する一方、victoryroad.pro(VGC大会ルール専門サイト)には「TOD」という単語自体は出てこず、「時間切れ時の未決着はlate shows→sudden deathの順でタイブレーク」としか書かれていない。両者が同じ制度を指しているのか、それとも制度が異なる(TOD=残りポケモン数・HP判定、サドンデス=延長戦で決着をつける別制度)のかは、今回のソースだけでは断定できない。**要・追加調査**(公式のジャッジガイドまたはVGCルールブック原文の特定が必要)。
4. **種族値被り禁止(Species Clause)がゲーム内ランクバトル(ラダー)にも適用されるかは未確認**。victoryroad.proの記述はVGC公認大会のTeam rulesとしてのものであり、Championsのゲーム内ランクバトル告知(champions-news.pokemon-home.com)には同種族禁止に関する直接の文言が見当たらなかった。ゲーム内で同じポケモンを複数編成できるかどうかは仕様上そもそも「スカウトできるのは最終進化系のみ」等の制約もあり、実機確認が必要。
5. **回復技(回復ソース技)そのものの使用制限・引き分け防止のための技バランス変更(禁止技リスト等)は見つからなかった**。CLAUDE.md記載の「Championsは引き分け防止でPP・回復系を絞っている」という文脈はマスターデータ側の過去の知見(reference/_pokemon_additions.json等の周辺文脈)によるものと思われるが、今回のWeb調査では「PPの4段階統一(#21)」以上の具体的な「回復技だけを狙い撃ちした追加制限」の一次情報は確認できなかった。継続調査推奨。
6. **同速(素早さが同じ場合)の処理方式がChampionsで変更されたかどうかの直接情報は見つからなかった**(#28)。個体値固定化により同速が「増える」という影響分析はあるが、同速時の決定ロジック自体(乱数50/50か、決定論的か)についてChampions側で明言している一次/二次ソースは発見できず「明文なし(推定)」とした。
7. Serebii(www.serebii.net/pokemonchampions/配下)は今回すべてHTTP 403でアクセスできず、指定された `regulationm-b.shtml` / `regulationm-c.shtml` の直接引用ができていない。同等内容は公式(champions-news.pokemon-home.com)・Bulbapedia・victoryroad.pro・yakkun.comの相互確認で代替した。
