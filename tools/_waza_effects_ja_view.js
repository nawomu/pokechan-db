/**
 * 効果構造化specsを「全日本語表記 + 技ファミリ別」で確認するビュー生成。
 * kindは日本語対訳(review/waza_kind_ja.json)、target/phase/主要paramも日本語化。
 * パンチ系/キック系/キバ系/はどう系/ビーム系/舞系/こな系/バインド系 → 残りは効果グループ別。
 * 入力: review/waza_effects_specs_final.json + review/waza_effects_pilot.json(=全490技)
 * 出力: review/waza_effects_ja.html
 * 実行: node tools/_waza_effects_ja_view.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const R = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
function lit(text, marker) { const at = text.indexOf(marker); let i = text.indexOf('{', at), s = i, d = 0, inS = false, esc = false;
  for (; i < text.length; i++) { const c = text[i]; if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; }
    else { if (c === '"') inS = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return text.slice(s, i + 1); } } } }

const map = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));
const KJA = R('review/waza_kind_ja.json');
const canon = R('review/waza_kind_canonical.json').canonical;
const kindGroup = {}; canon.forEach(c => kindGroup[c.kind] = c.group);
const specs = [...R('review/waza_effects_pilot.json').moves, ...R('review/waza_effects_specs_final.json').specs];
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const TGT = { self: '自分', opponent: '相手', team: '味方の場', opponent_team: '相手の場', ally: '味方', all: '場の全員', field: '場全体' };
const PH = { on_use: '使用時', lasting: '継続', delayed: '遅延', this_turn: 'このターン', turn_end: 'ターン終了時', order: '行動順' };
const PK = { duration: '継続', fraction: '割合', prob: '確率', stat: '能力', stages: '段階', multiplier: '倍率', value: '値',
  values: '値', condition: '条件', turns: 'ターン', min_hits: '最小回数', max_hits: '最大回数', turn_end_damage: 'ターン終了ダメージ',
  prevents_switch: '交代不可', immune: '無効', note: '注', effect: '効果', applies_to: '適用先', basis: '基準', stats: '能力',
  exceptions: '例外', forced: '強制', toggle: '再使用で解除', flags: 'フラグ' };
const STAT = { attack: 'こうげき', defense: 'ぼうぎょ', special_attack: 'とくこう', special_defense: 'とくぼう', speed: 'すばやさ',
  accuracy: '命中', evasion: '回避', all: '全能力' };

function jval(k, v) {
  if (k === 'stat' && STAT[v]) return STAT[v];
  if (k === 'stats' && Array.isArray(v)) return v.map(x => STAT[x] || x).join('・');
  if (Array.isArray(v)) return v.map(x => typeof x === 'object' ? JSON.stringify(x) : x).join('・');
  if (typeof v === 'object' && v !== null) return JSON.stringify(v);
  return v;
}
// 技の解決手順で実行段を決める(ゲーム実処理順):
//  1=威力・判定(ダメージ計算前) → 3=命中後の効果(状態異常/ランク等) → 4=攻撃後(反動/吸収/交代)
//  5=場・継続(壁/フィールド/拘束) → 6=ターン終了時(継続ダメージ/遅延)
const DMG_CALC_GROUPS = new Set(['power', 'crit', 'accuracy', 'charge', 'damage_modifier']);
const MOVE_TYPE_KINDS = new Set(['change_move_type', 'add_move_type', 'override_type_effectiveness', 'change_target_move_type']);
const POST_DAMAGE = new Set(['recoil', 'recoil_attacker', 'drain', 'faint_self', 'switch_self_out', 'force_switch']);
const RESIDUAL = new Set(['chip_damage', 'damage_over_time', 'perish_song', 'delayed_attack']);
const FIELD_GROUPS = new Set(['field', 'screen', 'hazard', 'terrain', 'weather', 'trap']);
function execRank(e) {
  if (RESIDUAL.has(e.kind) || e.phase === 'turn_end' || e.phase === 'delayed') return 6;
  if (MOVE_TYPE_KINDS.has(e.kind)) return 1;
  if (DMG_CALC_GROUPS.has(kindGroup[e.kind])) return 1;
  if (POST_DAMAGE.has(e.kind)) return 4;
  if (e.phase === 'lasting' || FIELD_GROUPS.has(kindGroup[e.kind])) return 5;
  return 3;
}
const STAGE = { 0: '行動順', 1: '威力・判定', 3: '命中後の効果', 4: '攻撃後', 5: '場・継続', 6: 'ターン終了時' };
function effBody(e) {
  const ja = KJA[e.kind] || e.kind;
  const head = `<b>${esc(ja)}</b><span class="en">${esc(e.kind)}</span>` +
    (e.target ? ` <span class="t">${esc(TGT[e.target] || e.target)}へ</span>` : '') +
    (e.duration ? ` <span class="ph">${esc(jval('duration', e.duration))}ターン継続</span>` : '');
  const skip = new Set(['kind', 'target', 'phase', 'duration']);
  const params = Object.entries(e).filter(([k]) => !skip.has(k))
    .map(([k, v]) => `<div class="p"><span class="k">${esc(PK[k] || k)}</span>: ${esc(jval(k, v))}</div>`).join('');
  return head + params;
}
const FLAG_JA = { punch: 'パンチ', sound: '音', ball: '弾', bullet: '弾', bite: '牙', dance: '踊り', powder: '粉',
  pulse: '波動', wind: '風', slicing: '切断', contact: '接触' };
// 技の基本戦闘データ(タイプ/威力/命中/接触/フラグ等)= シミュレータ計算入力。威力・判定段に置く
function baseBody(m) {
  const fl = m.flags ? Object.keys(m.flags).filter(k => m.flags[k]).map(k => FLAG_JA[k] || k) : [];
  const p = [];
  if (fl.length) p.push(`<span class="bk">フラグ</span><b class="flagv">${esc(fl.join('・'))}</b>`);
  p.push(`<span class="bk">タイプ</span>${esc(m.type || '-')}`);
  p.push(`<span class="bk">分類</span>${esc(m.category || '-')}`);
  if (m.power) p.push(`<span class="bk">威力</span>${esc(m.power)}`);
  p.push(`<span class="bk">命中</span>${m.accuracy != null ? esc(m.accuracy) : '—(必中)'}`);
  p.push(`<span class="bk">接触</span>${m.contact ? 'あり' : 'なし'}`);
  p.push(`<span class="bk">PP</span>${esc(m.pp || '-')}`);
  p.push(`<span class="bk">まもり</span>${m.protect ? '防がれる' : '貫通'}`);
  return `<b class="base">基本データ</b> ` + p.join(' <span class="sep">/</span> ');
}
// 1技分を実行手順フローで描画(優先度→基本データ→効果。優先度は+0も表示)
function flow(mv, m) {
  const steps = [{ rank: 0, body: `優先度 ${mv.priority > 0 ? '+' : ''}${mv.priority != null ? mv.priority : 0}` }];
  steps.push({ rank: 1, body: baseBody(m), base: true });
  const effs = (mv.effects || []).map((e, i) => ({ e, i, r: execRank(e) })).sort((a, b) => a.r - b.r || a.i - b.i);
  for (const { e, r } of effs) steps.push({ rank: r, body: effBody(e) });
  return steps.map((s, i) =>
    `<div class="eff${s.base ? ' basebox' : ''}"><span class="step">${i + 1}</span><span class="timing">${esc(STAGE[s.rank])}</span><div class="ebody">${s.body}</div></div>`
  ).join('<div class="arrow">↓</div>');
}
function extra(mv) {
  const b = [];
  const tr = (arr) => arr.map(o => Object.entries(o).map(([k, v]) => (PK[k] || k) + '=' + jval(k, v)).join(' ')).join(' / ');
  if (mv.requires) b.push(`<div class="x req">前提: ${esc(tr(mv.requires))}</div>`);
  if (mv.fails_if) b.push(`<div class="x fail">失敗条件: ${esc(tr(mv.fails_if))}</div>`);
  if (mv.immune) b.push(`<div class="x imm">無効: ${esc(tr(mv.immune))}</div>`);
  if (mv.blocked_by) b.push(`<div class="x blk">防がれる: ${esc(mv.blocked_by.join('・'))}</div>`);
  if (mv.not_blocked_by) b.push(`<div class="x blk">貫通: ${esc(mv.not_blocked_by.join('・'))}</div>`);
  return b.join('');
}

// --- 技ファミリ分類 ---
const BIND = new Set(['しめつける', 'まきつく', 'すなじごく', 'トラバサミ', 'ほのおのうず', 'うずしお', 'まとわりつく', 'からではさむ', 'サンダープリズン', 'マグマストーム']);
const NAME_FAM = [
  ['パンチ系', n => n.includes('パンチ')],
  ['キック・けり系', n => n.includes('キック') || n.endsWith('げり') || n.endsWith('けり')],
  ['キバ系', n => n.includes('キバ')],
  ['はどう系', n => n.includes('はどう')],
  ['ビーム系', n => n.includes('ビーム')],
  ['舞・ダンス系', n => n.includes('まい') || n.includes('ダンス')],
  ['こな・ほうし系', n => n.includes('こな') || n.includes('ほうし')],
  ['バインド系', n => BIND.has(n)],
];
const GROUP_JA = { stat: '能力変化系', status: '状態異常系', heal: '回復・吸収系', power: '威力変動系', damage_modifier: 'ダメージ補正系',
  field: '場・フィールド系', screen: '壁系', hazard: '設置系', terrain: 'フィールド系', weather: '天候系', ability: '特性系',
  item: '持ち物系', switch: '交代系', trap: '拘束系', type: 'タイプ操作系', turn_order: '行動順系', accuracy: '命中系',
  crit: '急所系', charge: 'ため系', misc: 'その他効果' };
function familyOf(mv) {
  for (const [fam, test] of NAME_FAM) if (test(mv.name)) return fam;
  const e = (mv.effects || [])[0];
  if (!e) return '追加効果なし(純ダメージ)';
  return '【効果別】' + (GROUP_JA[kindGroup[e.kind]] || 'その他効果');
}

const FAM_ORDER = ['パンチ系', 'キック・けり系', 'キバ系', 'はどう系', 'ビーム系', '舞・ダンス系', 'こな・ほうし系', 'バインド系'];
const groups = {};
for (const mv of specs) (groups[familyOf(mv)] = groups[familyOf(mv)] || []).push(mv);
const orderedFams = [...FAM_ORDER.filter(f => groups[f]), ...Object.keys(groups).filter(f => !FAM_ORDER.includes(f)).sort()];

let sections = '';
for (const fam of orderedFams) {
  const rows = groups[fam].map(mv => {
    const m = map[mv.key] || {};
    return `<tr><td class="nm"><b>${esc(mv.name)}</b></td>
     <td class="ja">${esc(m.description_legacy || m.description || '')}</td>
     <td class="ef">${flow(mv, m)}${extra(mv)}</td></tr>`;
  }).join('\n');
  sections += `<h2>${esc(fam)} <span class="cnt">${groups[fam].length}技</span></h2>
   <table><thead><tr><th>技</th><th>説明(徹底攻略)</th><th>効果(日本語)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>効果構造化 — 全日本語・技ファミリ別(490技)</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3}
 header{position:sticky;top:0;background:#161b22;border-bottom:1px solid #30363d;padding:12px 18px;z-index:10}
 h1{font-size:16px;margin:0} .sub{font-size:12px;color:#9aa7b4;margin-top:4px}
 h2{font-size:15px;margin:22px 18px 6px;padding-bottom:5px;border-bottom:2px solid #a371f7;color:#d2a8ff} h2 .cnt{font-size:12px;color:#6e7681;font-weight:normal}
 table{border-collapse:collapse;width:100%;font-size:13px;margin-bottom:8px}
 th{position:sticky;top:48px;background:#21262d;text-align:left;padding:6px 9px;border-bottom:1px solid #30363d;font-size:12px;color:#9aa7b4}
 td{padding:9px;border-bottom:1px solid #21262d;vertical-align:top} .nm{width:120px} .nm .meta{font-size:11px;color:#8b949e;margin-top:2px}
 .ja{width:30%;color:#c9d1d9;line-height:1.5} .ef{width:auto}
 .eff{background:#15211a;border:1px solid #2a4a35;border-radius:6px;padding:5px 8px 5px 8px;margin:0;font-size:12px;line-height:1.6;display:flex;align-items:flex-start;gap:7px}
 .eff .step{flex:0 0 auto;width:18px;height:18px;border-radius:50%;background:#2a4a35;color:#7ee787;font-size:11px;text-align:center;line-height:18px;margin-top:1px}
 .eff .timing{flex:0 0 auto;background:#0d1f2d;color:#79c0ff;border-radius:4px;padding:1px 6px;font-size:11px;margin-top:1px;min-width:72px;text-align:center}
 .eff .ebody{flex:1 1 auto}
 .eff.basebox{background:#1a1d26;border-color:#39414f} .eff .base{color:#ffd479;font-size:12px;margin-right:4px}
 .eff .bk{color:#6e7681;font-size:10px;margin-right:2px} .eff .sep{color:#39414f} .eff .ebody:has(.base){color:#c9d1d9}
 .eff .flagv{color:#ffd479}
 .eff b{color:#7ee787;font-size:13px} .eff .en{color:#4a5560;font-size:10px;margin-left:5px;font-family:ui-monospace,monospace}
 .eff .t{color:#ffa657} .eff .ph{color:#9aa7b4;font-size:11px} .eff .p{margin-left:10px;color:#c9d1d9} .eff .p .k{color:#d2a8ff}
 .arrow{color:#3a5a45;font-size:11px;text-align:left;margin:1px 0 1px 8px;line-height:1}
 .none{color:#6e7681} .x{font-size:11px;border-radius:5px;padding:2px 7px;margin:4px 4px 0 0;display:inline-block}
 .prio{background:#1c2b1a;color:#7ee787} .flag{background:#2b2616;color:#e3b341} .req{background:#16263b;color:#79c0ff}
 .fail{background:#3b1618;color:#ff7b72} .imm{background:#2d2233;color:#d2a8ff} .blk{background:#21262d;color:#9aa7b4}
 tr:hover td{background:#161b22}
</style></head><body>
<header><h1>効果構造化 — 全日本語表記・技ファミリ別(${specs.length}技)</h1>
<div class="sub">kindは日本語対訳(小灰=英語キー)。対象=自分/相手/味方の場/場全体 等、実行=使用時/継続/遅延 等も日本語化。パンチ系・バインド系・舞系…の順、残りは効果グループ別。</div></header>
${sections}</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review/waza_effects_ja.html'), html);
console.log('生成: review/waza_effects_ja.html /', specs.length, '技');
console.log('ファミリ:', orderedFams.map(f => f + '(' + groups[f].length + ')').join(', '));
