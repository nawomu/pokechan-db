// 全部入り技リストDB(全937技・全世代)公開ページ生成。Champions専用の waza-list とは別。
// 元データ=reference/moves_master.json(全937技・9言語名)。英語効果文(effect_en)は北極星「英語ゼロ」のため出さない=ステータス参照リスト。
// 実行: node tools/_build_moves_db_all.js → moves_db_all.html
const fs=require('fs');
const M=JSON.parse(fs.readFileSync('reference/moves_master.json','utf8'));
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const TYPE_JA={normal:'ノーマル',fire:'ほのお',water:'みず',electric:'でんき',grass:'くさ',ice:'こおり',fighting:'かくとう',poison:'どく',ground:'じめん',flying:'ひこう',psychic:'エスパー',bug:'むし',rock:'いわ',ghost:'ゴースト',dragon:'ドラゴン',dark:'あく',steel:'はがね',fairy:'フェアリー'};
const TC={normal:'#9fa19f',fire:'#e62829',water:'#2980ef',electric:'#fac000',grass:'#3fa129',ice:'#3dcef3',fighting:'#ff8000',poison:'#9141cb',ground:'#915121',flying:'#81b9ef',psychic:'#ef4179',bug:'#91a119',rock:'#afa981',ghost:'#704170',dragon:'#5060e1',dark:'#624d4e',steel:'#60a1b8',fairy:'#ef70ef'};
const CLS={physical:{ja:'物理',ico:'⚔',c:'#c92112'},special:{ja:'特殊',ico:'✨',c:'#4f5dab'},status:{ja:'変化',ico:'🔵',c:'#8a8d91'}};
// 表示順=ID(全国図鑑の技番号順)
const rows=M.slice().sort((a,b)=>a.id-b.id).map(m=>{
  const cl=CLS[m.damage_class]||CLS.status;
  const ja=m.names.ja||m.slug, en=m.names.en||'';
  const pw=(m.power==null?'—':m.power), ac=(m.accuracy==null?'—':m.accuracy), pp=(m.pp==null?'—':m.pp), pr=(m.priority||0);
  const prTxt=pr>0?('+'+pr):(''+pr);
  return `<tr data-s="${esc(ja+' '+en)}" data-ty="${esc(m.type)}" data-cl="${esc(m.damage_class)}">
<td class="dx">${m.id}</td>
<td class="nm">${esc(ja)}<br><span class="en">${esc(en)}</span></td>
<td class="tys"><span class="ty" style="background:${TC[m.type]||'#777'}">${esc(TYPE_JA[m.type]||m.type)}</span></td>
<td class="cl"><span class="clb" style="background:${cl.c}">${cl.ico} ${cl.ja}</span></td>
<td class="n">${pw}</td><td class="n">${ac}</td><td class="n">${pp}</td><td class="n">${prTxt}</td></tr>`;}).join('');
const typeBtns=Object.keys(TYPE_JA).map(t=>`<button class="tyb" data-t="${t}" style="background:${TC[t]}" onclick="ft('${t}')">${TYPE_JA[t]}</button>`).join('');
const clsBtns=Object.keys(CLS).map(k=>`<button class="clbn" data-c="${k}" style="background:${CLS[k].c}" onclick="fc('${k}')">${CLS[k].ico} ${CLS[k].ja}</button>`).join('');
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>全国わざリストDB(全${M.length}技) - PchamDB</title>
<meta name="description" content="メインシリーズ全世代の全わざ(${M.length}技)のタイプ・分類・威力・命中・PP・優先度を検索できる技DB。">
<style>
:root{--hdr:#1F4E79}
body{font-family:system-ui,'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:13px}
h1{font-size:16px;margin:0;padding:11px 16px;background:var(--hdr);color:#fff;position:sticky;top:0;z-index:10}
h1 a{color:#bcd4ee;font-size:12px;text-decoration:none;margin-left:8px}
.bar{padding:8px 16px;background:#11161c;position:sticky;top:40px;z-index:9;border-bottom:1px solid #233}
.bar input{padding:6px 10px;width:240px;background:#1c2740;border:1px solid #30425f;color:#fff;border-radius:6px}
.tyrow{margin-top:7px;display:flex;flex-wrap:wrap;gap:4px}
.tyb,.clbn{border:none;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;cursor:pointer;opacity:.55}
.tyb.on,.clbn.on{opacity:1;outline:2px solid #fff}
.tyb.clr,.clbn.clr{background:#444!important;opacity:1}
.cnt{color:#9ec5ff;font-size:12px;margin-left:10px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border-bottom:1px solid #1d2532;padding:4px 7px;text-align:left;vertical-align:middle}
th{background:#1c2740;color:#9ec5ff;font-size:11px;position:sticky;top:96px;cursor:pointer;white-space:nowrap}
.dx{color:#7a8aa0;width:44px}
.nm{color:#ffd479;font-weight:700;white-space:nowrap}.nm .en{color:#7a8aa0;font-weight:400;font-size:10px}
.ty{display:inline-block;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:3px}
.cl{width:64px}.clb{display:inline-block;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;white-space:nowrap}
.n{text-align:center;width:46px;color:#cfe0f5}
tbody tr:nth-child(even){background:#141b2b}
tbody tr:hover{background:#1d2840}
</style></head><body>
<h1>📘 全国わざリストDB(全${M.length}技)<a href="pokemon_db_all.html">📕ポケモン</a><a href="items_db_all.html">📦どうぐ</a><a href="waza-list.html">→ チャンピオンズわざリスト</a></h1>
<div class="bar"><input id="q" placeholder="🔍 わざ名で検索(日本語/英語)" oninput="run()"><span class="cnt" id="cnt"></span>
<div class="tyrow"><button class="tyb clr" onclick="ft('')">全タイプ</button>${typeBtns}</div>
<div class="tyrow" style="margin-top:5px"><button class="clbn clr" onclick="fc('')">全分類</button>${clsBtns}</div></div>
<table id="t"><thead><tr><th onclick="sortBy(0)">No</th><th onclick="sortBy('nm')">わざ名</th><th>タイプ</th><th>分類</th><th onclick="sortBy(4)">威力</th><th onclick="sortBy(5)">命中</th><th onclick="sortBy(6)">PP</th><th onclick="sortBy(7)">優先度</th></tr></thead><tbody id="tb">${rows}</tbody></table>
<script>
var TB=document.getElementById('tb');var allRows=[].slice.call(TB.children);var curType='';var curCls='';
function run(){var q=document.getElementById('q').value.toLowerCase();var n=0;allRows.forEach(function(r){var okq=!q||r.dataset.s.toLowerCase().indexOf(q)>=0;var okt=!curType||r.dataset.ty===curType;var okc=!curCls||r.dataset.cl===curCls;var show=okq&&okt&&okc;r.style.display=show?'':'none';if(show)n++;});document.getElementById('cnt').textContent=n+' / '+allRows.length+' 技';}
function ft(t){curType=(curType===t)?'':t;document.querySelectorAll('.tyb').forEach(function(b){b.classList.toggle('on',b.dataset.t===curType)});run();}
function fc(c){curCls=(curCls===c)?'':c;document.querySelectorAll('.clbn').forEach(function(b){b.classList.toggle('on',b.dataset.c===curCls)});run();}
function sortBy(k){var idx=(k==='nm')?1:k; var asc=TB.dataset.sk!==(''+k)||TB.dataset.sd!=='asc'; var rows=allRows.slice();
 rows.sort(function(a,b){var av=a.children[idx].textContent.trim(),bv=b.children[idx].textContent.trim();var an=parseFloat(av),bn=parseFloat(bv);var x,y;if(!isNaN(an)&&!isNaN(bn)){x=an;y=bn}else{x=av;y=bv}return (x<y?-1:x>y?1:0)*(asc?1:-1)});
 TB.dataset.sk=''+k;TB.dataset.sd=asc?'asc':'desc';rows.forEach(function(r){TB.appendChild(r)});}
run();
</script><footer style="padding:16px;color:#7a8aa0;font-size:11px;line-height:1.7;border-top:1px solid #233;margin-top:20px">Pokémon の名前・わざ情報は © 1995–2026 Nintendo / Game Freak / The Pokémon Company。本サイト(PchamDB)は<b>非公式・非営利</b>のファンサイトです。データ出典: <a href="https://pokeapi.co/" style="color:#9ec5ff">PokéAPI</a>(pokeapi.co)。</footer></body></html>`;
fs.writeFileSync('moves_db_all.html',html);
console.log('moves_db_all.html 生成:',M.length,'技');
