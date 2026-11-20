#!/usr/bin/env node
// Quatre saisons du même décor et de la même caméra finale. Aucun rendu ni module substitué.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from './controle-visuel.mjs';

export const CIRCUITS_SAISONS = Object.freeze([
  ['val-brule', 1100], ['port-sable', 1450], ['haut-col', 1800], ['lande-noire', 1700],
  ['roche-fauve', 1900], ['brume-de-jade', 2000], ['cap-sequoia', 1500], ['baikal', 2000], ['route-des-cimes', 1400]
].map(([id, depart], circuit) => Object.freeze({ id, depart, circuit })));
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
  if (o.alpin === 'oui' && o.circuits.includes(8)) for (const saison of ['ete', 'hiver']) if (o.saisons.includes(saison))
    scenes.push({ ...CIRCUITS_SAISONS[8], depart: 4750, saison, alpin: true });
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

export function preparerSaisons(s) {
  const J = BITUME_JEU, B = BITUME, S = J.session, c = S.course.c, d = J.scene.decor;
  if (J.CATALOGUE[s.circuit]?.id !== s.id || d.saison.id !== s.saison || !S.reference) throw new Error('Circuit/saison de référence différents');
  J.pauseAuto = false; J.reglages.secousses = 0; S.acc = -1;
  const q = B.circuit.echantillon(c, s.depart), objets = (d.lotsHerbier || d.lots).flatMap(l => l.objets);
  const arbres = objets.filter(o => o.collision === 'tronc' && o.essenceArbre);
  const caducs = arbres.filter(o => o.essenceArbre === 'feuillu');
  const candidats = s.alpin ? [] : caducs.length ? caducs : arbres;
  candidats.sort((a, b) => Math.hypot(a.p[0] - q.x, a.p[2] - q.z) - Math.hypot(b.p[0] - q.x, b.p[2] - q.z));
  let camera = null, cible = null, arbre = null;
  const world = S.course.physique.world;
  const libre = (p, cible) => {
    const delta = cible.map((v, k) => v - p[k]), longueur = Math.hypot(...delta);
    return !world.raycast(p, delta.map(v => v / longueur), Math.max(0, longueur - .6), { mask: 3, staticOnly: true }).hit;
  };
  for (const a of candidats.slice(0, 12)) {
    const h = a.s[1] / .84, sol = a.p[1] - a.s[1] / 2, vise = [a.p[0], sol + h * .94, a.p[2]];
    const angle = Math.atan2(q.z - a.p[2], q.x - a.p[0]), distance = Math.max(15, h * 1.6);
    for (let k = 0; k < 12; k++) {
      const theta = angle + k * Math.PI / 6, x = a.p[0] + Math.cos(theta) * distance, z = a.p[2] + Math.sin(theta) * distance;
      const pos = [x, Math.max(d.sol(x, z) + 3.5, sol + h * .38), z];
      if (!libre(pos, vise)) continue;
      camera = B.cinema.viser(pos, vise, 54); cible = vise;
      arbre = { essence: a.essenceArbre, p: [...a.p], s: [...a.s] }; break;
    }
    if (camera) break;
  }
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
  globalThis.__SAISONS_CAPTURE = { scenario: s, camera, cible, arbre };
  return { entree: 'BITUME_JEU.reference', modeleReel: true, arbre, camera, cible,
    description: 'Même terrain/arbres réels et caméra finale entre saisons ; pas de simulation de conduite ni de mesure FPS.' };
}
export function observerSaisonsCapture() {
  const J = BITUME_JEU, S = J.session, d = J.scene.decor, F = __SAISONS_CAPTURE, cam = S.camera;
  const objets = (d.lotsHerbier || d.lots).flatMap(l => l.objets), troncs = objets.filter(o => o.collision === 'tronc' && o.essenceArbre);
  const delta = F.cible.map((v, k) => v - cam.pos[k]), distance = Math.hypot(...delta), gl = J.rendu.gl;
  return { saison: d.saison.id, circuit: J.CATALOGUE[F.scenario.circuit].id, vue: S.vue,
    camera: { pos: [...cam.pos], yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov }, cameraPrescrite: F.camera, arbre: F.arbre,
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
  for (const image of r.images || []) {
    const o = image.observation;
    if (!o || o.saison !== s.saison || o.circuit !== s.id || o.vue !== 'poursuite') { erreurs.push('Observation de saison/circuit absente'); continue; }
    if (o.glErreur || o.glPerdu || o.obstruction !== false) erreurs.push('Erreur graphique ou caméra masquée');
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
      'La comparaison physique/géométrique et les budgets appartiennent au contrôle Node des neuf circuits.'] };
  const cameras = new Map();
  for (const s of scenariosSaisons(o)) {
    const sortie = path.join(o.sortie, s.nom), p = optionsScenarioSaisons(s, o, sortie);
    p.initialiser = ({ evaluer }) => evaluer(`(${preparerSaisons.toString()})(${JSON.stringify(s)})`);
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
