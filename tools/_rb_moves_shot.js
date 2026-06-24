const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs=[];
  const p = await b.newPage({ viewport: { width: 1180, height: 980 }, deviceScaleFactor: 2 });
  p.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await p.goto('http://localhost:8000/real_battle.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.locator('button:has-text("バトルスタート"), button:has-text("Battle Start")').first().click();
  await p.waitForTimeout(700);
  // advance intro messages by clicking msgbox until #cmd shows
  for (let i=0;i<12;i++){
    const cmdVis = await p.locator('#c-fight').isVisible().catch(()=>false);
    if (cmdVis) break;
    await p.locator('#msgbox').click().catch(()=>{});
    await p.waitForTimeout(450);
  }
  await p.locator('#c-fight').click().catch(()=>{});
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'review/_rb_shot/03_moves.png', clip:{x:0,y:0,width:1180,height:900} });
  console.log('ERRORS', JSON.stringify(errs));
  await b.close();
})();
