const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs=[];
  const p = await b.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
  p.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  p.on('console',m=>{ if(m.type()==='error' && !/404|Failed to load resource/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
  await p.goto('http://localhost:8000/real_battle.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.check('#auto-msg').catch(()=>{});
  await p.locator('#msg-speed').selectOption('600').catch(()=>{});
  await p.locator('button:has-text("バトルスタート"), button:has-text("Battle Start")').first().click();
  async function adv(){ for(let i=0;i<30;i++){ if(await p.locator('#c-fight').isVisible().catch(()=>0)) return true; await p.locator('#msgbox').click().catch(()=>{}); await p.waitForTimeout(280); } return false; }
  let turns=0;
  for (let t=0;t<5;t++){
    if(!await adv()) break;
    await p.locator('#c-fight').click().catch(()=>{}); await p.waitForTimeout(350);
    const mv = p.locator('#moves button:not(.back):not([disabled])').first();
    if(await mv.isVisible().catch(()=>0)){ await mv.click(); turns++; } else break;
    await p.waitForTimeout(700);
  }
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'review/_rb_shot/04_2col.png', clip:{x:0,y:0,width:1280,height:760} });
  const logLines = await p.locator('#log-scroll').innerText().catch(()=>'');
  console.log('turns', turns, '| log_chars', logLines.length);
  console.log('LOG_SAMPLE:', JSON.stringify(logLines.split('\n').slice(0,6)));
  console.log('JS_ERRORS', JSON.stringify(errs));
  await b.close();
})();
