#!/usr/bin/env python3
"""Séances alternées, construction contre construction (§ 2.5 du plan 21), ordre des pages en carré latin :

    python3 seances_latin.py plan.json dossier [tours]

plan.json : {"outil": ".../tools/page-essai.mjs", "modele": ".../couts.js",
             "pages": {"avant": "a.html", "apres": "b.html"},
             "scenes": [{"nom", "ref", "taille", "dpr", "n", "variantes": {"avant": [...], "apres": [...]}}]}

Chaque tour passe toutes les scènes ; dans chaque scène, une séance par construction, l'une après l'autre, dans
l'ordre inverse un tour sur deux (A B, puis B A). Dans une séance, les variantes alternent image par image.
Chaque séance écrit sa valeur brute (dossier/<scène>-<page>-<tour>.json) et une ligne dans dossier/seances.log."""
import json, os, subprocess, sys, time

plan, dossier = json.load(open(sys.argv[1])), sys.argv[2]
tours = int(sys.argv[3]) if len(sys.argv) > 3 else 6
os.makedirs(dossier, exist_ok=True)
MODELE = open(plan['modele']).read()
journal = open(os.path.join(dossier, 'seances.log'), 'a')
for tour in range(1, tours + 1):
    for sc in plan['scenes']:
        ordre = [b for b in plan['pages'] if b in sc['variantes']]
        # Carré latin : les permutations défilent d'un tour à l'autre, chaque page passe autant de fois à chaque place
        # du bloc (avec trois pages : ABC, BCA, CAB, CBA, BAC, ACB). Corrige l'ordre ABC / CBA de seances.py, où la page
        # du milieu restait toujours au milieu.
        k = len(ordre)
        rot = (tour - 1) % k; perm = ordre[rot:] + ordre[:rot]
        if ((tour - 1) // k) % 2 == 1:
            perm = perm[::-1]
        ordre = perm
        for b in ordre:
            js = (MODELE.replace('__REF__', json.dumps(sc['ref'])).replace('__CAM__', sc.get('cam', ''))
                  .replace('__VARIANTES__', json.dumps(sc['variantes'][b])).replace('__N__', str(sc.get('n', 100))))
            base = os.path.join(dossier, f"{sc['nom']}-{b}-{tour}")
            open(base + '.js', 'w').write(js)
            args = ['node', plan['outil'], plan['pages'][b], base + '.js', '--taille', sc.get('taille', '1440,757')]
            if sc.get('dpr'):
                args += ['--dpr', str(sc['dpr'])]
            charge = os.getloadavg()[0]
            t0 = time.time()
            r = subprocess.run(args, capture_output=True, text=True, timeout=900)
            open(base + '.json', 'w').write(r.stdout + r.stderr)
            try:
                v = json.loads(r.stdout)['valeur']
                ligne = ' | '.join(f"{x['v']}={x['p50']}" for x in v['variantes'])
                texte = (f"{time.strftime('%H:%M:%S')} {sc['nom']} {b} t{tour} {time.time() - t0:.0f}s charge {charge:.1f} "
                         f"toile {v['toile']} moteur {v['moteur']} créations {v['creations']} | {ligne}")
            except Exception:
                texte = f"{time.strftime('%H:%M:%S')} {sc['nom']} {b} t{tour} ÉCHEC {r.stdout[:300]} {r.stderr[:300]}"
            print(texte, flush=True)
            journal.write(texte + '\n'); journal.flush()
