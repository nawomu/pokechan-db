# 技ターン検証テスト環境 — 設計方針

最終更新: 2026-06-08 JST / 担当: 設計統合

> 目的: 技が `effects`(説明文の元データ)通りに、**実際のターンの流れ**で正しく動くかを、機械で合否判定できる環境を作る。説明文(`description`)は `effects` を訳すだけ。だから `effects` がシムで意図通り動くかを検証できれば、説明文の正しさも下支えできる。
>
> 進め方の原則(阿部さん方針): **まず追加効果なしの純粋な攻撃技から始め、だんだんエフェクトを増やす**。左→右→左…のマルチターンで確認。常にフェーズで考える。

---

## 0. 用語と前提(SSOTの確認)

- **SSOT**: ポケモン/技データは `pokechan_data.js`(`POKEMON_LIST`/`DATA`、`WAZA_MAP`、`NATURES`、`TYPES`)。持ち物は `items_database.js`(`ITEMS_DATABASE`)。本DBが正(記憶優先しない)。
- **シム本体**: `real_battle_simulator.html`(以下「sim」)。ターンエンジン・ダメージ計算・状態管理を**HTML内インライン `<script>`**で持つ。
- **effects**: `WAZA_MAP[key].battle_data.effects[]`。sim と説明文の二役。`{kind, target, value, prob, ...}`。
- **voiced ≠ complete**: カバー率(grepゼロ・全件voiced)は「データが揃っている」ことを意味しない。テストで「期待した状態変化が**本当に起きたか**」を見ないと隠れ取りこぼしは消えない。

確信度: 高(全て当該ファイルで確認)。

---

## 1. アーキ方針 — turn engine を Node から呼べる共通モジュールに切り出す

### 1.1 ねらい

**HTML(本番)とテストで同じターンエンジンのコードを共有する**。テスト用にロジックをコピーすると本番と乖離するので厳禁。sim の `<script>` から「純粋ロジック」を `turn-engine.js`(1ファイル)へ切り出し、HTML は `<script src="turn-engine.js">` で読む、Node テストは `require('./turn-engine.js')` で読む。

### 1.2 切り出し対象(エンジン解析の DOM依存度評価に基づく)

**そのまま移せる純粋ロジック関数(DOM非依存・移植難易度 低):**

| 関数 | 役割 | sim内の位置 |
|---|---|---|
| `calcDamage(atkSide, defSide, move)` | ダメージ計算(Q12固定小数・乱数16通り生成) | L1039 |
| `decideOrder(move1, move2)` | 行動順(優先度→実素早さ→同速ランダム) | L1371 |
| `effectiveSpeed(st)` | 実素早さ(トリックルーム反映) | L1360 |
| `phaseHitCheck(move, atk, def)` | 命中判定(必中`ignores_accuracy`→命中率ロール) | L1444 |
| `realStat(st, key)` | 実数値(Lv50・個体値31固定・能力P1:1) | L1303 |
| `rankedStat(st, key, opts)` | ランク補正後能力値 | L1312 |
| `phaseApplyEffects(atkSide, defSide, move)` | 攻撃後の追加効果(現状=状態異常付与のみ) | L1484 |
| `phaseSlipFor(s)` / `phaseEndOfTurnSlip()` | ターン終了スリップ(やけど/どく/もうどく/砂嵐) | L1511 / L1546 |

**切り出すべき定数:**
- `PHASES`(L1341)、`STAT_KEYS`/ラベル、`NATURES`参照、`TYPE_CHART`/タイプ相性表、Q12倍率(`6144`=×1.5、`3072`=×0.75)と `pokeRound()`。

**コールバック化が必要な関数(DOM/描画を含む・移植難易度 中):**

| 関数 | 含むDOM/副作用 | 対処 |
|---|---|---|
| `runTurn()`(L1646) | `log()`+`renderBattleLog()`+`renderBoth()`(L1686-87) | 描画呼び出しをエンジン外へ。`log()` は配列push(`battleLog` L1396)だけなのでそのまま移せるが、末尾の `render*()` 2行を**呼び出し側の責務**にする(下記1.4) |
| `phaseDealDamage()`(L1457) | `log()`のみ(描画は呼ばない) | ほぼそのまま移せる |
| `ensureBattleState()` / `pushHistory()` | 状態初期化・スナップショット | 移せる(`snapshotBattleState` L1554 は純粋) |

**移さない(本番HTMLに残す)= 描画層:** `render(side)`(L1775)、`renderMoves()`、`renderBattleLog()`、`undoBattle()`(UI再同期)、`document.*`/イベントリスナー一式。

### 1.3 状態(sides/env)の引数化 — ここが設計の肝

現状 sim は `sides`(`{self, opp}`)・`env`・`battleLog` を**モジュールスコープのグローバル**で持ち、`runTurn()` 等が `sides.self` を直接参照する(例: L1650 `sides.self.moves[...]`)。Node で並行に複数バトルを回す/テストを独立させるには、グローバル依存を断つのが望ましい。

**推奨(中庸案・段階移行):** エンジンを `createBattle(initialState)` でくるみ、内部で `sides`/`env`/`battleLog` を**そのバトルのローカル変数**として閉じ込める。`runTurn` 等はそのクロージャ内関数にする。

```js
// turn-engine.js (構想)
function createBattle({ self, env, opp, rng } = {}){
  const sides = { self: makeSideState(), opp: makeSideState() };
  const env   = { weather:'none', field:'none', doubleBattle:false, trickRoom:false };
  const battleLog = [];
  const random = rng || Math.random;          // ← 2節のseed注入点

  function calcDamage(atkSide, defSide, move){ /* 既存ロジック。Math.random→random */ }
  function decideOrder(m1, m2){ /* 同上 */ }
  function runTurn(){ /* 既存。末尾 render* は呼ばない。代わりに onLog/onTurnEnd フックを呼ぶ */ }
  // ...
  return { sides, env, battleLog, runTurn, calcDamage, decideOrder, /* ... */ };
}

if (typeof module !== 'undefined') module.exports = { createBattle };  // Node
if (typeof window !== 'undefined') window.PchamEngine = { createBattle }; // ブラウザ
```

- **データ注入**: `WAZA_MAP`/`POKEMON_LIST`/`ITEMS_DATABASE` はブラウザでは `window.*` グローバル、Node では `require`。`turn-engine.js` 冒頭で `const WAZA_MAP = (typeof window!=='undefined'? window.WAZA_MAP : require('./pokechan_data.js').WAZA_MAP)` のような両対応シムを置く。**注意**: `pokechan_data.js` は現状 `module.exports` を持たない素のグローバル代入なので、Node 用に末尾へ `if(typeof module!=='undefined') module.exports={POKEMON_LIST,WAZA_MAP,NATURES,TYPES,...}` を**1行足す**必要がある(データ本体は触らない=構造を壊さない)。
- **互換維持の最小一歩**: いきなりクロージャ化が重ければ、まず「①`turn-engine.js` に関数群を切り出し ②`Math.random` を引数 `random` 経由に置換 ③グローバル `sides`/`env` は当面そのまま」でも、テストは回せる(各テストの先頭で `resetBattle()` 相当を呼び状態を作る)。**段階移行可**。

### 1.4 描画とログの分離

`runTurn()` 末尾の `renderBattleLog()`/`renderBoth()`(L1686-87)はエンジンから外し、HTML 側で `engine.runTurn(); renderBattleLog(); renderBoth();` と**呼び出し側で繋ぐ**。`log()` は `battleLog` 配列への push(L1396)なので副作用が小さく、エンジン内に残してよい(テストは `battleLog` を読んでアサートにも使える)。

### 1.5 リスクと代替

- **リスク1: 切り出し時のデグレ**。インラインに密結合しているため、移動でグローバル参照が切れる。→ **対策**: 切り出し直後に「同一初期状態で HTML 実行とNode実行の `battleLog`/HP が一致する」ゴールデンテストを1本通してから次へ。
- **リスク2: `pokechan_data.js` の Node 読み込み**。素のグローバル代入のため `require` で `undefined`。→ 末尾に export 1行(上記)。または Node 側で `vm` でファイルを評価して名前空間を拾う(データを書き換えたくない場合の代替)。
- **代替案(ヘッドレスChrome / Puppeteer・Playwright)**: 切り出しをせず、実HTMLをヘッドレスブラウザで開き、`page.evaluate(()=>{ runTurn(); return {hp:sides.opp.currentHp, log:battleLog} })` で状態を吸い出してアサートする。
  - 長所: **本番コードそのまま**を検証(乖離ゼロ)。切り出し工数ゼロ。
  - 短所: 起動が重く `/goal` の高速反復に不向き。**`Math.random` の seed 固定が困難**(ページ内RNGを差し替える注入が必要で、結局2節の作業が要る)。決定論を諦めるなら範囲アサートのみ。
  - **結論**: 第一選択は「純粋ロジックの切り出し+Node」。ヘッドレスは「切り出し版が本番と一致するか」の**突き合わせ検証(クロスチェック)**に限定して併用する。

確信度: 中〜高(関数のDOM依存はエンジン解析と当該行で確認。クロージャ化の具体形は提案であり、最小移行から始めるのが安全)。

---

## 2. マルチターンのループ設計(決定論)

### 2.1 1ターン=現状の `runTurn()`、N回繰り返す

現状 `runTurn()`(L1646)は両側同時に1ターンを解決する(行動順→各自実行→`phaseEndOfTurnSlip()`)。**マルチターンは sim 未実装**(DOMの「ターン実行」ボタンを人が連打する運用)。テスト環境では、これを `runBattle(maxTurns)` でくるんでループ化する。

```js
function runBattle(engine, scenario, { maxTurns = 50 } = {}){
  const { sides, runTurn } = engine;
  for (let turn = 1; turn <= maxTurns; turn++){
    // 各ターンの技選択(シナリオから・後述DSL)
    sides.self.selectedMoveIdx = chooseMove(scenario.self, turn, sides);
    sides.opp.selectedMoveIdx  = chooseMove(scenario.opp,  turn, sides);
    runTurn();                                   // 左→右(行動順は decideOrder が決める)
    if (sides.self.fainted || sides.opp.fainted) break;  // ★瀕死で停止
  }
}
```

- **瀕死で停止**: どちらかが `fainted`(L1477/L1530)になったらループを抜ける。**現状 sim には控え交代が無い**ので「倒れた=決着」でよい(ダブル/控えは将来拡張、4節以降の母集団外)。
- **ターン上限**: `maxTurns`(初期値50など)で無限ループ防止。上限到達は「決着せず」として記録(`/goal` ではタイムアウト扱い)。
- **「左→右→左…」**: 阿部さん方針のマルチターン確認は、`scenario.self`/`scenario.opp` に**ターン毎の技列**を持たせ、毎ターン両者が選び直す形で表現する(例: self は毎ターン「たいあたり」、opp は「ねむる」など)。

### 2.2 RNGを固定seed化(★テストの決定論・最重要)

現状 sim は **`Math.random()` を各所で直接呼ぶ**(命中L1452、ダメージ乱数16通りの選択L1465、追加効果発動L1496、同速ランダムL1381、こおり/まひの行動可否L1668-69)。`Math.random` はseed指定できないので、テストは毎回ブレる。

**解決: seed可能なPRNGを1つ用意し、エンジンに注入して全 `Math.random()` 呼び出しを置換する。**(Pokémon Showdown も「全テスト共通の固定シード」を持つ=出典 `test/common.js` `DEFAULT_SEED`。)

```js
// 小さな決定論PRNG(例: mulberry32)。実機RNG完全再現は不要、再現性だけ要る。
function makePRNG(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 使用: createBattle({ rng: makePRNG(12345) })
```

- エンジン内の `Math.random` を**全て `random()`(注入されたPRNG)に機械置換**する。grep で `Math.random` をエンジン側ゼロにするのが完了条件(本番HTML側は `createBattle()` 時に未指定なら `Math.random` を渡す=従来通りランダム)。
- **2レバー戦略(Showdown流・出典 `test/TESTS.md`)**: 決定論には2つの使い分けがある。
  1. **固定シード**: ダメージ乱数の幅・同速順を含めて出目を固定。`bounded` 系アサートと併用。
  2. **確率の強制(forceRandomChance相当)**: 「追加効果が必ず出る/出ない」をテストしたい時、PRNGの seed を選ぶのは脆い。代わりにエンジンに `forceChance: true/false` フックを足し、`phaseApplyEffects` の確率判定(L1496 `random()*100 >= prob`)を強制 true/false にできるようにする。**段階③(状態異常付与)以降で必須**。
- **再現ログ**: 失敗時に再現できるよう「seed + シナリオ(チーム+技列) + エンジンver(git short hash)」をログに残す(出典: Showdown のシード世代依存issue #10162 = seed形式とverを固定保存せよ)。

確信度: 高(`Math.random` 散在は当該行で確認。PRNG注入は標準手法)。

---

## 3. 段階的拡張(テスト母集団の育て方)

阿部さん方針通り「追加効果なし→だんだん増やす」。各段で**テストを追加**し、前段が緑のまま次へ。**voiced≠complete** を常に意識し「期待した状態が本当に変わったか」を毎回アサートする(grepゼロで満足しない)。

| 段 | 内容 | 検証する状態 | sim実装状況 | 主リスク(隠れ取りこぼし) |
|---|---|---|---|---|
| **①** | **追加効果なしの純粋攻撃技** | 相手 `currentHp` が計算どおり減る | 実装済(`calcDamage`/`phaseDealDamage`) | タイプ相性・急所・天候補正の取りこぼし |
| **②** | **状態異常付与**(やけど/どく/まひ/もうどく/ねむり/こおり) | `target.status` が変わる・スリップダメ(L1511)が入る | 実装済(`phaseApplyEffects` は**状態異常のみ**) | `prob` 確率の発動可否(→2.2のforceChance)。既に異常持ちなら不発(L1499) |
| **③** | **能力ランク変化**(こうげき+2 / とくこう-1 等) | `st.rank.atk` 等が±Nする | **未実装**(`phaseApplyEffects` は能力変動を処理しない=出典 リファレンス§6) | **テスト先行で「赤(未実装)」が正**。エンジンに `kind:'能力変化'` 処理を足してから緑化 |
| **④** | **優先度/素早さ順** | `decideOrder` の先攻判定・先制技・同速・トリックルーム逆転 | 実装済(`movePriority`/`effectiveSpeed`) | 同速ランダム(seed固定で確定)。`env.trickRoom` のフラグ名(後述) |
| **⑤** | **天候/フィールド** | ダメ倍率(L1093-1118)・砂嵐スリップ(L1534) | 部分実装(天候4種・フィールド4種の倍率/砂嵐ダメ。**ねがいごと/たべのこし等のターン終了回復は未**=§5) | `10b`〜`10h`(バインド・回復・カウント)が**未実装**。テストは「未実装を赤で固定」して将来の実装ゴールにする |

- **「未実装を赤で残す」運用**: ③以降は sim 側に処理関数が無い(出典: リファレンス§6「能力変動・場操作・回復・交代は処理関数なし」/`phaseApplyEffects` L1484-1507 は状態異常のみ)。テストは**先に書いて意図的に失敗(赤)させ**、その赤を「次に実装すべきフェーズ」として `/goal` の段階ゴールに使う。effects に `phase` を持たせ「攻撃後の追加効果なし」と「未調査」を区別する(§3 推奨)。
- **母集団の育て方**: 各段ごとに「対象技リスト(母集団)」を別ファイルで管理し、段が進むごとに技を足す。①は無印の物理/特殊技、②は `kind:'状態付与'` を持つ技、③は `kind:'能力変化'`(該当キー名は要確認)を持つ技…と effects の `kind` で機械的に母集団を抽出できる。

確信度: 高(段の実装可否はエンジン解析+リファレンス§6で確認)。

---

## 4. 最初の1ケースの具体(段①)

**狙い**: 「純粋な物理攻撃技で、右(opp)のHPが計算どおり減る」ことだけを、決定論で確かめる。

### 初期状態
- **self(左)**: ある物理アタッカー(例: こうげき種族値が高く、追加効果のない物理技を覚えるポケ)。性格・能力P・持ち物・特性=デフォルト(無補正・無アイテム・特性なし or 無関係)。技スロット=**追加効果のない純粋物理技1つ**(`battle_data.effects` が空、または無視できるもの。例: 「たいあたり」「たたく」系で `effects:[]` のものを母集団から選ぶ)。
- **opp(右)**: 受け側。タイプは**等倍**になる組み合わせを選ぶ(タイプ相性の交絡を排除)。状態異常なし・ランク0・持ち物/特性=無関係。
- **env**: `weather:'none'`, `field:'none'`, `trickRoom:false`, `doubleBattle:false`(補正ゼロ)。
- **RNG**: `makePRNG(固定seed)` を注入。命中は必中条件でなくても、seedで「当たり」の出目を選ぶ or 命中100%の技を選んで命中ロールを実質除去。

### 実行
```js
const engine = createBattle({ rng: makePRNG(20260608) });
setupSide(engine.sides.self, { pokeKey:'...', moveKeys:['<純粋物理技>'] });
setupSide(engine.sides.opp,  { pokeKey:'...' });
engine.sides.self.selectedMoveIdx = 0;
engine.sides.opp.selectedMoveIdx  = 0; // opp も無害な技 or 同じ技
engine.runTurn();
```

### 検証(アサーション)
1. **HPが減ったか**: `opp.currentHp < realStat(opp,'hp')`(満タンから減少)。
2. **計算どおりか**: `calcDamage('self','opp', move)` の `variations`(16通り)を独立に算出し、seedで選ばれた `variation` が**その16通りの範囲内**(`assert.bounded` 相当)。乱数を完全固定するなら**特定の1値に一致**まで締める。
3. **余計なことが起きていないか**: `opp.status === 'none'`(純粋技なので状態異常が付かない)、`opp.rank` 全0、`self.currentHp` 不変(反動なし)。
4. **ログ整合**: `battleLog` に「ダメージ」行が1つ、状態異常行が無い。

> ②以降は同じ骨格で「①の3番(余計なこと)を期待値に変える」だけ。例②: 「おにび」で `opp.status === 'burn'` になり、次ターン終了に `phaseSlipFor` で 1/16 のやけどダメが入る、を `forceChance:true` で確定検証。

確信度: 高(段①は実装済み機能のみで完結)。

---

## 5. /goal 接続(運用)

### 実行口
- **`node tools/_sim_test.js`** を作る(現状未作成。命名は既存 `tools/_*.js` 慣習に合わせる)。これが `turn-engine.js` を `require` し、テストケース群(段①〜)を全件実行する。
- **合否**: **全件pass=合格(exit 0)、1件でもfail=不合格(exit 1)**。`/goal` はこの終了コードで段階ゴール達成を機械判定する。
- **テストフレームワーク**: Node 標準の `node:test` + `node:assert`(追加依存ゼロ)を推奨。`tools/node_modules` は既存(`package.json` あり)なので Mocha 等でも可だが、依存最小が望ましい。

### 毎ターン実行してログに残す
- 各テストは `runBattle`(§2.1)で**毎ターン `runTurn` を実行**し、ターンごとの `{turn, self:{hp,status,rank}, opp:{...}, log差分}` を**テストログ(JSON or テキスト)**に追記。失敗時は「seed + シナリオ + git hash」(§2.2)を併記して再現可能に。
- ログ出力先は `tools/` 配下の固定ファイル(例: `tools/_sim_test_last.log`)。本番データ(`pokechan_data.js` 等)には**一切書き戻さない**。

### データ構造は壊さない(★鉄則)
- テストは `WAZA_MAP`/`POKEMON_LIST`/`ITEMS_DATABASE` を**読み取り専用**で使う。`effects` の追記・修正が要る場合(略さない原則でeffectsへ意味を足す等)は、**人間の検証担当の了解を得てから**(CLAUDE.md 役割モデル)。テストランナーがデータを自動書き換えするのは禁止。
- `pokechan_data.js` への変更は「Node 読み込み用の `module.exports` 1行(§1.5)」のような**構造を変えない最小限**に留め、データ本体(技/種族値/effects)は触らない。

### ターン上限
- `runBattle` の `maxTurns`(§2.1)で各バトルを打ち切り。上限到達テストは「決着せず=fail扱い or skip」を明示(ハングを `/goal` の偽合格にしない)。

確信度: 高(運用方針。`_sim_test.js` は新規作成物=未実装)。

---

## 6. 確信度・要確認(出典付き)

### 確定(コードで確認済み)
- 純粋ロジック関数は DOM 非依存で切り出せる(`calcDamage` L1039 ほか)。`runTurn`(L1646)末尾の `renderBattleLog()`/`renderBoth()`(L1686-87)だけが描画依存。
- RNG は `Math.random()` 直書きで散在(命中 L1452、ダメージ選択 L1465、追加効果 L1496、同速 L1381、こおり/まひ L1668-69)→ seed注入で決定論化が必要。
- `phaseApplyEffects`(L1484-1507)は**状態異常付与のみ**実装(能力変化・場操作・回復は未)。マルチターン連続実行・控え交代は**未実装**。
- データは `<script src>` のグローバル(`real_battle_simulator.html` L867-868)。`pokechan_data.js` に `module.exports` なし → Node 用に export 追加が要る。

### 要確認(ユーザー/検証担当 or 追加調査)
1. **`env` のフラグ名**: 定義・本番は `env.trickRoom`(L911/L1699/L2456)。エンジン解析レポートが `env.trickroom`(小文字)と書いていたが、**実コードは `trickRoom`(キャメル)で一貫**しており、レポート側の転記ゆれと判断。切り出し時に名称を統一・固定すること(混在したらバグになる)。→ **確信度: 中(コードはtrickRoomで一貫を確認。命名統一は切り出し時の作業項目)**。
2. **段①の具体的な技/ポケモン選定**: 「追加効果が完全にゼロの物理技」が `WAZA_MAP` のどのキーか、等倍受けの組み合わせは何かは、母集団抽出時に `effects:[]` で機械抽出して確定する(記憶で技名を断言しない=SSOTはDB)。
3. **能力変化の `kind` 表記**: 段③で母集団抽出に使う `effects[].kind` の正確な値(「能力変化」「ランク変化」等)は `tools/_rules.js`/`_waza_compose.js` の表記基準に合わせる(推測で足さない)。
4. **クロージャ化(`createBattle`)の採否**: グローバル `sides`/`env` を残す最小移行で始めるか、最初からクロージャ化するかは工数とのトレードオフ。**まず最小移行→ゴールデンテスト緑→必要ならクロージャ化**を推奨するが、最終判断は実装着手時に。
5. **実機RNG完全再現の要否**: 本テストの目的は「再現性(同seed=同結果)」であり、実カートリッジのRNG列再現は不要と判断。もし「実機と同じ乱数列での挙動一致」まで要るなら別途調査(確信度: 中)。

### 外部出典(設計の裏取り)
- ターン3段構造・行動順(優先度→素早さ)・第4世代以降は瀕死交代がターン終了後: Bulbapedia「Pokémon battle」「Fainting」「Priority」「Battle status」。確信度 高。
- ターン終了処理の固定順(約42ステップ): Bulbapedia「User:SnorlaxMonster/End-turn resolution order」。第6世代解析が一次ソースで、SV準拠なら世代差の追検証要。確信度 中〜高。
- テスト手法(固定シード+確率強制の2レバー、1技1ファイル、状態直接アサート、再現ログ): Pokémon Showdown `test/common.js`(`DEFAULT_SEED`)・`test/TESTS.md`・`test/sim/moves/`、`sim/battle.ts`(`turnLoop`)、シード世代依存 Issue #10162。確信度 高。

---

## 付録: 実装着手の最小手順(チェックリスト)

1. `pokechan_data.js` 末尾に Node 用 `module.exports` を1行追加(データ本体は不変)。
2. sim から純粋ロジック関数+定数を `turn-engine.js` へ切り出し、`Math.random`→注入 `random()` に置換。HTML は `<script src="turn-engine.js">` 読み込みに変更し、`runTurn` 末尾の `render*` を呼び出し側へ移す。
3. **ゴールデンテスト1本**: 同一初期状態で「HTML実行」と「Node実行」の HP/ログが一致(切り出しデグレ検出)。
4. `tools/_sim_test.js` 作成: `node:test` で段①ケース(4節)を実装、全件passでexit 0。
5. seed固定 PRNG・`runBattle(maxTurns)`・再現ログ(seed+シナリオ+git hash)を整備。
6. `/goal` から `node tools/_sim_test.js` を呼び、段①緑を確認 → 段②(状態異常+forceChance)へ。
