#!/usr/bin/env node
// Comparaison des mains dans le vrai jeu : même outil, mêmes états et mêmes caméras pour les deux HTML.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer } from '../controle-visuel.mjs';
import { optionsScenarioHabitacle, preparerHabitacle, observerHabitacle } from '../captures-habitacle.mjs';
import { observerModele, verifierModele } from './captures-modele-126ck.mjs';

const gauche = { poste: [.05, 1.25, -.92], cible: [.87, .67, -.015] };
const droite = { poste: [.05, 1.25, .92], cible: [.87, .67, .015] };
const gestes = { poste: [.27, 1.48, -1.03], cible: [.86, .77, -.015] };
const etapesGeste = duree => [
  { nom: 'ouverture', age: .06 }, { nom: 'deploiement', age: .15 },
  { nom: 'maintien', age: .40 }, { nom: 'retour', age: duree - .13 },
  { nom: 'reprise', age: duree + .04 }
];

export const SCENARIOS_MAINS = Object.freeze([
  { id: 'prise-gauche', ...gauche },
  { id: 'prise-droite', ...droite },
  { id: 'braquage-gauche', ...gauche, volant: -.8 },
  { id: 'braquage-droite', ...droite, volant: .8 },
  { id: 'passage', ...droite, passage: true, instants: [
    { nom: 'ouverture', age: .36 * .12 }, { nom: 'pommeau', age: .36 * .5 },
    { nom: 'retour', age: .36 * .85 }, { nom: 'reprise', age: .40 }
  ] },
  { id: 'salut', ...gestes, geste: 'salut', instants: etapesGeste(1.80) },
  { id: 'majeur', ...gestes, geste: 'majeur', instants: etapesGeste(1.65) },
  { id: 'poing', ...gestes, geste: 'poing', instants: etapesGeste(1.40) },
  { id: 'cockpit', cockpit: true }
].map(s => Object.freeze({ fov: 35, pas: 1 / 60, chauffe: 0, sansPilote: false,
  instants: [{ nom: 'prise', age: .40 }], ...s,
  images: s.instants?.length || 1
})));

export function optionsMains(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'avant', 'sortie', 'chrome', 'cas', 'taille'].includes(k) ||
      o[k] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Option invalide : ' + argv[i]);
    o[k] = argv[i + 1];
  }
  if (!o.url || !o.avant || !o.sortie) throw new Error('--url, --avant et --sortie nécessaires');
  for (const k of ['url', 'avant']) if (new URL(o[k]).protocol !== 'file:') throw new Error('Deux HTML locaux exacts requis');
  if (o.url === o.avant) throw new Error('La référence et le candidat doivent être deux fichiers distincts');
  o.cas = o.cas ? o.cas.split(',') : SCENARIOS_MAINS.map(s => s.id);
  if (!o.cas.length || new Set(o.cas).size !== o.cas.length || o.cas.some(id => !SCENARIOS_MAINS.some(s => s.id === id)))
    throw new Error('Scénario de mains inconnu ou dupliqué');
  o.sortie = path.resolve(o.sortie); o.taille ||= '1280,960';
  optionsScenarioHabitacle(SCENARIOS_MAINS[0], o.url, o.sortie, o);
  return o;
}

// Le pilote est commandé par son API normale. Aucun maillage ni algorithme du runtime n'est remplacé.
export function preparerMains(s) {
  const J = BITUME_JEU, B = BITUME, S = J.session, F = __HABITACLE_CAPTURE, co = S.course;
  const X = B.expressionsPilote, v = co.voitures[F.sujet], t = co.horloge - 1 / 120;
  const E = X.creer(co.voitures.length, 17017);
  S.expressions = E;
  v.tPassage = s.passage ? t : -100; v.rapportAvant = s.passage ? 2 : 3;
  X.actualiser(E, co, S.cour, t - .01);
  if (s.geste) {
    X.configurer(E, F.sujet, { geste: s.geste, klaxon: 'classique' });
    X.demander(E, F.sujet, true); X.demander(E, F.sujet, false);
  }
  X.actualiser(E, co, S.cour, t);
  if (s.geste && X.lire(E, F.sujet).geste !== s.geste) throw new Error('Le geste natif demandé ne démarre pas');
  F.mains = { debut: t, scenario: s, instant: null, agePrescrit: null };
  return { entree: 'expressionsPilote.configurer/demander/actualiser', scenario: s.id,
    geste: s.geste || null, debut: t, substitutionModele: false };
}

// L'horloge et les commandes sont prescrites, comme dans les autres bancs. Les sorties de pose ne le sont pas.
// Les petits pas publics maintiennent le suivi natif des expressions pendant les intervalles sans PNG.
export function preparerInstantMains(i) {
  const S = BITUME_JEU.session, F = __HABITACLE_CAPTURE, M = F.mains, s = M.scenario;
  const instant = s.instants[i], E = S.expressions, X = BITUME.expressionsPilote;
  if (!instant) throw new Error('Instant de capture inconnu');
  const cible = M.debut + instant.age;
  if (cible < E.temps - 1e-8) throw new Error('La séquence doit avancer dans le temps');
  while (E.temps < cible - s.pas - 1e-8) X.actualiser(E, S.course, S.cour, Math.min(cible - s.pas, E.temps + .1));
  // Le runner ajoute ensuite un pas ; la boucle figée rend horloge - 1/120.
  S.course.horloge = cible + 1 / 120 - s.pas; S.course.temps = S.course.horloge;
  M.instant = F.instant = instant.nom; M.agePrescrit = instant.age;
  return { instant: instant.nom, agePrescrit: instant.age };
}

export function observerMains(modele) {
  const F = __HABITACLE_CAPTURE, S = BITUME_JEU.session, cam = modele.camera;
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const cr = Math.cos(cam.roll || 0), sr = Math.sin(cam.roll || 0), r = [cy, 0, sy], u = [-sy * sp, cp, cy * sp];
  const droite = r.map((x, i) => x * cr + u[i] * sr), haut = u.map((x, i) => x * cr - r[i] * sr);
  const avant = [sy * cp, sp, -cy * cp], tan = Math.tan(cam.fov * Math.PI / 360);
  const largeur = innerWidth, hauteur = innerHeight, dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
  const mains = [0, 1].map(cote => {
    const pieces = modele.piecesModele.filter(p => p.role.startsWith('gant-' + cote + '-'));
    const doigts = pieces.find(p => p.role === 'gant-' + cote + '-0');
    let cadre = null;
    if (doigts) {
      const d = doigts.p.map((x, i) => x - cam.pos[i]), profondeur = dot(d, avant);
      // Diamètre conservateur de l'enveloppe, pas un test d'occultation ou de contact des surfaces.
      cadre = { x: largeur * .5 + dot(d, droite) / (profondeur * tan) * hauteur * .5,
        y: hauteur * .5 - dot(d, haut) / (profondeur * tan) * hauteur * .5,
        profondeur, diametreEnveloppePx: Math.hypot(...doigts.s) / (profondeur * tan) * hauteur * .5 };
    }
    return { cote, pieces: pieces.length, formeDoigts: doigts?.shape || null, cadre };
  });
  return { ...modele, mains, instant: F.mains.instant, agePrescrit: F.mains.agePrescrit,
    ageRendu: S.tRendu - F.mains.debut, viewportMains: { largeur, hauteur },
    limitesCadrage: 'Centres et enveloppes conservatrices des vrais objets présents ; occultation à examiner dans les PNG.' };
}

export function verifierMains(r, s) {
  const erreurs = verifierModele(r, s), fini = Number.isFinite;
  if (r.environnement?.physx?.ready !== true) erreurs.push('PhysX réel absent');
  if (r.initialisation?.mains?.substitutionModele !== false) erreurs.push('Initialisation native des mains absente');
  for (let i = 0; i < (r.images || []).length; i++) {
    const q = r.images[i].observation, instant = s.instants[i];
    if (!q || !instant) continue;
    if (q.instant !== instant.nom || !fini(q.ageRendu) || Math.abs(q.ageRendu - instant.age) > 1e-7)
      erreurs.push('Phase temporelle différente : ' + i);
    if (q.volant !== (s.volant || 0)) erreurs.push('Braquage différent de la consigne');
    if (!Array.isArray(q.mains) || q.mains.length !== 2 || q.mains.some((m, cote) => m.cote !== cote || m.pieces < 6 || !m.formeDoigts))
      erreurs.push('Les deux mains réellement rendues sont requises');
    for (const m of q.mains || []) {
      const c = m.cadre, v = q.viewportMains;
      if (!c || !v || ![c.x, c.y, c.profondeur, c.diametreEnveloppePx, v.largeur, v.hauteur].every(fini) ||
        !(c.profondeur > 0 && c.x > 0 && c.x < v.largeur && c.y > 0 && c.y < v.hauteur))
        erreurs.push('Centre de main hors champ : ' + m.cote);
      else if (!s.cockpit && c.diametreEnveloppePx < 55) erreurs.push('Main trop petite pour cette inspection : ' + m.cote);
    }
    if (s.geste) {
      const attendu = instant.nom === 'reprise' ? null : s.geste;
      if (!q.expression || q.expression.geste !== attendu) erreurs.push('Geste natif attendu absent : ' + instant.nom);
      if (attendu && !(q.expression.gesteIntensite > 0)) erreurs.push('Geste demandé sans intensité');
    }
    if (s.passage && Math.abs(q.passage - Math.min(1, instant.age / .36)) > 1e-7) erreurs.push('Phase de rapport incorrecte');
  }
  return [...new Set(erreurs)];
}

export function comparerConditionsMains(avant, apres) {
  const erreurs = [];
  if (JSON.stringify(avant.parametres) !== JSON.stringify(apres.parametres)) erreurs.push('Paramètres de capture différents');
  if (JSON.stringify(avant.environnement?.resolution) !== JSON.stringify(apres.environnement?.resolution) ||
    avant.environnement?.gpu !== apres.environnement?.gpu) erreurs.push('Environnement de comparaison différent');
  if (!avant.images?.length || avant.images.length !== apres.images?.length) erreurs.push('Paire de séquences incomplète');
  for (let i = 0; i < Math.min(avant.images?.length || 0, apres.images?.length || 0); i++) {
    const a = avant.images[i].observation, b = apres.images[i].observation;
    const selection = o => o && ({ camera: o.camera, pose: o.pose, instant: o.instant, ageRendu: o.ageRendu,
      volant: o.volant, rapport: o.rapport, passage: o.passage, expression: o.expression });
    if (JSON.stringify(selection(a)) !== JSON.stringify(selection(b))) erreurs.push('Pose, caméra ou phase différente : ' + i);
  }
  return erreurs;
}

const sha = b => createHash('sha256').update(b).digest('hex');
export async function campagneMains(o) {
  if (existsSync(path.join(o.sortie, 'rapport.json'))) throw new Error('Dossier de comparaison déjà utilisé');
  mkdirSync(o.sortie, { recursive: true });
  const builds = { avant: sha(readFileSync(fileURLToPath(o.avant))), candidat: sha(readFileSync(fileURLToPath(o.url))) };
  const campagne = { format: 'bitume-mains-realisme-1', builds, passages: [], echecs: 0,
    limites: ['Vrai jeu, modèle et FERRO WebGL2 ; caméras et temps prescrits.',
      'Les mesures de cadrage ne prouvent pas la visibilité des surfaces : inspecter les PNG.',
      'SwiftShader ne qualifie ni les FPS matériels ni le réalisme esthétique.'] };
  const enregistrer = () => {
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(campagne, null, 2) + '\n');
    const images = campagne.passages.flatMap(p => (p.avant?.images || []).map((a, i) => {
      const c = p.candidat?.images?.[i];
      return `<section><h2>${p.scenario} · ${a.instant}</h2><div><figure><img src="${a.fichier}"><figcaption>Avant · ${builds.avant.slice(0, 16)}</figcaption></figure>` +
        (c ? `<figure><img src="${c.fichier}"><figcaption>Candidat · ${builds.candidat.slice(0, 16)}</figcaption></figure>` : '<p>Capture candidate absente.</p>') + '</div></section>';
    })).join('\n');
    writeFileSync(path.join(o.sortie, 'index.html'), '<!doctype html><meta charset="utf-8"><title>BITUME — comparaison mains</title>' +
      '<style>body{background:#16191f;color:#eee;font:16px system-ui;margin:24px}div{display:flex;gap:12px}figure{margin:0;flex:1;min-width:0}img{width:100%}figcaption{padding:8px}h2{margin-top:36px;font-size:20px}</style>' +
      '<h1>BITUME — mains, comparaison des vrais HTML</h1><p>Caméras et poses identiques. Inspection visuelle requise ; aucune mesure de FPS.</p>' + images);
  };
  for (const id of o.cas) {
    const s = SCENARIOS_MAINS.find(s => s.id === id), passage = { scenario: id, avant: null, candidat: null, comparaison: [] }, rapports = {};
    campagne.passages.push(passage);
    for (const version of ['avant', 'candidat']) {
      const url = version === 'avant' ? o.avant : o.url, sortie = path.join(o.sortie, version, id);
      const p = optionsScenarioHabitacle(s, url, sortie, o);
      // La préparation générique pose seulement la voiture et la caméra ; la demande du geste suit son API.
      const scene = { ...s, geste: null, passage: false };
      p.initialiser = ({ evaluer }) => evaluer(`(() => { const habitacle = (${preparerHabitacle.toString()})(${JSON.stringify(scene)}); const mains = (${preparerMains.toString()})(${JSON.stringify(s)}); return { habitacle, mains }; })()`);
      p.avantImage = ({ evaluer, i }) => evaluer(`(${preparerInstantMains.toString()})(${i})`);
      p.observer = ({ evaluer }) => evaluer(`(${observerMains.toString()})((${observerModele.toString()})((${observerHabitacle.toString()})()))`);
      const r = rapports[version] = await capturer(p), erreurs = verifierMains(r, s);
      if (r.build?.sha256 !== builds[version] || sha(readFileSync(fileURLToPath(url))) !== builds[version]) erreurs.push('HTML différent ou modifié');
      passage[version] = { erreurs, images: (r.images || []).map((im, i) => ({ instant: s.instants[i].nom,
        fichier: version + '/' + id + '/' + im.fichier, sha256: sha(readFileSync(path.join(sortie, im.fichier))) })) };
      if (erreurs.length) campagne.echecs++;
      enregistrer(); console.error(`${version}/${id} : ${r.images.length} PNG, ${erreurs.length} erreurs`);
      if (r.fatal) return campagne;
    }
    passage.comparaison = comparerConditionsMains(rapports.avant, rapports.candidat);
    if (passage.comparaison.length) campagne.echecs++;
    enregistrer();
  }
  return campagne;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagneMains(optionsMains(process.argv.slice(2))); console.log(JSON.stringify({ builds: r.builds, passages: r.passages.length, echecs: r.echecs })); process.exitCode = r.echecs ? 1 : 0; }
  catch (e) { console.error(e.stack || String(e)); process.exitCode = 1; }
}
