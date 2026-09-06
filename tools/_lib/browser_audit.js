'use strict';

// 実機ゲート共通: 「文字がない」だけでは読み込み成功と見なさない。
// Playwright Pageを受け取る。Node側の回帰テストでも同じ判定経路を通せる。
function observePage(page, { origin, ignoreResponse = () => false, checkConsole = false } = {}) {
  const errors = [];
  // 通信監査の範囲は呼び出し元の対象サイト。page.url()は遷移前だとabout:blank。
  // origin未指定なら従来どおり全通信を見る。JS例外はoriginにかかわらず記録する。
  const targetOrigin = origin ? new URL(origin).origin : null;
  const inScope = url => !targetOrigin || new URL(url).origin === targetOrigin;
  const add = (kind, text) => errors.push({ kind, text, where: kind });
  const onPageError = e => add('runtime', String(e));
  const onResponse = r => {
    if (r.status() >= 400 && inScope(r.url()) && !ignoreResponse(r)) add('http', `HTTP ${r.status()} ${r.url()}`);
  };
  const onRequestFailed = r => {
    // HTTPエラーとは別: 接続断・DNS・スクリプト/fetchのabortも失敗として残す。
    if (inScope(r.url()) && !ignoreResponse({ url: () => r.url(), request: () => r })) {
      add('network', `${r.url()} ${r.failure()?.errorText || 'request failed'}`);
    }
  };
  const onConsole = m => {
    if (checkConsole && m.type() === 'error' &&
        !/^Failed to load resource:/.test(m.text())) add('console', m.text());
  };
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);
  page.on('console', onConsole);
  return {
    errors, add,
    dispose() {
      page.off('pageerror', onPageError);
      page.off('response', onResponse);
      page.off('requestfailed', onRequestFailed);
      page.off('console', onConsole);
    },
  };
}

async function openReadyPage(page, url, { timeout = 20000, i18n = true } = {}) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  if (!response || !response.ok()) throw new Error(`document HTTP ${response ? response.status() : 'no response'}: ${url}`);
  if (i18n) await page.waitForFunction(() => window.__i18nReady === true, null, { timeout });
  // i18nが先に準備できてもmasterが届く前の空画面を走査しない。
  await page.waitForFunction(() => {
    if (!window.PokeDB) return true;
    return window.PokeDB.ready.then(() => true);
  }, null, { timeout });
}

module.exports = { observePage, openReadyPage };
