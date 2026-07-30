const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOT_DIR = path.join(__dirname, '../review/_gate_shots_20260703');
const RE_JA = /[぀-ゟ゠-ヿ一-龯]/;

async function main() {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));

  await page.goto('http://127.0.0.1:8000/real_battle.html?lang=en', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { localStorage.setItem('lang', 'en'); });

  // msg-speed を最速に設定
  await page.evaluate(() => {
    const sp = document.getElementById('msg-speed');
    if (sp) { sp.value = '500'; }
    const cb = document.getElementById('auto-msg');
    if (cb) cb.checked = true;
  });

  // バトル開始
  await page.click('#btn-start');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: `${SHOT_DIR}/rb_01_battle_start_en.png` });

  const allLines = new Set();

  async function collectLogs() {
    return await page.evaluate(() => {
      const lines = [];
      document.querySelectorAll('#msg-lines .ml-line, #log-scroll .log-line').forEach(el => {
        const t = el.textContent.trim();
        if (t) lines.push(t);
      });
      return lines;
    });
  }

  async function getState() {
    return await page.evaluate(() => ({
      busy: window.busy,
      gameOver: window.gameOver,
      turnNo: window.turnNo,
      cmdDisplay: document.getElementById('cmd')?.style.display,
      movesDisplay: document.getElementById('moves')?.style.display,
      partyDisplay: document.getElementById('party')?.style.display,
      logCount: document.querySelectorAll('#log-scroll .log-line').length,
    }));
  }

  // バトルを最大30ターン進める
  for (let iter = 0; iter < 300; iter++) {
    const lines = await collectLogs();
    lines.forEach(l => allLines.add(l));

    const st = await getState();

    if (st.gameOver && iter > 20) {
      console.log(`Game over at iter ${iter}, turnNo=${st.turnNo}`);
      break;
    }

    // msg再生中はクリックで送り
    if (st.busy) {
      try { await page.click('#msgbox', { timeout: 100 }); } catch (e) {}
      await page.waitForTimeout(300);
      continue;
    }

    // cmdパネルが見えていれば「たたかう」をクリック
    if (st.cmdDisplay === 'grid' || st.cmdDisplay === '') {
      try {
        const fightBtn = page.locator('#c-fight');
        if (await fightBtn.isVisible({ timeout: 200 })) {
          await fightBtn.click();
          await page.waitForTimeout(300);
          continue;
        }
      } catch (e) {}
    }

    // 技パネルが開いていれば最初の技ボタンをクリック
    if (st.movesDisplay === 'grid' || st.movesDisplay === '') {
      try {
        const moveBtn = page.locator('#moves button[data-i]:not([disabled])').first();
        if (await moveBtn.isVisible({ timeout: 200 })) {
          await moveBtn.click();
          await page.waitForTimeout(300);
          continue;
        }
      } catch (e) {}
    }

    // パーティパネルが強制表示されていれば最初の生きているポケモンを選択
    if (st.partyDisplay === 'grid' || st.partyDisplay === '') {
      try {
        const partyBtn = page.locator('#party button[data-i]:not([disabled])').first();
        if (await partyBtn.isVisible({ timeout: 200 })) {
          await partyBtn.click();
          await page.waitForTimeout(300);
          continue;
        }
      } catch (e) {}
    }

    await page.waitForTimeout(500);
  }

  // 最終収集
  const lines = await collectLogs();
  lines.forEach(l => allLines.add(l));

  await page.screenshot({ path: `${SHOT_DIR}/rb_02_battle_end_en.png` });

  const jaLines = [...allLines].filter(l => RE_JA.test(l));
  const enLines = [...allLines].filter(l => !RE_JA.test(l));

  console.log('\n=== All log lines ===');
  [...allLines].sort().forEach(l => console.log(l));

  console.log(`\nTotal: ${allLines.size}, JA: ${jaLines.length}, EN: ${enLines.length}`);
  if (jaLines.length > 0) {
    console.log('\n=== UNTRANSLATED (JA) ===');
    jaLines.forEach(l => console.log('JA:', l));
  }
  if (jsErrors.length > 0) {
    console.log('\n=== JS Errors ===');
    jsErrors.forEach(e => console.log('ERR:', e));
  }

  const result = {
    ts: new Date().toISOString(),
    total: allLines.size,
    ja_count: jaLines.length,
    js_errors: jsErrors,
    ja_lines: jaLines,
    all_lines: [...allLines],
  };
  fs.writeFileSync(`${SHOT_DIR}/log_collect_result.json`, JSON.stringify(result, null, 2));
  console.log(`\nResult: ${SHOT_DIR}/log_collect_result.json`);
  console.log(`Screenshots: ${SHOT_DIR}/rb_*.png`);

  await browser.close();
}

main().catch(console.error);
