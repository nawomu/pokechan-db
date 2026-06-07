/** 忠実版エンジンの確認HTML。監査器(_waza_compose.js)と同一エンジンをrequireし、生成文と画面を一致させる。
 * 実行: node tools/_waza_voice_check.js  → review/waza_voice_check.html
 * 方針(2026-06-06): データを「そのまま忠実」に訳す。ヤックンは意味参照のみ(声を寄せない)。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { compose, map } = require('./_waza_compose.js');
const byName = {}; for (const m of Object.values(map)) byName[m.name] = m;
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const SECTIONS = [
  { tone: 'done', title: '✓ 急所(忠実版・更新済)', note: '`急所率上昇 stages:1` → <b>「急所ランクがひとつ上がる」</b>(解釈・softeningしない)。ヤックンの「急所に当たりやすい(急所ランク:+1)」とは別物=独自。`always_crit`→「必ず急所に当たる」は自然な収束。',
    moves: ['クラブハンマー', 'こおりのいぶき', 'つじぎり', 'エアカッター'] },
  { tone: 'done', title: '✓ ひるみ(忠実版・新規 開通順#1)', note: '`kind:ひるみ prob:N` → <b>「N%の確率で相手をひるませる」</b>(データのまま)。`状態付与 value:ひるみ`(いわなだれ等)も「ひるませる」に統一(ひるみは動作=状態にする ではない)。',
    moves: ['かみつく', 'じんつうりき', 'あくのはどう', 'エアスラッシュ', 'いわなだれ'] },
  { tone: 'mix', title: '複合(急所/ひるみ + 状態)', note: '複数効果。節の順番はデータ順のまま(★節順番は未確定なので触らない)。',
    moves: ['クロスポイズン', 'かみなりのキバ', 'こおりのキバ', 'ほのおのキバ'] },
];

const cell = nm => {
  const m = byName[nm];
  if (!m) return `<tr><td class="mv">${esc(nm)}</td><td colspan="3">(技なし)</td></tr>`;
  const { text } = compose(m);
  const leg = m.description_legacy || '';
  const same = text === leg;
  const src = ((m.battle_data || {}).effects || []).map(e => esc(JSON.stringify(e))).join('\n');
  return `<tr>
   <td class="mv">${esc(m.name)}${same ? '<div class="badge cv">≈ヤックンと一致(自然な収束)</div>' : '<div class="badge ind">独自(別物)</div>'}</td>
   <td class="src">${src}</td>
   <td class="gen">${esc(text)}</td>
   <td class="leg">${esc(leg)}</td>
  </tr>`;
};
const sec = s => `
 <section class="sec ${s.tone}"><h2>${s.title}</h2><p class="note">${s.note}</p>
  <table><thead><tr><th>技</th><th>元データ(effects)</th><th>🟢 忠実新版(エンジン)</th><th>ヤックン(参照=意味だけ)</th></tr></thead>
  <tbody>${s.moves.map(cell).join('')}</tbody></table></section>`;

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>忠実版エンジン 確認 — 阿部さんの耳へ</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:16px;line-height:1.8}
 header{padding:14px 20px;background:#161b22;border-bottom:1px solid #30363d}
 h1{font-size:20px;margin:0} .lead{font-size:13.5px;color:#9aa7b4;margin-top:8px;max-width:1000px}
 .sec{margin:20px 16px 28px;border:1px solid #30363d;border-radius:10px;overflow:hidden}
 .sec h2{font-size:16px;margin:0;padding:11px 15px;background:#21262d} .sec.done h2{color:#7ee787} .sec.mix h2{color:#79c0ff}
 .note{font-size:13px;color:#c9d1d9;padding:10px 15px;margin:0;background:#11161c;border-bottom:1px solid #30363d}
 table{border-collapse:collapse;width:100%} th{background:#1c2128;color:#9aa7b4;font-size:13px;padding:9px;text-align:left;border-bottom:2px solid #30363d}
 td{padding:11px;border-bottom:1px solid #1c2128;vertical-align:top}
 .mv{color:#d2a8ff;font-weight:700;white-space:nowrap}
 .badge{font-size:11px;font-weight:400;margin-top:6px;display:inline-block;padding:2px 7px;border-radius:6px}
 .badge.ind{background:#1b2b3a;color:#79c0ff} .badge.cv{background:#2d2a14;color:#d6c560}
 .src{color:#79c0ff;font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;max-width:330px;white-space:pre-wrap;word-break:break-all}
 .gen{color:#7ee787;min-width:280px;font-size:16px;font-weight:500} .leg{color:#e6edf3;min-width:240px;font-size:14.5px;border-left:3px solid #30363d;padding-left:13px}
 tr:hover td{background:#161b22}
</style></head><body>
<header><h1>📝 忠実版エンジン 確認 — データをそのまま訳す</h1>
<div class="lead"><b style="color:#7ee787">緑=エンジンが effects から忠実に訳した文</b>(アレンジ・softening・要約なし)。右端の<b>ヤックン</b>は<b>意味が戻るかの参照だけ</b>(声を寄せる相手ではない)。<br>バッジ <b style="color:#79c0ff">独自</b>=ヤックンと別物 / <b style="color:#d6c560">≈収束</b>=忠実訳が自然にヤックンと一致(言い方が一通り＝コピーでない)。カバー率 <b>242/490</b>。本番=無変更。</div></header>
${SECTIONS.map(sec).join('')}
<footer style="padding:18px 20px;color:#6e7681;font-size:12px">監査器 _waza_compose.js と同一エンジン(node tools/_waza_voice_check.js)。</footer>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_voice_check.html'), html);
console.log('生成: review/waza_voice_check.html');
