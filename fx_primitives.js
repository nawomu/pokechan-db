// ===== fx_primitives.js =====
// 演出ツクール Step2a(2026-07-11・設計_演出ツクール_2026-07-11.md 2章 Step2)。
// real_battle.html / online_battle.html に二重定義されていた「バトル演出プリミティブ」を1本化。
// 純リファクタ=挙動完全不変が合格条件(切り出し元コードをそのまま移設。ロジック変更なし)。
//
// 依存(この2ページで同名グローバルが既に定義されている前提。設計docの「グローバル直参照の温存」を採用=
// 注入点を新設せずシンプルに保つ):
//   $(id)              … document.getElementById 相当(両ページとも `const $ = id => document.getElementById(id);`)
//   S.typeColors()      … タイプ別カラー(両ページとも `let S` のsimブリッジ経由)
//   SE.hitClass/miss    … WebAudio合成SE(両ページとも `const SE = {...}`)
//   window.MOVE_FX_MAP   … move_fx_map.js(shapeOf解決用)
//   window.BATTLE_FX_CUES … battle_fx_cues.js(演出ツクールStep4・resolveCueSheet/playCueSheet解決用)
// これらは呼び出し時(setTimeout/イベント経由)に解決されるため、<script>タグの読み込み順に依存しない
// (クラシックscript間はグローバル宣言環境を共有する)。
//
// トレースフック: window.__fxTrace が配列の時だけ発火記録を積む(本番は未設定=ゼロコスト)。
// バトルトレース(設計1-5)の足がかり。フォーマット: {k, mv, shape, t: performance.now()} 等。

// popText: variant('crit'=急所/'se'=ばつぐん)指定でポップイン強化(傾き復帰・金色glow等・Wave3 A級)
// durMs(阿部さんFB2026-07-11 §10・演出ツクールのバーduration配線): 省略時=従来どおり固定1s(本番の挙動は
// 1msも変わらない=絶対条件)。指定時のみ.popnumのCSSアニメ(既定rbPop 1s)をdurMsへ引き伸ばす。
function popText(side, text, color, size, variant, durMs){
  const f = $('f-' + side);
  const el = document.createElement('div');
  el.className = 'popnum' + (variant ? ' popnum-' + variant : '');
  el.textContent = text;
  if (color) el.style.color = color;
  if (size) el.style.fontSize = size + 'px';
  if (durMs) el.style.animationDuration = durMs + 'ms';
  f.appendChild(el);
  setTimeout(() => el.remove(), durMs ? durMs + 100 : 1100);
}
// burstFx: 多層バースト(Wave2.5 S級)。既存radial-gradientの上に破片パーティクル+衝撃リング+形状(shape)別グリフを重ねる。
// intensity: 'normal'(既定)/'up'(ばつぐん=粒子2倍+2重リング)/'crit'(急所=同様)/'down'(いまひとつ=粒子半減)
// shape(タスクC 2026-07-11): shapeOf(mv)の解決結果(fist/blade/flame/...等28種)。省略時はグリフ無し(従来どおり)
// durMs(阿部さんFB2026-07-11 §10): 省略時=従来どおり固定タイミング(本番の挙動は1msも変わらない=絶対条件)。
// 指定時のみ _BURST_DEFAULT_MS(=従来の球の除去タイミング650ms)を基準にscale=durMs/650を全サブ要素
// (球のCSSアニメ・粒子/リング/グリフのJS animate・setTimeout除去)へ比例配分する。
const _BURST_DEFAULT_MS = 650;
function burstFx(side, color, shape, intensity, durMs){
  const f = $('f-' + side);
  if (!f) return;
  if (window.__fxTrace) window.__fxTrace.push({k:'burstFx', shape, intensity, t: performance.now()});
  const scale = durMs ? (durMs / _BURST_DEFAULT_MS) : 1;
  const el = document.createElement('div');
  el.className = 'burst';
  el.style.background = `radial-gradient(circle, ${color}cc 0%, ${color}55 45%, transparent 70%)`;
  if (durMs) el.style.animationDuration = Math.round(850 * scale) + 'ms';   // CSS既定rbBurst .85s基準
  f.appendChild(el);
  setTimeout(() => el.remove(), durMs ? Math.round(650 * scale) : 650);
  const big = intensity === 'up' || intensity === 'crit';
  const n = intensity === 'down' ? 3 : (big ? 8 : 5);
  spawnBurstParticles(f, color, n, scale);
  spawnBurstRing(f, color, scale);
  if (big) setTimeout(() => spawnBurstRing(f, color, scale), durMs ? Math.round(60 * scale) : 60);   // 2重リング
  if (shape) spawnBurstGlyph(f, shape, scale);
}
// 破片パーティクル(4-8pxの粒が放射状に飛び散る。疑似重力で下に膨らむ弧)
// scale(阿部さんFB2026-07-11 §10): 省略時=1=従来どおり(呼び出し側の互換=real_battle/online_battleの
// 直呼び出し箇所は3引数のままで無改変)。
function spawnBurstParticles(f, color, n, scale){
  scale = scale || 1;
  for (let i = 0; i < n; i++){
    const el = document.createElement('div');
    el.className = 'rb-burstp';
    el.style.background = color;
    el.style.color = color;   // box-shadowのcurrentColorが拾う(発光の色をパーティクルと揃える)
    const size = 4 + Math.random() * 4;
    el.style.width = size + 'px'; el.style.height = size + 'px';
    const ang = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 50;
    const dxp = Math.cos(ang) * r, dyp = Math.sin(ang) * r + 40;
    f.appendChild(el);
    const dur = (350 + Math.random() * 250) * scale;
    try {
      const anim = el.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dxp}px), calc(-50% + ${dyp}px)) scale(0)`, opacity: 0 },
      ], { duration: dur, easing: 'cubic-bezier(0,.9,.57,1)' });
      anim.onfinish = () => el.remove();
    } catch (e) {}
    setTimeout(() => el.remove(), dur + 60);
  }
}
// 衝撃リング(円が拡大しながら消える)。scale=省略時1=従来どおり(real_battle/online_battleの直呼び出しは2引数のまま)
function spawnBurstRing(f, color, scale){
  scale = scale || 1;
  const el = document.createElement('div');
  el.className = 'rb-burstring';
  el.style.borderColor = color;
  f.appendChild(el);
  const dur = Math.round(300 * scale);
  try {
    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 },
      { transform: 'translate(-50%,-50%) scale(4)', opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(0,.5,.5,1)' });
    anim.onfinish = () => el.remove();
  } catch (e) {}
  setTimeout(() => el.remove(), Math.round(360 * scale));
}
// 形状(shape)別グリフ(タスクC 2026-07-11・設計_技エフェクト対応表_2026-07-11.md)。
// blade=斬線2本ずらし(既存流用) / drill=回転縞ディスク / psi・dragon=渦スパイラル(色違い) /
// dust=土煙+地割れ / explosion=だいばくはつ/じばく専用の閃光+爆風(dust流用でなく専用形状=阿部さん承認) /
// orb・sand=絵文字なし(burstFx既存の球+粒子+リングそのままで足りる=専用グリフは追加しない) /
// それ以外(fist/foot/fang/note/heart/star/skull/gear/ice/web/leaf/seed/feather/gust/water/flame/spark/rock/sting)
// =絵文字ポップ(_SHAPE_ICON)
// scale(阿部さんFB2026-07-11 §10): 省略時=1=従来どおり(real_battle/online_battleからの直呼び出しは無し=
// burstFx経由のみだが念のため同じ既定値パターンで統一)。指定時は各shapeのCSSアニメ(既定値をコメントに明記)と
// setTimeout除去タイミングを比例して引き伸ばす。
function spawnBurstGlyph(f, shape, scale){
  scale = scale || 1;
  if (!shape) return;
  if (window.__fxTrace) window.__fxTrace.push({k:'spawnBurstGlyph', shape, t: performance.now()});
  if (shape === 'blade'){
    for (let i = 0; i < 2; i++){
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'rb-burstglyph-slash';
        if (scale !== 1) el.style.animationDuration = Math.round(260 * scale) + 'ms';   // CSS既定rbGlyphSlash .26s
        f.appendChild(el);
        setTimeout(() => el.remove(), Math.round(260 * scale));
      }, Math.round(i * 60 * scale));
    }
    return;
  }
  if (shape === 'drill'){
    const el = document.createElement('div');
    el.className = 'rb-burstglyph-drill';
    if (scale !== 1) el.style.animationDuration = Math.round(300 * scale) + 'ms';   // CSS既定rbGlyphDrill .3s
    f.appendChild(el);
    setTimeout(() => el.remove(), Math.round(320 * scale));
    return;
  }
  if (shape === 'psi' || shape === 'dragon'){
    const el = document.createElement('div');
    el.className = 'rb-burstglyph-spiral';
    el.style.background = shape === 'dragon'
      ? 'conic-gradient(from 0deg,#7c3aed,#60a5fa,#7c3aed)'
      : 'conic-gradient(from 0deg,#a78bfa,#f0abfc,#a78bfa)';
    if (scale !== 1) el.style.animationDuration = Math.round(320 * scale) + 'ms';   // CSS既定rbGlyphSpiral .32s
    f.appendChild(el);
    setTimeout(() => el.remove(), Math.round(340 * scale));
    return;
  }
  if (shape === 'dust' || shape === 'explosion'){
    const big = shape === 'explosion';
    const el = document.createElement('div');
    el.className = big ? 'rb-burstglyph-explosion' : 'rb-burstglyph-dust';
    if (scale !== 1) el.style.animationDuration = Math.round((big ? 600 : 500) * scale) + 'ms';   // CSS既定.6s/.5s
    f.appendChild(el);
    setTimeout(() => el.remove(), Math.round((big ? 620 : 520) * scale));
    if (!big){
      const crack = document.createElement('div');
      crack.className = 'rb-burstglyph-crack';
      if (scale !== 1) crack.style.animationDuration = Math.round(500 * scale) + 'ms';   // crackもrbGlyphDust .5s流用
      f.appendChild(crack);
      setTimeout(() => crack.remove(), Math.round(520 * scale));
    }
    return;
  }
  if (shape === 'orb' || shape === 'sand') return;   // burstFx本体(球+粒子+リング)で十分=専用グリフ無し
  const icon = _SHAPE_ICON[shape];
  if (icon){
    const el = document.createElement('div');
    el.className = 'rb-burstglyph-emoji';
    el.textContent = icon;
    if (scale !== 1) el.style.animationDuration = Math.round(260 * scale) + 'ms';   // CSS既定rbGlyphStar .26s
    f.appendChild(el);
    setTimeout(() => el.remove(), Math.round(280 * scale));
  }
}
// ===== Wave1: 攻撃演出(技クラス別の飛翔体→着弾) 2026-07-10 阿部さん「音とエフェクトを派手に」 =====
// 技クラス判定: sound>punch>slash>bullet>wind>wave(波動)>bite>kick>物理汎用/特殊汎用(設計_バトル演出強化_2026-07-10.md の優先順)
function moveClassOf(mv){
  const f = (mv && mv.flags) || {};
  if (f.sound) return 'sound';
  if (f.punch) return 'punch';
  if (f.slicing || f.slash) return 'slash';
  if (f.bullet || f.ball) return 'bullet';
  if (f.wind) return 'wind';
  if (f.pulse) return 'wave';
  if (f.bite) return 'bite';
  if (mv && /キック|蹴/.test(mv.name || '')) return 'kick';
  return (mv && mv.category === '特殊') ? 'spec' : 'phys';
}
const _RB_CLS_ICON = { sound: '🎵', punch: '👊', slash: '⚔️', wind: '🌀', bite: '🦷', kick: '🦵' };
const _RB_CLS_DOT = { bullet: 1, phys: 1 };
const _RB_BEAM_CLS = { wave: 1, spec: 1 };
// ===== タスクC(2026-07-11): 技→エフェクト形状(shape)。設計=設計_技エフェクト対応表_2026-07-11.md =====
// moveClassOfの後段。動き(飛翔体/突進/ビームの別)は変えない=moveClassOf+mv.contactがそのまま握る。
// shapeOfは「絵のグリフ」だけを決める。解決順=overrides(技名完全一致)→flagOrder(moveClassOfと同一優先順)→defaults[タイプ][分類]。
// データ=move_fx_map.js(window.MOVE_FX_MAP。元=reference/move_fx_map_draft_v1.json)。326技(攻撃技全数)で必ず何か返る(カバレッジ機械照合済み)。
const _SHAPE_FLAG_ORDER = [
  { shape: 'note',  test: f => !!f.sound },
  { shape: 'fist',  test: f => !!f.punch },
  { shape: 'blade', test: f => !!(f.slicing || f.slash) },
  { shape: 'orb',   test: f => !!(f.bullet || f.ball) },
  { shape: 'gust',  test: f => !!f.wind },
  { shape: 'psi',   test: f => !!f.pulse },
  { shape: 'fang',  test: f => !!f.bite },
];
function shapeOf(mv){
  if (!mv) return null;
  const map = window.MOVE_FX_MAP;
  if (map && map.overrides && map.overrides[mv.name]) return map.overrides[mv.name];
  const f = mv.flags || {};
  for (const rule of _SHAPE_FLAG_ORDER) if (rule.test(f)) return rule.shape;
  if (/キック|蹴/.test(mv.name || '')) return 'foot';
  const d = map && map.defaults && map.defaults[mv.type];
  return (d && d[mv.category]) || null;
}
// shape別アイコン(絵文字)。blade/orb/sand/dust/explosion/drillは絵文字を持たず専用css(spawnBurstGlyph/spawnProjectile/spawnBeam側で分岐)。
// psi/dragon/beamは既定でビーム描画(_RB_BEAM_SHAPES)になるためここのアイコンは主に接触技着弾popText用のフォールバック。
const _SHAPE_ICON = {
  fist:'👊', foot:'🦵', fang:'🦷', note:'🎵', heart:'💗', star:'⭐', skull:'💀', gear:'⚙️',
  ice:'❄️', web:'🕸️', leaf:'🍃', seed:'🌰', feather:'🪶', gust:'🌀', water:'💧', flame:'🔥',
  spark:'⚡', rock:'🪨', sting:'🪡', blade:'⚔️', psi:'🔮', dragon:'🐉', beam:'✨',
};
// 飛翔体でなく線状ビームで見せるべき形状(設計docの③6-2「追記ルール」=既存_RB_BEAM_CLS(wave/spec)にOR結合)
const _RB_BEAM_SHAPES = { beam:1, psi:1, dragon:1, gust:1, note:1, spark:1 };
// ビーム系のうち専用モディファイアclassを持つもの(無指定は既存.rb-beamのまま)
const _RB_BEAM_SHAPE_CLASS = { psi: 'rb-beam-wave', dragon: 'rb-beam-dragon', gust: 'rb-beam-gust', spark: 'rb-beam-spark', beam: 'rb-beam-thick' };
// 飛翔体で「ボール(css)」として見せる形状(絵文字を持たない=既存bullet/ball系の発展形)。drillは回転縞バリアント付き
const _RB_PROJ_DOT_SHAPES = { orb:1, sand:1, dust:1, explosion:1, drill:1 };
// 攻撃側/対象側のスプライト中心を画面座標(fixed基準)で返す。#fieldのzoom/scaleの影響を受けない
function fxPoint(side){
  const f = $('f-' + side);
  const sp = (f && f.querySelector('.sprite')) || f;
  const r = sp.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.5 };
}
function spawnProjectile(from, to, cls, color, hitFrac, shape){
  if (window.__fxTrace) window.__fxTrace.push({k:'spawnProjectile', cls, shape, t: performance.now()});
  const el = document.createElement('div');
  const isDot = shape ? _RB_PROJ_DOT_SHAPES[shape] : _RB_CLS_DOT[cls];
  const icon = shape ? _SHAPE_ICON[shape] : _RB_CLS_ICON[cls];
  el.className = 'rb-proj' + (isDot ? ' rb-proj-dot' + (shape === 'drill' ? ' rb-proj-drill' : (!shape && cls === 'phys') ? ' rb-proj-dot-lg' : '') : '');
  if (!isDot) el.textContent = icon || '●';
  el.style.setProperty('--pc', color);
  el.style.left = from.x + 'px';
  el.style.top = from.y + 'px';
  document.body.appendChild(el);
  const dx = (to.x - from.x) * hitFrac, dy = (to.y - from.y) * hitFrac;
  const dur = 190;
  try {
    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.3}px), calc(-50% + ${dy * 0.3}px)) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${hitFrac < 1 ? 0.7 : 1.1})`, opacity: hitFrac < 1 ? 0 : 1 },
    ], { duration: dur, easing: 'ease-in' });
    anim.onfinish = () => el.remove();
  } catch (e) { /* WAAPI非対応環境の保険 */ }
  setTimeout(() => el.remove(), dur + 80);
  return dur;
}
function spawnBeam(from, to, cls, color, hitFrac, shape){
  if (window.__fxTrace) window.__fxTrace.push({k:'spawnBeam', cls, shape, t: performance.now()});
  const dx = (to.x - from.x) * hitFrac, dy = (to.y - from.y) * hitFrac;
  const dist = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const el = document.createElement('div');
  const variant = (shape && _RB_BEAM_SHAPE_CLASS[shape]) || (cls === 'wave' ? 'rb-beam-wave' : '');
  el.className = 'rb-beam' + (variant ? ' ' + variant : '');
  el.style.setProperty('--bc', color);
  el.style.left = from.x + 'px';
  el.style.top = from.y + 'px';
  el.style.transform = `rotate(${ang}deg)`;
  document.body.appendChild(el);
  const dur = 180;
  try {
    const anim = el.animate([
      { width: '0px', opacity: 0.95 },
      { width: dist + 'px', opacity: hitFrac < 1 ? 0.25 : 1 },
    ], { duration: dur, easing: 'ease-out' });
    anim.onfinish = () => el.remove();
  } catch (e) {}
  setTimeout(() => el.remove(), dur + 80);
  return dur;
}
// 攻撃側→対象側へ飛翔体/ビームを飛ばす。hit=trueなら着弾後にshake+クラス別ヒット音、false(外れ)なら
// 途中でフェード+スカ音(ログの「外れた！」文言は変えず、演出だけ足す)。戻り値=飛翔にかかったms(着弾拍の同期用)
// Wave2.5(2026-07-10 阿部さん最優先): 接触技(mv.contact===true。データ駆動・技名推測禁止)は
// 飛翔体でなく本体クローンの突進(chargeFx)にする。非接触/mv不明は従来の飛翔体/ビームのまま。
function attackFx(atkSide, tgtSide, mv, hit){
  if (mv && mv.contact === true) return chargeFx(atkSide, tgtSide, mv, hit);
  const cls = moveClassOf(mv);
  const shape = shapeOf(mv);
  if (window.__fxTrace) window.__fxTrace.push({k:'attackFx', mv: mv && mv.name, shape, t: performance.now()});
  const color = (S.typeColors() && mv && S.typeColors()[mv.type]) || '#9fb4d8';
  const from = fxPoint(atkSide), to = fxPoint(tgtSide);
  const hitFrac = hit ? 1 : 0.55;
  const useBeam = _RB_BEAM_CLS[cls] || (shape && _RB_BEAM_SHAPES[shape]);
  const dur = useBeam ? spawnBeam(from, to, cls, color, hitFrac, shape) : spawnProjectile(from, to, cls, color, hitFrac, shape);
  if (hit) setTimeout(() => { fieldShake(1); SE.hitClass(cls); }, dur);
  else setTimeout(() => SE.miss(), Math.round(dur * 0.7));
  return dur;
}
// ===== Wave2.5: 接触技=本体クローンの突進(設計_バトル演出強化_2026-07-10.md v2 ②章) =====
// 本体は動かさずクローンをbody直下fixedで飛ばす(#f-側のzoom/scaleの割り戻し不要=安全策)。
// 演出例外(交代/ひんしの割込み等)でも必ずクローン除去+本体visibility復帰する(保険タイマー併用)。
function chargeFx(atkSide, tgtSide, mv, hit){
  const cls = moveClassOf(mv);
  const shape = shapeOf(mv);
  if (window.__fxTrace) window.__fxTrace.push({k:'chargeFx', mv: mv && mv.name, shape, t: performance.now()});
  const color = (S.typeColors() && mv && S.typeColors()[mv.type]) || '#9fb4d8';
  const atkEl = $('f-' + atkSide);
  const sp = atkEl && atkEl.querySelector('.sprite');
  if (!sp || typeof sp.animate !== 'function'){
    // 保険: クローン化できない環境は従来の飛翔体にフォールバック(技名推測はしない=形状別演出は維持)
    const from = fxPoint(atkSide), to = fxPoint(tgtSide);
    const dur = spawnProjectile(from, to, cls, color, hit ? 1 : 0.55, shape);
    if (hit) setTimeout(() => { fieldShake(1); SE.hitClass(cls); }, dur); else setTimeout(() => SE.miss(), Math.round(dur * 0.7));
    return dur;
  }
  const from = fxPoint(atkSide), to = fxPoint(tgtSide);
  const hitFrac = hit ? 0.92 : 0.70;
  const dx = (to.x - from.x) * hitFrac, dy = (to.y - from.y) * hitFrac;
  const back = (dx >= 0 ? -1 : 1) * 10;   // アンティシペーション: 相手と逆方向へ少し引く
  // #f-<atkSide>の奥行きscale(自分側1.2/相手側0.95)+#field側のzoom(fitField()で画面幅に応じ可変)を
  // クローンに焼き込む補正: body直下fixedのクローンはどちらの影響も外に出るため、素のまま置くと本体より
  // 縮んで左上へジャンプして見える(実測dx=-132,dy=-39,width115→96)。#f-<atkSide>のtransformだけ読むと
  // #fieldのzoomを取りこぼす(本番で実測=1.2だけでは足りず1.54倍ズレが残った)ので、「最終描画幅÷レイアウト
  // 幅(offsetWidthはtransform/zoomどちらの影響も受けない生の値)」の比で複合スケールを丸ごと求める。
  const r = sp.getBoundingClientRect();
  const scale = sp.offsetWidth ? (r.width / sp.offsetWidth) : 1;
  const origImg = sp.querySelector('img');
  const origImgCS = origImg ? getComputedStyle(origImg) : null;   // クローン化で失う祖先依存の値を後で焼き込むために先取り
  const clone = sp.cloneNode(true);
  clone.className = 'rb-chargeclone';
  clone.style.width = (r.width / scale) + 'px';
  clone.style.height = (r.height / scale) + 'px';
  clone.style.left = r.left + 'px';
  clone.style.top = r.top + 'px';
  clone.style.transformOrigin = '0 0';   // 左上を基準にscale(左上をr.left/topへピン留めしたまま拡縮)
  // className上書きで'sprite'クラス+`.fighter`/`#f-<side>`祖先を失う三重ズレ: ①`.fighter .sprite{display:
  // flex;justify-content:center;align-items:flex-end}`が効かず中のimgが左上に落ちる ②`.fighter .sprite
  // img{max-height:118px;max-width:150px}`が効かずimg自身のinline style(height:150px等・spriteHtml()由来)
  // がそのまま出て元より大きく映る ③`#f-self .sprite img{transform:scaleX(-1)}`が効かず自分側の反転が戻る。
  // いずれもスケール補正だけでは直らない。祖先依存の値を実測してインラインで焼き込む(ハードコード禁止)。
  clone.style.display = 'flex';
  clone.style.justifyContent = 'center';
  clone.style.alignItems = 'flex-end';
  const cloneImg = clone.querySelector('img');
  if (cloneImg && origImgCS){
    cloneImg.style.maxHeight = origImgCS.maxHeight;
    cloneImg.style.maxWidth = origImgCS.maxWidth;
    cloneImg.style.transform = origImgCS.transform === 'none' ? '' : origImgCS.transform;
  }
  document.body.appendChild(clone);
  sp.style.visibility = 'hidden';   // display:noneは使わない(レイアウト/fxPointを保持=盤面が崩れない)
  let done = false;
  const cleanup = () => { if (done) return; done = true; try { clone.remove(); } catch (e) {} sp.style.visibility = ''; };
  const safety = setTimeout(cleanup, 900);   // 例外(交代等の割込み)でも必ず盤面を復帰させる保険
  const returnHome = () => {
    clearTimeout(safety);
    try {
      const anim = clone.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: hit ? 1 : 0.4 },
        { transform: `translate(0,0) scale(${scale})`, opacity: 1 },
      ], { duration: 200, easing: 'cubic-bezier(0,0,.2,1)' });
      anim.onfinish = cleanup; anim.oncancel = cleanup;
    } catch (e) { cleanup(); }
    setTimeout(cleanup, 260);   // onfinish不発の保険
  };
  const onImpact = () => {
    if (hit){
      burstFx(tgtSide, color, shape, 'normal');
      const icon = _SHAPE_ICON[shape] || _RB_CLS_ICON[cls];
      if (icon) popText(tgtSide, icon, null, 26);
      SE.hitClass(cls);
      fieldShake(1);
      knockbackFx(tgtSide, dx, dy);
      // ヒットストップ簡易版: 帰還アニメの開始を60-80ms遅らせる(周辺演出は止めない)
      setTimeout(returnHome, 60 + Math.round(Math.random() * 20));
    } else {
      SE.miss();
      returnHome();
    }
  };
  try {
    const anim = clone.animate([
      { transform: `translate(${back}px,0) scale(${scale})`, offset: 0 },
      { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - 18}px) scale(${scale})`, offset: 0.72 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, offset: 1, opacity: hit ? 1 : 0.4 },
    ], { duration: 230, easing: 'cubic-bezier(.4,0,1,1)' });
    anim.onfinish = onImpact; anim.oncancel = cleanup;
  } catch (e) { cleanup(); return 0; }
  return 230;   // dur=着弾までの経過ms(こうか/きゅうしょ行の同拍合流に使う既存の_hitFxDelay契約を維持)
}
// 被弾ノックバック(Wave2.5 S級): 攻撃方向へ一瞬押されて弾む。.fighter(外側)に掛けるので
// .sprite側のrbShake/squash&stretchアニメ(別要素)と衝突しない
function knockbackFx(side, dx, dy){
  const f = $('f-' + side);
  if (!f) return;
  const cls = side === 'self' ? 'rb-knockback-self' : 'rb-knockback-opp';
  f.classList.remove(cls);
  void f.offsetWidth;
  f.classList.add(cls);
  setTimeout(() => f.classList.remove(cls), 280);
}
// ===== Wave4 B級: インパクトフレーム(白黒反転50ms・transition:none必須・急所/KO級限定) =====
// 通常打には出さない(特別感の温存)。#field.rb-impactの!importantで確実にtransitionを殺す。
function impactFrameFx(){
  const f = $('field');
  if (!f) return;
  f.classList.add('rb-impact');
  setTimeout(() => f.classList.remove('rb-impact'), 50);
}
// ===== Wave4 B級: 色収差風シェイク(大技+シェイク最大時のみ・drop-shadow赤/シアン2〜5px→100msで戻す) =====
// #field.style.filterを直接操作(インパクトフレームのCSSクラス!importantとは別プロパティ経路で競合させない)
function chromaticAberrationFx(){
  const f = $('field');
  if (!f) return;
  const off = (2 + Math.random() * 3).toFixed(1);
  f.style.transition = 'filter .1s linear';
  f.style.filter = `drop-shadow(${off}px 0 rgba(255,0,0,.5)) drop-shadow(-${off}px 0 rgba(0,255,255,.5))`;
  setTimeout(() => { f.style.filter = ''; }, 120);
}
// ===== Wave4 B級: トラウマ式シェイク格上げ(既存の簡易版fieldShake=CSSキーフレームtranslateXのみを置換) =====
// trauma(0〜1)を毎rAFで trauma-=dt*2.5 減衰、shake=trauma²、周期の異なるsin合成(毎フレーム乱数は不自然=NG)で
// translate+rotateを合成しつつ連続ヒットで自然に揺れが蓄積する。API互換: fieldShake(mag)のシグネチャ/呼び出し側は
// 無改変(--shake-magも従来どおり設定=互換維持。表示は本rAFループが担う)
let _shakeTrauma = 0, _shakeRAFId = null, _shakeLastT = 0;
function _shakeTick(now){
  const f = $('field');
  if (!f){ _shakeRAFId = null; _shakeLastT = 0; return; }
  const dt = _shakeLastT ? Math.min(0.05, (now - _shakeLastT) / 1000) : 0.016;
  _shakeLastT = now;
  _shakeTrauma = Math.max(0, _shakeTrauma - dt * 2.5);
  if (_shakeTrauma <= 0.002){
    f.style.transform = '';
    _shakeRAFId = null; _shakeLastT = 0;
    return;
  }
  const shake = _shakeTrauma * _shakeTrauma;
  const t = now / 1000;
  const n1 = Math.sin(t * 31.7) * 0.6 + Math.sin(t * 53.1) * 0.4;
  const n2 = Math.sin(t * 27.3 + 1.3) * 0.6 + Math.sin(t * 41.9 + 0.4) * 0.4;
  const n3 = Math.sin(t * 19.1 + 2.1) * 0.6 + Math.sin(t * 37.7 + 0.8) * 0.4;
  f.style.transform = `translate(${(shake * 12 * n1).toFixed(2)}px, ${(shake * 6 * n2).toFixed(2)}px) rotate(${(shake * 1.5 * n3).toFixed(2)}deg)`;
  _shakeRAFId = requestAnimationFrame(_shakeTick);
}
// 画面(盤面)シェイク。mag(Wave2.5 S級・強弱スケール): 1.0=通常/1.6=ばつぐん・急所/0.5=いまひとつ級の弱打
// →trauma加算量にマップ(強いほどtrauma²の効きで揺れが跳ね上がる)。mag>=1.6は色収差風シェイクも同時発火。
function fieldShake(mag){
  const f = $('field');
  if (!f) return;
  const m = mag != null ? mag : 1;
  f.style.setProperty('--shake-mag', m);   // --shake-mag経路は互換維持(旧keyframes参照用に値だけ設定・表示はrAF側)
  const add = m >= 1.6 ? 0.85 : (m < 1 ? 0.35 : 0.6);
  _shakeTrauma = Math.min(1, Math.max(_shakeTrauma, add));
  if (!_shakeRAFId) _shakeRAFId = requestAnimationFrame(_shakeTick);
  if (m >= 1.6) chromaticAberrationFx();   // Wave4 B級: 大技+シェイク最大時のみ
}
// flash: 側全体(#f-self/#f-opp)にCSSクラスを一瞬付ける汎用フラッシュ(登場/退場/状態異常の合図等で使用)
function flash(side, cls){
  const f = $('f-' + side);
  f.classList.remove(cls);
  void f.offsetWidth;
  f.classList.add(cls);
  setTimeout(() => f.classList.remove(cls), 800);
}

// ===== 演出ツクール Step2b(2026-07-11・設計_演出ツクール_2026-07-11.md 1-4「シーン」)=====
// real_battle.html/online_battle.htmlに二重定義されていた「シーン演出」(登場/メガ儀式/ひんし/KOスロー/勝敗等)を
// 1本化。Step2aと同じ判断基準(グローバル直参照温存=$/S/SE/tone/ac/_recallTimer・純リファクタで挙動不変)。
// 依存の補足: tone()/ac()(WebAudio合成音の下請け)・_recallTimer(交代1拍目のgone遅延タイマー・オブジェクト)は
// 両ページで同名同内容のグローバルとして既に定義されている前提(Step2aのSE/$と同じ扱い。注入点は新設しない)。
// ランク変化: 緑↑/紫↓の粒子(段数で個数)+上昇/下降スイープ音
function rankFx(side, up, stage){
  const f = $('f-' + side);
  if (!f) return;
  const n = Math.min(3, Math.max(1, stage || 1));
  for (let i = 0; i < n; i++){
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'rb-rankp ' + (up ? 'rb-rankp-up' : 'rb-rankp-down');
      el.textContent = up ? '↑' : '↓';
      el.style.marginLeft = (Math.random() * 30 - 15) + 'px';
      f.appendChild(el);
      setTimeout(() => el.remove(), 900);
    }, i * 90);
  }
  up ? SE.rankUp() : SE.rankDown();
}
// 回復のキラキラ(緑の星が数個舞う)。SE.heal()(ハープ風)は既存のまま呼び出し元で鳴らす
function sparkleFx(side){
  const f = $('f-' + side);
  if (!f) return;
  for (let i = 0; i < 5; i++){
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'rb-sparkle';
      el.textContent = '✨';
      el.style.left = (15 + Math.random() * 70) + '%';
      el.style.top = (30 + Math.random() * 40) + '%';
      f.appendChild(el);
      setTimeout(() => el.remove(), 700);
    }, i * 60);
  }
}
function screenFlash(color, mega){
  const el = $('fx-flash');
  el.style.background = color;
  el.className = '';
  void el.offsetWidth;
  el.className = mega ? 'mega' : 'on';
}
// ===== Wave3: メガシンカ儀式演出(設計_バトル演出強化_2026-07-10.md v2 ③章・特例1.5-2.0s) =====
// 「収束→シルエット→爆発」の3拍構造。戻り値=総dur(_megaFxDelayとしてnextSayの自動送りをホールドする)。
// 全エフェクトは#f-側内にappend(側スケールの影響はサイズ係数側で吸収)。エンジン状態は読まない(行検知のみ)。
// scene:mega_evolve(演出ツクール1-4)のトレース発火点。
// 演出ツクール Step5(2026-07-11・シーン対応): 内部の各拍(柱/オーブ/シルエット/爆発/DNA)を
// _megaStep*として関数化(純リファクタ=megaFx自体の呼び出し順序・引数・タイミングは1msも変えない)。
// _dispatchSceneCueProd(このファイル末尾)がscene:mega_evolveのキュー再生でも同じ関数を呼ぶことで、
// 「自動演出(このmegaFx)」と「人間が調整したキューシート」が常に同じコードパスを通る(二重実装を作らない)。
function _megaStepPillar(f){
  const pillar = document.createElement('div');
  pillar.className = 'rb-mega-pillar';
  f.appendChild(pillar);
  setTimeout(() => pillar.remove(), 480);
}
function _megaStepOrbs(f){
  for (let i = 0; i < 5; i++){
    const orb = document.createElement('div');
    orb.className = 'rb-mega-orb';
    const ang = (Math.PI * 2 / 5) * i;
    orb.style.setProperty('--ox', Math.cos(ang) * 70 + 'px');
    orb.style.setProperty('--oy', Math.sin(ang) * 70 + 'px');
    f.appendChild(orb);
    setTimeout(() => orb.remove(), 420);
  }
}
function _megaStepSilhouetteOn(sp){ if (sp) sp.classList.add('rb-mega-silhouette'); }
function _megaStepClimax(side, f, sp){
  if (sp) sp.classList.remove('rb-mega-silhouette');
  burstFx(side, '#ffd96b', null, 'up');
  const ring = document.createElement('div');
  ring.className = 'rb-mega-ring';
  f.appendChild(ring);
  setTimeout(() => ring.remove(), 520);
  for (let i = 0; i < 4; i++){
    const mist = document.createElement('div');
    mist.className = 'rb-mega-mist';
    mist.style.left = (30 + Math.random() * 40) + '%';
    mist.style.top = (20 + Math.random() * 40) + '%';
    f.appendChild(mist);
    setTimeout(() => mist.remove(), 500);
  }
}
function _megaStepDna(f){
  const dna = document.createElement('div');
  dna.className = 'rb-mega-dna';
  dna.textContent = '✦';
  f.appendChild(dna);
  setTimeout(() => dna.remove(), 260);
}
function megaFx(side){
  if (window.__fxTrace) window.__fxTrace.push({k:'megaFx', side, t: performance.now()});
  const f = $('f-' + side);
  if (!f) return 0;
  const DUR = 1700;
  screenFlash('#835BA5', true);   // t=0: 紫オーバーレイ(既存rbMega keyframeを流用)
  setTimeout(() => _megaStepPillar(f), 200);      // t=200: 光柱
  setTimeout(() => _megaStepOrbs(f), 300);        // t=300: 収束する発光玉×5(ポケモン周囲→中心)
  const sp = f.querySelector('.sprite');
  setTimeout(() => _megaStepSilhouetteOn(sp), 500);   // t=500: シルエット化
  // t=700: スプライト差し替えは呼び出し元(renderAll)に任せる(変身の瞬間を見せない=見た目はシルエットのまま)
  setTimeout(() => _megaStepClimax(side, f, sp), 900);   // t=900: 爆発(収束玉→拡散)+虹リング+桃霧玉
  setTimeout(() => fieldShake(1.6), 1000);   // t=1000: filter解除+shake
  setTimeout(() => _megaStepDna(f), 1300);   // t=1300: 仕上げ(独自のDNA型シンボル・公式アセット複製なし)
  // 全要素は各自のtimeoutで一括remove(失敗しても盤面を壊さない=class常駐なし)
  return DUR;
}
// ===== Wave4 B級: KOスロー(とどめ演出・設計 v2 ①/④章)。ひんし行限定・dur戻り値で次拍をホールド(_koFxDelay) =====
// getAnimationsの対象は「戦闘の飛翔体/バースト/ポップ数字/倒れなかった側の.fighter」だけに絞る。
// #moves の常駐パルス(.mega-armed)や壁パネルの::before/::after一撃popは対象外(壁パネルは疑似要素=そもそも
// querySelectorAllで拾えない/常駐UIは選択子に含めない)。倒れた側の.fighterはrbFaint(沈み演出)の1500ms固定
// タイマーと噛み合わせる必要がないよう意図的に除外(スロー化すると沈み切る前にgoneで隠れて不自然になる事故を防ぐ)。
// .rb-chargeclone(突進クローン)も意図的に除外(実機PDCAで発覚・2026-07-10): chargeFxは
// 「lunge→(onfinish)→returnHome→(onfinish)cleanup=visibility復帰」の2段WAAPIアニメ連鎖で、
// pause→playbackRate操作を挟むとonfinishの発火タイミングが崩れ、cleanupが呼ばれず本体spriteが
// visibility:hiddenのまま・クローンが盤面に残留するリークを実機で確認したため(=まさに巻き込み事故)。
function _koCollectAnims(koSide){
  const otherSide = koSide === 'self' ? 'opp' : 'self';
  const sel = `#f-${otherSide},#f-${otherSide} *,.rb-proj,.rb-proj-dot,.rb-beam,.rb-beam-wave,` +
    `.popnum,.burst,.rb-burstp,.rb-burstring,[class*="rb-burstglyph"],[class*="rb-mega-"]`;
  const seen = new Set(), anims = [];
  document.querySelectorAll(sel).forEach(el => {
    if (seen.has(el)) return; seen.add(el);
    try { el.getAnimations().forEach(a => { if (a.playState === 'running') anims.push(a); }); } catch (e) {}
  });
  return anims;
}
// scene:ko_slowmo(演出ツクール1-4)のトレース発火点。
// 演出ツクール Step5(2026-07-11・シーン対応): 「タメ→スロー→復帰」を_koStepImpact/_koStepSlowに
// 関数化(純リファクタ=koSlowFx自体のタイミング・引数は1msも変えない=tameMs/slowMsの既定値200/600は
// 元のsetTimeoutオフセットそのまま)。_dispatchSceneCueProd(このファイル末尾)がscene:ko_slowmoの
// キュー再生でも_koStepSlowを呼ぶ(cue.t側で「タメ」を表現するのでtameMs=0で呼ぶ・後述コメント参照)。
function _koStepImpact(){
  impactFrameFx();   // Wave4 B級①: 白黒反転50ms(急所/KO級限定)
  SE.explosion();    // Wave4 B級⑥: 爆発音(大技/KO限定=KOは無条件)
}
function _koStepSlow(koSide, tameMs, slowMs){
  tameMs = tameMs != null ? tameMs : 200;
  slowMs = slowMs != null ? slowMs : 600;
  const bg = $('field-backdrop');
  const anims = _koCollectAnims(koSide);
  anims.forEach(a => { try { a.pause(); } catch (e) {} });   // ヒットストップ(じっくりFB=2026-07-11 阿部さん)
  if (bg){ bg.style.transition = 'filter .18s linear'; bg.style.filter = 'brightness(.5)'; }
  setTimeout(() => {
    anims.forEach(a => { try { a.playbackRate = 0.15; a.play(); } catch (e) {} });   // スロー(0.15x=もっとゆっくり)
    setTimeout(() => {
      anims.forEach(a => { try { a.playbackRate = 1; } catch (e) {} });   // 復帰
      if (bg){ bg.style.transition = 'filter .25s linear'; bg.style.filter = ''; }
    }, slowMs);
  }, tameMs);
}
function koSlowFx(koSide){
  if (window.__fxTrace) window.__fxTrace.push({k:'koSlowFx', koSide, t: performance.now()});
  _koStepImpact();
  _koStepSlow(koSide, 200, 600);
  return 950;   // dur=200(タメ)+600(スロー)+150(復帰バッファ)。次拍と衝突させない(_koFxDelayでホールド)
}
// ===== Wave3: 壁パネル(リフレクター/ひかりのかべ/オーロラベール・設計 v2 ③-2章) =====
// 持続は#f-側へのclass付与でCSS管理(::before/::afterの平行四辺形パネル)=renderAll等の再描画に耐える。
// 交代・ひんしでは消さない(壁は側に付く)。新バトル初期化時のみstartBattle()側でclass除去する。
const _WALL_CLASS = { リフレクター: 'rb-wall-reflect', ひかりのかべ: 'rb-wall-screen', オーロラベール: 'rb-wall-veil' };
function showWallFx(side, name){
  const f = $('f-' + side), cls = _WALL_CLASS[name];
  if (!f || !cls) return;
  f.classList.remove(cls);
  void f.offsetWidth;
  f.classList.add(cls);   // 再付与でCSSのpop込みkeyframeを再生(一瞬強く光って薄く常駐)
  tone('triangle', 660, 0.1, 0.14, 880);
  tone('triangle', 880, 0.12, 0.12, null, ac().currentTime + 0.05);
}
function hideWallFx(side, name){
  const f = $('f-' + side), cls = _WALL_CLASS[name];
  if (!f || !cls) return;
  f.classList.remove(cls);
}
const _WEATHER_FX = {sun: ['☀️', '#3a2c14'], rain: ['💧', '#14263a'], sand: ['🌪️', '#34290f'], snow: ['❄️', '#1a2a3c']};
// scene:weather_*(演出ツクール1-4)のトレース発火点(kind=null=天候解除も記録する)。
function setWeatherFx(kind){
  if (window.__fxTrace) window.__fxTrace.push({k:'setWeatherFx', kind, t: performance.now()});
  const el = $('weather-fx');
  if (!kind){ el.textContent = ''; el.classList.remove('live'); $('field').style.boxShadow = ''; return; }
  const [emo, tint] = _WEATHER_FX[kind];
  el.textContent = (emo + ' ').repeat(24);
  el.classList.add('live');
  $('field').style.boxShadow = `inset 0 0 80px 20px ${tint}`;
}
// S6: 背景プリセット切替 ---------------------------------------------------
// setBackdrop(preset): #field-backdrop の data-preset 属性を切り替えるだけ。
// CSSが data-preset 値に応じて背景グラデを適用(将来の追加はCSS1プリセット+option1行)。
// preset: 'grass' | 'cave' | 'water' | 'night'(初期値='grass')。
const _BACKDROP_PRESETS = ['grass', 'cave', 'water', 'night'];
function setBackdrop(preset){
  const el = $('field-backdrop');
  if (!el) return;
  const p = _BACKDROP_PRESETS.includes(preset) ? preset : 'grass';
  el.dataset.preset = p;
  // セレクトと同期
  const sel = $('backdrop-sel');
  if (sel && sel.value !== p) sel.value = p;
  // 設定をlocalStorageに保存(リロードで復元)
  try { localStorage.setItem('rb_backdrop', p); } catch (e) {}
}
function initBackdrop(){
  // localStorageから復元(保存値があればそれを適用、なければ'grass')
  let saved = 'grass';
  try { saved = localStorage.getItem('rb_backdrop') || 'grass'; } catch (e) {}
  setBackdrop(saved);
  // セレクトのchange → setBackdrop
  const sel = $('backdrop-sel');
  if (sel){
    sel.value = saved;
    sel.addEventListener('change', () => setBackdrop(sel.value));
  }
}
// 勝敗を画面中央に大きく表示(WIN/LOSE)。次のバトル開始やリセットで消す。scene:win/scene:lose のトレース発火点
// (won=true/falseで区別)。hideResultBanner()も両ページ同一実装だったため一緒に移設(先の調査で「online側だけ
// AI戦タイマー再アームを併記」と見えたのは単一行関数へのawk抽出誤検出=実際は完全同一。この段落で訂正)。
function showResultBanner(won){
  if (window.__fxTrace) window.__fxTrace.push({k:'showResultBanner', won: !!won, t: performance.now()});
  const el = $('result-banner');
  if (!el) return;
  el.className = 'show ' + (won ? 'win' : 'lose');
  el.innerHTML = `<div class="rb-txt">${won ? 'WIN!' : 'LOSE...'}</div>`;
}
function hideResultBanner(){ const el = $('result-banner'); if (el) el.className = ''; }
// ===== シーン演出(登場/引っ込め/ひんし)。real_battle.html/online_battle.htmlの行fxディスパッチャ(この2ページに
// 残置=msgbox/say系で state強結合)から、DOM操作のみの部分だけを切り出し(呼び出し順序は元のまま不変)。
// 交代/死に出し共通の登場演出。scene:send_out(演出ツクール1-4)のトレース発火点。
function sendOutFx(side){
  if (window.__fxTrace) window.__fxTrace.push({k:'sendOutFx', side, t: performance.now()});
  flash(side, 'enter');
  SE.enter();
}
// 引っ込める演出。scene:recall(演出ツクール1-4)のトレース発火点。1拍目で縮んで消え、2拍目(登場)で
// _recallTimer経由でキャンセルされなければ1000ms後にgoneへ固定する(呼び出し元の交代1拍目if分岐から丸ごと移設)。
function recallFx(side){
  if (window.__fxTrace) window.__fxTrace.push({k:'recallFx', side, t: performance.now()});
  const f0 = $('f-' + side);
  if (f0){
    // flash()は800ms後に自前でclsを外す仕様だが、rbRecallは1s(forwards)かけて沈み切る演出。
    // 800ms時点でflash()がrecallを剥がすと、沈みきる前に素の姿(不透明度1・原位置)へ一瞬ポップして戻り、
    // その後1000ms時点の_recallTimerでgoneが付いて再度消える=「沈んで消える→一瞬戻る→また消える」の
    // ちらつきになっていた(2026-07-13発覚)。faintFxが同じ理由でflash()を避けているのと同じ対策として、
    // ここもflash()を使わず自前でclassを付け外しし、_recallTimerの1000ms(rbRecallの尺と一致)まで
    // recallクラスを保持し続ける。
    f0.classList.remove('recall');
    void f0.offsetWidth;
    f0.classList.add('recall');   // rbRecall 1s forwards=浮いてから沈んで消える
  }
  const pbEl = $('pb-' + side); if (pbEl) pbEl.style.visibility = 'hidden';
  clearTimeout(_recallTimer[side]);
  _recallTimer[side] = setTimeout(() => { const f = $('f-' + side); if (f){ f.classList.remove('recall'); f.classList.add('gone'); } }, 1000);
}
// ひんし退場演出(沈んで消える)。scene:faint(演出ツクール1-4)のトレース発火点。呼び出し元(ひんし行if分岐)は
// このあとに続けて`_koFxDelay = koSlowFx(side)`を呼ぶ(HPバー同期setHpBarは呼び出し元に残置=state更新のため)。
function faintFx(side){
  if (window.__fxTrace) window.__fxTrace.push({k:'faintFx', side, t: performance.now()});
  const ff = $('f-' + side);
  if (ff){
    ff.classList.remove('recall', 'enter', 'hit', 'lunge-self', 'lunge-opp');
    void ff.offsetWidth;
    ff.classList.add('faint');   // rbFaint .95s forwards=沈んで消える
    // 沈み切ったらgoneで固定。flash()を使うと800msでfaintが外れ100ms素に戻って再表示=ちらつく(2026-07-06 阿部さん)ため自前で。
    setTimeout(() => { ff.classList.add('gone'); ff.classList.remove('faint');
      const pbF = $('pb-' + side); if (pbF) pbF.style.visibility = 'hidden'; }, 1500);
  }
  SE.faint();
}

// ===== 演出ツクール Step4(2026-07-11・設計_演出ツクール_2026-07-11.md 1-2 cuePlayer=上書きオーバーレイ方式) =====
// fx_editor.htmlで人間が調整したキューシート(window.BATTLE_FX_CUES・battle_fx_cues.js)を本番
// (real_battle.html/online_battle.html)が再生するための共有プレイヤー。fx_editor.htmlのdispatchCue()と
// 同じディスパッチを移植(挙動を合わせる。fx_editor.html自体は今回未改修=重複実装は将来の共通化タスク)。

// resolveCueSheet(mv): window.BATTLE_FX_CUES からこの技用のシートを解決する。
// 優先順=move:技名(個別上書き) → pattern:タイプ+分類(一括既定・fx_editor.htmlの'pattern:'+type+category形式と同一)。
// どちらもdone===trueのシートのみ採用(ドラフト中=書き出し前の未完成シートは本番に出さない)。無ければnull
// (=呼び出し側は従来のattackFx/chargeFx経路のまま=シート無し技は完全不変)。
function resolveCueSheet(mv){
  const map = window.BATTLE_FX_CUES;
  if (!mv || !map) return null;
  const byMove = map['move:' + mv.name];
  if (byMove && byMove.done === true) return byMove;
  const byPattern = map['pattern:' + mv.type + mv.category];
  if (byPattern && byPattern.done === true) return byPattern;
  return null;
}
// キューシートの「着弾拍」= 従来のattackFx/chargeFxが返していた_hitFxDelay相当(ms)。atk(突進/飛翔)以外の
// トラック(glyph/sound/screen/def)で最も早く発火するキューのtを着弾とみなす(1-1のサンプルもこの形=
// 非atkトラックが同じtに集まる設計)。無ければ総尺の半分にフォールバック。
function _cueImpactTime(sheet){
  let best = null;
  (sheet.cues || []).forEach(c => {
    if (c.track === 'glyph' || c.track === 'sound' || c.track === 'screen' || c.track === 'def'){
      if (best == null || c.t < best) best = c.t;
    }
  });
  return best != null ? best : Math.round((sheet.dur || 600) / 2);
}
// fx_editor.htmlのcueChargeMotion()の本番版。エディタは常にself(攻撃側固定)→opp(標的固定)でプレビュー
// するが、本番は自分/相手どちらが攻撃側にもなるため、atkSide/tgtSideを引数で渡す。アニメの中身
// (移動量・easing・cleanup)はエディタ版とロジック同一(コピー)。
function _cueChargeMotionProd(atkSide, tgtSide, dur, params){
  const sp = document.querySelector('#f-' + atkSide + ' .sprite');
  if (!sp || typeof sp.animate !== 'function') return;
  const from = fxPoint(atkSide), to = fxPoint(tgtSide);
  const hitFrac = 0.85;
  const dx = (to.x - from.x) * hitFrac, dy = (to.y - from.y) * hitFrac;
  // #f-<atkSide>の奥行きscale(自分側1.2/相手側0.95)+#field側のzoom(fitField()で画面幅に応じ可変)を
  // クローンに焼き込む補正(chargeFxと同じ根治): #f-<atkSide>のtransformだけ読むと#fieldのzoomを取りこぼす
  // ので、「最終描画幅÷レイアウト幅(offsetWidthはtransform/zoomどちらの影響も受けない生の値)」の比で
  // 複合スケールを丸ごと求める。
  const r = sp.getBoundingClientRect();
  const scale = sp.offsetWidth ? (r.width / sp.offsetWidth) : 1;
  const origImg = sp.querySelector('img');
  const origImgCS = origImg ? getComputedStyle(origImg) : null;   // クローン化で失う祖先依存の値を後で焼き込むために先取り
  const clone = sp.cloneNode(true);
  clone.className = 'rb-chargeclone';
  clone.style.width = (r.width / scale) + 'px'; clone.style.height = (r.height / scale) + 'px';
  clone.style.left = r.left + 'px'; clone.style.top = r.top + 'px';
  clone.style.transformOrigin = '0 0';   // 左上を基準にscale(左上をr.left/topへピン留めしたまま拡縮)
  // className上書きで'sprite'クラス+`.fighter`/`#f-<side>`祖先を失う三重ズレ(chargeFxと同じ根治): ①中央/
  // 下寄せflexが効かず左上に落ちる ②img自身のmax-height/max-width上限が効かずinline style由来の生サイズで
  // 大きく映る ③自分側の反転(scaleX(-1))が戻る。祖先依存の値を実測してインラインで焼き込む(ハードコード禁止)。
  clone.style.display = 'flex';
  clone.style.justifyContent = 'center';
  clone.style.alignItems = 'flex-end';
  const cloneImg = clone.querySelector('img');
  if (cloneImg && origImgCS){
    cloneImg.style.maxHeight = origImgCS.maxHeight;
    cloneImg.style.maxWidth = origImgCS.maxWidth;
    cloneImg.style.transform = origImgCS.transform === 'none' ? '' : origImgCS.transform;
  }
  document.body.appendChild(clone);
  sp.style.visibility = 'hidden';
  let done = false;
  const cleanup = () => { if (done) return; done = true; try { clone.remove(); } catch (e) {} sp.style.visibility = ''; };
  setTimeout(cleanup, dur + 300);
  try {
    const anim = clone.animate([
      { transform: `translate(0,0) scale(${scale})`, offset: 0 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, offset: 0.62 },
      { transform: `translate(0,0) scale(${scale})`, offset: 1 },
    ], { duration: Math.max(80, dur), easing: 'cubic-bezier(.3,0,.2,1)' });
    anim.onfinish = cleanup; anim.oncancel = cleanup;
  } catch (e) { cleanup(); }
}
// 画面シェイクの持続(fx_editor.htmlのsustainedFieldShake()の本番版)。エディタ側はループ再生中の
// playState.playingを見て途中停止するが、本番は単発再生なので経過時間だけで自然に終わる同一ロジック。
// shouldContinue(演出ツクールStep6・エディタ共通化2026-07-11): 省略時=undefined=従来どおり最後まで
// 続く(本番の挙動は1msも変わらない=絶対条件)。指定時のみ毎ステップでfalseを返すと即座に打ち切る
// (fx_editor.htmlのSTOP押下時=ループ再生停止に使う。fx_editor.html自身のsustainedFieldShakeは
// この関数へ委譲するために廃止=重複実装の解消)。
function _cueSustainedFieldShake(mag, durMs, shouldContinue){
  fieldShake(mag);
  if (!durMs || durMs <= 280) return;   // 既定尺(280ms)以下は単発のまま(fieldShake内蔵の減衰で従来どおり)
  const stepMs = 90;
  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed += stepMs;
    if (elapsed >= durMs || (shouldContinue && !shouldContinue())){ clearInterval(timer); return; }
    fieldShake(mag);
  }, stepMs);
}
// 1キューをプリミティブへディスパッチ(fx_editor.htmlのdispatchCue()を移植・ロジック同一)。
// info = {mv, color, atkSide, tgtSide, dmgText, hitCls, onDef, shouldContinue}。キューシートは常に
// 「self=攻撃側固定」で書かれている(エディタの視点=盤面は常に自分が攻める向き)ため、
// cue.params.at('self'/'opp')は本番のatkSide/tgtSideへ解決する('opp'既定=標的)。
// onDef/shouldContinue(演出ツクールStep6・エディタ共通化2026-07-11): 省略時=undefined=本番の挙動は
// 1msも変わらない(絶対条件)。fx_editor.htmlがこの同じ関数を再利用するための差分吸収フック
// (onDef=def/textトラック発火のたびに呼ぶコールバック=エディタのHPバーpulse演出用。
// shouldContinue=screenトラックshakeの持続を毎ステップ問い合わせる関数=エディタのSTOP即時反映用)。
function _dispatchCueProd(cue, info){
  const p = cue.params || {};
  const mv = info.mv;
  const shape = p.shape || shapeOf(mv);
  const cls = p.cls || moveClassOf(mv);
  const color = info.color;
  const atSide = (p.at === 'self') ? info.atkSide : info.tgtSide;
  try {
    if (cue.track === 'atk'){
      if (cue.action === 'projectile') spawnProjectile(fxPoint(info.atkSide), fxPoint(info.tgtSide), cls, color, 1, shape);
      else if (cue.action === 'beam') spawnBeam(fxPoint(info.atkSide), fxPoint(info.tgtSide), cls, color, 1, shape);
      else if (cue.action === 'charge') _cueChargeMotionProd(info.atkSide, info.tgtSide, cue.dur, p);
    } else if (cue.track === 'glyph' && cue.action === 'burst'){
      const off = p.offset || { x: 0, y: 0 };
      const gf = $('f-' + atSide);
      if (gf){ gf.style.setProperty('--fx-ox', (off.x || 0) + 'px'); gf.style.setProperty('--fx-oy', (off.y || 0) + 'px'); }
      burstFx(atSide, color, shape, p.intensity || 'normal', cue.dur);
    } else if (cue.track === 'sound' && cue.action === 'se'){
      SE.hitClass(cls);
    } else if (cue.track === 'screen' && cue.action === 'shake'){
      _cueSustainedFieldShake(p.mag != null ? p.mag : 1, cue.dur, info.shouldContinue);
    } else if (cue.track === 'def'){
      if (cue.action === 'knockback'){
        const from = fxPoint(info.atkSide), to = fxPoint(info.tgtSide);
        const dx = (to.x - from.x) * 0.15, dy = (to.y - from.y) * 0.15;
        knockbackFx(atSide, atSide === info.tgtSide ? -dx : dx, atSide === info.tgtSide ? -dy : dy);
      } else if (cue.action === 'hitreact'){
        // hitCls(実際のダメージ%由来。呼び出し側=lineWithFxが計算した値)を優先。無ければp.bigフラグへフォールバック。
        flash(atSide, info.hitCls || (p.big ? 'hit-big' : 'hit'));
      }
      if (info.onDef) info.onDef(atSide);
    } else if (cue.track === 'text' && cue.action === 'popnum'){
      // dmgText(実際のダメージ数値。呼び出し側から渡される)を優先。無ければキューの固定文言(エディタのプレビュー既定値)。
      popText(atSide, info.dmgText != null ? info.dmgText : (p.text || ''), p.color || '#fff', p.size || 16, null, cue.dur);
      if (info.onDef) info.onDef(atSide);
    }
  } catch (e) { console.error('[playCueSheet dispatch error]', cue, e); }
}
// playCueSheet(sheet, ctx): 本番cuePlayer本体。キューシートのcues[]をタイミングどおり一括setTimeout予約する。
// ctx = {atkSide, tgtSide, mv, color, dmgText, hitCls}。戻り値=着弾拍ms(_cueImpactTime。呼び出し側の
// 「_hitFxDelay」契約=従来のattackFx/chargeFxの戻り値と同じ役割で使う=こうか/急所行の同拍合流に流用可能)。
// __board(エディタの立ち位置)は見ない=本番の配置は本番のまま(設計4章の指定どおり)。
function playCueSheet(sheet, ctx){
  ctx = ctx || {};
  const info = {
    mv: ctx.mv,
    color: ctx.color || (S.typeColors() && ctx.mv && S.typeColors()[ctx.mv.type]) || '#9fb4d8',
    atkSide: ctx.atkSide,
    tgtSide: ctx.tgtSide,
    dmgText: ctx.dmgText,
    hitCls: ctx.hitCls,
  };
  if (window.__fxTrace) window.__fxTrace.push({ k: 'playCueSheet', mv: ctx.mv && ctx.mv.name, t: performance.now() });
  (sheet.cues || []).forEach(cue => {
    setTimeout(() => _dispatchCueProd(cue, info), Math.max(0, cue.t || 0));
  });
  return _cueImpactTime(sheet);
}

// ===== 演出ツクール Step5(2026-07-11・設計_演出ツクール_2026-07-11.md 1-4「シーン」) =====
// シーン(登場/引っ込め/メガシンカ/ひんし/KOスロー/勝敗バナー)のキューシート再生。moveの
// resolveCueSheet/playCueSheet(Step4)と同じ「上書きオーバーレイ」思想をシーンにも適用する。
// キーは 'scene:' + シーンキー('send_out'/'recall'/'mega_evolve'/'faint'/'ko_slowmo'/'win'/'lose'/
// 'weather_rain'等)。done===trueのシートのみ本番採用(ドラフト中は従来のsendOutFx/recallFx/megaFx/
// faintFx/koSlowFx/showResultBannerの直接呼び出しのまま=挙動完全不変)。

// resolveSceneSheet(key): window.BATTLE_FX_CUES から 'scene:'+key のシートを解決する。
// resolveCueSheet(mv)と同じ形(done===trueのみ採用・無ければnull=呼び出し側は従来関数のまま)。
function resolveSceneSheet(key){
  const map = window.BATTLE_FX_CUES;
  if (!map || !key) return null;
  const sheet = map['scene:' + key];
  return (sheet && sheet.done === true) ? sheet : null;
}
// 1シーンキューをプリミティブへディスパッチ。ctx = {side, won}。track/actionの語彙は既存の
// atk/glyph/sound/screen/def/textをそのまま流用する(fx_editor.htmlのタイムラインUIが新設なしで動く)。
// mega/koのglyph・screenアクションはmegaFx/koSlowFxからStep5で切り出した_megaStep*/_koStep*を再利用
// (=自動演出と同じ関数を呼ぶので二重実装にならない)。send_out/recall/faintのdef/soundアクションは
// sendOutFx/recallFx/faintFxのDOM操作をそのまま複製(これらは元々数行の単純な処理で、関数を分割する
// ほどの内部タイミングを持たないため=設計docの「他は1〜3キューの簡素なもの」に対応)。
function _dispatchSceneCueProd(cue, ctx){
  ctx = ctx || {};
  const side = ctx.side || 'self';
  const p = cue.params || {};
  try {
    if (cue.track === 'def' && cue.action === 'flash'){
      flash(side, p.cls || 'enter');
    } else if (cue.track === 'def' && cue.action === 'hidebox'){
      const pbEl = $('pb-' + side); if (pbEl) pbEl.style.visibility = 'hidden';
    } else if (cue.track === 'def' && cue.action === 'gone'){
      const f = $('f-' + side);
      if (f){ f.classList.remove('recall'); f.classList.add('gone'); }
    } else if (cue.track === 'def' && cue.action === 'faintstart'){
      const ff = $('f-' + side);
      if (ff){
        ff.classList.remove('recall', 'enter', 'hit', 'lunge-self', 'lunge-opp');
        void ff.offsetWidth;
        ff.classList.add('faint');
      }
    } else if (cue.track === 'def' && cue.action === 'gonefaint'){
      const ff = $('f-' + side);
      if (ff){ ff.classList.add('gone'); ff.classList.remove('faint'); }
      const pbF = $('pb-' + side); if (pbF) pbF.style.visibility = 'hidden';
    } else if (cue.track === 'sound' && cue.action === 'se'){
      const name = p.name || 'enter';
      if (SE[name]) SE[name]();
    } else if (cue.track === 'screen' && cue.action === 'flash'){
      screenFlash(p.color || '#835BA5', !!p.mega);
    } else if (cue.track === 'screen' && cue.action === 'impactframe'){
      impactFrameFx();
    } else if (cue.track === 'screen' && cue.action === 'shake'){
      fieldShake(p.mag != null ? p.mag : 1);
    } else if (cue.track === 'screen' && cue.action === 'slowmo'){
      // tameMs=0(このキュー自体がplaySceneCueSheetのsetTimeoutで既にcue.t分待たされている=
      // タメはスケジューリング側が担う)。slowMs=cue.dur(編集可能)。
      _koStepSlow(side, 0, cue.dur);
    } else if (cue.track === 'glyph' && cue.action === 'pillar'){
      const f = $('f-' + side); if (f) _megaStepPillar(f);
    } else if (cue.track === 'glyph' && cue.action === 'orbs'){
      const f = $('f-' + side); if (f) _megaStepOrbs(f);
    } else if (cue.track === 'glyph' && cue.action === 'silhouette'){
      const f = $('f-' + side), sp = f && f.querySelector('.sprite');
      _megaStepSilhouetteOn(sp);
    } else if (cue.track === 'glyph' && cue.action === 'climax'){
      const f = $('f-' + side), sp = f && f.querySelector('.sprite');
      _megaStepClimax(side, f, sp);
    } else if (cue.track === 'glyph' && cue.action === 'dna'){
      const f = $('f-' + side); if (f) _megaStepDna(f);
    } else if (cue.track === 'glyph' && cue.action === 'weather'){
      setWeatherFx(p.kind || 'rain');   // ライブラリ用(本番の呼び出し箇所上書き対象外=エディタプレビュー専用)
    } else if (cue.track === 'text' && cue.action === 'banner'){
      // ctx.won(実際の勝敗。呼び出し側から渡される)を優先。無ければキューの固定値(エディタのプレビュー既定値)。
      showResultBanner(ctx.won != null ? ctx.won : !!p.won);
    }
  } catch (e) { console.error('[playSceneCueSheet dispatch error]', cue, e); }
}
// playSceneCueSheet(sheet, ctx): 本番シーンcuePlayer本体。playCueSheetのシーン版。
// ctx = {side, won}。戻り値=総dur(sheet.dur。megaFx/koSlowFxの戻り値と同じ役割=_megaFxDelay/
// _koFxDelayのホールドにそのまま使える)。
// 'def'/'gone'キューはrecallFx()と同じ安全装置(_recallTimer)へタイマーを登録する(交代1拍目→
// すぐ2拍目の死に出しが来た場合に「1000ms後のgone」を打ち消すため。real_battle.html/online_battle.html
// の「場に出た」ハンドラが既存のclearTimeout(_recallTimer[enterSide])でそのまま拾える=呼び出し元の
// 安全装置を変えずに済む)。_recallTimerは両ページの既存グローバル(fx_primitives.jsの他関数と同じ前提)。
function playSceneCueSheet(sheet, ctx){
  ctx = ctx || {};
  if (window.__fxTrace) window.__fxTrace.push({ k: 'playSceneCueSheet', side: ctx.side, t: performance.now() });
  (sheet.cues || []).forEach(cue => {
    const timer = setTimeout(() => _dispatchSceneCueProd(cue, ctx), Math.max(0, cue.t || 0));
    if (cue.track === 'def' && cue.action === 'gone' && ctx.side && typeof _recallTimer !== 'undefined'){
      _recallTimer[ctx.side] = timer;
    }
  });
  return sheet.dur || 0;
}
