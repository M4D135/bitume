#!/usr/bin/env node
// Quatre saisons du même décor et de la même caméra finale. Aucun rendu ni module substitué.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from './controle-visuel.mjs';

import { catalogueJeu } from './qualification/circuit-catalogue.mjs';

const DEPARTS = { 'val-brule': 1100, marseille: 1450, corail: 1450, 'cap-sequoia': 1500,
  fjord: 1800, 'route-des-cimes': 1400, larche: 4750, 'lande-noire': 1700, sierra: 1900, 'brume-de-jade': 2000, baikal: 2000 };
export const CIRCUITS_SAISONS = Object.freeze(catalogueJeu.map(({ id }, circuit) => Object.freeze({ id, depart: DEPARTS[id], circuit })));
export const SAISONS = Object.freeze(['printemps', 'ete', 'automne', 'hiver']);
export function optionsSaisons(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'sortie', 'chrome', 'circuits', 'saisons', 'qualite', 'taille', 'alpin'].includes(k)
      || o[k] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Option inconnue ou incomplète : ' + argv[i]);
    o[k] = argv[i + 1];
  }
  if (!o.url || !o.sortie || new URL(o.url).protocol !== 'file:') throw new Error('--url file: et --sortie nécessaires');
  o.circuits = o.circuits ? o.circuits.split(',').map(Number) : CIRCUITS_SAISONS.map(s => s.circuit);
  o.saisons = o.saisons ? o.saisons.split(',') : [...SAISONS];
  if (!o.circuits.length || new Set(o.circuits).size !== o.circuits.length || o.circuits.some(i => !Number.isInteger(i) || !CIRCUITS_SAISONS[i])) throw new Error('Circuit inconnu ou dupliqué');
  if (!o.saisons.length || new Set(o.saisons).size !== o.saisons.length || o.saisons.some(s => !SAISONS.includes(s))) throw new Error('Saison inconnue ou dupliquée');
  o.qualite ||= 'high'; o.taille ||= '960,540'; o.alpin ||= 'oui';
  if (!['oui', 'non'].includes(o.alpin)) throw new Error('--alpin oui|non');
  optionsScenarioSaisons({ ...CIRCUITS_SAISONS[o.circuits[0]], saison: o.saisons[0] }, o, o.sortie);
  return o;
}
export function scenariosSaisons(o) {
  const scenes = o.circuits.flatMap(i => o.saisons.map(saison => ({ ...CIRCUITS_SAISONS[i], saison, alpin: false })));
  const cimes = CIRCUITS_SAISONS.find(s => s.id === 'route-des-cimes');
  if (o.alpin === 'oui' && o.circuits.includes(cimes.circuit)) for (const saison of ['ete', 'hiver']) if (o.saisons.includes(saison))
    scenes.push({ ...cimes, depart: 4750, saison, alpin: true });
  return scenes.map(s => ({ ...s, nom: s.id + (s.alpin ? '-alpin' : '') + '-' + s.saison }));
}
export function optionsScenarioSaisons(s, o, sortie) {
  const args = ['--url', o.url, '--sortie', sortie, '--scenario', 'piste', '--circuit', String(s.circuit),
    '--saison', s.saison, '--meteo', 'sec', '--moment', 'jour', '--qualite', o.qualite,
    '--taille', o.taille, '--depart', String(s.depart), '--vitesse', '0', '--vue', 'poursuite', '--retro', 'non',
    '--images', '2', '--chauffe', '4', '--pas', '.1', '--attendre', '120000'];
  if (o.chrome) args.push('--chrome', o.chrome);
  return optionsCapture(args);
}

// Contrôle de cadrage, pas de collision ajoutée au jeu. Les enveloppes viennent des seuls
// troncs permanents : le choix reste identique quand les couronnes changent ou disparaissent.
export function foretLibreSaisons(arbres, sujet, position, libre) {
  const h = sujet.s[1] / .84, sol = sujet.p[1] - sujet.s[1] / 2;
  const dx = sujet.p[0] - position[0], dz = sujet.p[2] - position[2], distance = Math.hypot(dx, dz);
  if (!(distance > 0 && h > 0)) return false;
  const points = [];
  // Neuf rayons couvrent le bas, le milieu et le haut de la silhouette, pas seulement la cime.
  for (const cote of [-.3, 0, .3]) for (const hauteur of [.25, .6, .95])
    points.push([sujet.p[0] - dz / distance * h * cote, sol + h * hauteur, sujet.p[2] + dx / distance * h * cote]);
  for (const arbre of arbres) {
    if (arbre === sujet) continue;
    const hauteur = arbre.s[1] / .84, rayon = hauteur * .53, vertical = hauteur * .70;
    const centreY = arbre.p[1] - arbre.s[1] / 2 + hauteur * .58;
    const origine = [(position[0] - arbre.p[0]) / rayon, (position[1] - centreY) / vertical, (position[2] - arbre.p[2]) / rayon];
    for (const point of points) {
      const direction = [(point[0] - position[0]) / rayon, (point[1] - position[1]) / vertical, (point[2] - position[2]) / rayon];
      const longueur2 = direction.reduce((n, v) => n + v * v, 0);
      const t = Math.max(0, Math.min(1, -origine.reduce((n, v, k) => n + v * direction[k], 0) / longueur2));
      if (origine.reduce((n, v, k) => n + (v + t * direction[k]) ** 2, 0) <= 1) return false;
    }
  }
  return !libre || points.every(point => libre(position, point));
}

export function preparerSaisons(s) {
  const J = BITUME_JEU, B = BITUME, S = J.session, c = S.course.c, d = J.scene.decor;
  if (J.CATALOGUE[s.circuit]?.id !== s.id || d.saison.id !== s.saison || !S.reference) throw new Error('Circuit/saison de référence différents');
  J.pauseAuto = false; J.reglages.secousses = 0; S.acc = -1;
  const q = B.circuit.echantillon(c, s.depart), objets = (d.lotsHerbier || d.lots).flatMap(l => l.objets);
  const arbres = objets.filter(o => o.collision === 'tronc' && o.essenceArbre);
  const caducs = arbres.filter(o => o.essenceArbre === 'feuillu');
  const inspectionForet = s.id === 'route-des-cimes' && !s.alpin;
  const candidats = s.alpin ? [] : inspectionForet || caducs.length ? caducs : arbres;
  candidats.sort((a, b) => Math.hypot(a.p[0] - q.x, a.p[2] - q.z) - Math.hypot(b.p[0] - q.x, b.p[2] - q.z));
  let camera = null, cible = null, arbre = null, sujetForet = null;
  const world = S.course.physique.world;
  const libre = (p, cible) => {
    const delta = cible.map((v, k) => v - p[k]), longueur = Math.hypot(...delta);
    return !world.raycast(p, delta.map(v => v / longueur), Math.max(0, longueur - .6), { mask: 3, staticOnly: true }).hit;
  };
  for (const a of candidats.slice(0, inspectionForet ? 40 : 12)) {
    const h = a.s[1] / .84, sol = a.p[1] - a.s[1] / 2, vise = [a.p[0], sol + h * (inspectionForet ? .6 : .94), a.p[2]];
    const angle = Math.atan2(q.z - a.p[2], q.x - a.p[0]), angles = inspectionForet ? 24 : 12;
    rechercheArbre: for (const recul of (inspectionForet ? [1.9, 2.4] : [1.6])) for (let k = 0; k < angles; k++) {
      const distance = Math.max(inspectionForet ? 18 : 15, h * recul);
      const theta = angle + (inspectionForet ? k * Math.PI / 12 : k * Math.PI / 6), x = a.p[0] + Math.cos(theta) * distance, z = a.p[2] + Math.sin(theta) * distance;
      const pos = [x, Math.max(d.sol(x, z) + 3.5, sol + h * (inspectionForet ? .48 : .38)), z];
      if (inspectionForet ? !foretLibreSaisons(arbres, a, pos, libre) : !libre(pos, vise)) continue;
      camera = B.cinema.viser(pos, vise, 54); cible = vise;
      arbre = { essence: a.essenceArbre, p: [...a.p], s: [...a.s] };
      if (inspectionForet) sujetForet = a;
      break rechercheArbre;
    }
    if (camera) break;
  }
  if (inspectionForet && !camera) throw new Error('Aucun caduc dégagé pour inspecter les saisons de Route-des-Cimes');
  if (!camera) {
    // Biomes sans arbres et échantillon alpin : vraie route et vrai terrain, même visée aux quatre saisons.
    recherche: for (const avance of [100, 65, 35]) for (const h of [3.5, 7, 12]) {
      const p = B.circuit.echantillon(c, s.depart + avance), pos = [q.x, q.y + h, q.z], vise = [p.x, p.y + 2, p.z];
      if (!libre(pos, vise)) continue;
      camera = B.cinema.viser(pos, vise, 62); cible = vise; break recherche;
    }
  }
  if (!camera) throw new Error('Aucune visée d’inspection dégagée');
  J.camera = () => camera;
  globalThis.__SAISONS_CAPTURE = { scenario: s, camera, cible, arbre,
    verifierForet: sujetForet ? pos => foretLibreSaisons(arbres, sujetForet, pos, libre) : null };
  return { entree: 'BITUME_JEU.reference', modeleReel: true, arbre, camera, cible,
    controleForet: sujetForet ? 'enveloppes-troncs-9-rayons' : null,
    description: 'Même terrain/arbres réels et caméra finale entre saisons ; pas de simulation de conduite ni de mesure FPS.' };
}
export function observerSaisonsCapture() {
  const J = BITUME_JEU, S = J.session, d = J.scene.decor, F = __SAISONS_CAPTURE, cam = S.camera;
  const objets = (d.lotsHerbier || d.lots).flatMap(l => l.objets), troncs = objets.filter(o => o.collision === 'tronc' && o.essenceArbre);
  const delta = F.cible.map((v, k) => v - cam.pos[k]), distance = Math.hypot(...delta), gl = J.rendu.gl;
  return { saison: d.saison.id, circuit: J.CATALOGUE[F.scenario.circuit].id, vue: S.vue,
    camera: { pos: [...cam.pos], yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov }, cameraPrescrite: F.camera, arbre: F.arbre,
    foretLibre: F.verifierForet ? F.verifierForet(cam.pos) : null,
    obstruction: !!S.course.physique.world.raycast(cam.pos, delta.map(v => v / distance), Math.max(0, distance - .6), { mask: 3, staticOnly: true }).hit,
    glErreur: gl.getError(), glPerdu: gl.isContextLost(), arbres: troncs.length,
    caducs: troncs.filter(o => o.essenceArbre === 'feuillu').length, sourcesFeuilles: d.sourcesFeuilles.length,
    branchesNues: objets.filter(o => o.partieArbre === 'branches').length,
    couronnesCaduques: objets.filter(o => o.partieArbre === 'feuillage' && o.essenceArbre === 'feuillu').length,
    temoins: objets.filter(o => o.essenceArbre && o.partieArbre !== 'tronc').slice(0, 12).map(o => ({ essence: o.essenceArbre, partie: o.partieArbre, shape: o.shape, color: [...o.color] })) };
}
export function verifierSaisons(r, s) {
  const erreurs = [];
  if (r.fatal) erreurs.push(r.fatal.split('\n')[0]);
  if (r.erreurs?.length) erreurs.push(...r.erreurs);
  if (!/^[a-f0-9]{64}$/.test(r.build?.sha256 || '') || !/^[a-f0-9]{40}$/.test(r.source?.commit || '')) erreurs.push('Provenance absente');
  if (r.environnement?.webgl2 !== true || r.environnement?.physx?.ready !== true) erreurs.push('Renderer ou PhysX réel absent');
  if (r.initialisation?.modeleReel !== true || r.images?.length !== 2) erreurs.push('Référence ou images incomplètes');
  const inspectionForet = s.id === 'route-des-cimes' && !s.alpin;
  if (inspectionForet && (r.initialisation?.controleForet !== 'enveloppes-troncs-9-rayons' || r.initialisation?.arbre?.essence !== 'feuillu'))
    erreurs.push('Cadrage du caduc de Route-des-Cimes non exercé');
  for (const image of r.images || []) {
    const o = image.observation;
    if (!o || o.saison !== s.saison || o.circuit !== s.id || o.vue !== 'poursuite') { erreurs.push('Observation de saison/circuit absente'); continue; }
    if (o.glErreur || o.glPerdu || o.obstruction !== false) erreurs.push('Erreur graphique ou caméra masquée');
    if (inspectionForet && o.foretLibre !== true) erreurs.push('Silhouette masquée par un houppier ou un solide');
    const a = o.camera, b = o.cameraPrescrite;
    if (!a?.pos?.every(Number.isFinite) || !b?.pos || a.pos.some((v, k) => Math.abs(v - b.pos[k]) > 1e-8) || ['yaw', 'pitch', 'fov'].some(k => !Number.isFinite(a[k]) || Math.abs(a[k] - b[k]) > 1e-8)) erreurs.push('Caméra finale différente');
    if (s.saison === 'hiver' && (o.couronnesCaduques !== 0 || o.branchesNues !== o.caducs)) erreurs.push('Feuillus hivernaux non exercés');
    if (o.sourcesFeuilles !== (s.saison === 'automne' ? o.caducs : 0)) erreurs.push('Chute des seules feuilles caduques non exercée');
  }
  return [...new Set(erreurs)];
}
export async function campagneSaisons(o) {
  mkdirSync(o.sortie, { recursive: true });
  const r = { format: 'bitume-captures-saisons-v1', passages: [], echecs: 0,
    limites: ['Images d’inspection du vrai jeu, à relire visuellement ; les comptes et images ne prouvent pas les performances matérielles.',
      'Deux images par saison, mêmes positions et caméra ; ciel de jour et météo sèche pour comparer les palettes.',
      'La comparaison physique/géométrique et les budgets appartiennent au contrôle Node des circuits du menu.'] };
  const cameras = new Map();
  for (const s of scenariosSaisons(o)) {
    const sortie = path.join(o.sortie, s.nom), p = optionsScenarioSaisons(s, o, sortie);
    p.initialiser = ({ evaluer }) => evaluer(`(() => { const foretLibreSaisons = ${foretLibreSaisons.toString()}; return (${preparerSaisons.toString()})(${JSON.stringify(s)}); })()`);
    p.observer = ({ evaluer }) => evaluer(`(${observerSaisonsCapture.toString()})()`);
    const resultat = await capturer(p), erreurs = verifierSaisons(resultat, s), cle = s.id + ':' + s.alpin;
    const camera = JSON.stringify(resultat.initialisation?.camera);
    if (cameras.has(cle) && camera !== cameras.get(cle)) erreurs.push('Caméra non identique entre saisons');
    else cameras.set(cle, camera);
    const sha = createHash('sha256').update(readFileSync(fileURLToPath(o.url))).digest('hex');
    if (sha !== resultat.build?.sha256) erreurs.push('HTML changé pendant la capture');
    const empreintes = resultat.images.map(im => ({ fichier: im.fichier,
      sha256: createHash('sha256').update(readFileSync(path.join(sortie, im.fichier))).digest('hex') }));
    r.passages.push({ scenario: s.nom, dossier: s.nom, build: resultat.build, source: resultat.source, empreintes, erreurs });
    r.echecs += erreurs.length ? 1 : 0;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(r, null, 2) + '\n');
    process.stderr.write(s.nom + ' : ' + erreurs.length + ' erreurs\n');
    if (resultat.fatal && !resultat.images.length) break;
  }
  return r;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagneSaisons(optionsSaisons(process.argv.slice(2))); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.echecs ? 1 : 0; }
  catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
