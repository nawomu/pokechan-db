// tools/_mc_engine_check.js — レギュM-C対応のエンジン検査(2026-09-01)。メガシンカZの持ち物解決/はどうのぼうご/ねつこうかん/ふゆう/きれあじ。実行: node tools/_mc_engine_check.js
/* M-C対応(メガシンカZ+はどうのぼうご+ねつこうかん)の実機ゲート。
 * tools/_sim_test.js と同じ方式(real_battle_simulator.htmlの実エンジンをvmでそのまま実行)。
 * 実行: node mc_engine_check.js
 */
const path = require('path');
const ROOT = '/Users/masamichi/Documents/ポケモンDB';
const { buildEngine } = require(path.join(ROOT, 'tools/_sim_engine.js'));
const data = require(path.join(ROOT, 'pokechan_data.js'));

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '  → ' + detail : '')); }
}

const E = buildEngine();
function resetEnv() {
  E.env.weather = 'none'; E.env.weatherTurns = null; E.env.field = 'none'; E.env.fieldTurns = null;
  E.env.doubleBattle = false; E.env.trickRoom = false; E.env.trickRoomTurns = null;
  E.env.gravity = false; E.env.gravityTurns = null; E.env.wonderRoom = false; E.env.wonderRoomTurns = null;
  E.env.magicRoom = false; E.env.magicRoomTurns = null;
  if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
}
const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
const moveByName = n => Object.values(data.WAZA_MAP).find(m => m.name === n);

function freshSide(pokeName, moveNames) {
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  if (!s.poke) throw new Error('poke not found: ' + pokeName);
  s.ability = s.poke.ab1;
  s.moves = moveNames.map(n => { const m = moveByName(n); if (!m) throw new Error('move not found: ' + n); return m; });
  s.currentHp = E.realStat(s, 'hp');
  return s;
}

// ================= T1: ルカリオ+ルカリオナイトZ → メガルカリオZ =================
console.log('\n=== T1: メガルカリオZ (ルカリオナイトZ) ===');
{
  resetEnv();
  E.sides.self = freshSide('ルカリオ', ['はたく']);
  E.sides.self.item = 'mega_stone_lucario_z';
  E.sides.opp = freshSide('カビゴン', ['はたく']);
  const ok = E.megaEvolve('self');
  const p = E.sides.self.poke;
  check('T1a メガシンカ成功', ok === true, `ret=${ok}`);
  check('T1b フォームがメガルカリオZ(非Zでない)', p && p.name === 'メガルカリオZ', `name=${p && p.name}`);
  check('T1c 特性がはどうのぼうご', E.sides.self.ability === 'はどうのぼうご', `ability=${E.sides.self.ability}`);
  check('T1d 種族値 70/100/70/164/70/151',
    p.hp === 70 && p.atk === 100 && p.def === 70 && p.spatk === 164 && p.spdef === 70 && p.spd === 151,
    JSON.stringify({ hp: p.hp, atk: p.atk, def: p.def, spatk: p.spatk, spdef: p.spdef, spd: p.spd }));
  check('T1e 1バトル1回(2回目失敗)', E.megaEvolve('self') === false, '');
}

// ================= T2: はどうのぼうご=接触技ダメージ半減 =================
console.log('\n=== T2: はどうのぼうご(接触技ダメージ半減) ===');
{
  resetEnv();
  E.sides.opp = freshSide('ルカリオ', ['はたく']);
  E.sides.opp.item = 'mega_stone_lucario_z';
  E.megaEvolve('opp');
  check('T2 準備: opp=メガルカリオZ・はどうのぼうご', E.sides.opp.poke.name === 'メガルカリオZ' && E.sides.opp.ability === 'はどうのぼうご');

  E.sides.self = freshSide('カイリキー', ['クロスチョップ']);
  const contactMove = moveByName('クロスチョップ');
  check('T2 準備: クロスチョップは接触技', !!(contactMove && contactMove.contact === true), `contact=${contactMove && contactMove.contact}`);
  const withAura = E.calcDamage('self', 'opp', contactMove);
  const savedAbility = E.sides.opp.ability;
  E.sides.opp.ability = 'きんちょうかん'; // 無関係の中立特性に差し替えて同条件比較(防御側特性補正なし)
  const withoutAura = E.calcDamage('self', 'opp', contactMove);
  E.sides.opp.ability = savedAbility;
  // 許容差=2(pokeRoundの固定小数点丸めが半減以外の複数補正=STAB/相性/急所無し等と連鎖するため、
  // 単純な床(x/2)からわずかにずれ得る。比率で見て0.5に近いことを本質として確認する)
  check('T2a 接触技はダメージ半減(はどうのぼうご有 ≈ 無×0.5)',
    withAura && withoutAura && Math.abs(withAura.max - Math.floor(withoutAura.max / 2)) <= 2 && Math.abs(withAura.min - Math.floor(withoutAura.min / 2)) <= 2,
    `withAura=${withAura && withAura.min}-${withAura && withAura.max} withoutAura=${withoutAura && withoutAura.min}-${withoutAura && withoutAura.max}`);
  check('T2b chipsに はどうのぼうご ×0.5 が記録される',
    withAura && withAura.chips.some(c => c.label === 'はどうのぼうご' && c.factor === 0.5),
    JSON.stringify(withAura && withAura.chips));

  const nonContactMove = moveByName('10まんボルト');
  check('T2 準備: 10まんボルトは非接触技', !!(nonContactMove && nonContactMove.contact !== true), `contact=${nonContactMove && nonContactMove.contact}`);
  const ncWithAura = E.calcDamage('self', 'opp', nonContactMove);
  check('T2c 非接触技は半減されない(chipsにはどうのぼうご無し)',
    ncWithAura && !ncWithAura.chips.some(c => c.label === 'はどうのぼうご'),
    JSON.stringify(ncWithAura && ncWithAura.chips));
}

// ================= T3: ガブリアス+ガブリアスナイトZ → メガガブリアスZ・ふゆう =================
console.log('\n=== T3: メガガブリアスZ (ガブリアスナイトZ)・ふゆうでじめん無効 ===');
{
  resetEnv();
  E.sides.self = freshSide('ガブリアス', ['じしん']);
  E.sides.self.item = 'mega_stone_garchomp_z';
  const ok = E.megaEvolve('self');
  const p = E.sides.self.poke;
  check('T3a メガシンカ成功・メガガブリアスZ', ok === true && p.name === 'メガガブリアスZ', `ret=${ok} name=${p && p.name}`);
  check('T3b 特性ふゆう', E.sides.self.ability === 'ふゆう', `ability=${E.sides.self.ability}`);

  E.sides.opp = freshSide('カビゴン', ['じしん']);
  const jishin = moveByName('じしん');
  const dmg = E.calcDamage('opp', 'self', jishin);
  check('T3c ふゆうでじめん技が無効(koType=immune)', dmg && dmg.koType === 'immune' && dmg.max === 0,
    JSON.stringify(dmg));
}

// ================= T4: アブソル+アブソルナイトZ → メガアブソルZ・きれあじ =================
console.log('\n=== T4: メガアブソルZ (アブソルナイトZ)・きれあじ ===');
{
  resetEnv();
  E.sides.self = freshSide('アブソル', ['はたく']);
  E.sides.self.item = 'mega_stone_absol_z';
  const ok = E.megaEvolve('self');
  const p = E.sides.self.poke;
  check('T4a メガシンカ成功・メガアブソルZ', ok === true && p.name === 'メガアブソルZ', `ret=${ok} name=${p && p.name}`);
  check('T4b 特性きれあじ', E.sides.self.ability === 'きれあじ', `ability=${E.sides.self.ability}`);
}

// ================= T5: 汎用ストーン+ルカリオ = 従来どおり非Zメガ(退行なし) =================
console.log('\n=== T5: 汎用メガストーンは従来どおり非Zメガ(退行なし) ===');
{
  resetEnv();
  E.sides.self = freshSide('ルカリオ', ['はたく']);
  E.sides.self.item = 'mega_stone_any';
  E.sides.opp = freshSide('カビゴン', ['はたく']);
  const ok = E.megaEvolve('self');
  const p = E.sides.self.poke;
  check('T5 汎用ストーンは非Zの「メガルカリオ」になる(Zにならない)', ok === true && p.name === 'メガルカリオ', `name=${p && p.name}`);
}

// ================= T6: ねつこうかん(セグレイブ) =================
console.log('\n=== T6: ねつこうかん(セグレイブ)・ほのお技でこうげき+1・やけど無効 ===');
{
  resetEnv();
  E.sides.self = freshSide('リザードン', ['かえんほうしゃ']);
  E.sides.opp = freshSide('セグレイブ', ['じしん']);
  E.sides.self.selectedMoveIdx = 0;
  E.sides.opp.selectedMoveIdx = 0;
  const atkBefore = E.sides.opp.rank.atk || 0;
  E.runTurn();
  const atkAfter = E.sides.opp.rank.atk || 0;
  check('T6a ほのお技を受けてこうげき+1', atkAfter === atkBefore + 1, `before=${atkBefore} after=${atkAfter}`);
  check('T6b やけど状態にならない(免疫)', E.sides.opp.status !== 'burn', `status=${E.sides.opp.status}`);
}

console.log(`\n合計: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
