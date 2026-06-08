/** わざリスト ルールリスト(集約)。言葉のルール + 書き方のルール を1枚に。
 * SSOT=ヤックン耳_判断ログ.md(本HTMLはその集約ビュー)。実行: node tools/_rules.js → review/rules.html */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// 書き方のルール(姿勢・方針)
const WRITE = [
  ['★出す前に自分でヤックン耳テスト(最優先)', '<b>「できました」と報告する前に、必ず自分で一度ヤックン耳テスト(直訳テスト)をやってから出す</b>(2026-06-07 阿部さん・いびきで露呈)。阿部さんが確認する前に内容が違っているのは成果物として未完=失格。<br>手順: legacyを<b>見ずに</b> effects / battle_data だけから初見の訳文を作り、<code>description_legacy</code> と並べて ①意味が戻るか ②声がやさしい子ども口調か ③機械が漏れてないか ④legacyの写しでないか を<b>1技ずつ</b>確かめる。<b>抜けは、指摘される前に自分から修正案を出す</b>(不足の意味を effects か compose が読む battle_data フィールドに入れて喋らせる)。<br>★<b>「✅完結(穴ゼロ)」は機械の話=偽の頂上</b>。意味が戻るかは別(voiced≠complete)。<b>実例(いびき)</b>: 新版が「30%の確率で相手をひるませる。」だけで、legacyの「自分が『ねむり』状態の時のみ使用可能／音系の技／相手の『みがわり』を貫通」を落としていた。しかも<b>データには在った</b>(requires/flags.sound/substitute_pierce)のに compose が読んでいない<b>取りこぼし</b>だった→「データ欠け」と決める前に「データに在るのにエンジンが喋ってないだけでは?」を疑う。'],
  ['そのまま忠実', 'データ(effects)の中身を言葉通りに訳す。アレンジ・ひねり・まとめ・省略・"やさしく崩す"・AI加工は<b>しない</b>。子どもに分からなくても、まず事実をそのまま。'],
  ['忠実 > やさしさ', 'softening が事実(機構)をぼかすなら、忠実を採る。「やさしい子ども口調」より忠実が優先。'],
  ['直訳=逐語訳', '「直訳」はデータの逐語訳であって、子ども向けの作文・意訳ではない。まず"そのまま"で伝わるかを見る(憶測・想像で足さない)。'],
  ['独自に作る/ヤックンを写さない', 'legacy(ヤックン)の編集的な言い回しを写さない(verbatim一致=盗用リスク=赤信号)。legacyは<b>意味の参照のみ</b>。'],
  ['自然な収束はOK', '言い方が一通りしかないもの(例「30%の確率で相手をひるませる」「必ず急所に当たる」)が legacy と一致するのは<b>自然な収束=可・機械的でよい</b>(2026-06-07 阿部さん確定)。無理に変えると不自然。'],
  ['略さない(意味が要る所)', '効果の意味が説明に必要なら<b>略さない</b>。「短くて済む」より「意味が戻る」を採る。<b>例(必中・2026-06-07 阿部さんの耳で確定)</b>: ✗「必ず命中する」だけに縮める → ✓「<b>相手の回避率や自分の命中率に関係なく</b>、必ず命中する」。理由=相手のかいひ上昇(ちいさくなる/かいひ)や自分の命中率低下(どろかけ等)を<b>無視して当たる</b>という肝が落ちる。説明にもsimにも効く情報→残す(effectsにも <code>ignores:[user_accuracy,target_evasion]</code> を入れる)。<br><b>例2(なみだめ・2026-06-07)</b>: ヤックンにある「相手の『まもる』『みきり』『トーチカ』『ニードルガード』『ブロッキング』『スレッドトラップ』『かえんのまもり』の効果を受けない(『ダイウォール』を除く)」が新版に<b>無かった</b>→ 略さず effects に <code>まもり貫通(bypasses:[7つの守り技], not_bypassed:[ダイウォール])</code> を追加して補完。<b>守り技リストも除外も省略しない</b>。'],
  ['effectsは二役', 'effects は シミュレーター と 説明文 の<b>両方</b>に使う同じデータ。simが読まない効果でも説明文には要る→<b>安易に削除しない</b>(例: 鉄の拳1.2倍)。'],
  ['★effectsはsim前提=フェーズを意識', 'effects は<b>バトルシミュレーター(real_battle_simulator.html・Phase構造v7)が読み取る前提</b>で作られたデータ。説明文(compose)は<b>「simが読むeffectsをただ日本語に訳しているだけ」</b>。だから effects は<b>常にsimとセット</b>で、<b>simの流れ＝フェーズ(優先度→攻撃前の変化→攻撃→攻撃後[適用後]→ターン終了)を意識して構築</b>する。composeが"賢く"織り込み・並べ替えをしたくなったら、それは<b>effectsのphase設計が足りないサイン</b>→エンジンに特例を足さず<b>データ(phase)を整える</b>。フロー詳細=HANDOFF_PHASE3_SIMULATOR.md「Phase構造v7」。(2026-06-07 阿部さん)'],
  ['優先度を入れる', '優先度(battle_data.priority)は「使うとどうなるか」の一部→説明文に入れる(例「優先度-3で、必ず後攻になる」)。'],
  ['voiced ≠ complete', 'カバー率も機械漏れ検知も<b>データの欠けは見えない</b>。穴フラグ無しでもデータが肝を落とせば新版は不完全。意味の完全性は人間/検証が legacy照合する(例: きあいパンチの失敗条件=データ欠け)。'],
  ['「足りない」前に裏取り', '「欠落/不要/誤り」と言う前に、実データ+sim実装(real_battle_simulator.html)を確認。二層(eff/bd)を両方見る。'],
  ['意味の分裂に注意', '<b>同じ意味が別kind/別キー表記に分裂</b>していることがある(=カバー漏れ・ドリフトの温床)。テンプレを作る時は「この意味は他のkindでも来ないか」を<b>横断確認</b>。実例(2026-06-07 必中の照合): ✗「2倍」が <code>ダメージ倍率</code>(穴で落ちる)と <code>威力倍率</code>(出る)に分裂 / ✗「必ず急所」が独立kind <code>必ず急所</code> と <code>急所率上昇 always_crit</code> の2系統 / ✗「ちいさくなる使用時」条件が <code>target_used_minimize/target_minimized/target_used/target_used_move</code> の4表記。'],
  ['照合して抜けを丁寧に追加', '作った効果(新版)とヤックン(legacy)を必ず<b>見比べ</b>、新版に抜けている意味がないかチェックする。<b>抜けていれば、丁寧に effects へ追加</b>して補完する(=「略さない」の実行・voiced≠completeの実践)。これを各技でやる。実例=なみだめのまもり貫通(上記「略さない」例2)。'],
  ['SSOT編集は検証してから書く', '<code>pokechan_data.js</code>(SSOT)を編集する時は、<b>置換件数チェック＋JSON妥当性検証</b>をしてから書き込む(事故防止)。手順: 該当文字列がN件きっかり一致するか確認 → 置換 → WAZA_MAPがparseできるか確認 → 期待どおりか確認 → OKなら保存。'],
  ['技を完結させる(ハイブリッド)', '<b>技を✅完結(穴ゼロ)させてから次へ</b>=部分✅で放置しない(放置すると別kind開通のたびに同じ技を再チェック=再チェック税／小kindがほったらかしに)。確認HTMLの<b>技単位バッジ(✅完結/⚠残りN穴)</b>で完結技は再チェック不要。<b>設計品質は守る</b>=テンプレは同kind全件を見て一度で正しく(1技だけ見て設計しない=意味の分裂の罠)。だが<b>あと1〜2穴の技・1〜2技しか持たない小kindは見えたら一緒に潰す</b>。残り穴は確認HTMLの「あと1穴で完結」リストで可視化。'],
];

// 言葉のルール(表記・語彙)
const WORD = [
  ['日本語ベース・正確', '日本の製品。正確で標準的な日本語(公式準拠の用語・適切な漢字)。英語は英語のままでよい。'],
  ['幼稚化しない', '公式技説明の全ひらがな・幼稚な表現に寄せない。一般的な日本語表現にする。'],
  ['急所も±N(急所+1)', '急所率の上昇は <b>「急所+1」</b>(「ランク」語は省く・短く=能力ランク±Nと揃える)。✗「急所ランクがひとつ上がる」(2026-06-06の和語数詞ルールは<b>2026-06-07に上書き廃止</b>)。`always_crit`→「必ず急所に当たる」。'],
  ['数値はそのまま', '確率などの数字は崩さない(「10%」のまま。「10回に1回」にしない)。'],
  ['能力ランクは±N表記(全技共通)', '<b>能力ランクの増減は「{能力}+N / {能力}-N」で固定・全技で例外なく統一</b>(例「相手のこうげき-1、とくこう-1」「自分のこうげき+2」「相手全員のかいひ-2」)。✗「〜が1段階さがる/あがる」「ランクが上がる/下がる」。対象=こうげき・ぼうぎょ・とくこう・とくぼう・すばやさ・命中率・回避率 の<b>全能力</b>(こうげき系はlegacy同様ひらがな／命中率・回避率はlegacyが漢字なので漢字)。複数能力でも<b>各能力に符号数値を繰り返す</b>。※「最大まで」(はらだいこ等 to_max)だけは数値でないので特例。条件文の「能力ランクが上がった時」(しっとのほのお等)はランク変化でなく条件なので対象外。<b>急所も±N</b>だが「ランク」語を省いて <b>「急所+1」</b>(別ルール参照)。'],
  ['急所(stages)', '`急所率上昇 stages:1` →「急所+1」(解釈・softeningしない・「ランク」語は省く)。`always_crit`→「必ず急所に当たる」。'],
  ['囲み記号=「 」', '状態名・用語の囲みは「 」(2026-06-07・ヤックンの『 』と差別化)。海外向けの " " は i18n時に再考。'],
  ['ひるみ=ひるませる', 'ひるみは一回の動作(持続状態でない)→「相手をひるませる」。「『ひるみ』状態にする」は不自然(全19技 duration無し=◇確定)。'],
  ['カテゴリは文頭に付けない', '【急所】等を説明文の頭に付けない。効果の種類は<b>タグ</b>で分かるようにする(タグをちらっと見れば分かる設計)。'],
  ['機械語を出さない', 'true / 0.125 / 英語 / キー名 を出力に出さない(部品→日本語に)。'],
];

const sec = (title, color, rules) => `
<section><h2 style="border-color:${color};color:${color}">${title}</h2>
${rules.map(([k, v], i) => `<div class="rule"><div class="rk" style="background:${color}">${i + 1}. ${esc(k)}</div><div class="rv">${v}</div></div>`).join('')}
</section>`;

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>わざリスト ルールリスト(集約)</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;margin:0;background:#0f1419;color:#e6edf3;line-height:1.8;font-size:16px}
 .wrap{max-width:900px;margin:0 auto;padding:0 18px 60px}
 header{padding:16px 18px;background:#1F4E79;color:#fff;margin-bottom:14px}
 h1{font-size:20px;margin:0} .date{font-size:12px;color:#cfe0f0;margin-top:5px}
 h2{font-size:18px;margin:26px 0 12px;padding-bottom:6px;border-bottom:2px solid}
 .rule{display:flex;gap:0;margin-bottom:9px;border:1px solid #30363d;border-radius:8px;overflow:hidden}
 .rk{flex:0 0 200px;padding:10px 13px;color:#fff;font-weight:700;font-size:14.5px;display:flex;align-items:center}
 .rv{flex:1;padding:10px 14px;font-size:14.5px;background:#11161c;color:#c9d1d9}
 .rv b{color:#ffd479}
 .note{font-size:12.5px;color:#6e7681;margin-top:20px}
 .basis{margin:14px 0 8px;padding:13px 16px;background:#10263d;border:1px solid #4a90d9;border-left:5px solid #4a90d9;border-radius:8px;font-size:15px;color:#cfe6ff}
 .basis b{color:#ffd479}
</style></head><body>
<header><div class="wrap" style="padding-bottom:0"><h1>📏 わざリスト ルールリスト(集約)</h1>
<div class="date">説明文づくりの全ルール / 2026-06-07 / SSOT=ヤックン耳_判断ログ.md(本表はその集約ビュー)</div></div></header>
<div class="wrap">
<div class="basis">📋 <b>確認は必ず <code>review/waza_list_confirm.html</code> をベースに使う</b>(本番デザイン・効果カテゴリー別セクション)。各技で <b>効果(新版)↔ヤック(legacy)</b> を<b>意味で照合</b>する。これがわざリスト確認の標準・セッションが変わっても不変。</div>
${sec('✍️ 書き方のルール(姿勢・方針)', '#7ee787', WRITE)}
${sec('🔤 言葉のルール(表記・語彙)', '#79c0ff', WORD)}
<div class="note">確認フォーマット: <b>tools/_waza_list_confirm.js → review/waza_list_confirm.html</b>(本番デザイン・効果カテゴリー別セクション・列=名前→優先→フラグ→タイプ→分類→威力…→Effects→効果→タグ→ヤック)。これで毎回チェックする。</div>
</div></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'rules.html'), html);
console.log('生成: review/rules.html / 書き方', WRITE.length, '+ 言葉', WORD.length, 'ルール');
