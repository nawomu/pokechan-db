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
# ★帳簿は共有(2026-08-13 修正・0812-2窓の実測報告より):
#   帳簿を各セッションのscratchpadに置くと、他の窓からは実態の1/5にしか見えず、
#   --warn 80 が「一度も鳴らないまま窓が死ぬ」= 無言が安全に見えて実は危険、という最悪の計器になる。
#   → 帳簿は **reference/_window_ledger.json ただ1本**。--ledger 未指定なら自動でここを読む。
#   (「足りないから、もう一つ作る」=分裂の型。データは一つ・CLAUDE.md の絶対ルールと同じ)
#
# 使い方:
#   bash tools/_usage_monitor.sh                     # 1回だけ表示(共有帳簿を自動で読む)
#   bash tools/_usage_monitor.sh --watch             # 5分ごとに表示し続ける(Monitorツールから使う)
#   bash tools/_usage_monitor.sh --ledger 4283336    # 帳簿の値を手で上書きしたい時だけ
#   bash tools/_usage_monitor.sh --watch --warn 80   # 80%を超えた時だけ行を出す(通知向け)
#
# 出力(JSON1行): {pct, level, ledger_tokens, ccusage_tokens, budget, minutes_left, block_end_jst, advice}
#   level: ok(〜60%) / warn(60〜80%) / stop(80%〜) — stop は「次のバッチを起動しない」の合図
set -o pipefail

WATCH=0; INTERVAL=300; LEDGER=""; WARN_ONLY=""
SHARED_LEDGER="$(cd "$(dirname "$0")/.." && pwd)/reference/_window_ledger.json"
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
  UM_LEDGER="$LEDGER" UM_WARN="$WARN_ONLY" UM_SHARED="$SHARED_LEDGER" python3 <<'PY'
import json, os, datetime
# 共有帳簿(reference/_window_ledger.json)を読む。--ledger が明示されていればそちらが優先。
shared, ledger_src, BUDGET, CAP = {}, "共有帳簿なし(0扱い)", 7_000_000, 9_000_000
try:
    with open(os.environ['UM_SHARED'], encoding='utf-8') as f:
        shared = json.load(f)
    BUDGET = int(shared.get('budget_tokens') or BUDGET)
    CAP    = int(shared.get('cap_tokens')    or CAP)
except Exception:
    pass
# ★確定分と推測分を分ける(推測を確定に混ぜない)。confirmed=完了通知の実測、running=走行中の見積り。
estimate, running_n = 0, 0
arg = os.environ.get('UM_LEDGER') or ''
if arg:
    ledger, ledger_src = int(arg), "--ledger 引数(手動上書き)"
elif shared:
    ledger_src = "reference/_window_ledger.json(共有)"
    conf = shared.get('confirmed')
    if conf is None:                              # 旧形式(spent_subagent_tokensだけ)にも一応対応
        ledger = int(shared.get('spent_subagent_tokens') or 0)
    else:
        ledger = sum(int(e.get('tokens') or 0) for e in conf)
    running = shared.get('running') or []
    running_n = len(running)
    estimate = sum(int(e.get('estimate') or 0) for e in running)
else:
    ledger = 0
warn = os.environ.get('UM_WARN') or ''
try:
    d = json.loads(os.environ['QG_JSON'])
    blocks = [x for x in d.get('blocks', []) if x.get('isActive')]
    if not blocks:
        out = {"pct": 0, "level": "ok", "ledger_tokens": ledger, "ledger_src": ledger_src,
               "ccusage_tokens": 0, "budget": BUDGET, "minutes_left": 300, "block_end_jst": "-",
               "advice": "新しい窓(まだ何も使っていない)。重いバッチを回すならいま"}
    else:
        b = blocks[0]; tc = b['tokenCounts']
        cc = tc['inputTokens'] + tc['outputTokens'] + tc['cacheCreationInputTokens']
        # 帳簿(subagent)とccusage(メインループ)は別勘定なので足す
        # confirmed_pct = 実測だけの下限値 / estimated_pct = 走行中の見積りも含む上限寄りの値
        confirmed_pct = round((ledger + cc) / CAP * 100)
        estimated_pct = round((ledger + cc + estimate) / CAP * 100)
        pct = estimated_pct                      # ★判定は必ず推測込み(安全側)で行う
        end = datetime.datetime.fromisoformat(b['endTime'].replace('Z', '+00:00'))
        now = datetime.datetime.now(datetime.timezone.utc)
        mins = max(0, int((end - now).total_seconds() // 60))
        jst = end.astimezone(datetime.timezone(datetime.timedelta(hours=9))).strftime('%H:%M')
        # ★閾値は帳簿の budget_tokens から自動算出(2026-08-13 阿部さん指示で予算60%=5.4Mに変更)。
        #   ツール側に数字を焼き込まない = 予算を変えたら帳簿1本を直すだけで両窓に効く。
        stop_pct = round(BUDGET / CAP * 100)
        warn_pct = round(stop_pct * 0.75)
        if pct >= stop_pct: level, advice = "stop", f"予算({BUDGET//1000}k={stop_pct}%)到達。次のバッチを起動しない。{jst}の窓明けまで待つ"
        elif pct >= warn_pct: level, advice = "warn", f"予算{stop_pct}%まで残りわずか。小さめのバッチに切り替える"
        else:               level, advice = "ok", f"まだ余裕(予算は{stop_pct}%まで)。通常サイズのバッチでよい"
        if estimate:
            advice = f"★走行中{running_n}件の推測込みで{estimated_pct}%(実測確定分は{confirmed_pct}%)。完了通知が来たら帳簿のrunningをconfirmedへ移すこと。" + advice
        # 共有帳簿が古い窓のまま残っていると過大にも過小にも振れる → 窓の終わり時刻で鮮度を検査
        stale = bool(shared) and shared.get('block_end_jst') not in ('', None, jst)
        if stale:
            advice = f"★共有帳簿が古い窓のまま(帳簿:{shared.get('block_end_jst')} / 実際:{jst})。reference/_window_ledger.json を新しい窓にresetすること。" + advice
        out = {"pct": pct, "confirmed_pct": confirmed_pct, "estimated_pct": estimated_pct,
               "has_estimate": bool(estimate), "running_jobs": running_n,
               "level": level, "ledger_confirmed_tokens": ledger, "ledger_estimate_tokens": estimate,
               "ledger_src": ledger_src, "ledger_stale": stale, "ccusage_tokens": cc,
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
