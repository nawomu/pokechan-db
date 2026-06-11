# 実在ポケモン用の「ふざけた手描き風オリジナル絵」生成(段118)
# 方針(2026-06-12 阿部さん): 下手で全然OK・流用せずオリジナルの変わった絵(太っちょ/筋肉質など)で見せる。
# 実行: python3 tools/_gen_poke_sprites.py  →  images/sim/ピカチュウ.png 等
import math, random, os
from PIL import Image, ImageDraw

SIZE, OUT = 360, 180
DIR = os.path.join(os.path.dirname(__file__), '..', 'images', 'sim')
os.makedirs(DIR, exist_ok=True)
LINE = (45, 38, 60, 255)

def jit(points, seed, amp=2.5):
    rnd = random.Random(seed)
    return [(x + rnd.uniform(-amp, amp), y + rnd.uniform(-amp, amp)) for x, y in points]

def blob(cx, cy, rx, ry, seed, wob=0.06, n=72):
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, math.pi * 2) for _ in range(3)]
    pts = []
    for i in range(n):
        t = i / n * math.pi * 2
        w = 1 + wob * (math.sin(t * 3 + ph[0]) * .6 + math.sin(t * 5 + ph[1]) * .3 + math.sin(t * 8 + ph[2]) * .2)
        pts.append((cx + math.cos(t) * rx * w, cy + math.sin(t) * ry * w))
    return pts

def poly(d, pts, fill, seed=1, lw=7, line=LINE):
    d.polygon(pts, fill=fill)
    d.line(jit(pts + pts[:1], seed), fill=line, width=lw, joint='curve')

def canvas():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def save(img, name):
    img.resize((OUT, OUT), Image.LANCZOS).save(os.path.join(DIR, name))
    print('saved', name)

# ── ピカチュウ: 食べすぎた電気ねずみ(まんまる・ほっぺ・いなずましっぽ) ──────
img, d = canvas()
cx, cy = SIZE // 2, SIZE // 2 + 26
YEL, YELD = (250, 208, 60, 255), (225, 170, 30, 255)
# いなずましっぽ(背中から)
tail = [(cx + 86, cy - 10), (cx + 150, cy - 70), (cx + 122, cy - 64), (cx + 176, cy - 130), (cx + 196, cy - 96), (cx + 152, cy - 92), (cx + 178, cy - 40), (cx + 104, cy + 16)]
poly(d, jit(tail, 51, 2), YELD, seed=52, lw=6)
# 耳(先っぽ黒・食べすぎで垂れ気味)
for sx in (-1, 1):
    ear = [(cx + sx * 50, cy - 86), (cx + sx * 110, cy - 148), (cx + sx * 86, cy - 78)]
    poly(d, jit(ear, 53 + sx, 2), YEL, seed=54 + sx, lw=6)
    tip = [(cx + sx * 96, cy - 132), (cx + sx * 110, cy - 148), (cx + sx * 103, cy - 118)]
    d.polygon(jit(tip, 55 + sx, 1.5), fill=LINE)
# 体(どーんとまんまる=太っちょ)
poly(d, blob(cx, cy, 128, 108, seed=56, wob=0.045), YEL, seed=57)
# おなか(さらにまるい)
d.polygon(blob(cx, cy + 46, 78, 52, seed=58, wob=0.07), fill=(255, 232, 150, 255))
# 茶色のしま(背中側に2本)
for k in (0, 1):
    st = [(cx - 60 + k * 36, cy - 100), (cx - 30 + k * 36, cy - 106), (cx - 38 + k * 36, cy - 82), (cx - 66 + k * 36, cy - 78)]
    d.polygon(jit(st, 59 + k, 1.5), fill=(150, 100, 40, 220))
# 顔(満足げな細目+でか赤ほっぺ+への字…じゃなくてにっこり)
for sx in (-1, 1):
    d.arc([cx + sx * 44 - 14, cy - 32, cx + sx * 44 + 14, cy - 8], 200 if sx < 0 else 340, 340 if sx < 0 else 480, fill=LINE, width=6)  # 細目(満腹)
    d.ellipse([cx + sx * 84 - 22, cy - 4, cx + sx * 84 + 22, cy + 36], fill=(240, 90, 90, 235), outline=LINE, width=4)  # でかほっぺ
d.arc([cx - 18, cy - 14, cx + 18, cy + 12], 15, 165, fill=LINE, width=6)   # 口
# ちっちゃい手(おなかに届かない)
for sx in (-1, 1):
    h = blob(cx + sx * 96, cy + 56, 20, 14, seed=60 + sx, wob=0.1)
    poly(d, h, YEL, seed=61 + sx, lw=5)
save(img, 'ピカチュウ.png')

# ── カビゴン: 完全に寝てる(ZZZ・腹が山) ──────
img, d = canvas()
cx, cy = SIZE // 2, SIZE // 2 + 40
NAVY, CREAM = (60, 90, 120, 255), (240, 232, 210, 255)
# 体=山みたいな腹
poly(d, blob(cx, cy, 138, 100, seed=71, wob=0.04), NAVY, seed=72)
d.polygon(blob(cx, cy + 28, 104, 64, seed=73, wob=0.05), fill=CREAM)
# 顔(上のほう・寝てる)
d.polygon(blob(cx, cy - 58, 56, 34, seed=74, wob=0.06), fill=CREAM)
for sx in (-1, 1):
    d.line(jit([(cx + sx * 30 - 12, cy - 62), (cx + sx * 30 + 12, cy - 62)], 75 + sx, 1.5), fill=LINE, width=6)  # 寝目
    ear = [(cx + sx * 50, cy - 120), (cx + sx * 80, cy - 156), (cx + sx * 84, cy - 110)]
    poly(d, jit(ear, 76 + sx, 2), NAVY, seed=77 + sx, lw=6)
d.ellipse([cx - 8, cy - 50, cx + 8, cy - 36], outline=LINE, width=5)   # 口(いびき)
# 短い手足
for sx in (-1, 1):
    poly(d, blob(cx + sx * 124, cy + 6, 26, 20, seed=78 + sx, wob=0.1), CREAM, seed=79 + sx, lw=5)
    poly(d, blob(cx + sx * 84, cy + 92, 30, 18, seed=80 + sx, wob=0.1), CREAM, seed=81 + sx, lw=5)
# ZZZ
zf = [(cx + 90, cy - 130), (cx + 120, cy - 130), (cx + 92, cy - 106), (cx + 124, cy - 106)]
d.line(jit(zf, 82, 1.5), fill=LINE, width=6, joint='curve')
zf2 = [(x + 44, y - 28) for x, y in zf]
d.line(jit([(x, y) for x, y in zf2], 83, 1.5), fill=LINE, width=5, joint='curve')
save(img, 'カビゴン.png')

# ── ゲンガー: ニヤニヤがすぎる まんまるおばけ ──────
img, d = canvas()
cx, cy = SIZE // 2, SIZE // 2 + 16
PUR = (122, 92, 190, 255)
# トゲトゲ頭
spikes = []
n = 9
for i in range(n + 1):
    t = math.pi * (1 + i / n)
    r = 116 + (26 if i % 2 else 0)
    spikes.append((cx + math.cos(t) * r, cy + math.sin(t) * r * 0.92))
body = blob(cx, cy, 112, 100, seed=91, wob=0.05)
poly(d, body, PUR, seed=92)
d.polygon(jit(spikes, 93, 2), fill=PUR)
d.line(jit(spikes, 94, 2), fill=LINE, width=6, joint='curve')
# 目(つり上がった赤目)
for sx in (-1, 1):
    eye = [(cx + sx * 18, cy - 38), (cx + sx * 74, cy - 64), (cx + sx * 60, cy - 18)]
    d.polygon(jit(eye, 95 + sx, 1.5), fill=(235, 80, 80, 255))
    d.line(jit(eye + eye[:1], 96 + sx, 1.5), fill=LINE, width=5, joint='curve')
# ニヤァァ(ギザ歯のでか口)
mw, mh = 78, 30
mouth = [(cx - mw, cy + 18)]
teeth = 7
for i in range(1, teeth * 2):
    x = cx - mw + (2 * mw) * i / (teeth * 2)
    mouth.append((x, cy + 18 + (mh if i % 2 else 6)))
mouth.append((cx + mw, cy + 18))
d.polygon(jit(mouth, 97, 1.5), fill=(255, 255, 255, 245))
d.line(jit(mouth + mouth[:1], 98, 1.5), fill=LINE, width=5, joint='curve')
# 短い手
for sx in (-1, 1):
    poly(d, blob(cx + sx * 118, cy + 30, 24, 17, seed=99 + sx, wob=0.1), PUR, seed=100 + sx, lw=5)
save(img, 'ゲンガー.png')

print('done')
