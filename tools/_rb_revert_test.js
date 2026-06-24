const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1100,height:800} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8000/real_battle.html',{waitUntil:'domcontentloaded'});
  // 古い保存データを注入(マイティ/ブレード入り)してリロード
  await p.evaluate(()=>{
    localStorage.setItem('rb_team', JSON.stringify({
      size:3,
      val:{s1:'イルカマン(マイティ)',s2:'ギルガルド(ブレード)',s3:'フシギバナ',
           o1:'イルカマン(マイティ)',o2:'リザードン',o3:'カメックス'}
    }));
  });
  await p.reload({waitUntil:'networkidle'});
  await p.waitForTimeout(600);
  const slots = await p.$$eval('#row-self .slot, #row-opp .slot', els=>els.map(e=>e.textContent.trim()));
  console.log('slots_after_reload', JSON.stringify(slots));
  // バトル開始して相手の出現名を確認
  await p.locator('button:has-text("バトルスタート"), button:has-text("Battle Start")').first().click();
  await p.waitForTimeout(1500);
  const oppName = await p.locator('#pb-opp .nm').textContent().catch(()=>'?');
  const selfName = await p.locator('#pb-self .nm').textContent().catch(()=>'?');
  console.log('battle opp', JSON.stringify(oppName.trim()), '| self', JSON.stringify(selfName.trim()));
  console.log('JS_ERRORS', JSON.stringify(errs));
  await b.close();
})();
