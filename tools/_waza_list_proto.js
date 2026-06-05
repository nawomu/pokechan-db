/**
 * 新effects統合・横並びリストのプロトタイプ生成。
 *  固定列: 習得/わざ名/①優先/②基本(フラグ/タイプ/分類/威力/命中/PP/接触/守貫) + 効果フロー + タグ(導出)
 * 入力: pokechan_data.js(適用後・日本語kind) / review/waza_kind_dict.json
 * 出力: review/waza_list_proto.html
 * 実行: node tools/_waza_list_proto.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
function lit(x, m) { const at = x.indexOf(m); let i = x.indexOf('{', at), s = i, d = 0, S = false, e = false;
  for (; i < x.length; i++) { const c = x[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return x.slice(s, i + 1); } } } }
const map = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));
const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/waza_kind_dict.json'), 'utf8'));
const JA2EN = {}, EN2GROUP = {};
for (const d of dict) { JA2EN[d.ja] = d.en; EN2GROUP[d.en] = d.group; }
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// 実行段(日本語kind→en→group)
const DMG = new Set(['power', 'crit', 'accuracy', 'charge', 'damage_modifier']);
const MT = new Set(['change_move_type', 'add_move_type', 'override_type_effectiveness', 'change_target_move_type']);
const POST = new Set(['recoil', 'recoil_attacker', 'drain', 'faint_self', 'switch_self_out', 'force_switch']);
const RES = new Set(['chip_damage', 'damage_over_time', 'perish_song', 'delayed_attack']);
const FG = new Set(['field', 'screen', 'hazard', 'terrain', 'weather', 'trap']);
function rank(e) { const en = JA2EN[e.kind]; const g = EN2GROUP[en];
  if (RES.has(en) || e.phase === 'turn_end' || e.phase === 'delayed') return 6;
  if (MT.has(en)) return 1; if (DMG.has(g)) return 1; if (POST.has(en)) return 4;
  if (e.phase === 'lasting' || FG.has(g)) return 5; return 3; }
const STAGE = { 1: '威力', 3: '命中後', 4: '攻撃後', 5: '場/継続', 6: 'ターン終了' };
const STAGE_CLS = { 1: 's1', 3: 's3', 4: 's4', 5: 's5', 6: 's6' };
const FLAG = { punch: '👊パンチ', sound: '🔊音', ball: '🔵弾', bullet: '🔵弾', bite: '🦷牙', dance: '💃舞', powder: '🌫粉', pulse: '〰️波動', wind: '🌬風', slicing: '🔪切断' };
const TGT = { self: '自分', opponent: '相手', team: '味方場', opponent_team: '相手場', ally: '味方', all: '場全員', field: '場' };
const STAT = { attack: '攻', defense: '防', special_attack: '特攻', special_defense: '特防', speed: '速', accuracy: '命中', evasion: '回避', all: '全' };
const PK = { multiplier: '倍率', value: '値', prob: '確率', stages: '段', stat: '能力', fraction: '割合', duration: '継続', condition: '条件', stats: '能力', basis: '基準', min_hits: '最小', max_hits: '最大' };

function jv(k, v) { if (k === 'stat') return STAT[v] || v; if (k === 'stats' && Array.isArray(v)) return v.map(x => STAT[x] || x).join('・');
  if (Array.isArray(v)) return v.map(x => typeof x === 'object' ? '…' : x).join('・'); if (typeof v === 'object' && v) return (v.value || v.type || '条件'); return v; }
function effLine(e) {
  const r = rank(e);
  const logic = e.selection === 'random_one' ? '<span class="lg or">どれか1つ(OR)</span>'
    : (Array.isArray(e.stats) || Array.isArray(e.value)) ? '<span class="lg and">同時(AND)</span>' : '';
  const cond = e.condition ? `<span class="lg if">条件:${esc((e.condition.value || e.condition.type || '').toString())}</span>` : '';
  const keys = ['multiplier', 'value', 'stat', 'stats', 'stages', 'prob', 'fraction', 'duration', 'min_hits', 'max_hits'];
  const ps = keys.filter(k => e[k] !== undefined).map(k => `<span class="pk">${PK[k] || k}</span>${esc(jv(k, e[k]))}`).join(' ');
  return `<div class="el"><span class="stg ${STAGE_CLS[r]}">${STAGE[r]}</span><b>${esc(e.kind)}</b>` +
    (e.target ? `<span class="tg">${esc(TGT[e.target] || e.target)}</span>` : '') + (ps ? ` <span class="ps">${ps}</span>` : '') + logic + cond + `</div>`;
}
// 導出フィルタタグ(簡易): フラグ + 状態異常 + 急所 + 反動 等
function filterTags(m) {
  const out = []; const bd = m.battle_data || {}; const fl = m.flags || {};
  for (const f in FLAG) if (fl[f]) out.push(FLAG[f]);
  for (const e of (bd.effects || [])) {
    if (e.kind === '状態付与' && e.value && e.value !== 'バインド') out.push('🩹' + (Array.isArray(e.value) ? e.value.join('/') : e.value));
    if (e.kind === 'ひるみ') out.push('😵ひるみ');
    if (e.kind === '反動') out.push('💢反動');
    if (e.kind === '一撃必殺') out.push('💀一撃');
    if (e.kind === '回復' || e.kind === '吸収') out.push('💚' + e.kind);
  }
  if (typeof bd.priority === 'number' && bd.priority > 0) out.push('⚡先制+' + bd.priority);
  if (typeof bd.priority === 'number' && bd.priority < 0) out.push('🐢後攻' + bd.priority);
  return [...new Set(out)];
}

const moves = Object.values(map);
const rows = moves.map(m => {
  const bd = m.battle_data || {}; const fl = m.flags || {};
  const flags = Object.keys(FLAG).filter(f => fl[f]).map(f => FLAG[f]).join(' ') || '<span class="dim">—</span>';
  const prio = typeof bd.priority === 'number' ? (bd.priority > 0 ? '+' + bd.priority : '' + bd.priority) : '0';
  const effs = (bd.effects || []).map(effLine).join('') || '<span class="dim">追加効果なし</span>';
  const tags = filterTags(m).map(t => `<span class="ft">${esc(t)}</span>`).join('') || '';
  const learners = (m.learners || []).length;
  return `<tr>
   <td class="c-num">${learners}匹</td>
   <td class="c-nm"><b>${esc(m.name)}</b></td>
   <td class="c-prio ${bd.priority > 0 ? 'pp' : bd.priority < 0 ? 'pm' : ''}">${esc(prio)}</td>
   <td class="c-flag">${flags}</td>
   <td class="c-type">${esc(m.type || '')}</td>
   <td class="c-cls">${esc((m.category || '').slice(0, 1))}</td>
   <td class="c-num2">${esc(m.power || '—')}</td>
   <td class="c-num2">${m.accuracy != null ? esc(m.accuracy) : '—'}</td>
   <td class="c-num2">${esc(m.pp || '')}</td>
   <td class="c-mk">${m.contact ? '接○' : '接×'}</td>
   <td class="c-mk">${m.protect ? '守○' : '守×'}</td>
   <td class="c-eff">${effs}</td>
   <td class="c-tag">${tags}</td>
   <td class="c-desc">${esc(m.description_legacy || m.description || '')}</td>
  </tr>`;
}).join('\n');

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>わざリスト(新effects統合プロト) ${moves.length}技</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:12px}
 header{padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d;position:sticky;top:0;z-index:5}
 h1{font-size:15px;margin:0} .sub{font-size:11px;color:#9aa7b4;margin-top:3px}
 table{border-collapse:collapse;width:100%} thead th{position:sticky;top:51px;background:#21262d;color:#9aa7b4;font-size:11px;padding:6px 5px;border-bottom:2px solid #30363d;text-align:left;white-space:nowrap}
 td{padding:6px 5px;border-bottom:1px solid #1c2128;vertical-align:top}
 .c-num{color:#8b949e;white-space:nowrap} .c-nm{font-weight:700;min-width:96px} .c-prio{text-align:center;font-weight:700} .pp{color:#7ee787} .pm{color:#ff7b72}
 .c-flag{font-size:11px;white-space:nowrap} .c-type{white-space:nowrap} .c-cls,.c-mk{text-align:center;color:#9aa7b4} .c-num2{text-align:right;color:#c9d1d9}
 .dim{color:#586069} .c-eff{min-width:340px}
 .el{display:flex;align-items:baseline;gap:5px;padding:1px 0;line-height:1.5}
 .el b{color:#7ee787;font-size:12px} .el .tg{color:#ffa657;font-size:11px} .el .ps{color:#c9d1d9;font-size:11px} .el .ps .pk{color:#6e7681;margin-right:1px}
 .stg{flex:0 0 auto;font-size:10px;border-radius:3px;padding:0 5px;color:#0f1419;font-weight:700;min-width:56px;text-align:center}
 .s1{background:#d2a8ff} .s3{background:#7ee787} .s4{background:#f0883e} .s5{background:#79c0ff} .s6{background:#8b949e}
 .lg{font-size:10px;border-radius:3px;padding:0 5px;margin-left:4px;font-weight:700} .lg.and{background:#1f3b2a;color:#7ee787} .lg.or{background:#3b2f16;color:#e3b341} .lg.if{background:#16263b;color:#79c0ff}
 .c-tag{min-width:140px} .ft{display:inline-block;background:#21262d;border:1px solid #30363d;border-radius:4px;padding:1px 5px;margin:1px;font-size:10px;color:#adbac7}
 .c-desc{min-width:240px;max-width:340px;color:#9aa7b4;font-size:11px;line-height:1.5}
 tbody tr:hover td{background:#161b22}
</style></head><body>
<header><h1>わざリスト — 新effects統合プロトタイプ(${moves.length}技)</h1>
<div class="sub">①優先 ②基本データ(固定列) ＋ 効果フロー(実行手順順・段で色分け: <b style="color:#d2a8ff">威力</b>/<b style="color:#7ee787">命中後</b>/<b style="color:#f0883e">攻撃後</b>/<b style="color:#79c0ff">場継続</b>/<b style="color:#8b949e">ターン終了</b>)＋ タグ(導出). ※ソート/絞り込みUIは本実装で付与</div></header>
<table><thead><tr>
 <th>習得</th><th>わざ名</th><th>①優先</th><th>フラグ</th><th>タイプ</th><th>分</th><th>威力</th><th>命中</th><th>PP</th><th>接触</th><th>守貫</th><th>効果(②威力→命中後→攻撃後→場/継続→終了)</th><th>タグ(導出/フィルタ用)</th><th>説明(ポケモン徹底攻略)</th>
</tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review/waza_list_proto.html'), html);
console.log('生成: review/waza_list_proto.html /', moves.length, '技');
