/* note(英語)→ 日本語(小学校低学年向け)対訳表。データには書かず確認用HTMLを出す。
 * drop:true = 世代差など、子ども向けには不要そう(削除候補)。
 * 実行: node tools/_waza_note_ja.js → review/waza_note_ja.html */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const en = require(path.join(ROOT, 'review', '_en_notes.json'));

// EN(完全一致) → { ja, drop? }
const M = {
  "triggers even for non-grounded Pokemon": { ja: "シードの道具を持っていれば、地面にいないポケモンにも効く" },
  "x1.5 up to Gen 7": { ja: "第7世代までは1.5倍だった", drop: true },
  "terrain's own 1.3x boost applies separately and stacks": { ja: "フィールド自体の1.3倍は別にかかり、重ねがけになる" },
  "only the last physical hit taken is counted": { ja: "最後に受けた物理わざのダメージだけが対象" },
  "badly poisoned: turn-end damage increases by 1/16 of max HP each turn (1/16, 2/16, 3/16...)": { ja: "『もうどく』は、毎ターン終わりに受けるダメージが最大HPの1/16ずつ増えていく(1/16→2/16→3/16…)" },
  "gen7+ で連続使用は必ず失敗": { ja: "続けて使うと必ず失敗する" },
  "active while sandstorm is in effect": { ja: "すなあらしが続いている間ずっと効果がある" },
  "1/16 of max HP each turn during sandstorm": { ja: "すなあらしの間、毎ターン最大HPの1/16のダメージ" },
  "hits the Pokemon occupying the target slot 2 turns later, even if the original target has switched out": { ja: "2ターン後に、その場所にいるポケモンに当たる。最初の相手が引っこんでいても当たる" },
  "user is forced to repeat this move for 3 turns": { ja: "3ターンの間、この技を出し続ける(ほかの行動は選べない)" },
  "no Pokemon on the field can fall asleep while any user is rampaging": { ja: "あばれている間、場のどのポケモンも眠れなくなる" },
  "increases the effect of のみこむ (Swallow) and はきだす (Spit Up)": { ja: "『のみこむ』『はきだす』の効果が大きくなる" },
  "removes the Defense/Special Defense stage increases gained from Stockpile and clears the Stockpile count": { ja: "『たくわえる』で上がった『ぼうぎょ』『とくぼう』を元に戻し、たくわえた数を0にする" },
  "removes the Defense/Special Defense rank boosts that たくわえる had granted and resets the Stockpile count to 0": { ja: "『たくわえる』で上がった『ぼうぎょ』『とくぼう』を元に戻し、たくわえた数を0にする" },
  "this is the Torment effect (consecutive same-move lock), not the Taunt status-move lock": { ja: "これは『いちゃもん』(同じ技を続けて出せない)の効果。『ちょうはつ』とは別" },
  "all single-target moves from opponents this turn are redirected to the user": { ja: "そのターン、相手が1体をねらう技がすべて自分に向く" },
  "persists until the user uses an Electric move; in gen 8 and earlier it expired at the end of the next turn": { ja: "でんきタイプの技を使うまで効果が続く" },
  "succeeds even when only one side holds an item": { ja: "どちらか一方しか道具を持っていなくても成功する" },
  "power doubles (50->100) when any of the listed weathers is active; derived Dynamax moves and Gen7 Z-Moves also inherit the changed type": { ja: "決まった天気の時、威力が2倍(50→100)になる。変わったタイプはダイマックスわざ等にも引き継がれる" },
  "lower remaining HP means lower power": { ja: "残りHPが少ないほど威力が下がる" },
  "puts target into fainted state": { ja: "相手をひんしにする" },
  "accuracy is 30% when user is Ice-type, otherwise 20%": { ja: "自分がこおりタイプなら命中30%、それ以外は20%" },
  "Gen 8 onward affects all allies; Gen 7 and earlier affected only the user": { ja: "味方全員に効く" },
  "power increases as user is slower than target": { ja: "自分が相手より遅いほど威力が高くなる" },
  "steals the target held berry and the user eats it": { ja: "相手の持っている『きのみ』を奪って、自分が食べる" },
  "item-specific power and side effects vary; e.g. status berries inflict their effect, Iron Ball etc. have fixed power": { ja: "持っている道具によって威力や追加効果が変わる(例: 状態異常のきのみはその効果、くろいてっきゅう等は決まった威力)" },
  "swaps actual stat values; ranks unchanged": { ja: "実際の『こうげき』と『ぼうぎょ』の数値を入れかえる(ランクは変わらない)" },
  "if the last move was a Max Move, the base move is used instead": { ja: "直前の技がダイマックスわざだった時は、元の技をまねする" },
  "ignores user accuracy and target evasion; always hits": { ja: "命中率・回避率に関係なく必ず当たる" },
  "uses target's physical Defense stat instead of Special Defense for damage calculation despite being a special move": { ja: "特殊技だけど、ダメージは相手の『ぼうぎょ』(物理)で計算する" },
  "removes these floating states and the target can no longer use でんじふゆう/テレキネシス while grounded": { ja: "相手の浮いている状態を解除し、その間『でんじふゆう』『テレキネシス』を使えなくする" },
  "7th generation onward": { ja: "第7世代以降", drop: true },
  "uses the target's Attack (with the target's own stat-stage changes) in place of the user's Attack": { ja: "自分ではなく相手の『こうげき』(相手のランク変化も込み)でダメージを計算する" },
  "power is doubled (60->120) when this is not the first Round used this turn": { ja: "そのターンで最初の『りんしょう』でない時、威力が2倍(60→120)になる" },
  "doubles-oriented mechanic": { ja: "ダブルバトル向けの仕組み" },
  "sound move ignores target's Substitute": { ja: "音の技なので、相手の『みがわり』を貫通する" },
  "ignores user accuracy and target evasion": { ja: "命中率・回避率に関係なく当たる" },
  "sets all of the target's stat rank changes back to 0": { ja: "相手の能力ランクの変化をすべて0に戻す" },
  "adds 20 power for every +1 stat stage the user currently has across all stats": { ja: "自分の能力ランクが1段階上がっているごとに威力が20増える(すべての能力の合計)" },
  "can be used while frozen and removes the user's freeze": { ja: "こおっていても使え、自分のこおりが溶ける" },
  "thaws the target if it is frozen": { ja: "相手がこおっていたら溶かす" },
  "if target is Terastallized, copy the Tera type; but if target is Terastallized into Stellar, copy the target's original types instead": { ja: "相手がテラスタルしていればテラスタイプをコピー。ただしステラの時は相手の元のタイプをコピーする" },
  "deals damage ignoring the target's defensive stat-stage changes": { ja: "相手の『ぼうぎょ』『とくぼう』のランク変化を無視してダメージを与える" },
  "power determined by ratio of target weight to user weight": { ja: "相手と自分の重さの比べっこで威力が決まる" },
  "triggers even for non-grounded Pokemon holding Grassy Seed": { ja: "『グラスシード』を持っていれば、地面にいないポケモンにも効く" },
  "x1.5 up to Gen7, x1.3 from Gen8": { ja: "第7世代までは1.5倍、第8世代からは1.3倍", drop: true },
  "applies to all grounded Pokemon while terrain is active": { ja: "フィールドが続く間、地面にいるすべてのポケモンに効く" },
  "move counts as both かくとう and ひこう type for type effectiveness": { ja: "この技はかくとうタイプであり、同時にひこうタイプとしても相性が計算される" },
  "all Pokemon that are not Ghost-type are trapped": { ja: "ゴーストタイプ以外のすべてのポケモンが逃げられなくなる" },
  "applies up to Pokemon SV": { ja: "ポケモンSVまでの仕様", drop: true },
  "triggers even for non-grounded Pokemon holding Misty Seed": { ja: "『ミストシード』を持っていれば、地面にいないポケモンにも効く" },
  "grounded Pokemon cannot be given status conditions; already-existing status conditions are not cured": { ja: "地面にいるポケモンは状態異常にならない(すでにかかっている状態異常は治らない)" },
  "lowered by 2 stages up to Gen 7": { ja: "第7世代までは2段階下げた", drop: true },
  "does not cure already-sleeping Pokemon": { ja: "すでに眠っているポケモンは起こさない" },
  "e.g. はかいこうせん, ダイマックスほう and certain other moves fail": { ja: "例: 『はかいこうせん』『ダイマックスほう』など一部の技では失敗する" },
  "does not block ally priority moves": { ja: "味方の先制技は防がない" },
  "burns any Pokemon that hits the user with a contact move before this move activates this turn; the move is still executed afterward": { ja: "この技が出る前に接触技で攻撃してきた相手をやけどにする。技はそのあとちゃんと出る" },
  "when used on an ally it heals instead of dealing damage": { ja: "味方に使うと、ダメージではなくHPを回復する" },
  "if stat cannot be lowered, only the heal applies": { ja: "相手の能力を下げられない時は、回復だけする" },
  "usable even while frozen and cures the user's freeze": { ja: "こおっていても使え、自分のこおりが溶ける" },
  "was -1 up to Pokemon SV": { ja: "ポケモンSVまでは-1だった", drop: true },
  "terrain's own 1.3x boost applies separately only when the user is also grounded": { ja: "フィールド自体の1.3倍は、自分も地面にいる時だけ別にかかる" },
  "becomes confused for 1 to 4 turns once the rampage finishes": { ja: "あばれ終わると、1〜4ターンの間こんらん状態になる" },
  "base power multiplied by 1.2 when the user has the Iron Fist ability, since this is a punching move": { ja: "パンチわざなので、特性『てつのこぶし』の時は威力が1.2倍になる" },
  "increased critical-hit ratio of +1 stage": { ja: "急所に当たりやすさが1段階上がる" },
};

const disp = en.filter(e => (e.key === 'note' || e.key === 'doubles_note') && /[A-Za-z]{3,}/.test(e.val));
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const missing = disp.filter(e => !M[e.val]);

let html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>note 英語→日本語 対訳表(訳案)</title><style>
 *{box-sizing:border-box} body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:12.5px}
 header{padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d;position:sticky;top:0;z-index:6}
 h1{font-size:15px;margin:0} .sub{font-size:11px;color:#9aa7b4;margin-top:3px;line-height:1.6}
 table{border-collapse:collapse;width:100%} thead th{position:sticky;top:54px;background:#21262d;color:#9aa7b4;font-size:11px;padding:7px;border-bottom:2px solid #30363d;text-align:left}
 td{padding:7px 9px;border-bottom:1px solid #1c2128;vertical-align:top}
 .mv{color:#d2a8ff;font-weight:700;white-space:nowrap;min-width:110px}
 .en{color:#ff9a92;font-family:ui-monospace,monospace;font-size:11px;max-width:360px;line-height:1.5}
 .ja{color:#7ee787;min-width:320px;line-height:1.6;font-size:13px}
 .drop td{opacity:.6} .badge{font-size:10px;border-radius:3px;padding:0 6px;font-weight:700;margin-left:6px;background:#5d2f2f;color:#ffb4ad}
 tbody tr:hover td{background:#161b22} .n{color:#6e7681;text-align:right}
</style></head><body>
<header><h1>📝 note 英語 → 日本語(訳案・データ未反映)— ${disp.length}件</h1>
<div class="sub"><b style="color:#ff9a92">赤=現在の英語note</b> → <b style="color:#7ee787">緑=日本語訳案(低学年向け)</b>. <span class="badge">削除候補</span>=世代差など子ども向けには不要そうな注記.
 確認後にデータ(pokechan_data.js)へ反映します. 未訳: ${missing.length}件.</div></header>
<table><thead><tr><th class="n">#</th><th>技</th><th>🔴 現 note(英語)</th><th>🟢 日本語訳案</th></tr></thead><tbody>`;
disp.forEach((e, i) => {
  const m = M[e.val] || { ja: '<span style="color:#ff7b72">⚠️ 未訳</span>' };
  html += `<tr class="${m.drop ? 'drop' : ''}">
   <td class="n">${i + 1}</td>
   <td class="mv">${esc(e.moves.slice(0, 3).join('・'))}${e.moves.length > 3 ? ' …' : ''}</td>
   <td class="en">${esc(e.val)}</td>
   <td class="ja">${m.ja}${m.drop ? '<span class="badge">削除候補</span>' : ''}</td>
  </tr>`;
});
html += `</tbody></table></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_note_ja.html'), html);
fs.writeFileSync(path.join(ROOT, 'review', '_note_ja_map.json'), JSON.stringify(M, null, 1));
console.log('生成: review/waza_note_ja.html /', disp.length, '件 / 未訳', missing.length, '件 / 削除候補', Object.values(M).filter(x => x.drop).length, '件');
if (missing.length) console.log('未訳:', missing.map(e => e.val).join(' | '));
