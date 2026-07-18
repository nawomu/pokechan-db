// Lab-3 ソークテスト: 無限バトルを長時間回す(オートAI+追加/復活/全滅継続を織り交ぜ)
// 合格条件: 60ターン以上 or 8分、スタール(30秒ログ停止)なし・JSエラー0
const { chromium } = require('playwright');
const URL = process.env.SOAK_URL || 'https://pchamdb.com/battle_lab.html';
const jsErrors = [];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => jsErrors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404|net::ERR|Failed to load resource|adsbygoogle|googlesyndication|doubleclick/.test(m.text())) jsErrors.push('console: ' + m.text()); });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const sim = fn => ev(f => { const S = document.getElementById('engine-frame').contentWindow.__sim; return eval('(' + f + ')')(f2 => f2)(S) ?? eval('(' + f + ')')(S); }, fn.toString());
  const simx = fn => ev(f => { const S = document.getElementById('engine-frame').contentWindow.__sim; return eval('(' + f + ')')(S); }, fn.toString());
  const logLen = () => simx(S => (S.battleLog || []).length);

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await ev(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); } const s = document.getElementById('msg-speed'); if (s){ s.value = '1700'; s.dispatchEvent(new Event('change')); } });
  await ev(() => document.getElementById('btn-random').click());
  await page.waitForTimeout(800);
  await ev(() => document.getElementById('btn-start').click());
  await page.waitForTimeout(3000);
  // 両方AI+オート
  await ev(() => document.getElementById('lab-ai-self').click());
  await page.waitForTimeout(300);
  await ev(() => document.getElementById('lab-ai-opp').click());

  const t0 = Date.now();
  let lastLog = await logLen(), lastGrow = Date.now();
  let stalls = 0, wipes = 0, adds = 0, revives = 0, lastMaintenance = 0;
  const events = [];

  while (Date.now() - t0 < 8 * 60 * 1000){
    await page.waitForTimeout(5000);
    const L = await logLen();
    // 全滅選択が出ていたら「ふっかつしてつづける」
    const choice = await ev(() => { const b = document.getElementById('c-revive-continue'); return !!b && b.style.display !== 'none' && b.offsetParent !== null; });
    if (choice){
      wipes++;
      await ev(() => document.getElementById('c-revive-continue').click());
      await page.waitForTimeout(1200);
      for (let k = 0; k < 6; k++){
        const done = await ev(() => {
          const rv = document.querySelector('.sw-revive');
          if (rv){ rv.click(); return false; }
          const slot = document.querySelector('#party button.slot[data-i]:not([disabled])');
          if (slot){ slot.click(); return false; }
          const y = document.querySelector('#party .sw-yes');
          if (y){ y.click(); return true; }
          return document.getElementById('party')?.style.display !== 'flex';
        });
        await page.waitForTimeout(800);
        if (done) break;
      }
      events.push('wipe→continue @' + Math.round((Date.now() - t0) / 1000) + 's');
      lastGrow = Date.now();
      continue;
    }
    if (L > lastLog){ lastLog = L; lastGrow = Date.now(); }
    else if (Date.now() - lastGrow > 30000){
      stalls++;
      const d = await ev(() => ({
        moves: document.getElementById('moves')?.style.display,
        party: document.getElementById('party')?.style.display,
        cmd: document.getElementById('cmd')?.style.display,
        msg: (document.getElementById('msgbox')?.textContent || '').slice(-100),
        rc: document.getElementById('c-revive-continue')?.style.display,
      }));
      events.push('STALL @' + Math.round((Date.now() - t0) / 1000) + 's ' + JSON.stringify(d));
      await page.screenshot({ path: '/private/tmp/claude-501/-Users-masamichi-Documents-----DB/fdbd23d3-7b77-44ff-84c9-17c0c24d551d/scratchpad/soak_stall_' + stalls + '.png' });
      break;   // スタール=即失敗で原因を見る
    }
    // 60秒ごとのメンテ: 一時停止→控えを復活+メンバー追加→再開
    if (Date.now() - lastMaintenance > 60000){
      lastMaintenance = Date.now();
      await ev(() => { const b = document.getElementById('lab-auto-toggle'); if (b && b.style.display !== 'none') b.click(); });   // ⏸
      await page.waitForTimeout(1500);
      const r = await simx(S => {
        let rv = 0;
        ['self', 'opp'].forEach(s => (S.sides[s].bench || []).forEach(e => { if (e.fainted){ e.fainted = false; e.currentHp = null; e.status = 'none'; e.sleepTurns = null; rv++; } }));
        return rv;
      });
      revives += r;
      // 追加(交代画面は開かずbench直push相当の検証はハーネス済みなのでここではUI経由をやめ、状態だけ確認)
      const sizes = await simx(S => ({ s: 1 + S.sides.self.bench.length, o: 1 + S.sides.opp.bench.length }));
      events.push('maint @' + Math.round((Date.now() - t0) / 1000) + 's revived=' + r + ' sizes=' + JSON.stringify(sizes));
      await ev(() => { const b = document.getElementById('lab-auto-toggle'); if (b && b.style.display !== 'none') b.click(); });   // ▶
      lastGrow = Date.now();
    }
  }
  const turns = await simx(S => S.turnCount || S.env?.turn || null);
  const finalLog = await logLen();
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-masamichi-Documents-----DB/fdbd23d3-7b77-44ff-84c9-17c0c24d551d/scratchpad/soak_final.png' });
  await browser.close();
  console.log(JSON.stringify({ durationSec: Math.round((Date.now() - t0) / 1000), logLines: finalLog, turns, stalls, wipes, revives, jsErrors: jsErrors.slice(0, 10), events }, null, 1));
  process.exit(stalls || jsErrors.length ? 1 : 0);
})().catch(e => { console.error('SOAK ERR', e); process.exit(2); });
