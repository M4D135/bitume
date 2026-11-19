#!/usr/bin/env python3
"""Qualification ciblée du lot visuel : sources figées, lois p13 conservées, deux builds.

La suite complète et les parcours 13A ne sont pas rejoués ici. La CI reste distincte.
Aucun oracle ni seuil n'est modifié par ce script. Les échecs restent dans le rapport brut.
"""
from pathlib import Path
import datetime
import hashlib
import json
import re
import subprocess
import tempfile
import time

REPO = Path.cwd().resolve()
OUT = Path(__file__).resolve().parent
BASE = 'f03a99cc0a5bcbd663a7ff25c887c4ea9ecacd0c'
TESTS = '''virages reperes-virages hud-pneus options-image qualite conditions-integration
autoconfig-integration chargement commandes-partage navigation-menu titre-signature graphismes
decor-identite decor-obstacles decor arbres-lots vegetation bords bords-integration saisons
herbier-saisons tunnel tunnel-transitions ambiance moteur-emprise ombres rendu-halo usure-visuelle
pneus-service-visuel chaussee-visuelle meteo meteo-toile son cadence controle-visuel scene-bench
voiture-identite effets-allocation traces'''.split()
LOIS = ['src/' + x + '.js' for x in '''circuit pneus usure-pneus chaussee conduite degats contacts
obstacles strategie-stands course bords'''.split()]
LOIS += ['src/ferro/' + x + '.js' for x in ['fmath', 'vehicle-dynamics', 'physx', 'physx-runtime']]
LOIS += ['verifications/fixtures/determinisme-p' + str(n) + '.json' for n in range(9, 14)]
sha = lambda b: hashlib.sha256(b).hexdigest()
commands = []


def save(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def manifest():
    paths = [p for root in ['src', 'verifications'] for p in (REPO / root).rglob('*') if p.is_file()]
    paths += [REPO / 'construire.py', REPO / 'FERRO.lock.json']
    return {str(p.relative_to(REPO)): sha(p.read_bytes()) for p in sorted(paths)}


def run(name, args, timeout=600):
    start = time.monotonic()
    p = subprocess.run(args, cwd=REPO, text=True, capture_output=True, timeout=timeout)
    log = p.stdout + p.stderr
    (OUT / (name + '.log')).write_text(log)
    item = dict(nom=name, commande=args, code=p.returncode, secondes=round(time.monotonic()-start, 3),
                journal=name + '.log', sha256_journal=sha(log.encode()))
    commands.append(item)
    save('commandes.json', commands)
    return item


assert "PHYSIQUE = 'p13'" in (REPO / 'src/jeu.js').read_text()
initial = manifest()
save('sources-avant.json', initial)
physique = []
for nom in LOIS:
    avant = subprocess.check_output(['git', 'show', BASE + ':' + nom], cwd=REPO)
    actuel = (REPO / nom).read_bytes()
    physique.append(dict(path=nom, sha256=sha(actuel), identique=actuel == avant))
save('physique-p13.json', dict(base=BASE, fichiers=physique))
assert all(p['identique'] for p in physique), 'Les lois ou fixtures p13 ont changé : requalification nécessaire.'

suites = [run(nom, ['node', 'verifications/' + nom + '.test.mjs']) for nom in TESTS]
save('suites.json', suites)
lock = run('ferro-lock', ['python3', 'tools/check-ferro-lock.py'])
assert lock['code'] == 0, 'Copies FERRO divergentes.'

builds = []
for i in range(2):
    r = run('build-' + str(i + 1), ['python3', 'construire.py'])
    assert r['code'] == 0, 'Construction échouée.'
    page = (REPO / 'dist/bitume.html').read_bytes()
    builds.append(dict(octets=len(page), sha256=sha(page), version=json.loads((REPO / 'VERSION.json').read_text())['version']))
assert builds[0] == builds[1], 'Constructions non reproductibles.'

scripts = re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>', page.decode())
with tempfile.TemporaryDirectory(prefix='bitume-virages-syntaxe-') as d:
    echecs = []
    for i, source in enumerate(scripts):
        p = Path(d) / (str(i) + '.js'); p.write_text(source)
        r = subprocess.run(['node', '--check', str(p)], text=True, capture_output=True)
        if r.returncode: echecs.append(dict(script=i, erreur=r.stderr))
save('syntaxe.json', dict(scripts=len(scripts), echecs=echecs))
assert not echecs, 'Syntaxe invalide dans le build.'
final = manifest()
save('sources-apres.json', final)
assert initial == final, 'Sources changées pendant la qualification.'
rapport = dict(date_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
               base=BASE, portee='39 suites ciblées du lot visuel ; CI complète distincte ; parcours 13A non rejoués',
               suites=len(suites), reussies=sum(s['code'] == 0 for s in suites),
               echecs=[s['nom'] for s in suites if s['code']], lois_p13_identiques=len(physique),
               ferro=json.loads((REPO / 'FERRO.lock.json').read_text())['version'],
               builds=builds, reproductible=True, scripts=len(scripts), sources_stables=True,
               webgl_scene_bitume=False, fps_materiels_mesures=False)
save('qualification-execution.json', rapport)
print(json.dumps(rapport, ensure_ascii=False))
raise SystemExit(int(bool(rapport['echecs'])))
