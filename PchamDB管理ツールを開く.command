#!/bin/bash
# ダブルクリックで: ローカルサーバーを立ち上げて、管理ツールのページを開く
# (すでに立ち上がっていれば、開くだけ)
cd "$(dirname "$0")" || exit 1

PORT=8000
URL="http://localhost:$PORT/管理ツール.html"

echo ""
echo "  PchamDB 管理ツール"
echo "  ------------------------------------"

# すでにサーバーが動いているか確認
if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/"; then
  echo "  サーバーは すでに動いています。"
else
  echo "  サーバーを立ち上げます…"
  nohup python3 -m http.server $PORT >/dev/null 2>&1 &
  # 立ち上がるまで最大5秒待つ
  for i in $(seq 1 10); do
    sleep 0.5
    curl -s -o /dev/null --max-time 1 "http://localhost:$PORT/" && break
  done
fi

if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/"; then
  echo "  ページを開きます: $URL"
  open "$URL"
  echo ""
  echo "  ★この黒い窓は閉じて大丈夫です(サーバーは動き続けます)"
  echo "  ★止めたいときは『PchamDBサーバーを止める.command』をダブルクリック"
else
  echo "  ✗ サーバーを立ち上げられませんでした。"
  echo "    python3 が入っているか確認してください(ターミナルで: python3 --version)"
fi
echo ""
