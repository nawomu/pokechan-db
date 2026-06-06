/**
 * 精査済みブロック(やった分)を waza_list_proto と同じテーブル形式で表示。
 * ブロック見出し行つき。出力: review/waza_cond_proto.html
 * 実行: node tools/_waza_proto_done.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
function lit(x, m) { const at = x.indexOf(m); let i = x.indexOf('{', at), s = i, d = 0, S = false, e = false;
  for (; i < x.length; i++) { const c = x[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return x.slice(s, i + 1); } } } }
const map = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));
const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/waza_kind_dict.json'), 'utf8'));
const JA2EN = {}, GRP = {}; for (const d of dict) { JA2EN[d.ja] = d.en; GRP[d.en] = d.group; }
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const _G = JSON.parse(fs.readFileSync(path.join(ROOT, "review/_cond_groups.json"), "utf8"));
const BLOCKS = _G.map(g => ({ title: g.group + "(" + g.keys.length + "技)", keys: g.keys }));
const PENDING = new Set([]);

const DMG = new Set(['power', 'crit', 'accuracy', 'charge', 'damage_modifier']), MT = new Set(['change_move_type', 'add_move_type', 'override_type_effectiveness', 'change_target_move_type']);
const POST = new Set(['recoil', 'recoil_attacker', 'drain', 'faint_self', 'switch_self_out', 'force_switch']), RES = new Set(['chip_damage', 'damage_over_time', 'perish_song', 'delayed_attack']), FG = new Set(['field', 'screen', 'hazard', 'terrain', 'weather', 'trap']);
function rank(e) { const en = JA2EN[e.kind], g = GRP[en]; if (RES.has(en) || e.phase === 'turn_end' || e.phase === 'delayed') return 6; if (MT.has(en)) return 1; if (DMG.has(g)) return 1; if (POST.has(en)) return 4; if (e.phase === 'lasting' || FG.has(g)) return 5; return 3; }
const STAGE = { 1: '威力', 3: '命中後', 4: '攻撃後', 5: '場/継続', 6: 'ターン終了' }, SC = { 1: 's1', 3: 's3', 4: 's4', 5: 's5', 6: 's6' };
const FLAG = { punch: '👊パンチ', sound: '🔊音', ball: '🔵弾', bullet: '🔵弾', bite: '🦷牙', dance: '💃舞', powder: '🌫粉', pulse: '〰️波動', wind: '🌬風', slicing: '🔪切断' };
const TGT = { self: '自分', opponent: '相手', team: '味方場', opponent_team: '相手場', ally: '味方', all: '場全員', field: '場', all_opponents: '相手全体', all_but_self: '自分以外', party: '手持ち全員', incoming: '次に出る味方' };
const STAT = { attack: '攻', defense: '防', special_attack: '特攻', special_defense: '特防', speed: '速', accuracy: '命中', evasion: '回避', all: '全' };
const PK = { multiplier: '倍率', value: '値', stat: '能力', stats: '能力', stages: '段', prob: '確率', fraction: '割合', turn_end_damage: '終了ダメ', prevents_switch: '交代不可', ignores_accuracy: '命中無視', bypasses_substitute: 'みがわり貫通', replacement: '交代先', pass: '引継', pass_to_replacement: '引継先', semi_invulnerable: '避ける状態', vulnerable_to: 'それでも当たる技', vulnerable_if: 'それでも当たる条件', skip_charge_if_weather: '天候で溜め省略', hits_state: '命中状態', damage_multiplier: 'ダメージ倍率', cases: '天候別命中', bypasses: 'まもり貫通', not_bypassed: '貫通例外', on_charge_turn: '溜めターンに', power_per_hit: '各ヒット威力', doubles_note: 'ダブル時', note: '注', effect: '効果', champions_amount: 'チャンピオンズでは', minimum: '最低' };
function jvP(k, v) { if (k === 'pass') return (Array.isArray(v) ? v : [v]).map(x => ({ stat_changes: '能力ランク変化', volatiles: '状態変化' }[x] || x)).join('・'); return jv(k, v); }
function immStr(arr) { return (arr || []).map(x => x.value || (x.values && x.values.join('・')) || x.type).join('・'); }
const { condStrNew } = require('./_cond_render.js');
// 旧 condStr(修正前=proto_done の現行)と 新 condStr を切替可能に
const CONDT_OLD = { weather_in: '天候', weather: '天候', ability: '特性', ability_in: '特性', holds_item: '道具', target_used_move: '相手の直前技', user_type: '自分が', user_not_type: '自分が非', target_type: '相手が', target_type_in: '相手が', grounded: '接地時', user_took_damage_this_turn: '被弾後', ability_plus_or_minus: '特性プラス/マイナス' };
function condStrOld(c) { if (typeof c !== 'object' || !c) return c; const val = c.value || (c.values && c.values.join('・')) || ''; const label = CONDT_OLD[c.type] || c.type; return val ? label + ':' + val : label; }
let condStr = condStrOld; // row() 内で旧→新に切替えて2回描画
function casesStr(arr) { return (arr || []).map(c => `${c.weather}→${c.accuracy === '必中' ? '必中' : c.accuracy + '%'}`).join(' / '); }
function pctStr(f) { return (+(f * 100).toFixed(2)) + '%'; }
const FRAC_PRE = { '反動': '与えたダメージの', '吸収': '与えたダメージの', '失敗ダメージ': '最大HPの', 'HPが減る': '最大HPの', '回復': '最大HPの', '継続削り': '毎ターン最大HPの', '全体継続ダメージ': '毎ターン最大HPの' };
function jv(k, v) { if (k === 'stat' || k === 'stats') return (Array.isArray(v) ? v : [v]).map(x => STAT[x] || x).join('・'); if (Array.isArray(v)) return v.map(x => typeof x === 'object' ? (x.value || x.type || '…') : x).join('・'); if (typeof v === 'object' && v) return v.value || v.type || '条件'; return v; }
function effLine(e) {
  const r = rank(e);
  let kindLabel = e.kind, skipKeys = new Set();
  if (e.kind === '失敗ダメージ') kindLabel = '当たらないとダメージ';
  else if (e.kind === '自分瀕死') kindLabel = '自分がひんし';
  else if (e.kind === '状態異常回復') { kindLabel = (e.value && e.value !== 'all') ? `${e.value}を回復` : '状態異常をすべて回復'; skipKeys.add('value'); }
  else if (e.kind === '固定ダメージ' && e.amount) { kindLabel = `${e.amount}のダメージ`; skipKeys.add('amount'); }
  if (e.kind === '半無敵命中' && e.hits_state) { kindLabel = `${e.hits_state.join('・')}の相手にも命中`; skipKeys = new Set(['hits_state']); }
  else if (e.kind === '連続攻撃') {
    skipKeys = new Set(['min_hits', 'max_hits', 'hits', 'stop_on_miss', 'hits_by']);
    if (e.hits_by) kindLabel = '手持ちの数だけ攻撃';
    else if (e.stop_on_miss) kindLabel = `外れるまで最大${e.max_hits}回攻撃`;
    else if (e.hits) kindLabel = `${e.hits}回攻撃`;
    else if (e.min_hits) kindLabel = `${e.min_hits}〜${e.max_hits}回攻撃`;
  }
  const logic = e.selection === 'random_one' ? '<span class="lg or">どれか1つ</span>' : (Array.isArray(e.stats) || Array.isArray(e.value)) ? '<span class="lg and">同時</span>' : '';
  const cond = e.condition ? `<span class="lg if">IF:${esc(condStr(e.condition))}</span>` : '';
  const rs = e.needs_research ? `<span class="lg rs" title="${esc(e.needs_research)}">🔍要調査</span>` : '';
  const dur = e.duration ? `<span class="dur">${esc(jv('duration', e.duration))}継続</span>` : '';
  const keys = ['semi_invulnerable', 'replacement', 'pass', 'pass_to_replacement', 'multiplier', 'value', 'stat', 'stats', 'stages', 'prob', 'fraction', 'turn_end_damage', 'prevents_switch', 'ignores_accuracy', 'bypasses_substitute', 'skip_charge_if_weather', 'vulnerable_to', 'vulnerable_if', 'bypasses', 'not_bypassed', 'on_charge_turn'];
  const allkeys = keys.concat(['hits_state', 'damage_multiplier', 'cases', 'power_per_hit', 'doubles_note', 'note', 'to_max', 'champions_amount', 'minimum']);
  const ps = allkeys.filter(k => e[k] !== undefined && !skipKeys.has(k)).map(k => {
    if (k === 'stages') { const v = e[k]; return `<span class="sdir ${v > 0 ? 'up' : 'down'}">${v > 0 ? v + '段階アップ' : (-v) + '段階ダウン'}</span>`; }
    if (k === 'to_max') return `<span class="sdir up">最大(+6)までアップ</span>`;
    if (k === 'fraction') { const pre = FRAC_PRE[e.kind]; return pre ? esc(pre + pctStr(e[k])) : `<span class="pk">割合</span>${esc(pctStr(e[k]))}`; }
    if (k === 'cases') return `<span class="pk">${PK[k]}</span>${esc(casesStr(e[k]))}`;
    return `<span class="pk">${PK[k] || k}</span>${esc(jvP(k, e[k]))}`;
  }).join(' ');
  const imm = e.immune ? `<span class="lg im">⛔無効:${esc(immStr(e.immune))}</span>` : '';
  return `<div class="el"><span class="stg ${SC[r]}">${STAGE[r]}</span><b>${esc(kindLabel)}</b>` +
    (e.target ? `<span class="tg">${esc(TGT[e.target] || e.target)}</span>` : '') + dur + logic + cond + rs + imm + (ps ? ` <span class="ps">${ps}</span>` : '') + `</div>`;
}
const TSTAT = { attack: '攻撃', defense: '防御', special_attack: '特攻', special_defense: '特防', speed: '素早さ', accuracy: '命中', evasion: '回避', all: '全能力' };
function tagsOf(m) {
  const out = [], bd = m.battle_data || {}, fl = m.flags || {};
  for (const f in FLAG) if (fl[f]) out.push(FLAG[f]);
  const addImm = arr => (arr || []).forEach(x => { if (x.type === 'target_type') out.push('⛔無効:' + (x.value || (x.values && x.values.join('/')))); });
  for (const e of (bd.effects || [])) {
    if (e.kind === '状態付与' && e.value === 'バインド') out.push('🔗バインド');
    else if (e.kind === '状態付与' && e.value) out.push('🩹' + (Array.isArray(e.value) ? e.value.join('/') : e.value));
    if (e.kind === '半無敵命中') out.push('🛬避けてる相手に命中');
    if (e.kind === 'ひるみ') out.push('😵ひるみ'); if (e.kind === '一撃必殺') out.push('💀一撃');
    if (e.kind === '自分交代') out.push('↩️自分が交代'); if (typeof e.kind === 'string' && e.kind.indexOf('強制交代') === 0) out.push('↪️相手を交代');
    if (e.kind === '2ターン目に攻撃') out.push('⏳2ターン目攻撃');
    if (e.kind === '次のターン行動不能') out.push('🔁次のターン行動不能');
    if (e.kind === '状態異常回復') out.push('💊' + (e.target === 'opponent' ? '相手' : '') + ((e.value && e.value !== 'all') ? e.value + '回復' : '状態異常を回復'));
    if (e.kind === '反動') out.push('💢反動' + pctStr(e.fraction));
    if (e.kind === 'HPが減る' && e.target === 'self') out.push('🩸自分のHPが減る');
    if (e.kind === '自分瀕死') out.push('💀自分がひんし');
    if (e.kind === '失敗ダメージ') out.push('💔当たらないとダメージ');
    if (e.kind === '連続攻撃') {
      if (e.hits_by) out.push('🔢手持ちの数');
      else if (e.stop_on_miss) out.push('🔢最大' + e.max_hits + '回');
      else if (e.hits) out.push('🔢' + e.hits + '回攻撃');
      else if (e.min_hits) out.push('🔢' + e.min_hits + '-' + e.max_hits + '回');
    }
    if (e.kind === '能力ランク変化') {
      const sts = Array.isArray(e.stats) ? e.stats : [e.stat];
      const dir = e.stages > 0 ? 'アップ' : 'ダウン';
      const pre = e.target === 'opponent' ? '相手' : (e.target === 'team' || e.target === 'ally') ? '味方' : '';
      sts.forEach(s => out.push('📊' + pre + (TSTAT[s] || s) + dir));
    }
    addImm(e.immune);
  }
  addImm(bd.immune);
  if (bd.priority > 0) out.push('⚡先制+' + bd.priority);
  else if (bd.priority < 0) out.push('🐢後攻' + bd.priority);
  if (m.target && m.target !== '1体選択' && m.target !== '自分') out.push('🎯' + m.target);
  if (bd.not_blocked_by) out.push('🥷貫通'); if (bd.ext) out.push('🔒拡張');
  return [...new Set(out)];
}
const FAIL_JA = { no_replacement_available: '交代先がいない', same_gender: '同性', genderless: '性別不明', self_has_item: '自分が道具所持', target_not_selecting_attacking_move: '相手が攻撃技でない', used_consecutively: '連続使用' };
function mll(m) {
  const bd = m.battle_data || {}, out = [];
  if (bd.not_blocked_by) out.push(`<div class="mll nb">🥷 貫通(${bd.not_blocked_by.length}): ${esc(bd.not_blocked_by.join('・'))}</div>`);
  if (bd.blocked_by) out.push(`<div class="mll">🛡 防がれる: ${esc(bd.blocked_by.join('・'))}</div>`);
  if (bd.requires) out.push(`<div class="mll rq">前提: ${esc(bd.requires.map(x => x.value || x.type).join('・'))}</div>`);
  if (bd.immune) out.push(`<div class="mll im">⛔ 無効: ${esc(immStr(bd.immune))}</div>`);
  if (bd.fails_if) out.push(`<div class="mll fa">✖ 失敗: ${esc(bd.fails_if.map(x => FAIL_JA[x.type] || x.type).join('・'))}</div>`);
  if (bd.ext) out.push(`<div class="mll ext">🔒 拡張(非表示/Champions対象外): ${esc(Object.values(bd.ext).join(' / '))}</div>`);
  return out.join('');
}
function row(key) {
  const m = map[key], bd = m.battle_data || {}, fl = m.flags ? Object.keys(m.flags).filter(x => m.flags[x]).map(x => FLAG[x] || x) : [];
  const prio = bd.priority > 0 ? '+' + bd.priority : '' + (bd.priority || 0);
  const scope = (m.target && m.target !== '1体選択' && m.target !== '自分') ? `<div class="scope">🎯 対象範囲: ${esc(m.target)}</div>` : '';
  const sorted = (bd.effects || []).slice().sort((a, b) => rank(a) - rank(b));
  const renderFlow = () => scope + (sorted.map(effLine).join('') || '<span class="dim">追加効果なし</span>') + mll(m);
  condStr = condStrOld; const effsOld = renderFlow();
  condStr = condStrNew; const effsNew = renderFlow();
  const tags = tagsOf(m).map(t => `<span class="ft">${esc(t)}</span>`).join('');
  return `<tr class="${PENDING.has(key) ? 'pend' : ''}">
   <td class="c-num">${(m.learners || []).length}匹</td>
   <td class="c-nm"><b>${esc(m.name)}</b>${PENDING.has(key) ? '<span class="pt">待</span>' : ''}</td>
   <td class="c-prio ${bd.priority > 0 ? 'pp' : bd.priority < 0 ? 'pm' : ''}">${esc(prio)}</td>
   <td class="c-flag">${fl.join(' ') || '<span class="dim">—</span>'}</td>
   <td>${esc(m.type || '')}</td><td class="ct">${esc((m.category || '').slice(0, 1))}</td>
   <td class="cr">${esc(m.power || '—')}</td><td class="cr">${m.accuracy != null ? esc(m.accuracy) : '—'}</td><td class="cr">${esc(m.pp || '')}</td>
   <td class="ct">${m.contact ? '接○' : '接×'}</td><td class="ct">${m.protect ? '守○' : '守×'}</td>
   <td class="c-eff c-old">${effsOld}</td>
   <td class="c-eff c-new">${effsNew}</td>
   <td class="c-tag">${tags}</td>
   <td class="c-desc">${esc(m.description_legacy || m.description || '')}</td>
  </tr>`;
}
let rows = '';
for (const b of BLOCKS) { rows += `<tr class="sec"><td colspan="15">${esc(b.title)}</td></tr>`; rows += b.keys.map(row).join(''); }

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>やった分(プロト形式)</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:12px}
 header{padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d;position:sticky;top:0;z-index:6}
 h1{font-size:15px;margin:0} .sub{font-size:11px;color:#9aa7b4;margin-top:3px}
 table{border-collapse:collapse;width:100%} thead th{position:sticky;top:50px;background:#21262d;color:#9aa7b4;font-size:11px;padding:6px 5px;border-bottom:2px solid #30363d;text-align:left;white-space:nowrap}
 td{padding:6px 5px;border-bottom:1px solid #1c2128;vertical-align:top}
 tr.sec td{background:#1d2330;color:#d2a8ff;font-weight:700;font-size:13px;position:sticky;top:79px;border-bottom:2px solid #a371f7}
 tr.pend td{background:#1f1809} tr.pend:hover td{background:#241c0b}
 .c-num{color:#8b949e;white-space:nowrap} .c-nm{font-weight:700;min-width:96px} .pt{background:#9e6a00;color:#fff;font-size:9px;padding:0 4px;border-radius:3px;margin-left:4px}
 .c-prio{text-align:center;font-weight:700} .pp{color:#7ee787} .pm{color:#ff7b72} .c-flag{white-space:nowrap} .ct{text-align:center;color:#9aa7b4} .cr{text-align:right;color:#c9d1d9} .dim{color:#586069}
 .c-eff{min-width:300px;max-width:430px} .c-old{border-left:3px solid #5d2f2f;background:#140f10} .c-new{border-left:3px solid #2f5d3f;background:#0f1410} .h-old{color:#ff9a92} .h-new{color:#7ee787} .scope{font-size:11px;color:#ffd479;margin-bottom:2px} .el{display:flex;align-items:baseline;gap:5px;padding:1px 0;line-height:1.5;flex-wrap:wrap}
 .el b{color:#7ee787;font-size:12px} .el .tg{color:#ffa657;font-size:11px} .el .dur{color:#9aa7b4;font-size:11px} .el .ps{color:#c9d1d9;font-size:11px} .el .ps .pk{color:#6e7681;margin-right:1px}
 .stg{flex:0 0 auto;font-size:10px;border-radius:3px;padding:0 5px;color:#0f1419;font-weight:700;min-width:50px;text-align:center} .s1{background:#d2a8ff}.s3{background:#7ee787}.s4{background:#f0883e}.s5{background:#79c0ff}.s6{background:#8b949e}
 .lg{font-size:10px;border-radius:3px;padding:0 5px;font-weight:700} .lg.and{background:#1f3b2a;color:#7ee787}.lg.or{background:#3b2f16;color:#e3b341}.lg.if{background:#16263b;color:#79c0ff} .lg.rs{background:#3a2a16;color:#e3b341;cursor:help}
 .sdir{font-weight:700} .sdir.up{color:#7ee787} .sdir.down{color:#ff9a92}
 .mll{font-size:10.5px;margin:2px 0 0;padding:2px 7px;border-radius:4px;background:#0d1117;border:1px solid #21262d;line-height:1.5} .mll.nb{border-color:#2f5d3f;color:#7ee787} .mll.im{border-color:#4a2f5d;color:#d2a8ff} .mll.fa{border-color:#5d2f2f;color:#ff9a92} .mll.ext{border-style:dashed;color:#6e7681} .mll.rq{border-color:#2f4a5d;color:#79c0ff}
 .c-tag{min-width:120px} .ft{display:inline-block;background:#21262d;border:1px solid #30363d;border-radius:4px;padding:1px 5px;margin:1px;font-size:10px;color:#adbac7}
 .c-desc{min-width:230px;max-width:330px;color:#9aa7b4;font-size:11px;line-height:1.5}
 tbody tr:not(.sec):hover td{background:#161b22}
</style></head><body>
<header><h1>condition 修正候補 — 改良版condStrで表示(全${BLOCKS.reduce((a,b)=>a+b.keys.length,0)}件・概念グループ別・プロト形式)</h1>
<div class="sub">①優先 ②基本データ + 効果フロー(段色:<b style="color:#d2a8ff">威力</b>/<b style="color:#7ee787">命中後</b>/<b style="color:#f0883e">攻撃後</b>/<b style="color:#79c0ff">場継続</b>/<b style="color:#8b949e">終了</b>・<b style="color:#7ee787">同時</b>/<b style="color:#e3b341">OR</b>/<b style="color:#79c0ff">IF</b>)+ タグ(導出)+ 説明. 🥷貫通/🔒拡張あり. 橙行=適用待ち</div></header>
<table><thead><tr>
 <th>習得</th><th>わざ名</th><th>①優先</th><th>フラグ</th><th>タイプ</th><th>分</th><th>威力</th><th>命中</th><th>PP</th><th>接触</th><th>守貫</th><th class="h-old">🔴 修正前(現行)</th><th class="h-new">🟢 修正後(候補)</th><th>タグ</th><th>説明(ポケモン徹底攻略)</th>
</tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review/waza_cond_proto.html'), html);
console.log('生成: review/waza_cond_proto.html /', BLOCKS.reduce((a, b) => a + b.keys.length, 0), '技');
