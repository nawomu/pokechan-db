# 全ポケモン(275体)の手描き風オリジナル絵を量産するジェネレーター(段119)
# 方針(2026-06-12 阿部さん): 全部オリジナルのゆるい絵でOK。タイプ×種族値×名前ハッシュから
# 「タイプのパーツ」(炎のトサカ/ヒレ/稲妻しっぽ/葉っぱ/翼/牙…)を組み合わせて1体ずつ違う見た目を作る。
# メガ◯◯は元ポケモンと同じ体に「オーラ+тогり+怒り眉」を足して進化感を出す。
# 入力: /tmp/pokes.json(node側で書き出し) / 出力: images/sim/{名前}.png
# 再生成: node -e "...pokes.json書き出し..." && python3 tools/_gen_all_sprites.py
import json, math, os, hashlib, random
from PIL import Image, ImageDraw

SIZE, OUT = 360, 180
DIR = os.path.join(os.path.dirname(__file__), '..', 'images', 'sim')
os.makedirs(DIR, exist_ok=True)
LINE = (45, 38, 60, 255)
# 手作業で作った絵は上書きしない
CURATED = {'ピカチュウ', 'カビゴン', 'ゲンガー', 'テスト(みず)', 'テスト(ノーマル)', 'テスト(ゴースト)'}

TYPE_COLORS = {"ノーマル":(168,168,120),"ほのお":(240,128,48),"みず":(104,144,240),"でんき":(248,208,48),
"くさ":(120,200,80),"こおり":(152,216,216),"かくとう":(192,48,40),"どく":(160,64,160),"じめん":(224,192,104),
"ひこう":(168,144,240),"エスパー":(248,88,136),"むし":(168,184,32),"いわ":(184,160,56),"ゴースト":(112,88,152),
"ドラゴン":(112,56,248),"あく":(112,88,72),"はがね":(184,184,208),"フェアリー":(238,153,172)}

def hsh(name):
    return int(hashlib.md5(name.encode()).hexdigest(), 16)

def lighten(c, f=0.55):
    return tuple(min(255, int(v + (255 - v) * f)) for v in c) + (255,)

def darken(c, f=0.25):
    return tuple(max(0, int(v * (1 - f))) for v in c) + (255,)

def jit(rnd, pts, amp=2.5):
    return [(x + rnd.uniform(-amp, amp), y + rnd.uniform(-amp, amp)) for x, y in pts]

def blob(rnd, cx, cy, rx, ry, wob=0.06, n=64, bottom_wavy=False):
    ph = [rnd.uniform(0, math.pi * 2) for _ in range(3)]
    pts = []
    for i in range(n):
        t = i / n * math.pi * 2
        w = 1 + wob * (math.sin(t * 3 + ph[0]) * .6 + math.sin(t * 5 + ph[1]) * .3 + math.sin(t * 8 + ph[2]) * .2)
        x, y = cx + math.cos(t) * rx * w, cy + math.sin(t) * ry * w
        if bottom_wavy and math.sin(t) > 0.3:
            y += math.sin(t * 9 + ph[0]) * ry * 0.15
        pts.append((x, y))
    return pts

def poly(d, rnd, pts, fill, lw=7, line=LINE):
    d.polygon(pts, fill=fill)
    d.line(jit(rnd, pts + pts[:1]), fill=line, width=lw, joint='curve')

# ===== タイプパーツ(bodyの前=背面 / 後=前面 に描く) =====
def back_parts(d, rnd, t, cx, cy, rx, ry, c, cd):
    if t == 'ほのお':   # 炎のトサカ
        f = [(cx - 44, cy - ry + 14)]
        for i in range(5):
            x = cx - 44 + 22 * (i + 1)
            f.append((x - 11, cy - ry - (52 if i % 2 == 0 else 24) - rnd.uniform(0, 14)))
            f.append((x, cy - ry + 10))
        poly(d, rnd, f, (255, 150, 60, 255), lw=6)
    elif t == 'みず':   # 背ビレ+しっぽビレ
        poly(d, rnd, [(cx - 16, cy - ry + 8), (cx + 6, cy - ry - 52), (cx + 30, cy - ry + 8)], cd, lw=6)
        poly(d, rnd, [(cx + rx - 16, cy), (cx + rx + 52, cy - 38), (cx + rx + 44, cy + 4), (cx + rx + 56, cy + 40)], cd, lw=6)
    elif t == 'でんき':   # 稲妻しっぽ
        poly(d, rnd, [(cx + rx - 18, cy - 6), (cx + rx + 42, cy - 52), (cx + rx + 26, cy - 44),
                      (cx + rx + 64, cy - 92), (cx + rx + 70, cy - 56), (cx + rx + 50, cy - 60), (cx + rx + 56, cy - 6)], cd, lw=6)
    elif t == 'くさ':   # 頭の葉っぱ
        poly(d, rnd, [(cx - 4, cy - ry + 8), (cx - 56, cy - ry - 46), (cx - 8, cy - ry - 30)], (96, 176, 72, 255), lw=6)
        poly(d, rnd, [(cx + 4, cy - ry + 8), (cx + 56, cy - ry - 50), (cx + 10, cy - ry - 32)], (120, 200, 90, 255), lw=6)
    elif t == 'こおり':   # 氷の結晶
        for sx in (-1, 0, 1):
            x = cx + sx * 44
            poly(d, rnd, [(x - 14, cy - ry + 10), (x, cy - ry - 40 - abs(sx) * -8), (x + 14, cy - ry + 10)], lighten(c, .4), lw=5)
    elif t == 'ひこう' or t == 'フェアリー':   # 翼(フェアリーは小さめ)
        s = 1.0 if t == 'ひこう' else 0.62
        for sx in (-1, 1):
            wpts = [(cx + sx * (rx - 16), cy - 12), (cx + sx * (rx + 84 * s), cy - 70 * s),
                    (cx + sx * (rx + 64 * s), cy - 22 * s), (cx + sx * (rx + 96 * s), cy + 10 * s), (cx + sx * (rx - 4), cy + 20)]
            poly(d, rnd, wpts, lighten(c, .5), lw=6)
    elif t == 'むし':   # 触角
        for sx in (-1, 1):
            a = [(cx + sx * 26, cy - ry + 12), (cx + sx * 58, cy - ry - 52)]
            d.line(jit(rnd, a), fill=LINE, width=6, joint='curve')
            d.ellipse([cx + sx * 58 - 8, cy - ry - 60, cx + sx * 58 + 8, cy - ry - 44], fill=cd)
    elif t == 'いわ' or t == 'じめん':   # ゴツゴツ岩トゲ
        for sx in (-1, 0, 1):
            x = cx + sx * 50
            poly(d, rnd, [(x - 18, cy - ry + 14), (x + rnd.uniform(-6, 6), cy - ry - 30), (x + 18, cy - ry + 14)], darken(c, .15), lw=6)
    elif t == 'ドラゴン':   # ツノ2本
        for sx in (-1, 1):
            poly(d, rnd, [(cx + sx * 36, cy - ry + 14), (cx + sx * 78, cy - ry - 54), (cx + sx * 56, cy - ry + 6)], cd, lw=6)
    elif t == 'あく':   # ギザギザの襟
        f = [(cx - rx + 10, cy - 8)]
        for i in range(6):
            x = cx - rx + 10 + (2 * rx - 20) * (i + 1) / 6
            f.append((x - 12, cy - ry - (26 if i % 2 == 0 else 8)))
            f.append((x, cy - 12))
        poly(d, rnd, f, darken(c, .35), lw=5)
    elif t == 'はがね':   # 金属プレート(頭)
        poly(d, rnd, [(cx - 46, cy - ry + 18), (cx, cy - ry - 26), (cx + 46, cy - ry + 18)], (200, 200, 216, 255), lw=6)
    elif t == 'エスパー':   # 後光リング
        d.ellipse([cx - rx - 10, cy - ry - 18, cx + rx + 10, cy - ry + 46], outline=lighten(c, .3), width=8)
    elif t == 'かくとう':   # 上げたこぶし
        for sx in (-1, 1):
            poly(d, rnd, blob(rnd, cx + sx * (rx + 18), cy - ry + 4, 22, 19, wob=0.1, n=24), c + (255,) if len(c) == 3 else c, lw=6)
    elif t == 'どく':   # ぽたぽたツノ
        poly(d, rnd, [(cx - 12, cy - ry + 10), (cx + 4, cy - ry - 44), (cx + 22, cy - ry + 10)], cd, lw=6)
        d.ellipse([cx + 0, cy - ry - 58, cx + 12, cy - ry - 44], fill=cd)
    elif t == 'ノーマル':   # まる耳
        for sx in (-1, 1):
            d.ellipse([cx + sx * 56 - 24, cy - ry - 26, cx + sx * 56 + 24, cy - ry + 22], fill=c + (255,) if len(c) == 3 else c, outline=LINE, width=6)

def front_face(d, rnd, style, cx, cy, fierce=False):
    ey = cy - 16
    if style == 0:   # まる目
        for sx in (-1, 1):
            x = cx + sx * 34
            d.ellipse([x - 13, ey - 13, x + 13, ey + 13], fill=(255, 255, 255, 255), outline=LINE, width=5)
            d.ellipse([x - 6, ey - 5, x + 6, ey + 8], fill=LINE)
    elif style == 1:   # 点目
        for sx in (-1, 1):
            x = cx + sx * 30
            d.ellipse([x - 7, ey - 7, x + 7, ey + 7], fill=LINE)
    elif style == 2:   # ねむそう
        for sx in (-1, 1):
            x = cx + sx * 32
            d.arc([x - 14, ey - 8, x + 14, ey + 12], 200 if sx < 0 else 340, 340 if sx < 0 else 480, fill=LINE, width=6)
    else:   # きりっ
        for sx in (-1, 1):
            x = cx + sx * 34
            d.ellipse([x - 12, ey - 12, x + 12, ey + 12], fill=(255, 255, 255, 255), outline=LINE, width=5)
            d.ellipse([x - 5, ey - 5, x + 5, ey + 7], fill=LINE)
            d.line(jit(rnd, [(x - 14, ey - 16), (x + 12, ey - 8)], 1.5), fill=LINE, width=6)
    if fierce and style != 3:   # メガは強制怒り眉
        for sx in (-1, 1):
            x = cx + sx * 34
            d.line(jit(rnd, [(x - 14, ey - 18), (x + 12, ey - 9)], 1.5), fill=LINE, width=6)
    m = rnd.randrange(4)
    my = cy + 22
    if m == 0:
        d.arc([cx - 20, my - 8, cx + 20, my + 18], 15, 165, fill=LINE, width=6)
    elif m == 1:
        d.ellipse([cx - 8, my - 2, cx + 8, my + 16], outline=LINE, width=5)
    elif m == 2:
        pts = [(cx - 22 + i * 11, my + (6 if i % 2 else 0)) for i in range(5)]
        d.line(jit(rnd, pts, 1.5), fill=LINE, width=5, joint='curve')
    else:   # にやり+キバ
        d.arc([cx - 22, my - 10, cx + 22, my + 14], 15, 165, fill=LINE, width=6)
        d.polygon([(cx - 10, my + 9), (cx - 4, my + 20), (cx + 1, my + 9)], fill=(255, 255, 255, 255), outline=LINE)

def gen(p, base_of=None, mega_kind=''):
    name = p['name']
    seed_name = base_of or name
    rnd = random.Random(hsh(seed_name))
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c1 = TYPE_COLORS.get(p['type1'], (120, 120, 140))
    c2 = TYPE_COLORS.get(p['type2'], None) if p['type2'] else None
    cd = darken(c1)
    cx, cy = SIZE // 2, SIZE // 2 + 22
    # 体型: HPが高いほど横に・素早いほど縦長に
    hp_n = max(0.0, min(1.0, (p['hp'] - 40) / 120))
    sp_n = max(0.0, min(1.0, (p['spd'] - 30) / 110))
    rx = int(96 + hp_n * 36 - sp_n * 10)
    ry = int(86 + sp_n * 22)
    is_ghost = p['type1'] == 'ゴースト'
    # メガ: オーラ(背面のギザ円)
    if base_of:
        aura = []
        n = 14
        for i in range(n + 1):
            t = math.pi * 2 * i / n
            r = (rx + 34) + (16 if i % 2 else 0)
            aura.append((cx + math.cos(t) * r, cy + math.sin(t) * r * 0.9))
        d.polygon(jit(rnd, aura, 3), fill=(255, 215, 120, 90))
        d.line(jit(random.Random(hsh(name)), aura, 3), fill=(255, 190, 80, 200), width=5, joint='curve')
    back_parts(d, rnd, p['type1'], cx, cy, rx, ry, c1, cd)
    # 体
    body = blob(rnd, cx, cy, rx, ry, wob=0.055, bottom_wavy=is_ghost)
    poly(d, rnd, body, c1 + (235 if is_ghost else 255,))
    # おなか
    d.polygon(blob(rnd, cx, cy + int(ry * 0.36), int(rx * 0.52), int(ry * 0.42), wob=0.08, n=40), fill=lighten(c1))
    # タイプ2のアクセント(肩のもよう)
    if c2:
        d.polygon(blob(rnd, cx - int(rx * 0.55), cy - int(ry * 0.4), 26, 20, wob=0.12, n=24), fill=c2 + (220,))
    # 顔
    style = rnd.randrange(4) if not base_of else 3
    front_face(d, rnd, style, cx, cy - 8, fierce=bool(base_of))
    # ほっぺ(かわいい枠: 50%)
    if rnd.random() < 0.5 and not base_of:
        for sx in (-1, 1):
            d.ellipse([cx + sx * 64 - 11, cy + 4, cx + sx * 64 + 11, cy + 20], fill=(240, 140, 140, 150))
    # リザードンX/Y等の区別: 右肩にX/Yマーク
    if mega_kind:
        d.text((cx + rx - 18, cy - ry - 6), mega_kind, fill=(255, 255, 255, 255))
    img.resize((OUT, OUT), Image.LANCZOS).save(os.path.join(DIR, f'{name}.png'))

pokes = json.load(open('/tmp/pokes.json', encoding='utf-8'))
by_name = {p['name']: p for p in pokes}
made = 0
for p in pokes:
    if p['name'] in CURATED:
        continue
    base_of, mega_kind = None, ''
    if p['name'].startswith('メガ'):
        b = p['name'][2:]
        if b.endswith('X') or b.endswith('Y'):
            mega_kind = b[-1]
            b = b[:-1]
        if b in by_name:
            base_of = b
    gen(p, base_of=base_of, mega_kind=mega_kind)
    made += 1
print(f'生成: {made}体 (CURATED {len(CURATED)}体はスキップ)')
