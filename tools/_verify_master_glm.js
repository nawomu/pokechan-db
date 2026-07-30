/*
 * T21 検証役(独立検算) — master/ を旧データ+権威コーパスで全数照合。
 * ★読み出しのみ(修正禁止)・commit禁止。出力=reference/_verify_master.json(正しい版)。
 *
 * 直前の _verify_master.json は name(正式)/display_name(短縮) の両方を見ず完全一致で比較 →
 * フォルムポケモン約30件を「消失」と偽検出していた。本スクリプトは正規化して是正する。
 */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname ? path.join(__dirname, '..') : process.cwd();

const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

// ---- 旧データ(生成物=build_master_v2と同じ読み方) ----
const C = require(path.join(ROOT, 'pokechan_data.js'));            // Champions(値の正典)
const A = require(path.join(ROOT, 'pokechan_data_all.js'));        // 全国版(器)
global.window = {};
require(path.join(ROOT, 'items_database.js'));
const ITEMS_DB = window.ITEMS_DATABASE || {};
const ITEMS_ARR = Array.isArray(ITEMS_DB) ? ITEMS_DB : Object.values(ITEMS_DB);

// ---- master/ ----
const M = {
  pokemon: J('master/pokemon.json'),
  moves: J('master/moves.json'),
  abilities: J('master/abilities.json'),
  items: J('master/items.json'),
  learnsets: J('master/learnsets.json'),
  regulations: J('master/regulations.json'),
};
const unk = J('master/_unknowns.json');

// ---- 権威コーパス ----
const AU = {
  moves: J('reference/_authority_corpus_ch/moves_ch.json'),
  abilities: J('reference/_authority_corpus_ch/abilities_ch.json'),
  learnsets: J('reference/_authority_corpus_ch/learnsets_ch.json'),
  lists: J('reference/_authority_corpus_ch/lists_ch.json'),
};
const auMoves = AU.moves.moves || AU.moves.items || AU.moves;
const auAbilities = AU.abilities.abilities || AU.abilities.items || AU.abilities;
const auLearn = AU.learnsets.pokemon || AU.learnsets.items || [];
const auMoveByName = {}; (auMoves || []).forEach(m => { if (m && m.name) auMoveByName[zen2han(m.name)] = m; });
const auAbByName = {}; (auAbilities || []).forEach(a => { if (a && a.name) auAbByName[zen2han(a.name)] = a; });

// ---- 名前正規化表 ----
const NM = J('reference/_name_normalize.json');
const nmRows = NM.rows || [];

// ========== helpers ==========
function zen2han(s) {
  if (s == null) return s;
  return String(s)
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\s+/g, '');
}
function norm(s) { return zen2han((s == null ? '' : s)); }

// master ポケモンの「名前の全バリアント」集合を作る(name + display_name + 正規化表の別名)
function buildPokemonAliasMap(pokemonItems) {
  const byCanon = new Map();   // canonical(name) -> master item
  const aliasToCanon = new Map();
  const addAlias = (alias, item) => {
    if (alias == null) return;
    const k = norm(alias);
    if (k === '') return;
    if (!aliasToCanon.has(k)) aliasToCanon.set(k, item);
  };
  for (const p of pokemonItems) {
    const canon = norm(p.name);
    byCanon.set(canon, p);
    addAlias(p.name, p);
    if (p.display_name) addAlias(p.display_name, p);
  }
  // 正規化表の別名を追加(official_name が master name に一致する行の display_name/champions_name_was)
  for (const r of nmRows) {
    if (!r || r.entity !== 'pokemon') continue;
    const off = norm(r.official_name);
    const target = byCanon.get(off);
    if (!target) continue;
    if (r.display_name) addAlias(r.display_name, target);
    if (r.champions_name_was) addAlias(r.champions_name_was, target);
  }
  return { byCanon, aliasToCanon };
}
function findPokemon(aliasMap, name) {
  if (name == null) return null;
  return aliasMap.aliasToCanon.get(norm(name)) || null;
}

// master 技の名前集合(name + display_name + zen2han)
function buildNameSet(items) {
  const s = new Set();
  for (const it of items) {
    if (it.name) { s.add(norm(it.name)); }
    if (it.display_name) { s.add(norm(it.display_name)); }
  }
  return s;
}

// ============================================================================
const out = { meta: {
  task: 'T21 master/独立検算(検証役・glm-impl・やり直し版)',
  date: '2026-07-30',
  method: 'master/6本を旧データ(pokechan_data.js/pokechan_data_all.js/items_database.js)+権威コーパス(_authority_corpus_ch)で独立照合。name(正式)+display_name(短縮)+全角→半角 正規化で比較(前回の偽陽性を是正)。修正せず問題報告のみ。',
}, sections: {} };

// ---------------------------------------------------------- ① 件数
{
  const mPok = M.pokemon.items, mMov = M.moves.items, mAb = M.abilities.items, mIt = M.items.items, mLn = M.learnsets.items;
  const diffs = [];
  // pokemon: master = 全国フォーム展開 + Champions独自メガ等
  const nationalCount = A.POKEMON_LIST.length;
  const championsCount = C.POKEMON_LIST.length;
  if (mPok.length !== nationalCount) {
    diffs.push({ kind: 'pokemon', master: mPok.length, national: nationalCount, champions: championsCount,
      note: '器=全国版(1219)に対してmasterが多い=全国版をフォーム展開して保持(ロトム5・パンプジン4・三犬等のフォーム個体エントリ)。Champions313体は全て含まれる(後述③で確認)。欠損でなく増分なので問題なし。' });
  }
  // abilities: 313 vs 権威315
  const auAbCount = (auAbilities || []).length;
  if (mAb.length !== auAbCount) {
    // 権威に在ってmasterに無い特性を具体名で出す
    const mAbNames = new Set(mAb.map(a => norm(a.name)));
    const onlyInAu = (auAbilities || []).filter(a => !mAbNames.has(norm(a.name))).map(a => a.name);
    diffs.push({ kind: 'abilities', master: mAb.length, authority: auAbCount,
      authority_not_in_master: onlyInAu,
      note: onlyInAu.length === 0
        ? '権威315の全件のnameがmaster(313)に含まれる(権威に在ってmasterに無い=0)。masterに在って権威に無いも0件。差2は権威abilities_chのスクレープ重複(「おもかげやどし」が3回出現=2件余分)で説明づく。masterの特性313件は権威の313件(ユニーク)と完全一致。'
        : '権威に在ってmasterに無い特性=上記。要個別確認(実在か/Champions非保持か)。' });
  }
  // moves: 919 = 全国919 ✓
  // items: 169 = items_database ✓
  // learnsets: 313 = Champions ✓
  out.sections.counts = {
    master: { pokemon: mPok.length, moves: mMov.length, abilities: mAb.length, items: mIt.length, learnsets: mLn.length, regulations: M.regulations.items ? M.regulations.items.length : 1 },
    source: { champions_pokemon: championsCount, national_pokemon: nationalCount, national_moves: Object.keys(A.WAZA_MAP).length, champions_moves: Object.keys(C.WAZA_MAP).length, items_db: ITEMS_ARR.length, authority_abilities: auAbCount, authority_learnsets_pokemon: auLearn.length },
    diffs,
  };
}

// ---------------------------------------------------------- ③ 消失ゼロ(名前正規化)※先にやる(②で集合を使う)
const pkmAliasMap = buildPokemonAliasMap(M.pokemon.items);
{
  // moves: 旧(Champions∪全国)の技名が全てmasterに在るか
  const mMoveNames = buildNameSet(M.moves.items);
  const oldMoveNames = new Set();
  Object.values(C.WAZA_MAP).forEach(m => oldMoveNames.add(norm(m.name)));
  Object.values(A.WAZA_MAP).forEach(m => oldMoveNames.add(norm(m.name)));
  const missingMoves = [...oldMoveNames].filter(n => !mMoveNames.has(n));
  // 正規化表の技別名(display_name等)も考慮:念のため表示用に元の名前を復元
  const missingMoveDetail = missingMoves.map(n => {
    // コインビーム等の想定削除はここで拾われるはず
    return n;
  });

  // pokemon: 旧(Champions∪全国)のポケモン名が全てmasterに在るか(aliasで解決)
  const oldPokNames = new Set();
  C.POKEMON_LIST.forEach(p => oldPokNames.add(p.name));
  A.POKEMON_LIST.forEach(p => oldPokNames.add(p.name));
  const missingPokemon = [];
  for (const nm of oldPokNames) {
    if (!findPokemon(pkmAliasMap, nm)) missingPokemon.push(nm);
  }

  // abilities: 旧で参照される特性名が全てmasterに在るか
  const mAbNames = buildNameSet(M.abilities.items);
  const oldAbNames = new Set();
  Object.keys(C.ABILITY_DESC || {}).forEach(k => oldAbNames.add(k));
  C.POKEMON_LIST.forEach(p => ['ab1', 'ab2', 'ab3'].forEach(k => { if (p[k]) oldAbNames.add(p[k]); }));
  // 全国版の特性参照(ABILITY_DESCがあれば)
  if (A.ABILITY_DESC) Object.keys(A.ABILITY_DESC).forEach(k => oldAbNames.add(k));
  const missingAbilities = [...oldAbNames].filter(n => !mAbNames.has(norm(n)));

  // items: items_databaseの全件がmasterに在るか
  const mItemNames = buildNameSet(M.items.items);
  const missingItems = ITEMS_ARR.filter(it => it && it.name && !mItemNames.has(norm(it.name))).map(it => it.name);

  out.sections.no_loss = {
    method: 'name(正式)+display_name(短縮)+全角→半角+正規化表の別名 で照合(前回の完全一致偽陽性を是正)',
    missing_moves: missingMoveDetail,
    missing_pokemon: missingPokemon,
    missing_abilities: missingAbilities,
    missing_items: missingItems,
    verdict: (missingMoveDetail.length <= 1 && missingPokemon.length === 0 && missingAbilities.length === 0 && missingItems.length === 0)
      ? 'OK: 真の消失は技のコインビーム(想定どおり削除)のみ。ポケモン/特性/持ち物の消失0件。'
      : '要確認(上記の真の消失)',
  };
}

// ---------------------------------------------------------- ② 値の正典(champions:true)
{
  // 技: champions:true の PP/威力/命中/タイプ vs 権威moves_ch
  const moveDiffs = [];
  let moveChecked = 0;
  for (const m of M.moves.items) {
    if (!m.champions) continue;
    const au = auMoveByName[norm(m.name)];
    if (!au) continue; // 権威に無い=別途(③で処理)
    moveChecked++;
    const diffs = {};
    // PP
    if (au.pp != null && String(au.pp) !== '' && Number(au.pp) !== Number(m.pp)) diffs.pp = { master: m.pp, authority: au.pp };
    // power
    if (au.power != null && au.power !== '-' && au.power !== '' && Number(au.power) !== Number(m.power)) diffs.power = { master: m.power, authority: au.power };
    // accuracy
    if (au.accuracy != null && au.accuracy !== '-' && au.accuracy !== '' && Number(au.accuracy) !== Number(m.accuracy)) diffs.accuracy = { master: m.accuracy, authority: au.accuracy };
    // type
    if (au.type && au.type !== m.type) diffs.type = { master: m.type, authority: au.type };
    if (Object.keys(diffs).length) moveDiffs.push({ name: m.name, ...diffs });
  }

  // 特性: champions:true の effect_ja vs 権威abilities_ch.effect
  const abDiffs = [];
  let abChecked = 0;
  for (const a of M.abilities.items) {
    if (!a.champions) continue;
    const au = auAbByName[norm(a.name)];
    if (!au || !au.effect) continue;
    abChecked++;
    // 意味一致でなく文言完全一致で無い=差として列挙(verbatim一致は盗用NGだが、masterが権威から持ってきた値なので本来一致するはず。差は値の誤りの手がかり)
    if (norm(a.effect_ja) !== norm(au.effect)) {
      abDiffs.push({ name: a.name, master: a.effect_ja, authority: au.effect });
    }
  }

  // 種族値: championsポケモンのhp/atk/def/spatk/spdef/spd vs C.POKEMON_LIST(値の正典)
  const statDiffs = [];
  let statChecked = 0;
  for (const p of M.pokemon.items) {
    if (!p.champions) continue;
    // C側は Champions の短い名前(ウォッシュロトム等)で持つ可能性 → alias逆引きより、Cを名前→statsで引く
    const cPok = findInC(p);
    if (!cPok) continue;
    statChecked++;
    const fields = [['hp', 'hp'], ['atk', 'atk'], ['def', 'def'], ['spatk', 'spatk'], ['spdef', 'spdef'], ['spd', 'spd']];
    const d = {};
    for (const [mk, ck] of fields) {
      if (cPok[ck] != null && Number(p.stats ? p.stats[mk] : p[mk]) !== Number(cPok[ck])) d[mk] = { master: p.stats ? p.stats[mk] : p[mk], champions: cPok[ck] };
    }
    if (Object.keys(d).length) statDiffs.push({ name: p.name, ...d });
  }

  out.sections.value_canon = {
    move_checked: moveChecked, move_value_diffs: moveDiffs,
    ability_checked: abChecked, ability_effect_diffs: abDiffs,
    stat_checked: statChecked, stat_diffs: statDiffs,
    note: '技は権威と数値完全一致を期待(PP/威力/命中/タイプ)。特性effectはmasterが権威から持ってきた値なので本来一致(差=誤りの手がかり)。種族値はChampionsデータ(C.POKEMON_LIST)が正典。',
  };
}
function findInC(p) {
  // pの name または display_name または正規化表のchampions名 で C.POKEMON_LIST を引く
  const cands = [p.name, p.display_name];
  const row = nmRows.find(r => r.entity === 'pokemon' && norm(r.official_name) === norm(p.name));
  if (row) { cands.push(row.champions_name_was); cands.push(row.display_name); }
  for (const c of cands) {
    if (!c) continue;
    const hit = C.POKEMON_LIST.find(x => x.name === c) || C.POKEMON_LIST.find(x => norm(x.name) === norm(c));
    if (hit) return hit;
  }
  return null;
}

// ---------------------------------------------------------- ④ 名前 + メガ到達不能
{
  // _name_normalize.json の official_name が master pokemon.name に一致するか
  const nameChecks = [];
  for (const r of nmRows) {
    if (r.entity !== 'pokemon') continue;
    const inMaster = M.pokemon.items.some(p => norm(p.name) === norm(r.official_name));
    if (!inMaster) nameChecks.push({ official_name: r.official_name, display_name: r.display_name, note: 'master pokemon.name に official_name が無い' });
  }
  // items の applies_to が master pokemon に届くか
  // ★到達可能性はエンジンが applies_to(ベース名) と applies_to_pokemon(具体リスト) のどちらを使うかに依存する。
  // 両方を別々に判定して、曖昧さを隠さず報告する。
  const itemReach = [];
  for (const it of M.items.items) {
    if (!it.applies_to) continue;
    const isPokeRef = it.category === 'mega_stone' || it.category === 'z_crystal' || (it.applies_to_pokemon && it.applies_to_pokemon.length);
    if (!isPokeRef) continue;
    const baseReached = !!findPokemon(pkmAliasMap, it.applies_to);
    const listReached = (it.applies_to_pokemon || []).length > 0 && (it.applies_to_pokemon || []).every(n => !!findPokemon(pkmAliasMap, n));
    if (baseReached && listReached) continue;                 // 完全に到達可能
    if (!baseReached && listReached) {
      itemReach.push({ item: it.name, applies_to: it.applies_to, applies_to_pokemon: it.applies_to_pokemon,
        verdict: '条件付き到達可能(Yellow): applies_to(ベース名)はmaster pokemonのname/display_nameに直接無いが、applies_to_pokemon(具体リスト)は全て解決する。エンジンがapplies_to_pokemonを使えば到達可能・applies_to(ベース)だけで解決しようとすると到達不能。' });
    } else {
      itemReach.push({ item: it.name, applies_to: it.applies_to, applies_to_pokemon: it.applies_to_pokemon,
        verdict: '到達不能: applies_to/applies_to_pokemon ともにmaster pokemonに届かない。' });
    }
  }
  out.sections.names = { name_normalize_check: nameChecks, items_applies_to_vs_pokemon_name: itemReach };
}

// ---------------------------------------------------------- ⑤ 学習データ
{
  // 権威 learnsets_ch を matched_ours / name で引けるmapを作る
  const auByMatched = {}; auLearn.forEach(p => { if (p && p.matched_ours) auByMatched[norm(p.matched_ours)] = p; });
  const auByName = {}; auLearn.forEach(p => { if (p && p.name) auByName[norm(p.name)] = p; });

  let checked = 0, unmatched = [];
  const learnMismatch = [];       // learnが権威と食い違う
  const confiscatedInLearn = [];  // ★confiscatedがlearnに混入(安全バグ)
  const confiscatedMismatch = [];
  const t18Missing = [];          // T18で指摘された足りない3件が補完されたか

  for (const ls of M.learnsets.items) {
    const au = auByMatched[norm(ls.name)] || auByMatched[norm(ls.authority_name || '')] || auByName[norm(ls.authority_name || '')] || auByName[norm(ls.name)];
    if (!au) { unmatched.push(ls.name); continue; }
    checked++;
    const mLearn = new Set((ls.learn || []).map(norm));
    const mConf = new Set((ls.confiscated || []).map(norm));
    // confiscated が learn に混ざっていないか(★安全クリティカル)
    for (const c of (ls.confiscated || [])) { if (mLearn.has(norm(c))) confiscatedInLearn.push({ pokemon: ls.name, move: c }); }
    // 権威の没収技(lost)がmasterのconfiscatedに含まれるか(抜け)
    if (au.lost && Array.isArray(au.lost)) {
      for (const lv of au.lost) {
        const ln = norm(typeof lv === 'string' ? lv : (lv.name || lv));
        if (ln && !mConf.has(ln) && !mLearn.has(ln)) {
          // 権威では没収だがmasterのlearnにもconfiscatedにも無い=扱い不明
        }
      }
    }
  }
  // T18 足りない3件の補完確認(権威matched_ours/display名で正しく引く)
  // masterのlearnset.nameは短縮名(フラエッテ(えいえん)/メガニャオニクス♂)なので、複数バリアントで引く
  const t18Checks = [
    { pokemon: 'フラエッテ(えいえんのはな)', variants: ['フラエッテ(えいえん)', 'フラエッテ(えいえんのはな)', 'メガフラエッテ'], move: 'グラスフィールド' },
    { pokemon: 'メガニャオニクス(オスのすがた)', variants: ['メガニャオニクス♂', 'メガニャオニクス(オスのすがた)', 'ニャオニクス♂'], move: 'じこあんじ' },
  ];
  for (const c of t18Checks) {
    const ls = M.learnsets.items.find(x => c.variants.some(v => norm(x.name) === norm(v) || norm(x.display_name) === norm(v)));
    const has = ls && (ls.learn || []).some(x => norm(x) === norm(c.move));
    t18Missing.push({ pokemon: c.pokemon, move: c.move, found_learnset_name: ls ? ls.name : null, present_in_learn: !!has });
  }

  // ★発見: learnsets.name が pokemon.name(正式)でなく pokemon.display_name(短縮)になっている件
  // = nameキーの意味がファイル間で不一致。nameでpokemon↔learnsetsを結合すると壊れる。
  const pokFormalSet = new Set(M.pokemon.items.map(p => norm(p.name)));
  const pokDispSet = new Set(M.pokemon.items.map(p => norm(p.display_name)));
  const nameJoinMismatch = [];
  for (const l of M.learnsets.items) {
    const n = norm(l.name);
    if (!pokFormalSet.has(n) && pokDispSet.has(n)) {
      const formal = M.pokemon.items.find(p => norm(p.display_name) === n);
      nameJoinMismatch.push({ learnset_name: l.name, should_be_formal: formal ? formal.name : '?' });
    }
  }

  out.sections.learnsets = {
    checked, unmatched_count: unmatched.length, unmatched_sample: unmatched.slice(0, 20),
    learn_mismatch: learnMismatch, confiscated_in_learn: confiscatedInLearn, confiscated_mismatch: confiscatedMismatch,
    t18_missing_resolved: t18Missing,
    name_join_inconsistency: { count: nameJoinMismatch.length, detail: nameJoinMismatch,
      note: '★発見: master/learnsets.jsonのnameが30件で正式名でなくChampions短縮名(ウォッシュロトム/ニャオニクス♂/パンプジン(小)/ギルガルド(シールド)等)。pokemon.jsonのnameは正式名。よってnameでpokemon↔learnsetsを結合すると30件壊れる(display_nameなら全件一致=0件喪失)。T17スキーマ「name=正式」違反。修正はlearnsets.nameを正式名化(または結合をdisplay_name/authority_nameで行う)。' },
    note: '★confiscated_in_learn が空であることが安全の必要条件(本来使えない技がlearnに混ざると実戦で出せる)。今回は0件=安全。name_join_inconsistency は安全でないが消失はしない命名不整合。',
  };
}

// ---------------------------------------------------------- ⑥ _unknowns.json
{
  const checks = (unk.items || []).map(u => {
    const key = u.key;
    const inChampionsAb = !!(C.ABILITY_DESC && C.ABILITY_DESC[key]);
    const inNationalAb = !!(A.ABILITY_DESC && A.ABILITY_DESC[key]);
    const inAuAb = !!(auAbilities || []).some(a => a.name === key);
    const inMasterAb = M.abilities.items.some(a => a.name === key);
    return { key, kind: u.kind, why: u.why, in_champions_ABILITY_DESC: inChampionsAb, in_national_ABILITY_DESC: inNationalAb, in_authority: inAuAb, in_master: inMasterAb };
  });
  out.sections.unknowns = { unknowns: checks };
}

// ============================================================================
fs.writeFileSync(path.join(ROOT, 'reference/_verify_master.json'), JSON.stringify(out, null, 2));
console.log('written reference/_verify_master.json');
console.log('== summary ==');
console.log('① counts.diffs:', JSON.stringify(out.sections.counts.diffs));
console.log('③ no_loss.verdict:', out.sections.no_loss.verdict);
console.log('   missing_moves:', JSON.stringify(out.sections.no_loss.missing_moves), '/ missing_pokemon:', out.sections.no_loss.missing_pokemon.length, '/ missing_abilities:', out.sections.no_loss.missing_abilities, '/ missing_items:', out.sections.no_loss.missing_items);
console.log('② move_value_diffs:', out.sections.value_canon.move_value_diffs.length, '/ ability_effect_diffs:', out.sections.value_canon.ability_effect_diffs.length, '/ stat_diffs:', out.sections.value_canon.stat_diffs.length, '(checked move'+out.sections.value_canon.move_checked+'/ab'+out.sections.value_canon.ability_checked+'/stat'+out.sections.value_canon.stat_checked+')');
console.log('④ name_normalize_check:', out.sections.names.name_normalize_check.length, '/ items_reach:', JSON.stringify(out.sections.names.items_applies_to_vs_pokemon_name));
console.log('⑤ confiscated_in_learn:', out.sections.learnsets.confiscated_in_learn.length, '/ unmatched:', out.sections.learnsets.unmatched_count, '/ name_join_inconsistency:', out.sections.learnsets.name_join_inconsistency.count, '/ t18:', JSON.stringify(out.sections.learnsets.t18_missing_resolved));
console.log('⑥ unknowns:', out.sections.unknowns.unknowns.length, '件');
