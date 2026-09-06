#!/usr/bin/env node
'use strict';
// Read-only evidence audit. Outputs are review artifacts, never reference fixes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { zen2han } = require('./_lib/zen2han');
const { FIELDS, targetGeneration, createWikiEvidenceReader } = require('./_lib/move_flag_wiki_evidence');
const SCHEMA_VERSION = 1;
const normalize = s => zen2han(s).replace(/\u3000/g, ' ').trim();
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const isBool = value => typeof value === 'boolean';
const LABELS = { contact: '直接攻撃', protect: 'まもる', substitute_pierce: 'みがわり',
  reflectable: 'マジックコート', metronome_callable: 'ゆびをふる', copyable: 'まねっこ',
  sleep_talk_usable: 'ねごと', instruct_usable: 'さいはい' };

function indexByName(rows, getName) {
  const result = new Map();
  for (const row of rows) {
    const key = normalize(getName(row));
    if (!key) continue;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
  }
  return result;
}

function renderedName(row) {
  return row.name || (String(row.title || '').match(/^『([^』]+)』/) || [])[1] || '';
}

// Deliberately closed vocabulary: an unrecognized label is unknown, not false.
function parsePrimary(field, raw, kind) {
  if (typeof raw !== 'string') return null;
  if (kind === 'list') {
    if (field === 'contact') return raw === '接○' ? true : raw === '接×' ? false : null;
    if (field === 'protect') return raw === '守○' ? true : raw === '守×' ? false : null;
    return null;
  }
  const values = {
    contact: { '○': true, '接触': true, '×': false }, protect: { '通常': true, '貫通': false },
    substitute_pierce: { '通常': false, '貫通': true }, reflectable: { '○': true, 'できる': true, '×': false },
    metronome_callable: { '出る': true, '出ない': false },
    copyable: { 'できる': true, 'できない': false, '×': false },
    sleep_talk_usable: { '出る': true, '出ない': false },
    instruct_usable: { 'できる': true, 'できない': false, '×': false },
  };
  return Object.hasOwn(values[field], raw) ? values[field][raw] : null;
}

function primaryObservation(field, row, kind, doc, sourcePath, target) {
  const raw = kind === 'list' ? row[field] : (row.flags || {})[LABELS[field]];
  const candidate = parsePrimary(field, raw, kind);
  const scoped = target === 'champions';
  let url = row.url || null;
  if (!url && row.href && doc.url) {
    try { url = new URL(row.href, doc.url).href; } catch (_) { /* retain raw href below */ }
  }
  return { field, authority: 'yakkun', kind, value: scoped ? candidate : null,
    candidate_value: candidate, raw_value: raw === undefined ? null : raw,
    quote: kind === 'list' ? (raw === undefined ? null : raw) : (row.raw_table || null),
    source_row: row, source_url: url || doc.url || null, source_path: sourcePath,
    source_field: kind === 'list' ? field : 'flags.' + LABELS[field],
    fetched_at: row.fetched_at || doc.fetched_at || null,
    generation: { target, source: 'champions', status: scoped ? 'explicit_champions' : 'generation_mismatch' },
    unresolved_reason: !scoped ? 'generation_mismatch' : candidate === null ? 'unknown_literal' : null };
}

function compareField(field, primary, secondary, target, blockers = []) {
  const p = primary.filter(o => isBool(o.value) && typeof o.quote === 'string' && o.quote.length &&
    o.generation.target === target && o.generation.source === target);
  const primaryValues = [...new Set(p.map(o => o.value))];
  const s = secondary && isBool(secondary.value) && typeof secondary.quote === 'string' && secondary.quote.length && secondary.generation &&
    secondary.generation.target === target &&
    ['explicit_generation', 'explicit_champions'].includes(secondary.generation.status)
    ? secondary.value : null;
  let status = 'pending';
  let reason = null;
  if (blockers.length) reason = blockers.join(',');
  else if (primaryValues.length > 1) { status = 'conflict'; reason = 'primary_sources_disagree'; }
  else if (primaryValues.length && s !== null && primaryValues[0] !== s) {
    status = 'conflict'; reason = 'authorities_disagree';
  } else if (primaryValues.length && s !== null) status = 'eligible';
  else reason = !primaryValues.length ? 'primary_scoped_evidence_missing' : 'secondary_scoped_evidence_missing';
  return { field, status, value: status === 'eligible' ? s : null, reason,
    primary, secondary: secondary || null,
    // These support manual rebuttal without mistaking unscoped agreement for verification.
    candidate_comparison: secondary && isBool(secondary.candidate_value) && primaryValues.length === 1
      ? (primaryValues[0] === secondary.candidate_value ? 'agree_unapproved' : 'disagree_unapproved') : null };
}

function wikiDependencies(corpusPath) {
  const dir = path.join(corpusPath, 'moves');
  if (!fs.existsSync(dir)) throw new Error('Wiki moves directory does not exist: ' + dir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const index = indexByName(files, f => f.slice(0, -5));
  const hashes = new Map();
  return moveName => {
    const names = [...new Set([moveName, 'ゆびをふる', 'まねっこ', 'ねごと', 'さいはい'].map(normalize))].sort();
    return names.map(name => ({ name, files: (index.get(name) || []).map(file => {
      const full = path.join(dir, file);
      if (!hashes.has(full)) hashes.set(full, hash(fs.readFileSync(full, 'utf8')));
      return { path: full, hash: hashes.get(full) };
    }) }));
  };
}

function writeChanged(file, value, stats) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
  stats.written++;
}

function runAudit(options) {
  for (const key of ['masterPath', 'primaryListPath', 'primaryRenderedPath', 'wikiCorpusPath', 'outDir']) {
    if (!options[key]) throw new Error('Required option: ' + key);
  }
  const outDir = path.resolve(options.outDir);
  const segments = outDir.split(path.sep);
  if (!segments.includes('review') || segments.includes('reference') || segments.includes('master')) {
    throw new Error('Audit outputs must stay in a review directory, outside reference/master');
  }
  const moves = read(options.masterPath).items;
  if (!Array.isArray(moves)) throw new Error('master.items must be an array');
  const slugs = new Set();
  for (const move of moves) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(move.slug || '') || slugs.has(move.slug)) throw new Error('Invalid or duplicate slug');
    slugs.add(move.slug);
  }
  const masterIndex = indexByName(moves, r => r.name);
  const list = read(options.primaryListPath);
  const rendered = read(options.primaryRenderedPath);
  if (!Array.isArray(list.moves) || !rendered.records || typeof rendered.records !== 'object') {
    throw new Error('Unexpected primary source shape');
  }
  const listIndex = indexByName(list.moves, r => r.name);
  const renderedIndex = indexByName(Object.values(rendered.records), renderedName);
  const dependencies = wikiDependencies(options.wikiCorpusPath);
  const wikiReader = createWikiEvidenceReader(options.wikiCorpusPath);
  const interpreterHash = hash([fs.readFileSync(__filename, 'utf8'),
    fs.readFileSync(require.resolve('./_lib/move_flag_wiki_evidence'), 'utf8'),
    fs.readFileSync(require.resolve('./_lib/zen2han'), 'utf8')]);
  const stats = { moves: moves.length, recalculated: 0, cached: 0, written: 0 };
  const summary = { schema_version: SCHEMA_VERSION, moves: moves.length,
    records: { eligible: 0, conflict: 0, pending: 0 }, fields: { eligible: 0, conflict: 0, pending: 0 } };
  const queue = [];
  const unknownPrimaryNames = Object.values(rendered.records).filter(r => !renderedName(r));
  for (const move of moves) {
    const key = normalize(move.name);
    const listRows = listIndex.get(key) || [];
    const renderedRows = renderedIndex.get(key) || [];
    const wikiFiles = dependencies(move.name);
    const blockers = [];
    if ((masterIndex.get(key) || []).length !== 1) blockers.push('duplicate_master_name');
    if (listRows.length > 1) blockers.push('duplicate_primary_list_name');
    if (renderedRows.length > 1) blockers.push('duplicate_primary_rendered_name');
    if (wikiFiles.some(d => d.name === key && d.files.length > 1)) blockers.push('duplicate_wiki_name');
    const inputHash = hash({ schema_version: SCHEMA_VERSION, interpreterHash, move, blockers,
      listRows, renderedRows, listMeta: { url: list.url, fetched_at: list.fetched_at },
      paths: [path.resolve(options.masterPath), path.resolve(options.primaryListPath), path.resolve(options.primaryRenderedPath)], wikiFiles });
    const file = path.join(outDir, 'observations', move.slug + '.json');
    let record;
    if (fs.existsSync(file)) {
      try { const old = read(file); if (old.schema_version === SCHEMA_VERSION && old.input_hash === inputHash) record = old; }
      catch (_) { /* a damaged review cache is recomputed */ }
    }
    if (record) stats.cached++;
    else {
      stats.recalculated++;
      const target = targetGeneration(move);
      const wiki = wikiReader(move);
      const fields = {};
      for (const field of FIELDS) {
        const primary = [];
        if (field === 'contact' || field === 'protect') for (const row of listRows) {
          primary.push(primaryObservation(field, row, 'list', list, options.primaryListPath, target));
        }
        for (const row of renderedRows) primary.push(primaryObservation(field, row, 'rendered', rendered, options.primaryRenderedPath, target));
        fields[field] = compareField(field, primary, wiki.observations[field], target, blockers);
      }
      const states = Object.values(fields).map(f => f.status);
      record = { schema_version: SCHEMA_VERSION, input_hash: inputHash, slug: move.slug, name: move.name,
        target_generation: target, identity: { matched_by: 'normalized_name', blockers },
        status: states.includes('conflict') ? 'conflict' : states.includes('pending') ? 'pending' : 'eligible', fields };
      writeChanged(file, record, stats);
    }
    summary.records[record.status]++;
    const missing = [];
    for (const field of FIELDS) {
      const f = record.fields[field];
      summary.fields[f.status]++;
      if (f.status !== 'eligible') missing.push({ field, status: f.status, reason: f.reason,
        primary_reasons: [...new Set(f.primary.map(o => o.unresolved_reason).filter(Boolean))],
        secondary_reason: f.secondary && f.secondary.unresolved_reason });
    }
    if (missing.length) queue.push({ slug: move.slug, name: move.name, target_generation: record.target_generation,
      rendered_primary_missing: renderedRows.length === 0, fields: missing,
      primary_urls: [...new Set(Object.values(record.fields).flatMap(f => f.primary.map(o => o.source_url)).filter(Boolean))] });
  }
  summary.unmatched_rendered_records = unknownPrimaryNames.map(r => ({ title: r.title || null, url: r.url || null, reason: 'name_missing' }));
  writeChanged(path.join(outDir, 'summary.json'), summary, stats);
  writeChanged(path.join(outDir, 'queue.json'), { schema_version: SCHEMA_VERSION, records: queue }, stats);
  return { ...stats, summary };
}

function cli(argv) {
  const map = { '--master': 'masterPath', '--primary-list': 'primaryListPath',
    '--primary-rendered': 'primaryRenderedPath', '--wiki-corpus': 'wikiCorpusPath', '--out': 'outDir' };
  if (argv.includes('--help')) {
    console.log('node tools/_move_flag_audit.js --master master/moves.json --primary-list <moves_ch.json> --primary-rendered <yakkun_ch.json> --wiki-corpus <corpus-dir> --out review/<run-dir>');
    return;
  }
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!map[argv[i]] || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Unknown or missing option: ' + argv[i]);
    options[map[argv[i]]] = argv[i + 1];
  }
  console.log(JSON.stringify(runAudit(options), null, 2));
}
if (require.main === module) {
  try { cli(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { SCHEMA_VERSION, normalize, renderedName, parsePrimary, primaryObservation, compareField, runAudit };
