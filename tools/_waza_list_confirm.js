/* 確認用: 本番「わざリスト」(waza-list.html + waza_picker.js)と同じ見た目で、
 *   開発中の新説明文(_waza_compose.js の compose(m).text)を効果列に出して目視確認する静的HTML。
 *   本番ファイル(waza-list.html / waza_picker.js / pokechan_data.js)は一切触らない。
 *   - 効果列  = compose(m).text(新生成)。右隣に「ヤック」= description_legacy(お手本)を併置。
 *   - タグ列  = waza_picker.js の getMoveFilterTags をそのまま移植(text/cls 同一)。
 *   - 優先列  = ★ battle_data.priority(構造データ)を使う。本番はテキスト抽出だが新文には優先度の語が無く壊れるため。
 * 実行: node tools/_waza_list_confirm.js  → review/waza_list_confirm.html */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { compose, map } = require('./_waza_compose.js');

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// === 本番 waza_picker.js から移植したヘルパ(確認用は日本語固定フォールバック=英語キーを出さない) ===
const typeColors = { "ノーマル": "#A8A878", "ほのお": "#F08030", "みず": "#6890F0", "でんき": "#F8D030", "くさ": "#78C850", "こおり": "#98D8D8", "かくとう": "#C03028", "どく": "#A040A0", "じめん": "#E0C068", "ひこう": "#A890F0", "エスパー": "#F85888", "むし": "#A8B820", "いわ": "#B8A038", "ゴースト": "#705898", "ドラゴン": "#7038F8", "あく": "#705848", "はがね": "#B8B8D0", "フェアリー": "#EE99AC" };

// 効果文(legacy)から発動確率を抽出 — 本番 extractProbability と同一ロジック。
function extractProbability(desc) {
  if (!desc) return null;
  const matches = [...desc.matchAll(/(\d+)\s*%の確率/g)];
  if (matches.length === 0) return null;
  const probs = matches.map(m => parseInt(m[1])).filter(n => n >= 0 && n <= 100);
  return probs.length > 0 ? Math.max(...probs) : null;
}

// ★本番 waza_picker.js の getMoveFilterTags をそのまま移植(text / cls を同一に)。
//   prio は本番では m.priority(=テキスト抽出値)。確認用では battle_data.priority を渡す(下の build で m.priority に格納)。
function getMoveFilterTags(m) {
  const out = [];
  const bd = m.battle_data || {};
  const flags = m.flags || {};
  const prio = (typeof m.priority === 'number') ? m.priority : 0;

  // 技フラグ
  if (flags.punch)          out.push({cls:'tag-flag',  text:'👊 パンチ'});
  if (flags.sound)          out.push({cls:'tag-flag',  text:'🔊 音'});
  if (flags.ball)           out.push({cls:'tag-flag',  text:'🔵 弾'});
  if (flags.pulse)          out.push({cls:'tag-flag',  text:'〰️ 波動'});
  if (flags.ohko)           out.push({cls:'tag-flag',  text:'💀 一撃必殺'});
  if (flags.charge)         out.push({cls:'tag-flag',  text:'⏳ 溜め'});
  if (flags.recharge)       out.push({cls:'tag-flag',  text:'🔁 2T動けない'});
  if (flags.change_type)    out.push({cls:'tag-flag',  text:'🎭 タイプ変更'});
  if (flags.change_ability) out.push({cls:'tag-flag',  text:'✨ 特性変更'});
  if (flags.change_item)    out.push({cls:'tag-flag',  text:'🎁 道具変更'});

  // 副作用 (状態異常 / ひるみ)
  const STATUS_ICON = {'まひ':'⚡','やけど':'🔥','こおり':'❄️','ねむり':'💤','どく':'☠️','もうどく':'💀','こんらん':'🌀','メロメロ':'💕'};
  for (const e of (bd.effects || [])) {
    const tgt = e.target === 'self' ? '(自)' : '';
    const p = (e.prob != null && e.prob < 100) ? `${e.prob}%` : ''; // ★日本語kind(ひるみ/状態付与)に対応(英語kindバグ修正・2026-06-07)
    if (e.kind === 'ひるみ' || (e.kind === '状態付与' && e.value === 'ひるみ')) out.push({cls:'tag-status', text:`😵 ${p}ひるみ${tgt}`});
    else if (e.kind === '状態付与') {
      // ★英語prose value(うちおとす等の未構造プレースホルダ)はタグに出さない=長大化/英語漏れ/列ズレ防止。
      //   元データはEffects列で確認できる。park: SSOTの英語残(うちおとす/むしくい)は別途ちゃんと構造化する。
      if (/[A-Za-z]/.test(String(e.value || ''))) continue;
      out.push({cls:'tag-status', text:`${STATUS_ICON[e.value]||'🩻'} ${p}${e.value}${tgt}`});
    }
  }

  // ランク変動
  const STAT_JP = {atk:'攻',def:'防',spa:'特攻',spd:'特防',spe:'速',acc:'命中',eva:'回避'};
  const TGT_JP = {self:'自',ally:'味',opp:'相'};
  for (const r of (bd.rank_changes || [])) {
    const sign = r.delta > 0 ? '+' : '';
    const probTxt = r.prob < 100 ? `${r.prob}% ` : '';
    out.push({cls:'tag-rank', text:`📊 ${probTxt}${TGT_JP[r.target]||'?'}${STAT_JP[r.stat]||r.stat}${sign}${r.delta}`});
  }
  // ★rank_changes が無い技は effects の能力ランク変化からタグを作る(2026-06-17 阿部さん・はらだいこ/ソウルビート等の取りこぼし)
  if (!Array.isArray(bd.rank_changes) || bd.rank_changes.length === 0) {
    const STAT_EN_JP = {attack:'攻', defense:'防', special_attack:'特攻', special_defense:'特防', speed:'速', accuracy:'命中', evasion:'回避', all:'全能力'};
    const TGT_EN_JP = {self:'自', opponent:'相', team:'味', ally:'味', all_opponents:'相全', all_but_self:'他全', party:'手', incoming:'次味', all:'場全'};
    for (const e of (bd.effects || [])) {
      if (e.kind !== '能力ランク変化') continue;
      const tgt = TGT_EN_JP[e.target] || '?';
      const sts = Array.isArray(e.stats) ? e.stats : (e.stat ? [e.stat] : []);
      const probTxt = (e.prob != null && e.prob < 100) ? `${e.prob}% ` : '';
      if (e.to_max) { // はらだいこ=自攻が最大まで上がる
        for (const s of sts) out.push({cls:'tag-rank', text:`📊 ${probTxt}${tgt}${STAT_EN_JP[s] || s}最大`});
      } else if (e.stages) {
        const sign = e.stages > 0 ? '+' : '';
        if (e.stat_choice === 'random_one_of') { // つぼをつく等
          out.push({cls:'tag-rank', text:`📊 ${probTxt}${tgt}ランダム${sign}${e.stages}`});
        } else {
          for (const s of sts) out.push({cls:'tag-rank', text:`📊 ${probTxt}${tgt}${STAT_EN_JP[s] || s}${sign}${e.stages}`});
        }
      }
    }
  }

  // 急所
  if (bd.must_crit)         out.push({cls:'tag-crit', text:'💥 必中急所'});
  else if (bd.crit_stage >= 1) out.push({cls:'tag-crit', text:`🎯 急所+${bd.crit_stage}`});
  if (bd.must_hit)          out.push({cls:'tag-crit', text:'🎯 必中'});
  for (const c of (bd.crit_changes || [])) {
    const tg = c.target === 'self' ? '自' : c.target === 'ally' ? '味' : '相';
    out.push({cls:'tag-crit', text:`🎯 ${tg}急所+${c.delta}`});
  }

  // 連続技 / あばれ状態 (別カテゴリ)
  if (bd.multi_hit === 'thrash') {
    out.push({cls:'tag-misc', text:'🌀 あばれ状態(2-3T)'});
  } else if (bd.multi_hit) {
    out.push({cls:'tag-misc', text:`⚡ 連続${bd.multi_hit}回`});
  }

  // 反動 / 失敗ダメージ
  if (bd.recoil === 'on_miss') {
    out.push({cls:'tag-recoil', text:`💔 失敗ダメージ`});
  } else if (bd.recoil) {
    out.push({cls:'tag-recoil', text:`💢 反動${bd.recoil}`});
  }
  if (bd.drain) {
    const lbl = bd.drain === 'seed' ? 'やどりぎ式' : bd.drain;
    out.push({cls:'tag-drain', text:`🩸 ダメージ回復${lbl}`});
  }
  if (bd.recovery && bd.recovery !== 'status_only') {
    const RECOV_LBL = {'1/2':'1/2','weather':'天候依存','per_turn':'毎ターン','swap':'自身犠牲','takuwaeru':'たくわえる連動'};
    out.push({cls:'tag-recov', text:`💚 回復(${RECOV_LBL[bd.recovery]||bd.recovery})`});
  }

  // 優先度
  if (prio > 0) out.push({cls:'tag-prio-up',   text:`⚡ 先制+${prio}`});
  if (prio < 0) out.push({cls:'tag-prio-down', text:`🐢 後攻${prio}`});

  // ため / 再不可
  if (bd.charge) {
    const CHARGE_LBL = {'normal':'2ターン目に攻撃','invulnerable':'半無敵化','with_stat_up':'1T能力UP+2T攻撃'};
    out.push({cls:'tag-charge', text:`⏳ ${CHARGE_LBL[bd.charge]||bd.charge}`});
  }
  if (bd.charge_skip_in_weather) out.push({cls:'tag-charge', text:'☀️ 天候で省略'});
  if (bd.recharge)               out.push({cls:'tag-charge', text:'🔁 使用後不動'});

  // 場・設置・交代系
  if (bd.weather_set) {
    const W = {'sunny':'☀️ 晴れに','rain':'🌧️ あめに','snow':'❄️ ゆきに','sand':'🌪️ すなあらしに'};
    out.push({cls:'tag-field', text:W[bd.weather_set]||bd.weather_set});
  }
  if (bd.field_set) {
    const F = {'electric':'⚡ エレキフィールド','grass':'🌿 グラスフィールド','psychic':'🔮 サイコフィールド','misty':'🌫️ ミストフィールド'};
    out.push({cls:'tag-field', text:F[bd.field_set]||bd.field_set});
  }
  if (bd.hazard_set) {
    const H = {'spikes':'📌 まきびし','toxic_spikes':'☠️ どくびし','stealth_rock':'🪨 ステルスロック','sticky_web':'🕸️ ねばねばネット'};
    out.push({cls:'tag-hazard', text:H[bd.hazard_set]||bd.hazard_set});
  }
  if (bd.tailwind)       out.push({cls:'tag-field', text:'🌬️ 追い風'});
  if (bd.gravity)        out.push({cls:'tag-field', text:'🌌 重力'});
  if (bd.protect_wide)   out.push({cls:'tag-field', text:'🚧 ワイドガード'});
  if (bd.protect_fast)   out.push({cls:'tag-field', text:'🚧 ファストガード'});
  if (bd.remove_hazards) out.push({cls:'tag-field', text:'🧹 設置解除'});
  if (bd.field_remove)   out.push({cls:'tag-field', text:'🧹 フィールド破壊'});

  // 交代系
  if (bd.bind)             out.push({cls:'tag-switch', text:'🔗 バインド'});
  if (bd.force_switch_opp) out.push({cls:'tag-switch', text:'🔄 相手交代'});
  if (bd.self_switch)      out.push({cls:'tag-switch', text:'↩️ 自分交代'});
  if (bd.trap_no_switch)   out.push({cls:'tag-switch', text:'🪤 交代不可'});

  // 瀕死技
  if (bd.self_faint)       out.push({cls:'tag-faint', text:'💀 瀕死技'});

  // 壁
  if (bd.screen) {
    const S = {'reflect':'リフレクター','light_screen':'ひかりのかべ','aurora_veil':'オーロラベール','safeguard':'しんぴのまもり'};
    out.push({cls:'tag-screen', text:`🛡️ ${S[bd.screen]||bd.screen}`});
  }
  // ルーム
  if (bd.room) {
    const R = {'trick_room':'トリックルーム','wonder_room':'ワンダールーム','magic_room':'マジックルーム'};
    out.push({cls:'tag-room', text:`🌀 ${R[bd.room]||bd.room}`});
  }
  // 技封じ (効果別に簡潔表示)
  if (bd.move_block) {
    const MB = {
      'disable':     '直前技封じ',
      'encore':      '直前技繰返強制',
      'taunt':       '変化技封じ',
      'torment':     '同技連続封じ',
      'heal_block':  '回復封じ',
      'sound_block': '音技封じ',
    };
    out.push({cls:'tag-block', text:`🔒 ${MB[bd.move_block]||bd.move_block}`});
  }
  // サポート
  if (bd.support)          out.push({cls:'tag-support', text:'🤝 サポートW'});
  // ランク操作
  if (bd.rank_op) {
    const RO = {'copy':'ランクコピー','swap_atk_spa':'攻特攻入替','swap_def_spd':'防特防入替','swap_atk_def_self':'自攻防入替'};
    out.push({cls:'tag-rankop', text:`🔄 ${RO[bd.rank_op]||bd.rank_op}`});
  }
  // 解除系
  if (Array.isArray(bd.unlock)) {
    const UN = {'screen':'壁破壊','protect':'防御貫通','rank_reset_all':'ランクリセット(全)','rank_reset_opp':'ランクリセット(敵)'};
    bd.unlock.forEach(u => out.push({cls:'tag-unlock', text:`🧹 ${UN[u]||u}`}));
  }

  // 状態異常回復
  if (Array.isArray(bd.cure_status)) {
    const TGT_CURE = {'self':'自','ally':'味','opp':'相','next_ally':'次味'};
    bd.cure_status.forEach(c => {
      const tg = TGT_CURE[c.target] || c.target;
      const val = c.value === 'all' ? '全状態異常' : c.value;
      out.push({cls:'tag-cure', text:`💊 ${tg}${val}治す`});
    });
  }

  // みがわり/防御技関連 (独立タグ)
  if (bd.substitute_pierce) out.push({cls:'tag-other', text:'👻 みがわり貫通'});
  if (bd.substitute_remove) out.push({cls:'tag-other', text:'🪬 みがわり解除'});
  if (bd.protect_pierce)    out.push({cls:'tag-other', text:'🛡️ まもる貫通'});

  // ★effects kind別タグ(2026-06-17 阿部さん): 略・アレンジを避け、データ/legacy通りの正確な言葉でタグ化。
  //   既存タグ(bd.*由来)と内容重複しないよう、emitWhenを絞った。1技に同種タグが重複しないよう Set で去重。
  const seen = new Set(out.map(t => t.text));
  const push = (cls, text) => { if (!seen.has(text)) { out.push({cls, text}); seen.add(text); } };
  for (const e of (bd.effects || [])) {
    const k = e.kind;
    const ct = e.condition && e.condition.type;
    if (k === '威力倍率') {
      if (e.multiplier >= 2 && /target_status|user_status|status_condition|user_has_status|target_has_status/.test(ct||'')) push('tag-misc', '🤢 相手の状態異常で威力2倍');
      if (/field/.test(ct||'')) push('tag-field', '🌿 フィールドで威力変化');
      if (ct === 'target_minimized') push('tag-misc', '🔻 「ちいさくなる」相手に威力2倍');
      if (ct === 'user_has_no_held_item') push('tag-misc', '🎒 持ち物なしで威力2倍'); // アクロバット
      if (/previous_turn_move_failed|failed_to_act_last_turn/.test(ct||'')) push('tag-misc', '😤 前のターン失敗で威力2倍'); // じだんだ/やけっぱち
      if (ct === 'user_stat_lowered_this_turn') push('tag-misc', '😤 そのターン能力下げられたら威力2倍'); // うっぷんばらし
      if (/target_already_damaged/.test(ct||'')) push('tag-misc', '💢 相手が同ターンに先にダメージ受けたら威力2倍'); // たたりめ系
    }
    if (k === '必中' && ct === 'target_minimized') push('tag-misc', '🎯 「ちいさくなる」中の相手に必ず命中');
    if (k === '連続攻撃') {
      if (e.hits_by != null) push('tag-misc', '👥 手持ちの数だけ攻撃');
      if (e.stop_on_miss === true && !Array.isArray(e.power_per_hit)) push('tag-misc', '🎲 外れるまで連続');
      if (Array.isArray(e.power_per_hit)) push('tag-misc', '📈 当たるたび威力上昇');
    }
    if (k === '半無敵命中') push('tag-misc', e.damage_multiplier === 2 ? '💥 半無敵中の相手に当てて威力2倍' : '🌪️ 半無敵中の相手に当てられる');
    if (k === '威力可変') {
      if (e.basis === 'target_weight' || (Array.isArray(e.tiers) && e.tiers[0] && e.tiers[0].max_kg != null) || (Array.isArray(e.weight_thresholds))) push('tag-misc', '⚖️ 相手の重さで威力変化');
      if (e.relation === 'lower_hp_higher_power') push('tag-misc', '💢 自分のHPが少ないほど威力上昇');
      if (e.formula && /current_HP\s*\/\s*[\w]*max_HP|currentHP\s*\/\s*\w*maxHP/i.test(e.formula)) push('tag-misc', '📉 自分のHPが多いほど威力上昇'); // ふんか・しおふき・ハードプレス
      if (e.basis === 'user_speed_over_target_speed') push('tag-misc', '⚡ 相手とのすばやさ差で威力変化'); // エレキボール
      if (e.basis === 'user_positive_stat_stages' || e.per_stage) push('tag-misc', '📈 自分の能力ランク段階で威力上昇'); // アシストパワー
      if (e.multiplier === 2 && /failed_to_act|previous_turn_move_failed/.test(ct||'')) push('tag-misc', '😤 前のターン失敗で威力2倍'); // やけっぱち
    }
    if (k === '倍返し') {
      const mu = e.multiplier || 2;
      push('tag-recoil', `🔄 受けたダメージの${mu}倍で返す`);
    }
    if (k === '固定ダメージ') {
      if (e.amount === '自分のレベル分') push('tag-misc', '🔢 自分のレベル分のダメージ');
      else if (typeof e.amount === 'string' && /残りHPの半分/.test(e.amount)) push('tag-misc', '✂️ 相手の残りHPの半分のダメージ');
      else if (typeof e.amount === 'string' && /HPから自分の残りHPを引/.test(e.amount)) push('tag-misc', '⚖️ 相手と自分のHP差のダメージ');
    }
    if (k === '回復' && e.target === 'team') push('tag-recov', '💚 自分と味方を回復');
    if (k === '状態異常回復' && e.target === 'self' && e.value === 'こおり' && (e.usable_while_frozen || /こおっていても/.test(e.note||''))) push('tag-cure', '❄️ 「こおり」中でも使える');
    if (k === '状態異常回復' && /opponent|all_opponents|all_but_self/.test(e.target || '') && e.value === 'こおり') push('tag-cure', '🫧 相手の「こおり」状態を治す');
    if (k === 'HPが減る') {
      if (e.always_pays_even_if_blocked === true) push('tag-misc', '⚠️ 防がれても自分のHPが減る');
      else if (Math.abs(e.fraction - 0.5) < 0.01) push('tag-drain', '💸 自分のHPが最大HPの半分減る');
      else if (Math.abs(e.fraction - 0.25) < 0.01) push('tag-drain', '💸 自分のHPが最大HPの1/4減る');
      else if (Math.abs(e.fraction - 0.3333) < 0.02) push('tag-drain', '💸 自分のHPが最大HPの1/3減る');
    }
    if (k === 'みがわり設置') push('tag-support', '🪆 「みがわり」を作る');
    if (k === 'PP減少') push('tag-other', '💢 相手の技のPPを減らす');
    if (k === 'みちづれ') push('tag-faint', '💀 みちづれ');
    if (k === 'ロックオン') push('tag-flag', '🎯 次のターン必ず命中');
    if (k === 'メロメロ付与') push('tag-status', '💕 「メロメロ」状態にする');
    if (k === 'ランダム技') push('tag-misc', '🎲 自分の覚えている技からランダム');
    if (k === 'いたみわけ') push('tag-recov', '🤝 自分と相手のHPを半分ずつに分ける');
    if (k === '自分交代' && Array.isArray(e.pass) && e.pass.length > 0) push('tag-switch', '🎽 能力ランクを引き継いで交代');
    if (k === '遅延攻撃') push('tag-charge', '⏳ 2ターン後に攻撃が当たる');
    if (k === 'やけど低下無視') push('tag-misc', '🔥 「やけど」のこうげき低下を無視');
    if (k === '持ち物交換') push('tag-support', '🔄 自分と相手の持ち物を入れかえる');
    if (k === '特性上書き' && e.target === 'opponent' && e.value && e.value !== '自分の特性') push('tag-misc', '🔀 相手の特性を上書き');
    if (k === '特性上書き' && (e.source === 'opponent_ability' || e.value === '自分の特性')) push('tag-misc', '🪞 相手の特性をコピー');
    if (k === '持ち物排除' && (e.target === 'all' || e.target === 'all_but_self')) push('tag-misc', '🗑️ 場の全員の持ち物を使えなくする');
    if (k === 'ふういん') push('tag-block', '🔒 自分も知っている技を相手は使えなくなる');
    if (k === '木の実奪取食') push('tag-misc', '🍒 相手の「きのみ」を奪って食べる');
    if (k === '条件威力倍率') {
      if (/moves_after/.test(ct||'')) push('tag-misc', '🔄 後攻で使うと威力2倍');
      else if (/already_damaged/.test(ct||'')) push('tag-misc', '💢 相手が同ターンに先にダメージ受けたら威力2倍');
      else if (e.prob != null) push('tag-misc', '🎲 ' + e.prob + '%の確率で威力2倍');
    }
    if (k === 'なげつける') push('tag-misc', '🎁 持っている道具を投げて攻撃');
    if (k === '能力入替' && Array.isArray(e.stats) && e.stats.length === 1 && e.stats[0] === 'speed') push('tag-rankop', '🔄 自分と相手のすばやさを入れかえ');
    if (k === '特性無効化') push('tag-other', '🚫 相手の特性を無効にする');
    if (k === '直前技模倣') push('tag-misc', '🪞 直前にだれかが使った技をまねる');
    if (k === '木の実強制') push('tag-misc', e.target === 'opponent' ? '🍃 相手の「きのみ」を奪って使う' : '🍃 持っている「きのみ」をすぐに使う');
    if (k === '実数値折半') {
      const sts = Array.isArray(e.stats) ? e.stats : (e.stat ? [e.stat] : []);
      if (sts.some(s => /defense/.test(s))) push('tag-rankop', '🛡️ 自分と相手のぼうぎょ・とくぼうを平均化');
      if (sts.some(s => /attack/.test(s))) push('tag-rankop', '⚔️ 自分と相手のこうげき・とくこうを平均化');
    }
    if (k === '別防御参照ダメージ') push('tag-misc', '🛡️ 特殊技だが相手のぼうぎょで計算');
    if (k === 'タイプ上書き') {
      if (e.value === 'copy_target_current_types') push('tag-misc', '🪞 自分のタイプを相手と同じにする');
      else if (e.value && !/^[A-Za-z_]+$/.test(String(e.value))) push('tag-misc', `🎭 相手のタイプを「${e.value}」だけに変える`);
    }
    if (k === '相手能力ダメージ') push('tag-misc', '↩️ 相手のこうげきの高さでダメージ計算');
    if (k === 'ランク無視') push('tag-misc', '🔓 相手の能力ランク変化を無視して攻撃');
    if (k === '技タイプ追加') push('tag-misc', '🔀 この技にタイプを追加');
    if (k === 'タイプ追加') push('tag-other', `🏷️ 相手に「${e.value}」タイプを追加`);
    if (k === '技強制再使用') push('tag-misc', '🔁 相手に直前の技をもう一度使わせる');
    if (k === 'ランク数威力加算') push('tag-misc', '📈 自分の能力ランクが上がっているほど威力上昇');
    if (k === 'タイプ除去') push('tag-other', `💨 自分の「${e.value}」タイプがなくなる`);
    if (k === '別能力ダメージ') push('tag-misc', '🛡️ 自分のぼうぎょでダメージ計算');
    if (k === '対象範囲変更') push('tag-misc', '🌐 条件で相手全体に当たるようになる');
    if (k === '相手持ち物威力') push('tag-misc', '🎒 相手の持ち物を使って攻撃');
    if (k === '威力段階増加') push('tag-misc', '⚰️ ひんしになった味方が多いほど威力上昇');
    if (k === '次ターン使用不可') push('tag-recoil', '🚫 次のターン使えない');
    if (k === 'へんしん') push('tag-misc', '✨ 相手のすがた・能力・技をコピー');
  }
  // ★requires(使用条件)からタグ(ゲップ/とっておき/いびき等)
  for (const r of (bd.requires || [])) {
    if (r.type === 'user_has_eaten_berry') push('tag-misc', '🍒 「きのみ」を食べた後だけ使える');
    if (r.type === 'all_other_known_moves_used') push('tag-misc', '🎴 他の技を全部使うと使える');
    if (r.type === 'self_status') push('tag-status', `💤 自分が「${r.value}」状態の時だけ使える`);
    if (r.type === 'weather') push('tag-field', `🌤 天気が「${r.value}」の時だけ使える`);
    if (r.type === 'first_turn_after_switch_in') push('tag-misc', '⏮ 出てきた最初のターンだけ使える');
  }

  return out;
}

// 分類 → cls-badge クラス
const clsBadge = c => c === '物理' ? 'cls-phys' : c === '特殊' ? 'cls-spec' : 'cls-stat';
const numCell = v => (v == null || v === '') ? '<span style="color:#BBB">—</span>' : String(v);

// === 行の組み立て ===
// フラグ列(プロト準拠: パンチ/音 等のアイコン。change_*は効果側=タグに出るのでここでは出さない)
const FLAGCOL = [['punch', '👊パンチ'], ['sound', '🔊音'], ['charge', '⏳ため'], ['recharge', '🔁2T'], ['drain', '🩸吸収'], ['pulse', '〰️波動'], ['ball', '🔵弾'], ['ohko', '💀一撃'], ['powder', '🌸こな']];
const flagCell = f => { const xs = FLAGCOL.filter(([k]) => f[k]).map(([, v]) => v); return xs.length ? xs.join(' ') : '<span style="color:#BBB">—</span>'; };

function buildRow(m) {
  const bd = m.battle_data || {};
  // ★優先度は構造データを使う(本番はテキスト抽出だが新文には優先度の語が無い)
  const prio = (typeof bd.priority === 'number') ? bd.priority : 0;
  // getMoveFilterTags は m.priority を見るので、構造値を一時的に渡す
  const tagSrc = Object.assign({}, m, { priority: prio });
  const tags = getMoveFilterTags(tagSrc);

  const { text, holes } = compose(m);
  const legacy = m.description_legacy || '';
  const prob = extractProbability(legacy);

  const learners = m.learners ? m.learners.length : 0;
  const color = typeColors[m.type] || '#999';
  const cls = m.category; // 物理/特殊/変化
  const cat = m.subcategory || m.category;
  const contact = m.contact ? '接○' : '接×';
  const guard = m.protect ? '守○' : '守×';
  const isDouble = m.mode === 'ダブル';

  let prioTd;
  if (prio > 0) prioTd = `<td class="col-prio prio-pos">+${prio}</td>`;
  else if (prio < 0) prioTd = `<td class="col-prio prio-neg">${prio}</td>`;
  else prioTd = `<td class="col-prio prio-zero">—</td>`;

  // ★技単位の完結バッジ(2026-06-07): 穴ゼロ=✅完結(再チェック不要)/ 穴あり=⚠残りN穴。あと1穴は黄色で「もう少し」。
  const nEff = ((m.battle_data || {}).effects || []).length;
  const status = holes.length === 0
    ? `<span class="mv-st done">${nEff ? '✅完結' : '✅効果なし'}</span>`
    : `<span class="mv-st ${holes.length === 1 ? 'near' : 'hole'}">⚠残り${holes.length}穴</span>`;
  const holeDetail = holes.length ? `<div class="hole">未対応: ${esc(holes.join('・'))}</div>` : '';
  const effHtml = status + (text ? ' ' + esc(text) : ' <span class="gen-none">(生成なし)</span>') + holeDetail;

  // 並び順(2026-06-07 阿部さん指定=プロト踏襲): 習得/わざ名/優先/フラグ/タイプ/分類/威力/命中/PP/接触/守貫/対象/カテゴリ/効果/タグ/ヤック
  // ★2026-06-17: タグフィルター用に data-tags 属性に全タグテキストを並べる(JS側でこれを検索)
  const dataTags = tags.map(t => t.text).join('|');
  return `<tr data-tags="${esc(dataTags)}">
  <td class="col-learners">${learners > 0 ? learners : '—'}</td>
  <td class="col-name"><span class="name-cell">${esc(m.name)}</span></td>
  ${prioTd}
  <td class="col-flag">${flagCell(m.flags || {})}</td>
  <td class="col-type"><span class="type-cell" style="background:${color}">${esc(m.type)}</span></td>
  <td class="col-class"><span class="cls-badge ${clsBadge(cls)}">${esc(cls)}</span></td>
  <td class="col-power num-cell">${numCell(m.power)}</td>
  <td class="col-acc num-cell">${numCell(m.accuracy)}</td>
  <td class="col-pp num-cell">${numCell(m.pp)}</td>
  <td class="col-contact">${contact}</td>
  <td class="col-guard">${guard}</td>
  <td class="col-target">${esc(m.target)}</td>
  <td class="col-cat"><span class="cat-cell">${esc(cat)}</span></td>
  <td class="col-effsrc">${(bd.effects || []).map(e => esc(JSON.stringify(e))).join('\n') || '—'}</td>
  <td class="col-effect effect-cell">${effHtml}</td>
  <td class="col-tags">${tags.map(t => `<span class="mw-tag ${t.cls}">${esc(t.text)}</span>`).join('')}</td>
  <td class="col-yakkun">${esc(legacy)}</td>
</tr>`;
}

const moves = Object.values(map);

// ===== カテゴリ(効果kind)別セクション(2026-06-07 阿部さん: 急所/ひるみ…とチェックする順に区切る・重複OK) =====
// 作業した順(開通順)。HANDLED=テンプレ対応済(_waza_compose.js の clause が喋れるkind)。両者は一致させる(必中=2026-06-07 追加)。
const KIND_ORDER = ['急所率上昇', 'ひるみ', '威力可変', '能力ランク変化', '状態付与', '拘束', '反動', '威力倍率', '自分瀕死', '回復', 'HPが減る', '固定ダメージ', '継続削り', '連続攻撃', '必中'];
const HANDLED = new Set(KIND_ORDER);
const NOEFF = '（追加効果なし）';
const byKind = new Map();
for (const m of moves) {
  const kinds = [...new Set(((m.battle_data || {}).effects || []).map(e => e.kind))];
  for (const k of (kinds.length ? kinds : [NOEFF])) { if (!byKind.has(k)) byKind.set(k, []); byKind.get(k).push(m); }
}
const restKinds = [...byKind.keys()].filter(k => k !== NOEFF && !KIND_ORDER.includes(k)).sort((a, b) => byKind.get(b).length - byKind.get(a).length);
const ordered = [...KIND_ORDER.filter(k => byKind.has(k)), ...restKinds, ...(byKind.has(NOEFF) ? [NOEFF] : [])];

const THEAD = `<thead><tr>
  <th class="col-learners">習得</th><th class="col-name">わざ名</th><th class="col-prio">優先</th><th class="col-flag">フラグ</th>
  <th class="col-type">タイプ</th><th class="col-class">分類</th><th class="col-power">威力</th><th class="col-acc">命中</th><th class="col-pp">PP</th>
  <th class="col-contact">接触</th><th class="col-guard">守貫</th><th class="col-target">対象</th><th class="col-cat">カテゴリ</th>
  <th class="col-effsrc">Effects(元データ)</th><th class="col-effect">効果</th><th class="col-tags">タグ</th><th class="col-yakkun">ヤック</th>
</tr></thead>`;

// ★人の耳チェック(確認OK→行を非表示)。verify_report と同仕様・進捗localStorage共有。
//   buildRow/THEAD の export は壊さない=このページ専用に「確認」列を足したヘッダ/セルを作る。
const THEAD_CHK = THEAD.replace('</tr></thead>', '<th class="col-chk">確認</th></tr></thead>');
const CHKCELL = '<td class="col-chk"><label class="rowchk-l"><input type="checkbox" class="rowchk">確認OK</label></td>';

// ★状態モデル(セッションをまたぐ正本): 「作る(ビルド)」と「確定(阿部さんの耳でOK)」は別物。
//   Claudeは★→✓に上げない → CONFIRMED への昇格は阿部さんだけが行う(下のSetを編集)。出典=HANDOFF §2「確定した判断」。
const CONFIRMED = new Set(['急所率上昇', '能力ランク変化', '必中']); // ✓確定(阿部さんの耳でOK済)
const WORKING = new Set(['状態異常回復']);                           // 🔨 いま開通作業中(任意・複数可)
// 状態の優先順: 作業中 > 確定 > 確認待ち(ビルド済だが耳未確定) > これから(未ビルド)
function kindState(k) {
  if (k === NOEFF) return 'noeff';
  if (WORKING.has(k)) return 'working';
  if (CONFIRMED.has(k)) return 'done';
  if (HANDLED.has(k)) return 'review';
  return 'todo';
}
const SEC_BADGE = { done: '<span class="sec-ok">✓ 確定</span>', review: '<span class="sec-rv">🕓 確認待ち</span>', working: '<span class="sec-wk">🔨 作業中</span>', todo: '<span class="sec-ng">⚠ これから</span>', noeff: '' };
// ★セクション内の並び替え(2026-06-17 阿部さん): ①分類で分ける(変化 / 物理 / 特殊)②効果の文言が似たものを隣に。
//   似た文=同じ言い回しで始まる→正規化(先頭の「N%の確率で」を外し・数字を#に)した署名でソート=機械(数値)が違うだけの同型をまとめる。
const _composeCache = new Map();
const _txt = m => { if (!_composeCache.has(m)) _composeCache.set(m, compose(m).text || ''); return _composeCache.get(m); };
const CATBUCKET = c => c === '変化' ? 0 : c === '物理' ? 1 : 2; // 変化を先に固める→物理→特殊
const sortSig = m => _txt(m).replace(/^\d+%の確率で/, '').replace(/\d+/g, '#'); // 似た効果の署名(確率・数値の違いを無視)
const sortMoves = arr => [...arr].sort((a, b) =>
  CATBUCKET(a.category) - CATBUCKET(b.category) ||
  sortSig(a).localeCompare(sortSig(b), 'ja') ||
  _txt(a).localeCompare(_txt(b), 'ja') ||
  a.name.localeCompare(b.name, 'ja'));

const sections = ordered.map((k, i) => {
  const ms = sortMoves(byKind.get(k));
  const badge = SEC_BADGE[kindState(k)];
  return `<section class="sec" id="sec-${i}"><h2 class="sec-h"><span class="caret">▾</span>【${esc(k)}】<span class="sec-n">${ms.length}技</span>${badge}<span class="sec-prog"></span><button class="sec-done">✓全部チェックして畳む</button></h2>
  <div class="tbl-wrap"><table>${THEAD_CHK}<tbody>${ms.map(m => buildRow(m).replace('</tr>', CHKCELL + '</tr>')).join('\n')}</tbody></table></div></section>`;
}).join('\n');

// ★グループ一覧(目次)= 上部にチップ表示・クリックでジャンプ(検索が説明文の語を拾う問題の回避)。
//   「✓対応済(作業した順)」と「⚠これから(技数の多い順)」に分け、進捗(どこまで終わったか)を一目で。
let voicedMoves = 0, completeMoves = 0;
const oneHoleByKind = new Map(); // 残り1穴の技を「その穴のkind」でまとめる(=そのkindを開通すると何技が完結するか)
for (const m of moves) {
  const { text, holes } = compose(m);
  if (text && !holes.length) voicedMoves++;
  if (!holes.length) completeMoves++;                       // 穴ゼロ=完結(効果なし技も含む=もう見直さなくてよい)
  else if (holes.length === 1) {                            // あと1穴で完結=安い完結
    const k = holes[0];
    if (!oneHoleByKind.has(k)) oneHoleByKind.set(k, []);
    oneHoleByKind.get(k).push(m.name);
  }
}
const tocIdx = ordered.map((k, i) => ({ k, i, n: byKind.get(k).length, st: kindState(k) }));
const kindToIdx = new Map(tocIdx.map(x => [x.k, x.i]));
const oneHoleMoves = [...oneHoleByKind.values()].reduce((a, b) => a + b.length, 0);
// 「あと1穴で完結」を、開通すると完結する技数の多いkind順に(=次に潰すと完結数が増えるkindが分かる)
const nearList = [...oneHoleByKind.entries()].sort((a, b) => b[1].length - a[1].length)
  .map(([k, names]) => `<a class="near-row" href="#sec-${kindToIdx.has(k) ? kindToIdx.get(k) : 0}"><b class="near-k">${esc(k)}</b><span class="near-n">${names.length}技完結</span><span class="near-mv">${names.map(esc).join('・')}</span></a>`).join('');
const pick = st => tocIdx.filter(x => x.st === st);
const workItems = pick('working'), doneItems = pick('done'), reviewItems = pick('review'), todoItems = pick('todo');
const noeffItem = tocIdx.find(x => x.k === NOEFF);
const CHIP_CLS = { working: 'is-working', done: 'is-done', review: 'is-review', todo: 'is-todo', noeff: 'is-todo' };
const CHIP_MK = { working: '🔨', done: '✓', review: '🕓', todo: '⚠', noeff: '' };
const tocChip = x => `<a class="toc-chip ${CHIP_CLS[x.st]}" href="#sec-${x.i}">${esc(x.k === NOEFF ? '追加効果なし' : x.k)}<span class="toc-n">${x.n}</span>${CHIP_MK[x.st] ? `<span class="toc-mk">${CHIP_MK[x.st]}</span>` : ''}</a>`;
const tocGroup = (lbl, cls, items) => items.length ? `<div class="toc-grp"><div class="toc-lbl ${cls}">${lbl}</div><div class="toc-chips">${items.map(tocChip).join('')}</div></div>` : '';
const toc = `<nav class="toc" id="toc">
  <div class="toc-prog">📊 進捗：<b class="p-work">🔨作業中 ${workItems.length}</b>　｜　<b class="p-done">✓確定 ${doneItems.length}</b>　｜　<b class="p-review">🕓確認待ち ${reviewItems.length}</b>　｜　<b class="p-todo">⚠これから ${todoItems.length}</b>グループ　｜　説明文が出せる <b>${voicedMoves}</b>/${moves.length}技　｜　<b class="p-cmpl">✅完結(穴ゼロ) ${completeMoves}</b>　｜　<b class="p-near">あと1穴 ${oneHoleMoves}技</b><span id="dyn-prog"></span></div>
  <details class="near-box"${oneHoleMoves ? '' : ' style="display:none"'}><summary>🎯 あと1穴で完結する技 ${oneHoleMoves}技 ―「このkindを開通すると○技が一気に完結」(クリックでセクションへ)</summary>
    <div class="near-list">${nearList}</div></details>
  ${tocGroup('🔨 作業中（いま開通中）', 'wk', workItems)}
  ${tocGroup('✓ 確定（阿部さんの耳でOK）', 'ok', doneItems)}
  ${tocGroup('🕓 確認待ち（ビルド済・耳の確認まち）', 'rv', reviewItems)}
  ${tocGroup('⚠ これから（技数の多い順）', 'ng', [...todoItems, ...(noeffItem ? [noeffItem] : [])])}
</nav>`;

const CSS = `
body { margin:0; font-family:-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif; background:#fff; color:#222; }
.hdr { padding:10px 16px; background:#1F4E79; color:#fff; }
.hdr h1 { font-size:16px; margin:0; }
.hdr .sub { font-size:11px; color:#cfe0f0; margin-top:4px; }
/* ★overflow-xを付けない: 付けるとtbl-wrapがstickyの含有ブロック(内側スクロール)になり、
   列見出し(thead)のsticky top:33px がビューポート基準でなくなって33px下にズレ→先頭行のタグが
   見出しの上に透ける「幽霊枠」が出ていた。visibleにしてビューポート基準のstickyに戻す。 */
.tbl-wrap { overflow-x:visible; }
/* グループ一覧(目次) */
.toc { padding:10px 16px 12px; background:#eef3fa; border-bottom:2px solid #1F4E79; }
.toc-prog { font-size:12.5px; color:#33415c; margin-bottom:9px; padding:6px 10px; background:#fff; border:1px solid #C5D2E5; border-radius:6px; }
.toc-prog .p-done { color:#2E7D32; } .toc-prog .p-todo { color:#C77800; } .toc-prog .p-cmpl { color:#1565C0; } .toc-prog .p-near { color:#B8860B; } .toc-prog .p-review { color:#1565C0; } .toc-prog .p-work { color:#6A1B9A; } .toc-prog .p-fullok { color:#1B5E20; } .toc-prog .p-partial { color:#E65100; }
/* ★OKチェック動的反映(2026-06-17) */
.toc-chip.is-fullok { background:#2E7D32 !important; color:#fff !important; border-color:#2E7D32 !important; }
.toc-chip.is-fullok .toc-n { color:#cfe8c8 !important; }
.toc-chip.is-fullok .toc-mk-dyn { color:#fff; font-weight:700; }
.toc-chip.is-partial { background:#FFF3E0 !important; color:#A35200 !important; border-color:#FFB74D !important; }
.toc-chip.is-partial .toc-n { color:#A35200 !important; }
.toc-chip.is-partial .toc-mk-dyn { color:#A35200; font-weight:700; font-size:10.5px; }
.toc-mk-dyn { margin-left:3px; }
/* あと1穴で完結 */
.near-box { margin:0 0 9px; background:#FFFBEA; border:1px solid #E3C58A; border-radius:7px; padding:4px 10px; }
.near-box > summary { cursor:pointer; font-size:12px; font-weight:700; color:#8a5a00; padding:4px 0; }
.near-list { display:flex; flex-direction:column; gap:3px; padding:4px 0 6px; }
.near-row { display:flex; align-items:baseline; gap:8px; text-decoration:none; font-size:12px; padding:3px 6px; border-radius:5px; }
.near-row:hover { background:#FCEFC7; }
.near-k { color:#1F4E79; min-width:130px; } .near-n { color:#B8860B; font-weight:700; min-width:64px; } .near-mv { color:#555; }
/* 技単位の完結バッジ */
.mv-st { display:inline-block; font-size:10.5px; font-weight:700; padding:1px 6px; border-radius:4px; margin-right:3px; white-space:nowrap; }
.mv-st.done { background:#E6F5E6; color:#1B5E20; border:1px solid #9CCC9E; }
.mv-st.near { background:#FFF7DB; color:#8a5a00; border:1px solid #E3C58A; }
.mv-st.hole { background:#FBEAEA; color:#A33; border:1px solid #E0A6A6; }
.toc-grp { margin-bottom:7px; }
.toc-lbl { font-size:11px; font-weight:700; margin-bottom:5px; }
.toc-lbl.ok { color:#2E7D32; } .toc-lbl.ng { color:#C77800; } .toc-lbl.rv { color:#1565C0; } .toc-lbl.wk { color:#6A1B9A; }
.toc-chips { display:flex; flex-wrap:wrap; gap:5px; }
.toc-chip { display:inline-flex; align-items:center; gap:4px; text-decoration:none; font-size:12px; font-weight:700; border-radius:14px; padding:3px 10px; white-space:nowrap; transition:background .12s,border-color .12s,color .12s; }
.toc-chip.is-done { color:#1B5E20; background:#fff; border:1px solid #9CCC9E; }
.toc-chip.is-done:hover { background:#2E7D32; color:#fff; border-color:#2E7D32; }
.toc-chip.is-review { color:#0D47A1; background:#fff; border:1px solid #90CAF9; }
.toc-chip.is-review:hover { background:#1976D2; color:#fff; border-color:#1976D2; }
.toc-chip.is-working { color:#4527A0; background:#fff; border:1px solid #B39DDB; }
.toc-chip.is-working:hover { background:#6A1B9A; color:#fff; border-color:#6A1B9A; }
.toc-chip.is-todo { color:#8a5a00; background:#fff; border:1px solid #E3C58A; }
.toc-chip.is-todo:hover { background:#C77800; color:#fff; border-color:#C77800; }
.toc-chip:hover .toc-n { color:#fff; }
.toc-chip:hover .toc-mk { color:#fff; }
.toc-n { font-size:10px; color:#7a8aa0; font-weight:600; }
.toc-mk { font-size:11px; }
/* 一番上に戻るボタン */
.to-top { position:fixed; right:20px; bottom:22px; z-index:200; background:#1F4E79; color:#fff; text-decoration:none; font-size:13px; font-weight:700; padding:10px 15px; border-radius:24px; box-shadow:0 3px 10px rgba(0,0,0,.28); opacity:.92; }
.to-top:hover { background:#16395c; opacity:1; }
.sec { margin:0 0 22px; scroll-margin-top:0; }
.sec-h { position:sticky; top:0; z-index:60; margin:0; padding:8px 16px; background:#10263d; color:#fff; font-size:15px; border-top:2px solid #4a90d9; }
.sec-n { font-size:12px; color:#9cc4ee; margin-left:10px; font-weight:400; }
.sec-ok { font-size:11px; color:#7ee787; background:#16361f; padding:2px 8px; border-radius:5px; margin-left:10px; font-weight:400; }
.sec-rv { font-size:11px; color:#90CAF9; background:#102a44; padding:2px 8px; border-radius:5px; margin-left:10px; font-weight:400; }
.sec-wk { font-size:11px; color:#D1C4E9; background:#2a1a40; padding:2px 8px; border-radius:5px; margin-left:10px; font-weight:400; }
.sec-ng { font-size:11px; color:#ffd479; background:#3a2e12; padding:2px 8px; border-radius:5px; margin-left:10px; font-weight:400; }
.sec thead th { top:33px; }
table { border-collapse:collapse; width:100%; font-size:11px; background:#fff; }
thead th { background:#1F4E79; color:#fff; padding:4px 6px; text-align:center; border:1px solid #0a2040; white-space:nowrap; font-weight:700; font-size:11px; position:sticky; top:0; z-index:50; }
thead th.col-name, thead th.col-effect, thead th.col-yakkun { text-align:left; }
tbody td { padding:3px 5px; border:1px solid #DDD; vertical-align:middle; }
tbody tr:nth-child(even) { background:#F9F9F9; }
tbody tr:hover { background:#E3F2FD !important; }
.type-cell { display:block; color:#fff; text-align:center; padding:3px 4px; border-radius:3px; font-weight:700; font-size:12px; white-space:nowrap; }
td.col-type { padding:1px !important; }
.name-cell { font-weight:700; color:#1F4E79; }
.cat-cell { background:#E8ECF2; padding:1px 4px; border-radius:2px; font-size:10px; white-space:nowrap; }
.mode-both { color:#666; font-size:10px; }
.mode-double { color:#D32F2F; font-weight:700; font-size:10px; background:#FFEBEE; padding:1px 4px; border-radius:2px; }
.num-cell { text-align:center; font-family:monospace; }
.cls-badge { display:inline-block; padding:1px 6px; border-radius:3px; color:#fff; font-size:10px; font-weight:700; }
.cls-badge.cls-phys { background:#f0883e; }
.cls-badge.cls-spec { background:#58a6ff; }
.cls-badge.cls-stat { background:#6e7681; }
td.col-learners { width:48px; text-align:center; }
td.col-name { width:110px; }
td.col-type { width:64px; text-align:center; }
td.col-class { width:46px; text-align:center; }
td.col-power, td.col-acc { width:40px; text-align:center; }
td.col-pp { width:32px; text-align:center; }
td.col-prob { width:42px; text-align:center; font-family:monospace; }
td.col-flag { white-space:nowrap; text-align:center; font-size:11px; color:#444; }
td.col-prio { width:44px; text-align:center; font-family:monospace; font-size:11px; }
td.col-prio.prio-pos { color:#1F4E79; font-weight:700; }
td.col-prio.prio-neg { color:#C0392B; font-weight:700; }
td.col-prio.prio-zero { color:#BBB; }
td.col-target { width:80px; white-space:nowrap; font-size:10px; text-align:center; }
td.col-mode { width:56px; text-align:center; }
td.col-contact, td.col-guard { width:34px; text-align:center; }
td.col-cat { width:62px; text-align:center; }
td.col-effect { min-width:300px; font-size:12px; color:#222; line-height:1.5; }
td.col-yakkun { min-width:300px; font-size:12px; color:#555; line-height:1.5; background:#FFFDF5; }
/* ★col-tagsは普通のテーブルセルのまま(display:flexにするとセルが列幅同期から外れ、見出しがズレる)。
   チップはinline-blockで自然に折り返す。間隔はmarginで取る。 */
td.col-tags { min-width:200px; max-width:360px; padding:4px; vertical-align:top; }
td.col-tags .mw-tag { margin:0 2px 2px 0; }
.gen-none { color:#C0392B; font-weight:700; }
.hole { color:#A35200; font-size:10px; margin-top:4px; }
.mw-tag { display:inline-block; padding:2px 8px; border-radius:4px; font-size:12.5px; font-weight:700; line-height:1.45; background:#F0F4FA; border:1px solid #C5D2E5; color:#1F4E79; white-space:nowrap; }
.col-effsrc { font-family:ui-monospace,SFMono-Regular,monospace; font-size:12px; color:#2a7d4f; line-height:1.5; min-width:470px; max-width:660px; white-space:pre-wrap; word-break:normal; overflow-wrap:anywhere; background:#F6FBF7; }
thead th.col-effsrc { text-align:left; }
.mw-tag.tag-flag    { background:#E3F2FD; border-color:#2196F3; color:#0D47A1; }
.mw-tag.tag-status  { background:#FFE0F0; border-color:#E91E63; color:#880E4F; }
.mw-tag.tag-rank    { background:#E3F2FD; border-color:#2196F3; color:#0D47A1; }
.mw-tag.tag-crit    { background:#FFF8E1; border-color:#FFC107; color:#B86E00; }
.mw-tag.tag-misc    { background:#F0F4FA; border-color:#C5D2E5; color:#1F4E79; }
.mw-tag.tag-recoil  { background:#FFEBE9; border-color:#E66666; color:#B33A33; }
.mw-tag.tag-drain   { background:#FFE0EC; border-color:#E64A8C; color:#B12C66; }
.mw-tag.tag-recov   { background:#E6F5E6; border-color:#4CAF50; color:#2E7D32; }
.mw-tag.tag-prio-up   { background:#FFF3E0; border-color:#FFA726; color:#A35200; }
.mw-tag.tag-prio-down { background:#ECEFF1; border-color:#78909C; color:#37474F; }
.mw-tag.tag-charge  { background:#EDE7F6; border-color:#7E57C2; color:#4527A0; }
.mw-tag.tag-field   { background:#E0F7FA; border-color:#26C6DA; color:#006978; }
.mw-tag.tag-hazard  { background:#FFF9C4; border-color:#FBC02D; color:#6F4E00; }
.mw-tag.tag-switch  { background:#E8F5E9; border-color:#66BB6A; color:#1B5E20; }
.mw-tag.tag-faint   { background:#424242; border-color:#000; color:#fff; }
.mw-tag.tag-screen  { background:#FFFDE7; border-color:#FFB300; color:#5D4037; }
.mw-tag.tag-room    { background:#F3E5F5; border-color:#AB47BC; color:#4A148C; }
.mw-tag.tag-block   { background:#FFCDD2; border-color:#E53935; color:#B71C1C; }
.mw-tag.tag-support { background:#E0F2F1; border-color:#26A69A; color:#004D40; }
.mw-tag.tag-rankop  { background:#E1F5FE; border-color:#29B6F6; color:#01579B; }
.mw-tag.tag-unlock  { background:#FFF3E0; border-color:#FB8C00; color:#E65100; }
.mw-tag.tag-other   { background:#F5F5F5; border-color:#9E9E9E; color:#424242; }
.mw-tag.tag-cure    { background:#DCEDC8; border-color:#689F38; color:#33691E; }
/* === 人の耳チェック(確認OK→非表示)=== */
.bar { position:sticky; top:0; z-index:90; background:#fff; padding:7px 16px; border-bottom:1px solid #C5D2E5; display:flex; gap:7px; flex-wrap:wrap; align-items:center; }
.bar button { padding:4px 12px; border-radius:14px; border:1px solid #C5D2E5; background:#fff; cursor:pointer; font-weight:700; font-size:12px; color:#1F4E79; }
.bar button.on { background:#1F4E79; color:#fff; border-color:#1F4E79; }
.bar input { padding:5px 10px; border-radius:8px; border:1px solid #C5D2E5; font-size:13px; }
.bar .hint { font-size:11px; color:#5a6b85; margin-left:8px; }
.bar .cnt { font-size:12.5px; color:#33415c; font-weight:700; margin-left:auto; }
/* バーの分だけ見出し/列見出しのstickyを下げる(バー35px) */
.sec-h { top:35px; cursor:pointer; user-select:none; }
.sec thead th { top:68px; }
.sec-h .caret { display:inline-block; transition:transform .15s; font-size:12px; margin-right:4px; }
.sec.collapsed .caret, .sec.hdr-only .caret { transform:rotate(-90deg); }
.sec.collapsed .tbl-wrap, .sec.hdr-only .tbl-wrap { display:none; }
.sec.hdr-only .sec-h::after, .sec.collapsed.allchecked .sec-h::after { content:"▶ クリックで見直す"; font-size:10px; color:#9cc4ee; margin-left:8px; font-weight:400; }
.sec-prog { font-size:11px; color:#7ee787; margin-left:8px; font-weight:400; }
.sec-done { font-size:11px; padding:2px 9px; border-radius:5px; margin-left:auto; border:1px solid #4a90d9; background:#173049; color:#cfe0f0; cursor:pointer; font-weight:700; }
.sec-done:hover { background:#1f4e79; }
.sec.allchecked .sec-h { filter:saturate(.45); }
td.col-chk { width:96px; min-width:96px; text-align:center; vertical-align:middle; }
thead th.col-chk { min-width:96px; }
.rowchk-l { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; color:#1F4E79; cursor:pointer; white-space:nowrap; }
.rowchk { width:17px; height:17px; cursor:pointer; }
tbody tr.is-checked { opacity:.5; }
`;

const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>わざリスト 確認 (新説明文 × 本番レイアウト) - PchamDB</title>
<style>${CSS}</style></head><body>
<div class="hdr" id="top">
  <h1>📋 わざリスト 確認用 — 新説明文(エンジン生成)を本番レイアウトで表示</h1>
  <div class="sub">効果(=エフェクト内容)カテゴリーごとに区切って表示。効果列=新生成 / ヤック列=description_legacy(お手本)。優先列=battle_data.priority。重複技は各カテゴリに出ます。本番ファイルは未変更。全${moves.length}技 / ${ordered.length}カテゴリ。</div>
</div>
<div class="bar">
  <input id="q" placeholder="技名でしぼり込み…">
  <button id="toggleChecked" class="act">👁 確認OKも表示</button>
  <button id="collapseAll" class="act">▾ グループ全部畳む/開く</button>
  <button id="resetChk" class="act">↺ 確認OKをリセット</button>
  <button id="tagPanel" class="act">🏷 タグでしぼり込み…</button>
  <button id="clearTags" class="act" style="display:none">✕ タグ解除</button>
  <span id="activeTags" class="active-tags"></span>
  <span class="cnt" id="cnt"></span>
</div>
<div id="tagFilterBox" class="tag-filter-box" style="display:none">
  <div class="tfb-hint">💡 タグをクリックでそのタグを持つ技だけ表示(複数選択=AND)。もう一度クリックで外す。「✕ タグ解除」で全解除。</div>
  <div id="tagFilterChips" class="tag-filter-chips"></div>
</div>
${toc}
${sections}
<a class="to-top" href="#top" title="一番上に戻る">↑ 上へ</a>
<script>
// ===== 人の耳チェック(確認OK→行が非表示)・localStorage永続。verify_report と進捗を共有(同キー)=====
const rows=[...document.querySelectorAll("tbody tr")];
const secs=[...document.querySelectorAll(".sec")];
const LS_CHK="pcham_voice_checked_v1", LS_COL="pcham_sec_collapsed_v1"; // ★verify_report と同キー=進捗共有
let checked=new Set(JSON.parse(localStorage.getItem(LS_CHK)||"[]"));
let collapsed=new Set(JSON.parse(localStorage.getItem(LS_COL)||"[]"));
let showChecked=false;
let revealed=new Set(); // ★開いたセクションは、そのセクションだけチェック済みも再表示(見直し用・一時)
const saveChk=()=>localStorage.setItem(LS_CHK,JSON.stringify([...checked]));
const saveCol=()=>localStorage.setItem(LS_COL,JSON.stringify([...collapsed]));
function keyOf(r){const s=r.closest(".sec");const nm=r.querySelector(".name-cell");return (s?s.id:"")+"|"+(nm?nm.textContent.trim():"");}
function apply(){const v=document.getElementById("q").value.trim();
  rows.forEach(r=>{const nm=r.querySelector(".name-cell");const okQ=!v||(nm&&nm.textContent.includes(v));
    const sec=r.closest(".sec");const revd=showChecked||(sec&&revealed.has(sec.id)); // 全体表示 or このセクションが開かれている
    const hideChk=checked.has(keyOf(r))&&!revd;
    r.style.display=(okQ&&!hideChk)?"":"none";});
  // 検索ヒット無しのセクションだけ隠す。チェック済みで中身が全部消えても見出しは残す=クリックで見直せる
  secs.forEach(s=>{const rs=[...s.querySelectorAll("tbody tr")];
    const matchQ=!v||rs.some(r=>{const nm=r.querySelector(".name-cell");return nm&&nm.textContent.includes(v);});
    const visN=rs.filter(r=>r.style.display!=="none").length;
    s.classList.toggle("hdr-only",rs.length>0&&visN===0&&!s.classList.contains("collapsed")); // チェック済みで空=見出しだけ残す
    s.style.display=matchQ?"":"none";});
  updCnt();}
function updCnt(){const c=document.getElementById("cnt");if(c)c.textContent="確認OK "+checked.size+" / "+rows.length+"技";}
function markSecDone(){secs.forEach(s=>{const rs=[...s.querySelectorAll("tbody tr")];const done=rs.filter(r=>checked.has(keyOf(r))).length;
  const all=rs.length>0&&done===rs.length;s.classList.toggle("allchecked",all);
  const p=s.querySelector(".sec-prog");if(p)p.textContent=done>0?("確認OK "+done+"/"+rs.length):"";
  // ★上部チップに進捗を反映(2026-06-17 阿部さん): 同じid(#sec-X)を持つtocチップを動的に書き換える
  const chip=document.querySelector('.toc-chip[href="#'+s.id+'"]');
  if(chip){
    chip.classList.toggle("is-fullok",all);
    chip.classList.toggle("is-partial",done>0&&!all);
    let mk=chip.querySelector(".toc-mk-dyn");
    if(done>0){if(!mk){mk=document.createElement("span");mk.className="toc-mk-dyn";chip.appendChild(mk);}mk.textContent=all?"✓":(done+"/"+rs.length);}
    else if(mk)mk.remove();
  }
});
// 上部「📊 進捗」行にも反映(✓確認OK完了 N グループ)
const fullOk=document.querySelectorAll(".toc-chip.is-fullok").length;
const partial=document.querySelectorAll(".toc-chip.is-partial").length;
const dyn=document.getElementById("dyn-prog");if(dyn)dyn.innerHTML=" ｜ <b class='p-fullok'>✅確認OK完了 "+fullOk+"</b>"+(partial?" ｜ <b class='p-partial'>👀進行中 "+partial+"</b>":"");
}
rows.forEach(r=>{const cb=r.querySelector(".rowchk");if(!cb)return;const k=keyOf(r);
  cb.checked=checked.has(k);r.classList.toggle("is-checked",cb.checked);
  cb.addEventListener("change",()=>{if(cb.checked)checked.add(k);else checked.delete(k);
    r.classList.toggle("is-checked",cb.checked);saveChk();markSecDone();apply();});});
function setCol(s,on){s.classList.toggle("collapsed",on);if(on){collapsed.add(s.id);revealed.delete(s.id);}else{collapsed.delete(s.id);revealed.add(s.id);}saveCol();} // 開く=そのセクションのチェック済みも見直し表示 / 畳む=また隠す
secs.forEach(s=>{if(collapsed.has(s.id))s.classList.add("collapsed");
  const h=s.querySelector(".sec-h");if(h)h.addEventListener("click",e=>{if(e.target.closest(".sec-done")||e.target.closest("a"))return;
    const visN=[...s.querySelectorAll("tbody tr")].filter(r=>r.style.display!=="none").length;
    const closed=s.classList.contains("collapsed")||visN===0; // 畳んでいる or チェック済みで空 → 開いて見直す
    setCol(s,!closed);apply();});
  const btn=s.querySelector(".sec-done");if(btn)btn.addEventListener("click",e=>{e.stopPropagation();
    s.querySelectorAll("tbody tr").forEach(r=>{const cb=r.querySelector(".rowchk");if(cb&&!cb.checked){cb.checked=true;checked.add(keyOf(r));r.classList.add("is-checked");}});
    saveChk();setCol(s,true);markSecDone();apply();});});
document.getElementById("q").addEventListener("input",apply);
document.getElementById("toggleChecked").addEventListener("click",function(){showChecked=!showChecked;
  this.classList.toggle("on",showChecked);this.textContent=showChecked?"🙈 確認OKを隠す":"👁 確認OKも表示";apply();});
document.getElementById("collapseAll").addEventListener("click",()=>{const anyOpen=secs.some(s=>!s.classList.contains("collapsed"));secs.forEach(s=>setCol(s,anyOpen));apply();});
document.getElementById("resetChk").addEventListener("click",()=>{if(confirm("確認OKを全部リセットしますか?(verify_reportと共有)")){checked.clear();saveChk();rows.forEach(r=>{const cb=r.querySelector(".rowchk");if(cb)cb.checked=false;r.classList.remove("is-checked");});markSecDone();apply();}});
markSecDone();apply();
</script>
</body></html>`;

const outDir = path.join(ROOT, 'review');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'waza_list_confirm.html');
fs.writeFileSync(outPath, html);
console.log(`生成: review/waza_list_confirm.html / 全${moves.length}技 / ${ordered.length}カテゴリ別 / 列17(…カテゴリ→Effects(元データ)→効果→タグ→ヤック)`);

// ★検証レポート(_waza_verify_report.js)が同じ行・列・色をそのまま再利用するためにエクスポート(二重管理しない)。
module.exports = { buildRow, THEAD, CSS, moves, ordered, byKind, esc };
