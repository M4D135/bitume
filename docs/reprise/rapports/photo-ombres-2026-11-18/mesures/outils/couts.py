#!/usr/bin/env python3
"""Séances alternées : python3 couts.py plan.json dossier [tours]

plan.json : {"pages": {"avant": "...html", "apres": "...html"}, "scenes": [{"nom", "ref", "cam"?, "taille", "dpr"?, "n"?,
"variantes": {"avant": [...], "apres": [...]}}]}. Chaque tour passe toutes les scènes, chaque scène les deux
constructions l'une après l'autre (ordre inversé un tour sur deux). Résumé : médiane des p50 des séances."""
import json, os, statistics, subprocess, sys, time
ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, '..', '..', '..', '..', '..', '..'))  # racine du dépôt BITUME
OUTIL = os.path.join(RACINE, 'tools', 'page-essai.mjs')
plan, dossier = json.load(open(sys.argv[1])), sys.argv[2]
tours = int(sys.argv[3]) if len(sys.argv) > 3 else 3
os.makedirs(dossier, exist_ok=True)
MODELE = open(os.path.join(ICI, os.environ.get('MODELE_COUTS', 'couts.js'))).read()
res = {}
for tour in range(1, tours + 1):
    for sc in plan['scenes']:
        ordre = [b for b in plan['pages'] if b in sc['variantes']]
        if tour % 2 == 0: ordre.reverse()
        for b in ordre:
            js = (MODELE.replace('__REF__', json.dumps(sc['ref'])).replace('__CAM__', sc.get('cam', ''))
                  .replace('__VARIANTES__', json.dumps(sc['variantes'][b])).replace('__N__', str(sc.get('n', 50))))
            base = os.path.join(dossier, f"{sc['nom']}-{b}-{tour}")
            open(base + '.js', 'w').write(js)
            args = ['node', OUTIL, plan['pages'][b], base + '.js', '--taille', sc.get('taille', '1440,757')]
            if sc.get('dpr'): args += ['--dpr', str(sc['dpr'])]
            t0 = time.time()
            charge = os.getloadavg()[0]
            r = subprocess.run(args, capture_output=True, text=True, timeout=900)
            open(base + '.json', 'w').write(r.stdout + r.stderr)
            try:
                v = json.loads(r.stdout)['valeur']
            except Exception:
                print(sc['nom'], b, tour, 'ÉCHEC', r.stdout[:400], r.stderr[:400], flush=True); continue
            ligne = ' '.join(f"{x['v']}={x['p50']}" for x in v['variantes'])
            print(f"{sc['nom']} {b} t{tour} {time.time() - t0:.0f}s charge {charge:.0f} toile {v['toile']} créations {v['creations']} | {ligne}", flush=True)
            for x in v['variantes']:
                res.setdefault(sc['nom'], {}).setdefault(b, {}).setdefault(x['v'], []).append(x['p50'])
            res[sc['nom']][b].setdefault('_charge', []).append(round(charge))
            if v.get('carte'): res[sc['nom']][b].setdefault('_carte', []).append(v['carte']['medianeMs'])
            if v.get('preparerUs') is not None: res[sc['nom']][b].setdefault('_preparerUs', []).append(v['preparerUs'])
            res[sc['nom']][b].setdefault('_creations', []).append(v['creations'])
json.dump(res, open(os.path.join(dossier, 'resume.json'), 'w'), indent=1, ensure_ascii=False)
for nom, bs in res.items():
    for b, vs in bs.items():
        for v, l in vs.items():
            med = statistics.median(l) if l and all(isinstance(x, (int, float)) for x in l) else None
            print(f"{nom:24s} {b:6s} {v:70s} {l} médiane {med}")
