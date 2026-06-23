export const meta = {
  name: 'move-tag-translate',
  description: '効果フィルタタグ234文字列を8言語へ翻訳(絵文字保持・公式用語・6並列)。親がmove_tags_i18n.jsonに集約',
  phases: [ { title: 'Translate', detail: 'タグ文字列を8言語へ' } ],
}

const TOTAL = 234
const CHUNKS = 6
const size = Math.ceil(TOTAL / CHUNKS)
const ranges = []
for (let s = 0; s < TOTAL; s += size) ranges.push([s, Math.min(s + size, TOTAL)])

const BRIEF = [
  'あなたはポケモン対戦DBの「効果フィルタタグ」の翻訳担当。短いラベル/句を8言語へ翻訳。',
  '★ルール:',
  '- 先頭の絵文字(⚡🔥📊💢🎯等)は**そのまま保持**し、後ろの日本語テキストだけ訳す。',
  '- 競技的な仕組み(無効/倍率/段階/確率%/±数値/ターン数)を必ず保持。記号・数字(2倍, +1, 1/3, 2-5回, %)はそのまま。',
  '- 各言語の**公式ポケモン用語**(タイプ名・能力名[こうげき=Attack等]・状態異常[まひ=Paralysis等]・技/フィールド名)を使用。',
  '- 簡潔に。フィルタチップなので短く。',
  '対象言語コード: en, es, fr, de, it, ko, zh-Hans, zh-Hant',
  '手順: Bashで `node -e \'const a=require("/tmp/tag_strings.json").slice(S,E); console.log(JSON.stringify(a))\'` で担当範囲の文字列配列を取得。',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    translations: { type: 'array', items: { type: 'object', properties: {
      ja: { type: 'string' },
      en: { type: 'string' }, es: { type: 'string' }, fr: { type: 'string' }, de: { type: 'string' },
      it: { type: 'string' }, ko: { type: 'string' }, 'zh-Hans': { type: 'string' }, 'zh-Hant': { type: 'string' },
    }, required: ['ja','en','es','fr','de','it','ko','zh-Hans','zh-Hant'] } },
  },
  required: ['translations'],
}

phase('Translate')
const results = (await parallel(ranges.map(([s, e]) => () =>
  agent(BRIEF + '\n\n担当範囲: index ' + s + '〜' + e + '。上記手順で /tmp/tag_strings.json の slice(' + s + ',' + e + ') を取得し、各文字列を8言語へ翻訳してスキーマで返す。jaは元の文字列そのまま。',
    { label: 'tag:' + s + '-' + e, phase: 'Translate', schema: SCHEMA })
))).filter(Boolean)

const all = results.flatMap((r) => r.translations || [])
const seen = new Set(); const merged = []
for (const t of all) { if (t && t.ja && !seen.has(t.ja)) { seen.add(t.ja); merged.push(t) } }
log('タグ翻訳完了: ' + merged.length + '/' + TOTAL)
return { translations: merged }
