#!/usr/bin/env node
'use strict';
// 技の性質フラグ(8項目)の「一次=ヤックン/ch/ ↔ 二次=ポケモンWiki」突き合わせ(Champions 497技)。
//   node tools/_move_flag_reconcile.js [--out review/_move_flag_audit_2026-09-06/reconcile.json]
// _move_flag_audit.js(Astra版)は「二次が世代限定つきで明示」しか採らないため eligible 0 だった。
// 本器は下の方針(P1〜P4)を**明示して**二次の値を解釈し、A(一致)/B(不一致)/C(Wiki沈黙)/S(自分対象=意味なし)に仕分ける。
// master には一切書かない。書くのは review/ の結果だけ。適用は別段(_moves_fixes.json へ根拠つき)。
//
// 方針(2026-09-06 Claude提案・阿部さん確認待ちの部分は 🙋 で報告):
//   P1 Wikiの判定欄/直接攻撃欄の「○/×」に世代限定が無い = 全世代(第九世代を含む)に当てはまる(Wikiは変わった時だけ「(第N世代以降)」を付ける流儀)
//   P2 例外表(ゆびをふる/まねっこ/ねごと/さいはい)に**載っていない**技 = 使える(Wiki本文「以下の表で×になっている技は選ばれない」の裏)。ただし第九世代に存在する技に限る
//   P3 Champions行の二次は「第九世代の明示値」で足りる(CLAUDE.md ①Champions正典=ヤックン/ch/ ②最新世代は参考)
//   P4 「○(第五世代まで)」「○(第五世代のみ)」= 第九世代では×(含意)。含意は strength=implied とし、A には数えず検証エージェントへ回す
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { zen2han } = require('./_lib/zen2han');
const { createWikiEvidenceReader } = require('./_lib/move_flag_wiki_evidence');
const { parsePrimary } = require('./_move_flag_audit');

const AUDIT = 'review/_move_flag_audit_2026-09-06';
const OUT = (process.argv.find(a => a.startsWith('--out=')) || '').split('=')[1] || `${AUDIT}/reconcile.json`;
const FIELDS = ['contact', 'protect', 'substitute_pierce', 'reflectable', 'metronome_callable', 'copyable', 'sleep_talk_usable', 'instruct_usable'];
const LABEL = { contact: '直接攻撃', protect: 'まもる', substitute_pierce: 'みがわり', reflectable: 'マジックコート',
  metronome_callable: 'ゆびをふる', copyable: 'まねっこ', sleep_talk_usable: 'ねごと', instruct_usable: 'さいはい' };
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const norm = s => zen2han(String(s || '')).replace(/　/g, ' ').trim();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sym = s => /^[○◯〇]$/.test(s) ? true : /^[×✕]$/.test(s) ? false : null;
const NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

const master = J('master/moves.json').items.filter(x => x.champions);
const rendered = J(`${AUDIT}/sources/yakkun_ch.json`).records;
const listCh = J('reference/_authority_corpus_ch/moves_ch.json').moves;
const wikiRead = createWikiEvidenceReader(path.join(ROOT, 'reference/_authority_corpus'));
const subDoc = J('reference/_authority_corpus/rules/みがわり (状態変化).json');
const ruleLists = fs.existsSync(path.join(ROOT, `${AUDIT}/sources/wiki_rule_lists.json`)) ? J(`${AUDIT}/sources/wiki_rule_lists.json`) : null;

// 一次記録の name 欠落(858 3ぼんのや=初期プローブ由来)は <title> の『…』で補う
const byName = {}; for (const r of Object.values(rendered)) { const n = r.name || ((r.title || '').match(/『(.+?)』/) || [])[1]; if (n) byName[norm(n)] = r; }
const listByName = {}; for (const r of listCh) listByName[norm(r.name)] = r;
// Wiki技ページはファイル名が全角(１０まんボルト 等)のものがある → Astraの読み手と同じく zen2han 正規化で引く
const wikiIndex = (() => { const dir = path.join(ROOT, 'reference/_authority_corpus/moves'); const m = new Map(); for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const k = norm(f.slice(0, -5)); m.set(k, m.has(k) ? null : path.join(dir, f)); } return m; })();
const wikiDoc = name => { const p = wikiIndex.get(norm(name)); return p ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
// 照合する世代: 第九世代に在ればそれ、無ければその技が使える最新世代(CLAUDE.md ②「その技が使える最新世代」=P3')。gens 不明(Unobtainable)は null=沈黙
const tgen = move => { const g = (move.availability && move.availability.gens || []).filter(Number.isInteger); return g.includes(9) ? 9 : g.length ? Math.max(...g) : null; };

// --- 一次(ヤックン) --------------------------------------------------------
function primary(move, field) {
  const r = byName[norm(move.name)];
  const raw = r && r.flags[LABEL[field]];
  let value = parsePrimary(field, raw, 'rendered');
  const quotes = [];
  if (r) quotes.push({ src: r.url, q: `${LABEL[field]}: ${raw}` });
  // 「－」(該当なし)は一覧の 接○/接× 守○/守× で補う(自分対象/場対象の まもる 等)
  if (value === null && (field === 'contact' || field === 'protect')) {
    const l = listByName[norm(move.name)];
    if (l) { const v = parsePrimary(field, l[field], 'list'); if (v !== null) { value = v; quotes.push({ src: 'reference/_authority_corpus_ch/moves_ch.json', q: `${field}: ${l[field]}` }); } }
  }
  return { value, raw, quotes };
}

// --- 二次(Wiki) -------------------------------------------------------------
function infobox(doc, label, isInfobox) {
  const intro = (doc && doc.intro) || '';
  const re = isInfobox ? new RegExp('\\|\\s*' + esc(label) + '\\s*\\n+\\s*\\|\\s*([^\\n|]+)') : new RegExp('・' + esc(label) + '\\s*[:：]\\s*([^\\n]+)');
  const m = intro.match(re);
  if (!m) return null;
  // 世代推移は改行して「→×(第六世代以降)」と続く(ふきとばし/いのちがけ/くろいまなざし)。→ で始まる続きの行を取り込む(WF2 反証で発覚 2026-09-06)
  let raw = m[1].trim(), quote = m[0].trim();
  const rest = intro.slice(m.index + m[0].length).replace(/^[ \t]*\n/, '').split('\n');
  for (const line of rest) { const t = line.trim(); if (!t.startsWith('→')) break; raw += t; quote += '\n' + t; }
  return { raw, quote };
}
// ○/× に世代限定が付く場合の解釈。P1: 無印=全世代。P4: 「まで/のみ」で9を含まない=含意で反対。
function literal(raw, g = 9) {
  const plain = sym(raw);
  if (plain !== null) return { value: plain, strength: 'explicit', policy: ['P1'] };
  const clauses = raw.split(/→/).map(s => s.trim());
  const parsed = clauses.map(s => {
    const m = s.match(/^([○◯〇×✕])\s*[（(]第([一二三四五六七八九])(?:-第?([一二三四五六七八九]))?世代(以降|まで|のみ)?[）)]$/);
    if (!m) return null;
    const a = NUM[m[2]], b = m[3] ? NUM[m[3]] : null;
    return { value: sym(m[1]), from: m[4] === 'まで' ? 1 : a, to: m[4] === '以降' ? 9 : (b || a), bounded: !!(m[4] || b) };
  });
  if (parsed.some(p => !p)) return { value: null, strength: 'ambiguous', policy: [] };
  if (g === null) return { value: null, strength: 'silent', policy: [] };
  const hit = parsed.filter(p => g >= p.from && g <= p.to);
  if (hit.length === 1) return { value: hit[0].value, strength: 'explicit', policy: [g === 9 ? 'P3' : "P3'"] };
  // P4 は「まで/のみ/範囲」で上限が明示された時だけ。「×(第二世代)」のような裸の世代注記は含意を取らない(くろいまなざし: 本文に「世代によって異なる」)
  if (hit.length === 0 && parsed.length === 1 && parsed[0].bounded && parsed[0].to < g) return { value: !parsed[0].value, strength: 'implied', policy: ['P4'] };
  return { value: null, strength: 'ambiguous', policy: [] };
}
function fromInfobox(doc, field, move) {
  const map = { contact: ['直接攻撃', true], protect: ['まもる', false], reflectable: ['マジックコート', false] };
  const [label, isInfo] = map[field];
  const f = infobox(doc, label, isInfo);
  if (!f) return { value: null, strength: 'silent', policy: [], quotes: [], why: 'Wikiに欄なし' };
  const l = literal(f.raw, tgen(move));
  return { ...l, quotes: [{ src: doc.url, q: f.quote }], why: l.strength === 'implied' ? '世代限定の含意(P4)' : l.strength === 'ambiguous' ? '解釈不能の表記' : '' };
}

// みがわり: 状態変化ページの規則 + 表(第九世代列) + 技ページの文
const subTable = (() => {
  const raw = subDoc.sections['有効なもの'] || '';
  const cells = [...raw.matchAll(/^[ \t]*\|[ \t]*([^\n]+)$/gm)].map(m => m[1].trim());
  const start = cells.findIndex((c, i) => c === 'わざ' && cells[i + 1] === '世代');
  const gens = []; let pos = start + 2; while (/^[1-9]$/.test(cells[pos])) gens.push(Number(cells[pos++]));
  const rows = {};
  while (pos < cells.length) { const name = cells[pos++].replace(/\s*\[\d+\]/g, '').trim(); const vals = cells.slice(pos, pos + gens.length); pos += gens.length; rows[norm(name)] = vals.map(v => v.replace(/\[\d+\]/g, '').trim()); }
  return { gens, rows, legend: '○: みがわりを無視して技の効果が発動する。×: みがわりで防がれる。' };
})();
const SUB_IGNORE = ['いじげんホール', 'いじげんラッシュ', 'シャドースチール'];
function fromSubstitute(doc, move) {
  const q = [];
  const rng = infobox(doc, '範囲', true);
  if (rng) q.push({ src: doc.url, q: rng.quote });
  const rngRaw = rng ? rng.raw : '';
  if (/^自分\b|^自分$|^自分\s*[（(]/.test(rngRaw) || rngRaw === '自分') return { value: null, strength: 'n/a', policy: [], quotes: q, why: '自分が対象=みがわりに関係しない(Wiki「自分が対象の技」は無視)' };
  if (/の場$/.test(rngRaw)) return { value: true, strength: 'rule', policy: [], quotes: [...q, { src: subDoc.url, q: '・場を対象とする変化技(みがわりを無視する攻撃)' }], why: '場対象' };
  const spec = (doc.sections && doc.sections['技の仕様']) || '';
  if (SUB_IGNORE.includes(move.name)) return { value: true, strength: 'explicit', policy: [], quotes: [...q, { src: subDoc.url, q: '・いじげんホール/いじげんラッシュ/シャドースチール(みがわりを無視する攻撃)' }], why: '' };
  const sound = spec.split('\n').find(l => /音のわざ|音の技/.test(l));
  if (sound) return { value: true, strength: 'explicit', policy: ['P3'], quotes: [...q, { src: doc.url, q: sound.trim() }, { src: subDoc.url, q: '・音の技 (第六世代以降)(みがわりを無視する攻撃)' }], why: '' };
  const line = spec.split('\n').find(l => /対象がみがわり状態でも成功する|相手がみがわり状態でも命中する|みがわり状態でも(効果|成功)/.test(l));
  if (line) return { value: true, strength: 'explicit', policy: [], quotes: [...q, { src: doc.url, q: line.trim() }], why: '' };
  const row = subTable.rows[norm(move.name)];
  if (row) {
    const g = tgen(move); const v = g === null ? null : row[subTable.gens.indexOf(g)];
    let val = v === '○' ? true : v === '×' ? false : null;
    // △ は技ページ本文で解決できる場合だけ(つぼをつく「味方のみがわりには防がれる」=貫通しない)。きりばらいの様に効果ごとに割れるものは null のまま
    if (val === null) { const blocked = spec.split('\n').find(l => /みがわりには防がれる/.test(l) && !/みがわり状態でも/.test(l)); if (blocked) return { value: false, strength: 'explicit', policy: ['P3'], quotes: [...q, { src: subDoc.url, q: `${move.name} | 第${g}世代: ${v}` }, { src: doc.url, q: blocked.trim() }], why: '表△を技ページ本文で解決(防がれる)' }; }
    return { value: val, strength: val === null ? 'ambiguous' : 'explicit', policy: ['P3'], quotes: [...q, { src: subDoc.url, q: `${move.name} | 第${g}世代: ${v}(${subTable.legend})` }], why: val === null ? '表が△/-' : '' };
  }
  return { value: false, strength: 'rule', policy: [], quotes: [...q, { src: subDoc.url, q: '無効にするもの: 相手が使用した攻撃技の追加効果/相手の変化技によるランク変動/状態異常/状態変化' }], why: '一般規則(表・文に個別記載なし)' };
}

// ゆびをふる/まねっこ: Astraの表読み(第九世代列)。載っていない=使える(P2)
function fromTable(move, field) {
  const g = tgen(move);
  const o = wikiRead(move, { generation: g === null ? 9 : g }).observations[field];
  const gen9 = g !== null;
  if (o.value !== null) return { value: o.value, strength: 'explicit', policy: [g === 9 ? 'P3' : "P3'"], quotes: [{ src: o.source_url, q: o.quote.replace(/\s+/g, ' ') }, { src: o.source_url, q: (o.context_quotes || []).slice(1).join(' / ') }], why: '' };
  if (o.unresolved_reason === 'not_explicitly_listed') {
    if (!gen9) return { value: null, strength: 'silent', policy: [], quotes: [], why: '使える世代が不明(Unobtainable)=Wiki表の対象外' };
    const ctx = field === 'metronome_callable' ? '第二世代以降では、以下の表で×になっている技は選ばれない' : '以下の技は真似できない…以下の表で×と表記されている技';
    return { value: true, strength: 'rule', policy: ['P2', g === 9 ? 'P3' : "P3'"], quotes: [{ src: o.source_url, q: ctx }], why: '表に無い=対象外でない' };
  }
  return { value: null, strength: 'ambiguous', policy: [], quotes: o.quote ? [{ src: o.source_url, q: o.quote }] : [], why: o.unresolved_reason || '' };
}

// ねごと/さいはい: WF抽出リスト(wiki_rule_lists.json)。載っていない=使える(P2)
function fromList(move, field) {
  if (!ruleLists) return { value: null, strength: 'silent', policy: [], quotes: [], why: 'wiki_rule_lists.json 未生成' };
  const L = ruleLists[field === 'sleep_talk_usable' ? 'negoto' : 'saihai'];
  const hits = (L.entries || []).filter(e => norm(e.name) === norm(move.name));
  const src = field === 'sleep_talk_usable' ? 'https://wiki.pokemonwiki.com/wiki/ねごと' : 'https://wiki.pokemonwiki.com/wiki/さいはい';
  if (hits.length) {
    const ex = hits.find(h => h.excluded_gen9 === 'yes');
    const no = hits.find(h => h.excluded_gen9 === 'no');
    const cond = hits.find(h => h.excluded_gen9 === 'conditional');
    if (ex) return { value: false, strength: 'explicit', policy: ['P3'], quotes: [{ src, q: ex.quote }], why: ex.category || '' };
    if (no && !cond) return { value: true, strength: 'explicit', policy: ['P3'], quotes: [{ src, q: no.quote }], why: no.category || '' };
    return { value: true, strength: 'rule', policy: ['P2'], quotes: hits.map(h => ({ src, q: h.quote })), why: '状況依存のみ(技そのものは対象外でない): ' + hits.map(h => h.excluded_gen9).join(',') };
  }
  // 種類だけで名前の無い項目「溜め技」は、技ページ自身の「溜め技の1つ」等の文で解決する
  const doc = wikiDoc(move.name);
  // 本編の節だけ見る(不思議のダンジョン等の派生作品の節は読まない: みらいよち「(マグナゲート以降)」で誤爆した)
  const spec = doc ? [doc.intro || '', (doc.sections || {})['技の仕様'] || '', (doc.sections || {})['バトルにおける効果'] || ''].join('\n') : '';
  const charge = spec.split('\n').find(l => /溜め技の1つ|溜め技に共通する仕様|1ターン目に溜め|1ターン目に(姿|すがた)を(隠|かく)し/.test(l));
  if ((L.categories_without_names || []).some(c => c.replace(/^・/, '') === '溜め技') && charge) {
    const cat = (L.entries || []).find(e => e.category === '溜め技') ? null : L.rule_sentence;
    return { value: false, strength: 'explicit', policy: ['P3'], quotes: [{ src, q: (L.category_quotes && L.category_quotes['溜め技']) || '・溜め技' }, { src: doc.url, q: charge.trim() }], why: '溜め技(種類だけの項目)を技ページで解決' };
  }
  const gen9 = tgen(move) !== null;
  if (!gen9) return { value: null, strength: 'silent', policy: [], quotes: [], why: '使える世代が不明(Unobtainable)' };
  return { value: true, strength: 'rule', policy: ['P2'], quotes: [{ src, q: L.rule_sentence }], why: 'リストに無い(種類だけの項目: ' + (L.categories_without_names || []).join('/') + ')' };
}

function secondary(move, field, doc) {
  if (!doc && field !== 'metronome_callable' && field !== 'copyable' && field !== 'sleep_talk_usable' && field !== 'instruct_usable') return { value: null, strength: 'silent', policy: [], quotes: [], why: 'Wikiページ無し(コーパス)' };
  switch (field) {
    case 'contact': case 'protect': case 'reflectable': return fromInfobox(doc, field, move);
    case 'substitute_pierce': return fromSubstitute(doc, move);
    case 'metronome_callable': case 'copyable': return fromTable(move, field);
    default: return fromList(move, field);
  }
}

// --- 仕分け ------------------------------------------------------------------
const out = { generated_by: 'tools/_move_flag_reconcile.js', policies: { P1: '無印の○/×=全世代', P2: '例外表に無い=使える(第九世代に在る技のみ)', P3: 'Champions行の二次=第九世代の明示値で足りる', P4: '「まで/のみ」の世代限定=第九世代では反対(含意・検証行き)' }, moves: [], summary: {} };
const tally = {};
for (const move of master) {
  const doc = wikiDoc(move.name);
  const rec = { slug: move.slug, name: move.name, fields: {} };
  for (const field of FIELDS) {
    const p = primary(move, field);
    const s = secondary(move, field, doc);
    let cls;
    if (s.strength === 'n/a') cls = 'S';
    else if (p.value === null && s.value === null) cls = 'D';
    else if (p.value === null) cls = 'C-wiki-only';
    else if (s.value === null) cls = 'C-yakkun-only';
    else if (s.strength === 'implied') cls = p.value === s.value ? 'A-implied' : 'B';
    else cls = p.value === s.value ? (s.strength === 'rule' ? 'A-rule' : 'A') : 'B';
    rec.fields[field] = { class: cls, master: move.flags[field], yakkun: p, wiki: s };
    tally[field] = tally[field] || {}; tally[field][cls] = (tally[field][cls] || 0) + 1;
  }
  out.moves.push(rec);
}
out.summary = tally;
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(out, null, 1) + '\n');
for (const [f, t] of Object.entries(tally)) console.log(f.padEnd(20), Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '));
console.log('→', OUT);
