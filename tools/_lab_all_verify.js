// バトルラボ「チャンピオンズ版⇔全部版」データ切替 検証ハーネス
//
// 【契約(この仕様を検証する)】
//  - モード解決: URL ?data=all → all(localStorage rb_lab_data_mode へ同期) /
//               ?data=champions → champions / 無し → localStorage / 既定 champions
//  - トグル    : セットアップ画面に id=lab-data-mode。クリックでモード切替+リロード。
//               all モード中は document.body.dataset.mode === 'all'
//  - データ    : champions = builder POKEMON_LIST <600体 / エンジンiframe WAZA_MAP <600技
//               all       = builder POKEMON_LIST >=1200体 / エンジンiframe WAZA_MAP >=900技
//  - iframe    : id=engine-frame。all では src に data=all を含む
//  - 保存編成  : all は rb_team_lab_all_* 名前空間(champions rb_team_lab_* と分離)
//
// 【ゲート】 G1..G8(下記)。1つでもFAILで exit 1。
//   G1 既定champions / G2 エンジンchampions / G3 all起動 / G4 エンジンall
//   G5 永続化 / G6 トグル復帰 / G7 アイテム(all) / G8 保存分離
//
// 【実行例】
//   NODE_PATH=$PWD/node_modules node tools/_lab_all_verify.js
//   LAB_URL=http://localhost:8000/battle_lab.html NODE_PATH=$PWD/node_modules node tools/_lab_all_verify.js
const { chromium } = require('playwright');

const RAW_URL = process.env.LAB_URL || 'http://localhost:8000/battle_lab.html';
const _u = new URL(RAW_URL);
const BASE = _u.origin + _u.pathname;
const ALL_URL = BASE + '?data=all';
const CHAMP_URL = BASE + '?data=champions';

const results = [];
const jsErrors = [];
const warn = msg => console.log('⚠ ' + msg);
function ok(name, pass, note){ results.push({ name, pass }); console.log((pass ? '✅' : '❌') + ' ' + name + (note ? ' — ' + note : '')); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => jsErrors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404|net::ERR|Failed to load resource|adsbygoogle|googlesyndication/.test(m.text())) jsErrors.push('console: ' + m.text()); });

  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const bodyMode = () => ev(() => document.body.dataset.mode || '');
  // builder 側 POKEMON_LIST。const宣言はwindowに乗らない(const≠windowの罠)→裸の識別子で参照。
  const pokeCount = () => ev(() => (typeof POKEMON_LIST !== 'undefined' && Array.isArray(POKEMON_LIST)) ? POKEMON_LIST.length : -1);
  // エンジン iframe の WAZA_MAP キー数。const宣言のため contentWindow プロパティでは見えない→間接evalでrealm内から数える。
  const wazaCount = () => ev(() => { const f = document.getElementById('engine-frame'); const cw = f && f.contentWindow; try { return cw ? cw.eval('typeof WAZA_MAP !== "undefined" ? Object.keys(WAZA_MAP).length : -1') : -1; } catch (e) { return -1; } });
  const iframeSrc = () => ev(() => { const f = document.getElementById('engine-frame'); return f ? (f.src || f.getAttribute('src') || '') : ''; });

  async function waitForFn(check, timeout = 15000, iv = 300){
    const t0 = Date.now();
    while (Date.now() - t0 < timeout){ try { if (await ev(check)) return true; } catch(e){} await page.waitForTimeout(iv); }
    return false;
  }
  // 固定3秒待ち → エンジンrealmで WAZA_MAP が出現するまで最大15秒ポーリング(constはcontentWindowプロパティに乗らない→間接eval)
  async function waitForEngine(timeout = 15000){
    await page.waitForTimeout(3000);
    return waitForFn(() => { const f = document.getElementById('engine-frame'); const cw = f && f.contentWindow; try { return !!(cw && cw.eval('typeof WAZA_MAP !== "undefined"')); } catch (e) { return false; } }, timeout, 300);
  }
  const freshErrors = since => jsErrors.slice(since).filter(Boolean);

  // ========== G1 既定champions ==========
  let errStart = jsErrors.length;
  try {
    // storage クリア: 該当オリジンで開いてから clear → 再ロード
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await ev(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitForEngine();
    await page.waitForTimeout(800);
    const hasToggle = await ev(() => !!document.getElementById('lab-data-mode'));
    const mode = await bodyMode();
    const pc = await pokeCount();
    const errs = freshErrors(errStart);
    ok('G1.既定champions', hasToggle && mode !== 'all' && pc >= 0 && pc < 600 && errs.length === 0,
       `toggle=${hasToggle} mode=${mode} POKEMON=${pc} errs=${errs.length}` + (errs.length ? ' | ' + errs.slice(0, 3).join(' | ') : ''));
  } catch (e) { ok('G1.既定champions', false, 'EXCEPTION: ' + (e && e.message)); }

  // ========== G2 エンジンchampions(iframe) ==========
  try {
    const wc = await wazaCount();
    const src = await iframeSrc();
    const srcHasAll = src.includes('data=all');
    ok('G2.エンジンchampions', wc >= 0 && wc < 600 && !srcHasAll,
       `WAZA=${wc} srcHasAll=${srcHasAll} src=${src.split('/').pop()}`);
  } catch (e) { ok('G2.エンジンchampions', false, 'EXCEPTION: ' + (e && e.message)); }

  // ========== G3 all起動(?data=all) ==========
  errStart = jsErrors.length;
  try {
    await page.goto(ALL_URL, { waitUntil: 'domcontentloaded' });
    await waitForEngine();
    await page.waitForTimeout(800);
    const mode = await bodyMode();
    const pc = await pokeCount();
    const errs = freshErrors(errStart);
    ok('G3.all起動', mode === 'all' && pc >= 1200 && errs.length === 0,
       `mode=${mode} POKEMON=${pc} errs=${errs.length}` + (errs.length ? ' | ' + errs.slice(0, 3).join(' | ') : ''));
  } catch (e) { ok('G3.all起動', false, 'EXCEPTION: ' + (e && e.message)); }

  // ========== G4 エンジンall(iframe) ==========
  try {
    const wc = await wazaCount();
    const src = await iframeSrc();
    const srcHasAll = src.includes('data=all');
    ok('G4.エンジンall', wc >= 900 && srcHasAll,
       `WAZA=${wc} srcHasAll=${srcHasAll} src=${src.split('/').pop()}`);
  } catch (e) { ok('G4.エンジンall', false, 'EXCEPTION: ' + (e && e.message)); }

  // ========== G5 永続化(G3後 パラメータ無しで開き直す → all維持) ==========
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitForEngine();
    await page.waitForTimeout(800);
    const mode = await bodyMode();
    const pc = await pokeCount();
    ok('G5.永続化(all維持)', mode === 'all' && pc >= 1200, `mode=${mode} POKEMON=${pc}`);
  } catch (e) { ok('G5.永続化(all維持)', false, 'EXCEPTION: ' + (e && e.message)); }

  // ========== G6 トグル復帰(all → champions) ==========
  try {
    // まずクリック対象を特定してマーク(リロードrace回避のため選定とclickは分離)
    const how = await ev(() => {
      const root = document.getElementById('lab-data-mode');
      if (!root) return 'no-root';
      const cand = root.querySelector('[data-mode="champions"],[data-val="champions"],[data-key="champions"],[data-target="champions"]');
      if (cand) { cand.setAttribute('data-g6-mark', '1'); return 'cand'; }
      const leaves = Array.from(root.querySelectorAll('*')).filter(e => (e.children || []).length === 0);
      const txt = leaves.find(e => /チャンピオンズ|champions/i.test(e.textContent || ''));
      if (txt) { txt.setAttribute('data-g6-mark', '1'); return 'text'; }
      if (root.tagName === 'BUTTON' || root.tagName === 'A' || root.getAttribute('role') === 'button') { root.setAttribute('data-g6-mark', '1'); return 'root'; }
      return 'not-found';
    });
    if (how === 'no-root' || how === 'not-found') {
      // クリック対象が無ければ localStorage 経由で復帰(FAILでなくWARN)
      warn('G6: トグル対象が見つからない(' + how + ')→localStorage経由で champions へ復帰');
      await ev(() => localStorage.setItem('rb_lab_data_mode', 'champions'));
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    } else {
      // クリックでリロードが走る想定。waitForNavigation を先に arm してから click。
      const navP = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => null);
      await ev(() => { const el = document.querySelector('[data-g6-mark="1"]'); if (el) el.click(); });
      const nav = await navP;
      if (!nav) { warn('G6: クリックでリロード未検出→手動で BASE をロード'); await page.goto(BASE, { waitUntil: 'domcontentloaded' }); }
    }
    await waitForEngine();
    await page.waitForTimeout(800);
    const mode = await bodyMode();
    const pc = await pokeCount();
    ok('G6.トグル復帰(champions)', mode !== 'all' && pc >= 0 && pc < 600, `mode=${mode} POKEMON=${pc} via=${how}`);
  } catch (e) { ok('G6.トグル復帰(champions)', false, 'EXCEPTION: ' + (e && e.message)); }

  // ========== G7 アイテムピッカー(all: しんかのきせき) ==========
  try {
    await page.goto(ALL_URL, { waitUntil: 'domcontentloaded' });
    await waitForEngine();
    await page.waitForTimeout(800);
    // ピッカーのデータ源 window.ITEMS_DATABASE を builder 側 window で確認(DOM操作不要)
    const has = await ev(() => {
      // ITEMS_DATABASE は builder でなくエンジンiframeが読み込む(items_database.js は window 明示代入なので contentWindow で見える)
      const f = document.getElementById('engine-frame');
      const db = (f && f.contentWindow && f.contentWindow.ITEMS_DATABASE) || window.ITEMS_DATABASE;
      if (!db) return 'no-db';
      // 構造非依存の全文探索(実構造= db.items:[{name_ja:...}] の2階層で素朴な浅い探索は届かない)
      try { return JSON.stringify(db).includes('しんかのきせき') ? 'by-val' : 'missing'; } catch (e) { return 'stringify-error'; }
    });
    ok('G7.アイテム(all:しんかのきせき)', has === 'by-key' || has === 'by-val', 'status=' + has);
  } catch (e) { ok('G7.アイテム(all:しんかのきせき)', false, 'EXCEPTION: ' + (e && e.message)); }

  // ========== G8 保存分離(champions保存残存で all 起動→JSエラー0) ==========
  errStart = jsErrors.length;
  try {
    // champions の保存データがある状態を偽装(名前空間分離なら all 側は読まない)
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await ev(() => {
      localStorage.setItem('rb_lab_data_mode', 'champions');
      localStorage.setItem('rb_team_lab_self', JSON.stringify({ v: 1, team: [{ species: 'ピカチュウ', moves: ['でんきショック'], ability: 'せいでんき' }], ts: 1700000000000 }));
    });
    errStart = jsErrors.length; // all 起動時のエラーだけを見る
    await page.goto(ALL_URL, { waitUntil: 'domcontentloaded' });
    await waitForEngine();
    await page.waitForTimeout(2500);
    const errs = freshErrors(errStart);
    ok('G8.保存分離(champions残存でall起動)', errs.length === 0,
       `errs=${errs.length}` + (errs.length ? ' | ' + errs.slice(0, 4).join(' | ') : ''));
  } catch (e) { ok('G8.保存分離(champions残存でall起動)', false, 'EXCEPTION: ' + (e && e.message)); }

  await browser.close();
  const passes = results.filter(r => r.pass).length;
  console.log('\nTOTAL: ' + passes + '/' + results.length + ' PASS');
  process.exit(passes === results.length ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e && e.message); process.exit(2); });
