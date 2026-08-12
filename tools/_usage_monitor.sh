#!/usr/bin/env bash
# _usage_monitor.sh — 5時間セッション枠の「見える化」計器(阿部さんの画面を見なくても分かるようにする)
#
# 何をするか: いま動いている5時間ブロックの消費・残り時間・危険度を1行で出す。
#   ★重要な限界(2026-08-02実測): ccusage は **Workflowサブエージェント(Sonnet)の消費を写さない**。
#     → 監査キャンペーンのような並列ファンアウトの残量管理には、各Workflow完了通知の
#        subagent_tokens を足し込んだ「帳簿」が正。本ツールは帳簿を引数で渡すと合算して表示する。
#   ★校正(2026-08-12 阿部さんの使用量画面): subagent帳簿4.28M+メイン消費 = アプリ表示47%(Max 5x)
#     → 1窓の実容量 ≈ 9M(subagent換算)。予算は 80% ≈ 7M/窓。
#
# 使い方:
#   bash tools/_usage_monitor.sh                     # 1回だけ表示(JSON1行)
#   bash tools/_usage_monitor.sh --watch             # 5分ごとに表示し続ける(Monitorツールから使う)
#   bash tools/_usage_monitor.sh --ledger 4283336    # 帳簿(subagent_tokens合計)を足して残量を出す
#   bash tools/_usage_monitor.sh --watch --warn 80   # 80%を超えた時だけ行を出す(通知向け)
#
# 出力(JSON1行): {pct, level, ledger_tokens, ccusage_tokens, budget, minutes_left, block_end_jst, advice}
#   level: ok(〜60%) / warn(60〜80%) / stop(80%〜) — stop は「次のバッチを起動しない」の合図
set -o pipefail

WATCH=0; INTERVAL=300; LEDGER=0; WARN_ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --watch) WATCH=1; shift ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --ledger) LEDGER="$2"; shift 2 ;;
    --warn) WARN_ONLY="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

one_shot() {
  QG_JSON="$(npx -y ccusage@latest blocks --json 2>/dev/null)" \
  UM_LEDGER="$LEDGER" UM_WARN="$WARN_ONLY" python3 <<'PY'
import json, os, datetime
BUDGET = int(os.environ.get('UM_BUDGET', 7_000_000))   # 80%目安(実容量≈9M)
CAP    = int(os.environ.get('UM_CAP',    9_000_000))   # 1窓の実容量(2026-08-12校正)
ledger = int(os.environ.get('UM_LEDGER') or 0)
warn   = os.environ.get('UM_WARN') or ''
try:
    d = json.loads(os.environ['QG_JSON'])
    blocks = [x for x in d.get('blocks', []) if x.get('isActive')]
    if not blocks:
        out = {"pct": 0, "level": "ok", "ledger_tokens": ledger, "ccusage_tokens": 0,
               "budget": BUDGET, "minutes_left": 300, "block_end_jst": "-",
               "advice": "新しい窓(まだ何も使っていない)。重いバッチを回すならいま"}
    else:
        b = blocks[0]; tc = b['tokenCounts']
        cc = tc['inputTokens'] + tc['outputTokens'] + tc['cacheCreationInputTokens']
        # 帳簿(subagent)とccusage(メインループ)は別勘定なので足す
        total = ledger + cc
        pct = round(total / CAP * 100)
        end = datetime.datetime.fromisoformat(b['endTime'].replace('Z', '+00:00'))
        now = datetime.datetime.now(datetime.timezone.utc)
        mins = max(0, int((end - now).total_seconds() // 60))
        jst = end.astimezone(datetime.timezone(datetime.timedelta(hours=9))).strftime('%H:%M')
        if pct >= 80:   level, advice = "stop", f"予算({BUDGET//1000}k)到達。次のバッチを起動しない。{jst}の窓明けまで待つ"
        elif pct >= 60: level, advice = "warn", "残り2〜3割。小さめのバッチ(20件以下)に切り替える"
        else:           level, advice = "ok", "まだ余裕。通常サイズのバッチでよい"
        out = {"pct": pct, "level": level, "ledger_tokens": ledger, "ccusage_tokens": cc,
               "budget": BUDGET, "minutes_left": mins, "block_end_jst": jst, "advice": advice}
    if warn and out["pct"] < int(warn):
        raise SystemExit(0)          # --warn 指定時は閾値未満なら何も出さない(通知を減らす)
    print(json.dumps(out, ensure_ascii=False))
except SystemExit:
    raise
except Exception as e:
    print(json.dumps({"pct": -1, "level": "unknown", "advice": f"計器エラー: {e}"}, ensure_ascii=False))
PY
}

if [ "$WATCH" = "1" ]; then
  while true; do one_shot; sleep "$INTERVAL"; done
else
  one_shot
fi
