// てんきや(Forecast)フォルム見た目の検証(battle_lab上でE2E)。ポワルンを自分側に仕込み、
// 天候(sunny/rain/snow/none)を切り替えるたびに①表示スプライトのSVGファイル名 ②st.forecastForm
// ③st.typeOverride(既存タイプ切替の回帰ガード)を確認する。
// 出典/実装メモ: real_battle_simulator.htmlのupdateForecastForm・各ページのspriteHtml(2026-07-21実装)。
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8000/battle_lab.html';
const results = [];
const jsErrors = [];
function ok(name, pass, note){ results.push({ name, pass }); console.log((pass ? '✅' : '❌') + ' ' + name + (note ? ' — ' + note : '')); }

const CASES = [
  { weather: 'sunny', form: 'sunny', file: 'たいようのすがた.svg', type: ['ほのお'] },
  { weather: 'rain',  form: 'rain',  file: 'あまみずのすがた.svg', type: ['みず'] },
  { weather: 'snow',  form: 'snow',  file: 'ゆきぐものすがた.svg', type: ['こおり'] },
  { weather: 'none',  form: null,    file: 'ポワルン.svg',        type: null },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404|net::ERR|Failed to load resource/.test(m.text())) jsErrors.push(m.text()); });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const simx = fn => ev(f => { const S = document.getElementById('engine-frame').contentWindow.__sim; return eval('(' + f + ')')(S); }, fn.toString());
  const engx = fn => ev(f => { const w = document.getElementById('engine-frame').contentWindow; return eval('(' + f + ')')(w); }, fn.toString());
  async function waitEl(check, timeout = 15000, iv = 120){
    const t0 = Date.now();
    while (Date.now() - t0 < timeout){ if (await ev(check)) return true; await page.waitForTimeout(iv); }
    return false;
  }
  const movesVisibleFn = () => { const m = document.getElementById('moves'); return !!m && m.style.display === 'flex' && !!m.querySelector('button[data-i]'); };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // オリジナルSVGモードに固定(default='home'=PokeAPI 3D画像なのでsvgパスがsrcに出ない。SVG検証のため強制)
  await ev(() => { try { localStorage.setItem('rb_sprite_src', 'original'); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const spriteModeOk = await ev(() => typeof spriteSrc !== 'undefined' && spriteSrc === 'original');
  ok('0.スプライトモード=original固定', spriteModeOk, 'spriteSrc確認');

  // 開戦
  await ev(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); } const s = document.getElementById('msg-speed'); if (s){ s.value = '1700'; s.dispatchEvent(new Event('change')); } });
  await ev(() => document.getElementById('btn-random').click());
  await page.waitForTimeout(600);
  await ev(() => document.getElementById('btn-start').click());
  await waitEl(() => document.body.classList.contains('in-battle'), 15000);
  await waitEl(movesVisibleFn, 25000);

  // 自分側をポワルン(てんきや)に差し替える
  const setupOk = await simx(S => {
    const p = S.pokeByName('ポワルン');
    if (!p) return false;
    S.sides.self.poke = p;
    S.sides.self.ability = 'てんきや';
    S.sides.self.abilityOverride = null;
    S.sides.self.disguise = null;
    return true;
  });
  ok('1.自分側をポワルン(てんきや)に差し替え', setupOk);
  await ev(() => { renderAll(); return true; });

  for (const c of CASES){
    // simxはfn.toString()を1引数(S)としてevalするヘルパーなので、天候値は文字列テンプレートに埋め込む
    await simx(`(S)=>{ S.env.weather=${JSON.stringify(c.weather)}; return true; }`);
    await engx(`(w)=>{ if (w.syncForecastBothSides) w.syncForecastBothSides(); return true; }`);
    await ev(() => { renderAll(); return true; });
    await page.waitForTimeout(150);

    const src = await ev(() => {
      const img = document.querySelector('#f-self .sprite img');
      return img ? decodeURIComponent(img.getAttribute('src') || '') : null;
    });
    const state = await simx(`(S)=>({ ff: S.sides.self.forecastForm, to: S.sides.self.typeOverride })`);

    ok(`W-${c.weather}.スプライトsrc=${c.file}`, !!src && src.endsWith('images/sim/' + c.file), 'src=' + src);
    ok(`W-${c.weather}.st.forecastForm=${c.form}`, state && state.ff === c.form, 'ff=' + JSON.stringify(state && state.ff));
    const typeOk = c.type === null ? (state && (state.to === null || state.to === undefined))
      : (state && Array.isArray(state.to) && state.to.length === c.type.length && state.to.every((t, i) => t === c.type[i]));
    ok(`W-${c.weather}.st.typeOverride回帰(=${JSON.stringify(c.type)})`, typeOk, 'to=' + JSON.stringify(state && state.to));
  }

  ok('JSエラー0(全体)', jsErrors.length === 0, jsErrors.slice(0, 4).join(' | '));
  await browser.close();
  const fails = results.filter(r => !r.pass);
  console.log('\n==== FORECAST FORM SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' ====');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FCV ERROR', e.message); process.exit(2); });
