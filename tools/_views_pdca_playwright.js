#!/usr/bin/env node
/* tools/_views_pdca_playwright.js — 段D(生成物の入れ替え)の実機ゲート
 * 使い方: python3 -m http.server 8000 を立ててから
 *   node tools/_views_pdca_playwright.js [outdir]
 * 検査: 各ページで JSエラー0 / データ件数 / 新行(メガガブリアスZ等)の存在 / スクショ
 * 合格条件: 全ページ errors=0 かつ 期待する名前が見つかる → exit 0
 */
'use strict';
const path = require('path');
const { chromium } = require(path.join(process.cwd(), 'node_modules', 'playwright'));
const OUT = process.argv[2] || '/private/tmp/claude-501/-Users-masamichi-Documents-----DB/10f8a687-1395-4a29-aec4-a2abe8e66567/scratchpad/pdca_views';
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8000/';
const NEW_ALL = ['メガガブリアスZ', 'メガルカリオZ', 'メガアブソルZ', 'メガヒードラン', 'メガセグレイブ', 'メガシャリタツ(そったすがた)'];
const NEW_CH = ['メガガブリアスZ', 'メガルカリオZ', 'メガアブソルZ'];
const PL = 'const L=(typeof POKEMON_LIST!=="undefined")?POKEMON_LIST:((typeof DATA!=="undefined")?DATA:[]);';
const PAGES = [
  { url: 'pokemon_db_all_v9.html', probe: PL + '({n:L.length,names:L.map(p=>p.name)})', expect: NEW_ALL },
  { url: 'ability_all.html', initScript: "try{localStorage.setItem('pchamdb.lang','ja')}catch(e){}", wait: 'document.querySelectorAll("#abilityBody tr").length > 100', probe: '(()=>{const rows=[...document.querySelectorAll("#abilityBody tr")].filter(tr=>tr.querySelectorAll("td").length>=4);return {n:rows.length,names:rows.map(tr=>tr.querySelector(".ab-name").textContent.trim())}})()', expect: ['はどうのぼうご'] },
  { url: 'waza-list_all.html', probe: 'const W=(typeof WAZA_MAP!=="undefined")?WAZA_MAP:{};({n:Object.keys(W).length,names:Object.values(W).map(w=>w.name)})', expect: ['10まんボルト'] },
  { url: 'pokemon_db_v9.html', probe: PL + '({n:L.length,names:L.map(p=>p.name)})', expect: NEW_CH },
  { url: 'party_checker.html', probe: PL + '({n:L.length,names:L.map(p=>p.name),items:Object.keys((typeof ITEMS_DATABASE!=="undefined")?ITEMS_DATABASE:(window.ITEMS_DATABASE||{})).length})', expect: NEW_CH },
  { url: 'real_battle.html', probe: PL + '({n:L.length,names:L.map(p=>p.name),items:Object.keys((typeof ITEMS_DATABASE!=="undefined")?ITEMS_DATABASE:(window.ITEMS_DATABASE||{})).length})', expect: NEW_CH },
  { url: 'items_list.html', probe: '({n:document.querySelectorAll("tr").length,names:[document.body.innerText.slice(0,200000)]})', expect: [] },
];
(async () => {
  const b = await chromium.launch(); let fail = 0; const report = [];
  for (const pg of PAGES) {
    const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); }); page.on('response', r => { if (r.status() >= 400) errs.push('HTTP' + r.status() + ' ' + r.url().replace(BASE, '')); });
    if (pg.initScript) { try { await page.addInitScript(pg.initScript); } catch (e) {} }
    try { await page.goto(BASE + pg.url, { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) { errs.push('goto: ' + e.message); }
    await page.waitForTimeout(1500);
    if (pg.wait) { try { await page.waitForFunction(pg.wait, { timeout: 15000 }); } catch (e) { errs.push('wait: ' + e.message); } }
    let info = {}; try { info = await page.evaluate(pg.probe); } catch (e) { errs.push('probe: ' + e.message); }
    const names = new Set(info.names || []); const missing = (pg.expect || []).filter(n => !names.has(n) && !(info.names || []).some(s => typeof s === 'string' && s.includes(n)));
    // 画像: スプライトIDが引けるか(SPRITE_API_IDを読むページのみ)
    const spr = await page.evaluate(() => (typeof SPRITE_API_ID !== 'undefined') ? [SPRITE_API_ID['メガガブリアスZ'], SPRITE_API_ID['メガヒードラン']] : null).catch(() => null);
    const ok = errs.length === 0 && missing.length === 0;
    if (!ok) fail++;
    report.push({ page: pg.url, ok, n: info.n, items: info.items, missing, spriteIds: spr, errors: errs.slice(0, 3) });
    await page.screenshot({ path: path.join(OUT, pg.url.replace('.html', '.png')) }).catch(() => {});
    await page.close();
  }
  await b.close();
  report.forEach(r => console.log((r.ok ? '✅' : '❌'), r.page, 'n=' + r.n, r.items != null ? 'items=' + r.items : '', r.missing.length ? '欠け=' + r.missing.join(',') : '', r.spriteIds ? 'sprite=' + r.spriteIds.join('/') : '', r.errors.length ? 'ERR=' + r.errors.join(' | ') : ''));
  console.log(fail ? `\n❌ ${fail}ページ不合格` : '\n✅ 段D実機ゲート合格(全ページ JSエラー0・新行あり)');
  process.exit(fail ? 1 : 0);
})();
