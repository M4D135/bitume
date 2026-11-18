import json, glob, os, statistics as st, sys
R = sys.argv[1]
runs = []
for d, prefix in [(os.path.join(R, 'mesures-ab'), '')]:
    for f in sorted(glob.glob(os.path.join(d, '*.json'))):
        b = os.path.basename(f)[:-5]
        build, scen, rep = b.split('-')
        r = json.load(open(f))
        ch, im = r.get('chargement') or {}, r.get('images') or {}
        p2, a2 = im.get('premieres2s') or {}, im.get('apres2s') or {}
        acc = r.get('accrocs', [])
        apres_ecran = [a for a in acc if a['tDepuisCourseS'] > -0.03]
        runs.append({'fichier': os.path.basename(f), 'build': build, 'scenario': scen, 'passe': rep,
            'clicAuPremierEcranCourseMs': ch.get('clicAuPremierEcranCourseMs'), 'plusLongueImagePendantChargementMs': ch.get('plusLongueImagePendantChargement'),
            'premieres2s': {k: p2.get(k) for k in ('images', 'p95', 'pire', 'au_dela_1_5x', 'au_dela_50ms')},
            'ensuite': {k: a2.get(k) for k in ('images', 'p95', 'pire', 'au_dela_1_5x', 'au_dela_50ms')},
            'pireApresEcranCourseMs': max([a['dtMs'] for a in apres_ecran], default=None),
            'sha256': (r.get('build') or {}).get('sha256', '')[:16]})
out = {'outil': 'tools/profil-accrocs.mjs --scenario depart (Chrome 157 sans interface, ANGLE Metal, Apple M5 10 cœurs ; SwiftShader pour sw)',
       'scenarios': {'c0': 'Val-Brûlé, Fine, sec, 1390×1295', 'c2': 'Haut-Col, Fine, pluie (tunnel, reflets)', 'duo': 'Val-Brûlé, Fine, à deux', 'sw': 'Val-Brûlé, Basse, SwiftShader 640×360, 40 s'},
       'resume': {}, 'passes': runs}
for scen in ['c0', 'c2', 'duo', 'sw']:
    for build in ['avant', 'apres']:
        l = [x for x in runs if x['scenario'] == scen and x['build'] == build]
        if not l: continue
        val = lambda k: [x[k] for x in l if x[k] is not None]
        out['resume'][scen + ' ' + build] = {'passes': len(l),
            'clicAuPremierEcranCourseMs': {'mediane': st.median(val('clicAuPremierEcranCourseMs')), 'min': min(val('clicAuPremierEcranCourseMs')), 'max': max(val('clicAuPremierEcranCourseMs'))},
            'plusLongueImagePendantChargementMs': {'mediane': st.median(val('plusLongueImagePendantChargementMs')) if val('plusLongueImagePendantChargementMs') else None, 'max': max(val('plusLongueImagePendantChargementMs'), default=None)},
            'premieres2sPire': [x['premieres2s']['pire'] for x in l], 'premieres2sAuDela50ms': sum(x['premieres2s']['au_dela_50ms'] or 0 for x in l),
            'ensuiteAuDela50ms': [x['ensuite']['au_dela_50ms'] for x in l]}
json.dump(out, open(os.path.join(R, 'synthese.json'), 'w'), ensure_ascii=False, indent=1)
for k, v in out['resume'].items(): print(k, json.dumps(v, ensure_ascii=False))
