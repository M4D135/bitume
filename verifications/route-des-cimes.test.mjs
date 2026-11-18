// Garde le huitième circuit « Route-des-Cimes », tracé par la partition src/partitions.js
// et construit par B.circuit.creer. Les sept circuits précédents ne changent pas.
// Vérifie le catalogue, la géométrie (rampe du Mur, tunnels, ponts, bords, stands),
// la détermination (deux constructions identiques) et la robustesse numérique (sinus perturbé).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { lireCatalogue } from '../tools/circuits-commun.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require(path.join(ici, '..', 'src', 'circuit.js'));
require(path.join(ici, '..', 'src', 'partitions.js'));
const B = globalThis.BITUME;

let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok  ' + nom); };

const cree = () => B.circuit.creer(181, { theme: 'montagne', longueur: 9700, nom: 'Route-des-Cimes', partition: 'route-des-cimes' });
const c = cree();

verifier('Catalogue : 8 entrées, graines uniques, champs du huitième', () => {
  const cat = lireCatalogue(path.join(ici, '..', 'src'));
  assert.equal(cat.length, 8);
  const attendus = [
    ['val-brule', 11, 'foret', 4200],
    ['port-sable', 29, 'cote', 3600],
    ['haut-col', 47, 'montagne', 5200],
    ['lande-noire', 83, 'islande', 4600],
    ['roche-fauve', 107, 'desert', 4800],
    ['brume-de-jade', 131, 'asie', 5000],
    ['cap-sequoia', 157, 'pacifique', 5200]
  ];
  for (let i = 0; i < 7; i++) {
    const e = cat[i];
    assert.equal(e.id, attendus[i][0]);
    assert.equal(e.graine, attendus[i][1]);
    assert.equal(e.theme, attendus[i][2]);
    assert.equal(e.longueur, attendus[i][3]);
    assert.ok(!('partition' in e), 'pas de partition pour ' + e.id);
    assert.ok(!('tours' in e), 'pas de tours pour ' + e.id);
  }
  const h = cat[7];
  assert.equal(h.id, 'route-des-cimes');
  assert.equal(h.nom, 'Route-des-Cimes');
  assert.equal(h.theme, 'montagne');
  assert.equal(h.graine, 181);
  assert.equal(h.partition, 'route-des-cimes');
  assert.equal(h.tours, 2);
  const graines = cat.map(e => e.graine);
  assert.equal(new Set(graines).size, 8);
});

verifier('Construction : dimensions, validation, vitesse, erreur partition', () => {
  assert.equal(c.n, 4849);
  assert.equal(c.longueur, 9698);
  assert.equal(c.generation, 3);
  assert.equal(c.id, 'route-des-cimes');
  assert.equal(c.graine, 181);
  assert.equal(c.theme, 'montagne');
  assert.deepEqual(B.circuit.valider(c), []);
  assert.equal(c.vitesse, c.vitesseP9);
  assert.throws(() => B.circuit.creer(1, { partition: 'inconnue' }), /partition inconnue/);
});

verifier('Rampe du Mur : pente max 0.30, localisation, bornes hors rampe', () => {
  assert.equal(c.rampes.length, 1);
  const r = c.rampes[0];
  assert.equal(r.nom, 'Le Mur');
  assert.ok(Math.abs(r.penteMax - 0.30) < 1e-12);
  assert.ok(r.debut < 2344.45 && 2344.45 < r.fin);
  assert.ok(r.fin - r.debut >= 550 && r.fin - r.debut <= 650);
  let maxAbs = 0;
  let idxMax = -1;
  let minPente = Infinity;
  for (let i = 0; i < c.n; i++) {
    const s = 2 * i;
    const p = c.pente[i];
    const ap = Math.abs(p);
    if (ap > maxAbs) { maxAbs = ap; idxMax = i; }
    if (p < minPente) minPente = p;
    if (s >= r.debut && s <= r.fin) {
      // dans la rampe
    } else {
      assert.ok(ap <= 0.10 + 1e-9, 'pente hors rampe trop forte à s=' + s);
    }
  }
  assert.ok(Math.abs(maxAbs - 0.30) < 1e-9);
  const sMax = 2 * idxMax;
  assert.ok(sMax >= r.debut && sMax <= r.fin, 'max pente hors rampe déclarée');
  assert.ok(minPente >= -0.10 - 1e-9);
});

verifier('valider refuse pente hors rampes déclarées (3 cas)', () => {
  const casA = { ...c, rampes: [] };
  const resA = B.circuit.valider(casA);
  assert.ok(resA.some(m => /pente supérieure à 10 %/.test(m)), 'cas a');

  const casB = { ...c, rampes: [{ ...c.rampes[0], penteMax: 0.25 }] };
  const resB = B.circuit.valider(casB);
  assert.ok(resB.some(m => /pente supérieure à 10 %/.test(m)), 'cas b');

  const penteMod = c.pente.slice();
  // indice 3000 correspond à s = 6000 m (hors rampe)
  penteMod[3000] = 0.12;
  const casC = { ...c, pente: penteMod };
  const resC = B.circuit.valider(casC);
  assert.ok(resC.some(m => /pente supérieure à 10 %/.test(m)), 'cas c');
});

verifier('Mesures de l’étude : chargeMin, penteMax, penteMin', () => {
  const m = B.circuit.trace.construire(B.partitions['route-des-cimes']);
  assert.deepEqual(B.circuit.trace.controler(m), []);
  assert.ok(m.mesures.chargeMin >= 0.6);
  assert.ok(Math.abs(m.mesures.penteMax - 30) < 0.01);
  assert.ok(m.mesures.penteMin >= -10.01);
});

verifier('Passages couverts, pont, bords, lieux', () => {
  assert.ok(c.tunnel.fin - c.tunnel.debut >= 300 && c.tunnel.fin - c.tunnel.debut <= 310);
  assert.equal(B.circuit.dansTunnel(c, 4400), true);
  assert.equal(B.circuit.dansTunnel(c, 4000), false);
  assert.deepEqual(c.couverts.map(t => t.type), ['tunnel', 'galerie', 'tunnel']);
  assert.deepEqual(c.couverts.map(t => t.nom), ['Tunnel du Rocher', 'Galerie des Avalanches', 'Tunnel des Échelles']);
  assert.equal(c.ponts.length, 1);
  assert.equal(c.ponts[0].type, 'arche');
  assert.equal(c.ponts[0].nom, 'Pont de la Gorge');
  assert.equal(c.bords.length, 7);
  const typesBords = new Set(c.bords.map(b => b.type));
  assert.deepEqual([...typesBords].sort(), ['arbres', 'muret', 'vide']);
  assert.equal(c.lieux.length, 7);
  for (let i = 0; i < 7; i++) {
    const l = c.lieux[i];
    assert.equal(l.n, i + 1);
    assert.ok(l.debut < l.fin);
    assert.ok(l.nom.length > 0);
  }
});

verifier('Stands et grille : droites et plates', () => {
  assert.notEqual(c.stands, null);
  assert.equal(c.stands.debut, 30);
  assert.equal(c.stands.fin, 220);
  assert.equal(c.stands.garage0, 70);
  assert.equal(c.stands.garage1, 118);
  for (let s = -100; s <= 220; s += 2) {
    const e = B.circuit.echantillon(c, s);
    assert.ok(Math.abs(e.pente) <= 0.003, 'pente stand/grille à s=' + s);
    assert.ok(Math.abs(e.courbure) < 1e-6, 'courbure stand/grille à s=' + s);
    assert.ok(Math.abs(e.devers) < 1e-6, 'devers stand/grille à s=' + s);
  }
});

verifier('Deux constructions identiques (détermination)', () => {
  const d = cree();
  const CHAMPS = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD', 'vibreur', 'seqDe'];
  for (const champ of CHAMPS) {
    assert.equal(c[champ].length, d[champ].length, 'longueur ' + champ);
    for (let i = 0; i < c[champ].length; i++) {
      assert.ok(Object.is(c[champ][i], d[champ][i]), 'diff ' + champ + ' à ' + i);
    }
  }
  assert.equal(JSON.stringify(c.tunnel), JSON.stringify(d.tunnel));
  assert.equal(JSON.stringify(c.stands), JSON.stringify(d.stands));
  assert.equal(JSON.stringify(c.rampes), JSON.stringify(d.rampes));
  assert.equal(JSON.stringify(c.couverts), JSON.stringify(d.couverts));
  assert.equal(JSON.stringify(c.ponts), JSON.stringify(d.ponts));
  assert.equal(JSON.stringify(c.bords), JSON.stringify(d.bords));
  assert.equal(JSON.stringify(c.lieux), JSON.stringify(d.lieux));
});

verifier('Dernier bit d’un sinus (perturbation numérique)', () => {
  const noms = ['sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'hypot', 'pow', 'exp', 'log'];
  const origines = {};
  for (const nom of noms) {
    origines[nom] = Math[nom];
    Math[nom] = (...a) => origines[nom](...a) * (1 + 2.220446049250313e-16);
  }
  let p;
  try {
    p = cree();
  } finally {
    for (const nom of noms) {
      Math[nom] = origines[nom];
    }
  }
  assert.equal(p.n, c.n);
  assert.equal(p.longueur, c.longueur);
  for (let i = 0; i < c.vibreur.length; i++) {
    assert.ok(Object.is(p.vibreur[i], c.vibreur[i]), 'vibreur diff ' + i);
  }
  for (let i = 0; i < c.seqDe.length; i++) {
    assert.ok(Object.is(p.seqDe[i], c.seqDe[i]), 'seqDe diff ' + i);
  }
  assert.equal(JSON.stringify(p.tunnel), JSON.stringify(c.tunnel));
  assert.equal(JSON.stringify(p.stands), JSON.stringify(c.stands));
  assert.ok(Math.abs(p.rampes[0].debut - c.rampes[0].debut) < 1e-6);
  assert.ok(Math.abs(p.rampes[0].fin - c.rampes[0].fin) < 1e-6);
  assert.deepEqual(B.circuit.valider(p), []);
  const champsNum = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD'];
  let aDiffere = false;
  for (const champ of champsNum) {
    for (let i = 0; i < c[champ].length; i++) {
      const diff = Math.abs(p[champ][i] - c[champ][i]);
      assert.ok(diff < 1e-6, 'écart ' + champ + ' à ' + i);
      if (!Object.is(p[champ][i], c[champ][i])) aDiffere = true;
    }
  }
  assert.ok(aDiffere, 'la perturbation n’a rien modifié');
});

verifier('Lecture par le jeu : échantillons finis, limites', () => {
  const sListe = [-50, 0, 123.4, 2500, 4400, 7950, 9697.9, 9698, 20000];
  for (const s of sListe) {
    const e = B.circuit.echantillon(c, s);
    assert.ok(Number.isFinite(e.x), 'x non fini à ' + s);
    assert.ok(Number.isFinite(e.y), 'y non fini à ' + s);
    assert.ok(Number.isFinite(e.z), 'z non fini à ' + s);
    assert.ok(Number.isFinite(e.pente), 'pente non finie à ' + s);
    assert.ok(Number.isFinite(e.courbure), 'courbure non finie à ' + s);
    assert.ok(Number.isFinite(e.devers), 'devers non fini à ' + s);
    assert.ok(Number.isFinite(e.ligne), 'ligne non finie à ' + s);
    assert.ok(Number.isFinite(e.vitesse), 'vitesse non finie à ' + s);
  }
  const lG = B.circuit.limiteA(c, 5000, -1);
  assert.ok(lG >= 7 && lG <= 8, 'limite gauche à 5000');
  const lD = B.circuit.limiteA(c, 8700, 1);
  assert.ok(lD >= 7 && lD <= 8, 'limite droite à 8700');
});

console.log(n + ' vérifications');
