/**
 * 精査済みブロックだけを詳細表示する確認HTML(やった分レビュー用)。
 * 効果フロー(AND/OR/IFバッジ・段色)+ move-level(priority/not_blocked_by/fails_if/immune/flags)
 * + ext(非表示退避・拡張)+ 説明文。ブロック見出しつき。
 * 出力: review/waza_review_done.html
 * 実行: node tools/_waza_review_done.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
function lit(x, m) { const at = x.indexOf(m); let i = x.indexOf('{', at), s = i, d = 0, S = false, e = false;
  for (; i < x.length; i++) { const c = x[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return x.slice(s, i + 1); } } } }
const map = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));
const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/waza_kind_dict.json'), 'utf8'));
const JA2EN = {}, GRP = {}; for (const d of dict) { JA2EN[d.ja] = d.en; GRP[d.en] = d.group; }
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const BLOCKS = [
  { title: '02 交代系(適用済)', keys: ['fukitobashi', 'hoeru', 'batontatchi', 'tonbogaeri', 'tomoenage', 'borutochenji', 'doragonteeru', 'sutezerifu', 'kuikkutaan', 'shippokiri', 'samuigyagu'] },
  { title: '03 バインド/拘束(精査済・3技は適用待ち)', keys: ['shimetsukeru', 'makitsuku', 'honoonouzu', 'kuroimanazashi', 'uzushio', 'sunajigoku', 'matowaritsuku', 'kagenui', 'torabasami'] },
];
const PENDING = new Set(['matowaritsuku', 'kuroimanazashi', 'kagenui']);

const DMG = new Set(['power', 'crit', 'accuracy', 'charge', 'damage_modifier']), MT = new Set(['change_move_type', 'add_move_type', 'override_type_effectiveness', 'change_target_move_type']);
const POST = new Set(['recoil', 'recoil_attacker', 'drain', 'faint_self', 'switch_self_out', 'force_switch']), RES = new Set(['chip_damage', 'damage_over_time', 'perish_song', 'delayed_attack']), FG = new Set(['field', 'screen', 'hazard', 'terrain', 'weather', 'trap']);
function rank(e) { const en = JA2EN[e.kind], g = GRP[en]; if (RES.has(en) || e.phase === 'turn_end' || e.phase === 'delayed') return 6; if (MT.has(en)) return 1; if (DMG.has(g)) return 1; if (POST.has(en)) return 4; if (e.phase === 'lasting' || FG.has(g)) return 5; return 3; }
const STAGE = { 0: '行動順', 1: '威力・判定', 3: '命中後', 4: '攻撃後', 5: '場・継続', 6: 'ターン終了' }, SC = { 0: 's0', 1: 's1', 3: 's3', 4: 's4', 5: 's5', 6: 's6' };
const TGT = { self: '自分', opponent: '相手', team: '味方の場', opponent_team: '相手の場', ally: '味方', all: '場の全員', field: '場全体' };
const STAT = { attack: 'こうげき', defense: 'ぼうぎょ', special_attack: 'とくこう', special_defense: 'とくぼう', speed: 'すばやさ', accuracy: '命中', evasion: '回避', all: '全能力' };
const PK = { multiplier: '倍率', value: '値', stat: '能力', stats: '能力', stages: '段階', prob: '確率', fraction: '割合', duration: '継続', condition: '条件', selection: '選択', turn_end_damage: 'ターン終了ダメージ', prevents_switch: '交代不可', immune: '無効', ignores_accuracy: '命中無視', bypasses_substitute: 'みがわり貫通', effect: '効果' };
function jv(k, v) { if (k === 'stat' || k === 'stats') return (Array.isArray(v) ? v : [v]).map(x => STAT[x] || x).join('・'); if (k === 'selection') return v === 'random_one' ? 'どれか1つ' : v; if (Array.isArray(v)) return v.map(x => typeof x === 'object' ? (x.value || x.type || JSON.stringify(x)) : x).join('・'); if (typeof v === 'object' && v) return v.value || v.type || JSON.stringify(v); return v; }
function effBlock(e) {
  const r = rank(e);
  const badge = e.selection === 'random_one' ? '<span class="lg or">どれか1つ(OR)</span>' : (Array.isArray(e.stats) || Array.isArray(e.value)) ? '<span class="lg and">同時(AND)</span>' : '';
  const cond = e.condition ? `<span class="lg if">IF:${esc(jv('condition', e.condition))}</span>` : '';
  const skip = new Set(['kind', 'target', 'phase', 'duration', 'condition', 'selection']);
  const ps = Object.entries(e).filter(([k]) => !skip.has(k)).map(([k, v]) => `<span class="pp"><span class="pk">${esc(PK[k] || k)}</span>:${esc(jv(k, v))}</span>`).join(' ');
  return `<div class="ef"><span class="stg ${SC[r]}">${STAGE[r]}</span><b>${esc(e.kind)}</b>` +
    (e.target ? `<span class="tg">${esc(TGT[e.target] || e.target)}へ</span>` : '') + (e.duration ? `<span class="dur">${esc(jv('duration', e.duration))}継続</span>` : '') +
    badge + cond + (ps ? `<div class="ps">${ps}</div>` : '') + `</div>`;
}
function moveCard(key) {
  const m = map[key]; const bd = m.battle_data || {}; const fl = m.flags ? Object.keys(m.flags).filter(x => m.flags[x]) : [];
  const effs = (bd.effects || []).slice().sort((a, b) => rank(a) - rank(b)).map(effBlock).join('');
  const ml = [];
  ml.push(`<span class="mlchip">優先度 ${bd.priority > 0 ? '+' : ''}${bd.priority || 0}</span>`);
  if (fl.length) ml.push(`<span class="mlchip">フラグ:${esc(fl.join('・'))}</span>`);
  if (bd.not_blocked_by) ml.push(`<span class="mlchip nb">貫通:${esc(bd.not_blocked_by.join('・'))}</span>`);
  if (bd.fails_if) ml.push(`<span class="mlchip fa">失敗:${esc(bd.fails_if.map(x => x.type).join('・'))}</span>`);
  if (bd.immune) ml.push(`<span class="mlchip im">無効:${esc(bd.immune.map(x => jv('immune', x)).join('・'))}</span>`);
  const ext = bd.ext ? `<div class="ext">🔒 非表示・拡張(Champions対象外/将来用): ${esc(Object.entries(bd.ext).map(([k, v]) => k + '=' + v).join(' / '))}</div>` : '';
  return `<div class="card${PENDING.has(key) ? ' pend' : ''}">
    <div class="hd"><b>${esc(m.name)}</b><span class="meta">${esc(m.type)}/${esc(m.category)} 威力${esc(m.power || '-')} 命中${m.accuracy != null ? esc(m.accuracy) : '—'} PP${esc(m.pp)} ${m.contact ? '接○' : '接×'} ${m.protect ? '守○' : '守×'}</span>${PENDING.has(key) ? '<span class="pendtag">適用待ち</span>' : ''}</div>
    <div class="body">
      <div class="left"><div class="flow">${effs}</div><div class="ml">${ml.join('')}</div>${ext}</div>
      <div class="desc">${esc(m.description_legacy || m.description || '')}</div>
    </div></div>`;
}

let sections = '';
for (const b of BLOCKS) sections += `<h2>${esc(b.title)} <span class="cnt">${b.keys.length}技</span></h2>` + b.keys.map(moveCard).join('');

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>精査済みレビュー(やった分)</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:13px}
 header{padding:12px 18px;background:#161b22;border-bottom:1px solid #30363d;position:sticky;top:0;z-index:5}
 h1{font-size:16px;margin:0} .sub{font-size:11px;color:#9aa7b4;margin-top:3px}
 h2{font-size:15px;margin:20px 16px 8px;padding-bottom:5px;border-bottom:2px solid #a371f7;color:#d2a8ff} h2 .cnt{font-size:12px;color:#6e7681;font-weight:400}
 .card{background:#11161c;border:1px solid #21262d;border-radius:8px;margin:8px 16px;overflow:hidden} .card.pend{border-color:#9e6a00}
 .hd{background:#161b22;padding:7px 11px;border-bottom:1px solid #21262d} .hd b{font-size:14px} .hd .meta{font-size:11px;color:#8b949e;margin-left:8px} .pendtag{float:right;background:#9e6a00;color:#fff;font-size:10px;padding:1px 7px;border-radius:4px}
 .body{display:flex;gap:14px;padding:9px 11px} .left{flex:1 1 60%} .desc{flex:1 1 40%;color:#9aa7b4;font-size:11.5px;line-height:1.55;border-left:1px solid #21262d;padding-left:12px}
 .ef{background:#15211a;border:1px solid #2a4a35;border-radius:6px;padding:4px 8px;margin:3px 0;line-height:1.5}
 .ef b{color:#7ee787} .ef .tg{color:#ffa657;font-size:11px;margin-left:5px} .ef .dur{color:#9aa7b4;font-size:11px;margin-left:5px}
 .ef .ps{margin-top:2px;font-size:11.5px} .ef .pp{margin-right:8px} .ef .pk{color:#6e7681}
 .stg{font-size:10px;border-radius:3px;padding:0 6px;color:#0f1419;font-weight:700;margin-right:6px} .s0{background:#6e7681}.s1{background:#d2a8ff}.s3{background:#7ee787}.s4{background:#f0883e}.s5{background:#79c0ff}.s6{background:#8b949e}
 .lg{font-size:10px;border-radius:3px;padding:0 5px;margin-left:5px;font-weight:700} .lg.and{background:#1f3b2a;color:#7ee787}.lg.or{background:#3b2f16;color:#e3b341}.lg.if{background:#16263b;color:#79c0ff}
 .ml{margin-top:6px} .mlchip{display:inline-block;background:#21262d;border:1px solid #30363d;border-radius:4px;padding:1px 7px;margin:2px 3px 0 0;font-size:10.5px;color:#adbac7} .nb{border-color:#2f5d3f;color:#7ee787} .fa{border-color:#5d2f2f;color:#ff9a92} .im{border-color:#4a2f5d;color:#d2a8ff}
 .ext{margin-top:6px;font-size:10.5px;color:#6e7681;background:#0d1117;border:1px dashed #30363d;border-radius:4px;padding:3px 7px}
</style></head><body>
<header><h1>精査済みレビュー — 交代系 + バインド/拘束(${BLOCKS.reduce((a, b) => a + b.keys.length, 0)}技)</h1>
<div class="sub">効果フロー(段色: <b style="color:#d2a8ff">威力</b>/<b style="color:#7ee787">命中後</b>/<b style="color:#f0883e">攻撃後</b>/<b style="color:#79c0ff">場継続</b>/<b style="color:#8b949e">ターン終了</b>)+ <b style="color:#7ee787">同時AND</b>/<b style="color:#e3b341">OR</b>/<b style="color:#79c0ff">IF</b> + move-level + ext(非表示退避). 橙枠=適用待ち</div></header>
${sections}</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review/waza_review_done.html'), html);
console.log('生成: review/waza_review_done.html /', BLOCKS.reduce((a, b) => a + b.keys.length, 0), '技');
