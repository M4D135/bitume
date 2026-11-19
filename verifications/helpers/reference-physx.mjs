// Deux contrats explicites : la simulation p14 historique et la géométrie de la scène qualifiée.
// Seul le champ scene peut employer la nouvelle référence ; aucun état ou bilan n'est écarté.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function validerScenesPhysX(reference, scenes, contenuHistorique) {
  assert.equal(reference.format, 'bitume-determinisme-physx-1');
  assert.equal(reference.physique, 'p14');
  assert.equal(scenes.format, 'bitume-scenes-physx-1');
  assert.equal(scenes.physique, 'p14');
  assert.equal(scenes.referenceHistorique.fichier, 'determinisme-p14.json');
  assert.equal(createHash('sha256').update(contenuHistorique).digest('hex'), scenes.referenceHistorique.sha256,
    'la fixture p14 historique a changé');
  assert.deepEqual(Object.keys(scenes.cas), Object.keys(reference.cas), 'la scène doit couvrir tous les cas p14, dans leur ordre');
  for (const nom of ['decor.js', 'baikal.js', 'batiments.js', 'solides-physx.js', 'moteur/renderer.js'])
    assert.match(scenes.sources[nom] || '', /^[0-9a-f]{64}$/, 'provenance géométrique absente : ' + nom);
  for (const [nom, scene] of Object.entries(scenes.cas)) {
    assert.deepEqual(Object.keys(scene).sort(), ['empreinte', 'statistiques'], 'contrat de scène fermé : ' + nom);
    assert.match(scene.empreinte, /^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(scene.statistiques).sort(), Object.keys(reference.cas[nom].scene.statistiques).sort());
    for (const n of Object.values(scene.statistiques)) assert.ok(Number.isSafeInteger(n) && n >= 0, 'compteur de scène invalide');
  }
  return scenes;
}

export function comparerDeterminismePhysX(attendu, obtenu, contexte, scenes = null) {
  assert.deepEqual(Object.keys(obtenu.cas), Object.keys(attendu.cas), contexte + ' : cas différents');
  if (scenes) assert.deepEqual(Object.keys(scenes.cas), Object.keys(attendu.cas), contexte + ' : référence de scène incomplète');
  for (const [nom, r] of Object.entries(obtenu.cas)) {
    const a = attendu.cas[nom];
    assert.equal(r.empreintes.length, a.empreintes.length, nom + ' : durée différente');
    for (let i = 0; i < r.empreintes.length; i++) if (r.empreintes[i] !== a.empreintes[i]) {
      const champs = Object.keys(r.couches[i]).filter(k => r.couches[i][k] !== a.couches[i]?.[k]);
      throw new Error(`${contexte} : divergence PhysX ${nom}, seconde ${i + 1}, couches ${champs.join(', ')} ; attendu ${a.empreintes[i]}, obtenu ${r.empreintes[i]}`);
    }
    if (!scenes) assert.deepEqual(r, a, contexte + ' : scène ou bilan différent pour ' + nom);
    else {
      const { scene: sceneHistorique, ...simulationAttendue } = a;
      const { scene, ...simulationObtenue } = r;
      assert.deepEqual(simulationObtenue, simulationAttendue, contexte + ' : état, couche, configuration ou bilan différent pour ' + nom);
      assert.deepEqual(scene, scenes.cas[nom], contexte + ' : géométrie de scène différente pour ' + nom);
    }
  }
}
