// Visière : simulation au pas de 1/30 s, dessin interpolé à chaque image ; même mouvement à 30, 60, 120 et
// 144 Hz et pour une vue rendue à demi-cadence ; au sec ni mesure ni dessin ; définition figée par séance.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/vitre.js');
const V = globalThis.BITUME.vitre, PAS = 1 / V.FREQUENCE;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

// Toile factice : journal des tracés de la dernière image, lectures de taille et effacements comptés.
function toile(w = 1280, h = 720) {
  const etat = { w, h, lectures: 0, effacements: 0, image: [] };
  const ctx = { globalAlpha: 1, setTransform() {}, clearRect() { etat.effacements++; etat.image = []; }, beginPath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {},
    ellipse(x, y, rx, ry) { etat.image.push([x, y, rx, ry, ctx.globalAlpha]); } };
  const canvas = { width: 0, height: 0, getContext: () => ctx,
    get clientWidth() { etat.lectures++; return etat.w; }, get clientHeight() { etat.lectures++; return etat.h; } };
  return { canvas, ctx, etat };
}
const pluie = (qualite = 'high') => ({ qualite, actif: true, pluie: 1, neige: 0, vitesse: 45, ventX: 3, ventZ: 1, dpr: 1 });
const corps = image => image.filter((e, i) => Math.abs(e[3] - e[2] * 1.36) < 1e-9);   // ellipse principale de chaque goutte
const proches = (a, b) => a.length === b.length && a.every((e, i) => e.every((v, j) => Math.abs(v - b[i][j]) < 1e-7));

verifier('chaque image montre une position nouvelle, pas seulement les images de pas', () => {
  for (const hz of [60, 120, 144]) {
    const t = toile(), e = V.creer(t.canvas), c = pluie();
    for (let i = 0; i < 4 * hz; i++) V.mettreAJour(e, 1 / hz, c);
    // Suivre une goutte qui ruisselle : son ellipse doit descendre à chaque image, pas une image sur hz / 30.
    const goutte = e.gouttes.find(p => p.vivant && p.glisse === 1 && p.age > 1 && p.age < p.duree - 2);
    assert(goutte, 'goutte ruisselante');
    let precedent = null, montees = 0, immobiles = 0;
    for (let i = 0; i < hz / 2; i++) {
      V.mettreAJour(e, 1 / hz, c);
      if (!goutte.vivant) break;
      const moi = corps(t.etat.image).find(el => Math.abs(el[2] - goutte.taille) < 1e-12);
      if (!moi) continue;
      if (precedent !== null) { if (moi[1] > precedent) montees++; else immobiles++; }
      precedent = moi[1];
    }
    assert(montees >= hz / 2 - 3 && immobiles === 0, hz + ' Hz : ' + montees + ' images en mouvement, ' + immobiles + ' figées');
  }
});
verifier('même image aux mêmes instants à 30, 60, 120 et 144 Hz', () => {
  const instants = new Map();
  for (const hz of [30, 60, 120, 144]) {
    const t = toile(), e = V.creer(t.canvas), c = pluie('ultra');
    for (let i = 1; i <= 12 * hz; i++) {
      V.mettreAJour(e, 1 / hz, c);
      if (i % (hz / 6) === 0) {   // tous les 1/6 s, instants communs aux quatre cadences
        const cle = i / (hz / 6), image = t.etat.image.map(el => el.slice());
        if (!instants.has(cle)) instants.set(cle, image);
        else assert(proches(instants.get(cle), image), hz + ' Hz, instant ' + cle / 6 + ' s');
      }
    }
    assert.equal(e.stats.etapes, 360);
  }
  assert(instants.size === 72 && [...instants.values()].some(i => i.length > 20));
});
verifier('vue rendue une image sur deux : avec le temps cumulé, même visière qu’à pleine cadence', () => {
  const tp = toile(), td = toile(), tf = toile(), pleine = V.creer(tp.canvas), demi = V.creer(td.canvas), fausse = V.creer(tf.canvas), c = pluie();
  for (let i = 1; i <= 600; i++) {
    V.mettreAJour(pleine, 1 / 60, c);
    if (i % 2) continue;
    V.mettreAJour(demi, 2 / 60, c); V.mettreAJour(fausse, 1 / 60, c);
    if (i > 60) assert(proches(corps(tp.etat.image), corps(td.etat.image)), 'image ' + i);
  }
  assert.equal(demi.stats.etapes, pleine.stats.etapes);
  assert.equal(fausse.stats.etapes, pleine.stats.etapes / 2);   // un dt d'une seule image ralentit la visière de moitié
});
verifier('au sec et visière vide : ni mesure de la toile, ni parcours des pools, ni dessin ; l’horloge avance', () => {
  const t = toile(), e = V.creer(t.canvas), c = pluie(); c.pluie = 0;
  const lectures = t.etat.lectures;
  for (let i = 0; i < 1200; i++) V.mettreAJour(e, 1 / 120, c);
  assert.equal(t.etat.lectures, lectures); assert.equal(t.etat.effacements, 0); assert.equal(e.stats.dessins, 0);
  assert.equal(e.stats.etapes, 300); assert(Math.abs(e.temps - 300 * PAS) < 1e-9);
  // Sous abri, même chose malgré la pluie ; puis l'averse reprend sur la visière.
  c.pluie = 1; c.abri = true; for (let i = 0; i < 120; i++) V.mettreAJour(e, 1 / 120, c);
  assert.equal(t.etat.lectures, lectures); assert.equal(e.stats.dessins, 0);
  c.abri = false; for (let i = 0; i < 240; i++) V.mettreAJour(e, 1 / 120, c);
  assert(e.stats.gouttes > 0 && e.stats.dessins > 0 && t.etat.lectures > lectures);
  // Fin de pluie : les gouttes sèchent, une dernière image efface, puis plus rien n'est mesuré ni tracé.
  c.pluie = 0; for (let i = 0; i < 120 * 40; i++) V.mettreAJour(e, 1 / 120, c);
  assert.equal(e.stats.gouttes, 0); assert(e.propre);
  const fin = [t.etat.lectures, t.etat.effacements, e.stats.dessins];
  for (let i = 0; i < 600; i++) V.mettreAJour(e, 1 / 120, c);
  assert.deepEqual([t.etat.lectures, t.etat.effacements, e.stats.dessins], fin);
});
verifier('une goutte naît transparente puis apparaît en fondu', () => {
  const t = toile(), e = V.creer(t.canvas), c = pluie();
  let premiere = null;
  for (let i = 0; i < 240 && !premiere; i++) {
    V.mettreAJour(e, 1 / 120, c);
    const vivante = e.gouttes.find(p => p.vivant);
    if (vivante) premiere = vivante;
  }
  assert(premiere && premiere.pa === 0 && premiere.pp === 0, 'état précédent d’une goutte neuve : âge et poids nuls');
  const alphas = [];
  for (let i = 0; i < 24; i++) {
    V.mettreAJour(e, 1 / 120, c);
    const moi = corps(t.etat.image).find(el => Math.abs(el[2] - premiere.taille) < 1e-12);
    alphas.push(moi ? moi[4] : 0);
  }
  assert(alphas.every((a, i) => !i || a >= alphas[i - 1] - 1e-12) && alphas[alphas.length - 1] > .05, 'opacité croissante : ' + alphas.map(a => a.toFixed(3)));
});
verifier('définition figée par séance : un changement de palier ne réalloue pas la toile', () => {
  const t = toile(1280, 720), e = V.creer(t.canvas), c = pluie('high'); c.dpr = 2;
  for (let i = 0; i < 120; i++) V.mettreAJour(e, 1 / 60, c);
  assert.equal(t.canvas.width, 1600); assert.equal(t.canvas.height, 900);
  c.qualite = 'medium'; for (let i = 0; i < 600; i++) V.mettreAJour(e, 1 / 60, c);
  assert.equal(t.canvas.width, 1600); assert(e.stats.gouttes <= V.BUDGETS.medium.gouttes, 'le palier règle toujours le nombre de gouttes');
  // La taille de la fenêtre reste suivie, avec la définition de la séance.
  t.etat.w = 1000; t.etat.h = 500; for (let i = 0; i < 4; i++) V.mettreAJour(e, 1 / 60, c);
  assert.equal(t.canvas.width, 1250); assert.equal(t.canvas.height, 625);
  // Nouvelle séance (effacer, appelé au lancement) : le palier courant redonne la définition.
  V.effacer(e); for (let i = 0; i < 120; i++) V.mettreAJour(e, 1 / 60, c);
  assert.equal(t.canvas.width, 1000); assert.equal(t.canvas.height, 500);
});
verifier('visière propre masquée sans réécrire le style à chaque image', () => {
  const t = toile(), ecritures = [];
  t.canvas.style = { set visibility(v) { ecritures.push(v); }, get visibility() { return ecritures[ecritures.length - 1] ?? ''; } };
  const e = V.creer(t.canvas), c = pluie(); c.pluie = 0;
  assert.deepEqual(ecritures, ['hidden'], 'toile neuve masquée');
  for (let i = 0; i < 600; i++) V.mettreAJour(e, 1 / 120, c);
  c.pluie = 1; for (let i = 0; i < 600; i++) V.mettreAJour(e, 1 / 120, c);
  assert(e.stats.gouttes > 0 && t.canvas.style.visibility === '', 'montrée dès les premières gouttes');
  c.pluie = 0; for (let i = 0; i < 120 * 40; i++) V.mettreAJour(e, 1 / 120, c);
  assert(e.propre && t.canvas.style.visibility === 'hidden', 'masquée une fois sèche');
  assert.deepEqual(ecritures, ['hidden', '', 'hidden'], 'trois écritures en tout : ' + ecritures.join('|'));
  c.actif = false; for (let i = 0; i < 60; i++) V.mettreAJour(e, 1 / 60, c);
  assert.equal(ecritures.length, 3, 'hors course, aucune écriture de plus');
});
verifier('préchauffage sous le voile : tracés presque transparents, effacés au premier appel actif', () => {
  const t = toile(), e = V.creer(t.canvas), c = pluie(); c.pluie = 0;
  assert.equal(V.prechauffer(e, c), true);
  assert(t.etat.image.length >= 2 && t.etat.image.every(el => el[4] === 1 / 255) && !e.propre && !e.masquee);
  V.mettreAJour(e, 1 / 60, c);
  assert.equal(t.etat.image.length, 0); assert(e.propre && e.masquee);
  assert.equal(V.prechauffer(V.creer(null), c), false); assert.equal(V.prechauffer(null, c), false);
  const off = V.creer(toile().canvas); assert.equal(V.prechauffer(off, { qualite: 'off' }), false);
});
console.log('visière, cadence : ' + controles + ' contrôles passés');
