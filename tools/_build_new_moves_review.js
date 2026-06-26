// 今回新たに追加した技(M-A/M-B以外=全国版で増えた445技)だけのレビューHTML。
// ヤックン確認ビュー形式: 新版説明文(マザー流・WF生成) ↔ 公式effect(en)を併置し、右端に「確認OK」チェック列(localStorage永続)。
// 実行: node tools/_build_new_moves_review.js → review/_new_moves_review.html
const fs=require('fs');
const MV=require('../reference/moves_master.json');
const DESC=require('../reference/moves_ja_desc.json'); // 445技(slug→JA説明・マザー流)
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const TYPE_JA={normal:'ノーマル',fire:'ほのお',water:'みず',electric:'でんき',grass:'くさ',ice:'こおり',fighting:'かくとう',poison:'どく',ground:'じめん',flying:'ひこう',psychic:'エスパー',bug:'むし',rock:'いわ',ghost:'ゴースト',dragon:'ドラゴン',dark:'あく',steel:'はがね',fairy:'フェアリー'};
const TC={normal:'#9fa19f',fire:'#e62829',water:'#2980ef',electric:'#fac000',grass:'#3fa129',ice:'#3dcef3',fighting:'#ff8000',poison:'#9141cb',ground:'#915121',flying:'#81b9ef',psychic:'#ef4179',bug:'#91a119',rock:'#afa981',ghost:'#704170',dragon:'#5060e1',dark:'#624d4e',steel:'#60a1b8',fairy:'#ef70ef'};
const CAT={physical:{ja:'物理',c:'#c92112'},special:{ja:'特殊',c:'#4f5dab'},status:{ja:'変化',c:'#8a8d91'}};
const bySlug={}; MV.forEach(m=>bySlug[m.slug]=m);
const rows=Object.keys(DESC).map(s=>bySlug[s]).filter(Boolean).sort((a,b)=>a.id-b.id).map(m=>{
  const cl=CAT[m.damage_class]||CAT.status;
  const ja=m.names.ja||m.slug;
  return `<tr>
<td class="dx">${m.id}</td>
<td class="name-cell">${esc(ja)}<br><span class="en">${esc(m.names.en||'')}</span></td>
<td><span class="ty" style="background:${TC[m.type]||'#777'}">${esc(TYPE_JA[m.type]||m.type)}</span></td>
<td><span class="cl" style="background:${cl.c}">${cl.ja}</span></td>
<td class="n">${m.power==null?'—':m.power}</td>
<td class="n">${m.accuracy==null?'—':m.accuracy}</td>
<td class="n">${m.pp==null?'—':m.pp}</td>
<td class="effect">${esc(DESC[m.slug])}</td>
<td class="effen">${esc(m.effect_en||'')}</td>
<td class="col-chk"><label class="rowchk-l"><input type="checkbox" class="rowchk">確認OK</label></td></tr>`;}).join('');
const N=Object.keys(DESC).length;
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>新規追加わざ レビュー(${N}技) - PchamDB</title>
<style>
body{font-family:system-ui,'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;margin:0;background:#f4f6f8;color:#222;font-size:13px}
h1{font-size:16px;margin:0;padding:11px 16px;background:#1F4E79;color:#fff;position:sticky;top:0;z-index:10}
.bar{padding:8px 16px;background:#fff;position:sticky;top:40px;z-index:9;border-bottom:1px solid #dde}
.bar input{padding:6px 10px;width:220px;border:1px solid #bcc;border-radius:6px}
.bar .act{margin-left:8px;font-size:12px;padding:4px 10px;border:1px solid #4a90d9;background:#eef5fc;color:#1F4E79;border-radius:5px;cursor:pointer;font-weight:700}
.bar .act.on{background:#1F4E79;color:#fff}
.cnt{color:#1565C0;font-size:12px;margin-left:10px;font-weight:700}
.note{color:#666;font-size:11px;padding:4px 16px;background:#fffdf0;border-bottom:1px solid #eed}
table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid #e3e7ec;padding:5px 8px;text-align:left;vertical-align:top}
th{background:#eef2f7;color:#1F4E79;font-size:11px;position:sticky;top:92px;white-space:nowrap}
.dx{color:#8a96a6;width:46px}
.name-cell{font-weight:700;color:#1F4E79;white-space:nowrap}.name-cell .en{color:#8a96a6;font-weight:400;font-size:10px}
.ty,.cl{display:inline-block;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:3px}
.n{text-align:center;width:40px;color:#445}
.effect{max-width:340px;color:#16321f;background:#f1f8f2;font-weight:600}
.effen{max-width:300px;color:#7a6a4a;font-size:11px;background:#fbf8f1}
.col-chk{width:80px;text-align:center}
.rowchk-l{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#1F4E79;cursor:pointer;white-space:nowrap}
.rowchk{width:17px;height:17px;cursor:pointer}
tr.is-checked{background:#eafaef;opacity:.55}
tbody tr:hover{background:#fffbe9}
</style></head><body>
<h1>🆕 新規追加わざ レビュー(全国版で増えた ${N}技 ／ M-A・M-B以外)</h1>
<div class="bar"><input id="q" placeholder="🔍 わざ名で検索" >
<span class="cnt" id="cnt"></span>
<button id="toggleChecked" class="act">👁 確認OKも表示</button>
<button id="resetChk" class="act">↺ 確認OKをリセット</button></div>
<div class="note">左「効果(新版)」=マザー流で自動生成した説明文。右「公式effect(en)」=PokeAPI公式の効果(英語・照合用)。意味が合っているか確認し、右端「確認OK」にチェック(保存される)。声の最終判定は阿部さん。</div>
<table><thead><tr><th>No</th><th>わざ名</th><th>型</th><th>分類</th><th>威</th><th>命</th><th>PP</th><th>効果(新版)</th><th>公式effect(en)</th><th>確認</th></tr></thead>
<tbody>${rows}</tbody></table>
<script>
var rows=[].slice.call(document.querySelectorAll('tbody tr'));
var LS='pcham_newmoves_checked_v1';
var checked=new Set(JSON.parse(localStorage.getItem(LS)||'[]'));
var showChecked=false;
function keyOf(r){var n=r.querySelector('.name-cell');return n?n.textContent.trim():'';}
function save(){localStorage.setItem(LS,JSON.stringify([].slice.call(checked)));}
function apply(){var v=document.getElementById('q').value.trim();
  rows.forEach(function(r){var n=r.querySelector('.name-cell');var okQ=!v||(n&&n.textContent.indexOf(v)>=0);
    var hideChk=checked.has(keyOf(r))&&!showChecked;r.style.display=(okQ&&!hideChk)?'':'none';});
  document.getElementById('cnt').textContent='確認OK '+checked.size+' / '+rows.length+'技';}
rows.forEach(function(r){var cb=r.querySelector('.rowchk');var k=keyOf(r);
  cb.checked=checked.has(k);r.classList.toggle('is-checked',cb.checked);
  cb.addEventListener('change',function(){if(cb.checked)checked.add(k);else checked.delete(k);
    r.classList.toggle('is-checked',cb.checked);save();apply();});});
document.getElementById('q').addEventListener('input',apply);
document.getElementById('toggleChecked').addEventListener('click',function(){showChecked=!showChecked;this.classList.toggle('on',showChecked);this.textContent=showChecked?'🙈 確認OKを隠す':'👁 確認OKも表示';apply();});
document.getElementById('resetChk').addEventListener('click',function(){if(confirm('確認OKを全部リセットしますか?')){checked.clear();save();rows.forEach(function(r){var cb=r.querySelector('.rowchk');cb.checked=false;r.classList.remove('is-checked');});apply();}});
apply();
</script></body></html>`;
fs.writeFileSync('review/_new_moves_review.html',html);
console.log('生成: review/_new_moves_review.html /',N,'技(新版↔公式effect-en・右端に確認OKチェック列)');
