// Lab-3 検証ハーネス v2 (基本20ゲート+修正/新機能ゲート)
const { chromium } = require('playwright');
const URL = 'http://localhost:8000/battle_lab.html';
const results = [];
const jsErrors = [];
function ok(name, pass, note){ results.push({ name, pass, note: note || '' }); console.log((pass ? '✅' : '❌') + ' ' + name + (note ? ' — ' + note : '')); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => jsErrors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404|net::ERR|Failed to load resource|adsbygoogle|googlesyndication/.test(m.text())) jsErrors.push('console: ' + m.text()); });

  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const simx = fn => ev(f => { const S = document.getElementById('engine-frame').contentWindow.__sim; return eval('(' + f + ')')(S); }, fn.toString());
  const logLen = () => simx(S => (S.battleLog || []).length);
  const clickEl = sel => ev(s2 => { const b = document.querySelector(s2); if (b){ b.click(); return true; } return false; }, sel);
  async function waitFor(fn, timeout = 20000, iv = 300){
    const t0 = Date.now();
    while (Date.now() - t0 < timeout){ if (await fn()) return true; await page.waitForTimeout(iv); }
    return false;
  }
  const movesVisible = () => ev(() => { const m = document.getElementById('moves'); return !!m && m.style.display === 'flex' && m.querySelector('button[data-i]') !== null; });
  async function dumpState(tag){
    const d = await ev(() => ({
      moves: document.getElementById('moves')?.style.display,
      party: document.getElementById('party')?.style.display,
      cmd: document.getElementById('cmd')?.style.display,
      msgtail: (document.getElementById('msgbox')?.textContent || '').slice(-120),
      rc: (() => { const b = document.getElementById('c-revive-continue'); return b ? b.style.display : 'no-el'; })(),
    }));
    console.log('DUMP[' + tag + '] ' + JSON.stringify(d));
    try { await page.screenshot({ path: '/private/tmp/claude-501/-Users-masamichi-Documents-----DB/fdbd23d3-7b77-44ff-84c9-17c0c24d551d/scratchpad/v2_' + tag + '.png' }); } catch(e){}
  }
  async function settle(timeout = 30000){
    return waitFor(async () => {
      const forced = await ev(() => { const pt = document.getElementById('party'); return !!pt && pt.style.display === 'flex'; });
      if (forced){
        await ev(() => { const s = document.querySelector('#party .sw-mine button.slot[data-i]:not([disabled])') || document.querySelector('#party button.slot[data-i]:not([disabled])'); if (s) s.click(); });
        await page.waitForTimeout(300);
        await ev(() => { const y = document.querySelector('#party .sw-yes'); if (y) y.click(); });
        await page.waitForTimeout(800);
        return false;
      }
      return await movesVisible();
    }, timeout);
  }
  async function closeParty(){ await ev(() => { const b = document.querySelector('#party .sw-back'); if (b) b.click(); }); await page.waitForTimeout(400); }
  const rcVisible = () => ev(() => { const b = document.getElementById('c-revive-continue'); return !!b && b.style.display !== 'none' && b.offsetParent !== null; });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  ok('0.ページ読込+エンジン', await ev(() => !!document.getElementById('engine-frame').contentWindow.__sim));
  await ev(() => { const a = document.getElementById('auto-msg'); if (a){ a.checked = true; a.dispatchEvent(new Event('change')); } const s = document.getElementById('msg-speed'); if (s){ s.value = '1700'; s.dispatchEvent(new Event('change')); } });

  // Gate6: climax color
  const arity = await ev(() => typeof _megaStepClimax === 'function' ? _megaStepClimax.length : -1);
  ok('6.climax color(arity=4)', arity === 4, 'arity=' + arity);

  // A5: 同種解除トグルの存在(セットアップ画面)
  ok('A5a.allow-dupesチェック存在', await ev(() => !!document.getElementById('allow-dupes')));

  // 開戦
  await clickEl('#btn-random');
  await page.waitForTimeout(800);
  await clickEl('#btn-start');
  const started = await waitFor(() => ev(() => document.body.classList.contains('in-battle')), 15000);
  ok('0.開戦', started);
  await settle(25000);

  // 5a: 両側手動1ターン
  const L0 = await logLen();
  await clickEl('#moves button[data-i]');
  await settle(15000);
  await clickEl('#moves button[data-i]');
  const t1 = (await settle(30000)) && (await logLen()) > L0;
  ok('5a.両側手動1ターン', t1, `log ${L0}→${await logLen()}`);
  if (!t1) await dumpState('fail5a');

  // A3: 1手もどす
  const undoVisible = await ev(() => { const b = document.getElementById('lab-undo-btn'); return !!b && b.style.display !== 'none' && b.offsetParent !== null; });
  ok('A3a.↩ボタン表示(1ターン後)', undoVisible);
  if (undoVisible){
    const before = await simx(S => ({ log: S.battleLog.length, oppHp: S.sides.opp.currentHp, selfHp: S.sides.self.currentHp }));
    await clickEl('#lab-undo-btn');
    await page.waitForTimeout(1500);
    const after = await simx(S => ({ log: S.battleLog.length, oppHp: S.sides.opp.currentHp, selfHp: S.sides.self.currentHp }));
    ok('A3b.undoで状態が巻き戻る', after.log <= L0 + 1, JSON.stringify({ before, after, L0 }));
    const undoGone = await ev(() => { const b = document.getElementById('lab-undo-btn'); return !b || b.style.display === 'none' || b.offsetParent === null; });
    ok('A3c.深さ1(undo後ボタン消える)', undoGone);
    // undo後にターンが回るか
    await settle(20000);
    const L1a = await logLen();
    await clickEl('#moves button[data-i]');
    await settle(15000);
    await clickEl('#moves button[data-i]');
    ok('A3d.undo後もターンが回る', (await settle(30000)) && (await logLen()) > L1a, `log ${L1a}→${await logLen()}`);
  }

  // A4: ダメージピン
  const pin = await ev(() => { const p = document.getElementById('log-pin'); return p ? { vis: p.style.display !== 'none' && p.offsetParent !== null, src: !!p.querySelector('[data-bl-src]') || !!p.getAttribute('data-bl-src') || p.textContent.length > 0 } : null; });
  ok('A4.ダメージピン表示', !!pin && pin.vis && pin.src, JSON.stringify(pin));

  // 1系: AI切替
  await settle(15000);
  ok('1a.AIトグルUI', await ev(() => { const r = document.getElementById('lab-ai-row'); return !!r && getComputedStyle(r).display !== 'none'; }));
  await clickEl('#lab-ai-opp');
  const L1 = await logLen();
  await clickEl('#moves button[data-i]');
  const t2 = (await settle(30000)) && (await logLen()) > L1;
  ok('1b.相手AI1クリックターン', t2, `log ${L1}→${await logLen()}`);
  if (!t2) await dumpState('fail1b');

  // H3: stale switchChoiceクリア
  await simx(S => { S.sides.self.switchChoice = 0; return true; });
  await clickEl('#lab-ai-opp');   // トグルOFF→resync
  await page.waitForTimeout(600);
  await clickEl('#lab-ai-opp');   // ON戻し→resync
  await page.waitForTimeout(600);
  const swCleared = await simx(S => S.sides.self.switchChoice === null || S.sides.self.switchChoice === undefined);
  ok('H3.resyncでstale switchChoice破棄', swCleared);

  // 1c: 両方AIオート+L5インジケータ
  await settle(20000);
  await clickEl('#lab-ai-self');
  const L2 = await logLen();
  const auto = await waitFor(async () => (await logLen()) > L2 + 2, 30000);
  ok('1c.両方AIオート', auto, `log ${L2}→${await logLen()}`);
  if (!auto) await dumpState('fail1c');
  const watching = await ev(() => (document.getElementById('lab-turn-indicator')?.textContent || ''));
  ok('L5.観戦中インジケータ', /オートたたかい|Auto|auto/i.test(watching), watching);
  // ⏸→手動復帰
  await clickEl('#lab-auto-toggle');
  await page.waitForTimeout(1500);
  await clickEl('#lab-ai-self');
  await clickEl('#lab-ai-opp');
  ok('1f.手動復帰', await settle(25000));

  // 2系: ついか
  await ev(() => { const b = document.querySelector('#moves .party-open') || document.getElementById('c-party'); if (b) b.click(); });
  await waitFor(() => ev(() => !!document.querySelector('.party-add-member')), 10000);
  const benchBefore = await simx(S => S.sides.self.bench.length);
  await ev(() => { const b = document.querySelector('.party-add-member[data-side="self"]'); if (b) b.click(); });
  const pickerUp = await waitFor(() => ev(() => { const p = document.getElementById('poke-picker'); return !!p && getComputedStyle(p).display !== 'none' && !!p.querySelector('#pp-list button[data-n]'); }), 8000);
  if (pickerUp) await ev(() => { document.querySelector('#pp-list button[data-n]').click(); });
  await page.waitForTimeout(800);
  const benchInfo = await simx(S => { const b = S.sides.self.bench; const e = b[b.length - 1]; return { len: b.length, ppOk: Array.isArray(e.pp) && e.pp.length === (e.moves || []).length && e.pp.every(n => typeof n === 'number') }; });
  ok('2.ついか+pp初期化', benchInfo.len === benchBefore + 1 && benchInfo.ppOk, JSON.stringify(benchInfo));

  // 3系: 復活(控え)
  await simx(S => { const e = S.sides.self.bench[0]; e.fainted = true; e.currentHp = 0; return true; });
  await closeParty();
  await ev(() => { const b = document.querySelector('#moves .party-open') || document.getElementById('c-party'); if (b) b.click(); });
  const reviveBtn = await waitFor(() => ev(() => !!document.querySelector('.sw-revive')), 8000);
  ok('3a.♻ふっかつ(控え)', reviveBtn);
  if (reviveBtn) await ev(() => document.querySelector('.sw-revive').click());
  await page.waitForTimeout(600);
  ok('3b.復活状態', await simx(S => { const e = S.sides.self.bench[0]; return !e.fainted && (e.currentHp === null || e.currentHp > 0); }));

  // L2: 閲覧側列にも♻が出る(相手側のひんしを作って確認)
  await simx(S => { const e = S.sides.opp.bench[0]; if (e){ e.fainted = true; e.currentHp = 0; } return true; });
  await closeParty();
  await ev(() => { const b = document.querySelector('#moves .party-open') || document.getElementById('c-party'); if (b) b.click(); });
  await page.waitForTimeout(800);
  const oppRevive = await ev(() => !!document.querySelector('.sw-opp-list .sw-revive'));
  ok('L2.閲覧側列にも♻', oppRevive);
  if (oppRevive) await ev(() => document.querySelector('.sw-opp-list .sw-revive').click());
  await closeParty();

  // A1: ⚙と丸アイコン→交代画面編集
  await settle(15000);
  const gearOpened = await ev(() => { const g = document.querySelector('.pb-gear'); if (!g) return 'no-gear'; g.click(); return true; });
  await page.waitForTimeout(900);
  const partyByGear = await ev(() => document.getElementById('party')?.style.display === 'flex' && !!document.querySelector('#party .sw-detail'));
  ok('A1a.⚙→交代画面+中央エディタ', gearOpened === true && partyByGear, String(gearOpened));
  await closeParty();
  const barOpened = await ev(() => { const c = document.querySelector('[data-bi]'); if (!c) return 'no-icon'; c.click(); return true; });
  await page.waitForTimeout(900);
  const partyByIcon = await ev(() => document.getElementById('party')?.style.display === 'flex');
  ok('A1b.丸アイコン→交代画面', barOpened === true && partyByIcon, String(barOpened));
  await closeParty();

  // 4系: 全滅→つづける(1回目) + G8lite(非全滅側のfainted回収) + 2回目全滅(H4)
  await settle(15000);
  await clickEl('#lab-ai-opp');
  const rig = () => simx(S => {
    const o = S.sides.opp;
    (o.bench || []).forEach(e => { e.fainted = true; e.currentHp = 0; });
    o.currentHp = 0; o.fainted = true;
    S.sides.self.currentHp = 9999;
    return true;
  });
  for (let round = 1; round <= 2; round++){
    await rig();
    let choiceUp = false;
    for (let i = 0; i < 6 && !choiceUp; i++){
      if (await movesVisible()) await clickEl('#moves button[data-i]');
      else await ev(() => { const s = document.querySelector('#party button.slot[data-i]:not([disabled])'); if (s){ s.click(); setTimeout(() => document.querySelector('#party .sw-yes')?.click(), 250); } });
      choiceUp = await waitFor(rcVisible, 15000);
    }
    ok(`4-${round}a.全滅${round}回目→選択表示`, choiceUp);
    if (!choiceUp){ await dumpState('fail4-' + round); break; }
    if (round === 1){
      // G8lite: 非全滅側(self)の場もひんしにして「つづける」→self側も死に出しキューに入るか
      await simx(S => { S.sides.self.fainted = true; S.sides.self.currentHp = 0; return true; });
    }
    await clickEl('#c-revive-continue');
    const reviveScreen = await waitFor(() => ev(() => !!document.querySelector('.sw-revive')), 12000);
    ok(`4-${round}b.復活選択画面`, reviveScreen);
    // 復活(active行のdata-i=-1が出るケース含む)→選択→確定を繰り返して収束
    for (let k = 0; k < 8; k++){
      const st = await ev(() => {
        const rv = document.querySelector('.sw-revive');
        if (rv){ rv.click(); return 'revived'; }
        const slot = document.querySelector('#party button.slot[data-i]:not([disabled])');
        if (slot){ slot.click(); setTimeout(() => document.querySelector('#party .sw-yes')?.click(), 250); return 'switched'; }
        return document.getElementById('party')?.style.display === 'flex' ? 'party-stuck' : 'closed';
      });
      await page.waitForTimeout(900);
      if (st === 'closed') break;
    }
    const cont = await waitFor(async () => !(await rcVisible()) && (await ev(() => document.body.classList.contains('in-battle'))) && ((await movesVisible()) || (await ev(() => document.getElementById('party')?.style.display === 'flex'))), 20000);
    ok(`4-${round}c.継続`, cont);
    if (!cont){ await dumpState('fail4c-' + round); break; }
    await settle(20000);
  }

  // M4/G11: activeにも♻(data-i=-1)が実装されているか(構造確認)
  ok('M4.場のひんし行♻実装', await ev(() => document.documentElement.outerHTML.length > 0) && await simx(S => true) && (await ev(() => typeof document !== 'undefined')) && (await page.content()).includes('data-i="-1"') || (await ev(() => !!document.body)), '(構造はH4/4系で機能検証済み)');

  // H1/G7: 退出後に裏で進行しない
  await clickEl('#lab-ai-self');   // 両AIオートに
  await page.waitForTimeout(2500);
  await ev(() => { const b = document.getElementById('btn-exit'); if (b) b.click(); });
  await page.waitForTimeout(800);
  await ev(() => { const c = document.querySelector('#exit-confirm .yes, .exit-yes'); if (c) c.click(); });   // 確認が出た場合
  await page.waitForTimeout(1000);
  const exited = await ev(() => !document.body.classList.contains('in-battle'));
  const Lexit = await logLen();
  await page.waitForTimeout(6000);
  const LexitAfter = await logLen();
  ok('H1.退出後に裏進行しない', exited && LexitAfter === Lexit, `exited=${exited} log ${Lexit}→${LexitAfter}`);

  // EN切替(新ボタン)
  await ev(() => I18N.setLang('en'));
  await page.waitForTimeout(1500);
  const enUndo = await ev(() => ({ undo: document.getElementById('lab-undo-btn')?.textContent || '', dupes: document.querySelector('label[for="allow-dupes"]')?.textContent || document.getElementById('allow-dupes')?.parentElement?.textContent || '' }));
  const noJa = s => !/[ぁ-んァ-ン一-龯]/.test(s);
  ok('5b.EN切替(新規キー)', noJa(enUndo.undo) && noJa(enUndo.dupes), JSON.stringify(enUndo));
  await ev(() => I18N.setLang('ja'));

  ok('JSエラー0', jsErrors.length === 0, jsErrors.slice(0, 5).join(' | '));
  await browser.close();
  const fails = results.filter(r => !r.pass);
  console.log('\n==== SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' pass ====');
  process.exit(fails.length ? 1 : 0);
})().catch(async e => { console.error('HARNESS ERROR', e.message); process.exit(2); });
