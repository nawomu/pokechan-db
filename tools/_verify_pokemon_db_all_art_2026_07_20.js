const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push('console.error: ' + msg.text()); });

  const requests = [];
  page.on('request', req => requests.push(req.url()));

  await page.goto('http://localhost:8811/pokemon_db_all.html', { waitUntil: 'networkidle' });

  // scroll all the way to the bottom of the (very long) table to force every lazy img to load
  await page.evaluate(async () => {
    const step = 2000;
    let last = -1;
    while (document.scrollingElement.scrollTop !== last) {
      last = document.scrollingElement.scrollTop;
      window.scrollBy(0, step);
      await new Promise(r => setTimeout(r, 40));
    }
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const stats = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('td.sp img'));
    const total = imgs.length;
    const simSrc = imgs.filter(im => /images\/sim\//.test(im.getAttribute('src') || '')).length;
    const pokeApiSrc = imgs.filter(im => /images\/poke\/|raw\.githubusercontent/.test(im.getAttribute('src') || '')).length;
    const loaded = imgs.filter(im => im.complete && im.naturalWidth > 0).length;
    const broken = imgs.filter(im => im.complete && im.naturalWidth === 0).length;
    const brokenIds = imgs.filter(im => im.complete && im.naturalWidth === 0).map(im => im.getAttribute('data-poke-id'));
    const rows = Array.from(document.querySelectorAll('#tb > tr'));
    const rowsWithoutImg = rows.filter(r => !r.querySelector('td.sp img')).length;
    return { total, simSrc, pokeApiSrc, loaded, broken, brokenIds, rowCount: rows.length, rowsWithoutImg };
  });

  const pokeApiNetworkReqs = requests.filter(u => /raw\.githubusercontent\.com\/PokeAPI|pokeapi\.co/i.test(u));
  const localPokeNetworkReqs = requests.filter(u => /\/images\/poke\//.test(u));
  const simNetworkReqs = requests.filter(u => /\/images\/sim\//.test(u));
  const simPngFallbacks = simNetworkReqs.filter(u => u.endsWith('.png'));

  console.log('=== FULL-SCROLL RESULT ===');
  console.log('total requests:', requests.length);
  console.log('PokeAPI network requests:', pokeApiNetworkReqs.length);
  console.log('local images/poke/ requests:', localPokeNetworkReqs.length);
  console.log('images/sim/ requests:', simNetworkReqs.length, '(png fallbacks used:', simPngFallbacks.length, ')');
  console.log('img stats:', JSON.stringify(stats));
  console.log('console/page errors:', consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors.slice(0, 20));
  if (pokeApiNetworkReqs.length) console.log('PokeAPI reqs sample:', pokeApiNetworkReqs.slice(0, 10));

  await browser.close();
})();
