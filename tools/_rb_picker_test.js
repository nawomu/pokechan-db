const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1100,height:800} });
  await p.goto('http://localhost:8000/real_battle.html',{waitUntil:'networkidle'});
  await p.waitForTimeout(400);
  await p.locator('#row-self .slot').first().click();
  await p.waitForTimeout(400);
  const vis = await p.locator('#poke-picker').isVisible();
  const total0 = await p.$$eval('#pp-list button', els=>els.length);
  await p.locator('#pp-q').fill('イルカマン');
  await p.waitForTimeout(400);
  const ilca = await p.$$eval('#pp-list button', els=>els.map(e=>e.textContent.replace(/\s+/g,' ').trim()));
  console.log('picker_visible', vis, '| total_before_filter', total0);
  console.log('イルカマン結果', JSON.stringify(ilca));
  await b.close();
})();
