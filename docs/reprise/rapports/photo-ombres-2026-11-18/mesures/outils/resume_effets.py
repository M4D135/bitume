#!/usr/bin/env python3
"""Coût par effet (séances à variantes mêlées au hasard par bloc) : python3 resume_effets.py dossier
Variantes : 0 tous allumés ; 1 sans contact ; 2 sans tuile ; 3 sans carte lointaine ; 4 sans pénombre ; 5 tous coupés ;
6 tous allumés (témoin A/A). Coût d'un effet = p50(tous) − p50(sans lui), même séance ; « les quatre » = p50(tous) −
p50(tous coupés) ; médiane des tours, et entre crochets l'intervalle où tombent 90 % des médianes de tours ré-échantillonnés."""
import glob, json, os, random, re, statistics, sys
d = sys.argv[1]
NOMS = ['tous', 'contact', 'tuile', 'carte lointaine', 'pénombre', 'les quatre', 'témoin A/A']
donnees = {}
for f in glob.glob(os.path.join(d, '*.json')):
    m = re.match(r'(.+)-([a-z0-9]+)-(\d+)\.json$', os.path.basename(f))
    if not m: continue
    try: v = json.JSONDecoder().raw_decode(open(f).read())[0]['valeur']
    except Exception: continue
    donnees.setdefault((m.group(1), m.group(2)), []).append((int(m.group(3)), v))
med = statistics.median


def bootstrap(l, n=4000, graine=1):
    r = random.Random(graine); m = sorted(med([r.choice(l) for _ in l]) for _ in range(n))
    return m[int(.05 * n)], m[int(.95 * n)]


for (scene, page), tours in sorted(donnees.items()):
    tours.sort()
    p = [[x['p50'] for x in v['variantes']] for _, v in tours]
    image = [x[0] for x in p]
    print(f"{scene} {page} : {len(p)} tours, image {med(image):.1f} ms ({min(image):.1f} à {max(image):.1f}), créations {[v['creations'] for _, v in tours]}")
    for i in range(1, len(NOMS)):
        e = [round(x[0] - x[i], 2) for x in p]
        lo, hi = bootstrap(e)
        print(f"   {NOMS[i]:16s} {med(e):+.2f} ms  [{lo:+.2f} ; {hi:+.2f}]  ({', '.join(f'{y:+.1f}' for y in e)})")
