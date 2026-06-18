/* ===================================================================
 * waza_picker.js — 技選択 UI 共通ロジック
 *
 * 出自: waza-list.html の inline <script> (2026-05-17 抽出)
 * 利用: waza-list.html / party_checker.html / battle_simulator.html
 *
 * 現状: waza-list の JS をそのまま移動 (機能等価性 fast path)。
 *       後続フェーズで mountWazaPicker(container, options) 形式に
 *       関数化して mode (browse/multi/single) を導入予定。
 *
 * 依存: pokechan_data.js (WAZA_MAP, POKEMON_LIST) を事前に読み込み必須
 *       i18n/runtime.js (任意)
 * =================================================================== */

// 独立アクセス版: pokechan_data.js から動的にデータ構築
const POKEMON_DB_URL = 'pokemon_db_v9.html';
const WP_QUERY = new URLSearchParams(location.search);
let INITIAL_POKEMON_FILTER = WP_QUERY.get('pokemon') || null;
// === ピッカーモード関連 (iframe 経由で親から URL クエリで指定) ===
//   mode=browse  (default) : 閲覧のみ
//   mode=multi             : チェックボックス + 確定ボタン (party_checker 用)
//   mode=single            : 行クリックで即選択 (battle_simulator 用)
//   lock=1                 : ポケモン選択トリガーをロック (defaultPokemon 固定)
//   initial=k1,k2,...      : multi モード時の初期チェック技 key
//   slot=1                 : multi/single の何番目のスロット (タイトル表示用)
const WP_MODE = WP_QUERY.get('mode') || 'browse';
const WP_LOCK_POKEMON = WP_QUERY.get('lock') === '1';
const WP_SLOT_NO = WP_QUERY.get('slot') || '';
const WP_INITIAL_SELECTED = (WP_QUERY.get('initial') || '').split(',').filter(Boolean);
let WP_SELECTED = new Set(WP_INITIAL_SELECTED);
let wpCheckedOnly = false;   // 「チェック中のみ表示」フィルタ (multi)

// 選択操作メニュー (グレーのフィルタ行: ☑▾)
function toggleSelMenu(e) {
  if (e) e.stopPropagation();
  const pop = document.getElementById('wp-selmenu-pop');
  if (pop) pop.classList.toggle('vis');
}
function closeSelMenu() {
  const pop = document.getElementById('wp-selmenu-pop');
  if (pop) pop.classList.remove('vis');
}
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('wp-selmenu');
  if (wrap && !wrap.contains(e.target)) closeSelMenu();
});

// i18n: タイプ名 3 文字短縮表記 (types-master.json の short3 を優先、未ロード時は full → slice(0,3))
// pokemon_db_v9.html の type3() と同パターン
function wpType3(t) {
  if (!t) return '';
  if (window.I18N && I18N.type) {
    const s = I18N.type(t, 'short3');
    if (s && s !== t) return s;
    const tr = I18N.type(t);
    if (tr && tr !== t) return tr.slice(0, 3);
  }
  return t;
}

// WAZA_MAP → WAZA_MASTER 変換 (pokemon_db_v9.html と同じアダプタ)
const WAZA_MASTER_BUILT = (function () {
  const out = [];
  for (const k in WAZA_MAP) {
    const m = WAZA_MAP[k];
    const cls = m.category;
    out.push({
      key: m.key, name: m.name, type: m.type, class: cls,
      power: m.power == null ? "-" : String(m.power),
      acc: m.accuracy == null ? "-" : String(m.accuracy),
      pp: m.pp == null ? "" : String(m.pp),
      contact: m.contact ? "接○" : "接×",
      guard: m.protect ? "守○" : "守×",
      target: m.target,
      mode: m.mode || "両方",
      category: m.subcategory || cls,
      effect: m.description,
      added: m.added !== undefined ? m.added : true,
      flags: m.flags || {},
    });
  }
  return out;
})();

// learners + priority を付与
const _pokeTotal = {};
POKEMON_LIST.forEach(p => { _pokeTotal[p.name] = p.total || 0; });
const _extractPriority = (desc) => {
  if (!desc) return 0;
  // 「優先度:N」「優先度+N」「優先度+1の先制技」など、:省略形にも対応
  const m = desc.match(/優先度[:：]?\s*([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};
const moves = WAZA_MASTER_BUILT.map(w => {
  const learnerNames = (WAZA_MAP[w.key] && WAZA_MAP[w.key].learners) || [];
  const learners = learnerNames
    .map(name => ({ name, total: _pokeTotal[name] || 0 }))
    .sort((a, b) => b.total - a.total);
  const legacy = (WAZA_MAP[w.key] && WAZA_MAP[w.key].description_legacy) || '';
  const tags = (WAZA_MAP[w.key] && WAZA_MAP[w.key].tags) || [];
  const battle_data = (WAZA_MAP[w.key] && WAZA_MAP[w.key].battle_data) || null;
  return Object.assign({}, w, { learners, priority: _extractPriority(w.effect), _legacy_desc: legacy, tags, battle_data });
});
const typeColors ={"ノーマル": "#A8A878", "ほのお": "#F08030", "みず": "#6890F0", "でんき": "#F8D030", "くさ": "#78C850", "こおり": "#98D8D8", "かくとう": "#C03028", "どく": "#A040A0", "じめん": "#E0C068", "ひこう": "#A890F0", "エスパー": "#F85888", "むし": "#A8B820", "いわ": "#B8A038", "ゴースト": "#705898", "ドラゴン": "#7038F8", "あく": "#705848", "はがね": "#B8B8D0", "フェアリー": "#EE99AC"};

// カタカナ ⇔ ひらがな 相互変換（どちらで検索してもヒット）
function toHira(s) {
  return (s || '').toLowerCase().replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}
// \u8868\u793A\u8A00\u8A9E\u3067\u306E\u6280\u540D (ja or \u73FE\u5728\u8A00\u8A9E)
function moveDisplayName(m) {
  return (window.I18N && I18N.move) ? I18N.move(m.key, m.name) : m.name;
}
// \u691C\u7D22\u7167\u5408\u7528: \u65E5\u672C\u8A9E\u540D\uFF0B\u8868\u793A\u8A00\u8A9E\u540D\u3092\u6B63\u898F\u5316\u3057\u3066\u7D50\u5408 (\u82F1\u8A9EUI\u3067\u82F1\u540D\u691C\u7D22\u306B\u5BFE\u5FDC)
function moveSearchKey(m) {
  return toHira(m.name) + '' + toHira(moveDisplayName(m));
}

let sortKey = 'power';
let sortDir = -1;   // 初期表示: 威力の高い順 (威力なし=変化技は末尾)

// ===== タイプ複数選択フィルター =====
let selectedTypes = new Set();

// ===== 効果フィルター状態管理 =====
const activeEfFilters = {
  flag: new Set(),
  status: new Set(),
  self_up2: new Set(),   // 自分のランク 2段階以上アップ
  self_up1: new Set(),   // 自分のランク 1段階アップ
  opp_down2: new Set(),  // 相手のランク 2段階以上ダウン
  opp_down1: new Set(),  // 相手のランク 1段階ダウン
  self_down2: new Set(), // 自分のランク 2段階以上ダウン (副作用)
  self_down1: new Set(), // 自分のランク 1段階ダウン (副作用)
  target: new Set(),     // 対象 (相手全体/自分以外/味方/場)
  misc: new Set(),
  exclude: new Set(),    // 除外: フラグキー (charge/recharge/ohko 等)
};

function toggleEffectFilter() {
  const panel = document.getElementById('effectFilterPanel');
  const btn = document.getElementById('ef-toggle-btn');
  panel.classList.toggle('collapsed');
  btn.textContent = panel.classList.contains('collapsed')
    ? '🔍 効果フィルター ▼'
    : '🔍 効果フィルター ▲';
}

// ===== i18n ヘルパー (テーブル列データの言語化) =====
const I18N_CLASS_MAP = {'物理':'category.physical','特殊':'category.special','変化':'category.status'};
const I18N_CONTACT_MAP = {'接○':'waza.opt_contact_yes','接×':'waza.opt_contact_no'};
const I18N_GUARD_MAP = {'守○':'waza.opt_guard_yes','守×':'waza.opt_guard_no'};
const I18N_CATEGORY_MAP = {
  '物理':'db.cat_phys','特殊':'db.cat_spec','状態異常':'db.cat_status',
  '回復':'db.cat_recover','能力下':'db.cat_lower','天候':'db.cat_weather',
  '混乱メロ':'db.cat_charm','特性変':'db.cat_ability','サポート':'db.cat_support',
  '防御':'db.cat_defense','積み防':'db.cat_setup_def','積み攻':'db.cat_setup_atk',
  '積み速':'db.cat_setup_spd','壁':'db.cat_wall','フィールド':'db.cat_field',
  'ルーム':'db.cat_room','技封じ':'db.cat_lock','捕縛':'db.cat_trap',
  '交代':'db.cat_switch','タイプ変':'db.cat_type','道具':'db.cat_item',
  '設置':'db.cat_hazard','その他':'db.cat_misc',
};
function _t(key, fb) { return (window.I18N) ? I18N.t(key, fb) : fb; }
function tClass(c) { return c && I18N_CLASS_MAP[c] ? _t(I18N_CLASS_MAP[c], c) : c; }
function tTarget(t) { return t ? _t('targets.' + t, t) : t; }
function tMode(m) { return (m === 'ダブル') ? _t('waza.opt_double', 'ダブル') : m; }
function tContact(c) { return c && I18N_CONTACT_MAP[c] ? _t(I18N_CONTACT_MAP[c], c) : c; }
function tGuard(g) { return g && I18N_GUARD_MAP[g] ? _t(I18N_GUARD_MAP[g], g) : g; }
function tCategory(c) { return c && I18N_CATEGORY_MAP[c] ? _t(I18N_CATEGORY_MAP[c], c) : c; }
function tLearnersCount(n) { return _t('waza.learners_count', `${n}匹`).replace('{n}', n); }

// 検索モード (OR デフォルト / AND オプション)
let filterMode = 'OR';
function toggleFilterMode() {
  filterMode = (filterMode === 'OR') ? 'AND' : 'OR';
  const btn = document.getElementById('ef-mode-btn');
  const key = (filterMode === 'AND') ? 'waza.search_mode_and' : 'waza.search_mode_or';
  const fb = (filterMode === 'AND') ? '🔗 検索: AND' : '🔀 検索: OR';
  btn.setAttribute('data-i18n', key);
  btn.textContent = (window.I18N ? I18N.t(key, fb) : fb);
  btn.classList.toggle('and-on', filterMode === 'AND');
  render();
}

// 選択モード (single デフォルト / multi オプション)
let selectMode = 'single';
function toggleSelectMode() {
  selectMode = (selectMode === 'single') ? 'multi' : 'single';
  const btn = document.getElementById('ef-select-mode-btn');
  const key = (selectMode === 'single') ? 'waza.select_mode_single' : 'waza.select_mode_multi';
  const fb = (selectMode === 'single') ? '📌 シングル選択' : '📚 複数選択';
  btn.setAttribute('data-i18n', key);
  btn.textContent = (window.I18N ? I18N.t(key, fb) : fb);
  btn.classList.toggle('single-on', selectMode === 'single');
  // シングルモードに切り替えた時、現在選択中のチップが2個以上あるなら全部クリアする
  // (シングル動作の整合性のため)
  if (selectMode === 'single') {
    let total = 0;
    Object.values(activeEfFilters).forEach(s => total += s.size);
    if (total > 1) {
      Object.values(activeEfFilters).forEach(s => s.clear());
      document.querySelectorAll('.ef-chip').forEach(c => {
        c.classList.remove('active', 'active-status', 'active-up', 'active-down', 'active-misc', 'active-exclude');
      });
    }
  }
  render();
}

function toggleEfChip(el) {
  const type = el.dataset.efType;
  const val = el.dataset.efVal;
  const wasActive = activeEfFilters[type].has(val);

  // シングルモード: 既に他のチップがアクティブなら全部クリアしてから今のだけ立てる
  if (selectMode === 'single') {
    // まず全クリア
    Object.values(activeEfFilters).forEach(s => s.clear());
    document.querySelectorAll('.ef-chip').forEach(c => {
      c.classList.remove('active', 'active-status', 'active-up', 'active-down', 'active-misc', 'active-exclude');
    });
    if (!wasActive) {
      // 今クリックしたものをアクティブ化
      activeEfFilters[type].add(val);
      const cls = type === 'status' ? 'active-status'
                 : (type === 'self_up2' || type === 'self_up1') ? 'active-up'
                 : (type === 'opp_down2' || type === 'opp_down1') ? 'active-down'
                 : (type === 'self_down2' || type === 'self_down1') ? 'active-down'
                 : type === 'target' ? 'active'
                 : type === 'misc' ? 'active-misc'
                 : type === 'exclude' ? 'active-exclude'
                 : 'active';
      el.classList.add(cls);
    }
  } else {
    // 複数選択モード (デフォルト): トグル
    if (wasActive) {
      activeEfFilters[type].delete(val);
      el.classList.remove('active', 'active-status', 'active-up', 'active-down', 'active-misc', 'active-exclude');
    } else {
      activeEfFilters[type].add(val);
      const cls = type === 'status' ? 'active-status'
                 : (type === 'self_up2' || type === 'self_up1') ? 'active-up'
                 : (type === 'opp_down2' || type === 'opp_down1') ? 'active-down'
                 : (type === 'self_down2' || type === 'self_down1') ? 'active-down'
                 : type === 'target' ? 'active'
                 : type === 'misc' ? 'active-misc'
                 : type === 'exclude' ? 'active-exclude'
                 : 'active';
      el.classList.add(cls);
    }
  }
  render();
}

// MISC_TAG: 技 → bool 判定関数群 (battle_data ベース)
function _miscTagJudges(m) {
  const bd = m.battle_data || {};
  const prio = (typeof m.priority === 'number') ? m.priority : null;
  return {
    '回復のみ':       () => bd.recovery && bd.recovery !== 'status_only',
    'ダメージ回復':   () => !!bd.drain,
    '急所':           () => bd.crit_stage >= 1,
    '必中急所':       () => bd.must_crit === true,
    '必中':           () => bd.must_hit === true,
    '連続':           () => !!bd.multi_hit && bd.multi_hit !== 'thrash',
    'あばれ状態':     () => bd.multi_hit === 'thrash',
    '先制':           () => prio !== null && prio > 0,
    '後攻':           () => prio !== null && prio < 0,
    'バインド':       () => bd.bind === true,
    '交代':           () => bd.force_switch_opp === true,
    '自交代':         () => bd.self_switch === true,
    '交代不可':       () => bd.trap_no_switch === true,
    '反動':           () => !!bd.recoil && bd.recoil !== 'on_miss',
    '失敗ダメージ':   () => bd.recoil === 'on_miss',
    '天候変更':       () => !!bd.weather_set,
    'フィールド変更': () => !!bd.field_set,
    'まきびし系':     () => !!bd.hazard_set,
    '追い風':         () => bd.tailwind === true,
    '重力':           () => bd.gravity === true,
    'ワイガファガ':   () => bd.protect_wide === true || bd.protect_fast === true,
    'まもる貫通':     () => bd.protect_pierce === true,
    '瀕死技':         () => bd.self_faint === true,
    'ため技':         () => !!bd.charge,
    '再使用不可':     () => bd.recharge === true,
    '壁':             () => !!bd.screen,
    'ルーム':         () => !!bd.room,
    '技封じ':         () => !!bd.move_block,
    'サポート':       () => bd.support === true,
    'ランク操作':     () => !!bd.rank_op,
    '設置解除':       () => bd.remove_hazards === true,
    'フィールド破壊': () => bd.field_remove === true,
    '壁破壊':         () => Array.isArray(bd.unlock) && bd.unlock.includes('screen'),
    '防御貫通':       () => Array.isArray(bd.unlock) && bd.unlock.includes('protect'),
    'ランクリセット': () => Array.isArray(bd.unlock) && (bd.unlock.includes('rank_reset_all') || bd.unlock.includes('rank_reset_opp')),
    '状態異常回復':   () => Array.isArray(bd.cure_status) && bd.cure_status.length > 0,
    'みがわり貫通':   () => bd.substitute_pierce === true,
  };
}
const TARGET_PAT_MAP = {
  '相手全体':   ['相手全体', '全体', '自分以外全体'],
  '自分以外':   ['自分以外全体', '相手全体', '全体'],
  '味方':       ['味方1体', '味方全体', '味方の場', '自分か味方'],
  '場':         ['全体の場', '相手の場', '味方の場'],
};
const STAT_KEY_MAP = {'こうげき':'atk','ぼうぎょ':'def','とくこう':'spa','とくぼう':'spd','すばやさ':'spe','命中率':'acc','回避率':'eva'};

// 各フィルタが m にマッチするか個別判定。aggregateMode で OR/AND 切替。
function _filterCatHit(m, catKey, aggregateMode) {
  const set = activeEfFilters[catKey];
  if (!set || set.size === 0) return false;
  const flags = m.flags || {};
  const bd = m.battle_data || {};
  // 個別チップ→単独判定関数を返す
  let chipFn = null;
  if (catKey === 'flag')      chipFn = (f) => !!flags[f];
  else if (catKey === 'status') {
    // ★2026-06-18 fix: 旧コードは英語kind(flinch/status)を探していたが、データは日本語kind(ひるみ/状態付与)に統一済
    // → 状態異常チップが全部0件ヒット=壊れていた。日本語kindに直して復活させる。
    const effects = bd.effects || [];
    chipFn = (s) => {
      if (s === 'ひるみ') return effects.some(e => e.kind === 'ひるみ' || (e.kind === '状態付与' && e.value === 'ひるみ'));
      if (s === 'どく')   return effects.some(e => e.kind === '状態付与' && (e.value === 'どく' || e.value === 'もうどく'));
      return effects.some(e => e.kind === '状態付与' && e.value === s);
    };
  }
  else if (catKey === 'target') {
    const tgt = m.target || '';
    chipFn = (k) => (TARGET_PAT_MAP[k] || []).some(p => tgt === p);
  }
  else if (catKey === 'misc') {
    const judges = _miscTagJudges(m);
    chipFn = (k) => !!(judges[k] && judges[k]());
  }
  else {
    // ランク変動カテゴリ
    const RANK_CHECKS = {
      self_up2:   ['self', d => d >= 2],
      self_up1:   ['self', d => d === 1],
      opp_down2:  ['opp',  d => d <= -2],
      opp_down1:  ['opp',  d => d === -1],
      self_down2: ['self', d => d <= -2],
      self_down1: ['self', d => d === -1],
    };
    if (!RANK_CHECKS[catKey]) return false;
    const [tgtKey, check] = RANK_CHECKS[catKey];
    const ranks = bd.rank_changes || [];
    chipFn = (stat) => {
      const key = STAT_KEY_MAP[stat];
      return ranks.some(r => r.target === tgtKey && r.stat === key && check(r.delta));
    };
  }
  // OR: 1つでも該当 / AND: 全部該当
  if (aggregateMode === 'AND') return [...set].every(chipFn);
  return [...set].some(chipFn);
}

// 効果フィルターのマッチ判定 (AND/OR 切替対応)
function matchesEffectFilter(m) {
  const flags = m.flags || {};

  // 除外フィルター: 常にAND動作 (該当する技は非表示)
  if (activeEfFilters.exclude.size > 0) {
    const bd = m.battle_data || {};
    const EXCLUDE_CHECKS = {
      'charge':         () => flags.charge,
      'recharge':       () => flags.recharge,
      'self_rank_down': () => (bd.rank_changes || []).some(r => r.target === 'self' && r.delta < 0),
      'recoil':         () => bd.recoil && bd.recoil !== 'on_miss',
      'fail_damage':    () => bd.recoil === 'on_miss',
      'self_faint':     () => bd.self_faint === true,
    };
    for (const f of activeEfFilters.exclude) {
      const check = EXCLUDE_CHECKS[f];
      if (check && check()) return false;
    }
  }

  const FILTER_CATS = ['flag','status','self_up2','self_up1','opp_down2','opp_down1','self_down2','self_down1','target','misc'];
  const activeCats = FILTER_CATS.filter(k => activeEfFilters[k].size > 0);
  if (activeCats.length === 0) return true; // 何も選んでなければ全表示

  if (filterMode === 'AND') {
    // 全カテゴリで条件を満たす + カテゴリ内も全選択肢に該当
    return activeCats.every(k => _filterCatHit(m, k, 'AND'));
  } else {
    // OR: どこかのチップに該当すれば表示 (カテゴリ内もカテゴリ間もOR)
    return activeCats.some(k => _filterCatHit(m, k, 'OR'));
  }
}

function toNum(v) {
  if (v === '-' || v === '' || v == null) return -1;
  const n = parseInt(v);
  return isNaN(n) ? -1 : n;
}


// 数値列ソート用のキー集合 (これらの列は1回目=降順、2回目=解除)
const NUMERIC_SORT_KEYS = new Set(['power', 'acc', 'pp', 'prob', 'priority', 'learnersCount', 'c1', 'c2', 'c3']);
function toNumNull(v) {
  if (v === '-' || v === '' || v == null) return null;
  const n = parseInt(v);
  return isNaN(n) ? null : n;
}

// 効果文から発動確率を抽出 (例: "10%の確率で..." → 10)
// 複数ある場合は最大値を採用、見つからなければ null
function extractProbability(desc) {
  if (!desc) return null;
  const matches = [...desc.matchAll(/(\d+)\s*%の確率/g)];
  if (matches.length === 0) return null;
  const probs = matches.map(m => parseInt(m[1])).filter(n => n >= 0 && n <= 100);
  return probs.length > 0 ? Math.max(...probs) : null;
}

// === 厳密ランク変動判定 ===
// description を文 → 節 に分けて、stat ごとに 自分/相手 の up/down 段階を抽出
// 「自分のXが下がるかわりにYが上がる」のような複合文も正しく処理
function analyzeStatChange(desc, stat, subject) {
  const upStages = new Set();
  const downStages = new Set();
  if (!desc) return { upStages, downStages };
  const statTok = '『' + stat + '』';

  const sentences = desc.split('。');
  for (const sentence of sentences) {
    if (!sentence) continue;
    // 文全体の subject (最初に現れた 自分/相手 がフォールバック)
    const sentenceSubjMatch = sentence.match(/(自分|相手)/);
    const sentenceSubj = sentenceSubjMatch ? sentenceSubjMatch[1] : null;
    // 「かわりに」「反対に」で節分割
    const clauses = sentence.split(/(?:かわりに|反対に)/);

    for (const clause of clauses) {
      if (!clause.includes(statTok)) continue;
      // 節レベルの subject (なければ文全体の subject)
      const localSubjMatch = clause.match(/(自分|相手)/);
      const effectiveSubj = localSubjMatch ? localSubjMatch[1] : sentenceSubj;
      if (effectiveSubj !== subject) continue;
      // stat 後ろの up/下 を見る
      const idx = clause.indexOf(statTok);
      const afterStat = clause.substring(idx);
      const upMatch = afterStat.match(/上[がげ]/);
      const downMatch = afterStat.match(/下[がげ]/);
      const upPos = upMatch ? upMatch.index : Infinity;
      const downPos = downMatch ? downMatch.index : Infinity;
      if (upPos === Infinity && downPos === Infinity) continue;
      const direction = upPos < downPos ? 'up' : 'down';
      const stageMatch = afterStat.match(/(\d+)\s*段階/);
      const isMax = /最大/.test(afterStat);
      const stage = isMax ? 6 : (stageMatch ? parseInt(stageMatch[1]) : 1);
      if (direction === 'up') upStages.add(stage);
      else downStages.add(stage);
    }
  }
  // 補完: 別文に「N段階...上がる」(stat 名なし) がある場合、既に up があれば追加
  // 例: せいちょう「天気が『にほんばれ』の時は、2段階ずつ上がる」
  if (upStages.size > 0) {
    for (const sentence of sentences) {
      if (!sentence || sentence.includes(statTok)) continue;
      const subjMatch = sentence.match(/(自分|相手)/);
      const subj = subjMatch ? subjMatch[1] : subject;
      if (subj !== subject) continue;
      const stageMatch = sentence.match(/(\d+)\s*段階/);
      const hasUp = /上[がげ]/.test(sentence);
      const hasDown = /下[がげ]/.test(sentence);
      if (stageMatch && hasUp && !hasDown) {
        upStages.add(parseInt(stageMatch[1]));
      } else if (/最大/.test(sentence) && hasUp && !hasDown) {
        upStages.add(6);
      }
    }
  }
  return { upStages, downStages };
}

const STATS_LIST = ['こうげき', 'ぼうぎょ', 'とくこう', 'とくぼう', 'すばやさ'];
// 起動時に各 move に確率 + ランク変動を計算済みで持たせる
moves.forEach(m => {
  m._prob = extractProbability(m.effect || '');
  m._statSelf = {};
  m._statOpp = {};
  STATS_LIST.forEach(stat => {
    m._statSelf[stat] = analyzeStatChange(m._legacy_desc || m.effect || '', stat, '自分');
    m._statOpp[stat]  = analyzeStatChange(m._legacy_desc || m.effect || '', stat, '相手');
  });
});

// 技ごとに該当するフィルタタグ一覧を生成 (battle_data, flags, priority, effects, rank_changes ベース)
// ★2026-06-18: 新 getMoveFilterTags (確認ページと同一実装・waza_list_confirm.js より移植)
function getMoveFilterTags(m) {
  const out = [];
  const bd = m.battle_data || {};
  const flags = m.flags || {};
  const prio = (typeof m.priority === 'number') ? m.priority : 0;

  // 技フラグ
  if (flags.punch)          out.push({cls:'tag-flag',  text:'👊 パンチ'});
  if (flags.sound)          out.push({cls:'tag-flag',  text:'🔊 音'});
  if (flags.ball)           out.push({cls:'tag-flag',  text:'🔵 弾'});
  if (flags.pulse)          out.push({cls:'tag-flag',  text:'〰️ 波動'});
  if (flags.ohko)           out.push({cls:'tag-flag',  text:'💀 一撃必殺'});
  // ⏳ 溜め(flags.charge)・🔁 2T動けない(flags.recharge)はbd.charge/recharge と内容重複=ここでは出さない(2026-06-17 阿部さん・統合)
  if (flags.change_type)    out.push({cls:'tag-flag',  text:'🎭 タイプ変更'});
  if (flags.change_ability) out.push({cls:'tag-flag',  text:'✨ 特性変更'});
  if (flags.change_item)    out.push({cls:'tag-flag',  text:'🎁 道具変更'});

  // 副作用 (状態異常 / ひるみ)
  const STATUS_ICON = {'まひ':'⚡','やけど':'🔥','こおり':'❄️','ねむり':'💤','どく':'☠️','もうどく':'💀','こんらん':'🌀','メロメロ':'💕','バインド':'🔗','ちいさくなる':'🔻','きゅうしょアップ':'🎯'}; // 2026-06-18 バインド等の絵文字を統一(STATUS_ICONフォールバック🩻と bd.* 由来タグの重複を解消)
  for (const e of (bd.effects || [])) {
    const tgt = e.target === 'self' ? '(自)' : '';
    const p = (e.prob != null && e.prob < 100) ? `${e.prob}%` : ''; // ★日本語kind(ひるみ/状態付与)に対応(英語kindバグ修正・2026-06-07)
    if (e.kind === 'ひるみ' || (e.kind === '状態付与' && e.value === 'ひるみ')) out.push({cls:'tag-status', text:`😵 ${p}ひるみ${tgt}`});
    else if (e.kind === '状態付与') {
      // ★英語prose value(うちおとす等の未構造プレースホルダ)はタグに出さない=長大化/英語漏れ/列ズレ防止。
      //   元データはEffects列で確認できる。park: SSOTの英語残(うちおとす/むしくい)は別途ちゃんと構造化する。
      if (/[A-Za-z]/.test(String(e.value || ''))) continue;
      out.push({cls:'tag-status', text:`${STATUS_ICON[e.value]||'🩻'} ${p}${e.value}${tgt}`});
    }
  }

  // ランク変動
  const STAT_JP = {atk:'攻',def:'防',spa:'特攻',spd:'特防',spe:'速',acc:'命中',eva:'回避'};
  const TGT_JP = {self:'自',ally:'味',opp:'相'};
  for (const r of (bd.rank_changes || [])) {
    const sign = r.delta > 0 ? '+' : '';
    const probTxt = r.prob < 100 ? `${r.prob}% ` : '';
    out.push({cls:'tag-rank', text:`📊 ${probTxt}${TGT_JP[r.target]||'?'}${STAT_JP[r.stat]||r.stat}${sign}${r.delta}`});
  }
  // ★rank_changes が無い技は effects の能力ランク変化からタグを作る(2026-06-17 阿部さん・はらだいこ/ソウルビート等の取りこぼし)
  if (!Array.isArray(bd.rank_changes) || bd.rank_changes.length === 0) {
    const STAT_EN_JP = {attack:'攻', defense:'防', special_attack:'特攻', special_defense:'特防', speed:'速', accuracy:'命中', evasion:'回避', all:'全能力'};
    const TGT_EN_JP = {self:'自', opponent:'相', team:'味', ally:'味', all_opponents:'相全', all_but_self:'他全', party:'手', incoming:'次味', all:'場全'};
    for (const e of (bd.effects || [])) {
      if (e.kind !== '能力ランク変化') continue;
      const tgt = TGT_EN_JP[e.target] || '?';
      const sts = Array.isArray(e.stats) ? e.stats : (e.stat ? [e.stat] : []);
      const probTxt = (e.prob != null && e.prob < 100) ? `${e.prob}% ` : '';
      if (e.to_max) { // はらだいこ=自攻が最大まで上がる
        for (const s of sts) out.push({cls:'tag-rank', text:`📊 ${probTxt}${tgt}${STAT_EN_JP[s] || s}最大`});
      } else if (e.stages) {
        const sign = e.stages > 0 ? '+' : '';
        if (e.stat_choice === 'random_one_of') { // つぼをつく等
          out.push({cls:'tag-rank', text:`📊 ${probTxt}${tgt}ランダム${sign}${e.stages}`});
        } else {
          for (const s of sts) out.push({cls:'tag-rank', text:`📊 ${probTxt}${tgt}${STAT_EN_JP[s] || s}${sign}${e.stages}`});
        }
      }
    }
  }

  // 急所
  if (bd.must_crit)         out.push({cls:'tag-crit', text:'💥 必中急所'});
  else if (bd.crit_stage >= 1) out.push({cls:'tag-crit', text:`🎯 急所+${bd.crit_stage}`});
  if (bd.must_hit)          out.push({cls:'tag-crit', text:'🎯 必中'});
  for (const c of (bd.crit_changes || [])) {
    const tg = c.target === 'self' ? '自' : c.target === 'ally' ? '味' : '相';
    out.push({cls:'tag-crit', text:`🎯 ${tg}急所+${c.delta}`});
  }

  // 連続技 / あばれ状態 (別カテゴリ)
  if (bd.multi_hit === 'thrash') {
    out.push({cls:'tag-misc', text:'🌀 あばれ状態(2-3T)'});
  } else if (bd.multi_hit) {
    out.push({cls:'tag-misc', text:`⚡ 連続${bd.multi_hit}回`});
  }

  // 反動 / 失敗ダメージ
  if (bd.recoil === 'on_miss') {
    out.push({cls:'tag-recoil', text:`💔 失敗ダメージ`});
  } else if (bd.recoil) {
    out.push({cls:'tag-recoil', text:`💢 反動${bd.recoil}`});
  }
  if (bd.drain) {
    const lbl = bd.drain === 'seed' ? 'やどりぎ式' : bd.drain;
    out.push({cls:'tag-drain', text:`🩸 ダメージ回復${lbl}`});
  }
  if (bd.recovery && bd.recovery !== 'status_only') {
    const RECOV_LBL = {'1/2':'1/2','weather':'天候依存','per_turn':'毎ターン','swap':'自身犠牲','takuwaeru':'たくわえる連動'};
    out.push({cls:'tag-recov', text:`💚 回復(${RECOV_LBL[bd.recovery]||bd.recovery})`});
  }

  // 優先度
  if (prio > 0) out.push({cls:'tag-prio-up',   text:`⚡ 先制+${prio}`});
  if (prio < 0) out.push({cls:'tag-prio-down', text:`🐢 後攻${prio}`});

  // ため / 再不可(2026-06-17 阿部さん・正確な言葉に統一)
  if (bd.charge) {
    const CHARGE_LBL = {
      'normal':         '1ターン目にためて2ターン目に攻撃',
      'invulnerable':   '1ターン目に空中などにかくれて2ターン目に攻撃',
      'with_stat_up':   '1ターン目に能力ランクが上がり2ターン目に攻撃',
    };
    out.push({cls:'tag-charge', text:`⏳ ${CHARGE_LBL[bd.charge]||bd.charge}`});
  }
  if (bd.charge_skip_in_weather) out.push({cls:'tag-charge', text:'☀️ 天気でためを省略できる'});
  if (bd.recharge)               out.push({cls:'tag-charge', text:'🔁 使った次のターンは動けない'});

  // 場・設置・交代系
  // ★2026-06-18: 同種の細分タグを「天候(◯◯)」「フィールド(◯◯)」「設置(◯◯)」のように統合(統一カテゴリで括弧に詳細)
  if (bd.weather_set) {
    const W = {'sunny':'にほんばれ','rain':'あめ','snow':'ゆき','sand':'すなあらし'};
    out.push({cls:'tag-field', text:`🌤 天候(${W[bd.weather_set]||bd.weather_set})`});
  }
  if (bd.field_set) {
    const F = {'electric':'エレキフィールド','grass':'グラスフィールド','psychic':'サイコフィールド','misty':'ミストフィールド'};
    out.push({cls:'tag-field', text:`🌿 フィールド(${F[bd.field_set]||bd.field_set})`});
  }
  if (bd.hazard_set) {
    const H = {'spikes':'まきびし','toxic_spikes':'どくびし','stealth_rock':'ステルスロック','sticky_web':'ねばねばネット'};
    out.push({cls:'tag-hazard', text:`📌 設置(${H[bd.hazard_set]||bd.hazard_set})`});
  }
  if (bd.tailwind)       out.push({cls:'tag-field', text:'🌬️ 追い風'});
  if (bd.gravity)        out.push({cls:'tag-field', text:'🌌 重力'});
  if (bd.protect_wide)   out.push({cls:'tag-field', text:'🚧 ワイドガード'});
  if (bd.protect_fast)   out.push({cls:'tag-field', text:'🚧 ファストガード'});
  if (bd.remove_hazards) out.push({cls:'tag-field', text:'🧹 設置解除'});
  if (bd.field_remove)   out.push({cls:'tag-field', text:'🧹 フィールド破壊'});

  // 交代系
  // bd.bind は effects[状態付与=バインド] と完全に対応(7技で一致)→ 状態付与kindのタグでカバー済=重複削除(2026-06-18)
  if (bd.force_switch_opp) out.push({cls:'tag-switch', text:'🔄 相手交代'});
  if (bd.self_switch)      out.push({cls:'tag-switch', text:'↩️ 自分交代'});
  if (bd.trap_no_switch)   out.push({cls:'tag-switch', text:'🪤 交代不可'});

  // 瀕死技
  if (bd.self_faint)       out.push({cls:'tag-faint', text:'💀 瀕死技'});

  // 壁
  if (bd.screen) {
    const S = {'reflect':'リフレクター','light_screen':'ひかりのかべ','aurora_veil':'オーロラベール','safeguard':'しんぴのまもり'};
    out.push({cls:'tag-screen', text:`🛡️ 壁(${S[bd.screen]||bd.screen})`}); // 2026-06-18 統合形
  }
  // ルーム
  if (bd.room) {
    const R = {'trick_room':'トリックルーム','wonder_room':'ワンダールーム','magic_room':'マジックルーム'};
    out.push({cls:'tag-room', text:`🌀 ルーム(${R[bd.room]||bd.room})`}); // 2026-06-18 統合形
  }
  // 技封じ (効果別に簡潔表示)
  if (bd.move_block) {
    const MB = {
      'disable':     '直前技封じ',
      'encore':      '直前技繰返強制',
      'taunt':       '変化技封じ',
      'torment':     '同技連続封じ',
      'heal_block':  '回復封じ',
      'sound_block': '音技封じ',
    };
    out.push({cls:'tag-block', text:`🔒 ${MB[bd.move_block]||bd.move_block}`});
  }
  // サポート
  if (bd.support)          out.push({cls:'tag-support', text:'🤝 サポートW'});
  // ランク操作(2026-06-18: 統合形=「能力入替(◯◯)」)
  if (bd.rank_op) {
    const RO = {'copy':'相手→自分にコピー','swap_atk_spa':'攻と特攻を入替','swap_def_spd':'防と特防を入替','swap_atk_def_self':'自分の攻と防を入替'};
    out.push({cls:'tag-rankop', text:`🔄 能力入替(${RO[bd.rank_op]||bd.rank_op})`});
  }
  // 解除系
  if (Array.isArray(bd.unlock)) {
    const UN = {'screen':'壁破壊','protect':'防御貫通','rank_reset_all':'ランクリセット(全)','rank_reset_opp':'ランクリセット(敵)'};
    bd.unlock.forEach(u => out.push({cls:'tag-unlock', text:`🧹 ${UN[u]||u}`}));
  }

  // 状態異常回復
  if (Array.isArray(bd.cure_status)) {
    const TGT_CURE = {'self':'自','ally':'味','opp':'相','next_ally':'次味'};
    bd.cure_status.forEach(c => {
      const tg = TGT_CURE[c.target] || c.target;
      const val = c.value === 'all' ? '全状態異常' : c.value;
      out.push({cls:'tag-cure', text:`💊 ${tg}${val}治す`});
    });
  }

  // みがわり/防御技関連 (独立タグ)
  if (bd.substitute_pierce) out.push({cls:'tag-other', text:'👻 みがわり貫通'});
  if (bd.substitute_remove) out.push({cls:'tag-other', text:'🪬 みがわり解除'});
  if (bd.protect_pierce)    out.push({cls:'tag-other', text:'🛡️ まもる貫通'});

  // ★effects kind別タグ(2026-06-17 阿部さん): 略・アレンジを避け、データ/legacy通りの正確な言葉でタグ化。
  //   既存タグ(bd.*由来)と内容重複しないよう、emitWhenを絞った。1技に同種タグが重複しないよう Set で去重。
  const seen = new Set(out.map(t => t.text));
  const push = (cls, text) => { if (!seen.has(text)) { out.push({cls, text}); seen.add(text); } };
  for (const e of (bd.effects || [])) {
    const k = e.kind;
    const ct = e.condition && e.condition.type;
    if (k === '威力倍率') {
      if (e.multiplier >= 2 && /target_status|user_status|status_condition|user_has_status|target_has_status/.test(ct||'')) push('tag-misc', '🤢 相手の状態異常で威力2倍');
      if (/field/.test(ct||'')) push('tag-field', '🌿 フィールドで威力変化');
      if (ct === 'target_minimized') push('tag-misc', '🔻 「ちいさくなる」相手に威力2倍');
      if (ct === 'user_has_no_held_item') push('tag-misc', '🎒 持ち物なしで威力2倍'); // アクロバット
      if (/previous_turn_move_failed|failed_to_act_last_turn/.test(ct||'')) push('tag-misc', '😤 前のターン失敗で威力2倍'); // じだんだ/やけっぱち
      if (ct === 'user_stat_lowered_this_turn') push('tag-misc', '😤 そのターン能力下げられたら威力2倍'); // うっぷんばらし
      if (/target_already_damaged/.test(ct||'')) push('tag-misc', '💢 相手が同ターンに先にダメージ受けたら威力2倍'); // たたりめ系
    }
    if (k === '必中' && ct === 'target_minimized') push('tag-misc', '🎯 「ちいさくなる」中の相手に必ず命中');
    if (k === '連続攻撃') {
      if (e.hits_by != null) push('tag-misc', '👥 手持ちの数だけ攻撃');
      if (e.stop_on_miss === true && !Array.isArray(e.power_per_hit)) push('tag-misc', '🎲 外れるまで連続');
      if (Array.isArray(e.power_per_hit)) push('tag-misc', '📈 当たるたび威力上昇');
    }
    if (k === '半無敵命中') push('tag-misc', e.damage_multiplier === 2 ? '💥 半無敵中の相手に当てて威力2倍' : '🌪️ 半無敵中の相手に当てられる');
    if (k === '威力可変') {
      if (e.basis === 'target_weight' || (Array.isArray(e.tiers) && e.tiers[0] && e.tiers[0].max_kg != null) || (Array.isArray(e.weight_thresholds))) push('tag-misc', '⚖️ 相手の重さで威力変化');
      if (e.relation === 'lower_hp_higher_power') push('tag-misc', '💢 自分のHPが少ないほど威力上昇');
      if (e.formula && /current_HP\s*\/\s*[\w]*max_HP|currentHP\s*\/\s*\w*maxHP/i.test(e.formula)) push('tag-misc', '📉 自分のHPが多いほど威力上昇'); // ふんか・しおふき・ハードプレス
      // ★2026-06-18 統合: エレキボール(basis=user_speed_over_target_speed) と ジャイロボール(formula=target_speed/user_speed)は同じ「すばやさ差で威力」
      if (e.basis === 'user_speed_over_target_speed' || (e.formula && /target_speed\s*\/\s*user_speed/.test(e.formula))) push('tag-misc', '⚡ 相手とのすばやさ差で威力変化');
      if (e.basis === 'user_positive_stat_stages' || e.per_stage) push('tag-misc', '📈 自分の能力ランク段階で威力上昇'); // アシストパワー
      if (e.multiplier === 2 && /failed_to_act|previous_turn_move_failed/.test(ct||'')) push('tag-misc', '😤 前のターン失敗で威力2倍'); // やけっぱち
    }
    if (k === '倍返し') {
      const mu = e.multiplier || 2;
      push('tag-recoil', `🔄 受けたダメージの${mu}倍で返す`);
    }
    if (k === '固定ダメージ') {
      if (e.amount === '自分のレベル分') push('tag-misc', '🔢 自分のレベル分のダメージ');
      else if (typeof e.amount === 'string' && /残りHPの半分/.test(e.amount)) push('tag-misc', '✂️ 相手の残りHPの半分のダメージ');
      else if (typeof e.amount === 'string' && /HPから自分の残りHPを引/.test(e.amount)) push('tag-misc', '⚖️ 相手と自分のHP差のダメージ');
    }
    if (k === '回復' && e.target === 'team') push('tag-recov', '💚 自分と味方を回復');
    if (k === '状態異常回復' && e.target === 'self' && e.value === 'こおり' && (e.usable_while_frozen || /こおっていても/.test(e.note||''))) push('tag-cure', '❄️ 「こおり」中でも使える');
    if (k === '状態異常回復' && /opponent|all_opponents|all_but_self/.test(e.target || '') && e.value === 'こおり') push('tag-cure', '🫧 相手の「こおり」状態を治す');
    if (k === 'HPが減る') {
      if (e.always_pays_even_if_blocked === true) push('tag-misc', '⚠️ 防がれても自分のHPが減る');
      else if (Math.abs(e.fraction - 0.5) < 0.01) push('tag-drain', '💸 自分のHPが最大HPの半分減る');
      else if (Math.abs(e.fraction - 0.25) < 0.01) push('tag-drain', '💸 自分のHPが最大HPの1/4減る');
      else if (Math.abs(e.fraction - 0.3333) < 0.02) push('tag-drain', '💸 自分のHPが最大HPの1/3減る');
    }
    if (k === 'みがわり設置') push('tag-support', '🪆 「みがわり」を作る');
    if (k === 'PP減少') push('tag-other', '💢 相手の技のPPを減らす');
    if (k === 'みちづれ') push('tag-faint', '💀 みちづれ');
    if (k === 'ロックオン') push('tag-flag', '🎯 次のターン必ず命中');
    if (k === 'メロメロ付与') push('tag-status', '💕 「メロメロ」状態にする');
    if (k === 'ランダム技') push('tag-misc', '🎲 自分の覚えている技からランダム');
    if (k === 'いたみわけ') push('tag-recov', '🤝 自分と相手のHPを半分ずつに分ける');
    if (k === '自分交代' && Array.isArray(e.pass) && e.pass.length > 0) push('tag-switch', '🎽 能力ランクを引き継いで交代');
    if (k === '遅延攻撃') push('tag-charge', '⏳ 2ターン後に攻撃が当たる');
    if (k === 'やけど低下無視') push('tag-misc', '🔥 「やけど」のこうげき低下を無視');
    if (k === '持ち物交換') push('tag-support', '🔄 自分と相手の持ち物を入れかえる');
    if (k === '特性上書き' && e.target === 'opponent' && e.value && e.value !== '自分の特性') push('tag-misc', '🔀 相手の特性を上書き');
    if (k === '特性上書き' && (e.source === 'opponent_ability' || e.value === '自分の特性')) push('tag-misc', '🪞 相手の特性をコピー');
    if (k === '持ち物排除' && (e.target === 'all' || e.target === 'all_but_self')) push('tag-misc', '🗑️ 場の全員の持ち物を使えなくする');
    if (k === 'ふういん') push('tag-block', '🔒 自分も知っている技を相手は使えなくなる');
    if (k === '木の実奪取食') push('tag-misc', '🍒 相手の「きのみ」を奪って使う'); // 2026-06-18 統合: むしくい(木の実強制 target=opponent)と表現を一致
    if (k === '条件威力倍率') {
      if (/moves_after/.test(ct||'')) push('tag-misc', '🔄 後攻で使うと威力2倍');
      else if (/already_damaged/.test(ct||'')) push('tag-misc', '💢 相手が同ターンに先にダメージ受けたら威力2倍');
      else if (e.prob != null) push('tag-misc', '🎲 ' + e.prob + '%の確率で威力2倍');
    }
    if (k === 'なげつける') push('tag-misc', '🎁 持っている道具を投げて攻撃');
    if (k === '能力入替' && Array.isArray(e.stats) && e.stats.length === 1 && e.stats[0] === 'speed') push('tag-rankop', '🔄 能力入替(自分と相手のすばやさを入れかえ)'); // 2026-06-18 統合形
    if (k === '特性無効化') push('tag-other', '🚫 相手の特性を無効にする');
    if (k === '直前技模倣') push('tag-misc', '🪞 直前にだれかが使った技をまねる');
    if (k === '木の実強制') push('tag-misc', e.target === 'opponent' ? '🍒 相手の「きのみ」を奪って使う' : '🍃 持っている「きのみ」をすぐに使う'); // 2026-06-18 統合: 「奪って使う」をついばむと表現一致(両方🍒)
    if (k === '実数値折半') {
      const sts = Array.isArray(e.stats) ? e.stats : (e.stat ? [e.stat] : []);
      if (sts.some(s => /defense/.test(s))) push('tag-rankop', '🔄 能力入替(ぼうぎょ・とくぼうを平均化)');
      if (sts.some(s => /attack/.test(s))) push('tag-rankop', '🔄 能力入替(こうげき・とくこうを平均化)');
    }
    if (k === '別防御参照ダメージ') push('tag-misc', '🛡️ 特殊技だが相手のぼうぎょで計算');
    if (k === 'タイプ上書き') {
      if (e.value === 'copy_target_current_types') push('tag-misc', '🪞 タイプコピー(自分→相手と同じ)');
      else if (e.value && !/^[A-Za-z_]+$/.test(String(e.value))) push('tag-misc', `🎭 タイプ変更(相手→${e.value}だけに)`);
    } // 2026-06-18 統合形
    if (k === '相手能力ダメージ') push('tag-misc', '↩️ 相手のこうげきの高さでダメージ計算');
    if (k === 'ランク無視') push('tag-misc', '🔓 相手の能力ランク変化を無視して攻撃');
    if (k === '技タイプ追加') push('tag-misc', '🔀 この技にタイプを追加');
    if (k === 'タイプ追加') push('tag-other', `🏷️ タイプ追加(相手→${e.value})`); // 2026-06-18
    if (k === '技強制再使用') push('tag-misc', '🔁 相手に直前の技をもう一度使わせる');
    if (k === 'ランク数威力加算') push('tag-misc', '📈 自分の能力ランク段階で威力上昇'); // 2026-06-18 統合: アシストパワーと表現一致
    if (k === 'タイプ除去') push('tag-other', `💨 タイプ除去(自分の${e.value}が消える)`); // 2026-06-18
    if (k === '別能力ダメージ') push('tag-misc', '🛡️ 自分のぼうぎょでダメージ計算');
    if (k === '対象範囲変更') push('tag-misc', '🌐 条件で相手全体に当たるようになる');
    if (k === '相手持ち物威力') push('tag-misc', '🎒 相手の持ち物を使って攻撃');
    if (k === '威力段階増加') push('tag-misc', '⚰️ ひんしになった味方が多いほど威力上昇');
    if (k === '次ターン使用不可') push('tag-recoil', '🚫 次のターン使えない');
    if (k === 'へんしん') push('tag-misc', '✨ 相手のすがた・能力・技をコピー');
  }
  // ★requires(使用条件)からタグ(ゲップ/とっておき/いびき等)
  for (const r of (bd.requires || [])) {
    if (r.type === 'user_has_eaten_berry') push('tag-misc', '🍒 「きのみ」を食べた後だけ使える');
    if (r.type === 'all_other_known_moves_used') push('tag-misc', '🎴 他の技を全部使うと使える');
    if (r.type === 'self_status') push('tag-status', `💤 自分が「${r.value}」状態の時だけ使える`);
    if (r.type === 'weather') push('tag-field', `🌤 天気が「${r.value}」の時だけ使える`);
    if (r.type === 'first_turn_after_switch_in') push('tag-misc', '⏮ 出てきた最初のターンだけ使える');
  }

  return out;
}



function render() {
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  const searchQ = toHira(document.getElementById('search').value);
  const fTarget = document.getElementById('f-target').value;
  const fMode = document.getElementById('f-mode').value;
  const fContact = document.getElementById('f-contact').value;
  const fGuard = document.getElementById('f-guard').value;
  // ★2026-06-18: 「カテゴリ」列削除(subcategory手動分類・320技で空欄・旧フィルタと新タグで完全カバー済)
  const fPrio = document.getElementById('f-prio').value;
  const fClass = document.getElementById('f-class').value;
  const fPower = document.getElementById('f-power').value;
  const fAcc = document.getElementById('f-acc').value;
  const fPp = document.getElementById('f-pp').value;
  const fProbMin = document.getElementById('f-prob-min').value;

  let rows = moves.slice();
  // 初期ポケモンフィルタ: そのポケが習得する技のみに絞る
  if (INITIAL_POKEMON_FILTER) {
    rows = rows.filter(m => (m.learners || []).some(l => l.name === INITIAL_POKEMON_FILTER));
  }
  rows.sort((a, b) => {
    let av, bv;
    if (sortKey === 'learnersCount') {
      av = (a.learners||[]).length || null;
      bv = (b.learners||[]).length || null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
    }
    else if (['power','acc','pp'].includes(sortKey)) {
      av = toNumNull(a[sortKey]);
      bv = toNumNull(b[sortKey]);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;   // 空(—)は常に下
      if (bv === null) return -1;
    }
    else if (sortKey === 'prob') {
      av = a._prob;
      bv = b._prob;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;    // 確率なし(—)は常に下
      if (bv == null) return -1;
    }
    else if (sortKey === 'priority') {
      av = a.priority || 0;
      bv = b.priority || 0;
      // 0は実値として比較 (大きい順=先制が上)
    }
    else { av = a[sortKey] || ''; bv = b[sortKey] || ''; }
    if (av < bv) return -1 * sortDir;
    if (av > bv) return 1 * sortDir;
    return 0;
  });

  // ★2026-06-18 fix: aggregateMode は _filterCatHit のローカル引数だった→ ReferenceError で render が止まっていた
  // 正しいグローバルは filterMode(OR/AND)
  const newTagActive = window.__newTagActive || new Set();
  const newTagMode = (typeof filterMode !== 'undefined' ? filterMode : 'OR');
  let visibleCount = 0;
  rows.forEach(m => {
    if (wpCheckedOnly && WP_MODE !== 'browse' && !WP_SELECTED.has(m.key)) return;
    if (searchQ && !moveSearchKey(m).includes(searchQ)) return;
    // 新タグフィルタ: アクティブなタグが付いている技だけ通す
    if (newTagActive.size > 0) {
      const tags = new Set(getMoveFilterTags(m).map(t => t.text));
      const arr = [...newTagActive];
      const ok = newTagMode === 'AND' ? arr.every(t => tags.has(t)) : arr.some(t => tags.has(t));
      if (!ok) return;
    }
    if (selectedTypes.size > 0 && !selectedTypes.has(m.type)) return;
    if (fTarget && m.target !== fTarget) return;
    if (fMode && m.mode !== fMode) return;
    if (fContact && m.contact !== fContact) return;
    if (fGuard && m.guard !== fGuard) return;
    // ★2026-06-18: fCatフィルタ削除(カテゴリ列廃止)
    if (fClass && m.class !== fClass) return;
    if (fPower !== '') {
      const v = toNumNull(m.power);
      if (v == null || v < parseInt(fPower, 10)) return;
    }
    if (fAcc !== '') {
      const v = toNumNull(m.acc);
      if (v == null || v < parseInt(fAcc, 10)) return;
    }
    if (fPp !== '') {
      const v = toNumNull(m.pp);
      if (v == null || v < parseInt(fPp, 10)) return;
    }
    if (fProbMin !== '') {
      if (m._prob == null || m._prob < parseInt(fProbMin, 10)) return;
    }
    if (fPrio) {
      const pv = m.priority || 0;
      if (fPrio === 'hi' && !(pv > 0)) return;
      else if (fPrio === 'lo' && !(pv < 0)) return;
      else if (fPrio === '0' && pv !== 0) return;
      else if (!['hi','lo','0'].includes(fPrio) && pv !== parseInt(fPrio,10)) return;
    }
    // 効果フィルター
    if (!matchesEffectFilter(m)) return;

    const tr = document.createElement('tr');
    const color = typeColors[m.type] || '#999';
    const modeHtml = m.mode === 'ダブル'
      ? `<span class="mode-double">${tMode(m.mode)}</span>`
      : '<span class="mode-both">—</span>';

    const learnerCount = (m.learners || []).length;
    const learnersHtml = learnerCount > 0
      ? `<td class="col-learners learners-cell" data-key="${m.key}" onclick="showLearners('${m.key}')">${tLearnersCount(learnerCount)}</td>`
      : `<td class="col-learners learners-cell-zero">—</td>`;

    const isSel = (WP_MODE === 'multi' || WP_MODE === 'single');
    const chkCell = isSel
      ? `<td class="col-chk wp-multi-only"><input type="checkbox" class="wp-row-chk" data-key="${m.key}" ${WP_SELECTED.has(m.key) ? 'checked' : ''}></td>`
      : '';
    if (isSel && WP_SELECTED.has(m.key)) tr.classList.add('row-checked');
    tr.innerHTML = `
      ${chkCell}
      ${learnersHtml}
      <td class="col-name name-cell" data-key="${m.key}" onclick="showLearners('${m.key}')">${window.I18N ? I18N.move(m.key, m.name) : m.name}</td>
      <td class="col-type" title="${m.type}"><span class="type-cell" style="background:${color}">${wpType3(m.type)}</span></td>
      <td class="col-class"><span class="cls-badge cls-${m.class === '物理' ? 'phys' : m.class === '特殊' ? 'spec' : 'stat'}">${tClass(m.class)}</span></td>
      <td class="col-power num-cell">${m.power}</td>
      <td class="col-acc num-cell">${m.acc}</td>
      <td class="col-pp num-cell">${m.pp}</td>
      <td class="col-prob">${m._prob != null ? m._prob + '%' : '<span class="lmt-na" style="color:#BBB">—</span>'}</td>
      <td class="col-target">${tTarget(m.target)}</td>
      <td class="col-mode">${modeHtml}</td>
      <td class="col-contact">${tContact(m.contact)}</td>
      <td class="col-guard">${tGuard(m.guard)}</td>
      ${(() => {
        const p = m.priority || 0;
        if (p > 0) return `<td class="col-prio prio-pos">+${p}</td>`;
        if (p < 0) return `<td class="col-prio prio-neg">${p}</td>`;
        return `<td class="col-prio prio-zero">—</td>`;
      })()}
      <!-- ★2026-06-18: col-cat 削除(subcategoryフィルタ廃止) -->
      <td class="col-effect effect-cell" data-key="${m.key}">${m.effect}</td>
      <td class="col-tags">${getMoveFilterTags(m).map(t => `<span class="mw-tag ${t.cls}">${t.text}</span>`).join('')}</td>
    `;
    tbody.appendChild(tr);
    visibleCount++;
  });

  const cntFb = `表示${visibleCount}/全${moves.length}技`;
  const cntTmpl = (window.I18N ? I18N.t('waza.count_format', cntFb) : cntFb);
  document.getElementById('count').textContent = cntTmpl
    .replace('{visible}', visibleCount).replace('{total}', moves.length);
}

document.querySelectorAll('th[data-sort]').forEach(th => {
  th.onclick = () => {
    const k = th.dataset.sort;
    const isNumeric = NUMERIC_SORT_KEYS.has(k);
    if (sortKey === k) {
      if (isNumeric) {
        // 数値列の2回目 → ソート解除 (デフォルトのわざ名昇順に戻る)
        sortKey = 'name';
        sortDir = 1;
      } else {
        // 文字列列の2回目 → 方向反転
        sortDir *= -1;
      }
    } else {
      sortKey = k;
      sortDir = isNumeric ? -1 : 1;   // 数値列はデフォルトで降順 (大きい順)
    }
    document.querySelectorAll('th[data-sort]').forEach(x => { x.classList.remove('sorted','asc'); });
    const activeTh = document.querySelector('th[data-sort="' + sortKey + '"]');
    if (activeTh) {
      activeTh.classList.add('sorted');
      if (sortDir === 1) activeTh.classList.add('asc');
    }
    render();
  };
});

// ★2026-06-18: 'f-cat' 削除(カテゴリ列廃止)
['search','f-target','f-mode','f-contact','f-guard','f-prio','f-class','f-power','f-acc','f-pp','f-prob-min'].forEach(id => {
  document.getElementById(id).addEventListener('input', render);
  document.getElementById(id).addEventListener('change', render);
});

const types = [...new Set(moves.map(m => m.type))].sort();
const targets = [...new Set(moves.map(m => m.target))].sort();
targets.forEach(t => { const o = document.createElement('option'); o.value=t; o.textContent=t; document.getElementById('f-target').appendChild(o); });

// ===== タイプ多重選択ドロップダウンの構築 =====
function buildTypeDropdown() {
  const dd = document.getElementById('f-type-dd');
  dd.innerHTML = '';
  // 全選択 / 全解除アクション
  const actions = document.createElement('div');
  actions.className = 'ms-actions';
  const allBtn = document.createElement('button');
  allBtn.type = 'button'; allBtn.className = 'ms-act-btn'; allBtn.textContent = '全選択';
  allBtn.onclick = (e) => { e.stopPropagation(); types.forEach(t => selectedTypes.add(t)); syncTypeCheckboxes(); updateTypeBtnLabel(); render(); };
  const clrBtn = document.createElement('button');
  clrBtn.type = 'button'; clrBtn.className = 'ms-act-btn'; clrBtn.textContent = '全解除';
  clrBtn.onclick = (e) => { e.stopPropagation(); selectedTypes.clear(); syncTypeCheckboxes(); updateTypeBtnLabel(); render(); };
  actions.appendChild(allBtn);
  actions.appendChild(clrBtn);
  dd.appendChild(actions);
  // 各タイプのチェックボックス
  types.forEach(t => {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = t; cb.dataset.type = t;
    cb.checked = selectedTypes.has(t);
    cb.addEventListener('change', () => {
      if (cb.checked) selectedTypes.add(t); else selectedTypes.delete(t);
      updateTypeBtnLabel();
      render();
    });
    const sw = document.createElement('span');
    sw.className = 'ms-color';
    sw.style.background = typeColors[t] || '#999';
    const txt = document.createElement('span');
    txt.className = 'ms-name';
    txt.textContent = t;
    lbl.appendChild(cb);
    lbl.appendChild(sw);
    lbl.appendChild(txt);
    dd.appendChild(lbl);
  });
}
function syncTypeCheckboxes() {
  document.querySelectorAll('#f-type-dd input[type=checkbox]').forEach(cb => {
    cb.checked = selectedTypes.has(cb.value);
  });
}
function updateTypeBtnLabel() {
  const btn = document.getElementById('f-type-btn');
  if (selectedTypes.size === 0) {
    btn.textContent = '全タイプ ▾';
    btn.classList.remove('has-val');
  } else if (selectedTypes.size === 1) {
    btn.textContent = [...selectedTypes][0] + ' ▾';
    btn.classList.add('has-val');
  } else {
    btn.textContent = `${selectedTypes.size}タイプ ▾`;
    btn.classList.add('has-val');
  }
}
function toggleTypeDropdown(e) {
  e.stopPropagation();
  document.getElementById('f-type-wrap').classList.toggle('open');
}
// 外側クリックで閉じる
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('f-type-wrap');
  if (wrap && !wrap.contains(e.target)) wrap.classList.remove('open');
});
buildTypeDropdown();
updateTypeBtnLabel();

// 画面状態リセット (検索・フィルタ・ソートのみ初期化)
function resetAll() {
  document.getElementById('search').value = '';
  ['f-target', 'f-mode', 'f-contact', 'f-guard', 'f-prio', 'f-class', 'f-power', 'f-acc', 'f-pp', 'f-prob-min'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // タイプ多重選択をクリア
  selectedTypes.clear();
  syncTypeCheckboxes();
  updateTypeBtnLabel();
  // 効果フィルターリセット
  Object.values(activeEfFilters).forEach(s => s.clear());
  document.querySelectorAll('.ef-chip').forEach(el => {
    el.classList.remove('active', 'active-status', 'active-up', 'active-down', 'active-misc');
  });
  sortKey = 'power';
  sortDir = -1;
  document.querySelectorAll('th[data-sort]').forEach(x => { x.classList.remove('sorted','asc'); });
  const powerTh = document.querySelector('th[data-sort="power"]');
  if (powerTh) { powerTh.classList.add('sorted'); }
  render();
}

// ===== 習得ポケモン表示 (実DBをiframe埋め込み) =====
// 案 B (入れ子モーダル削減): iframe 内で呼ばれた場合は親に postMessage で
// URL 切替依頼し、独自の learnerModal は開かない。
function showLearners(key) {
  const m = moves.find(x => x.key === key);
  if (!m || !m.learners || m.learners.length === 0) return;
  const url = POKEMON_DB_URL + '?learns=' + encodeURIComponent(key) + '&v=' + Date.now();
  const moveName = (window.I18N && I18N.move) ? I18N.move(m.key, m.name) : m.name;
  const title = _t('waza.learners_title_full', `${m.name} を習得 ${m.learners.length}匹 (DB全機能利用可)`)
    .replace('{name}', moveName).replace('{n}', m.learners.length);

  // iframe 内なら親 (pokemon_db_v9.html) に切替依頼 (入れ子モーダル防止)
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'pchamdb:openInModal', url, title }, '*');
    return;
  }

  // 通常 (単独表示): 自身の learnerModal を開く
  document.getElementById('lmTitle').textContent = title;
  document.getElementById('lmList').innerHTML = `
    <div class="lmt-hint">
      🔗 <a href="${url}" target="_blank" rel="noopener" style="color:#1F4E79;font-weight:700">${_t('waza.open_new_tab', '別タブで開く (より広く表示)')}</a>
    </div>
    <iframe src="${url}" class="lm-iframe" title="${moveName}"></iframe>
  `;
  document.getElementById('learnerModal').classList.add('vis');
}
function closeLearnerModal() {
  document.getElementById('learnerModal').classList.remove('vis');
  // ドラッグ位置リセット (再オープン時は中央表示に戻す)
  lmDragX = 0; lmDragY = 0;
  const box = document.getElementById('learnerModalBox');
  if (box) box.style.transform = '';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLearnerModal();
});

// learnerModal をタイトル(h3)ドラッグで移動可能に
let lmDragX = 0, lmDragY = 0;
(function setupLearnerModalDrag() {
  let isDragging = false;
  let startX = 0, startY = 0;
  let dragHandle = null;
  document.addEventListener('mousedown', e => {
    const handle = e.target.closest('#lmTitle');
    if (!handle) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    dragHandle = handle;
    handle.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const box = document.getElementById('learnerModalBox');
    if (box) box.style.transform = `translate(${lmDragX + dx}px, ${lmDragY + dy}px)`;
  });
  document.addEventListener('mouseup', e => {
    if (!isDragging) return;
    isDragging = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    lmDragX += dx;
    lmDragY += dy;
    if (dragHandle) { dragHandle.classList.remove('dragging'); dragHandle = null; }
  });
})();

// ホバー: 習得列のマウスオーバーで上位50匹を表示
// (わざ名hoverは下の setupDescHover に統合: 効果列と同じリッチ表示)
(function setupNameHover() {
  const tip = document.getElementById('waza-tip');
  if (!tip) return;
  const HOVER_SELECTOR = 'td.col-learners[data-key]';
  let curKey = null;
  document.addEventListener('mouseover', e => {
    const cell = e.target.closest(HOVER_SELECTOR);
    if (!cell) {
      if (curKey) { tip.style.display = 'none'; curKey = null; }
      return;
    }
    const key = cell.dataset.key;
    if (key === curKey) return;
    curKey = key;
    const m = moves.find(x => x.key === key);
    if (!m || !m.learners || m.learners.length === 0) {
      tip.style.display = 'none';
      return;
    }
    const i18nPoke = (window.I18N && window.I18N.pokemon) ? window.I18N.pokemon : (n) => n;
    const list = m.learners.map(l =>
      `<span class="wt-learner">${i18nPoke(l.name)}<span class="wt-tot">${l.total}</span></span>`
    ).join('');
    const wtMoveName = (window.I18N && I18N.move) ? I18N.move(m.key, m.name) : m.name;
    const wtTitle = _t('waza.learners_title_hover', `${m.name} を習得 ${m.learners.length}匹 (種族値合計の降順)`)
      .replace('{name}', wtMoveName).replace('{n}', m.learners.length);
    tip.innerHTML = `
      <div class="wt-title">${wtTitle}</div>
      <div class="wt-list">${list}</div>
    `;
    tip.style.display = 'block';
  });
  document.addEventListener('mousemove', e => {
    if (tip.style.display === 'none') return;
    const pad = 14;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + tw > window.innerWidth - 5) x = e.clientX - tw - pad;
    if (y + th > window.innerHeight - 5) y = e.clientY - th - pad;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  });
  document.addEventListener('mouseout', e => {
    if (!e.relatedTarget || !e.relatedTarget.closest(HOVER_SELECTOR)) {
      tip.style.display = 'none';
      curKey = null;
    }
  });
})();

// 効果列 or わざ名ホバー: 技の全項目をリッチにポップアップ表示
(function setupDescHover() {
  const tip = document.getElementById('desc-tip');
  if (!tip) return;
  const SEL = 'td.col-effect.effect-cell, td.col-name[data-key]';
  let curCell = null;
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  document.addEventListener('mouseover', e => {
    const cell = e.target.closest(SEL);
    if (!cell) {
      if (curCell) { tip.style.display = 'none'; curCell = null; }
      return;
    }
    if (cell === curCell) return;
    curCell = cell;
    const key = cell.dataset.key;
    const m = key ? moves.find(x => x.key === key) : null;
    if (!m) {
      // フォールバック: 説明文だけ
      const desc = (cell.textContent || '').trim();
      if (!desc) { tip.style.display = 'none'; return; }
      tip.textContent = desc;
      tip.style.display = 'block';
      return;
    }
    const typeColor = typeColors[m.type] || '#999';
    const clsKey = m.class === '物理' ? 'phys' : m.class === '特殊' ? 'spec' : 'stat';
    const power = (m.power != null && m.power !== '') ? m.power : '—';
    const acc = (m.acc != null && m.acc !== '') ? m.acc : '—';
    const pp = (m.pp != null && m.pp !== '') ? m.pp : '—';
    const prob = m._prob != null ? m._prob + '%' : '—';
    const prio = m.priority || 0;
    const prioStr = prio > 0 ? '+' + prio : (prio < 0 ? String(prio) : '0');
    const target = m.target || '—';
    const mode = m.mode || '—';
    const contact = m.contact || '—';
    const guard = m.guard || '—';
    const category = m.category || '—';
    const effect = m.effect || '';

    // battle_data の構造化情報をバッジ表示
    const bdBadges = (() => {
      const bd = m.battle_data;
      if (!bd) return '';
      const out = [];
      // 急所
      if (bd.must_crit) out.push(`<span class="dt-bd crit-must">💥 必中急所</span>`);
      else if (bd.crit_stage > 0) out.push(`<span class="dt-bd crit">🎯 急所+${bd.crit_stage}</span>`);
      if (bd.crit_changes && bd.crit_changes.length > 0) {
        bd.crit_changes.forEach(c => {
          const tgt = c.target === 'self' ? '自分' : c.target === 'ally' ? '味方' : '相手';
          out.push(`<span class="dt-bd crit">🎯 ${tgt}急所+${c.delta}</span>`);
        });
      }
      // 連続技
      if (bd.multi_hit) {
        const label = bd.multi_hit === 'thrash' ? '2-3T暴れ' : bd.multi_hit + '回';
        out.push(`<span class="dt-bd multi">⚡ ${label}</span>`);
      }
      // 反動
      if (bd.recoil) {
        const label = bd.recoil === 'on_miss' ? '外し時HP半減' : '反動 ' + bd.recoil;
        out.push(`<span class="dt-bd recoil">💢 ${label}</span>`);
      }
      // 吸収
      if (bd.drain) {
        const label = bd.drain === 'seed' ? 'やどりぎ式' : '吸収 ' + bd.drain;
        out.push(`<span class="dt-bd drain">🩸 ${label}</span>`);
      }
      // 回復
      if (bd.recovery) {
        const labels = {'1/2':'HP1/2回復','weather':'天候依存回復','per_turn':'毎ターン回復','status_only':'状態異常治癒','swap':'自身犠牲回復','takuwaeru':'たくわえる連動'};
        out.push(`<span class="dt-bd recov">💚 ${labels[bd.recovery] || bd.recovery}</span>`);
      }
      // ため
      if (bd.charge) {
        const labels = {'normal':'2ターン目に攻撃','invulnerable':'半無敵化','with_stat_up':'1T能力UP+2T攻撃'};
        const skip = bd.charge_skip_in_weather ? ' (天候で省略)' : '';
        out.push(`<span class="dt-bd charge">⏳ ${labels[bd.charge] || bd.charge}${skip}</span>`);
      }
      // 再使用不可
      if (bd.recharge) out.push(`<span class="dt-bd charge">🔁 使用後動けない</span>`);
      // 天候設定
      if (bd.weather_set) {
        const labels = {'sunny':'☀️ 晴れに','rain':'🌧️ あめに','snow':'❄️ ゆきに','sand':'🌪️ すなあらしに'};
        out.push(`<span class="dt-bd field">${labels[bd.weather_set] || bd.weather_set}</span>`);
      }
      // フィールド設定
      if (bd.field_set) {
        const labels = {'electric':'⚡ エレキフィールド','grass':'🌿 グラスフィールド','psychic':'🔮 サイコフィールド','misty':'🌫️ ミストフィールド'};
        out.push(`<span class="dt-bd field">${labels[bd.field_set] || bd.field_set}</span>`);
      }
      // 設置
      if (bd.hazard_set) {
        const labels = {'spikes':'📌 まきびし','toxic_spikes':'☠️ どくびし','stealth_rock':'🪨 ステルスロック','sticky_web':'🕸️ ねばねばネット'};
        out.push(`<span class="dt-bd hazard">${labels[bd.hazard_set] || bd.hazard_set}</span>`);
      }
      if (bd.remove_hazards) out.push(`<span class="dt-bd field">🧹 設置解除</span>`);
      if (bd.field_remove) out.push(`<span class="dt-bd field">🧹 フィールド破壊</span>`);
      // 副作用 (状態異常・ひるみ)
      if (bd.effects && bd.effects.length > 0) {
        const STATUS_ICON = {'まひ':'⚡','やけど':'🔥','こおり':'❄️','ねむり':'💤','どく':'☠️','もうどく':'💀','こんらん':'🌀','メロメロ':'💕'};
        bd.effects.forEach(e => {
          if (e.kind === 'flinch') {
            out.push(`<span class="dt-bd effect">😵 ${e.prob}%ひるみ</span>`);
          } else if (e.kind === 'status') {
            const icon = STATUS_ICON[e.value] || '🩻';
            out.push(`<span class="dt-bd effect">${icon} ${e.prob}%${e.value}</span>`);
          }
        });
      }
      // ランク変動
      if (bd.rank_changes && bd.rank_changes.length > 0) {
        const STAT_JP = {atk:'攻',def:'防',spa:'特攻',spd:'特防',spe:'速',acc:'命中',eva:'回避'};
        const TGT_JP = {self:'自',ally:'味',opp:'相'};
        bd.rank_changes.forEach(r => {
          const tgt = TGT_JP[r.target] || '?';
          const stat = STAT_JP[r.stat] || r.stat;
          const sign = r.delta > 0 ? '+' : '';
          const probTxt = r.prob < 100 ? `${r.prob}% ` : '';
          out.push(`<span class="dt-bd rank">📊 ${probTxt}${tgt}${stat}${sign}${r.delta}</span>`);
        });
      }
      return out.length > 0 ? `<div class="dt-bd-row">${out.join('')}</div>` : '';
    })();

    // 習得ポケモン上位20匹 (種族値合計順、moves構築時にソート済み)
    const learners = m.learners || [];
    const top20 = learners.slice(0, 20);
    const i18nPoke = (window.I18N && window.I18N.pokemon) ? window.I18N.pokemon : (n) => n;
    const noLearnersTxt = _t('waza.no_learners', '習得ポケモンなし');
    const learnerListHtml = top20.length > 0
      ? top20.map(l =>
          `<span class="dt-learner">${escHtml(i18nPoke(l.name))}<span class="dt-learner-tot">${l.total}</span></span>`
        ).join('')
      : `<span class="dt-no-learner">${noLearnersTxt}</span>`;
    const learnerTitleHtml = learners.length > 0
      ? _t('waza.learners_top_n', `習得 ${learners.length}匹 中 上位${Math.min(20, learners.length)}匹 (種族値合計の降順)`)
          .replace('{total}', learners.length).replace('{top}', Math.min(20, learners.length))
      : noLearnersTxt;
    const dtMoveName = (window.I18N && I18N.move) ? I18N.move(m.key, m.name) : m.name;
    const dtTypeName = (window.I18N && I18N.type) ? I18N.type(m.type) : m.type;

    tip.innerHTML = `
      <div class="dt-title">
        <span class="dt-name">${escHtml(dtMoveName)}</span>
        <span class="dt-type" style="background:${typeColor}">${escHtml(dtTypeName)}</span>
        <span class="dt-cls cls-${clsKey}">${escHtml(tClass(m.class))}</span>
      </div>
      <div class="dt-stats">
        <span><b>${_t('table.move_power', '威力')}</b>${escHtml(power)}</span>
        <span><b>${_t('table.move_accuracy', '命中')}</b>${escHtml(acc)}</span>
        <span><b>${_t('table.move_pp', 'PP')}</b>${escHtml(pp)}</span>
        <span><b>${_t('checker.col_move_prob', '確率')}</b>${escHtml(prob)}</span>
        <span><b>${_t('table.move_priority', '優先度')}</b>${escHtml(prioStr)}</span>
      </div>
      <div class="dt-meta">
        <span><b>${_t('checker.col_move_target', '対象')}</b>${escHtml(tTarget(target))}</span>
        <span><b>${_t('waza.col_mode', '対戦')}</b>${escHtml(tMode(mode))}</span>
        <span><b>${_t('checker.col_move_contact', '接触')}</b>${escHtml(tContact(contact))}</span>
        <span><b>${_t('checker.col_move_guard', '守貫')}</b>${escHtml(tGuard(guard))}</span>
        <span><b>${_t('waza.col_category', 'カテゴリ')}</b>${escHtml(tCategory(category))}</span>
        ${(() => {
          const bd = m.battle_data;
          if (!bd) return '';
          const parts = [];
          if (bd.must_crit) parts.push(`<span style="color:#c00;font-weight:700">${_t('waza.label_crit_must', '必中急所')}</span>`);
          else if (bd.crit_stage > 0) parts.push(`<span><b>${_t('waza.label_crit_stage', '急所')}</b>+${bd.crit_stage}</span>`);
          if (bd.crit_changes && bd.crit_changes.length > 0) {
            const cc = bd.crit_changes.map(c => {
              const tgtLbl = c.target === 'self' ? _t('waza.tgt_short_self', '自分')
                            : c.target === 'ally' ? _t('waza.tgt_short_ally', '味方')
                            : _t('waza.tgt_short_opp', '相手');
              return `${tgtLbl}${_t('waza.label_crit_stage', '急所')}+${c.delta}`;
            }).join(',');
            parts.push(`<span><b>${_t('waza.label_crit_change', '急変')}</b>${cc}</span>`);
          }
          return parts.join('');
        })()}
      </div>
      <div class="dt-desc">${escHtml(effect)}</div>
      ${bdBadges}
      <div class="dt-learners-title">${learnerTitleHtml}</div>
      <div class="dt-learners">${learnerListHtml}</div>
    `;
    tip.style.display = 'block';
  });
  document.addEventListener('mousemove', e => {
    if (tip.style.display === 'none') return;
    const pad = 16;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + tw > window.innerWidth - 5)  x = e.clientX - tw - pad;
    if (y + th > window.innerHeight - 5) y = e.clientY - th - pad;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top  = Math.max(4, y) + 'px';
  });
  document.addEventListener('mouseout', e => {
    if (!e.relatedTarget || !e.relatedTarget.closest(SEL)) {
      tip.style.display = 'none';
      curCell = null;
    }
  });
})();

// === 動的ポケモンフィルタ ===
function refreshPokemonFilterBanner() {
  // 旧バナーは廃止。代わりに wp-poke-trigger を更新
  const trigger = document.getElementById('wp-poke-trigger');
  if (!trigger) return;
  const label = trigger.querySelector('.wp-poke-label');
  if (!INITIAL_POKEMON_FILTER) {
    trigger.classList.remove('has-val');
    if (label) label.textContent = _t('waza.poke_select_all', '🧬 ポケモン選択 ▾');
  } else {
    trigger.classList.add('has-val');
    const cnt = moves.filter(m => (m.learners || []).some(l => l.name === INITIAL_POKEMON_FILTER)).length;
    if (label) label.textContent = '🧬 ' + INITIAL_POKEMON_FILTER + ' (' + cnt + '件) ▾';
  }
}
function setPokemonFilter(name) {
  INITIAL_POKEMON_FILTER = name || null;
  refreshPokemonFilterBanner();
  if (INITIAL_POKEMON_FILTER) {
    document.title = INITIAL_POKEMON_FILTER + ' のわざ - ポケチャン';
  } else {
    document.title = 'ポケチャン わざリスト';
  }
  syncWpTypeBar();
  render();
}

// === タイプ別ボタン群 ===
function buildWpTypeBar() {
  const bar = document.getElementById('wp-type-bar');
  if (!bar) return;
  bar.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'wp-type-btn all-types';
  allBtn.textContent = (window.I18N ? I18N.t('checker.show_all_types', '全タイプ表示') : '全タイプ表示');
  allBtn.onclick = () => {
    selectedTypes.clear();
    syncWpTypeBar();
    if (typeof syncTypeCheckboxes === 'function') syncTypeCheckboxes();
    if (typeof updateTypeBtnLabel === 'function') updateTypeBtnLabel();
    render();
  };
  bar.appendChild(allBtn);

  const TYPE_ORDER = ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
  TYPE_ORDER.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wp-type-btn';
    btn.textContent = wpType3(t);
    btn.style.background = (typeof typeColors !== 'undefined' && typeColors[t]) || '#888';
    btn.dataset.type = t;
    btn.title = t;
    btn.onclick = () => {
      if (selectedTypes.has(t) && selectedTypes.size === 1) {
        selectedTypes.clear();
      } else {
        selectedTypes.clear();
        selectedTypes.add(t);
      }
      syncWpTypeBar();
      if (typeof syncTypeCheckboxes === 'function') syncTypeCheckboxes();
      if (typeof updateTypeBtnLabel === 'function') updateTypeBtnLabel();
      render();
    };
    bar.appendChild(btn);
  });
  syncWpTypeBar();
}
function syncWpTypeBar() {
  const bar = document.getElementById('wp-type-bar');
  if (!bar) return;
  const allBtn = bar.querySelector('.wp-type-btn.all-types');
  if (allBtn) allBtn.classList.toggle('active', selectedTypes.size === 0);
  // ポケモンフィルタ適用後の各タイプ可用件数 (0 件のタイプはボタン無効化)
  const typeCounts = {};
  const pokeFiltered = INITIAL_POKEMON_FILTER
    ? moves.filter(m => (m.learners || []).some(l => l.name === INITIAL_POKEMON_FILTER))
    : moves;
  pokeFiltered.forEach(m => { typeCounts[m.type] = (typeCounts[m.type] || 0) + 1; });
  let anySelectionCleared = false;
  bar.querySelectorAll('.wp-type-btn[data-type]').forEach(b => {
    const t = b.dataset.type;
    const cnt = typeCounts[t] || 0;
    b.disabled = (cnt === 0);
    b.classList.toggle('zero-cnt', cnt === 0);
    if (cnt === 0 && selectedTypes.has(t)) {
      selectedTypes.delete(t);
      anySelectionCleared = true;
    }
    b.classList.toggle('active', selectedTypes.has(t));
    b.title = (cnt === 0 && INITIAL_POKEMON_FILTER)
      ? t + ' (このポケモンは習得しません)'
      : t + ' (' + cnt + '件)';
  });
  if (anySelectionCleared && typeof syncTypeCheckboxes === 'function') syncTypeCheckboxes();
}

// === わざ名オートコンプリート (検索ボックス) ===
function setupWpSearchAutocomplete() {
  const input = document.getElementById('search');
  const sug = document.getElementById('wp-search-suggest');
  if (!input || !sug) return;

  let kbdIdx = -1;
  function buildSuggestions(q) {
    sug.innerHTML = '';
    const qHira = toHira(q);
    if (!qHira) { sug.classList.remove('vis'); return; }
    const wazaHits = moves
      .filter(m => moveSearchKey(m).includes(qHira))
      .slice(0, 12);
    if (!wazaHits.length) {
      sug.innerHTML = '<div class="wp-sug-empty">該当なし</div>';
      sug.classList.add('vis');
      return;
    }
    wazaHits.forEach(m => {
      const dn = moveDisplayName(m);
      const tn = (window.I18N && I18N.type) ? I18N.type(m.type) : (m.type || '');
      const item = document.createElement('div');
      item.className = 'wp-sug-item';
      item.innerHTML = '<span class="wp-sug-tag sug-waza">技</span><span class="wp-sug-name">' +
        dn + '</span><span class="wp-sug-meta">' + tn + '</span>';
      item.dataset.name = dn;
      item.onmousedown = (e) => { e.preventDefault(); chooseWaza(dn); };
      sug.appendChild(item);
    });
    sug.classList.add('vis');
    kbdIdx = -1;
  }
  function chooseWaza(name) {
    input.value = name;
    sug.classList.remove('vis');
    render();
  }
  input.addEventListener('input', () => buildSuggestions(input.value));
  input.addEventListener('focus', () => { if (input.value) buildSuggestions(input.value); });
  input.addEventListener('blur', () => { setTimeout(() => sug.classList.remove('vis'), 150); });
  input.addEventListener('keydown', (e) => {
    if (!sug.classList.contains('vis')) return;
    const items = [...sug.querySelectorAll('.wp-sug-item')];
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      kbdIdx = (kbdIdx + 1) % items.length;
      items.forEach((it, i) => it.classList.toggle('kbd-hover', i === kbdIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      kbdIdx = (kbdIdx - 1 + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('kbd-hover', i === kbdIdx));
    } else if (e.key === 'Enter') {
      if (kbdIdx >= 0) {
        e.preventDefault();
        chooseWaza(items[kbdIdx].dataset.name);
      }
    } else if (e.key === 'Escape') {
      sug.classList.remove('vis');
    }
  });
}

// === ポケモン選択ドロップダウン ===
function setupWpPokeDropdown() {
  const trigger = document.getElementById('wp-poke-trigger');
  const panel = document.getElementById('wp-poke-panel');
  const search = document.getElementById('wp-poke-search');
  const listEl = document.getElementById('wp-poke-list');
  if (!trigger || !panel || !search || !listEl) return;
  if (typeof POKEMON_LIST === 'undefined') return;

  let kbdIdx = -1;
  function fullName(p) {
    return p.form && p.form !== '通常' ? p.name + '(' + p.form + ')' : p.name;
  }
  function renderList(q) {
    listEl.innerHTML = '';
    // 「全ポケモン」項目を先頭に
    const allItem = document.createElement('div');
    allItem.className = 'wp-poke-list-item is-all';
    allItem.innerHTML = '<span class="pl-name">🌐 全ポケモン (絞り込み解除)</span>';
    allItem.onmousedown = (e) => { e.preventDefault(); pick(null); };
    listEl.appendChild(allItem);

    const qHira = toHira(q);
    const filtered = POKEMON_LIST.filter(p => {
      if (!qHira) return true;
      return toHira(fullName(p)).includes(qHira);
    }).slice(0, 200);
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'wp-poke-empty';
      empty.textContent = '該当なし';
      listEl.appendChild(empty);
      return;
    }
    filtered.forEach(p => {
      const item = document.createElement('div');
      item.className = 'wp-poke-list-item';
      const formTag = p.form && p.form !== '通常' ? '<span class="pl-form">(' + p.form + ')</span>' : '';
      item.innerHTML = '<span class="pl-name">' + p.name + '</span>' + formTag;
      item.dataset.name = p.name;
      item.onmousedown = (e) => { e.preventDefault(); pick(p.name); };
      listEl.appendChild(item);
    });
    kbdIdx = -1;
  }
  function open() {
    panel.classList.add('vis');
    search.value = '';
    renderList('');
    setTimeout(() => search.focus(), 30);
  }
  function close() {
    panel.classList.remove('vis');
  }
  function pick(name) {
    close();
    setPokemonFilter(name);
  }
  trigger.addEventListener('click', (e) => {
    // × クリック時は解除のみでパネルを開かない
    if (e.target.classList.contains('wp-poke-clear')) {
      e.stopPropagation();
      setPokemonFilter(null);
      return;
    }
    if (panel.classList.contains('vis')) close();
    else open();
  });
  search.addEventListener('input', () => renderList(search.value));
  search.addEventListener('keydown', (e) => {
    const items = [...listEl.querySelectorAll('.wp-poke-list-item')];
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      kbdIdx = (kbdIdx + 1) % items.length;
      items.forEach((it, i) => it.classList.toggle('kbd-hover', i === kbdIdx));
      items[kbdIdx].scrollIntoView({block:'nearest'});
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      kbdIdx = (kbdIdx - 1 + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('kbd-hover', i === kbdIdx));
      items[kbdIdx].scrollIntoView({block:'nearest'});
    } else if (e.key === 'Enter') {
      if (kbdIdx >= 0) {
        e.preventDefault();
        const name = items[kbdIdx].dataset.name || null;
        pick(name);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  });
  // 外側クリックで閉じる
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('vis')) return;
    if (trigger.contains(e.target) || panel.contains(e.target)) return;
    close();
  });
}

// === 動的固定オフセット計算 ===
// .top-bar の高さを CSS 変数 --top-bar-height に反映 → thead が追随
function adjustStickyOffsets() {
  const topBar = document.querySelector('.top-bar');
  if (!topBar) return;
  const h = topBar.offsetHeight;
  document.documentElement.style.setProperty('--top-bar-height', h + 'px');
}

// === 選択モード (multi/single 共通: 左端チェックボックス + 確定ボタン) ===
function setupSelectionMode() {
  if (WP_MODE !== 'multi' && WP_MODE !== 'single') return;
  document.body.classList.add(WP_MODE === 'multi' ? 'wp-mode-multi' : 'wp-mode-single');
  // single モードでは初期選択も 1 件に制限
  if (WP_MODE === 'single' && WP_SELECTED.size > 1) {
    const first = [...WP_SELECTED][0];
    WP_SELECTED = new Set([first]);
  }

  // モードタイトル
  const titleEl = document.getElementById('wp-mode-title');
  if (titleEl) {
    const slotLabel = WP_SLOT_NO ? '【スロット' + WP_SLOT_NO + '】' : '';
    const pokeLabel = INITIAL_POKEMON_FILTER ? ' ' + INITIAL_POKEMON_FILTER : '';
    const suffix = WP_MODE === 'multi' ? ' 技を選択 (複数可)' : ' 技を選択 (1つだけ)';
    titleEl.textContent = slotLabel + pokeLabel + suffix;
  }

  // チェックボックスのクリック (イベント委譲)
  const tbody = document.getElementById('tbody');
  if (tbody) {
    tbody.addEventListener('change', e => {
      if (!e.target.classList.contains('wp-row-chk')) return;
      const key = e.target.dataset.key;
      if (WP_MODE === 'single') {
        // 他のチェックを全解除して自分だけチェック
        if (e.target.checked) {
          WP_SELECTED.clear();
          WP_SELECTED.add(key);
          document.querySelectorAll('#tbody .wp-row-chk').forEach(cb => {
            if (cb !== e.target) cb.checked = false;
          });
          document.querySelectorAll('#tbody tr.row-checked').forEach(tr => tr.classList.remove('row-checked'));
          const tr = e.target.closest('tr');
          if (tr) tr.classList.add('row-checked');
        } else {
          WP_SELECTED.delete(key);
          const tr = e.target.closest('tr');
          if (tr) tr.classList.remove('row-checked');
        }
      } else {
        if (e.target.checked) WP_SELECTED.add(key);
        else WP_SELECTED.delete(key);
        const tr = e.target.closest('tr');
        if (tr) tr.classList.toggle('row-checked', e.target.checked);
        syncChkAll();
      }
      refreshConfirmBar();
    });
  }

  // 選択操作メニュー (multi のみ): チェック中のみ表示 / すべて解除(確認付き)
  const selWrap = document.getElementById('wp-selmenu');
  if (WP_MODE === 'single') {
    if (selWrap) selWrap.style.display = 'none';
  } else {
    const co = document.getElementById('wp-checked-only');
    if (co) {
      co.checked = wpCheckedOnly;
      co.addEventListener('change', () => { wpCheckedOnly = co.checked; render(); });
    }
    const clrSel = document.getElementById('wp-clear-sel');
    if (clrSel) clrSel.addEventListener('click', () => {
      if (!clearAllSelected()) return;
      closeSelMenu();
    });
  }

  // 確定バーのボタン
  const okBtn = document.querySelector('#wp-confirm-bar .wp-conf-ok');
  const cancelBtn = document.querySelector('#wp-confirm-bar .wp-conf-cancel');
  const clearBtn = document.querySelector('#wp-confirm-bar .wp-conf-clear');
  if (okBtn) okBtn.addEventListener('click', confirmSelection);
  if (cancelBtn) cancelBtn.addEventListener('click', cancelSelection);
  if (clearBtn) {
    if (WP_MODE === 'single') clearBtn.style.display = 'none';
    else clearBtn.addEventListener('click', () => { clearAllSelected(); });
  }

  refreshConfirmBar();
}
// 選択を全解除 (確認付き)。実行したら true、キャンセルしたら false
function clearAllSelected() {
  const n = WP_SELECTED.size;
  if (n > 0) {
    const msg = _t('waza.confirm_clear_all', '選択中の {n} 件をすべて解除しますか？').replace('{n}', n);
    if (!confirm(msg)) return false;
  }
  WP_SELECTED.clear();
  wpCheckedOnly = false;
  const co = document.getElementById('wp-checked-only');
  if (co) co.checked = false;
  render();
  refreshConfirmBar();
  return true;
}
// 旧 API 互換 (init で呼ばれる)
function setupSingleMode() { /* no-op: setupSelectionMode が両対応 */ }
function setupMultiMode()  { /* no-op: setupSelectionMode が両対応 */ }
function syncChkAll() {
  const chkAll = document.getElementById('wp-chk-all');
  if (!chkAll) return;
  const visibleChks = [...document.querySelectorAll('#tbody .wp-row-chk')];
  const checkedCount = visibleChks.filter(c => c.checked).length;
  chkAll.checked = visibleChks.length > 0 && checkedCount === visibleChks.length;
  chkAll.indeterminate = checkedCount > 0 && checkedCount < visibleChks.length;
}
function refreshConfirmBar() {
  const cnt = document.querySelector('#wp-confirm-bar .wp-conf-count');
  if (cnt) cnt.textContent = WP_SELECTED.size + ' 件選択中';
}
function confirmSelection() {
  const selected = [...WP_SELECTED];
  let payload;
  if (WP_MODE === 'multi') {
    payload = { type: 'waza-picker:confirm', slot: WP_SLOT_NO, pokemon: INITIAL_POKEMON_FILTER, keys: selected };
  } else {
    payload = { type: 'waza-picker:pick', slot: WP_SLOT_NO, pokemon: INITIAL_POKEMON_FILTER, key: selected[0] || null };
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, '*');
  } else {
    console.log('[waza-picker confirm]', payload);
    alert(JSON.stringify(payload));
  }
}
function cancelSelection() {
  const payload = { type: 'waza-picker:cancel' };
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, '*');
  }
}

// 親モーダルからの確定要求 (背景クリック時など) → 現在の選択で confirm を返す
window.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d && d.type === 'waza-picker:request-confirm') confirmSelection();
});

// === ポケロック (mode=multi/single + ?lock=1 で wp-poke-trigger を無効化) ===
function applyPokeLock() {
  if (!WP_LOCK_POKEMON) return;
  const trigger = document.getElementById('wp-poke-trigger');
  if (!trigger) return;
  trigger.classList.add('locked');
  trigger.disabled = true;
  // パネル開閉を無効化するため click ハンドラを置き換える
  const newClone = trigger.cloneNode(true);
  trigger.parentNode.replaceChild(newClone, trigger);
}

// 初期化
buildWpTypeBar();
setupWpSearchAutocomplete();
setupWpPokeDropdown();
refreshPokemonFilterBanner();
applyPokeLock();
setupSelectionMode();
adjustStickyOffsets();
window.addEventListener('resize', adjustStickyOffsets);
// レイアウト後 (フォント読み込み等の影響を吸収)
setTimeout(adjustStickyOffsets, 100);
setTimeout(adjustStickyOffsets, 400);

render();
if (WP_MODE === 'multi' || WP_MODE === 'single') {
  // render 後にチェック状態を反映
  refreshConfirmBar();
  if (WP_MODE === 'multi') syncChkAll();
}

// ★2026-06-18: 旧フィルタチップ全部に「◯件」のカウント表示を追加(0件ヒットでユーザーが困らないように)
(function annotateOldChips() {
  const chips = document.querySelectorAll('.ef-chip');
  chips.forEach(chip => {
    const type = chip.dataset.efType;
    const val = chip.dataset.efVal;
    if (!type || !val) return;
    // 全moveに対して該当チップが効くかカウント
    let cnt = 0;
    for (const m of moves) {
      const flags = m.flags || {};
      const bd = m.battle_data || {};
      const effects = bd.effects || [];
      let hit = false;
      try {
        if (type === 'flag') hit = !!flags[val];
        else if (type === 'status') {
          if (val === 'ひるみ') hit = effects.some(e => e.kind === 'ひるみ' || (e.kind === '状態付与' && e.value === 'ひるみ'));
          else if (val === 'どく') hit = effects.some(e => e.kind === '状態付与' && (e.value === 'どく' || e.value === 'もうどく'));
          else hit = effects.some(e => e.kind === '状態付与' && e.value === val);
        } else if (type === 'target') {
          const PAT = { '相手全体': ['相手全体','全体','自分以外全体'], '自分以外':['自分以外全体','相手全体','全体'], '味方':['味方1体','味方全体','味方の場','自分か味方'], '場':['全体の場','相手の場','味方の場'] };
          hit = (PAT[val] || []).some(p => (m.target || '') === p);
        } else if (['self_up2','self_up1','opp_down2','opp_down1','self_down2','self_down1'].includes(type)) {
          const SK = {'こうげき':'atk','ぼうぎょ':'def','とくこう':'spa','とくぼう':'spd','すばやさ':'spe','命中率':'acc','回避率':'eva'};
          const RC = { self_up2:['self',d=>d>=2], self_up1:['self',d=>d===1], opp_down2:['opp',d=>d<=-2], opp_down1:['opp',d=>d===-1], self_down2:['self',d=>d<=-2], self_down1:['self',d=>d===-1] };
          const [tgt, check] = RC[type];
          const key = SK[val];
          hit = (bd.rank_changes || []).some(r => r.target === tgt && r.stat === key && check(r.delta));
        }
        // exclude/misc は判定が複雑なのでスキップ(ハードコード件数なし)
      } catch (e) { hit = false; }
      if (hit) cnt++;
    }
    // exclude/misc系も簡易判定
    if (cnt === 0 && (type === 'misc' || type === 'exclude')) return; // 判定が複雑なので件数省略
    // 件数表示を追記
    if (cnt > 0 || ['flag','status','target','self_up2','self_up1','opp_down2','opp_down1','self_down2','self_down1'].includes(type)) {
      const badge = document.createElement('span');
      badge.className = 'ef-chip-count';
      badge.textContent = ' ' + cnt;
      badge.style.cssText = 'margin-left:3px;font-size:10px;color:' + (cnt === 0 ? '#bbb' : '#7a8aa0') + ';font-weight:600';
      chip.appendChild(badge);
      if (cnt === 0) chip.style.opacity = '0.45';
    }
  });
})();

// ★2026-06-18: 新タグチップ生成と絞り込み連携(私たちが整備した126フィルタ向きタグ)
// ★2026-06-18 ダブり整理: 旧フィルタチップと完全テキスト一致するタグは新タグ側から除外(同じ内容を二重表示しない)
const OLD_FILTER_TAGS = new Set([
  '💀 一撃必殺', '🎭 タイプ変更', '✨ 特性変更', '🎁 道具変更',
  '⚡ まひ', '💤 ねむり', '🔥 やけど', '☠️ どく', '🌀 こんらん', '😵 ひるみ',
  '💥 必中急所', '🎯 必中', '💔 失敗ダメージ', '💀 瀕死技',
  '🔗 バインド', '🔄 相手交代', '↩️ 自分交代', '🪤 交代不可',
  '🌬️ 追い風', '🌌 重力', '🛡️ まもる貫通', '🧹 設置解除',
  '🤝 サポートW', '👻 みがわり貫通'
]);
(function setupNewTagFilter() {
  const box = document.getElementById('newTagChips');
  if (!box) return;
  // 全技から新タグを集計(1技以上)→ 2技以上=フィルタ向きだけ採用 + 旧フィルタとの重複を除外
  const tagCount = {};
  for (const m of moves) {
    const tags = getMoveFilterTags(m);
    for (const t of tags) {
      if (OLD_FILTER_TAGS.has(t.text)) continue;
      const key = t.text; tagCount[key] = (tagCount[key] || 0) + 1;
    }
  }
  // ★2026-06-18: 並び順を「素テキストでグループ化→グループの最大頻度降順→グループ内は確率降順」
  // 旧: 全部頻度降順 → 30%ひるみ/20%ひるみ/10%ひるみ が散らばっていた
  const tagBase = (t) => t.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^(\d+)%\s?/, '').trim();
  const tagPct  = (t) => { const m = t.match(/(\d+)%/); return m ? parseInt(m[1], 10) : 0; };
  const groups = {};
  for (const [t, c] of Object.entries(tagCount)) {
    if (c < 2) continue;
    const b = tagBase(t);
    (groups[b] = groups[b] || { base: b, max: 0, items: [] });
    groups[b].items.push({ tag: t, count: c, pct: tagPct(t) });
    if (c > groups[b].max) groups[b].max = c;
  }
  const filterTags = Object.values(groups)
    .sort((a, b) => b.max - a.max || a.base.localeCompare(b.base, 'ja'))
    .flatMap(g => g.items.sort((a, b) => b.pct - a.pct || b.count - a.count).map(x => [x.tag, x.count]));
  const active = new Set();
  function applyNewTags() {
    document.querySelectorAll('.new-tag-chip').forEach(el => {
      el.classList.toggle('on', active.has(el.dataset.tag));
    });
    render();
  }
  window.__newTagActive = active;
  // ★2026-06-18 阿部さん指摘: 詳細タグも旧フィルタと同じジャンル分けに(技フラグ/状態異常/能力ランク/タイミング/...)
  function detailCategory(t) {
    if (/^👊 パンチ|^🔊 音|^🔵 弾|^〰️ 波動/.test(t)) return 'flag';
    if (/^😵|^⚡.*まひ|^💤|^❄️|^🔥|^☠️|^💀(?!.*瀕死)|^🌀(?!.*ルーム)|^💕|もうどく|メロメロ|ねむけ|きゅうしょアップ\(自\)|ちいさくなる\(自\)/.test(t)) return 'status';
    if (/^📊 自/.test(t)) return 'self_rank';
    if (/^📊 相|^📊 味/.test(t)) return 'target_rank';
    if (/^🎯|^💥|^📈|連続|急所|必中|あばれ状態|反動|失敗|威力上昇|威力2倍|威力1\/2|威力可変|半無敵|たくわえる/.test(t)) return 'dmg';
    if (/^💚|^🩸|^💊|^💸|^🩹|^🪆|^🤝 自分と相手のHP/.test(t)) return 'hp';
    if (/^🌤|^🌿 フィールド|^🌀 ルーム|^🌬|^🌌|フィールドで威力/.test(t)) return 'field';
    if (/^📌|^🛡️ 壁|^🚧|まもる|ステルスロック/.test(t)) return 'hazard';
    if (/^🧹|フィールド破壊|壁破壊|防御貫通|ランクリセット/.test(t)) return 'clear';
    if (/^🔗|^🪤|^🔄|^↩️|^🎽|^🪞|^🎭|^🏷|^💨|交代|拘束|タイプ追加|タイプコピー|タイプ変更/.test(t)) return 'switch';
    if (/^⚡ 先制|^🐢|ターン目|遅延|タイミング|2T後|3T後|ターンため/.test(t)) return 'timing';
    if (/^🔒|封じ|アンコール|ふういん/.test(t)) return 'block';
    if (/^🎒|^🍒|^🍃|^🎁|^🗑|持ち物|きのみ|道具/.test(t)) return 'item';
    if (/^🤝|サポート|引き寄せ/.test(t)) return 'support';
    return 'misc';
  }
  const CAT_LABEL = {
    flag: '技フラグ', status: '状態異常', self_rank: '自分能力', target_rank: '相手/味方能力',
    dmg: 'ダメ補正', hp: 'HP変化', field: '場の効果', hazard: '設置/守る',
    clear: '解除系', switch: '交代/タイプ', timing: 'タイミング', block: '技封じ',
    item: '持ち物', support: '援護', misc: 'その他'
  };
  const CAT_ORDER = ['flag','status','self_rank','target_rank','dmg','hp','timing','field','hazard','clear','switch','block','item','support','misc'];
  // カテゴリ毎にタグをグループ化
  const byCat = {};
  for (const [tag, count] of filterTags) {
    const cat = detailCategory(tag);
    (byCat[cat] = byCat[cat] || []).push([tag, count]);
  }
  for (const cat of CAT_ORDER) {
    const tags = byCat[cat];
    if (!tags || !tags.length) continue;
    const row = document.createElement('div');
    row.className = 'newtag-cat-row';
    row.dataset.cat = cat;
    const label = document.createElement('span');
    label.className = 'newtag-cat-label';
    label.textContent = CAT_LABEL[cat] + ':';
    row.appendChild(label);
    for (const [tag, count] of tags) {
      const chip = document.createElement('span');
      chip.className = 'new-tag-chip';
      chip.dataset.tag = tag;
      chip.innerHTML = tag + '<span class="c">' + count + '</span>';
      chip.addEventListener('click', () => {
        if (active.has(tag)) active.delete(tag); else active.add(tag);
        applyNewTags();
      });
      row.appendChild(chip);
    }
    box.appendChild(row);
  }
  // リセットボタン連携
  const resetBtn = document.querySelector('button[onclick="resetAll()"]');
  if (resetBtn) {
    const origReset = window.resetAll;
    window.resetAll = function () { active.clear(); applyNewTags(); if (origReset) origReset(); };
  }
})();
