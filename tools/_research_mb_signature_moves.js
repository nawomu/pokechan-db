// レギュMB新ポケモン専用技/シグネチャー技の調査(WAZA_MAP未登録分)
export const meta = {
  name: 'research-mb-signature-moves',
  description: '新38ポケモンの専用技/シグネチャー技を調査し、WAZA_MAP未登録のものをリスト化',
  phases: [{ title: 'Research' }],
};

const POKEMON = [
  { name: 'メガライチュウX', note: 'メガ専用技or新技あるか' },
  { name: 'メガライチュウY', note: 'メガ専用技or新技あるか' },
  { name: 'ラフレシア', note: '通常ポケモン' },
  { name: 'ハリーセン', note: '通常ポケモン' },
  { name: 'ジュカイン', note: '通常ポケモン' },
  { name: 'メガジュカイン', note: 'メガ専用技or新技あるか' },
  { name: 'バシャーモ', note: '通常ポケモン' },
  { name: 'メガバシャーモ', note: 'メガ専用技or新技あるか' },
  { name: 'ラグラージ', note: '通常ポケモン' },
  { name: 'メガラグラージ', note: 'メガ専用技or新技あるか' },
  { name: 'クチート', note: '通常ポケモン' },
  { name: 'メガクチート', note: 'メガ専用技or新技あるか' },
  { name: 'メタグロス', note: '通常ポケモン' },
  { name: 'メガメタグロス', note: 'メガ専用技あり?' },
  { name: 'ムクホーク', note: '通常ポケモン' },
  { name: 'メガムクホーク', note: 'メガ専用技or新技あるか' },
  { name: 'ムシャーナ', note: '通常ポケモン' },
  { name: 'ペンドラー', note: '通常ポケモン' },
  { name: 'メガペンドラー', note: 'メガ専用技or新技あるか' },
  { name: 'ズルズキン', note: '通常ポケモン' },
  { name: 'メガズルズキン', note: 'メガ専用技or新技あるか' },
  { name: 'シビルドン', note: '通常ポケモン' },
  { name: 'メガシビルドン', note: 'メガ専用技or新技あるか' },
  { name: 'カエンジシ', note: '通常ポケモン' },
  { name: 'メガカエンジシ', note: 'メガ専用技or新技あるか' },
  { name: 'カラマネロ', note: '通常ポケモン' },
  { name: 'メガカラマネロ', note: 'メガ専用技or新技あるか' },
  { name: 'ガメノデス', note: '通常ポケモン' },
  { name: 'メガガメノデス', note: 'メガ専用技or新技あるか' },
  { name: 'ドラミドロ', note: '通常ポケモン' },
  { name: 'メガドラミドロ', note: 'メガ専用技or新技あるか' },
  { name: 'オーロンゲ', note: '通常ポケモン' },
  { name: 'タイレーツ', note: '通常ポケモン・専用技ノーガード?' },
  { name: 'メガタイレーツ', note: 'メガ専用技or新技あるか' },
  { name: 'ハリーマン', note: '通常ポケモン・専用技あり?' },
  { name: 'ハカドッグ', note: '通常ポケモン・専用技あり?' },
  { name: 'コノヨザル', note: 'こうごうけん専用技?' },
  { name: 'サーフゴー', note: 'ゴールドラッシュ・コインビーム専用技あり?' },
];

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'signature_moves', 'sources'],
  properties: {
    name: { type: 'string' },
    signature_moves: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['move_name', 'type', 'category', 'description'],
        properties: {
          move_name: { type: 'string', description: '日本語技名' },
          type: { type: 'string', description: '日本語タイプ名(ノーマル/ほのお等)' },
          category: { type: 'string', enum: ['物理', '特殊', '変化'] },
          power: { type: ['number', 'null'] },
          accuracy: { type: ['number', 'null'] },
          pp: { type: ['number', 'null'] },
          description: { type: 'string', description: '日本語の説明文(やっくん風)' },
          is_signature: { type: 'boolean', description: 'このポケモンの専用技か?' }
        }
      }
    },
    sources: { type: 'array', items: { type: 'string' } }
  }
};

phase('Research');
const results = await parallel(POKEMON.map(p => () =>
  agent(
    'あなたはポケモン技調査担当。対象ポケモンの「専用技/シグネチャー技」と「新規習得技」を調べる。\n\n'
    + '対象: ' + p.name + ' (' + p.note + ')\n\n'
    + '調査手順:\n'
    + '1. 「' + p.name + ' 専用技」「' + p.name + ' シグネチャー技」「' + p.name + ' 覚える技 専用」でWebSearch\n'
    + '2. GameWith・ポケモン徹底攻略・Bulbapedia・game8 を WebFetch\n'
    + '3. 専用技(他のポケモンが覚えない技)があればリストアップ\n'
    + '4. 各技について: 技名・タイプ・分類・威力・命中・PP・説明\n\n'
    + '注意:\n'
    + '- 専用技がない場合は signature_moves を空配列で返す\n'
    + '- メガ専用技がある場合(例:メガフシギバナのメガフレア等)も含める\n'
    + '- 一般的な技(かみなりパンチ等)は除外。本当に専用 or 新規だけ\n'
    + '- サーフゴー: ゴールドラッシュ・コインビーム など要確認\n'
    + '- メタグロス: コメットパンチ専用、メガメタグロス: メガ専用技?\n'
    + '- コノヨザル: かぶせ攻撃技?',
    { label: p.name, phase: 'Research', schema: SCHEMA, model: 'sonnet' }
  )
));

const ok = results.filter(Boolean);
let totalSig = 0;
for (const r of ok) totalSig += r.signature_moves.length;
log('調査完了: ' + ok.length + '/' + POKEMON.length + ' (専用技総数: ' + totalSig + ')');

return { researched: ok.length, items: ok };
