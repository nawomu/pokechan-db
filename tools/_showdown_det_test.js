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

// ─── メイン ──────────────────────────────────────

async function main() {
  console.log('Showdown決定論差分ハーネス 起動');
  console.log('技プール(クリーン技):', CLEAN_POOL.length, '件');

  const E = buildEngine();
  const scenarios = buildScenarios();
  console.log('生成シナリオ数:', scenarios.length);
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

  // ─── サマリ ─────────────────────────────────────

  const matchRate = done > 0 ? ((rangeMatch / done) * 100).toFixed(1) + '%' : 'N/A';

  const summary = {
    date:                   new Date().toISOString(),
    harness_version:        'deterministic_v1',
    description:            '命中100・追加効果なし・固定威力技のみでcalcDamage理論レンジとSDの実測N回を比較',
    clean_move_pool_size:   CLEAN_POOL.length,
    total_scenarios:        scenarios.length,
    executed:               done,
    skipped,
    errored,
    range_match:            rangeMatch,
    range_overlap:          rangeOverlap,
    range_diff:             rangeDiff,
    match_rate:             matchRate,
    tolerance:              TOLE,
    sd_runs_per_scenario:   SD_RUNS,
    true_diffs:             trueDiffs,
    results,
  };

  const outPath = path.join(ROOT, 'reference/_showdown_diff_result.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log('\n─── 結果サマリ ──────────────────────────────');
  console.log(`実行: ${done}/${scenarios.length}局面 (スキップ:${skipped} エラー:${errored})`);
  console.log(`一致率: ${matchRate}  (RANGE_MATCH:${rangeMatch} / OVERLAP:${rangeOverlap} / DIFF:${rangeDiff})`);
  console.log(`許容幅: ±${TOLE}HP (整数丸め)`);
  console.log(`SD実行回数: ${SD_RUNS}回/局面`);
  if (trueDiffs.length) {
    console.log(`\n★真の差分候補: ${trueDiffs.length}件`);
    for (const d of trueDiffs.slice(0, 10)) {
      console.log(`  [${d.diff_type}] ${d.id}: ${d.diff_detail}`);
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
