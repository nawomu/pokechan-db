// tools/_spec_champions_rules_test.js — Champions正典化(2026-07-28)の3件の権威裏取りテスト
// 出典(ローカル権威コーパス):
//   A. reference/_authority_corpus/rules/まひ.json 説明文
//      「Champions 12.5%の確率で技が使えない。素早さが1/2になる。」(第七世代-SVは25%/1/2。すばやさ補正はSVと同じ1/2のまま)
//   B. reference/_authority_corpus/rules/ねむり.json 説明文/ターン経過節
//      「Championsではカウント2になる確率が1/3、カウント3になる確率が2/3となる」
//      「ねむるによってねむり状態になったときは、カウントは3で固定される」
//   C. reference/_authority_corpus/moves/{シャドークロー,ドラゴンクロー,ブレイククロー,フェイタルクロー}.json 技の仕様節
//      「Championsでは切る技の1つ。特性きれあじのポケモンが使うと威力が1.5倍になる。」
//      (きれあじ.json の効果表はSV時点の26技リストで、この4技は含まれない=Champions固有の追加)
// 実行: node tools/_spec_champions_rules_test.js
const path = require("path");
process.chdir(path.resolve(__dirname, ".."));
const ROOT = path.resolve(__dirname, "..");
const { buildEngine, mulberry32 } = require("./_sim_engine.js");
const data = require(path.join(ROOT, "pokechan_data.js"));
const E = buildEngine();
const moveByName = n => Object.values(data.WAZA_MAP).find(m => m.name === n);
function freshSide(pokeName, moveKey, ab1) {
  const s = E.makeSideState();
  let p = data.POKEMON_LIST.find(x => x.name === pokeName);
  if (ab1) p = Object.assign({}, p, { ab1, ab2: "", ab3: "" });
  s.poke = p; s.moves = moveKey ? [data.WAZA_MAP[moveKey]] : []; s.selectedMoveIdx = 0;
  s.ability = ab1 || (p && p.ab1) || "";
  return s;
}
let pass = 0, fail = 0; const fails = [];
function check(n, c, d) { if (c) { pass++; console.log("  ✅ " + n); } else { fail++; fails.push(n + " → " + d); console.log("  ❌ " + n + "  → " + d); } }

// =========================================================================
// A. まひの行動不能率 = Champions 12.5%(旧25%ではない)。すばやさ補正1/2は不変。
// =========================================================================
console.log("=== A. まひ 行動不能率(Champions 12.5%) ===");
{
  const atk = freshSide('カビゴン', 'hataku', null);
  const def = freshSide('カビゴン', null, null);
  E.sides.self = atk; E.sides.opp = def;
  E.setRandom(mulberry32(20260728));
  const fullHpAtk = E.realStat(atk, 'hp');
  const fullHpDef = E.realStat(def, 'hp');
  const N = 6000;
  let failedCount = 0;
  for (let i = 0; i < N; i++) {
    atk.status = 'paralysis'; atk.currentHp = fullHpAtk; atk.fainted = false;
    atk.mustRecharge = false; atk.charging = null; atk.rampage = null; atk.encore = null;
    atk.choiceLock = null; atk.attracted = false; atk.sleepTurns = null;
    def.currentHp = fullHpDef; def.fainted = false; def.status = 'none';
    E.runSingleAttack('self', 0);
    if (def.currentHp >= fullHpDef) failedCount++;   // ダメージが入らなかった=まひで動けなかった
  }
  const rate = failedCount / N;
  console.log(`  試行=${N} 行動不能=${failedCount} 実測率=${(rate * 100).toFixed(2)}%`);
  // 二項分布 p=0.125, n=6000 の標準偏差 ≈ sqrt(6000*0.125*0.875) ≈ 25.6 → ±5σ=128 を許容(誤差率±2.1pt)
  check("A1 まひ行動不能率はChampions12.5%に一致(25%ではない)", Math.abs(rate - 0.125) < 0.03, `rate=${rate}`);
  check("A2 25%(旧SV仕様)からは明確に乖離", Math.abs(rate - 0.25) > 0.05, `rate=${rate}`);
}

// =========================================================================
// B. ねむりターン数 = Champions 2〜3(2が1/3・3が2/3)。ねむる(技)は固定3。
// =========================================================================
console.log("=== B. ねむり ターン数(Champions 2〜3・重み1:2) ===");
{
  const atk = freshSide('カビゴン', null, null);
  const def = freshSide('カビゴン', null, null);
  E.sides.self = atk; E.sides.opp = def;
  const sleepPowder = moveByName('ねむりごな');
  E.setRandom(mulberry32(729));
  const N = 9000;
  let c2 = 0, c3 = 0, cOther = 0;
  for (let i = 0; i < N; i++) {
    def.status = 'none'; def.sleepTurns = null; def.fainted = false;
    E.phaseApplyEffects('self', 'opp', sleepPowder);
    if (def.status !== 'sleep') { cOther++; continue; }
    if (def.sleepTurns === 2) c2++;
    else if (def.sleepTurns === 3) c3++;
    else cOther++;
  }
  const total = c2 + c3 + cOther;
  console.log(`  試行=${N} count2=${c2} count3=${c3} その他=${cOther}`);
  check("B1 4以上は出ない(旧2〜4等確率の名残なし)", cOther === 0, `other=${cOther}`);
  const r2 = c2 / (c2 + c3), r3 = c3 / (c2 + c3);
  console.log(`  比率: count2=${(r2 * 100).toFixed(2)}%(期待33.3%) count3=${(r3 * 100).toFixed(2)}%(期待66.7%)`);
  check("B2 カウント2の出現率が1/3に一致", Math.abs(r2 - (1 / 3)) < 0.03, `r2=${r2}`);
  check("B3 カウント3の出現率が2/3に一致", Math.abs(r3 - (2 / 3)) < 0.03, `r3=${r3}`);

  // ねむる(技)は常にduration+1=3固定(乱数によらない)
  const restMove = moveByName('ねむる');
  let restAlways3 = true;
  E.setRandom(mulberry32(1)); // 別seedでも固定であることを確認
  for (let i = 0; i < 50; i++) {
    atk.status = 'none'; atk.sleepTurns = null; atk.currentHp = 1; atk.fainted = false;
    E.phaseApplyEffects('self', 'opp', restMove);
    if (atk.sleepTurns !== 3) restAlways3 = false;
  }
  check("B4 ねむる(技)由来のsleepTurnsは常に3固定", restAlways3, "restAlways3=" + restAlways3);
}

// =========================================================================
// C. 「切る技」flags — シャドークロー/ドラゴンクロー/ブレイククロー/フェイタルクロー に slicing/slash が付いている
//    (Champions固有=SVでは切る技に含まれないが、Championsの技個別ページ「技の仕様」節で明記)
// =========================================================================
console.log("=== C. 「切る技」flags(Champions固有4技) ===");
{
  const CLAW_MOVES = ['シャドークロー', 'ドラゴンクロー', 'ブレイククロー', 'フェイタルクロー'];
  CLAW_MOVES.forEach(n => {
    const m = moveByName(n);
    const has = !!(m && m.flags && (m.flags.slicing || m.flags.slash));
    check(`C-flags ${n} は flags.slicing/slash を持つ`, has, JSON.stringify(m && m.flags));
  });

  // きれあじの効果(×1.5)が実際にダメージへ反映されるか(シャドークロー vs 通常特性)
  const withAbility = freshSide('カビゴン', 'shadookuroo', 'きれあじ');
  const without = freshSide('カビゴン', 'shadookuroo', null);
  const def1 = freshSide('カビゴン', null, null);
  const mx = r => r && (r.max != null ? r.max : r.variations[r.variations.length - 1]);

  E.sides.self = withAbility; E.sides.opp = def1; E.setRandom(mulberry32(5));
  const rWith = E.calcDamage('self', 'opp', moveByName('シャドークロー'));
  E.sides.self = without; E.sides.opp = def1; E.setRandom(mulberry32(5));
  const rWithout = E.calcDamage('self', 'opp', moveByName('シャドークロー'));
  check("C-dmg きれあじでシャドークローのダメージが約1.5倍になる",
    mx(rWith) >= Math.floor(mx(rWithout) * 1.4) && mx(rWith) <= Math.ceil(mx(rWithout) * 1.6),
    `with=${mx(rWith)} without=${mx(rWithout)}`);

  // 対照: 切る技でない技(はたく)にはきれあじが乗らない
  const withAbility2 = freshSide('カビゴン', 'hataku', 'きれあじ');
  const without2 = freshSide('カビゴン', 'hataku', null);
  E.sides.self = withAbility2; E.sides.opp = def1; E.setRandom(mulberry32(5));
  const rWith2 = E.calcDamage('self', 'opp', moveByName('はたく'));
  E.sides.self = without2; E.sides.opp = def1; E.setRandom(mulberry32(5));
  const rWithout2 = E.calcDamage('self', 'opp', moveByName('はたく'));
  check("C-neg 非「切る技」(はたく)にはきれあじが乗らない(ダメージ同じ)", mx(rWith2) === mx(rWithout2),
    `with=${mx(rWith2)} without=${mx(rWithout2)}`);
}

console.log(`\n結果: pass=${pass} fail=${fail}`);
if (fail) { console.log("fails:", fails); process.exit(1); }
