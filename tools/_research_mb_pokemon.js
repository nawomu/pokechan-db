// レギュMB新ポケモン37体 並列調査ワークフロー(Phase A: 基本データ)
// 各ポケモンの種族値・タイプ・特性・体重・進化情報をWebSearch+WebFetchで取得
export const meta = {
  name: 'research-mb-pokemon',
  description: 'レギュMB追加37ポケモンの種族値・タイプ・特性・体重を並列調査',
  phases: [{ title: 'Research' }, { title: 'Verify' }],
};

const POKEMON = [
  { name: 'メガライチュウX', base: 'ライチュウ', mega: true, variant: 'X' },
  { name: 'メガライチュウY', base: 'ライチュウ', mega: true, variant: 'Y' },
  { name: 'ラフレシア', base: 'ラフレシア', mega: false },
  { name: 'ハリーセン', base: 'ハリーセン', mega: false },
  { name: 'ジュカイン', base: 'ジュカイン', mega: false },
  { name: 'メガジュカイン', base: 'ジュカイン', mega: true },
  { name: 'バシャーモ', base: 'バシャーモ', mega: false },
  { name: 'メガバシャーモ', base: 'バシャーモ', mega: true },
  { name: 'ラグラージ', base: 'ラグラージ', mega: false },
  { name: 'メガラグラージ', base: 'ラグラージ', mega: true },
  { name: 'クチート', base: 'クチート', mega: false },
  { name: 'メガクチート', base: 'クチート', mega: true },
  { name: 'メタグロス', base: 'メタグロス', mega: false },
  { name: 'メガメタグロス', base: 'メタグロス', mega: true },
  { name: 'ムクホーク', base: 'ムクホーク', mega: false },
  { name: 'メガムクホーク', base: 'ムクホーク', mega: true },
  { name: 'ムシャーナ', base: 'ムシャーナ', mega: false },
  { name: 'ペンドラー', base: 'ペンドラー', mega: false },
  { name: 'メガペンドラー', base: 'ペンドラー', mega: true },
  { name: 'ズルズキン', base: 'ズルズキン', mega: false },
  { name: 'メガズルズキン', base: 'ズルズキン', mega: true },
  { name: 'シビルドン', base: 'シビルドン', mega: false },
  { name: 'メガシビルドン', base: 'シビルドン', mega: true },
  { name: 'カエンジシ', base: 'カエンジシ', mega: false },
  { name: 'メガカエンジシ', base: 'カエンジシ', mega: true },
  { name: 'カラマネロ', base: 'カラマネロ', mega: false },
  { name: 'メガカラマネロ', base: 'カラマネロ', mega: true },
  { name: 'ガメノデス', base: 'ガメノデス', mega: false },
  { name: 'メガガメノデス', base: 'ガメノデス', mega: true },
  { name: 'ドラミドロ', base: 'ドラミドロ', mega: false },
  { name: 'メガドラミドロ', base: 'ドラミドロ', mega: true },
  { name: 'オーロンゲ', base: 'オーロンゲ', mega: false },
  { name: 'タイレーツ', base: 'タイレーツ', mega: false },
  { name: 'メガタイレーツ', base: 'タイレーツ', mega: true },
  { name: 'ハリーマン', base: 'ハリーマン', mega: false },
  { name: 'ハカドッグ', base: 'ハカドッグ', mega: false },
  { name: 'コノヨザル', base: 'コノヨザル', mega: false },
  { name: 'サーフゴー', base: 'サーフゴー', mega: false },
];

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'no', 'type1', 'hp', 'atk', 'def', 'spatk', 'spdef', 'spd', 'total', 'ab1', 'weight_kg', 'sources'],
  properties: {
    name: { type: 'string' },
    no: { type: 'string', description: '全国図鑑番号(3桁・例:"025")' },
    type1: { type: 'string', description: 'タイプ1(ノーマル/ほのお/みず/でんき/くさ/こおり/かくとう/どく/じめん/ひこう/エスパー/むし/いわ/ゴースト/ドラゴン/あく/はがね/フェアリー)' },
    type2: { type: 'string', description: 'タイプ2(なければ空文字)' },
    hp: { type: 'number' },
    atk: { type: 'number' },
    def: { type: 'number' },
    spatk: { type: 'number' },
    spdef: { type: 'number' },
    spd: { type: 'number' },
    total: { type: 'number', description: '種族値合計' },
    ab1: { type: 'string', description: '通常特性1(日本語)' },
    ab2: { type: 'string', description: '通常特性2(なければ空文字)' },
    ab3: { type: 'string', description: '夢特性/隠れ特性(なければ空文字)' },
    weight_kg: { type: 'number' },
    sources: { type: 'array', items: { type: 'string' }, description: '参照したサイト(2つ以上)' },
    note: { type: 'string', description: 'メガ進化・特殊形態など補足' }
  }
};

phase('Research');
const results = await parallel(POKEMON.map(p => () => {
  const isMeganote = p.mega ? `(${p.name}は${p.base}のメガシンカ形態${p.variant ? ' / バリアント:'+p.variant : ''})` : '';
  return agent(
    'あなたはポケモンデータ調査担当。WebSearchとWebFetchで以下のポケモンの正確なデータを取得して構造化して返す。\n\n'
    + '対象: ' + p.name + ' ' + isMeganote
    + '\n\n調査手順:\n'
    + '1. 「' + p.name + ' 種族値」でWebSearch\n'
    + '2. GameWith・ポケモン徹底攻略・ポケモンWiki・Bulbapediaのうち最低2サイトをWebFetch\n'
    + '3. 種族値(HP/攻撃/防御/特攻/特防/素早)・タイプ1/2・特性(通常2+隠れ特性)・体重(kg)・図鑑番号を抽出\n'
    + '4. 数値はサイト間で突き合わせて多数決(またはより信頼できるソースを優先)\n\n'
    + '注意:\n'
    + '- メガシンカ形態は元の種族値とは違う(メガシンカ後の数値を使う)\n'
    + '- 特性名は日本語カナで(例: もうかではなく「もうか」)\n'
    + '- タイプは日本語カナで(例: Fire→ほのお)\n'
    + '- 図鑑番号は3桁ゼロ詰め(例: 25→"025")\n'
    + '- sourcesに必ず2サイト以上のURL記載',
    { label: p.name, phase: 'Research', schema: SCHEMA, model: 'sonnet' }
  );
}));

const ok = results.filter(Boolean);
log('調査完了: ' + ok.length + '/' + POKEMON.length);

phase('Verify');
// 整合性チェック: 種族値合計 vs total / タイプ妥当性 / 特性必須
const issues = [];
for (const p of ok) {
  const sum = p.hp + p.atk + p.def + p.spatk + p.spdef + p.spd;
  if (sum !== p.total) issues.push(`${p.name}: 種族値合計不一致(sum=${sum} vs total=${p.total})`);
  if (!/^(ノーマル|ほのお|みず|でんき|くさ|こおり|かくとう|どく|じめん|ひこう|エスパー|むし|いわ|ゴースト|ドラゴン|あく|はがね|フェアリー)$/.test(p.type1)) issues.push(`${p.name}: type1不正(${p.type1})`);
  if (p.type2 && !/^(ノーマル|ほのお|みず|でんき|くさ|こおり|かくとう|どく|じめん|ひこう|エスパー|むし|いわ|ゴースト|ドラゴン|あく|はがね|フェアリー)$/.test(p.type2)) issues.push(`${p.name}: type2不正(${p.type2})`);
  if (!p.ab1) issues.push(`${p.name}: 特性なし`);
}
log('整合性: ' + issues.length + '件の問題');
if (issues.length) for (const i of issues.slice(0, 10)) log('  ' + i);

return { researched: ok.length, total: POKEMON.length, items: ok, issues };
