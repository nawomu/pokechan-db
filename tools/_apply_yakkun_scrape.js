// Yakkunスクレイプ結果(reference/_yk_scraped.json: slug→{n,en,name_ja,eff})を
// reference/moves_yakkun.json(ヤック列=お手本/legacy参照)に正しく反映する。
// 型アイコンが効果文先頭で空欄化する箇所(「タイプの攻撃技」)を軽く補修。
const fs = require('fs');
const A = require('../pokechan_data_all.js');
const scraped = require('../reference/_yk_scraped.json');
let cur = {}; try { cur = require('../reference/moves_yakkun.json'); } catch (e) {}

// 技slug→JAタイプ(先頭の空欄型を補える場合に使う)
const typeJa = {};
for (const w of Object.values(A.WAZA_MAP)) typeJa[w.key || w.slug] = w.type;

function cleanEff(slug, eff) {
  if (!eff) return '';
  let s = eff.trim();
  // 「効果」ラベルが混ざる場合の除去
  s = s.replace(/^効果\s*/, '');
  // 先頭が「タイプの攻撃技」のように型名が画像で欠落 → 技のタイプを補う
  const t = typeJa[slug];
  if (t && /^タイプの/.test(s)) s = '『' + t + '』' + s;
  return s.trim();
}

const out = Object.assign({}, cur);
let replaced = 0, added = 0, unchanged = 0;
const changedSamples = [];
for (const [slug, rec] of Object.entries(scraped)) {
  const eff = cleanEff(slug, rec.eff);
  if (!eff) continue;
  const before = out[slug];
  if (before !== eff) {
    if (before == null) added++; else { replaced++; if (changedSamples.length < 15) changedSamples.push({ slug, before: (before || '').slice(0, 40), after: eff.slice(0, 40) }); }
    out[slug] = eff;
  } else unchanged++;
}

fs.writeFileSync('./reference/moves_yakkun.json', JSON.stringify(out, null, 0));
console.log('moves_yakkun.json 更新: 置換', replaced, '/ 追加', added, '/ 不変', unchanged, '/ 総数', Object.keys(out).length);
console.log('変更サンプル:');
changedSamples.forEach(c => console.log('  [' + c.slug + '] ' + c.before + ' → ' + c.after));

// スクレイプで取れなかった(Yakkun未収録)技を報告
const nat = Object.values(A.WAZA_MAP).filter(w => w.national_new).map(w => w.key || w.slug);
const missing = nat.filter(s => !scraped[s]);
console.log('\nYakkun未収録(スクレイプ未取得)', missing.length, '技:', missing.slice(0, 40).join(', '));
fs.writeFileSync('./reference/_yk_missing.json', JSON.stringify(missing, null, 1));
