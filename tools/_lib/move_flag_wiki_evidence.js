'use strict';
// Read-only secondary evidence. No observation is approval to change master.
// Unscoped Wiki facts remain candidates; absence never becomes false.
const fs = require('fs');
const path = require('path');
const { zen2han } = require('./zen2han');
const FIELDS = ['contact', 'protect', 'substitute_pierce', 'reflectable',
  'metronome_callable', 'copyable', 'sleep_talk_usable', 'instruct_usable'];
const normalize = s => zen2han(s).replace(/\u3000/g, ' ').trim();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bool = s => /^[○◯〇]$/.test(s) ? true : /^[×✕]$/.test(s) ? false : null;
const NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function targetGeneration(move, options = {}) {
  if (options.generation !== undefined) return options.generation;
  if (move.champions === true) return 'champions';
  const av = move.availability || {};
  const gens = (av.gens || []).filter(g => Number.isInteger(g) && g >= 1 && g <= 9 &&
    (!Number.isInteger(av.gen_removed) || g < av.gen_removed));
  return gens.length ? Math.max(...gens) : null;
}

function observation(field, doc, target, value = null, reason = 'field_missing') {
  return { field, value, candidate_value: null, quote: null, context_quotes: [],
    source_url: doc && doc.url || null, source_path: doc && doc.source_path || null,
    source_field: null, fetched_at: doc && doc.fetched_at || null,
    generation: { target, status: 'unknown', source: null }, unresolved_reason: reason };
}

// Exact simple symbols or a single explicit generation qualifier only.
// Unqualified symbols are evidence candidates, not historical/Champions facts.
function interpretLiteral(raw, target) {
  const plain = bool(raw.trim());
  if (plain !== null) return { candidate: plain, value: null, status: 'unscoped', source: null };
  const clauses = raw.split(/→/).map(s => s.trim());
  const parsed = clauses.map(s => {
    const m = s.match(/^([○◯〇×✕])\s*[（(]第([一二三四五六七八九])世代(以降|まで|のみ)?[）)]$/);
    if (!m) return null;
    const n = NUM[m[2]];
    return { value: bool(m[1]), from: m[3] === 'まで' ? 1 : n,
      to: m[3] === '以降' ? 9 : n, raw: s };
  });
  if (parsed.some(p => p === null)) return { candidate: null, value: null, status: 'ambiguous', source: null };
  const matches = Number.isInteger(target) ? parsed.filter(p => target >= p.from && target <= p.to) : [];
  if (matches.length !== 1) return { candidate: parsed.at(-1).value, value: null,
    status: target === 'champions' ? 'champions_unverified' : 'generation_not_covered', source: parsed };
  return { candidate: matches[0].value, value: matches[0].value, status: 'explicit_generation', source: parsed };
}

function literalObservation(field, label, doc, target, infobox = false) {
  const out = observation(field, doc, target);
  if (!doc) { out.unresolved_reason = 'move_page_missing'; return out; }
  // Do not scan unrelated games or later tables in raw_text.
  const intro = doc.intro || '';
  const re = infobox ? new RegExp('\\|\\s*' + esc(label) + '\\s*\\n+\\s*\\|\\s*([^\\n|]+)')
    : new RegExp('・' + esc(label) + '\\s*[:：]\\s*([^\\n]+)');
  const match = intro.match(re);
  if (!match) return out;
  const p = interpretLiteral(match[1], target);
  return { ...out, value: p.value, candidate_value: p.candidate, quote: match[0], source_field: 'intro',
    generation: { target, status: p.status, source: p.source },
    unresolved_reason: p.value === null ? p.status : null };
}

const TABLE_RULES = {
  metronome_callable: { title: 'ゆびをふる', section: 'ゆびをふるで出る技',
    negative: '以下の表で×になっている技は選ばれない',
    positive: /[○◯〇]\s*[:：]\s*ゆびをふるで選ばれる/ },
  copyable: { title: 'まねっこ', section: '選ばれる技',
    negative: '以下の表で×と表記されている技',
    positive: /[○◯〇]\s*[:：]\s*まねっこで選ばれる/ },
};

function tableObservation(field, doc, move, target) {
  const rule = TABLE_RULES[field];
  const out = observation(field, doc, target);
  const raw = doc && doc.sections && doc.sections[rule.section];
  if (!raw) { out.unresolved_reason = 'rule_section_missing'; return out; }
  out.source_field = 'sections.' + rule.section;
  if (!raw.includes(rule.negative) || !rule.positive.test(raw)) {
    out.unresolved_reason = 'table_polarity_not_explicit'; return out;
  }
  const cells = [...raw.matchAll(/^[ \t]*\|[ \t]*([^\n]+)$/gm)].map(m => ({ text: m[1].trim(), start: m.index, end: m.index + m[0].length }));
  const start = cells.findIndex((c, i) => c.text === 'わざ' && cells[i + 1] && cells[i + 1].text === '世代');
  if (start < 0) { out.unresolved_reason = 'generation_table_missing'; return out; }
  let pos = start + 2;
  const generations = [];
  while (cells[pos] && /^[1-9]$/.test(cells[pos].text)) generations.push(Number(cells[pos++].text));
  if (!generations.length || new Set(generations).size !== generations.length) {
    out.unresolved_reason = 'generation_header_invalid'; return out;
  }
  const headerEnd = cells[pos - 1].end;
  const rows = [];
  while (pos < cells.length) {
    const name = cells[pos++];
    const values = cells.slice(pos, pos + generations.length); pos += generations.length;
    if (values.length !== generations.length || values.some(v => !/^[○◯〇×✕-]$/.test(v.text))) {
      out.unresolved_reason = 'generation_table_shape_invalid'; return out;
    }
    if (normalize(name.text) === normalize(move.name)) rows.push({ name, values });
  }
  if (rows.length !== 1) { out.unresolved_reason = rows.length ? 'duplicate_table_row' : 'not_explicitly_listed'; return out; }
  const row = rows[0];
  out.quote = raw.slice(row.name.start, row.values.at(-1).end);
  out.context_quotes = [raw.slice(cells[start].start, headerEnd), raw.match(rule.positive)[0], rule.negative];
  const column = generations.indexOf(target);
  // For Champions show the latest explicit value only as an unapproved candidate.
  const chosen = column >= 0 ? column : generations.length - 1;
  const candidate = bool(row.values[chosen].text);
  out.candidate_value = candidate;
  out.generation = { target, source: generations[chosen], status: column < 0
    ? (target === 'champions' ? 'champions_unverified' : 'generation_not_covered')
    : candidate === null ? 'not_available_in_table' : 'explicit_generation' };
  out.value = column >= 0 ? candidate : null;
  out.unresolved_reason = out.value === null ? out.generation.status : null;
  return out;
}

function substituteObservation(doc, target) {
  const out = observation('substitute_pierce', doc, target);
  // A full, unconditional sentence in the move's own mechanics section only.
  const raw = doc && doc.sections && doc.sections['技の仕様'];
  if (!raw) return out;
  const allowed = ['・対象がみがわり状態でも成功する。', '・相手がみがわり状態でも命中する。'];
  const lines = raw.split('\n');
  const quote = lines.find(line => allowed.includes(line));
  if (!quote) { out.unresolved_reason = 'no_unconditional_substitute_statement'; return out; }
  return { ...out, candidate_value: true, quote, source_field: 'sections.技の仕様',
    generation: { target, status: 'unscoped', source: null }, unresolved_reason: 'unscoped' };
}

// Pure interpretation entry point. getDoc(title) supplies immutable corpus records.
function extractWikiEvidence(move, getDoc, options = {}) {
  const target = targetGeneration(move, options);
  const doc = getDoc(move.name);
  const observations = {
    contact: literalObservation('contact', '直接攻撃', doc, target, true),
    protect: literalObservation('protect', 'まもる', doc, target),
    substitute_pierce: substituteObservation(doc, target),
    reflectable: literalObservation('reflectable', 'マジックコート', doc, target),
    metronome_callable: tableObservation('metronome_callable', getDoc('ゆびをふる'), move, target),
    copyable: tableObservation('copyable', getDoc('まねっこ'), move, target),
  };
  // Existing corpus has unversioned bullet lists here, not generation columns.
  // Reading a missing row as usable would silently invent hundreds of facts.
  for (const [field, title, section] of [
    ['sleep_talk_usable', 'ねごと', '選ばれない技'],
    ['instruct_usable', 'さいはい', 'さいはいが失敗する技'],
  ]) {
    const ruleDoc = getDoc(title);
    observations[field] = observation(field, ruleDoc, target, null,
      ruleDoc && ruleDoc.sections && ruleDoc.sections[section] ? 'generation_specific_rule_not_extracted' : 'rule_section_missing');
    observations[field].source_field = 'sections.' + section;
  }
  return { slug: move.slug || null, name: move.name, target_generation: target, observations };
}

// Reuse one reader for full-corpus runs. The closure only caches file reads;
// no reference/master writes, global mutable cache, network access, or defaults to gen9.
function createWikiEvidenceReader(corpusPath) {
  const movesDir = path.join(corpusPath, 'moves');
  const index = new Map();
  if (fs.existsSync(movesDir)) for (const file of fs.readdirSync(movesDir).filter(f => f.endsWith('.json'))) {
    const key = normalize(file.slice(0, -5));
    index.set(key, index.has(key) ? null : path.join(movesDir, file));
  }
  const cache = new Map();
  const getDoc = name => {
    const key = normalize(name);
    if (cache.has(key)) return cache.get(key);
    const file = index.get(key);
    if (!file) return null;
    const d = { ...JSON.parse(fs.readFileSync(file, 'utf8')), source_path: file };
    if (normalize(d.title || '') !== key) return null;
    cache.set(key, d);
    return d;
  };
  return (move, options) => extractWikiEvidence(move, getDoc, options);
}

function getMoveFlagWikiEvidence(move, corpusPath, options) {
  return createWikiEvidenceReader(corpusPath)(move, options);
}

module.exports = { FIELDS, targetGeneration, extractWikiEvidence, createWikiEvidenceReader, getMoveFlagWikiEvidence };
