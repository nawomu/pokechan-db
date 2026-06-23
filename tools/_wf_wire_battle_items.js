export const meta = {
  name: 'i18n-wire-battle-items',
  description: 'バトル3ページの持ち物ピッカーoption(名前/効果title)+残りUIをI18N配線',
  phases: [ { title: 'Wire', detail: '各ページの持ち物option等をI18N配線(自ページのみ・node-check)' } ],
}

const PAGES = ['real_battle.html', 'battle_simulator.html', 'real_battle_simulator.html'];

const BRIEF = [
  'あなたはPchamDB(9言語)の i18n 表示配線担当。データ/キーは整備済=描画コードの表示文字列をI18Nに繋ぐだけ。i18n/*.json・ui-*.jsonは編集禁止。',
  '残った日本語は /tmp/i18n_audit_report.json の en[<あなたのページ>] にリスト化済(まずこれを読む)。大半は「持ち物ピッカーのoption」。',
  '',
  '使えるもの(全て既存):',
  '- I18N.item(jaName): 持ち物名(現在言語)。 I18N.itemDesc(jaName): 持ち物の効果文(現在言語・ja時null)。引数は必ず「持ち物名(ja)」。',
  '- I18N.t(key, jaFallback) と既存共有語彙: common.stat_atk/def/spa/spd/spe(能力名 こうげき/ぼうぎょ/とくこう/とくぼう/すばやさ)。',
  '',
  '配線する対象(あなたのページの該当箇所):',
  '1) 持ち物選択の <option>: 表示テキスト(持ち物名)を I18N.item(name) に。title属性(効果文)を I18N.itemDesc(name)||効果 に。',
  '   ★ title に効果文(ja)を入れてる場合、I18N.itemDesc の引数は「効果文」でなく「持ち物名」。option の value/別属性/同行データから持ち物名(ja)を解決して渡す。',
  '   「メガストーン」等のカテゴリ見出しoptionは、ja名が持ち物辞書に無ければ I18N.item がjaを返す=それでよい(意図的fallback)。',
  '2) 能力名(span.stat-jp 等の こうげき/ぼうぎょ…): I18N.t(common.stat_*, ja) に。内部キー/計算は不変。',
  '3) その他の固有名詞(ポケモン/技/タイプ/特性)が生で出ていれば既存アクセサ(I18N.pokemon/move/type/ability)に。',
  '',
  '★一度きり構築のJS部品(selectのoption等)は言語切替に追従しないので、構築関数を i18n:ready / i18n:changed で再実行する(冪等に=作り直す前にクリア)か、既存の再描画フックに繋ぐ。',
  '★絶対に触らない: バトルログ(log()/battleLog/say本文)と lineWithFx等の正規表現演出。CSSクラス値・内部キー・検索lookup・data-*属性のja。',
  '★1ファイル=自ページのみ。編集後インライン<script>を node --check。NGなら git checkout で破棄し report。まず該当HTMLを Read。',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    page: { type: 'string' }, verified: { type: 'boolean' },
    edits: { type: 'array', items: { type: 'object', properties: { where: { type: 'string' }, change: { type: 'string' } }, required: ['where', 'change'] } },
    deferred: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, reason: { type: 'string' } }, required: ['what', 'reason'] } },
    summary: { type: 'string' },
  },
  required: ['page', 'verified', 'edits', 'deferred', 'summary'],
}

phase('Wire')
const results = (await parallel(PAGES.map((pg) => () =>
  agent(BRIEF + '\n\n=== あなたの担当ページ: ' + pg + ' ===\n上記1〜3を配線して、スキーマで報告。',
    { label: 'bi:' + pg, phase: 'Wire', schema: SCHEMA })
))).filter(Boolean)

const ok = results.filter((r) => r.verified)
log('配線完了: ' + ok.length + '/' + results.length + 'ページOK / 編集' + results.reduce((s, r) => s + r.edits.length, 0))
return { results }
