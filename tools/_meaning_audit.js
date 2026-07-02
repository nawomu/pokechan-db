#!/usr/bin/env node
/**
 * _meaning_audit.js
 * 意味要素突合監査ハーネス (v2)
 *
 * うちの生成説明文(description) vs ヤックン(description_legacy) を全数突合し
 * ① 意味要素の抜け(missing) ② 統一感バラつき を機械検出する。
 *
 * 出力: reference/_meaning_audit_report.json + コンソールサマリ
 * 禁止: 既存ファイルの変更禁止。このファイルとレポートJSONのみ新規作成可。
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ─── ファイル設定 ──────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const SOURCES = [
  { file: path.join(ROOT, 'pokechan_data_all.js'), label: 'all' },
  { file: path.join(ROOT, 'pokechan_data.new.js'),  label: 'champs' },
];
const OUT_PATH = path.join(ROOT, 'reference', '_meaning_audit_report.json');

// ─── データロード ──────────────────────────────────────────────
function loadWazaMap(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const exp = {};
  const mod = new Function('exports', src + ';\nif(typeof WAZA_MAP!=="undefined") exports.WAZA_MAP=WAZA_MAP;');
  mod(exp);
  return exp.WAZA_MAP || null;
}

// ─── テキスト正規化 ────────────────────────────────────────────
/**
 * 意味比較のための正規化:
 * 1. ひらがな→カタカナ統一
 * 2. 全角数字→半角
 * 3. ランク変化表記を統一: 「N段階上げる/下がる/上がる/下げる」→「RANK+N/RANK-N」
 * 4. 「100%の確率で」「必ず」→「CERTAINTY」
 * 5. 複数回攻撃: 「N〜M回連続」「N〜M回つづけて」→「MULTI_N_M」
 * 6. みがわり貫通: 「みがわりを貫通」「みがわり状態を貫通」「みがわりをすりぬけて」→「PIERCE_SUB」
 * 7. 音技: 「音系の技」→「SOUND_TECH」
 * 8. 反動: 「反動」→「RECOIL」
 * 9. HP半分/割合回復
 */
function normalize(raw) {
  let s = raw;

  // ひらがな→カタカナ
  s = s.replace(/[ぁ-ん]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  // 全角数字→半角
  s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  // 全角記号→半角
  s = s.replace(/[＋]/g, '+').replace(/[－]/g, '-').replace(/[％]/g, '%');

  // ── ランク変化の同値化 ──
  // 「N段階上げる」「N段階上がる」「+N段階」「(+N)」「+N」 → RANK_PLUS_N
  s = s.replace(/([+-]?\d+)段階[上下][げがるける]+/g, (m, n) => {
    const v = parseInt(n, 10);
    return v >= 0 ? `RANK_PLUS_${Math.abs(v)}` : `RANK_MINUS_${Math.abs(v)}`;
  });
  // 「N段階下がる」「N段階下げる」
  s = s.replace(/(\d+)段階[さ下][がげ]/g, (_, n) => `RANK_MINUS_${n}`);
  // 「N段階[上/下]」残り
  s = s.replace(/(\d+)段階上/g, (_, n) => `RANK_PLUS_${n}`);
  s = s.replace(/(\d+)段階下/g, (_, n) => `RANK_MINUS_${n}`);
  // 「+N」「-N」(数字後のランク表記) 能力名直後のみ
  // 例: こうげき+2 → RANK_PLUS_2、すばやさ-1 → RANK_MINUS_1
  s = s.replace(/(コウゲキ|ボウギョ|トクコウ|トクボウ|スバヤサ|命中率|回避率|急所ランク)\+(\d+)/g, (_, stat, n) => `${stat}_RANK_PLUS_${n}`);
  s = s.replace(/(コウゲキ|ボウギョ|トクコウ|トクボウ|スバヤサ|命中率|回避率|急所ランク)-(\d+)/g, (_, stat, n) => `${stat}_RANK_MINUS_${n}`);

  // ── 確率「100%」と「必ず/確実」を同値化 ──
  // 100%の確率で → CERTAINTY_EFFECT (命中・急所・後攻・先攻は別要素なので除外)
  s = s.replace(/100%ノ確率デ|100%デ/g, 'CERTAINTY_EFFECT');
  // 「必ず〜状態にする」「必ず〜する」(命中/急所/後攻/先攻を除く)
  s = s.replace(/必ズ(?!命中|急所|後攻|先制)/g, 'CERTAINTY_EFFECT');
  // 「必ず命中」はそのまま残す(別要素)
  // ── P4.6: ランク変化を確率なしで書く形(必ずの省略形)を同値化 ──
  // legacy: '100%の確率でこうげきを1段階下げる' → CERTAINTY_EFFECT + RANK_MINUS_1
  // ours:  'こうげき-1' (確率省略 = 必ずの意味) → RANK_MINUS_1 のみ
  // 能力ランク変化(コウゲキ/ボウギョ等 ± N)で確率表記がない場合も CERTAINTY_EFFECT を補う
  s = s.replace(/(コウゲキ|ボウギョ|トクコウ|トクボウ|スバヤサ|命中率|回避率)((?:_RANK_(?:PLUS|MINUS)_\d+)|(?:[+-]\d+))/g,
    (m, stat, chg) => `CERTAINTY_EFFECT_${stat}${chg}`);

  // ── 複数回攻撃の同値化 ──
  // 「1ターンにN〜M回連続」「N〜M回つづけて」「N〜Mかい」
  s = s.replace(/1ターンニ(\d+)[〜~～](\d+)回連続/g, (_, a, b) => `MULTI_HIT_${a}_${b}`);
  s = s.replace(/(\d+)[〜~～](\d+)回[連続ツヅけて]+/g, (_, a, b) => `MULTI_HIT_${a}_${b}`);
  s = s.replace(/(\d+)回[連続ツヅけて]+/g, (_, n) => `MULTI_HIT_${n}_${n}`);

  // ── みがわり貫通の同値化 ──
  s = s.replace(/ミガワリ.*?[ヲを].*?貫通/g, 'PIERCE_SUBSTITUTE');
  s = s.replace(/ミガワリ.*?スリヌケ/g, 'PIERCE_SUBSTITUTE');
  s = s.replace(/ミガワリヲスリヌケテ当タル/g, 'PIERCE_SUBSTITUTE');
  s = s.replace(/「ミガワリ」ヲスリヌケテ/g, 'PIERCE_SUBSTITUTE');

  // ── 音系技貫通の同値化 ──
  s = s.replace(/音系ノ技/g, 'SOUND_TECH');

  // ── HP反動の同値化 ──
  // 「与えたダメージのN%/1/N を自分も受ける」「与えたダメージの半分を自分も受ける」「反動」を RECOIL_DAMAGE に統一
  s = s.replace(/与エタダメージノ\d+%.*?受ケル/g, 'RECOIL_DAMAGE');
  s = s.replace(/与エタダメージノ1\/\d+.*?受ケル/g, 'RECOIL_DAMAGE');
  s = s.replace(/与エタダメージノ半分.*?受ケル/g, 'RECOIL_DAMAGE');
  s = s.replace(/反動デ.*?HP.*?[削減]/g, 'RECOIL_DAMAGE');
  s = s.replace(/反動ガアル/g, 'RECOIL_DAMAGE');
  s = s.replace(/反動/g, 'RECOIL_DAMAGE');

  // ── HP回復量の同値化 ──
  // 「最大HPの半分回復する」「最大HPの半分だけ回復」= 回復文脈のみ。ダメージ文脈(4倍弱点なら半分ダメージ)は除外
  s = s.replace(/[ＨHP]+.*?最大[ＨHP]*.*?半分.*?回復|最大[ＨHP]+ノ半分.*?回復|HP.*?最大HP.*?半分/g, 'RECOVER_HALF_HP');
  s = s.replace(/最大[ＨHhHP]+ノ(\d+\/\d+).*?回復/g, (_, frac) => `RECOVER_FRAC_${frac}`);

  // ── 急所率の同値化 ──
  // 「急所に当たりやすい(急所ランク:+1)」「急所+1」 → CRIT_PLUS_1
  s = s.replace(/急所ニ当タリヤスイ|急所ランク[：:]\+1|急所\+1/g, 'CRIT_PLUS_1');
  s = s.replace(/急所ランク.*RANK_PLUS_(\d+)/g, (_, n) => `CRIT_PLUS_${n}`);

  // ── 優先度の同値化 ──
  // 「必ず先制(優先度:+1)」「優先度+1の先制技」→ PRIORITY_PLUS_N
  // 「必ず後攻(優先度:-6)」「優先度-6の後攻技」→ PRIORITY_MINUS_N
  s = s.replace(/優先度[：:]\+(\d+)|優先度\+(\d+)/g, (_, a, b) => `PRIORITY_PLUS_${a||b}`);
  s = s.replace(/優先度[：:]-(\d+)|優先度-(\d+)/g, (_, a, b) => `PRIORITY_MINUS_${a||b}`);
  s = s.replace(/必ズ先制.*?優先度[：:]\+(\d+)|先制技.*?優先度\+(\d+)/g, (_, a, b) => `PRIORITY_PLUS_${a||b}`);
  s = s.replace(/必ズ後攻.*?優先度[：:]-(\d+)|後攻技.*?優先度-(\d+)/g, (_, a, b) => `PRIORITY_MINUS_${a||b}`);

  // ── 一撃必殺の同値化 ──
  s = s.replace(/一撃デヒンシニサセル|一発デひんしニナル|一発デひんし|ヒンシニスル/g, 'OHKO');

  // ── 強制交代の同値化 ──
  // 「強制的に交代させる」「むりやり交代させる」→ FORCE_SWITCH
  s = s.replace(/強制的ニ.*?交代サセル|ムリヤリ交代サセル|むりやり交代/g, 'FORCE_SWITCH');

  // ── レイドバリアの同値化 ──
  s = s.replace(/レイドデハ.*?バリア.*?ゲージ.*?減ラス/g, 'RAID_BARRIER_REDUCE');
  s = s.replace(/不思議ナバリア.*?減ラス/g, 'RAID_BARRIER_REDUCE');

  // ── ためる/チャージの同値化 ──
  // 「1ターン目は攻撃せずに」「1ターン目はためて」「2ターン目に攻撃」など
  s = s.replace(/1ターン目ハ攻撃セズニ.*?2ターン目/g, 'CHARGE_TURN');
  s = s.replace(/1ターン目ハ攻撃セズ/g, 'CHARGE_TURN');
  s = s.replace(/1ターン目ニ.*?攻撃セズ/g, 'CHARGE_TURN');
  s = s.replace(/1ターン目ハタメテ/g, 'CHARGE_TURN');
  s = s.replace(/タメテ.*?2ターン目/g, 'CHARGE_TURN');
  // 「2ターン目に攻撃する」が残った場合も CHARGE_TURN に
  s = s.replace(/CHARGE_TURN.*?2ターン目/g, 'CHARGE_TURN');
  s = s.replace(/チャージ/g, 'CHARGE_TURN');

  // ── 交代後も効果継続の同値化 ──
  // 「交代しても効果は続く」「交代しても消えない」「交代しても引き継ぐ」
  s = s.replace(/交代シテモ.*?(?:効果ハ?続ク|消エナイ|引キ継グ)/g, 'PERSIST_AFTER_SWITCH');

  // ── 自分以外全員の同値化 ──
  // legacyは「自分以外全員が対象」、うちは「ダブルバトルでは自分以外みんなに当たる」
  s = s.replace(/自分以外全員ガ対象|自分以外全員ニ|ダブルバトルデハ.*?自分以外みんな|ダブルバトルデハ.*?自分以外ミンナ/g, 'ALL_EXCEPT_SELF');

  return s;
}

// ─── 引用語抽出(「…」『…』【…】) ──────────────────────────────────
function extractQuoted(text) {
  const result = new Set();
  const re = /[「『【](.*?)[」』】]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    // 技名・特性名・道具名として意味ある長さ(2文字以上)のもの
    if (m[1].length >= 2) result.add(m[1]);
  }
  return [...result];
}

// ─── 意味要素辞書 ────────────────────────────────────────────────
// normalize() 後のテキストに適用する
// key: 要素識別子, re: 検出正規表現
const ELEMENTS = [
  // ── 正規化後トークン ──
  { key: '確実効果(100%=必ず)',  re: /CERTAINTY_EFFECT/ },
  { key: '複数回攻撃',           re: /MULTI_HIT/ },
  { key: 'みがわり貫通',         re: /PIERCE_SUBSTITUTE/ },
  { key: '音系技',               re: /SOUND_TECH/ },
  { key: '反動ダメージ',         re: /RECOIL_DAMAGE/ },
  { key: 'HP半分回復',           re: /RECOVER_HALF_HP/ },
  { key: '一撃必殺',             re: /OHKO/ },
  { key: 'レイドバリア減少',     re: /RAID_BARRIER_REDUCE/ },
  { key: 'ためターン',           re: /CHARGE_TURN/ },
  { key: '急所率上昇+1',         re: /CRIT_PLUS_1/ },
  { key: '優先度+1',             re: /PRIORITY_PLUS_1/ },
  { key: '優先度-5',             re: /PRIORITY_MINUS_5/ },
  { key: '優先度-6',             re: /PRIORITY_MINUS_6/ },

  // ── ランク変化(主要) ──
  // 「ランク変化あり」だけを検出するブロード版(偽陽性を避けるため方向・量は別要素にしない)
  // → うちの「+2/-1」表記とlegacyの「N段階上げる」は正規化で同値化済みなので
  //    ここでは RANK_PLUS/RANK_MINUS が両方に検出されれば一致 → 抜けは出ない

  // ── 命中・回避 ──
  { key: '必中',                  re: /必ズ命中|回避率.*命中率.*関係.*命中|命中率.*回避率.*関係.*命中|必ズ当タル|必ず当タル|必ズ当タリ|CERTAINTY_EFFECT当タル|CERTAINTY_EFFECT当タリ/ }, // P4.2: 必ズ当タリ(ちいさくなる等)追加 / P4.6影響: CERTAINTY_EFFECTに変換後の当タル/当タリも追加
  { key: '命中率低下付与',        re: /命中率.*RANK_MINUS|RANK_MINUS.*命中率/ },
  { key: '回避率上昇付与',        re: /回避率.*RANK_PLUS|RANK_PLUS.*回避率/ },

  // ── ひるみ ──
  { key: 'ひるみ付与',            re: /ひるマセル|ひるム率|確率デひるム/ },

  // ── 急所 ──
  // 急所率は CRIT_PLUS_1 で同値化済み
  { key: '必急所',                re: /必ズ急所/ },

  // ── 状態異常 ──
  { key: 'やけど付与',            re: /ヤケド.*状態にする|相手.*ヤケド.*状態/ },
  // こおり付与 = 相手をこおり状態にする。自分のこおり状態解除は除外
  { key: 'こおり付与',            re: /相手.*コオリ.*状態|コオリ.*状態.*ニスル(?!ガ)/ },
  { key: 'まひ付与',              re: /マヒ.*状態|相手.*マヒ/ },
  // ねむり付与 = 相手をねむり状態にする。ねむり防止・ねむり条件は除外
  { key: 'ねむり付与',            re: /相手.*ネムリ.*状態ニスル|ネムリ.*状態ニスル(?!.*ナラナイ)/ },
  // どく付与: 状態にする/状態にした など。どく回復(リフレッシュ等)と区別
  { key: 'どく付与',              re: /相手.*ドク.*状態|ドク.*状態.*ニスル/ },
  { key: 'もうどく付与',          re: /モウドク.*状態|相手.*モウドク/ },
  { key: 'こんらん付与',          re: /コンラン.*状態|相手.*コンラン/ },

  // ── まもる・貫通 ──
  { key: 'まもる貫通',            re: /マモル.*貫通|マモルヲ貫通|マモルモスリヌケ/ },
  { key: 'ダイウォール貫通しない', re: /ダイウォール.*貫通シナイ|ダイウォール.*受ケナイ|ダイウォール.*無効|ダイウォールハ.*受ケナイ/ },

  // ── バインド・拘束 ──
  { key: 'バインド(毎ターン削り)', re: /バインド|縛リ|シメツケル|マキツキ|ホノオノウズ/ },
  { key: '逃げ・交代阻止',        re: /ニゲル.*デキナイ|コウダイデキナイ|逃ゲラレナイ/ },
  { key: '強制交代',              re: /FORCE_SWITCH/ },
  { key: '攻撃後自分交代',        re: /攻撃後.*自分.*交代|使用後.*自分.*交代/ },

  // ── HP吸収 ──
  { key: 'HP吸収(割合)',          re: /吸イ取ッテ.*回復|与エタダメージ.*吸収|相手ノHP.*吸収/ },

  // ── 天候 ──
  { key: '天候はれ関連',          re: /ニホンバレ|ハレ.*[天気候]|[天気候].*ハレ/ },
  { key: '天候あめ関連',          re: /アマゴイ|アメ.*[天気候]|[天気候].*アメ|「アメ」ノトキ|「アメ」ノトキハ必ズ/ }, // P4.2: 「アメ」のとき(天気ワード省略形)を追加
  { key: '天候すなあらし',        re: /スナアラシ|砂嵐/ },
  { key: '天候ゆき',              re: /ユキ.*[天気候]/ },

  // ── フィールド ──
  { key: 'グラスフィールド',      re: /グラスフィールド/ },
  { key: 'エレキフィールド',      re: /エレキフィールド/ },
  { key: 'サイコフィールド',      re: /サイコフィールド/ },
  { key: 'ミストフィールド',      re: /ミストフィールド/ },

  // ── タイプ効果 ──
  { key: 'タイプ相性無視',        re: /タイプ相性.*受ケナイ|全テノタイプ.*効ク|タイプニ関係ナク|タイプ相性デ変ワラナイ|タイプ相性ニ関係ナク/ }, // P4.1: composeが出す「タイプ相性で変わらない」「タイプ相性に関係なく当たる」を追加
  { key: 'ゴーストタイプ無効例外', re: /ゴースト.*タイプ.*無効|ゴーストタイプニハ当タラナイ|「ゴースト」タイプニハ効カナイ|マッタク効カナイタイプ.*無効/ }, // P4.1: compose出力形追加 / P4.1b: 固定ダメージ系「まったく効かないタイプ(無効)」=ゴースト免疫の言い換えとして追加

  // ── 特殊条件 ──
  // 優先度は PRIORITY_PLUS_N / PRIORITY_MINUS_N で同値化済み → 正規化後トークンで検出
  { key: '後攻技',                re: /PRIORITY_MINUS_[456]|後攻技/ },
  { key: '重さ依存威力',          re: /重サ.*ホド.*威力|体重.*威力|重ケレバ.*威力/ },
  { key: '速さ依存威力',          re: /スバヤサ.*ホド.*威力|速サ.*依存/ },
  { key: 'そらをとぶ中限定',      re: /空中ニいる間|飛ンデいる間|そらヲとぶ.*状態/ },
  { key: 'ちいさくなる二倍',      re: /チイサクナッタ.*2倍|チイサクナッテいる.*2倍/ },
  { key: '天候依存威力',          re: /天気ガ.*威力|[天気候].*ニヨッテ.*威力/ },
  { key: 'ダイマックス専用',      re: /ダイマックス技|攻撃技ノダイマックス技/ },
  // ダイマックス相手無効: ひらがな→カタカナ変換後なので「いる」→「イル」
  { key: 'ダイマックス相手無効',  re: /ダイマックスシテイル.*無効|ダイマックス.*効カナイ/ },

  // ── 特性 ──
  { key: '特性てつのこぶし',      re: /テツノコブシ/ },
  { key: '特性プラス/マイナス',   re: /プラス.*マイナス|特性.*プラス|特性.*マイナス/ },

  // ── やどりぎ・道具 ──
  { key: '交代後も継続',          re: /PERSIST_AFTER_SWITCH/ },
  { key: 'きのみ消費',            re: /キノミ.*消費|どうぐ.*消費|もちもの.*消費/ },

  // ── ダブル ──
  { key: '相手全体対象',          re: /相手全体ガ対象|相手全員|相手全体ニ当タル|ダブルバトルデハ.*相手全体|相手全体ヲ|相手全体ニ/ }, // P4.4: 「相手全体を」「相手全体に」形を追加

  // ── 固定ダメージ ──
  { key: '固定ダメージ',          re: /固定ダメージ|レベル.*同ジ値.*ダメージ|タイプ相性デ変ワラナイガ.*無効.*当タラナイ/ }, // P4.1: compose出力の「タイプ相性で変わらないが、無効の相手には当たらない」形を追加

  // ── 状態回復 ──
  // どく・まひ・やけど・ねむり・こおり などが「治る」「回復する」文脈で出る
  { key: '状態異常回復',          re: /[ドマヤネコ][クヒケムオ].*[治ナ]オル|状態異常ガ治ル|状態.*回復スル|ドク.*マヒ.*ヤケド.*[治回]|状態異常ヲスベテ治ス|状態異常ヲ.*治ス|[ドマヤコ][クヒケンラ].*」.*効果.*解除/ }, // P4.5: compose出力の「状態異常をすべて治す」「どく・まひ・やけど」形を追加(設置技解除との誤マッチを防ぐため「ノ効果ヲ解除スル」単独は除外)

  // ── パンチ技 ──
  { key: 'パンチ系技',            re: /パンチ系ノ技|パンチ系の技/ },

  // ── 風技 ──
  { key: '風技',                  re: /風技/ },

  // ── 接触 ──
  { key: '接触技',                re: /接触技/ },

  // ── ダブルバトルで自分以外全員に当たる技 ──
  // legacyは「自分以外全員が対象」、うちは「ダブルバトルでは自分以外みんなに当たる」→ 同値化済みトークンで検出
  { key: '自分以外全員対象',       re: /ALL_EXCEPT_SELF/ },
];

// ─── 数値要素抽出 ─────────────────────────────────────────────────
// 数値系の要素(確率%・倍率・ターン数など)を正規化済みテキストから抽出
const NUM_PATTERNS = [
  // 確率: 10%, 30% など (100%は CERTAINTY_EFFECT に正規化済みなので除外)
  { key_prefix: 'prob', re: /(?<!1)(?:(?:[1-9]\d?)%|(?:\d+\.?\d*)%)(?!の確率で)/g },
  // 具体的な確率付与: 「X%の確率で」パターン
  { key_prefix: 'prob_effect', re: /(\d+)%.*?(?:確率|状態ニスル|ひるマセル|下ゲル|上ゲル)/g },
  // 倍率
  { key_prefix: 'mult', re: /(\d+(?:\.\d+)?)倍/g },
  // ターン数: 「Nターン」を検出。MULTI_HITに置換済みの「1ターンに」は除外
  // ただし「1ターン目」(ため技)は CHARGE_TURN に正規化済みなので除外
  { key_prefix: 'turn_count', re: /(?<!MULTI_HIT)(?<!CHARGE)([2-9]|[1-9]\d)ターン/g },
  // HP分数
  { key_prefix: 'hp_frac', re: /最大[ＨHhHP]+ノ(\d+\/\d+)/g },
];

function extractNumerics(normText) {
  const found = new Set();
  NUM_PATTERNS.forEach(({ key_prefix, re }) => {
    re.lastIndex = 0; // reset
    let m;
    while ((m = re.exec(normText)) !== null) {
      found.add(`${key_prefix}:${m[0].substring(0, 20)}`);
    }
  });
  return [...found];
}

// ─── 1技の分析 ────────────────────────────────────────────────────
function analyzeOne(waza) {
  const desc   = waza.description || '';
  const legacy = waza.description_legacy || '';

  const normD  = normalize(desc);
  const normL  = normalize(legacy);

  // 辞書要素検出
  const dElems = new Set(ELEMENTS.filter(e => e.re.test(normD)).map(e => e.key));
  const lElems = new Set(ELEMENTS.filter(e => e.re.test(normL)).map(e => e.key));

  // 数値要素
  extractNumerics(normD).forEach(e => dElems.add(e));
  extractNumerics(normL).forEach(e => lElems.add(e));

  // 引用語(固有名詞)比較
  const dQuoted = new Set(extractQuoted(desc).map(normalize));
  const lQuoted = new Set(extractQuoted(legacy).map(normalize));

  // 抜け: legacyにあってdescに無い
  const missingElems  = [...lElems].filter(e => !dElems.has(e));
  const extraElems    = [...dElems].filter(e => !lElems.has(e));
  // 引用語の抜け(固有名詞の抜け): legacyにある固有名がうちに無い
  const missingQuoted = [...lQuoted].filter(q => !dQuoted.has(q) && q.length >= 2);
  const extraQuoted   = [...dQuoted].filter(q => !lQuoted.has(q) && q.length >= 2);

  return {
    slug:             waza.key || '',
    name:             waza.name || '',
    missing_elements: missingElems,
    extra_elements:   extraElems,
    missing_quoted:   missingQuoted,
    extra_quoted:     extraQuoted,
    has_missing:      missingElems.length > 0 || missingQuoted.length > 0,
  };
}

// ─── 統一感集計 ───────────────────────────────────────────────────
function calcConsistency(results) {
  // 要素ごとの集計
  const elemStats = {};

  // ELEMENTS の全キーを初期化
  ELEMENTS.forEach(({ key }) => {
    elemStats[key] = { element: key, legacy_count: 0, ours_count: 0, missing_slugs: [], missing_names: [] };
  });

  results.forEach(r => {
    // legacy言及(=missingはlegacyにありうちに無し → legacy_count++)
    r.missing_elements.forEach(e => {
      if (!elemStats[e]) elemStats[e] = { element: e, legacy_count: 0, ours_count: 0, missing_slugs: [], missing_names: [] };
      elemStats[e].legacy_count++;
      elemStats[e].missing_slugs.push(r.slug);
      elemStats[e].missing_names.push(r.name);
    });
    // うち言及(=extraはうちにありlegacyに無し → ours_count++)
    r.extra_elements.forEach(e => {
      if (!elemStats[e]) elemStats[e] = { element: e, legacy_count: 0, ours_count: 0, missing_slugs: [], missing_names: [] };
      elemStats[e].ours_count++;
    });
  });

  return Object.values(elemStats)
    .filter(s => s.missing_slugs.length > 0)
    .sort((a, b) => b.missing_slugs.length - a.missing_slugs.length);
}

// ─── 過剰集計 ────────────────────────────────────────────────────
function calcExtra(results) {
  const extraStats = {};
  results.forEach(r => {
    r.extra_elements.forEach(e => {
      if (!extraStats[e]) extraStats[e] = { element: e, count: 0, names: [] };
      extraStats[e].count++;
      if (extraStats[e].names.length < 5) extraStats[e].names.push(r.name);
    });
  });
  return Object.values(extraStats).sort((a, b) => b.count - a.count);
}

// ─── 1ソース分析 ─────────────────────────────────────────────────
function runAudit(label, wazaMap) {
  const entries = Object.values(wazaMap);
  const total   = entries.length;
  let skipped   = 0;
  const results = [];

  entries.forEach(waza => {
    if (!waza.description_legacy) { skipped++; return; }
    results.push(analyzeOne(waza));
  });

  const hasMissing   = results.filter(r => r.has_missing).length;
  const consistency  = calcConsistency(results);
  const extraRanking = calcExtra(results);

  return {
    label,
    total,
    skipped,
    analyzed: results.length,
    has_missing_count: hasMissing,
    results,
    consistency_ranking: consistency,
    extra_ranking:       extraRanking,
  };
}

// ─── エントリポイント ─────────────────────────────────────────────
const report = { generated_at: new Date().toISOString(), sources: [] };

SOURCES.forEach(({ file, label }) => {
  if (!fs.existsSync(file)) {
    console.warn(`[skip] not found: ${file}`);
    return;
  }
  console.log(`\n=== Loading ${label} (${path.basename(file)}) ===`);
  const wm = loadWazaMap(file);
  if (!wm) { console.warn(`[skip] WAZA_MAP not found in ${file}`); return; }

  const audit = runAudit(label, wm);
  report.sources.push(audit);

  // ── コンソールサマリ ──
  console.log(`総技数: ${audit.total} | Legacy無しスキップ: ${audit.skipped} | 分析対象: ${audit.analyzed}`);
  console.log(`抜けのある技数: ${audit.has_missing_count} (${Math.round(audit.has_missing_count/audit.analyzed*100)}%)`);

  console.log('\n--- 統一感バラつき上位15要素 (抜け件数順) ---');
  audit.consistency_ranking.slice(0, 15).forEach((s, i) => {
    const examples = s.missing_names.slice(0, 3).join(' / ');
    const pct = s.legacy_count > 0 ? Math.round(s.missing_slugs.length / (s.legacy_count + s.ours_count) * 100) : '-';
    console.log(`  ${String(i+1).padStart(2)}. [${s.element}] 抜け:${s.missing_slugs.length} 例: ${examples}`);
  });

  console.log('\n--- 過剰(うちにあってlegacyに無し)上位5 ---');
  audit.extra_ranking.slice(0, 5).forEach((e, i) => {
    console.log(`  ${i+1}. [${e.element}] ${e.count}件 例: ${e.names.join(' / ')}`);
  });
});

// ─── 既知の偽陽性パターン(次の精緻化のための注記) ──────────────────
const KNOWN_FALSE_POSITIVES = [
  {
    element: 'HP半分回復',
    pattern: 'ステルスロック・まもる系: ダイマックス技/Zワザ貫通時の1/4ダメージが誤マッチ。「回復」文脈でなく「ダメージ」文脈',
  },
  {
    element: '確実効果(100%=必ず)_extra',
    pattern: 'ふぶき・かみなり: 天気条件付き必中(天気ゆき/あめのとき必ず命中)がCERTAINTY_EFFECTに誤マッチ。条件付きなのでlegacyには100%表記なし',
  },
  {
    element: '確実効果(100%=必ず)_extra',
    pattern: 'こころのめ・ロックオン: 「必ず命中する」が必中要素に加えてCERTAINTY_EFFECTにも誤マッチ',
  },
  {
    element: 'こおり付与',
    pattern: 'かえんぐるま・せいなるほのお: legacyの「自分がこおり状態でも使える。使うとこおりが治る」がこおり付与として誤検出。相手へのこおり付与ではない',
  },
  {
    element: 'パンチ系技_extra',
    pattern: 'ほのおのパンチ等: legacyに「パンチ系の技」記述が無いが、うちには書いてある。legacyが省略しているだけで情報追加は正当',
  },
  {
    element: '相手全体対象_extra',
    pattern: 'いとをはく・わたほうし等: legacyは「相手の〜」(単体想定)、うちは「相手全員の〜」と明示。情報追加は正当',
  },
  {
    element: 'hp_frac:最大HPノ1/4_extra',
    pattern: 'まもる・みきり等: 「ダイマックス技貫通時に最大HPの1/4のダメージを受ける」がHP 1/4回復として誤マッチ',
  },
  // P4.6 追加: 確実効果の残余偽陽性
  {
    element: '確実効果(100%=必ず)_legacy_必ず失敗',
    pattern: 'みちづれ: legacyが「連続で使うと必ず失敗する」(必ず+失敗)→CERTAINTY_EFFECT。うちは「続けて使うと失敗する」で同意味。主効果の確率ではないため許容偽陽性',
  },
  {
    element: '確実効果(100%=必ず)_legacy_効果付与100%',
    pattern: 'サイコノイズ: legacyが「100%の確率でかいふくふうじ状態にする」→CERTAINTY_EFFECT。うちは確率表記なしで同効果を書く。変化技の100%は省略慣例。',
  },
  // P4.6 追加: チャージ技でのP4.6偽陽性(CHARGE_TURNリプレースがCERTAINTY_EFFECTを含む部分を飲み込む)
  {
    element: '確実効果(100%=必ず)_charge_stat_boost',
    pattern: 'ロケットずつき/メテオビーム/エレクトロビーム: チャージターンに能力ランク上昇(100%=必ず)。legacyは「100%の確率で」と明記。うちは確率省略=同意味。CHARGE_TURNの正規化がP4.6のCERTAINTY_EFFECTトークンを飲み込む副作用で偽陽性になる。これらは意味的には一致している。',
  },
  {
    element: '確実効果(100%=必ず)_sappy_seed',
    pattern: 'すくすくボンバー: legacyが「100%の確率でやどりぎのタネを植え付け」→CERTAINTY_EFFECT。うちは「タネをうえつける」と省略=必ず成功する変化技の省略慣例。意味的には一致(失敗例が無い)。',
  },
];

// ─── JSON出力(全件・抜けありのみ詳細) ────────────────────────────
const outReport = {
  generated_at: report.generated_at,
  known_false_positives: KNOWN_FALSE_POSITIVES,
  sources: report.sources.map(src => ({
    label:               src.label,
    total:               src.total,
    skipped:             src.skipped,
    analyzed:            src.analyzed,
    has_missing_count:   src.has_missing_count,
    consistency_ranking: src.consistency_ranking.slice(0, 60),
    extra_ranking:       src.extra_ranking.slice(0, 20),
    missing_details:     src.results
      .filter(r => r.has_missing)
      .map(r => ({
        slug:             r.slug,
        name:             r.name,
        missing_elements: r.missing_elements,
        missing_quoted:   r.missing_quoted,
        extra_elements:   r.extra_elements,
        extra_quoted:     r.extra_quoted,
      })),
  })),
};

fs.writeFileSync(OUT_PATH, JSON.stringify(outReport, null, 2), 'utf8');
console.log(`\n✓ レポート出力: ${OUT_PATH}`);
