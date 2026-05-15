/**
 * PchamDB i18n Runtime
 * 軽量な言語切替ランタイム。各HTMLは <script src="i18n/runtime.js"></script> を読み込むだけ。
 *
 * 公開API: window.I18N
 *   I18N.lang                  : 現在の言語 ('ja' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'ko' | 'zh-Hans' | 'zh-Hant')
 *   I18N.setLang(lang)         : 言語切替 (localStorage 保存 + ページリロードなしで全要素再翻訳)
 *   I18N.t(key, fallback)      : UI 文言取得 (例: I18N.t('header.search'))
 *   I18N.pokemon(jaName)       : ポケモン名 (日本語 → 現在言語)
 *   I18N.move(keyOrJa)         : わざ名 (ローマ字キー or 日本語名 → 現在言語)
 *   I18N.ability(jaName)       : 特性名
 *   I18N.type(jaName)          : タイプ名
 *   I18N.apply()               : DOMの data-i18n="key" 属性を全部翻訳
 *   I18N.onReady(callback)     : 辞書ロード完了時の callback
 *
 * 各要素に data-i18n="..." を付けると、その要素の textContent が翻訳されます。
 * data-i18n-attr="title:tooltip.search" のように attr 翻訳もサポート。
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'pchamdb.lang';
  const SUPPORTED = ['ja', 'en', 'es', 'fr', 'de', 'it', 'ko', 'zh-Hans', 'zh-Hant'];
  const DEFAULT_LANG = 'ja';

  // i18n フォルダの URL ベース (HTMLから見て相対パス)
  // 各HTMLは同じディレクトリにあるので "i18n/" が基準
  const BASE = (function () {
    // <script src="..."> の src 属性から相対パスを推測
    const scripts = document.getElementsByTagName('script');
    for (let s of scripts) {
      const src = s.getAttribute('src') || '';
      if (src.endsWith('runtime.js') || src.endsWith('i18n/runtime.js')) {
        // src が "i18n/runtime.js" なら base は "i18n/"
        // src が "../i18n/runtime.js" なら base は "../i18n/"
        return src.replace(/runtime\.js$/, '');
      }
    }
    return 'i18n/';
  })();

  // 辞書キャッシュ: { 'ja': {pokemon, moves, abilities, types, ui}, 'en': {...} }
  const cache = {};
  const readyCallbacks = [];
  let currentLang = (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (e) {}
    // ブラウザ言語自動判定
    const nav = (navigator.language || 'ja').toLowerCase();
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('zh-hant') || nav.startsWith('zh-tw')) return 'zh-Hant';
    if (nav.startsWith('zh')) return 'zh-Hans';
    if (nav.startsWith('en')) return 'en';
    if (nav.startsWith('es')) return 'es';
    if (nav.startsWith('fr')) return 'fr';
    if (nav.startsWith('de')) return 'de';
    if (nav.startsWith('it')) return 'it';
    if (nav.startsWith('ko')) return 'ko';
    return DEFAULT_LANG;
  })();

  async function fetchJson(url) {
    try {
      const res = await fetch(url + '?v=' + Date.now());
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[i18n] fetch failed:', url, e);
      return null;
    }
  }

  async function loadLang(lang) {
    if (cache[lang]) return cache[lang];
    // メイン辞書 (en.json 等)
    const main = (lang === 'ja') ? null : await fetchJson(BASE + lang + '.json');
    // UI 辞書 (ui-en.json 等)
    const ui = await fetchJson(BASE + 'ui-' + lang + '.json') || {};

    cache[lang] = {
      types: main ? main.types || {} : {},
      abilities: main ? main.abilities || {} : {},
      pokemon: main ? main.pokemon || {} : {},
      moves: main ? main.moves || {} : {},
      ui: ui,
    };
    return cache[lang];
  }

  function getNested(obj, dottedKey) {
    if (!obj || !dottedKey) return null;
    const parts = dottedKey.split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[p];
    }
    return cur;
  }

  // ja を原典として扱う。 ja の辞書は ja_native (HTML側の文言そのまま) を返すフォールバック付き
  function tUI(key, fallback) {
    const d = cache[currentLang];
    if (!d) return fallback != null ? fallback : key;
    const v = getNested(d.ui, key);
    if (v != null) return v;
    // ja の場合: HTML 側の元文言を fallback として使う
    if (fallback != null) return fallback;
    return key;
  }

  function tPokemon(jaName) {
    if (currentLang === 'ja' || !jaName) return jaName;
    const d = cache[currentLang];
    if (!d) return jaName;
    return d.pokemon[jaName] || jaName;
  }

  function tMove(keyOrJa) {
    if (currentLang === 'ja' || !keyOrJa) return keyOrJa;
    const d = cache[currentLang];
    if (!d) return keyOrJa;
    const entry = d.moves[keyOrJa];
    if (entry && entry.name) return entry.name;
    return keyOrJa;
  }

  function tMoveDesc(keyOrJa) {
    if (currentLang === 'ja' || !keyOrJa) return null;
    const d = cache[currentLang];
    if (!d) return null;
    const entry = d.moves[keyOrJa];
    if (entry && entry.desc) return entry.desc;
    return null;
  }

  function tAbility(jaName) {
    if (currentLang === 'ja' || !jaName) return jaName;
    const d = cache[currentLang];
    if (!d) return jaName;
    const entry = d.abilities[jaName];
    if (entry && entry.name) return entry.name;
    return jaName;
  }

  function tType(jaName) {
    if (currentLang === 'ja' || !jaName) return jaName;
    const d = cache[currentLang];
    if (!d) return jaName;
    return d.types[jaName] || jaName;
  }

  function applyDOM(root) {
    root = root || document;
    // data-i18n="key" → textContent 置換
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      // data-i18n-default に元の文言があれば、それを fallback に使う
      const def = el.getAttribute('data-i18n-default') || el.textContent.trim();
      if (!el.hasAttribute('data-i18n-default')) {
        el.setAttribute('data-i18n-default', def);
      }
      const v = tUI(key, def);
      el.textContent = v;
    });
    // data-i18n-attr="title:tooltip.search,placeholder:input.search" → 属性翻訳
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(',').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (!attr || !key) return;
        const cur = el.getAttribute(attr) || '';
        const v = tUI(key, cur);
        el.setAttribute(attr, v);
      });
    });
    // <html lang="..."> 更新
    document.documentElement.setAttribute('lang', currentLang === 'zh-Hans' ? 'zh-CN' :
                                                  currentLang === 'zh-Hant' ? 'zh-TW' : currentLang);
  }

  async function setLang(lang) {
    if (!SUPPORTED.includes(lang)) {
      console.warn('[i18n] unsupported lang:', lang);
      return;
    }
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    await loadLang(lang);
    applyDOM();
    // カスタムイベント発火 (各HTMLが再描画したいデータを更新できるように)
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
  }

  function onReady(cb) {
    if (cache[currentLang]) {
      try { cb(); } catch (e) {}
    } else {
      readyCallbacks.push(cb);
    }
  }

  // ---------- 言語スイッチャー UI 自動挿入 ----------
  const LANG_LABELS = {
    'ja': '🇯🇵 日本語',
    'en': '🇬🇧 English',
    'es': '🇪🇸 Español',
    'fr': '🇫🇷 Français',
    'de': '🇩🇪 Deutsch',
    'it': '🇮🇹 Italiano',
    'ko': '🇰🇷 한국어',
    'zh-Hans': '🇨🇳 简体中文',
    'zh-Hant': '🇹🇼 繁體中文',
  };

  function injectStyles() {
    if (document.getElementById('i18n-switcher-styles')) return;
    const style = document.createElement('style');
    style.id = 'i18n-switcher-styles';
    style.textContent = `
      .i18n-switcher {
        display: inline-block;
        position: relative;
        font-family: -apple-system, system-ui, sans-serif;
        font-size: 12px;
        vertical-align: middle;
      }
      /* button要素として specificity を強化 (親の .top-bar button に負けないように) */
      button.i18n-switcher-btn, .i18n-switcher-btn {
        background: #fff !important;
        border: 1px solid #ccc !important;
        border-radius: 14px !important;
        padding: 2px 10px !important;
        cursor: pointer;
        font-size: 12px !important;
        color: #333 !important;
        line-height: 1.4 !important;
        white-space: nowrap;
        font-weight: 500 !important;
      }
      button.i18n-switcher-btn:hover, .i18n-switcher-btn:hover { border-color: #1E5BB8 !important; color: #1E5BB8 !important; background: #fff !important; }
      .i18n-switcher-menu {
        position: absolute;
        top: 26px;
        right: 0;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        padding: 4px;
        min-width: 140px;
        display: none;
        z-index: 9999;
      }
      .i18n-switcher-menu.open { display: block; }
      .i18n-switcher-menu button {
        display: block;
        width: 100%;
        background: none;
        border: none;
        padding: 6px 10px;
        text-align: left;
        cursor: pointer;
        font-size: 13px;
        border-radius: 4px;
        color: #1d2433;
      }
      .i18n-switcher-menu button:hover { background: #f0f5ff; }
      .i18n-switcher-menu button.active { background: #1E5BB8; color: #fff; font-weight: 600; }
      /* マウントポイントが無い場合のフォールバック (画面右上) */
      .i18n-switcher--floating {
        position: fixed;
        top: 6px;
        right: 8px;
        z-index: 9998;
      }
    `;
    document.head.appendChild(style);
  }

  function initSwitcher() {
    // 既存 switcher があり、mount が正しい位置にあるならスキップ
    const existing = document.getElementById('i18n-switcher');
    const mount = document.getElementById('i18n-switcher-mount');
    if (existing) {
      if (mount && existing.parentElement === mount) return; // OK
      if (!mount && existing.classList.contains('i18n-switcher--floating')) return; // OK
      existing.remove(); // 位置がずれていれば再構築
    }
    // 自動挿入を無効化したい場合: <body data-i18n-no-switcher>
    if (document.body.hasAttribute('data-i18n-no-switcher')) return;

    injectStyles();
    const root = document.createElement('div');
    root.id = 'i18n-switcher';
    root.className = 'i18n-switcher';

    const btn = document.createElement('button');
    btn.className = 'i18n-switcher-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.title = 'Language / 言語';
    btn.innerHTML = '🌐 <span id="i18n-cur-label">' + (LANG_LABELS[currentLang] || currentLang) + '</span>';

    const menu = document.createElement('div');
    menu.className = 'i18n-switcher-menu';
    SUPPORTED.forEach((l) => {
      const item = document.createElement('button');
      item.textContent = LANG_LABELS[l] || l;
      item.dataset.lang = l;
      if (l === currentLang) item.classList.add('active');
      item.addEventListener('click', async () => {
        await setLang(l);
        menu.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.lang === l));
        document.getElementById('i18n-cur-label').textContent = LANG_LABELS[l] || l;
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
      menu.appendChild(item);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', () => {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });

    root.appendChild(btn);
    root.appendChild(menu);
    // マウントポイント (#i18n-switcher-mount) があればそこに挿入、無ければ画面右上にフローティング
    // (mount は initSwitcher 先頭で既に取得済み)
    if (mount) {
      mount.appendChild(root);
    } else {
      root.classList.add('i18n-switcher--floating');
      document.body.appendChild(root);
    }
  }

  // 初期化: 現在の言語の辞書をロード → DOM 適用 → スイッチャー挿入
  function init() {
    loadLang(currentLang).then(() => {
      applyDOM();
      initSwitcher();
      // mount が動的に追加/削除されても追従するように MutationObserver で監視
      try {
        const obs = new MutationObserver(() => {
          // mount が新たに現れた or 古い switcher が消えた場合に再挿入
          initSwitcher();
        });
        obs.observe(document.body, { childList: true, subtree: true });
      } catch (e) { /* 古いブラウザは無視 */ }
      document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: currentLang } }));
      readyCallbacks.forEach((cb) => { try { cb(); } catch (e) {} });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 公開API
  window.I18N = {
    get lang() { return currentLang; },
    SUPPORTED,
    setLang,
    t: tUI,
    pokemon: tPokemon,
    move: tMove,
    moveDesc: tMoveDesc,
    ability: tAbility,
    type: tType,
    apply: applyDOM,
    onReady,
  };
})();
