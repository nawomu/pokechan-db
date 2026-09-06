'use strict';
// Schema normalization only. This module does not certify any game fact.
// Call initializeMoveFlags before applying a move's set fixes, then call
// finalizeMoveFlags(fixedMove, { fixSet: fixesForThisSlug.set }).
const MOVE_FLAG_FIELDS = Object.freeze(['contact', 'protect', 'substitute_pierce',
  'reflectable', 'metronome_callable', 'copyable', 'sleep_talk_usable', 'instruct_usable']);
const COMPATIBILITY_FIELDS = Object.freeze(['contact', 'protect']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const name = move => move.slug || move.name || '(unnamed move)';

function nullableBoolean(value, label, allowMissing = true) {
  if (value === null || (allowMissing && value === undefined)) return null;
  if (typeof value !== 'boolean') throw new TypeError(`${label}: expected boolean|null, got ${String(value)}`);
  return value;
}

function copyFlags(move) {
  if (!move || typeof move !== 'object' || Array.isArray(move)) throw new TypeError('move must be an object');
  if (move.flags != null && (typeof move.flags !== 'object' || Array.isArray(move.flags))) {
    throw new TypeError(`${name(move)}.flags must be an object or null`);
  }
  const flags = { ...(move.flags || {}) };
  for (const field of MOVE_FLAG_FIELDS) flags[field] = nullableBoolean(flags[field], `${name(move)}.flags.${field}`);
  return flags;
}

function initializeMoveFlags(move) {
  const flags = copyFlags(move);
  for (const field of COMPATIBILITY_FIELDS) {
    const legacy = nullableBoolean(move[field], `${name(move)}.${field}`);
    const canonical = flags[field];
    if (legacy !== null && canonical !== null && legacy !== canonical) {
      throw new Error(`${name(move)}: conflicting existing ${field} and flags.${field}`);
    }
    // Existing top-level facts are preserved, not newly verified. Unknowns do
    // not override an existing boolean and never turn into false.
    if (canonical === null && legacy !== null) flags[field] = legacy;
  }
  return { ...move, flags };
}

function canonicalFix(fixSet, field, moveName) {
  const direct = own(fixSet, `flags.${field}`);
  const root = own(fixSet, 'flags');
  if (root && (!fixSet.flags || typeof fixSet.flags !== 'object' || Array.isArray(fixSet.flags))) {
    throw new TypeError(`${moveName}: a flags fix must be an object`);
  }
  const nested = root && own(fixSet.flags, field);
  const fromDirect = direct ? nullableBoolean(fixSet[`flags.${field}`], `${moveName}: flags.${field} fix`, false) : null;
  const fromNested = nested ? nullableBoolean(fixSet.flags[field], `${moveName}: flags.${field} fix`, false) : null;
  if (direct && nested && fromDirect !== fromNested) {
    throw new Error(`${moveName}: conflicting flags object and flags.${field} fixes`);
  }
  return { specified: direct || nested, value: direct ? fromDirect : fromNested };
}

function finalizeMoveFlags(move, { fixSet = {} } = {}) {
  if (!fixSet || typeof fixSet !== 'object' || Array.isArray(fixSet)) throw new TypeError('fixSet must be an object');
  const flags = copyFlags(move);
  const out = { ...move, flags };
  // Validate explicit new-field fixes as well as compatibility-field fixes.
  // An unapplied set must not be mistaken for verified new data.
  const canonicalFixes = {};
  for (const field of MOVE_FLAG_FIELDS) {
    const fix = canonicalFix(fixSet, field, name(move));
    canonicalFixes[field] = fix;
    if (fix.specified && flags[field] !== fix.value) {
      throw new Error(`${name(move)}: flags.${field} fix was not applied`);
    }
  }
  for (const field of COMPATIBILITY_FIELDS) {
    const legacy = nullableBoolean(move[field], `${name(move)}.${field}`);
    const hasLegacyFix = own(fixSet, field);
    const canonical = canonicalFixes[field];
    if (hasLegacyFix) {
      const declared = nullableBoolean(fixSet[field], `${name(move)}: ${field} fix`, false);
      if (legacy !== declared) throw new Error(`${name(move)}: ${field} fix was not applied`);
      if (canonical.specified && declared !== canonical.value) {
        throw new Error(`${name(move)}: conflicting ${field} and flags.${field} fixes`);
      }
      // Compatibility-only fixes still change the one canonical fact.
      flags[field] = declared;
    } else if (!canonical.specified && legacy !== null && flags[field] !== legacy) {
      throw new Error(`${name(move)}: unexplained ${field}/flags.${field} mismatch; initialize before fixes and pass fixSet`);
    }
    out[field] = flags[field];
  }
  return out;
}

module.exports = { MOVE_FLAG_FIELDS, initializeMoveFlags, finalizeMoveFlags };
