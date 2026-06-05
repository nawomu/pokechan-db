/* effect フィールド45件の仕分け(note と同形式)。A=kindと重複→削除 / C=唯一の機構説明→訳して保持。
 * effect は現状どのビューにも非表示=データ衛生の問題。出力: review/waza_effect_triage.html */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ctx = require(path.join(ROOT, 'review', '_effect_ctx.json'));

// index(1始まり) → { b, r:理由, ja?:C時の訳, flag? }
const T = {
  1:  { b:'A', r:'kind「一撃必殺」と重複(相性無視のニュアンスのみ)' },
  2:  { b:'A', r:'kind「一撃必殺」と重複' },
  3:  { b:'A', r:'kind「暴れる(混乱)」が言っている' },
  4:  { b:'A', r:'kind「暴れる(混乱)」が言っている' },
  5:  { b:'C', r:'「ちいさくなる中は特定技が必中+2倍」=唯一の機構説明', ja:'『ちいさくなる』状態の間、決まった技(ふみつけ など)は必ず当たり、ダメージが2倍になる', flag:'構造化候補' },
  6:  { b:'C', r:'kind「能力ランク変化」では"全員0に戻す"が出ない', ja:'場にいる全員の能力ランクの変化を、すべて0に戻す' },
  7:  { b:'A', r:'value「きゅうしょアップ」が言っている' },
  8:  { b:'C', r:'kind=技名ラベル。道連れの機構はeffectだけ', ja:'自分が次に行動する前に相手の技でひんしになったら、その相手も道連れでひんしになる' },
  9:  { b:'C', r:'kind=技名ラベル。滅びカウントの機構はeffectだけ', ja:'使った時に場にいた全員が、3ターン後にひんしになる(カウント 3→2→1→ひんし)' },
  10: { b:'A', r:'kind「まもり」と重複' },
  11: { b:'C', r:'kind=技名ラベル。必中化の機構はeffectだけ', ja:'次にこの相手に使う技が、必ず当たる' },
  12: { b:'A', r:'kind「暴れる(混乱)」が言っている' },
  13: { b:'C', r:'「毎ターン50%行動不能」の数値がkindに無い', ja:'毎ターン50%の確率で、相手が行動できなくなる', flag:'構造化候補(prob)' },
  14: { b:'C', r:'value「しんぴのまもり」だけでは機構不明', ja:'自分と味方が、状態異常やこんらんにならなくなる' },
  15: { b:'C', r:'kind=技名ラベル。平均化の機構はeffectだけ', ja:'自分と相手の今のHPを合計して、半分ずつに分ける' },
  16: { b:'C', r:'kind=技名ラベル。直前技限定の機構はeffectだけ', ja:'相手は直前に使った技しか出せなくなる' },
  17: { b:'C', r:'kind=技名ラベル。連続同技禁止の機構はeffectだけ', ja:'相手は同じ技を続けて出せなくなる', flag:'⚠kind=ちょうはつは誤り(Torment≠Taunt)→kind修正が先' },
  18: { b:'C', r:'kind「ちょうはつ」(Taunt)の中身説明', ja:'相手は変化技を出せなくなる' },
  19: { b:'A', r:'kind「自分拘束」が言っている' },
  20: { b:'A', r:'kind「地面技被弾化」が言っている' },
  21: { b:'A', r:'kind「必中」と重複' },
  22: { b:'A', r:'kind「特性交換」が言っている' },
  23: { b:'C', r:'kind=技名ラベル。封印の機構はeffectだけ', ja:'自分も知っている技を、相手は使えなくなる' },
  24: { b:'C', r:'value「trapped」が英語。交代不可の機構', ja:'相手は逃げたり交代したりできなくなる', flag:'構造化候補(prevents_switch)' },
  25: { b:'A', r:'kind「タイプ一時無効」+value で表現済' },
  26: { b:'C', r:'value「tailwind」が英語。すばやさ2倍4ターンの機構', ja:'4ターンの間、自分と味方の『すばやさ』が2倍になる' },
  27: { b:'A', r:'kind「直前技模倣」が言っている' },
  28: { b:'C', r:'kind「能力入替」では"どの能力か"が出ない', ja:'自分と相手の『こうげき』『とくこう』のランク変化を入れかえる' },
  29: { b:'C', r:'kind=技名ラベル。低速先行の機構はeffectだけ', ja:'『すばやさ』が低いポケモンから先に行動する' },
  30: { b:'C', r:'kind「部屋系」では中身不明', ja:'場の全員の『ぼうぎょ』と『とくぼう』が入れかわる' },
  31: { b:'A', r:'kind「引き寄せ」が言っている' },
  32: { b:'C', r:'kind「部屋系」では中身不明', ja:'場の全員の道具の効果がなくなる' },
  33: { b:'A', r:'kind「タイプ上書き」+value「みず」で表現済' },
  34: { b:'A', r:'kind「特性上書き」が言っている', flag:'value「user\'s ability」が英語→要日本語化' },
  35: { b:'A', r:'kind「直後に行動」が言っている' },
  36: { b:'A', r:'kind「行動順繰上げ」が言っている' },
  37: { b:'C', r:'kind「まもり」汎用。"先制技だけ防ぐ"はeffectだけ', ja:'そのターン、相手の先制技から自分と味方を守る' },
  38: { b:'A', r:'kind「位置入替」が言っている' },
  39: { b:'A', r:'❗既に fraction:0.5 で構造化済→重複(裏取り)。表示「回復 相手 最大HPの50%」で足りる' },
  40: { b:'A', r:'kind「最後に行動」が言っている' },
  41: { b:'A', r:'kind「ランク無視」が言っている' },
  42: { b:'A', r:'kind「技強制再使用」が言っている' },
  43: { b:'A', r:'kind「木の実強制」が言っている' },
  44: { b:'A', r:'value「あばれ」が言っている' },
  45: { b:'A', r:'kind「次ターン使用不可」が言っている' },
};

const COL = { A:'#ff7b72', B:'#e3b341', C:'#7ee787' };
const BNAME = { A:'削除(kindと重複)', B:'ext退避', C:'訳して保持(唯一の機構説明)' };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
const tally = { A:0, B:0, C:0 };
ctx.forEach((o,i)=>{ const t=T[i+1]; if(t) tally[t.b]++; });

let html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>effect 仕分け表(A/C)</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:12.5px}
 header{padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d;position:sticky;top:0;z-index:6}
 h1{font-size:15px;margin:0} .sub{font-size:11px;color:#9aa7b4;margin-top:4px;line-height:1.7}
 .pill{display:inline-block;border-radius:4px;padding:1px 8px;font-weight:700;margin-right:4px}
 .pA{background:#3a1d1b;color:#ff7b72} .pC{background:#13301b;color:#7ee787}
 table{border-collapse:collapse;width:100%} thead th{position:sticky;top:64px;background:#21262d;color:#9aa7b4;font-size:11px;padding:7px;border-bottom:2px solid #30363d;text-align:left}
 td{padding:7px 9px;border-bottom:1px solid #1c2128;vertical-align:top}
 .n{color:#6e7681;text-align:right} .mv{color:#d2a8ff;font-weight:700;white-space:nowrap}
 .kd{color:#9aa7b4;font-size:11px} .kd b{color:#cdd9e5}
 .en{color:#ff9a92;font-family:ui-monospace,monospace;font-size:10.5px;line-height:1.45;max-width:300px}
 .ja{min-width:240px;line-height:1.55;font-size:12.5px;color:#7ee787} .rzn{color:#9aa7b4;font-size:11px;line-height:1.5;min-width:210px}
 .bk{font-weight:700;text-align:center;white-space:nowrap}
 .flag{display:block;color:#ffd479;font-size:10.5px;margin-top:3px}
 .desc{color:#9aa7b4;font-size:11px;line-height:1.5;min-width:220px;max-width:320px;border-left:2px solid #30363d}
 tbody tr:hover td{background:#161b22}
 .rowA .ja{color:#6e7681} .rowA .en{text-decoration:line-through;opacity:.65}
</style></head><body>
<header><h1>🗂️ effect フィールド45件の仕分け — note と同形式(データ未反映)</h1>
<div class="sub">
 <span class="pill pA">A 削除 ${tally.A}件</span> kind/value と重複 → 消す ・
 <span class="pill pC">C 保持 ${tally.C}件</span> kindが技名ラベルで、機構説明がeffectにしか無い → 訳して保持<br>
 ※ <b>effect は現状どのビューにも非表示</b>=見えない英語。北極星(英語禁止)はデータにも適用。⚠️黄=構造化候補/kind誤り. host kind 照合済み.
</div></header>
<table><thead><tr><th class="n">#</th><th>技</th><th>判定</th><th>host kind / 全kind</th><th>現 effect(英語)</th><th>日本語訳案(C)</th><th>理由</th><th>ヤックン説明</th></tr></thead><tbody>`;
ctx.forEach((o,i)=>{
  const t = T[i+1] || { b:'?', r:'' };
  html += `<tr class="row${t.b}">
   <td class="n">${i+1}</td>
   <td class="mv">${esc(o.move)}</td>
   <td class="bk" style="color:${COL[t.b]||'#fff'}">${t.b}<br><span style="font-size:9.5px;font-weight:400;color:#8b949e">${BNAME[t.b]||''}</span></td>
   <td class="kd"><b>${esc(o.hostKind)}</b>${o.hostCond?` <span style="color:#79c0ff">cond:${esc(o.hostCond)}</span>`:''}${o.value?` <span style="color:#e3b341">value:${esc(o.value)}</span>`:''}<br><span style="font-size:10px">${esc(o.allKinds.join(' / '))}</span></td>
   <td class="en">${esc(o.en)}</td>
   <td class="ja">${t.b==='C'?esc(t.ja||''):'<span style="color:#586069">— (削除)</span>'}</td>
   <td class="rzn">${esc(t.r)}${t.flag?`<span class="flag">▶ ${esc(t.flag)}</span>`:''}</td>
   <td class="desc">${esc(o.desc||'')}</td>
  </tr>`;
});
html += `</tbody></table></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_effect_triage.html'), html);
fs.writeFileSync(path.join(ROOT, 'review', '_effect_triage.json'), JSON.stringify(T, null, 1));
console.log(`生成: review/waza_effect_triage.html / A削除 ${tally.A} / C保持 ${tally.C}`);
