## 依頼1：外部URLを含んでいた箇所の訂正

外部URLを含む記述を、5グループにまとめて以下へ差し替える。

### 1. Championsのシングル／ダブル対応

> Pokémon Championsがシングルバトルとダブルバトルの両方を提供する点は、今回読んだローカルcorpusには同等の根拠がないため、**未確認（記憶）**とする。この事実をB064着手時期の確定根拠には使わない。

### 2. 第八世代の動的なすばやさ再評価

> 第八世代では、行動決定後にターン中のすばやさが変化した場合、そのターンから変更後のすばやさが適用される。[すばやさ.json:19](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/すばやさ.json:19)  
> ただし「各行動後に必ず全順序を再計算する」という内部アルゴリズム表現まではcorpusにないため、その断定は削除する。

### 3. 優先度・グラススライダー・トリックルーム

> 第八世代以降は、ターン途中の優先度変更が即座にそのターンの行動順へ影響する。[優先度.json:11](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/優先度.json:11)  
> グラススライダーは、行動前に使用者がグラスフィールドの効果を受けなくなると優先度`0`へ、逆に受けるようになると優先度`+1`へ即座に変わる。[グラススライダー.json:13](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/moves/グラススライダー.json:13)  
> トリックルームは「遅いポケモンから行動できる」場であり、優先度そのものを反転させるとは書かれていない。[トリックルーム.json:5](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/トリックルーム.json:5) 優先度が同じ場合にすばやさで順番を決めるという一般則とも一致する。[優先度.json:7](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/優先度.json:7)  
> ただし、**Champions版グラススライダーも同一仕様であることはローカルcorpusでは未確認（記憶）**とする。

### 4. せんせいのツメ

> せんせいのツメは毎ターン20%で発動し、同じ優先度の行動内で最初に行動できる。[せんせいのツメ.json:7](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/items/せんせいのツメ.json:7) 発動しても技の優先度自体は変わらず、発動判定はターン最初の行動決定時に行われる。[せんせいのツメ.json:12](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/items/せんせいのツメ.json:12)

### 5. おもかげやどし

> おもかげやどしは、オーガポンがテラスタルしたときに変化して得る特性であり、特性変化時またはその特性で場に出たとき、仮面に応じた能力を1段階上げる。[おもかげやどし.json:8](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/abilities/おもかげやどし.json:8) 場に出るたび1回だけ発動し、ひんしでテラスタルが解除されると元の特性へ戻る。[おもかげやどし.json:12](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/abilities/おもかげやどし.json:12)

## 依頼2：途中交代・ひんし・新規入場とActionIntent

### 結論

`ActionIntent`はスロットではなく、**ターンの行動選択時に場にいた個体**へ結び付ける。

途中でその個体が交代またはひんしになった場合、その個体の未実行Intentはキャンセルする。交代先・死に出し先には同じターンの新しいIntentを生成せず、元のIntentも引き継がせない。

したがって`action_reorder`は、現在場にいる個体からIntentを作り直す処理ではない。既存の`pending ActionIntent`から「所有者がまだ同じ在場期間で生存しているもの」だけを再評価するschedulerとする。

### corpus上の根拠

通常の交代、技・道具・特性による交代については、交代して出されたポケモンは次のターンまで行動できないという共通則が明記されている。[ポケモンチェンジ.json:7](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/ポケモンチェンジ.json:7)

ひんし交代はこの一般文の例外扱いだが、第八世代以降は「ひんしになったターンが終了する直前」に次のポケモンを繰り出す。そのため、死に出し個体へ同ターンの通常行動機会は発生しない。[ひんし.json:20](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/ひんし.json:20)

個別例も整合する。

- とんぼがえり後は、交代先が出てから「まだ行動していない他のポケモン」が行動する。交代先が行動者へ加わるとは書かれていない。[とんぼがえり.json:19](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/moves/とんぼがえり.json:19)
- ききかいひの所有者が未行動でも、発動すれば行動せず交代する。[ききかいひ.json:12](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/abilities/ききかいひ.json:12)
- だっしゅつパックで一度退場し、そのターン中に同じ個体が場へ戻った特殊例でも「行動はできない」と明記されている。[だっしゅつパック.json:11](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/items/だっしゅつパック.json:11)

以上から、少なくとも第八・第九世代本編では「途中入場した個体はそのターンのActionIntentを持たない」を設計規則にできる。**Championsでも完全に同一であることは、今回のローカルcorpusでは未確認**である。

### ActionIntentの失効規則

Intentには少なくとも次の所有情報が必要になる。

- `turnId`
- `actionId`
- `actorId`
- `presenceEpoch`または`entryId`
- `status: pending / executing / consumed / cancelled`
- キャンセル理由：`switched_out`、`fainted`など

`SlotId`だけで所有者を判定してはいけない。同じスロットへ別個体が入った場合や、同じ個体がそのターン中に戻った場合でも、`presenceEpoch`が変わるため旧Intentは復活しない。

処理規則は次のとおり。

1. 行動者が交代・ひんしになった時点で、その個体の`pending` Intentを`cancelled`にする。
2. 交代先にはIntentを追加しない。
3. 交代先の設置技着弾・登場特性など、入場カスケードは通常どおり処理する。
4. 入場効果で天候・フィールド・すばやさ等が変化した場合、その影響は残存する他個体のIntentを並べ直す際に読む。
5. カスケードがすべて本流へ戻った後、`action_reorder`を1回だけ呼ぶ。
6. 第八世代以降のひんし交代はターン終了側で処理し、死に出し後に通常の`action_reorder`へ戻さない。

ターン途中の交代後に対象や登場特性を再評価する必要がある点は、既存のフェーズ設計にも明記されている。[設計_フェーズ語彙v3_2026-07-26.md:36](/Users/masamichi/Documents/ポケモンDB/設計_フェーズ語彙v3_2026-07-26.md:36) とんぼがえり等は`switch_out → switch_in → entry_hazard → entry_ability_call`を呼ぶ設計になっている。[設計_フェーズ語彙v3_2026-07-26.md:109](/Users/masamichi/Documents/ポケモンDB/設計_フェーズ語彙v3_2026-07-26.md:109)

### 5つの安全装置との噛み合わせ

| 安全装置 | この設計での扱い |
|---|---|
| ① `origin` | Intent失効、交代要求、入場、設置技、登場特性まで同じ`actionId/cascadeId`を引き回す。新規入場を新しいターン行動選択と誤認しない。 |
| ② `maxDepth` | `設置技→能力低下→だっしゅつパック→再入場→設置技…`のような交代連鎖を深さ上限で止める。打切り後も本流へ戻す。[割り込み規律:28](/Users/masamichi/Documents/ポケモンDB/設計_割り込みと分岐の規律_2026-07-26.md:28) |
| ③ 決定的順序 | 同時交代・同時ひんし・複数の入場効果を必ず決定的に解決する。ただし順序規則はEvent別に持つ必要がある。例えば複数のだっしゅつパックは補正なしのすばやさで比較し、トリックルームを除外するため、文書の汎用的な「トリックルームなら逆転」をそのまま適用すると誤る。[だっしゅつパック.json:11](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/items/だっしゅつパック.json:11) |
| ④ 再入禁止 | キーを単なる`Handler × actorId`にせず、`Handler × actorId × presenceEpoch × eventId`とする。同じ入場Event内の二重発火は止めつつ、実際に退場して再入場した個体の登場特性まで誤って止めない。旧ActionIntentは`turnId/actionId`側で失効したままにする。[割り込み規律:40](/Users/masamichi/Documents/ポケモンDB/設計_割り込みと分岐の規律_2026-07-26.md:40) |
| ⑤ 本流復帰 | Handlerは交代やターン終了を直接実行せず、`switch_required`または`faint_required`を立てる。本流が交代Section・ひんしSectionを処理し、全カスケードの復帰後にだけ`action_reorder`へ進む。[割り込み規律:45](/Users/masamichi/Documents/ポケモンDB/設計_割り込みと分岐の規律_2026-07-26.md:45) |

特に重要なのは、**再入禁止とActionIntent失効は別問題**という点である。再入場した個体の登場特性は新しい`presenceEpoch`として発火できる一方、その個体が以前持っていた未実行Intentは復活させない。

### 最低限必要な確認ケース

1. とんぼがえりで交代した後、交代先は動かず、他の未行動者だけが続行する。
2. 未行動者がききかいひで退場した場合、旧Intentがキャンセルされ、交代先にも移らない。
3. だっしゅつパックで退場した個体が同ターン中に戻っても、旧Intentが復活しない。
4. 未行動者がひんしになった場合、Intentを失効させ、残存者の行動後にターン終了の死に出しへ進む。
5. 交代先が設置技でひんしになり再交代しても、各入場処理は発火するがActionIntentは増えない。

ファイル変更・コード変更は行っていない。