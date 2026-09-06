#!/usr/bin/env node
/* 段Dの実機ゲート。python3 -m http.server 8000 の起動後:
 * node tools/_views_pdca_playwright.js [outdir]
 * 正典8ページの描画・全件名簿・HTTP/JS・スクリーンショットを検証する。
 * 期待値はNode側でmasterから読む。ページのPokeDB自身を正解にしない。
 * バトルは従来どおり読み取りのみ。ブラウザ起動失敗もexit 1。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { isDeepStrictEqual } = require('util');
const { observePage, openReadyPage } = require('./_lib/browser_audit');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://127.0.0.1:8000/';
const PL = 'const L=(typeof POKEMON_LIST!=="undefined")?POKEMON_LIST:((typeof DATA!=="undefined")?DATA:[]);';
const POKEMON_PROBE = PL + '({n:L.length,names:L.map(p=>p.name),stats:L.map(p=>[p.name,p.hp,p.atk,p.def,p.spatk,p.spdef,p.spd]),rendered:document.querySelectorAll("table tbody tr").length})';
const PAGES = [
  // 旧URLの転送スタブでなく、昇格済みの本体を検査する。
  { url: 'pokemon_db.html', kind: 'pokemon-ch', ordered: true, wait: 'typeof dbReady !== "undefined" && dbReady && document.querySelectorAll("table tbody tr").length > 0', probe: POKEMON_PROBE },
  { url: 'pokemon_db_all.html', kind: 'pokemon-all', ordered: true, wait: 'typeof dbReady !== "undefined" && dbReady && document.querySelectorAll("table tbody tr").length > 0', probe: POKEMON_PROBE },
  { url: 'ability_all.html', kind: 'abilities', wait: 'document.querySelectorAll("#abilityBody .ab-name").length > 0', probe: '(()=>{const rows=[...document.querySelectorAll("#abilityBody .ab-name")];return {n:rows.length,names:rows.map(el=>el.textContent.trim())}})()' },
  { url: 'items_db_all_v2.html', kind: 'items-all', wait: 'document.querySelectorAll("#itemBody .it-name").length > 0', probe: '(()=>{const rows=[...document.querySelectorAll("#itemBody .it-name")];return {n:rows.length,names:rows.map(el=>el.textContent.trim())}})()' },
  { url: 'waza-list_all.html', kind: 'moves', wait: 'document.querySelectorAll("#tbody tr").length > 0', probe: 'const W=(typeof WAZA_MAP!=="undefined")?WAZA_MAP:{};({n:Object.keys(W).length,names:Object.values(W).map(w=>w.name)})' },
  { url: 'party_checker.html', kind: 'pokemon-ch', probe: PL + '({n:L.length,names:L.map(p=>p.name),items:Object.values(window.ITEMS_DATABASE?.items||{}).map(i=>i.name)})' },
  // real_battleの持ち物は外側globalでなくsimのiframeが持つ。未読込は待機し、欠落は全件照合で落とす。
  { url: 'real_battle.html', kind: 'pokemon-ch',
    wait: '!!document.getElementById("engine-frame")?.contentWindow?.ITEMS_DATABASE?.items',
    probe: PL + '({n:L.length,names:L.map(p=>p.name),items:Object.values(document.getElementById("engine-frame")?.contentWindow?.ITEMS_DATABASE?.items||{}).map(i=>i.name)})' },
  { url: 'items_list.html', kind: 'items-house', probe: '(()=>{const rows=[...document.querySelectorAll("td.name [data-item-ja]")];return {n:rows.length,names:rows.map(el=>el.getAttribute("data-item-ja"))}})()' },
];

function loadExpected(root = ROOT) {
  const read = name => JSON.parse(fs.readFileSync(path.join(root, 'master', name + '.json'), 'utf8')).items;
  const pokemon = read('pokemon'), items = read('items');
  return {
    'pokemon-ch': pokemon.filter(p => p.champions).sort((a, b) => a.champions_display_order - b.champions_display_order),
    'pokemon-all': pokemon.slice().sort((a, b) => a.display_order - b.display_order),
    abilities: read('abilities'), moves: read('moves'),
    'items-all': items,
    // 既存契約: Championsビューの道具は「家の分類あり」(HANDOFF §4-4)。
    'items-house': items.filter(i => i.category),
  };
}

function compareRoster(actual, expected, ordered = false) {
  if (!Array.isArray(actual)) return ['名簿を取得できません'];
  const expectedNames = expected.map(row => row.name);
  if (isDeepStrictEqual(ordered ? actual : actual.slice().sort(), ordered ? expectedNames : expectedNames.slice().sort())) return [];
  const a = new Set(actual), e = new Set(expectedNames);
  return ['名簿不一致: actual=' + actual.length + ' expected=' + expectedNames.length,
    '欠け=' + expectedNames.filter(n => !a.has(n)).join(',') + ' 余分=' + actual.filter(n => !e.has(n)).join(',') + ' 重複=' + (actual.length - a.size),
    ...(ordered && actual.length === expectedNames.length ? ['表示順も照合対象'] : [])];
}

function checkSnapshot(pg, info, expected) {
  const errors = compareRoster(info.names, expected[pg.kind], pg.ordered);
  if (info.n !== expected[pg.kind].length) errors.push('件数不一致: ' + info.n + ' != ' + expected[pg.kind].length);
  if (pg.ordered) {
    const stats = expected[pg.kind].map(p => [p.name, p.hp, p.atk, p.def, p.spatk, p.spdef, p.spd]);
    if (!isDeepStrictEqual(info.stats, stats)) errors.push('種族値の全件照合不一致');
    if (!(info.rendered > 0)) errors.push('表が描画されていません');
  }
  if (pg.url === 'party_checker.html' || pg.url === 'real_battle.html') {
    errors.push(...compareRoster(info.items, expected['items-house']).map(s => '持ち物: ' + s));
  }
  return errors;
}

async function auditViewPage(page, pg, expected, { outdir, timeout = 20000, settleMs = 1500 } = {}) {
  // 同一originを監査し、既存のアイコン未収集だけを継続して除外。サイト内の通信断は落とす。
  const knownImageGap = r => r.request().resourceType() === 'image' &&
    /\/images\/item\/[^/]+\.png$/.test(new URL(r.url()).pathname) && r.status?.() === 404;
  const observed = observePage(page, { origin: BASE, ignoreResponse: knownImageGap, checkConsole: true });
  let info = {};
  try {
    await page.addInitScript(() => { localStorage.setItem('pchamdb.lang', 'ja'); });
    await openReadyPage(page, BASE + pg.url, { timeout });
    if (pg.wait) await page.waitForFunction(pg.wait, null, { timeout });
    await page.waitForTimeout(settleMs);
    info = await page.evaluate(pg.probe);
    checkSnapshot(pg, info, expected).forEach(s => observed.add('data', s));
    if (outdir) await page.screenshot({ path: path.join(outdir, pg.url.replace('.html', '.png')) });
  } catch (e) {
    observed.add('load', e.message);
  } finally {
    observed.dispose();
  }
  return { page: pg.url, ok: observed.errors.length === 0, n: info.n,
    expected: expected[pg.kind].length, items: info.items?.length, errors: observed.errors };
}

async function main(outdir = process.argv[2] || path.join(os.tmpdir(), 'pchamdb-pdca-views')) {
  fs.mkdirSync(outdir, { recursive: true });
  const expected = loadExpected();
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const report = [];
  try {
    for (const pg of PAGES) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      try {
        const result = await auditViewPage(page, pg, expected, { outdir });
        report.push(result);
        console.log(result.ok ? '✅' : '❌', pg.url, 'n=' + result.n + '/' + result.expected,
          result.items != null ? 'items=' + result.items : '', result.errors.map(e => e.text).join(' | '));
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(outdir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const fail = report.filter(r => !r.ok).length;
  console.log(fail ? '❌ ' + fail + 'ページ不合格' : '✅ 段D実機ゲート合格(8ページ・全件名簿一致・JSエラー0)');
  return fail ? 1 : 0;
}

module.exports = { PAGES, loadExpected, compareRoster, checkSnapshot, auditViewPage, main };
if (require.main === module) main().then(code => { process.exitCode = code; }).catch(e => {
  console.error('❌ 段D実機ゲートを完了できません: ' + e.message);
  process.exitCode = 1;
});
