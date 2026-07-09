#!/usr/bin/env node
// メガ進化スプライトに「漫画の太陽みたいなバーン放射背景」を注入する(2026-06-12 阿部さん指示)
// 対象: images/sim/メガ*.svg(ただし「メガニウム」はメガ進化ではないので除外。「メガメガニウム」は対象)
// 冪等: id="mega-burst" が既にあればスキップ。--write で書き込み(無指定=dry-run)
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'images', 'sim');
const WRITE = process.argv.includes('--write');

// 16本の放射ウェッジ(交互配色)+土台の淡い円。中心(180,180)・viewBox外までのばして全面に
function burstGroup() {
  const cx = 180, cy = 180, R = 270;
  let parts = [`<circle cx="${cx}" cy="${cy}" r="172" fill="#fff3c0"/>`];
  for (let i = 0; i < 16; i++) {
    const a0 = (i * 22.5) * Math.PI / 180;
    const a1 = (i * 22.5 + 11.25) * Math.PI / 180;
    const x0 = (cx + R * Math.cos(a0)).toFixed(1), y0 = (cy + R * Math.sin(a0)).toFixed(1);
    const x1 = (cx + R * Math.cos(a1)).toFixed(1), y1 = (cy + R * Math.sin(a1)).toFixed(1);
    const fill = i % 2 === 0 ? '#ffd96b' : '#ffb13d';
    parts.push(`<polygon points="${cx},${cy} ${x0},${y0} ${x1},${y1}" fill="${fill}"/>`);
  }
  // 中心がうるさくならないように淡い円をもう1枚かぶせる
  parts.push(`<circle cx="${cx}" cy="${cy}" r="120" fill="#fff3c0" opacity="0.55"/>`);
  return `<g id="mega-burst">${parts.join('')}</g>`;
}

// メガヤンマ(ヤンマの進化系)もメガ進化ではないので除外(2026-07-10 全国版で追加されたため)
const NOT_MEGA = new Set(['メガニウム.svg', 'メガヤンマ.svg']);
const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.svg') && f.startsWith('メガ') && !NOT_MEGA.has(f));

let added = 0, skipped = 0;
for (const f of files) {
  const p = path.join(DIR, f);
  const src = fs.readFileSync(p, 'utf8');
  if (src.includes('id="mega-burst"')) { skipped++; continue; }
  const m = src.match(/<svg[^>]*>/);
  if (!m) { console.error('NO <svg> TAG:', f); continue; }
  const out = src.replace(m[0], m[0] + '\n' + burstGroup());
  if (WRITE) fs.writeFileSync(p, out);
  added++;
}
console.log(`${WRITE ? 'WROTE' : 'DRY-RUN'}: burst追加=${added} スキップ(既存)=${skipped} 対象計=${files.length}`);
