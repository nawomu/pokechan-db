# 2026-09-04 B-4: ポケモン名辞書(i18n/*.json pokemon)の系統バグ修正。出典=PokeAPI公式部品(reference/_old_master/pokeapi_master.json)のみ・でっち上げ無し
import json,re,sys,collections
m=json.load(open('reference/_old_master/pokeapi_master.json')); by={x['slug']:x for x in m}
pk=json.load(open('master/pokemon.json'))['items']
langs=['en','fr','de','es','it','ko','zh-Hans','zh-Hant']
apply='--apply' in sys.argv
changes=collections.defaultdict(list)
for l in langs:
    J=json.load(open(f'i18n/{l}.json')); D=J['pokemon']
    for r in pk:
        n=r['name']; x=by.get(r.get('slug'))
        if not x: continue
        sp=(x.get('species_names') or {}).get(l); fl=(x.get('form_names') or {}).get(l); fu=(x.get('full_names') or {}).get(l)
        v=D.get(n); new=None; why=None
        if not sp: continue
        if '(' not in n and not n.startswith('メガ'):
            # (1) 基本キー=種名そのもの(フォームラベル「Hero of Many Battles」等が入っていたら誤り)
            if v!=sp: new,why=sp,'base=species'
        else:
            # (2) フォームラベルが種名を含む(Heat Rotom/Black Kyurem/Hoopa Unbound…)=ラベル単体が完全名。「Rotom (Heat Rotom)」の二重を解消
            if fl and sp in fl and fl!=sp and v!=fl: new,why=fl,'label-embeds-species'
            # (3) 値に種名が無い(「Paldean Form (Blaze Breed)」「Zen Mode」)=完全名(full_names)か「種名 (ラベル)」の合成に戻す
            elif v and sp not in v:
                if fu and sp in fu: new,why=fu,'missing-species->full'
                elif fl:
                    # 地方のすがた+モード(ヒヒダルマ ガラル ダルマモード)は地方名の行の値にラベルを足す(公式部品の合成のみ)
                    reg=re.sub(r'\(([^)]*のすがた) .*\)$', r'(\1)', n)
                    if reg!=n and D.get(reg) and D[reg]!=sp and D[reg].endswith(')'): new,why=D[reg][:-1]+f', {fl})','missing-species->compose-regional'
                    else: new,why=f'{sp} ({fl})','missing-species->compose'
            # (4) 種名だけになっている(イッカネズミ(4ひきかぞく)=Maushold)がPokeAPIに完全名がある → 完全名
            elif v==sp and fu and fu!=sp: new,why=fu,'species-only->full'
        if new and new!=v:
            changes[l].append((n,v,new,why))
            if apply: D[n]=new
    if apply: json.dump(J,open(f'i18n/{l}.json','w'),ensure_ascii=False,indent=2); open(f'i18n/{l}.json','a').write('\n')
for l in langs:
    print(f'== {l}: {len(changes[l])}')
    for c in changes[l]: print('  ',c[3],'|',c[0],'|',c[1],'->',c[2])
