# SNS自動化 セットアップ手順(阿部さん向け・1回だけ)

最終更新: 2026-07-21

バトル動画を OBS録画 → X投稿 / YouTube投稿 まで自動で回すスクリプト3本の、**初回1回だけやる設定手順**。
設定が終われば、あとは Claude が `node tools/_obs_record.js` / `_x_post.js` / `_yt_upload.js` を叩いて自動投稿します。

> 本書はスクショがなくても迷わない粒度で書いています。詰まったら Claude に聞いてください。

---

## ⚠ 最初に絶対ルール(セキュリティ)

- **認証情報(パスワード/APIキー/token)はリポジトリに絶対に置かない。**
- 鍵はすべて **`~/.pchamdb_sns.json`**(= `/Users/masamichi/.pchamdb_sns.json`・**ホーム直下・リポジトリの外**)に置きます。
  - このファイルはリポジトリの外なので Git に載りません。リポジトリの中にコピーやペーストをしないでください。
- 設定ファイルには後述のひな形を使い、保存後は自動でパーミッションが `600`(本人のみ読み書き)になります。

---

## 共通: 設定ファイルのひな形

エディタで `~/.pchamdb_sns.json` を作り、以下を雛形として貼り付けます(各値はこのあとの手順で埋めます)。

```json
{
  "obs": {
    "password": "★OBSのWebSocketパスワード(環境変数 OBS_WS_PASSWORD でも可)"
  },
  "x": {
    "consumer_key":        "★X API Key",
    "consumer_secret":     "★X API Key Secret",
    "access_token":        "★Access Token",
    "access_token_secret": "★Access Token Secret"
  },
  "youtube": {
    "client_id":     "★Google OAuth クライアントID",
    "client_secret": "★Google OAuth クライアントシークレット",
    "refresh_token": "★初回 --auth 実行で自動入力(手入力不要)"
  }
}
```

> 設定ファイルの場所確認と、スクリプトが正しく読めるかのテストは各セクションの最後にあります。

---

## 1. OBS(録画制御)

### やること
OBS に外から命令して「録画 開始/停止/状態取得」を自動化します(obs-websocket v5)。

### 手順
1. **OBS を起動**。
2. メニューバー **ツール → WebSocketサーバ設定** を開く。
3. **「WebSocketサーバを有効にする」** にチェックを入れる。
   - サーバポート: **4455**(既定のまま)。
   - 「認証を有効にする」にチェック → **パスワード** を自分で決めて入力(英数字で十分)。
4. そのパスワードを `~/.pchamdb_sns.json` の `obs.password` に書く。
   - またはシェルの環境変数にしてもOK: `export OBS_WS_PASSWORD='同じパスワード'`
5. OBS側の設定ダイアログは「OK」で閉じて、**OBSは起動したまま**にする(録画時は常時起動が必要)。

### 確認(動作テスト・Claudeがやります)
```bash
node tools/_obs_record.js status          # 接続+状態取得
node tools/_obs_record.js start --dry-run # 送信内容だけ確認(録画しない)
node tools/_obs_record.js start           # 実録画開始
node tools/_obs_record.js stop            # 停止・出力パスを表示
```
「OBS WebSocketに接続できません」と出る → OBSが起動しているか・ポート4455・パスワードを確認。

---

## 2. X(旧Twitter)

### やること
テキスト+動画(mp4/gif等)を自動投稿します(OAuth 1.0a)。**Freeプランで月500投稿程度(確認時点の目安)で、本プロジェクトの自動投稿には十分な枠があります。**

### 手順
1. **https://developer.x.com** にXアカウントでログイン。
2. **Developer Portal** で **Free プラン** を選択(無料)し、**Project & App** を作成。
3. App の **User authentication settings** を開く:
   - **App permissions** を **Read and Write** に変更(投稿に必要)。
   - **Type of App** = **Web App / Automated App or Bot** 等の選択肢があれば、コールバックURLは `http://localhost`(使わないが必須なら適当で可)。
4. **Keys and tokens** タブを開き、以下 **4つ** を生成・コピー:
   - **API Key** → `consumer_key`
   - **API Key Secret** → `consumer_secret`
   - **Access Token and Secret** の **Generate** で作成:
     - **Access Token** → `access_token`
     - **Access Token Secret** → `access_token_secret`
   - ※ Access Token は「Read and Write」権限付きで発行し直すこと(権限不足だと投稿が401/403になります)。
5. 4つの値を `~/.pchamdb_sns.json` の `x` ブロックに貼る。

### 確認
```bash
node tools/_x_post.js --text "テスト投稿(自動化テスト)" --dry-run  # 文字数と送信内容だけ
node tools/_x_post.js --text "テスト投稿"                          # 実投稿(表示されたURLで確認)
```

> 注意: メディアは mp4/mov/gif/png/jpg/jpeg/webp に対応。動画はサイズ512MB・時間上限あり(通常のツイート動画の制限に準拠)。長尺は Shorts 向きではありません。

---

## 3. YouTube(動画アップロード)

### やること
動画を YouTube に **resumable upload**(分割アップロード)します。サムネイルも自動設定可能。

> **重要(仕様)**: このアプリは「未審査(unverified)」扱いのため、APIで `public` を指定しても **YouTubeが強制的に `private` にします**。
> だから運用は **「Claudeが private(非公開)でアップ → 阿部さんが YouTube Studio で公開」** にします。これは制限でなく仕様なので放心せず。

### 手順(前半: Google Cloud 側)
1. **https://console.cloud.google.com** にGoogleアカウントでログイン。プロジェクトを作成(例: `pchamdb-sns`)。
2. **APIとサービス → ライブラリ** で **「YouTube Data API v3」** を検索し **有効にする**。
3. **APIとサービス → OAuth同意画面**:
   - User Type = **外部** → 作成。
   - アプリ名等を適当に入れ、**テストユーザーに自分のGoogleアカウント(=YouTube所有アカウント)のメールアドレスを追加**。これをしないと後でブロックされます。
4. **APIとサービス → 認証情報 → 認証情報を作成 → OAuth クライアント ID**:
   - アプリケーションの種類 = **デスクトップアプリ**。
   - 作成後、**クライアントID** と **クライアントシークレット** をコピー。
5. 2つを `~/.pchamdb_sns.json` の `youtube.client_id` / `youtube.client_secret` に貼る。

### 手順(後半: refresh token 取得・初回1回)
`refresh_token` は **手入力せず**、スクリプトの `--auth` モードで取得します。

```bash
node tools/_yt_upload.js --auth
```

すると:
1. ブラウザが自動で開き、Google の認可画面が出る。
2. 自分のYouTubeアカウントでログイン → 「許可」(テストアプリの警告が出たら「詳細→安全ではないが続行」で進む・テストユーザー追加済みなので出るはず)。
3. 「OK ブラウザは閉じて構いません」と出たら完了。`refresh_token` が `~/.pchamdb_sns.json` に自動保存(パーミッション600)。

> 「refresh_tokenが返りません」と出たら、Googleアカウントのセキュリティ → 第三者のアプリ アクセス で一度許可を取り消し、再度 `--auth` を実行してください(consent必須のため)。

### 確認
```bash
node tools/_yt_upload.js --file 動画.mp4 --title "テスト" --dry-run        # 内容とサイズだけ
node tools/_yt_upload.js --file 動画.mp4 --title "テスト" --privacy private # 実アップロード(非公開)
```
完了メッセージの `https://www.youtube.com/watch?v=...` を開き、Studioで内容確認→公開。

### カスタムサムネイルを使うには
YouTube のカスタムサムネイルは **電話番号認証済みのチャンネル** でのみ設定可能です(未認証だと `_yt_upload.js --thumb` が警告を出してスキップ=アップロード本体は成功)。
- 認証済みなら `--thumb サム.png`(png/jpg・2MB以内)で自動設定されます。
- 未認証でもアップロードはできるので、後で Studio から手動で入れてください。

---

## 4. 日常の運用フロー(設定後)

1. **OBS を起動したまま**にする。
2. Claude が録画→編集(ffmpeg/FCP)→投稿まで回す:
   - 録画: `node tools/_obs_record.js start` / `stop`
   - X投稿: `node tools/_x_post.js --text "..." --media out.mp4`
   - YT投稿: `node tools/_yt_upload.js --file out.mp4 --title "..." --privacy private`
3. **公開ボタンだけ阿部さん**:
   - YouTube は Claude が `private` で上げるので、Studio で確認→**公開ボタンは阿部さん**。
   - X は即公開されます(下書き機能はFree枠の API にないため)。X投稿前に内容(テキスト)だけ阿部さんの目を通す運用を推奨。

---

## トラブルシュート

| 現象 | 原因 / 対処 |
|---|---|
| OBS: 接続できない | OBS起動忘れ / ポート4455以外 / パスワード不一致。WebSocketサーバ設定を再確認 |
| OBS: 認証を要求される | パスワード未設定。`obs.password` or 環境変数 `OBS_WS_PASSWORD` を入れる |
| X: 401 Unauthorized | 4キーの誤入力、または Access Token が Read&Write 権限で発行されていない(再生成) |
| X: メディア処理 failed | 動画の形式/サイズ上限超え。再エンコを検討 |
| YT: access_type / refresh_token 無し | consent未付与 or テストユーザー未追加。許可を取り消し `--auth` 再実行 |
| YT: 強制 private になる | 未審査アプリの仕様(正常)。Studio から手動公開 |
| YT: 「access blocked / 403 access_denied」 | OAuth同意画面のテストユーザーに自分を追加していない |

---

## 依存について(開発者向けメモ)
- 3スクリプトとも **npm パッケージ依存ゼロ**。Node 24 標準(`fetch` / `WebSocket` / `crypto` / `http`)のみで動きます。
- OAuth 1.0a 署名(HMAC-SHA1・RFC3986 percent-encode)・OBS認証(sha256二段base64)・multipart form/resumable upload はすべて自前実装済み。
