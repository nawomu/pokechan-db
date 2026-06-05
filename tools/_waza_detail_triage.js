/* detail(8) / sub_effects(5) / value英語(5) の仕分け。これで note+effect と合わせ英語フリーテキスト全廃。
 * 出力: review/waza_detail_triage.html */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const C = require(path.join(ROOT, 'review', '_detail_ctx.json'));

// detail: index→{b,r,ja?,flag?}
const TD = {
  1: { b:'C', r:'kind「能力入替」では"どの能力か"が出ない', ja:'自分と相手の『ぼうぎょ』『とくぼう』のランク変化を入れかえる' },
  2: { b:'A', r:'❗既に fraction:0.0625+turn_end+duration で構造化済→重複(裏取り)', flag:'表示で「毎ターン」を出すと尚良(回復のturn_end用FRAC_PRE)' },
  3: { b:'C', r:'浮遊・非接地扱いの機構', ja:'自分が宙に浮いた状態になり、地面にいない扱いになる(特性『ふゆう』のような状態)' },
  4: { b:'C', r:'「片方だけでも成功」はkindに無い', ja:'自分と相手の持ち物を交換する。どちらか一方しか持っていなくても成功する' },
  5: { b:'C', r:'「両側から除去」はkindに無い', ja:'自分側と相手側の両方の設置わざ(まきびし など)を取り除く' },
  6: { b:'C', r:'kind「範囲まもり」の中身説明', ja:'そのターン、複数を巻き込む技から自分と味方を守る' },
  7: { b:'C', r:'実数値折半の対象(ぼうぎょ/とくぼう)を明示', ja:'自分と相手の『ぼうぎょ』の実数値を合計して半分ずつにする。『とくぼう』も同じ' },
  8: { b:'C', r:'実数値折半の対象(こうげき/とくこう)を明示', ja:'自分と相手の『こうげき』の実数値を合計して半分ずつにする。『とくこう』も同じ' },
};
// sub_effects(じゅうりょく): すべてC(機構の中身)
const TS = {
  1: { b:'C', ja:'場の全員の命中率が5/3倍になる' },
  2: { b:'C', ja:'ひこうタイプや特性『ふゆう』のポケモンも地面にいる扱いになる(じめん技が当たる)' },
  3: { b:'C', ja:'空中にいる技(そらをとぶ/はねる/とびげり/とびひざげり/とびはねる/でんじふゆう/フライングプレス/フリーフォール)が使えなくなり、使用中なら中止される' },
  4: { b:'C', ja:'『テレキネシス』を解除し、使えなくする' },
  5: { b:'C', ja:'『Gのちから』の威力が1.5倍になる' },
};
// value英語: 日本語化(削除でなく置換)
const TV = {
  1: { ja:'ちいさくなる', r:'状態名を日本語へ' },
  2: { ja:'バインド', r:'状態名を日本語へ(bound=バインド)' },
  3: { ja:'交代不可', r:'交代不可へ', flag:'構造化候補(prevents_switch)' },
  4: { ja:'おいかぜ', r:'状態名を日本語へ' },
  5: { ja:'自分の特性', r:'英語句を日本語へ' },
};

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
const head = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>detail / sub_effects / value 仕分け</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:12.5px}
 header{padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d;position:sticky;top:0;z-index:6}
 h1{font-size:15px;margin:0} .sub{font-size:11px;color:#9aa7b4;margin-top:4px;line-height:1.6}
 h2{font-size:13px;color:#d2a8ff;margin:18px 16px 4px;padding-top:6px}
 table{border-collapse:collapse;width:100%} thead th{background:#21262d;color:#9aa7b4;font-size:11px;padding:7px;border-bottom:2px solid #30363d;text-align:left}
 td{padding:7px 9px;border-bottom:1px solid #1c2128;vertical-align:top}
 .n{color:#6e7681;text-align:right} .mv{color:#d2a8ff;font-weight:700;white-space:nowrap}
 .kd{color:#9aa7b4;font-size:11px} .kd b{color:#cdd9e5}
 .en{color:#ff9a92;font-family:ui-monospace,monospace;font-size:10.5px;line-height:1.45;max-width:320px}
 .ja{min-width:260px;line-height:1.55;font-size:12.5px;color:#7ee787} .rzn{color:#9aa7b4;font-size:11px;line-height:1.5;min-width:200px}
 .bk{font-weight:700;text-align:center;color:#7ee787} .flag{display:block;color:#ffd479;font-size:10.5px;margin-top:3px}
 .desc{color:#9aa7b4;font-size:11px;line-height:1.5;min-width:200px;max-width:300px;border-left:2px solid #30363d}
 tbody tr:hover td{background:#161b22}
</style></head><body>
<header><h1>🗂️ detail / sub_effects / value 英語の仕分け — 英語フリーテキスト全廃の最終ピース</h1>
<div class="sub">detail 8件・sub_effects 5件(全てじゅうりょく)・value英語 5件。detail/sub は全て <b style="color:#7ee787">C(機構説明・訳して保持)</b>。value は<b style="color:#7ee787">日本語化(置換)</b>。⚠️黄=構造化候補.</div></header>`;

function table(arr, T, withDesc) {
  let h = `<table><thead><tr><th class="n">#</th><th>技</th><th>判定</th><th>host kind</th><th>現(英語)</th><th>日本語訳案</th><th>理由</th>${withDesc?'<th>ヤックン説明</th>':''}</tr></thead><tbody>`;
  arr.forEach((o,i)=>{ const t=T[i+1]||{};
    h += `<tr>
     <td class="n">${i+1}</td><td class="mv">${esc(o.move)}</td>
     <td class="bk">${t.b||'値'}</td>
     <td class="kd"><b>${esc(o.hostKind)}</b></td>
     <td class="en">${esc(o.en)}</td>
     <td class="ja">${esc(t.ja||'')}</td>
     <td class="rzn">${esc(t.r||'')}${t.flag?`<span class="flag">▶ ${esc(t.flag)}</span>`:''}</td>
     ${withDesc?`<td class="desc">${esc(o.desc||'')}</td>`:''}
    </tr>`;
  });
  return h + '</tbody></table>';
}
let html = head
  + `<h2>① detail(8件) — 全て C(訳して保持)</h2>` + table(C.detail, TD, true)
  + `<h2>② sub_effects(5件・じゅうりょく) — 全て C</h2>` + table(C.sub_effects, TS, false)
  + `<h2>③ value 英語(5件) — 日本語化(置換)</h2>` + table(C.value, TV, false)
  + `</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_detail_triage.html'), html);
fs.writeFileSync(path.join(ROOT, 'review', '_detail_triage.json'), JSON.stringify({ detail:TD, sub_effects:TS, value:TV }, null, 1));
console.log('生成: review/waza_detail_triage.html / detail', C.detail.length, 'sub', C.sub_effects.length, 'value', C.value.length);
