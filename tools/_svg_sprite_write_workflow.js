export const meta = {
  name: 'sprite-svg-write-doodle',
  description: '全ポケモンのSVGを各エージェントが正しいファイル名で直接書き出す(名前戻り値に依存しない量産版)',
  phases: [{ title: 'SVG描画', detail: '1体1エージェント・並列・自分でファイル書き込み' }],
}

phase('SVG描画')

// 書き込み結果だけ返す(SVG本文はメインに戻さない=コンテキスト節約)
const SCHEMA = {
  type: 'object', required: ['name', 'ok'],
  properties: {
    name: { type: 'string' },
    ok: { type: 'boolean' },
    bytes: { type: 'number' },
    note: { type: 'string' },
  },
}

const names = Array.isArray(args) ? args : JSON.parse(args)
const DIR = '/Users/masamichi/Documents/ポケモンDB/images/sim'

const out = await parallel(names.map(nm => () => agent(`
あなたはベクターイラストレーターです。ポケモン「${nm}」のSVGイラストを1枚描き、指定パスに保存してください。

【最重要・ファイル名】
出力先は必ず次の絶対パス(1文字も変えない):
${DIR}/${nm}.svg
- ファイル名にローマ字・英名・(Wartortle)等の注釈・拡張子の重複を絶対に付けない。上のパスそのままWriteする。

【目指すテイスト(最重要)】
「子どもが大好きなポケモンを一生けんめい描いた落書き」みたいな、ちょっとバカっぽくて味のある絵。
ガチガチに整えない・左右非対称や形のゆるさはむしろ歓迎。でも特徴は全部入れる:
体色(公式の色をRGBで)・シルエット(耳/角/翼/しっぽ/ヒレの形と本数)・模様(縞/斑点/腹の色/ほっぺ)・
そのポケモンらしい顔つき。パッと見て「${nm}だ!」と分かることが合格条件。

【手順】
1. まず「${nm}の見た目の特徴」を5項目で書き出す。
2. 下記仕様でSVGを組み立てる。
3. Writeツールで ${DIR}/${nm}.svg にSVG全文だけを書き込む(先頭は<svg・末尾は</svg>。\`\`\`で囲まない・前後に説明文を混ぜない)。

【SVG仕様】
- <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"> 1個だけ。背景は透明(背景rect禁止)
- 正面〜やや斜め・全身・中央配置(余白20px)
- 輪郭線: stroke="#2d263c" stroke-width="6〜9" stroke-linejoin="round" stroke-linecap="round"
- 塗りはフラット。レイヤー順(後ろのパーツ→体→顔)。テキスト/filter/script禁止。要素数10〜40個

書き込んだら StructuredOutput に {name:"${nm}", ok:true, bytes:書いたバイト数} を返す。書けなければ ok:false と note に理由。
`, { label: `svg:${nm}`, phase: 'SVG描画', schema: SCHEMA, model: 'sonnet', agentType: 'general-purpose' })))

const res = out.filter(Boolean)
const okc = res.filter(r => r.ok).length
log(`書き込み成功: ${okc}/${names.length}`)
return { total: names.length, ok: okc, results: res }
