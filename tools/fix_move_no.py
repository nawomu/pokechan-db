#!/usr/bin/env python3
"""
fix_move_no.py — audit_move_no.py が検出した move_no の誤りを修正する。

ローカル PokeAPI キャッシュ (i18n/cache/move) の ja名→id を正として、
WAZA_MAP 各エントリの move_no をピンポイント置換する。
WAZA_MAP では move_no は各エントリの 2 番目のフィールド (name の直後、
ネストされたオブジェクトより前) なので、スラッグキーから最初の move_no
までを brace を含まない範囲で安全に置換できる。

実行前に pokechan_data.js.bak を作成する。
DRY-RUN: 引数 --apply を付けない限り変更を書き込まず、置換予定のみ表示。
"""
import json
import re
import sys
from pathlib import Path

# audit スクリプトのロジックを再利用
sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_move_no import (  # noqa: E402
    DATA_JS,
    extract_object_literal,
    build_cache_index,
    norm,
)


def compute_corrections():
    text = DATA_JS.read_text(encoding="utf-8")
    literal = extract_object_literal(text, "WAZA_MAP")
    waza = json.loads(literal)
    ja_to_id, _ = build_cache_index()

    corrections = {}  # slug -> (old, new, name)
    for slug, entry in waza.items():
        if not isinstance(entry, dict):
            continue
        name = entry.get("name")
        mv = entry.get("move_no")
        if not name or not isinstance(mv, int) or isinstance(mv, bool):
            continue
        expected = ja_to_id.get(norm(name))
        if expected is not None and expected != mv:
            corrections[slug] = (mv, expected, name)
    return text, corrections


def apply_corrections(text, corrections):
    applied = []
    failed = []
    new_text = text
    for slug, (old, new, name) in corrections.items():
        # "slug" : { ... (braceなし) ... "move_no" : OLD
        pat = re.compile(
            r'("' + re.escape(slug) + r'"\s*:\s*\{[^{}]*?"move_no"\s*:\s*)'
            + str(old) + r'(?=[,\s}])'
        )
        new_text, n = pat.subn(lambda m: m.group(1) + str(new), new_text, count=1)
        if n == 1:
            applied.append((slug, old, new, name))
        else:
            failed.append((slug, old, new, name))
    return new_text, applied, failed


def main():
    apply = "--apply" in sys.argv
    text, corrections = compute_corrections()
    print(f"修正候補: {len(corrections)} 件")
    new_text, applied, failed = apply_corrections(text, corrections)

    for slug, old, new, name in applied:
        print(f"  {slug} ({name}): {old} -> {new}")
    if failed:
        print(f"\n!! 置換できなかった {len(failed)} 件 (要手動確認):")
        for slug, old, new, name in failed:
            print(f"  {slug} ({name}): {old} -> {new}")

    if not apply:
        print("\n[DRY-RUN] 変更は書き込んでいません。--apply で適用します。")
        return 0

    if failed:
        print("\n置換失敗があるため中断します (--apply でも書き込みません)。")
        return 1

    bak = DATA_JS.with_suffix(".js.bak")
    if not bak.exists():
        bak.write_text(text, encoding="utf-8")
    DATA_JS.write_text(new_text, encoding="utf-8")
    print(f"\n適用しました。バックアップ: {bak} (既存は温存)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
