export const meta = {
  name: 'research-mb-items-rules',
  description: 'レギュMB追加持ち物・対戦ルール・シーズン期間を並列調査',
  phases: [{ title: 'Research' }],
};

const TARGETS = [
  { topic: 'items', q: 'ポケモンチャンピオンズ レギュレーションM-B (MB) で追加された道具・持ち物・アイテムを全て調査。メガシンカ用のメガストーン(ジュカイナイト・バシャーモナイト等)、新規ベリー、新規どうぐ等。GameWith・game8・ポケモン徹底攻略のうち最低2サイトを WebSearch + WebFetch。' },
  { topic: 'mega_stones', q: 'ポケモンチャンピオンズで使えるメガストーン(ライチュウナイトX/Y・ジュカイナイト・バシャーモナイト・ラグラージナイト・クチートナイト・メタグロスナイト・ムクホークナイト・ペンドラナイト・ズルズキンナイト・シビルドンナイト・カエンジシナイト・カラマネロナイト・ガメノデスナイト・ドラミドロナイト・タイレーツナイト)の入手方法・効果を網羅調査。' },
  { topic: 'rules', q: 'ポケモンチャンピオンズ レギュレーションM-B のルール・期間・対戦形式・使用可能ポケモン数・選出数・禁止ポケモンを調査。シーズン開始日・終了日・ランクマッチ仕様。' },
  { topic: 'banned', q: 'ポケモンチャンピオンズ レギュレーションM-B での禁止伝説ポケモン・禁止技・禁止特性・出場制限のあるポケモンのリスト。スカーレットバイオレット系のレギュ前例も参考に。' },
  { topic: 'meta', q: 'ポケモンチャンピオンズ レギュレーションM-B の現在の環境メタ・上位構築・使用率TOP10ポケモン・トップトレーナーの構築。' },
];

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['topic', 'findings', 'sources'],
  properties: {
    topic: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' }, description: '具体的な情報(箇条書き10-30個)' },
    sources: { type: 'array', items: { type: 'string' }, description: '参照URL2つ以上' },
    summary: { type: 'string', description: '日本語2-3文の所感' }
  }
};

phase('Research');
const results = await parallel(TARGETS.map(t => () =>
  agent(
    'ポケモンチャンピオンズ レギュMBの最新情報を WebSearch + WebFetch で調査。GameWith / game8 / ポケモン徹底攻略 / X(Twitter)公式 / 攻略wiki を中心に。\n\n対象トピック: ' + t.topic + '\n\n質問: ' + t.q
    + '\n\n注意:\n- 情報源を必ず明示\n- 推測ではなく明確な事実だけ\n- 不明な点は「不明」と書く\n- 期間や具体的なルールは日付付きで',
    { label: 'research:' + t.topic, phase: 'Research', schema: SCHEMA, model: 'sonnet' }
  )
));

const ok = results.filter(Boolean);
log('調査完了: ' + ok.length + '/' + TARGETS.length);
return { researched: ok.length, items: ok };
