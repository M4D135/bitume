// Contrats observables d'écoulement : sens, trajectoires et sorties réelles de l'eau.
// Les assertions ne recopient pas la loi du flux ; elles suivent les dépôts de la simulation livrée.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/vitre.js');
const V = globalThis.BITUME.vitre;
let controles = 0;
const verifier = (nom, fn) => { fn(); controles++; console.log('ok ' + nom); };
const contexte = (extra = {}) => ({ qualite: 'high', actif: true, pluie: 0, neige: 0, abri: true,
  intensite: 1, vitesse: 0, largeur: 1280, hauteur: 720, cameraYaw: 0, cameraPitch: 0, cameraRoll: 0, ...extra });
function creer(points = [[.25, .20]], extra = {}, neige = false) {
  const e = V.creerSimulation({ graine: 7 });
  for (let i = 0; i < points.length; i++) {
    const p = (neige ? e.neige : e.gouttes)[i], [x, y] = points[i];
    Object.assign(p, { vivant: true, x, y, px: x, py: y, age: 1, pa: 1, duree: 300,
      taille: 6, pr: 6, vitesse: 1, phase: 0, frequence: 0, glisse: 1, poids: 1, pp: 1, ...extra });
    p.traceX.fill(x); p.traceY.fill(y);
  }
  e.stats[neige ? 'neige' : 'gouttes'] = points.length;
  return e;
}
function avancer(e, c, duree = 1, hz = 60) {
  for (let i = 0; i < Math.round(duree * hz); i++) V.avancerSimulation(e, 1 / hz, c);
  return e;
}
const quadrants = [[.18, .18], [.82, .18], [.18, .82], [.82, .82]];
const proche = (a, b, message) => assert(Math.abs(a - b) < 1e-10, message || `${a} != ${b}`);

verifier('à l’arrêt sans vent, les quatre quadrants descendent dans les deux vues', () => {
  for (const cockpit of [true, false]) {
    const e = avancer(creer(quadrants), contexte({ cockpit }));
    quadrants.forEach(([x, y], i) => {
      const p = e.gouttes[i]; proche(p.x, x);
      assert(p.y > y + .02 && p.y < y + .06, 'descente visible et bornée à l’arrêt');
    });
    assert.equal(e.flux.air, 0); assert.equal(e.flux.expansion, 0); assert.equal(e.stats.expulses, 0);
  }
});

verifier('de 0 à 300 km/h l’écartement croît ; à grande vitesse les gouttes du haut remontent', () => {
  for (const cockpit of [true, false]) {
    let precedent = -1;
    for (const kmh of [0, 30, 100, 200, 300]) {
      const e = avancer(creer(quadrants), contexte({ cockpit, vitesse: kmh / 3.6 }), .6);
      const ecart = Math.abs(e.gouttes[0].x - quadrants[0][0]);
      assert(ecart > precedent, `${kmh} km/h : écartement progressif`); precedent = ecart;
      for (let i = 0; i < quadrants.length; i++) {
        const [x, y] = quadrants[i], p = e.gouttes[i];
        assert(p.vivant && Number.isFinite(p.x) && Number.isFinite(p.y));
        if (kmh > 0) assert((p.x - x) * (x - .5) > 0, 'sortie vers son côté');
        if (kmh === 300) assert((p.y - y) * (y - .45) > 0, 'haut vers le haut, bas vers le bas');
      }
    }
  }
});

verifier('l’air évacue les dépôts par les bords, sans les faire disparaître par vieillissement', () => {
  for (const cockpit of [true, false]) {
    const lent = avancer(creer(quadrants), contexte({ cockpit }), 4);
    const rapide = avancer(creer(quadrants), contexte({ cockpit, vitesse: 300 / 3.6 }), 4);
    assert.equal(lent.stats.gouttes, 4); assert.equal(lent.stats.expulses, 0);
    assert.equal(rapide.stats.gouttes, 0); assert.equal(rapide.stats.expulses, 4);
    assert.equal(rapide.stats.surfaceExpulsee, 4 * 6 ** 2); assert.equal(rapide.stats.seches, 0);
    for (const p of rapide.gouttes.slice(0, 4)) assert(p.x < -.04 || p.x > 1.04 || p.y < -.04 || p.y > 1.04);
  }
  const lent = avancer(creer(), contexte()), rapide = avancer(creer(), contexte({ vitesse: 300 / 3.6 }));
  proche(lent.gouttes[0].age, rapide.gouttes[0].age, 'le vent ne remplace pas la trajectoire par une durée raccourcie');
});

verifier('le trajet conserve les positions précédentes derrière chaque goutte qui s’écarte', () => {
  const e = avancer(creer(quadrants), contexte({ vitesse: 300 / 3.6 }), .8);
  quadrants.forEach(([x, y], i) => {
    const p = e.gouttes[i];
    assert((p.x - p.traceX[5]) * (x - .5) > 0);
    assert((p.y - p.traceY[5]) * (y - .45) > 0);
    for (let j = 0; j < 5; j++) {
      assert((p.traceX[j] - p.traceX[j + 1]) * (x - .5) > 0);
      assert((p.traceY[j] - p.traceY[j + 1]) * (y - .45) > 0);
    }
  });
});

verifier('quand la voiture s’arrête sous abri, le résidu descend sans nouvel impact ni saut', () => {
  const e = avancer(creer([[.32, .28]]), contexte({ vitesse: 300 / 3.6 }), .5), p = e.gouttes[0];
  const x = p.x, y = p.y, sequence = e.sequence;
  avancer(e, contexte(), .5);
  assert(p.vivant); proche(p.x, x); assert(p.y > y); assert.equal(e.sequence, sequence);
  assert.equal(e.stats.depotsEau, 0); assert.equal(e.stats.seches, 0);
});

verifier('le vent latéral change de signe sur l’écran quand le vent ou le regard s’inverse', () => {
  for (const cameraYaw of [0, Math.PI]) {
    for (const ventX of [-15, 15]) {
      const e = avancer(creer([[.5, .45]]), contexte({ cameraYaw, ventX }), .5);
      const attendu = (cameraYaw === 0 ? 1 : -1) * Math.sign(ventX);
      assert((e.gouttes[0].x - .5) * attendu > .003, 'dérive suivant le vrai repère caméra');
    }
  }
});

verifier('le cap ne change pas l’écoulement de face ; dos au vent et en recul la gravité reste sans expansion forcée', () => {
  const contextes = [
    { cameraYaw: 0, vitesseX: 0, vitesseY: 0, vitesseZ: -80 },
    { cameraYaw: Math.PI / 2, vitesseX: 80, vitesseY: 0, vitesseZ: 0 }
  ];
  let reference;
  for (const c of contextes) {
    const e = avancer(creer(quadrants), contexte(c), .5);
    assert(e.flux.expansion > 0);
    const positions = e.gouttes.slice(0, 4).flatMap(p => [p.x, p.y]);
    if (reference) positions.forEach((v, i) => proche(v, reference[i])); else reference = positions;
  }
  const calme = avancer(creer(quadrants), contexte(), .5);
  for (const c of [{ cameraYaw: Math.PI, vitesseX: 0, vitesseY: 0, vitesseZ: -80 }, { vitesse: -80 }]) {
    const e = avancer(creer(quadrants), contexte(c), .5);
    assert.equal(e.flux.expansion, 0);
    quadrants.forEach(([x, y], i) => {
      proche(e.gouttes[i].x, x); proche(e.gouttes[i].y, calme.gouttes[i].y);
      assert(e.gouttes[i].y > y, 'la gravité continue dos au vent');
    });
  }
});

verifier('à vitesse identique, pluie et neige déjà déposées sont calmes à l’arrière et gardent le vent latéral', () => {
  const mouvement = { vitesse: 80, vitesseX: 0, vitesseY: 0, vitesseZ: -80 };
  for (const neige of [false, true]) {
    const initial = neige ? { age: 10, pa: 10, duree: 40 } : {};
    const avant = avancer(creer(quadrants, initial, neige), contexte(mouvement), .5);
    const arriere = avancer(creer(quadrants, initial, neige), contexte({ ...mouvement, cameraYaw: Math.PI }), .5);
    const liste = e => neige ? e.neige : e.gouttes;
    quadrants.forEach(([x, y], i) => {
      const face = liste(avant)[i], dos = liste(arriere)[i];
      assert(face.vivant && dos.vivant, 'mêmes dépôts suivis, sans disparition qui masque leur déplacement');
      const rapide = Math.hypot(face.x - x, face.y - y), lent = Math.hypot(dos.x - x, dos.y - y);
      assert(rapide > .04 && lent < rapide * .2, 'réduction nette du déplacement à l’arrière');
      proche(dos.x, x); assert(dos.y > y, 'résidu mobile sous la gravité');
    });
    for (const ventX of [-12, 12]) {
      const e = avancer(creer([[.5, .45]], initial, neige), contexte({ ...mouvement, cameraYaw: Math.PI, ventX }), .5);
      assert((liste(e)[0].x - .5) * ventX < 0, 'vent réel projeté dans le repère arrière');
      assert.equal(e.flux.expansion, 0, 'pas de divergence forcée pour un flux qui quitte la face');
    }
  }
});

verifier('tourner progressivement le regard conserve les dépôts et leur trajet puis laisse un résidu calme', () => {
  for (const neige of [false, true]) {
    const e = creer([[.5, .3]], neige ? { age: 10, pa: 10, duree: 40 } : {}, neige);
    const p = (neige ? e.neige : e.gouttes)[0], traceX = p.traceX, traceY = p.traceY;
    const mouvement = { vitesse: 80, vitesseX: 0, vitesseY: 0, vitesseZ: -80 };
    for (let i = 0; i <= 60; i++) {
      const c = contexte({ ...mouvement, cameraYaw: Math.PI * i / 60 }), x = p.x, y = p.y;
      V.avancerSimulation(e, 0, c); proche(p.x, x); proche(p.y, y);
      avancer(e, c, 1 / 60);
      assert(p.vivant && Math.hypot(p.x - x, p.y - y) < .015, 'pas de saut au changement d’orientation');
      assert.strictEqual(p.traceX, traceX); assert.strictEqual(p.traceY, traceY);
    }
    const x = p.x, y = p.y;
    avancer(e, contexte({ ...mouvement, cameraYaw: Math.PI }), .3);
    proche(p.x, x); assert(p.y > y, 'écoulement résiduel après le demi-tour');
    assert.equal(e.sequence, 0, 'aucun nouveau dépôt ne remplace ceux que le test suit');
  }
});

verifier('le déplacement latéral et les vents de face ou arrière utilisent la vitesse relative réelle', () => {
  for (const vitesseX of [-60, 60]) {
    const e = avancer(creer([[.5, .45]]), contexte({ vitesse: 100, vitesseX, vitesseY: 0, vitesseZ: 0 }), .5);
    assert((e.gouttes[0].x - .5) * vitesseX < 0, 'air relatif opposé à la dérive de la voiture');
  }
  const nul = {}, suivant = {}, face = {};
  V.calculerFlux(contexte({ vitesse: 100, vitesseX: 0, vitesseY: 0, vitesseZ: 0 }), nul);
  V.calculerFlux(contexte({ vitesseZ: -30, ventZ: -30 }), suivant);
  V.calculerFlux(contexte({ vitesseZ: -30, ventZ: 30 }), face);
  assert.equal(nul.air, 0, 'le vecteur réel nul prime sur une vitesse scalaire ancienne');
  assert.equal(suivant.air, 0); assert.equal(suivant.vitesseAir, 0);
  assert(face.air > 0 && face.vitesseAir > 50);
});

verifier('le roulis projette la gravité et une vue verticale ne garde pas de chute écran artificielle', () => {
  for (const cameraRoll of [-Math.PI / 2, Math.PI / 2]) {
    const e = avancer(creer([[.5, .45]]), contexte({ cameraRoll }), 1), p = e.gouttes[0];
    assert((p.x - .5) * cameraRoll < 0); proche(p.y, .45);
  }
  const haut = avancer(creer([[.5, .45]]), contexte({ cameraPitch: Math.PI / 2 }));
  proche(haut.gouttes[0].x, .5); proche(haut.gouttes[0].y, .45);
});

verifier('les écrans paysage, partagés et portrait préservent la direction dans leur rapport de taille', () => {
  let reference;
  for (const [largeur, hauteur] of [[1280, 720], [960, 540], [360, 720]]) {
    const e = avancer(creer([[.5, .45]]), contexte({ largeur, hauteur, ventX: 20 }), .5), p = e.gouttes[0];
    const trajectoire = [(p.x - .5) * largeur / hauteur, p.y - .45];
    if (reference) trajectoire.forEach((v, i) => proche(v, reference[i])); else reference = trajectoire;
  }
});

verifier('l’adhérence et la fusion changent la mobilité sans imposer une direction opposée au flux', () => {
  const petite = avancer(creer([[.25, .2]], { taille: 2, pr: 2, glisse: .04, vitesse: 0 }), contexte({ vitesse: 80 }), .6);
  const grosse = avancer(creer([[.25, .2]], { taille: 8, pr: 8, glisse: .04, vitesse: 0 }), contexte({ vitesse: 80 }), .6);
  assert(grosse.gouttes[0].x < petite.gouttes[0].x && petite.gouttes[0].x < .25);
  const fusion = creer([[.25, .2], [.252, .2]], { taille: 3, pr: 3, glisse: .04, vitesse: 0 });
  avancer(fusion, contexte({ vitesse: 80 }), 1 / 30, 30);
  assert.equal(fusion.stats.fusionsEau, 1); assert.equal(fusion.gouttes[0].glisse, 1);
  avancer(fusion, contexte({ vitesse: 80 }), .5);
  assert(fusion.gouttes[0].x < .25 && fusion.gouttes[0].y < .2);
});

verifier('les changements de vitesse, regard et vent donnent les mêmes trajectoires de 30 à 144 Hz', () => {
  let reference;
  const phases = [{ vitesse: 0 }, { vitesse: 30 / 3.6 }, { vitesse: 100 / 3.6, ventX: 4 },
    { vitesseZ: -200 / 3.6, cameraYaw: .1 }, { vitesseZ: -300 / 3.6, cameraYaw: Math.PI, ventX: -4 }, { vitesse: 0 }];
  for (const hz of [30, 47, 60, 120, 144]) {
    const e = creer([[.4, .35], [.65, .65]]), flux = e.flux, points = e.gouttes.map(p => [p, p.traceX, p.traceY]);
    for (const phase of phases) avancer(e, contexte(phase), 1, hz);
    const valeurs = e.gouttes.slice(0, 2).flatMap(p => [p.x, p.y, p.age, ...p.traceX, ...p.traceY]);
    valeurs.push(e.stats.expulses, e.stats.seches, e.stats.surfaceExpulsee, e.stats.etapes);
    if (reference) valeurs.forEach((v, i) => proche(v, reference[i], `${hz} Hz / ${i}`)); else reference = valeurs;
    assert.strictEqual(e.flux, flux);
    e.gouttes.forEach((p, i) => { assert.strictEqual(p, points[i][0]); assert.strictEqual(p.traceX, points[i][1]); assert.strictEqual(p.traceY, points[i][2]); });
  }
});

verifier('le flux réutilise la sortie et borne les entrées invalides sans écrire dans le contexte', () => {
  const sortie = {}, c = Object.freeze(contexte({ vitesse: NaN, ventX: Infinity, cameraYaw: 'non', cameraPitch: null }));
  assert.strictEqual(V.calculerFlux(c, sortie), sortie); assert(Object.values(sortie).every(Number.isFinite));
  assert.equal(sortie.air, 0); assert.equal(sortie.graviteY, 1);
  V.calculerFlux(contexte({ vitesse: 100, ventX: 1e30, ventY: -1e30 }), sortie);
  assert(Object.values(sortie).every(Number.isFinite)); assert(sortie.air <= 1 && sortie.expansion >= 0);
});

console.log('vitre flux : ' + controles + ' contrôles passés');
