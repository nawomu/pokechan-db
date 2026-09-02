#!/usr/bin/env node
// tools/_watch_official_news.js — 公式(ポケモンHOME配信のChampionsお知らせ)の更新監視(2026-09-03 新設)
//
// なぜ: 「公式で最短の情報はどこか」を調べた結果(2026-09-03)、
//   ①公式サイト pokemonchampions.jp/ja/news/ は JS が champions-news.pokemon-home.com/ja/json/list.json を読んで描画している
//     → この JSON が公式の一次フィード(お知らせ全44件・kindTxt「レギュレーション」で絞れる)
//   ②レギュレーションのお知らせ本文(page/NNN.html)には、公式の「参加できるポケモン」一覧
//     (web-view.app.pokemonchampions.jp/battle/pages/events/<id>/ja/pokemon.html の `const pokemons=[["0003-000",1,"フシギバナ"],…]`)
//     へのリンクが後から足される(M-Bは「（8月5日更新）」で pubAt が上がった)。これが機械可読な唯一の公式全一覧。
//   ③よって「list.json の差分 → レギュ記事の本文 → 参加できるポケモン一覧 → master との照合」までを1本で回す。
//
// 使い方: node tools/_watch_official_news.js            … 前回スナップショットと比較して報告・スナップショット更新
//         node tools/_watch_official_news.js --dry      … 報告だけ(スナップショットを更新しない)
//         node tools/_watch_official_news.js --roster M-B … 指定レギュの公式一覧を master と照合(既に取得済みなら再取得しない)
// 出力: reference/_official_news_snapshot.json(前回の list.json) / reference/_official_rosters/<REG>.json(公式一覧の写し)
// ★このスクリプトは master を書き換えない(照合結果を出すだけ。反映は _pokemon_fixes.json / _pokemon_additions.json に根拠つきで書く)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SNAP = path.join(ROOT, 'reference/_official_news_snapshot.json');
const ROSTER_DIR = path.join(ROOT, 'reference/_official_rosters');
const FEED = { ja: 'https://champions-news.pokemon-home.com/ja/json/list.json', en: 'https://champions-news.pokemon-home.com/en/json/list.json' };
const PAGE = lang => `https://champions-news.pokemon-home.com/${lang}/`;   // link は 'page/816.html' の形
const COMMUNITY = [ // 公式より早いことがある「予告・まとめ」系(本文のハッシュだけ見る=変わったら読みに行く合図)
  { name: 'Serebii M-C', url: 'https://www.serebii.net/pokemonchampions/rankedbattle/regulationm-c.shtml' },
  { name: 'Serebii Mega Abilities', url: 'https://www.serebii.net/pokemonchampions/megaabilities.shtml' },
];
const UA = 'Mozilla/5.0 (PchamDB watcher; +https://pchamdb.com)';
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ROSTER_ONLY = args.includes('--roster') ? args[args.indexOf('--roster') + 1] : null;

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const jst = t => new Date(t * 1000).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
const hash = s => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 16);
const zen2han = s => s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
const species = s => zen2han(s).replace(/\s+/g, '').replace(/[（(].*$/, '');   // 「ケンタロス (パルデアのすがた・…)」→「ケンタロス」
const regOf = title => (title.match(/レギュレーション\s*([A-Z]-[A-Z])/) || [])[1] || null;

// ── 公式一覧(参加できるポケモン)の取得と照合 ──
async function fetchRoster(reg, pageUrl) {
  const html = await get(pageUrl);
  const links = [...new Set((html.match(/https:\/\/web-view\.app\.pokemonchampions\.jp\/[^"'\s]+pokemon\.html/g) || []))];
  if (!links.length) return { reg, pageUrl, roster_link: null, note: '本文に「参加できるポケモン」一覧へのリンクがまだ無い(公式は後日発表)' };
  const rhtml = await get(links[0]);
  const m = rhtml.match(/const pokemons\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return { reg, pageUrl, roster_link: links[0], note: '一覧ページの形式が変わった(const pokemons が見つからない)。手で見る' };
  const rows = JSON.parse(m[1]).map(([id, flag, name]) => ({ id, flag, name: zen2han(name) }));
  return { reg, pageUrl, roster_link: links[0], fetched_at: new Date().toISOString(), count: rows.length, rows };
}
function compareRoster(roster) {
  const P = J(path.join(ROOT, 'master/pokemon.json')).items;
  // master側: champions=true の非メガ行を種名で束ねる(メガは公式一覧に出ない=メガストーン側の要素)
  const ours = new Map();
  P.filter(p => p.champions && !p.mega).forEach(p => { const k = species(p.name); if (!ours.has(k)) ours.set(k, []); ours.get(k).push(p.name); });
  const off = new Map();
  roster.rows.forEach(r => { const k = species(r.name); if (!off.has(k)) off.set(k, []); off.get(k).push(r.name); });
  const onlyOfficial = [...off.keys()].filter(k => !ours.has(k));
  const onlyOurs = [...ours.keys()].filter(k => !off.has(k));
  // フォルム単位の差(名寄せの表記違いは無視できないので一覧に出す。判断は人)
  const formDiff = [];
  for (const [k, names] of off) if (ours.has(k) && names.length !== ours.get(k).length) formDiff.push({ species: k, official: names, ours: ours.get(k) });
  return { official_count: roster.count, official_species: off.size, ours_species: ours.size, only_official: onlyOfficial, only_ours: onlyOurs, form_count_diff: formDiff };
}

(async () => {
  const report = [];
  if (ROSTER_ONLY) {
    const f = path.join(ROSTER_DIR, `${ROSTER_ONLY}.json`);
    let roster = fs.existsSync(f) ? J(f) : null;
    if (!roster || !roster.rows) {
      const feed = JSON.parse(await get(FEED.ja));
      const e = feed.data.find(x => x.kindTxt === 'レギュレーション' && regOf(x.title) === ROSTER_ONLY);
      if (!e) { console.log(`レギュ ${ROSTER_ONLY} のお知らせが公式フィードに無い`); process.exit(2); }
      roster = await fetchRoster(ROSTER_ONLY, PAGE('ja') + e.link);
      if (roster.rows && !DRY) fs.writeFileSync(f, JSON.stringify(roster, null, 1));
    }
    if (!roster.rows) { console.log(`${ROSTER_ONLY}: ${roster.note}`); process.exit(0); }
    console.log(JSON.stringify(compareRoster(roster), null, 1));
    return;
  }

  const prev = fs.existsSync(SNAP) ? J(SNAP) : { ja: { data: [] }, en: { data: [] }, community: {} };
  const cur = { fetched_at: new Date().toISOString(), ja: JSON.parse(await get(FEED.ja)), en: JSON.parse(await get(FEED.en)), community: {} };
  for (const lang of ['ja', 'en']) {
    const before = new Map(prev[lang].data.map(x => [x.id, x]));
    for (const x of cur[lang].data) {
      const b = before.get(x.id);
      if (!b) report.push(`🆕 [${lang}] #${x.id} ${x.kindTxt || ''}「${x.title}」 公開 ${jst(x.pubAt)} → ${PAGE(lang)}${x.link}`);
      else if (b.pubAt !== x.pubAt || b.title !== x.title) report.push(`✏️ [${lang}] #${x.id} 更新「${x.title}」 ${jst(b.pubAt)} → ${jst(x.pubAt)} → ${PAGE(lang)}${x.link}`);
    }
  }
  // レギュレーション記事は毎回本文まで見て、一覧リンクが生えたら取得→照合
  for (const x of cur.ja.data.filter(x => x.kindTxt === 'レギュレーション')) {
    const reg = regOf(x.title); if (!reg) continue;
    const f = path.join(ROSTER_DIR, `${reg}.json`);
    const had = fs.existsSync(f) && J(f).rows;
    if (had && !report.some(l => l.includes(`#${x.id}`))) continue;   // 取得済み+記事も動いていない=何もしない
    const roster = await fetchRoster(reg, PAGE('ja') + x.link);
    if (!roster.rows) { report.push(`⏳ ${reg}: ${roster.note}`); continue; }
    if (!DRY) fs.writeFileSync(f, JSON.stringify(roster, null, 1));
    const c = compareRoster(roster);
    report.push(`📋 ${reg} 公式「参加できるポケモン」${c.official_count}行/${c.official_species}種 (master側 ${c.ours_species}種) 公式にだけ=${c.only_official.length} うちにだけ=${c.only_ours.length}`);
    if (c.only_official.length) report.push(`   公式にだけ: ${c.only_official.join(' / ')}`);
    if (c.only_ours.length) report.push(`   うちにだけ: ${c.only_ours.join(' / ')}`);
    if (c.form_count_diff.length) report.push(`   フォルム数の差: ${JSON.stringify(c.form_count_diff)}`);
  }
  for (const c of COMMUNITY) {
    try { const h = hash((await get(c.url)).replace(/<script[\s\S]*?<\/script>/g, '')); cur.community[c.name] = h;
      if (prev.community && prev.community[c.name] && prev.community[c.name] !== h) report.push(`👀 ${c.name} の本文が変わった → ${c.url}`);
    } catch (e) { report.push(`⚠ ${c.name} 取得失敗: ${e.message}`); }
  }
  console.log(`=== 公式お知らせ監視 ${cur.fetched_at} (前回 ${prev.fetched_at || 'なし'}) ===`);
  console.log(report.length ? report.join('\n') : '変化なし');
  if (!DRY) fs.writeFileSync(SNAP, JSON.stringify(cur, null, 1));
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
