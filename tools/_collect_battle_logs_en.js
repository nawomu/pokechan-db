#!/usr/bin/env node
/**
 * バトルログ採取スクリプト(英語モード) - 複数バトル実行版
 * real_battle.html をen言語で開き、3-4戦バトルしてログを収集する
 * 使い方: node tools/_collect_battle_logs_en.js
 * 前提: ローカルサーバが http://127.0.0.1:8000 で稼働中
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8000';
const RE_JA = /[぀-ゟ゠-ヿ一-龯]/;
const SHOT_DIR = path.join(__dirname, '../review/_gate_shots_20260703');

async function runOneBattle(page, battleNum, allLines) {
  console.log(`\n--- Battle ${battleNum} start ---`);

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

  for (let iter = 0; iter < 400; iter++) {
    const lines = await collectLogs();
    lines.forEach(l => allLines.add(l));

    const st = await page.evaluate(() => ({
      busy: window.busy,
      gameOver: window.gameOver,
      cmdDisplay: (document.getElementById('cmd') || {}).style?.display,
      movesDisplay: (document.getElementById('moves') || {}).style?.display,
      partyDisplay: (document.getElementById('party') || {}).style?.display,
      logCount: document.querySelectorAll('#log-scroll .log-line').length,
      turnNo: window.turnNo,
    }));

    if (st.gameOver && iter > 10) {
      console.log(`  Game over at iter=${iter} turn=${st.turnNo} logs=${allLines.size}`);
      break;
    }

    if (st.busy) {
      try { await page.click('#msgbox', { timeout: 100 }); } catch (e) {}
      await page.waitForTimeout(200);
      continue;
    }

    if (st.cmdDisplay === 'grid') {
      try {
        const fightBtn = page.locator('#c-fight');
        if (await fightBtn.isVisible({ timeout: 200 })) {
          await fightBtn.click();
          await page.waitForTimeout(200);
          continue;
        }
      } catch (e) {}
    }

    if (st.movesDisplay === 'grid') {
      try {
        const moveBtn = page.locator('#moves button[data-i]:not([disabled])').first();
        if (await moveBtn.isVisible({ timeout: 200 })) {
          await moveBtn.click();
          await page.waitForTimeout(200);
          continue;
        }
      } catch (e) {}
    }

    if (st.partyDisplay === 'grid') {
      try {
        const partyBtn = page.locator('#party button[data-i]:not([disabled])').first();
        if (await partyBtn.isVisible({ timeout: 200 })) {
          await partyBtn.click();
          await page.waitForTimeout(200);
          continue;
        }
      } catch (e) {}
    }

    await page.waitForTimeout(400);
  }

  // 最終ログ収集
  const lines = await collectLogs();
  lines.forEach(l => allLines.add(l));
  console.log(`  Battle ${battleNum} complete. Total unique lines: ${allLines.size}`);
}

async function main() {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const allLines = new Set();
  const jsErrors = [];

  for (let b = 1; b <= 4; b++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(`${BASE}/real_battle.html?lang=en`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      localStorage.setItem('lang', 'en');
      const sp = document.getElementById('msg-speed');
      if (sp) sp.value = '400';
    });

    // バトル開始
    try {
      await page.click('#btn-start', { timeout: 5000 });
      await page.waitForTimeout(2500);
    } catch (e) {
      console.log(`Battle ${b}: Could not start:`, e.message);
      await context.close();
      continue;
    }

    if (b === 1) {
      await page.screenshot({ path: `${SHOT_DIR}/rb_01_battle_start_en.png` });
    }

    await runOneBattle(page, b, allLines);

    if (b === 1) {
      await page.screenshot({ path: `${SHOT_DIR}/rb_02_battle1_end_en.png` });
    } else if (b === 3) {
      await page.screenshot({ path: `${SHOT_DIR}/rb_03_battle3_end_en.png` });
    }

    await context.close();
  }

  await browser.close();

  // 日本語残存チェック
  const jaLines = [...allLines].filter(l => RE_JA.test(l));
  const enLines = [...allLines].filter(l => !RE_JA.test(l));

  console.log('\n=== All collected log lines ===');
  [...allLines].sort().forEach(l => console.log(l));

  console.log(`\nTotal: ${allLines.size}, JA: ${jaLines.length}, EN: ${enLines.length}`);
  if (jaLines.length > 0) {
    console.log('\n=== UNTRANSLATED (JA) ===');
    jaLines.forEach(l => console.log('JA:', l));
  }
  if (jsErrors.length > 0) {
    console.log('\n=== JS Errors ===');
    [...new Set(jsErrors)].forEach(e => console.log('ERR:', e));
  }

  const result = {
    ts: new Date().toISOString(),
    total: allLines.size,
    ja_count: jaLines.length,
    js_errors: [...new Set(jsErrors)],
    ja_lines: jaLines,
    all_lines: [...allLines].sort(),
  };
  const outPath = `${SHOT_DIR}/log_collect_result.json`;
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nResult: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
