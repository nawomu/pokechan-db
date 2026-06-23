#!/usr/bin/env node
// i18n 監査ハーネス: 各ページ×各言語をブラウザで開き、残った日本語(テキスト+ツールチップ属性)を検出。
// 使い方: node tools/i18n_audit_playwright.js [lang1,lang2,...] [--page=foo.html]
//   例: node tools/i18n_audit_playwright.js en
//       node tools/i18n_audit_playwright.js en,fr,ko
// 前提: ローカルサーバが http://127.0.0.1:8000 で稼働中。
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8000';
const PAGES = [
  'index.html', 'pokemon_db_v9.html', 'party_checker.html', 'waza-list.html', 'items_list.html',
  'type_chart.html', 'news.html', 'battle_simulator.html', 'real_battle.html', 'real_battle_simulator.html',
  'how_to_use.html', 'db_guide.html', 'builder_guide.html', 'making.html', 'sitemap.html',
  'contact.html', 'privacy.html', 'terms.html', 'disclaimer.html',
];

const argLangs = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2].split(',') : ['en'];
const onlyPage = (process.argv.find(a => a.startsWith('--page=')) || '').split('=')[1];
const pages = onlyPage ? [onlyPage] : PAGES;

// ページ内で実行: 日本語が残ったテキスト/属性を収集(data-i18n-audit-skip は除外)
function scanFn() {
  const JA = /[ぁ-ゖァ-ヺ一-龯]/; // ひら/カタ/漢字
  const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
  const out = []; const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement;
    if (!el || skipTags.has(el.tagName)) continue;
    if (el.closest('[data-i18n-audit-skip]') || el.closest('.i18n-switcher') || el.closest('.copyright') || el.closest('.site-footer') || el.classList.contains('copyright') || el.closest('[aria-label*="広告"]') || el.tagName==='IFRAME' || /日本語|简体中文|繁體中文|한국어|Español|Français|Deutsch|Italiano/.test((n.textContent||'').trim())) continue;
    const t = (n.textContent || '').trim();
    if (!t || !JA.test(t)) continue;
    const k = t.slice(0, 60);
    if (seen.has(k)) continue; seen.add(k);
    out.push({ text: k, where: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\s+/)[0] : '') });
  }
  document.querySelectorAll('[title],[data-desc],[placeholder],[aria-label]').forEach((el) => {
    if (el.closest('[data-i18n-audit-skip]') || el.closest('.i18n-switcher') || el.closest('.copyright') || el.closest('.site-footer') || el.closest('[aria-label*="広告"]') || el.tagName==='IFRAME' || (el.getAttribute('title')||'').includes('広告')) return;
    ['title', 'data-desc', 'placeholder', 'aria-label'].forEach((a) => {
      const v = el.getAttribute(a);
      if (!v || !JA.test(v)) return;
      const k = '@' + a + ':' + v.slice(0, 50);
      if (seen.has(k)) return; seen.add(k);
      out.push({ text: '[' + a + '] ' + v.slice(0, 55), where: el.tagName.toLowerCase() });
    });
  });
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const lang of argLangs) {
    report[lang] = {};
    const ctx = await browser.newContext();
    await ctx.addInitScript((l) => { try { localStorage.setItem('pchamdb.lang', l); } catch (e) {} }, lang);
    const page = await ctx.newPage();
    for (const pg of pages) {
      try {
        await page.goto(BASE + '/' + pg, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(900); // i18n 適用 + 動的描画待ち
        const leaks = await page.evaluate(scanFn);
        report[lang][pg] = leaks;
        const tag = leaks.length === 0 ? 'OK ' : leaks.length + '件';
        console.log(`[${lang}] ${pg.padEnd(28)} ${tag}`);
      } catch (e) {
        report[lang][pg] = [{ text: 'ERROR: ' + e.message.slice(0, 60), where: 'load' }];
        console.log(`[${lang}] ${pg.padEnd(28)} LOAD ERR`);
      }
    }
    await ctx.close();
  }
  await browser.close();
  const fs = require('fs');
  fs.writeFileSync('/tmp/i18n_audit_report.json', JSON.stringify(report, null, 1));
  // サマリ
  console.log('\n=== サマリ(言語別 総残日本語件数) ===');
  for (const lang of argLangs) {
    const total = Object.values(report[lang]).reduce((s, a) => s + a.length, 0);
    const pagesWith = Object.values(report[lang]).filter((a) => a.length).length;
    console.log(`  ${lang}: ${total}件 / ${pagesWith}ページ`);
  }
  console.log('詳細: /tmp/i18n_audit_report.json');
})();
