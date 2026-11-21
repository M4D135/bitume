// Partage effectif des états identiques : aucun doublon de géométrie à préparer
// pour l'instant où un geste commence depuis la main ouverte.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const avantPartage = new WeakMap(), preuvesPartage = new Map();
function empreinteTriangles(triangles) {
  const h = createHash('sha256'), nombres = new Float64Array(18), octets = new Uint8Array(nombres.buffer);
  for (const t of triangles) {
    for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) nombres[i * 3 + k] = t[i][k];
    h.update(octets);
  }
  return h.digest('hex');
}
const registres = new Map(), contexte = vm.createContext({ console,
  window: { FRender: { forme(nom, triangles) {
    assert.ok(!registres.has(nom), 'forme enregistrée une seule fois : ' + nom);
    registres.set(nom, triangles);
    if (nom.startsWith('bitume-main-')) preuvesPartage.set(nom, {
      avant: avantPartage.get(triangles), apres: empreinteTriangles(triangles)
    });
  } } }
});
for (const nom of ['carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'voiture.js']) {
  if (nom === 'voiture.js') {
    // La normalisation commune reste la référence indépendante. Comparer les
    // Float64 avant enregistrement, y compris -0, exclut une soudure approchée.
    const normaliser = contexte.BITUME.carene.normaliser;
    contexte.BITUME.carene.normaliser = triangles => {
      const n = normaliser(triangles);
      avantPartage.set(n.triangles, empreinteTriangles(n.triangles));
      return n;
    };
  }
  vm.runInContext(fs.readFileSync(path.join(racine, 'src', nom), 'utf8'), contexte, { filename: nom });
}
const { main: M, voiture: V } = contexte.BITUME;
const modele = V.modele({ couleur: [.8, .12, .1], combinaison: [.9, .85, .7], numero: 27 });

test('le partage réduit les tableaux retenus sans changer les triangles ni les zéros signés', () => {
  let references = 0, uniques = 0;
  assert.ok(preuvesPartage.size > 90, 'tous les états des deux mains sont contrôlés');
  for (const [nom, preuve] of preuvesPartage) {
    assert.equal(preuve.apres, preuve.avant, nom + ' : mêmes coordonnées Float64 dans le même ordre');
    const triangles = registres.get(nom), points = new Set(triangles.flat());
    references += triangles.length * 6; uniques += points.size;
    assert.ok([...points].every(Object.isFrozen), nom + ' : les coordonnées partagées sont immuables');
  }
  assert.ok(uniques < references * .4, 'au moins 60 % de tableaux évités à géométrie identique');
  console.log(JSON.stringify({ partageMains: { references, tableauxUniques: uniques } }));
});

test('le premier état de chaque geste est exactement la prise ouverte partagée', () => {
  const ouvert = M.construire(1).prise;
  for (const geste of ['majeur', 'poing', 'salut'])
    assert.deepEqual(M.construire(1, { geste, progression: 0 }).prise, ouvert,
      'le partage est licite seulement si les vrais triangles sont identiques : ' + geste);
  for (const main of modele.objetsRendu.habitacle.mains) {
    const doigts = main.pieces[0], prise = doigts.prises.at(-1);
    assert.equal(doigts.prises.length, 13, 'treize états d’ouverture conservés');
    for (const etats of doigts.gestes.slice(1)) {
      assert.equal(etats.length, 13, 'treize états de geste conservés');
      assert.deepEqual(etats[0], prise, 'mêmes forme, centre et taille pour la transition');
      assert.ok(etats.slice(1).every(f => f.nom !== prise.nom), 'les autres états restent distincts');
    }
  }
});

test('chaque géométrie utilisée est préparée une seule fois par packer, sans créer de forme', () => {
  const avant = registres.size, sortie = [], attendues = new Set();
  for (const main of modele.objetsRendu.habitacle.mains) {
    const doigts = main.pieces[0];
    for (const f of [...doigts.prises, ...doigts.gestes.slice(1).flat()]) attendues.add(f.nom);
  }
  const nombre = V.preparerExpressions(sortie, [1, 2, 3]);
  assert.equal(nombre, sortie.length);
  assert.equal(nombre, attendues.size * 2, 'exactement une préparation par forme et packer');
  assert.equal(new Set(sortie.map(o => o.shape + '/' + o.overlay)).size, sortie.length, 'aucun doublon');
  assert.deepEqual(new Set(sortie.map(o => o.shape)), attendues, 'toutes les formes réellement sélectionnables');
  for (const f of attendues) {
    assert.ok(registres.has(f), 'géométrie enregistrée avant la chauffe : ' + f);
    for (const overlay of [false, true]) assert.ok(sortie.some(o => o.shape === f && o.overlay === overlay));
  }
  assert.equal(registres.size, avant, 'aucune forme enregistrée pendant le préchauffage');
});
