/* コンテンツ静的ページ生成(SEO用)。pokechan_data.js から自動生成。
 * 生成物(リポジトリ直下):
 *   /ability/index.html + /ability/<特性名>.html (192)
 *   /pokemon/index.html + /pokemon/<slug>.html  (275, slug=英語フォーム名 api由来・一意化)
 *   /type/index.html    + /type/<タイプ名>.html (18)
 *   /move/index.html  (490技のデータ一覧。個別ページは声✓後に別途=MOVE_PAGES)
 * 実行: node tools/_gen_content_pages.js
 * ※ SSOTは読むだけ。既存の index.html 等は変更しない(トップのカードは別途手当て)。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const d = require(path.join(ROOT, 'pokechan_data.js'));
const W = d.WAZA_MAP;
const POKE = d.POKEMON_LIST;
const PWAZA = d.POKEMON_WAZA;
const ABID = d.ABILITY_DESC;

const MOVE_PAGES = false; // 技の個別ページは声✓後に true へ(今は技名はリンクにしない)

// ---- タイプ相性表(type_chart.html と同一) ----
const TYPES = ["ノーマル","ほのお","みず","でんき","くさ","こおり","かくとう","どく","じめん","ひこう","エスパー","むし","いわ","ゴースト","ドラゴン","あく","はがね","フェアリー"];
const TYPE_CHART = [
  [1,1,1,1,1,1,1,1,1,1,1,1,0.5,0,1,1,0.5,1],[1,0.5,0.5,1,2,2,1,1,1,1,1,2,0.5,1,0.5,1,2,1],
  [1,2,0.5,1,0.5,1,1,1,2,1,1,1,2,1,0.5,1,1,1],[1,1,2,0.5,0.5,1,1,1,0,2,1,1,1,1,0.5,1,1,1],
  [1,0.5,2,1,0.5,1,1,0.5,2,0.5,1,0.5,2,1,0.5,1,0.5,1],[1,0.5,0.5,1,2,0.5,1,1,2,2,1,1,1,1,2,1,0.5,1],
  [2,1,1,1,1,2,1,0.5,1,0.5,0.5,0.5,2,0,1,2,2,0.5],[1,1,1,1,2,1,1,0.5,0.5,1,1,1,0.5,0.5,1,1,0,2],
  [1,2,1,2,0.5,1,1,2,1,0,1,0.5,2,1,1,1,2,1],[1,1,1,0.5,2,1,2,1,1,1,1,2,0.5,1,1,1,0.5,1],
  [1,1,1,1,1,1,2,2,1,1,0.5,1,1,1,1,0,0.5,1],[1,0.5,1,1,2,1,0.5,0.5,1,0.5,2,1,1,0.5,1,2,0.5,0.5],
  [1,2,1,1,1,2,0.5,1,0.5,2,1,2,1,1,1,1,0.5,1],[0,1,1,1,1,1,1,1,1,1,2,1,1,2,1,0.5,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,0.5,0],[1,1,1,1,1,1,0.5,1,1,1,2,1,1,2,1,0.5,1,0.5],
  [1,0.5,0.5,0.5,1,2,1,1,1,1,1,1,2,1,1,1,0.5,2],[1,0.5,1,1,1,1,2,0.5,1,1,1,1,1,1,2,2,0.5,1]];
const tIdx = t => TYPES.indexOf(t);

// ---- helpers ----
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enc = s => encodeURIComponent(s); // href用(日本語ファイル名)
const badge = t => t ? `<span class="badge t-${esc(t)}">${esc(t)}</span>` : '';
const jaSort = (a, b) => a.localeCompare(b, 'ja');

function head(title, desc, canonical) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-3Y3S9N1K7H"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-3Y3S9N1K7H');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8021399778265482" crossorigin="anonymous"></script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="PchamDB">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<link rel="icon" href="../favicon.png" type="image/png">
<link rel="stylesheet" href="../content.css">
</head>
<body>
<header class="hero"><a href="../index.html"><div class="logo">PchamDB<small>ポケモンチャンピオンズ 非公式ファンデータベース</small></div></a></header>
<div class="wrap">`;
}
const FOOT = `</div>
<footer>
  <p class="unofficial">⚠️ 当サイトは非公式ファンサイトです</p>
  <p>任天堂・株式会社ポケモン・ゲームフリーク・クリーチャーズなど関連企業とは一切関係ありません。</p>
  <div class="links"><a href="../index.html">ホーム</a> · <a href="../making.html">制作の裏側</a> · <a href="../terms.html">利用規約</a> · <a href="../privacy.html">プライバシーポリシー</a> · <a href="../disclaimer.html">免責事項</a> · <a href="../contact.html">お問い合わせ</a> · <a href="../sitemap.html">サイトマップ</a></div>
  <p>ポケモン・Pokémon等の商標および著作権は任天堂・株式会社ポケモン・ゲームフリーク・クリーチャーズに帰属します。<br>© 2026 Pokémon. © 1995-2026 Nintendo / Creatures Inc. / GAME FREAK inc. © 2026 PchamDB</p>
</footer>
</body>
</html>`;

function writePage(rel, htmlBody) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, htmlBody);
}

// 一覧のソート/フィルター用クライアントJS(本文リンクはHTMLに残るのでSEOに影響しない)
const LIST_JS = `
(function(){
  var table=document.getElementById('pkTable'),body=document.getElementById('pkBody');
  var search=document.getElementById('pkSearch'),count=document.getElementById('pkCount'),tf=document.getElementById('pkTypeFilter');
  if(!table)return;
  var rows=[].slice.call(body.querySelectorAll('tr')),curType='';
  function toKata(s){return s.replace(/[\\u3041-\\u3096]/g,function(c){return String.fromCharCode(c.charCodeAt(0)+0x60);});}
  function apply(){
    var q=toKata((search.value||'').trim()),shown=0;
    rows.forEach(function(r){
      var okT=!curType||(','+r.getAttribute('data-types')+',').indexOf(','+curType+',')>=0;
      var okQ=!q||toKata(r.getAttribute('data-name')).indexOf(q)>=0;
      var on=okT&&okQ;r.style.display=on?'':'none';if(on)shown++;
    });
    count.textContent=shown+' / '+rows.length+' 体';
  }
  search.addEventListener('input',apply);
  tf.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    curType=b.getAttribute('data-type')||'';
    [].forEach.call(tf.querySelectorAll('button'),function(x){x.classList.remove('on');});
    b.classList.add('on');apply();
  });
  var dir=1,lastK=null;
  [].forEach.call(table.querySelectorAll('th[data-k]'),function(th){
    th.addEventListener('click',function(){
      var k=th.getAttribute('data-k');dir=(lastK===k)?-dir:1;lastK=k;
      [].forEach.call(table.querySelectorAll('th[data-k]'),function(x){x.classList.remove('sort-asc','sort-desc');});
      th.classList.add(dir>0?'sort-asc':'sort-desc');
      var idx=[].indexOf.call(th.parentNode.children,th),arr=rows.slice();
      arr.sort(function(a,b){
        if(k==='name')return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'),'ja')*dir;
        var x,y;
        if(k==='no'){x=parseInt(a.children[0].textContent,10);y=parseInt(b.children[0].textContent,10);}
        else{x=parseFloat(a.children[idx].getAttribute('data-v'));y=parseFloat(b.children[idx].getAttribute('data-v'));}
        return (x-y)*dir;
      });
      arr.forEach(function(r){body.appendChild(r);});
    });
  });
  apply();
})();`;

// ポケモン個別ページの「覚える技」表のソート/フィルター用JS
const MOVE_JS = `
(function(){
  var t=document.getElementById('mvTable');if(!t)return;
  var body=document.getElementById('mvBody');
  var rows=[].slice.call(body.querySelectorAll('tr'));
  var mvType=document.getElementById('mvType'),mvCat=document.getElementById('mvCat'),mvSort=document.getElementById('mvSort');
  var curType='',curCat='';
  function num(r,k){var v=parseFloat(r.getAttribute('data-'+k));return isNaN(v)?-1:v;}
  function apply(){rows.forEach(function(r){
    var okT=!curType||r.getAttribute('data-type')===curType;
    var okC=!curCat||r.getAttribute('data-cat')===curCat;
    r.style.display=(okT&&okC)?'':'none';});}
  function filterBox(box,attr,setter){if(!box)return;box.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;setter(b.getAttribute(attr)||'');
    [].forEach.call(box.querySelectorAll('button'),function(x){x.classList.remove('on');});b.classList.add('on');apply();});}
  filterBox(mvType,'data-type',function(v){curType=v;});
  filterBox(mvCat,'data-cat',function(v){curCat=v;});
  var CR={'物理':0,'特殊':1,'変化':2};
  function sortBy(k,dir){
    var arr=rows.slice();
    arr.sort(function(a,b){
      if(k==='kind'){
        var ca=CR[a.getAttribute('data-cat')];if(ca==null)ca=9;
        var cb=CR[b.getAttribute('data-cat')];if(cb==null)cb=9;
        if(ca!==cb)return ca-cb;
        var pa=num(a,'power'),pb=num(b,'power');if(pa!==pb)return pb-pa;
        return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'),'ja');
      }
      if(k==='name')return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'),'ja')*dir;
      return (num(a,k)-num(b,k))*dir;
    });
    arr.forEach(function(r){body.appendChild(r);});
  }
  var active='kind',dir={power:-1,acc:-1,pp:-1,name:1};
  if(mvSort)mvSort.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;var k=b.getAttribute('data-sort');
    if(k!=='kind'&&active===k)dir[k]=-dir[k];
    active=k;
    [].forEach.call(mvSort.querySelectorAll('button'),function(x){x.classList.remove('on');});b.classList.add('on');
    sortBy(k,dir[k]||1);
  });
})();`;

// ---- ポケモン slug(英語フォーム名・一意化) ----
let weights = {};
try {
  const wj = require(path.join(ROOT, 'review', '_weights_collected.json'));
  wj.weights.forEach(x => { weights[x.name] = x.api; });
} catch (e) { console.log('⚠ 体重JSON無し: slugは図鑑Noベースにフォールバック'); }
const slugUsed = new Set();
const pokeSlug = new Map();
for (const p of POKE) {
  let base = weights[p.name] || ('p' + p.no);
  let s = base, i = 2;
  while (slugUsed.has(s)) { s = base + '-' + i; i++; }
  slugUsed.add(s);
  pokeSlug.set(p.name, s);
}
const pokeByName = name => POKE.find(p => p.name === name);
const pokeHref = name => `../pokemon/${pokeSlug.get(name)}.html`;
const abilHref = name => `../ability/${enc(name)}.html`;
const typeHref = name => `../type/${enc(name)}.html`;

// 同一図鑑Noの別フォーム
function otherForms(p) {
  return POKE.filter(q => q.no === p.no && q.name !== p.name);
}

// ===========================================================
// 1) 特性ページ
// ===========================================================
function abilityOwners(ab) {
  return POKE.filter(p => [p.ab1, p.ab2, p.ab3].includes(ab));
}
const ALL_ABIL = Object.keys(ABID).sort(jaSort);

function genAbilityDetail(ab) {
  const desc = ABID[ab] || '';
  const owners = abilityOwners(ab);
  const ownerChips = owners.length
    ? `<div class="chips">${owners.map(p => `<a href="${pokeHref(p.name)}">${esc(p.name)}</a>`).join('')}</div>`
    : '<p style="color:var(--muted)">(このDB内に該当ポケモンなし)</p>';
  const body = head(
    `${ab}(特性)の効果と覚えるポケモン｜PchamDB`,
    `特性「${ab}」の効果。${desc} この特性を持つポケモン一覧も掲載。`,
    `https://pchamdb.com/ability/${enc(ab)}.html`
  ) + `
  <nav class="crumbs"><a href="../index.html">ホーム</a> &gt; <a href="index.html">特性一覧</a> &gt; <b>${esc(ab)}</b></nav>
  <article class="card">
    <h1>${esc(ab)}</h1>
    <p class="lead">${esc(desc)}</p>
    <h2>この特性を持つポケモン(${owners.length})</h2>
    ${ownerChips}
    <h2>関連</h2>
    <div class="chips"><a href="index.html">← 特性一覧へ戻る</a></div>
  </article>` + FOOT;
  writePage(`ability/${ab}.html`, body);
}

function genAbilityIndex() {
  const rows = ALL_ABIL.map(ab =>
    `<tr><th style="width:26%"><a href="${enc(ab)}.html">${esc(ab)}</a></th><td>${esc(ABID[ab] || '')}</td></tr>`
  ).join('\n');
  const body = head(
    '特性(とくせい)一覧 全' + ALL_ABIL.length + '種｜PchamDB',
    'ポケモンの特性' + ALL_ABIL.length + '種類の効果一覧。各特性の効果と、その特性を持つポケモンを確認できます。',
    'https://pchamdb.com/ability/'
  ) + `
  <nav class="crumbs"><a href="../index.html">ホーム</a> &gt; <b>特性一覧</b></nav>
  <article class="card">
    <h1>特性(とくせい)一覧</h1>
    <p class="lead">ポケモンが持つ「特性」全${ALL_ABIL.length}種類の効果をまとめました。特性をえらぶと、くわしい効果と、その特性を持つポケモンが見られます。</p>
    <table>${rows}</table>
  </article>` + FOOT;
  writePage('ability/index.html', body);
}

// ===========================================================
// 2) ポケモンページ
// ===========================================================
function weaknessTable(p) {
  const di = [p.type1, p.type2].filter(Boolean).map(tIdx);
  const buckets = {};
  TYPES.forEach((atk, ai) => {
    let m = 1; di.forEach(x => m *= TYPE_CHART[ai][x]);
    (buckets[m] = buckets[m] || []).push(atk);
  });
  const row = (label, mult) => buckets[mult] && buckets[mult].length
    ? `<tr><th style="width:30%">${label}</th><td>${buckets[mult].map(badge).join('')}</td></tr>` : '';
  return `<table>
      ${row('4倍ダメージ(大きな弱点)', 4)}
      ${row('2倍ダメージ(弱点)', 2)}
      ${row('0.5倍(半減)', 0.5)}
      ${row('0.25倍(とても効きにくい)', 0.25)}
      ${row('効果なし(無効)', 0)}
    </table>`;
}
function statRow(label, v) {
  const w = Math.min(100, Math.round(v / 150 * 100));
  return `<tr><th style="width:26%">${label}</th><td>${v} <span class="stat-bar"><i style="width:${w}%"></i></span></td></tr>`;
}
function movesTable(name) {
  const keys = PWAZA[name] || [];
  if (!keys.length) return '<p style="color:var(--muted)">(このDB内に技データなし)</p>';
  const catRank = { '物理': 0, '特殊': 1, '変化': 2 };
  // 技オブジェクト化 → 既定の並び: 物理→特殊→変化、各カテゴリ内は威力降順
  const mv = keys.map(k => Object.values(W).find(x => x.key === k) || { name: k })
    .sort((a, b) =>
      (catRank[a.category] ?? 9) - (catRank[b.category] ?? 9)
      || ((b.power || -1) - (a.power || -1))
      || a.name.localeCompare(b.name, 'ja'));
  const rows = mv.map(m => {
    const pw = (m.power == null || m.power === 0) ? '—' : m.power;
    const ac = (m.accuracy == null || m.accuracy === 0) ? '—' : m.accuracy;
    const nameCell = MOVE_PAGES ? `<a href="../move/${esc(m.key)}.html">${esc(m.name)}</a>` : esc(m.name);
    // ※説明文はSSOT(effects→compose)が育って耳✓後に追加。古い description フィールドは出さない(盗用/機械声リスク)
    return `      <tr data-name="${esc(m.name)}" data-type="${esc(m.type || '')}" data-cat="${esc(m.category || '')}"`
      + ` data-power="${m.power == null ? '' : m.power}" data-acc="${m.accuracy == null ? '' : m.accuracy}" data-pp="${m.pp == null ? '' : m.pp}">`
      + `<td>${nameCell}</td><td>${badge(m.type)}</td><td class="cls-${esc(m.category || '')}">${esc(m.category || '')}</td>`
      + `<td class="num">${pw}</td><td class="num">${ac}</td><td class="num">${esc(m.pp == null ? '' : m.pp)}</td></tr>`;
  }).join('\n');
  // フィルター用ボタン(このポケモンの覚える技に含まれるタイプ・分類だけ)
  const presentTypes = TYPES.filter(t => mv.some(m => m.type === t));
  const typeBtns = presentTypes.map(t => `<button class="tf t-${esc(t)}" data-type="${esc(t)}">${esc(t)}</button>`).join('');
  const presentCats = ['物理', '特殊', '変化'].filter(c => mv.some(m => m.category === c));
  const catBtns = presentCats.map(c => `<button class="catf cat-${esc(c)}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  return `<div class="list-controls">
      <div class="sort-group" id="mvSort">並び順:
        <button class="sortb on" data-sort="kind">種類順(物理→特殊→変化)</button><button class="sortb" data-sort="power">威力</button><button class="sortb" data-sort="acc">命中</button><button class="sortb" data-sort="pp">PP</button><button class="sortb" data-sort="name">名前</button>
      </div>
      <div class="type-filter chips" id="mvType">しぼりこみ: <button class="all on" data-type="">全タイプ</button>${typeBtns}</div>
      <div class="type-filter chips" id="mvCat" style="margin-top:6px"><button class="all on" data-cat="">全分類</button>${catBtns}</div>
    </div>
    <div class="table-scroll"><table class="move-table" id="mvTable">
      <thead><tr><th>技名</th><th>タイプ</th><th>分類</th><th class="num">威力</th><th class="num">命中</th><th class="num">PP</th></tr></thead>
      <tbody id="mvBody">
${rows}
      </tbody>
    </table></div>`;
}
function genPokemonDetail(p) {
  const types = [p.type1, p.type2].filter(Boolean);
  const total = (p.hp + p.atk + p.def + p.spatk + p.spdef + p.spd);
  const abils = [p.ab1, p.ab2, p.ab3].filter(Boolean);
  const abilRows = abils.map(a => `<tr><th style="width:28%"><a href="${abilHref(a)}">${esc(a)}</a></th><td>${esc(ABID[a] || '')}</td></tr>`).join('');
  const forms = otherForms(p);
  const formLine = forms.length
    ? `<p style="margin:4px 0 0;font-size:14px"><b>別のすがた:</b> ${forms.map(f => `<a href="${pokeHref(f.name)}">${esc(f.name)}</a>`).join(' ／ ')}</p>` : '';
  const body = head(
    `${p.name}(No.${p.no})の種族値・弱点・特性・覚える技｜PchamDB`,
    `${p.name}(${types.join('/')})の種族値・タイプ相性(弱点)・特性・覚える技の一覧。`,
    `https://pchamdb.com/pokemon/${pokeSlug.get(p.name)}.html`
  ) + `
  <nav class="crumbs"><a href="../index.html">ホーム</a> &gt; <a href="index.html">ポケモン一覧</a> &gt; <b>${esc(p.name)}</b></nav>
  <article class="card">
    <h1>No.${esc(p.no)} ${esc(p.name)}</h1>
    <p>${types.map(t => `<a href="${typeHref(t)}">${badge(t)}</a>`).join('')} ／ 重さ ${esc(p.weight_kg != null ? p.weight_kg + 'kg' : '不明')}</p>
    ${formLine}
    <h2>種族値</h2>
    <table>
      ${statRow('HP', p.hp)}
      ${statRow('こうげき', p.atk)}
      ${statRow('ぼうぎょ', p.def)}
      ${statRow('とくこう', p.spatk)}
      ${statRow('とくぼう', p.spdef)}
      ${statRow('すばやさ', p.spd)}
      <tr><th>合計</th><td><b>${total}</b></td></tr>
    </table>
    <h2>タイプ相性(弱点・耐性)</h2>
    ${weaknessTable(p)}
    <h2>特性</h2>
    <table>${abilRows}</table>
    <h2>覚える技</h2>
    ${movesTable(p.name)}
  </article>
  <script>${MOVE_JS}</script>` + FOOT;
  writePage(`pokemon/${pokeSlug.get(p.name)}.html`, body);
}
function genPokemonIndex() {
  const rows = POKE.map(p => {
    const types = [p.type1, p.type2].filter(Boolean);
    const total = p.hp + p.atk + p.def + p.spatk + p.spdef + p.spd;
    return `      <tr data-name="${esc(p.name)}" data-types="${esc(types.join(','))}">`
      + `<td class="num">${esc(p.no)}</td>`
      + `<td class="name"><a href="${esc(pokeSlug.get(p.name))}.html">${esc(p.name)}</a></td>`
      + `<td>${types.map(badge).join('')}</td>`
      + `<td class="num" data-v="${p.hp}">${p.hp}</td>`
      + `<td class="num" data-v="${p.atk}">${p.atk}</td>`
      + `<td class="num" data-v="${p.def}">${p.def}</td>`
      + `<td class="num" data-v="${p.spatk}">${p.spatk}</td>`
      + `<td class="num" data-v="${p.spdef}">${p.spdef}</td>`
      + `<td class="num" data-v="${p.spd}">${p.spd}</td>`
      + `<td class="num" data-v="${total}"><b>${total}</b></td></tr>`;
  }).join('\n');
  const typeBtns = TYPES.map(t => `<button class="tf t-${esc(t)}" data-type="${esc(t)}">${esc(t)}</button>`).join('');
  const body = head(
    'ポケモン一覧 全' + POKE.length + '体(種族値ソート・タイプ絞り込み)｜PchamDB',
    'ポケモン' + POKE.length + '体の種族値・タイプ一覧。種族値で並び替え、タイプで絞り込みできます。各ポケモンの詳細(弱点・特性・覚える技)へ。',
    'https://pchamdb.com/pokemon/'
  ) + `
  <nav class="crumbs"><a href="../index.html">ホーム</a> &gt; <b>ポケモン一覧</b></nav>
  <article class="card">
    <h1>ポケモン一覧</h1>
    <p class="lead">登録されている全${POKE.length}体のポケモン。<b>見出しをおすと並び替え</b>、<b>タイプをおすと絞り込み</b>できます。名前をおすと、そのポケモンの弱点・特性・覚える技が見られます。</p>
    <div class="list-controls">
      <input class="search" id="pkSearch" type="search" placeholder="🔎 名前でしぼりこむ(ひらがな・カタカナ)">
      <div class="type-filter chips" id="pkTypeFilter">
        <button class="all on" data-type="">すべて</button>${typeBtns}
      </div>
      <span class="filter-count" id="pkCount"></span>
    </div>
    <div class="table-scroll"><table class="sortable list-table" id="pkTable">
      <thead><tr>
        <th class="num" data-k="no">No.</th>
        <th data-k="name">なまえ</th>
        <th>タイプ</th>
        <th class="num" data-k="hp">HP</th>
        <th class="num" data-k="atk">こう</th>
        <th class="num" data-k="def">ぼう</th>
        <th class="num" data-k="spatk">特こう</th>
        <th class="num" data-k="spdef">特ぼう</th>
        <th class="num" data-k="spd">すば</th>
        <th class="num" data-k="total">合計</th>
      </tr></thead>
      <tbody id="pkBody">
${rows}
      </tbody>
    </table></div>
  </article>
  <script>${LIST_JS}</script>` + FOOT;
  writePage('pokemon/index.html', body);
}

// ===========================================================
// 3) タイプページ
// ===========================================================
function genTypeDetail(t) {
  const ai = tIdx(t);
  // 攻撃(このタイプの技 → 相手タイプ)
  const off = { good: [], bad: [], no: [] };
  TYPES.forEach((dt, di) => { const m = TYPE_CHART[ai][di]; if (m === 2) off.good.push(dt); else if (m === 0.5) off.bad.push(dt); else if (m === 0) off.no.push(dt); });
  // 防御(相手の技 → このタイプ)
  const def = { weak: [], resist: [], no: [] };
  TYPES.forEach((at, x) => { const m = TYPE_CHART[x][ai]; if (m === 2) def.weak.push(at); else if (m === 0.5) def.resist.push(at); else if (m === 0) def.no.push(at); });
  const owns = POKE.filter(p => p.type1 === t || p.type2 === t);
  const line = arr => arr.length ? arr.map(badge).join('') : '<span style="color:var(--muted)">なし</span>';
  const body = head(
    `${t}タイプの相性・ポケモン一覧｜PchamDB`,
    `${t}タイプの弱点・耐性・攻撃相性と、${t}タイプのポケモン一覧。`,
    `https://pchamdb.com/type/${enc(t)}.html`
  ) + `
  <nav class="crumbs"><a href="../index.html">ホーム</a> &gt; <a href="../type_chart.html">タイプ相性表</a> &gt; <b>${esc(t)}</b></nav>
  <article class="card">
    <h1>${badge(t)} ${esc(t)}タイプ</h1>
    <h2>攻撃するとき(${t}の技で攻める)</h2>
    <table>
      <tr><th style="width:34%">ばつぐん(2倍)</th><td>${line(off.good)}</td></tr>
      <tr><th>いまひとつ(0.5倍)</th><td>${line(off.bad)}</td></tr>
      <tr><th>効果なし</th><td>${line(off.no)}</td></tr>
    </table>
    <h2>守るとき(${t}タイプが受ける)</h2>
    <table>
      <tr><th style="width:34%">弱点(2倍)</th><td>${line(def.weak)}</td></tr>
      <tr><th>半減(0.5倍)</th><td>${line(def.resist)}</td></tr>
      <tr><th>効果なし(無効)</th><td>${line(def.no)}</td></tr>
    </table>
    <h2>${t}タイプのポケモン(${owns.length})</h2>
    <div class="chips">${owns.map(p => `<a href="${pokeHref(p.name)}">${esc(p.name)}</a>`).join('')}</div>
  </article>` + FOOT;
  writePage(`type/${t}.html`, body);
}
function genTypeIndex() {
  const items = TYPES.map(t => `<a href="${enc(t)}.html">${badge(t)}</a>`).join(' ');
  const body = head(
    'タイプ相性一覧 全18タイプ｜PchamDB',
    '18タイプそれぞれの弱点・耐性・攻撃相性と、各タイプのポケモン一覧。',
    'https://pchamdb.com/type/'
  ) + `
  <nav class="crumbs"><a href="../index.html">ホーム</a> &gt; <b>タイプ一覧</b></nav>
  <article class="card">
    <h1>タイプ一覧</h1>
    <p class="lead">18種類のタイプ。えらぶと、そのタイプの弱点・耐性・攻撃相性と、そのタイプのポケモンが見られます。</p>
    <p style="line-height:2.4">${items}</p>
    <p style="font-size:13px;color:var(--muted)">タイプ同士の早見表は <a href="../type_chart.html">タイプ相性表</a> もどうぞ。</p>
  </article>` + FOOT;
  writePage('type/index.html', body);
}

// ===========================================================
// 4) わざ一覧(個別ページは保留=データ一覧のみ)
// ===========================================================
function genMoveIndex() {
  const all = Object.values(W).slice().sort((a, b) => (a.move_no || 0) - (b.move_no || 0));
  const rows = all.map(m => {
    const pw = (m.power == null || m.power === 0) ? '—' : m.power;
    const ac = (m.accuracy == null || m.accuracy === 0) ? '—' : m.accuracy;
    return `      <tr><td>${esc(m.name)}</td><td>${badge(m.type)}</td><td class="cls-${esc(m.category || '')}">${esc(m.category || '')}</td><td class="num">${pw}</td><td class="num">${ac}</td><td class="num">${esc(m.pp == null ? '' : m.pp)}</td></tr>`;
  }).join('\n');
  const body = head(
    'わざ一覧 全' + all.length + '種｜PchamDB',
    'わざ' + all.length + '種類の威力・命中・PP・タイプ・分類の一覧。',
    'https://pchamdb.com/move/'
  ) + `
  <nav class="crumbs"><a href="../index.html">ホーム</a> &gt; <b>わざ一覧</b></nav>
  <article class="card">
    <h1>わざ一覧</h1>
    <p class="lead">登録されている全${all.length}わざのデータ(タイプ・分類・威力・命中・PP)です。</p>
    <div class="table-scroll"><table class="move-table">
      <tr><th>技名</th><th>タイプ</th><th>分類</th><th>威力</th><th>命中</th><th>PP</th></tr>
${rows}
    </table></div>
  </article>` + FOOT;
  writePage('move/index.html', body);
}

// ===========================================================
// 実行
// ===========================================================
genAbilityIndex();
ALL_ABIL.forEach(genAbilityDetail);
genPokemonIndex();
POKE.forEach(genPokemonDetail);
// genTypeIndex(); // タイプ一覧ページは廃止(既存 type_chart.html と役割重複・2026-06-12 阿部さん)
TYPES.forEach(genTypeDetail);
// genMoveIndex(); // わざ一覧(/move/)は廃止(既存 waza-list.html と役割重複・2026-06-12 阿部さん)

console.log('✅ 生成完了');
console.log('  特性:', 1 + ALL_ABIL.length, 'ページ (/ability/)');
console.log('  ポケモン:', 1 + POKE.length, 'ページ (/pokemon/)');
console.log('  タイプ:', TYPES.length, 'ページ (/type/ 個別のみ・一覧は廃止)');
console.log('  わざ一覧: 1 ページ (/move/) ※個別ページは MOVE_PAGES=false で保留');
console.log('  合計:', 1 + ALL_ABIL.length + 1 + POKE.length + TYPES.length + 1, 'ページ');
