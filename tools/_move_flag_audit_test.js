'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parsePrimary, compareField, runAudit } = require('./_move_flag_audit');

test('unknown literals remain null; explicit negative is false', () => {
  assert.equal(parsePrimary('contact', '×', 'rendered'), false);
  assert.equal(parsePrimary('contact', '未確認', 'rendered'), null);
  assert.equal(parsePrimary('protect', '-', 'list'), null);
  assert.equal(parsePrimary('substitute_pierce', '通常', 'rendered'), false);
  assert.equal(parsePrimary('substitute_pierce', '貫通', 'rendered'), true);
  assert.equal(parsePrimary('protect', '貫通', 'rendered'), false);
  assert.equal(parsePrimary('protect', '－', 'rendered'), null);
  assert.equal(parsePrimary('contact', '接触', 'rendered'), true);
  assert.equal(parsePrimary('reflectable', 'できる', 'rendered'), true);
});

const primary = value => ({ value, quote: 'source literal', generation: { target: 9, source: 9 } });
const secondary = (value, target = 9) => ({ value, quote: 'source literal', candidate_value: value, generation: { target, status: 'explicit_generation' } });
test('eligible requires scoped values, conflict is distinct from missing evidence', () => {
  assert.equal(compareField('contact', [primary(false)], secondary(false), 9).status, 'eligible');
  assert.equal(compareField('contact', [primary(false)], secondary(true), 9).status, 'conflict');
  assert.equal(compareField('contact', [primary(false), primary(true)], secondary(false), 9).reason, 'primary_sources_disagree');
  const candidate = { ...secondary(null), candidate_value: false };
  assert.equal(compareField('contact', [primary(false)], candidate, 9).status, 'pending');
  assert.equal(compareField('contact', [primary(false)], secondary(false, 8), 9).status, 'pending');
  assert.equal(compareField('contact', [primary(false)], secondary(false), 9, ['duplicate_master_name']).status, 'pending');
});

test('runner joins names, scopes generations, holds duplicate names, and resumes only changed inputs', t => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'move-flag-audit-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const put = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
  const options = { masterPath: path.join(base, 'moves.json'), primaryListPath: path.join(base, 'list.json'),
    primaryRenderedPath: path.join(base, 'rendered.json'), wikiCorpusPath: path.join(base, 'wiki'), outDir: path.join(base, 'review') };
  const moves = [
    { slug: 'right-name', name: '3ぼんのや', move_no: 999, champions: true },
    { slug: 'wrong-id', name: '別の技', move_no: 858, champions: true },
    { slug: 'historical', name: '昔の技', champions: false, availability: { gens: [8] } },
    { slug: 'duplicate-a', name: '重複', champions: true }, { slug: 'duplicate-b', name: '重複', champions: true },
  ];
  put(options.masterPath, { items: moves });
  put(options.primaryListPath, { url: 'https://yakkun.com/ch/move_list.htm', moves: [
    { name: '３ぼんのや', contact: '接×', protect: '守○', href: './zukan/search/?move=858' },
    { name: '昔の技', contact: '接○', protect: '守○' }, { name: '重複', contact: '接○', protect: '守○' },
  ] });
  const source = { records: { 858: { title: '『３ぼんのや』の効果', move_no: 858,
    url: 'https://yakkun.com/ch/zukan/search/?move=858', flags: { 直接攻撃: '×', まもる: '通常' }, raw_table: '直接攻撃\t×\tまもる\t通常' } } };
  put(options.primaryRenderedPath, source);
  put(path.join(options.wikiCorpusPath, 'moves', '3ぼんのや.json'), { title: '3ぼんのや', intro: '| 直接攻撃\n| ×\n・まもる: ○' });
  put(path.join(options.wikiCorpusPath, 'moves', '昔の技.json'), { title: '昔の技', intro: '| 直接攻撃\n| ○(第八世代のみ)' });
  const first = runAudit(options);
  assert.equal(first.recalculated, 5);
  assert.equal(first.written, 7);
  const get = slug => JSON.parse(fs.readFileSync(path.join(options.outDir, 'observations', slug + '.json')));
  assert.equal(get('right-name').fields.contact.primary.length, 2);
  assert.equal(get('right-name').fields.contact.status, 'pending');
  assert.equal(get('right-name').fields.contact.secondary.candidate_value, false);
  assert.equal(get('wrong-id').fields.contact.primary.length, 0);
  assert.equal(get('historical').fields.contact.primary[0].value, null);
  assert.equal(get('historical').fields.contact.secondary.value, true);
  assert.equal(get('historical').fields.contact.status, 'pending');
  assert.equal(get('duplicate-a').fields.contact.reason, 'duplicate_master_name');
  const second = runAudit(options);
  assert.deepEqual([second.recalculated, second.cached, second.written], [0, 5, 0]);
  source.records[858].flags.直接攻撃 = '○';
  source.records[858].raw_table = '直接攻撃\t○\tまもる\t通常';
  put(options.primaryRenderedPath, source);
  const changed = runAudit(options);
  assert.equal(changed.recalculated, 1);
  assert.equal(get('right-name').fields.contact.status, 'conflict');
  assert.equal(runAudit(options).written, 0);
  put(path.join(options.wikiCorpusPath, 'moves', '昔の技.json'), { title: '昔の技', intro: '| 直接攻撃\n| ×(第八世代のみ)' });
  assert.equal(runAudit(options).recalculated, 1);
  assert.equal(runAudit(options).written, 0);
});
