#!/usr/bin/env python3
"""Qualifier 13A/p13 depuis la racine du dépôt, après gel des sources et de la fixture.

--tests conserve les suites et leurs empreintes ; --build reprend ce même état figé.
Sans option, enchaîner les deux phases. Aucune fixture n'est créée ni régénérée ici.
Les sorties restent dans ce dossier ; les preuves 12F3 ne sont jamais réécrites.
"""
from pathlib import Path
import datetime
import hashlib
import json
import re
import subprocess
import tempfile
import time
import sys
import os

repo = Path.cwd().resolve()
out = Path(__file__).resolve().parent
assert (repo / 'src/course.js').is_file()
assert "PHYSIQUE = 'p13'" in (repo / 'src/jeu.js').read_text()
commands = []
environnement = os.environ.copy()
environnement['BITUME_RAPPORTS_RUSSIE'] = str(out / 'parcours' / 'russie')
environnement['BITUME_RAPPORTS_STANDS'] = str(out / 'parcours' / 'stands')
environnement['BITUME_RAPPORTS_SORTIE_FILE'] = str(out / 'parcours' / 'sortie-file')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

# Archives vérifiées dans main 18451e0eeb701d720f08c069b841d79c2439755d / 0.2.52.
ARCHIVES = {
    'verifications/fixtures/determinisme-p12.json': 'fb8f96e5a770fcdd6ee3da520a9c8e0e2ae81c6c0b6b34d5a20758730f790e5f',
    'verifications/fixtures/determinisme-p9.json': '9193959db4637e478c2ac1eb0666381d48e7109d068d3323ff189155c52e1b0a',
    'verifications/fixtures/determinisme-p10.json': 'd0c0beca4d1db5cbadb6f3c6f2daa301f9a2c7695e19fcceab1cfabd7c8aba0f',
    'verifications/fixtures/determinisme-p11.json': 'c2453f9f896014a45020678c071a10aed656243ef542565538c571d7fc9430b7',
}
FIXTURE = 'verifications/fixtures/determinisme-p13.json'
TRACE_ACTUAL = 'e6790758bb9758f314e22491651b78ec119837a8dcfbc229c26ab85bb9c897cf'
TRACE_EXPECTED = '575fc91df4958254d0404ab5e4d481b3d28394dd6b99c82713733fab06fb6bee'
base = json.loads((out / 'BASE-0252.json').read_text())
if base['base_commit'] != '18451e0eeb701d720f08c069b841d79c2439755d':
    raise SystemExit('Référence BASE-0252 inattendue.')
BASE_HASHES = base['hashes_base']
if (set(base['lois_et_archives_a_conserver']) != set(BASE_HASHES)
        or any(BASE_HASHES.get(path) != expected for path, expected in ARCHIVES.items())):
    raise SystemExit('Contrat des lois et archives incomplet ou incohérent dans BASE-0252.')


def save(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def manifest():
    paths = [p for directory in ['src', 'verifications'] for p in (repo / directory).rglob('*') if p.is_file()]
    paths += [repo / f for f in ['construire.py', 'FERRO.lock.json']]
    paths += [Path(__file__).resolve(), out / 'BASE-0252.json']
    return {str(p.relative_to(repo)): sha(p) for p in sorted(paths)}


def check_archives(hashes):
    changed = [path for path, expected in ARCHIVES.items() if hashes.get(path) != expected]
    if changed:
        raise SystemExit('Archives p9/p10/p11/p12 différentes de la base 0.2.52 : ' + str(changed))


def check_laws(hashes):
    changed = [path for path, expected in BASE_HASHES.items() if hashes.get(path) != expected]
    if changed:
        raise SystemExit('Lois, verrou FERRO ou archives différents de BASE-0252 : ' + str(changed))


def run(argv, log, timeout=300):
    started = time.monotonic()
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        result = subprocess.run(argv, cwd=repo, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, env=environnement)
        code, raw = result.returncode, result.stdout
    except subprocess.TimeoutExpired as error:
        code, raw = 124, (error.stdout or b'') + b'\nQUALIFICATION TIMEOUT\n'
    path = out / log
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    entry = {'argv': argv, 'date_utc': stamp, 'code': code, 'duree_s': round(time.monotonic() - started, 3),
             'log': log, 'sha256_log': sha(path)}
    commands.append(entry)
    save('commandes.json', commands)
    return entry


def trace_reservation(suites):
    trace = next((x for x in suites if x['suite'] == 'traces.test.mjs'), None)
    result = {'suite': 'traces.test.mjs', 'base_version': '0.2.52',
              'base_commit': '18451e0eeb701d720f08c069b841d79c2439755d',
              'echec': bool(trace and trace['code']), 'signature_heritee_identique': False}
    if trace and trace['code']:
        raw = (out / trace['log']).read_text()
        actual = re.findall(r"actual: '([0-9a-f]{64})'", raw)
        expected = re.findall(r"expected: '([0-9a-f]{64})'", raw)
        failures = re.findall(r'^KO\s+(.+)$', raw, flags=re.MULTILINE)
        result.update({'actual': actual, 'expected': expected, 'log': trace['log'],
                       'sha256_log': sha(out / trace['log']),
                       'signature_heritee_identique': trace['code'] == 1
                       and actual == [TRACE_ACTUAL] and expected == [TRACE_EXPECTED]
                       and failures == ['déterminisme : mêmes effets et mêmes tirages que le code d’avant la réécriture (empreinte figée)']
                       and "operator: 'strictEqual'" in raw})
    save('reserve-traces.json', result)
    return result


before = manifest()
check_archives(before)
check_laws(before)
if FIXTURE not in before:
    raise SystemExit('Fixture p13 absente : la créer et la geler explicitement avant qualification.')
if '--tests' in sys.argv and '--build' in sys.argv:
    raise SystemExit('Choisir --tests ou --build, ou aucune option pour les deux phases.')

if '--build' in sys.argv:
    saved = json.loads((out / 'hashes-apres-tests.json').read_text())
    if before != saved:
        raise SystemExit('Sources, fixtures ou qualificateur modifiés depuis les tests ; qualifier les écarts avant le build.')
    suites = json.loads((out / 'suites.json').read_text())
    commands = json.loads((out / 'commandes.json').read_text())
else:
    save('hashes-qualification.json', before)
    suites = []
    files = sorted((repo / 'verifications').glob('*.test.mjs'))
    for index, suite in enumerate(files, 1):
        result = run(['node', str(suite.relative_to(repo))], 'tests/' + suite.name + '.log')
        suites.append({'suite': suite.name, **result})
        save('suites.json', suites)
        if index % 20 == 0 or result['code'] or index == len(files):
            print(json.dumps({'etape': 'suites', 'terminees': index, 'total': len(files),
                              'echecs': [x['suite'] for x in suites if x['code']]}), flush=True)

after = manifest()
check_archives(after)
check_laws(after)
unstable = sorted(p for p in set(before) | set(after) if before.get(p) != after.get(p))
if unstable:
    raise SystemExit('Sources, fixtures ou qualificateur modifiés pendant les tests : ' + str(unstable))
if '--build' not in sys.argv:
    save('hashes-apres-tests.json', after)
reservation = trace_reservation(suites)
unexpected_failures = [x['suite'] for x in suites if x['code']
                       and not (x['suite'] == 'traces.test.mjs' and reservation['signature_heritee_identique'])]

if '--tests' in sys.argv:
    print(json.dumps({'etape': 'tests_finis', 'suites': len(suites),
                      'reussies': sum(x['code'] == 0 for x in suites),
                      'echecs': [x['suite'] for x in suites if x['code']],
                      'echecs_hors_reserve': unexpected_failures}), flush=True)
    raise SystemExit(1 if unexpected_failures or not suites else 0)

build1 = run(['python3', 'construire.py'], 'construction-1.log')
first = {f: sha(repo / f) for f in ['VERSION.json', 'SIZE.json', 'dist/bitume.html']}
build2 = run(['python3', 'construire.py'], 'construction-2.log')
second = {f: sha(repo / f) for f in first}
lock = json.loads((repo / 'FERRO.lock.json').read_text())
ferro_diff = [m['path'] for m in lock['modules'] if sha(repo / m['path']) != m['sha256']]
bundle = (repo / 'dist/bitume.html').read_text()
scripts = re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>', bundle)
syntax = []
with tempfile.TemporaryDirectory(prefix='bitume-p13-') as directory:
    for i, script in enumerate(scripts):
        path = Path(directory) / ('bundle-' + str(i) + '.js')
        path.write_text(script)
        syntax.append(run(['node', '--check', str(path)], 'syntaxe-' + str(i) + '.log'))
final = manifest()
save('hashes-apres-build.json', final)
check_archives(final)
check_laws(final)
unstable = sorted(p for p in set(after) | set(final) if after.get(p) != final.get(p))
if unstable:
    raise SystemExit('Sources, fixtures ou qualificateur modifiés pendant le build : ' + str(unstable))
revision_pistes = json.loads((repo / 'VERSION.json').read_text())['empreinte']
contrat_build = ('__REVISION_PISTES__' not in bundle and
                 "const REVISION_PISTES = '" + revision_pistes + "';" in bundle and
                 "PHYSIQUE = 'p13'" in bundle and
                 bundle.index('// ---- strategie-stands.js ----') < bundle.index('// ---- course.js ----') and
                 bundle.index('// ---- pneus-reseau.js ----') < bundle.index('// ---- jeu.js ----'))
fixture = json.loads((repo / FIXTURE).read_text())
report = {
    'date_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'version': json.loads((repo / 'VERSION.json').read_text())['version'], 'physique': 'p13',
    'suites': len(suites), 'reussies': sum(x['code'] == 0 for x in suites),
    'echecs': [x['suite'] for x in suites if x['code']], 'sources_stables': not unstable,
    'reserve_traces': reservation, 'echecs_hors_reserve': unexpected_failures,
    'base_preservee': {'commit': base['base_commit'], 'hashes': BASE_HASHES,
                      'lois_et_archives_inchangees': all(final.get(f) == expected for f, expected in BASE_HASHES.items()),
                      'lois_inchangees_depuis_base': all(final.get(f) == expected for f, expected in BASE_HASHES.items()
                                                          if not f.startswith('verifications/fixtures/'))},
    'determinisme': {'scenarios': len(fixture['cas']),
                    'empreintes': sum(len(c['empreintes']) for c in fixture['cas'].values()),
                    'fixture': FIXTURE, 'fixture_regeneree': False,
                    'fixture_regeneree_portee': 'Cette exécution de qualification uniquement ; la création initiale de p13 est une étape distincte.',
                    'fixture_creation_documentee': {
                        'recu_attendu': '../12F4-SORTIE-FILE-2026-11-19/CREATION-P13.json',
                        'recu_present': (out / '../12F4-SORTIE-FILE-2026-11-19/CREATION-P13.json').is_file(),
                        'note': 'La création initiale après validation comportementale doit être attestée dans ce reçu distinct ; sa seule présence ne certifie pas cette validation.'},
                    'fixture_inchangee': sha(repo / FIXTURE) == before[FIXTURE],
                    'verification': next((x['code'] for x in suites if x['suite'] == 'determinisme-simulation.test.mjs'), None),
                    'archives': {f: final[f] for f in ARCHIVES},
                    'archives_inchangees_depuis_base': all(final.get(f) == expected for f, expected in ARCHIVES.items())},
    'build': {'sha256': second['dist/bitume.html'], 'bytes': (repo / 'dist/bitume.html').stat().st_size,
              'reproductible': first == second, 'codes': [build1['code'], build2['code']], 'hashes': second},
    'bundle': {'scripts': len(scripts), 'codes': [x['code'] for x in syntax]},
    'ferro': {'version': lock['version'], 'modules': len(lock['modules']), 'ecarts': ferro_diff},
    'webgl_valide': False, 'deploiement_effectue': False,
    'lot': '13A-Russie-trace-relief', 'contrat_pistes': {'sha256': revision_pistes, 'build_verifie': contrat_build},
}
save('qualification-execution.json', report)
print(json.dumps({k: report[k] for k in ['version','physique','suites','reussies','echecs','sources_stables','echecs_hors_reserve','build','bundle','ferro','lot']}, ensure_ascii=False), flush=True)
if (unexpected_failures or not suites or report['determinisme']['verification'] != 0
        or any(x['code'] for x in syntax) or not scripts or not contrat_build or ferro_diff
        or first != second or build1['code'] or build2['code']):
    raise SystemExit(1)
