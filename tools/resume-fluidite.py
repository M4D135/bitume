#!/usr/bin/env python3
"""Résumé lisible des rapports de tools/profil-accrocs.mjs : python3 tools/resume-fluidite.py dossier/*.json

Une ligne de cadence par rapport, puis les accrocs attribués. Avec --table : tableau Markdown seul.
"""
import json
import sys

table = '--table' in sys.argv
fichiers = [a for a in sys.argv[1:] if not a.startswith('--')]
if table:
    print('| Rapport | Chargement | Images | p50 | p95 | pire | au-delà de 1,5 période | ramassages/s | triangles |')
    print('|---|---|---|---|---|---|---|---|---|')
for f in fichiers:
    nom = f.split('/')[-1][:-5]
    try:
        r = json.load(open(f))
    except Exception as e:  # rapport illisible : le dire, continuer
        print(nom, 'ILLISIBLE', e)
        continue
    if r.get('fatal'):
        print(nom, 'FATAL', r['fatal'][:300])
        continue
    p = r['parametres']
    im = r.get('images') or {}
    fen = p.get('fenetre')
    # fenêtre visible : les deux premières secondes sont de la chauffe d'outil, on lit la suite
    c = im.get('apres2s' if fen else 'course') or {}
    ch = r.get('chargement') or {}
    gc = (r.get('ramasseMiettes') or {}).get('parSeconde')
    st = r.get('statsRendu') or {}
    tri = (st.get('triangles') or 0) / 1e6
    if table:
        print('| %s | %s ms | %s | %s | %s | %s | %s | %s | %.2f M |' % (
            nom, ch.get('clicAuPremierEcranCourseMs', '–'), c.get('images'), c.get('p50'), c.get('p95'), c.get('pire'),
            c.get('au_dela_1_5x'), '–' if gc is None else gc, tri))
        continue
    print('=== %s | %s c%s %s %s %s %s cpu×%s%s' % (
        nom, p['scenario'], p['jeu']['circuit'], p['jeu']['qualite'], p['jeu']['meteo'], p['jeu']['vue'], p['jeu']['mode'],
        p['cpu'], ' fenêtre' if fen else ''))
    print('  chargement :', ch, '| toile %sx%s msaa=%s triangles=%.2f M appels=%s' % (
        st.get('width'), st.get('height'), st.get('msaa'), tri, st.get('drawCalls')))
    for k in ('course', 'premieres2s', 'apres2s'):
        print('  %-11s' % k, im.get(k))
    print('  ramasse-miettes :', r.get('ramasseMiettes'))
    for a in (r.get('accrocs') or [])[:12]:
        print('  accroc t=%7.2f s  dt=%7.1f ms  gc=%4.1f  shaders=%5.1f | %s' % (
            a['tDepuisCourseS'], a['dtMs'], a.get('gcMs', 0), a.get('shadersMs', 0), ' ; '.join(a.get('evenements', [])[:4])))
    if len(r.get('accrocs') or []) > 12:
        print('  … %d accrocs au total' % len(r['accrocs']))
    m = r.get('mesures') or {}
    if m.get('cpuP50'):
        print('  fil principal p50 :', {k: round(v, 1) for k, v in m['cpuP50'].items() if isinstance(v, (int, float))})
    if r.get('erreurs'):
        print('  ERREURS', r['erreurs'][:3])
