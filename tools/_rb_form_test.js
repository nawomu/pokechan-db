const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs=[]; const seen=new Set(); let bad=[];
  const p = await b.newPage({ viewport:{width:1100,height:800} });
  p.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await p.goto('http://localhost:8000/real_battle.html',{waitUntil:'networkidle'});
  await p.waitForTimeout(500);
  for (let i=0;i<40;i++){
    await p.locator('#btn-random').click();
    await p.waitForTimeout(60);
    const names = await p.$$eval('#row-self .slot, #row-opp .slot', els=>els.map(e=>e.textContent.trim()));
    names.forEach(n=>{ seen.add(n); if(/\(マイティ\)|\(ブレード\)/.test(n)) bad.push(n); });
  }
  // ナイーブ・シールドはプールに居る(始動形)か
  const hasNaive = [...seen].some(n=>/イルカマン\(ナイーブ\)/.test(n));
  const hasShield = [...seen].some(n=>/ギルガルド\(シールド\)/.test(n));
  console.log('uniq_picked', seen.size, '| bad(マイティ/ブレード)', JSON.stringify([...new Set(bad)]));
  console.log('naive_seen', hasNaive, '| shield_seen', hasShield);
  console.log('JS_ERRORS', JSON.stringify(errs));
  await b.close();
})();
