// 裏管理用マスタービュー: 全公式技/ポケ × プロジェクト状態 を統合した管理台帳(非公開・_プレフィックス)。
// waza_list_confirm 流のUX: 上部に進捗バー / 右側チェックで行を畳む(localStorage保存) / 状態グループ別。
// 実行: node tools/_build_master_admin.js
const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync('pokechan_data.js','utf8');
const sb={};vm.runInContext(code+';globalThis.__W=WAZA_MAP;globalThis.__P=POKEMON_LIST;',vm.createContext(sb));
const W=sb.__W,P=sb.__P;
const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const TYPE_JA={normal:'ノーマル',fire:'ほのお',water:'みず',electric:'でんき',grass:'くさ',ice:'こおり',fighting:'かくとう',poison:'どく',ground:'じめん',flying:'ひこう',psychic:'エスパー',bug:'むし',rock:'いわ',ghost:'ゴースト',dragon:'ドラゴン',dark:'あく',steel:'はがね',fairy:'フェアリー'};

// ========== 全技マスター ==========
(function(){
const official=JSON.parse(fs.readFileSync('reference/moves_master.json','utf8'));
const byJa={}; for(const k in W){const m=W[k]; if(m&&m.name) byJa[m.name]=m;}
const MB_NEW=new Set(['どくばりセンボン','ひっくりかえす','どげざつき','ソウルクラッシュ','はいすいのじん','ふんどのこぶし','ゴールドラッシュ','コインビーム']);
function season(r){ if(!r.inDB) return '未対応'; if(MB_NEW.has(r.ja)) return 'M-B'; return 'M-A'; }
function seasonBdg(s){const c={'M-A':'s-ma','M-B':'s-mb','未対応':'s-todo'}[s]||'s-base';return `<span class="sbg ${c}">${s}</span>`;}
function ms(m){const eff=(m.battle_data&&m.battle_data.effects)||[];return {nEff:eff.length,desc:(m.description||'').trim()};}
const rows=[]; const seen=new Set();
for(const o of official){const ja=o.names.ja||'';seen.add(ja);const m=byJa[ja];const s=m?ms(m):null;
  rows.push({no:o.id,slug:o.slug,ja,en:o.names.en,type:TYPE_JA[o.type]||o.type,dclass:o.damage_class,power:o.power,accuracy:o.accuracy,pp:o.pp,priority:o.priority,effect_en:o.effect_en,
    inDB:!!m,nEff:s?s.nEff:0,desc:s?s.desc:'',champ:false});}
for(const k in W){const m=W[k];if(!m||!m.name||seen.has(m.name))continue;const s=ms(m);
  rows.push({no:m.move_no||'',slug:k,ja:m.name,en:'',type:m.type,dclass:m.category,power:m.power,accuracy:m.accuracy,pp:m.pp,priority:(m.battle_data&&m.battle_data.priority)||0,effect_en:'',inDB:true,nEff:s.nEff,desc:s.desc,champ:true});}
function group(r){ if(!r.inDB) return 'todo'; if(r.champ) return 'champ'; if(r.nEff===0||!r.desc) return 'work'; return 'done'; }
const GROUPS=[['work','🔨 要作業(effects無 or 説明無)','#C77800'],['todo','⚠ 未収録(公式だがDB未追加)','#7a5a2a'],['champ','🟣 Champions独自','#6A1B9A'],['done','✓ DB済(effects+説明あり)','#2E7D32']];
const counts={}; GROUPS.forEach(([g])=>counts[g]=rows.filter(r=>group(r)===g).length);
function badge(r){const g=group(r);
  if(g==='todo')return '<span class="b miss">未収録</span>';
  if(g==='champ')return '<span class="b champ">独自</span>'+(r.nEff>0?'<span class="b ok">eff'+r.nEff+'</span>':'')+(r.desc?'<span class="b ok">説明✓</span>':'');
  return (r.nEff>0?'<span class="b ok">eff'+r.nEff+'</span>':'<span class="b ng">eff無</span>')+(r.desc?'<span class="b ok">説明✓</span>':'<span class="b ng">説明✗</span>');}
function rowHtml(r){return `<tr data-slug="${esc(r.slug)}"><td class="chkcell"><input type="checkbox" class="chk" data-slug="${esc(r.slug)}" title="確認OKで畳む"></td>
<td>${seasonBdg(r.champ?'独自':season(r))}</td>
<td>${r.no}</td><td class="ja">${esc(r.ja)}</td><td class="en">${esc(r.en)}</td><td>${esc(r.type)}</td><td>${esc(r.dclass||'')}</td>
<td>${r.power??''}</td><td>${r.accuracy??''}</td><td>${r.pp??''}</td><td>${r.priority||0}</td>
<td>${badge(r)}</td><td class="desc">${esc(r.desc)}</td><td class="eff">${esc(r.effect_en)}</td></tr>`;}
const sections=GROUPS.map(([g,label,color])=>{const rs=rows.filter(r=>group(r)===g);if(!rs.length)return '';
  return `<section class="sec" data-g="${g}"><h2 class="sec-h" style="border-color:${color};color:${color}"><span class="caret">▾</span>${label} <span class="sec-n">${rs.length}技</span><span class="sec-prog" data-g="${g}"></span></h2>
  <table><thead><tr><th>✓</th><th>季</th><th>No</th><th>技名</th><th>en</th><th>型</th><th>分類</th><th>威</th><th>命</th><th>PP</th><th>優</th><th>状態</th><th>説明文(JA)</th><th>公式effect(en)</th></tr></thead><tbody>${rs.map(rowHtml).join('')}</tbody></table></section>`;}).join('');
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>裏管理: 全技マスター</title><style>
body{font-family:system-ui,'Hiragino Kaku Gothic ProN',sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:13px}
h1{font-size:16px;padding:11px 16px;margin:0;background:#1F4E79;position:sticky;top:0;z-index:10}
.prog{padding:9px 16px;background:#11161c;position:sticky;top:40px;z-index:9;font-size:12.5px;border-bottom:1px solid #233}
.prog b{color:#ffd479}.prog .pw{color:#ffb454}.prog .pd{color:#7ee787}.prog .pc{color:#b39ddb}.prog .pok{color:#56d364}
.prog input{margin-left:10px;padding:4px 8px;background:#1c2740;border:1px solid #30425f;color:#fff;border-radius:5px}
.sec{margin:0}.sec-h{font-size:14px;margin:0;padding:8px 16px;background:#0c1118;border-top:1px solid #222;border-left:4px solid;position:sticky;top:74px;z-index:8;cursor:pointer}
.sec-n{color:#8aa3bb;font-size:11px;margin-left:6px}.sec-prog{font-size:11px;color:#8aa3bb;margin-left:8px}
.caret{display:inline-block;width:14px}.sec.collapsed .caret{transform:rotate(-90deg)}.sec.collapsed table{display:none}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border:1px solid #232c3a;padding:3px 6px;text-align:left;vertical-align:top}
th{background:#1c2740;color:#9ec5ff;font-size:11px}
td.ja{color:#ffd479;white-space:nowrap}td.en{color:#8aa3bb}.desc{max-width:300px}.eff{max-width:260px;color:#7d8aa0;font-size:11px}
.chkcell{text-align:center}.chk{transform:scale(1.2)}
tr.checked{opacity:.3;text-decoration:line-through}
.b{display:inline-block;padding:0 5px;border-radius:4px;font-size:10px;font-weight:700;margin:1px}
.b.ok{background:#1d6e3a}.b.ng{background:#7a2230}.b.miss{background:#6b4a1a}.b.champ{background:#3a2a6b}
.sbg{display:inline-block;padding:0 5px;border-radius:4px;font-size:10px;font-weight:700}
.sbg.s-ma{background:#2b4a6b;color:#cfe0f5}.sbg.s-mb{background:#FF7A00;color:#fff}.sbg.s-todo{background:#5a4a2a;color:#ffd479}.sbg.s-base{background:#3a2a6b;color:#cbb}
tbody tr:nth-child(even){background:#141b2b}
</style></head><body>
<h1>🗂 裏管理: 全技マスター(${rows.length}技 = 公式${official.length}+独自${counts.champ||0}) ※非公開・管理用</h1>
<div class="prog">📊 進捗：<b class="pw">🔨要作業 ${counts.work}</b> ｜ <b class="pd">✓DB済 ${counts.done}</b> ｜ <b>⚠未収録 ${counts.todo}</b> ｜ <b class="pc">🟣独自 ${counts.champ||0}</b> ｜ <b class="pok">確認済 <span id="ck">0</span></b>/${rows.length}
<input id="q" placeholder="絞り込み" oninput="filt(this.value)">
<label style="margin-left:8px"><input type="checkbox" id="hide" onchange="applyHide()"> 確認済を隠す</label></div>
${sections}
<script>
var K='pcham_master_mv';var st={};try{st=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
function save(){try{localStorage.setItem(K,JSON.stringify(st))}catch(e){}}
function refresh(){
  document.getElementById('ck').textContent=Object.values(st).filter(Boolean).length;
  document.querySelectorAll('section.sec').forEach(function(sec){var tot=0,ck=0;sec.querySelectorAll('tr[data-slug]').forEach(function(r){tot++;if(st[r.dataset.slug])ck++;});sec.querySelector('.sec-prog').textContent='('+ck+'/'+tot+' 確認)';});
}
document.querySelectorAll('input.chk').forEach(function(c){
  if(st[c.dataset.slug]){c.checked=true;c.closest('tr').classList.add('checked');}
  c.addEventListener('change',function(){st[c.dataset.slug]=c.checked;c.closest('tr').classList.toggle('checked',c.checked);save();refresh();applyHide();});
});
function applyHide(){var h=document.getElementById('hide').checked;document.querySelectorAll('tr[data-slug]').forEach(function(r){if(h&&st[r.dataset.slug])r.style.display='none';else r.style.display='';});}
function filt(q){document.querySelectorAll('tr[data-slug]').forEach(function(r){r.style.display=r.textContent.includes(q)?'':'none';});}
document.querySelectorAll('.sec-h').forEach(function(h){h.addEventListener('click',function(e){if(e.target.tagName==='INPUT')return;h.parentElement.classList.toggle('collapsed');});});
refresh();
</script>
</body></html>`;
fs.writeFileSync('review/_master_moves.html',html);
console.log(`review/_master_moves.html: 全${rows.length}技 / 要作業${counts.work} / DB済${counts.done} / 未収録${counts.todo} / 独自${counts.champ||0}`);
})();

// ========== 全ポケモンマスター ==========
(function(){
const pm=JSON.parse(fs.readFileSync('reference/pokeapi_master.json','utf8'));
const projNames=new Set(P.map(p=>p.name));
const projSeason={}; P.forEach(p=>{projSeason[p.name]=p.added_in||'M-A';});
function pSeasonBdg(s){const c={'M-A':'s-ma','M-B':'s-mb','未対応':'s-todo'}[s]||'s-todo';return `<span class="sbg ${c}">${s}</span>`;}
const FORM_SUF={'alola':'(アローラ)','galar':'(ガラル)','hisui':'(ヒスイ)','paldea':'(パルデア)'};
function cands(v){const sj=v.species_names.ja||'';const c=[];if(v.is_mega){let s='';if(/-x$/.test(v.form_slug))s='X';else if(/-y$/.test(v.form_slug))s='Y';c.push('メガ'+sj+s);}for(const k in FORM_SUF)if((v.form_slug||'').includes(k))c.push(sj+FORM_SUF[k]);c.push(sj);return c;}
const rows=pm.map(v=>{const hit=cands(v).find(c=>projNames.has(c));const st=v.stats;
  return {dex:v.dex,ja:v.species_names.ja,en:v.species_names.en,form:v.form_slug||'',is_default:v.is_default,
    types:v.types.map(t=>TYPE_JA[t]||t).join('/'),stats:[st.hp,st.atk,st.def,st.spa,st.spd,st.spe].join('/'),
    total:(st.hp+st.atk+st.def+st.spa+st.spd+st.spe),abil:v.abilities.map(a=>a.name+(a.hidden?'(隠)':'')).join(','),inDB:!!hit,projName:hit||'',
    season:hit?(projSeason[hit]||'M-A'):'未対応'};});
// プロジェクト固有(公式マスターに無い=Champions独自メガ等)を独自行として追加
const matched=new Set(rows.filter(r=>r.inDB).map(r=>r.projName));
for(const p of P){ if(matched.has(p.name))continue;
  const t=[p.type1,p.type2].filter(Boolean).map(x=>TYPE_JA[x]||x).join('/');
  rows.push({dex:p.no||'',ja:p.name,en:'',form:'(独自)',is_default:false,types:t||(p.type1||''),
    stats:[p.hp,p.atk,p.def,p.spatk,p.spdef,p.spd].join('/'),total:p.total||((p.hp||0)+(p.atk||0)+(p.def||0)+(p.spatk||0)+(p.spdef||0)+(p.spd||0)),
    abil:[p.ab1,p.ab2,p.ab3].filter(Boolean).join(','),inDB:true,projName:p.name,season:p.added_in||'M-A',champ:true});}
const inDB=rows.filter(r=>r.inDB).length;
const nMB=rows.filter(r=>r.season==='M-B').length, nMA=rows.filter(r=>r.season==='M-A').length;
const tr=rows.map(r=>`<tr data-slug="p${r.dex}_${esc(r.form)}" class="${r.inDB?'r-in':r.is_default?'':'r-form'}">
<td class="chkcell"><input type="checkbox" class="chk" data-slug="p${r.dex}_${esc(r.form)}"></td>
<td>${pSeasonBdg(r.season)}</td><td>${r.dex}</td><td class="ja">${esc(r.ja)}${r.form?'<span class=fm>['+esc(r.form)+']</span>':''}</td><td class=en>${esc(r.en)}</td>
<td>${esc(r.types)}</td><td class=st>${r.stats}</td><td>${r.total}</td><td class=ab>${esc(r.abil)}</td>
<td>${r.champ?'<span class="b form">独自</span>':r.inDB?'<span class="b ok">DB有</span>':(r.is_default?'<span class="b miss">未収録</span>':'<span class="b form">フォルム</span>')}</td><td class=ja>${esc(r.projName)}</td></tr>`).join('');
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>裏管理: 全ポケモンマスター</title><style>
body{font-family:system-ui,'Hiragino Kaku Gothic ProN',sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:13px}
h1{font-size:16px;padding:11px 16px;margin:0;background:#1F4E79;position:sticky;top:0;z-index:10}
.prog{padding:9px 16px;background:#11161c;position:sticky;top:40px;z-index:9;font-size:12.5px;border-bottom:1px solid #233}
.prog b{color:#ffd479}.prog input{margin-left:10px;padding:4px 8px;background:#1c2740;border:1px solid #30425f;color:#fff;border-radius:5px}
table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #232c3a;padding:3px 6px;text-align:left;white-space:nowrap}
th{background:#1c2740;position:sticky;top:74px;color:#9ec5ff;font-size:11px}
td.ja{color:#ffd479}.en{color:#8aa3bb}.st{color:#9ec5ff}.ab{color:#7d8aa0;font-size:11px}.fm{color:#8a7;font-size:10px;margin-left:3px}.chkcell{text-align:center}
tr.r-in{background:#13241a}tr.r-form{background:#1a1622}tr.checked{opacity:.3}
.b{display:inline-block;padding:0 5px;border-radius:4px;font-size:10px;font-weight:700}.b.ok{background:#1d6e3a}.b.miss{background:#6b4a1a}.b.form{background:#3a2a6b}
.sbg{display:inline-block;padding:0 5px;border-radius:4px;font-size:10px;font-weight:700}
.sbg.s-ma{background:#2b4a6b;color:#cfe0f5}.sbg.s-mb{background:#FF7A00;color:#fff}.sbg.s-todo{background:#5a4a2a;color:#ffd479}
tbody tr:nth-child(even){background:#141b2b}
</style></head><body>
<h1>🗂 裏管理: 全ポケモンマスター(${rows.length} variety) ※非公開・管理用</h1>
<div class="prog">📊 <b>DB収録(推定) ${inDB}</b> / 全variety ${rows.length} ｜ <span class="sbg s-mb">M-B</span> ${nMB} ｜ <span class="sbg s-ma">M-A</span> ${nMA} ｜ <span class="sbg s-todo">未対応</span> ${rows.length-inDB} ｜ 確認済 <span id="ck">0</span>
<input id="q" placeholder="絞り込み" oninput="filtP(this.value)">
<label style="margin-left:8px"><input type="checkbox" onchange="hideP(this.checked)"> DB収録のみ</label></div>
<table><thead><tr><th>✓</th><th>季</th><th>図鑑</th><th>名前</th><th>en</th><th>タイプ</th><th>H/A/B/C/D/S</th><th>合計</th><th>特性</th><th>状態</th><th>DB名</th></tr></thead><tbody>${tr}</tbody></table>
<script>var K='pcham_master_pk';var st={};try{st=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
function rc(){document.getElementById('ck').textContent=Object.values(st).filter(Boolean).length;}
function filtP(q){document.querySelectorAll('tr[data-slug]').forEach(function(r){r.style.display=r.textContent.includes(q)?'':'none';});}
function hideP(h){document.querySelectorAll('tr[data-slug]').forEach(function(r){if(h&&!/DB有/.test(r.textContent))r.style.display='none';else r.style.display='';});}
document.querySelectorAll('input.chk').forEach(function(c){if(st[c.dataset.slug]){c.checked=true;c.closest('tr').classList.add('checked');}c.addEventListener('change',function(){st[c.dataset.slug]=c.checked;c.closest('tr').classList.toggle('checked',c.checked);try{localStorage.setItem(K,JSON.stringify(st))}catch(e){}rc();});});rc();</script>
</body></html>`;
fs.writeFileSync('review/_master_pokemon.html',html);
console.log(`review/_master_pokemon.html: 全${rows.length}variety / DB収録(推定)${inDB}`);
})();
