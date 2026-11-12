// Vérifications du réalisateur de la démo (src/realisateur.js) sur une vraie course de douze voitures menées par l'IA.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url)), req = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'course', 'realisateur']) req(path.join(ici, '..', 'src', f + '.js'));
const B = globalThis.BITUME, R = B.realisateur, DT = 1 / 120;

let compte = 0;
function verifier(nom, f) {
  try { f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`FAIL ${nom}: ${e.message}`); process.exit(1); }
}

// Une démo entière : la course que lance jeu.js (douze voitures, celle du joueur confiée à l'IA), filmée pas à pas.
function filmer(graineCourse, graineReal, tours) {
  const c = B.circuit.creer(29, { theme: 'cote', longueur: 3600, nom: 'Port-Sable' });
  const co = B.course.creer(c, { mode: 'course', tours, difficulte: 2, rivaux: 11, graine: graineCourse, placeJoueur: 6 });
  co.joueur.ia.hab = 0.965;
  const real = R.creer(graineReal), plans = [], grille = co.classement.slice();
  let vert = -1, drapeau = -1, fin = -1;
  for (let k = 0; k < 120 * 600; k++) {
    B.course.pas(co, B.course.commandesIA(co, co.joueur), DT);
    if (vert < 0 && co.feux.vert) vert = co.horloge;
    if (drapeau < 0 && co.drapeau !== null) drapeau = co.horloge;
    const p = R.tenir(real, co);
    if (!plans.length || plans[plans.length - 1].plan !== p) {
      const s = co.voitures[p.sujet];
      plans.push({ plan: p, vue: p.vue, sujet: p.sujet, debut: p.debut, motif: p.motif, vitesse: s.etat.v, fini: s.fini, position: s.position,
        reste: co.toursTotal * c.longueur - co.voitures[co.classement[0]].progression });
    }
    // fin de la démo comme dans jeu.js : neuf secondes après le drapeau, ou la fin de course si elle vient avant
    if (co.termine || (drapeau >= 0 && co.horloge - drapeau > 9)) { fin = co.horloge; break; }
  }
  return { co, plans, grille, vert, drapeau, fin };
}

const film = filmer(4242, 7, 2);
const { co, plans, grille } = film;
const duree = k => (k + 1 < plans.length ? plans[k + 1].debut : film.fin) - plans[k].debut;

verifier('la course va au bout et le film a des plans', () => {
  assert.ok(film.vert > 0 && film.drapeau > film.vert && film.fin > film.drapeau, JSON.stringify([film.vert, film.drapeau, film.fin]));
  assert.ok(plans.length >= 12, `${plans.length} plans`);
  plans.forEach((p, k) => assert.equal(p.plan.n, k + 1, 'plans numérotés dans l’ordre'));
});

verifier('avant le vert : toute la grille vue d’hélicoptère depuis la dernière ligne, puis la tête au bord de la piste', () => {
  assert.deepEqual([plans[0].vue, plans[0].sujet, plans[0].motif], ['helico', grille[grille.length - 1], 'grille']);
  assert.ok(Math.abs(plans[1].debut - (film.vert + 2.5)) < .02, `coupe ${(plans[1].debut - film.vert).toFixed(2)} s après le vert`);
  assert.deepEqual([plans[1].vue, plans[1].motif], ['tele', 'depart']);
  assert.equal(plans[1].position, 1, 'le plan du départ suit la tête');
});

verifier('jamais deux fois la même caméra de suite, et les quatre servent', () => {
  // le drapeau impose le bord de la piste sur le vainqueur, quelle que soit la caméra d'avant
  for (let k = 1; k < plans.length; k++) if (plans[k].motif !== 'arrivee') assert.notEqual(plans[k].vue, plans[k - 1].vue, `plans ${k} et ${k + 1} : ${plans[k].vue}`);
  for (const v of R.VUES) assert.ok(plans.some(p => p.vue === v), `${v} jamais choisie`);
});

verifier('un plan de course dure de 2 à 10 s, sauf coupe forcée', () => {
  for (let k = 1; k < plans.length; k++) {
    if (plans[k].motif !== 'duel' && plans[k].motif !== 'tete' && plans[k].motif !== 'depart') continue; // grille, sprint, arrivée, honneur : durée imposée
    const d = duree(k), max = R.DUREES[plans[k].vue] + 1, dernier = plans[k + 1] && plans[k + 1].motif === 'arrivee';
    // le plan en cours quand la tête entre dans ses 300 derniers mètres se prolonge jusqu'au drapeau
    if (!dernier) assert.ok(d <= max + .02, `plan ${k + 1} (${plans[k].vue}) : ${d.toFixed(2)} s`);
    assert.ok(plans[k].reste >= 300 - 1, `plan ${k + 1} lancé à ${plans[k].reste.toFixed(0)} m du drapeau`);
    // une coupe avant l'heure : le drapeau tombe, la tête entre dans ses 300 derniers mètres, ou la voiture filmée de près s'arrête
    if (d < 2) assert.ok(plans[k + 1] && (plans[k + 1].motif === 'arrivee' || plans[k + 1].motif === 'sprint' || plans[k].vue === 'cockpit' || plans[k].vue === 'poursuite'), `plan ${k + 1} coupé à ${d.toFixed(2)} s`);
  }
});

verifier('voiture filmée : en course, jamais arrêtée pour une caméra embarquée ou de poursuite', () => {
  for (const p of plans) {
    assert.ok(p.sujet >= 0 && p.sujet < co.voitures.length);
    if (p.motif === 'duel' || p.motif === 'tete') assert.ok(!p.fini, 'voiture déjà arrivée');
    if ((p.vue === 'cockpit' || p.vue === 'poursuite')) assert.ok(p.vitesse > 15, `${p.vue} à ${p.vitesse.toFixed(1)} m/s`);
  }
  assert.ok(new Set(plans.map(p => p.sujet)).size >= 4, 'au moins quatre voitures filmées');
  assert.ok(plans.some(p => p.motif === 'duel'), 'au moins un duel');
});

verifier('au drapeau : on arrive avec la tête, de près ; puis le vainqueur au bord de la piste et vu d’en haut', () => {
  const k = plans.findIndex(p => p.motif === 'arrivee');
  assert.ok(k > 0 && k === plans.length - 2, 'deux derniers plans');
  const vainqueur = co.voitures.filter(v => v.fini).sort((a, b) => a.tempsFinal - b.tempsFinal)[0];
  // le plan qui précède le drapeau suit le futur vainqueur ; s'il a fallu couper, c'est à 300 m, en poursuite ou à bord
  assert.equal(plans[k - 1].sujet, vainqueur.id, 'le plan d’avant suit la tête');
  if (plans[k - 1].motif === 'sprint') {
    assert.ok(plans[k - 1].vue === 'poursuite' || plans[k - 1].vue === 'cockpit');
    assert.ok(plans[k - 1].reste <= 300 && plans[k - 1].reste > 290, `sprint lancé à ${plans[k - 1].reste.toFixed(0)} m`);
  }
  assert.ok(Math.abs(plans[k].debut - film.drapeau) < .02);
  assert.deepEqual([plans[k].vue, plans[k].sujet], ['tele', vainqueur.id]);
  assert.deepEqual([plans[k + 1].vue, plans[k + 1].sujet, plans[k + 1].motif], ['helico', vainqueur.id, 'honneur']);
  assert.ok(Math.abs(duree(k) - 6) < .02);
});

verifier('même course et même graine : mêmes plans ; autre graine : autre film', () => {
  const resume = f => f.plans.map(p => [p.vue, p.sujet, p.debut.toFixed(3)].join(':')).join(' ');
  assert.equal(resume(filmer(4242, 7, 2)), resume(film));
  assert.notEqual(resume(filmer(4242, 8, 2)), resume(film));
});

console.log(`${compte} vérifications réussies`);
