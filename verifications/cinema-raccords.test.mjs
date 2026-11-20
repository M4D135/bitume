// Exécute le raccord caméra de rendreVue, extrait de jeu.js : aucun WebGL simulé comme preuve d'image.
// La collision contrôlée force les replis ; les circuits, le réalisateur et les plans cinéma sont réels.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'course', 'cinema', 'realisateur']) require('../src/' + f + '.js');
const B = globalThis.BITUME, R = B.realisateur, C = B.cinema;
const source = readFileSync(process.argv[2] || new URL('../src/jeu.js', import.meta.url), 'utf8');
const regardDebut = source.indexOf('  function regardArriereVoulu(');
const regardFin = source.indexOf('  const RAYON_REGARD', regardDebut);
assert(regardDebut >= 0 && regardFin > regardDebut, 'garde de regard arrière introuvable');
// Le stick est réellement maintenu dans le contexte : la garde de production doit laisser la démo intacte.
const regard = `const ecran = 'course', commande = () => 'manette';
const canvas = { clientWidth: 1280, clientHeight: 720 };
const pad = { manette: { connected: true, axes: [0, 0, 0, 1] } }, pad2 = pad;
const cameraRegardArriere = () => { throw new Error('regard arrière activé pendant une démo'); };
` + source.slice(regardDebut, regardFin);
const debut = source.indexOf('  function rendreVue('), fin = source.indexOf('    // Habitats partagés', debut);
assert(debut >= 0 && fin > debut, 'raccord de production introuvable');
const constantes = ['VUES_DEHORS', 'DANS_LA_ROCHE', 'CAMERAS_DEMO', 'PORTEE_VUE'].map(n => {
  const ligne = source.match(new RegExp('^  const ' + n + ' = [^\\n]+;', 'm'));
  assert(ligne, n); return ligne[0];
}).join('\n');
const raccord = new Function('B', 'tampons', 'reglages', 'profilDe', 'cameraTele', 'cameraPoursuite', 'cameraDemo', 'soleilDe',
  'session', 'cameraEssai', 'horlogeReelle', 'clamp', regard + '\n' + constantes + '\n' + source.slice(debut, fin) +
  '\nreturn { cam, vue, suivie, ps };\n}\nreturn rendreVue;');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cameraSimple = nom => (S, v, p) => {
  // Poursuite reçoit (S, pose, état), télévision (S, voiture, pose).
  const q = nom === 'tele' ? p : v;
  return { pos: [q.x - (nom === 'aileron' ? .66 : 8), q.y + (nom === 'aileron' ? 1.17 : 3), q.z], yaw: 0, pitch: 0, fov: 45, nom };
};
let controles = 0;
function verifier(nom, fn) { fn(); controles++; console.log('ok ' + nom); }
function seance(theme = 'cote', graine = 29) {
  const c = B.circuit.creer(graine, { theme, longueur: theme === 'montagne' ? 5200 : 3600 });
  const co = B.course.creer(c, { mode: 'course', tours: 2, rivaux: 11, graine: 42 });
  const collision = { bloquee: false, seuil: 15 };
  // Le masque est loin du sujet : le poste est perdu, mais le bras de poursuite autour de la voiture
  // reste libre. Les vrais volumes et trajectoires sont vérifiés dans cinema-trajectoires.test.mjs.
  const monde = { raycast: (o, d, distance) => d[0] === 0 && d[1] === -1 && d[2] === 0
    ? { hit: true, y: 0 } : { hit: collision.bloquee && distance > collision.seuil } };
  const cinema = C.preparer(c, { nappes: [], lots: [], sol: () => 0 }, null, monde);
  const poses = co.voitures.map(v => ({ ...B.circuit.echantillon(c, v.etat.s), tangage: 0, roulis: 0 }));
  const S = { type: 'demo', course: co, cinema, real: R.creer(77), sortie: [], rouleVu: [], tRendu: 0,
    tele: { poste: {} }, distances: new Float64Array(12).fill(9), vRel: new Float64Array(12).fill(8),
    camCap: 2, tete: {}, secousse: 3 };
  const rendre = raccord(B, { poses }, { secousses: 1 }, () => ({}), cameraSimple('tele'), cameraSimple('poursuite'), cameraSimple('aileron'),
    (vue, x, y, z) => ({ center: [x, y, z] }), S, null, 0, clamp);
  return { c, co, cinema, poses, S, rendre, collision };
}
function filtresReinitialises(S) {
  assert.equal(S.camCap, null); assert.equal(S.tete, null); assert.equal(S.tele.poste, null);
  assert(S.distances.every(v => v === -1)); assert(S.vRel.every(v => v === 0)); assert.equal(S.secousse, 0);
}

verifier('le paysage garde sa trajectoire ; le masquage crée une coupe puis reste en course', () => {
  const { co, cinema, S, rendre, collision } = seance();
  S.planVu = R.tenir(S.real, co, cinema);
  assert.equal(S.planVu.vue, 'panorama');
  const sujet = co.voitures[S.planVu.sujet], avant = S.planVu, n = S.real.n;
  const a = rendre(S, sujet, 'panorama', 1 / 60, {});
  assert.equal(S.regardArriere, false, 'le stick droit ne détourne pas la caméra de démonstration');
  assert(a.cam.sujetNature); assert.deepEqual(a.cam.sun.center, a.cam.cible);
  assert.equal(S.planVu, avant, 'le rendu ne recoupe pas un paysage visible');
  collision.bloquee = true;
  const b = rendre(S, sujet, 'panorama', 1 / 60, {});
  assert.equal(b.vue, 'poursuite'); assert.equal(b.cam.nom, 'poursuite');
  assert.notEqual(S.planVu, avant); assert.equal(S.planVu, S.real.plan); assert.equal(S.planVu.n, n + 1);
  assert.equal(S.planVu.motif, 'cadre'); filtresReinitialises(S);
  collision.bloquee = false;
  const c = rendre(S, sujet, S.planVu.vue, 1 / 60, {});
  assert.equal(c.vue, 'poursuite'); assert.equal(S.planVu.n, n + 1, 'un arbre qui se démasque ne fait pas revenir la caméra');
});

for (const [vue, tunnel] of [['pilote', true], ['peloton', false]]) {
  verifier(`${vue} : le repli du sprint suit la tête jusqu'au drapeau`, () => {
    const { c, co, cinema, poses, S, rendre, collision } = seance('montagne', 47);
    const tete = co.voitures[co.classement[0]];
    co.phase = 'course'; co.horloge = 100; S.tRendu = 100;
    for (const v of co.voitures) { v.etat.v = 30; v.progression = 200; }
    tete.progression = co.toursTotal * c.longueur - 200;
    S.real.vert = 5; S.real.plansCourse = 3;
    S.real.plan = { vue, sujet: tete.id, debut: 99, fin: 110, n: ++S.real.n, cote: 1 };
    S.planVu = R.tenir(S.real, co, cinema); assert(S.real.sprint); assert.equal(S.planVu.vue, vue);
    if (tunnel) {
      assert(c.tunnel, 'vrai tunnel de Haut-Col');
      tete.etat.s = (c.tunnel.debut + c.tunnel.fin) / 2;
      poses[tete.id] = { ...B.circuit.echantillon(c, tete.etat.s), tangage: 0, roulis: 0 };
    } else collision.bloquee = true;
    const cadre = rendre(S, tete, vue, 1 / 60, {});
    assert.equal(cadre.vue, 'poursuite');
    const repli = S.planVu;
    assert.equal(repli.motif, 'sprint'); assert.equal(repli.sujet, tete.id); assert.equal(cadre.suivie.id, repli.sujet);
    assert(repli.fin > co.horloge + 300); filtresReinitialises(S);
    // Ancien défaut : au-delà de sept secondes, le repli expirait et relançait un panorama.
    co.horloge += 15; assert.equal(R.tenir(S.real, co, cinema), repli); assert(!repli.nature);
    co.drapeau = co.horloge; tete.fini = true; tete.tempsFinal = co.horloge;
    const arrivee = R.tenir(S.real, co, cinema);
    assert.equal(arrivee.motif, 'arrivee'); assert.equal(arrivee.sujet, tete.id);
  });
}

verifier('la perte de visibilité ne change pas le sujet entre le plan et son cadre', () => {
  const { co, cinema, poses, S, rendre, collision } = seance();
  co.phase = 'course'; co.horloge = 100; S.tRendu = 100;
  const tete = co.voitures[co.classement[0]], ancien = co.voitures[(tete.id + 1) % co.voitures.length];
  S.real.sprint = true;
  S.planVu = S.real.plan = { vue: 'peloton', sujet: ancien.id, debut: 99, fin: 200, n: 1, cote: 1 };
  collision.bloquee = true;
  const cadre = rendre(S, ancien, 'peloton', 1 / 60, {});
  assert.equal(S.planVu.sujet, tete.id); assert.equal(cadre.suivie, tete); assert.equal(cadre.ps, poses[tete.id]);
  assert.equal(cadre.cam.pos[0], poses[tete.id].x - 8);
});

verifier('le repli embarqué est contrôlé dès sa première image et reste le même plan', () => {
  const { co, cinema, S, rendre, collision } = seance();
  co.phase = 'course'; co.horloge = S.tRendu = 100;
  S.planVu = S.real.plan = { vue: 'peloton', sujet: 0, debut: 99, fin: 110, n: ++S.real.n, cote: 1 };
  const avant = S.real.n; collision.bloquee = true; collision.seuil = 1.2;
  const cadre = rendre(S, co.voitures[0], 'peloton', 1 / 60, {});
  assert.equal(cadre.vue, 'aileron'); assert.equal(S.planVu.vue, 'aileron');
  assert.equal(S.real.n, avant + 2); assert(cinema.cadres.has(S.planVu), 'le premier cadre embarqué échappe à la garde');
  const plan = S.planVu; co.horloge = S.tRendu = 100 + 1 / 60;
  assert.equal(rendre(S, co.voitures[0], 'aileron', 1 / 60, {}).vue, 'aileron');
  assert.equal(S.planVu, plan, 'boucle de replis sur le même obstacle');
});

verifier('le cadre du peloton reste continu aux limites de participation des rivaux', () => {
  const { cinema, co } = seance();
  const plan = { vue: 'peloton', sujet: 0, debut: 0, fin: 5, cote: 1 };
  const p = { x: 0, y: 10, z: 0, cap: 0, tangage: 0, roulis: 0 };
  for (const seuil of [35, 65, 90]) {
    const a = C.camera(cinema, plan, [p, { ...p, x: seuil - .001 }], co, 2);
    const b = C.camera(cinema, plan, [p, { ...p, x: seuil + .001 }], co, 2);
    assert(a && b);
    assert(Math.hypot(...a.pos.map((v, i) => v - b.pos[i])) < .01, `bond au seuil ${seuil} m`);
    assert(Math.abs(a.yaw - b.yaw) < .001);
  }
});
console.log(controles + ' vérifications réussies');
