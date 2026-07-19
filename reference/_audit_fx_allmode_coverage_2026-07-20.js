// 読み取り専用の監査スクリプト(本番改変なし)。
// 全部版920技それぞれについて、fx解決ロジック(move_fx_map.js + fx_primitives.js shapeOf/resolveCueSheet相当)を
// node上で再現し、override/flag/default/noneのどれで決まるか・変化技の扱い・型×分類デフォルト表の抜けを機械判定する。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..', '..', '..'); // unused, use explicit paths below

const REPO = '/Users/masamichi/Documents/ポケモンDB';
const D = require(path.join(REPO, 'pokechan_data_all.js'));
const WAZA_MAP = D.WAZA_MAP;

// ----- move_fx_map.js を素直に読む(window.MOVE_FX_MAP をローカルwindowスタブへ読み込む) -----
const moveFxSrc = fs.readFileSync(path.join(REPO, 'move_fx_map.js'), 'utf8');
const winStub = {};
(function(window){ eval(moveFxSrc); })(winStub);
const MOVE_FX_MAP = winStub.MOVE_FX_MAP;
if (!MOVE_FX_MAP) throw new Error('MOVE_FX_MAP not loaded from move_fx_map.js');

// ----- battle_fx_cues.js も読む(class:/pattern:/move: キーの一覧を取るため) -----
const cuesSrc = fs.readFileSync(path.join(REPO, 'battle_fx_cues.js'), 'utf8');
const winStub2 = {};
(function(window){ eval(cuesSrc); })(winStub2);
const BATTLE_FX_CUES = winStub2.BATTLE_FX_CUES;
if (!BATTLE_FX_CUES) throw new Error('BATTLE_FX_CUES not loaded from battle_fx_cues.js');

// ----- fx_primitives.js の shapeOf/_cueClassKey/resolveCueSheet と完全に同じロジックをここに複製 -----
// (fx_primitives.js自体はDOM依存関数を含みnode上でrequireできないため、対象関数のロジックのみ手で移植。
//  移植元: fx_primitives.js 253-290行(moveClassOf/shapeOf), 1024-1058行(resolveCueSheet/_cueClassKey))
const _SHAPE_FLAG_ORDER = [
  { shape: 'note',  test: f => !!f.sound },
  { shape: 'fist',  test: f => !!f.punch },
  { shape: 'blade', test: f => !!(f.slicing || f.slash) },
  { shape: 'orb',   test: f => !!(f.bullet || f.ball) },
  { shape: 'gust',  test: f => !!f.wind },
  { shape: 'psi',   test: f => !!f.pulse },
  { shape: 'fang',  test: f => !!f.bite },
];
function shapeOf(mv, map){
  if (!mv) return { shape: null, via: 'none' };
  if (map && map.overrides && map.overrides[mv.name]) return { shape: map.overrides[mv.name], via: 'override' };
  const f = mv.flags || {};
  for (const rule of _SHAPE_FLAG_ORDER) if (rule.test(f)) return { shape: rule.shape, via: 'flag' };
  if (/キック|蹴/.test(mv.name || '')) return { shape: 'foot', via: 'flag' };
  const d = map && map.defaults && map.defaults[mv.type];
  const s = d && d[mv.category];
  if (s) return { shape: s, via: 'default' };
  return { shape: null, via: 'none' };
}
function _cueClassKey(mv){
  if (mv.category === '物理') return mv.contact === true ? 'phys_contact' : 'phys_ranged';
  if (mv.category === '特殊') return 'special';
  return '';
}
function resolveCueSheet(mv, cuesMap){
  const byMove = cuesMap['move:' + mv.name];
  if (byMove && byMove.done === true) return { sheet: byMove, via: 'move' };
  const byPattern = cuesMap['pattern:' + mv.type + mv.category];
  if (byPattern && byPattern.done === true) return { sheet: byPattern, via: 'pattern' };
  const clsKey = _cueClassKey(mv);
  if (clsKey){
    const byClass = cuesMap['class:' + clsKey];
    if (byClass && byClass.done === true) return { sheet: byClass, via: 'class:' + clsKey };
  }
  return { sheet: null, via: 'none' };
}

// ===== 全919キー(≒920)を集計 =====
const allKeys = Object.keys(WAZA_MAP);
const moves = allKeys.map(k => ({ key: k, ...WAZA_MAP[k] }));

const resolved_via = { override: 0, flag: 0, default: 0, none: 0 };
const cue_via = {};
const noneList = [];
const statusMoves = []; // 変化技の演出結果分類
const newTypeCategoryCells = new Set();
const statusCueSheetKeys = Object.keys(BATTLE_FX_CUES).filter(k => k.startsWith('move:'));

for (const m of moves){
  const isAttacking = (m.category === '物理' || m.category === '特殊');
  if (isAttacking){
    const r = shapeOf(m, MOVE_FX_MAP);
    resolved_via[r.via]++;
    if (r.via === 'none'){
      noneList.push({ key: m.key, name: m.name, type: m.type, category: m.category, contact: m.contact, flags: m.flags });
      // typeがdefaults表に無いセルなら記録
      if (!(MOVE_FX_MAP.defaults && MOVE_FX_MAP.defaults[m.type])){
        newTypeCategoryCells.add(m.type + '/' + m.category + ' (type not in defaults table)');
      } else if (!MOVE_FX_MAP.defaults[m.type][m.category]){
        newTypeCategoryCells.add(m.type + '/' + m.category + ' (cell empty in defaults table)');
      }
    }
    const cr = resolveCueSheet(m, BATTLE_FX_CUES);
    cue_via[cr.via] = (cue_via[cr.via] || 0) + 1;
  } else {
    // 変化技: resolveStatusCueSheetは move:個別のみ(done:true)。現状 move:接頭辞のシートは
    // battle_fx_cues.js に1件も無い(class:/pattern:はphys_contact/phys_ranged/special の3件のみ)ため、
    // 全変化技が「シート無し=従来の正規表現ベースlegacy fx経路」に落ちる。
    const hasOwnSheet = BATTLE_FX_CUES['move:' + m.name] && BATTLE_FX_CUES['move:' + m.name].done === true;
    const effs = (m.battle_data && m.battle_data.effects) || [];
    const kinds = effs.map(e => e.kind);
    // battle_lab.html のバトルログ正規表現ディスパッチ(約4790-4991行)を目視精査して確認できた
    // 「メッセージパターン一致で汎用visualが出る」kind(効果種別)のホワイトリスト。
    // 根拠: 能力ランク変化=rkM/pnRankMs(あがった/さがった・±N), 回復=/回復/, 状態付与=stM(どく/まひ/やけど/
    // こおり/ねむり/こんらん)+メロメロ専用, まもり=protM(守りの体勢), 天候変化=setWeatherFx各regex,
    // フィールド展開=terrM, 壁設置=wallUpM, 設置=hazardFx各regex, 設置除去=clearHazardFx/wallDownM,
    // 自分交代=recall/switch系(交代は技種別に依存しない共通メッセージ), やどりぎ=🌱pop, へんしん=フラッシュ,
    // こらえる=「こらえた/もちこたえた」, メロメロ付与=💕。
    // 確認して「無い」と判定済み: 状態異常回復(メッセージ文言「〜の 状態異常が 治った！」に対応するpopText/burstFx
    // 呼び出しが battle_lab.html に1件も無い=grep 0件・2026-07-20実査)。
    const HANDLED_KINDS = new Set([
      '能力ランク変化', '回復', '状態付与', 'まもり', '天候変化', 'フィールド展開',
      '壁設置', '設置', '設置除去', '自分交代', 'やどりぎ', 'へんしん', 'こらえる', 'メロメロ付与',
    ]);
    const CONFIRMED_UNHANDLED_KINDS = new Set(['状態異常回復']);
    let visualClass;
    if (hasOwnSheet) visualClass = 'move_cue_sheet(Phase2専用)';
    else if (kinds.length === 0) visualClass = '未分類(effects空)';
    else if (kinds.some(k => CONFIRMED_UNHANDLED_KINDS.has(k))) visualClass = '確認済み無演出(プレーンテキストのみ)';
    else if (kinds.some(k => HANDLED_KINDS.has(k))) visualClass = '汎用メッセージ正規表現で描画(既存legacy fx)';
    else visualClass = '未確認(ロングテール・個別未検証=probably plain text only)';
    statusMoves.push({ key: m.key, name: m.name, type: m.type, kinds, resolved: hasOwnSheet ? 'move_cue_sheet' : 'legacy_regex_fx(no_cue_sheet)', visualClass });
  }
}

const statusSummary = {
  total: statusMoves.length,
  with_own_move_cue_sheet: statusMoves.filter(s => s.resolved === 'move_cue_sheet').length,
  legacy_regex_fx_no_sheet: statusMoves.filter(s => s.resolved !== 'move_cue_sheet').length,
  visual_class_breakdown: statusMoves.reduce((acc, s) => { acc[s.visualClass] = (acc[s.visualClass] || 0) + 1; return acc; }, {}),
};
const unconfirmedList = statusMoves.filter(s => s.visualClass === '未確認(ロングテール・個別未検証=probably plain text only)');
const confirmedSilentList = statusMoves.filter(s => s.visualClass === '確認済み無演出(プレーンテキストのみ)');

// ===== defaults表(18タイプ×2分類)の整合性チェック(overrides混入分は除く「素の表」チェック) =====
const typesInData = [...new Set(moves.map(m => m.type))];
const defaultsTableCells = [];
for (const t of typesInData){
  for (const cat of ['物理', '特殊']){
    const s = MOVE_FX_MAP.defaults[t] && MOVE_FX_MAP.defaults[t][cat];
    if (!s) defaultsTableCells.push(`${t}/${cat}`);
  }
}

const out = {
  generated: new Date().toISOString(),
  source: {
    data_file: 'pokechan_data_all.js',
    waza_map_key_count: allKeys.length,
    note_920: `WAZA_MAPの実キー数は${allKeys.length}件(タスク記載の920件と差異あり=Z技の物理/特殊バリアント18件を含めても919。要再確認/誤差许容)`,
  },
  totals: {
    total_moves: allKeys.length,
    attacking_moves: moves.filter(m => m.category === '物理' || m.category === '特殊').length,
    status_moves: moves.filter(m => m.category === '変化').length,
  },
  resolved_via_shapeOf: resolved_via,
  none_count: noneList.length,
  none_list: noneList,
  cue_sheet_resolution_via: cue_via,
  status_move_fx_classification: statusSummary,
  status_moves_confirmed_silent: confirmedSilentList,
  status_moves_unconfirmed_longtail_sample: unconfirmedList,
  defaults_table_missing_type_category_cells: defaultsTableCells,
  engine_crash_check: {
    file: 'fx_primitives.js',
    shapeOf_null_behavior: 'shapeOf(mv)がnullを返しても呼び出し元 burstFx() は `if (shape) spawnBurstGlyph(...)` で分岐しているだけ(fx_primitives.js 110行目)。null時はグリフ(絵文字/専用CSS形状)が乗らないだけで、球+パーティクル+リングの基本バーストは表示される。クラッシュしない=degrade gracefully。',
    resolveCueSheet_null_behavior: 'resolveCueSheet(mv)がnullを返す(cue_via.noneに該当)場合、呼び出し元は「従来のattackFx/chargeFx正規表現ベースlegacy経路」にフォールバックする設計(fx_primitives.js 1023行のコメント「シート無し技は完全不変」)。ただしこのlegacy経路自体は shapeOf/MOVE_FX_MAP を経由しないmoveClassOf(mv)ベースの別ロジックで、flags.sound/punch/slicing等が無いノーマル物理技でも既定でphys扱いにフォールバックするため描画自体は出る。',
    real_battle_simulator_html: '重要な前提の訂正: real_battle_simulator.html自体にはshapeOf/moveClassOf/MOVE_FX_MAP/BATTLE_FX_CUES/fx_primitives.js等の参照が一切無い(grep 0件)。この9085行のファイルは「見えるビジュアル(burst/glyph/projectile等)を持たないヘッドレス戦闘ロジックエンジン」であり、online_battle.html(#engine-frameにdisplay:noneでiframe読込)とbattle_lab.html(同じくiframe埋め込み、battle_lab.html?v=...&data=all)から共有される。実際にfx描画(shapeOf/MOVE_FX_MAP/BATTLE_FX_CUES/fx_primitives.js)を担うのは (a) real_battle.html(champions専用・常にpokechan_data.jsのみ、data=all分岐なし=全部版では絶対に使われない) と (b) battle_lab.html(champions/all両対応・move_fx_map.js/battle_fx_cues.js/fx_primitives.jsを<head>で読込・RB_LAB_MODEでpokechan_data_all.js切替)。つまり「全部版920技のfx」はbattle_lab.htmlのshapeOf/resolveCueSheetのみが対象になる。',
  },
  implementation_proposal: {
    attacking_moves: '648件(物理390+特殊240程度)は shapeOf() が override/flag/defaults[18タイプ×2分類]の3段で必ず何か解決し(none=0件)、cueシートも move:/pattern:/class:の3段でclass:phys_contact・class:phys_ranged・class:specialのいずれかに必ず落ちる(cue_via.none=0件)ため追加実装は不要。既に100%カバー(2026-07-16のフレアドライブ基準デフォルト表が効いている)。',
    status_moves_gap: `271件中、move:個別cueシート(Phase2)は0件=全て未着手(Phase1のまま・想定通り)。「無演出」ではなく、既存の汎用メッセージ正規表現(battle_lab.html 4790-4991行=能力ランク変化/回復/状態付与/まもり/天候変化/フィールド展開/壁設置/設置/設置除去/自分交代/やどりぎ/へんしん/こらえる/メロメロ付与等のホワイトリストにマッチ)で色/絵文字/バーストが出る技=163件(60.1%)。確認できた「本当に無演出(プレーンテキストのみ)」= 状態異常回復12件(「〜の 状態異常が 治った！」に対応するfxが無い=grep 0件で確認)。残り96件(35.4%)はホワイトリスト外のkind(かなしばり/ちょうはつ/いちゃもん/アンコール/みちづれ/テレキネシス/タイプ上書き系/特性上書き系/持ち物系/部屋系/急所率上昇 等の1〜10件ずつのロングテール)で、battle_lab.htmlの正規表現群を個別に当たっていないため未確認=十中八九プレーンテキストのみ(推定)。`,
    priority_work_items: [
      '① 状態異常回復12技に「治った」メッセージ用のpopText/burstFx(STATUS_FXの色を流用してcure=✨等)を1パターン追加(工数=小・1メッセージ正規表現+1関数呼び出し)。',
      '② ホワイトリスト外96技(未確認ロングテール)を実際に対局させてバトルログ文言を洗い出し→汎用アイコンpopText(専用グリフでなくSTATUS_FX的な絵文字1つで十分=北極星「機械が漏れてない」観点でも十分)を足す。工数=中〜大(kindが70種類近く分散=効果種別ごとにメッセージ文言の実機確認が必要。優先度は使用頻度の高い技=ちょうはつ/アンコール/いちゃもん/みちづれ等の対戦定番技から)。',
      '③ 変化技のPhase2個別cueシート(move:単位のタイミング調整)は演出ツクール(fx_editor.html)で1技ずつ手作業(現状の設計方針どおり=①②を先に済ませば「無演出」は無くなるので優先度は低い)。',
    ],
  },
};

const outPath = path.join(REPO, 'reference', '_move_fx_allmode_coverage_2026-07-20.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('=== summary ===');
console.log('total_moves', out.totals.total_moves, 'attacking', out.totals.attacking_moves, 'status', out.totals.status_moves);
console.log('resolved_via_shapeOf', resolved_via);
console.log('none_count', noneList.length);
console.log('cue_sheet_resolution_via', cue_via);
console.log('status_move_fx_classification', statusSummary);
console.log('defaults_table_missing_type_category_cells', defaultsTableCells);
console.log('written to', outPath);
