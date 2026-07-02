#!/usr/bin/env node
/**
 * _compose_consistency_audit.js
 * composeの出力(技説明文)の「内部統一性」を全数チェック
 *
 * 目的: 同じ構造のeffectsから違う言い回しが出ている箇所を全数検出
 * 実例: 能力ランク変化(target:self, special_attack, -2, prob:100)で
 *   オーバーヒート = 「攻撃したあと、100%の確率で自分のとくこう-2。」
 *   ゴールドラッシュ = 「攻撃したあと、自身のとくこう-2。」
 * という揺れを検出する。
 *
 * 方法:
 * 1. pokechan_data_all.js をロードして全技の battle_data.effects + description を使う
 * 2. composeエンジン(_waza_compose.js)を再実行して、各effectが生成する「文節」を取得
 *    - composeエンジンのclause()を移植して、各effectの生成文を直接比較
 * 3. 同一シグネチャのeffectグループで、clause()が生成する文が割れているものを検出
 * 4. 特に注目パターン(攻撃したあと・100%の確率・自分vs自身・数値表記)を集計
 * 5. 出力: reference/_compose_consistency_report.json + コンソールサマリ
 *
 * 実行: node tools/_compose_consistency_audit.js
 * 修正禁止: 既存ファイルは一切変更しない(新規=このスクリプトとレポートJSONのみ)
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'pokechan_data_all.js');
const OUT_PATH  = path.join(ROOT, 'reference', '_compose_consistency_report.json');

// ─── データロード ──────────────────────────────────────────────────
function loadWazaMap(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const exp = {};
  try {
    const mod = new Function('exports', src + ';\nif(typeof WAZA_MAP!=="undefined") exports.WAZA_MAP=WAZA_MAP;');
    mod(exp);
  } catch (err) {
    console.error(`[load error] ${filePath}: ${err.message}`);
    return null;
  }
  return exp.WAZA_MAP || null;
}

// ─── compose エンジンのclause()を移植 ────────────────────────────
// _waza_compose.js の clause() と同じロジックを使って、各effectが生成する文節を得る。
// 完全移植ではなく、「文節の言い回し」の比較に必要な部分だけ再現する。
// これによりdescription全文ではなく「そのeffectが生成した文節」を直接比較できる。

// condStrNew の軽量版(条件文は比較から除外するために「COND」として正規化)
const condStrNew = () => ''; // 比較ではconditionは無視(シグネチャで分離済み)

// ヘルパー関数(compose.js から転写)
const fracT = f => {
  if (f == null || isNaN(f)) return '';
  if (Math.abs(f - 1) < 0.001) return '全部';
  if (Math.abs(f - 0.5) < 0.001) return '半分';
  const r = Math.round(1 / f);
  if (Math.abs(1 / f - r) < 0.04) return `1/${r}`;
  for (let d = 2; d <= 16; d++) { const n = Math.round(f * d); if (n > 0 && n < d && Math.abs(f - n / d) < 0.005) return `${n}/${d}`; }
  return (+(f * 100).toFixed(1)) + '%';
};
const TGT = { self: '自分', opponent: '相手', team: '自分と味方', all: '場の全員', ally: '味方', all_opponents: '相手全体', all_but_self: '自分以外', party: '手持ち全員', incoming: '次に出る味方' };
const TGT2 = { self: '自分の', opponent: '相手の', all_opponents: '相手全員の', ally: '味方の', team: '自分と味方全員の', all: '場の全員の', all_but_self: '自分いがいの全員の', party: '手持ちの', incoming: '次に出る味方の' };
const STAT = { attack: 'こうげき', defense: 'ぼうぎょ', special_attack: 'とくこう', special_defense: 'とくぼう', speed: 'すばやさ', accuracy: '命中率', evasion: '回避率', all: 'すべての能力' };
const statList = e => (Array.isArray(e.stats) ? e.stats : [e.stat]).map(s => STAT[s] || s);
const joinStats = a => a.length <= 1 ? (a[0] || '') : a.length === 2 ? a.join('と') : a.join('・');
const durT = d => Array.isArray(d) ? `${d[0]}〜${d[1]}ターン` : (typeof d === 'number' ? `${d}ターン` : ({ until_user_leaves: '自分が場を離れるまで', until_removed: '消えるまで' }[d] || d));
const SYSTEMS_IN_GAME = { mega: true, dynamax: false, tera: false, zmove: false };
const SYSTEM_OF = { 'ダイマックス': 'dynamax', 'キョダイマックス': 'dynamax', 'ダイウォール': 'dynamax', 'ダイマックス技': 'dynamax', 'テラスタル': 'tera', 'テラスタル技': 'tera', 'Zワザ': 'zmove', 'Z技': 'zmove' };
const systemInGame = label => { const s = SYSTEM_OF[label]; return s ? !!SYSTEMS_IN_GAME[s] : true; };
const gateList = arr => (arr || []).filter(systemInGame);
const gatedItems = arr => (arr || []).filter(x => !systemInGame(x));

/**
 * effectに対応する「文節」を生成する(compose.jsのclause()移植版)
 * 全てのkindに対応する必要はなく、揺れ検出のために十分な実装をする
 */
function clauseFromEffect(e, m) {
  const k = e.kind, t = TGT[e.target] || e.target;
  switch (k) {
    case '能力ランク変化': {
      if (e.reset) return `場にいる全員の能力ランクの変化を、すべて元にもどす`;
      if (!e.stat && !e.stats) return null;
      const sts = statList(e);
      if (e.trigger === 'on_damage_taken') return `[いかり型]`;
      const pre = (e.prob && e.prob < 100) ? `${e.prob}%の確率で` : '';
      const who = e.restrict_type ? `場の${e.restrict_type}タイプ全員の` : (TGT2[e.target] || (t + 'の'));
      if (e.to_max) return `${pre}${who}${joinStats(sts)}が最大まであがる`;
      const sg = e.stages > 0 ? `+${e.stages}` : `${e.stages}`;
      if (e.stat_choice === 'random_one_of') return `${pre}${who}「${sts.join('」「')}」のうちランダムで1つが${sg}`;
      const MAIN5 = ['attack', 'defense', 'special_attack', 'special_defense', 'speed'];
      const rawStats = Array.isArray(e.stats) ? e.stats : (e.stat ? [e.stat] : []);
      const isAll5 = rawStats.length === 5 && MAIN5.every(s => rawStats.includes(s));
      let main = isAll5
        ? `${pre}${who}すべての能力(${sts.join('・')})が一気に${sg}`
        : `${pre}${e.per_turn ? '毎ターン、' : ''}${who}${sts.map(s => `${s}${sg}`).join('、')}`;
      // 攻撃技で自分の能力ダウン = 「攻撃したあと、」を前置
      // powerはm.powerに格納(battle_data.powerではない)
      const power = m.power || (m.battle_data && m.battle_data.power) || 0;
      if (e.target === 'self' && power > 0 && !e.on_charge_turn && ((e.stages || 0) < 0 || e.timing === 'after_damage')) main = `攻撃したあと、${main}`;
      return main;
    }
    case '状態付与': {
      if (!e.value) return null;
      // prob:100 の扱いが重要(攻撃技では「必ず」を明示)
      // powerはm.powerに格納(battle_data.powerではない)
      const power = m.power || (m.battle_data && m.battle_data.power) || 0;
      const pp = (e.prob != null && e.prob < 100) ? `${e.prob}%の確率で`
        : (e.prob === 100 && power > 0 ? '必ず' : '');
      if (e.value === 'ひるみ') return `${pp}相手をひるませる`;
      let dd = '';
      if (e.duration) { const dt = durT(e.duration); dd = /あいだ$|間$/.test(dt) ? `${dt}、` : `${dt}の間、`; }
      if (Array.isArray(e.value)) return `${pp}${dd}${t}を「${e.value.join('」「')}」のうちランダムで1つの状態にする`;
      if (e.forced === true && e.value === 'ねむり' && e.duration === 2) return `2ターンの間、自分を「ねむり」状態にして、3ターン目に目を覚ます`;
      if (e.phase === 'delayed' && e.delay_turns === 1 && e.trigger === 'turn_end') return `次のターン終わりに${t}を「${e.value}」状態にする`;
      if (e.trigger === 'rampage_end') return `暴れ終わったあと、${dd}${t === '自分' ? '自分が' : `${t}が`}「${e.value}」状態になる`;
      return `${pp}${dd}${t}を「${e.value}」状態にする`;
    }
    case 'ひるみ':
      return `${(e.prob && e.prob < 100) ? `${e.prob}%の確率で` : ''}相手をひるませる${e.per_hit ? `(2回の攻撃それぞれで判定する)` : ''}`;
    case '反動':
      return `相手に与えたダメージの${fracT(e.fraction)}を、自分も受ける`;
    case '回復': {
      if (e.fraction == null) return null;
      if (e.condition && e.condition.type === 'target_fainted') return `手持ちにいる「ひんし」のポケモンを1匹えらんで、最大HPの${fracT(e.fraction)}だけ回復させて復活させる`;
      if ((e.phase === 'lasting' && e.trigger === 'turn_end') || e.phase === 'turn_end') return `毎ターン終わりに、${t}のHPを最大HPの${fracT(e.fraction)}だけ回復する`;
      if (e.phase === 'delayed' && e.trigger === 'turn_end') return `次のターンの終わりに、${t}のHPを最大HPの${fracT(e.fraction)}だけ回復する`;
      const fr = fracT(e.fraction);
      const ppNote = (e.target === 'incoming' && fr === '全部') ? (e.restores_pp ? `(技のPPも全部回復する)` : `(ただしPPは回復しない)`) : ``;
      return (e.prob && e.prob < 100 ? `${e.prob}%の確率で` : '') + ((fr === '全部') ? `${t}のHPを全部回復する` : `${t}のHPを、最大HPの${fr}だけ回復する`) + ppNote;
    }
    case '吸収':
      return `相手に与えたダメージの${fracT(e.fraction)}だけ、自分のHPを回復する`;
    case 'みがわり貫通':
      return `相手の「みがわり」をすりぬけて当たる`;
    case '必中': {
      if (e.phase === 'lasting' && Array.isArray(e.ignores) && e.ignores.length === 1 && e.ignores[0] === 'target_evasion')
        return `このあと、相手の回避率の変化に関係なく、攻撃が当たるようになる`;
      return e.condition ? `必ず命中する` : `相手の回避率や自分の命中率に関係なく、必ず命中する`;
    }
    case '急所率上昇': {
      if (e.always_crit) return e.timing === 'next_turn' ? `次のターンに出す技が、必ず急所に当たるようになる` : `必ず急所に当たる`;
      if (e.target === 'ally' || e.target === 'team') return `自分以外の味方の急所${e.stages > 0 ? '+' : ''}${e.stages}`;
      return `急所${e.stages > 0 ? '+' : ''}${e.stages}`;
    }
    case '必ず急所':
      return `必ず急所に当たる`;
    case '威力倍率':
      return `威力が${e.multiplier}倍になる`;
    case '自分瀕死':
      return `技を使ったあと、自分はひんしになる`;
    case '天候変化':
      return `${durT(e.duration)}の間、天気を「${e.value}」にする`;
    case '天候必中':
      return e.condition ? `[天候必中:条件付き]` : `[天候必中]`;
    case '状態異常回復': {
      const WHO = { team:'味方みんな', self:'自分', party:'手持ち全員', incoming:'次に出る味方', all:'場の全員', all_but_self:'自分以外の全員', all_opponents:'相手全員', opponent:'相手', ally:'味方' };
      const who = e.includes_self ? '自分と味方みんな' : (WHO[e.target] || '自分');
      if (Array.isArray(e.values) && e.values.length) return `${who}が受けている…の効果を解除する`;
      if (Array.isArray(e.value)) return `${who}の「${e.value.join('」「')}」の効果を解除する`;
      if (typeof e.value === 'string' && e.value !== 'all') return `${who}の「${e.value}」状態を解除する`;
      return `${who}の状態異常をすべて治す`;
    }
    case '物理特殊自動':
      return `物理と特殊のうち、ダメージが大きいほうで攻撃する`;
    case '強制交代(吹き飛ばし)':
      return `相手をむりやり交代させる(出てくる相手はランダム)`;
    case '強制交代(攻撃)':
      return `攻撃して、相手をむりやり交代させる(出てくる相手はランダム)`;
    case 'ランク無視':
      return `相手の能力ランクの変化を無視して攻撃する`;
    case '壁除去':
      return `相手の壁を除去する`;
    case '壁設置': {
      const r = e.reduces || [];
      const what = (r.includes('special_damage') && r.includes('physical_damage')) ? '物理技と特殊技'
        : r.includes('special_damage') ? '特殊技' : r.includes('physical_damage') ? '物理技' : '技';
      if (e.multiplier == null) return null;
      return `${durT(e.duration)}の間、自分と味方が受ける${what}のダメージを${fracT(e.multiplier)}にする`;
    }
    case 'フィールド展開':
      return `${durT(e.duration)}の間、足元を「${e.value}」にする`;
    case '設置除去':
      return `設置を除去する`;
    case '威力可変': {
      if (e.per_stage) {
        const whoStg = e.basis === 'target_positive_stat_stages' ? '相手の' : '自分の';
        return `${whoStg}能力ランクが1段階上がっているごとに威力が${e.per_stage}上がる`;
      }
      return `[威力可変]`;
    }
    case '条件威力倍率':
      if (e.condition && e.condition.type === 'pledge_combo') return `[ちかいコンボ]`;
      return `${(e.prob && e.prob < 100) ? `${e.prob}%くらいの確率で、` : ``}威力が${e.multiplier}倍になる`;
    case '別防御参照ダメージ':
      return `特殊技だが、相手の「ぼうぎょ」でダメージを計算する`;
    case 'ランクリセット':
      return e.target === 'all' ? `場にいる全員の能力ランクの変化を、すべて元にもどす` : `相手の能力ランクの変化をすべて元にもどす`;
    case '自分拘束':
      return typeof e.duration === 'number' ? `外れるまで最大${e.duration}ターン、続けて出しつづける` : `自分は交代できなくなる`;
    default:
      return `[${k}]`; // 未移植kindは[kind名]で返す(比較のプレースホルダ)
  }
}

// ─── 構造シグネチャ生成 ─────────────────────────────────────────────
/**
 * effectとm(技オブジェクト)からシグネチャを生成。
 * m.power(攻撃技か変化技か)をシグネチャに含めることで、
 * 「おにびvsれんごく」のような攻撃技/変化技の分類差を正しく分離する。
 * (同シグネチャ=同じ文節生成の「ロジックパス」を経るはず、を担保)
 */
function makeSignature(e, m) {
  const parts = [];
  parts.push(`kind:${e.kind}`);
  if (e.target != null) parts.push(`target:${e.target}`);
  if (e.stat != null) parts.push(`stat:${e.stat}`);
  if (Array.isArray(e.stats)) parts.push(`stats:${[...e.stats].sort().join(',')}`);
  if (e.stages != null) parts.push(`stages:${e.stages}`);
  if (e.prob != null) parts.push(`prob:${e.prob}`);
  if (e.phase != null) parts.push(`phase:${e.phase}`);
  if (e.value != null && typeof e.value !== 'object') parts.push(`value:${e.value}`);
  if (e.fraction != null) parts.push(`fraction:${e.fraction}`);
  if (e.multiplier != null) parts.push(`multiplier:${e.multiplier}`);
  if (e.trigger != null) parts.push(`trigger:${e.trigger}`);
  if (e.timing != null) parts.push(`timing:${e.timing}`);
  if (e.duration != null) parts.push(`duration:${JSON.stringify(e.duration)}`);
  if (e.per_turn != null) parts.push(`per_turn:${e.per_turn}`);
  if (e.reset != null) parts.push(`reset:${e.reset}`);
  if (e.to_max != null) parts.push(`to_max:${e.to_max}`);
  if (e.on_charge_turn != null) parts.push(`on_charge_turn:${e.on_charge_turn}`);
  if (e.condition) {
    const ct = typeof e.condition === 'object' ? e.condition.type || 'unknown' : String(e.condition);
    parts.push(`cond_type:${ct}`);
  }
  // 攻撃技か変化技かをシグネチャに含める(「必ず」の有無・「攻撃したあと」の有無がpowerに依存するため)
  if (m) {
    const power = m.power || (m.battle_data && m.battle_data.power) || 0;
    parts.push(`is_attack:${power > 0 ? 1 : 0}`);
  }
  return parts.join('|');
}

// ─── 注目パターン検出 ─────────────────────────────────────────────
const patternAfterAttack = s => /攻撃したあと、/.test(s);
const pattern100Prob     = s => /100%の確率で/.test(s);
const patternMust        = s => /必ず(?!命中|急所)/.test(s);
const patternJishin      = s => /自身/.test(s);
const patternRankNum     = s => /[ぁ-ゖ][\+-]\d/.test(s); // ひらがな+±数値
const patternRankKanji   = s => /\d段階/.test(s);

// ─── メイン処理 ──────────────────────────────────────────────────
function main() {
  console.log('[audit] loading WAZA_MAP from', DATA_FILE);
  const wazaMap = loadWazaMap(DATA_FILE);
  if (!wazaMap) {
    console.error('[fatal] WAZA_MAP could not be loaded');
    process.exit(1);
  }

  const entries = Object.values(wazaMap);
  console.log(`[audit] total moves: ${entries.length}`);

  // ── シグネチャ別グループ収集(文節レベル比較) ────────────────────
  // sigMap: signature → [ { name, clauseText, desc, effect } ]
  // clauseText = そのeffectだけからclause()が生成した文節
  const sigMap = new Map();

  for (const m of entries) {
    const name = m.name_ja || m.name || '?';
    const desc = m.description || '';
    const effects = (m.battle_data && m.battle_data.effects) || [];
    for (const e of effects) {
      const sig = makeSignature(e, m);
      const clauseText = clauseFromEffect(e, m) || null;
      if (!sigMap.has(sig)) sigMap.set(sig, []);
      sigMap.get(sig).push({ name, clauseText, desc, effect: e });
    }
  }

  // ── 割れているグループを検出 ──────────────────────────────────
  const divergentGroups = [];

  for (const [sig, items] of sigMap.entries()) {
    if (items.length < 2) continue;

    // clauseText のユニーク集合(null は除外)
    const clauseSet = new Set(items.filter(x => x.clauseText != null).map(x => x.clauseText));
    if (clauseSet.size <= 1) continue; // 全部同じ or 移植未対応(全null) = スキップ

    const kind = (items[0].effect && items[0].effect.kind) || '?';

    // 揺れのパターン分類
    const clauseTexts = items.filter(x => x.clauseText != null).map(x => x.clauseText);
    const afterAttackItems = clauseTexts.filter(patternAfterAttack);
    const prob100Items     = clauseTexts.filter(pattern100Prob);
    const mustItems        = clauseTexts.filter(patternMust);
    const jishinItems      = clauseTexts.filter(patternJishin);
    const rankNumItems     = clauseTexts.filter(patternRankNum);
    const rankKanjiItems   = clauseTexts.filter(patternRankKanji);

    const divergenceAxes = [];
    if (afterAttackItems.length > 0 && afterAttackItems.length < clauseTexts.length)
      divergenceAxes.push('攻撃したあと,の有無');
    if (prob100Items.length > 0 && prob100Items.length < clauseTexts.length)
      divergenceAxes.push('100%の確率での有無');
    if (mustItems.length > 0 && mustItems.length < clauseTexts.length)
      divergenceAxes.push('必ずの有無');
    if (jishinItems.length > 0 && jishinItems.length < clauseTexts.length)
      divergenceAxes.push('自身vs自分');
    if (rankNumItems.length > 0 && rankKanjiItems.length > 0)
      divergenceAxes.push('ランク数値表記の揺れ');
    if (divergenceAxes.length === 0)
      divergenceAxes.push('その他の文言の違い');

    // 原因の一次切り分け: effectsが完全同一かチェック
    const effectJsons = items.map(x => JSON.stringify(x.effect));
    const uniqueEffects = new Set(effectJsons);
    const cause = uniqueEffects.size === 1
      ? 'compose_engine(effectsは完全同一なのに文が違う)'
      : 'effects_diff(effectsに微差あり→clause()の引数が違う)';

    // 代表例(clauseTextのパターン別)
    const clauseGroups = new Map();
    for (const item of items) {
      if (!item.clauseText) continue;
      const k = item.clauseText;
      if (!clauseGroups.has(k)) clauseGroups.set(k, []);
      clauseGroups.get(k).push({ name: item.name, desc: item.desc });
    }
    const examples = [];
    for (const [clauseText, nameList] of clauseGroups.entries()) {
      examples.push({
        clause_text: clauseText,
        move_names: nameList.slice(0, 3).map(x => x.name),
        count: nameList.length,
        desc_sample: nameList[0].desc.length > 100 ? nameList[0].desc.slice(0, 100) + '…' : nameList[0].desc,
      });
    }

    divergentGroups.push({
      signature: sig,
      kind,
      total_moves: items.length,
      unique_clauses: clauseSet.size,
      divergence_axes: divergenceAxes,
      cause,
      examples: examples.slice(0, 5),
    });
  }

  // ── 注目パターン4種の全体集計 ──────────────────────────────────
  // パターン1: 自分能力ダウン攻撃技における「攻撃したあと、」
  const selfDownAttack = [];
  for (const m of entries) {
    const power = m.power || (m.battle_data && m.battle_data.power) || 0;
    if (!power) continue;
    const effects = (m.battle_data && m.battle_data.effects) || [];
    const selfDownEffects = effects.filter(e =>
      e.kind === '能力ランク変化' && e.target === 'self' && (e.stages || 0) < 0
    );
    if (!selfDownEffects.length) continue;
    for (const e of selfDownEffects) {
      const cl = clauseFromEffect(e, m) || '';
      selfDownAttack.push({
        name: m.name_ja || m.name,
        clause: cl,
        has_after_attack: patternAfterAttack(cl),
        has_jisin: patternJishin(cl),
      });
    }
  }

  // パターン2: 状態付与 prob:100 攻撃技における「必ず/100%の確率で」
  const statusProb100Attack = [];
  for (const m of entries) {
    const power = m.power || (m.battle_data && m.battle_data.power) || 0;
    if (!power) continue;
    const effects = (m.battle_data && m.battle_data.effects) || [];
    for (const e of effects) {
      if ((e.kind !== '状態付与' && e.kind !== 'ひるみ') || e.prob !== 100) continue;
      const cl = clauseFromEffect(e, m) || '';
      statusProb100Attack.push({
        name: m.name_ja || m.name,
        clause: cl,
        has_prob100: pattern100Prob(cl),
        has_must: patternMust(cl),
        certainty_expressed: pattern100Prob(cl) || patternMust(cl),
      });
    }
  }

  // パターン3: 「自身」揺れ
  const selfJishinAll = [];
  for (const m of entries) {
    const desc = m.description || '';
    if (patternJishin(desc)) selfJishinAll.push({ name: m.name_ja || m.name, desc });
  }
  // clause()でもチェック
  const jishinInClause = [];
  for (const m of entries) {
    const effects = (m.battle_data && m.battle_data.effects) || [];
    for (const e of effects) {
      const cl = clauseFromEffect(e, m) || '';
      if (patternJishin(cl)) jishinInClause.push({ name: m.name_ja || m.name, clause: cl });
    }
  }

  // パターン4: ランク変化の数値表記
  const rankKanjiMoves = entries.filter(m => patternRankKanji(m.description || '')).map(m => ({
    name: m.name_ja || m.name,
    desc_snippet: (m.description || '').match(/(.{0,30}\d段階.{0,30})/)?.[0] || ''
  }));
  const rankNumMoves = entries.filter(m => patternRankNum(m.description || '')).length;

  // ── 重要度順ソート ──────────────────────────────────────────────
  divergentGroups.sort((a, b) => {
    const pa = a.cause.startsWith('compose') ? 0 : 1;
    const pb = b.cause.startsWith('compose') ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return b.unique_clauses - a.unique_clauses;
  });

  // ── レポート生成 ──────────────────────────────────────────────
  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      total_moves: entries.length,
      total_sig_groups: sigMap.size,
      divergent_groups: divergentGroups.length,
      compose_engine_cause: divergentGroups.filter(g => g.cause.startsWith('compose')).length,
      effects_diff_cause: divergentGroups.filter(g => g.cause.startsWith('effects')).length,
    },
    focus_patterns: {
      'pattern1_攻撃したあと_有無(自分能力ダウン攻撃技)': {
        total_effect_slots: selfDownAttack.length,
        has_after_attack: selfDownAttack.filter(x => x.has_after_attack).length,
        missing_after_attack: selfDownAttack.filter(x => !x.has_after_attack).length,
        missing_moves: selfDownAttack.filter(x => !x.has_after_attack).map(x => ({ name: x.name, clause: x.clause })),
      },
      'pattern2_100%確率_有無(状態付与prob100攻撃技)': {
        total_effect_slots: statusProb100Attack.length,
        certainty_expressed: statusProb100Attack.filter(x => x.certainty_expressed).length,
        '必ずを使用': statusProb100Attack.filter(x => x.has_must).length,
        '100%の確率でを使用': statusProb100Attack.filter(x => x.has_prob100).length,
        missing_certainty: statusProb100Attack.filter(x => !x.certainty_expressed).length,
        missing_moves: statusProb100Attack.filter(x => !x.certainty_expressed).map(x => ({ name: x.name, clause: x.clause })),
      },
      'pattern3_自分vs自身の揺れ': {
        desc_using_jishin: selfJishinAll.length,
        clause_using_jishin: jishinInClause.length,
        desc_examples: selfJishinAll.slice(0, 10),
        clause_examples: jishinInClause.slice(0, 5),
      },
      'pattern4_ランク変化表記': {
        desc_rank_numeral_moves: rankNumMoves,
        desc_rank_kanji_moves: rankKanjiMoves.length,
        kanji_examples: rankKanjiMoves,
      },
    },
    top_divergent_groups: divergentGroups.slice(0, 30),
    all_divergent_groups: divergentGroups,
  };

  // ── JSON出力 ──────────────────────────────────────────────────
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n[output] ${OUT_PATH}`);

  // ── コンソールサマリ ──────────────────────────────────────────
  console.log('\n========== COMPOSE CONSISTENCY AUDIT SUMMARY ==========');
  console.log(`総技数: ${report.summary.total_moves}`);
  console.log(`シグネチャグループ数: ${report.summary.total_sig_groups}`);
  console.log(`割れているグループ数: ${report.summary.divergent_groups}`);
  console.log(`  うち compose_engine 起因: ${report.summary.compose_engine_cause}`);
  console.log(`  うち effects_diff 起因:   ${report.summary.effects_diff_cause}`);

  console.log('\n--- 注目パターン集計 ---');
  const fp = report.focus_patterns;

  console.log('\n[1] 攻撃したあと,の有無 (自分能力ダウン攻撃技)');
  const fp1 = fp['pattern1_攻撃したあと_有無(自分能力ダウン攻撃技)'];
  console.log(`  対象effectスロット数: ${fp1.total_effect_slots}`);
  console.log(`  「攻撃したあと、」あり: ${fp1.has_after_attack}`);
  console.log(`  「攻撃したあと、」なし: ${fp1.missing_after_attack}`);
  if (fp1.missing_moves.length) {
    console.log(`  欠落技:`);
    fp1.missing_moves.forEach(x => console.log(`    ${x.name}: "${x.clause}"`));
  }

  console.log('\n[2] 100%の確率での有無 (状態付与prob:100攻撃技)');
  const fp2 = fp['pattern2_100%確率_有無(状態付与prob100攻撃技)'];
  console.log(`  対象effectスロット数: ${fp2.total_effect_slots}`);
  console.log(`  確率言明あり(必ず+100%): ${fp2.certainty_expressed}`);
  console.log(`    うち「必ず」: ${fp2['必ずを使用']}`);
  console.log(`    うち「100%の確率で」: ${fp2['100%の確率でを使用']}`);
  console.log(`  確率言明なし: ${fp2.missing_certainty}`);
  if (fp2.missing_moves.length) {
    console.log(`  確率言明なし技:`);
    fp2.missing_moves.forEach(x => console.log(`    ${x.name}: "${x.clause}"`));
  }

  console.log('\n[3] 自分vs自身の揺れ');
  const fp3 = fp['pattern3_自分vs自身の揺れ'];
  console.log(`  description中で「自身」を使う技: ${fp3.desc_using_jishin}`);
  console.log(`  clause生成文で「自身」を使う技: ${fp3.clause_using_jishin}`);
  if (fp3.desc_examples.length) {
    console.log('  descriptionの例:');
    fp3.desc_examples.forEach(e => console.log(`    ${e.name}: "${e.desc.slice(0,60)}"`));
  }

  console.log('\n[4] ランク変化の数値表記vs漢字');
  const fp4 = fp['pattern4_ランク変化表記'];
  console.log(`  ±N数値表記の技: ${fp4.desc_rank_numeral_moves}`);
  console.log(`  N段階漢字表記の技: ${fp4.desc_rank_kanji_moves}`);
  if (fp4.kanji_examples.length) {
    console.log('  漢字表記の例:');
    fp4.kanji_examples.forEach(e => console.log(`    ${e.name}: "${e.desc_snippet}"`));
  }

  console.log('\n--- 割れているグループ 上位10件 (compose_engine起因優先) ---');
  divergentGroups.slice(0, 10).forEach((g, i) => {
    console.log(`\n[${i+1}] kind:${g.kind} (${g.total_moves}技, ${g.unique_clauses}パターン, ${g.cause})`);
    console.log(`  sig: ${g.signature}`);
    console.log(`  軸: ${g.divergence_axes.join(' / ')}`);
    g.examples.slice(0, 3).forEach(ex => {
      console.log(`  [${ex.move_names.join('/')}] clause: "${ex.clause_text}"`);
    });
  });

  console.log('\n========================================================');
  console.log(`詳細レポート: ${OUT_PATH}`);
}

main();
