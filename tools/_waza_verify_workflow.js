export const meta = {
  name: 'waza-desc-independent-verify',
  description: '説明文の独立検証(直訳テスト自動版): ①effectsだけ盲訳 → ②legacyと意味照合して診断',
  phases: [
    { title: '盲訳', detail: 'effectsだけ見て初見の他人の訳を作る(legacy非開示)' },
    { title: '判定', detail: 'legacy・compose・盲訳を突き合わせて合否診断' },
  ],
}

const BLIND_SCHEMA = {
  type: 'object', required: ['name', 'naive'],
  properties: {
    name: { type: 'string' },
    naive: { type: 'string', description: 'effectsだけから書いた、初見の他人による子ども口調の訳文' },
  },
}
const JUDGE_SCHEMA = {
  type: 'object',
  required: ['name', 'round_trips', 'missing_in_effects', 'compose_faithful', 'machine_leak', 'verdict', 'note'],
  properties: {
    name: { type: 'string' },
    round_trips: { type: 'boolean', description: '盲訳(effects由来)でlegacyの意味に戻れるか' },
    missing_in_effects: { type: 'array', items: { type: 'string' }, description: 'legacyにあってeffectsから戻れない意味(=データ欠け。effects追加が要る)' },
    compose_faithful: { type: 'boolean', description: '今のcompose文がeffectsに忠実か(略しすぎ/言い過ぎが無いか)' },
    compose_problems: { type: 'array', items: { type: 'string' }, description: 'compose文の具体的な問題(意味抜け/機械くささ/基準違反)' },
    machine_leak: { type: 'boolean', description: 'compose文に英語/キー名/true/0.125等の機械が漏れているか' },
    verdict: { type: 'string', enum: ['ok', 'compose_fix', 'effects_fix', 'both'], description: 'ok=問題なし / compose_fix=エンジン修正 / effects_fix=データ追加 / both=両方' },
    note: { type: 'string', description: '一言まとめ(何をどう直すか)' },
  },
}

const moves = Array.isArray(args) ? args : JSON.parse(args)   // [{name, effects, compose, legacy, type, category, power, accuracy, flags}]

// 2段パイプライン: 盲訳(legacy非開示)→ 判定(全部開示)。作る人と判定する人を分ける(独立検証)。
const results = await pipeline(
  moves,
  // ① 盲訳: effectsだけ見て訳す(legacyは絶対に渡さない)
  (m) => agent(`
あなたは初見の翻訳者です。ポケモン技「${m.name}」の構造データ(effects)だけを見て、
この技がバトルで何をするのかを、予備知識ゼロの小学校低学年にもわかる子ども口調の一文で書いてください。
お手本の説明文(legacy)は見せません。effectsだけから、初見の他人ならどう訳すかを書いてください。

技: ${m.name} / タイプ${m.type} / 分類${m.category} / 威力${m.power ?? '—'} / 命中${m.accuracy ?? '—'}
flags: ${JSON.stringify(m.flags || {})}
effects(これだけが手がかり):
${JSON.stringify(m.effects, null, 2)}

ルール: 英語・キー名・true/0.125のような機械の言葉は出さない。確率や割合は「30%の確率で」「半分」のように開く。
能力ランクは「こうげき+1」、急所は「急所がひとつ上がる」。StructuredOutputに {name, naive} を返す。
`, { label: `blind:${m.name}`, phase: '盲訳', schema: BLIND_SCHEMA, model: 'sonnet' }),

  // ② 判定: 盲訳・legacy・compose を突き合わせる(別エージェント=独立した判定者)
  (blind, m) => agent(`
あなたは説明文の独立した判定者です(この訳文やエンジンを作った本人ではありません)。
ポケモン技「${m.name}」について、3つを突き合わせて診断してください。

【A. お手本(legacy)】= 戻るべき意味の正解:
${m.legacy}

【B. 初見の他人がeffectsだけから書いた盲訳】:
${blind ? blind.naive : '(盲訳に失敗)'}

【C. 今のエンジン(compose)が出している文】= これが本番候補:
${m.compose}

【D. 構造データ(effects)】:
${JSON.stringify(m.effects, null, 2)}

診断の観点(北極星=子どもがうちの出力だけでlegacyと同じ意味に戻れること):
1. round_trips: 盲訳(B)でlegacy(A)の意味に戻れるか。戻れない=effectsにデータが足りない。
2. missing_in_effects: legacy(A)にあるのに effects(D) から戻れない意味を具体的に挙げる(例:「自分がねむり状態のときだけ使える」「音技」「みがわり貫通」)。
3. compose_faithful: 今のcompose文(C)が effects(D) に忠実か。略しすぎ・言い過ぎ・意味抜けが無いか。
   - 基準: 能力ランクは「こうげき+1」、急所ランクは「ひとつ上がる」(+N表記しない)。英語/キー/true/0.125は機械漏れ。
4. machine_leak: compose文(C)に機械の言葉(英語・キー名・true・0.125等)が漏れているか。
5. verdict: ok / compose_fix(エンジンが効きを喋れてない) / effects_fix(データ自体が足りない) / both。

厳しめに。自分に甘くしない。StructuredOutputに全フィールドを返す。
`, { label: `judge:${m.name}`, phase: '判定', schema: JUDGE_SCHEMA, model: 'sonnet' }),
)

const ok = results.filter(Boolean).filter(r => r.verdict === 'ok').length
log(`独立検証: ${results.filter(Boolean).length}件 / ok=${ok} / 要修正=${results.filter(Boolean).length - ok}`)
return { results }
