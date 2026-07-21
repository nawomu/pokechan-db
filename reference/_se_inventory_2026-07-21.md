# バトルSE(効果音)棚卸し 2026-07-21

対象: 現行バトル系3ページ(`real_battle.html` / `battle_lab.html` / `online_battle.html`)が使うWebAudio合成SEの全数棚卸し。目的=阿部さん方針「合成チップチューンSE→リアルな効果音」への差し替え検討の設計素材。**全SEは`SE = {...}`オブジェクト内で定義され、3ページとも完全に同一実装(クローン)。** 呼び出し側のロジック(いつ鳴るか)も3ページ完全同一。以下の表は`real_battle.html`の行番号を代表として引用する(同一内容が`battle_lab.html`/`online_battle.html`にも複製されている)。

## SEオブジェクト定義位置(3ページ完全同一クローン)

| ファイル | `SE = {` 開始行 | 終了(`};`)行 |
|---|---|---|
| `real_battle.html` | 3276 | 3330 |
| `battle_lab.html` | 4601 | 4655 |
| `online_battle.html` | 3848 | 3902 |

合成の下地関数(`real_battle.html`側の定義。他2ページも同一):
- `tone(type, freq, dur, vol, slideTo, when)` — `real_battle.html:3212` オシレータ単音(波形/周波数/長さ/音量/ピッチスライド先)
- `noise(dur, vol, lowpass)` — `real_battle.html:3224` ホワイトノイズ+ローパス(打撃音の下地)
- `noiseSweep(dur, vol, fromHz, toHz)` — `real_battle.html:3237` ノイズ+ローパス周波数スイープ(ロング音のうねり)
- `explosionFx()` — `real_battle.html:3252` ノイズ+ローパススイープ+サブベース(爆発音)
- 出口は共通マスターゲイン`dest()`(`real_battle.html:3183`。`DynamicsCompressor`経由で`ctx.destination`へ)

さらに`fx_primitives.js`(3ページ共通で`<head>`読込)側の`attackFx`/`chargeFx`/`rankFx`/`faintFx`/`sendOutFx`/`abilityFx`等が、上記`SE`オブジェクトのメソッドを**演出のトリガーとして**呼んでいる(`fx_primitives.js`自体は音を合成しない=グローバルな`SE`を呼ぶだけ)。`playSE`のような専用ラッパー関数は存在しない(`grep`で0件確認済み)。`real_battle_simulator.html`(バトルロジックエンジン)にはSE関連コードは無い(音はUI側=real_battle.html等の役割で、エンジンはロジックのみ)。

`battle_fx_cues.js`(演出ツクールの書き出しSSOT・`window.BATTLE_FX_CUES`)内の`track:"sound", action:"se"`キューは現状すべて`params.cls`(phys/spec)指定のみで、`params.name`指定は0件(`grep`確認済み)。つまり現行の技別キューシートは全部`SE.hitClass(cls)`経由で鳴っており、個別SE名を直接指定するキューはまだ使われていない。

---

## 表: 全SEインベントリ(35行)

`SE`オブジェクトの直下キーは19個(`select`/`hit`/`superEff`/`weak`/`crit`/`faint`/`heal`/`status`/`endure`/`mega`/`explosion`/`enter`/`win`/`lose`/`miss`/`hitClass`/`rankUp`/`rankDown`/`ailment`)。うち`hitClass(cls)`と`ailment(key)`は引数で音を出し分けるコンテナで、実質的に別々の合成をしているサブキーがそれぞれ10個・8個ある。**それらサブキーも1音=1行として数える**ので、表の行数は 17(単独キー)+10(hitClassサブ)+8(ailmentサブ) = **35行**。

| SE名(コード上のキー) | 鳴る場面(いつ・何の演出) | 現在の合成内容の要約(波形/長さ) | リアル音プロンプト案(MOSS-SoundEffect用・英語) | 優先度 |
|---|---|---|---|---|
| `SE.select()` (`real_battle.html:3277`) | UI操作全般の共通クリック音。技/わざ選択(`real_battle.html:1629,1635`)・パーティ交代スロット選択・交代確認yes/no/戻る(`2884,2896,2901,2903`)・選択モーダルの行/セル決定(`1518,1572`)・おすすめビルド適用(`1406`)・音量スライダーの試し鳴らし(`2066`)・「つぎの相手」ボタン(`3984`)など。専用の「決定/キャンセル」音は無く全部この1音が兼務(コードにdecide/cancel名は無い)。 | `tone('square', 880, 0.06, 0.12)` — 矩形波880Hz・60ms・単発ピッ音 | "a single short clean UI click / confirm blip, soft synth beep, 60ms, crisp and minimal, no reverb" | 低 |
| `SE.hit()` (`real_battle.html:3278`) | 汎用の打撃反応音。攻撃技本体は`hitClass`が鳴らす専用音を使うため、`SE.hit()`自体は限定用途=こんらん自傷(`3639-3640`)とみがわりが攻撃を受けた時(`3682`)の2箇所。 | `noise(0.16,0.5,900)`(ローパス900Hzノイズ160ms) + `tone('square',180,0.12,0.2,70)`(矩形波180→70Hzスライド) | "a soft dull body punch thud, muffled, low-mid frequency, 150ms, no metallic ring" | 中 |
| `SE.superEff()` (`real_battle.html:3279`) | 「こうかは ばつぐんだ！」の演出(`3689`)。技クラス代表音とは別に技全体の"効果抜群"を示す強調音として重ねて鳴る。 | `noise(0.25,0.6,2200)`(ローパス2200Hzノイズ250ms) + `tone('square',320,0.22,0.25,60)` + `tone('square',480,0.18,0.18,90)`(2音の下降スライド重奏) | "an impactful triumphant sting for a critical/super-effective attack, bright metallic clang layered with a rising then falling tone, 250-300ms, punchy" | 高 |
| `SE.weak()` (`real_battle.html:3280`) | 「こうかは いまひとつのようだ…」(`3690`)、「こうかが ないようだ」(`3623,3625,3628`) | `noise(0.1,0.25,500)`(ローパス500Hzノイズ100ms) + `tone('triangle',140,0.14,0.18,90)`(三角波140→90Hzスライド) | "a muffled, deflated thud indicating a weak/no-effect hit, dull low-pass whoosh with a soft descending tone, 150ms, anticlimactic" | 中 |
| `SE.crit()` (`real_battle.html:3281`) | 「きゅうしょに あたった！」急所ヒット(`3691`) | `tone('sawtooth',1400,0.1,0.22,500)`(ノコギリ波1400→500Hzスライド) + `noise(0.2,0.5,3000)`(ローパス3000Hzノイズ) + `tone('square',250,0.2,0.2,60)` | "a sharp bright critical-hit sting, crisp metallic crack with a fast high-to-mid pitch drop, 200ms, cutting through the mix" | 高 |
| `SE.faint()` (`real_battle.html:3282`。呼び出しは`fx_primitives.js:1012`の`faintFx()`) | ポケモンが「ひんしになった！」で沈んで消える演出(`real_battle.html:3775-3780`が`faintFx`を起動) | `tone('square',520,0.5,0.22,65)`(矩形波520→65Hzロングスライド500ms) + `tone('triangle',260,0.55,0.18,40)`(三角波260→40Hz 550ms) | "a sad descending 'defeat' tone, low sinking pitch bend, soft and mournful, 500-600ms, game-over feel but gentle" | 高 |
| `SE.heal()` (`real_battle.html:3283`) | HP回復技/道具の残HP行(`3961`)、状態異常が治った演出(`3896`) | `[523,659,784,1047].forEach` — ドの和音的な4音上昇アルペジオ(矩形波・各120ms・90ms間隔) | "a gentle magical healing chime, ascending harp-like arpeggio, 4 soft bell notes, warm and reassuring, ~400ms total" | 中 |
| `SE.status()` (`real_battle.html:3284`) | 特性発動バナー(`fx_primitives.js:894`)・ばけのかわ剥がれ(`3645`)・こおり解け(`3763`)・へんしん(`3865`)・イリュージョン解除(`3883`) | `tone('square',330,0.1,0.16,392)` + `tone('square',392,0.1,0.16,330)`(2音の交差スライド=行き来する短音) | "a short neutral status-change blip, two quick alternating synth tones, notification-like, 200ms" | 中 |
| `SE.endure()` (`real_battle.html:3285`) | きあいのタスキ/がんじょう/こらえるで「もちこたえた！」(`3772`) | `tone('square',220,0.1,0.2,440)` + `tone('square',440,0.14,0.16,遅延0.06s)`(低→高の2段踏ん張り音) | "a determined 'holding on' grunt tone, two short rising synth stabs conveying resilience, 200ms" | 中 |
| `SE.mega()` (`real_battle.html:3286-3287`) | メガシンカ演出(`3828`)、マイティチェンジ初登場(`3890`) | `[440,554,659,880,1109].forEach`5音上昇アルペジオ(80ms間隔) + `noise(0.5,0.25,4000)` + `noiseSweep(1.2,0.16,200→2200Hz)`(1.2秒のロングうねり) | "an epic ritual transformation swell, ascending magical arpeggio building into a rising shimmering sweep, 1.2-1.5s, grand and awe-inspiring" | 高 |
| `SE.explosion()` (`real_battle.html:3288`。実体=`explosionFx()` `3252-3274`) | 大技/KO限定の爆発音。ばつぐん+大技(`3689`)、急所+大技(`3691`)、KOスロー演出(`fx_primitives.js:702`は無条件) | ノイズ600ms(ローパス3000→100Hzスイープ) + サブベース正弦波60→30Hz(450ms) | "a punchy explosion boom, deep sub-bass thump with a bright noise burst that quickly decays, 500-600ms, cinematic impact" | 高 |
| `SE.enter()` (`real_battle.html:3289`。呼び出しは`fx_primitives.js:977`の`sendOutFx()`) | ポケモン登場全般: 交代・死に出し登場(`sendOutFx`経由)、みがわり出現(`3677`)、フォルムチェンジ(`3877`) | `tone('square',392,0.07,0.14,784)`(矩形波392→784Hzスライド70ms・短い上昇ピッ) | "a quick bright 'pop-in' whoosh-blip for a character entrance, short rising pitch, 100-150ms, snappy" | 高 |
| `SE.win()` (`real_battle.html:3290`) | バトル勝利(`4021`)、オンライン対戦相手が退室/降参して勝ち(`4202`) | `[523,523,523,659,784,1047].forEach`6音ファンファーレ(最後の音だけ500ms伸ばす・矩形波) | "a short victory fanfare jingle, triumphant ascending melody with a held final note, upbeat 8-bit style, ~1s" | 高 |
| `SE.lose()` (`real_battle.html:3291`) | バトル敗北(`4021`) | `[392,370,349,330].forEach`4音下降(三角波・各300ms・280ms間隔) | "a somber descending defeat melody, 4 slow falling tones, minor key, gentle and not harsh, ~1.2s" | 高 |
| `SE.miss()` (`real_battle.html:3293`。呼び出しは`fx_primitives.js:385,406`) | 攻撃が外れた時の飛翔体フェード演出に同期(接触技・非接触技どちらも`attackFx`/`chargeFx`のhit=false分岐から) | `tone('sine',340,0.09,0.14,140)`(正弦波340→140Hz90ms) + `noise(0.05,0.1,500)`(ローパス500Hz50ms) | "a soft 'whiff' miss sound, quick airy whoosh with a light descending tone, 100ms, understated" | 中 |
| `SE.hitClass('punch')` (`real_battle.html:3300`) | 技クラス=パンチ技(`flags.punch`)の着弾音。`fx_primitives.js:384`(`attackFx`)/`406,470`(`chargeFx`)から`cls='punch'`で発火 | `tone('square',150,0.13,0.22,50)`(矩形波150→50Hz130ms)。ばつぐん/急所時は共通ブースト(下記参照)が追加 | "a solid fist punch impact, meaty thud with a low-frequency knock, 130ms, physical and weighty" | 高 |
| `SE.hitClass('slash')` (`real_battle.html:3301`) | 技クラス=切断技(`flags.slicing`/`flags.slash`) | `tone('sawtooth',900,0.08,0.16,220)`(ノコギリ波900→220Hz80ms) | "a sharp blade slash swoosh, quick metallic swipe with a bright transient, 80-100ms, crisp" | 高 |
| `SE.hitClass('bullet')` (`real_battle.html:3302`) | 技クラス=弾/ボール技(`flags.bullet`/`flags.ball`) | `tone('square',720,0.05,0.15,300)`(矩形波720→300Hz50ms・短い高音パルス) | "a quick projectile impact pop, sharp short high-pitched thwack, 50-80ms" | 高 |
| `SE.hitClass('wind')` (`real_battle.html:3303`) | 技クラス=風技(`flags.wind`) | `tone('sine',500,0.16,0.13,220)`(正弦波500→220Hz160ms) | "a gusting wind hit, airy whoosh sweep with a soft low resonance, 150-200ms" | 高 |
| `SE.hitClass('bite')` (`real_battle.html:3304`) | 技クラス=噛みつき技(`flags.bite`) | `tone('square',200,0.1,0.2,90)`(矩形波200→90Hz100ms) | "a sharp bite/chomp snap, quick jaw-clamp crunch, 100ms, crisp and physical" | 高 |
| `SE.hitClass('kick')` (`real_battle.html:3305`) | 技クラス=キック技(技名に「キック」「蹴」を含む) | `tone('square',160,0.12,0.22,60)`(矩形波160→60Hz120ms) | "a strong kick impact thud, low heavy foot strike, 120ms, physical" | 高 |
| `SE.hitClass('sound')` (`real_battle.html:3306`) | 技クラス=音技(`flags.sound`。24技統一。視覚は`noteFx`が別途音符グリフを出すが、こちらが実際の着弾SE) | `tone('triangle',587,0.12,0.16,784)` + `tone('triangle',784,0.1,0.11,遅延0.06s)`(上昇2音) | "a resonant sonic wave impact, bright ringing tone with a quick harmonic echo, 150-200ms" | 高 |
| `SE.hitClass('wave')` (`real_battle.html:3307`) | 技クラス=波動技(`flags.pulse`) | `tone('sine',300,0.2,0.15,520)` + `tone('sine',460,0.16,0.11,遅延0.05s)`(正弦波2音・上昇) | "a pulsing energy wave impact, smooth rising synth tone with a subtle shimmer, 200ms" | 高 |
| `SE.hitClass('spec')` (`real_battle.html:3308`) | 技クラス=既定(特殊技で他フラグ無し)。岩・氷・電気・炎など専用フラグを持たない特殊技(例: いわなだれの特殊版があれば該当・多くの特殊技全般)がここに落ちる | `tone('sine',440,0.18,0.17,660)`(正弦波440→660Hz上昇180ms) | "a bright special-move energy impact, clean rising synth tone with light sparkle, 180ms, versatile" | 高 |
| `SE.hitClass('phys')` (`real_battle.html:3309`。既定=フォールバック) | 技クラス=既定(物理技で他フラグ無し)。**いわなだれ等の岩技・アイアンヘッド等の鋼技もここに落ちる**(専用のrock/metalクラスは無い=下記「差し替え設計の論点」参照) | `tone('square',180,0.12,0.2,70)`(矩形波180→70Hz120ms。`SE.hit()`と同型) | "a generic physical body-blow thud, solid mid-low impact, 120ms, all-purpose melee hit" | 高 |
| `hitClass`共通ブースト層(`real_battle.html:3298,3312`) | 上記10クラス全てに対し、ばつぐん(`intensity='up'`)または急所(`intensity='crit'`)時だけ追加される強調レイヤー | ベースノイズを0.15→0.2/vol0.42→0.52に増量 + `tone('square',2400,0.03,0.12,1800)`高域クリック30ms | "a bright high-frequency click layer to accentuate a critical/super-effective hit, thin metallic tick, 30ms, additive" | 中 |
| `SE.rankUp()` (`real_battle.html:3314`。呼び出しは`fx_primitives.js:584`の`rankFx()`) | 能力ランク上昇(つるぎのまい等・「あがった」行) | `tone('sine',440,0.16,0.15,900)`(正弦波440→900Hz上昇スイープ160ms) | "a rising power-up whoosh, smooth ascending synth sweep, 150-200ms, positive and energizing" | 中 |
| `SE.rankDown()` (`real_battle.html:3315`。呼び出しは`fx_primitives.js:584`の`rankFx()`) | 能力ランク下降(「さがった」行) | `tone('sine',440,0.18,0.15,210)`(正弦波440→210Hz下降スイープ180ms) | "a falling power-down whoosh, smooth descending synth sweep, 180ms, negative but not harsh" | 中 |
| `SE.ailment('まひ')` (`real_battle.html:3319`) | まひ状態付与(`3705`)、まひで動けない(`3758`) | `noise(0.05,0.26,4200)`(高域ノイズ50ms) + `tone('square',950,0.04,0.13,300)`(矩形波950→300Hz40ms) | "a sharp electric shock crackle, quick static zap, high-frequency buzz, 80-100ms" | 中 |
| `SE.ailment('やけど')` (`real_battle.html:3320`) | やけど状態付与(`3705`) | `noise(0.14,0.28,1400)`(ローパス1400Hzノイズ140ms) + `tone('sawtooth',230,0.11,0.12,70)`(ノコギリ波230→70Hz110ms) | "a hissing sizzle/burn sound, quick fire crackle with a low sear, 150-200ms" | 中 |
| `SE.ailment('こおり')` (`real_battle.html:3321`) | こおり状態付与(`3705`) | `tone('sine',1900,0.14,0.15,2800)`(正弦波1900→2800Hz上昇140ms・単音) | "a crisp icy freeze chime, high glassy tinkling tone, cold and sharp, 150ms" | 中 |
| `SE.ailment('ねむり')` (`real_battle.html:3322`) | ねむり状態付与(`3705`) | `tone('sine',330,0.18,0.1,260)`(正弦波330→260Hz下降180ms・単音) | "a soft drowsy descending tone, gentle sleepy 'zzz' feel, low volume, 200ms" | 中 |
| `SE.ailment('ねむけ')` (`real_battle.html:3323`) | ねむけ(あくび等の1ターン後発症)付与(`3705`) | `tone('sine',330,0.18,0.1,260)`(`ねむり`と同一波形) | "a soft drowsy descending tone, gentle sleepy feel, low volume, 200ms (same as sleep)" | 低 |
| `SE.ailment('どく')` (`real_battle.html:3324`) | どく状態付与(`3705`) | `noise(0.12,0.26,650)`(ローパス650Hzノイズ120ms) + `tone('square',160,0.12,0.15,90)`(矩形波160→90Hz120ms) | "a squelchy poison bubble/gloop sound, low murky bloop, 150ms" | 中 |
| `SE.ailment('もうどく')` (`real_battle.html:3325`) | もうどく状態付与(`3705`) | `noise(0.14,0.28,600)` + `tone('square',140,0.14,0.17,80)`(`どく`よりやや低く長い) | "a heavier, more toxic squelchy gloop sound, deeper murky bubble, 150-180ms (stronger than regular poison)" | 中 |
| `SE.ailment('こんらん')` (`real_battle.html:3326`) | こんらん付与(`3705`) | `tone('triangle',500,0.1,0.13,700)` + `tone('triangle',400,0.1,0.1,300)`(2音が交差する不安定な音) | "a wobbly disorienting confusion warble, two dissonant triangle-wave tones crossing pitch, 200ms, dizzy feel" | 中 |

---

## 現在SEが鳴っていない主要な演出(参考・棚卸し対象外だが差し替え検討で重要)

タスク仕様が「特に丁寧に」と指定した天候・岩系は、**現状コード上に該当のSEが1件も存在しない**(捏造防止のため上の表には含めていない)。差し替え設計では「今ある合成音の置き換え」だけでなく「今は無音の演出に新規SEを足す」判断も必要になるため、根拠付きで列挙する。

- **天候(あめ/すなあらし/ゆき/にほんばれ)**: `setWeatherFx(kind)`(`fx_primitives.js:764-772`)は絵文字パーティクル+`#field`への`box-shadow`色付けのみ。呼び出し元`real_battle.html:3733-3737`(天候開始/切替の行)も含め、SE呼び出しは無い。天候ダメージ(すなあらし/やけど等のスリップダメージ)も同様に`real_battle.html:3596-3611`(②スリップ系の残HP行)はSE呼び出し無し(popText/flashのみ)。
- **設置技(ステルスロック/まきびし/どくびし/ねばねばネット)**: `hazardFx(side, kind, count)`(`fx_primitives.js:904-923`)はミニアイコン(🪨/△/☠/🕸)を常駐させるDOM操作のみ。呼び出し元`real_battle.html:3845-3850`にもSE呼び出しは無い。
- **まもる系(まもる/みきり/ワイドガード等のバリア展開)**: `shieldFx(side, color)`(`fx_primitives.js:812-825`)はバリアドームのCSS要素追加のみ。呼び出し元`real_battle.html:3833-3834`にSE呼び出し無し。
- **壁(リフレクター/ひかりのかべ/オーロラベール)の設置/解除**: `showWallFx`/`hideWallFx`(`fx_primitives.js`。定義に`SE.`呼び出し無し)。呼び出し元`real_battle.html:3835-3841`もSE呼び出し無し。
- **縛り技(からめとる/しめつける等・鎖/巻き付き演出)**: `bindFx(side, color)`(`fx_primitives.js:860-875`)はリングDOM要素のみ。着弾自体の音は縛り技が`punch`/`slash`等の専用フラグを持たない限り上表の`hitClass('phys')`(汎用の体当たり音)に落ちる=「鎖がガチャッと締まる」ような専用音は無い。
- **ひるみ**: `real_battle.html:3764-3767`(「は ひるんで うごけない！」)はpopText+`knockbackFx`のみ、SE無し。

---

## 差し替え設計の論点

**① ファイル形式/サイズ(mp3/短尺)**: 現行はWebAudioのオシレータ/ノイズバッファ即時生成=ファイル読み込み無し・遅延ゼロ。リアル音源化はBGM(`assets/bgm/pb_*.mp3`・`real_battle.html:3357`の`fetch`+`decodeAudioData`)と同じ経路が流用できる。SEは1回あたり50〜600ms程度が大半なので、mp3は各ファイル数十KB以内・44.1kHz/128kbps程度で十分。攻撃系(`hitClass`10種)は毎ターン複数回鳴るため、初回だけでなく事前プリロード(`pbBgmBufCache`同様のMapキャッシュ)が必須。

**② 音量正規化**: 上表の合成音は`vol`引数で手動チューニング済み(例: 爆発音`gain=1`、状態異常音`gain=0.12〜0.28`)だが、リアル音源(効果音ライブラリ/MOSS-SoundEffect生成)はファイルごとにピークがバラバラになりやすい。全SEファイルをLUFS/ピークで揃える正規化ステップ(例: -16〜-14 LUFS目標)を差し替えパイプラインに組み込み、`hitClass`のように1関数で10種類鳴らす箇所は特に横並びの音量差が耳につきやすいので要注意。

**③ 既存マスターゲイン(`dest()`)への接続**: 全SE/BGMは`dest()`(`real_battle.html:3183-3202`)の`masterVol`→`DynamicsCompressor`→`ctx.destination`という共通の出口を通っている(音量スライダー`rb_vol`が全SEに効く前提)。mp3再生に切り替える場合も、`AudioBufferSourceNode`を素の`ctx.destination`に繋がず、必ず既存の`dest()`ゲインノードを経由させること(スライダー無効化・BGMとの音量バランス崩壊を防ぐ)。

**④ チップチューンSEとの共存or置換**: 全面置換は「ステルスロック等の設置音を新規追加」のような**現状無音の演出**にはそのまま当てはまらない(無音→新規追加は"共存"の議論ではなく単純追加)。一方`hitClass`10種のような**既に鳴っている音**を置き換える場合は、UI音(`select`)だけ従来のチップチューン矩形波を残し、攻撃/天候/状態異常などバトル演出系だけリアル音に差し替える段階的移行(優先度=高から着手)も選択肢。フォールバック(mp3読み込み失敗時)は現行の合成音にそのまま戻す設計が安全(`pbBgmLoadBuffer`の`catch`と同じ思想)。
