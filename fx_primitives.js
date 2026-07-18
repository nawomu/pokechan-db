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

// _fxAutoRemove: 演出要素の自己remove用ヘルパー(2026-07-16・設計_ツクール強化_炎サイズ配線とスクラブ_
// 2026-07-15.md §3-2 段階B「本物のシーク」)。fx_editor.htmlがスクラブで止めた静止画が、このタイマーで
// 消えてしまわないようにする。window.__FX_SCRUB__ が真の間だけ remove() をスキップする(=フラグが立って
// いる間は要素をそのまま残す。フラグはfx_editor.html側がresetPreviewPositions()の頭で必ずfalseへ戻す)。
// 省略時(フラグ未定義=本番real_battle.html/online_battle.html)は `setTimeout(() => el.remove(), ms)` と
// 完全に同一(1msも挙動を変えない=絶対条件)。
function _fxAutoRemove(el, ms){
  setTimeout(() => { if (window.__FX_SCRUB__) return; el.remove(); }, ms);
}

// popText: variant('crit'=急所/'se'=ばつぐん)指定でポップイン強化(傾き復帰・金色glow等・Wave3 A級)
// durMs(阿部さんFB2026-07-11 §10・演出ツクールのバーduration配線): 省略時=従来どおり固定1s(本番の挙動は
// 1msも変わらない=絶対条件)。指定時のみ.popnumのCSSアニメ(既定rbPop 1s)をdurMsへ引き伸ばす。
// opts(2026-07-15・設計_演出ツクール本格化_2026-07-15.md §2-1・不満B「数字の大きさ/消え方」):
// {holdMs, fadeMs, rise}のいずれかが指定された時だけWAAPI 3相(ポップイン180ms固定→ホールド→フェード)へ
// 切替える。省略時(=本番の既存呼び出し・cueシート無し技)は従来のCSS rbPop経由のまま1msも変えない。
// variant(crit/se)指定時は新パラメータを無視して従来経路(まず通常数字だけ・§2-1点3)。
const _POPTEXT_POPIN_MS = 180;   // rbPopの0〜18%(ポップイン)を再現する固定尺
function popText(side, text, color, size, variant, durMs, opts){
  const f = $('f-' + side);
  const el = document.createElement('div');
  el.className = 'popnum' + (variant ? ' popnum-' + variant : '');
  el.textContent = text;
  if (color) el.style.color = color;
  if (size) el.style.fontSize = size + 'px';
  const useWaapi = !variant && opts && (opts.holdMs != null || opts.fadeMs != null || opts.rise != null) && typeof el.animate === 'function';
  if (useWaapi){
    const holdMs = opts.holdMs != null ? opts.holdMs : 0;
    const fadeMs = opts.fadeMs != null ? opts.fadeMs : 800;
    const rise = opts.rise != null ? opts.rise : 46;
    const total = _POPTEXT_POPIN_MS + holdMs + fadeMs;
    const popInFrac = _POPTEXT_POPIN_MS / total;
    const holdEndFrac = (_POPTEXT_POPIN_MS + holdMs) / total;
    el.style.animation = 'none';   // CSSのrbPop(既定1s)とWAAPIの二重適用を防ぐ
    f.appendChild(el);
    // ★罠: rbPopは全キーフレームにtranslateX(-50%)を含む(centering)。WAAPI側でも毎キーフレームに
    // 明記しないと横位置が飛ぶ(設計docの罠として明記済み)。
    try {
      el.animate([
        { opacity: 0, transform: 'translateX(-50%) translateY(6px) scale(.6)', offset: 0 },
        { opacity: 1, transform: 'translateX(-50%) translateY(-6px) scale(1.18)', offset: popInFrac },
        { opacity: 1, transform: 'translateX(-50%) translateY(-6px) scale(1.18)', offset: holdEndFrac },
        { opacity: 0, transform: `translateX(-50%) translateY(${-(6 + rise)}px) scale(1)`, offset: 1 },
      ], { duration: total, easing: 'ease', fill: 'forwards' });
    } catch (e) {}
    _fxAutoRemove(el, total + 100);
    return;
  }
  if (durMs) el.style.animationDuration = durMs + 'ms';
  f.appendChild(el);
  _fxAutoRemove(el, durMs ? durMs + 100 : 1100);
}
// burstFx: 多層バースト(Wave2.5 S級)。既存radial-gradientの上に破片パーティクル+衝撃リング+形状(shape)別グリフを重ねる。
// intensity: 'normal'(既定)/'up'(ばつぐん=粒子2倍+2重リング)/'crit'(急所=同様)/'down'(いまひとつ=粒子半減)
// shape(タスクC 2026-07-11): shapeOf(mv)の解決結果(fist/blade/flame/...等28種)。省略時はグリフ無し(従来どおり)
// durMs(阿部さんFB2026-07-11 §10): 省略時=従来どおり固定タイミング(本番の挙動は1msも変わらない=絶対条件)。
// 指定時のみ _BURST_DEFAULT_MS(=従来の球の除去タイミング650ms)を基準にscale=durMs/650を全サブ要素
// (球のCSSアニメ・粒子/リング/グリフのJS animate・setTimeout除去)へ比例配分する。
// sizeScale(阿部さんFB2026-07-15・設計_ツクール強化_炎サイズ配線とスクラブ_2026-07-15.md §2-1):
// 見た目倍率(乗数)。省略時=1=従来どおり(呼び出し側の互換=real_battle/online_battleの直呼び出し
// 箇所は5引数のままで無改変)。時間用の既存 scale(=durMs/650)とは別物=混同しないこと。
// clampはこの関数の外(_dispatchCueProd)で行う=直接呼び出し側は素通し。
// offset(2026-07-15): 出現位置オフセット{x,y}px。--fx-ox/--fx-oyはここで毎回セット(省略時=0px)する。
// 理由=cueシートのoffsetが#f-<side>に残ったままだと、後続のcueシート無し技(レガシー経路)のburstまで
// ズレて出る(本番CSSがvarを消費するようになった2026-07-15以降のリーク)。毎回リセット=省略時旧挙動一致。
// particles(2026-07-15・設計_演出ツクール本格化_2026-07-15.md §2-2): 粒の数の上書き。省略時(null/undefined)
// =従来どおりintensity由来のn(呼び出し側=real_battle/online_battleの直呼び出し箇所は7引数のままで無改変)。
// clampはこの関数の外(_dispatchCueProd)で行う=sizeScaleと同じ方針(直接呼び出し側は素通し)。
const _BURST_DEFAULT_MS = 650;
function burstFx(side, color, shape, intensity, durMs, sizeScale, offset, particles){
  const f = $('f-' + side);
  if (!f) return;
  if (window.__fxTrace) window.__fxTrace.push({k:'burstFx', shape, intensity, t: performance.now()});
  const scale = durMs ? (durMs / _BURST_DEFAULT_MS) : 1;
  sizeScale = sizeScale || 1;
  const off = offset || { x: 0, y: 0 };
  f.style.setProperty('--fx-ox', (off.x || 0) + 'px');
  f.style.setProperty('--fx-oy', (off.y || 0) + 'px');
  const el = document.createElement('div');
  el.className = 'burst';
  el.style.background = `radial-gradient(circle, ${color}cc 0%, ${color}55 45%, transparent 70%)`;
  if (durMs) el.style.animationDuration = Math.round(850 * scale) + 'ms';   // CSS既定rbBurst .85s基準
  if (sizeScale !== 1) el.style.setProperty('--fx-burst-scale', sizeScale);
  f.appendChild(el);
  _fxAutoRemove(el, durMs ? Math.round(650 * scale) : 650);
  const big = intensity === 'up' || intensity === 'crit';
  let n = intensity === 'down' ? 3 : (big ? 8 : 5);
  if (particles != null) n = particles;
  spawnBurstParticles(f, color, n, scale, sizeScale);
  spawnBurstRing(f, color, scale, sizeScale);
  if (big) setTimeout(() => spawnBurstRing(f, color, scale, sizeScale), durMs ? Math.round(60 * scale) : 60);   // 2重リング
  if (shape) spawnBurstGlyph(f, shape, scale, sizeScale);
}
// 破片パーティクル(4-8pxの粒が放射状に飛び散る。疑似重力で下に膨らむ弧)
// scale(阿部さんFB2026-07-11 §10): 省略時=1=従来どおり(呼び出し側の互換=real_battle/online_battleの
// 直呼び出し箇所は3引数のままで無改変)。sizeScale(2026-07-15): 省略時=1=従来どおり。粒サイズ/拡散距離に乗算。
function spawnBurstParticles(f, color, n, scale, sizeScale){
  scale = scale || 1;
  sizeScale = sizeScale || 1;
  for (let i = 0; i < n; i++){
    const el = document.createElement('div');
    el.className = 'rb-burstp';
    el.style.background = color;
    el.style.color = color;   // box-shadowのcurrentColorが拾う(発光の色をパーティクルと揃える)
    const size = (4 + Math.random() * 4) * sizeScale;
    el.style.width = size + 'px'; el.style.height = size + 'px';
    const ang = Math.random() * Math.PI * 2;
    const r = (40 + Math.random() * 50) * sizeScale;
    const dxp = Math.cos(ang) * r, dyp = Math.sin(ang) * r + 40 * sizeScale;
    f.appendChild(el);
    const dur = (350 + Math.random() * 250) * scale;
    try {
      const anim = el.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dxp}px), calc(-50% + ${dyp}px)) scale(0)`, opacity: 0 },
      ], { duration: dur, easing: 'cubic-bezier(0,.9,.57,1)' });
      anim.onfinish = () => el.remove();
    } catch (e) {}
    _fxAutoRemove(el, dur + 60);
  }
}
// 衝撃リング(円が拡大しながら消える)。scale=省略時1=従来どおり(real_battle/online_battleの直呼び出しは2引数のまま)。
// sizeScale(2026-07-15): 省略時=1=従来どおり。リングの基準サイズ(.rb-burstringのwidth/height/margin)に効かせる。
function spawnBurstRing(f, color, scale, sizeScale){
  scale = scale || 1;
  sizeScale = sizeScale || 1;
  const el = document.createElement('div');
  el.className = 'rb-burstring';
  el.style.borderColor = color;
  if (sizeScale !== 1) el.style.setProperty('--fx-burst-scale', sizeScale);
  f.appendChild(el);
  const dur = Math.round(300 * scale);
  try {
    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 },
      { transform: 'translate(-50%,-50%) scale(4)', opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(0,.5,.5,1)' });
    anim.onfinish = () => el.remove();
  } catch (e) {}
  _fxAutoRemove(el, Math.round(360 * scale));
}
// 形状(shape)別グリフ(タスクC 2026-07-11・設計_技エフェクト対応表_2026-07-11.md)。
// blade=斬線2本ずらし(既存流用) / drill=回転縞ディスク / psi・dragon=渦スパイラル(色違い) /
// dust=土煙+地割れ / explosion=だいばくはつ/じばく専用の閃光+爆風(dust流用でなく専用形状=阿部さん承認) /
// fang=白い鋭い牙2本(2026-07-16 阿部さんFB=人間の歯🦷でなく狼/サメ型の牙の専用CSS) /
// orb・sand=絵文字なし(burstFx既存の球+粒子+リングそのままで足りる=専用グリフは追加しない) /
// それ以外(fist/foot/palm/note/heart/star/skull/gear/ice/web/leaf/seed/feather/gust/water/flame/spark/rock/sting)
// =絵文字ポップ(_SHAPE_ICON)
// scale(阿部さんFB2026-07-11 §10): 省略時=1=従来どおり(real_battle/online_battleからの直呼び出しは無し=
// burstFx経由のみだが念のため同じ既定値パターンで統一)。指定時は各shapeのCSSアニメ(既定値をコメントに明記)と
// setTimeout除去タイミングを比例して引き伸ばす。
// sizeScale(2026-07-15): 省略時=1=従来どおり。各グリフ要素に--fx-burst-scaleを乗せ、対応CSS(width/height/
// margin/font-sizeをvar(--fx-burst-scale,1)化済み)に効かせる。時間用scaleとは別軸(混同しないこと)。
function spawnBurstGlyph(f, shape, scale, sizeScale){
  scale = scale || 1;
  sizeScale = sizeScale || 1;
  if (!shape) return;
  if (window.__fxTrace) window.__fxTrace.push({k:'spawnBurstGlyph', shape, t: performance.now()});
  if (shape === 'blade'){
    for (let i = 0; i < 2; i++){
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'rb-burstglyph-slash';
        if (scale !== 1) el.style.animationDuration = Math.round(260 * scale) + 'ms';   // CSS既定rbGlyphSlash .26s
        if (sizeScale !== 1) el.style.setProperty('--fx-burst-scale', sizeScale);
        f.appendChild(el);
        _fxAutoRemove(el, Math.round(260 * scale));
      }, Math.round(i * 60 * scale));
    }
    return;
  }
  if (shape === 'drill'){
    const el = document.createElement('div');
    el.className = 'rb-burstglyph-drill';
    if (scale !== 1) el.style.animationDuration = Math.round(300 * scale) + 'ms';   // CSS既定rbGlyphDrill .3s
    if (sizeScale !== 1) el.style.setProperty('--fx-burst-scale', sizeScale);
    f.appendChild(el);
    _fxAutoRemove(el, Math.round(320 * scale));
    return;
  }
  if (shape === 'psi' || shape === 'dragon'){
    const el = document.createElement('div');
    el.className = 'rb-burstglyph-spiral';
    el.style.background = shape === 'dragon'
      ? 'conic-gradient(from 0deg,#7c3aed,#60a5fa,#7c3aed)'
      : 'conic-gradient(from 0deg,#a78bfa,#f0abfc,#a78bfa)';
    if (scale !== 1) el.style.animationDuration = Math.round(320 * scale) + 'ms';   // CSS既定rbGlyphSpiral .32s
    if (sizeScale !== 1) el.style.setProperty('--fx-burst-scale', sizeScale);
    f.appendChild(el);
    _fxAutoRemove(el, Math.round(340 * scale));
    return;
  }
  if (shape === 'dust' || shape === 'explosion'){
    const big = shape === 'explosion';
    const el = document.createElement('div');
    el.className = big ? 'rb-burstglyph-explosion' : 'rb-burstglyph-dust';
    if (scale !== 1) el.style.animationDuration = Math.round((big ? 600 : 500) * scale) + 'ms';   // CSS既定.6s/.5s
    if (sizeScale !== 1) el.style.setProperty('--fx-burst-scale', sizeScale);
    f.appendChild(el);
    _fxAutoRemove(el, Math.round((big ? 620 : 520) * scale));
    if (!big){
      const crack = document.createElement('div');
      crack.className = 'rb-burstglyph-crack';
      if (scale !== 1) crack.style.animationDuration = Math.round(500 * scale) + 'ms';   // crackもrbGlyphDust .5s流用
      if (sizeScale !== 1) crack.style.setProperty('--fx-burst-scale', sizeScale);
      f.appendChild(crack);
      _fxAutoRemove(crack, Math.round(520 * scale));
    }
    return;
  }
  if (shape === 'fang'){
    // fang: 白い鋭い牙2本(2026-07-16 阿部さんFB=人間の歯🦷から狼/サメ型の牙へ差し替え)
    const el = document.createElement('div');
    el.className = 'rb-burstglyph-fang';
    if (scale !== 1) el.style.animationDuration = Math.round(280 * scale) + 'ms';   // CSS既定rbGlyphFang .28s
    if (sizeScale !== 1) el.style.setProperty('--fx-burst-scale', sizeScale);
    f.appendChild(el);
    _fxAutoRemove(el, Math.round(300 * scale));
    return;
  }
  if (shape === 'orb' || shape === 'sand') return;   // burstFx本体(球+粒子+リング)で十分=専用グリフ無し
  const icon = _SHAPE_ICON[shape];
  if (icon){
    const el = document.createElement('div');
    el.className = 'rb-burstglyph-emoji';
    el.textContent = icon;
    if (scale !== 1) el.style.animationDuration = Math.round(260 * scale) + 'ms';   // CSS既定rbGlyphStar .26s
    if (sizeScale !== 1) el.style.setProperty('--fx-burst-scale', sizeScale);
    f.appendChild(el);
    _fxAutoRemove(el, Math.round(280 * scale));
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
// fang: 保険用(spawnBurstGlyphのcustom分岐でrb-burstglyph-fangに差し替え済み=通常はここに来ない)。
// palm(2026-07-16・はたく/はたきおとす/スイープビンタ=平手): 拳👊と区別する絵文字✋。
const _SHAPE_ICON = {
  fist:'👊', foot:'🦵', fang:'🦷', palm:'✋', note:'🎵', heart:'💗', star:'⭐', skull:'💀', gear:'⚙️',
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
// durMs(2026-07-16 阿部さん「フレアドライブ基準を全技デフォルトに・ビーム/飛翔の発射→着弾を長くしたい」):
// 末尾省略可能引数。省略時=undefined=従来どおり190固定(real_battle/online_battleのattackFxAuto経由=
// 直呼び出し箇所は引数を増やしていないので1msも変わらない)。指定時のみ内部durを上書き(clamp 60〜2000ms=
// 極端値で演出が壊れる/凍りつくのを防ぐ)。呼び出し元=_dispatchCueProd(cue.durをキューシートから渡す)。
function spawnProjectile(from, to, cls, color, hitFrac, shape, durMs){
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
  const dur = durMs != null ? Math.min(2000, Math.max(60, durMs)) : 190;
  try {
    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.3}px), calc(-50% + ${dy * 0.3}px)) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${hitFrac < 1 ? 0.7 : 1.1})`, opacity: hitFrac < 1 ? 0 : 1 },
    ], { duration: dur, easing: 'ease-in' });
    anim.onfinish = () => el.remove();
  } catch (e) { /* WAAPI非対応環境の保険 */ }
  _fxAutoRemove(el, dur + 80);
  return dur;
}
// durMs: spawnProjectileと同じ契約(省略時=undefined=従来180固定・指定時のみclamp 60〜2000で上書き)。
function spawnBeam(from, to, cls, color, hitFrac, shape, durMs){
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
  const dur = durMs != null ? Math.min(2000, Math.max(60, durMs)) : 180;
  try {
    const anim = el.animate([
      { width: '0px', opacity: 0.95 },
      { width: dist + 'px', opacity: hitFrac < 1 ? 0.25 : 1 },
    ], { duration: dur, easing: 'ease-out' });
    anim.onfinish = () => el.remove();
  } catch (e) {}
  _fxAutoRemove(el, dur + 80);
  return dur;
}
// 攻撃側→対象側へ飛翔体/ビームを飛ばす。hit=trueなら着弾後にshake+クラス別ヒット音、false(外れ)なら
// 途中でフェード+スカ音(ログの「外れた！」文言は変えず、演出だけ足す)。戻り値=飛翔にかかったms(着弾拍の同期用)
// Wave2.5(2026-07-10 阿部さん最優先): 接触技(mv.contact===true。データ駆動・技名推測禁止)は
// 飛翔体でなく本体クローンの突進(chargeFx)にする。非接触/mv不明は従来の飛翔体/ビームのまま。
// speedMul(2026-07-16連続技演出): 末尾省略可能引数。省略時=undefined=1として扱う=全既存呼び出しは
// 1msも変わらない(不変)。連続技の各ヒットだけ呼び出し元(lineWithFx)が0.4前後を渡して尺を圧縮する。
function attackFx(atkSide, tgtSide, mv, hit, speedMul){
  const _sm = speedMul != null ? speedMul : 1;
  if (mv && mv.contact === true) return chargeFx(atkSide, tgtSide, mv, hit, _sm);
  const cls = moveClassOf(mv);
  const shape = shapeOf(mv);
  if (window.__fxTrace) window.__fxTrace.push({k:'attackFx', mv: mv && mv.name, shape, t: performance.now()});
  const color = (S.typeColors() && mv && S.typeColors()[mv.type]) || '#9fb4d8';
  const from = fxPoint(atkSide), to = fxPoint(tgtSide);
  const hitFrac = hit ? 1 : 0.55;
  const useBeam = _RB_BEAM_CLS[cls] || (shape && _RB_BEAM_SHAPES[shape]);
  const _durMs = _sm !== 1 ? Math.round((useBeam ? 180 : 190) * _sm) : undefined;
  const dur = useBeam ? spawnBeam(from, to, cls, color, hitFrac, shape, _durMs) : spawnProjectile(from, to, cls, color, hitFrac, shape, _durMs);
  if (hit) setTimeout(() => { fieldShake(1); SE.hitClass(cls); }, dur);
  else setTimeout(() => SE.miss(), Math.round(dur * 0.7));
  return dur;
}
// ===== Wave2.5: 接触技=本体クローンの突進(設計_バトル演出強化_2026-07-10.md v2 ②章) =====
// 本体は動かさずクローンをbody直下fixedで飛ばす(#f-側のzoom/scaleの割り戻し不要=安全策)。
// 演出例外(交代/ひんしの割込み等)でも必ずクローン除去+本体visibility復帰する(保険タイマー併用)。
// speedMul(2026-07-16連続技演出): 末尾省略可能引数。省略時=undefined→1扱い=既存呼び出しは1msも
// 変わらない(不変)。連続技の各ヒットは0.4前後を渡し、突進/帰還/バーストの尺をまとめて圧縮する。
function chargeFx(atkSide, tgtSide, mv, hit, speedMul){
  const _sm = speedMul != null ? speedMul : 1;
  const cls = moveClassOf(mv);
  const shape = shapeOf(mv);
  if (window.__fxTrace) window.__fxTrace.push({k:'chargeFx', mv: mv && mv.name, shape, t: performance.now()});
  const color = (S.typeColors() && mv && S.typeColors()[mv.type]) || '#9fb4d8';
  const atkEl = $('f-' + atkSide);
  const sp = atkEl && atkEl.querySelector('.sprite');
  if (!sp || typeof sp.animate !== 'function'){
    // 保険: クローン化できない環境は従来の飛翔体にフォールバック(技名推測はしない=形状別演出は維持)
    const from = fxPoint(atkSide), to = fxPoint(tgtSide);
    const _durMs = _sm !== 1 ? Math.round(190 * _sm) : undefined;
    const dur = spawnProjectile(from, to, cls, color, hit ? 1 : 0.55, shape, _durMs);
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
  // 2026-07-16(段階B): スクラブで止めた静止画はクローンが本体の代わりに見えている状態なので、
  // __FX_SCRUB__が真の間はcleanup(クローン除去+本体sprite可視化)を丸ごとスキップする(=静止画を保つ)。
  // フラグはfx_editor.htmlのresetPreviewPositions()の頭で必ずfalseに戻る(=次のスクラブ/リセット/
  // 再生開始/技切替で本掃除される)ので、doneを立てずに素通りしても取り残しにはならない。
  const cleanup = () => { if (window.__FX_SCRUB__) return; if (done) return; done = true; try { clone.remove(); } catch (e) {} sp.style.visibility = ''; };
  const safety = setTimeout(cleanup, Math.round(900 * _sm));   // 例外(交代等の割込み)でも必ず盤面を復帰させる保険
  const returnHome = () => {
    clearTimeout(safety);
    try {
      const anim = clone.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: hit ? 1 : 0.4 },
        { transform: `translate(0,0) scale(${scale})`, opacity: 1 },
      ], { duration: Math.round(200 * _sm), easing: 'cubic-bezier(0,0,.2,1)' });
      anim.onfinish = cleanup; anim.oncancel = cleanup;
    } catch (e) { cleanup(); }
    setTimeout(cleanup, Math.round(260 * _sm));   // onfinish不発の保険
  };
  const onImpact = () => {
    if (hit){
      // フレアドライブの尺(burst=1950ms)をdone:trueシート未対応の全技デフォルトに(2026-07-13 阿部さん)。
      // 連続技(_sm<1)はburstもまとめて圧縮=1発ずつの残像が重ならないようにする(2026-07-16)
      burstFx(tgtSide, color, shape, 'normal', Math.round(1950 * _sm));
      const icon = _SHAPE_ICON[shape] || _RB_CLS_ICON[cls];
      if (icon) popText(tgtSide, icon, null, 26);
      SE.hitClass(cls);
      fieldShake(1);
      knockbackFx(tgtSide, dx, dy);
      // ヒットストップ簡易版: 帰還アニメの開始を60-80ms遅らせる(周辺演出は止めない)
      setTimeout(returnHome, Math.round((60 + Math.round(Math.random() * 20)) * _sm));
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
    ], { duration: Math.round(230 * _sm), easing: 'cubic-bezier(.4,0,1,1)' });
    anim.onfinish = onImpact; anim.oncancel = cleanup;
  } catch (e) { cleanup(); return 0; }
  return Math.round(230 * _sm);   // dur=着弾までの経過ms(こうか/きゅうしょ行の同拍合流に使う既存の_hitFxDelay契約を維持)
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
      _fxAutoRemove(el, 900);
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
      _fxAutoRemove(el, 700);
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
  _fxAutoRemove(pillar, 480);
}
function _megaStepOrbs(f){
  for (let i = 0; i < 5; i++){
    const orb = document.createElement('div');
    orb.className = 'rb-mega-orb';
    const ang = (Math.PI * 2 / 5) * i;
    orb.style.setProperty('--ox', Math.cos(ang) * 70 + 'px');
    orb.style.setProperty('--oy', Math.sin(ang) * 70 + 'px');
    f.appendChild(orb);
    _fxAutoRemove(orb, 420);
  }
}
function _megaStepSilhouetteOn(sp){ if (sp) sp.classList.add('rb-mega-silhouette'); }
function _megaStepClimax(side, f, sp, color){
  if (sp) sp.classList.remove('rb-mega-silhouette');
  burstFx(side, color || '#ffd96b', null, 'up');
  const ring = document.createElement('div');
  ring.className = 'rb-mega-ring';
  f.appendChild(ring);
  _fxAutoRemove(ring, 520);
  for (let i = 0; i < 4; i++){
    const mist = document.createElement('div');
    mist.className = 'rb-mega-mist';
    mist.style.left = (30 + Math.random() * 40) + '%';
    mist.style.top = (20 + Math.random() * 40) + '%';
    f.appendChild(mist);
    _fxAutoRemove(mist, 500);
  }
}
function _megaStepDna(f){
  const dna = document.createElement('div');
  dna.className = 'rb-mega-dna';
  dna.textContent = '✦';
  f.appendChild(dna);
  _fxAutoRemove(dna, 260);
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
// 状態異常の絵/色の正典(2026-07-16 阿部さん「攻撃技の既存エフェクトと変化技を全部合わせる」=SSOT 1本化)。
// 従来real_battle/online_battleのlineWithFxにインラインで二重定義されていたものを集約。エディタの変化技
// 自動生成(_autoCuesForStatusMove)も同じマップを読む=二度とズレない。ねむり/ねむけは💤→Zzz/Zz…
// (2026-07-16 阿部さん「文字でなくZzz・言語非依存」)。iconはpopText・colorはburstFx用。
const STATUS_FX = {
  もうどく: { icon: '💜', color: '#7c3aed' },
  どく:     { icon: '💜', color: '#a855f7' },
  まひ:     { icon: '⚡', color: '#facc15' },
  やけど:   { icon: '🔥', color: '#f97316' },
  こおり:   { icon: '❄️', color: '#67e8f9' },
  ねむり:   { icon: 'Zzz', color: '#818cf8' },
  ねむけ:   { icon: 'Zz…', color: '#818cf8' },
  こんらん: { icon: '💫', color: '#e879f9' },
  メロメロ: { icon: '💕', color: '#f9a8d4' },
};
// まもる系のバリア色(2026-07-17 阿部さんFB「まもる時のバリアはまだ?」=本番/ラボの守り行にshieldFxを配線。
// 表示側(real_battle/online_battle/battle_lab)のlineWithFxが「守りの体勢に入った！」行で参照する共有マップ)。
const SHIELD_FX_COLOR = { まもる: '#7dd3fc', みきり: '#7dd3fc', ワイドガード: '#60a5fa', ファストガード: '#93c5fd',
  ニードルガード: '#8bd46a', キングシールド: '#f0c420', トーチカ: '#c084fc' };
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
// ===== 変化技演出Phase1(2026-07-16・設計_変化技演出_2026-07-16.md §2): フィールド(グラス/エレキ/
// サイコ/ミストフィールド)の地面演出。setWeatherFxと同じライフサイクル(持続=null解除まで出っぱなし)。
// #field内の#terrain-fx(盤面下半分の帯オーバーレイ)にkind別のCSS背景(グラデ・setWeatherFxの
// boxShadow相当)を乗せ、種類に応じた粒(葉っぱ/スパーク/紫の煙/白ピンクの霧)をsetIntervalで地面から
// 生やし続ける(_fxAutoRemoveで自然消滅=chargeクローン等と同じ後始末パターン)。
// kind: 'grass'|'electric'|'psychic'|'misty'|null(解除)。
const _TERRAIN_FX = { grass: 1, electric: 1, psychic: 1, misty: 1 };
let _terrainFxInterval = null;
function setTerrainFx(kind){
  if (window.__fxTrace) window.__fxTrace.push({k:'setTerrainFx', kind, t: performance.now()});
  const el = $('terrain-fx');
  if (!el) return;
  if (_terrainFxInterval){ clearInterval(_terrainFxInterval); _terrainFxInterval = null; }
  if (!kind || !_TERRAIN_FX[kind]){
    el.classList.remove('live');
    delete el.dataset.terrain;
    el.querySelectorAll('.rb-terrainp').forEach(p => p.remove());
    return;
  }
  el.classList.add('live');
  el.dataset.terrain = kind;
  const spawn = () => {
    const p = document.createElement('div');
    p.className = 'rb-terrainp rb-terrainp-' + kind;
    if (kind === 'grass') p.textContent = '🍃';
    p.style.left = (8 + Math.random() * 84) + '%';
    el.appendChild(p);
    _fxAutoRemove(p, 1700);
  };
  spawn();
  _terrainFxInterval = setInterval(spawn, kind === 'misty' ? 1400 : 650);
}
// ===== エフェクト絵の体系整理(2026-07-16・設計_エフェクト絵の体系整理_2026-07-16.md §2): 新プリミティブ3種 =====
// 「同じ意味=同じ絵」の正典拡張(STATUS_FX/wall/weather/terrainと同じ1本化の作法)。3関数とも純追加=
// 既存関数への影響ゼロ・省略時挙動なし(呼ばれない限り何も起きない)。cue語彙はglyph/shield・glyph/note・glyph/bind
// (_dispatchCueProdへ新action追加のみ・既存cueは1msも不変)。
// A. shieldFx: まもる系(まもる/みきり/ワイドガード/ファストガード/ニードルガード/キングシールド/トーチカ)。
// 本家風の丸っぽい半透明バリアドームが「ポンッ」と展開→軽くふるえ→フェード(計900ms)。
// color省略時=#7dd3fc(まもる基準色)。キングシールド=金/トーチカ=紫等はcueのparams.colorで可変。
function shieldFx(side, color){
  const f = $('f-' + side);
  if (!f) return;
  if (window.__fxTrace) window.__fxTrace.push({k:'shieldFx', side, color, t: performance.now()});
  const c = color || '#7dd3fc';
  const el = document.createElement('div');
  el.className = 'rb-shield';
  // burstFx既存パターン(色+アルファ接尾辞のインライン合成)を踏襲=CSS var文字列結合の罠を踏まない
  el.style.background = `radial-gradient(ellipse at 50% 50%, ${c}66 0%, ${c}33 55%, transparent 78%)`;
  el.style.borderColor = c;
  el.style.boxShadow = `0 0 16px 4px ${c}66`;
  f.appendChild(el);
  _fxAutoRemove(el, 900);
}
// B. noteFx: 音技24統一(flags.sound技)。対象から音符(♪♫交互)が4個、ふわふわ波打ちながら上方向へ
// 飛んでいく(左右にsin揺れ・800ms前後で消える)。色はタイプ色(呼び出し元がinfo.colorを渡す)。
function noteFx(side, color){
  const f = $('f-' + side);
  if (!f) return;
  if (window.__fxTrace) window.__fxTrace.push({k:'noteFx', side, color, t: performance.now()});
  const c = color || '#fbbf24';
  const glyphs = ['♪', '♫', '♪', '♫'];
  for (let i = 0; i < 4; i++){
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'rb-note';
      el.textContent = glyphs[i % glyphs.length];
      el.style.color = c;
      el.style.left = (38 + Math.random() * 24) + '%';
      f.appendChild(el);
      const dx = Math.random() * 30 - 15;
      const rot = Math.random() * 24 - 12;
      const dur = 750 + Math.random() * 120;
      try {
        const anim = el.animate([
          { transform: 'translate(-50%,0) translateY(0) rotate(0deg)', opacity: 0 },
          { transform: `translate(-50%,0) translateY(-16px) translateX(${dx * 0.3}px) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.2 },
          { transform: `translate(-50%,0) translateY(-40px) translateX(${-dx * 0.5}px) rotate(${-rot * 0.6}deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(-50%,0) translateY(-64px) translateX(${dx}px) rotate(${rot}deg)`, opacity: 0 },
        ], { duration: dur, easing: 'ease-in-out' });
        anim.onfinish = () => el.remove();
      } catch (e) {}
      _fxAutoRemove(el, dur + 80);
    }, i * 110);
  }
}
// C. bindFx: 縛り系(バインド状態付与/拘束/自分拘束)。楕円リング2〜3本が対象に巻き付いてキュッと締まる
// (scale 1.4→0.9で縮む・700ms)。色既定#a78bfa(バインド)。拘束(暗色)/自分拘束(緑)等はcueのcolorで可変。
function bindFx(side, color){
  const f = $('f-' + side);
  if (!f) return;
  if (window.__fxTrace) window.__fxTrace.push({k:'bindFx', side, color, t: performance.now()});
  const c = color || '#a78bfa';
  for (let i = 0; i < 3; i++){
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'rb-bindring';
      el.style.borderColor = c;
      el.style.top = (30 + i * 14) + '%';
      f.appendChild(el);
      _fxAutoRemove(el, 700);
    }, i * 70);
  }
}
// ===== 特性発動バナー(2026-07-17・設計_特性・場エフェクト増強_2026-07-17.md §2 P1「本命」) =====
// abilityFx(side, abilityName): 対象側(#f-<side>=既存fxと同じ器)に「⭐ {特性名}」の帯バナーが
// スライドイン→1.1s滞在→フェード(計1.45s)。色=側色ベース(自分=青紫グラデ/相手=紅グラデ。既存
// #pb-self/#pb-oppのグラデ配色と揃える=同じ側色語彙)。i18n: 呼び出し元(lineWithFx)がI18N.ability
// (既存辞書)で表示時翻訳した名前を渡す想定=このプリミティブは文字列をそのまま出すだけ(文を作らない)。
// #pb-<side>(HPボックス本体)には乗せない: .pbox はskewX(-10deg)+子要素counter-skewを持ち、
// アニメのtransform(translateX/scale)が counter-skew を上書きして表示が歪む罠があるため、
// 他の全fx(popText/rankFx/shieldFx等)と同じ$('f-'+side)に統一する(=HPボックスのすぐ外側・同じ側)。
const _ABILITY_FX_CLASS = { self: 'rb-ability-banner-self', opp: 'rb-ability-banner-opp' };
function abilityFx(side, abilityName){
  const f = $('f-' + side);
  if (!f || !abilityName) return;
  if (window.__fxTrace) window.__fxTrace.push({k:'abilityFx', side, abilityName, t: performance.now()});
  const el = document.createElement('div');
  el.className = 'rb-ability-banner ' + (_ABILITY_FX_CLASS[side] || _ABILITY_FX_CLASS.self);
  el.textContent = '⭐ ' + abilityName;
  f.appendChild(el);
  _fxAutoRemove(el, 1450);
  SE.status();   // SE.status系の短い音(設計§2指定)
}
// ===== P2: 設置物の常駐ミニアイコン(2026-07-18・設計_特性・場エフェクト増強_2026-07-17.md §4) =====
// hazardFx(side, kind, count): 対象側(#f-<side>)の地面端に設置物の小アイコンを常駐させる。
// kind: 'rock'(ステルスロック🪨・常に1個)/'spikes'(まきびし△・層数分1〜3個)/'toxic'(どくびし☠・1〜2個)/
// 'web'(ねばねばネット🕸・1個)。count=0でそのkindだけ消す(どくびし吸収=どくびしのみ消える)。
// 器=.rb-hazards(#f-<side>直下の常駐コンテナ)。renderAll等は.sprite内しか触らないので再描画に耐える
// (壁パネルのclass常駐と同じ寿命設計)。消滅=clearHazardFx(側全消し・こうそくスピン系)/バトル開始は
// 呼び出し元(startBattle)がclearHazardFxを両側に呼ぶ。控えめサイズ・pointer-events:noneはCSS側(.rb-hazards)。
const _HAZARD_ICON = { rock: '🪨', spikes: '△', toxic: '☠', web: '🕸' };
function hazardFx(side, kind, count){
  const f = $('f-' + side);
  if (!f || !_HAZARD_ICON[kind]) return;
  if (window.__fxTrace) window.__fxTrace.push({k:'hazardFx', side, kind, count, t: performance.now()});
  let box = f.querySelector('.rb-hazards');
  if (!box){
    box = document.createElement('div');
    box.className = 'rb-hazards';
    f.appendChild(box);
  }
  // このkindのアイコン群を作り直す(まきびし1→2層等の層数変化に追従。他kindのアイコンは触らない)
  box.querySelectorAll('.rb-hazard-' + kind).forEach(el => el.remove());
  const n = Math.max(0, Math.min(3, count == null ? 1 : count));
  for (let i = 0; i < n; i++){
    const el = document.createElement('span');
    el.className = 'rb-hazard rb-hazard-' + kind;
    el.textContent = _HAZARD_ICON[kind];
    box.appendChild(el);
  }
}
// その側の設置物アイコンを全消し(こうそくスピン/キラースピンの「設置物が 消えた！」・バトル開始/リセット)
function clearHazardFx(side){
  const f = $('f-' + side);
  if (!f) return;
  if (window.__fxTrace) window.__fxTrace.push({k:'clearHazardFx', side, t: performance.now()});
  const box = f.querySelector('.rb-hazards');
  if (box) box.innerHTML = '';
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
  // class:(タイプ非依存の大分類の共通デフォルト・2026-07-16 阿部さん「全物理技をフレアドライブ基準で統一」)。
  // 「物理・接触=殴ってぶつかる系」(atk=charge突進)/「物理・非接触=飛翔体」(atk=projectile)/
  // 「特殊=ビーム」(atk=beam)の3class(ステップ2で phys_ranged/special を追加・2026-07-16)。
  // 変化技等は対象外(class無し=フォールバック無し=従来の自動演出のまま)。move:個別上書きが最優先。
  const clsKey = _cueClassKey(mv);
  if (clsKey){
    const byClass = map['class:' + clsKey];
    if (byClass && byClass.done === true) return byClass;
  }
  return null;
}
// ★変化技Phase2(2026-07-18・設計_変化技演出_2026-07-16.md §2 Phase2): 変化技用のシート解決。
// resolveCueSheet(攻撃技用)と違い move:個別のみ(pattern:/class:フォールバック無し)=
// 「調整した技だけ変わる安全設計」(設計§2 Phase2の指定)。done===trueのみ採用も同じ。
// 現状done:trueの変化技シートは未作成=常にnull=呼び出し側は従来の正規表現fx経路のまま(完全不変)。
function resolveStatusCueSheet(mv){
  const map = window.BATTLE_FX_CUES;
  if (!mv || !map) return null;
  const sheet = map['move:' + mv.name];
  return (sheet && sheet.done === true) ? sheet : null;
}
// 技→大分類キー(class:の後半)。物理・接触='phys_contact'/物理・非接触='phys_ranged'/特殊='special'。
// それ以外(変化技等)は空文字=classフォールバック無し。
function _cueClassKey(mv){
  if (mv.category === '物理') return mv.contact === true ? 'phys_contact' : 'phys_ranged';
  if (mv.category === '特殊') return 'special';
  return '';
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
// fx_editor.htmlのdispatchCue()は本関数(_dispatchCueProd経由)へ完全委譲しているため、エディタと本番は
// 同一コードパス(重複実装なし)。アニメの中身(移動量・easing・cleanup)はエディタ/本番で分岐しない。
// impactFrac/dwellFrac/reachFrac/easing(2026-07-15・設計_演出ツクール本格化_2026-07-15.md §2-3・
// 不満C「突進の調整」): paramsから読む。全て省略時=現行値(0.55/0.62/0.85/standard)=旧挙動と完全一致。
const _CHARGE_EASING = {
  standard: 'cubic-bezier(.3,0,.2,1)',   // 現行(既定)
  sharp: 'cubic-bezier(.5,0,.15,1)',     // 鋭く踏み込む
  heavy: 'cubic-bezier(.7,.05,.3,1)',    // 重い助走
};
function _cueChargeMotionProd(atkSide, tgtSide, dur, params){
  const sp = document.querySelector('#f-' + atkSide + ' .sprite');
  if (!sp || typeof sp.animate !== 'function') return;
  const p = params || {};
  let impactFrac = p.impactFrac != null ? p.impactFrac : 0.55;
  impactFrac = Math.min(0.98, Math.max(0.1, impactFrac));
  let dwellFrac = p.dwellFrac != null ? p.dwellFrac : 0.62;
  if (!(dwellFrac > impactFrac && dwellFrac < 1)) dwellFrac = Math.min(0.999, impactFrac + 0.07);
  let reachFrac = p.reachFrac != null ? p.reachFrac : 0.85;
  reachFrac = Math.min(1.2, Math.max(0.3, reachFrac));
  const chargeEasing = _CHARGE_EASING[p.easing] || _CHARGE_EASING.standard;
  const from = fxPoint(atkSide), to = fxPoint(tgtSide);
  const hitFrac = reachFrac;
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
  // 2026-07-16(段階B): スクラブで止めた静止画はクローンが本体の代わりに見えている状態なので、
  // __FX_SCRUB__が真の間はcleanup(クローン除去+本体sprite可視化)を丸ごとスキップする(=静止画を保つ)。
  // フラグはfx_editor.htmlのresetPreviewPositions()の頭で必ずfalseに戻る(=次のスクラブ/リセット/
  // 再生開始/技切替で本掃除される)ので、doneを立てずに素通りしても取り残しにはならない。
  const cleanup = () => { if (window.__FX_SCRUB__) return; if (done) return; done = true; try { clone.remove(); } catch (e) {} sp.style.visibility = ''; };
  setTimeout(cleanup, dur + 300);
  try {
    const anim = clone.animate([
      { transform: `translate(0,0) scale(${scale})`, offset: 0 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, offset: impactFrac },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, offset: dwellFrac },
      { transform: `translate(0,0) scale(${scale})`, offset: 1 },
    ], { duration: Math.max(80, dur), easing: chargeEasing });
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
      // cue.dur(2026-07-16 阿部さん): キューシートにdurがあれば発射→着弾の飛翔尺として渡す
      // (spawnProjectile/spawnBeamの末尾省略可能引数。無ければundefinedのまま渡り従来どおり190/180固定)。
      if (cue.action === 'projectile') spawnProjectile(fxPoint(info.atkSide), fxPoint(info.tgtSide), cls, color, 1, shape, cue.dur);
      else if (cue.action === 'beam') spawnBeam(fxPoint(info.atkSide), fxPoint(info.tgtSide), cls, color, 1, shape, cue.dur);
      else if (cue.action === 'charge') _cueChargeMotionProd(info.atkSide, info.tgtSide, cue.dur, p);
    } else if (cue.track === 'glyph' && cue.action === 'burst'){
      // sizeScale(2026-07-15・設計_ツクール強化_炎サイズ配線とスクラブ_2026-07-15.md §2-1): 見た目倍率。
      // clamp(0.1〜6)=SSOT残存値(scale:100等)や入力事故で画面が壊れるのを防ぐ。省略時=1=従来どおり。
      // offsetは--fx-ox/--fx-oyをburstFx側で毎回セット(レガシー経路へのリーク防止・burstFx冒頭コメント参照)。
      // particles(2026-07-15・設計_演出ツクール本格化_2026-07-15.md §2-2): clamp(0〜24)。省略時=undefined=
      // burstFx側でintensity由来のnのまま(従来どおり)。
      const sizeScale = p.scale != null ? Math.min(6, Math.max(0.1, p.scale)) : 1;
      const particles = p.particles != null ? Math.min(24, Math.max(0, p.particles)) : undefined;
      burstFx(atSide, color, shape, p.intensity || 'normal', cue.dur, sizeScale, p.offset, particles);
    } else if (cue.track === 'glyph' && cue.action === 'rank'){
      // 変化技演出Phase1(2026-07-16): 能力ランク変化(つるぎのまい等)。up省略時=true(上昇)扱い=
      // 未指定でも矢印だけは出る安全側デフォルト(自動生成は必ずup/stageを明示するので実運用では常に指定される)。
      rankFx(atSide, p.up !== false, Math.min(3, Math.max(1, p.stage || 1)));
    } else if (cue.track === 'glyph' && cue.action === 'sparkle'){
      sparkleFx(atSide);   // 変化技演出Phase1: 回復(じこさいせい等)のキラキラ
    } else if (cue.track === 'glyph' && cue.action === 'wall'){
      // 変化技演出Phase1: 壁設置(リフレクター/ひかりのかべ/オーロラベール)。show省略時=true(張る)。
      if (p.show !== false) showWallFx(atSide, p.name); else hideWallFx(atSide, p.name);
    } else if (cue.track === 'glyph' && cue.action === 'terrain'){
      setTerrainFx(p.kind || null);   // 変化技演出Phase1: フィールド展開(グラス/エレキ/サイコ/ミスト)
    } else if (cue.track === 'glyph' && cue.action === 'weather'){
      setWeatherFx(p.kind || null);   // 変化技演出Phase1: 天候変化(あまごい等)。scene側と同形をmove側にも
    } else if (cue.track === 'glyph' && cue.action === 'shield'){
      shieldFx(atSide, p.color);   // エフェクト絵の体系整理(2026-07-16)新規A: まもる系バリアドーム
    } else if (cue.track === 'glyph' && cue.action === 'note'){
      noteFx(atSide, p.color || info.color);   // 新規B: 音技24統一の音符ウェーブ
    } else if (cue.track === 'glyph' && cue.action === 'bind'){
      bindFx(atSide, p.color || info.color);   // 新規C: 縛り系の巻き付きリング
    } else if (cue.track === 'sound' && cue.action === 'se'){
      // 変化技演出Phase1: p.nameがあればSE[name]()(scene側_dispatchSceneCueProdと同形=rankUp/rankDown等の
      // 専用SEを鳴らせる)。p.name無し=従来どおりSE.hitClass(cls)(攻撃技の後方互換=1msも変えない)。
      if ('name' in p){ if (SE[p.name]) SE[p.name](); } else SE.hitClass(cls);
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
      // size clamp(8〜96)・holdMs/fadeMs/rise(2026-07-15・設計_演出ツクール本格化_2026-07-15.md §2-1)は
      // いずれか指定時のみpopOptsを渡す(popText側のWAAPI切替条件と同じ=undefined透過で従来経路を保つ)。
      const sz = p.size != null ? Math.min(96, Math.max(8, p.size)) : 16;
      const popOpts = (p.holdMs != null || p.fadeMs != null || p.rise != null) ? { holdMs: p.holdMs, fadeMs: p.fadeMs, rise: p.rise } : undefined;
      // ★実ダメージが無い再生(まもる/ばけのかわ等の技告知行でのcue再生=呼び出し側がdmgText:nullを明示)は
      // popnumを出さない(2026-07-17 阿部さんFB: 防がれたのに見本値−42が出て驚く。ポップは常に「実際に
      // 与えた数字」だけ=通常攻撃はsimの計算済み実ダメージ行から取るので従来どおり)。
      // エディタのプレビューはdmgText未定義(undefined)=従来どおりp.textの見本を出す(nullと区別)。
      if (info.dmgText === null) { if (info.onDef) info.onDef(atSide); return; }
      // ★変化技Phase2(2026-07-18・設計_変化技演出_2026-07-16.md §2 Phase2の必須条件): popnumの固定文言は
      // 生ja直書き(p.text)でなく p.textKey(i18nキー・'fxcue.'名前空間)で持ち、表示時にI18N.tで解決する
      // (i18n-first。popは一過性1秒=言語切替の再翻訳は不要)。textKey無し=従来どおりp.text(既存の攻撃技
      // シート/エディタプレビューは1msも不変=後方互換)。数字・記号だけのtext(＋/−42等)は言語非依存なので
      // textのままで可(設計§2の指定)。ja正文はI18N.tの第2引数(フォールバック)としてp.textに残す。
      const _cueTxt = p.textKey
        ? ((window.I18N && window.I18N.t) ? window.I18N.t('fxcue.' + p.textKey, p.text || '') : (p.text || ''))
        : (p.text || '');
      popText(atSide, info.dmgText != null ? info.dmgText : _cueTxt, p.color || '#fff', sz, null, cue.dur, popOpts);
      if (info.onDef) info.onDef(atSide);
    }
  } catch (e) { console.error('[playCueSheet dispatch error]', cue, e); }
}
// playCueSheet(sheet, ctx): 本番cuePlayer本体。キューシートのcues[]をタイミングどおり一括setTimeout予約する。
// ctx = {atkSide, tgtSide, mv, color, dmgText, hitCls}。戻り値=着弾拍ms(_cueImpactTime。呼び出し側の
// 「_hitFxDelay」契約=従来のattackFx/chargeFxの戻り値と同じ役割で使う=こうか/急所行の同拍合流に流用可能)。
// __board(エディタの立ち位置)は見ない=本番の配置は本番のまま(設計4章の指定どおり)。
// ctx.scale(2026-07-16連続技演出): 省略時=undefined→1扱い=既存呼び出しは1msも変わらない(不変)。
// 連続技の各ヒットはlineWithFxが0.4前後を渡し、キューのt(スケジュール)とdur(各アクションの尺)を
// まとめて縮める(_dispatchCueProd自体は無改変=個々のプリミティブの意味は変えず時間だけ圧縮)。
function playCueSheet(sheet, ctx){
  ctx = ctx || {};
  const scale = ctx.scale != null ? ctx.scale : 1;
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
    const c = scale !== 1 ? Object.assign({}, cue, {
      t: Math.round((cue.t || 0) * scale),
      dur: cue.dur != null ? Math.round(cue.dur * scale) : cue.dur,
    }) : cue;
    setTimeout(() => _dispatchCueProd(c, info), Math.max(0, c.t || 0));
  });
  return scale !== 1 ? Math.round(_cueImpactTime(sheet) * scale) : _cueImpactTime(sheet);
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
      _megaStepClimax(side, f, sp, p.color);
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
