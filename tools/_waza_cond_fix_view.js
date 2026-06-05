/* condition の「現表示 → 修正候補表示」+ ヤックン説明 を1画面に並べる確認用HTML。
 * 揃える前提: 同概念の type をグループ化し、改良 condStr2 で日本語フル表示。
 * 実行: node tools/_waza_cond_fix_view.js  → review/waza_cond_fix.html */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const rows=require(path.join(ROOT,'review','_cond_survey.json'));

// ---- 現行 condStr (proto_done.js から) ----
const CONDT={weather_in:'天候',weather:'天候',ability:'特性',ability_in:'特性',holds_item:'道具',target_used_move:'相手の直前技',user_type:'自分が',user_not_type:'自分が非',target_type:'相手が',target_type_in:'相手が',grounded:'接地時',user_took_damage_this_turn:'被弾後',ability_plus_or_minus:'特性プラス/マイナス'};
function condStrOld(c){if(typeof c!=='object'||!c)return String(c);const val=c.value||(c.values&&c.values.join('・'))||'';const label=CONDT[c.type]||c.type;return val?label+':'+val:label;}

// ---- 修正候補: 概念グループ + 日本語フル表示 ----
// グループ: 同概念の type をまとめる(スキーマ統一の指針も兼ねる)
const GROUP={
  // 場/フィールド
  field:'場・フィールド',field_is:'場・フィールド',field_state:'場・フィールド',field_active:'場・フィールド',terrain:'場・フィールド',
  // 天気
  weather:'天気',weather_in:'天気',
  // 接地
  grounded:'接地',user_grounded:'接地',target_grounded:'接地',
  // 特性
  ability:'特性',ability_in:'特性',
  // タイプ(自分)
  user_type:'タイプ',user_is_type:'タイプ',user_not_type:'タイプ',type_in:'タイプ',not_type_in:'タイプ',
  // タイプ(相手/味方)
  target_type_in:'タイプ',target_type_not_in:'タイプ',ally_type:'タイプ',ally_type_not:'タイプ',
  // 状態異常
  target_has_status:'状態異常',target_has_status_condition:'状態異常',target_status_in:'状態異常',user_status_in:'状態異常',
  // 道具
  holds_item:'道具',holding_item:'道具',target_holding_item:'道具',user_has_no_held_item:'道具',target_holds_battle_effect_berry:'道具',
  // 相手の技
  target_used:'相手の技',target_used_move:'相手の技',target_used_minimize:'相手の技',target_minimized:'相手の技',
  // 行動順・このターン
  user_moves_after_target:'行動順',target_already_damaged_this_turn:'このターン',user_took_damage_this_turn:'このターン',
  target_stat_rose_this_turn:'このターン',target_stat_raised_this_turn:'このターン',user_stat_lowered_this_turn:'このターン',
  not_first_round_user_this_turn:'このターン',
  // 前ターン失敗
  previous_turn_move_failed_or_could_not_act:'前ターン失敗',failed_to_act_last_turn:'前ターン失敗',
  // 接触技を受けた
  contact_move:'接触で被弾',hit_by_contact_move_while_protecting:'接触で被弾',hit_by_contact_move_before_activation:'接触で被弾',
  // その他
  opposite_gender:'性別',stockpile_count:'たくわえ数',any_of:'複合',all:'複合',
  target_knocked_out_by_this_move:'撃破時',used_before_target_moves:'先制使用',target_is_ally:'味方対象',
  user_species:'すがた',user_species_form:'すがた',
};
// type → 日本語ラベル(値なし語尾は『の時』前提で組む)
const L={
  ability:c=>`特性が『${c.value}』の時`,
  ability_in:c=>`特性が『${(c.values||[]).join('』『')}』の時`,
  field:c=>`場が『${c.value}』の時`,
  field_is:c=>`場が『${c.value}』の時`,
  field_state:c=>`場が『${c.value}』状態の時`,
  field_active:c=>`場がフィールドの時`,
  terrain:c=>`場が『${c.value}』の時`,
  weather:c=>`天気が${c.value==='なし(通常)'?'ふつう':`『${c.value}』`}の時`,
  weather_in:c=>`天気が『${(c.values||[]).join('』『')}』の時`,
  grounded:c=>`地面にいる時`,
  user_grounded:c=>`自分が地面にいる時`,
  target_grounded:c=>`相手が地面にいる時`,
  user_type:c=>`自分が『${c.value}』タイプの時`,
  user_is_type:c=>`自分が『${(c.values||[c.value]).join('』『')}』タイプの時`,
  user_not_type:c=>`自分が『${c.value}』タイプでない時`,
  type_in:c=>`『${(c.values||[]).join('』『')}』タイプの時`,
  not_type_in:c=>`『${(c.values||[]).join('』『')}』タイプでない時`,
  target_type_in:c=>`相手が『${(c.values||[]).join('』『')}』タイプの時`,
  target_type_not_in:c=>`相手が『${(c.values||[]).join('』『')}』タイプでない時`,
  ally_type:c=>`味方が『${(c.values||[]).join('』『')}』タイプの時`,
  ally_type_not:c=>`味方が『${(c.values||[]).join('』『')}』タイプでない時`,
  target_has_status:c=>`相手が『${c.value}』状態の時`,
  target_has_status_condition:c=>`相手が状態異常の時`,
  target_status_in:c=>`相手が『${(c.values||[]).join('』『')}』状態の時`,
  user_status_in:c=>`自分が『${(c.values||[]).join('』『')}』状態の時`,
  holds_item:c=>`『${c.value}』を持っている時`,
  holding_item:c=>`『${c.value}』を持っている時`,
  target_holding_item:c=>`相手が道具を持っている時`,
  user_has_no_held_item:c=>`自分が道具を持っていない時`,
  target_holds_battle_effect_berry:c=>`相手がバトルで効果のある『きのみ』を持っている時`,
  target_used:c=>`相手が『${c.value}』を使っている時`,
  target_used_move:c=>`相手が『${c.value}』を使っている時`,
  target_used_minimize:c=>`相手が『ちいさくなる』を使っている時`,
  target_minimized:c=>`相手が『ちいさくなる』を使っている時`,
  user_moves_after_target:c=>`自分が後攻の時`,
  target_already_damaged_this_turn:c=>`相手がそのターンすでにダメージを受けている時`,
  user_took_damage_this_turn:c=>`そのターン自分が攻撃のダメージを受けた時`,
  target_stat_rose_this_turn:c=>`そのターンに相手の能力ランクが上がった時`,
  target_stat_raised_this_turn:c=>`そのターンに相手の能力ランクが上がった時`,
  user_stat_lowered_this_turn:c=>`そのターンに自分の能力ランクが下げられた時`,
  not_first_round_user_this_turn:c=>`同じターンで自分より先に同じ技が使われた時`,
  previous_turn_move_failed_or_could_not_act:c=>`前のターンで技が外れた・失敗した・行動できなかった時`,
  failed_to_act_last_turn:c=>`前のターンで技が外れた・失敗した・行動できなかった時`,
  contact_move:c=>`接触技(直接攻撃)で攻撃された時`,
  hit_by_contact_move_while_protecting:c=>`守っている間に接触技で攻撃された時`,
  hit_by_contact_move_before_activation:c=>`技が出る前に接触技で攻撃された時`,
  opposite_gender:c=>`相手が自分と違う性別の時`,
  stockpile_count:c=>`『たくわえる』を使った数が${c.value}つの時`,
  target_knocked_out_by_this_move:c=>`この技で相手を倒した時`,
  used_before_target_moves:c=>`相手が技を出す前に使った時`,
  target_is_ally:c=>`味方に使った時`,
  user_species:c=>`自分が『${c.value}』の時`,
  user_species_form:c=>`自分が『${c.value}』の時`,
};
// ネストの文字列トークン
const TOK={user_is_flying_type:'自分がひこうタイプ','user_ability_ふゆう':'特性ふゆう'};
function exClause(c){
  const ex=c.grounded_exceptions||c.excludes_types||c.not_negated_by;
  const ab=c.excludes_abilities;
  let parts=[];
  if(ex) parts.push(...ex.map(x=>/タイプ$/.test(x)?x:(TOK[x]||x)));
  if(ab) parts.push(...ab.map(x=>'特性'+x));
  // grounded_exceptions は ["ひこうタイプ","ふゆう"] の形が多い
  if(parts.length) return `(${parts.join('・')}は除く)`;
  return '';
}
function condStrNew(c){
  if(typeof c!=='object'||!c) return String(c);
  if(c.type==='any_of'){
    const vs=(c.values||[]).map(v=> typeof v==='object'?condStrNew(v):(TOK[v]||v));
    return `次のどれかの時: ${vs.join(' または ')}`;
  }
  if(c.type==='all'){
    const vs=(c.values||[]).map(v=> typeof v==='object'?condStrNew(v):(TOK[v]||v));
    return vs.join(' かつ ');
  }
  const f=L[c.type];
  let s = f? f(c) : `【未対応:${c.type}】`;
  const ex=exClause(c);
  if(ex) s = s.replace(/の時$/, ex+'の時');
  if(c.and==='user_grounded') s += `／自分が地面にいる時`;
  if(c.needs_research || c.complete===false) s += ` ⚠️要調査`;
  return s;
}

// ---- 行を整形 ----
const out=rows.map(r=>{
  const old=condStrOld(r.cond), neu=condStrNew(r.cond);
  const changed = old!==neu;
  const raw = !(r.cond.type in CONDT) && !L[r.cond.type] ? false : !(r.cond.type in CONDT); // 旧で英語漏れ
  const grp = GROUP[r.cond.type]||'(未分類)';
  const todo = !L[r.cond.type] && r.cond.type!=='all' && r.cond.type!=='any_of';
  return {...r, old, neu, changed, grp, todo};
});
// グループ順
const grpOrder=['場・フィールド','接地','天気','タイプ','状態異常','道具','相手の技','このターン','行動順','前ターン失敗','接触で被弾','複合','たくわえ数','性別','撃破時','先制使用','味方対象','すがた','その他','(未分類)'];
out.sort((a,b)=>{const ga=grpOrder.indexOf(a.grp),gb=grpOrder.indexOf(b.grp);return (ga<0?99:ga)-(gb<0?99:gb)|| a.name.localeCompare(b.name,'ja');});

const esc=s=>String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
function descSnippet(key){
  // 説明全文(survey に無いので map から再取得は省略、cond周辺は survey に無いため簡易)
  return '';
}
// 説明文を map から取る
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const map=JSON.parse(lit(fs.readFileSync(path.join(ROOT,'pokechan_data.js'),'utf8'),'const WAZA_MAP ='));
const desc=k=>{const m=map[k];return m?(m.description_legacy||m.description||''):'';};

const nTypes=new Set(rows.map(r=>r.cond.type)).size;
const nGroups=new Set(out.map(r=>r.grp)).size;
let html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>condition 修正候補(プロト形式)</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:12px}
 header{padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d;position:sticky;top:0;z-index:6}
 h1{font-size:15px;margin:0} .sub{font-size:11px;color:#9aa7b4;margin-top:3px;line-height:1.6}
 table{border-collapse:collapse;width:100%} thead th{position:sticky;top:64px;background:#21262d;color:#9aa7b4;font-size:11px;padding:6px 7px;border-bottom:2px solid #30363d;text-align:left;white-space:nowrap}
 td{padding:6px 7px;border-bottom:1px solid #1c2128;vertical-align:top}
 tr.sec td{background:#1d2330;color:#d2a8ff;font-weight:700;font-size:13px;position:sticky;top:93px;border-bottom:2px solid #a371f7;z-index:2}
 tr.sec .gc{color:#8b949e;font-weight:400;font-size:11px;margin-left:6px}
 .c-nm{font-weight:700;min-width:104px} .c-nm b{color:#e6edf3}
 .kind{color:#9aa7b4;font-size:11px;white-space:nowrap}
 .type{color:#6e7681;font-family:ui-monospace,SFMono-Regular,monospace;font-size:10.5px;min-width:150px}
 .type .tn{color:#e3b341} .raw{color:#ff7b72}
 .old{color:#ff9a92;font-family:ui-monospace,monospace;font-size:11px;min-width:180px;line-height:1.5}
 .new{min-width:230px;line-height:1.6} .new .if{font-size:10px;border-radius:3px;padding:0 5px;font-weight:700;background:#16263b;color:#79c0ff;margin-right:4px} .new b{color:#7ee787;font-size:12.5px}
 .new .ex{color:#f0b86e} .new .grd{color:#79c0ff} .rs{background:#3a2a16;color:#e3b341;font-size:10px;border-radius:3px;padding:0 5px;font-weight:700}
 .c-desc{min-width:260px;max-width:380px;color:#9aa7b4;font-size:11px;line-height:1.55}
 tbody tr:hover td{background:#161b22}
 .changed .new{background:#10220f;border-radius:4px}
 .sum b{color:#e6edf3} .sum code{background:#21262d;border:1px solid #30363d;border-radius:3px;padding:0 4px;color:#ff9a92;font-size:10.5px}
 .legend{font-size:11px;color:#9aa7b4}
</style></head><body>
<header><h1>🧩 condition 表示の修正候補 — 揃える前提・全${out.length}件(プロト形式)</h1>
<div class="sub legend">
 <b style="color:#ff9a92">赤=現在の表示</b>(condStr) → <b style="color:#7ee787">緑=修正候補</b>(改良版). 緑がヤックン説明に戻れるか確認.
 / 発見: <b style="color:#e3b341">type ${nTypes}種が乱立</b> → ${nGroups}概念に集約(見出し=統一単位).
 壊れた主因 ① <code>and</code>/<code>grounded_exceptions</code>/<code>excludes_*</code> を捨て節が消失 ② 辞書に無い type が生英語で露出.
</div></header>
<table><thead><tr>
 <th>わざ名</th><th>kind</th><th>type / 生データ</th><th>🔴 現在の表示</th><th>🟢 修正候補</th><th>説明(ポケモン徹底攻略)</th>
</tr></thead><tbody>`;

// 修正候補テキストを軽くハイライト(除外注記・地面・要調査)
function decorate(s){
  return esc(s)
    .replace(/(（[^）]*は除く）|\([^)]*は除く\))/g,'<span class="ex">$1</span>')
    .replace(/(自分が地面にいる時|地面にいる時|相手が地面にいる時)/g,'<span class="grd">$1</span>')
    .replace(/⚠️要調査/g,'<span class="rs">🔍要調査</span>');
}
let cur='';
for(const r of out){
  if(r.grp!==cur){ cur=r.grp;
    const types=[...new Set(out.filter(x=>x.grp===cur).map(x=>x.cond.type))];
    html+=`<tr class="sec"><td colspan="6">${esc(cur)}<span class="gc">統一候補 type: ${esc(types.join(' / '))}</span></td></tr>`; }
  const rawType = !(r.cond.type in CONDT);
  html+=`<tr class="${r.changed?'changed':''}">
   <td class="c-nm"><b>${esc(r.name)}</b></td>
   <td class="kind">${esc(r.kind)}</td>
   <td class="type"><span class="tn ${rawType?'raw':''}">${esc(r.cond.type)}</span><br>${esc(JSON.stringify(r.cond)).replace(/,/g,', ')}</td>
   <td class="old">IF:${esc(r.old)}</td>
   <td class="new"><span class="if">IF</span><b>${decorate(r.neu)}</b></td>
   <td class="c-desc">${esc(desc(r.key)).slice(0,150)}</td>
  </tr>`;
}
html+='</tbody></table></body></html>';
fs.writeFileSync(path.join(ROOT,'review','waza_cond_fix.html'),html);
console.log('生成: review/waza_cond_fix.html /', out.length,'件 / 変更あり', out.filter(r=>r.changed).length,'件 / 未設計', out.filter(r=>r.todo).length,'件');
