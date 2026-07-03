#!/usr/bin/env node
/**
 * 阿部さん再現(本命): jaのまま対戦を進めてログを溜める → バトル途中でENに切替
 * → 既存ログ行がjaのまま残るか確認(=「英語モードでログの大半がja」の再現)。
 * 使い方: node tools/_repro_midbattle_switch.js
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8000';
const SHOT_DIR = '/Users/masamichi/Documents/ポケモンDB/review/_gate_shots_20260703';
const RE_JA = /[぀-ゟ゠-ヿ一-鿿]/;

async function collectLogs(page) {
  return await page.evaluate(() => {
    const out = { msg: [], log: [] };
    document.querySelectorAll('#msg-lines .ml-line').forEach(el => { const t = el.textContent.trim(); if (t) out.msg.push(t); });
    document.querySelectorAll('#log-scroll .log-line').forEach(el => { const t = el.textContent.trim(); if (t) out.log.push(t); });
    return out;
  });
}

async function playTurns(page, nTurns) {
  let turns = 0;
  for (let iter = 0; iter < 150 && turns < nTurns; iter++) {
    const st = await page.evaluate(() => ({
      busy: window.busy, gameOver: window.gameOver,
      cmdDisplay: (document.getElementById('cmd') || {}).style?.display,
      movesDisplay: (document.getElementById('moves') || {}).style?.display,
      partyDisplay: (document.getElementById('party') || {}).style?.display,
    }));
    if (st.gameOver) break;
    if (st.busy) { try { await page.click('#msgbox', { timeout: 100 }); } catch (e) {} await page.waitForTimeout(150); continue; }
    if (st.cmdDisplay === 'grid') {
      try { const b = page.locator('#c-fight'); if (await b.isVisible({ timeout: 200 })) { await b.click(); await page.waitForTimeout(150); continue; } } catch (e) {}
    }
    if (st.movesDisplay === 'grid') {
      try { const b = page.locator('#moves button[data-i]:not([disabled])').first();
        if (await b.isVisible({ timeout: 200 })) { await b.click(); turns++; await page.waitForTimeout(150); continue; } } catch (e) {}
    }
    if (st.partyDisplay === 'grid') {
      try { const b = page.locator('#party button[data-i]:not([disabled])').first();
        if (await b.isVisible({ timeout: 200 })) { await b.click(); await page.waitForTimeout(150); continue; } } catch (e) {}
    }
    await page.waitForTimeout(300);
  }
}

async function main() {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ja-JP' });
  const page = await context.newPage();
  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));

  await page.goto(`${BASE}/real_battle.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  console.log('lang at open:', await page.evaluate(() => window.I18N && window.I18N.lang));

  // jaのまま対戦開始→3ターン進める(ログをjaで溜める)
  await page.evaluate(() => { const sp = document.getElementById('msg-speed'); if (sp) sp.value = '400'; const am = document.getElementById('auto-msg'); if (am && !am.checked) am.click(); });
  await page.click('#btn-start', { timeout: 5000 });
  await page.waitForTimeout(2500);
  await playTurns(page, 3);

  const before = await collectLogs(page);
  const beforeJa = before.log.filter(l => RE_JA.test(l)).length;
  console.log(`before switch: log lines=${before.log.length}, ja=${beforeJa}`);

  // ★バトル途中でENに切替(阿部さん操作の再現)
  await page.click('#i18n-switcher .i18n-switcher-btn');
  await page.waitForTimeout(300);
  await page.click('#i18n-switcher .i18n-switcher-menu button[data-lang="en"]');
  await page.waitForTimeout(1500);

  const after = await collectLogs(page);
  const afterJaLog = after.log.filter(l => RE_JA.test(l));
  const afterJaMsg = after.msg.filter(l => RE_JA.test(l));
  console.log(`after switch: log lines=${after.log.length}, ja=${afterJaLog.length} / msg lines=${after.msg.length}, ja=${afterJaMsg.length}`);
  await page.screenshot({ path: `${SHOT_DIR}/rb_20_midbattle_switch.png` });

  if (afterJaLog.length) {
    console.log('\n=== JA lines remaining in #log-scroll after EN switch ===');
    afterJaLog.forEach(l => console.log('JA:', l));
  }
  if (afterJaMsg.length) {
    console.log('\n=== JA lines remaining in #msg-lines after EN switch ===');
    afterJaMsg.forEach(l => console.log('JA:', l));
  }

  // 切替後さらに1ターン(新規行はENで出るか)
  await playTurns(page, 1);
  const final = await collectLogs(page);
  const finalJa = final.log.filter(l => RE_JA.test(l));
  console.log(`\nafter 1 more turn: log lines=${final.log.length}, ja=${finalJa.length}`);
  await page.screenshot({ path: `${SHOT_DIR}/rb_21_midbattle_switch_after_turn.png` });

  // ★往復チェック: EN→jaに戻して、全行がjaに復元されるか(data-bl-src経由)
  await page.click('#i18n-switcher .i18n-switcher-btn');
  await page.waitForTimeout(300);
  await page.click('#i18n-switcher .i18n-switcher-menu button[data-lang="ja"]');
  await page.waitForTimeout(1200);
  const backJa = await collectLogs(page);
  const backJaCount = backJa.log.filter(l => RE_JA.test(l)).length;
  console.log(`\nafter switch back to ja: log lines=${backJa.log.length}, ja=${backJaCount} (expect all ja)`);
  const roundtripOk = backJaCount === backJa.log.length;
  if (!roundtripOk) {
    backJa.log.filter(l => !RE_JA.test(l)).forEach(l => console.log('EN-remains:', l));
  }

  if (jsErrors.length) { console.log('\nJS Errors:'); [...new Set(jsErrors)].forEach(e => console.log('ERR:', e)); }

  fs.writeFileSync(`${SHOT_DIR}/midbattle_switch_result.json`, JSON.stringify({
    ts: new Date().toISOString(),
    before_log_total: before.log.length, before_log_ja: beforeJa,
    after_log_total: after.log.length, after_log_ja: afterJaLog.length,
    after_msg_total: after.msg.length, after_msg_ja: afterJaMsg.length,
    final_log_total: final.log.length, final_log_ja: finalJa.length,
    after_ja_lines: afterJaLog, final_ja_lines: finalJa,
    js_errors: [...new Set(jsErrors)],
  }, null, 2));

  await browser.close();
  console.log(afterJaLog.length === 0 && finalJa.length === 0 ? '\nRESULT: PASS (existing lines re-translated)' : `\nRESULT: FAIL (ja remains after switch: log=${afterJaLog.length})`);
}

main().catch(e => { console.error(e); process.exit(1); });
