#!/usr/bin/env node
// Réception de la faune depuis la vraie caméra de poursuite. Seule la position de départ
// de la voiture est choisie ; aucun animal, décor, champ de caméra ou shader n'est déplacé.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from '../controle-visuel.mjs';

export function optionsFaune(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'sortie', 'chrome'].includes(k) || !argv[i + 1] || o[k]) throw new Error('Option inconnue, dupliquée ou vide : ' + argv[i]);
    o[k] = argv[i + 1];
  }
  if (!o.url || !o.sortie) throw new Error('--url et --sortie nécessaires');
  return o;
}

export function preparerFaune(s) {
  const J = BITUME_JEU, B = BITUME, A = B.animaux, initial = J.session;
  let ancre = s.ancre || null;
  if (s.faune !== 'off') {
    const E = initial.animaux, c = initial.course.c;
    if (!E?.groupes.length) throw new Error('Population terrestre absente');
    let meilleur = null;
    for (const g of E.groupes) {
      if (!g.md.q) continue;
      let voisin = 0, distance = Infinity;
      for (let k = 0; k < c.n; k++) {
        const d = Math.hypot(c.x[k] - g.hx, c.z[k] - g.hz);
        if (d < distance) { distance = d; voisin = k; }
      }
      for (const recul of [32, 42, 54]) {
        const depart = ((voisin * c.pas - recul) % c.longueur + c.longueur) % c.longueur;
        const p = B.circuit.echantillon(c, depart), cible = [g.hx, A.solExact(E.G.T, g.hx, g.hz) + .8, g.hz];
        const dx = cible[0] - p.x, dz = cible[2] - p.z;
        const devant = dx * Math.cos(p.cap) + dz * Math.sin(p.cap), cote = -dx * Math.sin(p.cap) + dz * Math.cos(p.cap);
        if (devant < 20 || Math.abs(cote) / (devant + 7.4) > .70) continue;
        const origine = [p.x, p.y + 2.45, p.z], dir = cible.map((v, i) => v - origine[i]), longueur = Math.hypot(...dir);
        const rayon = initial.course.physique.world.raycast(origine, dir.map(v => v / longueur), longueur - .3, { mask: 3, staticOnly: true });
        if (rayon.hit) continue;
        const score = longueur / Math.max(.7, g.md.rig?.longueur || 1);
        if (!meilleur || score < meilleur.score) meilleur = { score, depart, groupe: g.index, animal: g.debut,
          espece: g.cle, habitat: [g.hx, g.hz], cible, distanceBord: distance - c.largeur / 2 };
      }
    }
    if (!meilleur) throw new Error('Aucun habitat naturel visible depuis une position de route admissible');
    ancre = meilleur;
  }
  if (!ancre) throw new Error('Ancre témoin nécessaire pour Faune désactivée');
  const reference = J.reference({ ...initial.reference, depart: ancre.depart, vitesse: 0, pilote: false,
    qualite: s.qualite, faune: s.faune, vue: 'poursuite', retro: 'non' });
  globalThis.__BITUME_REFERENCE = J.session;
  const F = globalThis.__FAUNE_PROCHE = { ancre, cas: s.id, pas: 0, dessins: 0, objetsCible: 0, horloges: null, actifs: null };
  const pas = A.pas, dessiner = A.dessiner;
  A.pas = function (...args) { F.pas++; return pas.apply(this, args); };
  A.dessiner = function (...args) {
    F.dessins++;
    const sortie = args[3], debut = sortie.length, resultat = dessiner.apply(this, args);
    F.objetsCible = 0;
    for (let i = debut; i < sortie.length; i++) {
      const p = sortie[i].p;
      if (p && Math.hypot(p[0] - ancre.habitat[0], p[2] - ancre.habitat[1]) < 14) F.objetsCible++;
    }
    return resultat;
  };
  return { ancre, reference, cameraImposee: J.camera !== null,
    methode: 'BITUME_JEU.reference ; départ sur route choisi depuis un groupe existant ; wrappers de comptage conservant les appels natifs.' };
}

export function observerFaune() {
  const J = BITUME_JEU, S = J.session, A = BITUME.animaux, F = __FAUNE_PROCHE, E = S.animaux, cam = S.camera, gl = J.rendu.gl;
  const stats = E ? A.stats(E) : null, v = E?.visibilite;
  let horlogesEndormiesStables = true, endormisComparables = 0;
  if (v && F.horloges) for (let i = 0; i < v.actifs.length; i++) {
    if (!v.actifs[i] && !F.actifs[i]) { endormisComparables++; if (v.horloges[i] !== F.horloges[i]) horlogesEndormiesStables = false; }
  }
  if (v) { F.horloges = Array.from(v.horloges); F.actifs = Array.from(v.actifs); }
  const pose = E ? A.poseAnimal(E, F.ancre.animal, S.tRendu, {}) : null;
  const cible = pose ? [pose.x, pose.y + .8, pose.z] : F.ancre.cible;
  const d = cible.map((x, i) => x - cam.pos[i]), sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), sp = Math.sin(cam.pitch), cp = Math.cos(cam.pitch);
  const droite = d[0] * cy + d[2] * sy, haut = -d[0] * sy * sp + d[1] * cp + d[2] * cy * sp;
  const profondeur = d[0] * sy * cp + d[1] * sp - d[2] * cy * cp, tan = Math.tan(cam.fov * Math.PI / 360);
  const x = droite / (profondeur * tan * innerWidth / innerHeight), y = haut / (profondeur * tan);
  return { type: S.type, ecran: J.ecran, vue: S.vue, cameraImposee: J.camera !== null,
    faune: J.reglages.faune, populationPresente: !!E, stats, appels: { pas: F.pas, dessins: F.dessins }, objetsCible: F.objetsCible,
    endormisComparables, horlogesEndormiesStables, cible: { espece: F.ancre.espece, animal: F.ancre.animal, position: cible,
      projection: { x, y, profondeur, pixelX: (x + 1) * innerWidth / 2, pixelY: (1 - y) * innerHeight / 2 } },
    camera: { pos: Array.from(cam.pos), yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov },
    glErreur: gl.getError(), glPerdu: gl.isContextLost() };
}

export function verifierFaune(r, s) {
  const erreurs = [];
  if (r.fatal) erreurs.push(r.fatal.split('\n')[0]);
  erreurs.push(...(r.erreurs || []));
  for (const e of r.avertissements || []) if (/GL_INVALID|shader.*(error|failed)|GLSL|context lost/i.test(e)) erreurs.push(e);
  if (r.images.length !== 3) erreurs.push('Trois images requises');
  if (r.environnement.physx?.ready !== true || !r.environnement.webgl2) erreurs.push('PhysX/WebGL2 réel absent');
  for (const [i, im] of r.images.entries()) {
    const q = im.observation;
    if (!q) { erreurs.push('Observation absente'); continue; }
    if (q.type !== 'course' || q.ecran !== 'course' || q.vue !== 'poursuite' || q.cameraImposee || q.faune !== s.faune) erreurs.push('Vue ou réglage réel incorrect');
    if (q.glErreur || q.glPerdu) erreurs.push('Erreur WebGL');
    if (im.vues?.scene?.noir > .97 && im.vues.scene.luminance < .025) erreurs.push('Vue noire');
    if (s.faune === 'off') {
      if (q.populationPresente || q.appels.pas || q.appels.dessins || q.objetsCible) erreurs.push('Faune désactivée encore active');
    } else {
      const p = q.cible?.projection, a = q.stats?.activite;
      if (!q.populationPresente || !(q.stats?.animaux > 0) || !(q.stats?.vue?.animaux > 0) || !(q.objetsCible > 0)) erreurs.push('Animal proche réellement dessiné non prouvé');
      if (!p || ![p.x, p.y, p.profondeur].every(Number.isFinite) || p.profondeur <= 0 || Math.abs(p.x) > .9 || Math.abs(p.y) > .8) erreurs.push('Animal ciblé hors cadre');
      if (!(a?.groupesActifs > 0) || !(a?.groupesEndormis > 0) || a.groupesActifs + a.groupesEndormis !== q.stats.groupes) erreurs.push('Activité/sommeil non prouvés');
      if (i > 0 && (!q.horlogesEndormiesStables || !q.endormisComparables)) erreurs.push('Horloge des groupes endormis non stable');
    }
  }
  return [...new Set(erreurs)];
}

export async function campagneFaune(o) {
  mkdirSync(o.sortie, { recursive: true });
  const rapport = { format: 'bitume-faune-proche-1', passages: [], echecs: 0,
    limites: ['Images de conduite à l’arrêt depuis un habitat procédural réel ; aucune mesure de FPS matériel.',
      'Les coordonnées projetées localisent l’animal ; la réception finale examine les PNG et les éventuelles occultations du décor.'] };
  let ancre;
  for (const s of [{ id: 'high', qualite: 'high', faune: 'high' }, { id: 'low', qualite: 'low', faune: 'low' }, { id: 'off', qualite: 'high', faune: 'off' }]) {
    if (s.faune === 'off') s.ancre = ancre;
    const p = optionsCapture(['--url', o.url, '--sortie', path.join(o.sortie, s.id), '--scenario', 'piste', '--circuit', '0',
      '--images', '3', '--chauffe', '12', '--pas', '.1', '--taille', '1280,720', '--qualite', s.qualite,
      '--vue', 'poursuite', '--vitesse', '0', '--retro', 'non', '--attendre', '120000', ...(o.chrome ? ['--chrome', o.chrome] : [])]);
    p.referenceJeu.faune = s.faune; p.referenceJeu.pilote = false;
    p.initialiser = ({ evaluer }) => evaluer(`(${preparerFaune.toString()})(${JSON.stringify(s)})`);
    p.observer = ({ evaluer }) => evaluer(`(${observerFaune.toString()})()`);
    const r = await capturer(p), erreurs = verifierFaune(r, s);
    if (s.id === 'high') ancre = r.initialisation?.ancre;
    rapport.passages.push({ cas: s.id, images: r.images.length, ancre: r.initialisation?.ancre,
      commit: r.source?.commit, htmlSha256: r.build?.sha256, erreurs });
    rapport.echecs += erreurs.length;
    writeFileSync(path.join(o.sortie, 'RESUME.json'), JSON.stringify(rapport, null, 2) + '\n');
  }
  return rapport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagneFaune(optionsFaune(process.argv.slice(2))); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.echecs ? 1 : 0; }
  catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
