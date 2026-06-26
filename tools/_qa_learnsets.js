// learnsets_master.json の整合QA(read-only)。合格条件=欠落0・未知技0。
// 実行: node tools/_qa_learnsets.js
const fs=require('fs');
const P=require('../reference/pokeapi_master.json');
const M=require('../reference/moves_master.json');
const L=require('../reference/learnsets_master.json');
const pSlugs=new Set(P.map(v=>v.slug));
const lSlugs=new Set(Object.keys(L));
const moveSlugs=new Set(M.map(m=>m.slug));
let fail=0;
// 1) learnsetキー集合 == pokeapi_master slug集合
const missingInL=[...pSlugs].filter(s=>!lSlugs.has(s));
const extraInL=[...lSlugs].filter(s=>!pSlugs.has(s));
console.log('① variety欠落(masterにあるがlearnset無):',missingInL.length, missingInL.slice(0,10));
console.log('① 余剰(learnsetにあるがmaster無):',extraInL.length, extraInL.slice(0,10));
if(missingInL.length||extraInL.length)fail++;
// 2) 全 move slug が moves_master に存在
const unknown=new Set();
for(const s of lSlugs)for(const mv of L[s])if(!moveSlugs.has(mv))unknown.add(mv);
console.log('② 未知技slug(moves_masterに無):',unknown.size,[...unknown].slice(0,10));
if(unknown.size)fail++;
// 3) learnset 0件の内訳(gmax等は許容)
const zero=[...lSlugs].filter(s=>!L[s].length);
const zeroNonGmax=zero.filter(s=>!/-gmax$/.test(s));
console.log('③ learnset 0件:',zero.length,'(うちgmax以外=要調査:',zeroNonGmax.length,')',zeroNonGmax.slice(0,15));
if(zeroNonGmax.length)fail++;
console.log(fail?('\n❌ QA FAIL ('+fail+'項目)'):'\n✅ QA PASS (欠落0・未知技0・0件はgmaxのみ)');
process.exit(fail?1:0);
