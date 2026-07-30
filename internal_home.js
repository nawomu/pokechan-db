/* internal_home.js — 管理ツールページの共通ホームボタン
 * 目的(2026-07-29 阿部さん): 内部ツールから各ページを新しいタブで開くので、
 *   各ページに「内部ツールに戻る」ボタンが欲しい。
 * ★ローカル(localhost / file://)でだけ表示する。本番では出ない。
 */
(function () {
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:';
  if (!local) return;
  function add() {
    if (document.getElementById('__internal_home')) return;
    // 管理ツール.html までの相対パス(review/ 配下なら1つ上)
    var depth = (location.pathname.replace(/^\/|\/[^/]*$/g, '').match(/\//g) || []).length;
    var up = location.pathname.indexOf('/review/') >= 0 ? '../' : '';
    var a = document.createElement('a');
    a.id = '__internal_home';
    a.href = up + '管理ツール.html';
    a.textContent = '🏠 管理ツール';
    a.title = '管理ツールのトップに戻る';
    a.setAttribute('style', [
      'position:fixed', 'right:14px', 'bottom:14px', 'z-index:99999',
      'background:#c33', 'color:#fff', 'text-decoration:none',
      'font:bold 13px/1 -apple-system,"Hiragino Sans",sans-serif',
      'padding:10px 14px', 'border-radius:22px',
      'box-shadow:0 2px 10px rgba(0,0,0,.28)', 'opacity:.92'
    ].join(';'));
    a.onmouseenter = function () { a.style.opacity = '1'; };
    a.onmouseleave = function () { a.style.opacity = '.92'; };
    document.body.appendChild(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add);
  else add();
})();
