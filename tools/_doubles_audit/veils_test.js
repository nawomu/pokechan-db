/*
 * tools/_doubles_audit/veils_test.js
 *   ダブル監査: スイートベール / アロマベール / フラワーベール(=「味方の状態を予防する」3特性)
 *   実行: node tools/_doubles_audit/veils_test.js
 *
 * 立場: 監査(修正はしない)。期待値は権威ソースの引用だけから立てる。
 *       エンジンの出力を期待値に写さない(CLAUDE.md「バトル再現の北極星」)。
 *       シングルの動作は対象外。ここは E.setFormat({slotsPerSide:2}) の fixture だけを見る。
 *
 * ──────────────── 出典(一字一句の引用) ────────────────
 * [S1] ポケモンWiki「スイートベール」#効果
 *      https://wiki.pokemonwiki.com/wiki/スイートベール (2026-09-11 取得)
 *      「自分を含めた味方のポケモンはねむり・ねむけ状態にならなくなる。」
 *      同ページ #説明文 Champions 欄: 「自分と味方は ねむり ねむけ状態にならない。」
 * [S2] 同 #特性の仕様
 *      「トリプルバトルにおいては隣接していない味方にも効果がある。」
 *      (=味方への効果が本体。隣接に関係なく味方側の枠を守る)
 * [S3] ポケモンWiki「アロマベール」#効果
 *      https://wiki.pokemonwiki.com/wiki/アロマベール (2026-09-11 取得)
 *      「自分を含めた味方のポケモンは、以下の状態変化にならなくなる。」
 *      → 列挙:「メロメロ」「アンコール」「いちゃもん」「かなしばり」「ちょうはつ」「かいふくふうじ」
 *      同ページ #説明文 Champions 欄:
 *      「自分と味方は メロメロ ちょうはつ 連続不可 わざふうじ かいふくふうじ アンコール状態にならない。」
 * [S4] 同 #特性の仕様
 *      「特性メロメロボディ/のろわれボディの効果も防ぐことができる。」
 *      「すでに状態変化になったポケモンを治すことはできない (マイペース/どんかんなどとは異なる)。」
 *      (=どんかん等の「自分だけ」型とは別物であることを Wiki 自身が区別している)
 * [S5] ポケモンWiki「フラワーベール」#効果
 *      https://wiki.pokemonwiki.com/wiki/フラワーベール (2026-09-11 取得)
 *      「味方の場にいるすべてのくさタイプのポケモンは、他のポケモンからランク補正を下げられず、
 *        状態異常・ねむけにもされない。」
 *      同ページ #説明文 Champions 欄:
 *      「味方のくさタイプのポケモンは 能力が下がらず 状態異常にもならない。」
 * [S6] 同 #特性の仕様
 *      「自身や隣接していない味方もくさタイプならば効果対象となる。」
 *      「自発的にランクを下げたり状態異常になったりする技/特性/もちものに対しては発動しない。
 *        以下の効果はフラワーベールで防げない。」→「リーフストームなど自分のランク補正を下げる技」
 * [S7] review/_doubles_research_2026-09-07/T6_特性と持ち物.md #30/#31/#32(ローカルの控え・同趣旨)
 *
 * ──────────────── Champions 搭載の確認 ────────────────
 * master/abilities.json: スイートベール champions=true(搭載3体) / アロマベール champions=true /
 *   フラワーベール champions=true。※パステルベール champions=false なので本監査の対象外。
 *
 * ──────────────── 主張(ダブルでどう動くべきか) ────────────────
 *  C1 [S1][S2] スイートベール持ちが味方の枠にいると、その味方はねむり状態にならない。
 *  C2 [S1]     スイートベール持ちが味方の枠にいると、その味方はねむけ(あくび)状態にならない。
 *  C3 [S3]     アロマベール持ちが味方の枠にいると、その味方はちょうはつ/いちゃもんにならない。
 *  C4 [S3][S4] アロマベール持ちが味方の枠にいると、その味方はメロメロにならない
 *              (=どんかんのような「自分だけ」型ではない)。
 *  C5 [S5][S6] フラワーベール持ちが味方の枠にいると、くさタイプの味方は相手からのランク低下も
 *              状態異常も受けない。ただし自分の技による自傷のランク低下は防がない(=防ぎすぎない)。
 *
 * ──────────────── テストの組み方(偽合格の防止) ────────────────
 * ・各主張は独立した test() にする。
 * ・どの test も「対照(ベール無し)」→「ベール有り」の2本立て。対照は同じポケモンの別の特性
 *   (ペロリーム=かるわざ / フレフワン=いやしのこころ / フラージェス=きょうせい)に差し替えただけで、
 *   fixture の他の条件は1bitも変えない。
 * ・命中率のある技は「対照が成立する seed」を探してから、同じ seed をベール有りにも使う
 *   (=「技が外れたから状態が none のまま」での偽合格を防ぐ)。
 * ・fixture 前提(味方枠の特性/生存/被害者のタイプ)は assert で先に固める。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require(path.join(__dirname, '..', '_sim_engine.js'));
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// 枠1つに任意のポケモン/技を置く(tools/_doubles_fixture_test.js の placeSlot をそのまま写したもの。
// require すると向こうのテストが走ってしまうのでコピーしている。gender だけ監査用に足した)。
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
  if (opts.gender != null) st.gender = opts.gender;   // メロメロ(異性判定)用
  return st;
}

// 2枠×2側の fixture(_doubles_fixture_test.js の build2v2 と同じ流儀)
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

const msgList = log => log.map(l => String(l.msg));

/*
 * 共通の舞台(ダブル):
 *   自分側スロット0 = 攻撃側。相手側スロット0(=被害者)に変化技を1回撃つ。
 *   相手側スロット1 = 「ベール持ちの味方」。ベールはこの隣の枠の味方を守らなければならない。
 *   自分側スロット1 = 空席(行動しない)。
 */
function runVeilScenario(o) {
  const E = build2v2();
  placeSlot(E, 'self', 0, o.attacker, o.moveKey,
    { targetChoice: { side: 'opp', idx: 0 }, ability: o.attackerAbility, gender: o.attackerGender });
  placeSlot(E, 'self', 1, null, null);
  const victim = placeSlot(E, 'opp', 0, o.victim, null,
    { ability: o.victimAbility, gender: o.victimGender });
  const ally = placeSlot(E, 'opp', 1, o.ally, null,
    { ability: o.allyAbility, gender: o.allyGender });

  // ★fixture が本当に意図した形か先に固める(ここが崩れるとテストは何も見ていない)
  assert.equal(E.slotOf('opp', 1).ability, o.allyAbility, '相手側スロット1の特性が意図どおり入っている');
  assert.ok(ally.poke && !ally.fainted, '味方(ベール持ち枠)は場に生きている');
  assert.ok(victim.poke && !victim.fainted, '被害者は場に生きている');
  assert.notEqual(E.slotOf('opp', 0).ability, o.allyAbility, '被害者自身はベールを持っていない(=味方経由の効果だけを見る)');

  E.setRandom(mulberry32(o.seed));
  E.runTurn();
  return { E, victim, ally, log: msgList(E.battleLog) };
}

// 命中率のある技用: 対照(ベール無し)で効果が確実に入る seed を探す。
// 見つけた seed をベール有りにも使うので、2つのシナリオの乱数列は完全に同じになる。
function findLandingSeed(base, controlAbility, landed) {
  for (let seed = 1; seed <= 30; seed++) {
    const r = runVeilScenario(Object.assign({}, base, { allyAbility: controlAbility, seed }));
    if (landed(r.victim)) return { seed, control: r };
  }
  return { seed: null, control: null };
}

// ===== C1 [S1][S2] スイートベール: 味方(隣の枠)はねむり状態にならない =====
test('C1 スイートベール: 隣の枠の味方はねむりごなでねむり状態にならない', () => {
  const base = {
    attacker: 'カメックス', attackerAbility: 'げきりゅう',
    moveKey: 'nemurigona',                               // ねむりごな(ねむり付与・命中75)
    victim: 'リザードン', victimAbility: 'もうか',        // ねむり免疫特性なし・ほのお/ひこう=粉が無効ではない
    ally: 'ペロリーム',                                   // 実機のスイートベール持ち(ab1)
  };
  const isAsleep = v => v.status === 'sleep';

  // 対照: 味方の特性を同じペロリームの別特性(かるわざ)にすると、被害者はねむる
  const { seed, control } = findLandingSeed(base, 'かるわざ', isAsleep);
  assert.ok(seed, '対照(ベール無し)でねむりごなが当たる seed が見つかる(=この舞台でねむりは成立する)');

  // 本番: 味方がスイートベールなら、被害者はねむり状態にならない
  const veil = runVeilScenario(Object.assign({}, base, { allyAbility: 'スイートベール', seed }));
  assert.equal(veil.victim.status, 'none',
    '[S1]「自分を含めた味方のポケモンはねむり・ねむけ状態にならなくなる。」\n' +
    `  対照(かるわざ)では status=${control.victim.status} / ベール有りでは status=${veil.victim.status}\n` +
    `  ベール有りのログ: ${veil.log.join(' / ')}`);
});

// ===== C2 [S1] スイートベール: 味方はねむけ(あくび)状態にならない =====
test('C2 スイートベール: 隣の枠の味方はあくびでねむけ状態にならない', () => {
  const base = {
    attacker: 'カメックス', attackerAbility: 'げきりゅう',
    moveKey: 'akubi',                                    // あくび(ねむけ付与・命中判定なし=必ず通る)
    victim: 'リザードン', victimAbility: 'もうか',
    ally: 'ペロリーム',
    seed: 1,
  };
  const drowsy = v => !!(v.pendingStatus && v.pendingStatus.code === 'sleep');

  const ctrl = runVeilScenario(Object.assign({}, base, { allyAbility: 'かるわざ' }));
  assert.ok(drowsy(ctrl.victim),
    `対照(ベール無し)ではねむけが入る(=この舞台でねむけは成立する)。ログ: ${ctrl.log.join(' / ')}`);

  const veil = runVeilScenario(Object.assign({}, base, { allyAbility: 'スイートベール' }));
  assert.equal(drowsy(veil.victim), false,
    '[S1]「…ねむり・ねむけ状態にならなくなる。」(Champions説明文も「ねむり ねむけ状態にならない」)\n' +
    `  ベール有りのログ: ${veil.log.join(' / ')}`);
});

// ===== C3 [S3] アロマベール: 味方はちょうはつ/いちゃもんにならない =====
test('C3 アロマベール: 隣の枠の味方はちょうはつ・いちゃもん状態にならない', () => {
  const base = {
    attacker: 'カメックス', attackerAbility: 'げきりゅう',
    victim: 'リザードン', victimAbility: 'もうか',
    ally: 'フレフワン',                                  // 実機のアロマベール持ち(ab3)
    seed: 1,
  };
  // Wiki の列挙のうち、前提(相手が技を使っている等)なしで単発で検証できる2つを見る。
  const cases = [
    { moveKey: 'chouhatsu', label: 'ちょうはつ', landed: v => (v.tauntTurns || 0) > 0 },
    { moveKey: 'ichamon',   label: 'いちゃもん', landed: v => v.tormented === true },
  ];
  const gaps = [];
  for (const c of cases) {
    const ctrl = runVeilScenario(Object.assign({}, base, { moveKey: c.moveKey, allyAbility: 'いやしのこころ' }));
    assert.ok(c.landed(ctrl.victim),
      `対照(ベール無し)では ${c.label} が入る(=この舞台で ${c.label} は成立する)。ログ: ${ctrl.log.join(' / ')}`);
    const veil = runVeilScenario(Object.assign({}, base, { moveKey: c.moveKey, allyAbility: 'アロマベール' }));
    if (c.landed(veil.victim)) gaps.push(`${c.label}(ログ: ${veil.log.join(' / ')})`);
  }
  assert.deepEqual(gaps, [],
    '[S3]「自分を含めた味方のポケモンは、以下の状態変化にならなくなる。」' +
    '→「メロメロ」「アンコール」「いちゃもん」「かなしばり」「ちょうはつ」「かいふくふうじ」\n' +
    '  味方のアロマベールで防がれなかったもの: ' + gaps.join(' | '));
});

// ===== C4 [S3][S4] アロマベール: 味方はメロメロにならない(「自分だけ」型ではない) =====
test('C4 アロマベール: 隣の枠の味方はメロメロ状態にならない', () => {
  const base = {
    attacker: 'カメックス', attackerAbility: 'げきりゅう', attackerGender: '♂',
    moveKey: 'meromero',                                 // メロメロ(命中100・異性同士でのみ成立)
    victim: 'リザードン', victimAbility: 'もうか', victimGender: '♀',
    ally: 'フレフワン', allyGender: '♀',
    seed: 1,
  };
  const ctrl = runVeilScenario(Object.assign({}, base, { allyAbility: 'いやしのこころ' }));
  assert.equal(ctrl.victim.attracted, true,
    `対照(ベール無し)ではメロメロになる(=異性判定も命中も通っている)。ログ: ${ctrl.log.join(' / ')}`);

  const veil = runVeilScenario(Object.assign({}, base, { allyAbility: 'アロマベール' }));
  assert.notEqual(veil.victim.attracted, true,
    '[S3]「…メロメロ…にならなくなる。」/ [S4]「すでに状態変化になったポケモンを治すことはできない' +
    ' (マイペース/どんかんなどとは異なる)。」= アロマベールは「自分だけ」型ではない\n' +
    `  ベール有りのログ: ${veil.log.join(' / ')}`);
});

// ===== C5 [S5][S6] フラワーベール: くさタイプの味方はランク低下も状態異常も受けない
//        (ただし自傷のランク低下は防がない=防ぎすぎない) =====
test('C5 フラワーベール: くさタイプの隣の味方はランク低下・状態異常を受けない(自傷は防がない)', () => {
  const base = {
    attacker: 'カメックス', attackerAbility: 'げきりゅう',
    victim: 'フシギバナ', victimAbility: 'しんりょく',    // くさ/どく=フラワーベールの対象タイプ
    ally: 'フラージェス(あかいはな)',                     // 実機のフラワーベール持ち(ab1)
  };
  // 前提: 被害者は本当にくさタイプか(ここが崩れると主張そのものが成立しない)
  {
    const probe = build2v2();
    const st = placeSlot(probe, 'opp', 0, base.victim, null, { ability: base.victimAbility });
    const types = probe.sideTypes ? probe.sideTypes(st) : [st.poke.type1, st.poke.type2].filter(Boolean);
    assert.ok(types.includes('くさ'), `被害者(${base.victim})はくさタイプである。実際: ${types.join('/')}`);
  }

  const gaps = [];

  // (a) 相手の技によるランク低下: あまえる(こうげき-2・命中100)
  {
    const b = Object.assign({}, base, { moveKey: 'amaeru' });
    const { seed, control } = findLandingSeed(b, 'きょうせい', v => v.rank.atk < 0);
    assert.ok(seed, '対照(ベール無し)では こうげき が下がる(=この舞台でランク低下は成立する)');
    assert.equal(control.victim.rank.atk, -2, 'あまえるは こうげき-2(ポケモンWiki「あまえる」)');
    const veil = runVeilScenario(Object.assign({}, b, { allyAbility: 'フラワーベール', seed }));
    if (veil.victim.rank.atk !== 0) {
      gaps.push(`相手の技によるこうげき低下(rank.atk=${veil.victim.rank.atk} / ログ: ${veil.log.join(' / ')})`);
    }
  }

  // (b) 相手の技による状態異常: でんじは(まひ)
  {
    const b = Object.assign({}, base, { moveKey: 'denjiha' });
    const { seed } = findLandingSeed(b, 'きょうせい', v => v.status === 'paralysis');
    assert.ok(seed, '対照(ベール無し)では まひ になる(=この舞台で状態異常は成立する)');
    const veil = runVeilScenario(Object.assign({}, b, { allyAbility: 'フラワーベール', seed }));
    if (veil.victim.status !== 'none') {
      gaps.push(`相手の技による状態異常(status=${veil.victim.status} / ログ: ${veil.log.join(' / ')})`);
    }
  }

  assert.deepEqual(gaps, [],
    '[S5]「味方の場にいるすべてのくさタイプのポケモンは、他のポケモンからランク補正を下げられず、' +
    '状態異常・ねむけにもされない。」/ [S6]「自身や隣接していない味方もくさタイプならば効果対象となる。」\n' +
    '  味方のフラワーベールで防がれなかったもの: ' + gaps.join(' | '));
});

// ===== C5 の境界(同じ [S6] の「防げない」リスト): 防ぎすぎていないか =====
test('C5-境界 フラワーベール: 自分の技による自傷のランク低下は防がない', () => {
  // くさタイプ本人(フシギバナ)がリーフストームを撃つ → とくこう-2 は自発的な低下なので防がれない
  const E = build2v2();
  placeSlot(E, 'self', 0, 'カメックス', null, { ability: 'げきりゅう' });
  placeSlot(E, 'self', 1, null, null);
  const shooter = placeSlot(E, 'opp', 0, 'フシギバナ', 'riifusutoomu',
    { ability: 'しんりょく', targetChoice: { side: 'self', idx: 0 } });
  placeSlot(E, 'opp', 1, 'フラージェス(あかいはな)', null, { ability: 'フラワーベール' });
  E.setRandom(mulberry32(1));
  E.runTurn();
  assert.equal(shooter.rank.spatk, -2,
    '[S6]「自発的にランクを下げたり状態異常になったりする技/特性/もちものに対しては発動しない。' +
    '以下の効果はフラワーベールで防げない。」→「リーフストームなど自分のランク補正を下げる技」\n' +
    `  実際の rank.spatk=${shooter.rank.spatk} / ログ: ${msgList(E.battleLog).join(' / ')}`);
});
