import json, glob, os, statistics as st, sys
# Synthèse des passes profil-accrocs de la correction : python3 synthese.py <dossier correction>
R = sys.argv[1]
runs = []
for f in sorted(glob.glob(os.path.join(R, 'mesures', '*.json'))):
    build, scen, rep = os.path.basename(f)[:-5].split('-')
    r = json.load(open(f))
    ch, im = r.get('chargement') or {}, r.get('images') or {}
    p2, a2 = im.get('premieres2s') or {}, im.get('apres2s') or {}
    runs.append({'fichier': os.path.basename(f), 'build': build, 'scenario': scen, 'passe': rep,
        'clicAuPremierEcranCourseMs': ch.get('clicAuPremierEcranCourseMs'), 'plusLongueImagePendantChargementMs': ch.get('plusLongueImagePendantChargement'),
        'premieres2s': {k: p2.get(k) for k in ('images', 'p50', 'p95', 'pire', 'au_dela_50ms')},
        'ensuite': {k: a2.get(k) for k in ('images', 'p50', 'p95', 'pire', 'au_dela_50ms')},
        'sha256': (r.get('build') or {}).get('sha256', '')[:16]})
out = {'outil': 'tools/profil-accrocs.mjs --scenario depart (Chrome sans interface, Apple M5 ; SwiftShader pour sw)', 'resume': {}, 'passes': runs}
for scen in ['c0', 'c2', 'duo', 'sw']:
    for build in ['base', 'apres']:
        l = [x for x in runs if x['scenario'] == scen and x['build'] == build]
        if not l: continue
        val = lambda k: [x[k] for x in l if x[k] is not None]
        out['resume'][scen + ' ' + build] = {'passes': len(l),
            'clicAuPremierEcranCourseMs': val('clicAuPremierEcranCourseMs'),
            'plusLongueImagePendantChargementMs': val('plusLongueImagePendantChargementMs'),
            'premieres2sPire': [x['premieres2s']['pire'] for x in l], 'premieres2sMediane': [x['premieres2s']['p50'] for x in l],
            'ensuitePire': [x['ensuite']['pire'] for x in l], 'ensuiteAuDela50ms': [x['ensuite']['au_dela_50ms'] for x in l]}
json.dump(out, open(os.path.join(R, 'synthese.json'), 'w'), ensure_ascii=False, indent=1)
for k, v in out['resume'].items(): print(k, json.dumps(v, ensure_ascii=False))
