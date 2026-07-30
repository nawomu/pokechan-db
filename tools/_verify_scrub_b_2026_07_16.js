const { chromium } = require('playwright');

const BASE = 'http://localhost:8000';
let failures = [];

function assert(cond, msg) {
  if (!cond) { failures.push(msg); console.log('FAIL: ' + msg); }
  else console.log('ok: ' + msg);
}

(async () => {
  const browser = await chromium.launch();

  // ---------- ① 3ページJSエラー0 + ② 本番レガシー回帰(real_battle burstFx 5引数直呼び出し) ----------
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(BASE + '/real_battle.html', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    assert(errors.length === 0, 'real_battle.html JSエラー0 (got: ' + JSON.stringify(errors) + ')');

    // burstFx 5引数直呼び出し(レガシー経路)。__FX_SCRUB__は未定義のはず。
    const res = await page.evaluate(() => {
      const out = { scrubFlag: window.__FX_SCRUB__ };
      // burstFx(side, color, shape, intensity, durMs) 5引数のまま(sizeScale/offset/particles省略)
      burstFx('self', '#ff0000', 'flame', 'normal', undefined);
      out.countAfterDispatch = document.querySelectorAll('.burst,.rb-burstp,.rb-burstring').length;
      return out;
    });
    assert(res.scrubFlag === undefined, 'real_battle: window.__FX_SCRUB__は未定義のまま(before dispatch)');
    assert(res.countAfterDispatch > 0, 'real_battle: burstFx 5引数直呼び出しで要素が生成される');
    await page.waitForTimeout(750);   // 650ms既定+マージン
    const countAfter650 = await page.evaluate(() => document.querySelectorAll('.burst').length);
    assert(countAfter650 === 0, 'real_battle: burstFx既定650msで.burstが自己remove済み(要素数0)。実際=' + countAfter650);

    // popText 6引数(durMs省略=既定1100ms)
    const res2 = await page.evaluate(() => {
      popText('self', '-42', '#fff', 16, null, undefined);
      return document.querySelectorAll('.popnum').length;
    });
    assert(res2 > 0, 'real_battle: popText 6引数直呼び出しで.popnumが生成される');
    await page.waitForTimeout(1250);   // 1100ms既定+マージン
    const popAfter = await page.evaluate(() => document.querySelectorAll('.popnum').length);
    assert(popAfter === 0, 'real_battle: popText既定1100msで.popnumが自己remove済み(要素数0)。実際=' + popAfter);

    const flagAfter = await page.evaluate(() => window.__FX_SCRUB__);
    assert(flagAfter === undefined, 'real_battle: 一連の直呼び出し後もwindow.__FX_SCRUB__は未定義のまま');

    await page.close();
  }

  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(BASE + '/online_battle.html', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    assert(errors.length === 0, 'online_battle.html JSエラー0 (got: ' + JSON.stringify(errors) + ')');
    await page.close();
  }

  // ---------- ③④⑤ fx_editor.html ----------
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(BASE + '/fx_editor.html', { waitUntil: 'load' });
    await page.waitForTimeout(500);

    // フレアドライブを選択(move:フレアドライブ)
    const picked = await page.evaluate(() => {
      const mv = (typeof ALL_MOVES !== 'undefined') ? ALL_MOVES.find(m => m.name === 'フレアドライブ') : null;
      if (!mv) return { ok: false, reason: 'WAZA_MAP no entry' };
      if (typeof selectMove !== 'function') return { ok: false, reason: 'selectMove missing' };
      selectMove(mv);
      return { ok: true, key: currentKey, dur: currentSheet && currentSheet.dur };
    });
    assert(picked.ok, 'fx_editor: フレアドライブを選択できた (' + JSON.stringify(picked) + ')');

    // 選択直後は自動でループ再生が始まる(阿部さんFB2026-07-11 §3)ので、まずSTOPする
    await page.evaluate(() => { stopPlay(); });
    await page.waitForTimeout(100);

    // ---- ③ scrubToTime(300): charge途中(cue c1: atk/charge t=0 dur=550) ----
    const r300 = await page.evaluate(() => {
      scrubToTime(300);
      const clone = document.querySelector('.rb-chargeclone');
      if (!clone) return { hasClone: false };
      const anims = clone.getAnimations();
      const a = anims[0];
      const tf = getComputedStyle(clone).transform;
      return {
        hasClone: true,
        nAnims: anims.length,
        currentTime: a ? a.currentTime : null,
        playState: a ? a.playState : null,
        transform: tf,
        scrubFlag: window.__FX_SCRUB__,
      };
    });
    console.log('r300=', JSON.stringify(r300));
    assert(r300.hasClone, 'fx_editor: scrubToTime(300)で.rb-chargecloneが存在する');
    assert(r300.playState === 'paused', 'fx_editor: chargeクローンのAnimationがpaused。実際=' + r300.playState);
    assert(Math.abs((r300.currentTime || 0) - 300) < 5, 'fx_editor: currentTime≈300(t=0のcueなのでtargetMs-0=300)。実際=' + r300.currentTime);
    assert(r300.transform && r300.transform !== 'none', 'fx_editor: クローンのtransformが中間位置(none/未設定でない)。実際=' + r300.transform);
    assert(r300.scrubFlag === true, 'fx_editor: scrubToTime中はwindow.__FX_SCRUB__===true');

    // 1秒待っても静止画が保持されている(charge cleanupのsetTimeoutが__FX_SCRUB__を見てスキップしている)
    await page.waitForTimeout(1000);
    const stillThere300 = await page.evaluate(() => !!document.querySelector('.rb-chargeclone'));
    assert(stillThere300, 'fx_editor: scrubToTime(300)から1秒待ってもクローンが消えない(静止画保持)');

    // ---- scrubToTime(900): burst途中(cue c2: glyph/burst t=260 dur=1950) ----
    const r900 = await page.evaluate(() => {
      scrubToTime(900);
      const burst = document.querySelector('.burst');
      if (!burst) return { hasBurst: false };
      const anims = burst.getAnimations();
      const a = anims[0];
      return {
        hasBurst: true,
        nAnims: anims.length,
        currentTime: a ? a.currentTime : null,
        playState: a ? a.playState : null,
        cloneGone: !document.querySelector('.rb-chargeclone'),   // resetPreviewPositionsで前のクローンは消えているはず
      };
    });
    console.log('r900=', JSON.stringify(r900));
    assert(r900.hasBurst, 'fx_editor: scrubToTime(900)で.burstが存在する');
    assert(r900.playState === 'paused', 'fx_editor: burstのCSS AnimationがPaused。実際=' + r900.playState);
    assert(Math.abs((r900.currentTime || 0) - (900 - 260)) < 5, 'fx_editor: burst currentTime≈640(900-260)。実際=' + r900.currentTime);
    assert(r900.cloneGone, 'fx_editor: 900msスクラブで前回(300ms)のchargeクローンはresetで掃除済み(増殖なし)');

    await page.waitForTimeout(1000);
    const stillThere900 = await page.evaluate(() => !!document.querySelector('.burst'));
    assert(stillThere900, 'fx_editor: scrubToTime(900)から1秒待ってもburstが消えない(静止画保持)');

    // ---- ④ スクラブ→▶再生→スクラブ→技切替 の往復 ----
    const roundTrip = await page.evaluate(async () => {
      // ▶再生を少し走らせてSTOP
      startPlay();
      await new Promise(r => setTimeout(r, 200));
      stopPlay();
      const flagAfterStop = window.__FX_SCRUB__;
      const countAfterStop = document.querySelectorAll('.burst,.rb-burstp,.rb-burstring,.rb-chargeclone,.popnum,[class^="rb-burstglyph"]').length;
      // 再度スクラブ
      scrubToTime(500);
      const flagDuringScrub2 = window.__FX_SCRUB__;
      // 技切替(selectMoveでstopPlay経由のresetを踏む)
      const mv2 = ALL_MOVES.find(m => m.name === 'はたく');
      selectMove(mv2);
      stopPlay();   // 選択直後の自動ループ再生を止める(検証を安定させる)
      const flagAfterSwitch = window.__FX_SCRUB__;
      const countAfterSwitch = document.querySelectorAll('.burst,.rb-burstp,.rb-burstring,.rb-chargeclone,.popnum,[class^="rb-burstglyph"]').length;
      return { flagAfterStop, countAfterStop, flagDuringScrub2, flagAfterSwitch, countAfterSwitch };
    });
    console.log('roundTrip=', JSON.stringify(roundTrip));
    assert(roundTrip.flagAfterStop === false, 'fx_editor: STOP後はwindow.__FX_SCRUB__===false。実際=' + roundTrip.flagAfterStop);
    assert(roundTrip.countAfterStop === 0, 'fx_editor: STOP後は演出要素が全部片付いている(要素数0)。実際=' + roundTrip.countAfterStop);
    assert(roundTrip.flagDuringScrub2 === true, 'fx_editor: 再スクラブ中はwindow.__FX_SCRUB__===true');
    assert(roundTrip.flagAfterSwitch === false, 'fx_editor: 技切替(stopPlay経由)後はwindow.__FX_SCRUB__===false');
    assert(roundTrip.countAfterSwitch === 0, 'fx_editor: 技切替後は演出要素が増殖せず片付いている。実際=' + roundTrip.countAfterSwitch);

    // ---- ▶通常再生の従来どおり動作(技切替後、はたくを普通にループ再生) ----
    const playCheck = await page.evaluate(async () => {
      startPlay();
      await new Promise(r => setTimeout(r, 300));
      const playing = playState.playing;
      stopPlay();
      return { playing };
    });
    assert(playCheck.playing === true, 'fx_editor: ▶通常再生(はたく)が従来どおり動く');

    assert(errors.length === 0, 'fx_editor.html JSエラー0(ここまでの操作全体で)。実際=' + JSON.stringify(errors));

    // ---- ⑤ 赤線ドラッグ: #tl-rowsの空白部分でmousedown→ドラッグでヘッド+盤面追随 ----
    // フレアドライブへ戻す
    await page.evaluate(() => { const mv = ALL_MOVES.find(m => m.name === 'フレアドライブ'); selectMove(mv); stopPlay(); });
    await page.waitForTimeout(200);

    const rowsBox = await page.evaluate(() => {
      const rows = document.getElementById('tl-rows');
      const r = rows.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    // 空白な縦位置(sound/screenトラック行あたり)でドラッグ。x=350px相当(約583ms@0.6px/ms)地点から右へ。
    const blankY = rowsBox.top + 20;   // 最初のトラック行あたり(atk行のはず。空きスペースを狙うため右寄りのxを使う)
    const startXpx = rowsBox.left + 700;   // 700/0.6 ≈ 1166ms 付近(cueバーが無いはずの後半)
    const endXpx = rowsBox.left + 760;

    await page.mouse.move(startXpx, blankY);
    await page.mouse.down();
    await page.mouse.move(startXpx + 10, blankY, { steps: 2 });
    await page.mouse.move(endXpx, blankY, { steps: 5 });
    const duringDrag = await page.evaluate(() => ({
      playheadLeft: document.getElementById('tl-playhead').style.left,
      playing: playState.playing,
    }));
    await page.mouse.up();
    const afterDrag = await page.evaluate(() => ({
      playing: playState.playing,
      playheadTime: document.getElementById('tl-playhead-time').textContent,
    }));
    console.log('rowDrag duringDrag=', JSON.stringify(duringDrag), 'afterDrag=', JSON.stringify(afterDrag));
    assert(afterDrag.playing === false, 'fx_editor: 行エリア空白ドラッグ後、再生は始まっていない');
    assert(duringDrag.playheadLeft && duringDrag.playheadLeft !== '64px', 'fx_editor: 行エリア空白ドラッグでプレイヘッドが動いた。実際=' + duringDrag.playheadLeft);

    // 行エリア空白クリック(ドラッグ無し)で再生が始まらないこと
    await page.evaluate(() => { stopPlay(); });
    await page.mouse.move(startXpx, blankY);
    await page.mouse.down();
    await page.mouse.up();
    const afterClick = await page.evaluate(() => playState.playing);
    assert(afterClick === false, 'fx_editor: 行エリア空白クリック(ドラッグ無し)で再生が始まらない。実際=' + afterClick);

    // cueバーのドラッグ(移動)が従来どおり効くこと: 最初のバーを少し動かす
    const barDragResult = await page.evaluate(() => {
      const bar = document.querySelector('.tl-cue');
      if (!bar) return { ok: false, reason: 'no bar' };
      const cueId = bar.dataset.id;
      const cue = findCue(cueId);
      return { ok: true, id: cueId, origT: cue.t, left: bar.getBoundingClientRect().left, top: bar.getBoundingClientRect().top };
    });
    assert(barDragResult.ok, 'fx_editor: cueバーが見つかる(' + JSON.stringify(barDragResult) + ')');
    if (barDragResult.ok) {
      const barCenterY = barDragResult.top + 10;
      await page.mouse.move(barDragResult.left + 5, barCenterY);
      await page.mouse.down();
      await page.mouse.move(barDragResult.left + 55, barCenterY, { steps: 5 });
      await page.mouse.up();
      const newT = await page.evaluate((id) => findCue(id).t, barDragResult.id);
      console.log('bar drag: origT=', barDragResult.origT, 'newT=', newT);
      assert(newT !== barDragResult.origT, 'fx_editor: cueバードラッグで t が変化した(従来どおり移動できる)。origT=' + barDragResult.origT + ' newT=' + newT);
      // 元に戻す(他の検証への影響を避ける・書き出しはしないので実害なし)
    }

    // 赤線直掴み(#tl-playhead)でドラッグできること。まずヘッドをどこかに置く。
    await page.evaluate(() => { scrubToTime(200); });
    await page.waitForTimeout(50);
    const phBox = await page.evaluate(() => {
      const el = document.getElementById('tl-playhead');
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, ms: document.getElementById('tl-playhead-time').textContent };
    });
    console.log('playhead box=', JSON.stringify(phBox));
    const grabX = phBox.left + phBox.width / 2;
    const grabY = phBox.top + phBox.height / 2;
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX + 100, grabY, { steps: 5 });
    await page.mouse.up();
    const afterPhDrag = await page.evaluate(() => ({
      playing: playState.playing,
      time: document.getElementById('tl-playhead-time').textContent,
    }));
    console.log('afterPhDrag=', JSON.stringify(afterPhDrag));
    assert(afterPhDrag.playing === false, 'fx_editor: 赤線直掴みドラッグ後も再生は始まっていない');
    assert(afterPhDrag.time !== phBox.ms, 'fx_editor: 赤線直掴みドラッグでヘッド時刻が変化した。before=' + phBox.ms + ' after=' + afterPhDrag.time);

    // 赤線を掴んだだけ(ドラッグなし)で離しても再生が始まらない
    await page.evaluate(() => { stopPlay(); scrubToTime(200); });
    await page.waitForTimeout(50);
    const phBox2 = await page.evaluate(() => {
      const el = document.getElementById('tl-playhead');
      const r = el.getBoundingClientRect();
      return { left: r.left + r.width / 2, top: r.top + r.height / 2 };
    });
    await page.mouse.move(phBox2.left, phBox2.top);
    await page.mouse.down();
    await page.mouse.up();
    const afterPhClick = await page.evaluate(() => playState.playing);
    assert(afterPhClick === false, 'fx_editor: 赤線を掴んだだけ(ドラッグ無し)でも再生が始まらない。実際=' + afterPhClick);

    // ---- 追加回帰: ルーラークリック=従来どおり再生ループ開始(赤線当たり判定拡張の巻き込み確認) ----
    await page.evaluate(() => { stopPlay(); });
    const rulerBox = await page.evaluate(() => {
      const r = document.getElementById('tl-ruler').getBoundingClientRect();
      return { left: r.left, top: r.top, height: r.height };
    });
    await page.mouse.move(rulerBox.left + 30, rulerBox.top + rulerBox.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    const afterRulerClick = await page.evaluate(() => playState.playing);
    assert(afterRulerClick === true, 'fx_editor: ルーラークリック(ドラッグ無し)は従来どおり再生ループを開始する。実際=' + afterRulerClick);
    await page.evaluate(() => { stopPlay(); });

    // ---- 追加回帰: ラバーバンド複数選択が従来どおり効く(赤線+スクラブ追従を並行して足した後も) ----
    const rbResult = await page.evaluate(() => {
      const bars = Array.from(document.querySelectorAll('.tl-cue'));
      return bars.map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.id, left: r.left, top: r.top, right: r.right, bottom: r.bottom }; });
    });
    if (rbResult.length >= 2) {
      // 開始点は行ラベル列(#tl-row-label・幅64px=cueバーが絶対に無い帯)から。終点はrows領域右下(全バーを覆う)。
      const startPt = { x: rowsBox.left + 20, y: rowsBox.top + 5 };
      const endPt = { x: rowsBox.left + rowsBox.width - 5, y: rowsBox.top + rowsBox.height - 2 };
      await page.evaluate(() => { clearCueSelection(); syncCueBarSelectionClasses(); });
      await page.mouse.move(startPt.x, startPt.y);
      await page.mouse.down();
      await page.mouse.move(endPt.x, endPt.y, { steps: 8 });
      await page.mouse.up();
      const selectedCount = await page.evaluate(() => selectedCueIds.size);
      assert(selectedCount === rbResult.length, 'fx_editor: ラバーバンド矩形選択で全バーが選択される(従来どおり)。期待=' + rbResult.length + ' 実際=' + selectedCount);
    } else {
      console.log('(rubber-band test skipped: bars<2, count=' + rbResult.length + ')');
    }

    // スクショ(報告添付用。setPlayheadPosは実際のドラッグハンドラが一緒に呼ぶもの=手動呼び出しのここでも揃える)
    await page.evaluate(() => { clearCueSelection(); syncCueBarSelectionClasses(); setPlayheadPos(300); scrubToTime(300); });
    await page.waitForTimeout(80);
    await page.screenshot({ path: '/private/tmp/claude-501/-Users-masamichi-Documents-----DB/e9f350aa-5d50-45b8-bd9c-bebc0f9a612a/scratchpad/scrub_300_charge.png' });
    await page.evaluate(() => { setPlayheadPos(900); scrubToTime(900); });
    await page.waitForTimeout(80);
    await page.screenshot({ path: '/private/tmp/claude-501/-Users-masamichi-Documents-----DB/e9f350aa-5d50-45b8-bd9c-bebc0f9a612a/scratchpad/scrub_900_burst.png' });

    assert(errors.length === 0, 'fx_editor.html JSエラー0(全操作終了後)。実際=' + JSON.stringify(errors));

    await page.close();
  }

  await browser.close();

  console.log('\n=== RESULT ===');
  if (failures.length === 0) {
    console.log('ALL PASS');
  } else {
    console.log(failures.length + ' FAILURES:');
    failures.forEach(f => console.log(' - ' + f));
    process.exitCode = 1;
  }
})();
