// 全部入りポケモンDB(メインシリーズ全世代)公開ページ生成。Champions専用DBとは別。
// 元データ=reference/pokeapi_master.json(全1302variety)。
// 絵=自作オリジナル絵(images/sim)既定(AdSense対策・案A・2026-07-20 阿部さん確定)。PokeAPI公式絵は初期表示に出さない。
// 実行: node tools/_build_pokemon_db_all.js → pokemon_db_all.html
const fs=require('fs');
const D=JSON.parse(fs.readFileSync('reference/pokeapi_master.json','utf8'));
const ABJA={};JSON.parse(fs.readFileSync('reference/abilities_master.json','utf8')).forEach(a=>{ABJA[a.slug]=a.names.ja||a.names.en||a.slug;});
const abj=s=>ABJA[s]||s;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const enc=s=>encodeURIComponent(s);
const TYPE_JA={normal:'ノーマル',fire:'ほのお',water:'みず',electric:'でんき',grass:'くさ',ice:'こおり',fighting:'かくとう',poison:'どく',ground:'じめん',flying:'ひこう',psychic:'エスパー',bug:'むし',rock:'いわ',ghost:'ゴースト',dragon:'ドラゴン',dark:'あく',steel:'はがね',fairy:'フェアリー'};
const TC={normal:'#9fa19f',fire:'#e62829',water:'#2980ef',electric:'#fac000',grass:'#3fa129',ice:'#3dcef3',fighting:'#ff8000',poison:'#9141cb',ground:'#915121',flying:'#81b9ef',psychic:'#ef4179',bug:'#91a119',rock:'#afa981',ghost:'#704170',dragon:'#5060e1',dark:'#624d4e',steel:'#60a1b8',fairy:'#ef70ef'};
// 全国版マスター(master_pokemon.json)の id→names.ja は images/sim/{ja}.svg のファイル名と一致する
// (pokemon/all.html 生成=tools/_gen_content_pages.js の imgCells と同じ規則。id は pokeapi_master.json と共通キー)。
let SIM_JA={};
try{ JSON.parse(fs.readFileSync('reference/master_pokemon.json','utf8')).forEach(e=>{ if(e&&e.names&&e.names.ja!=null) SIM_JA[e.id]=e.names.ja; }); }
catch(e){ console.log('⚠ master_pokemon.json 無し: オリジナル絵は種族名ベースにフォールバック'); }
// ★AdSense対策・案A(2026-07-20 阿部さん確定): 既定=自作オリジナル絵(images/sim/{ja}.svg→.png→非表示)。
// PokeAPI公式絵(images/poke/{id}.png、無ければ raw.githubusercontent)は既定で配線しない=初期表示のネットワーク要求ゼロ。
// 将来「公式絵切替オプション」(AdSense審査通過後)を実装する場合は、img の onerror 最終分岐(現在 this.remove())を
// data-poke-id を使って SPRITE(id)→SPRITE_FALLBACK(id) へ差し替える形で追加する(未実装・意図的・コードは下に残置)。
const SIM=(id,jaFallback)=>`images/sim/${enc(SIM_JA[id]||jaFallback)}`;
const SPRITE=id=>`images/poke/${id}.png`;
const SPRITE_FALLBACK=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const GENR=[[1,151],[152,251],[252,386],[387,493],[494,649],[650,721],[722,809],[810,905],[906,1025]];
const genOf=dex=>{for(let i=0;i<GENR.length;i++)if(dex>=GENR[i][0]&&dex<=GENR[i][1])return i+1;return 0;};
function formLabel(v){ if(v.is_default) return ''; const f=v.form_slug||''; if(v.is_mega) return f.includes('-x')?'メガX':f.includes('-y')?'メガY':'メガ'; const M={alola:'アローラ',galar:'ガラル',hisui:'ヒスイ',paldea:'パルデア',gmax:'キョダイ'}; for(const k in M)if(f.includes(k))return M[k]; return f; }
const rows=D.map(v=>{const st=v.stats;const bst=(st.hp+st.atk+st.def+st.spa+st.spd+st.spe);const fl=formLabel(v);
  const types=v.types.map(t=>`<span class="ty" style="background:${TC[t]||'#777'}">${esc(TYPE_JA[t]||t)}</span>`).join('');
  const tnames=v.types.map(t=>TYPE_JA[t]||t).join(' ');
  return `<tr data-s="${esc((v.species_names.ja||'')+' '+(v.species_names.en||'')+' '+fl+' '+tnames)}" data-gen="${genOf(v.dex)}" data-ty="${esc(v.types.join(','))}">
<td class="dx">${v.dex||''}</td>
<td class="sp"><img loading="lazy" src="${SIM(v.id,v.species_names.ja||v.slug)}.svg" alt="" width="56" height="56" data-poke-id="${v.id}" onerror="if(!this.dataset.png){this.dataset.png=1;this.src='${SIM(v.id,v.species_names.ja||v.slug)}.png';}else{this.remove();}"></td>
<td class="nm">${esc(v.species_names.ja||v.slug)}${fl?`<span class="fm">${esc(fl)}</span>`:''}<br><span class="en">${esc(v.species_names.en||'')}</span></td>
<td class="gen"><span class="gb g${genOf(v.dex)}">第${genOf(v.dex)}</span></td>
<td class="tys">${types}</td>
<td class="n">${st.hp}</td><td class="n">${st.atk}</td><td class="n">${st.def}</td><td class="n">${st.spa}</td><td class="n">${st.spd}</td><td class="n">${st.spe}</td><td class="n bst">${bst}</td>
<td class="ab">${esc(v.abilities.filter(a=>!a.hidden).map(a=>abj(a.name)).join('・'))}${v.abilities.some(a=>a.hidden)?`<span class=\"hd\">隠:${esc(v.abilities.filter(a=>a.hidden).map(a=>abj(a.name)).join('・'))}</span>`:''}</td></tr>`;}).join('');
const typeBtns=Object.keys(TYPE_JA).map(t=>`<button class="tyb" data-t="${t}" style="background:${TC[t]}" onclick="ft('${t}')">${TYPE_JA[t]}</button>`).join('');
const genBtns=[1,2,3,4,5,6,7,8,9].map(g=>`<button class="gnb" data-g="${g}" onclick="fg(${g})">第${g}世代</button>`).join('');
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>全国ポケモン図鑑DB(全世代・全${D.length}) - PchamDB</title>
<meta name="description" content="メインシリーズ全世代の全ポケモン(${D.length}フォルム)の種族値・タイプ・とくせいを検索できる図鑑DB。">
<style>
:root{--hdr:#1F4E79}
body{font-family:system-ui,'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:13px}
h1{font-size:16px;margin:0;padding:11px 16px;background:var(--hdr);color:#fff;position:sticky;top:0;z-index:10}
h1 a{color:#bcd4ee;font-size:12px;text-decoration:none;margin-left:8px}
.bar{padding:8px 16px;background:#11161c;position:sticky;top:40px;z-index:9;border-bottom:1px solid #233}
.bar input{padding:6px 10px;width:240px;background:#1c2740;border:1px solid #30425f;color:#fff;border-radius:6px}
.tyrow{margin-top:7px;display:flex;flex-wrap:wrap;gap:4px}
.tyb{border:none;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;cursor:pointer;opacity:.55}
.tyb.on{opacity:1;outline:2px solid #fff}
.tyb.clr{background:#444!important;opacity:1}
.cnt{color:#9ec5ff;font-size:12px;margin-left:10px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border-bottom:1px solid #1d2532;padding:4px 7px;text-align:left;vertical-align:middle}
th{background:#1c2740;color:#9ec5ff;font-size:11px;position:sticky;top:96px;cursor:pointer;white-space:nowrap}
.dx{color:#7a8aa0;width:44px}.sp{width:60px}.sp img{image-rendering:pixelated;display:block}
.nm{color:#ffd479;font-weight:700;white-space:nowrap}.nm .en{color:#7a8aa0;font-weight:400;font-size:10px}.fm{color:#8ad;font-size:10px;margin-left:4px;font-weight:400}
.gen{width:48px;text-align:center}.gb{display:inline-block;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;background:#2b3a55;color:#bcd}\n.gnb{border:none;color:#cfe0f5;background:#2b3a55;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;cursor:pointer;opacity:.6}.gnb.on{opacity:1;outline:2px solid #fff}.gnb.clr{background:#444;opacity:1}\n.ty{display:inline-block;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:3px;margin:1px}
.n{text-align:center;width:38px;color:#cfe0f5}.bst{font-weight:700;color:#ffd479}
.ab{color:#c9d1d9;font-size:11px}.hd{color:#9a7;display:block;font-size:10px}
tbody tr:nth-child(even){background:#141b2b}
tbody tr:hover{background:#1d2840}
</style></head><body>
<h1>📕 全国ポケモン図鑑DB(全世代・${D.length}フォルム)<a href="moves_db_all.html">📘わざ</a><a href="items_db_all.html">📦どうぐ</a><a href="pokemon_db_v9.html">→ チャンピオンズDB</a></h1>
<div class="bar"><input id="q" placeholder="🔍 名前・タイプで検索(日本語/英語)" oninput="run()"><span class="cnt" id="cnt"></span>
<div class="tyrow"><button class="tyb clr" onclick="ft('')">全タイプ</button>${typeBtns}</div>\n<div class="tyrow" style="margin-top:5px"><button class="gnb clr" onclick="fg(0)">全世代</button>${genBtns}</div></div>
<table id="t"><thead><tr><th onclick="sortBy('dx')">No</th><th>絵</th><th onclick="sortBy('nm')">名前</th><th onclick="sortBy(2.5)">世代</th><th>タイプ</th><th onclick="sortBy(5)">HP</th><th onclick="sortBy(6)">攻</th><th onclick="sortBy(7)">防</th><th onclick="sortBy(8)">特攻</th><th onclick="sortBy(9)">特防</th><th onclick="sortBy(10)">速</th><th onclick="sortBy('bst')">合計</th><th>とくせい</th></tr></thead><tbody id="tb">${rows}</tbody></table>
<script>
var TB=document.getElementById('tb');var allRows=[].slice.call(TB.children);var curType='';var curGen=0;
function run(){var q=document.getElementById('q').value.toLowerCase();var n=0;allRows.forEach(function(r){var okq=!q||r.dataset.s.toLowerCase().indexOf(q)>=0;var okt=!curType||(','+r.dataset.ty+',').indexOf(','+curType+',')>=0;var okg=!curGen||r.dataset.gen==(''+curGen);var show=okq&&okt&&okg;r.style.display=show?'':'none';if(show)n++;});document.getElementById('cnt').textContent=n+' / '+allRows.length+' 匹';}
function ft(t){curType=(curType===t)?'':t;document.querySelectorAll('.tyb').forEach(function(b){b.classList.toggle('on',b.dataset.t===curType)});run();}\nfunction fg(g){curGen=(curGen===g)?0:g;document.querySelectorAll('.gnb').forEach(function(b){b.classList.toggle('on',(+b.dataset.g)===curGen)});run();}
function sortBy(k){var idx={dx:0,nm:2,2.5:3,bst:11}[k]; if(idx===undefined)idx=k; var asc=TB.dataset.sk!==(''+k)||TB.dataset.sd!=='asc'; var rows=allRows.slice();
 rows.sort(function(a,b){var av=a.children[idx].textContent.trim(),bv=b.children[idx].textContent.trim();var an=parseFloat(av),bn=parseFloat(bv);var x,y;if(!isNaN(an)&&!isNaN(bn)){x=an;y=bn}else{x=av;y=bv}return (x<y?-1:x>y?1:0)*(asc?1:-1)});
 TB.dataset.sk=''+k;TB.dataset.sd=asc?'asc':'desc';rows.forEach(function(r){TB.appendChild(r)});}
run();
</script><footer style="padding:16px;color:#7a8aa0;font-size:11px;line-height:1.7;border-top:1px solid #233;margin-top:20px">Pokémon の名前・データは © 1995–2026 Nintendo / Game Freak / The Pokémon Company。本サイト(PchamDB)は<b>非公式・非営利</b>のファンサイトです。ポケモンのイラストは当サイトのオリジナル作画です。データ出典: <a href="https://pokeapi.co/" style="color:#9ec5ff">PokéAPI</a>(pokeapi.co)。</footer></body></html>`;
fs.writeFileSync('pokemon_db_all.html',html);
console.log('pokemon_db_all.html 生成:',D.length,'variety / 絵=自作オリジナル(images/sim・既定)・PokeAPI公式絵は初期表示に配線なし(lazy)');
