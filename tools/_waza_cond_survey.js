/* condition を持つ全effectを走査し、type/keys/現condStr出力を集計 */
const fs=require('fs'),path=require('path');
const FILE=path.resolve(__dirname,'..','pokechan_data.js');
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(FILE,'utf8'),'const WAZA_MAP ='));
// 現行 condStr (proto_done.js のコピー)
const CONDT={weather_in:'天候',weather:'天候',ability:'特性',ability_in:'特性',holds_item:'道具',target_used_move:'相手の直前技',user_type:'自分が',user_not_type:'自分が非',target_type:'相手が',target_type_in:'相手が',grounded:'接地時',user_took_damage_this_turn:'被弾後',ability_plus_or_minus:'特性プラス/マイナス'};
function condStr(c){if(typeof c!=='object'||!c)return c;const val=c.value||(c.values&&c.values.join('・'))||'';const label=CONDT[c.type]||c.type;return val?label+':'+val:label;}
const typeCount={}, keyCount={}, rows=[];
for(const [k,m] of Object.entries(map)){
  const eff=(m.battle_data&&m.battle_data.effects)||[];
  eff.forEach((e,ei)=>{
    if(e.condition && typeof e.condition==='object'){
      const c=e.condition;
      typeCount[c.type]=(typeCount[c.type]||0)+1;
      Object.keys(c).forEach(kk=>keyCount[kk]=(keyCount[kk]||0)+1);
      const hasExtra = ('and' in c)||('grounded_exceptions' in c)||('or' in c)||('not' in c);
      const rawType = !(c.type in CONDT); // 英語生漏れ
      rows.push({key:k,name:m.name,ei,kind:e.kind,cond:c,cur:condStr(c),hasExtra,rawType});
    }
  });
}
console.log('=== condition.type 出現数 ===');
console.log(JSON.stringify(typeCount,null,0));
console.log('=== condition のキー出現数 ===');
console.log(JSON.stringify(keyCount,null,0));
console.log('=== 取りこぼし(and/exceptions等)を持つ技数:', rows.filter(r=>r.hasExtra).length);
console.log('=== type辞書に無い(英語漏れ)技数:', rows.filter(r=>r.rawType).length);
console.log('=== 全condition付きeffect数:', rows.length);
fs.writeFileSync(path.resolve(__dirname,'..','review','_cond_survey.json'),JSON.stringify(rows,null,1));
console.log('保存: review/_cond_survey.json');
