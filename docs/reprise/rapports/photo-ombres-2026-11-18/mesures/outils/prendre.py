#!/usr/bin/env python3
"""Prises déterministes : python3 prendre.py page.html liste.json dossier [--seul a,b]"""
import json, os, subprocess, sys, time
ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, '..', '..', '..', '..', '..', '..'))  # racine du dépôt BITUME
OUTIL = os.path.join(RACINE, 'tools', 'page-essai.mjs')
page, liste, dossier = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
seul = set(sys.argv[sys.argv.index('--seul') + 1].split(',')) if '--seul' in sys.argv else None
os.makedirs(dossier, exist_ok=True)
MODELE = open(os.path.join(ICI, 'prise.js')).read()
for p in liste:
    nom = p['nom']
    if seul and nom not in seul: continue
    js = (MODELE.replace('__REF__', json.dumps(p['ref'])).replace('__CAM__', p.get('cam', ''))
          .replace('__N__', str(p.get('n', 50))).replace('__EXTRA__', p.get('extra', ''))
          .replace('__FX__', json.dumps(p.get('fx')) if p.get('fx') else 'null'))
    fjs = os.path.join(dossier, nom + '.js'); open(fjs, 'w').write(js)
    png = os.path.join(dossier, nom + '.png')
    args = ['node', OUTIL, page, fjs, '--capture', png, '--taille', p.get('taille', '1280,720')]
    if p.get('dpr'): args += ['--dpr', str(p['dpr'])]
    t0 = time.time()
    r = subprocess.run(args, capture_output=True, text=True, timeout=300)
    open(os.path.join(dossier, nom + '.json'), 'w').write(r.stdout + r.stderr)
    try:
        v = json.loads(r.stdout); res = v.get('valeur') or v.get('fatal', '')[:300]; err = v.get('erreurs', [])[:3]
    except Exception:
        res, err = r.stdout[:300], r.stderr[:300]
    print(f'{nom} {time.time() - t0:.1f}s', json.dumps(res, ensure_ascii=False)[:300], err if err else '', flush=True)
