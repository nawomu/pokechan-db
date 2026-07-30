#!/usr/bin/env node
/* tools/_build_ai_spec.js — ★AIの仕組み仕様書(自動生成)
 *
 * 目的(2026-07-29 阿部さん):「AIのロジックも仕様書に、俺が見れるようにHTMLでページを追加しといて」
 *
 * ★中身は必ず「生成」する。**数字(重み・しきい値)と行番号はエンジンのソースから直接抜く**ので、
 *   コードを変えたらこのページも自動で追随する(手書きだとページが嘘になる)。
 *   抜き出しに失敗したら「★抽出できず」と赤で出す=腐ったことが見える。
 *
 * 出力: review/AIの仕組み.html
 * 実行: node tools/_build_ai_spec.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'real_battle_simulator.html');
const OUT = path.join(ROOT, 'review/AIの仕組み.html');

const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split('\n');
const lineOf = (re) => { const i = lines.findIndex(l => re.test(l)); return i < 0 ? null : i + 1; };

// ── 関数本体を切り出す ────────────────────────────────────────────
function grabFn(name) {
  const start = lines.findIndex(l => new RegExp('function\\s+' + name + '\\s*\\(').test(l));
  if (start < 0) return null;
  let depth = 0, started = false, out = [];
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    out.push(l);
    for (const ch of l) { if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--; }
    if (started && depth <= 0) break;
    if (out.length > 200) break;
  }
  return { line: start + 1, code: out.join('\n') };
}

// ── 実際の数字をソースから抜く(★ここが命。手書きしない) ──────────
function pick(re, label) {
  const m = src.match(re);
  return m ? m[1] : null;
}
const N = {
  koBonus:       pick(/score \+= (\d+);\s*\/\/ 確定で倒せる技を最優先/),
  healWeight:    pick(/\(myMax - myHp\) \* ([\d.]+)/),
  statusWeight:  pick(/foeHp \* ([\d.]+)/),
  boostBase:     pick(/score = Math\.max\(score, (\d+) \+ \(e\.stages/),
  boostPer:      pick(/\+ \(e\.stages \|\| 1\) \* (\d+)\)/),
  transform:     pick(/canTransformInto\(st, foeSt\)\) score = Math\.max\(score, (\d+)\)/),
  boostHpGate:   pick(/myHp \* (\d+) >= myMax \* (\d+)/),
  boostRankGate: pick(/cur < (\d+)\) score/),
};
const FN = {
  score:  grabFn('aiScoreMove'),
  move:   grabFn('aiChooseMove'),
  action: grabFn('aiChooseAction'),
};
// AIが「選ばない」ゲート(不発確定)の一覧をコメントから拾う
const gates = [...src.matchAll(/^\s*\/\/ (requires [^\n]+|ねこだまし[^\n]+|たくわえ依存[^\n]+|fails_if[^\n]+|遅延攻撃[^\n]+)$/gm)].map(m => m[1]);

const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = (v, unit) => v == null ? '<span class="bad">★抽出できず(コードが変わった?)</span>' : `<b>${esc(v)}${unit || ''}</b>`;

const H = [];
H.push(`<meta charset="utf-8"><title>AIの仕組み — PchamDB</title>
<meta name="robots" content="noindex,nofollow,noarchive">
<style>
body{font-family:-apple-system,"Hiragino Sans",sans-serif;margin:0;background:#f6f7f9;color:#1c1e22;line-height:1.75}
.wrap{max-width:1000px;margin:0 auto;padding:26px 20px 90px}
h1{border-bottom:4px solid #3a6ea5;padding-bottom:8px}
h2{margin-top:34px;background:#fff;padding:10px 14px;border-left:8px solid #3a6ea5;border-radius:0 6px 6px 0}
h3{margin-top:22px;font-size:15px;color:#345}
table{border-collapse:collapse;width:100%;background:#fff;margin:10px 0;font-size:14px}
th,td{border:1px solid #dcdee3;padding:7px 10px;vertical-align:top;text-align:left}
th{background:#eef1f6}
code{background:#eef0f3;padding:1px 5px;border-radius:3px;font-size:13px}
pre{background:#1e2229;color:#e6e6e6;padding:14px;border-radius:8px;overflow:auto;font-size:12px;line-height:1.55;max-height:420px}
.bad{color:#c00;font-weight:bold}
.note{background:#fffbe6;border:1px solid #e8d48b;padding:12px 16px;border-radius:8px;font-size:13px}
.big{font-size:15px}
details{background:#fff;border:1px solid #dcdee3;border-radius:8px;padding:10px 14px;margin:10px 0}
summary{cursor:pointer;font-weight:bold;color:#3a6ea5}
</style><div class="wrap">`);

H.push(`<h1>AIの仕組み(自動生成)</h1>
<p>生成 ${new Date().toISOString().slice(0, 19)} JST ／ <code>node tools/_build_ai_spec.js</code> で再生成<br>
出どころ=<code>real_battle_simulator.html</code>(<code>aiScoreMove</code> L${FN.score ? FN.score.line : '?'} / <code>aiChooseMove</code> L${FN.move ? FN.move.line : '?'} / <code>aiChooseAction</code> L${FN.action ? FN.action.line : '?'})</p>
<div class="note">★<b>数字と行番号はコードから直接抜いています</b>。コードを変えればこのページも自動で変わります。<br>
もし「★抽出できず」と赤で出たら、<b>コードの書き方が変わってこのページが追随できなくなったサイン</b>です(生成器 <code>tools/_build_ai_spec.js</code> の修正が必要)。</div>`);

H.push(`<h2>0. ひとことで言うと</h2>
<p class="big"><b>「1手先だけを見て、それぞれの技に点数をつけて、一番高い手を選ぶ」自動プレイヤー</b>です。<br>
機械学習ではありません。<b>ルールと点数表</b>で動いています。深い読み(2手先・詰め・交代読み)はしていません。</p>`);

H.push(`<h2>1. 技の点数のつけ方(aiScoreMove)</h2>
<h3>攻撃技</h3>
<table><tr><th>項目</th><th>点数</th></tr>
<tr><td>基本</td><td>予想ダメージの<b>平均</b>(最小と最大の真ん中)</td></tr>
<tr><td><b>確実に倒せる</b>(最小ダメージ ≥ 相手の残HP)</td><td>${num(N.koBonus)} 点を加算 → <b>実質いちばん優先</b></td></tr>
<tr><td>ダメージが通らない(こうかなし・0ダメージ)</td><td>0点(選ばない)</td></tr></table>

<h3>変化技(「何点の価値があるか」を見積もる)</h3>
<table><tr><th>技の種類</th><th>点数の見積もり</th><th>意味</th></tr>
<tr><td>回復技(自分)</td><td>(最大HP − 今のHP) × ${num(N.healWeight)}</td><td>減っているほど価値が高い。<b>満タンならほぼ0点=無駄撃ちしない</b></td></tr>
<tr><td>状態異常技(相手)</td><td>相手の残HP × ${num(N.statusWeight)}</td><td>相手が<b>すでに状態異常</b>/<b>効かない</b>なら0点</td></tr>
<tr><td>積み技(自分の能力を上げる)</td><td>${num(N.boostBase)} + 段階 × ${num(N.boostPer)}</td><td>条件つき: <b>自分のHPが ${num(N.boostHpGate)}分の2以上</b> かつ <b>まだ +${num(N.boostRankGate)} 未満</b> の時だけ</td></tr>
<tr><td>へんしん(メタモン)</td><td>${num(N.transform)}</td><td>使える状況なら高め(使わないと他にやることがない)</td></tr>
<tr><td>上記以外の変化技</td><td>1(最低点)</td><td>攻撃が全部通らない時だけ流れてくる保険</td></tr></table>`);

H.push(`<h2>2. 「撃っても無駄な技」は最初から選ばない</h2>
<p>実プレイで「AIが無駄撃ちを繰り返す」のを見て足された除外ルールです(コードにも日付と経緯が残っています)。</p>
<ul>
<li><b>PP切れの技</b>は選ばない</li>
<li><b>こだわりロック中</b>は、その技しか選べない</li>
<li><b>不発が確定している技</b>は選ばない:
<ul>${gates.length ? gates.map(g => `<li>${esc(g)}</li>`).join('') : '<li class="bad">★抽出できず</li>'}</ul></li>
</ul>`);

H.push(`<h2>3. 交代の判断(aiChooseAction)</h2>
<table><tr><th>場面</th><th>条件</th><th>行き先</th></tr>
<tr><td><b>A</b> 手詰まり</td><td>どの技にも価値が無い(全部こうかなし等)</td><td>相手に<b>一番タイプ相性の良い控え</b></td></tr>
<tr><td><b>B</b> 受け交代</td><td><b>相手の最大平均ダメージ ≥ 自分の残HP</b> かつ <b>自分が後攻</b> かつ <b>確定KOで倒し返せない</b></td><td>相手の技を<b>一番安く受けられる控え</b>(最良で半減以下)</td></tr>
</table>
<p>★<b>連続では交代しません</b>(<code>aiSwitchedLast</code> で往復ループを防止)。<br>
★<b>確定KOできる技があるときは、交代せず必ず攻撃</b>します(点数 ${num(N.koBonus)} 以上が最優先のため)。</p>`);

H.push(`<h2>4. AIが見てよい情報</h2>
<p>コードのコメントに明記されています: <b>「AIはsim内の情報(相手の技)を見てよい設計」</b>。<br>
つまり <b>AIは相手の持っている技を知っています</b>(いわゆるカンニングあり)。<br>
また、相手側AIは<b>プレイヤーの行動が確定してから</b>選ぶので、<b>ふいうち系(相手が攻撃技かどうかで成否が変わる技)の判定も正確</b>になります。</p>`);

H.push(`<h2>5. 分かっている限界(今後の改善候補)</h2>
<ul>
<li><b>1手先しか見ない</b>。2手先の読み・詰め・交代読みはしない</li>
<li>変化技の価値は<b>ざっくりした見積もり</b>(壁・追い風・設置技などは「1点」の保険に流れることがある)</li>
<li>点数づけが<b>エンジン本体に直書き</b>されている → ③バトル作り直しで<b>フェーズと同じように「どこで何を判断しているか」を見える形</b>にできる</li>
<li>★<b>フェーズ・ビューア(1フェーズずつ止めて見る画面)</b>を作れば、<b>AIが各技に何点つけたか</b>も一緒に表示できる</li>
</ul>`);

for (const [k, label] of [['score', 'aiScoreMove(技の点数)'], ['move', 'aiChooseMove(技を選ぶ)'], ['action', 'aiChooseAction(技か交代か)']]) {
  if (!FN[k]) { H.push(`<details><summary>${label} — <span class="bad">★抽出できず</span></summary></details>`); continue; }
  H.push(`<details><summary>${label} の実際のコードを見る(L${FN[k].line}〜)</summary><pre>${esc(FN[k].code)}</pre></details>`);
}

H.push(`</div>\n<script src="../internal_home.js?v=20260729a"></script>`);
fs.writeFileSync(OUT, H.join('\n'));
console.log('生成:', path.relative(ROOT, OUT));
console.log('  抜き出した数字:', JSON.stringify(N));
console.log('  関数の行:', Object.fromEntries(Object.entries(FN).map(([k, v]) => [k, v ? v.line : null])));
console.log('  不発ゲート:', gates.length, '件');
