/* 表示noteごとに、それが乗るeffectのkind・兄弟effectのkind一覧・関連フィールドを吸い出す(仕分け用) */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(path.join(ROOT,'pokechan_data.js'),'utf8'),'const WAZA_MAP ='));
const M=require(path.join(ROOT,'review','_note_ja_map.js'));  // EN->{ja,drop}
const isEn=s=>/[A-Za-z]{3,}/.test(s);
const out=[];
for(const [k,m] of Object.entries(map)){
  const bd=m.battle_data; if(!bd||!bd.effects)continue;
  const allKinds=bd.effects.map(e=>e.kind);
  bd.effects.forEach(e=>{
    for(const nk of ['note','doubles_note']){
      if(e[nk]&&isEn(e[nk])){
        out.push({move:m.name, en:e[nk], ja:(M[e[nk]]&&M[e[nk]].ja)||'?', drop:!!(M[e[nk]]&&M[e[nk]].drop),
          hostKind:e.kind, hostCond:e.condition?(e.condition.value||e.condition.type):null,
          crit_stage:e.crit_stage, multiplier:e.multiplier, ignores_accuracy:e.ignores_accuracy,
          allKinds});
      }
    }
  });
}
out.forEach((o,i)=>{
  console.log(`${i+1}. 【${o.move}】 host kind=「${o.hostKind}」${o.hostCond?' cond='+o.hostCond:''}${o.crit_stage?' crit_stage='+o.crit_stage:''}${o.multiplier?' mult='+o.multiplier:''}${o.ignores_accuracy?' ign_acc':''}`);
  console.log(`   全kind: ${o.allKinds.join(' / ')}`);
  console.log(`   note訳: ${o.ja}${o.drop?'  [drop]':''}`);
});
fs.writeFileSync(path.join(ROOT,'review','_note_ctx.json'),JSON.stringify(out,null,1));
console.log('\n計',out.length,'件 → review/_note_ctx.json');
