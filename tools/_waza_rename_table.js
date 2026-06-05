/**
 * わざタグ 可読リネーム案の表を生成 (設計用)
 * 旧タグ → 新タグ(動詞/方向先・field採用・up/down明示) の対応表を HTML/JSON で出力。
 * 命名は toNew() のルール + OVERRIDE。日本語意味/フェーズは TAG_META 流用。
 * 実行: node tools/_waza_rename_table.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

// 旧タグ -> [phase, 日本語意味]  (_waza_phases.js の TAG_META と同一)
const TAG_META = {
  priority_plus_1: ['P1', '優先度+1（先制）'], priority_plus_2: ['P1', '優先度+2'], priority_plus_3: ['P1', '優先度+3'], priority_plus_4: ['P1', '優先度+4（最優先級）'], priority_minus_3: ['P1', '優先度-3（後攻）'], priority_minus_5: ['P1', '優先度-5（後攻）'], priority_minus_6: ['P1', '優先度-6（最後攻）'],
  charge_then_attack: ['P2', '溜め攻撃（2ターン）'], charge_invulnerable: ['P2', '溜め中は無敵'], charge_normal: ['P2', '溜め（通常）'], charge_with_stat_up: ['P2', '溜め（能力上昇付き）'], skip_charge_in_weather: ['P2', '天候で溜め省略'], recharge_next: ['P2', '次ターン反動で動けない'], lock_3turn: ['P2', '3ターン連続行動ロック'], lock_self_bind: ['P2', '自分が連続技で拘束される'], lock_self_self: ['P2', '自分拘束（要確認）'], status_flinch: ['P2', 'ひるませる（相手を行動不可に）'], move_block_disable: ['P2', '相手の技を封じる'],
  must_hit: ['P3', '必中'], opp_acc_down_1: ['P3', '相手の命中率-1'], opp_accuracy_down: ['P3', '相手の命中率ダウン（重複）'], opp_evasion_down: ['P3', '相手の回避率ダウン'], self_evasion_up: ['P3', '自分の回避率アップ'], defense_protect: ['P3', 'まもる（攻撃を防ぐ）'], defense_substitute: ['P3', 'みがわりを作る'], defense_redirect: ['P3', '攻撃を自分に集める'], substitute_pierce: ['P3', 'みがわりを貫通する'],
  damage_only: ['P4', 'ダメージのみ'], power_x12_by_iron_fist: ['P4', 'てつのこぶしで威力1.2倍'], power_x2_in_weather: ['P4', '天候で威力2倍'], power_half_in_weather: ['P4', '天候で威力半減'], power_half_in_grassfield: ['P4', 'グラスフィールドで威力半減'], power_x2_on_minimize: ['P4', 'ちいさくなった相手に威力2倍'], power_x2_on_dive: ['P4', 'ダイブ中に威力2倍'], power_x2_on_dig: ['P4', 'あなをほる中に威力2倍'], power_by_weight_opp: ['P4', '相手の重さで威力変化'], power_by_weight_self_heavier: ['P4', '自分が重いほど威力上昇'], power_by_hp_low: ['P4', '自分のHPが低いほど威力上昇'], power_by_hp_self_high: ['P4', '自分のHPが高いほど威力上昇'], power_by_hp_target_high: ['P4', '相手のHPが高いほど威力上昇'], power_by_takuwaeru: ['P4', 'たくわえ回数で威力上昇'], power_first_turn_only: ['P4', '出てすぐのみ威力'], power_x2_if_status: ['P4', '相手が状態異常なら威力2倍'], power_x2_if_opp_status: ['P4', '相手が状態異常なら威力2倍（重複ぎみ）'], power_x2_in_field: ['P4', 'フィールド中で威力2倍'], power_x2_if_prev_fail: ['P4', '前ターン失敗で威力2倍'], power_x2_after_debuff: ['P4', '能力低下後に威力2倍（要確認）'], power_plus_by_buff_count: ['P4', '能力上昇の数だけ威力上昇'], self_crit_boost: ['P4', '急所ランク+'], must_crit: ['P4', '必ず急所'], ohko: ['P4', '一撃必殺'], fixed_damage: ['P4', '固定ダメージ'], target_hp_half: ['P4', '相手のHPを半分に'], counter_last_dmg_x15: ['P4', '受けたダメージを1.5倍反射'], drain_half: ['P4', '与ダメの1/2回復（吸収）'], recoil_1_3: ['P4', '反動1/3'], recoil_1_2: ['P4', '反動1/2'], recoil_1_4: ['P4', '反動1/4'], recoil_on_miss: ['P4', '外すと反動'], multi_2_5_random: ['P4', '2〜5回連続ヒット'], multi_2_fixed: ['P4', '2回連続ヒット'], multi_thrash: ['P4', '2〜3ターン連続（あばれる系）'], type_ignore: ['P4', 'タイプ相性を無視'], ghost_immune: ['P4', 'ゴーストには無効'], ice_immune: ['P4', 'こおり関連の無効（要確認）'], stat_ignore: ['P4', '相手の能力変化を無視'], use_opp_atk: ['P4', '相手の攻撃力で計算（イカサマ）'], use_def_for_spe: ['P4', '素早さにぼうぎょ使用（要確認）'], auto_select_phys_spec: ['P4', '物理/特殊を自動選択'], fail_self_damage: ['P4', '失敗/外しで自分にダメージ'], defense_swap_atk: ['P4', 'ぼうぎょでダメージ計算（ボディプレス）'],
  status_burn: ['P5', 'やけどにする'], status_freeze: ['P5', 'こおりにする'], status_paralysis: ['P5', 'まひにする'], status_poison: ['P5', 'どくにする'], status_badpoison: ['P5', 'もうどくにする'], status_sleep: ['P5', 'ねむりにする'], status_confuse: ['P5', 'こんらんにする'], status_random: ['P5', 'ランダムな状態異常'], status_burn_via_buff_check: ['P5', '能力上昇した相手をやけど'], status_confuse_via_buff_check: ['P5', '能力上昇した相手をこんらん'],
  opp_atk_down_1: ['P5', '相手のこうげき-1'], opp_atk_down_2: ['P5', '相手のこうげき-2'], opp_def_down_1: ['P5', '相手のぼうぎょ-1'], opp_def_down_2: ['P5', '相手のぼうぎょ-2'], opp_spa_down_1: ['P5', '相手のとくこう-1'], opp_spa_down_2: ['P5', '相手のとくこう-2'], opp_spd_down_1: ['P5', '相手のとくぼう-1'], opp_spd_down_2: ['P5', '相手のとくぼう-2'], opp_spe_down_1: ['P5', '相手のすばやさ-1'], opp_spe_down_2: ['P5', '相手のすばやさ-2'], opp_atk_up_2: ['P5', '相手のこうげき+2（デメリット）'], opp_atk_down_2_via_buff_x2: ['P5', '⚠いばる系: 実際は相手こうげき+2'],
  self_atk_up_1: ['P5', '自分のこうげき+1'], self_atk_up_2: ['P5', '自分のこうげき+2'], self_def_up_1: ['P5', '自分のぼうぎょ+1'], self_def_up_2: ['P5', '自分のぼうぎょ+2'], self_spa_up_1: ['P5', '自分のとくこう+1'], self_spa_up_2: ['P5', '自分のとくこう+2'], self_spd_up_1: ['P5', '自分のとくぼう+1'], self_spd_up_2: ['P5', '自分のとくぼう+2'], self_spe_up_1: ['P5', '自分のすばやさ+1'], self_spe_up_2: ['P5', '自分のすばやさ+2'],
  self_atk_down_1: ['P5', '自分のこうげき-1'], self_def_down_1: ['P5', '自分のぼうぎょ-1'], self_spd_down_1: ['P5', '自分のとくぼう-1'], self_spe_down_1: ['P5', '自分のすばやさ-1'], self_spa_down_2: ['P5', '自分のとくこう-2（攻撃後）'], self_def_down_after: ['P5', '自分のぼうぎょ-（攻撃後）'], self_spa_down_2_after: ['P5', '自分のとくこう-2（攻撃後）'], self_spd_down_after: ['P5', '自分のとくぼう-（攻撃後）'], self_spe_down_after: ['P5', '自分のすばやさ-（攻撃後）'],
  buff_ally_atk: ['P5', '味方のこうげきを上げる'], buff_random_stat_2: ['P5', 'ランダムな能力+2'], self_status_cure_on_use: ['P5', '使うと自分の状態異常が治る'], trap_no_switch: ['P5', '相手を交代不可に'], item_steal: ['P5', '相手の道具を奪う'], item_swap: ['P5', '道具を入れ替える'], item_remove: ['P5', '相手の道具を失わせる'], item_berry_eat_steal: ['P5', '相手のきのみを食べる/奪う'], pp_reduce: ['P5', '相手のPPを減らす'], ability_copy_target: ['P5', '相手の特性をコピー'], stat_copy: ['P5', '相手の能力ランクをコピー'], stat_reset: ['P5', '能力ランクを元に戻す'], stat_swap_def_spdef: ['P5', 'ぼうぎょ↔とくぼう入替'], stat_swap_atk_spa: ['P5', 'こうげき↔とくこう入替'], type_change_target: ['P5', '相手のタイプを変更/追加'], type_change_self: ['P5', '自分のタイプを変更/喪失'], type_add: ['P5', '⚠中身がOHKO/接地化（要再付与）'], mimic_last: ['P5', '相手の最後の技をコピー'], opp_status_cure_freeze: ['P5', '相手のこおりを治す'],
  recovery_1_2: ['P5', '最大HPの1/2回復'], recovery_simple: ['P5', '1/2回復（重複）'], recovery_1_4_or_1_2: ['P5', '天候で回復量変化'], recovery_status_only: ['P5', '状態異常を治す'], recovery_takuwaeru: ['P5', 'たくわえ回数でHP回復'], recovery_swap_with_self: ['P5', '次に出すポケモンを全回復'], hp_cost_half: ['P5', 'HPを半分払う'], hp_drain_self: ['P5', '自分のHPを使う（要確認）'],
  field_grass: ['P6', 'グラスフィールド展開'], field_electric: ['P6', 'エレキフィールド展開'], field_psychic: ['P6', 'サイコフィールド展開'], field_misty: ['P6', 'ミストフィールド展開'], field_change: ['P6', 'フィールド展開'], field_remove: ['P6', 'フィールド破壊'], remove_field: ['P6', '⚠設置物/バインド/まもる解除'], weather_change: ['P6', '天気を変える'], setup_stealth_rock: ['P6', 'ステルスロック設置'], setup_spikes: ['P6', 'まきびし設置'], setup_toxic_spikes: ['P6', 'どくびし設置'], setup_sticky_web: ['P6', 'ねばねばネット設置'], wall_light: ['P6', 'ひかりのかべ/リフレクター'], wall_aurora: ['P6', 'オーロラベール'], wall_mist: ['P6', 'しろいきり'], defense_remove_walls: ['P6', '相手の壁を破壊'], electric_float: ['P6', 'でんじふゆう（浮遊化）'], recovery_drain_seed: ['P8', 'やどりぎのタネ（毎ターン吸収）'], recovery_per_turn: ['P8', '毎ターンHP回復'],
  self_switch: ['P7', '自分が交代'], force_switch_opp: ['P7', '相手を強制交代'],
  self_faint: ['P8', '自分が瀕死になる'], future_attack: ['P8', '未来に攻撃（みらいよち）'],
  has_secondary_effect: ['META', '追加効果を持つ（広域フラグ）'], other_misc: ['META', 'その他（未整備）'], ally_target_doubles_only: ['META', 'ダブル専用（味方対象）'],
};

const STAT = { atk: 'attack', def: 'defense', spa: 'special_attack', spd: 'special_defense', spe: 'speed' };

// 不規則・要個別命名の上書き
const OVERRIDE = {
  // 命中/回避 (acc/accuracy の重複も down_opp_accuracy_1 に集約)
  opp_acc_down_1: 'down_opp_accuracy_1', opp_accuracy_down: 'down_opp_accuracy_1',
  opp_evasion_down: 'down_opp_evasion_1', self_evasion_up: 'up_self_evasion_1',
  must_hit: 'never_miss', must_crit: 'always_crit', self_crit_boost: 'up_crit_rate',
  // 状態異常
  status_burn: 'inflict_burn', status_freeze: 'inflict_freeze', status_paralysis: 'inflict_paralysis', status_poison: 'inflict_poison', status_badpoison: 'inflict_badly_poison', status_sleep: 'inflict_sleep', status_confuse: 'inflict_confuse', status_random: 'inflict_random_status', status_flinch: 'inflict_flinch',
  status_burn_via_buff_check: 'inflict_burn_if_target_boosted', status_confuse_via_buff_check: 'inflict_confuse_if_target_boosted',
  self_status_cure_on_use: 'cure_self_status_on_use', opp_status_cure_freeze: 'cure_target_freeze',
  // 威力(条件)
  power_x12_by_iron_fist: 'power_x1_2_if_iron_fist', power_x2_in_weather: 'power_x2_if_weather', power_half_in_weather: 'power_half_if_weather', power_half_in_grassfield: 'power_half_if_grass_field', power_x2_on_minimize: 'power_x2_if_target_minimized', power_x2_on_dive: 'power_x2_if_target_diving', power_x2_on_dig: 'power_x2_if_target_digging', power_by_weight_opp: 'power_by_target_weight', power_by_weight_self_heavier: 'power_by_weight_difference', power_by_hp_low: 'power_up_if_self_hp_low', power_by_hp_self_high: 'power_up_if_self_hp_high', power_by_hp_target_high: 'power_up_if_target_hp_high', power_by_takuwaeru: 'power_by_stockpile', power_first_turn_only: 'power_only_first_turn', power_x2_if_status: 'power_x2_if_target_statused', power_x2_if_opp_status: 'power_x2_if_target_statused', power_x2_in_field: 'power_x2_if_field', power_x2_if_prev_fail: 'power_x2_if_prev_turn_failed', power_x2_after_debuff: 'power_x2_if_self_debuffed', power_plus_by_buff_count: 'power_up_by_self_boosts',
  // ダメージ系
  damage_only: 'damage_only', ohko: 'one_hit_ko', fixed_damage: 'fixed_damage', target_hp_half: 'halve_target_hp', counter_last_dmg_x15: 'counter_damage_x1_5', drain_half: 'drain_half', recoil_1_3: 'recoil_1_3', recoil_1_2: 'recoil_1_2', recoil_1_4: 'recoil_1_4', recoil_on_miss: 'recoil_if_miss', type_ignore: 'ignore_type_effectiveness', ghost_immune: 'no_effect_on_ghost', ice_immune: 'no_effect_on_ice', stat_ignore: 'ignore_target_stat_stages', use_opp_atk: 'use_target_attack', use_def_for_spe: 'use_defense_for_speed', auto_select_phys_spec: 'auto_physical_or_special', fail_self_damage: 'self_damage_on_fail', defense_swap_atk: 'use_defense_for_damage', hp_drain_self: 'damage_by_hp_difference',
  // 連続/溜め/ロック
  multi_2_5_random: 'hit_2_to_5_times', multi_2_fixed: 'hit_2_times', multi_thrash: 'rampage_2_3_turns', charge_then_attack: 'charge_1_turn', charge_invulnerable: 'charge_1_turn_invulnerable', charge_normal: 'charge_1_turn_normal', charge_with_stat_up: 'charge_1_turn_with_stat_up', skip_charge_in_weather: 'skip_charge_if_weather', recharge_next: 'recharge_next_turn', lock_3turn: 'lock_3_turns', lock_self_bind: 'self_bound_multi_turn', lock_self_self: 'self_locked_into_move',
  // 優先度
  priority_plus_1: 'priority_up_1', priority_plus_2: 'priority_up_2', priority_plus_3: 'priority_up_3', priority_plus_4: 'priority_up_4', priority_minus_3: 'priority_down_3', priority_minus_5: 'priority_down_5', priority_minus_6: 'priority_down_6',
  // 防御/みがわり
  defense_protect: 'protect_self', defense_substitute: 'set_substitute', defense_redirect: 'redirect_attacks', substitute_pierce: 'pierce_substitute', move_block_disable: 'disable_target_move', trap_no_switch: 'prevent_target_switch',
  // 場・天気・設置・壁
  field_grass: 'set_field_grass', field_electric: 'set_field_electric', field_psychic: 'set_field_psychic', field_misty: 'set_field_misty', field_change: 'set_field', field_remove: 'remove_field', remove_field: 'clear_hazards_and_binds', weather_change: 'set_weather', setup_stealth_rock: 'set_stealth_rock', setup_spikes: 'set_spikes', setup_toxic_spikes: 'set_toxic_spikes', setup_sticky_web: 'set_sticky_web', wall_light: 'set_screen', wall_aurora: 'set_aurora_veil', wall_mist: 'set_mist', defense_remove_walls: 'remove_screens', electric_float: 'set_self_floating',
  // 回復/HP
  recovery_1_2: 'heal_self_half', recovery_simple: 'heal_self_half', recovery_1_4_or_1_2: 'heal_self_by_weather', recovery_status_only: 'cure_status', recovery_takuwaeru: 'heal_by_stockpile', recovery_swap_with_self: 'heal_switch_in', recovery_drain_seed: 'drain_each_turn', recovery_per_turn: 'heal_each_turn', hp_cost_half: 'cost_self_hp_half',
  // 道具/タイプ/特性/その他
  item_steal: 'steal_item', item_swap: 'swap_item', item_remove: 'remove_target_item', item_berry_eat_steal: 'eat_or_steal_berry', pp_reduce: 'reduce_target_pp', ability_copy_target: 'copy_target_ability', stat_copy: 'copy_target_stat_stages', stat_reset: 'reset_stat_stages', stat_swap_def_spdef: 'swap_self_defense_special_defense', stat_swap_atk_spa: 'swap_self_attack_special_attack', type_change_target: 'change_target_type', type_change_self: 'change_self_type', type_add: 'needs_review_was_type_add', mimic_last: 'copy_last_move', buff_ally_atk: 'up_ally_attack_1', buff_random_stat_2: 'up_self_random_stat_2',
  // 交代/終了
  self_switch: 'switch_self_out', force_switch_opp: 'force_switch_target', self_faint: 'faint_self', future_attack: 'delayed_attack',
  // 不一致の特殊(要確認)
  opp_atk_up_2: 'up_target_attack_2', opp_atk_down_2_via_buff_x2: 'needs_review_atk_via_buff',
  // META
  has_secondary_effect: 'has_secondary_effect', other_misc: 'other_misc', ally_target_doubles_only: 'doubles_only_ally_target',
};

// 規則変換 (stat の up/down/after を方向先に)
function toNew(tag) {
  if (OVERRIDE[tag]) return OVERRIDE[tag];
  let m;
  if ((m = tag.match(/^(self|opp)_(atk|def|spa|spd|spe)_(up|down)_(\d)$/)))
    return `${m[3]}_${m[1] === 'opp' ? 'opp' : 'self'}_${STAT[m[2]]}_${m[4]}`;
  if ((m = tag.match(/^(self|opp)_(atk|def|spa|spd|spe)_(up|down)_(\d)_after$/)))
    return `${m[3]}_${m[1]}_${STAT[m[2]]}_${m[4]}_after`;
  if ((m = tag.match(/^(self|opp)_(atk|def|spa|spd|spe)_(up|down)_after$/)))
    return `${m[3]}_${m[1]}_${STAT[m[2]]}_after`;
  return '(要命名)';
}

// 集計・出力
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PHASE_TITLE = { P1: '① 行動順', P2: '② 行動可否・溜め', P3: '③ 命中・防御', P4: '④ ダメージ計算', P5: '⑤ 命中後の追加効果', P6: '⑥ 場・天気・設置', P7: '⑦ 交代', P8: '⑧ ターン終了', META: '⚙️ メタ' };
const order = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'META'];

const rows = Object.entries(TAG_META).map(([old, [ph, ja]]) => ({ old, ph, ja, neu: toNew(old) }));
// 重複統合の検出 (新名が同じ旧タグ)
const newToOld = {}; rows.forEach(r => (newToOld[r.neu] = newToOld[r.neu] || []).push(r.old));

const map = {}; rows.forEach(r => map[r.old] = r.neu);
fs.writeFileSync(path.join(ROOT, 'review/waza_tag_rename_map.json'), JSON.stringify(map, null, 2));

let body = order.map(ph => {
  const rs = rows.filter(r => r.ph === ph).sort((a, b) => a.old.localeCompare(b.old));
  if (!rs.length) return '';
  const trs = rs.map(r => {
    const merged = newToOld[r.neu].length > 1;
    const warn = /⚠|要確認|要再付与/.test(r.ja) || r.neu.startsWith('needs_review') || r.neu === '(要命名)';
    return `<tr class="${warn ? 'warn' : ''}"><td><code class="old">${esc(r.old)}</code></td><td>→</td><td><code class="new">${esc(r.neu)}</code>${merged ? ' <span class="merge">統合</span>' : ''}</td><td class="ja">${esc(r.ja)}</td></tr>`;
  }).join('');
  return `<h2>${PHASE_TITLE[ph]} <span class="cnt">${rs.length}</span></h2><table><thead><tr><th>旧タグ</th><th></th><th>新タグ案</th><th>意味</th></tr></thead><tbody>${trs}</tbody></table>`;
}).join('');

const needName = rows.filter(r => r.neu === '(要命名)');
const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>わざタグ 可読リネーム案 — PchamDB</title><style>
:root{--bg:#0f1320;--card:#1a2032;--ink:#e7ecf5;--muted:#8b97b0;--line:#2a3350}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.6 -apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN",system-ui,sans-serif}
header{padding:16px 22px;background:linear-gradient(135deg,#1a2238,#101626);border-bottom:2px solid #FF7A00}
header h1{margin:0 0 4px;font-size:19px}.sub{color:var(--muted);font-size:12px}
.wrap{padding:14px 22px;max-width:1100px;margin:0 auto}
h2{font-size:15px;margin:22px 0 8px;color:#ffce5a;border-left:4px solid #FF7A00;padding-left:8px}.cnt{color:var(--muted);font-size:12px}
.legend{background:#15203a;border:1px solid var(--line);border-radius:8px;padding:10px 14px;font-size:12px;margin:10px 0;color:#cdd8ef}
table{border-collapse:collapse;width:100%;margin-bottom:6px}
th,td{padding:4px 10px;border-top:1px solid var(--line);text-align:left;vertical-align:top}
th{color:#bcd0f5;font-size:11px}
code.old{color:#ff9b9b;background:#2a1c1c;border:1px solid #4e2e2e;border-radius:5px;padding:0 6px;font-size:11px}
code.new{color:#9be3a8;background:#16291c;border:1px solid #2c5a39;border-radius:5px;padding:0 6px;font-size:12px}
.ja{color:#c7d2ea}.merge{color:#ffce5a;font-size:10px;border:1px solid #5e4e2c;border-radius:6px;padding:0 5px}
tr.warn code.new{color:#ffd27d;background:#2a2212;border-color:#5e4e2c}
</style></head><body>
<header><h1>📝 わざタグ 可読リネーム案</h1><div class="sub">動詞/方向が先・field採用・up/down明示 ／ ${rows.length}タグ ／ 自動生成</div></header>
<div class="wrap">
<div class="legend">
規約: <code class="new">up_/down_</code>(能力) <code class="new">inflict_</code>(状態異常) <code class="new">set_/remove_</code>(場・設置) <code class="new">heal_/drain_</code>(HP) <code class="new">power_..._if_</code>(威力条件) <code class="new">priority_up_/down_</code>。
ステータス語=attack/defense/special_attack/special_defense/speed/accuracy/evasion。
<b>統合</b>=同じ新名にまとまる重複。<span style="color:#ffd27d">黄色</span>=要確認(中身がズレ/再命名検討)。
</div>
${body}
${needName.length ? `<div class="legend" style="border-color:#5e2f2f">⚠ 自動命名できなかったタグ ${needName.length}件: ${needName.map(r => esc(r.old)).join(', ')}</div>` : ''}
</div></body></html>`;

fs.writeFileSync(path.join(ROOT, 'review/waza_tag_rename.html'), html);
console.log('タグ数:', rows.length, '/ (要命名):', needName.length);
console.log('統合される重複:', Object.values(newToOld).filter(a => a.length > 1).map(a => a.join('+')).join(' , ') || 'なし');
console.log('出力: review/waza_tag_rename.html , review/waza_tag_rename_map.json');
