// No browser/server: test real PokeDB loader and both consumers in a VM.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const files=['pokemon','moves','abilities','items','natures','types','learnsets','team_examples'],master=Object.fromEntries(files.map(k=>[k,read('master/'+k+'.json')]));
function node(tag){return{tagName:tag.toUpperCase(),children:[],dataset:{},style:{},append(...xs){this.children.push(...xs);},replaceChildren(){this.children=[];},setAttribute(){}};}
async function run(input,lang='ja'){
 const host=node('div'),controls=node('div'),count=node('p'),ctx={window:{},location:{search:''},URLSearchParams,fetch:async url=>({ok:true,json:async()=>url==='images/item/_manifest.json'?read(url):input[url.match(/([^/]+)\.json$/)[1]]}),document:{currentScript:{src:'https://example.test/pokedb.js',getAttribute:()=>files.join(',')},createElement:node,getElementsByTagName:()=>[],addEventListener(){},getElementById:id=>id==='examples'?host:id==='example-controls'?controls:count,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'pokedb.js'),'utf8'),ctx);ctx.PokeDB=ctx.window.PokeDB;
 await ctx.PokeDB.ready;
 // Article gets canonical members once readiness resolves; no DOM rendering without I18N.
 vm.runInContext(fs.readFileSync(path.join(root,'team_guide.js'),'utf8'),ctx);await Promise.resolve();
 const article=vm.runInContext('TEAM_GUIDE_SETS',ctx);
 const ja=read('i18n/ui-'+lang+'.json');ctx.I18N=ctx.window.I18N={lang,t:key=>key.split('.').reduce((o,k)=>o&&o[k],ja)||key,type:n=>n,pokemon:n=>n,ability:n=>n,item:n=>n,nature:n=>n,move:(_,n)=>n,apply(){}};
 vm.runInContext(fs.readFileSync(path.join(root,'team_examples.js'),'utf8'),ctx);await new Promise(resolve=>setImmediate(resolve));
 const model=vm.runInContext("buildTeamExampleModel(PokeDB.teamExample('s-mb-m5-291'))",ctx);
 assert.equal(host.children.length,input.team_examples.items.length);assert.equal(model.members.length,6);
 assert.strictEqual(article,ctx.PokeDB.teamExample('s-mb-m5-291').members);
 assert.strictEqual(model.members[0].set,article[0]);
 function checkAssets(n){if(n.tagName==='IMG'){assert(fs.existsSync(path.join(root,decodeURIComponent(n.src))), 'Missing artwork '+n.src);}for(const child of n.children||[])checkAssets(child);}checkAssets(host);
 const snapshot=JSON.stringify(host);
 assert(snapshot.includes('M-B')&&snapshot.includes('M-5')&&snapshot.includes('291'));
 assert(snapshot.includes('real_battle.html?lang='+lang+'&team-example=s-mb-m5-291'));
 assert(snapshot.includes('party_checker.html?lang='+lang+'&team-example=s-mb-m5-291'));
 assert(!snapshot.includes('online_battle.html'));
 assert(!snapshot.includes('undefined')&&!snapshot.includes('null'));assert(!/\{(?:[pg]\d|[mi]:)/.test(snapshot),'Summary entity references must resolve');
 assert(!snapshot.includes('images/sim/'),'Original artwork must not be rendered');
 assert(snapshot.includes(ja.teamExamples.unsupportedItem));
 assert(ctx.PokeDB.teamExample('popocco-mc-monthly-september').members[1].ability===null);
 let historical=0;for(const e of ctx.PokeDB.teamExamples()){const legal=ctx.buildTeamExampleModel(e).members.every(m=>m.moves.every(x=>ctx.PokeDB.learnset(m.pokemon.name).includes(x.name)));if(!legal){historical++;assert.equal(e.current_rule_compatibility.status,'historical_only_requires_moveset_change');const card=host.children.find(n=>n.id===e.slug),text=JSON.stringify(card);assert(text.includes(ja.teamExamples.historicalRestricted));assert(!text.includes('&team-example='+e.slug));}}assert.equal(historical,3);
 const first=host.children[0],details=first.children.find(n=>n.tagName==='DETAILS'),strip=first.children.find(n=>n.tagName==='NAV');assert(!details.open);strip.children[0].onclick();assert(details.open);
 const format=controls.children[0].children[0];format.value='double';format.onchange();assert.equal(host.children.length,10);assert(host.children.every(n=>!JSON.stringify(n).includes('real_battle.html')));format.value='';format.onchange();
 const search=controls.children[3].children[0];search.value='no-such-author-or-pokemon-xyz';search.oninput();assert.equal(host.children.length,1);assert(JSON.stringify(host).includes(ja.teamExamples.empty));search.value='';search.oninput();assert.equal(host.children.length,30);
 return {article,model};
}
(async()=>{
 assert.deepEqual(read('reference/_team_examples.json').items,master.team_examples.items);
 const before=await run(master),changed=structuredClone(master);
 changed.team_examples.items[0].members[0].points=[3,0,0,31,0,32];
 const temp=fs.mkdtempSync(path.join(require('os').tmpdir(),'pcham-catalogue-test-'));
 try{
  fs.mkdirSync(path.join(temp,'master'));fs.mkdirSync(path.join(temp,'reference'));
  for(const k of files.filter(k=>k!=='team_examples'))fs.writeFileSync(path.join(temp,'master',k+'.json'),JSON.stringify(changed[k]));
  const source=read('reference/_team_examples.json');source.items[0].members[0].points=changed.team_examples.items[0].members[0].points;
  fs.writeFileSync(path.join(temp,'reference/_team_examples.json'),JSON.stringify(source));
  require('./_team_examples_catalogue').build(temp);
  changed.team_examples=JSON.parse(fs.readFileSync(path.join(temp,'master/team_examples.json'),'utf8'));
  source.items[0].members[0].pokemon='missing-id';fs.writeFileSync(path.join(temp,'reference/_team_examples.json'),JSON.stringify(source));
  assert.throws(()=>require('./_team_examples_catalogue').build(temp),/Invalid Pokemon/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 const after=await run(changed);
 assert.equal(before.article[0].points[0],2);assert.equal(after.article[0].points[0],3);assert.equal(after.model.members[0].set.points[0],3);
 const ja=read('i18n/ui-ja.json').teamExamples;
 for(const lang of ['ja','en','fr','de','es','it','ko','zh-Hans','zh-Hant']){
  await run(master,lang);
  const ui=read('i18n/ui-'+lang+'.json');
  const html=fs.readFileSync(path.join(root,'team_examples.html'),'utf8');
  for(const match of html.matchAll(/data-i18n="([^"]+)"/g))assert(match[1].split('.').reduce((o,k)=>o&&o[k],ui),'Missing UI key: '+lang+'/'+match[1]);
  const d=ui.teamExamples;assert.deepEqual(Object.keys(d).sort(),Object.keys(ja).sort());assert(Object.values(d).every(s=>typeof s==='string'&&s.length));
 }
 assert(!/fetch\(['"]master|pokechan_data|items_database/.test(fs.readFileSync(path.join(root,'team_examples.js'),'utf8')));
 console.log('PASS: canonical input/master equality; actual PokeDB loader; both consumers share references; upstream point change reaches both; 180 members across 30 source teams; filters/search/collapsed details; three historic moveset restrictions; explicit unknown ability and unsupported item; result/source/history/link rendering; nine UI dictionaries. Layout not tested.');
})().catch(e=>{console.error(e);process.exitCode=1;});
