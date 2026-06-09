/* 全技を sim で1ターン試して「挙動」を機械観測する(安い)。LLM判定(ワークフロー)の一次データ。
 * 実行: node tools/_sim_probe.js            → 全技を review/_sim_probe_all.json に出力
 *       node tools/_sim_probe.js <技名>     → 1技だけ表示
 * 観測は phase を直接呼んで self の技を opp に当てた結果(必中・追加効果必発・乱数min に固定)。
 */
const fs = require('fs');
const path = require('path');
const { buildEngine, ROOT } = require('./_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

const E = buildEngine();
const P = data.POKEMON_LIST;
const byName = n => P.find(p => p.name === n);
const ATT = byName('カビゴン') || P[0];     // 攻撃役(高HPで自滅しにくい)
const DEF = byName('ハピナス') || byName('カビゴン') || P[1]; // 受け役(高HPで一撃ひんしになりにくい)

const snap = s => ({ hp: s.currentHp, status: s.status, rank: Object.assign({}, s.rank), flinched: !!s.flinched });
const rankDelta = (a, b) => { const d = {}; for (const k in b) if ((b[k] || 0) !== (a[k] || 0)) d[k] = (b[k] || 0); return d; };

function probe(move) {
  E.env.weather = 'none'; E.env.field = 'none'; E.env.trickRoom = false; E.env.doubleBattle = false;
  E.sides.self = E.makeSideState(); E.sides.self.poke = ATT; E.sides.self.moves = [move]; E.sides.self.selectedMoveIdx = 0;
  E.sides.opp = E.makeSideState(); E.sides.opp.poke = DEF; E.sides.opp.moves = [move]; E.sides.opp.selectedMoveIdx = 0;
  E.sides.self.currentHp = E.realStat(E.sides.self, 'hp');
  E.sides.opp.currentHp = E.realStat(E.sides.opp, 'hp');
  E.battleLog.length = 0;
  E.setRandom(() => 0); // 必中・追加効果必発・乱数最小
  const sb = snap(E.sides.self), ob = snap(E.sides.opp), wb = E.env.weather, fb = E.env.field;
  try {
    if (move.category === '変化') E.phaseApplyEffects('self', 'opp', move);
    else { const dr = E.phaseDealDamage('self', 'opp', move); if (dr && !dr.immune && !E.sides.opp.fainted) E.phaseApplyEffects('self', 'opp', move); }
  } catch (e) { return { error: String(e && e.message || e) }; }
  const sa = snap(E.sides.self), oa = snap(E.sides.opp);
  return {
    observed: {
      oppHpDelta: ob.hp - oa.hp,
      oppStatus: oa.status !== ob.status ? oa.status : null,
      oppFlinched: oa.flinched || null,
      oppRank: rankDelta(ob.rank, oa.rank),
      selfHpDelta: sb.hp - sa.hp,
      selfStatus: sa.status !== sb.status ? sa.status : null,
      selfRank: rankDelta(sb.rank, sa.rank),
      weather: E.env.weather !== wb ? E.env.weather : null,
      field: E.env.field !== fb ? E.env.field : null,
    },
    log: E.battleLog.map(e => `[${e.phase}] ${e.msg}`),
  };
}

function record(m) {
  const eff = (m.battle_data || {}).effects || [];
  return {
    name: m.name, category: m.category, type: m.type, power: m.power, accuracy: m.accuracy,
    priority: (m.battle_data || {}).priority || 0,
    legacy: m.description_legacy || '',
    effectKinds: [...new Set(eff.map(e => e.kind))],
    ...probe(m),
  };
}

const moves = Object.values(data.WAZA_MAP);
const arg = process.argv[2];
if (arg) {
  const m = moves.find(x => x.name === arg) || moves[0];
  console.log(JSON.stringify(record(m), null, 2));
} else {
  const all = moves.map(record);
  const out = path.join(ROOT, 'review', '_sim_probe_all.json');
  fs.writeFileSync(out, JSON.stringify(all, null, 1));
  console.log('観測:', all.length, '技 → review/_sim_probe_all.json');
  console.log('  エラー:', all.filter(r => r.error).length, '件 / 攻撃役=' + ATT.name + ' 受け役=' + DEF.name);
}
