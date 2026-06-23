export const meta = {
  name: 'i18n-wire-batch3',
  description: '残り語彙(対象種別/側ラベル/モーダル接続詞/設置物バッジ)の表示配線を4ページに並列適用',
  phases: [ { title: 'Wire', detail: '各ページの該当表示をI18N配線(自ページのみ・node-check)' } ],
}

const PAGES = [
  'pokemon_db_v9.html',
  'real_battle.html',
  'real_battle_simulator.html',
  'battle_simulator.html',
]

const BADGE_MAP = [
  'みがわり=common.bdg_substitute', 'リフレクター=common.bdg_reflect', 'ひかりのかべ=common.bdg_light_screen',
  'オーロラベール=common.bdg_aurora_veil', 'おいかぜ=common.bdg_tailwind', 'ステルスロック=common.bdg_stealth_rock',
  'まきびし=common.bdg_spikes', 'どくびし=common.bdg_toxic_spikes', 'ねばねばネット=common.bdg_sticky_web',
  'やどりぎ=common.bdg_leech_seed', 'しおづけ=common.bdg_salt_cure', 'ねをはる=common.bdg_ingrain',
  'アクアリング=common.bdg_aqua_ring', 'でんじふゆう=common.bdg_magnet_rise', 'かいふくふうじ=common.bdg_heal_block',
  'にげられない=common.bdg_no_escape', 'バインド=common.bdg_bind', 'ほろび=common.bdg_perish', 'きゅうしょ=common.bdg_crit_up',
].join(' / ')

const BRIEF = [
  'あなたはPchamDB(9言語)の i18n 表示配線担当。データ/キーは整備済=描画コードの表示文字列をI18Nに繋ぐだけ。i18n/*.json・ui-*.json は編集禁止。',
  '使えるもの(全て既存): I18N.t(key, jaFallback)。',
  '配線する対象(あなたのページに該当があれば):',
  '1) 技の対象種別(target)の表示: 生の対象値(1体選択/自分/相手全体/味方の場…)を I18N.t("targets." + ja, ja) に。例: pokemon_db の waza-tip w.target。',
  '2) モード「両方」の表示: I18N.t("common.mode_both", "両方")。',
  '3) 側ラベル「自分側」「相手側」の表示: I18N.t("common.side_self","自分側") / I18N.t("common.side_opp","相手側")。',
  '4) モーダル接続詞「(...)の持ち物を選択」「技を選択」: 固定部分を I18N.t("common.item_select","持ち物を選択") / I18N.t("common.move_select","技を選択") に。可変部(ポケモン名等)はそのまま。',
  '5) 設置物/状態バッジ(画面に出る固定ラベル)の表示: 下のja→キー対応で I18N.t(キー, ja)。対応表:',
  '   ' + BADGE_MAP,
  '',
  '★保留(触らない): バッジに数値が付く複合表示(例「まきびし×2」「ほろび3」「急所+1」など語順/数値が絡むもの)は、語順設計が要るため今回は触らず deferred に。接○/接×・守○/守×のコンパクト記号(○/×は言語中立)は据え置き=触らない。',
  '★絶対に触らない: バトルログ(log/battleLog/say本文)と正規表現演出(lineWithFx等)。CSSクラス値・内部キー・検索lookup・data-*。',
  '★1ファイル=自ページのみ。編集後インライン<script>を node --check。NGなら git checkout で破棄し deferred に。まず該当HTMLを Read してから着手。',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    page: { type: 'string' },
    verified: { type: 'boolean' },
    edits: { type: 'array', items: { type: 'object', properties: {
      kind: { type: 'string' }, where: { type: 'string' }, change: { type: 'string' },
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
  agent(BRIEF + '\n\n=== あなたの担当ページ: ' + pg + ' ===\n上記1〜5のうち該当する表示を配線して、スキーマで報告。該当なしなら edits 空で良い。',
    { label: 'wire3:' + pg, phase: 'Wire', schema: SCHEMA })
))).filter(Boolean)

const ok = results.filter((r) => r.verified)
log('配線完了: ' + ok.length + '/' + results.length + 'ページOK / 編集' + results.reduce((s, r) => s + r.edits.length, 0) + ' / 保留' + results.reduce((s, r) => s + r.deferred.length, 0))
return { results }
