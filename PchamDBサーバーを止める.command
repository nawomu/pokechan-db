#!/bin/bash
# ダブルクリックで: ローカルサーバーを止める
echo ""
echo "  ローカルサーバー(ポート8000)を止めます…"
PIDS=$(pgrep -f "http.server 8000")
if [ -z "$PIDS" ]; then
  echo "  動いていませんでした。"
else
  kill $PIDS 2>/dev/null && echo "  止めました。"
fi
echo ""
