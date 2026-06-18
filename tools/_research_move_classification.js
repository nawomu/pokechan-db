// ダイナミックワークフロー: ポケモンの技分類(特にダメージ補正)について外部調査
// 5〜6 sonnet エージェント並列で別角度から調査
// 結果を統合して最適な分類案を提示
export const meta = {
  name: 'research-move-classification',
  description: 'ポケモン技ジャンル分け・ダメ補正分類を外部サイトから網羅調査',
  phases: [{ title: 'Research' }, { title: 'Synthesize' }],
};

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['source', 'categories', 'damage_subcategories', 'observation'],
  properties: {
    source: { type: 'string', description: '調査したサイト名・出典' },
    categories: { type: 'array', items: { type: 'string' }, description: 'そのサイトの技ジャンル分け一覧' },
    damage_subcategories: { type: 'array', items: { type: 'string' }, description: 'ダメージ補正/威力可変系の細分(あれば)' },
    observation: { type: 'string', description: '日本語で2-3文の所感・参考になる点' }
  }
};

phase('Research');

const targets = [
  { src: 'ポケモンWiki(pokemonwiki.com)', q: 'ポケモンWiki(pokemonwiki.com)の「わざ」カテゴリ・効果分類のページを WebSearch + WebFetch で調査して、技のジャンル分けを抽出して。特にダメージ補正・追加効果・威力可変の分類があれば詳細に。' },
  { src: 'Bulbapedia(bulbapedia.bulbagarden.net)', q: 'Bulbapedia(英語ポケモン百科)の Move category と Damage classification を WebSearch + WebFetch で調査。一般的な move categorization(damage modifier/secondary effect/etc.)を抽出。' },
  { src: 'ポケモン徹底攻略(yakkun.com)', q: 'yakkun.com のわざ検索・技分類タグを WebSearch + WebFetch で調査。フィルタ項目(状態異常付与/能力ランク変動/HP回復/天候 etc.)を抽出。' },
  { src: 'Smogon(smogon.com)', q: 'Smogon(競技ポケモンサイト)の move analysis を WebSearch + WebFetch で調査。技がどう分類されてるか(physical/special/status の base + secondary effect の細分)を抽出。' },
  { src: 'Serebii(serebii.net)', q: 'Serebii.net の attackdex / move filter を WebSearch + WebFetch で調査。技フィルタの分類(category/effect/etc.)を抽出。' },
  { src: 'Pokémon DB(pokemondb.net)', q: 'pokemondb.net の move dex フィルタを WebSearch + WebFetch で調査。technical machine 分類や effect tags を抽出。' },
];

const results = await parallel(targets.map(t => () =>
  agent(
    'あなたはポケモン技分類の調査担当。WebSearch と WebFetch を使って、指定されたソースを丁寧に調べて、技のジャンル分け(特にダメージ補正・威力変化・追加効果の分類)を抽出する。'
    + '\n\n調査対象: ' + t.src + '\n\n' + t.q
    + '\n\n注意:\n- 必ず WebSearch で URL を見つけてから WebFetch で詳細を取る\n- 該当する分類体系をリストアップ\n- ダメージ補正のサブカテゴリ(威力UP/威力倍率/反動/失敗ダメージ/連続/急所率/必中/etc.)を見つけて欲しい\n- 各カテゴリは短く(2-10文字)\n- 出典のサイト名を必ず記録',
    { label: 'research:' + t.src, phase: 'Research', schema: SCHEMA, model: 'sonnet' }
  )
));

const ok = results.filter(Boolean);
log('調査完了: ' + ok.length + ' / ' + targets.length + ' ソース');

phase('Synthesize');

const synthSchema = {
  type: 'object', additionalProperties: false, required: ['proposed_categories', 'damage_subcategories', 'rationale', 'pchamdb_specific_recommendations'],
  properties: {
    proposed_categories: { type: 'array', items: { type: 'string' }, description: '統合提案: ポケモンDB のためのジャンル分け(15-25カテゴリ程度)' },
    damage_subcategories: { type: 'array', items: { type: 'string' }, description: 'ダメージ補正の最適なサブカテゴリ案(5-10個)' },
    rationale: { type: 'string', description: '提案の理由・複数ソースからの裏付け(日本語300字程度)' },
    pchamdb_specific_recommendations: { type: 'array', items: { type: 'string' }, description: 'pchamdb.com での具体的な改善案リスト(箇条書き5-10個)' }
  }
};

const synth = await agent(
  '6サイトの調査結果を統合して、ポケモンDB のための最適なジャンル分け(特にダメージ補正)を提案して。各ソースで共通する分類を採用し、独自の特殊な分類は除外する。\n\n6サイトの調査結果:\n' + JSON.stringify(ok, null, 2),
  { label: 'synth:final', phase: 'Synthesize', schema: synthSchema, model: 'sonnet' }
);

return { sources: ok.length, synth };
