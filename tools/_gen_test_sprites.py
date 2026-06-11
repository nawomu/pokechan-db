# テスト用ダミー3体の手描き風オリジナル画像を生成する(段106)
# 完全オリジナル(既存ポケモンのデザインを参照しない)=公開サイトでも権利リスクなし。
# 実行: python3 tools/_gen_test_sprites.py  →  images/sim/テスト(みず).png 等を出力
# 手描き感: 輪郭を細かい線分+ジッターで描く(seed固定=再現可能)
import math, random, os
from PIL import Image, ImageDraw

SIZE = 360            # 高解像度で描いて縮小(線のガタつきがなめらかな手描き風になる)
OUT = 180
DIR = os.path.join(os.path.dirname(__file__), '..', 'images', 'sim')
os.makedirs(DIR, exist_ok=True)

def jitter_path(points, seed, amp=2.5):
    rnd = random.Random(seed)
    return [(x + rnd.uniform(-amp, amp), y + rnd.uniform(-amp, amp)) for x, y in points]

def blob_points(cx, cy, rx, ry, seed, wob=0.07, n=72, bottom_wavy=False):
    """円をラジアルノイズで揺らした「ゆるい」輪郭。bottom_wavy=おばけの裾"""
    rnd = random.Random(seed)
    phases = [rnd.uniform(0, math.pi * 2) for _ in range(3)]
    pts = []
    for i in range(n):
        t = i / n * math.pi * 2
        w = 1 + wob * (math.sin(t * 3 + phases[0]) * 0.6 + math.sin(t * 5 + phases[1]) * 0.3 + math.sin(t * 8 + phases[2]) * 0.2)
        x, y = cx + math.cos(t) * rx * w, cy + math.sin(t) * ry * w
        if bottom_wavy and math.sin(t) > 0.35:     # 下側だけ大きい波(おばけの裾)
            y += math.sin(t * 7 + phases[0]) * ry * 0.13
        pts.append((x, y))
    return pts

def draw_blob(d, pts, fill, line=(45, 38, 60, 255), lw=7, seed=1):
    d.polygon(pts, fill=fill)
    jp = jitter_path(pts + pts[:1], seed)
    d.line(jp, fill=line, width=lw, joint='curve')

def eyes_mouth(d, cx, cy, dx=34, ey=-12, er=11, mouth='smile', seed=1, line=(45, 38, 60, 255)):
    for sx in (-1, 1):
        d.ellipse([cx + sx * dx - er, cy + ey - er, cx + sx * dx + er, cy + ey + er], fill=line)
        d.ellipse([cx + sx * dx - er * .35 + 3, cy + ey - er * .5, cx + sx * dx + er * .35 + 3, cy + ey - er * .5 + er * .7], fill=(255, 255, 255, 230))
    if mouth == 'smile':
        d.arc([cx - 22, cy + 8, cx + 22, cy + 40], 20, 160, fill=line, width=6)
    elif mouth == 'o':
        d.ellipse([cx - 9, cy + 16, cx + 9, cy + 34], outline=line, width=6)
    elif mouth == 'w':   # ジグザグ口(おばけ)
        pts = [(cx - 26 + i * 13, cy + 24 + (7 if i % 2 else -2)) for i in range(5)]
        d.line(jitter_path(pts, seed, 1.5), fill=line, width=6, joint='curve')

def canvas():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def save(img, name):
    img = img.resize((OUT, OUT), Image.LANCZOS)
    p = os.path.join(DIR, name)
    img.save(p)
    print('saved', p)

LINE = (45, 38, 60, 255)

# ── テスト(みず): しずく型のあおいゆるキャラ ──────────────────
img, d = canvas()
cx, cy = SIZE // 2, SIZE // 2 + 26
body = blob_points(cx, cy, 118, 104, seed=11, wob=0.06)
# 頭のしずくツノ
drop = [(cx - 26, cy - 92), (cx - 4, cy - 168), (cx + 30, cy - 96)]
d.polygon(jitter_path(drop, 12, 2), fill=(104, 144, 240, 255))
d.line(jitter_path(drop + drop[:1], 13, 2.5), fill=LINE, width=7, joint='curve')
draw_blob(d, body, fill=(104, 144, 240, 255), seed=14)
# おなかの水色
belly = blob_points(cx, cy + 36, 62, 50, seed=15, wob=0.08)
d.polygon(belly, fill=(168, 200, 255, 255))
eyes_mouth(d, cx, cy - 8, mouth='smile', seed=16)
# ほっぺ
for sx in (-1, 1):
    d.ellipse([cx + sx * 66 - 13, cy + 8, cx + sx * 66 + 13, cy + 26], fill=(150, 190, 255, 180))
save(img, 'テスト(みず).png')

# ── テスト(ノーマル): まるい きなり色のゆるキャラ(耳つき) ──────
img, d = canvas()
cx, cy = SIZE // 2, SIZE // 2 + 30
# 耳(輪郭の下に描く)
for sx in (-1, 1):
    ear = [(cx + sx * 56, cy - 86), (cx + sx * 96, cy - 156), (cx + sx * 22, cy - 110)]
    d.polygon(jitter_path(ear, 21 + sx, 2), fill=(216, 200, 160, 255))
    d.line(jitter_path(ear + ear[:1], 22 + sx, 2.5), fill=LINE, width=7, joint='curve')
body = blob_points(cx, cy, 120, 102, seed=23, wob=0.05)
draw_blob(d, body, fill=(216, 200, 160, 255), seed=24)
belly = blob_points(cx, cy + 38, 64, 48, seed=25, wob=0.08)
d.polygon(belly, fill=(245, 238, 220, 255))
eyes_mouth(d, cx, cy - 6, mouth='o', seed=26)
# ひげ
for sx in (-1, 1):
    for k in (-1, 0, 1):
        pts = [(cx + sx * 80, cy + 6 + k * 12), (cx + sx * 130, cy + k * 18)]
        d.line(jitter_path(pts, 27 + k, 2), fill=LINE, width=5)
save(img, 'テスト(ノーマル).png')

# ── テスト(ゴースト): むらさきのおばけ(裾ゆらゆら) ─────────────
img, d = canvas()
cx, cy = SIZE // 2, SIZE // 2 + 10
body = blob_points(cx, cy, 112, 118, seed=31, wob=0.07, bottom_wavy=True)
draw_blob(d, body, fill=(136, 112, 200, 255), seed=34)
# あたまの先っぽ(ぴょこん)
tip = [(cx - 18, cy - 110), (cx + 8, cy - 162), (cx + 30, cy - 104)]
d.polygon(jitter_path(tip, 32, 2), fill=(136, 112, 200, 255))
d.line(jitter_path(tip + tip[:1], 33, 2.5), fill=LINE, width=7, joint='curve')
eyes_mouth(d, cx, cy - 14, dx=38, er=13, mouth='w', seed=36)
# 半透明の手
for sx in (-1, 1):
    hand = blob_points(cx + sx * 118, cy + 22, 30, 22, seed=37 + sx, wob=0.1)
    d.polygon(hand, fill=(136, 112, 200, 235))
    d.line(jitter_path(hand + hand[:1], 38 + sx, 2), fill=LINE, width=6, joint='curve')
save(img, 'テスト(ゴースト).png')

print('done')
