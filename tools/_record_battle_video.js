// ==========================================================================
// バトル動画量産ドライバ(タスク#10・宣伝用バトル動画・2026-07-20 Sonnet)
// battle_lab.html をPlaywrightでオート観戦させ、縦画面録画(1280x720横録画→
// あとでffmpegで縦合成)のwebmを1本吐き出す。パターン(自作絵/3D/ドット絵 ×
// Champions/全部版)は環境変数で切り替える。
//
// --- 使い方 ---
//   node tools/_record_battle_video.js
//
// 環境変数:
//   REC_SPRITE = svg | home | api        (既定 home)
//                svg  = うちのオリジナル絵(battle_lab.htmlの内部値は'original')
//                home = 3D(Pokémon HOME)
//                api  = ドット絵(PokeAPI)
//   REC_DATA   = champions | all         (既定 champions。all=?data=allで全部版=伝説/人気ポケ込み)
//   REC_SEC    = 録画秒数(既定 70)
//   REC_OUT    = 出力ディレクトリ(既定 <このファイルと同じ階層>/../../scratchpad-video-fallback。
//                実運用では必ずscratchpad配下を指定すること。例:
//                REC_OUT=/private/tmp/.../scratchpad/video_out/raw)
//   REC_URL    = battle_lab.htmlのURL(既定 http://localhost:8000/battle_lab.html。要ローカルサーバ)
//   REC_PICKS  = 自分側チームに強制で入れたい種族名をカンマ区切りで指定(例 "リザードン,ミュウツー")。
//                指定した数だけ s1,s2,... 番目のスロットを上書きする(残りはランダムのまま)。
//                全部版(REC_DATA=all)で有名ポケモンを混ぜたい時に使う。省略時は完全ランダム編成。
//   REC_NAME   = 出力ファイル名の接頭辞(既定 'battle')。<REC_NAME>.webm として保存。
//
// --- 継続バトル(重要) ---
// battle_labは全滅しても即gameOverにならず「♻ふっかつしてつづける/おわる」の選択待ちになる仕様
// (labChoicePending)。放置すると録画時間の大半がLOSE/WIN静止画で無駄になるため、本スクリプトは
// 2秒おきに #c-revive-continue を探してあれば自動クリックし、バトルを途切れず継続させる
// (両側AI=labAI有効なので死に出し選択もAIが自動で行い、UI操作は不要)。
//
// --- 録画後の変換コマンド(ffmpeg-static。scratchpad/node_modules/ffmpeg-static/ffmpeg) ---
//   FFMPEG=/path/to/scratchpad/node_modules/ffmpeg-static/ffmpeg
//
//   ① 縦合成(1080x1920・背景ぼかし+中央にバトル、横1280x720素材から生成):
//   $FFMPEG -y -i in.webm -filter_complex \
//     "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24[bg];\
//      [0:v]scale=1060:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[base]" \
//     -map "[base]" -map 0:a? -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest out_vertical.mp4
//
//   ② タイトルオーバーレイ焼き込み(透過PNGを動画上部に合成。PNGは別途Playwrightで
//      小さいHTML→スクショで用意する。位置は上から120px・横中央):
//   $FFMPEG -y -i out_vertical.mp4 -i title.png -filter_complex \
//     "[0:v][1:v]overlay=(W-w)/2:120[v]" -map "[v]" -map 0:a? -c:v libx264 -pix_fmt yuv420p -c:a aac out_final.mp4
//
//   ③ X用GIF(8秒・軽量パレット化。STARTは切り出し開始秒):
//   $FFMPEG -y -ss <START> -t 8 -i out_final.mp4 -vf \
//     "fps=12,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif
//
// フレーム確認(15s/40sを静止画抽出して目視確認するまでが完了条件):
//   $FFMPEG -y -ss 15 -i out_final.mp4 -frames:v 1 frame_15s.png
//   $FFMPEG -y -ss 40 -i out_final.mp4 -frames:v 1 frame_40s.png
// ==========================================================================
const { chromium } = require('/Users/masamichi/Documents/ポケモンDB/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SPRITE_MAP = { svg: 'original', home: 'home', api: 'api' };
const REC_SPRITE = SPRITE_MAP[process.env.REC_SPRITE] || 'home';
const REC_DATA = process.env.REC_DATA === 'all' ? 'all' : 'champions';
const REC_SEC = parseInt(process.env.REC_SEC || '70', 10);
const REC_OUT = process.env.REC_OUT || path.join(__dirname, '..', '..', 'video_out_fallback');
const REC_URL = process.env.REC_URL || 'http://localhost:8000/battle_lab.html';
const REC_PICKS = (process.env.REC_PICKS || '').split(',').map(s => s.trim()).filter(Boolean);
const REC_NAME = process.env.REC_NAME || 'battle';

(async () => {
  fs.mkdirSync(REC_OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: REC_OUT, size: { width: 1280, height: 720 } },
    locale: 'ja-JP',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const ev = (fn, ...a) => page.evaluate(fn, ...a).catch(e => { errs.push('EVAL:' + e.message); return null; });

  const url = REC_URL + (REC_DATA === 'all' ? '?data=all' : '');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // メッセージ自動送り+はやい送り速度
  await ev(() => { const a = document.getElementById('auto-msg'); if (a) { a.checked = true; a.dispatchEvent(new Event('change')); } const s = document.getElementById('msg-speed'); if (s) { s.value = '1700'; s.dispatchEvent(new Event('change')); } });

  // キャラ画像ソース切替(setSpriteSrcはグローバル関数)
  await ev((v) => { if (typeof setSpriteSrc === 'function') setSpriteSrc(v); }, REC_SPRITE);
  await page.waitForTimeout(300);

  // おまかせ編成(両側)
  await ev(() => document.getElementById('btn-random').click());
  await page.waitForTimeout(800);

  // 指定ポケモンを自分側スロットへ強制上書き(setSlotはグローバル関数。s1,s2,...の順)
  if (REC_PICKS.length) {
    await ev((picks) => {
      picks.forEach((name, i) => {
        const id = 's' + (i + 1);
        if (document.getElementById(id) && typeof setSlot === 'function') setSlot(id, name);
      });
    }, REC_PICKS);
    await page.waitForTimeout(500);
  }

  await ev(() => document.getElementById('btn-start').click());
  await page.waitForTimeout(2500);
  await ev(() => document.getElementById('lab-ai-self').click());
  await page.waitForTimeout(300);
  await ev(() => document.getElementById('lab-ai-opp').click());
  await page.waitForTimeout(300);
  // ▶オート再生が止まっていたら押す
  await ev(() => { const b = document.getElementById('lab-auto-toggle'); if (b && b.style.display !== 'none' && b.textContent.includes('▶')) b.click(); });

  // 録画中は「♻ふっかつしてつづける」(c-revive-continue)を見つけ次第クリックし続ける。
  // battle_labは全滅後にgameOver確定せず選択待ちになる仕様(labChoicePending)なので、放置すると
  // LOSE/WIN静止画のまま録画時間の大半が無駄になる。ポーリングで倒れ待ちなく戦闘を継続させる。
  const pollMs = 2000;
  for (let waited = 0; waited < REC_SEC * 1000; waited += pollMs) {
    await page.waitForTimeout(pollMs);
    await ev(() => {
      const rc = document.getElementById('c-revive-continue');
      if (rc && rc.style.display !== 'none' && rc.offsetParent !== null) rc.click();
    });
  }

  const video = page.video();
  await ctx.close();               // close で動画がフラッシュされる
  const rawPath = await video.path();
  const finalPath = path.join(REC_OUT, REC_NAME + '.webm');
  fs.renameSync(rawPath, finalPath);
  console.log('WEBM:', finalPath, '| jsErrors:', errs.length, errs.slice(0, 5));
  await browser.close();
})();
