#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ポケモン1,257体の英語slug(PokeAPI)を機械照合で埋めるための対応表を作る。

★方針(2026-08-01): 推測で埋めない。
  第1段: 図鑑No.で候補を絞り、種族値6+タイプが完全一致した候補だけを採用
  第2段: 同種族値で複数残るものは、根拠のある規則だけで絞る(下記R1〜R6)。
         どの規則も「勝手な同一視」はしない=語の対応が一意に取れる時だけ
  未決は unmatched に全件列挙(1件ずつ人が確かめる)
出力: reference/_pokemon_slug_map.json(ビルダー build_master_v2.js が読む入力)

規則:
  R1 gmax除外   … キョダイマックスは実装しない(§22)。基本フォームを採る
  R2 totem除外  … ぬし(totem)は対戦外の個体。通常フォームを採る
  R3 語の対応   … 英語完全名の括弧内の語(色/かた/けいたい)がslugに一意に含まれる時だけ
  R4 既定唯一   … 候補の中で is_default が1つだけ(メテノりゅうせい等)
  R5 消去法     … 同図鑑No.内で他が全部決まり、残り1体⇔残り1候補になった時
  R6 自作メガ   … Champions独自メガ(PokeAPIに無い)= 元ポケモンのslug+'-mega'(+'-x/-y')を鋳造
"""
import json, re
from collections import Counter, defaultdict

MASTER = json.load(open('master/pokemon.json'))['items']
POKEAPI = json.load(open('reference/_old_master/pokeapi_master.json'))
EN = json.load(open('i18n/en.json'))
EN_POKE = EN.get('pokemon', {})
EN_ABIL = EN.get('abilities', {})

TYPE_EN = {'ノーマル':'normal','ほのお':'fire','みず':'water','でんき':'electric','くさ':'grass',
           'こおり':'ice','かくとう':'fighting','どく':'poison','じめん':'ground','ひこう':'flying',
           'エスパー':'psychic','むし':'bug','いわ':'rock','ゴースト':'ghost','ドラゴン':'dragon',
           'あく':'dark','はがね':'steel','フェアリー':'fairy'}

by_dex = defaultdict(list)
for r in POKEAPI:
    by_dex[r.get('dex')].append(r)

def slugify_ability(ja):
    v = EN_ABIL.get(ja)
    en = v.get('name') if isinstance(v, dict) else v
    if not en: return None
    return re.sub(r'[^a-z0-9]+', '-', en.lower()).strip('-')

def stats_match(m, r):
    s = r.get('stats') or {}
    pairs = [('hp','hp'),('atk','atk'),('def','def'),('spatk','spa'),('spdef','spd'),('spd','spe')]
    return all(m.get(a) is not None and m.get(a) == s.get(b) for a, b in pairs)

def types_match(m, r):
    want = {TYPE_EN.get(m.get('type1')), TYPE_EN.get(m.get('type2'))} - {None}
    return want == set(r.get('types') or [])

def en_hint(m):
    return EN_POKE.get(m.get('name')) or EN_POKE.get(m.get('display_name')) or ''

# ── 第1段 ──────────────────────────────────────────────────────────
matched = {}     # master name → {slug, method}
pending = {}     # master name → 候補list
for m in MASTER:
    cands = [r for r in by_dex.get(m.get('no'), []) if stats_match(m, r) and types_match(m, r)]
    method = 'stats+types'
    if len(cands) > 1:
        abils = {slugify_ability(m.get(k)) for k in ('ab1','ab2','ab3') if m.get(k)} - {None}
        if abils:
            narrowed = [r for r in cands if abils <= {a.get('name') for a in (r.get('abilities') or [])}]
            if len(narrowed) == 1:
                cands = narrowed; method = 'stats+types+ability'
    if len(cands) == 1:
        matched[m['name']] = {'slug': cands[0]['slug'], 'method': method}
    else:
        pending[m['name']] = cands

# ── 第2段: R1 gmax除外 → R2 totem除外 → R4 既定唯一 → R3 語の対応 ──
WORD2TOKEN = {  # 英語完全名の括弧内の語 → slug側の語(公式の対応・恣意なし)
    'red':'red','orange':'orange','yellow':'yellow','green':'green','blue':'blue',
    'indigo':'indigo','violet':'violet','meteor':'meteor','white':'white',
    'amped':'amped','single':'single-strike','rapid':'rapid-strike',
    'gliding':'gliding','sprinting':'sprinting','swimming':'swimming','limited':'limited',
    'glide':'glide','drive':'drive','aquatic':'aquatic','low-power':'low-power',
}
def words_of(hint):
    inparen = re.findall(r'\(([^)]*)\)', hint)
    text = (inparen[0] if inparen else '').lower().replace('-', ' ')
    return [w for w in re.split(r'[^a-z]+', text) if w]

for name, cands in list(pending.items()):
    m = next(x for x in MASTER if x['name'] == name)
    if not cands: continue
    c = [r for r in cands if '-gmax' not in r['slug']] or cands            # R1
    c = [r for r in c if 'totem' not in r['slug']] or c                    # R2
    if len(c) > 1:
        defaults = [r for r in c if r.get('is_default')]
        same_dex_rows = [x for x in MASTER if x.get('no') == m.get('no')]
        if len(defaults) == 1 and len(same_dex_rows) == 1:                 # R4(1行だけの時)
            c = defaults
    if len(c) > 1:                                                          # R3 語の対応
        ws = words_of(en_hint(m))
        toks = {WORD2TOKEN[w] for w in ws if w in WORD2TOKEN}
        # 2語で1つの形(bare 'low' は使わない=Low Key⇔Low-Power の取り違い防止)
        if 'low' in ws and 'key' in ws: toks.add('low-key')
        if 'low' in ws and 'power' in ws: toks.add('low-power')
        if toks:
            hit = [r for r in c if all(t in r['slug'] for t in toks)]
            # 語がslugに一意に対応した時だけ(例: Violet Core → minior-violet)
            if len(hit) == 1: c = hit
    if len(c) > 1:
        # R4b 既定唯一: 残った候補の中で is_default が1つだけならそれ
        #   (メテノりゅうせい=7色のmeteorは見た目も値も同一でPokeAPI既定はred-meteor /
        #    ミライドンUltimate Mode=既定フォームそのもの)
        defaults = [r for r in c if r.get('is_default')]
        if len(defaults) == 1: c = defaults
    if len(c) == 1:
        matched[name] = {'slug': c[0]['slug'], 'method': 'rule'}
        del pending[name]
    else:
        pending[name] = c

# ── R5 消去法(同図鑑No.内で残り1⇔1) ──────────────────────────────
for name in list(pending.keys()):
    m = next(x for x in MASTER if x['name'] == name)
    cands = pending[name]
    if not cands: continue
    others_pending = [n for n in pending if n != name and
                      next(x for x in MASTER if x['name'] == n).get('no') == m.get('no')]
    taken = {v['slug'] for v in matched.values()}
    rest = [r for r in cands if r['slug'] not in taken]
    if not others_pending and len(rest) == 1:
        matched[name] = {'slug': rest[0]['slug'], 'method': 'elimination'}
        del pending[name]

# ── R6 Champions自作メガ(PokeAPIに候補なし) ───────────────────────
for name in list(pending.keys()):
    if pending[name]: continue
    m = next(x for x in MASTER if x['name'] == name)
    if not m.get('mega') or not name.startswith('メガ'): continue
    stem = re.sub(r'^メガ', '', name)
    suffix = ''
    mm = re.match(r'^(.*?)([XY])$', stem)
    if mm: stem, suffix = mm.group(1), '-' + mm.group(2).lower()
    base = None
    for x in MASTER:
        if x.get('no') != m.get('no') or x.get('mega'): continue
        if x.get('display_name') == stem or x.get('name') == stem:
            base = x; break
    if not base:
        nonmega_ch = [x for x in MASTER if x.get('no') == m.get('no') and not x.get('mega') and x.get('champions')]
        if len(nonmega_ch) == 1: base = nonmega_ch[0]
    if base and base['name'] in matched:
        matched[name] = {'slug': matched[base['name']]['slug'] + '-mega' + suffix,
                         'method': 'ours_champions_mega'}  # ★PokeAPIに無い独自slug
        del pending[name]

# ── 最終検査: slugの重複(照合ミスの兆候)──────────────────────────
cnt = Counter(v['slug'] for v in matched.values())
dups = {s for s, n in cnt.items() if n > 1}
dup_notes = []
for name in [n for n, v in matched.items() if v['slug'] in dups]:
    m = next(x for x in MASTER if x['name'] == name)
    # ケンタロス型: 同slugをChampions権威行と全国版の英語名残骸が取り合う → 権威行を勝たせる
    rivals = [n for n, v in matched.items() if v['slug'] == matched[name]['slug']]
    srcs = {n: next(x for x in MASTER if x['name'] == n).get('source') for n in rivals}
    winners = [n for n in rivals if srcs[n] == 'champions_authority']
    if len(winners) == 1 and name != winners[0]:
        dup_notes.append({'no': m.get('no'), 'name': name, 'slug': matched[name]['slug'],
                          'note': 'dup_pending_dedupe(全国版の英語名残骸=統合予定。slugは権威行へ)'})
        del matched[name]

unmatched = [{'no': next(x for x in MASTER if x['name'] == n).get('no'), 'name': n,
              'candidates': [r['slug'] for r in c], 'en_hint': en_hint(next(x for x in MASTER if x['name'] == n))}
             for n, c in pending.items()]

out = {'what': 'ポケモン日本語名→PokeAPI英語slugの対応表(機械照合・検証つき)',
       'generator': 'tools/_match_pokemon_slugs.py',
       'rule': '種族値6+タイプ一致のみ採用。同種族値の複数候補は根拠のある規則R1〜R6だけで絞る。未決は推測で埋めない',
       'matched_count': len(matched), 'unmatched_count': len(unmatched),
       'methods': dict(Counter(v['method'] for v in matched.values())),
       'matched': [{'name': n, 'slug': v['slug'], 'method': v['method']} for n, v in sorted(matched.items())],
       'dup_pending_dedupe': dup_notes,
       'unmatched': unmatched}
json.dump(out, open('reference/_pokemon_slug_map.json', 'w'), ensure_ascii=False, indent=1)
print(f"照合: {len(matched)}/{len(MASTER)}  内訳: {out['methods']}")
print(f"統合待ち(ケンタロス型): {len(dup_notes)}件")
print(f"未決: {len(unmatched)}件")
for u in unmatched:
    print('  ', u['no'], u['name'], '候補:', u['candidates'][:6], 'EN:', u['en_hint'])
