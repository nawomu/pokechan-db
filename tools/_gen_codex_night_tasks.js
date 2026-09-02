// tools/_gen_codex_night_tasks.js — 夜間Codex用タスク生成(2026-09-02夜)
// A: reference/_move_mismatch_numeric_verified.json の master_wrong 93件を独立に再判定(第二の目)
// B: 技監査R1の missing_in_ours 1394件(473技)を仕分け(effects設計の材料。適用はしない)
// 使い方: node tools/_gen_codex_night_tasks.js <材料dir> <出力dir>
const fs = require('fs'), path = require('path');
const [MAT, OUTDIR] = process.argv.slice(2);
if (!MAT || !OUTDIR) { console.error('usage: <材料dir> <出力dir>'); process.exit(1); }
fs.mkdirSync(OUTDIR, { recursive: true });
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const rule = `★出典の優先順位(憲法): master_row.champions=true → 正典=yakkun_ch_row(WikiとCh行の数値差は仕様。Championsは意図的にPP/威力/命中を変えている)。champions=false → 権威=Wiki(最新世代の値。「95(第五世代まで)→90(第六世代以降)」は一番新しい世代を採る)。ch行は一次資料(循環参照扱いしない)。記憶で補完しない(ページに無ければunclear)。引用の無い判定は書かない。ファイルは一切書き換えない。`;

// ---- A ----
const V = J('reference/_move_mismatch_numeric_verified.json');
const byS = {};
V.items.filter(i => i.verdict === 'master_wrong').forEach(i => (byS[i.slug] = byS[i.slug] || []).push(i));
const A = { out: 'reference/_move_mismatch_numeric_codex', tasks: [] };
for (const [slug, items] of Object.entries(byS)) {
  const file = path.join(MAT, slug + '.json');
  if (!fs.existsSync(file)) continue;
  const list = items.map(i => `- aspect=${i.aspect} / うちの値=${i.ours} / 先行検証の主張: 正しい値=${i.correct_value}(根拠引用「${(i.quote_wiki || i.quote || '').replace(/\n/g, ' ')}」)`).join('\n');
  A.tasks.push({ slug, prompt: `あなたは独立の再検証担当(第二の目)。技1件(slug=${slug})について、先行検証が「マスターが間違い」と判定した項目を、先入観なしに自分でページを読み直して確かめる。
まず ${file} を読む(master_row / yakkun_ch_row / wiki_path)。wiki_path が null でなければその生ページを全文読む。
${rule}
検証する項目:
${list}
各項目について: verdict = confirm(先行検証どおりマスターが間違い・正しい値も一致) / refute(マスターは正しい or 先行の正しい値が違う) / unclear(ページから決まらない)。correct_value は自分がページから読み取った値。quote はページに一字一句実在する原文。
最後のメッセージは次のJSONだけ(前後に文章を付けない): {"slug":"${slug}","items":[{"aspect":str,"ours":str,"verdict":"confirm|refute|unclear","correct_value":str,"quote":str,"source":"ch_row|wiki","why":str}]}` });
}
fs.writeFileSync(path.join(OUTDIR, 'codex_tasks_A_numeric.json'), JSON.stringify(A, null, 1));

// ---- B ----
const R = J('reference/_move_audit_round1.json');
const B = { out: 'reference/_move_missing_codex_r1', tasks: [] };
for (const r of (Array.isArray(R.results) ? R.results : Object.values(R.results))) {
  const slug = r.slug;
  const cs = ((r.found && r.found.checks) || []).filter(c => c.verdict === 'missing_in_ours');
  if (!cs.length) continue;
  const file = path.join(MAT, slug + '.json');
  if (!fs.existsSync(file)) continue;
  const list = cs.map((c, i) => `${i + 1}. aspect=${c.aspect}\n   うち=${(c.ours || '').replace(/\n/g, ' ')}\n   権威引用=「${(c.authority_quote || '').replace(/\n/g, ' ')}」\n   note=${(c.note || '').replace(/\n/g, ' ')}`).join('\n');
  B.tasks.push({ slug, prompt: `あなたは仕分け担当。技1件(slug=${slug})について、監査R1が「うちに無い(missing_in_ours)」とした指摘を一つずつ確かめて仕分ける。まとめない。急がない。
まず ${file} を読む(master_row=うちのデータ。battle_data.effects がバトルsimの土台 / yakkun_ch_row=Champions正典行 / wiki_path=Wiki生ページ。null以外なら全文読む)。
${rule}
指摘一覧:
${list}
各指摘を次のどれかに仕分ける:
- real_gap: 権威に在る機構/意味が、master_row の description にも battle_data.effects にも本当に無い(sim/説明文に影響)
- already_in_ours: 実は effects か description に別の形で入っている(どのキーに在るか書く)
- out_of_scope: Championsに無い技の世代限定仕様/Championsで存在しない要素(ダイマックス・Z等の周辺仕様)/一般ルールで技側に書く必要が無いもの(理由を書く)
- auditor_error: 監査の読み違い(引用が原文に無い・意味の取り違え)
- unclear: ページから決まらない
real_gap には severity(high=ダメージ/命中/発動条件が変わる, mid=細則, low=表示だけ)と、effects にどう入れるべきかの短い提案(既存のkind名を使えるなら書く。新kindが要るなら "new_kind" と書く)を付ける。
最後のメッセージは次のJSONだけ(前後に文章を付けない): {"slug":"${slug}","items":[{"no":int,"aspect":str,"class":"real_gap|already_in_ours|out_of_scope|auditor_error|unclear","severity":"high|mid|low|","where_in_ours":str,"proposal":str,"quote":str,"why":str}],"summary":str}` });
}
fs.writeFileSync(path.join(OUTDIR, 'codex_tasks_B_missing.json'), JSON.stringify(B, null, 1));
console.log('A(numeric 第二の目):', A.tasks.length, '技 / B(missing仕分け):', B.tasks.length, '技 →', OUTDIR);
