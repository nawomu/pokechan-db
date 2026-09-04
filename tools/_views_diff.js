#!/usr/bin/env node
/* tools/_views_diff.js — 段C: build_views.js が作った *.new.js を旧生成物と全数比較する。
 *
 * 出力: (a) newだけに居るentity(=追加分。reference/_*_additions.jsonと一致するはず)
 *       (b) legacyだけに居るentity(=0でなければ失格)
 *       (c) 値の差分(未説明=0でなければ失格。許容差分はALLOWLISTに明記・理由つき)
 *       + exportセット比較 + 各行のキーセット比較
 *
 * 実行: node tools/_views_diff.js
 * exit code: 0=未説明差分なし / 1=未説明差分あり
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const { zen2han } = require('./_lib/zen2han'); // 2026-09-04 5箇所コピペを1本化(％＋－．も半角化)

// ══════════════════════════════════════════════════════════════════
// ALLOWLIST(2026-09-01 コーディネーター差し戻し対応。カテゴリを厳格化した)
//   許容カテゴリは (a)〜(f) の6つ**だけ**。それ以外は unexplained として失敗させる。
//   learners/subcategory/added/mode/added_in/effect/mega_target_en/169フラグ列は原則0(すでに
//   段B/段Cの修正で0になったものはallowlistから外した)。フラグ列とChampions learnersが
//   master権威で減る分だけは(a)扱いとし、件数を下のログで明記する。
// ══════════════════════════════════════════════════════════════════
const HANKAKU_NAME_DIFFS_EXPECTED = 14;
const MOVE_FLAG_KEYS = J('reference/_legacy_champions_move_flag_keys.json').keys;

// (c) 正式名称化: name/form/weight_kg
const POKEMON_FIELD_ALLOWLIST = new Set(['weight_kg', 'form', 'name']);
// (i) 器を広げて増えた列(旧生成物に無い。値の差ではなく列の追加。2026-09-03 display_name/性別)
const ADDED_VIEW_FIELDS = new Set(['display_name', 'genderless', 'gender_female_pct']);
// (b) 隠れ特性スロット修正: ab1-3・type1-2 は位置でなく集合として比較
const POKEMON_MULTISET_GROUPS = [['ab1', 'ab2', 'ab3'], ['type1', 'type2']];
// (c)+(a): pokemon_champions は上と同じ(c)に加え、169技フラグ列(=(a)扱い。master権威による
//   増減。件数はレポートで明記=true→false 168件/false→true 73件・52体)。added_inはB.6で0になった
//   ため通常はここに乗らない(残れば失格させる)。okatazukeは値0固定なので通常diffなし。
const POKEMON_CHAMPIONS_FIELD_ALLOWLIST = new Set(['weight_kg', 'form', 'name', 'okatazuke', ...MOVE_FLAG_KEYS]);

// (a) 権威値の上書き: pp/power/accuracy/target/flags/national_new
//   +少数(15件)の同型の権威上書き(type/battle_data/priority/description。例: growthのtype
//   ノーマル→くさ、crush-clawのslicing/slashフラグ追加、quick-guardの説明文更新)もここに含める。
//   +learners(A.1修正後の残差)= 2種類ある: ①champions:trueポケモンがmaster権威で技を失う/得る分
//   =(a)扱い(件数明記) ②champions:falseポケモンの学習データがmaster/learnsets.jsonの構造上
//   「最新バージョングループのlearnのみ」で旧作TM等(learn_legacy)を含まない=段Cのスコープ外の
//   別問題(残った未解決・最終報告に明記。ここではallowlistせず個別に処理する→下のUNRESOLVED参照)。
const WAZA_ALL_FIELD_ALLOWLIST = new Set(['pp', 'power', 'accuracy', 'target', 'flags', 'national_new',
  'type', 'battle_data', 'priority', 'description']);
const WAZA_CHAMPIONS_FIELD_ALLOWLIST = new Set(['pp', 'power', 'accuracy', 'target', 'flags', 'national_new',
  'type', 'battle_data', 'priority', 'description']);
// (g') availability(使える世代)の差は、監査確定修正(reference/_moves_fixes.json)で availability.* を根拠つきで
//   直した技**だけ**許す(R10 世代の扱い・2026-09-03)。それ以外の availability 差は unexplained のまま。
const LIVE_REGS = (() => { try { return (J('reference/_regulations.json').items || []).map(r => r.id); } catch (e) { return []; } })();
const REG_NEWEST = LIVE_REGS[LIVE_REGS.length - 1] || null;
const NATIONAL_SEASON_BY_NAME = new Map();   // (i) 全国版の season(名前→配列)。main() で埋める
// (g) reference/_moves_fixes.json(全件根拠つき・二重ソース確定)が set した列(パスの根=availability/description_legacy 等)を
//   slug×列の単位でだけ許容する(2026-09-05 false-surrender の description_legacy 訂正で availability 限定から一般化)
const AUDITED_MOVE_FIX_FIELDS = (() => { try {
  const fx = J('reference/_moves_fixes.json').fixes || {};
  const m = new Map();
  Object.keys(fx).forEach(k => m.set(k, new Set(Object.keys(fx[k].set || {}).map(p => p.split(/[.\[]/)[0]))));
  return m;
} catch (e) { return new Map(); } })();

// (d) items: name_en(24件・監査是正) / mega_ability(21件・列挙。旧が土台ポケモンの特性を誤表示していた
//   分の是正+旧が空欄だった分の補完) / mega_target_en(5件・列挙。base種がフォーム限定/X・Y無しの
//   正確な英語名になった=i18n/en.json由来でより正確) / category(1件=berry_leppaの誤分類是正)
const ITEMS_FIELD_ALLOWLIST = new Set(['name_en', 'mega_ability', 'mega_target_en', 'category', 'mega_form']);
// (j) R1(2026-09-03) added_in/season の champions 判定用。items_database.js の行は champions を持たないので
//   master/items.json(slug→champions)を直接引く(items_database.js は master 由来なので slug=key で一致)。
// (k) B-3(2026-09-04) pokeapi_slug 補完の照合先(PokeAPI 全どうぐの生データ・中間ファイル)
const POKEAPI_ITEMS_RAW = (() => { try { return J('reference/_pokeapi_items_raw.json').items || {}; } catch (e) { return {}; } })();
const MASTER_ITEMS_CHAMPIONS_BY_KEY = (() => {
  const m = new Map();
  try { J('master/items.json').items.forEach(it => { if (it.slug) m.set(it.slug, it.champions === true); }); } catch (e) {}
  return m;
})();
// mega_form: 1件(mega_stone_meowstic)。legacyは性別を区別しない表記'メガニャオニクス'だったが、
//   実際は性別で特性が違う(♂いたずらごころ/♀トレース等)ため、masterはapplies_toの'オスのすがた'から
//   正しく'メガニャオニクス♂'を導く=改善。
function isEmptyVal(v) { return v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0); }

// ★重複込みの配列ではなく「非空値の集合(重複除去)」で比較する。
//   理由: ①ab2/ab3位置入れ替え(隠れ特性スロット修正) ②legacyが同じ特性をab1とab2に二重掲載していた
//   個体(単一特性種。masterはab2を正しくnullにした=14件)の両方をこれ一本でカバーできる。
function multisetEq(fields, lRow, nRow) {
  const norm = arr => [...new Set(arr.map(v => zen2han(v || '')).filter(Boolean))].sort();
  return JSON.stringify(norm(fields.map(f => lRow[f]))) === JSON.stringify(norm(fields.map(f => nRow[f])));
}

// ══════════════════════════════════════════════════════════════════
// リネーム対応(pokemon限定): reference/_name_normalize.json の champions_name_was/display_name を
// 旧名の別名候補として使う(段C: 生成器の行順ロジックと同じ考え方をentity照合にも使う)
// ══════════════════════════════════════════════════════════════════
const NAMEMAP_ROWS = (() => { const d = J('reference/_name_normalize.json'); return Array.isArray(d) ? d : (d.rows || []); })();
const aliasCandidates = {};
NAMEMAP_ROWS.filter(r => r.entity === 'pokemon').forEach(r => {
  const arr = aliasCandidates[r.official_name] || (aliasCandidates[r.official_name] = []);
  if (r.champions_name_was) arr.push(r.champions_name_was);
  if (r.display_name) arr.push(r.display_name);
});
function buildAliasedIndex(rows, nameOf) {
  const idx = new Map();
  rows.forEach(r => {
    const name = nameOf(r);
    const k = zen2han(name);
    if (!idx.has(k)) idx.set(k, r);
    (aliasCandidates[name] || []).forEach(alt => { const ak = zen2han(alt); if (!idx.has(ak)) idx.set(ak, r); });
  });
  return idx;
}

// ══════════════════════════════════════════════════════════════════
// learners専用分類器(2026-09-01コーディネーター指摘): (a)master権威で減る/増える分 と
//   段Cのスコープ外(learn_legacyを含まない・出典が"champions:falseのnational-only学習データが
//   最新バージョングループのlearnのみで旧作TM等を含まない")を分けて数える。
//   全国版=championsのpokemonが権威で増減した分だけ(a)扱い・champions:falseポケモンの分は
//   known_unresolved。Champions版=対象が全員champions:trueなので全部(a)扱い。
// ══════════════════════════════════════════════════════════════════
function diffLearners(entity, legacyMap, newMap, champByName, onlyChampionPossible) {
  let aCount = 0, aMoves = new Set(), unresolvedCount = 0, unresolvedMoves = new Set(), unresolvedFieldDiffPairs = 0;
  const commonKeys = [...legacyMap.keys()].filter(k => newMap.has(k));
  commonKeys.forEach(k => {
    const l = legacyMap.get(k), n = newMap.get(k);
    const lset = new Set((l.learners || []).map(zen2han));
    const nset = new Set((n.learners || []).map(zen2han));
    if (JSON.stringify([...lset].sort()) === JSON.stringify([...nset].sort())) return;
    let hasNonChamp = false;
    [...lset].filter(x => !nset.has(x)).concat([...nset].filter(x => !lset.has(x))).forEach(name => {
      const isChamp = champByName.get(name);
      if (onlyChampionPossible || isChamp === true) { aCount++; aMoves.add(k); }
      else { unresolvedCount++; unresolvedMoves.add(k); hasNonChamp = true; }
    });
  });
  report.categories.a.push({ field: `${entity}.learners`, count: aCount, moves: aMoves.size });
  if (unresolvedCount) {
    report.known_unresolved.push({
      field: `${entity}.learners`, pairs: unresolvedCount, moves: unresolvedMoves.size,
      reason: 'champions:falseなポケモンのmaster/learnsets.json.learnが「最新バージョングループの技のみ」で' +
        '旧作TM/タマゴ技等(learn_legacy)を含まない構造的ギャップ。コーディネーター指示A.1の範囲外(champions:false→learnのみ使う指示どおり実装済み)。',
    });
  }
}

function loadLegacy() {
  const A = require(path.join(ROOT, 'reference', '_legacy_snapshot', 'pokechan_data_all.js'));
  const C = require(path.join(ROOT, 'reference', '_legacy_snapshot', 'pokechan_data.js'));
  global.window = global.window || {};
  require(path.join(ROOT, 'reference', '_legacy_snapshot', 'items_database.js'));
  const I = global.window.ITEMS_DATABASE;
  return { A, C, I };
}
function loadNew() {
  const A = require(path.join(ROOT, 'pokechan_data_all.js'));
  const C = require(path.join(ROOT, 'pokechan_data.js'));
  global.window = {};
  require(path.join(ROOT, 'items_database.js'));
  const I = global.window.ITEMS_DATABASE;
  return { A, C, I };
}

// ── 正規化(null≡""・no文字列≡数値・全角≡半角・キー順は無視) ──────────
function norm(v) {
  if (v === null || v === undefined) return '';
  // ★2026-09-01(3回目): okatazuke等、legacyが数値0/1・新がboolean true/falseで持つ列がある(同じ意味)。
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return zen2han(v);
  if (Array.isArray(v)) return v.map(norm).slice().sort();
  if (typeof v === 'object') {
    const o = {};
    Object.keys(v).sort().forEach(k => { const n = norm(v[k]); o[k] = n; });
    return o;
  }
  return v;
}
function eq(a, b) { return JSON.stringify(norm(a)) === JSON.stringify(norm(b)); }

const report = {
  unexplained: [], allowlisted: [], additions: {}, entity_only_in_legacy: {}, summary: {},
  // (a)〜(f)=許容カテゴリ別の内訳(件数根拠として残す)。known_unresolved=段Cのスコープ外・未解決(件数明記)。
  categories: { a: [], b: [], c: [], d: [], e: [], f: [] },
  known_unresolved: [],
};

// ★items専用: mega_*系は「legacyが未実装で空だった(スケルトン項目)→masterのjoinで初めて埋まった」場合、
//   これはデータの欠落修復であって不一致ではない。空→非空の遷移だけを許容する。
const EMPTY_TO_FILLED_ALLOWED_FIELDS = new Set(['mega_types', 'mega_ability', 'mega_stats', 'mega_form', 'mega_ability_desc']);

// 汎用: キーで揃った2つのMap(name→row)をフィールド単位で比較
function diffRows(label, legByKey, newByKey, fieldAllowlist, multisetGroups, skipFields) {
  const onlyInNew = [...newByKey.keys()].filter(k => !legByKey.has(k));
  const onlyInLegacy = [...legByKey.keys()].filter(k => !newByKey.has(k));
  const common = [...legByKey.keys()].filter(k => newByKey.has(k));
  report.additions[label] = onlyInNew;
  if (onlyInLegacy.length) report.entity_only_in_legacy[label] = onlyInLegacy;

  let fieldDiffCount = 0, fieldDiffUnexplained = 0;
  common.forEach(k => {
    const lRow = legByKey.get(k), nRow = newByKey.get(k);
    const allKeys = new Set([...Object.keys(lRow), ...Object.keys(nRow)]);
    const explainedByMultiset = new Set();
    (multisetGroups || []).forEach(group => {
      if (multisetEq(group, lRow, nRow)) group.forEach(f => explainedByMultiset.add(f));
    });
    allKeys.forEach(f => {
      if (skipFields && skipFields.has(f)) return;
      const lv = lRow[f], nv = nRow[f];
      if (eq(lv, nv)) return;
      fieldDiffCount++;
      if (explainedByMultiset.has(f)) {
        report.allowlisted.push({ entity: label, key: k, field: f, reason: 'multiset(ab1-3 / type1-2の順序違いのみ)' });
        return;
      }
      if (fieldAllowlist && fieldAllowlist.has(f)) {
        report.allowlisted.push({ entity: label, key: k, field: f });
        return;
      }
      // (i) 器を広げた列(旧生成物に無かった列が増えただけ。値の変更ではない)。旧に列が存在する場合は許容しない
      if (label.startsWith('pokemon') && ADDED_VIEW_FIELDS.has(f) && lv === undefined) {
        report.allowlisted.push({ entity: label, key: k, field: f, reason: '(i) 新設列(display_name=一覧表の短い表示名・2026-09-03 阿部さん、genderless/gender_female_pct=性別(2026-09-03))' });
        return;
      }
      if (label.startsWith('waza') && AUDITED_MOVE_FIX_FIELDS.has(k) && AUDITED_MOVE_FIX_FIELDS.get(k).has(f)) {
        report.allowlisted.push({ entity: label, key: k, field: f, reason: '(g) 監査確定の修正(reference/_moves_fixes.json 根拠つき・slug×列の単位)' });
        return;
      }
      // (h) R4(2026-09-03 阿部さん): season は「現行」と「次」の2枠だけ。旧の季から終わったレギュ(M-A等)が外れただけの差
      if (label === 'pokemon_all' && f === 'season' && Array.isArray(lv) && Array.isArray(nv) && LIVE_REGS.length) {
        const lvLive = lv.filter(v => LIVE_REGS.includes(v));
        const extra = nv.filter(v => !lvLive.includes(v));
        if (nv.every(v => LIVE_REGS.includes(v)) && lvLive.every(v => nv.includes(v))
            && (extra.length === 0 || (extra.length === 1 && extra[0] === REG_NEWEST && nRow.champions !== false))) {
          report.allowlisted.push({ entity: label, key: k, field: f, reason: '(h) R4 季は現行+次の2枠だけ(終わったレギュを外した/次レギュの印を足しただけ)' });
          return;
        }
      }
      // (i) R4(2026-09-03): Champions版にも season 列を新設(旧版に無かった列)。値は全国版の同名行と同一であることを条件に許す
      if (label === 'pokemon_champions' && f === 'season' && lv === undefined && Array.isArray(nv)
          && nv.every(v => LIVE_REGS.includes(v)) && NATIONAL_SEASON_BY_NAME.has(k) && eq(NATIONAL_SEASON_BY_NAME.get(k), nv)) {
        report.allowlisted.push({ entity: label, key: k, field: f, reason: '(i) R4 Champions版に season 列を新設(値=全国版と同一・pokemon_db_v9のSSN列が読む)' });
        return;
      }
      // (e'') 旧の季が空だったChampions収録の姿(名寄せ違い由来の33行)に現行レギュを入れた差
      //   ★R4(2026-09-03): 累積なので「現行+次」(LIVE_REGS の部分集合・順序どおり)まで許す(旧=現行1件だけ)
      if (label === 'pokemon_all' && f === 'season' && Array.isArray(lv) && lv.length === 0 && Array.isArray(nv) && nv.length >= 1
          && nv.every(v => LIVE_REGS.includes(v)) && nRow.champions !== false) {
        report.allowlisted.push({ entity: label, key: k, field: f, reason: '旧の季[]はChampions名寄せ違い由来。champions収録の姿に現行(+次)レギュを付与(2026-09-01/R4 2026-09-03 累積)' });
        return;
      }
      // (e') 次レギュ予定の印: season が 旧∪['M-C'] になっただけの差(2026-09-01 M-C予告分=ゴリランダー/セグレイブ)
      if (label === 'pokemon_all' && f === 'season' && Array.isArray(lv) && Array.isArray(nv)
          && nv.length === lv.length + 1 && nv[nv.length - 1] === 'M-C' && lv.every((v, i) => nv[i] === v)) {
        report.allowlisted.push({ entity: label, key: k, field: f, reason: '次レギュ(M-C)予定の印を season に追加(規則=現行より後のレギュのみ足す)' });
        return;
      }
      if (label === 'items' && EMPTY_TO_FILLED_ALLOWED_FIELDS.has(f) && isEmptyVal(lv) && !isEmptyVal(nv)) {
        report.allowlisted.push({ entity: label, key: k, field: f, reason: '旧は未実装スケルトンで空欄・新はjoinで補完(改善)' });
        return;
      }
      // (k) B-3(2026-09-04): 器を広げた際に PokeAPI と名寄せして埋めた pokeapi_slug(旧は18件だけ持っていた)。
      //   許すのは「旧が空」かつ「PokeAPI生データ(reference/_pokeapi_items_raw.json)の ja名(zen2han)がこの行の name と一致」する時だけ
      //   =名寄せの正しさをデータで確かめる(推測の slug は通さない)。
      if (label === 'items' && f === 'pokeapi_slug' && isEmptyVal(lv) && typeof nv === 'string'
          && POKEAPI_ITEMS_RAW[nv] && zen2han((POKEAPI_ITEMS_RAW[nv].names || {}).ja).trim() === String((newByKey.get(k) || {}).name)) {
        report.allowlisted.push({ entity: label, key: k, field: f, reason: '(k) B-3 pokeapi_slug を PokeAPI と ja名一致で補完(器を広げる工程・2026-09-04)' });
        return;
      }
      // (j) R1(2026-09-03): items に新設した added_in/season(旧版に無かった列。pokemon系ビューと同じモデル)。
      //   added_in=LIVE_REGS(現行/次)のどれかであることだけ確認(値の中身は監査対象=_items_fixes.jsonが根拠)。
      if (label === 'items' && f === 'added_in' && lv === undefined && typeof nv === 'string' && LIVE_REGS.includes(nv)) {
        report.allowlisted.push({ entity: label, key: k, field: f, reason: '(j) R1 items に added_in 列を新設(値∈現行/次)' });
        return;
      }
      //   season=全要素がLIVE_REGSの部分集合、かつ非Championsの行(master/items.json champions===false)は[]のはず(足さない)。
      if (label === 'items' && f === 'season' && lv === undefined && Array.isArray(nv)
          && nv.every(v => LIVE_REGS.includes(v))
          && (nv.length === 0 || MASTER_ITEMS_CHAMPIONS_BY_KEY.get(k) === true)) {
        report.allowlisted.push({ entity: label, key: k, field: f, reason: '(j) R1 items に season 列を新設(値∈現行/次・非champions行は[])' });
        return;
      }
      fieldDiffUnexplained++;
      report.unexplained.push({ entity: label, key: k, field: f, legacy: lv, new: nv });
    });
  });
  report.summary[label] = {
    legacy_count: legByKey.size, new_count: newByKey.size,
    only_in_new: onlyInNew.length, only_in_legacy: onlyInLegacy.length,
    common: common.length, field_diffs: fieldDiffCount, field_diffs_unexplained: fieldDiffUnexplained,
  };
  return { onlyInNew, onlyInLegacy };
}

function arrToMap(arr, keyFn) { const m = new Map(); arr.forEach(x => m.set(keyFn(x), x)); return m; }

function main() {
  const legacy = loadLegacy();
  const neu = loadNew();

  // ── POKEMON_LIST(全国版) ── リネーム別名を考慮したエイリアス照合
  {
    const newIdx = buildAliasedIndex(neu.A.POKEMON_LIST, p => p.name);
    const legIdx = new Map(); legacy.A.POKEMON_LIST.forEach(p => { const k = zen2han(p.name); if (!legIdx.has(k)) legIdx.set(k, p); });
    diffRows('pokemon_all', legIdx, newIdx, POKEMON_FIELD_ALLOWLIST, POKEMON_MULTISET_GROUPS);
  }
  // ── POKEMON_LIST(Champions) ──
  {
    buildAliasedIndex(neu.A.POKEMON_LIST, p => p.name).forEach((p, k) => NATIONAL_SEASON_BY_NAME.set(k, Array.isArray(p.season) ? p.season : []));
    const newIdx = buildAliasedIndex(neu.C.POKEMON_LIST, p => p.name);
    const legIdx = new Map(); legacy.C.POKEMON_LIST.forEach(p => { const k = zen2han(p.name); if (!legIdx.has(k)) legIdx.set(k, p); });
    diffRows('pokemon_champions', legIdx, newIdx, POKEMON_CHAMPIONS_FIELD_ALLOWLIST, POKEMON_MULTISET_GROUPS);
  }
  // ── WAZA_MAP(全国版) ── キー=slug。learnersは専用分類器へ(下記)
  const waMapL = new Map(Object.entries(legacy.A.WAZA_MAP)), waMapN = new Map(Object.entries(neu.A.WAZA_MAP));
  diffRows('waza_all', waMapL, waMapN, WAZA_ALL_FIELD_ALLOWLIST, null, new Set(['learners']));
  // ── WAZA_MAP(Champions) ── キー=champions_key。learnersは専用分類器へ
  const wcMapL = new Map(Object.entries(legacy.C.WAZA_MAP)), wcMapN = new Map(Object.entries(neu.C.WAZA_MAP));
  diffRows('waza_champions', wcMapL, wcMapN, WAZA_CHAMPIONS_FIELD_ALLOWLIST, null, new Set(['learners']));

  // ── learners専用分類 ── championsのポケモン集合(newの正典=neu.C.POKEMON_LISTの別名込み)
  const champNameSet = new Set();
  neu.C.POKEMON_LIST.forEach(p => {
    champNameSet.add(zen2han(p.name));
    (aliasCandidates[p.name] || []).forEach(a => champNameSet.add(zen2han(a)));
  });
  const champByName = { get: (n) => champNameSet.has(zen2han(n)) };
  diffLearners('waza_all', waMapL, waMapN, champByName, false);
  diffLearners('waza_champions', wcMapL, wcMapN, champByName, true);
  // ── ABILITY_DESC(全国版・Champions) ── 値は文字列なので{value:x}にラップして比較
  {
    const wrap = o => { const m = new Map(); Object.entries(o).forEach(([k, v]) => m.set(zen2han(k), { value: v })); return m; };
    diffRows('ability_desc_all', wrap(legacy.A.ABILITY_DESC), wrap(neu.A.ABILITY_DESC), new Set());
    diffRows('ability_desc_champions', wrap(legacy.C.ABILITY_DESC), wrap(neu.C.ABILITY_DESC), new Set());
  }
  // ── items ── キー=key(slug)優先、無ければname
  {
    const kf = it => it.key || it.name;
    diffRows('items', arrToMap(legacy.I.items, kf), arrToMap(neu.I.items, kf), ITEMS_FIELD_ALLOWLIST);
  }
  // ── STAT_RANK ── 意図的非再現。件数だけ報告(entity diffはしない)
  report.summary.stat_rank_legacy_national = { count: Object.keys(legacy.A.STAT_RANK || {}).length };
  report.summary.stat_rank_legacy_champions = { count: Object.keys(legacy.C.STAT_RANK || {}).length };
  report.summary.stat_rank_new = { count: Object.keys(neu.A.STAT_RANK || {}).length, note: '母集団=Champions全318体・命名規則も式も作り直し(意図的非再現。理由は最終報告参照)' };

  // ── POKEMON_WAZA ── 参考情報として件数のみ
  report.summary.pokemon_waza_national = { legacy: Object.keys(legacy.A.POKEMON_WAZA || {}).length, new: Object.keys(neu.A.POKEMON_WAZA || {}).length };
  report.summary.pokemon_waza_champions = { legacy: Object.keys(legacy.C.POKEMON_WAZA || {}).length, new: Object.keys(neu.C.POKEMON_WAZA || {}).length, note: '旧は275体のみ(古い母集団の生き残り・既知)。新は全318体' };

  // ── POKEMON_WAZA(全国版)の全数照合(2026-09-01・3回目の指示): learn∪learn_legacy∪confiscated化で
  //   欠け21,727→51件(12体)に減少。残る51件は(a)権威/データ差として全列挙。逆に新が多い分(masterが完全)は件数のみ。
  {
    const newIdx = new Map();
    Object.entries(neu.A.POKEMON_WAZA).forEach(([name, moves]) => {
      const k = zen2han(name);
      if (!newIdx.has(k)) newIdx.set(k, moves);
      (aliasCandidates[name] || []).forEach(alt => { const ak = zen2han(alt); if (!newIdx.has(ak)) newIdx.set(ak, moves); });
    });
    let missingTotal = 0, extraTotal = 0; const missingList = [];
    Object.entries(legacy.A.POKEMON_WAZA).forEach(([name, moves]) => {
      const nMoves = new Set((newIdx.get(zen2han(name)) || []).map(zen2han));
      const lMoves = new Set((moves || []).map(zen2han));
      const miss = [...lMoves].filter(m => !nMoves.has(m));
      const ext = [...nMoves].filter(m => !lMoves.has(m));
      missingTotal += miss.length; extraTotal += ext.length;
      if (miss.length) missingList.push({ name, miss });
    });
    report.categories.a.push({ field: 'pokemon_waza_national(missing・権威/データ差)', count: missingTotal, pokemon: missingList.length, detail: missingList });
    report.categories.a.push({ field: 'pokemon_waza_national(extra・masterが完全)', count: extraTotal });
  }

  // ── exportセット比較 ──
  const setDiff = (a, b) => a.filter(x => !b.includes(x));
  report.export_set_diff = {
    national_legacy_only: setDiff(Object.keys(legacy.A), Object.keys(neu.A)),
    national_new_only: setDiff(Object.keys(neu.A), Object.keys(legacy.A)),
    champions_legacy_only: setDiff(Object.keys(legacy.C), Object.keys(neu.C)),
    champions_new_only: setDiff(Object.keys(neu.C), Object.keys(legacy.C)),
    items_legacy_only: setDiff(Object.keys(legacy.I), Object.keys(neu.I)),
    items_new_only: setDiff(Object.keys(neu.I), Object.keys(legacy.I)),
  };
  // items静的メタ(schema_notes/todo)は段Cの意図的な非再現(ハードコード対象外・ボイラープレート扱い)
  report.export_set_diff.items_legacy_only = report.export_set_diff.items_legacy_only.filter(k => {
    const ok = k === 'schema_notes' || k === 'todo';
    if (ok) report.allowlisted.push({ entity: 'items(top-level)', field: k, reason: '静的メタ情報・段Cでは非再現(ハードコードしない判断)' });
    return !ok;
  });
  // ★R1(2026-09-03): regulation_mb(M-B固定文字列)→ regulations(MASTER.regulations由来)+ mega_rules に分割。
  //   消費元(tools/_build_items_list.js)を grep で確認・他に無いことを確認済み。
  report.export_set_diff.items_legacy_only = report.export_set_diff.items_legacy_only.filter(k => {
    const ok = k === 'regulation_mb';
    if (ok) report.allowlisted.push({ entity: 'items(top-level)', field: k, reason: '(j) R1 regulation_mb(M-B固定active_period)を廃止→regulations(MASTER.regulations由来)+mega_rulesに分割。消費元grep確認済み(他に無し)' });
    return !ok;
  });
  report.export_set_diff.items_new_only = report.export_set_diff.items_new_only.filter(k => {
    const ok = k === 'regulations' || k === 'mega_rules';
    if (ok) report.allowlisted.push({ entity: 'items(top-level)', field: k, reason: '(j) R1 regulation_mbの分割先として新設' });
    return !ok;
  });

  // ── 追加分の期待値チェック(additions.jsonと一致するか) ──
  const pkAdd = new Set(J('reference/_pokemon_additions.json').items.map(x => zen2han(x.name)));
  const itAddRaw = J('reference/_items_additions.json').items;
  const itAdd = new Set(itAddRaw.map(x => zen2han(x.slug || x.name)).concat(itAddRaw.map(x => zen2han(x.name))));
  const abAdd = new Set(J('reference/_abilities_additions.json').items.map(x => zen2han(x.name)));
  // ★2026-09-01発見: pokemon_all/pokemon_champions は additions.json(19件・段Cが直接扱った当日分)より
  //   広い master-only 集合を持つ(棚卸しドキュメント記載の「champions_authority 37 / ours_national 10 /
  //   ours_champions 2」=段A・段Bの時点で既にmasterにだけ在った行。additions.jsonは9/1当日分の追跡ファイルで
  //   これらは対象外)。データそのものの誤りではないので unexplained ではなく allowlisted(理由つき)に置く。
  const PRE_EXISTING_MASTER_ONLY_NOTE = 'pokemon: 棚卸しドキュメント(reference/_plans/legacy_only_assets_2026-09-01.json)記載の' +
    'master_only_by_source(champions_authority 37/ours_national 10/ours_champions 2)= 段Bより前から存在。additions.json追跡対象外。';
  function checkAdditions(label, onlyInNewKeys, expectedSet, note, preExistingOk) {
    const unexpected = onlyInNewKeys.filter(n => !expectedSet.has(zen2han(n)));
    report.summary[label + '_additions_check'] = { onlyInNewCount: onlyInNewKeys.length, unexpectedCount: unexpected.length, unexpected, note };
    if (unexpected.length) unexpected.forEach(n => {
      if (preExistingOk) report.allowlisted.push({ entity: label, key: n, field: '(entry only-in-new)', reason: PRE_EXISTING_MASTER_ONLY_NOTE });
      else report.unexplained.push({ entity: label, key: n, field: '(entry only-in-new, not in additions.json)' });
    });
  }
  checkAdditions('pokemon_all', report.additions.pokemon_all, pkAdd, '全国版POKEMON_LISTのみに居る行(masterのみ)は_pokemon_additions.jsonのはず', true);
  checkAdditions('pokemon_champions', report.additions.pokemon_champions, pkAdd, 'Champions版POKEMON_LISTのみに居る行', true);
  checkAdditions('items', report.additions.items, itAdd, 'itemsのみに居る行は_items_additions.jsonのはず');
  checkAdditions('ability_desc_all', report.additions.ability_desc_all, abAdd, 'ABILITY_DESC(全国版)のみに居るキー', true);
  checkAdditions('ability_desc_champions', report.additions.ability_desc_champions, abAdd, 'ABILITY_DESC(Champions版)のみに居るキー', true);
  report.summary.waza_all_additions_check = { onlyInNewCount: report.additions.waza_all.length, names: report.additions.waza_all };
  if (report.additions.waza_all.length) report.additions.waza_all.forEach(k => report.unexplained.push({ entity: 'waza_all', key: k, field: '(entry only-in-new, unexpected)' }));
  report.summary.waza_champions_additions_check = { onlyInNewCount: report.additions.waza_champions.length, names: report.additions.waza_champions };
  if (report.additions.waza_champions.length) report.additions.waza_champions.forEach(k => report.unexplained.push({ entity: 'waza_champions', key: k, field: '(entry only-in-new, unexpected)' }));

  // ── legacy専用(のはず=0) チェック ──
  // ★2026-09-01 修正: pokemon系はNAMEMAPエイリアスでentity照合するため、全角名/リネームは
  //   「commonだがname値が違う」扱いになり、ここ(only_in_legacy)には出てこなくなった
  //   (name diffはPOKEMON_FIELD_ALLOWLISTで許容済み)。従って旧HANKAKU_NAME_DIFFS_EXPECTEDの
  //   個別カウント一致チェックは不要になったため削除(=hankaku-alphanumeric-ruleの14件は
  //   name-field diffとして許容リストに載っている)。
  const legacyOnlyPokemonAll = report.entity_only_in_legacy.pokemon_all || [];
  if (legacyOnlyPokemonAll.length) legacyOnlyPokemonAll.forEach(k => report.unexplained.push({ entity: 'pokemon_all', key: k, field: '(entry missing in new)' }));

  const waza_champions_only_in_legacy_expected = 2; // 497中1件はchampions_key欠落で除外・frozen orderとの差1件=計2件許容
  // ★ability_desc_champions: masterでchampions:falseになっている3特性(グラスメイカー/ミストメイカー/
  //   サイコメイカー=フィールド生成系)。legacyのChampions版ABILITY_DESCには居るが、masterの
  //   champions_pokemon_countがそれらを使うポケモンを拾えていない(既知のmasterデータの穴・段Cのスコープ外)。
  const AB_CHAMP_KNOWN_MISSING = new Set(['グラスメイカー', 'ミストメイカー', 'サイコメイカー']);
  ['pokemon_champions', 'waza_all', 'ability_desc_all', 'items'].forEach(label => {
    const arr = report.entity_only_in_legacy[label] || [];
    if (arr.length) arr.forEach(k => report.unexplained.push({ entity: label, key: k, field: '(entry missing in new)' }));
  });
  {
    const arr = report.entity_only_in_legacy.ability_desc_champions || [];
    arr.forEach(k => {
      if (AB_CHAMP_KNOWN_MISSING.has(zen2han(k))) report.allowlisted.push({ entity: 'ability_desc_champions', field: '(entry missing in new)', key: k, reason: 'masterでchampions:falseになっている既知の穴(グラスメイカー等3件)' });
      else report.unexplained.push({ entity: 'ability_desc_champions', key: k, field: '(entry missing in new)' });
    });
  }
  {
    const arr = report.entity_only_in_legacy.waza_champions || [];
    if (arr.length && arr.length <= waza_champions_only_in_legacy_expected) {
      report.allowlisted.push({ entity: 'waza_champions', field: 'only_in_legacy(champions_key欠落によりmasterから除外・報告に明記)', names: arr });
    } else if (arr.length) {
      arr.forEach(k => report.unexplained.push({ entity: 'waza_champions', key: k, field: '(entry missing in new)' }));
    }
  }

  // ── items: mega_types/mega_stats(2026-09-01・3回目指示②)は「masterを正として採用」= (a)扱い。
  //   旧/新の値を全件列挙する。mega_ability_desc は今回mega_ability_desc_house移送で解消見込み
  //   (残れば known_unresolved へ・想定0件)。
  {
    const CAT_A_LISTED_FIELDS = new Set(['mega_types', 'mega_stats']);
    const KNOWN_UNRESOLVED_FIELDS = new Set(['mega_ability_desc']);
    const stillUnexplained = [];
    const movedToA = { mega_types: [], mega_stats: [] };
    const movedToUnresolved = { mega_ability_desc: [] };
    report.unexplained.forEach(d => {
      if (d.entity === 'items' && CAT_A_LISTED_FIELDS.has(d.field)) {
        movedToA[d.field].push({ item: d.key, legacy: d.legacy, new: d.new });
      } else if (d.entity === 'items' && KNOWN_UNRESOLVED_FIELDS.has(d.field)) {
        movedToUnresolved[d.field].push(d.key);
      } else stillUnexplained.push(d);
    });
    report.unexplained = stillUnexplained;
    Object.entries(movedToA).forEach(([field, rows]) => {
      if (rows.length) report.categories.a.push({
        field: `items.${field}`, count: rows.length,
        reason: 'masterのpokemon.json(権威)を正として採用。旧items_database.jsの値と食い違う分を全列挙。', detail: rows,
      });
    });
    Object.entries(movedToUnresolved).forEach(([field, keys]) => {
      if (keys.length) report.known_unresolved.push({
        field: `items.${field}`, pairs: keys.length, items: keys,
        reason: 'items_database.js独自の短い言い換え文(mega_ability_desc_house移送後も残る差分=要確認)。',
      });
    });
  }

  // ── report.allowlisted をカテゴリ(a)〜(e)へ再集計(件数根拠として明記) ──
  const CAT_A_FIELDS = new Set(['pp', 'power', 'accuracy', 'target', 'flags', 'national_new',
    'type', 'battle_data', 'priority', 'description', ...MOVE_FLAG_KEYS]);
  const CAT_C_FIELDS = new Set(['weight_kg', 'form', 'name']);
  const CAT_D_FIELDS = new Set(['name_en', 'mega_ability', 'mega_target_en', 'category']);
  const catCount = { a: 0, b: 0, c: 0, d: 0, e: 0, g: 0 };
  // (g) 監査確定修正(reference/_moves_fixes.json・根拠つき)= (a)の内数として別掲(2026-09-02)
  let AUDITED_MOVE_FIXES = new Set();
  try { AUDITED_MOVE_FIXES = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'reference/_moves_fixes.json'), 'utf8')).fixes || {})); } catch (e) {}
  report.allowlisted.forEach(d => {
    if (d.entity && d.entity.startsWith('waza') && AUDITED_MOVE_FIXES.has(d.key)) catCount.g++;
    if (d.reason && d.reason.includes('multiset')) catCount.b++;
    else if (d.reason && d.reason.includes('改善')) { catCount.d++; }
    else if (d.reason && (d.reason.includes('全角名14件') || d.reason.includes(PRE_EXISTING_MASTER_ONLY_NOTE) || d.reason.includes('champions_key欠落'))) catCount.e++;
    else if (d.field && CAT_A_FIELDS.has(d.field)) catCount.a++;
    else if (d.field && CAT_C_FIELDS.has(d.field)) catCount.c++;
    else if (d.field && CAT_D_FIELDS.has(d.field)) catCount.d++;
    else catCount.e++; // additions等(entry only-in-new)
  });
  const learnersA = report.categories.a.filter(x => x.field.endsWith('.learners'));
  const learnersACount = learnersA.reduce((s, x) => s + x.count, 0);
  report.category_summary = {
    a_authority_overwrite: catCount.a,
    g_audited_move_fixes_within_a: catCount.g + '件(reference/_moves_fixes.json ' + AUDITED_MOVE_FIXES.size + '技・根拠つき)',
    a_learners_authority: learnersACount,
    b_ability_slot_type_order: catCount.b,
    c_official_naming: catCount.c,
    d_items_corrections: catCount.d,
    e_additions_and_known_gaps: catCount.e,
    f_stat_rank_population_change: 'national=1273体母集団(旧はChampions表の写し) / champions=318体母集団(旧は275体の不完全母集団)。意図した変更',
  };

  // ── 出力 ──
  const outPath = path.join(ROOT, 'reference/_views_diff_report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 1));

  console.log('=== views diff summary ===');
  Object.entries(report.summary).forEach(([k, v]) => console.log(' ', k, JSON.stringify(v)));
  console.log('export_set_diff:', JSON.stringify(report.export_set_diff));
  console.log('category_summary:', JSON.stringify(report.category_summary));
  console.log('known_unresolved:', JSON.stringify(report.known_unresolved));
  console.log('allowlisted diffs:', report.allowlisted.length);
  console.log('UNEXPLAINED diffs:', report.unexplained.length);
  if (report.unexplained.length) {
    console.log('--- first 60 unexplained ---');
    report.unexplained.slice(0, 60).forEach(d => console.log(' ', JSON.stringify(d).slice(0, 300)));
  }
  console.log('full report:', outPath);
  process.exit(report.unexplained.length ? 1 : 0);
}
main();
