/** 言葉のルール一覧HTML。台帳(ヤックン耳_判断ログ.md)の「★★そのまま書く」「言葉のルール」を阿部さんが見返せる一枚に。
 * 実行: node tools/_kotoba_rules.js  → review/kotoba_rules.html
 * ※ルール本体のSSOTは台帳。ここは見やすくまとめた表示。変更は台帳と両方直す。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

// 大原則
const PRINCIPLE = {
  title: 'そのまま書く(最優先)',
  body: '説明文は <b>構造データ(effects)の中身を、そのまま・言葉通りに</b> 日本語にする。アレンジ・ひねり・まとめ・省略・やさしく崩す・AIの変な加工は <b>全部しない</b>。子どもに分からなくても、まず事実をそのまま伝える。<b>「やさしい子ども口調」より忠実が優先</b>(softening が事実をぼかすなら忠実を採る)。「直訳」=データの逐語訳であって、子ども向けの作文・要約ではない。',
};

// ルール(✗→✓)
const RULES = [
  { rule: '日本語がベース・正確で標準的な日本語', detail: '日本の会社の製品。公式準拠の用語・適切な漢字で。英語は英語のままでよい。', ng: '', ok: '' },
  { rule: '公式データ(全ひらがな・幼稚)に寄せない', detail: '一般的な日本語表現にする。', ng: 'きゅうしょにあたりやすい', ok: '急所ランクがひとつ上がる' },
  { rule: '事実をそのまま(解釈・softening禁止)', detail: 'データの意味を勝手に言い換えない。', ng: '急所に当たりやすい', ok: '急所ランクがひとつ上がる' },
  { rule: '助数詞は和語数詞', detail: 'ランクの増減は「ひとつ・ふたつ・みっつ…」。「1個」にしない。', ng: '急所ランクが1個上がる', ok: '急所ランクがひとつ上がる' },
  { rule: '数値はそのまま', detail: '確率などの数字は崩さない。', ng: '10回に1回くらい', ok: '10%の確率で' },
  { rule: 'ヤックンとそっくり同一は避ける', detail: '必須でないが望ましい。忠実に訳した結果のbare一致(自然な収束)は可。なるべく被らせない。', ng: '', ok: '' },
  { rule: '機械語を出さない', detail: 'true / 0.125 / 英語 / キー名 をそのまま出力に出さない(部品→日本語に)。', ng: 'until_user_leaves', ok: '自分が場を離れるまで' },
];

// 実例(忠実訳)
const SAMPLES = [
  ['クラブハンマー', '急所率上昇 stages:1', '急所ランクがひとつ上がる。'],
  ['こおりのいぶき', '急所率上昇 always_crit', '必ず急所に当たる。'],
  ['10まんボルト', '状態付与 まひ prob:10', '10%の確率で相手を『まひ』状態にする。'],
  ['クロスポイズン', '急所+1 / どく prob:10', '急所ランクがひとつ上がる。10%の確率で相手を『どく』状態にする。'],
  ['いわなだれ', '状態付与 ひるみ prob:30', '30%の確率で相手を『ひるみ』状態にする。'],
];

// 未確定(★耳待ち)
const PENDING = [
  '状態名の <b>『』囲み</b>(『まひ』 か まひ か)',
  '<b>カテゴリ名</b>(effect.kind を頭にラベル付けする案。呼び名・形は未確定)',
  '複数効果の <b>節の順番</b>(legacy自体が一定でないので機械ルール化できない)',
];

const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const ruleRows = RULES.map(r => `<tr>
  <td class="rname">${r.rule}<div class="rd">${r.detail}</div></td>
  <td class="ng">${r.ng ? '✗ ' + esc(r.ng) : '<span class="dash">—</span>'}</td>
  <td class="ok">${r.ok ? '✓ ' + esc(r.ok) : '<span class="dash">—</span>'}</td>
</tr>`).join('');

const sampleRows = SAMPLES.map(([nm, data, out]) => `<tr>
  <td class="mv">${esc(nm)}</td><td class="src">${esc(data)}</td><td class="out">${esc(out)}</td>
</tr>`).join('');

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>言葉のルール一覧 — ポケモンDB 技説明文</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:16px;line-height:1.85}
 .wrap{max-width:920px;margin:0 auto;padding:0 18px 60px}
 header{padding:18px;background:#161b22;border-bottom:1px solid #30363d;margin-bottom:8px}
 h1{font-size:21px;margin:0} .date{color:#6e7681;font-size:12.5px;margin-top:6px}
 h2{font-size:17px;margin:30px 0 12px;padding-bottom:7px;border-bottom:1px solid #30363d;color:#d2a8ff}
 .principle{background:#11201a;border:1px solid #1b3a24;border-left:4px solid #2ea043;border-radius:8px;padding:15px 17px;font-size:15.5px}
 .principle b{color:#7ee787}
 table{border-collapse:collapse;width:100%;margin-top:6px} th{background:#21262d;color:#9aa7b4;font-size:13px;padding:9px 11px;text-align:left;border-bottom:2px solid #30363d}
 td{padding:11px;border-bottom:1px solid #1c2128;vertical-align:top}
 .rname{font-weight:700;color:#e6edf3;min-width:240px} .rd{font-weight:400;color:#9aa7b4;font-size:13px;margin-top:4px}
 .ng{color:#ff7b72;font-size:14.5px;min-width:170px} .ok{color:#7ee787;font-size:14.5px;min-width:200px} .dash{color:#444c56}
 .mv{color:#d2a8ff;font-weight:700;white-space:nowrap} .src{color:#79c0ff;font-family:ui-monospace,monospace;font-size:12.5px} .out{color:#7ee787;font-size:15.5px}
 ul.pend{list-style:none;padding:0} ul.pend li{background:#1d1a0f;border-left:3px solid #d29922;border-radius:6px;padding:9px 13px;margin-bottom:8px;color:#ffd479;font-size:14.5px}
 .note{color:#6e7681;font-size:12.5px;margin-top:8px}
</style></head><body>
<header><div class="wrap" style="padding-bottom:0"><h1>📋 言葉のルール一覧 — 技説明文</h1>
<div class="date">ポケモンDB / 2026-06-06 阿部さん確定分。SSOT=ヤックン耳_判断ログ.md(本表はその見やすいまとめ)</div></div></header>
<div class="wrap">

<h2>大原則</h2>
<div class="principle"><b>${PRINCIPLE.title}</b><br>${PRINCIPLE.body}</div>

<h2>言葉のルール(✗ → ✓)</h2>
<table><thead><tr><th>ルール</th><th>✗ しない</th><th>✓ する</th></tr></thead><tbody>${ruleRows}</tbody></table>

<h2>実例(データ → そのまま忠実に訳す)</h2>
<table><thead><tr><th>技</th><th>元データ(effects)</th><th>説明文(忠実訳)</th></tr></thead><tbody>${sampleRows}</tbody></table>
<div class="note">※確率・状態名はデータのまま。急所率上昇 stages:1 →「急所ランクがひとつ上がる」(解釈しない)。</div>

<h2>★ まだ決めていない(阿部さんの耳待ち)</h2>
<ul class="pend">${PENDING.map(p => `<li>${p}</li>`).join('')}</ul>

</div></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'kotoba_rules.html'), html);
console.log('生成: review/kotoba_rules.html');
