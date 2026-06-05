/**
 * わざタグ フェーズ別ビュー生成 (調査・設計用)
 * pokechan_data.js の WAZA_MAP を読み、各タグをバトルのフェーズに割り当てて
 * タブ付きHTML(review/waza_phases.html)に出力する。
 * タグ→{phase,label} は TAG_META で定義。未定義タグは「未分類」タブへ。
 * 実行: node tools/_waza_phases.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8');
const ctx = fn => new Function('window', 'document', 'navigator', 'console', src + '\n;return ' + fn + ';')({}, {}, {}, console);
const WAZA_MAP = ctx('(typeof WAZA_MAP!=="undefined"?WAZA_MAP:null)');
const TYPE_COLORS = ctx('(typeof TYPE_COLORS!=="undefined"?TYPE_COLORS:{})');
const moves = Object.values(WAZA_MAP);

// ===== フェーズ定義 (流れ順) =====
const PHASES = [
  { id: 'P1', title: '① 行動順', desc: '技の優先度 → 素早さで行動順が決まる' },
  { id: 'P2', title: '② 行動可否・溜め・ロック', desc: 'まひ/こおり/ねむり/ひるみ/こんらんで動けるか。溜め技・連続ターン技の拘束' },
  { id: 'P3', title: '③ 命中・回避・防御', desc: '命中/回避判定、必中、まもる/みがわり、貫通' },
  { id: 'P4', title: '④ ダメージ計算', desc: '威力補正・急所・タイプ・連続ヒット・反動・吸収・固定/一撃' },
  { id: 'P5', title: '⑤ 命中後の追加効果', desc: '状態異常・能力変化・道具/タイプ操作・回復(多くは確率発動)' },
  { id: 'P6', title: '⑥ 場・天気・設置・壁', desc: 'フィールド/天気/設置物/壁の展開・解除' },
  { id: 'P7', title: '⑦ 交代', desc: '自主交代・強制交代' },
  { id: 'P8', title: '⑧ ターン終了・継続・遅延', desc: '毎ターン回復/ダメージ、やどりぎ、瀕死、未来攻撃' },
  { id: 'META', title: '⚙️ メタ/横断', desc: '広域フラグ・ダブル専用・寄せ集め・正規化候補' },
  { id: 'UNCLASSIFIED', title: '❓ 未分類', desc: 'フェーズ未割当 (要分類)' },
];

// ===== タグ → {phase, label} =====
// ⚠は名前と中身がズレている/要確認のタグ
const TAG_META = {
  // --- P1 行動順 ---
  priority_plus_1: ['P1', '優先度+1（先制）'], priority_plus_2: ['P1', '優先度+2'],
  priority_plus_3: ['P1', '優先度+3'], priority_plus_4: ['P1', '優先度+4（最優先級）'],
  priority_minus_3: ['P1', '優先度-3（後攻）'], priority_minus_5: ['P1', '優先度-5（後攻）'],
  priority_minus_6: ['P1', '優先度-6（最後攻）'],

  // --- P2 行動可否・溜め・ロック ---
  charge_then_attack: ['P2', '溜め攻撃（2ターン）'], charge_invulnerable: ['P2', '溜め中は無敵（そらをとぶ等）'],
  charge_normal: ['P2', '溜め（通常）'], charge_with_stat_up: ['P2', '溜め（能力上昇付き）'],
  skip_charge_in_weather: ['P2', '天候で溜め省略'], recharge_next: ['P2', '次ターン反動で動けない'],
  lock_3turn: ['P2', '3ターン連続行動ロック'], lock_self_bind: ['P2', '自分が連続技で拘束される'],
  lock_self_self: ['P2', '自分拘束（要確認）'], status_flinch: ['P2', 'ひるませる（相手を行動不可に）'],
  move_block_disable: ['P2', '相手の技を封じる（かなしばり/いちゃもん）'],

  // --- P3 命中・回避・防御 ---
  must_hit: ['P3', '必中'], opp_acc_down_1: ['P3', '相手の命中率-1'],
  opp_accuracy_down: ['P3', '相手の命中率ダウン ⚠opp_acc_down_1と重複'],
  opp_acc_down_1b: ['P3', ''],
  opp_evasion_down: ['P3', '相手の回避率ダウン'], self_evasion_up: ['P3', '自分の回避率アップ'],
  defense_protect: ['P3', 'まもる（攻撃を防ぐ）'], defense_substitute: ['P3', 'みがわりを作る'],
  defense_redirect: ['P3', '攻撃を自分に集める（いかりのこな等）'],
  substitute_pierce: ['P3', 'みがわりを貫通する'],

  // --- P4 ダメージ計算 ---
  damage_only: ['P4', 'ダメージのみ（追加効果なし）'],
  power_x12_by_iron_fist: ['P4', 'てつのこぶしで威力1.2倍（パンチ技）'],
  power_x2_in_weather: ['P4', '天候で威力2倍'], power_half_in_weather: ['P4', '天候で威力半減'],
  power_half_in_grassfield: ['P4', 'グラスフィールドで威力半減（じしん等）'],
  power_x2_on_minimize: ['P4', 'ちいさくなった相手に威力2倍'],
  power_x2_on_dive: ['P4', 'ダイブ中の相手に威力2倍'], power_x2_on_dig: ['P4', 'あなをほる中の相手に威力2倍'],
  power_by_weight_opp: ['P4', '相手の重さで威力変化'], power_by_weight_self_heavier: ['P4', '自分が重いほど威力上昇'],
  power_by_hp_low: ['P4', '自分のHPが低いほど威力上昇'], power_by_hp_self_high: ['P4', '自分のHPが高いほど威力上昇'],
  power_by_hp_target_high: ['P4', '相手のHPが高いほど威力上昇'], power_by_takuwaeru: ['P4', 'たくわえる回数で威力上昇'],
  power_first_turn_only: ['P4', '出てすぐのターンのみ威力'], power_x2_if_status: ['P4', '相手が状態異常なら威力2倍'],
  power_x2_if_opp_status: ['P4', '相手が状態異常なら威力2倍 ⚠power_x2_if_statusと重複ぎみ'],
  power_x2_in_field: ['P4', 'フィールド中で威力2倍'], power_x2_if_prev_fail: ['P4', '前ターン失敗で威力2倍'],
  power_x2_after_debuff: ['P4', '能力低下後に威力2倍（要確認）'], power_plus_by_buff_count: ['P4', '能力上昇の数だけ威力上昇'],
  self_crit_boost: ['P4', '急所ランク+（急所に当たりやすい）'], must_crit: ['P4', '必ず急所に当たる'],
  ohko: ['P4', '一撃必殺'], fixed_damage: ['P4', '固定ダメージ'], target_hp_half: ['P4', '相手のHPを半分にする'],
  counter_last_dmg_x15: ['P4', '受けたダメージを1.5倍で反射'],
  drain_half: ['P4', '与ダメージの1/2を回復（吸収）'],
  recoil_1_3: ['P4', '反動ダメージ1/3'], recoil_1_2: ['P4', '反動ダメージ1/2'], recoil_1_4: ['P4', '反動ダメージ1/4'],
  recoil_on_miss: ['P4', '外すと反動ダメージ（とびひざげり等）'],
  multi_2_5_random: ['P4', '2〜5回連続ヒット'], multi_2_fixed: ['P4', '2回連続ヒット'],
  multi_thrash: ['P4', '2〜3ターン連続攻撃（あばれる系）'],
  type_ignore: ['P4', 'タイプ相性を無視'], ghost_immune: ['P4', 'ゴーストには無効'], ice_immune: ['P4', 'こおり関連の無効（要確認）'],
  stat_ignore: ['P4', '相手の能力変化を無視してダメージ'], use_opp_atk: ['P4', '相手の攻撃力で計算（イカサマ）'],
  use_def_for_spe: ['P4', '素早さにぼうぎょを使う（要確認）'], auto_select_phys_spec: ['P4', '物理/特殊を自動選択'],
  defense_swap_atk: ['P4', 'ダメージ計算をぼうぎょで行う（ボディプレス）'],
  fail_self_damage: ['P4', '失敗/外しで自分にダメージ'],

  // --- P5 命中後の追加効果（状態異常・能力変化・操作・回復） ---
  status_burn: ['P5', 'やけどにする'], status_freeze: ['P5', 'こおりにする'], status_paralysis: ['P5', 'まひにする'],
  status_poison: ['P5', 'どくにする'], status_badpoison: ['P5', 'もうどくにする'], status_sleep: ['P5', 'ねむりにする'],
  status_confuse: ['P5', 'こんらんにする'], status_random: ['P5', 'ランダムな状態異常'],
  status_burn_via_buff_check: ['P5', '能力上昇した相手をやけど ⚠付与誤りあり'],
  status_confuse_via_buff_check: ['P5', '能力上昇した相手をこんらん ⚠付与誤りあり'],
  opp_atk_down_1: ['P5', '相手のこうげき-1'], opp_atk_down_2: ['P5', '相手のこうげき-2'],
  opp_def_down_1: ['P5', '相手のぼうぎょ-1'], opp_def_down_2: ['P5', '相手のぼうぎょ-2'],
  opp_spa_down_1: ['P5', '相手のとくこう-1'], opp_spa_down_2: ['P5', '相手のとくこう-2'],
  opp_spd_down_1: ['P5', '相手のとくぼう-1'], opp_spd_down_2: ['P5', '相手のとくぼう-2'],
  opp_spe_down_1: ['P5', '相手のすばやさ-1'], opp_spe_down_2: ['P5', '相手のすばやさ-2'],
  opp_atk_up_2: ['P5', '相手のこうげき+2（いばる等のデメリット）'],
  opp_atk_down_2_via_buff_x2: ['P5', '⚠いばる系: 実際は相手こうげき+2'],
  self_atk_up_1: ['P5', '自分のこうげき+1'], self_atk_up_2: ['P5', '自分のこうげき+2'],
  self_def_up_1: ['P5', '自分のぼうぎょ+1'], self_def_up_2: ['P5', '自分のぼうぎょ+2'],
  self_spa_up_1: ['P5', '自分のとくこう+1'], self_spa_up_2: ['P5', '自分のとくこう+2'],
  self_spd_up_1: ['P5', '自分のとくぼう+1'], self_spd_up_2: ['P5', '自分のとくぼう+2'],
  self_spe_up_1: ['P5', '自分のすばやさ+1'], self_spe_up_2: ['P5', '自分のすばやさ+2'],
  self_atk_down_1: ['P5', '自分のこうげき-1'], self_def_down_1: ['P5', '自分のぼうぎょ-1'],
  self_spd_down_1: ['P5', '自分のとくぼう-1'], self_spe_down_1: ['P5', '自分のすばやさ-1'],
  self_spa_down_2: ['P5', '自分のとくこう-2（攻撃後）'],
  self_def_down_after: ['P5', '自分のぼうぎょ-（攻撃後）⚠self_def_down_1と重複ぎみ'],
  self_spa_down_2_after: ['P5', '自分のとくこう-2（攻撃後）⚠self_spa_down_2と重複'],
  self_spd_down_after: ['P5', '自分のとくぼう-（攻撃後）'], self_spe_down_after: ['P5', '自分のすばやさ-（攻撃後）'],
  buff_ally_atk: ['P5', '味方のこうげきを上げる'], buff_random_stat_2: ['P5', 'ランダムな能力+2'],
  self_status_cure_on_use: ['P5', '使うと自分の状態異常が治る'],
  trap_no_switch: ['P5', '相手を交代不可に（バインド/かげふみ）'],
  item_steal: ['P5', '相手の道具を奪う'], item_swap: ['P5', '道具を入れ替える（トリック）'],
  item_remove: ['P5', '相手の道具を失わせる（はたきおとす）'], item_berry_eat_steal: ['P5', '相手のきのみを食べる/奪う'],
  pp_reduce: ['P5', '相手のPPを減らす'], ability_copy_target: ['P5', '相手の特性をコピー'],
  stat_copy: ['P5', '相手の能力ランクをコピー'], stat_reset: ['P5', '能力ランクを元に戻す（くろいきり等）'],
  stat_swap_def_spdef: ['P5', 'ぼうぎょ↔とくぼう 入替'], stat_swap_atk_spa: ['P5', 'こうげき↔とくこう 入替'],
  type_change_target: ['P5', '相手のタイプを変更/追加'], type_change_self: ['P5', '自分のタイプを変更/喪失'],
  type_add: ['P5', '⚠中身がOHKO/接地化（タイプ追加でない・要再付与）'],
  mimic_last: ['P5', '相手の最後の技をコピー（ものまね）'],
  opp_status_cure_freeze: ['P5', '相手のこおりを治す（副作用）'],
  // 回復系（変化技の主効果として）
  recovery_1_2: ['P5', '最大HPの1/2回復'], recovery_simple: ['P5', '1/2回復 ⚠recovery_1_2の部分集合'],
  recovery_1_4_or_1_2: ['P5', '天候で回復量変化（あさのひざし等）'],
  recovery_status_only: ['P5', '状態異常を治す（⚠HP回復でない・cure_status相当）'],
  recovery_takuwaeru: ['P5', 'たくわえ回数でHP回復（のみこむ）'],
  recovery_swap_with_self: ['P5', '次に出すポケモンを全回復（⚠そうでん誤付与あり）'],
  recovery_drain_seed: ['P8', 'やどりぎのタネ（毎ターン吸収）'],
  recovery_per_turn: ['P8', '毎ターンHP回復（ねをはる/アクアリング）'],
  hp_cost_half: ['P5', 'HPを半分払う（みがわり/いのちがけ）'], hp_drain_self: ['P5', '自分のHPを使う（要確認）'],

  // --- P6 場・天気・設置・壁 ---
  field_grass: ['P6', 'グラスフィールド展開'], field_electric: ['P6', 'エレキフィールド展開'],
  field_psychic: ['P6', 'サイコフィールド展開'], field_misty: ['P6', 'ミストフィールド展開'],
  field_change: ['P6', 'フィールド展開（terrain_set 相当）'],
  field_remove: ['P6', 'フィールド破壊（terrain_remove 相当）'],
  remove_field: ['P6', '⚠設置物/バインド/まもる解除（地形でない・clear_hazards相当）'],
  weather_change: ['P6', '天気を変える'],
  setup_stealth_rock: ['P6', 'ステルスロック設置'], setup_spikes: ['P6', 'まきびし設置'],
  setup_toxic_spikes: ['P6', 'どくびし設置'], setup_sticky_web: ['P6', 'ねばねばネット設置'],
  wall_light: ['P6', 'ひかりのかべ/リフレクター（壁）'], wall_aurora: ['P6', 'オーロラベール（両壁）'],
  wall_mist: ['P6', 'しろいきり（能力低下を防ぐ）'], defense_remove_walls: ['P6', '相手の壁を破壊（かわらわり等）'],
  electric_float: ['P6', 'でんじふゆう（浮遊化）'],

  // --- P7 交代 ---
  self_switch: ['P7', '自分が交代する（とんぼがえり等）'], force_switch_opp: ['P7', '相手を強制交代（ふきとばし等）'],

  // --- P8 ターン終了・継続・遅延 ---
  self_faint: ['P8', '自分が瀕死になる（だいばくはつ等）'], future_attack: ['P8', '未来に攻撃（みらいよち）'],

  // --- META ---
  has_secondary_effect: ['META', '追加効果を持つ（広域フラグ・474/490技）'],
  other_misc: ['META', 'その他（専用タグ未整備の寄せ集め）'],
  ally_target_doubles_only: ['META', 'ダブル専用（味方対象）'],
};

// 名前ゆれ吸収: opp_acc_down_1b は使わない (誤記防止)
delete TAG_META.opp_acc_down_1b;

// ===== 集計 =====
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tagInfo = {}; // tag -> {count, moves:[{name,desc,prob}]}
for (const m of moves) {
  const effs = (m.battle_data && m.battle_data.effects) || [];
  const structProbs = effs.map(e => e.prob).filter(p => p != null);
  const descPct = ((m.description || '').match(/(\d+)\s*[%％]/) || [])[1];
  const prob = structProbs.length ? structProbs.join('/') + '%' : (descPct ? descPct + '%' : '');
  for (const t of (m.tags || [])) {
    (tagInfo[t] = tagInfo[t] || { count: 0, moves: [] });
    tagInfo[t].count++;
    tagInfo[t].moves.push({ name: m.name, desc: m.description || m.description_legacy || '', prob });
  }
}

// フェーズ毎にタグを束ねる
const byPhase = {}; PHASES.forEach(p => byPhase[p.id] = []);
for (const [tag, info] of Object.entries(tagInfo)) {
  const meta = TAG_META[tag];
  const phase = meta ? meta[0] : 'UNCLASSIFIED';
  const label = meta ? meta[1] : '';
  byPhase[phase].push({ tag, label, count: info.count, moves: info.moves });
}
for (const id in byPhase) byPhase[id].sort((a, b) => b.count - a.count);

// 確率レンジ表示
function probRange(mvs) {
  const nums = mvs.map(m => parseInt(m.prob)).filter(n => !isNaN(n));
  if (!nums.length) return '<span class="pmuted">—</span>';
  const mn = Math.min(...nums), mx = Math.max(...nums);
  return `<span class="prob">${mn === mx ? mn : mn + '〜' + mx}%</span>`;
}

// ===== HTML =====
let tabs = '', panels = '';
PHASES.forEach((p, i) => {
  const items = byPhase[p.id];
  const tagCount = items.length, moveCount = items.reduce((s, it) => s + it.count, 0);
  tabs += `<button class="tab${i === 0 ? ' active' : ''}" data-tab="${p.id}">${esc(p.title)} <span class="badge">${tagCount}</span></button>`;
  let body = items.map(it => {
    const warn = /⚠/.test(it.label) ? ' warn' : '';
    const lbl = it.label ? esc(it.label) : '<span class="pmuted">(ラベル未設定)</span>';
    const samples = it.moves.slice(0, 12).map(m =>
      `<div class="mv"><span class="mv-name">${esc(m.name)}</span>${m.prob ? `<span class="mv-prob">${esc(m.prob)}</span>` : ''}<span class="mv-desc">${esc(m.desc)}</span></div>`).join('');
    const more = it.moves.length > 12 ? `<div class="more">＋他 ${it.moves.length - 12} 技</div>` : '';
    return `<details class="tagcard${warn}"><summary>
        <span class="lbl">${lbl}</span>
        <code class="tg">${esc(it.tag)}</code>
        <span class="cnt">${it.count}技</span>
        ${probRange(it.moves)}
      </summary><div class="mvs">${samples}${more}</div></details>`;
  }).join('');
  if (!items.length) body = '<p class="pmuted">該当タグなし</p>';
  panels += `<section class="panel${i === 0 ? ' active' : ''}" id="panel-${p.id}">
      <p class="phase-desc">${esc(p.desc)} — タグ ${tagCount}種 / 延べ ${moveCount}技</p>${body}</section>`;
});

const unclassified = byPhase['UNCLASSIFIED'].length;
const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>わざタグ フェーズ別ビュー — PchamDB</title>
<style>
  :root{--orange:#FF7A00;--bg:#0f1320;--card:#1a2032;--ink:#e7ecf5;--muted:#8b97b0;--line:#2a3350}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-size:13px;line-height:1.5}
  header{padding:16px 22px;background:linear-gradient(135deg,#1a2238,#101626);border-bottom:2px solid var(--orange)}
  header h1{margin:0 0 4px;font-size:19px}
  header .sub{color:var(--muted);font-size:12px}
  .tabs{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:6px;padding:10px 18px;background:#0c1020;border-bottom:1px solid var(--line)}
  .tab{background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:7px 12px;cursor:pointer;font-size:12px}
  .tab:hover{border-color:var(--orange)}
  .tab.active{background:var(--orange);color:#1a1206;border-color:var(--orange);font-weight:700}
  .tab .badge{background:rgba(0,0,0,.18);border-radius:8px;padding:0 6px;font-size:11px;margin-left:3px}
  .tab.active .badge{background:rgba(0,0,0,.25)}
  .wrap{padding:14px 22px;max-width:1200px;margin:0 auto}
  .panel{display:none}.panel.active{display:block}
  .phase-desc{color:var(--muted);font-size:12px;margin:4px 0 14px;border-left:3px solid var(--orange);padding-left:8px}
  .tagcard{background:var(--card);border:1px solid var(--line);border-radius:8px;margin:7px 0;overflow:hidden}
  .tagcard.warn{border-color:#7a5a2c;background:#241d12}
  summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:9px 12px;flex-wrap:wrap}
  summary::-webkit-details-marker{display:none}
  summary:hover{background:#212a44}
  .lbl{font-weight:700;font-size:13px;min-width:240px;flex:1}
  .tg{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#9fd0ff;background:#26304d;border:1px solid #38507e;border-radius:8px;padding:1px 7px}
  .cnt{color:var(--muted);font-size:11px;white-space:nowrap}
  .prob{color:#ffce5a;font-weight:700;font-size:12px;white-space:nowrap}
  .pmuted{color:var(--muted)}
  .mvs{padding:4px 12px 12px;border-top:1px dashed var(--line)}
  .mv{display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #20283f;font-size:12px;align-items:baseline}
  .mv-name{font-weight:700;min-width:120px;white-space:nowrap}
  .mv-prob{color:#ffce5a;min-width:42px;text-align:right}
  .mv-desc{color:#c7d2ea}
  .more{color:var(--muted);font-size:11px;padding-top:6px}
  .legend{background:#15203a;border:1px solid var(--line);border-radius:8px;padding:10px 14px;color:#cdd8ef;font-size:12px;margin:10px 0}
  code.inl{background:#26304d;border-radius:4px;padding:0 4px;font-size:11px}
</style></head><body>
<header>
  <h1>⚔️ わざタグ フェーズ別ビュー</h1>
  <div class="sub">バトル1ターンの流れ順 ／ ${moves.length}技・タグ${Object.keys(tagInfo).length}種 ／ 自動生成 tools/_waza_phases.js</div>
</header>
<div class="tabs">${tabs}</div>
<div class="wrap">
  <div class="legend">
    各タグを<b>クリックで展開</b>すると該当技と説明文(徹底攻略由来)が出ます。<code class="inl">⚠</code>は名前と中身がズレ/重複/付与誤りの<b>要確認</b>タグ。
    <b>確率</b>はオレンジ表示(構造化prob優先・無ければ説明文から抽出)。
    ${unclassified ? `<br>❓<b>未分類タブに ${unclassified} タグ</b>あり — フェーズ割当の検討対象です。` : ''}
  </div>
  ${panels}
</div>
<script>
  const tabs=[...document.querySelectorAll('.tab')],panels=[...document.querySelectorAll('.panel')];
  tabs.forEach(t=>t.addEventListener('click',()=>{
    tabs.forEach(x=>x.classList.toggle('active',x===t));
    panels.forEach(p=>p.classList.toggle('active',p.id==='panel-'+t.dataset.tab));
    window.scrollTo({top:0});
  }));
</script>
</body></html>`;

fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'review/waza_phases.html'), html);

// サマリをstdoutへ
console.log('フェーズ別タグ数:');
PHASES.forEach(p => console.log(`  ${p.id} ${p.title}: ${byPhase[p.id].length}種`));
console.log('\n未分類タグ:', byPhase['UNCLASSIFIED'].map(x => x.tag).join(', ') || 'なし');
console.log('\nHTML出力: review/waza_phases.html');
