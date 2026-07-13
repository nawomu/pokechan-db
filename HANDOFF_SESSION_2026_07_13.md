# HANDOFF 2026-07-13(演出ツクール実運用開始+バトル演出/データ整合 一気通貫・全部本番反映)

前: `HANDOFF_SESSION_2026_07_12.md`(自動復活ウォッチドッグ事故と恒久対策)。
本セッション=阿部さんが**本番でプレイしながら見つけた不具合を次々に修正**した回。6コミット全部 pchamdb.com ライブ反映済み。運用=**設計/検証/報告=Fable(私)・実装=Sonnetサブエージェント**(Fable週枠が金曜22:00リセットまで厳しいため実装は全部委譲)。

---

## 1. 今日やったこと(6コミット・全部ライブ)

| commit | 内容 |
|---|---|
| `b039ee12` | **接触技の突進クローンの左上ワープ+縮小を根治**(下§2-A)+演出ツクールのタイムライン=ルーラードラッグで再生ヘッド移動 |
| `9d5053a8` | **交代の退場/登場を2モーション分離**(下§2-C)+**選出画面の持ち物同期**(下§2-D) |
| `ea63cb98` | **フレアドライブの調整演出を本番採用**(演出ツクール書き出しJSON統合・下§2-B) |
| `7d2d6b67` | **交代の退場チラつき根治**(flash()の800ms自動解除・下§2-E) |
| `33cfac3c` | **予告後の間を短縮**(下§2-F)+**フレアドライブ尺を全技デフォルトに**(下§2-G) |
| `3a53d322` | **メガストーン汎用化**(下§2-H)+**ばけのかわ時の技告知/演出**(下§2-I) |

現在の cache-buster: `fx_primitives.js?v=20260713c` / `battle_fx_cues.js?v=20260713a` / エンジンiframe `real_battle_simulator.html?v=20260713a`。

---

## 2. 各修正の要点(次に触る人向け)

### A. 接触技の突進クローンが「左上ワープ+縮小」(本番の実バグ・全接触技)
`fx_primitives.js` の `chargeFx`(本番リアルバトル用)と `_cueChargeMotionProd`(演出ツクール用)。突進はスプライトを複製して **body直下fixed** で飛ばすが、①`#f-<side>`の奥行きscale(自分1.2/相手0.95) ②`#field`のzoom(fitField可変) ③className上書きで失う`.sprite`のクラス由来CSS(中央下寄せ/imgサイズ上限/`scaleX(-1)`向き反転)を補正しておらず、突進開始時に**左132px/上39pxワープ+縮小**していた(実測)。
→ **`scale = r.width / sp.offsetWidth`**(offsetWidthはtransform/zoomの影響を受けない生値=複合スケールを丸ごと拾う)でクローンに焼き戻し+`transform-origin:'0 0'`+祖先依存CSSを`getComputedStyle`で実測しインライン再適用。**★教訓=body直下fixedのクローンは親のscale/zoom/クラス由来CSSを全部失う**。

### B. フレアドライブの調整演出を本番採用(演出ツクール実運用の初弾)
阿部さんが `fx_editor.html` で調整→「書き出し(JSON)」した `~/Downloads/battle_fx_cues.json` を `reference/battle_fx_cues.json` に **done:true** で統合→`node tools/_build_battle_fx_cues_js.js`→`battle_fx_cues.js`再生成→`?v`bump。charge550/burst1950/popnum2000+burst位置offset(x-4,y21)。本番で `resolveCueSheet(mv)`→`playCueSheet` がこのシートを再生(popnumの"−42"は実ダメージに差し替え)。**他技は不変**。
→ **★演出ツクール統合フロー(不変)**: エディタで調整→書き出しJSON→`reference/battle_fx_cues.json`に **done:true** で統合→`node tools/_build_battle_fx_cues_js.js`→`?v`bump→push。**done:trueのシートだけ本番採用**(ドラフトは従来演出のまま)。`_BURST_DEFAULT_MS(650)`はシート倍率の基準なので**変えない**。

### C. 交代の退場/登場が重なって一瞬でポップ→2モーションに分離
交代は既に2ログ行(引っ込め/登場)に分割済みだったが、**真因=`#moves`/`#party`が`#field`の子孫**で、技/「交代する」クリックが`say()`で新メッセージを出した直後に **`#field`の click(advanceMsg)へバブル**し、同じクリックで1コマ目(引っ込め行)を即送りしていた(1msで登場へ)。
→ 技ボタン/`sw-yes`に **`e.stopPropagation()`**(既存`btn-exit`と同じ作法)。加えて保険で `_recallFxDelay`(最低1150ms=rbRecall 1s+一拍)を`nextSay`の自動送りホールドに追加。**★教訓=行動確定クリックは#fieldへバブらせない**。

### D. 選出画面(せんしゅつ)で持ち物を変えても左カードが古いまま
選出画面は編成の中央詳細`#sel-detail`を流用するが、もちもの変更は編成側`$(id)`だけ更新し**`#pick-mine`を取り残していた**。→ `refreshPickMineCards()`新設(選出画面が開いてる時だけ`#pick-mine`作り直し+クリック再配線+バッジ復元、未オープン時は何もしない)をもちもの変更後に呼ぶ。

### E. 退場アニメの途中で一瞬ホーム復活するチラつき
`recallFx`が汎用`flash('recall')`を使っていたが、**`flash()`は800msで自動的にclassを外す**仕様。`rbRecall`は1s(forwards)の沈み演出なので、**800msで沈みきる前にrecallが剥がれ素の姿(不透明度1・原位置)へ一瞬戻り**、1000msの`_recallTimer`でgone=「沈む→一瞬ホーム復活→また消える」。faintFxが同理由でflash()を避けているのと同じ取りこぼし。→ `recallFx`も自前でclass付け外し、`_recallTimer`(1000ms)まで保持。**★教訓=800ms超の演出はflash()を使わない(自前class管理)**。

### F. 攻撃予告(ぴょんぴょん)の後、技が出るまでの間が長すぎる
攻撃前の「◯◯の こうげき！」予告行(`rbPreAttack` 0.7s)が**送り速度ぶん(ふつう≈2900ms)まるまる待って**技へ進んでいた=跳ねた後に約2秒の無。→ 予告行に **`hold:850`** を持たせ、`nextSay`が `line.hold != null` なら送り速度を上書き。実測 2902ms→852ms。real_battle/online_battle両方。

### G. フレアドライブの尺を全技のデフォルトに
done:trueシート未対応の全技の自動演出で **burst 650→1950ms・popnum 1000→2000ms**(フレアドライブで阿部さんが実機OK確認した尺)。突進速さは230msのまま据え置き。実装=既定攻撃パスの `burstFx`/`popText` に `durMs` 指定(`fx_primitives.js chargeFx`接触/`real_battle`・`online_battle`非接触)+エディタ自動分解の既定尺(`fx_editor.html`)も同期。**★実機で「長すぎ/ちょうどいい」の感想があれば数値微調整はすぐ可能**(1950/2000を下げるだけ)。

### H. おすすめビルドを当てるとメガストーンが専用石になる
設計=メガストーンは汎用`mega_stone_any`1種だけ(2026-07-06)。だが**おすすめビルド60プリセットが種専用ストーン名**(マフォクシナイト等)を持ち、適用時に専用keyが漏れていた。→ **`normalizeMegaItemKey(key)`**新設(`category==='mega_stone'`なら`mega_stone_any`へ)を**外部由来の全経路**(applyPresetToSlot/applySpeciesMemo/loadTeam/loadHandoff/onlineApplyOppTeam)に配線。非メガ持ち物は不変。

### I. ばけのかわ時に攻撃技の告知/演出が抜ける
ミミッキュのばけのかわでブロックされると「◯◯の 技！」の告知/演出が出ず、いきなり「はがれた」になっていた。**原因=sim(`real_battle_simulator.html` `phaseDealDamage`)がブロック時にreason(無効文)しかログせず技使用行を出していなかった**。→ sim側で`disguiseBlock`時に「◯◯の 技！」を先に出す+reasonに「！」補完(はがれ演出fx/i18nパターンbl_258が「！」終わり前提=**潜在バグも同時修正**)。表示側(real_battle/online_battle)は**次行が「ばけのかわが はがれた！」の時だけ**予告+攻撃fxを出す狙い撃ち(かたやぶり等の裸の入場宣言と同形なので次行で判別)。sim回帰 **823/825**(既存2件のみT185d・新規なし)。
→ **★教訓=エンジンは`real_battle_simulator.html`をiframe(`?v=`付き)で読み込む。sim(このファイル)を直したら親2ページの`real_battle_simulator.html?v=`bumpが必須**(でないと旧エンジンのまま届かない)。

---

## 3. 運用メモ(この回の回し方=有効だったので踏襲)

- **設計/検証/報告=Fable(私)、実装=Sonnetサブエージェント**([[fable-token-economy]])。1件〜数件ずつSonnetに投げ、戻ってきたら**私が差分を全文目視レビュー**(巻き込み防止)→`release_check`→**対象ファイルのみ`git add`**(`git add -A`禁止)→commit→push→**`?cb=`で実CDN反映をバックグラウンドpoll確認**まで。
- **並列禁止の判断**: 同じファイル(real_battle/online_battle/fx_primitives)を触るタスクは**並列でSonnetに投げない**(同時編集事故)。順番に。今日は「Aチーム(演出タイミング)→Bチーム(データ/ロジック)」と2本を順次。
- **デプロイ定型**: インラインHTML変更は`?v`不要。外部JS(fx_primitives.js/battle_fx_cues.js)やエンジンiframe(real_battle_simulator.html)を変えたら該当`?v`bump必須。Cloudflareがhtmlをキャッシュするので、ユーザーには**⌘+Shift+R**を案内。

---

## 4. 次にやること / 保留

- **フレアドライブ尺(全技デフォルト)の実機評価待ち**: burst1950/popnum2000が「長すぎ」なら数値を下げる微調整。逆に良ければこのまま。
- **演出ツクールで他の技も調整→統合ループ**: 阿部さんが調整→書き出し→私が統合(§2-B手順)。技ごとの位置offset等はdone:trueシートで個別化できる。
- **(未確定)全技のcharge突進を実際にゆっくりにするか**: 今回は「尺=burst/popnumのみ、突進速さは230msのまま」で確定。突進も遅くしたい要望が出たら別途。
- 前回からの継続キュー(未着手): 再戦フロー設計(阿部さんと)/ツクール小物v2.2(ko_slowmoプレビュー暗転等)。
- **プレイ中に見つけたバグは随時キューに積む運用**が今日うまく回った。続行。
