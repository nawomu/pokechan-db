const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs=[];
  const p = await b.newPage({ viewport: { width: 1180, height: 980 }, deviceScaleFactor: 1 });
  p.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  p.on('console',m=>{ if(m.type()==='error' && !/404|Failed to load resource/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
  await p.goto('http://localhost:8000/real_battle.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.check('#auto-msg').catch(()=>{});
  await p.locator('#msg-speed').selectOption('600').catch(()=>{});
  await p.locator('button:has-text("バトルスタート"), button:has-text("Battle Start")').first().click();
  async function adv(){ for(let i=0;i<30;i++){ if(await p.locator('#c-fight').isVisible().catch(()=>0)) return true; await p.locator('#msgbox').click().catch(()=>{}); await p.waitForTimeout(300); } return false; }
  let turns=0;
  for (let t=0;t<6;t++){
    if(!await adv()) break;
    await p.locator('#c-fight').click().catch(()=>{});
    await p.waitForTimeout(400);
    const mv = p.locator('#moves button:not(.back):not([disabled])').first();
    if(await mv.isVisible().catch(()=>0)){ await mv.click(); turns++; } else break;
    await p.waitForTimeout(800);
  }
  const badge = await p.locator('#turn-badge').textContent().catch(()=>'?');
  const over = await p.evaluate(()=>window.gameOver);
  console.log('turns_played', turns, '| badge', JSON.stringify(badge));
  console.log('JS_ERRORS', JSON.stringify(errs));
  await b.close();
})();
