// Showdown リプレイから参照スクショを採取(取材用・配置/動線の研究のみ。画像/CSS/アセットは複製しない)
const { chromium } = require('playwright');
const REPLAY = process.argv[2] || 'gen9ou-2638159402';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('https://replay.pokemonshowdown.com/'+REPLAY, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await p.waitForTimeout(5000);
  const dir = 'review/_showdown_ref/';
  // バトル枠だけクロップ採取するためのelement
  async function shot(name){
    const el = await p.$('.battle');
    if (el) await el.screenshot({ path: dir+name });
    else await p.screenshot({ path: dir+name, clip:{x:0,y:40,width:840,height:420} });
    // ログも一度だけ
  }
  // 全画面(ログ含む)も1枚
  await p.screenshot({ path: dir+'00_full.png', clip:{x:0,y:36,width:1180,height:430} });
  await shot('01_start.png');
  // ターン送り: 「Skip turn」ボタンを数回
  for (let t=1;t<=6;t++){
    const btn = await p.$('button[name="goToTurn"], .button[name="goToTurn"]');
    // 汎用: テキストで Skip turn / Next turn
    let clicked=false;
    for (const sel of ['button:has-text("Skip turn")','button:has-text("Next turn")','.replay-controls button']){
      const e = await p.$(sel); if(e){ await e.click().catch(()=>{}); clicked=true; break; }
    }
    await p.waitForTimeout(2200);
    await shot(`turn_${t}.png`);
  }
  console.log('captured to', dir);
  await b.close();
})();
