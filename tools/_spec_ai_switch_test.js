// tools/_spec_ai_switch_test.js — AIの「相性による予防交代」仕様テスト
//
// 出典・意図(2026-07-29 阿部さん):
//   「相手の特性と自分の特性を見て、相手に弱点を突かれるなら交代を検討する。
//    裏に、その相手の技を半減・無効にできる子がいたら交代する。いなければ交代しない。
//    自分が効果抜群を持っていれば殴る。交代をうまく使うのが上級者。」
//
// 実装 = real_battle_simulator.html の aiChooseAction の C) ブロック + aiBenchTakes
// 特性による無効/半減は Champions権威(ヤックン/ch/)で裏取り済み:
//   ふゆう「じめんタイプの技を受けない」/ もらいび「ほのおタイプの技を受けるとダメージや効果はなくなり」
//   ちょすい・よびみず・かんそうはだ「みずタイプ〜無効化」/ そうしょく「くさタイプ〜無効化」
//   ひらいしん・でんきエンジン・ちくでん「でんきタイプ〜無効化」
//   あついしぼう「ほのお・こおりタイプの技を受けた時、ダメージが半減」/ たいねつ「ほのお〜半減」
//
// 実行: node tools/_spec_ai_switch_test.js
const path = require("path");
process.chdir(path.resolve(__dirname, ".."));
const ROOT = path.resolve(__dirname, "..");
const { buildEngine, mulberry32 } = require("./_sim_engine.js");
const data = require(path.join(ROOT, "pokechan_data.js"));
const E = buildEngine();
const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
const moveByName = n => data.WAZA_MAP[n] || Object.values(data.WAZA_MAP).find(m => m.name === n) || null;

function mk(pokeName, moveNames, ab) {
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  s.moves = (moveNames || []).map(moveByName).filter(Boolean);
  s.ability = ab || (s.poke && s.poke.ab1) || "";
  s.selectedMoveIdx = 0;
  s.currentHp = E.realStat(s, 'hp');
  s.pp = s.moves.map(m => (m && m.pp) || 10);
  return s;
}
function resetEnv() {
  E.env.magicRoom = false; E.env.weather = 'none'; E.env.weatherTurns = null;
  E.env.field = 'none'; E.env.fieldTurns = null; E.env.doubleBattle = false;
  E.env.trickRoom = false; E.env.trickRoomTurns = null; E.env.gravity = false;
  E.env.wonderRoom = false; if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
}
let pass = 0, fail = 0; const fails = [];
const check = (n, c, d) => { if (c) { pass++; console.log("  ✅ " + n); } else { fail++; fails.push(n + " → " + d); console.log("  ❌ " + n + "  → " + d); } };

console.log("=== AI 相性による予防交代(2026-07-29 阿部さん指示) ===");

// C1: 弱点を突かれる & 有効打なし & 後攻 & 受けられる控えがいる → 交代する
{
  resetEnv();
  // opp = リザードン(ほのお/ひこう)、相手(self)は いわタイプ技持ちで速い
  E.sides.opp = mk('リザードン', ['かえんほうしゃ']);
  E.sides.self = mk('カビゴン', ['いわなだれ']);
  E.sides.self.rank.spd = 6;                    // self を速くする = opp は後攻
  // opp の控えに「いわを半減以下で受けられる」子(カビゴン=ノーマルは等倍なので不可) → ラグラージ(みず/じめん)はいわ等倍
  //   いわ半減 = かくとう/じめん/はがね など → ルカリオ(かくとう/はがね)を置く
  E.sides.opp.bench = [mk('ルカリオ', ['はどうだん'])];
  E.sides.opp.aiSwitchedLast = false;
  E.setRandom(mulberry32(1));
  const act = E.aiChooseAction('opp');
  check("C1 弱点を突かれ有効打なし・後攻・受け役あり → 交代する", act.type === 'switch', `act=${JSON.stringify(act)}`);
}

// C2: 受けられる控えがいない → 交代しない(逃げ場が無いなら殴る)
{
  resetEnv();
  E.sides.opp = mk('リザードン', ['かえんほうしゃ']);
  E.sides.self = mk('カビゴン', ['いわなだれ']);
  E.sides.self.rank.spd = 6;
  E.sides.opp.bench = [mk('ピジョット', ['エアスラッシュ'])];   // ひこう=いわ2倍で受けられない
  E.sides.opp.aiSwitchedLast = false;
  E.setRandom(mulberry32(1));
  const act = E.aiChooseAction('opp');
  check("C2 受けられる控えがいない → 交代しない", act.type === 'move', `act=${JSON.stringify(act)}`);
}

// C3: ★特性で無効にできる控えがいる → その子へ交代する(ふゆう=じめん無効)
//   ★テスト設定の注意: 相手が「じめん無効」のポケモン(ひこう等)だと脅威にならないので、
//     じめんが等倍以上で通る相手(ライチュウ=でんき)を置くこと。2026-07-29に一度これで誤検出した。
{
  resetEnv();
  E.sides.opp = mk('ライチュウ', ['10まんボルト']);        // でんき: じしん2倍で刺さる / でんき技はノーマルに等倍
  E.sides.self = mk('カビゴン', ['じしん']);
  E.sides.self.rank.spd = 6;                                // self を速く = opp は後攻
  const other = mk('カイリキー', ['インファイト']);          // じめん等倍(受けられない)
  const flyer = mk('ゲンガー', ['シャドーボール'], 'ふゆう'); // ★ふゆう=じめん無効
  E.sides.opp.bench = [other, flyer];
  E.sides.opp.aiSwitchedLast = false;
  E.setRandom(mulberry32(1));
  const act = E.aiChooseAction('opp');
  check("C3 ★特性(ふゆう)でじめんを無効にできる控えへ交代する", act.type === 'switch' && act.index === 1, `act=${JSON.stringify(act)}`);
}

// C4: 自分が効果抜群を持っている → 交代せず殴る
//   ★テスト設定の注意(2026-07-29に2回間違えた): 脅威が「今ターン倒される」規模だと**既存のB)受け交代**が
//     先に発動してしまう。C)を試すには「倒されはしないが半分以上減る」規模にすること。
//     判定は act ではなく **_aiReason** を見ると、どのブロックが動いたか分かる。
{
  resetEnv();
  E.sides.opp = mk('カビゴン', ['のしかかり', 'インファイト']);  // ★インファイト=かくとう→ノーマルに2倍(有効打あり)
  E.sides.self = mk('カイリキー', ['インファイト']);              // かくとう→ノーマル(カビゴン)に2倍=脅威
  E.sides.self.rank.spd = 6;                                      // self を速く = opp は後攻
  E.sides.opp.bench = [mk('ゲンガー', ['シャドーボール'], 'ふゆう')];  // かくとう半減(ゴースト=かくとう無効)
  E.sides.opp.aiSwitchedLast = false;
  E.setRandom(mulberry32(1));
  const act = E.aiChooseAction('opp');
  check("C4 自分が効果抜群を持っている → C)では交代しない",
        !(E.sides.opp._aiReason === 'switch_C_相性で退く'), `act=${JSON.stringify(act)} reason=${E.sides.opp._aiReason}`);
}

// C7: ★設置物(ステルスロック)で交代先が死ぬ → 交代しない(無駄な交代をしない)
//   2026-07-29 阿部さん:「まきびしやステルスロックが撒かれてると、無駄に後退すると交代先が死ぬ」
{
  resetEnv();
  E.sides.opp = mk('リザードン', ['かえんほうしゃ']);
  E.sides.self = mk('カビゴン', ['いわなだれ']);
  E.sides.self.rank.spd = 6;
  const bench = mk('ルカリオ', ['はどうだん']);
  bench.currentHp = 3;                     // ★瀕死(ルカリオはいわ0.25倍=設置ダメージ4 → 出た瞬間に倒れる)
  E.sides.opp.bench = [bench];
  E.sides.opp.stealthRock = true;          // ★opp側にステルスロックが撒かれている
  E.sides.opp.aiSwitchedLast = false;
  E.setRandom(mulberry32(1));
  const act = E.aiChooseAction('opp');
  check("C7 ★ステルスロックで交代先が死ぬ → 交代しない(無駄な交代をしない)", act.type === 'move',
        `act=${JSON.stringify(act)} reason=${E.sides.opp._aiReason} / 設置ダメージ見積=${E.aiHazardCost ? E.aiHazardCost(E.sides.opp, bench) : '?'}`);
  E.sides.opp.stealthRock = false;
}

// C5: 先手を取れる(自分が速い) → 交代せず殴る(手数を捨てない)
{
  resetEnv();
  E.sides.opp = mk('リザードン', ['かえんほうしゃ']);
  E.sides.self = mk('カビゴン', ['いわなだれ']);
  E.sides.opp.rank.spd = 6;                     // opp を速くする
  E.sides.opp.bench = [mk('ルカリオ', ['はどうだん'])];
  E.sides.opp.aiSwitchedLast = false;
  E.setRandom(mulberry32(1));
  const act = E.aiChooseAction('opp');
  check("C5 先手を取れるなら交代しない(手数を捨てない)", act.type === 'move', `act=${JSON.stringify(act)}`);
}

// C6: 直前に交代したばかり → 連続では交代しない(往復防止)
{
  resetEnv();
  E.sides.opp = mk('リザードン', ['かえんほうしゃ']);
  E.sides.self = mk('カビゴン', ['いわなだれ']);
  E.sides.self.rank.spd = 6;
  E.sides.opp.bench = [mk('ルカリオ', ['はどうだん'])];
  E.sides.opp.aiSwitchedLast = true;            // 直前に交代済み
  E.setRandom(mulberry32(1));
  const act = E.aiChooseAction('opp');
  check("C6 連続では交代しない(往復防止)", act.type === 'move', `act=${JSON.stringify(act)}`);
}

console.log(`\n============================================================`);
console.log(`AI交代ロジック仕様テスト結果: pass=${pass} fail=${fail}`);
if (fails.length) { console.log("失敗:"); fails.forEach(f => console.log("  - " + f)); }
process.exit(fail ? 1 : 0);
