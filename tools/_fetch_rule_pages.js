#!/usr/bin/env node
/**
 * _fetch_rule_pages.js — ポケモンWikiの「ルールページ」を収集する(技/特性/持ち物の個別ページとは別)
 *
 * なぜ要るか: ★例外は技ページでなくルールページに書かれている(2026-07-28実証)。
 *   例=ドラゴンアローの「2体攻撃でも威力が落ちない」は「ダブルバトル」ページにあった。
 *   ルールページに名指しされた技/特性=そのルールの例外 → 索引化すると特殊機構が機械で炙り出せる。
 *
 * 使い方: node tools/_fetch_rule_pages.js
 * 出力:   reference/_authority_corpus/rules/<ページ名>.json(技ページと同じ形式)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'reference', '_authority_corpus', 'rules');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DELAY = Number(process.env.FETCH_DELAY_MS || 1500);

// バトルの「ルール」を定めているページ(技/特性/持ち物の個別ページ以外)
const EXTRA = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT,'reference/_state_change_pages.json'),'utf8')).map(n => n + ' (状態変化)'); } catch(e){ return []; } })();
// ★「◯◯ (状態変化)」= 技が作る持続状態の専用ページ。技ページには「詳細は◯◯(状態変化)を参照」としか
//   書かれておらず、技ページだけ読んでいては辿り着けない(2026-07-28 阿部さんの指摘で発見)。
//   §19「時間軸が2本ある」の個体側の状態の一次資料。
const PAGES = [
  // 全体の仕組み
  'ポケモンバトル', 'ダブルバトル', 'ターン', '行動順', 'すばやさ', '優先度',
  // ダメージ計算
  'ダメージ', '威力', '命中', '急所', 'タイプ相性', 'タイプ一致ボーナス', '乱数',
  // 技の性質
  '技', '連続攻撃', '直接攻撃', '音technique'.replace('technique','の技'), 'まもる', 'みがわり',
  'ため技', '反動', '固定ダメージ', '一撃必殺技', '変化技',
  // 状態
  '状態異常', 'こんらん', 'ねむり', 'まひ', 'どく', 'やけど', 'こおり', 'ひんし',
  'ランク補正', 'バインド状態', 'ちょうはつ', 'アンコール',
  // 場
  '天気', 'フィールド', 'リフレクター', 'ひかりのかべ', 'ステルスロック', 'トリックルーム',
  // 機構
  'とくせい', 'どうぐ', 'ポケモンチェンジ', 'メガシンカ', 'テラスタル',
].concat(EXTRA);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function extract(html) {
  const bodyM = html.match(/<div[^>]+class="[^"]*mw-parser-output[^"]*"[\s\S]*?(?=<div[^>]+class="printfooter"|<div[^>]+id="catlinks")/);
  let body = bodyM ? bodyM[0] : html;
  body = body.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const parts = body.split(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/);
  const dec = s => s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (e[0] === '#') { const c = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) ? String.fromCodePoint(c) : m; }
    return map[e] !== undefined ? map[e] : m;
  });
  const clean = s => dec(String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|tr|div|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '・').replace(/<t[dh][^>]*>/gi, ' | ').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const sections = {};
  const intro = clean(parts[0]);
  for (let i = 1; i < parts.length; i += 3) {
    const h = clean(parts[i + 1]).replace(/\[編集\]/g, '').trim();
    if (h) sections[h] = clean(parts[i + 2] || '');
  }
  const raw_text = [intro, ...Object.entries(sections).map(([h, c]) => `== ${h} ==\n${c}`)].join('\n\n').trim();
  return { intro, sections, raw_text };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let ok = 0, ng = [];
  for (let i = 0; i < PAGES.length; i++) {
    const title = PAGES[i];
    const file = path.join(OUT, title.replace(/[\/\\]/g, '_') + '.json');
    if (fs.existsSync(file)) { ok++; continue; }                     // 再開可能
    try {
      const res = await fetch('https://wiki.pokemonwiki.com/wiki/' + encodeURIComponent(title),
        { headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.9' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const ex = extract(await res.text());
      fs.writeFileSync(file, JSON.stringify({ title, url: 'https://wiki.pokemonwiki.com/wiki/' + title, fetched_at: new Date().toISOString(), ...ex }, null, 1));
      ok++;
    } catch (e) { ng.push(`${title}: ${e.message}`); }
    if (i < PAGES.length - 1) await sleep(DELAY);
  }
  console.log(`ルールページ: ok ${ok} / ng ${ng.length}`);
  if (ng.length) console.log('  失敗:', ng.join(' / '));
})();
