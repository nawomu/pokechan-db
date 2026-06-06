/** 阿部さんの耳判定用・確認HTML生成。監査器(_waza_compose.js)と同一エンジンをrequireして音のドリフトを防ぐ。
 * 実行: node tools/_waza_voice_check.js  → review/waza_voice_check.html
 * 目的: 急所/prob修正の verbatim一致を確認 + 残る声判定(★)を一画面で耳に回す。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { compose, map } = require('./_waza_compose.js');
const byName = {}; for (const m of Object.values(map)) byName[m.name] = m;
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// セクション定義: [見出し, 問い, [技名...]]
const SECTIONS = [
  {
    tone: 'ok', title: '✅ もう確定(確認だけ・耳いりません)',
    note: '緑＝新版(エンジン生成) と 白＝ヤックン(legacy) が <b>文字までそっくり一致</b>。急所率上昇テンプレ・確率(prob)の補完が gold に戻れていることの確認。',
    moves: ['クラブハンマー', 'こおりのいぶき', 'つじぎり', '10まんボルト', 'れいとうビーム', 'どくづき', 'かえんほうしゃ'],
  },
  {
    tone: 'ask', title: '★ 耳をください① — 節の順番(これが本命)',
    note: '技が2つの効果を持つとき、<b>語る順番</b>が新版とヤックンで逆になります(下の2技は、節そのものは合っていて<b>順番だけ</b>が違う純粋な例)。新版はデータの並び順、ヤックンは状態を先・急所を後。<br><b>注意: ヤックンの順番は一定の機械ルールにできません</b> — 例えばボルテッカーは「反動」を先に、かみなりパンチは「状態」を先に言います。だから「いつも◯◯を先に」と決め打ちできず、<b>阿部さんの耳</b>が要ります。問い=<b>新版もヤックンの順に寄せるか / どういう優先で並べるか</b>。',
    moves: ['クロスポイズン', 'ブレイズキック'],
  },
  {
    tone: 'info', title: '◇→★ 確率を揃えたら見えた別件(今は止めて報告のみ・参考)',
    note: 'prob を入れて他が比べられるようになり、<b>これまで埋もれていた別の差</b>が見えました。<b>私(ビルド)は触っていません。</b> いずれ耳が要る候補として並べます(今日の急所/確率タスクとは別件):<br>　• <b>ひるみ</b>: 新版「『ひるみ』状態にする」/ ヤックン「ひるませる」<br>　• <b>相手の範囲</b>: 新版「相手全体/自分以外」/ ヤックン「相手」<br>　• <b>複数状態</b>: トライアタックは「うちの1つ・ランダム」までヤックンは言う<br>　• <b>節の中の順</b>: みずのはどうは「相手を1〜4ターンの間」(新版は「1〜4ターンの間、相手を」)',
    moves: ['たきのぼり', 'いわなだれ', 'ねっぷう', 'トライアタック', 'みずのはどう'],
  },
];

const cell = nm => {
  const m = byName[nm];
  if (!m) return `<tr><td class="mv">${esc(nm)}</td><td colspan="3">(技なし)</td></tr>`;
  const { text } = compose(m);
  const leg = m.description_legacy || '';
  const same = text === leg;
  const src = ((m.battle_data || {}).effects || []).map(e => esc(JSON.stringify(e))).join('\n');
  return `<tr>
   <td class="mv">${esc(m.name)}${same ? '<div class="badge ok">✓そっくり一致</div>' : '<div class="badge diff">差あり</div>'}</td>
   <td class="src">${src}</td>
   <td class="gen">${esc(text)}</td>
   <td class="leg">${esc(leg)}</td>
  </tr>`;
};

const sectionHtml = s => `
 <section class="sec ${s.tone}">
  <h2>${s.title}</h2>
  <p class="note">${s.note}</p>
  <table><thead><tr><th>技</th><th>元データ(effects)</th><th>🟢 新版(エンジン生成)</th><th>★ ヤックン(お手本=legacy)</th></tr></thead>
  <tbody>${s.moves.map(cell).join('')}</tbody></table>
 </section>`;

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>声の確認 — 阿部さんの耳へ</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:16px;line-height:1.7}
 header{padding:14px 20px;background:#161b22;border-bottom:1px solid #30363d}
 h1{font-size:20px;margin:0} .lead{font-size:13.5px;color:#9aa7b4;margin-top:8px;max-width:980px}
 .sec{margin:22px 16px 30px;border:1px solid #30363d;border-radius:10px;overflow:hidden}
 .sec h2{font-size:17px;margin:0;padding:12px 16px;background:#21262d}
 .sec.ok h2{color:#7ee787} .sec.ask h2{color:#ffd479} .sec.info h2{color:#79c0ff}
 .note{font-size:13.5px;color:#c9d1d9;padding:11px 16px;margin:0;background:#11161c;border-bottom:1px solid #30363d}
 table{border-collapse:collapse;width:100%} th{background:#1c2128;color:#9aa7b4;font-size:13px;padding:9px;text-align:left;border-bottom:2px solid #30363d}
 td{padding:11px;border-bottom:1px solid #1c2128;vertical-align:top}
 .mv{color:#d2a8ff;font-weight:700;white-space:nowrap;font-size:16px}
 .badge{font-size:11px;font-weight:400;margin-top:6px;display:inline-block;padding:2px 7px;border-radius:6px}
 .badge.ok{background:#1b3a24;color:#7ee787} .badge.diff{background:#3a2a12;color:#ffd479}
 .src{color:#79c0ff;font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.65;min-width:300px;max-width:430px;white-space:pre-wrap;word-break:break-all}
 .gen{color:#7ee787;min-width:280px;font-size:16px} .leg{color:#fff;min-width:280px;font-size:16px}
 tr:hover td{background:#161b22}
</style></head><body>
<header><h1>🎧 声の確認 — 新版 ↔ ヤックン(legacy)</h1>
<div class="lead">緑=エンジンが effects から作った新版 / 白=ヤックン(お手本=description_legacy)。<b>新版がヤックンの意味と声に戻れているか</b>を耳で。本番表示は legacy のまま無変更です(新版はまだ裏)。</div></header>
${SECTIONS.map(sectionHtml).join('')}
<footer style="padding:18px 20px;color:#6e7681;font-size:12px">監査器 _waza_compose.js と同一エンジンで生成(node tools/_waza_voice_check.js)。本番=legacy 無変更。</footer>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_voice_check.html'), html);
console.log('生成: review/waza_voice_check.html');
