// 広告バーの閉じる／再表示トグル (全ページ共通)
// 使い方:
//   1) 既存の楽天バー (#rakuten-motion-bar) 内の × ボタンを
//      <button id="ad-hide-btn" ...>×</button> に変える (inline onclick は削除)
//   2) 楽天バーの直後に再表示ボタンを置く:
//      <button id="ad-show-btn" style="display:none;..."> 📣 Ad </button>
//      <script src="ad-toggle.js" defer></script>
//   3) <script>document.body.style.paddingBottom = '180px';</script> は不要 (本スクリプトが処理)
//
// 仕様: body.ad-closed クラスで制御 (CSS !important で確実に効く)
(function () {
  const LS_AD_HIDDEN = 'pchamdb_ad_hidden_v1';

  function $(id) { return document.getElementById(id); }

  // 動的にスタイルを注入 (各ページのCSSに依存しないため)
  function injectStyles() {
    if (document.getElementById('ad-toggle-styles')) return;
    const style = document.createElement('style');
    style.id = 'ad-toggle-styles';
    style.textContent = [
      'body { padding-bottom: 180px; }',
      'body.ad-closed { padding-bottom: 0 !important; }',
      'body.ad-closed #rakuten-motion-bar { display: none !important; }',
      'body.ad-closed iframe[src*="rakuten"],',
      'body.ad-closed iframe[src*="affiliate"] { display: none !important; }',
      'body.ad-closed #h-mirror-scroll { bottom: 0 !important; }',
      'body.ad-closed #back-to-top { bottom: 30px !important; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function applyHidden(hidden) {
    if (hidden) {
      document.body.classList.add('ad-closed');
    } else {
      document.body.classList.remove('ad-closed');
    }
    const showBtn = $('ad-show-btn');
    if (showBtn) showBtn.style.display = hidden ? 'block' : 'none';
    // 強制リレイアウト (flex:1 子要素の再計算)
    void document.body.offsetHeight;
    window.dispatchEvent(new Event('resize'));
  }

  // a11y: 楽天 iframe に title 属性を動的付与 (スクリーンリーダ対応)
  // 楽天 widget は外部スクリプトで iframe を後から DOM 挿入するため、MutationObserver で検出
  const DEFAULT_RAKUTEN_TITLE = '広告: 楽天モーションウィジェット (PR)';
  function rakutenTitle() {
    return (window.I18N && window.I18N.t)
      ? window.I18N.t('common.rakuten_widget_title', DEFAULT_RAKUTEN_TITLE)
      : DEFAULT_RAKUTEN_TITLE;
  }
  function tagRakutenIframe(iframe) {
    if (!iframe || iframe.getAttribute('data-a11y-titled') === '1') return;
    if (!iframe.title) iframe.title = rakutenTitle();
    iframe.setAttribute('data-a11y-titled', '1');
  }
  function scanRakutenIframes() {
    const bar = $('rakuten-motion-bar');
    if (!bar) return;
    bar.querySelectorAll('iframe').forEach(tagRakutenIframe);
  }
  function initRakutenA11y() {
    scanRakutenIframes();
    const bar = $('rakuten-motion-bar');
    if (!bar) return;
    try {
      const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === 'IFRAME') {
              tagRakutenIframe(node);
            } else if (node.querySelectorAll) {
              node.querySelectorAll('iframe').forEach(tagRakutenIframe);
            }
          }
        }
      });
      obs.observe(bar, { childList: true, subtree: true });
    } catch (e) { /* 古いブラウザ無視 */ }
    // 言語切替時に title を更新 (新しい言語の翻訳に置き換え)
    document.addEventListener('i18n:changed', () => {
      const bar2 = $('rakuten-motion-bar');
      if (!bar2) return;
      bar2.querySelectorAll('iframe').forEach((f) => {
        // 既に付与済の場合も title を上書き (言語切替対応)
        if (f.getAttribute('data-a11y-titled') === '1') f.title = rakutenTitle();
      });
    });
  }

  function init() {
    injectStyles();

    // iframe 経由 (親モーダル内) では Ad bar が確定バー等を覆ってしまうため自動非表示
    if (window.parent !== window) {
      document.body.classList.add('ad-closed');
      return;
    }

    // 初期: localStorage 状態を復元
    if (localStorage.getItem(LS_AD_HIDDEN) === '1') {
      applyHidden(true);
    }

    const hideBtn = $('ad-hide-btn');
    const showBtn = $('ad-show-btn');

    if (hideBtn) hideBtn.addEventListener('click', () => {
      applyHidden(true);
      localStorage.setItem(LS_AD_HIDDEN, '1');
    });
    if (showBtn) showBtn.addEventListener('click', () => {
      applyHidden(false);
      localStorage.removeItem(LS_AD_HIDDEN);
    });

    initRakutenA11y();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
