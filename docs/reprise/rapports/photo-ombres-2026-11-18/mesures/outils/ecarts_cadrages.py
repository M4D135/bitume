#!/usr/bin/env python3
"""Écarts avant/après d'une liste de cadrages pris par prendre.py :
python3 ecarts_cadrages.py cadrages-plan.json dossier_avant dossier_apres [dossier_differences]

Pour chaque cadrage : part des pixels dont la luminance change de plus de 1,5 niveau, part de ceux qui
s'assombrissent, écart moyen et écart maximal (niveaux sur 255), puis l'état des ombres photo de la prise
« après ». Les images de différence (gris 128 = identique, noir = après plus sombre) vont dans le dernier dossier.
"""
import json, os, subprocess, sys
ICI = os.path.dirname(os.path.abspath(__file__))
liste, A, B = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
D = sys.argv[4] if len(sys.argv) > 4 else None
if D: os.makedirs(D, exist_ok=True)


def conditions(ref):
    return ' '.join(str(ref[k]) for k in ('qualite', 'moment', 'meteo', 'saison') if ref.get(k)) or '-'


def etat(dossier, nom):
    try:
        v = json.loads(open(os.path.join(dossier, nom + '.json')).read())
        return v.get('valeur') or {}, v.get('erreurs') or []
    except Exception:
        return {}, ['json illisible']


print(f"{'cadrage':26s} {'conditions':24s} {'n':>4s} {'changés':>8s} {'sombres':>8s} {'moyen':>7s} {'max':>7s}  err  ombres photo (après)")
manque = []
for p in liste:
    n = p['nom']
    a, b = os.path.join(A, n + '.png'), os.path.join(B, n + '.png')
    if not (os.path.exists(a) and os.path.exists(b)):
        manque.append(n); continue
    r = subprocess.run(['node', os.path.join(ICI, 'comparer.mjs'), a, b, os.path.join(D, n + '.png') if D else '-'],
                       capture_output=True, text=True)
    e = json.loads(r.stdout)
    va, ea = etat(A, n)
    vb, eb = etat(B, n)
    ph = vb.get('photo')
    ph = ' '.join(f'{k}={ph[k]}' for k in ('contacts', 'tuile', 'loin', 'penombre') if k in ph) if ph else '-'
    print(f"{n:26s} {conditions(p['ref']):24s} {p.get('n', 50):4d} {e['part'] * 100:7.2f}% {e['partSombre'] * 100:7.1f}% "
          f"{e['moyenne']:+7.2f} {e['max']:+7.1f}  {len(ea) + len(eb):3d}  {ph}")
print('manquants :', ', '.join(manque) if manque else 'aucun')
