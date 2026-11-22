#!/usr/bin/env node
// Réception du fondu de couverture opaque sur le vrai rendu du jeu. La caméra de diagnostic
// grossit un animal naturel ; ni population, ni pose, ni matériau ne sont déplacés.
// Chaque vue possède un témoin qui omet seulement la sortie animaux après son calcul
// natif. Cette paire isole leur contribution aux pixels, pas les performances.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from '../controle-visuel.mjs';
import { decoderPng } from '../visuel-images.mjs';

const CAS = ['low-jour', 'high-jour', 'low-nuit', 'high-nuit'];
export const DISTANCES_FONDU = Object.freeze([.799, .801, .9, .99, 1.01, .799]);

export function optionsFondu(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const cle = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'sortie', 'chrome', 'cas', 'angle'].includes(cle) || !argv[i + 1] || o[cle])
      throw new Error('Option inconnue, dupliquée ou vide : ' + argv[i]);
    o[cle] = argv[i + 1];
  }
  if (!o.url || !o.sortie) throw new Error('--url et --sortie nécessaires');
  o.cas = o.cas ? o.cas.split(',') : CAS;
  if (!o.cas.length || o.cas.some(c => !CAS.includes(c)) || new Set(o.cas).size !== o.cas.length)
    throw new Error('--cas : low-jour,high-jour,low-nuit,high-nuit');
  return o;
}

// Fonction sérialisée dans la page : ne dépend d'aucune fermeture Node.
export function preparerFondu(s) {
  const J = BITUME_JEU, A = BITUME.animaux, S = J.session, E = S.animaux;
  if (!E?.nAnimaux) throw new Error('Population naturelle absente');
  const temps = S.course.horloge - 1 / 120, portee = s.qualite === 'low' ? 180 : A.PORTEE_VUES;
  const fractions = [.799, .801, .9, .99, 1.01];
  let ancre = null;
  // Choix borné d'un vrai quadrupède, avec un rayon libre jusqu'à sa silhouette.
  // Le côté est choisi avant les captures, jamais en fonction des couleurs obtenues.
  const candidats = [];
  for (let i = 0; i < E.nAnimaux; i++) {
    const animal = E.animaux[i], groupe = E.groupes[animal.g];
    if (!groupe.md.q || !groupe.md.rig || groupe.famille === 'terrier') continue;
    const pose = A.poseAnimal(E, i, temps, {}), cellule = A.cellule(E.G, pose.x, pose.z);
    if (cellule < 0 || pose.enfoui > 0) continue;
    const hauteur = groupe.md.rig.hauteur * pose.echelle;
    candidats.push({ animal: i, groupe: animal.g, espece: groupe.cle, pose,
      hauteur, longueur: groupe.md.rig.longueur * pose.echelle,
      originePortee: [pose.x, E.G.h[cellule] + pose.alt, pose.z],
      cible: [pose.x, pose.y + hauteur * .5, pose.z] });
  }
  candidats.sort((a, b) => b.hauteur - a.hauteur || a.animal - b.animal);
  for (const candidat of candidats) {
    for (const elevation of [.12, .25, .5]) {
      for (let cote = 0; cote < 12; cote++) {
        const angle = cote * Math.PI / 6, h = Math.sqrt(1 - elevation * elevation);
        const direction = [Math.cos(angle) * h, elevation, Math.sin(angle) * h];
        const rayons = fractions.map(fraction => {
          const pos = candidat.originePortee.map((v, k) => v + direction[k] * portee * fraction);
          const dir = candidat.cible.map((v, k) => v - pos[k]), distance = Math.hypot(...dir);
          const resultat = S.course.physique.world.raycast(pos, dir.map(v => v / distance), distance - .15, { mask: 3, staticOnly: true });
          return { fraction, camera: pos, distance, obstacle: !!resultat.hit };
        });
        if (rayons.some(r => r.obstacle)) continue;
        ancre = { ...candidat, direction, rayons }; break;
      }
      if (ancre) break;
    }
    if (ancre) break;
  }
  if (!ancre) throw new Error('Aucun animal naturel avec une ligne de vue libre aux distances requises');
  const F = globalThis.__FAUNE_FONDU = { ancre, portee, reference: { ...S.reference },
    cas: s.id, fraction: 0, temoin: false, derniere: null, rendu: null };
  const dessiner = A.dessiner;
  A.dessiner = function (etat, t, contexte, sortie) {
    const debut = sortie.length, resultat = dessiner.call(this, etat, t, contexte, sortie);
    if (etat === J.session.animaux && contexte.vue === 0) {
      const V = etat.vues[0], pose = A.poseAnimal(etat, ancre.animal, t, {});
      const opacite = V.lod[ancre.animal] ? V.opacites[ancre.animal] : 0;
      // L'opacité calculée pour l'entité distingue sa silhouette des voisins du troupeau
      // qui peuvent déjà avoir franchi le seuil ; à pleine couverture, plusieurs voisins partagent 1.
      const proches = V.lod[ancre.animal] ? sortie.slice(debut).filter(o => o.opacity === opacite && o.animal === ancre.espece && o.p &&
        Math.hypot(o.p[0] - pose.x, o.p[2] - pose.z) < Math.max(3, ancre.longueur * 1.5))
        : [];
      F.derniere = { temps: t, pose, lod: V.lod[ancre.animal],
        opacite,
        distance: V.lod[ancre.animal] ? V.dist[ancre.animal] : null,
        objets: proches.map(o => ({ forme: o.shape, p: Array.from(o.p), s: Array.from(o.s), r: Array.from(o.r),
          couleur: Array.from(o.color), mat: o.mat, alpha: o.alpha, opacity: o.opacity, fx: o.fx, priorite: o.fxPriority || null })),
        objetsNatifs: sortie.length - debut };
      if (F.temoin) sortie.length = debut;
    }
    return resultat;
  };
  const draw = J.rendu.draw;
  J.rendu.draw = function (cam, objets, options) {
    // Observation uniquement : les réglages, maillages et shaders transmis sont inchangés.
    const resultat = draw.call(this, cam, objets, options);
    F.rendu = { temps: options.time, luminosite: options.brightness, objets: objets.length,
      statistiques: { ...this.stats } };
    return resultat;
  };
  return { cas: s.id, portee, ancre, focaleVerticaleDegres: 10,
    methode: 'Caméra de diagnostic libre. Référence réinitialisée avant chaque image ; acc=-1 fige les pas de simulation. Rendu natif, témoin obtenu en omettant seulement la sortie animaux.',
    limite: 'La caméra grossissante ne qualifie pas la perception depuis une caméra de conduite ni les performances.' };
}

export function disposerFondu(fraction, temoin) {
  const J = BITUME_JEU, F = __FAUNE_FONDU, a = F.ancre;
  J.reference(F.reference);
  const S = J.session;
  globalThis.__BITUME_REFERENCE = S;
  S.acc = -1; // Gel prévu par la boucle du jeu pour ses outils de capture.
  F.fraction = fraction; F.temoin = temoin; F.derniere = null; F.rendu = null;
  const pos = a.originePortee.map((v, k) => v + a.direction[k] * F.portee * fraction);
  const d = a.cible.map((v, k) => v - pos[k]);
  const cam = { pos, yaw: Math.atan2(d[0], -d[2]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])),
    roll: 0, fov: 10, near: .1, far: 6000 };
  J.camera = () => cam;
  return { fraction, temoin, cam };
}

export function observerFondu() {
  const J = BITUME_JEU, S = J.session, F = __FAUNE_FONDU, cam = S.camera, gl = J.rendu.gl;
  const d = F.ancre.cible.map((v, k) => v - cam.pos[k]);
  const droite = d[0] * Math.cos(cam.yaw) + d[2] * Math.sin(cam.yaw);
  const haut = -d[0] * Math.sin(cam.yaw) * Math.sin(cam.pitch) + d[1] * Math.cos(cam.pitch) + d[2] * Math.cos(cam.yaw) * Math.sin(cam.pitch);
  const profondeur = d[0] * Math.sin(cam.yaw) * Math.cos(cam.pitch) + d[1] * Math.sin(cam.pitch) - d[2] * Math.cos(cam.yaw) * Math.cos(cam.pitch);
  const focale = innerHeight * .5 / Math.tan(cam.fov * Math.PI / 360);
  const rayon = Math.ceil(Math.max(16, Math.max(F.ancre.longueur, F.ancre.hauteur, 2) * focale / profondeur));
  const x = innerWidth / 2 + droite * focale / profondeur, y = innerHeight / 2 - haut * focale / profondeur;
  const zone = { x: Math.max(0, Math.floor(x - rayon)), y: Math.max(0, Math.floor(y - rayon)),
    width: Math.min(innerWidth, 2 * rayon + 1), height: Math.min(innerHeight, 2 * rayon + 1) };
  return { cas: F.cas, fraction: F.fraction, temoin: F.temoin, portee: F.portee,
    distanceDemandee: F.portee * F.fraction, rendu: F.rendu, animaux: F.derniere,
    reference: S.reference, horlogeCourse: S.course.horloge, acc: S.acc,
    cameraImposee: J.camera !== null, camera: { pos: Array.from(cam.pos), yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov },
    projection: { x, y, profondeur }, zone, glErreur: gl.getError(), glPerdu: gl.isContextLost() };
}

export function mesurerContribution(image, temoin, zone) {
  if (image.width !== temoin.width || image.height !== temoin.height) throw new Error('Dimensions de témoins différentes');
  const x0 = Math.max(0, Math.floor(zone.x)), y0 = Math.max(0, Math.floor(zone.y));
  const x1 = Math.min(image.width, Math.ceil(zone.x + zone.width)), y1 = Math.min(image.height, Math.ceil(zone.y + zone.height));
  let pixels = 0, somme = 0, maximum = 0, energieCarree = 0;
  const rgb = [0, 0, 0], signature = createHash('sha256'), masque = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * image.width + x) * image.canaux, j = (y * temoin.width + x) * temoin.canaux;
    const ecarts = [0, 1, 2].map(c => image.pixels[i + c] - temoin.pixels[j + c]);
    const amplitude = Math.max(...ecarts.map(Math.abs));
    maximum = Math.max(maximum, amplitude);
    // Un seul quantum encodé suffit à compter une contribution ; ce n'est pas un seuil d'acceptation.
    if (amplitude) { pixels++; masque.push([x, y, ...ecarts]); }
    for (let c = 0; c < 3; c++) { rgb[c] += ecarts[c]; somme += Math.abs(ecarts[c]); energieCarree += ecarts[c] ** 2; }
    signature.update(Buffer.from(ecarts.map(v => v + 255).flatMap(v => [v >> 8, v & 255])));
  }
  const surface = Math.max(1, (x1 - x0) * (y1 - y0));
  return { zone: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, pixelsContribuants: pixels,
    maximumCanal255: maximum, ecartAbsoluMoyen255: somme / (surface * 3),
    energieL2: Math.sqrt(energieCarree), contributionRGB255: rgb.map(v => v / Math.max(1, pixels)),
    empreinteContribution: signature.digest('hex'), masque };
}

function analyserPassage(r, dossier) {
  const erreurs = [], mesures = [];
  if (r.fatal) erreurs.push(r.fatal.split('\n')[0]);
  erreurs.push(...(r.erreurs || []));
  for (const e of r.avertissements || []) if (/GL_INVALID|shader.*(error|failed)|GLSL|context lost/i.test(e)) erreurs.push(e);
  if (r.images.length !== DISTANCES_FONDU.length * 2) erreurs.push('Douze images requises');
  if (!r.environnement.webgl2 || !r.environnement.physx?.ready) erreurs.push('WebGL2/PhysX réel absent');
  let poseInitiale = null, tempsInitial = null, opacitePrecedente = 1;
  for (let i = 0; i + 1 < r.images.length; i += 2) {
    const im = r.images[i], sans = r.images[i + 1], a = im.observation, b = sans.observation;
    if (!a?.animaux || !b?.animaux || !a.rendu || !b.rendu) { erreurs.push('Observation de rendu absente'); continue; }
    if (a.temoin || !b.temoin || a.fraction !== b.fraction || a.fraction !== DISTANCES_FONDU[i / 2]) erreurs.push('Paire de témoins incorrecte');
    if (a.glErreur || b.glErreur || a.glPerdu || b.glPerdu) erreurs.push('Erreur WebGL');
    if (!a.cameraImposee || !b.cameraImposee || a.camera.fov !== 10 || b.camera.fov !== 10 || a.acc !== -1 || b.acc !== -1)
      erreurs.push('Caméra ou gel de simulation incorrect');
    const pose = JSON.stringify(a.animaux.pose), t = JSON.stringify([a.animaux.temps, a.rendu.temps, a.horlogeCourse]);
    poseInitiale ||= pose; tempsInitial ||= t;
    if (pose !== poseInitiale || JSON.stringify(b.animaux.pose) !== pose || t !== tempsInitial ||
        JSON.stringify([b.animaux.temps, b.rendu.temps, b.horlogeCourse]) !== t) erreurs.push('Pose/temps différents entre les vues');
    if (JSON.stringify(a.animaux.objets) !== JSON.stringify(b.animaux.objets) ||
        JSON.stringify(a.camera) !== JSON.stringify(b.camera) || a.rendu.luminosite !== b.rendu.luminosite)
      erreurs.push('Témoin non comparable : géométrie, caméra ou exposition différente');
    if (a.fraction < 1) {
      if (!a.animaux.lod || !a.animaux.objets.length) erreurs.push('Animal naturel absent avant extinction');
      if (Math.abs(a.animaux.distance - a.distanceDemandee) > .001) erreurs.push('Distance de fondu différente de la distance prescrite');
      if (a.animaux.objets.some(o => o.fx || o.alpha !== 1 || o.priorite)) erreurs.push('Corps animal passé en FX');
      if (a.fraction < .8 && a.animaux.objets.some(o => o.opacity !== 1)) erreurs.push('Retour opaque absent');
      if (a.fraction > .8 && a.animaux.objets.some(o => !Number.isFinite(o.opacity) || o.opacity >= 1 || o.opacity <= 0))
        erreurs.push('Couverture opaque attendue absente');
    } else if (a.animaux.lod || a.animaux.opacite) erreurs.push('Animal sélectionné au-delà de la portée');
    if (i < 10 && a.animaux.opacite > opacitePrecedente) erreurs.push('Opacité non décroissante');
    opacitePrecedente = a.animaux.opacite;
    const image = decoderPng(readFileSync(path.join(dossier, im.fichier))), temoin = decoderPng(readFileSync(path.join(dossier, sans.fichier)));
    const m = mesurerContribution(image, temoin, a.zone), { masque, ...resume } = m;
    if (a.fraction === .799 && !m.pixelsContribuants) erreurs.push('Animal opaque sans contribution visible dans la zone');
    const masqueFichier = String(i).padStart(4, '0') + '-contribution.json';
    writeFileSync(path.join(dossier, masqueFichier), JSON.stringify({ format: 'pixels-rgb-signes-1', ...resume, pixels: masque }) + '\n');
    mesures.push({ fraction: a.fraction, image: im.fichier, temoin: sans.fichier, masque: masqueFichier,
      opaciteCPU: a.animaux.opacite, lod: a.animaux.lod, ...resume });
  }
  const retour = mesures.length === 6 ? { memeContribution: mesures[0].empreinteContribution === mesures[5].empreinteContribution,
    aller: mesures[0].empreinteContribution, retour: mesures[5].empreinteContribution } : null;
  if (retour && !retour.memeContribution) erreurs.push('Retour à la même caméra/pose : pixels animaux différents');
  return { erreurs: [...new Set(erreurs)], mesures, retour,
    receptionVisuelle: 'obligatoire : aucun seuil automatique ne déclare la continuité du modelé pendant le fondu acceptable' };
}

export async function campagneFondu(o) {
  mkdirSync(o.sortie, { recursive: true });
  const rapport = { format: 'bitume-faune-fondu-2', passages: [], echecsStructurels: 0,
    receptionVisuelle: 'a_recevoir',
    limites: ['Caméra de diagnostic 10° : aucune validation du cadrage de conduite ou de FPS.',
      'Le témoin omet uniquement les objets rendus par animaux.dessiner après leur préparation native ; population et shader inchangés.',
      'Les métriques isolent les pixels animaux et leurs effets dans une zone ; ce ne sont pas des mesures photométriques HDR.',
      'La continuité du modelé pendant le fondu exige l’inspection des PNG, particulièrement .799/.801 jour et nuit ; aucun seuil ne la valide automatiquement.',
      'Ce scénario ne qualifie ni J2 ni les rétroviseurs.'] };
  for (const id of o.cas) {
    const [qualite, moment] = id.split('-'), sortie = path.join(o.sortie, id);
    const p = optionsCapture(['--url', o.url, '--sortie', sortie, '--scenario', 'piste', '--circuit', '0',
      '--images', '12', '--chauffe', '0', '--pas', '.1', '--taille', '1280,720', '--qualite', qualite,
      '--moment', moment, '--vue', 'poursuite', '--vitesse', '0', '--retro', 'non', '--attendre', '120000',
      ...(o.chrome ? ['--chrome', o.chrome] : []), ...(o.angle ? ['--angle', o.angle] : [])]);
    p.referenceJeu.faune = qualite; p.referenceJeu.pilote = false;
    p.initialiser = ({ evaluer }) => evaluer(`(${preparerFondu.toString()})(${JSON.stringify({ id, qualite, moment })})`);
    p.avantImage = ({ evaluer, i }) => evaluer(`(${disposerFondu.toString()})(${DISTANCES_FONDU[Math.floor(i / 2)]},${i % 2 === 1})`);
    p.observer = ({ evaluer }) => evaluer(`(${observerFondu.toString()})()`);
    const r = await capturer(p), analyse = analyserPassage(r, sortie);
    rapport.passages.push({ cas: id, commit: r.source?.commit, htmlSha256: r.build?.sha256,
      images: r.images.length, ...analyse });
    rapport.echecsStructurels += analyse.erreurs.length;
    writeFileSync(path.join(o.sortie, 'RESUME.json'), JSON.stringify(rapport, null, 2) + '\n');
  }
  return rapport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagneFondu(optionsFondu(process.argv.slice(2))); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.echecsStructurels ? 1 : 0; }
  catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
