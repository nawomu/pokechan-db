'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const files=['pokemon','moves','items','learnsets','regulations'];
const master=Object.fromEntries(files.map(k=>[k,read('master/'+k+'.json')]));
async function run(lang,changed=false,topOnly=false){
 const input=structuredClone(master);if(changed){input.regulations.items[0].ranked_season.id='test-season';input.regulations.items[0].end_jst='test-end';}
 const ids=['current-reg-note','news-current-season','current-season-period','current-season-title','current-season-rules','current-season-unlock','current-season-pass','current-season-premium','current-season-source','current-pass-source','priority-example','priority-example-setup','priority-example-result'];
 const node=()=>({hidden:true,textContent:'',children:[],append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;}});
 const elements=Object.fromEntries((topOnly?[]:ids).map(id=>[id,node()])),events={};
 elements['top-news-list']=node();const newsUrl=lang==='ja'?'news.html':'../news.html';elements['top-news-all']={getAttribute:()=>newsUrl};
 const ctx={window:{},location:{search:''},document:{currentScript:{src:'https://example.test/pokedb.js',getAttribute:()=>(topOnly?['regulations']:files).join(',')},createElement:node,getElementsByTagName:()=>[],querySelectorAll:()=>[],getElementById:id=>elements[id]||null,addEventListener(name,fn){(events[name]||=[]).push(fn);}},fetch:async url=>({ok:true,json:async()=>input[url.match(/([^/]+)\.json$/)[1]]})};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'pokedb.js'),'utf8'),ctx);ctx.PokeDB=ctx.window.PokeDB;await ctx.PokeDB.ready;
 const errors=[];ctx.PokeDB.showLoadError=e=>errors.push(e.stack||String(e));
 vm.runInContext(fs.readFileSync(path.join(root,'current_info.js'),'utf8'),ctx);
 const ui=read('i18n/ui-'+lang+'.json'),dict=lang==='ja'?null:read('i18n/'+lang+'.json');let ready;
 ctx.I18N=ctx.window.I18N={onReady(fn){ready=fn;},t:key=>key.split('.').reduce((o,k)=>o&&o[k],ui)||key,pokemon:n=>dict?.pokemon[n]||n,item:n=>dict?.items[n]?.name||n,move:(key,n)=>dict?.moves[key]?.name||n};
 events['i18n:ready'][0]();await new Promise(resolve=>setImmediate(resolve));assert.equal(elements['top-news-list'].children.length,0);ready();await new Promise(resolve=>setImmediate(resolve));
 const rows=elements['top-news-list'].children;assert.equal(rows.length,2);assert(rows.every(row=>row.children[1].textContent.trim()));assert(rows[0].children[0].textContent.includes('2026-10-07'));assert(rows[0].children[0].textContent.includes('2026-11-04'));assert(rows[0].children[1].textContent.includes(changed?'test-season':'M-7'));assert.equal(rows[0].children[1].href,newsUrl+'#news-current-season');assert(rows[1].children[1].textContent.includes('M-C'));assert(rows[1].children[1].textContent.includes(changed?'test-end':'2026-12-02'));assert(!rows.some(row=>row.children[1].textContent.includes('currentInfo.')));
 if(topOnly){
  const english=read('i18n/ui-en.json');ctx.I18N.t=key=>key.split('.').reduce((o,k)=>o&&o[k],english)||key;
  events['i18n:changed'][0]();await new Promise(resolve=>setImmediate(resolve));ready();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements['top-news-list'].children.length,2);assert.equal(elements['top-news-list'].children[0].children[1].textContent,'Ranked Battle Season M-7');assert.deepEqual(errors,[]);return;
 }
 assert.deepEqual(errors,[]);assert(!elements['news-current-season'].hidden);const text=Object.values(elements).map(e=>e.textContent).join(' ');
 assert(text.includes(changed?'test-season':'M-7'));assert(text.includes(changed?'test-end':'2026-12-02'));assert(text.includes('2026-11-04'));assert(text.includes('2026-10-14'));assert(text.includes('9500'));assert(!/currentInfo\.|\{\w+\}|undefined/.test(text));
 assert(elements['priority-example-setup'].textContent.includes('+1'));
 assert.equal(elements['current-season-source'].href,input.regulations.items[0].ranked_season.source_url);
 events['i18n:changed'][0]();await new Promise(resolve=>setImmediate(resolve));ready();await new Promise(resolve=>setImmediate(resolve));assert(!elements['news-current-season'].hidden);
}
(async()=>{
 const source=read('reference/_regulations.json').items;assert.deepEqual(source,master.regulations.items);
 const reg=source.find(r=>r.role==='current');assert.equal(reg.id,'M-C');assert.equal(source.length,1);
 const ja=read('i18n/ui-ja.json').currentInfo;
 for(const lang of ['ja','en','fr','de','es','it','ko','zh-Hans','zh-Hant']){const ui=read('i18n/ui-'+lang+'.json').currentInfo;assert.deepEqual(Object.keys(ui),Object.keys(ja));for(const k of Object.keys(ja))assert.deepEqual([...ui[k].matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(),[...ja[k].matchAll(/\{\w+\}/g)].map(x=>x[0]).sort());await run(lang);await run(lang,false,true);
 const html=fs.readFileSync(path.join(root,lang==='ja'?'index.html':lang+'/index.html'),'utf8');assert(!html.includes('new DOMParser()'),'Do not harvest empty script-rendered news cards');assert(html.includes('data-files="regulations"'));assert(html.includes((lang==='ja'?'':'../')+'current_info.js?v=20261007-top-news'));}
 await run('en',true);
 for(const name of ['ふうせん','メンタルハーブ','きれいなぬけがら']){const item=master.items.items.find(i=>i.name===name);assert.equal(item.effect_house,read('reference/_items_fixes.json').fixes[name].effect_house);}
 const rows=master.learnsets.items;for(const [name,moves] of [['ブリジュラス',['ミラーコート','メタルバースト']],['ニョロトノ',['はたく']]])for(const move of moves){const row=rows.find(r=>r.name===name);assert(!row.learn.includes(move));assert(row.confiscated.includes(move));}
 const moves=read('master/moves.json').items;for(const [id,key,value] of [['wish','pp',8],['strength-sap','pp',8],['slash','power',80],['snipe-shot','power',85],['meteor-assault','power',170]])assert.equal(moves.find(m=>m.slug===id)[key],value);
 assert.equal(moves.find(m=>m.slug==='double-shock').flags.punch,true);assert.equal(moves.find(m=>m.slug==='milk-drink').target,'自分か味方');
 const E=require('./_sim_engine').buildEngine(),data=require('../pokechan_data');
 function side(name,move,item=''){const s=E.makeSideState();s.poke=data.POKEMON_LIST.find(p=>p.name===name);s.moves=[Object.values(data.WAZA_MAP).find(m=>m.name===move)];s.item=item;s.currentHp=E.realStat(s,'hp');return s;}
 E.sides.self=side('カビゴン','じしん');E.sides.opp=side('メタグロス','まもる','air_balloon');E.setRandom(()=>0.5);
 const hp=E.sides.opp.currentHp;E.runSingleAttack('self',0);E.runSingleAttack('self',0);assert.equal(E.sides.opp.currentHp,hp);assert.equal(E.sides.opp.item,'air_balloon');
 E.sides.self.moves=[Object.values(data.WAZA_MAP).find(m=>m.name==='はたく')];E.runSingleAttack('self',0);assert(E.sides.opp.currentHp<hp);assert.equal(E.sides.opp.item,'');assert(E.sides.opp.airBalloonBurst);
 E.sides.self=side('フシギバナ','ねむる','mental_herb');E.sides.opp=side('カビゴン','ねむる');Object.assign(E.sides.self,{encore:{move:E.sides.self.moves[0],turns:2},disable:{move:E.sides.self.moves[0],turns:2},tormented:true,tauntTurns:3,healBlockTurns:3,attracted:true,status:'sleep'});E.sides.opp.status='sleep';E.runTurn();assert.equal(E.sides.self.item,'');for(const k of ['encore','disable','tormented','tauntTurns','healBlockTurns','attracted'])assert(!E.sides.self[k],k);
 E.sides.self=side('フシギバナ','まもる');E.sides.opp=side('カビゴン','まもる');E.sides.self.trapped=true;E.sides.self.bench=[side('メタグロス','まもる')];assert.equal(E.attemptSwitch('self',0),false);E.sides.self.item='kireina_nukegara';assert.equal(E.attemptSwitch('self',0),true);assert.equal(E.sides.self.poke.name,'メタグロス');
 console.log('PASS: real PokeDB readiness; source changes reach views; nine language templates/names; season vs regulation; pass refs; legal priority example; official move changes and forbidden learnsets. No layout/browser claim.');
})().catch(e=>{console.error(e);process.exitCode=1;});
