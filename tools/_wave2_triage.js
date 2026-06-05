/* Wave2 仕分け: 真のprose 32 + value内3 を A/B/C/D に。enum70=許可リスト(翻訳禁止)/formula4=D(機械仕様保持)。
 * 出力: review/waza_wave2_triage.html (確認用・データ未反映) */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const W = require(path.join(ROOT, 'review', '_wave2_prose.json'));

// prose: index→{b, ja, r?}  (b: A削除 / C日本語化 / D機械仕様保持)
const TP = {
  1:  { b:'C', ja:'あばれ終了時' },
  2:  { b:'C', ja:'あばれ終了後' },
  3:  { b:'C', ja:'地面にいるどくタイプが出てくると消える' },
  4:  { b:'C', ja:'相手が最後に使った技' },
  5:  { b:'C', ja:'あばれ終了後' },
  6:  { b:'C', ja:'あばれ終了後' },
  7:  { b:'C', ja:'すべての能力ランク' },
  8:  { b:'C', ja:'相手がダイマックスしていれば、ダイマックス前の姿をコピーする' },
  9:  { b:'C', ja:'減らしたHP(最大HPの1/4)と同じ' },
  10: { b:'C', ja:'HPが0になるまで、攻撃を肩代わりする' },
  11: { b:'C', ja:'自分がダイマックスすると消える' },
  12: { b:'C', ja:'効果が出る前に相手が交代すると消える' },
  13: { b:'C', ja:'相手が最後に使った技' },
  14: { b:'C', ja:'使った時に場にいた全員(自分も含む)' },
  15: { b:'A', ja:'', r:'kind「まもり」と重複' },
  16: { b:'C', ja:'ふつうより速い(先制)技。特性による先制も含む' },
  17: { b:'C', ja:'対象が交代すると、そのポケモンのカウントは消える' },
  18: { b:'C', ja:'その技のPPが0になると終わる' },
  19: { b:'C', ja:'ダイマックス時は元のHPで平均を出し、差分を今のHPに反映' },
  20: { b:'C', ja:'ダブルでは、最後に受けた特殊技だけが対象' },
  21: { b:'C', ja:'そのターンに自分にダメージを与えた最後の技' },
  22: { b:'C', ja:'はたきおとすで自分の道具が無効化されている時' },
  23: { b:'C', ja:'バトルで効果のあるきのみ' },
  24: { b:'C', ja:'最後に自分を攻撃してきた相手' },
  25: { b:'C', ja:'持っている道具で決まる' },
  26: { b:'C', ja:'効果中にもう一度使うと解除される' },
  27: { b:'C', ja:'ダブルバトルで味方に使うための技' },
  28: { b:'C', ja:'物理と特殊のダメージを比べて、高い方で攻撃する' },
  29: { b:'C', ja:'相手が最後に使った技' },
  30: { b:'C', ja:'こおりタイプのぼうぎょが1.5倍になる' },
  31: { b:'C', ja:'こおりタイプのぼうぎょが1.5倍になる' },
  32: { b:'C', ja:'そのターンに最後にダメージを与えてきた相手' },
};
// value内ロングプロセ
const TV = {
  1: { b:'A', ja:'', r:'kind「木の実強制」が言っている→value削除(状態名でなく説明の誤用)' },
  2: { b:'C', ja:'空中にいる状態(そらをとぶ/とびはねる/フリーフォール)を中断し、落として命中させる' },
  3: { b:'C', ja:'接地状態にする(じめん技が当たり、ふゆう・ひこうの地面無効を無視)' },
};

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
const COL = { A:'#ff7b72', C:'#7ee787', D:'#79c0ff' };
const tally = { A:0, C:0 };
Object.values(TP).forEach(t=>tally[t.b]=(tally[t.b]||0)+1);
Object.values(TV).forEach(t=>tally[t.b]=(tally[t.b]||0)+1);

let html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wave2 prose 仕分け</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:12.5px}
 header{padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d;position:sticky;top:0;z-index:6}
 h1{font-size:15px;margin:0} .sub{font-size:11px;color:#9aa7b4;margin-top:4px;line-height:1.7}
 .pill{display:inline-block;border-radius:4px;padding:1px 8px;font-weight:700;margin-right:4px}
 .pA{background:#3a1d1b;color:#ff7b72} .pC{background:#13301b;color:#7ee787} .pD{background:#16263b;color:#79c0ff} .pE{background:#21262d;color:#9aa7b4}
 h2{font-size:13px;color:#d2a8ff;margin:16px 16px 4px}
 table{border-collapse:collapse;width:100%} thead th{background:#21262d;color:#9aa7b4;font-size:11px;padding:7px;border-bottom:2px solid #30363d;text-align:left}
 td{padding:7px 9px;border-bottom:1px solid #1c2128;vertical-align:top}
 .n{color:#6e7681;text-align:right} .mv{color:#d2a8ff;font-weight:700;white-space:nowrap}
 .kd{color:#9aa7b4;font-size:11px} .fld{color:#e3b341;font-family:ui-monospace,monospace;font-size:10.5px}
 .en{color:#ff9a92;font-family:ui-monospace,monospace;font-size:10.5px;max-width:330px;line-height:1.45}
 .ja{min-width:280px;line-height:1.55;color:#7ee787} .bk{font-weight:700;text-align:center} .rzn{color:#9aa7b4;font-size:11px}
 tbody tr:hover td{background:#161b22}
</style></head><body>
<header><h1>🗂️ Wave 2 prose 仕分け — 英語フリーテキスト全廃の最終波</h1>
<div class="sub">
 真のprose <b>${Object.keys(TP).length + Object.keys(TV).length}件</b>のみ翻訳対象 →
 <span class="pill pA">A削除 ${tally.A||0}</span><span class="pill pC">C日本語化 ${tally.C||0}</span>
 <span class="pill pD">D 機械仕様で保持 ${W.formula.length}(formula数式)</span>
 <span class="pill pE">enum語彙 ${W.enumKeys.length}キー=翻訳禁止(許可リスト)</span><br>
 ※enum(copies:species 等)とformula(数式)は<b>翻訳するとスキーマ/i18nを壊す</b>ので対象外。これで全proseフィールド英語0に到達。
</div></header>
<h2>① prose(キー値・32件)</h2>
<table><thead><tr><th class="n">#</th><th>技</th><th>kind</th><th>field</th><th>現(英語)</th><th>日本語訳案</th><th>判定</th></tr></thead><tbody>`;
W.prose.forEach((o,i)=>{ const t=TP[i+1]||{};
  html += `<tr><td class="n">${i+1}</td><td class="mv">${esc(o.move)}</td><td class="kd">${esc(o.kind)}</td><td class="fld">${esc(o.key)}</td>
   <td class="en">${esc(o.v)}</td><td class="ja">${esc(t.ja||'')||'<span style="color:#586069">—(削除)</span>'}</td>
   <td class="bk" style="color:${COL[t.b]}">${t.b||'?'}${t.r?`<br><span style="font-size:10px;color:#9aa7b4;font-weight:400">${esc(t.r)}</span>`:''}</td></tr>`;
});
html += `</tbody></table><h2>② value内ロングプロセ(3件)</h2>
<table><thead><tr><th class="n">#</th><th>技</th><th>kind</th><th>現(英語)</th><th>日本語訳案</th><th>判定</th></tr></thead><tbody>`;
W.valueProse.forEach((o,i)=>{ const t=TV[i+1]||{};
  html += `<tr><td class="n">V${i+1}</td><td class="mv">${esc(o.move)}</td><td class="kd">${esc(o.kind)}</td>
   <td class="en">${esc(o.v)}</td><td class="ja">${esc(t.ja||'')||'<span style="color:#586069">—(削除)</span>'}</td>
   <td class="bk" style="color:${COL[t.b]}">${t.b||'?'}${t.r?`<br><span style="font-size:10px;color:#9aa7b4;font-weight:400">${esc(t.r)}</span>`:''}</td></tr>`;
});
html += `</tbody></table><h2>③ D: formula 数式(翻訳せず保持)</h2>
<table><thead><tr><th>技</th><th>formula</th></tr></thead><tbody>`;
W.formula.forEach(o=>{ html += `<tr><td class="mv">${esc(o.move)}</td><td class="en" style="color:#79c0ff">${esc(o.v)}</td></tr>`; });
html += `</tbody></table></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_wave2_triage.html'), html);
fs.writeFileSync(path.join(ROOT, 'review', '_wave2_triage.json'), JSON.stringify({ prose:TP, value:TV }, null, 1));
console.log(`生成: review/waza_wave2_triage.html / prose A${tally.A||0}+C${tally.C||0} / value 3 / formula(D) ${W.formula.length} / enum許可 ${W.enumKeys.length}キー`);
