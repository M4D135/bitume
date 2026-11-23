#!/usr/bin/env node
// Inspection de la voiture complète dans le HTML construit, sans substitution du modèle ni du renderer.
// node tools/qualification/captures-modele-126ck.mjs --url file:///.../dist/bitume.html --sortie /tmp/modele --cas dessus,profil
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer } from '../controle-visuel.mjs';
import { optionsScenarioHabitacle, preparerHabitacle, observerHabitacle } from '../captures-habitacle.mjs';

export const SCENARIOS_MODELE = Object.freeze([
  { id: 'dessus', poste: [-.001, 7.7, 0], cible: [0, .3, 0] },
  { id: 'profil', poste: [0, .80, -7.2], cible: [0, .48, 0] },
  { id: 'trois-quarts', poste: [4.8, 3.1, -4.3], cible: [0, .43, 0] },
  { id: 'arriere', poste: [-4.8, 1.45, 0], cible: [-.40, .46, 0] },
  { id: 'arriere-plongeant', poste: [-3.4, 3.5, -2.5], cible: [-.55, .45, 0] },
  { id: 'habitacle-avec-pilote', poste: [-.75, 2.5, -1.25], cible: [.77, .52, 0] },
  { id: 'habitacle-vide', poste: [-.75, 2.5, -1.25], cible: [.77, .52, 0], sansPilote: true },
  { id: 'dessus-vide', poste: [-.001, 7.7, 0], cible: [0, .3, 0], sansPilote: true },
  { id: 'cockpit', cockpit: true },
  { id: 'cockpit-portrait', cockpit: true, taille: '540,960' },
  { id: 'braquage', poste: [-.75, 2.5, -1.25], cible: [.77, .52, 0], volant: -.8 },
  { id: 'passage', poste: [-.75, 2.5, -1.25], cible: [.77, .52, 0], passage: true },
  { id: 'troll', poste: [2.4, 1.8, -2.4], cible: [.65, .58, 0], geste: 'majeur' }
].map(s => Object.freeze({ images: 1, chauffe: 24, pas: 1 / 60, fov: 40, sansPilote: false, ...s })));

export function optionsModele(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'sortie', 'chrome', 'cas', 'taille'].includes(k) || o[k] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw new Error('Option invalide : ' + argv[i]);
    o[k] = argv[i + 1];
  }
  if (!o.url || !o.sortie || new URL(o.url).protocol !== 'file:') throw new Error('--url file: et --sortie requis');
  o.cas = o.cas ? o.cas.split(',') : SCENARIOS_MODELE.map(s => s.id);
  if (!o.cas.length || new Set(o.cas).size !== o.cas.length || o.cas.some(id => !SCENARIOS_MODELE.some(s => s.id === id))) throw new Error('Scénario inconnu ou répété');
  o.taille ||= '1280,960'; o.sortie = path.resolve(o.sortie);
  optionsScenarioHabitacle(SCENARIOS_MODELE[0], o.url, o.sortie, o);
  return o;
}

// Seul l'état d'inspection du modèle est modifié. Le runtime décide quelles pièces appartiennent au pilote.
export function preparerModele(s) {
  const S = BITUME_JEU.session, F = __HABITACLE_CAPTURE, mod = S.modeles[F.sujet];
  mod.sansPilote = !!s.sansPilote;
  return { sansPilote: mod.sansPilote, modeleCommun: true, substitutionRendu: false };
}

export function observerModele(habitacle) {
  const S = BITUME_JEU.session, mod = S.modeles[__HABITACLE_CAPTURE.sujet], E = mod.objetsRendu, presents = new Set(S.sortie);
  const pieces = [], vus = new Set(), corpsPilote = /^bitume-pilote-/;
  const rolePilote = /^(?:buste|epaule-|bras-|avant-bras-|coude-|gant-|manche-joint-|harnais-porte|sangle-portee)/;
  const ajouter = (o, role, pilote) => {
    if (!o || !presents.has(o) || vus.has(o)) return;
    vus.add(o); pieces.push({ role, pilote: !!pilote, shape: o.shape, p: Array.from(o.p), r: Array.from(o.r), s: Array.from(o.s), mat: o.mat });
  };
  for (const t of E.tables || []) if (t) for (let i = 0; i < t.objets.length; i++) {
    const o = t.objets[i]; ajouter(o, 'coque:' + o.shape, corpsPilote.test(o.shape) || t.buste?.[i] || t.tete?.[i]);
  }
  for (const v of [...(E.pilote?.variantes || []), E.pilote?.cockpit].filter(Boolean))
    for (const p of v.pieces) ajouter(p.objet, p.role, rolePilote.test(p.role));
  // En cockpit, les commandes passent directement par l'habitacle commun.
  const H = E.habitacle;
  if (H) {
    ajouter(H.jante?.objet, 'volant', false); ajouter(H.tige?.objet, 'levier', false); ajouter(H.pommeau?.objet, 'pommeau', false);
    for (let i = 0; i < (H.planche || []).length; i++) ajouter(H.planche[i].objet, i ? 'planche-' + i : 'planche', false);
    for (let i = 0; i < (H.supportVolant || []).length; i++) ajouter(H.supportVolant[i].objet, 'support-volant-' + i, false);
    for (let i = 0; i < (H.mains || []).length; i++) for (let n = 0; n < H.mains[i].pieces.length; n++) ajouter(H.mains[i].pieces[n].objet, 'gant-' + i + '-' + n, true);
  }
  return { ...habitacle, sansPilote: mod.sansPilote === true, piecesModele: pieces,
    sourceGeometrie: 'S.modeles[sujet].objetsRendu, objets réellement présents dans S.sortie' };
}

export function verifierModele(r, s) {
  const fautes = [];
  if (r.fatal) fautes.push('Capture interrompue : ' + r.fatal);
  if (r.erreurs?.length) fautes.push(...r.erreurs);
  if (r.environnement?.webgpu !== true) fautes.push('WebGPU absent');
  if (!r.build?.sha256 || !r.build?.octets) fautes.push('HTML exact non identifié');
  if (r.images?.length !== s.images) fautes.push('Nombre d’images incorrect');
  for (const im of r.images || []) {
    const q = im.observation, ps = q?.piecesModele || [];
    if (!q || q.gpuErreur || q.gpuPerdu) fautes.push('Observation GL invalide');
    if (q?.sansPilote !== !!s.sansPilote) fautes.push('État avec/sans pilote incorrect');
    if (!im.etat?.referenceConservee || q?.type !== 'course' || q?.ecran !== 'course') fautes.push('Séance de référence perdue');
    if (q?.obstructionStatique) fautes.push('Caméra obstruée par le décor');
    if (q?.cameraImposee !== !s.cockpit) fautes.push('Caméra d’inspection incorrecte');
    if (!ps.length || ps.some(p => !p.shape || ![...p.p, ...p.r, ...p.s].every(Number.isFinite))) fautes.push('Pièces absentes ou non finies');
    for (const role of ['volant', 'levier', 'pommeau', 'planche']) if (!ps.some(p => p.role === role)) fautes.push('Commande absente : ' + role);
    if (!ps.some(p => p.role.startsWith('support-volant-'))) fautes.push('Colonne de direction absente');
    if (s.sansPilote && ps.some(p => p.pilote)) fautes.push('Corps ou membres encore rendus dans l’habitacle vide');
    if (!s.sansPilote && !ps.some(p => p.pilote)) fautes.push('Pilote attendu absent');
    if (!s.cockpit) for (const nom of ['goutte', 'cuve', 'assise-pilote', 'arceau'])
      if (!ps.some(p => p.shape === 'bitume-' + nom)) fautes.push('Pièce structurelle absente : ' + nom);
  }
  return [...new Set(fautes)];
}

// Comparer la géométrie commune réellement posée, et non les pixels que le pilote cache naturellement.
export function comparerPresencePilote(avec, sans) {
  const structure = q => (q?.piecesModele || []).filter(p => !p.pilote).map(p => JSON.stringify(p)).sort();
  const a = structure(avec), b = structure(sans);
  if (!a.length || !b.length) return ['Comparaison sans pièces structurelles'];
  return JSON.stringify(a) === JSON.stringify(b) ? [] : ['Géométrie structurelle différente avec/sans pilote'];
}

export async function campagneModele(o) {
  if (existsSync(path.join(o.sortie, 'rapport.json'))) throw new Error('Dossier de capture déjà utilisé');
  mkdirSync(o.sortie, { recursive: true });
  const sha = b => createHash('sha256').update(b).digest('hex');
  const build = sha(readFileSync(fileURLToPath(o.url))), observations = {};
  const r = { format: 'bitume-modele-126ck-1', htmlSha256: build, passages: [], comparaisons: [], echecs: 0,
    limites: ['Vrai jeu et vrai FERRO WebGPU ; poses et caméras extérieures prescrites pour inspection.',
      'SwiftShader ne qualifie pas les FPS du matériel.', 'Occultations naturelles admises ; aucun déplacement de pièce pour dégager les cadrans.',
      'Ces contrôles prouvent présence et cohérence ; la fidélité aux images exige une inspection visuelle.'] };
  const enregistrer = () => writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(r, null, 2) + '\n');
  for (const id of o.cas) {
    const s = SCENARIOS_MODELE.find(s => s.id === id), sortie = path.join(o.sortie, id);
    const p = optionsScenarioHabitacle(s, o.url, sortie, o);
    p.initialiser = ({ evaluer }) => evaluer(`(() => { const habitacle = (${preparerHabitacle.toString()})(${JSON.stringify(s)}); return { habitacle, modele: (${preparerModele.toString()})(${JSON.stringify(s)}) }; })()`);
    p.observer = ({ evaluer }) => evaluer(`(${observerModele.toString()})((${observerHabitacle.toString()})())`);
    const resultat = await capturer(p), erreurs = verifierModele(resultat, s);
    if (resultat.build?.sha256 !== build || sha(readFileSync(fileURLToPath(o.url))) !== build) erreurs.push('HTML modifié pendant la campagne');
    observations[id] = resultat.images?.[0]?.observation;
    const png = (resultat.images || []).map(im => ({ fichier: id + '/' + im.fichier, sha256: sha(readFileSync(path.join(sortie, im.fichier))) }));
    r.passages.push({ scenario: id, images: png, erreurs }); r.echecs += erreurs.length ? 1 : 0; enregistrer();
    console.error(id + ' : ' + png.length + ' image, ' + erreurs.length + ' erreurs');
    if (resultat.fatal) break;
  }
  for (const [avec, sans] of [['dessus', 'dessus-vide'], ['habitacle-avec-pilote', 'habitacle-vide']]) if (observations[avec] && observations[sans]) {
    const erreurs = comparerPresencePilote(observations[avec], observations[sans]);
    r.comparaisons.push({ avec, sans, erreurs }); r.echecs += erreurs.length ? 1 : 0;
  }
  enregistrer(); return r;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagneModele(optionsModele(process.argv.slice(2))); console.log(JSON.stringify({ passages: r.passages.length, echecs: r.echecs, htmlSha256: r.htmlSha256 })); process.exitCode = r.echecs ? 1 : 0; }
  catch (e) { console.error(e.stack || String(e)); process.exitCode = 1; }
}
