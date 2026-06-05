/* 叩き台: effects(SSOT) → ヤックン音の一文を「生成」するレンダラ試作。
 * 生成文を description_legacy(音の見本)/description と並べて検証。未対応kindは(未対応)で穴を可視化。
 * 実行: node tools/_waza_compose.js  → review/waza_compose.html */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { condStrNew } = require('./_cond_render.js');
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
const map = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));

const fracT = f => { const r = Math.round(1 / f); return Math.abs(1 / f - r) < 0.04 ? `${r}分の1` : (+(f * 100).toFixed(1)) + '%'; };
const durT = d => Array.isArray(d) ? `${d[0]}〜${d[1]}ターン` : (typeof d === 'number' ? `${d}ターン` : ({ until_user_leaves: '自分が場を離れるまで', until_removed: '消えるまで' }[d] || d));
const TGT = { self: '自分', opponent: '相手', team: '味方', all: '場の全員', ally: '味方' };
const TGT2 = { self: '自分の', opponent: '相手の', '相手全体': '相手全員の', ally: '味方の', team: '味方全員の', all: '場の全員の', '自分以外全体': '自分いがいの全員の' };
const STAT = { attack: 'こうげき', defense: 'ぼうぎょ', special_attack: 'とくこう', special_defense: 'とくぼう', speed: 'すばやさ', accuracy: 'めいちゅう', evasion: 'かいひ', all: 'すべての能力' };
const statList = e => (Array.isArray(e.stats) ? e.stats : [e.stat]).map(s => STAT[s] || s);
const joinStats = a => a.length <= 1 ? (a[0] || '') : a.length === 2 ? a.join('と') : a.join('・');
const immT = arr => (arr || []).map(x => x.value || (x.values || []).join('・')).join('・');
// condStrNew は「〜の時/〜の場合」を返す。文頭につなぐ。
const condT = c => condStrNew(c).replace(/の時$/, 'とき').replace(/の場合は除く\)/, 'はのぞく)');

// kind → 文の部品(子ども口調)。未対応は null を返す。
function clause(e, m) {
  const k = e.kind, t = TGT[e.target] || e.target;
  switch (k) {
    case '状態付与': {
      if (e.value === 'バインド') {
        let s = `相手をバインド状態にして、${durT(e.duration)}のあいだ、毎ターン終わりに、最大HPの${fracT(e.turn_end_damage)}だけダメージをあたえる`;
        if (e.prevents_switch) s += `。そのあいだ、${immT(e.immune)}タイプでない相手は、にげたり交代したりできない`;
        return s;
      }
      return `${t}を『${e.value}』状態にする`;
    }
    case '拘束':
      return `${immT(e.immune)}タイプでない相手を、${durT(e.duration)}のあいだ、にげたり交代したりできないようにする`;
    case '反動':
      return `相手にあたえたダメージの${fracT(e.fraction)}を、自分もうける`;
    case '威力倍率':
      return `${e.condition ? condT(e.condition) + '、' : ''}威力が${e.multiplier}倍になる`;
    case '自分瀕死':
      return `技を使ったあと、自分はひんしになる`;
    case '回復':
      return `${t}のHPを、最大HPの${fracT(e.fraction)}だけ回復する`;
    case '能力ランク変化': {
      if (!e.stat && !e.stats) return null; // くろいきり等のリセットは別機構→穴
      const who = TGT2[e.target] || (t + 'の');
      const st = joinStats(statList(e));
      const dir = e.to_max ? 'いっきに最大まであがる' : e.stages > 0 ? `${e.stages}段階あがる` : `${-e.stages}段階さがる`;
      const pre = (e.prob && e.prob < 100) ? `${e.prob}%のかくりつで、` : '';
      const cd = e.condition ? condT(e.condition) + '、' : '';
      return `${cd}${pre}${who}${st}が${dir}`;
    }
    default:
      return null; // 穴
  }
}
function compose(m) {
  const eff = (m.battle_data && m.battle_data.effects) || [];
  const parts = [], holes = [];
  for (const e of eff) { const c = clause(e, m); if (c) parts.push(c); else holes.push(e.kind); }
  return { text: parts.length ? parts.join('。') + '。' : '', holes };
}

const byName = {}; for (const [k, m] of Object.entries(map)) byName[m.name] = m;
// 能力ランク変化テンプレの音合わせ用に代表技を名前で指定(各パラメータ形)
const NAMES = ['しめつける', 'すてみタックル', 'ミストバースト', 'とおせんぼう',
  'つるぎのまい', 'りゅうのまい', 'すてゼリフ', 'げんしのちから', 'いばる', 'はらだいこ', 'サイコキネシス', 'こごえるかぜ', 'のろい', 'そらをとぶ', 'ふきとばし'];
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let rows = '';
for (const nm of NAMES) {
  const m = byName[nm]; if (!m) { rows += `<tr><td>${nm} (なし)</td></tr>`; continue; }
  const { text, holes } = compose(m);
  rows += `<tr>
   <td class="mv">${esc(m.name)}</td>
   <td class="gen">${esc(text) || '<span style="color:#ff7b72">(全effect未対応)</span>'}${holes.length ? `<div class="hole">⚠ 未対応kind(=構造の穴 or テンプレ未作): ${esc(holes.join('・'))}</div>` : ''}</td>
   <td class="leg">${esc(m.description_legacy || '')}</td>
   <td class="cur">${esc(m.description || '')}</td>
  </tr>`;
}
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>文章化レンダラ叩き台 vs ヤックン音</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:13px}
 header{padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d} h1{font-size:15px;margin:0}
 .sub{font-size:11px;color:#9aa7b4;margin-top:4px;line-height:1.6}
 table{border-collapse:collapse;width:100%} th{background:#21262d;color:#9aa7b4;font-size:11px;padding:7px;text-align:left;border-bottom:2px solid #30363d}
 td{padding:9px;border-bottom:1px solid #1c2128;vertical-align:top;line-height:1.65}
 .mv{color:#d2a8ff;font-weight:700;white-space:nowrap}
 .gen{color:#7ee787;min-width:300px} .leg{color:#e6edf3;min-width:300px} .cur{color:#9aa7b4;min-width:220px;font-size:12px}
 .hole{color:#ffd479;font-size:11px;margin-top:5px}
 tr:hover td{background:#161b22}
</style></head><body>
<header><h1>🔊 effects → ヤックン音の一文(叩き台) を legacy と並べて聴く</h1>
<div class="sub"><b style="color:#7ee787">緑=生成文(effectsから組んだ)</b> / <b>白=description_legacy(音の見本)</b> / 灰=description(現行・簡潔). 緑が白の"音"に近いか、戻れるか。⚠=未対応kind(構造の穴 or テンプレ未作)。</div></header>
<table><thead><tr><th>技</th><th>🟢 生成文(effects→一文)</th><th>description_legacy(音の見本)</th><th>description(現行)</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_compose.html'), html);
console.log('生成: review/waza_compose.html /', NAMES.length, '技');
