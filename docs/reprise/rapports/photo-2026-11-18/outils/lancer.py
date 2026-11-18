#!/usr/bin/env python3
"""Mesures du lot 21 (page construite : variable PAGE, sinon dist/bitume.html du dépôt) : remplit un modèle JS (__REF__, __VARIANTES__, __REGIONS__...) et lance page-essai.mjs.

    python3 lancer.py modele.js sortie.json '{"__REF__": {...}, ...}' [taille] [dpr]
"""
import json, os, pathlib, subprocess, sys

RACINE = pathlib.Path(__file__).resolve().parents[5]  # racine du dépôt BITUME

modele, sortie, valeurs = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
taille = sys.argv[4] if len(sys.argv) > 4 else '1280,720'
dpr = sys.argv[5] if len(sys.argv) > 5 else None
js = open(modele).read()
for cle, val in valeurs.items():
    # __CAM__ porte du code JavaScript brut ; les autres valeurs passent en JSON
    js = js.replace(cle, val if cle == '__CAM__' else json.dumps(val))
fjs = sortie.replace('.json', '.js')
open(fjs, 'w').write(js)
page = os.environ.get('PAGE', str(RACINE / 'dist/bitume.html'))
args = ['node', str(RACINE / 'tools/page-essai.mjs'), page, fjs, '--taille', taille]
if dpr:
    args += ['--dpr', dpr]
r = subprocess.run(args, capture_output=True, text=True, timeout=300)
open(sortie, 'w').write(r.stdout + r.stderr)
print(r.stdout[:3000])
