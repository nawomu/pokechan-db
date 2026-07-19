// @deprecated 2026-07-02 — 後継ビルダーに移行済み。
//   新ビルダー: tools/build_national_view.js (reference/master_*.json 参照版)
//   今後の pokechan_data_all.js 生成は build_national_view.js を使うこと。
//   このファイルはロールバック・参照用に残す(削除しない)。
//
// 全国版(全部版)共通データアダプタ。reference/*.json + learnsets から、pokechan_data.js と同一schemaの
// pokechan_data_all.js を生成。既存ページ(v9/waza-list)は <script src> 差替だけで全1302ポケ・937技で動く。
// 静的テーブルは pokechan_data.js から転記。490curated層(説明文/battle_data/体重)はキー一致分をオーバーレイ。
// 実行: node tools/_build_pokechan_data_all.js → pokechan_data_all.js
const fs=require('fs');
const C=require('../pokechan_data.js');                       // curated(Champions) = 静的テーブル + overlay元
const P=require('../reference/pokeapi_master.json');          // 1302 variety
const MV=require('../reference/moves_master.json');           // 937 moves
const AB=require('../reference/abilities_master.json');       // 367 abilities
const LS=require('../reference/learnsets_master.json');       // learnset(slug→move slug[])
let MJD={}; try{ MJD=require('../reference/moves_ja_desc.json'); }catch(e){} // 445技のJA説明(マザー流・WF生成)
let MTAGS={}; try{ MTAGS=require('../reference/moves_tags.json'); }catch(e){} // 445技の効果分類(WF生成)→battle_dataに変換しタグを出す
let LEGEND={}; try{ LEGEND=require('../reference/legend_status.json'); }catch(e){} // dex→伝説区分(restricted/sub/mythical)
let MYK={}; try{ MYK=require('../reference/moves_yakkun.json'); }catch(e){} // slug→ヤックン(徹底攻略)日本語効果文=新技のlegacy参照
let MFIX={}; try{ MFIX=require('../reference/moves_battle_data_fix.json'); }catch(e){} // ★修正オーバーレイ: slug→正しいbattle_data(effects[])。これが在る技は説明文をcompose生成に一本化(2026-06-27)
let MDESC={}; try{ MDESC=require('../reference/moves_desc_override.json'); }catch(e){} // ★説明文オーバーレイ(最優先): 121kind語彙で表現できない技(穴/空)をヤックン由来の独自マザー流文で埋める(2026-06-28)
let MFLAGS={}; try{ MFLAGS=require('../reference/_move_flags.json'); }catch(e){} // ★技フラグ(音/風/切る/弾/噛み/踊り/パンチ等)=構築WFが付与。composeが「音系の技」等を発声(2026-06-29)
let SD_MOVES={}; try{ SD_MOVES=require('../reference/_showdown/moves.json'); }catch(e){} // ★P8: Showdown moves.json(gen/isNonstandard)
// ★2026-07-19: ABILITY_DESC欠落119件+ヘドロえきの穴埋め(PokeAPI公式ja説明・Champions版は肥大化させない=全部版側でだけマージ)
//   マージ順: Champions ABILITY_DESC(既存キー) > fill(reference/_ability_desc_fill_2026-07-19.json)。既存キーは上書きしない。
let ABILITY_DESC_FILL=null;
try{ ABILITY_DESC_FILL = require('../reference/_ability_desc_fill_2026-07-19.json'); }
catch(e){ console.warn('[warn] reference/_ability_desc_fill_2026-07-19.json が見つからないため、ABILITY_DESCはChampions版のみ(欠落穴埋めなし)。'); }
const ABILITY_DESC = Object.assign({}, C.ABILITY_DESC);
let _abFillMerged = 0;
if(ABILITY_DESC_FILL && Array.isArray(ABILITY_DESC_FILL.entries)){
  ABILITY_DESC_FILL.entries.forEach(e=>{
    if(!e || !e.name_ja || !e.desc_ja) return;
    if(ABILITY_DESC[e.name_ja] != null) return; // Championsの独自説明を常に優先(上書きしない)
    ABILITY_DESC[e.name_ja] = e.desc_ja;
    _abFillMerged++;
  });
}
const { compose } = require('./_waza_compose.js'); // effects→効果文(ルール: 元データから説明を生成)

// === P8: availability 導出ヘルパ ===
const _sdByNum_all = {};
Object.values(SD_MOVES).forEach(m => { if(m.num) _sdByNum_all[m.num] = m; });
function deriveAvailabilityAll(mvId, mvSlug){
  const lookupId = (mvSlug && mvSlug.includes('--special')) ? mvId - 1 : mvId;
  const sd = _sdByNum_all[lookupId];
  if (!sd) return null;
  const genIntro = sd.gen || 1;
  const ns = sd.isNonstandard;
  if (ns === 'LGPE') return { gen_introduced: genIntro, gens: [genIntro], is_lgpe: true };
  if (ns === 'Past') return { gen_introduced: genIntro, gens: Array.from({length: 8 - genIntro + 1}, (_, i) => genIntro + i) };
  if (ns === 'CAP' || ns === 'Unobtainable' || ns === 'Gigantamax') return { gen_introduced: genIntro, gens: null, is_nonstandard: ns };
  return { gen_introduced: genIntro, gens: Array.from({length: 9 - genIntro + 1}, (_, i) => genIntro + i) };
}
// ★修正済み技の効果文=composeで生成(マザー流: ダメージ技は「ダメージ。{効果}」/効果なしは「ダメージのみ。」)
// ★P3 Max/Z技: compose内でプレフィックスを付与済み → ダメージ技のプレフィックス(is_max/z.user)が先頭に来るよう
//   「ダメージ。」は Max/Z専用プレフィックスの後ろに挿入(例: 「攻撃技のダイマックス技。ダメージ。<効果>」)
function composeDesc(m){
  const t=(compose(m).text||'').trim();
  const isDmg = m.category!=='変化' || (m.power!=null && m.power>0);
  if(isDmg){
    if(!t) return 'ダメージのみ。';
    // Max技/専用Z技はcompose内でプレフィックスを付与済み。そのプレフィックスを先頭に残しつつ「ダメージ。」をその直後に挿入
    const maxPfx = m.is_max ? (m.category!=='変化'?'攻撃技のダイマックス技。':'変化技のダイマックス技。') : '';
    const zPfx = (m.z && m.z.user && !m.z.generic) ? `「${m.z.user}」の専用Zワザ。` : '';
    const pfx = maxPfx || zPfx;
    if(pfx && t.startsWith(pfx)){
      // プレフィックス抜きの残テキスト
      const rest = t.slice(pfx.length);
      return pfx + 'ダメージ。' + (rest || '');
    }
    return 'ダメージ。'+t;
  }
  return t;
}
// ★2026-07-01 穴チェック版: composeが穴なし(全effectsを喋れた)かどうかも返す。
//   焼き込み撲滅=Champions技も穴なしならcompose再生成に切替える判定用。
// ★2026-07-02 修正: isDmg技でeffects空(text="")は「追加効果なし=ダメージのみ」=穴なし(holes=false)。
//   !t だけで holes=true とすると句点なし焼き込み(ダメージのみ)にフォールバックしてしまいmasterと不一致になる。
function composeDescH(m){
  const r = compose(m);
  const t = (r.text||'').trim();
  const isDmg = m.category!=='変化' || (m.power!=null && m.power>0);
  let text;
  if(isDmg){
    if(!t){ text = 'ダメージのみ。'; }
    else {
      const maxPfx = m.is_max ? (m.category!=='変化'?'攻撃技のダイマックス技。':'変化技のダイマックス技。') : '';
      const zPfx = (m.z && m.z.user && !m.z.generic) ? `「${m.z.user}」の専用Zワザ。` : '';
      const pfx = maxPfx || zPfx;
      if(pfx && t.startsWith(pfx)){
        const rest = t.slice(pfx.length);
        text = pfx + 'ダメージ。' + (rest || '');
      } else {
        text = 'ダメージ。'+t;
      }
    }
  } else { text = t; }
  const holes = (r.holes && r.holes.length>0) || (!t && !isDmg);   // 穴あり or (変化技で空) = compose不完全。dmg技のeffects空は「効果なし」で穴ではない
  return {text, holes};
}
// 変化技の subcategory を分類から導出(ポケモンDBわざ列のグループ順 CAT_ORDER に合わせる=新技も既存と同じグループに入る)。
function subcatFromTags(t){
  if(!t) return 'その他';
  if(t.recovery && t.recovery!=='none') return '回復';
  if(t.screen && t.screen!=='none') return '壁';
  if(t.room && t.room!=='none') return 'ルーム';
  if(t.weather && t.weather!=='none') return '天候';
  if(t.field && t.field!=='none') return 'フィールド';
  if(t.hazard && t.hazard!=='none') return '設置';
  if(t.moveBlock && t.moveBlock!=='none') return '技封じ';
  if(t.switch==='trap') return '捕縛';
  if(t.switch==='force_opp' || t.switch==='self') return '交代';
  if(t.support) return 'サポート';
  if((t.status&&t.status.length) || t.flinch>0) return '状態異常';
  if(t.stats && t.stats.length){
    const selfUp = t.stats.filter(s=>s.target==='self' && s.stages>0);
    const oppDown = t.stats.filter(s=>s.target==='opponent' && s.stages<0);
    if(selfUp.length){
      const ss = selfUp.map(s=>s.stat);
      if(ss.some(s=>s==='speed')) return '積み速';
      if(ss.some(s=>s==='defense'||s==='special_defense')) return '積み防';
      return '積み攻';
    }
    if(oppDown.length) return '能力下';
  }
  if(t.cureStatus) return '回復';
  if(t.removeHazards||t.fieldRemove) return 'その他';
  return 'その他';
}
// intermediate分類 → battle_data(タグエンジンが読む形)。waza_picker.js の getMoveFilterTags/_miscTagJudges 準拠。
function bdFromTags(t){
  const bd={crit_stage:0,must_crit:false,crit_changes:[],effects:[]};
  (t.status||[]).forEach(s=>{ if(s&&s.name) bd.effects.push({kind:'状態付与',target:s.target||'opponent',value:s.name,prob:s.prob||100,phase:'on_use'}); });
  if(t.flinch>0) bd.effects.push({kind:'ひるみ',target:'opponent',prob:t.flinch,phase:'on_use'});
  (t.stats||[]).forEach(st=>{ if(st&&st.stat&&st.stages) bd.effects.push({kind:'能力ランク変化',target:st.target||'opponent',stat:st.stat,stages:st.stages,prob:st.prob||100,phase:'on_use'}); });
  if(t.crit==='high') bd.crit_stage=1; if(t.crit==='always') bd.must_crit=true;
  if(t.mustHit) bd.must_hit=true;
  if(t.multiHit&&t.multiHit!=='none') bd.multi_hit=t.multiHit;
  if(t.recoil&&t.recoil!=='none') bd.recoil=t.recoil;
  if(t.drain&&t.drain!=='none') bd.drain=(t.drain==='seed'?'seed':'1/2');
  if(t.recovery&&t.recovery!=='none') bd.recovery=t.recovery;
  if(t.charge&&t.charge!=='none') bd.charge=t.charge;
  if(t.recharge) bd.recharge=true; if(t.selfFaint) bd.self_faint=true;
  if(t.weather&&t.weather!=='none') bd.weather_set=t.weather;
  if(t.field&&t.field!=='none') bd.field_set=t.field;
  if(t.hazard&&t.hazard!=='none') bd.hazard_set=t.hazard;
  if(t.screen&&t.screen!=='none') bd.screen=t.screen;
  if(t.room&&t.room!=='none') bd.room=t.room;
  if(t.tailwind) bd.tailwind=true; if(t.gravity) bd.gravity=true;
  if(t.switch==='force_opp') bd.force_switch_opp=true; else if(t.switch==='self') bd.self_switch=true; else if(t.switch==='trap') bd.trap_no_switch=true;
  if(t.moveBlock&&t.moveBlock!=='none') bd.move_block=t.moveBlock;
  if(t.support) bd.support=true;
  if(t.removeHazards) bd.remove_hazards=true; if(t.fieldRemove) bd.field_remove=true;
  if(t.cureStatus) bd.cure_status=[{target:'self',value:'all'}];
  if(t.substitutePierce) bd.substitute_pierce=true;
  return bd;
}

const TYPE_JA={normal:'ノーマル',fire:'ほのお',water:'みず',electric:'でんき',grass:'くさ',ice:'こおり',fighting:'かくとう',poison:'どく',ground:'じめん',flying:'ひこう',psychic:'エスパー',bug:'むし',rock:'いわ',ghost:'ゴースト',dragon:'ドラゴン',dark:'あく',steel:'はがね',fairy:'フェアリー'};
const TYPES=C.TYPES; // JA順(TYPE_CHARTと一致)
// 型相性表(攻撃type行 × 防御type列・TYPES順)。出典 tools/_gen_content_pages.js
const TYPE_CHART=[
  [1,1,1,1,1,1,1,1,1,1,1,1,0.5,0,1,1,0.5,1],[1,0.5,0.5,1,2,2,1,1,1,1,1,2,0.5,1,0.5,1,2,1],
  [1,2,0.5,1,0.5,1,1,1,2,1,1,1,2,1,0.5,1,1,1],[1,1,2,0.5,0.5,1,1,1,0,2,1,1,1,1,0.5,1,1,1],
  [1,0.5,2,1,0.5,1,1,0.5,2,0.5,1,0.5,2,1,0.5,1,0.5,1],[1,0.5,0.5,1,2,0.5,1,1,2,2,1,1,1,1,2,1,0.5,1],
  [2,1,1,1,1,2,1,0.5,1,0.5,0.5,0.5,2,0,1,2,2,0.5],[1,1,1,1,2,1,1,0.5,0.5,1,1,1,0.5,0.5,1,1,0,2],
  [1,2,1,2,0.5,1,1,2,1,0,1,0.5,2,1,1,1,2,1],[1,1,1,0.5,2,1,2,1,1,1,1,2,0.5,1,1,1,0.5,1],
  [1,1,1,1,1,1,2,2,1,1,0.5,1,1,1,1,0,0.5,1],[1,0.5,1,1,2,1,0.5,0.5,1,0.5,2,1,1,0.5,1,2,0.5,0.5],
  [1,2,1,1,1,2,0.5,1,0.5,2,1,2,1,1,1,1,0.5,1],[0,1,1,1,1,1,1,1,1,1,2,1,1,2,1,0.5,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,0.5,0],[1,1,1,1,1,1,0.5,1,1,1,2,1,1,2,1,0.5,1,0.5],
  [1,0.5,0.5,0.5,1,2,1,1,1,1,1,1,2,1,1,1,0.5,2],[1,0.5,1,1,1,1,2,0.5,1,1,1,1,1,1,2,2,0.5,1]];
const tIdx=ja=>TYPES.indexOf(ja);
function resistOf(types){ // types=english slug[]
  const i1=tIdx(TYPE_JA[types[0]]); const i2=types[1]!=null?tIdx(TYPE_JA[types[1]]):-1;
  const r=[]; for(let i=0;i<18;i++){ let v=TYPE_CHART[i][i1]; if(i2>=0)v*=TYPE_CHART[i][i2]; r.push(v); } return r;
}
const ABJA={}; AB.forEach(a=>{ABJA[a.slug]=a.names.ja||a.names.en||a.slug;});
const MVJA={}; MV.forEach(m=>{MVJA[m.slug]=m.names.ja||m.names.en||m.slug;});
const CAT_JA={physical:'物理',special:'特殊',status:'変化'};
const normWide=s=>String(s).replace(/Ｘ/g,'X').replace(/Ｙ/g,'Y'); // 全角XY→半角(curated一致用)
const REG={alola:'アローラ',galar:'ガラル',hisui:'ヒスイ',paldea:'パルデア'};
// 一意JA名(POKEMON_WAZA結合キー)。curated命名(メガ○○X / ○○(ヒスイ))に寄せつつ全1302で一意化。
function jaNameRaw(v){
  const base=v.species_names.ja||v.slug;
  if(v.is_default && !v.is_mega && !v.form_slug) return base;
  if(v.is_mega) return v.form_names.ja?normWide(v.form_names.ja):('メガ'+base);
  const fs=v.form_slug||'';
  for(const k in REG){ if(fs.includes(k)){ const rest=fs.split('-').filter(x=>x!==k).join('-'); return base+'('+REG[k]+(rest?('・'+rest):'')+')'; } }
  if(v.form_names.ja) return base+'('+normWide(v.form_names.ja)+')';
  if(fs) return base+'('+fs+')';
  return base;
}
function formField(v){ if(v.is_mega)return'メガ進化'; if(v.is_default&&!v.form_slug)return'通常'; const fs=v.form_slug||''; for(const k in REG)if(fs.includes(k))return'リージョン'; return'フォルム'; }
// 世代(dexから第1〜9)
const GENR=[[1,151],[152,251],[252,386],[387,493],[494,649],[650,721],[722,809],[810,905],[906,1025]];
const genOf=dex=>{for(let i=0;i<GENR.length;i++)if(dex>=GENR[i][0]&&dex<=GENR[i][1])return i+1;return 0;};

// --- 見た目だけのフォーム除外(基本形と種族値+タイプ+特性が同一、またはキャップ/トーテム/gmax/starter等) ---
const defByDex={}; P.forEach(v=>{if(v.is_default)defByDex[v.dex]=v;});
const sig=v=>v.types.join('/')+'|'+Object.values(v.stats).join(',')+'|'+v.abilities.map(a=>a.name).sort().join(',');
const COSM=/(^|-)(rock-star|belle|pop-star|phd|libre|cosplay|cap|totem|gmax|starter|battle-bond|gulping|gorging|dada|own-tempo|eternamax)(-|$)/;
function isCosmetic(v){
  if(v.is_mega||v.is_default) return false;       // メガ・各種default(リージョン本体含む)は常に残す
  const d=defByDex[v.dex];
  if(d && sig(v)===sig(d)) return true;            // 中身が基本形と完全同一=見た目だけ
  if(COSM.test(v.form_slug||'')) return true;      // 既知の見た目フォーム(starter等は種族値違いでも除外)
  return false;
}
const PALL=P;                                       // 全1302(参照用)
const P2=P.filter(v=>!isCosmetic(v));               // 間引き後

// --- jaName を全件で確定(衝突は form_slug 付与で一意化) ---
const usedName=new Set(); const NAME={}; // slug→jaName
for(const v of P2){ let n=jaNameRaw(v); if(usedName.has(n)) n=n+'〈'+v.slug+'〉'; usedName.add(n); NAME[v.slug]=n; }

// --- POKEMON_LIST ---
const weightByName={}; const curPByName={};
C.POKEMON_LIST.forEach(p=>{weightByName[p.name]=p.weight_kg; curPByName[p.name]=p;});
// Season(M-A/M-B)判定: Champions名簿と名前一致で。M-B新規=['M-B']/M-A継続=['M-A','M-B']/Champions外=[](世代のみ)。Generationとは別項目。
function seasonOf(name){ const c=curPByName[name]; if(!c)return []; return c.added_in==='M-B'?['M-B']:['M-A','M-B']; }
const POKEMON_LIST=P2.map(v=>{
  const st=v.stats; const total=st.hp+st.atk+st.def+st.spa+st.spd+st.spe;
  const abis=v.abilities.slice().sort((a,b)=>(a.hidden?1:0)-(b.hidden?1:0)).map(a=>ABJA[a.name]||a.name);
  const name=NAME[v.slug];
  return {
    no:String(v.dex||0).padStart(3,'0'), name, gen:genOf(v.dex), season:seasonOf(NAME[v.slug]), legend:LEGEND[v.dex]||'', form:formField(v), mega:!!v.is_mega,
    weight_kg:(weightByName[name]!=null?weightByName[name]:null),
    type1:TYPE_JA[v.types[0]]||v.types[0], type2:v.types[1]?(TYPE_JA[v.types[1]]||v.types[1]):'',
    hp:st.hp,atk:st.atk,def:st.def,spatk:st.spa,spdef:st.spd,spd:st.spe,total,
    ab1:abis[0]||'',ab2:abis[1]||'',ab3:abis[2]||'',
    resist:resistOf(v.types),
  };
});

// --- WAZA_MAP(937, key=move slug) + learners(learnset逆引き) ---
// ★2026-06-28 シャドウ技(type=shadow=コロシアム/XD専用・本編外)は全国版から除外(阿部さん)。
//   ※slug名でなくtypeで判定(シャドーボール等の本編ゴースト技=type:ghostを誤除外しないため)。
const SHADOW=new Set(MV.filter(m=>m.type==='shadow').map(m=>m.slug));
const learnersBy={}; // moveSlug→Set(jaName)
const POKEMON_WAZA={};
for(const v of P2){ const n=NAME[v.slug]; const moves=(LS[v.slug]||[]).filter(ms=>!SHADOW.has(ms)); POKEMON_WAZA[n]=moves.slice();
  for(const ms of moves){ (learnersBy[ms]||(learnersBy[ms]=new Set())).add(n); } }
// curated overlay(JA技名一致): description/description_legacy/battle_data/tags/target/contact/protect/flags
const curByName={}; Object.keys(C.WAZA_MAP).forEach(k=>{const w=C.WAZA_MAP[k];curByName[w.name]=w;});
const WAZA_MAP={};
for(const m of MV){
  if(SHADOW.has(m.slug)) continue; // ★シャドウ技除外(コロシアム/XD専用)
  const nameJa=MVJA[m.slug]; const cur=curByName[nameJa];
  const learners=[...(learnersBy[m.slug]||[])];
  // battle_data: ①修正オーバーレイ(MFIX) > ②Champions curated > ③moves_tags変換 > ④空
  const bd = MFIX[m.slug] ? MFIX[m.slug]
           : (cur&&cur.battle_data ? cur.battle_data
           : (MTAGS[m.slug] ? bdFromTags(MTAGS[m.slug]) : {crit_stage:0,must_crit:false,crit_changes:[],effects:[]}));
  // ★battle_data.priority を技の優先度から設定(composeが「優先度+Nの先制技」を出す)。0は出さない。
  // ★2026-07-02 修正: Champions技(cur あり)もcompose再生成するようになったため !cur 条件を外す(masterと統一)
  if(bd && bd.priority==null && (m.priority||0)!==0) bd.priority = m.priority;
  const entry={
    name:nameJa, move_no:m.id, type:TYPE_JA[m.type]||m.type, category:CAT_JA[m.damage_class]||'変化',
    target:cur?cur.target:'1体選択', power:m.power, accuracy:m.accuracy, pp:m.pp, priority:m.priority||0,
    contact:cur?!!cur.contact:!!(MFLAGS[m.slug]&&MFLAGS[m.slug].contact), protect:cur?(cur.protect!==false):true,
    description:'', key:m.slug, learners,
    national_new:!cur && !!MJD[m.slug], // 全国版で新規追加した技(M-A/M-B以外=Champions外)
    description_legacy:cur?(cur.description_legacy||''):(MYK[m.slug]||''), // 新技はヤックン(徹底攻略)JAをlegacy参照に
    battle_data:bd,
    flags:Object.assign({}, MFLAGS[m.slug]||{}, cur&&cur.flags?cur.flags:{}), // ★MFLAGS(分類フラグ)をベースにChampions curatedフラグで上書き(双方マージ)

    subcategory:(cur&&cur.subcategory)?cur.subcategory:((CAT_JA[m.damage_class]==='変化'&&MTAGS[m.slug])?subcatFromTags(MTAGS[m.slug]):undefined), // 変化技の細分(回復/状態異常等)=わざ列のグループ順。新技はタグ分類から導出して既存と同じグループへ
    tags:cur&&cur.tags?cur.tags:[],
    // ★P3 Max/Z メタデータ(2026-07-02): _move_flags.json の is_max/z フィールドをエントリに伝播
    ...(MFLAGS[m.slug]&&MFLAGS[m.slug].is_max ? {is_max:true} : {}),
    ...(MFLAGS[m.slug]&&MFLAGS[m.slug].z ? {z:MFLAGS[m.slug].z} : {}),
    // ★P8: availability (gen_introduced / gens / is_lgpe 等)
    availability: deriveAvailabilityAll(m.id, m.slug),
  };
  // 説明文: ★①MDESC(手書きオーバーレイ・最優先=語彙外メカをヤックン由来手書き) ②MFIX=compose一本化
  //   ③★2026-07-01 焼き込み撲滅: Champions技もcomposeが穴なしなら再生成(古い焼込descの陳腐化を根絶) ④穴あり=従来(curated焼込 or MJD)
  // ★2026-07-02 修正: isDmg技はeffects空でも「ダメージのみ。」=完全文→常にcomposeDescHを呼ぶ(effects長さ条件を外す)
  const _isDmg = entry.category!=='変化' || (entry.power!=null && entry.power>0);
  const _ch = (_isDmg || (entry.battle_data && (entry.battle_data.effects||[]).length)) ? composeDescH(entry) : {text:'',holes:true};
  entry.description = MDESC[m.slug] ? MDESC[m.slug]
                    : (MFIX[m.slug] ? composeDesc(entry)
                    : (!_ch.holes ? _ch.text
                    : (cur?(cur.description||MJD[m.slug]||''):(MJD[m.slug]||''))));
  WAZA_MAP[m.slug]=entry;
}

// --- 出力 ---
const J=o=>JSON.stringify(o);
const out=`// AUTO-GENERATED by tools/_build_pokechan_data_all.js — 編集しない。元データ=reference/*.json + learnsets_master.json
// 全国版(全部版)共通DB。pokechan_data.js と同一schema。新ポケ/技追加時は reference 再生成→本ビルダー再実行のみ。
const TYPES = ${J(C.TYPES)};
const TYPE_COLORS = ${J(C.TYPE_COLORS)};
const TYPE_KANJI = ${J(C.TYPE_KANJI)};
const TYPE_DISPLAY = ${J(C.TYPE_DISPLAY)};
const TYPE_OFFENSIVE_STATS = ${J(C.TYPE_OFFENSIVE_STATS)};
const DEFAULT_TYPE_ORDER = ${J(C.DEFAULT_TYPE_ORDER)};
const POKEMON_LIST = ${J(POKEMON_LIST)};
const DATA = POKEMON_LIST;
const WAZA_MAP = ${J(WAZA_MAP)};
const POKEMON_WAZA = ${J(POKEMON_WAZA)};
const ABILITY_DESC = ${J(ABILITY_DESC)};
const STAT_RANK = ${J(C.STAT_RANK)};
const NATURES = ${J(C.NATURES)};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TYPES, TYPE_COLORS, TYPE_KANJI, TYPE_DISPLAY, TYPE_OFFENSIVE_STATS, DEFAULT_TYPE_ORDER, POKEMON_LIST, DATA, WAZA_MAP, POKEMON_WAZA, ABILITY_DESC, STAT_RANK, NATURES };
}
`;
fs.writeFileSync('pokechan_data_all.js',out);
const overlaidW=MV.filter(m=>curByName[MVJA[m.slug]]).length;
const overlaidP=POKEMON_LIST.filter(p=>p.weight_kg!=null).length;
console.log(`pokechan_data_all.js 生成: POKEMON_LIST=${POKEMON_LIST.length}(全${PALL.length}から見た目フォーム${PALL.length-P2.length}件間引き) / WAZA_MAP=${Object.keys(WAZA_MAP).length} / POKEMON_WAZA=${Object.keys(POKEMON_WAZA).length}`);
console.log(`overlay: 技説明/battle_data=${overlaidW}件 / 体重=${overlaidP}件`);
console.log(`ABILITY_DESC: Champions=${Object.keys(C.ABILITY_DESC).length}件 + fillマージ=${_abFillMerged}件 → 全部版計=${Object.keys(ABILITY_DESC).length}件`);
