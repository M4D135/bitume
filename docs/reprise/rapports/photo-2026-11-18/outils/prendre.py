#!/usr/bin/env python3
"""Prises de vue du lot 21 : une séance de référence par image, filmée par tools/page-essai.mjs.

    python3 prendre.py liste.json [--force] [--seul nom1,nom2]

Chaque entrée : {"nom", "ref": {...}, "cam": "code JS (facultatif)", "n": images, "hud": false, "extra": "code JS",
"taille": "1280,720", "dpr": 1}.
"""
import json, os, pathlib, subprocess, sys, tempfile, time

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = pathlib.Path(__file__).resolve().parents[5]  # racine du dépôt BITUME
PAGE = os.environ.get('PAGE', str(RACINE / 'dist/bitume.html'))
OUTIL = str(RACINE / 'tools/page-essai.mjs')
# les images vont hors du dépôt (variable SORTIE, sinon un dossier temporaire)
SORTIE = os.environ.get('SORTIE', os.path.join(tempfile.gettempdir(), 'bitume-photo'))
os.makedirs(SORTIE, exist_ok=True)
MODELE = open(os.path.join(ICI, 'modele.js')).read()

liste = json.load(open(sys.argv[1]))
force = '--force' in sys.argv
seul = None
if '--seul' in sys.argv:
    seul = set(sys.argv[sys.argv.index('--seul') + 1].split(','))
for p in liste:
    nom = p['nom']
    if seul and nom not in seul:
        continue
    png = os.path.join(SORTIE, nom + '.png')
    if os.path.exists(png) and not force:
        continue
    js = (MODELE.replace('__REF__', json.dumps(p['ref']))
          .replace('__CAM__', p.get('cam', ''))
          .replace('__HUD__', 'false' if p.get('hud') else 'true')
          .replace('__N__', str(p.get('n', 40)))
          .replace('__EXTRA__', p.get('extra', '')))
    fjs = os.path.join(SORTIE, nom + '.js')
    open(fjs, 'w').write(js)
    t0 = time.time()
    args = ['node', OUTIL, PAGE, fjs, '--capture', png, '--taille', p.get('taille', '1280,720')]
    if p.get('dpr'):
        args += ['--dpr', str(p['dpr'])]
    r = subprocess.run(args, capture_output=True, text=True, timeout=240)
    open(os.path.join(SORTIE, nom + '.json'), 'w').write(r.stdout + r.stderr)
    try:
        v = json.loads(r.stdout)
        res = v.get('valeur') or v.get('fatal', '')[:300]
        err = v.get('erreurs', [])[:2]
    except Exception:
        res, err = r.stdout[:300], r.stderr[:300]
    print(f'{nom} {time.time() - t0:.1f}s', json.dumps(res, ensure_ascii=False)[:400], err if err else '', flush=True)
