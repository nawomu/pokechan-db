#!/usr/bin/env node
// 機械漏れ2件の修正(2026-06-12 宿題): pokechan_data.js は直接編集禁止 → このスクリプトで dry-run → --write
// ①うちおとす: 状態付与のvalueに英語文が2箇所 → 正カノン形(半無敵命中 hits_state:["空中"] / 状態付与 value:"うちおとす")へ
// ②ドラゴンエール: 能力ランク変化 stat:"critical_hit_ratio"(英語キー)2箇所 → kind:"急所率上昇"(きあいだめ等と同じ正カノン形)へ
// 出典: ポケモンWiki「うちおとす」(半無敵の空中に命中・うちおとす状態=接地) / 「ドラゴンエール」(急所ランク+1、ドラゴンは+2)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'pokechan_data.js');
const WRITE = process.argv.includes('--write');
let src = fs.readFileSync(FILE, 'utf8');

const fixes = [
  {
    name: 'うちおとす: 半無敵中断(英語文) → 半無敵命中',
    re: /\{"kind":\s*"状態付与",\s*"target":\s*"opponent",\s*"phase":\s*"on_use",\s*"value":\s*"interrupt semi-invulnerable airborne state \(そらをとぶ \/ とびはねる \/ フリーフォール\); hits the airborne target and knocks it down"\}/g,
    to: '{"kind": "半無敵命中", "target": "opponent", "phase": "on_use", "hits_state": ["空中"], "note": "そらをとぶ/とびはねる/フリーフォールの最中にも命中して、地面に撃ち落とす"}',
    expect: 1,
  },
  {
    name: 'うちおとす: 接地(英語注釈) → value:うちおとす+日本語note',
    re: /"value":\s*"接地\(Ground moves can hit; Levitate ability and Flying-type ground immunity ignored\)"/g,
    to: '"value": "うちおとす", "note": "地面に撃ち落とされて接地する(じめん技が当たるようになり、ふゆう/ひこうタイプのじめん無効もなくなる)"',
    expect: 1,
  },
  {
    name: 'ドラゴンエール: critical_hit_ratio(+1) → 急所率上昇',
    re: /\{"kind":\s*"能力ランク変化",\s*"target":\s*"ally",\s*"stat":\s*"critical_hit_ratio",\s*"stages":\s*1,/g,
    to: '{"kind": "急所率上昇", "target": "ally", "stages": 1,',
    expect: 1,
  },
  {
    name: 'ドラゴンエール: critical_hit_ratio(+2) → 急所率上昇',
    re: /\{"kind":\s*"能力ランク変化",\s*"target":\s*"ally",\s*"stat":\s*"critical_hit_ratio",\s*"stages":\s*2,/g,
    to: '{"kind": "急所率上昇", "target": "ally", "stages": 2,',
    expect: 1,
  },
];

let ok = true;
for (const f of fixes) {
  const n = (src.match(f.re) || []).length;
  const mark = n === f.expect ? '✅' : '❌';
  if (n !== f.expect) ok = false;
  console.log(`${mark} ${f.name}: ${n}件 (期待${f.expect})`);
  if (n === f.expect) src = src.replace(f.re, f.to);
}
if (!ok) { console.error('件数不一致 — 中止'); process.exit(1); }

// 構文チェック(置換後のJSが壊れていないか)
try { new Function(src); console.log('✅ 置換後の構文OK'); }
catch (e) { console.error('❌ 置換後にSyntaxError:', e.message); process.exit(1); }

if (WRITE) { fs.writeFileSync(FILE, src); console.log('WROTE pokechan_data.js'); }
else console.log('(dry-run。書き込みは --write)');
