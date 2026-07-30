/* _build_migration_check.js — ★引っ越し(②)の前に、阿部さんが1件ずつ見るための確認カードを作る
 *
 * 出典と経緯(2026-07-30 阿部さん):
 *   「一個一個調べないでバーッと回しちゃうところ」「似たようなまとまっているものを
 *    ちゃんと分けるかどうかの慎重さ」「チェックは本当のポケモンをやった人にしかわからない」
 *   憲法(設計_バトルエンジン原理_2026-07-26.md:10,13)
 *     「まとめない。ごまかさない。楽をしない。分けすぎて問題になることはない」
 *     「分割は情報を失わない。統合は失う。…後から読む人(次のセッションのAI含む)が勝手に解釈する」
 *
 * ★このスクリプトが守る線(回してよい側だけをやる):
 *   足さない・減らさない・混ぜない。具体的には——
 *   ✅ 原文をそのまま引く / 有無を数える / 差の場所を指す / 全件を漏れなく並べる
 *   ❌ 「同義」「劣化」等の判定を書く / まとめる / 代表例で済ます / 疑わしい順に並べ替える
 *   → 並び順は登場順のまま。省略なし。上位N件にしない。判定欄は空にして阿部さんが埋める。
 *
 * ★LLMを使わない。全部ローカルの権威コーパスとの決定的な突き合わせ。
 *   引用は必ず原文からの部分文字列(_verify で実在検査する)。
 *
 * 入力:
 *   reference/_master_diff.json                        旧→master の差分(旧文・新文)
 *   reference/_authority_corpus_ch/abilities_ch.json   ヤックン /ch/ 特性315
 *   reference/_authority_corpus/abilities/<名前>.json   ポケモンWiki 特性(世代別「説明文」節つき)
 *   reference/_authority_corpus/items/<名前>.json       ポケモンWiki 持ち物
 * 出力:
 *   reference/_migration_check.json    カード全件(機械可読)
 *   review/引っ越し内容確認.html        1件1カードの確認画面
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.join(ROOT, p);
const readJSON = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));
const exists = (p) => fs.existsSync(R(p));

// ── 材料 ────────────────────────────────────────────────────────────
const diff = readJSON('reference/_master_diff.json');
const sections = {};
for (const s of diff.sections) sections[s.title] = s.rows || [];

const chAb = new Map();
for (const a of readJSON('reference/_authority_corpus_ch/abilities_ch.json').abilities) {
  chAb.set(a.name, a);
}

/** Wikiの1ページを読む(無ければ null) */
function wikiPage(kind, name) {
  const p = `reference/_authority_corpus/${kind}/${name}.json`;
  return exists(p) ? readJSON(p) : null;
}

/**
 * Wikiの「説明文」節から Champions の行だけを取り出す。
 * ★構造: 世代見出し行(「第七世代・第八世代・第九世代」「Champions」等)の下に本文が続く。
 *   Champions見出しの次の行から、次の見出しらしき行までを返す。
 *   ★見つからなければ null を返す(でっち上げない)。
 */
function championsLine(page) {
  if (!page || !page.sections) return null;
  const body = page.sections['説明文'];
  if (!body) return null;
  const lines = body.split('\n');
  const i = lines.findIndex((l) => l.trim() === 'Champions');
  if (i < 0) return null;
  const out = [];
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (!t) { if (out.length) break; else continue; }
    // 次の世代見出し(「第○世代」で始まる/ソフト名だけの行)に当たったら止める
    if (/^第[一二三四五六七八九十]+世代/.test(t)) break;
    out.push(t);
  }
  return out.length ? out.join('\n') : null;
}

// ── 機械的事実タグ(★判定語を使わない。事実だけ) ─────────────────────
/**
 * 旧文の中の「数字を含む語」が新文に無いものを、位置つきで列挙する。
 * ★「消えた=劣化」とは書かない。「旧にあり新に無い」という事実だけ。
 */
function missingTokens(oldT, newT) {
  const o = oldT || '', n = newT || '';
  const toks = o.match(/\d+\/\d+|\d+\.\d+倍|\d+倍|\d+%|\d+ターン|\d+段階|\d+回/g) || [];
  const uniq = [...new Set(toks)];
  return uniq.filter((t) => !n.includes(t));
}

/** 新文にだけ在る「関連する項目」以降(=ページのナビ欄らしき部分)を、切らずにそのまま返す */
function navTail(newT) {
  const m = (newT || '').match(/関連する項目.*$/);
  return m ? m[0] : null;
}

/**
 * ★2つの権威(ヤックン/ch/ と Wiki の Champions節)の食い違いを「事実」として拾う。
 *   すながくれ型(片方にだけ効果が書かれている)を、代表例で済ませず全件で見つけるため。
 *   ★どちらが正しいかは書かない。「片方にしか無い言葉」を並べるだけ。
 *   語は「効果を表しそうな語」に限らず、文を句点・読点で割った断片の集合差を取る。
 */
const STOP = /^(また|そして|なお|ただし|この|その|それ|自分|相手|味方|場合|時|とき)$/;
function authorityGap(yakkun, wiki) {
  if (!yakkun || !wiki) return null;
  const frag = (t) => new Set(
    t.replace(/[『』（）()]/g, '')
      .split(/[。、\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4 && !STOP.test(s))
  );
  const y = frag(yakkun), w = frag(wiki);
  const onlyY = [...y].filter((s) => !wiki.includes(s));
  const onlyW = [...w].filter((s) => !yakkun.includes(s));
  if (!onlyY.length && !onlyW.length) return null;
  return { only_in_yakkun_ch: onlyY, only_in_wiki_champions: onlyW };
}

const cards = [];
let seq = 0;

// ── 特性: 説明文が変わるもの / 新しく説明が付くもの ────────────────
for (const [title, kind] of [
  ['特性: 説明文が変わるもの', 'ability_changed'],
  ['特性: 新しく説明が付くもの', 'ability_added'],
]) {
  for (const r of sections[title] || []) {
    const name = r.name;
    const ch = chAb.get(name) || null;
    const page = wikiPage('abilities', name);
    const champ = championsLine(page);
    const oldT = r.old || '';
    const newT = r.new || '';
    cards.push({
      seq: ++seq,
      group: title,
      kind,
      name,
      ours_old: oldT,
      ours_new: newT,
      authority_yakkun_ch: ch ? ch.effect : null,
      authority_wiki_champions: champ,
      wiki_url: page ? page.url : null,
      // ★機械的事実のみ
      facts: {
        new_is_empty: newT.trim() === '',
        new_matches_yakkun_ch: ch ? newT.trim() === (ch.effect || '').trim() : null,
        new_has_nav_tail: !!navTail(newT),
        nav_tail: navTail(newT),
        tokens_in_old_absent_from_new: missingTokens(oldT, newT),
        wiki_has_champions_line: champ != null,
        yakkun_ch_present: ch != null,
        // ★2権威で片方にしか無い言葉(すながくれ型を全件で拾う。どちらが正しいかは書かない)
        authority_gap: authorityGap(ch ? ch.effect : null, champ),
      },
      judgement: '',   // ★空。阿部さんが埋める
      note: '',
    });
  }
}

// ── 持ち物: 効果文が変わるもの ─────────────────────────────────────
for (const r of sections['持ち物: 効果文が変わるもの'] || []) {
  const name = r.name;
  const page = wikiPage('items', name);
  const champ = championsLine(page);
  const oldT = r.old || '';
  const newT = r.new || '';
  cards.push({
    seq: ++seq,
    group: '持ち物: 効果文が変わるもの',
    kind: 'item_changed',
    name,
    ours_old: oldT,
    ours_new: newT,
    authority_yakkun_ch: null,       // ★持ち物のch原文は未取得(items_ch.json が無い)=正直に null
    authority_wiki_champions: champ,
    wiki_url: page ? page.url : null,
    facts: {
      new_is_empty: newT.trim() === '',
      new_matches_yakkun_ch: null,
      new_has_nav_tail: !!navTail(newT),
      nav_tail: navTail(newT),
      tokens_in_old_absent_from_new: missingTokens(oldT, newT),
      wiki_has_champions_line: champ != null,
      yakkun_ch_present: null,
      wiki_page_present: page != null,
    },
    judgement: '',
    note: '',
  });
}

// ── 技(値が変わる) / ポケモン(名前) / 消えるもの も1件1カードで載せる ──
for (const r of sections['技: 値が変わるもの'] || []) {
  cards.push({
    seq: ++seq, group: '技: 値が変わるもの', kind: 'move_value', name: r.name,
    ours_old: `${r.field} = ${r.old}`, ours_new: `${r.field} = ${r.new}`,
    authority_yakkun_ch: null, authority_wiki_champions: null, wiki_url: null,
    facts: { field: r.field, source: r.source }, judgement: '', note: '',
  });
}
for (const r of sections['技: masterから消えるもの'] || []) {
  cards.push({
    seq: ++seq, group: '技: masterから消えるもの', kind: 'move_removed', name: r.name,
    ours_old: '(存在した)', ours_new: '(master に無い)',
    authority_yakkun_ch: null,
    authority_wiki_champions: null,
    wiki_url: null,
    facts: { why: r.why, wiki_page_present: wikiPage('moves', r.name) != null },
    judgement: '', note: '',
  });
}
for (const r of sections['ポケモン: 名前が正式名称に変わるもの'] || []) {
  cards.push({
    seq: ++seq, group: 'ポケモン: 名前が正式名称に変わるもの', kind: 'pokemon_name', name: r.old,
    ours_old: r.old, ours_new: r.new,
    authority_yakkun_ch: null, authority_wiki_champions: null, wiki_url: null,
    facts: { display_name: r.display, display_unchanged: r.display === r.old },
    judgement: '', note: '',
  });
}
for (const r of sections['学習データ: 変わるもの'] || []) {
  cards.push({
    seq: ++seq, group: '学習データ: 変わるもの', kind: 'learnset', name: r.name,
    ours_old: `覚える技 ${r['旧']}件`, ours_new: `覚える技 ${r['新']}件(没収 ${r['没収']}件)`,
    authority_yakkun_ch: null, authority_wiki_champions: null, wiki_url: null,
    facts: { removed: r['消える'] || [], added_sample: r['増える'] || [] },
    judgement: '', note: '',
  });
}

// ── ★引用の実在検査(コーパスに無い文字列を1つも書いていないこと) ──────
const verify = { checked: 0, ng: [] };
for (const c of cards) {
  if (c.authority_yakkun_ch) {
    verify.checked++;
    const src = chAb.get(c.name);
    if (!src || src.effect !== c.authority_yakkun_ch) {
      verify.ng.push({ seq: c.seq, name: c.name, why: 'yakkun_ch 引用がコーパスと不一致' });
    }
  }
  if (c.authority_wiki_champions) {
    verify.checked++;
    const kind = c.kind.startsWith('item') ? 'items' : 'abilities';
    const page = wikiPage(kind, c.name);
    const raw = page ? (page.sections?.['説明文'] || '') : '';
    // 引用は原文の部分文字列でなければならない(行結合したので行ごとに検査)
    const ok = c.authority_wiki_champions.split('\n').every((l) => raw.includes(l));
    if (!ok) verify.ng.push({ seq: c.seq, name: c.name, why: 'wiki 引用が原文に見つからない' });
  }
}

fs.writeFileSync(R('reference/_migration_check.json'),
  JSON.stringify({ generated_at: new Date().toISOString(), total: cards.length, verify, cards }, null, 1));

console.log('=== 引っ越し確認カード ===');
console.log(`  カード総数: ${cards.length} 件(★並べ替えなし・省略なし)`);
const byGroup = {};
for (const c of cards) byGroup[c.group] = (byGroup[c.group] || 0) + 1;
for (const [g, n] of Object.entries(byGroup)) console.log(`    ${g}: ${n} 件`);
console.log(`  引用の実在検査: ${verify.checked} 件を検査 / NG ${verify.ng.length} 件`);
if (verify.ng.length) console.log('   ', JSON.stringify(verify.ng.slice(0, 5)));
console.log('  出力: reference/_migration_check.json');
