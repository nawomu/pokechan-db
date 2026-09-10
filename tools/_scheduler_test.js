/*
 * tools/_scheduler_test.js — D1: battle_scheduler.js のnode:testテスト
 * 実行: node tools/_scheduler_test.js
 *
 * 指示書 /private/tmp/.../scratchpad/spec_d1_scheduler.md の「テスト」節(1〜12)を
 * そのまま実装する。期待値は設計文書(設計_行動順再評価_2026-09-05.md §2/§7、
 * 設計_ダブルバトル_2026-09-07.md §5)の根拠から。自己出力をゴールデンにしない
 * (=期待値はテストコード側で明示的に計算し、schedulerの出力をそのまま期待値化しない)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const BattleScheduler = require(path.join(__dirname, '..', 'battle_scheduler.js'));
const { createIntent, createScheduler, canonSlots, makeSnapshotSpec,
  SLOT_VOLATILE_FIELDS, SIDE_CONDITION_FIELDS, ACTOR_FIELDS, UNCLASSIFIED_FIELDS } = BattleScheduler;

// ===== 小道具: 決定的rng =====
function seqRng(values) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('seqRng exhausted');
    return values[i++];
  };
}
function countingRng(fn) {
  const calls = [];
  const wrapped = (...a) => { calls.push(1); return fn ? fn(...a) : Math.random(); };
  wrapped.calls = calls;
  return wrapped;
}
function throwingRng() {
  return () => { throw new Error('rng must not be called'); };
}

// ===== 小道具: 単純priorityOfビルダー(基本優先度0固定。orderingMoveベース) =====
function makePriorityOf(basePriorityByMove, extraContribFn) {
  return function (intent) {
    const base = (basePriorityByMove && basePriorityByMove[intent.orderingMove] != null)
      ? basePriorityByMove[intent.orderingMove] : 0;
    const contributions = extraContribFn ? extraContribFn(intent) : [];
    const effective = contributions.reduce((s, c) => s + c.delta, base);
    return { basePriority: base, contributions, effectivePriority: effective };
  };
}

function makeWorld(actorSpeeds, presentSet) {
  return {
    speeds: Object.assign({}, actorSpeeds),
    present: presentSet ? new Set(presentSet) : new Set(Object.keys(actorSpeeds)),
    trickRoom: false,
  };
}
function ctxFromWorld(world, priorityOf, orderModifierOf) {
  return {
    isPresent: (actorId) => world.present.has(actorId),
    priorityOf: priorityOf || makePriorityOf({}),
    speedOf: (actorId) => world.speeds[actorId],
    trickRoom: () => !!world.trickRoom,
    orderModifierOf: orderModifierOf || (() => 'normal'),
  };
}

// =========================================================================
// テスト1: 4個体の通常行動、優先度→速度で並ぶ。途中でspeedOfが変わったら未行動者同士が入れ替わる
// =========================================================================
test('1. 4個体(self×2/opp×2)は優先度→速度で並び、途中の速度変化で未行動者が入れ替わる', () => {
  const world = makeWorld({ A: 100, B: 90, C: 80, D: 70 });
  const ctx = ctxFromWorld(world);
  const rng = throwingRng(); // このテストにtieは無いのでrngは呼ばれないはず
  const intents = [
    createIntent({ actorId: 'A', presenceEpoch: 1, sideId: 'self', slotId: 0, kind: 'move', orderingMove: 'x' }),
    createIntent({ actorId: 'B', presenceEpoch: 1, sideId: 'self', slotId: 1, kind: 'move', orderingMove: 'x' }),
    createIntent({ actorId: 'C', presenceEpoch: 1, sideId: 'opp', slotId: 0, kind: 'move', orderingMove: 'x' }),
    createIntent({ actorId: 'D', presenceEpoch: 1, sideId: 'opp', slotId: 1, kind: 'move', orderingMove: 'x' }),
  ];
  const sched = createScheduler(intents, ctx, { rng });

  const first = sched.next();
  assert.equal(first.actorId, 'A'); // 100が最速
  sched.finish(first.actionId);

  // 未行動者(B/C/D)の中でDが突然最速になる → 次はDが選ばれるはず(1回ソートして終わりではない)
  world.speeds.D = 200;
  const second = sched.next();
  assert.equal(second.actorId, 'D');
  sched.finish(second.actionId);

  const third = sched.next();
  assert.equal(third.actorId, 'B'); // 残りはB(90)>C(80)
  sched.finish(third.actionId);

  const fourth = sched.next();
  assert.equal(fourth.actorId, 'C');
  sched.finish(fourth.actionId);

  assert.equal(sched.next(), null);
});

// =========================================================================
// テスト2: アンコールでexecutionMoveが変わってもorderingMoveの優先度で並ぶ
// =========================================================================
test('2. executionMoveが変わってもorderingMoveの優先度で並ぶ', () => {
  const world = makeWorld({ X: 50, Y: 150 }); // Yの方が素早さは高い
  const priorityOf = makePriorityOf({ quickattack: 1, tackle: 0 }); // orderingMoveで引く
  const ctx = ctxFromWorld(world, priorityOf);
  const intents = [
    // アンコールでtackleを強制されたが、選んだ技(orderingMove)はquickattack=優先度1
    createIntent({ actorId: 'X', presenceEpoch: 1, kind: 'move', orderingMove: 'quickattack', executionMove: 'tackle' }),
    createIntent({ actorId: 'Y', presenceEpoch: 1, kind: 'move', orderingMove: 'tackle', executionMove: 'tackle' }),
  ];
  const sched = createScheduler(intents, ctx, { rng: throwingRng() });
  const winner = sched.next();
  assert.equal(winner.actorId, 'X'); // 素早さで劣るが選択技の優先度が高いので先
  assert.equal(winner.executionMove, 'tackle');
  assert.equal(winner.orderingMove, 'quickattack');
  sched.finish(winner.actionId);
  const second = sched.next();
  assert.equal(second.actorId, 'Y');
});

// =========================================================================
// テスト3: 条件付き優先(グラススライダー型)。寄与が消えても他の寄与は残る(両方向)
// =========================================================================
test('3. 条件付き優先の寄与が消えても他の寄与は残る(両方向)', () => {
  const world = { grassActive: true, quickClaw: true };
  const wspeed = makeWorld({ Z: 10 });
  function priorityOf(intent) {
    const contributions = [];
    if (world.grassActive) contributions.push({ sourceId: 'grassy_glide', delta: 1, reason: 'グラスフィールド中は+1' });
    if (world.quickClaw) contributions.push({ sourceId: 'quick_claw', delta: 3, reason: 'せんせいのツメ発動' });
    const base = 0;
    return { basePriority: base, contributions, effectivePriority: contributions.reduce((s, c) => s + c.delta, base) };
  }
  const ctx = ctxFromWorld(wspeed, priorityOf);
  const intent = createIntent({ actorId: 'Z', presenceEpoch: 1, kind: 'move', orderingMove: 'grassyglide' });

  // 両方成立
  let sched = createScheduler([intent], ctx, { rng: throwingRng() });
  sched.next();
  let d = sched.lastDecision();
  assert.equal(d.priority.contributions.length, 2);
  assert.equal(d.priority.effectivePriority, 4);

  // フィールドだけ消える → quickClawの寄与は残る
  world.grassActive = false;
  sched = createScheduler([createIntent({ actorId: 'Z', presenceEpoch: 1, kind: 'move', orderingMove: 'grassyglide' })], ctx, { rng: throwingRng() });
  sched.next();
  d = sched.lastDecision();
  assert.deepEqual(d.priority.contributions.map(c => c.sourceId), ['quick_claw']);
  assert.equal(d.priority.effectivePriority, 3);

  // 逆方向: せんせいのツメだけ消えてフィールドが戻る
  world.grassActive = true; world.quickClaw = false;
  sched = createScheduler([createIntent({ actorId: 'Z', presenceEpoch: 1, kind: 'move', orderingMove: 'grassyglide' })], ctx, { rng: throwingRng() });
  sched.next();
  d = sched.lastDecision();
  assert.deepEqual(d.priority.contributions.map(c => c.sourceId), ['grassy_glide']);
  assert.equal(d.priority.effectivePriority, 1);
});

// =========================================================================
// テスト4: next()を何回呼んでもorderModifierOfの問い合わせはターン開始の1回だけ
// =========================================================================
test('4. orderModifierOfはIntentごとにターン開始(construct時)の1回だけ問い合わせる', () => {
  const world = makeWorld({ A: 10, B: 20, C: 30 });
  let calls = 0;
  const orderModifierOf = () => { calls++; return 'normal'; };
  const ctx = ctxFromWorld(world, undefined, orderModifierOf);
  const intents = ['A', 'B', 'C'].map(id => createIntent({ actorId: id, presenceEpoch: 1, kind: 'move', orderingMove: 'x' }));
  const sched = createScheduler(intents, ctx, { rng: throwingRng() });
  assert.equal(calls, 3); // construct時に3件分

  // next()を何度呼んでも増えない
  sched.next(); sched.next(); sched.next(); sched.next(); sched.pending(); sched.lastDecision();
  assert.equal(calls, 3);

  // addIntentで追加した1件だけ+1される(そのIntentにとっての「開始時」)
  sched.addIntent(createIntent({ actorId: 'D', presenceEpoch: 1, kind: 'move', orderingMove: 'x' }));
  assert.equal(calls, 4);
});

// =========================================================================
// テスト5: 退場/ひんし/同ターン再入場で旧Intentは復活しない
// =========================================================================
test('5. 退場(switched_out)/ひんし(fainted)/同ターン再入場で旧Intentは復活しない', () => {
  const world = makeWorld({ A: 10, B: 20, C: 30, D: 5 });
  const ctx = ctxFromWorld(world);
  const oldA = createIntent({ actorId: 'A', presenceEpoch: 1, kind: 'move', orderingMove: 'x' });
  const bIntent = createIntent({ actorId: 'B', presenceEpoch: 1, kind: 'move', orderingMove: 'x' });
  const cIntent = createIntent({ actorId: 'C', presenceEpoch: 1, kind: 'move', orderingMove: 'x' });
  const dIntent = createIntent({ actorId: 'D', presenceEpoch: 1, kind: 'move', orderingMove: 'x' });
  const sched = createScheduler([oldA, bIntent, cIntent, dIntent], ctx, { rng: throwingRng() });

  // 本流がAの退場を明示的に伝える
  sched.invalidateActor('A', 'switched_out');
  // 同ターンに新しい個体(新epoch)がAのスロットに入り、誤ってaddIntentされても旧Aは復活しない
  const newA = createIntent({ actorId: 'A', presenceEpoch: 2, kind: 'move', orderingMove: 'x' });
  sched.addIntent(newA);

  // Cはひんし(本流がfaintedで無効化)
  sched.cancel(cIntent.actionId, 'fainted');

  // DはisPresentがfalseを返す個体(退場したのにinvalidateActorが呼ばれていない想定=保険経路)
  world.present.delete('D');

  const pendingBefore = sched.pending().map(i => i.actionId).sort();
  assert.ok(!pendingBefore.includes(oldA.actionId), '旧Aのintentはpendingに残らない');
  assert.ok(!pendingBefore.includes(cIntent.actionId));
  assert.ok(pendingBefore.includes(newA.actionId), '新epochのAのintentは有効');

  const seen = [];
  let picked;
  while ((picked = sched.next())) { seen.push(picked); sched.finish(picked.actionId); }

  assert.ok(!seen.some(p => p.actionId === oldA.actionId));
  assert.ok(!seen.some(p => p.actionId === cIntent.actionId));
  assert.ok(!seen.some(p => p.actionId === dIntent.actionId), 'isPresent=falseのDは自動cancelされ選ばれない');
  assert.ok(seen.some(p => p.actionId === newA.actionId), '新epochのAは実行される');

  // 終端の確認(直接内部を見ずAPI経由): pending()から消えている & 再cancel/finishはエラーになる=戻せない
  assert.throws(() => sched.finish(oldA.actionId));
  assert.throws(() => sched.cancel(oldA.actionId, 'x'));
  assert.throws(() => sched.finish(dIntent.actionId));
});

// =========================================================================
// テスト6: トリックルームは速度帯だけ反転(優先度・first/last帯は不変)
// =========================================================================
test('6. トリックルームは速度帯だけ反転。優先度/kind帯/order modifier帯には影響しない', () => {
  const world = makeWorld({ Fast: 100, Slow: 10 });
  const ctx = ctxFromWorld(world);
  function run() {
    const intents = [
      createIntent({ actorId: 'Fast', presenceEpoch: 1, kind: 'move', orderingMove: 'x' }),
      createIntent({ actorId: 'Slow', presenceEpoch: 1, kind: 'move', orderingMove: 'x' }),
    ];
    return createScheduler(intents, ctx, { rng: throwingRng() });
  }
  world.trickRoom = false;
  assert.equal(run().next().actorId, 'Fast');
  world.trickRoom = true;
  assert.equal(run().next().actorId, 'Slow');

  // 帯(kind)はTRの影響を受けない: switchは常にmoveより先
  world.trickRoom = true;
  const sched2 = createScheduler([
    createIntent({ actorId: 'Slow', presenceEpoch: 1, kind: 'move', orderingMove: 'x' }), // TR下では本来速い
    createIntent({ actorId: 'Fast', presenceEpoch: 1, kind: 'switch' }), // 速いのに交代=switch帯
  ], ctx, { rng: throwingRng() });
  assert.equal(sched2.next().actorId, 'Fast', 'switch帯はTRでも常に先');
});

// =========================================================================
// テスト7: tie=randomは集団につき1回だけrng消費。canonは決定的でrngを呼ばない
// =========================================================================
test('7a. tie(random)は同速集団でrngを1回だけ消費する', () => {
  const world = makeWorld({ A: 50, B: 50, C: 50, D: 50 });
  const ctx = ctxFromWorld(world);
  const rng = countingRng(() => 0.4999999);
  const intents = ['A', 'B', 'C', 'D'].map(id => createIntent({ actorId: id, presenceEpoch: 1, kind: 'move', orderingMove: 'x' }));
  const sched = createScheduler(intents, ctx, { rng, tiePolicy: 'random' });
  const order = [];
  let p;
  while ((p = sched.next())) { order.push(p.actorId); sched.finish(p.actionId); }
  assert.equal(order.length, 4);
  assert.equal(new Set(order).size, 4);
  assert.equal(rng.calls.length, 1, '4体同速のtie解決でrngが呼ばれるのは1回だけ');
});

test('7b. tie(canon)はcanonSlotsの順で決定的・rngを呼ばない', () => {
  const world = makeWorld({ A: 50, B: 50, C: 50 });
  const ctx = ctxFromWorld(world);
  const intents = ['C', 'A', 'B'].map(id => createIntent({ actorId: id, presenceEpoch: 1, kind: 'move', orderingMove: 'x' }));
  const sched = createScheduler(intents, ctx, { rng: throwingRng(), tiePolicy: 'canon', canonSlots: ['A', 'B', 'C'] });
  const order = [];
  let p;
  while ((p = sched.next())) { order.push(p.actorId); sched.finish(p.actionId); }
  assert.deepEqual(order, ['A', 'B', 'C']);
});

// =========================================================================
// テスト8: moveToFront/moveToBackは同帯内の先頭/末尾。effectivePriorityは変えない
// =========================================================================
test('8. moveToFront/moveToBackは同帯内の並びだけ変え、有効優先度は不変', () => {
  const world = makeWorld({ A: 100, B: 50, C: 10 });
  const priorityOf = makePriorityOf({ x: 5 }); // 全員同じ優先度5(帯内)
  const ctx = ctxFromWorld(world, priorityOf);
  const iA = createIntent({ actorId: 'A', presenceEpoch: 1, kind: 'move', orderingMove: 'x' });
  const iB = createIntent({ actorId: 'B', presenceEpoch: 1, kind: 'move', orderingMove: 'x' });
  const iC = createIntent({ actorId: 'C', presenceEpoch: 1, kind: 'move', orderingMove: 'x' });
  const sched = createScheduler([iA, iB, iC], ctx, { rng: throwingRng() });

  // 通常なら速度順でA→B→C。Cを先頭に、Aを末尾に指示する(おさきにどうぞ/さきおくり)
  sched.moveToFront(iC.actionId);
  sched.moveToBack(iA.actionId);

  const first = sched.next();
  assert.equal(first.actorId, 'C');
  const d1 = sched.lastDecision();
  assert.equal(d1.priority.effectivePriority, 5, 'moveToFrontしても優先度そのものは変わらない');
  sched.finish(first.actionId);

  const second = sched.next();
  assert.equal(second.actorId, 'B'); // 指示なしのBが中間
  sched.finish(second.actionId);

  const third = sched.next();
  assert.equal(third.actorId, 'A'); // moveToBackで最後
  const d3 = sched.lastDecision();
  assert.equal(d3.priority.effectivePriority, 5, 'moveToBackしても優先度そのものは変わらない');
});

// =========================================================================
// テスト9: 全Intentが終端になるとnext()がnull。行動不能/失敗でもfinish()で終端に進める
// =========================================================================
test('9. 全Intentが終端でnext()==null。失敗した行動でもfinish()で終端に進める', () => {
  const world = makeWorld({ A: 10, B: 20 });
  const ctx = ctxFromWorld(world);
  const iA = createIntent({ actorId: 'A', presenceEpoch: 1, kind: 'move', orderingMove: 'x' });
  const iB = createIntent({ actorId: 'B', presenceEpoch: 1, kind: 'move', orderingMove: 'x' });
  const sched = createScheduler([iA, iB], ctx, { rng: throwingRng() });

  const first = sched.next(); // B(速い)
  assert.equal(first.actorId, 'B');
  // 「行動不能/失敗」でもfinish()を呼べば終端に進む(schedulerは成否を知らない=そのまま消費させるだけ)
  sched.finish(first.actionId);

  const second = sched.next();
  assert.equal(second.actorId, 'A');
  sched.finish(second.actionId);

  assert.equal(sched.next(), null);
  assert.equal(sched.pending().length, 0);
});

// =========================================================================
// テスト10: snapshot()→restore()で同じ順序が再現される(rngを同じ列で注入)
// =========================================================================
test('10. snapshot()→restore()で同じ順序を再現する', () => {
  const worldA = makeWorld({ A: 50, B: 50, C: 50, D: 50 });
  const ctxA = ctxFromWorld(worldA);
  const rngValues = [0.1234567]; // tie群が1回だけ引く値(同じ列を両方に注入)

  const intentsA = ['A', 'B', 'C', 'D'].map(id => createIntent({ actorId: id, presenceEpoch: 1, kind: 'move', orderingMove: 'x' }));
  const schedA = createScheduler(intentsA, ctxA, { rng: seqRng(rngValues.slice()) });

  const first = schedA.next();
  schedA.finish(first.actionId);
  const snap = schedA.snapshot();

  // 続きを2通りで進める: ①元のschedAをそのまま続行 ②snapshotから復元した新schedulerを続行
  const worldB = makeWorld({ A: 50, B: 50, C: 50, D: 50 });
  const ctxB = ctxFromWorld(worldB);
  const schedB = createScheduler.restore(snap, ctxB, { rng: throwingRng() });
  // restoreはtieCacheも復元しているので、残りのtie解決には追加のrngが要らないはず(throwingRngで検証)

  const restA = [first.actorId];
  let p;
  while ((p = schedA.next())) { restA.push(p.actorId); schedA.finish(p.actionId); }

  const restB = [first.actorId];
  while ((p = schedB.next())) { restB.push(p.actorId); schedB.finish(p.actionId); }

  assert.deepEqual(restB, restA, 'restoreした側も同じ順序を再現する');
  assert.equal(restA.length, 4);
});

// =========================================================================
// テスト11: canonSlotsが両視点で同じ配列
// =========================================================================
test('11. canonSlotsは両クライアントの視点で同じ配列を返す', () => {
  // クライアントA(ホスト)視点: self=host, opp=guest
  const sidesFromHostView = { self: { slots: ['h0', 'h1'] }, opp: { slots: ['g0', 'g1'] } };
  const outHost = canonSlots(sidesFromHostView, 'self');

  // クライアントB(ゲスト)視点: self=guest, opp=host(鏡写し)
  const sidesFromGuestView = { self: { slots: ['g0', 'g1'] }, opp: { slots: ['h0', 'h1'] } };
  const outGuest = canonSlots(sidesFromGuestView, 'opp'); // ゲストにとって「ホスト側」はopp

  assert.deepEqual(outHost, outGuest);
  assert.deepEqual(outHost, [
    { sideId: 'host', slotId: 0, actorId: 'h0' },
    { sideId: 'host', slotId: 1, actorId: 'h1' },
    { sideId: 'guest', slotId: 0, actorId: 'g0' },
    { sideId: 'guest', slotId: 1, actorId: 'g1' },
  ]);
});

// =========================================================================
// テスト12: makeSnapshotSpec()が3定数の和集合と一致し、重複・未分類の扱いを検査(report専用)
// =========================================================================
test('12. makeSnapshotSpec()は3定数の和集合と一致し重複が無い(未分類はreportのみ)', () => {
  const spec = makeSnapshotSpec();
  const expectedUnion = new Set([...SLOT_VOLATILE_FIELDS, ...SIDE_CONDITION_FIELDS, ...ACTOR_FIELDS]);
  assert.equal(spec.fields.length, expectedUnion.size, '和集合のサイズが一致(=3定数間に重複が無い)');
  for (const f of spec.fields) assert.ok(expectedUnion.has(f));
  for (const f of expectedUnion) assert.ok(spec.fields.includes(f));
  assert.equal(spec.duplicates.length, 0, '3定数間で同じ欄名が重複していない');

  // 未分類は「在ってもfailにしない」。ここでは存在をreportするだけ(0件を強制しない)
  assert.ok(Array.isArray(spec.unclassified));
  console.log(`    ℹ UNCLASSIFIED_FIELDS: ${spec.unclassified.length}件 → ${spec.unclassified.join(', ')}`);
  // UNCLASSIFIED_FIELDSは3定数のどれとも重複しない(定義の整合性)
  for (const f of UNCLASSIFIED_FIELDS) assert.ok(!expectedUnion.has(f), `${f} が3定数とUNCLASSIFIEDの両方に入っている`);
});

// =========================================================================
// おまけ: createIntent自体の契約(A節)の最小確認
// =========================================================================
test('0. createIntentの基本契約(status=pending/cancelReason=null/不正kindは例外)', () => {
  const i = createIntent({ actorId: 'A', presenceEpoch: 1, kind: 'move', orderingMove: 'x', executionMove: 'y' });
  assert.equal(i.status, 'pending');
  assert.equal(i.cancelReason, null);
  assert.equal(i.orderingMove, 'x');
  assert.equal(i.executionMove, 'y');
  assert.throws(() => createIntent({ actorId: 'A', presenceEpoch: 1, kind: 'not_a_kind' }));
});
