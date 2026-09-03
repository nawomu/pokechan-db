#!/bin/bash
# tools/_watch_official_news_daily.sh — launchd から毎日呼ぶ(2026-09-03 阿部さん「定期チェックを回して」)
# やること: 公式フィード監視 → 変化(🆕/✏️/👀/M-C一覧)があれば macOS 通知 + ログ。masterは書き換えない(反映は人が手順書どおりに)。
# ログ: ~/Library/Logs/pchamdb_official_news_watch.log  / 直近結果: reference/_official_news_watch_last.txt(git管理外)
# 手動実行: bash tools/_watch_official_news_daily.sh
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
LOG="$HOME/Library/Logs/pchamdb_official_news_watch.log"; LAST="$ROOT/reference/_official_news_watch_last.txt"
OUT=$(node tools/_watch_official_news.js 2>&1); RC=$?
{ echo "===== $(date '+%Y-%m-%d %H:%M:%S') rc=$RC"; echo "$OUT"; } >> "$LOG"
echo "$OUT" > "$LAST"
if [ $RC -ne 0 ]; then
  osascript -e "display notification \"監視スクリプトがエラー(rc=$RC)。ログ: pchamdb_official_news_watch.log\" with title \"PchamDB 公式監視\"" 2>/dev/null
  exit $RC
fi
HITS=$(echo "$OUT" | grep -E '🆕|✏️|👀|一覧|差分|不一致' | head -5)
if [ -n "$HITS" ]; then
  MSG=$(echo "$HITS" | head -2 | tr '\n' ' ' | cut -c1-180)
  osascript -e "display notification \"$MSG\" with title \"PchamDB 公式に動きあり\" sound name \"Glass\"" 2>/dev/null
fi
exit 0
