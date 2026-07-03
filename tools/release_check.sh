#!/bin/bash
set -e
# 使い方: bash tools/release_check.sh
# push前に1コマンドで走らせるチェッカー。
# ローカルサーバが必要なステップは起動済みかチェックし、未起動なら [SKIP] する。

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== [1/3] Node構文チェック ==="
for f in i18n/runtime.js waza_picker.js tools/build_i18n_entities.js; do
  node --check "$f" && echo "  OK: $f" || exit 1
done

echo ""
echo "=== [2/3] i18n辞書ビルド冪等確認 ==="
# dry-runで差分0を確認
node tools/build_i18n_entities.js --dry-run --lang=en

echo ""
echo "=== [3/3] i18n監査(en/ko/zh-Hans) ==="
# ローカルサーバが必要 - 起動チェック
if ! curl -s http://127.0.0.1:8000 > /dev/null 2>&1; then
  echo "  [SKIP] ローカルサーバ未起動(python3 -m http.server 8000 で起動してから再実行)"
else
  node tools/i18n_audit_playwright.js en,ko,zh-Hans --strict
fi

echo ""
echo "=== 全チェック完了 ==="
