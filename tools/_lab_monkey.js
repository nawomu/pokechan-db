// バトルラボ モンキーテスト: 無茶操作の乱打+不変条件チェック
// 各バーストでランダム操作→「詰み/JSエラー/エンジン死」を検査。シード付きで再現可能。
const { chromium } = require('playwright');
const URL = process.env.MONKEY_URL || 'http://localhost:8000/battle_lab.html';
const SEED = parseInt(process.env.MONKEY_SEED || '12345', 10);
const DURATION_MS = parseInt(process.env.MONKEY_MIN || '10', 10) * 60 * 1000;
let seed = SEED;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const jsErrors = [];
const incidents = [];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('dialog', d => rnd() < 0.5 ? d.accept() : d.dismiss());   // 確認ダイアログもランダム応答
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404|net::ERR|Failed to load resource|adsbygoogle|googlesyndication/.test(m.text())) jsErrors.push(m.text()); });
  const ev = (fn, ...a) => page.evaluate(fn, ...a).catch(() => null);
  const simx = fn => ev(f => { try { const S = document.getElementById('engine-frame').contentWindow.__sim; return eval('(' + f + ')')(S); } catch(e){ return null; } }, fn.toString());
  const logLen = async () => (await simx(S => (S.battleLog || []).length)) ?? -1;

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await ev(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); } const s = document.getElementById('msg-speed'); if (s){ s.value = '1700'; s.dispatchEvent(new Event('change')); } });

  // 操作プール(全部「ユーザーがやりうる/やってはいけない」操作)
  const ACTIONS = [
    ['start_battle', () => ev(() => { const b = document.getElementById('btn-start'); if (b && !document.body.classList.contains('in-battle')) b.click(); })],
    ['random_team', () => ev(() => { const b = document.getElementById('btn-random'); if (b && !document.body.classList.contains('in-battle')) b.click(); })],
    ['click_move', () => ev(() => { const m = document.querySelectorAll('#moves button[data-i]'); if (m.length) m[Math.floor(Math.random() * m.length)].click(); })],
    ['spam_moves_x5', async () => { for (let i = 0; i < 5; i++){ await ev(() => { const m = document.querySelector('#moves button[data-i]'); if (m) m.click(); }); await page.waitForTimeout(60); } }],
    ['toggle_ai_self', () => ev(() => document.getElementById('lab-ai-self')?.click())],
    ['toggle_ai_opp', () => ev(() => document.getElementById('lab-ai-opp')?.click())],
    ['toggle_ai_spam', async () => { for (let i = 0; i < 8; i++){ await ev(() => document.getElementById(Math.random() < 0.5 ? 'lab-ai-self' : 'lab-ai-opp')?.click()); await page.waitForTimeout(80); } }],
    ['auto_toggle', () => ev(() => document.getElementById('lab-auto-toggle')?.click())],
    ['undo', () => ev(() => document.getElementById('lab-undo-btn')?.click())],
    ['undo_spam', async () => { for (let i = 0; i < 4; i++){ await ev(() => document.getElementById('lab-undo-btn')?.click()); await page.waitForTimeout(120); } }],
    ['open_party', () => ev(() => (document.querySelector('#moves .party-open') || document.getElementById('c-party'))?.click())],
    ['party_back', () => ev(() => document.querySelector('#party .sw-back')?.click())],
    ['party_slot', () => ev(() => { const s = document.querySelectorAll('#party button.slot[data-i]:not([disabled])'); if (s.length) s[Math.floor(Math.random() * s.length)].click(); })],
    ['party_confirm', () => ev(() => (document.querySelector('#party .sw-yes') || document.querySelector('#party .sw-go') || document.querySelector('#party .sw-stay'))?.click())],
    ['party_add', () => ev(() => { const b = document.querySelectorAll('.party-add-member'); if (b.length) b[Math.floor(Math.random() * b.length)].click(); })],
    ['picker_pick', () => ev(() => { const b = document.querySelectorAll('#pp-list button[data-n]'); if (b.length) b[Math.floor(Math.random() * b.length)].click(); })],
    ['picker_close_esc', () => ev(() => { const p = document.getElementById('poke-picker'); if (p && p.style.display === 'flex') p.style.display = 'none'; })],
    ['revive', () => ev(() => { const b = document.querySelectorAll('.sw-revive'); if (b.length) b[Math.floor(Math.random() * b.length)].click(); })],
    ['gear', () => ev(() => { const g = document.querySelectorAll('.pb-gear'); if (g.length) g[Math.floor(Math.random() * g.length)].click(); })],
    ['bar_icon', () => ev(() => { const c = document.querySelectorAll('[data-bi]'); if (c.length) c[Math.floor(Math.random() * c.length)].click(); })],
    ['god_hand_open', () => ev(() => { const g = document.querySelector('#god-hand summary, #god-hand-toggle, [data-gh-toggle]'); if (g) g.click(); })],
    ['god_hand_random', () => ev(() => { const inputs = document.querySelectorAll('#god-hand input[type="range"], #god-hand select'); if (inputs.length){ const el = inputs[Math.floor(Math.random() * inputs.length)]; if (el.type === 'range'){ el.value = String(Math.floor(Math.random() * 101)); el.dispatchEvent(new Event('input')); } else { const o = el.options; if (o.length){ el.selectedIndex = Math.floor(Math.random() * o.length); el.dispatchEvent(new Event('change')); } } } })],
    ['weak_watch_desc', () => ev(() => { const b = document.querySelectorAll('.watch-open, .weak-open, .desc-toggle'); if (b.length) b[Math.floor(Math.random() * b.length)].click(); })],
    ['lang_switch', () => ev(() => { const langs = ['en', 'ko', 'zh-Hans', 'ja']; if (window.I18N && I18N.setLang) I18N.setLang(langs[Math.floor(Math.random() * langs.length)]); })],
    ['field_click', () => ev(() => document.getElementById('field')?.click())],
    ['reset_battle', () => ev(() => { if (Math.random() < 0.3) document.querySelector('#btn-battle-reset, [data-battle-reset]')?.click(); })],
    ['exit', () => ev(() => { if (Math.random() < 0.25) document.getElementById('btn-exit')?.click(); })],
    ['revive_continue', () => ev(() => document.getElementById('c-revive-continue')?.click())],
    ['end_battle', () => ev(() => { if (Math.random() < 0.3) document.getElementById('c-end-battle')?.click(); })],
    ['mega_button', () => ev(() => document.querySelector('.mega-side')?.click())],
    ['stats_gear_menu', () => ev(() => document.querySelector('.stats-open')?.click())],
    ['modal_close', () => ev(() => { document.querySelectorAll('#stats-modal #sm-close, .choice-close, #mp-close').forEach(b => { if (Math.random() < 0.7) b.click(); }); })],
    ['dupes_toggle', () => ev(() => document.getElementById('allow-dupes')?.click())],
  ];

  const t0 = Date.now();
  let bursts = 0, lastLog = await logLen(), lastProgress = Date.now(), recovers = 0;
  while (Date.now() - t0 < DURATION_MS){
    bursts++;
    const n = 3 + Math.floor(rnd() * 8);
    const names = [];
    for (let i = 0; i < n; i++){
      const [name, fn] = pick(ACTIONS);
      names.push(name);
      try { await fn(); } catch(e){}
      await page.waitForTimeout(80 + Math.floor(rnd() * 250));
    }
    await page.waitForTimeout(1200);
    // 不変条件チェック
    const alive = await simx(S => !!S && !!S.sides);
    if (alive === null || alive === false){
      incidents.push({ burst: bursts, type: 'ENGINE_DEAD', actions: names });
      break;
    }
    if (jsErrors.length){
      incidents.push({ burst: bursts, type: 'JS_ERROR', actions: names, errors: jsErrors.splice(0) });
    }
    // 詰み検出: バトル中なのに60秒間 何も操作可能でない+ログ停止
    const L = await logLen();
    const state = await ev(() => ({
      inBattle: document.body.classList.contains('in-battle'),
      interactable: !!(
        (document.getElementById('moves')?.style.display === 'flex') ||
        (document.getElementById('party')?.style.display === 'flex') ||
        (document.getElementById('poke-picker')?.style.display === 'flex') ||
        (document.getElementById('stats-modal')?.style.display === 'flex') ||
        (document.getElementById('c-revive-continue') && document.getElementById('c-revive-continue').style.display !== 'none' && document.getElementById('c-revive-continue').offsetParent) ||
        !document.body.classList.contains('in-battle')
      ),
    }));
    if (L > lastLog || (state && state.interactable)){ lastLog = Math.max(L, lastLog); lastProgress = Date.now(); }
    else if (Date.now() - lastProgress > 60000){
      incidents.push({ burst: bursts, type: 'STUCK', actions: names, state, log: L });
      await page.screenshot({ path: '/private/tmp/claude-501/-Users-masamichi-Documents-----DB/fdbd23d3-7b77-44ff-84c9-17c0c24d551d/scratchpad/monkey_stuck_' + bursts + '.png' });
      // 回復を試みる(リロード)→続行
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      recovers++;
      lastProgress = Date.now();
      lastLog = await logLen();
    }
  }
  await browser.close();
  console.log(JSON.stringify({ seed: SEED, durationSec: Math.round((Date.now() - t0) / 1000), bursts, recovers, incidents: incidents.slice(0, 20), incidentCount: incidents.length }, null, 1));
  process.exit(incidents.length ? 1 : 0);
})().catch(e => { console.error('MONKEY ERR', e); process.exit(2); });
