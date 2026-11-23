#!/usr/bin/env node
// Inspection du vrai modèle dans le HTML livré. Seules les poses, commandes et caméras d'essai
// sont prescrites ; aucun module, objet rendu ou calcul de pilote n'est remplacé.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from './controle-visuel.mjs';
import { SEUILS_COCKPIT, mesurerLisibiliteCockpit, mesurerSuperpositionsHud, installerObservationCockpit, observerLisibiliteCockpit } from './qualification/cockpit-lisibilite.mjs';

export const SCENARIOS_HABITACLE = Object.freeze([
  { id: 'face', poste: [1.7, 1.30, 0], cible: [0, .65, 0] },
  { id: 'profil', poste: [-.1, 1.02, -2], cible: [-.05, .62, 0] },
  { id: 'trois-quarts', poste: [-1.15, 1.55, 1.25], cible: [.05, .58, 0] },
  { id: 'cockpit', cockpit: true },
  { id: 'braquage-passage', poste: [-1.15, 1.55, 1.25], cible: [.05, .58, 0], volant: -.8, passage: true },
  { id: 'geste-majeur', poste: [.85, 1.25, -1.65], cible: [-.02, .72, 0], geste: 'majeur' },
  { id: 'cockpit-portrait', cockpit: true, taille: '540,960' },
  { id: 'lod-moyen', lod: 'moyen', fov: 60 },
  { id: 'lod-simple', lod: 'simple', fov: 60 }
].map(s => Object.freeze({ images: 2, chauffe: 24, pas: 1 / 60, fov: 40, ...s })));

// Campagne ciblée : deux états par disposition, préférences du petit paysage et vues extérieures.
export const SCENARIOS_COCKPIT = Object.freeze([
  { id: 'cockpit-mac', cockpit: true, taille: '1440,900' },
  { id: 'cockpit-paysage', cockpit: true, taille: '1280,720' },
  { id: 'cockpit-compact', cockpit: true, taille: '960,540', rival: 18,
    cartePosition: 'droite', carteTaille: 'normale', tableau: 'reduit' },
  { id: 'cockpit-carte-gauche', cockpit: true, taille: '960,540', rival: 18,
    cartePosition: 'gauche', carteTaille: 'grande', tableau: 'complet' },
  { id: 'cockpit-carte-gauche-stabilise', cockpit: true, taille: '960,540', rival: 18,
    cartePosition: 'gauche', carteTaille: 'grande', tableau: 'complet', volantVitesse: -.35, chauffeInstant: 120 },
  { id: 'cockpit-carte-droite-stabilise', cockpit: true, taille: '960,540', rival: 18,
    cartePosition: 'droite', carteTaille: 'grande', tableau: 'complet', volantVitesse: .35, chauffeInstant: 120 },
  { id: 'cockpit-vertical', cockpit: true, taille: '540,960' },
  { id: 'cockpit-duo-haut-bas', cockpit: true, taille: '1440,900', duo: true, partage: 'haut-bas' },
  { id: 'cockpit-duo-compact', cockpit: true, taille: '960,540', duo: true, partage: 'haut-bas' },
  { id: 'cockpit-duo-cote', cockpit: true, taille: '1440,900', duo: true, partage: 'cote' },
  { id: 'cockpit-profil', poste: [-.1, 1.02, -2], cible: [-.05, .62, 0], images: 1, taille: '1280,720' },
  { id: 'cockpit-trois-quarts', poste: [-1.15, 1.55, 1.25], cible: [.05, .58, 0], images: 1, taille: '1280,720' }
].map(s => Object.freeze({ images: 2, chauffe: 24, chauffeInstant: 24, volantVitesse: .65, pas: 1 / 60, fov: 40, qualification: true, ...s })));
const TOUS_SCENARIOS = [...SCENARIOS_HABITACLE, ...SCENARIOS_COCKPIT];

export function optionsHabitacle(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'avant', 'sortie', 'chrome', 'cas', 'taille', 'reference-seule'].includes(k) ||
      o[k] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Option inconnue, répétée ou valeur absente : ' + argv[i]);
    o[k] = argv[i + 1];
  }
  if (!o.url || !o.sortie) throw new Error('--url file: et --sortie nécessaires');
  if (o['reference-seule'] && (o['reference-seule'] !== 'oui' || o.avant)) throw new Error('--reference-seule oui exige une seule URL de référence');
  for (const k of ['url', 'avant']) if (o[k] && new URL(o[k]).protocol !== 'file:') throw new Error('URL file: nécessaire pour identifier le HTML exact');
  o.cas = o.cas ? o.cas.split(',') : SCENARIOS_HABITACLE.map(s => s.id);
  if (!o.cas.length || new Set(o.cas).size !== o.cas.length || o.cas.some(id => !TOUS_SCENARIOS.some(s => s.id === id))) throw new Error('Scénario habitacle inconnu ou dupliqué');
  o.taille ||= '960,540';
  optionsScenarioHabitacle(SCENARIOS_HABITACLE[0], o.url, o.sortie, o);
  return o;
}

export function optionsScenarioHabitacle(s, url, sortie, o) {
  const args = ['--url', url, '--sortie', sortie, '--scenario', s.duo ? 'duo' : 'piste', '--images', String(Math.max(2, s.images)),
    '--chauffe', String(s.chauffe), '--pas', String(s.pas), '--taille', s.taille || o.taille,
    '--qualite', 'high', '--circuit', '0', '--saison', 'ete', '--meteo', 'sec', '--vitesse', '35',
    '--depart', '280', '--vue', s.cockpit ? 'cockpit' : 'poursuite', '--retro', s.cockpit ? 'oui' : 'non', '--attendre', '120000'];
  if (o.chrome) args.push('--chrome', o.chrome);
  if (s.duo) args.push('--vue2', 'cockpit', '--partage', s.partage);
  const p = optionsCapture(args);
  // Le runner générique demande une séquence ; une seule image suffit à chacune des deux inspections extérieures.
  p.images = s.images;
  return p;
}

// Sérialisée dans la page : réglage d'une scène de référence, sans appel de rendu de substitution.
export function preparerHabitacle(s) {
  const J = BITUME_JEU, B = BITUME, S = J.session, co = S.course, sujet = co.joueur.id;
  if (S.type !== (s.duo ? 'duo' : 'course') || !S.reference) throw new Error('Séance réelle de référence requise');
  S.acc = -1; J.pauseAuto = false; J.reglages.secousses = 0; J.camera = null;
  Object.assign(J.reglages, { carte: 'oui', cartePosition: s.cartePosition || 'droite',
    carteTaille: s.carteTaille || 'normale', tableau: s.tableau || 'reduit', annoncesVirages: 'ecran' });
  co.horloge = co.temps = 12;
  for (const v of co.voitures) {
    const second = s.duo && v.id === S.locaux[1];
    const rival = s.rival && v.id === (sujet === 0 ? 1 : 0);
    const abscisse = v.id === sujet ? 280 : second ? 200 : rival ? 280 + s.rival : 430 + v.id * 12, q = B.circuit.echantillon(co.c, abscisse);
    const e = v.etat, volant = v.id === sujet ? s.volant || 0 : 0;
    Object.assign(e, { s: abscisse, d: 0, v: 35, psi: 0, beta: 0, volant, braquage: volant * .12,
      rapport: 3, regime: 9000, alat: 0, along: 0, y: q.y, tangage: Math.atan(q.pente || 0), roulis: q.devers || 0 });
    const p = { x: q.x, y: q.y, z: q.z, cap: q.cap, tangage: e.tangage, roulis: e.roulis,
      braquage: e.braquage, roule: v.roule || 0, rebond: [0, 0, 0, 0] };
    if (e._physx) {
      Object.assign(e._physx, { x: p.x, y: p.y, z: p.z, cap: p.cap, groundCount: 4 });
      const h = e.v * Math.cos(e.tangage);
      e._physx.velocity[0] = Math.cos(p.cap) * h; e._physx.velocity[1] = Math.sin(e.tangage) * e.v; e._physx.velocity[2] = Math.sin(p.cap) * h;
    }
    for (const liste of [S.prec, S.cour]) Object.assign(liste[v.id], p);
    v.progression = abscisse; v.rapportAvant = v.id === sujet && s.passage ? 2 : 3;
    v.tPassage = v.id === sujet && s.passage ? co.horloge + (s.chauffe + 1) * s.pas - .18 : -100;
  }
  let graineExpression = null;
  if (s.geste) {
    const X = B.expressionsPilote;
    for (let graine = 1; graine <= 128; graine++) {
      const E = X.creer(co.voitures.length, graine), t = co.horloge - 1 / 120;
      X.actualiser(E, co, S.cour, t - .01); X.demander(E, sujet, true); X.demander(E, sujet, false); X.actualiser(E, co, S.cour, t);
      if (X.lire(E, sujet).geste === s.geste) { S.expressions = E; graineExpression = graine; break; }
    }
    if (graineExpression === null) throw new Error('Geste réel non trouvé par les graines autorisées');
  }
  const F = globalThis.__HABITACLE_CAPTURE = { scenario: s, sujet, graineExpression, cameraPrescrite: null, distanceLOD: null };
  if (!s.cockpit) J.camera = () => {
    const p = S.cour[sujet], M = B.voiture.attitude(p.cap, p.tangage, p.roulis);
    const monde = q => B.voiture.mul(M, q).map((x, k) => x + [p.x, p.y, p.z][k]);
    let pos, cible;
    if (s.lod) {
      // Le niveau reste choisi par le jeu. La distance d'inspection est obtenue avec son API publique,
      // puis le niveau effectivement présent dans la liste de rendu sera observé indépendamment.
      const h = J.rendu.gpu.context.canvas.height, t = Math.tan(s.fov * Math.PI / 360), distances = [];
      for (let d = 2; d <= 800; d += .5) {
        const niveau = B.voiture.detailPour(d * d, t, 0) === 'simple' ? 'simple'
          : B.voiture.detailPour(d * d, t, h, Math.min(1, h / 1080));
        if (niveau === s.lod) distances.push(d);
      }
      if (!distances.length) throw new Error('Bande LOD absente à cette résolution');
      const d = s.lod === 'simple' ? distances[Math.min(5, distances.length - 1)] : distances[Math.floor(distances.length / 2)];
      F.distanceLOD = d;
      pos = [p.x - Math.sin(p.cap) * d, p.y + 32, p.z + Math.cos(p.cap) * d]; cible = monde([0, .65, 0]);
    } else { pos = monde(s.poste); cible = monde(s.cible); }
    F.cameraPrescrite = B.cinema.viser(pos, cible, s.fov);
    return F.cameraPrescrite;
  };
  const avancer = __BITUME_CAPTURE.avancer;
  __BITUME_CAPTURE.avancer = ms => { co.horloge += ms / 1000; co.temps = co.horloge; return avancer(ms); };
  return { entree: 'BITUME_JEU.reference', type: S.type, sujet, posesPrescrites: true, cameraPrescrite: !s.cockpit,
    reglagesHud: { carte: J.reglages.carte, cartePosition: J.reglages.cartePosition,
      carteTaille: J.reglages.carteTaille, tableau: J.reglages.tableau, annoncesVirages: J.reglages.annoncesVirages }, rivalDistance: s.rival || null,
    graineExpression, simulationConduite: false, description: 'Vrai modèle et vrai renderer ; caméra d’inspection via API pour les vues extérieures, caméra réelle du siège en cockpit.' };
}

// Deux conditions cinématiques prescrites, sans substituer le calcul de caméra ni faire avancer la conduite.
export function preparerInstantCockpit(i) {
  const J = BITUME_JEU, S = J.session, F = __HABITACLE_CAPTURE;
  F.relever = false; F.releves = {}; F.instant = i === 0 ? 'neutre' : 'vitesse-braquage';
  (S.locaux || [F.sujet]).forEach((id, joueur) => {
    const e = S.course.voitures[id].etat, braquagePrescrit = F.scenario?.volantVitesse ?? .65;
    const volant = i === 0 ? 0 : (joueur ? -braquagePrescrit : braquagePrescrit);
    Object.assign(e, { v: i === 0 ? 0 : 80, volant, braquage: volant * .12, alat: 0, along: 0 });
    for (const poses of [S.prec, S.cour]) poses[id].braquage = e.braquage;
  });
  S.tete = null; if (S.vueJ2) S.vueJ2.tete = null;
  return F.instant;
}

async function etapeHabitacle(evaluer, rapport, phase, expression, image = null) {
  const etape = { image, phase, etat: 'en-cours' };
  (rapport.phasesHabitacle ||= []).push(etape);
  process.stderr.write(`[habitacle ${rapport.scenarioHabitacle || rapport.scenario}] ${image === null ? '' : `image ${image} `}${phase}\n`);
  try {
    const resultat = await evaluer(expression);
    etape.etat = 'terminee';
    if (phase.startsWith('chauffe-')) etape.horloge = resultat;
    return resultat;
  } catch (e) { etape.etat = 'echec'; etape.erreur = String(e.message || e); throw e; }
}

// Chaque commande CDP rend la main au navigateur ; les nouveaux cas stabilisés prescrivent 120 pas.
// Son effet sur les délais SwiftShader reste à qualifier ; aucune pose ni frame n'est retirée.
export async function chaufferInstantCockpit({ evaluer, rapport, i }, scenario = {}) {
  const chauffe = scenario.chauffeInstant ?? 24;
  await etapeHabitacle(evaluer, rapport, 'preparer-instant', `(${preparerInstantCockpit.toString()})(${i})`, i);
  for (let n = 0; n < chauffe; n++)
    await etapeHabitacle(evaluer, rapport, `chauffe-${n + 1}/${chauffe}`, '__BITUME_CAPTURE.avancer(1000 / 60)', i);
  await etapeHabitacle(evaluer, rapport, 'armer-observation', '__HABITACLE_CAPTURE.relever = true; __HABITACLE_CAPTURE.instant', i);
  rapport.phasesHabitacle.push({ image: i, phase: 'frame-et-PNG', etat: 'attendus' });
  process.stderr.write(`[habitacle ${rapport.scenarioHabitacle || rapport.scenario}] image ${i} frame-et-PNG\n`);
}

export function observerHabitacle() {
  const J = BITUME_JEU, B = BITUME, S = J.session, F = __HABITACLE_CAPTURE, v = S.course.voitures[F.sujet], p = S.cour[F.sujet];
  const E = S.modeles[F.sujet].objetsRendu, R = E?.pilote, H = E?.habitacle || R?.habitacle, presents = new Set(S.sortie);
  const variantes = (R?.variantes || []).map((r, indice) => ({ indice, niveau: r.niveau, pieces: r.pieces.filter(x => presents.has(x.objet)) })).filter(r => r.pieces.length);
  const pieces = variantes.flatMap(r => r.pieces).concat((R?.cockpit?.pieces || []).filter(x => presents.has(x.objet)));
  const visible = source => !!source && (presents.has(source.objet) || pieces.some(p => p.source === source));
  const objet = o => ({ shape: o.shape, p: Array.from(o.p), s: Array.from(o.s), r: Array.from(o.r), overlay: !!o.overlay });
  const choisies = pieces.filter(p => /^(volant|branches|levier|pommeau|planche|casquette|bras-[01]|avant-bras-[01]|coude-[01]|console-levier|support-volant-\d+|retro-(?:boitier|patte|glace)-[01])$/.test(p.role))
    .map(p => ({ role: p.role, ...objet(p.objet) }));
  const corps = [...new Set((E?.tables || []).flatMap(t => (t?.objets || []).filter(o => presents.has(o))))];
  const formes = Object.fromEntries(['goutte', 'goutte-dedans', 'jonc', 'bulle-pilote', 'cuve', 'pilote-buste', 'pilote-casque', 'pilote-visiere'].map(nom =>
    [nom, corps.filter(o => o.shape === B.voiture.FORMES[nom]?.nom).map(objet)]));
  const cam = S.camera, cible = F.cameraPrescrite?.cible || [p.x, p.y + .65, p.z], direction = cible.map((q, k) => q - cam.pos[k]), distance = Math.hypot(...direction);
  const hit = S.course.physique.world.raycast(cam.pos, direction.map(x => x / distance), Math.max(0, distance - .15), { mask: 3, staticOnly: true });
  const gpu = J.rendu.gpu;
  return { type: S.type, ecran: J.ecran, vue: S.vue, vue2: S.vueJ2?.vue || null, instant: F.instant || null, cameraImposee: J.camera !== null,
    reglagesHud: { carte: J.reglages.carte, cartePosition: J.reglages.cartePosition,
      carteTaille: J.reglages.carteTaille, tableau: J.reglages.tableau, annoncesVirages: J.reglages.annoncesVirages },
    rivalDistance: F.scenario.rival ? S.course.voitures[F.sujet === 0 ? 1 : 0].etat.s - v.etat.s : null,
    camera: { pos: [...cam.pos], yaw: cam.yaw, pitch: cam.pitch, roll: cam.roll || 0, fov: cam.fov, near: cam.near },
    cameraPrescrite: F.cameraPrescrite, distanceLOD: F.distanceLOD, obstructionStatique: !!hit.hit,
    gpuErreur: (J.rendu.stats.errorEvents[0] || null), gpuPerdu: J.rendu.stats.deviceLost, temps: S.tRendu, pose: { ...p }, oeilVoiture: [...B.voiture.OEIL],
    volant: v.etat.volant, rapport: v.etat.rapport, rapportAvant: v.rapportAvant,
    passage: Math.max(0, Math.min(1, (S.tRendu - v.tPassage) / .36)),
    expression: S.expressions ? { ...B.expressionsPilote.lire(S.expressions, F.sujet) } : null,
    variantes: variantes.map(r => ({ indice: r.indice, niveau: r.niveau, pieces: r.pieces.length })), pieces: choisies, formes,
    articulations: H?.articulations ? Array.from(H.articulations) : null,
    instruments: { plancheAttendue: (H?.planche || []).filter(p => p.visible !== false).length,
      plancheRendue: (H?.planche || []).filter(visible).length, aiguillesRendues: (H?.aiguilles || []).filter(visible).length,
      supportsRendus: (H?.supportVolant || []).filter(visible).length,
      retrosRendus: (H?.glaces || []).filter(g => visible(g.boitier) && visible(g.patte) && (visible(g.vive) || visible(g.verre))).length } };
}

export function verifierHabitacle(r, s, candidat = true) {
  const fautes = [];
  const cameraValide = c => Array.isArray(c?.pos) && c.pos.length === 3 && c.pos.every(Number.isFinite) && [c.yaw, c.pitch, c.fov].every(Number.isFinite);
  const hudValide = (q, joueur) => {
    const h = q?.hud, racine = joueur === 2 ? 'hud2' : 'hud';
    if (h?.observe !== true || h.joueur !== joueur || h.racine !== racine || !Array.isArray(h.rectangles) || !h.rectangles.length ||
      h.rectangles.some(r => !r || typeof r.id !== 'string' || !r.id.startsWith(racine + ':') ||
        ![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0)) return false;
    const ids = new Set(h.rectangles.map(r => r.id)), roles = ['volant', 'gant-0', 'gant-1'];
    if (ids.size !== h.rectangles.length) return false;
    const recouvrementValide = (aire, parties) => Number.isFinite(aire) && aire >= 0 && Array.isArray(parties) &&
      parties.every(p => p && ids.has(p.id) && Number.isFinite(p.airePx2) && p.airePx2 > 0) &&
      parties.reduce((s, p) => s + p.airePx2, 0) === aire;
    return Array.isArray(h.commandes) && h.commandes.length === roles.length && new Set(h.commandes.map(c => c?.role)).size === roles.length &&
      h.commandes.every(c => roles.includes(c?.role) && recouvrementValide(c.recouvrementPx2, c.recouvrements)) &&
      Array.isArray(q.glaces) && q.glaces.length === 2 && q.glaces.every(g => g?.valide === true && recouvrementValide(g.hudRecouvrementPx2, g.hudRecouvrements)) &&
      Array.isArray(q.route?.points) && q.route.points.length === 20 && q.route.points.every(p => Array.isArray(p?.hud) && p.hud.every(id => ids.has(id))) &&
      Array.isArray(q.erreurs) && !q.erreurs.some(e => /^(Données HUD|Rectangle HUD)/.test(e));
  };
  if (r.fatal) fautes.push(r.fatal.split('\n')[0]);
  for (const e of r.erreurs || []) fautes.push('Erreur page : ' + e);
  for (const e of r.avertissements || []) if (/GL_INVALID|shader.*(error|failed)|GLSL|context lost/i.test(e)) fautes.push('Erreur graphique : ' + e);
  if (!/^[a-f0-9]{64}$/.test(r.build?.sha256 || '') || !/^[a-f0-9]{40}$/.test(r.source?.commit || '')) fautes.push('Identité du build ou des outils absente');
  if (r.environnement?.webgpu !== true || r.environnement?.physx?.ready !== true) fautes.push('WebGPU ou PhysX réel absent');
  if (r.initialisation?.entree !== 'BITUME_JEU.reference' || r.initialisation.posesPrescrites !== true) fautes.push('Séance de référence absente');
  if (s.qualification && s.cockpit && r.initialisation?.observation?.methode !== 'copie passive des triangles opaques transmis au draw original') fautes.push('Observation du vrai draw absente');
  if (r.images?.length !== s.images) fautes.push('Nombre de captures incomplet');
  if (s.taille && s.taille.split(',').some((n, i) => r.environnement.resolution?.[i] !== Number(n))) fautes.push('Résolution demandée non exercée');
  for (const [i, im] of (r.images || []).entries()) {
    const o = im.observation;
    if (!o) { fautes.push('Observation absente'); continue; }
    if (o.type !== (s.duo ? 'duo' : 'course') || o.ecran !== 'course' || o.vue !== (s.cockpit ? 'cockpit' : 'poursuite') || s.duo && o.vue2 !== 'cockpit') fautes.push('Vue réelle différente de la demande');
    if (o.cameraImposee !== !s.cockpit) fautes.push('Caméra de siège remplacée ou caméra d’inspection absente');
    if (s.cartePosition && (o.reglagesHud?.carte !== 'oui' || o.reglagesHud.cartePosition !== s.cartePosition ||
      o.reglagesHud.carteTaille !== s.carteTaille || o.reglagesHud.tableau !== s.tableau)) fautes.push('Préférences HUD prescrites non exercées');
    if (s.rival && (!Number.isFinite(o.rivalDistance) || Math.abs(o.rivalDistance - s.rival) > 1e-9)) fautes.push('Rival natif à distance prescrite absent');
    if (!cameraValide(o.camera)) fautes.push('Caméra finale invalide');
    if (!s.cockpit && (!cameraValide(o.camera) || !cameraValide(o.cameraPrescrite) || ['yaw', 'pitch', 'fov'].some(k => Math.abs(o.camera[k] - o.cameraPrescrite[k]) > 1e-9) ||
      o.camera.pos.some((x, k) => Math.abs(x - o.cameraPrescrite.pos[k]) > 1e-9))) fautes.push('Caméra finale différente de l’inspection');
    if (o.gpuErreur || o.gpuPerdu) fautes.push('Erreur WebGPU');
    if (o.obstructionStatique !== false) fautes.push('Visée masquée par le décor');
    if (!im.etat?.zones?.scene || im.vues?.scene?.noir > .97 && im.vues.scene.luminance < .025) fautes.push('Scène absente ou noire');
    const volantVitesse = s.volantVitesse ?? .65;
    if (o.volant !== (s.qualification && s.cockpit ? i ? volantVitesse : 0 : s.volant || 0)) fautes.push('Braquage non exercé');
    if (s.qualification && s.cockpit) {
      // Les anciens rapports restent relisibles grâce aux témoins DOM ci-dessous. Dès que
      // le réglage est tracé, initialisation et observation doivent toutes deux attester Écran.
      if ((r.initialisation?.reglagesHud?.annoncesVirages !== undefined || o.reglagesHud?.annoncesVirages !== undefined) &&
        (r.initialisation?.reglagesHud?.annoncesVirages !== 'ecran' || o.reglagesHud?.annoncesVirages !== 'ecran'))
        fautes.push('Annonce de virage : réglage Écran prescrit non exercé');
      if (s.chauffeInstant === 120) {
        const chauffe = (r.phasesHabitacle || []).filter(e => e.image === i && /^chauffe-/.test(e.phase));
        if (chauffe.length !== 120 || chauffe.some((e, n) => e.phase !== `chauffe-${n + 1}/120` || e.etat !== 'terminee' ||
          !Number.isFinite(e.horloge?.temps) || !(e.horloge?.callbacks > 0) || n && Math.abs(e.horloge.temps - chauffe[n - 1].horloge?.temps - 1000 / 60) > 1e-6))
          fautes.push('Stabilisation cockpit incomplète : 120 pas de 1/60 s requis, image ' + i);
      }
      const vues = o.lisibilite || [];
      if (o.instant !== (i ? 'vitesse-braquage' : 'neutre') || vues.length !== (s.duo ? 2 : 1) || new Set(vues.map(v => v.joueur)).size !== vues.length) fautes.push('Observation des deux états/joueurs incomplète');
      for (let j = 0; j < (s.duo ? 2 : 1); j++) {
        const q = vues.find(q => q.joueur === j + 1);
        if (!q || q.vitesse !== (i ? 80 : 0) || q.volant !== (i ? j ? -volantVitesse : volantVitesse : 0)) fautes.push('Vitesse/braquage J' + (j + 1) + ' non exercé');
        if (!q?.route || !q?.glaces || !Array.isArray(q?.erreurs)) fautes.push('Mesure réelle de chaussée/glaces absente');
        // Une référence peut échouer à la lisibilité, mais jamais à la collecte des preuves.
        if (!hudValide(q, j + 1)) fautes.push('Données HUD absentes ou invalides : J' + (j + 1));
        // Ces témoins sont déjà dans les rapports : aucun nouveau champ ni nouvelle capture requis.
        // La carte est demandée par preparerHabitacle ; à s=280 (J2=200), l'annonce du virage à
        // s=344 doit être visible à 80 m/s et masquée à l'arrêt. Leur disparition ne doit pas
        // faire réussir artificiellement les contrôles de recouvrement.
        const racine = j ? 'hud2' : 'hud', rectangles = Array.isArray(q?.hud?.rectangles) ? q.hud.rectangles : [];
        // Recalcul depuis les boîtes reçues : des erreurs omises dans un ancien JSON ne valent pas validation.
        if (candidat) for (const erreur of mesurerSuperpositionsHud(rectangles, SEUILS_COCKPIT).erreurs) fautes.push('J' + (j + 1) + ' : ' + erreur);
        const temoins = id => rectangles.filter(h => typeof h?.id === 'string' && h.id.startsWith(racine + ':' + id + ':'));
        const cartes = temoins('carte'), annonces = temoins('h-virage'), v = q?.viewport;
        const dansViewport = h => h && v && [v.x, v.y, v.width, v.height, h.x, h.y, h.width, h.height].every(Number.isFinite)
          && v.width > 0 && v.height > 0 && h.width > 0 && h.height > 0
          && h.x >= v.x - 1e-7 && h.y >= v.y - 1e-7
          && h.x + h.width <= v.x + v.width + 1e-7 && h.y + h.height <= v.y + v.height + 1e-7;
        if (o.reglagesHud?.carte !== 'oui' || cartes.length !== 1 || !dansViewport(cartes[0]))
          fautes.push('Carte demandée absente du HUD visible : J' + (j + 1) + ', image ' + i);
        if (i ? annonces.length !== 1 || !dansViewport(annonces[0]) : annonces.length !== 0)
          fautes.push('Annonce de virage ' + (i ? 'absente en vitesse-braquage' : 'visible au neutre') + ' : J' + (j + 1));
        // Le badge recouvrait un poignet en virage maintenu : le cacher ne doit pas valider le correctif.
        if (s.chauffeInstant === 120) {
          const fps = temoins('h-fps');
          if (fps.length !== 1 || !dansViewport(fps[0]))
            fautes.push('Compteur FPS absent du HUD visible : J' + (j + 1) + ', image ' + i);
        }
        // Le tableau complet est un choix de l'essai : retirer ses compteurs ne doit pas
        // faire disparaître artificiellement leur recouvrement du volant ou des mains.
        if (s.tableau === 'complet') {
          if (o.reglagesHud?.tableau !== 'complet') fautes.push('Tableau complet prescrit non exercé : J' + (j + 1));
          for (const id of ['vitesse', 'h-regime']) {
            const compteurs = temoins(id);
            if (compteurs.length !== 1 || !dansViewport(compteurs[0]))
              fautes.push('Compteur du tableau complet absent du HUD visible : ' + id + ', J' + (j + 1) + ', image ' + i);
          }
        }
        if (o.reglagesHud?.tableau === 'reduit') for (const id of ['vitesse', 'h-regime']) {
          if (temoins(id).length) fautes.push('Compteur supplémentaire visible malgré la planche seule : ' + id + ', J' + (j + 1) + ', image ' + i);
        }
        if (s.cartePosition && cartes.length === 1 && dansViewport(cartes[0])) {
          const carte = cartes[0], milieu = v.x + v.width / 2;
          if (s.cartePosition === 'gauche' ? carte.x + carte.width > milieu + 1e-7 : carte.x < milieu - 1e-7)
            fautes.push('Carte visible du mauvais côté : J' + (j + 1) + ', image ' + i);
        }
        if (!candidat && s.id === 'cockpit-paysage' && !(Array.isArray(q?.glaces) && Array.isArray(q?.erreurs) &&
          q.glaces.some(g => Number.isFinite(g?.hudRecouvrementPx2) && g.hudRecouvrementPx2 > SEUILS_COCKPIT.recouvrementMaxPx2 &&
            q.erreurs.includes('HUD superposé à la glace : ' + g.id))))
          fautes.push('Le masque HUD connu de la référence n’a pas été détecté : image ' + i);
        if (candidat) for (const erreur of q?.erreurs || []) fautes.push('J' + (j + 1) + ' : ' + erreur);
      }
    }
    if (s.passage && !(o.rapport === 3 && o.rapportAvant === 2 && o.passage > .4 && o.passage < .65)) fautes.push('Passage 2→3 non exercé');
    if (s.geste && !(o.expression?.geste === s.geste && o.expression.gesteIntensite > .9)) fautes.push('Geste défavorable non exercé');
    if (s.lod && (o.variantes?.length !== 1 || o.variantes[0].niveau !== (s.lod === 'moyen' ? 1 : 2))) fautes.push('LOD réel différent de l’échantillon');
    if (!candidat) continue;
    if (!Array.isArray(o.articulations) || o.articulations.length !== 18 || !o.articulations.every(Number.isFinite)) fautes.push('Articulations réelles absentes');
    if (!s.lod && (o.instruments?.plancheRendue !== o.instruments?.plancheAttendue || !(o.instruments?.plancheRendue > 10) || o.instruments?.aiguillesRendues !== 3 ||
      !(o.instruments?.supportsRendus > 0) || o.instruments?.retrosRendus !== 2)) fautes.push('Commandes ou instruments réellement rendus incomplets');
    if (s.cockpit) {
      for (const id of ['glace-g', 'glace-d', ...(s.duo ? ['glace-g2', 'glace-d2'] : [])]) if (!im.etat?.zones?.[id]) fautes.push('Image du rétroviseur absente : ' + id);
      if (s.duo && (!im.etat?.zones?.scene2 || im.vues?.scene2?.noir > .97 && im.vues.scene2.luminance < .025)) fautes.push('Scène J2 absente ou noire');
      if (o.formes?.['pilote-casque']?.length || o.formes?.['pilote-visiere']?.length) fautes.push('Propre tête présente dans la vue du siège');
    }
  }
  return [...new Set(fautes)];
}

export async function campagneHabitacle(o) {
  mkdirSync(o.sortie, { recursive: true });
  const r = { format: 'bitume-captures-habitacle-v2', date: new Date().toISOString(), demandes: [...o.cas], seuilsCockpit: SEUILS_COCKPIT, passages: [], echecs: 0,
    limites: ['Poses prescrites : aucun essai de conduite ni de performance matérielle.',
      'Les caméras extérieures sont des inspections via l’API du jeu ; les vues cockpit gardent sa vraie caméra.',
      'Les LOD sont sélectionnés par distance sans forcer le modèle ; leurs petits pixels ne prouvent pas le dégagement des bras.',
      'La lisibilité ciblée mesure vingt rayons vers le vrai sol à 12/20/35/55 m, les triangles opaques de la voiture, les quadrilatères DOM des glaces et les masques visibles du HUD ; elle ne couvre pas tout le circuit.',
      'La présence de pièces et les images ne prouvent ni absence d’intersection ni identité des sommets : contrôles géométriques séparés requis.',
      'Revue visuelle des PNG encore requise ; deux images ne constituent pas une qualification temporelle complète.'] };
  const variantes = o['reference-seule'] === 'oui' ? [['avant', o.url]] : [...(o.avant ? [['avant', o.avant]] : []), ['apres', o.url]];
  for (const [variante, url] of variantes) for (const id of o.cas) {
    const s = TOUS_SCENARIOS.find(s => s.id === id), dossier = path.join(variante, id), sortie = path.join(o.sortie, dossier);
    const p = optionsScenarioHabitacle(s, url, sortie, o);
    p.initialiser = ({ evaluer, rapport }) => {
      rapport.scenarioHabitacle = s.id;
      return etapeHabitacle(evaluer, rapport, 'initialisation', `(() => { const r = (${preparerHabitacle.toString()})(${JSON.stringify(s)});
        ${s.qualification && s.cockpit ? `r.observation = (${installerObservationCockpit.toString()})();` : ''} return r; })()`);
    };
    p.observer = ({ evaluer, rapport, i }) => {
      const attente = rapport.phasesHabitacle?.find(e => e.image === i && e.phase === 'frame-et-PNG');
      if (attente) attente.etat = 'recus';
      return etapeHabitacle(evaluer, rapport, 'observation', `(() => { const r = (${observerHabitacle.toString()})();
        ${s.qualification && s.cockpit ? `r.lisibilite = (${observerLisibiliteCockpit.toString()})(${mesurerLisibiliteCockpit.toString()},${JSON.stringify(SEUILS_COCKPIT)},${mesurerSuperpositionsHud.toString()});` : ''} return r; })()`, i);
    };
    if (s.qualification && s.cockpit) p.avantImage = a => chaufferInstantCockpit(a, s);
    if (variante === 'apres' && o.avant) p.reference = path.join(o.sortie, 'avant', id, 'rapport.json');
    const resultat = await capturer(p), erreurs = verifierHabitacle(resultat, s, variante === 'apres');
    const constatsLisibilite = (resultat.images || []).flatMap(im => (im.observation?.lisibilite || []).flatMap(v => v.erreurs || []));
    if (variante === 'avant' && id === 'cockpit-mac' && !constatsLisibilite.some(e => /Chaussée utile occultée|Glace superposée|Glace trop large/.test(e))) erreurs.push('Le défaut connu du cockpit de référence n’a pas été détecté');
    const sha = createHash('sha256').update(readFileSync(fileURLToPath(url))).digest('hex');
    if (sha !== resultat.build?.sha256) erreurs.push('Le HTML a changé pendant la capture');
    const empreintes = resultat.images.map(im => { const png = readFileSync(path.join(sortie, im.fichier));
      return { fichier: im.fichier, octets: png.length, sha256: createHash('sha256').update(png).digest('hex') }; });
    r.passages.push({ variante, scenario: id, dossier, images: resultat.images.length, build: resultat.build, source: resultat.source, empreintes, constatsLisibilite,
      phasesHabitacle: resultat.phasesHabitacle || [], erreurs });
    r.echecs += erreurs.length ? 1 : 0;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(r, null, 2) + '\n');
    process.stderr.write(`${variante}/${id} : ${resultat.images.length} images, ${erreurs.length} erreurs\n`);
    if (resultat.fatal && !resultat.images.length) return r;
  }
  return r;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagneHabitacle(optionsHabitacle(process.argv.slice(2))); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.echecs ? 1 : 0; }
  catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
