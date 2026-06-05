/* note 66件の仕分け表: A=構造と重複→削除 / B=Champions非対象→ext / C=本物の補足→訳して保持。
 * 実データの host kind と照合済み。出力: review/waza_note_triage.html(確認用・データ未反映) */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ctx = require(path.join(ROOT, 'review', '_note_ctx.json'));
// 技名 → ヤックン(徹底攻略)説明文
function lit(t,m){const at=t.indexOf(m);let i=t.indexOf('{',at),s=i,d=0,S=false,e=false;for(;i<t.length;i++){const c=t[i];if(S){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')S=false;}else{if(c==='"')S=true;else if(c==='{')d++;else if(c==='}'){d--;if(d===0)return t.slice(s,i+1);}}}}
const _map = JSON.parse(lit(fs.readFileSync(path.join(ROOT,'pokechan_data.js'),'utf8'),'const WAZA_MAP ='));
const DESC = {}; for (const m of Object.values(_map)) DESC[m.name] = m.description_legacy || m.description || '';

// index(1始まり) → { b:'A'|'B'|'C', r:理由, flag? }
const T = {
  1:  { b:'C', r:'「最後の物理だけ」は倍返しkindに無いニュアンス' },
  2:  { b:'C', r:'もうどくの増加ダメージは状態付与に無い補足' },
  3:  { b:'A', r:'「すなあらし中ずっと」は天候技なら自明・能力倍率と重複' },
  4:  { b:'A', r:'❗既に fraction:0.0625 で構造化済→重複(裏取り)。表示は FRAC_PRE に1行追加で対応', flag:'要: FRAC_PRE「全体継続ダメージ:毎ターン最大HPの」追加' },
  5:  { b:'C', r:'「2ターン後その枠に当たる/引っこんでも」は遅延攻撃に無い' },
  6:  { b:'A', r:'kind「連続強制」が言っている' },
  7:  { b:'C', r:'「場の全員眠れない」は状態異常予防kindに無い範囲情報' },
  8:  { b:'C', r:'のみこむ/はきだすへの波及=クロス技の本物補足' },
  9:  { b:'C', r:'ぼうぎょ/とくぼう戻す+数0(★5: #10と同一訳=元データ重複)' },
  10: { b:'C', r:'#9と同一訳(★5: EN側canonical化推奨)', flag:'#9と重複' },
  11: { b:'A', r:'編集者向けの注記(プレイヤー情報でない)', flag:'⚠kind=ちょうはつは誤り(いちゃもんはTorment)' },
  12: { b:'A', r:'kind「引き寄せ」と重複' },
  13: { b:'C', r:'「でんき技使うまで継続」は持続条件の補足' },
  14: { b:'C', r:'「片方だけ持ち物でも成功」は成功条件の補足' },
  15: { b:'C', r:'ダイマックスわざ/Z技はChampionsの中身(Q1訂正)→訳して保持', flag:'天候2倍部は構造化候補' },
  16: { b:'A', r:'威力可変kind+basis(残HP式)で構造化済' },
  17: { b:'A', r:'★1 kind「一撃必殺」と重複' },
  18: { b:'C', r:'命中30/20%の数値が未構造化', flag:'構造化推奨(cases)' },
  19: { b:'A', r:'対象(味方)はtargetで表現済', flag:'世代差は元々drop' },
  20: { b:'A', r:'威力可変kind+式で構造化済' },
  21: { b:'A', r:'kind「木の実奪取食」が言っている' },
  22: { b:'C', r:'道具別に威力/効果が変わる=構造化困難な本物補足' },
  23: { b:'C', r:'「実数値入替・ランク不変」は能力入替に無いニュアンス' },
  24: { b:'C', r:'ダイマックスわざはChampionsの中身(Q1訂正)→訳して保持' },
  25: { b:'A', r:'★1 kind「必中」と重複' },
  26: { b:'A', r:'kind「別防御参照ダメージ」が言っている' },
  27: { b:'C', r:'浮き解除+でんじふゆう/テレキネシス禁止=複合の本物補足' },
  28: { b:'B', r:'世代差「第7世代以降」', flag:'ext' },
  29: { b:'A', r:'kind「相手能力ダメージ」が言っている' },
  30: { b:'A', r:'威力可変+cond+mult(2倍)で完全に構造化済' },
  31: { b:'A', r:'「ダブル向け」=メタ注記・プレイヤー情報でない' },
  32: { b:'A', r:'★1 kind「みがわり貫通」と重複' },
  33: { b:'A', r:'kind「必中」と重複' },
  34: { b:'A', r:'kind「ランクリセット」と重複' },
  35: { b:'C', r:'「+1ごとに威力20」の数値が未構造化', flag:'構造化推奨' },
  36: { b:'C', r:'「こおってても使える」は状態異常回復に無い使用可否' },
  37: { b:'A', r:'相手のこおり回復=状態異常回復(target=相手)で表現済' },
  38: { b:'C', r:'テラスタル/ステラはChampionsの中身(Q1訂正)→訳して保持' },
  39: { b:'A', r:'kind「ランク無視」と重複' },
  40: { b:'A', r:'威力可変kind+basis(重さ比)で構造化済' },
  41: { b:'C', r:'グラスシード持ちの非接地発動=シード機構の本物補足' },
  42: { b:'B', r:'世代差「1.5→1.3倍」', flag:'ext' },
  43: { b:'A', r:'cond=grounded が「地面の全員」を表現済' },
  44: { b:'A', r:'kind「技タイプ追加」が言っている' },
  45: { b:'A', r:'ゴースト除外=正(Bulbapedia確定)→全員逃走不可effectにimmune構造化→noteは重複でA削除', flag:'要: 全員逃走不可に immune:[{target_type:ゴースト}] 追加(Mean Look家族と統一)' },
  46: { b:'B', r:'「SVまでの仕様」=世代差/Champions非対象', flag:'ext' },
  47: { b:'C', r:'ミストシード持ちの非接地発動=シード機構の本物補足' },
  48: { b:'C', r:'「既存の状態異常は治らない」ニュアンス' },
  49: { b:'B', r:'世代差「第7まで2段階」', flag:'ext' },
  50: { b:'C', r:'エレキシード持ちの非接地発動=シード機構の本物補足' },
  51: { b:'C', r:'「寝てる相手は起こさない」ニュアンス' },
  52: { b:'B', r:'世代差「第7まで1.5倍」', flag:'ext' },
  53: { b:'C', r:'サイコシード持ちの非接地発動=シード機構の本物補足' },
  54: { b:'C', r:'「味方の先制技は防がない」例外=優先技無効に無い' },
  55: { b:'B', r:'世代差「第7まで1.5倍」', flag:'ext' },
  56: { b:'C', r:'「技はそのあと出る」ニュアンス(condは構造化済)' },
  57: { b:'A', r:'cond=味方対象 が「味方なら回復」を表現済' },
  58: { b:'C', r:'「下げられない時は回復だけ」エッジケース' },
  59: { b:'C', r:'「こおってても使える」は状態異常回復に無い使用可否' },
  60: { b:'B', r:'世代差「SVまで-1」', flag:'ext' },
  61: { b:'C', r:'フィールド1.3倍の重ねがけ=技間の相互作用の本物補足' },
  62: { b:'C', r:'フィールド1.3倍は自分接地時だけ=相互作用の補足' },
  63: { b:'C', r:'#61と同趣旨(フィールド重ねがけ)' },
  64: { b:'A', r:'あばれ後の混乱は状態付与(こんらん)で構造化済' },
  65: { b:'A', r:'★1 威力倍率+cond(てつのこぶし)+mult で完全構造化済' },
  66: { b:'A', r:'★1 kind「急所率上昇」と重複' },
};

const COL = { A:'#ff7b72', B:'#e3b341', C:'#7ee787' };
const BNAME = { A:'削除(構造と重複)', B:'ext退避(Champions非対象)', C:'訳して保持(本物の補足)' };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
const tally = { A:0, B:0, C:0 };
ctx.forEach((o,i)=>{ const t=T[i+1]; if(t) tally[t.b]++; });

let html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>note 仕分け表(A/B/C)</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:12.5px}
 header{padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d;position:sticky;top:0;z-index:6}
 h1{font-size:15px;margin:0} .sub{font-size:11px;color:#9aa7b4;margin-top:4px;line-height:1.7}
 .pill{display:inline-block;border-radius:4px;padding:1px 8px;font-weight:700;margin-right:4px}
 .pA{background:#3a1d1b;color:#ff7b72} .pB{background:#3a2f12;color:#e3b341} .pC{background:#13301b;color:#7ee787}
 table{border-collapse:collapse;width:100%} thead th{position:sticky;top:64px;background:#21262d;color:#9aa7b4;font-size:11px;padding:7px;border-bottom:2px solid #30363d;text-align:left}
 td{padding:7px 9px;border-bottom:1px solid #1c2128;vertical-align:top}
 .n{color:#6e7681;text-align:right} .mv{color:#d2a8ff;font-weight:700;white-space:nowrap}
 .kd{color:#9aa7b4;font-size:11px} .kd b{color:#cdd9e5}
 .ja{min-width:300px;line-height:1.55;font-size:12.5px} .rzn{color:#9aa7b4;font-size:11px;line-height:1.5;min-width:240px}
 .bk{font-weight:700;text-align:center;white-space:nowrap}
 .flag{display:block;color:#ffd479;font-size:10.5px;margin-top:3px}
 tbody tr:hover td{background:#161b22}
 .rowA .ja{color:#ff9a92;text-decoration:line-through;opacity:.7} .rowB .ja{color:#e3b341} .rowC .ja{color:#7ee787}
 .desc{color:#9aa7b4;font-size:11px;line-height:1.5;min-width:240px;max-width:340px;border-left:2px solid #30363d}
</style></head><body>
<header><h1>🗂️ note 66件の仕分け — 訳す前の4択判定(データ未反映)</h1>
<div class="sub">
 <span class="pill pA">A 削除 ${tally.A}件</span> 構造(kind/cond)と重複 → 訳さず消す ・
 <span class="pill pB">B ext ${tally.B}件</span> Champions非対象(世代差/ダイマックス/テラスタル)→ 消さず ext へ退避 ・
 <span class="pill pC">C 保持 ${tally.C}件</span> 構造に無い本物の補足 → ここだけ訳して note 保持<br>
 ⚠️黄=要相談(構造化推奨 / kind誤り / Champions有無の確認待ち). host kind と実データ照合済み.
</div></header>
<table><thead><tr><th class="n">#</th><th>技</th><th>判定</th><th>host kind / 全kind</th><th>note(訳案)</th><th>理由</th><th>ヤックン説明(徹底攻略)</th></tr></thead><tbody>`;
ctx.forEach((o,i)=>{
  const t = T[i+1] || { b:'?', r:'' };
  html += `<tr class="row${t.b}">
   <td class="n">${i+1}</td>
   <td class="mv">${esc(o.move)}</td>
   <td class="bk" style="color:${COL[t.b]||'#fff'}">${t.b}<br><span style="font-size:9.5px;font-weight:400;color:#8b949e">${BNAME[t.b]||''}</span></td>
   <td class="kd"><b>${esc(o.hostKind)}</b>${o.hostCond?` <span style="color:#79c0ff">cond:${esc(o.hostCond)}</span>`:''}${o.multiplier?` ×${o.multiplier}`:''}<br><span style="font-size:10px">${esc(o.allKinds.join(' / '))}</span></td>
   <td class="ja">${esc(o.ja)}</td>
   <td class="rzn">${esc(t.r)}${t.flag?`<span class="flag">▶ ${esc(t.flag)}</span>`:''}</td>
   <td class="desc">${esc(DESC[o.move]||'')}</td>
  </tr>`;
});
html += `</tbody></table></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_note_triage.html'), html);
fs.writeFileSync(path.join(ROOT, 'review', '_note_triage.json'), JSON.stringify(T, null, 1));
console.log(`生成: review/waza_note_triage.html / A削除 ${tally.A} / Bext ${tally.B} / C保持 ${tally.C}`);
