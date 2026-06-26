// pokechan_data_all.js の整合QA(read-only)。合格条件=件数/resist値域/転置整合/孤児名0。
// 実行: node tools/_qa_pokechan_all.js
const D=require('../pokechan_data_all.js');
let fail=0; const bad=(m)=>{console.log('❌ '+m);fail++;};
// 1) 件数
const NP=D.POKEMON_LIST.length;
if(NP<1200||NP>1302)bad('POKEMON_LIST 想定外 ('+NP+')'); else console.log('⓪ POKEMON_LIST='+NP+'(見た目フォーム間引き後)');
if(Object.keys(D.WAZA_MAP).length!==937)bad('WAZA_MAP!=937');
if(Object.keys(D.POKEMON_WAZA).length!==NP)bad('POKEMON_WAZA!=POKEMON_LIST件数');
// 2) resist
const ok=new Set([0,0.25,0.5,1,2,4]);
let rbad=0; for(const p of D.POKEMON_LIST){ if(!Array.isArray(p.resist)||p.resist.length!==18){rbad++;continue;} for(const v of p.resist)if(!ok.has(v))rbad++; }
if(rbad)bad('resist不正 '+rbad+'件'); else console.log('① resist 全1302×18 値域OK');
// 3) name一意
const names=D.POKEMON_LIST.map(p=>p.name); const dup=names.length-new Set(names).size;
if(dup)bad('name重複 '+dup+'件'); else console.log('② POKEMON_LIST.name 一意OK');
// 4) 孤児名: learners の全JA名が POKEMON_LIST.name に存在
const nameSet=new Set(names); let orphan=new Set();
for(const k in D.WAZA_MAP)for(const ln of D.WAZA_MAP[k].learners)if(!nameSet.has(ln))orphan.add(ln);
if(orphan.size)bad('learners孤児名 '+orphan.size+' 例:'+[...orphan].slice(0,5)); else console.log('③ learners孤児名0(全てPOKEMON_LISTに存在)');
// 5) 転置整合: サンプル150技で learners[k] ⇔ POKEMON_WAZA[name].includes(k)
const keys=Object.keys(D.WAZA_MAP); let tbad=0,checked=0;
for(let i=0;i<keys.length;i+=Math.ceil(keys.length/150)){ const k=keys[i];
  for(const ln of D.WAZA_MAP[k].learners){ checked++; if(!(D.POKEMON_WAZA[ln]||[]).includes(k))tbad++; } }
if(tbad)bad('転置不整合(learners→POKEMON_WAZA) '+tbad+'/'+checked); else console.log('④ 転置整合(learners→POKEMON_WAZA) OK ('+checked+'件照合)');
// 逆方向サンプル: 100ポケの POKEMON_WAZA[name] ⊂ WAZA_MAP keys
let kbad=0; const wkeys=new Set(keys); const pnames=Object.keys(D.POKEMON_WAZA);
for(let i=0;i<pnames.length;i+=Math.ceil(pnames.length/100)){ for(const mk of D.POKEMON_WAZA[pnames[i]])if(!wkeys.has(mk))kbad++; }
if(kbad)bad('POKEMON_WAZAに未知move key '+kbad); else console.log('⑤ POKEMON_WAZA→WAZA_MAP key OK');
console.log(fail?('\n❌ QA FAIL ('+fail+')'):'\n✅ QA PASS');
process.exit(fail?1:0);
