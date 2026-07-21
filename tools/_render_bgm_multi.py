#!/usr/bin/env python3
# 依存ゼロのチップチューン風レンダラ(複数曲・サイトBGM用)。標準lib(wave/struct/math)のみ。
# 使い方: python3 render_bgm_multi.py <song_key> <out.wav>
import wave, struct, math, sys, random

SR = 44100

def midi_hz(p): return 440.0 * (2 ** ((p - 69) / 12.0))
def env(t, dur, a=0.005, d=0.03, s=0.7, r=0.04):
    if t < a: return t / a
    if t < a + d: return 1 - (1 - s) * (t - a) / d
    if t < dur - r: return s
    if t < dur: return s * (1 - (t - (dur - r)) / r)
    return 0.0
def osc(kind, phase):
    x = phase % 1.0
    if kind == 'square': return 1.0 if x < 0.5 else -1.0
    if kind == 'pulse25': return 1.0 if x < 0.25 else -1.0
    if kind == 'pulse12': return 1.0 if x < 0.125 else -1.0
    if kind == 'saw': return 2.0 * x - 1.0
    if kind == 'tri': return 4 * x - 1 if x < 0.5 else 3 - 4 * x
    if kind == 'sine': return math.sin(2 * math.pi * phase)
    return 0.0

CH = {'Am':[57,60,64],'F':[53,57,60],'G':[55,59,62],'Em':[52,55,59],'E':[52,56,59],
      'C':[48,52,55],'Dm':[50,53,57],'D':[50,54,57],'FM':[53,57,60],'Gm':[43,46,50],
      'Bb':[46,50,53],'A':[45,49,52],
      # 7thコード(ボサノバ/ラウンジ用・2026-07-21)
      'CM7':[48,52,55,59],'Dm7':[50,53,57,60],'Em7':[52,55,59,62],
      'FM7':[53,57,60,64],'G7':[55,59,62,65],'Am7':[57,60,64,67]}
ROOT = {'Am':45,'F':41,'G':43,'Em':40,'E':40,'C':36,'Dm':38,'D':38,'FM':41,'Gm':31,'Bb':34,'A':45,
        'CM7':36,'Dm7':38,'Em7':40,'FM7':41,'G7':43,'Am7':45}
SCALES = {'minor':[0,2,3,5,7,8,10],'major':[0,2,4,5,7,9,11],'dorian':[0,2,3,5,7,9,10],'lydian':[0,2,4,6,7,9,11]}

# 曲定義: bpm/進行/スケール/主音/各パートのスタイル/密度
SONGS = {
    'battle':  {'bpm':165,'prog':['Am','F','G','Am','Am','F','G','Am','F','G','Em','Am','F','G','E','E'],
                'scale':'minor','tonic':69,'drum':'drive','bass':'pump','ch':'stab','lead':'run','mood':1.0},
    # lobby: カフェ/ラウンジ/ボサノバ風(2026-07-21 阿部さんFB第2弾。maj7コード・シンコペベース・リムクリック・まったり)
    'lobby':   {'bpm':80,'prog':['CM7','CM7','Dm7','G7','Em7','Am7','Dm7','G7','FM7','Em7','Dm7','CM7'],'beats':48,
                'scale':'major','tonic':60,'drum':'bossa','bass':'bossa','ch':'bossa','lead':'bossa','mood':0.6},
    # versus: 選出画面=「これから始まるぜ」の対戦前緊張(2026-07-21 阿部さん)。マイナー・駆け上がりアンセム
    'versus':  {'bpm':152,'prog':['Am','Am','F','G','Am','Am','F','E','Am','F','G','E'],'beats':48,
                'scale':'minor','tonic':69,'drum':'four','bass':'pump','ch':'pulse','lead':'anthem','mood':0.9},
    # lose: 敗北後(2026-07-21 阿部さん)。しんみりしすぎない・静かな余韻(マイナー・ゆっくり・打楽器最小)
    'lose':    {'bpm':80,'prog':['Am','F','C','G','Am','F','E','E'],'beats':32,
                'scale':'minor','tonic':69,'drum':'lull','bass':'soft','ch':'pad','lead':'calm','mood':0.5},
    'select':  {'bpm':140,'prog':['C','G','Am','F','C','G','F','C','F','G','C','Am','F','G','C','C'],
                'scale':'major','tonic':72,'drum':'four','bass':'off','ch':'pulse','lead':'calm','mood':0.85},
    'champion':{'bpm':150,'prog':['G','D','Em','C','G','D','C','G','C','D','G','Em','C','D','G','G'],
                'scale':'major','tonic':67,'drum':'four','bass':'pump','ch':'stab','lead':'anthem','mood':0.95},
    'final':   {'bpm':172,'prog':['Am','Am','F','G','Am','Am','F','E','F','G','Em','Am','F','G','E','E'],
                'scale':'minor','tonic':69,'drum':'drive','bass':'pump','ch':'stab','lead':'run','mood':1.0},
}

def render(key, out):
    S = SONGS[key]
    BPM = S['bpm']; SPB = 60.0 / BPM
    BEATS = S.get('beats', 64)
    # ★ループレンダー(2026-07-21): バッファ長=曲長ぴったり。曲末をはみ出す余韻は
    #   先頭へ巻き込む(idx % LOOP)ことで、末尾無音ゼロ=どこで繋いでも継ぎ目なし。
    #   (旧実装は +1秒 の余韻領域が末尾無音として曲に残り、ループ毎に「一回止まる」原因だった)
    LOOP = int(BEATS * SPB * SR); buf = [0.0] * LOOP
    prog = S['prog']; g = S['mood']

    def add_note(pitch, sb, db, vel, kind, gain, detune=0.0):
        f = midi_hz(pitch) * (2 ** (detune / 1200.0))
        n = int(db * SPB * SR); i0 = int(sb * SPB * SR)
        amp = (vel/127.0)*gain; ph = 0.0; dph = f/SR
        for i in range(n):
            e = env(i/SR, db*SPB)
            if e > 0:
                buf[(i0 + i) % LOOP] += osc(kind, ph)*e*amp
            ph += dph
    def add_kick(sb, vel, gain=0.95):
        n = int(0.16*SR); i0 = int(sb*SPB*SR); amp=(vel/127.0)*gain
        for i in range(n):
            t=i/SR; f=120*math.exp(-t*30)+45; e=math.exp(-t*14)
            buf[(i0+i) % LOOP]+=math.sin(2*math.pi*f*t)*e*amp
    def add_perc(sb, db, vel, gain, tone):
        random.seed(int(sb*1000)+vel); n=int(db*SPB*SR); i0=int(sb*SPB*SR); amp=(vel/127.0)*gain
        for i in range(n):
            e=math.exp(-(i/SR)*(35.0/tone))
            buf[(i0+i) % LOOP]+=(random.random()*2-1)*e*amp

    # Drums
    for b in range(BEATS):
        if S['drum']=='drive': add_kick(b, 108 if b%2==0 else 100); (add_perc(b,0.14,100,0.5,2.5) if b%2==1 else None)
        elif S['drum']=='four': add_kick(b,106); (add_perc(b,0.14,98,0.45,2.5) if b%4==2 else None)
        elif S['drum']=='sparse':
            if b%2==0: add_kick(b,96,0.7)
            if b%4==2: add_perc(b,0.14,88,0.35,2.5)
        elif S['drum']=='lull':
            # ほのぼの: 小節頭にごく柔らかいキックだけ(ハイハット無し)
            if b%4==0: add_kick(b,72,0.4)
        elif S['drum']=='bossa':
            # ボサノバ: リムクリック風の短いティック(クラーベ的配置)+小節頭ソフトキック
            if b%4==0: add_kick(b,64,0.32)
            for off in [0,1.5,2.5]:
                if b%4==0: add_perc(b+off,0.03,60,0.10,1.2)
    hat_g = 0.18*g
    if S['drum'] not in ('lull','bossa'):
        step = 1.0 if S['drum']=='sparse' else 0.5
        t = 0.5
        while t < BEATS:
            add_perc(t,0.05,70,hat_g,6.0); t += step

    # Bass
    for bar,ch in enumerate(prog):
        root=ROOT[ch]; t0=bar*4
        if S['bass']=='pump':
            for i in range(8): add_note(root+(12 if i==7 else 0), t0+i*0.5, 0.45, 106 if i==0 else 92,'saw',0.22)
        elif S['bass']=='off':
            add_note(root,t0,0.7,104,'tri',0.2)
            for off in [1.5,2.5,3.5]: add_note(root,t0+off,0.4,92,'tri',0.18)
        elif S['bass']=='soft':
            # ほのぼの: 全音符主体のやわらかい低音(サイン)
            add_note(root,t0,3.6,88,'sine',0.22)
            add_note(root+7,t0+2,1.6,72,'sine',0.12)
        elif S['bass']=='bossa':
            # ボサノバ: ルート→5度のシンコペ(付点のノリ・サイン)
            add_note(root,t0,1.3,92,'sine',0.24)
            add_note(root+7,t0+1.5,0.4,78,'sine',0.18)
            add_note(root,t0+2,1.3,88,'sine',0.22)
            add_note(root+7,t0+3.5,0.4,80,'sine',0.18)

    # Chords
    for bar,ch in enumerate(prog):
        t0=bar*4; v=CH[ch]
        if S['ch']=='stab':
            for p in v: add_note(p,t0,2.0,78,'square',0.05); add_note(p,t0+2.5,1.0,70,'square',0.05)
        elif S['ch']=='pad':
            for p in v: add_note(p,t0,3.8,72,'tri',0.06)
        elif S['ch']=='pulse':
            for i in range(8):
                if i not in (3,7):
                    for p in v: add_note(p+12,t0+i*0.5,0.3,74 if i%2 else 84,'square',0.04)
        elif S['ch']=='bossa':
            # ボサノバ: ギターコンピング風のシンコペ刻み(裏拍・短め・トライアングルで柔らかく)
            for off,vel in [(0.75,70),(2.5,76),(3.25,64)]:
                for p in v: add_note(p+12,t0+off,0.55,vel,'tri',0.045)

    # Lead
    sc=SCALES[S['scale']]; tonic=S['tonic']
    def deg(o,d): return tonic+12*o+sc[d%7]+12*(d//7)
    for ph in range(BEATS//8):
        t0=ph*8
        if S['lead']=='run':
            shape=[0,2,4,4,3,2,4,5]
            for i in range(8): add_note(deg(0,shape[i]+(2 if ph%4==3 else 0)),t0+i*0.25,0.22,100,'pulse25',0.16*g,detune=3)
            add_note(deg(0,4+(ph%3)),t0+2,1.8,108,'pulse25',0.16*g)
            add_note(deg(0,2+(ph%2)),t0+4,1.4,100,'square',0.15*g)
            add_note(deg(0,5 if ph%2 else 3),t0+5.5,0.45,100,'pulse25',0.16*g)
            add_note(deg(0,4 if ph%2 else 2),t0+6,1.9,104,'square',0.15*g)
        elif S['lead']=='anthem':
            add_note(deg(0,0+ph%2),t0,1.4,104,'square',0.15*g); add_note(deg(0,2+ph%2),t0+1.5,0.45,100,'pulse25',0.15*g)
            add_note(deg(0,4),t0+2,1.9,110,'pulse25',0.16*g); add_note(deg(0,3),t0+4,0.95,100,'square',0.14*g)
            add_note(deg(0,2),t0+5,0.95,98,'square',0.14*g); add_note(deg(0,7 if ph%4==3 else 4),t0+6,1.9,108,'pulse25',0.16*g)
        elif S['lead']=='calm':
            seq=[0,2,4,2,5,4]
            for i,d in enumerate(seq): add_note(deg(0,d+(ph%2)),t0+i*1.25,0.9,84,'tri',0.14*g)
            add_note(deg(0,4),t0+7.5,0.5,80,'tri',0.13*g)
        elif S['lead']=='bossa':
            # ボサノバ: まったりした裏拍始まりの短いフレーズ+長い休符(サイン・狭い音域)
            pats=[[(0.5,4,1.2),(2.0,5,0.8),(3.0,4,1.6)],
                  [(0.5,2,1.2),(2.0,4,0.8),(3.0,2,1.6)],
                  [(1.0,0,1.6),(3.0,1,1.2)],
                  [(0.5,4,0.8),(1.5,5,0.8),(2.5,7,2.0)]]
            seq=pats[ph%4]
            for off,d,dur in seq:
                add_note(deg(0,d),t0+off,dur,64,'sine',0.15*g)
                add_note(deg(0,d),t0+off,dur*0.5,40,'tri',0.04*g)
            if ph%2==1:
                for off,d,dur in seq:
                    add_note(deg(0,d),t0+4+off,dur,58,'sine',0.13*g)
        elif S['lead']=='lullaby':
            # ほのぼの: ゆったり長い音符・小さな起伏・オルゴール風(サイン+薄いトライアングル重ね)
            seq=[(0,2.0),(2,1.5),(4,2.5),(2,2.0),(1,1.5),(0,2.5),(2,2.0),(4,1.5),(5,2.5),(4,2.0),(2,1.5),(0,2.5)]
            tt=t0; k=ph%2
            for d,dur in seq:
                if tt-t0 >= 8: break
                add_note(deg(0,d+k),tt,dur*0.95,68,'sine',0.16*g)
                add_note(deg(1,d+k),tt,dur*0.6,46,'tri',0.05*g)
                tt += dur*0.67

    peak=max(abs(x) for x in buf) or 1.0; norm=0.85/peak
    with wave.open(out,'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        fr=bytearray()
        for x in buf: fr+=struct.pack('<h',int(max(-1,min(1,x*norm))*32767))
        w.writeframes(fr)
    print("WROTE",out,key,"%.1fs"%(len(buf)/SR))

if __name__=='__main__':
    render(sys.argv[1], sys.argv[2])
