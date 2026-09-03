#!/bin/bash
# tools/_run_codex_dex_all.sh — Wiki取得の完了を待ってから Spark 4並列で図鑑諸元の全数照合を回す(2026-09-03)。再実行=既存スキップ
cd "$(dirname "$0")/.." || exit 1
while pgrep -f _fetch_wiki_pokemon_text.js >/dev/null; do sleep 30; done
node tools/_gen_codex_dex_tasks.js
mkdir -p reference/_dex_audit_codex
for s in 0 1 2 3; do
  CODEX_MODEL=gpt-5.3-codex-spark bash tools/codex_task_runner.sh "$PWD/reference/_genus_material/codex_tasks_dex_all.json" $s 4 > reference/_dex_audit_codex/_run_$s.log 2>&1 &
done
wait
node tools/_collect_codex_dex.js > reference/_dex_audit_codex/_collect.log 2>&1
osascript -e 'display notification "図鑑諸元の全数照合(Spark)が終わりました" with title "PchamDB Codex"' 2>/dev/null
