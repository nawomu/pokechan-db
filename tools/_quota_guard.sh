#!/bin/bash
# _quota_guard.sh — 5時間ブロックの自己チェック(上限手前で止まるための計器)
# 使い方: bash tools/_quota_guard.sh  → JSON1行 {go, reason, minutes_left, block_end_jst, spent_tokens, cost_usd}
# 仕組み: ccusage(ローカル~/.claudeログ解析・API消費ゼロ)で現在ブロックの消費を読む。
# 閾値: 環境変数で調整可。QG_MAX_COST(既定55) / QG_MAX_TOKENS(既定400万・cache read除く)
#   ※閾値は実測校正前の保守値。上限に当たった時のブロック消費を見て調整する(CALIBログを下に追記)。
# CALIB履歴:
#  2026-07-27 17-22JSTブロックで上限到達 → cost=53.0 / spent=2.03M(このブロックはSonnetサブエージェント主体)
#  2026-07-28 13:30 実測: cost=53・spent=2.9M の時点で **アプリ表示は28%** (Opus主体のブロック)
#  ★結論: cost/tokenは**モデル構成で重みが変わる**ので上限の目安にならない(同じcost53で「上限」と「28%」)。
#    → 閾値は大きめにし、**アプリの「現在のセッション %」が正**。ガードは"暴走検知"用の粗い保険と位置づける。
#    → 既定を cost150 / tokens 8M に引き上げ(2026-07-28)。危なくなったら阿部さんの画面表示で判断する。
# ★週間枠(金曜21:59リセット)は本ガードで測れない。週後半に44%超なら重いファンアウトはGLMへ移すこと。
#  2026-08-12 ★実測校正(阿部さんの使用量画面): subagent帳簿4.28M+メイン消費の時点で「現在のセッション47%」(Max 5x)。
#    → 1窓の実容量 ≈ 9M(subagent_tokens換算)。ワークフロー型キャンペーンの予算は 80% ≈ 7M/窓 が適正。
#    → 旧規則(1窓3.5M)は半分以下で自主停止する過剰保守だった。帳簿方式は変えず、上限だけ7Mに引き上げ。
#  2026-08-02 ★重大な校正発見: ccusageは**Workflowサブエージェント(Sonnet)の消費を写さない**。
#    実測: Sonnet 5.7M焼いて上限到達した直後に、本ガードの読みは57万token(fableのみ)だった。
#    → ワークフロー型キャンペーンの残量管理には本ガードは使えない。
#    → 正= 各Workflow完了通知の <usage>subagent_tokens</usage> を帳簿づけし、1窓4.5M(≒80%)手前で自主停止。
#      帳簿と規則は scratchpad/audit_campaign_state.json 側に持つ。
set -o pipefail
export QG_MAX_COST="${QG_MAX_COST:-150}"
export QG_MAX_TOKENS="${QG_MAX_TOKENS:-8000000}"
export QG_JSON="$(npx -y ccusage@latest blocks --json 2>/dev/null)"
python3 <<'EOF'
import json,os,datetime
max_cost=float(os.environ['QG_MAX_COST']); max_tok=int(os.environ['QG_MAX_TOKENS'])
try:
    d=json.loads(os.environ['QG_JSON'])
    b=[x for x in d.get('blocks',[]) if x.get('isActive')]
    if not b:
        print(json.dumps({"go":True,"reason":"no active block (fresh)","minutes_left":300}))
    else:
        b=b[0]
        tc=b['tokenCounts']
        spent=tc['inputTokens']+tc['outputTokens']+tc['cacheCreationInputTokens']
        cost=b['costUSD']
        end=datetime.datetime.fromisoformat(b['endTime'].replace('Z','+00:00'))
        now=datetime.datetime.now(datetime.timezone.utc)
        mins=max(0,int((end-now).total_seconds()//60))
        jst=end.astimezone(datetime.timezone(datetime.timedelta(hours=9))).strftime('%H:%M')
        go=cost<max_cost and spent<max_tok
        reason="ok" if go else f"threshold exceeded (cost {cost:.0f}/{max_cost} or tokens {spent}/{max_tok})"
        print(json.dumps({"go":go,"reason":reason,"minutes_left":mins,"block_end_jst":jst,
                          "spent_tokens":spent,"cost_usd":round(cost,2)}))
except Exception as e:
    print(json.dumps({"go":True,"reason":f"guard error: {e}","minutes_left":-1}))
EOF
