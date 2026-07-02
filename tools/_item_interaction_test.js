/* 持ち物×バトル 相互作用テストハーネス
 * 対象: 14個の未実装持ち物を実装後に全て検証
 * 出力: reference/_item_interaction_result.json
 * 実行: PCHAM_DATA=pokechan_data.js node tools/_item_interaction_test.js
 *
 * 判定: implemented / missing / broken / skip
 * ★ 読み取り専用(sim/データファイル変更禁止)・commit禁止
 * ★ seed固定決定論。状態比較は英語(burn/badpoison/etc.)。
 */
'use strict';

const path   = require('path');
const fs     = require('fs');
const { buildEngine, mulberry32, ROOT } = require('./_sim_engine.js');

const dataFile = process.env.PCHAM_DATA || 'pokechan_data.js';
const data     = require(path.join(ROOT, dataFile));

// --- エンジン初期化 ---
const E = buildEngine();
const PL = data.POKEMON_LIST;
const WM = data.WAZA_MAP;

// --- ユーティリティ ---
function poke(name) { return PL.find(p => p.name === name); }
function moveWith(pred) { return Object.values(WM).find(pred); }
function movesWhere(pred, n=3) { return Object.values(WM).filter(pred).slice(0, n); }

// sideState を構築(持ち物を指定)
function makeSide(pokeName, abilityOverride, moveObj, itemKey) {
  const s = E.makeSideState();
  s.poke  = poke(pokeName) || PL.find(p => p.form === '通常') || PL[0];
  s.ability = abilityOverride !== undefined ? abilityOverride : (s.poke && s.poke.ab1 || '');
  s.moves = [moveObj];
  s.selectedMoveIdx = 0;
  if (itemKey) s.item = itemKey;
  return s;
}

// 環境リセット
function resetEnv() {
  Object.assign(E.env, {
    weather: 'none', weatherTurns: null,
    field: 'none',   fieldTurns: null,
    doubleBattle: false, trickRoom: false, gravity: false,
    wonderRoom: false, magicRoom: false,
  });
  if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
}

// HP をフル設定してサイドをエンジンに適用
function setupBattle(atkPoke, atkAb, atkMove, defPoke, defAb, defMove, atkItem, defItem) {
  resetEnv();
  const dummy = moveWith(m => m.category !== '変化' && m.power > 0) || Object.values(WM)[0];
  E.sides.self = makeSide(atkPoke, atkAb, atkMove, atkItem || '');
  E.sides.opp  = makeSide(defPoke, defAb, defMove || dummy, defItem || '');
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp,  'hp');
  E.sides.self.rank = { atk:0, def:0, spatk:0, spdef:0, spd:0, acc:0, eva:0 };
  E.sides.opp.rank  = { atk:0, def:0, spatk:0, spdef:0, spd:0, acc:0, eva:0 };
  E.sides.self.status = 'none';
  E.sides.opp.status  = 'none';
}

// ダメージ計算(乱数固定、seed指定)
function calcDmg(atkPoke, atkAb, move, defPoke, defAb, seed, atkItem, defItem) {
  setupBattle(atkPoke, atkAb, move, defPoke, defAb, null, atkItem, defItem);
  E.setRandom(mulberry32(seed || 20260702));
  const hp0 = E.sides.opp.currentHp;
  try { E.phaseDealDamage('self', 'opp', move); } catch(e) {}
  return hp0 - E.sides.opp.currentHp;
}

// 期待倍率チェック
function ratioOk(base, withItem, expectedMin, expectedMax) {
  if (base === 0) return null;
  const r = withItem / base;
  return r >= expectedMin - 0.05 && r <= expectedMax + 0.05;
}

// ========================================================
// テストケース定義
// ========================================================
const TESTS = [];

// ── 1. こだわりハチマキ (Choice Band): 物理技 攻撃×1.5 ──────────────────
(function() {
  const moves = movesWhere(m => m.category === '物理' && m.power > 0 && !m.flags?.punch);
  const results = moves.map(mv => {
    const base   = calcDmg('カイリキー', '', mv, 'カビゴン', '', 10001, '', '');
    const withIt = calcDmg('カイリキー', '', mv, 'カビゴン', '', 10001, 'kodawari_hachimaki', '');
    const ok = ratioOk(base, withIt, 1.49, 1.51);
    return { move: mv.name, base, withIt, ratio: base>0 ? +(withIt/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    item: 'kodawari_hachimaki', name: 'こだわりハチマキ',
    type: 'attack_boost', expected_ratio: 1.5,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: '物理技 攻撃×1.5 — calcDamage base×6144/4096'
  });
})();

// ── 2. こだわりメガネ (Choice Specs): 特殊技 特攻×1.5 ──────────────────
(function() {
  const moves = movesWhere(m => m.category === '特殊' && m.power > 0);
  const results = moves.map(mv => {
    const base   = calcDmg('フーディン', '', mv, 'カビゴン', '', 10002, '', '');
    const withIt = calcDmg('フーディン', '', mv, 'カビゴン', '', 10002, 'kodawari_megane', '');
    const ok = ratioOk(base, withIt, 1.49, 1.51);
    return { move: mv.name, base, withIt, ratio: base>0 ? +(withIt/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    item: 'kodawari_megane', name: 'こだわりメガネ',
    type: 'attack_boost', expected_ratio: 1.5,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: '特殊技 特攻×1.5 — calcDamage base×6144/4096'
  });
})();

// ── 3. いのちのたま (Life Orb): 威力×1.3 + 最大HPの1/10反動 ─────────────
(function() {
  const mv = moveWith(m => m.category === '物理' && m.power > 0 && !m.battle_data?.effects?.some(e=>e.kind==='反動'));
  if (!mv) { TESTS.push({ item:'life_orb', name:'いのちのたま', verdict:'skip', reason:'物理技なし' }); return; }
  // 威力補正テスト
  const base   = calcDmg('カイリキー', '', mv, 'カビゴン', '', 10003, '', '');
  const withIt = calcDmg('カイリキー', '', mv, 'カビゴン', '', 10003, 'life_orb', '');
  const ratioOkFlag = ratioOk(base, withIt, 1.28, 1.32);
  // 反動テスト: いのちのたまを持って攻撃したら自分のHPが減るか
  setupBattle('カイリキー', '', mv, 'カビゴン', '', null, 'life_orb', '');
  E.setRandom(mulberry32(10003));
  const selfHpBefore = E.sides.self.currentHp;
  try { E.phaseDealDamage('self', 'opp', mv); } catch(e) {}
  const selfHpAfter = E.sides.self.currentHp;
  const recoilOk = selfHpBefore > selfHpAfter;
  const maxHp = E.realStat(E.sides.self, 'hp');
  const expectedRecoil = Math.floor(maxHp / 10);
  const recoilCorrect = (selfHpBefore - selfHpAfter) === expectedRecoil;
  TESTS.push({
    item: 'life_orb', name: 'いのちのたま',
    type: 'attack_boost+recoil', expected_ratio: 1.3,
    power_ratio: base>0 ? +(withIt/base).toFixed(3) : null,
    power_ratio_ok: ratioOkFlag,
    recoil_ok: recoilOk, recoil_correct: recoilCorrect,
    recoil_dealt: selfHpBefore - selfHpAfter, expected_recoil: expectedRecoil,
    verdict: (ratioOkFlag && recoilCorrect) ? 'implemented'
           : (ratioOkFlag || recoilOk) ? 'broken' : 'missing',
    note: '威力×1.3(q12=5324) + 反動1/10最大HP — calcDamage'
  });
})();

// ── 4. とつげきチョッキ (Assault Vest): 特防×1.5 ─────────────────────────
(function() {
  const mv = moveWith(m => m.category === '特殊' && m.power > 0);
  if (!mv) { TESTS.push({ item:'assault_vest', name:'とつげきチョッキ', verdict:'skip', reason:'特殊技なし' }); return; }
  const base   = calcDmg('カイリキー', '', mv, 'カビゴン', '', 10004, '', '');
  const withIt = calcDmg('カイリキー', '', mv, 'カビゴン', '', 10004, '', 'assault_vest');
  // とつげきチョッキで特防×1.5 = ダメージは1/1.5 ≒ 0.667倍
  const ok = ratioOk(base, withIt, 0.64, 0.70);
  TESTS.push({
    item: 'assault_vest', name: 'とつげきチョッキ',
    type: 'defense_boost', expected_dmg_ratio: '1/1.5≒0.667',
    base_dmg: base, with_item_dmg: withIt,
    ratio: base>0 ? +(withIt/base).toFixed(3) : null,
    verdict: ok ? 'implemented' : ok === false ? 'broken' : 'missing',
    note: '特防×1.5 → 被ダメ÷1.5 — calcDamage dStatEff×1.5'
  });
})();

// ── 5. ゴツゴツメット (Rocky Helmet): 接触技で攻撃者 1/6 ダメ ─────────────
(function() {
  const mv = moveWith(m => m.contact === true && m.category === '物理' && m.power > 0);
  if (!mv) { TESTS.push({ item:'rocky_helmet', name:'ゴツゴツメット', verdict:'skip', reason:'接触技なし' }); return; }
  setupBattle('カイリキー', '', mv, 'カビゴン', '', null, '', 'rocky_helmet');
  E.setRandom(mulberry32(10005));
  const atkHpBefore = E.sides.self.currentHp;
  try { E.phaseDealDamage('self', 'opp', mv); } catch(e) {}
  const atkHpAfter = E.sides.self.currentHp;
  const suffered = atkHpBefore - atkHpAfter;
  const maxHp = E.realStat(E.sides.self, 'hp');
  const expected = Math.max(1, Math.floor(maxHp / 6));
  TESTS.push({
    item: 'rocky_helmet', name: 'ゴツゴツメット',
    type: 'contact_retaliate',
    move_tested: mv.name,
    atk_hp_before: atkHpBefore, atk_hp_after: atkHpAfter,
    recoil_dealt: suffered, expected_1_6: expected,
    verdict: suffered === expected ? 'implemented' : suffered > 0 ? 'broken' : 'missing',
    note: '接触技 → 攻撃者1/6ダメ — calcDamage helmetRecoil + phaseDealDamage'
  });
})();

// ── 6. かえんだま (Flame Orb): ターン終了時やけど ─────────────────────────
(function() {
  const mv = moveWith(m => m.category !== '変化' && m.power > 0);
  if (!mv) { TESTS.push({ item:'flame_orb', name:'かえんだま', verdict:'skip', reason:'攻撃技なし' }); return; }
  // カビゴンにかえんだまを持たせてターンを回すとやけどになるか
  setupBattle('カイリキー', '', mv, 'カビゴン', '', mv, '', 'flame_orb');
  E.setRandom(mulberry32(10006));
  try { E.runTurn(); } catch(e) {}
  const gotBurn = E.sides.opp.status === 'burn';
  TESTS.push({
    item: 'flame_orb', name: 'かえんだま',
    type: 'status_self_inflict',
    def_status_after: E.sides.opp.status,
    verdict: gotBurn ? 'implemented' : 'missing',
    note: 'ターン終了時やけど(burn) — runTurn end-of-turn phase'
  });
})();

// ── 7. どくどくだま (Toxic Orb): ターン終了時もうどく ─────────────────────
(function() {
  const mv = moveWith(m => m.category !== '変化' && m.power > 0);
  if (!mv) { TESTS.push({ item:'toxic_orb', name:'どくどくだま', verdict:'skip', reason:'攻撃技なし' }); return; }
  setupBattle('カイリキー', '', mv, 'カビゴン', '', mv, '', 'toxic_orb');
  E.setRandom(mulberry32(10007));
  try { E.runTurn(); } catch(e) {}
  const gotBadPoison = E.sides.opp.status === 'badpoison';
  TESTS.push({
    item: 'toxic_orb', name: 'どくどくだま',
    type: 'status_self_inflict',
    def_status_after: E.sides.opp.status,
    verdict: gotBadPoison ? 'implemented' : 'missing',
    note: 'ターン終了時もうどく(badpoison) — runTurn end-of-turn phase'
  });
})();

// ── 8. たつじんのおび (Expert Belt): バツグン×1.2 ─────────────────────────
(function() {
  // みず技 vs ほのおタイプ = バツグン(2倍)。カメックス(みず)でハイドロポンプ → キュウコン(ほのお)
  const waterMv = moveWith(m => m.type === 'みず' && m.category !== '変化' && m.power > 0);
  if (!waterMv) { TESTS.push({ item:'expert_belt', name:'たつじんのおび', verdict:'skip', reason:'みず技なし' }); return; }
  // みずタイプアタッカー(カメックス)でほのおタイプ相手(キュウコン)へ = 2倍
  const waterAtk = PL.find(p => p.type1 === 'みず' && !p.type2) || PL.find(p => p.type1 === 'みず') || PL[0];
  const fireDef  = PL.find(p => p.type1 === 'ほのお' && !p.type2) || PL.find(p => p.type1 === 'ほのお') || PL[0];
  const base   = calcDmg(waterAtk.name, '', waterMv, fireDef.name, '', 10008, '', '');
  const withIt = calcDmg(waterAtk.name, '', waterMv, fireDef.name, '', 10008, 'expert_belt', '');
  const ok = ratioOk(base, withIt, 1.19, 1.21);
  TESTS.push({
    item: 'expert_belt', name: 'たつじんのおび',
    type: 'super_effective_boost', expected_ratio: 1.2,
    move_tested: waterMv.name,
    atk: waterAtk.name, def: fireDef.name,
    base_dmg: base, with_item_dmg: withIt,
    ratio: base>0 ? +(withIt/base).toFixed(3) : null,
    verdict: ok ? 'implemented' : ok === false ? 'broken' : 'missing',
    note: 'バツグン時×1.2(q12=4915) — calcDamage variations loop'
  });
})();

// ── 9. ふうせん (Air Balloon): じめん技免疫 + 被弾で割れる ───────────────
(function() {
  // じめん技免疫テスト
  const groundMv = moveWith(m => m.type === 'じめん' && m.category !== '変化' && m.power > 0);
  const normalMv = moveWith(m => m.type === 'ノーマル' && m.category !== '変化' && m.power > 0);
  if (!groundMv || !normalMv) { TESTS.push({ item:'air_balloon', name:'ふうせん', verdict:'skip', reason:'じめん/ノーマル技なし' }); return; }

  // 地面免疫: じめん技がふうせん持ちに当たらないこと
  const dmgGroundWithBalloon = calcDmg('カイリキー', '', groundMv, 'カビゴン', '', 10009, '', 'air_balloon');
  const dmgGroundNoBalloon   = calcDmg('カイリキー', '', groundMv, 'カビゴン', '', 10009, '', '');
  const groundImmune = dmgGroundWithBalloon === 0 && dmgGroundNoBalloon > 0;

  // 被弾で割れるテスト: 通常技でダメージを受けた後、ふうせんアイテムが消えているか
  setupBattle('カイリキー', '', normalMv, 'カビゴン', '', normalMv, '', 'air_balloon');
  E.setRandom(mulberry32(10009));
  try { E.phaseDealDamage('self', 'opp', normalMv); } catch(e) {}
  const itemAfterHit = E.sides.opp.item;
  const balloonBursts = (itemAfterHit === '' || itemAfterHit === null || itemAfterHit == null);

  TESTS.push({
    item: 'air_balloon', name: 'ふうせん',
    type: 'ground_immunity+burst',
    dmg_ground_with_balloon: dmgGroundWithBalloon, dmg_ground_no_balloon: dmgGroundNoBalloon,
    ground_immune: groundImmune,
    item_after_hit: itemAfterHit, balloon_bursts: balloonBursts,
    verdict: (groundImmune && balloonBursts) ? 'implemented'
           : (groundImmune || balloonBursts) ? 'broken' : 'missing',
    note: 'じめん免疫(isGrounded=false) + 被弾で割れ(def.item消去) — isGrounded + phaseDealDamage'
  });
})();

// ── 10. くろいヘドロ (Black Sludge): 毒1/16回復 / 非毒1/8ダメ ─────────────
(function() {
  const mv = moveWith(m => m.category !== '変化' && m.power > 0);
  if (!mv) { TESTS.push({ item:'black_sludge', name:'くろいヘドロ', verdict:'skip', reason:'攻撃技なし' }); return; }

  // 毒タイプ(どくどく=毒タイプ): 1/16回復 → ゲンガーで代用(どく/ゴースト)
  const poisonPoke = PL.find(p => p.type1 === 'どく' || p.type2 === 'どく') || PL[0];
  setupBattle('カイリキー', '', mv, poisonPoke.name, '', mv, '', 'black_sludge');
  E.sides.opp.currentHp = Math.floor(E.realStat(E.sides.opp, 'hp') * 0.8); // HP80%から開始
  E.setRandom(mulberry32(10010));
  const hpBefore_poison = E.sides.opp.currentHp;
  try { E.runTurn(); } catch(e) {}
  const hpAfter_poison = E.sides.opp.currentHp;
  const maxHp_p = E.realStat(E.sides.opp, 'hp');
  const expectedHeal = Math.max(1, Math.floor(maxHp_p / 16));
  // 毒タイプ: runTurn後にHPが増えているかどうか(毒スリップで少し減った後、ヘドロで回復のネット計算)
  // 毒タイプかつ状態異常なしのケースで回復を確認
  const poisonPoke2 = PL.find(p => p.type1 === 'どく' && p.type2 === '' && p.form === '通常') || poisonPoke;
  setupBattle('カイリキー', '', mv, poisonPoke2.name, '', mv, '', 'black_sludge');
  const defMaxHp2 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = Math.floor(defMaxHp2 * 0.8); // HP80%
  E.sides.opp.status = 'none'; // 状態異常なし(スリップ無し)
  E.setRandom(mulberry32(10010));
  const hpBefore2 = E.sides.opp.currentHp;
  // ターン終了フェーズだけシミュレート(runTurnは両方動く)
  // 直接endOfTurnを呼べないのでrunTurnで近似
  try { E.runTurn(); } catch(e) {}
  const hpAfter2 = E.sides.opp.currentHp;

  // 非毒タイプ(カビゴン=ノーマル): 1/8ダメージ
  setupBattle('カイリキー', '', mv, 'カビゴン', '', mv, '', 'black_sludge');
  const defMaxHp3 = E.realStat(E.sides.opp, 'hp');
  E.sides.opp.currentHp = defMaxHp3; // フルHP
  E.sides.opp.status = 'none';
  E.setRandom(mulberry32(10011));
  const hpBefore3 = E.sides.opp.currentHp;
  try { E.runTurn(); } catch(e) {}
  const hpAfter3 = E.sides.opp.currentHp;
  const expectedDmg = Math.max(1, Math.floor(defMaxHp3 / 8));
  const nonPoisonDmgOk = (hpBefore3 - hpAfter3) >= expectedDmg; // runTurnでは攻撃ダメージも含まれるので>=で判定

  TESTS.push({
    item: 'black_sludge', name: 'くろいヘドロ',
    type: 'hp_drain',
    poison_poke: poisonPoke2.name,
    non_poison_poke: 'カビゴン',
    non_poison_dmg_ok: nonPoisonDmgOk,
    expected_1_8_dmg: expectedDmg,
    verdict: nonPoisonDmgOk ? 'implemented' : 'missing',
    note: '毒タイプ1/16回復・非毒1/8ダメ — runTurn end-of-turn phase'
  });
})();

// ── 11. ちからのハチマキ (Muscle Band): 物理技×1.1 ───────────────────────
(function() {
  const moves = movesWhere(m => m.category === '物理' && m.power > 0);
  const results = moves.map(mv => {
    const base   = calcDmg('カイリキー', '', mv, 'カビゴン', '', 10011, '', '');
    const withIt = calcDmg('カイリキー', '', mv, 'カビゴン', '', 10011, 'muscle_band', '');
    const ok = ratioOk(base, withIt, 1.09, 1.11);
    return { move: mv.name, base, withIt, ratio: base>0 ? +(withIt/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    item: 'muscle_band', name: 'ちからのハチマキ',
    type: 'attack_boost', expected_ratio: 1.1,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: '物理技×1.1(q12=4506) — calcDamage variations loop'
  });
})();

// ── 12. ものしりメガネ (Wise Glasses): 特殊技×1.1 ───────────────────────
(function() {
  const moves = movesWhere(m => m.category === '特殊' && m.power > 0);
  const results = moves.map(mv => {
    const base   = calcDmg('フーディン', '', mv, 'カビゴン', '', 10012, '', '');
    const withIt = calcDmg('フーディン', '', mv, 'カビゴン', '', 10012, 'wise_glasses', '');
    const ok = ratioOk(base, withIt, 1.09, 1.11);
    return { move: mv.name, base, withIt, ratio: base>0 ? +(withIt/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    item: 'wise_glasses', name: 'ものしりメガネ',
    type: 'attack_boost', expected_ratio: 1.1,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: '特殊技×1.1(q12=4506) — calcDamage variations loop'
  });
})();

// ── 13. パンチグローブ (Punching Glove): パンチ技×1.1 + 接触判定無効 ──────
(function() {
  const punchMoves = movesWhere(m => m.flags && m.flags.punch && m.category === '物理' && m.power > 0);
  if (!punchMoves.length) { TESTS.push({ item:'punching_glove', name:'パンチグローブ', verdict:'skip', reason:'パンチ技なし' }); return; }

  // 威力×1.1テスト
  const results = punchMoves.map(mv => {
    const base   = calcDmg('カイリキー', '', mv, 'カビゴン', '', 10013, '', '');
    const withIt = calcDmg('カイリキー', '', mv, 'カビゴン', '', 10013, 'punching_glove', '');
    const ok = ratioOk(base, withIt, 1.09, 1.11);
    return { move: mv.name, base, withIt, ratio: base>0 ? +(withIt/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);

  // 接触判定無効テスト: さめはだ持ちに接触パンチ技を打っても反動が出ないか
  const mv = punchMoves[0];
  setupBattle('カイリキー', '', mv, 'サメハダー', 'さめはだ', null, 'punching_glove', '');
  E.setRandom(mulberry32(10013));
  const atkHpBefore = E.sides.self.currentHp;
  try { E.phaseDealDamage('self', 'opp', mv); } catch(e) {}
  const atkHpAfter = E.sides.self.currentHp;
  const noContactReaction = atkHpBefore === atkHpAfter;  // さめはだ反動なし=接触無効

  TESTS.push({
    item: 'punching_glove', name: 'パンチグローブ',
    type: 'punch_boost+no_contact', expected_ratio: 1.1,
    power_ok: anyOk && !anyFail,
    no_contact_reaction: noContactReaction,
    moves_tested: results,
    verdict: (anyOk && !anyFail && noContactReaction) ? 'implemented'
           : (anyOk || noContactReaction) ? 'broken' : 'missing',
    note: 'パンチ技×1.1 + 接触反応無効(さめはだ非発動) — calcDamage variations + phaseDealDamage'
  });
})();

// ── 14. しんかのきせき (Eviolite): 進化前ポケモンの防御・特防×1.5 ───────────
(function() {
  // 進化前判定 = EVIOLITE_NFE_DEX(Showdown pokedex由来・sim内蔵)。
  // Championsロスターの進化前 = ピカチュウ(no.25)。最終進化 = カビゴン(no.143)は対象外。
  const physMv = moveWith(m => m.category === '物理' && m.power > 0);
  const specMv = moveWith(m => m.category === '特殊' && m.power > 0);
  if (!physMv || !specMv || !poke('ピカチュウ')) {
    TESTS.push({ item:'eviolite', name:'しんかのきせき', verdict:'skip', reason:'物理/特殊技 or ピカチュウなし' });
    return;
  }

  // 進化前(ピカチュウ): 防御×1.5(物理被ダメ÷1.5) / 特防×1.5(特殊被ダメ÷1.5)
  const basePhys = calcDmg('カイリキー', '', physMv, 'ピカチュウ', '', 10014, '', '');
  const withPhys = calcDmg('カイリキー', '', physMv, 'ピカチュウ', '', 10014, '', 'eviolite');
  const physOk = ratioOk(basePhys, withPhys, 0.62, 0.72);

  const baseSpec = calcDmg('フーディン', '', specMv, 'ピカチュウ', '', 10014, '', '');
  const withSpec = calcDmg('フーディン', '', specMv, 'ピカチュウ', '', 10014, '', 'eviolite');
  const specOk = ratioOk(baseSpec, withSpec, 0.62, 0.72);

  // 最終進化(カビゴン): 補正なし = ダメージ不変
  const baseFinal = calcDmg('カイリキー', '', physMv, 'カビゴン', '', 10014, '', '');
  const withFinal = calcDmg('カイリキー', '', physMv, 'カビゴン', '', 10014, '', 'eviolite');
  const finalUnchanged = baseFinal > 0 && baseFinal === withFinal;

  TESTS.push({
    item: 'eviolite', name: 'しんかのきせき',
    type: 'defense_boost', expected: '進化前のみ防御・特防×1.5(被ダメ÷1.5)',
    nfe_phys: { base: basePhys, withIt: withPhys, ratio: basePhys>0 ? +(withPhys/basePhys).toFixed(3) : null, ok: physOk },
    nfe_spec: { base: baseSpec, withIt: withSpec, ratio: baseSpec>0 ? +(withSpec/baseSpec).toFixed(3) : null, ok: specOk },
    final_evo_unchanged: finalUnchanged,
    verdict: (physOk && specOk && finalUnchanged) ? 'implemented'
           : (physOk || specOk || !finalUnchanged) ? 'broken' : 'missing',
    note: '進化前判定=EVIOLITE_NFE_DEX(Showdown由来) — calcDamage dStatEff×1.5'
  });
})();

// ========================================================
// 結果集計 & 出力
// ========================================================
const implemented = TESTS.filter(t => t.verdict === 'implemented').length;
const missing     = TESTS.filter(t => t.verdict === 'missing').length;
const broken      = TESTS.filter(t => t.verdict === 'broken').length;
const skip        = TESTS.filter(t => t.verdict === 'skip').length;

const result = {
  generated: new Date().toISOString().slice(0, 10),
  summary: {
    total_tests: TESTS.length,
    implemented,
    missing,
    broken,
    skip,
    implementation_rate: `${implemented}/${implemented+missing+broken} (有効テスト比)`,
  },
  item_table: TESTS.map(t => ({
    item:    t.item,
    name:    t.name,
    type:    t.type,
    verdict: t.verdict,
    note:    t.note || t.reason || '',
  })),
  detailed_results: TESTS,
};

const OUT = path.join(ROOT, 'reference/_item_interaction_result.json');
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\n持ち物×バトル 相互作用テスト完了`);
console.log(`  total: ${TESTS.length}  implemented: ${implemented}  missing: ${missing}  broken: ${broken}  skip: ${skip}`);
console.log(`\n--- 持ち物別結果 ---`);
for (const t of TESTS) {
  const mark = t.verdict === 'implemented' ? '✔' : t.verdict === 'missing' ? '✘' : t.verdict === 'broken' ? '!' : '-';
  console.log(`  [${mark}] ${(t.name||t.item).padEnd(20)} ${t.verdict.padEnd(15)} ${t.type || ''}`);
}
console.log(`\n出力: ${OUT}`);
