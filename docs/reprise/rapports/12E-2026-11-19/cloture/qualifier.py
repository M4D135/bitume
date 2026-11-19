#!/usr/bin/env python3
"""Qualification finale bornée 12E ; sorties et commandes complètes conservées."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys
import time

repo = Path.cwd().resolve()
out = Path(__file__).resolve().parent
assert (repo / 'src/course.js').is_file(), 'Exécuter depuis la racine du dépôt.'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
commands = []


def digest(data):
    return hashlib.sha256(data).hexdigest()


def save(name, data):
    (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def manifest():
    paths = []
    for directory in ['src', 'verifications']:
        paths.extend(p for p in (repo / directory).rglob('*') if p.is_file())
    paths.extend(repo / name for name in ['construire.py', 'FERRO.lock.json'])
    return {str(p.relative_to(repo)): digest(p.read_bytes()) for p in sorted(paths)}


def changes(a, b):
    return sorted(p for p in set(a) | set(b) if a.get(p) != b.get(p))


def run(argv, name, timeout=300):
    before = time.monotonic()
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        completed = subprocess.run(argv, cwd=repo, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, timeout=timeout)
        code, raw = completed.returncode, completed.stdout
    except subprocess.TimeoutExpired as error:
        code, raw = 124, error.stdout or b''
        raw += b'\nQUALIFICATION TIMEOUT\n'
    (out / name).parent.mkdir(parents=True, exist_ok=True)
    (out / name).write_bytes(raw)
    result = {'argv': argv, 'cwd': str(repo), 'date_utc': stamp,
              'code': code, 'duree_s': round(time.monotonic() - before, 3),
              'log': name, 'sha256_log': digest(raw)}
    commands.append(result)
    save('commandes.json', commands)
    return result, raw


before_generation = manifest()
save('hashes-avant-generation.json', before_generation)
p9 = 'verifications/fixtures/determinisme-p9.json'
p10 = 'verifications/fixtures/determinisme-p10.json'
old_p10 = (repo / p10).read_bytes()
(out / 'determinisme-p10-avant-cloture.json').write_bytes(old_p10)
generation, raw = run(['node', 'verifications/determinisme-simulation.test.mjs', '--ecrire'],
                      'determinisme-generation.log')
after_generation = manifest()
save('hashes-qualification.json', after_generation)
generation_changes = changes(before_generation, after_generation)
save('generation.json', {'execution': generation,
                        'fichiers_changes': generation_changes,
                        'p9_inchangee': before_generation[p9] == after_generation[p9],
                        'fixture_p10_changee': old_p10 != (repo / p10).read_bytes(),
                        'fixture_p10_sha256': after_generation[p10]})
print(json.dumps({'etape': 'generation_p10', 'code': generation['code'],
                  'changements': generation_changes}), flush=True)
if generation['code'] or any(p != p10 for p in generation_changes):
    raise SystemExit('Génération échouée ou modification inattendue ; qualification arrêtée.')

suites = []
files = sorted((repo / 'verifications').glob('*.test.mjs'))
assert len(files) == 98, f'Nombre de suites inattendu : {len(files)}'
with (out / 'tests.log').open('wb') as aggregate:
    for index, suite in enumerate(files, 1):
        result, raw = run(['node', str(suite.relative_to(repo))], 'tests/' + suite.name + '.log')
        record = {'suite': suite.name, **result}
        suites.append(record)
        aggregate.write(('\n=== ' + suite.name + ' ===\n').encode() + raw)
        aggregate.flush()
        save('suites.json', suites)
        if index % 10 == 0 or result['code'] or index == len(files):
            print(json.dumps({'etape': 'suites', 'terminees': index, 'total': len(files),
                              'echecs': [x['suite'] for x in suites if x['code']]}), flush=True)

independent, raw = run(['node', 'verifications/determinisme-simulation.test.mjs'],
                       'determinisme-verification-independante.log')
print(json.dumps({'etape': 'determinisme_independant', 'code': independent['code']}), flush=True)
viability, raw = run(['node', 'docs/reprise/rapports/12E-2026-11-19/viabilite.mjs',
                      str(repo), str(out / 'viabilite')], 'viabilite.log')
print(json.dumps({'etape': 'viabilite', 'code': viability['code']}), flush=True)

after = manifest()
save('hashes-apres-qualification.json', after)
source_changes = changes(after_generation, after)
viability_report = json.loads((out / 'viabilite/rapport.json').read_text())
brief = []
for scenario in viability_report['scenarios']:
    brief.append({key: scenario[key] for key in ['id', 'fin', 'arrives', 'voituresTotal',
                  'replacements', 'maxUsure', 'stagnants15s', 'anomalies']})
fixture = json.loads((repo / p10).read_text())
summary = {
    'date_debut_utc': started,
    'date_fin_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'node': subprocess.check_output(['node', '--version'], text=True).strip(),
    'generation': generation,
    'suites': len(suites),
    'reussies': sum(x['code'] == 0 for x in suites),
    'echecs': [x['suite'] for x in suites if x['code']],
    'determinisme_suite': next(x for x in suites if x['suite'] == 'determinisme-simulation.test.mjs'),
    'determinisme_independant': independent,
    'scenarios_determinisme': len(fixture['cas']),
    'empreintes_determinisme': sum(len(case['empreintes']) for case in fixture['cas'].values()),
    'p9_sha256': after[p9],
    'p9_inchangee': before_generation[p9] == after[p9],
    'p10_sha256': after[p10],
    'hashes_sources_tests_fixtures': len(after),
    'changements_generation': generation_changes,
    'changements_pendant_qualification': source_changes,
    'viabilite_execution': viability,
    'viabilite_scenarios': brief,
    'webgl_valide': False,
    'note': 'Traces hérité reste un échec. Les parcours s’arrêtent selon les règles du jeu, sans forcer toutes les arrivées. Aucun déploiement ni mesure matérielle déduit de ces contrôles CPU.'
}
save('qualification-execution.json', summary)
print(json.dumps({'etape': 'termine', 'suites': summary['suites'], 'reussies': summary['reussies'],
                  'echecs': summary['echecs'], 'sources_changes': source_changes,
                  'scenarios_viabilite': len(brief), 'p9_inchangee': summary['p9_inchangee']}), flush=True)
if source_changes or independent['code'] or viability['code']:
    raise SystemExit(2)
