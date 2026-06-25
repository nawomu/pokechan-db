// 裏管理用マスタービュー: 全公式技(reference/moves_master) × プロジェクト状態(WAZA_MAP) を統合。
// 表には出さない(_プレフィックス・非リンク)。どの技がDB有/effects有/説明有/タグ有かを一覧管理。
// 実行: node tools/_build_master_admin.js
const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync('pokechan_data.js','utf8');
const sb={};vm.runInContext(code+';globalThis.__W=WAZA_MAP;globalThis.__P=POKEMON_LIST;',vm.createContext(sb));
const W=sb.__W,P=sb.__P;
const official=JSON.parse(fs.readFileSync('reference/moves_master.json','utf8'));
// WAZA_MAP: ja名→entry
const byJa={}; for(const k in W){const m=W[k]; if(m&&m.name) byJa[m.name]=m;}
const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function moveStatus(m){
  const eff=(m.battle_data&&m.battle_data.effects)||[];
  const desc=(m.description||'').trim();
  return {inDB:true, nEff:eff.length, hasDesc:!!desc, desc, learners:(m.learners||[]).length, power:m.power,accuracy:m.accuracy,pp:m.pp,type:m.type,category:m.category};
}
// 統合: 公式937 + プロジェクト固有(Champions独自=公式に無い)
const TYPE_JA={normal:'ノーマル',fire:'ほのお',water:'みず',electric:'でんき',grass:'くさ',ice:'こおり',fighting:'かくとう',poison:'どく',ground:'じめん',flying:'ひこう',psychic:'エスパー',bug:'むし',rock:'いわ',ghost:'ゴースト',dragon:'ドラゴン',dark:'あく',steel:'はがね',fairy:'フェアリー'};
const rows=[];
const seenJa=new Set();
for(const o of official){
  const ja=o.names.ja||''; seenJa.add(ja);
  const inDB=byJa[ja];
  rows.push({
    no:o.id, slug:o.slug, ja, en:o.names.en, type:TYPE_JA[o.type]||o.type, dclass:o.damage_class,
    power:o.power,accuracy:o.accuracy,pp:o.pp,priority:o.priority, effect_en:o.effect_en,
    inDB:!!inDB, nEff:inDB?moveStatus(inDB).nEff:0, hasDesc:inDB?moveStatus(inDB).hasDesc:false,
    desc:inDB?moveStatus(inDB).desc:'', champions:false,
  });
}
// Champions独自(WAZA_MAPに在るが公式マスターに無い)
for(const k in W){const m=W[k]; if(!m||!m.name)continue; if(seenJa.has(m.name))continue;
  const s=moveStatus(m);
  rows.push({no:m.move_no||'',slug:k,ja:m.name,en:'',type:m.type,dclass:m.category,power:m.power,accuracy:m.accuracy,pp:m.pp,priority:(m.battle_data&&m.battle_data.priority)||0,effect_en:'',inDB:true,nEff:s.nEff,hasDesc:s.hasDesc,desc:s.desc,champions:true});
}
rows.sort((a,b)=>(a.no||9999)-(b.no||9999));
const inDB=rows.filter(r=>r.inDB).length, champ=rows.filter(r=>r.champions).length;
const need=rows.filter(r=>r.inDB&&(r.nEff===0||!r.hasDesc)).length;
function badge(r){
  if(!r.inDB) return '<span class="b miss">未収録</span>';
  if(r.champions) return '<span class="b champ">独自</span>';
  let b='';
  b+=r.nEff>0?'<span class="b ok">eff'+r.nEff+'</span>':'<span class="b ng">eff無</span>';
  b+=r.hasDesc?'<span class="b ok">説明✓</span>':'<span class="b ng">説明✗</span>';
  return b;
}
const tr=rows.map(r=>`<tr class="${!r.inDB?'r-miss':r.champions?'r-champ':''}">
<td>${r.no}</td><td class="ja">${esc(r.ja)}</td><td class="en">${esc(r.en)}</td><td>${esc(r.type)}</td><td>${esc(r.dclass||'')}</td>
<td>${r.power??''}</td><td>${r.accuracy??''}</td><td>${r.pp??''}</td><td>${r.priority||0}</td>
<td>${badge(r)}</td><td class="desc">${esc(r.desc)}</td><td class="eff">${esc(r.effect_en)}</td>
<td><input type="checkbox" class="chk" data-slug="${esc(r.slug)}"></td></tr>`).join('');
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>裏管理: 全技マスター</title><style>
body{font-family:system-ui,'Hiragino Kaku Gothic ProN',sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:13px}
h1{font-size:17px;padding:12px 16px;margin:0;background:#1F4E79;position:sticky;top:0;z-index:5}
.bar{padding:8px 16px;background:#11161c;position:sticky;top:42px;z-index:4;font-size:12px;color:#9ec5ff}
.bar input{margin-left:10px;padding:4px 8px;background:#1c2740;border:1px solid #30425f;color:#fff;border-radius:5px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border:1px solid #232c3a;padding:3px 6px;text-align:left;vertical-align:top}
th{background:#1c2740;position:sticky;top:80px;color:#9ec5ff;font-size:11px}
td.ja{color:#ffd479;white-space:nowrap}.td.en,td.en{color:#8aa3bb}.desc{max-width:280px}.eff{max-width:260px;color:#7d8aa0;font-size:11px}
tr.r-miss{background:#2a1820}tr.r-champ{background:#1a2230}
.b{display:inline-block;padding:0 5px;border-radius:4px;font-size:10px;font-weight:700;margin:1px}
.b.ok{background:#1d6e3a}.b.ng{background:#7a2230}.b.miss{background:#6b4a1a}.b.champ{background:#3a2a6b}
tr:nth-child(even){background:#141b2b}
</style></head><body>
<h1>🗂 裏管理: 全技マスター(${rows.length}件 = 公式${official.length} + 独自${champ}) ※非公開・管理用</h1>
<div class="bar">DB収録 ${inDB} / 公式未収録 ${rows.length-inDB-0} / 独自 ${champ} / <b style="color:#ffb454">要作業(eff無 or 説明無)= ${need}</b>
<input id="q" placeholder="絞り込み" oninput="document.querySelectorAll('tbody tr').forEach(r=>r.style.display=r.textContent.includes(this.value)?'':'none')">
<label style="margin-left:10px"><input type="checkbox" id="needonly" onchange="document.querySelectorAll('tbody tr').forEach(r=>{if(this.checked)r.style.display=/eff無|説明✗/.test(r.textContent)?'':'none';else r.style.display=''})"> 要作業のみ</label></div>
<table><thead><tr><th>No</th><th>技名</th><th>en</th><th>タイプ</th><th>分類</th><th>威力</th><th>命中</th><th>PP</th><th>優先</th><th>状態</th><th>説明文(JA)</th><th>公式effect(en)</th><th>確認</th></tr></thead>
<tbody>${tr}</tbody></table>
<script>(function(){var K='pcham_mv_chk';var st={};try{st=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
document.querySelectorAll('input.chk').forEach(function(c){if(st[c.dataset.slug])c.checked=true;c.addEventListener('change',function(){st[c.dataset.slug]=c.checked;try{localStorage.setItem(K,JSON.stringify(st))}catch(e){}});});})();</script>
</body></html>`;
fs.writeFileSync('review/_master_moves.html',html);
console.log(`review/_master_moves.html: 全${rows.length}技(公式${official.length}+独自${champ}) / DB収録${inDB} / 要作業${need}`);

// ===== 全ポケモン管理ビュー =====
(function(){
const pm=JSON.parse(fs.readFileSync('reference/pokeapi_master.json','utf8'));
const projNames=new Set(P.map(p=>p.name));
const projByName={}; P.forEach(p=>projByName[p.name]=p);
const TYPE_JA={normal:'ノーマル',fire:'ほのお',water:'みず',electric:'でんき',grass:'くさ',ice:'こおり',fighting:'かくとう',poison:'どく',ground:'じめん',flying:'ひこう',psychic:'エスパー',bug:'むし',rock:'いわ',ghost:'ゴースト',dragon:'ドラゴン',dark:'あく',steel:'はがね',fairy:'フェアリー'};
// official variety → 推定プロジェクト名(基本=species_ja / メガ / 地方)
const FORM_SUF={'alola':'(アローラ)','galar':'(ガラル)','hisui':'(ヒスイ)','paldea':'(パルデア)'};
function projCandidates(v){
  const sj=v.species_names.ja||''; const cands=[sj];
  if(v.is_mega){ let suf=''; if(/-x$/.test(v.form_slug))suf='X'; else if(/-y$/.test(v.form_slug))suf='Y'; cands.push('メガ'+sj+suf); }
  for(const k in FORM_SUF){ if((v.form_slug||'').includes(k)) cands.push(sj+FORM_SUF[k]); }
  return cands;
}
const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const rows=pm.map(v=>{
  const cands=projCandidates(v);
  const hit=cands.find(c=>projNames.has(c));
  const st=v.stats;
  return {dex:v.dex,ja:v.species_names.ja,en:v.species_names.en,form:v.form_slug||'',is_mega:v.is_mega,is_default:v.is_default,
    types:v.types.map(t=>TYPE_JA[t]||t).join('/'),
    stats:[st.hp,st.atk,st.def,st.spa,st.spd,st.spe].join('/'),total:(st.hp+st.atk+st.def+st.spa+st.spd+st.spe),
    abil:v.abilities.map(a=>a.name+(a.hidden?'(隠)':'')).join(','),
    inDB:!!hit, projName:hit||''};
});
const inDB=rows.filter(r=>r.inDB).length;
const tr=rows.map(r=>`<tr class="${r.inDB?'r-in':r.is_default?'':'r-form'}">
<td>${r.dex}</td><td class="ja">${esc(r.ja)}${r.form?'<span class=fm>['+esc(r.form)+']</span>':''}</td><td class=en>${esc(r.en)}</td>
<td>${esc(r.types)}</td><td class=st>${r.stats}</td><td>${r.total}</td><td class=ab>${esc(r.abil)}</td>
<td>${r.inDB?'<span class="b ok">DB有</span>':(r.is_default?'<span class="b miss">未収録</span>':'<span class="b form">フォルム</span>')}</td>
<td class=ja>${esc(r.projName)}</td></tr>`).join('');
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>裏管理: 全ポケモンマスター</title><style>
body{font-family:system-ui,'Hiragino Kaku Gothic ProN',sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:13px}
h1{font-size:17px;padding:12px 16px;margin:0;background:#1F4E79;position:sticky;top:0;z-index:5}
.bar{padding:8px 16px;background:#11161c;position:sticky;top:42px;z-index:4;font-size:12px;color:#9ec5ff}
.bar input{margin-left:10px;padding:4px 8px;background:#1c2740;border:1px solid #30425f;color:#fff;border-radius:5px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border:1px solid #232c3a;padding:3px 6px;text-align:left;white-space:nowrap}
th{background:#1c2740;position:sticky;top:80px;color:#9ec5ff;font-size:11px}
td.ja{color:#ffd479}.en{color:#8aa3bb}.st{color:#9ec5ff}.ab{color:#7d8aa0;font-size:11px}.fm{color:#8a7;font-size:10px;margin-left:3px}
tr.r-in{background:#13241a}tr.r-form{background:#1a1622}
.b{display:inline-block;padding:0 5px;border-radius:4px;font-size:10px;font-weight:700}
.b.ok{background:#1d6e3a}.b.miss{background:#6b4a1a}.b.form{background:#3a2a6b}
tr:nth-child(even){background:#141b2b}
</style></head><body>
<h1>🗂 裏管理: 全ポケモンマスター(${rows.length} variety = 公式全フォルム) ※非公開・管理用</h1>
<div class="bar">プロジェクトDB収録(推定) ${inDB} / 全variety ${rows.length}
<input id="q" placeholder="絞り込み" oninput="document.querySelectorAll('tbody tr').forEach(r=>r.style.display=r.textContent.includes(this.value)?'':'none')">
<label style="margin-left:10px"><input type="checkbox" onchange="document.querySelectorAll('tbody tr').forEach(r=>{if(this.checked)r.style.display=/DB有/.test(r.textContent)?'':'none';else r.style.display=''})"> DB収録のみ</label></div>
<table><thead><tr><th>図鑑</th><th>名前(ja)</th><th>en</th><th>タイプ</th><th>HP/攻/防/特攻/特防/速</th><th>合計</th><th>特性</th><th>状態</th><th>DB名</th></tr></thead>
<tbody>${tr}</tbody></table></body></html>`;
fs.writeFileSync('review/_master_pokemon.html',html);
console.log(`review/_master_pokemon.html: 全${rows.length}variety / DB収録(推定)${inDB}`);
})();
