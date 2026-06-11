# スペックJSON → 手描き風スプライト描画(段120)
# data/sprite_specs.json(ワークフローで生成: 各ポケモンの実デザイン知識→体色/体型/象徴パーツ/顔)を読み、
# パーツカタログ(下のPART一覧)から組み立てて images/sim/{名前}.png を描く。
# 実行: python3 tools/_render_sprite_spec.py [名前...](省略時は全部)
import json, math, os, sys, hashlib, random
from PIL import Image, ImageDraw

SIZE, OUT = 360, 180
ROOT = os.path.join(os.path.dirname(__file__), '..')
DIR = os.path.join(ROOT, 'images', 'sim')
SPECS = os.path.join(ROOT, 'data', 'sprite_specs.json')
LINE = (45, 38, 60, 255)
CURATED = {'テスト(みず)', 'テスト(ノーマル)', 'テスト(ゴースト)'}

def C(c, a=255):
    if isinstance(c, str) and c.startswith('#'):
        c = [int(c[i:i+2], 16) for i in (1, 3, 5)]
    return (c[0], c[1], c[2], a)

def lighten(c, f=0.55):
    return tuple(min(255, int(v + (255 - v) * f)) for v in c[:3]) + (c[3] if len(c) > 3 else 255,)

def darken(c, f=0.25):
    return tuple(max(0, int(v * (1 - f))) for v in c[:3]) + (c[3] if len(c) > 3 else 255,)

def jit(rnd, pts, amp=2.5):
    return [(x + rnd.uniform(-amp, amp), y + rnd.uniform(-amp, amp)) for x, y in pts]

def blob(rnd, cx, cy, rx, ry, wob=0.055, n=64, bottom_wavy=False):
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

SZ = {'s': 0.7, 'm': 1.0, 'l': 1.35}

# ===== パーツカタログ(kind → 描画。phase: back=体の後ろ / front=体の上) =====
def draw_part(d, rnd, kind, ph, cx, cy, rx, ry, col, size):
    s = SZ.get(size, 1.0)
    c = col
    cd = darken(c)
    top = cy - ry
    if ph == 'back':
        if kind == 'ears_round':
            for sx in (-1, 1):
                d.ellipse([cx + sx * rx * .55 - 26 * s, top - 30 * s, cx + sx * rx * .55 + 26 * s, top + 24], fill=c, outline=LINE, width=6)
        elif kind == 'ears_pointy':
            for sx in (-1, 1):
                poly(d, rnd, [(cx + sx * rx * .42, top + 16), (cx + sx * rx * .85, top - 60 * s), (cx + sx * rx * .78, top + 20)], c, lw=6)
        elif kind == 'ears_long':
            for sx in (-1, 1):
                d.ellipse([cx + sx * rx * .45 - 16, top - 92 * s, cx + sx * rx * .45 + 16, top + 16], fill=c, outline=LINE, width=6)
        elif kind == 'horn_single':
            poly(d, rnd, [(cx - 14 * s, top + 10), (cx + 2, top - 56 * s), (cx + 18 * s, top + 10)], c, lw=6)
        elif kind == 'horns_two':
            for sx in (-1, 1):
                poly(d, rnd, [(cx + sx * 32, top + 12), (cx + sx * 66 * s, top - 48 * s), (cx + sx * 48, top + 8)], c, lw=6)
        elif kind == 'flame_crest':
            f = [(cx - 46 * s, top + 12)]
            for i in range(5):
                x = cx - 46 * s + 23 * s * (i + 1)
                f.append((x - 11 * s, top - (54 if i % 2 == 0 else 26) * s - rnd.uniform(0, 12)))
                f.append((x, top + 8))
            poly(d, rnd, f, c, lw=6)
        elif kind == 'tail_flame':
            t = [(cx + rx - 14, cy + 14), (cx + rx + 52 * s, cy + 4), (cx + rx + 44 * s, cy - 18)]
            poly(d, rnd, t, darken(c, .1), lw=6)
            f = [(cx + rx + 36 * s, cy - 10), (cx + rx + 56 * s, cy - 58 * s), (cx + rx + 66 * s, cy - 22), (cx + rx + 80 * s, cy - 44 * s), (cx + rx + 78 * s, cy - 2)]
            poly(d, rnd, f, (255, 150, 60, 255), lw=5)
        elif kind == 'fin_back':
            poly(d, rnd, [(cx - 18, top + 10), (cx + 4, top - 54 * s), (cx + 28, top + 10)], c, lw=6)
        elif kind == 'fin_tail':
            poly(d, rnd, [(cx + rx - 14, cy), (cx + rx + 56 * s, cy - 38 * s), (cx + rx + 46 * s, cy + 4), (cx + rx + 60 * s, cy + 40 * s)], c, lw=6)
        elif kind == 'fins_side':
            for sx in (-1, 1):
                poly(d, rnd, [(cx + sx * (rx - 8), cy + 26), (cx + sx * (rx + 50 * s), cy + 52), (cx + sx * (rx - 2), cy + 58)], c, lw=5)
        elif kind == 'leaf_head':
            poly(d, rnd, [(cx - 4, top + 8), (cx - 52 * s, top - 44 * s), (cx - 8, top - 28)], c, lw=6)
            poly(d, rnd, [(cx + 4, top + 8), (cx + 52 * s, top - 48 * s), (cx + 10, top - 30)], lighten(c, .2), lw=6)
        elif kind == 'flower_back':
            for i in range(6):
                a = math.pi * 2 * i / 6 - math.pi / 2
                px, py = cx + math.cos(a) * 54 * s, top - 8 + math.sin(a) * 40 * s
                d.ellipse([px - 26 * s, py - 22 * s, px + 26 * s, py + 22 * s], fill=c, outline=LINE, width=5)
            d.ellipse([cx - 20 * s, top - 28 * s, cx + 20 * s, top + 12], fill=(255, 220, 120, 255), outline=LINE, width=5)
        elif kind == 'bulb_back':
            poly(d, rnd, blob(rnd, cx + rx * .3, top + 6, 52 * s, 44 * s, wob=0.07, n=36), c, lw=6)
        elif kind == 'shell_back':
            # 甲羅は体よりひとまわり大きく描いて「縁」が見えるようにする(体に隠れない)
            poly(d, rnd, blob(rnd, cx, cy - 4, rx * 1.16, ry * 1.1, wob=0.03, n=48), c, lw=7)
        elif kind == 'cannon_back':
            for sx in (-1, 1):
                bx = cx + sx * rx * .58
                poly(d, rnd, [(bx - 22 * s, top + 18), (bx - 18 * s, top - 52 * s),
                              (bx + 18 * s, top - 52 * s), (bx + 22 * s, top + 18)], c, lw=6)
                d.ellipse([bx - 16 * s, top - 64 * s, bx + 16 * s, top - 40 * s], fill=(60, 60, 70, 255), outline=LINE, width=5)
        elif kind == 'wings':
            for sx in (-1, 1):
                w = [(cx + sx * (rx - 16), cy - 12), (cx + sx * (rx + 86 * s), cy - 72 * s),
                     (cx + sx * (rx + 64 * s), cy - 22), (cx + sx * (rx + 96 * s), cy + 8), (cx + sx * (rx - 4), cy + 20)]
                poly(d, rnd, w, c, lw=6)
        elif kind == 'wings_small':
            for sx in (-1, 1):
                w = [(cx + sx * (rx - 12), cy - 10), (cx + sx * (rx + 46 * s), cy - 40 * s), (cx + sx * (rx + 38 * s), cy + 8)]
                poly(d, rnd, w, c, lw=6)
        elif kind == 'bolt_tail':
            poly(d, rnd, [(cx + rx - 18, cy - 6), (cx + rx + 42 * s, cy - 52 * s), (cx + rx + 26 * s, cy - 44),
                          (cx + rx + 64 * s, cy - 92 * s), (cx + rx + 70 * s, cy - 56), (cx + rx + 50 * s, cy - 60), (cx + rx + 56 * s, cy - 6)], c, lw=6)
        elif kind == 'tail_curl':
            pts = []
            for i in range(20):
                t = i / 19
                a = t * math.pi * 1.7
                r = 52 * s * (1 - t * .75)
                pts.append((cx + rx - 6 + math.cos(a + 2.4) * r * .8, cy + 30 + math.sin(a) * r * .5))
            d.line(jit(rnd, pts), fill=c, width=int(16 * s), joint='curve')
            d.line(jit(rnd, pts, 2), fill=LINE, width=5, joint='curve')
        elif kind == 'tail_fan':
            for k in (-1, 0, 1):
                poly(d, rnd, [(cx + rx - 12, cy + 6), (cx + rx + 58 * s, cy + k * 30 - 10), (cx + rx + 40 * s, cy + k * 30 + 12)], c, lw=5)
        elif kind == 'spikes_back':
            for sx in (-1, 0, 1):
                x = cx + sx * 52
                poly(d, rnd, [(x - 17, top + 12), (x + rnd.uniform(-5, 5), top - 34 * s), (x + 17, top + 12)], c, lw=6)
        elif kind == 'ice_crystals':
            for sx in (-1, 0, 1):
                x = cx + sx * 46
                poly(d, rnd, [(x - 13, top + 10), (x, top - 38 * s), (x + 13, top + 10)], c, lw=5)
        elif kind == 'rock_lumps':
            for sx in (-1, 0, 1):
                poly(d, rnd, blob(rnd, cx + sx * 56, top + 6, 26 * s, 20 * s, wob=0.12, n=20), c, lw=5)
        elif kind == 'antennae':
            for sx in (-1, 1):
                d.line(jit(rnd, [(cx + sx * 26, top + 10), (cx + sx * 58 * s, top - 52 * s)]), fill=LINE, width=6, joint='curve')
                d.ellipse([cx + sx * 58 * s - 8, top - 60 * s, cx + sx * 58 * s + 8, top - 44 * s], fill=c)
        elif kind == 'halo_ring':
            d.ellipse([cx - rx - 8, top - 18, cx + rx + 8, top + 48], outline=c, width=8)
        elif kind == 'collar_fluff':
            f = [(cx - rx + 8, cy - 6)]
            for i in range(7):
                x = cx - rx + 8 + (2 * rx - 16) * (i + 1) / 7
                f.append((x - 11, cy - ry - (24 if i % 2 == 0 else 6) * s))
                f.append((x, cy - 10))
            poly(d, rnd, f, c, lw=5)
        elif kind == 'mane':
            poly(d, rnd, blob(rnd, cx, cy - ry * .45, rx * .92, ry * .62, wob=0.14, n=40), c, lw=6)
    else:   # front
        if kind == 'gem_forehead':
            d.ellipse([cx - 11 * s, top + 18, cx + 11 * s, top + 40 * s + 18], fill=c, outline=LINE, width=4)
        elif kind == 'whiskers':
            for sx in (-1, 1):
                for k in (-1, 0, 1):
                    d.line(jit(rnd, [(cx + sx * rx * .6, cy + 4 + k * 11), (cx + sx * (rx + 44 * s), cy + k * 16)], 2), fill=LINE, width=4)
        elif kind == 'beak':
            poly(d, rnd, [(cx - 14 * s, cy + 8), (cx, cy + 34 * s), (cx + 14 * s, cy + 8)], c, lw=5)
        elif kind == 'fangs':
            for sx in (-1, 1):
                d.polygon([(cx + sx * 16 - 6, cy + 26), (cx + sx * 16, cy + 42 * s), (cx + sx * 16 + 6, cy + 26)], fill=(255, 255, 255, 255), outline=LINE)
        elif kind == 'grin_teeth':
            mw = int(56 * s)
            m = [(cx - mw, cy + 18)]
            for i in range(1, 11):
                x = cx - mw + 2 * mw * i / 11
                m.append((x, cy + 18 + (20 if i % 2 else 4)))
            m.append((cx + mw, cy + 18))
            d.polygon(jit(rnd, m, 1.5), fill=(255, 255, 255, 245))
            d.line(jit(rnd, m + m[:1], 1.5), fill=LINE, width=5, joint='curve')
        elif kind == 'mask_eyes':
            d.polygon(jit(rnd, [(cx - rx * .72, cy - 34), (cx + rx * .72, cy - 34), (cx + rx * .6, cy + 2), (cx - rx * .6, cy + 2)], 2), fill=c)
        elif kind == 'stripes':
            for k in (0, 1):
                st = [(cx - 56 + k * 38, top + 16), (cx - 26 + k * 38, top + 10), (cx - 34 + k * 38, top + 38), (cx - 62 + k * 38, top + 40)]
                d.polygon(jit(rnd, st, 1.5), fill=c)
        elif kind == 'spots':
            r2 = random.Random(rnd.random())
            for _ in range(4):
                px, py = cx + r2.uniform(-rx * .5, rx * .5), cy + r2.uniform(0, ry * .5)
                d.ellipse([px - 10 * s, py - 8 * s, px + 10 * s, py + 8 * s], fill=c)
        elif kind == 'belly_plate':
            d.polygon(blob(rnd, cx, cy + int(ry * .3), int(rx * .56), int(ry * .5), wob=0.04, n=36), fill=c)
            d.line(jit(rnd, blob(rnd, cx, cy + int(ry * .3), int(rx * .56), int(ry * .5), wob=0.04, n=36)), fill=LINE, width=4, joint='curve')
        elif kind == 'zzz':
            z = [(cx + rx * .7, top - 24), (cx + rx * .7 + 26, top - 24), (cx + rx * .7 + 2, top - 4), (cx + rx * .7 + 28, top - 4)]
            d.line(jit(rnd, z, 1.5), fill=LINE, width=5, joint='curve')
        elif kind == 'bandana':
            d.polygon(jit(rnd, [(cx - rx * .8, cy - 40), (cx + rx * .8, cy - 40), (cx + rx * .7, cy - 18), (cx - rx * .7, cy - 18)], 2), fill=c)
        elif kind == 'mustache':
            for sx in (-1, 1):
                d.arc([cx + sx * 30 - 24, cy + 14, cx + sx * 30 + 24, cy + 42], 200 if sx < 0 else 340, 20 if sx < 0 else 160, fill=LINE, width=6)

def draw_face(d, rnd, face, cx, cy):
    eyes = face.get('eyes', 'round')
    ey = cy - 22
    if eyes == 'round':
        for sx in (-1, 1):
            x = cx + sx * 34
            d.ellipse([x - 13, ey - 13, x + 13, ey + 13], fill=(255, 255, 255, 255), outline=LINE, width=5)
            d.ellipse([x - 6, ey - 5, x + 6, ey + 8], fill=LINE)
    elif eyes == 'dot':
        for sx in (-1, 1):
            x = cx + sx * 30
            d.ellipse([x - 7, ey - 7, x + 7, ey + 7], fill=LINE)
    elif eyes == 'sleepy':
        for sx in (-1, 1):
            x = cx + sx * 32
            d.line(jit(rnd, [(x - 13, ey), (x + 13, ey)], 1.5), fill=LINE, width=6)
    elif eyes == 'hollow':
        for sx, r in ((-1, 17), (1, 14)):
            x = cx + sx * 34
            d.ellipse([x - r, ey - r, x + r, ey + r], fill=LINE)
            d.ellipse([x - r * .3 + 3, ey - r * .45, x + r * .12 + 3, ey - r * .05], fill=(255, 255, 255, 235))
    else:   # fierce
        for sx in (-1, 1):
            x = cx + sx * 34
            d.ellipse([x - 12, ey - 12, x + 12, ey + 12], fill=(255, 255, 255, 255), outline=LINE, width=5)
            d.ellipse([x - 5, ey - 5, x + 5, ey + 7], fill=LINE)
            d.line(jit(rnd, [(x - 14, ey - 16), (x + 12, ey - 8)], 1.5), fill=LINE, width=6)
    mouth = face.get('mouth', 'smile')
    my = cy + 18
    if mouth == 'smile':
        d.arc([cx - 20, my - 8, cx + 20, my + 18], 15, 165, fill=LINE, width=6)
    elif mouth == 'o':
        d.ellipse([cx - 8, my - 2, cx + 8, my + 16], outline=LINE, width=5)
    elif mouth == 'zigzag':
        pts = [(cx - 22 + i * 11, my + (6 if i % 2 else 0)) for i in range(5)]
        d.line(jit(rnd, pts, 1.5), fill=LINE, width=5, joint='curve')
    elif mouth == 'fang':
        d.arc([cx - 22, my - 10, cx + 22, my + 14], 15, 165, fill=LINE, width=6)
        d.polygon([(cx - 10, my + 9), (cx - 4, my + 20), (cx + 1, my + 9)], fill=(255, 255, 255, 255), outline=LINE)
    # grin/none = 口なし(grin_teethパーツが口を担う)
    if face.get('cheeks'):
        cc = C(face.get('cheek_color', [240, 140, 140]), 160)
        for sx in (-1, 1):
            d.ellipse([cx + sx * 64 - 12, cy + 2, cx + sx * 64 + 12, cy + 20], fill=cc)

def render(spec, mega=False, mega_kind=''):
    name = spec['name']
    rnd = random.Random(int(hashlib.md5(name.encode()).hexdigest(), 16))
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    body = spec.get('body', {})
    c1 = C(body.get('color', [120, 120, 140]))
    belly = C(body.get('belly', list(lighten(c1)[:3])))
    shape = body.get('shape', 'round')
    cx, cy = SIZE // 2, SIZE // 2 + 22
    rx, ry = 104, 92
    wavy = False
    if shape == 'wide': rx, ry = 126, 88
    elif shape == 'tall': rx, ry, cy = 88, 112, SIZE // 2 + 10
    elif shape == 'serpent': rx, ry, cy = 84, 104, SIZE // 2 + 12
    elif shape == 'ghost': wavy = True; ry = 102
    elif shape == 'blocky': pass
    if mega:   # メガ: 金色オーラ
        aura = []
        for i in range(15):
            t = math.pi * 2 * i / 14
            r = (rx + 32) + (15 if i % 2 else 0)
            aura.append((cx + math.cos(t) * r, cy + math.sin(t) * r * .9))
        d.polygon(jit(rnd, aura, 3), fill=(255, 215, 120, 85))
        d.line(jit(rnd, aura + aura[:1], 3), fill=(255, 190, 80, 200), width=5, joint='curve')
    parts = spec.get('parts', [])
    for p in parts:
        draw_part(d, rnd, p.get('kind', ''), 'back', cx, cy, rx, ry, C(p.get('color', list(darken(c1)[:3]))), p.get('size', 'm'))
    if shape == 'serpent':   # ヘビ体型: 下に胴をうねらせる
        tailpts = []
        for i in range(22):
            t = i / 21
            tailpts.append((cx + math.sin(t * math.pi * 1.6) * 60 * (1 - t * .4), cy + ry - 16 + t * 56))
        d.line(jit(rnd, tailpts), fill=c1, width=34, joint='curve')
        d.line(jit(rnd, tailpts, 2), fill=LINE, width=5, joint='curve')
    bd = blob(rnd, cx, cy, rx, ry, wob=0.05 if shape != 'blocky' else 0.02, bottom_wavy=wavy)
    poly(d, rnd, bd, c1)
    d.polygon(blob(rnd, cx, cy + int(ry * .34), int(rx * .54), int(ry * .44), wob=0.07, n=40), fill=belly)
    for p in parts:
        draw_part(d, rnd, p.get('kind', ''), 'front', cx, cy, rx, ry, C(p.get('color', list(darken(c1)[:3]))), p.get('size', 'm'))
    face = spec.get('face', {})
    if mega and face.get('eyes') not in ('fierce', 'hollow'):
        face = dict(face, eyes='fierce')
    draw_face(d, rnd, face, cx, cy - 6)
    if mega_kind:
        d.text((cx + rx - 16, cy - ry - 8), mega_kind, fill=(255, 255, 255, 255))
    img.resize((OUT, OUT), Image.LANCZOS).save(os.path.join(DIR, f'{name}.png'))

specs = json.load(open(SPECS, encoding='utf-8'))
by_name = {s['name']: s for s in specs}
only = set(sys.argv[1:])
made = skipped = 0
for s in specs:
    if s['name'] in CURATED or (only and s['name'] not in only):
        continue
    mega = s['name'].startswith('メガ')
    mk = ''
    if mega and s['name'][-1] in 'XY':
        mk = s['name'][-1]
    try:
        render(s, mega=mega, mega_kind=mk)
        made += 1
    except Exception as e:
        print('ERROR', s['name'], e)
        skipped += 1
print(f'描画: {made}体 / 失敗: {skipped}')
