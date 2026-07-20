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
      'Bb':[46,50,53],'A':[45,49,52]}
ROOT = {'Am':45,'F':41,'G':43,'Em':40,'E':40,'C':36,'Dm':38,'D':38,'FM':41,'Gm':31,'Bb':34,'A':45}
SCALES = {'minor':[0,2,3,5,7,8,10],'major':[0,2,4,5,7,9,11],'dorian':[0,2,3,5,7,9,10],'lydian':[0,2,4,6,7,9,11]}

# 曲定義: bpm/進行/スケール/主音/各パートのスタイル/密度
SONGS = {
    'battle':  {'bpm':165,'prog':['Am','F','G','Am','Am','F','G','Am','F','G','Em','Am','F','G','E','E'],
                'scale':'minor','tonic':69,'drum':'drive','bass':'pump','ch':'stab','lead':'run','mood':1.0},
    'lobby':   {'bpm':126,'prog':['FM','FM','G','G','Am','Am','G','G','FM','G','Am','Am','FM','G','C','C'],
                'scale':'lydian','tonic':65,'drum':'sparse','bass':'off','ch':'pad','lead':'calm','mood':0.75},
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
    BEATS = 64; buf = [0.0] * int(BEATS * SPB * SR + SR)
    prog = S['prog']; g = S['mood']

    def add_note(pitch, sb, db, vel, kind, gain, detune=0.0):
        f = midi_hz(pitch) * (2 ** (detune / 1200.0))
        n = int(db * SPB * SR); i0 = int(sb * SPB * SR)
        amp = (vel/127.0)*gain; ph = 0.0; dph = f/SR
        for i in range(n):
            e = env(i/SR, db*SPB)
            if e > 0:
                idx = i0 + i
                if idx < len(buf): buf[idx] += osc(kind, ph)*e*amp
            ph += dph
    def add_kick(sb, vel, gain=0.95):
        n = int(0.16*SR); i0 = int(sb*SPB*SR); amp=(vel/127.0)*gain
        for i in range(n):
            t=i/SR; f=120*math.exp(-t*30)+45; e=math.exp(-t*14); idx=i0+i
            if idx<len(buf): buf[idx]+=math.sin(2*math.pi*f*t)*e*amp
    def add_perc(sb, db, vel, gain, tone):
        random.seed(int(sb*1000)+vel); n=int(db*SPB*SR); i0=int(sb*SPB*SR); amp=(vel/127.0)*gain
        for i in range(n):
            e=math.exp(-(i/SR)*(35.0/tone)); idx=i0+i
            if idx<len(buf): buf[idx]+=(random.random()*2-1)*e*amp

    # Drums
    for b in range(BEATS):
        if S['drum']=='drive': add_kick(b, 108 if b%2==0 else 100); (add_perc(b,0.14,100,0.5,2.5) if b%2==1 else None)
        elif S['drum']=='four': add_kick(b,106); (add_perc(b,0.14,98,0.45,2.5) if b%4==2 else None)
        elif S['drum']=='sparse':
            if b%2==0: add_kick(b,96,0.7)
            if b%4==2: add_perc(b,0.14,88,0.35,2.5)
    hat_g = 0.18*g
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

    # Lead
    sc=SCALES[S['scale']]; tonic=S['tonic']
    def deg(o,d): return tonic+12*o+sc[d%7]+12*(d//7)
    for ph in range(8):
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

    peak=max(abs(x) for x in buf) or 1.0; norm=0.85/peak
    with wave.open(out,'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        fr=bytearray()
        for x in buf: fr+=struct.pack('<h',int(max(-1,min(1,x*norm))*32767))
        w.writeframes(fr)
    print("WROTE",out,key,"%.1fs"%(len(buf)/SR))

if __name__=='__main__':
    render(sys.argv[1], sys.argv[2])
