# PchamDB オンライン対戦 リレーサーバー(PartyKit / Cloudflare)

P1(合言葉ルーム・ホスト権限リレー方式)のリアルタイム中継サーバー。
設計: `../../設計_オンライン対戦_2026-07-07.md`

## これは何をするか
- 部屋(合言葉)ごとに2人を繋ぎ、メッセージを相手へ転送するだけの「中継役」。
- ゲームの計算(乱数・ダメージ)は**ホスト側ブラウザのエンジンだけ**が持つ(=ホスト権限方式)。サーバーは中身を見ない。

## メッセージ(クライアント⇔サーバー)
サーバー発:
- `{type:'welcome', role:'host'|'guest', room, peerPresent}` … 接続直後、自分の役割
- `{type:'peer_joined', role}` … 相手が入室(対戦開始の合図)
- `{type:'peer_left', role}` … 相手が切断
- `{type:'room_full'}` … 満室(3人目)
- `{type:'error', reason}` … 不正メッセージ

クライアント同士(サーバーは素通し転送):
- `team` / `action` / `turnResult` / `faintReplace` / `ping` / `pong` / `resign` …
- 中身のプロトコルは設計メモ §3。

## ローカル開発
```bash
cd online/partykit
npx partykit dev          # http://127.0.0.1:1999 でローカル起動
```
クライアントは `wss://<host>/parties/main/<合言葉>` に接続(ローカルは ws://127.0.0.1:1999)。

## デプロイ(★阿部さんのCloudflareログインが必要)
```bash
cd online/partykit
npx partykit login        # 初回のみ・Cloudflare(GitHub)認証 → ブラウザが開く
npx partykit deploy       # Cloudflare Workers + Durable Objects に公開
```
デプロイ後のURL(例: `pcham-battle.<account>.partykit.dev`)を real_battle.html の接続先に設定する。

## コスト
- Durable Objects の Hibernation でアイドル部屋は課金されない=ターン制と好相性。身内〜小規模は実質$0(設計メモ §16)。
