/* Settings are supplied by the shared master catalogue through PokeDB. */
'use strict';
let TEAM_GUIDE_SETS = [];
(function () {
 let ready=false;
 const el=(tag,text,cls)=>{const n=document.createElement(tag); if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const t=key=>I18N.t('teamGuide.'+key);
 function render() {
  if(!ready || !window.I18N)return;
  const host=document.getElementById('team-members');host.replaceChildren();
  const prefix=I18N.lang==='ja'?'':I18N.lang+'/';
  TEAM_GUIDE_SETS.forEach((set,i)=>{
   const p=PokeDB.allPokemon().find(x=>x.slug===set.pokemon),ab=PokeDB.ability(set.ability);
   const item=PokeDB.items().find(x=>x.slug===set.item);
   const nature=PokeDB.natures().find(x=>x.up===set.nature[0] && x.down===set.nature[1]);
   if(!p||!ab||!item||!nature)throw new Error('Unresolved team entry: '+set.pokemon);
   const card=el('article',null,'member');card.id=set.pokemon;
   const h=el('h3');const a=el('a',I18N.pokemon(p.name));a.href=prefix+'pokemon/'+p.slug+'.html';
   h.append(el('span',String(i+1).padStart(2,'0'),'number'),a);card.append(h);
   const dl=el('dl');
   [[t('ability'),I18N.ability(ab.name)],[t('item'),I18N.item(item.name)],[t('nature'),I18N.nature(nature.name)]].forEach(([k,v])=>dl.append(el('dt',k),el('dd',v)));
   card.append(dl);
   const moves=el('ul',null,'moves');
   set.moves.forEach(id=>{const m=PokeDB.move(id);if(!m)throw new Error('Unknown move: '+id);moves.append(el('li',I18N.move(m.slug,m.name)));});
   const table=el('table');table.append(el('caption',t('points')));
   const head=el('tr'),body=el('tr');
   ['hp','atk','def','spatk','spdef','spd'].forEach((k,j)=>{const th=el('th',t(k));th.scope='col';head.append(th);body.append(el('td',String(set.points[j])));});
   const th=el('thead'),tb=el('tbody');th.append(head);tb.append(body);table.append(th,tb);
   card.append(moves,table,el('p',t('role'+i)));host.append(card);
  });
  document.querySelectorAll('[data-home]').forEach(a=>a.href=prefix+'index.html');
  document.querySelectorAll('[data-local-page]').forEach(a=>a.href=a.dataset.localPage+'?lang='+encodeURIComponent(I18N.lang));
  document.querySelectorAll('[data-tool]').forEach(a=>a.href=a.dataset.tool+'?lang='+encodeURIComponent(I18N.lang)+(a.dataset.tool==='party_checker.html'?'&team-example=s-mb-m5-291':''));
  const ab=PokeDB.ability('clear-body'),a=document.getElementById('ability-link');
  a.textContent=I18N.ability(ab.name);a.href=prefix+'ability/'+(I18N.lang==='ja'?encodeURIComponent(ab.name):ab.slug)+'.html';
  document.getElementById('ability-explanation').textContent=I18N.lang==='ja'?ab.effect_ja:I18N.abilityDesc(ab.name);
  I18N.apply();
 }
 document.addEventListener('i18n:ready',render);document.addEventListener('i18n:changed',render);
 PokeDB.ready.then(()=>{const example=PokeDB.teamExample('s-mb-m5-291');if(!example)throw new Error('Missing team example');TEAM_GUIDE_SETS=example.members;ready=true;render();}).catch(e=>PokeDB.showLoadError(e.message,document.getElementById('team-members')));
})();
