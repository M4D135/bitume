#!/usr/bin/env python3
"""Coût de chaque effet : écarts appariés (même séance, images alternées) entre « tout allumé » et la variante qui le
coupe ; médiane des séances. python3 resume_couts.py couts couts2 [couts3]"""
import glob, json, os, statistics, sys

EFFETS = {'{"contacts": null}': 'contact', '{"ombreProche": null}': 'tuile', '{"ombreLoin": false}': 'carte lointaine',
          '{"penombre": "meteo"}': 'PCSS (au lieu de météo)', '{"penombre": null}': 'pénombre météo',
          '{"contacts": null, "ombreProche": null, "ombreLoin": false, "penombre": null}': 'tous les effets',
          '{"shadows": false}': 'ombres du soleil (tout le système)'}
ecarts, bases, cartes, prep = {}, {}, [], []
for dossier in sys.argv[1:]:
    for f in sorted(glob.glob(os.path.join(dossier, '*-apres-*.json'))):
        try:
            v = json.loads(open(f).read())['valeur']
        except Exception:
            continue
        nom = os.path.basename(f).rsplit('-apres-', 1)[0]
        scene = '-'.join(nom.split('-')[:2])
        tout = next(x for x in v['variantes'] if x['v'] == '{}')
        bases.setdefault(scene, []).append(tout['p50'])
        for x in v['variantes']:
            if x['v'] == '{}':
                continue
            cle = json.dumps(json.loads(x['v']), ensure_ascii=False)
            ecarts.setdefault((scene, EFFETS.get(cle, cle)), []).append(round(tout['p50'] - x['p50'], 2))
        if v.get('carte'):
            cartes.append(v['carte']['medianeMs'])
        if v.get('preparerUs') is not None:
            prep.append(v['preparerUs'])
for scene in sorted(bases):
    b = bases[scene]
    print(f'{scene} : image complète {statistics.median(b):.1f} ms (médiane de {len(b)} séances, de {min(b)} à {max(b)})')
    for (s, effet), l in sorted(ecarts.items()):
        if s != scene:
            continue
        print(f'   {effet:38s} {statistics.median(l):+.2f} ms  ({len(l)} séances : {", ".join(f"{x:+.1f}" for x in l)})')
if cartes:
    print(f'carte lointaine (synchronisée, 5 essais par séance) : médiane {statistics.median(cartes):.2f} ms, de {min(cartes)} à {max(cartes)} ({len(cartes)} séances)')
if prep:
    print(f'B.ombres.preparer (processeur) : médiane {statistics.median(prep):.2f} µs par appel ({len(prep)} séances)')
