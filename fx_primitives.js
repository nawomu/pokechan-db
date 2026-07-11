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
  const r = sp.getBoundingClientRect();
  const clone = sp.cloneNode(true);
  clone.className = 'rb-chargeclone';
  clone.style.width = r.width + 'px';
  clone.style.height = r.height + 'px';
  clone.style.left = r.left + 'px';
  clone.style.top = r.top + 'px';
  document.body.appendChild(clone);
  sp.style.visibility = 'hidden';   // display:noneは使わない(レイアウト/fxPointを保持=盤面が崩れない)
  let done = false;
  const cleanup = () => { if (done) return; done = true; try { clone.remove(); } catch (e) {} sp.style.visibility = ''; };
  const safety = setTimeout(cleanup, 900);   // 例外(交代等の割込み)でも必ず盤面を復帰させる保険
  const returnHome = () => {
    clearTimeout(safety);
    try {
      const anim = clone.animate([
        { transform: `translate(${dx}px, ${dy}px)`, opacity: hit ? 1 : 0.4 },
        { transform: 'translate(0,0)', opacity: 1 },
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
      { transform: `translate(${back}px,0)`, offset: 0 },
      { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - 18}px)`, offset: 0.72 },
      { transform: `translate(${dx}px, ${dy}px)`, offset: 1, opacity: hit ? 1 : 0.4 },
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
