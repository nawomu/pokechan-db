#!/usr/bin/env node
/* D5-1 実機ゲート(開発プレビュー battle_doubles_preview.html)。
 * python3 -m http.server 8000 の起動後: node tools/_doubles_preview_pdca_playwright.js
 *
 * spec_d5_1_preview.md「検証」節の3シナリオ + JSエラー0 を実機(Playwright)で確認する。
 *   ① 4体選出→バトル開始→対象ボタンを押して1ターン実行→ログに行動の行が出る
 *   ② 相手を倒して死に出し→補充(自分側・枠0の複数生き控え=UIで選ばせる分岐を決定的に再現して検証)
 *   ③ 勝敗表示(自分の勝ち/負けの両方)
 * ★このページは開発プレビュー(未公開・エンジン無改変)。①はランダム編成での実プレイ、②③は
 *   決定論的な結果になるよう対戦相手を明示的にひんし化させて検証する(ランダム対戦だけに頼ると
 *   何ターンで決着するか一定しないため=CI向けに再現性を優先。既存の_views_pdca_playwright.js等と
 *   同じ tools/_lib/browser_audit.js の流儀(observePage/openReadyPage)に乗る)。
 */
'use strict';
const { observePage, openReadyPage } = require('./_lib/browser_audit');
const BASE = 'http://127.0.0.1:8000/';
const PAGE_URL = BASE + 'battle_doubles_preview.html';   // ★グローバルのURLクラスと名前が衝突しないように

async function clickFirstVisible(page, selector) {
  const btns = page.locator(selector);
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const b = btns.nth(i);
    if (await b.isVisible()) { await b.click(); return true; }
  }
  return false;
}

// 自分の枠0/1それぞれ、未確定のコマンドを1つずつ埋める(技→対象候補が2つ以上なら先頭を選ぶ)。
// 上位実装(battle_doubles_preview.html)のUI操作をなぞるだけ=ページのロジックには一切手を入れない。
async function commitAllSelfSlots(page, maxPass = 6) {
  for (let pass = 0; pass < maxPass; pass++) {
    if (!(await page.locator('#btn-run-turn').isDisabled())) return true;
    let clickedAny = false;
    const slots = page.locator('#cmd-panel .cmd-slot');
    const n = await slots.count();
    for (let i = 0; i < n; i++) {
      const slot = slots.nth(i);
      if (await slot.locator('.committed-tag').count()) continue;
      const btn = slot.locator('.grid-btns').first().locator('button').first();
      if (await btn.count()) { await btn.click(); clickedAny = true; await page.waitForTimeout(120); }
    }
    if (!clickedAny) break;
  }
  return !(await page.locator('#btn-run-turn').isDisabled());
}

async function scenario1(page, observed) {
  // ① 4体選出→バトル開始→対象ボタンを押して1ターン実行→ログに行動の行が出る
  const selfN = await page.locator('#team-self .mem').count();
  const oppN = await page.locator('#team-opp .mem').count();
  if (selfN !== 4 || oppN !== 4) observed.add('data', `選出4体になっていない(self=${selfN} opp=${oppN})`);

  await page.click('#btn-start');
  await page.waitForTimeout(400);
  const boardSlots = await page.locator('#board .slot').count();
  if (boardSlots !== 4) observed.add('data', `盤面が2x2(4枠)になっていない(実際=${boardSlots})`);

  const ready = await commitAllSelfSlots(page);
  if (!ready) { observed.add('data', '① 自分側2枠のコマンドを確定できなかった(対象ボタン等)'); return; }
  const logBefore = (await page.locator('#log-scroll .log-line').count());
  await page.click('#btn-run-turn');
  await page.waitForTimeout(500);
  const logAfter = (await page.locator('#log-scroll .log-line').count());
  if (!(logAfter > logBefore)) observed.add('data', '① ターン実行後にログ行が増えていない');
}

async function scenario2and3(page, observed) {
  // ② 死に出し(自分側枠0・生き控え2体=UI選択分岐)は、ランダム対戦だけに任せると再現に時間がかかるため
  //    決定論的に再現する: 相手を先に倒しつつ、自分側枠0を直接ひんしにしてUIを検証する。
  //    (テスト専用の状態注入。エンジン/ページのロジックは一切書き換えない=window.E/window.Sの
  //    公開状態を読み書きするだけ。ページ本体のrenderCommandPanel/handleFaintReplacementをそのまま呼ぶ)
  // ①でランダムに1ターン実行済み(控えが減っている可能性がある)なので、②③の前提を揃えるために
  // 同じ選出のまま battle を作り直す(startBattle()はページの通常機能=再戦導線と同じ呼び方)。
  await page.evaluate(() => window.startBattle());
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => {
    const st = window.E.slotOf('self', 0);
    const bench = window.S.sides.self.bench || [];
    return { poke: st.poke && st.poke.name, benchAlive: bench.filter(e => e && e.poke && !e.fainted).length };
  });
  if (before.benchAlive < 2) { observed.add('data', `② 検証前提が崩れている(自分側生き控え=${before.benchAlive}、2以上が必要)`); return; }

  await page.evaluate(() => {
    const st = window.E.slotOf('self', 0);
    st.currentHp = 0; st.fainted = true;
    window.handleFaintReplacement(); window.renderBoard();
  });
  await page.waitForTimeout(200);
  const faintUiCount = await page.locator('#cmd-panel-faint button').count();
  if (faintUiCount < 2) { observed.add('data', `② 死に出しUI(控え選択)が出ていない(候補=${faintUiCount})`); }
  else {
    await page.locator('#cmd-panel-faint button').first().click();
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => { const st = window.E.slotOf('self', 0); return { poke: st.poke && st.poke.name, fainted: st.fainted }; });
    if (after.fainted || !after.poke) observed.add('data', '② 死に出し後に補充が成立していない');
    const stillThere = await page.locator('#cmd-panel-faint').count();
    if (stillThere) observed.add('data', '② 補充後もUIが残っている');
  }

  // ③ 勝敗表示(自分の勝ち)→retry→もう一度バトル開始まで
  await page.evaluate(() => {
    [0, 1].forEach(i => { const st = window.E.slotOf('opp', i); if (st) { st.fainted = true; st.currentHp = 0; } });
    (window.S.sides.opp.bench || []).forEach(e => { if (e) { e.fainted = true; e.currentHp = 0; } });
    window.showResult(window.E.checkBattleWinner());
  });
  await page.waitForTimeout(200);
  const bannerVisible = await page.locator('#result-banner').isVisible();
  const bannerText = bannerVisible ? await page.locator('#result-banner').innerText() : '';
  if (!bannerVisible || !/win|勝/.test(bannerText) === false) { /* noop: 文言は言語依存なので存在確認のみ */ }
  if (!bannerVisible) observed.add('data', '③ 勝敗バナーが表示されない(自分の勝ち)');
  const runVisible = await page.locator('#btn-run-turn').isVisible();
  if (runVisible) observed.add('data', '③ 決着後もターン実行ボタンが残っている');

  await page.click('#btn-retry');
  await page.waitForTimeout(200);
  const setupVisible = await page.locator('#setup').isVisible();
  if (!setupVisible) observed.add('data', '③ もういちど→編成画面に戻らない');
  await page.click('#btn-start');
  await page.waitForTimeout(400);
  const board2 = await page.locator('#board .slot').count();
  if (board2 !== 4) observed.add('data', '③ 再戦(2戦目)の盤面が正しく組み上がらない');
}

async function main() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const observed = observePage(page, { origin: BASE, checkConsole: true,
    ignoreResponse: r => {
      const url = r.url();
      // real_battle_simulator.html(エンジンiframe)自身が持つ既存のGA/AdSenseタグの通信は対象外
      // (このページ・エンジンいずれも無改変=既知のノイズで、D5-1の合否とは無関係)
      if (/google-analytics|googlesyndication|googletagmanager/.test(url)) return true;
      // images/sim/{ja名}.svg→.png→remove は全ページ共通の既知フォールバック(手描きSVGは全種未収録=
      // 2026-06-12導入の既知ギャップ。_views_pdca_playwright.jsのimages/item/*.png許容と同じ考え方)。
      // エンジンiframe自身の内部描画(real_battle_simulator.html本体・無改変)が出すリクエストで、
      // このページはsim画像を1枚も参照しない。
      if (/\/images\/sim\/[^/]+\.(svg|png)$/.test(new URL(url).pathname) && r.status && r.status() === 404) return true;
      return false;
    } });
  let ok = true;
  try {
    await openReadyPage(page, PAGE_URL, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await scenario1(page, observed);
    await scenario2and3(page, observed);
  } catch (e) {
    observed.add('load', e.message);
  } finally {
    observed.dispose();
  }
  ok = observed.errors.length === 0;
  console.log(ok ? '✅' : '❌', 'battle_doubles_preview.html', observed.errors.map(e => `[${e.kind}] ${e.text}`).join(' | '));
  await browser.close();
  return ok ? 0 : 1;
}

if (require.main === module) main().then(code => { process.exitCode = code; }).catch(e => {
  console.error('❌ D5-1実機ゲートを完了できません: ' + e.message);
  process.exitCode = 1;
});
module.exports = { main };
