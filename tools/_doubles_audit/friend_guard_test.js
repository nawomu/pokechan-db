/*
 * tools/_doubles_audit/friend_guard_test.js
 *   監査対象: 特性「フレンドガード」(ダブルバトル) — 味方が受ける攻撃技のダメージ 3/4
 *   実行: node tools/_doubles_audit/friend_guard_test.js
 *   ★監査専用。エンジン/既存ファイルは一切変更しない(読むだけ)。
 *
 * === 期待値の出どころ(権威ソース。エンジンの出力を写していない) ===
 * ポケモンWiki『フレンドガード』 https://wiki.pokemonwiki.com/wiki/フレンドガード
 *   (curl -A "Mozilla/5.0" で 2026-09-11 に本文取得。wiki.ポケモン.com は 301 で同ドメインへ転送)
 *
 *   [引用 C1 / 効果 節]
 *     「自分以外の味方ポケモンが受ける攻撃技のダメージが3/4倍になる。」
 *   [引用 C2 / 備考 節]
 *     「自身へのダメージは減らせないので、シングルバトルで発動することはない。」
 *   [引用 C3 / 特性の仕様 節]
 *     「味方から受けた攻撃技によるダメージも減らせる。」
 *   [引用 C4 / 特性の仕様 節]
 *     「ダメージ固定技によるダメージは減らない。」
 *   [引用 C5 / 説明文 Champions]
 *     「味方が受けるダメージを3/4にする。」   ← Champions に搭載されている証拠(説明文が存在する)
 *
 *   Champions 搭載確認: master/abilities.json slug="friend-guard" →
 *     "champions": true / "regulation": "M-C" / "champions_pokemon_count": 2
 *     (pokechan_data.js 実測の搭載2体 = イッカネズミ(4ひきかぞく) ab1 / ビビヨン(はなぞののもよう) ab3)
 *   → blocked ではない。
 *
 * === 数値の導出(エンジンを見ずに、引用 C1 の「3/4倍」だけから立てる) ===
 *   同一配置・同一シードで「自分以外の味方が受けるダメージ」を2回測る。
 *     (a) 味方枠(self:0)の特性 = フレンドガード
 *     (b) 味方枠(self:0)の特性 = テクニシャン(= 対照。保持者自身の低威力技しか見ない特性で、
 *         この配置では保持者は攻撃しない/される側でもないため受け側のダメージに一切関与しない)
 *   引用C1が成り立つなら (a) / (b) == 3/4。成り立たないなら == 1/1。
 *   ダメージ乱数(85〜100%)は同一シード・同一配置なので両者で同じ値が引かれる。
 *   pokeRound の丸めが鎖の途中に入るため、最終HP差は厳密に0.75倍ではなく ±1 程度ずれる
 *   → 比は 0.75±0.02 の帯で判定する(帯の中心 0.75 は Wiki の値そのもの)。
 *
 * === テストの自己検証(「エンジンがそうしているから通る」を防ぐ) ===
 *   test 0 で、受け側自身の特性「ファーコート」(物理×0.5・エンジン実装済 L2053)を同じ測り方に
 *   かけ、比が 0.5 付近に落ちることを確認する。= この計測ハーネスは「特性によるダメージ補正」を
 *   ちゃんと検出できる、という前提の証明。ここが通った上で test 1 が 1.00 なら、
 *   「測れていない」ではなく「フレンドガードが効いていない」が確定する。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// --- tools/_doubles_fixture_test.js の流儀をそのまま写す(require しない=あちらはテストを走らせてしまう) ---
function placeSlot(E, side, idx, pokeName, moveKey, opts) {
  const st = E.slotOf(side, idx);
  opts = opts || {};
  st.poke = pokeName ? pokeByName(pokeName) : null;
  st.moves = moveKey ? [data.WAZA_MAP[moveKey]] : [];
  st.selectedMoveIdx = moveKey ? 0 : null;
  st.currentHp = st.poke ? (opts.hp != null ? opts.hp : E.realStat(st, 'hp')) : null;
  st.fainted = !!opts.fainted;
  if (opts.fainted) st.currentHp = 0;
  st.targetChoice = opts.targetChoice || null;
  if (opts.ability != null) st.ability = opts.ability;
  return st;
}
function build2v2() {
  const E = buildEngine();
  E.setFormat({ slotsPerSide: 2 });
  E.sides.self.poke = pokeByName('フシギバナ');
  E.sides.self.moves = [];
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.poke = pokeByName('フシギバナ');
  E.sides.opp.moves = [];
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.resetBattle();
  return E;
}
// ★E.battleLog は vm(別レルム)の配列なので for で1件ずつ読み替える(既知の罠)
function hitLines(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const m = /^(.+?) の (.+?)！ (.+?) に (\d+) ダメージ！/.exec(String(log[i].msg));
    if (m) out.push({ attacker: m[1], move: m[2], defender: m[3], dmg: Number(m[4]) });
  }
  return out;
}
function msgList(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) out.push(String(log[i].msg));
  return out;
}

const HOLDER = 'イッカネズミ(4ひきかぞく)';   // フレンドガード搭載(ab1)・Champions搭載2体のうち1体
const CONTROL_ABILITY = 'テクニシャン';        // 対照: この配置の受け側ダメージに関与しない
const SEED = 42;

// 配置1: 敵(opp:1)が「保持者の味方」(self:1)を殴る。保持者は self:0 で何もしない。
//   引用C1の「自分以外の味方ポケモンが受ける攻撃技のダメージ」= self:1 が受けるダメージ。
function measureAllyHit(holderAbility, moveKey, victimAbility) {
  const E = build2v2();
  placeSlot(E, 'self', 0, HOLDER, null, { ability: holderAbility });
  placeSlot(E, 'self', 1, 'カメックス', null, victimAbility ? { ability: victimAbility } : undefined);
  placeSlot(E, 'opp', 0, null, null);
  placeSlot(E, 'opp', 1, 'ケンタロス', moveKey, { targetChoice: { side: 'self', idx: 1 } });
  E.setRandom(mulberry32(SEED));
  E.runTurn();
  const hits = hitLines(E.battleLog).filter(h => h.defender === 'カメックス');
  assert.equal(hits.length, 1,
    `計測前提: 味方(self:1)が1発だけ受ける配置であること。実ログ=${JSON.stringify(msgList(E.battleLog))}`);
  return hits[0].dmg;
}

// 配置2: 敵(opp:1)が「保持者そのもの」(self:0)を殴る。引用C2の検証用。
function measureHolderHit(holderAbility) {
  const E = build2v2();
  placeSlot(E, 'self', 0, HOLDER, null, { ability: holderAbility });
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, null, null);
  placeSlot(E, 'opp', 1, 'ケンタロス', 'hataku', { targetChoice: { side: 'self', idx: 0 } });
  E.setRandom(mulberry32(SEED));
  E.runTurn();
  const hits = hitLines(E.battleLog).filter(h => h.defender === HOLDER);
  assert.equal(hits.length, 1, `計測前提: 保持者(self:0)が1発だけ受ける配置であること。実ログ=${JSON.stringify(msgList(E.battleLog))}`);
  return hits[0].dmg;
}

// 配置3: 保持者(self:0)自身が じしん(周囲全体)を撃ち、味方(self:1)を巻き込む。引用C3の検証用。
//   = 「味方から受けた攻撃技」に当たる。self:1 が受ける分だけを読む。
function measureAllySourced(holderAbility) {
  const E = build2v2();
  placeSlot(E, 'self', 0, HOLDER, 'jishin', { ability: holderAbility });
  placeSlot(E, 'self', 1, 'カメックス', null);
  placeSlot(E, 'opp', 0, 'ケンタロス', null);
  placeSlot(E, 'opp', 1, 'ケンタロス', null);
  E.setRandom(mulberry32(SEED));
  E.runTurn();
  const hits = hitLines(E.battleLog).filter(h => h.defender === 'カメックス');
  assert.equal(hits.length, 1,
    `計測前提: じしんが味方(self:1)を1回巻き込むこと(ダブルの範囲技)。実ログ=${JSON.stringify(msgList(E.battleLog))}`);
  return hits[0].dmg;
}

// ===== test 0: 計測ハーネスの自己検証(特性によるダメージ補正を本当に検出できるか) =====
test('FG-0(ハーネス自己検証): 同じ測り方で「ファーコート(物理×0.5)」は比0.5を検出できる', () => {
  const plain = measureAllyHit(CONTROL_ABILITY, 'hataku', 'げきりゅう');     // 受け側=無関係な特性
  const furCoat = measureAllyHit(CONTROL_ABILITY, 'hataku', 'ファーコート'); // 受け側=物理半減
  const ratio = furCoat / plain;
  assert.ok(Math.abs(ratio - 0.5) <= 0.03,
    `この計測法は特性のダメージ補正を検出できるはず(×0.5 を期待)。素=${plain} / ファーコート=${furCoat} / 比=${ratio.toFixed(4)}`);
});

// ===== test 1: 引用C1 — 自分以外の味方が受ける攻撃技のダメージが 3/4 倍 =====
test('FG-1(引用C1): 味方(self:1)が受ける攻撃技のダメージが 3/4 倍になる', () => {
  const withFG = measureAllyHit('フレンドガード', 'hataku');
  const control = measureAllyHit(CONTROL_ABILITY, 'hataku');
  const ratio = withFG / control;
  assert.ok(withFG < control,
    `フレンドガードがある側の味方はダメージが減るはず。FGあり=${withFG} / 対照=${control}`);
  assert.ok(Math.abs(ratio - 0.75) <= 0.02,
    `ポケモンWiki『フレンドガード』効果節「自分以外の味方ポケモンが受ける攻撃技のダメージが3/4倍になる」`
    + ` → 期待 比=0.75。FGあり=${withFG} / 対照=${control} / 実測 比=${ratio.toFixed(4)}`);
});

// ===== test 2: 引用C2 — 保持者自身のダメージは減らない =====
test('FG-2(引用C2): 保持者自身(self:0)が受けるダメージは減らない', () => {
  const withFG = measureHolderHit('フレンドガード');
  const control = measureHolderHit(CONTROL_ABILITY);
  assert.equal(withFG, control,
    `ポケモンWiki『フレンドガード』備考節「自身へのダメージは減らせない」 → 保持者自身のダメージは対照と同値のはず。`
    + ` FGあり=${withFG} / 対照=${control}`);
});

// ===== test 3: 引用C3 — 味方から受けた攻撃技のダメージも減らせる =====
test('FG-3(引用C3): 味方(保持者自身の範囲技)から受けたダメージも 3/4 倍になる', () => {
  const withFG = measureAllySourced('フレンドガード');
  const control = measureAllySourced(CONTROL_ABILITY);
  const ratio = withFG / control;
  assert.ok(withFG < control,
    `味方から受けた攻撃技のダメージも減るはず。FGあり=${withFG} / 対照=${control}`);
  assert.ok(Math.abs(ratio - 0.75) <= 0.02,
    `ポケモンWiki『フレンドガード』特性の仕様節「味方から受けた攻撃技によるダメージも減らせる」`
    + ` → 期待 比=0.75。FGあり=${withFG} / 対照=${control} / 実測 比=${ratio.toFixed(4)}`);
});

// ===== test 4: 引用C4 — ダメージ固定技は減らない(除外の検証) =====
test('FG-4(引用C4): ダメージ固定技(ナイトヘッド)のダメージは減らない', () => {
  const withFG = measureAllyHit('フレンドガード', 'naitoheddo');
  const control = measureAllyHit(CONTROL_ABILITY, 'naitoheddo');
  assert.equal(withFG, control,
    `ポケモンWiki『フレンドガード』特性の仕様節「ダメージ固定技によるダメージは減らない」`
    + ` → 固定ダメージは対照と同値のはず。FGあり=${withFG} / 対照=${control}`);
  assert.equal(control, 50,
    `前提: ナイトヘッドの Champions 固定値(pokechan_data.js battle_data champions_amount=50)。実測=${control}`);
});
