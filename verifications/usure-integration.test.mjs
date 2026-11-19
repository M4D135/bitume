// Lot 12D : comportement du vrai pas de conduite et d'une course, sans rendu ni protocole réseau nouveau.
import '../src/circuit.js';
import '../src/conduite.js';
import '../src/degats.js';
import '../src/contacts.js';
import '../src/course.js';
import assert from 'node:assert/strict';

const B = globalThis.BITUME, U = B.usurePneus, dt = 1 / 120;
const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
const NEUTRE = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false,
  boite: 'auto', aide: 0, guidage: 0 };
const GAZ = { ...NEUTRE, gaz: 1 };
let controles = 0;
function verifier(nom, f) {
  f(); controles++; console.log('ok ' + nom);
}
function etat(type = 'slicks') {
  const e = B.conduite.creer(c.depart || 0, 0);
  Object.assign(e, B.pneus.creerEtat(type, { seance: 2046, voiture: 3 }));
  e.degats = B.degats.creer();
  return e;
}
function pas(e, commande, nombre) {
  for (let i = 0; i < nombre; i++) B.conduite.pas(e, commande, c, dt);
}
function pneus(e) {
  return structuredClone({ pneus: e.pneus, versionPneus: e.versionPneus,
    servicePneus: e.servicePneus, etatPneus: e.etatPneus });
}
function physique(e) {
  const copie = structuredClone(e);
  delete copie.etatPneus;
  return copie;
}

verifier('course réelle : pneus neufs indépendants, aucune usure sur la grille et aux feux', () => {
  const co = B.course.creer(c, { graine: 804, placeJoueur: 1 });
  assert.equal(co.voitures.length, 12);
  const avant = co.voitures.map(v => pneus(v.etat));
  const objets = co.voitures.flatMap(v => v.etat.etatPneus);
  assert.equal(new Set(objets).size, 48);
  assert.ok(objets.every(r => r.usure === 0 && r.salete === 0 && r.distance === 0));
  let n = 0;
  while (!co.feux.vert && n++ < 1200) B.course.pas(co, GAZ, dt);
  assert.ok(co.feux.vert, 'la séquence réelle de départ arrive au vert');
  assert.deepEqual(co.voitures.map(v => pneus(v.etat)), avant);
  for (let i = 0; i < 360; i++) B.course.pas(co, GAZ, dt);
  assert.ok(co.joueur.etat.etatPneus.every(r => r.distance > 0 && r.usure > 0), 'le départ fait évoluer les pneus du joueur');
  assert.ok(co.voitures.some(v => !v.joueur && v.etat.etatPneus.some(r => r.usure > 0)), 'les rivaux suivent le même branchement');
});

verifier('repos freiné et attente de marche arrière ne font pas avancer les pneus', () => {
  const e = etat('inter'), avant = pneus(e);
  pas(e, { ...NEUTRE, frein: 1 }, 240);
  assert.equal(e.v, 0);
  assert.deepEqual(pneus(e), avant);
  B.conduite.pas(e, { ...NEUTRE, frein: 1, marcheArriere: true }, c, dt);
  assert.equal(e.rapport, 1, 'premier pas encore en attente avant le recul');
  assert.deepEqual(pneus(e), avant);
});

verifier('vrai recul : usure malgré contacts dynamiques périmés, sans les réécrire', () => {
  const e = etat('pluie'); e.v = -1; e.rapport = -1;
  for (const r of e.roues) { r.charge = NaN; r.glisse = NaN; }
  e.patinage = 1;
  const contacts = structuredClone(e.roues);
  pas(e, { ...NEUTRE, frein: 1, marcheArriere: true }, 120);
  assert.ok(e.v < 0);
  assert.ok(e.etatPneus.every(r => r.distance > 0 && r.usure > 0));
  assert.ok(e.etatPneus.every(r => r.grainage === 0), 'aucun ancien patinage réutilisé');
  assert.deepEqual(e.roues, contacts);
  assert.equal(e.pneus, 'pluie');
});

verifier('vrai vol et réception : anciennes charges sans abrasion, monte et motifs conservés', () => {
  const e = etat('inter'); pas(e, GAZ, 120);
  assert.ok(e.etatPneus.some(r => r.usure > 0));
  const avant = pneus(e);
  B.conduite.lancerSaut(e, { duree: .5, h: .12 });
  let n = 0;
  while (e.saut && n++ < 120) B.conduite.pas(e, GAZ, c, dt);
  assert.equal(e.saut, null);
  assert.ok(e.bondT > 0 || e.recuperation, 'réception effectivement atteinte');
  assert.deepEqual(pneus(e), avant);
});

verifier('récupération automatique et replacement direct conservent usure, type et objets', () => {
  const e = etat('pluie'); pas(e, GAZ, 120);
  e.etatPneus[0].salete = .6;
  const avant = pneus(e), tableau = e.etatPneus, objets = tableau.slice();
  B.conduite.declencherAccident(e);
  let n = 0;
  while (e.recuperation && n++ < 120) B.conduite.pas(e, NEUTRE, c, dt);
  assert.equal(e.recuperation, null);
  assert.ok(e.repositionnements > 0, 'retour automatique effectué');
  assert.deepEqual(pneus(e), avant);
  B.conduite.replacer(e, c);
  assert.deepEqual(pneus(e), avant);
  assert.equal(e.etatPneus, tableau);
  objets.forEach((r, i) => assert.equal(e.etatPneus[i], r));
});

verifier('course en ligne : les voitures distantes ne sont pas usées une seconde fois localement', () => {
  const co = B.course.creer(c, { graine: 502, humains: {
    noms: ['Local', 'Distant'], locaux: [0], hote: false, enLigne: true
  } });
  co.phase = 'course'; co.feux.vert = true;
  const distantes = co.voitures.filter(v => v.distant);
  assert.ok(distantes.length > 0);
  for (const v of distantes) {
    v.etat.v = 30;
    for (const r of v.etat.etatPneus) { r.usure = .4; r.salete = .2; }
  }
  const avant = distantes.map(v => pneus(v.etat));
  for (let i = 0; i < 120; i++) B.course.pas(co, GAZ, dt);
  assert.deepEqual(distantes.map(v => pneus(v.etat)), avant);
  assert.ok(co.joueur.etat.etatPneus.some(r => r.usure > 0));
});

verifier('pas de conduite identiques avec et sans usure visuelle, événements inclus', () => {
  const reference = etat('pluie'), candidate = structuredClone(reference);
  try {
    for (let i = 0; i < 1200; i++) {
      const commande = i < 600 ? GAZ : i < 1080 ? { ...NEUTRE, frein: 1 } : { ...NEUTRE, frein: 1, marcheArriere: true };
      B.usurePneus = null;
      const evenements = B.conduite.pas(reference, commande, c, dt);
      B.usurePneus = U;
      assert.deepEqual(B.conduite.pas(candidate, commande, c, dt), evenements);
      if (i % 60 === 0) assert.deepEqual(physique(candidate), physique(reference));
    }
  } finally { B.usurePneus = U; }
  assert.deepEqual(physique(candidate), physique(reference));
  assert.ok(candidate.etatPneus.some(r => r.usure > 0));
  assert.ok(reference.etatPneus.every(r => r.usure === 0));
});

console.log(controles + ' contrôles intégration usure réussis');
