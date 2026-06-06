/* 叩き台: effects(SSOT) → ヤックン音の一文を「生成」するレンダラ試作。
 * 生成文を description_legacy(音の見本)/description と並べて検証。未対応kindは(未対応)で穴を可視化。
 * 実行: node tools/_waza_compose.js  → review/waza_compose.html */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { condStrNew } = require('./_cond_render.js');
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
const map = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));

// ✓声ルール(台帳): 0.5→半分 / 1→全部 / それ以外→1/N スラッシュ表記(8分の1化しない)
const fracT = f => { if (f == null || isNaN(f)) return ''; if (Math.abs(f - 1) < 0.001) return '全部'; if (Math.abs(f - 0.5) < 0.001) return '半分'; const r = Math.round(1 / f); return Math.abs(1 / f - r) < 0.04 ? `1/${r}` : (+(f * 100).toFixed(1)) + '%'; };
const multT = mu => mu >= 1 ? `${mu}倍になる` : (Math.abs(mu - 0.5) < 0.001 ? '半分になる' : `${fracT(mu)}になる`);
const durT = d => Array.isArray(d) ? `${d[0]}〜${d[1]}ターン` : (typeof d === 'number' ? `${d}ターン` : ({ until_user_leaves: '自分が場を離れるまで', until_removed: '消えるまで' }[d] || d));
const TGT = { self: '自分', opponent: '相手', team: '味方', all: '場の全員', ally: '味方', all_opponents: '相手全体', all_but_self: '自分以外', party: '手持ち全員', incoming: '次に出る味方' };
const TGT2 = { self: '自分の', opponent: '相手の', all_opponents: '相手全員の', ally: '味方の', team: '味方全員の', all: '場の全員の', all_but_self: '自分いがいの全員の', party: '手持ちの', incoming: '次に出る味方の' };
const STAT = { attack: 'こうげき', defense: 'ぼうぎょ', special_attack: 'とくこう', special_defense: 'とくぼう', speed: 'すばやさ', accuracy: 'めいちゅう', evasion: 'かいひ', all: 'すべての能力' };
const statList = e => (Array.isArray(e.stats) ? e.stats : [e.stat]).map(s => STAT[s] || s);
const joinStats = a => a.length <= 1 ? (a[0] || '') : a.length === 2 ? a.join('と') : a.join('・');
const immT = arr => (arr || []).map(x => x.value || (x.values || []).join('・')).join('・');
// condStrNew は「〜の時/〜の場合」を返す。文頭につなぐ。
const condT = c => condStrNew(c).replace(/の時$/, 'のとき').replace(/の場合は除く\)/, 'はのぞく)');

const amountT = a => a === '自分の残りHP分' ? '自分のいまのこっているHPと同じだけ' : a;
// 言葉のルール(2026-06-06 阿部さん): ランクの増減は和語数詞「ひとつ/ふたつ…」。「1個」にしない。
const KAZU = { 1: 'ひとつ', 2: 'ふたつ', 3: 'みっつ', 4: 'よっつ', 5: 'いつつ', 6: 'むっつ' };
const kazuT = n => KAZU[Math.abs(n)] || `${Math.abs(n)}個`;
// kind → 文の部品(子ども口調)。conditionは付けない(compose側でグループ束ね)。未対応は null。
function clause(e, m) {
  const k = e.kind, t = TGT[e.target] || e.target;
  switch (k) {
    case '状態付与': {
      if (e.value === 'バインド') {
        let s = `相手をバインド状態にして、${durT(e.duration)}の間、毎ターン終わりに、最大HPの${fracT(e.turn_end_damage)}だけダメージを与える`;
        if (e.prevents_switch) s += `。その間、${immT(e.immune)}タイプでない相手は、逃げたり交代したりできない`;
        return s;
      }
      const pp = (e.prob && e.prob < 100) ? `${e.prob}%の確率で` : ''; // 忠実: 確率はデータのまま。落とすと「必ず◯」化(意味漏れ)
      if (e.value === 'ひるみ') return `${pp}相手をひるませる`; // ひるみは動作=「ひるませる」(『ひるみ』状態にする は不自然・kind:ひるみ と統一)
      const dd = e.duration ? `${durT(e.duration)}の間、` : '';
      return `${pp}${dd}${t}を『${e.value}』状態にする`;
    }
    case '拘束':
      return `${immT(e.immune)}タイプでない相手を、${durT(e.duration)}の間、逃げたり交代したりできないようにする`;
    case '反動':
      return `相手に与えたダメージの${fracT(e.fraction)}を、自分も受ける`;
    case '威力倍率':
      return `威力が${multT(e.multiplier)}`;
    case '自分瀕死':
      return `技を使ったあと、自分はひんしになる`;
    case '回復':
      return `${t}のHPを、最大HPの${fracT(e.fraction)}だけ回復する`;
    case 'HPが減る':
      return `自分のHPが最大HPの${fracT(e.fraction)}減る`;
    case '固定ダメージ':
      return `相手に、${amountT(e.amount)}のダメージを与える(タイプ相性は受けない)`;
    case '継続削り':
      return `毎ターン、相手のHPを最大HPの${fracT(e.fraction)}だけ削る`;
    case '連続攻撃':
      if (e.hits_by) return `手持ちのポケモンの数だけ攻撃する`;
      if (e.stop_on_miss) return `外れるまで最大${e.max_hits}回攻撃する`;
      if (e.hits) return `${e.hits}回攻撃する`;
      if (e.min_hits) return `${e.min_hits}〜${e.max_hits}回攻撃する`;
      return null;
    case '急所率上昇':
      // ★忠実版(2026-06-06): データをそのまま。stages→「急所ランクがひとつ上がる」(解釈・softeningしない) / always_crit→「必ず急所に当たる」。
      if (e.always_crit) return `必ず急所に当たる`;
      return `急所ランクが${kazuT(e.stages)}上がる`;
    case 'ひるみ':
      // ★忠実版: kind:ひるみ = N%の確率で相手をひるませる(状態付与:ひるみ と統一)。
      return `${(e.prob && e.prob < 100) ? `${e.prob}%の確率で` : ''}相手をひるませる`;
    case '能力ランク変化': {
      if (!e.stat && !e.stats) return null; // くろいきり等のリセットは別機構→穴
      const st = joinStats(statList(e));
      const pre = (e.prob && e.prob < 100) ? `${e.prob}%の確率で` : ''; // gold=漢字「確率」・読点なし(legacy 119:0)
      if (e.target === 'opponent' && e.stages > 0)  // 相手を上げる=こっちの損 → 「してしまう」(✓本人)
        return `${pre}相手の${st}を${e.stages}段階上げてしまう`;
      const who = TGT2[e.target] || (t + 'の');
      const dir = e.to_max ? 'いっきに最大まであがる' : e.stages > 0 ? `${e.stages}段階あがる` : `${-e.stages}段階さがる`;
      return `${pre}${who}${st}が${dir}`;
    }
    default:
      return null; // 穴
  }
}
function compose(m) {
  const eff = (m.battle_data && m.battle_data.effects) || [];
  const holes = [], groups = [];
  for (const e of eff) {
    const c = clause(e, m); if (!c) { holes.push(e.kind); continue; }
    const key = e.condition ? JSON.stringify(e.condition) : '';
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, cond: e.condition, cl: [] }; groups.push(g); }
    g.cl.push({ text: c, kind: e.kind });
  }
  const sentences = groups.map(g => {
    const body = g.cl.map((cl, i) =>
      (i > 0 && cl.kind === '能力ランク変化' && g.cl[i - 1].kind === 'HPが減る') ? 'そのかわり、' + cl.text : cl.text
    ).join('。');
    return g.cond ? `${condT(g.cond)}、${body}` : body;
  });
  let text = sentences.length ? sentences.join('。') + '。' : '';
  const bd = m.battle_data || {};
  const lo = (bd.fails_if || []).find(f => f.type === 'current_hp_below_fraction');
  if (lo) text += `(今のHPが最大HPの${fracT(lo.fraction)}より少ないと失敗する)`;
  const gi = (bd.immune || []).find(x => x.type === 'target_type' && (x.value === 'ゴースト' || (x.values || []).includes('ゴースト')));
  if (gi) text += `(ゴーストタイプには当たらない)`;
  return { text, holes };
}

module.exports = { compose, clause, map }; // 確認HTML生成器など他ツールから同一エンジンを再利用(音のドリフト防止)
if (require.main === module) {
const byName = {}; for (const [k, m] of Object.entries(map)) byName[m.name] = m;
// 能力ランク変化テンプレの音合わせ用に代表技を名前で指定(各パラメータ形)
const NAMES = [
  // ★耳の確定待ち(これを並べて確認)
  'いばる', 'はらだいこ', 'ミストバースト', 'のろい', 'いのちがけ',
  // 以下は文脈(テンプレが効いてる確定済み等)
  'しめつける', 'すてみタックル', 'とおせんぼう', 'つるぎのまい', 'りゅうのまい', 'すてゼリフ', 'げんしのちから', 'てんしのキッス', 'サイコキネシス', 'こごえるかぜ', 'そらをとぶ', 'ふきとばし',
  // 急所率上昇テンプレ確認用(stages / always_crit / 他kind同居でプローブ)
  'クラブハンマー', 'こおりのいぶき', 'つじぎり', 'エアカッター', 'クロスポイズン'];
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let rows = '';
for (const nm of NAMES) {
  const m = byName[nm]; if (!m) { rows += `<tr><td>${nm} (なし)</td></tr>`; continue; }
  const { text, holes } = compose(m);
  const srcLines = ((m.battle_data || {}).effects || []).map(e => esc(JSON.stringify(e))).join('\n') || '(effectsなし)';
  rows += `<tr>
   <td class="mv">${esc(m.name)}</td>
   <td class="src">${srcLines}</td>
   <td class="gen">${esc(text) || '<span style="color:#ff7b72">(全effect未対応)</span>'}${holes.length ? `<div class="hole">⚠ 未対応kind(=構造の穴 or テンプレ未作): ${esc(holes.join('・'))}</div>` : ''}</td>
   <td class="leg">${esc(m.description_legacy || '')}</td>
   <td class="cur">${esc(m.description || '')}</td>
  </tr>`;
}
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>文章化レンダラ叩き台 vs ヤックン音</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:16px}
 header{padding:12px 18px;background:#161b22;border-bottom:1px solid #30363d} h1{font-size:19px;margin:0}
 .sub{font-size:13px;color:#9aa7b4;margin-top:6px;line-height:1.7}
 table{border-collapse:collapse;width:100%} th{background:#21262d;color:#9aa7b4;font-size:14px;padding:9px;text-align:left;border-bottom:2px solid #30363d}
 td{padding:11px;border-bottom:1px solid #1c2128;vertical-align:top;line-height:1.75}
 .mv{color:#d2a8ff;font-weight:700;white-space:nowrap;font-size:16px}
 .src{color:#79c0ff;font-family:ui-monospace,SFMono-Regular,monospace;font-size:13.5px;line-height:1.7;min-width:340px;max-width:480px;white-space:pre-wrap;word-break:break-all}
 .gen{color:#7ee787;min-width:300px;font-size:16px} .leg{color:#e6edf3;min-width:300px;font-size:16px} .cur{color:#9aa7b4;min-width:220px;font-size:14px}
 .hole{color:#ffd479;font-size:11px;margin-top:5px}
 tr:hover td{background:#161b22}
</style></head><body>
<header><h1>🔊 effects → ヤックン音の一文(叩き台) を legacy と並べて聴く</h1>
<div class="sub"><b style="color:#7ee787">緑=新しく作る文(effectsから生成)</b> / <b>白=ヤックン(お手本・既にある良い文＝description_legacy)</b> / 灰=今の短い説明(description). <b>緑が白の意味と声に戻れてるか</b>を聴く。⚠=未対応kind(構造の穴 or テンプレ未作)。</div></header>
<table><thead><tr><th>技</th><th>元データ(effects=本番SSOT)</th><th>🟢 新版(これを作りたい)</th><th>★ ヤックン(お手本)</th><th>今の短い説明</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_compose.html'), html);
console.log('生成: review/waza_compose.html /', NAMES.length, '技');

// 精度上げ③: 全490を compose し、生成文に機械が漏れていないか検知(回帰ガード)。※正しさは保証しない=legacyの耳のみ。
const LEAK = /[A-Za-z]{2,}|(?<![0-9])0\.[0-9]+|\btrue\b|\bundefined\b|\bNaN\b/;
let scanned = 0, leaks = [], voiced = 0;
for (const m of Object.values(map)) {
  const { text, holes } = compose(m); scanned++;
  if (text && !holes.length) voiced++;
  if (text) { const t = text.replace(/HP|PP/g, ''); if (LEAK.test(t)) leaks.push(`${m.name}: ${text.slice(0, 80)}`); }
}
console.log(`\n[機械漏れ検知] 全${scanned}技中 フル生成可 ${voiced}技 / 生成文に機械漏れ ${leaks.length}件`);
leaks.slice(0, 15).forEach(x => console.log('  🔴 ' + x));
if (leaks.length === 0) console.log('  ✅ 漏れなし(生成済みテンプレ範囲)');
}
