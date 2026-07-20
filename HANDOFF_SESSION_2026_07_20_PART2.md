# HANDOFF 2026-07-20 PART2(宣伝・音・オンライン招待スプリント・全部本番ライブ)

前: `HANDOFF_SESSION_2026_07_20.md`(昼=対戦ツール3種+知識記事+案A絵差替+fx全カバー)。本書=同日夕〜夜(宣伝動画/BGM/オンライン招待)。体制=Fable(設計/検証/コミット)+Sonnet+GLM+AbletonMCP/ffmpeg。

## 1. やったこと(コミット順・全push済み)

1. **オンライン対戦の招待共有**(e232b320・タスク#18): online_battle.htmlに「📨ともだちをさそう」=あいことば入り招待URL(`?invite=`)生成→スマホ=Web Share APIネイティブシート(LINE/メール/メッセージ)/PC=コピー・LINE・メールの3ボタン。受け側は自動入力+入室誘導。i18n 8キー9言語。
2. **バトル動画パイプライン**(タスク#10・503aeace): Playwright録画(★横1280x720必須=縦だと「よこむきにしてね」ガード画面を撮る事故)→ffmpeg-static(scratchpad/node_modules・Homebrew無し環境)。録画ドライバ`tools/_record_battle_video.js`(REC_SPRITE/DATA/SEC/PICKS env・復活自動クリックで全編アクション継続)。**動画4パターン**(P1自作絵/P2全部版伝説入り/P3公式3D/P4ドット絵)×(縦1080x1920ぼかし背景+タイトル焼き込み/横16:9/X用8秒GIF)。投稿文面=`宣伝_動画投稿文面案_2026-07-20.md`(X5種/TikTok4種・権利注意=自作絵P1/P2先行・公式3D P3は様子見)。
3. **オリジナルBGM(チップチューン)**: 
   - 動画用: `render_bgm.py`→PB Battle 24秒ループ→**動画4本にBGM合成**(ループ+末尾フェード・全自動)。
   - サイト用(269344f1・タスク#19): 5曲`assets/bgm/pb_{battle,lobby,select,champion,final}.mp3`(各300KB・オリジナル権利フリー)。real_battle/online_battle/battle_labに**BGMプレーヤー**=既定OFF・🎵トグル(バトル画面+ロビー両方)・localStorage記憶・自動再生ポリシー対応・既存SE音量スライダー連動(BGM=0.35)。画面別選曲(バトル/ロビー/選択)。生成器=`tools/_render_bgm_multi.py`(依存ゼロPython)。
   - ★**Ableton不要と確定**([[chiptune-bgm-pipeline]]): 「ファミコン音で満足」(阿部さん)。BGM/SEはPython生成で完結=Claudeだけで作れる(AbletonはMCPでExportダイアログを叩けない)。Ableton内のPB曲10個は将来の高音質版用に残置(通常開かない)。

## 2. ★OBS録画の道が開通(次の動画品質の鍵)
サイトにBGM+既存SEが入ったので、**阿部さんがOBSでバトル画面を録画すれば音込みで録れる**(🎵ON+🔊ONで)。Playwright録画は無音なので、本格宣伝動画はOBSルートが本命。半自動(OBS操作は阿部さん・obs-websocket連動は将来設計可)。

## 3. 検証(最終)
BGM: 3ページ既定OFF・mp3配信200・ロビーON→pb_lobby再生・JSエラー0。招待: PC3ボタン/share払い出しモック/受け側自動入力/既存フロー不変/en・ko。エンジン無改変=sim系は前回値有効。

## 4. 次やること
1. **AdSense再申請の残り**(最重要): ①コンテンツ静的ページ(pokemon/index等9言語=glm-c2ワークストリーム)の「絵2種並記」からPokeAPI画像を外す ②偽特性ページ残骸除去→i18n監査の削除予約2行削除 ③インデックス消化1-2週間→**申請ボタン(まだ押さない)**。
2. **記事**: 企画15本(`reference/_article_plan_2026-07-20.md`)から追加選定(🙋)・既存2本(guide_battle_flow/guide_speed_control)の耳チェック(🙋)・本文9言語化(後工程)。
3. **動画のOBS化**: 音込み録画→編集(FCP or ffmpeg)。冒頭1.5秒にKOシーン先出しで離脱減。
4. **ツール微調整**(阿部さん確認後): 素早さ表のレギュ別絞り=季タグ追加(SSOT変更・🙋)/ダメ計算機・補完ファインダーの手触りFB反映/ピッカー軽量化の本戦適用。
5. 小物: 無音実装6件(ブーストエナジー等)のログ要否(🙋)・さきどり設計・てんきやフォルム見た目。

## 5. 🙋 阿部さん確認(たまり)
1. **投稿**: 動画4本(BGM入り)は`~/Desktop/PchamDB動画_2026-07-20/`。X投稿画面は開いてある(P1+X-1文面推奨)。公開ボタンは阿部さん。
2. **サイトBGMの手触り**: 実機で🎵ON(バトル/ロビー)。音量バランス(BGM0.35 vs SE)・画面別選曲・ゲームオーバーでBGM停止の是非(Sonnet報告§3点)。
3. **AdSense**: コンテンツページの絵の調整をglm-c2ワークストリームでやるタイミング。
4. 前日以前のたまり=HANDOFF 7/20 §5・7/19 PART2 §5。
