'use strict';
const assert = require('node:assert/strict');
const { extractWikiEvidence, targetGeneration, createWikiEvidenceReader } = require('./_lib/move_flag_wiki_evidence');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
const doc = (title, intro = '', sections = {}) => ({ title, intro, sections,
  url: 'https://wiki.pokemonwiki.com/wiki/' + encodeURIComponent(title),
  source_path: '/fixture/' + title + '.json', fetched_at: '2026-07-28T00:00:00Z' });
const row = (name, generations = [9], extra = {}) => ({ slug: 'fixture', name,
  champions: false, availability: { gens: generations }, ...extra });
const run = (move, docs, options) => extractWikiEvidence(move, n => docs[n] || null, options).observations;
const copyTable = doc('まねっこ', '', { 選ばれる技:
  '以下の表で×と表記されている技。\n | わざ\n | 世代\n | 8\n | 9\n\n | ミラーコート\n\n | ×\n | ○\n\n | 未登場\n\n | -\n | -\n\n凡例\n○：まねっこで選ばれる。\n×：まねっこで選ばれない。' });
test('missing pages and rows do not become false', () => {
  const result = run(row('不明'), {});
  assert.equal(Object.keys(result).length, 8);
  assert(Object.values(result).every(o => o.value === null));
  assert.equal(result.contact.unresolved_reason, 'move_page_missing');
});
test('retired move targets its last available generation', () => {
  assert.equal(targetGeneration(row('技', [7, 8, 9], { availability: { gens: [7, 8, 9], gen_removed: 8 } })), 7);
  assert.equal(targetGeneration(row('技', [], {})), null);
  assert.equal(targetGeneration(row('技', [9], { champions: true })), 'champions');
});
test('unqualified infobox symbol remains unscoped even for current moves', () => {
  const docs = { 技: doc('技', '| 直接攻撃\n\n | ×\n・まもる: ○') };
  const result = run(row('技'), docs);
  assert.equal(result.contact.value, null);
  assert.equal(result.contact.candidate_value, false);
  assert.equal(result.contact.generation.status, 'unscoped');
  assert.equal(result.protect.candidate_value, true);
});
test('generation chain respects old and new values', () => {
  const docs = { 技: doc('技', '・マジックコート: ×（第四世代まで）→○（第五世代以降）') };
  assert.equal(run(row('技', [4]), docs).reflectable.value, false);
  assert.equal(run(row('技', [9]), docs).reflectable.value, true);
  assert.equal(run(row('技', [9], { champions: true }), docs).reflectable.value, null);
});
test('ambiguous generation and conditional values stay unknown', () => {
  for (const value of ['×(特殊時)', '○(第三-第五世代)', '○場合による', '○（第五世代以降）→×（第六世代以降）']) {
    const o = run(row('技'), { 技: doc('技', '・まもる: ' + value) }).protect;
    assert.equal(o.value, null, value);
  }
});
test('explicit table generation changes are preserved with literal evidence', () => {
  const docs = { まねっこ: copyTable };
  const old = run(row('ミラーコート', [8]), docs).copyable;
  const latest = run(row('ミラーコート'), docs).copyable;
  assert.equal(old.value, false); assert.equal(latest.value, true);
  assert.equal(latest.generation.source, 9);
  assert(copyTable.sections.選ばれる技.includes(latest.quote));
  assert(latest.context_quotes.every(q => copyTable.sections.選ばれる技.includes(q)));
  assert.equal(latest.source_url, copyTable.url);
  assert.equal(latest.source_path, copyTable.source_path);
});
test('table absence, unavailable dash and unsupported generation are not approval', () => {
  const docs = { まねっこ: copyTable };
  assert.equal(run(row('はたく'), docs).copyable.unresolved_reason, 'not_explicitly_listed');
  assert.equal(run(row('未登場'), docs).copyable.value, null);
  assert.equal(run(row('未登場'), docs).copyable.generation.status, 'not_available_in_table');
  assert.equal(run(row('ミラーコート', [7]), docs).copyable.value, null);
});
test('Gen9 table is only a candidate for Champions', () => {
  const o = run(row('ミラーコート', [9], { champions: true }), { まねっこ: copyTable }).copyable;
  assert.equal(o.value, null); assert.equal(o.candidate_value, true);
  assert.equal(o.generation.status, 'champions_unverified');
});
test('missing polarity and malformed table fail closed', () => {
  for (const text of [copyTable.sections.選ばれる技.replace('○：まねっこで選ばれる。', ''),
    copyTable.sections.選ばれる技.replace(' | ×\n | ○', ' | ×')]) {
    const result = run(row('ミラーコート'), { まねっこ: doc('まねっこ', '', { 選ばれる技: text }) }).copyable;
    assert.equal(result.value, null);
    assert(['table_polarity_not_explicit', 'generation_table_shape_invalid'].includes(result.unresolved_reason));
  }
});
test('unversioned sleep talk and instruct exclusions stay unresolved', () => {
  const result = run(row('ねごと'), { ねごと: doc('ねごと', '', { 選ばれない技: '・ねごと' }),
    さいはい: doc('さいはい', '', { さいはいが失敗する技: '・ねごと' }) });
  assert.equal(result.sleep_talk_usable.value, null);
  assert.equal(result.instruct_usable.value, null);
  assert.equal(result.sleep_talk_usable.unresolved_reason, 'generation_specific_rule_not_extracted');
});
test('substitute conditional mentions are rejected; explicit statement stays scoped candidate', () => {
  const conditional = run(row('技'), { 技: doc('技', '', { 技の仕様: '・第六世代以降は、相手がみがわり状態でも命中する。' }) });
  assert.equal(conditional.substitute_pierce.candidate_value, null);
  const explicit = run(row('技'), { 技: doc('技', '', { 技の仕様: '・対象がみがわり状態でも成功する。' }) });
  assert.equal(explicit.substitute_pierce.candidate_value, true);
  assert.equal(explicit.substitute_pierce.value, null);
});
test('missing corpus reader returns observations without manufacturing source URLs', () => {
  const result = createWikiEvidenceReader('/definitely/not/a/corpus')(row('技'));
  assert(Object.values(result.observations).every(o => o.value === null && o.source_url === null));
});
console.log(`${passed} tests passed`);
