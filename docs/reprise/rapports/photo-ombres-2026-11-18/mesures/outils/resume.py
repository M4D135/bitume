#!/usr/bin/env python3
"""Résumé des séances alternées : python3 resume.py dossier [avant] [apres]

Chaque séance alterne ses variantes image par image ; on compare toujours une variante à la variante de même rang de
l'autre construction (même place dans l'alternance). Pour chaque scène et chaque tour :
  A[i], B[i]          p50 de la variante de rang i dans la séance « avant » et dans la séance « apres » ;
  A[0] − A[i]         contrôle : variantes équivalentes pour l'ancienne construction (doit valoir 0) ;
  B[i] − A[i]         construction contre construction, même rang, séances voisines du même tour ;
  B[0] − B[i]         même séance (la part de ce qui distingue la variante i), brute ;
  (B[0] − B[i]) − (A[0] − A[i])   la même, corrigée du biais de rang mesuré sur l'ancienne construction.
On rend la médiane des tours, avec la liste des tours. Seul le premier objet JSON de chaque fichier est lu : quand
page-essai.mjs échoue à effacer son profil temporaire après avoir écrit son résultat, sa trace suit l'objet."""
import glob, json, os, re, statistics, sys

dossier = sys.argv[1]
AV = sys.argv[2] if len(sys.argv) > 2 else 'avant'
AP = sys.argv[3] if len(sys.argv) > 3 else 'apres'
donnees = {}
for f in glob.glob(os.path.join(dossier, '*.json')):
    m = re.match(r'(.+)-([a-z0-9]+)-(\d+)\.json$', os.path.basename(f))
    if not m:
        continue
    scene, page, tour = m.group(1), m.group(2), int(m.group(3))
    try:
        v = json.JSONDecoder().raw_decode(open(f).read())[0]['valeur']
    except Exception:
        continue
    donnees.setdefault(scene, {}).setdefault(tour, {})[page] = v
med = lambda l: statistics.median(l) if l else float('nan')
fmt = lambda l: ', '.join(f'{x:+.1f}' for x in l)
for scene in sorted(donnees):
    tours = donnees[scene]
    lignes, imgA, imgB, crea = {}, [], [], {AV: [], AP: []}
    noms = None
    for tour, pages in sorted(tours.items()):
        for p in (AV, AP):
            if p in pages:
                crea[p].append(pages[p]['creations'])
        if AV not in pages or AP not in pages:
            continue
        A = [x['p50'] for x in pages[AV]['variantes']]
        Bv = pages[AP]['variantes']; B = [x['p50'] for x in Bv]
        noms = [x['v'] for x in Bv]
        imgA.append(A[0]); imgB.append(B[0])
        for i in range(len(B)):
            lignes.setdefault(('B−A', i), []).append(round(B[i] - A[i], 2))
            if i:
                lignes.setdefault(('A0−Ai', i), []).append(round(A[0] - A[i], 2))
                lignes.setdefault(('B0−Bi', i), []).append(round(B[0] - B[i], 2))
                lignes.setdefault(('corrige', i), []).append(round((B[0] - B[i]) - (A[0] - A[i]), 2))
    if not imgA:
        continue
    print(f"{scene} : {len(imgA)} tours ; image avant {med(imgA):.1f} ms (de {min(imgA):.1f} à {max(imgA):.1f}), "
          f"après {med(imgB):.1f} ms ; créations avant {crea[AV]} après {crea[AP]}")
    for i, nom in enumerate(noms):
        print(f"   variante {i} {nom}")
        print(f"      construction contre construction  B−A        {med(lignes[('B−A', i)]):+.2f} ms  ({fmt(lignes[('B−A', i)])})")
        if i:
            print(f"      contrôle de rang (ancienne)       A0−A{i}      {med(lignes[('A0−Ai', i)]):+.2f} ms  ({fmt(lignes[('A0−Ai', i)])})")
            print(f"      même séance, brut                 B0−B{i}      {med(lignes[('B0−Bi', i)]):+.2f} ms  ({fmt(lignes[('B0−Bi', i)])})")
            print(f"      même séance, corrigé du rang                 {med(lignes[('corrige', i)]):+.2f} ms  ({fmt(lignes[('corrige', i)])})")
