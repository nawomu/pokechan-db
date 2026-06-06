/** 「そのまま忠実」版の確認HTML。データ(effects)を言葉通りに訳す(アレンジ・softening・要約・AI加工なし)。
 * 『』囲む/囲まないの2列を並べ、ヤックンを右端に意味参照として置く。
 * 実行: node tools/_waza_style_try.js  → review/waza_style_try.html
 * 方針: ヤックン耳_判断ログ.md「★★そのまま書く」/ HANDOFF §7。カテゴリ・節順番は未確定なので入れない。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { map } = require('./_waza_compose.js');
const byName = {}; for (const m of Object.values(map)) byName[m.name] = m;
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// 和語数詞(阿部さんルール: ランクの増減は「ひとつ」式・「1個」にしない)
const KAZU = { 1: 'ひとつ', 2: 'ふたつ', 3: 'みっつ', 4: 'よっつ', 5: 'いつつ', 6: 'むっつ' };
const kazu = n => KAZU[Math.abs(n)] || `${Math.abs(n)}個`;
// 1 effect を「そのまま忠実」に訳す。kakomi=true で状態名を『』で囲む。
function clause(e, kakomi) {
  if (e.kind === '急所率上昇') {
    if (e.always_crit) return '必ず急所に当たる';
    return `急所ランクが${kazu(e.stages)}上がる`;
  }
  if (e.kind === '状態付与') {
    const name = kakomi ? `『${e.value}』` : e.value;
    const pre = (e.prob != null && e.prob < 100) ? `${e.prob}%の確率で` : '';
    return `${pre}相手を${name}状態にする`;
  }
  return null; // この試作の対象外kind
}
function render(m, kakomi) {
  const parts = ((m.battle_data || {}).effects || []).map(e => clause(e, kakomi)).filter(Boolean);
  return parts.join('。') + (parts.length ? '。' : '');
}

const MOVES = ['クラブハンマー', 'こおりのいぶき', '10まんボルト', 'かえんほうしゃ', 'クロスポイズン', 'いわなだれ', 'どくどくのキバ', 'みずのはどう'];
const rows = MOVES.map(nm => {
  const m = byName[nm]; if (!m) return `<tr><td>${esc(nm)}(なし)</td></tr>`;
  const src = ((m.battle_data || {}).effects || []).map(e => esc(JSON.stringify(e))).join('\n');
  return `<tr>
   <td class="mv">${esc(m.name)}<div class="meta">${esc(m.type)}・${esc(m.category)}</div></td>
   <td class="src">${src}</td>
   <td class="k1">${esc(render(m, true))}</td>
   <td class="k2">${esc(render(m, false))}</td>
   <td class="leg">${esc(m.description_legacy || '')}</td>
  </tr>`;
}).join('');

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>そのまま忠実版 — 阿部さんの耳へ</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:16px;line-height:1.8}
 header{padding:14px 20px;background:#161b22;border-bottom:1px solid #30363d}
 h1{font-size:20px;margin:0} .lead{font-size:13.5px;color:#9aa7b4;margin-top:8px;max-width:1000px}
 table{border-collapse:collapse;width:100%} th{background:#21262d;color:#cdd6e0;font-size:13.5px;padding:10px;text-align:left;border-bottom:2px solid #30363d;position:sticky;top:0}
 td{padding:13px;border-bottom:1px solid #1c2128;vertical-align:top;font-size:16px}
 .mv{color:#d2a8ff;font-weight:700;white-space:nowrap} .meta{color:#6e7681;font-size:12px;font-weight:400;margin-top:4px}
 .src{color:#79c0ff;font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;max-width:300px;white-space:pre-wrap;word-break:break-all}
 .k1{color:#7ee787;min-width:280px;font-weight:500} .k2{color:#7ee787;min-width:280px;font-weight:500}
 .leg{color:#e6edf3;min-width:240px;font-size:15px;border-left:3px solid #30363d;padding-left:13px}
 th.k1,th.k2{color:#7ee787} tr:hover td{background:#161b22}
</style></head><body>
<header><h1>📝 そのまま忠実版 — データを言葉通りに訳す</h1>
<div class="lead"><b style="color:#7ee787">緑=データ(effects)をそのまま忠実に訳した文</b>(アレンジ・softening・要約・AI加工なし)。左の緑=状態名を<b>『』で囲む</b>／右の緑=<b>囲まない</b>。右端の <b>ヤックン</b>は<b>意味が戻るかの参照だけ</b>(声を寄せる相手ではない)。<br><b>急所率上昇 stages:1 → 「急所ランクがひとつ上がる」</b>(解釈・softeningしない・和語数詞)。確率は「10%」のまま。<br>見るポイント: ①このまま忠実でOKか ②『』で囲む/囲まない どちらか。<b>カテゴリ・節の順番は未確定なので今回は入れていません。</b></div></header>
<table><thead><tr><th>技</th><th>元データ(effects)</th><th class="k1">忠実『』囲む</th><th class="k2">忠実 囲まない</th><th>ヤックン(参照=意味だけ)</th></tr></thead>
<tbody>${rows}</tbody></table>
<footer style="padding:18px 20px;color:#6e7681;font-size:12px">試作 _waza_style_try.js。本番=無変更。</footer>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_style_try.html'), html);
console.log('生成: review/waza_style_try.html /', MOVES.length, '技');
