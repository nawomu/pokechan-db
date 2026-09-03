// tools/_dex_parse_audit.js — 図鑑諸元(分類/たかさ/おもさ/性別)の機械的な照合(2026-09-03)
// Codex Spark の週間クオータが切れたため、その代わりに"決め打ちのLLM無し"パーサで同じ仕事をする。
// 入力: reference/_genus_material/codex_tasks_dex_all.json の各タスク(プロンプト文字列)から
//       slug/名前/wikiテキストのパス/うちの4値 を正規表現で抜き出し、
//       wiki_<名前>.txt のインフォボックス(分類〜被捕獲度の手前)を読んでベース値+フォーム上書きを取る。
// 出力: reference/_dex_audit_codex/<slug>.json (Codexが吐く形と同じ形。既存22件=Codex結果はスキップして残す)
// 値が本文に見つからなければ verdict=unknown。記憶で埋めない・でっち上げない。
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TASKS_PATH = path.join(ROOT, 'reference/_genus_material/codex_tasks_dex_all.json');
const OUT_DIR = path.join(ROOT, 'reference/_dex_audit_codex');
const MATERIAL_DIR = path.join(ROOT, 'reference/_genus_material');

const zen2han = s => String(s == null ? '' : s)
  .replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/[～〜]/g, '~').replace(/[．]/g, '.').replace(/[／]/g, '/').replace(/[　]/g, ' ').trim();

// インフォボックス内の見出し語。TARGET=照合対象(単一値)。SKIP=複数行にまたがるので値は読み飛ばす。TERM=全種共通の節見出し=ここでインフォボックス終了。
const TARGET = new Set(['分類', 'たかさ', 'おもさ', '性別']);
const SKIP = new Set(['タイプ', 'とくせい', '隠れ特性']);
// インフォボックスの本当の終わり(この手前まで=分類〜性別が全部入る範囲)。性別はここの直前にある。
const INFOBOX_END = new Set(['被捕獲度', '初期 なつき度', '初期 なかよし度']);
// フォーム上書きブロックの終わり。★性別より手前に来る全種共通の節(タマゴグループ等)も含む=
// フォーム個別欄はここに来たら必ず終わっている(性別自体はフォーム欄の中には出てこない)。
// ★キョダイマックス/ぬしポケモン(トーテム)欄はどのタスクslugのラベルにもならない(別種扱いされていない)ので、
// 他フォームの読み飛ばしを汚染しないよう常に境界として扱う。
const TERM = new Set([...INFOBOX_END, 'タマゴグループ', 'タマゴの歩数', '獲得努力値', '基礎経験値', '最終経験値', '外部サイトの図鑑', 'キョダイマックス', 'キョダイマックスのすがた', 'ぬしポケモン']);
function keywordOf(line) {
  const t = line.trim();
  // 分類/図鑑の色は「分類 &#32; ※」のように直後に注記記号が付くことがある=前方一致で見出しと認める
  if (t.startsWith('分類')) return '分類';
  if (t.startsWith('図鑑の色')) return '図鑑の色';
  if (TARGET.has(t) || SKIP.has(t) || TERM.has(t)) return t;
  return null;
}
// ピカブイ/LA(レジェンズアルセウス)/オヤブン(ボス個体)は値の後ろに付く別ゲームの補足行=見出しでも値でもない。
const ASIDE_RE = /^(ピカブイ|LA|オヤブン)\s*[:：]/;
const isAside = l => ASIDE_RE.test(l.trim());
// 値を取り出す。補足行は読み飛ばし、値が「A→B」のように更新履歴で続く時は最新のBを採用する。
function consumeValue(lines, i, to) {
  let j = i + 1;
  while (j < to && isAside(lines[j])) j++;
  if (j >= to) return null;
  let value = lines[j].trim(), last = j;
  while (last + 1 < to && lines[last + 1].trim().startsWith('→')) { last++; value = lines[last].trim().replace(/^→/, '').trim(); }
  return { keyLine: lines[i], valLine: lines[last], value, lastIdx: last };
}

// フォーム名の候補(名前欄「種(フォーム)」の括弧の中身+のすがた有無+「・」区切りの断片)。
function formCandidates(name) {
  const m = name.match(/^(.*?)[（(](.+)[）)]$/);
  const out = new Set();
  if (m) {
    const f = m[2].trim();
    out.add(f);
    out.add(f.endsWith('のすがた') ? f.replace(/のすがた$/, '') : f + 'のすがた');
    if (f.includes('・')) {
      const parts = f.split('・');
      out.add(parts[0]); out.add(parts[parts.length - 1]);
    }
  } else if (/^(メガ|ゲンシ)/.test(name)) {
    out.add(name);
  }
  return [...out].filter(Boolean);
}

// 与えた範囲[from,to)で aspect(分類/たかさ/おもさ/性別)の最初の出現を探す(ベース値=infobox全体での最初の出現)。
function findFirst(lines, from, to, aspect) {
  for (let i = from; i < to; i++) {
    if (keywordOf(lines[i]) === aspect) {
      const v = consumeValue(lines, i, to);
      if (v) return v;
    }
  }
  return null;
}

// ページ冒頭(目次・概要)に2回以上出てくる短い行=このページで使われている「フォーム名トークン」の集合。
// (例: ハイなすがた/ローなすがた/アローラのすがた 等は本文中で何度も繰り返される)
// これが分かれば、とくせい等の複数行値を読み飛ばす時に「次のフォーム名」で確実に止まれる。
function collectPageLabels(lines, uptoIdx) {
  const freq = new Map();
  for (let i = 0; i < uptoIdx; i++) {
    const t = lines[i].trim();
    if (!t || t.length > 24 || /^[0-9]/.test(t) || keywordOf(t)) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return new Set([...freq].filter(([, c]) => c >= 2).map(([k]) => k));
}

// ラベル行の直後から、認識できる見出し(TARGET/SKIP/図鑑の色)が続く間だけ読み進め、
// 未知の行(=次のフォーム名や本文)か TERM に当たったら止める=そのフォームの上書き値だけを拾う。
function scanOverrideBlock(lines, from, to, pageLabels) {
  const found = {};
  let i = from;
  while (i < to) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (isAside(line)) { i++; continue; }
    if (pageLabels.has(line)) break; // 次のフォーム名に到達=このフォームの欄は終わり
    const kw = keywordOf(line);
    if (kw === null || TERM.has(kw)) break;
    if (TARGET.has(kw)) {
      const v = consumeValue(lines, i, to);
      if (!v) break;
      if (!(kw in found)) found[kw] = v;
      i = v.lastIdx + 1;
    } else {
      // タイプ/とくせい/隠れ特性/図鑑の色 = 値が何行続くか分からないので次の既知見出し or 次のフォーム名まで読み飛ばす
      let j = i + 1, steps = 0;
      while (j < to && steps < 6 && keywordOf(lines[j].trim()) === null && !pageLabels.has(lines[j].trim())) { j++; steps++; }
      i = j;
    }
  }
  return found;
}

function normNum(v) { const m = String(v).match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; }
function normGender(v) {
  const t = zen2han(v).replace(/\s+/g, '');
  if (!t || /性別不明|ふめい|不明|^-$|^―$/.test(t)) return { genderless: true };
  const pairs = [...t.matchAll(/([\d.]+)%([♂♀])/g)].map(m => `${m[2]}${parseFloat(m[1])}`).sort();
  return pairs.length ? { pairs } : null;
}
// 比較。見つからない値(null)は呼び出し側でunknownにする。ページ側が「???」等=値未定はunknownにする。
function compare(aspect, ours, page) {
  if (/\?/.test(page)) return { verdict: 'unknown', note: 'ページ側が値未定(???)' };
  if (aspect === '分類') return { verdict: zen2han(ours) === zen2han(page) ? 'match' : 'mismatch', note: '' };
  if (aspect === 'たかさ' || aspect === 'おもさ') {
    const a = normNum(ours), b = normNum(page);
    if (a == null || b == null) return { verdict: 'unknown', note: '数値を抽出できない' };
    return { verdict: Math.abs(a - b) < 1e-6 ? 'match' : 'mismatch', note: '' };
  }
  // 性別
  const a = normGender(ours), b = normGender(page);
  if (a && b) {
    if (a.genderless && b.genderless) return { verdict: 'match', note: '' };
    if (a.pairs && b.pairs) return { verdict: JSON.stringify(a.pairs) === JSON.stringify(b.pairs) ? 'match' : 'mismatch', note: '' };
    return { verdict: 'mismatch', note: '' };
  }
  return { verdict: zen2han(ours) === zen2han(page) ? 'match' : 'mismatch', note: '(性別パターン解析不可・文字列比較)' };
}

function parseTask(prompt) {
  const mHead = prompt.match(/ポケモン1体\((.*?)\)の図鑑諸元/);
  if (!mHead) return null;
  const g = mHead[1];
  const idx = g.indexOf('・名前=');
  const slug = g.slice(0, idx).replace(/^slug=/, '');
  const name = g.slice(idx + '・名前='.length);
  const mPath = prompt.match(/生テキスト\(([^)]+)\)を全文読んで/);
  const mOurs = prompt.match(/うちの値: (.+)/);
  if (!mPath || !mOurs) return null;
  const ours = {};
  mOurs[1].split(' / ').forEach(seg => { const i = seg.indexOf('='); if (i > 0) ours[seg.slice(0, i)] = seg.slice(i + 1); });
  return { slug, name, wikiPath: mPath[1], ours };
}

function auditOne(task) {
  const items = ['分類', 'たかさ', 'おもさ', '性別'].map(aspect => ({ aspect, ours: task.ours[aspect] || '', page_value: '', verdict: 'unknown', quote: '', note: '' }));
  if (!fs.existsSync(task.wikiPath)) {
    items.forEach(it => { it.note = 'ページ取得失敗'; });
    return { slug: task.slug, items, source: 'parser' };
  }
  const text = fs.readFileSync(task.wikiPath, 'utf8');
  const lines = text.split('\n');
  const startIdx = lines.findIndex(l => keywordOf(l) === '分類');
  if (startIdx === -1) {
    items.forEach(it => { it.note = 'infobox(分類見出し)が見つからない'; });
    return { slug: task.slug, items, source: 'parser' };
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length && i < startIdx + 400; i++) {
    if (INFOBOX_END.has(lines[i].trim())) { endIdx = i; break; }
  }
  if (endIdx === lines.length) endIdx = Math.min(startIdx + 400, lines.length);

  const base = {}; TARGET.forEach(a => { base[a] = findFirst(lines, startIdx, endIdx, a); });
  const pageLabels = collectPageLabels(lines, startIdx);

  const candidates = formCandidates(task.name);
  let override = {}, labelNote = '';
  if (candidates.length) {
    let labelIdx = -1;
    for (const c of candidates) {
      const i = lines.slice(startIdx, endIdx).findIndex(l => l.trim() === c);
      if (i !== -1 && (labelIdx === -1 || startIdx + i < labelIdx)) labelIdx = startIdx + i;
    }
    if (labelIdx === -1) labelNote = 'フォーム欄なし(種の値と照合)';
    else override = scanOverrideBlock(lines, labelIdx + 1, endIdx, pageLabels);
  }

  items.forEach(it => {
    const hit = (it.aspect in override) ? override[it.aspect] : base[it.aspect];
    const usedBase = !(it.aspect in override) && candidates.length && !labelNote;
    if (!hit) { it.note = labelNote || 'infobox内に該当行なし'; return; }
    it.page_value = hit.value;
    it.quote = hit.keyLine + '\n' + hit.valLine;
    const r = compare(it.aspect, it.ours, hit.value);
    it.verdict = r.verdict;
    it.note = [labelNote, usedBase ? 'フォーム欄内に該当行なし(種の値を使用)' : '', r.note].filter(Boolean).join(' / ');
  });
  return { slug: task.slug, items, source: 'parser' };
}

function main() {
  const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let written = 0, skipped = 0;
  const counts = { 分類: { match: 0, mismatch: 0, unknown: 0 }, たかさ: { match: 0, mismatch: 0, unknown: 0 }, おもさ: { match: 0, mismatch: 0, unknown: 0 }, 性別: { match: 0, mismatch: 0, unknown: 0 } };
  const mismatchRows = [], unknownRows = [];
  for (const task of data.tasks) {
    const outPath = path.join(OUT_DIR, task.slug + '.json');
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) { skipped++; continue; }
    const parsed = parseTask(task.prompt);
    if (!parsed) { console.error('parse失敗:', task.slug); continue; }
    parsed.wikiPath = path.isAbsolute(parsed.wikiPath) ? parsed.wikiPath : path.join(MATERIAL_DIR, parsed.wikiPath);
    const result = auditOne(parsed);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 1));
    written++;
    result.items.forEach(it => {
      counts[it.aspect][it.verdict]++;
      if (it.verdict === 'mismatch') mismatchRows.push({ slug: task.slug, name: parsed.name, aspect: it.aspect, ours: it.ours, page: it.page_value, note: it.note });
      if (it.verdict === 'unknown') unknownRows.push({ slug: task.slug, name: parsed.name, aspect: it.aspect, ours: it.ours, page: it.page_value, note: it.note });
    });
  }
  console.log('written', written, 'skipped(既存Codex結果)', skipped);
  console.log('counts', JSON.stringify(counts, null, 1));
  console.log('=== mismatch (' + mismatchRows.length + ') ===');
  mismatchRows.forEach(r => console.log('✗', r.slug, r.name, r.aspect, 'ours=' + r.ours, 'page=' + r.page, r.note ? '(' + r.note + ')' : ''));
  console.log('=== unknown (' + unknownRows.length + ') ===');
  unknownRows.forEach(r => console.log('?', r.slug, r.name, r.aspect, 'ours=' + r.ours, r.note ? '(' + r.note + ')' : ''));
}
main();
