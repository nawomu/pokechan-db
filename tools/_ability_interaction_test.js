/* 特性×技クラス 相互作用テストハーネス
 * 入力: reference/_ability_move_class_report.json (21クラス)
 * 出力: reference/_ability_interaction_result.json
 * 実行: PCHAM_DATA=pokechan_data.js node tools/_ability_interaction_test.js
 *
 * 判定: implemented / missing / broken / skip
 * ★ 読み取り専用(sim/データファイル変更禁止)・commit禁止
 * ★ seed固定決定論。状態比較は英語(burn/paralysis/etc.)。
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
function pokeWith(ab) { return PL.find(p => [p.ab1, p.ab2, p.ab3].includes(ab)); }
function moveWith(pred) { return Object.values(WM).find(pred); }
function movesWhere(pred, n=3) { return Object.values(WM).filter(pred).slice(0, n); }

// ポケモンが特定の特性を持てるよう上書きして sideState を構築
function makeSide(pokeName, abilityOverride, moveObj) {
  const s = E.makeSideState();
  s.poke  = poke(pokeName) || PL.find(p => p.form === '通常') || PL[0];
  s.ability = abilityOverride !== undefined ? abilityOverride : (s.poke && s.poke.ab1 || '');
  s.moves = [moveObj];
  s.selectedMoveIdx = 0;
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
function setupBattle(atkPoke, atkAb, atkMove, defPoke, defAb, defMove) {
  resetEnv();
  const dummy = moveWith(m => m.category !== '変化' && m.power > 0) || Object.values(WM)[0];
  E.sides.self = makeSide(atkPoke, atkAb, atkMove);
  E.sides.opp  = makeSide(defPoke, defAb, defMove || dummy);
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp  = E.realStat(E.sides.opp,  'hp');
  E.sides.self.rank = { atk:0, def:0, spatk:0, spdef:0, spd:0, acc:0, eva:0 };
  E.sides.opp.rank  = { atk:0, def:0, spatk:0, spdef:0, spd:0, acc:0, eva:0 };
  E.sides.self.status = 'none';
  E.sides.opp.status  = 'none';
}

// ダメージ計算(乱数固定、seed指定)
function calcDmg(atkPoke, atkAb, move, defPoke, defAb, seed) {
  setupBattle(atkPoke, atkAb, move, defPoke, defAb, null);
  E.setRandom(mulberry32(seed || 20260702));
  const hp0 = E.sides.opp.currentHp;
  try { E.phaseDealDamage('self', 'opp', move); } catch(e) {}
  return hp0 - E.sides.opp.currentHp;
}

// N回試行で接触反応(状態付与/ランク変化/HP変化)を検出
function tryContact(defAb, movePoke, moveAbility, moveObj, check, n=50) {
  for (let i = 0; i < n; i++) {
    setupBattle(movePoke, moveAbility, moveObj, 'カビゴン', defAb, null);
    E.setRandom(mulberry32(1000 + i));
    try { E.phaseDealDamage('self', 'opp', moveObj); } catch(e) {}
    if (check(E.sides.self, E.sides.opp)) return true;
  }
  return false;
}

// 期待倍率チェック
function ratioOk(base, withAb, expectedMin, expectedMax) {
  if (base === 0) return null;  // 免疫など
  const r = withAb / base;
  return r >= expectedMin - 0.05 && r <= expectedMax + 0.05;
}

// 音技でぼうおんに当たった時に免疫(0ダメ)になるかテスト
function testImmunity(defAb, moveObj, atkPoke='カイリキー', atkAb='') {
  setupBattle(atkPoke, atkAb, moveObj, 'カビゴン', defAb, null);
  E.setRandom(mulberry32(20260702));
  const hp0 = E.sides.opp.currentHp;
  try { E.phaseDealDamage('self', 'opp', moveObj); } catch(e) {}
  return (E.sides.opp.currentHp === hp0);
}

// 変化技で効果が封じられるかチェック(N回試行でいずれも失敗=効かない)
function testStatusBlocked(defAb, moveName, n=10) {
  const mv = moveWith(m => m.name === moveName);
  if (!mv) return { skip: true, reason: `技「${moveName}」が WAZA_MAP にない` };
  let blocked = 0;
  for (let i = 0; i < n; i++) {
    setupBattle('カイリキー', '', mv, 'カビゴン', defAb, null);
    E.sides.opp.status = 'none';
    E.setRandom(mulberry32(2000 + i));
    try { E.phaseApplyEffects('self', 'opp', mv); } catch(e) {}
    if (E.sides.opp.status === 'none') blocked++;
  }
  return blocked === n;  // 全回失敗=免疫実装
}

// ========================================================
// テストケース定義
// ========================================================
const TESTS = [];

// ── 1. てつのこぶし (iron-fist): パンチ技 ×1.2 ──────────────────
(function() {
  const moves = movesWhere(m => m.flags && m.flags.punch && m.category === '物理' && m.power > 0);
  const results = moves.map(mv => {
    const base   = calcDmg('カイリキー', '',         mv, 'カビゴン', '', 9901);
    const withAb = calcDmg('カイリキー', 'てつのこぶし', mv, 'カビゴン', '', 9901);
    const ok = ratioOk(base, withAb, 1.19, 1.21);
    return { move: mv.name, base, withAb, ratio: base>0 ? +(withAb/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    ability: 'てつのこぶし', move_class: 'パンチ(punch)', type: 'power_multiplier',
    expected_ratio: 1.2,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: 'パンチ技 ×1.2 — calcDamage 1719行'
  });
})();

// ── 2. がんじょうあご (strong-jaw): かみつき技 ×1.5 ──────────────────
(function() {
  const pMega = pokeWith('がんじょうあご') || PL[0];
  const moves  = movesWhere(m => m.flags && m.flags.bite && m.category === '物理' && m.power > 0);
  const results = moves.map(mv => {
    const base   = calcDmg(pMega.name, '',           mv, 'カビゴン', '', 9902);
    const withAb = calcDmg(pMega.name, 'がんじょうあご', mv, 'カビゴン', '', 9902);
    const ok = ratioOk(base, withAb, 1.49, 1.51);
    return { move: mv.name, base, withAb, ratio: base>0 ? +(withAb/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    ability: 'がんじょうあご', move_class: 'かみつき(bite)', type: 'power_multiplier',
    expected_ratio: 1.5,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: 'かみつき技 ×1.5 — calcDamage 1750行'
  });
})();

// ── 3. きれあじ (sharpness): スライス技 ×1.5 ──────────────────────
(function() {
  const moves = movesWhere(m => m.flags && (m.flags.slash || m.flags.slicing) && m.category !== '変化' && m.power > 0);
  const results = moves.map(mv => {
    const base   = calcDmg('エルレイド', '',       mv, 'カビゴン', '', 9903);
    const withAb = calcDmg('エルレイド', 'きれあじ', mv, 'カビゴン', '', 9903);
    const ok = ratioOk(base, withAb, 1.49, 1.51);
    return { move: mv.name, base, withAb, ratio: base>0 ? +(withAb/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    ability: 'きれあじ', move_class: '切る/スライス(slicing)', type: 'power_multiplier',
    expected_ratio: 1.5,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: 'flags.slash / flags.slicing → ×1.5 — calcDamage 1755行'
  });
})();

// ── 4. メガランチャー (mega-launcher): はどう技 ×1.5 ──────────────────
(function() {
  const moves = movesWhere(m => m.flags && m.flags.pulse && m.category !== '変化' && m.power > 0);
  const results = moves.map(mv => {
    const base   = calcDmg('メガカメックス', '',           mv, 'カビゴン', '', 9904);
    const withAb = calcDmg('メガカメックス', 'メガランチャー', mv, 'カビゴン', '', 9904);
    const ok = ratioOk(base, withAb, 1.49, 1.51);
    return { move: mv.name, base, withAb, ratio: base>0 ? +(withAb/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    ability: 'メガランチャー', move_class: '波動/はどう(pulse)', type: 'power_multiplier',
    expected_ratio: 1.5,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: 'flags.pulse → ×1.5 — calcDamage 1740行'
  });
})();

// ── 5. テクニシャン (technician): 威力60以下 ×1.5 ──────────────────
(function() {
  const moves = movesWhere(m => m.power && m.power <= 60 && m.category === '物理');
  const results = moves.map(mv => {
    const base   = calcDmg('ハッサム', '',         mv, 'カビゴン', '', 9905);
    const withAb = calcDmg('ハッサム', 'テクニシャン', mv, 'カビゴン', '', 9905);
    const ok = ratioOk(base, withAb, 1.49, 1.51);
    return { move: mv.name, power: mv.power, base, withAb, ratio: base>0 ? +(withAb/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    ability: 'テクニシャン', move_class: '威力が低い技(power<=60)', type: 'power_multiplier',
    expected_ratio: 1.5,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: 'm.power<=60 → ×1.5 — calcDamage 1783行'
  });
})();

// ── 6. かたいツメ (tough-claws): 直接攻撃 ×1.3 ──────────────────────
(function() {
  const moves = movesWhere(m => m.contact === true && m.category === '物理' && m.power > 0);
  const results = moves.map(mv => {
    const base   = calcDmg('メガリザードンX', '',         mv, 'カビゴン', '', 9906);
    const withAb = calcDmg('メガリザードンX', 'かたいツメ', mv, 'カビゴン', '', 9906);
    const ok = ratioOk(base, withAb, 1.29, 1.31);
    return { move: mv.name, base, withAb, ratio: base>0 ? +(withAb/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    ability: 'かたいツメ', move_class: '直接攻撃(contact) - 攻撃側補正', type: 'power_multiplier',
    expected_ratio: 1.3,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: 'move.contact → ×1.3 — calcDamage 1725行'
  });
})();

// ── 7. ちからずく (sheer-force): 追加効果あり技 ×1.3 ─────────────────
(function() {
  // 追加効果あり(effects!=空)の物理技を選ぶ
  const moves = movesWhere(m => m.category === '物理' && m.power > 0
    && m.battle_data && m.battle_data.effects && m.battle_data.effects.length > 0
    && !m.flags?.punch  // てつのこぶしと干渉しないよう非パンチ
  );
  const results = moves.map(mv => {
    const base   = calcDmg('ケンタロス', '',         mv, 'カビゴン', '', 9907);
    const withAb = calcDmg('ケンタロス', 'ちからずく', mv, 'カビゴン', '', 9907);
    const ok = ratioOk(base, withAb, 1.29, 1.31);
    return { move: mv.name, base, withAb, ratio: base>0 ? +(withAb/base).toFixed(3) : null, ok };
  });
  const anyOk   = results.some(r => r.ok === true);
  const anyFail = results.some(r => r.ok === false);
  TESTS.push({
    ability: 'ちからずく', move_class: '追加効果あり(secondary)', type: 'power_multiplier',
    expected_ratio: 1.3,
    verdict: anyOk && !anyFail ? 'implemented' : anyFail ? 'broken' : 'missing',
    moves_tested: results,
    note: 'effects 非空 → ×1.3 / 追加効果を抑制 — calcDamage 1778行 & phaseApplyEffects 2964行'
  });
})();

// ── 8. すてみ (reckless): 反動技 ×1.2 ─────────────────────────────
(function() {
  const moves = movesWhere(m => m.battle_data && (m.battle_data.effects||[]).some(e=>e.kind==='反動')
    && m.category !== '変化' && m.power > 0);
  const user = pokeWith('すてみ') || { name: 'エンブオー' };
  const results = moves.map(mv => {
    const base   = calcDmg(user.name, '',     mv, 'カビゴン', '', 9908);
    const withAb = calcDmg(user.name, 'すてみ', mv, 'カビゴン', '', 9908);
    const ok = ratioOk(base, withAb, 1.19, 1.21);
    return { move: mv.name, base, withAb, ratio: base>0 ? +(withAb/base).toFixed(3) : null, ok };
  });
  // 判定: ratio=1.0 → missing(実装なし) / ratio≒1.2 → implemented / その他 → broken
  const anyOk    = results.some(r => r.ok === true);
  const allRatio1 = results.every(r => r.ratio === 1);
  const anyOtherRatio = results.some(r => r.ratio !== null && r.ratio !== 1 && r.ok === false);
  TESTS.push({
    ability: 'すてみ', move_class: '反動技(recoil) - 威力補正', type: 'power_multiplier',
    expected_ratio: 1.2,
    expected_behavior: '反動技の威力×1.2(Bulbapedia "Reckless": boosts recoil moves by 20%)',
    verdict: anyOk ? 'implemented' : anyOtherRatio ? 'broken' : 'missing',
    moves_tested: results,
    note: '★calcDamage に「すてみ」分岐なし。全試行でratio=1.0 → missing。修正フェーズで calcDamage に反動技判定+×1.2 追加が必要。'
  });
})();

// ── 9. いしあたま (rock-head): 反動技の反動無効 ────────────────────
(function() {
  const user  = pokeWith('いしあたま') || { name: 'プテラ' };
  const recoilMove = moveWith(m => m.battle_data && (m.battle_data.effects||[]).some(e=>e.kind==='反動') && m.category!=='変化' && m.power>0);
  if (!recoilMove) { TESTS.push({ ability:'いしあたま', verdict:'skip', reason:'反動技が見つからない' }); return; }

  // 反動ありの場合: 攻撃後にHP減少するはず
  const testRecoil = (ab) => {
    setupBattle(user.name, ab, recoilMove, 'カビゴン', '', null);
    E.setRandom(mulberry32(9909));
    const hpBefore = E.sides.self.currentHp;
    try { E.phaseDealDamage('self', 'opp', recoilMove); } catch(e) {}
    return E.sides.self.currentHp < hpBefore;  // HP減少=反動あり
  };

  const noAbRecoil   = testRecoil('');
  const withAbRecoil = testRecoil('いしあたま');
  TESTS.push({
    ability: 'いしあたま', move_class: '反動技(recoil) - 反動無効', type: 'nullify',
    move_tested: recoilMove.name,
    no_ability_had_recoil: noAbRecoil,
    with_ability_had_recoil: withAbRecoil,
    verdict: noAbRecoil && !withAbRecoil ? 'implemented'
           : noAbRecoil &&  withAbRecoil ? 'missing'
           : 'skip',
    note: '反動無効 — phaseDealDamage 2669行'
  });
})();

// ── 10. スキルリンク (skill-link): 連続技 最大回数固定 ──────────────
(function() {
  const multiMoves = movesWhere(m => m.battle_data && (m.battle_data.effects||[]).some(
    e => e.kind === '連続攻撃' && e.min_hits && e.max_hits && e.min_hits < e.max_hits
  ));
  if (!multiMoves.length) { TESTS.push({ ability:'スキルリンク', verdict:'skip', reason:'可変連続技なし' }); return; }
  const user = pokeWith('スキルリンク') || { name: 'メガヘラクロス' };

  const results = multiMoves.map(mv => {
    const ef = (mv.battle_data.effects||[]).find(e=>e.kind==='連続攻撃');
    const maxExpected = ef ? ef.max_hits : null;

    // N回試行してヒット回数分布を記録
    function countHits(ab) {
      let counts = {};
      for (let i = 0; i < 20; i++) {
        setupBattle(user.name, ab, mv, 'カビゴン', '', null);
        E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp') * 10; // 絶対ひんしにならない
        E.setRandom(mulberry32(9910 + i));
        const hp0 = E.sides.opp.currentHp;
        try { E.phaseDealDamage('self', 'opp', mv); } catch(e) {}
        const dealt = hp0 - E.sides.opp.currentHp;
        // ヒット数の近似(ダメージ/単発ダメ)
        counts[dealt] = (counts[dealt]||0) + 1;
      }
      return counts;
    }
    const noAbDist   = countHits('');
    const withAbDist = countHits('スキルリンク');
    // 判定: スキルリンクなら全試行が最大ヒット数のtierに収まる
    // 乱数変動があるので「ダメージ分布の最大/最小比」で判定
    // 特性なし: 複数tierある(2-5ヒット)のでmax/min比が大きい
    // 特性あり: 5ヒット固定のため乱数のみで変動(max/min比が小さい)
    const noKeys  = Object.keys(noAbDist).map(Number).sort((a,b)=>a-b);
    const wKeys   = Object.keys(withAbDist).map(Number).sort((a,b)=>a-b);
    const noRatio  = noKeys.length > 1 ? Math.max(...noKeys) / Math.min(...noKeys) : 1;
    const wRatio   = wKeys.length  > 1 ? Math.max(...wKeys)  / Math.min(...wKeys)  : 1;
    // スキルリンク判定: with_ab の比率が no_ab より顕著に小さい → 固定効果あり
    // 具体的: no_ab=2.x(2〜5hitの幅), with_ab≈1.1(5hit乱数のみ)
    const withAbFixed = wRatio < 1.3 && noRatio > 1.5;
    return { move: mv.name, max_hits: maxExpected,
             no_ability_ratio: +noRatio.toFixed(2), with_ability_ratio: +wRatio.toFixed(2),
             withAbFixed };
  });

  const anyFixed = results.some(r => r.withAbFixed);
  TESTS.push({
    ability: 'スキルリンク', move_class: '連続技(multi-hit)', type: 'behavior',
    verdict: anyFixed ? 'implemented' : 'missing',
    moves_tested: results,
    note: 'max_hits 固定(乱数固定ではなくtier集中で判定) — phaseDealDamage 2483行'
  });
})();

// ── 11. ぼうおん (soundproof): 音技無効 ──────────────────────────
(function() {
  const soundMoves = movesWhere(m => m.flags && m.flags.sound && m.category !== '変化' && m.power > 0);
  const results = soundMoves.map(mv => {
    const immune = testImmunity('ぼうおん', mv, 'カイリキー', '');
    return { move: mv.name, immune };
  });
  const anyImmune  = results.some(r => r.immune);
  const anyNotImm  = results.some(r => !r.immune);
  TESTS.push({
    ability: 'ぼうおん', move_class: '音(sound)', type: 'nullify',
    verdict: anyImmune && !anyNotImm ? 'implemented'
           : anyImmune &&  anyNotImm ? 'broken'
           : 'missing',
    moves_tested: results,
    note: '音技(flags.sound)を完全無効 — calcDamage 1599行 & phaseApplyEffects 3030行'
  });
})();

// ── 12. ぼうだん (bulletproof): 砲弾技無効 ──────────────────────────
(function() {
  const bulletMoves = movesWhere(m => m.flags && (m.flags.bullet||m.flags.ball) && m.category !== '変化' && m.power > 0);
  const results = bulletMoves.map(mv => {
    const immune = testImmunity('ぼうだん', mv, 'カイリキー', '');
    return { move: mv.name, flag: mv.flags.bullet?'bullet':mv.flags.ball?'ball':'?', immune };
  });
  const anyImmune  = results.some(r => r.immune);
  const anyNotImm  = results.some(r => !r.immune);
  TESTS.push({
    ability: 'ぼうだん', move_class: '砲弾/弾(bullet)', type: 'nullify',
    verdict: anyImmune && !anyNotImm ? 'implemented'
           : anyImmune &&  anyNotImm ? 'broken'
           : 'missing',
    moves_tested: results,
    note: 'flags.bullet|ball → 無効 — calcDamage 1600行'
  });
})();

// ── 13. ぼうじん (overcoat): 粉技無効 ──────────────────────────────
(function() {
  // 粉技は変化技が多い。phaseApplyEffects で効果ブロックされるか確認
  const powderMoves = movesWhere(m => m.flags && m.flags.powder, 5);
  if (!powderMoves.length) {
    TESTS.push({ ability:'ぼうじん', verdict:'skip', reason:'flags.powder 付きの技がない(データ未整備)' });
    return;
  }
  const results = powderMoves.map(mv => {
    // 変化技の場合: phaseApplyEffects で状態付与が封じられるか
    if (mv.category === '変化') {
      const stEf = (mv.battle_data && mv.battle_data.effects||[]).find(e=>e.kind==='状態付与'&&(e.target==='opponent'||e.target==='all_opponents'));
      if (!stEf) return { move: mv.name, method:'status_check', result:'no_status_effect_to_test' };
      // ぼうじんなし
      let blockedWithout = true;
      for (let i=0;i<10;i++){
        setupBattle('カイリキー','',mv,'カビゴン','',null);
        E.sides.opp.status='none'; E.setRandom(mulberry32(9913+i));
        try{E.phaseApplyEffects('self','opp',mv);}catch(e){}
        if(E.sides.opp.status !== 'none') { blockedWithout=false; break; }
      }
      // ぼうじんあり
      let blockedWith = true;
      for (let i=0;i<10;i++){
        setupBattle('カイリキー','',mv,'カビゴン','ぼうじん',null);
        E.sides.opp.status='none'; E.setRandom(mulberry32(9913+i));
        try{E.phaseApplyEffects('self','opp',mv);}catch(e){}
        if(E.sides.opp.status !== 'none') { blockedWith=false; break; }
      }
      return { move: mv.name, method:'status_check', without_ability_blocked: blockedWithout, with_ability_blocked: blockedWith };
    } else {
      // 攻撃技の場合: ダメージが通るかどうか
      const dmgWith    = calcDmg('カイリキー','',mv,'カビゴン','ぼうじん',9913);
      const dmgWithout = calcDmg('カイリキー','',mv,'カビゴン','',9913);
      return { move: mv.name, method:'damage', without_ability: dmgWithout, with_ability: dmgWith };
    }
  });
  // ぼうじん実装判定: 変化技ブロックが確認できたか
  const anyBlocked = results.some(r => r.with_ability_blocked === true && r.without_ability_blocked === false);
  TESTS.push({
    ability: 'ぼうじん', move_class: '粉(powder)', type: 'nullify',
    verdict: anyBlocked ? 'implemented' : 'missing',
    expected_behavior: '粉技(flags.powder)を完全無効(Bulbapedia "Overcoat")',
    moves_tested: results,
    note: '★sim「ぼうじん系は未実装」コメントあり(real_battle_simulator.html 3946行) → missing 予想。修正フェーズでphaseApplyEffectsに分岐追加が必要。'
  });
})();

// ── 14. せいでんき (static): 直接攻撃 → 30%まひ ────────────────────
(function() {
  const mv = moveWith(m => m.contact === true && m.category === '物理' && m.power > 0);
  if (!mv) { TESTS.push({ ability:'せいでんき', verdict:'skip', reason:'接触物理技なし' }); return; }
  // せいでんきを持つ相手に接触技を当てて、まひになるかN回試行
  const got = tryContact('せいでんき', 'カイリキー', '', mv,
    (atk, _def) => atk.status === 'paralysis', 80);
  TESTS.push({
    ability: 'せいでんき', move_class: '直接攻撃(contact) - 接触反応', type: 'reaction',
    move_tested: mv.name,
    verdict: got ? 'implemented' : 'missing',
    expected_behavior: '30%でまひ(paralysis) — phaseDealDamage 2574行'
  });
})();

// ── 15. ほのおのからだ (flame-body): 直接攻撃 → 30%やけど ────────────
(function() {
  const mv = moveWith(m => m.contact === true && m.category === '物理' && m.power > 0);
  if (!mv) { TESTS.push({ ability:'ほのおのからだ', verdict:'skip', reason:'接触物理技なし' }); return; }
  const got = tryContact('ほのおのからだ', 'カイリキー', '', mv,
    (atk, _def) => atk.status === 'burn', 80);
  TESTS.push({
    ability: 'ほのおのからだ', move_class: '直接攻撃(contact) - 接触反応', type: 'reaction',
    move_tested: mv.name,
    verdict: got ? 'implemented' : 'missing',
    expected_behavior: '30%でやけど(burn) — phaseDealDamage 2574行'
  });
})();

// ── 16. さめはだ (rough-skin): 直接攻撃 → 1/8 HP反動 ─────────────────
(function() {
  const mv = moveWith(m => m.contact === true && m.category === '物理' && m.power > 0);
  if (!mv) { TESTS.push({ ability:'さめはだ', verdict:'skip', reason:'接触物理技なし' }); return; }
  setupBattle('カイリキー', '', mv, 'サメハダー', 'さめはだ', null);
  E.setRandom(mulberry32(9915));
  const atkHpBefore = E.sides.self.currentHp;
  try { E.phaseDealDamage('self', 'opp', mv); } catch(e) {}
  const atkHpAfter  = E.sides.self.currentHp;
  const suffered    = atkHpBefore - atkHpAfter;
  const maxHp       = E.realStat(E.sides.self, 'hp');
  const expected18  = Math.max(1, Math.floor(maxHp / 8));
  TESTS.push({
    ability: 'さめはだ', move_class: '直接攻撃(contact) - 接触反応', type: 'reaction',
    move_tested: mv.name,
    atk_hp_before: atkHpBefore, atk_hp_after: atkHpAfter,
    recoil_dealt: suffered, expected_1_8: expected18,
    verdict: suffered === expected18 ? 'implemented'
           : suffered > 0 ? 'broken'
           : 'missing',
    note: '1/8反動 — phaseDealDamage 2588行'
  });
})();

// ── 17. てつのトゲ (iron-barbs): さめはだと同等の反動 ──────────────────
(function() {
  const mv = moveWith(m => m.contact === true && m.category === '物理' && m.power > 0);
  if (!mv) { TESTS.push({ ability:'てつのトゲ', verdict:'skip', reason:'接触物理技なし' }); return; }
  setupBattle('カイリキー', '', mv, 'フェローチェ', 'てつのトゲ', null);
  // フェローチェがいなければカビゴンで代用
  if (!poke('フェローチェ')) {
    setupBattle('カイリキー', '', mv, 'カビゴン', 'てつのトゲ', null);
  }
  E.setRandom(mulberry32(9916));
  const atkHpBefore = E.sides.self.currentHp;
  try { E.phaseDealDamage('self', 'opp', mv); } catch(e) {}
  const suffered = atkHpBefore - E.sides.self.currentHp;
  const maxHp    = E.realStat(E.sides.self, 'hp');
  const expected = Math.max(1, Math.floor(maxHp / 8));
  TESTS.push({
    ability: 'てつのトゲ', move_class: '直接攻撃(contact) - 接触反応', type: 'reaction',
    move_tested: mv.name,
    recoil_dealt: suffered, expected_1_8: expected,
    verdict: suffered === expected ? 'implemented' : suffered > 0 ? 'broken' : 'missing',
    expected_behavior: 'さめはだと同じ1/8反動(Bulbapedia "Iron Barbs")',
    note: '★sim検索では てつのトゲ 分岐未確認 → テスト結果で判定'
  });
})();

// ── 18. ぼうおん: 変化系音技も封じるか (別途確認) ──────────────────
(function() {
  // うたう(sound+status move)がぼうおん持ちに無効化されるか
  const utau = moveWith(m => m.name === 'うたう');
  if (!utau) { TESTS.push({ ability:'ぼうおん-変化技', verdict:'skip', reason:'うたうなし' }); return; }
  let blocked = 0;
  for (let i=0;i<5;i++){
    setupBattle('カイリキー','',utau,'カビゴン','ぼうおん',null);
    E.sides.opp.status='none'; E.setRandom(mulberry32(9918+i));
    try{E.phaseApplyEffects('self','opp',utau);}catch(e){}
    if(E.sides.opp.status === 'none') blocked++;
  }
  TESTS.push({
    ability: 'ぼうおん', move_class: '音(sound) - 変化技', type: 'nullify_status',
    move_tested: utau.name,
    blocked_count: blocked, trials: 5,
    verdict: blocked === 5 ? 'implemented' : 'missing',
    note: 'phaseApplyEffects 3030行でも ぼうおん チェックあり'
  });
})();

// ── 19. いたずらごころ (prankster): 変化技 +1 優先度 ─────────────────
(function() {
  // 変化技でいたずらごころ持ちが先に動くかチェック
  const statusMv = moveWith(m => m.category === '変化' && m.name === 'なみだめ');
  const dummy    = moveWith(m => m.category === '物理' && m.power > 0);
  if (!statusMv || !dummy) { TESTS.push({ ability:'いたずらごころ', verdict:'skip', reason:'変化技/攻撃技なし' }); return; }

  // いたずらごころ持ち(遅い)が先制変化技を使い、優先度補正でより速く行動できるか
  // 速度: カビゴン(spd低い)がいたずらごころ使用、カイリキーが普通攻撃
  setupBattle('カビゴン', 'いたずらごころ', statusMv, 'カイリキー', '', dummy);
  E.setRandom(mulberry32(9919));
  let pranksterWentFirst = false;
  const logCapture = [];
  const origLog = E.battleLog;
  // runTurnで順序観測
  try {
    E.runTurn();
    pranksterWentFirst = true; // クラッシュしなければ実行OK
  } catch(e) {}
  TESTS.push({
    ability: 'いたずらごころ', move_class: '変化技(status moves)', type: 'priority',
    verdict: 'skip',
    reason: '行動順の観測は battleLog を直接読む必要あり — エンジン側で priority+1 は 2025行で実装済み。手動確認推奨。',
    impl_evidence: 'decideOrder/isHigherPriority 内: 変化技+いたずらごころ → priority+1 (real_battle_simulator.html 2025行)',
    note: 'コード証拠から implemented と判断(自動テストはskip)'
  });
})();

// ── 20. スキルリンク判定済み(#10で実施) ─────────────────────────────
// ── 21. かぜのり/ふうりょくでんき — Pokémon DBに特性未登録 ──────────────
(function() {
  TESTS.push({
    ability: 'かぜのり', move_class: '風(wind)', type: 'reaction',
    verdict: 'skip',
    reason: 'かぜのり は POKEMON_LIST のいずれの ab1/ab2/ab3 にも存在しない(Champions外・DB未登録)。エンジン実装も未確認。',
    expected_behavior: '風技被弾時にこうげき+1 or 無効化(Bulbapedia "Wind Rider")',
    sim_evidence: 'real_battle_simulator.html に「かぜのり」の記述なし → missing と推定'
  });
  TESTS.push({
    ability: 'ふうりょくでんき', move_class: '風(wind)', type: 'reaction',
    verdict: 'skip',
    reason: 'ふうりょくでんき は POKEMON_LIST に未登録(Champions外)。エンジン実装も未確認。',
    expected_behavior: '風技被弾時に充電状態(Bulbapedia "Wind Power")',
    sim_evidence: 'real_battle_simulator.html に「ふうりょくでんき」の記述なし → missing と推定'
  });
  TESTS.push({
    ability: 'おどりこ', move_class: '踊り(dance)', type: 'reaction',
    verdict: 'skip',
    reason: 'おどりこ は POKEMON_LIST に未登録(Champions外)。エンジン実装も未確認。',
    expected_behavior: '相手のダンス技使用直後に同じ技をコピー使用(Bulbapedia "Dancer")',
    sim_evidence: 'real_battle_simulator.html に「おどりこ」の記述なし → missing と推定'
  });
  TESTS.push({
    ability: 'パンクロック', move_class: '音(sound) - 威力補正', type: 'power_multiplier',
    verdict: 'skip',
    reason: 'パンクロック は POKEMON_LIST に未登録(Champions外)。',
    expected_behavior: '音技の威力1.3倍、受け取るダメージ半減(Bulbapedia "Punk Rock")',
    sim_evidence: 'real_battle_simulator.html に「パンクロック」の記述なし → missing と推定'
  });
  TESTS.push({
    ability: 'うるおいボイス', move_class: '音(sound) - タイプ変換', type: 'type_change',
    verdict: 'skip',
    reason: 'うるおいボイス は POKEMON_LIST に未登録(Champions外)。',
    expected_behavior: '音技をみずタイプに変換(Bulbapedia "Liquid Voice")',
    sim_evidence: 'real_battle_simulator.html に「うるおいボイス」の記述なし → missing と推定'
  });
})();

// ── 22. てんのめぐみ (serene-grace): 追加効果2倍 ──────────────────────
(function() {
  TESTS.push({
    ability: 'てんのめぐみ', move_class: '追加効果あり(secondary)', type: 'prob_multiplier',
    verdict: 'skip',
    reason: 'てんのめぐみ は POKEMON_LIST に未登録(Champions外)。エンジン実装未確認。',
    expected_behavior: '追加効果の発動確率を2倍(Bulbapedia "Serene Grace")',
    sim_evidence: 'real_battle_simulator.html に「てんのめぐみ」の記述なし → missing と推定'
  });
})();

// ── 23. りんぷん (shield-dust): 追加効果無効 ────────────────────────
(function() {
  // 追加効果(やけど付与等)を持つ技を打って、りんぷん持ちへの追加効果が発動しないか確認
  const mv = moveWith(m => m.category === '物理' && m.power > 0
    && (m.battle_data && m.battle_data.effects||[]).some(e=>e.kind==='状態付与'&&e.target==='opponent'&&e.prob<100&&e.prob>0));
  if (!mv) { TESTS.push({ ability:'りんぷん', verdict:'skip', reason:'副作用付き攻撃技なし' }); return; }
  const stEf = (mv.battle_data.effects||[]).find(e=>e.kind==='状態付与'&&e.target==='opponent'&&e.prob<100&&e.prob>0);
  const ST_MAP = {'やけど':'burn','どく':'poison','もうどく':'badpoison','こおり':'freeze','まひ':'paralysis','ねむり':'sleep'};
  const expectedStatus = ST_MAP[stEf.value];

  let gotStatusWithout = false, gotStatusWith = false;
  for (let i=0;i<60;i++){
    setupBattle('カイリキー','',mv,'ビビヨン','',null);
    E.sides.opp.status='none'; E.setRandom(mulberry32(9923+i));
    try{E.runTurn();}catch(e){}
    if(E.sides.opp.status===expectedStatus) { gotStatusWithout=true; break; }
  }
  for (let i=0;i<60;i++){
    setupBattle('カイリキー','',mv,'ビビヨン','りんぷん',null);
    E.sides.opp.status='none'; E.setRandom(mulberry32(9923+i));
    try{E.runTurn();}catch(e){}
    if(E.sides.opp.status===expectedStatus) { gotStatusWith=true; break; }
  }
  TESTS.push({
    ability: 'りんぷん', move_class: '追加効果あり(secondary)', type: 'nullify_secondary',
    move_tested: mv.name, status_target: stEf.value, prob: stEf.prob,
    got_status_without_ability: gotStatusWithout,
    got_status_with_ability: gotStatusWith,
    verdict: !gotStatusWithout ? 'skip'
           : gotStatusWithout && !gotStatusWith ? 'implemented'
           : 'missing',
    expected_behavior: '追加効果を無効(Bulbapedia "Shield Dust")',
    note: '★sim に「りんぷん」分岐未検出 → missing の可能性高い'
  });
})();

// ── 24. ヒーリングシフト (triage): 回復技 +3 優先度 ──────────────────
(function() {
  TESTS.push({
    ability: 'ヒーリングシフト', move_class: '回復技(heal)', type: 'priority',
    verdict: 'skip',
    reason: 'ヒーリングシフト は POKEMON_LIST に未登録(Champions外)。',
    expected_behavior: '回復技の優先度+3(Bulbapedia "Triage")',
    sim_evidence: 'real_battle_simulator.html に「ヒーリングシフト」の記述なし → missing と推定'
  });
})();

// ── 25. くだけるよろい (weak-armor): 物理技被弾 → ぼうぎょ-1/すばやさ+2 ─
(function() {
  const physMv = moveWith(m => m.category === '物理' && m.power > 0);
  if (!physMv) { TESTS.push({ ability:'くだけるよろい', verdict:'skip', reason:'物理技なし' }); return; }
  setupBattle('カイリキー','',physMv,'カビゴン','くだけるよろい',null);
  E.setRandom(mulberry32(9925));
  try { E.phaseDealDamage('self', 'opp', physMv); } catch(e) {}
  const defRank = E.sides.opp.rank.def || 0;
  const spdRank = E.sides.opp.rank.spd || 0;
  TESTS.push({
    ability: 'くだけるよろい', move_class: '物理技(physical)', type: 'reaction',
    move_tested: physMv.name,
    def_rank_after: defRank, spd_rank_after: spdRank,
    verdict: defRank === -1 && spdRank === 2 ? 'implemented' : 'missing',
    note: 'phaseDealDamage 2607行'
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
  class_table: TESTS.map(t => ({
    ability:    t.ability,
    move_class: t.move_class,
    type:       t.type,
    verdict:    t.verdict,
    note:       t.note || t.reason || t.sim_evidence || '',
    expected_behavior: t.expected_behavior || '',
  })),
  detailed_results: TESTS,
};

const OUT = path.join(ROOT, 'reference/_ability_interaction_result.json');
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\n特性×技クラス 相互作用テスト完了`);
console.log(`  total: ${TESTS.length}  implemented: ${implemented}  missing: ${missing}  broken: ${broken}  skip: ${skip}`);
console.log(`\n--- クラス別結果 ---`);
for (const t of TESTS) {
  const mark = t.verdict === 'implemented' ? '✔' : t.verdict === 'missing' ? '✘' : t.verdict === 'broken' ? '!' : '-';
  console.log(`  [${mark}] ${t.ability.padEnd(18)} ${t.verdict.padEnd(15)} ${t.move_class || ''}`);
}
console.log(`\n出力: ${OUT}`);
