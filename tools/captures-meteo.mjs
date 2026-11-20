#!/usr/bin/env node
// États de rendu bornés : pas de conduite ni de mesure FPS. Les voitures sont disposées puis figées;
// leurs vitesses alimentent la visière et les embruns pendant que l'horloge météo avance normalement.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from './controle-visuel.mjs';

export const SCENARIOS = Object.freeze([
  { id: 'pluie-grille', vitesse: 0, chauffe: 90 },
  { id: 'pluie-spray235', vitesse: 235 / 3.6, chauffe: 90, spray: true },
  { id: 'neige45', vitesse: 45 / 3.6, chauffe: 120, saison: 'hiver' },
  { id: 'duo', vitesse: 45, chauffe: 60, duo: true },
  { id: 'pause-reprise', vitesse: 25, chauffe: 90, pause: true, images: 3 },
  { id: 'tunnel', vitesse: 35, chauffe: 90, circuit: 2, tunnel: true },
  { id: 'legere', vitesse: 45, chauffe: 60, qualite: 'low' },
  { id: 'sec', vitesse: 0, chauffe: 4, sec: true },
  { id: 'faune-haut-col-ete', vitesse: 0, chauffe: 4, circuit: 2, faune: true, saison: 'ete', sec: true },
  { id: 'faune-haut-col-hiver', vitesse: 0, chauffe: 4, circuit: 2, faune: true, saison: 'hiver', sec: true },
  // Même pose, même allure et ciel couvert : sans pluie ambiante, l'eau ne vient que des pneus des rivaux.
  // Le témoin coupe l'humidité (les reflets de chaussée changent aussi) sans déplacer ni ralentir les voitures.
  { id: 'sillage300', vitesse: 300 / 3.6, chauffe: 60, spray: true, pluie: 0, mouille: 1, nuage: .9, controleSillage: true },
  { id: 'sillage300-sec', vitesse: 300 / 3.6, chauffe: 60, rival: true, sec: true, pluie: 0, mouille: 0, nuage: .9, controleSillage: true },
  { id: 'sillage300-poursuite', vitesse: 300 / 3.6, chauffe: 60, spray: true, pluie: 0, mouille: 1, nuage: .9, vue: 'poursuite', controleSillage: true },
  { id: 'sillage300-helico', vitesse: 300 / 3.6, chauffe: 60, rival: true, vue: 'helico', inactif: true, controleSillage: true }
].map(Object.freeze));
// Complément E3 explicite : les campagnes historiques gardent leur liste et leur coût.
// Les deux portraits fixent le viewport ; le duo exerce deux caméras réelles dans la même image.
export const SCENARIOS_E3 = Object.freeze([
  { id: 'sillage300-portrait-cockpit', vitesse: 300 / 3.6, chauffe: 60, images: 3, spray: true, pluie: 0, mouille: 1,
    nuage: .9, vue: 'cockpit', taille: '540,960', controleSillage: true },
  { id: 'sillage300-portrait-poursuite', vitesse: 300 / 3.6, chauffe: 60, images: 3, spray: true, pluie: 0, mouille: 1,
    nuage: .9, vue: 'poursuite', taille: '540,960', controleSillage: true },
  { id: 'duo-vues', vitesse: 45, chauffe: 60, images: 3, duo: true, vue: 'cockpit', vue2: 'poursuite' }
].map(Object.freeze));
// Qualification ciblée, explicite : 17 PNG en trois groupes. Le changement de force conserve
// l'histoire de l'eau ; cette série montre les quatre réglages, pas une mesure de densité à âge égal.
export const SCENARIOS_PLUIE = Object.freeze([
  { id: 'pluie-forces-arceau', vue: 'aileron', vitesse: 120 / 3.6, chauffe: 20, images: 4,
    pluie: .2, forces: [.2, .45, .75, 1] },
  { id: 'pluie-impact-arceau', vue: 'aileron', vitesse: 0, chauffe: 0, images: 5, pas: 1 / 120,
    pluie: 1, instantsImpact: [0, 1 / 30, .1, .25, .4] },
  { id: 'pluie-duo-cockpit-arceau', vue: 'cockpit', vue2: 'aileron', vitesse: 120 / 3.6, chauffe: 60, duo: true, pluie: .75 },
  { id: 'pluie-arceau-sec', vue: 'aileron', vitesse: 120 / 3.6, chauffe: 4, sec: true },
  { id: 'carrosserie-pluie', vue: 'helico', vitesse: 0, chauffe: 80, pluie: 1, nuage: .9, carrosserie: true, inactif: true },
  { id: 'carrosserie-sec', vue: 'helico', vitesse: 0, chauffe: 80, sec: true, nuage: .9, carrosserie: true, inactif: true }
].map(s => Object.freeze({ qualificationPluie: true, ...s,
  ...(s.forces ? { forces: Object.freeze(s.forces) } : {}),
  ...(s.instantsImpact ? { instantsImpact: Object.freeze(s.instantsImpact) } : {}) })));
const TOUS_SCENARIOS = Object.freeze([...SCENARIOS, ...SCENARIOS_E3, ...SCENARIOS_PLUIE]);
const CAS_AVANT = ['pluie-grille', 'pluie-spray235', 'neige45', 'faune-haut-col-ete', 'faune-haut-col-hiver', 'sillage300'];

export function optionsMeteo(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const cle = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'avant', 'sortie', 'chrome', 'cas', 'taille'].includes(cle) || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw new Error('Option inconnue ou valeur absente : ' + argv[i]);
    o[cle] = argv[i + 1];
  }
  if (!o.url || !o.sortie) throw new Error('--url et --sortie nécessaires');
  for (const cle of ['url', 'avant']) if (o[cle] && !['file:', 'http:', 'https:'].includes(new URL(o[cle]).protocol)) throw new Error('URL file/http/https attendue');
  o.cas = o.cas ? o.cas.split(',') : SCENARIOS.map(s => s.id);
  if (!o.cas.length || new Set(o.cas).size !== o.cas.length || o.cas.some(id => !TOUS_SCENARIOS.some(s => s.id === id))) throw new Error('Cas météo inconnu ou dupliqué');
  if (o.cas.some(id => SCENARIOS_PLUIE.some(s => s.id === id)) && new URL(o.url).protocol !== 'file:')
    throw new Error('Qualification pluie : URL file: nécessaire pour identifier le HTML exact');
  o.taille = o.taille || '960,540';
  const taille = o.taille.split(',').map(Number);
  if (taille.length !== 2 || taille.some(n => !Number.isInteger(n) || n < 240 || n > 1920)) throw new Error('Taille attendue : largeur,hauteur (240..1920)');
  return o;
}

// Cette fonction est sérialisée dans la page d'essai. Elle ne fait aucun appel réseau et ne remplace aucun module.
export function preparerEtat(s) {
  const J = BITUME_JEU, B = BITUME, S = J.session, co = S.course, c = co.c;
  S.acc = -1; J.pauseAuto = false; J.reglages.gouttes = 1;
  // Conserver le HUD des témoins historiques malgré le nouveau défaut utilisateur Non.
  J.reglages.annoncesVirages = 'ecran';
  const pluie = s.pluie ?? (s.sec ? 0 : 1), mouille = s.mouille ?? (s.sec ? 0 : 1);
  Object.assign(S.meteo, { reel: true, fixe: true, pluie, pluieFixe: pluie, nuage: s.nuage ?? (s.sec ? .12 : .9), phase: pluie > 0 ? 'pluie' : 'clair', mouille,
    neige: s.saison === 'hiver', precipitationsNeige: pluie > 0 && s.saison === 'hiver', eclair: 0 });
  const depart = s.tunnel ? c.tunnel.debut - 60 : 280;
  function placer(v, abscisse, d, vitesse) {
    const e = v.etat, p = B.circuit.echantillon(c, abscisse);
    Object.assign(e, { s: ((abscisse % c.longueur) + c.longueur) % c.longueur, d, v: vitesse, psi: 0, beta: 0,
      y: p.y - d * Math.sin(p.devers || 0), tangage: Math.atan(p.pente || 0), roulis: p.devers || 0 });
    const pose = { x: p.x - Math.sin(p.cap) * d, y: e.y, z: p.z + Math.cos(p.cap) * d, cap: p.cap,
      tangage: e.tangage, roulis: e.roulis, braquage: 0, roule: v.roule || 0, rebond: [0, 0, 0, 0] };
    if (e._physx) {
      Object.assign(e._physx, { x: pose.x, y: pose.y, z: pose.z, cap: pose.cap, groundCount: 4 });
      // Pose figée, vitesse des effets explicite : le flux utilise le vecteur physique, pas seulement e.v.
      const horizontal = vitesse * Math.cos(pose.tangage);
      e._physx.velocity[0] = Math.cos(p.cap) * horizontal;
      e._physx.velocity[1] = Math.sin(pose.tangage) * vitesse;
      e._physx.velocity[2] = Math.sin(p.cap) * horizontal;
    }
    for (const liste of [S.prec, S.cour]) Object.assign(liste[v.id], pose);
  }
  for (const v of co.voitures) {
    const joueur = v.id === S.suivie, j2 = S.locaux?.[1] === v.id;
    const rival = (s.spray || s.rival) && v.id === 1;
    const ds = joueur ? 0 : j2 && s.duo ? -14 : rival ? 18 : 30 + v.id * 9;
    placer(v, depart + ds, joueur || j2 || rival ? 0 : (v.id % 2 ? 2.6 : -2.6), j2 && s.duo ? 12.5 : s.vitesse);
  }
  let faune = null;
  if (s.faune) {
    J.reglages.faune = 'high';
    const C = B.cinema.preparer(c, J.scene.decor, S.animaux, co.physique.world);
    B.cinema.regler(C, { faune: 'high', nuit: 0, pluie: 0 });
    const a = C.ancres.faune.find(a => a.label === 'Bouquetin des Alpes');
    if (!a) throw new Error('Ancre Bouquetin des Alpes absente');
    const t = S.tRendu || 0, plan = { vue: 'faune', ancre: a, sujet: 0, debut: t, fin: t + 60, cote: -1, n: 1, nature: true };
    const camera = B.cinema.camera(C, plan, S.cour, co, t);
    if (!camera) throw new Error('Caméra faune absente');
    S.cinema = C; J.camera = () => camera;
    const animal = B.animaux.poseAnimal(S.animaux, a.indice, t), T = S.animaux.G.T;
    const groundY = B.animaux.solExact(T, animal.x, animal.z), cible = [animal.x, groundY + .06, animal.z], dir = cible.map((v, i) => v - camera.pos[i]);
    const distance = Math.hypot(...dir), hit = co.physique.world.raycast(camera.pos, dir.map(v => v / distance), distance - .04, { mask: 3, staticOnly: true });
    faune = { camera: JSON.parse(JSON.stringify(camera)), animal: JSON.parse(JSON.stringify(animal)), groundY,
      cameraGroundY: B.animaux.solExact(T, camera.pos[0], camera.pos[2]), solVisible: !hit.hit, obstructionDistance: hit.hit ? hit.distance : null };
  }
  const F = globalThis.__METEO_FIXTURE = { faune, controleSillage: !!s.controleSillage || !!s.qualificationPluie,
    positions: () => co.voitures.map(v => ({ id: v.id, s: v.etat.s, d: v.etat.d, v: v.etat.v })),
    qualificationPluie: !!s.qualificationPluie, lentilles: {}, impact: null, instantDemande: null,
    forceDemandee: pluie, cameraPrescrite: null, carrosserie: !!s.carrosserie,
    tunnel() { for (const v of co.voitures) placer(v, c.tunnel.debut + 95 + v.id * 5, 0, s.vitesse); } };
  if (s.qualificationPluie) {
    // Observe les objets reçus par la vraie API, après son unique mise à jour. Aucune particule,
    // graine, enveloppe, liste de rendu ou uniforme n'est écrit par cet observateur.
    const mettreAJour = B.vitre.mettreAJour;
    B.vitre.mettreAJour = function (e, dt, contexte) {
      const joueur = contexte === S.vitreContexte ? 'j1' : contexte === S.vueJ2?.vitreContexte ? 'j2' : null;
      if (joueur && !F.lentilles[joueur]) F.lentilles[joueur] = { e, contexte, depart: e.stats.impactsEmis || 0 };
      const r = mettreAJour(e, dt, contexte);
      if (joueur === 'j1' && s.instantsImpact && !F.impact) {
        const d = e.simulation?.depots || e, k = Math.max(0, Math.min(1, d.accumulateur * 30));
        for (let indice = 0; indice < Math.min(32, d.gouttes.length); indice++) {
          const p = d.gouttes[indice], age = p.impactAvant * (1 - k) + p.impactAge * k;
          // Sélection d'une vraie arrivée récente au milieu de la lentille, visible hors de l'ATH.
          if (p.vivant && p.impactForce > 0 && age < .009 && p.impactRayon >= 5 &&
            p.x > .2 && p.x < .8 && p.y > .25 && p.y < .75) {
            // Les poses sont figées par S.acc = -1 : tRendu appartient à la course arrêtée.
            // Les dépôts continuent par dtImage et fournissent leur propre horloge native.
            const temps = d.temps + d.accumulateur;
            F.impact = { indice, identite: p.phase, naissance: temps - age, origine: temps + s.pas };
            break;
          }
        }
      }
      return r;
    };
  }
  if (s.carrosserie) {
    // Même caméra d'inspection physique pour les deux témoins ; la vue distante coupe la lentille.
    J.camera = () => {
      const p = S.cour[S.suivie || 0], M = B.voiture.attitude(p.cap, p.tangage, p.roulis);
      const monde = q => B.voiture.mul(M, q).map((x, k) => x + [p.x, p.y, p.z][k]);
      F.cameraPrescrite = B.cinema.viser(monde([.95, 1.1, -1.05]), monde([.7, .38, -.30]), 40);
      return F.cameraPrescrite;
    };
  }
  const avancer = __BITUME_CAPTURE.avancer;
  __BITUME_CAPTURE.avancer = ms => {
    // Les traces conservent leur pas de 30 Hz. Elles utilisent les vraies fonctions du jeu et le mouillage de la scène.
    if (J.ecran === 'course' && !s.faune && !s.sec && s.vitesse > 14)
      for (let i = 0; i < 3; i++) B.traces.pas(S.fx, co, S.cour, S.suivie || 0, 1 / 30, null);
    return avancer(ms);
  };
  return { poseFigee: true, vitesseEffetsKmh: s.vitesse * 3.6, faune, positions: F.controleSillage ? F.positions() : null,
    annoncesVirages: J.reglages.annoncesVirages,
    cameraPrescrite: s.carrosserie ? { poste: [.95, 1.1, -1.05], cible: [.7, .38, -.30], fov: 40 } : null,
    qualificationPluie: !!s.qualificationPluie,
    description: 'Positions fixées par outil; horloge météo et rendu réels. Aucun essai de conduite ou de FPS.' };
}

// Sérialisée dans le navigateur. Un appel ne fait au plus qu'un pas de recherche/alignement
// d'impact ; le capturer natif avancera encore d'un pas avant le PNG.
export function avantImageMeteo(s, i, avancerImpact = false) {
  const F = __METEO_FIXTURE, S = BITUME_JEU.session, pas = s.pas || .1;
  if (s.tunnel && i === 0) F.tunnel();
  if (s.pause && (i === 0 || i === 2)) document.getElementById(i === 0 ? 'b-pause' : 'b-reprendre').click();
  if (s.forces) {
    F.forceDemandee = s.forces[i];
    Object.assign(S.meteo, { pluie: F.forceDemandee, pluieFixe: F.forceDemandee });
    if (i > 0) for (let n = 0; n < 20; n++) __BITUME_CAPTURE.avancer(100);
  }
  if (s.instantsImpact) {
    if (avancerImpact) __BITUME_CAPTURE.avancer(pas * 1000);
    if (!F.impact) return { impact: false };
    F.instantDemande = s.instantsImpact[i];
    const e = F.lentilles.j1.e, d = e.simulation?.depots || e;
    return { impact: true, temps: d.temps + d.accumulateur, cible: F.impact.origine + F.instantDemande - pas };
  }
  return true;
}

// La recherche peut rendre 960 images : chaque pas doit rendre la main à DevTools,
// pas retenir une seule Runtime.evaluate pendant tous les rendus logiciels.
export async function preparerImageMeteo(s, i, evaluer) {
  const expression = avancer => `(${avantImageMeteo.toString()})(${JSON.stringify(s)},${i},${avancer})`;
  let etat = await evaluer(expression(false));
  if (!s.instantsImpact) return etat;
  const pas = s.pas || .1;
  if (i === 0) {
    // Même cadence pendant la recherche et les cinq PNG ; mêmes huit secondes au maximum.
    for (let n = 0; n < Math.ceil(8 / pas) && !etat.impact; n++) etat = await evaluer(expression(true));
    if (!etat.impact) throw new Error('Aucun impact natif récent et cadré en huit secondes');
  }
  for (let n = 0; n < 60 && etat.temps < etat.cible - 1e-7; n++) etat = await evaluer(expression(true));
  if (!etat.impact || Math.abs(etat.temps - etat.cible) > 1e-5) throw new Error('Instant de l’impact non atteint');
  return true;
}

export function observerEtat() {
  const J = BITUME_JEU, S = J.session, gl = J.rendu.gl, F = __METEO_FIXTURE;
  const contexte = v => v ? Object.fromEntries(['pluie', 'neige', 'vitesse', 'vitesseX', 'vitesseY', 'vitesseZ', 'cameraYaw', 'cameraPitch', 'cameraRoll', 'abri', 'cockpit', 'qualite', 'intensite', 'embruns', 'pause', 'actif'].map(k => [k, v[k]])) : null;
  const vitres = J.vitres || null, vitresGL = {}, visieresVisibles = {};
  for (const [joueur, id] of [['j1', 'vitre'], ['j2', 'vitre2']]) {
    const toile = document.getElementById(id), css = toile && getComputedStyle(toile);
    visieresVisibles[joueur] = !!toile && !toile.hidden && css.display !== 'none' && css.visibility !== 'hidden';
  }
  for (const [joueur, id] of [['j1', 'vitre'], ['j2', 'vitre2']]) if (vitres?.[joueur]?.backend === 'webgl2') {
    const g = document.getElementById(id)?.getContext('webgl2');
    vitresGL[joueur] = { present: !!g, erreur: g ? g.getError() : null, perdu: g ? g.isContextLost() : true };
  }
  let pluie = null;
  if (F.qualificationPluie) {
    const lentilles = {};
    for (const [joueur, ref] of Object.entries(F.lentilles)) {
      const e = ref.e, simulation = e.simulation, d = simulation?.depots || e;
      const uniformes = simulation?.impactsUniformes || [], n = simulation?.nbGouttes || 0;
      let impactsDessines = 0, forceMax = 0;
      for (let i = 0; i < n; i++) { if (uniformes[i * 4 + 1] > .005) impactsDessines++; forceMax = Math.max(forceMax, uniformes[i * 4 + 1] || 0); }
      lentilles[joueur] = { graine: d.graine, emis: d.stats.impactsEmis - ref.depart, impactsDessines, forceMax,
        sourceCourante: ref.contexte === (joueur === 'j1' ? S.vitreContexte : S.vueJ2?.vitreContexte),
        pool: d.gouttes.length, uniformes: uniformes.length, gouttesDessinees: n, temps: d.temps };
    }
    let impact = null;
    if (F.impact && F.lentilles.j1) {
      const e = F.lentilles.j1.e, simulation = e.simulation, d = simulation?.depots || e;
      const p = d.gouttes[F.impact.indice], k = Math.max(0, Math.min(1, d.accumulateur * 30));
      const age = p.impactAvant * (1 - k) + p.impactAge * k, uniformes = simulation?.impactsUniformes || [];
      let indiceUniforme = -1;
      for (let i = 0; i < (simulation?.nbGouttes || 0); i++) if (Math.abs(uniformes[i * 4 + 2] - F.impact.identite) < 1e-6) { indiceUniforme = i; break; }
      const j = indiceUniforme * 4;
      impact = { ...F.impact, instantDemande: F.instantDemande, instant: d.temps + d.accumulateur - F.impact.origine,
        identiteCourante: p.phase, vivant: p.vivant, age, duree: p.impactDuree, forceInitiale: p.impactForce,
        indiceUniforme, uniforme: indiceUniforme < 0 ? null : Array.from(uniformes.slice(j, j + 4)),
        perle: indiceUniforme < 0 ? null : Array.from(simulation.gouttesUniformes.slice(j, j + 4)),
        centreCSS: [(p.px * (1 - k) + p.x * k) * d.largeur, (p.py * (1 - k) + p.y * k) * d.hauteur] };
    }
    const eau = S.modeles?.[S.suivie || 0]?.eauCarrosserie, presents = new Set(S.sortie);
    const carrosserie = eau ? { humide: eau.humide, pluie: eau.pluie, actives: eau.actives, age: eau.age,
      revisions: eau.revisions, dernierInstant: eau.dernierInstant, pool: eau.gouttes.length,
      dessineesSujet: eau.gouttes.filter(g => presents.has(g.objet)).length,
      dessineesTotal: [...presents].filter(o => o.shape === 'bitume-goutte-carrosserie').length } : null;
    pluie = { forceDemandee: F.forceDemandee, pluieFixe: S.meteo.pluieFixe, lentilles, impact, carrosserie,
      cameraPrescrite: F.cameraPrescrite, tempsRendu: S.tRendu };
  }
  return { glErreur: gl.getError(), glPerdu: gl.isContextLost(), vitres, vitresGL, visieresVisibles,
    annoncesVirages: J.reglages?.annoncesVirages,
    j1: contexte(S.vitreContexte), j2: contexte(S.vueJ2?.vitreContexte), faune: __METEO_FIXTURE.faune,
    vue: S.vue, vue2: S.vueJ2?.vue || null, positions: __METEO_FIXTURE.controleSillage ? __METEO_FIXTURE.positions() : null,
    camera: S.camera ? { pos: [...S.camera.pos], yaw: S.camera.yaw, pitch: S.camera.pitch, roll: S.camera.roll || 0, fov: S.camera.fov } : null,
    camera2: S.vueJ2?.camera ? { pos: [...S.vueJ2.camera.pos], yaw: S.vueJ2.camera.yaw, pitch: S.vueJ2.camera.pitch, roll: S.vueJ2.camera.roll || 0, fov: S.vueJ2.camera.fov } : null,
    precipitation: { pluie: S.meteo.pluie, neige: S.meteo.precipitationsNeige, mouille: S.meteo.mouille },
    temps: S.meteo.t, ecran: J.ecran, pluie };
}

export function verifierRapport(r, s, candidat) {
  const fautes = [];
  if (r.fatal) fautes.push(r.fatal.split('\n')[0]);
  for (const e of r.erreurs) fautes.push('Erreur page : ' + e);
  for (const e of r.avertissements) if (/GL_INVALID|shader.*(error|failed)|GLSL|context lost/i.test(e)) fautes.push('Erreur graphique : ' + e);
  if (r.images.length !== (s.images || 2)) fautes.push('Nombre de captures incomplet');
  if (!/swiftshader|llvmpipe|software/i.test(r.environnement.gpu || '')) fautes.push('Raster logiciel non identifié');
  if (s.taille && s.taille.split(',').some((n, i) => r.environnement.resolution?.[i] !== Number(n))) fautes.push('Viewport portrait différent du scénario');
  for (const im of r.images) {
    const o = im.observation;
    if (!o) { fautes.push('Observation absente'); continue; }
    if (o.glErreur || o.glPerdu) fautes.push('Échec WebGL : ' + o.glErreur + (o.glPerdu ? ' / contexte perdu' : ''));
    for (const g of Object.values(o.vitresGL || {})) if (!g.present || g.erreur || g.perdu) fautes.push('Échec WebGL de la visière');
    for (const vue of ['scene', ...(s.duo ? ['scene2'] : [])]) if (im.vues?.[vue]?.noir > .97 && im.vues[vue].luminance < .025) fautes.push('Vue rendue noire : ' + vue);
    if (s.duo && (!o.j2 || !im.etat.zones.scene2)) fautes.push('Vue J2 incomplète');
    const qualite = s.qualite || 'high';
    if (!s.faune && o.j1?.qualite !== qualite) fautes.push('Qualité rendue différente du scénario');
    // Légère conserve les glaces peintes de la voiture, sans toiles ni rendus arrière (graphismes.PROFILS.low).
    // Fine doit montrer les deux vraies images pour chaque joueur ; une caméra faune les masque aussi.
    const glaces = !s.faune && qualite !== 'low' ? [
      ...(!s.vue || s.vue === 'cockpit' ? ['glace-g', 'glace-d'] : []),
      ...(s.duo && (!s.vue2 || s.vue2 === 'cockpit') ? ['glace-g2', 'glace-d2'] : [])
    ] : [];
    for (const id of ['glace-g', 'glace-d', 'glace-g2', 'glace-d2']) {
      if (glaces.includes(id) && !im.etat.zones[id]) fautes.push('Rétroviseurs incomplets : ' + id);
      if (!glaces.includes(id) && im.etat.zones[id]) fautes.push('Toile de rétroviseur inattendue : ' + id);
    }
    if (s.tunnel && o.j1?.abri !== true) fautes.push('Caméra non abritée dans le tunnel');
    if (s.saison === 'hiver' && !s.faune && !(o.j1?.neige > 0 && o.j1.pluie === 0)) fautes.push('Neige non distinguée de la pluie');
    if (candidat && !s.faune) {
      if (s.taille && !(im.etat.zones.scene?.width > 0 && im.etat.zones.scene.height > im.etat.zones.scene.width)) fautes.push('Scène portrait non exercée');
      if (s.duo && s.vue2) {
        if (o.vue !== (s.vue || 'cockpit') || o.vue2 !== s.vue2) fautes.push('Vues différentes du duo non exercées');
        for (const [joueur, nomVue, camera] of [['j1', s.vue || 'cockpit', o.camera], ['j2', s.vue2, o.camera2]]) {
          const contexte = o[joueur], optique = o.vitres?.[joueur];
          if (!Array.isArray(camera?.pos) || camera.pos.length !== 3 || !camera.pos.every(Number.isFinite) ||
            ![camera.yaw, camera.pitch, camera.roll, camera.fov].every(Number.isFinite)) fautes.push('Caméra du duo absente ou invalide : ' + joueur);
          if (contexte?.cockpit !== (nomVue === 'cockpit') || contexte?.actif !== true || contexte?.qualite !== qualite ||
            !(contexte?.pluie > 0 && optique?.eau > .05) || o.visieresVisibles?.[joueur] !== true) fautes.push('Pluie de la vue du duo non exercée : ' + joueur);
          if (contexte?.cameraYaw !== camera?.yaw || contexte?.cameraPitch !== camera?.pitch || contexte?.cameraRoll !== camera?.roll)
            fautes.push('Flux du duo raccordé à une autre caméra : ' + joueur);
        }
        if (JSON.stringify(o.camera?.pos) === JSON.stringify(o.camera2?.pos)) fautes.push('Caméras du duo non indépendantes');
      }
      if (!o.vitres?.j1) fautes.push('Diagnostic de visière J1 absent');
      for (const v of Object.values(o.vitres || {})) if (v?.erreur || v?.erreurs?.length || typeof v?.erreurs === 'number' && v.erreurs > 0 || v?.perdu) fautes.push('Erreur de visière : ' + JSON.stringify(v.erreur || v.erreurs || 'contexte perdu'));
      if (!s.sec && s.qualite !== 'low' && o.vitres?.j1?.backend !== 'webgl2') fautes.push('Optique WebGL2 inactive');
      if (s.duo && !o.vitres?.j2) fautes.push('Diagnostic visière J2 absent');
      if (!s.sec) for (const joueur of s.duo ? ['j1', 'j2'] : ['j1']) {
        const v = o.vitres?.[joueur];
        if (!v || v.pret !== true || !s.inactif && !(v.dessins > 1 && v.etapes > 0)) fautes.push('Visière non préparée ou non dessinée : ' + joueur);
        if (!s.inactif && v?.backend === 'webgl2' && s.qualite !== 'low' && !(v.copiesScene > 1 && v.pixelsSource > 0)) fautes.push('Scène non lue par la visière : ' + joueur);
      }
      if (s.spray && !(o.j1?.embruns > 0)) fautes.push('Nuage du rival absent');
      if (s.sec && (o.j1?.pluie || o.j1?.neige || o.j1?.embruns)) fautes.push('Effet humide présent au sec');
      if (s.controleSillage) {
        if (o.vue !== (s.vue || 'cockpit')) fautes.push('Vue sillage différente du scénario');
        if (!(Math.abs(o.j1?.vitesse * 3.6 - 300) < 1e-6)) fautes.push('Allure des effets différente de 300 km/h');
        if (!Array.isArray(o.positions) || o.positions.length < 2 || JSON.stringify(o.positions) !== JSON.stringify(r.initialisation?.positions)) fautes.push('Positions du contrôle sillage non figées');
        if (!o.camera || !Array.isArray(o.camera.pos) || o.camera.pos.length !== 3 || !o.camera.pos.every(Number.isFinite)) fautes.push('Caméra de contrôle sillage absente');
        if (s.pluie === 0 && (o.j1?.pluie !== 0 || o.precipitation?.pluie !== 0)) fautes.push('Pluie ambiante présente dans le contrôle des projections seules');
        if (s.spray && (!(o.precipitation?.mouille > .5) || !(o.vitres?.j1?.eau > .05) || o.visieresVisibles?.j1 !== true)) fautes.push('Dépôts de sillage non visibles à grande vitesse');
        if (s.sec || s.inactif) {
          const v = o.vitres?.j1;
          if (!v || !['eau', 'accumulationNeige', 'embruns', 'gouttes', 'neige'].every(k => v[k] === 0) || o.visieresVisibles?.j1 !== false) fautes.push('Dépôts résiduels sur une visière qui doit être vide');
        }
        if (s.sec && o.precipitation?.mouille !== 0) fautes.push('Humidité source non coupée dans le témoin');
        if (s.inactif && (o.j1?.actif !== false || !(o.precipitation?.pluie > 0))) fautes.push('Exclusion de la visière aérienne non exercée sous la pluie');
      }
    }
    if (s.faune && candidat) {
      if (!o.faune || !Number.isFinite(o.faune.groundY) || !Number.isFinite(o.faune.cameraGroundY) || o.faune.camera.pos[1] < o.faune.cameraGroundY + .6 || Math.abs(o.faune.animal.y - o.faune.groundY) > .08) fautes.push('Caméra ou animal hors de son appui terrain');
      if (o.faune?.solVisible !== true) fautes.push('Sol sous les sabots masqué par le terrain');
    }
  }
  if (s.pause && r.images.length === 3) {
    const [a, b, c] = r.images.map(i => i.observation);
    if (a?.ecran !== 'pause' || b?.ecran !== 'pause' || c?.ecran !== 'course') fautes.push('Pause/reprise non exercée');
    if (a?.temps !== b?.temps || !(c?.temps > b?.temps)) fautes.push('Horloge météo non figée/reprise');
  }
  if (candidat && s.qualificationPluie) fautes.push(...verifierPluie(r, s));
  return [...new Set(fautes)];
}

export function verifierPluie(r, s) {
  const fautes = [], proche = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-5;
  for (const [i, im] of r.images.entries()) {
    const o = im.observation, q = o?.pluie, force = s.forces?.[i] ?? s.pluie ?? (s.sec ? 0 : 1);
    if (!q) { fautes.push('Diagnostic de qualification pluie absent'); continue; }
    if (o.vue !== s.vue || s.duo && o.vue2 !== s.vue2) fautes.push('Caméra pluie demandée non exercée');
    if (!proche(o.precipitation?.pluie, force) || !proche(q.pluieFixe, force) || q.forceDemandee !== force)
      fautes.push('Force de pluie demandée non conservée');
    if (!r.initialisation?.positions?.length || JSON.stringify(o.positions) !== JSON.stringify(r.initialisation.positions))
      fautes.push('Positions de qualification pluie non figées');
    for (const joueur of s.duo ? ['j1', 'j2'] : ['j1']) {
      const l = q.lentilles?.[joueur], c = o[joueur], camera = joueur === 'j1' ? o.camera : o.camera2;
      if (!l || !l.sourceCourante || l.pool !== 112 || l.uniformes !== 128 || o.vitres?.[joueur]?.backend !== 'webgl2')
        fautes.push('Pool ou source WebGL des impacts absent : ' + joueur);
      if (!camera || !Array.isArray(camera.pos) || camera.pos.length !== 3 || !camera.pos.every(Number.isFinite) ||
        ![camera.yaw, camera.pitch, camera.roll, camera.fov].every(Number.isFinite) ||
        !proche(c?.cameraYaw, camera.yaw) || !proche(c?.cameraPitch, camera.pitch) || !proche(c?.cameraRoll, camera.roll))
        fautes.push('Flux pluie non raccordé à la caméra : ' + joueur);
      if (!proche(c?.pluie, force) || c?.actif !== !s.inactif) fautes.push('Contexte pluie incorrect : ' + joueur);
      if (s.sec || s.inactif) {
        if (l?.emis !== 0 || l?.impactsDessines !== 0 || l?.gouttesDessinees !== 0 || o.visieresVisibles?.[joueur] !== false)
          fautes.push('Impact présent sur la lentille sèche ou distante : ' + joueur);
      } else if (!(l?.emis > 0) || o.visieresVisibles?.[joueur] !== true) fautes.push('Impacts natifs non exercés : ' + joueur);
    }
    if (s.duo && q.lentilles?.j1?.graine === q.lentilles?.j2?.graine) fautes.push('Graines des lentilles J1/J2 non indépendantes');
    if (s.instantsImpact) {
      const a = q.impact;
      if (!a || !proche(a.instant, s.instantsImpact[i]) || a.instantDemande !== s.instantsImpact[i])
        fautes.push('Chronologie de naissance de la goutte incomplète');
      if (!a || !a.vivant || a.identiteCourante !== a.identite || a.indiceUniforme < 0 || a.uniforme?.length !== 4 || a.perle?.length !== 4)
        fautes.push('Goutte suivie absente du vrai tampon WebGL');
      else {
        if (!(a.duree >= .18 && a.duree <= .28) || !proche(a.uniforme[0], Math.min(1, a.age / a.duree)))
          fautes.push('Phase d’impact différente de la particule');
        if (i === 0 && !(a.age >= 0 && a.age <= .02)) fautes.push('Naissance de la goutte capturée trop tard');
        if ((i === 1 || i === 2) && !(a.uniforme[1] > .005)) fautes.push('Couronne d’impact non dessinée pendant son arrivée');
        if (i === s.instantsImpact.length - 1 && !(a.uniforme[0] === 1 && a.uniforme[1] === 0 && a.perle[3] > 0))
          fautes.push('Impact non terminé ou perle résiduelle absente');
        const premier = r.images[0].observation?.pluie?.impact;
        if (premier && (a.indice !== premier.indice || a.identite !== premier.identite || !proche(a.age - premier.age, s.instantsImpact[i])))
          fautes.push('La série ne suit pas la même goutte');
      }
    }
    if (s.carrosserie) {
      const e = q.carrosserie, camera = q.cameraPrescrite;
      if (!e || e.pool !== 192 || !(e.age >= 7.9 && e.revisions > 0) || !proche(e.pluie, force))
        fautes.push('Eau de carrosserie non préparée ou exposition incomplète');
      if (!camera || !proche(camera.fov, 40) || JSON.stringify(camera.pos) !== JSON.stringify(o.camera?.pos) ||
        !proche(camera.yaw, o.camera?.yaw) || !proche(camera.pitch, o.camera?.pitch)) fautes.push('Caméra réelle du gros plan de carrosserie différente');
      if (s.sec ? !(e?.humide === 0 && e?.actives === 0 && e?.dessineesSujet === 0 && e?.dessineesTotal === 0)
        : !(e?.humide > .9 && e?.actives >= 170 && e?.dessineesSujet > 0 && e.dessineesSujet <= e.actives))
        fautes.push('Gouttes physiques de carrosserie non distinguées du témoin sec');
    }
  }
  return [...new Set(fautes)];
}

export function optionsScenario(s, url, sortie, o) {
  const vue = s.vue || 'cockpit';
  if (!['cockpit', 'poursuite', 'aileron', 'helico'].includes(vue)) throw new Error('Vue du scénario météo inconnue');
  if (s.vue2 && (!s.duo || !['cockpit', 'poursuite', 'aileron'].includes(s.vue2))) throw new Error('Seconde vue du scénario météo invalide');
  const retro = !s.faune && (vue === 'cockpit' || s.duo && (!s.vue2 || s.vue2 === 'cockpit'));
  const args = ['--url', url, '--sortie', sortie, '--scenario', s.duo ? 'duo' : 'pluie', '--images', String(s.images || 2), '--chauffe', String(s.chauffe),
    '--taille', s.taille || o.taille, '--pas', String(s.pas || .1), '--qualite', s.qualite || 'high', '--circuit', String(s.circuit || 0),
    '--saison', s.saison || 'ete', '--meteo', s.sec || s.qualificationPluie ? 'sec' : 'pluie', '--vitesse', String(s.vitesse), '--depart', '280', '--retro', retro ? 'oui' : 'non', '--attendre', '120000'];
  if (s.vue2 && s.vue2 !== 'aileron') args.push('--vue2', s.vue2);
  if (o.chrome) args.push('--chrome', o.chrome);
  const p = optionsCapture(args);
  // L'API reference du jeu accepte aussi helico et aileron. Le CLI générique reste limité aux deux vues de conduite ;
  // ce scénario versionné choisit sa caméra par la même API, sans remplacer le calcul de caméra.
  p.referenceJeu.vue = vue;
  if (s.vue2) p.referenceJeu.vue2 = s.vue2;
  return p;
}

// Contraste de deux rendus candidats : le témoin retire l'eau des sources, mais conserve toutes les voitures.
// Le changement d'aspect de la chaussée est attendu ; aucun seuil de pixels ne prétend isoler la seule visière.
export function verifierContrasteSillage(humide, sec) {
  const fautes = [];
  if (!humide || !sec || humide.images?.length !== 2 || sec.images?.length !== 2) return ['Paire humide/sec incomplète'];
  const poses = humide.initialisation?.positions;
  if (!poses?.length || JSON.stringify(poses) !== JSON.stringify(sec.initialisation?.positions)) fautes.push('Paire humide/sec : voitures déplacées ou allures différentes');
  for (let i = 0; i < 2; i++) {
    const a = humide.images[i].observation, b = sec.images[i].observation;
    if (!a || !b) { fautes.push('Paire humide/sec : observation manquante'); continue; }
    if (JSON.stringify(a.camera) !== JSON.stringify(b.camera) || !a.camera) fautes.push('Paire humide/sec : caméra différente');
    if (a.temps !== b.temps) fautes.push('Paire humide/sec : horloge différente');
    if (JSON.stringify(a.positions) !== JSON.stringify(b.positions) || !a.positions?.length) fautes.push('Paire humide/sec : positions différentes pendant le rendu');
    if (!(a.j1?.embruns > 0 && a.vitres?.j1?.eau > .05) || b.j1?.embruns !== 0 || b.vitres?.j1?.eau !== 0) fautes.push('Paire humide/sec : apport réel du sillage non distingué');
  }
  return [...new Set(fautes)];
}

export function verifierContrasteCarrosserie(humide, sec) {
  const fautes = [];
  if (!humide || !sec || humide.images?.length !== 2 || sec.images?.length !== 2) return ['Paire carrosserie humide/sec incomplète'];
  if (JSON.stringify(humide.initialisation?.cameraPrescrite) !== JSON.stringify(sec.initialisation?.cameraPrescrite) ||
    !humide.initialisation?.cameraPrescrite) fautes.push('Paire carrosserie : prescription de caméra différente');
  for (let i = 0; i < 2; i++) {
    const a = humide.images[i].observation, b = sec.images[i].observation;
    if (!a || !b) { fautes.push('Paire carrosserie : observation manquante'); continue; }
    if (!a.camera || JSON.stringify(a.camera) !== JSON.stringify(b.camera)) fautes.push('Paire carrosserie : caméra différente');
    if (!a.positions?.length || JSON.stringify(a.positions) !== JSON.stringify(b.positions)) fautes.push('Paire carrosserie : poses ou vitesses différentes');
    if (!Number.isFinite(a.temps) || Math.abs(a.temps - b.temps) > 1e-6 || Math.abs(a.pluie?.carrosserie?.age - b.pluie?.carrosserie?.age) > 1e-6)
      fautes.push('Paire carrosserie : exposition de durée différente');
    if (!(a.pluie?.carrosserie?.dessineesSujet > 0 && a.pluie.carrosserie.humide > .9) ||
      !(b.pluie?.carrosserie?.dessineesSujet === 0 && b.pluie.carrosserie.humide === 0)) fautes.push('Paire carrosserie : eau physique non distinguée');
    if (a.visieresVisibles?.j1 !== false || b.visieresVisibles?.j1 !== false) fautes.push('Paire carrosserie : lentille parasite au premier plan');
  }
  return [...new Set(fautes)];
}

export async function campagne(o) {
  mkdirSync(o.sortie, { recursive: true });
  const resultat = { format: 'bitume-captures-meteo-v1', date: new Date().toISOString(), source: fileURLToPath(import.meta.url),
    limites: ['Raster logiciel SwiftShader; aucun FPS matériel qualifié.', 'Scènes disposées et figées pour comparer les effets; aucun essai de conduite.', 'Rendu et effets du HTML désigné, sans injection de leur implémentation.'], passages: [], echecs: 0 };
  const paireSillage = {}, paireCarrosserie = {};
  for (const [nom, url] of [...(o.avant ? [['avant', o.avant]] : []), ['apres', o.url]]) for (const id of o.cas.filter(id => nom !== 'avant' || CAS_AVANT.includes(id))) {
    const s = TOUS_SCENARIOS.find(s => s.id === id), sortie = path.join(o.sortie, nom, id);
    const p = optionsScenario(s, url, sortie, o);
    if (o.avant && nom === 'apres' && CAS_AVANT.includes(id)) p.reference = path.resolve(o.sortie, 'avant', id, 'rapport.json');
    p.ecrans = s.pause ? ['course', 'pause'] : ['course'];
    p.initialiser = ({ evaluer }) => evaluer(`(${preparerEtat.toString()})(${JSON.stringify(s)})`);
    p.observer = ({ evaluer }) => evaluer(`(${observerEtat.toString()})()`);
    p.avantImage = ({ evaluer, i }) => preparerImageMeteo(s, i, evaluer);
    const r = await capturer(p), erreurs = verifierRapport(r, s, nom === 'apres');
    if (s.qualificationPluie && createHash('sha256').update(readFileSync(fileURLToPath(url))).digest('hex') !== r.build?.sha256)
      erreurs.push('HTML exact modifié ou non identifié pendant la capture pluie');
    if (nom === 'apres' && (id === 'sillage300' || id === 'sillage300-sec')) paireSillage[id] = r;
    if (nom === 'apres' && s.carrosserie) paireCarrosserie[id] = r;
    const empreintes = r.images.map(im => { const png = readFileSync(path.join(sortie, im.fichier));
      return { fichier: im.fichier, octets: png.length, sha256: createHash('sha256').update(png).digest('hex') }; });
    resultat.passages.push({ variante: nom, scenario: id, dossier: path.relative(o.sortie, sortie), images: r.images.length,
      build: r.build, empreintes, erreurs });
    resultat.echecs += erreurs.length ? 1 : 0;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(resultat, null, 2) + '\n');
    process.stderr.write(`${nom}/${id} : ${r.images.length} images, ${erreurs.length} erreurs\n`);
    if (r.fatal && r.images.length === 0) break; // pas dix tentatives si le navigateur ne peut pas démarrer
  }
  if (o.cas.includes('sillage300') && o.cas.includes('sillage300-sec')) {
    const erreurs = verifierContrasteSillage(paireSillage.sillage300, paireSillage['sillage300-sec']);
    resultat.contrasteSillage = { cas: ['sillage300', 'sillage300-sec'], erreurs,
      limite: 'Humidité de la source coupée : les reflets de chaussée changent aussi. Poses, caméras et allures identiques requises.' };
    resultat.echecs += erreurs.length ? 1 : 0;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(resultat, null, 2) + '\n');
  }
  if (o.cas.includes('carrosserie-pluie') && o.cas.includes('carrosserie-sec')) {
    const erreurs = verifierContrasteCarrosserie(paireCarrosserie['carrosserie-pluie'], paireCarrosserie['carrosserie-sec']);
    resultat.contrasteCarrosserie = { cas: ['carrosserie-pluie', 'carrosserie-sec'], erreurs,
      limite: 'Même caméra physique et durée, lentille inactive. Le mouillage modifie aussi le décor ; inspection des surfaces peintes requise.' };
    resultat.echecs += erreurs.length ? 1 : 0;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(resultat, null, 2) + '\n');
  }
  return resultat;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagne(optionsMeteo(process.argv.slice(2))); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.echecs ? 1 : 0; }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
