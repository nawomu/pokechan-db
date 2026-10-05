'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),Module=require('module');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f)),plain=x=>JSON.parse(JSON.stringify(x));
function getAPI(){const filename=path.join(root,'tools/_sim_engine.js'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;let source=read('tools/_sim_engine.js').replace('return sandbox.__engine;','return sandbox.window.__sim;');if(process.env.PCHAM_TRANSFER_ENGINE_ROOT)source=source.replace("const ROOT = path.resolve(__dirname, '..');",'const ROOT = '+JSON.stringify(path.resolve(process.env.PCHAM_TRANSFER_ENGINE_ROOT))+';');m._compile(source,filename);return m.exports.buildEngine();}
const S=getAPI();const ui=json('i18n/ui-ja.json');
function chunk(s,start,end){return s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)+start.length));}
async function context(){
 const storage=new Map(),nodes=new Map(),events={};const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',style:{},value:'',children:[],append(...c){this.children.push(...c)},replaceChildren(){this.children=[]},setAttribute(){}});return nodes.get(id);};
 const files=['pokemon','moves','abilities','items','natures','learnsets','team_examples','types'];
 const ctx={window:{I18N:null},console,URL,URLSearchParams,location:{href:'https://example.test/party_checker.html',search:''},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},history:{replaceState(a,b,u){ctx.location.href=u;ctx.location.search=new URL(u).search;}},fetch:async url=>({ok:true,json:async()=>json('master/'+url.match(/([^/]+)\.json$/)[1]+'.json')}),document:{body:null,currentScript:{src:'https://example.test/pokedb.js',getAttribute:()=>files.join(',')},getElementsByTagName:()=>[],getElementById:node,createElement:()=>node('new'+nodes.size),addEventListener:(e,fn)=>events[e]=fn,querySelectorAll:()=>[]},S};
 const i18n={lang:'ja',t:k=>k.split('.').reduce((o,k)=>o&&o[k],ui)||k,item:n=>n,pokemon:n=>n};ctx.window.I18N=ctx.I18N=i18n;vm.createContext(ctx);vm.runInContext(read('pokedb.js'),ctx);ctx.PokeDB=ctx.window.PokeDB;await ctx.PokeDB.ready;vm.runInContext(read('team_example_transfer.js'),ctx);ctx.TeamExampleTransfer=ctx.window.TeamExampleTransfer;return {ctx,storage,events,node};
}
function jsonFromStorage(x){return JSON.parse(x);}
function query(ctx,id){ctx.location.href='https://example.test/party_checker.html?lang=en'+(id?'&team-example='+id:'');ctx.location.search=new URL(ctx.location.href).search;}
(async()=>{
 const {ctx,storage,events}=await context(),T=ctx.TeamExampleTransfer,allIds=ctx.PokeDB.teamExamples().map(x=>x.slug),historical=allIds.filter(id=>{try{T.resolve(id);return false;}catch(e){assert.match(e.message,/historicalRestricted/);return true;}}),ids=allIds.filter(id=>!historical.includes(id)),singles=ids.filter(id=>T.resolve(id).example.format==='single'),doubles=ids.filter(id=>T.resolve(id).example.format==='double');
 assert.equal(allIds.length,json('reference/_team_examples.json').items.length);assert.equal(historical.length,3);assert.equal(doubles.length,ctx.PokeDB.teamExamples().filter(e=>e.format==='double').length);
 assert(!storage.size);events['i18n:ready']();assert(!storage.size);
 assert.throws(()=>T.resolve('invalid'),/invalid/);
 const pc=read('party_checker.html');
 const waitCode=pc.slice(pc.indexOf('await new Promise(resolve => {'),pc.indexOf('// 旧版(pokechan_data.js)',pc.indexOf('await new Promise(resolve => {')));
 assert(waitCode.includes('onReady'),'Initialization must wait for the existing translation runtime');
 for(const order of ['runtime-first','data-first']){
  let callback,completed=false;const c={window:{},document:{addEventListener(e,fn){assert.equal(e,'i18n:ready');callback=fn;}}};
  if(order==='runtime-first')c.window.I18N={onReady(fn){callback=fn;}};
  vm.createContext(c);const waiting=vm.runInContext('(async()=>{'+waitCode+'})()',c).then(()=>{completed=true;});
  await Promise.resolve();assert(!completed,'Do not initialize while dictionary loading');callback();await waiting;assert(completed);
 }
 ctx.renderTable=()=>{};ctx.renderPcTabs=()=>{};ctx._tCK=(key,fallback)=>fallback;
 vm.runInContext(`const PARTY_SIZE=24,LS_PARTY='pokechan_party_v3',LS_ORDER='order',LS_SLOT_FILTERS='filters',LS_STAT_VIS='stats',LS_PARTY_ITEMS='pokechan_party_items_v1',LS_PARTY_GENDERS='pokechan_party_genders_v1',LS_PC_TABS='tabs';const TYPES=['a'],DEFAULT_TYPE_ORDER=['a'],STAT_VIS_DEFAULT={base:true};let party=Array(24).fill(null),partyItems=Array(24).fill(''),partyGenders=Array(24).fill(''),partyAbilities=Array(24).fill(null),partyExampleId=null,partyNatures=Array(24).fill('まじめ'),partyEvs=Array.from({length:24},()=>({hp:0,atk:0,def:0,spatk:0,spdef:0,spd:0})),slotFilters={},typeOrder=['a'],statVis={base:true},activeSlot=0,pcTabs=[],pcActiveId=1,pcNextId=2;const POKE_MAP={};party[0]='ピカチュウ';partyItems[0]='light_ball';partyGenders[0]='♀';partyAbilities[0]='せいでんき';partyEvs[0].spd=12;`,ctx);
 vm.runInContext(chunk(pc,'function captureCurrentPcState()','function loadPcTabs()')+chunk(pc,'function loadPcTabs()','// Catalogue transfer')+chunk(pc,'function importTeamExampleToBuilder()','function renderPcTabs()'),ctx);
 const genderAt=pc.indexOf('data-i18n="checker.row_gender"'),genderCode=pc.slice(pc.lastIndexOf('rows.push(',genderAt),pc.indexOf('// 持ち物 (',genderAt));
 vm.runInContext('function actualGenderRow(){const rows=[];'+genderCode+'return rows[0];}',ctx);
 vm.runInContext(chunk(pc,'function switchPcTab(id)', 'function addPcTab()'),ctx);
 vm.runInContext('loadPcTabs();',ctx);const original=plain(vm.runInContext('captureCurrentPcState()',ctx));
 // The actual unknown-field rows must also render when the runtime has not executed yet.
 const abilityAt=pc.indexOf('data-i18n="checker.row_ability"'),abilityCode=pc.slice(pc.lastIndexOf('rows.push(',abilityAt),pc.indexOf('// タイプ相性',abilityAt));
 vm.runInContext('const ABILITY_DESC={};function dragAttrs(){return "";}function actualAbilityRow(){const rows=[];'+abilityCode+'return rows[0];}',ctx);
 query(ctx,'popocco-mc-monthly-september');assert(ctx.importTeamExampleToBuilder());
 vm.runInContext('party.forEach(n=>{if(n)POKE_MAP[n]=S.pokeByName(n);});',ctx);
 const savedI18n=ctx.I18N;ctx.window.I18N=null;delete ctx.I18N;
 assert.doesNotThrow(()=>vm.runInContext('actualGenderRow();actualAbilityRow();',ctx));
 assert(vm.runInContext('actualAbilityRow()',ctx).includes('出典で特性が未確認'));
 ctx.I18N=ctx.window.I18N=savedI18n;
 // Reset test fixture only, never production browser storage.
 storage.clear();vm.runInContext("pcTabs=[];pcActiveId=1;pcNextId=2;applyPcState("+JSON.stringify(original)+");loadPcTabs();",ctx);

 for(const id of ids){query(ctx,id);assert(ctx.importTeamExampleToBuilder());const m=T.resolve(id),state=plain(vm.runInContext('captureCurrentPcState()',ctx));assert.equal(state.partyExampleId,id);m.members.forEach((s,i)=>{assert.equal(state.party[i],s.pokemon.name);assert.deepEqual(state.slotFilters[i]._all,s.moves.map(m=>m.slug));assert.equal(state.partyAbilities[i],s.ability?s.ability.name:null);assert.equal(state.partyItems[i],s.item.slug);assert.equal(state.partyNatures[i],s.nature.name);assert.deepEqual(state.partyEvs[i],plain(s.effort));assert.equal(state.partyGenders[i],s.gender);});const genders=plain(vm.runInContext('partyGenders',ctx));vm.runInContext('actualGenderRow()',ctx);assert.deepEqual(plain(vm.runInContext('partyGenders',ctx)),genders,'Rendering must not randomize unknown source genders');assert(!T.incomingId());assert(!ctx.importTeamExampleToBuilder());}
 assert.deepEqual(plain(vm.runInContext('pcTabs[0].state',ctx)),original);
 vm.runInContext('partyEvs[0].hp=17;savePcTabs();',ctx);query(ctx,ids[0]);assert(ctx.importTeamExampleToBuilder());assert.equal(vm.runInContext('pcTabs['+ids.length+'].state.partyEvs[0].hp',ctx),17);vm.runInContext('switchPcTab(1);',ctx);assert.deepEqual(plain(vm.runInContext('captureCurrentPcState()',ctx)),original);
 const stored=jsonFromStorage(storage.get('tabs'));vm.runInContext('loadPcTabs();',ctx);assert.deepEqual(plain(vm.runInContext('captureCurrentPcState()',ctx)),stored.tabs.find(t=>t.id===stored.activeId).state);
 const before=plain(vm.runInContext('pcTabs',ctx));query(ctx,'invalid');assert(!ctx.importTeamExampleToBuilder());assert.deepEqual(plain(vm.runInContext('pcTabs',ctx)),before);
 for(const id of historical){query(ctx,id);const before=plain(vm.runInContext('pcTabs',ctx));assert(!ctx.importTeamExampleToBuilder());assert.deepEqual(plain(vm.runInContext('pcTabs',ctx)),before);}
 // Reuse the actual engine API, and the real page's import/save/start-gate/side construction functions.
 const rb=read('real_battle.html');ctx.$=id=>ctx.document.getElementById(id);ctx.renderTeamRows=()=>{};ctx.slotCapsuleHtml=()=>'';ctx.setSelectedSlot=()=>{};ctx.window.__randomizeOpp=()=>{};ctx.defaultAbilityRB=p=>p.ab1;ctx.autoMoves=p=>S.usableMoves(p).slice(0,4);ctx.clampEffortRB=x=>x;
 vm.runInContext(`let rbExamplePreview=true,rbExampleLoading=true,rbExampleError=false,teamSize=3;const slotVal={},slotItem={},slotAbility={},slotGender={},slotNature={},slotEffort={},slotMoves={},leadSlot={self:'s1',opp:'o1'};const selfIds=()=>Array.from({length:teamSize},(_,i)=>'s'+(i+1));`,ctx);
 vm.runInContext(chunk(rb,'function normMegaKeyRB(', 'function clearUnimplementedItemRB(')+chunk(rb,'function saveTeam(){','function loadTeam(){')+chunk(rb,'async function importTeamExampleToBattle()','function startBattle(){')+chunk(rb,'function buildSide(sideKey, ids){','// Validate the whole source'),ctx);
 const saved='existing-user-team';storage.set('rb_team',saved);
 for(const id of singles){query(ctx,id);assert(await ctx.importTeamExampleToBattle());const m=T.resolve(id);assert.equal(vm.runInContext('teamSize',ctx),6);const actual=plain(vm.runInContext('selfIds().map(id=>({name:slotVal[id],ability:slotAbility[id],item:slotItem[id],nature:slotNature[id],gender:slotGender[id],effort:slotEffort[id],moves:slotMoves[id].map(m=>m.name)}))',ctx));m.members.forEach((s,i)=>{assert.equal(actual[i].name,s.pokemon.name);assert.equal(actual[i].ability,s.ability?s.ability.name:null);assert.equal(actual[i].item,s.item.slug);assert.equal(actual[i].nature,s.nature.name);assert.equal(actual[i].gender,s.gender);assert.deepEqual(actual[i].effort,plain(s.effort));assert.deepEqual(actual[i].moves,s.moves.map(m=>m.name));});ctx.saveTeam();assert.equal(storage.get('rb_team'),saved);assert.equal(ctx.teamExampleBattleReady(),T.issues(m.members).length===0);
  if(id===ids[0]){vm.runInContext("selfIds().forEach(id=>{if(!slotGender[id])slotGender[id]='♂';});",ctx);assert(ctx.teamExampleBattleReady());ctx.buildSide('self',vm.runInContext('selfIds()',ctx));assert.equal(S.sides.self.bench.length,5);assert.equal(S.sides.self.ability,m.members[0].ability.name);assert.equal(S.sides.self.bench[0].ability,m.members[1].ability.name);assert.equal(S.sides.self.natureIdx,S.natureIdxOf(m.members[0].nature.name));}
 }
 for(const id of [...historical,...doubles]){query(ctx,id);const before=plain(vm.runInContext('slotVal',ctx));assert(!await ctx.importTeamExampleToBattle());assert.deepEqual(plain(vm.runInContext('slotVal',ctx)),before);assert.equal(storage.get('rb_team'),saved);}
 const abExpression=rb.match(/const curAb = ([^;]+);/)[1];ctx.id='s1';ctx.p=S.pokeByName(vm.runInContext('slotVal.s1',ctx));vm.runInContext('slotAbility.s1=null;',ctx);assert.equal(vm.runInContext(abExpression,ctx),null,'Display must not choose a default ability for preview');
 query(ctx,ids[2]);assert(await ctx.importTeamExampleToBattle());vm.runInContext("slotItem.s5='';",ctx);assert(ctx.teamExampleBattleReady(),'Explicitly choosing no item resolves unsupported-item guard');
 query(ctx,ids[1]);assert(await ctx.importTeamExampleToBattle());vm.runInContext("slotAbility.s2=S.pokeByName(slotVal.s2).ab1;",ctx);assert(ctx.teamExampleBattleReady(),'Explicit ability selection resolves unknown-ability guard');
 query(ctx,'invalid');const prior=plain(vm.runInContext('slotVal',ctx));assert(!await ctx.importTeamExampleToBattle());assert.deepEqual(plain(vm.runInContext('slotVal',ctx)),prior);assert.equal(storage.get('rb_team'),saved);
 vm.runInContext("slotVal.s1=null;slotAbility.s1=null;slotGender.s1='';",ctx);assert(!ctx.teamExampleBattleReady(),'Cleared slot is blocked without an exception');
 vm.runInContext('rbExamplePreview=false;',ctx);assert(ctx.teamExampleBattleReady());ctx.saveTeam();assert.notEqual(storage.get('rb_team'),saved);
 for(const lang of ['ja','en','fr','de','es','it','ko','zh-Hans','zh-Hant']){const d=json('i18n/ui-'+lang+'.json');assert.deepEqual(Object.keys(d.teamTransfer),Object.keys(ui.teamTransfer));assert(Object.values(d.teamTransfer).every(x=>typeof x==='string'&&x));}
 ctx.PokeDB.setMode('champions');for(const id of ids)T.resolve(id);
 console.log('PASS: actual PokeDB/catalogue and real engine API; all catalogue teams; all current-compatible builder imports and single-battle imports, all doubles rejected by singles engine and three historical movesets rejected; all settings, unknown fields retained; existing builder state preserved in new tabs; repeated clicks/consumed reload/invalid ID/switch to another example; six-member engine side with selected abilities/nature; saved battle team unchanged in preview, ordinary save/start gate unchanged; nine dictionaries. Browser rendering not verified.');
})().catch(e=>{console.error(e);process.exitCode=1});
