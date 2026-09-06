#!/bin/bash
# 阿部さん用: Claude(claude-design)と Astra(astra)の agmsg 会話を人間が読める形で流す。
#   使い方: bash tools/_agmsg_view.sh            (5秒ごとに更新・ctrl+c で終了)
#          bash tools/_agmsg_view.sh once        (1回だけ表示)
# 時刻は JST。古い→新しい順。本文の改行はそのまま。
S="$HOME/.agents/skills/agmsg/scripts"
source "$S/lib/storage.sh"
DB="$(agmsg_db_path)"
TEAM="${TEAM:-pchamdb}"
show() {
  agmsg_sqlite "$DB" "
    SELECT '━━━ ' || datetime(created_at, 'localtime') || '  ' || from_agent || ' → ' || to_agent || char(10) || body || char(10)
    FROM messages
    WHERE team='$TEAM' AND (from_agent IN ('astra','claude-design') OR to_agent IN ('astra','claude-design'))
    ORDER BY created_at ASC;"
}
if [ "${1:-}" = "once" ]; then show; exit 0; fi
while true; do clear; echo "agmsg 会話ビュー(team=$TEAM・5秒ごと更新・ctrl+c で終了)"; echo; show; sleep 5; done
