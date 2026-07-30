#!/bin/bash
# 旧名のまま残してある互換用。中身は「PchamDB管理ツールを開く.command」と同じ。
cd "$(dirname "$0")" || exit 1
exec bash "./PchamDB管理ツールを開く.command"
