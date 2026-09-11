/*
 * tools/_doubles_audit/battery_power_spot_test.js
 *   監査(修正はしない): バッテリー / パワースポット = 「味方の技の威力1.3倍・重複」のダブル挙動
 *   実行: node tools/_doubles_audit/battery_power_spot_test.js
 *
 * 流儀: tools/_doubles_fixture_test.js と同じ(buildEngine / setFormat({slotsPerSide:2}) / placeSlot /
 *       runTurn / battleLog)。placeSlot / build2v2 / hitLines は同ファイルから写した
 *       (require すると向こうのテスト本体が走ってしまうため)。
 *
 * ★期待値の出どころ = 権威ソース(ポケモンWiki)。エンジンの出力は一切写していない。
 *   ポケモンWiki「バッテリー」 https://wiki.xn--rckteqa2e.com/wiki/バッテリー
 *     (oldid=826507・最終更新 2026年9月6日。curl -sL -A "Mozilla/5.0" で本文取得・2026-09-11 確認)
 *     効果       「自分以外の味方が使う特殊技の威力が1.3倍になる。」
 *     特性の仕様 「正確な補正率は5325/4096倍。」
 *                「自身が使う技の特殊技の威力は上がらない。」
 *                「味方の場に複数のバッテリーのポケモンがいる場合、効果はその分累積する。
 *                  2匹のバッテリーの効果を得たポケモンの特殊技の威力は6923/4096(≒1.69)倍、
 *                  3体なら9000/4096(≒2.12)倍になる。」
 *     備考       「似た効果を持つ特性にパワースポットがあり、これは物理特殊問わず味方の技の威力が1.3倍になる。」
 *   ポケモンWiki「パワースポット」 https://wiki.xn--rckteqa2e.com/wiki/パワースポット
 *     (oldid=802251・最終更新 2026年4月17日。同上で取得・2026-09-11 確認)
 *     効果       「自分以外の味方が使う攻撃技の威力が1.3倍になる。」
 *     特性の仕様 「正確な補正率は5325/4096倍。」
 *                「自身が使う技の威力は上がらない。」
 *                「物理・特殊問わずに威力が上がる。」
 *                「味方の場に複数のパワースポットのポケモンがいる場合、効果はその分累積する。
 *                  2匹のパワースポットの効果を得たポケモンの技の威力は6923/4096(≒1.69)倍、
 *                  3体なら9000/4096(≒2.12)倍になる。」
 *
 * ★主張(ダブルでどう動くべきか)= 1テスト1主張で独立に並べた:
 *   C1 バッテリー: 味方(自分以外)の特殊技の威力が ×5325/4096(≒1.3)
 *   C2 バッテリー: 自身が使う特殊技の威力は上がらない(自己除外)
 *   C3 バッテリー: 味方の「物理」技の威力は上がらない(物理特殊問わずなのはパワースポットの方)
 *   C4 パワースポット: 味方の物理技の威力が ×5325/4096
 *   C5 パワースポット: 味方の特殊技の威力も ×5325/4096(物理・特殊問わず)
 *   C6 パワースポット: 自身が使う技の威力は上がらない(自己除外)
 *   C7 重複: 味方の場にバッテリーが2体いると ×6923/4096(≒1.69)。
 *            ★ダブル(slotsPerSide=2)では味方枠が1つしかないので原理上2体並べられない。
 *              Wikiの累積規定は3体(トリプル/レイド)まで書かれているので、ここだけ
 *              setFormat({slotsPerSide:3})の器で測る(器はsyncSlotsToFormatが任意枠数に対応済み)。
 *
 * ★「ゼロ実装で否定側の主張が空振りpassする」のを防ぐため、C2/C3/C6 の「上がらない」側は
 *   先に『機構が在ること(味方への1.3倍が実際に乗ること)』を前提条件としてassertしてから除外を確認する。
 *   機構が無ければ前提条件で落ちる(= 偽のpassを出さない)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { buildEngine, mulberry32, ROOT } = require('../_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);

// ---- Champions 搭載チェック(master = SSOT をそのまま読む) --------------------------------
const abRows = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'master', 'abilities.json'), 'utf8'));
  return j.items || j;
})();
const pokeRows = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'master', 'pokemon.json'), 'utf8'));
  return j.items || j;
})();
console.log('--- Champions 搭載ゲート(master/*.json = SSOT) ---');
for (const name of ['バッテリー', 'パワースポット']) {
  const r = abRows.find(a => a.name === name);
  const carriers = pokeRows.filter(p => [p.ab1, p.ab2, p.ab3].includes(name));
  console.log(`[gate] ${name}: abilities.json champions=${r && r.champions}`
    + ` / champions_pokemon_count=${r && r.champions_pokemon_count}`
    + ` / 所有ポケモン=${carriers.map(p => `${p.name}(champions=${p.champions})`).join(',') || 'なし'}`
    + ` / pokechan_data.js(Champions view)に所有ポケモン=`
    + `${carriers.filter(p => pokeByName(p.name)).map(p => p.name).join(',') || 'いない'}`);
}
console.log('--- 以降は「Championsに入った場合に満たすべき挙動」の監査テスト ---');

// ---- fixture(_doubles_fixture_test.js から写した) -----------------------------------------
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
function buildNvN(slotsPerSide) {
  const E = buildEngine();
  E.setFormat({ slotsPerSide: slotsPerSide });
  // resetBattle()が枠1以降を生やすには「側」に何か居る必要があるので、先に仮の個体を置いてから
  // resetBattle()を呼び、その後で全枠をplaceSlot()で確定させる(_doubles_fixture_test.jsと同じ)。
  for (const s of ['self', 'opp']) {
    E.sides[s].poke = pokeByName('フシギバナ');
    E.sides[s].moves = [];
    E.sides[s].currentHp = E.realStat(E.sides[s], 'hp');
  }
  E.resetBattle();
  return E;
}
function hitLines(log) {
  // E.battleLogはvm(別レルム)の配列なのでfor文でこの場のArrayに詰め直す(fixture側の既知の罠と同じ)
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const mm = /^(.+?) の (.+?)！ (.+?) に (\d+) ダメージ！/.exec(String(log[i].msg));
    if (mm) out.push({ attacker: mm[1], move: mm[2], defender: mm[3], dmg: Number(mm[4]) });
  }
  return out;
}

// 中立特性(ダメージ計算に一切関与しない)を対照に使う: ふみん = ねむり無効のみ
const NEUTRAL = 'ふみん';
// Wiki「正確な補正率は5325/4096倍」。帯で見る理由 = pokeRound丸めと16通りダメージ乱数の段差を吸収し
// 「1.3倍が乗っているか/乗っていないか」だけを判定するため(小数一致を要求して偽failにしない)。
const Q1 = 5325 / 4096;           // ≒1.2998
const Q2 = 6923 / 4096;           // ≒1.6902(2体重複)
const BAND1 = [1.26, 1.34];
const BAND2 = [1.63, 1.75];

/* 1ターン回して self:0(フシギバナ)の与ダメージを返す。
 *  self:0 = フシギバナ(攻撃役・特性 attackerAbility)・技 moveKey・対象 opp:0
 *  self:1.. = カメックス(味方・技なし=行動しない・特性 allyAbilities[i])
 *  opp:0  = ケンタロス(受け役・ノーマル単 = かえんほうしゃ/たきのぼり どちらも等倍)・中立特性
 *  opp:1.. = 空席
 * 乱数はseed固定。特性文字列以外の条件は完全に同一なので乱数の消費列も同一 = ダメージ乱数のrollも同一。
 */
function dmgOf(seed, moveKey, allyAbilities, attackerAbility, slotsPerSide) {
  const n = slotsPerSide || 2;
  const E = buildNvN(n);
  placeSlot(E, 'self', 0, 'フシギバナ', moveKey,
    { ability: attackerAbility || NEUTRAL, targetChoice: { side: 'opp', idx: 0 } });
  for (let i = 1; i < n; i++) {
    placeSlot(E, 'self', i, 'カメックス', null, { ability: allyAbilities[i - 1] || NEUTRAL });
  }
  placeSlot(E, 'opp', 0, 'ケンタロス', null, { ability: NEUTRAL });
  for (let i = 1; i < n; i++) placeSlot(E, 'opp', i, null, null);
  E.setRandom(mulberry32(seed));
  E.runTurn();
  const hit = hitLines(E.battleLog).find(h => h.attacker === 'フシギバナ');
  assert.ok(hit, `フシギバナの攻撃行がログに出ているはず(seed=${seed}, move=${moveKey}, 枠=${n})`);
  return hit.dmg;
}

const SEEDS = [11, 23, 37, 59, 97];
// 「対照(全員中立)」と「検体(特性あり)」を同seedで測り比を返す
function measure(moveKey, opts) {
  const o = opts || {};
  const n = o.slotsPerSide || 2;
  const allies = o.allies || [NEUTRAL];
  const attacker = o.attacker || NEUTRAL;
  const ctrlAllies = allies.map(() => NEUTRAL);
  return SEEDS.map(s => {
    const off = dmgOf(s, moveKey, ctrlAllies, NEUTRAL, n);
    const on = dmgOf(s, moveKey, allies, attacker, n);
    return { seed: s, off, on, r: on / off };
  });
}
function fmt(rows) {
  return rows.map(x => `seed${x.seed}: 対照${x.off}→検体${x.on}(×${x.r.toFixed(3)})`).join(' / ');
}
function inBand(r, band) { return r > band[0] && r < band[1]; }

// 否定側テストの前提条件: 味方へのバッテリー1.3倍が実際に効いていること。
// これが無い(=未実装)まま「上がらない」をassertすると空振りでpassしてしまうため必ず先に通す。
function requireMechanism(abilityName) {
  const pre = measure('kaenhousha', { allies: [abilityName] });
  assert.ok(pre.every(x => inBand(x.r, BAND1)),
    `前提条件: 味方の${abilityName}による特殊技1.3倍が実装されていること`
    + `(これが無いと「自己除外/物理は対象外」は空振りでpassしてしまう)。実測 ${fmt(pre)}`);
}

// ===== H0: 測り方そのものの自己点検(これが通らない限り C1〜C7 の「×1.000」は信用できない) =====
// ①4枠が意図どおり埋まっている(味方枠self:1に本当にポケモンが在場し、特性上書きも載っている)
// ②特性によるダメージ変化をこのハーネスが実際に検出できる(=ちからもち物理2倍の陽性対照)
// ★これを置く理由: ①②が壊れていると「特性を変えてもダメージが動かない」という結果が、
//   「機構が未実装」ではなく「テストが的を外している」だけで出てしまう(偽のunimplemented)。
test('H0(ハーネス自己点検): 4枠が埋まり、特性によるダメージ変化を検出できる(陽性対照=ちからもち)', () => {
  const E = buildNvN(2);
  placeSlot(E, 'self', 0, 'フシギバナ', 'takinobori',
    { ability: NEUTRAL, targetChoice: { side: 'opp', idx: 0 } });
  placeSlot(E, 'self', 1, 'カメックス', null, { ability: 'バッテリー' });
  placeSlot(E, 'opp', 0, 'ケンタロス', null, { ability: NEUTRAL });
  placeSlot(E, 'opp', 1, null, null);
  const slots = [];
  const as = E.activeSlots();
  for (let i = 0; i < as.length; i++) {
    slots.push(`${as[i].side}:${as[i].idx}=${(as[i].st.poke && as[i].st.poke.name) || '空席'}`
      + `/ab=${as[i].st.ability || ''}`);
  }
  console.log('  H0 activeSlots(' + as.length + ') ' + slots.join(' | '));
  assert.equal(as.length, 4, 'slotsPerSide=2 なら在場枠は4つ');
  assert.equal(E.slotOf('self', 1).poke.name, 'カメックス', '味方枠self:1に本当に味方が立っている');
  assert.equal(E.slotOf('self', 1).ability, 'バッテリー', '味方枠の特性上書きが載っている');

  // 陽性対照: ちからもち(物理こうげき2倍・エンジン実装済み real_battle_simulator.html:1829)を
  // 攻撃役に載せると、同じseedでダメージがはっきり動く = 測り方は生きている。
  const off = dmgOf(11, 'takinobori', [NEUTRAL], NEUTRAL);
  const on = dmgOf(11, 'takinobori', [NEUTRAL], 'ちからもち');
  console.log(`  H0 陽性対照(ちからもち) seed11: 対照${off}→検体${on}(×${(on / off).toFixed(3)})`);
  assert.ok(on > off * 1.8,
    `陽性対照が効かない=ハーネスが特性のダメージ影響を拾えていない(対照${off}/検体${on})。`
    + `この場合 C1〜C7 の結果は判定に使えない`);
});

// ===== C1: バッテリーは味方(自分以外)の特殊技の威力を1.3倍(5325/4096)にする =====
test('C1: バッテリーの味方が隣にいると自分の特殊技(かえんほうしゃ)が約1.3倍になる', () => {
  const rows = measure('kaenhousha', { allies: ['バッテリー'] });
  console.log('  C1 ' + fmt(rows));
  for (const x of rows) {
    assert.ok(inBand(x.r, BAND1),
      `ポケモンWiki バッテリー 効果『自分以外の味方が使う特殊技の威力が1.3倍になる。』`
      + ` 特性の仕様『正確な補正率は5325/4096倍。』(=${Q1.toFixed(4)})。実測 ${fmt([x])}`);
  }
});

// ===== C2: バッテリー自身が使う特殊技は上がらない(自己除外) =====
test('C2: バッテリー持ち自身が使う特殊技の威力は上がらない(自己除外)', () => {
  requireMechanism('バッテリー');
  const rows = measure('kaenhousha', { attacker: 'バッテリー' });
  console.log('  C2 ' + fmt(rows));
  for (const x of rows) {
    assert.equal(x.on, x.off,
      `ポケモンWiki バッテリー 特性の仕様『自身が使う技の特殊技の威力は上がらない。』`
      + ` → 対照と同じダメージのはず。実測 ${fmt([x])}`);
  }
});

// ===== C3: バッテリーは味方の「物理」技は上げない =====
test('C3: バッテリーの味方が隣にいても物理技(たきのぼり)の威力は上がらない', () => {
  requireMechanism('バッテリー');
  const rows = measure('takinobori', { allies: ['バッテリー'] });
  console.log('  C3 ' + fmt(rows));
  for (const x of rows) {
    assert.equal(x.on, x.off,
      `ポケモンWiki バッテリー 効果『…味方が使う特殊技の威力が1.3倍』/ 備考『似た効果を持つ特性に`
      + `パワースポットがあり、これは物理特殊問わず味方の技の威力が1.3倍になる。』`
      + ` → バッテリーでは物理は等倍のはず。実測 ${fmt([x])}`);
  }
});

// ===== C4: パワースポットは味方の物理技の威力を1.3倍にする =====
test('C4: パワースポットの味方が隣にいると自分の物理技(たきのぼり)が約1.3倍になる', () => {
  const rows = measure('takinobori', { allies: ['パワースポット'] });
  console.log('  C4 ' + fmt(rows));
  for (const x of rows) {
    assert.ok(inBand(x.r, BAND1),
      `ポケモンWiki パワースポット 効果『自分以外の味方が使う攻撃技の威力が1.3倍になる。』`
      + ` 特性の仕様『物理・特殊問わずに威力が上がる。』『正確な補正率は5325/4096倍。』`
      + `(=${Q1.toFixed(4)})。実測 ${fmt([x])}`);
  }
});

// ===== C5: パワースポットは味方の特殊技も1.3倍にする =====
test('C5: パワースポットの味方が隣にいると自分の特殊技(かえんほうしゃ)も約1.3倍になる', () => {
  const rows = measure('kaenhousha', { allies: ['パワースポット'] });
  console.log('  C5 ' + fmt(rows));
  for (const x of rows) {
    assert.ok(inBand(x.r, BAND1),
      `ポケモンWiki パワースポット 特性の仕様『物理・特殊問わずに威力が上がる。』`
      + ` → 特殊技も5325/4096倍のはず。実測 ${fmt([x])}`);
  }
});

// ===== C6: パワースポット自身が使う技は上がらない(自己除外) =====
test('C6: パワースポット持ち自身が使う技の威力は上がらない(自己除外)', () => {
  requireMechanism('パワースポット');
  const rows = measure('kaenhousha', { attacker: 'パワースポット' });
  console.log('  C6 ' + fmt(rows));
  for (const x of rows) {
    assert.equal(x.on, x.off,
      `ポケモンWiki パワースポット 特性の仕様『自身が使う技の威力は上がらない。』`
      + ` → 対照と同じダメージのはず。実測 ${fmt([x])}`);
  }
});

// ===== C7: 重複(累積)= バッテリー2体で 6923/4096(≒1.69) =====
// ★ダブル(2枠)では味方枠が1つしかなく2体並べられないので、この主張だけ3枠の器で測る。
test('C7: 味方の場にバッテリーが2体いると特殊技の威力が約1.69倍(6923/4096)になる=効果が重複する', () => {
  const rows = measure('kaenhousha', { allies: ['バッテリー', 'バッテリー'], slotsPerSide: 3 });
  console.log('  C7 ' + fmt(rows));
  for (const x of rows) {
    assert.ok(inBand(x.r, BAND2),
      `ポケモンWiki バッテリー 特性の仕様『味方の場に複数のバッテリーのポケモンがいる場合、効果は`
      + `その分累積する。2匹のバッテリーの効果を得たポケモンの特殊技の威力は6923/4096(≒1.69)倍』`
      + `(=${Q2.toFixed(4)})。実測 ${fmt([x])}`);
  }
});
