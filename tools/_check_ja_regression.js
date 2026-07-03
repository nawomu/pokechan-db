#!/usr/bin/env node
/**
 * JAモードリグレッションチェック
 * real_battle.html を ja 言語で開き、バトルログに英語混入がないか確認する
 * 使い方: node check_ja_regression.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8000';
const SHOT_DIR = '/Users/masamichi/Documents/ポケモンDB/review/_gate_shots_20260703';
// 英語パターン: ログに英語が混入していないか確認
const RE_EN_WORD = /\b(used|fainted|entered|battle|opposing|damage|HP|Speed|Attack|Defense|Special|absorbing|power|paralyzed|afflicted|moves|first|missed|effect|toxic|burned|frozen|asleep|confused|special_attack|special_defense)\b/i;
// JAで正常なログに出るはずのひらがな/カタカナ
const RE_JA = /[぀-ゟ゠-ヿ一-龯]/;

async function runOneBattle(page, battleNum, allLines) {
  console.log(`\n--- JA Battle ${battleNum} start ---`);

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

  for (let iter = 0; iter < 300; iter++) {
    const lines = await collectLogs();
    lines.forEach(l => allLines.add(l));

    const st = await page.evaluate(() => ({
      busy: window.busy,
      gameOver: window.gameOver,
      cmdDisplay: (document.getElementById('cmd') || {}).style?.display,
      movesDisplay: (document.getElementById('moves') || {}).style?.display,
      partyDisplay: (document.getElementById('party') || {}).style?.display,
    }));

    if (st.gameOver && iter > 10) {
      console.log(`  Game over at iter=${iter}`);
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

  const lines = await collectLogs();
  lines.forEach(l => allLines.add(l));
  console.log(`  Battle ${battleNum} complete. Total unique lines: ${allLines.size}`);
}

async function main() {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const allLines = new Set();
  const jsErrors = [];

  for (let b = 1; b <= 2; b++) {
    // ★JAモード = 日本語ブラウザロケール(navigator.language=ja-JP)。
    //   runtime.js は URLパラメータ非対応・localStorageキーは 'pchamdb.lang'。
    const context = await browser.newContext({ locale: 'ja-JP' });
    const page = await context.newPage();
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(`${BASE}/real_battle.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const lang = await page.evaluate(() => {
      const sp = document.getElementById('msg-speed');
      if (sp) sp.value = '400';
      return window.I18N && window.I18N.lang;
    });
    console.log(`Battle ${b}: I18N.lang = ${lang}`);
    if (lang !== 'ja') { console.log('ERROR: expected ja mode'); process.exit(1); }

    try {
      await page.click('#btn-start', { timeout: 5000 });
      await page.waitForTimeout(2500);
    } catch (e) {
      console.log(`Battle ${b}: Could not start:`, e.message);
      await context.close();
      continue;
    }

    await runOneBattle(page, b, allLines);
    await context.close();
  }

  await browser.close();

  // JAモードなのにJAでない行を検出(英語混入チェック)
  const allArr = [...allLines];
  const jaLines = allArr.filter(l => RE_JA.test(l));
  const nonJaLines = allArr.filter(l => !RE_JA.test(l));

  console.log('\n=== JA Mode - All log lines ===');
  allArr.sort().forEach(l => console.log(l));

  console.log(`\nTotal: ${allArr.length}, JA-containing: ${jaLines.length}, non-JA: ${nonJaLines.length}`);

  if (nonJaLines.length > 0) {
    console.log('\n=== SUSPICIOUS (no JA chars - might be untranslated or UI strings) ===');
    nonJaLines.forEach(l => console.log('?:', l));
  }

  if (jsErrors.length > 0) {
    console.log('\n=== JS Errors ===');
    [...new Set(jsErrors)].forEach(e => console.log('ERR:', e));
  }

  const result = {
    ts: new Date().toISOString(),
    mode: 'ja',
    total: allArr.length,
    ja_count: jaLines.length,
    non_ja_count: nonJaLines.length,
    js_errors: [...new Set(jsErrors)],
    non_ja_lines: nonJaLines,
    all_lines: allArr.sort(),
  };
  const outPath = `${SHOT_DIR}/ja_regression_result.json`;
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nResult: ${outPath}`);

  if (jsErrors.length > 0) {
    console.log('\nJA REGRESSION: JS errors detected!');
    process.exit(1);
  } else {
    console.log('\nJA REGRESSION: PASS (no JS errors)');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
