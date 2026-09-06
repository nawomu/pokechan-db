'use strict';
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { MOVE_FLAG_FIELDS, initializeMoveFlags, finalizeMoveFlags } = require('./_lib/move_flag_schema');
let passed = 0;
const test = (title, fn) => { fn(); passed++; console.log('PASS ' + title); };
const cycle = move => finalizeMoveFlags(initializeMoveFlags(move));
const freeze = object => {
  if (object && typeof object === 'object' && !Object.isFrozen(object)) {
    Object.values(object).forEach(freeze); Object.freeze(object);
  }
  return object;
};

test('919 real master moves preserve all existing assets and are stable on second application', () => {
  const source = path.join(__dirname, '../master/moves.json');
  const before = fs.readFileSync(source, 'utf8');
  const moves = JSON.parse(before).items;
  assert.equal(moves.length, 919);
  const keySet = new Set(moves.flatMap(move => Object.keys(move.flags || {})));
  // The integrated master gains the new schema keys; preserve its entire
  // actual set rather than requiring the pre-migration count forever.
  assert(keySet.size >= 58);
  let oldContactTrue = 0, migratedContactTrue = 0, nullNewCells = 0;
  for (const original of moves) {
    freeze(original);
    const result = cycle(original);
    assert.notEqual(result, original); assert.notEqual(result.flags, original.flags);
    for (const [key, value] of Object.entries(original.flags || {})) assert.deepEqual(result.flags[key], value, `${original.slug}:${key}`);
    for (const [key, value] of Object.entries(original)) if (!['flags', 'contact', 'protect'].includes(key)) {
      assert.deepEqual(result[key], value, `${original.slug}:${key}`);
    }
    assert.equal(result.contact, original.contact); assert.equal(result.protect, original.protect);
    for (const field of MOVE_FLAG_FIELDS) {
      assert(Object.hasOwn(result.flags, field));
      assert(result.flags[field] === null || typeof result.flags[field] === 'boolean');
    }
    for (const field of MOVE_FLAG_FIELDS.slice(2)) {
      const previous = Object.hasOwn(original.flags || {}, field) ? original.flags[field] : null;
      assert.equal(result.flags[field], previous, `${original.slug}: invented ${field}`);
      if (result.flags[field] === null) nullNewCells++;
    }
    assert.deepEqual(cycle(result), result, `${original.slug}: unstable second application`);
    if (original.contact) oldContactTrue++;
    if (result.flags.contact) migratedContactTrue++;
  }
  assert.equal(oldContactTrue, 277); assert.equal(migratedContactTrue, 277);
  assert.equal(fs.readFileSync(source, 'utf8'), before, 'master changed');
  console.log(`  real rows=${moves.length}, old flag kinds=${keySet.size}, contact true=${migratedContactTrue}, unverified cells=${nullNewCells}`);
});
test('unknown, false and true remain distinct', () => {
  for (const flags of [undefined, null, {}]) {
    const result = cycle({ slug: 'unknown', flags });
    assert.equal(result.contact, null); assert.equal(result.protect, null);
    assert(MOVE_FLAG_FIELDS.every(field => result.flags[field] === null));
  }
  assert.equal(cycle({ contact: false }).flags.contact, false);
  assert.equal(cycle({ contact: null, flags: { contact: true } }).contact, true);
  assert.equal(cycle({ contact: true, flags: { contact: null } }).contact, true);
});
test('existing contradictory canonical and compatibility booleans throw', () => {
  for (const field of ['contact', 'protect']) {
    assert.throws(() => initializeMoveFlags({ [field]: true, flags: { [field]: false } }), /conflicting existing/);
  }
});
test('legacy-only fix updates canonical and compatibility fields', () => {
  const initial = initializeMoveFlags({ contact: true, protect: true, flags: { sound: true } });
  const fixed = { ...initial, contact: false };
  const result = finalizeMoveFlags(fixed, { fixSet: { contact: false } });
  assert.equal(result.flags.contact, false); assert.equal(result.contact, false);
  assert.equal(result.flags.sound, true); assert.equal(initial.flags.contact, true);
});
test('canonical-only fix derives compatibility without accepting stale top-level value', () => {
  const initial = initializeMoveFlags({ contact: true });
  const fixed = { ...initial, flags: { ...initial.flags, contact: false } };
  const result = finalizeMoveFlags(fixed, { fixSet: { 'flags.contact': false } });
  assert.equal(result.contact, false); assert.equal(result.flags.contact, false);
  assert.throws(() => finalizeMoveFlags(fixed), /unexplained/);
});
test('simultaneous conflicting fixes throw, including explicit unknown', () => {
  const initial = initializeMoveFlags({ contact: true });
  for (const value of [false, null]) {
    const fixed = { ...initial, flags: { ...initial.flags, contact: value } };
    assert.throws(() => finalizeMoveFlags(fixed, { fixSet: { contact: true, 'flags.contact': value } }), /conflicting contact/);
  }
  const fixed = { ...initial, contact: false, flags: { ...initial.flags, contact: false } };
  assert.equal(finalizeMoveFlags(fixed, { fixSet: { contact: false, 'flags.contact': false } }).contact, false);
});
test('object flag fixes and dotted fixes cannot hide a contradictory instruction', () => {
  const initial = initializeMoveFlags({ contact: true });
  const fixed = { ...initial, flags: { ...initial.flags, contact: false } };
  assert.equal(finalizeMoveFlags(fixed, { fixSet: { flags: { contact: false } } }).contact, false);
  assert.throws(() => finalizeMoveFlags(fixed, { fixSet: { flags: { contact: true }, 'flags.contact': false } }), /conflicting flags object/);
});
test('fixes must actually have been applied', () => {
  const initial = initializeMoveFlags({ contact: true });
  assert.throws(() => finalizeMoveFlags(initial, { fixSet: { contact: false } }), /not applied/);
  assert.throws(() => finalizeMoveFlags(initial, { fixSet: { 'flags.contact': false } }), /not applied/);
  assert.throws(() => finalizeMoveFlags(initial, { fixSet: { 'flags.copyable': true } }), /not applied/);
});
test('eight core fields reject malformed values while retaining unrelated metadata', () => {
  for (const value of [0, 1, '', 'false', [], {}]) {
    assert.throws(() => initializeMoveFlags({ flags: { reflectable: value } }), /boolean\|null/);
  }
  assert.throws(() => initializeMoveFlags({ flags: [] }), /must be an object/);
  const original = freeze({ flags: { schema_gap: ['memo'], z: { crystal: 'x' }, priority: 1 } });
  const result = cycle(original);
  assert.deepEqual(result.flags.schema_gap, ['memo']); assert.deepEqual(result.flags.z, { crystal: 'x' });
  assert.equal(result.flags.priority, 1);
});
test('no alias unification or substitute transfer occurs', () => {
  const original = freeze({ flags: { ball: true, bullet: false, slash: false, slicing: true }, battle_data: { substitute_pierce: true } });
  const result = cycle(original);
  for (const key of ['ball', 'bullet', 'slash', 'slicing']) assert.equal(result.flags[key], original.flags[key]);
  assert.equal(result.flags.substitute_pierce, null);
  assert.equal(result.battle_data.substitute_pierce, true);
});
test('explicit canonical null stays unknown after derivation', () => {
  const initial = initializeMoveFlags({ contact: true });
  const fixed = { ...initial, flags: { ...initial.flags, contact: null } };
  const result = finalizeMoveFlags(fixed, { fixSet: { 'flags.contact': null } });
  assert.equal(result.contact, null); assert.equal(result.flags.contact, null);
  assert.deepEqual(cycle(result), result);
});
console.log(`${passed} tests passed`);
