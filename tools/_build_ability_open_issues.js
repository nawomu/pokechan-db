#!/usr/bin/env node
// _build_ability_open_issues.js — 特性監査R1/R2で「決着していないもの」を1枚のHTMLに出す。LLM不使用=引用と数え上げのみ。
//
// 3つの節を出す:
//   ① unknown        = 権威ページに書いていなくて判定できなかった観点(推測で埋めていない正直な保留)
//   ② extra_in_ours  = うちに在るが権威に無い記述(★うちの誤り/でっち上げの可能性がある=ネット調査の対象)
//   ③ champions印    = champions印 と ヤックン/ch/コーパスの有無が食い違う特性
//        ★2026-08-16に判明: /ch/ にページがあっても Championsに該当ポケモンが0なら「見つかりませんでした」になる
//          (実例=パワースポット: イシヘンジン専用でChampionsに連れて来れない)。
//          つまり「コーパスに本文がある」だけでは Championsに在る証拠にならない。この表は容疑者リストであって有罪リストではない。
//
// 使い方: node tools/_build_ability_open_issues.js
// 出力  : review/特性監査_未解決一覧.html
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const master = {};
J('master/abilities.json').items.forEach(a => { master[a.name] = a; });

const rounds = [
  { key: 'R1', lens: '効果の一字一句', file: 'reference/_ability_audit_round1.json' },
  { key: 'R2', lens: '数値と条件の一語', file: 'reference/_ability_audit_round2.json' },
];

const unknowns = [];   // {round, name, aspect, ours, note}
const extras = [];     // {round, name, aspect, ours, quote, note}
for (const r of rounds) {
  for (const e of J(r.file).results) {
    for (const c of ((e.found && e.found.checks) || [])) {
      if (c.stale_material) continue;              // 古い材料が原因の誤検出は出さない
      const row = { round: r.key, name: e.name, aspect: c.aspect, ours: c.ours, quote: c.authority_quote, note: c.note };
      if (c.verdict === 'unknown') unknowns.push(row);
      if (c.verdict === 'extra_in_ours') extras.push(row);
    }
  }
}

// ③ champions印 と コーパスの食い違い
const chk = J('reference/_ability_champions_meta_check.json');
const champRows = chk.rows.filter(r => r.problems.every(p => p.startsWith('参考:')));

// 特性ごとに unknown をまとめる(1行1観点だと900行超えて読めないため、名前でグルーピング)
const byName = {};
for (const u of unknowns) (byName[u.name] = byName[u.name] || []).push(u);
const unknownNames = Object.keys(byName).sort((a, b) => byName[b].length - byName[a].length);

const html = `<meta charset="utf-8">
<title>特性監査 未解決一覧 — unknown / うちにしかない記述 / champions印</title>
<style>
:root{--bg:#fbfbfd;--fg:#1d1d1f;--muted:#6e6e73;--line:#e3e3e8;--card:#fff;--accent:#0a84ff;--warn:#b8860b;--bad:#c0392b}
@media (prefers-color-scheme:dark){:root{--bg:#161618;--fg:#f2f2f5;--muted:#9a9aa2;--line:#2e2e33;--card:#1e1e21}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.75 -apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:26px;margin:0 0 6px}
h2{font-size:20px;margin:44px 0 6px;padding-top:20px;border-top:2px solid var(--line)}
.lead{color:var(--muted);margin:0 0 24px}
.note{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:8px;padding:14px 16px;margin:14px 0}
.note.warn{border-left-color:var(--warn)}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600;white-space:nowrap;position:sticky;top:0;background:var(--bg)}
.tblwrap{overflow-x:auto}
.name{font-weight:600;white-space:nowrap}
.badge{display:inline-block;font-size:11px;padding:1px 7px;border-radius:99px;border:1px solid var(--line);color:var(--muted);margin-right:5px}
.q{color:var(--muted);font-size:13px}
details{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:8px 0}
summary{cursor:pointer;font-weight:600}
.cnt{color:var(--muted);font-weight:400;font-size:13px;margin-left:8px}
.ours{background:rgba(255,200,0,.12);padding:1px 4px;border-radius:3px}
</style>
<div class="wrap">
<h1>特性監査 未解決一覧</h1>
<p class="lead">ラウンド1(効果の一字一句)+ ラウンド2(数値と条件の一語)を312件ずつ完走したあとに残った、決着していないもの。生成 ${new Date().toISOString().slice(0, 10)} ・ LLM不使用(引用と数え上げのみ)</p>

<div class="note">
<b>読み方</b><br>
① <b>unknown</b> = 権威ページに書いていなくて判定できなかった観点。<b>推測で埋めていない</b>という意味であって、うちが間違っている印ではない。<br>
② <b>うちにしかない記述</b> = 権威に見当たらないのに、うちの説明文やデータに在るもの。<b>ここが一番あやしい</b>(でっち上げ・古い世代の情報・別の特性からの混入の可能性)。<br>
③ <b>champions印</b> = うちの印とヤックン/ch/コーパスの有無が食い違う特性。<b>容疑者リストであって有罪リストではない</b>(下記)。
</div>

<h2>① unknown — 権威に記載がなくて判定できなかった<span class="cnt">${unknowns.length}件 / ${unknownNames.length}特性</span></h2>
<div class="note">
<b>方針(2026-08-16 阿部さん決定)</b>: <b>simの宿題に回す</b>。持ち物の396件と同じく、説明文には足さず sim実装課題として退避する。<br>
説明文はわざと短い設計なので、権威に無いことを説明文に書き足すのは筋が悪い。
</div>
${unknownNames.map(n => `<details><summary>${esc(n)}<span class="cnt">${byName[n].length}件</span></summary>
<div class="tblwrap"><table>
<tr><th>R</th><th>観点</th><th>うちの記述</th><th>メモ</th></tr>
${byName[n].map(u => `<tr><td><span class="badge">${u.round}</span></td><td>${esc(u.aspect)}</td><td class="ours">${esc(u.ours)}</td><td class="q">${esc(u.note)}</td></tr>`).join('\n')}
</table></div></details>`).join('\n')}

<h2>② うちにしかない記述 — ★ネットで裏を取る対象<span class="cnt">${extras.length}件</span></h2>
<div class="note warn">
<b>★ここを最優先で調べる(2026-08-16 阿部さん指示)</b>: 「うちにしかない」= <b>間違いかもしれない</b>。
ポケモンWiki・徹底攻略・GameWith 等でネット調査して、実在する仕様なのか、うちのでっち上げ/古い世代の混入なのかを1件ずつ判定する。<br>
<b>実例(2026-08-16)</b>: パワースポットの「(味方全員か隣だけかは未検証)」は<b>ヤックンの未検証メモをそのまま写していた</b>。
Wikiは「自分以外の味方」と明記していて未検証ではない。=<b>他人の「わからない」をうちのSSOTに持ち込んでいた</b>。
</div>
<div class="tblwrap"><table>
<tr><th>R</th><th>特性</th><th>観点</th><th>うちの記述</th><th>メモ</th></tr>
${extras.map(x => `<tr><td><span class="badge">${x.round}</span></td><td class="name">${esc(x.name)}</td><td>${esc(x.aspect)}</td><td class="ours">${esc(x.ours)}</td><td class="q">${esc(x.note)}</td></tr>`).join('\n')}
</table></div>

<h2>③ champions印 と ヤックン/ch/コーパスの食い違い<span class="cnt">${champRows.length}件</span></h2>
<div class="note">
<b>★2026-08-16に機構が判明した</b>: ヤックン<code>/ch/</code>は<b>全特性のページを持っている</b>。Championsに該当ポケモンが1体も居なければ
「条件に一致するポケモンは見つかりませんでした」と出るだけで、<b>ページの存在はChampionsに在る証拠にならない</b>。<br>
実例= <b>パワースポット</b>(イシヘンジン専用・Championsに連れて来れない)→ <code>/ch/</code>にページはあるがポケモン一覧は空 → うちの <code>champions:false</code> が<b>正しい</b>。<br>
<b>機械検査では、うちの印と所持ポケモン数の矛盾は0件</b>(<code>tools/_check_ability_champions_meta.js</code>)。
つまりこの表は<b>容疑者リスト</b>であって、全部が誤りという意味ではない。数件サンプルで裏を取れば足りる見込み。
</div>
<div class="tblwrap"><table>
<tr><th>特性</th><th>うちの印</th><th>うちで数えた所持数</th><th>/ch/に本文</th><th>Championsでの所持者</th></tr>
${champRows.map(r => `<tr><td class="name">${esc(r.name)}</td><td>${r.champions_stored}</td><td>${r.count_actual}</td><td>${r.corpus_has_body ? 'あり' : 'なし'}</td><td class="q">${esc((r.owners || []).join('、')) || '—'}</td></tr>`).join('\n')}
</table></div>

</div>`;

fs.writeFileSync(path.join(ROOT, 'review/特性監査_未解決一覧.html'), html);
console.log(`① unknown ${unknowns.length}件 / ${unknownNames.length}特性`);
console.log(`② うちにしかない記述 ${extras.length}件`);
console.log(`③ champions印の食い違い ${champRows.length}件`);
console.log('→ review/特性監査_未解決一覧.html');
