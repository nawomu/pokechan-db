// ワークフロー出力(build-effects)を moves_battle_data_fix.json に反映し、ビルド+compose穴チェック。
// 使い方: node tools/_apply_built_effects.js <task_output_path>
const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('need task output path'); process.exit(1); }
const env = JSON.parse(fs.readFileSync(path, 'utf8'));
const results = (env.result && env.result.results) || env.results || [];

const fix = JSON.parse(fs.readFileSync('./reference/moves_battle_data_fix.json', 'utf8'));
let flags = {}; try { flags = require('../reference/_move_flags.json'); } catch (e) {}

let applied = 0, lowConf = [];
for (const r of results) {
  if (!r || !r.slug) continue;
  fix[r.slug] = { crit_stage: 0, must_crit: false, crit_changes: [], effects: r.effects || [] };
  if (r.flags && Object.keys(r.flags).length) flags[r.slug] = r.flags;
  if ((r.confidence ?? 1) < 0.8) lowConf.push(r.slug + '(' + r.confidence + ')');
  applied++;
}
fs.writeFileSync('./reference/moves_battle_data_fix.json', JSON.stringify(fix, null, 1));
fs.writeFileSync('./reference/_move_flags.json', JSON.stringify(flags, null, 1));
console.log('反映:', applied, '技 / overlay総数:', Object.keys(fix).length);
if (lowConf.length) console.log('低確信(<0.8):', lowConf.join(', '));

// rebuild + compose hole check
require('child_process').execSync('node tools/_build_pokechan_data_all.js', { stdio: 'ignore' });
delete require.cache[require.resolve('../pokechan_data_all.js')];
const { compose } = require('./_waza_compose.js');
const A = require('../pokechan_data_all.js');
const find = s => Object.values(A.WAZA_MAP).find(w => (w.key || w.slug) === s);
let holes = [];
for (const r of results) {
  if (!r || !r.slug) continue;
  const m = find(r.slug); if (!m) continue;
  const out = compose(m);
  if (out.holes && out.holes.length) holes.push(r.slug + ' [' + out.holes.map(h => h.kind || JSON.stringify(h)).join(',') + ']');
}
console.log('compose穴あり:', holes.length, '/', applied);
if (holes.length) holes.forEach(h => console.log('  ⚠', h));
fs.writeFileSync('./reference/_build_holes.json', JSON.stringify(holes, null, 1));
