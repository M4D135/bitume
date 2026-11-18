// BITUME, lot 19 : modèle et effet de la visière sous la pluie et la neige (prototype du rapport vitre-2026-11-18).
// Ce que la simulation garantit : même état quel que soit le rythme d'images, aucun hasard pris à la course, aucune
// allocation par image, et les comportements voulus (l'air chasse l'eau, l'arrêt l'accumule, le nuage d'eau monte vite
// et retombe lentement, la neige s'entasse au bord, la buée ne vient que dans le casque).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../docs/reprise/rapports/vitre-2026-11-18/visiere.js');
const V = globalThis.BITUME.visiere;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const kmh = v => v / 3.6;
const entree = (o = {}) => Object.assign({ pluie: 0, neige: 0, vitesse: 0, embruns: 0, froid: 0, humidite: 0, vue: 'cockpit',
  abri: false, intensite: 1, graine: 0, cibleX: .5, cibleY: .5, cibleTaille: .1, proche: .38, fondu: .03 }, o);
function simuler(c, secondes, hz = 60, e = V.creer()) { const n = Math.round(secondes * hz); for (let i = 0; i < n; i++) V.avancer(e, 1 / hz, c); return e; }
const u = e => Array.from(V.uniformes(e));
// Préprocesseur réduit à ce que l'effet emploie (#define, #if VISIERE_PALIER>=n, #ifdef, #else, #endif) : rend le
// code que compile chaque palier, et remplace les noms définis (VISIERE_SCENE → uScene…).
function pretraiter(source) {
  const defs = {}, pile = [], sortie = [];
  const actif = () => pile.every(x => x.vrai);
  for (const l of source.split('\n')) {
    let m;
    if ((m = l.match(/^#define (\w+) (.*)$/))) { if (actif()) defs[m[1]] = m[2].trim(); }
    else if ((m = l.match(/^#if VISIERE_PALIER>=(\d+)\s*$/))) pile.push({ vrai: Number(defs.VISIERE_PALIER) >= Number(m[1]) });
    else if ((m = l.match(/^#ifdef (\w+)\s*$/))) pile.push({ vrai: m[1] in defs });
    else if (/^#else\s*$/.test(l)) pile[pile.length - 1].vrai = !pile[pile.length - 1].vrai;
    else if (/^#endif\s*$/.test(l)) { assert(pile.pop(), '#endif sans #if'); }
    else if (/^#/.test(l)) assert.fail('directive inconnue : ' + l);
    else if (actif()) sortie.push(l.replace(/\b(VISIERE_SCENE|VISIERE_VOILE)\b/g, n => defs[n] || n));
  }
  assert.equal(pile.length, 0, '#if non fermé');
  return sortie.join('\n');
}
// indices des uniformes (voir uniformes() dans visiere.js)
const I = { t: 0, glisse: 1, vent: 2, cycle: 3, gouttelettes: 4, gouttes: 5, coulures: 6, trainees: 7, embruns: 8,
  neigeCollee: 12, bourrelet: 13, neige: 14, buee: 16, vue: 18, air: 19, nappes: 26 };

verifier('même état à 30, 47, 60, 120 et 144 images par seconde, et avec des images irrégulières', () => {
  const c = entree({ pluie: 1, vitesse: kmh(120), embruns: .4 });
  const ref = u(simuler(c, 20, 60));
  for (const hz of [30, 47, 120, 144]) assert.deepEqual(u(simuler(c, 20, hz)), ref, hz + ' Hz');
  // durées d'image irrégulières (suite fixe, sans Math.random) dont la somme fait 20 s
  const e = V.creer(); let t = 0, x = 12345;
  while (t < 20 - 1e-9) { x = (x * 1103515245 + 12345) % 2147483648; const dt = Math.min(20 - t, .004 + .03 * x / 2147483648); V.avancer(e, dt, c); t += dt; }
  const v = u(e);
  for (let i = 0; i < v.length; i++) assert(Math.abs(v[i] - ref[i]) <= 1e-4 * Math.max(1, Math.abs(ref[i])), 'uniforme ' + i + ' : ' + v[i] + ' contre ' + ref[i]);
  // À 144 Hz, une image sur six ne contient aucun pas entier : le reliquat prolonge les horloges, sinon les gouttes
  // s'arrêteraient une image sur six (saccade). Chaque image avance donc, et l'horloge suit le temps écoulé.
  const f = V.creer(); let avant = [-1, -1, -1];
  for (let i = 1; i <= 720; i++) {
    V.avancer(f, 1 / 144, c); const w = V.uniformes(f);
    for (const [j, n] of [[0, I.t], [1, I.vent], [2, I.cycle]]) { assert(w[n] > avant[j], 'horloge ' + n + ' figée à l\'image ' + i); avant[j] = w[n]; }
    assert(Math.abs(w[I.t] - i / 144) < 2e-5, 'horloge ' + w[I.t] + ' contre ' + i / 144);
  }
});

verifier('aucun hasard pris à la course, aucune allocation par image, état réutilisé', () => {
  const alea = Math.random; Math.random = () => { throw Error('hasard partagé'); };
  try {
    const e = V.creer(), c = entree({ pluie: .7, neige: .3, vitesse: 30, embruns: .5, froid: .5, humidite: .5 });
    const tableau = V.uniformes(e), cles = Object.keys(e).join();
    for (let i = 0; i < 2000; i++) { assert.strictEqual(V.avancer(e, 1 / 144, c), e); assert.strictEqual(V.uniformes(e), tableau); }
    assert.equal(Object.keys(e).join(), cles);                       // aucune propriété ajoutée en route
    assert.equal(tableau.length, V.TAILLE_UNIFORMES); assert.equal(V.TAILLE_UNIFORMES, V.VEC4 * 4);
    assert.deepEqual(c, entree({ pluie: .7, neige: .3, vitesse: 30, embruns: .5, froid: .5, humidite: .5 })); // entrée intacte
  } finally { Math.random = alea; }
  // deux séances identiques donnent les mêmes nombres
  const c = entree({ pluie: 1, vitesse: 10 });
  assert.deepEqual(u(simuler(c, 15)), u(simuler(c, 15)));
});

verifier('pas fixe : un gros écart d\'image ne fait pas rattraper plus de 0,25 s ; pause et entrées folles sans effet', () => {
  const e = V.creer(), c = entree({ pluie: 1 });
  V.avancer(e, 5, c); assert.equal(e.etapes, 30);                    // 0,25 s au plus, soit 30 pas
  const avant = u(e);
  for (const dt of [0, -1, NaN, Infinity]) V.avancer(e, dt, c);
  assert.deepEqual(u(e), avant);
  const f = simuler({ pluie: NaN, neige: 'x', vitesse: -Infinity, embruns: 7, froid: undefined, intensite: NaN, graine: -3 }, 3);
  assert(u(f).every(Number.isFinite)); assert(f.embruns <= 1); assert.equal(f.intensite, 1);
});

verifier('l\'air chasse l\'eau : à 250 km/h, peu de gouttes posées, des traînées, ni coulure ni nappe', () => {
  const vite = simuler(entree({ pluie: 1, vitesse: kmh(250) }), 30), arret = simuler(entree({ pluie: 1, vitesse: 0 }), 30);
  assert(vite.gouttes < .45 && arret.gouttes > .9, `posées ${vite.gouttes} à 250, ${arret.gouttes} à l'arrêt`);
  assert(vite.trainees > .8 && arret.trainees < .01);
  assert(vite.coulures < .01 && arret.coulures > .5);
  assert(vite.nappes < .01 && arret.nappes > .5);
  assert(vite.air > .99 && arret.air === 0);
  // à l'arrêt, la gravité fait glisser les coulures ; à 250 km/h, c'est le vent qui fait courir l'eau
  assert(arret.vGlisse > 0 && vite.vGlisse === 0 && vite.vVent > arret.vVent);
});

verifier('nuage d\'eau d\'une voiture : monte en moins d\'une demi-seconde, retombe plus lentement', () => {
  const e = simuler(entree({ pluie: .6, vitesse: kmh(230), embruns: .9 }), .5);
  assert(e.embruns > .75, 'montée ' + e.embruns);
  const haut = e.embruns; simuler(entree({ pluie: .6, vitesse: kmh(230), embruns: 0 }), .5, 60, e);
  assert(e.embruns > haut * .55 && e.embruns < haut, 'retombée ' + e.embruns);
  simuler(entree({ pluie: .6, vitesse: kmh(230), embruns: 0 }), 8, 60, e); assert(e.embruns < .01);
});

verifier('embruns() : seuils des gerbes de traces.js, portée, écart latéral', () => {
  assert.equal(V.embruns(10, 0, 50, .12), 0);                          // piste trop peu mouillée
  assert.equal(V.embruns(10, 0, 14, 1), 0);                            // trop lent pour soulever l'eau
  assert.equal(V.embruns(-5, 0, 50, 1), 0);                            // derrière nous
  assert.equal(V.embruns(75, 0, 70, 1), 0);                            // éteint au-delà de 70 m
  const pres = V.embruns(8, 0, 60, 1), loin = V.embruns(40, 0, 60, 1), cote = V.embruns(8, 4, 60, 1);
  assert(pres > .8 && pres <= 1); assert(loin > 0 && loin < pres); assert(cote < pres);
  assert(V.embruns(8, 0, 25, 1) < pres);                               // plus lente, moins d'eau soulevée
});

verifier('viser() : même projection que la pluie de meteo.js, rien derrière, taille qui décroît', () => {
  const cam = { pos: [0, 1, 0], yaw: 0, pitch: 0, fov: 60 }, s = {};
  assert.equal(V.viser(s, cam, 0, 1, -20, 16 / 9, 1.8), true);
  assert(Math.abs(s.cibleX - .5) < 1e-12 && Math.abs(s.cibleY - .5) < 1e-12);
  const taille20 = s.cibleTaille;
  V.viser(s, cam, 2, 2, -20, 16 / 9, 1.8); assert(s.cibleX > .5 && s.cibleY > .5);      // à droite et plus haut
  V.viser(s, cam, 0, 1, -40, 16 / 9, 1.8); assert(Math.abs(s.cibleTaille - taille20 / 2) < 1e-12);
  assert.equal(V.viser(s, cam, 0, 1, 20, 16 / 9, 1.8), false);                          // derrière la caméra
  // caméra tournée d'un quart de tour (yaw = π/2) : le devant est +x
  assert.equal(V.viser(s, { pos: [0, 0, 0], yaw: Math.PI / 2, pitch: 0, fov: 60 }, 10, 0, 0, 1, 1), true);
  assert(Math.abs(s.cibleX - .5) < 1e-9);
});

verifier('neige : flocons collés, bourrelets qui s\'entassent puis fondent, eau de fonte', () => {
  const c = entree({ neige: 1, vitesse: kmh(45), froid: 1 });
  const e = simuler(c, 60);
  assert(e.neigeCollee > .5); assert(e.bourrelet > .4, 'bourrelet ' + e.bourrelet); assert(e.gouttes > 0);
  const avant = e.bourrelet;
  simuler(entree({ neige: 0, vitesse: kmh(45), froid: 0 }), 60, 60, e);
  assert(e.bourrelet < avant * .7, 'fonte ' + e.bourrelet); assert(e.neigeCollee < .05);
  // l'air chasse les flocons : moins de neige collée à 200 km/h
  assert(simuler(entree({ neige: 1, vitesse: kmh(200), froid: 1 }), 20).neigeCollee < simuler(c, 20).neigeCollee);
});

verifier('buée : froid humide à l\'arrêt, dans le casque seulement ; la vitesse l\'efface', () => {
  const froid = entree({ froid: .9, humidite: .9, vitesse: 0 });
  assert(simuler(froid, 30).buee > .6);
  assert.equal(simuler(Object.assign({}, froid, { vue: 'exterieur' }), 30).buee, 0);
  assert(simuler(Object.assign({}, froid, { vitesse: kmh(100) }), 30).buee < .01);
  assert(simuler(entree({ froid: .1, humidite: .9 }), 30).buee < .1);
});

verifier('tunnel et intensité : à l\'abri plus rien n\'arrive ; le réglage d\'intensité ne touche que l\'affichage', () => {
  const e = simuler(entree({ pluie: 1, vitesse: kmh(200) }), 10);
  simuler(entree({ pluie: 1, vitesse: kmh(200), abri: true }), 10, 60, e);
  assert(e.gouttes < .02 && e.trainees < .01, 'sous abri ' + e.gouttes + ' ' + e.trainees);
  const a = simuler(entree({ pluie: .5, vitesse: 20 }), 10), b = simuler(entree({ pluie: .5, vitesse: 20, intensite: .5 }), 10);
  assert.equal(a.gouttes, b.gouttes);                                // même simulation
  assert(Math.abs(u(b)[I.gouttes] - u(a)[I.gouttes] * .5) < 1e-6);    // affichage à moitié
});

verifier('vue extérieure : l\'objectif, pas la visière', () => {
  const e = simuler(entree({ pluie: .8, vitesse: kmh(220), vue: 'exterieur', froid: 1, humidite: 1 }), 20), v = u(e);
  assert.equal(v[I.vue], 1); assert.equal(v[24], 0);                  // pas de cockpit à épargner
  assert.equal(v[I.buee], 0); assert(v[I.gouttes] > .1);
});

verifier('à sec, rien ne s\'allume : l\'effet rend la scène telle quelle (seuil de sortie du shader)', () => {
  const v = u(simuler(entree({ vitesse: kmh(180), froid: .2, humidite: .2 }), 30));
  const actif = v[4] + v[5] + v[6] + v[7] + v[8] + v[12] + v[13] + v[14] + v[16];
  assert(actif <= .0008, 'somme ' + actif);
  // même seuil dans les deux entrées du shader : la scène nette (paliers Moyenne et Fine), rien à mélanger (Légère)
  assert(V.GLSL.includes('if(actif<=.0008)return net;'));
  const legere = V.GLSL.slice(V.GLSL.indexOf('vec4 visiereLegere(vec2 uv){'));
  assert(/^vec4 visiereLegere\(vec2 uv\)\{\n  float actif=[^\n]*;\n  if\(actif<=\.0008\)return vec4\(0\.\);/.test(legere), 'sortie à sec de Légère');
});

verifier('source GLSL : paliers, échantillonneurs, Légère sans lecture de la scène', () => {
  const s0 = V.source('low'), s1 = V.source('medium', 'uScene', 'uVoile'), s2 = V.source(2, 'uScene', 'uVoile');
  assert(s0.startsWith('#define VISIERE_PALIER 0\n') && !s0.includes('#define VISIERE_SCENE'));
  assert(s1.startsWith('#define VISIERE_PALIER 1\n#define VISIERE_SCENE uScene\n#define VISIERE_VOILE uVoile\n'));
  assert(s2.startsWith('#define VISIERE_PALIER 2\n'));
  assert.strictEqual(V.source('high', 'uScene', 'uVoile'), s2);      // préparée une fois
  for (const n of ['uniform vec4 uVisiere[7];', 'uniform vec2 uVisiereTaille;', 'uniform vec3 uVisiereCiel;',
    'vec3 visiere(vec2 uv)', 'vec4 visiereLegere(vec2 uv)']) assert(V.GLSL.includes(n), n);
  // Chaque palier, une fois ses #if résolus : parenthèses et accolades équilibrées ; au palier Légère, aucune
  // lecture de texture et pas de fonction visiere() (elle exige l'image de la scène).
  for (const [palier, src] of [[0, s0], [1, s1], [2, s2]]) {
    const code = pretraiter(src).replace(/\/\/.*$/gm, '');
    for (const [a, b] of [['(', ')'], ['{', '}'], ['[', ']']]) assert.equal(code.split(a).length, code.split(b).length, 'palier ' + palier + ' ' + a + b);
    assert(code.includes('vec4 visiereLegere(vec2 uv)'));
    if (palier === 0) assert(!code.includes('texture(') && !code.includes('vec3 visiere(vec2 uv)'));
    else assert(code.includes('vec3 visiere(vec2 uv)') && code.includes('texture(uScene,'));
  }
  assert.equal(Object.isFrozen(V), true); assert.equal(Object.isFrozen(V.PALIERS.low), true);
});

console.log('visiere : ' + controles + ' contrôles passés');
