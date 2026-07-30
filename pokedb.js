/* pokedb.js — ★★データの参照元は「ここだけ」。全ページはこの1枚を読む。
 *
 * 目的(2026-07-28 阿部さん):
 *   「上っ面は全部そのままでいい。どこのデータを参照するかを、ただ一本に『ここを見る』って一つにするだけ。」
 *
 * これまでの問題:
 *   各ページが pokechan_data.js / pokechan_data_all.js を **バラバラに直接** 読んでいた。
 *   → 版を切り替える・データを差し替えるたびに、全ページを書き換える必要があった。
 *   → 結果、Champions版と全国版が別物になっても誰も気づけなかった(2026-07-28 発覚)。
 *
 * これから:
 *   ページは <script src="pokedb.js"></script> だけを読む。**供給元の差し替えはこのファイルの中だけで完結する。**
 *   引っ越し(統一DB v2 への移行)も、ここ1枚を変えるだけで済む。
 *
 * 使い方(ページ側):
 *   1) 既存の <script src="pokechan_data.js?v=..."> を <script src="pokedb.js?v=..."> に置き換えるだけ。
 *      → POKEMON_LIST / WAZA_MAP / ABILITY_DESC / POKEMON_WAZA / NATURES / TYPES は**今までどおり**グローバルに生える。
 *        (ページのロジックは1行も変えなくてよい)
 *   2) 版を指定したい時は、読み込む前に window.POKEDB_MODE = 'national' を置くか、URLに ?data=all を付ける。
 *
 * ★禁止: ページから pokechan_data*.js を直接読むこと(参照元が増えると、また分裂する)。
 *   → 番人 tools/_ssot_guard_test.js が見張る。
 */
(function () {
  'use strict';

  // ── 供給元の定義(★差し替えるのはここだけ) ───────────────────────────
  var SOURCES = {
    champions: { file: 'pokechan_data.js',     v: '20260705a', label: 'Champions版' },
    national:  { file: 'pokechan_data_all.js', v: '20260626a', label: '全国版(全部入り)' }
    // v2: { file: 'pokedb_v2.js', v: '…', label: '統一版' }   ← 引っ越し先。出来たらここに1行足すだけ。
  };
  var DEFAULT_MODE = 'champions';
  var ITEMS_V = '20260718a';   // 持ち物データ(全版共通)

  // ── どの版を読むか(決めるのはここ1箇所) ──────────────────────────────
  function resolveMode() {
    if (window.POKEDB_MODE && SOURCES[window.POKEDB_MODE]) return window.POKEDB_MODE;
    try {
      var q = new URLSearchParams(location.search).get('data');
      if (q === 'all' || q === 'national') return 'national';
      if (q && SOURCES[q]) return q;
    } catch (e) { /* file:// 等 */ }
    return DEFAULT_MODE;
  }

  var mode = resolveMode();
  var src  = SOURCES[mode];

  // ── 読み込み ────────────────────────────────────────────────────────
  // ★document.write を意図的に使う(既存3ページと同じ方式)。
  //   同期XHR+間接evalだと、データ側のトップレベル const/let が後続の<script>から見えず
  //   POKEMON_LIST 等が undefined になる実行時バグが出るため(2026-07-19 検証で判明)。
  if (typeof document !== 'undefined' && document.write) {
    document.write('<script src="' + src.file + '?v=' + src.v + '"><' + '/script>');
    // ★持ち物もマスターデータの一部。参照元1枚で完結させるため、ここで一緒に読む
    //   (2026-07-29: data_browser.html で持ち物が0件になり発覚。ページ側で個別に読ませない)
    if (!window.__POKEDB_NO_ITEMS) {
      document.write('<script src="items_database.js?v=' + ITEMS_V + '"><' + '/script>');
    }
  }

  // ── 読み取りの窓口(今後はこちらを使う。既存のグローバル参照も生き続ける) ──
  var g = (typeof window !== 'undefined') ? window : globalThis;
  // ★呼ばれた時点で読む(読み込み順に依存しない)。
  //   データ側は `const POKEMON_LIST = …` のトップレベル宣言なので **window には生えない**
  //   (script直下の const/let は「グローバル字句環境」に入る)。そのため window[name] では取れず、
  //   識別子を直接参照する必要がある。2026-07-28 実機確認で判明(healthCheckが全部0を返した)。
  function L(name) {
    switch (name) {
      case 'POKEMON_LIST': return (typeof POKEMON_LIST !== 'undefined') ? POKEMON_LIST : g.POKEMON_LIST;
      case 'WAZA_MAP':     return (typeof WAZA_MAP     !== 'undefined') ? WAZA_MAP     : g.WAZA_MAP;
      case 'ABILITY_DESC': return (typeof ABILITY_DESC !== 'undefined') ? ABILITY_DESC : g.ABILITY_DESC;
      case 'POKEMON_WAZA': return (typeof POKEMON_WAZA !== 'undefined') ? POKEMON_WAZA : g.POKEMON_WAZA;
      case 'NATURES':      return (typeof NATURES      !== 'undefined') ? NATURES      : g.NATURES;
      case 'TYPES':        return (typeof TYPES        !== 'undefined') ? TYPES        : g.TYPES;
      case 'ITEMS_DATABASE': return g.ITEMS_DATABASE;   // これは window に生えている
      default: return g[name];
    }
  }

  g.PokeDB = {
    mode: mode,
    source: src.file,
    label: src.label,

    /** ポケモン全件 */
    allPokemon: function () { return L('POKEMON_LIST') || []; },
    /** 名前 or 図鑑番号で1体 */
    pokemon: function (key) {
      var list = this.allPokemon();
      return list.find(function (p) { return p.name === key || String(p.no) === String(key); }) || null;
    },

    /** 技 全件(キー→技) */
    allMoves: function () { return L('WAZA_MAP') || {}; },
    /** キー or 日本語名で1件(★キー体系が版で違うため、名前でも引けるようにしてある) */
    move: function (key) {
      var m = this.allMoves();
      if (m[key]) return m[key];
      for (var k in m) { if (m[k] && m[k].name === key) return m[k]; }
      return null;
    },
    /** 技の優先度(★Champions版は battle_data.priority、全国版は最上位 priority に入っている) */
    movePriority: function (mv) {
      if (!mv) return 0;
      if (mv.battle_data && mv.battle_data.priority != null) return mv.battle_data.priority;
      return mv.priority || 0;
    },

    /** 特性の説明文 */
    abilityDesc: function (name) { return (L('ABILITY_DESC') || {})[name] || ''; },
    /** 覚える技(体名→技リスト) */
    learnset: function (name) { return (L('POKEMON_WAZA') || {})[name] || null; },

    /** 持ち物(items_database.js を読んでいるページのみ) */
    items: function () { return L('ITEMS_DATABASE') || null; },

    natures: function () { return L('NATURES') || {}; },
    types: function () { return L('TYPES') || []; },

    /** 読み込めているかの自己診断(PDCAのCheck用) */
    healthCheck: function () {
      return {
        mode: mode, source: src.file,
        pokemon: (L('POKEMON_LIST') || []).length,
        moves: Object.keys(L('WAZA_MAP') || {}).length,
        abilityDesc: Object.keys(L('ABILITY_DESC') || {}).length,
        learnsets: Object.keys(L('POKEMON_WAZA') || {}).length,
        ok: !!(L('POKEMON_LIST') && L('WAZA_MAP'))
      };
    }
  };
})();
