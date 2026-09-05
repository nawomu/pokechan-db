## 0. 守るルールと前提

- 今回は設計・所見のみで、コード・JSON・Markdownを含めファイル変更は行っていない。ブリーフの「③の実装は凍結中」「コードを書かない」に従った。[review/_codex_trial_brief_2026-09-05.md:3](/Users/masamichi/Documents/ポケモンDB/review/_codex_trial_brief_2026-09-05.md:3)
- 正式なフェーズキーは英語スラグであり、P/S番号は表示順の飾りとして扱う。[設計_フェーズ語彙v3_2026-07-26.md:52](/Users/masamichi/Documents/ポケモンDB/設計_フェーズ語彙v3_2026-07-26.md:52)
- 設計判断は「状態×変化タイミング」「can→modify→do→react」「困ったらフェーズを足す」に従う。[設計_バトルエンジン原理_2026-07-26.md:10](/Users/masamichi/Documents/ポケモンDB/設計_バトルエンジン原理_2026-07-26.md:10) [設計_フェーズ語彙v3_2026-07-26.md:170](/Users/masamichi/Documents/ポケモンDB/設計_フェーズ語彙v3_2026-07-26.md:170)
- 新ルールは、権威確認→語彙・分類→増分実装→全テスト、の順を崩さない。[設計_バトルエンジン原理_2026-07-26.md:171](/Users/masamichi/Documents/ポケモンDB/設計_バトルエンジン原理_2026-07-26.md:171)

## 1. 現在地

ブリーフ記載どおり、現在の実体は次の行にある。

- `movePriority`: [real_battle_simulator.html:2278](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2278)
- `decideOrder`: [real_battle_simulator.html:2323](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2323)
- `runTurn`からの唯一の呼出し: [real_battle_simulator.html:7017](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:7017)
- 固定された2要素の`order`を順に回すループ: [real_battle_simulator.html:7018](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:7018)–[real_battle_simulator.html:7044](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:7044)

バックログ本文の旧行番号`L6883`ではなく、現物の`L7017`が正しい。

---

## 2. 課題

### 課題A: B149「action_reorder」+ B150「priority_event」

#### 1. 何が問題か

##### B149: 行動キューが「ターン開始時の固定配列」になっている

`decideOrder()`はライブな`movePriority()`と`effectiveSpeed()`を呼ぶが、呼ばれるのはターン開始時の1回だけである。その結果を`order`配列に焼き込み、その後は状態変化があっても再評価しない。[real_battle_simulator.html:2323](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2323) [real_battle_simulator.html:7017](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:7017)

これは次の原理に反する。

- 行動ループはP06〜P13を行動者数だけ繰り返す構造である。[設計_フェーズ語彙v3_2026-07-26.md:20](/Users/masamichi/Documents/ポケモンDB/設計_フェーズ語彙v3_2026-07-26.md:20)
- 第八世代以降はターン途中のすばやさ変更が同じターンの行動順に反映される。[reference/_authority_corpus/rules/すばやさ.json:19](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/すばやさ.json:19)
- 第八世代以降は優先度の変更も即座に同じターンへ反映される。[reference/_authority_corpus/rules/優先度.json:11](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/優先度.json:11)

現エンジンはシングル専用で、最初の1体が動いた後は未行動者が最大1体しかいない。このため、すばやさ再評価の差は現在のシングルではほとんど観測できない。しかし、公式のChampionsはシングルとダブルの両形式を提供しており、ダブルでは未行動者が複数残るため必須になる。[『Pokémon Champions』公式「バトルについて」](https://www.pokemonchampions.jp/ja/battle/) 現コードが1陣営1個体固定なのも確認できる。[real_battle_simulator.html:1099](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:1099)

##### B149先行設計の「実行技へ差し替えてから優先度を決める」は一括採用できない

先行A1は、アンコール・あばれ・こだわりロック等で最終的に出る技を、行動順決定より前に解決する案を出している。[reference/_phase_design_a1_reorder.json:35](/Users/masamichi/Documents/ポケモンDB/reference/_phase_design_a1_reorder.json:35)

しかし、少なくともアンコールについては権威記述が反対である。

> 行動順決定後にアンコールで技が置き換えられても、優先度は変わらない。

さらに「優先度+1の技を選んだ後にアンコールされ、優先度0の技を出す場合でも、選択した技の+1で行動する」という具体例まである。[reference/_authority_corpus/rules/優先度.json:11](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/優先度.json:11)

したがって、行動データは最低でも次の2つを分ける必要がある。

```text
orderingMove  = 行動順決定に使う技
executionMove = 実際に実行される技
```

アンコールについて`executionMove`の優先度で並べ直すと、権威仕様を壊す。あばれ・溜め解放・こだわりロック・わるあがきも一括処理せず、各機構の権威を確認して`orderingMove`を決める必要がある。

##### B150: 優先度の計算・同優先度内割込み・使用時判定が混在している

現`movePriority()`には次が直書きされている。

- いたずらごころ: [real_battle_simulator.html:2280](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2280)
- はやてのつばさ: [real_battle_simulator.html:2282](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2282)
- グラススライダー型の条件付き優先: [real_battle_simulator.html:2285](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2285)

条件付き優先が不成立の場合、`return 0`で終了するため、それ以前に加算された別Handlerの結果を消す構造になっている。[real_battle_simulator.html:2293](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2293)

さらに、ファストガード判定は`movePriority(mv)`を行動者なしで呼ぶため、いたずらごころ・はやてのつばさによる補正を見られない。[real_battle_simulator.html:3729](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:3729) 同じ「有効優先度」が呼出し箇所ごとに別の意味になっている。

一方、せんせいのツメは`decideOrder()`内で直接乱数を引く。[real_battle_simulator.html:2329](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2329) このまま`decideOrder()`を各行動後に呼び直すと、同じターンにせんせいのツメを何度も抽選する新しいバグが生じる。

---

#### 2. 足すフェーズ・イベント

表示番号は仮置きで、正式キーはスラグとする。

| 表示位置 | 正式キー | 役割 |
|---|---|---|
| P05内部 | `priority_modify` | 技の有効優先度を計算する、乱数なしの補正Event |
| P00とP01aの間（仮`P00t`） | `order_modifier_snapshot` | せんせいのツメ等、ターン中に再抽選・再取得しない行動順補正を1回だけ確定 |
| 1行動のP06〜P13系と全カスケード終了後、次のP06a前（仮`P13h`） | `action_reorder` | 未行動のActionIntentから次の1件を選び直す |
| P13b等から呼ばれる共有Section（仮`S14`） | `action_queue_override` | おさきにどうぞ・さきおくり等がキューに明示的な指示を書き込む |

`S14`としたのは、バックログB152が`S13 substitute_guard`を予約しているためである。[review/_battle_rework_backlog_2026-09-05.md:249](/Users/masamichi/Documents/ポケモンDB/review/_battle_rework_backlog_2026-09-05.md:249)

##### `priority_modify`

入力:

```text
{
  actionId,
  actorId,
  orderingMove,
  actorState,
  fieldState,
  ruleset
}
```

出力:

```text
{
  basePriority,
  contributions: [{sourceId, delta, reason}],
  effectivePriority
}
```

Handler購読者:

- 特性: いたずらごころ、はやてのつばさ、ヒーリングシフト
- 技: グラススライダーの条件付き`+1`
- 将来の特性・場効果

利用側:

- `action_reorder`
- ファストガード・サイコフィールド・じょおうのいげん系
- いたずらごころのあくタイプ無効
- 先攻理由ログ

重要なのは、全Handlerが「成立なら寄与を返す、不成立なら寄与0」であり、他Handlerや`basePriority`を上書きしないことである。

##### `order_modifier_snapshot`

これは優先度を変えない。`priority_modify`と混ぜない。

出力例:

```text
{
  actionId,
  orderBand: "first" | "normal" | "last",
  activated: ["quick-draw", "quick-claw"],
  suppresses: ["lagging-tail"],
  lifetime: "per_turn"
}
```

対象:

- 最速側: せんせいのツメ、クイックドロウ、イバンのみ
- 最遅側: あとだし、きんしのちから、こうこうのしっぽ、まんぷくおこう

これらは優先度そのものを変えず、同じ優先度内だけを動かす。[reference/_authority_corpus/rules/優先度.json:14](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/優先度.json:14)

クイックドロウとせんせいのツメの44%合成、クイックドロウ成功時のイバンのみ不発、最速効果による最遅効果の打消しもこのEventの解決規則に置く。[reference/_authority_corpus/abilities/クイックドロウ.json:11](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/abilities/クイックドロウ.json:11)

##### `action_reorder`

固定配列を`for`で回すのでなく、概念上は次になる。

```text
while (未行動ActionIntentがある) {
  next = action_reorder(pendingActions, liveBattleState)
  execute(next)
}
```

入力:

```text
{
  pendingActions,
  liveBattleState,
  orderModifierSnapshots,
  queueOverrides,
  rngState,
  origin
}
```

出力:

```text
{
  nextActionId,
  evaluatedOrderKeys,
  remainingActions
}
```

通常時の比較順:

1. `action_queue_override`の「直後に行動」
2. `priority_modify`の有効優先度
3. 保存済み`orderBand`（first/normal/last）
4. ライブな実効すばやさ
5. トリックルームによる比較方向
6. 同値時の正準タイブレーク

おさきにどうぞ・さきおくりは優先度を無視する一方、優先度情報そのものは失わないため、通常の優先度補正と別のキュー指示にする。[reference/_authority_corpus/rules/優先度.json:13](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/優先度.json:13)

同速時の乱数を再評価ごとに引き直すか、ターン中の既決タイブレークを保持するかは、Championsの実機根拠が未確認なので契約値`tiePolicy`として保留する。

##### `action_queue_override`

入力:

```text
{
  sourceActionId,
  targetActionId,
  mode: "act-next" | "act-last",
  origin
}
```

出力:

```text
{
  targetActionId,
  directive,
  consumed: false,
  lifetime: "per_turn"
}
```

- おさきにどうぞ: `act-next`
- さきおくり: `act-last`
- 対象が既に行動済み・ひんし・交代済みなら`can`で失敗
- 消費後は再利用しない
- 分岐・割込みの5安全装置を適用する。[設計_割り込みと分岐の規律_2026-07-26.md:21](/Users/masamichi/Documents/ポケモンDB/設計_割り込みと分岐の規律_2026-07-26.md:21)

---

#### 3. 実機の根拠

- 第八世代ではターン途中のすばやさ変更が即時反映される。[reference/_authority_corpus/rules/すばやさ.json:19](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/すばやさ.json:19) 代表例は、ダブルで先においかぜを使い、まだ行動していない味方が相手を追い越すケースである。第八世代の実機研究でも、各行動後に順番を再計算すると報告されている。[Sword & Shield Battle Mechanics Research](https://www.smogon.com/forums/threads/sword-shield-battle-mechanics-research.3655528/)
- 優先度も第八世代以降は動的で、グラスフィールドの消滅・上書きによって、未行動のグラススライダーが`+1`から`0`へ移ることがある。[reference/_authority_corpus/rules/優先度.json:11](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/優先度.json:11) [Bulbapedia “Priority”](https://bulbapedia.bulbagarden.net/wiki/Move_priority)
- Champions版グラススライダーの説明も、グラスフィールド時に優先度`+1`となっている。[Bulbapedia “Grassy Glide”](https://bulbapedia.bulbagarden.net/wiki/Grassy_Glide)
- せんせいのツメ・クイックドロウ・イバンのみは、すばやさやトリックルームに関係なく「同じ優先度内の最速枠」になるが、優先度自体は変えない。[reference/_authority_corpus/rules/すばやさ.json:19](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/rules/すばやさ.json:19)
- Championsのクイックドロウは「30%で同じ優先度の中で最初」と明記されている。[reference/_authority_corpus/abilities/クイックドロウ.json:8](/Users/masamichi/Documents/ポケモンDB/reference/_authority_corpus/abilities/クイックドロウ.json:8)
- Championsのせんせいのツメは徹底攻略でも20%とされている。[ポケモン徹底攻略「せんせいのツメ」](https://yakkun.com/ch/theory/search/?author=&item_s=74&move1_s=&move2_s=&move3_s=&move4_s=&pokemon_s=0&role1=0&search=1&seikaku_s=0&sort=old&tera_type_s=19&tokusei_s=0&type1_s=&type2_s=&user=0&word=)
- トリックルームは優先度を逆転せず、同じ優先度内のすばやさ比較方向だけを逆転する。[Bulbapedia “Priority”](https://bulbapedia.bulbagarden.net/wiki/Move_priority)

Champions固有の「ターン途中のすばやさ・優先度変更を即時反映するか」は、今回確認できた公式ページ・ローカル権威コーパスには明記がなかった。第八・第九世代と同じと断定してはいけない。

---

#### 4. 既存実装との差分

| 機構 | 現在 | 新設後 |
|---|---|---|
| いたずらごころ | `movePriority()`内の名前if。[real_battle_simulator.html:2280](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2280) | `priority_modify`の特性Handler |
| はやてのつばさ | 同関数内の名前if。[real_battle_simulator.html:2282](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2282) | HP・技タイプを読む特性Handler |
| グラススライダー | `kind==='条件付き優先'`の専用return。[real_battle_simulator.html:2285](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2285) | 技由来`priority_modify` Handler。`ground_check`を購読 |
| ヒーリングシフト | 未実装 | 回復技タグを読む`priority_modify` Handler |
| せんせいのツメ | `decideOrder()`内で毎回直接抽選。[real_battle_simulator.html:2329](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2329) | `order_modifier_snapshot`でターンに1回確定 |
| クイックドロウ等 | 未実装 | 同じsnapshot Event内で相互作用込み解決 |
| トリックルーム | `decideOrder()`内の条件演算子。[real_battle_simulator.html:2341](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:2341) | `speed_order`比較方向を変える持続Handler。設置時登録・失効時解除 |
| トリックルーム設置・失効 | 技効果ifとターン終了ifに分散。[real_battle_simulator.html:5213](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:5213) [real_battle_simulator.html:7515](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:7515) | `field_set.do`と`end_turn_field_count`から持続Handlerを登録・解除 |
| アンコールによる技差替え | 行動ループ内で実行技を差替え。[real_battle_simulator.html:7063](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:7063) | 実行技差替えは維持。行動順用`orderingMove`は権威どおり保持 |

---

#### 5. リスク・やらないこと・🙋阿部さん判断

主なリスク:

- `action_reorder`のたびにせんせいのツメ等を再抽選する。
- 同速乱数を不用意に引き直し、オンラインの鏡写しやundoを壊す。
- `orderingMove`と`executionMove`を同一視し、アンコール仕様を壊す。
- おさきにどうぞ等と通常優先度を同じ数値へ潰し、ファストガード判定まで変える。
- 行動中の交代・ひんし・新規入場後に、古い個体のActionIntentを残す。
- `continue`が多数ある現for-loopへ末尾処理を足し、行動不能時だけ再評価を飛ばす。
- 優先度ログと実際の比較キーが別計算になり、表示が嘘になる。

やらないこと:

- 今回のコード実装。
- `master/*.json`や生成物の直接編集。
- `decideOrder()`を単にループ末尾でもう一度呼ぶだけの修正。
- B149とダブルUIを同時に一括実装すること。
- Championsの動的再評価仕様を、現行世代と同じだと確定扱いすること。

必要なテスト:

1. 4アクターの純粋schedulerテストで、おいかぜ後に未行動の味方が繰り上がる。
2. グラスフィールド消滅後、未行動グラススライダーの優先度が`+1→0`になる。
3. せんせいのツメ等の抽選回数がActionIntentごとに1回。
4. せんせいのツメ発動でもファストガード対象にならない。
5. いたずらごころ・はやてのつばさで上がった技は、ファストガード判定でも同じ有効優先度を読む。
6. アンコール後に実行技が変わっても、選択技の優先度を保持する。
7. おさきにどうぞ・さきおくりと動的再評価の競合。
8. トリックルーム開始・解除直後の残り行動者再評価。
9. 同一シードの2ブラウザでActionIntent選択列・乱数消費列・ログが完全一致。
10. シングルの既存出力が変わらないこと。ただしこれは回帰テストであり、B149の成立証明にはしない。

🙋阿部さん判断:

1. Champions固有仕様が見つかるまで、動的再評価を第八・第九世代準拠で暫定実装してよいか。それとも確認まで実装を止めるか。
2. `order_modifier_snapshot`の表示順を、権威上のアナウンス順に合わせてP01交代より前へ置くか。現語彙のP05b位置を維持するか。
3. ③の最初の公開マイルストーンにダブルを含めるか。インターフェースは最初から複数アクター対応にすべきだが、UI・完全実装の時期は製品判断である。
4. 同速時の再評価でタイブレークを保持するか再抽選するかは、好みではなく実機確認事項。根拠が取れるまで未確認とする。

---

#### 6. 先行設計A1/A2への所見

##### `_phase_design_a1_reorder.json`

同意:

- `action_reorder`をP05/P05bと分離する判断。
- 1行動の解決後、次の行動前に置く判断。
- おさきにどうぞ・さきおくりのため、行動キューを一級状態にする必要があるという指摘。
- Champions固有の再評価仕様を未確認のまま残した点。[reference/_phase_design_a1_reorder.json:85](/Users/masamichi/Documents/ポケモンDB/reference/_phase_design_a1_reorder.json:85)

不同意・修正必要:

- `movePriority()`と`effectiveSpeed()`を毎回そのまま呼ぶ案は、せんせいのツメ乱数まで再抽選する。動的値とターン開始時snapshotを分離すべき。
- 自動再評価と、おさきにどうぞ等の明示的なキュー書換えは、同じ`action_reorder`内部へ混在させず、「書込みSection」と「参照scheduler」に分けるべき。[reference/_phase_design_a1_reorder.json:62](/Users/masamichi/Documents/ポケモンDB/reference/_phase_design_a1_reorder.json:62)
- 「実際に出る技へ差し替えてから優先度を決める」というB158の一般化は、アンコールについて権威に反する。B158は単独バグ票ではなく、各機構の`orderingMove`規則を再監査する票へ変更すべき。
- テスト①の「先攻が自分のすばやさを下げる」、②の「まひ後のからげんき」は、未行動者が1体しかいないためaction_reorderを検証しない。最低4アクターの純粋schedulerテストが必要。

##### `_phase_design_a2_priority_event.json`

同意:

- `priority_modify`をP05内の型A補正Eventとする。
- 最終値を`base + contributions`にする。
- せんせいのツメ等をP05bの別レーンに分離する。
- クイックドロウ+せんせいのツメの44%や、イバンのみとの相互排他を明示する。
- じんらいは固定優先度`+1`で、条件はP06bの成功可否とする。[reference/_phase_design_a2_priority_event.json:58](/Users/masamichi/Documents/ポケモンDB/reference/_phase_design_a2_priority_event.json:58)

修正必要:

- 単純な`Σdelta`だけでなく、各寄与の`sourceId`と理由を残す。将来「設定値」「加算」「無効化」が出た場合、黙って加算せず競合を検出する。
- `protectBlocks()`など、全購読者へ行動者コンテキストを渡す設計が必要。
- P05bは動的再評価のたびに発火させず、抽選結果をターン状態へ保存する。
- A2作成時の「じんらい未収録」は現在は古い。`master/moves.json`に存在し、`priority:1`・`champions:false`である。[master/moves.json:53620](/Users/masamichi/Documents/ポケモンDB/master/moves.json:53620)
- B155のヒーリングシフトは技ではなく特性であり、バックログ末尾でも訂正済み。[review/_battle_rework_backlog_2026-09-05.md:456](/Users/masamichi/Documents/ポケモンDB/review/_battle_rework_backlog_2026-09-05.md:456) マスターにも特性として存在する。[master/abilities.json:7244](/Users/masamichi/Documents/ポケモンDB/master/abilities.json:7244)

---

### 課題B: 並び順と§5-2/3/7への所見

#### §4-2の順序案

結論は、**「§1-Aの14件→骨格6件」には不同意**。骨格を先にする。ただし6件をまとめて大改造するのではなく、依存順の縦切りで1本ずつ通す。

憲法は「語彙・分類を先に、エンジンを後に」と明記している。[設計_バトルエンジン原理_2026-07-26.md:176](/Users/masamichi/Documents/ポケモンDB/設計_バトルエンジン原理_2026-07-26.md:176) 14件を現行の名前ifへ先に足すと、B149〜B154で再実装することになる。

推奨順:

| 順 | 対象 | 理由 |
|---|---|---|
| 0 | 現挙動characterizationテスト、Champions未確認事項の台帳化 | リファクタ前の比較基準 |
| 1 | dispatcher安全装置 | `origin`、深さ、再入禁止、決定的順序、本流復帰を先に用意。[設計_割り込みと分岐の規律_2026-07-26.md:59](/Users/masamichi/Documents/ポケモンDB/設計_割り込みと分岐の規律_2026-07-26.md:59) |
| 2 | B154 `ground_check` | B150のグラススライダーが接地判定を必要とする |
| 3 | B150 `priority_modify` | B149 schedulerが呼ぶ純粋Queryを先に確立 |
| 4 | B149 `action_reorder` | 固定for-loopをActionIntent schedulerへ移す |
| 5 | B153のうちトリックルーム・すばやさ関連 | B149へ持続Handlerを接続する最初の縦切り |
| 6 | B151→B152 | can段を正典化してから、みがわりguardを載せる |
| 7 | B153の残り持続状態 | 一括移行せず状態ごとに増分 |
| 8 | §1-A B001〜B014 | 新しい箱・Query・Handlerへ実装 |
| 9 | B019/B034/B155/B156等 | 骨格依存票。ただしB158は上記反証を反映して再定義 |
| 10 | 高impactのChampions票 | 新骨格で実装 |
| 11 | B064とダブル依存票 | 下記の製品判断に従う |

骨格だけ長期間作り続けるのも危険なので、B150ならいたずらごころ、B149ならおいかぜの4アクター試験、B151なら具体的なcan票、というように、各骨格へ1件の実機能を載せて縦切りで緑にする。

#### §5-2: B064 ダブル基本構造の着手時期

事実で決まる部分:

- Champions公式はシングルとダブルを提供している。[公式サイト](https://www.pokemonchampions.jp/ja/battle/)
- 現エンジンは`self`/`opp`各1個体で、`env.doubleBattle`は存在するが構造は1対1のままである。[real_battle_simulator.html:1099](/Users/masamichi/Documents/ポケモンDB/real_battle_simulator.html:1099)
- 少なくとも9票がB064へ依存している。[review/_battle_rework_backlog_2026-09-05.md:372](/Users/masamichi/Documents/ポケモンDB/review/_battle_rework_backlog_2026-09-05.md:372)
- 憲法は、ダブルを別エンジンにせず、フェーズと対象選択の追加で扱う方針である。[設計_バトルエンジン原理_2026-07-26.md:117](/Users/masamichi/Documents/ポケモンDB/設計_バトルエンジン原理_2026-07-26.md:117)

所見:

- `ActorId`、`SideId`、`SlotId`、`ActionIntent[]`、複数対象集合というインターフェース設計は、B149着手時からダブル対応にする。
- ただしダブルのUI・対象選択・4体の全実装を、骨格より先に始めるべきではない。まず純粋schedulerとシングル互換を緑にし、その直後をB064の着手点とする。
- つまり「設計上は今すぐ織り込む／完全実装は骨格の最初の縦切りが通った後」が妥当。

🙋阿部さん判断:

- ③の最初の公開版でダブルを遊べる状態まで含めるか。
- 含めない場合でも、内部APIを複数アクター対応にする追加コストを初期投資として認めるか。

#### §5-3: 種別の粒度

事実で決まる部分:

「特性103件」という分類だけでは、実装箇所・依存・テスト単位が分からない。憲法上の実装単位は「機構名」ではなく「いつ・何を読み書きするか・can/modify/do/reactのどこか」である。[設計_フェーズ語彙v3_2026-07-26.md:245](/Users/masamichi/Documents/ポケモンDB/設計_フェーズ語彙v3_2026-07-26.md:245)

実装計画には、少なくとも次の列が必要。

- `source_kind`: 特性／技／持ち物／ルール
- `phase_slug`
- `stage`: can／modify／do／react／query
- `mechanism_family`: 優先度、すばやさ、ダメージ、状態異常、交代など
- `state_read`
- `state_written`
- `lifetime`
- `single/double/both`
- `champions`
- `depends_on`
- `authority_status`
- `implementation_cluster`

所見:

- 集計・人間向け一覧では現行の大分類を残す。
- 実装担当へ渡すビューでは上の軸を追加し、`implementation_cluster`でまとめる。
- 「攻撃時参照」「ターン終了」だけに一段階で再分類するより、独立した複数軸を持つ方が同じ票を複数フェーズへ正しく配置できる。

🙋阿部さん判断:

- 人間向けバックログに全列を表示するか、詳細ビューだけに出すか。これは事実ではなく読みやすさの選択。

#### §5-7: おもかげやどしの切り分け

事実で決まる部分:

- おもかげやどしは、オーガポンがテラスタルした時に取得し、仮面に応じた能力が上がる特性である。[review/_phase_assign_draft_new11_2026-09-05.json:54](/Users/masamichi/Documents/ポケモンDB/review/_phase_assign_draft_new11_2026-09-05.json:54) [Bulbapedia “Embody Aspect”](https://bulbapedia.bulbagarden.net/wiki/Embody_Aspect)
- マスターでは`champions:false`である。[master/abilities.json:653](/Users/masamichi/Documents/ポケモンDB/master/abilities.json:653)
- プロジェクトはテラスタルを意図的不実装としている。[設計_バトルエンジン原理_2026-07-26.md:431](/Users/masamichi/Documents/ポケモンDB/設計_バトルエンジン原理_2026-07-26.md:431)
- 通常のオーガポンに「仮面別ランク上昇だけ」が独立して発動するわけではない。テラスタルによる特性変化がトリガーである。

所見:

- B161を「テラスタルを除いた基本ランク上昇」として現行バトルへ部分実装するのは誤り。
- 現在は`対象外（テラスタル依存・休眠）`として保持する。
- 将来用の設計だけ行うなら、`ability_change.react → rank_change`として宣言を作り、ChampionsルールセットではHandler登録を省略する。
- 草案の説明に併記された「おめん所持時の技威力1.2倍」は特性B161ではなく、持ち物由来のダメージ補正として別チケットに分離するべき。[review/_phase_assign_draft_new11_2026-09-05.json:55](/Users/masamichi/Documents/ポケモンDB/review/_phase_assign_draft_new11_2026-09-05.json:55)

🙋阿部さん判断:

- 将来用の休眠Handler設計を③の今作るか、テラスタル採用時まで完全に保留するか。
- ラボでテラスタル済みフォームを直接選べる将来仕様を持たせるか。現時点では未確認。

## 3. 出力形式

以上が課題A・課題Bの回答本文。ファイル変更・コード変更・git操作は行っていない。

## 自己申告

読んだファイル:

- `CLAUDE.md` 全文
- `review/_codex_trial_brief_2026-09-05.md` 全文
- `設計_バトルエンジン原理_2026-07-26.md` 全文
- `設計_フェーズ語彙v3_2026-07-26.md` 全文
- `設計_割り込みと分岐の規律_2026-07-26.md` 全文
- `review/_battle_rework_backlog_2026-09-05.md` 全文
- `reference/_phase_design_a1_reorder.json` 全文
- `reference/_phase_design_a2_priority_event.json` 全文
- `reference/_authority_corpus/rules/すばやさ.json` 関連節
- `reference/_authority_corpus/rules/優先度.json` 関連節
- `reference/_authority_corpus/abilities/クイックドロウ.json` 関連節
- `reference/_authority_corpus/moves/じんらい.json` 関連節
- `reference/_battle_spec.json`の`action_reorder`関連箇所
- `review/_phase_assign_draft_new11_2026-09-05.json`のおもかげやどし関連箇所
- `master/abilities.json`、`master/items.json`、`master/moves.json`の関係項目
- `real_battle_simulator.html`の状態定義、優先度、すばやさ、行動順、行動ループ、トリックルーム関連箇所

読めなかった・未確認:

- Champions固有の動的行動順再評価を直接説明する公式資料は見つからなかった。
- Championsで同速時の再評価乱数を保持するか再抽選するかは未確認。
- あばれ・溜め解放・こだわりロック・わるあがきの`orderingMove`規則は、アンコールのような直接記述を今回すべて取得できていない。
- `_phase_design_a3_skip_can.json`、`_phase_design_a4_persistent.json`はバックログ要約と関係箇所のみ確認し、全文精査はしていない。
- agmsg inbox監視は、実行環境がPIDファイルを作成できず開始できなかったため、Fableからの追加メッセージは未確認。

設計提案・推測として書いた箇所:

- `P00t`、`P13h`、`S14`という表示番号は仮称。
- B064の完全実装時期は設計上の推奨であり、製品判断ではない。
- Championsの動的再評価は未確認のため、現行世代準拠と断定していない。