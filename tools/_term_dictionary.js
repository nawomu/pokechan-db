// 技のタグ・属性辞典を生成。フラグ(音/パンチ等)・属性(優先度/必中/みがわり貫通等)別に、
// 意味+該当技数+技例を一覧化。confirm pageと style 揃え。
// 出力: review/term_dictionary.html
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
const WAZA_MAP = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));

const moves = Object.values(WAZA_MAP);

// 各タグの「マッチ条件 → 説明文(compose の言い方)+例」
const ENTRIES = [
  // ────── 技フラグ(flags.*)──────
  { sec:'技フラグ', icon:'🔊', label:'音(おとぎ)系の技', match: m => m.flags && m.flags.sound,
    voice:'compose 末尾に「音系の技。」を後置。みがわりを貫通する性質も別途。',
    legacy_hint:'音の技は「みがわり」をすりぬける。「ぼうおん」特性で無効化される。' },
  { sec:'技フラグ', icon:'👊', label:'パンチ系の技', match: m => m.flags && m.flags.punch,
    voice:'compose 内で「特性『てつのこぶし』の時、威力1.2倍」など効果として説明される(タグ単独の文は出さない)。',
    legacy_hint:'特性「てつのこぶし」で威力1.2倍。特性「パンチング」のけん制対象。' },
  { sec:'技フラグ', icon:'🔵', label:'弾(たま)系の技', match: m => m.flags && (m.flags.bullet || m.flags.ball),
    voice:'compose 単独説明は無し(効果が別 kind で説明)。',
    legacy_hint:'特性「ぼうだん」で無効化される。' },
  { sec:'技フラグ', icon:'〰️', label:'波動(はどう)系の技', match: m => m.flags && m.flags.pulse,
    voice:'compose 単独説明は無し。',
    legacy_hint:'特性「メガランチャー」で威力1.5倍。' },
  { sec:'技フラグ', icon:'🌬️', label:'風(かぜ)系の技', match: m => m.flags && m.flags.wind,
    voice:'compose 単独説明は無し。',
    legacy_hint:'特性「かぜのり」で受けると こうげき+1。' },
  { sec:'技フラグ', icon:'🦷', label:'噛みつき(かみつき)系の技', match: m => m.flags && (m.flags.bite || m.flags.fang),
    voice:'compose 単独説明は無し。',
    legacy_hint:'特性「がんじょうあご」で威力1.5倍。' },
  { sec:'技フラグ', icon:'🌸', label:'粉(こな)系の技', match: m => m.flags && m.flags.powder,
    voice:'compose 末尾の bd.immune 一律訳で「『くさ』タイプには効かない」「特性『ぼうじん』のポケモンには効かない」「『ぼうじんゴーグル』を持つポケモンには効かない」が出る(該当技にはタグでなく immune データで実装)。',
    legacy_hint:'くさタイプ・特性「ぼうじん」・道具「ぼうじんゴーグル」に無効。' },
  { sec:'技フラグ', icon:'⏳', label:'溜め(2ターン技)', match: m => m.flags && m.flags.charge,
    voice:'compose の「2ターン目に攻撃」kind clause が「1ターン目に〜2ターン目に攻撃する」を喋る。半無敵化の技は当てられる技も明示。' },
  { sec:'技フラグ', icon:'🔁', label:'2ターン目動けない(反動硬直)', match: m => m.flags && m.flags.recharge,
    voice:'compose の「次のターン行動不能」kind clause が「使った次のターンは、動けなくなる」を喋る。' },
  { sec:'技フラグ', icon:'💀', label:'一撃必殺技', match: m => m.flags && m.flags.ohko,
    voice:'compose の「一撃必殺」kind が命中率や免疫(ゴースト等)を含めて喋る。' },

  // ────── 攻撃属性(battle_data 直下)──────
  { sec:'攻撃属性', icon:'⚡', label:'先制(優先度+N)', match: m => (m.battle_data && m.battle_data.priority || 0) > 0,
    voice:'compose 先頭に「優先度+1で、先に攻撃できる」等を前置。' },
  { sec:'攻撃属性', icon:'🐢', label:'後攻(優先度-N)', match: m => (m.battle_data && m.battle_data.priority || 0) < 0,
    voice:'compose 先頭に「優先度-3で、必ず後攻になる」等を前置。' },
  { sec:'攻撃属性', icon:'🎯', label:'必中(回避率・命中率無視)', match: m => m.battle_data && m.battle_data.must_hit === true,
    voice:'compose 末尾に「相手の回避率や自分の命中率に関係なく、必ず命中する。」を後置。' },
  { sec:'攻撃属性', icon:'💥', label:'必中急所', match: m => m.battle_data && m.battle_data.must_crit === true,
    voice:'compose 内の「急所率上昇」kind か「必ず急所」kind clause で「必ず急所に当たる」を喋る。' },
  { sec:'攻撃属性', icon:'🎯', label:'急所率上昇(急所+N)', match: m => m.battle_data && (m.battle_data.crit_stage || 0) >= 1,
    voice:'compose の「急所率上昇」kind clause が「急所+N」を喋る。連動技(ドラゴンエール等)で味方の急所を上げるものは target=ally で「味方の急所+N」。' },

  // ────── 守り・貫通系 ──────
  { sec:'守り貫通', icon:'👻', label:'みがわり貫通', match: m => m.battle_data && m.battle_data.substitute_pierce === true,
    voice:'compose 末尾に「相手の『みがわり』をすりぬけて当たる。」を後置。effect kind「みがわり貫通」を持つ技は本文で喋る場合あり。' },
  { sec:'守り貫通', icon:'🛡️', label:'まもり貫通(まもる無視)', match: m => {
    const eff = m.battle_data && m.battle_data.effects || [];
    return eff.some(e => e.kind === 'まもり貫通' && Array.isArray(e.pierces_without_removing));
  }, voice:'compose の「まもり貫通」kind clause が「相手が『まもる』などで守っていても、それを無視して当たる」を喋る。' },
  { sec:'守り貫通', icon:'🪬', label:'まもり解除(壊してから攻撃)', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === 'まもり解除'),
    voice:'compose の「まもり解除」kind clause が「相手の『まもる』などの守りをやぶってから攻撃する」を喋る。' },
  { sec:'守り貫通', icon:'❌', label:'守れない技にされる(まもり無効化対象)', match: m => m.protect === false,
    voice:'タグでは「守×」で表示。compose では明示説明なし(legacyにも「『まもる』では防げない」と書かれることが多い)。' },

  // ────── ダメージ周辺 ──────
  { sec:'ダメージ', icon:'💢', label:'反動ダメージ', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '反動'),
    voice:'compose の「反動」kind clause が「相手に与えたダメージのN分の1を、自分も受ける」を喋る。' },
  { sec:'ダメージ', icon:'💔', label:'失敗(外れ)時の自爆ダメージ', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '失敗ダメージ'),
    voice:'compose の「失敗ダメージ」kind clause が「外れると、自分が最大HPの半分ぶんダメージを受ける」等を喋る。' },
  { sec:'ダメージ', icon:'🩸', label:'吸収(与ダメの一部を回復)', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '吸収'),
    voice:'compose の「吸収」kind clause が「相手に与えたダメージの半分だけ、自分のHPを回復する」を喋る。' },
  { sec:'ダメージ', icon:'⚡', label:'連続攻撃技', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '連続攻撃'),
    voice:'compose の「連続攻撃」kind clause が「N回攻撃する」「2〜5回攻撃する」等を喋る。' },
  { sec:'ダメージ', icon:'🌀', label:'暴れ状態(2-3T同じ技+混乱)', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '暴れる(混乱)'),
    voice:'compose の「暴れる(混乱)」kind clause が「2〜3ターンの間、同じ技を出しつづけて、その後、自分が『こんらん』状態になる」を喋る。' },

  // ────── 拘束・交代 ──────
  { sec:'拘束・交代', icon:'🔗', label:'バインド(数ターン拘束+削り)', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '状態付与' && e.value === 'バインド'),
    voice:'compose の「状態付与(バインド)」分岐が「相手をバインド状態にして、4〜5ターンの間、毎ターン終わりに、最大HPの1/8だけダメージを与える」を喋る。' },
  { sec:'拘束・交代', icon:'🔄', label:'強制交代(吹き飛ばし系)', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '強制交代(吹き飛ばし)'),
    voice:'compose の「強制交代(吹き飛ばし)」kind clause が「相手をむりやり交代させる(出てくる相手はランダム)」を喋る。' },
  { sec:'拘束・交代', icon:'↩️', label:'自分交代(技後)', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '自分交代'),
    voice:'compose の「自分交代」kind clause が、攻撃技なら「攻撃したあと、控えのポケモンと交代する」、変化技なら「使ったあと、控えのポケモンと交代する」を喋る。' },
  { sec:'拘束・交代', icon:'🪤', label:'相手を交代できなくする', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '全員逃走不可'),
    voice:'compose の「全員逃走不可」kind clause が「相手は逃げたり交代したりできなくなる」を喋る。' },

  // ────── 場・設置 ──────
  { sec:'場・設置', icon:'🪨', label:'設置技(ハザード)', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '設置'),
    voice:'compose の「設置」kind clause が、技ごとに固有の説明を喋る(まきびし=交代で出てきたポケモンにダメージ、どくびし=どく状態など)。' },
  { sec:'場・設置', icon:'🧹', label:'設置技を消す技', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '設置除去' && Array.isArray(e.values)),
    voice:'compose の「設置除去」kind clause が「自分の場の『ステルスロック』『どくびし』『まきびし』『ねばねばネット』を消す」を喋る。' },
  { sec:'場・設置', icon:'🛡️', label:'壁(リフレクター系)', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '壁設置'),
    voice:'compose の「壁設置」kind clause が「Nターンの間、味方が受ける物理技/特殊技のダメージを半分にする(急所には効かない)」を喋る。状態異常予防の壁(しんぴのまもり)は別表現。' },
  { sec:'場・設置', icon:'☀️', label:'天候変化', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '天候変化'),
    voice:'compose の「天候変化」kind clause が「Nターンの間、天気を『X』にする」を喋る。' },
  { sec:'場・設置', icon:'🌿', label:'フィールド展開', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === 'フィールド展開'),
    voice:'compose の「フィールド展開」kind clause が「Nターンの間、場を『Xフィールド』にする」等を喋る。' },
  { sec:'場・設置', icon:'🌀', label:'部屋技(トリック/ワンダー/マジック)', match: m => (m.battle_data && m.battle_data.effects || []).some(e => ['部屋系','トリックルーム'].includes(e.kind)),
    voice:'compose の「部屋系」「トリックルーム」kind clause が固有説明を喋る(swap_stats でワンダー/マジックを区別)。' },

  // ────── 効果分類(状態異常・能力ランク・回復)──────
  { sec:'効果系', icon:'🩻', label:'状態付与(まひ/やけど/ねむり/どく等)', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '状態付与'),
    voice:'compose の「状態付与」kind clause が「N%の確率で相手を『X』状態にする」を喋る。タイプ免疫(粉技のくさ/ぼうじん等)は bd.immune 一律訳で追記。' },
  { sec:'効果系', icon:'😵', label:'ひるみ', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === 'ひるみ'),
    voice:'compose の「ひるみ」kind clause が「N%の確率で相手をひるませる」を喋る。' },
  { sec:'効果系', icon:'📊', label:'能力ランク変化', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '能力ランク変化'),
    voice:'compose の「能力ランク変化」kind clause が「こうげき+1、とくこう+1」等を喋る。±N表記で統一(2026-06-07確定)。' },
  { sec:'効果系', icon:'💚', label:'回復技', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '回復'),
    voice:'compose の「回復」kind clause が「自分のHPを、最大HPの半分だけ回復する」「相手の『こうげき』の実数値と同じだけ〜回復する」(構造化amount)等を喋る。' },
  { sec:'効果系', icon:'💊', label:'状態異常回復', match: m => (m.battle_data && m.battle_data.effects || []).some(e => e.kind === '状態異常回復'),
    voice:'compose の「状態異常回復」kind clause が target/value/values で「自分の『こおり』状態を解除する」「自分が受けている『うずしお』『...』の効果を解除する」等を喋り分け。' },

  // ────── 使用条件・失敗条件 ──────
  { sec:'使用条件', icon:'🍇', label:'「きのみ」を食べると使える(ゲップ)', match: m => (m.battle_data && m.battle_data.requires || []).some(r => r.type === 'user_has_eaten_berry'),
    voice:'compose 先頭に「『きのみ』を食べると、使えるようになる。」を前置。' },
  { sec:'使用条件', icon:'🏁', label:'出てきた最初のターンしか成功しない', match: m => (m.battle_data && m.battle_data.requires || []).some(r => r.type === 'first_turn_after_switch_in') || (m.battle_data && m.battle_data.fails_if || []).some(f => f.type === 'not_users_first_turn_on_field'),
    voice:'compose 内で「出てきた最初のターンしか成功しない」を末尾に前置 or 後置。' },
  { sec:'使用条件', icon:'📚', label:'覚えてる他の技を全部使うと使える(とっておき)', match: m => (m.battle_data && m.battle_data.requires || []).some(r => r.type === 'all_other_known_moves_used'),
    voice:'compose 先頭に「自分が覚えている他の技を全部使うと、使えるようになる。」を前置。' },
  { sec:'使用条件', icon:'💤', label:'特定の状態の時だけ使える(いびき=ねむり)', match: m => (m.battle_data && m.battle_data.requires || []).some(r => r.type === 'self_status'),
    voice:'compose 先頭に「自分が『X』状態の時だけ使える。」を前置。' },
  { sec:'使用条件', icon:'☀️', label:'特定の天気の時だけ使える', match: m => (m.battle_data && m.battle_data.requires || []).some(r => r.type === 'weather'),
    voice:'compose 先頭に「天気が『X』の時だけ使える。」を前置。' },
  { sec:'使用条件', icon:'❎', label:'すでに同じ状態だと失敗', match: m => (m.battle_data && m.battle_data.fails_if || []).some(f => f.type === 'user_already_in_state' || f.type === 'ally_already_in_state'),
    voice:'compose 末尾に「(自分がすでに『X』状態のときは失敗する)」「(味方がすでに『X』状態だと失敗する)」を後置。' },
  { sec:'使用条件', icon:'❎', label:'HPが少ないと失敗', match: m => (m.battle_data && m.battle_data.fails_if || []).some(f => f.type === 'current_hp_below_fraction'),
    voice:'compose 末尾に「(今のHPが最大HPのNより少ないと失敗する)」を後置。' },
];

// 各技の名前を集める(短縮版)
function matchList(entry) {
  return moves.filter(entry.match).map(m => m.name);
}

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

// セクション順序固定
const SECS = ['技フラグ', '攻撃属性', '守り貫通', 'ダメージ', '拘束・交代', '場・設置', '効果系', '使用条件'];

let body = '';
for (const sec of SECS) {
  const items = ENTRIES.filter(e => e.sec === sec);
  if (!items.length) continue;
  body += `<section class="sec"><h2>${esc(sec)}</h2>`;
  for (const e of items) {
    const list = matchList(e);
    const examples = list.slice(0, 12).map(esc).join('・');
    const more = list.length > 12 ? `<span class="more">…ほか${list.length - 12}技</span>` : '';
    body += `<div class="row">
  <div class="head"><span class="icon">${e.icon}</span><span class="label">${esc(e.label)}</span><span class="cnt">${list.length}技</span></div>
  <div class="voice"><b>compose の喋り方</b>: ${esc(e.voice)}</div>
  ${e.legacy_hint ? `<div class="hint"><b>背景(legacy/効果ヒント)</b>: ${esc(e.legacy_hint)}</div>` : ''}
  <div class="examples">${examples}${more ? ' ' + more : ''}</div>
</div>`;
  }
  body += `</section>`;
}

const html = `<!doctype html>
<html lang="ja"><meta charset="utf-8"><title>技のタグ・属性辞典</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN",sans-serif;background:#fafbfc;color:#1f2933;margin:0;padding:24px}
h1{margin:0 0 4px 0;font-size:22px}
.lead{color:#52606d;margin:0 0 24px 0;font-size:14px;line-height:1.6}
.toc{background:#fff;border:1px solid #e4e7eb;border-radius:6px;padding:12px 16px;margin-bottom:20px}
.toc a{display:inline-block;margin-right:10px;color:#3361c6;text-decoration:none;font-size:13px}
.toc a:hover{text-decoration:underline}
.sec{background:#fff;border:1px solid #e4e7eb;border-radius:8px;padding:16px 20px;margin-bottom:20px}
.sec h2{margin:0 0 12px 0;font-size:17px;border-bottom:2px solid #f0a429;padding-bottom:6px;color:#2c3e50}
.row{padding:12px 0;border-bottom:1px dashed #e4e7eb}
.row:last-child{border-bottom:none}
.head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.icon{font-size:18px}
.label{font-weight:bold;font-size:15px}
.cnt{margin-left:auto;background:#3b82f6;color:#fff;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:bold}
.voice{font-size:13px;color:#334155;background:#f1f5f9;padding:8px 12px;border-radius:4px;margin:4px 0;line-height:1.6}
.hint{font-size:12px;color:#475569;padding:6px 12px;margin:4px 0;line-height:1.6;border-left:3px solid #cbd5e1}
.examples{font-size:12px;color:#64748b;margin-top:6px;line-height:1.7}
.more{color:#94a3b8;font-style:italic}
b{color:#0f172a}
.meta{color:#64748b;font-size:12px;margin-top:30px}
</style>
<body>
<h1>技のタグ・属性辞典</h1>
<p class="lead">
「音技は何の効果?」「みがわり貫通ってどう説明されるの?」を、フラグ・属性・効果kind 別に一覧。
compose engine(<code>tools/_waza_compose.js</code>)がどう喋るかも併記。
全${moves.length}技から自動集計(生成: ${new Date().toISOString().slice(0,10)})。
</p>

<nav class="toc">
${SECS.map(s => `<a href="#sec-${esc(s)}">${esc(s)}</a>`).join('')}
</nav>

${body.replace(/<section class="sec">/g, (function(){let i=0;return ()=>`<section class="sec" id="sec-${esc(SECS[i++])}">`})())}

<p class="meta">
データ: <code>pokechan_data.js</code> / 生成器: <code>tools/_term_dictionary.js</code><br>
書き方の言葉ルール: <a href="rules.html">rules.html</a> / 効果kind別の意味照合: <a href="waza_list_confirm.html">waza_list_confirm.html</a>
</p>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'review/term_dictionary.html'), html);
console.log('生成: review/term_dictionary.html / セクション ' + SECS.length + ' / 全 ' + moves.length + ' 技');
