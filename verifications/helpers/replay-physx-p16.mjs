// Le calcul de référence et le jeu utilisent la même plateforme, avec des sources complètes indépendantes.
// Les trois fichiers PhysX communs sont volumineux et déjà fournis par la distribution verrouillée.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
const sha = v => createHash('sha256').update(v).digest('hex');
export function rejouerPhysiqueDeReference() {
  const contenu = gunzipSync(readFileSync(new URL('../fixtures/replay-physx-c38a28c.json.gz', import.meta.url)));
  assert.equal(sha(contenu), '6e3aaa184f6900f37b873a99acc7c59b9294e9e6878bac86267a2674d100c6fa');
  const reference = JSON.parse(contenu);
  const dossier = mkdtempSync(path.join(tmpdir(), 'bitume-replay-'));
  try {
    for (const [nom,source] of Object.entries(reference.sources)) {
      const cible = path.join(dossier,nom);
      mkdirSync(path.dirname(cible),{recursive:true}); writeFileSync(cible,source);
    }
    for (const [nom,empreinte] of Object.entries(reference.communs)) {
      const source = new URL('../../'+nom, import.meta.url);
      assert.equal(sha(readFileSync(source)),empreinte,nom+' diffère du canon du témoin '+reference.commit);
      const cible = path.join(dossier,nom);
      mkdirSync(path.dirname(cible),{recursive:true}); copyFileSync(source,cible);
    }
    const environnement = {...process.env};
    delete environnement.BITUME_PHYSX_ADAPTER;
    const sortie = execFileSync(process.execPath,['verifications/determinisme-simulation.test.mjs','--physx-worker'],
      {cwd:dossier,env:environnement,encoding:'utf8',maxBuffer:16*1024*1024});
    const debut = '@@BITUME_DETERMINISME_PHYSX@@';
    const ligne = sortie.split('\n').find(l => l.startsWith(debut));
    assert.ok(ligne,'le témoin du commit '+reference.commit+' a terminé son replay');
    return JSON.parse(ligne.slice(debut.length));
  } finally { rmSync(dossier,{recursive:true,force:true}); }
}
