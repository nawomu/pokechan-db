/**
 * PchamDB アフィリエイトID 設定
 * ===========================================
 * 各アフィリエイトプログラムのIDをここで一元管理。
 * 全ページで参照することで、ID変更時に1ファイル修正で済む。
 *
 * 注: アフィリエイトIDは公開リンクに含まれるため機密ではないが、
 *     一元管理することで保守性UP。
 */

window.PCHAMDB_AFFILIATE = {
  // 全広告枠で共通利用する PR 表記文言
  prLabel: '広告 / PR',

  // Amazon アソシエイト (申請待ち・サポート問い合わせ中)
  amazon: {
    enabled: false,       // 承認後に true へ
    associateId: 'pchamdb-22', // 仮 / 申請後に確定
    baseLinkParam: 'tag=pchamdb-22',
    oneLink: null,        // OneLink ID (海外 Amazon 自動分岐) — Step 2 で設定
  },

  // 楽天アフィリエイト (2026-05-12 設定完了)
  rakuten: {
    enabled: true,
    affiliateId: '53b80f6e.8c5584d0.53b80f6f.ffc45287',
    linkBase: 'https://hb.afl.rakuten.co.jp/ichiba/',
  },

  // Google AdSense (PV 育成後に申請予定)
  adsense: {
    enabled: false,       // 承認後に true へ
    client: null,         // 例: 'ca-pub-XXXXXXXXXXXXXXXX'
    slots: {              // data-ad-slot 単位の slot ID
      'index-hero-below':    null,
      'making-incontent-1':  null,
      'terms-incontent-1':   null,
      'privacy-incontent-1': null,
      'disclaimer-incontent-1': null,
      'contact-incontent-1': null,
    },
  },

  /**
   * 楽天 商品リンク生成ヘルパー
   * @param {string} productUrl 楽天市場の商品URL (例: https://item.rakuten.co.jp/.../)
   * @returns {string} アフィリエイトリンク
   */
  buildRakutenLink: function(productUrl) {
    const id = this.rakuten.affiliateId;
    const base = this.rakuten.linkBase;
    return `${base}${id}/?pc=${encodeURIComponent(productUrl)}`;
  },

  /**
   * Amazon 商品リンク生成ヘルパー (承認後使用)
   * @param {string} asin Amazon商品ASIN
   * @returns {string} アフィリエイトリンク
   */
  buildAmazonLink: function(asin) {
    if (!this.amazon.enabled) return '#';
    return `https://www.amazon.co.jp/dp/${asin}?${this.amazon.baseLinkParam}`;
  },
};
