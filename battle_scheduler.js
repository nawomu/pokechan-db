/*
 * battle_scheduler.js — D1: 行動者契約(ActionIntent) + 純粋 scheduler(未接続の共通部品)
 *
 * 出典/上位文書(読んでから書いた・矛盾したら文書側が正):
 *   - 設計_ダブルバトル_2026-09-07.md §3(状態モデル)§5(行動順)§8.2(undo)
 *   - 設計_行動順再評価_2026-09-05.md §3〜§7(ActionIntentの契約・優先度/順序補正/乱数の契約)
 *   - review/_b064_staged_plan_2026-09-06.md §2 D1行
 *   - review/_b064_d0_2026-09-07/01_依存表.md(RNG=Math.random 44箇所・undo=手書き約60項目)
 *   - reference/_pokemon... ではなく real_battle_simulator.html 本体(現物確認。行番号は2026-09-10時点):
 *       clearVolatilesOnSwitch(st) … :6243-6284
 *       makeSideState()            … :1127-1276
 *       snapshotBattleState()/snap … :5516-5611(既存undoの手書き一覧=突き合わせ用)
 *
 * ★止める地点(指示書どおり): real_battle_simulator.html は1文字も変更しない。ページも変更しない。
 *   ここは「関数だけ」。D2でエンジンがこの部品に接続する(今は未接続)。
 *
 * ★この規律を守る(指示書「守ること」): このファイルは Math.random を直接呼ばない。
 *   乱数は必ず createScheduler(intents, ctx, opts) の opts.rng(注入) 経由でしか使わない。
 *   opts.rng を渡さない呼び出しはエラーにする(黙ってMath.randomへフォールバックしない=呼び出し側の
 *   注入漏れを機械的に検出するための設計。指示書§Bの「tieの解決以外で呼ばない」も同時に守る=
 *   rng() を呼ぶのは _resolveTie() の中の1箇所だけ)。
 *
 * UMD: ブラウザでは window.BattleScheduler、Node では module.exports。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BattleScheduler = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================================
  // D. 3定数 + snapshot 仕様(状態モデル §3)
  // =========================================================================
  //
  // 分類の考え方(指示書D):
  //   ①「枠の揮発」= real_battle_simulator.html の clearVolatilesOnSwitch(st)(:6243-6284)が
  //      実際に代入している欄=交代した瞬間に消える欄。ここが唯一の正本(推測で足さない)。
  //      このうち16欄(badpoisonCounter/transformBase/proteanUsed/choiceLock/metronomeCount/
  //      _metronomeLastMoveKey/snatchArmed/magicCoatTurn/cudChew/illusionAs/flinched/
  //      pendingStatus/turnsOut/selectedMoveIdx/paradoxBoost/pendingEjectPack)は
  //      makeSideState() の初期オブジェクトリテラルには無く、他の場所で遅延初期化される
  //      (クローン/へんしん/道具消費/命中判定等)実在の欄。宣言の有無に関わらず、
  //      clearVolatilesOnSwitch(st) が代入している=枠の揮発、として列挙する。
  //   ②「側の場」= clearVolatilesOnSwitch では消えず、かつコード中のコメントが明示的に
  //      「サイドに残る/交代でリセットしない」等と書いている欄(壁/設置/おいかぜ/いやしのねがい)。
  //      futureSight/wish は明示コメントは無いが、実機で「位置(サイド)に残っていて、そこに
  //      居合わせた個体に発火する」効果(みらいよち/ねがいごと)で、healingWishと同じ型
  //      (=次にそこへ来た個体に効く予約)なので同じ側の場に分類する(未確認: コード内に
  //      「交代しても残る」の明言コメントが無いため根拠が弱い=表内に理由を明記)。
  //   ③「個体に付く欄」= clearVolatilesOnSwitch では消えず、ポケモン本体・持ち物・技PP・
  //      HP・永続状態異常・メガ済み等、個体そのものに紐づく欄(交代してベンチへ戻っても
  //      その個体のデータとして保持される)。megaUsed/megaChoice/megaBaseは
  //      makeSideState() 内コメント「ポケモンと一緒に控えへ同行」の明言どおり。
  //      currentHp/fainted/pp/disguiseBroken は makeSideState() の初期オブジェクトリテラルには
  //      無く遅延初期化される(:2362-2366 等)が、実在する個体データなので列挙する。
  //   ④ 上記に自然に当てはまらない欄は UNCLASSIFIED_FIELDS に理由付きで置く(未分類=fail にしない)。
  //      - forecastForm: てんきや(ポワルン)の天候見た目。typeOverride(枠の揮発)と対で戻される
  //        コメントがあるが、clearVolatilesOnSwitch自体はforecastFormを消していない。実機Wikiでは
  //        交代で元の姿に戻るはずなので「本来は枠の揮発では」という食い違いがある=未確認のまま置く。
  //      - bench: 手持ち控えの配列。3分類の「枠」でも「側の場」でも「個体1件」でもない
  //        (=控えメンバー全員分のデータの集まり=ダブルバトル設計の party[] に相当)。
  //      - switchChoice/switchedThisTurn/tookThisTurn/movedThisTurn: 交代基準ではなく
  //        「ターン開始のたびにクリア」される一時バッファ(runTurn冒頭でクリア。交代のたびではない)。
  //        3分類は交代を基準にした分類なので、ターン基準の一時変数はここに集める。
  //      - selectedStatKey/poolSort/poolFilter/moveSearch: ページ側のUI操作状態
  //        (状態モデル§3の sides.ui に相当)。エンジンの3分類には無い。
  //      - critical/lifeOrb/rockyHelmet: 手動ダメージ計算チェックボックス(会心確定/いのちのたま
  //        発動確定/ゴツゴツメット発動確定)。ビルド設定に近いが「交代」の観点で分類できない
  //        (電卓UIの入力欄であり、実際の持ち物/特性/状態のライブ値とは別物)。
  //
  // ★undoの既存実装(snapshotBattleState/snap :5516-5611)には currentHp/fainted/pp/megaUsed 等
  //   個体データと壁/設置/おいかぜ等の側の場と、rank等の枠揮発が全部「1つの手書きリスト」に
  //   混在している(=分割されていない)。ここではその手書きリストを裏取りに使い、3分類へ機械的に
  //   割り直した(makeSnapshotSpec() が3定数の和集合を返す=分割済みの新しい一覧)。

  // ① 枠の揮発(=clearVolatilesOnSwitch(st)が代入する欄。real_battle_simulator.html:6243-6284)
  var SLOT_VOLATILE_FIELDS = Object.freeze([
    'badpoisonCounter',      // :6244 もうどくカウンタ(もうどく状態自体はACTOR側=status)
    'charging',              // :6245 溜め技の溜め状態
    'mustRecharge',          // :6245 はかいこうせん系の反動硬直
    'protecting',            // :6246 まもる系
    'enduring',              // :6246 こらえる
    'protectStreak',         // :6246 まもる/こらえるの連続成功カウント
    'slips',                 // :6247 しおづけ/のろい等の揮発スリップ
    'rampage',               // :6248 げきりん等のあばれ状態
    'minimized',             // :6248 ちいさくなる
    'chargeBoost',           // :6248 じゅうでん状態
    'stockpile',             // :6249 たくわえた数
    'stockpileBoost',        // :6249 たくわえるで上がったランク分
    'tauntTurns',            // :6250 ちょうはつ残りターン
    'lastMove',              // :6250 かなしばり/アンコール対象の直近技
    'disable',               // :6250 かなしばり状態
    'encore',                // :6250 アンコール状態
    'statOverride',          // :6251 実数値の上書き(パワートリック等)
    'typeOverride',          // :6251 タイプの上書き(みずびたし等)
    'abilityOverride',       // :6251 特性の上書き(なりきり等)
    'transformBase',         // :6252 へんしん元データ(遅延初期化。:2413等)
    'proteanUsed',           // :6253 へんげんじざいの1回制限(遅延初期化)
    'choiceLock',            // :6254 こだわりロック(遅延初期化)
    'metronomeCount',        // :6255 メトロノーム(道具)の連続使用回数(遅延初期化)
    '_metronomeLastMoveKey', // :6255 同上・直前技キー(遅延初期化)
    'snatchArmed',           // :6262 よこどりの構え(遅延初期化)
    'magicCoatTurn',         // :6263 マジックコートの構え(遅延初期化)
    'cudChew',               // :6264 はんすうの再摂食予約(遅延初期化)
    'illusionAs',            // :6265 イリュージョンの化け先(遅延初期化)
    'attracted',             // :6266 メロメロ状態
    'destinyBond',           // :6267 みちづれ構え
    'dbondPrev',             // :6267 直前行動がみちづれだったか
    'perishCount',           // :6267 ほろびのうたカウント
    'lockOn',                // :6268 ロックオン
    'tormented',             // :6268 いちゃもん
    'imprison',              // :6268 ふういん
    'soundBlocked',          // :6269 じごくづき残りターン
    'soundBlockedMoves',     // :6269 じごくづき対象技リスト
    'electrified',           // :6270 そうでん(このターンのタイプ上書き)
    'typeSuppressed',        // :6270 はねやすめ(このターン失うタイプ)
    'rooted',                // :6271 ねをはる
    'subHp',                 // :6271 みがわり残りHP
    'subAbsorbed',           // :6271 このターン分身が受けたか(一過性フラグ)
    'critBoost',             // :6271 きあいだめの急所ランク上乗せ
    'confusion',             // :6272 こんらん残り行動カウント
    'trapped',               // :6273 にげられない状態
    'aquaRing',               // :6274 アクアリング(バトンタッチは別経路で引き継ぐ)
    'magnetRise',             // :6274 でんじふゆう
    'syrupTurns',             // :6275 あめまみれ
    'healBlockTurns',         // :6275 かいふくふうじ
    'flashFire',              // :6276 もらいび発動状態
    'flinched',               // :6277 ひるみ(遅延初期化)
    'pendingStatus',          // :6277 あくび等の予約状態異常(遅延初期化)
    'rank',                   // :6278 能力ランク補正6種
    'usedMoveNames',          // :6279 とっておき用の使用履歴
    'turnsOut',               // :6280 場に出てからの経過ターン(遅延初期化)
    'selectedMoveIdx',        // :6281 UI選択中の技インデックス(遅延初期化)
    'paradoxBoost',           // :6282 こだいかっせい/クォークチャージ発動状態(遅延初期化)
    'pendingEjectPack',       // :6283 だっしゅつパック保留フラグ(遅延初期化)
  ]);

  // ② 側の場(陣営に残る=交代でリセットしない。壁/設置/おいかぜ/いやしのねがい等)
  var SIDE_CONDITION_FIELDS = Object.freeze([
    'reflect',           // リフレクター
    'lightScreen',       // ひかりのかべ
    'auroraVeil',        // オーロラベール
    'safeguard',         // しんぴのまもり
    'screenTurns',       // 壁の残りターン({flag:残数})
    'stealthRock',       // ステルスロック
    'spikesLayers',      // まきびし層数
    'toxicSpikesLayers', // どくびし層数
    'stickyWeb',         // ねばねばネット
    'tailwindTurns',     // おいかぜ(コメント明言「サイドに残る」)
    'healingWish',       // いやしのねがい(コメント明言「サイドに残る」)
    'futureSight',       // みらいよち。未確認: 「サイドに残る」の明言コメントは無いが、
                         // 予知した攻撃は「その場に居る個体」に発火する型(healingWishと同型)
                         // と読んで側の場に置く(台帳化推奨・根拠が弱い旨をここに明記)
    'wish',              // ねがいごと。futureSightと同じ理由・同じ未確認扱い
  ]);

  // ③ 個体に付く欄(交代してベンチへ戻ってもその個体のデータとして保持)
  var ACTOR_FIELDS = Object.freeze([
    'poke',             // 種族データ本体
    'effort',           // 個体の努力値
    'natureIdx',        // 性格
    'ability',          // 選択中の特性名(素の特性。abilityOverrideは枠の揮発)
    'gender',           // 性別
    'item',             // 持ち物
    'moves',            // 覚えている技配列
    'status',           // 永続状態異常(none/burn/paralysis/poison/badpoison/sleep/freeze)
    'sleepTurns',       // ねむりの残り行動カウント(状態異常に付随・交代しても継続)
    'lastConsumedItem', // 消費した道具(リサイクル用)。コメント明言「ポケモンと一緒に控えへ移動する」
    'megaUsed',         // メガシンカ済みフラグ。コメント明言「ポケモンと一緒に控えへ同行」
    'megaChoice',       // 次ターン頭で変身する予約。megaUsed/megaBaseと同じ組で個体扱い
    'megaBase',         // メガシンカ前のフォーム(バトルリセットで戻す)
    'disguise',         // ばけのかわ(剥がれ状態)。交代でも戻らない(1バトル1回)
    'disguiseBroken',   // ばけのかわの「剥がれ済み」恒久フラグ(遅延初期化・disguiseと対)
    'pp',               // 現在PP配列(遅延初期化・へんしん時5化含む)
    'currentHp',        // 現在HP(遅延初期化)
    'fainted',          // ひんしフラグ(遅延初期化)
  ]);

  // ④ 分類に迷った欄(未確認/意味的に3分類のどれにも自然に当てはまらない=fail にしない・report専用)
  var UNCLASSIFIED_FIELDS = Object.freeze([
    'forecastForm',      // てんきやの天候見た目。typeOverride(枠の揮発)と対だがclearVolatilesOnSwitch自体は
                         // 消していない=枠揮発であるべき疑いがあるコード側の食い違い(未確認)
    'bench',             // 控えメンバー配列=state model の party[] 相当。3分類のどれでもない(roster)
    'switchChoice',      // このターンの交代選択(ターン開始でクリア。交代基準ではない)
    'switchedThisTurn',  // このターン交代で出たか(ターン開始でクリア)
    'tookThisTurn',      // このターンの被ダメ記録(ターン開始でクリア)
    'movedThisTurn',     // このターン行動済みか(ターン開始でクリア)
    'selectedStatKey',   // ページUI: 能力値編集のハイライト行
    'poolSort',          // ページUI: 技プールの並び替えモード
    'poolFilter',        // ページUI: 技プールのカテゴリ絞り込み
    'moveSearch',        // ページUI: 技検索キーワード
    'critical',          // 手動ダメージ電卓: 会心確定チェックボックス
    'lifeOrb',           // 手動ダメージ電卓: いのちのたま発動確定チェックボックス
    'rockyHelmet',       // 手動ダメージ電卓: ゴツゴツメット発動確定チェックボックス
  ]);

  function makeSnapshotSpec() {
    var groups = {
      slotVolatile: SLOT_VOLATILE_FIELDS,
      sideCondition: SIDE_CONDITION_FIELDS,
      actor: ACTOR_FIELDS,
    };
    var seen = {}; // field -> [groupName,...]
    Object.keys(groups).forEach(function (groupName) {
      groups[groupName].forEach(function (f) {
        if (!seen[f]) seen[f] = [];
        seen[f].push(groupName);
      });
    });
    var duplicates = [];
    Object.keys(seen).forEach(function (f) {
      if (seen[f].length > 1) duplicates.push({ field: f, groups: seen[f].slice() });
    });
    var fields = Object.keys(seen).sort();
    return {
      fields: fields, // undo対象欄=3定数(slotVolatile/sideCondition/actor)の和集合。重複除去済み
      bySection: {
        slotVolatile: SLOT_VOLATILE_FIELDS.slice(),
        sideCondition: SIDE_CONDITION_FIELDS.slice(),
        actor: ACTOR_FIELDS.slice(),
      },
      unclassified: UNCLASSIFIED_FIELDS.slice(), // undo対象には含めない。診断用(failさせない)
      duplicates: duplicates, // 空であるべき(3定数間の重複が無いことの検査)
    };
  }

  // =========================================================================
  // A. 行動者契約(ActionIntent)
  // =========================================================================

  var VALID_KINDS = { switch: 1, mega: 1, move: 1, item: 1, run: 1 };
  var _actionSeq = 0;

  function createIntent(params) {
    params = params || {};
    if (!VALID_KINDS[params.kind]) {
      throw new Error('createIntent: kind must be one of switch|mega|move|item|run (got ' + params.kind + ')');
    }
    if (params.actorId == null) throw new Error('createIntent: actorId is required');
    if (params.presenceEpoch == null) throw new Error('createIntent: presenceEpoch is required');
    var actionId = params.actionId != null ? params.actionId : ('intent_' + (++_actionSeq));
    return {
      turnId: params.turnId != null ? params.turnId : null,
      actionId: actionId,
      actorId: params.actorId,
      presenceEpoch: params.presenceEpoch,
      sideId: params.sideId != null ? params.sideId : null,
      slotId: params.slotId != null ? params.slotId : null,
      kind: params.kind,
      // orderingMove(並べ替えに使う技) と executionMove(今回実際に実行する技)は別に持つ
      // (行動順再評価§1/§3: アンコールで実行技が変わっても並べ替えは選択技の優先度のまま)
      orderingMove: params.orderingMove !== undefined ? params.orderingMove : null,
      executionMove: params.executionMove !== undefined ? params.executionMove : null,
      targetChoice: params.targetChoice !== undefined ? params.targetChoice : null,
      origin: params.origin !== undefined ? params.origin : null,
      // 明示キュー指示(おさきにどうぞ/さきおくり)。既定は無し。sched.moveToFront/moveToBack で設定する
      // (指示書本文にsetter APIの明記は無いが、①の並べ替え鍵として「指示のある物」を扱うために必要な
      // 最小限の拡張=未確認としてここに明記する)
      queuePosition: null,
      status: 'pending',
      cancelReason: null,
    };
  }

  // =========================================================================
  // B. 純粋 scheduler
  // =========================================================================

  var KIND_BAND = { switch: 0, item: 0, run: 0, mega: 1, move: 2 };
  // 未確認(指示書A): item/run は switch と同じ帯・同じ規則で扱うとだけ指定されており、
  // 両者を区別する細則(例: switchとitemが同ターン競合した時の同帯内順)は根拠が無いため
  // 「同じ帯」以上のことをしない(帯内の順は②以降の鍵=優先度/order modifier/speed/tieに委ねる)。
  var ORDER_MOD_BAND = { first: 0, normal: 1, last: 2 };

  function _cloneIntent(intent) {
    return JSON.parse(JSON.stringify(intent));
  }

  function _factorial(n) {
    var f = 1;
    for (var i = 2; i <= n; i++) f *= i;
    return f;
  }

  // Lehmer code: index(0..n!-1) を [0..n-1] の要素配列の1つの順列に決定的に変換する
  function _permutationFromIndex(list, index) {
    var pool = list.slice();
    var n = pool.length;
    var fact = new Array(n);
    fact[0] = 1;
    for (var i = 1; i < n; i++) fact[i] = fact[i - 1] * i;
    var result = [];
    var idx = index;
    for (var k = n; k >= 1; k--) {
      var f = fact[k - 1];
      var pos = Math.floor(idx / f);
      idx = idx % f;
      result.push(pool.splice(pos, 1)[0]);
    }
    return result;
  }

  function Scheduler(intents, ctx, opts) {
    opts = opts || {};
    if (!ctx) throw new Error('createScheduler: ctx is required');
    if (typeof ctx.isPresent !== 'function') throw new Error('createScheduler: ctx.isPresent is required');
    if (typeof ctx.priorityOf !== 'function') throw new Error('createScheduler: ctx.priorityOf is required');
    if (typeof ctx.speedOf !== 'function') throw new Error('createScheduler: ctx.speedOf is required');
    if (typeof ctx.trickRoom !== 'function') throw new Error('createScheduler: ctx.trickRoom is required');
    if (typeof ctx.orderModifierOf !== 'function') throw new Error('createScheduler: ctx.orderModifierOf is required');
    // ★守ること: このファイルはMath.randomを直接呼ばない。rngは必ず注入(既定値を用意しない)。
    if (typeof opts.rng !== 'function') {
      throw new Error('createScheduler: opts.rng is required (() => [0,1) を注入。このファイルはMath.randomを直接呼ばない)');
    }
    this._ctx = ctx;
    this._rng = opts.rng;
    this._tiePolicy = opts.tiePolicy || 'random';
    if (this._tiePolicy !== 'random' && this._tiePolicy !== 'canon') {
      throw new Error('createScheduler: opts.tiePolicy must be "random" or "canon"');
    }
    // canon tiePolicy 用の決定的順序(注入試験用。実機の代替ではない=指示書Bの注記どおり)
    this._canonOrder = Array.isArray(opts.canonSlots)
      ? opts.canonSlots.map(function (x) { return (typeof x === 'string') ? x : x.actorId; })
      : null;

    this._intents = (intents || []).map(_cloneIntent);
    this._byId = {};
    var self_ = this;
    this._intents.forEach(function (i) { self_._byId[i.actionId] = i; });

    // order_modifier_snapshot: ターン開始時(=construct時)に1回だけ問い合わせて保存する。
    // 再評価(next()の再呼び出し)では再問い合わせしない(乱数を余計に引かない・行動順再評価§5)。
    this._orderModifierSnapshot = {};
    if (!opts._skipOrderModifierQuery) {
      this._intents.forEach(function (intent) {
        self_._orderModifierSnapshot[intent.actionId] = ctx.orderModifierOf(intent);
      });
    }

    this._tieCache = {}; // key(帯+queueRank+priority+orderModBand+speedの組) -> {order:[actionId,...], membersSet:Set}
    this._lastDecision = null;
  }

  Scheduler.prototype._invalidateAbsent = function () {
    var ctx = this._ctx;
    this._intents.forEach(function (intent) {
      if (intent.status !== 'pending') return;
      if (!ctx.isPresent(intent.actorId, intent.presenceEpoch)) {
        intent.status = 'cancelled';
        // 近似(未確認): ctx.isPresentは在場/不在のbooleanしか返さないため、この経路では
        // 「switched_out」か「fainted」かを機械的に判別できない。本流がinvalidateActor()を
        // 明示reason付きで先に呼んでいれば通常ここには来ない(こちらは保険の二重チェック)。
        // 理由が既に付いていれば上書きしない。
        if (!intent.cancelReason) intent.cancelReason = 'not_present';
      }
    });
  };

  function _canonRank(order, actorId) {
    if (!order) return 0; // 未確認: canonポリシー指定なのにcanonSlots未指定=順位付け不能。安全側で全員同順位
    var idx = order.indexOf(actorId);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  }

  Scheduler.prototype._resolveTie = function (key, decoratedGroup) {
    var ids = decoratedGroup.map(function (d) { return d.intent.actionId; });
    if (ids.length <= 1) return ids;
    var cached = this._tieCache[key];
    if (cached) {
      var allKnown = ids.every(function (id) { return cached.membersSet[id]; });
      if (allKnown) {
        // 集団が(消費されて)縮んだだけの再来訪 → 既に決めた順序をそのまま使う(rngを引き直さない)
        return cached.order.filter(function (id) { return ids.indexOf(id) !== -1; });
      }
    }
    var order;
    if (this._tiePolicy === 'canon') {
      // canonRankはactorId基準(canonSlotsはactorIdの並び)。actionId→actorIdの対応表を作ってから並べる
      var canonOrder = this._canonOrder;
      var actorIdOf = {};
      decoratedGroup.forEach(function (d) { actorIdOf[d.intent.actionId] = d.intent.actorId; });
      order = ids.slice().sort(function (a, b) {
        return _canonRank(canonOrder, actorIdOf[a]) - _canonRank(canonOrder, actorIdOf[b]);
      });
    } else {
      // random: 集団1つにつきrng()を1回だけ呼ぶ。floor(r * n!) で順列indexを決める(指示書B)
      var r = this._rng();
      var n = ids.length;
      var permIndex = Math.floor(r * _factorial(n));
      order = _permutationFromIndex(ids, permIndex);
    }
    var membersSet = {};
    ids.forEach(function (id) { membersSet[id] = true; });
    this._tieCache[key] = { order: order, membersSet: membersSet };
    return order;
  };

  Scheduler.prototype.next = function () {
    this._invalidateAbsent();
    var ctx = this._ctx;
    var self_ = this;
    var candidates = this._intents.filter(function (i) { return i.status === 'pending'; });
    if (candidates.length === 0) {
      this._lastDecision = null;
      return null;
    }
    var trickRoom = !!ctx.trickRoom();
    var decorated = candidates.map(function (intent) {
      var kindBand = KIND_BAND[intent.kind];
      var queueRank = intent.queuePosition === 'front' ? -1 : (intent.queuePosition === 'back' ? 1 : 0);
      var priorityInfo = ctx.priorityOf(intent);
      var orderMod = self_._orderModifierSnapshot[intent.actionId] || 'normal';
      var orderModBand = ORDER_MOD_BAND[orderMod] != null ? ORDER_MOD_BAND[orderMod] : ORDER_MOD_BAND.normal;
      var speed = ctx.speedOf(intent.actorId);
      return { intent: intent, kindBand: kindBand, queueRank: queueRank, priorityInfo: priorityInfo, orderModBand: orderModBand, speed: speed };
    });
    // 並べ替え鍵(この順で比較): ①明示キュー指示は「同帯の中で」先頭/末尾(指示書B・テスト8)
    // なので、帯(②)をまず確定させてから①を見る実装にする(「同帯の中で」の注記の実装=判断ログ:
    // 帯をまたぐ明示キュー指示は現実には発生しない=おさきにどうぞ/さきおくりは常にmove帯同士)。
    decorated.sort(function (a, b) {
      if (a.kindBand !== b.kindBand) return a.kindBand - b.kindBand;
      if (a.queueRank !== b.queueRank) return a.queueRank - b.queueRank;
      var pa = a.priorityInfo.effectivePriority, pb = b.priorityInfo.effectivePriority;
      if (pa !== pb) return pb - pa; // 有効優先度降順
      if (a.orderModBand !== b.orderModBand) return a.orderModBand - b.orderModBand;
      if (a.speed !== b.speed) return trickRoom ? (a.speed - b.speed) : (b.speed - a.speed);
      return 0; // 同値=tieで解決
    });
    var top = decorated[0];
    var topKey = [top.kindBand, top.queueRank, top.priorityInfo.effectivePriority, top.orderModBand, top.speed].join('|');
    var tieGroup = [];
    for (var i = 0; i < decorated.length; i++) {
      var d = decorated[i];
      var k = [d.kindBand, d.queueRank, d.priorityInfo.effectivePriority, d.orderModBand, d.speed].join('|');
      if (k === topKey) tieGroup.push(d); else break; // sort済みなので同キーは先頭に固まる
    }
    var order = this._resolveTie(topKey, tieGroup);
    var winnerId = order[0];
    var winner = tieGroup.filter(function (d) { return d.intent.actionId === winnerId; })[0];

    this._lastDecision = {
      actionId: winner.intent.actionId,
      actorId: winner.intent.actorId,
      kindBand: winner.kindBand,
      queueRank: winner.queueRank,
      priority: winner.priorityInfo, // 寄与元をそのまま残す(ctx.priorityOfの返り値をそのまま=指示書B)
      orderModifier: this._orderModifierSnapshot[winner.intent.actionId] || 'normal',
      speed: winner.speed,
      trickRoom: trickRoom,
      tieGroupSize: tieGroup.length,
      tiePolicy: this._tiePolicy,
    };
    winner.intent.status = 'executing';
    return _cloneIntent(winner.intent);
  };

  Scheduler.prototype.finish = function (actionId) {
    var intent = this._byId[actionId];
    if (!intent) throw new Error('finish: unknown actionId ' + actionId);
    if (intent.status === 'consumed' || intent.status === 'cancelled') {
      throw new Error('finish: intent ' + actionId + ' is already terminal (' + intent.status + '); terminal状態からは戻せない');
    }
    intent.status = 'consumed';
  };

  Scheduler.prototype.cancel = function (actionId, reason) {
    var intent = this._byId[actionId];
    if (!intent) throw new Error('cancel: unknown actionId ' + actionId);
    if (intent.status === 'consumed' || intent.status === 'cancelled') {
      throw new Error('cancel: intent ' + actionId + ' is already terminal (' + intent.status + '); terminal状態からは戻せない');
    }
    intent.status = 'cancelled';
    intent.cancelReason = reason != null ? reason : null;
  };

  Scheduler.prototype.invalidateActor = function (actorId, reason) {
    // その個体のpendingを全部cancelledにする(退場/ひんし時に本流が呼ぶ・指示書B)。
    // executing中(まさに解決中の行動それ自体)は対象にしない=本流が終端まで解決してconsumedにする
    // (行動順再評価§3「実行中のとんぼがえりなどは…本流が終端まで解決してconsumedにする」)。
    this._intents.forEach(function (intent) {
      if (intent.actorId === actorId && intent.status === 'pending') {
        intent.status = 'cancelled';
        intent.cancelReason = reason != null ? reason : null;
      }
    });
  };

  Scheduler.prototype.hasActed = function (actorId) {
    return this._intents.some(function (i) {
      return i.actorId === actorId && (i.status === 'consumed' || i.status === 'executing');
    });
  };

  Scheduler.prototype.isLastToAct = function (actorId) {
    return !this._intents.some(function (i) { return i.actorId !== actorId && i.status === 'pending'; });
  };

  Scheduler.prototype.pending = function () {
    return this._intents.filter(function (i) { return i.status === 'pending'; }).map(_cloneIntent);
  };

  Scheduler.prototype.lastDecision = function () {
    return this._lastDecision ? JSON.parse(JSON.stringify(this._lastDecision)) : null;
  };

  Scheduler.prototype.addIntent = function (intent) {
    // 注意(指示書B): これは「通常行動の追加」専用。さいはい/おどりこ等の追加実行はこの
    // schedulerにAPIを作らない(別経路)。呼び出し側がその区別を守る前提=ここではコード上
    // 強制できないため、コメントで明記するに留める。
    var clone = _cloneIntent(intent);
    if (!clone.status) clone.status = 'pending';
    if (clone.cancelReason === undefined) clone.cancelReason = null;
    if (clone.queuePosition === undefined) clone.queuePosition = null;
    this._intents.push(clone);
    this._byId[clone.actionId] = clone;
    if (this._orderModifierSnapshot[clone.actionId] === undefined) {
      // 新規Intentも「そのIntentにとっての開始時」に1回だけ問い合わせる(既存Intent群を再問い合わせしない)
      this._orderModifierSnapshot[clone.actionId] = this._ctx.orderModifierOf(clone);
    }
    return _cloneIntent(clone);
  };

  // 拡張API(指示書本文に明記のsetterは無いが、①明示キュー指示を外部から立てる手段が要るため
  // 最小限で追加する。未確認=呼び出し口の名前は本文に無い独自の補い)。
  Scheduler.prototype.moveToFront = function (actionId) {
    var intent = this._byId[actionId];
    if (!intent) throw new Error('moveToFront: unknown actionId ' + actionId);
    intent.queuePosition = 'front';
  };
  Scheduler.prototype.moveToBack = function (actionId) {
    var intent = this._byId[actionId];
    if (!intent) throw new Error('moveToBack: unknown actionId ' + actionId);
    intent.queuePosition = 'back';
  };

  Scheduler.prototype.snapshot = function () {
    var tieCacheEntries = [];
    var self_ = this;
    Object.keys(this._tieCache).forEach(function (key) {
      var v = self_._tieCache[key];
      tieCacheEntries.push([key, { order: v.order.slice(), members: Object.keys(v.membersSet) }]);
    });
    return {
      intents: this._intents.map(_cloneIntent),
      orderModifierSnapshot: JSON.parse(JSON.stringify(this._orderModifierSnapshot)),
      tieCache: tieCacheEntries,
      tiePolicy: this._tiePolicy,
      canonOrder: this._canonOrder ? this._canonOrder.slice() : null,
      // ★RNG状態は含めない(undo用・指示書Bの明記どおり=RNG状態は外側が持つ)
    };
  };

  function restore(snapshot, ctx, opts) {
    opts = opts || {};
    var sched = new Scheduler([], ctx, Object.assign({}, opts, { _skipOrderModifierQuery: true }));
    sched._intents = (snapshot.intents || []).map(_cloneIntent);
    sched._byId = {};
    sched._intents.forEach(function (i) { sched._byId[i.actionId] = i; });
    sched._orderModifierSnapshot = JSON.parse(JSON.stringify(snapshot.orderModifierSnapshot || {}));
    sched._tieCache = {};
    (snapshot.tieCache || []).forEach(function (entry) {
      var key = entry[0], val = entry[1];
      var membersSet = {};
      (val.members || []).forEach(function (m) { membersSet[m] = true; });
      sched._tieCache[key] = { order: (val.order || []).slice(), membersSet: membersSet };
    });
    sched._tiePolicy = snapshot.tiePolicy || sched._tiePolicy;
    if (snapshot.canonOrder) sched._canonOrder = snapshot.canonOrder.slice();
    return sched;
  }

  function createScheduler(intents, ctx, opts) {
    return new Scheduler(intents, ctx, opts);
  }
  createScheduler.restore = restore;

  // =========================================================================
  // C. canonSlots(sides, hostSideId)
  // =========================================================================
  // オンラインの鏡写しで両ブラウザが同じ配列を得るため、出力の sideId はローカルの
  // self/opp表記をそのまま使わず 'host'/'guest' に正準化する(online-lockstep-canon の
  // canonSidesと同じ思想)。そうしないと、ホスト側クライアントは{self:host,opp:guest}、
  // ゲスト側クライアントは{self:guest,opp:host}という「互いに反転したラベル」を持つため、
  // 生の self/opp キーをそのまま出力すると両者は一致しない配列になってしまう。
  function canonSlots(sides, hostSideId) {
    if (!sides || typeof sides !== 'object') throw new Error('canonSlots: sides is required');
    var keys = Object.keys(sides);
    if (keys.length !== 2) throw new Error('canonSlots: sides must have exactly 2 side keys');
    if (!Object.prototype.hasOwnProperty.call(sides, hostSideId)) {
      throw new Error('canonSlots: hostSideId "' + hostSideId + '" not found in sides');
    }
    var guestKey = keys.filter(function (k) { return k !== hostSideId; })[0];
    var hostSlots = (sides[hostSideId] && sides[hostSideId].slots) || [];
    var guestSlots = (sides[guestKey] && sides[guestKey].slots) || [];
    var out = [];
    hostSlots.forEach(function (actorId, slotId) {
      out.push({ sideId: 'host', slotId: slotId, actorId: actorId == null ? null : actorId });
    });
    guestSlots.forEach(function (actorId, slotId) {
      out.push({ sideId: 'guest', slotId: slotId, actorId: actorId == null ? null : actorId });
    });
    return out;
  }

  return {
    createIntent: createIntent,
    createScheduler: createScheduler,
    canonSlots: canonSlots,
    makeSnapshotSpec: makeSnapshotSpec,
    SLOT_VOLATILE_FIELDS: SLOT_VOLATILE_FIELDS,
    SIDE_CONDITION_FIELDS: SIDE_CONDITION_FIELDS,
    ACTOR_FIELDS: ACTOR_FIELDS,
    UNCLASSIFIED_FIELDS: UNCLASSIFIED_FIELDS,
  };
});
