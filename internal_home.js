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

  // ── ★ファイル名を全部クリックで開けるようにする(2026-07-31 阿部さん) ──────
  //   「このページのJSとかファイルがあったら、そこ全部クリックしたらリンク開けるようにして」
  //   ★1ページずつ直さない。この共通JSを読んでいる管理ツール系の全ページに一度で効かせる
  //     (= 足りないときは一つのものを広げる)。
  //   ★存在しないファイルはリンクにせず灰色+⚠にする。古い参照が残っていたら見て分かるように。
  // \u2605\u62e1\u5f35\u5b50\u306f\u300c\u9577\u3044\u3082\u306e\u304b\u3089\u300d\u66f8\u304f(2026-07-31 \u5b9f\u6a5f\u3067\u767a\u899a)\u3002
  //   js \u3092\u5148\u306b\u7f6e\u304f\u3068 `_survey.json` \u304c `_survey.js` \u3067\u5207\u308c\u3066\u30ea\u30f3\u30af\u5148\u304c\u58ca\u308c\u308b\u3002
  var FILE_RE = /((?:\.\.\/)?[\w\-./\u3040-\u30ff\u4e00-\u9fff]+\.(?:command|json|html|css|txt|js|md|sh))(\?[\w=.\-]*)?/g;

  function linkify() {
    var inReview = location.pathname.indexOf('/review/') >= 0;
    var up = inReview ? '../' : '';
    var codes = [].slice.call(document.querySelectorAll('code'));
    var found = {};   // path → [ {el, token} ]

    codes.forEach(function (el) {
      if (el.querySelector('a') || el.closest('a')) return;   // 既にリンクなら触らない
      var txt = el.textContent;
      if (!FILE_RE.test(txt)) return;
      FILE_RE.lastIndex = 0;
      var html = '', last = 0, m;
      while ((m = FILE_RE.exec(txt)) !== null) {
        var raw = m[1];
        var href = /^(\.\.\/|\/)/.test(raw) ? raw : up + raw;
        html += esc(txt.slice(last, m.index));
        html += '<a data-f="' + esc(href) + '" href="' + esc(href) + '" target="_blank">'
              + esc(m[0]) + '</a>';
        last = m.index + m[0].length;
        (found[href] = found[href] || []).push(1);
      }
      html += esc(txt.slice(last));
      el.innerHTML = html;
    });

    // ★実在するか確かめる(ローカルのみ。無いものはリンクを外して灰色にする)
    Object.keys(found).forEach(function (href) {
      fetch(href, { method: 'HEAD' }).then(function (r) {
        if (r.ok) return;
        markMissing(href);
      }).catch(function () { markMissing(href); });
    });
  }

  // ★存在しないファイルは「消す」のでなく「存在しないと書いておく」(2026-07-31 阿部さん)
  //   「その存在しないやつは、存在しないって書いておけばいい。削除予定とか、削除検討とかね」
  //   → 記述は残す(履歴として意味がある)。ただし**一目で分かる印**を付ける。
  function markMissing(href) {
    [].slice.call(document.querySelectorAll('a[data-f="' + cssEsc(href) + '"]')).forEach(function (a) {
      var wrap = document.createElement('span');
      var name = document.createElement('span');
      name.textContent = a.textContent;
      name.setAttribute('style', 'color:#999;text-decoration:line-through');
      var tag = document.createElement('span');
      tag.textContent = ' ⚠ 存在しません(削除検討)';
      tag.setAttribute('style', 'color:#c33;font-size:.85em;font-weight:bold;white-space:nowrap');
      wrap.appendChild(name); wrap.appendChild(tag);
      wrap.title = 'このファイルは見つかりません: ' + href
        + '\n★記述は残してあります(履歴)。不要と確認できたら消す/注記を足す。';
      a.parentNode.replaceChild(wrap, a);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', linkify);
  else linkify();
})();
