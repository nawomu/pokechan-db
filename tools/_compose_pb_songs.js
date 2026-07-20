// PB曲ジェネレータ: AbletonMCPソケット(9877)へ直接コマンド送信で9曲(シーン2〜10)を打ち込む
// 全曲オリジナル。トラック: 0=Drums(909) 1=Bass(Drift) 2=Chords(Drift) 3=Lead(Operator)
const net = require('net');

function send(cmd) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(9877, 'localhost');
    let buf = '';
    sock.on('connect', () => sock.write(JSON.stringify(cmd)));
    sock.on('data', d => {
      buf += d.toString();
      try { const j = JSON.parse(buf); sock.end(); resolve(j); } catch (e) { /* 続きを待つ */ }
    });
    sock.on('error', reject);
    setTimeout(() => { try { sock.destroy(); } catch (e) {} ; reject(new Error('timeout')); }, 15000);
  });
}

// ===== 音楽部品 =====
const N = (pitch, start, dur, vel) => ({ pitch, start_time: start, duration: dur, velocity: vel });
// コード辞書: ルートMIDI(3オクターブ帯)と構成音
const CH = {
  Am: [57, 60, 64], F: [53, 57, 60], G: [55, 59, 62], Em: [52, 55, 59], E: [52, 56, 59],
  C: [48, 52, 55], Dm: [50, 53, 57], Bm: [47, 50, 54], D: [50, 54, 57], A: [45, 49, 52],
  Bb: [46, 50, 53], Gm: [43, 46, 50], FM: [53, 57, 60], B: [47, 51, 54], Cm: [48, 51, 55],
};
const ROOT = { Am: 45, F: 41, G: 43, Em: 40, E: 40, C: 36, Dm: 38, Bm: 35, D: 38, A: 45, Bb: 34, Gm: 31, B: 35, Cm: 36 };
// スケール(リード用・ルートからの度数)
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

// 決定的疑似乱数(曲ごとにシード)
function rng(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

// ドラム生成: style = drive | halftime | four | breaky | sparse
function drums(style, r) {
  const notes = [];
  const K = 36, S = 38, CHH = 42, OH = 46, CR = 49;
  notes.push(N(CR, 0, 1, 115)); notes.push(N(CR, 32, 1, 112));
  for (let b = 0; b < 64; b++) {
    if (style === 'drive') { notes.push(N(K, b, 0.25, b % 2 ? 105 : 110)); if (b % 2 === 1) notes.push(N(S, b, 0.25, 106)); }
    if (style === 'four') { notes.push(N(K, b, 0.25, 108)); if (b % 4 === 2) notes.push(N(S, b, 0.25, 104)); }
    if (style === 'halftime') { if (b % 4 === 0 || (b % 8 === 5)) notes.push(N(K, b, 0.25, 110)); if (b % 4 === 2) notes.push(N(S, b, 0.25, 108)); }
    if (style === 'breaky') { if (b % 4 === 0 || b % 4 === 2.5 || (b % 8 === 3)) notes.push(N(K, b, 0.25, 108)); if (b % 2 === 1) notes.push(N(S, b, 0.25, 104)); if (r() < 0.2) notes.push(N(K, b + 0.75, 0.2, 92)); }
    if (style === 'sparse') { if (b % 2 === 0) notes.push(N(K, b, 0.25, 104)); if (b % 4 === 2) notes.push(N(S, b, 0.25, 98)); }
  }
  const hatEvery = style === 'sparse' ? 1 : 0.5;
  for (let t = 0.5; t < 64; t += hatEvery) {
    if (Math.abs(t % 16 - 15.5) < 0.01) notes.push(N(OH, t, 0.4, 92));
    else notes.push(N(CHH, t, 0.2, style === 'drive' ? 86 : 80));
  }
  for (const base of [30.5, 62.5]) for (let i = 0; i < 5; i++) notes.push(N(S, base + i * 0.25 + (i > 1 ? 0.25 : 0), 0.2, 85 + i * 5));
  return notes;
}

// ベース生成: pattern = pump8 | octave | offbeat | walk
function bass(prog, pattern, r) {
  const notes = [];
  prog.forEach((ch, bar) => {
    const root = ROOT[ch]; const t0 = bar * 4;
    if (pattern === 'pump8') for (let i = 0; i < 8; i++) notes.push(N(root, t0 + i * 0.5, 0.42, i === 0 ? 110 : 96));
    if (pattern === 'octave') for (let i = 0; i < 8; i++) notes.push(N(i % 2 ? root + 12 : root, t0 + i * 0.5, 0.4, i % 2 ? 92 : 106));
    if (pattern === 'offbeat') { notes.push(N(root, t0, 0.7, 110)); for (const off of [1.5, 2.5, 3.5]) notes.push(N(root, t0 + off, 0.4, 96)); }
    if (pattern === 'walk') { const fifth = root + 7; [0, 1, 2, 3].forEach((i) => notes.push(N([root, root, fifth, root + (r() < 0.5 ? 3 : 5)][i], t0 + i, 0.9, i === 0 ? 108 : 98))); }
  });
  return notes;
}

// コード生成: stab | pad | pulse
function chords(prog, style) {
  const notes = [];
  prog.forEach((ch, bar) => {
    const v = CH[ch]; const t0 = bar * 4;
    if (style === 'stab') { for (const p of v) { notes.push(N(p, t0, 2, 94)); notes.push(N(p, t0 + 2.5, 1, 84)); } }
    if (style === 'pad') for (const p of v) notes.push(N(p, t0, 3.8, 82));
    if (style === 'pulse') for (let i = 0; i < 8; i++) if (i !== 3 && i !== 7) for (const p of v) notes.push(N(p + 12, t0 + i * 0.5, 0.3, i % 2 ? 76 : 88));
  });
  return notes;
}

// リード生成: モチーフベース(曲ごとの音列+リズムテンプレをスケールに合わせて)
function lead(prog, scaleName, tonic, r, style) {
  const sc = SCALES[scaleName]; const notes = [];
  const deg = (oct, d) => tonic + 12 * oct + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  // 2小節モチーフ×バリエーション。styleごとにリズム変化
  for (let ph = 0; ph < 8; ph++) {
    const t0 = ph * 8; const base = 2; // オクターブ帯
    const shape = [0, 1, 2, 4, 4, 3, 2, 4, 5, 4, 2, 0].map(d => d + (ph % 4 === 3 ? 2 : 0));
    if (style === 'run16') {
      for (let i = 0; i < 8; i++) notes.push(N(deg(base, shape[i % shape.length] + Math.floor(r() * 2)), t0 + i * 0.25, 0.22, 96 + (i % 4 === 0 ? 10 : 0)));
      notes.push(N(deg(base, 4 + (ph % 3)), t0 + 2, 1.8, 108));
      notes.push(N(deg(base, 2 + (ph % 2)), t0 + 4, 1.4, 100));
      notes.push(N(deg(base, ph % 2 ? 5 : 3), t0 + 5.5, 0.45, 100));
      notes.push(N(deg(base, ph % 2 ? 4 : 2), t0 + 6, 1.9, 104));
    } else if (style === 'anthem') {
      notes.push(N(deg(base, 0 + ph % 2), t0, 1.4, 104)); notes.push(N(deg(base, 2 + ph % 2), t0 + 1.5, 0.45, 100));
      notes.push(N(deg(base, 4), t0 + 2, 1.9, 110)); notes.push(N(deg(base, 3), t0 + 4, 0.95, 100));
      notes.push(N(deg(base, 2), t0 + 5, 0.95, 98)); notes.push(N(deg(base, ph % 4 === 3 ? 7 : 4), t0 + 6, 1.9, 108));
    } else { // bounce
      const seq = [0, 2, 4, 2, 5, 4, 2, 1];
      seq.forEach((d, i) => notes.push(N(deg(base, d + (ph % 2)), t0 + i * 0.75, 0.4, 92 + (i % 2 ? 0 : 10))));
      notes.push(N(deg(base, 4), t0 + 6, 1.9, 104));
    }
  }
  return notes;
}

// ===== 曲定義(9曲・シーン2〜10) =====
const SONGS = [
  { name: 'PB Gym Boss', prog: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'D', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'B', 'B'], scale: 'minor', tonic: 64, drums: 'halftime', bass: 'octave', ch: 'stab', lead: 'anthem', seed: 2 },
  { name: 'PB Victory', prog: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C', 'C'], scale: 'major', tonic: 60, drums: 'four', bass: 'walk', ch: 'stab', lead: 'anthem', seed: 3 },
  { name: 'PB Lab', prog: ['Dm', 'Dm', 'G', 'G', 'Dm', 'Dm', 'G', 'G', 'F', 'G', 'Dm', 'Dm', 'F', 'G', 'A', 'A'], scale: 'dorian', tonic: 62, drums: 'breaky', bass: 'offbeat', ch: 'pulse', lead: 'bounce', seed: 4 },
  { name: 'PB Online Lobby', prog: ['FM', 'FM', 'G', 'G', 'Am', 'Am', 'G', 'G', 'FM', 'G', 'Am', 'Am', 'FM', 'G', 'C', 'C'], scale: 'lydian', tonic: 65, drums: 'sparse', bass: 'offbeat', ch: 'pad', lead: 'bounce', seed: 5 },
  { name: 'PB Final Showdown', prog: ['Bm', 'Bm', 'G', 'A', 'Bm', 'Bm', 'G', 'A', 'G', 'A', 'F', 'Bm', 'G', 'A', 'B', 'B'], scale: 'minor', tonic: 59, drums: 'drive', bass: 'pump8', ch: 'stab', lead: 'run16', seed: 6 },
  { name: 'PB Retro Chip', prog: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'], scale: 'minor', tonic: 69, drums: 'drive', bass: 'octave', ch: 'pulse', lead: 'run16', seed: 7 },
  { name: 'PB Rain Battle', prog: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'], scale: 'minor', tonic: 62, drums: 'four', bass: 'pump8', ch: 'pad', lead: 'anthem', seed: 8 },
  { name: 'PB Champion', prog: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'G', 'C', 'D', 'G', 'Em', 'C', 'D', 'G', 'G'], scale: 'major', tonic: 67, drums: 'drive', bass: 'walk', ch: 'stab', lead: 'anthem', seed: 9 },
  { name: 'PB Sunny Day', prog: ['A', 'D', 'E', 'A', 'A', 'D', 'E', 'A', 'D', 'E', 'A', 'A', 'D', 'E', 'E', 'E'], scale: 'major', tonic: 69, drums: 'breaky', bass: 'octave', ch: 'pulse', lead: 'bounce', seed: 10 },
];

async function addNotesChunked(track, clip, notes) {
  for (let i = 0; i < notes.length; i += 80) {
    const res = await send({ type: 'add_notes_to_clip', params: { track_index: track, clip_index: clip, notes: notes.slice(i, i + 80) } });
    if (res.status !== 'success' && !JSON.stringify(res).includes('Added')) throw new Error('add_notes failed: ' + JSON.stringify(res).slice(0, 200));
  }
}

(async () => {
  // シーンを10行に増やす(現状8想定)
  for (let i = 0; i < 4; i++) { try { await send({ type: 'create_scene', params: { index: -1 } }); } catch (e) {} }
  for (let s = 0; s < SONGS.length; s++) {
    const song = SONGS[s]; const slot = s + 1; const r = rng(song.seed * 99991);
    for (let tr = 0; tr < 4; tr++) {
      try { await send({ type: 'delete_clip', params: { track_index: tr, clip_index: slot } }); } catch (e) {}
      const res = await send({ type: 'create_clip', params: { track_index: tr, clip_index: slot, length: 64 } });
      if (JSON.stringify(res).includes('error') && !JSON.stringify(res).includes('Created')) console.log('create warn', tr, slot, JSON.stringify(res).slice(0, 120));
    }
    await addNotesChunked(0, slot, drums(song.drums, r));
    await addNotesChunked(1, slot, bass(song.prog, song.bass, r));
    await addNotesChunked(2, slot, chords(song.prog, song.ch));
    await addNotesChunked(3, slot, lead(song.prog, song.scale, song.tonic, r, song.lead));
    await send({ type: 'set_clip_name', params: { track_index: 0, clip_index: slot, name: song.name + ' Drums' } });
    await send({ type: 'set_clip_name', params: { track_index: 3, clip_index: slot, name: song.name + ' Lead' } });
    console.log('DONE scene', slot + 1, song.name);
  }
  console.log('ALL 9 SONGS WRITTEN');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
