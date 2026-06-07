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
    else if (e.kind === '状態付与') out.push({cls:'tag-status', text:`${STATUS_ICON[e.value]||'🩻'} ${p}${e.value}${tgt}`});
  }

  // ランク変動
  const STAT_JP = {atk:'攻',def:'防',spa:'特攻',spd:'特防',spe:'速',acc:'命中',eva:'回避'};
  const TGT_JP = {self:'自',ally:'味',opp:'相'};
  for (const r of (bd.rank_changes || [])) {
    const sign = r.delta > 0 ? '+' : '';
    const probTxt = r.prob < 100 ? `${r.prob}% ` : '';
    out.push({cls:'tag-rank', text:`📊 ${probTxt}${TGT_JP[r.target]||'?'}${STAT_JP[r.stat]||r.stat}${sign}${r.delta}`});
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

  const effHtml = text
    ? esc(text) + (holes.length ? `<div class="hole">⚠未対応: ${esc(holes.join('・'))}</div>` : '')
    : '<span class="gen-none">(生成なし)</span>' + (holes.length ? `<div class="hole">⚠未対応: ${esc(holes.join('・'))}</div>` : '');

  // 並び順(2026-06-07 阿部さん指定=プロト踏襲): 習得/わざ名/優先/フラグ/タイプ/分類/威力/命中/PP/接触/守貫/対象/カテゴリ/効果/タグ/ヤック
  return `<tr>
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
const KIND_ORDER = ['急所率上昇', 'ひるみ', '威力可変', '状態付与', '能力ランク変化', '回復', '反動', '拘束', '継続削り', '連続攻撃', '固定ダメージ', 'HPが減る', '自分瀕死', '威力倍率'];
const HANDLED = new Set(['状態付与', '拘束', '反動', '威力倍率', '自分瀕死', '回復', 'HPが減る', '固定ダメージ', '継続削り', '連続攻撃', '急所率上昇', 'ひるみ', '威力可変', '能力ランク変化']);
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

const sections = ordered.map(k => {
  const ms = byKind.get(k);
  const badge = k === NOEFF ? '' : (HANDLED.has(k) ? '<span class="sec-ok">✓テンプレ対応</span>' : '<span class="sec-ng">⚠未対応</span>');
  return `<section class="sec"><h2 class="sec-h">【${esc(k)}】<span class="sec-n">${ms.length}技</span>${badge}</h2>
  <div class="tbl-wrap"><table>${THEAD}<tbody>${ms.map(buildRow).join('\n')}</tbody></table></div></section>`;
}).join('\n');

const CSS = `
body { margin:0; font-family:-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif; background:#fff; color:#222; }
.hdr { padding:10px 16px; background:#1F4E79; color:#fff; }
.hdr h1 { font-size:16px; margin:0; }
.hdr .sub { font-size:11px; color:#cfe0f0; margin-top:4px; }
.tbl-wrap { overflow-x:auto; }
.sec { margin:0 0 22px; }
.sec-h { position:sticky; top:0; z-index:60; margin:0; padding:8px 16px; background:#10263d; color:#fff; font-size:15px; border-top:2px solid #4a90d9; }
.sec-n { font-size:12px; color:#9cc4ee; margin-left:10px; font-weight:400; }
.sec-ok { font-size:11px; color:#7ee787; background:#16361f; padding:2px 8px; border-radius:5px; margin-left:10px; font-weight:400; }
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
td.col-tags { min-width:200px; max-width:360px; }
td.col-tags { display:flex; flex-wrap:wrap; gap:2px; padding:4px; align-content:flex-start; }
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
`;

const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>わざリスト 確認 (新説明文 × 本番レイアウト) - PchamDB</title>
<style>${CSS}</style></head><body>
<div class="hdr">
  <h1>📋 わざリスト 確認用 — 新説明文(エンジン生成)を本番レイアウトで表示</h1>
  <div class="sub">効果(=エフェクト内容)カテゴリーごとに区切って表示。効果列=新生成 / ヤック列=description_legacy(お手本)。優先列=battle_data.priority。重複技は各カテゴリに出ます。本番ファイルは未変更。全${moves.length}技 / ${ordered.length}カテゴリ。</div>
</div>
${sections}
</body></html>`;

const outDir = path.join(ROOT, 'review');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'waza_list_confirm.html');
fs.writeFileSync(outPath, html);
console.log(`生成: review/waza_list_confirm.html / 全${moves.length}技 / ${ordered.length}カテゴリ別 / 列17(…カテゴリ→Effects(元データ)→効果→タグ→ヤック)`);
