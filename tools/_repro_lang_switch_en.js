#!/usr/bin/env node
/**
 * 阿部さん再現: jaブラウザで real_battle.html を開く → UIスイッチャーでENに切替 → 対戦開始
 * → バトルログのja行数を数える(スクショ+全行dump)。
 * 使い方: node tools/_repro_lang_switch_en.js
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8000';
const SHOT_DIR = '/Users/masamichi/Documents/ポケモンDB/review/_gate_shots_20260703';
const RE_JA = /[぀-ゟ゠-ヿ一-鿿]/;

async function collectLogs(page) {
  return await page.evaluate(() => {
    const lines = [];
    document.querySelectorAll('#msg-lines .ml-line, #log-scroll .log-line').forEach(el => {
      const t = el.textContent.trim();
      if (t) lines.push(t);
    });
    return lines;
  });
}

async function playBattle(page, allLines, maxIter) {
  for (let iter = 0; iter < maxIter; iter++) {
    (await collectLogs(page)).forEach(l => allLines.add(l));
    const st = await page.evaluate(() => ({
      busy: window.busy, gameOver: window.gameOver,
      cmdDisplay: (document.getElementById('cmd') || {}).style?.display,
      movesDisplay: (document.getElementById('moves') || {}).style?.display,
      partyDisplay: (document.getElementById('party') || {}).style?.display,
    }));
    if (st.gameOver && iter > 10) break;
    if (st.busy) { try { await page.click('#msgbox', { timeout: 100 }); } catch (e) {} await page.waitForTimeout(150); continue; }
    if (st.cmdDisplay === 'grid') {
      try { const b = page.locator('#c-fight'); if (await b.isVisible({ timeout: 200 })) { await b.click(); await page.waitForTimeout(150); continue; } } catch (e) {}
    }
    if (st.movesDisplay === 'grid') {
      try { const b = page.locator('#moves button[data-i]:not([disabled])').first(); if (await b.isVisible({ timeout: 200 })) { await b.click(); await page.waitForTimeout(150); continue; } } catch (e) {}
    }
    if (st.partyDisplay === 'grid') {
      try { const b = page.locator('#party button[data-i]:not([disabled])').first(); if (await b.isVisible({ timeout: 200 })) { await b.click(); await page.waitForTimeout(150); continue; } } catch (e) {}
    }
    await page.waitForTimeout(300);
  }
  (await collectLogs(page)).forEach(l => allLines.add(l));
}

async function main() {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  // ★阿部さん環境の再現: 日本語ブラウザ(navigator.language=ja-JP)・localStorage無し
  const context = await browser.newContext({ locale: 'ja-JP' });
  const page = await context.newPage();
  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));

  await page.goto(`${BASE}/real_battle.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const langBefore = await page.evaluate(() => window.I18N && window.I18N.lang);
  console.log('lang before switch:', langBefore);

  // UIスイッチャーで英語に切替(阿部さんの操作を再現)
  await page.click('#i18n-switcher .i18n-switcher-btn');
  await page.waitForTimeout(300);
  await page.click('#i18n-switcher .i18n-switcher-menu button[data-lang="en"]');
  await page.waitForTimeout(1500);

  const langAfter = await page.evaluate(() => ({
    lang: window.I18N && window.I18N.lang,
    translateLogLineDefined: typeof window.translateLogLine,
    sampleTranslate: window.translateLogLine ? window.translateLogLine('きゅうしょに あたった！') : null,
  }));
  console.log('after switch:', JSON.stringify(langAfter));

  await page.screenshot({ path: `${SHOT_DIR}/rb_10_switch_en_setup.png` });

  // 対戦開始
  const allLines = new Set();
  await page.evaluate(() => { const sp = document.getElementById('msg-speed'); if (sp) sp.value = '400'; const am = document.getElementById('auto-msg'); if (am && !am.checked) am.click(); });
  await page.click('#btn-start', { timeout: 5000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOT_DIR}/rb_11_switch_en_battle_start.png` });

  await playBattle(page, allLines, 200);
  await page.screenshot({ path: `${SHOT_DIR}/rb_12_switch_en_battle_log.png` });

  const arr = [...allLines].sort();
  const jaLines = arr.filter(l => RE_JA.test(l));
  console.log('\n=== All lines ===');
  arr.forEach(l => console.log((RE_JA.test(l) ? 'JA: ' : '    ') + l));
  console.log(`\nTotal: ${arr.length}, JA remaining: ${jaLines.length}`);
  if (jsErrors.length) { console.log('\nJS Errors:'); [...new Set(jsErrors)].forEach(e => console.log('ERR:', e)); }

  fs.writeFileSync(`${SHOT_DIR}/lang_switch_repro_result.json`, JSON.stringify({
    ts: new Date().toISOString(), langBefore, langAfter,
    total: arr.length, ja_count: jaLines.length, ja_lines: jaLines, all_lines: arr,
    js_errors: [...new Set(jsErrors)],
  }, null, 2));

  await browser.close();
  console.log(jaLines.length === 0 ? '\nRESULT: PASS (ja=0)' : `\nRESULT: FAIL (ja=${jaLines.length})`);
}

main().catch(e => { console.error(e); process.exit(1); });
