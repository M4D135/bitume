#!/usr/bin/env python3
"""PNG des prises -> JPEG du rapport, et zooms (sips) : python3 images.py dossier_avant dossier_apres sortie"""
import json, os, subprocess, sys, tempfile
av, ap, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
VUES = ['1-cockpit-fine', '2-poursuite-fine', '3-cockpit-moyenne', '4-exterieur-legere', '5-depart-grille', '6-tribune',
        '7-vue-haute', '8-poursuite-pluie', '9-cockpit-fine-volant', '10-voiture-34', '11-voiture-haut']
ZOOMS = {'zoom-a-poursuite-ombre': ('2-poursuite-fine', 440, 380, 360, 200, 2), 'zoom-b-cockpit-horizon': ('1-cockpit-fine', 0, 262, 640, 150, 2),
         'zoom-c-legere-contact': ('4-exterieur-legere', 300, 340, 460, 180, 2), 'zoom-d-arbres-loin': ('7-vue-haute', 0, 280, 460, 130, 2),
         'zoom-e-grille': ('5-depart-grille', 290, 380, 250, 200, 2), 'zoom-f-pluie-ombre': ('8-poursuite-pluie', 440, 380, 360, 200, 2),
         'zoom-g-cockpit-bras': ('9-cockpit-fine-volant', 700, 540, 320, 180, 3)}
def jpeg(src, dst, crop=None):
    t = tempfile.mktemp(suffix='.png')
    if crop:
        x, y, w, h, k = crop
        subprocess.run(['sips', '-c', str(h), str(w), '--cropOffset', str(y), str(x), src, '--out', t], check=True, capture_output=True)
        subprocess.run(['sips', '-z', str(h * k), str(w * k), t, '--out', t], check=True, capture_output=True)
        src = t
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '88', src, '--out', dst], check=True, capture_output=True)
    if os.path.exists(t): os.remove(t)
for v in VUES:
    for d, s in ((av, 'avant'), (ap, 'apres')):
        f = os.path.join(d, v + '.png')
        if os.path.exists(f): jpeg(f, os.path.join(out, f'{v}-{s}.jpg'))
for z, (v, x, y, w, h, k) in ZOOMS.items():
    for d, s in ((av, 'avant'), (ap, 'apres')):
        f = os.path.join(d, v + '.png')
        if os.path.exists(f): jpeg(f, os.path.join(out, f'{z}-{s}.jpg'), (x, y, w, h, k))
f = os.path.join(ap, '9-cockpit-fine-volant.png')
if os.path.exists(f): jpeg(f, os.path.join(out, 'zoom-h-casquette-tuile512.jpg'), (430, 470, 420, 100, 3))
print('ok', len(os.listdir(out)))
