/* pokedb.js — ★★データの参照元は「ここだけ」。全ページはこの1枚を読む。
 *
 * ★2026-07-31 全面的に作り替えた(阿部さんの指摘で設計を直した)
 *   「別にマスターがあれば pokedb.js って別に。結局は確認用のページのためでしょ。そもそもある必要あんの?」
 *
 *   → 指摘のとおりだった。前の版は **旧データ(pokechan_data*.js)を読み込む切替器** で、
 *     master を読むために 2.2MB の複製(pokedb_v2.js)まで作ろうとしていた。**データが2本に増える**。
 *   → 作り直した今の版は **データを1バイトも持たない「薄いローダ」**。
 *     master/*.json を読んで、ページに渡すだけ。**データは master ただ1つ**。
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │ master/*.json  ←★唯一のデータ。直すのはここだけ            │
 * │      ↑ fetch                                              │
 * │ pokedb.js(この1枚・データを持たない)                      │
 * │      ↑                                                    │
 * │ ページ                                                     │
 * └──────────────────────────────────────────────────────────┘
 *
 * 使い方(ページ側):
 *   <script src="pokedb.js?v=..."></script>
 *   PokeDB.ready.then(function () {  ... PokeDB.allPokemon() ... });
 *   ★読み込みは非同期(fetch)なので、必ず ready を待ってから使う。
 *
 * 絞り込み(Champions だけ / 全部):
 *   PokeDB.setMode('champions' | 'all')  … ★データは同じ1本。違うのは絞り込み条件だけ。
 *   URLに ?data=all / ?data=champions でも指定できる。既定は all(全部版)。
 *
 * ★禁止: ページから master/*.json や pokechan_data*.js を直接読むこと。
 *   (参照元が増えると、また分裂する。番人 tools/_ssot_guard_test.js が見張る)
 *   ※例外は「マスターの中身を検査するための道具」だけ。商品のページは必ずこの1枚を通す。
 *
 * ★軽量読み込み(オプトイン・2026-09-03): 既定は master/*.json を全部fetchする。
 *   タイプ相性表だけ・レギュレーションだけ等、一部しか要らないページは
 *   <script src="pokedb.js?v=..." data-files="types,regulations"></script>
 *   のように `data-files` にカンマ区切りでファイル名(拡張子なし)を書くと、その分だけ読む。
 *   省略時=全部(従来どおり)。★指定した名前以外は DB に入らない(raw()/allXxx() 等が空を返す)。
 *
 * ★窓口追加(2026-09-04・W11。masterに在るのにpokedb.jsに窓口が無かった項目を追加):
 *   PokeDB.typeKanji() / typeDisplay() / typeOffensiveStats() / defaultTypeOrder()
 *     … master/types.json の meta.tables を typeChart() と同じパターンで返す。
 *   PokeDB.move(key) … slug / champions_key / 日本語名 の順で1件引ける(champions_key対応を追加)。
 *   PokeDB.learners(moveName) … setMode('champions') 中は絞り込み後のポケモンだけで数える。
 *   PokeDB.learnsetKeys(name) … learnset(name)のslug版(技名が引けなければ元の名前のまま残す)。
 *   PokeDB.nature(name) … natures()から名前1件で引く薄いヘルパー。
 *
 * ★窓口追加(2026-09-04・W15。party_checker.html向け=派生値の計算窓口。データは持たない):
 *   PokeDB.statRankAll() / statRank(key) … 種族値からのLv50実数値・全国内順位の派生表(旧生成物STAT_RANK相当)。
 *     計算式は tools/build_views.js の buildStatRank と完全に同じ(コピペでなく同じ式)。母集団は
 *     現在の allPokemon()(=setMode()の絞り込み後)。結果は遅延計算してキャッシュし、setMode()で
 *     母集団が変わったら自動的に作り直す(キャッシュ破棄)。キーは statRankKey 形式
 *     (formが'通常'でなければ `${name}(${form})`、それ以外は name)。
 */
(function () {
  'use strict';

  var ALL_FILES = ['pokemon', 'moves', 'abilities', 'items', 'learnsets', 'regulations', 'types', 'natures'];

  // ── このスクリプト自身の <script> タグを特定する(base URLと data-files の両方に使う) ──
  function findScriptEl() {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (/pokedb\.js/.test(all[i].src)) { s = all[i]; break; }
      }
    }
    return s || null;
  }
  var SCRIPT_EL = findScriptEl();

  // ── master/ の場所を、このスクリプト自身の位置から決める ──────────────
  //   (ルート直下のページでも review/ 配下のページでも同じように動くように)
  function baseDir() {
    var src = (SCRIPT_EL && SCRIPT_EL.src) || '';
    return src.replace(/[^/]*$/, '') || '';
  }
  var BASE = baseDir() + 'master/';

  // ── 読むファイルを絞る(data-files 指定があればそれだけ・無ければ全部) ──────────
  var FILES = ALL_FILES;
  try {
    var wanted = SCRIPT_EL && SCRIPT_EL.getAttribute('data-files');
    if (wanted) {
      var picked = wanted.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return ALL_FILES.indexOf(s) !== -1; });
      if (picked.length) FILES = picked;
    }
  } catch (e) { /* 無指定=全部のまま */ }

  var DB = {};        // 生の master(ファイル名 → 中身)
  var IDX = {};       // 引きやすくした索引
  var mode = 'all';

  // ── showLoadError用の状態(W21・2026-09-05) ─────────────────────────────
  //   master/*.json が読めない時は大抵 fetch が即reject=まだ I18N の辞書fetchが終わっていない
  //   タイミングで呼ばれる(I18N.t()はcacheが無いとjaフォールバックを返す)。1回描いて終わりだと
  //   英語などに切り替えていても i18n が後から準備できた時に文言がjaのまま固まる。
  //   そこで最後の呼び出し内容を覚えておき、i18n:ready / i18n:changed で自動的に描き直す。
  var LOAD_ERROR_STATE = null; // { msg: string, targetEl: Element|null }
  var LOAD_ERROR_LISTENER_ADDED = false;
  var LOAD_ERROR_FALLBACK = 'データを読み込めませんでした({msg})。ページを再読み込みしてください';
  function renderLoadError() {
    if (!LOAD_ERROR_STATE) return;
    var tmpl = (window.I18N && I18N.t) ? I18N.t('common.db_load_error', LOAD_ERROR_FALLBACK) : LOAD_ERROR_FALLBACK;
    var text = tmpl.replace('{msg}', LOAD_ERROR_STATE.msg);
    var targetEl = LOAD_ERROR_STATE.targetEl;
    if (targetEl) {
      var tag = (targetEl.tagName || '').toUpperCase();
      targetEl.innerHTML = '';
      if (tag === 'TBODY' || tag === 'THEAD' || tag === 'TABLE') {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.setAttribute('colspan', '99');
        td.style.cssText = 'padding:24px;color:#c00';
        td.textContent = text;
        tr.appendChild(td);
        targetEl.appendChild(tr);
      } else {
        var div = document.createElement('div');
        div.style.cssText = 'padding:24px;color:#c00';
        div.textContent = text;
        targetEl.appendChild(div);
      }
      return;
    }
    // ★同じページで複数回呼ばれても(例: news.htmlのrenderMB/renderMCがi18n:ready/i18n:changed
    //   のたびに再実行される)バナーが積み重ならないよう、既存のバナーがあれば作り直さず更新する。
    var banner = document.body.querySelector('[data-pokedb-load-error]');
    if (!banner) {
      banner = document.createElement('div');
      banner.setAttribute('data-pokedb-load-error', '1');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#c00;color:#fff;' +
        'padding:10px 16px;font-size:14px;line-height:1.5;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.3)';
      document.body.insertBefore(banner, document.body.firstChild || null);
    }
    banner.textContent = text;
  }

  try {
    var q = new URLSearchParams(location.search).get('data');
    if (q === 'champions') mode = 'champions';
    if (q === 'all' || q === 'national') mode = 'all';
  } catch (e) { /* file:// 等 */ }

  function load() {
    return Promise.all(FILES.map(function (f) {
      return fetch(BASE + f + '.json')
        .then(function (r) {
          if (!r.ok) throw new Error('master/' + f + '.json (HTTP ' + r.status + ')');
          return r.json();
        })
        .then(function (j) { DB[f] = j; });
    })).then(buildIndex);
  }

  function buildIndex() {
    var moves = (DB.moves && DB.moves.items) || [];
    var pokes = (DB.pokemon && DB.pokemon.items) || [];
    var abis = (DB.abilities && DB.abilities.items) || [];
    var lrn = (DB.learnsets && DB.learnsets.items) || [];

    IDX.moveBySlug = {};
    IDX.moveByName = {};
    IDX.moveByChampKey = {};
    moves.forEach(function (m) {
      IDX.moveBySlug[m.slug] = m;
      if (!IDX.moveByName[m.name]) IDX.moveByName[m.name] = m;
      if (m.champions_key && !IDX.moveByChampKey[m.champions_key]) IDX.moveByChampKey[m.champions_key] = m;
    });

    IDX.abilityDesc = {};
    // ★2026-09-04(W18・pokemon_db_all.html): tools/build_views.js の abilityText() と同じ優先順位に修正。
    //   旧実装は effect_ja(公式の長文)だけを見ていたが、313件中309件は desc_house(家の流儀=短い子ども向け文)
    //   が正典で、effect_ja とは別内容(例: あくしゃく等ほぼ全件が食い違う)。旧実装のままだと
    //   PokeDB.abilityDesc() を使う全ページ(既に移行済みのpokemon_db.html/party_checker.html含む)が
    //   生成物ABILITY_DESCと違う文言を表示してしまう。desc_houseがあればそれを優先(build_views.jsと同じ式)。
    abis.forEach(function (a) { IDX.abilityDesc[a.name] = (a.desc_house != null ? a.desc_house : (a.effect_ja || '')); });

    IDX.abilityBySlug = {};
    IDX.abilityByName = {};
    abis.forEach(function (a) {
      if (a.slug) IDX.abilityBySlug[a.slug] = a;
      if (!IDX.abilityByName[a.name]) IDX.abilityByName[a.name] = a;
    });

    IDX.learn = {};
    lrn.forEach(function (p) { IDX.learn[p.name] = p.learn || []; });

    var learnByName = {};
    lrn.forEach(function (p) { learnByName[p.name] = p; });

    // ★「その技を覚えるポケモン」は master に無いので、ここで数え上げる(データは増やさない)。
    // ★2026-09-04(W18): 数え上げの順は master/pokemon.json の並び順で回す(learnsets.jsonの並びではない)。
    //   tools/build_views.js の buildLearnersIndex(MASTER.pokemon.map(p=>p.name), ...) と同じ式に揃える
    //   (pokemon.jsonとlearnsets.jsonは行の並びが違うため、順序が要る用途では取り違えると配列の並びがずれる)。
    // IDX.learners = Champions基準(learnのみ=いま実際に使える技だけ)。
    IDX.learners = {};
    // ★2026-09-04(W18・pokemon_db_all.html追加): 全国版(mode='all')の「その技を覚えるポケモン」は
    //   本編の全技=learn∪learn_legacy∪(championsなら没収confiscatedも含む)。
    //   tools/build_views.js の learnByNameNational/buildLearnersIndex と完全に同じ式(コピペでなく同じ計算)。
    //   これが無いと mode='all' でも Champions基準(learnのみ)の学習者数になってしまい、
    //   pokechan_data_all.js の WAZA_MAP.learners(旧作TM/没収技を含む本編全学習者)と食い違う。
    IDX.learnersNational = {};
    // ★2026-09-04(W18・pokemon_db_all.html追加): 順方向(ポケモン名→覚える技名の配列)の全国版版。
    //   PokeDB.learnset()は「mode非依存の生データ(learnのみ)」という既存の契約(damage_calc.html等が
    //   明示的に依存)があるため、learnset()自体は変えず、別名PokeDB.learnsetNational()を新設する
    //   (tools/build_views.js learnByNameNationalと同じ式=learn∪learn_legacy∪没収confiscated)。
    IDX.learnNational = {};
    pokes.forEach(function (p) {
      var l = learnByName[p.name];
      if (!l) return;
      (l.learn || []).forEach(function (mv) {
        (IDX.learners[mv] = IDX.learners[mv] || []).push(p.name);
      });
      var seen = {};
      (l.learn || []).forEach(function (mv) { seen[mv] = true; });
      (l.learn_legacy || []).forEach(function (mv) { seen[mv] = true; });
      if (l.champions) (l.confiscated || []).forEach(function (mv) { seen[mv] = true; });
      var union = Object.keys(seen);
      IDX.learnNational[p.name] = union;
      union.forEach(function (mv) {
        (IDX.learnersNational[mv] = IDX.learnersNational[mv] || []).push(p.name);
      });
    });

    IDX.typeColor = {};
    ((DB.types && DB.types.items) || []).forEach(function (t) { IDX.typeColor[t.name] = t.color; });

    IDX.pokeByName = {};
    pokes.forEach(function (p) { IDX.pokeByName[p.name] = p; });
  }

  /** ★絞り込みは「同じ1本のデータに条件をかける」だけ(別のデータを読むのではない) */
  function pick(arr) {
    if (mode === 'champions') return arr.filter(function (x) { return !!x.champions; });
    return arr;
  }

  // ══════════════════════════════════════════════════════════════════
  // STAT_RANK(★W15・2026-09-04追加): tools/build_views.js の buildStatRank と
  // 完全に同じ式(コピペではなく同じ計算を実装)。party_checker.html 用の計算窓口。
  // ══════════════════════════════════════════════════════════════════
  function lv50NonHp(base, boost) {
    var raw = Math.floor((2 * base + 31 + 63) * 0.5) + 5;
    return boost ? Math.floor(raw * boost) : raw;
  }
  function lv50Hp(base) { return Math.floor((2 * base + 31 + 63) * 0.5) + 60; }
  function statRankKeyFor(p) { return (p.form && p.form !== '通常') ? (p.name + '(' + p.form + ')') : p.name; }
  var STAT_RANK_FIELDS = ['hp_base', 'atk_base', 'def_base', 'spatk_base', 'spdef_base', 'spd_base', 'total_base',
    'hp_a', 'atk_a', 'def_a', 'spatk_a', 'spdef_a', 'spd_a', 'total_a',
    'atk_b', 'def_b', 'spatk_b', 'spdef_b', 'spd_b'];
  function buildStatRank(pokemonListRows) {
    var pop = pokemonListRows.filter(function (p) { return p.hp != null; });
    var rows = pop.map(function (p) {
      var hp_a = lv50Hp(p.hp), atk_a = lv50NonHp(p.atk), def_a = lv50NonHp(p.def),
        spatk_a = lv50NonHp(p.spatk), spdef_a = lv50NonHp(p.spdef), spd_a = lv50NonHp(p.spd);
      return {
        key: statRankKeyFor(p), no: p.no,
        hp_base: p.hp, atk_base: p.atk, def_base: p.def, spatk_base: p.spatk, spdef_base: p.spdef, spd_base: p.spd, total_base: p.total,
        hp_a: hp_a, atk_a: atk_a, def_a: def_a, spatk_a: spatk_a, spdef_a: spdef_a, spd_a: spd_a,
        total_a: hp_a + atk_a + def_a + spatk_a + spdef_a + spd_a,
        atk_b: lv50NonHp(p.atk, 1.1), def_b: lv50NonHp(p.def, 1.1), spatk_b: lv50NonHp(p.spatk, 1.1),
        spdef_b: lv50NonHp(p.spdef, 1.1), spd_b: lv50NonHp(p.spd, 1.1)
      };
    });
    var rankMaps = {};
    STAT_RANK_FIELDS.forEach(function (f) {
      var sorted = rows.slice().sort(function (a, b) { return b[f] - a[f]; });
      var m = new Map();
      sorted.forEach(function (r, i) { m.set(r.key, i > 0 && sorted[i - 1][f] === r[f] ? m.get(sorted[i - 1].key) : i + 1); });
      rankMaps[f] = m;
    });
    var out = {};
    rows.forEach(function (r) {
      var o = Object.assign({}, r); delete o.key;
      STAT_RANK_FIELDS.forEach(function (f) { o[f + '_rank'] = rankMaps[f].get(r.key); });
      out[r.key] = o;
    });
    return out;
  }
  var statRankCache = null, statRankCacheMode = null;

  var g = (typeof window !== 'undefined') ? window : globalThis;

  g.PokeDB = {
    /** ★読み込み完了を待つ約束。使う前に必ず待つ */
    ready: load(),

    get mode() { return mode; },
    get label() { return mode === 'champions' ? 'Champions版(絞り込み)' : '全部版(マスターそのまま)'; },
    /** 絞り込みを切り替える(データは読み直さない) */
    setMode: function (m) { mode = (m === 'champions') ? 'champions' : 'all'; return mode; },

    /** ポケモン全件(絞り込み後) */
    allPokemon: function () { return pick((DB.pokemon && DB.pokemon.items) || []); },
    /** 名前 or 図鑑番号で1体 */
    pokemon: function (key) {
      return IDX.pokeByName[key]
        || this.allPokemon().find(function (p) { return String(p.no) === String(key) || p.display_name === key; })
        || null;
    },

    /** 技 全件(slug → 技) */
    allMoves: function () {
      var out = {};
      pick((DB.moves && DB.moves.items) || []).forEach(function (m) { out[m.slug] = m; });
      return out;
    },
    /** slug でも champions_key でも日本語名でも引ける(★2026-09-04 champions_key対応) */
    move: function (key) { return IDX.moveBySlug[key] || IDX.moveByChampKey[key] || IDX.moveByName[key] || null; },
    /** 技の優先度(★master では最上位 priority に統一済み) */
    movePriority: function (mv) { return (mv && mv.priority) || 0; },
    /** その技を覚えるポケモンの名前(数え上げた結果)。
     *  ★2026-09-04: Championsモードでは、絞り込み後(pick()通過)のポケモンだけに数を絞る
     *  (以前はmode非依存で全国版の頭数をそのまま返していた=Champions表示で過大な人数になるバグ)。
     *  ★2026-09-04(W18追加): mode!=='champions'(=全国版)では IDX.learnersNational
     *  (learn∪learn_legacy∪没収confiscated=本編の全学習者)を返す。Championsは従来どおり
     *  IDX.learners(learnのみ=いま使える技)を絞り込む。 */
    learners: function (moveName) {
      if (mode !== 'champions') return IDX.learnersNational[moveName] || [];
      var names = IDX.learners[moveName] || [];
      var champNames = {};
      pick((DB.pokemon && DB.pokemon.items) || []).forEach(function (p) { champNames[p.name] = true; });
      return names.filter(function (n) { return !!champNames[n]; });
    },

    /** 特性の説明文 */
    abilityDesc: function (name) { return IDX.abilityDesc[name] || ''; },
    /** 特性 全件 */
    allAbilities: function () { return pick((DB.abilities && DB.abilities.items) || []); },
    /** ★2026-09-03: 英語slugでもja名でも1件引ける(ability_all_v2.html向け) */
    ability: function (key) { return IDX.abilityBySlug[key] || IDX.abilityByName[key] || null; },

    /** 覚える技(ポケモン名 → 技名の配列)。★mode非依存の生データ(learnのみ=いま実際に使える技)。
     *  damage_calc.html/party_checker.html/data_browser.html/news.html等が
     *  「mode非依存」を前提に呼んでいるため、この関数自体の意味は変えない。 */
    learnset: function (name) { return IDX.learn[name] || null; },
    /** ★2026-09-04(W18・pokemon_db_all.html追加): 全国版(本編で覚えられる全技)版のlearnset。
     *  learn∪learn_legacy∪(championsなら没収confiscatedも含む)。tools/build_views.js
     *  learnByNameNationalと同じ式。learnset()とは別名にして既存ページの契約を壊さない。 */
    learnsetNational: function (name) { return IDX.learnNational[name] || null; },
    /** ★2026-09-04: learnset()のslug版薄いヘルパー(呼び出し側の`.map(n => PokeDB.move(n).slug)`を1関数に)。
     *  learnset()自体が名前配列を無加工で返す実装(存在チェックなし)に合わせ、
     *  ここでも技が見つからない場合は落とさず元の名前文字列のまま残す(データを失わない=学習内容が消えない)。 */
    learnsetKeys: function (name) {
      var names = IDX.learn[name] || null;
      if (!names) return null;
      return names.map(function (n) {
        var mv = IDX.moveByName[n];
        return mv ? mv.slug : n;
      });
    },
    /** ★そのポケモンで没収された技 */
    confiscated: function (name) {
      var p = ((DB.learnsets && DB.learnsets.items) || []).find(function (x) { return x.name === name; });
      return (p && p.confiscated) || [];
    },

    /** 持ち物 全件 */
    items: function () { return pick((DB.items && DB.items.items) || []); },
    /** 性格 */
    natures: function () { return (DB.natures && DB.natures.items) || []; },
    /** ★2026-09-04: 性格を名前1件で引く薄いヘルパー(natures()から探す手間を1関数に) */
    nature: function (name) {
      var a = (DB.natures && DB.natures.items) || [];
      for (var i = 0; i < a.length; i++) { if (a[i].name === name) return a[i]; }
      return null;
    },
    /** タイプ(名前の配列。並び順は resist 配列と対応) */
    types: function () { return ((DB.types && DB.types.items) || []).map(function (t) { return t.name; }); },
    /** タイプ名 → 色 */
    typeColor: function (name) { return IDX.typeColor[name] || '#888'; },
    /** ★2026-09-03: タイプ相性表(18×18・攻撃タイプ=行/防御タイプ=列)。未読込なら [] */
    typeChart: function () { return (DB.types && DB.types.meta && DB.types.meta.tables && DB.types.meta.tables.TYPE_CHART) || []; },
    /** ★2026-09-04: タイプ名→1文字略称(例: "ほのお"→"炎")。master/types.json meta.tables.TYPE_KANJI そのまま */
    typeKanji: function () { return (DB.types && DB.types.meta && DB.types.meta.tables && DB.types.meta.tables.TYPE_KANJI) || {}; },
    /** ★2026-09-04: タイプ名→省略表示名(例: "ノーマル"→"ノーマ")。無いタイプは省略不要=このテーブルに載らない */
    typeDisplay: function () { return (DB.types && DB.types.meta && DB.types.meta.tables && DB.types.meta.tables.TYPE_DISPLAY) || {}; },
    /** ★2026-09-04: タイプ名→攻撃面の統計(p/m/x)。master/types.json meta.tables.TYPE_OFFENSIVE_STATS そのまま */
    typeOffensiveStats: function () { return (DB.types && DB.types.meta && DB.types.meta.tables && DB.types.meta.tables.TYPE_OFFENSIVE_STATS) || {}; },
    /** ★2026-09-04: 既定のタイプ表示順(配列)。master/types.json meta.tables.DEFAULT_TYPE_ORDER そのまま */
    defaultTypeOrder: function () { return (DB.types && DB.types.meta && DB.types.meta.tables && DB.types.meta.tables.DEFAULT_TYPE_ORDER) || []; },
    /** ★攻撃タイプ1つ × 防御側の複数タイプの合成倍率(単・複合両対応)。不明なタイプ名は無視、attackTypeが不明なら1を返す */
    typeEffectiveness: function (attackType, defenderTypes) {
      var chart = this.typeChart();
      var order = this.types();
      var ai = order.indexOf(attackType);
      if (ai < 0 || !chart.length) return 1;
      var types = Array.isArray(defenderTypes) ? defenderTypes : [defenderTypes];
      var mult = 1;
      types.forEach(function (dt) {
        var di = order.indexOf(dt);
        if (di < 0) return; // 不明なタイプは無視(倍率に反映しない)
        var row = chart[ai];
        if (row && row[di] != null) mult *= row[di];
      });
      return mult;
    },
    /** レギュレーション(現行=本番で遊べる)。★持つのは現行と次の2枠だけ(R4・2026-09-03) */
    regulation: function () { var a = (DB.regulations && DB.regulations.items) || []; return a.filter(function (r) { return r.role === 'current'; })[0] || a[0] || null; },
    /** 次のレギュレーション(発表済み・先行で遊べる)。未発表なら null */
    regulationNext: function () { var a = (DB.regulations && DB.regulations.items) || []; return a.filter(function (r) { return r.role === 'next'; })[0] || null; },
    /** 現行+次(順序=現行→次) */
    regulations: function () { return ((DB.regulations && DB.regulations.items) || []).slice(); },

    /** ★2026-09-04(W15): 種族値からの派生表(Lv50実数値・全国内順位。旧生成物STAT_RANK相当)。
     *  母集団=現在のallPokemon()。setMode()で母集団が変わったら自動的に作り直す(遅延計算+キャッシュ)。 */
    statRankAll: function () {
      if (statRankCache && statRankCacheMode === mode) return statRankCache;
      statRankCache = buildStatRank(this.allPokemon());
      statRankCacheMode = mode;
      return statRankCache;
    },
    /** statRankAll()から1件(キー形式はstatRankKey同等: formが'通常'以外なら`${name}(${form})`) */
    statRank: function (key) { return this.statRankAll()[key] || null; },

    /** 生の master をそのまま(検査用) */
    raw: function (name) { return DB[name] || null; },

    /** ★W21(2026-09-05): master/*.json が読めなかった時、画面に文言を出す共通部品。
     *  それまで ability_all.html / items_db_all_v2.html の2ページだけが独自に(ja直書きで)
     *  やっていて、他の pokedb.js 1本読みページは PokeDB.ready.then(...) に .catch() が無く
     *  「コンソールにだけ出て画面には何も出ない」状態だった(W20レビュー所見1)。
     *  targetEl があればその要素に差し込み(表の中(TBODY/THEAD/TABLE)ならcolspan="99"のtr/tdで
     *  1行分・それ以外はdivで)、無ければ document.body 先頭に固定バナーを出す。
     *  文言は i18n キー common.db_load_error(無ければ ja フォールバック)。{msg} に err.message を差す。
     *  ★master/*.jsonのfetchはI18Nの辞書fetchより先に失敗しがちで、I18N.tがまだcache無しでjaに
     *    フォールバックしたまま固まる恐れがある → i18n:ready/i18n:changedで自動的に描き直す
     *    (renderLoadError参照。ページ側でi18n再描画コードを書く必要はない)。 */
    showLoadError: function (err, targetEl) {
      LOAD_ERROR_STATE = { msg: (err && err.message) || String(err), targetEl: targetEl || null };
      renderLoadError();
      if (!LOAD_ERROR_LISTENER_ADDED) {
        LOAD_ERROR_LISTENER_ADDED = true;
        document.addEventListener('i18n:ready', renderLoadError);
        document.addEventListener('i18n:changed', renderLoadError);
      }
    },

    /** 読み込めているかの自己診断(PDCAのCheck用) */
    healthCheck: function () {
      var all = (DB.pokemon && DB.pokemon.items) || [];
      return {
        source: 'master/*.json', mode: mode,
        pokemon: this.allPokemon().length, pokemon_total: all.length,
        moves: Object.keys(this.allMoves()).length,
        abilities: this.allAbilities().length,
        items: this.items().length,
        learnsets: Object.keys(IDX.learn || {}).length,
        types: this.types().length, natures: this.natures().length,
        generated_at: (DB.pokemon && DB.pokemon.meta && DB.pokemon.meta.generated_at) || null,
        ok: all.length > 0 && Object.keys(IDX.moveBySlug || {}).length > 0,
      };
    },
  };
})();
