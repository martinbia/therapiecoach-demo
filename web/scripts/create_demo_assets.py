"""Generate wholly fictional, clearly labeled demonstration assets; no clinical training instructions."""
from pathlib import Path
import math
import subprocess
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4

ROOT = Path(__file__).resolve().parent.parent / 'public'
for d in ('docs', 'videos', 'posters', 'icons'):
    (ROOT / d).mkdir(parents=True, exist_ok=True)
font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

icon = '''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" rx="118" fill="#16474d"/>
<circle cx="256" cy="250" r="153" fill="#2d6c6b"/>
<text x="157" y="341" font-family="DejaVu Sans,Arial,sans-serif" font-size="275" font-weight="700" fill="white">a</text>
<circle cx="377" cy="319" r="24" fill="#eeae7a"/>
</svg>'''
(ROOT / 'icons/icon.svg').write_text(icon, encoding='utf-8')
try:
    import cairosvg
    for side in (192, 512):
        cairosvg.svg2png(bytestring=icon.encode(), write_to=str(ROOT / f'icons/icon-{side}.png'), output_width=side, output_height=side)
except ImportError:
    for side in (192,512):
        im=Image.new('RGB',(side,side),'#16474d'); d=ImageDraw.Draw(im); ft=ImageFont.truetype(bold_path,int(side*.62)); d.text((side*.26, side*.11),'a',font=ft,fill='white'); im.save(ROOT/f'icons/icon-{side}.png')

for slug, title, subtitle in [('stairs','Treppen','Symbolische Bewegung'),('chair','Stuhl','Symbolische Bewegung')]:
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
<rect width="960" height="540" fill="#16474d"/><circle cx="815" cy="55" r="200" fill="#245e64"/>
<rect x="60" y="66" rx="18" width="245" height="53" fill="#d9efc0"/><text x="83" y="101" fill="#194c45" font-family="Arial" font-size="24" font-weight="700">FIKTIVES DEMO</text>
<text x="60" y="282" fill="#fff" font-family="Arial" font-size="86" font-weight="bold">{title}</text>
<text x="65" y="353" fill="#d5e7e5" font-family="Arial" font-size="32">{subtitle}</text>
<text x="65" y="475" fill="#d1e3e0" font-family="Arial" font-size="23">Keine Therapieanleitung · Play ▶</text></svg>'''
    (ROOT / f'posters/{slug}.svg').write_text(svg, encoding='utf-8')

W,H=A4
for name,title,paragraphs in [
    ('treppen-demo.pdf','Beispielthema: Treppensteigen',[
      'Dieses fiktive Merkblatt illustriert, wie ein Informationsdokument',
      'in der Demo-App dargestellt werden kann.',
      'Die passenden Bewegungsablaeufe haengen von individuellen Voraussetzungen ab.',
      'Bespreche persoenliche Fragen mit einer qualifizierten Fachperson.',
      'Hier sind keine Trainingsvorgaben, Belastungsgrenzen oder Verordnungen enthalten.']),
    ('stuhl-demo.pdf','Beispielthema: Aufstehen vom Stuhl',[
      'Dieses fiktive Merkblatt ist ausschliesslich Anschauungsmaterial.',
      'Ein Therapieteam kann passende Alltagsbewegungen individuell besprechen.',
      'Die hier gezeigte App erfasst keine realen Therapiedaten.',
      'Keiner der Platzhalter ersetzt eine medizinische oder physiotherapeutische',
      'Beratung bzw. eine Anleitung durch Fachpersonen.'])
]:
    c=canvas.Canvas(str(ROOT/'docs'/name),pagesize=A4)
    c.setFillColor(HexColor('#16474d'));c.rect(0,H-172,W,172,fill=1,stroke=0)
    c.setFillColor(HexColor('#d8eabe'));c.setFont('Helvetica-Bold',12);c.drawString(48,H-53,'ANNA · THERAPIECOACH · DEMO')
    c.setFillColor(HexColor('#ffffff'));c.setFont('Helvetica-Bold',22);c.drawString(48,H-106,title)
    c.setFillColor(HexColor('#cfe4dd'));c.setFont('Helvetica',11);c.drawString(48,H-136,'Fiktive Informationen · kein medizinisches Dokument')
    c.setFillColor(HexColor('#214b4c'));c.setFont('Helvetica-Bold',15);c.drawString(48,H-222,'Worum geht es?')
    c.setFont('Helvetica',11)
    for i,line in enumerate(paragraphs): c.drawString(48,H-260-i*24,line)
    c.setFillColor(HexColor('#f1f7f0')); c.roundRect(48,150,W-96,105,12,stroke=0,fill=1)
    c.setFillColor(HexColor('#214b4c'));c.setFont('Helvetica-Bold',12);c.drawString(65,216,'Hinweis zur Verwendung')
    c.setFont('Helvetica',10);c.drawString(65,192,'Dieses Dokument ist nur fuer technische Vorfuehrungen bestimmt.')
    c.drawString(65,174,'Es enthaelt keine individuellen Therapieempfehlungen.')
    c.setFont('Helvetica',9);c.drawString(48,45,'Musterinhalt · Version 1.0 · 02.11.2026')
    c.showPage(); c.save()

FPS=15
DURATION=6
font_b=ImageFont.truetype(bold_path,44)
font_s=ImageFont.truetype(font_path,23)
font_m=ImageFont.truetype(bold_path,26)
for slug,label in [('stairs','Treppen'),('chair','Stuhl')]:
    path = str(ROOT/f'videos/{slug}-demo.mp4')
    cmd = ['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24',
           '-s','720x404','-r',str(FPS),'-i','-','-c:v','libx264','-preset','veryfast',
           '-crf','30','-pix_fmt','yuv420p','-movflags','+faststart','-an',path]
    process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    for frame in range(FPS*DURATION):
        t=frame/FPS
        im=Image.new('RGB',(720,404),'#16474d')
        d=ImageDraw.Draw(im)
        d.ellipse((475,-130,830,225),fill='#245e64')
        d.rounded_rectangle((36,30,248,73),radius=12,fill='#d9efc0')
        d.text((50,37),'FIKTIVE DEMO',font=font_s,fill='#16474d')
        d.text((40,107),label,font=font_b,fill='#ffffff')
        d.text((42,161),'Illustrative Animation',font=font_s,fill='#dce9e5')
        if slug=='stairs':
            for i in range(4):
                x=390+i*67; y=310-i*33
                d.rectangle((x,y,455+i*67,343),fill='#8ebdb6',outline='#8ebdb6',width=3)
            phase=(math.sin(t*2.6)+1)/2
            x=385+phase*164; y=280-phase*81
            d.ellipse((x-18,y-73,x+18,y-37),fill='#d9efc0')
            d.line((x,y-35,x,y+13),fill='#f4f4e7',width=9)
            d.line((x,y+9,x-22,y+33),fill='#f4f4e7',width=7)
            d.line((x,y+9,x+18,y+30),fill='#f4f4e7',width=7)
        else:
            d.rounded_rectangle((442,264,585,278),radius=5,fill='#9ac8c0')
            d.rounded_rectangle((462,276,478,355),radius=5,fill='#9ac8c0')
            d.rounded_rectangle((557,276,573,355),radius=5,fill='#9ac8c0')
            d.rounded_rectangle((570,197,584,275),radius=5,fill='#9ac8c0')
            phase=(math.sin(t*1.8)+1)/2
            x=500-30*phase;y=246-50*phase
            d.ellipse((x-20,y-104,x+20,y-64),fill='#d9efc0')
            d.line((x,y-60,x+14,y-7),fill='#f4f4e7',width=11)
            d.line((x+14,y-7,x+51,y+13),fill='#f4f4e7',width=9)
            d.line((x+14,y-7,x-23,y+19),fill='#f4f4e7',width=9)
        d.rounded_rectangle((28,356,692,392),radius=8,fill='#f7e8cc')
        d.text((45,361),'Nur Anschauung – keine Therapieanleitung',font=font_s,fill='#4d4d3e')
        assert process.stdin is not None
        process.stdin.write(im.tobytes())
    assert process.stdin is not None
    process.stdin.close()
    if process.wait()!=0: raise RuntimeError('Failed to generate '+path)
    print(path, Path(path).stat().st_size)
