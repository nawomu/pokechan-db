export const meta = {
  name: 'i18n-wire-batch2',
  description: '技説明(I18N.moveDesc)+分類/能力/状態/性格(common.*/I18N.nature)の表示配線を5ページに並列適用',
  phases: [ { title: 'Wire', detail: '各ページの表示をI18N配線(自ページのみ・node-check)' } ],
}

const PAGES = [
  'pokemon_db_v9.html',
  'waza-list.html',
  'real_battle.html',
  'real_battle_simulator.html',
  'battle_simulator.html',
]

const BRIEF = [
  'あなたはPchamDB(9言語)の i18n 表示配線担当。データ/キーは既に整備済=あなたは「描画コードの表示文字列をI18Nに繋ぐ」だけ。i18n/*.json・ui-*.json は編集禁止(既に在る)。',
  '',
  '使えるもの(全て既存):',
  '- I18N.moveDesc(key, jaDesc): 技の効果説明。ja時はjaDesc(独自)、非ja時はi18n/<lang>.json moves[key].desc(翻訳済)を返す。moveオブジェクトに .key(ローマ字) と .description(独自ja) がある。',
  '- I18N.nature(jaName): 性格名(現在言語)。NATURES/性格名表示に。',
  '- I18N.t(key, jaFallback): 固定UI文。下の共有語彙キーが既に9言語で存在:',
  '    common.cat_phys / common.cat_spec / common.cat_stat   (分類: 物理/特殊/変化)',
  '    common.stat_atk/def/spa/spd/spe/eva/acc               (能力: こうげき/ぼうぎょ/とくこう/とくぼう/すばやさ/かいひりつ/めいちゅうりつ)',
  '    common.status_paralysis/burn/freeze/poison/toxic/sleep/confusion/infatuation  (状態: まひ/やけど/こおり/どく/もうどく/ねむり/こんらん/メロメロ)',
  '',
  '配線する対象(あなたのページに該当があれば):',
  '1) 技の効果説明の【表示】: 生の m.description / w.effect を出している箇所を I18N.moveDesc(m.key, m.description) に。★ただし優先度解析(extractPriority等)・検索照合・data-desc属性は ja のまま(表示文字列だけ変える)。',
  '2) 分類(物理/特殊/変化)の【表示語】: m.category / w.class の値(物理/特殊/変化)を I18N.t に。実装例: const CAT={"物理":"common.cat_phys","特殊":"common.cat_spec","変化":"common.cat_stat"}; 表示 = I18N.t(CAT[v]||"", v)。CSSクラス(m-cat 等)は値のまま残す。',
  '3) 能力名の【表示】(STAT_LABELS等の こうげき/ぼうぎょ…): I18N.t(common.stat_*, ja)。内部キーや計算は触らない。',
  '4) 状態異常の【表示バッジ】(画面に出る状態チップ): I18N.t(common.status_*, ja)。',
  '5) 性格名の【表示】(NATURES option等): I18N.nature(ja)。',
  '',
  '★絶対に触らない: バトルログ文(log()/battleLog/say の本文)と、ログ文字列を正規表現マッチして演出する箇所(lineWithFx/animateStageFromLog等)。判別不能なら触らず deferred に記録。css class内のja・検索/lookup用ja・data-* 属性のja・<title>/meta も触らない。',
  '★1ファイル=自ページのみ編集。編集後インライン<script>を node --check し構文OKを確認。NGなら git checkout で破棄し deferred に。',
  'まず review/i18n_leak_audit_2026-06-23.md の自ページ節と該当HTMLを Read してから着手。',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    page: { type: 'string' },
    verified: { type: 'boolean' },
    edits: { type: 'array', items: { type: 'object', properties: {
      kind: { type: 'string', description: 'desc|category|stat|status|nature' },
      where: { type: 'string' }, change: { type: 'string' },
    }, required: ['kind','where','change'] } },
    deferred: { type: 'array', items: { type: 'object', properties: {
      what: { type: 'string' }, reason: { type: 'string' },
    }, required: ['what','reason'] } },
    summary: { type: 'string' },
  },
  required: ['page','verified','edits','deferred','summary'],
}

phase('Wire')
const results = (await parallel(PAGES.map((pg) => () =>
  agent(BRIEF + '\n\n=== あなたの担当ページ: ' + pg + ' ===\n上記1〜5のうち該当する表示を配線して、スキーマで報告。',
    { label: 'wire:' + pg, phase: 'Wire', schema: SCHEMA })
))).filter(Boolean)

const ok = results.filter((r) => r.verified)
log('配線完了: ' + ok.length + '/' + results.length + 'ページ構文OK / 編集計' + results.reduce((s, r) => s + r.edits.length, 0) + '件 / 保留' + results.reduce((s, r) => s + r.deferred.length, 0))
return { results }
