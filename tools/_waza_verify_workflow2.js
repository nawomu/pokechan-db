export const meta = {
  name: 'waza-desc-verify-byname',
  description: '説明文の独立検証(技名渡し版): 盲訳ファイル↔判定ファイルを分離・①盲訳→②判定',
  phases: [
    { title: '盲訳', detail: 'effectsだけ(legacy非開示ファイル)を読んで初見の訳' },
    { title: '判定', detail: 'legacy/compose込みファイルで合否診断' },
  ],
}

const BLIND_SCHEMA = {
  type: 'object', required: ['name', 'naive'],
  properties: { name: { type: 'string' }, naive: { type: 'string' } },
}
const JUDGE_SCHEMA = {
  type: 'object',
  required: ['name', 'round_trips', 'missing_in_effects', 'compose_faithful', 'machine_leak', 'verdict', 'note'],
  properties: {
    name: { type: 'string' },
    round_trips: { type: 'boolean' },
    missing_in_effects: { type: 'array', items: { type: 'string' } },
    compose_faithful: { type: 'boolean' },
    compose_problems: { type: 'array', items: { type: 'string' } },
    machine_leak: { type: 'boolean' },
    verdict: { type: 'string', enum: ['ok', 'compose_fix', 'effects_fix', 'both'] },
    note: { type: 'string' },
  },
}

const names = Array.isArray(args) ? args : JSON.parse(args)   // 技名の配列

const results = await pipeline(
  names,
  // ① 盲訳: 盲訳用ファイル(legacy/compose抜き)を読んで訳す
  (nm) => agent(`
ポケモン技「${nm}」の構造データ(effects)だけから、この技がバトルで何をするかを、
予備知識ゼロの小学校低学年にもわかる子ども口調の一文にしてください。お手本(legacy)は与えません。

まずBashで次を実行してこの技のデータを取得(legacy/composeは入っていません):
node -e 'const d=require("/tmp/wvm_blind.json");console.log(JSON.stringify(d[process.argv[1]],null,2))' ${JSON.stringify(nm)}

ルール: 英語・キー名・true/0.125等の機械の言葉は出さない。確率/割合は「30%の確率で」「半分」と開く。
能力ランクは「こうげき+1」、急所は「急所がひとつ上がる」。effectsにある効果は全部訳に入れる(落とさない)。
StructuredOutputに {name:"${nm}", naive} を返す。
`, { label: `blind:${nm}`, phase: '盲訳', schema: BLIND_SCHEMA, model: 'sonnet' }),

  // ② 判定: 全部入りファイルを読んで合否診断(別エージェント=独立判定)
  (blind, nm) => agent(`
あなたは説明文の独立した判定者です(作った本人ではない)。技「${nm}」を診断してください。

まずBashで全データ(legacy/compose/effects)を取得:
node -e 'const d=require("/tmp/wvm_full.json");const m=d[process.argv[1]];console.log("LEGACY:",m.legacy);console.log("COMPOSE:",m.compose||"(空)");console.log("EFFECTS:",JSON.stringify(m.effects,null,2))' ${JSON.stringify(nm)}

初見の他人がeffectsだけから書いた盲訳(B):
${blind ? blind.naive : '(盲訳失敗)'}

診断の観点(北極星=子どもがうちの出力(COMPOSE)だけでLEGACYと同じ意味に戻れること):
1. round_trips: 盲訳(B)でLEGACYの意味に戻れるか(戻れない=effectsにデータ不足)。
   ※注意: 盲訳者がeffectsの一部を訳し忘れただけなら、それはeffectsの欠けではない。データの有無で判断。
2. missing_in_effects: LEGACYにあるのにEFFECTSから戻れない意味を具体的に列挙(例「自分がねむり時だけ使える」「音技」「みがわり貫通」)。noteにしか書かれず構造化されてない物も挙げる。
3. compose_faithful: 今のCOMPOSE文がEFFECTSに忠実か(略しすぎ/言い過ぎ/意味抜け/空っぽ)。
   基準: 能力ランクは「こうげき+1」、急所は「ひとつ上がる」(+N表記しない)。英語/キー/true/0.125は機械漏れ。
4. machine_leak: COMPOSE文に機械の言葉が漏れているか。
5. verdict: ok / compose_fix(エンジンが効きを喋れてない) / effects_fix(データ不足) / both。
   COMPOSEが空っぽ・主効果が丸ごと無いなら最低でもcompose_fix。

厳しめに。自分に甘くしない。StructuredOutputに全フィールド(nameは"${nm}")を返す。
`, { label: `judge:${nm}`, phase: '判定', schema: JUDGE_SCHEMA, model: 'sonnet' }),
)

const r = results.filter(Boolean)
const cnt = { ok: 0, compose_fix: 0, effects_fix: 0, both: 0 }
r.forEach(x => cnt[x.verdict] !== undefined && cnt[x.verdict]++)
log(`独立検証 ${r.length}件: ok=${cnt.ok} compose_fix=${cnt.compose_fix} effects_fix=${cnt.effects_fix} both=${cnt.both}`)
return { results: r }
