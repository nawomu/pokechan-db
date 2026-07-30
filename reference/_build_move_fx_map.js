// 設計用ビルダー(演出設計担当・本番非改変)。move_fx_map_draft_v1.json を生成する。
// 使い方: node reference/_build_move_fx_map.js
// 入力: pokechan_data.js の WAZA_MAP(全国版SSOT)。対象=攻撃技(category が 物理/特殊)のみ。変化技は対象外。
'use strict';
const fs = require('fs');
const path = require('path');
const D = require(path.join(__dirname, '..', 'pokechan_data.js'));
const WAZA_MAP = D.WAZA_MAP;

// ===== ① 形状ボキャブラリ(shapes) =====
// desc=見た目の意図 / impl=実装方針(emoji=絵文字テキストノード, css=CSSプリミティブ(グラデ円・線など), svg=インラインSVG)
// motion=既定の飛び方(projectile=飛翔体/beam=線状ビーム/burst=その場炸裂/rain=複数個が降る/melee=接触時の着弾グリフ)
//   ※motion はあくまで既定値のヒント。実際の飛翔 or 突進の別は real_battle.html 既存の mv.contact 判定(chargeFx/attackFx)が握るため、
//   shape 側の motion は「その shape が採用されたときに着弾グリフ/バーストがどう見えるか」の参考値として扱う(③実装方針で詳述)。
const shapes = {
  fist:    { desc: '拳(パンチ・体当たり全般の既定)。elemental色に染めた握りこぶしアイコン', impl: 'emoji(👊)', motion: 'melee' },
  foot:    { desc: '足(キック系)。爪先アイコン', impl: 'emoji(🦵)', motion: 'melee' },
  fang:    { desc: '牙(かみつき・毒針の一撃・トラバサミ等の「噛む」イメージ全般)', impl: 'emoji(🦷)', motion: 'melee' },
  blade:   { desc: '斬線(既存 rb-burstglyph-slash を流用。白グラデ細長div×2本60msずらし)', impl: 'css(既存.rb-burstglyph-slash)', motion: 'melee' },
  note:    { desc: '音符(音技既定)', impl: 'emoji(🎵)', motion: 'beam' },
  heart:   { desc: 'ハート(フェアリー系の触れ合い・魅了)', impl: 'emoji(💗)', motion: 'melee' },
  star:    { desc: '星(きらめき・隕石・手裏剣・光の乱舞など)', impl: 'emoji(⭐)+css(白い光点3-4個の飛散)', motion: 'projectile' },
  skull:   { desc: 'どくろ(あく特殊の禍々しい波動)', impl: 'emoji(💀)+css(紫グロー)', motion: 'burst' },
  gear:    { desc: '歯車(はがねの機械質感)', impl: 'emoji(⚙️)+css(金属光沢グラデ)', motion: 'melee' },
  orb:     { desc: 'エネルギー球(タイプ色のradial-gradient玉。既存 bullet/ball 系の発展形)', impl: 'css(radial-gradient球+グロー)', motion: 'projectile' },
  psi:     { desc: '渦(エスパー・波動系のスパイラル)', impl: 'css(タイプ色のconic-gradientスパイラル or 既存wave流用)', motion: 'beam' },
  ice:     { desc: '氷結晶', impl: 'emoji(❄️/🧊)+css(角ばった結晶パーティクル)', motion: 'projectile' },
  sand:    { desc: '砂/土けむり(風で流れる粒)', impl: 'css(茶〜黄土色の粒子ばらまき、横流れ)', motion: 'rain' },
  web:     { desc: '糸/網(むしの捕縛質感・巻きつき技にも流用)', impl: 'emoji(🕸️)+css(糸線の放射)', motion: 'projectile' },
  leaf:    { desc: '葉っぱ(くさタイプ既定)', impl: 'emoji(🍃)+css(緑パーティクル散布)', motion: 'projectile' },
  seed:    { desc: '種/木の実(タネ系・りんご等の小粒な固形物投射)', impl: 'emoji(🌰)+css(小粒パーティクル複数)', motion: 'rain' },
  feather: { desc: '羽根(ひこう物理・翼はためき)', impl: 'emoji(🪶)+css(白い羽根が舞う)', motion: 'melee' },
  gust:    { desc: '風/突風(ひこう特殊・wind技既定)', impl: 'css(既存windクラス流用・薄い渦巻ライン)', motion: 'projectile' },
  water:   { desc: '水しぶき', impl: 'emoji(💧)+css(水色パーティクル飛散)', motion: 'projectile' },
  flame:   { desc: '炎', impl: 'emoji(🔥)+css(オレンジ〜赤グラデの揺らぎ)', motion: 'projectile' },
  spark:   { desc: '電撃(ジグザグの稲妻)', impl: 'emoji(⚡)+svg(ジグザグ線)', motion: 'beam' },
  rock:    { desc: '岩石(鈍器・投擲物全般にも流用=骨・ハンマー等)', impl: 'emoji(🪨)+css(灰色の破片飛散)', motion: 'projectile' },
  dust:    { desc: '土煙+地割れ(じめん物理・爆発全般)', impl: 'css(茶色の爆煙+地面クラックSVG線)', motion: 'burst' },
  dragon:  { desc: '竜のエネルギー(青紫のらせん状オーラ)', impl: 'css(conic-gradientらせん)', motion: 'beam' },
  sting:   { desc: '針/牙状の突起(むし物理既定。かみつきより鋭く小さい)', impl: 'emoji(🐝→トゲ部分のみ想定。実装時は針アイコン検討)', motion: 'melee' },
  drill:   { desc: 'ドリル(高速回転する錐)', impl: 'css(斜線を高速回転させるスパイラルdiv)', motion: 'melee' },
  beam:    { desc: '極太ビーム(既存spawnBeamの発展形。中心の輝線+外側グロー)', impl: 'css(既存.rb-beamを太く・グロー強化)', motion: 'beam' },
};

// ===== ② タイプ×分類(物理/特殊)の既定マッピング(18タイプ×2=36) =====
const defaults = {
  'ノーマル':   { '物理': 'fist',   '特殊': 'star'  },
  'ほのお':     { '物理': 'flame',  '特殊': 'flame' },
  'みず':       { '物理': 'water',  '特殊': 'water' },
  'でんき':     { '物理': 'spark',  '特殊': 'spark' },
  'くさ':       { '物理': 'leaf',   '特殊': 'leaf'  },
  'こおり':     { '物理': 'ice',    '特殊': 'ice'   },
  'かくとう':   { '物理': 'fist',   '特殊': 'psi'   },
  'どく':       { '物理': 'fang',   '特殊': 'orb'   },
  'じめん':     { '物理': 'dust',   '特殊': 'sand'  },
  'ひこう':     { '物理': 'feather','特殊': 'gust'  },
  'エスパー':   { '物理': 'psi',    '特殊': 'psi'   },
  'むし':       { '物理': 'sting',  '特殊': 'web'   },
  'いわ':       { '物理': 'rock',   '特殊': 'rock'  },
  'ゴースト':   { '物理': 'orb',    '特殊': 'orb'   },
  'ドラゴン':   { '物理': 'dragon', '特殊': 'dragon'},
  'あく':       { '物理': 'fang',   '特殊': 'skull' },
  'はがね':     { '物理': 'gear',   '特殊': 'gear'  },
  'フェアリー': { '物理': 'heart',  '特殊': 'star'  },
};

// ===== ③ flagベース既定(既存 moveClassOf の優先順を踏襲=物理直感より先に判定) =====
// 優先順: sound > punch > slicing/slash > bullet/ball > wind > pulse > bite > 技名キック正規表現
// (real_battle.html 3139行 moveClassOf と同じ優先順。理由=既存エンジンの判定と二重管理・矛盾を避けるため)
const flagOrder = [
  { key: 'flags.sound',            shape: 'note',  test: m => !!(m.flags && m.flags.sound) },
  { key: 'flags.punch',            shape: 'fist',  test: m => !!(m.flags && m.flags.punch) },
  { key: 'flags.slicing|flags.slash', shape: 'blade', test: m => !!(m.flags && (m.flags.slicing || m.flags.slash)) },
  { key: 'flags.bullet|flags.ball', shape: 'orb',  test: m => !!(m.flags && (m.flags.bullet || m.flags.ball)) },
  { key: 'flags.wind',             shape: 'gust',  test: m => !!(m.flags && m.flags.wind) },
  { key: 'flags.pulse',            shape: 'psi',   test: m => !!(m.flags && m.flags.pulse) },
  { key: 'flags.bite',             shape: 'fang',  test: m => !!(m.flags && m.flags.bite) },
  { key: 'name matches /キック|蹴/', shape: 'foot',  test: m => /キック|蹴/.test(m.name || '') },
];

// ===== ④ 個別上書き(overrides・名前の直感がflag/タイプ既定より強い技のみ厳選) =====
// 選定方針: (a) flag層のバグ的取りこぼし(例: ふいうち=パンチ系なのにpunchフラグ無し) (b) flag層の視覚的ミスマッチ
// (例: くちばしキャノン=bullet flag だが実態は「くちばしで突く」であって弾ではない) (c) タイプ既定では拾えない固有の絵
// (例: つのドリル=回転する錐) の3パターンのみ。安易な全技個別化はしない(既定で受ける設計=北極星)。
const overrides = {
  // ドリル(高速回転する錐という固有の絵。タイプ/カテゴリ既定では出ない)
  'つのドリル': 'drill',
  'ドリルライナー': 'drill',
  'ドリルくちばし': 'drill',
  // タネ/種子(bulletフラグの丸玉より「粒々の種」の方が正確)
  'タネばくだん': 'seed',
  'タネマシンガン': 'seed',
  'かふんだんご': 'seed',
  'りんごさん': 'seed',
  // キック(技名に「キック」「蹴」を含まないため flagOrder の正規表現で拾えない蹴り技)
  'けたぐり': 'foot',
  'とびひざげり': 'foot',
  'かかとおとし': 'foot',
  'じだんだ': 'foot',
  // 爪(slicing/slashフラグが立っていないが「クロー」を冠する=official判定は非slicingでも絵はクロー)
  'シャドークロー': 'blade',
  'ドラゴンクロー': 'blade',
  'ブレイククロー': 'blade',
  'フェイタルクロー': 'blade',
  // 弾ではなく針の乱舞(ball:false=非bullet扱いだが多数の細い針という絵が要る)
  'どくばりセンボン': 'web',
  // 極太ビーム/レーザー/大砲(bullet等の丸玉やタイプ既定の粒より「一直線の光条」の方が正確)
  'はかいこうせん': 'beam',
  'てっていこうせん': 'beam',
  'ラスターカノン': 'beam',
  'きまぐレーザー': 'beam',
  'エレクトロビーム': 'beam',
  'れいとうビーム': 'beam',
  'かえんほうしゃ': 'beam',
  'ハイドロポンプ': 'beam',
  'だいもんじ': 'beam',
  'オーバーヒート': 'beam',
  'ふんか': 'beam',
  'れんごく': 'beam',
  'ハイドロカノン': 'beam',
  'ブラストバーン': 'beam',
  'ハードプラント': 'beam',
  'ソーラービーム': 'beam',
  'ツインビーム': 'beam',
  'ヘドロウェーブ': 'beam',
  // 隕石/手裏剣/コイン(星のきらめき・尖った投擲物という固有の絵)
  'りゅうせいぐん': 'star',
  'メテオビーム': 'star',
  'みずしゅりけん': 'star',
  'コインビーム': 'star',
  // ハート(キス=触れ合いの絵。フェアリー特殊既定の星より正確)
  'ドレインキッス': 'heart',
  // 牙(名前に「まえば」を含むのにbiteフラグが無い/吸血という「噛んで吸う」絵/トラバサミの「噛みつく罠」)
  'いかりのまえば': 'fang',
  'きゅうけつ': 'fang',
  'トラバサミ': 'fang',
  // 砂/土煙(渦巻く砂・霧状ガスという「巻く」絵。じめん特殊既定の粒状sandそのままでも良いが特に強調)
  'すなじごく': 'sand',
  'クリアスモッグ': 'sand',
  // ダストシュート・なげつける(ゴミや持ち物を投げつける=固形物の投射。fang/汎用既定より「投げつける物体」が正確)
  'ダストシュート': 'orb',
  'なげつける': 'rock',
  'ボーンラッシュ': 'rock',
  'デカハンマー': 'rock',
  // 拳(punchフラグが無いのに名前が「パンチ」相当の技)
  'ふいうち': 'fist',
  'ふくろだたき': 'fist',
  // 爆発(ノーマル既定fistでは弱いので、地割れ+土煙の破壊力ある既定=dustを明示指定)
  'だいばくはつ': 'dust',
  'じばく': 'dust',
  'ハサミギロチン': 'blade',
  // 羽ばたき/くちばし(bullet flagだが実態は「くちばしで突く」)
  'くちばしキャノン': 'feather',
  'はやてがえし': 'gust',
  // 巻きつき(bind=糸で巻くイメージをwebで表現)
  'まきつく': 'web',
  // 渦(水の渦巻き。psiのスパイラル形状を色違いで流用)
  'うずしお': 'psi',
  'しんくうは': 'psi',
  // 網(エレキネット=名前通りnetの絵をwebで表現)
  'エレキネット': 'web',
  // 矢(尖った投射=blade)
  'ドラゴンアロー': 'blade',
  '3ぼんのや': 'blade',
};

// ===== 解決関数 =====
function resolveShape(m){
  if (overrides[m.name]) return { shape: overrides[m.name], via: 'override' };
  for (const rule of flagOrder){
    if (rule.test(m)) return { shape: rule.shape, via: 'flag' };
  }
  const d = defaults[m.type] && defaults[m.type][m.category];
  if (d) return { shape: d, via: 'default' };
  return { shape: null, via: 'none' };
}

// ===== 全攻撃技を集めてカバレッジ照合 =====
const byName = {};
for (const k of Object.keys(WAZA_MAP)){
  const m = WAZA_MAP[k];
  if (!byName[m.name]) byName[m.name] = m;
}
const attacking = Object.values(byName).filter(m => m.category === '物理' || m.category === '特殊');

let missing = [];
let viaCount = { override: 0, flag: 0, default: 0, none: 0 };
for (const m of attacking){
  const r = resolveShape(m);
  viaCount[r.via]++;
  if (!r.shape || !shapes[r.shape]){
    missing.push({ name: m.name, type: m.type, category: m.category, resolved: r.shape });
  }
}

// defaults表そのものの網羅性(全18タイプ×2カテゴリがshapes内に存在する形状名を指しているか)も検査
let defaultsBad = [];
for (const t of Object.keys(defaults)){
  for (const cat of ['物理','特殊']){
    const s = defaults[t][cat];
    if (!shapes[s]) defaultsBad.push(`${t}/${cat} -> ${s}`);
  }
}
// overrides自体もshapes内に存在するか検査
let overridesBad = [];
for (const name of Object.keys(overrides)){
  const s = overrides[name];
  if (!shapes[s]) overridesBad.push(`${name} -> ${s}`);
  if (!byName[name]) overridesBad.push(`${name}: WAZA_MAPに存在しない技名(要修正)`);
}

const report = {
  generated_at: new Date().toISOString(),
  totals: {
    attacking_moves_total: attacking.length,
    unique_type_category_cells: Object.keys(defaults).length * 2,
    resolved_via: viaCount,
    missing_count: missing.length,
    defaults_table_integrity_errors: defaultsBad,
    overrides_integrity_errors: overridesBad,
  },
  missing,
};

const outDir = path.join(__dirname);
const draft = {
  _schema_note: '解決順序(優先度高→低): 1) overrides[技名の完全一致] 2) flagOrder(既存real_battle.htmlのmoveClassOfと同一優先順のflag/技名正規表現) 3) defaults[タイプ][分類](フォールバック=必ず埋まる)。詳細は 設計_技エフェクト対応表_2026-07-11.md ③実装方針。',
  defaults, overrides, shapes,
  flagOrder: flagOrder.map(r => ({ rule: r.key, shape: r.shape })),
};
fs.writeFileSync(path.join(outDir, 'move_fx_map_draft_v1.json'), JSON.stringify(draft, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, '_move_fx_map_coverage_report.json'), JSON.stringify(report, null, 2), 'utf8');

// 全攻撃技の解決結果一覧(レビュー用・waza_list_confirm系の慣習に合わせて別出力)
const resolvedAll = attacking
  .map(m => { const r = resolveShape(m); return { name: m.name, type: m.type, category: m.category, shape: r.shape, via: r.via }; })
  .sort((a, b) => a.type.localeCompare(b.type, 'ja') || a.category.localeCompare(b.category, 'ja') || a.name.localeCompare(b.name, 'ja'));
fs.writeFileSync(path.join(outDir, '_move_fx_map_resolved_all.json'), JSON.stringify(resolvedAll, null, 2), 'utf8');

console.log('=== move_fx_map coverage ===');
console.log('attacking moves total:', attacking.length);
console.log('resolved via:', viaCount);
console.log('missing (unresolved):', missing.length);
console.log('defaults table integrity errors:', defaultsBad.length, defaultsBad);
console.log('overrides integrity errors:', overridesBad.length, overridesBad);
console.log('overrides count:', Object.keys(overrides).length);
console.log('shapes count:', Object.keys(shapes).length);
if (missing.length) console.log(JSON.stringify(missing, null, 2));
console.log(missing.length === 0 && defaultsBad.length === 0 && overridesBad.length === 0 ? 'COVERAGE: 100% OK' : 'COVERAGE: FAIL');
