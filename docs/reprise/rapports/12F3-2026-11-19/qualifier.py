#!/usr/bin/env python3
"""Qualifier 12F3 depuis la racine du dépôt ; sorties longues conservées dans ce dossier."""
from pathlib import Path
import datetime
import hashlib
import json
import re
import subprocess
import tempfile
import time
import sys

repo = Path.cwd().resolve()
out = Path(__file__).resolve().parent
assert (repo / 'src/course.js').is_file()
assert "PHYSIQUE = 'p11'" in (repo / 'src/jeu.js').read_text()
commands = []
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def save(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def manifest():
    paths = [p for directory in ['src', 'verifications'] for p in (repo / directory).rglob('*') if p.is_file()]
    paths += [repo / f for f in ['construire.py', 'FERRO.lock.json']]
    return {str(p.relative_to(repo)): sha(p) for p in sorted(paths)}


def run(argv, log, timeout=300):
    started = time.monotonic()
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        result = subprocess.run(argv, cwd=repo, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
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


before = manifest()
save('hashes-qualification.json', before)
after_generation = before
generation = {'code': None}  # La fixture p11 existante est comparée, jamais régénérée.
if '--build' in sys.argv:
    saved = json.loads((out / 'hashes-apres-tests.json').read_text())
    if before != saved:
        raise SystemExit('Sources modifiées depuis les tests ; qualifier uniquement les écarts puis actualiser le reçu.')
    suites = json.loads((out / 'suites.json').read_text())
    commands = json.loads((out / 'commandes.json').read_text())
else:
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
save('hashes-apres-tests.json', after)
unstable = sorted(p for p in set(after_generation) | set(after) if after_generation.get(p) != after.get(p))
if unstable:
    raise SystemExit('Sources modifiées pendant les tests : ' + str(unstable))

if '--tests' in sys.argv:
    print(json.dumps({'etape': 'tests_finis', 'suites': len(suites), 'reussies': sum(x['code'] == 0 for x in suites), 'echecs': [x['suite'] for x in suites if x['code']]}), flush=True)
    raise SystemExit(0 if all(x['code'] == 0 or x['suite'] == 'traces.test.mjs' for x in suites) else 1)

build1 = run(['python3', 'construire.py'], 'construction-1.log')
first = {f: sha(repo / f) for f in ['VERSION.json', 'SIZE.json', 'dist/bitume.html']}
build2 = run(['python3', 'construire.py'], 'construction-2.log')
second = {f: sha(repo / f) for f in first}
lock = json.loads((repo / 'FERRO.lock.json').read_text())
ferro_diff = [m['path'] for m in lock['modules'] if sha(repo / m['path']) != m['sha256']]
bundle = (repo / 'dist/bitume.html').read_text()
scripts = re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>', bundle)
syntax = []
with tempfile.TemporaryDirectory(prefix='bitume-p11-') as directory:
    for i, script in enumerate(scripts):
        path = Path(directory) / ('bundle-' + str(i) + '.js')
        path.write_text(script)
        syntax.append(run(['node', '--check', str(path)], 'syntaxe-' + str(i) + '.log'))
revision_pistes = json.loads((repo / 'VERSION.json').read_text())['empreinte']
contrat_build = ('__REVISION_PISTES__' not in bundle and
                 "const REVISION_PISTES = '" + revision_pistes + "';" in bundle and
                 bundle.index('// ---- pneus-reseau.js ----') < bundle.index('// ---- jeu.js ----'))
fixture = json.loads((repo / 'verifications/fixtures/determinisme-p11.json').read_text())
report = {
    'date_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'version': json.loads((repo / 'VERSION.json').read_text())['version'], 'physique': 'p11',
    'suites': len(suites), 'reussies': sum(x['code'] == 0 for x in suites),
    'echecs': [x['suite'] for x in suites if x['code']], 'sources_stables': not unstable,
    'determinisme': {'scenarios': len(fixture['cas']),
                    'empreintes': sum(len(c['empreintes']) for c in fixture['cas'].values()),
                    'fixture_regeneree': False,
                    'fixture_inchangee': sha(repo / 'verifications/fixtures/determinisme-p11.json') == before['verifications/fixtures/determinisme-p11.json'],
                    'verification': next(x['code'] for x in suites if x['suite'] == 'determinisme-simulation.test.mjs'),
                    'archives': {f: after[f] for f in after if f.endswith(('determinisme-p9.json', 'determinisme-p10.json', 'determinisme-p11.json'))}},
    'build': {'sha256': second['dist/bitume.html'], 'bytes': (repo / 'dist/bitume.html').stat().st_size,
              'reproductible': first == second, 'codes': [build1['code'], build2['code']], 'hashes': second},
    'bundle': {'scripts': len(scripts), 'codes': [x['code'] for x in syntax]},
    'ferro': {'version': lock['version'], 'modules': len(lock['modules']), 'ecarts': ferro_diff},
    'webgl_valide': False, 'deploiement_effectue': False,
    'lot': '12F3', 'contrat_pistes': {'sha256': revision_pistes, 'build_verifie': contrat_build},
}
save('qualification-execution.json', report)
print(json.dumps(report, ensure_ascii=False), flush=True)
if any(x['suite'] != 'traces.test.mjs' and x['code'] for x in suites) or any(x['code'] for x in syntax) or not scripts or not contrat_build or ferro_diff or first != second or build1['code'] or build2['code']:
    raise SystemExit(1)
