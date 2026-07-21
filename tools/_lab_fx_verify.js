// 特性・場エフェクト増強の検証(battle_lab上でE2E)
const { chromium } = require('playwright');
const URL = 'http://localhost:8000/battle_lab.html';
const results = [];
const jsErrors = [];
function ok(name, pass, note){ results.push({ name, pass }); console.log((pass ? '✅' : '❌') + ' ' + name + (note ? ' — ' + note : '')); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404|net::ERR|Failed to load resource/.test(m.text())) jsErrors.push(m.text()); });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const simx = fn => ev(f => { const S = document.getElementById('engine-frame').contentWindow.__sim; return eval('(' + f + ')')(S); }, fn.toString());
  async function waitEl(check, timeout = 15000, iv = 120){
    const t0 = Date.now();
    while (Date.now() - t0 < timeout){ if (await ev(check)) return true; await page.waitForTimeout(iv); }
    return false;
  }
  const movesVisibleFn = () => { const m = document.getElementById('moves'); return !!m && m.style.display === 'flex' && !!m.querySelector('button[data-i]'); };
  // ★2026-07-21: ▶バトルスタートは直接開戦でなく、まず選出(pick)画面(#lab-pick-screen)を挟むようになった。
  // 「6たいぜんぶでバトル」(#lpk-gofull=常に押せる・選出ゼロなら編成順そのまま=旧来のstartBattle相当)で素通りさせる。
  async function passLabPickScreen(){
    await waitEl(() => !!document.getElementById('lab-pick-screen'), 8000);
    await ev(() => { const b = document.getElementById('lpk-gofull'); if (b) b.click(); });
  }

  async function startFresh(){
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await ev(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); } const s = document.getElementById('msg-speed'); if (s){ s.value = '1700'; s.dispatchEvent(new Event('change')); } });
    await ev(() => document.getElementById('btn-random').click());
    await page.waitForTimeout(500);
    await ev(() => document.getElementById('btn-start').click());
    await passLabPickScreen();
    await waitEl(() => document.body.classList.contains('in-battle'), 15000);
    await waitEl(movesVisibleFn, 25000);
  }
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  ok('0.読込(?v=20260718c)', await ev(() => !!document.querySelector('script[src*="fx_primitives.js?v=20260718c"]') && typeof abilityFx === 'function' && typeof hazardFx === 'function'));
  await ev(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); } const s = document.getElementById('msg-speed'); if (s){ s.value = '1700'; s.dispatchEvent(new Event('change')); } });

  // ユニット: abilityFxがバナーを生成
  await ev(() => abilityFx('self', 'いかく'));
  ok('U1.abilityFxバナー生成', await waitEl(() => !!document.querySelector('.rb-ability-banner'), 3000));
  await page.waitForTimeout(1800);

  // 開戦
  await ev(() => document.getElementById('btn-random').click());
  await page.waitForTimeout(600);
  await ev(() => document.getElementById('btn-start').click());
  await passLabPickScreen();
  await waitEl(() => document.body.classList.contains('in-battle'), 15000);
  await waitEl(() => { const m = document.getElementById('moves'); return !!m && m.style.display === 'flex'; }, 25000);

  // E2E-1: 相手ベンチにいかく持ちを仕込み、相手を交代させる(相手AIオフ・switchChoice直挿し)
  await simx(S => { S.sides.opp.bench[0].ability = 'いかく'; S.sides.self.currentHp = 9999; return true; });
  await simx(S => { S.sides.opp.switchChoice = 0; return true; });
  // 自分の技をクリック→ターン実行(相手は交代)
  await ev(() => { const b = document.querySelector('#moves button[data-i]'); if (b) b.click(); });   // 自分の技
  await waitEl(movesVisibleFn, 20000);   // 相手UI(スワップ)
  const bannerSeen = (async () => waitEl(() => !!document.querySelector('.rb-ability-banner'), 30000))();
  const rankSeen = (async () => waitEl(() => !!document.querySelector('.rb-rankp-down'), 30000))();
  await ev(() => { const b = document.querySelector('#moves button[data-i]'); if (b) b.click(); });   // 相手の技→ターン実行(交代が先に発動)
  ok('E1a.いかく交代→⭐バナー出現', await bannerSeen);
  ok('E1b.いかく→ランク↓矢印fx', await rankSeen);
  await waitEl(movesVisibleFn, 30000);

  // E2E-2: グラスメイカー交代→terrain演出(新しいバトルで隔離)
  await startFresh();
  await simx(S => { S.sides.opp.bench[0].ability = 'グラスメイカー'; S.sides.opp.switchChoice = 0; S.sides.self.currentHp = 9999; return true; });
  await ev(() => { const b = document.querySelector('#moves button[data-i]'); if (b) b.click(); });
  await waitEl(movesVisibleFn, 20000);
  const terrainSeen = (async () => waitEl(() => { const t = document.getElementById('terrain-fx'); return !!t && t.style.display !== 'none' && t.innerHTML.length > 0; }, 30000))();
  await ev(() => { const b = document.querySelector('#moves button[data-i]'); if (b) b.click(); });
  ok('E2.グラスメイカー交代→terrain演出', await terrainSeen);
  await waitEl(movesVisibleFn, 30000);

  // E2E-3: かちき×いかく(±N表記のrankFx・新しいバトルで隔離)
  await startFresh();
  await simx(S => { S.sides.self.ability = 'かちき'; S.sides.opp.bench[0].ability = 'いかく'; S.sides.opp.switchChoice = 0; S.sides.self.currentHp = 9999; return true; });
  await ev(() => { const b = document.querySelector('#moves button[data-i]'); if (b) b.click(); });
  await waitEl(movesVisibleFn, 20000);
  const upSeen = (async () => waitEl(() => !!document.querySelector('.rb-rankp-up'), 30000))();
  const banner2 = (async () => waitEl(() => !!document.querySelector('.rb-ability-banner'), 30000))();
  await ev(() => { const b = document.querySelector('#moves button[data-i]'); if (b) b.click(); });
  ok('E3a.かちき「とくこう+2」→rankFx↑(±N表記対応)', await upSeen);
  ok('E3b.特性バナー出現', await banner2);
  const spaRank = await simx(S => S.sides.self.rank && S.sides.self.rank.spatk);
  console.log('   (かちき後の自分とくこうランク=' + spaRank + ')');

  // P2: ハザード常駐アイコン(ユニット)
  await ev(() => { hazardFx('self', 'rock', 1); hazardFx('self', 'spikes', 2); });
  await page.waitForTimeout(400);
  const hz = await ev(() => { const c = document.querySelector('#f-self .rb-hazards'); return c ? c.textContent : null; });
  ok('P2a.hazardFx常駐(岩+まきびし2)', !!hz && hz.includes('🪨') && (hz.match(/△/g) || []).length === 2, hz);
  await ev(() => clearHazardFx('self'));
  await page.waitForTimeout(200);
  ok('P2b.clearHazardFxで全消し', await ev(() => { const c = document.querySelector('#f-self .rb-hazards'); return !c || c.textContent === ''; }));
  // P2: ラボのバナーがAIトグル行と重ならない
  await ev(() => abilityFx('opp', 'いかく'));
  await page.waitForTimeout(350);
  const ov = await ev(() => {
    const b = document.querySelector('.rb-ability-banner');
    const r = document.getElementById('lab-ai-row');
    if (!b || !r) return { miss: true };
    const rb = b.getBoundingClientRect(), rr = r.getBoundingClientRect();
    return { overlap: !(rb.right < rr.left || rr.right < rb.left || rb.bottom < rr.top || rr.bottom < rb.top), btop: rb.top | 0, rbot: rr.bottom | 0 };
  });
  ok('P2c.バナー×AIトグル行の重なり解消', !ov.miss && !ov.overlap, JSON.stringify(ov));
  await page.waitForTimeout(1400);

  // モンキーバグ再発確認: 閉じたpickerの残留ボタンクリックでエラーが出ない
  const errBefore = jsErrors.length;
  await ev(() => { try { if (typeof openPicker === 'function') openPicker('s1'); } catch(e){} });
  await page.waitForTimeout(400);
  await ev(() => { try { closePicker(); } catch(e){} });
  await ev(() => { const b = document.querySelector('#pp-list button[data-n]'); if (b) b.click(); });
  await page.waitForTimeout(500);
  ok('M.pickerガード(null例外なし)', jsErrors.length === errBefore, jsErrors.slice(errBefore).join('|'));

  ok('JSエラー0(全体)', jsErrors.length === 0, jsErrors.slice(0, 4).join(' | '));
  await browser.close();
  const fails = results.filter(r => !r.pass);
  console.log('\n==== FX SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' ====');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FXV ERROR', e.message); process.exit(2); });
