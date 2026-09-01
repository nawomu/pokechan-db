#!/usr/bin/env node
/* tools/_master_regression_diff.js — master/*.json の「今回追加したフィールド以外は1バイトも変えていない」を確認する
 *
 * 目的(段B・計画_マスターからページへ流す_2026-09-01.md): build_master_v2.js に7資産の受け皿フィールドを
 *   足す作業で、★既存の値を静かに書き換えていないか(=段Bのスコープ外の変更が紛れていないか)を機械で確認する。
 *
 * 使い方: node tools/_master_regression_diff.js <old_dir> <new_dir>
 *   例: node tools/_master_regression_diff.js /path/to/master_before master
 *   old_dir 省略時は無視できないので必須。
 *
 * 判定: 各 master/*.json の items[] を、①今回追加したキー(ALLOW_NEW_KEYS) ②verified_at/generated_at
 *   を無視して比較する。それ以外のキーで値が変わっていれば「未説明差分」として報告し、非0件なら exit 1。
 *   追加された行(新規no/新規slug)は「追加」として別カウント(エラーにしない)。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const [, , oldDirArg, newDirArg] = process.argv;
if (!oldDirArg || !newDirArg) {
  console.error('使い方: node tools/_master_regression_diff.js <old_dir> <new_dir>');
  process.exit(2);
}
const oldDir = path.resolve(oldDirArg);
const newDir = path.resolve(newDirArg);

// ★段Bで新設したフィールド。ここに書いたキーだけは「差分」に数えない(意図した追加)。
const ALLOW_NEW_KEYS = {
  'pokemon.json': ['seasons', 'champions_added_in'],
  'moves.json': ['availability', 'subcategory', 'champions_added', 'champions_mode'],
  'abilities.json': ['desc_house', 'desc_house_source'],
  'items.json': [
    'acquisition', 'acquisition_note', 'restriction', 'notes', 'verify', 'q12', 'factor', 'source_q12',
    'boost_type', 'vp_cost', 'resist_type', 'trigger', 'cure_target', 'is_default',
    'heal_amount_fixed', 'heal_fraction', 'heal_fraction_of_damage', 'heal_fraction_for_poison',
    'damage_fraction_for_others', 'damage_fraction_to_attacker', 'proc_chance', 'self_inflict', 'drawback',
    'pokeapi_slug', 'legacy_source_note', 'effect_house', 'mega_ability_desc_house',
  ],
  'types.json': [],
  'natures.json': [],
  'learnsets.json': [],
  'regulations.json': [],
};
const ALWAYS_IGNORE = new Set(['verified_at', 'generated_at']);

// ★行を突き合わせるキー(できるだけ一意な組み合わせ)
const KEY_FIELDS = {
  'pokemon.json': it => `${it.slug || ''}|${it.no || ''}|${it.name || ''}|${it.form || ''}`,
  'moves.json': it => it.slug || it.name,
  'abilities.json': it => it.name,
  'items.json': it => it.name,
  'learnsets.json': it => it.slug || it.name,
  'regulations.json': it => it.id,
  'types.json': it => it.name,
  'natures.json': it => it.name,
};

function stripKeys(obj, ignore) {
  const o = {};
  Object.keys(obj).forEach(k => {
    if (ignore.has(k)) return;
    o[k] = obj[k];
  });
  return o;
}

const FILES = ['pokemon.json', 'moves.json', 'abilities.json', 'items.json', 'learnsets.json', 'regulations.json', 'types.json', 'natures.json'];

let totalDiffs = 0;
const report = {};
FILES.forEach(f => {
  const oldPath = path.join(oldDir, f);
  const newPath = path.join(newDir, f);
  if (!fs.existsSync(oldPath) || !fs.existsSync(newPath)) {
    report[f] = { skipped: true, reason: !fs.existsSync(oldPath) ? 'old missing' : 'new missing' };
    return;
  }
  const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
  const newData = JSON.parse(fs.readFileSync(newPath, 'utf8'));
  const oldItems = oldData.items || [];
  const newItems = newData.items || [];
  const keyOf = KEY_FIELDS[f];
  const ignore = new Set([...ALWAYS_IGNORE, ...(ALLOW_NEW_KEYS[f] || [])]);

  const oldByKey = new Map();
  oldItems.forEach(it => oldByKey.set(keyOf(it), it));
  const newByKey = new Map();
  newItems.forEach(it => newByKey.set(keyOf(it), it));

  const changed = [];
  let matched = 0;
  newByKey.forEach((newIt, key) => {
    const oldIt = oldByKey.get(key);
    if (!oldIt) return; // 追加行(段A/段B対象外・エラーにしない)
    matched++;
    const a = JSON.stringify(stripKeys(oldIt, ignore));
    const b = JSON.stringify(stripKeys(newIt, ignore));
    if (a !== b) changed.push({ key, old: stripKeys(oldIt, ignore), new: stripKeys(newIt, ignore) });
  });
  const added = [...newByKey.keys()].filter(k => !oldByKey.has(k));
  const removed = [...oldByKey.keys()].filter(k => !newByKey.has(k));

  report[f] = {
    old_count: oldItems.length, new_count: newItems.length,
    matched, changed_count: changed.length, added_count: added.length, removed_count: removed.length,
    changed_sample: changed.slice(0, 5),
    removed_sample: removed.slice(0, 10),
  };
  totalDiffs += changed.length;
  if (removed.length) totalDiffs += removed.length; // 行が消えたのは常に問題
});

console.log('=== master/*.json 回帰差分チェック(段B追加フィールド以外) ===');
console.log(`old=${oldDir}\nnew=${newDir}`);
FILES.forEach(f => {
  const r = report[f];
  if (!r) return;
  if (r.skipped) { console.log(`- ${f}: スキップ(${r.reason})`); return; }
  const mark = (r.changed_count === 0 && r.removed_count === 0) ? '✅' : '❌';
  console.log(`${mark} ${f}: old=${r.old_count} new=${r.new_count} matched=${r.matched} 追加=${r.added_count} 消失=${r.removed_count} 未説明差分=${r.changed_count}`);
  if (r.changed_count) console.log('   changed_sample:', JSON.stringify(r.changed_sample).slice(0, 500));
  if (r.removed_count) console.log('   removed_sample:', JSON.stringify(r.removed_sample).slice(0, 300));
});

fs.writeFileSync(path.join(process.cwd(), 'reference/_master_regression_report.json'), JSON.stringify(report, null, 1) + '\n');

if (totalDiffs > 0) {
  console.log(`\n❌ 未説明差分 ${totalDiffs} 件。段B追加フィールド以外の値が変わっています。`);
  process.exit(1);
}
console.log('\n✅ 未説明差分0件。段Bで追加したフィールド以外は1バイトも変わっていません。');
process.exit(0);
