/* SSOT修正: まもりファミリー6技の effects 記法を統一(2026-06-11 まもりファミリー実装時)
 *
 * 背景: kind「まもり」の6エントリで連続使用低下・防ぐ範囲の記法がバラバラだった。
 *   まもる        : blocks="the opponent's…"(英語散文) / consecutive_use:{rate_multiplier_per_consecutive_use}
 *   みきり        : 連続使用低下の宣言なし(fails_ifの英語散文のみ)
 *   ニードルガード: 別エントリ {"kind":"連続成功率低下", "success_multiplier":0.333}
 *   キングシールド/トーチカ: blocks="opponent_damaging_moves"(英語) / 連続使用低下の宣言なし
 *   ファストガード: blocks="moves with priority above normal…"(英語散文のみ・機械可読キーなし)
 * → エンジンに全表記の分岐を足すのでなくデータを揃える(effects-sim-phase-first / 英語禁止標準)。
 *
 * 統一記法(まもりエントリ内):
 *   consecutive_success_multiplier: 0.3333 … 連続使用で成功率が掛かる(なし=連続でも失敗しない)
 *   blocks_status_moves: false           … 変化技は防がない(キングシールド/トーチカ)
 *   blocks_priority_only: true           … 先制技(優先度>0)だけ防ぐ(ファストガード)
 * 出典: Bulbapedia "Protect"/"Detect"/"Spiky Shield"/"King's Shield"/"Baneful Bunker"/"Quick Guard"
 *   (ファストガードは第6世代以降、連続使用でも失敗しない=multiplierなし)
 * compose は「まもり」「連続成功率低下」「consecutive_use」をどれも読まない(grep確認済み・
 * 読むのは「まもり貫通」のみ=本修正では触らない)ため説明文出力は不変=ヤックン耳への影響なし。
 *
 * 実行: node tools/_fix_protect_effects.js        … dry-run
 *       node tools/_fix_protect_effects.js --write … 書き込み
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

let txt = fs.readFileSync(FILE, 'utf8');

// 生テキストは `"key": value` 形式(コロン・カンマ後にスペース) → 同形式で置換する
const FIXES = [
  {
    name: 'まもる(英語blocks削除+consecutive_use→統一キー)',
    from: '{"kind": "まもり", "target": "self", "phase": "this_turn", "blocks": "the opponent\'s moves this turn", "consecutive_use": {"first_use_success_rate": 1, "rate_multiplier_per_consecutive_use": 0.3333, "reset_on_failure": true}, ',
    to:   '{"kind": "まもり", "target": "self", "phase": "this_turn", "consecutive_success_multiplier": 0.3333, ',
  },
  {
    name: 'みきり(連続使用低下を宣言)',
    from: '{"kind": "まもり", "target": "self", "phase": "this_turn", "partial_bypass": {"by": ["ダイマックスわざ", "Zわざ(攻撃)"], "damage_fraction": 0.25}}',
    to:   '{"kind": "まもり", "target": "self", "phase": "this_turn", "consecutive_success_multiplier": 0.3333, "partial_bypass": {"by": ["ダイマックスわざ", "Zわざ(攻撃)"], "damage_fraction": 0.25}}',
  },
  {
    name: 'ニードルガード(別エントリ「連続成功率低下」→まもり内の統一キー)',
    from: '{"kind": "まもり", "target": "self", "phase": "this_turn"}, {"kind": "連続成功率低下", "target": "self", "phase": "on_use", "success_multiplier": 0.333}, ',
    to:   '{"kind": "まもり", "target": "self", "phase": "this_turn", "consecutive_success_multiplier": 0.3333}, ',
  },
  {
    name: 'キングシールド(英語blocks削除+連続使用低下を宣言)',
    from: '{"kind": "まもり", "target": "self", "phase": "this_turn", "blocks": "opponent_damaging_moves", "blocks_status_moves": false}, {"kind": "能力ランク変化", "target": "opponent", "stat": "attack", "stages": -1, ',
    to:   '{"kind": "まもり", "target": "self", "phase": "this_turn", "consecutive_success_multiplier": 0.3333, "blocks_status_moves": false}, {"kind": "能力ランク変化", "target": "opponent", "stat": "attack", "stages": -1, ',
  },
  {
    name: 'トーチカ(英語blocks削除+連続使用低下を宣言)',
    from: '{"kind": "まもり", "target": "self", "phase": "this_turn", "blocks": "opponent_damaging_moves", "blocks_status_moves": false}, {"kind": "状態付与", "target": "opponent", "value": "どく", ',
    to:   '{"kind": "まもり", "target": "self", "phase": "this_turn", "consecutive_success_multiplier": 0.3333, "blocks_status_moves": false}, {"kind": "状態付与", "target": "opponent", "value": "どく", ',
  },
  {
    name: 'ファストガード(英語blocks散文→機械可読キー。日本語effect散文は残す)',
    from: '{"kind": "まもり", "target": "team", "phase": "this_turn", "effect": "そのターン、相手の先制技から自分と味方を守る", "blocks": "moves with priority above normal, including priority granted by abilities"}',
    to:   '{"kind": "まもり", "target": "team", "phase": "this_turn", "blocks_priority_only": true, "effect": "そのターン、相手の先制技から自分と味方を守る"}',
  },
];

let ok = true;
for (const f of FIXES) {
  const i = txt.indexOf(f.from);
  if (i < 0) { console.log(`❌ ${f.name}: 置換対象が見つからない`); ok = false; continue; }
  if (txt.indexOf(f.from, i + 1) >= 0) { console.log(`❌ ${f.name}: 置換対象が複数`); ok = false; continue; }
  txt = txt.slice(0, i) + f.to + txt.slice(i + f.from.length);
  console.log(`✅ ${f.name}: 置換OK`);
}
if (!ok) { console.log('中断(書き込みなし)'); process.exit(1); }

if (WRITE) {
  fs.writeFileSync(FILE, txt);
  console.log(`\n書き込み完了(${FIXES.length}件)`);
} else {
  console.log('\n(dry-run: --write で書き込み)');
}
