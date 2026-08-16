#!/usr/bin/env node
/* tools/build_master_v2.js — ★マスターデータ(master/)の生成器
 *
 * 目的(2026-07-29 阿部さん):「データは一つ。絶対に一つ。」
 *   一本化した大本のデータ =「**マスターデータ**」。置き場所は master/ ただ1つ。
 *
 * ★この生成器は「別で作ってから入れ替える」の“別で作る”側。
 *   **既存ファイルを1バイトも変更しない**。出力は master/ の新規ファイルのみ。
 *
 * 器と中身(設計_データSSOT一本化_2026-07-28.md §9):
 *   - **器(範囲)= 全国版**(1219体 / 919技 / 310特性 / 167持ち物)
 *   - **中身(値)の正典 = Champions**。Championsに在るものはChampions版の値で上書き
 *   - Championsに無いものは最新世代の値を入れ、source に由来を残す
 *
 * 入力(すべて読み取り専用):
 *   pokechan_data.js / pokechan_data_all.js / items_database.js
 *   reference/_authority_corpus_ch/*.json(Champions権威)
 *   reference/_name_normalize.json(名前の正規化)
 *
 * 出力: master/{abilities,items,moves,pokemon,learnsets,regulations}.json
 * 実行: node tools/build_master_v2.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'master');
const NOW = new Date().toISOString().slice(0, 10);
const REGULATION = 'M-B';                       // 現行レギュレーション(2026-07-29 阿部さん確定)

// ── 入力 ────────────────────────────────────────────────────────────
const C = require(path.join(ROOT, 'pokechan_data.js'));        // Champions版(値の正典)
const A = require(path.join(ROOT, 'pokechan_data_all.js'));    // 全国版(器)
global.window = global.window || {};
require(path.join(ROOT, 'items_database.js'));
const ITEMS_DB = global.window.ITEMS_DATABASE;
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const AUTH = {
  abilities: J('reference/_authority_corpus_ch/abilities_ch.json'),
  moves:     J('reference/_authority_corpus_ch/moves_ch.json'),
  lists:     J('reference/_authority_corpus_ch/lists_ch.json'),
  learnsets: J('reference/_authority_corpus_ch/learnsets_ch.json'),
};
const NAMEMAP = (() => {
  try {
    const d = J('reference/_name_normalize.json');
    const rows = Array.isArray(d) ? d : (d.rows || []);
    const m = {};
    // ★キーは display_name(いまのChampions表記) → official_name(正式名称)
    //   2026-07-30: champions_name というキーは存在せず、名前の正式化が効いていなかった
    rows.forEach(r => { if (r.display_name) m[r.display_name] = r; });
    return m;
  } catch (e) { return {}; }
})();

// ★英語slug対応表(tools/_match_pokemon_slugs.py が生成。種族値+タイプ+特性の一致で検証済み)
const SLUGMAP = (() => {
  try {
    const d = J('reference/_pokemon_slug_map.json');
    const m = {};
    (d.matched || []).forEach(r => { m[r.name] = r.slug; });
    return m;
  } catch (e) { return {}; }
})();

// ── 共通ヘルパ ──────────────────────────────────────────────────────
const zen2han = s => String(s == null ? '' : s).replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
const norm = s => zen2han(s).replace(/[()（）\s]/g, '').replace(/のすがた|フォルム/g, '');
const stamp = (src) => ({ source: src, verified_at: NOW });
// ★世代の控え: 全国版に行が無い(メガ/Champions権威由来)場合は図鑑No.から種の世代を出す
//   慣例に合わせる: 地方のすがたも元の種の世代(コラッタ(アローラ)=1・メガフシギバナ=1)
const genFromNo = (no) => {
  const n = Number(no);
  if (!Number.isFinite(n) || n < 1) return null;
  if (n <= 151) return 1; if (n <= 251) return 2; if (n <= 386) return 3;
  if (n <= 493) return 4; if (n <= 649) return 5; if (n <= 721) return 6;
  if (n <= 809) return 7; if (n <= 905) return 8; if (n <= 1025) return 9;
  return null;
};
// ★決められない値は勝手に決めず null を入れて unknowns に積む(推測で埋めない)
const unknowns = [];
const unk = (kind, key, why) => { unknowns.push({ kind, key, why }); return null; };

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
// ★verified_at の保全: 中身が1バイトも変わらない行は前回の日付を保つ
//   (再ビルドのたびに919件の日付だけが書き変わり、本当の差分が埋もれていた 2026-07-31 宿題)
const keepDates = (name, obj) => {
  try {
    // ★J()はROOT起点の相対パス専用。ここは絶対パスなので fs を直接使う
    const prev = JSON.parse(fs.readFileSync(path.join(OUT, name), 'utf8'));
    if (!Array.isArray(obj.items) || !Array.isArray(prev.items)) return;
    const keyOf = it => `${it.slug ?? ''}|${it.no ?? ''}|${it.name ?? ''}|${it.form ?? ''}`;  // slug=同名Zワザ(物理/特殊)の区別
    const bodyOf = it => JSON.stringify(Object.assign({}, it, { verified_at: null }));
    const prevMap = new Map();
    prev.items.forEach(it => {
      const k = keyOf(it);
      prevMap.set(k, prevMap.has(k) ? null : it);  // キー重複は安全側=保全しない
    });
    obj.items.forEach(it => {
      if (!('verified_at' in it)) return;
      const old = prevMap.get(keyOf(it));
      if (old && old.verified_at && bodyOf(old) === bodyOf(it)) it.verified_at = old.verified_at;
    });
  } catch (e) { /* 前回ファイルが無ければそのまま */ }
};
const write = (name, obj) => {
  keepDates(name, obj);
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1) + '\n');
  const n = Array.isArray(obj.items) ? obj.items.length : (obj.count || '?');
  console.log(`  ✍ master/${name}  ${n}件`);
};
const META = (what, extra) => Object.assign({
  what, generated_at: NOW, generator: 'tools/build_master_v2.js',
  rule: 'データは一つ。マスターデータは master/ にしかない。修正も追加もここだけ。',
  canon: '器=全国版の範囲 / 値の正典=Champions → 無ければ最新世代(source に由来を残す)',
  regulation_current: REGULATION,
}, extra || {});

// ══════════════════════════════════════════════════════════════════
// 1) abilities.json
// ══════════════════════════════════════════════════════════════════
// ★ナビ欄(「関連する項目…」)を効果文から落とす(2026-08-15 特性監査の前処理で59件を機械検出)。
//   出どころ= ヤックン/ch/ のスクレイプが、ページ下部の関連リンク欄まで効果文に取り込んでいた(コーパス側62件)。
//   コーパスは生の記録なので触らず、master生成時に落とす。
//   ★なぜ落とすか= 説明文はわざと短い設計([[pokemon-text-is-deliberately-short]])。関連リンクを説明文に
//   混ぜると「その特性の効果」だと誤読される(2026-07-30に同じ型のバグを26件直した実績あり)。
//   全59件の切り取り位置を機械検査済み(切った後が短すぎるものは0件)。
function stripNavi(s) {
  if (typeof s !== 'string') return s;
  return s.split(/関連する項目|関連項目/)[0].trim();
}

function buildAbilities() {
  const authByName = {};
  AUTH.abilities.abilities.forEach(a => { authByName[a.name] = a; });
  // 器 = 全国版の特性(ABILITY_DESC)+ Championsのポケモンが実際に持つ特性 + 権威
  // ★名前は半角に正規化してから集める(2026-08-15)。全国版に『ＡＲシステム』(全角)があり、権威の
  //   『ARシステム』(半角)と別項目として2行に分かれていた=同じ特性の重複。英数字は半角が家のルール
  //   ([[hankaku-alphanumeric-rule]]・全角は名寄せを静かに壊す)。
  const names = new Set([
    ...Object.keys(A.ABILITY_DESC || {}),
    ...Object.keys(C.ABILITY_DESC || {}),
    ...Object.keys(authByName),
  ].map(zen2han));
  // 全国版の説明は半角キーで引けるようにしておく(元データに全角キー『ＡＲシステム』がある)
  const natDesc = {};
  Object.entries(A.ABILITY_DESC || {}).forEach(([k, v]) => { natDesc[zen2han(k)] = v; });
  // Championsのポケモンが実際に持つ特性(印の根拠。champions.in フラグは信用しない=2026-07-28に10件漏れていた)
  // ★champions_pokemon_count は Champions のポケモン一覧から**自分で数える**(2026-08-15)。
  //   以前は権威コーパスの同名フィールドを写していたが、2026-08-15にコーパスを取り直した際に
  //   このフィールドを落としてしまい、311件すべてが0になる退行を起こした(特性監査R1が検出)。
  //   → 外部の値を写すのをやめ、うちのポケモンデータから数える(自己完結=同じ事故が起きない)。
  const usedInChampions = new Set();
  const chCount = {};
  C.POKEMON_LIST.forEach(p => {
    const seen = new Set();                          // 同じポケモンが同じ特性を2枠持つ場合の二重計上を防ぐ
    ['ab1', 'ab2', 'ab3'].forEach(k => {
      if (!p[k] || seen.has(p[k])) return;
      seen.add(p[k]);
      usedInChampions.add(p[k]); names.add(p[k]);
      chCount[p[k]] = (chCount[p[k]] || 0) + 1;
    });
  });

  const items = [...names].filter(Boolean).sort().map(name => {
    const au = authByName[name];
    const inCh = usedInChampions.has(name) || !!(au && au.champions_pokemon_count);
    // ★説明文: 公式のゲーム内テキスト(Champions)を最優先 → 権威の効果文 → うちの既存
    let effect = null, src = null;
    if (au && au.effect) { effect = au.effect; src = 'champions_authority'; }
    else if (C.ABILITY_DESC && C.ABILITY_DESC[name]) { effect = C.ABILITY_DESC[name]; src = 'ours_champions'; }
    else if (natDesc[name]) { effect = natDesc[name]; src = 'ours_national'; }
    else { effect = unk('ability_effect', name, '権威にもうちにも説明が無い'); src = 'unknown'; }
    return Object.assign({
      slug: null,                        // ★英語slugは未確定(PokeAPI照合が要る)→ unknown として残す
      name, display_name: name,
      effect_ja: stripNavi(effect),
      champions: inCh,
      regulation: inCh ? REGULATION : null,
      champions_pokemon_count: chCount[name] || 0,
      name_en: au ? (au.en || null) : null,
    }, stamp(src));
  });
  items.filter(x => !x.name_en).forEach(x => unk('ability_slug', x.name, '英語名が権威に無い=slug未確定'));
  // ★監査で確定した修正を適用(reference/_abilities_fixes.json・全件根拠つき。持ち物と同じ仕組み)
  //   これが無いと、master/abilities.json を手で直しても再ビルドで静かに元に戻る(2026-08-16に気づいた)。
  //   effect_ja は上で「権威の効果文をそのまま」入れているので、権威側の誤り・未検証メモまで写る。
  //   ここで1件ずつ根拠つきに上書きする。
  try {
    const fx = J('reference/_abilities_fixes.json').fixes || {};
    items.forEach(it => {
      const f = fx[it.name];
      if (!f) return;
      ['effect_ja', 'name_en'].forEach(k => { if (f[k] != null) it[k] = f[k]; });
      if (f.effect_ja != null) it.source = 'audited';
    });
  } catch (e) {}

  write('abilities.json', { meta: META('特性', {
    fixes: '監査確定の修正は reference/_abilities_fixes.json(根拠つき)から適用',
  }), count: items.length,
    champions_count: items.filter(x => x.champions).length, items });
  return items.length;
}

// ══════════════════════════════════════════════════════════════════
// 2) items.json
// ══════════════════════════════════════════════════════════════════
// ★applies_to(持ち物の対象ポケモン名)を、マスターに実在する名前の配列へ展開する。
//   ①完全一致があればそれ ②無ければ「基本名で始まる」ものを全部(ニャオニクス → オス/メスのすがた)
//   ③メガ形も拾う(メガニャオニクス♀♂)。1つも見つからなければ null(推測で作らない)。
let _pkNamesCache = null;
function pkNames() {
  if (!_pkNamesCache) {
    _pkNamesCache = A.POKEMON_LIST.map(p => p.name);
    C.POKEMON_LIST.forEach(p => { const r = NAMEMAP[p.name]; const n = (r && r.official_name) ? r.official_name : p.name; if (!_pkNamesCache.includes(n)) _pkNamesCache.push(n); });
  }
  return _pkNamesCache;
}
// 『physical_attack』のような英小文字+アンダースコアの識別子は「補正の対象」であってポケモン名ではない
function looksLikeDescriptor(v) { return typeof v === 'string' && /^[a-z0-9_]+$/.test(v); }

// ★boosts(=何が上がるか)の是正表(2026-08-13 監査ラウンド3・Wiki+徹底攻略の二重チェック済み)
//   旧実装は applies_to(=発動条件)をそのまま boosts に複写していたため、条件と上昇対象が違う持ち物で
//   意味が壊れていた。ここは「条件」ではなく「上がるもの」だけを書く。basis は権威の引用。
const BOOSTS_FIX = {
  'のどスプレー': { value: 'special_attack',
    basis: 'Wiki効果節「音のわざを使用した後、自分のとくこうを1段階上げる。」/ 徹底攻略SV「…を使ったときに『とくこう』ランクが1段階上がる。」→ 条件=音技(sound_moves)・上がるのは とくこう' },
  'ブーストエナジー': { value: 'highest_stat_except_hp',
    basis: 'Wiki効果節「ランク補正込みで最も高い能力を上げる。…上げる能力にHPは含めない。」(攻/防/特攻/特防=1.3倍・素早さ=1.5倍)→ 条件=こだいかっせい/クォークチャージ・上がるのは HP以外の最高能力' },
  'いかさまダイス': { value: 'multi_hit_count',
    basis: 'Wiki効果節「2~5回当たる連続攻撃技を使用したとき、攻撃回数が必ず4回以上になる。」→ 条件=連続攻撃技・上がるのは 攻撃回数' },
  'パンチグローブ': { value: 'punch_move_power',
    basis: 'Wiki効果節「持たせたポケモンが以下のパンチ技を使用したとき威力が1.1倍になり、直接攻撃ではなくなる。」→ 上がるのは パンチ技の威力(ちからのハチマキ=physical_damage と同じ粒度に揃える)' },
  'ひかりのこな': { value: 'opponent_accuracy_down',
    basis: 'Wiki効果節「持たせたポケモンに対するわざの命中率が0.9倍になる」→ 自分の回避率が上がるのではなく、相手の命中率が下がる機構。evasion(回避ランク)と同一視すると誤実装になる' },
};
function expandAppliesTo(base) {
  if (!base || typeof base !== 'string') return null;
  if (looksLikeDescriptor(base)) return null;        // ★補正の対象なので、ポケモン名としては扱わない
  const all = pkNames();
  if (all.includes(base)) return [base];
  // ★『メガ+base』は拾わない(2026-08-13 R4で発見)。メガストーンは**まだメガ進化していない**
  //   ポケモンに持たせる道具なので、applies_to_pokemon に既にメガ進化した姿を入れるのは誤り。
  //   実害: ニャオニクスナイトに『メガニャオニクス♀/♂』が入っていた(=メガ済みにも持たせられると
  //   読めてしまう)。★base 自身が『メガ』で始まる名前(メガニウム等)は正当なので除外しない。
  const hit = all.filter(n => n === base || n.startsWith(base + '(') || n.startsWith(base + ' '));
  return hit.length ? hit : null;
}

function buildItems() {
  const flat = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      if (o.name && (o.key || o.effect || o.category)) flat.push(o);
      Object.values(o).forEach(walk);
    }
  })(ITEMS_DB);
  const seen = new Set();
  const ours = flat.filter(x => { const k = x.key || x.name; if (seen.has(k)) return false; seen.add(k); return true; });
  const authNames = new Set((AUTH.lists.items.rows || []).map(r => r[0]));
  const authEffect = {}; (AUTH.lists.items.rows || []).forEach(r => { authEffect[r[0]] = r[1]; });

  // ★メガストーンの「戦闘中1回だけ」復元(2026-08-01 阿部さん決定「残していい」)
  //   権威(/ch/)の一覧文には無いが、旧データが持っていた事実(メガシンカは戦闘中1回)を失わない。
  //   ・「にメガシンカさせる。」の直後に差し込む(入手方法の文は一字も変えない=足さず減らさず)
  //   ・定型「2000VPで購入する。」だけは承認済みの「(2000VPで購入)」形式に
  const restoreOncePerBattle = (t) => {
    if (!t || t.includes('戦闘中1回') || !t.includes('にメガシンカさせる。')) return t;
    let s = t.replace(/『(メガ[^』]+)』にメガシンカさせる。/, '$1にメガシンカさせる。'); // 『』の表記ゆれ統一
    s = s.replace('にメガシンカさせる。', 'にメガシンカさせる。戦闘中1回だけ。');
    s = s.replace(/戦闘中1回だけ。2000VPで購入する。$/, '戦闘中1回だけ。(2000VPで購入)');
    return s;
  };

  const items = ours.map(it => {
    const inCh = authNames.has(it.name);
    const rawEffect = inCh ? (authEffect[it.name] || it.effect || null) : (it.effect || null);
    return Object.assign({
      slug: it.key || null,
      name: it.name, display_name: it.name, name_en: it.name_en || null,
      category: it.category || null,
      effect_ja: (it.category === 'mega_stone') ? restoreOncePerBattle(rawEffect) : rawEffect,
      // ★applies_to は「基本名」で書かれていることがある(例: ニャオニクスナイト → 『ニャオニクス』)。
      //   マスターの名前はフォーム名(『ニャオニクス(オスのすがた)』)なので、そのままでは一致せず
      //   **メガシンカが到達不能になる**(2026-07-30 GLMの独立検算で発見。フラエッテナイトと同じ型)。
      //   → 一致する名前の**配列**に展開しておく(照合する側は配列を見ればよい)。
      // ★applies_to は items_database で**2つの意味**に使われている(2026-07-30 発見):
      //   ①対象ポケモン(メガストーン)= 『ニャオニクス』『フラエッテ(えいえんのはな)』
      //   ②補正の対象(能力・技種別)= 『physical_attack』『speed』『sound_moves』
      //   → マスターデータでは**分ける**(同じ欄に別の意味を入れない)。
      applies_to: it.applies_to || null,                        // 旧データそのまま(移行用に残す)
      applies_to_pokemon: expandAppliesTo(it.applies_to),       // ①対象ポケモン(実在名の配列)
      // ★②補正の対象。旧実装は applies_to をそのまま複写していたが、applies_to は「発動条件」で
      //   ある場合が多く、「何が上がるか」を表していなかった(2026-08-13 監査ラウンド3で発見)。
      //   例: のどスプレー = 条件『音技を使った』/ 上がるのは『とくこう』。旧値は sound_moves で、
      //   sim がこの欄を読むと上昇対象を取り違える。→ BOOSTS_FIX で1件ずつ権威裏取りして上書きする。
      boosts: BOOSTS_FIX[it.name] !== undefined ? BOOSTS_FIX[it.name].value
            : (looksLikeDescriptor(it.applies_to) ? it.applies_to : null),
      implemented: it.implemented_in_pokechan === true,
      champions: inCh,
      regulation: inCh ? REGULATION : null,
    }, stamp(inCh ? 'champions_authority' : 'ours_national'));
  });
  // ★監査で確定した修正を適用(reference/_items_fixes.json・全件根拠つき。2026-08-02 阿部さん承認)
  try {
    const fx = J('reference/_items_fixes.json').fixes || {};
    items.forEach(it => {
      const f = fx[it.name];
      if (!f) return;
      ['name_en', 'category', 'effect_ja'].forEach(k => { if (f[k] != null) it[k] = f[k]; });
    });
  } catch (e) {}

  write('items.json', { meta: META('持ち物', {
    fixes: '監査確定の修正は reference/_items_fixes.json(根拠つき)から適用',
  }), count: items.length,
    champions_count: items.filter(x => x.champions).length, items });
  return items.length;
}

// ══════════════════════════════════════════════════════════════════
// 3) moves.json
// ══════════════════════════════════════════════════════════════════
function buildMoves() {
  const authByName = {};
  (AUTH.moves.moves || []).forEach(m => { authByName[m.name] = m; });
  const chByName = {}; Object.entries(C.WAZA_MAP).forEach(([k, m]) => { chByName[m.name] = Object.assign({ _champKey: k }, m); });
  const natByName = {}; Object.entries(A.WAZA_MAP).forEach(([k, m]) => { natByName[zen2han(m.name)] = Object.assign({ _slug: k }, m); });

  // ★キーは slug(英語)。名前をキーにすると、Z技の物理版/特殊版(breakneck-blitz--physical / --special)など
  //   **同名の別技が18件つぶれる**(2026-07-30に実際に潰れた=919→901)。設計どおり slug を主キーにする。
  const bySlug = new Map();
  Object.entries(A.WAZA_MAP).forEach(([slug, m]) => bySlug.set(slug, { nat: Object.assign({ _slug: slug }, m) }));
  Object.entries(C.WAZA_MAP).forEach(([ck, m]) => {
    const nz = zen2han(m.name);
    // Champions技は全国版の同名slugに合流(同名が複数ある場合は最初の1つ=Championsに専用Z技は無い)
    const hit = [...bySlug.entries()].find(([, v]) => v.nat && zen2han(v.nat.name) === nz);
    if (hit) hit[1].ch = Object.assign({ _champKey: ck }, m);
    else bySlug.set('champions:' + ck, { ch: Object.assign({ _champKey: ck }, m) });
  });
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };

  const items = [...bySlug.entries()].map(([slugKey, v]) => {
    const nat = v.nat, ch = v.ch;
    const nz = zen2han((nat && nat.name) || (ch && ch.name) || '');
    const au = authByName[nz] || (ch && authByName[ch.name]) || (nat && authByName[nat.name]);
    // ★コインビームは存在しない技=持ち込まない(2026-07-29 阿部さん決定)
    if (nz === 'コインビーム') return null;
    const inCh = !!au || (!!ch && !!authByName[(ch.name || '')]);
    const base = inCh && au ? au : null;
    const pri = ch ? ((ch.battle_data && ch.battle_data.priority) != null ? ch.battle_data.priority : (ch.priority || 0))
                   : (nat ? (nat.priority || 0) : 0);
    const src = inCh ? 'champions_authority' : (nat ? 'ours_national' : 'ours_champions');
    return Object.assign({
      slug: nat ? nat._slug : null,
      champions_key: ch ? ch._champKey : null,        // ★旧キーは _aliases として残す(引っ越し完了まで)
      // ★2026-07-31 修正(阿部さん決定: 数字は半角に揃える。「海外に全角は無いので」):
      //   ここは正規化済みの nz を作っておきながら、出力には全国版の生の名前(=全角)を使っていた。
      //   結果 master の中で表記が割れ、moves側『１０まんボルト』/ learnsets側『10まんボルト』となり、
      //   名前で突き合わせる工程で **141体分の技が静かに落ちる**状態だった(実測: 10まんボルト89体・
      //   10まんばりき47体・DDラリアット3体・3ぼんのや1体・Gのちから1体)。
      //   ★権威(ヤックン /ch/ の moves_ch・learnsets_ch)も Champions版データも半角なので、半角が正。
      name: nz || (nat && nat.name) || (ch && ch.name) || '',
      display_name: zen2han((ch && ch.name) || (nat && nat.name) || '') || nz,
      type: base ? base.type : (ch ? ch.type : (nat ? nat.type : null)),
      category: base ? base.category : (ch ? ch.category : (nat ? nat.category : null)),
      power: base ? num(base.power) : (ch ? (ch.power || null) : (nat ? (nat.power || null) : null)),
      accuracy: base ? num(base.accuracy) : (ch ? (ch.accuracy || null) : (nat ? (nat.accuracy || null) : null)),
      pp: base ? num(base.pp) : (ch ? (ch.pp || null) : (nat ? (nat.pp || null) : null)),
      priority: pri,                                   // ★置き場所を最上位に統一
      target: (ch && ch.target) || (nat && nat.target) || null,
      contact: (ch && ch.contact) != null ? ch.contact : ((nat && nat.contact) != null ? nat.contact : null),
      protect: (ch && ch.protect) != null ? ch.protect : ((nat && nat.protect) != null ? nat.protect : null),
      // ★説明文とeffectsは既存の資産をそのまま移送(作り直さない)
      description: (ch && ch.description) || (nat && nat.description) || null,
      description_legacy: (ch && ch.description_legacy) || (nat && nat.description_legacy) || null,
      battle_data: (ch && ch.battle_data) || (nat && nat.battle_data) || null,
      flags: (ch && ch.flags) || (nat && nat.flags) || null,
      tags: (nat && nat.tags) || null,
      move_no: (nat && nat.move_no) || (ch && ch.move_no) || null,
      champions: inCh,
      regulation: inCh ? REGULATION : null,
    }, stamp(src));
  }).filter(Boolean).sort((a,b)=>(a.move_no||9999)-(b.move_no||9999) || String(a.name).localeCompare(String(b.name),'ja'));
  items.filter(x => !x.slug).forEach(x => unk('move_slug', x.name, '全国版に無い=英語slug未確定'));
  write('moves.json', { meta: META('技'), count: items.length,
    champions_count: items.filter(x => x.champions).length, items });
  return items.length;
}

// ══════════════════════════════════════════════════════════════════
// 4) pokemon.json
// ══════════════════════════════════════════════════════════════════
function buildPokemon() {
  const chByName = {}; C.POKEMON_LIST.forEach(p => { chByName[p.name] = p; });
  const natByNorm = {}; A.POKEMON_LIST.forEach(p => { natByNorm[norm(p.name)] = p; });
  const authStats = {}; (AUTH.lists.stats.rows || []).forEach(r => { authStats[norm(r[1])] = r; });

  const all = new Map();
  // ★全国版側にも正式名称変換(NAMEMAP)をかける(2026-08-01)。
  //   これが無いと『ケンタロス(パルデア・combat-breed)』(全国版の英語名残骸)と
  //   『ケンタロス(パルデア単)』(Champions)が別キーになり、同じポケモンが二重に載る。
  //   両方を同じ正式名称に変換すれば、この合流Mapが自然に1行へ統合する。
  A.POKEMON_LIST.forEach(p => {
    const off = (NAMEMAP[p.name] && NAMEMAP[p.name].official_name) || p.name;
    all.set(off, { nat: p });
  });
  C.POKEMON_LIST.forEach(p => {
    const officialRow = NAMEMAP[p.name];
    const official = (officialRow && officialRow.official_name) ? officialRow.official_name : p.name;
    const key = all.has(official) ? official : (natByNorm[norm(p.name)] ? natByNorm[norm(p.name)].name : p.name);
    const e = all.get(key) || {};
    e.ch = p; e.display = p.name; all.set(key, e);
  });

  const items = [...all.entries()].map(([name, e]) => {
    const p = e.ch || e.nat;
    const inCh = !!e.ch;
    const au = authStats[norm(name)] || (e.ch ? authStats[norm(e.ch.name)] : null);
    const stat = k => {
      if (inCh && au) {
        const idx = { hp: 2, atk: 3, def: 4, spatk: 5, spdef: 6, spd: 7, total: 8 }[k];
        const v = Number(au[idx]); if (Number.isFinite(v)) return v;
      }
      return p[k] != null ? p[k] : null;
    };
    return Object.assign({
      slug: SLUGMAP[name] || null,                   // ★検証済み対応表から(無ければ null のまま=推測で埋めない)
      no: p.no != null ? Number(p.no) : null,
      name,                                          // ★正式名称
      display_name: e.display || name,               // ★画面用の短い名前
      form: p.form || null, mega: !!p.mega,
      type1: p.type1 || null, type2: p.type2 || null,
      hp: stat('hp'), atk: stat('atk'), def: stat('def'),
      spatk: stat('spatk'), spdef: stat('spdef'), spd: stat('spd'), total: stat('total'),
      ab1: p.ab1 || null, ab2: p.ab2 || null, ab3: p.ab3 || null,
      weight_kg: p.weight_kg != null ? p.weight_kg : null,
      gen: (e.nat && e.nat.gen) || genFromNo(p.no), legend: (e.nat && e.nat.legend) || null,
      resist: p.resist || null,
      champions: inCh,
      regulation: inCh ? REGULATION : null,
    }, stamp(inCh && au ? 'champions_authority' : (inCh ? 'ours_champions' : 'ours_national')));
  });

  // ★手動追加(器を広げる時の入力。旧生成物に手書きしない・2026-08-01 新設)
  try {
    const adds = J('reference/_pokemon_additions.json');
    const have = new Set(items.map(x => x.name));
    (adds.items || []).forEach(a => {
      if (have.has(a.name)) return;                 // すでに居れば足さない(二重防止)
      items.push(Object.assign({}, a, { verified_at: NOW }));
    });
  } catch (e) {}

  // ★備考欄(阿部さん指示 2026-08-01「マスターに説明欄を絶対入れる。Claudeのため」)
  //   特殊なポケモン(見た目だけの色違いフォルム/バトル中しかならない姿/内部で別フォルム等)の意味を持たせる
  try {
    const notes = J('reference/_pokemon_notes.json').notes || {};
    items.forEach(x => { if (x.slug && notes[x.slug]) x.note = notes[x.slug]; });
  } catch (e) {}

  items.sort((a, b) => (a.no || 9999) - (b.no || 9999) || String(a.name).localeCompare(String(b.name), 'ja'));

  write('pokemon.json', { meta: META('ポケモン', {
    note_field: 'note=備考(そのポケモンの特殊事情。見た目だけのフォルム違い/バトル中限定の姿など。元=reference/_pokemon_notes.json)',
  }), count: items.length,
    champions_count: items.filter(x => x.champions).length, items });
  return items.length;
}

// ══════════════════════════════════════════════════════════════════
// 5) learnsets.json(★没収技を confiscated として保持)
// ══════════════════════════════════════════════════════════════════
function buildLearnsets() {
  const authByOurs = {};
  AUTH.learnsets.pokemon.forEach(e => { if (e.matched_ours) authByOurs[e.matched_ours] = e; });
  const chKeyToName = {}; Object.entries(C.WAZA_MAP).forEach(([k, m]) => { chKeyToName[k] = m.name; });

  const items = C.POKEMON_LIST.map(p => {
    const au = authByOurs[p.name];
    const oursKeys = (C.POKEMON_WAZA && C.POKEMON_WAZA[p.name]) || null;
    const oursNames = oursKeys ? oursKeys.map(k => chKeyToName[k] || k) : null;
    // ★覚える技: 権威(Champions)を正典。無ければうちの既存
    //   ★ただし「権威の抽出が明らかにおかしい」時はうちを使う(2026-07-30 メタモンで発覚)。
    //     メタモンの権威ページは構造が違い、抽出器が「紫」「第1世代」「一般ポケモン」などを技名として拾っていた。
    //     判定=権威の技名がうちの技リスト(WAZA_MAP)に1つも無い → 抽出失敗とみなす。
    const authLooksBroken = (list) => {
      if (!list || !list.length) return true;
      const known = list.filter(n => Object.values(C.WAZA_MAP).some(m => m.name === n));
      return known.length === 0;                        // 1つも実在の技名でなければ抽出失敗
    };
    let learn, learnSrc;
    if (au && !authLooksBroken(au.learn)) { learn = au.learn; learnSrc = 'champions_authority'; }
    else if (oursNames) { learn = oursNames; learnSrc = au ? 'ours_champions(権威の抽出が壊れていたため)' : 'ours_champions'; }
    else { learn = unk('learnset', p.name, '権威の抽出が壊れており、うちにも学習データが無い'); learnSrc = 'unknown'; }
    // ★名前はポケモン本体(pokemon.json)と同じ正式名称に揃える(NAMEMAP)。
    //   これまで Champions表記(イダイトウ♂ 等)のままで、名前照合が30体分切れていた(2026-08-01 発見)
    const officialRow = NAMEMAP[p.name];
    const official = (officialRow && officialRow.official_name) ? officialRow.official_name : p.name;
    return Object.assign({
      slug: SLUGMAP[official] || SLUGMAP[p.name] || null,
      name: official, display_name: p.name, no: p.no != null ? Number(p.no) : null,
      learn: learn || [],
      confiscated: au ? (au.lost || []) : [],        // ★Championsで没収された技(ラボのON/OFF用)
      champions: true, regulation: REGULATION,
      authority_name: au ? au.name : null,
      ours_had: oursNames ? oursNames.length : 0,
    }, stamp(learnSrc));
  });
  // ★全国版(非Champions)の覚える技を追加(2026-08-01 阿部さん決定)
  //   目的=Championsに新ポケモンが追加されたら即対応できる下ごしらえ。
  //   出典=PokeAPI(tools/_fetch_national_learnsets.js の生データ)。canonルール②「無ければ最新世代」。
  //   ・learn        = その体が入っている最新の作品(version group)で覚えられる技
  //   ・learn_legacy = それより前の世代にしか無い技(★9世代までに廃止=含めて廃止マーク方式)
  //   ・Championsに追加されたら: 9世代との差分を champions_diff として記録→権威値で上書き(canonルール③)
  const nationalRows = buildNationalLearnsets(new Set(items.map(x => x.name)));
  const all = items.concat(nationalRows);
  write('learnsets.json', { meta: META('覚える技と没収技', {
    note: 'confiscated=Championsで没収された技。本番(リアルバトル)では出さない。ラボではON/OFFを選べる。',
    note_national: 'champions=false の行は PokeAPI由来の暫定(source=pokeapi_provisional)。learn=最新作品の技 / learn_legacy=過去世代のみ(廃止)。',
  }), count: all.length,
    champions_count: items.length,
    total_learn: all.reduce((s, x) => s + x.learn.length, 0),
    total_confiscated: all.reduce((s, x) => s + (x.confiscated || []).length, 0), items: all });
  return all.length;
}

// 全国版の覚える技(PokeAPI生データ → master行)。生データが無ければ空(段階導入)
function buildNationalLearnsets(championsNames) {
  let raw;
  try { raw = J('reference/_pokeapi_learnsets_raw.json'); } catch (e) { return []; }
  // version group → 順序(新しいほど大きい)。PokeAPIの版名
  const VG_ORDER = ['red-blue','yellow','gold-silver','crystal','ruby-sapphire','colosseum','xd','emerald',
    'firered-leafgreen','diamond-pearl','platinum','heartgold-soulsilver','black-white','black-2-white-2',
    'x-y','omega-ruby-alpha-sapphire','sun-moon','ultra-sun-ultra-moon','lets-go-pikachu-lets-go-eevee',
    'sword-shield','brilliant-diamond-and-shining-pearl','legends-arceus','scarlet-violet'];
  const vgRank = {}; VG_ORDER.forEach((v, i) => { vgRank[v] = i; });
  // 技slug → うちの技名(master moves)
  const moveJa = {}; // buildMoves と同じ元(全国版WAZA_MAP)から
  Object.entries(A.WAZA_MAP).forEach(([slug, m]) => { moveJa[slug] = zen2han(m.name); });

  // ★名前はslug経由で「いまの」master/pokemon.json から引く(取得時の名前は古くなり得る=名前替えに強く)
  let nameBySlug = {};
  try {
    const pk = JSON.parse(fs.readFileSync(path.join(OUT, 'pokemon.json'), 'utf8'));
    pk.items.forEach(p => { if (p.slug) nameBySlug[p.slug] = p.name; });
  } catch (e) {}

  const rows = [];
  Object.entries(raw.fetched || {}).forEach(([slug, d0]) => {
    const d = Object.assign({}, d0, { name: nameBySlug[slug] || d0.name });
    if (championsNames.has(d.name)) return;   // Champions行が正典(上書きしない)
    // その体が入っている最新の作品
    let latest = -1;
    (d.moves || []).forEach(mv => mv.vgs.forEach(v => { if ((vgRank[v] ?? -1) > latest) latest = vgRank[v]; }));
    const latestVg = latest >= 0 ? VG_ORDER[latest] : null;
    const learn = [], legacy = [], unmapped = [];
    (d.moves || []).forEach(mv => {
      const ja = moveJa[mv.move];
      const inLatest = latestVg && mv.vgs.includes(latestVg);
      if (!ja) { unmapped.push(mv.move); return; }   // うちの919技に無い(でっち上げない)
      (inLatest ? learn : legacy).push(ja);
    });
    rows.push({
      slug, name: d.name, display_name: d.name, no: d.no != null ? Number(d.no) : null,
      learn: learn.sort(), learn_legacy: legacy.sort(),
      unmapped_moves: unmapped.sort(),                  // 正直に残す(Zワザ等・後で精査)
      latest_version_group: latestVg,
      confiscated: [], champions: false, regulation: null,
      source: 'pokeapi_provisional', verified_at: NOW,
    });
  });
  return rows.sort((a, b) => (a.no || 9999) - (b.no || 9999) || String(a.name).localeCompare(String(b.name), 'ja'));
}

// ══════════════════════════════════════════════════════════════════
// 6) regulations.json
// ══════════════════════════════════════════════════════════════════
function buildRegulations() {
  const items = [{
    id: REGULATION, name: 'レギュレーション M-B', current: true,
    note: '現行レギュレーション。過去のレギュレーション(M-A等)は保持しない(後戻りしないため)。' +
          'リアルバトルは regulation===現行 のポケモン/技/持ち物だけを出す。',
    source: 'champions_authority', verified_at: NOW,
  }];
  write('regulations.json', { meta: META('レギュレーション'), count: items.length, items });
  return items.length;
}

// ── タイプ / 性格(★静的な参照表。2026-07-31 追加) ─────────────────
//   経緯: pokedb.js を master だけで動かそうとしたら、TYPES / TYPE_COLORS / NATURES が
//   master に無く、旧 pokechan_data.js を読むしかないことが判明した(=データが一つになっていない穴)。
//   ★中身は作らない・変えない。旧データに在るものを**そのまま移すだけ**。
function buildTypes() {
  const items = (C.TYPES || []).map((name, i) => ({
    index: i, name,
    color: (C.TYPE_COLORS || {})[name] || null,
    source: 'ours_champions', verified_at: NOW,
  }));
  write('types.json', { meta: META('タイプ(18)', { note: '★旧データからそのまま移送。値は変えていない。resist配列の並び順もこの index に対応する。' }), count: items.length, items });
  return items.length;
}
function buildNatures() {
  const N = C.NATURES || {};
  const items = Object.entries(N).map(([name, v]) => Object.assign({ name }, v, {
    source: 'ours_champions', verified_at: NOW,
  }));
  write('natures.json', { meta: META('性格', { note: '★旧データからそのまま移送。値は変えていない。' }), count: items.length, items });
  return items.length;
}

// ── 実行 ────────────────────────────────────────────────────────────
console.log('=== マスターデータ生成(master/) ===');
console.log('  ★既存ファイルは1バイトも変更しません。出力は master/ のみ。');
const n = {
  abilities: buildAbilities(), items: buildItems(), moves: buildMoves(),
  pokemon: buildPokemon(), learnsets: buildLearnsets(), regulations: buildRegulations(),
  types: buildTypes(), natures: buildNatures(),
};
fs.writeFileSync(path.join(OUT, '_unknowns.json'), JSON.stringify({
  note: '★決められなかった値の一覧。推測で埋めていない。ここを1件ずつ潰すのが次の作業。',
  generated_at: NOW, count: unknowns.length, items: unknowns,
}, null, 1) + '\n');
console.log('\n件数:', JSON.stringify(n));
console.log('★決められなかった値:', unknowns.length, '件 → master/_unknowns.json');
