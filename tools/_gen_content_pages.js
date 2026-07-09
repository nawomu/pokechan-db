/* コンテンツ静的ページ生成(SEO用・多言語=案A)。pokechan_data.js + i18n/*.json から自動生成。
 * 生成物:
 *   ja : /ability/<特性名>.html /pokemon/<slug>.html /type/<タイプ名>.html (既存パス不変)
 *   非ja: /<lang>/ability/<en-slug>.html  /<lang>/pokemon/<slug>.html  /<lang>/type/<en-slug>.html
 *   各ページに hreflang alternate。データ(名前/効果/タイプ)は SSOT(i18n/*.json)から引く=手書きゼロ。
 * 実行: node tools/_gen_content_pages.js
 * 固定UIラベル・アクセサ = tools/_content_i18n.js。法務フッタ本文は ja 維持(2026-06-24 決定)。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const d = require(path.join(ROOT, 'pokechan_data.js'));
const I = require('./_content_i18n.js');
const W = d.WAZA_MAP, POKE = d.POKEMON_LIST, PWAZA = d.POKEMON_WAZA, ABID = d.ABILITY_DESC;

// ★生成する言語(段階導入。まず ja+en パイロット → 他言語のラベルを埋めて全言語へ)
const GEN_LANGS = process.env.GEN_LANGS ? process.env.GEN_LANGS.split(',') : ['ja', 'en'];
const MOVE_PAGES = false;

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

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enc = s => encodeURIComponent(s);
const kebab = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const jaSort = (a, b) => a.localeCompare(b, 'ja');
const { T, tPoke, tType, tAbName, tAbDesc } = I;

// ---- slug マップ(英語ベース・言語共通・重複回避) ----
const ALL_ABIL = Object.keys(ABID).sort(jaSort);
function buildSlugMap(jaList, enName) {
  const used = new Set(), map = new Map();
  for (const ja of jaList) { let b = kebab(enName(ja)), s = b, i = 2; while (used.has(s)) { s = b + '-' + (i++); } used.add(s); map.set(ja, s); }
  return map;
}
const abilSlugMap = buildSlugMap(ALL_ABIL, ja => tAbName('en', ja));
const typeSlugMap = buildSlugMap(TYPES, ja => tType('en', ja));
// pokemon slug(既存=英語フォーム名・図鑑Noフォールバック)
let weights = {};
try { require(path.join(ROOT, 'review', '_weights_collected.json')).weights.forEach(x => { weights[x.name] = x.api; }); }
catch (e) { console.log('⚠ 体重JSON無し: slugは図鑑Noベース'); }
const slugUsed = new Set(), pokeSlugMap = new Map();
for (const p of POKE) { let base = weights[p.name] || ('p' + p.no), s = base, i = 2; while (slugUsed.has(s)) { s = base + '-' + (i++); } slugUsed.add(s); pokeSlugMap.set(p.name, s); }

const abilSlug = ja => abilSlugMap.get(ja) || kebab(ja);
const typeSlug = ja => typeSlugMap.get(ja) || kebab(ja);
const pokeSlug = name => pokeSlugMap.get(name);

// ---- 全国版マスター(master_pokemon.json) + ja名→PokeAPI id マップ ----
// POKEMON_LIST(Champions 313体)には PokeAPI id が無いため、APIスプライト表示に必要な id を
// master の names.ja → id から引く(313体は champions!=null で対応取れる・存在確認済み)。
const MASTER = (() => { try { return require(path.join(ROOT, 'reference', 'master_pokemon.json')); } catch (e) { console.log('⚠ master_pokemon.json 無し: APIスプライトは非表示'); return []; } })();
const jaToId = new Map(), champNames = new Set();
for (const _e of MASTER) { if (_e && _e.names && _e.names.ja != null) { jaToId.set(_e.names.ja, _e.id); if (_e.champions != null) champNames.add(_e.names.ja); } }
const pokeIdOf = jaName => jaToId.get(jaName);
// 公式スプライト描画用の id を解決。数値 id はそのまま文字列化。
// "c-026"(独自メガ等の合成id・PokeAPIに絵が無い)は数値部 26 をベース種のPokeAPI id として代用描画する。
// 戻り値: 数値id文字列(例 "26") / 合成idはベース種 id に解決 / 解決不能なら null。
const spriteIdOf = id => {
  if (id == null) return null;
  const s = String(id);
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/^c-(\d+)$/);
  return m ? String(parseInt(m[1], 10)) : null;
};

// 画像3列セル(オリジナル絵 + 公式ドット絵 + 公式3D)。名前の左に置く。No は別途先頭(children[0]=No前提)。
// ・オリジナル絵: images/sim/{ja}.svg → .png → remove(real_battle_simulator.html と同パターン)
// ・公式ドット絵: images/poke/{id}.png → GitHub raw フォールバック → 非表示(pokemon_db_all.html と同パターン)
// ・公式3D(Pokémon HOME): GitHub raw のみ。ローカルコピーは無いので onerror で要素 remove。
// c-NNN は spriteIdOf でベース種 id に解決し、ドット絵/3D ともベースの姿で表示(代用・区別マークは付けない)。
const imgCells = (lang, jaName) => {
  const sd = up(lang) + '/images/sim', e = enc(jaName);
  const art = `<img src="${sd}/${e}.svg" alt="" loading="lazy" style="height:44px;max-width:48px;vertical-align:middle"`
    + ` onerror="if(!this.dataset.png){this.dataset.png=1;this.src='${sd}/${e}.png';}else{this.remove();}">`;
  const id = spriteIdOf(pokeIdOf(jaName));   // null または "26"(c-026 → "26")
  let sprite = '', home = '';
  if (id) {
    const pd = up(lang) + '/images/poke', fb = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    sprite = `<img src="${pd}/${id}.png" alt="" loading="lazy" data-fb="${fb}" style="height:44px;max-width:48px;vertical-align:middle"`
      + ` onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb='';}else{this.style.visibility='hidden';}">`;
    home = `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png" alt="" loading="lazy" style="height:44px;max-width:48px;vertical-align:middle"`
      + ` onerror="this.remove();">`;
  }
  return `<td class="img">${art}</td><td class="img">${sprite}</td><td class="img">${home}</td>`;
};

// ---- パス/URL ----
const dirPrefix = lang => (lang === 'ja' ? '' : lang + '/');
const up = lang => (lang === 'ja' ? '..' : '../..');
// ファイル名=ファイルシステム用(ja は生の日本語名) / URL名=href・canonical用(ja は %エンコード)
const fileBase = (lang, kind, ja) => kind === 'pokemon' ? pokeSlug(ja) : (lang === 'ja' ? ja : (kind === 'ability' ? abilSlug(ja) : typeSlug(ja)));
const urlBase = (lang, kind, ja) => kind === 'pokemon' ? pokeSlug(ja) : (lang === 'ja' ? enc(ja) : (kind === 'ability' ? abilSlug(ja) : typeSlug(ja)));
const pageUrl = (lang, kind, ja) => `https://pchamdb.com/${dirPrefix(lang)}${kind}/${urlBase(lang, kind, ja)}.html`;
const indexUrl = (lang, kind) => `https://pchamdb.com/${dirPrefix(lang)}${kind}/`;
// 同言語内リンク(detail/index は同階層 /<kind>/ に居る → 兄弟カテゴリは ../<kind>/)
const pokeHref = (lang, name) => `../pokemon/${pokeSlug(name)}.html`;
const abilHref = (lang, name) => `../ability/${urlBase(lang, 'ability', name)}.html`;
const typeHref = (lang, name) => `../type/${urlBase(lang, 'type', name)}.html`;

const pokeByName = name => POKE.find(p => p.name === name);
const otherForms = p => POKE.filter(q => q.no === p.no && q.name !== p.name);
const abilityOwners = ab => POKE.filter(p => [p.ab1, p.ab2, p.ab3].includes(ab));

const badge = (lang, t) => t ? `<span class="badge t-${esc(t)}">${esc(tType(lang, t))}</span>` : '';

// hreflang ブロック(生成中の全言語 + x-default=ja)
function hreflang(kind, ja) {
  const links = GEN_LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${(kind === 'index') ? indexUrl(l, ja) : pageUrl(l, kind, ja)}">`);
  const xdef = (kind === 'index') ? indexUrl('ja', ja) : pageUrl('ja', kind, ja);
  links.push(`<link rel="alternate" hreflang="x-default" href="${xdef}">`);
  return links.join('\n');
}
// 全国版一覧(all.html)は pokemon/{slug} でも index でもない固定URL → 専用の URL/hreflang
const allUrl = lang => `https://pchamdb.com/${dirPrefix(lang)}pokemon/all.html`;
function hreflangAll() {
  const links = GEN_LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${allUrl(l)}">`);
  links.push(`<link rel="alternate" hreflang="x-default" href="${allUrl('ja')}">`);
  return links.join('\n');
}

const sideAds = lang => {
  const pr = esc(T(lang, 'ad_pr')), ar = esc(T(lang, 'ad_aria'));
  return `<aside class="side-rail left ad-section" data-ad-slot="content-rail-left" aria-label="${ar}"><div class="railbox"><span class="pr-label">${pr}</span><div class="ad-section__inner"></div></div></aside>`
    + `<aside class="side-rail right ad-section" data-ad-slot="content-rail-right" aria-label="${ar}"><div class="railbox"><span class="pr-label">${pr}</span><div class="ad-section__inner"></div></div></aside>`;
};

function head(lang, title, desc, canonical, hrefBlock) {
  const u = up(lang);
  return `<!DOCTYPE html>
<html lang="${lang}">
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
${hrefBlock}
<meta property="og:type" content="article">
<meta property="og:site_name" content="PchamDB">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<link rel="icon" href="${u}/favicon.png" type="image/png">
<link rel="stylesheet" href="${u}/content.css">
</head>
<body>
<header class="hero"><a href="${u}/index.html"><div class="logo">PchamDB<small>${esc(T(lang, 'site_tagline'))}</small></div></a></header>
${sideAds(lang)}
<div class="wrap">`;
}
function FOOT(lang) {
  const u = up(lang);
  return `</div>
<footer>
  <p class="unofficial">${esc(T(lang, 'unofficial_note'))}</p>
  <p>任天堂・株式会社ポケモン・ゲームフリーク・クリーチャーズなど関連企業とは一切関係ありません。</p>
  <div class="links"><a href="${u}/index.html">${esc(T(lang, 'foot_home'))}</a> · <a href="${u}/making.html">${esc(T(lang, 'foot_making'))}</a> · <a href="${u}/terms.html">${esc(T(lang, 'foot_terms'))}</a> · <a href="${u}/privacy.html">${esc(T(lang, 'foot_privacy'))}</a> · <a href="${u}/disclaimer.html">${esc(T(lang, 'foot_disc'))}</a> · <a href="${u}/contact.html">${esc(T(lang, 'foot_contact'))}</a> · <a href="${u}/sitemap.html">${esc(T(lang, 'foot_sitemap'))}</a></div>
  <p>ポケモン・Pokémon等の商標および著作権は任天堂・株式会社ポケモン・ゲームフリーク・クリーチャーズに帰属します。<br>© 2026 Pokémon. © 1995-2026 Nintendo / Creatures Inc. / GAME FREAK inc. © 2026 PchamDB</p>
</footer>
</body>
</html>`;
}
const adBox = (lang, slot) => `<aside class="ad-section in-content" data-ad-slot="${slot}" aria-label="${esc(T(lang,'ad_aria'))}"><span class="pr-label">${esc(T(lang,'ad_pr'))}</span><div class="ad-section__inner"></div></aside>`;
function writePage(lang, rel, html) { const full = path.join(ROOT, dirPrefix(lang) + rel); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, html); }

// ---- クライアントJS(ラベルは引数で注入) ----
const listJs = unit => `
(function(){
  var table=document.getElementById('pkTable'),body=document.getElementById('pkBody');
  var search=document.getElementById('pkSearch'),count=document.getElementById('pkCount'),tf=document.getElementById('pkTypeFilter');
  if(!table)return;
  var rows=[].slice.call(body.querySelectorAll('tr')),curType='';
  function toKata(s){return s.replace(/[\\u3041-\\u3096]/g,function(c){return String.fromCharCode(c.charCodeAt(0)+0x60);});}
  function apply(){
    var q=toKata((search.value||'').trim().toLowerCase()),shown=0;
    rows.forEach(function(r){
      var okT=!curType||(','+r.getAttribute('data-types')+',').indexOf(','+curType+',')>=0;
      var okQ=!q||toKata((r.getAttribute('data-name')||'').toLowerCase()).indexOf(q)>=0;
      var on=okT&&okQ;r.style.display=on?'':'none';if(on)shown++;
    });
    count.textContent=shown+' / '+rows.length+'${unit ? ' ' + unit : ''}';
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
        if(k==='name')return (a.getAttribute('data-name')||'').localeCompare(b.getAttribute('data-name')||'')*dir;
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
const TIP_JS = `
(function(){
  var tip=document.createElement('div');tip.id='c-tip';tip.style.display='none';document.body.appendChild(tip);
  function show(el){var t=el.getAttribute('data-tip');if(!t)return;tip.textContent=t;tip.style.display='block';
    var r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,left=r.left,top=r.bottom+6;
    if(left+w>innerWidth-8)left=innerWidth-8-w;if(left<8)left=8;if(top+h>innerHeight-8)top=r.top-6-h;
    tip.style.left=left+'px';tip.style.top=top+'px';}
  function hide(){tip.style.display='none';}
  document.addEventListener('mouseover',function(e){var el=e.target.closest('[data-tip]');if(el)show(el);});
  document.addEventListener('mouseout',function(e){var el=e.target.closest('[data-tip]');if(el)hide();});
  document.addEventListener('scroll',hide,true);
})();`;
const MOVE_JS = `
(function(){
  var t=document.getElementById('mvTable');if(!t)return;var body=document.getElementById('mvBody');
  var rows=[].slice.call(body.querySelectorAll('tr'));
  var mvType=document.getElementById('mvType'),mvCat=document.getElementById('mvCat'),mvSort=document.getElementById('mvSort');
  var curType='',curCat='';
  function num(r,k){var v=parseFloat(r.getAttribute('data-'+k));return isNaN(v)?-1:v;}
  function apply(){rows.forEach(function(r){var okT=!curType||r.getAttribute('data-type')===curType;var okC=!curCat||r.getAttribute('data-cat')===curCat;r.style.display=(okT&&okC)?'':'none';});}
  function filterBox(box,attr,setter){if(!box)return;box.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;setter(b.getAttribute(attr)||'');[].forEach.call(box.querySelectorAll('button'),function(x){x.classList.remove('on');});b.classList.add('on');apply();});}
  filterBox(mvType,'data-type',function(v){curType=v;});filterBox(mvCat,'data-cat',function(v){curCat=v;});
  var CR={'物理':0,'特殊':1,'変化':2};
  function sortBy(k,dir){var arr=rows.slice();arr.sort(function(a,b){
    if(k==='kind'){var ca=CR[a.getAttribute('data-cat')];if(ca==null)ca=9;var cb=CR[b.getAttribute('data-cat')];if(cb==null)cb=9;if(ca!==cb)return ca-cb;var pa=num(a,'power'),pb=num(b,'power');if(pa!==pb)return pb-pa;return (a.getAttribute('data-name')||'').localeCompare(b.getAttribute('data-name')||'');}
    if(k==='name')return (a.getAttribute('data-name')||'').localeCompare(b.getAttribute('data-name')||'')*dir;
    return (num(a,k)-num(b,k))*dir;});arr.forEach(function(r){body.appendChild(r);});}
  var active='kind',dir={power:-1,acc:-1,pp:-1,name:1};
  if(mvSort)mvSort.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var k=b.getAttribute('data-sort');if(k!=='kind'&&active===k)dir[k]=-dir[k];active=k;[].forEach.call(mvSort.querySelectorAll('button'),function(x){x.classList.remove('on');});b.classList.add('on');sortBy(k,dir[k]||1);});
})();`;
// 画像クリックで拡大(ライトボックス)。両一覧の #pkBody に1リスナー(イベント委譲)。
// オリジナル絵(SVG)/公式ドット絵/公式3D どれでもクリック→中央に大きく表示(最大 min(80vw,80vh))。
// 背景半透明黒・もう一度クリック(どこでも)または ESC で閉じる。拡大時は行のポケモン名を横に表示。
// CSS(content.css)は触れないのでスタイルはインラインで完結。タップ=click でスマホでも動く。
const LIGHTBOX_JS = `
(function(){
  var body=document.getElementById('pkBody');
  if(!body)return;
  var ov=document.createElement('div');
  ov.style.cssText='display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.82);z-index:99999;align-items:center;justify-content:center;gap:18px;padding:16px;box-sizing:border-box;cursor:zoom-out';
  var img=document.createElement('img');
  img.style.cssText='max-width:min(80vw,80vh);max-height:min(80vw,80vh);object-fit:contain;cursor:zoom-out';
  var cap=document.createElement('div');
  cap.style.cssText='color:#fff;font-size:22px;font-weight:700;line-height:1.4;max-width:240px;word-break:keep-all;text-shadow:0 2px 8px rgba(0,0,0,0.8);cursor:zoom-out';
  ov.appendChild(img);ov.appendChild(cap);document.body.appendChild(ov);
  function open(src,name){img.src=src;cap.textContent=name||'';ov.style.display='flex';}
  function close(){if(ov.style.display==='none')return;ov.style.display='none';img.removeAttribute('src');}
  body.addEventListener('click',function(e){
    var im=e.target.closest('img');if(!im)return;
    var src=im.src;if(!src||im.style.visibility==='hidden')return;   // 非表示(読込失敗)プレースホルダは除外
    var tr=im.closest('tr');var name=tr?(tr.getAttribute('data-name')||''):'';
    e.preventDefault();open(src,name);
  });
  ov.addEventListener('click',close);
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'||ev.keyCode===27)close();});
})();`;

// ===========================================================
// 1) 特性
// ===========================================================
function genAbilityDetail(lang, ab) {
  const jaDesc = ABID[ab] || '', desc = tAbDesc(lang, ab, jaDesc), abN = tAbName(lang, ab);
  const owners = abilityOwners(ab);
  const ownerChips = owners.length
    ? `<div class="chips">${owners.map(p => `<a href="${pokeHref(lang, p.name)}">${esc(tPoke(lang, p.name))}</a>`).join('')}</div>`
    : `<p style="color:var(--muted)">${esc(T(lang, 'ability_no_owner'))}</p>`;
  const body = head(lang,
    T(lang, 'ability_title').replace('{x}', abN),
    T(lang, 'ability_desc_meta').replace('{x}', abN).replace('{d}', desc),
    pageUrl(lang, 'ability', ab), hreflang('ability', ab)
  ) + `
  <nav class="crumbs"><a href="${up(lang)}/index.html">${esc(T(lang, 'home'))}</a> &gt; <a href="index.html">${esc(T(lang, 'ability_list'))}</a> &gt; <b>${esc(abN)}</b></nav>
  <article class="card">
    <h1>${esc(abN)}</h1>
    <p class="lead">${esc(desc)}</p>
    <h2>${esc(T(lang, 'ability_owners').replace('{n}', owners.length))}</h2>
    ${ownerChips}
    ${adBox(lang, 'content-ability')}
    <h2>${esc(T(lang, 'related'))}</h2>
    <div class="chips"><a href="index.html">${esc(T(lang, 'ability_back'))}</a></div>
  </article>` + FOOT(lang);
  writePage(lang, `ability/${fileBase(lang, 'ability', ab)}.html`, body);
}
function genAbilityIndex(lang) {
  const rows = ALL_ABIL.map(ab =>
    `<tr><th style="width:26%"><a href="${urlBase(lang, 'ability', ab)}.html">${esc(tAbName(lang, ab))}</a></th><td>${esc(tAbDesc(lang, ab, ABID[ab] || ''))}</td></tr>`
  ).join('\n');
  const body = head(lang,
    T(lang, 'ability_list_title').replace('{n}', ALL_ABIL.length),
    T(lang, 'ability_list_desc').replace('{n}', ALL_ABIL.length),
    indexUrl(lang, 'ability'), hreflang('index', 'ability')
  ) + `
  <nav class="crumbs"><a href="${up(lang)}/index.html">${esc(T(lang, 'home'))}</a> &gt; <b>${esc(T(lang, 'ability_list'))}</b></nav>
  <article class="card">
    <h1>${esc(T(lang, 'ability_list_h1'))}</h1>
    <p class="lead">${T(lang, 'ability_list_lead').replace('{n}', ALL_ABIL.length)}</p>
    <table>${rows}</table>
  </article>
  ${adBox(lang, 'content-ability-list')}` + FOOT(lang);
  writePage(lang, 'ability/index.html', body);
}

// ===========================================================
// 2) ポケモン
// ===========================================================
function weaknessTable(lang, p) {
  const di = [p.type1, p.type2].filter(Boolean).map(tIdx), buckets = {};
  TYPES.forEach((atk, ai) => { let m = 1; di.forEach(x => m *= TYPE_CHART[ai][x]); (buckets[m] = buckets[m] || []).push(atk); });
  const row = (key, mult) => buckets[mult] && buckets[mult].length
    ? `<tr><th style="width:30%">${esc(T(lang, key))}</th><td>${buckets[mult].map(t => badge(lang, t)).join('')}</td></tr>` : '';
  return `<table>${row('weak_4x', 4)}${row('weak_2x', 2)}${row('weak_half', 0.5)}${row('weak_quarter', 0.25)}${row('weak_zero', 0)}</table>`;
}
const statRow = (label, v) => `<tr><th style="width:26%">${esc(label)}</th><td>${v} <span class="stat-bar"><i style="width:${Math.min(100, Math.round(v / 150 * 100))}%"></i></span></td></tr>`;
function movesTable(lang, name) {
  const keys = PWAZA[name] || [];
  if (!keys.length) return `<p style="color:var(--muted)">${esc(T(lang, 'no_move_data'))}</p>`;
  const catRank = { '物理': 0, '特殊': 1, '変化': 2 };
  const mv = keys.map(k => Object.values(W).find(x => x.key === k) || { name: k })
    .sort((a, b) => (catRank[a.category] ?? 9) - (catRank[b.category] ?? 9) || ((b.power || -1) - (a.power || -1)) || a.name.localeCompare(b.name, 'ja'));
  const mvName = m => (I.dict[lang] && I.dict[lang].moves && I.dict[lang].moves[m.key] && I.dict[lang].moves[m.key].name) || m.name;
  const CAT_KEY = { '物理': 'cat_phys', '特殊': 'cat_spec', '変化': 'cat_stat' };
  const tCat = c => CAT_KEY[c] ? T(lang, CAT_KEY[c]) : c;
  const rows = mv.map(m => {
    const pw = (m.power == null || m.power === 0) ? '—' : m.power, ac = (m.accuracy == null || m.accuracy === 0) ? '—' : m.accuracy;
    const nm = lang === 'ja' ? esc(m.name) : esc(mvName(m));
    return `      <tr data-name="${esc(lang === 'ja' ? m.name : mvName(m))}" data-type="${esc(m.type || '')}" data-cat="${esc(m.category || '')}" data-power="${m.power == null ? '' : m.power}" data-acc="${m.accuracy == null ? '' : m.accuracy}" data-pp="${m.pp == null ? '' : m.pp}">`
      + `<td>${nm}</td><td>${badge(lang, m.type)}</td><td class="cls-${esc(m.category || '')}">${esc(tCat(m.category || ''))}</td>`
      + `<td class="num">${pw}</td><td class="num">${ac}</td><td class="num">${esc(m.pp == null ? '' : m.pp)}</td></tr>`;
  }).join('\n');
  const presentTypes = TYPES.filter(t => mv.some(m => m.type === t));
  const typeBtns = presentTypes.map(t => `<button class="tf t-${esc(t)}" data-type="${esc(t)}">${esc(tType(lang, t))}</button>`).join('');
  const presentCats = ['物理', '特殊', '変化'].filter(c => mv.some(m => m.category === c));
  const catBtns = presentCats.map(c => `<button class="catf cat-${esc(c)}" data-cat="${esc(c)}">${esc(tCat(c))}</button>`).join('');
  return `<div class="list-controls">
      <div class="sort-group" id="mvSort">${esc(T(lang, 'mv_sort'))}
        <button class="sortb on" data-sort="kind">${esc(T(lang, 'mv_sort_kind'))}</button><button class="sortb" data-sort="power">${esc(T(lang, 'mv_sort_power'))}</button><button class="sortb" data-sort="acc">${esc(T(lang, 'mv_sort_acc'))}</button><button class="sortb" data-sort="pp">${esc(T(lang, 'mv_sort_pp'))}</button><button class="sortb" data-sort="name">${esc(T(lang, 'mv_sort_name'))}</button>
      </div>
      <div class="type-filter chips" id="mvType">${esc(T(lang, 'mv_filter'))} <button class="all on" data-type="">${esc(T(lang, 'mv_all_types'))}</button>${typeBtns}</div>
      <div class="type-filter chips" id="mvCat" style="margin-top:6px"><button class="all on" data-cat="">${esc(T(lang, 'mv_all_cats'))}</button>${catBtns}</div>
    </div>
    <div class="table-scroll"><table class="move-table" id="mvTable">
      <thead><tr><th>${esc(T(lang, 'mv_col_name'))}</th><th>${esc(T(lang, 'mv_col_type'))}</th><th>${esc(T(lang, 'mv_col_cat'))}</th><th class="num">${esc(T(lang, 'mv_col_power'))}</th><th class="num">${esc(T(lang, 'mv_col_acc'))}</th><th class="num">${esc(T(lang, 'mv_col_pp'))}</th></tr></thead>
      <tbody id="mvBody">
${rows}
      </tbody>
    </table></div>`;
}
function genPokemonDetail(lang, p) {
  const types = [p.type1, p.type2].filter(Boolean), pN = tPoke(lang, p.name);
  const total = p.hp + p.atk + p.def + p.spatk + p.spdef + p.spd;
  const abils = [p.ab1, p.ab2, p.ab3].filter(Boolean);
  const abilRows = abils.map(a => `<tr><th style="width:28%"><a href="${abilHref(lang, a)}">${esc(tAbName(lang, a))}</a></th><td>${esc(tAbDesc(lang, a, ABID[a] || ''))}</td></tr>`).join('');
  const forms = otherForms(p);
  const formLine = forms.length ? `<p style="margin:4px 0 0;font-size:14px"><b>${esc(T(lang, 'other_forms'))}</b> ${forms.map(f => `<a href="${pokeHref(lang, f.name)}">${esc(tPoke(lang, f.name))}</a>`).join(' ／ ')}</p>` : '';
  const body = head(lang,
    T(lang, 'pokemon_title').replace('{x}', pN).replace('{no}', p.no),
    T(lang, 'pokemon_desc_meta').replace('{x}', pN).replace('{t}', types.map(t => tType(lang, t)).join('/')),
    pageUrl(lang, 'pokemon', p.name), hreflang('pokemon', p.name)
  ) + `
  <nav class="crumbs"><a href="${up(lang)}/index.html">${esc(T(lang, 'home'))}</a> &gt; <a href="index.html">${esc(T(lang, 'pokemon_list'))}</a> &gt; <b>${esc(pN)}</b></nav>
  <article class="card">
    <h1>No.${esc(p.no)} ${esc(pN)}</h1>
    <p>${types.map(t => `<a href="${typeHref(lang, t)}">${badge(lang, t)}</a>`).join('')} ／ ${esc(T(lang, 'weight'))} ${esc(p.weight_kg != null ? p.weight_kg + 'kg' : T(lang, 'unknown'))}</p>
    ${formLine}
    <h2>${esc(T(lang, 'base_stats'))}</h2>
    <table>
      ${statRow(T(lang, 'stat_hp'), p.hp)}${statRow(T(lang, 'stat_atk'), p.atk)}${statRow(T(lang, 'stat_def'), p.def)}
      ${statRow(T(lang, 'stat_spatk'), p.spatk)}${statRow(T(lang, 'stat_spdef'), p.spdef)}${statRow(T(lang, 'stat_spd'), p.spd)}
      <tr><th>${esc(T(lang, 'stat_total'))}</th><td><b>${total}</b></td></tr>
    </table>
    <h2>${esc(T(lang, 'type_matchup'))}</h2>
    ${weaknessTable(lang, p)}
    <h2>${esc(T(lang, 'abilities_h'))}</h2>
    <table>${abilRows}</table>
    ${adBox(lang, 'content-pokemon')}
    <h2>${esc(T(lang, 'learnable_moves'))}</h2>
    ${movesTable(lang, p.name)}
  </article>
  <script>${MOVE_JS}</script>` + FOOT(lang);
  writePage(lang, `pokemon/${pokeSlug(p.name)}.html`, body);
}
function genPokemonIndex(lang) {
  const rows = POKE.map(p => {
    const types = [p.type1, p.type2].filter(Boolean), total = p.hp + p.atk + p.def + p.spatk + p.spdef + p.spd;
    const abCell = [p.ab1, p.ab2, p.ab3].filter(Boolean).map(a => `<a href="${abilHref(lang, a)}" class="ab-chip" data-tip="${esc(tAbDesc(lang, a, ABID[a] || ''))}">${esc(tAbName(lang, a))}</a>`).join('');
    return `      <tr data-name="${esc(tPoke(lang, p.name))}" data-types="${esc(types.join(','))}">`
      + `<td class="num">${esc(p.no)}</td>${imgCells(lang, p.name)}<td class="name"><a href="${esc(pokeSlug(p.name))}.html">${esc(tPoke(lang, p.name))}</a></td>`
      + `<td>${types.map(t => badge(lang, t)).join('')}</td><td class="abils">${abCell}</td>`
      + `<td class="num" data-v="${p.hp}">${p.hp}</td><td class="num" data-v="${p.atk}">${p.atk}</td><td class="num" data-v="${p.def}">${p.def}</td>`
      + `<td class="num" data-v="${p.spatk}">${p.spatk}</td><td class="num" data-v="${p.spdef}">${p.spdef}</td><td class="num" data-v="${p.spd}">${p.spd}</td>`
      + `<td class="num" data-v="${total}"><b>${total}</b></td></tr>`;
  }).join('\n');
  const typeBtns = TYPES.map(t => `<button class="tf t-${esc(t)}" data-type="${esc(t)}">${esc(tType(lang, t))}</button>`).join('');
  const body = head(lang,
    T(lang, 'pokemon_list_title').replace('{n}', POKE.length),
    T(lang, 'pokemon_list_desc').replace('{n}', POKE.length),
    indexUrl(lang, 'pokemon'), hreflang('index', 'pokemon')
  ) + `
  <nav class="crumbs"><a href="${up(lang)}/index.html">${esc(T(lang, 'home'))}</a> &gt; <b>${esc(T(lang, 'pokemon_list'))}</b></nav>
  <article class="card">
    <h1>${esc(T(lang, 'pokemon_list'))}</h1>
    <p class="lead">${T(lang, 'pokemon_list_lead').replace('{n}', POKE.length)}</p>
    <p class="to-all"><a href="all.html">${esc(T(lang, 'link_to_all'))}</a></p>
    <div class="list-controls">
      <input class="search" id="pkSearch" type="search" placeholder="${esc(T(lang, 'pk_search_ph'))}">
      <div class="type-filter chips" id="pkTypeFilter"><button class="all on" data-type="">${esc(T(lang, 'pk_all'))}</button>${typeBtns}</div>
      <span class="filter-count" id="pkCount"></span>
    </div>
    <div class="table-scroll"><table class="sortable list-table" id="pkTable">
      <thead><tr>
        <th class="num" data-k="no">${esc(T(lang, 'col_no'))}</th><th>${esc(T(lang, 'col_art'))}</th><th>${esc(T(lang, 'col_sprite'))}</th><th>${esc(T(lang, 'col_home'))}</th><th data-k="name">${esc(T(lang, 'col_name'))}</th><th>${esc(T(lang, 'col_type'))}</th>
        <th>${esc(T(lang, 'col_ability'))}<span style="font-weight:400;font-size:11px;color:#888">${esc(T(lang, 'col_ability_hint'))}</span></th>
        <th class="num" data-k="hp">${esc(T(lang, 'col_hp'))}</th><th class="num" data-k="atk">${esc(T(lang, 'col_atk'))}</th><th class="num" data-k="def">${esc(T(lang, 'col_def'))}</th>
        <th class="num" data-k="spatk">${esc(T(lang, 'col_spatk'))}</th><th class="num" data-k="spdef">${esc(T(lang, 'col_spdef'))}</th><th class="num" data-k="spd">${esc(T(lang, 'col_spd'))}</th><th class="num" data-k="total">${esc(T(lang, 'col_total'))}</th>
      </tr></thead>
      <tbody id="pkBody">
${rows}
      </tbody>
    </table></div>
    <p class="credit">${T(lang, 'poke_credit')}</p>
  </article>
  ${adBox(lang, 'content-pokemon-list')}
  <script>${listJs(T(lang, 'pk_count_unit'))}</script>
  <script>${TIP_JS}</script>
  <script>${LIGHTBOX_JS}</script>` + FOOT(lang);
  writePage(lang, 'pokemon/index.html', body);
}

// ---- 全国版一覧(all.html): master_pokemon.json 全エントリ(ja名で重複間引き=約1330行) ----
// 列: No / 絵(オリジナル) / 公式スプライト / 名前 / タイプ / 合計種族値。
// 個別ページへのリンクは Champions 登場ポケモン(champions!=null)のみ(全国版に個別ページは無い)。
// No を先頭(children[0])に置くことで listJs の 'no' ソート前提を維持。
function genPokemonAllIndex(lang) {
  // ja名で重複フォームを間引いてから図鑑No順に並べる(2026-07-10 阿部さん: デフォルトはナンバー順。
  // master順だとフォーム違いが末尾にまとまっていた。sortは安定=同Noはmaster順(デフォルトの姿が先))
  const seen = new Set(), entries = [];
  for (const e of MASTER) {
    const ja = e.names && e.names.ja;
    if (ja == null || seen.has(ja)) continue;   // ja名で重複フォームは初出のみ(約1330行)
    seen.add(ja);
    entries.push(e);
  }
  entries.sort((a, b) => (a.dex != null ? a.dex : 99999) - (b.dex != null ? b.dex : 99999));
  const rows = [];
  for (const e of entries) {
    const ja = e.names.ja;
    const types = (e.types || []).filter(Boolean), s = e.stats || {};
    const total = (s.hp || 0) + (s.atk || 0) + (s.def || 0) + (s.spa || 0) + (s.spd || 0) + (s.spe || 0);
    // master は9言語内蔵→辞書不要。ja名の「(gmax)」は正式名「(キョダイマックス)」で表示
    // (2026-07-10 阿部さん。画像ファイル名はja原名(gmax)のままなので imgCells には ja を渡す=参照不変)
    const nm = (e.names[lang] != null ? e.names[lang] : ja).replace(/\(gmax\)/i, '(キョダイマックス)');
    const slug = champNames.has(ja) ? (pokeSlug(ja) || '') : '';   // Champions のみ個別ページへ
    const nameCell = slug ? `<a href="${esc(slug)}.html">${esc(nm)}</a>` : esc(nm);
    const dex = e.dex != null ? e.dex : '';
    rows.push(`      <tr data-name="${esc(nm)}" data-types="${esc(types.join(','))}">`
      + `<td class="num">${esc(dex)}</td>${imgCells(lang, ja)}`
      + `<td class="name">${nameCell}</td>`
      + `<td>${types.map(t => badge(lang, t)).join('')}</td>`
      + `<td class="num" data-v="${total}"><b>${total}</b></td></tr>`);
  }
  const n = rows.length;
  const typeBtns = TYPES.map(t => `<button class="tf t-${esc(t)}" data-type="${esc(t)}">${esc(tType(lang, t))}</button>`).join('');
  const body = head(lang,
    T(lang, 'pokemon_all_title').replace('{n}', n),
    T(lang, 'pokemon_all_desc').replace('{n}', n),
    allUrl(lang), hreflangAll()
  ) + `
  <nav class="crumbs"><a href="${up(lang)}/index.html">${esc(T(lang, 'home'))}</a> &gt; <a href="index.html">${esc(T(lang, 'pokemon_list'))}</a> &gt; <b>${esc(T(lang, 'pokemon_all_list'))}</b></nav>
  <article class="card">
    <h1>${esc(T(lang, 'pokemon_all_list'))}</h1>
    <p class="lead">${T(lang, 'pokemon_all_lead').replace('{n}', n)}</p>
    <p class="to-champions"><a href="index.html">${esc(T(lang, 'link_to_champions'))}</a></p>
    <div class="list-controls">
      <input class="search" id="pkSearch" type="search" placeholder="${esc(T(lang, 'pk_search_ph'))}">
      <div class="type-filter chips" id="pkTypeFilter"><button class="all on" data-type="">${esc(T(lang, 'pk_all'))}</button>${typeBtns}</div>
      <span class="filter-count" id="pkCount"></span>
    </div>
    <div class="table-scroll"><table class="sortable list-table" id="pkTable">
      <thead><tr>
        <th class="num" data-k="no">${esc(T(lang, 'col_no'))}</th><th>${esc(T(lang, 'col_art'))}</th><th>${esc(T(lang, 'col_sprite'))}</th><th>${esc(T(lang, 'col_home'))}</th><th data-k="name">${esc(T(lang, 'col_name'))}</th><th>${esc(T(lang, 'col_type'))}</th><th class="num" data-k="total">${esc(T(lang, 'col_total'))}</th>
      </tr></thead>
      <tbody id="pkBody">
${rows.join('\n')}
      </tbody>
    </table></div>
    <p class="credit">${T(lang, 'poke_credit')}</p>
  </article>
  ${adBox(lang, 'content-pokemon-list')}
  <script>${listJs(T(lang, 'pk_count_unit'))}</script>
  <script>${LIGHTBOX_JS}</script>` + FOOT(lang);
  writePage(lang, 'pokemon/all.html', body);
}

// ===========================================================
// 3) タイプ(個別のみ・一覧は type_chart.html と重複で廃止)
// ===========================================================
function genTypeDetail(lang, t) {
  const ai = tIdx(t), tN = tType(lang, t);
  const off = { good: [], bad: [], no: [] };
  TYPES.forEach((dt, di) => { const m = TYPE_CHART[ai][di]; if (m === 2) off.good.push(dt); else if (m === 0.5) off.bad.push(dt); else if (m === 0) off.no.push(dt); });
  const def = { weak: [], resist: [], no: [] };
  TYPES.forEach((at, x) => { const m = TYPE_CHART[x][ai]; if (m === 2) def.weak.push(at); else if (m === 0.5) def.resist.push(at); else if (m === 0) def.no.push(at); });
  const owns = POKE.filter(p => p.type1 === t || p.type2 === t);
  const line = arr => arr.length ? arr.map(x => badge(lang, x)).join('') : `<span style="color:var(--muted)">${esc(T(lang, 'none'))}</span>`;
  const body = head(lang,
    T(lang, 'type_title').replace(/\{x\}/g, tN),
    T(lang, 'type_desc_meta').replace(/\{x\}/g, tN),
    pageUrl(lang, 'type', t), hreflang('type', t)
  ) + `
  <nav class="crumbs"><a href="${up(lang)}/index.html">${esc(T(lang, 'home'))}</a> &gt; <a href="${up(lang)}/type_chart.html">${esc(T(lang, 'type_chart_nav'))}</a> &gt; <b>${esc(tN)}</b></nav>
  <article class="card">
    <h1>${badge(lang, t)} ${esc(T(lang, 'type_h1').replace('{x}', tN))}</h1>
    <h2>${esc(T(lang, 'type_attacking').replace('{x}', tN))}</h2>
    <table>
      <tr><th style="width:34%">${esc(T(lang, 'type_super'))}</th><td>${line(off.good)}</td></tr>
      <tr><th>${esc(T(lang, 'type_notvery'))}</th><td>${line(off.bad)}</td></tr>
      <tr><th>${esc(T(lang, 'type_no'))}</th><td>${line(off.no)}</td></tr>
    </table>
    <h2>${esc(T(lang, 'type_defending').replace('{x}', tN))}</h2>
    <table>
      <tr><th style="width:34%">${esc(T(lang, 'type_weak'))}</th><td>${line(def.weak)}</td></tr>
      <tr><th>${esc(T(lang, 'type_resist'))}</th><td>${line(def.resist)}</td></tr>
      <tr><th>${esc(T(lang, 'type_immune'))}</th><td>${line(def.no)}</td></tr>
    </table>
    <h2>${esc(T(lang, 'type_owners').replace('{x}', tN).replace('{n}', owns.length))}</h2>
    <div class="chips">${owns.map(p => `<a href="${pokeHref(lang, p.name)}">${esc(tPoke(lang, p.name))}</a>`).join('')}</div>
  </article>
  ${adBox(lang, 'content-type')}` + FOOT(lang);
  writePage(lang, `type/${fileBase(lang, 'type', t)}.html`, body);
}

// ===========================================================
// 実行
// ===========================================================
let n = 0;
for (const lang of GEN_LANGS) {
  genAbilityIndex(lang); ALL_ABIL.forEach(ab => genAbilityDetail(lang, ab));
  genPokemonIndex(lang); genPokemonAllIndex(lang); POKE.forEach(p => genPokemonDetail(lang, p));
  TYPES.forEach(t => genTypeDetail(lang, t));
  n += 1 + ALL_ABIL.length + 1 /* pokemon index */ + 1 /* pokemon all */ + POKE.length + TYPES.length;
  console.log(`  [${lang}] ability ${1 + ALL_ABIL.length} / pokemon ${2 + POKE.length} (list+all+${POKE.length} details) / type ${TYPES.length}`);
}
console.log(`✅ 生成完了: ${GEN_LANGS.join(',')} = 計 ${n} ページ`);
