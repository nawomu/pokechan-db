/** ふきとばし・ほえる に「ダイマックス相手には無効(技まるごと失敗)」の構造マーカーを追加。
 *  Bulbapedia裏取り(2026-06-15): Whirlwind/Roar fail entirely on Dynamax/Gigantamax。
 *  ext.dynamax の不正確メモ「(交代効果が)無効」→ bd.immune の dynamax_target へ格上げ＋注記訂正。
 *  ※ ともえなげ/ドラゴンテール(野生注記なし=C区分)は対象外。野生注記つき文字列=この2技限定で安全。
 *  使い方: node tools/_fix_fukitobashi_hoeru_dynamax.js        (dry-run)
 *          node tools/_fix_fukitobashi_hoeru_dynamax.js --write (書き込み) */
const fs = require('fs'), path = require('path');
const FILE = path.resolve(__dirname, '..', 'pokechan_data.js');
const WRITE = process.argv.includes('--write');

const OLD = `"ext": {"wild": "野生では戦闘終了 / 相手が自分より高レベルだと失敗(野生)", "dynamax": "ダイマックス相手には(交代効果が)無効"}`;
const NEW = `"immune": [{"type": "dynamax_target"}], "ext": {"wild": "野生では戦闘終了 / 相手が自分より高レベルだと失敗(野生)", "dynamax": "ダイマックス相手には無効=技まるごと失敗(Bulbapedia裏取り2026-06-15)。表示はSYSTEMS_IN_GAMEでゲート"}`;

const text = fs.readFileSync(FILE, 'utf8');
const count = text.split(OLD).length - 1;
console.log('対象文字列の一致件数:', count, '(期待=2: ふきとばし・ほえる)');
if (count !== 2) { console.error('✗ 件数が2でない。中止(想定外の一致 or 既に適用済み)。'); process.exit(1); }

const next = text.split(OLD).join(NEW);
// 妥当性検証: WAZA_MAP を抜き出して JSON.parse できるか + 2技に dynamax_target が入ったか
const m = next.match(/const WAZA_MAP = (\{[\s\S]*?\});\n/);
if (!m) { console.error('✗ WAZA_MAP を切り出せず。中止。'); process.exit(1); }
let parsed;
try { parsed = JSON.parse(m[1]); } catch (e) { console.error('✗ 置換後 WAZA_MAP が JSON.parse 不可。中止:', e.message); process.exit(1); }
const chk = ['ふきとばし', 'ほえる'].map(nm => {
  const mv = Object.values(parsed).find(x => x.name === nm);
  const ok = (mv.battle_data.immune || []).some(i => i.type === 'dynamax_target');
  return `${nm}: dynamax_target ${ok ? 'あり✓' : 'なし✗'}`;
});
console.log(chk.join(' / '));
if (chk.some(s => s.includes('✗'))) { console.error('✗ 検証失敗。中止。'); process.exit(1); }

if (WRITE) { fs.writeFileSync(FILE, next); console.log('✅ 書き込み完了。'); }
else { console.log('— dry-run(--write で書き込み)。検証は全て通過。'); }
