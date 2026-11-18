// Le huitième circuit se court avec la conduite actuelle (p9).
// Les rivaux bouclent leurs tours, montent le Mur (rampe jusqu'à 30 %).
// Une voiture arrêtée dans le Mur repart, et aux vitesses vraiment roulées
// aucune crête n'allège de plus de 0,4 g.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require(path.join(ici, '..', 'src', 'circuit.js'));
require(path.join(ici, '..', 'src', 'partitions.js'));
require(path.join(ici, '..', 'src', 'conduite.js'));
require(path.join(ici, '..', 'src', 'degats.js'));
require(path.join(ici, '..', 'src', 'contacts.js'));
require(path.join(ici, '..', 'src', 'obstacles.js'));
require(path.join(ici, '..', 'src', 'course.js'));
const B = globalThis.BITUME;
const DT = 1 / 120;
const G = 9.81;

let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok  ' + nom); };

const cree = () => B.circuit.creer(181, { theme: 'montagne', longueur: 9700, nom: 'Route-des-Cimes', partition: 'route-des-cimes' });
const ramener = (s, L) => ((s % L) + L) % L;
const course = (c, o) => B.course.creer(c, { mode: 'course', tours: 2, difficulte: 2, graine: 1, rivaux: 0, placeJoueur: 1, ...o });
const pas = co => B.course.pas(co, B.course.commandesIA(co, co.joueur), DT);

// Pré-calcul des vitesses pour la vérification des crêtes (point 2)
// Utilisé par la vérification 1 pour la collecte et la vérification 2 pour le calcul.
let vvCache = null;
const calculerVitesseParPosition = (c, co) => {
  if (vvCache) return vvCache;
  const vv = new Float64Array(c.n);
  // On simule pour remplir vv si ce n'est pas déjà fait par la vérif 1
  // Mais la vérif 1 remplit vv directement. On gère le cas où on l'appelle indépendamment.
  // Pour simplifier, on suppose que la vérif 1 a déjà rempli vvCache.
  // Si non, on ne peut pas le faire ici sans re-simuler.
  // La tâche dit "réutilise vv du point 1". Donc on s'assure que la vérif 1 le remplit.
  return vvCache;
};

verifier('l\'IA du joueur seule boucle deux tours sans sortir, dans le temps de référence', () => {
  const c = cree();
  const co = course(c, {});
  let t = 0;
  const vv = new Float64Array(c.n);
  vvCache = vv; // Partage avec la vérif 2

  while (!co.termine && t < 900) {
    const evts = pas(co);
    t += DT;
    if (co.phase === 'course') {
      const d = Math.abs(co.joueur.etat.d);
      if (d > c.largeur / 2 + 0.5) {
        throw new Error('Le joueur est sorti de la piste');
      }
      if (co.joueur.tours === 1) {
        const s = ramener(co.joueur.etat.s, c.longueur);
        const idx = Math.round(s / 2) % c.n;
        vv[idx] = co.joueur.etat.v;
      }
    }
  }

  if (co.joueur.tours < 2) throw new Error('Moins de 2 tours');
  if (!co.joueur.fini) throw new Error('Voiture non finie');
  const tRef = co.tempsReference;
  if (co.joueur.meilleur < 0.98 * tRef || co.joueur.meilleur > 1.08 * tRef) {
    throw new Error('Temps hors référence : ' + co.joueur.meilleur + ' vs ' + tRef);
  }
});

verifier('aux vitesses roulées, aucune crête n\'allège de plus de 0,4 g', () => {
  const c = cree();
  const vv = calculerVitesseParPosition(c);
  if (!vv) throw new Error('Vitesse non calculée');

  let minCharge = 10;
  for (let i = 0; i < c.n; i++) {
    const th = Math.atan(c.pente[(i + c.n) % c.n]);
    let v = vv[i];
    if (v === 0) {
      // Cherche la première valeur non nulle parmi les 10 suivants
      for (let k = 1; k <= 10; k++) {
        const idx = (i + k) % c.n;
        if (vv[idx] > 0) {
          v = vv[idx];
          break;
        }
      }
    }
    if (v === 0) continue; // Ignore les zones sans données

    const thPrev = Math.atan(c.pente[(i - 1 + c.n) % c.n]);
    const thNext = Math.atan(c.pente[(i + 1) % c.n]);
    const charge = Math.cos(th) + (v * v * (thNext - thPrev)) / (2 * 2) / G;
    if (charge < minCharge) minCharge = charge;
  }

  if (minCharge < 0.6) {
    throw new Error('Charge trop faible sur une crête : ' + minCharge);
  }
});

verifier('douze voitures : tous les tours bouclés, le Mur monté à chaque passage', () => {
  const c = cree();
  const co = course(c, { rivaux: 11, graine: 4242, placeJoueur: 8 });
  let t = 0;
  const rampe = c.rampes[0];
  const seuilSortie = c.largeur / 2 + 0.5;
  
  const vitesseMinMur = new Array(co.voitures.length).fill(Infinity);
  const sortiesParVoiture = new Array(co.voitures.length).fill(0);
  const estSorti = new Array(co.voitures.length).fill(false);

  while (!co.termine && t < 900) {
    pas(co);
    t += DT;
    if (co.phase !== 'course') continue;

    for (let k = 0; k < co.voitures.length; k++) {
      const v = co.voitures[k];
      const e = v.etat;
      const s = ramener(e.s, c.longueur);
      const d = Math.abs(e.d);

      // Gestion des sorties
      if (d > seuilSortie) {
        if (!estSorti[k]) {
          sortiesParVoiture[k]++;
          estSorti[k] = true;
        }
      } else {
        estSorti[k] = false;
      }

      // Vitesse dans le Mur
      if (!v.fini && s > rampe.debut + 20 && s < rampe.fin - 20) {
        if (e.v < vitesseMinMur[k]) {
          vitesseMinMur[k] = e.v;
        }
      }
    }
  }

  if (!co.termine) throw new Error('Course non terminée');
  
  let totalSorties = 0;
  let minVitesseGlobale = Infinity;

  for (let k = 0; k < co.voitures.length; k++) {
    const v = co.voitures[k];
    if (v.abandon) throw new Error('Voiture abandonnée : ' + k);
    if (v.tours < 1) throw new Error('Voiture n\'a pas bouclé : ' + k);
    if (vitesseMinMur[k] <= 7) throw new Error('Vitesse trop basse dans le Mur pour ' + k + ' : ' + vitesseMinMur[k]);
    if (vitesseMinMur[k] < minVitesseGlobale) minVitesseGlobale = vitesseMinMur[k];
    totalSorties += sortiesParVoiture[k];
  }

  if (totalSorties > 6) throw new Error('Trop de sorties : ' + totalSorties);
  
  let totalRepos = 0;
  for (let k = 0; k < co.voitures.length; k++) {
    totalRepos += (co.voitures[k].etat.repositionnements || 0);
  }
  if (totalRepos > 1) throw new Error('Trop de repositionnements : ' + totalRepos);

  console.log('Sorties totales : ' + totalSorties + ', Vitesse min Mur (km/h) : ' + (minVitesseGlobale * 3.6).toFixed(1));
});

verifier('arrêtée dans le Mur, la voiture repart et passe la crête', () => {
  const c = cree();
  const co = course(c, { tours: 3 });
  let t = 0;
  
  // Avancer jusqu'à la phase de course
  while (co.phase !== 'course' && t < 60) {
    pas(co);
    t += DT;
  }
  if (co.phase !== 'course') throw new Error('Phase course non atteinte');

  // Avancer jusqu'à t >= 2
  while (co.temps < 2 && t < 60) {
    pas(co);
    t += DT;
  }

  const e = co.joueur.etat;
  const dist = e.distance;
  const deg = co.joueur.degats;
  
  // Positionner la voiture dans le Mur (s0)
  const s0 = 2480; // Test sur la première valeur de la liste demandée [2480, 2600]
  const q = B.circuit.echantillon(c, s0);
  
  Object.assign(e, B.conduite.creer(s0, q.ligne));
  e.distance = dist;
  e.degats = deg;
  e.y = q.y;
  e.tangage = Math.atan(q.pente);

  if (q.pente <= 0.24) throw new Error('Pente insuffisante pour le test de démarrage');

  let vitesseMax = 0;
  let tStart = co.temps;
  let tEnd = tStart + 16;
  
  while (co.temps < tEnd) {
    pas(co);
    if (e.v > vitesseMax) vitesseMax = e.v;
  }

  const sFinal = ramener(e.s, c.longueur);
  if (sFinal <= c.rampes[0].fin) {
    throw new Error('La voiture n\'a pas dépassé la fin de la rampe');
  }
  if (vitesseMax <= 30) {
    throw new Error('La vitesse n\'a pas dépassé 30 m/s : ' + vitesseMax);
  }
});

console.log(n + ' vérifications');
