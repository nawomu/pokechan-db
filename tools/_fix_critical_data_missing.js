#!/usr/bin/env node
/* critical な data-missing を一括追加(2026-06-17 阿部さん全数スキャン結果より):
   各技で legacy に在って effects に無い「失敗条件」「タイプ相性無視」等を追加。
   compose 側はこのスクリプト後で対応する。
*/
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

function lit(t, marker) {
  const at = t.indexOf(marker); if (at < 0) return null;
  let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false;
  for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return { s, e: i + 1, text: t.slice(s, i + 1) }; } } }
  return null;
}

// 各技ごとに「現状」→「追加/修正」を関数で
const PATCHES = {
  // 一撃必殺: ignores_type_matchup フラグ追加
  hasamigirochin: (m) => {
    const e = m.battle_data.effects.find(x => x.kind === '一撃必殺');
    if (e && !e.ignores_type_matchup) { e.ignores_type_matchup = true; return 'effects[一撃必殺].ignores_type_matchup=true 追加'; }
    return null;
  },
  tsunodoriru: (m) => {
    const e = m.battle_data.effects.find(x => x.kind === '一撃必殺');
    if (e && !e.ignores_type_matchup) { e.ignores_type_matchup = true; return 'effects[一撃必殺].ignores_type_matchup=true 追加'; }
    return null;
  },
  // きあいパンチ: 攻撃前に技を受けたら失敗
  kiaipanchi: (m) => {
    const bd = m.battle_data;
    bd.fails_if = bd.fails_if || [];
    if (!bd.fails_if.some(f => f.type === 'hit_by_attacking_move_before_use')) {
      bd.fails_if.push({ type: 'hit_by_attacking_move_before_use', note: '攻撃するまでに相手の技を受けると失敗する' });
      return 'bd.fails_if[hit_by_attacking_move_before_use] 追加';
    }
    return null;
  },
  // ふいうち: 相手が攻撃技を選んでいない・既に行動済みで失敗
  fuiuchi: (m) => {
    const bd = m.battle_data;
    bd.fails_if = bd.fails_if || [];
    if (!bd.fails_if.some(f => f.type === 'target_not_selecting_attacking_move')) {
      bd.fails_if.push({ type: 'target_not_selecting_attacking_move', note: '相手がそのターン攻撃技を選んでいない、または既に行動済みのとき失敗する' });
      return 'bd.fails_if[target_not_selecting_attacking_move] 追加';
    }
    return null;
  },
  // はやてがえし: 相手が先制技を選んでいない・既に攻撃済みで失敗
  hayategaeshi: (m) => {
    const bd = m.battle_data;
    bd.fails_if = bd.fails_if || [];
    if (!bd.fails_if.some(f => f.type === 'target_not_selecting_priority_move')) {
      bd.fails_if.push({ type: 'target_not_selecting_priority_move', note: '相手がそのターン先制技を選んでいない、または既に攻撃済みのとき失敗する' });
      return 'bd.fails_if[target_not_selecting_priority_move] 追加';
    }
    return null;
  },
  // もえつきる: 自分がほのおタイプでないとき失敗
  moetsukiru: (m) => {
    const bd = m.battle_data;
    bd.fails_if = bd.fails_if || [];
    if (!bd.fails_if.some(f => f.type === 'user_not_type')) {
      bd.fails_if.push({ type: 'user_not_type', value: 'ほのお', note: '自分がほのおタイプでないと失敗する' });
      return 'bd.fails_if[user_not_type ほのお] 追加';
    }
    return null;
  },
  // はきだす: たくわえ数=0で失敗
  hakidasu: (m) => {
    const bd = m.battle_data;
    bd.fails_if = bd.fails_if || [];
    if (!bd.fails_if.some(f => f.type === 'no_stockpile')) {
      bd.fails_if.push({ type: 'no_stockpile', note: '「たくわえる」を1度も使っていない(たくわえ数=0)とき失敗する' });
      return 'bd.fails_if[no_stockpile] 追加';
    }
    return null;
  },
  // のみこむ: たくわえ数=0で失敗
  nomikomu: (m) => {
    const bd = m.battle_data;
    bd.fails_if = bd.fails_if || [];
    if (!bd.fails_if.some(f => f.type === 'no_stockpile')) {
      bd.fails_if.push({ type: 'no_stockpile', note: '「たくわえる」を1度も使っていない(たくわえ数=0)とき失敗する' });
      return 'bd.fails_if[no_stockpile] 追加';
    }
    return null;
  },
  // リサイクル: 既に道具を持っているとき失敗
  risaikuru: (m) => {
    const bd = m.battle_data;
    bd.fails_if = bd.fails_if || [];
    if (!bd.fails_if.some(f => f.type === 'user_holding_item')) {
      bd.fails_if.push({ type: 'user_holding_item', note: 'すでに道具を持っているとき失敗する' });
      return 'bd.fails_if[user_holding_item] 追加';
    }
    return null;
  },
  // アイアンローラー: フィールド未展開時に失敗
  aianrooraa: (m) => {
    const bd = m.battle_data;
    bd.fails_if = bd.fails_if || [];
    if (!bd.fails_if.some(f => f.type === 'no_field_active')) {
      bd.fails_if.push({ type: 'no_field_active', note: 'フィールドが何も張られていないとき失敗する' });
      return 'bd.fails_if[no_field_active] 追加';
    }
    return null;
  },
  // サイドチェンジ: 連続使用で成功率1/3
  saidochenji: (m) => {
    const e = m.battle_data.effects.find(x => x.kind === '位置入替');
    if (e && e.consecutive_success_multiplier == null) {
      e.consecutive_success_multiplier = 0.3333;
      return 'effects[位置入替].consecutive_success_multiplier=0.3333 追加';
    }
    return null;
  },
  // 倍返しの「ダメージ未受時失敗」(メタルバースト・ほうふく・カウンター・ミラーコート)
  metarubaasuto: (m) => {
    const e = m.battle_data.effects.find(x => x.kind === '倍返し');
    if (e && !e.requires_damage_taken) { e.requires_damage_taken = true; return 'effects[倍返し].requires_damage_taken=true 追加'; }
    return null;
  },
  houfuku: (m) => {
    const e = m.battle_data.effects.find(x => x.kind === '倍返し');
    if (e && !e.requires_damage_taken) { e.requires_damage_taken = true; return 'effects[倍返し].requires_damage_taken=true 追加'; }
    return null;
  },
  kauntaa: (m) => {
    const e = m.battle_data.effects.find(x => x.kind === '倍返し');
    if (e && !e.requires_damage_taken) { e.requires_damage_taken = true; return 'effects[倍返し].requires_damage_taken=true 追加'; }
    return null;
  },
  miraakooto: (m) => {
    const e = m.battle_data.effects.find(x => x.kind === '倍返し');
    if (e && !e.requires_damage_taken) { e.requires_damage_taken = true; return 'effects[倍返し].requires_damage_taken=true 追加'; }
    return null;
  },
};

const src = fs.readFileSync(FILE, 'utf8');
const WAZA_LIT = lit(src, 'const WAZA_MAP =');
const WAZA_START = WAZA_LIT.s;
const WAZA_MAP = JSON.parse(WAZA_LIT.text);

let out = src, changed = 0;
for (const [key, fn] of Object.entries(PATCHES)) {
  const m = WAZA_MAP[key]; if (!m) { console.log(`SKIP ${key}: 技が見つからない`); continue; }
  const next = JSON.parse(JSON.stringify(m));
  const note = fn(next);
  if (!note) { console.log(`OK ${key}: 変更不要(既に対応済)`); continue; }
  console.log(`### ${m.name} (${key}): ${note}`);
  const keyMarker = `"${key}":`;
  const obj = lit(out.slice(WAZA_START), keyMarker); if (!obj) { console.log(`  ERR: ${key} がWAZA_MAP内に見つからない`); continue; }
  const sG = obj.s + WAZA_START, eG = obj.e + WAZA_START;
  const replaced = JSON.stringify(next, null, 2).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n');
  out = out.slice(0, sG) + replaced + out.slice(eG);
  changed++;
}

console.log(`\n変更技数: ${changed}/${Object.keys(PATCHES).length}`);
if (WRITE && changed > 0) {
  fs.writeFileSync(FILE, out);
  console.log('✓ pokechan_data.js に書き込みました');
} else if (changed > 0) {
  console.log('(dry-run / --write で実書込み)');
}
