const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs=[];
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await p.goto('http://localhost:8000/real_battle.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.check('#auto-msg').catch(()=>{});
  await p.locator('#msg-speed').selectOption('600').catch(()=>{});
  await p.locator('button:has-text("バトルスタート"), button:has-text("Battle Start")').first().click();
  for(let i=0;i<20;i++){ if(await p.locator('#c-fight').isVisible().catch(()=>0))break; await p.locator('#msgbox').click().catch(()=>{}); await p.waitForTimeout(250); }
  await p.locator('#c-fight').click().catch(()=>{}); await p.waitForTimeout(300);
  const mv=p.locator('#moves button:not(.back):not([disabled])').first();
  if(await mv.isVisible().catch(()=>0)) await mv.click();
  await p.waitForTimeout(1200);
  // measure horizontal overflow
  const ov = await p.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
  await p.screenshot({ path: 'review/_rb_shot/05_mobile.png', fullPage:true });
  console.log('overflow', JSON.stringify(ov), 'extra', ov.sw-ov.cw);
  console.log('JS_ERRORS', JSON.stringify(errs));
  await b.close();
})();
