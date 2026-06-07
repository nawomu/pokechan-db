/** 表記の選択肢を評価するHTML。①用語の囲み記号(ヤックン『』との差別化) ②カテゴリ名の方式。
 * 実行: node tools/_hyoki_options.js → review/hyoki_options.html  ※提案・評価用(本番無変更) */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ① 囲み記号の候補(例文=10まんボルト相当)。ヤックンは『』なので、それ以外で差別化。
const KAKOMI = [
  { sym: '「 」', ex: '10%の確率で相手を「まひ」状態にする。', pro: '日本語の標準的なカギカッコ。一番読みやすい。ヤックンの『』(二重)と確実に違う。', con: '標準すぎて"差別化"感は弱め。', rec: '◎おすすめ(読みやすさ最優先)' },
  { sym: '" "', ex: '10%の確率で相手を"まひ"状態にする。', pro: '阿部さん案。見た目が珍しく差別化が強い。', con: '日本語の文に半角"は少し浮く/幼児には馴染み薄。全角〝〟もあるが特殊。', rec: '○差別化は強い' },
  { sym: '〈 〉', ex: '10%の確率で相手を〈まひ〉状態にする。', pro: '山がた。すっきり・独自感あり。', con: '子どもには馴染みが薄いかも。', rec: '○' },
  { sym: '【 】', ex: '10%の確率で相手を【まひ】状態にする。', pro: '目立つ。', con: 'カテゴリ名の候補と被る(下②)。インラインだと重い。', rec: '△(カテゴリ用に温存推奨)' },
  { sym: '囲まない', ex: '10%の確率で相手をまひ状態にする。', pro: '一番シンプル。記号ゼロ。', con: '「これはゲーム用語」の合図が消える。複合語で境界が分かりにくい場合あり。', rec: '○候補' },
];

// ② カテゴリ名の方式(クラブハンマー/10まんボルト で例示)
const CATEGORY = [
  { name: 'A: なし', ex: '急所ランクがひとつ上がる。', desc: 'カテゴリを付けない。', pro: '一番シンプル・現状。', con: '効果の分類が見えない(阿部さんの「カテゴリ名入れたい」に未対応)。' },
  { name: 'B: kind直(技術用語)', ex: '【急所率上昇】急所ランクがひとつ上がる。', desc: 'effect.kind をそのままラベル化。', pro: '実装が楽・データと一致。', con: '「急所率上昇」「状態付与」は子どもに固い/専門的。' },
  { name: 'C: 子ども向けラベル(推奨)', ex: '【急所】急所ランクがひとつ上がる。 / 【まひ】10%の確率で相手をまひ状態にする。', desc: 'kind/valueをやさしい短語に(急所率上昇→急所、状態付与どく→どく)。', pro: 'やさしい・短い・効果が一目。独自(うちの構造由来)。', con: 'kind→ラベルの対応表を1枚作る必要。' },
  { name: 'D: 大分類', ex: '【能力変化】急所ランクがひとつ上がる。 / 【状態異常】…まひ…', desc: '粗いグループ(攻撃/状態異常/能力変化/場/その他)。', pro: '数が少なく整理しやすい。', con: '粗すぎて個々の効果が見えない。複数効果でラベルが重複。' },
];
// C案のkind→ラベル対応(たたき台)
const LABELS = [
  ['急所率上昇', '急所'], ['状態付与(どく)', 'どく'], ['状態付与(まひ)', 'まひ'], ['ひるみ', 'ひるみ'],
  ['威力可変', '威力'], ['能力ランク変化', '能力'], ['回復', '回復'], ['反動', '反動'], ['連続攻撃', '連続'],
];

const kRow = k => `<tr><td class="sym">${esc(k.sym)}</td><td class="ex">${esc(k.ex)}</td><td>${esc(k.pro)}</td><td class="con">${esc(k.con)}</td><td class="rec">${esc(k.rec)}</td></tr>`;
const cRow = c => `<tr><td class="cn">${esc(c.name)}</td><td class="ex">${esc(c.ex)}</td><td>${esc(c.desc)}</td><td>${esc(c.pro)}</td><td class="con">${esc(c.con)}</td></tr>`;

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>表記の選択肢 — 囲み記号 / カテゴリ名</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:16px;line-height:1.7}
 .wrap{max-width:980px;margin:0 auto;padding:0 16px 60px}
 header{padding:16px;background:#161b22;border-bottom:1px solid #30363d;margin-bottom:10px}
 h1{font-size:20px;margin:0} .date{color:#6e7681;font-size:12.5px;margin-top:5px}
 h2{font-size:17px;margin:26px 0 10px;color:#d2a8ff;border-bottom:1px solid #30363d;padding-bottom:7px}
 .hint{font-size:13px;color:#9aa7b4;margin:-4px 0 10px}
 table{border-collapse:collapse;width:100%} th{background:#21262d;color:#9aa7b4;font-size:13px;padding:9px;text-align:left;border-bottom:2px solid #30363d}
 td{padding:10px;border-bottom:1px solid #1c2128;vertical-align:top;font-size:14px}
 .sym{font-size:20px;font-weight:700;color:#79c0ff;white-space:nowrap} .cn{font-weight:700;color:#79c0ff;white-space:nowrap}
 .ex{color:#7ee787;font-size:15px;min-width:240px} .con{color:#ff9bce} .rec{color:#ffd479;font-weight:700;white-space:nowrap}
 .labels{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px} .lab{background:#11271a;border:1px solid #1b3a24;border-radius:6px;padding:5px 10px;font-size:13.5px}
 .lab b{color:#7ee787}
</style></head><body>
<header><div class="wrap" style="padding-bottom:0"><h1>🔤 表記の選択肢 — 囲み記号 / カテゴリ名</h1>
<div class="date">ヤックン(『』)との差別化 + カテゴリ評価 / 2026-06-07 / 本番無変更</div></div></header>
<div class="wrap">

<h2>① 用語の囲み記号(ヤックンの『』をやめ、何に変えるか)</h2>
<div class="hint">状態名・タイプ名・技名を囲む記号。緑=例文(10まんボルト相当)。差別化と読みやすさのバランスで。</div>
<table><thead><tr><th>記号</th><th>例文</th><th>長所</th><th>短所</th><th>評価</th></tr></thead><tbody>${KAKOMI.map(kRow).join('')}</tbody></table>
<div class="hint">私の推し=<b style="color:#ffd479">「 」(カギカッコ)</b>: 子どもに一番読みやすく、ヤックンの『』(二重)と確実に違う。差別化を強くしたいなら " " か 〈 〉。</div>

<h2>② カテゴリ名の方式</h2>
<div class="hint">「効果の種類ラベルを頭に付ける」案。どの粒度・呼び名にするか。</div>
<table><thead><tr><th>方式</th><th>例</th><th>説明</th><th>長所</th><th>短所</th></tr></thead><tbody>${CATEGORY.map(cRow).join('')}</tbody></table>
<div class="hint">私の推し=<b style="color:#ffd479">C(子ども向けラベル)</b>。対応表のたたき台(kind→ラベル):</div>
<div class="labels">${LABELS.map(([k, v]) => `<div class="lab">${esc(k)} → <b>【${esc(v)}】</b></div>`).join('')}</div>
<div class="hint" style="margin-top:12px">※②でカテゴリに【 】を使うなら、①の囲みは【 】以外(「 」等)にするのが綺麗(重複回避)。</div>

</div></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'hyoki_options.html'), html);
console.log('生成: review/hyoki_options.html');
