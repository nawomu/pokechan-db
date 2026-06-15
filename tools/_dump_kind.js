/** 声チェック用ダンプ: 効果kind別に「技名 / 効果(compose) / ヤック(legacy)」をテキスト出力。
 *  使い方: node tools/_dump_kind.js            … kind一覧(技数つき・開通順)
 *          node tools/_dump_kind.js "急所率上昇"  … そのkindの全技を効果↔legacyで並べる
 *          node tools/_dump_kind.js --idx 3      … 開通順の3番目のkind */
const { compose, map } = require('./_waza_compose.js');
const conf = require('./_waza_list_confirm.js');
const { moves, ordered, byKind } = conf;

const arg = process.argv.slice(2);
if (!arg.length) {
  ordered.forEach((k, i) => console.log(`${String(i).padStart(3)}  ${String(byKind.get(k).length).padStart(3)}技  ${k}`));
  process.exit(0);
}
let kind;
if (arg[0] === '--idx') kind = ordered[Number(arg[1])];
else kind = arg[0];
if (!byKind.has(kind)) { console.error('no such kind:', kind); process.exit(1); }
const list = byKind.get(kind);
console.log(`\n■ kind: ${kind}  (${list.length}技)\n${'='.repeat(70)}`);
for (const m of list) {
  const { text } = compose(m);
  const legacy = m.description_legacy || '(legacy無し)';
  console.log(`\n● ${m.name}`);
  console.log(`  効果: ${text || '(空っぽ)'}`);
  console.log(`  ヤク: ${legacy}`);
}
