#!/usr/bin/env python3
"""Contrôles bornés après revue de 12F2 ; le premier passage reste conservé."""
from pathlib import Path
import datetime, hashlib, json, subprocess, time
repo = Path.cwd().resolve()
out = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def save(n, v): (out/n).write_text(json.dumps(v, ensure_ascii=False, indent=2)+'\n')
def manifest():
    paths = [p for d in ['src','verifications'] for p in (repo/d).rglob('*') if p.is_file()]
    paths += [repo/f for f in ['construire.py','FERRO.lock.json']]
    return {str(p.relative_to(repo)):sha(p) for p in sorted(paths)}
initial = json.loads((out/'hashes-apres-tests-premier-passage.json').read_text())
before = manifest()
changes = sorted(p for p in set(initial)|set(before) if initial.get(p)!=before.get(p))
attendus = {'src/course.js','src/jeu.js','verifications/conditions-integration.test.mjs','verifications/options-image.test.mjs','verifications/qualite.test.mjs','verifications/prets-enligne.test.mjs'}
assert set(changes) <= attendus, changes
suites = json.loads((out/'suites-premier-passage.json').read_text())
commands = json.loads((out/'commandes-premier-passage.json').read_text())
noms = ['conditions-integration','options-image','qualite','prets-enligne','choix-pneus-integration','chaussee-preparation','pneus-pilotes','stands-pneus','stands','pneus-service-visuel','determinisme-simulation','chargement','commandes-partage']
resultats = []
for nom in noms:
    argv = ['node','verifications/'+nom+'.test.mjs']
    t=time.monotonic(); stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    r=subprocess.run(argv, cwd=repo, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
    log='corrections/'+nom+'.test.mjs.log'; p=out/log; p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(r.stdout)
    row={'suite':nom+'.test.mjs','argv':argv,'date_utc':stamp,'code':r.returncode,'duree_s':round(time.monotonic()-t,3),'log':log,'sha256_log':sha(p)}
    resultats.append(row);commands.append({k:v for k,v in row.items() if k!='suite'})
    for i,s in enumerate(suites):
        if s['suite']==row['suite']:suites[i]=row;break
    save('corrections.json',{'fichiers_modifies':changes,'resultats':resultats})
    print(json.dumps({'suite':row['suite'],'code':r.returncode}),flush=True)
after=manifest(); assert before==after, 'Sources modifiées pendant la requalification'
save('hashes-apres-tests.json',after);save('suites.json',suites);save('commandes.json',commands)
recap={'fichiers_modifies':changes,'resultats':resultats,'sources_stables':True,'premier_passage':{'suites':103,'reussies':98},'apres_corrections':{'suites':len(suites),'reussies':sum(s['code']==0 for s in suites),'echecs':[s['suite'] for s in suites if s['code']]}}
save('corrections.json',recap);print(json.dumps(recap['apres_corrections']),flush=True)
if any(r['code'] for r in resultats):raise SystemExit(1)
