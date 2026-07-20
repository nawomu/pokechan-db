# PchamDB オリジナルBGM「PB」シリーズ(2026-07-20 Claude作曲)

宣伝動画/サイト用BGM。**全曲オリジナル**(本家ポケモン曲のメロディ流用なし=権利クリーン)。Ableton Live で AbletonMCP 経由で打ち込み。

## 曲一覧(セッションビュー・シーン1〜10)
| # | 曲名 | 雰囲気 | キー/スケール | BPM |
|---|---|---|---|---|
| 1 | PB Battle | 王道疾走バトル | Aマイナー | 165 |
| 2 | PB Gym Boss | ボス戦・重い | Em マイナー | 165 |
| 3 | PB Victory | 勝利ファンファーレ | C メジャー | 165 |
| 4 | PB Lab | 実験室・跳ね | D ドリアン | 165 |
| 5 | PB Online Lobby | 待機・控えめ | F リディアン | 165 |
| 6 | PB Final Showdown | 最終決戦・16分連打 | Bm マイナー | 165 |
| 7 | PB Retro Chip | チップチューン高速 | A マイナー | 165 |
| 8 | PB Rain Battle | 雨・流れる | Dm マイナー | 165 |
| 9 | PB Champion | チャンピオン・堂々 | G メジャー | 165 |
| 10 | PB Sunny Day | 晴れ・元気 | A メジャー | 165 |

## 構成
- 各曲16小節ループ(1周約23秒@165)。4トラック: Drums(909)/Bass(Drift)/Chords(Drift)/Lead(Operator)。
- 音色はLive標準デバイスの初期値=**阿部さんが好みのプリセットに差し替え推奨**(MIDIはそのまま生きる)。

## 再現・追加生成
- 作曲エンジン=`tools/_compose_pb_songs.js`(AbletonMCPソケット:9877へ直接コマンド)。SONGS配列に{prog/scale/tonic/drums/bass/ch/lead/seed}を足せば曲追加。ドラム型5種・ベース型4種・リード型3種・コード型3種の組み合わせ生成。
- 実行: `node tools/_compose_pb_songs.js`(Ableton起動+AbletonMCP有効時)。既存シーンのclipは上書き。

## 次工程
- 気に入った曲をExport Audio(WAV)→ 動画4本(scratchpad/video_out/final)にffmpegでBGM合成(ループ+末尾フェード)。
- サイト内BGMへの流用も可(将来)。
