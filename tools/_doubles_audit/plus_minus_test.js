/*
 * tools/_doubles_audit/plus_minus_test.js — 監査: プラス/マイナス(ダブル)
 * 実行: node tools/_doubles_audit/plus_minus_test.js
 *
 * 監査対象の機構: プラス/マイナス(味方の場にプラス/マイナスがいると とくこう1.5倍・重複なし)
 *
 * ★期待値の出どころ(権威ソースの引用。エンジンの出力を正解にしない):
 *  出典S1 = review/_doubles_research_2026-09-07/T6_特性と持ち物.md #19
 *    「プラスかマイナスの特性を持つ味方が 場にいると 自分の特攻が1.5倍になる」
 *    備考「1体だけでは発動せず、味方に対になる特性を持つ個体が要る=ダブル以上でしか成立しない」
 *  出典S2 = reference/_ability_facts.json facts.プラス[1](出典=ポケモンWiki「プラス」第五世代以降節)
 *    「・プラスやマイナスのポケモンが相手の場にいるだけでは発動しない。」
 *  出典S3 = review/_doubles_research_2026-09-07/T6_特性と持ち物_verify.md 151行
 *    「#19の世代: シングルで発動しなくなったのは第四世代から。第五世代の変更は
 *      「プラス/マイナスどちらの味方でも可」。」
 *    (= 現行世代では味方が「プラス」でもプラス持ちの特攻が上がる)
 *  出典S4 = reference/_ability_facts.json facts.プラス[2](出典=ポケモンWiki「プラス」第五世代以降節)
 *    「トリプルバトル/マックスレイドバトル/テラレイドバトルで複数のプラス/マイナスのポケモンが
 *      味方にいる場合でも効果は累積せず、特攻は1.5倍のまま変わらない。」
 *  出典S5 = master/abilities.json プラス/マイナス(champions:true)
 *    effect_ja「特性『プラス』か『マイナス』のポケモンが戦闘にいると『とくこう』が1.5倍になる。
 *      (自分の味方が対象で、相手の場にいるだけでは発動しない)」
 *      → 上がるのは「とくこう」だけ(こうげき=物理は対象外)
 *
 * ★倍率1.5の独立オラクル: 能力ランク+1 = ×1.5(rankMult(+1)=(2+1)/2=1.5。ポケモンWiki「ランク補正」)。
 *   そのため「味方にマイナスが居る状態の とくこう」は「味方が無関係な特性で とくこうランク+1」と
 *   同じ実数値になるはず。エンジンの出力どおりの数値を書き写すのではなく、この等式で検証する。
 *
 * 流儀は tools/_doubles_fixture_test.js(buildEngine / setFormat({slotsPerSide:2}) / placeSlot / runTurn /
 * battleLog)に合わせる。placeSlot は同ファイルから写した(require しない=あちらはテストを実行してしまう)。
 * 修正はしない(監査専用)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// ---- _doubles_fixture_test.js から写した fixture ヘルパー ----------------------------------
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

function hitLines(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const mm = /^(.+?) の (.+?)！ (.+?) に (\d+) ダメージ！/.exec(String(log[i].msg));
    if (mm) out.push({ attacker: mm[1], move: mm[2], defender: mm[3], dmg: Number(mm[4]) });
  }
  return out;
}

// ---- 監査用の共通fixture ------------------------------------------------------------------
// self:0 = 攻撃役(デンリュウ・ab『プラス』を持つChampions個体)/ self:1 = 味方(ライボルト・ab上書き)
// opp:0  = 的(カビゴン・どんかんに上書き=いかく等でダメージが動かないように)/ opp:1 = 任意
// 技 = パワージェム(いわ・特殊80・命中100・追加効果なし)→ カビゴン(ノーマル)には等倍。
//   物理版の比較には はたく(ノーマル・物理40・命中100・追加効果なし)を使う。
const NEUTRAL = 'どんかん';   // プラス/マイナスと無関係でダメージ計算に触らない特性(防御側いかく避けも兼ねる)

function damageOnce(opts) {
  const E = build2v2();
  const moveKey = opts.moveKey || 'pawaajiemu';
  const atk = placeSlot(E, 'self', 0, 'デンリュウ', moveKey, { ability: opts.selfAbility });
  placeSlot(E, 'self', 1, opts.ally ? 'ライボルト' : null, null,
    opts.ally ? { ability: opts.allyAbility } : {});
  placeSlot(E, 'opp', 0, 'カビゴン', null, { ability: NEUTRAL });
  placeSlot(E, 'opp', 1, opts.oppAlly ? 'ライボルト' : null, null,
    opts.oppAlly ? { ability: opts.oppAllyAbility } : {});
  if (opts.spatkRank) atk.rank = Object.assign({}, atk.rank, { spatk: opts.spatkRank });
  E.setRandom(mulberry32(opts.seed != null ? opts.seed : 11));
  E.runTurn();
  const hits = hitLines(E.battleLog);
  assert.equal(hits.length, 1, `攻撃役1体だけが攻撃するはず(実際のダメージ行=${hits.length}本)`);
  return hits[0].dmg;
}

// 乱数の1/16幅で結論が揺れないよう、複数シードで必ず同じ判定になることを確かめる
const SEEDS = [11, 23, 57, 101, 777];
function damages(opts) { return SEEDS.map(s => damageOnce(Object.assign({}, opts, { seed: s }))); }

// ===== 主張1: 味方の場にマイナスがいると、プラス持ちの とくこう が1.5倍になる ==================
// 出典S1「プラスかマイナスの特性を持つ味方が 場にいると 自分の特攻が1.5倍になる」
// 倍率の独立オラクル= とくこうランク+1(×1.5・出典: ランク補正表)と同じダメージになるはず。
test('主張1: 味方にマイナスが居ると プラス持ちの とくこう1.5倍(=とくこうランク+1と同じダメージ)', () => {
  const withAlly = damages({ selfAbility: 'プラス', ally: true, allyAbility: 'マイナス' });
  const oracle15 = damages({ selfAbility: 'プラス', ally: true, allyAbility: NEUTRAL, spatkRank: 1 });
  const plain = damages({ selfAbility: 'プラス', ally: true, allyAbility: NEUTRAL });
  assert.deepEqual(withAlly, oracle15,
    `味方マイナス有り=${JSON.stringify(withAlly)} は とくこう×1.5(ランク+1)=${JSON.stringify(oracle15)} と一致すべき`
    + ` / 補正なし=${JSON.stringify(plain)}`);
  assert.notDeepEqual(withAlly, plain,
    `味方マイナス有りのダメージ(${JSON.stringify(withAlly)})が補正なし(${JSON.stringify(plain)})と同じ=特性が未発動`);
});

// ===== 主張2: 味方が「プラス」でも発動する(第五世代以降=現行仕様) =============================
// 出典S3「第五世代の変更は『プラス/マイナスどちらの味方でも可』」+ 出典S1の「プラスかマイナスの…味方」
test('主張2: 味方がプラス(同じ特性)でも プラス持ちの とくこう1.5倍になる', () => {
  const allyPlus = damages({ selfAbility: 'プラス', ally: true, allyAbility: 'プラス' });
  const oracle15 = damages({ selfAbility: 'プラス', ally: true, allyAbility: NEUTRAL, spatkRank: 1 });
  assert.deepEqual(allyPlus, oracle15,
    `味方プラス有り=${JSON.stringify(allyPlus)} は とくこう×1.5=${JSON.stringify(oracle15)} と一致すべき`);
});

// ===== 主張3: 相手の場にマイナスがいるだけでは発動しない ======================================
// 出典S2「・プラスやマイナスのポケモンが相手の場にいるだけでは発動しない。」
// (味方側は無関係な特性に固定。相手の枠1だけを マイナス/無関係 で入れ替えて比較する)
test('主張3: 相手の場のマイナスでは発動しない(味方側が無関係な特性なら補正ゼロ)', () => {
  const oppMinus = damages({ selfAbility: 'プラス', ally: true, allyAbility: NEUTRAL,
    oppAlly: true, oppAllyAbility: 'マイナス' });
  const oppNeutral = damages({ selfAbility: 'プラス', ally: true, allyAbility: NEUTRAL,
    oppAlly: true, oppAllyAbility: NEUTRAL });
  assert.deepEqual(oppMinus, oppNeutral,
    `相手側マイナス=${JSON.stringify(oppMinus)} は 相手側も無関係な特性=${JSON.stringify(oppNeutral)} と同じであるべき`);
});

// ===== 主張4: 1体だけでは発動しない(味方に相方が居ない) ======================================
// 出典S1 備考「1体だけでは発動せず、味方に対になる特性を持つ個体が要る」
// (味方枠を空席にした場合と、味方が無関係な特性の場合のどちらも補正なしと一致するはず)
test('主張4: プラス持ち1体だけ(味方が空席/無関係な特性)では補正が掛からない', () => {
  const solo = damages({ selfAbility: 'プラス', ally: false });
  const allyNeutral = damages({ selfAbility: 'プラス', ally: true, allyAbility: NEUTRAL });
  const oracle15 = damages({ selfAbility: 'プラス', ally: true, allyAbility: NEUTRAL, spatkRank: 1 });
  assert.deepEqual(solo, allyNeutral,
    `味方空席=${JSON.stringify(solo)} と 味方が無関係な特性=${JSON.stringify(allyNeutral)} は同じであるべき`);
  assert.notDeepEqual(solo, oracle15,
    `1体だけなのに とくこう×1.5相当(${JSON.stringify(oracle15)})のダメージが出ている=誤発動`);
});

// ===== 主張5: 上がるのは「とくこう」だけ(物理技には乗らない) ==================================
// 出典S5 master/abilities.json「『とくこう』が1.5倍になる」
test('主張5: 物理技(はたく)のダメージは味方マイナスの有無で変わらない(とくこう限定)', () => {
  const withAlly = damages({ selfAbility: 'プラス', ally: true, allyAbility: 'マイナス', moveKey: 'hataku' });
  const plain = damages({ selfAbility: 'プラス', ally: true, allyAbility: NEUTRAL, moveKey: 'hataku' });
  assert.deepEqual(withAlly, plain,
    `物理: 味方マイナス有り=${JSON.stringify(withAlly)} / 無し=${JSON.stringify(plain)} は同じであるべき`);
});
