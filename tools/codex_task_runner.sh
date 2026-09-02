#!/bin/bash
# tools/codex_task_runner.sh — 汎用Codexタスクランナー(1タスク=1 codex exec・出力JSONのslug照合・既存はスキップ=再開可)
# 使い方: bash tools/codex_task_runner.sh <tasks.json> [shard] [nshard]   (CODEX_MODEL で model 指定可)
# tasks.json = {"out": "<出力dir(repo相対)>", "tasks": [{"slug": str, "prompt": str}]}
set -u
export PATH="$HOME/.npm-global/bin:$PATH"
TASKS="$1"; SHARD="${2:-0}"; NSHARD="${3:-1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTREL=$(node -e "console.log(require('$TASKS').out)"); OUT="$ROOT/$OUTREL"; mkdir -p "$OUT"
MODEL_ARG=""; [ -n "${CODEX_MODEL:-}" ] && MODEL_ARG="-m ${CODEX_MODEL}"
N=$(node -e "console.log(require('$TASKS').tasks.length)")
TAG="$(basename "$TASKS" .json)_$SHARD"; TMP="$OUT/.tmp_${TAG}.json"; ERR="$OUT/.tmp_${TAG}.err"
ok=0; fail=0
for ((i=0; i<N; i++)); do
  [ $((i % NSHARD)) -ne "$SHARD" ] && continue
  slug=$(node -e "console.log(require('$TASKS').tasks[$i].slug)")
  [ -s "$OUT/$slug.json" ] && continue
  node -e "process.stdout.write(require('$TASKS').tasks[$i].prompt)" > "$TMP.prompt"
  codex exec $MODEL_ARG -C "$ROOT" --sandbox read-only --output-last-message "$TMP" "$(cat "$TMP.prompt")" </dev/null >/dev/null 2>"$ERR" \
    || { echo "FAIL(exec) $slug: $(tail -1 "$ERR")"; fail=$((fail+1)); grep -qiE "usage limit|rate limit|429" "$ERR" && { echo "STOP(枠)"; break; }; continue; }
  node -e '
const fs=require("fs");const [tmp,out,slug]=process.argv.slice(1);
const s=fs.readFileSync(tmp,"utf8");const j=JSON.parse(s.slice(s.indexOf("{"),s.lastIndexOf("}")+1));
if(j.slug!==slug){console.log("REJECT(slug不一致="+j.slug+")",slug);process.exit(3);}
j.source="codex"; fs.writeFileSync(out+"/"+slug+".json",JSON.stringify(j,null,1));console.log("OK",slug);
' "$TMP" "$OUT" "$slug" && ok=$((ok+1)) || fail=$((fail+1))
done
echo "done shard=$SHARD ok=$ok fail=$fail out=$OUT"
