#!/usr/bin/env python3
"""
audit_move_no.py — WAZA_MAP の move_no 整合性監査 (Phase 4-d)

pokechan_data.js (SSOT) の WAZA_MAP が持つ各技の move_no を、
ローカル PokeAPI キャッシュ (i18n/cache/move/*.json) と突合して検証する。

突合源はネット上の PokeAPI ではなく、プロジェクトが取り込み済みの
ローカルキャッシュ。これがこのプロジェクトにおける「公式の正」。

検査項目:
  C1 重複       同じ move_no が複数の技に割り当てられていないか
  C2 欠落/型     move_no が null/欠落/非整数/<=0 でないか
  C3 範囲       標準技 ID 範囲 (1..STD_MAX)。超過は要確認 (yakkun 体系の名残)
  C4 名前突合   技の日本語名から期待される PokeAPI ID と move_no が一致するか
  C5 フィールド  各エントリに name と move_no が存在するか

終了コード: エラー (C1/C2/C4 不一致) があれば 1、なければ 0。
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_JS = ROOT / "pokechan_data.js"
CACHE_MOVE = ROOT / "i18n" / "cache" / "move"

# PokeAPI 標準技 ID の上限 (これ超のうち 10000+ はシャドー技などの別枠)
STD_MAX = 919


def extract_object_literal(text, var_name):
    """`const <var_name> = { ... };` の {...} 部分を brace-match で抽出して返す。
    文字列リテラル内の波括弧は無視する。"""
    m = re.search(r"(?:const|let|var)\s+" + re.escape(var_name) + r"\s*=\s*\{", text)
    if not m:
        raise ValueError(f"{var_name} が見つかりません")
    start = m.end() - 1  # 最初の '{' の位置
    depth = 0
    in_str = False
    quote = ""
    esc = False
    i = start
    while i < len(text):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == quote:
                in_str = False
        else:
            if c in ('"', "'"):
                in_str = True
                quote = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
        i += 1
    raise ValueError(f"{var_name} の閉じ括弧が見つかりません")


def load_waza_map():
    text = DATA_JS.read_text(encoding="utf-8")
    literal = extract_object_literal(text, "WAZA_MAP")
    # JS オブジェクトリテラルだが、このプロジェクトはキー・文字列とも
    # ダブルクォートで JSON 互換に書かれている。そのまま json で読む。
    return json.loads(literal)


def norm(s):
    """全角/半角の表記ゆれを吸収するための正規化。
    WAZA_MAP は半角数字・英字 (10まんボルト)、キャッシュは全角 (１０まんボルト)
    で書かれているため、NFKC で揃えてから突合する。"""
    return unicodedata.normalize("NFKC", s) if s else s


def build_cache_index():
    """ローカル PokeAPI キャッシュから ja名(NFKC正規化) -> id, id -> (slug, ja名) を構築。"""
    ja_to_id = {}
    id_to_ja = {}
    for f in CACHE_MOVE.glob("*.json"):
        if f.name == "_list.json":
            continue
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        mid = d.get("id")
        if not isinstance(mid, int):
            continue
        ja = None
        for n in d.get("names", []):
            lang = n.get("language", {}).get("name")
            if lang == "ja-Hrkt":
                ja = n.get("name")
                break
            if lang == "ja" and ja is None:
                ja = n.get("name")
        if ja:
            ja_to_id.setdefault(norm(ja), mid)
            id_to_ja[mid] = (d.get("name"), ja)
    return ja_to_id, id_to_ja


def main():
    waza = load_waza_map()
    ja_to_id, id_to_ja = build_cache_index()

    errors = []   # 修正必須
    warnings = [] # 要確認

    # --- C5 フィールド存在 + C2 欠落/型 ---
    valid = {}  # slug -> (name, move_no)
    for slug, entry in waza.items():
        if not isinstance(entry, dict):
            errors.append(f"[C5] {slug}: エントリがオブジェクトでない")
            continue
        name = entry.get("name")
        if not name:
            errors.append(f"[C5] {slug}: name フィールドが欠落")
        mv = entry.get("move_no")
        if mv is None:
            errors.append(f"[C2] {slug} ({name}): move_no が欠落/null")
            continue
        if not isinstance(mv, int) or isinstance(mv, bool):
            errors.append(f"[C2] {slug} ({name}): move_no が整数でない -> {mv!r}")
            continue
        if mv <= 0:
            errors.append(f"[C2] {slug} ({name}): move_no が非正 -> {mv}")
            continue
        valid[slug] = (name, mv)

    # --- C1 重複 move_no ---
    by_moveno = {}
    for slug, (name, mv) in valid.items():
        by_moveno.setdefault(mv, []).append((slug, name))
    for mv, lst in sorted(by_moveno.items()):
        if len(lst) > 1:
            who = ", ".join(f"{s}({n})" for s, n in lst)
            errors.append(f"[C1] move_no {mv} が重複: {who}")

    # --- C3 範囲 + C4 名前突合 ---
    for slug, (name, mv) in valid.items():
        if mv > STD_MAX and mv < 10000:
            warnings.append(
                f"[C3] {slug} ({name}): move_no {mv} が標準上限 {STD_MAX} 超 (yakkun 体系の名残の疑い)"
            )
        expected = ja_to_id.get(norm(name))
        if expected is None:
            warnings.append(f"[C4] {slug} ({name}): キャッシュに同名の技が無く突合不可")
        elif expected != mv:
            slug_en, _ = id_to_ja.get(expected, ("?", ""))
            cur_slug_en, cur_ja = id_to_ja.get(mv, ("?", "?"))
            errors.append(
                f"[C4] {slug} ({name}): move_no {mv} -> 正 {expected} "
                f"(期待 ID {expected}={slug_en} / 現 ID {mv}={cur_slug_en}:{cur_ja})"
            )

    # --- レポート ---
    print(f"WAZA_MAP エントリ数 : {len(waza)}")
    print(f"キャッシュ技数      : {len(ja_to_id)} (ja名ユニーク)")
    print(f"検査対象(有効)      : {len(valid)}")
    print("-" * 60)
    if errors:
        print(f"■ エラー {len(errors)} 件 (修正必須)")
        for e in errors:
            print("  " + e)
    else:
        print("■ エラー: なし")
    print()
    if warnings:
        print(f"□ 警告 {len(warnings)} 件 (要確認)")
        for w in warnings:
            print("  " + w)
    else:
        print("□ 警告: なし")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
