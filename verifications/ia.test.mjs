// Banc du Chantier 3 pour l'IA : un rival lancé à 80 m/s doit éviter une voiture arrêtée en travers de sa
// trajectoire, au lieu de la percuter. Exécutable par Node. On exerce le vrai module de course sur une ligne
// droite synthétique (trajectoire, courbure et vitesses visées fournies à commandesIA).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));
charger('circuit.js');
charger('conduite.js');
charger('degats.js');
charger('contacts.js');
charger('course.js');
const B = globalThis.BITUME;

const resultats = [];
function noter(nom, valeur, cible, ok, info = '') {
  const texte = typeof valeur === 'number' ? (Number.isFinite(valeur) ? valeur.toFixed(Math.abs(valeur) >= 100 ? 0 : 3) : '∞') : String(valeur);
  console.log(`${ok ? 'ok ' : 'KO '}${nom} : ${texte} (cible ${cible})${info ? ' — ' + info : ''}`);
  resultats.push({ nom, ok: !!ok });
}

// ligne droite : cap 0, pas de courbure, vitesse visée haute, trajectoire au centre
function droite(L = 3000, largeur = 12, pas = 5) {
  const n = Math.round(L / pas);
  const vitesse = new Array(n).fill(80), ligne = new Array(n).fill(0), courbure = new Array(n).fill(0);
  B.circuit = {
    echantillon(c, s) { const ss = ((s % L) + L) % L; return { x: ss, y: 0, z: 0, cap: 0, courbure: 0, pente: 0, devers: 0, ligne: 0, vitesse: 80 }; },
    ecart(c, s1, s2) { let d = s2 - s1; while (d > L / 2) d -= L; while (d < -L / 2) d += L; return d; },
    vibreurA() { return false; }
  };
  return { longueur: L, largeur, limite: largeur / 2, pas, n, vitesse, ligne, courbure, depart: 0 };
}

const DT = 1 / 120;
const NEUTRE = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };

// scénario : le joueur (voiture 0) est arrêté au centre, un rival (voiture 1) arrive à 80 m/s derrière lui
function scenario(vRival) {
  const c = droite();
  const course = B.course.creer(c, { mode: 'course', rivaux: 1, graine: 3, placeJoueur: 1, tours: 1 });
  course.phase = 'course'; course.temps = 20; if (course.feux) course.feux.vert = true;
  const obstacle = course.voitures[0], rival = course.voitures[1];
  obstacle.etat.s = 1000; obstacle.etat.d = 0; obstacle.etat.v = 0; obstacle.etat.psi = 0; obstacle.etat.omega = 0;
  rival.etat.s = 1000 - 130; rival.etat.d = 0; rival.etat.v = vRival; rival.etat.psi = 0; rival.etat.omega = 0;
  let t = 0, contact = false, passed = false, dMin = 0, freine = false;
  while (t < 8) {
    obstacle.etat.v = 0; obstacle.etat.d = 0; obstacle.etat.psi = 0; obstacle.etat.omega = 0;   // reste arrêté au centre
    const ev = B.course.pas(course, NEUTRE, DT);
    for (const e of ev) if (e.type === 'contact' && ((e.a === 0 && e.b === 1) || (e.a === 1 && e.b === 0))) contact = true;
    const ds = B.circuit.ecart(c, obstacle.etat.s, rival.etat.s);   // rival derrière l'obstacle si ds < 0
    if (ds > 3 && Math.abs(rival.etat.d - obstacle.etat.d) < 4) passed = true;   // l'a dépassé à côté
    dMin = Math.min(dMin, ds);
    if (rival.etat.frein > 0.5) freine = true;
    if (passed || (ds > -1 && rival.etat.v < 1.5)) break;
    t += DT;
  }
  return { contact, passed, freine, t, vFin: rival.etat.v };
}

{
  const r = scenario(80);
  noter('IA : un rival à 80 m/s évite une voiture arrêtée (pas de contact)', r.contact ? 0 : 1, 'pas de contact', !r.contact);
  noter('IA : soit il la dépasse à côté, soit il s’arrête avant', (r.passed || r.vFin < 1.5) ? 1 : 0, 'évité', r.passed || r.vFin < 1.5, `passée=${r.passed} vFin=${r.vFin.toFixed(1)}`);
  noter('IA : il freine en approchant', r.freine ? 1 : 0, 'oui', r.freine);
}
{
  // à 40 m/s aussi (cas plus lent), et une deuxième graine pour la robustesse
  const r1 = scenario(40), r2 = scenario(65);
  noter('IA : évite aussi à 40 m/s', r1.contact ? 0 : 1, 'pas de contact', !r1.contact);
  noter('IA : évite aussi à 65 m/s', r2.contact ? 0 : 1, 'pas de contact', !r2.contact);
}

const echecs = resultats.filter(r => !r.ok);
console.log('---');
console.log(`${resultats.length - echecs.length}/${resultats.length} critères IA tenus`);
if (echecs.length) { for (const r of echecs) console.log('KO  ' + r.nom); process.exit(1); }
process.exit(0);
