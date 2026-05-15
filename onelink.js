/**
 * Amazon OneLink リライタ
 * ===========================================
 * 訪問者の地域に応じて Amazon リンクを自動分岐させるための土台。
 * affiliate-config.js の `amazon.enabled` かつ `amazon.oneLink` が
 * 設定されているときだけリンクを書き換える。承認前は完全な no-op。
 *
 * 動作:
 *   1. ページ内の <a href="*amazon.*"> を走査
 *   2. 既に tag= が付いていれば触らない
 *   3. それ以外には tag={oneLink ID} を付与
 *   4. rel に "sponsored nofollow" を補完 (Google ガイドライン)
 *
 * 注: OneLink (Amazon SiteStripe の OneLink 機能) は本来クライアントサイドの
 *     スクリプトで地域 IP から自動的に行き先 Amazon を切り替える仕組み。
 *     ここでは「自前で tag を整える」最小実装に留め、OneLink 本体スクリプトの
 *     導入はあべの判断で別途行う想定。
 */
(function() {
  'use strict';
  var cfg = window.PCHAMDB_AFFILIATE && window.PCHAMDB_AFFILIATE.amazon;
  if (!cfg || !cfg.enabled || !cfg.oneLink) return;

  var tag = cfg.oneLink;

  function rewrite() {
    var links = document.querySelectorAll('a[href*="amazon."]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      try {
        var url = new URL(a.href, location.href);
        if (!/amazon\./i.test(url.hostname)) continue;
        if (!url.searchParams.has('tag')) {
          url.searchParams.set('tag', tag);
          a.href = url.toString();
        }
        var rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
        if (rel.indexOf('sponsored') === -1) rel.push('sponsored');
        if (rel.indexOf('nofollow')  === -1) rel.push('nofollow');
        a.setAttribute('rel', rel.join(' '));
      } catch (e) { /* 無効なURLはスキップ */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rewrite);
  } else {
    rewrite();
  }
})();
