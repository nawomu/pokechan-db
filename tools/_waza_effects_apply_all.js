/**
 * 全490技(パイロット27 + 最終463)の構造化effectsを pokechan_data.js へ本適用。
 *  - effects を実行手順順(行動順→威力判定→命中後→攻撃後→場継続→ターン終了)にソート
 *  - kind を英語→日本語へ変換(2軸辞書 waza_kind_dict.json)
 *  - effects/priority/requires/fails_if/immune/blocked_by/not_blocked_by → battle_data へ
 *  - flags(sound等) → top-level flags へ。既存 battle_data フィールド(crit_stage等)保持。
 *  各技の battle_data/flags のみピンポイント置換。backup→書込→再パース検証→回帰チェック。
 * 実行: node tools/_waza_effects_apply_all.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');
const R = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const dict = R('review/waza_kind_dict.json');
const EN2JA = {}; const kindGroup = {};
for (const d of dict) { EN2JA[d.en] = d.ja; kindGroup[d.en] = d.group; }
const specs = [...R('review/waza_effects_pilot.json').moves, ...R('review/waza_effects_specs_final.json').specs];

// --- 実行手順ランク(英語kindで判定) ---
const DMG = new Set(['power', 'crit', 'accuracy', 'charge', 'damage_modifier']);
const MT = new Set(['change_move_type', 'add_move_type', 'override_type_effectiveness', 'change_target_move_type']);
const POST = new Set(['recoil', 'recoil_attacker', 'drain', 'faint_self', 'switch_self_out', 'force_switch']);
const RES = new Set(['chip_damage', 'damage_over_time', 'perish_song', 'delayed_attack']);
const FG = new Set(['field', 'screen', 'hazard', 'terrain', 'weather', 'trap']);
function execRank(e) {
  if (RES.has(e.kind) || e.phase === 'turn_end' || e.phase === 'delayed') return 6;
  if (MT.has(e.kind)) return 1;
  if (DMG.has(kindGroup[e.kind])) return 1;
  if (POST.has(e.kind)) return 4;
  if (e.phase === 'lasting' || FG.has(kindGroup[e.kind])) return 5;
  return 3;
}

// --- 整形 serializer(", " / ": ") ---
function ser(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '[' + v.map(ser).join(', ') + ']';
  if (typeof v === 'object') return '{' + Object.entries(v).map(([k, val]) => JSON.stringify(k) + ': ' + ser(val)).join(', ') + '}';
  return JSON.stringify(v);
}
function spanFrom(text, b) { let i = b, d = 0, s = false, e = false; for (; i < text.length; i++) { const c = text[i];
  if (s) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') s = false; } else { if (c === '"') s = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return { start: b, end: i + 1 }; } } } throw new Error('unbalanced'); }
function findObj(text, marker, from = 0) { const at = text.indexOf(marker, from); if (at < 0) throw new Error('not found: ' + marker); return spanFrom(text, text.indexOf('{', at)); }

const srcText = fs.readFileSync(FILE, 'utf8');
const BD_KEYS = ['priority', 'requires', 'fails_if', 'immune', 'blocked_by', 'not_blocked_by'];

// 各技の effects を {sort→kind日本語化} した最終形に
const finalEffects = {};
for (const mv of specs) {
  const effs = (mv.effects || []).map((e, i) => ({ e, i, r: execRank(e) })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.e);
  finalEffects[mv.key] = effs.map(e => { const o = { ...e }; o.kind = EN2JA[e.kind] || e.kind; return o; });
}

let body = srcText;
const applied = [];
for (const mv of specs) {
  const anchor = `"${mv.key}": {"name"`;
  const ai = body.indexOf(anchor);
  if (ai < 0) throw new Error('move not found: ' + mv.key);
  const ms = spanFrom(body, body.indexOf('{', ai + mv.key.length + 3));
  const bdSpan = findObj(body, '"battle_data": {', ms.start);
  if (bdSpan.end > ms.end) throw new Error('battle_data out of span: ' + mv.key);
  const bd = JSON.parse(body.slice(bdSpan.start, bdSpan.end));
  bd.effects = finalEffects[mv.key];
  for (const k of BD_KEYS) if (mv[k] !== undefined) bd[k] = mv[k];
  body = body.slice(0, bdSpan.start) + ser(bd) + body.slice(bdSpan.end);

  if (mv.flags && mv.flags.length) {
    const ai2 = body.indexOf(anchor);
    const ms2 = spanFrom(body, body.indexOf('{', ai2 + mv.key.length + 3));
    const fi = body.indexOf('"flags": {', ms2.start);
    if (fi >= 0 && fi < ms2.end) { const fs2 = spanFrom(body, body.indexOf('{', fi));
      const flags = JSON.parse(body.slice(fs2.start, fs2.end));
      for (const f of mv.flags) flags[f] = true;
      body = body.slice(0, fs2.start) + ser(flags) + body.slice(fs2.end); }
  }
  applied.push(mv.key);
}

fs.writeFileSync(FILE + '.effects.bak', srcText);
fs.writeFileSync(FILE, body);

// --- 検証 ---
const loadMap = t => JSON.parse(t.slice(...Object.values(findObj(t, 'const WAZA_MAP ='))));
const before = loadMap(srcText), after = loadMap(body);
const keys = new Set(specs.map(m => m.key));
let drift = 0, effOk = 0, regress = [];
for (const k of Object.keys(before)) { if (keys.has(k)) continue;
  if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) { console.log('⚠ drift:', k); drift++; } }
for (const mv of specs) {
  const got = JSON.stringify((after[mv.key].battle_data || {}).effects);
  if (got === JSON.stringify(finalEffects[mv.key])) effOk++; else console.log('⚠ effects不一致:', mv.key);
  // 回帰チェック: 旧effectsに状態異常があり新で消えた技
  const oldEff = (before[mv.key].battle_data || {}).effects || [];
  const oldHadStatus = oldEff.some(e => e.kind === 'status');
  const newHasStatus = finalEffects[mv.key].some(e => e.kind === '状態付与');
  if (oldHadStatus && !newHasStatus) regress.push(mv.name);
}
console.log('技総数:', Object.keys(after).length, '/ 適用:', applied.length, '/ effects一致:', effOk, '/ drift:', drift);
if (regress.length) console.log('⚠ 旧状態異常が新effectsで消失(要確認):', regress.join(', '));
else console.log('回帰チェック: 旧状態異常の消失なし ✅');
console.log(drift === 0 && effOk === specs.length ? '✅ 検証OK' : '❌ 検証NG (backup: pokechan_data.js.effects.bak)');
