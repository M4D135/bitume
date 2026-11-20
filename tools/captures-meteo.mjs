#!/usr/bin/env node
// États de rendu bornés : pas de conduite ni de mesure FPS. Les voitures sont disposées puis figées;
// leurs vitesses alimentent la visière et les embruns pendant que l'horloge météo avance normalement.
import { mkdirSync, writeFileSync } from 'node:fs';
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
  { id: 'faune-haut-col-hiver', vitesse: 0, chauffe: 4, circuit: 2, faune: true, saison: 'hiver', sec: true }
].map(Object.freeze));
const CAS_AVANT = ['pluie-grille', 'pluie-spray235', 'neige45', 'faune-haut-col-ete', 'faune-haut-col-hiver'];

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
  if (!o.cas.length || new Set(o.cas).size !== o.cas.length || o.cas.some(id => !SCENARIOS.some(s => s.id === id))) throw new Error('Cas météo inconnu ou dupliqué');
  o.taille = o.taille || '960,540';
  const taille = o.taille.split(',').map(Number);
  if (taille.length !== 2 || taille.some(n => !Number.isInteger(n) || n < 240 || n > 1920)) throw new Error('Taille attendue : largeur,hauteur (240..1920)');
  return o;
}

// Cette fonction est sérialisée dans la page d'essai. Elle ne fait aucun appel réseau et ne remplace aucun module.
export function preparerEtat(s) {
  const J = BITUME_JEU, B = BITUME, S = J.session, co = S.course, c = co.c;
  S.acc = -1; J.pauseAuto = false; J.reglages.gouttes = 1;
  Object.assign(S.meteo, { reel: true, fixe: true, pluie: s.sec ? 0 : 1, nuage: s.sec ? .12 : .9, phase: s.sec ? 'clair' : 'pluie', mouille: s.sec ? 0 : 1,
    neige: s.saison === 'hiver', precipitationsNeige: !s.sec && s.saison === 'hiver', eclair: 0 });
  const depart = s.tunnel ? c.tunnel.debut - 60 : 280;
  function placer(v, abscisse, d, vitesse) {
    const e = v.etat, p = B.circuit.echantillon(c, abscisse);
    Object.assign(e, { s: ((abscisse % c.longueur) + c.longueur) % c.longueur, d, v: vitesse, psi: 0, beta: 0,
      y: p.y - d * Math.sin(p.devers || 0), tangage: Math.atan(p.pente || 0), roulis: p.devers || 0 });
    const pose = { x: p.x - Math.sin(p.cap) * d, y: e.y, z: p.z + Math.cos(p.cap) * d, cap: p.cap,
      tangage: e.tangage, roulis: e.roulis, braquage: 0, roule: v.roule || 0, rebond: [0, 0, 0, 0] };
    if (e._physx) Object.assign(e._physx, { x: pose.x, y: pose.y, z: pose.z, cap: pose.cap, groundCount: 4 });
    for (const liste of [S.prec, S.cour]) Object.assign(liste[v.id], pose);
  }
  for (const v of co.voitures) {
    const joueur = v.id === S.suivie, j2 = S.locaux?.[1] === v.id;
    const ds = joueur ? 0 : j2 && s.duo ? -14 : s.spray && v.id === 1 ? 18 : 30 + v.id * 9;
    placer(v, depart + ds, joueur || j2 || s.spray && v.id === 1 ? 0 : (v.id % 2 ? 2.6 : -2.6), j2 && s.duo ? 12.5 : s.vitesse);
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
  const avancer = __BITUME_CAPTURE.avancer;
  __BITUME_CAPTURE.avancer = ms => {
    // Les traces conservent leur pas de 30 Hz. Elles utilisent les vraies fonctions du jeu et le mouillage de la scène.
    if (J.ecran === 'course' && !s.faune && !s.sec && s.vitesse > 14)
      for (let i = 0; i < 3; i++) B.traces.pas(S.fx, co, S.cour, S.suivie || 0, 1 / 30, null);
    return avancer(ms);
  };
  globalThis.__METEO_FIXTURE = { faune, tunnel() {
    for (const v of co.voitures) placer(v, c.tunnel.debut + 95 + v.id * 5, 0, s.vitesse);
  } };
  return { poseFigee: true, vitesseEffetsKmh: s.vitesse * 3.6, faune,
    description: 'Positions fixées par outil; horloge météo et rendu réels. Aucun essai de conduite ou de FPS.' };
}

export function observerEtat() {
  const J = BITUME_JEU, S = J.session, gl = J.rendu.gl;
  const contexte = v => v ? Object.fromEntries(['pluie', 'neige', 'vitesse', 'abri', 'cockpit', 'qualite', 'intensite', 'embruns', 'pause'].map(k => [k, v[k]])) : null;
  const vitres = J.vitres || null, vitresGL = {};
  for (const [joueur, id] of [['j1', 'vitre'], ['j2', 'vitre2']]) if (vitres?.[joueur]?.backend === 'webgl2') {
    const g = document.getElementById(id)?.getContext('webgl2');
    vitresGL[joueur] = { present: !!g, erreur: g ? g.getError() : null, perdu: g ? g.isContextLost() : true };
  }
  return { glErreur: gl.getError(), glPerdu: gl.isContextLost(), vitres, vitresGL,
    j1: contexte(S.vitreContexte), j2: contexte(S.vueJ2?.vitreContexte), faune: __METEO_FIXTURE.faune,
    precipitation: { pluie: S.meteo.pluie, neige: S.meteo.precipitationsNeige },
    temps: S.meteo.t, ecran: J.ecran };
}

export function verifierRapport(r, s, candidat) {
  const fautes = [];
  if (r.fatal) fautes.push(r.fatal.split('\n')[0]);
  for (const e of r.erreurs) fautes.push('Erreur page : ' + e);
  for (const e of r.avertissements) if (/GL_INVALID|shader.*(error|failed)|GLSL|context lost/i.test(e)) fautes.push('Erreur graphique : ' + e);
  if (r.images.length !== (s.images || 2)) fautes.push('Nombre de captures incomplet');
  if (!/swiftshader|llvmpipe|software/i.test(r.environnement.gpu || '')) fautes.push('Raster logiciel non identifié');
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
    const glaces = !s.faune && qualite !== 'low' ? ['glace-g', 'glace-d', ...(s.duo ? ['glace-g2', 'glace-d2'] : [])] : [];
    for (const id of ['glace-g', 'glace-d', 'glace-g2', 'glace-d2']) {
      if (glaces.includes(id) && !im.etat.zones[id]) fautes.push('Rétroviseurs incomplets : ' + id);
      if (!glaces.includes(id) && im.etat.zones[id]) fautes.push('Toile de rétroviseur inattendue : ' + id);
    }
    if (s.tunnel && o.j1?.abri !== true) fautes.push('Caméra non abritée dans le tunnel');
    if (s.saison === 'hiver' && !s.faune && !(o.j1?.neige > 0 && o.j1.pluie === 0)) fautes.push('Neige non distinguée de la pluie');
    if (candidat && !s.faune) {
      if (!o.vitres?.j1) fautes.push('Diagnostic de visière J1 absent');
      for (const v of Object.values(o.vitres || {})) if (v?.erreur || v?.erreurs?.length || typeof v?.erreurs === 'number' && v.erreurs > 0 || v?.perdu) fautes.push('Erreur de visière : ' + JSON.stringify(v.erreur || v.erreurs || 'contexte perdu'));
      if (!s.sec && s.qualite !== 'low' && o.vitres?.j1?.backend !== 'webgl2') fautes.push('Optique WebGL2 inactive');
      if (s.duo && !o.vitres?.j2) fautes.push('Diagnostic visière J2 absent');
      if (!s.sec) for (const joueur of s.duo ? ['j1', 'j2'] : ['j1']) {
        const v = o.vitres?.[joueur];
        if (!v || v.pret !== true || !(v.dessins > 1 && v.etapes > 0)) fautes.push('Visière non préparée ou non dessinée : ' + joueur);
        if (v?.backend === 'webgl2' && s.qualite !== 'low' && !(v.copiesScene > 1 && v.pixelsSource > 0)) fautes.push('Scène non lue par la visière : ' + joueur);
      }
      if (s.spray && !(o.j1?.embruns > 0)) fautes.push('Nuage du rival absent');
      if (s.sec && (o.j1?.pluie || o.j1?.neige || o.j1?.embruns)) fautes.push('Effet humide présent au sec');
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
  return [...new Set(fautes)];
}

export function optionsScenario(s, url, sortie, o) {
  const args = ['--url', url, '--sortie', sortie, '--scenario', s.duo ? 'duo' : 'pluie', '--images', String(s.images || 2), '--chauffe', String(s.chauffe),
    '--taille', o.taille, '--pas', '.1', '--qualite', s.qualite || 'high', '--circuit', String(s.circuit || 0),
    '--saison', s.saison || 'ete', '--meteo', s.sec ? 'sec' : 'pluie', '--vitesse', String(s.vitesse), '--depart', '280', '--retro', s.faune ? 'non' : 'oui', '--attendre', '120000'];
  if (o.chrome) args.push('--chrome', o.chrome);
  return optionsCapture(args);
}

export async function campagne(o) {
  mkdirSync(o.sortie, { recursive: true });
  const resultat = { format: 'bitume-captures-meteo-v1', date: new Date().toISOString(), source: fileURLToPath(import.meta.url),
    limites: ['Raster logiciel SwiftShader; aucun FPS matériel qualifié.', 'Scènes disposées et figées pour comparer les effets; aucun essai de conduite.', 'Rendu et effets du HTML désigné, sans injection de leur implémentation.'], passages: [], echecs: 0 };
  for (const [nom, url] of [...(o.avant ? [['avant', o.avant]] : []), ['apres', o.url]]) for (const id of o.cas.filter(id => nom !== 'avant' || CAS_AVANT.includes(id))) {
    const s = SCENARIOS.find(s => s.id === id), sortie = path.join(o.sortie, nom, id);
    const p = optionsScenario(s, url, sortie, o);
    if (o.avant && nom === 'apres' && CAS_AVANT.includes(id)) p.reference = path.resolve(o.sortie, 'avant', id, 'rapport.json');
    p.ecrans = s.pause ? ['course', 'pause'] : ['course'];
    p.initialiser = ({ evaluer }) => evaluer(`(${preparerEtat.toString()})(${JSON.stringify(s)})`);
    p.observer = ({ evaluer }) => evaluer(`(${observerEtat.toString()})()`);
    p.avantImage = async ({ evaluer, i }) => {
      if (s.tunnel && i === 0) await evaluer('__METEO_FIXTURE.tunnel(); true');
      if (s.pause && (i === 0 || i === 2)) await evaluer(`document.getElementById('${i === 0 ? 'b-pause' : 'b-reprendre'}').click(); true`);
    };
    const r = await capturer(p), erreurs = verifierRapport(r, s, nom === 'apres');
    resultat.passages.push({ variante: nom, scenario: id, dossier: path.relative(o.sortie, sortie), images: r.images.length, erreurs });
    resultat.echecs += erreurs.length ? 1 : 0;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(resultat, null, 2) + '\n');
    process.stderr.write(`${nom}/${id} : ${r.images.length} images, ${erreurs.length} erreurs\n`);
    if (r.fatal && r.images.length === 0) break; // pas dix tentatives si le navigateur ne peut pas démarrer
  }
  return resultat;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagne(optionsMeteo(process.argv.slice(2))); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.echecs ? 1 : 0; }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
