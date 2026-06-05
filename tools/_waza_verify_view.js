/** 適用結果の検証HTML: ボタンフィルタ(効果グループ + flags系) + before/after */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/waza_apply_changes.json'), 'utf8'));
const findings = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/waza_audit_findings.json'), 'utf8')).findings;
const src = fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8');
const WAZA = new Function('window', 'document', 'navigator', 'console', src + '\n;return WAZA_MAP;')({}, {}, {}, console);
const byName = {}; Object.values(WAZA).forEach(m => byName[m.name] = m);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const removed = {};
for (const f of findings) (removed[f.move] = removed[f.move] || new Set()).add(f.tag);

const META = new Set(['has_secondary_effect', 'other_misc']);
// 効果グループ(代表1つ)
const GROUPS = [
  ['g_up_self', '能力↑(自分)', t => t.startsWith('up_self_') || t.startsWith('up_ally_')],
  ['g_down_opp', '能力↓(相手)', t => t.startsWith('down_opp_')],
  ['g_down_self', '能力↓(自分)', t => t.startsWith('down_self_') || t.startsWith('up_opp_')],
  ['g_inflict', '状態異常', t => t.startsWith('inflict_')],
  ['g_cure', '状態回復', t => t.startsWith('cure_')],
  ['g_acc', '命中・回避', t => t === 'never_miss' || t.includes('accuracy') || t.includes('evasion')],
  ['g_power', '威力補正', t => t.startsWith('power_')],
  ['g_dmg', 'ダメージ特殊', t => /^(drain_|recoil_|one_hit_ko|fixed_damage|always_crit|up_crit_rate|hit_\d|rampage_|ignore_type|no_effect_on_|counter_|use_|halve_target_hp|self_damage_on_fail|damage_by_hp|damage_only)/.test(t)],
  ['g_prio', '優先度', t => t.startsWith('priority_')],
  ['g_charge', '溜め/連続/ロック', t => /^(charge_|lock_|recharge_|self_bound|self_locked)/.test(t)],
  ['g_field', '場/天気/設置/壁', t => /^(set_field|set_weather|set_stealth|set_spikes|set_toxic|set_sticky|set_screen|set_aurora|set_mist|set_tailwind|set_self_floating|remove_field|clear_hazards|remove_screens)/.test(t)],
  ['g_switch', '交代/終了', t => /^(switch_|force_switch|faint_self|delayed_attack|drain_each_turn|heal_each_turn)/.test(t)],
  ['g_heal', 'HP回復', t => t.startsWith('heal_') || t.startsWith('cost_self_hp')],
  ['g_item', '道具/特性/タイプ操作', t => /^(steal_item|swap_item|remove_target_item|eat_or_steal_berry|reduce_target_pp|copy_target_ability|copy_target_stat|reset_stat|swap_self_|change_self_type|change_target_type|copy_last_move)/.test(t)],
  ['g_defense', '防御/みがわり/妨害', t => /^(protect_self|set_substitute|pierce_substitute|redirect_attacks|disable_target_move|prevent_target_switch)/.test(t)],
];
// flags系の「○○系」ファミリー
const FLAGS = [
  ['f_punch', '👊パンチ', m => m.flags && m.flags.punch],
  ['f_sound', '🔊音技', m => m.flags && m.flags.sound],
  ['f_ball', '🔵弾技', m => m.flags && m.flags.ball],
  ['f_pulse', '〰️波動', m => m.flags && m.flags.pulse],
  ['f_charge', '⏳溜め技', m => m.flags && m.flags.charge],
];

function effGroups(newTags) {
  const mean = newTags.filter(t => !META.has(t));
  const hit = GROUPS.filter(([id, , f]) => mean.some(f)).map(g => g[0]);
  if (!hit.length) hit.push('g_other');
  return hit;
}

// 行データ
const rows = data.changes.map(c => {
  const m = byName[c.name] || {};
  const cats = new Set(effGroups(c.newTags));
  FLAGS.forEach(([id, , f]) => { if (f(m)) cats.add(id); });
  // 似たものが隣接するよう、意味のある新タグ(metaを除く)を並べた署名でソート
  const sig = c.newTags.filter(t => !META.has(t)).slice().sort().join(' ');
  // 説明(ポケモン徹底攻略系の詳細テキスト)
  const desc = m.description_legacy || m.description || '';
  return { name: c.name, type: m.type || '', category: m.category || '', oldTags: c.oldTags, newTags: c.newTags, cats: [...cats], sig, desc };
});
// ①変化技を先頭 ②物理/特殊は混在(同順) ③新タグ署名順 ④技名
const catRank = cat => cat === '変化' ? 0 : 1;
rows.sort((a, b) =>
  catRank(a.category) - catRank(b.category) ||
  a.sig.localeCompare(b.sig, 'en') ||
  a.name.localeCompare(b.name, 'ja'));

// ボタン件数
const count = id => rows.filter(r => r.cats.includes(id)).length;
const groupBtns = GROUPS.map(([id, label]) => ({ id, label, n: count(id) }))
  .concat([{ id: 'g_other', label: 'その他', n: count('g_other') }]).filter(b => b.n);
const flagBtns = FLAGS.map(([id, label]) => ({ id, label, n: count(id) })).filter(b => b.n);

const CAT_CLS = { '変化': 'henka', '物理': 'butsuri', '特殊': 'tokushu' };
const catBadge = c => c ? `<span class="cat ${CAT_CLS[c] || ''}">${esc(c)}</span>` : '';
// セル内のタグ表示順を統一: has_secondary_effect=先頭 / other_misc=末尾 / 残りはアルファベット順
const TAG_RANK = { has_secondary_effect: 0, other_misc: 2 };
const orderTags = arr => arr.slice().sort((a, b) =>
  (TAG_RANK[a] ?? 1) - (TAG_RANK[b] ?? 1) || a.localeCompare(b, 'en'));
const tagSpan = (t, cls) => `<span class="t ${cls}">${esc(t)}</span>`;
const rowHtml = r => {
  const rem = removed[r.name] || new Set();
  const oldH = orderTags(r.oldTags).map(t => tagSpan(t, rem.has(t) ? 'del' : 'old')).join('');
  const newH = orderTags(r.newTags).map(t => tagSpan(t, 'new')).join('') || '<span class="muted">—</span>';
  return `<tr data-cat="${r.cats.join(' ')}" data-k="${esc(r.name)} ${esc(r.oldTags.join(' '))} ${esc(r.newTags.join(' '))} ${esc(r.desc)}">
    <td class="nm">${esc(r.name)}</td><td class="ty">${catBadge(r.category)}${esc(r.type)}</td><td>${oldH}</td><td class="ar">→</td><td>${newH}</td><td class="dsc">${esc(r.desc) || '—'}</td></tr>`;
};

const btnHtml = (b, kind) => `<button class="fbtn ${kind}" data-f="${b.id}">${esc(b.label)} <span class="bn">${b.n}</span></button>`;

const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>わざタグ 適用結果 — PchamDB</title><style>
:root{--bg:#0f1320;--card:#1a2032;--ink:#e9eef7;--muted:#93a0ba;--line:#2a3350;--orange:#FF7A00}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 -apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN",system-ui,sans-serif}
header{padding:16px 28px;background:linear-gradient(135deg,#1a2238,#101626);border-bottom:2px solid var(--orange)}
header h1{margin:0 0 4px;font-size:21px}.sub{color:var(--muted);font-size:13px}
.bar{position:sticky;top:0;z-index:9;background:#0c1020;border-bottom:1px solid var(--line);padding:10px 28px}
.bar .lbl{color:var(--muted);font-size:12px;margin:0 8px 0 0}
.fbtn{background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:16px;padding:6px 13px;margin:3px;cursor:pointer;font-size:14px}
.fbtn:hover{border-color:var(--orange)}
.fbtn.active{background:var(--orange);color:#1a1206;border-color:var(--orange);font-weight:700}
.fbtn .bn{opacity:.6;font-size:12px}.fbtn.active .bn{opacity:.85}
.fbtn.all{background:#2a3350}.fbtn.all.active{background:var(--orange)}
#q{background:#0c1322;border:1px solid var(--line);color:var(--ink);border-radius:10px;padding:8px 13px;font-size:15px;width:min(420px,70vw);margin-left:8px}
.wrap{padding:14px 28px;max-width:2200px;margin:0 auto}
#cnt{color:var(--muted);font-size:14px;margin:6px 0 10px}
table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{padding:8px 12px;border-top:1px solid var(--line);text-align:left;vertical-align:top}
th{color:#c4d6f7;font-size:13px;background:#222a40}
.nm{font-weight:700;white-space:nowrap;font-size:15px;min-width:140px}
.dsc{color:var(--muted);font-size:12px;line-height:1.6;min-width:280px;max-width:460px;white-space:normal}
.ty{color:var(--muted);font-size:13px;white-space:nowrap}
.cat{display:inline-block;border-radius:6px;padding:1px 7px;margin-right:6px;font-size:12px;font-weight:700}
.cat.henka{background:#1c3326;color:#9beab6;border:1px solid #2f6b41}
.cat.butsuri{background:#3a2420;color:#ffc4ad;border:1px solid #6a4136}
.cat.tokushu{background:#1f2a44;color:#a9c8e8;border:1px solid #3a5384}
.ar{color:var(--muted);width:24px;text-align:center}.muted{color:var(--muted)}
.t{display:inline-block;border-radius:9px;padding:2px 9px;margin:2px 3px;font:13px/1.5 ui-monospace,Menlo,monospace}
.t.old{background:#26304d;color:#acd6ff;border:1px solid #3a5384}
.t.del{background:#3a1f1f;color:#ffadad;border:1px solid #6a3636;text-decoration:line-through}
.t.new{background:#163a22;color:#a9ecb6;border:1px solid #2f6b41}
</style></head><body>
<header><h1>✅ わざタグ 適用結果（ボタンで絞り込み / before→after）</h1>
<div class="sub">490技維持・誤タグ141削除(残存0)・可読リネーム済 ／ ボタンで効果別・○○系で絞れます ／ 並び:変化技→物理特殊・新タグ順 ／ 右端の説明列=ポケモン徹底攻略系(description_legacy)</div></header>
<div class="bar">
  <div><span class="lbl">効果:</span><button class="fbtn all active" data-f="all">All <span class="bn">${rows.length}</span></button>${groupBtns.map(b => btnHtml(b, 'grp')).join('')}</div>
  <div style="margin-top:6px"><span class="lbl">○○系(flags):</span>${flagBtns.map(b => btnHtml(b, 'flag')).join('')}<input id="q" type="text" placeholder="🔍 技名・タグ"></div>
</div>
<div class="wrap">
<div id="cnt"></div>
<table><thead><tr><th>技</th><th>型</th><th>旧タグ（赤＝削除）</th><th></th><th>新タグ</th><th>説明（ポケモン徹底攻略）</th></tr></thead><tbody>${rows.map(rowHtml).join('')}</tbody></table>
</div>
<script>
const rowsEl=[...document.querySelectorAll('tbody tr')],btns=[...document.querySelectorAll('.fbtn')],q=document.getElementById('q'),cnt=document.getElementById('cnt');
let cur='all';
function u(){const v=q.value.trim().toLowerCase();let n=0;rowsEl.forEach(r=>{const okCat=cur==='all'||r.dataset.cat.split(' ').includes(cur);const okQ=!v||r.dataset.k.toLowerCase().includes(v);const s=okCat&&okQ;r.style.display=s?'':'none';if(s)n++;});cnt.textContent=n+' / '+rowsEl.length+' 技';}
btns.forEach(b=>b.addEventListener('click',()=>{cur=b.dataset.f;btns.forEach(x=>x.classList.toggle('active',x===b));u();}));
q.addEventListener('input',u);u();
</script>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review/waza_apply_result.html'), html);
console.log('出力: review/waza_apply_result.html / 効果ボタン:', groupBtns.length, '/ flagボタン:', flagBtns.length);
