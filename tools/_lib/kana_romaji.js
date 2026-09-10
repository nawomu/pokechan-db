// tools/_lib/kana_romaji.js — 技名(かな/カナ/半角英数)→ 旧Champions版 WAZA_MAP のローマ字キーと同じ流儀のキーを作る
// 用途: 凍結スナップショット(pokechan_data.js・M-B時点496技)に無い Champions 技(レギュM-C で初登場した技など)に
//       champions_key を与える(2026-09-10)。既存キーは凍結値を優先し、ここは「無い時だけ」使う。
// 流儀(既存キーから実測): ヘボン式・長音「ー」は直前の母音を重ねる(reitoubiimu)・ん=n・っ=次の子音を重ねる(sekka)・
//   を=wo・づ=zu・ぢ=ji・ティ=ti・ディ=di・ファ/フィ/フェ/フォ=fa/fi/fe/fo・ウィ/ウェ=ui/ue・シェ=she・ジェ=jie・チェ=che・数字/英字はそのまま。
'use strict';
const BASE = {
  'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko','さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
  'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to','な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no','は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo','や':'ya','ゆ':'yu','よ':'yo','ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro','わ':'wa','を':'wo','ん':'n',
  'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go','ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo','だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo','ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po','ゔ':'vu',
  'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','ゃ':'ya','ゅ':'yu','ょ':'yo','ゎ':'wa',
};
const COMBO = {
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo','しゃ':'sha','しゅ':'shu','しょ':'sho','ちゃ':'cha','ちゅ':'chu','ちょ':'cho','にゃ':'nya','にゅ':'nyu','にょ':'nyo',
  'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo','みゃ':'mya','みゅ':'myu','みょ':'myo','りゃ':'rya','りゅ':'ryu','りょ':'ryo','ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
  'じゃ':'ja','じゅ':'ju','じょ':'jo','びゃ':'bya','びゅ':'byu','びょ':'byo','ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
  'てぃ':'ti','でぃ':'di','ふぁ':'fa','ふぃ':'fi','ふぇ':'fe','ふぉ':'fo','うぃ':'ui','うぇ':'ue','うぉ':'uo','しぇ':'she','じぇ':'jie','ちぇ':'che','つぁ':'tsa','つぇ':'tse','つぉ':'tso',
  'ゔぁ':'va','ゔぃ':'vi','ゔぇ':'ve','ゔぉ':'vo','でゅ':'dyu','てゅ':'tyu',
};
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
function kanaToRomaji(name) {
  const s = toHira(String(name));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], two = s.slice(i, i + 2);
    if (COMBO[two]) { out += COMBO[two]; i++; continue; }
    if (c === 'っ') { // 次の子音を重ねる(次が母音/なし なら 'tsu' ではなく何も足さない)
      const nx = s.slice(i + 1, i + 3); const r = COMBO[nx] || BASE[s[i + 1]] || '';
      const k = r.replace(/^(ch)/, 't').charAt(0); if (k && !/[aiueo]/.test(k)) out += k; continue;
    }
    if (c === 'ー') { const m = out.match(/[aiueo]$/); if (m) out += m[0]; continue; }
    if (BASE[c] !== undefined) { out += BASE[c]; continue; }
    if (/[0-9a-zA-Z]/.test(c)) { out += c.toLowerCase(); continue; }
    // 記号(・など)は捨てる
  }
  return out;
}
module.exports = { kanaToRomaji };
