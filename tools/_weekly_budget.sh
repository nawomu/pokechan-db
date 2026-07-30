#!/bin/bash
# _weekly_budget.sh — ★週間枠の90%ラインで止まるための計器(2026-07-30 阿部さん指示)
#
# 背景: Claudeの「週間%」はアプリ表示しか正がなく、機械では読めない(_quota_guard.sh に既述)。
#   → そこで **実測の校正点** を1つ置き、出力トークン数で比例換算する。
#   校正点: 2026-07-30 17:00頃、アプリ表示「すべてのモデル 77% 使用済み」
#           その時点の 7/25以降のClaude出力合計 = 4,021,667 tok(GLMは除外)
#   ★注意: この校正はOpus主体の履歴で取ったもの。Sonnetで回すと実消費%は軽くなるため、
#           この尺は「早めに止まる」方向に外れる=安全側。
#   ★週リセットは金曜22:00。リセットを跨いだら校正は無効になるので取り直すこと。
#
# 使い方: bash tools/_weekly_budget.sh  → JSON1行
#   {"go":true,"pct_est":81.3,"used_out":4245000,"limit_out":4700649,"remain_out":455649}
# go=false になったら**新しい仕事を始めない**(走っているものは終わらせる)。
set -o pipefail
export WB_CAL_OUT="${WB_CAL_OUT:-4021667}"   # 校正点の出力tok
export WB_CAL_PCT="${WB_CAL_PCT:-77}"        # その時のアプリ表示%
export WB_STOP_PCT="${WB_STOP_PCT:-90}"      # ここで止める
export WB_SINCE="${WB_SINCE:-2026-07-25}"    # 週リセット後の起点(日次粒度のため堅めに翌日から)
export WB_JSON="$(npx -y ccusage@latest daily --json 2>/dev/null)"
python3 <<'EOF'
import json,os
cal=int(os.environ['WB_CAL_OUT']); calp=float(os.environ['WB_CAL_PCT'])
stop=float(os.environ['WB_STOP_PCT']); since=os.environ['WB_SINCE']
try:
    d=json.loads(os.environ['WB_JSON'])
    out=0
    for r in d['daily']:
        if r['period']<since: continue
        for m in r.get('modelBreakdowns',[]):
            if m['modelName'].startswith('claude'):
                out+=m['outputTokens']
    limit=int(cal*stop/calp)
    pct=round(out*calp/cal,1)
    print(json.dumps({"go": out<limit, "pct_est": pct, "used_out": out,
                      "limit_out": limit, "remain_out": limit-out}))
except Exception as e:
    # ★測れない時は「進むな」に倒す(暴走より停止を選ぶ)
    print(json.dumps({"go": False, "reason": f"budget error: {e}"}))
EOF
