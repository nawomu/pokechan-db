// リアルバトル盤面 PDCA採取(自分の出力をスクショ→参照と照合用)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs=[];
  const p = await b.newPage({ viewport: { width: 1180, height: 980 }, deviceScaleFactor: 2 });
  p.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await p.goto('http://localhost:8000/real_battle.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const dir='review/_rb_shot/';
  await p.screenshot({ path: dir+'00_teamselect.png', clip:{x:0,y:0,width:1180,height:520} });
  await p.locator('button:has-text("バトルスタート"), button:has-text("Battle Start")').first().click();
  await p.waitForTimeout(900);
  await p.check('#auto-msg').catch(()=>{});
  await p.locator('#msg-speed').selectOption('600').catch(()=>{});
  await p.waitForTimeout(2500);
  // 盤面(#field)のクロップ
  const fld = await p.$('#field');
  if (fld) await fld.screenshot({ path: dir+'01_field.png' });
  await p.screenshot({ path: dir+'02_full.png', clip:{x:0,y:0,width:1180,height:760} });
  console.log('JS_ERRORS', JSON.stringify(errs));
  console.log('captured', dir);
  await b.close();
})();
