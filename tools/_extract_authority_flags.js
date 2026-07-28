#!/usr/bin/env node
/**
 * _extract_authority_flags.js — 権威コーパス(ポケモンWiki)の「判定」表から技のフラグを機械抽出し、
 * うちのデータ(WAZA_MAP / kinds_batch の fire_level)と全数照合して食い違いを出す。
 *
 * 設計: 設計_権威コーパス構築_2026-07-28.md(F2構造化 + F3機械照合)
 * ★LLMを一切使わない=何度でも安く回せる。差分が出たものだけ人/エージェントが精査する。
 *
 * 使い方: node tools/_extract_authority_flags.js
 * 出力:   reference/_authority_flags.json  … 技ごとの権威フラグ
 *         reference/_authority_diff.json   … うちのデータとの食い違い
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MOVES_DIR = path.join(ROOT, 'reference', '_authority_corpus', 'moves');

/** 「| ラベル | 値 |」形式(インフォボックス)から値を取る */
function infobox(raw, label) {
  // 値は履歴が連なる形式がある: 「100 (第一世代)\n→60 (第二・三世代)\n→80 (第四世代以降)」
  // ★最後の→が現行値。最初の行だけ取ると過去世代の値を拾う(2026-07-28にこれで365件の偽差分を出した)。
  const re = new RegExp('\\|\\s*' + label + '\\s*\\n+\\s*\\|\\s*((?:[^\\n|]+\\n?)(?:→[^\\n|]+\\n?)*)');
  const m = raw.match(re);
  if (!m) return null;
  const chain = m[1].split(/→/).map(s => s.trim()).filter(Boolean);
  return chain[chain.length - 1] || null;
}

/** 「判定」ブロックの「・キー: 値」を拾う(世代別行は最新世代=最後の行を採用) */
function judge(raw, key) {
  // 例: 「・急所: 各回」「・命中判定: 初回のみ」「・おうじゃのしるし\n・第五世代以降: ○」
  const re = new RegExp('・' + key + '\\s*[:：]\\s*([^\\n]+)');
  const m = raw.match(re);
  if (m) return m[1].trim();
  // 世代別にぶら下がる形式: 「・<key>」の直後の行から最後の「第N世代…: 値」を拾う
  const idx = raw.indexOf('・' + key);
  if (idx < 0) return null;
  const tail = raw.slice(idx, idx + 400).split('\n').slice(1);
  let last = null;
  for (const line of tail) {
    const g = line.match(/^・第[一二三四五六七八九十]+世代[^:：]*[:：]\s*([^\s]+)/);
    if (g) last = g[1];
    else if (line.startsWith('・') && !/^・第/.test(line)) break;
  }
  return last;
}

const yes = v => v === '○' || v === '◯';
const no  = v => v === '×' || v === '✕';

function loadOurMoves() {
  const ctx = vm.createContext({ window: {}, document: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'pokechan_data_all.js'), 'utf8'), ctx, { filename: 'd.js' });
  const map = vm.runInContext('typeof WAZA_MAP !== "undefined" ? WAZA_MAP : {}', ctx);
  const byName = {};
  for (const k of Object.keys(map)) { const m = map[k]; if (m && m.name) byName[m.name] = m; }
  return byName;
}

const ours = loadOurMoves();
const files = fs.readdirSync(MOVES_DIR).filter(f => f.endsWith('.json'));
const flags = {};
const diffs = [];
let compared = 0;

for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(MOVES_DIR, f), 'utf8'));
  const raw = d.raw_text || '';
  const name = d.title;

  const a = {
    type: infobox(raw, 'タイプ'),
    category: infobox(raw, '分類'),
    power: infobox(raw, '威力'),
    accuracy: infobox(raw, '命中率'),
    pp: infobox(raw, 'PP'),
    range: infobox(raw, '範囲'),
    priority: infobox(raw, '優先度'),
    contact: infobox(raw, '直接攻撃'),
    effect: infobox(raw, '効果'),
    crit: judge(raw, '急所'),
    hit_check: judge(raw, '命中判定'),
    secondary: judge(raw, '追加効果'),
    protect: judge(raw, 'まもる'),
    kings_rock: judge(raw, 'おうじゃのしるし'),
    magic_coat: judge(raw, 'マジックコート'),
    snatch: judge(raw, 'よこどり'),
    mirror_move: judge(raw, 'オウムがえし'),
  };
  flags[name] = a;

  const o = ours[name];
  if (!o) { diffs.push({ move: name, field: '_存在', ours: '(うちに無い)', authority: 'あり', severity: '低' }); continue; }
  compared++;

  const cmpNum = (field, ourVal, authStr) => {
    if (authStr == null) return;
    const an = String(authStr).replace(/[^\d]/g, '');
    if (an === '') return;                       // 「—」「変化」等は比較しない
    if (ourVal == null) return;
    if (String(ourVal) !== an) diffs.push({ move: name, field, ours: ourVal, authority: authStr, severity: '高' });
  };
  cmpNum('power', o.power, a.power);
  cmpNum('accuracy', o.accuracy, a.accuracy);
  cmpNum('pp', o.pp, a.pp);

  if (a.type && o.type && a.type !== o.type)
    diffs.push({ move: name, field: 'type', ours: o.type, authority: a.type, severity: '高' });
  if (a.category && o.category && a.category !== o.category)
    diffs.push({ move: name, field: 'category', ours: o.category, authority: a.category, severity: '高' });
  if (a.priority != null && o.priority != null && String(o.priority) !== a.priority.replace(/[^\-\d]/g, ''))
    diffs.push({ move: name, field: 'priority', ours: o.priority, authority: a.priority, severity: '高' });

  if (a.contact != null && o.contact != null) {
    const auth = yes(a.contact) ? true : no(a.contact) ? false : null;
    if (auth !== null && auth !== !!o.contact)
      diffs.push({ move: name, field: 'contact(直接攻撃)', ours: !!o.contact, authority: a.contact, severity: '高' });
  }
  if (a.protect != null && o.protect != null) {
    const auth = yes(a.protect) ? true : no(a.protect) ? false : null;
    if (auth !== null && auth !== !!o.protect)
      diffs.push({ move: name, field: 'protect(まもる)', ours: !!o.protect, authority: a.protect, severity: '高' });
  }
}

// per-hit の権威根拠(急所=各回 → 連続技はヒット毎判定)を一覧化=fire_level検証の材料
const perHit = Object.entries(flags).filter(([, a]) => a.crit && /各回|毎回/.test(a.crit)).map(([n]) => n);

fs.writeFileSync(path.join(ROOT, 'reference/_authority_flags.json'), JSON.stringify(flags, null, 1));
fs.writeFileSync(path.join(ROOT, 'reference/_authority_diff.json'), JSON.stringify({
  meta: { at: new Date().toISOString(), corpus_moves: files.length, compared, source: 'wiki.pokemonwiki.com(内部参照専用)' },
  per_hit_moves: perHit,
  diffs,
}, null, 1));

const bySeverity = diffs.reduce((a, d) => (a[d.severity] = (a[d.severity] || 0) + 1, a), {});
const byField = diffs.reduce((a, d) => (a[d.field] = (a[d.field] || 0) + 1, a), {});
console.log(`コーパス ${files.length}件 / 照合 ${compared}件`);
console.log('差分:', JSON.stringify(bySeverity), '内訳:', JSON.stringify(byField, null, 0));
console.log('急所=各回(per-hit根拠) の技:', perHit.length, '件');
