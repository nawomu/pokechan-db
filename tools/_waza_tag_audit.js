/** タグ表記ゆれ監査: 疑わしいタグ群の技+説明を突き合わせる (調査用・使い捨て) */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8');
const fn = new Function('window', 'document', 'navigator', 'console', src + '\n;return (typeof WAZA_MAP!=="undefined"?WAZA_MAP:null);');
const W = fn({}, {}, {}, console);
const moves = Object.values(W);

function movesWith(tag) { return moves.filter(m => (m.tags || []).includes(tag)); }
function show(tag) {
  const ms = movesWith(tag);
  console.log(`\n● ${tag}  (${ms.length})`);
  ms.slice(0, 6).forEach(m => console.log(`    ${m.name}: ${m.description || m.description_legacy || ''}`));
}

const groups = {
  'A. 命中(accuracy)ダウン': ['opp_accuracy_down', 'opp_acc_down_1', 'opp_evasion_down', 'self_evasion_up'],
  'B. 場(field)の除去/変更': ['remove_field', 'field_remove', 'field_change', 'remove_field'],
  'C. こんらん': ['status_confuse', 'status_confuse_via_buff_check'],
  'D. やけど': ['status_burn', 'status_burn_via_buff_check'],
  'E. 相手こうげきダウン2': ['opp_atk_down_2', 'opp_atk_down_2_via_buff_x2'],
  'F. 自分とくこうダウン2(タイミング)': ['self_spa_down_2', 'self_spa_down_2_after'],
  'G. 自分ぼうぎょダウン(タイミング)': ['self_def_down_1', 'self_def_down_after'],
  'H★ spd と spe の意味確認(別ステか)': ['self_spd_up_1', 'self_spe_up_1', 'opp_spd_down_1', 'opp_spe_down_1', 'self_spd_down_1', 'self_spe_down_1'],
  'I. クリティカル確定': ['must_crit', 'self_crit_boost'],
  'J. 回復(recovery)系の細分': ['recovery_1_2', 'recovery_simple', 'recovery_1_4_or_1_2', 'recovery_status_only', 'recovery_per_turn', 'recovery_drain_seed', 'recovery_takuwaeru', 'recovery_swap_with_self', 'drain_half', 'hp_drain_self'],
  'K. タイプ変更': ['type_change_self', 'type_change_target', 'type_add', 'type_ignore'],
  'L. 連続/複数回': ['multi_2_5_random', 'multi_2_fixed', 'multi_thrash', 'multi_2_5_random'],
  'M. その他(other_misc/has_secondary_effect)': ['other_misc', 'has_secondary_effect'],
};

for (const [title, tags] of Object.entries(groups)) {
  console.log('\n========== ' + title + ' ==========');
  [...new Set(tags)].forEach(show);
}
