#!/bin/bash
# tools/codex_move_audit.sh — 技監査R1をCodexで回すランナー(2026-09-02・★未実測=初回は少数で試す)
# 使い方: bash tools/codex_move_audit.sh <材料dir> <batchIndex(3|4|5)> [件数上限]
# 1技 = 照合(codex exec) → 反証(codex exec)。結果: reference/_move_audit_codex_r1/<slug>.json
# 再実行は既存ファイルをスキップ(=枠切れ後もそのまま再開できる)
set -u
export PATH="$HOME/.npm-global/bin:$PATH"   # codex CLI(npm -g)の場所
BASE="$1"; BATCH="$2"; LIMIT="${3:-999}"; SHARD="${4:-0}"; NSHARD="${5:-1}"   # 並列用: 自分の担当= index % NSHARD == SHARD
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/reference/_move_audit_codex_r1"; mkdir -p "$OUT"
LENS="R1=基本諸元と効果の一字一句(タイプ/分類/威力/命中/PP/対象/接触/守る/優先度+効果文の全意味+effectsの構造)"
SLUGS=$(node -e "console.log(require('$ROOT/reference/_move_r1_batches_rest_2026-09-01.json').batches[$BATCH].join(' '))")
n=0; idx=-1
for slug in $SLUGS; do
  idx=$((idx+1)); [ $((idx % NSHARD)) -ne "$SHARD" ] && continue
  [ $n -ge "$LIMIT" ] && break
  [ -s "$OUT/$slug.json" ] && continue
  FILE="$BASE/$slug.json"
  [ -f "$FILE" ] || { echo "SKIP(材料なし) $slug"; continue; }
  P1="あなたは照合担当。技(わざ)1件だけを、時間をかけて一字一句照合する。まとめない。急がない。ファイルは一切書き換えない。
まず $FILE を読む。中身: master_row(検査対象・slug=$slug)/ yakkun_ch_row(Champions正典行。null=Championsに無い)/ wiki_path(null以外なら生ページ全文を読む。切り抜きで判定しない)/ prev_findings.known(既知の指摘=繰り返し不要)。
★このラウンドのレンズ: $LENS
★出典の優先順位: champions=true → 正典=yakkun_ch_row(WikiとCh行の数値差は仕様=mismatchにせずnote)。champions=false → 権威=Wiki(最新世代の値)。ch行は一次資料(循環参照扱いしない)。move_noとhrefの番号差はnoteのみ。
やること: 1)基本諸元を1個ずつ(タイプ/分類/威力/命中/PP/対象/接触/守る/優先度) 2)効果文の意味を一語ずつ(%,段数,対象,条件,例外。うちにだけ在る記述=extra_in_ours) 3)battle_data.effectsに権威の機構が構造として入っているか(欠け=missing_in_ours・noteにsim影響) 4)世代依存はnoteに世代明記。
絶対ルール: 引用の無い判定は書かない(matchにも根拠)。記憶で補完しない(無ければunknown)。だいたい同じでmatchにしない。name/slugはmaster_rowの値をそのまま。
最後のメッセージは次のJSONだけを出力(前後に文章を付けない): {\"name\":str,\"slug\":str,\"checks\":[{\"aspect\":str,\"ours\":str,\"authority_quote\":str,\"verdict\":\"match|mismatch|missing_in_ours|extra_in_ours|unknown\",\"note\":str}],\"summary\":str}"
  codex exec -C "$ROOT" --sandbox read-only --output-last-message "$OUT/.tmp_found_$SHARD.json" "$P1" </dev/null >/dev/null 2>"$OUT/.tmp_err1_$SHARD.log" || { echo "FAIL(照合) $slug"; cat "$OUT/.tmp_err1_$SHARD.log" | tail -2; break; }
  FOUND=$(cat "$OUT/.tmp_found_$SHARD.json")
  P2="あなたは反証担当(懐疑役)。技(slug=$slug)の照合結果を疑う。ファイルは書き換えない。
まず $FILE を読み、wiki_pathがnullでなければ生ページも全文読み直す。
1)matchに実は差が無いか(数値の一字・%・対象の一語・例外・世代差) 2)観点の抜け 3)引用が原文に一字一句実在するか 4)出典の優先順位(champions=trueはCh行が正典。WikiとCh行の差をmismatchにしていないか)。曖昧ならagreed=false。
★yakkun_ch_rowは一次資料(循環参照という反証はしない)。
照合結果: $FOUND
最後のメッセージは次のJSONだけ: {\"name\":str,\"slug\":str,\"agreed\":bool,\"overturned\":[{\"aspect\":str,\"why\":str,\"authority_quote\":str}],\"missed\":[...同型],\"summary\":str}"
  codex exec -C "$ROOT" --sandbox read-only --output-last-message "$OUT/.tmp_reb_$SHARD.json" "$P2" </dev/null >/dev/null 2>"$OUT/.tmp_err2_$SHARD.log" || { echo "FAIL(反証) $slug"; break; }
  node -e '
const fs=require("fs");const [o,f,r,slug]=process.argv.slice(1);
const j=x=>{const s=fs.readFileSync(x,"utf8");return JSON.parse(s.slice(s.indexOf("{")));};
fs.writeFileSync(o+"/"+slug+".json",JSON.stringify({slug,found:j(f),rebuttal:j(r),source:"codex"},null,1));console.log("OK",slug);
' "$OUT" "$OUT/.tmp_found_$SHARD.json" "$OUT/.tmp_reb_$SHARD.json" "$slug" || { echo "FAIL(JSON) $slug"; break; }
  n=$((n+1))
done
echo "done: $n 件(出力=$OUT)"
