#!/usr/bin/env python3
"""Résumé de allocations-page.mjs : python3 resume.py a.json b.json ... (octets par image, fonctions photo* et total)"""
import json, sys
for f in sys.argv[1:]:
    try: v = json.load(open(f))['valeur']
    except Exception as e: print(f, 'illisible', e); continue
    fo = v['fonctions']; photo = [(k, x) for k, x in fo if k.startswith('photo')]
    print(f"{f}: moteur {v['moteur']} {v['toile']} images {v['images']} créations {v['creations']-v['creationsAvant']} ; total {v['octetsParImage']} o/image ; "
          f"photo* {round(sum(x for _, x in photo), 1)} o/image {photo[:8]} ; premières {fo[:6]}")
