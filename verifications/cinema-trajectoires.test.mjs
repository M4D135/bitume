// Caméras de production, trajectoires complètes et triangles du jeu dans le vrai WASM PhysX.
// Les poses suivent le tracé à vitesse prescrite : ce test qualifie le cadrage, pas la conduite.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
require('../src/moteur/renderer.js');
for (const f of ['circuit','conduite','carene','ecologie','saisons','botanique','vegetation','bords','decor','obstacles','solides-physx','ambiance','animaux','cinema']) require('../src/' + f + '.js');
const B = globalThis.BITUME, C = B.cinema, X = await chargerPhysX();
const jeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const voiture = readFileSync(new URL('../src/voiture.js', import.meta.url), 'utf8');
B.voiture = new Function(voiture.slice(voiture.indexOf('  function euler('), voiture.indexOf('  // Mêmes calculs sans tableau neuf')) + '\nreturn { attitude, mul };')();
function extraire(nom) {
  const debut = jeu.indexOf('  function ' + nom + '('); assert(debut >= 0, nom);
  let fin = jeu.indexOf('{', debut), niveau = 1;
  for (fin++; niveau && fin < jeu.length; fin++) { if (jeu[fin] === '{') niveau++; else if (jeu[fin] === '}') niveau--; }
  assert.equal(niveau, 0); return jeu.slice(debut, fin);
}
const catalogue = vm.runInNewContext(jeu.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fabrique = new Function('B', 'scene', 'clamp', `
  const PORTEE_VUE = 6000, champAdapte = v => v, angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const ramener = (s, l) => (s % l + l) % l;
  ${['cameraPoursuite','cameraHelico','cameraTele','cameraDemo','cameraSol'].map(extraire).join('\n')}
  return { cameraPoursuite, cameraHelico, cameraTele, cameraDemo, cameraSol };
`);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const ray = (world, a, b, marge = .17) => {
  const d = b.map((v, i) => v - a[i]), longueur = Math.hypot(...d);
  if (longueur < 1e-7) return { hit: false };
  return world.raycast(a, d, Math.max(.001, longueur - marge), { mask: 3, staticOnly: true });
};
function independant(world, cam, cible) {
  // Sens inverse de la garde de production ; les voitures ne sont pas des obstacles de cadrage.
  assert(!ray(world, cam.pos, cible).hit, 'la visée acceptée traverse encore un solide');
  assert(cam.pos.concat([cam.yaw, cam.pitch, cam.fov]).every(Number.isFinite));
}
let controles = 0, images = 0, refus = 0, replis = 0;
const rapports = [];
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }
function simple(world) {
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  return C.preparer(c, { nappes: [], lots: [], sol: () => 0 }, null, world);
}
function pose(c, s) {
  const p = B.circuit.echantillon(c, s); return { ...p, tangage: Math.atan(p.pente || 0), roulis: p.devers || 0 };
}
function construite(F, S, p, v, vue) {
  if (vue === 'poursuite') return F.cameraPoursuite(S, p, v.etat, 1 / 30);
  if (vue === 'helico') return F.cameraHelico(S, p, 1 / 30);
  if (vue === 'tele') return F.cameraTele(S, v, p);
  if (vue === 'sol') return F.cameraSol(S, v, p);
  return F.cameraDemo(S, p, S.planVu);
}
for (const id of ['haut-col', 'val-brule', 'baikal']) {
  const k = catalogue.find(k => k.id === id), c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur });
  B.bords.limites(c, B.bords.planifier(c));
  const decor = B.decor.construire(c, { qualite: 'high', vegetationQualite: 'high', saison: 'ete' });
  c.obstacles = B.obstacles.creer(decor.obstacles);
  const animaux = B.animaux.creer(c, decor, { saison: 'ete' }), world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1 });
  const montage = B.solidesPhysX.installer(world, c, decor), acteurs = world._bodies.size;
  try {
    const cin = C.preparer(c, decor, animaux, world), F = fabrique(B, { decor }, clamp), avant = Array.from(animaux.cour);
    C.regler(cin, { faune: 'high', nuit: 0, pluie: 0 });
    if (id === 'haut-col') {
      verifier('Haut-Col : télé avant le tunnel et hélico dans la roche sont refusés, poursuite visible', () => {
        for (const [vue, s] of [['tele', 1685], ['helico', 2070]]) {
          const p = pose(c, s), plan = { vue, debut: 0, fin: 6, sujet: 0, cote: -1, angle: 0 };
          const S = { course: { c }, camCap: null, tRendu: 2, planVu: plan, tele: { poste: null, alea: () => .5 } };
          const v = { id: 0, etat: { s, v: 40, d: 0 } }, cam = construite(F, S, p, v, vue), cible = [p.x, p.y + .65, p.z];
          assert(ray(world, cam.pos, cible).hit, vue + ' : la régression ne reproduit plus le défaut');
          assert(!C.valider(cin, cam, cible, plan, 2), vue + ' traverse encore la montagne');
          const repli = { ...plan, vue: 'poursuite' }, sure = C.poursuite(cin, F.cameraPoursuite(S, p, v.etat, 1 / 30), p, repli, 2);
          assert(sure, 'repli indisponible pour ' + vue); independant(world, sure, sure.cible);
        }
      });
      verifier('Haut-Col : les huit postes bouquetins restent lisibles pendant tout le plan', () => {
        const ancres = cin.ancres.faune.filter(a => a.label === 'Bouquetin des Alpes');
        assert.equal(ancres.length, 4);
        for (const a of ancres) for (const cote of [-1, 1]) {
          const plan = { vue: 'faune', ancre: a, sujet: 0, debut: 0, fin: 5.6, cote }, poses = [pose(c, 200)];
          let poste;
          for (let j = 0; j <= 168; j++) {
            const t = j / 30, cam = C.camera(cin, plan, poses, {}, t); assert(cam, a.indice + '/' + cote + '/' + t);
            if (poste) assert.deepEqual(cam.pos, poste); else poste = cam.pos;
            assert(C.valider(cin, cam, cam.cible, plan, t)); independant(world, cam, cam.cible);
            const p = B.animaux.poseAnimal(animaux, a.indice, t), fraction = a.taille * p.echelle / (2 * distance(cam.pos, cam.cible) * Math.tan(cam.fov * Math.PI / 360));
            assert(fraction >= .12 && fraction <= .20, 'animal trop petit ou coupé : ' + fraction);
            assert(cam.pitch > -.4, 'plongée excessive : ' + cam.pitch); images++;
          }
        }
      });
      verifier('un rocher dessiné hors PhysX bloque aussi le cadre sans changer les collisions', () => {
        let cas = null;
        for (const o of cin.visuels) {
          const y = o.p[1] + o.s[1] * .22, pos = [o.p[0] - o.rayon * 2, y, o.p[2]], cible = [o.p[0] + o.rayon * 2, y, o.p[2]];
          if (ray(world, pos, cible).hit) continue;
          const cam = C.viser(pos, cible, 42), plan = {};
          if (!C.valider(cin, cam, cible, plan, 0)) { cas = { cam, cible }; break; }
        }
        assert(cas, 'aucun rocher visuel réel isolé du maillage de sol');
        const visuels = cin.visuels; cin.visuels = [];
        try { assert(C.valider(cin, cas.cam, cas.cible, {}, 0), 'la garde ne dépend pas du rocher annoncé'); }
        finally { cin.visuels = visuels; }
        assert.equal(world._bodies.size, acteurs, 'des corps de conduite ont été ajoutés');
      });
    }
    verifier(id + ' : plans conventionnels complets, durée de six secondes et replis sans retour au poste masqué', () => {
      const bilan = { circuit: id, images: 0, refus: 0, replis: 0, acceptes: {} };
      for (const initiale of ['tele', 'helico', 'travelling', 'orbite', 'sol', 'poursuite', 'roue', 'aileron', 'arriere']) {
        for (const [n, depart] of [100, c.longueur * .31, c.longueur * .69].entries()) {
          const S = { course: { c }, camCap: null, tRendu: 0, tele: { poste: null, alea: () => .5 },
            planVu: { vue: initiale, debut: 0, fin: 6, sujet: 0, cote: n % 2 ? -1 : 1, angle: .7 } };
          const v = { id: 0, etat: { s: depart, v: 40, d: 0 } }; let vue = initiale, coupes = 0, ancien = null;
          for (let j = 0; j <= 180; j++) {
            const t = j / 30; S.tRendu = t; v.etat.s = (depart + 40 * t) % c.longueur;
            const p = pose(c, v.etat.s), cible = [p.x, p.y + .65, p.z], aspect = n === 2 ? 9 / 16 : 16 / 9;
            let cam = construite(F, S, p, v, vue), garde = cin.requetes;
            if (vue !== 'poursuite' && !C.valider(cin, cam, cam.cible || cible, S.planVu, t, aspect)) {
              assert(cin.requetes - garde <= 10); refus++; bilan.refus++; coupes++;
              S.planVu = { ...S.planVu, vue: 'poursuite', debut: t }; vue = 'poursuite'; ancien = null; S.camCap = null;
              cam = construite(F, S, p, v, vue);
            }
            if (vue === 'poursuite') {
              garde = cin.requetes; cam = C.poursuite(cin, cam, p, S.planVu, t, aspect);
              assert(cin.requetes - garde <= 15, 'travail non borné par image');
              if (!cam) {
                coupes++; replis++; bilan.replis++; S.planVu = { ...S.planVu, vue: 'aileron', debut: t }; vue = 'aileron'; ancien = null;
                cam = construite(F, S, p, v, vue); assert(C.valider(cin, cam, cible, S.planVu, t, aspect), 'repli embarqué masqué');
              }
            }
            assert(coupes <= 2, 'boucle de replis dans un même plan');
            independant(world, cam, cam.cible || cible);
            if (ancien) assert(!ray(world, ancien, cam.pos, 0).hit, 'déplacement accepté à travers un solide');
            ancien = cam.pos; images++; bilan.images++; bilan.acceptes[vue] = (bilan.acceptes[vue] || 0) + 1;
          }
        }
      }
      assert(bilan.acceptes.tele > 0 && bilan.acceptes.orbite > 0 && bilan.acceptes.sol > 0, 'plans désactivés globalement');
      assert.equal(world._bodies.size, acteurs); assert.deepEqual(Array.from(animaux.cour), avant); rapports.push(bilan);
    });
  } finally { B.solidesPhysX.liberer(montage); world.dispose(); }
}
const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1 });
try {
  world.addBox([0, -.5, 0], [100, .5, 100], { type: 'static', group: 1, queryGroup: 1 });
  const cin = simple(world);
  verifier('le plan proche en écran large est contrôlé même quand le rayon central passe', () => {
    const cam = { pos: [0, 1.3, 0], yaw: 0, pitch: 0, fov: 80, near: .5, roll: 0 }, cible = [0, 1.3, -5];
    const id = world.addBox([1.49, 1.3, -.5], [.08, 1, .1], { type: 'static', group: 2, queryGroup: 2 });
    try { assert(!ray(world, cam.pos, cible).hit); assert(!C.valider(cin, cam, cible, {}, 0, 32 / 9)); }
    finally { world.remove(id); }
  });
  verifier('un déplacement interdit est refusé dans le même plan ; une coupe explicite reste permise', () => {
    const id = world.addBox([0, 2, 0], [.2, 2, 2], { type: 'static', group: 2, queryGroup: 2 }), plan = {};
    try {
      const a = C.viser([-3, 2, 0], [-3, 2, -8], 42), b = C.viser([3, 2, 0], [3, 2, -8], 42);
      assert(C.valider(cin, a, a.cible, plan, 0)); assert(!C.valider(cin, b, b.cible, plan, .1));
      assert(C.valider(cin, b, b.cible, {}, .1));
    } finally { world.remove(id); }
  });
  verifier('le bras de poursuite se rétracte puis se détend sans bond au démasquage', () => {
    const id = world.addBox([-4, 3, 0], [.2, 3, 5], { type: 'static', group: 2, queryGroup: 2 });
    const plan = {}, p = { x: 0, y: 0, z: 0 }, cam = { pos: [-7.4, 100, 0], yaw: Math.PI / 2, pitch: -.12, fov: 64, near: .1 };
    const a = C.poursuite(cin, cam, p, plan, 0); assert(a); assert(a.pos[0] > -3.8); independant(world, a, a.cible);
    world.remove(id);
    const b = C.poursuite(cin, cam, p, plan, 1 / 60); assert(b); assert(distance(a.pos, b.pos) <= .050001); independant(world, b, b.cible);
    assert(b.pos[1] < 2.45, 'le proxy de sol à 100 m a déplacé la caméra');
  });
  verifier('le secours garde un cadre et une cible figés, avec un panorama contrôlé sans historique', () => {
    const neuf = simple(world), premier = C.secours(neuf);
    assert(premier?.sujetNature && premier.secours); independant(world, premier, premier.cible);
    const cam = C.viser([5, 2, 0], [5, 2, -8], 42);
    assert(C.valider(neuf, cam, cam.cible, {}, 1));
    cam.pos[0] = -200; cam.cible[0] = -100;
    const retenu = C.secours(neuf);
    assert.deepEqual(retenu.pos, [5, 2, 0]); assert.deepEqual(retenu.cible, [5, 2, -8]);
    assert(retenu.secours); independant(world, retenu, retenu.cible);
    assert(C.secours(neuf, 32 / 9), 'le changement de format ne retrouve aucun cadre');
  });
  verifier('souffle de passage : vitesse réelle, impulsion amortie, force nulle et état physique intact', () => {
    const plan = { vue: 'tele', sujet: 0 }, p = { x: 4, y: 0, z: 3, cap: 0 }, poses = [p];
    const co = { voitures: [{ id: 0, etat: { v: 60 } }] }, cam = C.viser([0, 1.6, 0], [4, .65, 3], 42), avant = JSON.stringify({ poses, co });
    assert(C.valider(cin, cam, cam.cible, plan, 0));
    const a = C.souffle(cin, cam, plan, poses, co, 0, 1); assert.notEqual(a, cam); assert.deepEqual(a.pos, cam.pos);
    assert(Math.abs(a.yaw - cam.yaw) <= .004 && Math.abs(a.pitch - cam.pitch) <= .002 && Math.abs(a.roll - cam.roll) <= .003);
    assert.deepEqual(C.souffle(cin, cam, plan, poses, co, 0, 1), a, 'réponse dépendante du nombre d’images');
    assert.equal(C.souffle(cin, cam, plan, poses, co, 0, 0), cam, 'Secousses=0 / mouvement réduit ignoré');
    assert.equal(JSON.stringify({ poses, co }), avant, 'la réaction modifie un acteur');
    for (const [x, z, v] of [[-4, 3, 60], [90, 3, 60], [4, 30, 60], [4, 3, 0]]) {
      assert.equal(C.souffle(cin, cam, plan, [{ ...p, x, z }], { voitures: [{ id: 0, etat: { v } }] }, 0, 1), cam, 'vibration hors passage');
    }
    const native = { voitures: [{ id: 0, etat: { v: 0, _physx: { velocity: [60, 0, 0] } } }] };
    assert.deepEqual(C.souffle(cin, cam, plan, [{ ...p, cap: 2 }], native, 0, 1), a, 'vitesse native ignorée');
    assert.equal(C.souffle(cin, cam, { ...plan, vue: 'faune' }, poses, co, 0, 1), cam, 'le souffle détourne un plan nature');
  });
} finally { world.dispose(); }
assert.equal(X.status().worlds, 0);
if (process.env.BITUME_CINEMA_TRAJECTOIRES_REPORT) writeFileSync(process.env.BITUME_CINEMA_TRAJECTOIRES_REPORT, JSON.stringify({ controles, images, refus, replis, rapports }, null, 2) + '\n');
console.log(`${controles} contrôles réussis, ${images} images de trajectoires, ${refus} refus explicites, ${replis} replis embarqués`);
