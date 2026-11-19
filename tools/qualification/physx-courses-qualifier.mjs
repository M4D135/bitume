// Qualification des observations du vrai WASM, sans réécrire les traces brutes.
// L'outil de simulation reste un diagnostic ; ce bilan refuse une couverture partielle.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = 'docs/reprise/rapports/PHYSX-SOLS-PILOTES-2026-11-19/';
const inputs = process.argv.slice(2);
if (!inputs.length) inputs.push(folder + 'physx-courses-huit-circuits.json', folder + 'physx-courses-complement-deux-circuits.json');
const attendu = ['val-brule', 'port-sable', 'haut-col', 'lande-noire', 'roche-fauve', 'brume-de-jade', 'cap-sequoia', 'baikal'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const resultats = [], preuves = [], seen = new Set();
let reference = null;
for (const name of inputs) {
  const path = resolve(root, name), bytes = readFileSync(path), r = JSON.parse(bytes);
  assert.equal(r.backend.ready, true, name + ' : PhysX doit être prêt');
  assert.equal(r.backend.version, '5.12.0', name + ' : version native inattendue');
  assert.equal(r.dt, 1 / 120, name + ' : pas fixe inattendu');
  assert.equal(r.duree, 120, name + ' : protocole 120 s incomplet');
  if (reference) assert.deepEqual(r.empreintes, reference, name + ' : sources différentes des autres observations');
  reference = r.empreintes;
  for (const [file, expected] of Object.entries(r.empreintes)) {
    const source = file === 'adaptateurPhysX' ? 'src/ferro/physx.js' : file;
    assert.equal(hash(readFileSync(resolve(root, source))), expected, source + ' : sources actuelles différentes du relevé');
  }
  preuves.push({ fichier: relative(root, path), sha256: hash(bytes), date: r.date,
    circuits: r.resultats.map(row => row.circuit), adaptateurObserve: r.adapter });
  for (const row of r.resultats) {
    assert(attendu.includes(row.circuit) && !seen.has(row.circuit), 'circuit inconnu ou doublon : ' + row.circuit);
    seen.add(row.circuit);
    assert(!row.erreur, row.circuit + ' : ' + row.erreur);
    assert.equal(row.meteo, 'sec', row.circuit + ' : météo hors protocole');
    assert.equal(row.frames, 14400, row.circuit + ' : simulation incomplète');
    assert.equal(row.mondesRestants, 0, row.circuit + ' : scène native non libérée');
    assert.deepEqual(row.voitures.map(v => v.id).sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i), row.circuit + ' : douze voitures requises');
    assert(Number.isFinite(row.minChassisTrianglesVisibles), row.circuit + ' : aucune sonde sol');
    assert(row.minChassisTrianglesVisibles >= -.15, row.circuit + ' : repère caisse à plus de 15 cm sous les triangles visibles');
    const replacements = row.voitures.reduce((n, v) => n + v.replacements, 0);
    assert.equal(row.placements, replacements, row.circuit + ' : placements non comptabilisés');
    for (const key of ['pose', 'vitesse', 'rotation']) assert.equal(row.corrections[key], replacements, row.circuit + ' : corrections natives non expliquées par un retour après accident');
    const stagnations = [];
    for (const v of row.voitures) {
      assert([v.progression, v.s, v.d, v.v, ...v.usures].every(Number.isFinite), row.circuit + ' : état final non fini');
      assert(v.progression > 0, row.circuit + ' : voiture sans progression');
      const points = row.points.filter(p => p.t >= 10);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1].cars.find(c => c.id === v.id), b = points[i].cars.find(c => c.id === v.id);
        if (Math.abs(a.v) < 1 && Math.abs(b.v) < 1 && Math.abs(b.s - a.s) < 1)
          stagnations.push({ voiture: v.id, debut: points[i - 1].t, fin: points[i].t });
      }
    }
    resultats.push({ circuit: row.circuit, reussi: true, voitures: row.voitures.length, pas: row.frames,
      contacts: row.contacts, chocs: row.chocs, replacements, corrections: row.corrections,
      minRepereCaisseSolVisibleM: row.minChassisTrianglesVisibles, maxDecalageLateralM: row.maxAbsD,
      vitesseFinaleMinMS: Math.min(...row.voitures.map(v => v.v)),
      progressionMinM: Math.min(...row.voitures.map(v => v.progression)),
      toursFinisMin: Math.min(...row.voitures.map(v => v.tours)),
      stagnationsEchantillonnees: stagnations, mondesRestants: row.mondesRestants });
  }
}
assert.deepEqual([...seen].sort(), [...attendu].sort(), 'les huit circuits doivent être effectivement observés');
resultats.sort((a, b) => attendu.indexOf(a.circuit) - attendu.indexOf(b.circuit));
const bilan = { date: new Date().toISOString(), statut: 'reussi',
  outilQualification: { fichier: relative(root, fileURLToPath(import.meta.url)), sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
  protocole: { backend: 'PhysX 5.12.0 WASM embarqué', circuits: attendu.length, voituresParCircuit: 12,
    secondesParCircuit: 120, dt: 1 / 120, meteo: 'sec', saison: 'ete', qualiteDecor: 'high', graineCourse: 42,
    interventions: 'IA sur les douze voitures ; collisions et retours après accident autorisés par la course' },
  controles: ['couverture des huit circuits', 'douze états PhysX par course', '14400 pas par circuit',
    'états finis à chaque pas (outil source)', 'repère de caisse au-dessus du seuil de -15 cm sous les triangles visibles dans le couloir central',
    'corrections de pose/vitesse expliquées uniquement par les replacements après accident', 'aucune scène native restante'],
  resultats, preuves, empreintes: reference,
  limites: ['120 s par circuit : toutes les voitures ne terminent pas un tour complet.',
    'Les sondes de hauteur concernent le couloir central de la chaussée (largeur/2 moins 1 m) ; le terrain hors route n’est pas exhaustivement contrôlé.',
    'Le seuil de -15 cm porte sur le repère du châssis, pas sur une intersection triangle par triangle de la carrosserie visible.',
    'Les stagnations sont observées toutes les 10 s après la grille ; aucun délai maximal de blocage continu ne peut être déduit de ces seules traces.',
    'Ce bilan ne valide ni la pluie/neige sur tous les circuits, ni le rendu navigateur, ni les FPS matériels.'] };
const output = resolve(root, folder + 'physx-courses-huit-circuits-qualification.json');
writeFileSync(output, JSON.stringify(bilan, null, 2) + '\n');
console.log(JSON.stringify({ statut: bilan.statut, circuits: resultats.length,
  pas: resultats.reduce((n, r) => n + r.pas, 0), etatsVoitures: resultats.reduce((n, r) => n + r.pas * r.voitures, 0),
  replacements: resultats.reduce((n, r) => n + r.replacements, 0),
  minRepereCaisseSolVisibleM: Math.min(...resultats.map(r => r.minRepereCaisseSolVisibleM)),
  fichier: relative(root, output) }));
