/* Showdown差分バトルテストハーネス
 * 同一局面を「うちのsim」と「pokemon-showdownエンジン」両方で実行し、
 * HP推移・ダメージを機械比較→差分=バグ候補の自動検出。
 *
 * 設計: 設計_バトル再現ファースト_逆算_2026-07-02.md (差分オラクル方式)
 * 実行: node tools/_showdown_diff_test.js
 * 出力: reference/_showdown_diff_result.json + コンソールサマリ
 *
 * ★コード・文言はコピーしない(独自原則不変)。検証にだけ使う=著作権クリーン。
 * ★既存ファイル修正禁止。新規2ファイルのみ(本ファイル + 出力JSON)。commit禁止。
 */
'use strict';

const path = require('path');
const fs   = require('fs');
const { buildEngine, mulberry32, ROOT } = require('./_sim_engine.js');

// ─── データ読み込み ─────────────────────────────
const dataFile = process.env.PCHAM_DATA || 'pokechan_data.js';
const data     = require(path.join(ROOT, dataFile));
const sdMoves  = require(path.join(ROOT, 'reference/_showdown/moves.json'));
const sdSpecies= require(path.join(ROOT, 'reference/_showdown/species.json'));
const abMaster = require(path.join(ROOT, 'reference/abilities_master.json'));
const sdItems  = require(path.join(ROOT, 'reference/_showdown/items.json'));
const Sim      = require(path.join(ROOT, 'vendor/showdown/node_modules/pokemon-showdown'));

// ─── 変換テーブル ────────────────────────────────

// move_no → SD move id
const sdMoveByNum = {};
for (const m of sdMoves) {
  if (m && m.num != null) sdMoveByNum[m.num] = m.id;
}

// pokemon no(整数) → SD species id (通常形態のみ・Past含む=gen9customgameで使える)
const sdSpeciesByNum = {};
for (const s of sdSpecies) {
  if (s && s.num != null && !s.forme) sdSpeciesByNum[s.num] = s.id;
}

// 特性名(日本語) → SD ability id
const abilityJaToSD = {};
for (const ab of abMaster) {
  if (ab.names && ab.names.ja && ab.slug) {
    abilityJaToSD[ab.names.ja] = ab.slug;
  }
}

// うちの道具key → SD item id (バトル検証で使う主要道具)
const itemOurToSD = {
  'life_orb':           'lifeorb',
  'expert_belt':        'expertbelt',
  'leftovers':          'leftovers',
  'blacksludge':        'blacksludge',
  'shellbell':          'shellbell',
  'type_boost_normal':  'silkscarf',
  'type_boost_fire':    'charcoal',
  'type_boost_water':   'mysticwater',
  'type_boost_electric':'magnet',
  'type_boost_grass':   'miracleseed',
  'type_boost_ice':     'nevermeltice',
  'type_boost_fighting':'blackbelt',
  'type_boost_poison':  'poisonbarb',
  'type_boost_ground':  'softsand',
  'type_boost_flying':  'sharpbeak',
  'type_boost_psychic': 'twistedspoon',
  'type_boost_bug':     'silverpowder',
  'type_boost_rock':    'hardstone',
  'type_boost_ghost':   'spelltag',
  'type_boost_dragon':  'dragonfang',
  'type_boost_dark':    'blackglasses',
  'type_boost_steel':   'metalcoat',
  'kodawari_hachimaki': 'choiceband',
  'kodawari_megane':    'choicespecs',
  'kodawari_scarf':     'choicescarf',
  'muscle_band':        'muscleband',
  'wise_glasses':       'wiseglasses',
};

// ─── ユーティリティ ──────────────────────────────

function ourPokeToSD(pokeName) {
  const p = data.POKEMON_LIST.find(x => x.name === pokeName && x.form === '通常');
  if (!p) return null;
  return { poke: p, sdId: sdSpeciesByNum[parseInt(p.no)] || null };
}

function ourMoveToSD(moveKey) {
  const mv = data.WAZA_MAP[moveKey];
  if (!mv) return null;
  const sdId = sdMoveByNum[mv.move_no];
  return sdId ? { mv, sdId } : null;
}

// うちのsimのsideStateを組み立てる
function buildOurSide(E, pokeName, moveKeys, itemKey) {
  const { poke } = ourPokeToSD(pokeName) || {};
  if (!poke) return null;
  const moves = moveKeys.map(k => data.WAZA_MAP[k]).filter(Boolean);
  if (!moves.length) return null;
  const s = E.makeSideState();
  s.poke = poke;
  s.moves = moves;
  s.selectedMoveIdx = 0;
  s.item = itemKey || null;
  s.currentHp = E.realStat(s, 'hp');
  s.rank = { atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0, acc: 0, eva: 0 };
  return s;
}

// Showdownのpackedチーム文字列を生成
// フォーマット: name|item|ability|moves|nature|evs|gender|ivs|shiny|level
function buildSDTeam(pokeName, moveKeys, itemKey, abilityJa) {
  const lookup = ourPokeToSD(pokeName);
  if (!lookup || !lookup.sdId) return null;
  const { poke, sdId } = lookup;
  const sdMoveIds = moveKeys.map(k => ourMoveToSD(k)?.sdId).filter(Boolean);
  if (!sdMoveIds.length) return null;
  const sdAbility = abilityJa ? (abilityJaToSD[abilityJa] || '') : '';
  const sdItem    = itemKey ? (itemOurToSD[itemKey] || '') : '';
  // 0 EV・31 IV・中立性格(Hardy)・Lv50・無性別(M)
  // packed: name|item|ability|moves(comma)|nature|evs|gender|ivs|shiny|level
  const packed = [
    sdId,          // species id (lowercase Showdown name)
    sdItem,        // item
    sdAbility,     // ability
    sdMoveIds.join(','),  // moves
    'Hardy',       // nature (中立)
    '',            // evs (0)
    'M',           // gender
    '31,31,31,31,31,31', // ivs
    '',            // shiny
    '50',          // level
    '',            // happiness
  ].join('|');
  return packed;
}

// ─── SDバトルドライバ ────────────────────────────

// sideupdate チャンクからHP抽出(requestのpokemon[0].conditionを解析)
function extractHPFromSideupdate(chunk) {
  const lines = chunk.split('\n');
  if (lines[0] !== 'sideupdate') return null;
  const player = lines[1]; // 'p1' or 'p2'
  const reqLine = lines.find(l => l.startsWith('|request|'));
  if (!reqLine) return null;
  try {
    const req = JSON.parse(reqLine.slice('|request|'.length));
    const cond = req.side && req.side.pokemon && req.side.pokemon[0] && req.side.pokemon[0].condition;
    if (!cond) return null;
    const hp = parseInt(cond.split('/')[0]);
    const maxHp = parseInt(cond.split('/')[1]);
    return { player, hp, maxHp: isNaN(maxHp) ? null : maxHp };
  } catch (e) { return null; }
}

// seed固定で1v1バトルを実行し、ターンごとのHP推移を返す
// 注: SD側のrequestはそのターン開始時(=前ターン終了後)のHPを含む
async function runSDTurns(p1Team, p2Team, nTurns, seed) {
  const stream = new Sim.BattleStream();
  const allOut = [];
  (async () => { for await (const chunk of stream) allOut.push(chunk); })();

  stream.write(`>start ${JSON.stringify({
    formatid: 'gen9customgame',
    seed: seed,
    p1: { name: 'P1', team: p1Team },
    p2: { name: 'P2', team: p2Team },
  })}`);

  // team preview を解決してから動く
  await new Promise(r => setTimeout(r, 100));
  stream.write('>p1 team 1');
  stream.write('>p2 team 1');
  await new Promise(r => setTimeout(r, 100));

  // バトル開始後の初期HP(T0 = switch後のrequest)
  let initP1hp = null, initP2hp = null, initMaxP1 = null, initMaxP2 = null;
  for (const chunk of allOut) {
    const parsed = extractHPFromSideupdate(chunk);
    if (!parsed) continue;
    if (parsed.player === 'p1' && initP1hp === null) {
      initP1hp = parsed.hp; initMaxP1 = parsed.maxHp;
    }
    if (parsed.player === 'p2' && initP2hp === null) {
      initP2hp = parsed.hp; initMaxP2 = parsed.maxHp;
    }
  }

  const turnHps = []; // [{turn, p1hp, p2hp}] - ターン終了後のHP

  for (let t = 1; t <= nTurns; t++) {
    const prevLen = allOut.length;
    stream.write('>p1 move 1');
    stream.write('>p2 move 1');
    await new Promise(r => setTimeout(r, 100));

    // 今のターン後のrequest(=ターン終了後HP)を抽出
    const newChunks = allOut.slice(prevLen);
    let p1hp = null, p2hp = null;
    for (const chunk of newChunks) {
      const parsed = extractHPFromSideupdate(chunk);
      if (!parsed) continue;
      if (parsed.player === 'p1') p1hp = parsed.hp;
      if (parsed.player === 'p2') p2hp = parsed.hp;
    }

    // バトル終了チェック: |win|が出た場合HPが0になったポケモンを0とする
    const ended = newChunks.some(c => c.includes('|win|') || c.includes('|tie|'));
    if (ended) {
      // updateチャンクからKO時の最終HPを取る
      for (const chunk of newChunks) {
        if (!chunk.startsWith('update')) continue;
        // |-damage|p1a: ...|0 fnt などを検索
        const fnt1 = chunk.match(/\|-damage\|p1a:[^\|]+\|0 fnt/);
        const fnt2 = chunk.match(/\|-damage\|p2a:[^\|]+\|0 fnt/);
        if (fnt1) p1hp = 0;
        if (fnt2) p2hp = 0;
      }
    }

    turnHps.push({ turn: t, p1hp, p2hp, ended });
    if (ended) break;
  }

  return { turnHps, initP1hp, initP2hp, initMaxP1, initMaxP2 };
}

// ─── うちのsimドライバ ───────────────────────────

function runOurTurns(E, pokeName1, moveKeys1, item1, pokeName2, moveKeys2, item2, nTurns, seedNum) {
  const turnHps = [];

  function resetEnv() {
    Object.assign(E.env, {
      weather: 'none', weatherTurns: null,
      field: 'none', fieldTurns: null,
      doubleBattle: false, trickRoom: false, gravity: false,
      wonderRoom: false, magicRoom: false,
    });
    if (E.setLastMoveAnywhere) E.setLastMoveAnywhere(null);
  }

  resetEnv();
  const s1 = buildOurSide(E, pokeName1, moveKeys1, item1);
  const s2 = buildOurSide(E, pokeName2, moveKeys2, item2);
  if (!s1 || !s2) return null;

  E.sides.self = s1;
  E.sides.opp  = s2;

  const maxHp1 = E.realStat(s1, 'hp');
  const maxHp2 = E.realStat(s2, 'hp');

  // 固定seed: 毎ターン同じseedから始めることでSDとの乱数独立を明示
  // (=各ターン決定論的に動く。連続ターンで状態を引き継ぎつつ乱数はリセット)
  E.setRandom(mulberry32(seedNum));

  for (let t = 1; t <= nTurns; t++) {
    try {
      E.runTurn();
    } catch (e) {
      turnHps.push({ turn: t, p1hp: E.sides.self.currentHp, p2hp: E.sides.opp.currentHp, error: e.message });
      break;
    }
    turnHps.push({ turn: t, p1hp: E.sides.self.currentHp, p2hp: E.sides.opp.currentHp });
    if (E.sides.self.currentHp <= 0 || E.sides.opp.currentHp <= 0) break;
  }

  return { turnHps, maxHp1, maxHp2 };
}

// ─── 差分比較 ────────────────────────────────────

// 乱数幅(±15%)の許容閾値: SD/うちで乱数経路が異なるため、
// ダメージの差が「最大ダメージ × 15%」以内なら乱数揺れとして許容。
// この閾値は(85%〜100%の)random rangeを全部吸収する。
// 真の差分はそれを超えた場合(=乱数では説明できない差)。
const RANDOM_RANGE_PCT = 16; // %

function compareTurns(scenarioId, ourResult, sdTurns, maxHp1, maxHp2) {
  const diffs = [];
  const minLen = Math.min(ourResult.length, sdTurns.length);

  // 各ターンを比較。連続ターンは状態引き継ぎのため、
  // 前ターンのHP差をベースにしてダメージを比較(delta方式)。
  let prevOurP1 = maxHp1, prevOurP2 = maxHp2;
  let prevSdP1  = maxHp1, prevSdP2  = maxHp2;

  for (let i = 0; i < minLen; i++) {
    const our = ourResult[i];
    const sd  = sdTurns[i];

    // HP nullは「情報取得失敗」= そのターンはスキップ
    if (sd.p1hp === null || sd.p2hp === null) {
      prevOurP1 = our.p1hp; prevOurP2 = our.p2hp;
      prevSdP1  = sd.p1hp ?? prevSdP1;
      prevSdP2  = sd.p2hp ?? prevSdP2;
      continue;
    }

    // このターンのダメージ(前ターン末HP - 今ターン末HP)
    // 回復技の分も含むが、比較には使う(回復が両者で一致すれば相殺)
    const dmgOurP1 = prevOurP1 - our.p1hp;  // p1のHP変化 (正=受けた技+被弾 - 回復)
    const dmgOurP2 = prevOurP2 - our.p2hp;
    const dmgSdP1  = prevSdP1  - sd.p1hp;
    const dmgSdP2  = prevSdP2  - sd.p2hp;

    // ターン1は最大HPからの差分
    const refP1 = i === 0 ? maxHp1 : prevOurP1;
    const refP2 = i === 0 ? maxHp2 : prevOurP2;

    // p1 side
    {
      const [dmgOur, dmgSd] = [dmgOurP1, dmgSdP1];
      const diff = Math.abs(dmgOur - dmgSd);
      const expectedMax = Math.max(Math.abs(dmgOur), Math.abs(dmgSd), 1);
      const pct = diff / expectedMax * 100;
      if (pct > RANDOM_RANGE_PCT) {
        diffs.push({
          scenario: scenarioId, turn: our.turn, side: 'p1',
          ours_hp: our.p1hp, sd_hp: sd.p1hp,
          ours_net: dmgOur, sd_net: dmgSd,
          diff_abs: diff, diff_pct: pct.toFixed(1),
          category: categorizeDiff(dmgOur, dmgSd, pct),
        });
      }
    }
    // p2 side
    {
      const [dmgOur, dmgSd] = [dmgOurP2, dmgSdP2];
      const diff = Math.abs(dmgOur - dmgSd);
      const expectedMax = Math.max(Math.abs(dmgOur), Math.abs(dmgSd), 1);
      const pct = diff / expectedMax * 100;
      if (pct > RANDOM_RANGE_PCT) {
        diffs.push({
          scenario: scenarioId, turn: our.turn, side: 'p2',
          ours_hp: our.p2hp, sd_hp: sd.p2hp,
          ours_net: dmgOur, sd_net: dmgSd,
          diff_abs: diff, diff_pct: pct.toFixed(1),
          category: categorizeDiff(dmgOur, dmgSd, pct),
        });
      }
    }

    prevOurP1 = our.p1hp; prevOurP2 = our.p2hp;
    prevSdP1  = sd.p1hp;  prevSdP2  = sd.p2hp;
  }
  return diffs;
}

// 差分の分類
function categorizeDiff(ours, sd, pct) {
  if (ours <= 0 && sd > 0) return 'ours_no_damage_sd_damages';   // うちが無効/未実装
  if (sd <= 0 && ours > 0) return 'sd_no_damage_ours_damages';   // SD側が無効
  if (pct <= 35) return 'item_or_ability_modifier';              // 35%以内 = 道具/特性係数差が疑い
  return 'formula_or_unimplemented';                              // それ以上 = 計算式差か未実装
}

// ─── テスト局面定義 ───────────────────────────────

// Champions頻出ポケ10体 × 技の組み合わせ
// p1(攻撃側), p2(防御側), p1moves(4技), p2moves(4技), item1, item2, turns
const SCENARIOS = [];

// ヘルパー: 技キーをwaza名から逆引き
function wazaKey(name) {
  return Object.keys(data.WAZA_MAP).find(k => data.WAZA_MAP[k].name === name) || null;
}
function wazasByCategory(pokeName, cat, limit=2) {
  return Object.entries(data.WAZA_MAP)
    .filter(([k,v]) => v.category === cat && v.learners && v.learners.includes(pokeName) && sdMoveByNum[v.move_no])
    .slice(0, limit)
    .map(([k]) => k);
}
function wazasAll(pokeName, limit=4) {
  const phys = wazasByCategory(pokeName, '物理', 2);
  const spec = wazasByCategory(pokeName, '特殊', 2);
  const stat = wazasByCategory(pokeName, '変化', 1);
  const merged = [...phys, ...spec, ...stat].filter((k,i,a) => a.indexOf(k) === i).slice(0, limit);
  return merged.length >= 1 ? merged : null;
}

// テスト対象ポケモン(通常形態でSD変換可能なもの10体)
// 物理アタッカー、特殊アタッカー、混合、タンク系でバラエティ確保
const TEST_POKEMON = [
  { name: 'カビゴン',   item1: 'leftovers',      item2: null },          // 物理タンク
  { name: 'ゲンガー',   item1: 'type_boost_ghost', item2: null },         // 特殊ゴースト
  { name: 'ピクシー',   item1: 'leftovers',       item2: null },          // 特殊フェアリー
  { name: 'フシギバナ', item1: 'type_boost_grass', item2: null },         // 特殊草
  { name: 'リザードン', item1: 'type_boost_fire',  item2: null },         // 特殊炎
  { name: 'カメックス', item1: 'type_boost_water', item2: null },         // 特殊水
  { name: 'カイリュー', item1: 'life_orb',         item2: null },         // 物理龍
  { name: 'ギャラドス', item1: 'life_orb',         item2: null },         // 物理水
  { name: 'カイリキー', item1: 'muscle_band',      item2: null },         // 物理格闘
  { name: 'スターミー',  item1: 'wise_glasses',    item2: null },         // 特殊水エスパー
];

// 各ポケモンについて: 自分が攻撃側 vs カビゴン(防御側) の3ターン
// + 自分が防御側 vs カビゴン(攻撃側) の3ターン → 50局面目指す
function buildScenarios() {
  const snorlax = TEST_POKEMON[0].name;
  for (const { name, item1, item2 } of TEST_POKEMON) {
    const moves = wazasAll(name, 4);
    if (!moves || moves.length < 1) {
      console.warn(`スキップ: ${name} - 技なし`);
      continue;
    }
    const snorlaxMoves = wazasAll(snorlax, 4) || [];

    // A: 自分 vs カビゴン
    SCENARIOS.push({
      id: `${name}_vs_Snorlax`,
      p1: name,   p1moves: moves,    p1item: item1,
      p2: snorlax, p2moves: snorlaxMoves, p2item: 'leftovers',
      turns: 3,
    });

    // B: カビゴン vs 自分 (reversed)
    if (name !== snorlax) {
      SCENARIOS.push({
        id: `Snorlax_vs_${name}`,
        p1: snorlax, p1moves: snorlaxMoves, p1item: 'leftovers',
        p2: name,    p2moves: moves,          p2item: item1,
        turns: 3,
      });
    }

    // C: 道具なし版 (STAB・倍率道具なし素のダメージ比較)
    SCENARIOS.push({
      id: `${name}_vs_Snorlax_noitem`,
      p1: name,   p1moves: moves,    p1item: null,
      p2: snorlax, p2moves: snorlaxMoves, p2item: null,
      turns: 2,
    });
  }
}
buildScenarios();

// ─── メイン実行 ──────────────────────────────────

async function main() {
  const E = buildEngine();
  const results = [];
  const allDiffs = [];

  // SDのシード固定
  const SD_SEED = [1, 2, 3, 4];
  const OUR_SEED = 20260702;

  let scenarioDone = 0, scenarioSkip = 0, scenarioErr = 0;

  console.log(`テスト局面数: ${SCENARIOS.length}`);
  console.log('実行中...\n');

  for (const sc of SCENARIOS) {
    // うちのsimで実行
    const p1 = data.POKEMON_LIST.find(x => x.name === sc.p1 && x.form === '通常');
    const p2 = data.POKEMON_LIST.find(x => x.name === sc.p2 && x.form === '通常');
    if (!p1 || !p2) { scenarioSkip++; continue; }

    // SD変換
    const p1SDId = sdSpeciesByNum[parseInt(p1.no)];
    const p2SDId = sdSpeciesByNum[parseInt(p2.no)];
    if (!p1SDId || !p2SDId) { scenarioSkip++; continue; }

    const p1SDMoves = sc.p1moves.map(k => sdMoveByNum[data.WAZA_MAP[k]?.move_no]).filter(Boolean);
    const p2SDMoves = sc.p2moves.map(k => sdMoveByNum[data.WAZA_MAP[k]?.move_no]).filter(Boolean);
    if (!p1SDMoves.length || !p2SDMoves.length) { scenarioSkip++; continue; }

    const p1Ability = abilityJaToSD[p1.ab1] || '';
    const p2Ability = abilityJaToSD[p2.ab1] || '';

    // Showdownのpackedチーム文字列
    // フォーマット: NICKNAME|SPECIES|ITEM|ABILITY|MOVES|NATURE|EVS|GENDER|IVS|SHINY|LEVEL|...
    // NICKNAME空=SPECIESと同じ。IVS空=全31。LEVEL=50を明示。EVS空=全0。
    const p1TeamStr = [
      '', p1SDId, itemOurToSD[sc.p1item] || '', p1Ability,
      p1SDMoves.join(','), 'Hardy', '', 'M', '31,31,31,31,31,31', '', '50', '',
    ].join('|');
    const p2TeamStr = [
      '', p2SDId, itemOurToSD[sc.p2item] || '', p2Ability,
      p2SDMoves.join(','), 'Hardy', '', 'M', '31,31,31,31,31,31', '', '50', '',
    ].join('|');

    // うちのsim実行
    let ourResult = null;
    try {
      ourResult = runOurTurns(
        E,
        sc.p1, sc.p1moves, sc.p1item,
        sc.p2, sc.p2moves, sc.p2item,
        sc.turns, OUR_SEED
      );
    } catch (e) {
      scenarioErr++;
      results.push({ id: sc.id, status: 'our_error', error: e.message });
      continue;
    }
    if (!ourResult) { scenarioSkip++; continue; }

    // SDバトル実行
    let sdResult = null;
    try {
      sdResult = await runSDTurns(p1TeamStr, p2TeamStr, sc.turns, SD_SEED);
    } catch (e) {
      scenarioErr++;
      results.push({ id: sc.id, status: 'sd_error', error: e.message });
      continue;
    }

    // maxHp はうちのsimのrealStat値を基準にする(SD/うちで一致しているはず)
    const maxHp1 = ourResult.maxHp1;
    const maxHp2 = ourResult.maxHp2;

    // 差分比較
    const diffs = compareTurns(sc.id, ourResult.turnHps, sdResult.turnHps, maxHp1, maxHp2);
    allDiffs.push(...diffs);

    const status = diffs.length === 0 ? 'match' : 'diff';
    results.push({
      id:     sc.id,
      status,
      p1:     sc.p1,
      p2:     sc.p2,
      p1item: sc.p1item || null,
      p2item: sc.p2item || null,
      turns:  sc.turns,
      maxHp1, maxHp2,
      ours:   ourResult.turnHps,
      sd:     sdResult.turnHps,
      diffs:  diffs.length ? diffs : undefined,
    });

    scenarioDone++;
    const icon = status === 'match' ? '✓' : '✗';
    process.stdout.write(`  ${icon} ${sc.id}: ${diffs.length}件差分\n`);
  }

  // ─── サマリ ─────────────────────────────────────

  const matched = results.filter(r => r.status === 'match').length;
  const diffed  = results.filter(r => r.status === 'diff').length;
  const errored = results.filter(r => r.status === 'our_error' || r.status === 'sd_error').length;

  // 差分の分類集計
  const catCount = {};
  for (const d of allDiffs) {
    catCount[d.category] = (catCount[d.category] || 0) + 1;
  }

  const summary = {
    date:            new Date().toISOString(),
    total_scenarios: SCENARIOS.length,
    executed:        scenarioDone,
    skipped:         scenarioSkip,
    errored:         scenarioErr,
    matched,
    diffed,
    match_rate:      scenarioDone > 0 ? `${(matched / scenarioDone * 100).toFixed(1)}%` : 'N/A',
    total_diffs:     allDiffs.length,
    diff_by_category: catCount,
    top_diffs:       allDiffs
      .sort((a, b) => b.diff_abs - a.diff_abs)
      .slice(0, 20)
      .map(d => ({
        scenario: d.scenario, turn: d.turn, side: d.side,
        ours_net: d.ours_net, sd_net: d.sd_net,
        diff_abs: d.diff_abs, diff_pct: d.diff_pct, category: d.category,
      })),
    results,
  };

  const outPath = path.join(ROOT, 'reference/_showdown_diff_result.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log('\n─── 結果サマリ ──────────────────────');
  console.log(`実行: ${scenarioDone}/${SCENARIOS.length}局面 (スキップ:${scenarioSkip} エラー:${scenarioErr})`);
  console.log(`一致率: ${summary.match_rate} (${matched}一致 / ${diffed}差分あり)`);
  console.log(`差分件数: ${allDiffs.length}件`);
  console.log('カテゴリ別:');
  for (const [cat, cnt] of Object.entries(catCount).sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${cat}: ${cnt}件`);
  }
  if (summary.top_diffs.length) {
    console.log('\n差分上位5件(ダメージ差大きい順):');
    for (const d of summary.top_diffs.slice(0, 5)) {
      console.log(`  [${d.scenario}] T${d.turn}/${d.side}: うちnet=${d.ours_net} SDnet=${d.sd_net} (差${d.diff_abs} ${d.diff_pct}%) [${d.category}]`);
    }
  }
  console.log(`\n出力: reference/_showdown_diff_result.json`);
}

main().then(() => process.exit(0)).catch(e => {
  console.error('致命的エラー:', e);
  process.exit(1);
});
