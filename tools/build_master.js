#!/usr/bin/env node
/* T1(DB統一リビルド): 統一マスターSSOT生成。設計_DB統一_2026-07-01.md の schema案 に厳密準拠。
 * 出力: reference/master_{pokemon,moves,abilities,items}.json
 * 入力(SOT): pokeapi_master/pokechan_data.js(Champions overlay)/moves_battle_data_fix(effects)/_move_flags/
 *            abilities_desc_ja / _waza_compose(description_ja再生成・焼込なし)
 * 結合キー=slug/id(JA名結合は表記揺れで壊れる=禁止・normWideで吸収する部分のみ例外)。
 * move_no=moves_master.id(正規=独自採番7技はslugで解決し自然に正規化)。コインビームは独自id予約。
 * 実行: node tools/build_master.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// === 入力(SOT) ===
const C   = require(path.join(ROOT, 'pokechan_data.js'));                  // Champions curated(overlay元)
const P   = require(path.join(ROOT, 'reference/pokeapi_master.json'));    // 1302 pokemon base
const MV  = require(path.join(ROOT, 'reference/moves_master.json'));      // 937 moves base
const AB  = require(path.join(ROOT, 'reference/abilities_master.json'));  // 311 abilities base
const IT  = require(path.join(ROOT, 'reference/items_master.json'));      // 2180 items base
const MFIX  = require(path.join(ROOT, 'reference/moves_battle_data_fix.json'));  // effects SSOT(全919技)
const MFLAGS= (()=>{ try{return require(path.join(ROOT,'reference/_move_flags.json'));}catch(e){return {};} })();
const MDESC = (()=>{ try{return require(path.join(ROOT,'reference/moves_desc_override.json'));}catch(e){return {};} })(); // ★手書きオーバーレイ最優先(_build_pokechan_data_all.js 準拠)
const ABDESC= (()=>{ try{return require(path.join(ROOT,'reference/abilities_desc_ja.json'));}catch(e){return {};} })();
const MTAGS = (()=>{ try{return require(path.join(ROOT,'reference/moves_tags.json'));}catch(e){return {};} })();
const LEGEND= (()=>{ try{return require(path.join(ROOT,'reference/legend_status.json'));}catch(e){return {};} })();
const SD_MOVES= (()=>{ try{return require(path.join(ROOT,'reference/_showdown/moves.json'));}catch(e){return {};} })(); // ★P8: Showdown moves.json(gen/isNonstandard)

// === P8: availability導出ヘルパ ===
// SDをnum→entryで引く(num=正規技番号=moves_master.id と同一)
const _sdByNum = {};
Object.values(SD_MOVES).forEach(m => { if(m.num) _sdByNum[m.num] = m; });
// availability導出: moves_master.id(=正規技番号)をキーにSD結合
function deriveAvailability(mvId, mvSlug){
  // --special Z技はid-1でphysical版と結合
  const lookupId = (mvSlug && mvSlug.includes('--special')) ? mvId - 1 : mvId;
  const sd = _sdByNum[lookupId];
  if (!sd) return null; // SDに無い(Champions独自技等)→null
  const genIntro = sd.gen || 1;
  const ns = sd.isNonstandard;
  if (ns === 'LGPE') return { gen_introduced: genIntro, gens: [genIntro], is_lgpe: true };
  if (ns === 'Past') return { gen_introduced: genIntro, gens: Array.from({length: 8 - genIntro + 1}, (_, i) => genIntro + i) }; // Past=Gen8まで(近似)
  if (ns === 'CAP' || ns === 'Unobtainable' || ns === 'Gigantamax') return { gen_introduced: genIntro, gens: null, is_nonstandard: ns };
  // 現行(Gen9標準)
  return { gen_introduced: genIntro, gens: Array.from({length: 9 - genIntro + 1}, (_, i) => genIntro + i) };
}
const LS    = (()=>{ try{return require(path.join(ROOT,'reference/learnsets_master.json'));}catch(e){return {};} })();  // ★T1.5(2): master_moves.learners
const MYK   = (()=>{ try{return require(path.join(ROOT,'reference/moves_yakkun.json'));}catch(e){return {};} })();    // ★T1.5(2): description_legacy fallback
const { compose } = require('./_waza_compose.js');

// === ヘルパ(_build_pokechan_data_all.js 準拠) ===
const TYPE_JA={normal:'ノーマル',fire:'ほのお',water:'みず',electric:'でんき',grass:'くさ',ice:'こおり',fighting:'かくとう',poison:'どく',ground:'じめん',flying:'ひこう',psychic:'エスパー',bug:'むし',rock:'いわ',ghost:'ゴースト',dragon:'ドラゴン',dark:'あく',steel:'はがね',fairy:'フェアリー'};
const CAT_JA={physical:'物理',special:'特殊',status:'変化'};
const normWide=s=>String(s).replace(/[Ａ-Ｚａ-ｚ０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/Ｘ/g,'X').replace(/Ｙ/g,'Y');   // 全角英数字→半角(10まんボルト/DDラリアット等の表記ゆれ吸収)
const ABJA={}; AB.forEach(a=>ABJA[a.slug]=a.names.ja||a.names.en||a.slug);
const MVJA={}; MV.forEach(m=>MVJA[m.slug]=m.names.ja||m.names.en||m.slug);
const REG={alola:'アローラ',galar:'ガラル',hisui:'ヒスイ',paldea:'パルデア'};
// pokeapi_master→Champions表記のJA名(_build_pokechan_data_all.js の jaNameRaw と同一・表記揺れ吸収)
function jaNameRaw(v){
  const base=v.species_names.ja||v.slug;
  if(v.is_default && !v.is_mega && !v.form_slug) return base;
  if(v.is_mega) return v.form_names&&v.form_names.ja?normWide(v.form_names.ja):('メガ'+base);
  const fs=v.form_slug||'';
  for(const k in REG){ if(fs.includes(k)){ const rest=fs.split('-').filter(x=>x!==k).join('-'); return base+'('+REG[k]+(rest?('・'+rest):'')+')'; } }
  if(v.form_names&&v.form_names.ja) return normWide(v.form_names.ja);   // ロトム等の完全名フォーム(非REG)は form_names.ja をそのまま(base足さない)
  if(fs) return base+'('+fs+')';
  return base;
}
// Champions逆引き(JA名→curated・normWideキーで全角/半角揺れを吸収=メガリザードンＸ↔X 等)
const curPByName={}; C.POKEMON_LIST.forEach(p=>{curPByName[normWide(p.name)]=p;});
const curWByName={}; Object.keys(C.WAZA_MAP).forEach(k=>{const w=C.WAZA_MAP[k]; curWByName[normWide(w.name)]=w;});
const weightByName={}; C.POKEMON_LIST.forEach(p=>{weightByName[normWide(p.name)]=p.weight_kg;});
function seasonOf(jaName){ const c=curPByName[jaName]; if(!c) return null; return c.added_in==='M-B'?['M-B']:['M-A','M-B']; }
// compose が読む move 形にして説明文を再生成(焼込なし=effects→compose一方通行・R9)
function composeDescJa(moveLike){
  const t=(compose(moveLike).text||'').trim();
  const isDmg = moveLike.category!=='変化' || (moveLike.power!=null && moveLike.power>0);
  if(isDmg) return t ? ('ダメージ。'+t) : 'ダメージのみ。';
  return t;
}
// シャドウ技(コロシアム/XD専用)は全国版から除外(既存ビルダ準拠)
const SHADOW=new Set(MV.filter(m=>m.type==='shadow').map(m=>m.slug));
// Champions独自技コインビーム(独自id予約・926維持)
const COIN_BEAM_NO=926;
// ★T1.5(2): learnset逆引き(move slug→[poke JA名])=master_moves.learners
const learnersBy={};
for(const v of P){ const n=normWide(jaNameRaw(v)); const moves=(LS[v.slug]||[]).filter(ms=>!SHADOW.has(ms)); for(const ms of moves){ (learnersBy[ms]||(learnersBy[ms]=new Set())).add(n); } }

// provenanceヘルパ
const prov=(base,overlay)=>({base, overlay: overlay||null});

// ============================================================
// タスク(3): Champions独自メガ等とpokeAPI slugのマッピング(多言語名救済)
// Champions独自JA名 → pokeAPI slug(form_names/species_namesから多言語取得)
// ============================================================
const CHAMP_SLUG_MAP = {
  // ケンタロス パルデア
  'ケンタロス(パルデア炎)': 'tauros-paldea-blaze-breed',
  'ケンタロス(パルデア水)': 'tauros-paldea-aqua-breed',
  'ケンタロス(パルデア単)': 'tauros-paldea-combat-breed',
  // ギルガルド
  'ギルガルド(シールド)': 'aegislash-shield',
  'ギルガルド(ブレード)': 'aegislash-blade',
  // ルガルガン
  'ルガルガン(まひる)': 'lycanroc-midday',
  'ルガルガン(まよなか)': 'lycanroc-midnight',
  'ルガルガン(たそがれ)': 'lycanroc-dusk',
  // ニャオニクス
  'ニャオニクス♂': 'meowstic-male',
  'ニャオニクス♀': 'meowstic-female',
  // パンプジン (pokeAPIはバケッチャのフォーム=パンプジンは別種・gourgeist)
  'パンプジン(小)': 'gourgeist-small',
  'パンプジン(大)': 'gourgeist-large',
  'パンプジン(特大)': 'gourgeist-super',
  // イダイトウ (basculegion)
  'イダイトウ♂': 'basculegion-male',
  'イダイトウ♀': 'basculegion-female',
  // イルカマン
  'イルカマン(ナイーブ)': 'palafin-zero',
  'イルカマン(マイティ)': 'palafin-hero',
};
// pokeAPI slug→v マップ
const pBySlug = {};
P.forEach(v=>{ pBySlug[v.slug] = v; });

// ============================================================
// master_pokemon.json (1302)
// ============================================================
const masterPokemon = P.map(v=>{
  const jaName = jaNameRaw(v);   // Champions表記のJA名(_buildと同一ロジック・curatedと結合)
  const seasons = seasonOf(jaName);
  const names = {...v.species_names, ja: jaName};   // ja=jaNameRaw(normWide・Champions表記)
  if (v.form_names && Object.keys(v.form_names).length){
    for(const lang of Object.keys(v.form_names)){ if(lang!=='ja') names[lang]=v.form_names[lang]; }   // ja以外を上書き・jaはjaNameRaw保持
  }
  const w = weightByName[jaName];
  const megaForm = v.is_mega ? (v.form_slug||'mega').replace(/^mega-?/,'').toUpperCase() : null;  // X/Y/''
  return {
    id:v.id, slug:v.slug, dex:v.dex, is_default:!!v.is_default, is_mega:!!v.is_mega, form_slug:v.form_slug||'',
    names, types:(v.types||[]).map(t=>TYPE_JA[t]||t), stats:v.stats,
    abilities:(v.abilities||[]).map(a=>ABJA[a.name]||a.name),
    weight_kg: w!=null ? w : null,
    legend: LEGEND[v.dex]||'',
    champions: seasons ? {in:true, seasons, mega: v.is_mega ? (megaForm? [megaForm]:[]) : []} : null,
    provenance: prov('pokeapi_master', seasons?'pokechan_data':null)
  };
});

// ★pokeapi_masterに無いChampions独自ポケモン(独自メガ/フォーム等)をpokechan_data.jsから追加(Champions 1件も失わない)
let ownPokeCount=0, ownPokeSlugMatched=0, ownPokeJaOnly=0;
const _masterJaSet=new Set(masterPokemon.map(p=>p.names.ja));
C.POKEMON_LIST.forEach(p=>{
  const ja=normWide(p.name);
  if(_masterJaSet.has(ja)) return;
  // タスク(3): CHAMP_SLUG_MAPでpokeAPI slugと結合→多言語名取得
  const matchSlug = CHAMP_SLUG_MAP[p.name];
  const matchedV = matchSlug ? pBySlug[matchSlug] : null;
  let names;
  if(matchedV){
    // species_names(基本言語) + form_names(フォーム差分)をマージ
    names = Object.assign({}, matchedV.species_names||{}, matchedV.form_names||{}, {ja:p.name});
    ownPokeSlugMatched++;
  } else {
    names = {ja:p.name};
    ownPokeJaOnly++;
  }
  masterPokemon.push({
    id:'c-'+p.no, slug: matchSlug||('c-'+p.no), dex:parseInt(p.no)||0,
    is_default:false, is_mega:!!p.mega, form_slug:'',
    names,
    types:[p.type1,p.type2].filter(Boolean),
    stats:{hp:p.hp,atk:p.atk,def:p.def,spa:p.spatk,spd:p.spdef,spe:p.spd},
    abilities:[p.ab1,p.ab2,p.ab3].filter(Boolean),
    weight_kg:p.weight_kg!=null?p.weight_kg:null, legend:'',
    champions:{in:true, seasons:(p.added_in==='M-B'?['M-B']:['M-A','M-B']), mega:[]},
    is_original:true,
    provenance:prov('pokechan_data(独自)', matchedV?'pokeapi_master(slug結合)':null)
  });
  ownPokeCount++;
});

// ============================================================
// master_moves.json (919 + コインビーム)
// ============================================================
const masterMoves = [];
let mvOverlayCount=0, mvComposeCount=0;
for (const m of MV){
  if (SHADOW.has(m.slug)) continue;
  const jaName = normWide(m.names.ja||m.slug);   // normWideでcuratedと結合(全角/半角揺れ吸収)
  const cur = curWByName[jaName];
  // effects SSOT = MFIX の effects を使い、crit_stage/must_crit/crit_changes は cur.battle_data 優先(Champions実値=3ぼんのやcrit1等)
  const bd = MFIX[m.slug]
    ? { ...(cur&&cur.battle_data ? {crit_stage:cur.battle_data.crit_stage, must_crit:cur.battle_data.must_crit, crit_changes:cur.battle_data.crit_changes, ...(cur.battle_data.rank_changes?{rank_changes:cur.battle_data.rank_changes}:{})} : {}), effects: MFIX[m.slug].effects || [] }
    : (cur&&cur.battle_data ? cur.battle_data
    : {crit_stage:0,must_crit:false,crit_changes:[],effects:[]});
  const flags = Object.assign({}, MFLAGS[m.slug]||{}, (cur&&cur.flags)||{}); // ★2026-07-02 全国版ビルダーと同一マージ(MFLAGS基盤+curated上書き)=P2/P5の新フラグをChampions viewにも波及
  const target = cur ? cur.target : '1体選択';
  const contact = cur ? !!cur.contact : false;
  const protect = cur ? (cur.protect!==false) : true;
  const tags = (cur&&cur.tags) ? cur.tags : [];
  // ★_build_pokechan_data_all.js 準拠: bd.priorityが未設定かつm.priorityが0以外の場合はm.priorityを設定
  // (全国版は !cur 条件限定だが、masterでは常にcompose再生成するため cur あり技でも優先度を設定する)
  if (bd && bd.priority==null && (m.priority||0)!==0) bd.priority = m.priority;
  // description_ja: ①MDESC(手書きオーバーレイ最優先・_build_pokechan_data_all.js と同一優先順位) ②compose 再生成(焼込なし)
  // ★_build_pokechan_data_all.js の composeDesc(entry) と完全同一引数: flags を含む全フィールドを渡す(フラグ由来文「パンチ系の技。」等が付与される)
  const moveLike = { name:jaName, category:CAT_JA[m.damage_class]||'変化', power:m.power, battle_data:bd, type:TYPE_JA[m.type]||m.type, flags };
  const description_ja = MDESC[m.slug] ? MDESC[m.slug] : composeDescJa(moveLike);
  if (!description_ja) mvComposeCount;
  // タスク(4): 技のseasons導出は確実な根拠(cur.added_in明示)がある場合のみ設定。根拠なし=null(未確定)。
  // ※WAZA_MAPには現状added_inが全くない→全技null。M-B明示があれば['M-B']、M-A明示は['M-A']。
  // 空配列[]は「根拠なしだが初期から有り」の別概念になるため、根拠不明=null で区別する。
  const seasons = cur && cur.added_in==='M-B' ? ['M-B']
                : cur && cur.added_in==='M-A' ? ['M-A']
                : null;  // 根拠なし→null(未確定・空配列と区別)
  if (cur) mvOverlayCount++;
  masterMoves.push({
    id:m.id, slug:m.slug, move_no:m.id,            // ★正規id(独自採番はslug解決で自然に正規化)
    names: cur ? {...m.names, ja: cur.name} : m.names,   // ★T1.5(2): cur.name優先(現行表記維持・consumer互換)
    type:TYPE_JA[m.type]||m.type, category:CAT_JA[m.damage_class]||'変化',
    power:m.power, accuracy:m.accuracy, pp:m.pp, priority:m.priority||0,
    target, contact, protect,
    effects:bd.effects||[], flags, tags,
    battle_data: bd,                                      // ★T1.5(2): battle_data全体(simが読む形・crit_stage/effects/priority等)
    ...(cur && cur.subcategory!==undefined ? {subcategory:cur.subcategory} : {}),  // ★T1.5(2): view用(後でsubcatFromTagsで全国版も)
    ...(cur && cur.mode!==undefined ? {mode:cur.mode} : {}),                        // ★T1.5(2): view用(対戦モード等)
    ...(cur && cur.added!==undefined ? {added:cur.added} : {}),                     // ★T1.5(2): 季情報
    key:m.slug,                                           // ★T1.5(2): master_moves.key(=slug)
    learners: cur ? (cur.learners||[]) : [...(learnersBy[m.slug]||[])],  // ★T1.5(2): cur優先(Champions現行と同一)・無ければlearnset(全国版用)
    description_legacy: cur ? (cur.description_legacy||'') : (MYK[m.slug]||''),  // ★T1.5(2): curated or yakkun fallback
    description_ja,
    is_original:false,
    availability: deriveAvailability(m.id, m.slug),  // ★P8: gen/isNonstandard from Showdown
    champions: cur ? (() => { const ch={in:true, seasons}; const st={}; if((TYPE_JA[m.type]||m.type)!==cur.type) st.type=cur.type; if(m.power!==cur.power) st.power=cur.power; if(m.accuracy!==cur.accuracy) st.accuracy=cur.accuracy; if(m.pp!==cur.pp) st.pp=cur.pp; if(Object.keys(st).length) ch.stats=st; return ch; })() : null,   // ★T1.5(1): PokeAPI値と異なるChampions実値をchampions.stats overlayに(pp392/type2/acc6/power20)
    provenance: prov('moves_master', cur?'pokechan_data+moves_battle_data_fix':(MFIX[m.slug]?'moves_battle_data_fix':null))
  });
}
// ★コインビーム(Champions独自技・moves_masterに無い)を追加
const cb = C.WAZA_MAP['koinbeam'] || Object.values(C.WAZA_MAP).find(w=>w.name==='コインビーム');
if (cb){
  masterMoves.push({
    id:COIN_BEAM_NO, slug:'koinbeam', move_no:COIN_BEAM_NO,
    names:{ja:'コインビーム', en:'Coin Beam'}, type:cb.type||'ノーマル', category:cb.category||'特殊',
    power:cb.power, accuracy:cb.accuracy, pp:cb.pp, priority:cb.priority||0,
    target:cb.target||'1体選択', contact:!!cb.contact, protect:cb.protect!==false,
    effects:(cb.battle_data&&cb.battle_data.effects)||[], flags:cb.flags||{}, tags:cb.tags||[],
    battle_data: cb.battle_data || {crit_stage:0,must_crit:false,crit_changes:[],effects:[]},
    key:'koinbeam',                                   // ★T1.5(2): consumer互換
    learners: cb.learners||[],                         // ★T1.5(2): 現行維持
    description_legacy: cb.description_legacy||'',     // ★T1.5(2): 現行維持
    ...(cb.subcategory!==undefined ? {subcategory:cb.subcategory} : {}),
    ...(cb.mode!==undefined ? {mode:cb.mode} : {}),
    ...(cb.added!==undefined ? {added:cb.added} : {}),  // ★T1.5(2): 季
    description_ja: cb.description||'', is_original:true,
    availability: null,                  // ★P8: Champions独自技=SDに無い→null
    champions:{in:true, seasons:null},  // タスク(4): 根拠なし→null(未確定・空配列と区別)
    provenance: prov('pokechan_data(独自)', null)
  });
}

// ============================================================
// master_abilities.json (311 + 独自2)
// ============================================================
const abJaInMaster = new Set(AB.map(a=>a.names.ja));
const masterAbilities = AB.map(a=>{
  const ja=a.names.ja;
  const effect_ja = C.ABILITY_DESC[ja] || ABDESC[ja] || '';
  const inChamp = !!C.ABILITY_DESC[ja];
  return {
    id:a.id, slug:a.slug, names:a.names,
    effect_ja, effect_en:a.effect_en||'',
    is_original:false, is_linked:false,
    champions: inChamp ? {in:true} : null,
    provenance: prov('abilities_master', inChamp?'pokechan_data.ABILITY_DESC':(ABDESC[ja]?'abilities_desc_ja':null))
  };
});
// ★Champions独自連結特性2件(abilities_masterに無い)
let abOwnCount=0;
Object.keys(C.ABILITY_DESC).forEach(ja=>{
  if (!abJaInMaster.has(ja)){
    masterAbilities.push({
      id: 'c-'+ja, slug:'c-'+ja, names:{ja, en:ja},
      effect_ja: C.ABILITY_DESC[ja], effect_en:'',
      is_original:true, is_linked:true,
      champions:{in:true},
      provenance: prov('pokechan_data.ABILITY_DESC(独自連結)', null)
    });
    abOwnCount++;
  }
});

// ============================================================
// master_items.json (2180 + Champions独自40件 = 2220)
// ============================================================
// Champions所持アイテムslug集合(pokechan_data.js にはitem DBが無い可能性→flags/databaseから。無ければ全in:false)
const champItemJaNames = new Set();
let champItemsDb = null;
try {
  global.window = global.window || {};   // items_database.js は window.ITEMS_DATABASE で定義(node用stub)
  require(path.join(ROOT,'items_database.js'));
  champItemsDb = global.window.ITEMS_DATABASE;
  if (champItemsDb && champItemsDb.items){
    champItemsDb.items.forEach(it=>{ if(it && it.name) champItemJaNames.add(it.name); });  // key(slug独自)でなくname(JA)で結合
  }
}catch(e){ console.log('  [注意] items_database読込: '+e.message); }
const masterItems = IT.map(it=>{
  const inChamp = champItemJaNames.has(it.names.ja);
  return {
    id:it.id, slug:it.slug, names:it.names, category:it.category||'', cost:it.cost!=null?it.cost:0,
    effect_ja:'', effect_en: it.effect_en||'',
    champions: inChamp ? {in:true} : null,
    provenance: prov('items_master', inChamp?'items_database':null)
  };
});
// タスク(2): Champions独自アイテム40件をオーバーレイ追加(items_masterに結合できないもの)
// id予約帯: 90001〜 (items_masterの最大id=10002 と衝突しない)
let itOwnCount = 0;
const itJaInMaster = new Set(IT.map(it=>it.names.ja));
const IT_OWN_BASE_ID = 90001;
if (champItemsDb && champItemsDb.items){
  champItemsDb.items.forEach((it, idx) => {
    if (!it || !it.name) return;
    if (itJaInMaster.has(it.name)) return; // 既に結合済み
    const ownId = IT_OWN_BASE_ID + itOwnCount;
    const names = {ja: it.name};
    if (it.name_en) names.en = it.name_en;
    masterItems.push({
      id: ownId,
      slug: it.key || ('c-item-' + itOwnCount),
      names,
      category: it.category || '',
      cost: 0,
      effect_ja: it.effect || '',
      effect_en: '',
      is_original: true,
      champions: {in: true},
      provenance: prov('pokechan_data(Champions独自)', 'items_database'),
    });
    itOwnCount++;
  });
}

// ============================================================
// 出力 + 突合カウンタ
// ============================================================
const OUT=path.join(ROOT,'reference');
fs.writeFileSync(path.join(OUT,'master_pokemon.json'), JSON.stringify(masterPokemon,null,1)+'\n');
fs.writeFileSync(path.join(OUT,'master_moves.json'),   JSON.stringify(masterMoves,null,1)+'\n');
fs.writeFileSync(path.join(OUT,'master_abilities.json'),JSON.stringify(masterAbilities,null,1)+'\n');
fs.writeFileSync(path.join(OUT,'master_items.json'),   JSON.stringify(masterItems,null,1)+'\n');

// 突合カウンタ(Champions curated の保全確認)
const champP = masterPokemon.filter(p=>p.champions&&p.champions.in).length;
const champM = masterMoves.filter(m=>m.champions&&m.champions.in).length;
const champA = masterAbilities.filter(a=>a.champions&&a.champions.in).length;
const champI = masterItems.filter(i=>i.champions&&i.champions.in).length;
const noDescM = masterMoves.filter(m=>!m.description_ja).length;
// タスク(4): seasons=nullの技件数(根拠なし未確定)
const mvSeasonsNull = masterMoves.filter(m=>m.champions&&m.champions.in&&m.champions.seasons===null).length;
const mvSeasonsSet  = masterMoves.filter(m=>m.champions&&m.champions.in&&m.champions.seasons!==null).length;
console.log('=== master_*.json 生成完了 ===');
console.log(`pokemon: ${masterPokemon.length}件 (Champions in=${champP} / 独自追加=${ownPokeCount} / slug結合=${ownPokeSlugMatched} / JAのみ=${ownPokeJaOnly})`);
console.log(`moves  : ${masterMoves.length}件 (Champions in=${champM} / overlay適用=${mvOverlayCount} / コインビーム独自=1 / effects源MFIX=${Object.keys(MFIX).length})`);
console.log(`abilities: ${masterAbilities.length}件 (Champions in=${champA} / 独自連結=${abOwnCount})`);
console.log(`items  : ${masterItems.length}件 (Champions in=${champI} / 独自追加=${itOwnCount})`);
console.log(`★compose再生成: description_ja空=${noDescM}件 (0が理想)`);
console.log(`★Champions curated 保全: 技overlay=${mvOverlayCount}(期待=Champions WAZA_MAP件数に概ね一致)`);
console.log(`★(T4)技seasons: null(根拠なし)=${mvSeasonsNull}件 / 設定あり=${mvSeasonsSet}件 (WAZA_MAPにadded_in無し→全技null=正常)`);
console.log(`★(T3)独自ポケslug結合: ${ownPokeSlugMatched}件多言語名取得 / ${ownPokeJaOnly}件JAのみ(真の独自フォーム)`);
// ★P8: availability 分布サマリ
const avGen={}, avPast=[], avLgpe=[], avNull=[], avNonstd=[];
masterMoves.forEach(m=>{
  const av=m.availability;
  if(!av){avNull.push(m.slug||m.names?.ja);return;}
  if(av.is_lgpe){avLgpe.push(m.names?.ja||m.slug);return;}
  if(av.is_nonstandard){avNonstd.push(m.names?.ja||m.slug+':'+av.is_nonstandard);return;}
  if(av.gens && av.gens[av.gens.length-1]<9) avPast.push(m.names?.ja||m.slug);
  const g=av.gen_introduced||0; avGen[g]=(avGen[g]||0)+1;
});
console.log('★(P8)availability: gen分布='+JSON.stringify(Object.keys(avGen).sort((a,b)=>a-b).reduce((o,k)=>{o['Gen'+k]=avGen[k];return o;},{})));
console.log(`★(P8)  Past技(Gen8まで)=${avPast.length} / LGPE専用=${avLgpe.length} / 特殊(Gigantamax等)=${avNonstd.length} / null(SD未結合)=${avNull.length}`);
console.log(`★(P8)  Past技例: ${avPast.slice(0,10).join(', ')}`);
console.log(`★(P8)  null技: ${avNull.join(', ')}`);
