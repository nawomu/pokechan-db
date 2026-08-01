#!/bin/bash
# pre-commit の番人 — commit の前に必ず走る(2026-08-01 阿部さん承認)
#
# なぜ: 「MDに書いても忘れる」ことが実測された(2026-07-31)。
#       文章のルールでは止まらない。赤くなる物だけが止める。
#       この hook は赤のままだと commit 自体を失敗させる=読まなくても止まる最後の段。
#
# 導入: bash tools/_precommit_guard.sh --install
#       (.git/hooks/ は git に入らないので、クローンし直したら再導入が要る)

# ★.git/hooks/ にコピーされて動くので、置き場所からでなく git にルートを聞く
cd "$(git rev-parse --show-toplevel)" || exit 1

if [ "$1" = "--install" ]; then
  cp tools/_precommit_guard.sh .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "✅ .git/hooks/pre-commit に導入した(番人が赤だと commit できない)"
  exit 0
fi

echo "── pre-commit 番人 ──"

node tools/_page_guard_test.js >/dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ ページの番人が赤 → node tools/_page_guard_test.js で中身を見る"
  echo "   (新しいデータ直読み/台帳にないページ/役割の重複。★基準を上げて通すのは禁止)"
  exit 1
fi

node tools/_ssot_guard_test.js >/dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ データの番人が赤 → node tools/_ssot_guard_test.js で中身を見る"
  exit 1
fi

echo "✅ 番人ふたつ緑(ページ/データ)"
exit 0
