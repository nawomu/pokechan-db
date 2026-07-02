/* Showdown決定論差分ハーネス (deterministic)
 *
 * 旧ハーネス(_showdown_diff_test.js)の根本問題:
 *   乱数ダメ幅(85-100%)が両エンジンで独立 → 追加効果や外れが混入 → 偽差分53件
 *
 * 本ハーネスの設計:
 *   1. 技プール = 「命中100・追加効果なし・固定威力」のみ(両エンジンでSD側も確認)
 *   2. うちのsim → calcDamage()で理論レンジ16通り(min/max/variations)を取得
 *   3. SD側 → 同シナリオをSD_RUNS回(32回)異なるseedで実行し実測ダメを収集
 *   4. 判定 = SD実測全値がうちの理論レンジ[min-TOLE, max+TOLE]内に収まるか
 *      (TOLE=1: 整数丸めの1ずれを許容)
 *      ※ 反動/回復は calcDamage の recoil/chip を別途確認しない(ダメ計算式のみを検証)
 *
 * カバレッジ100局面:
 *   攻撃ポケ10体 × タイプ相性(抜群/半減/等倍/STAB有無) × 物理/特殊
 *   × 道具5種(ハチマキ/メガネ/いのちのたま/たつじんのおび/タイプ強化/なし)
 *
 * 実行: node tools/_showdown_det_test.js
 * 出力: reference/_showdown_diff_result.json
 *
 * ★コード・文言はコピーしない(独自原則不変)。検証にだけ使う=著作権クリーン。
 * ★既存ファイル修正禁止。commit禁止。
 */
'use strict';

const path = require('path');
const fs   = require('fs');
const { buildEngine, ROOT } = require('./_sim_engine.js');

// ─── データ読み込み ─────────────────────────────
const dataFile = process.env.PCHAM_DATA || 'pokechan_data.js';
const data     = require(path.join(ROOT, dataFile));
const sdMoves  = require(path.join(ROOT, 'reference/_showdown/moves.json'));
const sdSpecies= require(path.join(ROOT, 'reference/_showdown/species.json'));
const Sim      = require(path.join(ROOT, 'vendor/showdown/node_modules/pokemon-showdown'));

// ─── 変換テーブル ──────────────────────────────

const sdMoveByNum = {};
for (const m of sdMoves) {
  if (m && m.num != null) sdMoveByNum[m.num] = m;
}

const sdSpeciesByNum = {};
for (const s of sdSpecies) {
  if (s && s.num != null && !s.forme) sdSpeciesByNum[s.num] = s.id;
}

// うちの道具key → SD item id
const itemOurToSD = {
  'kodawari_hachimaki': 'choiceband',
  'kodawari_megane':    'choicespecs',
  'life_orb':           'lifeorb',
  'expert_belt':        'expertbelt',
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
  'type_boost_fairy':   'pixieplate',
  'type_boost_fighting2':'blackbelt',
  'muscle_band':        'muscleband',
  'wise_glasses':       'wiseglasses',
};

// 守備側技として使えない技のSDリスト
const DEF_SIDE_BLOCKED_SD_IDS = new Set([
  'selfdestruct', 'explosion',  // 自爆技 → p2がひんしになりバトル終了
  'perishsong',                 // 3ターン後ひんし
  'outrage', 'petaldance', 'thrash', // こんらん強制技(連続で使う)
  'thief', 'covet',             // アイテム盗む → p1のアイテムが消えてp1の技ダメが変化する
  'trick', 'switcheroo',        // アイテム交換 → 同上
  'knockoff',                   // アイテム弾き飛ばし → 同上
  // 反動技: p2先行時にp2のHPが反動で減り、その後p1がOHKOすると
  //         「観測ダメ=反動後のHP残量」になって理論ダメより小さく見える
  'doubleedge', 'submission', 'jumpkick', 'highjumpkick',
  'flareblitz', 'volttackle', 'woodhammer', 'headsmash',
  'headcharge', 'takedown', 'dragonrush', 'wildcharge',
  'bravebirdbird', 'bravebird',  // ブレイブバード
]);

// ─── クリーン技プール構築 ──────────────────────
// 両エンジンでdeterministic: acc=100(or必中), probなし, 固定威力, SDでもsecondary/status/volatileStatusなし
// 攻撃側クリーン技から除外すべきself.volatileStatus値(連続強制技/チャージ技)
const SELF_VOLATILE_BLOCKED = new Set(['lockedmove', 'mustrecharge', 'rage', 'uproar']);

function buildCleanMovePool() {
  const pool = [];
  for (const [key, v] of Object.entries(data.WAZA_MAP)) {
    if (!v) continue;
    if (v.category !== '物理' && v.category !== '特殊') continue;
    if (v.accuracy !== 100 && v.accuracy !== null && v.accuracy !== undefined) continue;
    if (!v.move_no || !v.power || v.power === '—') continue;
    const sdM = sdMoveByNum[v.move_no];
    if (!sdM) continue;
    if (sdM.secondary || sdM.secondaries) continue;
    if (sdM.volatileStatus || sdM.status) continue;
    // self.volatileStatus除外: 連続強制技(outrage/thrash/petaldance=lockedmove)・
    //   チャージ後反動技(hyperbeam等=mustrecharge)・うるさい技(uproar)・いかり(rage)
    if (sdM.self && sdM.self.volatileStatus && SELF_VOLATILE_BLOCKED.has(sdM.self.volatileStatus)) continue;
    if (!sdM.basePower || sdM.basePower === 0) continue;
    if (sdM.basePowerCallback) continue;  // 変動威力(けたぐり等)除外
    if (sdM.flags && sdM.flags.charge) continue; // チャージターンが必要な技(ソーラービーム等)除外
    pool.push({ key, name: v.name, type: v.type, category: v.category, power: v.power, move_no: v.move_no, sdId: sdM.id, learners: v.learners || [] });
  }
  return pool;
}

const CLEAN_POOL = buildCleanMovePool();

function cleanMovesFor(pokeName, category, limit = 3, forDefender = false) {
  return CLEAN_POOL
    .filter(m => {
      if (m.category !== category) return false;
      if (!m.learners.includes(pokeName)) return false;
      if (forDefender && DEF_SIDE_BLOCKED_SD_IDS.has(m.sdId)) return false;
      return true;
    })
    .slice(0, limit);
}

// ─── テスト対象ポケモン定義 ──────────────────────
// type情報はDBから取る。タイプ相性バリエーションのために攻撃側と防御側を組み合わせる。

const ATTACKERS = [
  { name: 'カビゴン',   cat: '物理',  item: null },            // ノーマル物理
  { name: 'カビゴン',   cat: '特殊',  item: null },            // ノーマル特殊
  { name: 'カイリュー', cat: '物理',  item: 'kodawari_hachimaki' }, // ドラゴン/ひこう 物理 ハチマキ
  { name: 'カイリュー', cat: '特殊',  item: 'kodawari_megane' },   // 特殊 メガネ
  { name: 'ゲンガー',   cat: '特殊',  item: 'life_orb' },          // ゴースト/どく いのちのたま
  { name: 'フシギバナ', cat: '特殊',  item: 'type_boost_grass' },  // くさ/どく タイプ強化
  { name: 'リザードン', cat: '特殊',  item: 'life_orb' },          // ほのお/ひこう いのちのたま
  { name: 'カメックス', cat: '特殊',  item: 'expert_belt' },       // みず たつじんのおび
  { name: 'カイリキー', cat: '物理',  item: 'kodawari_hachimaki' },// かくとう ハチマキ
  { name: 'スターミー',  cat: '特殊',  item: 'wise_glasses' },      // みず/エスパー かしこいメガネ
];

// 防御側ポケモン: 各タイプを代表する面々(うちのsimとSDの両方に存在する種)
const DEFENDERS = [
  { name: 'カビゴン',   desc: 'ノーマルタンク' },
  { name: 'カイリュー', desc: 'ドラゴン/ひこうアタッカー' },
  { name: 'ゲンガー',   desc: 'ゴースト/どく' },
  { name: 'フシギバナ', desc: 'くさ/どく' },
  { name: 'リザードン', desc: 'ほのお/ひこう' },
  { name: 'カメックス', desc: 'みずタンク' },
  { name: 'カイリキー', desc: 'かくとう' },
  { name: 'ピクシー',   desc: 'フェアリー' },
];

// ─── シナリオ生成 ────────────────────────────────

function buildScenarios() {
  const scenarios = [];

  for (const atk of ATTACKERS) {
    const atkPoke = data.POKEMON_LIST.find(x => x.name === atk.name && x.form === '通常');
    if (!atkPoke) continue;
    const atkSdId = sdSpeciesByNum[parseInt(atkPoke.no)];
    if (!atkSdId) continue;

    const moves = cleanMovesFor(atk.name, atk.cat, 3);
    if (!moves.length) {
      console.warn('技なし:', atk.name, atk.cat);
      continue;
    }

    for (const def of DEFENDERS) {
      // 自己戦は1種だけ(重複削減)
      if (atk.name === def.name && scenarios.some(s => s.atkName === atk.name && s.defName === def.name)) continue;

      const defPoke = data.POKEMON_LIST.find(x => x.name === def.name && x.form === '通常');
      if (!defPoke) continue;
      const defSdId = sdSpeciesByNum[parseInt(defPoke.no)];
      if (!defSdId) continue;

      // 各技で1シナリオ(最大2技/組み合わせでカバレッジ調整)
      for (const mv of moves.slice(0, 2)) {
        const sdItemId = atk.item ? (itemOurToSD[atk.item] || '') : '';
        scenarios.push({
          id: `${atk.name}[${atk.cat.slice(0,1)}+${atk.item||'noitem'}]_${mv.name}_vs_${def.name}`,
          atkName: atk.name, atkSdId,
          defName: def.name, defSdId,
          atkPoke, defPoke,
          move: mv,           // { key, name, type, category, power, sdId }
          ourItem: atk.item,
          sdItem: sdItemId,
        });
      }
    }
  }

  // 100局面超えたら上位100件に絞る
  return scenarios.slice(0, 120); // 少し余裕を持たせる
}

// ─── うちのsim: calcDamage呼び出し ──────────────
// calcDamageはうちのsimのsides.self/oppを使って理論レンジを返す

function ourCalcRange(E, atkPoke, defPoke, move, ourItem) {
  const s1 = E.makeSideState();
  s1.poke = atkPoke;
  s1.moves = [move]; // waza_map entry
  s1.selectedMoveIdx = 0;
  s1.item = ourItem || null;
  s1.currentHp = E.realStat(s1, 'hp');
  s1.rank = { atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0, acc: 0, eva: 0 };

  const s2 = E.makeSideState();
  s2.poke = defPoke;
  s2.moves = [];
  s2.selectedMoveIdx = 0;
  s2.item = null;
  s2.currentHp = E.realStat(s2, 'hp');
  s2.rank = { atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0, acc: 0, eva: 0 };

  E.sides.self = s1;
  E.sides.opp  = s2;

  // envをリセット
  Object.assign(E.env, {
    weather: 'none', weatherTurns: null,
    field: 'none',   fieldTurns: null,
    doubleBattle: false, trickRoom: false, gravity: false,
    wonderRoom: false, magicRoom: false,
  });

  const result = E.calcDamage('self', 'opp', move, {});
  return result; // { min, max, variations[16], immune, ... }
}

// ─── SD側: N回実行してダメージ収集 ──────────────

const SD_RUNS = 32; // 16通り乱数を確実にカバーするため32回

// SD packed team文字列生成
// フォーマット: NICKNAME|SPECIES|ITEM|ABILITY|MOVES|NATURE|EVS|GENDER|IVS|SHINY|LEVEL
function packTeam(sdSpeciesId, sdItemId, sdMoveId) {
  return [
    '',              // nickname (空=species名と同じ)
    sdSpeciesId,
    sdItemId || '',
    '',              // ability (空=デフォルト特性)
    sdMoveId,
    'Hardy',         // 中立性格
    '',              // EVs (全0)
    'M',             // gender
    '31,31,31,31,31,31', // IVs
    '',              // shiny
    '50',            // level
    '',              // happiness
  ].join('|');
}

// SD battle 1ターン実行してp2のダメージを返す(p1が技を使いp2が受けるダメ)
// 抽出方法: update チャンク内の `|-damage|p2a:` ラインからHPを直接読む
// これによりターン跨ぎの混入を回避する
async function runSDOnce(atkSdId, defSdId, sdMoveId, sdItemId, defSdMoveId, seed) {
  const stream = new Sim.BattleStream();
  const chunks = [];
  (async () => { for await (const chunk of stream) chunks.push(chunk); })();

  const p1Team = packTeam(atkSdId, sdItemId, sdMoveId);
  // p2の技はクリーン技(反動なし、追加効果なし)を使う
  const p2Team = packTeam(defSdId, '', defSdMoveId || sdMoveId);

  stream.write(`>start ${JSON.stringify({
    formatid: 'gen9customgame',
    seed,
    p1: { name: 'P1', team: p1Team },
    p2: { name: 'P2', team: p2Team },
  })}`);

  await new Promise(r => setTimeout(r, 10));
  stream.write('>p1 team 1');
  stream.write('>p2 team 1');
  await new Promise(r => setTimeout(r, 10));

  stream.write('>p1 move 1');
  stream.write('>p2 move 1');
  await new Promise(r => setTimeout(r, 30));

  // p2が受けたダメを |-damage|p2a: ラインから抽出
  //
  // アルゴリズム:
  //   - p2HpLatest: p1の技が始まる前のp2の最新HP(スイッチ時初期値→p2技の反動等で更新)
  //   - |move|p1a: が来た時点で p2HpBefore = p2HpLatest に固定(以降更新しない)
  //   - p1の技後の |-damage|p2a: → p2HpAfter を記録
  //   - dmg = p2HpBefore - p2HpAfter
  //
  // 注意: p2が先攻で技を使い反動ダメを受けた後にp1が攻撃する場合、
  //       p2HpLatestが反動後のHP(=正しい「p1攻撃直前HP」)になることで正しく計算できる
  // 注意: p1が先攻でp2を攻撃し、その後p2が技を使って反動を受けた場合、
  //       p2HpBeforeはp1技開始時点で固定されているので汚染されない

  let critOccurred  = false;
  let p2HpLatest    = null;  // p1技開始前のp2HP追跡(スイッチ/p2技ダメで更新)
  let p2HpBefore    = null;  // p1技開始時点で固定したp2HP
  let p2HpAfter     = null;  // p1技によるp2ダメ後のp2HP
  let p2MaxHp       = null;  // p2の最大HP
  let p1Started     = false; // p1の技行動が始まったか

  for (const chunk of chunks) {
    if (!chunk.startsWith('update')) continue;
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('|move|p1a:')) {
        if (!p1Started) {
          // p1技開始 → この時点でp2HpBeforeを固定
          p2HpBefore = p2HpLatest; // null の場合はまだ初期HP(スイッチ後そのまま)
          p1Started  = true;
        }
      } else if (line.startsWith('|-crit|p2a:') && p1Started) {
        critOccurred = true;
      } else if (line.startsWith('|-damage|p2a:')) {
        // 通常: |HP/MAXHP、ひんし: |0 fnt
        // [from] タグ付きは反動/毒スリップ/天候等 → p1の技によるダメではない
        const isFromEffect = line.includes('[from]');
        const mN = line.match(/\|(\d+)\/(\d+)/);
        const mF = line.match(/\|0 fnt/);
        if (mN || mF) {
          const curHp = mN ? parseInt(mN[1]) : 0;
          const maxHp = mN ? parseInt(mN[2]) : (p2MaxHp || 0);
          if (p2MaxHp === null && maxHp > 0) p2MaxHp = maxHp;
          if (p1Started && !isFromEffect) {
            // p1の技によるp2への直接ダメ(fromなし) → p2HpAfterを最初の値で固定
            if (p2HpAfter === null) p2HpAfter = curHp;
          } else {
            // p1技前のp2HP変化、または[from]タグ付きの間接ダメ → p2HpLatest更新
            p2HpLatest = curHp;
          }
        }
      } else if (line.startsWith('|switch|p2a:')) {
        const m = line.match(/\|(\d+)\/(\d+)/);
        if (m) {
          const hp  = parseInt(m[1]);
          const mhp = parseInt(m[2]);
          if (p2MaxHp === null) p2MaxHp = mhp;
          if (!p1Started) p2HpLatest = hp; // 初期HPをlatestとして記録
        }
      }
    }
  }

  if (critOccurred) return null;

  // p2DmgFromP1 を計算
  let p2DmgFromP1;
  if (p2HpAfter === null) {
    // p1の技がp2に当たらなかった(免疫・外れ・まもる等) → 0ダメ
    p2DmgFromP1 = 0;
  } else {
    // p2HpBefore が null = p2がスイッチ直後にp1が攻撃(反動等なし) → 初期HPを使う
    const hpBefore = p2HpBefore !== null ? p2HpBefore : (p2HpLatest !== null ? p2HpLatest : (p2MaxHp || 0));
    p2DmgFromP1 = Math.max(0, hpBefore - p2HpAfter);
  }

  return { dmg: p2DmgFromP1, p2MaxHp };
}

// ─── 判定ロジック ────────────────────────────────

// SD側が免疫(dmg=0かつ理論でも無効)なら IMMUNE_MATCH
// SD側のダメがすべてうちの理論レンジ[min-TOLE, clampedMax+TOLE]内 → RANGE_MATCH
// それ以外 → RANGE_DIFF
//
// clampedMax = min(ourRange.max, defHp): 防御側がOHKOされる場合、SDの観測maxは
// defHpに制限される(うちの理論値はHPを超えたダメを返すことがある)

const TOLE = 1; // 整数丸め許容 ±1

function classify(ourRange, sdDmgs) {
  if (ourRange.immune) {
    const sdAllZero = sdDmgs.every(d => d === 0);
    return sdAllZero ? 'IMMUNE_MATCH' : 'IMMUNE_MISMATCH';
  }

  if (sdDmgs.every(d => d === 0)) {
    // うちはダメあり、SDはゼロ → 免疫扱いの差
    return 'SD_IMMUNE_OURS_DAMAGE';
  }

  const sdMin = Math.min(...sdDmgs);
  const sdMax = Math.max(...sdDmgs);
  // 防御側HPによるOHKOクリップ: SDの観測値はdefHpを超えられない
  // うちの理論レンジもdefHpでクリップして比較する
  const defHpCap = ourRange.defHp || Infinity;
  const ourMinEff = Math.min(ourRange.min, defHpCap);
  const ourMaxEff = Math.min(ourRange.max, defHpCap);

  // SDのmin/maxがうちの実効理論レンジ内に収まるか
  const sdMinOk = sdMin >= ourMinEff - TOLE;
  const sdMaxOk = sdMax <= ourMaxEff + TOLE;

  // うちの実効min/maxもSDの観測レンジと重なるか
  const overlap = ourMinEff <= sdMax + TOLE && ourMaxEff >= sdMin - TOLE;

  if (sdMinOk && sdMaxOk) return 'RANGE_MATCH';
  if (overlap) return 'RANGE_OVERLAP'; // 部分重複(軽微な差)
  return 'RANGE_DIFF';                 // 完全不一致(真のバグ候補)
}

// ─── 拡張シナリオ (状態異常・天候・壁・道具) ─────────────────

// うちのsim: calcDamage呼び出し(拡張版: status/weather/wall/defItem対応)
function ourCalcRangeExt(E, atkPoke, defPoke, move, opts) {
  // opts: { atkItem, atkStatus, weather, defReflect, defLightScreen, defItem }
  const s1 = E.makeSideState();
  s1.poke   = atkPoke;
  s1.moves  = [move];
  s1.selectedMoveIdx = 0;
  s1.item   = opts.atkItem || null;
  s1.currentHp = E.realStat(s1, 'hp');
  s1.rank   = { atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0, acc: 0, eva: 0 };
  s1.status = opts.atkStatus || 'none';

  const s2 = E.makeSideState();
  s2.poke   = defPoke;
  s2.moves  = [];
  s2.selectedMoveIdx = 0;
  s2.item   = opts.defItem || null;
  s2.currentHp = E.realStat(s2, 'hp');
  s2.rank   = { atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0, acc: 0, eva: 0 };
  s2.status = 'none';
  s2.reflect     = !!opts.defReflect;
  s2.lightScreen = !!opts.defLightScreen;

  E.sides.self = s1;
  E.sides.opp  = s2;
  Object.assign(E.env, {
    weather:      opts.weather || 'none',
    weatherTurns: null,
    field:        'none',
    fieldTurns:   null,
    doubleBattle: false, trickRoom: false, gravity: false,
    wonderRoom:   false, magicRoom: false,
  });

  return E.calcDamage('self', 'opp', move, {});
}

// SD側: 1ターン版(weather特性ポケで天候発動→ダメ計測)
// atkSdAbility を指定するとその特性で上書き(ひでり/あめふらし等)
async function runSDOnceWeather(atkSdId, defSdId, sdMoveId, atkSdAbility, seed) {
  const stream = new Sim.BattleStream();
  const chunks = [];
  (async () => { for await (const c of stream) chunks.push(c); })();

  const p1Team = [
    '', atkSdId, '', atkSdAbility || '', sdMoveId,
    'Hardy', '', 'M', '31,31,31,31,31,31', '', '50', '',
  ].join('|');
  const p2Team = packTeam(defSdId, '', 'splash');

  stream.write(`>start ${JSON.stringify({
    formatid: 'gen9customgame', seed,
    p1: { name: 'P1', team: p1Team },
    p2: { name: 'P2', team: p2Team },
  })}`);

  await new Promise(r => setTimeout(r, 10));
  stream.write('>p1 team 1');
  stream.write('>p2 team 1');
  await new Promise(r => setTimeout(r, 10));
  stream.write('>p1 move 1');
  stream.write('>p2 move 1');
  await new Promise(r => setTimeout(r, 30));

  return extractP2DmgT1(chunks);
}

// SD側: 2ターン版
// T1: p1=splash, p2=prepMove(reflect/lightscreen/flameorb等)
// T2: p1=atkMove, p2=splash → T2のダメを計測
// T1でflameorb付与するためにflameorbItemをp1に持たせる場合は p1Item に指定
async function runSDTwoTurn(atkSdId, defSdId, sdAtkMove, sdPrepMove, p1Item, seed) {
  const stream = new Sim.BattleStream();
  const chunks = [];
  (async () => { for await (const c of stream) chunks.push(c); })();

  // p1: atkMove(T2用) + splash(T1用), item=p1Item(flameorb等)
  const p1Team = [
    '', atkSdId, p1Item || '', '', 'splash,' + sdAtkMove,
    'Hardy', '', 'M', '31,31,31,31,31,31', '', '50', '',
  ].join('|');
  // p2: prepMove(T1) + splash(T2)
  const p2Team = [
    '', defSdId, '', '', sdPrepMove + ',splash',
    'Hardy', '', 'M', '31,31,31,31,31,31', '', '50', '',
  ].join('|');

  stream.write(`>start ${JSON.stringify({
    formatid: 'gen9customgame', seed,
    p1: { name: 'P1', team: p1Team },
    p2: { name: 'P2', team: p2Team },
  })}`);

  await new Promise(r => setTimeout(r, 10));
  stream.write('>p1 team 1');
  stream.write('>p2 team 1');
  await new Promise(r => setTimeout(r, 10));

  // T1: p1=move1(splash), p2=move1(prepMove)
  stream.write('>p1 move 1');
  stream.write('>p2 move 1');
  await new Promise(r => setTimeout(r, 30));
  // T2: p1=move2(atkMove), p2=move2(splash)
  stream.write('>p1 move 2');
  stream.write('>p2 move 2');
  await new Promise(r => setTimeout(r, 30));

  return extractP2DmgT2(chunks);
}

// SD側: 2ターン版(burn): T1でflameorb付与, T2でダメ計測
// p1: T1に攻撃技でT1終了後burn付与, T2にまた攻撃 → T2のやけど影響下のダメ
async function runSDTwoTurnBurn(atkSdId, defSdId, sdAtkMove, seed) {
  const stream = new Sim.BattleStream();
  const chunks = [];
  (async () => { for await (const c of stream) chunks.push(c); })();

  // p1: flameorb持ち, atkMove × 1技(T1もT2も同技)
  const p1Team = [
    '', atkSdId, 'flameorb', '', sdAtkMove,
    'Hardy', '', 'M', '31,31,31,31,31,31', '', '50', '',
  ].join('|');
  // p2: splash(HPを削らないようにする)
  const p2Team = packTeam(defSdId, '', 'splash');

  stream.write(`>start ${JSON.stringify({
    formatid: 'gen9customgame', seed,
    p1: { name: 'P1', team: p1Team },
    p2: { name: 'P2', team: p2Team },
  })}`);

  await new Promise(r => setTimeout(r, 10));
  stream.write('>p1 team 1');
  stream.write('>p2 team 1');
  await new Promise(r => setTimeout(r, 10));

  // T1: 両者行動(p1攻撃→T1終了でflameorbがburn付与)
  stream.write('>p1 move 1');
  stream.write('>p2 move 1');
  await new Promise(r => setTimeout(r, 30));
  // T2: p1やけど状態で攻撃
  stream.write('>p1 move 1');
  stream.write('>p2 move 1');
  await new Promise(r => setTimeout(r, 30));

  return extractP2DmgT2(chunks);
}

// T1ダメ抽出ヘルパー: chunks から1ターン目のp2へのダメを取り出す
function extractP2DmgT1(chunks) {
  let critOccurred = false;
  let p2HpLatest   = null;
  let p2HpBefore   = null;
  let p2HpAfter    = null;
  let p2MaxHp      = null;
  let p1Started    = false;

  for (const chunk of chunks) {
    if (!chunk.startsWith('update')) continue;
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('|move|p1a:')) {
        if (!p1Started) { p2HpBefore = p2HpLatest; p1Started = true; }
      } else if (line.startsWith('|-crit|p2a:') && p1Started) {
        critOccurred = true;
      } else if (line.startsWith('|-damage|p2a:')) {
        const isFrom = line.includes('[from]');
        const mN = line.match(/\|(\d+)\/(\d+)/);
        const mF = line.match(/\|0 fnt/);
        if (mN || mF) {
          const cur = mN ? parseInt(mN[1]) : 0;
          const mx  = mN ? parseInt(mN[2]) : (p2MaxHp || 0);
          if (p2MaxHp === null && mx > 0) p2MaxHp = mx;
          if (p1Started && !isFrom) { if (p2HpAfter === null) p2HpAfter = cur; }
          else { p2HpLatest = cur; }
        }
      } else if (line.startsWith('|switch|p2a:')) {
        const m = line.match(/\|(\d+)\/(\d+)/);
        if (m) {
          const hp = parseInt(m[1]), mhp = parseInt(m[2]);
          if (p2MaxHp === null) p2MaxHp = mhp;
          if (!p1Started) p2HpLatest = hp;
        }
      }
    }
  }

  if (critOccurred) return null;
  if (p2HpAfter === null) return { dmg: 0, p2MaxHp };
  const hpBefore = p2HpBefore !== null ? p2HpBefore
                 : (p2HpLatest !== null ? p2HpLatest : (p2MaxHp || 0));
  return { dmg: Math.max(0, hpBefore - p2HpAfter), p2MaxHp };
}

// T2ダメ抽出ヘルパー: chunks から2ターン目のp2へのダメを取り出す
// T1で別のアクション(壁/やけど)があり、T2で攻撃するシナリオ用
function extractP2DmgT2(chunks) {
  // T2: p1が攻撃、p2がsplash → p2のHP変化はp1の攻撃のみ
  // 最初のdamage行をT1のものとして無視し、2番目以降をT2として取る
  let critOccurred = false;
  let t2DmgStarted = false;  // T1のdamageを見た(次はT2)
  let p2MaxHp      = null;
  let p2HpT2Before = null;   // T2攻撃前のp2 HP(= T1終了後HP)
  let p2HpT2After  = null;   // T2攻撃後のp2 HP
  let t1DmgSeen    = false;  // T1でp1がダメを与えたか(splash→0ダメの場合はT1ダメなし)
  let p1StartedT1  = false;  // T1でp1の行動を確認
  let p1StartedT2  = false;  // T2でp1の行動を確認
  let turnCount    = 0;

  for (const chunk of chunks) {
    if (!chunk.startsWith('update')) continue;
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('|turn|')) {
        turnCount++;
        continue;
      }
      if (line.startsWith('|-crit|p2a:') && turnCount === 2) {
        critOccurred = true;
      }
      if (line.startsWith('|switch|p2a:')) {
        const m = line.match(/\|(\d+)\/(\d+)/);
        if (m) {
          const hp = parseInt(m[1]), mhp = parseInt(m[2]);
          if (p2MaxHp === null) p2MaxHp = mhp;
          if (p2HpT2Before === null && turnCount < 2) p2HpT2Before = hp;
        }
      }
      if (line.startsWith('|-damage|p2a:') && !line.includes('[from]')) {
        const mN = line.match(/\|(\d+)\/(\d+)/);
        const mF = line.match(/\|0 fnt/);
        const cur = mN ? parseInt(mN[1]) : 0;
        const mx  = mN ? parseInt(mN[2]) : (p2MaxHp || 0);
        if (p2MaxHp === null && mx > 0) p2MaxHp = mx;
        if (turnCount === 1) {
          // T1のダメ(焼夷弾等) → T1終了後HP = cur
          p2HpT2Before = cur;
          t1DmgSeen    = true;
        } else if (turnCount === 2 && p2HpT2After === null) {
          // T2のダメ
          if (p2HpT2Before === null) p2HpT2Before = p2MaxHp; // スイッチ直後から
          p2HpT2After = cur;
        }
      }
    }
  }

  if (critOccurred) return null;
  if (p2HpT2After === null) return { dmg: 0, p2MaxHp }; // T2でダメなし
  if (p2HpT2Before === null) p2HpT2Before = p2MaxHp || 0;
  return { dmg: Math.max(0, p2HpT2Before - p2HpT2After), p2MaxHp };
}

// SD: とつげきチョッキ持ち防御側に特殊攻撃 (1ターン版)
async function runSDOnceDefItem(atkSdId, defSdId, sdMoveId, atkItemId, defItemId, seed) {
  const stream = new Sim.BattleStream();
  const chunks = [];
  (async () => { for await (const c of stream) chunks.push(c); })();

  const p1Team = packTeam(atkSdId, atkItemId || '', sdMoveId);
  const p2Team = packTeam(defSdId,  defItemId || '', 'splash');

  stream.write(`>start ${JSON.stringify({
    formatid: 'gen9customgame', seed,
    p1: { name: 'P1', team: p1Team },
    p2: { name: 'P2', team: p2Team },
  })}`);

  await new Promise(r => setTimeout(r, 10));
  stream.write('>p1 team 1');
  stream.write('>p2 team 1');
  await new Promise(r => setTimeout(r, 10));
  stream.write('>p1 move 1');
  stream.write('>p2 move 1');
  await new Promise(r => setTimeout(r, 30));

  return extractP2DmgT1(chunks);
}

// ─── 拡張シナリオ生成 ────────────────────────────

// 追加シナリオカタログ: 状態異常/天候/壁/道具の各カテゴリ
// 各エントリは { id, category, ourCalcFn, sdRunFn } の形で本体から呼び出す
function buildExtScenarios() {
  const exts = [];

  // ─── 天候ポケモンのSDid/特性のマップ ─────────────────────────
  // ポケモン番号 → SDのspeciesId
  const sdSpeciesByNumLocal = {};
  for (const s of sdSpecies) {
    if (s && s.num != null && !s.forme) sdSpeciesByNumLocal[s.num] = s.id;
  }
  const getAtkSdId = (pokeName) => {
    const p = data.POKEMON_LIST.find(x => x.name === pokeName && x.form === '通常');
    if (!p) return null;
    return sdSpeciesByNumLocal[parseInt(p.no)];
  };

  // ─── カテゴリ①: やけど(burn)物理半減 ─────────────────────────
  // p1: flameorb + 物理技, T1攻撃→T1終了でburn付与, T2のダメ = 物理×0.5
  // うちのsim: s1.status='burn'でcalcDamage
  const burnCombos = [
    { atkName: 'カビゴン',   moveName: 'じしん',       atkItem: null,         defNames: ['カメックス', 'カイリキー', 'フシギバナ', 'リザードン'] },
    { atkName: 'カイリュー', moveName: 'じしん',       atkItem: null,         defNames: ['カビゴン',   'カメックス', 'カイリキー'] },
    { atkName: 'フシギバナ', moveName: 'すてみタックル', atkItem: null,        defNames: ['カイリュー', 'カメックス'] },
  ];
  for (const bc of burnCombos) {
    const atkPoke = data.POKEMON_LIST.find(x => x.name === bc.atkName && x.form === '通常');
    if (!atkPoke) continue;
    const atkSdId = getAtkSdId(bc.atkName);
    if (!atkSdId) continue;
    const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === bc.moveName);
    if (!mv) continue;
    for (const defName of bc.defNames) {
      const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
      if (!defPoke) continue;
      const defSdId = getAtkSdId(defName);
      if (!defSdId) continue;
      exts.push({
        id:       `EXT_burn_${bc.atkName}_${mv.name}_vs_${defName}`,
        category: 'burn_phys_half',
        atkName: bc.atkName, defName, atkPoke, defPoke,
        move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
        ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { atkItem: bc.atkItem, atkStatus: 'burn' }),
        sdRunFn:   async (seed) => runSDTwoTurnBurn(atkSdId, defSdId, mv.id || (sdMoveByNum[mv.move_no] && sdMoveByNum[mv.move_no].id) || 'earthquake', seed),
        desc: `やけど物理${bc.atkName}→${defName}/${mv.name}`,
      });
    }
  }

  // ─── カテゴリ②: 天候 ─────────────────────────────────────────
  // rain: ペリッパー(あめふらし特性) + なみのり → みず×1.5
  // sunny: コータス(ひでり特性) + やけっぱち → ほのお×1.5
  // sand: バンギラス(すなおこし特性) + パワージェム → いわが相手の特防に無補正
  //       (すなあらし中いわ特防×1.5は防御側がいわタイプの時のみ)
  const weatherScenes = [
    // rain: ペリッパー(あめふらし=ab2, SDでは 'Drizzle') + なみのり × 防御側4種
    ...[
      { atkName: 'ペリッパー', weather: 'rain', moveName: 'なみのり', sdAbility: 'Drizzle',
        defNames: ['カビゴン', 'カイリキー', 'フシギバナ', 'リザードン'] },
    ].flatMap(({ atkName, weather, moveName, sdAbility, defNames }) => {
      const atkPoke = data.POKEMON_LIST.find(x => x.name === atkName && x.form === '通常');
      const atkSdId = getAtkSdId(atkName);
      const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === moveName);
      if (!atkPoke || !atkSdId || !mv) return [];
      return defNames.map(defName => {
        const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
        const defSdId = getAtkSdId(defName);
        if (!defPoke || !defSdId) return null;
        return {
          id: `EXT_rain_${atkName}_${moveName}_vs_${defName}`,
          category: 'weather_rain',
          atkName, defName, atkPoke, defPoke,
          move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
          ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { weather: 'rain' }),
          sdRunFn:   async (seed) => runSDOnceWeather(atkSdId, defSdId, sdMoveByNum[mv.move_no]?.id || 'surf', sdAbility, seed),
          desc: `あめ強化${atkName}→${defName}/${moveName}`,
        };
      }).filter(Boolean);
    }),
    // sunny: コータス(ひでり=ab2, SDでは 'Drought') + やけっぱち × 防御側4種
    ...[
      { atkName: 'コータス', weather: 'sunny', moveName: 'やけっぱち', sdAbility: 'Drought',
        defNames: ['カビゴン', 'カメックス', 'カイリキー', 'フシギバナ'] },
    ].flatMap(({ atkName, weather, moveName, sdAbility, defNames }) => {
      const atkPoke = data.POKEMON_LIST.find(x => x.name === atkName && x.form === '通常');
      const atkSdId = getAtkSdId(atkName);
      const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === moveName);
      if (!atkPoke || !atkSdId || !mv) return [];
      return defNames.map(defName => {
        const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
        const defSdId = getAtkSdId(defName);
        if (!defPoke || !defSdId) return null;
        return {
          id: `EXT_sunny_${atkName}_${moveName}_vs_${defName}`,
          category: 'weather_sunny',
          atkName, defName, atkPoke, defPoke,
          move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
          ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { weather: 'sunny' }),
          sdRunFn:   async (seed) => runSDOnceWeather(atkSdId, defSdId, sdMoveByNum[mv.move_no]?.id || 'flamecharge', sdAbility, seed),
          desc: `はれ強化${atkName}→${defName}/${moveName}`,
        };
      }).filter(Boolean);
    }),
    // sand: バンギラス(すなおこし=ab1 SDでは 'Sand Stream') + パワージェム × 防御4種
    // すなあらし中: いわタイプの特防×1.5 → バンギラスが特殊攻撃→相手がいわタイプでない場合は天候補正なし
    // 検証目的: バンギラスがパワージェム(いわ特殊)でいわタイプ防御側に攻撃 = 天候補正なし(攻撃側補正)
    ...[
      { atkName: 'バンギラス', weather: 'sand', moveName: 'パワージェム', sdAbility: 'Sand Stream',
        defNames: ['カビゴン', 'カメックス', 'カイリュー', 'カイリキー'] },
    ].flatMap(({ atkName, weather, moveName, sdAbility, defNames }) => {
      const atkPoke = data.POKEMON_LIST.find(x => x.name === atkName && x.form === '通常');
      const atkSdId = getAtkSdId(atkName);
      const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === moveName);
      if (!atkPoke || !atkSdId || !mv) return [];
      return defNames.map(defName => {
        const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
        const defSdId = getAtkSdId(defName);
        if (!defPoke || !defSdId) return null;
        return {
          id: `EXT_sand_${atkName}_${moveName}_vs_${defName}`,
          category: 'weather_sand',
          atkName, defName, atkPoke, defPoke,
          move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
          ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { weather: 'sand' }),
          sdRunFn:   async (seed) => runSDOnceWeather(atkSdId, defSdId, sdMoveByNum[mv.move_no]?.id || 'powergem', sdAbility, seed),
          desc: `すな${atkName}→${defName}/${moveName}`,
        };
      }).filter(Boolean);
    }),
    // sand spdef: バンギラス攻撃(さわぐ=ノーマル特殊) vs いわタイプ防御(バンギラス自身)
    // バンギラスはいわ/あくタイプ → すなあらし中いわタイプ特防×1.5
    ...[
      { atkName: 'スターミー', weather: 'sand', moveName: 'いたみわけ', sdAbility: null,
        sandTriggerId: 'tyranitar', // SDで天候起動役
        defNames: ['バンギラス'] },
    ].flatMap(({ atkName, weather, moveName, sdAbility, sandTriggerId, defNames }) => {
      // スターミーがさわぐ(ノーマル特殊, secondary=sleep免疫のみ) → 使えないかも
      // 代わりに: スターミー(なみのり特殊みず)対バンギラス(いわ/あく)を砂嵐特防1.5x確認
      // バンギラスをT2の攻撃側にして自分自身のチームメイトに...難しい
      // シンプルに: ゲンガー(特殊ゴースト/たたりめ)でバンギラス(いわ/あく)に攻撃 - 砂特防なし(ゴーストはいわに等倍)
      // 実際の砂特防×1.5検証: 特殊攻撃側が非いわポケ × 防御がバンギラス(いわあく)
      // でも砂嵐をトリガーするためにバンギラスが必要 → バンギラスが守備側=自分でトリガー
      return []; // このパターンは複雑なのでスキップ
    }),
  ];
  exts.push(...weatherScenes);

  // ─── カテゴリ③: リフレクター/ひかりのかべ ──────────────────
  // T1: p1=splash, p2=reflect/lightscreen
  // T2: p1が物理/特殊攻撃(半減), p2=splash
  // うちのsim: s2.reflect=true or s2.lightScreen=true

  // リフレクター: p1=カビゴン(じしん物理) vs p2(reflect使える速いポケ)
  // p2がp1より速い必要あり(p2が先にreflect → T1同ターンp1攻撃でも壁効果あり)
  // カビゴン spd=30 → p2はspd>30必要(ほぼ全ポケ)
  // T1でreflect発動 → T1でp1のじしんに壁効果が適用される
  // 2ターン式の方が安全 → runSDTwoTurnでT1=splash/reflect, T2=eq/splash
  const reflectCombos = [
    { atkName: 'カビゴン',   moveName: 'じしん',     defNames: ['カメックス', 'カイリュー', 'フシギバナ', 'カイリキー', 'リザードン'] },
    { atkName: 'カイリュー', moveName: 'じしん',     defNames: ['カビゴン',   'カメックス'] },
  ];
  for (const rc of reflectCombos) {
    const atkPoke = data.POKEMON_LIST.find(x => x.name === rc.atkName && x.form === '通常');
    const atkSdId = getAtkSdId(rc.atkName);
    const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === rc.moveName);
    if (!atkPoke || !atkSdId || !mv) continue;
    const sdMvId = sdMoveByNum[mv.move_no]?.id || 'earthquake';
    for (const defName of rc.defNames) {
      const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
      const defSdId = getAtkSdId(defName);
      if (!defPoke || !defSdId) continue;
      exts.push({
        id:       `EXT_reflect_${rc.atkName}_${mv.name}_vs_${defName}`,
        category: 'reflect_wall',
        atkName: rc.atkName, defName, atkPoke, defPoke,
        move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
        ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { defReflect: true }),
        // T1:p1=splash, p2=reflect; T2:p1=eq, p2=splash
        sdRunFn:   async (seed) => runSDTwoTurn(atkSdId, defSdId, sdMvId, 'reflect', null, seed),
        desc: `リフレクター${rc.atkName}→${defName}/${mv.name}`,
      });
    }
  }

  // ひかりのかべ: p1=ゲンガー(たたりめ特殊) / スターミー(特殊) vs lightscreen防御側
  // ゲンガー spd=110, 守備側がspd>110でないと先攻にならないので2ターン式を使う
  const lsCombos = [
    { atkName: 'ゲンガー',  moveName: 'たたりめ',  defNames: ['カイリュー', 'フシギバナ', 'カメックス', 'カイリキー'] },
    { atkName: 'スターミー', moveName: 'なみのり',  defNames: ['カビゴン',   'カイリュー'] },
  ];
  for (const lc of lsCombos) {
    const atkPoke = data.POKEMON_LIST.find(x => x.name === lc.atkName && x.form === '通常');
    const atkSdId = getAtkSdId(lc.atkName);
    const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === lc.moveName);
    if (!atkPoke || !atkSdId || !mv) continue;
    const sdMvId = sdMoveByNum[mv.move_no]?.id || 'hex';
    for (const defName of lc.defNames) {
      const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
      const defSdId = getAtkSdId(defName);
      if (!defPoke || !defSdId) continue;
      // ひかりのかべをdefSdIdが使えるか確認(SDはlegacy movelistなので大抵使える)
      exts.push({
        id:       `EXT_lightscreen_${lc.atkName}_${mv.name}_vs_${defName}`,
        category: 'lightscreen_wall',
        atkName: lc.atkName, defName, atkPoke, defPoke,
        move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
        ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { defLightScreen: true }),
        // T1:p1=splash, p2=lightscreen; T2:p1=attack, p2=splash
        sdRunFn:   async (seed) => runSDTwoTurn(atkSdId, defSdId, sdMvId, 'lightscreen', null, seed),
        desc: `ひかりのかべ${lc.atkName}→${defName}/${mv.name}`,
      });
    }
  }

  // ─── カテゴリ④: とつげきチョッキ(特防×1.5) ─────────────────
  const vestCombos = [
    { atkName: 'ゲンガー',   moveName: 'たたりめ', atkItem: 'life_orb', defNames: ['カイリュー', 'カイリキー', 'カメックス', 'フシギバナ'] },
    { atkName: 'スターミー',  moveName: 'なみのり', atkItem: null,       defNames: ['カビゴン',   'カイリキー'] },
  ];
  for (const vc of vestCombos) {
    const atkPoke = data.POKEMON_LIST.find(x => x.name === vc.atkName && x.form === '通常');
    const atkSdId = getAtkSdId(vc.atkName);
    const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === vc.moveName);
    if (!atkPoke || !atkSdId || !mv) continue;
    const sdMvId     = sdMoveByNum[mv.move_no]?.id || 'hex';
    const sdAtkItem  = vc.atkItem ? (itemOurToSD[vc.atkItem] || '') : '';
    for (const defName of vc.defNames) {
      const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
      const defSdId = getAtkSdId(defName);
      if (!defPoke || !defSdId) continue;
      exts.push({
        id:       `EXT_vest_${vc.atkName}_${mv.name}_vs_${defName}`,
        category: 'assault_vest',
        atkName: vc.atkName, defName, atkPoke, defPoke,
        move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
        ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { atkItem: vc.atkItem, defItem: 'assault_vest' }),
        sdRunFn:   async (seed) => runSDOnceDefItem(atkSdId, defSdId, sdMvId, sdAtkItem, 'assaultvest', seed),
        desc: `とつげきチョッキ${vc.atkName}→${defName}/${mv.name}`,
      });
    }
  }

  // ─── カテゴリ⑤: burn追加(カメックス/スターミーが物理技でやけど半減) ────
  // カメックス: 物理クリーン技 = じしん/すてみタックル (からげんきはGuts系除外不要だが意図が別)
  const burnCombos2 = [
    { atkName: 'カメックス',  moveName: 'じしん',        defNames: ['カビゴン', 'カイリュー', 'カイリキー', 'フシギバナ'] },
    { atkName: 'カメックス',  moveName: 'すてみタックル', defNames: ['カビゴン', 'カイリュー'] },
    { atkName: 'カイリュー',  moveName: 'すてみタックル', defNames: ['カビゴン', 'カメックス', 'フシギバナ'] },
  ];
  for (const bc of burnCombos2) {
    const atkPoke = data.POKEMON_LIST.find(x => x.name === bc.atkName && x.form === '通常');
    if (!atkPoke) continue;
    const atkSdId = getAtkSdId(bc.atkName);
    if (!atkSdId) continue;
    const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === bc.moveName);
    if (!mv) continue;
    const sdMvId = sdMoveByNum[mv.move_no]?.id;
    if (!sdMvId) continue;
    for (const defName of bc.defNames) {
      const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
      const defSdId = getAtkSdId(defName);
      if (!defPoke || !defSdId) continue;
      exts.push({
        id:       `EXT_burn2_${bc.atkName}_${mv.name}_vs_${defName}`,
        category: 'burn_phys_half',
        atkName: bc.atkName, defName, atkPoke, defPoke,
        move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
        ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { atkStatus: 'burn' }),
        sdRunFn:   async (seed) => runSDTwoTurnBurn(atkSdId, defSdId, sdMvId, seed),
        desc: `やけど物理2-${bc.atkName}→${defName}/${mv.name}`,
      });
    }
  }

  // ─── カテゴリ⑥: rain天候追加(スターミー+なみのり vs 守備側4種) ────────
  // 守備側にニョロトノ(Drizzle)を置いてSD側で雨を起動する
  // → runSDOnceWeatherの代わりに: p2チームにニョロトノを先鋒、p1がスターミー
  // しかしrunSDOnceWeatherはp1の特性で天候を起動する設計
  // → 新アプローチ: ペリッパー(rain)を攻撃側、カイリュー/スターミー等の相手に使う
  //    →既存rainscenesと違う攻撃側(スターミー)で水技のrainブーストを確認
  // ペリッパー以外のあめふらし持ちが必要 → DBでニョロトノを確認
  // ニョロトノのSDid: politoed
  const politoedId = getAtkSdId('ニョロトノ');
  if (politoedId) {
    // ニョロトノ(Drizzle) + なみのり × 追加防御4種 → rain下みず×1.5 (ペリッパーと同設計)
    const rainExtraDefs = ['カビゴン', 'カイリュー', 'カイリキー', 'フシギバナ'];
    const nami = Object.values(data.WAZA_MAP).find(m => m && m.name === 'なみのり');
    const namiSdId = nami ? (sdMoveByNum[nami.move_no]?.id || 'surf') : 'surf';
    const politoedPoke = data.POKEMON_LIST.find(x => x.name === 'ニョロトノ' && x.form === '通常');
    if (politoedPoke && nami) {
      for (const defName of rainExtraDefs) {
        const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
        const defSdId = getAtkSdId(defName);
        if (!defPoke || !defSdId) continue;
        exts.push({
          id:       `EXT_rain2_ニョロトノ_なみのり_vs_${defName}`,
          category: 'weather_rain',
          atkName: 'ニョロトノ', defName, atkPoke: politoedPoke, defPoke,
          move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === nami)[0], ...nami },
          ourCalcFn: (E) => ourCalcRangeExt(E, politoedPoke, defPoke, nami, { weather: 'rain' }),
          sdRunFn:   async (seed) => runSDOnceWeather(politoedId, defSdId, namiSdId, 'Drizzle', seed),
          desc: `あめニョロトノ→${defName}/なみのり`,
        });
      }
    }
  }

  // ─── カテゴリ⑦: sunny追加(ブーバー/ゴウカザル → ほのお特殊+sunny) ─────
  // ゴウカザル: ほのお特殊クリーン技は?
  // DBで確認: ほのお特殊でsecondaryなし、acc=100、固定威力
  const sunnyPoke2Combos = [
    { atkName: 'コータス', moveName: 'やけっぱち', defNames: ['カイリュー', 'カイリキー'] },
  ];
  for (const sc of sunnyPoke2Combos) {
    const atkPoke = data.POKEMON_LIST.find(x => x.name === sc.atkName && x.form === '通常');
    const atkSdId = getAtkSdId(sc.atkName);
    const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === sc.moveName);
    if (!atkPoke || !atkSdId || !mv) continue;
    const sdMvId = sdMoveByNum[mv.move_no]?.id;
    if (!sdMvId) continue;
    for (const defName of sc.defNames) {
      const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
      const defSdId = getAtkSdId(defName);
      if (!defPoke || !defSdId) continue;
      exts.push({
        id:       `EXT_sunny2_${sc.atkName}_${mv.name}_vs_${defName}`,
        category: 'weather_sunny',
        atkName: sc.atkName, defName, atkPoke, defPoke,
        move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
        ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { weather: 'sunny' }),
        sdRunFn:   async (seed) => runSDOnceWeather(atkSdId, defSdId, sdMvId, 'Drought', seed),
        desc: `はれ追加${sc.atkName}→${defName}/${mv.name}`,
      });
    }
  }

  // ─── カテゴリ⑧: reflect追加(フシギバナ+すてみタックル × 壁) ─────────
  // フシギバナ spd=45(遅い) → 2ターン式でT1p2=reflect, T2p1=すてみタックル
  const reflectCombos2 = [
    { atkName: 'フシギバナ', moveName: 'すてみタックル', defNames: ['スターミー', 'カメックス', 'カイリュー'] },
    { atkName: 'カビゴン',   moveName: 'じしん',         defNames: ['スターミー'] },
  ];
  for (const rc of reflectCombos2) {
    const atkPoke = data.POKEMON_LIST.find(x => x.name === rc.atkName && x.form === '通常');
    const atkSdId = getAtkSdId(rc.atkName);
    const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === rc.moveName);
    if (!atkPoke || !atkSdId || !mv) continue;
    const sdMvId = sdMoveByNum[mv.move_no]?.id;
    if (!sdMvId) continue;
    for (const defName of rc.defNames) {
      // 既にextsに同IDが入っていればスキップ
      const eid = `EXT_reflect2_${rc.atkName}_${mv.name}_vs_${defName}`;
      if (exts.find(e => e.id === eid)) continue;
      const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
      const defSdId = getAtkSdId(defName);
      if (!defPoke || !defSdId) continue;
      exts.push({
        id:       eid,
        category: 'reflect_wall',
        atkName: rc.atkName, defName, atkPoke, defPoke,
        move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
        ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { defReflect: true }),
        sdRunFn:   async (seed) => runSDTwoTurn(atkSdId, defSdId, sdMvId, 'reflect', null, seed),
        desc: `リフレクター追加${rc.atkName}→${defName}/${mv.name}`,
      });
    }
  }

  // ─── カテゴリ⑨: lightscreen追加(カイリュー/バンギラスの特殊) ──────────
  const lsCombos2 = [
    { atkName: 'スターミー',  moveName: 'なみのり',  defNames: ['カイリキー', 'フシギバナ', 'カイリュー'] },
    { atkName: 'ゲンガー',    moveName: 'たたりめ',  defNames: ['カビゴン', 'ブラッキー'] },
  ];
  for (const lc of lsCombos2) {
    const atkPoke = data.POKEMON_LIST.find(x => x.name === lc.atkName && x.form === '通常');
    const atkSdId = getAtkSdId(lc.atkName);
    const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === lc.moveName);
    if (!atkPoke || !atkSdId || !mv) continue;
    const sdMvId = sdMoveByNum[mv.move_no]?.id;
    if (!sdMvId) continue;
    for (const defName of lc.defNames) {
      const eid = `EXT_lightscreen2_${lc.atkName}_${mv.name}_vs_${defName}`;
      if (exts.find(e => e.id === eid)) continue;
      const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
      const defSdId = getAtkSdId(defName);
      if (!defPoke || !defSdId) continue;
      exts.push({
        id:       eid,
        category: 'lightscreen_wall',
        atkName: lc.atkName, defName, atkPoke, defPoke,
        move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
        ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { defLightScreen: true }),
        sdRunFn:   async (seed) => runSDTwoTurn(atkSdId, defSdId, sdMvId, 'lightscreen', null, seed),
        desc: `ひかりのかべ追加${lc.atkName}→${defName}/${mv.name}`,
      });
    }
  }

  // ─── カテゴリ⑩: vest追加(カイリュー/スターミー/バンギラス攻撃) ──────
  const vestCombos2 = [
    { atkName: 'カイリュー',  moveName: 'なみのり',    atkItem: null, defNames: ['カビゴン',   'フシギバナ', 'スターミー', 'ブラッキー'] },
    { atkName: 'バンギラス',  moveName: 'パワージェム', atkItem: null, defNames: ['カメックス', 'カイリキー', 'カビゴン'] },
  ];
  for (const vc of vestCombos2) {
    const atkPoke = data.POKEMON_LIST.find(x => x.name === vc.atkName && x.form === '通常');
    const atkSdId = getAtkSdId(vc.atkName);
    const mv = Object.values(data.WAZA_MAP).find(m => m && m.name === vc.moveName);
    if (!atkPoke || !atkSdId || !mv) continue;
    const sdMvId = sdMoveByNum[mv.move_no]?.id;
    if (!sdMvId) continue;
    const sdAtkItem = vc.atkItem ? (itemOurToSD[vc.atkItem] || '') : '';
    for (const defName of vc.defNames) {
      const eid = `EXT_vest2_${vc.atkName}_${mv.name}_vs_${defName}`;
      if (exts.find(e => e.id === eid)) continue;
      const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
      const defSdId = getAtkSdId(defName);
      if (!defPoke || !defSdId) continue;
      exts.push({
        id:       eid,
        category: 'assault_vest',
        atkName: vc.atkName, defName, atkPoke, defPoke,
        move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === mv)[0], ...mv },
        ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, mv, { atkItem: vc.atkItem, defItem: 'assault_vest' }),
        sdRunFn:   async (seed) => runSDOnceDefItem(atkSdId, defSdId, sdMvId, sdAtkItem, 'assaultvest', seed),
        desc: `とつげきチョッキ追加${vc.atkName}→${defName}/${mv.name}`,
      });
    }
  }

  // ─── カテゴリ⑪: からげんき+やけど(burn半減を回避する確認) ────────────
  // からげんき(facade): やけど時に威力2倍 + やけど物理半減なし → 140威力相当
  // うちのsimとSDで相殺が正しく処理されるか確認
  const facadeBurnCombos = [
    { atkName: 'カメックス', defNames: ['カイリュー', 'カビゴン', 'カイリキー', 'フシギバナ'] },
    { atkName: 'カビゴン',   defNames: ['カイリュー', 'カメックス', 'カイリキー'] },
  ];
  const facadeMv = Object.values(data.WAZA_MAP).find(m => m && m.name === 'からげんき');
  const facadeSdId = facadeMv ? (sdMoveByNum[facadeMv.move_no]?.id || 'facade') : null;
  if (facadeMv && facadeSdId) {
    for (const fc of facadeBurnCombos) {
      const atkPoke = data.POKEMON_LIST.find(x => x.name === fc.atkName && x.form === '通常');
      const atkSdId = getAtkSdId(fc.atkName);
      if (!atkPoke || !atkSdId) continue;
      for (const defName of fc.defNames) {
        const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
        const defSdId = getAtkSdId(defName);
        if (!defPoke || !defSdId) continue;
        exts.push({
          id:       `EXT_facade_burn_${fc.atkName}_vs_${defName}`,
          category: 'facade_burn_bypass',
          atkName: fc.atkName, defName, atkPoke, defPoke,
          move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === facadeMv)[0], ...facadeMv },
          ourCalcFn: (E) => ourCalcRangeExt(E, atkPoke, defPoke, facadeMv, { atkStatus: 'burn' }),
          sdRunFn:   async (seed) => runSDTwoTurnBurn(atkSdId, defSdId, facadeSdId, seed),
          desc: `からげんきやけど相殺${fc.atkName}→${defName}`,
        });
      }
    }
  }

  // ─── カテゴリ⑫: sunny追加(コータス × バンギラス/カイリュー) ─────────
  // sunny2に追加 (コータスやけっぱち晴れ vs バンギラス/カイリューの追加分)
  const sunExtraDefs = ['バンギラス', 'カイリュー'];
  const sunAtk = data.POKEMON_LIST.find(x => x.name === 'コータス' && x.form === '通常');
  const sunAtkSdId = getAtkSdId('コータス');
  const yakMv = Object.values(data.WAZA_MAP).find(m => m && m.name === 'やけっぱち');
  const yakSdId = yakMv ? (sdMoveByNum[yakMv.move_no]?.id || 'temperflare') : null;
  if (sunAtk && sunAtkSdId && yakMv && yakSdId) {
    for (const defName of sunExtraDefs) {
      const defPoke = data.POKEMON_LIST.find(x => x.name === defName && x.form === '通常');
      const defSdId = getAtkSdId(defName);
      if (!defPoke || !defSdId) continue;
      const eid = `EXT_sunny3_コータス_やけっぱち_vs_${defName}`;
      if (exts.find(e => e.id === eid)) continue;
      exts.push({
        id:       eid,
        category: 'weather_sunny',
        atkName: 'コータス', defName, atkPoke: sunAtk, defPoke,
        move: { key: Object.entries(data.WAZA_MAP).find(([,v]) => v === yakMv)[0], ...yakMv },
        ourCalcFn: (E) => ourCalcRangeExt(E, sunAtk, defPoke, yakMv, { weather: 'sunny' }),
        sdRunFn:   async (seed) => runSDOnceWeather(sunAtkSdId, defSdId, yakSdId, 'Drought', seed),
        desc: `はれ追加3コータス→${defName}/やけっぱち`,
      });
    }
  }

  return exts;
}

// ─── メイン ──────────────────────────────────────

async function main() {
  console.log('Showdown決定論差分ハーネス 起動');
  console.log('技プール(クリーン技):', CLEAN_POOL.length, '件');

  const E = buildEngine();
  const scenarios = buildScenarios();
  const extScenarios = buildExtScenarios();
  console.log('既存シナリオ数:', scenarios.length, '/ 拡張シナリオ数:', extScenarios.length);
  console.log('SD実行回数/シナリオ:', SD_RUNS, '回\n');

  const results = [];
  let done = 0, skipped = 0, errored = 0;
  let rangeMatch = 0, rangeOverlap = 0, rangeDiff = 0, immuneMatch = 0, immuneMismatch = 0;
  const trueDiffs = [];

  for (const sc of scenarios) {
    // --- うちのsim: 理論レンジ取得 ---
    const wazaEntry = data.WAZA_MAP[sc.move.key];
    if (!wazaEntry) { skipped++; continue; }

    let ourRange;
    try {
      ourRange = ourCalcRange(E, sc.atkPoke, sc.defPoke, wazaEntry, sc.ourItem);
    } catch (e) {
      errored++;
      results.push({ id: sc.id, status: 'our_error', error: e.message });
      continue;
    }

    if (!ourRange) {
      skipped++;
      results.push({ id: sc.id, status: 'skipped_no_range' });
      continue;
    }

    // 免疫チェック: typeeffがゼロなら両エンジン共にゼロのはず
    const isOurImmune = ourRange.immune || ourRange.max === 0;

    // 防御側のSD技選択: p2にも何か技が必要
    // 防御側が知っている技を1つ調べる(p2の攻撃はp1のHPに影響するが今回はp2ダメのみ見る)
    // p2のダミー技: 防御側ポケが使えるクリーン技 or struggle相当
    // 守備側技: 自爆系を除いたクリーン技を選ぶ(p2がひんしになりバトルが終わるのを防ぐ)
    // フォールバック: 守備技がない場合は「tackle(move_no=33, ノーマル物理acc100)」を使用
    // SDで未習得の技を指定するとエラーが出るが、BattleStreamはstruggleにフォールバックする
    const defDefMove = cleanMovesFor(sc.defName, '物理', 1, true)[0]
                    || cleanMovesFor(sc.defName, '特殊', 1, true)[0];
    // tackle は全種族が学習可能なのでフォールバック先として最適
    const defSdMoveId = defDefMove ? defDefMove.sdId : 'tackle';

    // --- SD側: N回実行してダメ収集(急所が出たrunはリトライしてSD_RUNS件確保) ---
    const sdDmgs = [];
    let sdRunErr = 0, sdCritSkip = 0;
    let seedIdx = 0;
    const MAX_TRIES = SD_RUNS * 5; // 急所多発時の上限
    while (sdDmgs.length < SD_RUNS && seedIdx < MAX_TRIES) {
      const seed = [seedIdx * 3141 + 1, seedIdx * 2718 + 2, seedIdx * 1618 + 3, seedIdx * 1414 + 4];
      seedIdx++;
      try {
        const r = await runSDOnce(sc.atkSdId, sc.defSdId, sc.move.sdId, sc.sdItem, defSdMoveId, seed);
        if (r !== null) {
          sdDmgs.push(r.dmg);
        } else {
          sdCritSkip++; // 急所が出たのでスキップ(次のseedでリトライ)
        }
      } catch (e) {
        sdRunErr++;
      }
    }

    if (!sdDmgs.length) {
      errored++;
      results.push({ id: sc.id, status: 'sd_all_error', sdRunErr });
      continue;
    }

    // --- 判定 ---
    // ourRange.hp = 防御側HP(calcDamageが返す)
    const verdict = classify(
      { min: ourRange.min, max: ourRange.max, immune: isOurImmune, defHp: ourRange.hp },
      sdDmgs
    );

    const entry = {
      id:         sc.id,
      status:     verdict,
      atk:        sc.atkName,
      def:        sc.defName,
      move:       sc.move.name,
      type:       sc.move.type,
      category:   sc.move.category,
      item:       sc.ourItem || null,
      our_min:    ourRange.min,
      our_max:    ourRange.max,
      our_immune: isOurImmune,
      sd_runs:    sdDmgs.length,
      sd_crits_skipped: sdCritSkip,
      sd_min:     Math.min(...sdDmgs),
      sd_max:     Math.max(...sdDmgs),
      sd_median:  [...sdDmgs].sort((a,b) => a-b)[Math.floor(sdDmgs.length/2)],
    };

    if (verdict === 'RANGE_MATCH' || verdict === 'IMMUNE_MATCH') {
      rangeMatch++;
    } else if (verdict === 'RANGE_OVERLAP') {
      rangeOverlap++;
      trueDiffs.push({ ...entry, diff_type: 'overlap', diff_detail: `ourRange=[${ourRange.min},${ourRange.max}] sdRange=[${entry.sd_min},${entry.sd_max}]` });
    } else if (verdict === 'RANGE_DIFF' || verdict === 'SD_IMMUNE_OURS_DAMAGE' || verdict === 'IMMUNE_MISMATCH') {
      rangeDiff++;
      trueDiffs.push({ ...entry, diff_type: 'true_diff', diff_detail: `ourRange=[${ourRange.min},${ourRange.max}] sdRange=[${entry.sd_min},${entry.sd_max}]` });
    }

    results.push(entry);
    done++;

    const icon = (verdict === 'RANGE_MATCH' || verdict === 'IMMUNE_MATCH') ? '✓' : '✗';
    process.stdout.write(`  ${icon} ${sc.id}: our[${ourRange.min}-${ourRange.max}] sd[${entry.sd_min}-${entry.sd_max}] → ${verdict}\n`);
  }

  // ─── 拡張シナリオ実行 ────────────────────────────
  console.log('\n─── 拡張シナリオ(状態異常・天候・壁・道具) ─────────────────');
  for (const sc of extScenarios) {
    // --- うちのsim: 理論レンジ取得 ---
    let ourRange;
    try {
      ourRange = sc.ourCalcFn(E);
    } catch (e) {
      errored++;
      results.push({ id: sc.id, status: 'our_error', error: e.message, category: sc.category });
      continue;
    }

    if (!ourRange) {
      skipped++;
      results.push({ id: sc.id, status: 'skipped_no_range', category: sc.category });
      continue;
    }

    const isOurImmune = ourRange.immune || ourRange.max === 0;

    // --- SD側: N回実行してダメ収集(急所スキップ) ---
    const sdDmgs = [];
    let sdRunErr = 0, sdCritSkip = 0;
    let seedIdx = 0;
    const MAX_TRIES = SD_RUNS * 5;
    while (sdDmgs.length < SD_RUNS && seedIdx < MAX_TRIES) {
      const seed = [seedIdx * 3141 + 1, seedIdx * 2718 + 2, seedIdx * 1618 + 3, seedIdx * 1414 + 4];
      seedIdx++;
      try {
        const r = await sc.sdRunFn(seed);
        if (r !== null) {
          sdDmgs.push(r.dmg);
        } else {
          sdCritSkip++;
        }
      } catch (e) {
        sdRunErr++;
      }
    }

    if (!sdDmgs.length) {
      errored++;
      results.push({ id: sc.id, status: 'sd_all_error', sdRunErr, category: sc.category });
      continue;
    }

    const verdict = classify(
      { min: ourRange.min, max: ourRange.max, immune: isOurImmune, defHp: ourRange.hp },
      sdDmgs
    );

    const entry = {
      id:         sc.id,
      status:     verdict,
      category:   sc.category,
      atk:        sc.atkName,
      def:        sc.defName,
      move:       sc.move.name,
      type:       sc.move.type || '',
      our_min:    ourRange.min,
      our_max:    ourRange.max,
      our_immune: isOurImmune,
      sd_runs:    sdDmgs.length,
      sd_crits_skipped: sdCritSkip,
      sd_min:     Math.min(...sdDmgs),
      sd_max:     Math.max(...sdDmgs),
      sd_median:  [...sdDmgs].sort((a,b) => a-b)[Math.floor(sdDmgs.length/2)],
      desc:       sc.desc || '',
    };

    if (verdict === 'RANGE_MATCH' || verdict === 'IMMUNE_MATCH') {
      rangeMatch++;
    } else if (verdict === 'RANGE_OVERLAP') {
      rangeOverlap++;
      trueDiffs.push({ ...entry, diff_type: 'overlap', diff_detail: `ourRange=[${ourRange.min},${ourRange.max}] sdRange=[${entry.sd_min},${entry.sd_max}]` });
    } else if (verdict === 'RANGE_DIFF' || verdict === 'SD_IMMUNE_OURS_DAMAGE' || verdict === 'IMMUNE_MISMATCH') {
      rangeDiff++;
      trueDiffs.push({ ...entry, diff_type: 'true_diff', diff_detail: `ourRange=[${ourRange.min},${ourRange.max}] sdRange=[${entry.sd_min},${entry.sd_max}]` });
    }

    results.push(entry);
    done++;

    const icon = (verdict === 'RANGE_MATCH' || verdict === 'IMMUNE_MATCH') ? '✓' : '✗';
    process.stdout.write(`  ${icon} [${sc.category}] ${sc.id.slice(0, 70)}: our[${ourRange.min}-${ourRange.max}] sd[${entry.sd_min}-${entry.sd_max}] → ${verdict}\n`);
  }

  // ─── サマリ ─────────────────────────────────────

  const totalExecuted = done;
  const matchRate = totalExecuted > 0 ? ((rangeMatch / totalExecuted) * 100).toFixed(1) + '%' : 'N/A';

  // カテゴリ別集計
  const categoryStats = {};
  for (const r of results) {
    const cat = r.category || 'base';
    if (!categoryStats[cat]) categoryStats[cat] = { match: 0, diff: 0, total: 0 };
    categoryStats[cat].total++;
    if (r.status === 'RANGE_MATCH' || r.status === 'IMMUNE_MATCH') categoryStats[cat].match++;
    else if (r.status === 'RANGE_DIFF' || r.status === 'RANGE_OVERLAP' ||
             r.status === 'SD_IMMUNE_OURS_DAMAGE' || r.status === 'IMMUNE_MISMATCH') categoryStats[cat].diff++;
  }

  const summary = {
    date:                    new Date().toISOString(),
    harness_version:         'deterministic_v2_extended',
    description:             '命中100・追加効果なし技のベース120局面 + 状態異常/天候/壁/道具の拡張シナリオ',
    clean_move_pool_size:    CLEAN_POOL.length,
    base_scenarios:          scenarios.length,
    ext_scenarios:           extScenarios.length,
    total_scenarios:         scenarios.length + extScenarios.length,
    executed:                totalExecuted,
    skipped,
    errored,
    range_match:             rangeMatch,
    range_overlap:           rangeOverlap,
    range_diff:              rangeDiff,
    match_rate:              matchRate,
    tolerance:               TOLE,
    sd_runs_per_scenario:    SD_RUNS,
    category_stats:          categoryStats,
    true_diffs:              trueDiffs,
    results,
  };

  const outPath = path.join(ROOT, 'reference/_showdown_diff_result.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log('\n─── 結果サマリ ──────────────────────────────');
  console.log(`実行: ${totalExecuted}/${scenarios.length + extScenarios.length}局面 (スキップ:${skipped} エラー:${errored})`);
  console.log(`一致率: ${matchRate}  (RANGE_MATCH:${rangeMatch} / OVERLAP:${rangeOverlap} / DIFF:${rangeDiff})`);
  console.log(`許容幅: ±${TOLE}HP (整数丸め)`);
  console.log(`SD実行回数: ${SD_RUNS}回/局面`);
  console.log('\nカテゴリ別:');
  for (const [cat, st] of Object.entries(categoryStats)) {
    const rate = st.total > 0 ? ((st.match / st.total) * 100).toFixed(0) + '%' : 'N/A';
    console.log(`  ${cat}: ${st.match}/${st.total} (${rate}) diff=${st.diff}`);
  }
  if (trueDiffs.length) {
    console.log(`\n★真の差分候補: ${trueDiffs.length}件`);
    for (const d of trueDiffs.slice(0, 15)) {
      console.log(`  [${d.diff_type}/${d.category}] ${d.id.slice(0, 70)}: ${d.diff_detail}`);
    }
  } else {
    console.log('\n★真の差分候補: ゼロ件 (全局面でレンジ一致)');
  }
  console.log(`\n出力: reference/_showdown_diff_result.json`);
}

main().then(() => process.exit(0)).catch(e => {
  console.error('致命的エラー:', e);
  process.exit(1);
});
