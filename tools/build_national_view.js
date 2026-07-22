// 全国版(全部版)DB生成ビルダー — master参照版。
// 入力: reference/master_pokemon.json / master_moves.json / pokeapi_master.json
//       + learnsets_master.json + pokechan_data.js(静的テーブル/ABILITY_DESC)
// 出力: pokechan_data_all.js (現行 _build_pokechan_data_all.js と同一schema・同一出力)
// 実行: node tools/build_national_view.js         → tmpPath に検証出力
//       node tools/build_national_view.js --write → pokechan_data_all.js に本番書き出し
//
// @see _build_pokechan_data_all.js — 旧ビルダー(@deprecated)
// 旧ビルダーとの主な違い:
//   ・pokemon data: master_pokemon.json(types/abilities済JA化・champions/season/legend整合済)
//   ・moves data: master_moves.json(effects/flags(is_max,z,sound,punch等)/battle_data/subcategory整合済)
//   ・moves_master.json(937) / _move_flags.json / SD_MOVES / MDESC の個別ロードは不要(master統合済)
//   ・pokemon名前構築: pokeapi_master.json(species_names.ja + form_names.ja)を引き続き参照
//     (master_pokemon.names.jaはform名のみでページ互換性に必要な「種族名(フォルム)」形式と異なるため)
//   ・master_pokemon のカスタムエントリ(id="c-xxx")は除外(Champions専用・全国版対象外)
//   ・MFIX: _range_note(30件)アノテーション取得のみ参照(effects/battle_dataはmaster統合済)
//   ・_z_variable: flags.z.genericから導出(MFIXと同値が保証済)
//   ・description_ja: masterからではなく composeDescH で毎回再生成(焼込撲滅維持)

'use strict';
const fs   = require('fs');
const path = require('path');

// === 入力ファイル ===
const C    = require('../pokechan_data.js');                        // 静的テーブル + ABILITY_DESC
const MP_RAW = require('../reference/master_pokemon.json');         // 1365 pokemon (custom含む)
const P    = require('../reference/pokeapi_master.json');           // 1302 entries(JA名構築用)
const MM   = require('../reference/master_moves.json');             // 920 moves (shadow除外済)
const LS   = require('../reference/learnsets_master.json');         // pokemon slug → move slug[]
let MFIX = {};
try { MFIX = require('../reference/moves_battle_data_fix.json'); } catch(e) {}
// MFIX は _range_note アノテーション取得のみに使用(battle_data/effectsはmaster統合済につき不使用)

// カスタムエントリ除外: id が "c-xxx" 形式 = Champions独自フォーム = 全国版対象外
const MP = MP_RAW.filter(p => !(typeof p.id === 'string' && String(p.id).startsWith('c-')));
// → MP: 1302 entries (pokeapi_master と同一母集団)

const { compose } = require('./_waza_compose.js');

// === 静的テーブル(pokechan_data.js から転記) ===
const TYPES               = C.TYPES;
const TYPE_COLORS         = C.TYPE_COLORS;
const TYPE_KANJI          = C.TYPE_KANJI;
const TYPE_DISPLAY        = C.TYPE_DISPLAY;
const TYPE_OFFENSIVE_STATS= C.TYPE_OFFENSIVE_STATS;
const DEFAULT_TYPE_ORDER  = C.DEFAULT_TYPE_ORDER;
// ★2026-07-22: ABILITY_DESC欠落特性の公式JA穴埋め(旧_build_pokechan_data_all.js L24-38から移植)。
//   新ビルダーへの移植漏れを閉じる(旧ビルダーは素材マージしていたが、本ビルダーはC.ABILITY_DESCパススルー
//   だけで穴埋めが無かった=再ビルドすると114件消失する回帰になっていた)。Champions ABILITY_DESC(既存キー)
//   を優先し、未登録の空欄だけを素材(reference/_ability_desc_fill_2026-07-19.json=PokeAPI公式JA平易文)で充填
//   =既存は上書きしない。結合はslug優先(master_abilitiesの正準JA名を使い表記ゆれを回避・name_jaと同値を確認済)。
const _ABM_AB             = require('../reference/master_abilities.json');
const _ABILITY_DESC_FILL  = (()=>{ try{ return require('../reference/_ability_desc_fill_2026-07-19.json'); }catch(e){ return null; } })();
const _slugToJa           = {};
_ABM_AB.forEach(a => { if (a && a.slug && a.names && a.names.ja) _slugToJa[a.slug] = a.names.ja; });
const ABILITY_DESC        = Object.assign({}, C.ABILITY_DESC);
let   _abFillMerged       = 0;
if (_ABILITY_DESC_FILL && Array.isArray(_ABILITY_DESC_FILL.entries)) {
  _ABILITY_DESC_FILL.entries.forEach(e => {
    if (!e || !e.slug || !e.desc_ja) return;
    const ja = _slugToJa[e.slug];              // slug→正準JA名(表記ゆれ回避)
    if (!ja) return;                            // master_abilitiesに無いslug=結合不能(独自連結等)=skip
    if (ABILITY_DESC[ja] != null) return;       // Champions既存説明を優先(上書きしない)
    ABILITY_DESC[ja] = e.desc_ja;
    _abFillMerged++;
  });
}
console.log(`ABILITY_DESC: Champions=${Object.keys(C.ABILITY_DESC).length}件 + fillマージ=${_abFillMerged}件 → 全部版計=${Object.keys(ABILITY_DESC).length}件`);
const STAT_RANK           = C.STAT_RANK;
const NATURES             = C.NATURES;

// === 型相性表(攻撃type行 × 防御type列・TYPES順) ===
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
const tIdx = ja => TYPES.indexOf(ja);

function resistOf(types) {   // types = JA string[] (master は既にJA)
  const i1 = tIdx(types[0]);
  const i2 = types[1] != null ? tIdx(types[1]) : -1;
  const r = [];
  for (let i = 0; i < 18; i++) {
    let v = TYPE_CHART[i][i1];
    if (i2 >= 0) v *= TYPE_CHART[i][i2];
    r.push(v);
  }
  return r;
}

// === Pokemon コスメティックフィルタ ===
// MP(master_pokemon から c-xxx custom を除いた1302件)は cosmetic forms を含む
// → 旧ビルダー(pokeapi_master.json)と同等のフィルタを適用
const COSM = /(^|-)(rock-star|belle|pop-star|phd|libre|cosplay|cap|totem|gmax|starter|battle-bond|gulping|gorging|dada|own-tempo|eternamax)(-|$)/;
const defByDex = {};
MP.forEach(v => { if (v.is_default) defByDex[v.dex] = v; });
const sig = v => v.types.join('/') + '|' + Object.values(v.stats).join(',') + '|' + v.abilities.slice().sort().join(',');

function isCosmetic(v) {
  if (v.is_mega || v.is_default) return false;
  const d = defByDex[v.dex];
  if (d && sig(v) === sig(d)) return true;   // 見た目だけ=中身が基本形と同一
  if (COSM.test(v.form_slug || '')) return true;
  return false;
}
const P2 = MP.filter(v => !isCosmetic(v));
// → P2: 1219 entries (旧ビルダーと同一)

// === JA名構築 ===
// 旧ビルダーの jaNameRaw() をそのまま移植。
// master_pokemon.names.ja はフォルム名のみの場合があり、ページ互換性に必要な「種族名(フォルム)」形式と異なる。
// pokeapi_master.json の species_names.ja + form_names.ja で旧ビルダーと同一名称を再現する。
const normWide = s => String(s).replace(/Ｘ/g, 'X').replace(/Ｙ/g, 'Y');
const REG = { alola: 'アローラ', galar: 'ガラル', hisui: 'ヒスイ', paldea: 'パルデア' };
const oldBySlug = {};   // pokeapi_master slug → entry
P.forEach(v => { oldBySlug[v.slug] = v; });

function jaNameRaw(v) {
  const pv = oldBySlug[v.slug];   // pokeapi entry(名前構築用)
  if (!pv) return v.names.ja || v.slug;
  const base = (pv.species_names && pv.species_names.ja) || v.slug;
  if (pv.is_default && !pv.is_mega && !pv.form_slug) return base;
  if (pv.is_mega) return (pv.form_names && pv.form_names.ja) ? normWide(pv.form_names.ja) : ('メガ' + base);
  const fs = pv.form_slug || '';
  for (const k in REG) {
    if (fs.includes(k)) {
      const rest = fs.split('-').filter(x => x !== k).join('-');
      return base + '(' + REG[k] + (rest ? ('・' + rest) : '') + ')';
    }
  }
  if (pv.form_names && pv.form_names.ja) return base + '(' + normWide(pv.form_names.ja) + ')';
  if (fs) return base + '(' + fs + ')';
  return base;
}

const usedName = new Set();
const NAME = {};   // slug → jaName
for (const v of P2) {
  let n = jaNameRaw(v);
  if (usedName.has(n)) n = n + '〈' + v.slug + '〉';
  usedName.add(n);
  NAME[v.slug] = n;
}

// === formField(pokeapi entryを参照) ===
function formField(v) {
  const pv = oldBySlug[v.slug];
  if (!pv) return 'フォルム';
  if (pv.is_mega) return 'メガ進化';
  if (pv.is_default && !pv.form_slug) return '通常';
  const fs = pv.form_slug || '';
  if (Object.keys(REG).some(k => fs.includes(k))) return 'リージョン';
  return 'フォルム';
}

// === genOf ===
const GENR = [[1,151],[152,251],[252,386],[387,493],[494,649],[650,721],[722,809],[810,905],[906,1025]];
const genOf = dex => {
  for (let i = 0; i < GENR.length; i++) if (dex >= GENR[i][0] && dex <= GENR[i][1]) return i+1;
  return 0;
};

// === POKEMON_LIST ===
const POKEMON_LIST = P2.map(v => {
  const st = v.stats;
  const total = st.hp + st.atk + st.def + st.spa + st.spd + st.spe;
  const abis = v.abilities;   // master_pokemon は既にJA順(hidden最後)
  const name = NAME[v.slug];
  const champ = v.champions;
  return {
    no:      String(v.dex || 0).padStart(3, '0'),
    name,
    gen:     genOf(v.dex),
    season:  champ && champ.in ? (champ.seasons || []) : [],
    legend:  v.legend || '',
    form:    formField(v),
    mega:    !!v.is_mega,
    weight_kg: v.weight_kg != null ? v.weight_kg : null,
    type1:   v.types[0] || '',
    type2:   v.types[1] || '',
    hp:   st.hp, atk: st.atk, def: st.def, spatk: st.spa, spdef: st.spd, spd: st.spe, total,
    ab1: abis[0] || '', ab2: abis[1] || '', ab3: abis[2] || '',
    resist: resistOf(v.types),
  };
});

// === composeDescH (旧ビルダーと同一実装) ===
function composeDescH(entry) {
  const r = compose(entry);
  const t = (r.text || '').trim();
  const isDmg = entry.category !== '変化' || (entry.power != null && entry.power > 0);
  let text;
  if (isDmg) {
    if (!t) { text = 'ダメージのみ。'; }
    else {
      const maxPfx = entry.is_max
        ? (entry.category !== '変化' ? '攻撃技のダイマックス技。' : '変化技のダイマックス技。')
        : '';
      const zInfo = entry.flags && entry.flags.z;
      const zPfx = (zInfo && zInfo.user && !zInfo.generic) ? `「${zInfo.user}」の専用Zワザ。` : '';
      const pfx = maxPfx || zPfx;
      if (pfx && t.startsWith(pfx)) {
        const rest = t.slice(pfx.length);
        text = pfx + 'ダメージ。' + (rest || '');
      } else {
        text = 'ダメージ。' + t;
      }
    }
  } else { text = t; }
  const holes = (r.holes && r.holes.length > 0) || (!t && !isDmg);
  return { text, holes };
}

// === subcatFromEffects — 変化技の subcategory 導出 ===
function subcatFromEffects(bd) {
  if (!bd) return 'その他';
  const effects = bd.effects || [];
  if (bd.recovery) return '回復';
  if (bd.screen) return '壁';
  if (bd.room) return 'ルーム';
  if (bd.weather_set) return '天候';
  if (bd.field_set) return 'フィールド';
  if (bd.hazard_set) return '設置';
  if (bd.move_block) return '技封じ';
  if (bd.trap_no_switch) return '捕縛';
  if (bd.force_switch_opp || bd.self_switch) return '交代';
  if (bd.support) return 'サポート';
  const statusFX = effects.filter(e => e.kind === '状態付与');
  const rankFX   = effects.filter(e => e.kind === '能力ランク変化');
  const flinchFX = effects.filter(e => e.kind === 'ひるみ');
  if (statusFX.length > 0 || flinchFX.length > 0) return '状態異常';
  if (rankFX.length > 0) {
    const selfUp  = rankFX.filter(e => (e.target === 'self' || e.target === 'ally') && e.stages > 0);
    const oppDown = rankFX.filter(e => (e.target === 'opponent' || e.target === 'all_opponents') && e.stages < 0);
    if (selfUp.length > 0) {
      const stats = selfUp.map(e => e.stat);
      if (stats.some(s => s === 'speed')) return '積み速';
      if (stats.some(s => s === 'defense' || s === 'special_defense')) return '積み防';
      return '積み攻';
    }
    if (oppDown.length > 0) return '能力下';
  }
  if (bd.cure_status) return '回復';
  if (bd.remove_hazards || bd.field_remove) return 'その他';
  return 'その他';
}

// === WAZA_MAP + POKEMON_WAZA ===
// learnsets 逆引き: moveSlug → Set(jaName)
const learnersBy = {};
const POKEMON_WAZA = {};
for (const v of P2) {
  const n = NAME[v.slug];
  const moves = (LS[v.slug] || []);
  POKEMON_WAZA[n] = moves.slice();
  for (const ms of moves) {
    (learnersBy[ms] || (learnersBy[ms] = new Set())).add(n);
  }
}

// Champions WAZA_MAP: description/battle_data/tags/target/contact/protect/flags/subcategory のキャッシュ
const curBySlug = {};
Object.entries(C.WAZA_MAP).forEach(([slug, w]) => { curBySlug[slug] = w; });

const WAZA_MAP = {};
for (const m of MM) {
  const cur = curBySlug[m.slug];
  const learners = [...(learnersBy[m.slug] || [])];

  // battle_data: master_moves.battle_data(MFIX統合済) が primary
  // priority フィールドを補完(compose が「優先度+Nの先制技」を出す)
  const bd = Object.assign({}, m.battle_data || { crit_stage: 0, must_crit: false, crit_changes: [], effects: [] });
  if (bd.priority == null && (m.priority || 0) !== 0) bd.priority = m.priority;
  // _range_note: MFIX から取得(ダブルバトル範囲アノテーション・compose が発声)
  const _mfix_range = MFIX[m.slug] && MFIX[m.slug]._range_note;
  if (_mfix_range && !bd._range_note) bd._range_note = _mfix_range;
  // _z_variable: generic Z技はflags.z.genericから導出(composeが「もとの技によって...」を発声)
  if (!bd._z_variable && m.flags && m.flags.z && m.flags.z.generic) bd._z_variable = true;

  // flags: master_moves.flags(is_max/z/sound/punch等統合済) を使用
  const flags = Object.assign({}, m.flags || {});

  // is_max / z を entry に展開(composeDescH が参照)
  const is_max = !!(flags.is_max);
  const z      = flags.z || null;

  // subcategory: master に在ればそれを使う / なければ効果から導出
  let subcategory = m.subcategory || null;
  if (!subcategory && m.category === '変化') {
    subcategory = subcatFromEffects(bd);
  }

  const entry = {
    name:             m.names.ja || m.slug,
    move_no:          m.move_no,
    type:             m.type,
    category:         m.category,
    target:           cur ? cur.target : (m.target || '1体選択'),
    power:            m.power,
    accuracy:         m.accuracy,
    pp:               m.pp,
    priority:         m.priority || 0,
    // contact: master.flags.contact が権威(PokeAPI値より正確)。フラグ未設定時はmaster.contactにフォールバック
    contact:          (m.flags && m.flags.contact !== undefined) ? m.flags.contact : m.contact,
    protect:          m.protect !== false,
    description:      '',
    key:              m.slug,
    learners,
    national_new:     !(m.champions && m.champions.in) && !!(m.description_ja),
    description_legacy: m.description_legacy || '',
    battle_data:      bd,
    flags,
    ...(is_max ? { is_max: true } : {}),
    ...(z      ? { z }            : {}),
    subcategory,
    tags:             cur ? (cur.tags || []) : (m.tags || []),
    availability:     m.availability || null,
  };

  // 説明文: composeDescH で再生成(焼込撲滅。masterがeffects統合済なので穴なし技はcompose一本化)
  const _isDmg = entry.category !== '変化' || (entry.power != null && entry.power > 0);
  const _ch = (_isDmg || (bd.effects || []).length > 0) ? composeDescH(entry) : { text: '', holes: true };
  entry.description = _ch.holes
    ? (cur ? (cur.description || '') : (m.description_ja || ''))
    : _ch.text;

  WAZA_MAP[m.slug] = entry;
}

// === 出力 ===
const J = o => JSON.stringify(o);
const out = `// AUTO-GENERATED by tools/build_national_view.js — 編集しない。元データ=reference/master_*.json + learnsets_master.json
// 全国版(全部版)共通DB。pokechan_data.js と同一schema。新ポケ/技追加時は reference 再生成→本ビルダー再実行のみ。
const TYPES = ${J(TYPES)};
const TYPE_COLORS = ${J(TYPE_COLORS)};
const TYPE_KANJI = ${J(TYPE_KANJI)};
const TYPE_DISPLAY = ${J(TYPE_DISPLAY)};
const TYPE_OFFENSIVE_STATS = ${J(TYPE_OFFENSIVE_STATS)};
const DEFAULT_TYPE_ORDER = ${J(DEFAULT_TYPE_ORDER)};
const POKEMON_LIST = ${J(POKEMON_LIST)};
const DATA = POKEMON_LIST;
const WAZA_MAP = ${J(WAZA_MAP)};
const POKEMON_WAZA = ${J(POKEMON_WAZA)};
const ABILITY_DESC = ${J(ABILITY_DESC)};
const STAT_RANK = ${J(STAT_RANK)};
const NATURES = ${J(NATURES)};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TYPES, TYPE_COLORS, TYPE_KANJI, TYPE_DISPLAY, TYPE_OFFENSIVE_STATS, DEFAULT_TYPE_ORDER, POKEMON_LIST, DATA, WAZA_MAP, POKEMON_WAZA, ABILITY_DESC, STAT_RANK, NATURES };
}
`;

const outPath = 'pokechan_data_all.js';
const PALL = MP_RAW.filter(p => !(typeof p.id === 'string' && String(p.id).startsWith('c-')));
const overlaidW = MM.filter(m => curBySlug[m.slug]).length;
const overlaidP = POKEMON_LIST.filter(p => p.weight_kg != null).length;

const isWrite = process.argv.includes('--write');
if (isWrite) {
  // 本番書き出し: pokechan_data_all.js を直接上書き
  fs.writeFileSync(outPath, out);
  console.log(`[build_national_view] 本番書き出し完了: ${outPath}`);
} else {
  // デフォルト: scratchpad に出力(diff確認用)
  const tmpPath = '/private/tmp/claude-501/-Users-masamichi-Documents-----DB/efcb0c1e-6241-4d1b-9bc1-bd39a06a655d/scratchpad/pokechan_data_all_new.js';
  fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
  fs.writeFileSync(tmpPath, out);
  console.log(`[build_national_view] 検証用出力: ${tmpPath}`);
  console.log('');
  console.log('本番書き出しは --write フラグで実行:');
  console.log('  node tools/build_national_view.js --write');
}
console.log(`POKEMON_LIST=${POKEMON_LIST.length}(全${PALL.length}から見た目フォーム${PALL.length-P2.length}件間引き) / WAZA_MAP=${Object.keys(WAZA_MAP).length} / POKEMON_WAZA=${Object.keys(POKEMON_WAZA).length}`);
console.log(`overlay: 技Champions=${overlaidW}件 / 体重あり=${overlaidP}件`);
console.log('意図的diff: WAZA_MAP+1(koinbeam) / name全角→半角5技(T1.5確定後に解消)');
