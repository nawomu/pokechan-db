# D0: オンライン対戦「鏡写し」E2Eテストの作り直し(2026-09-07)

`review/_b064_staged_plan_2026-09-06.md` §3「同期」行が参照する `scratchpad/e2e_online.js` は
git履歴(`git log --all -- scratchpad/e2e_online.js`)・現worktreeのどこにも存在しない
(検収注記どおり=セッション一時ファイルの消失)。`次回ここから.md:728` に旧テストの実績
(「16ターン全ログ一致・HP鏡写し・死に出し往復・勝敗整合・JSエラー0」)の記述だけが残っている。

本作業は、その2ブラウザ鏡写しテストを **`tools/_online_mirror_test.js`** として作り直したもの。
`online_battle.html` / `real_battle_simulator.html` / 他のtools / master / 生成物は一切変更していない。

## 1. トランスポートの事実(調査結果・行番号つき)

- 通信 = **Supabase Realtime**(broadcast + presence)。ライブラリはCDN(jsdelivr)から遅延ロード
  (`online_battle.html:4895` `_loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')`)。
  接続先は `online/supabase-config.js` の `window.PCHAM_SUPABASE.url`
  (`https://yznayflwjbxcstfkzqnv.supabase.co`)。
- 部屋 = `'pcham_room:' + 合言葉` というRealtimeチャンネル名(`online/rb_online.js:75`)。
  presenceに先着した側(`online_at`が最小)が **ホスト**(エンジンを回す権威)、後着が **ゲスト**
  (`online/rb_online.js:104-135` `assignRolesFromPresence`)。
- UIの[せつぞく]ボタン(`onlineConnect`)はロビー/あいことば入力を経由するが、下請けの
  `onlineConnectRoom(room, name)`(`online_battle.html:4919-4926`)を直接呼べば同じ経路で
  ロビーUIなしに接続できる。今回のテストはこれを使う。
- 共有乱数は**ロックステップ**方式: ホストが毎ターンseedを発行し
  `RBOnline.sendTurnGo(action, seed, turn)` / `sendStart(seed)` / `sendFaintReplace(idx, seed)`
  で配る(`online_battle.html:5353-5377`)。受け手は `onlineSeedEngine(seed)` で
  `engineWin().Math.random = m32(seed)` に差し替えてから同じ行動を適用する
  (`online_battle.html:4826-4828`)。
- バトル本体は非表示iframe `#engine-frame`(`real_battle_simulator.html`)の `window.__sim` を
  トップレベル変数 `S` へ橋渡し(`online_battle.html:1271, 1404-1420`)。
  `S.battleLog`(配列そのもの)・`S.sides.self` / `S.sides.opp`(`currentHp`等)・
  `S.realStat(side,'hp')` から状態が読める。
- `online_battle.html` は素の`<script>`タグにトップレベルの `const`/`let`/`function` を
  大量に持つ(`S`, `RB_ONLINE`, `PICK`, `turnNo`, `m32`, `selfIds`, `setSlot`,
  `onlineConnectRoom`, `onlineSubmitAction`, `confirmPick` 等)。`function`宣言は自動で
  `window`に乗るが `const`/`let` は乗らない(`RB_ONLINE`はコード中のコメント通り例外的に
  `window.RB_ONLINE = RB_ONLINE`と明示代入されている・`online_battle.html:4824-4825`)。
  Playwrightの`page.evaluate`/`waitForFunction`はdevtoolsコンソールと同じグローバル字句
  スコープで評価されるため、`window`に乗っていない`const`/`let`も直接参照できることを
  実測で確認した(下記§3のスモーク結果)。これを使い、検索モーダル等のUIクリックを経由せず
  ページの本物の関数を直接呼んで駆動する設計にした(モックではなく実コード経路)。

## 2. テストの作り(`tools/_online_mirror_test.js`)

使い方: `node tools/_online_mirror_test.js [--turns=N] [--port=8010] [--headed]`
(既定 `turns=3` `port=8010`。8000番は別作業が使用中のため使わない=指示どおり自前で8010を使用)

1. **到達性チェック(Node側・ブラウザを開く前)**: `online/supabase-config.js` のURLに対して
   DNS解決→HTTPS到達を試す。失敗したら **`SKIP: 外部シグナリング到達不能`** を出して
   非0(exit=2)で終了する。実行せずに成功と報告することはしない。
2. 到達できる場合のみ: `python3 -m http.server 8010` を自前で起動し、2つのブラウザ
   コンテキスト(host/guest)を開き、それぞれ
   - エンジン準備待ち(`S.pokeByName('テスト(みず)')`到達を確認)
   - `m32` を実行時ラップしてRNG消費回数を計測(ディスク上のファイルは無改変。
     Playwrightからのモンキーパッチのみ)
   - 固定チーム3体を`setSlot()`で直接セット: **テストダミー**
     (`real_battle_simulator.html:9308-9311`。HP924・全技使用可・特性なし=決定的で、
     数ターンでは絶対に瀕死にならない検証専用ポケモン)
   を行う。
3. 同じ部屋コードで両者 `onlineConnectRoom` → チーム交換待ち → `PICK.sel`を直接埋めて
   `confirmPick()`(見せ合い選出もUIクリックを経由しない)→ 開戦待ち。
4. 指定ターン数ぶん、両クライアントで「先頭の技(idx=0)」を`onlineSubmitAction(0)`で
   直接選択(決定的な行動)。ターンごとに
   - バトルログ(`───`区切り行を除いた全文)の一致
   - 両者のHP(実数値/最大値)の一致(**視点が鏡写し**なので `host.self ⇔ guest.opp`、
     `host.opp ⇔ guest.self` の組で突き合わせる)
   - RNG消費回数(ターンごとにリセットして比較。共有シードで同じ消費回数になるはず。
     旧テストが検出していた「側依存の乱数消費が分岐する」バグ種別と同じ検査軸)
   - JSランタイムエラー/HTTPエラー(`tools/_lib/browser_audit.js`の`observePage`を再利用)
   を突き合わせ、1件でも不一致があれば診断を出して最終的に非0で終了する。

## 3. 実行結果

### 3-1. 本番の到達性チェック(実行コマンドそのまま)

```
$ node tools/_online_mirror_test.js --turns=3 --port=8010
=== オンライン対戦 鏡写しE2E(tools/_online_mirror_test.js) turns=3 port=8010 headed=false ===
接続先(online/supabase-config.js): https://yznayflwjbxcstfkzqnv.supabase.co

SKIP: 外部シグナリング到達不能
  理由: DNS解決失敗: ENOTFOUND(host=yznayflwjbxcstfkzqnv.supabase.co)
  online_battle.html のオンライン対戦は Supabase Realtime(外部クラウドサービス)前提であり、
  ローカルの修正では解決できない(プロジェクト削除/期限切れの可能性が高い。DNS解決自体が失敗している)。
  実行せずに成功と報告することはしない → 非0で終了する。
EXIT=2
```

**exit code = 2**。2ブラウザの本走行(ロックステップ比較)には到達していない。

DNS解決の失敗は本セッションのサンドボックス固有の制限ではなく、実インターネット上の事実として
二重に確認した:
- `nslookup yznayflwjbxcstfkzqnv.supabase.co` → `NXDOMAIN`
- Googleの公開DoH(`https://dns.google/resolve?name=...`、一般のcdn.jsdelivr.netへは通常どおり
  到達できる環境から実行)でも `Status:3`(=NXDOMAIN)
- 一般の `supabase.co` 自体は正常に解決する(Cloudflareへ)。この特定プロジェクトの
  サブドメインだけがNXDOMAIN → **プロジェクトが削除/期限切れになっている可能性が高い**。

`次回ここから.md:728` によれば、このURL(`online/supabase-config.js`)は
**旧`scratchpad/e2e_online.js`が実際に16ターン成功させた時と同じプロジェクト**。
つまりこれはテスト基盤だけの問題ではなく、**現在の本番`online_battle.html`のオンライン対戦機能
そのものが動いていない**ことを意味する(下記3-2のスモークでも独立に確認)。

### 3-2. 到達性チェックより手前の部分だけの動作確認(スモークテスト・使い捨て・非納品物)

`onlineConnectRoom`を呼ぶ手前まで(ページ読込→エンジン準備待ち→`m32`ラップ→`setSlot`→
`PICK`/関数の到達性)が壊れていないかを、リポジトリ外の一時スクリプトで単独確認した
(このMarkdown作成のための検証用。リポジトリには残していない)。結果:

```
S ready + test dummy visible: OK
m32 wrap RNG count after 3 calls: 3 sample= [ 0.7872516233474016 ]
slotVal after setSlot: {"s1":"テスト(みず)","s2":"テスト(ノーマル)","s3":"テスト(ゴースト)","ids":["s1",...,"s6"]}
PICK object reachable via evaluate: true
function reachability: {"onlineConnectRoom":"function","onlineSubmitAction":"function","confirmPick":"function","RB_ONLINE":"object"}
JS errors observed: 1 [
  "console: WebSocket connection to 'wss://yznayflwjbxcstfkzqnv.supabase.co/realtime/v1/websocket?...' failed: ... net::ERR_NAME_NOT_RESOLVED"
]
```

要点:
- `S`/`setSlot`/`PICK`/`onlineConnectRoom`/`onlineSubmitAction`/`confirmPick` はすべて
  `page.evaluate`から直接呼べる(トップレベル`const`/`let`もdevtoolsコンソールと同じ字句
  スコープで見えるという§1の想定が実測で正しいと確認できた)。
- `m32`の実行時ラップは正しくRNG呼び出し回数を数える。
- **何もしていなくても**(`onlineConnectRoom`を呼ぶ前でも)ページ自身が
  Supabase Realtimeへwebsocket接続を試みて `net::ERR_NAME_NOT_RESOLVED` で失敗している
  ことを観測した。これは`onlineInitUI`(ページロード時に自動実行・ロビー参加を試みる経路)
  が原因とみられる。**本番サイトで実際に「オンライン対戦」を開いたユーザーも同じ失敗に
  遭遇している可能性が高い**ということ。

### 3-3. 到達可能になった場合に何が起きるか(未実施・設計のみ)

Supabaseプロジェクトが復旧すれば、`tools/_online_mirror_test.js`は自動的に到達性チェックを
通過し、そのまま2ブラウザのロックステップ比較(§2の3-4)へ進む設計になっている
(コード分岐は到達性の可否だけで、以降のロジックは変更不要)。今回はその経路を実データで
検証できていない(exit=2で止まったため)。

## 4. 変更したファイル

- 新規: `tools/_online_mirror_test.js`(実行可能なテスト本体)
- 新規: `review/_b064_d0_2026-09-07/mirror/README.md`(本ファイル)
- `online_battle.html` / `real_battle_simulator.html` / 他のtools / master / 生成物は無改変。
- git操作(add/commit/stash/checkout)は一切行っていない。

## 🙋確認してください

1. **これは今回のテスト基盤だけの問題ではなく、本番`online_battle.html`のオンライン対戦
   機能が現在動いていない可能性が高いという実測結果です**(§3-1・§3-2)。
   `online/supabase-config.js`のプロジェクト(`yznayflwjbxcstfkzqnv.supabase.co`)がDNS
   レベルで解決できない=削除/期限切れの可能性。復旧するには
   `オンライン対戦_Supabaseセットアップ手順_2026-07-08.md`の手順で新規プロジェクトを
   作り直すか、既存プロジェクトを復元する必要がある(このセッションのスコープ外・
   `tools/`と`review/`配下しか触れない指示のため対応していない)。事実の指摘のみ行う。
2. `tools/_online_mirror_test.js`は到達性ゲートを通過できず(exit=2)、
   本題の「2ブラウザでログ/HP/RNG消費回数が一致するか」の実比較ロジックは
   **未検証のまま**です。設計・実装はしましたが、実データでの動作確認はSupabase復旧後に
   改めて必要です。
3. D0の親票(`review/_b064_staged_plan_2026-09-06.md`)の「同期」行が求めていたのは
   「実行可能な検査を整備する」ことだったため、到達性チェックで正直にSKIPする設計を
   ゴールとみなしました。この判断でよいか確認してください(=Supabase復旧を待たずに
   D0を完了扱いにしてよいか)。
