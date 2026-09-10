/*
 * tools/_snapshot_equiv_test.js — D2-d: undoスナップショット「機械生成版」と現行(手書き)版の同値テスト
 * 実行: node tools/_snapshot_equiv_test.js
 *
 * 上位文書: 実装指示 D2(後半)§D2-d(2026-09-10) / battle_scheduler.js(D1) makeSnapshotSpec()。
 *
 * ★重要(報告に明記した設計判断): 本番の snapshotBattleState/undoBattle(real_battle_simulator.html)
 * 自体はここでは書き換えていない(snapshotBattleState_legacy への改名もしていない)。
 * 理由 = tools/_sim_hard_interaction_test.js の H56 が snapshotBattleState/undoBattle の
 * 「ソースコード本文」を正規表現で静的解析し(`  fieldName:` / `st.fieldName =` という文字列パターンの
 * 有無で欄の対応関係を検出)、makeSideState() の全82欄が「復元される」か「意図的除外」かを機械判定して
 * いる。本番のsnap/restoreを欄リストからのループ生成に置き換えると、この文字列パターンが本文から
 * 消えてH56が全欄「未分類」判定でfailする。H56のあるtools/_sim_hard_interaction_test.jsはD2-dの
 * 編集対象外(指示書「他は触らない」)=このファイルを直してH56を作り直す権限が無い。
 * よって「diff 0が取れない設計変更は行わず、理由を書いて止める」に従い、本番コードパスは現状維持のまま
 * にし、real_battle_simulator.html に snapshotBattleStateFromSpec()/restoreFromSpecSnapshot()
 * (BattleScheduler.makeSnapshotSpec() の欄リストから生成する検証専用の別関数。本番のpushHistory/
 * undoBattleには接続しない=stdout diff 0・全ゲートに無関係)を追加し、このテストで
 * 現行(legacy)版と機械生成版が「同じ内容(欄の集合と値)」であることを確かめる。
 * 欄の集合の差(旧だけ/新だけ)は下記で明示的に列挙し、fail条件に組み込む(黙って通さない)。
 * 差があった場合、battle_scheduler.js の3定数を直すのではなく、この差分を報告に書いて親の判断を仰ぐ
 * (このテスト自体は「今回判明している既知の差分」を期待値として固定し、未知の差分が増減したら
 * fail=気づけるようにする、という設計)。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildEngine, ROOT } = require('./_sim_engine.js');
const data = require(path.join(ROOT, 'pokechan_data.js'));

// ★値比較は assert.deepEqual/deepStrictEqual を直接使わず、この sameContent() を使う。理由=2つ:
// ①buildEngine()はNodeのvmで毎回「別レルム」を作る(vm.createContext)。別レルムで作られたプレーン
//   オブジェクト同士は構造・値が完全に同じでも Object の実体(コンストラクタ/プロトタイプ)が別物になり、
//   node:assert/strict の deepEqual(=deepStrictEqual)は型不一致として fail する(cross-realm既知の罠)。
//   JSON.stringify で構造化して比較すればプロトタイプに依存せず内容だけを見られる。
// ②legacy(手書き)のsnapshotBattleStateは各欄に `|| 0` / `!!x` / `|| null` 等の防御的デフォルトを
//   都度書いているが、汎用クローン(_cloneSnapshotField)は「未知の欄は素通し」なので、一度も
//   セットされていない遅延初期化フィールド(例: badpoisonCounter)は legacy=0 / spec=undefined という
//   表記だけの違いが出ることがある(意味は同じ=「その効果は掛かっていない」)。undefined/null/0/false/''
//   を同じ「空」として扱う。
function normalizeEmpty(v) {
  if (v === undefined || v === null || v === false || v === 0 || v === '') return 'EMPTY';
  return v;
}
function sameContent(a, b) {
  if (normalizeEmpty(a) === 'EMPTY' && normalizeEmpty(b) === 'EMPTY') return true;
  return JSON.stringify(a) === JSON.stringify(b);
}
function assertSameContent(a, b, msg) {
  assert.ok(sameContent(a, b), `${msg}: a=${JSON.stringify(a)} b=${JSON.stringify(b)}`);
}

const pokeByName = n => data.POKEMON_LIST.find(p => p.name === n);
const moveByName = n => Object.values(data.WAZA_MAP).find(m => m.name === n);

function freshSide(E, pokeName, moveNames) {
  const s = E.makeSideState();
  s.poke = pokeByName(pokeName);
  s.moves = (moveNames || []).map(moveByName).filter(Boolean);
  s.selectedMoveIdx = 0;
  s.currentHp = E.realStat(s, 'hp');
  return s;
}

// バトルを数ターン進めた状態を模す: 交代(presenceEpoch進行)・メガ・ランク・場(壁/設置)・
// きのみ消費・ばけのかわ・みがわり・バインドを含む「豊かな」揮発状態を直接組み立てる
// (フルにターンを回すのではなく、各フィールドへ直接値を入れる=D1のfreshSideと同じ既存流儀)。
function buildRichBattle() {
  const E = buildEngine();
  const U = E.sides.__undoTestHooks;

  E.sides.self = freshSide(E, 'ミミッキュ', ['hataku']);
  E.sides.opp = freshSide(E, 'カビゴン', ['hataku']);
  E.sides.self.bench = [freshSide(E, 'ピカチュウ', ['hataku'])];
  E.sides.opp.bench = [freshSide(E, 'フシギバナ', ['hataku'])];

  // 交代(死に出しではない通常交代)でpresenceEpochを1つ進める(D2-aで新設)
  E.attemptSwitch('self', 0, { ignoreTrapping: true });

  // メガシンカ済み相当のフラグ(megaEvolve関数を経由せず状態だけ用意=snapshot対象の値を用意する目的)
  E.sides.opp.megaUsed = true;
  E.sides.opp.megaChoice = false;
  E.sides.opp.megaBase = pokeByName('カビゴン');

  // 能力ランク
  E.sides.self.rank.atk = 2; E.sides.self.rank.spe = -1;
  E.sides.opp.rank.def = 1;

  // 場(壁/設置)
  E.sides.self.reflect = true; E.sides.self.screenTurns = { reflect: 3 };
  E.sides.opp.stealthRock = true; E.sides.opp.spikesLayers = 2; E.sides.opp.stickyWeb = true;

  // きのみ消費(道具が無くなり、食べた道具が記録される)
  E.sides.self.item = null; E.sides.self.lastConsumedItem = 'oran_berry';

  // ばけのかわ(剥がれ状態)
  E.sides.self.disguise = false; E.sides.self.disguiseBroken = true;

  // みがわり
  E.sides.opp.subHp = 12;

  // バインド(揮発スリップ)
  E.sides.opp.slips = [{ kind: 'shioduke', amount: 8 }];

  // あばれ(rampage)
  E.sides.opp.rampage = { move: E.sides.opp.moves[0], left: 2, noConfusion: false };

  // makeSnapshotSpec()にのみ在る欄(SLOT_VOLATILE)もいくつか触る(復元漏れ検証の材料)
  E.sides.self.flinched = true;
  E.sides.self.pendingStatus = { code: 'x', turns: 1, label: 'yawn' };
  E.sides.opp.metronomeCount = 2;
  E.sides.opp._metronomeLastMoveKey = 'hataku';
  E.sides.opp.paradoxBoost = true;
  E.sides.self.proteanUsed = true;
  E.sides.opp.pendingEjectPack = true;
  E.sides.opp.cudChew = { key: 'oran_berry', n: 1 };
  E.sides.self.illusionAs = pokeByName('フシギバナ');

  return { E, U };
}

// ★D2-dで判明した既知の差分(欄の集合)。battle_scheduler.jsのUNCLASSIFIED_FIELDSのうち
// 「ページUI専用(sideの状態ではない)」7欄は spec 側にしか出ない(値はundefined)。
// SLOT_VOLATILE_FIELDSのうち11欄は「遅延初期化=makeSideState()の初期値には無い」揮発欄で、
// 現行(legacy)のsnapshotBattleState/undoBattleは一度もこれらを復元していない
// (=既存の未復元ギャップ。今回の機械生成で初めて全欄カバーされる。ただし本番へは未接続)。
const EXPECTED_LEGACY_ONLY = [];
const EXPECTED_SPEC_ONLY = [
  '_metronomeLastMoveKey', 'cudChew', 'flinched', 'illusionAs', 'metronomeCount',
  'paradoxBoost', 'pendingEjectPack', 'pendingStatus', 'proteanUsed', 'selectedMoveIdx', 'subAbsorbed',
  'selectedStatKey', 'poolSort', 'poolFilter', 'moveSearch', 'critical', 'lifeOrb', 'rockyHelmet',
].sort();

test('欄の集合: legacyとFromSpecの差分は既知のものだけ(未知の差分が出たらfail)', () => {
  const { U } = buildRichBattle();
  const legacy = U.snapshotBattleState();
  const spec = U.snapshotBattleStateFromSpec();

  for (const side of ['self', 'opp']) {
    const legacyFields = new Set(Object.keys(legacy[side]));
    const specFields = new Set(Object.keys(spec[side]));
    const legacyOnly = [...legacyFields].filter(f => !specFields.has(f)).sort();
    const specOnly = [...specFields].filter(f => !legacyFields.has(f)).sort();
    assert.deepEqual(legacyOnly, EXPECTED_LEGACY_ONLY,
      `[${side}] legacyOnly(旧だけ持つ欄)が想定と違う: ${JSON.stringify(legacyOnly)}`);
    assert.deepEqual(specOnly, EXPECTED_SPEC_ONLY,
      `[${side}] specOnly(新だけ持つ欄)が想定と違う: ${JSON.stringify(specOnly)}`);
  }
});

test('値: 両方に在る欄は同じ値になる(参照ではなく内容で比較)', () => {
  const { U } = buildRichBattle();
  const legacy = U.snapshotBattleState();
  const spec = U.snapshotBattleStateFromSpec();

  for (const side of ['self', 'opp']) {
    const legacyFields = Object.keys(legacy[side]);
    for (const f of legacyFields) {
      if (EXPECTED_SPEC_ONLY.includes(f) || EXPECTED_LEGACY_ONLY.includes(f)) continue;
      assertSameContent(spec[side][f], legacy[side][f], `[${side}.${f}]`);
    }
  }
  assertSameContent(spec.log, legacy.log, 'log(battleLog)が一致しない');
  assert.equal(spec.lastMoveAny, legacy.lastMoveAny, 'lastMoveAnyが一致しない');
});

test('restore: 変更前にFromSpec版で撮ったスナップショットへ、変更後から正しく戻る', () => {
  const { E, U } = buildRichBattle();
  const beforeSpec = U.snapshotBattleStateFromSpec();
  const beforeSelfBenchHp = E.sides.self.bench[0].currentHp;

  // 状態を派手に変える
  E.sides.self.currentHp = 1;
  E.sides.self.rank.atk = -6;
  E.sides.self.reflect = false;
  E.sides.self.disguise = true; E.sides.self.disguiseBroken = false;
  E.sides.opp.subHp = 0;
  E.sides.opp.slips = [];
  E.sides.opp.rampage = null;
  E.sides.opp.stealthRock = false; E.sides.opp.spikesLayers = 0;
  E.sides.self.bench[0].currentHp = 0;
  E.sides.opp.metronomeCount = 0;
  E.sides.opp.cudChew = null;
  E.sides.self.flinched = false;
  E.battleLog.push({ phase: 'X', msg: 'これは巻き戻る前のダミー行' });

  U.restoreFromSpecSnapshot(beforeSpec);

  const fields = U.snapshotSpecFields();
  for (const f of fields) {
    assertSameContent(E.sides.self[f], beforeSpec.self[f], `[self.${f}] restore後に一致しない`);
    assertSameContent(E.sides.opp[f], beforeSpec.opp[f], `[opp.${f}] restore後に一致しない`);
  }
  assert.equal(E.sides.self.bench[0].currentHp, beforeSelfBenchHp, 'bench経由の値も戻る');
  assertSameContent(E.battleLog.map(l => l.msg), beforeSpec.log.map(l => l.msg), 'battleLogが戻る');
});

test('restore: legacy版とFromSpec版のrestoreが、重なる欄について同じ結果になる', () => {
  // 同じ初期状態を2つ独立に作り、それぞれlegacy/FromSpecで撮影→同じ変更→それぞれのrestoreで戻し、
  // 重なる欄(EXPECTED_*_ONLYに無い欄)が両者で一致することを確認する。
  const battleA = buildRichBattle();   // legacy側
  const battleB = buildRichBattle();   // FromSpec側(buildRichBattleは決定的=乱数を使わないので同一状態になる)

  // フィールド列挙用(値の比較には使わない。実際の巻き戻しはpushHistory/undoBattle経由)
  const legacyFieldsSnap = battleA.U.snapshotBattleState();
  // legacy側はsnapshotBattleStateに対応する専用restore関数が無い(undoBattleはbattleHistoryスタック
  // 経由でしか戻せない)ため、pushHistory()(内部でsnapshotBattleStateを呼ぶ)→変更→undoBattle()で
  // 「変更前に撮って、変更後から戻す」を再現する。
  battleA.U.pushHistory();
  const specSnap = battleB.U.snapshotBattleStateFromSpec();

  const mutate = (E) => {
    E.sides.self.currentHp = 1;
    E.sides.self.rank.atk = -6;
    E.sides.self.reflect = false;
    E.sides.opp.subHp = 0;
    E.sides.opp.rampage = null;
    E.sides.opp.stealthRock = false;
  };
  mutate(battleA.E);
  mutate(battleB.E);

  battleA.U.undoBattle();
  battleB.U.restoreFromSpecSnapshot(specSnap);

  for (const side of ['self', 'opp']) {
    const legacyFields = Object.keys(legacyFieldsSnap[side]);
    for (const f of legacyFields) {
      if (EXPECTED_SPEC_ONLY.includes(f) || EXPECTED_LEGACY_ONLY.includes(f)) continue;
      assertSameContent(battleB.E.sides[side][f], battleA.E.sides[side][f], `[${side}.${f}]`);
    }
  }
});
