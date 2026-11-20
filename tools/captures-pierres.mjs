#!/usr/bin/env node
// A/B de la seule recette de pierre, dans un même build réel. Pas deux versions du jeu.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from './controle-visuel.mjs';

export const VUES_PIERRES = Object.freeze([
  { id: 'haut-col-portail', circuit: 2, circuitId: 'haut-col', depart: 1798, fov: 44,
    position: [-546.7015631316593, 3.8749886892682275, 557.6125814468287],
    cible: [-545.4131550313992, 4.274988689268228, 562.2537024932122], genres: ['roche-tunnel', 'portail-tunnel'] },
  { id: 'route-des-cimes-pont', circuit: 8, circuitId: 'route-des-cimes', depart: 7952.1527022713235, fov: 50,
    position: [-797.1303130724671, 104.71100578744549, -761.3333330617273],
    cible: [-899.3271490908057, 100.71100578744549, -723.0045356915932], genres: ['arche-cimes', 'tympan-cimes', 'rive-pont-cimes'] }
].map(s => Object.freeze(s)));
export function optionsPierres(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'sortie', 'chrome', 'vues', 'saisons', 'taille'].includes(k)
      || o[k] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Option inconnue ou incomplète : ' + argv[i]);
    o[k] = argv[i + 1];
  }
  if (!o.url || !o.sortie || new URL(o.url).protocol !== 'file:') throw new Error('--url file: et --sortie nécessaires');
  o.vues = o.vues ? o.vues.split(',') : VUES_PIERRES.map(s => s.id);
  o.saisons = o.saisons ? o.saisons.split(',') : ['ete', 'hiver']; o.taille ||= '960,540';
  if (!o.vues.length || new Set(o.vues).size !== o.vues.length || o.vues.some(id => !VUES_PIERRES.some(s => s.id === id))) throw new Error('Vue inconnue ou dupliquée');
  if (!o.saisons.length || new Set(o.saisons).size !== o.saisons.length || o.saisons.some(s => !['ete', 'hiver'].includes(s))) throw new Error('Saison inconnue ou dupliquée');
  optionsScenarioPierres(scenariosPierres(o)[0], o, o.sortie); return o;
}
export function scenariosPierres(o) {
  return o.vues.flatMap(id => o.saisons.flatMap(saison => ['reference', 'procedurale'].map(variante => ({
    ...VUES_PIERRES.find(s => s.id === id), saison, variante, nom: id + '-' + saison + '-' + variante
  }))));
}
export function optionsScenarioPierres(s, o, sortie) {
  const args = ['--url', o.url, '--sortie', sortie, '--scenario', 'piste', '--circuit', String(s.circuit),
    '--saison', s.saison, '--meteo', 'sec', '--moment', 'jour', '--qualite', 'high', '--taille', o.taille,
    '--depart', String(s.depart), '--vitesse', '0', '--vue', 'poursuite', '--retro', 'non', '--images', '2',
    '--chauffe', '4', '--pas', '.1', '--attendre', '120000'];
  if (o.chrome) args.push('--chrome', o.chrome);
  return optionsCapture(args);
}
// M1 : marque explicite des seuls solides de pierre. Les fossés et la roche générique restent exclus.
export function pierreCible(o) {
  const genre = o.solidePhysX?.genre;
  return [9, 23].includes(o.mat) && (['roche-tunnel', 'portail-tunnel', 'arche-cimes', 'tympan-cimes', 'rive-pont-cimes'].includes(genre)
    || genre === 'refuge-cimes' && o.partie === 'socle-refuge');
}
export function preparerVariantePierres(d, variante) {
  if (!['reference', 'procedurale'].includes(variante)) throw new Error('Variante de pierre inconnue');
  const cibles = new Set(), occurrences = { proches: 0, lointaines: 0 };
  for (const l of d.lots) for (const [cle, nom] of [['objets', 'proches'], ['loin', 'lointaines']])
    for (const o of l[cle] || []) if (pierreCible(o)) { cibles.add(o); occurrences[nom]++; }
  if (!cibles.size || [...cibles].some(o => o.mat !== 23)) throw new Error('Le build ne porte pas le lot de pierres M1 attendu');
  const genres = {};
  for (const o of cibles) {
    genres[o.solidePhysX.genre] = (genres[o.solidePhysX.genre] || 0) + 1;
    if (variante === 'reference') o.mat = 9;
  }
  return { uniques: cibles.size, ...occurrences, genres, matiere: variante === 'reference' ? 9 : 23 };
}
export function viserPierres(world, solids, camera, s, sol) {
  const delta = s.cible.map((v, k) => v - camera.pos[k]), distance = Math.hypot(...delta);
  if (!Number.isFinite(distance) || distance <= 0 || camera.pos[1] <= sol(camera.pos[0], camera.pos[2])) throw new Error('Caméra de pierre invalide ou sous le terrain');
  const hit = world.raycast(camera.pos, delta.map(v => v / distance), distance, { mask: 3, staticOnly: true });
  const genre = hit.hit ? solids?.acteurs.get(hit.body)?.genre : null;
  // La visée peut se terminer dans la pierre montrée. Un autre solide ou le terrain devant est refusé.
  if (hit.hit && !s.genres.includes(genre)) throw new Error('Vue de pierre masquée par ' + (genre || 'un solide inconnu'));
  return { cibleDistance: distance, touchePierre: hit.hit, genre, distance: hit.hit ? hit.distance : null };
}
// SHA-256 par blocs : ne duplique pas les centaines de milliers d'instances en un seul JSON.
export async function empreintesPierres(d) {
  const encodeur = new TextEncoder();
  const sha = async v => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof v === 'string' ? encodeur.encode(v) : v)), b => b.toString(16).padStart(2, '0')).join('');
  const lots = [], solides = [];
  for (const l of d.lots) {
    lots.push(await sha(JSON.stringify(Object.fromEntries(Object.entries(l).filter(([k]) => k !== 'objets' && k !== 'loin')))));
    for (const cle of ['objets', 'loin']) {
      const objets = l[cle] || []; lots.push(cle + ':' + objets.length);
      for (let i = 0; i < objets.length; i += 1024) lots.push(await sha(JSON.stringify(objets.slice(i, i + 1024).map(o => pierreCible(o) ? { ...o, mat: 9 } : o))));
      for (const o of objets) if (o.solidePhysX) solides.push([o.shape, o.p, o.s, o.r, o.solidePhysX]);
    }
  }
  const nappes = [];
  for (const n of d.nappes) {
    const meta = {};
    for (const [cle, v] of Object.entries(n)) {
      if (ArrayBuffer.isView(v)) meta[cle] = await sha(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      else meta[cle] = v;
    }
    nappes.push(await sha(JSON.stringify(meta)));
  }
  return { lotsSansRecette: await sha(JSON.stringify(lots)), nappes: await sha(JSON.stringify(nappes)),
    solides: await sha(JSON.stringify(solides)), obstacles: await sha(JSON.stringify(d.obstacles)), racines: await sha(JSON.stringify(d.arbres)) };
}
export async function preparerPierres(s) {
  const J = BITUME_JEU, B = BITUME, S = J.session, d = J.scene.decor;
  if (J.CATALOGUE[s.circuit]?.id !== s.circuitId || d.saison.id !== s.saison || !S.reference || S.course.c.theme !== 'montagne') throw new Error('Référence circuit/saison de pierre différente');
  J.pauseAuto = false; J.reglages.secousses = 0; S.acc = -1;
  const camera = B.cinema.viser(s.position, s.cible, s.fov);
  const visee = viserPierres(S.course.physique.world, S.course.physique.solids, camera, s, d.sol);
  const matieres = preparerVariantePierres(d, s.variante), empreintes = await empreintesPierres(d);
  // Même rechargement et même chauffe dans les deux variantes ; seules les recettes cibles diffèrent.
  J.rendu.setLots(d.lots); J.camera = () => camera;
  const F = { scenario: s, camera, visee, matieres, empreintes, dessin: J.rendu.draw, arguments: null };
  J.rendu.draw = function (...args) { F.arguments = args; return F.dessin.apply(this, args); };
  globalThis.__PIERRES_CAPTURE = F;
  return { entree: 'BITUME_JEU.reference', modeleReel: true, methode: 'fixture-matiere-meme-build',
    camera, visee, matieres, empreintes, description: 'Témoin recette 9 / candidat recette 23 sur les mêmes pierres ; géométrie, climat et simulation conservés.' };
}
export function observerPierres(i) {
  const J = BITUME_JEU, S = J.session, F = __PIERRES_CAPTURE, gl = J.rendu.gl, cam = S.camera;
  const stats = () => Object.fromEntries(['drawCalls', 'triangles', 'instances'].map(k => [k, J.rendu.stats[k]]));
  const rendu = stats(), visee = viserPierres(S.course.physique.world, S.course.physique.solids, cam, F.scenario, J.scene.decor.sol);
  let cout = null;
  if (i === 1) {
    if (!F.arguments || F.arguments[0] !== cam) throw new Error('Arguments de la vraie image non observés');
    const avant = JSON.stringify([S.course.horloge, S.tRendu, S.course.voitures.map(v => v.etat)]), temps = [];
    try {
      gl.finish();
      for (let k = 0; k < 22; k++) {
        const t = performance.now(); F.dessin.apply(J.rendu, F.arguments); gl.finish();
        if (k >= 6) temps.push(performance.now() - t);
        if (JSON.stringify(stats()) !== JSON.stringify(rendu)) throw new Error('Comptage du dessin répété différent');
      }
      if (JSON.stringify([S.course.horloge, S.tRendu, S.course.voitures.map(v => v.etat)]) !== avant) throw new Error('Simulation modifiée pendant la mesure de dessin');
      const tries = [...temps].sort((a, b) => a - b);
      cout = { methode: 'draw-identique-gl.finish-performance.now', chauffe: 6, mesures: temps.length,
        echantillonsMs: temps, p50Ms: tries[Math.floor(tries.length * .5)], p95Ms: tries[Math.floor(tries.length * .95)],
        simulationInchangee: true, limite: 'Dessin synchrone répété sur raster logiciel ; bruit du runner et caches chauds, aucune conclusion FPS ou GPU matériel.' };
    } finally { J.rendu.draw = F.dessin; }
  }
  return { saison: J.scene.decor.saison.id, circuit: J.CATALOGUE[F.scenario.circuit].id, variante: F.scenario.variante,
    camera: { pos: [...cam.pos], yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov }, cameraPrescrite: F.camera,
    visee, matieres: F.matieres, empreintes: F.empreintes, rendu, cout,
    glErreur: gl.getError(), glPerdu: gl.isContextLost() };
}
export function verifierPierres(r, s) {
  const erreurs = [];
  if (r.fatal) erreurs.push(r.fatal.split('\n')[0]);
  if (r.erreurs?.length) erreurs.push(...r.erreurs);
  if (!/^[a-f0-9]{64}$/.test(r.build?.sha256 || '') || !/^[a-f0-9]{40}$/.test(r.source?.commit || '')) erreurs.push('Provenance absente');
  if (r.environnement?.webgl2 !== true || r.environnement?.physx?.ready !== true) erreurs.push('Renderer ou PhysX réel absent');
  if (r.initialisation?.modeleReel !== true || r.initialisation?.methode !== 'fixture-matiere-meme-build' || r.images?.length !== 2) erreurs.push('Fixture ou images incomplètes');
  for (const im of r.images || []) {
    const o = im.observation;
    if (!o || o.saison !== s.saison || o.circuit !== s.circuitId || o.variante !== s.variante) { erreurs.push('Observation de pierre absente'); continue; }
    if (o.glErreur || o.glPerdu) erreurs.push('Erreur graphique');
    const a = o.camera, b = o.cameraPrescrite;
    if (!a?.pos?.every(Number.isFinite) || !b?.pos || a.pos.some((v, k) => Math.abs(v - b.pos[k]) > 1e-8) || ['yaw', 'pitch', 'fov'].some(k => !Number.isFinite(a[k]) || Math.abs(a[k] - b[k]) > 1e-8)) erreurs.push('Caméra finale différente');
    if (!(o.matieres?.uniques > 0) || o.matieres.matiere !== (s.variante === 'reference' ? 9 : 23)) erreurs.push('Recette de pierre non exercée');
    if (!o.empreintes || ['lotsSansRecette', 'nappes', 'solides', 'obstacles', 'racines'].some(k => !/^[a-f0-9]{64}$/.test(o.empreintes[k] || ''))) erreurs.push('Empreinte de scène absente');
    if (['drawCalls', 'triangles', 'instances'].some(k => !Number.isInteger(o.rendu?.[k]) || o.rendu[k] <= 0)) erreurs.push('Comptage réel absent');
  }
  const cout = r.images?.[1]?.observation?.cout;
  if (!cout || cout.mesures !== 16 || cout.echantillonsMs?.length !== 16 || cout.echantillonsMs.some(v => !Number.isFinite(v) || v <= 0) || cout.simulationInchangee !== true) erreurs.push('Mesure du dessin absente ou invalide');
  return [...new Set(erreurs)];
}
export function comparerPierres(a, b) {
  const erreurs = [];
  if (a.build?.sha256 !== b.build?.sha256 || a.source?.commit !== b.source?.commit) erreurs.push('Builds ou commits différents');
  if (JSON.stringify(a.parametres) !== JSON.stringify(b.parametres) || JSON.stringify(a.environnement) !== JSON.stringify(b.environnement)) erreurs.push('Conditions ou environnements différents');
  for (let i = 0; i < 2; i++) {
    const x = a.images?.[i]?.observation, y = b.images?.[i]?.observation;
    if (!x || !y) { erreurs.push('Paire incomplète'); continue; }
    for (const cle of ['camera', 'empreintes', 'rendu']) if (JSON.stringify(x[cle]) !== JSON.stringify(y[cle])) erreurs.push(cle + ' différents');
    if (x.matieres?.uniques !== y.matieres?.uniques || JSON.stringify(x.matieres?.genres) !== JSON.stringify(y.matieres?.genres)) erreurs.push('Sélection de pierre différente');
  }
  const ca = a.images?.[1]?.observation?.cout, cb = b.images?.[1]?.observation?.cout;
  return { erreurs: [...new Set(erreurs)], dessinReferenceP50Ms: ca?.p50Ms ?? null, dessinProceduralP50Ms: cb?.p50Ms ?? null,
    rapportP50: ca?.p50Ms > 0 && Number.isFinite(cb?.p50Ms) ? cb.p50Ms / ca.p50Ms : null,
    limite: 'Ratio de répétitions logicielles, navigateurs séparés ; à relire avec dispersion, images et budgets matériels avant extension.' };
}
export async function campagnePierres(o) {
  mkdirSync(o.sortie, { recursive: true });
  const r = { format: 'bitume-captures-pierres-v1', methode: 'fixture-matiere-meme-build', passages: [], comparaisons: [], echecs: 0,
    limites: ['A/B limité aux recettes 9 et 23 sur les pierres M1 ; ne compare pas deux builds historiques.',
      'Photos du vrai jeu à inspecter. SwiftShader et horloge commandée : aucun FPS matériel qualifié.'] };
  const references = new Map();
  for (const s of scenariosPierres(o)) {
    const sortie = path.join(o.sortie, s.nom), p = optionsScenarioPierres(s, o, sortie);
    const fonctions = [pierreCible, preparerVariantePierres, viserPierres, empreintesPierres, preparerPierres];
    p.initialiser = ({ evaluer }) => evaluer(`(async () => { ${fonctions.map(f => 'const ' + f.name + ' = ' + f.toString() + ';').join('\n')} return preparerPierres(${JSON.stringify(s)}); })()`);
    p.observer = ({ evaluer, i }) => evaluer(`(() => { const viserPierres = ${viserPierres.toString()}; return (${observerPierres.toString()})(${i}); })()`);
    const resultat = await capturer(p), erreurs = verifierPierres(resultat, s), cle = s.id + ':' + s.saison;
    if (s.variante === 'reference') references.set(cle, resultat);
    else {
      const comparaison = comparerPierres(references.get(cle) || {}, resultat);
      r.comparaisons.push({ scene: cle, ...comparaison }); erreurs.push(...comparaison.erreurs);
    }
    const sha = createHash('sha256').update(readFileSync(fileURLToPath(o.url))).digest('hex');
    if (sha !== resultat.build?.sha256) erreurs.push('HTML changé pendant la capture');
    const empreintes = (resultat.images || []).map(im => ({ fichier: im.fichier,
      sha256: createHash('sha256').update(readFileSync(path.join(sortie, im.fichier))).digest('hex') }));
    r.passages.push({ scenario: s.nom, dossier: s.nom, build: resultat.build, source: resultat.source, empreintes, erreurs });
    r.echecs += erreurs.length ? 1 : 0;
    writeFileSync(path.join(o.sortie, 'rapport.json'), JSON.stringify(r, null, 2) + '\n');
    process.stderr.write(s.nom + ' : ' + erreurs.length + ' erreurs\n');
    if (resultat.fatal && !resultat.images?.length) break;
  }
  return r;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = await campagnePierres(optionsPierres(process.argv.slice(2))); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.echecs ? 1 : 0; }
  catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
