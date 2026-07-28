#!/usr/bin/env node
/**
 * _fetch_authority_corpus.js — ポケモンWiki(権威ソース)の原文をローカルに収集する
 *
 * 設計: 設計_権威コーパス構築_2026-07-28.md
 * 用途: 内部参照専用(仕様確認・引用の実在検証・テスト期待値の根拠)。再配布しない。
 *       うちの説明文は独自作成のまま(北極星: verbatim一致は盗用リスク)=コピー元にしない。
 *
 * ★取得経路の実測(2026-07-28): 既定UAのcurl/fetchはCloudflareで403。
 *   ブラウザUAを付けると200で通る → LLM不要・純スクリプトで収集できる(コストゼロ)。
 *
 * 使い方:
 *   node tools/_fetch_authority_corpus.js --kind=moves --limit=30      # パイロット
 *   node tools/_fetch_authority_corpus.js --kind=moves                 # 全件(resumable)
 *   node tools/_fetch_authority_corpus.js --kind=abilities|items
 *   環境変数: FETCH_DELAY_MS(既定1500・相手サーバへの礼儀。下げすぎない)
 *
 * 中断・枠切れがあっても _index.json から再開する(取得済みはスキップ)。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORPUS = path.join(ROOT, 'reference', '_authority_corpus');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DELAY = Number(process.env.FETCH_DELAY_MS || 1500);

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true];
}));
const kind = args.kind || 'moves';
const limit = args.limit ? Number(args.limit) : Infinity;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(title) {
  const url = 'https://wiki.pokemonwiki.com/wiki/' + encodeURIComponent(title);
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.9' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return { url, html: await res.text() };
}

/** HTML → セクション分割 + 全文テキスト(引用照合の正典) */
function extract(html) {
  // 本文領域だけを対象にする(ナビ/フッタを除外)
  const bodyM = html.match(/<div[^>]+class="[^"]*mw-parser-output[^"]*"[\s\S]*?(?=<div[^>]+class="printfooter"|<div[^>]+id="catlinks")/);
  let body = bodyM ? bodyM[0] : html;

  body = body
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<table[^>]*class="[^"]*(navbox|infobox-nav)[^"]*"[\s\S]*?<\/table>/g, '');

  // 見出しを目印にセクション分割
  const parts = body.split(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/);
  const sections = {};
  const clean = s => decodeEntities(
    String(s)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|tr|div|h[1-6])>/gi, '\n')
      .replace(/<li[^>]*>/gi, '・')
      .replace(/<t[dh][^>]*>/gi, ' | ')
      .replace(/<[^>]+>/g, '')
  ).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  let intro = clean(parts[0]);
  for (let i = 1; i < parts.length; i += 3) {
    const heading = clean(parts[i + 1]).replace(/\[編集\]/g, '').trim();
    const content = clean(parts[i + 2] || '');
    if (heading) sections[heading] = content;
  }
  const raw_text = [intro, ...Object.entries(sections).map(([h, c]) => `== ${h} ==\n${c}`)].join('\n\n').trim();
  return { intro, sections, raw_text };
}

function decodeEntities(s) {
  const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return map[e] !== undefined ? map[e] : m;
  });
}

/** 収集対象の名前一覧をうちのSSOTから作る(=うちが持っているものだけ取る) */
function targets(kind) {
  const sandbox = { window: {}, document: { addEventListener() {} } };
  const vm = require('vm');
  const ctx = vm.createContext(sandbox);
  const load = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  if (kind === 'moves') {
    load('pokechan_data_all.js');
    // ★const/let はvmコンテキストのグローバルに載らない(既知の罠)。同一コンテキストで評価して取り出す。
    const map = vm.runInContext('typeof WAZA_MAP !== "undefined" ? WAZA_MAP : (typeof window!=="undefined" && window.WAZA_MAP) || {}', ctx);
    // 日本語名(name)がWikiのページ名。キーは英語スラグなので使わない。
    return [...new Set(Object.values(map || {}).map(m => m && m.name).filter(Boolean))];
  }
  if (kind === 'abilities') {
    const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'reference/_phase_inventory_2026_07_26.json'), 'utf8'));
    return inv.abilities.map(a => a.name);
  }
  if (kind === 'items') {
    const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'reference/_phase_inventory_2026_07_26.json'), 'utf8'));
    return inv.items.map(i => i.name);
  }
  throw new Error('unknown kind: ' + kind);
}

(async () => {
  const dir = path.join(CORPUS, kind);
  fs.mkdirSync(dir, { recursive: true });
  const indexPath = path.join(CORPUS, '_index.json');
  const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : {};
  index[kind] = index[kind] || {};

  const names = targets(kind);
  const todo = names.filter(n => !(index[kind][n] && index[kind][n].ok)).slice(0, limit);
  console.log(`[${kind}] 対象 ${names.length} / 未取得 ${names.length - Object.values(index[kind]).filter(v => v.ok).length} / 今回 ${todo.length} 件 (delay ${DELAY}ms)`);

  let ok = 0, ng = 0;
  for (let i = 0; i < todo.length; i++) {
    const name = todo[i];
    try {
      const { url, html } = await fetchPage(name);
      const ex = extract(html);
      const out = { title: name, url, fetched_at: new Date().toISOString(), ...ex };
      fs.writeFileSync(path.join(dir, name.replace(/[\/\\]/g, '_') + '.json'), JSON.stringify(out, null, 1));
      index[kind][name] = { ok: true, at: out.fetched_at, sections: Object.keys(ex.sections).length, len: ex.raw_text.length };
      ok++;
    } catch (e) {
      index[kind][name] = { ok: false, error: String(e.message || e), at: new Date().toISOString() };
      ng++;
    }
    if ((i + 1) % 20 === 0 || i === todo.length - 1) {
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 1));
      console.log(`  ${i + 1}/${todo.length} (ok ${ok} / ng ${ng})`);
    }
    if (i < todo.length - 1) await sleep(DELAY);
  }
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 1));
  console.log(`[${kind}] 完了: ok ${ok} / ng ${ng}`);
})();
