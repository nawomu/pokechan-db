/**
 * 3波の抽出specsを canonical merge_map で正規化(kind統一)+ schema外フィールド除去。
 * 出力: review/waza_effects_specs_normalized.json(463技)
 * 実行: node tools/_waza_effects_normalize.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const R = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const mm = R('review/waza_kind_canonical.json').merge_map;
const ALLOWED = new Set(['key', 'name', 'en', 'priority', 'flags', 'effects', 'requires', 'fails_if', 'immune', 'blocked_by', 'not_blocked_by']);
const sets = ['review/waza_effects_specs_henka.json', 'review/waza_effects_specs_butsuri.json', 'review/waza_effects_specs_tokushu.json'];

const all = [];
const strayLog = {}, renameTally = {}, unmapped = new Set();
for (const f of sets) for (const s of R(f).specs) {
  const clean = {};
  for (const k of Object.keys(s)) { if (ALLOWED.has(k)) clean[k] = s[k]; else (strayLog[s.name] = strayLog[s.name] || []).push(k); }
  for (const e of (clean.effects || [])) {
    const to = mm[e.kind];
    if (to === undefined) { unmapped.add(e.kind); continue; }
    if (to !== e.kind) { renameTally[e.kind + '→' + to] = (renameTally[e.kind + '→' + to] || 0) + 1; e.kind = to; }
  }
  all.push(clean);
}
fs.writeFileSync(path.join(ROOT, 'review/waza_effects_specs_normalized.json'), JSON.stringify({ specs: all }, null, 1));

const tally = {};
for (const s of all) for (const e of (s.effects || [])) tally[e.kind] = (tally[e.kind] || 0) + 1;
console.log('正規化specs:', all.length, '/ 正規化後 distinct kind:', Object.keys(tally).length);
console.log('リネーム件数:', Object.values(renameTally).reduce((a, b) => a + b, 0));
if (unmapped.size) console.log('⚠ merge_map未収録kind:', [...unmapped].join(', '));
console.log('schema外フィールド除去:', Object.entries(strayLog).map(([m, ks]) => `${m}(${ks.join('/')})`).join(', ') || 'なし');
