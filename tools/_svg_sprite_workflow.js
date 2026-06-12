export const meta = {
  name: 'sprite-svg-all-doodle',
  description: '全ポケモンのSVG(本番: 特徴は全部入り×子どもの落書きテイスト)',
  phases: [{ title: 'SVG描画', detail: '1体1エージェント・並列' }],
}

phase('SVG描画')
const SCHEMA = {
  type: 'object', required: ['name', 'svg'],
  properties: { name: { type: 'string' }, svg: { type: 'string' } },
}

const names = Array.isArray(args) ? args : JSON.parse(args)

const out = await parallel(names.map(nm => () => agent(`
あなたはベクターイラストレーターです。ポケモン「${nm}」のSVGイラストを1枚描いてください。

【目指すテイスト(最重要)】
「子どもが大好きなポケモンを一生けんめい描いた落書き」みたいな、**ちょっとバカっぽくて味のある絵**。
ガチガチに整えない・左右非対称や形のゆるさはむしろ歓迎。**でも特徴は全部入れる**:
体色(公式の色をRGBで)・シルエット(耳/角/翼/しっぽ/ヒレの形と本数)・模様(縞/斑点/腹の色/ほっぺ)・
そのポケモンらしい顔つき。**パッと見て「${nm}だ!」と分かること**が合格条件。

【手順】まず「${nm}の見た目の特徴」を5項目で書き出してから、SVGを組み立てる。

【SVG仕様】
- <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"> 1個だけ。背景は透明(背景rect禁止)
- 正面〜やや斜め・全身・中央配置(余白20px)
- 輪郭線: stroke="#2d263c" stroke-width="6〜9" stroke-linejoin="round" stroke-linecap="round"
- 塗りはフラット。レイヤー順(後ろのパーツ→体→顔)。テキスト/filter/script禁止。要素数10〜40個
StructuredOutputの svg にはSVG全文だけを入れる。
`, { label: `svg:${nm}`, phase: 'SVG描画', schema: SCHEMA, model: 'sonnet' })))

const svgs = out.filter(Boolean)
log(`SVG生成: ${svgs.length}/${names.length}`)
return { svgs }
