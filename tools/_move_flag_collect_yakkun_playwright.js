#!/usr/bin/env node
'use strict';
// ヤックン /ch/ の技ページ(実画面)から「8マス」(直接攻撃/まもる/マジックコート/みがわり/ゆびをふる/ねごと/まねっこ/さいはい)を
// Playwright(実Chromium・通常UA)で取り、review/_move_flag_audit_2026-09-06/sources/yakkun_ch.json に追記する。
//   node tools/_move_flag_collect_yakkun_playwright.js [--limit N] [--force]
// ・対象=reference/_authority_corpus_ch/moves_ch.json の497技(URL番号=ヤックン番号。PokeAPI番号ではない)
// ・取得済み(records に同じURL番号)は飛ばす(--force で取り直し)
// ・名前照合: <title>の『…』が一覧の name と一致しない技は採らない(rejected に記録)
// ・master には一切書かない(監査器 _move_flag_audit.js の一次入力を作るだけ)。1秒1件で礼儀正しく取る。
// ・素の fetch/WebFetch は 403。Playwright の実ブラウザなら 200(2026-09-06 実測)。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const LIST = path.join(ROOT, 'reference/_authority_corpus_ch/moves_ch.json');
const OUT = path.join(ROOT, 'review/_move_flag_audit_2026-09-06/sources/yakkun_ch.json');
const LABELS = ['直接攻撃', 'まもる', 'マジックコート', 'みがわり', 'ゆびをふる', 'ねごと', 'まねっこ', 'さいはい'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const argv = process.argv.slice(2);
const limit = Number((argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;
const force = argv.includes('--force');

function load() {
  if (fs.existsSync(OUT)) return JSON.parse(fs.readFileSync(OUT, 'utf8'));
  return { source: 'Yakkun Champions rendered flag table', records: {} };
}
function save(cur) {
  cur.updated_at = new Date().toISOString();
  const tmp = OUT + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cur, null, 2) + '\n');
  fs.renameSync(tmp, OUT);
}

async function main() {
  const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
  const list = JSON.parse(fs.readFileSync(LIST, 'utf8'));
  const moves = (list.records || list.moves || list).map(m => {
    const no = String(m.href || m.url || '').match(/move=(\d+)/);
    return no ? { no: no[1], name: m.name } : null;
  }).filter(Boolean);
  const cur = load();
  const todo = moves.filter(m => force || !cur.records[m.no]).slice(0, limit);
  console.log(`対象 ${moves.length} / 取得済み ${Object.keys(cur.records).length} / 今回 ${todo.length}`);
  const rejected = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: UA });
  let done = 0;
  try {
    for (const m of todo) {
      const url = `https://yakkun.com/ch/zukan/search/?move=${m.no}`;
      let rec = null;
      try {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (!res || res.status() !== 200) throw new Error('HTTP ' + (res && res.status()));
        rec = await page.evaluate(labels => {
          const rows = [...document.querySelectorAll('table')]
            .map(tb => [...tb.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.textContent.trim())))
            .find(rs => rs.some(r => r[0] === '直接攻撃'));
          if (!rows) return { error: 'table not found' };
          const flags = {};
          for (const r of rows) for (let i = 0; i + 1 < r.length; i += 2) if (labels.includes(r[i])) flags[r[i]] = r[i + 1];
          return { title: document.title, flags, raw_table: rows.map(r => r.join('\t')).join('\n') };
        }, LABELS);
        if (rec.error) throw new Error(rec.error);
        const tname = (rec.title.match(/『(.+?)』/) || [])[1];
        if (tname !== m.name) throw new Error(`name mismatch: list=${m.name} title=${tname}`);
        if (Object.keys(rec.flags).length !== 8 || Object.values(rec.flags).some(v => !v)) throw new Error('incomplete eight-cell table: ' + JSON.stringify(rec.flags));
        cur.records[m.no] = { flags: rec.flags, raw_table: rec.raw_table, title: rec.title, url, name: m.name, fetched_at: new Date().toISOString(), move_no: Number(m.no) };
        done++;
        if (done % 10 === 0) { save(cur); console.log(`  …${done}/${todo.length} 保存`); }
      } catch (e) {
        rejected.push({ no: m.no, name: m.name, error: e.message });
        console.log(`  ✗ ${m.no} ${m.name}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  } finally {
    await browser.close();
    save(cur);
  }
  console.log(`取得 ${done} / 不採用 ${rejected.length} / 合計records ${Object.keys(cur.records).length}`);
  if (rejected.length) console.log(JSON.stringify(rejected, null, 1));
  return rejected.length ? 1 : 0;
}

main().then(c => { process.exitCode = c; }).catch(e => { console.error('ERR', e.message); process.exitCode = 1; });
