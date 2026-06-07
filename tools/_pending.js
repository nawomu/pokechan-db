/** 確認事項ダッシュボード。今どの判断待ちか/何が済んだか/開通順todoを一枚に。
 * 実行: node tools/_pending.js  → review/pending.html
 * ※状況スナップショット。更新したらここを直して再生成。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const EAR = [ // 阿部さんの耳★(声・方針)
  { t: 'いばる「上げてしまう」', d: '相手のこうげき+2(自分の損)を「上げてしまう」と書くか、データのまま「上がる」にするか。これが (あ)忠実だが情報保つ言い回しOK / (い)一切アレンジ無し の核。', rec: '—(あなたの耳)' },
  { t: '『』囲み', d: '状態名を『まひ』と囲むか、まひ(囲まない)か。内容でなく表記。', rec: '台帳の既存✓ルールは「囲む」' },
  { t: 'カテゴリ名', d: 'effect.kind を頭にラベル付け(【急所】等)するか・呼び名。', rec: '形が決まれば一覧で対応表を作る' },
];
const DATA = [ // データ判断(pokechan_data.js マスター変更)
  { t: 'じたばた/きしかいせい 6段階 enrich【承認済】', d: 'うちのデータは簡略形(残りHP少→威力↑ 20〜200)で、本当の6段階(2/48未満→200…)を持たない。権威ソース(pokemonwiki)の6段階に正確化。', rec: '阿部さん承認済(2026-06-07)。sim非依存=安全は裏取り済。次のデータ編集回で実施' },
];
const DONE = [ // 忠実版・コミット済
  { t: '急所(忠実版)', d: '急所ランクがひとつ上がる/必ず急所に当たる', c: 'fd9a5a9' },
  { t: 'ひるみ(忠実版)', d: 'N%の確率で相手をひるませる(2系統統一)', c: 'e864151' },
  { t: '威力可変(忠実版)', d: '段階表/式を日本語で(英語式は和文化)', c: '1fab038' },
];
const TODO = [ // 開通順・テンプレtodo
  { t: 'てつのこぶし1.2倍を全技で描画', d: '【方針確定=削除しない・説明文に必要】sim は ×1.2 を正しく適用済(real_battle_simulator.html:1141・特性+punchフラグ・14技全部punch有)。説明文は威力倍率12技で出るが、マッハパンチ(威力可変)/ばくれつパンチ(場の威力補正)の2技は未描画→consistencyで描画追加。' },
  { t: '必中(開通順#3・+8)', d: '次の予定。' },
  { t: '技タイプ変更', d: 'ウェザーボール用(天気でタイプ変化)。これが要るのでウェザーボールは未完。' },
  { t: '条件×倍率', d: 'りんしょう/サンダーダイブ等。conditionの日本語化が要る。' },
  { t: 'やけっぱち', d: 'データが needs_research:true=未確定。データ確定まで穴。' },
];
const PARK = [ // data-cleanup候補(止めない)
  { t: 'ひるみ 2系統', d: 'データに kind:ひるみ(13) と 状態付与:ひるみ(6) が併存。表示は統一済だがデータは2形式。後日 kind:ひるみ へ一本化候補。', s: '検証 co-sign 済' },
  { t: '威力可変 キー名不統一', d: '同じ概念でキーがバラバラ(tiers/weight_thresholds、max_ratio/ratio_below 等)。今は表示で吸収。後日データ整形候補。', s: '新規(今回判明)' },
];

const card = (x, cls) => `<div class="card ${cls}">
  <div class="ct">${esc(x.t)}${x.c ? `<span class="cm">${esc(x.c)}</span>` : ''}${x.s ? `<span class="cs">${esc(x.s)}</span>` : ''}</div>
  <div class="cd">${x.d}</div>
  ${x.list ? `<div class="cl">対象: ${esc(x.list)}</div>` : ''}
  ${x.rec ? `<div class="cr">→ ${esc(x.rec)}</div>` : ''}
</div>`;

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>確認事項ダッシュボード — ポケモンDB 技説明文</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:16px;line-height:1.7}
 .wrap{max-width:900px;margin:0 auto;padding:0 16px 60px}
 header{padding:16px;background:#161b22;border-bottom:1px solid #30363d;margin-bottom:10px}
 h1{font-size:20px;margin:0} .date{color:#6e7681;font-size:12.5px;margin-top:5px}
 h2{font-size:16px;margin:26px 0 4px;padding:8px 12px;border-radius:8px}
 h2.ear{background:#2a1f0a;color:#ffd479} h2.data{background:#2a1320;color:#ff9bce} h2.done{background:#11271a;color:#7ee787} h2.todo{background:#10212e;color:#79c0ff} h2.park{background:#1c1c22;color:#9aa7b4}
 .hint{font-size:12.5px;color:#9aa7b4;margin:2px 0 10px 4px}
 .card{border:1px solid #30363d;border-radius:9px;padding:11px 13px;margin:9px 0;background:#11161c}
 .card.done{opacity:.85} .ct{font-weight:700;font-size:15.5px} .cm{margin-left:8px;font-weight:400;font-size:12px;color:#7ee787;font-family:ui-monospace,monospace}
 .cs{margin-left:8px;font-weight:400;font-size:11px;color:#9aa7b4;background:#21262d;padding:2px 7px;border-radius:5px}
 .cd{font-size:14px;color:#c9d1d9;margin-top:5px} .cl{font-size:12px;color:#79c0ff;margin-top:5px} .cr{font-size:13.5px;color:#ffd479;margin-top:6px}
</style></head><body>
<header><div class="wrap" style="padding-bottom:0"><h1>📌 確認事項ダッシュボード</h1>
<div class="date">技説明文の独自化(そのまま忠実)/ 2026-06-07 / 本番・データ無変更</div></div></header>
<div class="wrap">

<h2 class="ear">★ あなたの耳待ち(声・方針)— 出ると独自版が完成へ進む</h2>
<div class="hint">最終判定はあなたの耳。私からは決めない。</div>
${EAR.map(x => card(x, 'ear')).join('')}

<h2 class="data">◆ データ判断(pokechan_data.js マスターを変える話)</h2>
<div class="hint">勝手にマスターを変えない。承認をください。</div>
${DATA.map(x => card(x, 'data')).join('')}

<h2 class="done">✓ 済(忠実版・コミット済・カバー 252/490)</h2>
${DONE.map(x => card(x, 'done')).join('')}

<h2 class="todo">▶ 開通順・テンプレ todo(判断不要・進められる)</h2>
${TODO.map(x => card(x, 'todo')).join('')}

<h2 class="park">⏸ park(data-cleanup候補・今は止めない)</h2>
${PARK.map(x => card(x, 'park')).join('')}

</div></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'pending.html'), html);
console.log('生成: review/pending.html');
