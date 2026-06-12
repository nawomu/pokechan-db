/* ダメージ照合: うちのsim(calcDamage) vs @smogon/calc(Pokémon Showdownのダメージ計算機)
 * 目的: 全ダメージ技の min/max を機械照合し、ズレた技だけを洗い出す(羅針盤: 権威ソース照合の自動化)。
 * 条件合わせ: Lv50 / IV31 / EV(P)=0 / 補正なし性格 / 持ち物・特性・天候なし / シングル
 *   → ポケチャン式P=0 と 本家IV31・EV0 は実数値が完全一致する(例: フシギバナHP155)
 * 既定の組: フシギバナ vs フシギバナ(Venusaur, 等倍〜半減が混ざる現実的な受け)
 * 注意: @smogon/calcは本家(SV)準拠。Championsで威力が変わった技は bp-mismatch として
 *   別バケツに分類する(エンジンのバグではなくデータ系統の差=要権威確認)。
 * 実行: node tools/_calc_crosscheck.js  → review/_calc_crosscheck.json + コンソール要約
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { buildEngine } = require('./_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));
const names = require(path.join(ROOT, 'review', '_move_names_ja_en.json'));
const { calculate, Generations, Pokemon, Move } = require('@smogon/calc');

const gen = Generations.get(9);
const E = buildEngine();
E.env.weather = 'none'; E.env.field = 'none'; E.env.doubleBattle = false; E.env.trickRoom = false;

const POKE = 'フシギバナ', POKE_EN = 'Venusaur';
const mkOur = () => {
  const s = E.makeSideState();
  s.poke = data.POKEMON_LIST.find(p => p.name === POKE);
  s.currentHp = E.realStat(s, 'hp');   // HP割合参照技(ハードプレス等)のため満タンをセット
  return s;
};
E.sides.self = mkOur();
E.sides.opp = mkOur();
// @smogon/calc の Payback(しっぺがえし)は「相手が先に行動済み」前提(bp100)で計算する → 同条件に合わせる
E.sides.opp.movedThisTurn = true;
const mkCalc = () => new Pokemon(gen, POKE_EN, {
  level: 50, nature: 'Serious',
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, evs: {},
});

const buckets = { match: [], diff: [], champions_verified: [], bp_mismatch: [], type_mismatch: [], charge_pending: [], ours_null: [], calc_error: [], immune_both: [], skipped_status: [] };

// Championsで公式に威力/タイプが変更された技(2026-06-12 ポケモンWiki各技ページで全件権威確認済み)。
// calc(本家=メインシリーズ値)とズレるのは正しい → champions_verified に分類して「要確認」から外す。
// 例: かげぬいのWiki表記「威力 80 (SVまで) →90 (Champions)」
const CHAMPIONS_VERIFIED = {
  boonrasshu:       { bp: 30,  mainline: 25,  note: 'ボーンラッシュ 25→30' },
  naitobaasuto:     { bp: 90,  mainline: 85,  note: 'ナイトバースト 85→90' },
  kagenui:          { bp: 90,  mainline: 80,  note: 'かげぬい 80→90' },
  toropikarukikku:  { bp: 85,  mainline: 70,  note: 'トロピカルキック 70→85' },
  kuchibashikyanon: { bp: 120, mainline: 100, note: 'くちばしキャノン 100→120' },
  deaigashira:      { bp: 100, mainline: 90,  note: 'であいがしら 90→100' },
  honoonomuchi:     { bp: 90,  mainline: 80,  note: 'ほのおのムチ 80→90' },
  ringosan:         { bp: 90,  mainline: 80,  note: 'りんごさん 80→90' },
  gnochikara:       { bp: 90,  mainline: 80,  note: 'Gのちから 80→90' },
  bariaarasshu:     { bp: 90,  mainline: 70,  note: 'バリアーラッシュ 70→90' },
  "hyouzan'oroshi": { bp: 120, mainline: 100, note: 'ひょうざんおろし 100→120' },
  hyakkiyakou:      { bp: 65,  mainline: 60,  note: 'ひゃっきやこう 60→65' },
  torabasami:       { type: 'はがね', mainline_type: 'くさ', note: 'トラバサミ くさ→はがね' },
};

// 技タイプの英日対応(type_mismatch分類用: トラバサミ=Championsでタイプ変更が権威確認済みの類)
const TYPE_EN2JA = {
  Normal: 'ノーマル', Fire: 'ほのお', Water: 'みず', Electric: 'でんき', Grass: 'くさ', Ice: 'こおり',
  Fighting: 'かくとう', Poison: 'どく', Ground: 'じめん', Flying: 'ひこう', Psychic: 'エスパー', Bug: 'むし',
  Rock: 'いわ', Ghost: 'ゴースト', Dragon: 'ドラゴン', Dark: 'あく', Steel: 'はがね', Fairy: 'フェアリー',
};

for (const [key, mv] of Object.entries(data.WAZA_MAP)) {
  if (mv.category === '変化') { buckets.skipped_status.push(mv.name); continue; }
  const en = names.map[mv.name];
  const rec = { key, name: mv.name, en, type: mv.type, category: mv.category, power: mv.power };

  // うちのsim
  let ours = null;
  try { ours = E.calcDamage('self', 'opp', mv); } catch (e) { rec.our_error = String(e); }

  // @smogon/calc — 比較条件をうちのcalcDamage(1発分を返す)に合わせる:
  //   連続攻撃: calcのrange()は合計なので hits:1 で1発分に正規化
  //   常時急所(must_crit): calcは自動で急所込み。うちが急所未反映ならdiffに出る=正直に実装課題として残す
  //     (rec.must_crit タグで分類だけできるようにする)
  const bd = mv.battle_data || {};
  const isMulti = (bd.effects || []).some(e => e.kind === '連続攻撃');
  let calcRange = null, calcMove = null;
  try {
    const opts = {};
    if (isMulti) { opts.hits = 1; rec.multihit = true; }
    calcMove = new Move(gen, en, opts);
    if (bd.must_crit) rec.must_crit = true;
    const r = calculate(gen, mkCalc(), mkCalc(), calcMove);
    calcRange = r.range();   // [min, max]
  } catch (e) {
    rec.calc_error = String(e && e.message || e);
    buckets.calc_error.push(rec);
    continue;
  }
  rec.calc = calcRange;
  rec.calc_bp = calcMove.bp;

  if (ours && ours.immune && calcRange[0] === 0 && calcRange[1] === 0) { buckets.immune_both.push(rec); continue; }
  if (!ours || ours.immune) {
    rec.ours = ours ? 'immune' : null;
    if (calcRange[0] === 0 && calcRange[1] === 0) { buckets.immune_both.push(rec); continue; }
    // 固定ダメージ技(ちきゅうなげ等)は calcDamage でなく phaseDealDamage が処理する → 実測(HP差分)で照合
    if (!ours && (bd.effects || []).some(e => e.kind === '固定ダメージ')) {
      const before = E.sides.opp.currentHp;
      const res = E.phaseDealDamage('self', 'opp', mv);
      const delta = before - E.sides.opp.currentHp;
      E.sides.opp.currentHp = before; E.sides.opp.fainted = false; // 状態を戻す
      if (res && delta > 0) {
        rec.ours = [delta, delta];
        if (delta === calcRange[0] && delta === calcRange[1]) { buckets.match.push(rec); continue; }
        buckets.diff.push(rec); continue;
      }
    }
    buckets.ours_null.push(rec); continue;
  }
  rec.ours = [ours.min, ours.max];

  // 固定回数連続技(ダブルアタック等)は calc が hits:1 を無視して合計を返す → うち(1発分)×hits で比較
  let ourCmp = [ours.min, ours.max];
  if (rec.multihit && calcMove.hits > 1) {
    ourCmp = [ours.min * calcMove.hits, ours.max * calcMove.hits];
    rec.normalized = `ours×${calcMove.hits}`;
  }
  if (ourCmp[0] === calcRange[0] && ourCmp[1] === calcRange[1]) { buckets.match.push(rec); continue; }
  // 威力/タイプのデータ自体が本家と違う → 権威確認済み(Champions変更)なら champions_verified、
  // 未確認の新規ズレだけを bp_mismatch / type_mismatch として騒ぐ
  const ourBp = (mv.power == null || mv.power === '—') ? 0 : Number(mv.power);
  const cv = CHAMPIONS_VERIFIED[rec.key];
  if (ourBp && calcMove.bp && ourBp !== calcMove.bp) {
    if (cv && cv.bp === ourBp && cv.mainline === calcMove.bp){ rec.verified = cv.note; buckets.champions_verified.push(rec); }
    else buckets.bp_mismatch.push(rec);
    continue;
  }
  if (calcMove.type && TYPE_EN2JA[calcMove.type] && TYPE_EN2JA[calcMove.type] !== mv.type) {
    rec.calc_type = TYPE_EN2JA[calcMove.type];
    if (cv && cv.type === mv.type && cv.mainline_type === rec.calc_type){ rec.verified = cv.note; buckets.champions_verified.push(rec); }
    else buckets.type_mismatch.push(rec);
    continue;
  }
  // 溜め技の能力上昇(メテオビーム/エレクトロビーム=溜めターンにとくこう+1): calcは+1込みで返す
  // → うちも溜めターンのランク上昇を適用してから再計算して比較(sim実装済み: startChargeIfNeeded)
  const chargeBoosts = (bd.effects || []).filter(e =>
    e.kind === '能力ランク変化' && (e.timing === 'charge_turn' || e.on_charge_turn));
  if (chargeBoosts.length) {
    const STATMAP = { attack: 'atk', defense: 'def', special_attack: 'spatk', special_defense: 'spdef', speed: 'spd' };
    const saved = { ...E.sides.self.rank };
    for (const e of chargeBoosts) {
      const keys = Array.isArray(e.stats) ? e.stats : (e.stat ? [e.stat] : []);
      for (const k of keys) { const rk = STATMAP[k] || k; if (E.sides.self.rank[rk] !== undefined) E.sides.self.rank[rk] += (e.stages || 0); }
    }
    const boosted = E.calcDamage('self', 'opp', mv);
    E.sides.self.rank = saved;
    if (boosted && !boosted.immune) {
      rec.ours = [boosted.min, boosted.max];
      rec.charge_boost_applied = true;
      if (boosted.min === calcRange[0] && boosted.max === calcRange[1]) { buckets.match.push(rec); continue; }
    }
    buckets.charge_pending.push(rec); continue;
  }
  buckets.diff.push(rec);
}

const out = {
  generated: '2026-06-10', matchup: `${POKE} vs ${POKE} (Lv50/IV31/P0/補正なし性格/道具特性なし)`,
  calc_version: require('@smogon/calc/package.json').version, gen: 9,
  counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
  ...buckets,
};
fs.writeFileSync(path.join(ROOT, 'review', '_calc_crosscheck.json'), JSON.stringify(out, null, 1));

console.log('=== @smogon/calc 照合結果(', out.matchup, ') ===');
for (const [k, v] of Object.entries(out.counts)) console.log(`  ${k}: ${v}`);
console.log('\n--- diff(同威力なのに乱数幅がズレ=エンジン側の疑い) ---');
buckets.diff.forEach(r => console.log(`  ${r.name} (${r.type}/${r.category} bp${r.power}) ours=${JSON.stringify(r.ours)} calc=${JSON.stringify(r.calc)}`));
console.log('\n--- bp_mismatch(威力データが本家と違う=未確認の新規ズレ。出たら権威確認すること) ---');
buckets.bp_mismatch.forEach(r => console.log(`  ${r.name} ours_bp=${r.power} calc_bp=${r.calc_bp} ours=${JSON.stringify(r.ours)} calc=${JSON.stringify(r.calc)}`));
console.log('\n--- type_mismatch(タイプデータが本家と違う=未確認の新規ズレ。出たら権威確認すること) ---');
buckets.type_mismatch.forEach(r => console.log(`  ${r.name} ours=${r.type} calc=${r.calc_type}`));
console.log('\n--- champions_verified(Champions公式変更と権威確認済み=正常) ---');
buckets.champions_verified.forEach(r => console.log(`  ${r.verified}`));
console.log('\n--- charge_pending(溜め技: 溜めターン未実装のため保留・隠さず列挙) ---');
buckets.charge_pending.forEach(r => console.log(`  ${r.name} ours=${JSON.stringify(r.ours)} calc=${JSON.stringify(r.calc)}`));
console.log('\n→ 詳細: review/_calc_crosscheck.json');
