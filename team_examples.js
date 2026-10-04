/* Catalogue IDs and entity facts come from PokeDB; API artwork uses existing site assets. */
'use strict';
function buildTeamExampleModel(example) {
 return {example, members:example.members.map(set=>{
  const pokemon=PokeDB.allPokemon().find(p=>p.slug===set.pokemon),ability=set.ability===null?null:PokeDB.ability(set.ability),item=PokeDB.items().find(i=>i.slug===set.item),nature=PokeDB.natures().find(n=>n.up===set.nature[0]&&n.down===set.nature[1]);
  const moves=set.moves.map(id=>PokeDB.move(id));
  if(!pokemon||(set.ability!==null&&!ability)||!item||!nature||moves.some(m=>!m))throw new Error('Unresolved example: '+example.slug);
  const mega=set.mega?PokeDB.allPokemon().find(p=>p.slug===set.mega):null;
  if(set.mega&&!mega)throw new Error('Unresolved Mega form');
  return {set,pokemon,ability,item,nature,moves,mega};
 })};
}
(function(){
 let ready=false,itemSprites=new Set(),filterLang=null;
 const filter={format:'',regulation:'',season:'',search:''};
 const matchValue=v=>v==null?'__unknown__':v;
 // This is the existing asset manifest used by items_db_all_v2.html, not game data.
 const spritesReady=fetch('images/item/_manifest.json').then(r=>{if(!r.ok)throw new Error('Item artwork manifest');return r.json();}).then(names=>{itemSprites=new Set(names);}).catch(()=>{});
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const t=k=>I18N.t('teamExamples.'+k);
 function link(text,url){const a=el('a',text);a.href=url;return a;}
 function artwork(p,cls){
  const img=el('img',null,cls);img.alt='';img.loading='lazy';img.width=128;img.height=128;
  // Existing real_battle API mode: shared-master PokeAPI ID -> locally cached sprite.
  // User explicitly requested API artwork here; never fall back to original art.
  if(!Number.isInteger(p.pokeapi_id)){const placeholder=el('span','◇',cls+' missing-art');placeholder.title=I18N.t('items_list.no_image');return placeholder;}
  img.src='images/poke/'+p.pokeapi_id+'.png';
  img.onerror=()=>{if(!img.dataset.remote){img.dataset.remote='1';img.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'+p.pokeapi_id+'.png';}else{img.style.visibility='hidden';img.parentNode.title=I18N.t('items_list.no_image');}};
  return img;
 }
 function typeChip(type){
  const color=PokeDB.typeColor(type),badge=el('span',I18N.type(type),'badge te-type');badge.style.background=color;
  // Contrast is calculated from the shared type color; no second color table.
  const hex=color.replace('#',''),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
  badge.style.color=(rgb[0]*.299+rgb[1]*.587+rgb[2]*.114)>155?'#172536':'#fff';return badge;
 }
 function controls(examples){
  if(filterLang===I18N.lang)return;filterLang=I18N.lang;
  const host=document.getElementById('example-controls');host.replaceChildren();
  for(const [key,labelKey] of [['format','filterFormat'],['regulation','filterRules'],['season','filterSeason']]){
   const label=el('label',t(labelKey)),select=el('select');select.setAttribute('aria-label',t(labelKey));select.id='example-filter-'+key;
   const all=el('option',t('all'));all.value='';select.append(all);
   [...new Set(examples.map(e=>matchValue(e[key])))].sort().forEach(value=>{const option=el('option',value==='__unknown__'?t('unknown'):key==='format'?t(value):value);option.value=value;select.append(option);});
   select.value=filter[key];select.onchange=()=>{filter[key]=select.value;render();};label.append(select);host.append(label);
  }
  const label=el('label',t('search')),input=el('input');input.type='search';input.id='example-search';input.value=filter.search;input.setAttribute('aria-label',t('search'));input.oninput=()=>{filter.search=input.value;render();};label.append(input);host.append(label);
 }
 function resultText(result){
  if(result.display_key)return I18N.t(result.display_key);
  const parts=[];
  if(result.event_key)parts.push(I18N.t(result.event_key));else if(result.event)parts.push(result.event);
  const metric=(key,value)=>{if(value!=null)parts.push(t(key).replace('{value}',String(value)));};
  metric(result.rank_type==='at_peak_screenshot_not_final'?'screenshotRank':'finalRank',result.rank);
  metric('screenshotRank',result.rank_screenshot);
  if(result.rank_range)metric('finalRank',result.rank_range.join('–'));
  metric('ratingValue',result.rating??result.rating_screenshot??result.rating_article);
  metric('peakRating',result.peak_rating_article??result.rating_article_peak);
  metric('ratingThreshold',result.rating_threshold_article);
  if(result.achievement_key)parts.push(I18N.t(result.achievement_key));
  if(result.wins!=null&&result.losses!=null)parts.push(t('winLoss').replace('{wins}',result.wins).replace('{losses}',result.losses));
  parts.push(t('reported'));return parts.join(' / ');
 }
 function render(){
  if(!ready||!window.I18N)return;
  const host=document.getElementById('examples');host.replaceChildren();const all=PokeDB.teamExamples();controls(all);
  const matches=all.filter(e=>['format','regulation','season'].every(key=>!filter[key]||matchValue(e[key])===filter[key])&&(!filter.search||[e.source.author,e.source.author_id,e.source.original_title,...e.members.map(m=>{const p=PokeDB.allPokemon().find(p=>p.slug===m.pokemon);return p?I18N.pokemon(p.name):'';})].join(' ').toLocaleLowerCase().includes(filter.search.toLocaleLowerCase())));
  document.getElementById('example-count').textContent=t('found').replace('{count}',matches.length).replace('{total}',all.length);
  for(const example of matches){
   const model=buildTeamExampleModel(example),card=el('article',null,'example card');card.id=example.slug;
   let summary=I18N.t(example.summary_key);model.members.forEach((m,i)=>{summary=summary.replaceAll('{p'+i+'}',I18N.pokemon(m.pokemon.name));if(m.mega)summary=summary.replaceAll('{g'+i+'}',I18N.pokemon(m.mega.name));});
   summary=summary.replace(/\{m:([^}]+)\}/g,(_,id)=>{const move=PokeDB.move(id);return move?I18N.move(move.slug,move.name):'';});
   summary=summary.replace(/\{i:([^}]+)\}/g,(_,id)=>{const item=PokeDB.items().find(item=>item.slug===id);return item?I18N.item(item.name):'';});
   card.append(el('h2',I18N.t(example.title_key)+(example.title_key==='teamExamples.curatedTitle'?' — '+example.source.author:'')),el('p',summary,'example-summary'));
   card.append(el('p',t(example.format)+' / '+t('rules')+': '+(example.regulation||t('unknown'))+' / '+(example.season||t('unknown')),'meta'));
   if(example.result&&example.result.verification==='author_reported')card.append(el('p',resultText(example.result),'note result-note'));
   if(example.status==='source_incomplete')card.append(el('p',t('incomplete'),'note'));
   card.append(el('p',t('checked')+': '+example.verified_at+' / '+(example.published_at||t('unknownDate')),'meta'));
   const source=el('p',t('source')+': ','source-line'),a=link([example.source.author,example.source.author_id,example.source.original_title].filter(Boolean).join(' / '),example.source.url);a.rel='noopener noreferrer';source.append(a);card.append(source);
   const strip=el('nav',null,'team-strip');strip.setAttribute('aria-label',I18N.t('teamGuide.team'));
   model.members.forEach((m,i)=>{const a=link('', '#'+example.slug+'-'+i);a.title=I18N.pokemon(m.pokemon.name);a.setAttribute('aria-label',a.title);a.append(artwork(m.pokemon,'strip-sprite'));a.onclick=()=>{details.open=true;};strip.append(a);});card.append(strip);
   const restricted=model.members.some(m=>!m.moves.every(move=>(PokeDB.learnset(m.pokemon.name)||[]).includes(move.name)));
   if(restricted){const warning=el('p',t('historicalRestricted'),'note');const url=example.current_rule_compatibility&&example.current_rule_compatibility.official_source_url;if(url&&/^https:\/\//.test(url)){warning.append(link(t('source'),url));}card.append(warning);}
   const details=el('details',null,'team-sets');if((location.hash||'').startsWith('#'+example.slug+'-'))details.open=true;details.append(el('summary',t('sets')));const members=el('ol',null,'te-members');
   model.members.forEach((m,i)=>{
    const li=el('li',null,'member-card');li.id=example.slug+'-'+i;
    const head=el('div',null,'member-head'),portrait=el('div',null,'portrait'),info=el('div',null,'member-info');portrait.append(artwork(m.pokemon,'pokemon-art'));
    const h=el('h3'),prefix=I18N.lang==='ja'?'':I18N.lang+'/';h.append(link(I18N.pokemon(m.pokemon.name),prefix+'pokemon/'+m.pokemon.slug+'.html'));if(m.set.gender)h.append(el('span',' '+m.set.gender,'gender'));info.append(h);
    const types=el('div',null,'types');[m.pokemon.type1,m.pokemon.type2].filter(Boolean).forEach(type=>types.append(typeChip(type)));info.append(types);
    const qualities=el('div',null,'qualities');const ab=el('span',m.ability?I18N.ability(m.ability.name):t('unknown'),'quality');ab.title=I18N.t('teamGuide.ability');const nature=el('span',I18N.nature(m.nature.name),'quality');nature.title=I18N.t('teamGuide.nature');qualities.append(ab,nature);info.append(qualities);
    const held=el('div',null,'held-item'),icon=el('span',null,'item-art');
    if(m.item.pokeapi_slug&&itemSprites.has(m.item.pokeapi_slug)){
     const img=el('img');img.src='images/item/'+encodeURIComponent(m.item.pokeapi_slug)+'.png';img.alt='';img.loading='lazy';img.width=28;img.height=28;img.onerror=()=>{img.style.visibility='hidden';};icon.append(img);
    }else{icon.textContent='◇';icon.title=I18N.t('items_list.no_image');icon.className+=' missing-art';}
    held.append(icon,el('span',I18N.item(m.item.name)));info.append(held);head.append(portrait,info);li.append(head);
    const moves=el('ul',null,'member-moves');m.moves.forEach(move=>{const row=el('li'),dot=el('span',null,'move-dot');dot.style.background=PokeDB.typeColor(move.type);row.append(dot,el('span',I18N.move(move.slug,move.name)));moves.append(row);});li.append(moves);
    const table=el('table',null,'point-table');table.append(el('caption',I18N.t('teamGuide.points')));const header=el('tr'),values=el('tr');
    ['hp','atk','def','spatk','spdef','spd'].forEach((key,j)=>{const cls=m.nature.up===key?'nature-up':m.nature.down===key?'nature-down':'';const th=el('th',I18N.t('teamGuide.'+key),cls);th.scope='col';header.append(th);values.append(el('td',String(m.set.points[j])));});
    const thead=el('thead'),tbody=el('tbody');thead.append(header);tbody.append(values);table.append(thead,tbody);li.append(table);
    if(m.mega){const mega=el('div',null,'mega-row');mega.append(artwork(m.mega,'mega-art'),el('span',t('mega')+': '+I18N.pokemon(m.mega.name)));li.append(mega);}
    for(const key of m.set.notes||[])li.append(el('p',t(key),'meta member-note'));
    if(m.item.implemented===false)li.append(el('p',t('unsupportedItem'),'note member-note'));
    members.append(li);
   });details.append(members);card.append(details);
   const actions=el('div',null,'actions'),q='?lang='+encodeURIComponent(I18N.lang);
   if(example.article)actions.append(link(t('article'),example.article+q));
   if(!restricted){actions.append(link(t('builder'),'party_checker.html'+q+'&team-example='+encodeURIComponent(example.slug)));if(example.format==='single')actions.append(link(t('battle'),'real_battle.html'+q+'&team-example='+encodeURIComponent(example.slug)));}
   if(example.format==='double')actions.append(el('p',t('doubleUnsupported'),'meta'));card.append(actions);host.append(card);
  }
  if(!host.children.length)host.append(el('p',t('empty')));
  document.querySelectorAll('[data-home]').forEach(a=>a.href=(I18N.lang==='ja'?'':I18N.lang+'/')+'index.html');
  document.querySelectorAll('[data-local-page]').forEach(a=>a.href=a.dataset.localPage+'?lang='+encodeURIComponent(I18N.lang));I18N.apply();
 }
 document.addEventListener('i18n:ready',render);document.addEventListener('i18n:changed',render);
 Promise.all([PokeDB.ready,spritesReady]).then(()=>{ready=true;render();}).catch(e=>PokeDB.showLoadError(e.message,document.getElementById('examples')));
})();
