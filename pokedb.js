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

  try {
    var q = new URLSearchParams(location.search).get('data');
    if (q === 'champions') mode = 'champions';
    if (q === 'all' || q === 'national') mode = 'all';
  } catch (e) { /* file:// 等 */ }

  function load() {
    return Promise.all(FILES.map(function (f) {
      return fetch(BASE + f + '.json')
        .then(function (r) {
          if (!r.ok) throw new Error('master/' + f + '.json が読めません (' + r.status + ')');
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
    moves.forEach(function (m) {
      IDX.moveBySlug[m.slug] = m;
      if (!IDX.moveByName[m.name]) IDX.moveByName[m.name] = m;
    });

    IDX.abilityDesc = {};
    abis.forEach(function (a) { IDX.abilityDesc[a.name] = a.effect_ja || ''; });

    IDX.learn = {};
    lrn.forEach(function (p) { IDX.learn[p.name] = p.learn || []; });

    // ★「その技を覚えるポケモン」は master に無いので、ここで数え上げる(データは増やさない)
    IDX.learners = {};
    lrn.forEach(function (p) {
      (p.learn || []).forEach(function (mv) {
        (IDX.learners[mv] = IDX.learners[mv] || []).push(p.name);
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
    /** slug でも日本語名でも引ける */
    move: function (key) { return IDX.moveBySlug[key] || IDX.moveByName[key] || null; },
    /** 技の優先度(★master では最上位 priority に統一済み) */
    movePriority: function (mv) { return (mv && mv.priority) || 0; },
    /** その技を覚えるポケモンの名前(数え上げた結果) */
    learners: function (moveName) { return IDX.learners[moveName] || []; },

    /** 特性の説明文 */
    abilityDesc: function (name) { return IDX.abilityDesc[name] || ''; },
    /** 特性 全件 */
    allAbilities: function () { return pick((DB.abilities && DB.abilities.items) || []); },

    /** 覚える技(ポケモン名 → 技名の配列) */
    learnset: function (name) { return IDX.learn[name] || null; },
    /** ★そのポケモンで没収された技 */
    confiscated: function (name) {
      var p = ((DB.learnsets && DB.learnsets.items) || []).find(function (x) { return x.name === name; });
      return (p && p.confiscated) || [];
    },

    /** 持ち物 全件 */
    items: function () { return pick((DB.items && DB.items.items) || []); },
    /** 性格 */
    natures: function () { return (DB.natures && DB.natures.items) || []; },
    /** タイプ(名前の配列。並び順は resist 配列と対応) */
    types: function () { return ((DB.types && DB.types.items) || []).map(function (t) { return t.name; }); },
    /** タイプ名 → 色 */
    typeColor: function (name) { return IDX.typeColor[name] || '#888'; },
    /** ★2026-09-03: タイプ相性表(18×18・攻撃タイプ=行/防御タイプ=列)。未読込なら [] */
    typeChart: function () { return (DB.types && DB.types.meta && DB.types.meta.tables && DB.types.meta.tables.TYPE_CHART) || []; },
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

    /** 生の master をそのまま(検査用) */
    raw: function (name) { return DB[name] || null; },

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
