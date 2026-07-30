// tools/_ssot_guard_test.js — ★SSOT(データは一つ)を機械で守る番人
//
// なぜこれが要るか: 「データは一本化」と文章で決めていたのに、セッションをまたぐうちに守られず
//   Champions版と全国版が別物になった(2026-07-28 発覚)。**文章のルールは忘れられるが、落ちるテストは忘れられない。**
//   → 破ったら赤くなる形にして、忘れても検出されるようにする。
//
// 検査するもの(不変条件):
//   G1 生成物にしか無い資産が増えていないか(=再ビルドで静かに消える候補)
//   G2 Championsのポケモンが実際に持つ特性に、説明が用意されているか
//   G3 名前の切り詰め・表記ゆれ(Champions版と全国版で名前が食い違う)が増えていないか
//   G4 同じ機構(特性)の説明文が2つのDBで食い違っていないか
//
// 判定方法: 現状の「既知の壊れ具合」を reference/_ssot_guard_baseline.json に記録し、
//   **それより悪化したら失敗**する。直したらベースラインを下げていく(= 進捗計でもある)。
//   ★ベースラインを上げて通す行為は禁止(それは壊したまま蓋をすること)。
//
// 実行: node tools/_ssot_guard_test.js          (悪化していたら exit 1)
//       node tools/_ssot_guard_test.js --update (直した後にベースラインを下げる)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(ROOT, 'reference/_ssot_guard_baseline.json');

const C = require(path.join(ROOT, 'pokechan_data.js'));
const A = require(path.join(ROOT, 'pokechan_data_all.js'));
const master = JSON.parse(fs.readFileSync(path.join(ROOT, 'reference/master_abilities.json'), 'utf8'));

const findings = {};

// ── G1: 生成物にしか無い資産(= SSOTを再生成すると消える) ─────────────
{
  const flagTrue = new Set(master.filter(a => a.champions && a.champions.in).map(a => a.names && a.names.ja));
  const lost = Object.keys(C.ABILITY_DESC).filter(k => !flagTrue.has(k));
  findings.G1_lost_on_rebuild = { count: lost.length, items: lost.sort() };
}

// ── G2: Championsのポケモンが持つ特性に説明があるか ────────────────
{
  const used = new Set();
  C.POKEMON_LIST.forEach(p => ['ab1', 'ab2', 'ab3'].forEach(k => { if (p[k]) used.add(p[k]); }));
  const noDesc = [...used].filter(n => !C.ABILITY_DESC[n]);
  findings.G2_ability_without_desc = { count: noDesc.length, items: noDesc.sort() };
}

// ── G3: 名前の食い違い(切り詰め・表記ゆれ) ───────────────────────
//   ★フラエッテ(えいえん) vs フラエッテ(えいえんのはな) のような「片方が短い」型だけを拾う
//   (Champions限定のメガ/地方フォルムは全国版に無くて当然なので、"前方一致で片方が短い" ものに限定)
{
  const nat = A.POKEMON_LIST.map(p => p.name);
  const natSet = new Set(nat);
  const truncated = [];
  C.POKEMON_LIST.forEach(p => {
    if (natSet.has(p.name)) return;
    const longer = nat.find(n => n !== p.name && n.startsWith(p.name.replace(/\)$/, '')));
    if (longer) truncated.push({ champions: p.name, national: longer });
  });
  findings.G3_truncated_names = { count: truncated.length, items: truncated };
}

// ── G4: 同じ特性の説明文が2つのDBで違う ──────────────────────────
{
  const diff = Object.keys(C.ABILITY_DESC)
    .filter(k => A.ABILITY_DESC[k] && A.ABILITY_DESC[k] !== C.ABILITY_DESC[k]);
  findings.G4_desc_mismatch = { count: diff.length, items: diff.sort() };
}

// ── 判定 ────────────────────────────────────────────────────────
const keys = Object.keys(findings);
let base = {};
try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) { /* 初回 */ }

if (process.argv.includes('--update')) {
  const out = {};
  keys.forEach(k => { out[k] = findings[k].count; });
  out._note = 'SSOT番人のベースライン(既知の壊れ具合)。★下げるのは可・上げて通すのは禁止。直したら --update で下げる。';
  out._updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(BASELINE, JSON.stringify(out, null, 1) + '\n');
  console.log('ベースラインを更新しました:', JSON.stringify(out));
  process.exit(0);
}

console.log('=== SSOT番人(データは一つ・破ったら落ちる) ===');
let worse = 0;
keys.forEach(k => {
  const now = findings[k].count;
  const was = (base[k] === undefined) ? now : base[k];
  const mark = now > was ? '❌悪化' : (now < was ? '✅改善' : '　 現状維持');
  console.log(`${mark}  ${k}: ${now} 件 (基準 ${was})`);
  if (findings[k].items && findings[k].items.length) {
    const s = JSON.stringify(findings[k].items);
    console.log('      ' + (s.length > 300 ? s.slice(0, 300) + '…' : s));
  }
  if (now > was) worse++;
});

fs.writeFileSync(path.join(ROOT, 'reference/_ssot_guard_report.json'), JSON.stringify(findings, null, 1) + '\n');

if (Object.keys(base).length === 0) {
  console.log('\n初回のため基準がありません。`node tools/_ssot_guard_test.js --update` で現状を基準として記録してください。');
  process.exit(0);
}
if (worse) {
  console.log(`\n❌ ${worse}項目が悪化しました。SSOT(データは一つ)が壊れています。`);
  console.log('   ★ベースラインを上げて通してはいけません(壊したまま蓋をすることになります)。');
  process.exit(1);
}
console.log('\n✅ 悪化なし。');
process.exit(0);
