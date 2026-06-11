# テスト用ダミー3体の手描き風オリジナル画像を生成する(段106・v2)
# 完全オリジナル(既存ポケモンのデザインを参照しない)=公開サイトでも権利リスクなし。
# 実行: python3 tools/_gen_test_sprites.py  →  images/sim/テスト(みず).png 等を出力
# v2(2026-06-12 阿部さん): みず=もっとモンスター/さかなっぽく・ノーマル=人っぽく・ゴースト=もっとおばけっぽく
import math, random, os
from PIL import Image, ImageDraw

SIZE = 360
OUT = 180
DIR = os.path.join(os.path.dirname(__file__), '..', 'images', 'sim')
os.makedirs(DIR, exist_ok=True)
LINE = (45, 38, 60, 255)

def jit(points, seed, amp=2.5):
    rnd = random.Random(seed)
    return [(x + rnd.uniform(-amp, amp), y + rnd.uniform(-amp, amp)) for x, y in points]

def blob(cx, cy, rx, ry, seed, wob=0.06, n=72, bottom_wavy=False):
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, math.pi * 2) for _ in range(3)]
    pts = []
    for i in range(n):
        t = i / n * math.pi * 2
        w = 1 + wob * (math.sin(t * 3 + ph[0]) * .6 + math.sin(t * 5 + ph[1]) * .3 + math.sin(t * 8 + ph[2]) * .2)
        x, y = cx + math.cos(t) * rx * w, cy + math.sin(t) * ry * w
        if bottom_wavy and math.sin(t) > 0.3:
            y += math.sin(t * 9 + ph[0]) * ry * 0.16
        pts.append((x, y))
    return pts

def poly(d, pts, fill, seed=1, lw=7, line=LINE):
    d.polygon(pts, fill=fill)
    d.line(jit(pts + pts[:1], seed), fill=line, width=lw, joint='curve')

def eye(d, x, y, r, pupil=True, fierce=0):
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 255), outline=LINE, width=5)
    if pupil:
        d.ellipse([x - r * .45, y - r * .4, x + r * .45, y + r * .5], fill=LINE)
        d.ellipse([x - r * .1 + 2, y - r * .25, x + r * .25 + 2, y + r * .1], fill=(255, 255, 255, 240))
    if fierce:   # まゆ(モンスター感)
        d.line(jit([(x - r, y - r * 1.15), (x + r * .8, y - r * .55 * fierce)], 5, 1.5), fill=LINE, width=6)

def canvas():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def save(img, name):
    img.resize((OUT, OUT), Image.LANCZOS).save(os.path.join(DIR, name))
    print('saved', name)

# ── テスト(みず): さかなモンスター(背びれ・胸びれ・尾びれ・キバ) ──────
img, d = canvas()
cx, cy = SIZE // 2 - 10, SIZE // 2 + 16
BLUE, BLUED = (96, 140, 235, 255), (70, 105, 195, 255)
# 尾びれ(右後ろ)
tail = [(cx + 96, cy - 6), (cx + 178, cy - 64), (cx + 156, cy + 4), (cx + 182, cy + 66), (cx + 96, cy + 22)]
poly(d, jit(tail, 41, 2), BLUED, seed=42)
# 背びれ(ギザギザ3枚)
fin = [(cx - 70, cy - 86), (cx - 48, cy - 156), (cx - 26, cy - 92), (cx - 2, cy - 150), (cx + 22, cy - 90), (cx + 46, cy - 132), (cx + 62, cy - 80)]
poly(d, jit(fin, 43, 2), BLUED, seed=44)
# 体(横長のさかなボディ)
body = blob(cx, cy, 118, 92, seed=45, wob=0.05)
poly(d, body, BLUE, seed=46)
# 胸びれ(左右)
for sx in (-1, 1):
    f = [(cx + sx * 92, cy + 34), (cx + sx * 150, cy + 64), (cx + sx * 96, cy + 70)]
    poly(d, jit(f, 47 + sx, 2), BLUED, seed=48 + sx, lw=6)
# えら(2本)
for k in (0, 1):
    d.arc([cx - 88 + k * 14, cy - 26, cx - 48 + k * 14, cy + 36], 110, 250, fill=LINE, width=5)
# おなか
d.polygon(blob(cx, cy + 42, 64, 42, seed=49, wob=0.08), fill=(168, 205, 255, 255))
# 目(きりっと)+口(キバ)
eye(d, cx - 36, cy - 22, 17, fierce=0.9)
eye(d, cx + 40, cy - 22, 17, fierce=0.9)
mouth = [(cx - 30, cy + 26), (cx - 10, cy + 38), (cx + 12, cy + 28), (cx + 32, cy + 38)]
d.line(jit(mouth, 50, 1.5), fill=LINE, width=6, joint='curve')
d.polygon([(cx - 16, cy + 33), (cx - 8, cy + 47), (cx - 1, cy + 33)], fill=(255, 255, 255, 255), outline=LINE)  # キバ
save(img, 'テスト(みず).png')

# ── テスト(ノーマル): 人型のちびファイター(頭+体+手足・構えポーズ) ──────
img, d = canvas()
cx = SIZE // 2
hy, by = SIZE // 2 - 52, SIZE // 2 + 78     # 頭の中心 / 胴の中心
BEIGE, BEIGED = (218, 198, 158, 255), (188, 162, 118, 255)
# 脚(がに股に踏ん張る)
for sx in (-1, 1):
    leg = [(cx + sx * 22, by + 28), (cx + sx * 56, by + 86), (cx + sx * 86, by + 80), (cx + sx * 44, by + 16)]
    poly(d, jit(leg, 61 + sx, 2), BEIGED, seed=62 + sx, lw=6)
# 胴(小さめ)
poly(d, blob(cx, by, 62, 56, seed=63, wob=0.06), BEIGE, seed=64)
d.polygon(blob(cx, by + 12, 34, 28, seed=65, wob=0.1), fill=(245, 238, 220, 255))
# 腕(ファイティングポーズ=両こぶしを上げる)
for sx in (-1, 1):
    arm = [(cx + sx * 50, by - 18), (cx + sx * 108, by - 52), (cx + sx * 96, by - 20)]
    poly(d, jit(arm, 66 + sx, 2), BEIGED, seed=67 + sx, lw=6)
    fist = blob(cx + sx * 110, by - 56, 22, 20, seed=68 + sx, wob=0.1)
    poly(d, fist, BEIGE, seed=69 + sx, lw=6)
# 頭(大きめ=2頭身)+とんがり髪
hair = [(cx - 30, hy - 68), (cx - 8, hy - 118), (cx + 16, hy - 70), (cx + 34, hy - 104), (cx + 48, hy - 60)]
poly(d, jit(hair, 70, 2), BEIGED, seed=71, lw=6)
poly(d, blob(cx, hy, 84, 76, seed=72, wob=0.05), BEIGE, seed=73)
# 顔(やる気の目+にっ)
eye(d, cx - 30, hy - 6, 14, fierce=0.8)
eye(d, cx + 32, hy - 6, 14, fierce=0.8)
d.arc([cx - 24, hy + 14, cx + 24, hy + 46], 15, 165, fill=LINE, width=6)
for sx in (-1, 1):   # ほっぺ
    d.ellipse([cx + sx * 58 - 11, hy + 14, cx + sx * 58 + 11, hy + 30], fill=(235, 175, 150, 170))
save(img, 'テスト(ノーマル).png')

# ── テスト(ゴースト): ザ・おばけ(半透明・うつろな目・ベロ・しっぽ渦) ──────
img, d = canvas()
cx, cy = SIZE // 2, SIZE // 2 - 14
PUR, PURD = (140, 116, 205, 215), (108, 86, 170, 235)
# しっぽ(下にしゅるんと渦巻く)
tail = []
for i in range(26):
    t = i / 25
    ang = t * math.pi * 1.9
    r = 64 * (1 - t * 0.8)
    tail.append((cx + 26 + math.cos(ang + 2.2) * r * 0.7, cy + 118 + t * 56 + math.sin(ang) * r * 0.3))
d.line(jit(tail, 81, 2), fill=PURD, width=18, joint='curve')
d.line(jit(tail, 82, 2), fill=LINE, width=6, joint='curve')
# 体(縦長シーツ・裾おおきく波打つ)
body = blob(cx, cy, 92, 130, seed=83, wob=0.055, bottom_wavy=True)
poly(d, body, PUR, seed=84)
# 両手(ちいさな丸い手を「わー」と横に)
for sx in (-1, 1):
    hand = blob(cx + sx * 104, cy + 2, 26, 20, seed=85 + sx, wob=0.09)
    poly(d, hand, PUR, seed=86 + sx, lw=6)
# うつろな目(白目なしの黒丸+小さなハイライト)
for sx, r in ((-1, 20), (1, 16)):   # 左右で大きさを変える(おばけ感)
    x, y = cx + sx * 38, cy - 34
    d.ellipse([x - r, y - r, x + r, y + r], fill=LINE)
    d.ellipse([x - r * .3 + 3, y - r * .45, x + r * .15 + 3, y - r * .05], fill=(255, 255, 255, 235))
# 大きく開いた口(ぽかーん)+ベロ
d.ellipse([cx - 30, cy + 18, cx + 30, cy + 72], fill=(60, 40, 80, 255), outline=LINE, width=6)
d.ellipse([cx - 15, cy + 44, cx + 17, cy + 74], fill=(225, 110, 130, 255), outline=LINE, width=4)
save(img, 'テスト(ゴースト).png')

print('done')
