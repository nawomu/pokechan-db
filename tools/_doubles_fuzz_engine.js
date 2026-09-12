/*
 * tools/_doubles_fuzz_engine.js — ダブルバトル ランダム自走ファズ(エンジン直叩き・Node vm・速い方=主役)
 *
 * 実行:
 *   node tools/_doubles_fuzz_engine.js --n=300 --seed=1
 *   node tools/_doubles_fuzz_engine.js --n=1000 --seed=1 --maxTurns=100
 *   node tools/_doubles_fuzz_engine.js --n=1 --seed=37 --trace      (1戦ぶんのログを全部出す)
 *
 * 何をするか:
 *   Champions の pickable なポケモン(pokechan_data.js の POKEMON_LIST・メガ形態/バトル限定フォルムは除く)から
 *   ★同じ図鑑No.を避けて★4体×2側をランダムに組み、技/持ち物/特性/性格/努力値/性別もランダムに振って、
 *   real_battle_simulator.html の実エンジン(tools/_sim_engine.js の buildEngine=sim無改変)を
 *   E.setFormat({slotsPerSide:2}) のダブルで最後まで回す。毎ターン不変条件を機械で検査する。
 *   乱数は seed 付き mulberry32 = 同じ seed なら同じ試合(再現可能)。
 *
 * 設計の根拠(adversarial-scenario-testing): 乱打ではなく「設計してから裏を突く」。
 *   ・選択はページと同じ公開API(getChoiceCandidates → setChoice / autoChoose)だけを使う
 *     = ページが出せない手を作らない(偽のバグを作らない)。
 *   ・死に出しは★ページと同じ経路★(__rbDeferFaintReplaceSlots=true でエンジンに保留させ、
 *     ハーネスが attemptSwitch(..., {faintReplace:true, slotIdx, deferEntry:true}) + flushDeferredEntries())
 *     = online_battle.html:6696 の onlineTryApplyReplacesSlots と同じ流儀。
 *   ・1戦ごとにエンジンを作り直す(4ms)= 前の試合の残骸で結果が変わらない(再現性の担保)。
 *
 * ★このハーネスは読むだけ(既存ファイルを1行も直さない)。見つけた破れは直さず報告する。
 *
 * 不変条件(毎ターン検査・詳細は報告/--help):
 *   I1 exception      runTurn/attemptSwitch/flush が例外を投げない
 *   I2 slots0         sides[s].slots[0] === sides[s](slotOf の契約)
 *   I3 hp_range       在場枠の currentHp が 0〜最大HP・null でない
 *   I4 fainted_acted  ターン開始時にひんしだった枠が技の主語として出ない
 *   I4'dead_spoke     ひんし枠がログの主語として出ない(行動以外=ターン終了の状態解除なども含む)
 *   I5 ghost_target   ダメージ行の受け手が「そのターン場に居た個体」でない(=居ない相手に当たった)
 *   I5'dead_target    ダメージ行の受け手がターン開始時にひんしだった枠(=ひんし枠に当たった)
 *   I6 pending_entry  pendingEntries がターンを跨いで残らない
 *   I7 negative_turns 側の欄(壁 screenTurns / おいかぜ tailwindTurns)・envの残りターンが負にならない
 *   I8 turn_limit     maxTurns(既定100)以内に決着する(※双方が回復/変化技だけの持久戦は別集計)
 *   I9 log_garbage    ログに undefined / null / NaN / [object が出ない
 *   I11 stance_wrong  「○フォルム チェンジ！(名前)」の直後に技を出す主語が、その名前と同じ
 *                     (バトルスイッチ=その技を出す個体に起きるはず)
 */
'use strict';
const path = require('path');
const { buildEngine, mulberry32, ROOT } = require('./_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

// items_database.js は window 前提(ブラウザ用)なので、読むためだけに window を用意する。
// ★エンジン側は vm の中で自分用に読み込む(二重に別実体を持たせない=こちらは「編成の抽選」専用)。
function loadItems() {
  const g = global;
  const hadWindow = Object.prototype.hasOwnProperty.call(g, 'window');
  const prev = g.window;
  if (!hadWindow) g.window = {};
  delete require.cache[require.resolve(path.join(ROOT, 'items_database.js'))];
  require(path.join(ROOT, 'items_database.js'));
  const db = g.window.ITEMS_DATABASE;
  if (!hadWindow) delete g.window; else g.window = prev;
  return db;
}
const ITEMS = loadItems();

// ===== 編成プール =====
// online_battle.html:1793-1794 と同じ定義(ページに2本目のルールを作らない=同じ条件で抽選する)
const BATTLE_ONLY_FORMS = new Set(['イルカマン(マイティフォルム)', 'ギルガルド(ブレードフォルム)']);
const isPickable = p => !p.mega && !BATTLE_ONLY_FORMS.has(p.name);
const dexKeyOf = p => p.no || p.name;

const MOVES_BY_POKE = new Map();
function usableMoves(poke) {
  // real_battle_simulator.html:11136 usableMoves と同じ(learners に名前が入っている技)
  if (!MOVES_BY_POKE.has(poke.name)) {
    MOVES_BY_POKE.set(poke.name, Object.values(data.WAZA_MAP)
      .filter(m => Array.isArray(m.learners) && m.learners.includes(poke.name)));
  }
  return MOVES_BY_POKE.get(poke.name);
}
const POOL = data.POKEMON_LIST.filter(p => isPickable(p) && usableMoves(p).length > 0);

// 持ち物: implemented_in_pokechan だけ(未実装はページが外す=online_battle clearUnimplementedItemRB)
const IMPL_ITEMS = ITEMS.items.filter(i => i.implemented_in_pokechan);
const PLAIN_ITEMS = IMPL_ITEMS.filter(i => i.category !== 'mega_stone');
// メガストーンは種族一致だけ(applies_to_pokemon)。Champions=種族専用の実ストーン(2026-09-03 阿部さん)
const MEGA_BY_POKE = new Map();
IMPL_ITEMS.filter(i => i.category === 'mega_stone').forEach(i => {
  (i.applies_to_pokemon || [i.applies_to]).filter(Boolean).forEach(nm => {
    if (!MEGA_BY_POKE.has(nm)) MEGA_BY_POKE.set(nm, []);
    MEGA_BY_POKE.get(nm).push(i.key);
  });
});

// ===== 乱数ヘルパ =====
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function sample(rng, arr, n) {
  const a = arr.slice();
  const out = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(rng() * a.length), 1)[0]);
  return out;
}

// ===== 個体の抽選 =====
const EFFORT_KEYS = ['hp', 'atk', 'def', 'spatk', 'spdef', 'spd'];
const NATURE_COUNT = Object.keys(data.NATURES || {}).length || 25;
function randEffort(rng) {
  // online_battle.html clampEffortRB と同じ Champions 点(各32・計66)
  const out = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0 };
  let left = 66;
  sample(rng, EFFORT_KEYS, EFFORT_KEYS.length).forEach(k => {
    const v = Math.min(left, Math.floor(rng() * 33));
    out[k] = v; left -= v;
  });
  return out;
}
function randGender(rng, p) {
  if (p.genderless === true) return '—';
  if (p.gender_female_pct === 100) return '♀';
  if (p.gender_female_pct === 0) return '♂';
  if (p.gender_female_pct > 0 && p.gender_female_pct < 100) return rng() * 100 < p.gender_female_pct ? '♀' : '♂';
  if (p.name.includes('(オスのすがた)')) return '♂';
  if (p.name.includes('(メスのすがた)')) return '♀';
  return rng() < 0.5 ? '♂' : '♀';
}
function randMon(rng, p) {
  const all = usableMoves(p);
  const moves = sample(rng, all, Math.min(4, all.length));
  const abilities = [p.ab1, p.ab2, p.ab3].filter(Boolean);
  const megas = MEGA_BY_POKE.get(p.name) || [];
  let item = '';
  const r = rng();
  if (megas.length && r < 0.25) item = pick(rng, megas);
  else if (r < 0.85) item = pick(rng, PLAIN_ITEMS).key;
  return {
    poke: p,
    moves,
    item,
    ability: abilities.length ? pick(rng, abilities) : '',
    // 性格は index 指定(エンジンの NATURE_LIST は25件。pokechan_data.js の NATURES も同じ25件=そこから数える)
    natureIdx: Math.floor(rng() * NATURE_COUNT),
    effort: randEffort(rng),
    gender: randGender(rng, p),
  };
}
function randTeam(rng) {
  const out = [];
  const used = new Set();
  let guard = 0;
  while (out.length < 4 && guard++ < 400) {
    const p = pick(rng, POOL);
    if (used.has(dexKeyOf(p))) continue;   // 同じ図鑑No.は1チーム1体(online_battle dedupeTeams)
    used.add(dexKeyOf(p));
    out.push(randMon(rng, p));
  }
  return out;
}

// ===== エンジンへ載せる(online_battle.html buildSide / applySlotFromId / buildSlotExtra と同じ順序) =====
function applyMonToSlot(E, st, mon) {
  st.poke = mon.poke;
  st.moves = mon.moves.slice();
  st.selectedMoveIdx = 0;
  st.item = mon.item;
  st.gender = mon.gender;
  st.natureIdx = mon.natureIdx;
  st.effort = Object.assign({}, mon.effort);
  st.ability = mon.ability;
  st.pp = st.moves.map(m => (m && m.pp) ? m.pp : 0);
  st.currentHp = E.realStat(st, 'hp');
  st.fainted = false;
  st.status = 'none';
  st.targetChoice = null; st.switchChoice = null; st.megaChoice = false;
  st.turnsOut = 0;
}
function benchEntryOf(mon) {
  return {
    poke: mon.poke, effort: Object.assign({}, mon.effort), natureIdx: mon.natureIdx,
    ability: mon.ability, item: mon.item, moves: mon.moves.slice(), gender: mon.gender,
    currentHp: null, fainted: false, status: 'none', sleepTurns: null,
    lastConsumedItem: null, megaBase: null, pp: mon.moves.map(m => (m && m.pp) ? m.pp : 0),
  };
}
// vm(別レルム)の window を触る唯一の口。_sim_engine.buildEngine は window を公開しないので、
// vm 由来オブジェクトのプロトタイプ経由で vm 側の Function を取り出して実行する(エンジンは無改変)。
function vmEval(E, src) {
  const vmFunction = Object.getPrototypeOf(E.sides).constructor.constructor;
  return vmFunction(src)();
}
function setupBattle(E, teams) {
  // ページと同じ順: buildSide(側の差し替え) → setFormat(枠を生やす) → 枠1へ載せる
  ['self', 'opp'].forEach(sideKey => {
    const team = teams[sideKey];
    const sd = E.makeSideState();
    applyMonToSlot(E, sd, team[0]);
    sd.bench = team.slice(2).map(benchEntryOf);
    E.sides[sideKey] = sd;
  });
  E.setFormat({ slotsPerSide: 2, pickCount: 4, name: 'double' });
  ['self', 'opp'].forEach(sideKey => {
    const st = E.slotOf(sideKey, 1);
    applyMonToSlot(E, st, teams[sideKey][1]);
  });
  // 死に出しをページ経路(保留→ハーネスが枠を選ぶ)にする。online_battle.html:3212 と同じフック。
  vmEval(E, 'globalThis.window.__rbDeferFaintReplace = true;'
    + 'globalThis.window.__rbDeferFaintReplaceOpp = true;'
    + 'globalThis.window.__rbDeferFaintReplaceSlots = true;');
  E.battleLog.length = 0;
  E.phaseInitA();   // online_battle.html:3238 と同じ(開始時の登場特性)
}

// ===== ログの読み出し(vm配列 → この場のレルムへ詰め直す) =====
function logSlice(E, from) {
  const out = [];
  for (let i = from; i < E.battleLog.length; i++) out.push(String(E.battleLog[i].msg));
  return out;
}
// ログの読み方。★技名は WAZA_MAP の実名で照合する(「…の かなしばりが とけた！」のような
// 状態解除メッセージを「技を使った行」と読み違えないため。regexだけで切ると誤検知する=実測)。
const MOVE_NAMES = new Set(Object.values(data.WAZA_MAP).map(m => m && m.name).filter(Boolean));
// 表示名(pname)= 「相手の 」+ 種族名。種族名に空白は入らない(フォルム名も「ポットデス(がんさくフォルム)」等)。
const RE_ACTOR_MOVE = /^((?:相手の )?\S+) の ([^！]+)！/;        // ダメージ技/失敗行
const RE_ACTOR_USE = /^((?:相手の )?\S+) は (.+?) を使った！/;    // 変化技
const RE_ACTOR_ANY = /^((?:相手の )?\S+) (?:の|は) /;             // 主語だけ
// 「…に N ダメージ！」の受け手。★行の先頭から組み立てると「ミラーコート！ 受けたダメージを倍返し！ …」の
// ような途中に！が入る行で受け手を取り違える(実測)ので、ダメージ節だけを直接拾う。
const RE_DMG_TARGET = /((?:相手の )?\S+) に (\d+) ダメージ！/g;
const RE_ENTER = /(相手の )?(\S+) が 場に出た！/g;
// ターン中に表示名が変わる(=presentNames に足さないと「場に居ない」と誤検知する)経路。
// メガシンカ / かわりもの・へんしん / バトルスイッチ(ギルガルド)のフォルムチェンジ。
const RE_RENAME = [
  /((?:相手の )?\S+) に メガシンカした！/g,
  /((?:相手の )?\S+) に へんしんした！/g,
  /フォルム チェンジ！ \(((?:相手の )?\S+)\)/g,
];
const RE_ILLUSION = /イリュージョンが とけた！\(([^)]+) に化けていた\)/g;
function actorOfMoveLine(L) {
  let m = RE_ACTOR_MOVE.exec(L);
  if (m && MOVE_NAMES.has(m[2])) return m[1];
  m = RE_ACTOR_USE.exec(L);
  if (m && MOVE_NAMES.has(m[2])) return m[1];
  return null;
}

function fieldSlots(E) {
  const out = [];
  ['self', 'opp'].forEach(side => {
    for (let i = 0; i < 2; i++) out.push({ side, idx: i, st: E.slotOf(side, i) });
  });
  return out;
}
// ログ上の表示名(pname 相当)。イリュージョン/へんしんの見た目も拾う。
function displayNames(sl) {
  const st = sl.st;
  if (!st || !st.poke) return [];
  const pre = sl.side === 'opp' ? '相手の ' : '';
  const names = new Set();
  [st.poke, st.illusionAs, st.transformBase && st.transformBase.poke].forEach(p => {
    if (p && p.name) names.add(pre + p.name);
  });
  return [...names];
}

// ===== 1戦 =====
function runBattle(seed, opts) {
  opts = opts || {};
  const maxTurns = opts.maxTurns || 100;
  const rng = mulberry32(seed);
  const E = buildEngine();
  E.setRandom(mulberry32((seed * 2654435761) >>> 0));   // エンジン内の乱数は別系列(編成の抽選とずらす)

  const teams = { self: randTeam(rng), opp: randTeam(rng) };
  const violations = [];
  const note = (kind, turn, detail, lines) => violations.push({ kind, turn, detail, lines: lines || [] });

  let turn = 0, winner = null, over = false;
  try {
    setupBattle(E, teams);
  } catch (e) {
    note('exception', 0, 'setupBattle: ' + String(e && e.stack || e));
    return { seed, teams, turns: 0, violations, over: false, winner: null, log: logSlice(E, 0) };
  }

  const allLogFrom = 0;
  for (turn = 1; turn <= maxTurns; turn++) {
    const logFrom = E.battleLog.length;
    // --- ターン開始時のスナップショット(不変条件の基準) ---
    const before = fieldSlots(E).map(sl => ({
      side: sl.side, idx: sl.idx,
      poke: sl.st.poke ? sl.st.poke.name : null,
      fainted: !!sl.st.fainted,
      names: displayNames(sl),
    }));

    // --- 選択 ---
    try {
      ['self', 'opp'].forEach(side => {
        if (rng() < 0.2) { E.autoChoose(side); return; }   // 既存AI/最小フォールバックも混ぜる
        for (let idx = 0; idx < 2; idx++) {
          const st = E.slotOf(side, idx);
          if (!st || !st.poke || st.fainted) continue;
          const cand = E.getChoiceCandidates(side, idx);
          st.switchChoice = null;
          if (cand.switches.length && rng() < 0.12) {
            E.setChoice(side, idx, { switchIdx: pick(rng, cand.switches) });
            continue;
          }
          if (cand.canMega && rng() < 0.35) E.setChoice(side, idx, { mega: true });
          if (!cand.moves.length) { E.setChoice(side, idx, { moveIdx: 0, target: null }); continue; }
          // PPが残っている技を優先(ページのメニューと同じ実用範囲。無ければそのまま)
          const live = cand.moves.filter(m => !st.pp || st.pp[m.idx] == null || st.pp[m.idx] > 0);
          const mv = pick(rng, live.length ? live : cand.moves);
          let target = null;
          if (mv.targets && mv.targets.length && rng() < 0.75) {
            const t = pick(rng, mv.targets);
            target = { side: t.side, idx: t.idx };
          }
          E.setChoice(side, idx, { moveIdx: mv.idx, target });
        }
      });
    } catch (e) {
      note('exception', turn, 'choice: ' + String(e && e.stack || e), logSlice(E, logFrom));
      break;
    }

    // --- ターン実行 ---
    try {
      E.runTurn();
    } catch (e) {
      note('exception', turn, 'runTurn: ' + String(e && e.stack || e), logSlice(E, logFrom));
      break;
    }

    // --- 死に出し(ページ経路: 候補からランダムに選んで枠へ入れ、出揃ってから flush) ---
    try {
      for (let pass = 0; pass < 10; pass++) {
        const holes = fieldSlots(E).filter(sl => sl.st.poke && sl.st.fainted);
        let filled = 0;
        for (const sl of holes) {
          const bench = sl.st.bench || [];
          const liveIdx = [];
          bench.forEach((e, i) => {
            if (e && e.poke && !e.fainted && !(e.currentHp != null && e.currentHp <= 0)) liveIdx.push(i);
          });
          if (!liveIdx.length) continue;
          const ok = E.attemptSwitch(sl.side, pick(rng, liveIdx),
            { ignoreTrapping: true, faintReplace: true, slotIdx: sl.idx, deferEntry: true });
          if (ok) filled++;
        }
        E.flushDeferredEntries();
        if (!filled) break;
      }
    } catch (e) {
      note('exception', turn, 'faintReplace: ' + String(e && e.stack || e), logSlice(E, logFrom));
      break;
    }

    // --- 不変条件 ---
    const lines = logSlice(E, logFrom);
    const after = fieldSlots(E);

    // I2 slots[0] === sides[s]
    ['self', 'opp'].forEach(side => {
      if (E.sides[side].slots[0] !== E.sides[side]) note('slots0', turn, `sides.${side}.slots[0] !== sides.${side}`, lines);
    });

    // I3 在場枠の currentHp が 0〜max・null なし
    after.forEach(sl => {
      const st = sl.st;
      if (!st.poke) return;
      const max = E.realStat(st, 'hp');
      if (st.currentHp == null) note('hp_range', turn, `${sl.side}:${sl.idx} ${st.poke.name} currentHp=null`, lines);
      else if (!(st.currentHp >= 0 && st.currentHp <= max)) {
        note('hp_range', turn, `${sl.side}:${sl.idx} ${st.poke.name} currentHp=${st.currentHp} (max=${max})`, lines);
      }
    });

    // I4 ターン開始時にひんしだった枠は技の主語として出ない
    //    (誤検知防止: その名前を生存個体が共有していない時だけ見る)
    const aliveNames = new Set();
    before.filter(b => !b.fainted && b.poke).forEach(b => b.names.forEach(n => aliveNames.add(n)));
    const deadNames = new Set();
    before.filter(b => b.fainted && b.poke).forEach(b => b.names.forEach(n => { if (!aliveNames.has(n)) deadNames.add(n); }));
    if (deadNames.size) {
      lines.forEach(L => {
        const a = actorOfMoveLine(L);
        if (a && deadNames.has(a)) note('fainted_acted', turn, `ひんし枠が行動: ${L}`, lines);
      });
    }

    // I5 ダメージ行の受け手は「そのターン場に居た個体」でなければならない(空席に当たっていないか)
    //    ターン中に入場した個体(交代/とんぼがえり/ふきとばし)もログから拾って「居た」に数える。
    const presentNames = new Set();
    before.filter(b => b.poke).forEach(b => b.names.forEach(n => presentNames.add(n)));
    after.forEach(sl => displayNames(sl).forEach(n => presentNames.add(n)));
    lines.forEach(L => {
      RE_ENTER.lastIndex = 0;
      let m;
      while ((m = RE_ENTER.exec(L))) presentNames.add((m[1] || '') + m[2]);
      RE_RENAME.forEach(re => { re.lastIndex = 0; let k; while ((k = re.exec(L))) presentNames.add(k[1]); });
      // イリュージョン: 入場ログは「本当の名前」で出るが、被弾は「化けていた名前」で出る
      // (applyIllusion は入場ログの後=解除ログで初めて化け名が分かる)。両方を「居た名前」に数える。
      RE_ILLUSION.lastIndex = 0;
      let il;
      while ((il = RE_ILLUSION.exec(L))) { presentNames.add(il[1]); presentNames.add('相手の ' + il[1]); }
    });
    lines.forEach(L => {
      RE_DMG_TARGET.lastIndex = 0;
      let m;
      while ((m = RE_DMG_TARGET.exec(L))) {
        if (!presentNames.has(m[1])) note('ghost_target', turn, `場に居ない相手にダメージ: ${L}`, lines);
        else if (deadNames.has(m[1])) note('dead_target', turn, `ひんし枠にダメージ: ${L}`, lines);
      }
    });

    // I4' ひんし枠はログの主語として出ない(行動だけでなく、ターン終了の状態解除なども出ないのが正)
    if (deadNames.size) {
      lines.forEach(L => {
        const m = RE_ACTOR_ANY.exec(L);
        if (m && deadNames.has(m[1])) note('dead_spoke', turn, `ひんし枠が喋った: ${L}`, lines);
      });
    }

    // I6 pendingEntries がターンを跨いで残らない
    ['self', 'opp'].forEach(side => {
      const pe = E.sides[side].pendingEntries;
      if (Array.isArray(pe) && pe.length) note('pending_entry', turn, `${side}.pendingEntries=${pe.length}件 残留`, lines);
    });

    // I7 側の欄の残りターンが負にならない
    ['self', 'opp'].forEach(side => {
      const sd = E.sides[side];
      if ((sd.tailwindTurns || 0) < 0) note('negative_turns', turn, `${side}.tailwindTurns=${sd.tailwindTurns}`, lines);
      const sc = sd.screenTurns || {};
      Object.keys(sc).forEach(k => { if (sc[k] < 0) note('negative_turns', turn, `${side}.screenTurns.${k}=${sc[k]}`, lines); });
      ['weatherTurns', 'fieldTurns', 'trickRoomTurns'].forEach(k => {
        if (E.env[k] != null && E.env[k] < 0) note('negative_turns', turn, `env.${k}=${E.env[k]}`, lines);
      });
    });

    // I11 フォルムチェンジ(バトルスイッチ)は「その技を出す個体」に起きる
    //     = 「○フォルム チェンジ！ (名前)」の直後に出る技の主語は、その名前と同じでなければならない。
    //     (ダブルで味方の攻撃に反応して相方が変身していたら、ここで主語が食い違う)
    for (let li = 0; li < lines.length; li++) {
      const fm = /^(ブレード|シールド)フォルム チェンジ！ \((.+)\)$/.exec(lines[li]);
      if (!fm) continue;
      let nextActor = null;
      for (let lj = li + 1; lj < lines.length && nextActor === null; lj++) nextActor = actorOfMoveLine(lines[lj]);
      if (nextActor && nextActor !== fm[2]) {
        note('stance_wrong', turn, `フォルムチェンジの直後に技を出したのが別個体: 「${lines[li]}」→ 主語=${nextActor}`, lines);
      }
    }

    // I9 ログの機械漏れ
    lines.forEach(L => {
      if (/undefined|\bnull\b|NaN|\[object /.test(L)) note('log_garbage', turn, `ログに機械が漏れた: ${L}`, lines);
    });

    // --- 勝敗 ---
    const res = E.checkBattleWinner();
    if (res && res.over) { over = true; winner = res.winner; break; }
  }
  if (!over) {
    const tail = logSlice(E, Math.max(0, E.battleLog.length - 12));
    note('turn_limit', Math.min(turn, maxTurns), `${maxTurns}ターンで決着しない`, tail);
  }
  return { seed, teams, turns: Math.min(turn, maxTurns), violations, over, winner, log: logSlice(E, allLogFrom) };
}

// ===== CLI =====
function parseArgs(argv) {
  const o = { n: 300, seed: 1, maxTurns: 100, trace: false, quiet: false };
  argv.slice(2).forEach(a => {
    let m;
    if ((m = /^--n=(\d+)$/.exec(a))) o.n = +m[1];
    else if ((m = /^--seed=(\d+)$/.exec(a))) o.seed = +m[1];
    else if ((m = /^--maxTurns=(\d+)$/.exec(a))) o.maxTurns = +m[1];
    else if (a === '--trace') o.trace = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--help' || a === '-h') o.help = true;
  });
  return o;
}
function teamStr(team) {
  return team.map(m => `${m.poke.name}[${m.ability || '-'}/${m.item || 'なし'}] ${m.moves.map(x => x.name).join(',')}`).join(' | ');
}

function main() {
  const o = parseArgs(process.argv);
  if (o.help) { console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0]); return; }
  console.log(`[doubles-fuzz/engine] n=${o.n} seed=${o.seed} maxTurns=${o.maxTurns} pool=${POOL.length}体 items=${IMPL_ITEMS.length}`);
  const byKind = {};
  const bad = [];
  let finished = 0, totalTurns = 0;
  const t0 = Date.now();
  for (let i = 0; i < o.n; i++) {
    const seed = o.seed + i;
    let r;
    try {
      r = runBattle(seed, { maxTurns: o.maxTurns });
    } catch (e) {
      r = { seed, teams: null, turns: -1, violations: [{ kind: 'exception', turn: -1, detail: 'harness: ' + String(e && e.stack || e), lines: [] }], over: false };
    }
    totalTurns += Math.max(0, r.turns);
    if (r.over) finished++;
    if (o.trace) r.log.forEach(L => console.log('   ' + L));
    if (r.violations.length) {
      bad.push(r);
      r.violations.forEach(v => { byKind[v.kind] = (byKind[v.kind] || 0) + 1; });
    }
    if (!o.quiet && (i + 1) % 50 === 0) {
      process.stdout.write(`  …${i + 1}/${o.n} 戦 (破れ ${bad.length}戦 / ${Date.now() - t0}ms)\n`);
    }
  }
  console.log(`\n=== 結果 ===`);
  console.log(`実行: ${o.n}戦 / 決着 ${finished}戦 / 平均 ${(totalTurns / o.n).toFixed(1)}ターン / ${Date.now() - t0}ms`);
  const kinds = Object.keys(byKind);
  if (!kinds.length) { console.log('破れ 0件 ✅'); return; }
  console.log('破れの内訳: ' + kinds.map(k => `${k}=${byKind[k]}`).join(' / '));
  // 種類ごとに最小 seed の1件だけ詳しく出す(再現用)
  const shown = new Set();
  bad.forEach(r => {
    r.violations.forEach(v => {
      if (shown.has(v.kind)) return;
      shown.add(v.kind);
      console.log(`\n--- [${v.kind}] seed=${r.seed} turn=${v.turn} ---`);
      console.log(`detail: ${v.detail}`);
      if (r.teams) {
        console.log(`self: ${teamStr(r.teams.self)}`);
        console.log(`opp : ${teamStr(r.teams.opp)}`);
      }
      (v.lines || []).slice(-10).forEach(L => console.log('   | ' + L));
      console.log(`再現: node tools/_doubles_fuzz_engine.js --n=1 --seed=${r.seed} --trace`);
    });
  });
  // 全件の一覧(seed/kind)も出す(後から全数で追える)
  console.log('\n--- 破れの全一覧(seed : kind@turn) ---');
  bad.forEach(r => console.log(`seed=${r.seed} : ` + r.violations.map(v => `${v.kind}@t${v.turn}`).join(', ')));
  process.exitCode = 1;
}
if (require.main === module) main();
module.exports = { runBattle, randTeam, POOL };
