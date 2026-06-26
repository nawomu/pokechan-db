// 全部入りアイテムリストDB(全2180道具)公開ページ生成。Champions専用の items_list とは別。
// 元データ=reference/items_master.json(全2180・9言語名)。英語効果文(effect_en)は北極星「英語ゼロ」のため出さない=参照リスト。
// スプライト=ローカル同梱(images/item/)。欠けはPokeAPIへonerrorフォールバック。
// 実行: node tools/_build_items_db_all.js → items_db_all.html
const fs=require('fs');
const IT=JSON.parse(fs.readFileSync('reference/items_master.json','utf8'));
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// 54カテゴリの日本語訳(参照リスト用ラベル)
const CAT_JA={
 'all-machines':'わざマシン','all-mail':'てがみ','apricorn-balls':'ぼんぐりボール','apricorn-box':'ぼんぐり入れ','bad-held-items':'じゃまな持ち物','baking-only':'クッキング専用','catching-bonus':'捕獲ボーナス','choice':'こだわり系','collectibles':'コレクション','curry-ingredients':'カレー食材','data-cards':'データカード','dex-completion':'図鑑関連','dynamax-crystals':'ダイマックスクリスタル','effort-drop':'努力値ダウン','effort-training':'努力値アップ','event-items':'イベント道具','evolution':'進化用','flutes':'フエ','gameplay':'進行用','healing':'回復','held-items':'持ち物','in-a-pinch':'ピンチ系','jewels':'ジュエル','loot':'売却用','medicine':'くすり','mega-stones':'メガストーン','memories':'メモリ','miracle-shooter':'ミラクルシューター','mulch':'たいひ','nature-mints':'ミント','other':'その他','picky-healing':'好み回復','picnic':'ピクニック','plates':'プレート','plot-advancement':'ストーリー道具','pp-recovery':'PP回復','revival':'ひんし回復','sandwich-ingredients':'サンド食材','scarves':'スカーフ','species-candies':'アメ','species-specific':'専用道具','spelunking':'探検道具','standard-balls':'モンスターボール','stat-boosts':'能力アップ','status-cures':'状態回復','tera-shard':'テラピース','tm-materials':'わざマシン材料','training':'育成','type-enhancement':'タイプ強化','type-protection':'タイプ半減実','unused':'未使用','vitamins':'栄養ドリンク','z-crystals':'Zクリスタル'};
const catJa=c=>CAT_JA[c]||c;
// ローカルに同梱できたスプライトのみ表示(PokeAPIに個別画像が無いTM等1300超は画像なし=無駄404を回避)
const HAS=new Set(fs.readdirSync('images/item').filter(f=>f.endsWith('.png')).map(f=>f.slice(0,-4)));
const SPRITE=slug=>`images/item/${slug}.png`;
const rows=IT.slice().sort((a,b)=>a.id-b.id).map(it=>{
  const ja=it.names.ja||it.slug, en=it.names.en||'';
  const cost=(it.cost==null||it.cost===0)?'—':it.cost;
  const img=HAS.has(it.slug)?`<img loading="lazy" src="${SPRITE(it.slug)}" alt="" width="32" height="32" onerror="this.style.visibility='hidden'">`:'';
  return `<tr data-s="${esc(ja+' '+en)}" data-cat="${esc(it.category)}">
<td class="sp">${img}</td>
<td class="nm">${esc(ja)}<br><span class="en">${esc(en)}</span></td>
<td class="cat"><span class="cb">${esc(catJa(it.category))}</span></td>
<td class="n">${cost}</td></tr>`;}).join('');
// カテゴリ絞込ボタン(出現順=ja名)
const cats=[...new Set(IT.map(i=>i.category))].sort((a,b)=>catJa(a).localeCompare(catJa(b),'ja'));
const catBtns=cats.map(c=>`<button class="cbn" data-c="${esc(c)}" onclick="fc('${esc(c)}')">${esc(catJa(c))}</button>`).join('');
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>全国どうぐリストDB(全${IT.length}件) - PchamDB</title>
<meta name="description" content="メインシリーズ全世代の全どうぐ(${IT.length}件)を名前・カテゴリで検索できる道具DB。">
<style>
:root{--hdr:#1F4E79}
body{font-family:system-ui,'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:13px}
h1{font-size:16px;margin:0;padding:11px 16px;background:var(--hdr);color:#fff;position:sticky;top:0;z-index:10}
h1 a{color:#bcd4ee;font-size:12px;text-decoration:none;margin-left:8px}
.bar{padding:8px 16px;background:#11161c;position:sticky;top:40px;z-index:9;border-bottom:1px solid #233}
.bar input{padding:6px 10px;width:240px;background:#1c2740;border:1px solid #30425f;color:#fff;border-radius:6px}
.tyrow{margin-top:7px;display:flex;flex-wrap:wrap;gap:4px}
.cbn{border:none;color:#cfe0f5;background:#2b3a55;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;cursor:pointer;opacity:.6}
.cbn.on{opacity:1;outline:2px solid #fff}
.cbn.clr{background:#444;opacity:1}
.cnt{color:#9ec5ff;font-size:12px;margin-left:10px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border-bottom:1px solid #1d2532;padding:4px 7px;text-align:left;vertical-align:middle}
th{background:#1c2740;color:#9ec5ff;font-size:11px;position:sticky;top:96px;cursor:pointer;white-space:nowrap}
.sp{width:40px}.sp img{image-rendering:pixelated;display:block}
.nm{color:#ffd479;font-weight:700;white-space:nowrap}.nm .en{color:#7a8aa0;font-weight:400;font-size:10px}
.cat{white-space:nowrap}.cb{display:inline-block;color:#cfe0f5;background:#2b3a55;font-size:10px;font-weight:700;padding:1px 7px;border-radius:4px}
.n{text-align:center;width:70px;color:#cfe0f5}
tbody tr:nth-child(even){background:#141b2b}
tbody tr:hover{background:#1d2840}
</style></head><body>
<h1>📦 全国どうぐリストDB(全${IT.length}件)<a href="pokemon_db_all.html">📕ポケモン</a><a href="moves_db_all.html">📘わざ</a><a href="items_list.html">→ チャンピオンズどうぐ一覧</a></h1>
<div class="bar"><input id="q" placeholder="🔍 どうぐ名で検索(日本語/英語)" oninput="run()"><span class="cnt" id="cnt"></span>
<div class="tyrow"><button class="cbn clr" onclick="fc('')">全カテゴリ</button>${catBtns}</div></div>
<table id="t"><thead><tr><th>絵</th><th onclick="sortBy('nm')">どうぐ名</th><th>カテゴリ</th><th onclick="sortBy(3)">値段</th></tr></thead><tbody id="tb">${rows}</tbody></table>
<script>
var TB=document.getElementById('tb');var allRows=[].slice.call(TB.children);var curCat='';
function run(){var q=document.getElementById('q').value.toLowerCase();var n=0;allRows.forEach(function(r){var okq=!q||r.dataset.s.toLowerCase().indexOf(q)>=0;var okc=!curCat||r.dataset.cat===curCat;var show=okq&&okc;r.style.display=show?'':'none';if(show)n++;});document.getElementById('cnt').textContent=n+' / '+allRows.length+' 件';}
function fc(c){curCat=(curCat===c)?'':c;document.querySelectorAll('.cbn').forEach(function(b){b.classList.toggle('on',b.dataset.c===curCat)});run();}
function sortBy(k){var idx=(k==='nm')?1:k; var asc=TB.dataset.sk!==(''+k)||TB.dataset.sd!=='asc'; var rows=allRows.slice();
 rows.sort(function(a,b){var av=a.children[idx].textContent.trim(),bv=b.children[idx].textContent.trim();var an=parseFloat(av.replace(/[^0-9.]/g,'')),bn=parseFloat(bv.replace(/[^0-9.]/g,''));var x,y;if(!isNaN(an)&&!isNaN(bn)&&av!=='—'&&bv!=='—'){x=an;y=bn}else{x=av;y=bv}return (x<y?-1:x>y?1:0)*(asc?1:-1)});
 TB.dataset.sk=''+k;TB.dataset.sd=asc?'asc':'desc';rows.forEach(function(r){TB.appendChild(r)});}
run();
</script><footer style="padding:16px;color:#7a8aa0;font-size:11px;line-height:1.7;border-top:1px solid #233;margin-top:20px">Pokémon の画像・名前は © 1995–2026 Nintendo / Game Freak / The Pokémon Company。本サイト(PchamDB)は<b>非公式・非営利</b>のファンサイトです。画像出典: <a href="https://pokeapi.co/" style="color:#9ec5ff">PokéAPI</a>(pokeapi.co)。</footer></body></html>`;
fs.writeFileSync('items_db_all.html',html);
console.log('items_db_all.html 生成:',IT.length,'件 / カテゴリ',cats.length);
