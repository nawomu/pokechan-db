#!/usr/bin/env node
'use strict';
// 実ブラウザで判定器とW21の障害表示を検査する。python3 -m http.server 8000 が必要。
// node tools/_browser_audit_faults_playwright.js [outdir]
// 外部広告・計測は204に置換して通信しない。この検査はローカル画面の検査に限定する。
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const { auditPage, summarize } = require('./i18n_audit_playwright');
const { loadExpected } = require('./_views_pdca_playwright');
const BASE = 'http://127.0.0.1:8000';

async function main(outdir = process.argv[2] || path.join(os.tmpdir(), 'pchamdb-audit-faults')) {
  fs.mkdirSync(outdir, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const report = [];
  const cases = ['normal', 'document404', 'master404', 'runtime', 'i18nTimeout', 'masterDelay'];
  try {
    for (const pg of ['pokemon_db.html', 'pokemon_db_all.html']) {
      for (const fault of cases) {
        const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
        const result = { page: pg, fault, ok: false, externalRequestsStubbed: 0 };
        try {
          await ctx.route('**/*', route => {
            if (new URL(route.request().url()).origin === BASE) return route.continue();
            result.externalRequestsStubbed++;
            return route.fulfill({ status: 204, body: '' });
          });
          await ctx.addInitScript(() => { localStorage.setItem('pchamdb.lang', 'en'); });
          const page = await ctx.newPage();
          if (fault === 'document404') await page.route(BASE + '/' + pg, route => route.fulfill({
            status: 404, contentType: 'text/html', body: '<html><body>Not found</body></html>',
          }));
          if (fault === 'master404') await page.route('**/master/pokemon.json', route => route.fulfill({ status: 404, body: '{}' }));
          if (fault === 'i18nTimeout') await page.route('**/i18n/runtime.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
          if (fault === 'masterDelay') await page.route('**/master/pokemon.json', async route => {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await route.continue();
          });
          if (fault === 'runtime') await page.addInitScript(() => {
            document.addEventListener('DOMContentLoaded', () => { throw new Error('audit-injected-runtime'); });
          });
          const findings = await auditPage(page, BASE + '/' + pg, 'en', {
            timeout: fault === 'i18nTimeout' ? 1000 : 20000, settleMs: 900,
          });
          result.findings = findings;
          const summary = summarize({ en: { [pg]: findings } }, true);
          result.auditExitCode = summary.exitCode;
          if (fault === 'normal' || fault === 'masterDelay') {
            assert.equal(summary.exitCode, 0, JSON.stringify(findings));
            const count = await page.evaluate(() => DATA.length);
            assert.equal(count, loadExpected()[pg === 'pokemon_db.html' ? 'pokemon-ch' : 'pokemon-all'].length);
          } else {
            assert.equal(summary.exitCode, 1, '故障を正常と判定した');
            const requiredKind = fault === 'runtime' ? 'runtime' : fault === 'i18nTimeout' ? 'load' : 'http';
            assert(findings.some(f => f.kind === requiredKind), '期待した故障の検出がない');
          }
          if (fault === 'master404') {
            const banner = page.locator('[data-pokedb-load-error]');
            await banner.waitFor({ state: 'visible' });
            const message = await banner.innerText();
            assert(message.includes('HTTP 404'));
            assert(!/[ぁ-ゖァ-ヺ]/.test(message), '英語画面に日本語のエラーが残った');
          }
          await page.screenshot({ path: path.join(outdir, pg + '-' + fault + '.png') });
          result.ok = true;
        } catch (e) {
          result.error = e.message;
        } finally {
          await ctx.close();
        }
        report.push(result);
        console.log(result.ok ? '✅' : '❌', pg, fault, result.error || '');
      }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(outdir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return report.every(r => r.ok) ? 0 : 1;
}

if (require.main === module) main().then(code => { process.exitCode = code; }).catch(e => {
  console.error('❌ 故障注入実機ゲートを完了できません: ' + e.message);
  process.exitCode = 1;
});
